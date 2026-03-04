import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { canUpload, isLate } from '@/lib/services/case-study-deadline';

/**
 * POST /api/case-studies/submissions
 *
 * Upsert a submission for the student's subgroup on a case study.
 * Creates the submission row if it doesn't exist, or updates it.
 * Body: { case_study_id }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { case_study_id } = body;

    if (!case_study_id) {
      return NextResponse.json({ error: 'case_study_id is required' }, { status: 400 });
    }

    const adminClient = await createAdminClient();

    // Fetch case study
    const { data: caseStudy, error: csError } = await adminClient
      .from('case_studies')
      .select('id, cohort_id, due_date, grace_period_minutes, is_archived, submissions_closed')
      .eq('id', case_study_id)
      .single();

    if (csError || !caseStudy) {
      return NextResponse.json({ error: 'Case study not found' }, { status: 404 });
    }

    // Find user's subgroup in this cohort
    const { data: memberships } = await adminClient
      .from('subgroup_members')
      .select('subgroup_id, subgroup:subgroups!inner(cohort_id)')
      .eq('user_id', user.id)
      .eq('subgroup.cohort_id', caseStudy.cohort_id)
      .limit(1);

    const subgroupId = memberships?.[0]?.subgroup_id;
    if (!subgroupId) {
      return NextResponse.json({ error: 'You are not in a subgroup for this cohort' }, { status: 403 });
    }

    // Fetch existing submission (for deadline check only)
    const { data: existing } = await adminClient
      .from('case_study_submissions')
      .select('id, visibility, deadline_override')
      .eq('case_study_id', case_study_id)
      .eq('subgroup_id', subgroupId)
      .maybeSingle();

    // Check deadline
    const submissionForDeadline = existing ?? { deadline_override: null, visibility: 'draft' as const };
    if (!canUpload(submissionForDeadline, caseStudy)) {
      return NextResponse.json({ error: 'Submissions are closed or the deadline has passed' }, { status: 403 });
    }

    const now = new Date();
    const late = isLate(submissionForDeadline, caseStudy, now);

    // Upsert submission (atomic — prevents race condition on concurrent requests)
    const { data: submission, error: upsertError } = await adminClient
      .from('case_study_submissions')
      .upsert(
        {
          case_study_id,
          subgroup_id: subgroupId,
          submitted_by: user.id,
          submitted_at: now.toISOString(),
          is_late: late,
          visibility: 'submitted',
        },
        { onConflict: 'case_study_id,subgroup_id' }
      )
      .select()
      .single();

    if (upsertError) throw upsertError;
    return NextResponse.json({ submission }, { status: 201 });
  } catch (error) {
    console.error('Error upserting submission:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
