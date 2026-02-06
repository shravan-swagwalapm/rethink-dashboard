import { createClient, createAdminClient } from '@/lib/supabase/server';
import { isAdminRole, ADMIN_ROLES } from '@/lib/utils/auth';

/**
 * Result of admin verification.
 * Discriminated union: check `authorized` to narrow the type.
 */
export type VerifyAdminResult =
  | { authorized: true; userId: string; userEmail: string }
  | { authorized: false; error: string; status: number };

/**
 * Shared admin verification for all /api/admin/* routes.
 *
 * 1. Authenticates the user via Supabase session cookie
 * 2. Checks admin role using adminClient (bypasses RLS)
 * 3. Uses isAdminRole() which accepts: admin, super_admin, company_user
 *
 * Usage:
 *   const auth = await verifyAdmin();
 *   if (!auth.authorized) {
 *     return NextResponse.json({ error: auth.error }, { status: auth.status });
 *   }
 *   // auth.userId is now available
 */
export async function verifyAdmin(): Promise<VerifyAdminResult> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { authorized: false, error: 'Unauthorized', status: 401 };
  }

  // Use adminClient to bypass RLS for the role check
  const adminClient = await createAdminClient();

  // Check profiles.role first (legacy single-role field)
  const { data: profile } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role && isAdminRole(profile.role)) {
    return { authorized: true, userId: user.id, userEmail: user.email || '' };
  }

  // Fallback: check user_role_assignments for any admin-level role
  const { data: roleAssignment } = await adminClient
    .from('user_role_assignments')
    .select('role')
    .eq('user_id', user.id)
    .in('role', [...ADMIN_ROLES])
    .limit(1)
    .maybeSingle();

  if (roleAssignment) {
    return { authorized: true, userId: user.id, userEmail: user.email || '' };
  }

  return { authorized: false, error: 'Forbidden', status: 403 };
}
