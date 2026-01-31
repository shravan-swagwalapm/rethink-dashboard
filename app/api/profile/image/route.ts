import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Force dynamic rendering - no caching
export const dynamic = 'force-dynamic';

/**
 * POST /api/profile/image
 * Upload a profile image for the authenticated user
 *
 * Accepts multipart form data with a 'file' field
 * - Validates file type (JPEG, JPG, PNG, WebP only)
 * - Validates file size (max 5MB)
 * - Uploads to Supabase Storage 'profile-images' bucket
 * - Updates user profile with new avatar_url
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

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only JPEG, PNG, and WebP are allowed.' },
        { status: 400 }
      );
    }

    // Validate file size (5MB max)
    const maxSizeBytes = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSizeBytes) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 5MB.' },
        { status: 400 }
      );
    }

    // Generate unique filename
    const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const fileName = `${user.id}-${Date.now()}.${fileExt}`;
    const filePath = `${user.id}/${fileName}`;

    // Convert File to ArrayBuffer for upload
    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = new Uint8Array(arrayBuffer);

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('profile-images')
      .upload(filePath, fileBuffer, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('Error uploading file:', uploadError);
      return NextResponse.json(
        {
          error: 'Failed to upload image',
          details: uploadError.message || uploadError,
          hint: 'Check Supabase storage bucket policies'
        },
        { status: 500 }
      );
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('profile-images')
      .getPublicUrl(filePath);

    // Update user profile with avatar URL
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ avatar_url: publicUrl })
      .eq('id', user.id);

    if (updateError) {
      console.error('Error updating profile:', updateError);
      // Attempt to clean up the uploaded file
      await supabase.storage
        .from('profile-images')
        .remove([filePath]);

      return NextResponse.json(
        { error: 'Failed to update profile' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      avatar_url: publicUrl,
      message: 'Profile image uploaded successfully'
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
 * - Gets current avatar_url from profile
 * - Extracts file path from URL
 * - Deletes from Supabase Storage
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

    // Get current avatar URL from profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('avatar_url')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('Error fetching profile:', profileError);
      return NextResponse.json(
        { error: 'Failed to fetch profile' },
        { status: 500 }
      );
    }

    // If there's an existing avatar, try to delete it from storage
    if (profile?.avatar_url) {
      try {
        // Extract file path from URL
        // URL format: https://{project}.supabase.co/storage/v1/object/public/profile-images/{user_id}/{filename}
        const url = new URL(profile.avatar_url);
        const pathParts = url.pathname.split('/profile-images/');

        if (pathParts.length === 2) {
          const filePath = decodeURIComponent(pathParts[1]);

          // Delete from storage
          const { error: deleteError } = await supabase.storage
            .from('profile-images')
            .remove([filePath]);

          if (deleteError) {
            // Log but don't fail the request - the file might already be deleted
            console.warn('Warning: Could not delete file from storage:', deleteError);
          }
        }
      } catch (urlError) {
        // Log but don't fail if URL parsing fails
        console.warn('Warning: Could not parse avatar URL:', urlError);
      }
    }

    // Update profile to remove avatar URL
    const { error: updateError } = await supabase
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
      message: 'Profile image removed successfully'
    });
  } catch (error) {
    console.error('Error in DELETE /api/profile/image:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
