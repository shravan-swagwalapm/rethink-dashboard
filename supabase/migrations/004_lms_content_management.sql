-- ============================================
-- Migration: 004_lms_content_management.sql
-- Purpose: Add case studies, groups, assignments, and submissions tables
-- ============================================

-- ============================================
-- 1. Extend module_resources for session tracking
-- ============================================
ALTER TABLE module_resources ADD COLUMN IF NOT EXISTS session_number INT;

-- ============================================
-- 2. Create case_studies table
-- ============================================
CREATE TABLE IF NOT EXISTS case_studies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id UUID REFERENCES cohorts(id) ON DELETE CASCADE,
  week_number INT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  problem_doc_id TEXT,           -- Google Drive ID for problem statement
  problem_doc_url TEXT,          -- Full URL for display
  solution_doc_id TEXT,          -- Google Drive ID for solution
  solution_doc_url TEXT,
  solution_visible BOOLEAN DEFAULT false,  -- Admin toggle
  due_date TIMESTAMPTZ,
  order_index INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 3. Create groups table
-- ============================================
CREATE TABLE IF NOT EXISTS groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id UUID REFERENCES cohorts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(cohort_id, name)
);

-- ============================================
-- 4. Create group_members table
-- ============================================
CREATE TABLE IF NOT EXISTS group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, user_id)
);

-- ============================================
-- 5. Create assignments table
-- ============================================
CREATE TABLE IF NOT EXISTS assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id UUID REFERENCES cohorts(id) ON DELETE CASCADE,
  week_number INT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  due_date TIMESTAMPTZ,
  max_score DECIMAL(5,2) DEFAULT 100,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 6. Create assignment_submissions table
-- ============================================
CREATE TABLE IF NOT EXISTS assignment_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID REFERENCES assignments(id) ON DELETE CASCADE,
  group_id UUID REFERENCES groups(id),           -- NULL for individual
  user_id UUID REFERENCES profiles(id),          -- NULL for group
  file_url TEXT,                                 -- Uploaded file URL
  file_name TEXT,
  google_drive_url TEXT,                         -- Or Drive link
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  grade DECIMAL(5,2),
  feedback TEXT,
  graded_by UUID REFERENCES profiles(id),
  graded_at TIMESTAMPTZ,
  status TEXT DEFAULT 'submitted' CHECK (status IN ('draft', 'submitted', 'graded')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (group_id IS NOT NULL OR user_id IS NOT NULL)  -- Must have one
);

-- ============================================
-- 7. Enable RLS
-- ============================================
ALTER TABLE case_studies ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignment_submissions ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 8. Case Studies Policies
-- ============================================
CREATE POLICY "Users view cohort case studies" ON case_studies
  FOR SELECT USING (
    cohort_id IN (SELECT cohort_id FROM profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'company_user'))
  );

CREATE POLICY "Admins manage case studies" ON case_studies
  FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'company_user')));

-- ============================================
-- 9. Groups Policies
-- ============================================
CREATE POLICY "Users view cohort groups" ON groups
  FOR SELECT USING (
    cohort_id IN (SELECT cohort_id FROM profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'company_user'))
  );

CREATE POLICY "Admins manage groups" ON groups
  FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'company_user')));

-- ============================================
-- 10. Group Members Policies
-- ============================================
CREATE POLICY "Users view group members" ON group_members
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM groups g WHERE g.id = group_id AND
      (g.cohort_id IN (SELECT cohort_id FROM profiles WHERE id = auth.uid())
       OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'company_user'))))
  );

CREATE POLICY "Admins manage group members" ON group_members
  FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'company_user')));

-- ============================================
-- 11. Assignments Policies
-- ============================================
CREATE POLICY "Users view cohort assignments" ON assignments
  FOR SELECT USING (
    cohort_id IN (SELECT cohort_id FROM profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'company_user'))
  );

CREATE POLICY "Admins manage assignments" ON assignments
  FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'company_user')));

-- ============================================
-- 12. Submissions Policies
-- ============================================
CREATE POLICY "Users view own submissions" ON assignment_submissions
  FOR SELECT USING (
    user_id = auth.uid()
    OR group_id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'company_user', 'mentor'))
  );

CREATE POLICY "Users create own submissions" ON assignment_submissions
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    OR group_id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Users update own submissions" ON assignment_submissions
  FOR UPDATE USING (
    (user_id = auth.uid() OR group_id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid()))
    AND status != 'graded'
  );

CREATE POLICY "Admins manage submissions" ON assignment_submissions
  FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'company_user', 'mentor')));

-- ============================================
-- 13. Indexes for Performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_case_studies_cohort ON case_studies(cohort_id);
CREATE INDEX IF NOT EXISTS idx_case_studies_week ON case_studies(cohort_id, week_number);
CREATE INDEX IF NOT EXISTS idx_groups_cohort ON groups(cohort_id);
CREATE INDEX IF NOT EXISTS idx_group_members_group ON group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_assignments_cohort ON assignments(cohort_id);
CREATE INDEX IF NOT EXISTS idx_assignments_week ON assignments(cohort_id, week_number);
CREATE INDEX IF NOT EXISTS idx_submissions_assignment ON assignment_submissions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_submissions_user ON assignment_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_submissions_group ON assignment_submissions(group_id);
