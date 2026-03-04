import { createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/api/verify-admin';

/**
 * GET /api/admin/resources/signed-url?path=xxx
 *
 * Generates a signed download URL for a file in the resources bucket.
 * Admin only.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAdmin();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const filePath = searchParams.get('path');

    if (!filePath) {
      return NextResponse.json({ error: 'path query param is required' }, { status: 400 });
    }

    const adminClient = await createAdminClient();

    const { data, error } = await adminClient.storage
      .from('resources')
      .createSignedUrl(filePath, 3600); // 1 hour

    if (error || !data) {
      console.error('[Admin SignedURL] Failed:', error);
      return NextResponse.json({ error: 'Failed to generate signed URL' }, { status: 500 });
    }

    return NextResponse.json({ signedUrl: data.signedUrl });
  } catch (error) {
    console.error('Error generating signed URL:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
