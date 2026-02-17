-- 025_login_events.sql
-- Track every authentication event for LMS usage analytics

CREATE TABLE IF NOT EXISTS login_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  login_method TEXT NOT NULL CHECK (login_method IN ('phone_otp', 'google_oauth', 'magic_link')),
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for querying by user (student detail tab)
CREATE INDEX idx_login_events_user_id ON login_events(user_id);

-- Index for date-range queries (all tabs use date filters)
CREATE INDEX idx_login_events_created_at ON login_events(created_at);

-- Composite index for user+date queries (cohort tab student rows)
CREATE INDEX idx_login_events_user_date ON login_events(user_id, created_at);

-- No RLS needed — only queried by admin routes via createAdminClient()
