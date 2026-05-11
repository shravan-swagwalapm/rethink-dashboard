import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { issueCertSignedUrl } from '@/lib/services/certificates';

/**
 * GET /api/certificates/[id]/signed-url
 *
 * Recipient-side signed-URL endpoint. Authenticates the session, then delegates
 * ownership + cohort.status='completed' enforcement to the service module —
 * no checks duplicated here.
 *
 * Stage → status mapping:
 *   - `not_found`              → 404
 *   - `not_owner`              → 403
 *   - `cohort_not_completed`   → 403
 *   - `storage_sign`           → 500
 *
 * On success: { ok: true, url, expiresIn } — pass-through of the service result.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json(
      { error: 'Certificate id is required' },
      { status: 400 },
    );
  }

  try {
    const adminClient = await createAdminClient();
    const result = await issueCertSignedUrl(adminClient, id, user.id);

    if (!result.ok) {
      const stage = result.error.stage;
      let status = 500;
      if (stage === 'not_found') status = 404;
      else if (stage === 'not_owner' || stage === 'cohort_not_completed') {
        status = 403;
      }
      return NextResponse.json(
        { error: result.error.message, stage },
        { status },
      );
    }

    return NextResponse.json({
      ok: true,
      url: result.url,
      expiresIn: result.expiresIn,
    });
  } catch (error) {
    const message =
      error && typeof error === 'object' && 'message' in error
        ? String((error as { message?: unknown }).message)
        : 'Failed to issue signed URL';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
