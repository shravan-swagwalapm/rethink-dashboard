import { createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/api/verify-admin';

// GET - Fetch RSVP details for a session
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { id } = await params;
    const adminClient = await createAdminClient();

    const { data: rsvps, error } = await adminClient
      .from('rsvps')
      .select('*, user:profiles(id, email, full_name, phone, avatar_url)')
      .eq('session_id', id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const yes = (rsvps || []).filter(r => r.response === 'yes');
    const no = (rsvps || []).filter(r => r.response === 'no');

    return NextResponse.json({ yes, no });
  } catch (error) {
    console.error('Error fetching RSVPs:', error);
    return NextResponse.json({ error: 'Failed to fetch RSVPs' }, { status: 500 });
  }
}
