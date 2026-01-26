import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

/**
 * POST /api/admin/cohorts/[id]/link-modules
 * Link modules from another cohort or global library to this cohort
 *
 * Request body:
 * - source_cohort_id: UUID of source cohort or 'global' for global library
 * - module_ids: Optional array of specific module IDs to link (null = link all)
 */
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createRouteHandlerClient({ cookies });

  // Verify authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify admin role
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  if (!['super_admin', 'admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { source_cohort_id, module_ids } = body;

    if (!source_cohort_id) {
      return NextResponse.json(
        { error: 'source_cohort_id is required' },
        { status: 400 }
      );
    }

    // Fetch modules to link
    let query = supabase
      .from('learning_modules')
      .select('id, title, cohort_id, is_global');

    if (source_cohort_id === 'global') {
      // Link global library modules
      query = query.eq('is_global', true);
    } else {
      // Link modules from specific cohort
      query = query.eq('cohort_id', source_cohort_id);
    }

    // If specific module IDs provided, filter to those
    if (module_ids && Array.isArray(module_ids) && module_ids.length > 0) {
      query = query.in('id', module_ids);
    }

    const { data: modules, error: fetchError } = await query;

    if (fetchError) {
      console.error('Error fetching modules:', fetchError);
      throw fetchError;
    }

    if (!modules || modules.length === 0) {
      return NextResponse.json(
        { message: 'No modules found to link', links_created: 0 },
        { status: 200 }
      );
    }

    // Create cohort_module_links
    const links = modules.map(module => ({
      cohort_id: params.id,
      module_id: module.id,
      source_cohort_id: source_cohort_id === 'global' ? null : source_cohort_id,
      linked_by: user.id,
    }));

    const { data: createdLinks, error: linkError } = await supabase
      .from('cohort_module_links')
      .insert(links)
      .select();

    if (linkError) {
      // Handle duplicate links gracefully (UNIQUE constraint violation)
      if (linkError.code === '23505') {
        return NextResponse.json({
          message: 'Some modules were already linked',
          links_created: 0
        }, { status: 200 });
      }
      console.error('Error creating links:', linkError);
      throw linkError;
    }

    return NextResponse.json({
      message: `Successfully linked ${createdLinks?.length || 0} modules`,
      links_created: createdLinks?.length || 0,
      links: createdLinks,
    });

  } catch (error) {
    console.error('Error linking modules:', error);
    return NextResponse.json(
      { error: 'Failed to link modules' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/cohorts/[id]/link-modules
 * Unlink modules from this cohort
 *
 * Request body:
 * - module_ids: Array of module IDs to unlink
 */
export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createRouteHandlerClient({ cookies });

  // Verify authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify admin role
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  }

  if (!['super_admin', 'admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { module_ids } = body;

    if (!module_ids || !Array.isArray(module_ids) || module_ids.length === 0) {
      return NextResponse.json(
        { error: 'module_ids array is required' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('cohort_module_links')
      .delete()
      .eq('cohort_id', params.id)
      .in('module_id', module_ids);

    if (error) {
      console.error('Error unlinking modules:', error);
      throw error;
    }

    return NextResponse.json({
      message: `Successfully unlinked ${module_ids.length} modules`,
    });

  } catch (error) {
    console.error('Error unlinking modules:', error);
    return NextResponse.json(
      { error: 'Failed to unlink modules' },
      { status: 500 }
    );
  }
}
