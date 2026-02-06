import { createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/api/verify-admin';

// POST - Assign mentors to subgroup
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

    // Verify the subgroup exists and get cohort_id
    const { data: subgroup } = await adminClient
      .from('subgroups')
      .select('cohort_id')
      .eq('id', subgroupId)
      .single();

    if (!subgroup) {
      return NextResponse.json({ error: 'Subgroup not found' }, { status: 404 });
    }

    // Verify all users have mentor role for this cohort
    const { data: roleAssignments } = await adminClient
      .from('user_role_assignments')
      .select('user_id')
      .in('user_id', user_ids)
      .eq('role', 'mentor')
      .eq('cohort_id', subgroup.cohort_id);

    const validMentorIds = new Set((roleAssignments || []).map(r => r.user_id));
    const invalidIds = user_ids.filter((uid: string) => !validMentorIds.has(uid));

    if (invalidIds.length > 0) {
      return NextResponse.json(
        { error: `${invalidIds.length} user(s) do not have mentor role for this cohort` },
        { status: 400 }
      );
    }

    const rows = user_ids.map((uid: string) => ({
      subgroup_id: subgroupId,
      user_id: uid,
    }));

    const { data, error } = await adminClient
      .from('subgroup_mentors')
      .upsert(rows, { onConflict: 'subgroup_id,user_id', ignoreDuplicates: true })
      .select();

    if (error) throw error;

    return NextResponse.json({ added: data?.length || 0 }, { status: 201 });
  } catch (error) {
    console.error('Error assigning mentors:', error);
    return NextResponse.json({ error: 'Failed to assign mentors' }, { status: 500 });
  }
}

// DELETE - Remove mentors from subgroup
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
      .from('subgroup_mentors')
      .delete()
      .eq('subgroup_id', subgroupId)
      .in('user_id', user_ids);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing mentors:', error);
    return NextResponse.json({ error: 'Failed to remove mentors' }, { status: 500 });
  }
}
