import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET - Fetch all templates or a specific template
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
    const id = searchParams.get('id');
    const channel = searchParams.get('channel');

    // If fetching single template by ID
    if (id) {
      const { data, error } = await supabase
        .from('notification_templates')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return NextResponse.json({ data }, { status: 200 });
    }

    // Build query for list
    let query = supabase
      .from('notification_templates')
      .select('*')
      .order('created_at', { ascending: false });

    if (channel) {
      query = query.eq('channel', channel);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json({ data }, { status: 200 });
  } catch (error: any) {
    console.error('Error fetching templates:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch templates' },
      { status: 500 }
    );
  }
}

// POST - Create a new template
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
    const { name, description, subject, body: templateBody, variables, channel } = body;

    // Validation
    if (!name || !templateBody || !channel) {
      return NextResponse.json(
        { error: 'Name, body, and channel are required' },
        { status: 400 }
      );
    }

    if (!['email', 'sms', 'whatsapp'].includes(channel)) {
      return NextResponse.json(
        { error: 'Invalid channel. Must be email, sms, or whatsapp' },
        { status: 400 }
      );
    }

    // Insert template
    const { data, error } = await supabase
      .from('notification_templates')
      .insert({
        name,
        description: description || null,
        subject: subject || null,
        body: templateBody,
        variables: variables || [],
        channel,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ data }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating template:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create template' },
      { status: 500 }
    );
  }
}

// PATCH - Update a template
export async function PATCH(request: NextRequest) {
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
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'Template ID is required' }, { status: 400 });
    }

    // Update template
    const { data, error } = await supabase
      .from('notification_templates')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ data }, { status: 200 });
  } catch (error: any) {
    console.error('Error updating template:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update template' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a template
export async function DELETE(request: NextRequest) {
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
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Template ID is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('notification_templates')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ message: 'Template deleted successfully' }, { status: 200 });
  } catch (error: any) {
    console.error('Error deleting template:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete template' },
      { status: 500 }
    );
  }
}
