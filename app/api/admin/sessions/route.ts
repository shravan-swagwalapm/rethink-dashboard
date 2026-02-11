import { createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { zoomService } from '@/lib/integrations/zoom';
import { googleCalendar } from '@/lib/integrations/google-calendar';
import { verifyAdmin } from '@/lib/api/verify-admin';
import { getValidCalendarToken } from '@/lib/services/calendar-helpers';
import { toCalendarLocalTime } from '@/lib/utils/timezone';

// GET - Fetch sessions and cohorts
export async function GET() {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const adminClient = await createAdminClient();

    const [
      { data: sessions },
      { data: cohorts },
      { data: sessionCohorts },
      { data: sessionGuests },
      { data: masterUsers },
    ] = await Promise.all([
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
      adminClient
        .from('session_cohorts')
        .select('*, cohort:cohorts(*)'),
      adminClient
        .from('session_guests')
        .select('*, user:profiles(id, email, full_name)'),
      adminClient
        .from('profiles')
        .select('id, email, full_name, role')
        .eq('role', 'master'),
    ]);

    // Batch fetch all RSVPs for all sessions in ONE query instead of 2 per session
    const sessionIds = (sessions || []).map(s => s.id);
    const rsvpYesCounts = new Map<string, number>();
    const rsvpNoCounts = new Map<string, number>();

    if (sessionIds.length > 0) {
      const { data: allRsvps } = await adminClient
        .from('rsvps')
        .select('session_id, response')
        .in('session_id', sessionIds);

      for (const rsvp of allRsvps || []) {
        if (rsvp.response === 'yes') {
          rsvpYesCounts.set(rsvp.session_id, (rsvpYesCounts.get(rsvp.session_id) || 0) + 1);
        } else if (rsvp.response === 'no') {
          rsvpNoCounts.set(rsvp.session_id, (rsvpNoCounts.get(rsvp.session_id) || 0) + 1);
        }
      }
    }

    const sessionsWithDetails = (sessions || []).map((session) => ({
      ...session,
      rsvp_yes_count: rsvpYesCounts.get(session.id) || 0,
      rsvp_no_count: rsvpNoCounts.get(session.id) || 0,
      cohorts: (sessionCohorts || []).filter(sc => sc.session_id === session.id),
      guests: (sessionGuests || []).filter(sg => sg.session_id === session.id),
    }));

    return NextResponse.json({
      sessions: sessionsWithDetails,
      cohorts: cohorts || [],
      masterUsers: masterUsers || [],
    });
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
      cohort_id,      // Legacy single cohort
      cohort_ids,     // New: array of cohort IDs
      guest_ids,      // New: array of guest (master) user IDs
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

    // Support both legacy (cohort_id) and new (cohort_ids) modes
    const cohortIdList: string[] = cohort_ids && Array.isArray(cohort_ids) && cohort_ids.length > 0
      ? cohort_ids
      : (cohort_id ? [cohort_id] : []);

    if (cohortIdList.length === 0) {
      return NextResponse.json({ error: 'At least one cohort is required' }, { status: 400 });
    }

    const adminClient = await createAdminClient();
    const duration = duration_minutes || 60;

    // Prepare session data (use first cohort as legacy cohort_id)
    const sessionData: Record<string, unknown> = {
      title: title.trim(),
      description: description || null,
      cohort_id: cohortIdList[0],  // Legacy: first cohort
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
      }
    }

    // Insert session
    const { data: session, error } = await adminClient
      .from('sessions')
      .insert(sessionData)
      .select()
      .single();

    if (error) throw error;

    // Insert session_cohorts for all selected cohorts
    if (cohortIdList.length > 0) {
      const sessionCohortInserts = cohortIdList.map(cid => ({
        session_id: session.id,
        cohort_id: cid,
      }));

      await adminClient
        .from('session_cohorts')
        .insert(sessionCohortInserts);
    }

    // Insert session_guests if any guests selected
    const guestIdList: string[] = guest_ids && Array.isArray(guest_ids) ? guest_ids : [];
    if (guestIdList.length > 0) {
      const sessionGuestInserts = guestIdList.map(uid => ({
        session_id: session.id,
        user_id: uid,
      }));

      await adminClient
        .from('session_guests')
        .insert(sessionGuestInserts);
    }

    // Create calendar event if requested
    if (send_calendar_invites && session) {
      const accessToken = await getValidCalendarToken(auth.userId!);
      if (accessToken) {
        try {
          // Get students from ALL selected cohorts (using role_assignments table)
          const { data: studentAssignments } = await adminClient
            .from('user_role_assignments')
            .select('user_id')
            .in('cohort_id', cohortIdList)
            .in('role', ['student', 'mentor']);

          const studentUserIds = [...new Set((studentAssignments || []).map(sa => sa.user_id))];

          // Get emails for those users
          let studentEmails: string[] = [];
          if (studentUserIds.length > 0) {
            const { data: studentProfiles } = await adminClient
              .from('profiles')
              .select('email')
              .in('id', studentUserIds);
            studentEmails = (studentProfiles || []).map(p => p.email);
          }

          // Also get students from legacy cohort_id field (for backwards compatibility)
          const { data: legacyStudents } = await adminClient
            .from('profiles')
            .select('email')
            .in('cohort_id', cohortIdList);
          const legacyStudentEmails = (legacyStudents || []).map(m => m.email);

          // Get ALL admin emails (admin + company_user roles)
          const { data: admins } = await adminClient
            .from('profiles')
            .select('email')
            .in('role', ['admin', 'company_user']);
          const adminEmails = (admins || []).map(a => a.email);

          // Get guest emails
          let guestEmails: string[] = [];
          if (guestIdList.length > 0) {
            const { data: guestProfiles } = await adminClient
              .from('profiles')
              .select('email')
              .in('id', guestIdList);
            guestEmails = (guestProfiles || []).map(g => g.email);
          }

          // Combine and deduplicate all emails
          const attendeeEmails = [...new Set([
            ...studentEmails,
            ...legacyStudentEmails,
            ...adminEmails,
            ...guestEmails,
          ])];

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
                start: { dateTime: toCalendarLocalTime(scheduled_at), timeZone: 'Asia/Kolkata' },
                end: { dateTime: toCalendarLocalTime(endTime.toISOString()), timeZone: 'Asia/Kolkata' },
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
        }
      }
    }

    // Fetch the session cohorts and guests for the response
    const [{ data: sessionCohorts }, { data: sessionGuests }] = await Promise.all([
      adminClient
        .from('session_cohorts')
        .select('*, cohort:cohorts(*)')
        .eq('session_id', session.id),
      adminClient
        .from('session_guests')
        .select('*, user:profiles(id, email, full_name)')
        .eq('session_id', session.id),
    ]);

    return NextResponse.json({
      ...session,
      cohorts: sessionCohorts || [],
      guests: sessionGuests || [],
    }, { status: 201 });
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
            start: { dateTime: toCalendarLocalTime(scheduled_at), timeZone: 'Asia/Kolkata' },
            end: { dateTime: toCalendarLocalTime(endTime.toISOString()), timeZone: 'Asia/Kolkata' },
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
