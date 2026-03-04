import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * PUT /api/mentor/case-studies/reviews/[id]
 *
 * Edit own mentor review (until subgroup_published).
 * Body: { score?, comment? }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: reviewId } = await params;
    const body = await request.json();
    const { score, comment } = body;

    const adminClient = await createAdminClient();

    // Fetch review and verify ownership
    const { data: review, error: revError } = await adminClient
      .from('case_study_reviews')
      .select('id, submission_id, reviewer_id, reviewer_role')
      .eq('id', reviewId)
      .single();

    if (revError || !review) {
      return NextResponse.json({ error: 'Review not found' }, { status: 404 });
    }

    if (review.reviewer_id !== user.id || review.reviewer_role !== 'mentor') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Check submission visibility (cannot edit after subgroup_published)
    const { data: submission } = await adminClient
      .from('case_study_submissions')
      .select('visibility, case_study_id')
      .eq('id', review.submission_id)
      .single();

    if (submission && ['subgroup_published', 'cohort_published'].includes(submission.visibility)) {
      return NextResponse.json({ error: 'Cannot edit review after publication' }, { status: 403 });
    }

    // Validate score range against case study max_score
    if (score !== undefined && score !== null && submission) {
      const { data: cs } = await adminClient
        .from('case_studies')
        .select('max_score')
        .eq('id', submission.case_study_id)
        .single();
      const maxScore = cs?.max_score ?? 100;
      if (typeof score !== 'number' || score < 0 || score > maxScore) {
        return NextResponse.json({ error: `Score must be between 0 and ${maxScore}` }, { status: 400 });
      }
    }

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (score !== undefined) updateData.score = score;
    if (comment !== undefined) updateData.comment = comment;

    const { data: updated, error: updateError } = await adminClient
      .from('case_study_reviews')
      .update(updateData)
      .eq('id', reviewId)
      .select()
      .single();

    if (updateError) throw updateError;

    return NextResponse.json({ review: updated });
  } catch (error) {
    console.error('Error updating mentor review:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
