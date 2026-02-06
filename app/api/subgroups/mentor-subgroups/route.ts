import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Fetch subgroups where this user is a mentor (RLS handles access)
    const { data: mentorAssignments } = await supabase
      .from('subgroup_mentors')
      .select('subgroup_id')
      .eq('user_id', user.id);

    if (!mentorAssignments || mentorAssignments.length === 0) {
      return NextResponse.json({ data: [] });
    }

    const subgroupIds = mentorAssignments.map(a => a.subgroup_id);

    // Fetch subgroups with cohort info
    const { data: subgroups } = await supabase
      .from('subgroups')
      .select('id, name, cohort_id')
      .in('id', subgroupIds);

    // Batch fetch members
    const { data: members } = await supabase
      .from('subgroup_members')
      .select('subgroup_id, user_id, user:profiles(id, full_name, email, avatar_url)')
      .in('subgroup_id', subgroupIds);

    // Group members by subgroup
    const memberMap = new Map<string, any[]>();
    for (const m of members || []) {
      const list = memberMap.get(m.subgroup_id) || [];
      list.push(m);
      memberMap.set(m.subgroup_id, list);
    }

    const result = (subgroups || []).map(sg => ({
      ...sg,
      members: memberMap.get(sg.id) || [],
      member_count: (memberMap.get(sg.id) || []).length,
    }));

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error('Error fetching mentor subgroups:', error);
    return NextResponse.json({ error: 'Failed to fetch subgroups' }, { status: 500 });
  }
}
