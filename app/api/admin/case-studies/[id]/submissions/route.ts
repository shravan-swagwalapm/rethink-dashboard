import { createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/api/verify-admin';

/**
 * GET /api/admin/case-studies/[id]/submissions
 *
 * Returns all subgroups' submissions for a case study with full status matrix.
 * Includes attachment counts, review scores, mentor info.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { id: caseStudyId } = await params;
    const adminClient = await createAdminClient();

    // Fetch case study
    const { data: caseStudy, error: csError } = await adminClient
      .from('case_studies')
      .select('id, cohort_id, max_score, due_date, grace_period_minutes')
      .eq('id', caseStudyId)
      .single();

    if (csError || !caseStudy) {
      return NextResponse.json({ error: 'Case study not found' }, { status: 404 });
    }

    // Fetch all subgroups for this cohort
    const { data: subgroups } = await adminClient
      .from('subgroups')
      .select('id, name')
      .eq('cohort_id', caseStudy.cohort_id)
      .order('name');

    if (!subgroups?.length) {
      return NextResponse.json({ submissions: [], subgroups: [] });
    }

    // Fetch submissions for this case study
    const { data: submissions } = await adminClient
      .from('case_study_submissions')
      .select('*, submitted_by_profile:profiles!case_study_submissions_submitted_by_fkey(full_name)')
      .eq('case_study_id', caseStudyId);

    const subMap: Record<string, Record<string, unknown>> = {};
    for (const s of submissions || []) {
      const { submitted_by_profile, ...rest } = s as Record<string, unknown> & {
        submitted_by_profile?: { full_name: string } | null;
      };
      subMap[rest.subgroup_id as string] = {
        ...rest,
        submitted_by_name: submitted_by_profile?.full_name ?? null,
      };
    }

    // Fetch reviews for all submissions
    const subIds = (submissions || []).map(s => s.id);
    let reviewMap: Record<string, Array<Record<string, unknown>>> = {};

    if (subIds.length) {
      const { data: reviews } = await adminClient
        .from('case_study_reviews')
        .select('*, reviewer:profiles!case_study_reviews_reviewer_id_fkey(full_name)')
        .in('submission_id', subIds);

      for (const r of reviews || []) {
        const { reviewer, ...rest } = r as Record<string, unknown> & {
          reviewer?: { full_name: string } | null;
        };
        const sid = rest.submission_id as string;
        if (!reviewMap[sid]) reviewMap[sid] = [];
        reviewMap[sid].push({ ...rest, reviewer_name: reviewer?.full_name ?? null });
      }
    }

    // Fetch attachment counts
    let attachmentCountMap: Record<string, number> = {};
    if (subIds.length) {
      const { data: attCounts } = await adminClient
        .from('case_study_submission_attachments')
        .select('submission_id')
        .in('submission_id', subIds);

      for (const a of attCounts || []) {
        attachmentCountMap[a.submission_id] = (attachmentCountMap[a.submission_id] || 0) + 1;
      }
    }

    // Fetch mentors for each subgroup
    const subgroupIds = subgroups.map(s => s.id);
    const { data: mentors } = await adminClient
      .from('subgroup_mentors')
      .select('subgroup_id, user:profiles(id, full_name)')
      .in('subgroup_id', subgroupIds);

    const mentorMap: Record<string, { id: string; name: string }[]> = {};
    for (const m of mentors || []) {
      // Supabase join can return object or array depending on relationship type
      const mentorData = m.user as unknown as { id: string; full_name: string } | null;
      if (mentorData) {
        if (!mentorMap[m.subgroup_id]) mentorMap[m.subgroup_id] = [];
        mentorMap[m.subgroup_id].push({ id: mentorData.id, name: mentorData.full_name });
      }
    }

    // Build status matrix
    const matrix = subgroups.map(sg => {
      const submission = subMap[sg.id] ?? null;
      const submissionId = submission?.id as string | undefined;

      return {
        subgroup: { id: sg.id, name: sg.name },
        mentors: mentorMap[sg.id] ?? [],
        submission: submission ? {
          ...submission,
          reviews: submissionId ? (reviewMap[submissionId] ?? []) : [],
          attachment_count: submissionId ? (attachmentCountMap[submissionId] ?? 0) : 0,
        } : null,
      };
    });

    return NextResponse.json({
      submissions: matrix,
      case_study: caseStudy,
    });
  } catch (error) {
    console.error('Error fetching submissions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
