import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

// Initialize Resend lazily to avoid build-time errors
let resend: Resend | null = null;

function getResendClient() {
  if (!resend && process.env.RESEND_API_KEY) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}

// GET - Process pending notification jobs (called by Vercel Cron every 5 minutes)
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret for security
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();

    // Fetch pending jobs (limit 10 per run)
    const { data: jobs, error: jobsError } = await supabase
      .from('notification_jobs')
      .select('*')
      .in('status', ['pending', 'processing'])
      .lte('scheduled_for', new Date().toISOString())
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(10);

    if (jobsError) throw jobsError;

    if (!jobs || jobs.length === 0) {
      return NextResponse.json({ processed: 0, message: 'No pending jobs' });
    }

    let processedCount = 0;

    // Process each job
    for (const job of jobs) {
      try {
        await processJob(supabase, job);
        processedCount++;
      } catch (error) {
        console.error(`Error processing job ${job.id}:`, error);
        // Continue with next job
      }
    }

    return NextResponse.json({
      processed: processedCount,
      total: jobs.length,
    });
  } catch (error: any) {
    console.error('Error in cron job:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process notifications' },
      { status: 500 }
    );
  }
}

async function processJob(supabase: any, job: any) {
  // Mark job as processing
  await supabase
    .from('notification_jobs')
    .update({ status: 'processing', updated_at: new Date().toISOString() })
    .eq('id', job.id);

  // Fetch pending logs for this job (batch: 100 recipients)
  const { data: logs, error: logsError } = await supabase
    .from('notification_logs')
    .select('*')
    .eq('job_id', job.id)
    .eq('event_type', 'sent')
    .is('created_at', null)
    .limit(100);

  if (logsError) {
    console.error('Error fetching logs:', logsError);
    return;
  }

  if (!logs || logs.length === 0) {
    // All logs processed, mark job as completed
    await supabase
      .from('notification_jobs')
      .update({ status: 'sent', sent_at: new Date().toISOString() })
      .eq('id', job.id);
    return;
  }

  // Send notifications with rate limiting
  let successCount = 0;
  let failCount = 0;

  for (const log of logs) {
    try {
      await sendNotification(job, log);

      // Update log as delivered
      await supabase
        .from('notification_logs')
        .update({
          created_at: new Date().toISOString(),
          metadata: {
            ...log.metadata,
            delivered_at: new Date().toISOString(),
          },
        })
        .eq('id', log.id);

      successCount++;

      // Rate limiting: 50ms delay between sends
      await new Promise((resolve) => setTimeout(resolve, 50));
    } catch (error: any) {
      console.error(`Error sending to ${log.recipient_email || log.recipient_phone}:`, error);

      // Update log as failed
      await supabase
        .from('notification_logs')
        .update({
          event_type: 'failed',
          created_at: new Date().toISOString(),
          metadata: {
            ...log.metadata,
            error_message: error.message,
            failed_at: new Date().toISOString(),
          },
        })
        .eq('id', log.id);

      failCount++;
    }
  }

  console.log(`Job ${job.id}: ${successCount} sent, ${failCount} failed`);

  // Check if all logs are processed
  const { count } = await supabase
    .from('notification_logs')
    .select('*', { count: 'exact', head: true })
    .eq('job_id', job.id)
    .eq('event_type', 'sent')
    .is('created_at', null);

  if (count === 0) {
    // All logs processed
    await supabase
      .from('notification_jobs')
      .update({ status: 'sent', sent_at: new Date().toISOString() })
      .eq('id', job.id);
  } else {
    // More logs to process, keep as processing
    await supabase
      .from('notification_jobs')
      .update({ status: 'pending' })
      .eq('id', job.id);
  }
}

async function sendNotification(job: any, log: any) {
  if (job.channel === 'email') {
    if (!log.recipient_email) {
      throw new Error('No email address provided');
    }

    const resendClient = getResendClient();
    if (!resendClient) {
      throw new Error('Resend API key not configured');
    }

    const result = await resendClient.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'notifications@rethink.com',
      to: log.recipient_email,
      subject: job.subject || 'Notification',
      html: job.body,
      replyTo: process.env.RESEND_REPLY_TO_EMAIL,
    });

    if (!result.data) {
      throw new Error(result.error?.message || 'Failed to send email');
    }

    return result.data;
  } else if (job.channel === 'sms') {
    // SMS implementation would go here
    // For now, just log
    console.log(`SMS would be sent to ${log.recipient_phone}: ${job.body}`);
    throw new Error('SMS sending not yet implemented');
  } else if (job.channel === 'whatsapp') {
    // WhatsApp implementation would go here
    // For now, just log
    console.log(`WhatsApp would be sent to ${log.recipient_phone}: ${job.body}`);
    throw new Error('WhatsApp sending not yet implemented');
  }

  throw new Error(`Unknown channel: ${job.channel}`);
}
