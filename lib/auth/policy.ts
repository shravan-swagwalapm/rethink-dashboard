import type { SupabaseClient } from '@supabase/supabase-js';
import { ADMIN_ROLES } from '@/lib/utils/auth';

/**
 * Cohort-scoped policy module — Stage 1 surface.
 *
 * This file currently exposes the type contract from ADR-0003 and a stub
 * `canAdmin` predicate. The real implementation lands in T5; the stub exists
 * so the T4 red-phase tests can import the types and exercise a runtime
 * failure.
 *
 * See:
 * - docs/adr/0003-cohort-scoped-policy-module.md §"Return shape (resolved Q9)"
 * - docs/adr/0003-cohort-scoped-policy-module.md §"Trust boundary (resolved Q7)"
 * - docs/adr/0003-cohort-scoped-policy-module.md §"Test surface (resolved Q10)"
 */

/**
 * Reasons a policy predicate may deny an action.
 *
 * - `no_role`: The user exists but has no role grant matching the requested action.
 * - `wrong_cohort`: The user has the role, but it is scoped to a different cohort.
 * - `wrong_role_for_action`: The user has a role, but it lacks the required action.
 * - `profile_not_found`: The supplied context did not resolve to a known profile.
 * - `context_invalid`: The PolicyContext itself failed validation.
 */
export type PolicyDenialReason =
  | 'no_role'
  | 'wrong_cohort'
  | 'wrong_role_for_action'
  | 'profile_not_found'
  | 'context_invalid';

/**
 * Discriminated result returned by every policy predicate.
 * Callers must narrow on `allowed` before reading `reason`.
 */
export type PolicyResult =
  | { allowed: true }
  | { allowed: false; reason: PolicyDenialReason };

/**
 * Caller context handed to every predicate.
 *
 * IMPORTANT: `role` is a UI display preference (e.g. the localStorage
 * `activeRole` selection). It MUST NEVER be consulted by predicates for
 * authorization decisions. See ADR-0003 §"Trust boundary (resolved Q7)" and
 * Past Mistakes & Lessons #16 (`activeRole` tampering).
 */
export type PolicyContext = {
  profile: { id: string; email: string | null };
  /**
   * UI display preference only. NEVER consulted by predicates for authorization.
   * See ADR-0003 §"Trust boundary (resolved Q7)".
   */
  role: string | null;
  // Future: orgId for ADR-0001 multi-tenant readiness
};

/**
 * Predicate: does this user have admin authority?
 *
 * Source-of-truth invariant: admin authority is sourced exclusively from
 * `user_role_assignments`; the legacy `profiles.role` column and the
 * UI-supplied `ctx.role` are never consulted. Any matching admin row grants
 * system-wide authority — `cohort_id` on an admin row records provenance,
 * not restriction. See `docs/adr/0003-cohort-scoped-policy-module.md`
 * §"Source of truth", §"Granularity (resolved Q6)", §"Trust boundary
 * (resolved Q7)".
 */
export async function canAdmin(
  ctx: PolicyContext,
  adminClient: SupabaseClient,
): Promise<PolicyResult> {
  // Guard: invalid context must short-circuit before any DB call. The
  // verifyAdmin wrapper (T6) translates this to a 401-shaped response.
  if (!ctx.profile?.id) {
    return { allowed: false, reason: 'profile_not_found' };
  }

  const { data, error } = await adminClient
    .from('user_role_assignments')
    .select('role')
    .eq('user_id', ctx.profile.id)
    .in('role', [...ADMIN_ROLES]);

  if (error) {
    // Re-throw so the verifyAdmin wrapper (T6) can surface a 5xx with the
    // underlying Supabase error visible in logs. Swallowing here would mask
    // an outage as a 403 and produce confusing user-facing behavior.
    throw error;
  }

  // Defense-in-depth: trust but verify the PostgREST `.in(...)` filter. If
  // any returned row has an unexpected role (driver bug, test mock without
  // real filtering, or RLS policy drift), refuse to grant admin authority.
  const adminRoles: readonly string[] = ADMIN_ROLES;
  const hasAdminRow = (data ?? []).some(
    (row: { role?: unknown }) =>
      typeof row?.role === 'string' && adminRoles.includes(row.role),
  );

  if (hasAdminRow) {
    return { allowed: true };
  }

  return { allowed: false, reason: 'no_role' };
}
