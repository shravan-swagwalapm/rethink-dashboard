/**
 * YouTube URL Handler
 *
 * Utilities for extracting YouTube video IDs and generating
 * proper embed URLs for iframe embedding.
 */

/**
 * Extract YouTube video ID from any URL format
 *
 * Supported formats:
 * - https://www.youtube.com/watch?v=VIDEO_ID
 * - https://youtu.be/VIDEO_ID
 * - https://www.youtube.com/embed/VIDEO_ID
 * - https://www.youtube.com/v/VIDEO_ID
 * - https://www.youtube.com/watch?v=VIDEO_ID&list=...
 * - https://www.youtube.com/shorts/VIDEO_ID
 */
export function extractYouTubeId(url: string): string | null {
  if (!url) return null;

  url = url.trim();

  // YouTube video IDs are exactly 11 characters
  const patterns = [
    // Standard watch URL: youtube.com/watch?v=VIDEO_ID
    /(?:youtube\.com\/watch\?v=|youtube\.com\/watch\?.*&v=)([a-zA-Z0-9_-]{11})/,
    // Short URL: youtu.be/VIDEO_ID
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    // Embed URL: youtube.com/embed/VIDEO_ID
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    // Old embed URL: youtube.com/v/VIDEO_ID
    /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,
    // Shorts URL: youtube.com/shorts/VIDEO_ID
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  return null;
}

/**
 * Check if URL is from YouTube
 */
export function isYouTubeUrl(url: string): boolean {
  if (!url) return false;
  const lowerUrl = url.toLowerCase();
  return lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be');
}

/**
 * Convert any YouTube URL to proper embed format
 *
 * Parameters added:
 * - rel=0: Don't show related videos from other channels
 * - modestbranding=1: Minimal YouTube branding
 * - enablejsapi=1: Enable JavaScript API for player control
 */
export function getYouTubeEmbedUrl(url: string): string {
  const videoId = extractYouTubeId(url);
  if (!videoId) return url;

  return `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1&enablejsapi=1`;
}

/**
 * Get YouTube thumbnail URL
 *
 * Available sizes:
 * - default.jpg: 120x90
 * - mqdefault.jpg: 320x180
 * - hqdefault.jpg: 480x360
 * - sddefault.jpg: 640x480
 * - maxresdefault.jpg: 1280x720 (not always available)
 */
export function getYouTubeThumbnail(
  url: string,
  size: 'default' | 'mq' | 'hq' | 'sd' | 'maxres' = 'hq'
): string | null {
  const videoId = extractYouTubeId(url);
  if (!videoId) return null;

  const sizeMap = {
    default: 'default',
    mq: 'mqdefault',
    hq: 'hqdefault',
    sd: 'sddefault',
    maxres: 'maxresdefault',
  };

  return `https://img.youtube.com/vi/${videoId}/${sizeMap[size]}.jpg`;
}

/**
 * Get direct YouTube watch URL from any format
 */
export function getYouTubeWatchUrl(url: string): string | null {
  const videoId = extractYouTubeId(url);
  if (!videoId) return null;

  return `https://www.youtube.com/watch?v=${videoId}`;
}
