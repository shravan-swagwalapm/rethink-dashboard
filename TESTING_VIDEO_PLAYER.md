# Video Player Enhancement - Testing Guide

## Overview

This guide helps you test the new video player implementation before deploying to production.

## What Was Built

### Components Created:
1. **VideoPlayer Component** (`components/video/VideoPlayer.tsx`)
   - Video.js integration with custom controls
   - Playback speed controls (0.5x - 2x)
   - Progress tracking and auto-resume
   - Keyboard shortcuts
   - Error handling and loading states

2. **Video Progress Hook** (`components/video/useVideoProgress.ts`)
   - React hook for managing video progress
   - Debounced saving to prevent excessive API calls

3. **Google Drive URL Handler** (`lib/utils/google-drive-url.ts`)
   - Extracts Google Drive file IDs from various URL formats
   - Generates direct streaming URLs with iframe fallback

4. **Video Progress Service** (`lib/services/video-progress.ts`)
   - Service layer for database operations
   - Methods: getProgress, saveProgress, markCompleted

5. **Progress API Endpoint** (`app/api/video/progress/route.ts`)
   - GET: Fetch progress for a resource
   - POST: Save/update progress
   - DELETE: Reset progress

6. **Database Migration** (`supabase/migrations/006_video_progress.sql`)
   - `video_progress` table: tracks watch position, percentage, completion
   - `video_watch_history` table: analytics tracking
   - `video_captions` table: multi-language subtitle support
   - Row-level security policies
   - Auto-completion trigger (90% threshold)

7. **TypeScript Types** (updated `types/index.ts`)
   - VideoProgress interface
   - VideoCaption interface
   - CaptionTrack interface

8. **Custom Styling** (updated `app/globals.css`)
   - Video.js theme matching design system
   - Custom play button, progress bar, controls
   - Dark mode support
   - Mobile responsive

9. **Updated Learnings Page** (`app/(dashboard)/learnings/page.tsx`)
   - Integrated VideoPlayer for video content
   - Larger modal size (max-w-7xl)
   - Fallback to iframe for non-video content

## Pre-Testing Checklist

### 1. Database Migration

**IMPORTANT:** Run the database migration first!

```bash
# Connect to your Supabase project
supabase link --project-ref isethhyihdbhquozlabl

# Apply the migration
supabase db push
```

Or manually run the SQL in Supabase Studio:
1. Go to https://supabase.com/dashboard/project/isethhyihdbhquozlabl/editor
2. Open `supabase/migrations/006_video_progress.sql`
3. Copy the entire SQL content
4. Run it in the SQL Editor

### 2. Verify Migration Success

Check that these tables were created:
- `video_progress`
- `video_watch_history`
- `video_captions`

```sql
-- Run in Supabase SQL Editor
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('video_progress', 'video_watch_history', 'video_captions');
```

### 3. Build and Start Development Server

```bash
# Install dependencies (already done)
npm install

# Build the project
npm run build

# Start development server
npm run dev
```

## Testing Procedures

### Test 1: Basic Video Playback

**Steps:**
1. Navigate to http://localhost:3000/learnings
2. Log in with your test account
3. Click on any video resource
4. Verify:
   - ✅ VideoPlayer component loads (not iframe)
   - ✅ Video starts playing
   - ✅ Controls are visible and styled correctly
   - ✅ Big play button appears centered
   - ✅ Progress bar shows at bottom

**Expected Result:**
- Video loads within 2-3 seconds
- Controls match design system colors
- No console errors

---

### Test 2: Progress Tracking - Save

**Steps:**
1. Open a video resource
2. Play for 30 seconds
3. Pause the video
4. Check browser console for "Progress saved" logs
5. Check Network tab for POST request to `/api/video/progress`

**Verify in Database:**
```sql
SELECT * FROM video_progress
WHERE user_id = '<your-user-id>'
ORDER BY last_watched_at DESC;
```

**Expected Result:**
- `last_position_seconds` ≈ 30
- `watch_percentage` ≈ calculated percentage
- `last_watched_at` is recent timestamp

---

### Test 3: Progress Tracking - Resume

**Steps:**
1. Play a video for 1 minute, then close the modal
2. Reopen the same video
3. Verify:
   - ✅ "Resume from X:XX" message appears
   - ✅ Video starts from the saved position (not from 0:00)
   - ✅ Progress percentage is shown

**Expected Result:**
- Video resumes from saved position within 1-2 seconds accuracy
- Progress indicator shows percentage watched

---

### Test 4: Completion Tracking

**Steps:**
1. Open a video resource
2. Seek to 90% of the video duration
3. Let it play to the end (or manually seek to end)
4. Check:
   - ✅ Completion badge appears ("You completed this video")
   - ✅ Database shows `completed = true`

**Verify in Database:**
```sql
SELECT completed, completed_at, watch_percentage
FROM video_progress
WHERE resource_id = '<resource-id>';
```

**Expected Result:**
- `completed` = true
- `watch_percentage` = 100
- `completed_at` has timestamp

---

### Test 5: Playback Speed Controls

**Steps:**
1. Open any video
2. Click the "1x" speed button in the controls
3. Try different speeds: 0.5x, 1.25x, 1.5x, 2x
4. Verify:
   - ✅ Speed changes immediately
   - ✅ Audio pitch remains normal
   - ✅ Progress continues to save correctly

---

### Test 6: Keyboard Shortcuts

**Steps:**
1. Open a video
2. Test each keyboard shortcut:
   - `Space` or `K`: Play/Pause
   - `→`: Skip forward 10 seconds
   - `←`: Skip backward 10 seconds
   - `F`: Enter fullscreen
   - `M`: Mute/unmute

**Expected Result:**
- All shortcuts work as described
- No conflicts with browser shortcuts

---

### Test 7: Network Throttling (Low Bandwidth)

**Steps:**
1. Open Chrome DevTools > Network tab
2. Set throttling to "Slow 3G"
3. Open a video resource
4. Verify:
   - ✅ Video loads without errors
   - ✅ Loading spinner shows while buffering
   - ✅ Video plays smoothly once buffered
   - ✅ No infinite loading

---

### Test 8: Error Handling

**Steps:**
1. Create a test video resource with an invalid Google Drive ID
2. Try to play it
3. Verify:
   - ✅ Error message appears: "Failed to load video"
   - ✅ "Retry" button is shown
   - ✅ No console errors crash the app

---

### Test 9: Mobile Responsiveness

**Steps:**
1. Open DevTools > Toggle device toolbar
2. Test on different devices:
   - iPhone 12 (390x844)
   - iPad (768x1024)
   - Galaxy S20 (360x800)
3. Verify:
   - ✅ Controls are appropriately sized
   - ✅ Big play button is visible and clickable
   - ✅ Progress bar is touch-friendly
   - ✅ Modal fits screen without overflow

---

### Test 10: Multiple Users (Isolation)

**Steps:**
1. Open browser in incognito mode
2. Log in as User A, play a video, save progress
3. Open another incognito window
4. Log in as User B, play the same video
5. Verify:
   - ✅ User B sees no progress (starts from 0:00)
   - ✅ User A's progress is saved separately

**Verify in Database:**
```sql
SELECT user_id, resource_id, last_position_seconds
FROM video_progress
WHERE resource_id = '<same-resource-id>';
```

**Expected Result:**
- Two separate rows, one per user

---

### Test 11: API Endpoints

**Test GET /api/video/progress**
```bash
curl -X GET \
  'http://localhost:3000/api/video/progress?resourceId=<resource-id>' \
  -H 'Cookie: <auth-cookie>'
```

Expected: 200 OK with progress data

**Test POST /api/video/progress**
```bash
curl -X POST \
  'http://localhost:3000/api/video/progress' \
  -H 'Content-Type: application/json' \
  -H 'Cookie: <auth-cookie>' \
  -d '{
    "resourceId": "<resource-id>",
    "positionSeconds": 120,
    "watchPercentage": 45.5
  }'
```

Expected: 200 OK with success response

---

### Test 12: Google Drive URL Extraction

**Test in browser console:**
```javascript
// Open http://localhost:3000/learnings and run in console:

// Test URL extraction
import { extractGoogleDriveId } from '@/lib/utils/google-drive-url';

const testUrls = [
  'https://drive.google.com/file/d/1ABC123XYZ/view',
  'https://drive.google.com/file/d/1ABC123XYZ/preview',
  'https://drive.google.com/open?id=1ABC123XYZ',
  '1ABC123XYZ', // Direct ID
];

testUrls.forEach(url => {
  console.log(`${url} => ${extractGoogleDriveId(url)}`);
});
```

**Expected Result:**
All URLs should extract to: `1ABC123XYZ`

---

## Performance Benchmarks

Target performance metrics:

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Video load time (Fast 4G) | < 2 seconds | Network tab: Time to first frame |
| Video load time (3G) | < 5 seconds | Network tab with throttling |
| Progress save API call | < 300ms | Network tab: /api/video/progress |
| Resume accuracy | ± 2 seconds | Compare saved vs actual position |
| Bundle size impact | < 300KB | Build output: video.js chunk |

---

## Common Issues & Solutions

### Issue 1: Video doesn't play
**Symptoms:** Loading spinner indefinitely
**Causes:**
- Google Drive video not shared publicly
- Invalid Drive ID
- CORS issues

**Solution:**
1. Check Google Drive sharing settings
2. Verify Drive ID extraction
3. Check browser console for errors

### Issue 2: Progress not saving
**Symptoms:** Resume always starts from 0:00
**Causes:**
- Database migration not run
- RLS policies blocking access
- API errors

**Solution:**
1. Run database migration
2. Check Supabase logs for errors
3. Verify user authentication

### Issue 3: Video.js CSS not loading
**Symptoms:** Unstyled controls
**Causes:**
- Dynamic import timing issue
- CSS not imported

**Solution:**
- Hard refresh browser (Cmd+Shift+R)
- Check that globals.css includes Video.js styles

### Issue 4: Modal too small on desktop
**Symptoms:** Video appears tiny
**Causes:**
- Old modal size still cached

**Solution:**
- Verify `max-w-7xl` class in learnings page
- Clear browser cache

---

## Database Verification Queries

```sql
-- Check progress records
SELECT
  vp.*,
  mr.title as video_title,
  p.email as user_email
FROM video_progress vp
JOIN module_resources mr ON vp.resource_id = mr.id
JOIN profiles p ON vp.user_id = p.id
ORDER BY vp.last_watched_at DESC
LIMIT 10;

-- Check completion rate
SELECT
  COUNT(*) as total_videos,
  COUNT(*) FILTER (WHERE completed = true) as completed,
  ROUND(AVG(watch_percentage), 2) as avg_percentage
FROM video_progress;

-- Check most watched videos
SELECT
  mr.title,
  COUNT(*) as view_count,
  COUNT(*) FILTER (WHERE vp.completed = true) as completions
FROM video_progress vp
JOIN module_resources mr ON vp.resource_id = mr.id
GROUP BY mr.id, mr.title
ORDER BY view_count DESC;
```

---

## Rollback Plan

If issues occur and you need to rollback:

1. **Disable new player (temporary):**
   ```typescript
   // In app/(dashboard)/learnings/page.tsx
   // Comment out VideoPlayer, uncomment iframe
   ```

2. **Remove database tables:**
   ```sql
   DROP TABLE IF EXISTS video_captions CASCADE;
   DROP TABLE IF EXISTS video_watch_history CASCADE;
   DROP TABLE IF EXISTS video_progress CASCADE;
   ```

3. **Revert code changes:**
   ```bash
   git checkout main
   ```

---

## Success Criteria

✅ All 12 tests pass
✅ No console errors
✅ Performance targets met
✅ Mobile responsive
✅ Progress tracking works consistently
✅ No regressions for non-video content

Once all criteria are met, the feature is ready for deployment!

---

## Next Steps After Testing

1. **Deploy to Staging:**
   ```bash
   git add .
   git commit -m "feat: Add Video.js player with progress tracking"
   git push origin staging
   ```

2. **Monitor in Production:**
   - Watch Supabase logs for API errors
   - Check video_progress table growth
   - Monitor Video.js bundle size impact

3. **Future Enhancements:**
   - Add captions upload UI in admin panel
   - Implement video quality switching
   - Add watch time analytics dashboard
   - Enable picture-in-picture by default
   - Add video bookmarks/timestamps

---

**Happy Testing! 🎬**
