/**
 * Google Calendar OAuth Callback
 * Exchanges code for tokens and stores them
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { googleCalendar } from '@/lib/integrations/google-calendar';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state'); // Contains user ID
    const error = searchParams.get('error');

    // Handle errors from Google
    if (error) {
      console.error('Google OAuth error:', error);
      return NextResponse.redirect(
        new URL('/admin/sessions?calendar_error=access_denied', process.env.NEXT_PUBLIC_APP_URL)
      );
    }

    if (!code) {
      return NextResponse.redirect(
        new URL('/admin/sessions?calendar_error=no_code', process.env.NEXT_PUBLIC_APP_URL)
      );
    }

    // Verify user is still logged in
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_APP_URL));
    }

    // Verify user ID matches state (if provided)
    if (state && state !== user.id) {
      return NextResponse.redirect(
        new URL('/admin/sessions?calendar_error=state_mismatch', process.env.NEXT_PUBLIC_APP_URL)
      );
    }

    // Exchange code for tokens
    const tokens = await googleCalendar.exchangeCode(code);

    // Get user's email from Google
    const userInfo = await googleCalendar.getUserInfo(tokens.accessToken);

    // Calculate expiration time
    const expiresAt = new Date(Date.now() + tokens.expiresIn * 1000);

    // Store tokens in database
    const adminClient = await createAdminClient();

    await adminClient.from('calendar_tokens').upsert(
      {
        user_id: user.id,
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
        expires_at: expiresAt.toISOString(),
        calendar_email: userInfo.email,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );

    // Redirect back to sessions page with success
    return NextResponse.redirect(
      new URL('/admin/sessions?calendar_connected=true', process.env.NEXT_PUBLIC_APP_URL)
    );
  } catch (error) {
    console.error('Error in calendar callback:', error);
    return NextResponse.redirect(
      new URL('/admin/sessions?calendar_error=token_exchange_failed', process.env.NEXT_PUBLIC_APP_URL)
    );
  }
}
