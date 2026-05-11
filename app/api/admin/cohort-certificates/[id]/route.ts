import { createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/api/verify-admin';
import { deleteCertificate } from '@/lib/services/certificates';

/**
 * DELETE /api/admin/cohort-certificates/[id]
 *
 * Hard-deletes a certificate row and its associated storage object. Thin HTTP
 * wrapper over `lib/services/certificates.ts#deleteCertificate`.
 *
 * Error mapping:
 *   - `not_found`       → 404
 *   - `storage_delete`  → 500
 *   - `db_delete`       → 500
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;

  if (!id) {
    return NextResponse.json(
      { error: 'Certificate id is required' },
      { status: 400 }
    );
  }

  try {
    const adminClient = await createAdminClient();
    const result = await deleteCertificate(adminClient, id);

    if (!result.ok) {
      const stage = result.error.stage;
      const status = stage === 'not_found' ? 404 : 500;
      return NextResponse.json(
        { error: result.error.message, stage },
        { status }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error && typeof error === 'object' && 'message' in error
        ? String((error as { message?: unknown }).message)
        : 'Failed to delete certificate';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
