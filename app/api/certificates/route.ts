import { createClient } from '@/lib/supabase/server';
import { listCertificatesForUser } from '@/lib/services/certificates';
import { NextResponse } from 'next/server';

/**
 * GET /api/certificates
 *
 * Recipient-side list of the requesting user's certificates. Returns only the
 * subset whose joined cohort is in the `completed` state — enforced at the DB
 * layer by the Phase 1 RLS policy on `cohort_certificates`:
 *
 *   auth.uid() = user_id
 *   AND EXISTS (SELECT 1 FROM cohorts c
 *               WHERE c.id = cohort_certificates.cohort_id
 *                 AND c.status = 'completed')
 *
 * Query construction (the SELECT, the joined-shape narrowing, the
 * `end_date DESC NULLS LAST` sort) lives in `listCertificatesForUser` —
 * thin route, fat service. The route is responsible for the auth gate
 * and the error envelope only.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const certificates = await listCertificatesForUser(supabase);
    return NextResponse.json({ certificates });
  } catch {
    return NextResponse.json(
      { error: 'Failed to load certificates' },
      { status: 500 },
    );
  }
}
