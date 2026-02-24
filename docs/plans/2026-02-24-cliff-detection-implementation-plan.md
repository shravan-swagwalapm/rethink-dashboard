# Cliff Detection Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Automatically detect when the instructor says "session is over" by analyzing the mass departure pattern, and use that as the effective session duration for attendance calculation.

**Architecture:** A new pure-function service (`cliff-detector.ts`) analyzes resolved participant segments to find departure clusters. Results are stored as JSONB on the sessions table. The attendance calculator's duration priority chain gains a new highest-priority source (`formal_end_minutes`). Admin UI in the meetings manager tab shows cliff indicators with a detail panel for review/apply.

**Tech Stack:** TypeScript, Next.js API routes, Supabase PostgreSQL, Tailwind CSS, Radix UI (shadcn), Framer Motion.

**Design Doc:** `docs/plans/2026-02-24-cliff-detection-formal-end-design.md`

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/026_cliff_detection.sql`

**Step 1: Write the migration**

```sql
-- 026_cliff_detection.sql
-- Adds cliff detection fields to sessions table for automatic formal end detection

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS formal_end_minutes INTEGER;
COMMENT ON COLUMN sessions.formal_end_minutes IS 'Effective session duration after removing QnA. Highest priority denominator for attendance calculation. NULL = not applied.';

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS cliff_detection JSONB;
COMMENT ON COLUMN sessions.cliff_detection IS 'Full cliff detection result from departure analysis. Contains: detected, confidence, histogram, etc. NULL = never analyzed.';
```

**Step 2: Verify build**

Run: `cd /Users/shravantickoo/Downloads/rethink-dashboard && npm run build`
Expected: PASS (migration is SQL only, no TS impact yet)

**Step 3: Commit**

```bash
git add supabase/migrations/026_cliff_detection.sql
git commit -m "feat: add cliff detection columns to sessions table"
```

**Note for executor:** This migration must be run in Supabase Dashboard → SQL Editor on production AFTER code deployment. The code handles NULL values gracefully.

---

## Task 2: Cliff Detector Service (Core Algorithm)

**Files:**
- Create: `lib/services/cliff-detector.ts`

**Reference:**
- Design doc algorithm section: `docs/plans/2026-02-24-cliff-detection-formal-end-design.md`
- Participant segment type from: `lib/services/attendance-calculator.ts` (the resolved participant structure)

**Step 1: Write the cliff detector service**

Create `lib/services/cliff-detector.ts` with these exports:

```typescript
// Types
export interface CliffDetectionResult {
  detected: boolean;
  reason?: string; // Only when detected=false: TOO_FEW_DEPARTURES | SESSION_TOO_SMALL | CLUSTER_TOO_SMALL | ABSOLUTE_COUNT_LOW | NOT_ENOUGH_SPIKE
  confidence?: 'high' | 'medium' | 'low';
  effectiveEndMinutes?: number;
  cliffWindowStartMin?: number;
  cliffWindowEndMin?: number;
  departuresInCliff?: number;
  totalFinalDepartures?: number;
  meetingEndStayers?: number;
  totalParticipants?: number;
  cliffRatio?: number;
  spikeRatio?: number;
  studentsImpacted?: number;
  histogram?: { minute: number; departures: number; isCliff: boolean }[];
}

export interface ParticipantSegment {
  join_time: string; // ISO timestamp
  leave_time: string; // ISO timestamp
}

export interface ResolvedParticipantInput {
  userId: string | null;
  segments: ParticipantSegment[];
}

// Main function
export function detectFormalEnd(
  participants: ResolvedParticipantInput[],
  meetingStartTime: string, // ISO timestamp
  meetingEndTime: string,   // ISO timestamp
): CliffDetectionResult
```

**Algorithm implementation details:**

1. **Parse times** — Convert ISO strings to epoch ms. Calculate `totalMeetingMinutes`.

2. **Extract final departures** — For each participant:
   - Sort their segments by `join_time`
   - Take the last segment's `leave_time` as `finalLeave`
   - If `finalLeave >= meetingEnd - 2 minutes` → classify as "stayer" (increment `stayers` counter)
   - Otherwise → add to `finalDepartures` array with `minutesMark = (finalLeave - meetingStart) / 60000`

3. **Early exits:**
   - If `finalDepartures.length < 3` → return `{ detected: false, reason: 'TOO_FEW_DEPARTURES' }`
   - If `totalParticipants < 5` → return `{ detected: false, reason: 'SESSION_TOO_SMALL' }`

4. **Sliding window scan:**
   - Sort `finalDepartures` by `minutesMark` ascending
   - `WINDOW_SIZE = 10` minutes
   - `scanStart = totalMeetingMinutes * 0.5` (only last half)
   - For each departure `d` where `d.minutesMark >= scanStart`:
     - Count departures in `[d.minutesMark, d.minutesMark + WINDOW_SIZE]`
     - Track best (highest count) window: `{ startMin, count }`
   - Use binary search or simple filter for the window count

5. **Validate the cliff:**
   - `cliffRatio = bestWindow.count / finalDepartures.length`
   - Calculate background rate: `nonCliffDepartures / (totalMeetingMinutes - WINDOW_SIZE)` per minute
   - `expectedInWindow = backgroundRate * WINDOW_SIZE`
   - `spikeRatio = bestWindow.count / Math.max(expectedInWindow, 0.5)`
   - Adaptive thresholds:
     - `minRatio = totalParticipants < 20 ? 0.30 : 0.25`
     - `minAbsolute = totalParticipants < 20 ? 3 : 5`
     - `minSpike = 2.5`
   - If `cliffRatio < minRatio` → `{ detected: false, reason: 'CLUSTER_TOO_SMALL' }`
   - If `bestWindow.count < minAbsolute` → `{ detected: false, reason: 'ABSOLUTE_COUNT_LOW' }`
   - If `spikeRatio < minSpike` → `{ detected: false, reason: 'NOT_ENOUGH_SPIKE' }`

6. **Effective end:** `effectiveEndMinutes = Math.round(bestWindow.startMin)`

7. **Confidence:**
   ```typescript
   const confidence =
     cliffRatio >= 0.50 && bestWindow.count >= 8 && spikeRatio >= 5 ? 'high' :
     cliffRatio >= 0.35 || (bestWindow.count >= 6 && spikeRatio >= 3) ? 'medium' :
     'low';
   ```

8. **Histogram:** Build 5-minute buckets from 0 to totalMeetingMinutes. Count ALL departures (including stayers at the end bucket) per bucket. Mark buckets that overlap with `[cliffWindowStart, cliffWindowEnd]` as `isCliff: true`.

9. **Impact calculation:** Count final departures where `minutesMark >= effectiveEndMinutes * 0.85` (attended ≥85% of formal session) AND `minutesMark / totalMeetingMinutes < 0.95` (but <95% of total meeting).

10. **Return the full `CliffDetectionResult`.**

**Step 2: Verify build**

Run: `npm run build`
Expected: PASS (new file, no imports yet)

**Step 3: Commit**

```bash
git add lib/services/cliff-detector.ts
git commit -m "feat: add cliff detection service — pure algorithm for formal end detection"
```

---

## Task 3: Update Attendance Calculator Duration Priority

**Files:**
- Modify: `lib/services/attendance-calculator.ts` (lines 163-201)

**Step 1: Add formal_end_minutes as highest priority**

In `calculateSessionAttendance()`, BEFORE the existing duration resolution chain (line 163), add a check for `formal_end_minutes` from the session record.

The session record is already fetched later (lines 188-196). Restructure so the session fetch happens FIRST, then the priority chain becomes:

```typescript
// Fetch session record first (moved up from lines 188-196)
const { data: sessionRecord } = await supabase
  .from('sessions')
  .select('actual_duration_minutes, duration_minutes, formal_end_minutes')
  .eq('id', sessionId)
  .single();

// Duration priority chain (updated)
let resolvedDuration = 0;
let durationSource = 'none';

// Priority 1: formal_end_minutes (cliff-adjusted)
if (sessionRecord?.formal_end_minutes && sessionRecord.formal_end_minutes > 0) {
  resolvedDuration = sessionRecord.formal_end_minutes;
  durationSource = 'formal_end_minutes';
}

// Priority 2: Caller-provided override
if (!resolvedDuration && actualDurationMinutes && actualDurationMinutes > 0) {
  resolvedDuration = actualDurationMinutes;
  durationSource = 'caller';
}

// Priority 3: Zoom API actual duration (existing try/catch block)
if (!resolvedDuration) {
  try {
    const zoomDetails = await zoomService.getPastMeetingDetails(zoomMeetingUuid);
    // ... existing code ...
  } catch (err) {
    // ... existing warning ...
  }
}

// Priority 4-5: session.actual_duration_minutes / duration_minutes (existing)
if (!resolvedDuration || resolvedDuration <= 0) {
  if (sessionRecord?.actual_duration_minutes && sessionRecord.actual_duration_minutes > 0) {
    resolvedDuration = sessionRecord.actual_duration_minutes;
    durationSource = 'session.actual_duration_minutes';
  } else if (sessionRecord?.duration_minutes && sessionRecord.duration_minutes > 0) {
    resolvedDuration = sessionRecord.duration_minutes;
    durationSource = 'session.duration_minutes';
  }
}
```

**Key change:** Add `formal_end_minutes` to the SELECT query and check it first.

**Step 2: Verify build**

Run: `npm run build`
Expected: PASS

**Step 3: Commit**

```bash
git add lib/services/attendance-calculator.ts
git commit -m "feat: add formal_end_minutes as highest-priority duration source"
```

---

## Task 4: API Route — Detect Cliff (Single Session)

**Files:**
- Create: `app/api/admin/analytics/detect-cliff/route.ts`

**Reference:**
- `app/api/admin/analytics/calculate-attendance/route.ts` for pattern (admin verification, body parsing)
- `lib/integrations/zoom.ts` for `getPastMeetingParticipants` (line 378)
- `lib/services/attendance-calculator.ts` for `groupParticipantsByEmail` and `resolveUserIds` (or replicate the grouping logic)

**Step 1: Write the API route**

```typescript
import { NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/api/verify-admin';
import { createAdminClient } from '@/lib/supabase/server';
import { ZoomService } from '@/lib/integrations/zoom';
import { detectFormalEnd, type ResolvedParticipantInput } from '@/lib/services/cliff-detector';

export async function POST(req: Request) {
  const admin = await verifyAdmin();
  if (!admin.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { sessionId, zoomMeetingUuid } = await req.json();
  if (!sessionId || !zoomMeetingUuid) {
    return NextResponse.json({ error: 'sessionId and zoomMeetingUuid required' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const zoomService = new ZoomService();

  try {
    // 1. Fetch participant data from Zoom
    const participants = await zoomService.getPastMeetingParticipants(zoomMeetingUuid);
    if (!participants || participants.length === 0) {
      return NextResponse.json({ error: 'No participants found for this meeting' }, { status: 404 });
    }

    // 2. Get meeting times from Zoom
    let meetingStart: string;
    let meetingEnd: string;

    // Try getPastMeetingDetails first
    try {
      const details = await zoomService.getPastMeetingDetails(zoomMeetingUuid);
      meetingStart = details.start_time;
      meetingEnd = details.end_time;
    } catch {
      // Fallback: use earliest join and latest leave from participants
      const sortedByJoin = [...participants].sort((a, b) =>
        new Date(a.join_time).getTime() - new Date(b.join_time).getTime()
      );
      const sortedByLeave = [...participants].sort((a, b) =>
        new Date(b.leave_time).getTime() - new Date(a.leave_time).getTime()
      );
      meetingStart = sortedByJoin[0].join_time;
      meetingEnd = sortedByLeave[0].leave_time;
    }

    // 3. Group participants by email → resolve to users
    // Simple grouping: each unique email gets all their segments
    const emailGroups = new Map<string, { join_time: string; leave_time: string }[]>();

    for (const p of participants) {
      const email = (p.user_email || `__nomail__${p.id}`).toLowerCase().trim();
      if (!emailGroups.has(email)) {
        emailGroups.set(email, []);
      }
      emailGroups.get(email)!.push({
        join_time: p.join_time,
        leave_time: p.leave_time,
      });
    }

    // Convert to ResolvedParticipantInput[]
    const resolvedParticipants: ResolvedParticipantInput[] = [];
    for (const [email, segments] of emailGroups) {
      resolvedParticipants.push({
        userId: email.startsWith('__nomail__') ? null : email,
        segments,
      });
    }

    // 4. Run cliff detection
    const result = detectFormalEnd(resolvedParticipants, meetingStart, meetingEnd);

    // 5. Store result on session
    const { error: updateError } = await supabase
      .from('sessions')
      .update({ cliff_detection: result })
      .eq('id', sessionId);

    if (updateError) {
      console.error('[detect-cliff] Failed to save result:', updateError);
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('[detect-cliff] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Detection failed' },
      { status: 500 }
    );
  }
}
```

**Step 2: Verify build**

Run: `npm run build`
Expected: PASS

**Step 3: Commit**

```bash
git add app/api/admin/analytics/detect-cliff/route.ts
git commit -m "feat: add single-session cliff detection API route"
```

---

## Task 5: API Route — Apply Cliff

**Files:**
- Create: `app/api/admin/analytics/apply-cliff/route.ts`

**Step 1: Write the apply-cliff route**

This route sets `formal_end_minutes` on a session and triggers attendance recalculation.

```typescript
import { NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/api/verify-admin';
import { createAdminClient } from '@/lib/supabase/server';
import { calculateSessionAttendance } from '@/lib/services/attendance-calculator';

export async function POST(req: Request) {
  const admin = await verifyAdmin();
  if (!admin.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { sessionId, formalEndMinutes, zoomMeetingUuid } = await req.json();
  if (!sessionId || !formalEndMinutes || !zoomMeetingUuid) {
    return NextResponse.json(
      { error: 'sessionId, formalEndMinutes, and zoomMeetingUuid required' },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  try {
    // 1. Update formal_end_minutes on session
    const { error: updateError } = await supabase
      .from('sessions')
      .update({
        formal_end_minutes: formalEndMinutes,
        cliff_detection: supabase.rpc ? undefined : undefined, // Keep existing cliff_detection
      })
      .eq('id', sessionId);

    if (updateError) {
      return NextResponse.json({ error: 'Failed to update session' }, { status: 500 });
    }

    // 2. Mark cliff as applied in cliff_detection JSON
    const { data: session } = await supabase
      .from('sessions')
      .select('cliff_detection')
      .eq('id', sessionId)
      .single();

    if (session?.cliff_detection) {
      const updatedCliff = {
        ...session.cliff_detection,
        appliedAt: new Date().toISOString(),
        appliedFormalEndMinutes: formalEndMinutes,
      };
      await supabase
        .from('sessions')
        .update({ cliff_detection: updatedCliff })
        .eq('id', sessionId);
    }

    // 3. Recalculate attendance (formal_end_minutes will be picked up by priority chain)
    const result = await calculateSessionAttendance(sessionId, zoomMeetingUuid);

    return NextResponse.json({
      success: true,
      formalEndMinutes,
      attendance: result,
    });
  } catch (error) {
    console.error('[apply-cliff] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Apply failed' },
      { status: 500 }
    );
  }
}

// DELETE handler to dismiss/remove cliff
export async function DELETE(req: Request) {
  const admin = await verifyAdmin();
  if (!admin.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { sessionId, zoomMeetingUuid } = await req.json();
  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
  }

  const supabase = createAdminClient();

  try {
    // 1. Clear formal_end_minutes
    await supabase
      .from('sessions')
      .update({ formal_end_minutes: null })
      .eq('id', sessionId);

    // 2. Mark cliff as dismissed
    const { data: session } = await supabase
      .from('sessions')
      .select('cliff_detection')
      .eq('id', sessionId)
      .single();

    if (session?.cliff_detection) {
      await supabase
        .from('sessions')
        .update({
          cliff_detection: { ...session.cliff_detection, dismissed: true, appliedAt: null },
        })
        .eq('id', sessionId);
    }

    // 3. Recalculate without formal_end_minutes (uses normal duration chain)
    if (zoomMeetingUuid) {
      const result = await calculateSessionAttendance(sessionId, zoomMeetingUuid);
      return NextResponse.json({ success: true, attendance: result });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[apply-cliff] DELETE Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Dismiss failed' },
      { status: 500 }
    );
  }
}
```

**Step 2: Verify build**

Run: `npm run build`
Expected: PASS

**Step 3: Commit**

```bash
git add app/api/admin/analytics/apply-cliff/route.ts
git commit -m "feat: add apply-cliff and dismiss-cliff API routes"
```

---

## Task 6: API Route — Bulk Cliff Detection

**Files:**
- Create: `app/api/admin/analytics/detect-cliffs-bulk/route.ts`

**Reference:**
- Follow the pattern from `app/api/admin/analytics/recalculate-all/route.ts` (lines 50-101)

**Step 1: Write the bulk detection route**

```typescript
import { NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/api/verify-admin';
import { createAdminClient } from '@/lib/supabase/server';
import { ZoomService } from '@/lib/integrations/zoom';
import { detectFormalEnd, type ResolvedParticipantInput } from '@/lib/services/cliff-detector';

export async function POST(req: Request) {
  const admin = await verifyAdmin();
  if (!admin.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();
  const zoomService = new ZoomService();

  // Fetch all sessions that have zoom data and attendance
  const { data: sessions } = await supabase
    .from('sessions')
    .select('id, title, zoom_meeting_id, actual_duration_minutes, duration_minutes, cliff_detection, formal_end_minutes')
    .not('zoom_meeting_id', 'is', null)
    .order('scheduled_at', { ascending: false });

  if (!sessions || sessions.length === 0) {
    return NextResponse.json({ summary: { total: 0 }, results: [] });
  }

  const results: Array<{
    sessionId: string;
    title: string;
    status: 'detected' | 'no_cliff' | 'skipped' | 'error';
    confidence?: string;
    effectiveEndMinutes?: number;
    studentsImpacted?: number;
    error?: string;
  }> = [];

  for (const session of sessions) {
    // Skip already-dismissed cliffs
    if (session.cliff_detection?.dismissed) {
      results.push({ sessionId: session.id, title: session.title, status: 'skipped', error: 'Previously dismissed' });
      continue;
    }

    try {
      // Get meeting UUID from import logs or session
      const { data: importLog } = await supabase
        .from('zoom_import_logs')
        .select('zoom_meeting_uuid')
        .eq('session_id', session.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      const meetingUuid = importLog?.zoom_meeting_uuid || session.zoom_meeting_id;
      if (!meetingUuid) {
        results.push({ sessionId: session.id, title: session.title, status: 'skipped', error: 'No meeting UUID' });
        continue;
      }

      // Fetch participants from Zoom
      const participants = await zoomService.getPastMeetingParticipants(meetingUuid);
      if (!participants || participants.length === 0) {
        results.push({ sessionId: session.id, title: session.title, status: 'skipped', error: 'No participant data (may be >6 months old)' });
        continue;
      }

      // Get meeting times
      let meetingStart: string;
      let meetingEnd: string;
      try {
        const details = await zoomService.getPastMeetingDetails(meetingUuid);
        meetingStart = details.start_time;
        meetingEnd = details.end_time;
      } catch {
        const sortedByJoin = [...participants].sort((a, b) =>
          new Date(a.join_time).getTime() - new Date(b.join_time).getTime()
        );
        const sortedByLeave = [...participants].sort((a, b) =>
          new Date(b.leave_time).getTime() - new Date(a.leave_time).getTime()
        );
        meetingStart = sortedByJoin[0].join_time;
        meetingEnd = sortedByLeave[0].leave_time;
      }

      // Group participants
      const emailGroups = new Map<string, { join_time: string; leave_time: string }[]>();
      for (const p of participants) {
        const email = (p.user_email || `__nomail__${p.id}`).toLowerCase().trim();
        if (!emailGroups.has(email)) emailGroups.set(email, []);
        emailGroups.get(email)!.push({ join_time: p.join_time, leave_time: p.leave_time });
      }

      const resolved: ResolvedParticipantInput[] = [];
      for (const [email, segments] of emailGroups) {
        resolved.push({ userId: email.startsWith('__nomail__') ? null : email, segments });
      }

      // Run detection
      const detection = detectFormalEnd(resolved, meetingStart, meetingEnd);

      // Save result to session
      await supabase
        .from('sessions')
        .update({ cliff_detection: detection })
        .eq('id', session.id);

      if (detection.detected) {
        results.push({
          sessionId: session.id,
          title: session.title,
          status: 'detected',
          confidence: detection.confidence,
          effectiveEndMinutes: detection.effectiveEndMinutes,
          studentsImpacted: detection.studentsImpacted,
        });
      } else {
        results.push({ sessionId: session.id, title: session.title, status: 'no_cliff' });
      }

      // Rate limit: 200ms between sessions to respect Zoom API
      await new Promise((r) => setTimeout(r, 200));

    } catch (error) {
      results.push({
        sessionId: session.id,
        title: session.title,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  const detected = results.filter((r) => r.status === 'detected');
  const summary = {
    total: sessions.length,
    detected: detected.length,
    highConfidence: detected.filter((r) => r.confidence === 'high').length,
    mediumConfidence: detected.filter((r) => r.confidence === 'medium').length,
    lowConfidence: detected.filter((r) => r.confidence === 'low').length,
    noCliff: results.filter((r) => r.status === 'no_cliff').length,
    skipped: results.filter((r) => r.status === 'skipped').length,
    errors: results.filter((r) => r.status === 'error').length,
    totalStudentsImpacted: detected.reduce((sum, r) => sum + (r.studentsImpacted || 0), 0),
  };

  return NextResponse.json({ summary, results });
}
```

**Step 2: Verify build**

Run: `npm run build`
Expected: PASS

**Step 3: Commit**

```bash
git add app/api/admin/analytics/detect-cliffs-bulk/route.ts
git commit -m "feat: add bulk cliff detection API route for all sessions"
```

---

## Task 7: Update Sync-Zoom Response to Include Cliff Data

**Files:**
- Modify: `app/api/admin/analytics/sync-zoom/route.ts` (lines 119-148, the enrichedMeetings map)

**Step 1: Add cliff fields to the enriched meeting response**

In the GET handler, the session is already fetched. Add `cliff_detection` and `formal_end_minutes` to the SELECT and response:

1. Update the session query (find where sessions are fetched with `.select(...)`) to include `cliff_detection, formal_end_minutes`.

2. In the `enrichedMeetings.map()` (line 119), add to the return object:
   ```typescript
   cliffDetection: linkedSession?.cliff_detection || null,
   formalEndMinutes: linkedSession?.formal_end_minutes || null,
   ```

**Step 2: Verify build**

Run: `npm run build`
Expected: PASS

**Step 3: Commit**

```bash
git add app/api/admin/analytics/sync-zoom/route.ts
git commit -m "feat: include cliff detection data in sync-zoom response"
```

---

## Task 8: UI — Cliff Column in Meetings Manager Table

**Files:**
- Modify: `app/(admin)/admin/analytics/components/meetings-manager-tab.tsx`

**Step 1: Update ZoomMeeting interface (line 33-49)**

Add to the interface:
```typescript
cliffDetection: CliffDetectionResult | null;
formalEndMinutes: number | null;
```

Import the type at the top:
```typescript
import type { CliffDetectionResult } from '@/lib/services/cliff-detector';
```

**Step 2: Add "Formal End" column header**

In the `<TableHeader>` section (lines 424-455), add a new `<TableHead>` AFTER the "Unique" column and BEFORE "Cohort":

```tsx
<TableHead>
  <Tooltip>
    <TooltipTrigger className="flex items-center gap-1">
      Formal End <Info className="w-3 h-3 text-muted-foreground" />
    </TooltipTrigger>
    <TooltipContent>Auto-detected session end time (excludes QnA). Click to review.</TooltipContent>
  </Tooltip>
</TableHead>
```

**Step 3: Add cliff cell in table body**

Find the `<TableRow>` in the map (where each meeting row is rendered). Add a new `<TableCell>` in the matching position:

```tsx
<TableCell>
  {meeting.cliffDetection?.detected ? (
    <button
      onClick={() => {
        setSelectedCliffMeeting(meeting);
        setCliffDetailOpen(true);
      }}
      className="inline-flex items-center gap-1"
    >
      <Badge
        variant={meeting.formalEndMinutes ? 'default' : 'outline'}
        className={
          meeting.cliffDetection.confidence === 'high'
            ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20 cursor-pointer'
            : meeting.cliffDetection.confidence === 'medium'
            ? 'bg-amber-500/10 text-amber-500 border-amber-500/20 hover:bg-amber-500/20 cursor-pointer'
            : 'bg-orange-500/10 text-orange-500 border-orange-500/20 hover:bg-orange-500/20 cursor-pointer'
        }
      >
        {meeting.formalEndMinutes ? '⚡' : '⏳'}{' '}
        {meeting.cliffDetection.effectiveEndMinutes}m
      </Badge>
    </button>
  ) : meeting.cliffDetection && !meeting.cliffDetection.detected ? (
    <span className="text-xs text-muted-foreground">— none</span>
  ) : (
    <span className="text-xs text-muted-foreground">—</span>
  )}
</TableCell>
```

**Step 4: Add state for cliff detail panel**

Near the top of the component (with other useState calls):
```typescript
const [selectedCliffMeeting, setSelectedCliffMeeting] = useState<ZoomMeeting | null>(null);
const [cliffDetailOpen, setCliffDetailOpen] = useState(false);
```

**Step 5: Add "Detect Formal Ends" button in the header**

Find the header section with the "Sync from Zoom" button. Add a new button nearby:
```tsx
<Button
  variant="outline"
  size="sm"
  onClick={handleBulkDetect}
  disabled={bulkDetecting}
>
  {bulkDetecting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Zap className="w-4 h-4 mr-2" />}
  Detect Formal Ends
</Button>
```

Add the `Zap` import from `lucide-react` and the state/handler:
```typescript
const [bulkDetecting, setBulkDetecting] = useState(false);
const [bulkResults, setBulkResults] = useState<BulkDetectionResult | null>(null);
const [bulkDialogOpen, setBulkDialogOpen] = useState(false);

const handleBulkDetect = useCallback(async () => {
  setBulkDetecting(true);
  try {
    const res = await fetch('/api/admin/analytics/detect-cliffs-bulk', { method: 'POST' });
    if (!res.ok) throw new Error('Bulk detection failed');
    const data = await res.json();
    setBulkResults(data);
    setBulkDialogOpen(true);
    // Refresh meetings to show updated cliff data
    syncFromZoom();
  } catch (error) {
    toast.error('Failed to detect formal ends');
  } finally {
    setBulkDetecting(false);
  }
}, [syncFromZoom]);
```

**Step 6: Verify build**

Run: `npm run build`
Expected: PASS

**Step 7: Commit**

```bash
git add app/(admin)/admin/analytics/components/meetings-manager-tab.tsx
git commit -m "feat: add Formal End column and Detect button to meetings table"
```

---

## Task 9: UI — Cliff Detail Panel (Sheet)

**Files:**
- Create: `app/(admin)/admin/analytics/components/cliff-detail-panel.tsx`
- Create: `app/(admin)/admin/analytics/components/cliff-timeline.tsx`

**Step 1: Create the timeline visualization component**

`cliff-timeline.tsx` — A Tailwind-only bar chart showing departure distribution:

```typescript
// Props: histogram from CliffDetectionResult, totalMeetingMinutes, effectiveEndMinutes, meetingEndMinutes
// Renders a horizontal bar chart with 5-minute buckets
// Cliff buckets highlighted in primary color
// Meeting-end stayers shown in a different color
// Vertical line at effectiveEndMinutes with "Formal End" label
// Vertical line at meetingEndMinutes with "Meeting End" label
```

Key implementation:
- Max bar height = tallest bucket
- Each bar width = proportional to bucket count / max count
- Use `bg-primary` for cliff bars, `bg-muted-foreground/30` for normal, `bg-blue-500/30` for meeting-end
- Labels below: "0 min", meeting midpoint, "Formal End ↑", "Meeting End ↑"
- Render as flex row of thin divs with dynamic height

**Step 2: Create the cliff detail panel**

`cliff-detail-panel.tsx` — A Sheet (side panel) component:

```typescript
// Props:
//   open: boolean
//   onOpenChange: (open: boolean) => void
//   meeting: ZoomMeeting (the selected meeting with cliff data)
//   onApply: (sessionId: string, formalEndMinutes: number) => Promise<void>
//   onDismiss: (sessionId: string) => Promise<void>

// Structure:
// <Sheet open={open} onOpenChange={onOpenChange}>
//   <SheetContent className="sm:max-w-lg overflow-y-auto">
//     <SheetHeader>
//       <SheetTitle>Session Formal End Detection</SheetTitle>
//     </SheetHeader>
//
//     {/* Meeting info */}
//     <p className="font-medium">{meeting.topic}</p>
//     <p className="text-sm text-muted-foreground">{formatted date} · Zoom Duration: {meeting.duration} min</p>
//
//     {/* Detection summary card */}
//     <Card with confidence badge, departure counts, spike ratio>
//
//     {/* Timeline visualization */}
//     <CliffTimeline histogram={...} />
//
//     {/* Impact preview */}
//     <Card showing studentsImpacted, before/after description>
//
//     {/* Editable duration input */}
//     <div>
//       <Label>Effective Duration (minutes)</Label>
//       <Input type="number" value={editableDuration} onChange={...} />
//       <p className="text-xs text-muted-foreground">Detected: {effectiveEndMinutes} min</p>
//     </div>
//
//     {/* Action buttons */}
//     <div className="flex gap-2">
//       <Button onClick={() => onApply(meeting.linkedSessionId, editableDuration)}>
//         Apply & Recalculate
//       </Button>
//       <Button variant="outline" onClick={() => onDismiss(meeting.linkedSessionId)}>
//         Dismiss
//       </Button>
//     </div>
//   </SheetContent>
// </Sheet>
```

Import `Sheet, SheetContent, SheetHeader, SheetTitle` from `@/components/ui/sheet`.

**Step 3: Verify build**

Run: `npm run build`
Expected: PASS

**Step 4: Commit**

```bash
git add app/(admin)/admin/analytics/components/cliff-detail-panel.tsx app/(admin)/admin/analytics/components/cliff-timeline.tsx
git commit -m "feat: add cliff detail panel with timeline visualization"
```

---

## Task 10: UI — Bulk Detection Dialog

**Files:**
- Create: `app/(admin)/admin/analytics/components/bulk-cliff-dialog.tsx`

**Step 1: Create the bulk results dialog**

```typescript
// Props:
//   open: boolean
//   onOpenChange: (open: boolean) => void
//   results: { summary, results[] } from bulk API
//   onApplyAllHigh: () => Promise<void>  // Apply all high-confidence detections

// Structure:
// <Dialog>
//   <DialogContent>
//     <DialogHeader>
//       <DialogTitle>Formal End Detection — Bulk Results</DialogTitle>
//     </DialogHeader>
//
//     {/* Summary stats */}
//     <div className="grid grid-cols-2 gap-4">
//       <stat card>Scanned: {summary.total}</stat>
//       <stat card>Cliffs Detected: {summary.detected}</stat>
//       <stat card>High Confidence: {summary.highConfidence}</stat>
//       <stat card>Students Impacted: {summary.totalStudentsImpacted}</stat>
//     </div>
//
//     {/* Results list — scrollable */}
//     <ScrollArea className="max-h-[300px]">
//       {results.map(r => (
//         <row showing: title, status badge, confidence, effectiveEndMinutes>
//       ))}
//     </ScrollArea>
//
//     <DialogFooter>
//       <Button onClick={onApplyAllHigh} disabled={summary.highConfidence === 0}>
//         Apply All High-Confidence ({summary.highConfidence})
//       </Button>
//     </DialogFooter>
//   </DialogContent>
// </Dialog>
```

**Step 2: Verify build**

Run: `npm run build`
Expected: PASS

**Step 3: Commit**

```bash
git add app/(admin)/admin/analytics/components/bulk-cliff-dialog.tsx
git commit -m "feat: add bulk cliff detection results dialog"
```

---

## Task 11: Wire Up UI Components in Meetings Manager

**Files:**
- Modify: `app/(admin)/admin/analytics/components/meetings-manager-tab.tsx`

**Step 1: Import and render the new components**

Add imports:
```typescript
import { CliffDetailPanel } from './cliff-detail-panel';
import { BulkCliffDialog } from './bulk-cliff-dialog';
```

Add at the bottom of the component JSX (before the closing fragment/div):
```tsx
{/* Cliff Detail Panel */}
<CliffDetailPanel
  open={cliffDetailOpen}
  onOpenChange={setCliffDetailOpen}
  meeting={selectedCliffMeeting}
  onApply={handleApplyCliff}
  onDismiss={handleDismissCliff}
/>

{/* Bulk Cliff Detection Dialog */}
<BulkCliffDialog
  open={bulkDialogOpen}
  onOpenChange={setBulkDialogOpen}
  results={bulkResults}
  onApplyAllHigh={handleApplyAllHighConfidence}
/>
```

**Step 2: Add handler functions**

```typescript
const handleApplyCliff = useCallback(async (sessionId: string, formalEndMinutes: number) => {
  const meeting = meetings.find((m) => m.linkedSessionId === sessionId);
  if (!meeting) return;

  try {
    const res = await fetch('/api/admin/analytics/apply-cliff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        formalEndMinutes,
        zoomMeetingUuid: meeting.uuid,
      }),
    });

    if (!res.ok) throw new Error('Apply failed');

    const data = await res.json();
    toast.success(`Formal end applied: ${formalEndMinutes} min. ${data.attendance.imported} students recalculated.`);

    // Update local state
    setMeetings((prev) =>
      prev.map((m) =>
        m.linkedSessionId === sessionId
          ? { ...m, formalEndMinutes, cliffDetection: { ...m.cliffDetection!, appliedAt: new Date().toISOString() } }
          : m
      )
    );
    setCliffDetailOpen(false);
  } catch {
    toast.error('Failed to apply formal end');
  }
}, [meetings]);

const handleDismissCliff = useCallback(async (sessionId: string) => {
  const meeting = meetings.find((m) => m.linkedSessionId === sessionId);
  if (!meeting) return;

  try {
    const res = await fetch('/api/admin/analytics/apply-cliff', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, zoomMeetingUuid: meeting.uuid }),
    });

    if (!res.ok) throw new Error('Dismiss failed');

    toast.success('Cliff dismissed. Attendance recalculated with full duration.');
    setMeetings((prev) =>
      prev.map((m) =>
        m.linkedSessionId === sessionId
          ? { ...m, formalEndMinutes: null, cliffDetection: { ...m.cliffDetection!, dismissed: true } }
          : m
      )
    );
    setCliffDetailOpen(false);
  } catch {
    toast.error('Failed to dismiss cliff');
  }
}, [meetings]);

const handleApplyAllHighConfidence = useCallback(async () => {
  if (!bulkResults?.results) return;

  const highConfidence = bulkResults.results.filter(
    (r) => r.status === 'detected' && r.confidence === 'high'
  );

  let applied = 0;
  for (const result of highConfidence) {
    const meeting = meetings.find((m) => m.linkedSessionId === result.sessionId);
    if (!meeting || !result.effectiveEndMinutes) continue;

    try {
      await fetch('/api/admin/analytics/apply-cliff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: result.sessionId,
          formalEndMinutes: result.effectiveEndMinutes,
          zoomMeetingUuid: meeting.uuid,
        }),
      });
      applied++;
    } catch {
      // Continue with next
    }
  }

  toast.success(`Applied formal end to ${applied} sessions. Attendance recalculated.`);
  setBulkDialogOpen(false);
  syncFromZoom(); // Refresh data
}, [bulkResults, meetings, syncFromZoom]);
```

**Step 3: Verify build**

Run: `npm run build`
Expected: PASS

**Step 4: Commit**

```bash
git add app/(admin)/admin/analytics/components/meetings-manager-tab.tsx
git commit -m "feat: wire up cliff detection UI — detail panel, bulk dialog, handlers"
```

---

## Task 12: Cliff Badge in Student Attendance Tab

**Files:**
- Modify: `app/(admin)/admin/analytics/components/student-attendance-tab.tsx` (lines 99-100)

**Step 1: Update SessionDetail interface (line 32-41)**

Add:
```typescript
formalEndMinutes?: number | null;
totalMeetingDuration?: number | null;
```

**Step 2: Pass cliff data from API response**

In the data fetching logic, ensure the API response includes `formal_end_minutes` for each session. This may require updating the `student-attendance` API route to include `formal_end_minutes` in its session query.

Modify `app/api/admin/analytics/student-attendance/route.ts`:
- Add `formal_end_minutes` to the sessions SELECT query
- Include it in the response per session

**Step 3: Add cliff badge in SessionCard (after line 99)**

```tsx
{session.formalEndMinutes && session.totalMeetingDuration && (
  <>
    <span>·</span>
    <span className="text-emerald-500">
      ⚡ Formal: {session.formalEndMinutes}m (of {session.totalMeetingDuration}m)
    </span>
  </>
)}
```

**Step 4: Verify build**

Run: `npm run build`
Expected: PASS

**Step 5: Commit**

```bash
git add app/(admin)/admin/analytics/components/student-attendance-tab.tsx app/api/admin/analytics/student-attendance/route.ts
git commit -m "feat: show cliff badge on session cards in student attendance tab"
```

---

## Task 13: Final Build Verification + BUG_PROGRESS.md Update

**Files:**
- Modify: `BUG_PROGRESS.md`

**Step 1: Full build check**

Run: `npm run build`
Expected: PASS with 0 TypeScript errors

**Step 2: Run lint**

Run: `npm run lint`
Expected: PASS (only pre-existing warnings in untouched files)

**Step 3: Update BUG_PROGRESS.md**

Add Session 12 entry documenting:
- Feature: Cliff Detection — Automatic Formal End Detection
- Algorithm summary (final departure analysis, sliding window, multi-criteria validation)
- Files created (6 new) and modified (4 existing)
- Lessons learned

**Step 4: Commit**

```bash
git add BUG_PROGRESS.md
git commit -m "docs: add Session 12 — cliff detection feature to BUG_PROGRESS.md"
```

---

## Execution Order & Dependencies

```
Task 1 (migration) ─────────────────────────────────────────┐
Task 2 (cliff-detector.ts) ─────┐                           │
Task 3 (calculator update) ──────┤                           │
                                  ├── Task 4 (detect-cliff API)
                                  ├── Task 5 (apply-cliff API)
                                  └── Task 6 (bulk detect API)
                                           │
Task 7 (sync-zoom response) ──────────────┤
                                           │
                                  Task 8 (meetings table UI)
                                           │
                        ┌──────────────────┤
                        │                  │
              Task 9 (detail panel)  Task 10 (bulk dialog)
                        │                  │
                        └──────────────────┤
                                           │
                                  Task 11 (wire up UI)
                                           │
                                  Task 12 (attendance badge)
                                           │
                                  Task 13 (verification)
```

**Parallelizable groups:**
- Tasks 1, 2 can run in parallel
- Tasks 4, 5, 6 can run in parallel (all depend on 2+3)
- Tasks 9, 10 can run in parallel
- Tasks 8, 12 can run in parallel (both are UI additions to different components)

**Estimated total: 13 tasks, ~11 new/modified files, ~1,200 lines of code**
