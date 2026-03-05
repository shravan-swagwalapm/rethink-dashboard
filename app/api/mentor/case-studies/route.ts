import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/mentor/case-studies?cohort_id=X
 *
 * All case studies for a cohort + assigned subgroups' submission status.
 * Mentor can only see submissions that are >= mentor_visible.
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

    // Verify user is a mentor for this specific cohort
    const { data: mentorRole } = await adminClient
      .from('user_role_assignments')
      .select('id')
      .eq('user_id', user.id)
      .eq('role', 'mentor')
      .eq('cohort_id', cohortId)
      .limit(1)
      .maybeSingle();

    if (!mentorRole) {
      // Fallback: check legacy role (not cohort-scoped, but combined with subgroup_mentors filter below)
      const { data: profile } = await adminClient
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (profile?.role !== 'mentor') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    // Find subgroups this mentor is assigned to in this cohort
    const { data: mentorSubgroups } = await adminClient
      .from('subgroup_mentors')
      .select('subgroup_id, subgroup:subgroups!inner(id, name, cohort_id)')
      .eq('user_id', user.id)
      .eq('subgroup.cohort_id', cohortId);

    const subgroupIds = (mentorSubgroups || []).map(ms => ms.subgroup_id);
    const subgroupMap: Record<string, string> = {};
    for (const ms of mentorSubgroups || []) {
      const sg = ms.subgroup as unknown as { id: string; name: string } | null;
      if (sg) subgroupMap[sg.id] = sg.name;
    }

    // Fetch case studies
    const { data: caseStudies, error: csError } = await adminClient
      .from('case_studies')
      .select('*')
      .eq('cohort_id', cohortId)
      .eq('is_archived', false)
      .order('week_number', { ascending: true })
      .order('order_index', { ascending: true });

    if (csError) throw csError;

    if (!caseStudies?.length || !subgroupIds.length) {
      return NextResponse.json({
        caseStudies: caseStudies || [],
        subgroups: Object.entries(subgroupMap).map(([id, name]) => ({ id, name })),
      });
    }

    // Fetch submissions for mentor's subgroups
    const csIds = caseStudies.map(cs => cs.id);
    const { data: submissions } = await adminClient
      .from('case_study_submissions')
      .select('*, submitted_by_profile:profiles!case_study_submissions_submitted_by_fkey(full_name)')
      .in('subgroup_id', subgroupIds)
      .in('case_study_id', csIds);

    // Build lookup: cs_id -> subgroup_id -> submission
    const subByCsAndSg: Record<string, Record<string, Record<string, unknown>>> = {};
    for (const s of submissions || []) {
      const { submitted_by_profile, ...rest } = s as Record<string, unknown> & {
        submitted_by_profile?: { full_name: string } | null;
      };
      const csId = rest.case_study_id as string;
      const sgId = rest.subgroup_id as string;
      if (!subByCsAndSg[csId]) subByCsAndSg[csId] = {};

      // Only show if mentor_visible or later
      const mentorVisible = ['mentor_visible', 'subgroup_published', 'cohort_published'];
      const vis = rest.visibility as string;

      subByCsAndSg[csId][sgId] = {
        id: rest.id,
        visibility: vis,
        submitted_at: rest.submitted_at,
        is_late: rest.is_late,
        submitted_by_name: submitted_by_profile?.full_name ?? null,
        // Mentor can only see details if visibility >= mentor_visible
        can_review: mentorVisible.includes(vis),
      };
    }

    // Fetch mentor's own reviews
    const mentorSubmissionIds = (submissions || []).map(s => s.id);
    const myReviewMap: Record<string, Record<string, unknown>> = {};

    if (mentorSubmissionIds.length) {
      const { data: myReviews } = await adminClient
        .from('case_study_reviews')
        .select('*')
        .eq('reviewer_id', user.id)
        .eq('reviewer_role', 'mentor')
        .in('submission_id', mentorSubmissionIds);

      for (const r of myReviews || []) {
        myReviewMap[r.submission_id] = r;
      }
    }

    // Enrich case studies
    const enriched = caseStudies.map(cs => ({
      ...cs,
      subgroup_submissions: subgroupIds.map(sgId => ({
        subgroup_id: sgId,
        subgroup_name: subgroupMap[sgId] ?? 'Unknown',
        submission: subByCsAndSg[cs.id]?.[sgId] ?? null,
        my_review: subByCsAndSg[cs.id]?.[sgId]
          ? myReviewMap[(subByCsAndSg[cs.id][sgId] as { id: string }).id] ?? null
          : null,
      })),
    }));

    return NextResponse.json({
      caseStudies: enriched,
      subgroups: Object.entries(subgroupMap).map(([id, name]) => ({ id, name })),
    });
  } catch (error) {
    console.error('Error fetching mentor case studies:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
