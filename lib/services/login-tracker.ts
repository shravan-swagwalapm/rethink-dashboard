import { createAdminClient } from '@/lib/supabase/server';
import { headers } from 'next/headers';

/**
 * Log a login event to the login_events table.
 * Fire-and-forget — errors are logged but never block auth flow.
 */
export async function trackLogin(
  userId: string,
  loginMethod: 'phone_otp' | 'google_oauth' | 'magic_link'
): Promise<void> {
  try {
    const adminClient = await createAdminClient();
    const headersList = await headers();
    const ipAddress = headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ||
                      headersList.get('x-real-ip') ||
                      null;
    const userAgent = headersList.get('user-agent') || null;

    await adminClient.from('login_events').insert({
      user_id: userId,
      login_method: loginMethod,
      ip_address: ipAddress,
      user_agent: userAgent,
    });
  } catch (error) {
    // Never block auth flow — log and move on
    console.error('[login-tracker] Failed to log login event:', error);
  }
}
