# LMS Usage Analytics Dashboard — Design Document

**Date**: 2026-02-17
**Status**: Approved
**Location**: `/admin/usage` (new admin module)

---

## Problem

Admin has no visibility into how students use the LMS. No login tracking, no unified engagement view, and no way to identify at-risk students who have stopped engaging.

## Solution

A new admin module that tracks every login event, aggregates existing engagement data (videos, case studies, presentations, PDFs), and presents it across three levels: community-wide overview, cohort-level breakdown, and individual student detail — with color-coded health indicators.

---

## Database

### New Table: `login_events`

```sql
CREATE TABLE login_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  login_method TEXT NOT NULL,        -- 'otp' | 'google_oauth'
  ip_address TEXT,                   -- from request headers
  user_agent TEXT,                   -- browser/device info
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_login_events_user_id ON login_events(user_id);
CREATE INDEX idx_login_events_created_at ON login_events(created_at);
CREATE INDEX idx_login_events_user_date ON login_events(user_id, created_at);
```

- No RLS needed — only queried by admin routes via `createAdminClient()`
- Logged at two points: OTP verify success + OAuth callback success

### Existing Tables Queried (no changes)

| Table | Data Used |
|-------|-----------|
| `resource_progress` | Views, completions, last_viewed_at |
| `video_progress` | Watch percentage, completion status |
| `video_watch_history` | Session-level watch data |
| `resource_favorites` | Bookmarked resources |
| `module_resources` | Resource type (video/case_study/presentation/pdf), module association |
| `learning_modules` | Module names, week numbers |
| `cohorts` | Cohort names, student counts |
| `profiles` | Student names, emails, avatars |
| `user_role_assignments` | Cohort membership |
| `attendance` | Session attendance percentage |

---

## UI Design

### Page Structure

Single page `/admin/usage` with 3 tabs:

1. **Overview** — Community-wide aggregate stats
2. **Cohort View** — Cohort-level breakdown (default landing tab)
3. **Student Detail** — Individual student activity

### Shared Controls

- **Date Filter**: Today | This Week | This Month | Custom range
- Applied consistently across all tabs

### Tab 1: Overview

**Stat Cards Row**:
- Total Logins (with % change from previous period)
- Active Students (count / total)
- Avg Logins per Student
- Content Completion %

**Below Cards**:
- Cohort Leaderboard — ranked by engagement %
- Login Activity Chart — daily login trend (bar chart)
- Asset Engagement Summary — videos/cases/slides/PDFs (counts + %)

### Tab 2: Cohort View (Default)

**Controls**: Cohort selector dropdown + date filter

**Stat Cards Row**:
- Logins This Period
- Active Students (count / total in cohort)
- At-Risk Students (count, red highlight)
- Content Completion %

**Student Table** (sortable by any column):

| Column | Description |
|--------|-------------|
| Health Indicator | 🟢 🟡 🔴 dot |
| Name | Student name + avatar |
| Logins | Count in selected period |
| Last Login | Relative time (e.g., "2h ago", "3d ago") |
| Content Done % | Completion percentage |
| Status | Active / At-Risk / Inactive label |

**Health Status Logic**:
- **🟢 Active**: Logged in within 3 days AND >50% content completion
- **🟡 At-Risk**: Logged in within 7 days OR 30-50% completion
- **🔴 Inactive**: No login for 7+ days OR <30% completion

**Asset Breakdown** (per module):
- Module name → Videos X/Y | Cases X/Y | Slides X/Y | PDFs X/Y

### Tab 3: Student Detail

**Controls**: Student search/select dropdown + date filter

**Student Card**:
- Avatar, name, cohort
- Last login time, total login count
- Overall content completion %, health status

**Login History**: Chronological list with timestamp + method (OTP/Google)

**Content Engagement by Module**: Progress bars per module (count + %)

**Recent Activity Timeline**: Last 20 actions (watched video, opened case study, completed presentation, etc.)

---

## API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `POST /api/auth/login-event` | POST | Log a login event after successful auth |
| `GET /api/admin/usage/overview` | GET | Community-wide stats |
| `GET /api/admin/usage/cohort` | GET | Cohort-level student table + stats |
| `GET /api/admin/usage/student` | GET | Individual student activity detail |
| `GET /api/admin/usage/assets` | GET | Asset engagement breakdown per module |

### Query Parameters

All admin routes accept:
- `period`: `today` | `week` | `month` | `custom`
- `start_date` / `end_date`: For custom date range

Additional:
- `/cohort`: `cohort_id` (required)
- `/student`: `user_id` (required)
- `/assets`: `cohort_id` (optional, omit for community-wide)

### Data Aggregation

All queries use `createAdminClient()` (bypasses RLS):

- **Login counts**: `COUNT(*)` from `login_events` with date filters
- **Content completion**: `COUNT(is_completed=true) / COUNT(*)` from `resource_progress` joined with `module_resources`
- **Asset breakdown**: `resource_progress` joined with `module_resources.resource_type` grouped by type
- **Health status**: Computed server-side from last login timestamp + completion percentage
- **Date filtering**: `WHERE created_at >= period_start AND created_at <= period_end`

### Login Event Logging

Two insertion points:

1. **OTP verify** (`/api/auth/otp/verify/route.ts`): After successful `admin.generateLink()` → `INSERT INTO login_events`
2. **OAuth callback** (`/auth/callback/route.ts`): After successful `exchangeCodeForSession()` → `INSERT INTO login_events`

Both use `createAdminClient()` for the insert.

---

## Navigation

Add "Usage" nav item to admin sidebar (`app/(admin)/layout.tsx`):
- Icon: `Activity` from lucide-react
- Position: Between "Analytics" and "Support"
- Route: `/admin/usage`

---

## File Structure

```
app/(admin)/admin/usage/
├── page.tsx                          # Main page with tab orchestration
├── components/
│   ├── overview-tab.tsx              # Community-wide stats
│   ├── cohort-tab.tsx                # Cohort-level breakdown
│   ├── student-detail-tab.tsx        # Individual student view
│   ├── date-filter.tsx               # Shared date filter component
│   └── health-badge.tsx              # 🟢🟡🔴 status indicator
│
app/api/admin/usage/
├── overview/route.ts                 # Community stats endpoint
├── cohort/route.ts                   # Cohort stats endpoint
├── student/route.ts                  # Student detail endpoint
└── assets/route.ts                   # Asset breakdown endpoint

app/api/auth/
├── login-event/route.ts              # Login event logger (NEW)

supabase/migrations/
└── 024_login_events.sql              # New table migration
```

---

## Non-Goals (YAGNI)

- No page view tracking (only login events + content engagement)
- No automated email/SMS alerts for inactive students (v2)
- No export to Excel (v2)
- No real-time live updates (standard request/response)
- No time-spent analytics (only counts + completion %)
- No trend charts beyond simple bar charts (v2)

---

## Dependencies

- No new npm packages needed
- Uses existing shadcn/ui components (Tabs, Table, Card, Select, Badge, Progress)
- Uses existing `createAdminClient()` pattern
- Uses existing `verifyAdmin()` for route protection
