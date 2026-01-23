/**
 * Admin Calendar API
 * Manages Google Calendar connection and event sync
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { googleCalendar, CalendarEvent } from '@/lib/integrations/google-calendar';

async function verifyAdmin() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { authorized: false, error: 'Unauthorized', status: 401 };
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

async function getValidAccessToken(userId: string): Promise<string | null> {
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
    // Refresh the token
    try {
      const refreshed = await googleCalendar.refreshAccessToken(tokenData.refresh_token);

      // Update stored token
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
      // Token refresh failed, user needs to re-auth
      return null;
    }
  }

  return tokenData.access_token;
}

// GET - Check calendar connection status
export async function GET() {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const adminClient = await createAdminClient();

  const { data: tokenData } = await adminClient
    .from('calendar_tokens')
    .select('calendar_email, updated_at')
    .eq('user_id', auth.userId)
    .single();

  return NextResponse.json({
    connected: !!tokenData,
    email: tokenData?.calendar_email || null,
    connectedAt: tokenData?.updated_at || null,
  });
}

// POST - Create calendar event for a session
export async function POST(request: NextRequest) {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const { sessionId } = body;

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    // Get access token
    const accessToken = await getValidAccessToken(auth.userId!);
    if (!accessToken) {
      return NextResponse.json(
        { error: 'Calendar not connected. Please reconnect Google Calendar.' },
        { status: 401 }
      );
    }

    const adminClient = await createAdminClient();

    // Get session details
    const { data: session } = await adminClient
      .from('sessions')
      .select('*, cohort:cohorts(*)')
      .eq('id', sessionId)
      .single();

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Get cohort members' emails
    let attendeeEmails: string[] = [];
    if (session.cohort_id) {
      const { data: members } = await adminClient
        .from('profiles')
        .select('email')
        .eq('cohort_id', session.cohort_id);

      attendeeEmails = members?.map(m => m.email) || [];
    }

    // Calculate end time
    const startTime = new Date(session.scheduled_at);
    const endTime = new Date(startTime.getTime() + session.duration_minutes * 60000);

    // Build event description
    let description = session.description || '';
    if (session.zoom_link) {
      description += `\n\nZoom Link: ${session.zoom_link}`;
    }

    // Create calendar event
    const event: CalendarEvent = {
      summary: session.title,
      description,
      start: {
        dateTime: startTime.toISOString(),
        timeZone: 'Asia/Kolkata',
      },
      end: {
        dateTime: endTime.toISOString(),
        timeZone: 'Asia/Kolkata',
      },
    };

    let createdEvent;
    if (attendeeEmails.length > 0) {
      createdEvent = await googleCalendar.createEventWithAttendees(
        accessToken,
        event,
        attendeeEmails
      );
    } else {
      createdEvent = await googleCalendar.createEvent(accessToken, event);
    }

    // Store event ID in session
    await adminClient
      .from('sessions')
      .update({ calendar_event_id: createdEvent.id })
      .eq('id', sessionId);

    return NextResponse.json({
      success: true,
      eventId: createdEvent.id,
      attendeesInvited: attendeeEmails.length,
    });
  } catch (error) {
    console.error('Error creating calendar event:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create calendar event' },
      { status: 500 }
    );
  }
}

// PUT - Update calendar event
export async function PUT(request: NextRequest) {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const { sessionId } = body;

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    const accessToken = await getValidAccessToken(auth.userId!);
    if (!accessToken) {
      return NextResponse.json(
        { error: 'Calendar not connected. Please reconnect Google Calendar.' },
        { status: 401 }
      );
    }

    const adminClient = await createAdminClient();

    // Get session details
    const { data: session } = await adminClient
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (!session || !session.calendar_event_id) {
      return NextResponse.json({ error: 'Session or calendar event not found' }, { status: 404 });
    }

    // Calculate end time
    const startTime = new Date(session.scheduled_at);
    const endTime = new Date(startTime.getTime() + session.duration_minutes * 60000);

    // Build event description
    let description = session.description || '';
    if (session.zoom_link) {
      description += `\n\nZoom Link: ${session.zoom_link}`;
    }

    // Update calendar event
    await googleCalendar.updateEvent(accessToken, session.calendar_event_id, {
      summary: session.title,
      description,
      start: {
        dateTime: startTime.toISOString(),
        timeZone: 'Asia/Kolkata',
      },
      end: {
        dateTime: endTime.toISOString(),
        timeZone: 'Asia/Kolkata',
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating calendar event:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update calendar event' },
      { status: 500 }
    );
  }
}

// DELETE - Remove calendar event
export async function DELETE(request: NextRequest) {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    const accessToken = await getValidAccessToken(auth.userId!);
    if (!accessToken) {
      return NextResponse.json(
        { error: 'Calendar not connected. Please reconnect Google Calendar.' },
        { status: 401 }
      );
    }

    const adminClient = await createAdminClient();

    // Get session details
    const { data: session } = await adminClient
      .from('sessions')
      .select('calendar_event_id')
      .eq('id', sessionId)
      .single();

    if (!session?.calendar_event_id) {
      return NextResponse.json({ success: true }); // No event to delete
    }

    // Delete calendar event
    await googleCalendar.deleteEvent(accessToken, session.calendar_event_id);

    // Clear event ID from session
    await adminClient
      .from('sessions')
      .update({ calendar_event_id: null })
      .eq('id', sessionId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting calendar event:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete calendar event' },
      { status: 500 }
    );
  }
}
