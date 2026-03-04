import { createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/api/verify-admin';

/**
 * PUT /api/admin/case-studies/[id]/archive
 *
 * Archive (soft delete) a case study. Hides from students, preserves all data.
 * Body: { archived: boolean }
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
    const { archived } = body;

    if (typeof archived !== 'boolean') {
      return NextResponse.json({ error: 'archived must be a boolean' }, { status: 400 });
    }

    const adminClient = await createAdminClient();

    const { error } = await adminClient
      .from('case_studies')
      .update({ is_archived: archived })
      .eq('id', caseStudyId);

    if (error) throw error;

    return NextResponse.json({ success: true, is_archived: archived });
  } catch (error) {
    console.error('Error archiving case study:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
