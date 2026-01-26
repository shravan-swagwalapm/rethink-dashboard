import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import Papa from 'papaparse';

interface ParsedContact {
  email?: string;
  phone?: string;
  name?: string;
  metadata?: Record<string, any>;
}

interface ValidationResult {
  valid: ParsedContact[];
  invalid: Array<{
    row: number;
    data: any;
    errors: string[];
  }>;
}

function validateContact(contact: any, rowIndex: number): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  // At least email or phone must be provided
  if (!contact.email && !contact.phone) {
    errors.push('Either email or phone is required');
  }

  // Validate email format if provided
  if (contact.email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(contact.email)) {
      errors.push('Invalid email format');
    }
  }

  // Validate phone format if provided (basic validation)
  if (contact.phone) {
    const phoneRegex = /^[\d\s\-\+\(\)]+$/;
    if (!phoneRegex.test(contact.phone)) {
      errors.push('Invalid phone format');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

// POST - Parse and validate CSV (preview mode)
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
    const { csv_content, list_id } = body;

    if (!csv_content) {
      return NextResponse.json(
        { error: 'CSV content is required' },
        { status: 400 }
      );
    }

    // Validate list exists if provided
    if (list_id) {
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
    }

    // Parse CSV
    const parseResult = Papa.parse(csv_content, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header: string) => header.toLowerCase().trim(),
    });

    if (parseResult.errors.length > 0) {
      return NextResponse.json(
        { error: 'CSV parsing failed', details: parseResult.errors },
        { status: 400 }
      );
    }

    const validationResult: ValidationResult = {
      valid: [],
      invalid: [],
    };

    // Validate each row
    parseResult.data.forEach((row: any, index: number) => {
      const contact: ParsedContact = {
        email: row.email?.trim() || undefined,
        phone: row.phone?.trim() || undefined,
        name: row.name?.trim() || undefined,
        metadata: {},
      };

      // Collect any extra fields into metadata
      Object.keys(row).forEach((key) => {
        if (!['email', 'phone', 'name'].includes(key) && row[key]) {
          contact.metadata![key] = row[key];
        }
      });

      const validation = validateContact(contact, index + 1);

      if (validation.isValid) {
        validationResult.valid.push(contact);
      } else {
        validationResult.invalid.push({
          row: index + 2, // +2 because of header row and 0-index
          data: row,
          errors: validation.errors,
        });
      }
    });

    return NextResponse.json(
      {
        data: {
          valid: validationResult.valid,
          invalid: validationResult.invalid,
          total: parseResult.data.length,
          valid_count: validationResult.valid.length,
          invalid_count: validationResult.invalid.length,
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error parsing CSV:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to parse CSV' },
      { status: 500 }
    );
  }
}

// PUT - Confirm import after preview
export async function PUT(request: NextRequest) {
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
    const { list_id, contacts } = body;

    if (!list_id || !contacts || !Array.isArray(contacts)) {
      return NextResponse.json(
        { error: 'List ID and contacts array are required' },
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

    // Check for existing contacts to avoid duplicates
    const emails = contacts.filter((c) => c.email).map((c) => c.email);
    const phones = contacts.filter((c) => c.phone).map((c) => c.phone);

    let existingContacts: any[] = [];
    if (emails.length > 0 || phones.length > 0) {
      const { data } = await supabase
        .from('contacts')
        .select('email, phone')
        .eq('list_id', list_id)
        .or(`email.in.(${emails.join(',')}),phone.in.(${phones.join(',')})`);

      existingContacts = data || [];
    }

    // Filter out duplicates
    const existingEmailSet = new Set(existingContacts.map((c) => c.email));
    const existingPhoneSet = new Set(existingContacts.map((c) => c.phone));

    const newContacts = contacts.filter((contact) => {
      if (contact.email && existingEmailSet.has(contact.email)) return false;
      if (contact.phone && existingPhoneSet.has(contact.phone)) return false;
      return true;
    });

    // Prepare contacts for insertion
    const contactsToInsert = newContacts.map((contact) => ({
      list_id,
      email: contact.email || null,
      phone: contact.phone || null,
      name: contact.name || null,
      metadata: contact.metadata || {},
    }));

    let imported = 0;
    let failed = 0;

    // Batch insert (chunks of 100)
    const chunkSize = 100;
    for (let i = 0; i < contactsToInsert.length; i += chunkSize) {
      const chunk = contactsToInsert.slice(i, i + chunkSize);

      try {
        const { data, error } = await supabase
          .from('contacts')
          .insert(chunk)
          .select();

        if (error) {
          console.error('Error inserting chunk:', error);
          failed += chunk.length;
        } else {
          imported += data?.length || 0;
        }
      } catch (error) {
        console.error('Error in batch insert:', error);
        failed += chunk.length;
      }
    }

    return NextResponse.json(
      {
        data: {
          imported,
          failed,
          skipped_duplicates: contacts.length - newContacts.length,
          total: contacts.length,
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error importing contacts:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to import contacts' },
      { status: 500 }
    );
  }
}
