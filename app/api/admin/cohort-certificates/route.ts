import { createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyAdmin } from '@/lib/api/verify-admin';
import { replaceCertificate } from '@/lib/services/certificates';

const uuidSchema = z.string().uuid();

/**
 * POST /api/admin/cohort-certificates
 *
 * Multipart upload (or replacement) of a cohort completion certificate for a
 * single user. Thin HTTP wrapper over `lib/services/certificates.ts#replaceCertificate`
 * — all validation, storage, DB upsert, and MIME-switch cleanup live there.
 *
 * Form fields: `user_id`, `cohort_id`, `file`.
 *
 * Error mapping (discriminated-union stages from the service):
 *   - `validate`        → 400 (with reason in body)
 *   - `storage_upload`  → 500
 *   - `db_upsert`       → 500
 *   - `rollback`        → 500
 */
export async function POST(request: NextRequest) {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const formData = await request.formData();
    const userId = formData.get('user_id');
    const cohortId = formData.get('cohort_id');
    const file = formData.get('file');

    if (typeof userId !== 'string' || !userId) {
      return NextResponse.json(
        { error: 'user_id is required', stage: 'validate' },
        { status: 400 }
      );
    }
    if (typeof cohortId !== 'string' || !cohortId) {
      return NextResponse.json(
        { error: 'cohort_id is required', stage: 'validate' },
        { status: 400 }
      );
    }
    if (!file || typeof file === 'string' || !(file instanceof File)) {
      return NextResponse.json(
        { error: 'file is required', stage: 'validate' },
        { status: 400 }
      );
    }

    // UUID shape check — fail fast before we touch storage or the DB. Postgres
    // would otherwise return "invalid input syntax for type uuid" as an opaque 500.
    if (!uuidSchema.safeParse(userId).success || !uuidSchema.safeParse(cohortId).success) {
      return NextResponse.json(
        {
          error: 'Invalid user_id or cohort_id',
          stage: 'validate',
          reason: 'invalid_uuid',
        },
        { status: 400 }
      );
    }

    const adminClient = await createAdminClient();

    // Membership check — the service trusts its inputs, so request validation
    // (is this user even in this cohort?) belongs here. Prevents "ghost certs"
    // for users not in user_role_assignments, which RLS would then surface to them.
    const { data: membership, error: membershipError } = await adminClient
      .from('user_role_assignments')
      .select('user_id')
      .eq('user_id', userId)
      .eq('cohort_id', cohortId)
      .in('role', ['student', 'mentor'])
      .maybeSingle();

    if (membershipError) {
      return NextResponse.json(
        { error: membershipError.message, stage: 'validate' },
        { status: 500 }
      );
    }
    if (!membership) {
      return NextResponse.json(
        {
          error: 'Recipient is not a member of this cohort',
          stage: 'validate',
          reason: 'not_member',
        },
        { status: 400 }
      );
    }

    const result = await replaceCertificate(adminClient, {
      userId,
      cohortId,
      file,
      uploadedBy: auth.userId,
    });

    if (!result.ok) {
      const stage = result.error.stage;
      if (stage === 'validate') {
        return NextResponse.json(
          {
            error: result.error.message,
            stage,
            reason: result.error.reason,
          },
          { status: 400 }
        );
      }
      // storage_upload | db_upsert | rollback → 500
      return NextResponse.json(
        {
          error: result.error.message,
          stage,
        },
        { status: 500 }
      );
    }

    // Client calls fetchMembers() after a successful upload, so the route stays
    // thin — no widening select needed here.
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error && typeof error === 'object' && 'message' in error
        ? String((error as { message?: unknown }).message)
        : 'Failed to upload certificate';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
