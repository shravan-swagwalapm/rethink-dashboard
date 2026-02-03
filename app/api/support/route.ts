import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET - Fetch current user's support tickets
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminClient = await createAdminClient();

    // Fetch user's tickets with response counts
    const { data: tickets, error } = await adminClient
      .from('support_tickets')
      .select(`
        *,
        ticket_responses (
          id
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Transform to include response count
    const ticketsWithCounts = (tickets || []).map(ticket => ({
      ...ticket,
      response_count: ticket.ticket_responses?.length || 0,
      ticket_responses: undefined, // Remove raw responses array
    }));

    return NextResponse.json(ticketsWithCounts);
  } catch (error) {
    console.error('Error fetching support tickets:', error);
    return NextResponse.json({ error: 'Failed to fetch tickets' }, { status: 500 });
  }
}

// POST - Create a new support ticket
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { category, summary, description } = body;

    // Validation
    if (!summary || summary.length < 10 || summary.length > 200) {
      return NextResponse.json(
        { error: 'Summary must be between 10 and 200 characters' },
        { status: 400 }
      );
    }

    if (description && description.length > 2000) {
      return NextResponse.json(
        { error: 'Description must be less than 2000 characters' },
        { status: 400 }
      );
    }

    const validCategories = ['technical', 'payment', 'content', 'schedule', 'other'];
    if (!validCategories.includes(category)) {
      return NextResponse.json(
        { error: 'Invalid category' },
        { status: 400 }
      );
    }

    const adminClient = await createAdminClient();

    // Create the ticket
    const { data: ticket, error } = await adminClient
      .from('support_tickets')
      .insert({
        user_id: user.id,
        category,
        summary,
        description: description || null,
        status: 'open',
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(ticket, { status: 201 });
  } catch (error) {
    console.error('Error creating support ticket:', error);
    return NextResponse.json({ error: 'Failed to create ticket' }, { status: 500 });
  }
}
