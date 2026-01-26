import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

async function verifyAdmin() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { authorized: false, error: 'Unauthorized', status: 401 };
  }

  // Check admin role from database only - no domain-based bypass
  const adminClient = await createAdminClient();
  const { data: profile } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const isAdmin = profile?.role === 'admin' || profile?.role === 'company_user';

  if (!isAdmin) {
    return { authorized: false, error: 'Forbidden', status: 403 };
  }

  return { authorized: true, userId: user.id };
}

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

// POST - Upload file
export async function POST(request: NextRequest) {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const cohortId = formData.get('cohort_id') as string;
    const parentId = formData.get('parent_id') as string | null;
    const weekNumber = formData.get('week_number') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 });
    }

    if (!cohortId) {
      return NextResponse.json({ error: 'Cohort is required' }, { status: 400 });
    }

    const adminClient = await createAdminClient();

    // Generate unique filename
    const timestamp = Date.now();
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filePath = `${cohortId}/${timestamp}_${sanitizedName}`;

    // Convert File to ArrayBuffer then to Buffer for upload
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
      console.error('Upload error:', uploadError);

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
        cohort_id: cohortId,
        parent_id: parentId || null,
        week_number: weekNumber ? parseInt(weekNumber) : null,
        uploaded_by: auth.userId,
      })
      .select()
      .single();

    if (dbError) {
      // Cleanup uploaded file if database insert fails
      await adminClient.storage.from('resources').remove([filePath]);
      throw dbError;
    }

    return NextResponse.json(resource);
  } catch (error) {
    console.error('Error uploading file:', error);
    return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 });
  }
}
