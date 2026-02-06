import { createClient } from '@/lib/supabase/server';
import { verifyAdmin } from '@/lib/api/verify-admin';
import { NextRequest, NextResponse } from 'next/server';

// GET - Fetch all contact lists or contacts in a specific list
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAdmin();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const supabase = await createClient();

    const { searchParams } = new URL(request.url);
    const listId = searchParams.get('list_id');

    // If fetching contacts in a specific list
    if (listId) {
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('list_id', listId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return NextResponse.json({ data }, { status: 200 });
    }

    // Fetch all contact lists with contact counts
    const { data: lists, error: listsError } = await supabase
      .from('contact_lists')
      .select('*')
      .order('created_at', { ascending: false });

    if (listsError) throw listsError;

    // Get contact counts for each list
    const listsWithCounts = await Promise.all(
      lists.map(async (list) => {
        const { count } = await supabase
          .from('contacts')
          .select('*', { count: 'exact', head: true })
          .eq('list_id', list.id);

        return {
          ...list,
          contact_count: count || 0,
        };
      })
    );

    return NextResponse.json({ data: listsWithCounts }, { status: 200 });
  } catch (error: any) {
    console.error('Error fetching contacts:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch contacts' },
      { status: 500 }
    );
  }
}

// POST - Create contact list OR add contacts to a list
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAdmin();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const supabase = await createClient();

    const body = await request.json();

    // Create contact list
    if (body.name && !body.contacts) {
      const { name, description, tags } = body;

      if (!name) {
        return NextResponse.json(
          { error: 'Name is required' },
          { status: 400 }
        );
      }

      const { data, error } = await supabase
        .from('contact_lists')
        .insert({
          name,
          description: description || null,
          tags: tags || [],
          created_by: auth.userId,
        })
        .select()
        .single();

      if (error) throw error;

      return NextResponse.json({ data: { ...data, contact_count: 0 } }, { status: 201 });
    }

    // Add contacts to a list
    if (body.list_id && body.contacts) {
      const { list_id, contacts } = body;

      if (!Array.isArray(contacts) || contacts.length === 0) {
        return NextResponse.json(
          { error: 'Contacts array is required' },
          { status: 400 }
        );
      }

      // Validate list exists
      const { data: list } = await supabase
        .from('contact_lists')
        .select('id')
        .eq('id', list_id)
        .single();

      if (!list) {
        return NextResponse.json(
          { error: 'Contact list not found' },
          { status: 404 }
        );
      }

      // Insert contacts
      const contactsToInsert = contacts.map((contact) => ({
        list_id,
        email: contact.email || null,
        phone: contact.phone || null,
        name: contact.name || null,
        metadata: contact.metadata || {},
      }));

      const { data, error } = await supabase
        .from('contacts')
        .insert(contactsToInsert)
        .select();

      if (error) throw error;

      return NextResponse.json({ data }, { status: 201 });
    }

    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('Error creating contact/list:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create contact/list' },
      { status: 500 }
    );
  }
}

// PATCH - Update contact list or contact
export async function PATCH(request: NextRequest) {
  try {
    const auth = await verifyAdmin();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const supabase = await createClient();

    const body = await request.json();
    const { id, type, ...updates } = body;

    if (!id || !type) {
      return NextResponse.json(
        { error: 'ID and type are required' },
        { status: 400 }
      );
    }

    if (type === 'list') {
      const { data, error } = await supabase
        .from('contact_lists')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // Get contact count
      const { count } = await supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true })
        .eq('list_id', id);

      return NextResponse.json(
        { data: { ...data, contact_count: count || 0 } },
        { status: 200 }
      );
    }

    if (type === 'contact') {
      const { data, error } = await supabase
        .from('contacts')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      return NextResponse.json({ data }, { status: 200 });
    }

    return NextResponse.json(
      { error: 'Invalid type. Must be "list" or "contact"' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('Error updating contact/list:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update contact/list' },
      { status: 500 }
    );
  }
}

// DELETE - Delete contact list or contact
export async function DELETE(request: NextRequest) {
  try {
    const auth = await verifyAdmin();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const supabase = await createClient();

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const type = searchParams.get('type');

    if (!id || !type) {
      return NextResponse.json(
        { error: 'ID and type are required' },
        { status: 400 }
      );
    }

    if (type === 'list') {
      const { error } = await supabase
        .from('contact_lists')
        .delete()
        .eq('id', id);

      if (error) throw error;

      return NextResponse.json(
        { message: 'Contact list deleted successfully' },
        { status: 200 }
      );
    }

    if (type === 'contact') {
      const { error } = await supabase
        .from('contacts')
        .delete()
        .eq('id', id);

      if (error) throw error;

      return NextResponse.json(
        { message: 'Contact deleted successfully' },
        { status: 200 }
      );
    }

    return NextResponse.json(
      { error: 'Invalid type. Must be "list" or "contact"' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('Error deleting contact/list:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete contact/list' },
      { status: 500 }
    );
  }
}
