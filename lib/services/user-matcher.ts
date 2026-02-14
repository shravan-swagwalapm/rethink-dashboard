/**
 * User Matcher
 * Resolves Zoom participant emails to user IDs via profile lookup and email aliases.
 * Extracted to break circular dependency between attendance.ts and attendance-calculator.ts.
 */

import { createAdminClient } from '@/lib/supabase/server';

/**
 * Match a Zoom participant email to a user profile.
 * First tries direct email match, then checks email aliases.
 */
export async function matchParticipantToUser(email: string): Promise<string | null> {
  if (!email) return null;

  const supabase = await createAdminClient();
  const normalizedEmail = email.toLowerCase().trim();

  // First try direct match on profiles
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', normalizedEmail)
    .single();

  if (profile) return profile.id;

  // Try matching via email aliases
  const { data: alias } = await supabase
    .from('user_email_aliases')
    .select('user_id')
    .eq('alias_email', normalizedEmail)
    .single();

  return alias?.user_id || null;
}
