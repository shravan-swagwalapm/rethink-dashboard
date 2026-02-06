import { createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/api/verify-admin';

// GET - Fetch all responses for a ticket (admin view)
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { id } = await params;
    const adminClient = await createAdminClient();

    // Fetch all responses for this ticket
    const { data: responses, error: responsesError } = await adminClient
      .from('ticket_responses')
      .select('*')
      .eq('ticket_id', id)
      .order('created_at', { ascending: true });

    if (responsesError) throw responsesError;

    return NextResponse.json(responses || []);
  } catch (error) {
    console.error('Error fetching ticket responses:', error);
    return NextResponse.json({ error: 'Failed to fetch responses' }, { status: 500 });
  }
}
