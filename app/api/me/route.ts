import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// Force dynamic rendering - no caching
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      const response = NextResponse.json({ user: null, profile: null });
      response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
      return response;
    }

    // Use adminClient to bypass RLS — profiles has self-referencing policies
    // that cause circular dependency issues (same pattern as Session 3 subgroup fix).
    // Manual scoping via .eq('id', user.id) provides equivalent row-level isolation.
    const adminClient = await createAdminClient();
    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select(`
        *,
        role_assignments:user_role_assignments(
          id,
          role,
          cohort_id,
          cohort:cohorts(id, name, tag, status),
          created_at
        )
      `)
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('Error fetching profile:', profileError);
      const response = NextResponse.json({ user, profile: null });
      response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
      return response;
    }

    const response = NextResponse.json({ user, profile });
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    return response;
  } catch (error) {
    console.error('Error in /api/me:', error);
    const response = NextResponse.json({ user: null, profile: null }, { status: 500 });
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    return response;
  }
}
