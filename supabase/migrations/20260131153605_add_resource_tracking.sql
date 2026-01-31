-- Migration: Add Resource Tracking (Progress & Favorites)
-- Created: 2026-01-31

-- Table: resource_progress
-- Track user's viewing and completion status for learning resources
CREATE TABLE IF NOT EXISTS resource_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  resource_id UUID NOT NULL REFERENCES module_resources(id) ON DELETE CASCADE,
  is_completed BOOLEAN DEFAULT FALSE NOT NULL,
  last_viewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  progress_seconds INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE(user_id, resource_id)
);

-- Table: resource_favorites
-- Track user's bookmarked/favorited resources
CREATE TABLE IF NOT EXISTS resource_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  resource_id UUID NOT NULL REFERENCES module_resources(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE(user_id, resource_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_resource_progress_user_id ON resource_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_resource_progress_resource_id ON resource_progress(resource_id);
CREATE INDEX IF NOT EXISTS idx_resource_progress_last_viewed ON resource_progress(last_viewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_resource_favorites_user_id ON resource_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_resource_favorites_resource_id ON resource_favorites(resource_id);

-- RLS Policies for resource_progress
ALTER TABLE resource_progress ENABLE ROW LEVEL SECURITY;

-- Users can view their own progress
CREATE POLICY "Users can view their own resource progress"
  ON resource_progress
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own progress
CREATE POLICY "Users can insert their own resource progress"
  ON resource_progress
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own progress
CREATE POLICY "Users can update their own resource progress"
  ON resource_progress
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own progress
CREATE POLICY "Users can delete their own resource progress"
  ON resource_progress
  FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for resource_favorites
ALTER TABLE resource_favorites ENABLE ROW LEVEL SECURITY;

-- Users can view their own favorites
CREATE POLICY "Users can view their own favorites"
  ON resource_favorites
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own favorites
CREATE POLICY "Users can insert their own favorites"
  ON resource_favorites
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own favorites
CREATE POLICY "Users can delete their own favorites"
  ON resource_favorites
  FOR DELETE
  USING (auth.uid() = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_resource_progress_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at on resource_progress
CREATE TRIGGER resource_progress_updated_at
  BEFORE UPDATE ON resource_progress
  FOR EACH ROW
  EXECUTE FUNCTION update_resource_progress_updated_at();

-- Comments for documentation
COMMENT ON TABLE resource_progress IS 'Tracks user progress and completion status for learning resources';
COMMENT ON TABLE resource_favorites IS 'Tracks user bookmarked/favorited learning resources';
COMMENT ON COLUMN resource_progress.progress_seconds IS 'Current playback position in seconds (for videos)';
COMMENT ON COLUMN resource_progress.is_completed IS 'Whether user has marked resource as completed';
COMMENT ON COLUMN resource_progress.last_viewed_at IS 'Last time user viewed this resource';
