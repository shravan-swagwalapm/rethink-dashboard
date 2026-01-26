-- ========================================
-- NOTIFICATION SYSTEM - DATABASE SCHEMA
-- ========================================
-- Run this entire script in Supabase SQL Editor
-- ========================================

-- 1. NOTIFICATION TEMPLATES
CREATE TABLE IF NOT EXISTS notification_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  subject VARCHAR(500),
  body TEXT NOT NULL,
  variables JSONB DEFAULT '[]'::jsonb,
  channel VARCHAR(20) NOT NULL CHECK (channel IN ('email', 'sms', 'whatsapp')),
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_templates_channel ON notification_templates(channel);
CREATE INDEX IF NOT EXISTS idx_notification_templates_active ON notification_templates(is_active);

-- 2. CONTACT LISTS
CREATE TABLE IF NOT EXISTS contact_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  tags JSONB DEFAULT '[]'::jsonb,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contact_lists_created_by ON contact_lists(created_by);

-- 3. CONTACTS
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID REFERENCES contact_lists(id) ON DELETE CASCADE,
  email VARCHAR(255),
  phone VARCHAR(20),
  name VARCHAR(255),
  metadata JSONB DEFAULT '{}'::jsonb,
  unsubscribed BOOLEAN DEFAULT false,
  unsubscribed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT contacts_email_or_phone_check CHECK (email IS NOT NULL OR phone IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_contacts_list_id ON contacts(list_id);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
CREATE INDEX IF NOT EXISTS idx_contacts_phone ON contacts(phone);
CREATE INDEX IF NOT EXISTS idx_contacts_unsubscribed ON contacts(unsubscribed);

-- 4. NOTIFICATION RULES
CREATE TABLE IF NOT EXISTS notification_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  trigger_type VARCHAR(20) NOT NULL CHECK (trigger_type IN ('manual', 'scheduled', 'recurring', 'event')),
  trigger_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  template_id UUID REFERENCES notification_templates(id) ON DELETE SET NULL,
  recipient_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  rule_status VARCHAR(20) DEFAULT 'active' CHECK (rule_status IN ('active', 'paused', 'completed', 'draft')),
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_rules_trigger_type ON notification_rules(trigger_type);
CREATE INDEX IF NOT EXISTS idx_notification_rules_status ON notification_rules(rule_status);
CREATE INDEX IF NOT EXISTS idx_notification_rules_next_run ON notification_rules(next_run_at) WHERE rule_status = 'active';

-- 5. NOTIFICATION JOBS
CREATE TABLE IF NOT EXISTS notification_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID REFERENCES notification_rules(id) ON DELETE CASCADE,
  template_id UUID REFERENCES notification_templates(id) ON DELETE SET NULL,
  recipient_type VARCHAR(20) NOT NULL CHECK (recipient_type IN ('user', 'cohort', 'contact', 'list', 'custom')),
  recipient_id UUID,
  recipient_email VARCHAR(255),
  recipient_phone VARCHAR(20),
  recipient_name VARCHAR(255),
  channel VARCHAR(20) NOT NULL CHECK (channel IN ('email', 'sms', 'whatsapp')),
  subject VARCHAR(500),
  body TEXT NOT NULL,
  job_status VARCHAR(20) DEFAULT 'pending' CHECK (job_status IN ('pending', 'processing', 'sent', 'failed', 'cancelled')),
  priority INT DEFAULT 5,
  scheduled_for TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  retry_count INT DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_jobs_status ON notification_jobs(job_status);
CREATE INDEX IF NOT EXISTS idx_notification_jobs_scheduled ON notification_jobs(scheduled_for) WHERE job_status = 'pending';
CREATE INDEX IF NOT EXISTS idx_notification_jobs_rule_id ON notification_jobs(rule_id);
CREATE INDEX IF NOT EXISTS idx_notification_jobs_recipient ON notification_jobs(recipient_type, recipient_id);
CREATE INDEX IF NOT EXISTS idx_notification_jobs_channel ON notification_jobs(channel);

-- 6. NOTIFICATION LOGS
CREATE TABLE IF NOT EXISTS notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES notification_jobs(id) ON DELETE CASCADE,
  event_type VARCHAR(20) NOT NULL CHECK (event_type IN ('sent', 'delivered', 'opened', 'clicked', 'bounced', 'failed')),
  recipient_email VARCHAR(255),
  recipient_phone VARCHAR(20),
  tracking_id UUID DEFAULT gen_random_uuid(),
  user_agent TEXT,
  ip_address INET,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_logs_job_id ON notification_logs(job_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_event_type ON notification_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_notification_logs_tracking_id ON notification_logs(tracking_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_created_at ON notification_logs(created_at);

-- 7. NOTIFICATION CAMPAIGNS
CREATE TABLE IF NOT EXISTS notification_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  recipient_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  campaign_status VARCHAR(20) DEFAULT 'draft' CHECK (campaign_status IN ('draft', 'active', 'paused', 'completed')),
  total_recipients INT DEFAULT 0,
  total_sent INT DEFAULT 0,
  total_opened INT DEFAULT 0,
  total_clicked INT DEFAULT 0,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_campaigns_status ON notification_campaigns(campaign_status);

-- 8. CAMPAIGN ENROLLMENTS
CREATE TABLE IF NOT EXISTS campaign_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES notification_campaigns(id) ON DELETE CASCADE,
  recipient_type VARCHAR(20) NOT NULL CHECK (recipient_type IN ('user', 'contact')),
  recipient_id UUID NOT NULL,
  current_step INT DEFAULT 0,
  enrollment_status VARCHAR(20) DEFAULT 'active' CHECK (enrollment_status IN ('active', 'paused', 'completed', 'failed')),
  enrolled_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_campaign_enrollment UNIQUE (campaign_id, recipient_type, recipient_id)
);

CREATE INDEX IF NOT EXISTS idx_campaign_enrollments_campaign_id ON campaign_enrollments(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_enrollments_recipient ON campaign_enrollments(recipient_type, recipient_id);
CREATE INDEX IF NOT EXISTS idx_campaign_enrollments_status ON campaign_enrollments(enrollment_status);

-- ========================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ========================================

ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_enrollments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admins can manage templates" ON notification_templates;
DROP POLICY IF EXISTS "Admins can manage contact lists" ON contact_lists;
DROP POLICY IF EXISTS "Admins can manage contacts" ON contacts;
DROP POLICY IF EXISTS "Admins can manage rules" ON notification_rules;
DROP POLICY IF EXISTS "Admins can view jobs" ON notification_jobs;
DROP POLICY IF EXISTS "Admins can view logs" ON notification_logs;
DROP POLICY IF EXISTS "Admins can manage campaigns" ON notification_campaigns;
DROP POLICY IF EXISTS "Admins can view enrollments" ON campaign_enrollments;

-- Create policies
CREATE POLICY "Admins can manage templates" ON notification_templates
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can manage contact lists" ON contact_lists
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can manage contacts" ON contacts
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can manage rules" ON notification_rules
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can view jobs" ON notification_jobs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can view logs" ON notification_logs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can manage campaigns" ON notification_campaigns
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can view enrollments" ON campaign_enrollments
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ========================================
-- FUNCTIONS AND TRIGGERS
-- ========================================

-- Create or replace the trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS update_notification_templates_updated_at ON notification_templates;
DROP TRIGGER IF EXISTS update_contact_lists_updated_at ON contact_lists;
DROP TRIGGER IF EXISTS update_contacts_updated_at ON contacts;
DROP TRIGGER IF EXISTS update_notification_rules_updated_at ON notification_rules;
DROP TRIGGER IF EXISTS update_notification_jobs_updated_at ON notification_jobs;
DROP TRIGGER IF EXISTS update_notification_campaigns_updated_at ON notification_campaigns;
DROP TRIGGER IF EXISTS update_campaign_enrollments_updated_at ON campaign_enrollments;

-- Create triggers
CREATE TRIGGER update_notification_templates_updated_at
  BEFORE UPDATE ON notification_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contact_lists_updated_at
  BEFORE UPDATE ON contact_lists
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contacts_updated_at
  BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notification_rules_updated_at
  BEFORE UPDATE ON notification_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notification_jobs_updated_at
  BEFORE UPDATE ON notification_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notification_campaigns_updated_at
  BEFORE UPDATE ON notification_campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_campaign_enrollments_updated_at
  BEFORE UPDATE ON campaign_enrollments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- SAMPLE DATA
-- ========================================

INSERT INTO notification_templates (name, description, subject, body, variables, channel, is_active)
VALUES
(
  'Welcome Email',
  'Welcome new users to the platform',
  'Welcome to {{cohort_name}}! 🎉',
  '<h1>Welcome {{name}}!</h1><p>We''re excited to have you join <strong>{{cohort_name}}</strong>.</p><p>Your learning journey starts on {{start_date}}.</p>',
  '[{"name": "name", "example": "John Doe"}, {"name": "cohort_name", "example": "Product Management 101"}, {"name": "start_date", "example": "Feb 1, 2026"}]'::jsonb,
  'email',
  true
),
(
  'Session Reminder',
  'Remind users about upcoming sessions',
  'Session starting soon: {{session_title}}',
  '<h2>{{session_title}}</h2><p>Hi {{name}},</p><p>This is a reminder that your session starts in <strong>{{time_until}}</strong>.</p><p><strong>When:</strong> {{session_time}}<br><strong>Duration:</strong> {{duration}} minutes</p>',
  '[{"name": "name", "example": "John"}, {"name": "session_title", "example": "Week 1: Introduction"}, {"name": "time_until", "example": "1 hour"}, {"name": "session_time", "example": "3:00 PM"}, {"name": "duration", "example": "60"}]'::jsonb,
  'email',
  true
),
(
  'SMS Reminder',
  'Quick SMS reminder for sessions',
  NULL,
  'Hi {{name}}, your session "{{session_title}}" starts in {{time_until}}. Join here: {{link}}',
  '[{"name": "name", "example": "John"}, {"name": "session_title", "example": "Week 1"}, {"name": "time_until", "example": "30 min"}, {"name": "link", "example": "https://..."}]'::jsonb,
  'sms',
  true
)
ON CONFLICT DO NOTHING;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Notification system tables created successfully!';
  RAISE NOTICE '📊 Tables created: 8 (notification_templates, contact_lists, contacts, notification_rules, notification_jobs, notification_logs, notification_campaigns, campaign_enrollments)';
  RAISE NOTICE '🔒 RLS policies enabled for admin-only access';
  RAISE NOTICE '📝 Sample templates: %', (SELECT COUNT(*) FROM notification_templates);
END $$;
