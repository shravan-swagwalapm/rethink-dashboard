import { createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/api/verify-admin';

// Route segment config for large file uploads (up to 100MB)
export const maxDuration = 120; // 2 minutes timeout for large uploads
export const dynamic = 'force-dynamic'; // Disable caching for file uploads

function getFileType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const typeMap: Record<string, string> = {
    pdf: 'pdf',
    doc: 'doc',
    docx: 'docx',
    xls: 'xls',
    xlsx: 'xlsx',
    mp4: 'mp4',
    mov: 'mp4',
    avi: 'mp4',
    webm: 'mp4',
  };
  return typeMap[ext] || 'other';
}

function getCategoryFromFileType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';

  // Video
  if (['mp4', 'mov', 'avi', 'webm', 'mkv'].includes(ext)) {
    return 'video';
  }

  // Presentation
  if (['ppt', 'pptx'].includes(ext)) {
    return 'presentation';
  }

  // PDF
  if (ext === 'pdf') {
    return 'pdf';
  }

  // Article (documents, text files, etc.)
  return 'article';
}

// POST - Upload file
export async function POST(request: NextRequest) {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const cohortIdParam = formData.get('cohort_id') as string;
    const parentId = formData.get('parent_id') as string | null;
    const weekNumber = formData.get('week_number') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 });
    }

    // Validate file size (100MB max to match Supabase Storage bucket limit)
    const maxSize = 100 * 1024 * 1024; // 100MB in bytes
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File too large. Maximum file size is 100MB.' },
        { status: 413 }
      );
    }

    if (!cohortIdParam) {
      return NextResponse.json({ error: 'Cohort is required' }, { status: 400 });
    }

    // Handle global library: use 'global' for storage path, NULL for database
    const isGlobal = cohortIdParam === 'global';
    const storageFolder = isGlobal ? 'global' : cohortIdParam;
    const dbCohortId = isGlobal ? null : cohortIdParam;

    const adminClient = await createAdminClient();

    // Generate unique filename
    const timestamp = Date.now();
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filePath = `${storageFolder}/${timestamp}_${sanitizedName}`;

    // Convert File to ArrayBuffer then to Buffer for upload
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Log upload attempt details for debugging
    console.log('[Upload] Attempting to upload:', {
      bucket: 'resources',
      filePath,
      fileSize: file.size,
      fileType: file.type,
      cohortId: storageFolder,
    });

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await adminClient.storage
      .from('resources')
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('[Upload] Storage upload failed:', uploadError);

      // Provide specific error messages
      let errorMessage = 'Failed to upload file';
      if (uploadError.message?.includes('bucket')) {
        errorMessage = 'Storage bucket not configured. Please contact administrator.';
      } else if (uploadError.message?.includes('policy')) {
        errorMessage = 'Storage permissions not configured. Please contact administrator.';
      } else if (uploadError.message?.includes('size')) {
        errorMessage = 'File size exceeds the limit (50MB max).';
      }

      return NextResponse.json({
        error: errorMessage,
        details: uploadError.message
      }, { status: 500 });
    }

    // Create database record
    const { data: resource, error: dbError } = await adminClient
      .from('resources')
      .insert({
        name: file.name,
        type: 'file',
        file_path: uploadData.path,
        file_type: getFileType(file.name),
        file_size: file.size,
        category: getCategoryFromFileType(file.name),
        cohort_id: dbCohortId,
        parent_id: parentId || null,
        week_number: weekNumber ? parseInt(weekNumber) : null,
        uploaded_by: auth.userId,
      })
      .select()
      .single();

    if (dbError) {
      // Cleanup uploaded file if database insert fails
      console.error('[Upload] Database insert failed:', dbError);
      await adminClient.storage.from('resources').remove([filePath]);
      throw dbError;
    }

    console.log('[Upload] Storage upload succeeded:', uploadData);
    return NextResponse.json(resource);
  } catch (error) {
    console.error('[Upload] Error uploading file:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorDetails = error instanceof Error ? error.stack : String(error);

    console.error('[Upload] Error details:', {
      message: errorMessage,
      details: errorDetails,
      error: error
    });

    return NextResponse.json(
      {
        error: 'Failed to upload file',
        details: errorMessage,  // Send actual error to frontend for debugging
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
