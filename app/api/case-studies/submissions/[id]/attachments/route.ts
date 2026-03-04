import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/case-studies/submissions/[id]/attachments
 *
 * Returns all attachments for a submission. Only accessible to subgroup members.
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

    // Fetch submission to get subgroup_id
    const { data: submission, error: subError } = await adminClient
      .from('case_study_submissions')
      .select('id, subgroup_id')
      .eq('id', submissionId)
      .single();

    if (subError || !submission) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    }

    // Verify user is a member of this subgroup
    const { data: membership } = await adminClient
      .from('subgroup_members')
      .select('id')
      .eq('user_id', user.id)
      .eq('subgroup_id', submission.subgroup_id)
      .limit(1)
      .maybeSingle();

    if (!membership) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Fetch attachments
    const { data: attachments, error: attError } = await adminClient
      .from('case_study_submission_attachments')
      .select('*')
      .eq('submission_id', submissionId)
      .order('created_at', { ascending: true });

    if (attError) throw attError;

    return NextResponse.json({ attachments: attachments || [] });
  } catch (error) {
    console.error('Error fetching attachments:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
