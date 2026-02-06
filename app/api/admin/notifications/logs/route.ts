import { createClient } from '@/lib/supabase/server';
import { verifyAdmin } from '@/lib/api/verify-admin';
import { NextRequest, NextResponse } from 'next/server';
import { sanitizeFilterValue } from '@/lib/api/sanitize';

// GET - Fetch logs with filtering & pagination
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAdmin();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const supabase = await createClient();

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const status = searchParams.get('status');
    const jobId = searchParams.get('job_id');
    const recipient = searchParams.get('recipient');
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    const offset = (page - 1) * limit;

    // Build query
    let query = supabase
      .from('notification_logs')
      .select(`
        *,
        notification_jobs (
          template_id,
          channel,
          notification_templates (
            name
          )
        )
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply filters
    if (status) {
      query = query.eq('event_type', status);
    }

    if (jobId) {
      query = query.eq('job_id', jobId);
    }

    if (recipient) {
      const safeRecipient = sanitizeFilterValue(recipient);
      query = query.or(`recipient_email.ilike.%${safeRecipient}%,recipient_phone.ilike.%${safeRecipient}%`);
    }

    if (from) {
      query = query.gte('created_at', from);
    }

    if (to) {
      query = query.lte('created_at', to);
    }

    const { data, error, count } = await query;

    if (error) throw error;

    return NextResponse.json(
      {
        data: data || [],
        total: count || 0,
        page,
        limit,
        total_pages: Math.ceil((count || 0) / limit),
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error fetching logs:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch logs' },
      { status: 500 }
    );
  }
}
