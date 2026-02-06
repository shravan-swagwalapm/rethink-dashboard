import { createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/api/verify-admin';

// GET - List subgroups for a cohort (with members and mentors)
export async function GET(request: NextRequest) {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { searchParams } = new URL(request.url);
    const cohortId = searchParams.get('cohort_id');

    if (!cohortId) {
      return NextResponse.json({ error: 'cohort_id is required' }, { status: 400 });
    }

    const adminClient = await createAdminClient();

    const { data: subgroups, error } = await adminClient
      .from('subgroups')
      .select('id, name, cohort_id, created_at, updated_at')
      .eq('cohort_id', cohortId)
      .order('name', { ascending: true });

    if (error) throw error;

    if (!subgroups || subgroups.length === 0) {
      return NextResponse.json([]);
    }

    const subgroupIds = subgroups.map(s => s.id);

    // Batch fetch members and mentors (N+1 prevention)
    const [{ data: members }, { data: mentors }] = await Promise.all([
      adminClient
        .from('subgroup_members')
        .select('subgroup_id, user_id, user:profiles(id, full_name, email, avatar_url)')
        .in('subgroup_id', subgroupIds),
      adminClient
        .from('subgroup_mentors')
        .select('subgroup_id, user_id, user:profiles(id, full_name, email, avatar_url)')
        .in('subgroup_id', subgroupIds),
    ]);

    // Group by subgroup
    const membersBySubgroup = new Map<string, any[]>();
    for (const m of members || []) {
      const list = membersBySubgroup.get(m.subgroup_id) || [];
      list.push(m);
      membersBySubgroup.set(m.subgroup_id, list);
    }

    const mentorsBySubgroup = new Map<string, any[]>();
    for (const m of mentors || []) {
      const list = mentorsBySubgroup.get(m.subgroup_id) || [];
      list.push(m);
      mentorsBySubgroup.set(m.subgroup_id, list);
    }

    const result = subgroups.map(sg => ({
      ...sg,
      members: membersBySubgroup.get(sg.id) || [],
      mentors: mentorsBySubgroup.get(sg.id) || [],
      member_count: (membersBySubgroup.get(sg.id) || []).length,
      mentor_count: (mentorsBySubgroup.get(sg.id) || []).length,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching subgroups:', error);
    return NextResponse.json({ error: 'Failed to fetch subgroups' }, { status: 500 });
  }
}

// POST - Create a subgroup
export async function POST(request: NextRequest) {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const { name, cohort_id } = body;

    if (!name?.trim() || !cohort_id) {
      return NextResponse.json({ error: 'Name and cohort_id are required' }, { status: 400 });
    }

    const adminClient = await createAdminClient();

    const { data, error } = await adminClient
      .from('subgroups')
      .insert({ name: name.trim(), cohort_id })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'A subgroup with this name already exists in this cohort' }, { status: 409 });
      }
      throw error;
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error creating subgroup:', error);
    return NextResponse.json({ error: 'Failed to create subgroup' }, { status: 500 });
  }
}
