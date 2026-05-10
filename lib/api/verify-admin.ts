import { createClient, createAdminClient } from '@/lib/supabase/server';
import { canAdmin, type PolicyContext } from '@/lib/auth/policy';

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
 * Stage 1 of ADR-0003: this is now a thin wrapper over `canAdmin` from
 * `lib/auth/policy.ts`. Source-of-truth for admin authority lives in
 * `user_role_assignments` only — the legacy `profiles.role` column is no
 * longer consulted here. See:
 *   - docs/adr/0003-cohort-scoped-policy-module.md §"Migration path" (Stage 1)
 *   - docs/adr/0003-cohort-scoped-policy-module.md §"Source of truth"
 *
 * 1. Authenticates the user via Supabase session cookie.
 * 2. Builds a PolicyContext from the auth user (UI `role` is unused for
 *    authorization — passed as `null` per ADR-0003 §"Trust boundary").
 * 3. Delegates the role decision to `canAdmin(ctx, adminClient)`.
 * 4. Maps the PolicyResult back to the existing VerifyAdminResult shape so
 *    the ~26 call sites compile and behave unchanged.
 *
 * Errors from `canAdmin` (e.g. Supabase outage) propagate; the route handler's
 * outer try/catch surfaces a 5xx rather than a misleading 403.
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

  const adminClient = await createAdminClient();
  const ctx: PolicyContext = {
    profile: { id: user.id, email: user.email ?? null },
    role: null,
  };

  const result = await canAdmin(ctx, adminClient);

  if (result.allowed) {
    return { authorized: true, userId: user.id, userEmail: user.email ?? '' };
  }

  // `profile_not_found` means the auth user we just resolved doesn't match a
  // known profile — treat as 401 (not authenticated as anyone we recognise).
  // Any other reason (`no_role`, etc.) means the user is authenticated but
  // lacks admin authority — 403.
  if (result.reason === 'profile_not_found') {
    return { authorized: false, error: 'Unauthorized', status: 401 };
  }

  return { authorized: false, error: 'Forbidden', status: 403 };
}
