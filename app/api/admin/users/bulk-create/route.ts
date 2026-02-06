import { createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { googleCalendar } from '@/lib/integrations/google-calendar';
import { verifyAdmin } from '@/lib/api/verify-admin';

interface UserToCreate {
  email: string;
  full_name?: string;
  phone?: string;
  cohort_tag: string;
}

interface CreateResult {
  email: string;
  success: boolean;
  error?: string;
}

// Helper to get valid calendar access token
async function getValidCalendarToken(userId: string): Promise<string | null> {
  const adminClient = await createAdminClient();

  const { data: tokenData } = await adminClient
    .from('calendar_tokens')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (!tokenData) return null;

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

// Helper to send calendar invites for future sessions to a new cohort member
async function sendCalendarInvitesToNewMember(
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

// POST - Bulk create users
export async function POST(request: NextRequest) {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const { users } = body as { users: UserToCreate[] };

    if (!users || !Array.isArray(users) || users.length === 0) {
      return NextResponse.json({ error: 'Users array is required' }, { status: 400 });
    }

    const adminClient = await createAdminClient();

    // Get all cohorts to map tags to IDs
    const { data: cohorts } = await adminClient
      .from('cohorts')
      .select('id, tag');

    const cohortMap = new Map(cohorts?.map(c => [c.tag.toLowerCase(), c.id]) || []);

    // Get existing emails to skip duplicates
    const emails = users.map(u => u.email.toLowerCase());
    const { data: existingProfiles } = await adminClient
      .from('profiles')
      .select('email')
      .in('email', emails);

    const existingEmails = new Set(existingProfiles?.map(p => p.email.toLowerCase()) || []);

    const results: CreateResult[] = [];

    for (const userData of users) {
      const email = userData.email.toLowerCase();

      // Skip if already exists
      if (existingEmails.has(email)) {
        results.push({
          email,
          success: false,
          error: 'User already exists',
        });
        continue;
      }

      // Get cohort ID from tag
      const cohortId = cohortMap.get(userData.cohort_tag.toLowerCase());
      if (!cohortId) {
        results.push({
          email,
          success: false,
          error: `Cohort "${userData.cohort_tag}" not found`,
        });
        continue;
      }

      try {
        // Create user in Supabase Auth
        const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
          email,
          email_confirm: true,
          user_metadata: {
            full_name: userData.full_name || '',
          },
        });

        if (authError) {
          results.push({
            email,
            success: false,
            error: authError.message,
          });
          continue;
        }

        if (!authData.user) {
          results.push({
            email,
            success: false,
            error: 'Failed to create user',
          });
          continue;
        }

        // Update profile with cohort and phone
        await adminClient
          .from('profiles')
          .update({
            full_name: userData.full_name || null,
            phone: userData.phone || null,
            cohort_id: cohortId,
            role: 'student',
          })
          .eq('id', authData.user.id);

        // Send calendar invites for future sessions in this cohort
        try {
          await sendCalendarInvitesToNewMember(email, cohortId, auth.userId!);
        } catch (calendarError) {
          console.error(`Failed to send calendar invites to ${email}:`, calendarError);
          // Don't fail - user creation was successful
        }

        results.push({
          email,
          success: true,
        });

        // Add to existing set to prevent duplicates within same batch
        existingEmails.add(email);
      } catch (error) {
        results.push({
          email,
          success: false,
          error: 'Unexpected error',
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    return NextResponse.json({
      results,
      summary: {
        total: users.length,
        success: successCount,
        failed: failureCount,
      },
      message: `Created ${successCount} users. ${failureCount} failed.`,
    });
  } catch (error) {
    console.error('Error bulk creating users:', error);
    return NextResponse.json({ error: 'Failed to create users' }, { status: 500 });
  }
}
