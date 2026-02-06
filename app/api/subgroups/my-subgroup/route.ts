import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// GET - Student's subgroup with mentor + peers
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Find the student's subgroup membership
    const { data: membership } = await supabase
      .from('subgroup_members')
      .select('subgroup_id')
      .eq('user_id', user.id)
      .limit(1)
      .single();

    if (!membership) {
      return NextResponse.json({ data: null }); // Not assigned yet
    }

    // Fetch subgroup details
    const { data: subgroup } = await supabase
      .from('subgroups')
      .select('id, name, cohort_id')
      .eq('id', membership.subgroup_id)
      .single();

    if (!subgroup) {
      return NextResponse.json({ data: null });
    }

    // Fetch cohort name
    const { data: cohort } = await supabase
      .from('cohorts')
      .select('name')
      .eq('id', subgroup.cohort_id)
      .single();

    // Fetch members and mentors in parallel (RLS will filter to own subgroup)
    const [{ data: members }, { data: mentors }] = await Promise.all([
      supabase
        .from('subgroup_members')
        .select('user_id, user:profiles(id, full_name, email, phone, avatar_url, linkedin_url, portfolio_url)')
        .eq('subgroup_id', subgroup.id),
      supabase
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
