-- Migration: Create OTP Authentication Tables
-- Description: Add tables for OTP-based authentication with rate limiting
-- Date: 2026-02-02
-- Author: Claude (OTP Authentication Implementation)

-- =====================================================
-- Table: otp_codes
-- Purpose: Store OTP codes with expiry and attempt tracking
-- =====================================================

CREATE TABLE IF NOT EXISTS otp_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL,                    -- phone number or email
  identifier_type TEXT NOT NULL CHECK (identifier_type IN ('phone', 'email')),
  code TEXT NOT NULL,                          -- 6-digit OTP or 'MSG91_MANAGED'
  expires_at TIMESTAMPTZ NOT NULL,             -- 5 minutes from creation
  attempts INT DEFAULT 0,                      -- failed verification attempts
  verified BOOLEAN DEFAULT FALSE,              -- true when successfully verified
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint on identifier and code combination
  CONSTRAINT otp_codes_identifier_code_unique UNIQUE (identifier, code)
);

-- Index for fast lookups by identifier and type
CREATE INDEX IF NOT EXISTS otp_codes_identifier_type_created_idx
  ON otp_codes(identifier, identifier_type, created_at DESC);

-- Index for cleanup queries (expired OTPs)
CREATE INDEX IF NOT EXISTS otp_codes_expires_at_idx
  ON otp_codes(expires_at);

-- Row Level Security
ALTER TABLE otp_codes ENABLE ROW LEVEL SECURITY;

-- Policy: Service role only (no direct access from client)
CREATE POLICY "Service role can manage OTPs"
  ON otp_codes
  FOR ALL
  USING (auth.role() = 'service_role');

-- =====================================================
-- Table: otp_rate_limits
-- Purpose: Track and enforce rate limits on OTP requests
-- =====================================================

CREATE TABLE IF NOT EXISTS otp_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL,                    -- phone number or email
  identifier_type TEXT NOT NULL CHECK (identifier_type IN ('phone', 'email')),
  request_count INT DEFAULT 1,                 -- number of requests in current window
  window_start TIMESTAMPTZ DEFAULT NOW(),      -- start of current rate limit window
  blocked_until TIMESTAMPTZ,                   -- null = not blocked, otherwise blocked until this time
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint on identifier and type
  CONSTRAINT otp_rate_limits_identifier_unique UNIQUE (identifier, identifier_type)
);

-- Index for fast lookups and cleanup
CREATE INDEX IF NOT EXISTS otp_rate_limits_identifier_type_idx
  ON otp_rate_limits(identifier, identifier_type);

CREATE INDEX IF NOT EXISTS otp_rate_limits_blocked_until_idx
  ON otp_rate_limits(blocked_until)
  WHERE blocked_until IS NOT NULL;

-- Row Level Security
ALTER TABLE otp_rate_limits ENABLE ROW LEVEL SECURITY;

-- Policy: Service role only
CREATE POLICY "Service role can manage rate limits"
  ON otp_rate_limits
  FOR ALL
  USING (auth.role() = 'service_role');

-- =====================================================
-- Function: Cleanup expired OTPs
-- Purpose: Auto-delete expired OTP codes (runs periodically)
-- =====================================================

CREATE OR REPLACE FUNCTION cleanup_expired_otps()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM otp_codes
  WHERE expires_at < NOW();

  -- Also cleanup old rate limit records (older than 24 hours and not blocked)
  DELETE FROM otp_rate_limits
  WHERE window_start < NOW() - INTERVAL '24 hours'
    AND blocked_until IS NULL;
END;
$$;

-- =====================================================
-- Function: Update updated_at timestamp
-- Purpose: Automatically update updated_at on row changes
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Trigger for otp_rate_limits
CREATE TRIGGER update_otp_rate_limits_updated_at
  BEFORE UPDATE ON otp_rate_limits
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- Comments for documentation
-- =====================================================

COMMENT ON TABLE otp_codes IS 'Stores OTP codes for phone/email authentication with expiry tracking';
COMMENT ON TABLE otp_rate_limits IS 'Enforces rate limits on OTP requests to prevent abuse';
COMMENT ON FUNCTION cleanup_expired_otps() IS 'Removes expired OTP codes and old rate limit records';

-- =====================================================
-- Grant necessary permissions
-- =====================================================

-- Grant service role full access
GRANT ALL ON otp_codes TO service_role;
GRANT ALL ON otp_rate_limits TO service_role;

-- =====================================================
-- Migration Complete
-- =====================================================

-- Note: To run cleanup periodically, set up a cron job or scheduled task
-- Example: SELECT cleanup_expired_otps(); (run every hour)
