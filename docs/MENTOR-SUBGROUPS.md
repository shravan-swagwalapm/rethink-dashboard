# Mentor Subgroup & Feedback System - Implementation Plan

**Project**: Rethink Dashboard
**Created**: 2026-02-03
**Estimated Effort**: 5-6 days across parallel workstreams

---

## Overview

Build a comprehensive mentor subgroup and feedback system enabling:
- **Admins**: Create named subgroups, assign students & mentors within cohorts
- **Mentors**: View assigned students, add session remarks & weekly feedback
- **Students**: See assigned mentor info, view feedback history

---

## Multi-Role System (Critical Context)

**Mentor is a ROLE** - same as student, admin, company_user. Uses the existing multi-role system:

### How Role Assignment Works
- Mentor role stored in `user_role_assignments` table (same as other roles)
- A user can have MULTIPLE roles: mentor for Cohort A + student for Cohort B
- `useUser()` hook provides: `isMentor`, `activeRole`, `availableRoles`, `switchRole()`

### Default Login Behavior
| User's Roles | Default View on Login |
|--------------|----------------------|
| Only mentor | Mentor dashboard view (no role switcher) |
| Mentor + Student | Shows role switcher, defaults to first role (can switch) |
| Mentor + Admin | Shows role switcher, defaults to first role |
| Student only | Student dashboard view |

### Dashboard Conditional Rendering
The `/dashboard` page already has conditional rendering:
```typescript
// Current pattern in dashboard/page.tsx
if (isAdmin) {
  return <AdminDashboardView />;  // System-wide stats
}
// Default: student view
return <StudentDashboardView />;  // Cohort-specific

// NEW: Add mentor check
if (isMentor) {
  return <MentorDashboardView />;  // Subgroup overview + quick actions
}
```

### Mentor Cannot Be Student in SAME Cohort
- Business rule: Mentor for Cohort X cannot be student in Cohort X
- CAN be: Mentor for Cohort X + Student for Cohort Y (different cohorts)
- Enforced via admin UI validation when assigning roles

---

## Requirements Summary (User Confirmed)

| Requirement | Decision |
|-------------|----------|
| Subgroup Creation | Named subgroups first (admin creates, then assigns students) |
| **Subgroup Names** | **Visible to admin, mentor, AND students** (e.g., "Alpha Squad") |
| Feedback Type | Both session remarks + weekly feedback |
| Student View | Dashboard card (shows group name + mentor) + dedicated /feedback page |
| Mentor View | Grouped by subgroup with individual feedback capability |
| Unassigned Students | Show in admin "Unassigned" section + students see "No mentor yet" |
| Feedback History | Current mentor only (not previous mentor's) |
| Admin UI Style | Table with checkboxes + "Move to Subgroup" dropdown |
| Notifications | None for now |

---

## Database Schema

### New Tables

```sql
-- 1. SUBGROUPS (container for student groups within a cohort)
CREATE TABLE subgroups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  cohort_id UUID NOT NULL REFERENCES cohorts(id) ON DELETE CASCADE,
  mentor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(name, cohort_id)
);

-- 2. SUBGROUP_MEMBERS (student-to-subgroup assignments)
CREATE TABLE subgroup_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subgroup_id UUID NOT NULL REFERENCES subgroups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  assigned_by UUID REFERENCES profiles(id),
  UNIQUE(user_id, subgroup_id)
);
-- Note: Trigger enforces ONE subgroup per student per cohort

-- 3. SESSION_REMARKS (quick notes after each session)
CREATE TABLE session_remarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  mentor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id, mentor_id, student_id)
);

-- 4. WEEKLY_FEEDBACK (comprehensive weekly summary)
CREATE TABLE weekly_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  cohort_id UUID NOT NULL REFERENCES cohorts(id) ON DELETE CASCADE,
  week_start_date DATE NOT NULL,
  content TEXT NOT NULL,
  strengths TEXT,
  areas_for_improvement TEXT,
  action_items TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(mentor_id, student_id, cohort_id, week_start_date)
);
```

### TypeScript Types (Add to `/types/index.ts`)

```typescript
export interface Subgroup {
  id: string;
  name: string;
  cohort_id: string;
  mentor_id: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
  mentor?: Profile;
  cohort?: Cohort;
}

export interface SubgroupMember {
  id: string;
  subgroup_id: string;
  user_id: string;
  assigned_at: string;
  user?: Profile;
}

export interface SessionRemark {
  id: string;
  session_id: string;
  mentor_id: string;
  student_id: string;
  content: string;
  created_at: string;
  session?: Session;
  mentor?: Profile;
}

export interface WeeklyFeedback {
  id: string;
  mentor_id: string;
  student_id: string;
  cohort_id: string;
  week_start_date: string;
  content: string;
  strengths: string | null;
  areas_for_improvement: string | null;
  action_items: string | null;
  created_at: string;
  mentor?: Profile;
}
```

---

## Parallel Workstreams

### Workstream A: Database & API Foundation (Ship First)
**Files to create**:
- `supabase/migrations/XXX_subgroups_and_feedback.sql`
- `app/api/admin/subgroups/route.ts` - CRUD for subgroups
- `app/api/admin/subgroups/[id]/members/route.ts` - Student assignments
- `app/api/admin/subgroups/[id]/mentor/route.ts` - Mentor assignment

### Workstream B: Admin UI (Depends on A)
**Files to create**:
- `app/(admin)/admin/cohorts/[id]/subgroups/page.tsx` - Main admin page
- `components/admin/subgroups/subgroup-create-dialog.tsx`
- `components/admin/subgroups/student-assignment-table.tsx`
- `components/admin/subgroups/unassigned-students-card.tsx`

### Workstream C: Mentor APIs (Parallel with B)
**Files to create**:
- `app/api/mentor/subgroups/route.ts` - Get mentor's subgroups
- `app/api/mentor/remarks/route.ts` - Session remarks CRUD
- `app/api/mentor/feedback/route.ts` - Weekly feedback CRUD

### Workstream D: Mentor Dashboard (Depends on C)
**Files to modify/create**:
- `app/(dashboard)/dashboard/page.tsx` - ADD mentor view (like admin view exists)
- `app/(dashboard)/team/page.tsx` - Enhance with subgroup tabs & feedback
- `components/mentor/mentor-dashboard-view.tsx` - Dashboard overview for mentors
- `components/mentor/subgroup-tabs.tsx`
- `components/mentor/session-remark-input.tsx`
- `components/mentor/weekly-feedback-dialog.tsx`

**Mentor Dashboard View** (new conditional in `/dashboard`):
- Shows subgroup overview cards (students count, pending feedback, attendance avg)
- Quick links to Team page, Attendance page
- Recent session remarks summary
- "Students needing attention" highlight (low attendance)

### Workstream E: Student View (Parallel with D)
**Files to create**:
- `app/(dashboard)/feedback/page.tsx` - New feedback history page
- `components/student/mentor-card.tsx` - Dashboard card
- Modify `app/(dashboard)/dashboard/page.tsx` - Add mentor card

---

## Critical Files to Modify

| File | Changes |
|------|---------|
| `/types/index.ts` | Add Subgroup, SubgroupMember, SessionRemark, WeeklyFeedback interfaces |
| `/app/(dashboard)/dashboard/page.tsx` | Add MENTOR VIEW (conditional like admin view) + "My Mentor" card for students |
| `/app/(dashboard)/team/page.tsx` | Add subgroup tabs, remark input, feedback dialog |
| `/components/dashboard/sidebar.tsx` | Add "Feedback" nav item for students (roles: ['student']) |

**Dashboard View Priority** (in order):
1. `isAdmin` → Admin view (system-wide stats)
2. `isMentor` → **NEW** Mentor view (subgroup overview)
3. Default → Student view (cohort-specific)

---

## API Specifications

### Admin APIs

```
GET    /api/admin/subgroups?cohort_id=xxx
       → { subgroups: [], unassigned_students: [], stats: {} }

POST   /api/admin/subgroups
       → { name, cohort_id, mentor_id?, description? }

PUT    /api/admin/subgroups
       → { id, name?, mentor_id?, description? }

DELETE /api/admin/subgroups?id=xxx

POST   /api/admin/subgroups/[id]/members
       → { user_ids: [] }

DELETE /api/admin/subgroups/[id]/members
       → { user_ids: [] }

PUT    /api/admin/subgroups/[id]/mentor
       → { mentor_id: string | null }
```

### Mentor APIs

```
GET    /api/mentor/subgroups
       → { subgroups: [{ ...subgroup, students: [], stats: {} }] }

GET    /api/mentor/remarks?session_id=&student_id=
POST   /api/mentor/remarks
       → { session_id, student_id, content }

GET    /api/mentor/feedback?student_id=&week_start_date=
POST   /api/mentor/feedback
       → { student_id, cohort_id, week_start_date, content, strengths?, areas?, action_items? }
```

### Student APIs

```
GET    /api/student/mentor
       → { mentor: Profile | null, subgroup: Subgroup | null, assigned: boolean }

GET    /api/student/feedback?type=all&limit=20&offset=0
       → { session_remarks: [], weekly_feedback: [], total: number }
```

---

## UI Mockups

### Admin: Subgroup Management (`/admin/cohorts/[id]/subgroups`)

```
┌─────────────────────────────────────────────────────────────┐
│ ← Back to Cohorts    Subgroup Management - [Cohort Name]    │
├─────────────────────────────────────────────────────────────┤
│ Stats: 4 Subgroups | 48 Assigned | 2 Unassigned             │
├─────────────────────────────┬───────────────────────────────┤
│ SUBGROUPS                   │ UNASSIGNED STUDENTS           │
│ ┌─────────────────────────┐ │ ┌─────────────────────────┐   │
│ │ Group A                 │ │ │ □ John Doe              │   │
│ │ Mentor: Jane Smith      │ │ │ □ Jane Smith            │   │
│ │ 12 students             │ │ └─────────────────────────┘   │
│ │ [Edit] [Delete]         │ │ [Move to Subgroup ▼]          │
│ └─────────────────────────┘ │                               │
│ [+ Create Subgroup]         │                               │
├─────────────────────────────┴───────────────────────────────┤
│ ALL STUDENTS                                                │
│ □ | Avatar | Name       | Email        | Subgroup   | ⋮     │
│ □ | 👤     | John Doe   | john@...     | Group A    | ⋮     │
│ 2 selected [Move to Subgroup ▼]                             │
└─────────────────────────────────────────────────────────────┘
```

### Mentor: Dashboard View (`/dashboard` when activeRole = 'mentor')

```
┌─────────────────────────────────────────────────────────────┐
│ Welcome back, Jane!                    [Role: Mentor ▼]     │
│ Here's your mentoring overview                              │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────┐ │
│ │ 12          │ │ 78%         │ │ 3           │ │ 5       │ │
│ │ Students    │ │ Avg Attend  │ │ Need Attn   │ │ Pending │ │
│ │ Assigned    │ │             │ │ (<75%)      │ │ Feedback│ │
│ └─────────────┘ └─────────────┘ └─────────────┘ └─────────┘ │
├─────────────────────────────────────────────────────────────┤
│ MY SUBGROUPS                                                │
│ ┌───────────────────────────────────────────────────────┐   │
│ │ Group A - Cohort: PM Batch 2026                       │   │
│ │ 12 students | Last feedback: 2 days ago               │   │
│ │ [View Team] [Add Weekly Feedback]                     │   │
│ └───────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│ STUDENTS NEEDING ATTENTION                                  │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 👤 John Doe      | 45% attendance | No feedback yet    │ │
│ │ 👤 Jane Smith    | 52% attendance | Last: 2 weeks ago  │ │
│ └─────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│ RECENT SESSION REMARKS                                      │
│ • "Good participation..." - John Doe (Week 5 Session)       │
│ • "Needs more practice..." - Sarah Lee (Week 5 Session)     │
│ [View All Remarks →]                                        │
└─────────────────────────────────────────────────────────────┘
```

**Key Features**:
- Stats cards showing mentoring KPIs
- Subgroup cards with quick actions
- "Students needing attention" highlight (low attendance or missing feedback)
- Recent remarks feed

---

### Mentor: Enhanced Team Page (`/team`)

```
┌─────────────────────────────────────────────────────────────┐
│ Team Management                           [Search...]        │
├─────────────────────────────────────────────────────────────┤
│ [Subgroup A] [Subgroup B]   ← Tabs (if multiple)            │
├─────────────────────────────────────────────────────────────┤
│ Stats: 12 Students | 78% Avg Attendance | 3 Below Target    │
├─────────────────────────────────────────────────────────────┤
│ ┌────────────────────────────────────────────────────────┐  │
│ │ 👤 John Doe                            [Give Feedback] │  │
│ │ john@example.com | 85% Attendance                      │  │
│ │ Last remark: 2 days ago                                │  │
│ │ ────────────────────────────────────────────────────── │  │
│ │ Quick Remark (Session: Week 5 - PM Fundamentals):      │  │
│ │ ┌────────────────────────────────────────────────────┐ │  │
│ │ │ Good participation today...                        │ │  │
│ │ └────────────────────────────────────────────────────┘ │  │
│ │                                              [Save]    │  │
│ └────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Student: Dashboard Mentor Card

```
┌─────────────────────────────────────────────────────────────┐
│ MY MENTOR & GROUP                                           │
├─────────────────────────────────────────────────────────────┤
│  ┌─────┐  Jane Smith (Mentor)                               │
│  │ 👤  │  jane.smith@company.com                            │
│  └─────┘  +91 98765 43210                                   │
│                                                             │
│  📋 Group: "Alpha Squad" (12 members)                       │
│                                                             │
│  [📧 Email] [📞 Call] [📅 Schedule]                         │
│                                                             │
│  View Feedback →                                            │
└─────────────────────────────────────────────────────────────┘
```

**Note**: Subgroup name is visible to students so they know which group they belong to.

### Student: Feedback Page (`/feedback`)

```
┌─────────────────────────────────────────────────────────────┐
│ My Feedback                                                 │
├─────────────────────────────────────────────────────────────┤
│ ┌─ WEEKLY FEEDBACK ─ Jan 27, 2026 ──────────────────────┐   │
│ │ Great progress this week! Strong problem-solving...   │   │
│ │ ✓ Strengths: Communication, analytical thinking       │   │
│ │ △ Improve: Time management during exercises           │   │
│ │ → Action: Practice 2 mock interviews this week        │   │
│ │                                    By Jane Smith      │   │
│ └────────────────────────────────────────────────────────┘  │
│                                                             │
│ ┌─ SESSION REMARK ─ Week 5: PM Fundamentals ─────────────┐  │
│ │ "Good questions during the case study discussion..."   │  │
│ └────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Order

1. **Day 1**: Database migration + TypeScript types
2. **Day 2**: Admin subgroup APIs + Mentor feedback APIs (parallel)
3. **Day 3**: Admin subgroup management page
4. **Day 4**: Mentor team page enhancements + feedback dialogs
5. **Day 5**: Student mentor card + feedback page
6. **Day 6**: Testing, polish, dark mode verification

---

## Verification Checklist

### Admin Flow
- [ ] Create subgroup with name in cohort
- [ ] Assign mentor to subgroup via dropdown
- [ ] Assign students via checkbox + "Move to Subgroup"
- [ ] View unassigned students section
- [ ] Move students between subgroups
- [ ] Delete subgroup (students become unassigned)

### Mentor Flow
- [ ] **Dashboard View**: Mentor sees mentor-specific dashboard (not student view)
- [ ] **Role Switching**: Mentor with multiple roles can switch via role switcher
- [ ] **Stats Cards**: Shows students assigned, avg attendance, pending feedback
- [ ] **Subgroup Overview**: See subgroup cards with quick actions
- [ ] **Team Page**: View assigned subgroups (tabs if multiple)
- [ ] Add session remark for student
- [ ] Create weekly feedback with all fields
- [ ] View feedback history per student
- [ ] Cannot see other mentors' subgroups

### Student Flow
- [ ] See "My Mentor" card on dashboard
- [ ] Access /feedback page from sidebar
- [ ] View session remarks chronologically
- [ ] View weekly feedback with all sections
- [ ] See "No mentor assigned yet" if unassigned

### Edge Cases
- [ ] **Mentor-only user**: Default view is mentor dashboard (no role switcher)
- [ ] **Mentor + Student**: Role switcher appears, can switch between views
- [ ] **Mentor + Admin**: Both roles work, can access /admin separately
- [ ] Mentor is student in different cohort (NOT same cohort)
- [ ] Student moved between subgroups (feedback preserved with original mentor)
- [ ] Subgroup deleted (feedback preserved, student becomes unassigned)
- [ ] Mentor reassigned (new mentor doesn't see old mentor's feedback)

---

## Key Patterns to Follow

1. **Admin API Pattern**: Use `verifyAdmin()` helper from `/api/admin/cohorts/route.ts`
2. **Dialog CRUD Pattern**: Copy from `/admin/users/page.tsx` (Dialog, form, toast)
3. **Table with Actions**: Copy checkbox + bulk action pattern from users page
4. **Access Control**: Use `isMentor && !isAdmin` pattern from `/team/page.tsx`
5. **Parallel Fetching**: Use `Promise.all()` for independent queries

---

## Files Reference

**Critical to read before implementing**:
- `/app/(admin)/admin/users/page.tsx` - Admin CRUD patterns (1476 lines)
- `/app/(dashboard)/team/page.tsx` - Mentor access patterns
- `/app/api/admin/cohorts/route.ts` - API route patterns
- `/hooks/use-user.ts` - Role checks (isMentor, isAdmin, activeCohortId)
- `/types/index.ts` - Add new interfaces here
