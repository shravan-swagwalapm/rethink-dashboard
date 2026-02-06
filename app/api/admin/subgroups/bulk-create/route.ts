import { createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/api/verify-admin';

// POST - Auto-create N subgroups with sequential names
export async function POST(request: NextRequest) {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const { cohort_id, count, prefix } = body;

    if (!cohort_id || !count || count < 1 || count > 20) {
      return NextResponse.json({ error: 'cohort_id and count (1-20) are required' }, { status: 400 });
    }

    const namePrefix = prefix?.trim() || 'Subgroup';
    const adminClient = await createAdminClient();

    // Get existing subgroup names to avoid conflicts
    const { data: existing } = await adminClient
      .from('subgroups')
      .select('name')
      .eq('cohort_id', cohort_id);

    const existingNames = new Set((existing || []).map(s => s.name));

    const rows = [];
    let num = 1;
    while (rows.length < count) {
      const name = `${namePrefix} ${num}`;
      if (!existingNames.has(name)) {
        rows.push({ cohort_id, name });
      }
      num++;
      if (num > count + existingNames.size + 10) break; // Safety limit
    }

    const { data, error } = await adminClient
      .from('subgroups')
      .insert(rows)
      .select();

    if (error) throw error;

    return NextResponse.json({ created: data?.length || 0, subgroups: data }, { status: 201 });
  } catch (error) {
    console.error('Error bulk creating subgroups:', error);
    return NextResponse.json({ error: 'Failed to create subgroups' }, { status: 500 });
  }
}
