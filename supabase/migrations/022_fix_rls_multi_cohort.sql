-- ============================================
-- Migration 022: Fix RLS Policies for Multi-Cohort Support
-- ============================================
-- Problem: Several RLS policies still reference the legacy `profiles.cohort_id`
-- column instead of `user_role_assignments.cohort_id`. This causes multi-cohort
-- students to be unable to see sessions, case studies, and RSVPs for cohorts
-- they belong to via `user_role_assignments` but not via `profiles.cohort_id`.
--
-- Affected policies:
--   1. "Users can view sessions for their cohort" (sessions table)
--   2. "Users view cohort case studies" (case_studies table)
--   3. "Users can view RSVPs for their cohort sessions" (rsvps table)
--
-- Fix: Update each policy to check BOTH `user_role_assignments.cohort_id`
-- (primary) and `profiles.cohort_id` (legacy fallback) for backward compat.
-- Also check `session_cohorts` junction table for sessions.
-- ============================================

-- 1. Fix sessions SELECT policy
-- Old: checks sessions.cohort_id against profiles.cohort_id (single cohort)
-- New: checks session_cohorts.cohort_id against user_role_assignments.cohort_id (multi-cohort)
DROP POLICY IF EXISTS "Users can view sessions for their cohort" ON sessions;

CREATE POLICY "Users can view sessions for their cohort"
  ON sessions FOR SELECT
  USING (
    -- Multi-cohort: check session_cohorts junction table against user_role_assignments
    EXISTS (
      SELECT 1 FROM session_cohorts sc
      JOIN user_role_assignments ura ON ura.cohort_id = sc.cohort_id
      WHERE sc.session_id = sessions.id AND ura.user_id = auth.uid()
    )
    -- Legacy fallback: also check sessions.cohort_id against user_role_assignments
    OR cohort_id IN (
      SELECT ura.cohort_id FROM user_role_assignments ura WHERE ura.user_id = auth.uid()
    )
    -- Legacy fallback: profiles.cohort_id (for users not yet migrated)
    OR cohort_id IN (
      SELECT p.cohort_id FROM profiles p WHERE p.id = auth.uid()
    )
    -- Admins/mentors can see all
    OR EXISTS (
      SELECT 1 FROM user_role_assignments ura
      WHERE ura.user_id = auth.uid() AND ura.role IN ('admin', 'company_user', 'mentor')
    )
    -- Legacy admin check
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'company_user', 'mentor')
    )
  );

-- 2. Fix case_studies SELECT policy
-- Old: checks case_studies.cohort_id against profiles.cohort_id only
-- New: checks against user_role_assignments.cohort_id + legacy fallback
DROP POLICY IF EXISTS "Users view cohort case studies" ON case_studies;

CREATE POLICY "Users view cohort case studies" ON case_studies
  FOR SELECT USING (
    -- Multi-cohort: check against user_role_assignments
    cohort_id IN (
      SELECT ura.cohort_id FROM user_role_assignments ura WHERE ura.user_id = auth.uid()
    )
    -- Legacy fallback: profiles.cohort_id
    OR cohort_id IN (
      SELECT p.cohort_id FROM profiles p WHERE p.id = auth.uid()
    )
    -- Global case studies (cohort_id is null) visible to all authenticated users
    OR cohort_id IS NULL
    -- Admins can see all
    OR EXISTS (
      SELECT 1 FROM user_role_assignments ura
      WHERE ura.user_id = auth.uid() AND ura.role IN ('admin', 'company_user')
    )
    -- Legacy admin check
    OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'company_user')
    )
  );

-- 3. Fix RSVPs SELECT policy
-- Old: joins sessions.cohort_id to profiles.cohort_id
-- New: joins through session_cohorts to user_role_assignments
DROP POLICY IF EXISTS "Users can view RSVPs for their cohort sessions" ON rsvps;

CREATE POLICY "Users can view RSVPs for their cohort sessions"
  ON rsvps FOR SELECT
  USING (
    -- Own RSVPs always visible
    user_id = auth.uid()
    -- Multi-cohort: RSVPs for sessions in user's cohorts (via session_cohorts)
    OR EXISTS (
      SELECT 1 FROM session_cohorts sc
      JOIN user_role_assignments ura ON ura.cohort_id = sc.cohort_id
      WHERE sc.session_id = rsvps.session_id AND ura.user_id = auth.uid()
    )
    -- Legacy fallback
    OR EXISTS (
      SELECT 1 FROM sessions s
      JOIN profiles p ON p.cohort_id = s.cohort_id
      WHERE s.id = rsvps.session_id AND p.id = auth.uid()
    )
    -- Admins can see all
    OR EXISTS (
      SELECT 1 FROM user_role_assignments ura
      WHERE ura.user_id = auth.uid() AND ura.role IN ('admin', 'company_user')
    )
  );
