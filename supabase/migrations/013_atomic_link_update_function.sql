-- =====================================================
-- Migration: Atomic Link Update Function
-- =====================================================
-- Date: 2026-02-03
-- Description: Create PostgreSQL function for atomic link updates
--              Prevents data loss if insert fails after delete
-- =====================================================

-- =====================================================
-- Create function for atomic link update
-- =====================================================

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
    -- Use recursive CTE to detect cycles up to 10 levels deep
    IF EXISTS (
      WITH RECURSIVE link_chain AS (
        -- Start with the source cohort
        SELECT id, linked_cohort_id, 1 as depth
        FROM cohorts
        WHERE id = p_source_cohort_id

        UNION ALL

        -- Follow the chain
        SELECT c.id, c.linked_cohort_id, lc.depth + 1
        FROM cohorts c
        INNER JOIN link_chain lc ON c.id = lc.linked_cohort_id
        WHERE lc.depth < 10  -- Prevent infinite recursion
      )
      SELECT 1 FROM link_chain WHERE linked_cohort_id = p_cohort_id
    ) THEN
      RETURN json_build_object(
        'success', false,
        'error', 'Transitive circular link detected: this would create a link cycle'
      );
    END IF;
  END IF;

  -- Start transaction (implicit in function)
  -- CRITICAL: Delete + Insert are atomic within this function

  -- Step 1: Delete ALL existing links (enforces single link constraint)
  DELETE FROM cohort_module_links
  WHERE cohort_id = p_cohort_id;

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  -- Step 2: Insert new links
  INSERT INTO cohort_module_links (cohort_id, module_id, source_cohort_id, link_type, linked_by)
  SELECT
    p_cohort_id,
    unnest(p_module_ids),
    CASE WHEN p_link_type = 'global' THEN NULL ELSE p_source_cohort_id END,
    p_link_type,
    p_linked_by;

  GET DIAGNOSTICS v_inserted_count = ROW_COUNT;

  -- Step 3: Get updated cohort state (set by triggers)
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
    -- If anything fails, transaction rolls back automatically
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM,
      'error_code', SQLSTATE
    );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION atomic_update_cohort_link IS
'Atomically updates cohort module links (delete all + insert new) with circular link prevention';

-- =====================================================
-- Create function for bulk unlink
-- =====================================================

CREATE OR REPLACE FUNCTION atomic_unlink_all(
  p_cohort_id UUID
)
RETURNS JSON AS $$
DECLARE
  v_deleted_count INTEGER;
  v_active_link_type VARCHAR;
BEGIN
  -- Validate input
  IF p_cohort_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'cohort_id is required'
    );
  END IF;

  -- Delete all links for this cohort
  DELETE FROM cohort_module_links
  WHERE cohort_id = p_cohort_id;

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  -- Get updated state (should be 'own' after trigger runs)
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

-- =====================================================
-- Create function for unlink by type
-- =====================================================

CREATE OR REPLACE FUNCTION atomic_unlink_by_type(
  p_cohort_id UUID,
  p_link_type VARCHAR
)
RETURNS JSON AS $$
DECLARE
  v_deleted_count INTEGER;
  v_active_link_type VARCHAR;
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

  -- Delete links of specified type
  DELETE FROM cohort_module_links
  WHERE cohort_id = p_cohort_id
    AND link_type = p_link_type;

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  -- Get updated state
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
-- Verification
-- =====================================================

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

  RAISE NOTICE 'All atomic functions created successfully';
END $$;

-- =====================================================
-- Migration Complete
-- =====================================================
-- Next step: Update API routes to use these functions via .rpc()
-- =====================================================
