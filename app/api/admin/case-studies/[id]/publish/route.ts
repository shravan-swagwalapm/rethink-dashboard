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
 * POST /api/admin/case-studies/[id]/publish
 *
 * Publish a submission to a target audience.
 * Body: { target: 'mentor'|'subgroup'|'cohort', subgroup_id?: UUID }
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
    const { target, subgroup_id } = body;

    if (!target || !TARGET_MAP[target]) {
      return NextResponse.json({ error: 'target must be "mentor", "subgroup", or "cohort"' }, { status: 400 });
    }

    if (!subgroup_id) {
      return NextResponse.json({ error: 'subgroup_id is required' }, { status: 400 });
    }

    const adminClient = await createAdminClient();
    const targetVisibility = TARGET_MAP[target];

    // Fetch current submission
    const { data: submission, error: subError } = await adminClient
      .from('case_study_submissions')
      .select('id, visibility')
      .eq('case_study_id', caseStudyId)
      .eq('subgroup_id', subgroup_id)
      .single();

    if (subError || !submission) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    }

    if (!isValidTransition(submission.visibility as SubmissionVisibility, targetVisibility)) {
      return NextResponse.json(
        { error: `Cannot transition from "${submission.visibility}" to "${targetVisibility}"` },
        { status: 400 }
      );
    }

    const { error: updateError } = await adminClient
      .from('case_study_submissions')
      .update({ visibility: targetVisibility, updated_at: new Date().toISOString() })
      .eq('id', submission.id);

    if (updateError) throw updateError;

    return NextResponse.json({ success: true, visibility: targetVisibility });
  } catch (error) {
    console.error('Error publishing submission:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
