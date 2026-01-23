import { createAdminClient } from '@/lib/supabase/server';

// Check if an email is whitelisted (exists in invites or profiles table)
// Only whitelisted users (uploaded/invited by admin) can login

export async function isEmailWhitelisted(email: string): Promise<{
  allowed: boolean;
  existsInProfiles: boolean;
  existsInInvites: boolean;
  inviteId?: string;
}> {
  const supabase = await createAdminClient();
  const normalizedEmail = email.toLowerCase().trim();

  // Check if user already exists in profiles
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', normalizedEmail)
    .single();

  if (profile) {
    return {
      allowed: true,
      existsInProfiles: true,
      existsInInvites: false,
    };
  }

  // Check if user exists in invites table (whitelist)
  const { data: invite } = await supabase
    .from('invites')
    .select('id, status')
    .eq('email', normalizedEmail)
    .single();

  if (invite) {
    return {
      allowed: true,
      existsInProfiles: false,
      existsInInvites: true,
      inviteId: invite.id,
    };
  }

  // Email not found in either table - not allowed
  return {
    allowed: false,
    existsInProfiles: false,
    existsInInvites: false,
  };
}

// Update invite status when user completes signup
export async function markInviteAsAccepted(inviteId: string): Promise<void> {
  const supabase = await createAdminClient();

  await supabase
    .from('invites')
    .update({
      status: 'accepted',
      accepted_at: new Date().toISOString()
    })
    .eq('id', inviteId);
}
