import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { googleCalendar } from '@/lib/integrations/google-calendar';

async function verifyAdmin() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { authorized: false, error: 'Unauthorized', status: 401 };
  }

  // Check admin role from database only - no domain-based bypass
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

// Helper to get valid calendar access token
async function getValidCalendarToken(userId: string): Promise<string | null> {
  const adminClient = await createAdminClient();

  const { data: tokenData } = await adminClient
    .from('calendar_tokens')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (!tokenData) return null;

  // Check if token is expired (with 5 min buffer)
  const expiresAt = new Date(tokenData.expires_at);
  if (expiresAt.getTime() < Date.now() + 300000) {
    try {
      const refreshed = await googleCalendar.refreshAccessToken(tokenData.refresh_token);
      await adminClient
        .from('calendar_tokens')
        .update({
          access_token: refreshed.accessToken,
          expires_at: new Date(Date.now() + refreshed.expiresIn * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);
      return refreshed.accessToken;
    } catch {
      return null;
    }
  }

  return tokenData.access_token;
}

// Helper to send calendar invites for future sessions to a new cohort member
async function sendCalendarInvitesToNewMember(
  userEmail: string,
  cohortId: string,
  adminUserId: string
): Promise<{ sent: number; failed: number }> {
  const adminClient = await createAdminClient();

  // Get future sessions for this cohort that have calendar events
  const now = new Date().toISOString();
  const { data: futureSessions } = await adminClient
    .from('sessions')
    .select('id, calendar_event_id')
    .eq('cohort_id', cohortId)
    .gt('scheduled_at', now)
    .not('calendar_event_id', 'is', null);

  if (!futureSessions || futureSessions.length === 0) {
    return { sent: 0, failed: 0 };
  }

  // Get calendar access token
  const accessToken = await getValidCalendarToken(adminUserId);
  if (!accessToken) {
    console.log('No valid calendar token available for sending invites');
    return { sent: 0, failed: futureSessions.length };
  }

  let sent = 0;
  let failed = 0;

  for (const session of futureSessions) {
    try {
      await googleCalendar.addAttendeeToEvent(
        accessToken,
        session.calendar_event_id!,
        userEmail
      );
      sent++;
    } catch (error) {
      console.error(`Failed to add attendee to session ${session.id}:`, error);
      failed++;
    }
  }

  return { sent, failed };
}

// Helper to remove calendar invites when leaving a cohort
async function removeCalendarInvitesFromOldCohort(
  userEmail: string,
  oldCohortId: string,
  adminUserId: string
): Promise<{ removed: number; failed: number }> {
  const adminClient = await createAdminClient();

  // Get future sessions for the OLD cohort that have calendar events
  const now = new Date().toISOString();
  const { data: futureSessions } = await adminClient
    .from('sessions')
    .select('id, calendar_event_id')
    .eq('cohort_id', oldCohortId)
    .gt('scheduled_at', now)
    .not('calendar_event_id', 'is', null);

  if (!futureSessions || futureSessions.length === 0) {
    return { removed: 0, failed: 0 };
  }

  const accessToken = await getValidCalendarToken(adminUserId);
  if (!accessToken) {
    console.log('No valid calendar token available for removing invites');
    return { removed: 0, failed: futureSessions.length };
  }

  let removed = 0;
  let failed = 0;

  for (const session of futureSessions) {
    try {
      await googleCalendar.removeAttendeeFromEvent(
        accessToken,
        session.calendar_event_id!,
        userEmail
      );
      removed++;
    } catch (error) {
      console.error(`Failed to remove attendee from session ${session.id}:`, error);
      failed++;
    }
  }

  return { removed, failed };
}

// GET - Fetch users and cohorts
export async function GET() {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const adminClient = await createAdminClient();

    const [{ data: users }, { data: cohorts }] = await Promise.all([
      adminClient
        .from('profiles')
        .select('*, cohort:cohorts!fk_profile_cohort(*)')
        .order('created_at', { ascending: false }),
      adminClient
        .from('cohorts')
        .select('*')
        .order('name', { ascending: true }),
    ]);

    return NextResponse.json({ users: users || [], cohorts: cohorts || [] });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}

// PUT - Update user (role or cohort)
export async function PUT(request: NextRequest) {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const { id, role, cohort_id } = body;

    if (!id) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const adminClient = await createAdminClient();

    // Get current user data BEFORE update (to know old cohort)
    const { data: currentUser } = await adminClient
      .from('profiles')
      .select('email, cohort_id')
      .eq('id', id)
      .single();

    const oldCohortId = currentUser?.cohort_id;

    const updateData: { role?: string; cohort_id?: string | null } = {};
    if (role !== undefined) updateData.role = role;
    if (cohort_id !== undefined) updateData.cohort_id = cohort_id || null;

    const { data, error } = await adminClient
      .from('profiles')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Handle cohort change - remove from old, add to new
    if (cohort_id !== undefined && data?.email) {
      const newCohortId = cohort_id || null;

      // Remove from old cohort's sessions (if had one and it changed)
      if (oldCohortId && oldCohortId !== newCohortId) {
        try {
          const removeResult = await removeCalendarInvitesFromOldCohort(data.email, oldCohortId, auth.userId!);
          if (removeResult.removed > 0) {
            console.log(`Removed ${removeResult.removed} calendar invites from ${data.email} for old cohort ${oldCohortId}`);
          }
        } catch (calendarError) {
          console.error('Failed to remove old calendar invites:', calendarError);
        }
      }

      // Add to new cohort's sessions (if has new one and it changed)
      if (newCohortId && newCohortId !== oldCohortId) {
        try {
          const addResult = await sendCalendarInvitesToNewMember(data.email, newCohortId, auth.userId!);
          if (addResult.sent > 0) {
            console.log(`Sent ${addResult.sent} calendar invites to ${data.email} for new cohort ${newCohortId}`);
          }
        } catch (calendarError) {
          console.error('Failed to send new calendar invites:', calendarError);
        }
      }
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}
