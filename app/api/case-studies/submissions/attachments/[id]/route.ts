import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { canUpload } from '@/lib/services/case-study-deadline';

/**
 * DELETE /api/case-studies/submissions/attachments/[id]
 *
 * Remove an attachment from a submission (before deadline).
 * Also cleans up the file from Supabase Storage.
 * If this was the last attachment, auto-reverts submission to draft.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: attachmentId } = await params;
    const adminClient = await createAdminClient();

    // Fetch attachment + submission + case study
    const { data: attachment, error: attError } = await adminClient
      .from('case_study_submission_attachments')
      .select('id, submission_id, type, file_path')
      .eq('id', attachmentId)
      .single();

    if (attError || !attachment) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });
    }

    const { data: submission } = await adminClient
      .from('case_study_submissions')
      .select('id, subgroup_id, visibility, deadline_override, case_study_id')
      .eq('id', attachment.submission_id)
      .single();

    if (!submission) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    }

    // Verify user is in subgroup
    const { data: memberCheck } = await adminClient
      .from('subgroup_members')
      .select('id')
      .eq('subgroup_id', submission.subgroup_id)
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle();

    if (!memberCheck) {
      return NextResponse.json({ error: 'You are not a member of this subgroup' }, { status: 403 });
    }

    const { data: caseStudy } = await adminClient
      .from('case_studies')
      .select('due_date, grace_period_minutes, is_archived, submissions_closed')
      .eq('id', submission.case_study_id)
      .single();

    if (!caseStudy || !canUpload(submission, caseStudy)) {
      return NextResponse.json({ error: 'Cannot modify submission after deadline' }, { status: 403 });
    }

    // Delete from storage if it's a file
    if (attachment.type === 'file' && attachment.file_path) {
      await adminClient.storage
        .from('resources')
        .remove([attachment.file_path]);
    }

    // Delete attachment record
    const { error: deleteError } = await adminClient
      .from('case_study_submission_attachments')
      .delete()
      .eq('id', attachmentId);

    if (deleteError) throw deleteError;

    // Check remaining attachments — if 0, revert to draft
    const { count } = await adminClient
      .from('case_study_submission_attachments')
      .select('id', { count: 'exact', head: true })
      .eq('submission_id', submission.id);

    if (count === 0) {
      await adminClient
        .from('case_study_submissions')
        .update({
          visibility: 'draft',
          submitted_at: null,
          submitted_by: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', submission.id);
    }

    return NextResponse.json({ success: true, reverted_to_draft: count === 0 });
  } catch (error) {
    console.error('Error deleting attachment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
