# Excel/Spreadsheet Support - Hotfix Deployment

**Date:** 2026-02-05
**Type:** Hotfix
**Priority:** Medium
**Estimated Deployment Time:** 5 minutes

---

## 📋 Summary

This hotfix adds support for Excel/spreadsheet files (.xls, .xlsx) to the resources system. Files can now be uploaded by admins and viewed by students using Google Sheets viewer.

---

## 🔧 Changes Made

### 1. New Component
- **File:** `components/resources/excel-viewer.tsx`
- **Purpose:** Opens Excel files in Google Sheets viewer
- **Features:**
  - Google Sheets preview integration
  - Download fallback option
  - Green-themed UI to match spreadsheet aesthetic
  - Clean modal design with proper error handling

### 2. Student Resources Page
- **File:** `app/(dashboard)/resources/page.tsx`
- **Changes:**
  - Added dynamic import for ExcelViewer component
  - File type detection for .xls and .xlsx
  - Conditional rendering for Excel files
  - Updated ViewerState TypeScript type

### 3. Admin Resources Page
- **File:** `app/(admin)/admin/resources/page.tsx`
- **Changes:**
  - File validation updated to accept 'xls' and 'xlsx' extensions
  - Upload error messages updated

---

## 🗄️ Database Changes Required

**IMPORTANT:** Run this SQL script on your Supabase production database BEFORE deploying code:

```sql
-- ============================================================================
-- Hotfix: Add Excel/Spreadsheet Support
-- ============================================================================

-- Add Excel MIME types to storage bucket
UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'video/mp4',
  'video/quicktime',
  'video/x-msvideo',
  'video/webm'
]
WHERE id = 'resources';

-- Verify update
DO $$
DECLARE
  mime_types TEXT[];
BEGIN
  SELECT allowed_mime_types INTO mime_types
  FROM storage.buckets
  WHERE id = 'resources';

  IF 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' = ANY(mime_types) THEN
    RAISE NOTICE '✅ SUCCESS: Excel MIME types added to storage bucket';
  ELSE
    RAISE WARNING '⚠️  Excel MIME types not found in bucket configuration';
  END IF;
END $$;
```

---

## 🚀 Deployment Steps

### Step 1: Run Database Migration

1. Open Supabase SQL Editor
2. Connect to production database
3. Copy the SQL script above
4. Execute and verify success message: "✅ SUCCESS: Excel MIME types added to storage bucket"

### Step 2: Deploy Code

The code has been pushed to `main` branch. Vercel will auto-deploy.

**OR manually deploy:**
```bash
vercel --prod
```

### Step 3: Verify Deployment

**Test Upload (Admin):**
1. Navigate to `/admin/resources`
2. Select "Presentations" or "PDFs" tab
3. Try uploading a test .xlsx file
4. Verify no validation errors
5. Confirm file appears in resources table

**Test Viewing (Student):**
1. Navigate to `/resources`
2. Go to "PDFs" tab (Excel files appear here)
3. Click "Preview" on an Excel file
4. Verify Google Sheets viewer opens in modal
5. Test "Download" button works

---

## 📊 Files Affected

| File | Lines Changed | Type |
|------|---------------|------|
| `components/resources/excel-viewer.tsx` | +72 | New |
| `app/(dashboard)/resources/page.tsx` | +12, -2 | Modified |
| `app/(admin)/admin/resources/page.tsx` | +2, -2 | Modified |

**Total:** 3 files, 86 insertions, 4 deletions

---

## 🔍 Technical Details

### Google Sheets Viewer Integration

**URL Pattern:**
```
https://docs.google.com/viewer?url={encodedFileUrl}
```

**How it works:**
1. User clicks "Preview" on Excel file
2. Student view fetches signed URL from `/api/resources/[id]/signed-url`
3. Signed URL is encoded and passed to Google Docs viewer
4. Opens in modal with "Open in Google Sheets" button
5. Falls back to direct download if viewer fails

**Advantages:**
- No server-side processing required
- Works with large files
- Users can interact with sheets in Google's interface
- No additional dependencies

**Limitations:**
- Requires file to be publicly accessible via signed URL
- Viewing experience depends on Google's viewer
- No offline support

---

## 🧪 Testing Checklist

### Admin Testing
- [ ] Upload .xlsx file (< 100MB)
- [ ] Upload .xls file (legacy format)
- [ ] Verify validation rejects non-spreadsheet files
- [ ] Verify file appears in resources table with correct icon
- [ ] Delete Excel file and confirm storage cleanup

### Student Testing
- [ ] Navigate to /resources
- [ ] Excel files show in "PDFs" tab
- [ ] Click "Preview" opens modal
- [ ] "Open in Google Sheets" button works
- [ ] Download button works
- [ ] Modal close button works
- [ ] No console errors

### Edge Cases
- [ ] Very large file (90MB) - should upload
- [ ] File with special characters in name
- [ ] Multiple Excel files uploaded at once
- [ ] Excel file with complex formulas

---

## 🔙 Rollback Plan

If issues are found:

```bash
# Revert the commit
git revert 1c249bd
git push origin main

# Remove Excel MIME types from storage bucket
UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'video/mp4',
  'video/quicktime',
  'video/x-msvideo',
  'video/webm'
]
WHERE id = 'resources';
```

Vercel will auto-deploy the revert.

---

## ✅ Success Criteria

- [ ] Database migration executed successfully
- [ ] Build passes on Vercel
- [ ] No TypeScript errors
- [ ] Admin can upload .xlsx and .xls files
- [ ] Students can preview Excel files in Google Sheets
- [ ] Download works as fallback
- [ ] No breaking changes to existing functionality
- [ ] No console errors in browser

---

## 📝 Notes

- **Category:** Excel files appear in the "PDFs" tab (renamed to "Documents" in display)
- **File Size:** 100MB limit still applies
- **Signed URLs:** Use existing 5-minute expiry for Excel files
- **Mobile:** Google Sheets viewer works on mobile browsers

---

**Commit:** `1c249bd`
**Branch:** `main`
**Ready for production:** ✅ YES

---

## 🎉 Post-Deployment

After successful deployment:
1. Notify team that Excel support is live
2. Update user documentation
3. Monitor error logs for 24 hours
4. Collect user feedback

---

**Deployed By:** __________
**Deployment Date:** __________
**Issues Found:** __________
