import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

// Force dynamic rendering - no caching
export const dynamic = 'force-dynamic';

/**
 * POST /api/profile/image
 * Upload a profile image for the authenticated user
 *
 * Accepts multipart form data with a 'file' field
 * - Validates file type (JPEG, PNG, WebP, HEIC/HEIF)
 * - Validates file size (max 5MB)
 * - Uploads to Supabase Storage 'profile-images' bucket via adminClient (bypasses RLS)
 * - Cleans up old avatar files before uploading new one
 * - Updates user profile with new avatar_url (cache-busted)
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type (including HEIC/HEIF for iOS Safari)
    const allowedTypes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
      'image/heic', 'image/heif',
    ];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Allowed: JPEG, PNG, WebP, HEIC.' },
        { status: 400 }
      );
    }

    // Validate file size (5MB max)
    const maxSizeBytes = 5 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 5MB.' },
        { status: 400 }
      );
    }

    // Use admin client for storage + profile operations (bypasses RLS and bucket policies)
    const adminClient = await createAdminClient();

    // Determine file extension and normalize content type
    const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const contentType = file.type === 'image/jpg' ? 'image/jpeg' : file.type;

    // Use consistent path: {user_id}/avatar.{ext} with upsert: true
    const filePath = `${user.id}/avatar.${fileExt}`;

    // Clean up ALL existing avatar files for this user before uploading
    try {
      const { data: existingFiles } = await adminClient.storage
        .from('profile-images')
        .list(user.id);

      if (existingFiles && existingFiles.length > 0) {
        const filesToDelete = existingFiles.map(f => `${user.id}/${f.name}`);
        await adminClient.storage
          .from('profile-images')
          .remove(filesToDelete);
      }
    } catch {
      // Non-critical: old files may not exist, continue with upload
    }

    // Convert File to ArrayBuffer for upload
    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = new Uint8Array(arrayBuffer);

    // Upload to Supabase Storage
    const { error: uploadError } = await adminClient.storage
      .from('profile-images')
      .upload(filePath, fileBuffer, {
        contentType,
        cacheControl: '3600',
        upsert: true,
      });

    if (uploadError) {
      console.error('Error uploading file:', uploadError);
      return NextResponse.json(
        {
          error: 'Failed to upload image',
          details: uploadError.message || uploadError,
        },
        { status: 500 }
      );
    }

    // Get public URL and append cache-buster for immediate display refresh
    const { data: { publicUrl } } = adminClient.storage
      .from('profile-images')
      .getPublicUrl(filePath);

    const cacheBustedUrl = `${publicUrl}?t=${Date.now()}`;

    // Update user profile with avatar URL
    const { error: updateError } = await adminClient
      .from('profiles')
      .update({ avatar_url: cacheBustedUrl })
      .eq('id', user.id);

    if (updateError) {
      console.error('Error updating profile:', updateError);
      // Attempt to clean up the uploaded file
      await adminClient.storage
        .from('profile-images')
        .remove([filePath]);

      return NextResponse.json(
        { error: 'Failed to update profile' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      avatar_url: cacheBustedUrl,
      message: 'Profile image uploaded successfully',
    });
  } catch (error) {
    console.error('Error in POST /api/profile/image:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/profile/image
 * Remove the profile image for the authenticated user
 *
 * - Deletes ALL files in user's storage folder (robust cleanup)
 * - Updates profile to set avatar_url to null
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const adminClient = await createAdminClient();

    // Delete ALL files in user's folder (robust: handles any filename pattern)
    try {
      const { data: existingFiles } = await adminClient.storage
        .from('profile-images')
        .list(user.id);

      if (existingFiles && existingFiles.length > 0) {
        const filesToDelete = existingFiles.map(f => `${user.id}/${f.name}`);
        await adminClient.storage
          .from('profile-images')
          .remove(filesToDelete);
      }
    } catch (storageError) {
      // Log but don't fail — the file might already be deleted
      console.warn('Warning: Could not delete files from storage:', storageError);
    }

    // Update profile to remove avatar URL
    const { error: updateError } = await adminClient
      .from('profiles')
      .update({ avatar_url: null })
      .eq('id', user.id);

    if (updateError) {
      console.error('Error updating profile:', updateError);
      return NextResponse.json(
        { error: 'Failed to update profile' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'Profile image removed successfully',
    });
  } catch (error) {
    console.error('Error in DELETE /api/profile/image:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
