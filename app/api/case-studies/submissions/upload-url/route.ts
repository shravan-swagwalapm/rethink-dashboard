import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 30;
export const dynamic = 'force-dynamic';

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const SIGNED_URL_EXPIRY = 600; // 10 minutes

const ALLOWED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
];

/**
 * POST /api/case-studies/submissions/upload-url
 *
 * Get a signed upload URL for student submission files.
 * Adapted from admin upload-url route but with student auth (not admin-only).
 *
 * Body: { filename, fileSize, contentType, cohortId }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { filename, fileSize, contentType, cohortId } = body;

    if (!filename || !fileSize || !contentType || !cohortId) {
      return NextResponse.json(
        { error: 'Missing required fields: filename, fileSize, contentType, cohortId' },
        { status: 400 }
      );
    }

    if (typeof fileSize !== 'number' || fileSize <= 0 || fileSize > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `Invalid file size. Maximum is ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 400 }
      );
    }

    if (!ALLOWED_TYPES.includes(contentType)) {
      return NextResponse.json(
        { error: 'Invalid file type. Allowed: PDF, DOC, DOCX, PPT, PPTX' },
        { status: 400 }
      );
    }

    const adminClient = await createAdminClient();

    // Verify user belongs to this cohort
    const { data: roleAssignment } = await adminClient
      .from('user_role_assignments')
      .select('id')
      .eq('user_id', user.id)
      .eq('cohort_id', cohortId)
      .limit(1)
      .maybeSingle();

    if (!roleAssignment) {
      // Fallback: legacy profiles.cohort_id
      const { data: profile } = await adminClient
        .from('profiles')
        .select('cohort_id')
        .eq('id', user.id)
        .single();

      if (!profile?.cohort_id || profile.cohort_id !== cohortId) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    // Generate storage path under submissions folder
    const timestamp = Date.now();
    const sanitizedName = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filePath = `case-studies/${cohortId}/submissions/${timestamp}_${sanitizedName}`;

    const { data, error } = await adminClient.storage
      .from('resources')
      .createSignedUploadUrl(filePath);

    if (error || !data) {
      console.error('[Student Upload URL] Failed:', error);
      return NextResponse.json({ error: 'Failed to generate upload URL' }, { status: 500 });
    }

    return NextResponse.json({
      uploadUrl: data.signedUrl,
      token: data.token,
      filePath: data.path,
      expiresAt: new Date(Date.now() + SIGNED_URL_EXPIRY * 1000).toISOString(),
    });
  } catch (error) {
    console.error('[Student Upload URL] Error:', error);
    return NextResponse.json({ error: 'Failed to generate upload URL' }, { status: 500 });
  }
}
