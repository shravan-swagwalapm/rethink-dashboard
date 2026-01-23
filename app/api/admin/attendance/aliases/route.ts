import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { attendanceService } from '@/lib/services/attendance';

async function verifyAdmin() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { authorized: false, error: 'Unauthorized', status: 401 };
  }

  const adminClient = await createAdminClient();
  const { data: profile } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const isAdmin = profile?.role === 'admin' || profile?.role === 'company_user';

  if (!isAdmin) {
    return { authorized: false, error: 'Forbidden', status: 403 };
  }

  return { authorized: true, userId: user.id };
}

// GET - Get unmatched attendance emails or aliases for a user
export async function GET(request: NextRequest) {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');
    const action = searchParams.get('action');

    const adminClient = await createAdminClient();

    // Get aliases for a specific user
    if (userId) {
      const aliases = await attendanceService.getEmailAliases(userId);
      return NextResponse.json({ aliases });
    }

    // Get all unmatched attendance emails
    if (action === 'unmatched') {
      const { data: unmatched } = await adminClient
        .from('attendance')
        .select('zoom_user_email, session_id, sessions(title, scheduled_at)')
        .is('user_id', null)
        .order('created_at', { ascending: false });

      // Group by email
      const emailGroups: Record<string, { email: string; sessions: { id: string; title: string; date: string }[] }> = {};

      for (const record of unmatched || []) {
        const email = record.zoom_user_email;
        if (!emailGroups[email]) {
          emailGroups[email] = { email, sessions: [] };
        }
        if (record.sessions) {
          const session = record.sessions as unknown as { title: string; scheduled_at: string };
          emailGroups[email].sessions.push({
            id: record.session_id,
            title: session.title,
            date: session.scheduled_at,
          });
        }
      }

      return NextResponse.json({
        unmatchedEmails: Object.values(emailGroups)
      });
    }

    // Get all aliases with user info
    const { data: aliases } = await adminClient
      .from('user_email_aliases')
      .select('*, user:profiles(id, full_name, email)')
      .order('created_at', { ascending: false });

    return NextResponse.json({ aliases: aliases || [] });
  } catch (error) {
    console.error('Error fetching aliases:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create email alias and re-match attendance
export async function POST(request: NextRequest) {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const { user_id, alias_email } = body;

    if (!user_id || !alias_email) {
      return NextResponse.json({ error: 'user_id and alias_email are required' }, { status: 400 });
    }

    // Add the alias
    const result = await attendanceService.addEmailAlias(user_id, alias_email);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    // Re-match any existing attendance records with this email
    const rematched = await attendanceService.rematchAttendanceByEmail(alias_email, user_id);

    return NextResponse.json({
      success: true,
      rematchedRecords: rematched,
    });
  } catch (error) {
    console.error('Error creating alias:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Remove email alias
export async function DELETE(request: NextRequest) {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { searchParams } = new URL(request.url);
    const aliasId = searchParams.get('id');

    if (!aliasId) {
      return NextResponse.json({ error: 'Alias ID is required' }, { status: 400 });
    }

    const result = await attendanceService.removeEmailAlias(aliasId);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting alias:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
