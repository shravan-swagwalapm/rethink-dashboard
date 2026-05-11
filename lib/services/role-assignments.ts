/**
 * `user_role_assignments` replacement with app-level rollback.
 *
 * The legacy route handler did DELETE-then-INSERT without checking errors.
 * Under Stage 1's source-of-truth refactor (ADR-0003), a failed INSERT after
 * a successful DELETE leaves the user with zero role rows and produces a
 * permanent admin lockout — the `profiles.role` fallback that previously
 * masked this failure mode is gone.
 *
 * This service captures the caller's pre-state and re-inserts on INSERT
 * failure. Not truly atomic at the DB level (a Postgres function via RPC
 * would be), but the lockout-prevention contract holds.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export type AssignmentInput = {
  role: string;
  cohort_id: string | null;
};

export type ReplaceError =
  | { stage: 'delete'; message: string; cause: unknown }
  | { stage: 'insert'; message: string; cause: unknown }
  | {
      stage: 'rollback';
      message: string;
      cause: unknown;
      originalError: unknown;
    };

export type ReplaceResult =
  | { ok: true }
  | { ok: false; error: ReplaceError };

function errMessage(e: unknown): string {
  if (e && typeof e === 'object' && 'message' in e) {
    const m = (e as { message?: unknown }).message;
    if (typeof m === 'string') return m;
  }
  return String(e);
}

export async function replaceUserRoleAssignments(
  client: SupabaseClient,
  userId: string,
  newAssignments: AssignmentInput[],
  prevAssignments: AssignmentInput[],
): Promise<ReplaceResult> {
  const { error: deleteError } = await client
    .from('user_role_assignments')
    .delete()
    .eq('user_id', userId);

  if (deleteError) {
    return {
      ok: false,
      error: { stage: 'delete', message: errMessage(deleteError), cause: deleteError },
    };
  }

  if (newAssignments.length === 0) {
    return { ok: true };
  }

  const rowsToInsert = newAssignments.map((ra) => ({
    user_id: userId,
    role: ra.role,
    cohort_id: ra.cohort_id,
  }));

  const { error: insertError } = await client
    .from('user_role_assignments')
    .insert(rowsToInsert);

  if (!insertError) {
    return { ok: true };
  }

  if (prevAssignments.length === 0) {
    return {
      ok: false,
      error: { stage: 'insert', message: errMessage(insertError), cause: insertError },
    };
  }

  const rollbackRows = prevAssignments.map((ra) => ({
    user_id: userId,
    role: ra.role,
    cohort_id: ra.cohort_id,
  }));

  const { error: rollbackError } = await client
    .from('user_role_assignments')
    .insert(rollbackRows);

  if (rollbackError) {
    return {
      ok: false,
      error: {
        stage: 'rollback',
        message: errMessage(rollbackError),
        cause: rollbackError,
        originalError: insertError,
      },
    };
  }

  return {
    ok: false,
    error: { stage: 'insert', message: errMessage(insertError), cause: insertError },
  };
}
