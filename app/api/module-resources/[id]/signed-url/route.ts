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

    // Get resource from module_resources table (include module_id for access check)
    const { data: resource, error: resourceError } = await supabase
      .from('module_resources')
      .select('id, title, file_path, file_type, content_type, module_id')
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

    // Verify user has access to this module resource
    // Access chain: module_resources -> learning_modules -> cohort/global/linked
    let hasAccess = false;

    if (!resource.module_id) {
      // Orphaned resource (no parent module) — cannot determine cohort restrictions
      hasAccess = true;
    } else {
      // Get parent module to check cohort/global access
      const { data: module } = await supabase
        .from('learning_modules')
        .select('cohort_id, is_global')
        .eq('id', resource.module_id)
        .single();

      if (module) {
        // Global modules are accessible to all authenticated users
        if (module.is_global) {
          hasAccess = true;
        }

        if (!hasAccess) {
          // Get all cohorts the user belongs to via role assignments
          const { data: userRoles } = await supabase
            .from('user_role_assignments')
            .select('cohort_id')
            .eq('user_id', user.id);

          const userCohortIds = (userRoles || [])
            .map(r => r.cohort_id)
            .filter((id): id is string => id !== null);

          // Check 1: module belongs directly to user's cohort
          if (module.cohort_id && userCohortIds.includes(module.cohort_id)) {
            hasAccess = true;
          }

          // Check 2: module is linked to user's cohort via cross-cohort sharing
          if (!hasAccess && userCohortIds.length > 0) {
            const { data: link } = await supabase
              .from('cohort_module_links')
              .select('id')
              .eq('module_id', resource.module_id)
              .in('cohort_id', userCohortIds)
              .limit(1)
              .maybeSingle();

            if (link) hasAccess = true;
          }

          // Fallback: legacy profiles.cohort_id
          if (!hasAccess && module.cohort_id) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('cohort_id')
              .eq('id', user.id)
              .single();

            hasAccess = !!(profile?.cohort_id && profile.cohort_id === module.cohort_id);
          }
        }
      }
      // If module not found (deleted parent), hasAccess remains false
    }

    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Determine expiry based on file type
    // PDFs: 15 minutes (900 seconds)
    // Office docs: 1 hour (3600 seconds) for Office Online compatibility
    const fileType = resource.file_type?.toLowerCase() || '';
    const isOfficeDoc = ['doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx'].includes(fileType);
    const expirySeconds = isOfficeDoc ? 3600 : 900;

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
