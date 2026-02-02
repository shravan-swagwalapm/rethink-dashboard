-- =====================================================
-- Migration: Override-Based Module Linking System
-- =====================================================
-- Date: 2026-02-03
-- Description: Transform module linking from additive to override model
--              Only ONE link allowed at a time (cohort OR global)
-- =====================================================

-- =====================================================
-- STEP 1: Add tracking columns to cohorts table
-- =====================================================

ALTER TABLE cohorts
ADD COLUMN IF NOT EXISTS active_link_type VARCHAR(20) DEFAULT 'own'
  CHECK (active_link_type IN ('own', 'cohort', 'global'));

ALTER TABLE cohorts
ADD COLUMN IF NOT EXISTS linked_cohort_id UUID
  REFERENCES cohorts(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_cohorts_active_link_type
ON cohorts(active_link_type);

CREATE INDEX IF NOT EXISTS idx_cohorts_linked_cohort
ON cohorts(linked_cohort_id);

COMMENT ON COLUMN cohorts.active_link_type IS
'Determines which modules students see: own, cohort (linked), or global';

COMMENT ON COLUMN cohorts.linked_cohort_id IS
'Source cohort ID when active_link_type = cohort (NULL otherwise)';

-- =====================================================
-- STEP 2: Add link_type column to cohort_module_links
-- =====================================================

ALTER TABLE cohort_module_links
ADD COLUMN IF NOT EXISTS link_type VARCHAR(20) DEFAULT 'cohort'
  CHECK (link_type IN ('cohort', 'global'));

-- Backfill existing data
UPDATE cohort_module_links
SET link_type = CASE
  WHEN source_cohort_id IS NULL THEN 'global'
  ELSE 'cohort'
END
WHERE link_type IS NULL;

-- Make NOT NULL after backfill
ALTER TABLE cohort_module_links
ALTER COLUMN link_type SET NOT NULL;

-- Create index for filtering by type
CREATE INDEX IF NOT EXISTS idx_cohort_module_links_type
ON cohort_module_links(cohort_id, link_type);

COMMENT ON COLUMN cohort_module_links.link_type IS
'Type of link: cohort (another cohort) or global (global library)';

-- =====================================================
-- STEP 3: Create trigger - Enforce Single Link
-- =====================================================

CREATE OR REPLACE FUNCTION enforce_single_link()
RETURNS TRIGGER AS $$
DECLARE
  v_source_name VARCHAR(255);
BEGIN
  -- Remove ALL existing links (cohort AND global)
  -- Only one link allowed at a time
  DELETE FROM cohort_module_links
  WHERE cohort_id = NEW.cohort_id
    AND id != NEW.id;

  -- Update cohort state based on link type
  IF NEW.link_type = 'global' THEN
    -- Linking to global library
    UPDATE cohorts
    SET active_link_type = 'global',
        linked_cohort_id = NULL
    WHERE id = NEW.cohort_id;

  ELSIF NEW.link_type = 'cohort' AND NEW.source_cohort_id IS NOT NULL THEN
    -- Linking to another cohort
    UPDATE cohorts
    SET active_link_type = 'cohort',
        linked_cohort_id = NEW.source_cohort_id
    WHERE id = NEW.cohort_id;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS before_insert_cohort_module_link ON cohort_module_links;

-- Create trigger
CREATE TRIGGER before_insert_cohort_module_link
BEFORE INSERT ON cohort_module_links
FOR EACH ROW
EXECUTE FUNCTION enforce_single_link();

COMMENT ON FUNCTION enforce_single_link() IS
'Ensures only ONE link exists per cohort (removes all old links before inserting new)';

-- =====================================================
-- STEP 4: Create trigger - Cleanup After Unlink
-- =====================================================

CREATE OR REPLACE FUNCTION cleanup_after_unlink()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if any links remain for this cohort
  IF NOT EXISTS (
    SELECT 1 FROM cohort_module_links
    WHERE cohort_id = OLD.cohort_id
  ) THEN
    -- No links remain - reset to own modules
    UPDATE cohorts
    SET active_link_type = 'own',
        linked_cohort_id = NULL
    WHERE id = OLD.cohort_id;
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS after_delete_cohort_module_link ON cohort_module_links;

-- Create trigger
CREATE TRIGGER after_delete_cohort_module_link
AFTER DELETE ON cohort_module_links
FOR EACH ROW
EXECUTE FUNCTION cleanup_after_unlink();

COMMENT ON FUNCTION cleanup_after_unlink() IS
'Resets cohort to own modules when all links are removed';

-- =====================================================
-- STEP 5: Backfill cohort state for existing links
-- =====================================================

-- Update cohorts that have global links
UPDATE cohorts c
SET active_link_type = 'global',
    linked_cohort_id = NULL
WHERE EXISTS (
  SELECT 1 FROM cohort_module_links cml
  WHERE cml.cohort_id = c.id
    AND cml.link_type = 'global'
)
AND active_link_type != 'global';

-- Update cohorts that have cohort links (and no global links)
UPDATE cohorts c
SET active_link_type = 'cohort',
    linked_cohort_id = (
      SELECT source_cohort_id
      FROM cohort_module_links
      WHERE cohort_id = c.id
        AND link_type = 'cohort'
      ORDER BY linked_at DESC
      LIMIT 1
    )
WHERE EXISTS (
  SELECT 1 FROM cohort_module_links cml
  WHERE cml.cohort_id = c.id
    AND cml.link_type = 'cohort'
)
AND active_link_type = 'own';

-- =====================================================
-- STEP 6: Add constraint to prevent simultaneous links
-- =====================================================

-- CRITICAL FIX: Create unique index to prevent ANY multiple links
-- (was: per type, now: per cohort - only ONE link total)
CREATE UNIQUE INDEX IF NOT EXISTS idx_cohort_single_link
ON cohort_module_links(cohort_id);

COMMENT ON INDEX idx_cohort_single_link IS
'Ensures only ONE link per cohort (cohort OR global, not both)';

-- =====================================================
-- STEP 7: Verification queries
-- =====================================================

-- Check for cohorts with multiple links (should be 0 after migration)
DO $$
DECLARE
  v_multi_link_count INTEGER;
BEGIN
  SELECT COUNT(DISTINCT cohort_id) INTO v_multi_link_count
  FROM (
    SELECT cohort_id, COUNT(*) as link_count
    FROM cohort_module_links
    GROUP BY cohort_id
    HAVING COUNT(*) > 1
  ) multi_links;

  IF v_multi_link_count > 0 THEN
    RAISE WARNING 'Found % cohorts with multiple links (triggers will clean up on next insert)', v_multi_link_count;
  ELSE
    RAISE NOTICE 'Migration successful: All cohorts have at most one link';
  END IF;
END $$;

-- Show summary of cohort states
DO $$
DECLARE
  v_own_count INTEGER;
  v_cohort_count INTEGER;
  v_global_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_own_count FROM cohorts WHERE active_link_type = 'own';
  SELECT COUNT(*) INTO v_cohort_count FROM cohorts WHERE active_link_type = 'cohort';
  SELECT COUNT(*) INTO v_global_count FROM cohorts WHERE active_link_type = 'global';

  RAISE NOTICE 'Cohort States:';
  RAISE NOTICE '  - Own modules: %', v_own_count;
  RAISE NOTICE '  - Linked to cohort: %', v_cohort_count;
  RAISE NOTICE '  - Linked to global: %', v_global_count;
  RAISE NOTICE '  - Total: %', v_own_count + v_cohort_count + v_global_count;
END $$;

-- =====================================================
-- Migration Complete
-- =====================================================
-- Next steps:
-- 1. Update API endpoints to use active_link_type
-- 2. Update UI to show single active link
-- 3. Test override behavior thoroughly
-- =====================================================
