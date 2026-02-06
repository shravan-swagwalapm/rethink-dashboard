import { createClient } from '@/lib/supabase/server';
import { verifyAdmin } from '@/lib/api/verify-admin';
import { NextRequest, NextResponse } from 'next/server';

// POST - Preview notification with variable substitution
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAdmin();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const supabase = await createClient();

    const body = await request.json();
    const { template_id, variables } = body;

    if (!template_id) {
      return NextResponse.json(
        { error: 'Template ID is required' },
        { status: 400 }
      );
    }

    // Fetch template
    const { data: template, error } = await supabase
      .from('notification_templates')
      .select('*')
      .eq('id', template_id)
      .single();

    if (error || !template) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    // Substitute variables
    let subject = template.subject || '';
    let messageBody = template.body;

    if (variables) {
      Object.entries(variables).forEach(([key, value]) => {
        const regex = new RegExp(`{{${key}}}`, 'g');
        subject = subject.replace(regex, String(value));
        messageBody = messageBody.replace(regex, String(value));
      });
    }

    return NextResponse.json(
      {
        data: {
          subject,
          body: messageBody,
          channel: template.channel,
          variables: template.variables,
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error previewing notification:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to preview notification' },
      { status: 500 }
    );
  }
}
