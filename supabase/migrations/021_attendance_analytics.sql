-- Migration 021: Attendance Analytics
-- Adds columns to sessions table for smart attendance tracking:
-- 1. counts_for_students: admin toggle to include/exclude meetings from student attendance
-- 2. actual_duration_minutes: override for real meeting duration (vs scheduled)

-- Add counts_for_students flag (defaults to false — admin must explicitly enable)
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS counts_for_students BOOLEAN DEFAULT false;

-- Add actual_duration_minutes (nullable — falls back to duration_minutes when NULL)
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS actual_duration_minutes INTEGER;

-- Auto-enable counts_for_students for sessions that already have a zoom_meeting_id
-- These were created via admin and are real meetings that should count
UPDATE sessions
SET counts_for_students = true
WHERE zoom_meeting_id IS NOT NULL
  AND counts_for_students = false;

-- Index for efficient filtering of countable sessions
CREATE INDEX IF NOT EXISTS idx_sessions_counts_for_students
  ON sessions(counts_for_students)
  WHERE counts_for_students = true;
