import { createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/api/verify-admin';

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

// DELETE - Admin deletes a ticket
export async function DELETE(request: NextRequest) {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Ticket ID is required' }, { status: 400 });
    }

    const adminClient = await createAdminClient();

    // First delete all responses for this ticket
    await adminClient
      .from('ticket_responses')
      .delete()
      .eq('ticket_id', id);

    // Then delete the ticket
    const { error } = await adminClient
      .from('support_tickets')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting ticket:', error);
    return NextResponse.json({ error: 'Failed to delete ticket' }, { status: 500 });
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
