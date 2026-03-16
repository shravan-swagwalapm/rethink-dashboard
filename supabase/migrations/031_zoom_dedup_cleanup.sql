-- 031: Zoom meeting deduplication cleanup
-- Removes duplicate sessions sharing the same zoom_meeting_id,
-- resets suspiciously short durations, and adds a unique constraint.

-- (a) Delete duplicate sessions, keeping the one with most attendance records per zoom_meeting_id
-- Tiebreaker: prefer sessions with a cohort_id, then newest
WITH ranked AS (
  SELECT
    s.id,
    s.zoom_meeting_id,
    COALESCE(ac.cnt, 0) AS attendance_count,
    ROW_NUMBER() OVER (
      PARTITION BY s.zoom_meeting_id
      ORDER BY COALESCE(ac.cnt, 0) DESC,
               (s.cohort_id IS NOT NULL) DESC,
               s.created_at DESC
    ) AS rn
  FROM sessions s
  LEFT JOIN (
    SELECT session_id, COUNT(*) AS cnt FROM attendance GROUP BY session_id
  ) ac ON ac.session_id = s.id
  WHERE s.zoom_meeting_id IS NOT NULL
),
losers AS (
  SELECT id FROM ranked WHERE rn > 1
)
DELETE FROM sessions WHERE id IN (SELECT id FROM losers);

-- (b) Reset suspiciously low durations on Zoom sessions so next sync picks up correct values
UPDATE sessions
SET actual_duration_minutes = NULL
WHERE actual_duration_minutes IS NOT NULL
  AND actual_duration_minutes < 10
  AND zoom_meeting_id IS NOT NULL;

-- (c) Partial unique index — prevents future duplicates, allows multiple NULLs
CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_zoom_meeting_id_unique
  ON sessions (zoom_meeting_id)
  WHERE zoom_meeting_id IS NOT NULL;
