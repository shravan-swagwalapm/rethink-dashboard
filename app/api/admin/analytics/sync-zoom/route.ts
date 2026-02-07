import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/api/verify-admin';
import { createAdminClient } from '@/lib/supabase/server';
import { zoomService } from '@/lib/integrations/zoom';
import { format, subDays } from 'date-fns';

/**
 * GET: List past Zoom meetings (last 30 days) with session linking info
 */
export async function GET() {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    if (!zoomService.isConfigured()) {
      return NextResponse.json({ error: 'Zoom is not configured' }, { status: 400 });
    }

    const supabase = await createAdminClient();
    const today = new Date();
    const thirtyDaysAgo = subDays(today, 30);

    // Fetch past meetings from Zoom
    const { meetings } = await zoomService.listPastMeetings({
      from: format(thirtyDaysAgo, 'yyyy-MM-dd'),
      to: format(today, 'yyyy-MM-dd'),
      pageSize: 100,
    });

    // Get all sessions with zoom_meeting_id to find linked ones
    const { data: linkedSessions } = await supabase
      .from('sessions')
      .select('id, zoom_meeting_id, title, cohort_id, counts_for_students, actual_duration_minutes, duration_minutes')
      .not('zoom_meeting_id', 'is', null);

    const sessionByMeetingId = new Map(
      (linkedSessions || []).map((s) => [s.zoom_meeting_id, s])
    );

    // Get attendance calculation status for linked sessions
    const linkedSessionIds = (linkedSessions || []).map((s) => s.id);
    const { data: attendanceCounts } = linkedSessionIds.length > 0
      ? await supabase
          .from('attendance')
          .select('session_id')
          .in('session_id', linkedSessionIds)
      : { data: [] };

    const sessionsWithAttendance = new Set(
      (attendanceCounts || []).map((a) => a.session_id)
    );

    // Build response
    const enrichedMeetings = meetings.map((m) => {
      const linkedSession = sessionByMeetingId.get(String(m.id));
      return {
        zoomId: String(m.id),
        uuid: m.uuid,
        topic: m.topic,
        date: m.start_time,
        duration: m.duration,
        participantCount: m.participants_count || 0,
        linkedSessionId: linkedSession?.id || null,
        linkedSessionTitle: linkedSession?.title || null,
        cohortId: linkedSession?.cohort_id || null,
        countsForStudents: linkedSession?.counts_for_students || false,
        actualDurationMinutes: linkedSession?.actual_duration_minutes || linkedSession?.duration_minutes || m.duration,
        hasAttendance: linkedSession ? sessionsWithAttendance.has(linkedSession.id) : false,
      };
    });

    return NextResponse.json({ meetings: enrichedMeetings });
  } catch (error) {
    console.error('Error syncing Zoom meetings:', error);
    const message = error instanceof Error ? error.message : 'Failed to sync Zoom meetings';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

/**
 * POST: Link a Zoom meeting to a session/cohort
 */
export async function POST(request: NextRequest) {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const { zoomMeetingId, sessionId, cohortId, topic, countsForStudents, actualDurationMinutes } = body;

    if (!zoomMeetingId) {
      return NextResponse.json({ error: 'zoomMeetingId is required' }, { status: 400 });
    }

    const supabase = await createAdminClient();

    if (sessionId) {
      // Link to existing session
      const updateData: Record<string, unknown> = {
        zoom_meeting_id: zoomMeetingId,
      };
      if (typeof countsForStudents === 'boolean') {
        updateData.counts_for_students = countsForStudents;
      }
      if (actualDurationMinutes) {
        updateData.actual_duration_minutes = actualDurationMinutes;
      }

      const { error } = await supabase
        .from('sessions')
        .update(updateData)
        .eq('id', sessionId);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    } else {
      // Create a minimal session record
      const { error } = await supabase.from('sessions').insert({
        title: topic || 'Zoom Meeting',
        zoom_meeting_id: zoomMeetingId,
        cohort_id: cohortId || null,
        scheduled_at: new Date().toISOString(),
        duration_minutes: actualDurationMinutes || 60,
        actual_duration_minutes: actualDurationMinutes || null,
        counts_for_students: countsForStudents ?? true,
        created_by: auth.userId,
      });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error linking Zoom meeting:', error);
    return NextResponse.json(
      { error: 'Failed to link Zoom meeting' },
      { status: 500 }
    );
  }
}
