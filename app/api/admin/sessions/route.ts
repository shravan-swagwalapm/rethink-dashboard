import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { zoomService } from '@/lib/integrations/zoom';
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
        .eq('status', 'active')
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
    const {
      title,
      description,
      cohort_id,
      scheduled_at,
      duration_minutes,
      zoom_link,
      auto_create_zoom,
      send_calendar_invites
    } = body;

    if (!title?.trim()) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    if (!scheduled_at) {
      return NextResponse.json({ error: 'Scheduled time is required' }, { status: 400 });
    }

    if (!cohort_id) {
      return NextResponse.json({ error: 'Cohort is required' }, { status: 400 });
    }

    const adminClient = await createAdminClient();
    const duration = duration_minutes || 60;

    // Prepare session data
    const sessionData: Record<string, unknown> = {
      title: title.trim(),
      description: description || null,
      cohort_id: cohort_id || null,
      scheduled_at,
      duration_minutes: duration,
      zoom_link: zoom_link || null,
      created_by: auth.userId,
      auto_create_zoom: !!auto_create_zoom,
      send_calendar_invites: !!send_calendar_invites,
    };

    // Create Zoom meeting if requested
    if (auto_create_zoom && zoomService.isConfigured()) {
      try {
        const meeting = await zoomService.createMeeting({
          topic: title.trim(),
          startTime: scheduled_at,
          duration,
          agenda: description || undefined,
        });
        sessionData.zoom_meeting_id = String(meeting.id);
        sessionData.zoom_link = meeting.join_url;
        sessionData.zoom_start_url = meeting.start_url;
      } catch (zoomError) {
        console.error('Failed to create Zoom meeting:', zoomError);
        // Continue without Zoom - don't fail the session creation
      }
    }

    // Insert session
    const { data: session, error } = await adminClient
      .from('sessions')
      .insert(sessionData)
      .select()
      .single();

    if (error) throw error;

    // Create calendar event if requested
    if (send_calendar_invites && cohort_id && session) {
      const accessToken = await getValidCalendarToken(auth.userId!);
      if (accessToken) {
        try {
          // Get cohort members' emails (students)
          const { data: members } = await adminClient
            .from('profiles')
            .select('email')
            .eq('cohort_id', cohort_id);

          // Get ALL admin emails (admin + company_user roles)
          const { data: admins } = await adminClient
            .from('profiles')
            .select('email')
            .in('role', ['admin', 'company_user']);

          // Combine and deduplicate emails (students + all admins)
          const studentEmails = members?.map(m => m.email) || [];
          const adminEmails = admins?.map(a => a.email) || [];
          const attendeeEmails = [...new Set([...studentEmails, ...adminEmails])];

          if (attendeeEmails.length > 0) {
            const startTime = new Date(scheduled_at);
            const endTime = new Date(startTime.getTime() + duration * 60000);

            let eventDescription = description || '';
            if (sessionData.zoom_link) {
              eventDescription += `\n\nZoom Link: ${sessionData.zoom_link}`;
            }

            const calendarEvent = await googleCalendar.createEventWithAttendees(
              accessToken,
              {
                summary: title.trim(),
                description: eventDescription,
                start: { dateTime: startTime.toISOString(), timeZone: 'Asia/Kolkata' },
                end: { dateTime: endTime.toISOString(), timeZone: 'Asia/Kolkata' },
              },
              attendeeEmails
            );

            // Update session with calendar event ID
            await adminClient
              .from('sessions')
              .update({ calendar_event_id: calendarEvent.id })
              .eq('id', session.id);

            session.calendar_event_id = calendarEvent.id;
          }
        } catch (calendarError) {
          console.error('Failed to create calendar event:', calendarError);
          // Continue without calendar - don't fail the session creation
        }
      }
    }

    return NextResponse.json(session, { status: 201 });
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

    // Get existing session to check for Zoom/Calendar updates
    const { data: existingSession } = await adminClient
      .from('sessions')
      .select('*')
      .eq('id', id)
      .single();

    const updateData: Record<string, unknown> = {
      title: title?.trim(),
      description: description || null,
      cohort_id: cohort_id || null,
      scheduled_at,
      duration_minutes: duration_minutes || 60,
      zoom_link: zoom_link || null,
    };

    // Update Zoom meeting if it exists and time/title changed
    if (existingSession?.zoom_meeting_id && zoomService.isConfigured()) {
      const needsUpdate =
        existingSession.scheduled_at !== scheduled_at ||
        existingSession.title !== title?.trim() ||
        existingSession.duration_minutes !== (duration_minutes || 60);

      if (needsUpdate) {
        try {
          await zoomService.updateMeeting(existingSession.zoom_meeting_id, {
            topic: title?.trim(),
            startTime: scheduled_at,
            duration: duration_minutes || 60,
            agenda: description || undefined,
          });
        } catch (zoomError) {
          console.error('Failed to update Zoom meeting:', zoomError);
        }
      }
    }

    // Update session in database
    const { data, error } = await adminClient
      .from('sessions')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Update calendar event if it exists
    if (existingSession?.calendar_event_id) {
      const accessToken = await getValidCalendarToken(auth.userId!);
      if (accessToken) {
        try {
          const startTime = new Date(scheduled_at);
          const endTime = new Date(startTime.getTime() + (duration_minutes || 60) * 60000);

          let eventDescription = description || '';
          if (data.zoom_link) {
            eventDescription += `\n\nZoom Link: ${data.zoom_link}`;
          }

          await googleCalendar.updateEvent(accessToken, existingSession.calendar_event_id, {
            summary: title?.trim(),
            description: eventDescription,
            start: { dateTime: startTime.toISOString(), timeZone: 'Asia/Kolkata' },
            end: { dateTime: endTime.toISOString(), timeZone: 'Asia/Kolkata' },
          });
        } catch (calendarError) {
          console.error('Failed to update calendar event:', calendarError);
        }
      }
    }

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

    // Get session to clean up Zoom/Calendar
    const { data: session } = await adminClient
      .from('sessions')
      .select('zoom_meeting_id, calendar_event_id')
      .eq('id', id)
      .single();

    // Delete Zoom meeting if exists
    if (session?.zoom_meeting_id && zoomService.isConfigured()) {
      try {
        await zoomService.deleteMeeting(session.zoom_meeting_id);
      } catch (zoomError) {
        console.error('Failed to delete Zoom meeting:', zoomError);
        // Continue with session deletion
      }
    }

    // Delete calendar event if exists
    if (session?.calendar_event_id) {
      const accessToken = await getValidCalendarToken(auth.userId!);
      if (accessToken) {
        try {
          await googleCalendar.deleteEvent(accessToken, session.calendar_event_id);
        } catch (calendarError) {
          console.error('Failed to delete calendar event:', calendarError);
          // Continue with session deletion
        }
      }
    }

    // Delete session from database
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
