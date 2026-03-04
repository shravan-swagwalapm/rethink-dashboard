import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/mentor/case-studies/reviews
 *
 * Submit a mentor review for a submission.
 * Body: { submission_id, score?, comment? }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { submission_id, score, comment } = body;

    if (!submission_id) {
      return NextResponse.json({ error: 'submission_id is required' }, { status: 400 });
    }

    const adminClient = await createAdminClient();

    // Fetch submission
    const { data: submission, error: subError } = await adminClient
      .from('case_study_submissions')
      .select('id, subgroup_id, visibility, case_study_id')
      .eq('id', submission_id)
      .single();

    if (subError || !submission) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    }

    // Verify mentor is assigned to this subgroup
    const { data: mentorCheck } = await adminClient
      .from('subgroup_mentors')
      .select('id')
      .eq('subgroup_id', submission.subgroup_id)
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle();

    if (!mentorCheck) {
      return NextResponse.json({ error: 'You are not assigned to this subgroup' }, { status: 403 });
    }

    // Check visibility (must be at least mentor_visible)
    const mentorVisible = ['mentor_visible', 'subgroup_published', 'cohort_published'];
    if (!mentorVisible.includes(submission.visibility)) {
      return NextResponse.json({ error: 'Submission not yet visible to mentors' }, { status: 403 });
    }

    // Cannot create or edit after subgroup_published
    if (['subgroup_published', 'cohort_published'].includes(submission.visibility)) {
      return NextResponse.json({ error: 'Cannot create or edit review after submission is published to students' }, { status: 403 });
    }

    // Validate score range
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

    // Upsert mentor review
    const { data: review, error: revError } = await adminClient
      .from('case_study_reviews')
      .upsert(
        {
          submission_id,
          reviewer_id: user.id,
          reviewer_role: 'mentor',
          score: score ?? null,
          comment: comment ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'submission_id,reviewer_id' }
      )
      .select()
      .single();

    if (revError) throw revError;

    return NextResponse.json({ review });
  } catch (error) {
    console.error('Error saving mentor review:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
