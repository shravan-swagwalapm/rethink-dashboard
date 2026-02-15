import { createClient, createAdminClient } from '@/lib/supabase/server';
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

    // Use admin client for data operations (bypasses RLS)
    const adminClient = await createAdminClient();

    // Check if session exists
    const { data: session, error: sessionError } = await adminClient
      .from('sessions')
      .select('id')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Upsert RSVP
    const { data: rsvp, error: rsvpError } = await adminClient
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

/**
 * PATCH /api/sessions/[id]/rsvp
 * Toggle reminder only. If no RSVP exists, creates one with response: 'yes'.
 */
export async function PATCH(
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
    const { reminder_enabled } = body;

    if (typeof reminder_enabled !== 'boolean') {
      return NextResponse.json(
        { error: 'reminder_enabled must be a boolean' },
        { status: 400 }
      );
    }

    const adminClient = await createAdminClient();

    // Upsert: if no RSVP exists, create with response 'yes' + reminder setting
    // If RSVP exists, update reminder_enabled (preserves existing response)
    const { data: existing } = await adminClient
      .from('rsvps')
      .select('*')
      .eq('session_id', sessionId)
      .eq('user_id', user.id)
      .single();

    const { data: rsvp, error: rsvpError } = await adminClient
      .from('rsvps')
      .upsert(
        {
          session_id: sessionId,
          user_id: user.id,
          response: existing?.response || 'yes',
          reminder_enabled,
        },
        {
          onConflict: 'session_id,user_id',
        }
      )
      .select()
      .single();

    if (rsvpError) throw rsvpError;

    return NextResponse.json({
      message: 'Reminder updated successfully',
      rsvp,
    });
  } catch (error: unknown) {
    console.error('Error toggling reminder:', error);
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
    const adminClient = await createAdminClient();

    // Get user's RSVP for this session
    const { data: rsvp, error: rsvpError } = await adminClient
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
