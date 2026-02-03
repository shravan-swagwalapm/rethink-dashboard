import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET - Fetch single ticket with all responses (conversation thread)
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const adminClient = await createAdminClient();

    // Fetch the ticket
    const { data: ticket, error: ticketError } = await adminClient
      .from('support_tickets')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id) // Ensure user owns this ticket
      .single();

    if (ticketError || !ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    // Fetch all responses for this ticket
    const { data: responses, error: responsesError } = await adminClient
      .from('ticket_responses')
      .select(`
        *,
        user:profiles!ticket_responses_user_id_fkey(id, name, email)
      `)
      .eq('ticket_id', id)
      .order('created_at', { ascending: true });

    if (responsesError) throw responsesError;

    return NextResponse.json({
      ...ticket,
      responses: responses || [],
    });
  } catch (error) {
    console.error('Error fetching ticket:', error);
    return NextResponse.json({ error: 'Failed to fetch ticket' }, { status: 500 });
  }
}

// POST - Add student reply to ticket
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { message } = body;

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

    // Verify user owns this ticket
    const { data: ticket, error: ticketError } = await adminClient
      .from('support_tickets')
      .select('id, status')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (ticketError || !ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    if (ticket.status === 'resolved') {
      return NextResponse.json(
        { error: 'Cannot reply to a resolved ticket' },
        { status: 400 }
      );
    }

    // Add the response
    const { data: response, error: responseError } = await adminClient
      .from('ticket_responses')
      .insert({
        ticket_id: id,
        user_id: user.id,
        message: message.trim(),
        is_admin: false,
      })
      .select(`
        *,
        user:profiles!ticket_responses_user_id_fkey(id, name, email)
      `)
      .single();

    if (responseError) throw responseError;

    // Update ticket status to 'open' if it was 'in_progress' (student replied)
    if (ticket.status === 'in_progress') {
      await adminClient
        .from('support_tickets')
        .update({ status: 'open' })
        .eq('id', id);
    }

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error('Error adding response:', error);
    return NextResponse.json({ error: 'Failed to add response' }, { status: 500 });
  }
}

// PATCH - Close ticket (student closes their own)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { status } = body;

    // Students can only close (resolve) their tickets
    if (status !== 'resolved') {
      return NextResponse.json(
        { error: 'Invalid status. Students can only resolve tickets.' },
        { status: 400 }
      );
    }

    const adminClient = await createAdminClient();

    // Verify user owns this ticket
    const { data: ticket, error: ticketError } = await adminClient
      .from('support_tickets')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (ticketError || !ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    // Update ticket status
    const { data: updatedTicket, error: updateError } = await adminClient
      .from('support_tickets')
      .update({ status: 'resolved' })
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    return NextResponse.json(updatedTicket);
  } catch (error) {
    console.error('Error closing ticket:', error);
    return NextResponse.json({ error: 'Failed to close ticket' }, { status: 500 });
  }
}
