-- Rethink Systems Dashboard - Initial Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  phone TEXT,
  linkedin_url TEXT,
  portfolio_url TEXT,
  timezone TEXT DEFAULT 'Asia/Kolkata',
  role TEXT DEFAULT 'student' CHECK (role IN ('admin', 'company_user', 'mentor', 'student')),
  cohort_id UUID,
  mentor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  avatar_url TEXT,
  calendly_url TEXT,
  calendly_shared BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cohorts table
CREATE TABLE IF NOT EXISTS cohorts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  tag TEXT NOT NULL UNIQUE,
  start_date DATE,
  end_date DATE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add foreign key to profiles for cohort_id after cohorts table exists
ALTER TABLE profiles ADD CONSTRAINT fk_profile_cohort
  FOREIGN KEY (cohort_id) REFERENCES cohorts(id) ON DELETE SET NULL;

-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  cohort_id UUID REFERENCES cohorts(id) ON DELETE SET NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INT DEFAULT 60,
  zoom_link TEXT,
  zoom_meeting_id TEXT,
  google_event_id TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RSVPs table
CREATE TABLE IF NOT EXISTS rsvps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  response TEXT CHECK (response IN ('yes', 'no')),
  reminder_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id, user_id)
);

-- Attendance table (from Zoom)
CREATE TABLE IF NOT EXISTS attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  zoom_user_email TEXT,
  join_time TIMESTAMPTZ,
  leave_time TIMESTAMPTZ,
  duration_seconds INT,
  attendance_percentage DECIMAL(5,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Resources table
CREATE TABLE IF NOT EXISTS resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT DEFAULT 'file' CHECK (type IN ('file', 'folder')),
  file_path TEXT,
  file_type TEXT,
  file_size BIGINT,
  parent_id UUID REFERENCES resources(id) ON DELETE CASCADE,
  cohort_id UUID REFERENCES cohorts(id) ON DELETE SET NULL,
  week_number INT,
  keywords TEXT[],
  uploaded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Learning modules table
CREATE TABLE IF NOT EXISTS learning_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  week_number INT,
  order_index INT,
  cohort_id UUID REFERENCES cohorts(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Recordings table
CREATE TABLE IF NOT EXISTS recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID REFERENCES learning_modules(id) ON DELETE CASCADE,
  session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  video_url TEXT,
  duration_seconds INT,
  thumbnail_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Invoices table
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  invoice_number TEXT UNIQUE,
  amount DECIMAL(10,2),
  payment_type TEXT DEFAULT 'full' CHECK (payment_type IN ('full', 'partial', 'emi')),
  emi_number INT,
  total_emis INT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue')),
  pdf_path TEXT,
  due_date DATE,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT,
  type TEXT DEFAULT 'system' CHECK (type IN ('session_reminder', 'new_resource', 'system')),
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notification rules table (Admin configured)
CREATE TABLE IF NOT EXISTS notification_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  trigger_type TEXT,
  offset_minutes INT,
  channels TEXT[],
  recipient_filter JSONB,
  message_template TEXT,
  active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Support tickets table
CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  summary TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rankings table (calculated)
CREATE TABLE IF NOT EXISTS rankings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  cohort_id UUID REFERENCES cohorts(id) ON DELETE CASCADE,
  attendance_score DECIMAL(5,2),
  case_study_score DECIMAL(5,2),
  mentor_rating DECIMAL(5,2),
  total_score DECIMAL(5,2),
  rank INT,
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, cohort_id)
);

-- Invites tracking table
CREATE TABLE IF NOT EXISTS invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  full_name TEXT,
  phone TEXT,
  cohort_tag TEXT,
  mentor_email TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'accepted')),
  sent_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  error_message TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Attendance configuration table
CREATE TABLE IF NOT EXISTS attendance_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zoom_webhook_enabled BOOLEAN DEFAULT false,
  attendance_weight DECIMAL(5,2) DEFAULT 40,
  case_study_weight DECIMAL(5,2) DEFAULT 40,
  mentor_rating_weight DECIMAL(5,2) DEFAULT 20,
  updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default attendance config
INSERT INTO attendance_config (id, zoom_webhook_enabled, attendance_weight, case_study_weight, mentor_rating_weight)
VALUES (gen_random_uuid(), false, 40, 40, 20)
ON CONFLICT DO NOTHING;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_cohort ON profiles(cohort_id);
CREATE INDEX IF NOT EXISTS idx_profiles_mentor ON profiles(mentor_id);
CREATE INDEX IF NOT EXISTS idx_sessions_cohort ON sessions(cohort_id);
CREATE INDEX IF NOT EXISTS idx_sessions_scheduled ON sessions(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_rsvps_session ON rsvps(session_id);
CREATE INDEX IF NOT EXISTS idx_rsvps_user ON rsvps(user_id);
CREATE INDEX IF NOT EXISTS idx_attendance_session ON attendance(session_id);
CREATE INDEX IF NOT EXISTS idx_attendance_user ON attendance(user_id);
CREATE INDEX IF NOT EXISTS idx_resources_parent ON resources(parent_id);
CREATE INDEX IF NOT EXISTS idx_resources_cohort ON resources(cohort_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_invoices_user ON invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_user ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_rankings_cohort ON rankings(cohort_id);

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_support_tickets_updated_at
  BEFORE UPDATE ON support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ language 'plpgsql' SECURITY DEFINER;

-- Trigger for new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Row Level Security Policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE cohorts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE rsvps ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE rankings ENABLE ROW LEVEL SECURITY;
ALTER TABLE invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_config ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'company_user')
    )
  );

CREATE POLICY "Mentors can view their team profiles"
  ON profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'mentor'
    ) AND mentor_id = auth.uid()
  );

CREATE POLICY "Admins can manage all profiles"
  ON profiles FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'company_user')
    )
  );

-- Cohorts policies
CREATE POLICY "Everyone can view cohorts"
  ON cohorts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage cohorts"
  ON cohorts FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'company_user')
    )
  );

-- Sessions policies
CREATE POLICY "Users can view sessions for their cohort"
  ON sessions FOR SELECT
  USING (
    cohort_id IN (
      SELECT cohort_id FROM profiles WHERE id = auth.uid()
    ) OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'company_user', 'mentor')
    )
  );

CREATE POLICY "Admins can manage sessions"
  ON sessions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'company_user')
    )
  );

-- RSVPs policies
CREATE POLICY "Users can manage their own RSVPs"
  ON rsvps FOR ALL
  USING (user_id = auth.uid());

CREATE POLICY "Users can view RSVPs for their cohort sessions"
  ON rsvps FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM sessions s
      JOIN profiles p ON p.cohort_id = s.cohort_id
      WHERE s.id = rsvps.session_id AND p.id = auth.uid()
    ) OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'company_user')
    )
  );

-- Attendance policies
CREATE POLICY "Users can view their own attendance"
  ON attendance FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Mentors can view team attendance"
  ON attendance FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = attendance.user_id AND p.mentor_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage attendance"
  ON attendance FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'company_user')
    )
  );

-- Resources policies
CREATE POLICY "Everyone can view resources"
  ON resources FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage resources"
  ON resources FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'company_user')
    )
  );

-- Learning modules policies
CREATE POLICY "Everyone can view learning modules"
  ON learning_modules FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage learning modules"
  ON learning_modules FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'company_user')
    )
  );

-- Recordings policies
CREATE POLICY "Everyone can view recordings"
  ON recordings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage recordings"
  ON recordings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'company_user')
    )
  );

-- Invoices policies
CREATE POLICY "Users can view their own invoices"
  ON invoices FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all invoices"
  ON invoices FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'company_user')
    )
  );

-- Notifications policies
CREATE POLICY "Users can manage their own notifications"
  ON notifications FOR ALL
  USING (user_id = auth.uid());

CREATE POLICY "Admins can create notifications"
  ON notifications FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'company_user')
    )
  );

-- Notification rules policies
CREATE POLICY "Admins can manage notification rules"
  ON notification_rules FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'company_user')
    )
  );

-- Support tickets policies
CREATE POLICY "Users can manage their own tickets"
  ON support_tickets FOR ALL
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all tickets"
  ON support_tickets FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'company_user')
    )
  );

CREATE POLICY "Admins can update ticket status"
  ON support_tickets FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'company_user')
    )
  );

-- Rankings policies
CREATE POLICY "Users can view their own rankings"
  ON rankings FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can view rankings in their cohort"
  ON rankings FOR SELECT
  USING (
    cohort_id IN (
      SELECT cohort_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage rankings"
  ON rankings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'company_user')
    )
  );

-- Invites policies
CREATE POLICY "Admins can manage invites"
  ON invites FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'company_user')
    )
  );

-- Attendance config policies
CREATE POLICY "Everyone can view attendance config"
  ON attendance_config FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can update attendance config"
  ON attendance_config FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'company_user')
    )
  );

-- Storage bucket policies (run in Supabase dashboard)
-- CREATE POLICY "Authenticated users can upload resources"
--   ON storage.objects FOR INSERT
--   TO authenticated
--   WITH CHECK (bucket_id = 'resources');

-- CREATE POLICY "Everyone can view resources"
--   ON storage.objects FOR SELECT
--   TO authenticated
--   USING (bucket_id = 'resources');
