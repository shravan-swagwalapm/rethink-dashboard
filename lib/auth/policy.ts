import type { SupabaseClient } from '@supabase/supabase-js';

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
 * STUB — implementation lands in T5. The real predicate must:
 * - Read ONLY from `user_role_assignments` (NEVER from `profiles.role`).
 * - Treat any matching admin row as global authority (system-wide or
 *   cohort-scoped). The `cohort_id` on an admin row records provenance, not
 *   restriction.
 * - Ignore `ctx.role` entirely.
 *
 * @throws Error always — this stub exists only so the T4 tests can fail
 *   loudly until T5 lands the implementation.
 */
export async function canAdmin(
  // The arguments are intentionally unused in the stub. Underscore-prefixed
  // names keep TS strict + noUnusedParameters quiet without changing the
  // public signature that T5 will fill in.
  _ctx: PolicyContext,
  _adminClient: SupabaseClient,
): Promise<PolicyResult> {
  throw new Error('canAdmin not yet implemented (T5)');
}
