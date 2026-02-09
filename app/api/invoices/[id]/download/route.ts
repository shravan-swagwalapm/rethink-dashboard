import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET - Generate signed URL for invoice PDF download
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminClient = await createAdminClient();

    // Check admin access via BOTH legacy profiles.role AND user_role_assignments
    const [{ data: profile }, { data: roleAssignment }] = await Promise.all([
      adminClient
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle(),
      adminClient
        .from('user_role_assignments')
        .select('role')
        .eq('user_id', user.id)
        .in('role', ['admin', 'company_user'])
        .limit(1)
        .maybeSingle(),
    ]);

    const isAdmin = profile?.role === 'admin' || profile?.role === 'company_user' || !!roleAssignment;

    // Fetch the invoice
    const { data: invoice, error: invoiceError } = await adminClient
      .from('invoices')
      .select('id, user_id, pdf_path, invoice_number')
      .eq('id', id)
      .single();

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Check authorization - user must own the invoice or be admin
    if (!isAdmin && invoice.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Check if PDF exists
    if (!invoice.pdf_path) {
      return NextResponse.json({ error: 'No PDF available for this invoice' }, { status: 404 });
    }

    // Generate signed URL (valid for 5 minutes)
    const { data: signedUrl, error: signedUrlError } = await adminClient.storage
      .from('invoices')
      .createSignedUrl(invoice.pdf_path, 300);

    if (signedUrlError || !signedUrl) {
      console.error('Error generating signed URL:', signedUrlError);
      return NextResponse.json({ error: 'Failed to generate download link' }, { status: 500 });
    }

    return NextResponse.json({
      url: signedUrl.signedUrl,
      filename: `${invoice.invoice_number}.pdf`,
    });
  } catch (error) {
    console.error('Error in invoice download:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
