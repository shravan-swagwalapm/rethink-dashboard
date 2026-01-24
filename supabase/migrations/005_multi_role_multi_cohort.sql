-- Migration: Multi-Role Users, Multi-Cohort Sessions, and Guest Support
-- This migration adds support for:
-- 1. Multiple roles per user with different cohort assignments per role
-- 2. New "master" role for external guests (cohort-independent)
-- 3. Sessions for multiple cohorts
-- 4. Guest invites to sessions

-- ============================================================================
-- 1. USER ROLE ASSIGNMENTS TABLE
-- ============================================================================
-- Stores role assignments with optional cohort per role
-- Examples:
--   - User A: student of Cohort 6, mentor of Cohort 7
--   - User B: master (guest) - no cohort needed
--   - User C: admin - has all privileges automatically

CREATE TABLE IF NOT EXISTS user_role_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'company_user', 'mentor', 'student', 'master')),
  cohort_id UUID REFERENCES cohorts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, role, cohort_id)  -- Prevent duplicate assignments
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_user_role_assignments_user ON user_role_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_user_role_assignments_role ON user_role_assignments(role);
CREATE INDEX IF NOT EXISTS idx_user_role_assignments_cohort ON user_role_assignments(cohort_id);

-- ============================================================================
-- 2. SESSION COHORTS TABLE
-- ============================================================================
-- Stores multiple cohorts per session (many-to-many relationship)

CREATE TABLE IF NOT EXISTS session_cohorts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  cohort_id UUID NOT NULL REFERENCES cohorts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id, cohort_id)
);

CREATE INDEX IF NOT EXISTS idx_session_cohorts_session ON session_cohorts(session_id);
CREATE INDEX IF NOT EXISTS idx_session_cohorts_cohort ON session_cohorts(cohort_id);

-- ============================================================================
-- 3. SESSION GUESTS TABLE
-- ============================================================================
-- Stores guest invites for sessions (for master/guest users)

CREATE TABLE IF NOT EXISTS session_guests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_session_guests_session ON session_guests(session_id);
CREATE INDEX IF NOT EXISTS idx_session_guests_user ON session_guests(user_id);

-- ============================================================================
-- 4. MIGRATE EXISTING DATA
-- ============================================================================

-- Migrate existing role assignments from profiles table
-- This preserves the current role and cohort_id as a single role assignment
INSERT INTO user_role_assignments (user_id, role, cohort_id)
SELECT id, role, cohort_id
FROM profiles
WHERE role IS NOT NULL
ON CONFLICT (user_id, role, cohort_id) DO NOTHING;

-- Migrate existing session cohorts
-- This converts the single cohort_id to the new many-to-many table
INSERT INTO session_cohorts (session_id, cohort_id)
SELECT id, cohort_id
FROM sessions
WHERE cohort_id IS NOT NULL
ON CONFLICT (session_id, cohort_id) DO NOTHING;

-- ============================================================================
-- 5. UPDATE PROFILES TABLE CHECK CONSTRAINT
-- ============================================================================
-- Add 'master' to the allowed roles in profiles table
-- First drop the existing constraint if it exists, then add the new one

DO $$
BEGIN
  -- Try to drop the existing constraint
  ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
EXCEPTION
  WHEN undefined_object THEN
    NULL; -- Constraint doesn't exist, continue
END $$;

-- Add the updated constraint with 'master' role included
ALTER TABLE profiles
ADD CONSTRAINT profiles_role_check
CHECK (role IS NULL OR role IN ('admin', 'company_user', 'mentor', 'student', 'master'));

-- ============================================================================
-- 6. ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- Enable RLS on new tables
ALTER TABLE user_role_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_cohorts ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_guests ENABLE ROW LEVEL SECURITY;

-- user_role_assignments policies
CREATE POLICY "Users can view their own role assignments"
  ON user_role_assignments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all role assignments"
  ON user_role_assignments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'company_user')
    )
  );

CREATE POLICY "Admins can insert role assignments"
  ON user_role_assignments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'company_user')
    )
  );

CREATE POLICY "Admins can update role assignments"
  ON user_role_assignments FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'company_user')
    )
  );

CREATE POLICY "Admins can delete role assignments"
  ON user_role_assignments FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'company_user')
    )
  );

-- session_cohorts policies
CREATE POLICY "Users can view session cohorts for their cohorts"
  ON session_cohorts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_role_assignments
      WHERE user_id = auth.uid()
      AND cohort_id = session_cohorts.cohort_id
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'company_user')
    )
  );

CREATE POLICY "Admins can manage session cohorts"
  ON session_cohorts FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'company_user')
    )
  );

-- session_guests policies
CREATE POLICY "Users can view their own guest invites"
  ON session_guests FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all guest invites"
  ON session_guests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'company_user')
    )
  );

CREATE POLICY "Admins can manage guest invites"
  ON session_guests FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('admin', 'company_user')
    )
  );

-- ============================================================================
-- NOTE: Legacy columns (profiles.role, profiles.cohort_id, sessions.cohort_id)
-- are kept for backwards compatibility during the migration period.
-- They can be dropped in a future migration after all code is updated.
-- ============================================================================
