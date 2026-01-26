import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

async function verifyAdmin() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { authorized: false, error: 'Unauthorized', status: 401, userId: null };
  }

  const adminClient = await createAdminClient();
  const { data: profile } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const isAdmin = profile?.role === 'admin' || profile?.role === 'super_admin';

  if (!isAdmin) {
    return { authorized: false, error: 'Forbidden', status: 403, userId: null };
  }

  return { authorized: true, userId: user.id };
}

/**
 * POST /api/admin/cohorts/[id]/link-modules
 * Link modules from another cohort or global library to this cohort
 *
 * Request body:
 * - source_cohort_id: UUID of source cohort or 'global' for global library
 * - module_ids: Optional array of specific module IDs to link (null = link all)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: cohortId } = await params;

  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
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

    const adminClient = await createAdminClient();

    // Fetch modules to link
    let query = adminClient
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
      cohort_id: cohortId,
      module_id: module.id,
      source_cohort_id: source_cohort_id === 'global' ? null : source_cohort_id,
      linked_by: auth.userId,
    }));

    const { data: createdLinks, error: linkError } = await adminClient
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
 * - module_ids: Array of module IDs to unlink (optional if unlink_all is true)
 * - unlink_all: Boolean flag to unlink all linked modules (optional)
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: cohortId } = await params;

  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await req.json();
    const { module_ids, unlink_all } = body;

    const adminClient = await createAdminClient();

    // Handle bulk unlink - delete ALL links for this cohort
    if (unlink_all === true) {
      const { data: deletedLinks, error } = await adminClient
        .from('cohort_module_links')
        .delete()
        .eq('cohort_id', cohortId)
        .select();

      if (error) {
        console.error('Error unlinking all modules:', error);
        throw error;
      }

      return NextResponse.json({
        message: `Successfully unlinked all modules`,
        unlinked_count: deletedLinks?.length || 0,
      });
    }

    // Handle specific module unlink
    if (!module_ids || !Array.isArray(module_ids) || module_ids.length === 0) {
      return NextResponse.json(
        { error: 'module_ids array or unlink_all flag required' },
        { status: 400 }
      );
    }

    const { error } = await adminClient
      .from('cohort_module_links')
      .delete()
      .eq('cohort_id', cohortId)
      .in('module_id', module_ids);

    if (error) {
      console.error('Error unlinking modules:', error);
      throw error;
    }

    return NextResponse.json({
      message: `Successfully unlinked ${module_ids.length} modules`,
      unlinked_count: module_ids.length,
    });

  } catch (error) {
    console.error('Error unlinking modules:', error);
    return NextResponse.json(
      { error: 'Failed to unlink modules' },
      { status: 500 }
    );
  }
}
