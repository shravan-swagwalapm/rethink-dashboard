import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

async function verifyAdmin() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { authorized: false, error: 'Unauthorized', status: 401 };
  }

  const adminClient = await createAdminClient();
  const { data: profile } = await adminClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const isAdmin = profile?.role === 'admin' || profile?.role === 'company_user';

  if (!isAdmin) {
    return { authorized: false, error: 'Forbidden', status: 403 };
  }

  return { authorized: true, userId: user.id };
}

// GET - List invoices with filters and stats
export async function GET(request: NextRequest) {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { searchParams } = new URL(request.url);
    const cohortId = searchParams.get('cohort_id');
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    const adminClient = await createAdminClient();

    // Build query with relations
    let query = adminClient
      .from('invoices')
      .select(`
        *,
        user:profiles!invoices_user_id_fkey(id, email, full_name),
        cohort:cohorts!invoices_cohort_id_fkey(id, name, tag)
      `)
      .order('created_at', { ascending: false });

    // Apply filters
    if (cohortId) {
      query = query.eq('cohort_id', cohortId);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data: invoices, error: invoicesError } = await query;

    if (invoicesError) {
      console.error('Error fetching invoices:', invoicesError);
      return NextResponse.json({ error: 'Failed to fetch invoices' }, { status: 500 });
    }

    // Filter by search if provided (search in user email or name)
    let filteredInvoices = invoices || [];
    if (search) {
      const searchLower = search.toLowerCase();
      filteredInvoices = filteredInvoices.filter(inv =>
        inv.user?.email?.toLowerCase().includes(searchLower) ||
        inv.user?.full_name?.toLowerCase().includes(searchLower) ||
        inv.invoice_number?.toLowerCase().includes(searchLower)
      );
    }

    // Calculate stats
    const stats = {
      total: filteredInvoices.length,
      paid: filteredInvoices.filter(i => i.status === 'paid').length,
      pending: filteredInvoices.filter(i => i.status === 'pending').length,
      overdue: filteredInvoices.filter(i => i.status === 'overdue').length,
      total_amount: filteredInvoices.reduce((sum, i) => sum + (i.amount || 0), 0),
      paid_amount: filteredInvoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + (i.amount || 0), 0),
    };

    return NextResponse.json({
      invoices: filteredInvoices,
      stats,
    });
  } catch (error) {
    console.error('Error in invoices GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create invoice record (without PDF - use upload route for PDF)
export async function POST(request: NextRequest) {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const { user_id, cohort_id, invoice_number, amount, due_date, payment_type, emi_number, total_emis, pdf_path } = body;

    if (!user_id || !cohort_id || !invoice_number || amount === undefined) {
      return NextResponse.json({
        error: 'Missing required fields: user_id, cohort_id, invoice_number, amount'
      }, { status: 400 });
    }

    const adminClient = await createAdminClient();

    // Check if invoice number already exists
    const { data: existing } = await adminClient
      .from('invoices')
      .select('id')
      .eq('invoice_number', invoice_number)
      .single();

    if (existing) {
      return NextResponse.json({
        error: 'Invoice number already exists'
      }, { status: 400 });
    }

    // Create invoice record
    const { data: invoice, error } = await adminClient
      .from('invoices')
      .insert({
        user_id,
        cohort_id,
        invoice_number,
        amount,
        due_date: due_date || null,
        payment_type: payment_type || 'full',
        emi_number: emi_number || null,
        total_emis: total_emis || null,
        pdf_path: pdf_path || null,
        status: 'pending',
      })
      .select(`
        *,
        user:profiles!invoices_user_id_fkey(id, email, full_name),
        cohort:cohorts!invoices_cohort_id_fkey(id, name, tag)
      `)
      .single();

    if (error) {
      console.error('Error creating invoice:', error);
      return NextResponse.json({ error: 'Failed to create invoice' }, { status: 500 });
    }

    return NextResponse.json(invoice);
  } catch (error) {
    console.error('Error in invoices POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Update invoice (status, replace PDF path)
export async function PUT(request: NextRequest) {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const { id, status, pdf_path, amount, due_date, paid_at } = body;

    if (!id) {
      return NextResponse.json({ error: 'Invoice ID is required' }, { status: 400 });
    }

    const adminClient = await createAdminClient();

    // Build update object with only provided fields
    const updateData: Record<string, unknown> = {};
    if (status !== undefined) updateData.status = status;
    if (pdf_path !== undefined) updateData.pdf_path = pdf_path;
    if (amount !== undefined) updateData.amount = amount;
    if (due_date !== undefined) updateData.due_date = due_date;
    if (paid_at !== undefined) updateData.paid_at = paid_at;

    // Auto-set paid_at when status changes to paid
    if (status === 'paid' && paid_at === undefined) {
      updateData.paid_at = new Date().toISOString();
    }

    const { data: invoice, error } = await adminClient
      .from('invoices')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        user:profiles!invoices_user_id_fkey(id, email, full_name),
        cohort:cohorts!invoices_cohort_id_fkey(id, name, tag)
      `)
      .single();

    if (error) {
      console.error('Error updating invoice:', error);
      return NextResponse.json({ error: 'Failed to update invoice' }, { status: 500 });
    }

    return NextResponse.json(invoice);
  } catch (error) {
    console.error('Error in invoices PUT:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Delete invoice and its PDF from storage
export async function DELETE(request: NextRequest) {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Invoice ID is required' }, { status: 400 });
    }

    const adminClient = await createAdminClient();

    // Get invoice to find PDF path
    const { data: invoice, error: fetchError } = await adminClient
      .from('invoices')
      .select('pdf_path')
      .eq('id', id)
      .single();

    if (fetchError) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Delete PDF from storage if exists
    if (invoice?.pdf_path) {
      const { error: storageError } = await adminClient.storage
        .from('invoices')
        .remove([invoice.pdf_path]);

      if (storageError) {
        console.error('Error deleting invoice PDF:', storageError);
        // Continue with database deletion even if storage fails
      }
    }

    // Delete from database
    const { error: deleteError } = await adminClient
      .from('invoices')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Error deleting invoice:', deleteError);
      return NextResponse.json({ error: 'Failed to delete invoice' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Invoice deleted' });
  } catch (error) {
    console.error('Error in invoices DELETE:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
