import { createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/api/verify-admin';

// POST - Assign students to subgroup
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { id: subgroupId } = await params;
    const body = await request.json();
    const { user_ids } = body;

    if (!Array.isArray(user_ids) || user_ids.length === 0) {
      return NextResponse.json({ error: 'user_ids array is required' }, { status: 400 });
    }

    const adminClient = await createAdminClient();

    // Get the cohort_id of this subgroup
    const { data: subgroup } = await adminClient
      .from('subgroups')
      .select('cohort_id')
      .eq('id', subgroupId)
      .single();

    if (!subgroup) {
      return NextResponse.json({ error: 'Subgroup not found' }, { status: 404 });
    }

    // Check if any students are already in a different subgroup in this cohort
    const { data: allCohortSubgroups } = await adminClient
      .from('subgroups')
      .select('id, name')
      .eq('cohort_id', subgroup.cohort_id);

    const cohortSubgroupIds = (allCohortSubgroups || []).map(s => s.id);

    const { data: existingMembers } = await adminClient
      .from('subgroup_members')
      .select('user_id, subgroup_id')
      .in('user_id', user_ids)
      .in('subgroup_id', cohortSubgroupIds);

    // Find conflicts (students already in a DIFFERENT subgroup within same cohort)
    const conflicts = (existingMembers || []).filter(m => m.subgroup_id !== subgroupId);

    if (conflicts.length > 0) {
      const conflictSubgroupNames = conflicts.map(c => {
        const sg = allCohortSubgroups?.find(s => s.id === c.subgroup_id);
        return sg?.name || 'Unknown';
      });
      const uniqueNames = [...new Set(conflictSubgroupNames)].join(', ');
      return NextResponse.json(
        { error: `Some students are already in other subgroups: ${uniqueNames}` },
        { status: 409 }
      );
    }

    // Insert members (upsert to handle re-adding gracefully)
    const rows = user_ids.map((uid: string) => ({
      subgroup_id: subgroupId,
      user_id: uid,
    }));

    const { data, error } = await adminClient
      .from('subgroup_members')
      .upsert(rows, { onConflict: 'subgroup_id,user_id', ignoreDuplicates: true })
      .select();

    if (error) throw error;

    return NextResponse.json({ added: data?.length || 0 }, { status: 201 });
  } catch (error) {
    console.error('Error assigning members:', error);
    return NextResponse.json({ error: 'Failed to assign members' }, { status: 500 });
  }
}

// DELETE - Remove students from subgroup
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { id: subgroupId } = await params;
    const body = await request.json();
    const { user_ids } = body;

    if (!Array.isArray(user_ids) || user_ids.length === 0) {
      return NextResponse.json({ error: 'user_ids array is required' }, { status: 400 });
    }

    const adminClient = await createAdminClient();

    const { error } = await adminClient
      .from('subgroup_members')
      .delete()
      .eq('subgroup_id', subgroupId)
      .in('user_id', user_ids);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing members:', error);
    return NextResponse.json({ error: 'Failed to remove members' }, { status: 500 });
  }
}
