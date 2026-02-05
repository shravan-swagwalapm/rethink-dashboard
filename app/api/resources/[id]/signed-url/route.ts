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

    // Get resource details
    const { data: resource, error: resourceError } = await supabase
      .from('resources')
      .select('file_path, cohort_id, is_global')
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

    // Check access: global resources OR user's cohort matches
    const hasAccess = resource.is_global || 
                      (profile?.cohort_id === resource.cohort_id);

    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Generate signed URL (60 second expiry for security)
    const { data: signedUrl, error: signedError } = await supabase.storage
      .from('resources')
      .createSignedUrl(resource.file_path, 60);

    if (signedError || !signedUrl) {
      return NextResponse.json({ error: 'Failed to generate URL' }, { status: 500 });
    }

    return NextResponse.json({ signedUrl: signedUrl.signedUrl });

  } catch (error) {
    console.error('Error generating signed URL:', error);
    return NextResponse.json(
      { error: 'Failed to generate signed URL' },
      { status: 500 }
    );
  }
}
