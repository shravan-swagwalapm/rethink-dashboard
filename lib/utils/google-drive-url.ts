/**
 * Google Drive URL Handler
 *
 * Utilities for extracting Google Drive file IDs and generating
 * streaming URLs with fallback support for iframe embeds.
 */

export interface GoogleDriveUrlResult {
  url: string;
  method: 'direct' | 'iframe';
  fileId: string;
}

/**
 * Extract Google Drive file ID from various URL formats
 *
 * Supported formats:
 * - https://drive.google.com/file/d/FILE_ID/view
 * - https://drive.google.com/file/d/FILE_ID/preview
 * - https://drive.google.com/open?id=FILE_ID
 * - https://drive.google.com/uc?id=FILE_ID
 * - FILE_ID (direct ID)
 */
export function extractGoogleDriveId(url: string): string | null {
  if (!url) return null;

  // Remove whitespace
  url = url.trim();

  // If it's already just an ID (no slashes or dots), return it
  if (!url.includes('/') && !url.includes('.')) {
    return url;
  }

  // Pattern 1: /file/d/FILE_ID/
  const filePattern = /\/file\/d\/([a-zA-Z0-9_-]+)/;
  const fileMatch = url.match(filePattern);
  if (fileMatch) {
    return fileMatch[1];
  }

  // Pattern 2: ?id=FILE_ID or &id=FILE_ID
  const idPattern = /[?&]id=([a-zA-Z0-9_-]+)/;
  const idMatch = url.match(idPattern);
  if (idMatch) {
    return idMatch[1];
  }

  // Pattern 3: /d/FILE_ID (generic)
  const genericPattern = /\/d\/([a-zA-Z0-9_-]+)/;
  const genericMatch = url.match(genericPattern);
  if (genericMatch) {
    return genericMatch[1];
  }

  return null;
}

/**
 * Generate optimal video URL for Google Drive content
 *
 * Returns a direct streaming URL if possible, with iframe fallback
 */
export function getGoogleDriveVideoUrl(
  googleDriveId: string,
  useDirectStreaming: boolean = true
): GoogleDriveUrlResult {
  if (!googleDriveId) {
    throw new Error('Google Drive ID is required');
  }

  // Extract ID if a full URL was provided
  const fileId = extractGoogleDriveId(googleDriveId) || googleDriveId;

  if (useDirectStreaming) {
    // Direct streaming URL - faster and supports Video.js controls
    // The "confirm=t" parameter bypasses the "file is too large" warning
    return {
      url: `https://drive.google.com/uc?export=media&id=${fileId}&confirm=t`,
      method: 'direct',
      fileId,
    };
  }

  // Fallback to iframe embed
  return {
    url: `https://drive.google.com/file/d/${fileId}/preview`,
    method: 'iframe',
    fileId,
  };
}

/**
 * Test if a Google Drive video URL is accessible
 *
 * Performs a HEAD request to check if the video can be streamed
 * Useful for validating URLs before saving them to the database
 */
export async function testGoogleDriveUrl(googleDriveId: string): Promise<{
  accessible: boolean;
  method: 'direct' | 'iframe' | 'error';
  error?: string;
}> {
  try {
    const fileId = extractGoogleDriveId(googleDriveId) || googleDriveId;
    const directUrl = `https://drive.google.com/uc?export=media&id=${fileId}&confirm=t`;

    // Try HEAD request to check if direct streaming works
    const response = await fetch(directUrl, {
      method: 'HEAD',
      cache: 'no-cache',
    });

    if (response.ok) {
      return {
        accessible: true,
        method: 'direct',
      };
    }

    // If direct doesn't work, assume iframe will work
    // (we can't test iframe easily from client-side)
    return {
      accessible: true,
      method: 'iframe',
    };
  } catch (error) {
    return {
      accessible: false,
      method: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get thumbnail URL for Google Drive video
 */
export function getGoogleDriveThumbnail(googleDriveId: string): string {
  const fileId = extractGoogleDriveId(googleDriveId) || googleDriveId;
  return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;
}

/**
 * Convert Google Drive video to different quality if multiple versions exist
 *
 * @param qualityVariants - Object mapping quality labels to Drive IDs
 * @param preferredQuality - Desired quality (e.g., '1080p', '720p', '480p')
 * @returns Google Drive ID for the preferred quality, or highest available
 */
export function selectQualityVariant(
  qualityVariants: Record<string, string>,
  preferredQuality?: string
): string {
  if (!qualityVariants || Object.keys(qualityVariants).length === 0) {
    throw new Error('No quality variants available');
  }

  // If preferred quality exists, use it
  if (preferredQuality && qualityVariants[preferredQuality]) {
    return qualityVariants[preferredQuality];
  }

  // Otherwise, return highest quality available
  const qualityOrder = ['2160p', '1440p', '1080p', '720p', '480p', '360p', '240p'];

  for (const quality of qualityOrder) {
    if (qualityVariants[quality]) {
      return qualityVariants[quality];
    }
  }

  // Fallback to first available
  return Object.values(qualityVariants)[0];
}
