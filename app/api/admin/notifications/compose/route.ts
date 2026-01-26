import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

interface RecipientConfig {
  type: 'cohorts' | 'users' | 'contacts' | 'email_list';
  cohort_ids?: string[];
  user_ids?: string[];
  contact_list_ids?: string[];
  emails?: string[];
}

// POST - Create notification job
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const {
      template_id,
      recipients,
      variables,
      send_at,
      priority = 'normal',
    }: {
      template_id: string;
      recipients: RecipientConfig;
      variables: Record<string, string>;
      send_at?: string;
      priority?: 'high' | 'normal' | 'low';
    } = body;

    // Validate required fields
    if (!template_id || !recipients) {
      return NextResponse.json(
        { error: 'Template ID and recipients are required' },
        { status: 400 }
      );
    }

    // Fetch template
    const { data: template, error: templateError } = await supabase
      .from('notification_templates')
      .select('*')
      .eq('id', template_id)
      .single();

    if (templateError || !template) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    // Resolve recipients to email/phone list
    const recipientList: Array<{
      type: string;
      id?: string;
      email?: string;
      phone?: string;
      name?: string;
    }> = [];

    // Add cohort members
    if (recipients.cohort_ids && recipients.cohort_ids.length > 0) {
      const { data: cohortMembers } = await supabase
        .from('profiles')
        .select('id, email, full_name, phone')
        .in('cohort_id', recipients.cohort_ids)
        .not('email', 'is', null);

      if (cohortMembers) {
        cohortMembers.forEach((member) => {
          if (member.email || member.phone) {
            recipientList.push({
              type: 'user',
              id: member.id,
              email: member.email,
              phone: member.phone,
              name: member.full_name,
            });
          }
        });
      }
    }

    // Add individual users
    if (recipients.user_ids && recipients.user_ids.length > 0) {
      const { data: users } = await supabase
        .from('profiles')
        .select('id, email, full_name, phone')
        .in('id', recipients.user_ids);

      if (users) {
        users.forEach((u) => {
          if (u.email || u.phone) {
            recipientList.push({
              type: 'user',
              id: u.id,
              email: u.email,
              phone: u.phone,
              name: u.full_name,
            });
          }
        });
      }
    }

    // Add contacts from lists
    if (recipients.contact_list_ids && recipients.contact_list_ids.length > 0) {
      const { data: contacts } = await supabase
        .from('contacts')
        .select('*')
        .in('list_id', recipients.contact_list_ids)
        .eq('unsubscribed', false);

      if (contacts) {
        contacts.forEach((contact) => {
          if (contact.email || contact.phone) {
            recipientList.push({
              type: 'contact',
              id: contact.id,
              email: contact.email,
              phone: contact.phone,
              name: contact.name,
            });
          }
        });
      }
    }

    // Add manual emails
    if (recipients.emails && recipients.emails.length > 0) {
      recipients.emails.forEach((email) => {
        recipientList.push({
          type: 'custom',
          email: email.trim(),
        });
      });
    }

    // Remove duplicates based on email/phone
    const uniqueRecipients = Array.from(
      new Map(
        recipientList.map((r) => [r.email || r.phone, r])
      ).values()
    );

    if (uniqueRecipients.length === 0) {
      return NextResponse.json(
        { error: 'No valid recipients found' },
        { status: 400 }
      );
    }

    // Substitute variables in template
    let subject = template.subject || '';
    let messageBody = template.body;

    Object.entries(variables || {}).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      subject = subject.replace(regex, value);
      messageBody = messageBody.replace(regex, value);
    });

    // Determine priority value
    const priorityMap = { high: 10, normal: 5, low: 1 };
    const priorityValue = priorityMap[priority];

    // Determine scheduled time
    const scheduledFor = send_at ? new Date(send_at) : new Date();

    // Create notification job
    const { data: job, error: jobError } = await supabase
      .from('notification_jobs')
      .insert({
        template_id: template.id,
        channel: template.channel,
        subject,
        body: messageBody,
        status: 'pending',
        priority: priorityValue,
        scheduled_for: scheduledFor.toISOString(),
        metadata: {
          variable_values: variables,
          recipient_config: recipients,
        },
      })
      .select()
      .single();

    if (jobError) throw jobError;

    // Create notification logs for each recipient
    const logs = uniqueRecipients.map((recipient) => ({
      job_id: job.id,
      recipient_type: recipient.type,
      recipient_id: recipient.id || null,
      recipient_email: recipient.email || null,
      recipient_phone: recipient.phone || null,
      event_type: 'sent' as const,
      metadata: {
        recipient_name: recipient.name,
      },
    }));

    // Batch insert logs (chunks of 100)
    const chunkSize = 100;
    for (let i = 0; i < logs.length; i += chunkSize) {
      const chunk = logs.slice(i, i + chunkSize);
      await supabase.from('notification_logs').insert(chunk);
    }

    return NextResponse.json(
      {
        data: {
          job_id: job.id,
          recipient_count: uniqueRecipients.length,
          scheduled_for: scheduledFor.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error creating notification job:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create notification job' },
      { status: 500 }
    );
  }
}
