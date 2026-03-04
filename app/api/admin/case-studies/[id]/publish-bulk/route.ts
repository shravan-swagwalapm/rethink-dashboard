import { createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/api/verify-admin';
import { isValidTransition } from '@/lib/services/case-study-deadline';
import type { SubmissionVisibility } from '@/types';

const TARGET_MAP: Record<string, SubmissionVisibility> = {
  mentor: 'mentor_visible',
  subgroup: 'subgroup_published',
  cohort: 'cohort_published',
};

/**
 * POST /api/admin/case-studies/[id]/publish-bulk
 *
 * Publish ALL eligible submissions to a target at once.
 * Body: { target: 'mentor'|'subgroup'|'cohort' }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { id: caseStudyId } = await params;
    const body = await request.json();
    const { target } = body;

    if (!target || !TARGET_MAP[target]) {
      return NextResponse.json({ error: 'target must be "mentor", "subgroup", or "cohort"' }, { status: 400 });
    }

    const adminClient = await createAdminClient();
    const targetVisibility = TARGET_MAP[target];

    // Fetch all submissions for this case study
    const { data: submissions, error: subError } = await adminClient
      .from('case_study_submissions')
      .select('id, visibility')
      .eq('case_study_id', caseStudyId);

    if (subError) throw subError;

    // Filter to only those that can validly transition
    const eligible = (submissions || []).filter(s =>
      isValidTransition(s.visibility as SubmissionVisibility, targetVisibility)
    );

    if (!eligible.length) {
      return NextResponse.json({
        success: true,
        updated: 0,
        message: 'No submissions eligible for this transition',
      });
    }

    const eligibleIds = eligible.map(s => s.id);

    const { error: updateError } = await adminClient
      .from('case_study_submissions')
      .update({ visibility: targetVisibility, updated_at: new Date().toISOString() })
      .in('id', eligibleIds);

    if (updateError) throw updateError;

    return NextResponse.json({
      success: true,
      updated: eligibleIds.length,
      total: (submissions || []).length,
    });
  } catch (error) {
    console.error('Error bulk publishing:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
