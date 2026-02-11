import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Auth check via user-scoped client
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminClient = await createAdminClient();

    // Verify user is mentor or admin
    const { data: profile } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || !['mentor', 'admin', 'super_admin', 'company_user'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const view = searchParams.get('view') || 'mentor';
    const cohortId = searchParams.get('cohort_id');

    let members: any[] = [];

    if (view === 'mentor') {
      // Mentor view: fetch students from mentor's subgroups
      const { data: mentorAssignments } = await adminClient
        .from('subgroup_mentors')
        .select('subgroup_id')
        .eq('user_id', user.id);

      if (mentorAssignments && mentorAssignments.length > 0) {
        const subgroupIds = mentorAssignments.map(a => a.subgroup_id);

        const { data: subgroupMembers } = await adminClient
          .from('subgroup_members')
          .select('user_id')
          .in('subgroup_id', subgroupIds);

        if (subgroupMembers && subgroupMembers.length > 0) {
          const studentIds = [...new Set(subgroupMembers.map(m => m.user_id))];

          const { data, error } = await adminClient
            .from('profiles')
            .select('*')
            .in('id', studentIds)
            .order('full_name', { ascending: true });

          if (error) throw error;
          members = data || [];
        }
      }
    } else {
      // Admin view: fetch students by cohort or all students
      if (cohortId) {
        const { data, error } = await adminClient
          .from('profiles')
          .select('*')
          .eq('cohort_id', cohortId)
          .eq('role', 'student')
          .order('full_name', { ascending: true });

        if (error) throw error;
        members = data || [];
      } else {
        const { data, error } = await adminClient
          .from('profiles')
          .select('*')
          .eq('role', 'student')
          .order('full_name', { ascending: true });

        if (error) throw error;
        members = data || [];
      }
    }

    return NextResponse.json({ members });
  } catch (error) {
    console.error('Error fetching team members:', error);
    return NextResponse.json({ error: 'Failed to fetch team members' }, { status: 500 });
  }
}
