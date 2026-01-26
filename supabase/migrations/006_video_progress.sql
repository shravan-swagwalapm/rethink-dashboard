-- Migration 006: Video Progress and Captions
-- Description: Add tables for tracking video watch progress and managing captions

-- ===========================================================================
-- TABLE: video_progress
-- Purpose: Track user progress for video resources (position, completion, etc.)
-- ===========================================================================

CREATE TABLE IF NOT EXISTS video_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  resource_id UUID NOT NULL REFERENCES module_resources(id) ON DELETE CASCADE,
  last_position_seconds INT NOT NULL DEFAULT 0,
  watch_percentage DECIMAL(5,2) DEFAULT 0 CHECK (watch_percentage >= 0 AND watch_percentage <= 100),
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  last_watched_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, resource_id)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_video_progress_user_id ON video_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_video_progress_resource_id ON video_progress(resource_id);
CREATE INDEX IF NOT EXISTS idx_video_progress_user_resource ON video_progress(user_id, resource_id);
CREATE INDEX IF NOT EXISTS idx_video_progress_completed ON video_progress(completed);
CREATE INDEX IF NOT EXISTS idx_video_progress_last_watched ON video_progress(last_watched_at DESC);

-- ===========================================================================
-- TABLE: video_watch_history (Optional - for analytics)
-- Purpose: Track individual watch sessions for analytics
-- ===========================================================================

CREATE TABLE IF NOT EXISTS video_watch_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  resource_id UUID NOT NULL REFERENCES module_resources(id) ON DELETE CASCADE,
  session_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  session_end TIMESTAMPTZ,
  watch_duration_seconds INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_video_watch_history_user_id ON video_watch_history(user_id);
CREATE INDEX IF NOT EXISTS idx_video_watch_history_resource_id ON video_watch_history(resource_id);
CREATE INDEX IF NOT EXISTS idx_video_watch_history_session_start ON video_watch_history(session_start DESC);

-- ===========================================================================
-- TABLE: video_captions
-- Purpose: Store caption/subtitle tracks for videos
-- ===========================================================================

CREATE TABLE IF NOT EXISTS video_captions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id UUID NOT NULL REFERENCES module_resources(id) ON DELETE CASCADE,
  language_code VARCHAR(10) NOT NULL, -- ISO 639-1 codes: 'en', 'es', 'hi', 'fr', etc.
  language_label VARCHAR(50) NOT NULL, -- Display name: 'English', 'Spanish', 'Hindi', etc.
  caption_url TEXT NOT NULL, -- URL to VTT/SRT file (Google Drive, Supabase Storage, or CDN)
  google_drive_id TEXT, -- Optional: If caption file is hosted on Google Drive
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(resource_id, language_code)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_video_captions_resource_id ON video_captions(resource_id);
CREATE INDEX IF NOT EXISTS idx_video_captions_language ON video_captions(language_code);

-- ===========================================================================
-- ROW LEVEL SECURITY (RLS)
-- ===========================================================================

-- Enable RLS
ALTER TABLE video_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_watch_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_captions ENABLE ROW LEVEL SECURITY;

-- video_progress policies
CREATE POLICY "Users can view own video progress"
  ON video_progress
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own video progress"
  ON video_progress
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own video progress"
  ON video_progress
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own video progress"
  ON video_progress
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all video progress"
  ON video_progress
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'company_user')
    )
  );

-- video_watch_history policies
CREATE POLICY "Users can manage own watch history"
  ON video_watch_history
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all watch history"
  ON video_watch_history
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'company_user')
    )
  );

-- video_captions policies
CREATE POLICY "Everyone can view captions"
  ON video_captions
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage captions"
  ON video_captions
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'company_user')
    )
  );

-- ===========================================================================
-- FUNCTIONS
-- ===========================================================================

-- Function to automatically update completed status when watch_percentage >= 90
CREATE OR REPLACE FUNCTION update_video_completion()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.watch_percentage >= 90 AND NOT NEW.completed THEN
    NEW.completed = true;
    NEW.completed_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for auto-completion
DROP TRIGGER IF EXISTS trigger_update_video_completion ON video_progress;
CREATE TRIGGER trigger_update_video_completion
  BEFORE INSERT OR UPDATE OF watch_percentage
  ON video_progress
  FOR EACH ROW
  EXECUTE FUNCTION update_video_completion();

-- Function to get video progress summary for a user
CREATE OR REPLACE FUNCTION get_user_video_stats(target_user_id UUID DEFAULT NULL)
RETURNS TABLE (
  total_videos BIGINT,
  completed_videos BIGINT,
  in_progress_videos BIGINT,
  completion_rate NUMERIC
) AS $$
DECLARE
  user_id_to_check UUID;
BEGIN
  -- Use provided user_id or default to current user
  user_id_to_check := COALESCE(target_user_id, auth.uid());

  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as total_videos,
    COUNT(*) FILTER (WHERE completed = true)::BIGINT as completed_videos,
    COUNT(*) FILTER (WHERE completed = false)::BIGINT as in_progress_videos,
    CASE
      WHEN COUNT(*) > 0 THEN
        ROUND((COUNT(*) FILTER (WHERE completed = true)::NUMERIC / COUNT(*)::NUMERIC) * 100, 2)
      ELSE 0
    END as completion_rate
  FROM video_progress
  WHERE user_id = user_id_to_check;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===========================================================================
-- COMMENTS
-- ===========================================================================

COMMENT ON TABLE video_progress IS 'Tracks user progress for video resources including position, completion status, and watch percentage';
COMMENT ON TABLE video_watch_history IS 'Logs individual watch sessions for analytics and reporting';
COMMENT ON TABLE video_captions IS 'Stores caption/subtitle tracks for videos in multiple languages';

COMMENT ON COLUMN video_progress.last_position_seconds IS 'Last playback position in seconds for resume functionality';
COMMENT ON COLUMN video_progress.watch_percentage IS 'Percentage of video watched (0-100)';
COMMENT ON COLUMN video_progress.completed IS 'Automatically set to true when watch_percentage >= 90';
COMMENT ON COLUMN video_captions.language_code IS 'ISO 639-1 language code (e.g., en, es, hi, fr)';
COMMENT ON COLUMN video_captions.caption_url IS 'URL to VTT/SRT caption file';
