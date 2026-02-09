# Production Audit & Bug Fix Design

**Date**: 2026-02-09
**Status**: Approved
**Model**: Claude Opus 4.6
**Goal**: Make the Rethink Dashboard production-ready for 80 students (Cohort 7)

---

## Context

The LMS has 29 pages, 90+ API routes, and 3 user roles (student, mentor, admin). Six known bugs have been reported through usage testing, and there are likely more undiscovered bugs. The goal is to systematically find, fix, and verify every bug before shipping to students.

---

## Known Bugs

| ID | Bug | Severity | Page | Category |
|----|-----|----------|------|----------|
| B1 | Cohort member count shows 71, should be ~76 | P1 | `/dashboard` | Data query |
| B2 | Sessions not visible in calendar for multi-cohort students | P0 | `/calendar` | Multi-cohort |
| B3 | Case studies not visible for multi-cohort students | P0 | `/learnings` | Multi-cohort |
| B4 | No attendance comparison — students only see own data | P1 | `/analytics` | Missing feature |
| B5 | Zoom meeting settings wrong (auto-record, auth required, no registration) | P2 | Zoom API | API config |
| B6 | Count mismatch between admin (26) and dashboard (71) | P1 | `/admin/users` + `/dashboard` | Data query |

**Root Cause Hypothesis**: B1, B2, B3, and B6 likely share a common root cause — student views only query data for the `activeCohortId` and/or use legacy `profiles.cohort_id` instead of `user_role_assignments`. Multi-cohort students can't access data from non-active cohorts.

**Design Decision**: Students should see data for their **active cohort only**, with easy switching between cohort-specific student roles via the existing role switcher.

---

## Methodology: The Verification Loop

For every flow we touch:

```
1. TRACE    — Read end-to-end: UI -> API -> DB query -> Response -> Rendering
2. DIAGNOSE — Does logic match reality? Edge cases: 0, 1, N cohorts/students?
3. FIX      — Implement correct logic. Scalable, not a hack.
4. VERIFY   — Build passes. Re-read changed code. Trace flow again.
5. RE-VERIFY — After ALL fixes in batch, re-read related flows for regressions.
6. DOCUMENT — Update PRODUCTION_AUDIT.md with findings, fixes, verification.
```

---

## Execution Plan

### Batch 1: Multi-Cohort Data Layer (B1, B2, B3, B6)

The root cause cluster. Fixes 4 bugs by correcting how data is queried for multi-cohort students.

| Step | Action | Verification |
|------|--------|-------------|
| 1a | Trace role switcher — does it show per-cohort student roles? | Read sidebar + useUser hook |
| 1b | Trace dashboard cohort member count query | Read dashboard page + API |
| 1c | Trace calendar session fetch — cohort filtering | Read calendar page + sessions API |
| 1d | Trace learnings/case studies fetch — cohort filtering | Read learnings page + case studies API |
| 1e | Fix all queries to use `user_role_assignments` + `activeCohortId` | Build passes |
| 1f | Re-verify: switching cohorts shows correct data | Trace all flows again |

### Batch 2: Attendance & Analytics (B4)

| Step | Action | Verification |
|------|--------|-------------|
| 2a | Trace attendance/analytics page data fetching | Read analytics page + API |
| 2b | Design comparison view (confirm with user) | User approval |
| 2c | Implement + verify | Build passes, flow traced |

### Batch 3: Zoom API Settings (B5)

| Step | Action | Verification |
|------|--------|-------------|
| 3a | Trace Zoom meeting creation API call | Read session creation + Zoom integration |
| 3b | Add correct Zoom settings in API call | Zoom API docs verified |
| 3c | Verify next meeting has correct settings | Manual test |

### Batch 4: Full Audit — Unknown Bug Discovery

| Step | Action | Verification |
|------|--------|-------------|
| 4a | 6 parallel subagents scan all 29 pages + 90 API routes | Bug reports generated |
| 4b | Triage discovered bugs by severity | Added to PRODUCTION_AUDIT.md |
| 4c | Fix all P0s and P1s | Build passes per fix |
| 4d | Final re-verification pass across all student-facing flows | Flow matrix 100% green |

### Batch 5: E2E Tests for Regression Prevention

| Step | Action | Verification |
|------|--------|-------------|
| 5a | Write Playwright tests for top 10 student flows | All tests pass |
| 5b | Write Playwright tests for top 5 admin flows | All tests pass |
| 5c | Document test coverage in PRODUCTION_AUDIT.md | Audit complete |

---

## Audit Agents (Batch 4)

| Agent | Scope | Focus |
|-------|-------|-------|
| Agent 1: Student Flows | 11 student pages + APIs | Data fetching, multi-cohort, empty/loading states, error handling |
| Agent 2: Admin Flows | 14 admin pages + APIs | CRUD, validation, edge cases, count queries |
| Agent 3: Mentor Flows | Mentor pages + APIs | RLS issues, data visibility, feedback |
| Agent 4: Auth & Middleware | Login, roles, middleware | Multi-role switching, redirects, protected routes |
| Agent 5: Data Integrity | All DB queries across APIs | Legacy vs new tables, query correctness |
| Agent 6: UX Quality | All pages vs CLAUDE.md standards | Mobile, dark mode, loading/empty states, accessibility |

---

## Progress Tracking

All progress tracked in `docs/PRODUCTION_AUDIT.md`:
- Bug Registry (known + discovered)
- Flow Verification Matrix
- Session Log
- Regression Tracker

---

## Success Criteria

- [ ] All 6 known bugs fixed and verified
- [ ] Full audit completed — all discovered P0/P1 bugs fixed
- [ ] Flow verification matrix: all student flows green
- [ ] E2E tests passing for critical flows
- [ ] Build passes with 0 TypeScript errors
- [ ] PRODUCTION_AUDIT.md fully documented
