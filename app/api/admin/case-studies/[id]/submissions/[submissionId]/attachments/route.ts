import { verifyAdmin } from '@/lib/api/verify-admin';
import { createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/admin/case-studies/[id]/submissions/[submissionId]/attachments
 *
 * Returns all attachments for a submission. Admin only.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; submissionId: string }> }
) {
  try {
    const auth = await verifyAdmin();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id: caseStudyId, submissionId } = await params;
    const adminClient = await createAdminClient();

    // Verify submission belongs to this case study
    const { data: submission } = await adminClient
      .from('case_study_submissions')
      .select('id')
      .eq('id', submissionId)
      .eq('case_study_id', caseStudyId)
      .single();

    if (!submission) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    }

    const { data: attachments } = await adminClient
      .from('case_study_submission_attachments')
      .select('id, type, file_name, file_path, file_size, file_type, link_url, link_label, created_at')
      .eq('submission_id', submissionId)
      .order('created_at', { ascending: true });

    return NextResponse.json({ attachments: attachments || [] });
  } catch (error) {
    console.error('Error fetching submission attachments:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
