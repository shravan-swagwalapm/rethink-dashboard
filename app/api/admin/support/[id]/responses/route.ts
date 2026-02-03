import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

async function verifyAdmin() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { authorized: false, error: 'Unauthorized', status: 401 };
  }

  // Check admin role from database - check both legacy profiles.role AND user_role_assignments
  const adminClient = await createAdminClient();

  // Check legacy role in profiles table
  const { data: profile } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const hasLegacyAdminRole = profile?.role === 'admin' || profile?.role === 'company_user';

  // Check multi-role assignments table
  const { data: roleAssignments } = await adminClient
    .from('user_role_assignments')
    .select('role')
    .eq('user_id', user.id);

  const hasAdminRoleAssignment = roleAssignments?.some(
    (ra) => ra.role === 'admin' || ra.role === 'company_user'
  );

  const isAdmin = hasLegacyAdminRole || hasAdminRoleAssignment;

  if (!isAdmin) {
    return { authorized: false, error: 'Forbidden', status: 403 };
  }

  return { authorized: true, userId: user.id };
}

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
