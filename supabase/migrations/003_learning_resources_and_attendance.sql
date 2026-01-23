-- Migration: Learning Resources and Attendance Improvements
-- This migration adds support for:
-- 1. Module resources (videos, PPTs, notes from Google Drive)
-- 2. User email aliases for attendance matching
-- 3. Attendance segments for tracking join/leave events

-- ============================================
-- PART 1: LEARNING RESOURCES
-- ============================================

-- Module resources table for storing Google Drive content
CREATE TABLE IF NOT EXISTS module_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID REFERENCES learning_modules(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('video', 'slides', 'document', 'link')),
  google_drive_id TEXT,
  external_url TEXT,
  duration_seconds INT,
  thumbnail_url TEXT,
  order_index INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for module resources
CREATE INDEX IF NOT EXISTS idx_module_resources_module ON module_resources(module_id);
CREATE INDEX IF NOT EXISTS idx_module_resources_type ON module_resources(content_type);

-- Enable RLS
ALTER TABLE module_resources ENABLE ROW LEVEL SECURITY;

-- Everyone can view module resources
CREATE POLICY "Everyone can view module resources"
  ON module_resources FOR SELECT
  TO authenticated
  USING (true);

-- Admins can manage module resources
CREATE POLICY "Admins can manage module resources"
  ON module_resources FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'company_user')
    )
  );

-- ============================================
-- PART 2: ATTENDANCE IMPROVEMENTS
-- ============================================

-- User email aliases for matching different email addresses
CREATE TABLE IF NOT EXISTS user_email_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  alias_email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(alias_email)
);

-- Index for email alias lookups
CREATE INDEX IF NOT EXISTS idx_user_email_aliases_email ON user_email_aliases(alias_email);
CREATE INDEX IF NOT EXISTS idx_user_email_aliases_user ON user_email_aliases(user_id);

-- Enable RLS
ALTER TABLE user_email_aliases ENABLE ROW LEVEL SECURITY;

-- Admins can manage email aliases
CREATE POLICY "Admins can manage email aliases"
  ON user_email_aliases FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'company_user')
    )
  );

-- Attendance segments for tracking individual join/leave events
CREATE TABLE IF NOT EXISTS attendance_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_id UUID REFERENCES attendance(id) ON DELETE CASCADE,
  join_time TIMESTAMPTZ NOT NULL,
  leave_time TIMESTAMPTZ,
  duration_seconds INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for attendance segments
CREATE INDEX IF NOT EXISTS idx_attendance_segments_attendance ON attendance_segments(attendance_id);

-- Enable RLS
ALTER TABLE attendance_segments ENABLE ROW LEVEL SECURITY;

-- Everyone can view their own attendance segments
CREATE POLICY "Users can view attendance segments"
  ON attendance_segments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM attendance
      WHERE attendance.id = attendance_segments.attendance_id
      AND attendance.user_id = auth.uid()
    )
  );

-- Admins can manage attendance segments
CREATE POLICY "Admins can manage attendance segments"
  ON attendance_segments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'company_user')
    )
  );
