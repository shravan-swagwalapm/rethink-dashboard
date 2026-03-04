import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/mentor/case-studies/submissions/[id]/signed-url?attachment_id=X
 *
 * Generates a signed URL for a submission attachment file.
 * Only accessible by mentors assigned to the submission's subgroup.
 * Submission visibility must be mentor_visible or higher.
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
    const { searchParams } = new URL(request.url);
    const attachmentId = searchParams.get('attachment_id');

    if (!attachmentId) {
      return NextResponse.json(
        { error: 'attachment_id query param is required' },
        { status: 400 }
      );
    }

    const adminClient = await createAdminClient();

    // Fetch submission
    const { data: submission, error: subError } = await adminClient
      .from('case_study_submissions')
      .select('id, subgroup_id, visibility')
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

    // Check visibility — must be mentor_visible or higher
    const mentorVisible = ['mentor_visible', 'subgroup_published', 'cohort_published'];
    if (!mentorVisible.includes(submission.visibility)) {
      return NextResponse.json(
        { error: 'Submission not yet visible to mentors' },
        { status: 403 }
      );
    }

    // Fetch attachment — validate it belongs to this submission (prevents IDOR)
    const { data: attachment, error: attError } = await adminClient
      .from('case_study_submission_attachments')
      .select('id, file_path, link_url, type')
      .eq('id', attachmentId)
      .eq('submission_id', submissionId)
      .single();

    if (attError || !attachment) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });
    }

    // If attachment is a link, return the URL directly
    if (attachment.type === 'link') {
      return NextResponse.json({ url: attachment.link_url });
    }

    if (!attachment.file_path) {
      return NextResponse.json({ error: 'No file path for this attachment' }, { status: 404 });
    }

    // Generate 1-hour signed URL
    const { data: signedUrl, error: signedError } = await adminClient.storage
      .from('resources')
      .createSignedUrl(attachment.file_path, 3600);

    if (signedError || !signedUrl) {
      return NextResponse.json({ error: 'Failed to generate signed URL' }, { status: 500 });
    }

    return NextResponse.json({ signedUrl: signedUrl.signedUrl });
  } catch (error) {
    console.error('Error generating mentor attachment signed URL:', error);
    return NextResponse.json(
      { error: 'Failed to generate signed URL' },
      { status: 500 }
    );
  }
}
