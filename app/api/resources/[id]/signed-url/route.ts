import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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
    const resourceId = id;

    // Get resource details (include file_type for expiry calculation)
    const { data: resource, error: resourceError } = await supabase
      .from('resources')
      .select('file_path, cohort_id, is_global, file_type')
      .eq('id', resourceId)
      .single();

    if (resourceError || !resource) {
      return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
    }

    if (!resource.file_path) {
      return NextResponse.json({ error: 'Resource has no file' }, { status: 400 });
    }

    // Verify user has access to this resource
    const { data: profile } = await supabase
      .from('profiles')
      .select('cohort_id')
      .eq('id', user.id)
      .single();

    // Check access: global resources OR user's cohort matches (both must be non-null)
    const hasAccess = resource.is_global ||
                      (profile?.cohort_id && profile.cohort_id === resource.cohort_id);

    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Generate signed URL with appropriate expiry
    // Office documents (doc, docx, ppt, pptx, xls, xlsx) need longer expiry
    // because Office Online fetches the file from the URL and needs time
    // PDFs use blob approach so 15 min is sufficient
    // Other files use shorter expiry for security
    const fileType = resource.file_type?.toLowerCase() || '';
    const isOfficeDoc = ['doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx'].includes(fileType);
    const isPDF = fileType === 'pdf';

    // Office docs: 1 hour (Office Online needs to fetch), PDFs: 15 min, Others: 10 min
    const expirySeconds = isOfficeDoc ? 3600 : (isPDF ? 900 : 600);

    console.log('[SignedURL] Generating URL:', {
      resourceId,
      fileType,
      isOfficeDoc,
      expirySeconds,
      filePath: resource.file_path,
    });

    const { data: signedUrl, error: signedError } = await supabase.storage
      .from('resources')
      .createSignedUrl(resource.file_path, expirySeconds);

    if (signedError || !signedUrl) {
      console.error('[SignedURL] Failed to generate:', signedError);
      return NextResponse.json({ error: 'Failed to generate URL' }, { status: 500 });
    }

    console.log('[SignedURL] Generated successfully:', {
      resourceId,
      urlPrefix: signedUrl.signedUrl.substring(0, 80) + '...',
    });

    return NextResponse.json({ signedUrl: signedUrl.signedUrl });

  } catch (error) {
    console.error('Error generating signed URL:', error);
    return NextResponse.json(
      { error: 'Failed to generate signed URL' },
      { status: 500 }
    );
  }
}
