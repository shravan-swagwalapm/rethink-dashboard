/**
 * Cohort certificates service — Phase 1 back-end foundation.
 *
 * Encapsulates the three operations a future route layer will perform against
 * the `cohort_certificates` table and the `certificates` storage bucket:
 *   - `replaceCertificate`  → admin upload (or replacement) of a learner's certificate.
 *   - `deleteCertificate`   → admin removal of a learner's certificate.
 *   - `issueCertSignedUrl`  → owner-only short-lived download URL.
 *
 * The functions accept a Supabase client (the service-role admin client at the
 * call site) and return discriminated-union results. No exceptions thrown for
 * predictable failures — callers branch on `result.ok`. Mirrors the shape of
 * `lib/services/role-assignments.ts` (commit 727fdfb).
 *
 * Storage path scheme: `{cohort_id}/{user_id}.{ext}` inside the `certificates`
 * bucket, where `ext` is derived from the file's MIME. Deterministic from
 * row keys so re-uploads overwrite cleanly via storage upsert.
 *
 * Rollback semantics (replaceCertificate):
 *   1. validate → fail returns `validate` (no storage call).
 *   2. storage.upload (upsert:true) → fail returns `storage_upload` (no DB write).
 *   3. DB upsert (chained with .select().single()) → fail attempts storage.remove cleanup:
 *        - cleanup succeeds → `db_upsert`.
 *        - cleanup fails → `rollback` with `originalError` set to the DB error.
 *   4. On success, if a prior row pointed at a different storage path
 *      (MIME-switch, e.g. .pdf → .png), the old object is removed
 *      best-effort. Failure does not affect the success result.
 *
 * RLS: this service expects the caller to pass the *service-role* client.
 * v1 ownership for signed URLs is enforced in app code (this module), not at
 * the DB/storage policy layer — bucket policies restrict to service role only.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const CERTIFICATES_BUCKET = 'certificates';
export const MAX_CERTIFICATE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
export const ALLOWED_CERTIFICATE_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'application/pdf',
] as const;
export const SIGNED_URL_TTL_SECONDS = 60; // 1 minute (per plan acceptance criterion)

type AllowedMime = (typeof ALLOWED_CERTIFICATE_MIME_TYPES)[number];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CertificateFileInput = {
  type: string;
  size: number;
  arrayBuffer(): Promise<ArrayBuffer>;
};

export type ReplaceCertificateInput = {
  userId: string;
  cohortId: string;
  file: CertificateFileInput;
  uploadedBy: string;
};

export type CertificateReplaceError =
  | { stage: 'validate'; reason: 'too_large' | 'invalid_type'; message: string }
  | { stage: 'storage_upload'; message: string; cause: unknown }
  | { stage: 'db_upsert'; message: string; cause: unknown }
  | {
      stage: 'rollback';
      message: string;
      cause: unknown;
      originalError: unknown;
    };

export type ReplaceCertificateResult =
  | { ok: true; row: { id: string; file_path: string } }
  | { ok: false; error: CertificateReplaceError };

export type DeleteCertificateResult =
  | { ok: true }
  | {
      ok: false;
      error: {
        stage: 'not_found' | 'storage_delete' | 'db_delete';
        message: string;
        cause?: unknown;
      };
    };

export type RecipientCertificateRow = {
  id: string;
  cohort_id: string;
  cohort_name: string | null;
  cohort_end_date: string | null;
  file_type: string;
  file_size: number;
  uploaded_at: string;
};

export type SignedUrlResult =
  | { ok: true; url: string; expiresIn: number }
  | {
      ok: false;
      error: {
        stage:
          | 'not_found'
          | 'not_owner'
          | 'cohort_not_completed'
          | 'storage_sign';
        message: string;
      };
    };

// ---------------------------------------------------------------------------
// Helpers (exported for unit-test pinning if needed)
// ---------------------------------------------------------------------------

export function isAllowedMime(type: string): type is AllowedMime {
  return (ALLOWED_CERTIFICATE_MIME_TYPES as readonly string[]).includes(type);
}

export function extensionForMime(mime: AllowedMime): 'png' | 'jpeg' | 'pdf' {
  switch (mime) {
    case 'image/png':
      return 'png';
    case 'image/jpeg':
      return 'jpeg';
    case 'application/pdf':
      return 'pdf';
  }
}

export function certificatePathFor(
  cohortId: string,
  userId: string,
  mime: AllowedMime,
): string {
  return `${cohortId}/${userId}.${extensionForMime(mime)}`;
}

function errMessage(e: unknown): string {
  if (e && typeof e === 'object' && 'message' in e) {
    const m = (e as { message?: unknown }).message;
    if (typeof m === 'string') return m;
  }
  return String(e);
}

// ---------------------------------------------------------------------------
// replaceCertificate
// ---------------------------------------------------------------------------

export async function replaceCertificate(
  adminClient: SupabaseClient,
  input: ReplaceCertificateInput,
): Promise<ReplaceCertificateResult> {
  const { userId, cohortId, file, uploadedBy } = input;

  // 1. Validate
  if (!isAllowedMime(file.type)) {
    return {
      ok: false,
      error: {
        stage: 'validate',
        reason: 'invalid_type',
        message: `Unsupported file type: ${file.type}`,
      },
    };
  }
  if (file.size > MAX_CERTIFICATE_SIZE_BYTES) {
    return {
      ok: false,
      error: {
        stage: 'validate',
        reason: 'too_large',
        message: `File size ${file.size} exceeds 10 MB limit`,
      },
    };
  }

  const path = certificatePathFor(cohortId, userId, file.type);

  // 2. Look up any existing row so we can detect a MIME-switch orphan after
  // the upsert succeeds. The old object only needs removal when the extension
  // (and therefore the storage path) changes — same-path uploads overwrite
  // via storage upsert. Lookup failure is non-fatal: we proceed as if no
  // prior row existed; worst case we leave a stale file (no user-visible
  // breakage), which is preferable to blocking the replacement.
  const { data: existingRow } = await adminClient
    .from('cohort_certificates')
    .select('file_path')
    .eq('user_id', userId)
    .eq('cohort_id', cohortId)
    .maybeSingle();
  const previousPath =
    existingRow && typeof (existingRow as { file_path?: unknown }).file_path === 'string'
      ? ((existingRow as { file_path: string }).file_path)
      : null;

  // 3. Storage upload (upsert:true → idempotent for same path)
  const buffer = await file.arrayBuffer();
  const { error: uploadError } = await adminClient.storage
    .from(CERTIFICATES_BUCKET)
    .upload(path, buffer, {
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) {
    return {
      ok: false,
      error: {
        stage: 'storage_upload',
        message: errMessage(uploadError),
        cause: uploadError,
      },
    };
  }

  // 4. DB upsert (UNIQUE(user_id, cohort_id) routes between INSERT/UPDATE).
  // Collapsed into a single chain with .select().single() — the canonical row
  // returns in one round-trip and the read-back-after-write failure mode is
  // gone: Supabase returns the row iff the write succeeded.
  const rowToInsert = {
    user_id: userId,
    cohort_id: cohortId,
    file_path: path,
    file_type: file.type,
    file_size: file.size,
    uploaded_by: uploadedBy,
  };

  const { data: row, error: upsertError } = await adminClient
    .from('cohort_certificates')
    .upsert(rowToInsert, { onConflict: 'user_id,cohort_id' })
    .select('id, file_path')
    .single();

  if (upsertError || !row) {
    // Attempt to clean up the orphan storage object before surfacing.
    const { error: cleanupError } = await adminClient.storage
      .from(CERTIFICATES_BUCKET)
      .remove([path]);

    if (cleanupError) {
      return {
        ok: false,
        error: {
          stage: 'rollback',
          message: errMessage(cleanupError),
          cause: cleanupError,
          originalError: upsertError,
        },
      };
    }

    return {
      ok: false,
      error: {
        stage: 'db_upsert',
        message: upsertError ? errMessage(upsertError) : 'Upsert returned no row',
        cause: upsertError,
      },
    };
  }

  // 5. MIME-switch cleanup: if the prior cert lived at a different path
  // (e.g. admin replaced .pdf with .png), remove the orphaned object. Failure
  // here is non-fatal — the replacement succeeded from the user's POV.
  if (previousPath && previousPath !== path) {
    await adminClient.storage.from(CERTIFICATES_BUCKET).remove([previousPath]);
  }

  return {
    ok: true,
    row: {
      id: (row as { id: string }).id,
      file_path: (row as { file_path: string }).file_path,
    },
  };
}

// ---------------------------------------------------------------------------
// deleteCertificate
// ---------------------------------------------------------------------------

export async function deleteCertificate(
  adminClient: SupabaseClient,
  certId: string,
): Promise<DeleteCertificateResult> {
  // 1. Look up the file_path so we can remove the storage object.
  const { data: cert, error: lookupError } = await adminClient
    .from('cohort_certificates')
    .select('id, file_path')
    .eq('id', certId)
    .single();

  if (lookupError || !cert) {
    return {
      ok: false,
      error: {
        stage: 'not_found',
        message: lookupError ? errMessage(lookupError) : 'Certificate not found',
        cause: lookupError ?? undefined,
      },
    };
  }

  const filePath = (cert as { file_path: string }).file_path;

  // 2. Delete the DB row FIRST, then remove storage. Order matters:
  // DB-first prefers orphaned storage (cheap, repairable by a janitor) over
  // orphaned DB rows pointing at non-existent objects (user-visible 500s on
  // later signed-URL requests).
  const { error: deleteError } = await adminClient
    .from('cohort_certificates')
    .delete()
    .eq('id', certId);

  if (deleteError) {
    return {
      ok: false,
      error: {
        stage: 'db_delete',
        message: errMessage(deleteError),
        cause: deleteError,
      },
    };
  }

  // 3. Best-effort storage cleanup. DB row is gone — the user's intent
  // ("remove this cert from my view") is fulfilled. A residual storage object
  // is recoverable by a janitor job and surfaces no user-facing breakage, so
  // we swallow the error rather than misreport the operation as failed.
  await adminClient.storage.from(CERTIFICATES_BUCKET).remove([filePath]);

  return { ok: true };
}

// ---------------------------------------------------------------------------
// issueCertSignedUrl
// ---------------------------------------------------------------------------

export async function issueCertSignedUrl(
  adminClient: SupabaseClient,
  certId: string,
  requestingUserId: string,
): Promise<SignedUrlResult> {
  // 1. Look up the cert + joined cohort status.
  const { data: cert, error: lookupError } = await adminClient
    .from('cohort_certificates')
    .select('id, user_id, cohort_id, file_path, cohorts(status)')
    .eq('id', certId)
    .single();

  if (lookupError || !cert) {
    return {
      ok: false,
      error: {
        stage: 'not_found',
        message: lookupError ? errMessage(lookupError) : 'Certificate not found',
      },
    };
  }

  const typedCert = cert as {
    id: string;
    user_id: string;
    cohort_id: string;
    file_path: string;
    cohorts?: { status?: string } | { status?: string }[] | null;
  };

  // 2. Owner check.
  if (typedCert.user_id !== requestingUserId) {
    return {
      ok: false,
      error: {
        stage: 'not_owner',
        message: 'Requesting user does not own this certificate',
      },
    };
  }

  // 3. Cohort-completion check.
  const cohortStatus = Array.isArray(typedCert.cohorts)
    ? typedCert.cohorts[0]?.status
    : typedCert.cohorts?.status;

  if (cohortStatus !== 'completed') {
    return {
      ok: false,
      error: {
        stage: 'cohort_not_completed',
        message: 'Cohort is not yet completed',
      },
    };
  }

  // 4. Mint signed URL.
  const { data: signed, error: signError } = await adminClient.storage
    .from(CERTIFICATES_BUCKET)
    .createSignedUrl(typedCert.file_path, SIGNED_URL_TTL_SECONDS);

  if (signError || !signed) {
    return {
      ok: false,
      error: {
        stage: 'storage_sign',
        message: signError ? errMessage(signError) : 'Failed to create signed URL',
      },
    };
  }

  return {
    ok: true,
    url: (signed as { signedUrl: string }).signedUrl,
    expiresIn: SIGNED_URL_TTL_SECONDS,
  };
}

// ---------------------------------------------------------------------------
// listCertificatesForUser
// ---------------------------------------------------------------------------

/**
 * Recipient-side list of certificates. The caller MUST pass a user-scoped
 * Supabase client (`createClient()`), not the admin client — RLS does the
 * filtering, restricting rows to `auth.uid() = user_id` plus the joined
 * cohort being in the `completed` state. Per the architectural convention,
 * the route layer never embeds query construction here; that lives in the
 * service module so it can be unit-tested in isolation.
 *
 * Sort contract:
 *   1. `cohort_end_date DESC` (most recent on top).
 *   2. NULL end dates sink to the bottom.
 *   3. Ties on end_date are broken by `uploaded_at DESC` (deterministic ordering
 *      when an admin issues two certs for cohorts that share an end date — the
 *      most recently uploaded comes first).
 *
 * Throws on Supabase errors — the route catches and returns a 500. Same
 * pattern as `replaceCertificate`/`deleteCertificate`'s discriminated-union
 * is intentionally NOT used here: the read path has exactly one failure mode
 * (DB error) and the route's catch-block surfaces it without branching.
 */
export async function listCertificatesForUser(
  client: SupabaseClient,
): Promise<RecipientCertificateRow[]> {
  const { data, error } = await client
    .from('cohort_certificates')
    .select(
      'id, cohort_id, file_type, file_size, uploaded_at, cohorts!inner(name, end_date)',
    );

  if (error) {
    throw new Error(errMessage(error));
  }

  type Row = {
    id: string;
    cohort_id: string;
    file_type: string;
    file_size: number;
    uploaded_at: string;
    cohorts:
      | { name: string | null; end_date: string | null }
      | { name: string | null; end_date: string | null }[]
      | null;
  };

  const flattened: RecipientCertificateRow[] = (
    (data as Row[] | null) ?? []
  ).map((row) => {
    // PostgREST returns the joined table as either an object (when the FK is
    // many-to-one and the embed resolves uniquely) or an array (when the
    // relationship is ambiguous). Handle both shapes defensively.
    const cohort = Array.isArray(row.cohorts) ? row.cohorts[0] : row.cohorts;
    return {
      id: row.id,
      cohort_id: row.cohort_id,
      cohort_name: cohort?.name ?? null,
      cohort_end_date: cohort?.end_date ?? null,
      file_type: row.file_type,
      file_size: row.file_size,
      uploaded_at: row.uploaded_at,
    };
  });

  // Sort by end_date DESC NULLS LAST, tie-broken by uploaded_at DESC. Done
  // here (not in the SELECT) because PostgREST's `nullsfirst/nullslast`
  // modifier on a joined column is brittle — pushing it server-side would
  // require a view. The N is small (one user's certs), so a client-side
  // sort is cheap and the contract is testable.
  flattened.sort((a, b) => {
    if (a.cohort_end_date !== b.cohort_end_date) {
      if (a.cohort_end_date === null) return 1;
      if (b.cohort_end_date === null) return -1;
      return a.cohort_end_date < b.cohort_end_date ? 1 : -1;
    }
    // Tie-break: same end_date (or both null) → most recently uploaded first.
    if (a.uploaded_at === b.uploaded_at) return 0;
    return a.uploaded_at < b.uploaded_at ? 1 : -1;
  });

  return flattened;
}
