import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// Helper to verify admin access
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

  if (profile?.role !== 'admin') {
    return { authorized: false, error: 'Forbidden', status: 403 };
  }

  return { authorized: true, userId: user.id };
}

// GET - Preview cohort members that would be imported
export async function GET(request: NextRequest) {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { searchParams } = new URL(request.url);
    const cohortId = searchParams.get('cohort_id');
    const listId = searchParams.get('list_id');

    if (!cohortId) {
      return NextResponse.json({ error: 'Cohort ID is required' }, { status: 400 });
    }

    const adminClient = await createAdminClient();

    // Fetch cohort members (profiles with this cohort_id)
    const { data: members, error: membersError } = await adminClient
      .from('profiles')
      .select('id, email, full_name, phone')
      .eq('cohort_id', cohortId)
      .order('full_name', { ascending: true });

    if (membersError) throw membersError;

    // Also check user_role_assignments for users in this cohort
    const { data: assignments } = await adminClient
      .from('user_role_assignments')
      .select('user_id, profiles!inner(id, email, full_name, phone)')
      .eq('cohort_id', cohortId);

    // Combine both sources, dedupe by user ID
    const allMembers = new Map<string, any>();

    (members || []).forEach(m => {
      if (m.email) {
        allMembers.set(m.id, m);
      }
    });

    (assignments || []).forEach((a: any) => {
      if (a.profiles && a.profiles.email && !allMembers.has(a.profiles.id)) {
        allMembers.set(a.profiles.id, a.profiles);
      }
    });

    const uniqueMembers = Array.from(allMembers.values());

    // If list_id provided, check for duplicates
    let duplicateCount = 0;
    if (listId) {
      const { data: existingContacts } = await adminClient
        .from('contacts')
        .select('email')
        .eq('list_id', listId);

      const existingEmails = new Set(
        (existingContacts || []).map(c => c.email?.toLowerCase())
      );

      duplicateCount = uniqueMembers.filter(m =>
        existingEmails.has(m.email?.toLowerCase())
      ).length;
    }

    // Fetch cohort details
    const { data: cohort } = await adminClient
      .from('cohorts')
      .select('name')
      .eq('id', cohortId)
      .single();

    return NextResponse.json({
      data: {
        cohort_name: cohort?.name || 'Unknown Cohort',
        total_members: uniqueMembers.length,
        members_with_email: uniqueMembers.filter(m => m.email).length,
        members_with_phone: uniqueMembers.filter(m => m.phone).length,
        duplicate_count: duplicateCount,
        new_imports: uniqueMembers.length - duplicateCount,
        preview: uniqueMembers.slice(0, 10).map(m => ({
          name: m.full_name,
          email: m.email,
          phone: m.phone,
        })),
      },
    });
  } catch (error: any) {
    console.error('Error previewing cohort import:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to preview cohort' },
      { status: 500 }
    );
  }
}

// POST - Import cohort members to contact list
export async function POST(request: NextRequest) {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const { list_id, cohort_id, skip_duplicates = true } = body;

    if (!list_id || !cohort_id) {
      return NextResponse.json(
        { error: 'list_id and cohort_id are required' },
        { status: 400 }
      );
    }

    const adminClient = await createAdminClient();

    // Verify contact list exists
    const { data: contactList, error: listError } = await adminClient
      .from('contact_lists')
      .select('id, name')
      .eq('id', list_id)
      .single();

    if (listError || !contactList) {
      return NextResponse.json(
        { error: 'Contact list not found' },
        { status: 404 }
      );
    }

    // Fetch cohort members
    const { data: members } = await adminClient
      .from('profiles')
      .select('id, email, full_name, phone')
      .eq('cohort_id', cohort_id);

    // Also check user_role_assignments
    const { data: assignments } = await adminClient
      .from('user_role_assignments')
      .select('user_id, profiles!inner(id, email, full_name, phone)')
      .eq('cohort_id', cohort_id);

    // Combine and dedupe
    const allMembers = new Map<string, any>();

    (members || []).forEach(m => {
      if (m.email) {
        allMembers.set(m.id, m);
      }
    });

    (assignments || []).forEach((a: any) => {
      if (a.profiles && a.profiles.email && !allMembers.has(a.profiles.id)) {
        allMembers.set(a.profiles.id, a.profiles);
      }
    });

    const uniqueMembers = Array.from(allMembers.values());

    if (uniqueMembers.length === 0) {
      return NextResponse.json({
        data: {
          imported: 0,
          skipped: 0,
          errors: [],
          message: 'No members with email addresses found in this cohort',
        },
      });
    }

    // Get existing contacts to check duplicates
    const { data: existingContacts } = await adminClient
      .from('contacts')
      .select('email, phone')
      .eq('list_id', list_id);

    const existingEmails = new Set(
      (existingContacts || []).map(c => c.email?.toLowerCase()).filter(Boolean)
    );
    const existingPhones = new Set(
      (existingContacts || []).map(c => c.phone).filter(Boolean)
    );

    // Prepare contacts for insertion
    const contactsToInsert: any[] = [];
    let skipped = 0;

    for (const member of uniqueMembers) {
      const emailLower = member.email?.toLowerCase();
      const isDuplicate =
        (emailLower && existingEmails.has(emailLower)) ||
        (member.phone && existingPhones.has(member.phone));

      if (isDuplicate && skip_duplicates) {
        skipped++;
        continue;
      }

      contactsToInsert.push({
        list_id,
        email: member.email,
        phone: member.phone || null,
        name: member.full_name || null,
        metadata: {
          source: 'cohort_import',
          source_cohort_id: cohort_id,
          source_user_id: member.id,
          imported_at: new Date().toISOString(),
        },
      });
    }

    // Insert in batches of 100
    const batchSize = 100;
    let imported = 0;
    const errors: string[] = [];

    for (let i = 0; i < contactsToInsert.length; i += batchSize) {
      const batch = contactsToInsert.slice(i, i + batchSize);
      const { data, error } = await adminClient
        .from('contacts')
        .insert(batch)
        .select('id');

      if (error) {
        errors.push(`Batch ${Math.floor(i / batchSize) + 1}: ${error.message}`);
      } else {
        imported += data?.length || 0;
      }
    }

    // Fetch cohort name for message
    const { data: cohort } = await adminClient
      .from('cohorts')
      .select('name')
      .eq('id', cohort_id)
      .single();

    return NextResponse.json({
      data: {
        imported,
        skipped,
        total_members: uniqueMembers.length,
        errors,
        message: errors.length > 0
          ? `Imported ${imported} contacts with ${errors.length} errors`
          : `Successfully imported ${imported} contacts from ${cohort?.name || 'cohort'}`,
      },
    });
  } catch (error: any) {
    console.error('Error importing cohort:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to import cohort' },
      { status: 500 }
    );
  }
}
