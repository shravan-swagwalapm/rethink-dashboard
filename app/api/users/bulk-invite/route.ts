import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  // Check authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check if user is admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || !['admin', 'company_user'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { inviteIds } = body;

    if (!inviteIds || !Array.isArray(inviteIds) || inviteIds.length === 0) {
      return NextResponse.json({ error: 'No invite IDs provided' }, { status: 400 });
    }

    // Fetch invites
    const { data: invites, error: fetchError } = await supabase
      .from('invites')
      .select('*')
      .in('id', inviteIds)
      .eq('status', 'pending');

    if (fetchError) throw fetchError;

    if (!invites || invites.length === 0) {
      return NextResponse.json({ error: 'No pending invites found' }, { status: 404 });
    }

    // Process each invite
    const results = {
      sent: [] as string[],
      failed: [] as { id: string; error: string }[],
    };

    for (const invite of invites) {
      try {
        // In production, this would send an actual email via Resend
        // For now, we'll simulate the email sending

        // TODO: Integrate with Resend API
        // const emailResponse = await resend.emails.send({
        //   from: 'Rethink Systems <noreply@rethink.systems>',
        //   to: invite.email,
        //   subject: 'Welcome to Rethink Systems - Complete Your Registration',
        //   html: generateInviteEmailHTML(invite),
        // });

        // Simulate email sending success
        await new Promise(resolve => setTimeout(resolve, 100));

        // Update invite status
        await supabase
          .from('invites')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            error_message: null,
          })
          .eq('id', invite.id);

        results.sent.push(invite.id);
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        // Update invite status to failed
        await supabase
          .from('invites')
          .update({
            status: 'failed',
            error_message: errorMessage,
          })
          .eq('id', invite.id);

        results.failed.push({ id: invite.id, error: errorMessage });
      }
    }

    return NextResponse.json({
      message: `${results.sent.length} invite(s) sent, ${results.failed.length} failed`,
      sent: results.sent.length,
      failed: results.failed.length,
      failedDetails: results.failed,
    });
  } catch (error: unknown) {
    console.error('Error processing bulk invites:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
