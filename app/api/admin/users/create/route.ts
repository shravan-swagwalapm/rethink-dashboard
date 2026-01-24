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

  const accessToken = await getValidCalendarToken(adminUserId);
  if (!accessToken) {
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

// POST - Create a new user
export async function POST(request: NextRequest) {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const { email, full_name, cohort_id } = body;

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    if (!cohort_id) {
      return NextResponse.json({ error: 'Cohort is required' }, { status: 400 });
    }

    const adminClient = await createAdminClient();

    // Check if user already exists
    const { data: existingProfile } = await adminClient
      .from('profiles')
      .select('id, email')
      .eq('email', email.toLowerCase())
      .single();

    if (existingProfile) {
      return NextResponse.json({ error: 'User with this email already exists' }, { status: 400 });
    }

    // Create user in Supabase Auth using admin API
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email: email.toLowerCase(),
      email_confirm: true, // Auto-confirm email so they can login immediately
      user_metadata: {
        full_name: full_name || '',
      },
    });

    if (authError) {
      console.error('Error creating auth user:', authError);
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    if (!authData.user) {
      return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
    }

    // Update the profile with full_name and cohort_id
    // The profile should be auto-created by the database trigger
    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .update({
        full_name: full_name || null,
        cohort_id: cohort_id,
        role: 'student',
      })
      .eq('id', authData.user.id)
      .select('*, cohort:cohorts!fk_profile_cohort(*)')
      .single();

    if (profileError) {
      console.error('Error updating profile:', profileError);
      // User was created but profile update failed - still return success
      return NextResponse.json({
        user: authData.user,
        profile: null,
        warning: 'User created but profile update failed',
      });
    }

    // Send calendar invites for future sessions in this cohort
    if (cohort_id && profile?.email) {
      try {
        const result = await sendCalendarInvitesToNewMember(profile.email, cohort_id, auth.userId!);
        if (result.sent > 0) {
          console.log(`Sent ${result.sent} calendar invites to new user ${profile.email}`);
        }
      } catch (calendarError) {
        console.error('Failed to send calendar invites:', calendarError);
        // Don't fail the request - user creation was successful
      }
    }

    return NextResponse.json({
      user: authData.user,
      profile,
      message: 'User created successfully. They can now login via email OTP.',
    });
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}
