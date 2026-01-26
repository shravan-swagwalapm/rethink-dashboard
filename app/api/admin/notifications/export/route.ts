import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET - Export logs as CSV
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check if user is admin
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const jobId = searchParams.get('job_id');
    const recipient = searchParams.get('recipient');
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    // Build query (same filters as logs API)
    let query = supabase
      .from('notification_logs')
      .select(`
        *,
        notification_jobs (
          template_id,
          channel,
          notification_templates (
            name
          )
        )
      `)
      .order('created_at', { ascending: false })
      .limit(10000); // Max 10k rows for CSV export

    // Apply filters
    if (status) {
      query = query.eq('event_type', status);
    }

    if (jobId) {
      query = query.eq('job_id', jobId);
    }

    if (recipient) {
      query = query.or(`recipient_email.ilike.%${recipient}%,recipient_phone.ilike.%${recipient}%`);
    }

    if (from) {
      query = query.gte('created_at', from);
    }

    if (to) {
      query = query.lte('created_at', to);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Generate CSV
    const headers = [
      'ID',
      'Timestamp',
      'Template',
      'Channel',
      'Recipient Email',
      'Recipient Phone',
      'Status',
      'Job ID',
    ];

    let csv = headers.join(',') + '\n';

    data?.forEach((log: any) => {
      const row = [
        log.id,
        log.created_at || '',
        log.notification_jobs?.notification_templates?.name || '',
        log.notification_jobs?.channel || '',
        log.recipient_email || '',
        log.recipient_phone || '',
        log.event_type,
        log.job_id,
      ];

      csv += row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(',') + '\n';
    });

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="notification-logs-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  } catch (error: any) {
    console.error('Error exporting logs:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to export logs' },
      { status: 500 }
    );
  }
}
