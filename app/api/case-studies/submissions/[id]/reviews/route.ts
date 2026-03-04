import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/case-studies/submissions/[id]/reviews
 *
 * Get published reviews for a submission (student-facing).
 * Only returns reviews if submission is at least subgroup_published.
 * Overridden mentor reviews are excluded.
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

    const { id: submissionId } = await params;
    const adminClient = await createAdminClient();

    // Fetch submission
    const { data: submission, error: subError } = await adminClient
      .from('case_study_submissions')
      .select('id, subgroup_id, visibility, case_study_id')
      .eq('id', submissionId)
      .single();

    if (subError || !submission) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    }

    // Verify user is in this subgroup
    const { data: memberCheck } = await adminClient
      .from('subgroup_members')
      .select('id')
      .eq('subgroup_id', submission.subgroup_id)
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle();

    if (!memberCheck) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Only show reviews when at least subgroup_published
    const publishedStates = ['subgroup_published', 'cohort_published'];
    if (!publishedStates.includes(submission.visibility)) {
      return NextResponse.json({ reviews: [], message: 'Reviews not yet published' });
    }

    // Fetch reviews (exclude overridden mentor reviews)
    const { data: reviews, error: revError } = await adminClient
      .from('case_study_reviews')
      .select('id, reviewer_role, score, comment, created_at, updated_at, overridden, reviewer:profiles!case_study_reviews_reviewer_id_fkey(full_name)')
      .eq('submission_id', submissionId)
      .order('created_at', { ascending: true });

    if (revError) throw revError;

    // Filter out overridden mentor reviews for student view
    type MappedReview = Record<string, unknown> & { id: string; reviewer_name: string | null };
    const visibleReviews: MappedReview[] = (reviews || [])
      .filter(r => !(r.reviewer_role === 'mentor' && r.overridden))
      .map(r => {
        const raw = r as unknown as Record<string, unknown>;
        const reviewerData = raw.reviewer as unknown as { full_name: string } | null;
        return {
          id: raw.id as string,
          submission_id: raw.submission_id,
          reviewer_role: raw.reviewer_role,
          score: raw.score,
          comment: raw.comment,
          created_at: raw.created_at,
          updated_at: raw.updated_at,
          reviewer_name: reviewerData?.full_name ?? null,
        };
      });

    // Fetch rubric scores for visible reviews
    const reviewIds = visibleReviews.map(r => r.id);
    let rubricScoresByReview: Record<string, Array<Record<string, unknown>>> = {};

    if (reviewIds.length) {
      const { data: rubricScores } = await adminClient
        .from('case_study_rubric_scores')
        .select('*, criteria:case_study_rubric_criteria(label, max_score)')
        .in('review_id', reviewIds);

      for (const rs of rubricScores || []) {
        const raw = rs as unknown as Record<string, unknown>;
        const criteriaData = raw.criteria as unknown as { label: string; max_score: number } | null;
        const reviewId = raw.review_id as string;
        if (!rubricScoresByReview[reviewId]) rubricScoresByReview[reviewId] = [];
        rubricScoresByReview[reviewId].push({
          id: raw.id,
          review_id: raw.review_id,
          criteria_id: raw.criteria_id,
          score: raw.score,
          comment: raw.comment,
          criteria_label: criteriaData?.label ?? null,
          criteria_max_score: criteriaData?.max_score ?? null,
        });
      }
    }

    const enrichedReviews = visibleReviews.map(r => ({
      ...r,
      rubric_scores: rubricScoresByReview[r.id] ?? [],
    }));

    return NextResponse.json({ reviews: enrichedReviews });
  } catch (error) {
    console.error('Error fetching reviews:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
