-- ========================================
-- NOTIFICATION SYSTEM - COMPLETE SETUP
-- Run this entire script in Supabase SQL Editor
-- ========================================

-- Drop existing tables if they exist (clean slate)
DROP TABLE IF EXISTS campaign_enrollments CASCADE;
DROP TABLE IF EXISTS notification_campaigns CASCADE;
DROP TABLE IF EXISTS notification_logs CASCADE;
DROP TABLE IF EXISTS notification_jobs CASCADE;
DROP TABLE IF EXISTS notification_rules CASCADE;
DROP TABLE IF EXISTS contacts CASCADE;
DROP TABLE IF EXISTS contact_lists CASCADE;
DROP TABLE IF EXISTS notification_templates CASCADE;

-- ========================================
-- TABLE CREATION
-- ========================================

-- 1. NOTIFICATION TEMPLATES
CREATE TABLE notification_templates (
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

-- 2. CONTACT LISTS
CREATE TABLE contact_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  tags JSONB DEFAULT '[]'::jsonb,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. CONTACTS
CREATE TABLE contacts (
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

-- 4. NOTIFICATION RULES
CREATE TABLE notification_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  trigger_type VARCHAR(20) NOT NULL CHECK (trigger_type IN ('manual', 'scheduled', 'recurring', 'event')),
  trigger_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  template_id UUID REFERENCES notification_templates(id) ON DELETE SET NULL,
  recipient_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'draft')),
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. NOTIFICATION JOBS
CREATE TABLE notification_jobs (
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
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'cancelled')),
  priority INT DEFAULT 5,
  scheduled_for TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  retry_count INT DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. NOTIFICATION LOGS
CREATE TABLE notification_logs (
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

-- 7. NOTIFICATION CAMPAIGNS
CREATE TABLE notification_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  recipient_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed')),
  total_recipients INT DEFAULT 0,
  total_sent INT DEFAULT 0,
  total_opened INT DEFAULT 0,
  total_clicked INT DEFAULT 0,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. CAMPAIGN ENROLLMENTS
CREATE TABLE campaign_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES notification_campaigns(id) ON DELETE CASCADE,
  recipient_type VARCHAR(20) NOT NULL CHECK (recipient_type IN ('user', 'contact')),
  recipient_id UUID NOT NULL,
  current_step INT DEFAULT 0,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'failed')),
  enrolled_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (campaign_id, recipient_type, recipient_id)
);

-- ========================================
-- INDEXES
-- ========================================

CREATE INDEX idx_notification_templates_channel ON notification_templates(channel);
CREATE INDEX idx_notification_templates_active ON notification_templates(is_active);

CREATE INDEX idx_contact_lists_created_by ON contact_lists(created_by);

CREATE INDEX idx_contacts_list_id ON contacts(list_id);
CREATE INDEX idx_contacts_email ON contacts(email);
CREATE INDEX idx_contacts_phone ON contacts(phone);
CREATE INDEX idx_contacts_unsubscribed ON contacts(unsubscribed);

CREATE INDEX idx_notification_rules_trigger_type ON notification_rules(trigger_type);
CREATE INDEX idx_notification_rules_status ON notification_rules(status);
CREATE INDEX idx_notification_rules_next_run ON notification_rules(next_run_at);

CREATE INDEX idx_notification_jobs_status ON notification_jobs(status);
CREATE INDEX idx_notification_jobs_scheduled ON notification_jobs(scheduled_for);
CREATE INDEX idx_notification_jobs_rule_id ON notification_jobs(rule_id);
CREATE INDEX idx_notification_jobs_recipient ON notification_jobs(recipient_type, recipient_id);
CREATE INDEX idx_notification_jobs_channel ON notification_jobs(channel);

CREATE INDEX idx_notification_logs_job_id ON notification_logs(job_id);
CREATE INDEX idx_notification_logs_event_type ON notification_logs(event_type);
CREATE INDEX idx_notification_logs_tracking_id ON notification_logs(tracking_id);
CREATE INDEX idx_notification_logs_created_at ON notification_logs(created_at);

CREATE INDEX idx_notification_campaigns_status ON notification_campaigns(status);

CREATE INDEX idx_campaign_enrollments_campaign_id ON campaign_enrollments(campaign_id);
CREATE INDEX idx_campaign_enrollments_recipient ON campaign_enrollments(recipient_type, recipient_id);
CREATE INDEX idx_campaign_enrollments_status ON campaign_enrollments(status);

-- ========================================
-- ROW LEVEL SECURITY
-- ========================================

ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_enrollments ENABLE ROW LEVEL SECURITY;

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
-- TRIGGERS
-- ========================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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
);
