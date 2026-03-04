import { createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/api/verify-admin';

/**
 * PUT /api/admin/case-studies/reviews/[id]
 *
 * Edit an admin review (even after publish — supports re-grading).
 * Body: { score?, comment?, rubric_scores?: { criteria_id, score, comment? }[] }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { id: reviewId } = await params;
    const body = await request.json();
    const { score, comment, rubric_scores } = body;

    const adminClient = await createAdminClient();

    // Update review
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (score !== undefined) updateData.score = score;
    if (comment !== undefined) updateData.comment = comment;

    const { data: review, error } = await adminClient
      .from('case_study_reviews')
      .update(updateData)
      .eq('id', reviewId)
      .eq('reviewer_role', 'admin')
      .select()
      .single();

    if (error) throw error;

    // Update rubric scores if provided
    if (rubric_scores?.length && review) {
      await adminClient
        .from('case_study_rubric_scores')
        .delete()
        .eq('review_id', review.id);

      const rubricRows = rubric_scores.map((rs: { criteria_id: string; score: number; comment?: string }) => ({
        review_id: review.id,
        criteria_id: rs.criteria_id,
        score: rs.score,
        comment: rs.comment ?? null,
      }));

      await adminClient
        .from('case_study_rubric_scores')
        .insert(rubricRows);
    }

    return NextResponse.json({ review });
  } catch (error) {
    console.error('Error updating admin review:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
