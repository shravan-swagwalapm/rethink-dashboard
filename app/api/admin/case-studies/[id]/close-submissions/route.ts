import { createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/api/verify-admin';

/**
 * PUT /api/admin/case-studies/[id]/close-submissions
 *
 * Manually close/reopen submissions for open-ended case studies.
 * Body: { closed: boolean }
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
    const { id: caseStudyId } = await params;
    const body = await request.json();
    const { closed } = body;

    if (typeof closed !== 'boolean') {
      return NextResponse.json({ error: 'closed must be a boolean' }, { status: 400 });
    }

    const adminClient = await createAdminClient();

    const { error } = await adminClient
      .from('case_studies')
      .update({ submissions_closed: closed })
      .eq('id', caseStudyId);

    if (error) throw error;

    return NextResponse.json({ success: true, submissions_closed: closed });
  } catch (error) {
    console.error('Error toggling submissions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
