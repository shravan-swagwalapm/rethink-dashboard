import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { isSuperuserDomain } from '@/lib/auth/allowed-domains';

async function verifyAdmin() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { authorized: false, error: 'Unauthorized', status: 401 };
  }

  const userEmail = user.email;
  if (userEmail && isSuperuserDomain(userEmail)) {
    return { authorized: true, userId: user.id };
  }

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

// GET - Fetch sessions and cohorts
export async function GET() {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const adminClient = await createAdminClient();

    const [{ data: sessions }, { data: cohorts }] = await Promise.all([
      adminClient
        .from('sessions')
        .select(`*, cohort:cohorts(*)`)
        .order('scheduled_at', { ascending: false })
        .limit(100),
      adminClient
        .from('cohorts')
        .select('*')
        .in('status', ['active', 'completed'])
        .order('name', { ascending: true }),
    ]);

    // Fetch RSVP counts for each session
    const sessionsWithRsvp = await Promise.all(
      (sessions || []).map(async (session) => {
        const [{ count: yesCount }, { count: noCount }] = await Promise.all([
          adminClient
            .from('rsvps')
            .select('*', { count: 'exact', head: true })
            .eq('session_id', session.id)
            .eq('response', 'yes'),
          adminClient
            .from('rsvps')
            .select('*', { count: 'exact', head: true })
            .eq('session_id', session.id)
            .eq('response', 'no'),
        ]);

        return {
          ...session,
          rsvp_yes_count: yesCount || 0,
          rsvp_no_count: noCount || 0,
        };
      })
    );

    return NextResponse.json({ sessions: sessionsWithRsvp, cohorts: cohorts || [] });
  } catch (error) {
    console.error('Error fetching sessions:', error);
    return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 });
  }
}

// POST - Create a session
export async function POST(request: NextRequest) {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const { title, description, cohort_id, scheduled_at, duration_minutes, zoom_link } = body;

    if (!title?.trim()) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    if (!scheduled_at) {
      return NextResponse.json({ error: 'Scheduled time is required' }, { status: 400 });
    }

    const adminClient = await createAdminClient();

    const { data, error } = await adminClient
      .from('sessions')
      .insert({
        title: title.trim(),
        description: description || null,
        cohort_id: cohort_id || null,
        scheduled_at,
        duration_minutes: duration_minutes || 60,
        zoom_link: zoom_link || null,
        created_by: auth.userId,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error creating session:', error);
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
  }
}

// PUT - Update a session
export async function PUT(request: NextRequest) {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const { id, title, description, cohort_id, scheduled_at, duration_minutes, zoom_link } = body;

    if (!id) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    const adminClient = await createAdminClient();

    const { data, error } = await adminClient
      .from('sessions')
      .update({
        title: title?.trim(),
        description: description || null,
        cohort_id: cohort_id || null,
        scheduled_at,
        duration_minutes: duration_minutes || 60,
        zoom_link: zoom_link || null,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error updating session:', error);
    return NextResponse.json({ error: 'Failed to update session' }, { status: 500 });
  }
}

// DELETE - Delete a session
export async function DELETE(request: NextRequest) {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    const adminClient = await createAdminClient();

    const { error } = await adminClient
      .from('sessions')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting session:', error);
    return NextResponse.json({ error: 'Failed to delete session' }, { status: 500 });
  }
}
