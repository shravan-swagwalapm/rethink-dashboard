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
