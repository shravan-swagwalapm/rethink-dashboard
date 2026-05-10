/**
 * Red-phase TDD tests for `canAdmin` (T4).
 *
 * These tests pin the contract from ADR-0003 §"Test surface (resolved Q10)":
 *   1. Empty user_role_assignments → no_role.
 *   2. System-wide admin row (cohort_id NULL) → allowed.
 *   3. Cohort-scoped admin row → allowed (admin authority is global).
 *   4. Missing profile.id in context → profile_not_found, no DB call.
 *   5. Past Mistakes #14 regression: profiles.role table is NEVER queried.
 *   6. activeRole tampering regression: ctx.role is NEVER read.
 *
 * All six are expected to FAIL on this commit — T5 lands the implementation
 * that makes them pass.
 *
 * Globals (`describe`, `it`, `expect`, `vi`) come from vitest.config.ts
 * (`test.globals = true`). No imports of those needed.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { canAdmin, type PolicyContext } from '@/lib/auth/policy';

// ---------------------------------------------------------------------------
// Test helpers — minimal Supabase admin-client mock.
//
// The real client exposes a chainable PostgREST-style builder
// (`.from(...).select(...).eq(...).in(...)`) whose terminal `.then` resolves to
// `{ data, error }`. We don't care about chain ORDER (T5 might put .eq before
// .in or vice versa) — only that the chain eventually resolves with the
// canned response.
// ---------------------------------------------------------------------------

type CannedResponse = { data: unknown; error: unknown };

interface ChainCall {
  method: string;
  args: unknown[];
}

interface MockResult {
  client: SupabaseClient;
  fromSpy: ReturnType<typeof vi.fn>;
  /**
   * Every chain call captured across every .from() invocation, in order.
   * Useful for asserting which columns were selected and which filters were applied.
   */
  chainCalls: ChainCall[];
  /** Tables that were ever passed to .from(). */
  tablesQueried(): string[];
}

/**
 * Build a minimal Supabase-shaped mock whose `.from(table)` returns a chainable
 * thenable yielding `responsesByTable[table]` (or a default empty result).
 */
function makeMockAdminClient(
  responsesByTable: Record<string, CannedResponse>,
): MockResult {
  const chainCalls: ChainCall[] = [];

  function buildBuilder(table: string) {
    const response: CannedResponse =
      responsesByTable[table] ?? { data: [], error: null };

    // Chainable builder. Every method returns `this`. The terminal awaits go
    // through `.then` (PostgREST builders are thenable). We also expose
    // `.maybeSingle()` and `.single()` so T5 can use those if it prefers —
    // they resolve the same canned response, narrowed for single-row.
    const builder: Record<string, unknown> = {};

    const passthrough = (method: string) =>
      (...args: unknown[]) => {
        chainCalls.push({ method, args });
        return builder;
      };

    builder.select = passthrough('select');
    builder.eq = passthrough('eq');
    builder.in = passthrough('in');
    builder.neq = passthrough('neq');
    builder.is = passthrough('is');
    builder.not = passthrough('not');
    builder.limit = passthrough('limit');
    builder.order = passthrough('order');

    builder.maybeSingle = (...args: unknown[]) => {
      chainCalls.push({ method: 'maybeSingle', args });
      const data = Array.isArray(response.data)
        ? (response.data[0] ?? null)
        : response.data;
      return Promise.resolve({ data, error: response.error });
    };
    builder.single = (...args: unknown[]) => {
      chainCalls.push({ method: 'single', args });
      const data = Array.isArray(response.data)
        ? (response.data[0] ?? null)
        : response.data;
      return Promise.resolve({ data, error: response.error });
    };

    // Make the builder thenable so `await builder` resolves to the canned
    // response (PostgREST builders behave this way).
    builder.then = (
      onFulfilled: (v: CannedResponse) => unknown,
      onRejected?: (e: unknown) => unknown,
    ) => Promise.resolve(response).then(onFulfilled, onRejected);

    return builder;
  }

  const fromSpy = vi.fn((table: string) => buildBuilder(table));

  // Diagnostic guard: `canAdmin` must read directly from
  // `user_role_assignments` per ADR-0003 §"Source of truth". If a future
  // implementation reaches for a Postgres function via `.rpc(...)`, fail loudly
  // with a message that points at the violated invariant — much clearer than
  // the default `client.rpc is not a function` TypeError.
  const rpcSpy = vi.fn(() => {
    throw new Error(
      'Mock guard: rpc unexpectedly called — canAdmin must read directly from user_role_assignments per ADR-0003 §"Source of truth"',
    );
  });

  const client = { from: fromSpy, rpc: rpcSpy } as unknown as SupabaseClient;

  return {
    client,
    fromSpy,
    chainCalls,
    tablesQueried() {
      return fromSpy.mock.calls.map((call) => call[0] as string);
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('canAdmin (red phase — T4)', () => {
  it('Test 1 — denies with no_role when user_role_assignments is empty', async () => {
    const mock = makeMockAdminClient({
      user_role_assignments: { data: [], error: null },
    });
    const ctx: PolicyContext = {
      profile: { id: 'user-1', email: 'a@b.com' },
      role: 'student',
    };

    const result = await canAdmin(ctx, mock.client);

    expect(result).toEqual({ allowed: false, reason: 'no_role' });
    expect(mock.tablesQueried()).toContain('user_role_assignments');
  });

  it('Test 2 — allows on system-wide admin row (cohort_id null)', async () => {
    const mock = makeMockAdminClient({
      user_role_assignments: {
        data: [{ user_id: 'user-1', role: 'admin', cohort_id: null }],
        error: null,
      },
    });
    const ctx: PolicyContext = {
      profile: { id: 'user-1', email: 'a@b.com' },
      role: 'student',
    };

    const result = await canAdmin(ctx, mock.client);

    expect(result).toEqual({ allowed: true });
  });

  it('Test 3 — allows on cohort-scoped admin row (admin authority is global)', async () => {
    const mock = makeMockAdminClient({
      user_role_assignments: {
        data: [{ user_id: 'user-1', role: 'admin', cohort_id: 'cohort-A' }],
        error: null,
      },
    });
    const ctx: PolicyContext = {
      profile: { id: 'user-1', email: 'a@b.com' },
      role: 'student',
    };

    const result = await canAdmin(ctx, mock.client);

    expect(result).toEqual({ allowed: true });
  });

  it('Test 4 — denies with profile_not_found and never calls the client when ctx.profile.id is empty', async () => {
    const mock = makeMockAdminClient({
      user_role_assignments: {
        // Should never be reached — assertion below.
        data: [{ user_id: 'should-not-matter', role: 'admin', cohort_id: null }],
        error: null,
      },
    });
    const ctx: PolicyContext = {
      profile: { id: '', email: null },
      role: null,
    };

    const result = await canAdmin(ctx, mock.client);

    expect(result).toEqual({ allowed: false, reason: 'profile_not_found' });
    // Critical: no DB call should be made when the context is invalid up front.
    expect(mock.fromSpy).not.toHaveBeenCalled();
    expect(mock.fromSpy.mock.calls.length).toBe(0);
  });

  it('Test 5 — Past Mistakes #14 regression: never queries profiles.role', async () => {
    const mock = makeMockAdminClient({
      user_role_assignments: {
        data: [{ user_id: 'user-14', role: 'admin', cohort_id: null }],
        error: null,
      },
      // Defensive: even if the implementation accidentally queries `profiles`,
      // we'd see it in tablesQueried() — but if it tries to read `.role` from
      // a row that doesn't exist, that'd still be a regression.
      profiles: { data: null, error: null },
    });
    const ctx: PolicyContext = {
      profile: { id: 'user-14', email: 'admin@example.com' },
      role: 'student', // Past Mistakes #14: profiles.role was wrong/stale
    };

    const result = await canAdmin(ctx, mock.client);

    expect(result).toEqual({ allowed: true });
    // The whole point of the cohort-scoped policy module: `profiles.role` is
    // dead. The new predicate must source authority exclusively from
    // `user_role_assignments`.
    expect(mock.tablesQueried()).not.toContain('profiles');
    expect(mock.tablesQueried()).toContain('user_role_assignments');

    // Defense against the embedded-select leak: PostgREST allows joining
    // through a foreign table inside the select string itself, e.g.
    // `.select('role, profiles!inner(role)')`. That call would never hit
    // `.from('profiles')`, so the check above wouldn't catch it — but it
    // would still violate ADR-0003's source-of-truth invariant. Inspect every
    // captured `.select(...)` argument and forbid any reference to `profiles`.
    const selectArgStrings = mock.chainCalls
      .filter((call) => call.method === 'select')
      .flatMap((call) => call.args.filter((a): a is string => typeof a === 'string'));
    for (const arg of selectArgStrings) {
      expect(arg).not.toContain('profiles');
    }
  });

  it('Test 6 — activeRole tampering regression: ctx.role is never read', async () => {
    const mock = makeMockAdminClient({
      user_role_assignments: {
        data: [{ user_id: 'user-6', role: 'student', cohort_id: 'cohort-X' }],
        error: null,
      },
    });

    // Tripwire: wrap ctx.role in a getter that flips a flag and throws if
    // ever read. If T5's implementation touches ctx.role, the test fails
    // with a clear message instead of silently passing on stale logic.
    let roleWasRead = false;
    const baseProfile = { id: 'user-6', email: 'tamper@x.com' };
    const ctx = {
      profile: baseProfile,
      get role() {
        roleWasRead = true;
        // Caller claims admin via tampered localStorage. Predicate MUST ignore.
        return 'admin';
      },
    } as unknown as PolicyContext;

    const result = await canAdmin(ctx, mock.client);

    // Student row exists but no admin row → no_role.
    expect(result).toEqual({ allowed: false, reason: 'no_role' });
    expect(roleWasRead).toBe(false);
  });
});
