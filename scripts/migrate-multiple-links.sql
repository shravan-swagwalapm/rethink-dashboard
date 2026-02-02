-- =====================================================
-- Data Migration: Clean Up Multiple Links
-- =====================================================
-- Date: 2026-02-03
-- Purpose: Find and fix cohorts with multiple links
--          (prepare for single-link constraint)
-- =====================================================

-- =====================================================
-- STEP 1: Audit - Find cohorts with multiple links
-- =====================================================

SELECT
  c.id,
  c.name,
  c.tag,
  COUNT(DISTINCT cml.id) as total_links,
  COUNT(DISTINCT CASE WHEN cml.link_type = 'cohort' THEN cml.id END) as cohort_links,
  COUNT(DISTINCT CASE WHEN cml.link_type = 'global' THEN cml.id END) as global_links,
  ARRAY_AGG(DISTINCT cml.source_cohort_id) FILTER (WHERE cml.link_type = 'cohort') as linked_cohort_ids
FROM cohorts c
INNER JOIN cohort_module_links cml ON cml.cohort_id = c.id
GROUP BY c.id, c.name, c.tag
HAVING COUNT(DISTINCT cml.id) > 1
ORDER BY total_links DESC;

-- =====================================================
-- STEP 2: Show affected modules
-- =====================================================

SELECT
  c.name as cohort_name,
  c.tag as cohort_tag,
  cml.link_type,
  sc.name as source_cohort_name,
  COUNT(cml.module_id) as module_count,
  cml.linked_at
FROM cohorts c
INNER JOIN cohort_module_links cml ON cml.cohort_id = c.id
LEFT JOIN cohorts sc ON sc.id = cml.source_cohort_id
WHERE c.id IN (
  SELECT cohort_id
  FROM cohort_module_links
  GROUP BY cohort_id
  HAVING COUNT(*) > 1
)
GROUP BY c.name, c.tag, cml.link_type, sc.name, cml.linked_at
ORDER BY c.name, cml.linked_at DESC;

-- =====================================================
-- STEP 3: Decision Logic - Keep Most Recent Link
-- =====================================================

-- Strategy: For each cohort with multiple links,
--           keep the most recently created link
--           (based on linked_at timestamp)

-- Preview what will be deleted (DRY RUN)
SELECT
  c.name as cohort_name,
  cml.id as link_id,
  cml.link_type,
  sc.name as source_cohort,
  cml.linked_at,
  ROW_NUMBER() OVER (PARTITION BY cml.cohort_id ORDER BY cml.linked_at DESC) as keep_order,
  CASE
    WHEN ROW_NUMBER() OVER (PARTITION BY cml.cohort_id ORDER BY cml.linked_at DESC) = 1
    THEN 'KEEP'
    ELSE 'DELETE'
  END as action
FROM cohort_module_links cml
INNER JOIN cohorts c ON c.id = cml.cohort_id
LEFT JOIN cohorts sc ON sc.id = cml.source_cohort_id
WHERE cml.cohort_id IN (
  SELECT cohort_id
  FROM cohort_module_links
  GROUP BY cohort_id
  HAVING COUNT(*) > 1
)
ORDER BY c.name, cml.linked_at DESC;

-- =====================================================
-- STEP 4: Execute Cleanup (DESTRUCTIVE - Use Carefully)
-- =====================================================

-- Uncomment to execute:
/*
BEGIN;

-- Delete all but the most recent link per cohort
DELETE FROM cohort_module_links
WHERE id IN (
  SELECT id
  FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (PARTITION BY cohort_id ORDER BY linked_at DESC) as rn
    FROM cohort_module_links
  ) ranked
  WHERE rn > 1
);

-- Verify cleanup
SELECT
  COUNT(DISTINCT cohort_id) as cohorts_with_links,
  COUNT(*) as total_links,
  COUNT(DISTINCT cohort_id) FILTER (WHERE rn = 1) as cohorts_with_single_link
FROM (
  SELECT
    cohort_id,
    ROW_NUMBER() OVER (PARTITION BY cohort_id ORDER BY linked_at DESC) as rn
  FROM cohort_module_links
) ranked;

-- Expected result: cohorts_with_links = cohorts_with_single_link

COMMIT;
-- Or ROLLBACK; to undo
*/

-- =====================================================
-- STEP 5: Post-Migration Verification
-- =====================================================

-- Check: No cohorts should have multiple links
SELECT
  cohort_id,
  COUNT(*) as link_count
FROM cohort_module_links
GROUP BY cohort_id
HAVING COUNT(*) > 1;
-- Expected: 0 rows

-- Check: All cohorts have correct active_link_type
SELECT
  c.id,
  c.name,
  c.active_link_type,
  c.linked_cohort_id,
  cml.link_type,
  cml.source_cohort_id
FROM cohorts c
LEFT JOIN cohort_module_links cml ON cml.cohort_id = c.id
WHERE (
  -- Mismatch: global link but not marked as global
  (cml.link_type = 'global' AND c.active_link_type != 'global')
  OR
  -- Mismatch: cohort link but not marked as cohort
  (cml.link_type = 'cohort' AND c.active_link_type != 'cohort')
  OR
  -- Mismatch: cohort link but linked_cohort_id doesn't match
  (cml.link_type = 'cohort' AND c.linked_cohort_id != cml.source_cohort_id)
);
-- Expected: 0 rows

-- =====================================================
-- STEP 6: Summary Report
-- =====================================================

SELECT
  'Total Cohorts' as metric,
  COUNT(*) as count
FROM cohorts

UNION ALL

SELECT
  'Cohorts with Own Modules',
  COUNT(*)
FROM cohorts
WHERE active_link_type = 'own'

UNION ALL

SELECT
  'Cohorts Linked to Other Cohort',
  COUNT(*)
FROM cohorts
WHERE active_link_type = 'cohort'

UNION ALL

SELECT
  'Cohorts Linked to Global',
  COUNT(*)
FROM cohorts
WHERE active_link_type = 'global'

UNION ALL

SELECT
  'Total Module Links',
  COUNT(*)
FROM cohort_module_links

UNION ALL

SELECT
  'Cohort Type Links',
  COUNT(*)
FROM cohort_module_links
WHERE link_type = 'cohort'

UNION ALL

SELECT
  'Global Type Links',
  COUNT(*)
FROM cohort_module_links
WHERE link_type = 'global';

-- =====================================================
-- Migration Complete
-- =====================================================
-- Recommendation:
-- 1. Run STEP 1-3 first to review what will be changed
-- 2. Notify admins of affected cohorts
-- 3. Uncomment and run STEP 4 to execute cleanup
-- 4. Run STEP 5-6 to verify success
-- =====================================================
