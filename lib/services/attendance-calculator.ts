/**
 * Attendance Calculator Engine
 * Smart deduplication and accurate attendance calculation from Zoom participant data.
 *
 * Handles edge cases:
 * 1. Same email, multiple entries → grouped by email
 * 2. Different emails, same user → resolved via email aliases
 * 3. Same person, multiple devices → grouped by resolved user_id
 * 4. Overlapping time ranges → sweep-line merge algorithm
 * 5. No leave_time → use meeting end time
 * 6. Over 100% → capped with Math.min
 * 7. No email (guest) → stored as unmatched
 * 8. Recalculate → delete existing + re-insert
 */

import { createAdminClient } from '@/lib/supabase/server';
import { zoomService, ZoomPastParticipant } from '@/lib/integrations/zoom';
import { matchParticipantToUser } from '@/lib/services/user-matcher';

export interface TimeSegment {
  join_time: Date;
  leave_time: Date;
}

interface ResolvedParticipant {
  userId: string | null;
  email: string;
  displayName: string;
  segments: TimeSegment[];
}

/**
 * Group raw Zoom participants by normalized email.
 * Participants with no email are grouped under their display name.
 */
export function groupParticipantsByEmail(
  participants: ZoomPastParticipant[]
): Map<string, ZoomPastParticipant[]> {
  const groups = new Map<string, ZoomPastParticipant[]>();

  for (const p of participants) {
    const key = p.user_email
      ? p.user_email.toLowerCase().trim()
      : `__nomail__${p.id}`;  // Use Zoom participant ID, not name (avoids merging different guests with same name)

    const existing = groups.get(key) || [];
    existing.push(p);
    groups.set(key, existing);
  }

  return groups;
}

/**
 * Resolve email groups → user IDs via matchParticipantToUser.
 * Merges groups that resolve to the same user_id (handles alias case).
 */
export async function resolveUserIds(
  groups: Map<string, ZoomPastParticipant[]>,
  meetingEndTime: Date
): Promise<Map<string, ResolvedParticipant>> {
  const byUserId = new Map<string, ResolvedParticipant>();
  const unmatchedKey = (email: string) => `__unmatched__${email}`;

  for (const [emailKey, participants] of groups) {
    const isNoEmail = emailKey.startsWith('__nomail__');
    const email = isNoEmail ? '' : emailKey;

    // Resolve email to user_id
    const userId = email ? await matchParticipantToUser(email) : null;

    // Build time segments from this group
    const segments: TimeSegment[] = participants.map((p) => ({
      join_time: new Date(p.join_time),
      leave_time: p.leave_time ? new Date(p.leave_time) : meetingEndTime,
    }));

    const displayName = participants[0]?.name || email || 'Unknown';

    if (userId) {
      // Merge with existing entry for this user (alias resolution)
      const existing = byUserId.get(userId);
      if (existing) {
        existing.segments.push(...segments);
        // Keep the more informative email
        if (!existing.email && email) {
          existing.email = email;
        }
      } else {
        byUserId.set(userId, { userId, email, displayName, segments });
      }
    } else {
      // Unmatched — store under email key
      const key = unmatchedKey(emailKey);
      byUserId.set(key, { userId: null, email, displayName, segments });
    }
  }

  return byUserId;
}

/**
 * Merge overlapping time segments using a sweep-line algorithm.
 * Input segments can overlap (same person, multiple reconnections).
 * Output: non-overlapping, minimal set of segments.
 */
export function mergeOverlappingSegments(segments: TimeSegment[]): TimeSegment[] {
  if (segments.length <= 1) return segments;

  // Sort by join_time ascending
  const sorted = [...segments].sort(
    (a, b) => a.join_time.getTime() - b.join_time.getTime()
  );

  const merged: TimeSegment[] = [{ ...sorted[0] }];

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const last = merged[merged.length - 1];

    if (current.join_time.getTime() <= last.leave_time.getTime()) {
      // Overlapping or adjacent — extend the end if needed
      if (current.leave_time.getTime() > last.leave_time.getTime()) {
        last.leave_time = current.leave_time;
      }
    } else {
      // No overlap — start a new segment
      merged.push({ ...current });
    }
  }

  return merged;
}

/**
 * Calculate total attended minutes from merged segments.
 */
function totalMinutesFromSegments(segments: TimeSegment[]): number {
  return segments.reduce((total, seg) => {
    const ms = Math.max(0, seg.leave_time.getTime() - seg.join_time.getTime());
    return total + ms / 1000 / 60;
  }, 0);
}

/**
 * Orchestrator: calculate and persist attendance for a session.
 *
 * 1. Fetch participants from Zoom API
 * 2. Group by email
 * 3. Resolve to user_ids (with alias support)
 * 4. Merge overlapping segments per user
 * 5. Calculate attendance percentage
 * 6. Delete existing records (recalculate behavior)
 * 7. Upsert to attendance + attendance_segments tables
 */
export async function calculateSessionAttendance(
  sessionId: string,
  zoomMeetingUuid: string,
  actualDurationMinutes?: number
): Promise<{ imported: number; unmatched: number; actualDurationUsed: number }> {
  const supabase = await createAdminClient();

  // Auto-resolve duration: Zoom API actual > caller-provided > session.actual_duration_minutes > session.duration_minutes
  let resolvedDuration = actualDurationMinutes || 0;
  let durationSource = actualDurationMinutes ? 'caller' : 'none';

  try {
    const zoomDetails = await zoomService.getPastMeetingDetails(zoomMeetingUuid);
    if (zoomDetails?.start_time && zoomDetails?.end_time) {
      const start = new Date(zoomDetails.start_time).getTime();
      const end = new Date(zoomDetails.end_time).getTime();
      const zoomActual = Math.round((end - start) / 60000);
      if (zoomActual > 0) {
        resolvedDuration = zoomActual;
        durationSource = 'zoom_api';
      }
    }
  } catch (err) {
    console.warn('[Attendance Calculator] Could not fetch Zoom meeting details, using fallback:', err);
  }

  // If still no duration, try session record
  if (!resolvedDuration || resolvedDuration <= 0) {
    const { data: sessionRecord } = await supabase
      .from('sessions')
      .select('actual_duration_minutes, duration_minutes')
      .eq('id', sessionId)
      .single();

    if (sessionRecord?.actual_duration_minutes && sessionRecord.actual_duration_minutes > 0) {
      resolvedDuration = sessionRecord.actual_duration_minutes;
      durationSource = 'session.actual_duration_minutes';
    } else if (sessionRecord?.duration_minutes && sessionRecord.duration_minutes > 0) {
      resolvedDuration = sessionRecord.duration_minutes;
      durationSource = 'session.duration_minutes';
    }
  }

  if (!resolvedDuration || resolvedDuration <= 0) {
    throw new Error('Could not determine meeting duration from any source');
  }

  console.log(`[Attendance Calculator] Using duration: ${resolvedDuration} min (source: ${durationSource}) for session ${sessionId}`);

  // 1. Fetch participants from Zoom
  const participants = await zoomService.getPastMeetingParticipants(zoomMeetingUuid);

  if (!participants || participants.length === 0) {
    return { imported: 0, unmatched: 0, actualDurationUsed: resolvedDuration };
  }

  // Compute meeting end time from the latest leave_time across all participants
  const meetingEndTime = participants.reduce((latest, p) => {
    if (p.leave_time) {
      const lt = new Date(p.leave_time);
      return lt > latest ? lt : latest;
    }
    return latest;
  }, new Date(0));

  // If no leave times found, estimate from first join + duration
  if (meetingEndTime.getTime() === 0) {
    const firstJoin = participants.reduce((earliest, p) => {
      const jt = new Date(p.join_time);
      return jt < earliest ? jt : earliest;
    }, new Date());
    meetingEndTime.setTime(firstJoin.getTime() + resolvedDuration * 60 * 1000);
  }

  // 2. Group by email
  const groups = groupParticipantsByEmail(participants);

  // 3. Resolve to user IDs
  const resolved = await resolveUserIds(groups, meetingEndTime);

  // 4. Delete existing records for this session (recalculate behavior)
  // First get existing attendance IDs to cascade-delete segments
  const { data: existingAttendance } = await supabase
    .from('attendance')
    .select('id')
    .eq('session_id', sessionId);

  if (existingAttendance && existingAttendance.length > 0) {
    const attendanceIds = existingAttendance.map((a) => a.id);
    await supabase
      .from('attendance_segments')
      .delete()
      .in('attendance_id', attendanceIds);
    await supabase
      .from('attendance')
      .delete()
      .eq('session_id', sessionId);
  }

  // 5. Process each resolved participant
  let imported = 0;
  let unmatched = 0;

  for (const [, participant] of resolved) {
    // Merge overlapping segments
    const mergedSegments = mergeOverlappingSegments(participant.segments);
    const totalMinutes = totalMinutesFromSegments(mergedSegments);
    const percentage = Math.min(100, Math.round((totalMinutes / resolvedDuration) * 100 * 100) / 100);

    // Total duration in seconds
    const totalDurationSeconds = Math.round(totalMinutes * 60);

    // First join and last leave
    const firstJoin = mergedSegments[0].join_time;
    const lastLeave = mergedSegments[mergedSegments.length - 1].leave_time;

    // Insert attendance record
    const { data: attendanceRecord, error: attendanceError } = await supabase
      .from('attendance')
      .insert({
        session_id: sessionId,
        user_id: participant.userId,
        zoom_user_email: participant.email || participant.displayName,
        join_time: firstJoin.toISOString(),
        leave_time: lastLeave.toISOString(),
        duration_seconds: totalDurationSeconds,
        attendance_percentage: percentage,
      })
      .select('id')
      .single();

    if (attendanceError) {
      console.error('Error inserting attendance:', attendanceError);
      continue;
    }

    // Insert individual segments
    if (attendanceRecord && mergedSegments.length > 0) {
      const segmentRows = mergedSegments.map((seg) => ({
        attendance_id: attendanceRecord.id,
        join_time: seg.join_time.toISOString(),
        leave_time: seg.leave_time.toISOString(),
        duration_seconds: Math.round(
          (seg.leave_time.getTime() - seg.join_time.getTime()) / 1000
        ),
      }));

      await supabase.from('attendance_segments').insert(segmentRows);
    }

    if (participant.userId) {
      imported++;
    } else {
      unmatched++;
    }
  }

  return { imported, unmatched, actualDurationUsed: resolvedDuration };
}
