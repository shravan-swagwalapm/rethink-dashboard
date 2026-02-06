import { createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/api/verify-admin';

// Route config for larger metadata handling
export const maxDuration = 30;
export const dynamic = 'force-dynamic';

// Constants
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const SIGNED_URL_EXPIRY = 600; // 10 minutes in seconds

/**
 * POST /api/admin/resources/upload-url
 *
 * Generate a Supabase Storage signed upload URL for direct client-to-storage uploads.
 * This bypasses Vercel's 4.5MB body size limit for large file uploads.
 *
 * Request body:
 * - filename: string (e.g., "presentation.pdf")
 * - fileSize: number (bytes)
 * - contentType: string (e.g., "application/pdf")
 * - cohortId: string (cohort ID or "global")
 *
 * Response:
 * - uploadUrl: string (Supabase signed URL for PUT request)
 * - token: string (upload token for verification)
 * - filePath: string (storage path where file will be stored)
 * - expiresAt: string (ISO timestamp - 10 minutes from now)
 */
export async function POST(request: NextRequest) {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const { filename, fileSize, contentType, cohortId } = body;

    // Validation: Required fields
    if (!filename || !fileSize || !contentType || !cohortId) {
      return NextResponse.json(
        { error: 'Missing required fields: filename, fileSize, contentType, cohortId' },
        { status: 400 }
      );
    }

    // Validation: File size
    if (typeof fileSize !== 'number' || fileSize <= 0) {
      return NextResponse.json(
        { error: 'Invalid file size' },
        { status: 400 }
      );
    }

    if (fileSize > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 400 }
      );
    }

    // Validation: Content type (only PDF for now)
    const allowedTypes = ['application/pdf'];
    if (!allowedTypes.includes(contentType)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only PDF files are allowed.' },
        { status: 400 }
      );
    }

    // Generate storage path
    const isGlobal = cohortId === 'global';
    const storageFolder = isGlobal ? 'global' : cohortId;
    const timestamp = Date.now();
    const sanitizedName = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filePath = `${storageFolder}/${timestamp}_${sanitizedName}`;

    console.log('[Upload URL] Generating signed upload URL:', {
      filename,
      fileSize: `${(fileSize / 1024 / 1024).toFixed(2)} MB`,
      contentType,
      cohortId: storageFolder,
      filePath,
    });

    // Pre-flight check: verify bucket file_size_limit allows this upload
    const adminClient = await createAdminClient();

    const { data: bucket, error: bucketError } = await adminClient
      .schema('storage')
      .from('buckets')
      .select('file_size_limit')
      .eq('id', 'resources')
      .single();

    if (!bucketError && bucket?.file_size_limit && fileSize > bucket.file_size_limit) {
      const bucketLimitMB = Math.round(bucket.file_size_limit / 1024 / 1024);
      console.error('[Upload URL] File exceeds bucket limit:', {
        fileSize: `${(fileSize / 1024 / 1024).toFixed(2)} MB`,
        bucketLimit: `${bucketLimitMB} MB`,
      });
      return NextResponse.json(
        {
          error: `File too large for storage. The storage bucket limit is ${bucketLimitMB}MB. Please contact admin to increase the limit via: UPDATE storage.buckets SET file_size_limit = 104857600 WHERE id = 'resources';`,
        },
        { status: 400 }
      );
    }

    // Generate signed upload URL
    const { data, error } = await adminClient.storage
      .from('resources')
      .createSignedUploadUrl(filePath);

    if (error || !data) {
      console.error('[Upload URL] Failed to create signed URL:', error);
      return NextResponse.json(
        {
          error: 'Failed to generate upload URL',
          details: error?.message
        },
        { status: 500 }
      );
    }

    const expiresAt = new Date(Date.now() + SIGNED_URL_EXPIRY * 1000).toISOString();

    console.log('[Upload URL] Signed URL generated successfully:', {
      filePath: data.path,
      expiresAt,
      urlPrefix: data.signedUrl.substring(0, 80) + '...',
    });

    return NextResponse.json({
      uploadUrl: data.signedUrl,
      token: data.token,
      filePath: data.path,
      expiresAt,
    });

  } catch (error) {
    console.error('[Upload URL] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        error: 'Failed to generate upload URL',
        details: errorMessage
      },
      { status: 500 }
    );
  }
}
