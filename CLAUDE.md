# CLAUDE.md — Rethink Dashboard

**Project**: Educational platform for cohort-based learning
**Stack**: Next.js 16 (App Router) · React 19 · TypeScript · Supabase · Tailwind CSS 4 · shadcn/ui
**Updated**: 2026-03-07

---

## Commands
```bash
npm run dev              # Dev server at localhost:3000
npm run build            # Production build (must pass before deploy)
npm run lint             # ESLint
npx playwright test      # E2E tests
```

---

## Critical Rules (Never Break These)

**Auth**:
- `/admin` is ONLY accessible via explicit "Sign in as Administrator" login — NEVER add nav links/buttons to /admin
- `user_role_assignments` is the source of truth for admin authority (per ADR-0003); `profiles.role` is no longer consulted in `verifyAdmin`
- Use `createAdminClient()` for cross-user queries and storage ops (server-side only)
- Use `createClient()` for user-scoped queries (subject to RLS)
- Phone format: always `+[code][number]` (e.g. `+919876543210`)
- OTP: 4-digit, 5-min expiry, 5 attempts max, rate limited 5/15min

**Multi-Role**:
- `user_role_assignments` table is source of truth (not legacy `profiles.role`)
- Single `/dashboard` route with role-based views — student/admin/mentor see different data
- Role switching: `window.location.reload()` (not router.refresh)
- `useUser()` via `UserContext` — single API call per page load

**Code**:
- Server Components by default — `'use client'` only when interactive
- OKLCH colors only — never hex
- Zod validation on all forms
- `lib/api/verify-admin.ts` for admin auth in all API routes
- `lib/api/sanitize.ts` before `.ilike()` or `.or()` filters (PostgREST injection prevention)
- Batch queries with `.in()` — never N+1
- Verify RLS is enabled in Supabase Dashboard after running migrations

**Deploy**:
- `npm run build` must pass, `npx playwright test` must pass
- Remove demo login bypass before production
- MSG91 template must be pre-approved

---

## Key Files
| File | Purpose |
|------|---------|
| `middleware.ts` | Auth guard (uses `isAdminRole()`) |
| `lib/api/verify-admin.ts` | Shared admin verification (all 26 routes) |
| `lib/api/responses.ts` | Standardized API responses |
| `lib/api/sanitize.ts` | Input sanitization |
| `contexts/user-context.tsx` | UserProvider (single API call per page) |
| `hooks/use-user.ts` | Auth state (`activeRole`, `switchRole()`, etc.) |
| `lib/supabase/server.ts` | `createClient()` + `createAdminClient()` |
| `lib/integrations/msg91-otp.ts` | OTP send/verify/resend |
| `lib/services/otp-rate-limiter.ts` | Rate limiting (fail-closed) |

---

## Design Iteration Rule

After any visual change, use Playwright MCP to screenshot and verify.
Never make >3 visual changes without a screenshot check.
When the user says "AI slop" — you've converged on generic defaults. Make a bolder choice.
Brand fonts: DM Sans + Space Grotesk — do not change. Read `DESIGN-SYSTEM.md` if it exists.

---

## Full Context in Obsidian

> For architecture details, past mistakes, decision history, code patterns, and brand guidelines:
> **Say "Read my vault for Rethink Dashboard"** → reads from `~/ProductBrain/Projects/Rethink Dashboard/`
