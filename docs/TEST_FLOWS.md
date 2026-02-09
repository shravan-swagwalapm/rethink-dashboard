# Test Flows — Production Audit Verification

**Use this checklist to verify all 21 fixes after deployment.**
**Tip**: Test with a multi-cohort student account (e.g., Kartik) for maximum coverage.

---

## Prerequisites

- [ ] Deployment is live (check Vercel dashboard)
- [ ] You have login credentials for: **1 multi-cohort student**, **1 mentor**, **1 admin**
- [ ] Note: RLS migration 022 must be applied to Supabase separately (see `supabase/migrations/022_fix_rls_multi_cohort.sql`)

---

## Flow 1: Student Dashboard (B1, B6, B4)

**Login as**: Multi-cohort student (e.g., Kartik)

1. [ ] Go to `/dashboard`
2. [ ] Check "Students in Cohort" count — should match the number of enrolled students in your active cohort
3. [ ] Check "Sessions" card — should show sessions for your active cohort only
4. [ ] Check "Attendance" card — should display **"Cohort avg: XX%"** as the subtitle
5. [ ] Switch cohort using the role switcher in the sidebar
6. [ ] Verify all counts update to reflect the new cohort

**Pass criteria**: Numbers match reality, cohort avg visible, switching works instantly.

---

## Flow 2: Role Switcher (B7)

**Login as**: Multi-cohort student

1. [ ] Look at the role switcher button in the sidebar
2. [ ] Verify it shows **"Student (Cohort Name)"** — not just "Student"
3. [ ] Click to expand — each option should show its cohort name
4. [ ] Switch to a different cohort
5. [ ] Verify the page reloads and all data reflects the new cohort

**Pass criteria**: Cohort name visible in switcher trigger and dropdown items.

---

## Flow 3: Calendar Sessions (B2)

**Login as**: Multi-cohort student

1. [ ] Go to `/calendar`
2. [ ] Verify sessions appear for your active cohort
3. [ ] Check that the session count matches what your admin sees
4. [ ] Click a session to RSVP — verify the RSVP dialog works
5. [ ] Switch cohort → verify calendar updates with different sessions

**Pass criteria**: All cohort sessions visible, RSVP works.

---

## Flow 4: Case Studies (B3)

**Login as**: Multi-cohort student

1. [ ] Go to `/learnings`
2. [ ] Scroll to the "Case Studies" section
3. [ ] Verify case studies are visible (they were previously hidden for multi-cohort students)
4. [ ] If your cohort is linked to another cohort's content, verify those shared case studies appear too
5. [ ] Switch cohort → case studies should change based on the new cohort's linking config

**Pass criteria**: Case studies visible for all cohorts, including linked/shared content.

---

## Flow 5: Analytics Leaderboard (B4)

**Login as**: Multi-cohort student

1. [ ] Go to `/analytics`
2. [ ] Scroll down to the **"Cohort Leaderboard"** section (below session history)
3. [ ] Verify the leaderboard table shows all students in your cohort
4. [ ] **Your row should be highlighted** (different background color, blue left border)
5. [ ] Use the **session filter dropdown** at the top of the leaderboard:
   - [ ] "Overall" — sorted by average attendance across all sessions
   - [ ] Select a specific session — sorted by that session's attendance %
6. [ ] Verify rank numbers update when switching filters

**Pass criteria**: Leaderboard visible, your row highlighted, session filter works, sorting correct.

---

## Flow 6: Profile Save (B10)

**Login as**: Multi-cohort student

1. [ ] Go to `/profile`
2. [ ] Note your current role badge (should show your **active role**, not just "student")
3. [ ] Edit your name or any field
4. [ ] Click Save
5. [ ] **After save**: Check the role switcher in the sidebar — it should still work (roles not lost)
6. [ ] Try switching roles after the save — should work without page refresh

**Pass criteria**: Profile saves successfully, role switcher still functional after save.

---

## Flow 7: Profile Role Badge (B17)

**Login as**: User with multiple roles (e.g., admin who is also a mentor)

1. [ ] Go to `/profile`
2. [ ] Check the role badge below your name
3. [ ] It should show your **currently active role** (e.g., "Admin" if you're in admin view)
4. [ ] Switch roles using the sidebar switcher
5. [ ] Go back to `/profile` — badge should now show the new role

**Pass criteria**: Badge reflects active role, not legacy profile.role.

---

## Flow 8: My Subgroup (B16)

**Login as**: Multi-cohort student who is in a subgroup

1. [ ] Go to `/my-subgroup`
2. [ ] Verify you see the correct subgroup for your active cohort
3. [ ] Check the mentor(s) listed are correct
4. [ ] Check the peer students listed are correct
5. [ ] Switch cohort → subgroup page should show the subgroup for the new cohort (or "No Subgroup Assigned" if none)

**Pass criteria**: Correct subgroup per cohort, switches properly.

---

## Flow 9: Attendance Page (B15)

**Login as**: Mentor

1. [ ] Go to `/attendance`
2. [ ] Verify you see sessions and attendance data for your active cohort
3. [ ] Check that the student list shows students from your cohort (not all students)
4. [ ] Switch cohort if you have multiple → attendance data should change

**Pass criteria**: Cohort-specific attendance data, correct student list.

---

## Flow 10: Team Page — Mentor View (B20)

**Login as**: Mentor

1. [ ] Go to `/team`
2. [ ] Verify you see students assigned to your subgroups (not zero)
3. [ ] Check "Total Students" count matches your actual subgroup members
4. [ ] Check "Avg Attendance" percentage is reasonable
5. [ ] Search for a student by name
6. [ ] Click the action menu (three dots) on a student → "View Attendance" should link to `/attendance?student=...`

**Pass criteria**: Students visible from subgroup system, not empty, search works.

---

## Flow 11: Mentor Route Access (B11, B12)

**Login as**: User with mentor role ONLY in user_role_assignments (not in legacy profiles.role)

1. [ ] Navigate to `/team` — should load (not redirect to `/dashboard`)
2. [ ] Navigate to `/attendance` — should load
3. [ ] Navigate to `/mentor/feedback` — should load

**Pass criteria**: All mentor routes accessible for new-system mentor roles.

---

## Flow 12: Admin Dashboard Stats (B13, B14)

**Login as**: Admin

1. [ ] Go to `/admin` dashboard
2. [ ] Check "Total Students" number — should count role assignments, not legacy profiles
3. [ ] Check "Total Mentors" number — same
4. [ ] Go to "Cohorts" tab
5. [ ] Check student count per cohort — should show only students (not mentors/admins in that cohort)

**Pass criteria**: Stats are accurate, cohort counts are students only.

---

## Flow 13: Admin Cohort Editing (B18)

**Login as**: Admin

1. [ ] Go to `/admin/cohorts`
2. [ ] Pick a cohort that has start/end dates set
3. [ ] Edit ONLY the cohort name (don't touch dates)
4. [ ] Save
5. [ ] Refresh and verify the start/end dates are still there (not wiped out)

**Pass criteria**: Dates preserved when only editing name/tag.

---

## Flow 14: Admin Route Access (B11)

**Login as**: User with admin role ONLY in user_role_assignments (not in legacy profiles.role)

1. [ ] Navigate to `/admin` — should load (not redirect to `/dashboard`)
2. [ ] Navigate to `/admin/users` — should work
3. [ ] Navigate to `/admin/cohorts` — should work

**Pass criteria**: Admin pages accessible for new-system admin roles.

---

## Flow 15: Invoice Download (B19)

**Login as**: Admin (preferably one whose legacy profiles.role is "student")

1. [ ] Go to `/admin/invoices` or find a student's invoice
2. [ ] Click Download on an invoice
3. [ ] Verify the PDF downloads successfully

**Also test as student**:
1. [ ] Login as student
2. [ ] Go to `/invoices`
3. [ ] Download your own invoice — should work
4. [ ] You should NOT be able to download another student's invoice

**Pass criteria**: Admin can download any invoice, students only their own.

---

## Flow 16: Zoom Meeting Settings (B5)

**Login as**: Admin

1. [ ] Go to `/admin/sessions`
2. [ ] Edit an existing session (change the title or time)
3. [ ] Save
4. [ ] Check the Zoom meeting settings in Zoom dashboard — cloud recording should still be enabled, mute-on-entry should still be on

**Pass criteria**: Zoom settings preserved after session edit. (Requires checking Zoom dashboard)

---

## Flow 17: Console.log Cleanup (B21)

**Test in any browser**:

1. [ ] Open browser Developer Tools (F12) → Console tab
2. [ ] Clear the console
3. [ ] Navigate through the app: dashboard, profile, learnings, resources
4. [ ] Watch for any `[VideoPlayer]`, `[ResourcePreview]`, `[UniversalViewer]`, or `handleSignOut` debug messages
5. [ ] Click Sign Out
6. [ ] There should be NO debug logs — only `console.error` messages if actual errors occur

**Pass criteria**: No debug noise in browser console.

---

## Quick Smoke Test (5 minutes)

If you're short on time, these 5 flows cover the most critical fixes:

1. **Dashboard** (Flow 1) — Verify counts and cohort avg
2. **Analytics leaderboard** (Flow 5) — Verify leaderboard table exists and your row is highlighted
3. **Role switcher** (Flow 2) — Verify cohort name shows, switching works
4. **Profile save** (Flow 6) — Save profile, verify roles survive
5. **Team page as mentor** (Flow 10) — Verify students appear from subgroups

---

## RLS Migration Reminder

The following migration needs to be applied to Supabase **before** testing Flows 3 and 4:

```sql
-- File: supabase/migrations/022_fix_rls_multi_cohort.sql
-- Updates RLS policies for: sessions, case_studies, rsvps
-- To use user_role_assignments instead of profiles.cohort_id
```

Run this in the Supabase SQL Editor or via `supabase db push`.

---

*Generated from the Production Audit (Batches 1-5). See `docs/PRODUCTION_AUDIT.md` for technical details and `docs/WHATS_CHANGED.md` for a non-tech summary.*
