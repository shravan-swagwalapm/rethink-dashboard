import { createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/api/verify-admin';

// GET - Fetch all cohorts with stats
export async function GET() {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const adminClient = await createAdminClient();

    const { data: cohorts, error } = await adminClient
      .from('cohorts')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Batch fetch all profiles and sessions for all cohorts in TWO queries instead of 2 per cohort
    const cohortIds = (cohorts || []).map(c => c.id);
    const studentCounts = new Map<string, number>();
    const sessionCounts = new Map<string, number>();

    if (cohortIds.length > 0) {
      const [{ data: allRoleAssignments }, { data: allSessions }] = await Promise.all([
        adminClient
          .from('user_role_assignments')
          .select('cohort_id')
          .eq('role', 'student')
          .in('cohort_id', cohortIds),
        adminClient
          .from('sessions')
          .select('cohort_id')
          .in('cohort_id', cohortIds),
      ]);

      for (const assignment of allRoleAssignments || []) {
        if (assignment.cohort_id) {
          studentCounts.set(assignment.cohort_id, (studentCounts.get(assignment.cohort_id) || 0) + 1);
        }
      }

      for (const session of allSessions || []) {
        if (session.cohort_id) {
          sessionCounts.set(session.cohort_id, (sessionCounts.get(session.cohort_id) || 0) + 1);
        }
      }
    }

    const cohortsWithStats = (cohorts || []).map((cohort) => ({
      ...cohort,
      student_count: studentCounts.get(cohort.id) || 0,
      session_count: sessionCounts.get(cohort.id) || 0,
    }));

    return NextResponse.json(cohortsWithStats);
  } catch (error) {
    console.error('Error fetching cohorts:', error);
    return NextResponse.json({ error: 'Failed to fetch cohorts' }, { status: 500 });
  }
}

// POST - Create a new cohort
export async function POST(request: NextRequest) {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const { name, tag, start_date, end_date, status } = body;

    if (!name?.trim() || !tag?.trim()) {
      return NextResponse.json({ error: 'Name and tag are required' }, { status: 400 });
    }

    const adminClient = await createAdminClient();

    const { data, error } = await adminClient
      .from('cohorts')
      .insert({
        name: name.trim(),
        tag: tag.trim().toUpperCase(),
        start_date: start_date || null,
        end_date: end_date || null,
        status: status || 'active',
        created_by: auth.userId,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Tag already exists' }, { status: 409 });
      }
      throw error;
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error creating cohort:', error);
    return NextResponse.json({ error: 'Failed to create cohort' }, { status: 500 });
  }
}

// PUT - Update a cohort
export async function PUT(request: NextRequest) {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const { id, name, tag, start_date, end_date, status } = body;

    if (!id) {
      return NextResponse.json({ error: 'Cohort ID is required' }, { status: 400 });
    }

    const adminClient = await createAdminClient();

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name?.trim();
    if (tag !== undefined) updateData.tag = tag?.trim().toUpperCase();
    if (start_date !== undefined) updateData.start_date = start_date || null;
    if (end_date !== undefined) updateData.end_date = end_date || null;
    if (status !== undefined) updateData.status = status;

    const { data, error } = await adminClient
      .from('cohorts')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Tag already exists' }, { status: 409 });
      }
      throw error;
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error updating cohort:', error);
    return NextResponse.json({ error: 'Failed to update cohort' }, { status: 500 });
  }
}

// DELETE - Delete a cohort
export async function DELETE(request: NextRequest) {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Cohort ID is required' }, { status: 400 });
    }

    const adminClient = await createAdminClient();

    const { error } = await adminClient
      .from('cohorts')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting cohort:', error);
    return NextResponse.json({ error: 'Failed to delete cohort' }, { status: 500 });
  }
}
