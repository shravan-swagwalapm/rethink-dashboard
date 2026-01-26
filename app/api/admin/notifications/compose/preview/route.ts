import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// POST - Preview notification with variable substitution
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
