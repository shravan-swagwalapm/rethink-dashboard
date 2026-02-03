import { createAdminClient } from '@/lib/supabase/server';

// Check if an email is whitelisted (exists in profiles table)
// Only whitelisted users (uploaded by admin) can login

export async function isEmailWhitelisted(email: string): Promise<{
  allowed: boolean;
  existsInProfiles: boolean;
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
    };
  }

  // Email not found in profiles - not allowed
  return {
    allowed: false,
    existsInProfiles: false,
  };
}
