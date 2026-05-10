# Rethink Dashboard — Domain Context

> The domain language. Read this before reading code; nothing here should be a surprise.

## What this codebase is

The **Rethink Dashboard** (also called **the LMS** conversationally — same thing) is the web application backing the Rethink Systems cohort program. It handles Profiles, Cohorts, Sessions, learning content, attendance, case study submissions, and (planned) a RAG-powered chatbot for student Q&A.

Today it serves a single organization (Rethink Systems). The architecture must remain capable of extension to other educators in the future without rewriting the data model or core query paths.

## Domain entities

- **Profile** — a user. Has a phone number and/or Google identity. Belongs to zero or more Cohorts. Has zero or more Roles.
- **Role** — what a Profile is permitted to do. Canonical source: `user_role_assignments`. Legacy mirror: `profiles.role` (do not trust for permission decisions). Values include `student`, `mentor`, `admin`, `company_user`. The admin-equivalent set is `ADMIN_ROLES` / `isAdminRole()`.
- **Cohort** — a time-bounded group of Profiles taking the program together. The unit of content scoping. A Profile may belong to multiple Cohorts.
- **Session** — a scheduled live class. Belongs to one or more Cohorts via `session_cohorts` (always use this junction; `sessions.cohort_id` is legacy single-cohort).
- **LearningModule** — a curated unit of content (e.g. "Week 3 — Pricing"). Linked to Cohorts via `cohort_module_links`.
- **ModuleResource** — a video, document, or link inside a LearningModule.
- **CaseStudy** — a graded submission tied to a LearningModule. Has a `datetime` deadline (not `date`), optional grace period, attachments (files + links), and a review/scoring flow.
- **Attendance** — a Profile's presence at a Session, calculated from Zoom data. Always scoped via `session_cohorts` so multi-cohort Profiles don't see blended stats.
- **RSVP** — a Profile's stated intent to attend a Session.
- **ZoomMeeting** — a scheduled Zoom meeting. Has a stable `meeting.id` and per-instance `meeting.uuid` values (host reconnections create new uuids). Dedup by `meeting.id`, keep highest `participants_count`.

## Constraints

- **Single-tenant today, multi-tenant capable tomorrow.** Rethink Systems is the only tenant today. New seams must be shaped so adding an `org_id` scope later is a localized change, not a rewrite. Do not build multi-tenant infrastructure (org tables, billing, tenant onboarding) until a concrete second customer exists — but do not bake single-org assumptions into module interfaces.
- **Production database is shared with development.** `.env.local` points at production Supabase. Every mutation hits live data. Content tables that surface to students must have a `draft`/`published` status until a staging Supabase project exists.
- **Roles have two sources of truth (legacy debt).** `profiles.role` predates `user_role_assignments`. The latter is canonical; the former is partially synced. Permission decisions must read from the canonical source only.

## Synonyms

- **LMS** = **Rethink Dashboard** = **Cohort Dashboard** — same product. "LMS" is the conversational shorthand; the codebase uses "Rethink Dashboard."
