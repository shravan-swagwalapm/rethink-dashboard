/**
 * Attendance Service
 * Handles attendance tracking from Zoom webhooks and imports
 */

import { createAdminClient } from '@/lib/supabase/server';
import { zoomService, ZoomParticipant, ZoomPastParticipant } from '@/lib/integrations/zoom';

export interface AttendanceRecord {
  sessionId: string;
  userId: string | null;
  zoomUserEmail: string;
  zoomUserName: string;
  joinTime: Date;
  leaveTime?: Date;
  durationSeconds?: number;
  attendancePercentage?: number;
}

export interface ImportResult {
  success: boolean;
  participantsImported: number;
  participantsSkipped: number;
  error?: string;
}

class AttendanceService {
  /**
   * Match a Zoom participant email to a user profile
   */
  async matchParticipantToUser(email: string): Promise<string | null> {
    if (!email) return null;

    const supabase = await createAdminClient();

    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email.toLowerCase())
      .single();

    return profile?.id || null;
  }

  /**
   * Find session by Zoom meeting ID
   */
  async findSessionByMeetingId(meetingId: string): Promise<{ id: string; duration_minutes: number; cohort_id: string | null } | null> {
    const supabase = await createAdminClient();

    const { data: session } = await supabase
      .from('sessions')
      .select('id, duration_minutes, cohort_id')
      .eq('zoom_meeting_id', meetingId)
      .single();

    return session;
  }

  /**
   * Record participant join event
   */
  async recordJoin(
    sessionId: string,
    participant: ZoomParticipant
  ): Promise<void> {
    const supabase = await createAdminClient();

    // Try to match to a user
    const userId = await this.matchParticipantToUser(participant.email);

    // Upsert attendance record
    await supabase
      .from('attendance')
      .upsert(
        {
          session_id: sessionId,
          user_id: userId,
          zoom_user_email: participant.email.toLowerCase(),
          join_time: participant.joinTime.toISOString(),
        },
        {
          onConflict: 'session_id,user_id',
          ignoreDuplicates: false,
        }
      );
  }

  /**
   * Record participant leave event
   */
  async recordLeave(
    sessionId: string,
    participant: ZoomParticipant,
    meetingDurationMinutes: number
  ): Promise<void> {
    const supabase = await createAdminClient();

    const userId = await this.matchParticipantToUser(participant.email);
    const leaveTime = participant.leaveTime || new Date();
    const joinTime = participant.joinTime;

    // Calculate duration and percentage
    const durationSeconds = Math.floor((leaveTime.getTime() - joinTime.getTime()) / 1000);
    const attendancePercentage = zoomService.calculateAttendancePercentage(
      joinTime,
      leaveTime,
      meetingDurationMinutes
    );

    // Update attendance record
    await supabase
      .from('attendance')
      .upsert(
        {
          session_id: sessionId,
          user_id: userId,
          zoom_user_email: participant.email.toLowerCase(),
          join_time: joinTime.toISOString(),
          leave_time: leaveTime.toISOString(),
          duration_seconds: durationSeconds,
          attendance_percentage: attendancePercentage,
        },
        {
          onConflict: 'session_id,user_id',
          ignoreDuplicates: false,
        }
      );
  }

  /**
   * Finalize attendance when meeting ends
   * Updates any participants who didn't have a leave event
   */
  async finalizeAttendance(
    sessionId: string,
    meetingDurationMinutes: number
  ): Promise<void> {
    const supabase = await createAdminClient();
    const now = new Date();

    // Get all attendance records without leave_time
    const { data: openRecords } = await supabase
      .from('attendance')
      .select('*')
      .eq('session_id', sessionId)
      .is('leave_time', null);

    if (!openRecords || openRecords.length === 0) return;

    // Update each record
    for (const record of openRecords) {
      const joinTime = new Date(record.join_time);
      const durationSeconds = Math.floor((now.getTime() - joinTime.getTime()) / 1000);
      const attendancePercentage = zoomService.calculateAttendancePercentage(
        joinTime,
        now,
        meetingDurationMinutes
      );

      await supabase
        .from('attendance')
        .update({
          leave_time: now.toISOString(),
          duration_seconds: durationSeconds,
          attendance_percentage: attendancePercentage,
        })
        .eq('id', record.id);
    }
  }

  /**
   * Import attendance from a past Zoom meeting
   */
  async importFromZoom(
    zoomMeetingUuid: string,
    sessionId: string,
    importedBy: string
  ): Promise<ImportResult> {
    const supabase = await createAdminClient();

    try {
      // Get session details
      const { data: session } = await supabase
        .from('sessions')
        .select('id, duration_minutes')
        .eq('id', sessionId)
        .single();

      if (!session) {
        return { success: false, participantsImported: 0, participantsSkipped: 0, error: 'Session not found' };
      }

      // Get participants from Zoom
      const participants = await zoomService.getPastMeetingParticipants(zoomMeetingUuid);

      let imported = 0;
      let skipped = 0;

      for (const participant of participants) {
        if (!participant.user_email) {
          skipped++;
          continue;
        }

        const userId = await this.matchParticipantToUser(participant.user_email);
        const joinTime = new Date(participant.join_time);
        const leaveTime = new Date(participant.leave_time);
        const durationSeconds = participant.duration;
        const attendancePercentage = zoomService.calculateAttendancePercentage(
          joinTime,
          leaveTime,
          session.duration_minutes
        );

        // Upsert attendance record
        const { error } = await supabase
          .from('attendance')
          .upsert(
            {
              session_id: sessionId,
              user_id: userId,
              zoom_user_email: participant.user_email.toLowerCase(),
              join_time: joinTime.toISOString(),
              leave_time: leaveTime.toISOString(),
              duration_seconds: durationSeconds,
              attendance_percentage: attendancePercentage,
            },
            {
              onConflict: 'session_id,user_id',
              ignoreDuplicates: false,
            }
          );

        if (error) {
          console.error('Error importing attendance:', error);
          skipped++;
        } else {
          imported++;
        }
      }

      // Log the import
      await supabase.from('zoom_import_logs').insert({
        zoom_meeting_id: zoomMeetingUuid.split('/')[0], // Get the meeting ID part
        zoom_meeting_uuid: zoomMeetingUuid,
        session_id: sessionId,
        status: 'completed',
        participants_imported: imported,
        imported_by: importedBy,
      });

      return {
        success: true,
        participantsImported: imported,
        participantsSkipped: skipped,
      };
    } catch (error) {
      console.error('Error importing from Zoom:', error);

      // Log the failed import
      await supabase.from('zoom_import_logs').insert({
        zoom_meeting_id: zoomMeetingUuid,
        zoom_meeting_uuid: zoomMeetingUuid,
        session_id: sessionId,
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        imported_by: importedBy,
      });

      return {
        success: false,
        participantsImported: 0,
        participantsSkipped: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

export const attendanceService = new AttendanceService();
