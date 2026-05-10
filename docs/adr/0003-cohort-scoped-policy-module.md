# ADR 0003 — Cohort-scoped policy module via Strangler Fig migration

**Date**: 2026-05-10
**Status**: Accepted

## Context

The codebase has two sources of truth for Roles: the canonical `user_role_assignments(user_id, role, cohort_id)` table and a legacy `profiles.role` column that predates it. The existing extracted helper `lib/api/verify-admin.ts` reads `profiles.role` first and falls back to `user_role_assignments`, which inverts the canonical relationship and embeds the wrong invariant. It also answers the wrong question: "does this Profile have an admin role anywhere?" rather than "does this Profile have role X _in this Cohort_?"

The threat model recorded in ADR 0002 names (A) curious student and (B) malicious student as primary. Both attack classes exploit cohort-blind authorization: a Mentor of Cohort A reading Cohort B's data succeeds today because the system only checks "are you a Mentor?" not "are you a Mentor _of this Cohort_?"

Past Mistakes & Lessons #14, #16, #38, #43, #59, #62 are all instances of this bug class.

## Decision

Introduce `lib/auth/policy.ts` — a small set of named, pure-function predicates that answer cohort-scoped authorization questions over a `Context` value. The existing `verifyAdmin()` helper becomes a thin wrapper that delegates to `canAdmin(ctx)` so the 26+ admin-route call sites continue to compile unchanged during migration.

### Granularity (resolved Q6)

Predicates are **cohort-scoped**. The interface is a small set of named predicates:

- `canAdmin(ctx)` — system-wide admin role (cohort_id IS NULL).
- `canMentor(ctx, cohortId)` — mentor of a specific Cohort.
- `canSeeCohort(ctx, cohortId)` — any role legitimately scoped to a Cohort.
- `canEditAttendance(ctx, cohortId)` — admin or mentor of a Cohort.
- `canReviewCaseStudy(ctx, cohortId)` — admin or mentor of a Cohort.

Additional predicates added on demand. Each predicate is a pure function over `(Context, ...args) → Promise<PolicyResult>`. Capability-resolver and policy-engine alternatives were rejected as over-engineering for an LMS this size.

### Trust boundary (resolved Q7)

`activeRole` is a **UI display preference only**. The policy module never reads `activeRole` from `Context`, request headers, or any client-supplied source. Every predicate evaluates against `user_role_assignments` directly. The `availableRoles` list shown by the role-switcher is also computed fresh from the database on every page load, never from cached or client state.

### Source of truth

`user_role_assignments` is canonical. `profiles.role` is **not consulted by the new module**. The legacy column remains in place during migration; its eventual drop is gated on Infrastructure Backlog P0 (staging Supabase project) and is a follow-up to this ADR, not part of it.

### Migration path (resolved Q8)

Strangler Fig, four stages — each stage is one or a few small reviewable PRs:

| Stage | Work | Gate |
|---|---|---|
| **Stage 0** | Audit query confirms no Profile has admin role in `profiles.role` only. Backfill into `user_role_assignments` if drift exists. | Audit returns zero rows |
| **Stage 1** | Land `lib/auth/policy.ts` with `canAdmin` predicate. Rewrite `verifyAdmin` as wrapper: `verifyAdmin = ctx => canAdmin(ctx).then(r => r.allowed ? authorized : forbidden)`. Source-of-truth bug fixed inside the wrapper. No call-site changes. | All Q10 tests pass; existing Playwright sweep passes |
| **Stage 2** | Add cohort-scoped predicates. Migrate routes group-by-group from `verifyAdmin` to specific predicates. Each PR migrates a small, self-contained set of routes. | Each PR independently passes test surface |
| **Stage 3** | Drop `profiles.role`. Requires Infra P0 staging DB. | Staging DB exists; all callers migrated |

Stage 0 audit query (must return zero rows before Stage 1 ships):
```sql
SELECT id, email, role
FROM profiles
WHERE role IN ('admin', 'super_admin', 'company_user')
  AND id NOT IN (
    SELECT user_id FROM user_role_assignments
    WHERE role IN ('admin', 'super_admin', 'company_user')
  );
```

### Return shape (resolved Q9)

Discriminated union. Matches the existing `VerifyAdminResult` shape:

```ts
type PolicyResult =
  | { allowed: true }
  | { allowed: false; reason: PolicyDenialReason };

type PolicyDenialReason =
  | 'no_role'
  | 'wrong_cohort'
  | 'wrong_role_for_action'
  | 'profile_not_found'
  | 'context_invalid';
```

Boolean and exception-throwing alternatives rejected: boolean loses observability signal; exception-throwing mismatches the codebase's existing `{ data, error }` style (Past Mistakes #85).

### Context type

The `Context` value carries `{ profile, role }` today, with `orgId` reserved for the future per ADR 0001. The module reads only `profile.id` to query `user_role_assignments`. The `role` field exists for UI rendering decisions and is _not_ consulted by predicates.

### Test surface (resolved Q10)

Stage 1 ships only when all four pass:

1. **Unit tests** on every predicate with mocked Supabase responses, covering: empty result, system-wide admin match, cohort-scoped role match, wrong cohort, missing profile.
2. **Regression tests** pulled directly from Past Mistakes:
   - #14 — admin in `user_role_assignments` only (not `profiles.role`) → `canAdmin: allowed`.
   - Cross-cohort attack — Mentor of Cohort A requesting Cohort B → `{ allowed: false, reason: 'wrong_cohort' }`.
   - `activeRole` tampering — Context with mismatched `activeRole` → policy ignores it, denies based on DB.
3. **Existing Playwright admin route sweep** passes with no regressions.
4. **Stage 0 audit query** returns zero rows.

## Consequences

**Positive**

- Cross-cohort access leakage (the (A)+(B) primary threat surface from ADR 0002) becomes a hard fail at the policy layer, not a soft hope at the RLS layer.
- Past Mistakes #14, #16, #43 bug classes become regression-tested invariants rather than rules in CLAUDE.md.
- Migration is reversible at every Stage 2 PR boundary; blast radius is at most one route group per PR.
- The new module slots alongside `lib/api/verify-admin.ts`, `lib/api/responses.ts`, `lib/api/sanitize.ts` without re-prefixing.
- ADR 0001's `Context` parameter is honored — when tenancy arrives, `Context` gains `orgId` and predicates extend; signatures stay stable.

**Negative**

- Stage 3 (dropping `profiles.role`) is gated on Infrastructure Backlog P0; the legacy column lingers until staging DB exists.
- During Stage 2, the codebase has two authorization styles in flight (predicates for migrated routes, `verifyAdmin` for un-migrated). Mitigated by Stage 1's wrapper preserving identical behavior, and by a clear migration-status convention in PR descriptions.
- A Stage 1 deploy without Stage 0's audit gate would silently de-authorize any drift-affected admin Profile. The audit gate is non-negotiable.

## Alternatives considered

- **Keep `verifyAdmin` shape (option α from grilling)** — rejected: preserves the cohort-blind bug class.
- **Capability-resolver / policy-engine (option γ)** — rejected: over-engineering for ~6 distinct capabilities.
- **Big-bang migration** — rejected: 26+ admin routes failing simultaneously is unacceptable blast radius without staging DB.
- **Boolean return** — rejected: loses denial reasons needed for audit log and Sentry.
- **Throw-on-deny** — rejected: mismatches codebase's `{ data, error }` discipline (Past Mistakes #85).

## Revisit triggers

- Capability surface grows past ~12 distinct predicates → reconsider capability-resolver shape (option γ).
- Tenancy decision (ADR 0001) flips to multi-tenant SaaS → predicates extend to take `orgId`; this ADR remains structurally valid.
- Infrastructure Backlog P0 (staging DB) lands → Stage 3 unblocks; schedule the `profiles.role` drop.

## Related

- Domain: `/Users/shravantickoo/Downloads/rethink-dashboard/CONTEXT.md`
- Tenancy: ADR 0001
- Threat model: ADR 0002
- Infrastructure track: `~/ProductBrain/Projects/Rethink Dashboard/Infrastructure Backlog.md`
- Bug history: `~/ProductBrain/Projects/Rethink Dashboard/Past Mistakes & Lessons.md`
