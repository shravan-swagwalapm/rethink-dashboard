import { createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/api/verify-admin';

/**
 * POST /api/admin/case-studies/reviews
 *
 * Submit an admin review for a submission.
 * Body: { submission_id, score?, comment?, rubric_scores?: { criteria_id, score, comment? }[] }
 */
export async function POST(request: NextRequest) {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const { submission_id, score, comment, rubric_scores } = body;

    if (!submission_id) {
      return NextResponse.json({ error: 'submission_id is required' }, { status: 400 });
    }

    const adminClient = await createAdminClient();

    // Verify submission exists
    const { data: submission, error: subError } = await adminClient
      .from('case_study_submissions')
      .select('id, visibility, case_study_id')
      .eq('id', submission_id)
      .single();

    if (subError || !submission) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    }

    if (submission.visibility === 'draft') {
      return NextResponse.json({ error: 'Cannot review a draft submission. Students must submit first.' }, { status: 400 });
    }

    // Validate score range against case study max_score
    if (score !== undefined && score !== null) {
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

    // Upsert review (unique on submission_id + reviewer_id)
    const { data: review, error: revError } = await adminClient
      .from('case_study_reviews')
      .upsert(
        {
          submission_id,
          reviewer_id: auth.userId,
          reviewer_role: 'admin',
          score: score ?? null,
          comment: comment ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'submission_id,reviewer_id' }
      )
      .select()
      .single();

    if (revError) throw revError;

    // Save rubric scores if provided
    if (rubric_scores?.length && review) {
      // Delete existing rubric scores for this review
      await adminClient
        .from('case_study_rubric_scores')
        .delete()
        .eq('review_id', review.id);

      // Insert new rubric scores
      const rubricRows = rubric_scores.map((rs: { criteria_id: string; score: number; comment?: string }) => ({
        review_id: review.id,
        criteria_id: rs.criteria_id,
        score: rs.score,
        comment: rs.comment ?? null,
      }));

      const { error: rubricError } = await adminClient
        .from('case_study_rubric_scores')
        .insert(rubricRows);

      if (rubricError) {
        console.error('Error saving rubric scores:', rubricError);
      }
    }

    // Advance submission visibility to admin_reviewed (if currently submitted)
    if (submission.visibility === 'submitted') {
      await adminClient
        .from('case_study_submissions')
        .update({ visibility: 'admin_reviewed', updated_at: new Date().toISOString() })
        .eq('id', submission_id);
    }

    return NextResponse.json({ review });
  } catch (error) {
    console.error('Error saving admin review:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
