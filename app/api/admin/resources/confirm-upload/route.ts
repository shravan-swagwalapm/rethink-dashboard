import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// Route config
export const maxDuration = 30;
export const dynamic = 'force-dynamic';

async function verifyAdmin() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { authorized: false, error: 'Unauthorized', status: 401 };
  }

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

/**
 * POST /api/admin/resources/confirm-upload
 *
 * Confirm that a file has been uploaded to Supabase Storage and create
 * the corresponding database record in module_resources.
 *
 * Request body:
 * - filePath: string (storage path from upload-url response)
 * - moduleId: string (target module ID)
 * - title: string (resource title)
 * - contentType: 'slides' | 'document'
 * - fileType: string (e.g., "pdf")
 * - fileSize: number (bytes)
 * - sessionNumber?: number (optional)
 * - orderIndex?: number (optional)
 * - durationSeconds?: number (optional)
 *
 * Response:
 * - resource: ModuleResource (created resource record)
 */
export async function POST(request: NextRequest) {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const {
      filePath,
      moduleId,
      title,
      contentType,
      fileType,
      fileSize,
      sessionNumber,
      orderIndex,
      durationSeconds,
    } = body;

    // Validation: Required fields
    if (!filePath || !moduleId || !title || !contentType) {
      return NextResponse.json(
        { error: 'Missing required fields: filePath, moduleId, title, contentType' },
        { status: 400 }
      );
    }

    console.log('[Confirm Upload] Confirming upload:', {
      filePath,
      moduleId,
      title,
      contentType,
      fileSize: fileSize ? `${(fileSize / 1024 / 1024).toFixed(2)} MB` : 'unknown',
    });

    const adminClient = await createAdminClient();

    // Step 1: Verify file exists in storage
    const pathParts = filePath.split('/');
    const fileName = pathParts.pop();
    const folderPath = pathParts.join('/');

    const { data: fileList, error: listError } = await adminClient.storage
      .from('resources')
      .list(folderPath, {
        search: fileName,
      });

    if (listError) {
      console.error('[Confirm Upload] Error checking file existence:', listError);
      return NextResponse.json(
        {
          error: 'Failed to verify uploaded file',
          details: listError.message
        },
        { status: 500 }
      );
    }

    const fileExists = fileList?.some(f => f.name === fileName);

    if (!fileExists) {
      console.error('[Confirm Upload] File not found in storage:', {
        filePath,
        folderPath,
        fileName,
        filesFound: fileList?.length || 0,
      });
      return NextResponse.json(
        { error: 'Upload not complete. File not found in storage. Please retry upload.' },
        { status: 400 }
      );
    }

    console.log('[Confirm Upload] File verified in storage:', filePath);

    // Step 2: Verify module exists
    const { data: module, error: moduleError } = await adminClient
      .from('learning_modules')
      .select('id, title')
      .eq('id', moduleId)
      .single();

    if (moduleError || !module) {
      console.error('[Confirm Upload] Module not found:', moduleId, moduleError);
      return NextResponse.json(
        { error: 'Module not found' },
        { status: 404 }
      );
    }

    console.log('[Confirm Upload] Module verified:', module.title);

    // Step 3: Create resource record in module_resources
    const { data: resource, error: insertError } = await adminClient
      .from('module_resources')
      .insert({
        module_id: moduleId,
        title: title,
        content_type: contentType,
        file_path: filePath,
        file_type: fileType || 'pdf',
        file_size: fileSize || null,
        session_number: sessionNumber || null,
        duration_seconds: durationSeconds || null,
        order_index: orderIndex !== undefined ? orderIndex : 0,
        // Clear legacy fields to avoid confusion
        external_url: null,
        google_drive_id: null,
      })
      .select()
      .single();

    if (insertError) {
      console.error('[Confirm Upload] Failed to create resource record:', insertError);

      // Note: We're NOT cleaning up the uploaded file here because:
      // 1. The file exists and is valid
      // 2. User might retry the confirmation successfully
      // 3. Orphaned files can be cleaned up by a separate job if needed

      return NextResponse.json(
        {
          error: 'Failed to create resource record',
          details: insertError.message
        },
        { status: 500 }
      );
    }

    console.log('[Confirm Upload] Resource created successfully:', {
      resourceId: resource.id,
      title: resource.title,
      filePath: resource.file_path,
      moduleTitle: module.title,
    });

    return NextResponse.json({ resource });

  } catch (error) {
    console.error('[Confirm Upload] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        error: 'Failed to confirm upload',
        details: errorMessage
      },
      { status: 500 }
    );
  }
}
