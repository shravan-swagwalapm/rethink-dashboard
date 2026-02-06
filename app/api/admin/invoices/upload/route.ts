import { createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/api/verify-admin';

// POST - Upload single invoice PDF and create record
export async function POST(request: NextRequest) {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const userId = formData.get('user_id') as string;
    const cohortId = formData.get('cohort_id') as string;
    const invoiceNumber = formData.get('invoice_number') as string;
    const amount = formData.get('amount') as string;
    const dueDate = formData.get('due_date') as string | null;
    const paymentType = formData.get('payment_type') as string || 'full';
    const invoiceStatus = formData.get('status') as string || 'pending';
    const emiNumber = formData.get('emi_number') as string | null;
    const totalEmis = formData.get('total_emis') as string | null;

    // Validate required fields
    if (!file) {
      return NextResponse.json({ error: 'PDF file is required' }, { status: 400 });
    }

    if (!userId || !cohortId || !invoiceNumber || !amount) {
      return NextResponse.json({
        error: 'Missing required fields: user_id, cohort_id, invoice_number, amount'
      }, { status: 400 });
    }

    // Validate file type
    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Only PDF files are allowed' }, { status: 400 });
    }

    // Check file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File size exceeds 10MB limit' }, { status: 400 });
    }

    const adminClient = await createAdminClient();

    // Check if invoice number already exists
    const { data: existing } = await adminClient
      .from('invoices')
      .select('id')
      .eq('invoice_number', invoiceNumber)
      .single();

    if (existing) {
      return NextResponse.json({ error: 'Invoice number already exists' }, { status: 400 });
    }

    // Verify user belongs to the cohort
    const { data: userAssignment } = await adminClient
      .from('user_role_assignments')
      .select('id')
      .eq('user_id', userId)
      .eq('cohort_id', cohortId)
      .eq('role', 'student')
      .single();

    // Also check legacy cohort_id field
    const { data: userProfile } = await adminClient
      .from('profiles')
      .select('cohort_id')
      .eq('id', userId)
      .single();

    if (!userAssignment && userProfile?.cohort_id !== cohortId) {
      return NextResponse.json({
        error: 'User does not belong to the selected cohort'
      }, { status: 400 });
    }

    // Generate unique file path: cohort_id/user_id/timestamp_invoicenumber.pdf
    const timestamp = Date.now();
    const sanitizedInvoiceNumber = invoiceNumber.replace(/[^a-zA-Z0-9-]/g, '_');
    const filePath = `${cohortId}/${userId}/${timestamp}_${sanitizedInvoiceNumber}.pdf`;

    // Convert File to Buffer for upload
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await adminClient.storage
      .from('invoices')
      .upload(filePath, buffer, {
        contentType: 'application/pdf',
        upsert: false,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);

      let errorMessage = 'Failed to upload file';
      if (uploadError.message?.includes('bucket')) {
        errorMessage = 'Storage bucket not configured. Please run the migration to create the invoices bucket.';
      } else if (uploadError.message?.includes('policy')) {
        errorMessage = 'Storage permissions not configured. Please check storage policies.';
      } else if (uploadError.message?.includes('size')) {
        errorMessage = 'File size exceeds the limit (10MB max).';
      }

      return NextResponse.json({
        error: errorMessage,
        details: uploadError.message
      }, { status: 500 });
    }

    // Create invoice record in database
    const { data: invoice, error: dbError } = await adminClient
      .from('invoices')
      .insert({
        user_id: userId,
        cohort_id: cohortId,
        invoice_number: invoiceNumber,
        amount: parseFloat(amount),
        due_date: dueDate || null,
        payment_type: paymentType,
        emi_number: emiNumber ? parseInt(emiNumber) : null,
        total_emis: totalEmis ? parseInt(totalEmis) : null,
        pdf_path: uploadData.path,
        status: invoiceStatus,
      })
      .select(`
        *,
        user:profiles!invoices_user_id_fkey(id, email, full_name),
        cohort:cohorts!invoices_cohort_id_fkey(id, name, tag)
      `)
      .single();

    if (dbError) {
      // Cleanup uploaded file if database insert fails
      await adminClient.storage.from('invoices').remove([filePath]);
      console.error('Database error:', dbError);
      return NextResponse.json({ error: 'Failed to create invoice record' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      invoice,
      message: 'Invoice uploaded successfully'
    });
  } catch (error) {
    console.error('Error uploading invoice:', error);
    return NextResponse.json({ error: 'Failed to upload invoice' }, { status: 500 });
  }
}
