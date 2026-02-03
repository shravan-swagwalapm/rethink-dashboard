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

// GET - Fetch support tickets
export async function GET() {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const adminClient = await createAdminClient();

    const { data: tickets, error } = await adminClient
      .from('support_tickets')
      .select('*, user:profiles(*)')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json(tickets || []);
  } catch (error) {
    console.error('Error fetching support tickets:', error);
    return NextResponse.json({ error: 'Failed to fetch tickets' }, { status: 500 });
  }
}

// PUT - Update ticket status
export async function PUT(request: NextRequest) {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const { id, status } = body;

    if (!id) {
      return NextResponse.json({ error: 'Ticket ID is required' }, { status: 400 });
    }

    // Validate status
    const validStatuses = ['open', 'in_progress', 'resolved'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const adminClient = await createAdminClient();

    const { data, error } = await adminClient
      .from('support_tickets')
      .update({ status })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error updating ticket:', error);
    return NextResponse.json({ error: 'Failed to update ticket' }, { status: 500 });
  }
}

// POST - Admin responds to a ticket
export async function POST(request: NextRequest) {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const { ticket_id, message } = body;

    if (!ticket_id) {
      return NextResponse.json({ error: 'Ticket ID is required' }, { status: 400 });
    }

    if (!message || message.trim().length === 0) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    if (message.length > 2000) {
      return NextResponse.json(
        { error: 'Message must be less than 2000 characters' },
        { status: 400 }
      );
    }

    const adminClient = await createAdminClient();

    // Verify ticket exists
    const { data: ticket, error: ticketError } = await adminClient
      .from('support_tickets')
      .select('id, status')
      .eq('id', ticket_id)
      .single();

    if (ticketError || !ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    // Add the admin response
    const { data: response, error: responseError } = await adminClient
      .from('ticket_responses')
      .insert({
        ticket_id,
        user_id: auth.userId,
        message: message.trim(),
        is_admin: true,
      })
      .select(`
        *,
        user:profiles!ticket_responses_user_id_fkey(id, full_name, email)
      `)
      .single();

    if (responseError) throw responseError;

    // Update ticket status to 'in_progress' if it was 'open'
    if (ticket.status === 'open') {
      await adminClient
        .from('support_tickets')
        .update({ status: 'in_progress' })
        .eq('id', ticket_id);
    }

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error('Error adding admin response:', error);
    return NextResponse.json({ error: 'Failed to add response' }, { status: 500 });
  }
}
