-- Migration: Cohort Certificates (Phase 1 back-end foundation)
-- =============================================================================
-- Adds a new `cohort_certificates` table for storing a single certificate per
-- (user, cohort) pair, plus a private `certificates` storage bucket sized for
-- the file types the admin UI will accept.
--
-- Scope (Phase 1):
--   - Table + indexes + RLS enabled with read-only policies for owners on
--     completed cohorts.
--   - All write paths are denied to anon/authenticated; mutations go through
--     the service-role admin client gated by `verifyAdmin()`.
--   - Storage bucket `certificates` (private, 10 MB cap, narrow MIME allow-list).
--   - Storage object policies restrict every operation to the service role.
--
-- Out of scope (Phase 2+):
--   - HTTP routes, UI, and any use of `share_token` (column exists but is
--     reserved — never populated in v1 code paths).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. cohort_certificates table
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS cohort_certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  cohort_id UUID NOT NULL REFERENCES cohorts(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('image/png', 'image/jpeg', 'application/pdf')),
  file_size BIGINT NOT NULL,
  share_token UUID NULL, -- reserved for v2 public-share; do not populate in v1
  uploaded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, cohort_id)
);

CREATE INDEX IF NOT EXISTS idx_cohort_certificates_user
  ON cohort_certificates(user_id);
CREATE INDEX IF NOT EXISTS idx_cohort_certificates_cohort
  ON cohort_certificates(cohort_id);

-- -----------------------------------------------------------------------------
-- 2. Row Level Security
-- -----------------------------------------------------------------------------
-- Reads: owner-only AND only when the cohort is in 'completed' state.
-- Writes: denied to anon and authenticated. Service role bypasses RLS, so all
-- admin mutations flow through `createAdminClient()` gated by `verifyAdmin()`.

ALTER TABLE cohort_certificates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view their certificate when cohort completed"
  ON cohort_certificates FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM cohorts c
      WHERE c.id = cohort_certificates.cohort_id
        AND c.status = 'completed'
    )
  );

-- No INSERT/UPDATE/DELETE policies are created on purpose.
-- Without a policy, PostgREST denies the operation for non-service-role JWTs.
-- The service-role key bypasses RLS for admin-driven writes.

-- -----------------------------------------------------------------------------
-- 3. Storage bucket: certificates
-- -----------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'certificates',
  'certificates',
  false,
  10485760, -- 10 MB
  ARRAY[
    'image/png',
    'image/jpeg',
    'application/pdf'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 4. Storage object policies (service role only)
-- -----------------------------------------------------------------------------
-- All operations on objects in the `certificates` bucket are restricted to the
-- service role. The owner-download path is mediated by short-lived signed URLs
-- minted by `issueCertSignedUrl()` after an app-level ownership check.

CREATE POLICY "Service role can manage certificates objects (SELECT)"
  ON storage.objects FOR SELECT
  TO service_role
  USING (bucket_id = 'certificates');

CREATE POLICY "Service role can manage certificates objects (INSERT)"
  ON storage.objects FOR INSERT
  TO service_role
  WITH CHECK (bucket_id = 'certificates');

CREATE POLICY "Service role can manage certificates objects (UPDATE)"
  ON storage.objects FOR UPDATE
  TO service_role
  USING (bucket_id = 'certificates');

CREATE POLICY "Service role can manage certificates objects (DELETE)"
  ON storage.objects FOR DELETE
  TO service_role
  USING (bucket_id = 'certificates');
