import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { isEmailDomainAllowed, bypassesWhitelist } from '@/lib/auth/allowed-domains';
import { isEmailWhitelisted, markInviteAsAccepted } from '@/lib/auth/whitelist';

// This route handles ADMIN login mode
// Path: /auth/callback/admin
// The path itself indicates admin mode - no query params needed (they get stripped by Supabase)

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  // Login mode is determined by the PATH, not query params
  const loginMode = 'admin';
  console.log('Auth callback (ADMIN path): Processing OAuth callback');

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error('Auth callback: Error exchanging code:', error);
      return NextResponse.redirect(`${origin}/login?error=auth`);
    }

    const userEmail = data.session?.user?.email;

    if (!userEmail) {
      await supabase.auth.signOut();
      return NextResponse.redirect(`${origin}/login?error=no_email`);
    }

    // Step 1: Check if email domain is allowed
    if (!isEmailDomainAllowed(userEmail)) {
      await supabase.auth.signOut();
      return NextResponse.redirect(`${origin}/login?error=domain_not_allowed`);
    }

    // Use admin client for all profile operations to bypass RLS
    const adminClient = await createAdminClient();
    let userRole = 'student'; // default role

    // Step 2: Check if domain bypasses whitelist (can login without invite)
    // NOTE: This does NOT grant admin access - admin role must be set in database
    if (bypassesWhitelist(userEmail)) {
      // Check if profile already exists to get existing role
      const { data: existingProfile } = await adminClient
        .from('profiles')
        .select('role')
        .eq('id', data.session.user.id)
        .maybeSingle();

      const existingRole = existingProfile?.role || 'student';

      const { error: upsertError } = await adminClient.from('profiles').upsert(
        {
          id: data.session.user.id,
          email: userEmail.toLowerCase(),
          role: existingRole, // Preserve existing role or default to student
          full_name:
            data.session.user.user_metadata?.full_name ||
            data.session.user.user_metadata?.name ||
            null,
        },
        { onConflict: 'id' }
      );

      if (upsertError) {
        console.error('Error creating whitelist-bypass profile:', upsertError);
      }
      userRole = existingRole;
    } else {
      // Step 3: Check if email is whitelisted (exists in invites or profiles)
      const whitelist = await isEmailWhitelisted(userEmail);

      if (!whitelist.allowed) {
        await supabase.auth.signOut();
        return NextResponse.redirect(`${origin}/login?error=not_invited`);
      }

      // Step 4: If user is from invites table (first login), update invite status
      if (whitelist.existsInInvites && whitelist.inviteId) {
        await markInviteAsAccepted(whitelist.inviteId);
      }

      // Fetch existing profile to get role
      const { data: profile } = await adminClient
        .from('profiles')
        .select('role')
        .eq('id', data.session.user.id)
        .single();

      if (profile) {
        userRole = profile.role;
      }
    }

    // Determine redirect destination
    // Admin path + admin role = /admin
    // Admin path + non-admin role = /dashboard (with warning)
    const isAdminRole = userRole === 'admin' || userRole === 'company_user';
    const shouldGoToAdmin = loginMode === 'admin' && isAdminRole;

    console.log(
      'Auth callback (ADMIN path): userRole =', userRole,
      ', isAdminRole =', isAdminRole,
      ', shouldGoToAdmin =', shouldGoToAdmin
    );

    if (shouldGoToAdmin) {
      console.log('Auth callback: Redirecting to /admin');
      return NextResponse.redirect(`${origin}/admin`);
    } else {
      // User tried admin login but doesn't have admin role
      console.log('Auth callback: User is not admin, redirecting to /dashboard');
      return NextResponse.redirect(`${origin}/dashboard`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
