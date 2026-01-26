# Cross-Cohort Resource Sharing - Testing Guide

## ✅ What Has Been Implemented

### Database Schema
- ✅ `cohort_module_links` junction table created
- ✅ `is_global` flag added to `learning_modules`
- ✅ Row-level security (RLS) policies updated
- ✅ Indexes for performance optimization
- ✅ Migration applied to Supabase

### API Routes
- ✅ `POST /api/admin/cohorts/[id]/link-modules` - Link modules to cohort
- ✅ `DELETE /api/admin/cohorts/[id]/link-modules` - Unlink modules
- ✅ `GET /api/admin/cohorts/[id]/stats` - Get resource statistics
- ✅ Updated learnings API to include linked modules

### Admin UI
- ✅ Cohort settings page with beautiful, intuitive interface
- ✅ Statistics dashboard (4 metrics: Total, Own, Linked, Global)
- ✅ Bulk copy interface with live preview
- ✅ Source selector (Global Library + Other Cohorts)
- ✅ Linked modules list with resource previews
- ✅ Unlink functionality with confirmation dialog
- ✅ Settings button added to cohorts table

### UX Enhancements
- ✅ Tooltips on all stat cards
- ✅ Color-coded badges (blue=own, green=linked, purple=global)
- ✅ Animated alerts that slide in
- ✅ Hover effects revealing actions
- ✅ Rich toast notifications
- ✅ Loading states everywhere
- ✅ Empty states with guidance
- ✅ Resource preview badges (video/slides icons)
- ✅ Confirmation dialogs with clear consequences

---

## 🧪 Testing Checklist

### 1. Database Migration
- [x] Migration applied via Supabase SQL Editor
- [ ] Verify table exists: `SELECT * FROM cohort_module_links LIMIT 1;`
- [ ] Verify column exists: `SELECT is_global FROM learning_modules LIMIT 1;`

### 2. Admin Navigation
**Steps:**
1. Login as admin
2. Go to `/admin/cohorts`
3. Click the "⋮" menu on any cohort
4. Click "Settings"

**Expected:** Should navigate to cohort settings page

### 3. Statistics Dashboard
**Steps:**
1. Open any cohort's settings page
2. View the 4 stat cards at the top

**Expected:**
- Total Modules: Sum of all accessible modules
- Own Modules: Modules created for this cohort (blue)
- Linked Modules: Modules shared from other cohorts (green)
- Global Modules: From global library (purple)
- Hover over icons to see tooltips

### 4. Bulk Copy - Select Source
**Steps:**
1. In cohort settings, click the source dropdown
2. Select another cohort

**Expected:**
- Dropdown shows "Global Library" option
- Shows list of other active cohorts with tags
- Preview alert appears showing how many modules will be linked
- Button text updates to show count: "Link X Modules to [Cohort Name]"

### 5. Bulk Copy - Link Modules
**Steps:**
1. Select a source cohort that has modules
2. Click "Link X Modules" button
3. Wait for completion

**Expected:**
- Button shows loading state: "Linking modules..."
- Success toast appears: "✓ Successfully linked X modules"
- Toast description: "Students in this cohort can now access these learning resources"
- Stats refresh automatically
- Linked modules appear in the list below
- Source selector resets

### 6. Bulk Copy - No Modules Available
**Steps:**
1. Select a cohort with no modules
2. Observe the UI

**Expected:**
- Amber alert appears: "No Modules Available"
- Message explains the cohort has no modules
- Button is disabled

### 7. Bulk Copy - Already Linked
**Steps:**
1. Select a cohort
2. Link all its modules
3. Try linking from the same cohort again

**Expected:**
- Info toast: "All modules from this source are already linked"
- No duplicate links created

### 8. Linked Modules List
**Steps:**
1. After linking modules, scroll to "Currently Linked Modules" section
2. Hover over a module row

**Expected:**
- Badge shows "Global" (purple) or "Linked" (green)
- Module title and resource count displayed
- Resource preview badges show first 3 resources with icons
- "+X more" badge if more than 3 resources
- Trash icon appears on hover

### 9. Unlink Module
**Steps:**
1. Hover over a linked module
2. Click the trash icon
3. Read the confirmation dialog
4. Click "Unlink Module"

**Expected:**
- Confirmation dialog appears with:
  - Warning icon
  - Module title in quotes
  - Amber box explaining consequences
  - Two buttons: "Cancel" and "Unlink Module"
- After confirming:
  - Success toast: "✓ Unlinked '[Module Title]' from [Cohort Name]"
  - Toast description: "Students in this cohort will no longer see this module"
  - Module disappears from list
  - Stats update

### 10. Student View (Critical!)
**Steps:**
1. Link modules to Cohort 7
2. Login as a student in Cohort 7
3. Go to `/learnings`

**Expected:**
- Student sees both own modules AND linked modules
- No visual difference - seamless experience
- Videos play correctly
- Student CANNOT see modules from cohorts they're not part of

### 11. Module Editing (Propagation Test)
**Steps:**
1. Link "Module A" from Cohort 6 to Cohort 7
2. As admin, edit "Module A" title in learnings page
3. Check both Cohort 6 and Cohort 7 learnings

**Expected:**
- Title updates in BOTH cohorts
- This proves resources are shared, not duplicated

### 12. Global Library (Future Feature)
**Steps:**
1. Create a module with `is_global = true` in database
2. Check multiple cohorts' settings pages

**Expected:**
- Global modules show in "Global Modules" stat
- Can be linked like normal modules
- Show purple "Global" badge

---

## 🎨 UI Quality Checks

### Visual Design
- [ ] Color scheme is consistent (blue/green/purple theme)
- [ ] Cards have subtle hover effects (shadow)
- [ ] Badges are properly color-coded
- [ ] Icons align with text properly
- [ ] Spacing is consistent throughout
- [ ] Responsive on mobile/tablet

### Microcopy
- [ ] All labels are clear and actionable
- [ ] Help text explains consequences
- [ ] Error messages are helpful
- [ ] Success messages celebrate achievement
- [ ] Empty states guide next actions

### Micro-interactions
- [ ] Alerts slide in smoothly
- [ ] Hover effects are subtle
- [ ] Loading spinners show during operations
- [ ] Toasts appear in top-right with descriptions
- [ ] Dialogs have backdrop blur
- [ ] Buttons disable during loading

### Accessibility
- [ ] All interactive elements are keyboard-accessible
- [ ] Tooltips appear on hover/focus
- [ ] Focus states are visible
- [ ] Color contrast meets WCAG standards

---

## 🐛 Edge Cases to Test

### 1. Empty States
- [ ] Cohort with 0 modules
- [ ] Cohort with only own modules
- [ ] Cohort with only linked modules
- [ ] No other cohorts available

### 2. Error Handling
- [ ] Network error during link operation
- [ ] Attempting to unlink non-existent module
- [ ] Attempting to link to non-existent cohort
- [ ] Invalid cohort ID in URL

### 3. Concurrent Operations
- [ ] Two admins linking modules simultaneously
- [ ] Linking while another admin is editing a module
- [ ] Unlinking while a student is viewing

### 4. Data Integrity
- [ ] Cannot create duplicate links (UNIQUE constraint)
- [ ] Deleting a module cascades to links
- [ ] Deleting a cohort cascades to links
- [ ] Linked modules maintain correct resource counts

---

## 📊 Performance Checks

### Page Load
- [ ] Settings page loads in < 2 seconds
- [ ] Stats API responds in < 500ms
- [ ] Module list loads smoothly with 50+ modules

### Database Queries
- [ ] Check query plans for index usage
- [ ] No N+1 queries in learnings API
- [ ] RLS policies don't cause performance degradation

---

## 🔒 Security Testing

### Row-Level Security
**Test 1: Student Cannot See Other Cohorts**
```sql
-- As student user in Cohort 7
SELECT * FROM learning_modules WHERE cohort_id = '[cohort-6-id]';
-- Expected: 0 rows (RLS blocks access)
```

**Test 2: Student Can See Linked Modules**
```sql
-- After linking Module X to Cohort 7
-- As student in Cohort 7
SELECT * FROM learning_modules WHERE id = '[module-x-id]';
-- Expected: 1 row (RLS allows via cohort_module_links)
```

**Test 3: Admin Can See Everything**
```sql
-- As admin user
SELECT * FROM learning_modules;
-- Expected: All modules (admin bypass)
```

### API Authorization
- [ ] Non-admin cannot access `/api/admin/cohorts/[id]/link-modules`
- [ ] Non-admin cannot access `/api/admin/cohorts/[id]/stats`
- [ ] Unauthenticated requests return 401

---

## 📸 Screenshots to Take

For documentation:
1. Cohorts table with "Settings" button visible
2. Empty cohort settings page (0 modules)
3. Statistics dashboard (4 cards)
4. Source selector dropdown open
5. Preview alert (green, showing ready to link)
6. Linked modules list with hover effect
7. Unlink confirmation dialog
8. Success toast notification
9. Student learnings page showing mixed modules

---

## ✅ Final Checklist

Before considering this feature complete:

- [ ] All API routes tested and working
- [ ] All UI components render correctly
- [ ] Database migration applied successfully
- [ ] RLS policies verified with real users
- [ ] Student experience is seamless
- [ ] Module editing propagates correctly
- [ ] No console errors in browser
- [ ] Mobile responsive
- [ ] Accessible via keyboard
- [ ] Code pushed to git
- [ ] Documentation updated

---

## 🚀 Next Steps (Future Enhancements)

### Phase 2 Features (Tomorrow - CDN Integration)
- [ ] Video CDN migration to Bunny.net
- [ ] Custom playback speed controls
- [ ] Video progress tracking
- [ ] Resume functionality
- [ ] Video.js player integration

### Phase 3 Features (Future)
- [ ] Selective module linking (checkboxes instead of bulk)
- [ ] Module preview before linking
- [ ] Bulk unlink functionality
- [ ] Link history/audit log page
- [ ] Notification when linked modules are updated
- [ ] "Create Global Module" button in learnings page
- [ ] Search/filter in linked modules list
- [ ] Export/import cohort configurations

---

## 📝 Known Limitations

1. **Global Library**: Currently needs manual database entry to create global modules. Need admin UI for this.
2. **Selective Linking**: Currently only supports "link all" - no checkbox selection yet.
3. **Link History**: No audit log UI to see who linked what when (data is stored, UI not built).
4. **Undo**: No "undo" button after linking - must manually unlink.

---

## 🎯 Success Metrics

This feature is successful if:
- ✅ Admins can set up a new cohort in < 2 minutes by copying existing content
- ✅ Content updates automatically propagate to all cohorts using it
- ✅ Students see no difference between own and linked modules
- ✅ No duplicate content storage
- ✅ Zero security vulnerabilities (RLS properly enforced)
- ✅ UI is intuitive enough that admins don't need documentation

---

## 🆘 Troubleshooting

### Issue: Stats showing 0 even after linking
**Fix:** Refresh the page. If still 0, check:
```sql
SELECT * FROM cohort_module_links WHERE cohort_id = '[your-cohort-id]';
```

### Issue: Students can't see linked modules
**Fix:** Check RLS policies:
```sql
SELECT * FROM pg_policies WHERE tablename IN ('learning_modules', 'module_resources', 'cohort_module_links');
```

### Issue: "Already linked" message but module not showing
**Fix:** Clear duplicate links:
```sql
DELETE FROM cohort_module_links
WHERE id NOT IN (
  SELECT MIN(id) FROM cohort_module_links
  GROUP BY cohort_id, module_id
);
```

### Issue: Slow page load
**Fix:** Check indexes exist:
```sql
SELECT * FROM pg_indexes WHERE tablename = 'cohort_module_links';
```

---

**Happy Testing! 🚀**

If you find any issues, check the console logs first, then verify the database state.
