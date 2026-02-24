-- 026_cliff_detection.sql
-- Adds cliff detection fields to sessions table for automatic formal end detection.
-- formal_end_minutes: effective session duration after removing QnA (highest-priority denominator)
-- cliff_detection: full detection result JSON for UI display and audit trail

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS formal_end_minutes INTEGER;
COMMENT ON COLUMN sessions.formal_end_minutes IS 'Effective session duration after removing QnA. Highest priority denominator for attendance calculation. NULL = not applied.';

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS cliff_detection JSONB;
COMMENT ON COLUMN sessions.cliff_detection IS 'Full cliff detection result from departure analysis. Contains: detected, confidence, histogram, etc. NULL = never analyzed.';
