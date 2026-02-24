import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/api/verify-admin';
import { createAdminClient } from '@/lib/supabase/server';
import { ZoomService } from '@/lib/integrations/zoom';
import { detectFormalEnd, type ResolvedParticipantInput } from '@/lib/services/cliff-detector';

/**
 * POST: Run cliff detection for a single session.
 * Fetches Zoom participant data, detects mass-departure "cliff",
 * stores result on the session record, and returns the detection result.
 */
export async function POST(request: NextRequest) {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const { sessionId, zoomMeetingUuid } = body;

    if (!sessionId || !zoomMeetingUuid) {
      return NextResponse.json(
        { error: 'sessionId and zoomMeetingUuid are required' },
        { status: 400 }
      );
    }

    const supabase = await createAdminClient();
    const zoomService = new ZoomService();

    // Step 1: Fetch participants from Zoom
    const participants = await zoomService.getPastMeetingParticipants(zoomMeetingUuid);

    if (!participants || participants.length === 0) {
      return NextResponse.json(
        { error: 'No participants found for this meeting' },
        { status: 404 }
      );
    }

    // Step 2: Determine meeting start/end times
    let meetingStart: string;
    let meetingEnd: string;

    try {
      const details = await zoomService.getPastMeetingDetails(zoomMeetingUuid);
      if (details?.start_time && details?.end_time) {
        meetingStart = details.start_time;
        meetingEnd = details.end_time;
      } else {
        throw new Error('Missing start_time or end_time from meeting details');
      }
    } catch {
      // Fallback: derive from participant join/leave times
      console.warn('[detect-cliff] Could not fetch meeting details, falling back to participant times');
      const joinTimes = participants.map(p => new Date(p.join_time).getTime());
      const leaveTimes = participants.map(p => new Date(p.leave_time).getTime());
      meetingStart = new Date(Math.min(...joinTimes)).toISOString();
      meetingEnd = new Date(Math.max(...leaveTimes)).toISOString();
    }

    // Step 3: Group participants by email
    const groupedByEmail = new Map<string, { join_time: string; leave_time: string }[]>();

    for (const p of participants) {
      const key = (p.user_email || `__nomail__${p.id}`).toLowerCase().trim();
      const segments = groupedByEmail.get(key) || [];
      segments.push({ join_time: p.join_time, leave_time: p.leave_time });
      groupedByEmail.set(key, segments);
    }

    // Step 4: Convert to ResolvedParticipantInput[]
    const resolvedParticipants: ResolvedParticipantInput[] = [];

    for (const [email, segments] of groupedByEmail) {
      resolvedParticipants.push({
        userId: email.startsWith('__nomail__') ? null : email,
        segments,
      });
    }

    // Step 5: Run cliff detection
    const result = detectFormalEnd(resolvedParticipants, meetingStart, meetingEnd);

    // Step 6: Store result on the session record
    const { error: updateError } = await supabase
      .from('sessions')
      .update({ cliff_detection: result })
      .eq('id', sessionId);

    if (updateError) {
      console.error('[detect-cliff] Failed to store result:', updateError.message);
      // Still return the result even if storage fails
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('[detect-cliff] Error:', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to run cliff detection' },
      { status: 500 }
    );
  }
}
