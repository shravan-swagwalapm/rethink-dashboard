import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { isEmailDomainAllowed, isSuperuserDomain } from '@/lib/auth/allowed-domains';
import { isEmailWhitelisted, markInviteAsAccepted } from '@/lib/auth/whitelist';

// This route handles USER login mode (default)
// Path: /auth/callback
// For admin login, use /auth/callback/admin instead

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type');

  console.log('Auth callback (USER path): Processing callback', { hasCode: !!code, hasTokenHash: !!token_hash, type });

  // Handle magic link (OTP) verification
  if (token_hash && type) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as 'email' | 'magiclink',
    });

    if (error) {
      console.error('Auth callback: Error verifying magic link:', error);
      return NextResponse.redirect(`${origin}/login?error=auth`);
    }

    const userEmail = data.session?.user?.email;

    if (!userEmail) {
      await supabase.auth.signOut();
      return NextResponse.redirect(`${origin}/login?error=no_email`);
    }

    // User mode always redirects to dashboard
    console.log('Auth callback (USER path): Magic link verified, redirecting to /dashboard');
    return NextResponse.redirect(`${origin}/dashboard`);
  }

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

    // Step 2: Check if superuser domain - bypass whitelist, auto-admin access
    if (isSuperuserDomain(userEmail)) {
      const { error: upsertError } = await adminClient.from('profiles').upsert(
        {
          id: data.session.user.id,
          email: userEmail.toLowerCase(),
          role: 'admin',
          full_name:
            data.session.user.user_metadata?.full_name ||
            data.session.user.user_metadata?.name ||
            null,
        },
        { onConflict: 'id' }
      );

      if (upsertError) {
        console.error('Error creating superuser profile:', upsertError);
      }
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

      // Step 5: Check if there's an existing profile with the same email (different auth provider)
      // and copy cohort_id to the new profile
      const { data: existingProfiles } = await adminClient
        .from('profiles')
        .select('id, cohort_id, role, full_name')
        .eq('email', userEmail.toLowerCase())
        .neq('id', data.session.user.id);

      if (existingProfiles && existingProfiles.length > 0) {
        const existingProfile = existingProfiles[0];
        if (existingProfile.cohort_id) {
          console.log('Auth callback: Found existing profile with cohort_id, copying to new profile');
          await adminClient
            .from('profiles')
            .update({
              cohort_id: existingProfile.cohort_id,
              role: existingProfile.role || 'student',
              full_name: existingProfile.full_name || data.session.user.user_metadata?.full_name || data.session.user.user_metadata?.name || null,
            })
            .eq('id', data.session.user.id);
        }
      } else {
        // Update profile with name from Google if not set
        await adminClient
          .from('profiles')
          .update({
            full_name: data.session.user.user_metadata?.full_name || data.session.user.user_metadata?.name || null,
          })
          .eq('id', data.session.user.id);
      }
    }

    // User mode always redirects to dashboard
    console.log('Auth callback (USER path): Redirecting to /dashboard');
    return NextResponse.redirect(`${origin}/dashboard`);
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
