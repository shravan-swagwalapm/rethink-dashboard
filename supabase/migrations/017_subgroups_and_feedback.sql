-- 017_subgroups_and_feedback.sql
-- Subgroups, membership, mentors, and feedback tables for the mentor/subgroup module

-- 1. Subgroups — named subdivision of a cohort
CREATE TABLE IF NOT EXISTS subgroups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id UUID NOT NULL REFERENCES cohorts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(cohort_id, name)
);

-- 2. Subgroup Members — students assigned to a subgroup
CREATE TABLE IF NOT EXISTS subgroup_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subgroup_id UUID NOT NULL REFERENCES subgroups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(subgroup_id, user_id)
);

-- 3. Subgroup Mentors — mentors assigned to subgroups (many-to-many)
CREATE TABLE IF NOT EXISTS subgroup_mentors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subgroup_id UUID NOT NULL REFERENCES subgroups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(subgroup_id, user_id)
);

-- 4. Mentor Feedback — feedback given by mentors to individual students
CREATE TABLE IF NOT EXISTS mentor_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id UUID NOT NULL REFERENCES profiles(id),
  student_id UUID NOT NULL REFERENCES profiles(id),
  subgroup_id UUID NOT NULL REFERENCES subgroups(id),
  type TEXT NOT NULL CHECK (type IN ('daily', 'weekly')),
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  week_number INTEGER,
  feedback_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(mentor_id, student_id, type, feedback_date)
);

-- 5. Student Feedback — feedback given by students about mentors and sessions
CREATE TABLE IF NOT EXISTS student_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES profiles(id),
  target_type TEXT NOT NULL CHECK (target_type IN ('mentor', 'session')),
  target_id UUID NOT NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  week_number INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(student_id, target_type, target_id, week_number)
);

-- ============================================================
-- INDEXES for common query patterns
-- ============================================================

CREATE INDEX idx_subgroups_cohort ON subgroups(cohort_id);
CREATE INDEX idx_subgroup_members_subgroup ON subgroup_members(subgroup_id);
CREATE INDEX idx_subgroup_members_user ON subgroup_members(user_id);
CREATE INDEX idx_subgroup_mentors_subgroup ON subgroup_mentors(subgroup_id);
CREATE INDEX idx_subgroup_mentors_user ON subgroup_mentors(user_id);
CREATE INDEX idx_mentor_feedback_mentor ON mentor_feedback(mentor_id);
CREATE INDEX idx_mentor_feedback_student ON mentor_feedback(student_id);
CREATE INDEX idx_mentor_feedback_subgroup ON mentor_feedback(subgroup_id);
CREATE INDEX idx_student_feedback_student ON student_feedback(student_id);
CREATE INDEX idx_student_feedback_target ON student_feedback(target_type, target_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE subgroups ENABLE ROW LEVEL SECURITY;
ALTER TABLE subgroup_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE subgroup_mentors ENABLE ROW LEVEL SECURITY;
ALTER TABLE mentor_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_feedback ENABLE ROW LEVEL SECURITY;

-- Students: read their own subgroup
CREATE POLICY "Students can read own subgroup" ON subgroups
  FOR SELECT USING (
    id IN (SELECT subgroup_id FROM subgroup_members WHERE user_id = auth.uid())
  );

-- BASE POLICIES: break self-referencing circular dependency
-- Without these, subgroup_members/subgroup_mentors policies reference themselves
-- and RLS returns empty results (chicken-and-egg: can't read your row to discover
-- your subgroup_id, because you need your subgroup_id to read your row)

-- Users can always read their own membership row
CREATE POLICY "Users can read own membership" ON subgroup_members
  FOR SELECT USING (user_id = auth.uid());

-- Users can always read their own mentor assignment row
CREATE POLICY "Users can read own mentor assignment" ON subgroup_mentors
  FOR SELECT USING (user_id = auth.uid());

-- SUBGROUP-SCOPED POLICIES: now work because base policies above let
-- the inner subquery find the user's own rows first

-- Students: read members of their subgroup (peers)
CREATE POLICY "Students can read own subgroup members" ON subgroup_members
  FOR SELECT USING (
    subgroup_id IN (SELECT subgroup_id FROM subgroup_members WHERE user_id = auth.uid())
  );

-- Students: read mentors of their subgroup
CREATE POLICY "Students can read own subgroup mentors" ON subgroup_mentors
  FOR SELECT USING (
    subgroup_id IN (SELECT subgroup_id FROM subgroup_members WHERE user_id = auth.uid())
  );

-- Mentors: read their assigned subgroups
CREATE POLICY "Mentors can read assigned subgroups" ON subgroups
  FOR SELECT USING (
    id IN (SELECT subgroup_id FROM subgroup_mentors WHERE user_id = auth.uid())
  );

-- Mentors: read members of assigned subgroups
CREATE POLICY "Mentors can read assigned subgroup members" ON subgroup_members
  FOR SELECT USING (
    subgroup_id IN (SELECT subgroup_id FROM subgroup_mentors WHERE user_id = auth.uid())
  );

-- Mentors: read mentors of assigned subgroups (to see co-mentors)
CREATE POLICY "Mentors can read assigned subgroup mentors" ON subgroup_mentors
  FOR SELECT USING (
    subgroup_id IN (SELECT subgroup_id FROM subgroup_mentors WHERE user_id = auth.uid())
  );

-- Mentor feedback: mentors can insert for their subgroup students
CREATE POLICY "Mentors can insert feedback" ON mentor_feedback
  FOR INSERT WITH CHECK (
    mentor_id = auth.uid()
    AND subgroup_id IN (SELECT subgroup_id FROM subgroup_mentors WHERE user_id = auth.uid())
  );

-- Mentor feedback: mentors can read their own given feedback
CREATE POLICY "Mentors can read own feedback" ON mentor_feedback
  FOR SELECT USING (mentor_id = auth.uid());

-- Mentor feedback: students can read feedback about themselves
CREATE POLICY "Students can read own received feedback" ON mentor_feedback
  FOR SELECT USING (student_id = auth.uid());

-- Mentor feedback: mentors can update their own feedback
CREATE POLICY "Mentors can update own feedback" ON mentor_feedback
  FOR UPDATE USING (mentor_id = auth.uid());

-- Student feedback: students can insert their own
CREATE POLICY "Students can insert feedback" ON student_feedback
  FOR INSERT WITH CHECK (student_id = auth.uid());

-- Student feedback: students can read their own given feedback
CREATE POLICY "Students can read own feedback" ON student_feedback
  FOR SELECT USING (student_id = auth.uid());

-- Student feedback: students can update their own feedback
CREATE POLICY "Students can update own feedback" ON student_feedback
  FOR UPDATE USING (student_id = auth.uid());

-- Student feedback: mentors can read feedback about themselves
CREATE POLICY "Mentors can read feedback about themselves" ON student_feedback
  FOR SELECT USING (
    target_type = 'mentor' AND target_id = auth.uid()
  );
