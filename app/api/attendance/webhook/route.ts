/**
 * Zoom Webhook Endpoint
 * Handles attendance tracking via Zoom webhooks
 */

import { NextRequest, NextResponse } from 'next/server';
import { zoomService } from '@/lib/integrations/zoom';
import { attendanceService } from '@/lib/services/attendance';

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const timestamp = request.headers.get('x-zm-request-timestamp') || '';
    const signature = request.headers.get('x-zm-signature') || '';

    // Parse the event first to check for URL validation
    let event;
    try {
      event = JSON.parse(body);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    // Handle URL validation challenge
    if (event.event === 'endpoint.url_validation') {
      const plainToken = event.payload?.plainToken;
      if (plainToken) {
        const encryptedToken = zoomService.handleChallenge(plainToken);
        return NextResponse.json({
          plainToken,
          encryptedToken,
        });
      }
      return NextResponse.json({ error: 'Missing plainToken' }, { status: 400 });
    }

    // Verify webhook signature for all other events
    if (!zoomService.verifyWebhookSignature(body, signature, timestamp)) {
      console.error('Invalid Zoom webhook signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // Parse the webhook event
    const parsedEvent = zoomService.parseWebhookEvent(event);
    const { type, meetingId, participant } = parsedEvent;

    // Find the session associated with this meeting
    const session = await attendanceService.findSessionByMeetingId(meetingId);

    if (!session) {
      // Meeting not tracked in our system, ignore
      console.log(`Meeting ${meetingId} not found in sessions, ignoring webhook`);
      return NextResponse.json({ status: 'ignored', reason: 'meeting not tracked' });
    }

    // Handle different event types
    switch (type) {
      case 'participant.joined':
        if (participant) {
          await attendanceService.recordJoin(session.id, participant);
          console.log(`Recorded join for ${participant.email} in session ${session.id}`);
        }
        break;

      case 'participant.left':
        if (participant) {
          const leaveDuration = session.actual_duration_minutes || session.duration_minutes;
          await attendanceService.recordLeave(session.id, participant, leaveDuration);
          console.log(`Recorded leave for ${participant.email} in session ${session.id}`);
        }
        break;

      case 'meeting.ended':
        const endDuration = session.actual_duration_minutes || session.duration_minutes;
        await attendanceService.finalizeAttendance(session.id, endDuration);
        console.log(`Finalized attendance for session ${session.id}`);
        break;

      default:
        console.log(`Unknown event type: ${type}`);
    }

    return NextResponse.json({ status: 'success' });
  } catch (error) {
    console.error('Error processing Zoom webhook:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Zoom may send GET requests to verify the endpoint
export async function GET() {
  return NextResponse.json({ status: 'Zoom webhook endpoint active' });
}
