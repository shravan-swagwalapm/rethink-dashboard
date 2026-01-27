-- ========================================
-- NOTIFICATION INTEGRATIONS SETTINGS
-- Run this script in Supabase SQL Editor
-- ========================================

-- ========================================
-- TABLE CREATION
-- ========================================

-- Integration settings table for email, SMS, WhatsApp providers
CREATE TABLE IF NOT EXISTS notification_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel VARCHAR(20) NOT NULL CHECK (channel IN ('email', 'sms', 'whatsapp')),
  provider VARCHAR(50) NOT NULL,
  is_active BOOLEAN DEFAULT false,
  config JSONB DEFAULT '{}'::jsonb,
  test_mode BOOLEAN DEFAULT true,
  last_tested_at TIMESTAMPTZ,
  test_status VARCHAR(20) CHECK (test_status IN ('success', 'failed', 'pending')),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(channel) -- Only one provider per channel
);

-- Create index for quick lookups
CREATE INDEX IF NOT EXISTS idx_notification_integrations_channel ON notification_integrations(channel);
CREATE INDEX IF NOT EXISTS idx_notification_integrations_active ON notification_integrations(is_active);

-- ========================================
-- ROW LEVEL SECURITY
-- ========================================

ALTER TABLE notification_integrations ENABLE ROW LEVEL SECURITY;

-- Admin-only access policy
CREATE POLICY "Admins can view integrations" ON notification_integrations
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can insert integrations" ON notification_integrations
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can update integrations" ON notification_integrations
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can delete integrations" ON notification_integrations
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ========================================
-- TRIGGER FOR UPDATED_AT
-- ========================================

-- Check if trigger function exists, create if not
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for notification_integrations
DROP TRIGGER IF EXISTS update_notification_integrations_updated_at ON notification_integrations;
CREATE TRIGGER update_notification_integrations_updated_at
  BEFORE UPDATE ON notification_integrations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- TEMPLATE ENHANCEMENTS FOR HTML
-- ========================================

-- Add HTML body support to notification_templates
ALTER TABLE notification_templates
  ADD COLUMN IF NOT EXISTS html_body TEXT,
  ADD COLUMN IF NOT EXISTS body_type VARCHAR(20) DEFAULT 'text';

-- Add check constraint for body_type if column was just added
DO $$
BEGIN
  -- Only add constraint if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'notification_templates_body_type_check'
  ) THEN
    ALTER TABLE notification_templates
      ADD CONSTRAINT notification_templates_body_type_check
      CHECK (body_type IN ('text', 'html'));
  END IF;
END $$;

-- ========================================
-- DEFAULT INTEGRATION ENTRIES
-- ========================================

-- Insert default integrations (upsert to avoid duplicates)
INSERT INTO notification_integrations (channel, provider, is_active, config, test_mode)
VALUES
  ('email', 'resend', true, '{"from_email": "notifications@rethink.com", "from_name": "Rethink Systems"}'::jsonb, false),
  ('sms', 'twilio', false, '{}'::jsonb, true),
  ('whatsapp', 'interakt', false, '{}'::jsonb, true)
ON CONFLICT (channel) DO NOTHING;

-- ========================================
-- GRANT PERMISSIONS
-- ========================================

-- Grant access to authenticated users (RLS will control actual access)
GRANT SELECT, INSERT, UPDATE, DELETE ON notification_integrations TO authenticated;
