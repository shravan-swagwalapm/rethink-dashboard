import { createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/api/verify-admin';

/**
 * PUT /api/admin/case-studies/reviews/[id]/override
 *
 * Override (hide) a mentor's review. Original is preserved for audit but
 * students will only see the admin's review.
 * Body: { overridden: boolean }
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
    const { id: reviewId } = await params;
    const body = await request.json();
    const { overridden } = body;

    if (typeof overridden !== 'boolean') {
      return NextResponse.json({ error: 'overridden must be a boolean' }, { status: 400 });
    }

    const adminClient = await createAdminClient();

    // Only allow overriding mentor reviews
    const { data: review, error } = await adminClient
      .from('case_study_reviews')
      .update({ overridden, updated_at: new Date().toISOString() })
      .eq('id', reviewId)
      .eq('reviewer_role', 'mentor')
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ review });
  } catch (error) {
    console.error('Error overriding review:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
