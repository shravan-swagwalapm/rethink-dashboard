import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { id: sessionId } = await params;

  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { response, reminder_enabled } = body;

    if (!response || !['yes', 'no'].includes(response)) {
      return NextResponse.json(
        { error: 'Invalid response. Must be "yes" or "no"' },
        { status: 400 }
      );
    }

    // Check if session exists
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Upsert RSVP
    const { data: rsvp, error: rsvpError } = await supabase
      .from('rsvps')
      .upsert(
        {
          session_id: sessionId,
          user_id: user.id,
          response,
          reminder_enabled: reminder_enabled ?? true,
        },
        {
          onConflict: 'session_id,user_id',
        }
      )
      .select()
      .single();

    if (rsvpError) throw rsvpError;

    return NextResponse.json({
      message: 'RSVP updated successfully',
      rsvp,
    });
  } catch (error: unknown) {
    console.error('Error updating RSVP:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { id: sessionId } = await params;

  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Get user's RSVP for this session
    const { data: rsvp, error: rsvpError } = await supabase
      .from('rsvps')
      .select('*')
      .eq('session_id', sessionId)
      .eq('user_id', user.id)
      .single();

    if (rsvpError && rsvpError.code !== 'PGRST116') {
      throw rsvpError;
    }

    return NextResponse.json({ rsvp: rsvp || null });
  } catch (error: unknown) {
    console.error('Error fetching RSVP:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
