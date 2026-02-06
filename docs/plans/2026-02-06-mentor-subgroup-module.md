# PRD: Mentor & Subgroup Module

**Date**: 2026-02-06
**Status**: Design Complete — Ready for Implementation
**Author**: Shravan Tickoo + Claude

---

## 1. Overview

### Problem

Rethink's cohort-based learning model places 50-80 students in a single cohort. Students need personalized guidance beyond instructor-led sessions. Currently, the mentor-student relationship is loosely defined via a legacy `profiles.mentor_id` field with no structured feedback, subgroup organization, or visibility into mentor effectiveness.

### Solution

Introduce **Subgroups** as a first-class entity within cohorts. Each subgroup contains 8-12 students and is assigned one or more mentors. This creates a structured mentorship layer with:

- Clear mentor-student ownership via subgroups
- Bidirectional feedback (mentor-to-student and student-to-mentor)
- Attendance visibility scoped to a mentor's students
- A "My Subgroup" experience for students to see their mentor and peers

### Success Criteria

- Admin can create subgroups, assign students, and assign mentors in under 2 minutes per subgroup
- Students can view their subgroup (mentor + peers) with full profile details
- Mentors can give daily/weekly feedback with ratings to each student
- Students can give weekly feedback about their mentor
- Mentor feedback scores are visible at student-level and subgroup-level aggregates

---

## 2. User Roles & Permissions

### Roles Involved

| Role | Access | Key Actions |
|------|--------|-------------|
| **Admin** | `/admin` panel | Create subgroups, assign students, assign mentors, view all feedback |
| **Student** | `/dashboard` (student view) | View "My Subgroup", view mentor/peer profiles, give weekly mentor feedback, give per-session instructor feedback, view their own feedback from mentor |
| **Mentor** | `/dashboard` (mentor view) | View assigned subgroup(s), give daily/weekly student feedback, view attendance, view student feedback about themselves |

### Multi-Role Rules

- A user can be a **mentor for Cohort A** and a **student in Cohort B** (different cohorts only)
- **Hard block**: A user cannot hold both mentor and student roles for the **same cohort**. The Edit Roles dialog must validate this and show: *"Cannot assign mentor and student roles for the same cohort"*
- **External mentors**: Users created with only a mentor role (no student history). The UI must handle gracefully — no broken states if they lack student-related records (learnings progress, invoices, etc.)
- Role switching via the existing sidebar role switcher. Mentor view and student view are separate dashboard experiences based on `activeRole`.

---

## 3. Data Model

### New Tables

#### 3.1 `subgroups`

A named subdivision of a cohort.

```sql
CREATE TABLE subgroups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id UUID NOT NULL REFERENCES cohorts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(cohort_id, name)
);
```

**Constraints:**
- Name must be unique within a cohort
- Deleting a cohort cascades to delete all its subgroups

#### 3.2 `subgroup_members`

Students assigned to a subgroup.

```sql
CREATE TABLE subgroup_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subgroup_id UUID NOT NULL REFERENCES subgroups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(subgroup_id, user_id)
);
```

**Constraints:**
- A student can belong to only **one subgroup per cohort** (enforced at application level — query existing membership before insert)
- Deleting a subgroup removes all member assignments

#### 3.3 `subgroup_mentors`

Mentors assigned to subgroups (many-to-many).

```sql
CREATE TABLE subgroup_mentors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subgroup_id UUID NOT NULL REFERENCES subgroups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(subgroup_id, user_id)
);
```

**Constraints:**
- A subgroup can have multiple mentors (typical: 1)
- A mentor can be assigned to multiple subgroups (minimum: 1)
- Only users with `role = 'mentor'` in `user_role_assignments` for the subgroup's cohort should be assignable

#### 3.4 `mentor_feedback`

Feedback given by mentors to individual students.

```sql
CREATE TABLE mentor_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id UUID NOT NULL REFERENCES profiles(id),
  student_id UUID NOT NULL REFERENCES profiles(id),
  subgroup_id UUID NOT NULL REFERENCES subgroups(id),
  type TEXT NOT NULL CHECK (type IN ('daily', 'weekly')),
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  week_number INTEGER,
  feedback_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(mentor_id, student_id, type, feedback_date)
);
```

**Constraints:**
- One daily feedback per mentor per student per day
- One weekly feedback per mentor per student per week (enforced via `week_number` + unique constraint at app level)
- Rating is required (1-5 scale), comment is optional but encouraged

#### 3.5 `student_feedback`

Feedback given by students about mentors and instructor sessions.

```sql
CREATE TABLE student_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES profiles(id),
  target_type TEXT NOT NULL CHECK (target_type IN ('mentor', 'session')),
  target_id UUID NOT NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  week_number INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(student_id, target_type, target_id, week_number)
);
```

**Constraints:**
- `target_type = 'mentor'`: `target_id` = mentor's `profiles.id`, `week_number` = which week
- `target_type = 'session'`: `target_id` = `sessions.id`, `week_number` nullable
- One feedback per student per target per week/session (no duplicates, but can update)

### RLS Policies

```sql
-- Students can read their own subgroup data
-- Students can read profiles of subgroup members
-- Students can write feedback (their own only)
-- Students can read their own received feedback
-- Mentors can read their assigned subgroup data
-- Mentors can write feedback for students in their subgroups
-- Mentors can read feedback about themselves
-- Admins have full access via createAdminClient()
```

### Entity Relationship Summary

```
cohorts
  └── subgroups (1:many)
        ├── subgroup_members (1:many) → profiles (students)
        └── subgroup_mentors (1:many) → profiles (mentors)

mentor_feedback
  mentor_id → profiles
  student_id → profiles
  subgroup_id → subgroups

student_feedback
  student_id → profiles
  target_id → profiles (mentor) OR sessions (session)
```

---

## 4. Admin View — Subgroup Management (`/admin/mentors`)

### 4.1 Page Structure

New admin page at `/admin/mentors` (or `/admin/subgroups`) with two main sections:

**Header:**
- Title: "Mentor & Subgroup Management"
- Cohort selector dropdown (filters everything below)

**Tab 1: Subgroups**
- Create, view, edit, delete subgroups for the selected cohort
- Assign/remove students to/from subgroups
- Assign/remove mentors to/from subgroups

**Tab 2: Feedback Overview**
- View all mentor → student feedback (filterable by subgroup, mentor, student)
- View all student → mentor feedback (filterable by subgroup, mentor)
- Aggregate ratings at subgroup level

### 4.2 Subgroups Tab — Detailed Spec

**Subgroup List View:**
- Card or table layout showing all subgroups in selected cohort
- Each subgroup card shows:
  - Subgroup name
  - Number of students (e.g., "10 students")
  - Assigned mentor(s) with avatar
  - Quick actions: Edit, Delete

**Create Subgroup Dialog:**
- Fields:
  - Name (text input, required)
  - Cohort (pre-filled from selector, read-only)
- Validation: Name unique within cohort

**Assign Students to Subgroup:**
- Multi-select student picker showing all students in the cohort who are NOT yet in a subgroup
- Students already assigned to another subgroup are shown as disabled with label "(Already in [Subgroup Name])"
- Drag-and-drop or checkbox selection
- Show student count badge: "8 of 10 selected (recommended: 8-12)"

**Assign Mentors to Subgroup:**
- Dropdown/multi-select showing all users with `role = 'mentor'` for this cohort
- Show mentor's name, email, and current subgroup assignments
- Typically select 1 mentor, but allow multiple

**Bulk Operations:**
- "Auto-create subgroups" — Admin enters a number (e.g., 6), system creates "Subgroup 1" through "Subgroup 6"
- "Auto-assign students" — Distributes unassigned students evenly across subgroups (random or alphabetical)

### 4.3 Feedback Overview Tab — Detailed Spec

**Mentor → Student Feedback Table:**
- Columns: Mentor, Student, Subgroup, Type (daily/weekly), Rating, Date, Comment (truncated)
- Filters: Subgroup dropdown, Mentor dropdown, Date range
- Export to Excel

**Student → Mentor Feedback Table:**
- Columns: Student, Mentor, Subgroup, Rating, Week, Comment (truncated)
- Filters: Subgroup dropdown, Mentor dropdown
- Aggregate view: Average rating per mentor per subgroup

**Mentor Effectiveness Summary:**
- Card per mentor showing:
  - Average student feedback rating (overall)
  - Feedback frequency (how often they give daily/weekly feedback)
  - Number of subgroups managed
  - Number of students under them

---

## 5. Student View — My Subgroup (`/dashboard/my-subgroup`)

### 5.1 Page Structure

New sidebar tab: **"My Subgroup"** in the `/dashboard` sidebar (visible only when student is assigned to a subgroup).

If student is **not assigned** to any subgroup, show an empty state: "You haven't been assigned to a subgroup yet. Your admin will assign you soon."

### 5.2 Page Layout

**Header Section:**
- Subgroup name (large, bold)
- Cohort name (subtitle)

**Mentor Section:**
- Mentor profile card(s):
  - Avatar / profile photo
  - Name (bold)
  - Role badge: "Mentor"
  - Clickable → opens **Profile Detail Modal/Sheet**

**Students Section:**
- Grid or list of fellow subgroup members (excluding self)
- Each student card:
  - Avatar / profile photo
  - Name
  - Clickable → opens **Profile Detail Modal/Sheet**

**Profile Detail Modal/Sheet** (shared for mentor and student clicks):
- Full-width sheet or modal showing:
  - Profile photo (large)
  - Full name
  - Email
  - Phone number
  - LinkedIn profile (clickable link)
  - Any other filled profile fields (company, bio, location, etc.)
  - Role badge
- Close button to dismiss

### 5.3 My Feedback Section

Below the subgroup directory, a section showing the student's own received feedback:

**From Mentor:**
- Timeline of daily/weekly feedback entries
- Each entry shows: Date, Type (daily/weekly), Rating (stars), Comment
- Filterable by type (daily/weekly) and date range

**My Feedback Given:**
- List of weekly mentor feedback the student has submitted
- Each entry shows: Week, Rating, Comment, Date submitted
- "Give Weekly Feedback" button (opens feedback form)

### 5.4 Give Mentor Feedback Flow

- Button: "Give Weekly Feedback" (visible once per week, or shows "Edit" if already submitted this week)
- Dialog/sheet with:
  - Mentor name (read-only, showing who you're rating)
  - Rating: 1-5 stars (required)
  - Comment: textarea (optional but encouraged)
  - Submit button
- After submission: toast "Feedback submitted!", entry appears in "My Feedback Given"
- If already submitted for current week: pre-fill the form for editing

### 5.5 Give Session Feedback Flow

- On the Sessions page or after attending a session, a "Rate this Session" prompt
- Dialog with:
  - Session name (read-only)
  - Rating: 1-5 stars
  - Comment: textarea
  - Submit button
- One feedback per session per student

---

## 6. Mentor View — Dashboard (`/dashboard` with `activeRole = mentor`)

### 6.1 Page Structure

When a user's active role is `mentor`, the `/dashboard` page shows the mentor-specific view. The sidebar shows mentor-specific tabs:

- **Dashboard** (overview/home)
- **My Subgroups** (manage assigned subgroups)
- **Feedback** (give and view feedback)
- **Attendance** (session attendance for their students)

### 6.2 Dashboard / Home

**Stats Cards Row:**
- Total students across all subgroups
- Average student attendance %
- Feedback given this week (daily + weekly count)
- Average rating received from students

**Subgroup Quick View:**
- Cards per subgroup showing:
  - Subgroup name
  - Student count
  - Average attendance
  - Latest feedback activity

### 6.3 My Subgroups Tab

**Subgroup List:**
- One card per assigned subgroup
- Clicking a subgroup shows:
  - Subgroup name
  - Student list with:
    - Avatar, name, email
    - Last feedback date
    - Attendance % badge
    - Quick action: "Give Feedback"

**Mentor Profile Section:**
- Shows mentor's own profile at the top
- Editable via existing profile page link

### 6.4 Feedback Tab

**Two sub-sections:**

**Give Feedback:**
- Student selector (dropdown or click from subgroup list)
- Toggle: Daily / Weekly
- Rating: 1-5 stars
- Comment: textarea
- Submit button
- After submit: toast + entry appears in history

**Feedback History:**
- Table showing all feedback given by this mentor
- Columns: Student, Subgroup, Type, Rating, Date, Comment (truncated)
- Filters: Subgroup, Student, Type (daily/weekly), Date range

**Feedback Received (from students):**
- Table showing all student feedback about this mentor
- Columns: Student, Subgroup, Rating, Week, Comment
- **Aggregate panel:**
  - Overall average rating
  - Per-subgroup average rating
  - Per-week trend (this week vs last week vs overall)
  - Per-student breakdown

### 6.5 Attendance Tab

Scoped version of the existing attendance page, filtered to the mentor's subgroup students only.

**Stats Cards:**
- Total students in subgroup(s)
- Average attendance across all sessions
- Students below 75% attendance (alert count)

**Session Attendance Table:**
- Session selector dropdown (past sessions)
- Table showing per-student attendance for selected session:
  - Student name
  - Join time, leave time, duration
  - Attendance % with color coding

**Cumulative Attendance Table:**
- All students across all sessions
- Columns: Student, Sessions attended / Total, Average %, Status badge
- Sortable by attendance %
- Highlight students below 75% in red

---

## 7. Feedback System — Complete Specification

### 7.1 Feedback Types

| Direction | Type | Frequency | Rating | Comment | Visibility |
|-----------|------|-----------|--------|---------|------------|
| Mentor → Student | Daily | Once per day per student | 1-5 (required) | Optional | Student only (private) |
| Mentor → Student | Weekly | Once per week per student | 1-5 (required) | Optional | Student only (private) |
| Student → Mentor | Weekly | Once per week per mentor | 1-5 (required) | Optional | Mentor + Admin |
| Student → Session | Per session | Once per session | 1-5 (required) | Optional | Instructor + Admin (future) |

### 7.2 Rating Scale

| Rating | Label | Color |
|--------|-------|-------|
| 1 | Needs Improvement | Red |
| 2 | Below Average | Orange |
| 3 | Average | Yellow |
| 4 | Good | Light Green |
| 5 | Excellent | Green |

### 7.3 Aggregate Computations

**Mentor effectiveness (visible to admin + mentor):**
- Average student → mentor rating per week
- Average student → mentor rating per subgroup
- Average student → mentor rating overall
- Feedback giving frequency: % of days/weeks where mentor submitted feedback

**Student progress (visible to mentor + student):**
- Average mentor → student rating per week
- Average mentor → student rating overall
- Rating trend (improving, stable, declining)

### 7.4 Privacy Rules

- A student can **only** see feedback about themselves (never other students' feedback)
- A mentor can see feedback they gave and feedback about themselves
- A mentor **cannot** see feedback other students gave about other mentors
- Admins can see everything
- Student → mentor feedback is **not anonymous** (mentor sees which student gave it)

---

## 8. API Routes

### New Routes

```
# Subgroup Management (Admin)
GET    /api/admin/subgroups?cohort_id=       — List subgroups for a cohort
POST   /api/admin/subgroups                  — Create subgroup
PUT    /api/admin/subgroups/[id]             — Update subgroup (rename)
DELETE /api/admin/subgroups/[id]             — Delete subgroup

# Subgroup Member Management (Admin)
POST   /api/admin/subgroups/[id]/members     — Assign students to subgroup
DELETE /api/admin/subgroups/[id]/members      — Remove students from subgroup
POST   /api/admin/subgroups/[id]/mentors     — Assign mentor to subgroup
DELETE /api/admin/subgroups/[id]/mentors      — Remove mentor from subgroup

# Bulk Operations (Admin)
POST   /api/admin/subgroups/bulk-create      — Auto-create N subgroups
POST   /api/admin/subgroups/auto-assign      — Distribute students evenly

# Subgroup Data (Student/Mentor — RLS protected)
GET    /api/subgroups/my-subgroup            — Student's subgroup + mentor + peers
GET    /api/subgroups/mentor-subgroups       — Mentor's assigned subgroups + students

# Mentor Feedback (Mentor gives)
GET    /api/feedback/mentor?student_id=&type= — List feedback given by mentor
POST   /api/feedback/mentor                   — Submit daily/weekly feedback
PUT    /api/feedback/mentor/[id]              — Edit feedback

# Student Feedback (Student gives)
GET    /api/feedback/student?target_type=     — List feedback given by student
POST   /api/feedback/student                  — Submit mentor/session feedback
PUT    /api/feedback/student/[id]             — Edit feedback

# Feedback Aggregates
GET    /api/feedback/mentor-ratings?mentor_id= — Aggregate ratings for a mentor
GET    /api/feedback/student-ratings?student_id= — Aggregate ratings for a student

# Admin Feedback Overview
GET    /api/admin/feedback?type=&cohort_id=   — All feedback (admin view)
GET    /api/admin/feedback/export              — Export feedback to Excel
```

### Existing Routes Modified

```
# Role assignment validation
PUT /api/admin/users  — Add validation: block mentor + student for same cohort

# Attendance (scoped for mentors)
GET /api/attendance    — Add subgroup_id filter parameter for mentor view
```

---

## 9. Validation Rules

### Role Assignment
- **BLOCK**: Assigning mentor + student roles for the same cohort_id
- Error message: "Cannot assign mentor and student roles for the same cohort"
- Enforced in: Edit Roles dialog (frontend) + `/api/admin/users` PUT handler (backend)

### Subgroup Membership
- A student can belong to only **one subgroup per cohort**
- Enforced in: `/api/admin/subgroups/[id]/members` POST handler
- Error message: "Student [name] is already assigned to [Subgroup Name]"

### Feedback Submission
- One daily mentor feedback per student per day (UNIQUE constraint)
- One weekly mentor feedback per student per week
- One weekly student-to-mentor feedback per week
- One student-to-session feedback per session
- Rating is always required (1-5), comment is optional

### Mentor Assignment
- Only users with `role = 'mentor'` in `user_role_assignments` for the subgroup's cohort can be assigned
- A mentor must be assigned to at least one subgroup (soft rule — no enforcement, but admin UI encourages it)

---

## 10. Edge Cases

### External Mentors
- Created with only mentor role (no student history)
- No learnings progress, no invoices, no cohort-specific student data
- My Subgroup and Mentor Dashboard must not break — conditional rendering for missing data
- Profile shows whatever fields are filled (name, email, phone, LinkedIn, photo)

### Mentor with Multiple Subgroups
- Mentor dashboard shows all subgroups as selectable cards/tabs
- Feedback is given per-subgroup (each feedback entry has `subgroup_id`)
- Attendance view supports subgroup filter

### Student Not Yet Assigned
- "My Subgroup" tab shows empty state: "You haven't been assigned to a subgroup yet."
- No errors, no hidden tabs — the tab is always visible with appropriate messaging

### Subgroup with No Mentor Yet
- Student sees subgroup members but mentor section shows: "A mentor will be assigned soon"
- Feedback giving is disabled until a mentor is assigned

### Mid-Cohort Reassignment
- Admin moves a student from Subgroup A to Subgroup B
- Historical feedback is preserved (linked to old subgroup_id)
- New feedback goes to new subgroup
- Student sees all their historical feedback regardless of subgroup

### Cohort Deletion
- Cascades to: subgroups → subgroup_members → subgroup_mentors
- Feedback records are orphaned (preserved for historical data but no longer navigable)
- Consider: soft-delete cohorts instead of hard-delete

---

## 11. UI Components (New)

### Shared Components
- `ProfileDetailSheet` — Reusable sheet/modal showing full profile (used by student + mentor views)
- `RatingStars` — 1-5 star input/display component
- `FeedbackCard` — Displays a single feedback entry (rating + comment + date)
- `SubgroupCard` — Displays subgroup summary (name, student count, mentor)

### Admin Components
- `SubgroupsTab` — Main subgroup management interface
- `FeedbackOverviewTab` — Admin feedback view with filters
- `AssignStudentsDialog` — Multi-select student picker
- `AssignMentorDialog` — Mentor selector
- `AutoCreateDialog` — Bulk subgroup creation
- `MentorEffectivenessCard` — Aggregate mentor metrics

### Student Components
- `MySubgroupPage` — Full "My Subgroup" page
- `MentorCard` — Clickable mentor profile card
- `PeerCard` — Clickable student profile card
- `GiveFeedbackDialog` — Weekly mentor feedback form
- `MyFeedbackTimeline` — Timeline of received feedback

### Mentor Components
- `MentorDashboard` — Overview with stats
- `SubgroupStudentList` — Students in a subgroup with actions
- `GiveStudentFeedbackDialog` — Daily/weekly feedback form
- `FeedbackReceivedPanel` — Student feedback about mentor (individual + aggregate)
- `MentorAttendanceView` — Scoped attendance page

---

## 12. Implementation Order

### Phase 1: Foundation (Database + Admin CRUD)
1. Create migration with 5 new tables + RLS policies
2. Add TypeScript types to `types/index.ts`
3. Build admin API routes for subgroup CRUD
4. Build admin page: Subgroups tab (create, assign students, assign mentors)
5. Add same-cohort mentor+student validation to Edit Roles dialog

### Phase 2: Student View
6. Build `/dashboard/my-subgroup` page
7. Build `ProfileDetailSheet` component
8. Build student feedback API routes
9. Build "Give Weekly Feedback" dialog
10. Add "My Subgroup" to sidebar (conditional on subgroup assignment)

### Phase 3: Mentor View
11. Build mentor dashboard layout (stats + subgroup cards)
12. Build mentor feedback API routes (give daily/weekly)
13. Build "Give Student Feedback" dialog
14. Build feedback received panel (individual + aggregate)
15. Build scoped attendance view

### Phase 4: Admin Feedback & Polish
16. Build admin Feedback Overview tab
17. Build mentor effectiveness metrics
18. Build feedback export to Excel
19. Add bulk operations (auto-create subgroups, auto-assign students)
20. Edge case handling + empty states

---

## 13. Files Summary

### New Files

```
# Database
supabase/migrations/0XX_subgroups_and_feedback.sql

# Admin
app/(admin)/admin/mentors/page.tsx
app/(admin)/admin/mentors/components/subgroups-tab.tsx
app/(admin)/admin/mentors/components/feedback-overview-tab.tsx
app/(admin)/admin/mentors/components/assign-students-dialog.tsx
app/(admin)/admin/mentors/components/assign-mentor-dialog.tsx
app/(admin)/admin/mentors/components/auto-create-dialog.tsx
app/(admin)/admin/mentors/components/mentor-effectiveness-card.tsx
app/(admin)/admin/mentors/types.ts

# Student
app/(dashboard)/my-subgroup/page.tsx
app/(dashboard)/my-subgroup/loading.tsx

# Mentor Dashboard
(Reuses /dashboard route with activeRole === 'mentor' conditional rendering)

# Shared Components
components/ui/rating-stars.tsx
components/ui/profile-detail-sheet.tsx
components/feedback/feedback-card.tsx
components/feedback/give-feedback-dialog.tsx
components/subgroup/subgroup-card.tsx

# API Routes
app/api/admin/subgroups/route.ts
app/api/admin/subgroups/[id]/route.ts
app/api/admin/subgroups/[id]/members/route.ts
app/api/admin/subgroups/[id]/mentors/route.ts
app/api/admin/subgroups/bulk-create/route.ts
app/api/admin/subgroups/auto-assign/route.ts
app/api/admin/feedback/route.ts
app/api/admin/feedback/export/route.ts
app/api/subgroups/my-subgroup/route.ts
app/api/subgroups/mentor-subgroups/route.ts
app/api/feedback/mentor/route.ts
app/api/feedback/mentor/[id]/route.ts
app/api/feedback/student/route.ts
app/api/feedback/student/[id]/route.ts
app/api/feedback/mentor-ratings/route.ts
app/api/feedback/student-ratings/route.ts
```

### Existing Files Modified

```
types/index.ts                                    — Add Subgroup, SubgroupMember, MentorFeedback, StudentFeedback types
app/(admin)/admin/users/components/edit-roles-dialog.tsx — Add same-cohort validation
app/api/admin/users/route.ts                      — Add same-cohort validation in PUT handler
app/(dashboard)/layout.tsx                         — Add "My Subgroup" sidebar item
app/(dashboard)/dashboard/page.tsx                 — Add mentor view conditional rendering
middleware.ts                                      — Allow mentor access to /dashboard/my-subgroup
```

---

*This PRD will be enhanced as we brainstorm mentor dashboard features and instructor feedback visibility in future sessions.*
