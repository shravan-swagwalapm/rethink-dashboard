import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { toStudentStatus } from '@/lib/services/case-study-deadline';
import type { SubmissionVisibility } from '@/types';

/**
 * GET /api/case-studies/my-submissions?cohort_id=X
 *
 * Returns all case studies for the cohort + the student's subgroup submission for each.
 * Visibility is mapped to student-friendly status (no internal states leaked).
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const cohortId = searchParams.get('cohort_id');

    if (!cohortId) {
      return NextResponse.json({ error: 'cohort_id is required' }, { status: 400 });
    }

    const adminClient = await createAdminClient();

    // Find user's subgroup in this cohort
    const { data: memberships } = await adminClient
      .from('subgroup_members')
      .select('subgroup_id, subgroup:subgroups!inner(id, name, cohort_id)')
      .eq('user_id', user.id)
      .eq('subgroup.cohort_id', cohortId)
      .limit(1);

    const membership = memberships?.[0];
    const subgroupId = membership?.subgroup_id ?? null;
    const subgroup = membership?.subgroup as unknown as { id: string; name: string; cohort_id: string } | null;

    // Fetch all non-archived case studies for cohort
    const { data: caseStudies, error: csError } = await adminClient
      .from('case_studies')
      .select('*')
      .eq('cohort_id', cohortId)
      .eq('is_archived', false)
      .order('week_number', { ascending: true })
      .order('order_index', { ascending: true });

    if (csError) throw csError;

    if (!caseStudies?.length) {
      return NextResponse.json({
        caseStudies: [],
        subgroup: subgroup ? { id: subgroup.id, name: subgroup.name } : null,
      });
    }

    // If user has a subgroup, fetch submissions + attachment counts
    let submissionsByCs: Record<string, Record<string, unknown>> = {};

    if (subgroupId) {
      const csIds = caseStudies.map(cs => cs.id);

      const { data: submissions } = await adminClient
        .from('case_study_submissions')
        .select('*, submitted_by_profile:profiles!case_study_submissions_submitted_by_fkey(full_name)')
        .eq('subgroup_id', subgroupId)
        .in('case_study_id', csIds);

      if (submissions?.length) {
        const subIds = submissions.map(s => s.id);

        // Count attachments per submission
        const { data: attachmentCounts } = await adminClient
          .from('case_study_submission_attachments')
          .select('submission_id, type')
          .in('submission_id', subIds);

        const countMap: Record<string, { files: number; links: number }> = {};
        for (const att of attachmentCounts || []) {
          if (!countMap[att.submission_id]) countMap[att.submission_id] = { files: 0, links: 0 };
          if (att.type === 'file') countMap[att.submission_id].files++;
          else countMap[att.submission_id].links++;
        }

        for (const sub of submissions) {
          const { submitted_by_profile, ...rest } = sub as Record<string, unknown> & {
            submitted_by_profile?: { full_name: string } | null;
          };
          submissionsByCs[rest.case_study_id as string] = {
            ...rest,
            submitted_by_name: submitted_by_profile?.full_name ?? null,
            student_status: toStudentStatus(rest.visibility as SubmissionVisibility | undefined),
            attachment_count: countMap[rest.id as string]?.files ?? 0,
            link_count: countMap[rest.id as string]?.links ?? 0,
          };
        }
      }
    }

    // Enrich case studies with submission info
    const enriched = caseStudies.map(cs => ({
      ...cs,
      submission: submissionsByCs[cs.id] ?? null,
    }));

    return NextResponse.json({
      caseStudies: enriched,
      subgroup: subgroup ? { id: subgroup.id, name: subgroup.name } : null,
    });
  } catch (error) {
    console.error('Error fetching my submissions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
