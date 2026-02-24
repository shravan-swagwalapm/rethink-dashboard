import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/api/verify-admin';
import { createAdminClient } from '@/lib/supabase/server';
import { calculateSessionAttendance } from '@/lib/services/attendance-calculator';

/**
 * POST: Apply a cliff detection result to a session.
 * Sets formal_end_minutes on the session and recalculates attendance.
 */
export async function POST(request: NextRequest) {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const { sessionId, zoomMeetingUuid } = body;
    const formalEndMinutes = typeof body.formalEndMinutes === 'number' && body.formalEndMinutes > 0
      ? Math.round(body.formalEndMinutes)
      : null;

    if (!sessionId || !formalEndMinutes || !zoomMeetingUuid) {
      return NextResponse.json(
        { error: 'sessionId, formalEndMinutes (positive integer), and zoomMeetingUuid are required' },
        { status: 400 }
      );
    }

    const supabase = await createAdminClient();

    // Step 1: Set formal_end_minutes on the session
    const { error: updateError } = await supabase
      .from('sessions')
      .update({ formal_end_minutes: formalEndMinutes })
      .eq('id', sessionId);

    if (updateError) {
      console.error('[apply-cliff] Failed to update formal_end_minutes:', updateError.message);
      return NextResponse.json(
        { error: 'Failed to update session' },
        { status: 500 }
      );
    }

    // Step 2: Update cliff_detection JSON to record the apply action
    const { data: session } = await supabase
      .from('sessions')
      .select('cliff_detection')
      .eq('id', sessionId)
      .single();

    const currentCliffDetection = (session?.cliff_detection as Record<string, unknown>) || {};
    const updatedCliffDetection = {
      ...currentCliffDetection,
      appliedAt: new Date().toISOString(),
      appliedFormalEndMinutes: formalEndMinutes,
    };

    await supabase
      .from('sessions')
      .update({ cliff_detection: updatedCliffDetection })
      .eq('id', sessionId);

    // Step 3: Recalculate attendance using the new formal_end_minutes
    const result = await calculateSessionAttendance(sessionId, zoomMeetingUuid);

    return NextResponse.json({
      success: true,
      formalEndMinutes,
      attendance: result,
    });
  } catch (error) {
    console.error('[apply-cliff] Error:', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to apply cliff' },
      { status: 500 }
    );
  }
}

/**
 * DELETE: Dismiss a cliff detection result.
 * Clears formal_end_minutes and marks the cliff as dismissed.
 */
export async function DELETE(request: NextRequest) {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const { sessionId, zoomMeetingUuid } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: 'sessionId is required' },
        { status: 400 }
      );
    }

    const supabase = await createAdminClient();

    // Step 1: Clear formal_end_minutes
    const { error: updateError } = await supabase
      .from('sessions')
      .update({ formal_end_minutes: null })
      .eq('id', sessionId);

    if (updateError) {
      console.error('[apply-cliff] Failed to clear formal_end_minutes:', updateError.message);
      return NextResponse.json(
        { error: 'Failed to update session' },
        { status: 500 }
      );
    }

    // Step 2: Mark cliff as dismissed in cliff_detection JSON
    const { data: session } = await supabase
      .from('sessions')
      .select('cliff_detection')
      .eq('id', sessionId)
      .single();

    const currentCliffDetection = (session?.cliff_detection as Record<string, unknown>) || {};
    const updatedCliffDetection = {
      ...currentCliffDetection,
      dismissed: true,
      appliedAt: null,
      appliedFormalEndMinutes: null,
    };

    await supabase
      .from('sessions')
      .update({ cliff_detection: updatedCliffDetection })
      .eq('id', sessionId);

    // Step 3: Recalculate attendance if zoomMeetingUuid provided
    let result;
    if (zoomMeetingUuid) {
      result = await calculateSessionAttendance(sessionId, zoomMeetingUuid);
    }

    return NextResponse.json({
      success: true,
      ...(result && { attendance: result }),
    });
  } catch (error) {
    console.error('[apply-cliff] Error:', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to dismiss cliff' },
      { status: 500 }
    );
  }
}
