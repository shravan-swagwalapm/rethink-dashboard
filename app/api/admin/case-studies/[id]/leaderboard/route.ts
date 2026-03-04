import { createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/api/verify-admin';

/**
 * PUT /api/admin/case-studies/[id]/leaderboard
 *
 * Toggle leaderboard visibility for a case study (all-or-nothing).
 * Body: { published: boolean }
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
    const { published } = body;

    if (typeof published !== 'boolean') {
      return NextResponse.json({ error: 'published must be a boolean' }, { status: 400 });
    }

    const adminClient = await createAdminClient();

    const { error } = await adminClient
      .from('case_studies')
      .update({ leaderboard_published: published })
      .eq('id', caseStudyId);

    if (error) throw error;

    return NextResponse.json({ success: true, leaderboard_published: published });
  } catch (error) {
    console.error('Error toggling leaderboard:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
