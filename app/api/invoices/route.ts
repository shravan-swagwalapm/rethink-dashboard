import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// GET - List current user's invoices
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminClient = await createAdminClient();

    // Fetch user's invoices with cohort info
    const { data: invoices, error } = await adminClient
      .from('invoices')
      .select(`
        *,
        cohort:cohorts!invoices_cohort_id_fkey(id, name, tag)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching invoices:', error);
      return NextResponse.json({ error: 'Failed to fetch invoices' }, { status: 500 });
    }

    // Calculate stats
    const invoiceList = invoices || [];
    const stats = {
      total: invoiceList.length,
      paid: invoiceList.filter(i => i.status === 'paid').length,
      pending: invoiceList.filter(i => i.status === 'pending').length,
      overdue: invoiceList.filter(i => i.status === 'overdue').length,
      total_amount: invoiceList.reduce((sum, i) => sum + (i.amount || 0), 0),
      paid_amount: invoiceList.filter(i => i.status === 'paid').reduce((sum, i) => sum + (i.amount || 0), 0),
      pending_amount: invoiceList.filter(i => i.status !== 'paid').reduce((sum, i) => sum + (i.amount || 0), 0),
    };

    return NextResponse.json({
      invoices: invoiceList,
      stats,
    });
  } catch (error) {
    console.error('Error in invoices GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
