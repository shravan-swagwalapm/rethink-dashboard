import { createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { verifyAdmin } from '@/lib/api/verify-admin';

interface MappingRow {
  filename: string;
  email: string;
  invoice_number: string;
  amount: number;
  due_date?: string;
}

interface ProcessResult {
  row: MappingRow;
  success: boolean;
  invoice_id?: string;
  error?: string;
}

// POST - Bulk upload invoices with Excel mapping
export async function POST(request: NextRequest) {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const formData = await request.formData();
    const mappingFile = formData.get('mapping_file') as File;
    const cohortId = formData.get('cohort_id') as string;

    // Get all PDF files from formData
    const pdfFiles: File[] = [];
    for (const [key, value] of formData.entries()) {
      if (key.startsWith('pdf_') && value instanceof File) {
        pdfFiles.push(value);
      }
    }

    // Validate required inputs
    if (!mappingFile) {
      return NextResponse.json({ error: 'Mapping Excel file is required' }, { status: 400 });
    }

    if (!cohortId) {
      return NextResponse.json({ error: 'Cohort ID is required' }, { status: 400 });
    }

    if (pdfFiles.length === 0) {
      return NextResponse.json({ error: 'At least one PDF file is required' }, { status: 400 });
    }

    // Parse Excel file
    const arrayBuffer = await mappingFile.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawData = XLSX.utils.sheet_to_json(worksheet);

    if (!rawData || rawData.length === 0) {
      return NextResponse.json({ error: 'Excel file is empty' }, { status: 400 });
    }

    // Parse and validate mapping rows
    const mappingRows: MappingRow[] = [];
    const parseErrors: string[] = [];

    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i] as Record<string, unknown>;
      const rowNum = i + 2; // Excel row number (1-indexed + header)

      // Find columns (case-insensitive)
      const filename = findColumnValue(row, ['filename', 'file_name', 'file', 'pdf']);
      const email = findColumnValue(row, ['email', 'student_email', 'student email']);
      const invoiceNumber = findColumnValue(row, ['invoice_number', 'invoice number', 'invoice_no', 'invoice', 'inv_number']);
      const amount = findColumnValue(row, ['amount', 'total', 'price']);
      const dueDate = findColumnValue(row, ['due_date', 'due date', 'duedate']);

      if (!filename) {
        parseErrors.push(`Row ${rowNum}: Missing filename`);
        continue;
      }
      if (!email) {
        parseErrors.push(`Row ${rowNum}: Missing email`);
        continue;
      }
      if (!invoiceNumber) {
        parseErrors.push(`Row ${rowNum}: Missing invoice number`);
        continue;
      }
      if (amount === undefined || amount === null || amount === '') {
        parseErrors.push(`Row ${rowNum}: Missing amount`);
        continue;
      }

      const parsedAmount = parseFloat(String(amount));
      if (isNaN(parsedAmount) || parsedAmount < 0) {
        parseErrors.push(`Row ${rowNum}: Invalid amount "${amount}"`);
        continue;
      }

      mappingRows.push({
        filename: String(filename).trim(),
        email: String(email).trim().toLowerCase(),
        invoice_number: String(invoiceNumber).trim(),
        amount: parsedAmount,
        due_date: dueDate ? String(dueDate).trim() : undefined,
      });
    }

    if (parseErrors.length > 0 && mappingRows.length === 0) {
      return NextResponse.json({
        error: 'Failed to parse Excel file',
        details: parseErrors,
      }, { status: 400 });
    }

    const adminClient = await createAdminClient();

    // Get all students in the cohort (both via user_role_assignments and legacy cohort_id)
    const { data: cohortStudents } = await adminClient
      .from('profiles')
      .select('id, email, cohort_id')
      .eq('cohort_id', cohortId);

    const { data: roleAssignments } = await adminClient
      .from('user_role_assignments')
      .select('user_id, profiles!inner(id, email)')
      .eq('cohort_id', cohortId)
      .eq('role', 'student');

    // Build email to user ID map
    const emailToUserId = new Map<string, string>();

    cohortStudents?.forEach(student => {
      emailToUserId.set(student.email.toLowerCase(), student.id);
    });

    roleAssignments?.forEach(assignment => {
      const profile = assignment.profiles as unknown as { id: string; email: string };
      if (profile) {
        emailToUserId.set(profile.email.toLowerCase(), profile.id);
      }
    });

    // Check for existing invoice numbers
    const invoiceNumbers = mappingRows.map(r => r.invoice_number);
    const { data: existingInvoices } = await adminClient
      .from('invoices')
      .select('invoice_number')
      .in('invoice_number', invoiceNumbers);

    const existingInvoiceNumbers = new Set(existingInvoices?.map(i => i.invoice_number) || []);

    // Create filename to file map
    const filenameToFile = new Map<string, File>();
    pdfFiles.forEach(file => {
      filenameToFile.set(file.name.toLowerCase(), file);
    });

    // Process each mapping row
    const results: ProcessResult[] = [];

    for (const row of mappingRows) {
      // Check if student exists in cohort
      const userId = emailToUserId.get(row.email);
      if (!userId) {
        results.push({
          row,
          success: false,
          error: `Student with email "${row.email}" not found in this cohort`,
        });
        continue;
      }

      // Check if invoice number already exists
      if (existingInvoiceNumbers.has(row.invoice_number)) {
        results.push({
          row,
          success: false,
          error: `Invoice number "${row.invoice_number}" already exists`,
        });
        continue;
      }

      // Find matching PDF file
      const pdfFile = filenameToFile.get(row.filename.toLowerCase());
      if (!pdfFile) {
        results.push({
          row,
          success: false,
          error: `PDF file "${row.filename}" not found in uploaded files`,
        });
        continue;
      }

      // Validate PDF file
      if (pdfFile.type !== 'application/pdf') {
        results.push({
          row,
          success: false,
          error: `File "${row.filename}" is not a valid PDF`,
        });
        continue;
      }

      if (pdfFile.size > 10 * 1024 * 1024) {
        results.push({
          row,
          success: false,
          error: `File "${row.filename}" exceeds 10MB limit`,
        });
        continue;
      }

      try {
        // Generate file path
        const timestamp = Date.now();
        const sanitizedInvoiceNumber = row.invoice_number.replace(/[^a-zA-Z0-9-]/g, '_');
        const filePath = `${cohortId}/${userId}/${timestamp}_${sanitizedInvoiceNumber}.pdf`;

        // Upload PDF to storage
        const fileBuffer = Buffer.from(await pdfFile.arrayBuffer());
        const { data: uploadData, error: uploadError } = await adminClient.storage
          .from('invoices')
          .upload(filePath, fileBuffer, {
            contentType: 'application/pdf',
            upsert: false,
          });

        if (uploadError) {
          results.push({
            row,
            success: false,
            error: `Failed to upload PDF: ${uploadError.message}`,
          });
          continue;
        }

        // Parse due date if provided
        let parsedDueDate: string | null = null;
        if (row.due_date) {
          // Try to parse various date formats
          const dateValue = parseDateValue(row.due_date);
          if (dateValue) {
            parsedDueDate = dateValue;
          }
        }

        // Create invoice record
        const { data: invoice, error: dbError } = await adminClient
          .from('invoices')
          .insert({
            user_id: userId,
            cohort_id: cohortId,
            invoice_number: row.invoice_number,
            amount: row.amount,
            due_date: parsedDueDate,
            payment_type: 'full',
            pdf_path: uploadData.path,
            status: 'pending',
          })
          .select('id')
          .single();

        if (dbError) {
          // Cleanup uploaded file
          await adminClient.storage.from('invoices').remove([filePath]);
          results.push({
            row,
            success: false,
            error: `Failed to create invoice record: ${dbError.message}`,
          });
          continue;
        }

        // Add to existing set to prevent duplicates within batch
        existingInvoiceNumbers.add(row.invoice_number);

        results.push({
          row,
          success: true,
          invoice_id: invoice.id,
        });
      } catch (error) {
        results.push({
          row,
          success: false,
          error: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failedCount = results.filter(r => !r.success).length;

    return NextResponse.json({
      results,
      stats: {
        total: mappingRows.length,
        successful: successCount,
        failed: failedCount,
      },
      parse_errors: parseErrors.length > 0 ? parseErrors : undefined,
      message: `Uploaded ${successCount} invoices. ${failedCount} failed.`,
    });
  } catch (error) {
    console.error('Error in bulk upload:', error);
    return NextResponse.json({ error: 'Failed to process bulk upload' }, { status: 500 });
  }
}

// Helper to find column value with case-insensitive matching
function findColumnValue(row: Record<string, unknown>, possibleNames: string[]): unknown {
  for (const name of possibleNames) {
    // Try exact match first
    if (row[name] !== undefined) return row[name];

    // Try case-insensitive match
    const key = Object.keys(row).find(k => k.toLowerCase() === name.toLowerCase());
    if (key && row[key] !== undefined) return row[key];
  }
  return undefined;
}

// Helper to parse various date formats
function parseDateValue(value: string): string | null {
  // If it's a number (Excel serial date), convert it
  const numValue = Number(value);
  if (!isNaN(numValue) && numValue > 30000 && numValue < 100000) {
    // Excel serial date (days since 1900-01-01)
    const date = new Date((numValue - 25569) * 86400 * 1000);
    return date.toISOString().split('T')[0];
  }

  // Try parsing as date string
  const date = new Date(value);
  if (!isNaN(date.getTime())) {
    return date.toISOString().split('T')[0];
  }

  // Try DD/MM/YYYY or DD-MM-YYYY format
  const parts = value.split(/[-/]/);
  if (parts.length === 3) {
    const [day, month, year] = parts.map(p => parseInt(p));
    if (day && month && year) {
      const parsedDate = new Date(year, month - 1, day);
      if (!isNaN(parsedDate.getTime())) {
        return parsedDate.toISOString().split('T')[0];
      }
    }
  }

  return null;
}
