import { createAdminClient } from '@/lib/supabase/server';

// Check if an email is whitelisted (invited by admin)
// A user is considered "invited" if they have:
// 1. A profile with cohort_id set (legacy system), OR
// 2. An entry in user_role_assignments table (new multi-role system)
//
// Note: Just having a profile is NOT enough because database triggers
// auto-create profiles on first OAuth login. We need to check for
// actual admin-assigned data.

export async function isEmailWhitelisted(email: string): Promise<{
  allowed: boolean;
  existsInProfiles: boolean;
  hasAssignment: boolean;
}> {
  const supabase = await createAdminClient();
  const normalizedEmail = email.toLowerCase().trim();

  // Check if user exists in profiles with cohort_id (legacy invite)
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, cohort_id')
    .eq('email', normalizedEmail)
    .maybeSingle();

  if (!profile) {
    // No profile at all - not invited
    return {
      allowed: false,
      existsInProfiles: false,
      hasAssignment: false,
    };
  }

  // Profile exists - check if they were actually invited
  // Option 1: Has cohort_id in profiles (legacy system)
  if (profile.cohort_id) {
    return {
      allowed: true,
      existsInProfiles: true,
      hasAssignment: true,
    };
  }

  // Option 2: Has entry in user_role_assignments (new multi-role system)
  const { data: roleAssignment } = await supabase
    .from('user_role_assignments')
    .select('id')
    .eq('user_id', profile.id)
    .limit(1)
    .maybeSingle();

  if (roleAssignment) {
    return {
      allowed: true,
      existsInProfiles: true,
      hasAssignment: true,
    };
  }

  // Profile exists but no cohort_id and no role assignments
  // This means the profile was auto-created by trigger, not admin invite
  console.log(`Whitelist check failed for ${normalizedEmail}: Profile exists but no assignments`);
  return {
    allowed: false,
    existsInProfiles: true,
    hasAssignment: false,
  };
}
