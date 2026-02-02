-- =====================================================
-- COMPLETE MIGRATION: Override Module Linking System
-- =====================================================
-- Date: 2026-02-03
-- Description: Combines migrations 012 + 013
-- Copy this ENTIRE file and paste into Supabase SQL Editor
-- =====================================================

-- =====================================================
-- PART 1: Schema Changes (Migration 012)
-- =====================================================

-- Add tracking columns to cohorts table
ALTER TABLE cohorts
ADD COLUMN IF NOT EXISTS active_link_type VARCHAR(20) DEFAULT 'own'
  CHECK (active_link_type IN ('own', 'cohort', 'global'));

ALTER TABLE cohorts
ADD COLUMN IF NOT EXISTS linked_cohort_id UUID
  REFERENCES cohorts(id) ON DELETE SET NULL;

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_cohorts_active_link_type
ON cohorts(active_link_type);

CREATE INDEX IF NOT EXISTS idx_cohorts_linked_cohort
ON cohorts(linked_cohort_id);

COMMENT ON COLUMN cohorts.active_link_type IS
'Determines which modules students see: own, cohort (linked), or global';

COMMENT ON COLUMN cohorts.linked_cohort_id IS
'Source cohort ID when active_link_type = cohort (NULL otherwise)';

-- Add link_type column to cohort_module_links
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
-- PART 2: Database Triggers
-- =====================================================

-- Trigger 1: Enforce Single Link (removes old links on insert)
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

DROP TRIGGER IF EXISTS before_insert_cohort_module_link ON cohort_module_links;

CREATE TRIGGER before_insert_cohort_module_link
BEFORE INSERT ON cohort_module_links
FOR EACH ROW
EXECUTE FUNCTION enforce_single_link();

COMMENT ON FUNCTION enforce_single_link() IS
'Ensures only ONE link exists per cohort (removes all old links before inserting new)';

-- Trigger 2: Cleanup After Unlink (reset to 'own' when no links remain)
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

DROP TRIGGER IF EXISTS after_delete_cohort_module_link ON cohort_module_links;

CREATE TRIGGER after_delete_cohort_module_link
AFTER DELETE ON cohort_module_links
FOR EACH ROW
EXECUTE FUNCTION cleanup_after_unlink();

COMMENT ON FUNCTION cleanup_after_unlink() IS
'Resets cohort to own modules when all links are removed';

-- =====================================================
-- PART 3: Backfill Existing Data
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

-- Add constraint to prevent simultaneous links
CREATE UNIQUE INDEX IF NOT EXISTS idx_cohort_single_link
ON cohort_module_links(cohort_id);

COMMENT ON INDEX idx_cohort_single_link IS
'Ensures only ONE link per cohort (cohort OR global, not both)';

-- =====================================================
-- PART 4: Atomic PostgreSQL Functions (Migration 013)
-- =====================================================

-- Function 1: atomic_update_cohort_link
CREATE OR REPLACE FUNCTION atomic_update_cohort_link(
  p_cohort_id UUID,
  p_source_cohort_id UUID,
  p_link_type VARCHAR,
  p_module_ids UUID[],
  p_linked_by UUID
)
RETURNS JSON AS $$
DECLARE
  v_result JSON;
  v_deleted_count INTEGER;
  v_inserted_count INTEGER;
  v_active_link_type VARCHAR;
  v_linked_cohort_id UUID;
BEGIN
  -- Validate inputs
  IF p_cohort_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'cohort_id is required'
    );
  END IF;

  IF p_link_type NOT IN ('cohort', 'global') THEN
    RETURN json_build_object(
      'success', false,
      'error', 'link_type must be cohort or global'
    );
  END IF;

  -- Prevent circular links (Cohort A → Cohort B → Cohort A)
  IF p_link_type = 'cohort' AND p_source_cohort_id IS NOT NULL THEN
    -- Check if source cohort is linked to target cohort
    IF EXISTS (
      SELECT 1 FROM cohorts
      WHERE id = p_source_cohort_id
        AND linked_cohort_id = p_cohort_id
    ) THEN
      RETURN json_build_object(
        'success', false,
        'error', 'Circular link detected: source cohort is already linked to this cohort'
      );
    END IF;

    -- Check for deeper circular links (A → B → C → A)
    IF EXISTS (
      WITH RECURSIVE link_chain AS (
        SELECT id, linked_cohort_id, 1 as depth
        FROM cohorts
        WHERE id = p_source_cohort_id

        UNION ALL

        SELECT c.id, c.linked_cohort_id, lc.depth + 1
        FROM cohorts c
        INNER JOIN link_chain lc ON c.id = lc.linked_cohort_id
        WHERE lc.depth < 10
      )
      SELECT 1 FROM link_chain WHERE linked_cohort_id = p_cohort_id
    ) THEN
      RETURN json_build_object(
        'success', false,
        'error', 'Transitive circular link detected: this would create a link cycle'
      );
    END IF;
  END IF;

  -- Delete ALL existing links (enforces single link constraint)
  DELETE FROM cohort_module_links
  WHERE cohort_id = p_cohort_id;

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  -- Insert new links
  INSERT INTO cohort_module_links (cohort_id, module_id, source_cohort_id, link_type, linked_by)
  SELECT
    p_cohort_id,
    unnest(p_module_ids),
    CASE WHEN p_link_type = 'global' THEN NULL ELSE p_source_cohort_id END,
    p_link_type,
    p_linked_by;

  GET DIAGNOSTICS v_inserted_count = ROW_COUNT;

  -- Get updated cohort state (set by triggers)
  SELECT active_link_type, linked_cohort_id
  INTO v_active_link_type, v_linked_cohort_id
  FROM cohorts
  WHERE id = p_cohort_id;

  -- Return success with stats
  RETURN json_build_object(
    'success', true,
    'deleted_count', v_deleted_count,
    'inserted_count', v_inserted_count,
    'active_link_type', v_active_link_type,
    'linked_cohort_id', v_linked_cohort_id
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM,
      'error_code', SQLSTATE
    );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION atomic_update_cohort_link IS
'Atomically updates cohort module links (delete all + insert new) with circular link prevention';

-- Function 2: atomic_unlink_all
CREATE OR REPLACE FUNCTION atomic_unlink_all(
  p_cohort_id UUID
)
RETURNS JSON AS $$
DECLARE
  v_deleted_count INTEGER;
  v_active_link_type VARCHAR;
BEGIN
  IF p_cohort_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'cohort_id is required'
    );
  END IF;

  DELETE FROM cohort_module_links
  WHERE cohort_id = p_cohort_id;

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  SELECT active_link_type
  INTO v_active_link_type
  FROM cohorts
  WHERE id = p_cohort_id;

  RETURN json_build_object(
    'success', true,
    'deleted_count', v_deleted_count,
    'active_link_type', COALESCE(v_active_link_type, 'own')
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION atomic_unlink_all IS
'Atomically removes all module links for a cohort';

-- Function 3: atomic_unlink_by_type
CREATE OR REPLACE FUNCTION atomic_unlink_by_type(
  p_cohort_id UUID,
  p_link_type VARCHAR
)
RETURNS JSON AS $$
DECLARE
  v_deleted_count INTEGER;
  v_active_link_type VARCHAR;
BEGIN
  IF p_cohort_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'cohort_id is required'
    );
  END IF;

  IF p_link_type NOT IN ('cohort', 'global') THEN
    RETURN json_build_object(
      'success', false,
      'error', 'link_type must be cohort or global'
    );
  END IF;

  DELETE FROM cohort_module_links
  WHERE cohort_id = p_cohort_id
    AND link_type = p_link_type;

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  SELECT active_link_type
  INTO v_active_link_type
  FROM cohorts
  WHERE id = p_cohort_id;

  RETURN json_build_object(
    'success', true,
    'deleted_count', v_deleted_count,
    'active_link_type', COALESCE(v_active_link_type, 'own')
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION atomic_unlink_by_type IS
'Atomically removes all module links of a specific type for a cohort';

-- =====================================================
-- PART 5: Verification & Summary
-- =====================================================

-- Check for cohorts with multiple links
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
    RAISE NOTICE '✓ Migration successful: All cohorts have at most one link';
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

  RAISE NOTICE '✓ Cohort States:';
  RAISE NOTICE '  - Own modules: %', v_own_count;
  RAISE NOTICE '  - Linked to cohort: %', v_cohort_count;
  RAISE NOTICE '  - Linked to global: %', v_global_count;
  RAISE NOTICE '  - Total: %', v_own_count + v_cohort_count + v_global_count;
END $$;

-- Test that functions exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'atomic_update_cohort_link') THEN
    RAISE EXCEPTION 'Function atomic_update_cohort_link not created';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'atomic_unlink_all') THEN
    RAISE EXCEPTION 'Function atomic_unlink_all not created';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'atomic_unlink_by_type') THEN
    RAISE EXCEPTION 'Function atomic_unlink_by_type not created';
  END IF;

  RAISE NOTICE '✓ All atomic functions created successfully';
END $$;

-- =====================================================
-- MIGRATION COMPLETE!
-- =====================================================
-- You should see green checkmarks (✓) above
-- Next: Run npm run verify-migrations to confirm
-- =====================================================
