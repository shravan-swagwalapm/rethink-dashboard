import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

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
    // Get cohort's own modules
    const { data: ownModules, error: ownError } = await supabase
      .from('learning_modules')
      .select('id')
      .eq('cohort_id', params.id);

    if (ownError) {
      console.error('Error fetching own modules:', ownError);
      throw ownError;
    }

    // Get linked modules (via cohort_module_links)
    const { data: linkedModules, error: linkedError } = await supabase
      .from('cohort_module_links')
      .select(`
        module_id,
        learning_modules (
          id,
          is_global
        )
      `)
      .eq('cohort_id', params.id);

    if (linkedError) {
      console.error('Error fetching linked modules:', linkedError);
      throw linkedError;
    }

    // Count global modules among linked modules
    const globalModules = (linkedModules || []).filter(
      link => (link.learning_modules as any)?.is_global === true
    );

    // Calculate stats
    const ownCount = ownModules?.length || 0;
    const linkedCount = (linkedModules?.length || 0) - globalModules.length;
    const globalCount = globalModules.length;
    const totalCount = ownCount + (linkedModules?.length || 0);

    return NextResponse.json({
      total_modules: totalCount,
      own_modules: ownCount,
      linked_modules: linkedCount,
      global_modules: globalCount,
    });

  } catch (error) {
    console.error('Error fetching cohort stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
