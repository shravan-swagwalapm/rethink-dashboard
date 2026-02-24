import { NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/api/verify-admin';
import { createAdminClient } from '@/lib/supabase/server';
import { ZoomService } from '@/lib/integrations/zoom';
import { detectFormalEnd, type ResolvedParticipantInput } from '@/lib/services/cliff-detector';

export async function POST() {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const supabase = await createAdminClient();
    const zoomService = new ZoomService();

    // Fetch all sessions that have zoom data
    const { data: sessions, error: sessionsError } = await supabase
      .from('sessions')
      .select('id, title, zoom_meeting_id, actual_duration_minutes, duration_minutes, cliff_detection, formal_end_minutes')
      .not('zoom_meeting_id', 'is', null)
      .order('scheduled_at', { ascending: false });

    if (sessionsError) {
      return NextResponse.json({ error: sessionsError.message }, { status: 500 });
    }

    if (!sessions || sessions.length === 0) {
      return NextResponse.json({ summary: { total: 0 }, results: [] });
    }

    const results: Array<{
      sessionId: string;
      title: string;
      status: 'detected' | 'no_cliff' | 'skipped' | 'error';
      confidence?: string;
      effectiveEndMinutes?: number;
      studentsImpacted?: number;
      error?: string;
    }> = [];

    for (const session of sessions) {
      // Skip already-dismissed cliffs
      const cliffData = session.cliff_detection as Record<string, unknown> | null;
      if (cliffData?.dismissed) {
        results.push({ sessionId: session.id, title: session.title, status: 'skipped', error: 'Previously dismissed' });
        continue;
      }

      try {
        // Get meeting UUID from import logs or session
        const { data: importLog } = await supabase
          .from('zoom_import_logs')
          .select('zoom_meeting_uuid')
          .eq('session_id', session.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        const meetingUuid = importLog?.zoom_meeting_uuid || session.zoom_meeting_id;
        if (!meetingUuid) {
          results.push({ sessionId: session.id, title: session.title, status: 'skipped', error: 'No meeting UUID' });
          continue;
        }

        // Fetch participants from Zoom
        const participants = await zoomService.getPastMeetingParticipants(meetingUuid);
        if (!participants || participants.length === 0) {
          results.push({ sessionId: session.id, title: session.title, status: 'skipped', error: 'No participant data (may be >6 months old)' });
          continue;
        }

        // Get meeting times
        let meetingStart: string;
        let meetingEnd: string;
        try {
          const details = await zoomService.getPastMeetingDetails(meetingUuid);
          if (details?.start_time && details?.end_time) {
            meetingStart = details.start_time;
            meetingEnd = details.end_time;
          } else {
            throw new Error('Missing times');
          }
        } catch {
          // Fallback: derive from participant join/leave times
          const joinTimes = participants.map(p => new Date(p.join_time).getTime());
          const leaveTimes = participants.map(p => new Date(p.leave_time).getTime());
          meetingStart = new Date(Math.min(...joinTimes)).toISOString();
          meetingEnd = new Date(Math.max(...leaveTimes)).toISOString();
        }

        // Group participants by email
        const emailGroups = new Map<string, { join_time: string; leave_time: string }[]>();
        for (const p of participants) {
          const email = (p.user_email || `__nomail__${p.id}`).toLowerCase().trim();
          if (!emailGroups.has(email)) emailGroups.set(email, []);
          emailGroups.get(email)!.push({ join_time: p.join_time, leave_time: p.leave_time });
        }

        const resolved: ResolvedParticipantInput[] = [];
        for (const [email, segments] of emailGroups) {
          resolved.push({ userId: email.startsWith('__nomail__') ? null : email, segments });
        }

        // Run detection
        const detection = detectFormalEnd(resolved, meetingStart, meetingEnd);

        // Save result to session
        await supabase
          .from('sessions')
          .update({ cliff_detection: detection })
          .eq('id', session.id);

        if (detection.detected) {
          results.push({
            sessionId: session.id,
            title: session.title,
            status: 'detected',
            confidence: detection.confidence,
            effectiveEndMinutes: detection.effectiveEndMinutes,
            studentsImpacted: detection.studentsImpacted,
          });
        } else {
          results.push({ sessionId: session.id, title: session.title, status: 'no_cliff' });
        }

        // Rate limit: 200ms between sessions to respect Zoom API
        await new Promise((r) => setTimeout(r, 200));
      } catch (error) {
        results.push({
          sessionId: session.id,
          title: session.title,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    const detected = results.filter((r) => r.status === 'detected');
    const summary = {
      total: sessions.length,
      detected: detected.length,
      highConfidence: detected.filter((r) => r.confidence === 'high').length,
      mediumConfidence: detected.filter((r) => r.confidence === 'medium').length,
      lowConfidence: detected.filter((r) => r.confidence === 'low').length,
      noCliff: results.filter((r) => r.status === 'no_cliff').length,
      skipped: results.filter((r) => r.status === 'skipped').length,
      errors: results.filter((r) => r.status === 'error').length,
      totalStudentsImpacted: detected.reduce((sum, r) => sum + (r.studentsImpacted || 0), 0),
    };

    return NextResponse.json({ summary, results });
  } catch (error) {
    console.error('[detect-cliffs-bulk] Error:', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to run bulk cliff detection' },
      { status: 500 }
    );
  }
}
