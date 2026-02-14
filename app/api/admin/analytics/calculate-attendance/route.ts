import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/api/verify-admin';
import { calculateSessionAttendance } from '@/lib/services/attendance-calculator';

/**
 * POST: Run attendance calculator for a session
 */
export async function POST(request: NextRequest) {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const { sessionId, zoomMeetingUuid, actualDurationMinutes } = body;

    if (!sessionId || !zoomMeetingUuid) {
      return NextResponse.json(
        { error: 'sessionId and zoomMeetingUuid are required' },
        { status: 400 }
      );
    }

    // actualDurationMinutes is now optional — calculator auto-resolves from Zoom API
    const result = await calculateSessionAttendance(
      sessionId,
      zoomMeetingUuid,
      actualDurationMinutes || undefined
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error calculating attendance:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to calculate attendance' },
      { status: 500 }
    );
  }
}
