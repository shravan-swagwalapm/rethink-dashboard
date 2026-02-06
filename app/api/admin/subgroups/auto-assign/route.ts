import { createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/api/verify-admin';

// POST - Distribute unassigned students evenly across subgroups
export async function POST(request: NextRequest) {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const { cohort_id } = body;

    if (!cohort_id) {
      return NextResponse.json({ error: 'cohort_id is required' }, { status: 400 });
    }

    const adminClient = await createAdminClient();

    // Get subgroups for this cohort
    const { data: subgroups } = await adminClient
      .from('subgroups')
      .select('id')
      .eq('cohort_id', cohort_id)
      .order('name', { ascending: true });

    if (!subgroups || subgroups.length === 0) {
      return NextResponse.json({ error: 'No subgroups found. Create subgroups first.' }, { status: 400 });
    }

    // Get all students in this cohort via role assignments
    const { data: students } = await adminClient
      .from('user_role_assignments')
      .select('user_id')
      .eq('cohort_id', cohort_id)
      .eq('role', 'student');

    if (!students || students.length === 0) {
      return NextResponse.json({ error: 'No students found in this cohort' }, { status: 400 });
    }

    // Get already-assigned students in this cohort's subgroups
    const subgroupIds = subgroups.map(s => s.id);
    const { data: existingMembers } = await adminClient
      .from('subgroup_members')
      .select('user_id')
      .in('subgroup_id', subgroupIds);

    const assignedSet = new Set((existingMembers || []).map(m => m.user_id));
    const unassigned = students.filter(s => !assignedSet.has(s.user_id));

    if (unassigned.length === 0) {
      return NextResponse.json({ error: 'All students are already assigned to subgroups' }, { status: 400 });
    }

    // Shuffle for random distribution
    const shuffled = [...unassigned].sort(() => Math.random() - 0.5);

    // Round-robin distribute across subgroups
    const rows = shuffled.map((s, i) => ({
      subgroup_id: subgroups[i % subgroups.length].id,
      user_id: s.user_id,
    }));

    const { error } = await adminClient
      .from('subgroup_members')
      .insert(rows);

    if (error) throw error;

    return NextResponse.json({ assigned: rows.length });
  } catch (error) {
    console.error('Error auto-assigning students:', error);
    return NextResponse.json({ error: 'Failed to auto-assign students' }, { status: 500 });
  }
}
