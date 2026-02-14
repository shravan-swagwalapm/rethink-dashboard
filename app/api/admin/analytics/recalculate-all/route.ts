import { NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/api/verify-admin';
import { createAdminClient } from '@/lib/supabase/server';
import { calculateSessionAttendance } from '@/lib/services/attendance-calculator';

interface SessionResult {
  sessionId: string;
  title: string;
  status: 'success' | 'skipped' | 'error';
  imported?: number;
  unmatched?: number;
  actualDurationUsed?: number;
  error?: string;
}

/**
 * POST: Bulk recalculate attendance for all sessions with zoom_meeting_id.
 * Duration is auto-resolved from Zoom API for each session.
 */
export async function POST() {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const supabase = await createAdminClient();

    // Fetch all sessions that have a Zoom meeting ID
    const { data: sessions, error: sessionsError } = await supabase
      .from('sessions')
      .select('id, title, zoom_meeting_id')
      .not('zoom_meeting_id', 'is', null)
      .order('scheduled_at', { ascending: false });

    if (sessionsError) {
      return NextResponse.json({ error: sessionsError.message }, { status: 500 });
    }

    if (!sessions || sessions.length === 0) {
      return NextResponse.json({
        message: 'No sessions with Zoom meeting IDs found',
        results: [],
      });
    }

    // For each session, find the meeting UUID from zoom_import_logs or use the meeting ID
    const results: SessionResult[] = [];

    for (const session of sessions) {
      try {
        // Try to get the UUID from zoom_import_logs (most accurate)
        const { data: importLog } = await supabase
          .from('zoom_import_logs')
          .select('zoom_meeting_uuid')
          .eq('session_id', session.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        const meetingUuid = importLog?.zoom_meeting_uuid || session.zoom_meeting_id;

        if (!meetingUuid) {
          results.push({
            sessionId: session.id,
            title: session.title,
            status: 'skipped',
            error: 'No meeting UUID available',
          });
          continue;
        }

        // Calculator auto-resolves duration from Zoom
        const result = await calculateSessionAttendance(session.id, meetingUuid);

        results.push({
          sessionId: session.id,
          title: session.title,
          status: 'success',
          imported: result.imported,
          unmatched: result.unmatched,
          actualDurationUsed: result.actualDurationUsed,
        });

        console.log(
          `[Recalculate All] ${session.title}: ` +
          `${result.imported} imported, ${result.unmatched} unmatched, ` +
          `duration=${result.actualDurationUsed}min`
        );
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[Recalculate All] Error for session ${session.title}:`, errorMsg);

        results.push({
          sessionId: session.id,
          title: session.title,
          status: 'error',
          error: errorMsg,
        });
      }
    }

    const summary = {
      total: results.length,
      success: results.filter(r => r.status === 'success').length,
      skipped: results.filter(r => r.status === 'skipped').length,
      errors: results.filter(r => r.status === 'error').length,
    };

    return NextResponse.json({ summary, results });
  } catch (error) {
    console.error('Error in bulk recalculate:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to recalculate attendance' },
      { status: 500 }
    );
  }
}
