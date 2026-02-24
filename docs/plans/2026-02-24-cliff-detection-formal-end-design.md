# Cliff Detection: Automatic Formal Session End Detection

**Date**: 2026-02-24
**Status**: Approved
**Model**: Claude Opus 4.6

---

## Problem

Zoom meetings run longer than the "formal" session because the instructor tells students the session has ended and they can leave, but stays online for optional QnA. Students who leave when told "session is over" get penalized in attendance percentage because the denominator uses the full Zoom meeting duration (including QnA time).

**Example**: 4.5-hour session, instructor says "done" at 3h 50m, QnA runs 40 more minutes.
- Student who left at 230 min: 230/270 = 85% (should be 100%)
- Student who stayed for QnA: 270/270 = 100%

## Solution

Automatically detect the "formal end" by analyzing the departure pattern. When an instructor says "session is over," it creates a **mass exodus** — a statistically detectable cluster of students leaving within a ~10-minute window. Use that timestamp as the effective session duration.

**Hybrid approach**: Auto-detect + admin confirm/adjust.

---

## Algorithm: Cliff Detection

### Data Source

Zoom Past Meeting Participants API provides per-participant join/leave timestamps. The attendance calculator already groups these into resolved participants with segments.

### Core Insight

Use each participant's **final leave time** (last segment's leave_time). This naturally filters out breaks — a student who took 3 breaks but left for good at 230 min has final_leave = 230. Break segments are invisible.

### Steps

**Step 1: Classify final departures**

For each resolved participant:
- `final_leave >= meeting_end - 2 min` → "meeting-end stayer" (QnA attendee, excluded)
- `final_leave < meeting_end - 2 min` → "final departure" (included in cliff analysis)

**Step 2: Sliding window scan**

- Sort final departures by time
- Only scan the last 50% of the meeting (cliff can't be in the first half)
- 10-minute sliding window
- Find the window with the maximum departure count

**Step 3: Validate the cliff**

All must pass:

| Rule | Threshold | Purpose |
|------|-----------|---------|
| Minimum ratio | ≥ 25% of departures (≥ 30% if < 20 students) | Real cluster, not noise |
| Minimum absolute | ≥ 3 (≥ 5 if > 30 students) | Statistical significance |
| Spike ratio | ≥ 2.5x background rate | Stands out from normal attrition |
| Position | After 50% of meeting duration | Late-session "wrap up" only |

If no window passes all four → no cliff detected → current behavior (full duration).

**Step 4: Effective end time**

`effective_end = cliff_window_start` (generous — anyone present when exodus began gets full credit)

**Step 5: Confidence scoring**

| Level | Criteria | Admin action |
|-------|----------|-------------|
| High | ≥ 50% ratio, ≥ 8 students, ≥ 5x spike | Auto-apply (with undo) |
| Medium | ≥ 35% ratio OR (≥ 6 students AND ≥ 3x spike) | Suggest, ask confirm |
| Low | Passes validation but doesn't meet medium | Suggest with warning |

**Step 6: Build histogram for UI** (5-minute buckets for visualization)

### Edge Cases

| Scenario | Outcome | Correct? |
|----------|---------|----------|
| No QnA, clean ending | All stayers, no departures → no cliff | ✓ |
| 20-min break, 15 students | Final departure is later → break invisible | ✓ |
| Multiple scattered breaks | Same — final departure matters | ✓ |
| 8-student session | Adaptive thresholds (30%, 3 min) | ✓ |
| 80-student session, big cliff | High confidence, auto-applied | ✓ |
| Gradual trickle, no announcement | No cluster → no cliff | ✓ |
| Very short QnA (5 min) | Small but correct improvement | ✓ |
| Very long QnA (60+ min) | Major improvement — primary use case | ✓ |
| Network glitch at 30 min | At <50% of session → rejected | ✓ |
| Bad session, steady attrition | No clear cluster → no cliff | ✓ |

---

## Data Model

### Database Changes

```sql
-- Migration: 024_cliff_detection.sql

ALTER TABLE sessions ADD COLUMN formal_end_minutes INTEGER;
-- NULL = no cliff applied, >0 = effective duration after removing QnA
-- This becomes the highest-priority denominator for attendance calculation

ALTER TABLE sessions ADD COLUMN cliff_detection JSONB;
-- Full detection result for UI display and audit trail
-- NULL = never analyzed
-- Contains: detected, confidence, effectiveEndMinutes, histogram, etc.
```

### Duration Resolution Priority (Updated)

```
1. formal_end_minutes       ← NEW (cliff-adjusted, highest priority)
2. actualDurationMinutes    (caller override)
3. Zoom API (end - start)
4. actual_duration_minutes  (saved from sync)
5. duration_minutes         (scheduled)
```

### cliff_detection JSON Schema

```json
{
  "detected": true,
  "confidence": "high",
  "effectiveEndMinutes": 230,
  "cliffWindowStart": 228,
  "cliffWindowEnd": 238,
  "departuresInCliff": 35,
  "totalFinalDepartures": 42,
  "meetingEndStayers": 18,
  "totalParticipants": 60,
  "cliffRatio": 0.83,
  "spikeRatio": 8.7,
  "studentsImpacted": 28,
  "dismissed": false,
  "appliedAt": "2026-02-24T10:00:00Z",
  "histogram": [
    { "minute": 0, "departures": 0, "isCliff": false },
    { "minute": 5, "departures": 1, "isCliff": false },
    ...
  ]
}
```

---

## Admin UI Design

### A: Meetings Manager Table — Cliff Column

New column in existing meetings table:

- `⚡ 230m` — High confidence, applied (green badge)
- `⏳ 170m` — Medium/low, needs review (amber badge)
- `— none` — No cliff detected (gray text)

Clicking the badge opens the Cliff Detail Panel.

### B: Cliff Detail Panel (Sheet)

Side panel showing:
1. **Detection summary**: confidence, departure counts, spike ratio
2. **Departure timeline**: Bar chart (Tailwind-only, no chart library) showing departures over time with cliff highlighted
3. **Impact preview**: Number of students affected, before/after average attendance
4. **Editable duration**: Admin can adjust the detected value
5. **Actions**: [Apply & Recalculate] [Dismiss]

### C: Bulk Detection

Header button: `[⚡ Detect Formal Ends]`

Scans all linked sessions with attendance data:
- Shows summary (detected/high/medium/low/none counts)
- "Apply All High-Confidence" auto-applies and recalculates
- Individual review for medium/low confidence

### D: Session Cliff Badge

In student attendance tab, sessions with cliff show: `⚡ Formal: 230 min (of 270)`

---

## API Routes

### New: POST `/api/admin/analytics/detect-cliff`

Single session cliff detection.

**Body**: `{ sessionId, zoomMeetingUuid }`
**Response**: `{ cliff_detection JSON, effectiveEndMinutes }`

### New: POST `/api/admin/analytics/detect-cliffs-bulk`

Bulk detection across all sessions.

**Response**: `{ summary, results[] }`

### Modified: POST `/api/admin/analytics/calculate-attendance`

Updated duration resolution to check `formal_end_minutes` first.

### New: POST `/api/admin/analytics/apply-cliff`

Apply detected cliff to a session.

**Body**: `{ sessionId, formalEndMinutes }` (can differ from detected if admin edits)
**Response**: Recalculated attendance results.

---

## New Files

| File | Purpose | Est. Lines |
|------|---------|-----------|
| `lib/services/cliff-detector.ts` | Pure detection algorithm | ~200 |
| `supabase/migrations/024_cliff_detection.sql` | Schema changes | ~10 |
| `app/api/admin/analytics/detect-cliff/route.ts` | Single session detection | ~60 |
| `app/api/admin/analytics/detect-cliffs-bulk/route.ts` | Bulk detection | ~80 |
| `app/api/admin/analytics/apply-cliff/route.ts` | Apply & recalculate | ~50 |
| `app/(admin)/admin/analytics/components/cliff-detail-panel.tsx` | Detail UI | ~250 |
| `app/(admin)/admin/analytics/components/cliff-timeline.tsx` | Histogram visualization | ~100 |
| `app/(admin)/admin/analytics/components/bulk-cliff-dialog.tsx` | Bulk detection UI | ~150 |

**Modified files**:
| File | Change |
|------|--------|
| `lib/services/attendance-calculator.ts` | Duration priority chain update |
| `app/(admin)/admin/analytics/components/meetings-manager-tab.tsx` | Cliff column + badge |
| `app/(admin)/admin/analytics/components/student-attendance-tab.tsx` | Cliff badge on sessions |

---

## Retroactive Fix

1. Zoom API retains participant data for 6 months
2. Bulk detect endpoint re-fetches participant data for each session
3. Admin reviews and applies via UI
4. Sessions older than 6 months cannot be retroactively analyzed (warn in UI)

---

## Success Criteria

1. Cliff detection correctly identifies formal end in sessions with QnA
2. Breaks (students who rejoin) do not trigger false cliffs
3. Admin can review, adjust, and apply with one click
4. Past sessions get corrected attendance percentages
5. Students who attended the formal session see ~100% attendance
6. Zero false positives on sessions without QnA
