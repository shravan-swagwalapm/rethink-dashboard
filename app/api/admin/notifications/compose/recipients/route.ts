import { createAdminClient } from '@/lib/supabase/server';
import { verifyAdmin } from '@/lib/api/verify-admin';
import { NextRequest, NextResponse } from 'next/server';

// POST - Count recipients without creating job
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAdmin();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const supabase = await createAdminClient();

    const body = await request.json();
    const { cohort_ids, user_ids, contact_list_ids, emails } = body;

    const recipientList: string[] = [];
    const sampleRecipients: string[] = [];

    // Count cohort members
    if (cohort_ids && cohort_ids.length > 0) {
      const { data: cohortMembers } = await supabase
        .from('profiles')
        .select('email')
        .in('cohort_id', cohort_ids)
        .not('email', 'is', null);

      if (cohortMembers) {
        cohortMembers.forEach((member) => {
          if (member.email) {
            recipientList.push(member.email);
          }
        });
      }
    }

    // Count individual users
    if (user_ids && user_ids.length > 0) {
      const { data: users } = await supabase
        .from('profiles')
        .select('email')
        .in('id', user_ids)
        .not('email', 'is', null);

      if (users) {
        users.forEach((u) => {
          if (u.email) {
            recipientList.push(u.email);
          }
        });
      }
    }

    // Count contacts from lists
    if (contact_list_ids && contact_list_ids.length > 0) {
      const { data: contacts } = await supabase
        .from('contacts')
        .select('email')
        .in('list_id', contact_list_ids)
        .eq('unsubscribed', false)
        .not('email', 'is', null);

      if (contacts) {
        contacts.forEach((contact) => {
          if (contact.email) {
            recipientList.push(contact.email);
          }
        });
      }
    }

    // Add manual emails
    if (emails && emails.length > 0) {
      emails.forEach((email: string) => {
        if (email?.trim()) {
          recipientList.push(email.trim());
        }
      });
    }

    // Remove duplicates
    const uniqueRecipients = [...new Set(recipientList)];

    // Get sample of first 5 recipients
    const sample = uniqueRecipients.slice(0, 5);

    return NextResponse.json(
      {
        data: {
          count: uniqueRecipients.length,
          sample,
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error counting recipients:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to count recipients' },
      { status: 500 }
    );
  }
}
