-- Migration: Zoom and Google Calendar Integration
-- This migration adds support for:
-- 1. Google Calendar OAuth token storage
-- 2. Zoom meeting import logging
-- 3. Session enhancements for calendar/zoom tracking

-- Calendar tokens for Google Calendar OAuth
CREATE TABLE IF NOT EXISTS calendar_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  calendar_email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for token refresh queries
CREATE INDEX IF NOT EXISTS idx_calendar_tokens_expires ON calendar_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_calendar_tokens_user ON calendar_tokens(user_id);

-- Zoom import tracking
CREATE TABLE IF NOT EXISTS zoom_import_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zoom_meeting_id TEXT NOT NULL,
  zoom_meeting_uuid TEXT,
  meeting_topic TEXT,
  meeting_start_time TIMESTAMPTZ,
  session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'skipped')),
  participants_imported INT DEFAULT 0,
  error_message TEXT,
  imported_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for import log queries
CREATE INDEX IF NOT EXISTS idx_zoom_import_meeting ON zoom_import_logs(zoom_meeting_id);
CREATE INDEX IF NOT EXISTS idx_zoom_import_session ON zoom_import_logs(session_id);

-- Add calendar sync tracking to sessions
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS calendar_event_id TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS zoom_start_url TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS auto_create_zoom BOOLEAN DEFAULT false;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS send_calendar_invites BOOLEAN DEFAULT false;

-- Enable RLS on new tables
ALTER TABLE calendar_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE zoom_import_logs ENABLE ROW LEVEL SECURITY;

-- Calendar tokens policies (admin only)
CREATE POLICY "Admin can manage calendar tokens" ON calendar_tokens
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'company_user')
    )
  );

-- Zoom import logs policies (admin only)
CREATE POLICY "Admin can manage zoom import logs" ON zoom_import_logs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'company_user')
    )
  );
