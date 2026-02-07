# Attendance Analytics System — Design Document

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a complete attendance analytics system that imports Zoom meetings, calculates per-student attendance with smart deduplication, and surfaces data to admins, students, and mentors.

**Architecture:** Zoom API import → admin curation (assign cohort + toggle) → deduplication engine → attendance storage → role-based analytics views (admin/student/mentor).

**Tech Stack:** Next.js 16 App Router, Supabase (PostgreSQL), Zoom Server-to-Server OAuth (existing), Tailwind CSS, shadcn/ui components.

---

## 1. Data Flow Pipeline

### Stage 1: Import Meetings
- Admin clicks "Sync from Zoom" on the admin Analytics page
- System calls `ZoomService.listPastMeetings()` (already built) — pulls completed meetings from last 30 days
- Each meeting displayed with: title, date, actual duration, participant count
- Meetings already imported are marked as such (via `zoom_import_logs`)

### Stage 2: Assign & Toggle
- For each imported meeting, admin can:
  - **Assign to a cohort** (dropdown) — links meeting to a session/cohort
  - **Toggle "Counts for Students"** (on/off) — defaults OFF for imported meetings
- Meetings created via `/admin/sessions` are pre-linked and default ON
- Meetings not assigned or toggled OFF are invisible to students

### Stage 3: Calculate Attendance
- Admin clicks "Calculate Attendance" per meeting (or bulk)
- System runs the deduplication engine (Section 2 below)
- Results stored in `attendance` + `attendance_segments` tables

### Stage 4: Display
- Results flow to admin analytics, student analytics, and mentor analytics views
- Each view is role-appropriate (see Sections 4-6)

---

## 2. Edge Cases & Deduplication Engine

### Core Algorithm

The calculation engine lives in `/lib/services/attendance-calculator.ts` and handles all deduplication:

#### Edge Case 1: Student leaves and rejoins (same account, same device)
- Zoom API returns multiple participant entries with same `user_email`
- **Solution:** Group all entries by email. Each entry becomes an `attendance_segment`. Sum all segment durations for total time.

#### Edge Case 2: Student rejoins via a different email/account
- Zoom API returns entries under different emails (e.g., `john@gmail.com` and `john.doe@work.com`)
- **Solution:** After grouping by email, resolve each email through:
  1. `profiles.email` — direct match → get `user_id`
  2. `user_email_aliases.alias_email` — fallback match → get `user_id`
  3. If two different emails resolve to the **same `user_id`**, merge their segments
  4. If no match, store as unmatched (`user_id = null`) for admin to manually link

#### Edge Case 3: Student rejoins from different device (same account)
- Same email, different `participant_id` values
- **Solution:** Already handled by Edge Case 1 — grouping is by email, not `participant_id`

#### Edge Case 4: Overlapping segments (simultaneous devices)
- Two devices online at the same time = overlapping time ranges for same user
- **Solution:** After merging all segments for a user, run overlap merger:
  1. Sort segments by `join_time`
  2. Walk sequentially — if segment B starts before segment A ends, extend A's end to `max(A.end, B.end)`, discard B
  3. Sum merged (non-overlapping) segments for true attended time

#### Edge Case 5: Student still in meeting when it ends
- No explicit `leave` event for some participants
- **Solution:** For webhook: existing code handles this (`meeting.ended` event). For API import: if participant has no `leave_time`, use meeting's `end_time`.

#### Edge Case 6: Attendance > 100%
- Meeting runs over scheduled duration
- **Solution:** Use **actual meeting duration** from Zoom API (`end_time - start_time`), not scheduled `duration_minutes`. Cap at 100%.

#### Edge Case 7: Guest joins with display name only (no email)
- **Solution:** Store with `user_id = null`, `zoom_user_email = null`, display name preserved. Admin can manually match. Does not count toward any student until linked.

#### Edge Case 8: Duplicate import (admin clicks "Calculate" twice)
- **Solution:** Check if attendance records exist for this `session_id`. If yes, offer "Recalculate (overwrite)" or "Skip". Track in `zoom_import_logs`.

### Calculation Formula

```
attendance_% = min(100, (total_non_overlapping_minutes / actual_meeting_duration_minutes) * 100)
```

---

## 3. Admin UI — Analytics Page (`/admin/analytics`)

### Tab 1: Overview (default)
- **Stats cards** (real data):
  - Active Students (from `user_role_assignments` where role = student)
  - Avg Attendance % (across all counted sessions)
  - Sessions Completed (meetings with `counts_for_students = true`)
  - Unmatched Participants (entries with `user_id = null` — nudges admin to resolve)
- **Attendance Trends chart** — line chart showing avg attendance % per session over time
- **Cohort filter dropdown** — filters everything on the page
- **Export Report button** — downloads Excel with per-student attendance breakdown

### Tab 2: Meetings Manager
- **"Sync from Zoom" button** — fetches past meetings (last 30 days)
- **Meeting list table**:
  - Columns: Meeting title | Date | Duration (actual) | Participants | Cohort (dropdown) | Counts for Students (toggle) | Status
  - Sessions-created meetings: pre-linked to cohort, toggle ON
  - Imported Zoom-only meetings: toggle OFF, cohort unassigned
- **"Calculate Attendance" button** per meeting
- **Bulk actions**: Assign all to cohort, Enable all, Calculate all
- Color coding: green = calculated, yellow = imported not calculated, gray = excluded

### Tab 3: Student Attendance
- Per-student table (filterable by cohort)
- Columns: Student Name | Sessions Attended | Sessions Total | Avg Attendance % | Trend
- Click row → expands to per-session breakdown
- Each session: Title | Date | Minutes attended | Attendance % | Join count

---

## 4. Student Analytics View (`/analytics` — Student Role)

### Section 1: Attendance Summary
- **3 stat cards**:
  - Overall Attendance % (color-coded: green >75%, yellow 50-75%, red <50%)
  - Sessions Attended ("8 / 12 sessions")
  - Total Hours (total minutes converted)
- **Attendance trend chart** — line/area chart of their % per session over time

### Section 2: Session-by-Session Breakdown
- Card list (newest first), each card shows:
  - Session title + date
  - Attendance % (color-coded badge)
  - Time attended: "42 / 60 min"
  - Login count: "3 joins"
  - **Collapsible segment timeline** (click "Show details"):
    ```
    Join 1:  10:02 AM — 10:28 AM  (26 min)
    Join 2:  10:31 AM — 10:45 AM  (14 min)
    Join 3:  10:48 AM — 10:50 AM  (2 min)
    ```
- Only shows sessions admin toggled ON for their cohort
- Empty state: "No attendance data yet. Attend your first session to see your stats here."

---

## 5. Mentor Analytics View (`/analytics` — Mentor Role)

### Section 1: Team Overview
- **3 stat cards**:
  - Team Avg Attendance %
  - Students At Risk (below 50%)
  - Team Size (assigned students)

### Section 2: Student Attendance Table
- Columns: Student Name | Overall % | Last Session % | Sessions Attended | Trend
- Color-coded rows: green >75%, yellow 50-75%, red <50%
- Click row → expands to per-session breakdown (same segment cards as student view)
- **Sort by**: Name, Attendance %, Last session
- **Filter**: "At risk only" toggle

---

## 6. Technical Architecture

### Database Changes

**Modified table: `sessions`**
- Add column: `counts_for_students` (boolean, default false) — admin toggle
- Add column: `actual_duration_minutes` (integer, nullable) — from Zoom API

**Existing tables (no changes needed):**
- `attendance` — session_id, user_id, zoom_user_email, join_time, leave_time, duration_seconds, attendance_percentage
- `attendance_segments` — attendance_id, join_time, leave_time, duration_seconds
- `user_email_aliases` — user_id, alias_email
- `zoom_import_logs` — zoom_meeting_id, session_id, status, participants_imported

### New API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/admin/analytics/sync-zoom` | GET, POST | Fetch past meetings from Zoom API |
| `/api/admin/analytics/calculate-attendance` | POST | Run deduplication engine for a meeting |
| `/api/admin/analytics/stats` | GET | Aggregated stats (filterable by cohort) |
| `/api/admin/analytics/student-attendance` | GET | Per-student breakdown (admin/mentor) |
| `/api/analytics` | GET | Student's own attendance (auth-scoped) |

### New/Modified Files

| File | Action | Purpose |
|------|--------|---------|
| `lib/services/attendance-calculator.ts` | Create | Deduplication engine |
| `app/(admin)/admin/analytics/page.tsx` | Rebuild | 3-tab admin analytics |
| `app/(dashboard)/analytics/page.tsx` | Create | Student/mentor analytics |
| `supabase/migrations/021_attendance_analytics.sql` | Create | Schema changes |
| Sidebar navigation | Modify | Add Analytics to student sidebar |

### Calculation Engine (`lib/services/attendance-calculator.ts`)

```
fetchAndGroupParticipants(zoomMeetingId)
  → Zoom API call → group by email

resolveUserIds(participantGroups)
  → email → profiles.email match → user_email_aliases fallback
  → merge groups that resolve to same user_id

mergeOverlappingSegments(segments)
  → sort by join_time → walk & merge overlaps → return non-overlapping set

calculateAttendance(sessionId, meetingId)
  → orchestrator: fetch → group → resolve → merge → calculate % → store
```

### No Breaking Changes
- Existing webhook flow (`/api/attendance/webhook`) continues working untouched
- Calculation engine is a parallel path for imported/manual meetings
- All new features are additive
