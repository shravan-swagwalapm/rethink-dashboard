import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET - Student's subgroup with mentor + peers
export async function GET(request: NextRequest) {
  try {
    // Auth check via user-scoped client
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use admin client for data queries (bypasses RLS)
    const adminClient = await createAdminClient();

    // Optional cohort_id filter for multi-cohort students
    const { searchParams } = new URL(request.url);
    const cohortId = searchParams.get('cohort_id');

    // Find the student's subgroup membership (filtered by cohort if provided)
    // Use !inner join so the cohort filter excludes parent rows (not just nullifies the join)
    let membershipQuery = adminClient
      .from('subgroup_members')
      .select(cohortId
        ? 'subgroup_id, subgroup:subgroups!inner(cohort_id)'
        : 'subgroup_id, subgroup:subgroups(cohort_id)')
      .eq('user_id', user.id);

    if (cohortId) {
      membershipQuery = membershipQuery.eq('subgroup.cohort_id', cohortId);
    }

    const { data: memberships } = await membershipQuery.limit(1);
    const membership = memberships?.[0];

    if (!membership) {
      return NextResponse.json({ data: null }); // Not assigned yet
    }

    // Fetch subgroup details with cohort name
    const { data: subgroup } = await adminClient
      .from('subgroups')
      .select('id, name, cohort_id')
      .eq('id', membership.subgroup_id)
      .single();

    if (!subgroup) {
      return NextResponse.json({ data: null });
    }

    const { data: cohort } = await adminClient
      .from('cohorts')
      .select('name')
      .eq('id', subgroup.cohort_id)
      .single();

    // Fetch members and mentors in parallel
    const [{ data: members }, { data: mentors }] = await Promise.all([
      adminClient
        .from('subgroup_members')
        .select('user_id, user:profiles(id, full_name, email, phone, avatar_url, linkedin_url, portfolio_url)')
        .eq('subgroup_id', subgroup.id),
      adminClient
        .from('subgroup_mentors')
        .select('user_id, user:profiles(id, full_name, email, phone, avatar_url, linkedin_url, portfolio_url)')
        .eq('subgroup_id', subgroup.id),
    ]);

    return NextResponse.json({
      data: {
        subgroup: { ...subgroup, cohort_name: cohort?.name },
        members: (members || []).filter(m => m.user_id !== user.id), // Exclude self
        mentors: mentors || [],
        current_user_id: user.id,
      },
    });
  } catch (error) {
    console.error('Error fetching my subgroup:', error);
    return NextResponse.json({ error: 'Failed to fetch subgroup' }, { status: 500 });
  }
}
