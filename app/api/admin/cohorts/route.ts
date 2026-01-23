import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { isSuperuserDomain } from '@/lib/auth/allowed-domains';

// Helper to verify admin access
async function verifyAdmin() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { authorized: false, error: 'Unauthorized', status: 401 };
  }

  // Check if user is from superuser domain (auto-admin)
  const userEmail = user.email;
  if (userEmail && isSuperuserDomain(userEmail)) {
    return { authorized: true, userId: user.id };
  }

  // Use admin client to check role (bypasses RLS)
  const adminClient = await createAdminClient();
  const { data: profile } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const isAdmin = profile?.role === 'admin' || profile?.role === 'company_user';

  if (!isAdmin) {
    return { authorized: false, error: 'Forbidden', status: 403 };
  }

  return { authorized: true, userId: user.id };
}

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

    // Fetch stats for each cohort
    const cohortsWithStats = await Promise.all(
      (cohorts || []).map(async (cohort) => {
        const [{ count: studentCount }, { count: sessionCount }] = await Promise.all([
          adminClient
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .eq('cohort_id', cohort.id),
          adminClient
            .from('sessions')
            .select('*', { count: 'exact', head: true })
            .eq('cohort_id', cohort.id),
        ]);

        return {
          ...cohort,
          student_count: studentCount || 0,
          session_count: sessionCount || 0,
        };
      })
    );

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

    const { data, error } = await adminClient
      .from('cohorts')
      .update({
        name: name?.trim(),
        tag: tag?.trim().toUpperCase(),
        start_date: start_date || null,
        end_date: end_date || null,
        status,
      })
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
