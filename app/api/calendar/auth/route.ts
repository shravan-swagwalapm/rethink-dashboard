/**
 * Google Calendar OAuth Authorization
 * Redirects admin to Google consent screen
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { googleCalendar } from '@/lib/integrations/google-calendar';

export async function GET() {
  try {
    // Verify user is admin
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_APP_URL));
    }

    // Check admin role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || !['admin', 'company_user'].includes(profile.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Check if Google Calendar is configured
    if (!googleCalendar.isConfigured()) {
      return NextResponse.json(
        { error: 'Google Calendar not configured. Please add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to environment variables.' },
        { status: 500 }
      );
    }

    // Generate auth URL with user ID as state
    const authUrl = googleCalendar.getAuthUrl(user.id);

    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error('Error initiating calendar auth:', error);
    return NextResponse.json(
      { error: 'Failed to initiate calendar authorization' },
      { status: 500 }
    );
  }
}
