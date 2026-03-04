-- Migration: Case Study Submissions & Review Module
-- Purpose: Adds student submission workflow, mentor/admin review pipeline,
--          rubric scoring, and multi-stage publish lifecycle for case studies.

-- ============================================================
-- Step 1: Extend existing case_studies table
-- ============================================================
ALTER TABLE case_studies
  ADD COLUMN IF NOT EXISTS end_week_number INTEGER,
  ADD COLUMN IF NOT EXISTS max_score INTEGER DEFAULT 100,
  ADD COLUMN IF NOT EXISTS grace_period_minutes INTEGER DEFAULT 5,
  ADD COLUMN IF NOT EXISTS submissions_closed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS leaderboard_published BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS problem_updated_at TIMESTAMPTZ;

-- ============================================================
-- Step 2: Rubric criteria (optional per case study)
-- ============================================================
CREATE TABLE IF NOT EXISTS case_study_rubric_criteria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_study_id UUID NOT NULL REFERENCES case_studies(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  max_score INTEGER NOT NULL DEFAULT 10,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rubric_criteria_case_study
  ON case_study_rubric_criteria(case_study_id);

-- ============================================================
-- Step 3: Submissions (one per subgroup per case study)
-- ============================================================
CREATE TABLE IF NOT EXISTS case_study_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_study_id UUID NOT NULL REFERENCES case_studies(id) ON DELETE CASCADE,
  subgroup_id UUID NOT NULL REFERENCES subgroups(id) ON DELETE CASCADE,
  submitted_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  submitted_at TIMESTAMPTZ,
  is_late BOOLEAN NOT NULL DEFAULT false,
  deadline_override TIMESTAMPTZ,
  visibility TEXT NOT NULL DEFAULT 'draft'
    CHECK (visibility IN ('draft', 'submitted', 'admin_reviewed', 'mentor_visible', 'subgroup_published', 'cohort_published')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(case_study_id, subgroup_id)
);

CREATE INDEX IF NOT EXISTS idx_submissions_case_study
  ON case_study_submissions(case_study_id);
CREATE INDEX IF NOT EXISTS idx_submissions_subgroup
  ON case_study_submissions(subgroup_id);

-- ============================================================
-- Step 4: Submission attachments (files + links)
-- ============================================================
CREATE TABLE IF NOT EXISTS case_study_submission_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES case_study_submissions(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('file', 'link')),
  file_path TEXT,
  file_name TEXT,
  file_size BIGINT,
  file_type TEXT,
  link_url TEXT,
  link_label TEXT,
  uploaded_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_attachments_submission
  ON case_study_submission_attachments(submission_id);

-- ============================================================
-- Step 5: Reviews (admin + mentor per submission)
-- ============================================================
CREATE TABLE IF NOT EXISTS case_study_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES case_study_submissions(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES profiles(id),
  reviewer_role TEXT NOT NULL CHECK (reviewer_role IN ('admin', 'mentor')),
  score INTEGER CHECK (score IS NULL OR score >= 0),
  comment TEXT,
  overridden BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(submission_id, reviewer_id)
);

CREATE INDEX IF NOT EXISTS idx_reviews_submission
  ON case_study_reviews(submission_id);

-- ============================================================
-- Step 6: Rubric scores (per-criterion within a review)
-- ============================================================
CREATE TABLE IF NOT EXISTS case_study_rubric_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES case_study_reviews(id) ON DELETE CASCADE,
  criteria_id UUID NOT NULL REFERENCES case_study_rubric_criteria(id) ON DELETE CASCADE,
  score INTEGER NOT NULL CHECK (score >= 0),
  comment TEXT,
  UNIQUE(review_id, criteria_id)
);
CREATE INDEX IF NOT EXISTS idx_rubric_scores_review
  ON case_study_rubric_scores(review_id);

-- ============================================================
-- Step 7: Additional indexes for common query patterns
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_submissions_case_study_visibility
  ON case_study_submissions(case_study_id, visibility);

-- ============================================================
-- Step 8: Auto-update triggers for updated_at columns
-- ============================================================
DROP TRIGGER IF EXISTS update_case_study_submissions_updated_at ON case_study_submissions;
CREATE TRIGGER update_case_study_submissions_updated_at
  BEFORE UPDATE ON case_study_submissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_case_study_reviews_updated_at ON case_study_reviews;
CREATE TRIGGER update_case_study_reviews_updated_at
  BEFORE UPDATE ON case_study_reviews
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- Step 9: RLS Policies
-- All data access goes through API routes using createAdminClient()
-- (service role bypasses RLS). These restrictive policies prevent
-- direct client-side Supabase access from leaking data.
-- ============================================================

-- Rubric criteria: anyone can read (needed for form display), no direct writes
ALTER TABLE case_study_rubric_criteria ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read rubric criteria" ON case_study_rubric_criteria;
CREATE POLICY "Anyone can read rubric criteria"
  ON case_study_rubric_criteria FOR SELECT USING (true);

-- Submissions: students can read their own subgroup's submissions only
ALTER TABLE case_study_submissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read own subgroup submissions" ON case_study_submissions;
CREATE POLICY "Users can read own subgroup submissions"
  ON case_study_submissions FOR SELECT USING (
    subgroup_id IN (
      SELECT sm.subgroup_id FROM subgroup_members sm WHERE sm.user_id = auth.uid()
    )
  );

-- Attachments: readable if user can access the parent submission
ALTER TABLE case_study_submission_attachments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read own subgroup attachments" ON case_study_submission_attachments;
CREATE POLICY "Users can read own subgroup attachments"
  ON case_study_submission_attachments FOR SELECT USING (
    submission_id IN (
      SELECT cs.id FROM case_study_submissions cs
      JOIN subgroup_members sm ON sm.subgroup_id = cs.subgroup_id
      WHERE sm.user_id = auth.uid()
    )
  );

-- Reviews: readable if user can access the parent submission AND it's published to them
ALTER TABLE case_study_reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read published reviews" ON case_study_reviews;
CREATE POLICY "Users can read published reviews"
  ON case_study_reviews FOR SELECT USING (
    submission_id IN (
      SELECT cs.id FROM case_study_submissions cs
      JOIN subgroup_members sm ON sm.subgroup_id = cs.subgroup_id
      WHERE sm.user_id = auth.uid()
        AND cs.visibility IN ('subgroup_published', 'cohort_published')
    )
  );

-- Rubric scores: same visibility as parent review
ALTER TABLE case_study_rubric_scores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read published rubric scores" ON case_study_rubric_scores;
CREATE POLICY "Users can read published rubric scores"
  ON case_study_rubric_scores FOR SELECT USING (
    review_id IN (
      SELECT r.id FROM case_study_reviews r
      JOIN case_study_submissions cs ON cs.id = r.submission_id
      JOIN subgroup_members sm ON sm.subgroup_id = cs.subgroup_id
      WHERE sm.user_id = auth.uid()
        AND cs.visibility IN ('subgroup_published', 'cohort_published')
    )
  );
