-- Patch: Add legacy profiles.cohort_id fallback to student RLS policy
-- Students who only have profiles.cohort_id (no user_role_assignments row)
-- were getting empty solution arrays.

DROP POLICY IF EXISTS "Students can read solutions for their cohort case studies"
  ON case_study_solutions;

CREATE POLICY "Students can read solutions for their cohort case studies"
  ON case_study_solutions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM case_studies cs
      JOIN user_role_assignments ura ON ura.cohort_id = cs.cohort_id
      WHERE cs.id = case_study_solutions.case_study_id
        AND ura.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM case_studies cs
      JOIN profiles p ON p.cohort_id = cs.cohort_id
      WHERE cs.id = case_study_solutions.case_study_id
        AND p.id = auth.uid()
    )
  );
