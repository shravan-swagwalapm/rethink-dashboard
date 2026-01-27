import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET - Fetch aggregated analytics
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
    const from = searchParams.get('from') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const to = searchParams.get('to') || new Date().toISOString();
    const channel = searchParams.get('channel');

    // Build base query
    let logsQuery = supabase
      .from('notification_logs')
      .select('*')
      .gte('created_at', from)
      .lte('created_at', to);

    // Fetch jobs for channel filtering
    let jobIds: string[] = [];
    if (channel) {
      const { data: jobs } = await supabase
        .from('notification_jobs')
        .select('id')
        .eq('channel', channel);

      if (jobs) {
        jobIds = jobs.map(j => j.id);
        if (jobIds.length > 0) {
          logsQuery = logsQuery.in('job_id', jobIds);
        }
      }
    }

    const { data: logs, error } = await logsQuery;

    if (error) throw error;

    // Calculate aggregate stats
    const totalSent = logs?.length || 0;
    const delivered = logs?.filter(l => l.event_type === 'sent' && l.created_at).length || 0;
    const failed = logs?.filter(l => l.event_type === 'failed').length || 0;
    const opened = logs?.filter(l => l.metadata?.opened_at).length || 0;
    const clicked = logs?.filter(l => l.metadata?.clicked_at).length || 0;

    const deliveryRate = totalSent > 0 ? (delivered / totalSent * 100).toFixed(2) : '0';
    const openRate = delivered > 0 ? (opened / delivered * 100).toFixed(2) : '0';
    const clickRate = delivered > 0 ? (clicked / delivered * 100).toFixed(2) : '0';

    // Get stats by template
    const { data: jobs } = await supabase
      .from('notification_jobs')
      .select('id, template_id, notification_templates(name)')
      .gte('created_at', from)
      .lte('created_at', to);

    const templateStats: Record<string, any> = {};

    if (jobs) {
      for (const job of jobs) {
        // Fix: Filter logs by job.id, not job.template_id
        const jobLogs = logs?.filter(l => l.job_id === job.id) || [];
        const templateName = (job as any).notification_templates?.name || 'Unknown';

        if (!templateStats[job.template_id]) {
          templateStats[job.template_id] = {
            template_id: job.template_id,
            name: templateName,
            sent: 0,
            delivered: 0,
            failed: 0,
          };
        }

        templateStats[job.template_id].sent += jobLogs.length;
        templateStats[job.template_id].delivered += jobLogs.filter(l => l.event_type === 'sent' && l.created_at).length;
        templateStats[job.template_id].failed += jobLogs.filter(l => l.event_type === 'failed').length;
      }
    }

    // Get timeline data (daily aggregates)
    const timeline: Record<string, any> = {};

    logs?.forEach(log => {
      if (!log.created_at) return;
      const date = new Date(log.created_at).toISOString().split('T')[0];

      if (!timeline[date]) {
        timeline[date] = { date, sent: 0, delivered: 0, failed: 0 };
      }

      timeline[date].sent++;
      if (log.event_type === 'sent') timeline[date].delivered++;
      if (log.event_type === 'failed') timeline[date].failed++;
    });

    const timelineArray = Object.values(timeline).sort((a: any, b: any) =>
      a.date.localeCompare(b.date)
    );

    return NextResponse.json(
      {
        data: {
          total_sent: totalSent,
          delivered,
          failed,
          opened,
          clicked,
          delivery_rate: parseFloat(deliveryRate),
          open_rate: parseFloat(openRate),
          click_rate: parseFloat(clickRate),
          by_template: Object.values(templateStats),
          timeline: timelineArray,
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error fetching analytics:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
}
