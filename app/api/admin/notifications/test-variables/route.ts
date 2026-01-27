import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// Helper to verify admin access
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

  if (profile?.role !== 'admin') {
    return { authorized: false, error: 'Forbidden', status: 403 };
  }

  return { authorized: true, userId: user.id };
}

// Helper to format date
function formatDate(dateString: string | null): string {
  if (!dateString) return '-';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return '-';
  }
}

// GET - Fetch test data for variables
export async function GET(request: NextRequest) {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const adminClient = await createAdminClient();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');
    const cohortId = searchParams.get('cohort_id');

    // If no params, return list of users and cohorts for selection
    if (!userId && !cohortId) {
      // Fetch sample users (limit 50)
      const { data: users } = await adminClient
        .from('profiles')
        .select('id, full_name, email')
        .order('full_name', { ascending: true })
        .limit(50);

      // Fetch all cohorts
      const { data: cohorts } = await adminClient
        .from('cohorts')
        .select('id, name')
        .order('name', { ascending: true });

      return NextResponse.json({
        users: users || [],
        cohorts: cohorts || [],
      });
    }

    // Fetch specific data for testing
    let result: Record<string, string> = {
      name: '-',
      email: '-',
      phone: '-',
      cohort_name: '-',
      cohort_tag: '-',
      start_date: '-',
      end_date: '-',
    };

    // Fetch user data
    if (userId && userId !== 'none') {
      const { data: user } = await adminClient
        .from('profiles')
        .select('full_name, email, phone, cohort_id')
        .eq('id', userId)
        .single();

      if (user) {
        result.name = user.full_name || '-';
        result.email = user.email || '-';
        result.phone = user.phone || '-';

        // If user has a cohort and no cohort was explicitly selected, use user's cohort
        if (user.cohort_id && (!cohortId || cohortId === 'none')) {
          const { data: userCohort } = await adminClient
            .from('cohorts')
            .select('name, tag, start_date, end_date')
            .eq('id', user.cohort_id)
            .single();

          if (userCohort) {
            result.cohort_name = userCohort.name || '-';
            result.cohort_tag = userCohort.tag || '-';
            result.start_date = formatDate(userCohort.start_date);
            result.end_date = formatDate(userCohort.end_date);
          }
        }
      }
    }

    // Fetch cohort data (overrides user's cohort if explicitly selected)
    if (cohortId && cohortId !== 'none') {
      const { data: cohort } = await adminClient
        .from('cohorts')
        .select('name, tag, start_date, end_date')
        .eq('id', cohortId)
        .single();

      if (cohort) {
        result.cohort_name = cohort.name || '-';
        result.cohort_tag = cohort.tag || '-';
        result.start_date = formatDate(cohort.start_date);
        result.end_date = formatDate(cohort.end_date);
      }
    }

    return NextResponse.json({ result });
  } catch (error: any) {
    console.error('Error testing variables:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to test variables' },
      { status: 500 }
    );
  }
}
