# ADR 0001 — Tenancy optionality via a Context value, not via org_id columns

**Date**: 2026-05-10
**Status**: Accepted

## Context

The Rethink Dashboard serves a single organization (Rethink Systems) today. The owner wants to keep the option of extending it to other educators in the future, but there is no second customer in sight, no committed delivery model, and active competing priorities across other projects.

Three concrete future paths were considered:

1. **Multi-tenant SaaS** — one DB, `org_id` everywhere, operated centrally.
2. **White-label / deploy-per-tenant** — each org gets their own deployment and DB.
3. **Open-source template** — others self-install and self-operate.

Committing to any of these now would bake assumptions into the codebase that would be expensive to unwind if a different path turned out to be the right one. Committing to none of them risks shaping seams in ways that make future tenancy work expensive.

## Decision

We preserve optionality at the architecture level without paying for any specific delivery model.

Concretely:

- Every new module interface that scopes data, performs auth, or routes a request takes a **`Context`** value carrying `{ profile, role }` today.
- Future multi-tenancy adds `orgId` (or equivalent) to that one type and the modules that read it. It does **not** add `orgId` to call sites.
- We do **not** add `org_id` columns to tables today.
- We do **not** build org/billing/tenant onboarding infrastructure today.
- We do **not** hardcode `'rethink_systems'` or any other org identifier into business logic. Configuration that would naturally be per-org (branding, MSG91 keys, Resend keys) stays in environment configuration so that a future white-label path is also cheap.

## Consequences

**Positive**

- Refactor candidates (#1 query module, #2 request envelope, #3 role module) all naturally absorb a `Context` parameter, so the cost of preserving optionality is borne once, at refactor time, not later as a retrofit.
- A second customer arriving with concrete needs can be served by extending `Context` and a small set of modules, not by editing 600+ call sites.
- The decision can be reversed cheaply into any of (1)/(2)/(3) because the seams are shaped neutrally.

**Negative**

- Slightly more verbose interfaces than strictly necessary today (every named read takes a `Context` even though it currently only has `profile` and `role`).
- Risk of "optionality forever" — using this ADR as cover for never committing to a delivery model. Mitigated by treating the decision as good for ~12 months; if there is still no concrete second customer in 12 months, revisit whether tenancy needs to remain on the table at all.

## Alternatives considered

- **Commit to multi-tenant SaaS now.** Rejected: no customer in sight, would starve other projects in the portfolio.
- **Commit to white-label deploy-per-tenant.** Rejected: same reason, plus would require a deploy automation track that doesn't exist.
- **Ignore future tenancy entirely; refactor for single-org and worry about tenancy if it ever happens.** Rejected: the marginal cost of taking a `Context` parameter at refactor time is ~5%; the cost of retrofitting it later across 600+ call sites is multi-week. The asymmetry favors paying it now.
