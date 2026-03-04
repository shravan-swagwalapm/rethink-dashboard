import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/case-studies/[id]/leaderboard
 *
 * Returns ranked subgroups by admin score for a case study.
 * Only accessible when leaderboard_published = true.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: caseStudyId } = await params;
    const adminClient = await createAdminClient();

    // Check case study exists and leaderboard is published
    const { data: caseStudy, error: csError } = await adminClient
      .from('case_studies')
      .select('id, cohort_id, max_score, leaderboard_published')
      .eq('id', caseStudyId)
      .single();

    if (csError || !caseStudy) {
      return NextResponse.json({ error: 'Case study not found' }, { status: 404 });
    }

    if (!caseStudy.leaderboard_published) {
      return NextResponse.json({ error: 'Leaderboard not yet available' }, { status: 403 });
    }

    // Verify user belongs to this cohort
    const { data: roleAssignment } = await adminClient
      .from('user_role_assignments')
      .select('id')
      .eq('user_id', user.id)
      .eq('cohort_id', caseStudy.cohort_id)
      .limit(1)
      .maybeSingle();

    if (!roleAssignment) {
      const { data: profile } = await adminClient
        .from('profiles')
        .select('cohort_id')
        .eq('id', user.id)
        .single();

      if (!profile?.cohort_id || profile.cohort_id !== caseStudy.cohort_id) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    // Fetch all cohort_published submissions with admin reviews
    const { data: submissions } = await adminClient
      .from('case_study_submissions')
      .select('id, subgroup_id, is_late, subgroup:subgroups(name)')
      .eq('case_study_id', caseStudyId)
      .eq('visibility', 'cohort_published');

    if (!submissions?.length) {
      return NextResponse.json({ leaderboard: [], max_score: caseStudy.max_score });
    }

    const subIds = submissions.map(s => s.id);

    // Get admin reviews
    const { data: reviews } = await adminClient
      .from('case_study_reviews')
      .select('submission_id, score')
      .in('submission_id', subIds)
      .eq('reviewer_role', 'admin');

    const scoreMap: Record<string, number | null> = {};
    for (const r of reviews || []) {
      scoreMap[r.submission_id] = r.score;
    }

    // Build and sort leaderboard
    const leaderboard = submissions
      .map(s => {
        const raw = s as unknown as Record<string, unknown>;
        const subgroupData = raw.subgroup as unknown as { name: string } | null;
        return {
          subgroup_id: raw.subgroup_id as string,
          subgroup_name: subgroupData?.name ?? 'Unknown',
          score: scoreMap[raw.id as string] ?? null,
          is_late: raw.is_late as boolean,
        };
      })
      .sort((a, b) => {
        // Null scores go to the bottom
        if (a.score === null && b.score === null) return 0;
        if (a.score === null) return 1;
        if (b.score === null) return -1;
        return b.score - a.score;
      });

    // Standard competition ranking (tied scores get the same rank, next rank skips)
    let currentRank = 1;
    const rankedLeaderboard = leaderboard.map((entry, idx) => {
      if (idx > 0 && entry.score !== leaderboard[idx - 1].score) {
        currentRank = idx + 1;
      }
      return { ...entry, rank: currentRank };
    });

    return NextResponse.json({ leaderboard: rankedLeaderboard, max_score: caseStudy.max_score });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
