-- Migration: Case Study PDF Upload + Multi-Solution Support
-- Drops Google Docs URL columns, adds file storage, creates solutions table

-- Step 1: Drop Google Docs URL columns from case_studies
ALTER TABLE case_studies
  DROP COLUMN IF EXISTS problem_doc_id,
  DROP COLUMN IF EXISTS problem_doc_url,
  DROP COLUMN IF EXISTS solution_doc_id,
  DROP COLUMN IF EXISTS solution_doc_url;

-- Step 2: Add PDF file storage columns to case_studies
ALTER TABLE case_studies
  ADD COLUMN IF NOT EXISTS problem_file_path TEXT,
  ADD COLUMN IF NOT EXISTS problem_file_size BIGINT;

-- Step 3: Create case_study_solutions table
CREATE TABLE IF NOT EXISTS case_study_solutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_study_id UUID NOT NULL REFERENCES case_studies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  subgroup_id UUID REFERENCES subgroups(id) ON DELETE SET NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT,
  order_index INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 4: Indexes
CREATE INDEX IF NOT EXISTS idx_css_case_study ON case_study_solutions(case_study_id);
CREATE INDEX IF NOT EXISTS idx_css_subgroup ON case_study_solutions(subgroup_id);

-- Step 5: RLS Policies
ALTER TABLE case_study_solutions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage case study solutions"
  ON case_study_solutions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'company_user')
    )
  );

CREATE POLICY "Students can read solutions for their cohort case studies"
  ON case_study_solutions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM case_studies cs
      JOIN user_role_assignments ura ON ura.cohort_id = cs.cohort_id
      WHERE cs.id = case_study_solutions.case_study_id
        AND ura.user_id = auth.uid()
    )
  );
