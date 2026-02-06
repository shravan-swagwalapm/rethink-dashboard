/**
 * Shared calendar helpers for Google Calendar integration.
 *
 * Extracted from 4 route files where identical copies existed:
 *   - app/api/admin/sessions/route.ts
 *   - app/api/admin/users/route.ts
 *   - app/api/admin/users/create/route.ts
 *   - app/api/admin/users/bulk-create/route.ts
 *
 * Note: app/api/admin/calendar/route.ts has its own `getValidAccessToken()`
 * with a richer return type (TokenResult with needsReconnect) — intentionally
 * kept separate.
 */

import { createAdminClient } from '@/lib/supabase/server';
import { googleCalendar } from '@/lib/integrations/google-calendar';

/**
 * Get a valid Google Calendar access token for a user.
 * Automatically refreshes expired tokens (with 5-minute buffer).
 *
 * @returns The access token string, or null if no token exists or refresh fails.
 */
export async function getValidCalendarToken(userId: string): Promise<string | null> {
  const adminClient = await createAdminClient();

  const { data: tokenData } = await adminClient
    .from('calendar_tokens')
    .select('access_token, refresh_token, expires_at')
    .eq('user_id', userId)
    .single();

  if (!tokenData) return null;

  // Check if token is expired (with 5 min buffer)
  const expiresAt = new Date(tokenData.expires_at);
  if (expiresAt.getTime() < Date.now() + 300000) {
    try {
      const refreshed = await googleCalendar.refreshAccessToken(tokenData.refresh_token);
      await adminClient
        .from('calendar_tokens')
        .update({
          access_token: refreshed.accessToken,
          expires_at: new Date(Date.now() + refreshed.expiresIn * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);
      return refreshed.accessToken;
    } catch {
      return null;
    }
  }

  return tokenData.access_token;
}

/**
 * Send Google Calendar invites for all future sessions in a cohort to a new member.
 * Used when adding a user to a cohort (single create or bulk create).
 */
export async function sendCalendarInvitesToNewMember(
  userEmail: string,
  cohortId: string,
  adminUserId: string
): Promise<{ sent: number; failed: number }> {
  const adminClient = await createAdminClient();

  const now = new Date().toISOString();
  const { data: futureSessions } = await adminClient
    .from('sessions')
    .select('id, calendar_event_id')
    .eq('cohort_id', cohortId)
    .gt('scheduled_at', now)
    .not('calendar_event_id', 'is', null);

  if (!futureSessions || futureSessions.length === 0) {
    return { sent: 0, failed: 0 };
  }

  const accessToken = await getValidCalendarToken(adminUserId);
  if (!accessToken) {
    console.log('No valid calendar token available for sending invites');
    return { sent: 0, failed: futureSessions.length };
  }

  let sent = 0;
  let failed = 0;

  for (const session of futureSessions) {
    try {
      await googleCalendar.addAttendeeToEvent(
        accessToken,
        session.calendar_event_id!,
        userEmail
      );
      sent++;
    } catch (error) {
      console.error(`Failed to add attendee to session ${session.id}:`, error);
      failed++;
    }
  }

  return { sent, failed };
}

/**
 * Remove Google Calendar invites for all future sessions in a cohort from a user.
 * Used when moving a user to a different cohort.
 */
export async function removeCalendarInvitesFromOldCohort(
  userEmail: string,
  oldCohortId: string,
  adminUserId: string
): Promise<{ removed: number; failed: number }> {
  const adminClient = await createAdminClient();

  const now = new Date().toISOString();
  const { data: futureSessions } = await adminClient
    .from('sessions')
    .select('id, calendar_event_id')
    .eq('cohort_id', oldCohortId)
    .gt('scheduled_at', now)
    .not('calendar_event_id', 'is', null);

  if (!futureSessions || futureSessions.length === 0) {
    return { removed: 0, failed: 0 };
  }

  const accessToken = await getValidCalendarToken(adminUserId);
  if (!accessToken) {
    console.log('No valid calendar token available for removing invites');
    return { removed: 0, failed: futureSessions.length };
  }

  let removed = 0;
  let failed = 0;

  for (const session of futureSessions) {
    try {
      await googleCalendar.removeAttendeeFromEvent(
        accessToken,
        session.calendar_event_id!,
        userEmail
      );
      removed++;
    } catch (error) {
      console.error(`Failed to remove attendee from session ${session.id}:`, error);
      failed++;
    }
  }

  return { removed, failed };
}
