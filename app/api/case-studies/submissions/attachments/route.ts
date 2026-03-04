import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { canUpload } from '@/lib/services/case-study-deadline';

/**
 * POST /api/case-studies/submissions/attachments
 *
 * Add a file or link attachment to a submission.
 * Body for file: { submission_id, type: 'file', file_path, file_name, file_size, file_type }
 * Body for link: { submission_id, type: 'link', link_url, link_label }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { submission_id, type } = body;

    if (!submission_id || !type || !['file', 'link'].includes(type)) {
      return NextResponse.json({ error: 'submission_id and type (file|link) are required' }, { status: 400 });
    }

    const adminClient = await createAdminClient();

    // Fetch submission + case study for deadline check
    const { data: submission, error: subError } = await adminClient
      .from('case_study_submissions')
      .select('id, subgroup_id, visibility, deadline_override, case_study_id')
      .eq('id', submission_id)
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
      return NextResponse.json({ error: 'You are not a member of this subgroup' }, { status: 403 });
    }

    const { data: caseStudy } = await adminClient
      .from('case_studies')
      .select('due_date, grace_period_minutes, is_archived, submissions_closed')
      .eq('id', submission.case_study_id)
      .single();

    if (!caseStudy) {
      return NextResponse.json({ error: 'Case study not found' }, { status: 404 });
    }

    if (!canUpload(submission, caseStudy)) {
      return NextResponse.json({ error: 'Cannot modify submission after deadline' }, { status: 403 });
    }

    // Build attachment row
    const attachmentData: Record<string, unknown> = {
      submission_id,
      type,
      uploaded_by: user.id,
    };

    if (type === 'file') {
      const { file_path, file_name, file_size, file_type } = body;
      if (!file_path || !file_name) {
        return NextResponse.json({ error: 'file_path and file_name are required for file attachments' }, { status: 400 });
      }
      attachmentData.file_path = file_path;
      attachmentData.file_name = file_name;
      attachmentData.file_size = file_size ?? null;
      attachmentData.file_type = file_type ?? null;
    } else {
      const { link_url, link_label } = body;
      if (!link_url) {
        return NextResponse.json({ error: 'link_url is required for link attachments' }, { status: 400 });
      }
      // URL validation with protocol whitelist (prevent javascript:/data: XSS)
      try {
        const parsed = new URL(link_url);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
          return NextResponse.json({ error: 'Only http/https URLs are allowed' }, { status: 400 });
        }
      } catch {
        return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
      }
      attachmentData.link_url = link_url;
      attachmentData.link_label = link_label || null;
    }

    const { data: attachment, error: insertError } = await adminClient
      .from('case_study_submission_attachments')
      .insert(attachmentData)
      .select()
      .single();

    if (insertError) throw insertError;

    // Update submission timestamp
    await adminClient
      .from('case_study_submissions')
      .update({
        submitted_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', submission_id);

    return NextResponse.json({ attachment }, { status: 201 });
  } catch (error) {
    console.error('Error adding attachment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
