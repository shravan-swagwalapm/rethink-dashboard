-- Fix: Non-global modules must have a cohort_id
-- Previously the constraint allowed is_global=false with cohort_id=NULL

ALTER TABLE learning_modules
  DROP CONSTRAINT IF EXISTS check_global_module;

ALTER TABLE learning_modules
  ADD CONSTRAINT check_global_module CHECK (
    (is_global = true AND cohort_id IS NULL) OR
    (is_global = false AND cohort_id IS NOT NULL)
  );
