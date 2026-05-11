/**
 * Red-phase TDD tests for `replaceUserRoleAssignments` (F4 fix).
 *
 * Pins the atomicity contract for the DELETE-then-INSERT replacement of a
 * user's role assignments. Without rollback, a failed INSERT after a
 * successful DELETE would leave the user with zero rows in
 * `user_role_assignments` — under Stage 1's source-of-truth refactor, that's
 * a permanent admin lockout until DB-side repair. The service captures the
 * pre-state and re-inserts on INSERT failure.
 *
 * Tests:
 *   1. Happy path        — DELETE ok, INSERT ok → { ok: true }.
 *   2. DELETE fails      → { ok: false, error.stage: 'delete' }, no INSERT attempted.
 *   3. INSERT fails      → rollback re-inserts prev; returns error.stage: 'insert'.
 *   4. Rollback fails    → returns error.stage: 'rollback', both errors surfaced.
 *
 * All four expected to FAIL on this commit — implementation lands next.
 *
 * Globals (`describe`, `it`, `expect`, `vi`) from vitest.config.ts.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  replaceUserRoleAssignments,
  type AssignmentInput,
} from '@/lib/services/role-assignments';

type Op = 'delete' | 'insert';
type CannedResponse = { data?: unknown; error: unknown };
type ResponseSource = CannedResponse | (() => CannedResponse);

interface CallRecord {
  table: string;
  op: Op;
  args: unknown[];
}

function makeMockAdminClient(config: {
  responses: Record<string, Partial<Record<Op, ResponseSource>>>;
}): { client: SupabaseClient; calls: CallRecord[] } {
  const calls: CallRecord[] = [];

  function resolveResponse(table: string, op: Op): CannedResponse {
    const src = config.responses[table]?.[op];
    if (!src) return { data: null, error: null };
    return typeof src === 'function' ? src() : src;
  }

  function buildThenable(response: CannedResponse) {
    const builder: Record<string, unknown> = {};
    const passthrough = () => builder;
    builder.eq = passthrough;
    builder.in = passthrough;
    builder.select = passthrough;
    builder.is = passthrough;
    builder.then = (
      onFulfilled: (v: CannedResponse) => unknown,
      onRejected?: (e: unknown) => unknown,
    ) => Promise.resolve(response).then(onFulfilled, onRejected);
    return builder;
  }

  const fromSpy = vi.fn((table: string) => ({
    delete: (...args: unknown[]) => {
      calls.push({ table, op: 'delete', args });
      return buildThenable(resolveResponse(table, 'delete'));
    },
    insert: (...args: unknown[]) => {
      calls.push({ table, op: 'insert', args });
      return buildThenable(resolveResponse(table, 'insert'));
    },
  }));

  const client = { from: fromSpy } as unknown as SupabaseClient;
  return { client, calls };
}

describe('replaceUserRoleAssignments (F4 atomicity — red phase)', () => {
  const userId = 'user-1';
  const newAssignments: AssignmentInput[] = [
    { role: 'admin', cohort_id: null },
  ];
  const prevAssignments: AssignmentInput[] = [
    { role: 'student', cohort_id: 'cohort-A' },
  ];

  it('Test 1 — happy path: DELETE then INSERT returns ok', async () => {
    const mock = makeMockAdminClient({
      responses: {
        user_role_assignments: {
          delete: { error: null },
          insert: { error: null },
        },
      },
    });

    const result = await replaceUserRoleAssignments(
      mock.client,
      userId,
      newAssignments,
      prevAssignments,
    );

    expect(result).toEqual({ ok: true });

    const ops = mock.calls.filter((c) => c.table === 'user_role_assignments');
    expect(ops.map((c) => c.op)).toEqual(['delete', 'insert']);

    const insertCall = ops.find((c) => c.op === 'insert')!;
    expect(insertCall.args[0]).toEqual([
      { user_id: userId, role: 'admin', cohort_id: null },
    ]);
  });

  it('Test 2 — DELETE fails: returns error.stage=delete, no INSERT attempted', async () => {
    const deleteError = { message: 'permission denied' };
    const mock = makeMockAdminClient({
      responses: {
        user_role_assignments: {
          delete: { error: deleteError },
          insert: { error: null },
        },
      },
    });

    const result = await replaceUserRoleAssignments(
      mock.client,
      userId,
      newAssignments,
      prevAssignments,
    );

    expect(result).toMatchObject({
      ok: false,
      error: { stage: 'delete' },
    });

    const inserts = mock.calls.filter((c) => c.op === 'insert');
    expect(inserts).toHaveLength(0);
  });

  it('Test 3 — INSERT fails: rollback re-inserts prev, returns error.stage=insert', async () => {
    const insertError = { message: 'foreign key violation on cohort_id' };
    const insertQueue: CannedResponse[] = [
      { error: insertError },
      { error: null },
    ];
    const mock = makeMockAdminClient({
      responses: {
        user_role_assignments: {
          delete: { error: null },
          insert: () => insertQueue.shift() ?? { error: null },
        },
      },
    });

    const result = await replaceUserRoleAssignments(
      mock.client,
      userId,
      newAssignments,
      prevAssignments,
    );

    expect(result).toMatchObject({
      ok: false,
      error: { stage: 'insert' },
    });

    const inserts = mock.calls.filter((c) => c.op === 'insert');
    expect(inserts).toHaveLength(2);
    expect(inserts[1].args[0]).toEqual([
      { user_id: userId, role: 'student', cohort_id: 'cohort-A' },
    ]);
  });

  it('Test 4 — INSERT fails AND rollback fails: error.stage=rollback, both errors surfaced', async () => {
    const insertError = { message: 'foreign key violation on cohort_id' };
    const rollbackError = { message: 'unique constraint violation' };
    const insertQueue: CannedResponse[] = [
      { error: insertError },
      { error: rollbackError },
    ];
    const mock = makeMockAdminClient({
      responses: {
        user_role_assignments: {
          delete: { error: null },
          insert: () => insertQueue.shift() ?? { error: null },
        },
      },
    });

    const result = await replaceUserRoleAssignments(
      mock.client,
      userId,
      newAssignments,
      prevAssignments,
    );

    expect(result).toMatchObject({
      ok: false,
      error: {
        stage: 'rollback',
      },
    });

    expect(result).toMatchObject({
      ok: false,
      error: { message: expect.stringContaining('unique constraint violation') },
    });
    expect(result).toMatchObject({
      ok: false,
      error: { originalError: insertError },
    });
  });
});
