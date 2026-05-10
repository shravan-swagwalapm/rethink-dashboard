# ADR 0002 — Threat model: curious and malicious student primary; targeted external descoped

**Date**: 2026-05-10
**Status**: Accepted

## Context

The Rethink Dashboard had no recorded threat model. "Secure" was used as an unscoped goal. Without an explicit model, every realistic security improvement would be in tension with every theoretical one, and effort would be allocated on instinct rather than priors.

The vault's `Past Mistakes & Lessons.md` contains the actual security-shaped incidents the system has produced. All recorded incidents are of the form "honest student or curious student notices the system trusts the wrong thing":

- #14 — admin role mismatch between `profiles.role` and `user_role_assignments`.
- #38 — RLS disabled despite migration defining it; cross-user reads possible.
- #43 — RSVP handlers used client-side `getClient()` with hardcoded `id: ''`.
- #59 — `case_studies` policies were `USING (true)`; all auth users could read everything.
- #62 — XSS via `javascript:` URLs in user-submitted link attachments.
- #93 — test CaseStudy records appeared on the live student `/learnings` page.

No incident has come from a sophisticated external attacker.

## Decision

We commit to the following priority cut:

| Priority | Attacker profile | Engineering response |
|---|---|---|
| **Primary** | (A) Curious student, (B) Malicious student | Engineer specifically. Server-side authorization, scope-aware queries, immutable graded artifacts, request validation. |
| **Table stakes** | (C) External casual attacker / scraper | Already largely paid for via existing hygiene (DOMPurify, OTP rate limiting, OAuth, `sanitizeFilterValue`). Remaining gap (request validation) absorbed by architecture-candidate #2. |
| **Detect, don't prevent** | (E) Compromised admin token, (F) Insider threat | Audit log + alerting (Infrastructure Backlog P0). Prevention is impractical; recoverability is achievable. |
| **Descoped** | (D) Targeted external attacker | We do not engineer specifically against this. Defense requires penetration testing and a security budget. No public attack surface beyond Supabase-managed OTP/OAuth. Revisit if a paying customer or a real incident materializes. |

## Consequences

**Positive**

- Effort is allocated against threats that have actually fired, not hypothetical ones.
- Architecture candidate ordering snaps to a clear sequence: #3 (role) → #1 (query) → #2 (request envelope) directly maps onto (A) → (A)+(B) → (B)+(C).
- (D) is named-and-descoped rather than secretly ignored.

**Negative**

- A future targeted external attack would find us underprepared. Mitigated by the fact that the public attack surface is small (login screen + Supabase + Vercel CDN) and revisitable when the cost-benefit changes.
- The detect-don't-prevent posture for insider threats depends on the Infrastructure Backlog P0 audit log landing. Until it lands, (E) and (F) are effectively unmitigated.

## Alternatives considered

- **Treat all six attacker profiles as primary.** Rejected: would force defense-in-depth investment with no budget and would dilute focus from the threats that have actually fired.
- **Default to "no threat model, just fix bugs as found."** Rejected: this is what produced the 12.5K Past Mistakes file. Reactive security is what we are exiting.
- **Elevate (E)/(F) to primary.** Rejected: insider threats are real but the right response is detection and recovery, not prevention via code architecture. The architecture engagement cannot meaningfully reduce insider risk; only the audit log can.

## Revisit triggers

- A second customer (productization) is on the hook → re-evaluate (D), likely needs a pentest.
- A real incident from any quadrant → reassess priority of that quadrant.
- The Infrastructure Backlog P0 audit log lands → upgrade (E)/(F) from "detect" to "detect + alert + investigate" as a posture.
