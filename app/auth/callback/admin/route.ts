import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { isEmailDomainAllowed, bypassesWhitelist } from '@/lib/auth/allowed-domains';
import { isEmailWhitelisted } from '@/lib/auth/whitelist';
import { trackLogin } from '@/lib/services/login-tracker';

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
      // Step 3: Check if email is whitelisted (exists in profiles)
      const whitelist = await isEmailWhitelisted(userEmail);

      if (!whitelist.allowed) {
        await supabase.auth.signOut();
        return NextResponse.redirect(`${origin}/login?error=not_invited`);
      }

      // Fetch existing profile to get role
      const { data: profile } = await adminClient
        .from('profiles')
        .select('role')
        .eq('id', data.session.user.id)
        .single();

      if (profile) {
        userRole = profile.role;

        // Also check user_role_assignments for admin role
        // This ensures users with admin role assignment but 'student' in profiles.role still get admin access
        const { data: adminAssignments } = await adminClient
          .from('user_role_assignments')
          .select('role')
          .eq('user_id', data.session.user.id)
          .in('role', ['admin', 'company_user'])
          .limit(1);

        // If admin assignment exists, use that role (override profiles.role)
        if (adminAssignments && adminAssignments.length > 0) {
          userRole = adminAssignments[0].role;
        }
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
      await trackLogin(data.session.user.id, 'google_oauth');
      const response = NextResponse.redirect(`${origin}/admin`);

      // Set intended role cookie for multi-role users
      response.cookies.set('intended_role', 'admin', {
        httpOnly: false, // Allow JS access
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 5, // 5 minutes (just for initial load)
      });

      return response;
    } else {
      // User tried admin login but doesn't have admin role
      // Sign them out and redirect with error
      console.log('Auth callback: User is not admin, signing out and showing error');
      await supabase.auth.signOut();
      return NextResponse.redirect(`${origin}/login?error=not_admin`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
