import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/mentor/case-studies/submissions/[id]
 *
 * Submission details for a mentor. Only accessible if visibility >= mentor_visible.
 * Returns submission + attachments + admin review (read-only).
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
      .select('*')
      .eq('id', submissionId)
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
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Check visibility
    const mentorVisible = ['mentor_visible', 'subgroup_published', 'cohort_published'];
    if (!mentorVisible.includes(submission.visibility)) {
      return NextResponse.json({ error: 'Submission not yet visible to mentors' }, { status: 403 });
    }

    // Fetch attachments
    const { data: attachments } = await adminClient
      .from('case_study_submission_attachments')
      .select('*, uploader:profiles!case_study_submission_attachments_uploaded_by_fkey(full_name)')
      .eq('submission_id', submissionId)
      .order('created_at', { ascending: true });

    const mappedAttachments = (attachments || []).map(a => {
      const { uploader, ...rest } = a as Record<string, unknown> & {
        uploader?: { full_name: string } | null;
      };
      return { ...rest, uploaded_by_name: uploader?.full_name ?? null };
    });

    // Fetch reviews (admin + own mentor review)
    const { data: reviews } = await adminClient
      .from('case_study_reviews')
      .select('*, reviewer:profiles!case_study_reviews_reviewer_id_fkey(full_name)')
      .eq('submission_id', submissionId)
      .order('created_at', { ascending: true });

    const mappedReviews = (reviews || []).map(r => {
      const { reviewer, ...rest } = r as Record<string, unknown> & {
        reviewer?: { full_name: string } | null;
      };
      return { ...rest, reviewer_name: reviewer?.full_name ?? null };
    });

    return NextResponse.json({
      submission: {
        ...submission,
        attachments: mappedAttachments,
        reviews: mappedReviews,
      },
    });
  } catch (error) {
    console.error('Error fetching submission details:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
