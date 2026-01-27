import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { interakt } from '@/lib/integrations/interakt';
import { sms } from '@/lib/integrations/sms';

// Initialize Resend lazily to avoid build-time errors
let defaultResend: Resend | null = null;

function getResendClient(customApiKey?: string) {
  // Use custom API key if provided
  if (customApiKey) {
    return new Resend(customApiKey);
  }
  // Fall back to default client with env API key
  if (!defaultResend && process.env.RESEND_API_KEY) {
    defaultResend = new Resend(process.env.RESEND_API_KEY);
  }
  return defaultResend;
}

// Cache for integration settings
let integrationCache: Record<string, any> = {};
let cacheTimestamp = 0;
const CACHE_TTL = 60000; // 1 minute

async function getIntegrationSettings(supabase: any, channel: string) {
  const now = Date.now();

  // Refresh cache if expired
  if (now - cacheTimestamp > CACHE_TTL) {
    const { data } = await supabase
      .from('notification_integrations')
      .select('*');

    integrationCache = {};
    (data || []).forEach((i: any) => {
      integrationCache[i.channel] = i;
    });
    cacheTimestamp = now;
  }

  return integrationCache[channel] || null;
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
      await sendNotification(job, log, supabase);

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

async function sendNotification(job: any, log: any, supabase: any) {
  if (job.channel === 'email') {
    if (!log.recipient_email) {
      throw new Error('No email address provided');
    }

    // Get email integration settings
    const integration = await getIntegrationSettings(supabase, 'email');
    const config = integration?.config || {};
    const provider = config.provider || integration?.provider || 'resend';

    // Currently only Resend is fully implemented
    // For other providers, you would add their implementation here
    if (provider !== 'resend') {
      // For non-default providers, require API key in config
      if (!config.api_key) {
        throw new Error(`Email provider ${provider} requires an API key. Configure it in Settings.`);
      }
      // TODO: Implement other email providers (SendGrid, Mailgun, etc.)
      throw new Error(`Email provider ${provider} not yet implemented. Please use Resend for now.`);
    }

    // Use custom API key from config, or fall back to env variable for default provider
    const customApiKey = config.api_key || undefined;
    const resendClient = getResendClient(customApiKey);
    if (!resendClient) {
      throw new Error('Resend API key not configured - set it in Settings or RESEND_API_KEY env var');
    }

    // Use integration config or env vars
    const fromEmail = config.from_email || process.env.RESEND_FROM_EMAIL || 'notifications@rethink.com';
    const fromName = config.from_name || 'Rethink Systems';
    const replyTo = config.reply_to || process.env.RESEND_REPLY_TO_EMAIL;

    // Choose body based on body_type
    const emailBody = job.metadata?.body_type === 'html' && job.metadata?.html_body
      ? job.metadata.html_body
      : job.body;

    const result = await resendClient.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: log.recipient_email,
      subject: job.subject || 'Notification',
      html: emailBody,
      ...(replyTo && { replyTo }),
    });

    if (!result.data) {
      throw new Error(result.error?.message || 'Failed to send email');
    }

    return { messageId: result.data.id };

  } else if (job.channel === 'sms') {
    if (!log.recipient_phone) {
      throw new Error('No phone number provided');
    }

    // Get SMS integration settings
    const integration = await getIntegrationSettings(supabase, 'sms');

    if (!integration || !integration.is_active) {
      throw new Error('SMS integration not configured or disabled');
    }

    const config = integration.config || {};
    // Provider can be stored in config.provider (from UI) or integration.provider
    const provider = config.provider || integration.provider || 'twilio';
    const isDefaultProvider = provider === 'twilio';

    // For non-default providers, require credentials in config
    if (!isDefaultProvider && provider !== 'msg91') {
      throw new Error(`SMS provider ${provider} not yet implemented. Please use Twilio or MSG91 for now.`);
    }

    const result = await sms.send({
      to: log.recipient_phone,
      message: job.body,
      config: {
        provider: provider === 'msg91' ? 'msg91' : 'twilio',
        twilio: (provider === 'twilio' || provider === 'vonage' || provider === 'plivo') ? {
          // Only fall back to env vars for default provider (twilio)
          accountSid: config.account_sid || (isDefaultProvider ? process.env.TWILIO_ACCOUNT_SID : '') || '',
          authToken: config.auth_token || (isDefaultProvider ? process.env.TWILIO_AUTH_TOKEN : '') || '',
          phoneNumber: config.phone_number || (isDefaultProvider ? process.env.TWILIO_PHONE_NUMBER : '') || '',
        } : undefined,
        msg91: provider === 'msg91' ? {
          authKey: config.auth_key || process.env.MSG91_AUTH_KEY || '',
          senderId: config.sender_id || process.env.MSG91_SENDER_ID || '',
        } : undefined,
      },
    });

    if (!result.success) {
      throw new Error(result.error || 'Failed to send SMS');
    }

    return { messageId: result.messageId };

  } else if (job.channel === 'whatsapp') {
    if (!log.recipient_phone) {
      throw new Error('No phone number provided');
    }

    // Get WhatsApp integration settings
    const integration = await getIntegrationSettings(supabase, 'whatsapp');

    if (!integration || !integration.is_active) {
      throw new Error('WhatsApp integration not configured or disabled');
    }

    const config = integration.config || {};
    // Provider can be stored in config.provider (from UI) or integration.provider
    const provider = config.provider || integration.provider || 'interakt';
    const isDefaultProvider = provider === 'interakt';

    // For non-default providers, require API key in config
    if (!isDefaultProvider) {
      if (!config.api_key) {
        throw new Error(`WhatsApp provider ${provider} requires an API key. Configure it in Settings.`);
      }
      // TODO: Implement other WhatsApp providers (Twilio WhatsApp, etc.)
      throw new Error(`WhatsApp provider ${provider} not yet implemented. Please use Interakt for now.`);
    }

    // Use custom API key or fall back to env var for default provider
    const apiKey = config.api_key || process.env.INTERAKT_API_KEY;

    if (!apiKey) {
      throw new Error('Interakt API key not configured - set it in Settings or INTERAKT_API_KEY env var');
    }

    // Check if using template or text message
    const templateName = job.metadata?.whatsapp_template_name;

    if (templateName) {
      // Send template message
      const result = await interakt.sendTemplate({
        phoneNumber: log.recipient_phone,
        templateName,
        variables: job.metadata?.variable_values || {},
        config: {
          apiKey,
          countryCode: config.country_code || '+91',
        },
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to send WhatsApp template');
      }

      return { messageId: result.messageId };
    } else {
      // Send text message (only works within 24-hour session window)
      const result = await interakt.sendText({
        phoneNumber: log.recipient_phone,
        message: job.body,
        config: {
          apiKey,
          countryCode: config.country_code || '+91',
        },
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to send WhatsApp message');
      }

      return { messageId: result.messageId };
    }
  }

  throw new Error(`Unknown channel: ${job.channel}`);
}
