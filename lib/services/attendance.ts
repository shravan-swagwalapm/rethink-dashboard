/**
 * Attendance Service
 * Handles attendance tracking from Zoom webhooks and imports
 */

import { createAdminClient } from '@/lib/supabase/server';
import { zoomService, ZoomParticipant, ZoomPastParticipant } from '@/lib/integrations/zoom';
import { calculateSessionAttendance } from '@/lib/services/attendance-calculator';
import { matchParticipantToUser } from '@/lib/services/user-matcher';

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
   * Match a Zoom participant email to a user profile.
   * Delegates to shared user-matcher utility (breaks circular dependency with attendance-calculator).
   */
  async matchParticipantToUser(email: string): Promise<string | null> {
    return matchParticipantToUser(email);
  }

  /**
   * Add an email alias for a user (for matching attendance)
   */
  async addEmailAlias(userId: string, aliasEmail: string): Promise<{ success: boolean; error?: string }> {
    const supabase = await createAdminClient();

    const { error } = await supabase
      .from('user_email_aliases')
      .insert({
        user_id: userId,
        alias_email: aliasEmail.toLowerCase(),
      });

    if (error) {
      if (error.code === '23505') {
        return { success: false, error: 'This email is already linked to a user' };
      }
      return { success: false, error: error.message };
    }

    return { success: true };
  }

  /**
   * Remove an email alias
   */
  async removeEmailAlias(aliasId: string): Promise<{ success: boolean; error?: string }> {
    const supabase = await createAdminClient();

    const { error } = await supabase
      .from('user_email_aliases')
      .delete()
      .eq('id', aliasId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  }

  /**
   * Get all email aliases for a user
   */
  async getEmailAliases(userId: string): Promise<{ id: string; alias_email: string; created_at: string }[]> {
    const supabase = await createAdminClient();

    const { data } = await supabase
      .from('user_email_aliases')
      .select('id, alias_email, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    return data || [];
  }

  /**
   * Re-match unlinked attendance records after adding an alias
   */
  async rematchAttendanceByEmail(email: string, userId: string): Promise<number> {
    const supabase = await createAdminClient();

    const { data, error } = await supabase
      .from('attendance')
      .update({ user_id: userId })
      .eq('zoom_user_email', email.toLowerCase())
      .is('user_id', null)
      .select();

    if (error) {
      console.error('Error re-matching attendance:', error);
      return 0;
    }

    return data?.length || 0;
  }

  /**
   * Find session by Zoom meeting ID
   */
  async findSessionByMeetingId(meetingId: string): Promise<{ id: string; duration_minutes: number; actual_duration_minutes: number | null; cohort_id: string | null } | null> {
    const supabase = await createAdminClient();

    const { data: session } = await supabase
      .from('sessions')
      .select('id, duration_minutes, actual_duration_minutes, cohort_id')
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
   * Import attendance from a past Zoom meeting.
   * @deprecated Use calculateSessionAttendance() directly for proper segment merging,
   * alias resolution, and auto-resolved duration. This method now delegates to the calculator.
   */
  async importFromZoom(
    zoomMeetingUuid: string,
    sessionId: string,
    importedBy: string
  ): Promise<ImportResult> {
    const supabase = await createAdminClient();

    try {
      // Delegate to the calculator (handles segments, aliases, auto-duration)
      const result = await calculateSessionAttendance(sessionId, zoomMeetingUuid);

      // Log the import
      await supabase.from('zoom_import_logs').insert({
        zoom_meeting_id: zoomMeetingUuid.split('/')[0],
        zoom_meeting_uuid: zoomMeetingUuid,
        session_id: sessionId,
        status: 'completed',
        participants_imported: result.imported,
        imported_by: importedBy,
      });

      return {
        success: true,
        participantsImported: result.imported,
        participantsSkipped: result.unmatched,
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
