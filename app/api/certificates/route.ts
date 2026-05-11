import { createClient } from '@/lib/supabase/server';
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
 * The SELECT below intentionally does NOT add `.eq('user_id', auth.uid())` or
 * filter on cohort.status — RLS does the row-level filtering. Belt-and-
 * suspenders: even a SELECT bug here cannot leak another user's cert because
 * the policy denies the row before it reaches the response.
 *
 * Response shape per row: { id, cohort_id, cohort_name, cohort_end_date,
 *                          file_type, file_size, uploaded_at }.
 * Sorted by cohort_end_date DESC NULLS LAST.
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

  // RLS does the filtering. No manual `.eq('user_id', ...)` — that's the point.
  const { data, error } = await supabase
    .from('cohort_certificates')
    .select(
      'id, cohort_id, file_type, file_size, uploaded_at, cohorts!inner(name, end_date)',
    );

  if (error) {
    return NextResponse.json(
      { error: 'Failed to load certificates' },
      { status: 500 },
    );
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

  const flattened = (data as Row[] | null ?? []).map((row) => {
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

  // Sort by end_date DESC NULLS LAST (Postgres-ish — nulls bubble to end).
  flattened.sort((a, b) => {
    if (a.cohort_end_date === b.cohort_end_date) return 0;
    if (a.cohort_end_date === null) return 1;
    if (b.cohort_end_date === null) return -1;
    return a.cohort_end_date < b.cohort_end_date ? 1 : -1;
  });

  return NextResponse.json({ certificates: flattened });
}
