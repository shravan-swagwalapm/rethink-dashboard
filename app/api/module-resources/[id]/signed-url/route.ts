import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/module-resources/[id]/signed-url
 *
 * Generate a signed URL for a module resource file stored in Supabase Storage.
 * Used for PDFs (slides, documents) that are uploaded to storage.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();

  try {
    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Await params in Next.js 16
    const { id } = await params;

    // Get resource from module_resources table
    const { data: resource, error: resourceError } = await supabase
      .from('module_resources')
      .select('id, title, file_path, file_type, content_type')
      .eq('id', id)
      .single();

    if (resourceError || !resource) {
      console.error('[ModuleResource SignedURL] Resource not found:', resourceError);
      return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
    }

    if (!resource.file_path) {
      return NextResponse.json(
        { error: 'Resource has no uploaded file. It may be a YouTube video or external link.' },
        { status: 400 }
      );
    }

    // Determine expiry based on file type
    // PDFs: 15 minutes (900 seconds)
    // Office docs: 1 hour (3600 seconds) for Office Online compatibility
    const fileType = resource.file_type?.toLowerCase() || '';
    const isOfficeDoc = ['doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx'].includes(fileType);
    const expirySeconds = isOfficeDoc ? 3600 : 900;

    console.log('[ModuleResource SignedURL] Generating URL:', {
      resourceId: id,
      title: resource.title,
      fileType: resource.file_type,
      filePath: resource.file_path,
      expirySeconds,
    });

    // Generate signed URL from Supabase Storage
    const { data: signedUrl, error: signedError } = await supabase.storage
      .from('resources')
      .createSignedUrl(resource.file_path, expirySeconds);

    if (signedError || !signedUrl) {
      console.error('[ModuleResource SignedURL] Failed to generate:', signedError);
      return NextResponse.json(
        { error: 'Failed to generate signed URL' },
        { status: 500 }
      );
    }

    console.log('[ModuleResource SignedURL] Generated successfully for:', resource.title);

    return NextResponse.json({
      url: signedUrl.signedUrl,
      filename: resource.title,
      fileType: resource.file_type || 'pdf',
      contentType: resource.content_type,
      expiresIn: expirySeconds,
    });

  } catch (error) {
    console.error('[ModuleResource SignedURL] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate signed URL' },
      { status: 500 }
    );
  }
}
