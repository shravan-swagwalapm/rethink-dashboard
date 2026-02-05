# 🚀 Resources System Rework - Deployment Checklist

**Branch:** `feature/resources-rework`
**Target:** `main` (production)
**Date:** 2026-02-05

---

## ✅ PRE-DEPLOYMENT CHECKLIST

### 1. Code Quality ✓
- [x] All TypeScript errors resolved
- [x] Build passes successfully (`npm run build`)
- [x] No console.errors in production code
- [x] All P0/P1 security issues fixed (Opus review)
- [x] Centralized auth utility created
- [x] DOMPurify sanitization implemented

### 2. Testing (MANUAL - DO BEFORE DEPLOYING)

#### Student View Testing (`/resources`)
- [ ] Navigate to `/resources` as a student
- [ ] **Videos Tab**
  - [ ] Videos with thumbnails display correctly
  - [ ] Videos without thumbnails show gradient fallback with title
  - [ ] Play button opens video in new tab
  - [ ] Duration badge shows correctly
  - [ ] Favorites button works (shows toast)
- [ ] **Articles Tab**
  - [ ] Articles display in list layout
  - [ ] External link icon shows
  - [ ] Click opens in new tab
- [ ] **Presentations Tab**
  - [ ] PPT files show with orange icon
  - [ ] "Open" button launches Office Online viewer
  - [ ] Download button works
  - [ ] File size displays correctly
- [ ] **PDFs Tab**
  - [ ] PDF files show with red icon
  - [ ] "Preview" button opens PDF viewer in modal
  - [ ] Page navigation works (prev/next)
  - [ ] Zoom controls work (50%-200%)
  - [ ] Download button works
  - [ ] File metadata shows (size, date)
- [ ] **Search**
  - [ ] Search within category works
  - [ ] Results update in real-time
  - [ ] "No results" message shows when appropriate
- [ ] **Global Library Logic**
  - [ ] If global resources exist for category, ONLY global shown
  - [ ] If no global resources, cohort-specific shown
  - [ ] Switch categories and verify logic holds

#### Admin View Testing (`/admin/resources`)
- [ ] Navigate to `/admin/resources` as an admin
- [ ] **Cohort Context Selector**
  - [ ] Cohorts dropdown populated
  - [ ] Selected cohort shows in header
  - [ ] Toggle "Global Mode" works
  - [ ] Visual indicator shows active state
- [ ] **Videos Tab - Bulk Upload**
  - [ ] Add 2-3 video links in multi-row form
  - [ ] "Add Another Video" button works
  - [ ] "Remove" button deletes row
  - [ ] Fill in: Title, URL, Thumbnail URL (optional), Duration
  - [ ] Click "Upload N Videos"
  - [ ] Toast shows success
  - [ ] Videos appear in table below
  - [ ] All tagged to selected cohort
- [ ] **Articles Tab - Bulk Upload**
  - [ ] Same as videos but with Title + URL only
  - [ ] Upload and verify in table
- [ ] **Presentations Tab - File Upload**
  - [ ] Drag & drop 2-3 PPT files
  - [ ] Files appear in upload queue
  - [ ] Progress bars show 0-100%
  - [ ] Success indicator shows when complete
  - [ ] Files appear in table
  - [ ] File size validation works (try >100MB file)
- [ ] **PDFs Tab - File Upload**
  - [ ] Same as presentations
  - [ ] Upload PDF and verify
- [ ] **Resources Table**
  - [ ] All resources show with correct icons
  - [ ] Cohort badges display
  - [ ] Pagination works (if >20 resources)
  - [ ] Search filter works
  - [ ] Cohort filter dropdown works
- [ ] **Single Resource Actions**
  - [ ] Click Edit icon → Modal opens
  - [ ] Edit name, URL, thumbnail → Save
  - [ ] Changes reflect in table
  - [ ] Click Delete icon → Confirmation appears
  - [ ] Confirm delete → Resource removed
  - [ ] File deleted from storage (check Supabase)
- [ ] **Bulk Actions**
  - [ ] Select 2-3 resources via checkboxes
  - [ ] Bulk actions bar appears (sticky)
  - [ ] Click "Move to Global" → Resources updated
  - [ ] Verify is_global = true in table
  - [ ] Select different resources
  - [ ] Click "Move to Cohort" → Dropdown shows
  - [ ] Select cohort → Resources moved
  - [ ] Click "Delete Selected" → Confirmation
  - [ ] Confirm → Resources deleted
  - [ ] Click "Export CSV" → File downloads
- [ ] **Mobile Responsive**
  - [ ] Test on mobile device or resize browser
  - [ ] Cohort selector works
  - [ ] Tabs scroll horizontally
  - [ ] Upload forms are usable
  - [ ] Table is scrollable

#### Document Viewers Testing
- [ ] **PDF Viewer**
  - [ ] Opens in modal
  - [ ] First page renders correctly
  - [ ] Next/Previous buttons work
  - [ ] Zoom in/out works
  - [ ] Download button works
  - [ ] Close button works
- [ ] **DOC Viewer**
  - [ ] Opens in modal
  - [ ] DOCX converts to HTML
  - [ ] Text formatting preserved
  - [ ] No XSS vulnerabilities (try malicious file if possible)
  - [ ] Download button works
- [ ] **PPT Viewer**
  - [ ] Opens in modal
  - [ ] "Open in Office Online" button works
  - [ ] Download button works

#### Security Testing
- [ ] **As non-admin user:**
  - [ ] Try accessing `/admin/resources` → Redirected or Forbidden
  - [ ] Try POST to `/api/admin/resources` → 403 Forbidden
  - [ ] Try accessing signed URL for resource not in your cohort → 403
- [ ] **File Upload:**
  - [ ] Try uploading >100MB file → Rejected
  - [ ] Try uploading invalid file type → Rejected
- [ ] **XSS Protection:**
  - [ ] Upload DOCX with `<script>alert('XSS')</script>` → Script blocked
  - [ ] Verify DOMPurify sanitization working

### 3. Database Migration

**CRITICAL: Run ONLY ONCE on production database**

```sql
-- Connect to production Supabase
-- Run the migration file:
-- supabase/migrations/015_enhance_resources_system.sql

-- Verify migration success:
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'resources'
  AND column_name IN ('category', 'is_global', 'thumbnail_url', 'duration');

-- Should return 4 rows

-- Check data migration:
SELECT category, COUNT(*) as count
FROM resources
GROUP BY category;

-- Should show counts for: video, article, presentation, pdf
```

**Steps:**
1. [ ] Backup production database (Supabase auto-backup enabled?)
2. [ ] Open Supabase SQL Editor
3. [ ] Copy contents of `015_enhance_resources_system.sql`
4. [ ] Execute migration
5. [ ] Verify columns added
6. [ ] Verify data migrated
7. [ ] Test RLS policies (try as student user)

---

## 🚀 DEPLOYMENT STEPS

### Step 1: Merge to Main

```bash
# In main project directory (not worktree)
cd /Users/shravantickoo/Downloads/rethink-dashboard

# Ensure main is up to date
git checkout main
git pull origin main

# Merge feature branch
git merge feature/resources-rework

# Resolve any conflicts (unlikely if main unchanged)
# Push to remote
git push origin main
```

### Step 2: Deploy to Vercel

**Option A: Automatic (if Vercel connected to GitHub)**
- [ ] Push to main triggers auto-deploy
- [ ] Monitor Vercel dashboard for build progress
- [ ] Wait for deployment to complete (~2-3 minutes)
- [ ] Check deployment logs for errors

**Option B: Manual (via Vercel CLI)**
```bash
# From main branch
vercel --prod
```

### Step 3: Post-Deployment Verification

**Critical Checks (Do within 5 minutes of deployment):**

- [ ] **Production URL loads:** `https://your-app.vercel.app`
- [ ] **Login works:** Test OTP or OAuth
- [ ] **Dashboard loads:** Navigate to `/dashboard`
- [ ] **Resources page loads:** Navigate to `/resources`
  - [ ] No console errors
  - [ ] Tabs render
  - [ ] Can switch tabs
- [ ] **Admin resources loads:** Navigate to `/admin/resources` (as admin)
  - [ ] Cohort dropdown populated
  - [ ] Can upload a test video link
  - [ ] Resource appears in table
- [ ] **Document viewers work:**
  - [ ] Upload a test PDF as admin
  - [ ] View as student
  - [ ] PDF viewer opens and renders
- [ ] **No breaking changes:**
  - [ ] Other pages still work (learnings, sessions, invoices)
  - [ ] Sidebar navigation works
  - [ ] User profile loads

**Monitor for 30 minutes:**
- [ ] Check Vercel logs for errors
- [ ] Check Supabase logs for database errors
- [ ] Check browser console for JS errors
- [ ] Test a few critical user flows

### Step 4: Rollback Plan (if issues found)

**If critical bugs found within 30 minutes:**

```bash
# Revert the merge
git revert -m 1 HEAD
git push origin main

# Vercel will auto-deploy the revert
# Or manually redeploy previous version in Vercel dashboard
```

**If issues found after 30 minutes:**
- Document the issue
- Create hotfix branch
- Fix and deploy patch

---

## 📊 SUCCESS METRICS

After 24 hours, verify:
- [ ] No increase in error rate (check Vercel/Supabase dashboards)
- [ ] Students can access resources
- [ ] Admins can upload resources
- [ ] No user complaints in support channels
- [ ] Page load times acceptable (<2 seconds)

---

## 🎓 CLEANUP (After successful deployment)

```bash
# Delete the worktree (optional, after confirming success)
cd /Users/shravantickoo/Downloads/rethink-dashboard
git worktree remove .worktrees/feature-resources-rework

# Delete the feature branch (optional)
git branch -d feature/resources-rework
```

---

## 📞 EMERGENCY CONTACTS

If deployment fails:
- Vercel support: https://vercel.com/support
- Supabase support: https://supabase.com/support
- Rollback immediately if users affected

---

## ✅ FINAL CHECKLIST

Before marking deployment as complete:
- [ ] All manual tests passed
- [ ] Database migration successful
- [ ] Deployment successful
- [ ] Post-deployment verification passed
- [ ] No critical errors in logs
- [ ] User flows working
- [ ] 30-minute monitoring period passed
- [ ] Documentation updated (optional)
- [ ] Team notified (optional)

---

**Deployment Date:** __________
**Deployed By:** __________
**Production URL:** __________
**Issues Found:** __________

---

## 🎉 POST-DEPLOYMENT

Celebrate! 🎊 You've successfully deployed a major feature:
- 16 files changed
- 4,382 lines added
- 5-phase implementation
- 7 security fixes
- Cohort-first UX innovation

Well done! 🚀
