/**
 * Admin Zoom API
 * Manages Zoom meetings and attendance import
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { zoomService } from '@/lib/integrations/zoom';
import { attendanceService } from '@/lib/services/attendance';

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

// GET - Check Zoom connection status OR list past meetings
export async function GET(request: NextRequest) {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  try {
    // Check if Zoom is configured
    if (!zoomService.isConfigured()) {
      return NextResponse.json({
        configured: false,
        error: 'Zoom credentials not configured',
      });
    }

    if (action === 'list-meetings') {
      // List past meetings for import
      const from = searchParams.get('from') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const to = searchParams.get('to') || new Date().toISOString().split('T')[0];

      const result = await zoomService.listPastMeetings({ from, to });

      return NextResponse.json({
        meetings: result.meetings,
        nextPageToken: result.nextPageToken,
      });
    }

    // Default: check status
    // Try to get access token to verify credentials
    await zoomService.getAccessToken();

    return NextResponse.json({
      configured: true,
      status: 'connected',
    });
  } catch (error) {
    console.error('Zoom API error:', error);
    return NextResponse.json({
      configured: true,
      status: 'error',
      error: error instanceof Error ? error.message : 'Failed to connect to Zoom',
    });
  }
}

// POST - Create a Zoom meeting OR import attendance
export async function POST(request: NextRequest) {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const { action } = body;

    if (!zoomService.isConfigured()) {
      return NextResponse.json(
        { error: 'Zoom credentials not configured' },
        { status: 500 }
      );
    }

    if (action === 'create-meeting') {
      // Create a new Zoom meeting
      const { sessionId, topic, startTime, duration, agenda } = body;

      if (!topic || !startTime || !duration) {
        return NextResponse.json(
          { error: 'topic, startTime, and duration are required' },
          { status: 400 }
        );
      }

      const meeting = await zoomService.createMeeting({
        topic,
        startTime,
        duration,
        agenda,
      });

      // If sessionId provided, update the session
      if (sessionId) {
        const adminClient = await createAdminClient();
        await adminClient
          .from('sessions')
          .update({
            zoom_meeting_id: String(meeting.id),
            zoom_link: meeting.join_url,
            zoom_start_url: meeting.start_url,
          })
          .eq('id', sessionId);
      }

      return NextResponse.json({
        success: true,
        meeting: {
          id: meeting.id,
          joinUrl: meeting.join_url,
          startUrl: meeting.start_url,
        },
      });
    }

    if (action === 'import-attendance') {
      // Import attendance from past meeting
      const { zoomMeetingUuid, sessionId } = body;

      if (!zoomMeetingUuid || !sessionId) {
        return NextResponse.json(
          { error: 'zoomMeetingUuid and sessionId are required' },
          { status: 400 }
        );
      }

      const result = await attendanceService.importFromZoom(
        zoomMeetingUuid,
        sessionId,
        auth.userId!
      );

      return NextResponse.json(result);
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Zoom API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Zoom operation failed' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a Zoom meeting
export async function DELETE(request: NextRequest) {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { searchParams } = new URL(request.url);
    const meetingId = searchParams.get('meetingId');

    if (!meetingId) {
      return NextResponse.json({ error: 'Meeting ID is required' }, { status: 400 });
    }

    await zoomService.deleteMeeting(meetingId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting Zoom meeting:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete meeting' },
      { status: 500 }
    );
  }
}
