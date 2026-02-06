import { createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/api/verify-admin';

/**
 * GET /api/admin/cohorts/[id]/stats
 * Get resource sharing statistics for a cohort
 *
 * Returns:
 * - total_modules: Total number of modules accessible to this cohort
 * - own_modules: Modules directly owned by this cohort
 * - linked_modules: Modules linked from other cohorts
 * - global_modules: Global library modules accessible to all
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: cohortId } = await params;

  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const adminClient = await createAdminClient();

    // Step 1: Fetch cohort state to determine active link
    const { data: cohort, error: cohortError } = await adminClient
      .from('cohorts')
      .select('id, name, active_link_type, linked_cohort_id')
      .eq('id', cohortId)
      .single();

    if (cohortError) {
      console.error('Error fetching cohort:', cohortError);
      throw cohortError;
    }

    if (!cohort) {
      return NextResponse.json({ error: 'Cohort not found' }, { status: 404 });
    }

    // Step 2: Count own modules (always count for display)
    const { data: ownModules } = await adminClient
      .from('learning_modules')
      .select('id')
      .eq('cohort_id', cohortId);

    const ownCount = ownModules?.length || 0;

    // Step 3: Count linked cohort modules (if linked to another cohort)
    let linkedCount = 0;
    let linkedCohortName = '';

    if (cohort.linked_cohort_id) {
      const { data: linkedModules } = await adminClient
        .from('learning_modules')
        .select('id')
        .eq('cohort_id', cohort.linked_cohort_id);

      linkedCount = linkedModules?.length || 0;

      // Get source cohort name
      const { data: sourceCohort } = await adminClient
        .from('cohorts')
        .select('name')
        .eq('id', cohort.linked_cohort_id)
        .single();

      linkedCohortName = sourceCohort?.name || 'Unknown Cohort';
    }

    // Step 4: Count global modules
    const { data: globalModules } = await adminClient
      .from('learning_modules')
      .select('id')
      .eq('is_global', true);

    const globalCount = globalModules?.length || 0;

    // Step 5: Calculate visible modules based on active link type (OVERRIDE logic)
    let visibleCount = 0;
    let activeSourceName = 'Own Modules';

    switch (cohort.active_link_type) {
      case 'global':
        visibleCount = globalCount;
        activeSourceName = 'Global Library';
        break;

      case 'cohort':
        visibleCount = linkedCount;
        activeSourceName = linkedCohortName;
        break;

      case 'own':
      default:
        visibleCount = ownCount;
        activeSourceName = 'Own Modules';
        break;
    }

    return NextResponse.json({
      // What students see (override logic)
      visible_modules: visibleCount,
      active_source: cohort.active_link_type || 'own',
      active_source_name: activeSourceName,

      // Available counts (for admin visibility)
      own_modules: ownCount,
      linked_modules: linkedCount,
      global_modules: globalCount,

      // Cohort link info
      linked_cohort_id: cohort.linked_cohort_id,
      linked_cohort_name: linkedCohortName || null,

      // Legacy field (for backward compatibility)
      total_modules: visibleCount,
    });

  } catch (error) {
    console.error('Error fetching cohort stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
