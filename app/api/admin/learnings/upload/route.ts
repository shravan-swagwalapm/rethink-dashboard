import { createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/api/verify-admin';

// Route segment config for file uploads
export const maxDuration = 120;
export const dynamic = 'force-dynamic';

function getFileType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const typeMap: Record<string, string> = {
    pdf: 'pdf',
    doc: 'doc',
    docx: 'docx',
    ppt: 'ppt',
    pptx: 'pptx',
  };
  return typeMap[ext] || 'other';
}

/**
 * POST /api/admin/learnings/upload
 *
 * Learnings-specific upload endpoint.
 * Uploads file to Supabase Storage and creates a module_resources record ONLY.
 * Does NOT insert into the resources table (prevents dual insert bug).
 *
 * Form data:
 * - file: File
 * - cohort_id: string (or 'global')
 * - module_id: string (required for new resources, omit for storage-only mode)
 * - title: string (required for new resources)
 * - content_type: 'slides' | 'document' (required for new resources)
 * - session_number?: string (optional)
 * - order_index?: string (optional)
 * - duration_seconds?: string (optional)
 *
 * If module_id is omitted, operates in "storage-only" mode:
 * uploads the file and returns file_path/file_type/file_size without creating a DB record.
 * This is used when updating an existing resource's file.
 */
export async function POST(request: NextRequest) {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const cohortIdParam = formData.get('cohort_id') as string;
    const moduleId = formData.get('module_id') as string;
    const title = formData.get('title') as string;
    const contentType = formData.get('content_type') as string;
    const sessionNumber = formData.get('session_number') as string | null;
    const orderIndex = formData.get('order_index') as string | null;
    const durationSeconds = formData.get('duration_seconds') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 });
    }

    // Storage-only mode: just upload, no DB record
    const storageOnly = !moduleId;

    if (!storageOnly && (!title || !contentType)) {
      return NextResponse.json(
        { error: 'title and content_type are required when module_id is provided' },
        { status: 400 }
      );
    }

    // Validate file size (100MB max)
    const maxSize = 100 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File too large. Maximum file size is 100MB.' },
        { status: 413 }
      );
    }

    if (!cohortIdParam) {
      return NextResponse.json({ error: 'Cohort is required' }, { status: 400 });
    }

    const isGlobal = cohortIdParam === 'global';
    const storageFolder = isGlobal ? 'global' : cohortIdParam;

    const adminClient = await createAdminClient();

    // Generate unique filename
    const timestamp = Date.now();
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filePath = `${storageFolder}/${timestamp}_${sanitizedName}`;

    // Convert File to Buffer for upload
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await adminClient.storage
      .from('resources')
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('[Learnings Upload] Storage upload failed:', uploadError);
      return NextResponse.json(
        { error: 'Failed to upload file', details: uploadError.message },
        { status: 500 }
      );
    }

    // Storage-only mode: return file metadata without creating DB record
    if (storageOnly) {
      return NextResponse.json({
        file_path: uploadData.path,
        file_type: getFileType(file.name),
        file_size: file.size,
      });
    }

    // Create module_resources record ONLY (not resources table)
    const { data: resource, error: dbError } = await adminClient
      .from('module_resources')
      .insert({
        module_id: moduleId,
        title: title,
        content_type: contentType,
        file_path: uploadData.path,
        file_type: getFileType(file.name),
        file_size: file.size,
        session_number: sessionNumber ? parseInt(sessionNumber) : null,
        order_index: orderIndex ? parseInt(orderIndex) : 0,
        duration_seconds: durationSeconds ? parseInt(durationSeconds) : null,
        external_url: null,
        google_drive_id: null,
      })
      .select()
      .single();

    if (dbError) {
      console.error('[Learnings Upload] Database insert failed:', dbError);
      // Clean up uploaded file on DB failure
      await adminClient.storage.from('resources').remove([filePath]);
      return NextResponse.json(
        { error: 'Failed to save resource record', details: dbError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ resource });
  } catch (error) {
    console.error('[Learnings Upload] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to upload file', details: errorMessage },
      { status: 500 }
    );
  }
}
