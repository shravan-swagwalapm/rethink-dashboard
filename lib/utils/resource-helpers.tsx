/**
 * Resource Helper Utilities
 *
 * Reusable functions for handling module resources across admin and student views.
 * Supports YouTube videos, uploaded PDFs (Supabase Storage), and legacy Google Drive content.
 */

import type { ModuleResourceType, ModuleResource } from '@/types';
import { Video, Presentation, FileText, Link2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  isYouTubeUrl,
  getYouTubeEmbedUrl,
  getYouTubeWatchUrl,
} from '@/lib/utils/youtube-url';

/**
 * Get icon component for content type
 */
export function getContentIcon(type: ModuleResourceType, className?: string) {
  const iconClass = cn('w-5 h-5', className);
  switch (type) {
    case 'video':
      return <Video className={iconClass} />;
    case 'slides':
      return <Presentation className={iconClass} />;
    case 'document':
      return <FileText className={iconClass} />;
    default:
      return <Link2 className={iconClass} />;
  }
}

/**
 * Get human-readable label for content type
 */
export function getContentTypeLabel(type: ModuleResourceType): string {
  switch (type) {
    case 'video':
      return 'Recording';
    case 'slides':
      return 'Presentation';
    case 'document':
      return 'Document';
    case 'link':
      return 'Link';
    default:
      return 'Resource';
  }
}

/**
 * Get gradient colors for content type (used for icon backgrounds)
 */
export function getContentGradient(type: ModuleResourceType): {
  from: string;
  to: string;
  bg: string;
} {
  switch (type) {
    case 'video':
      return {
        from: 'from-purple-500',
        to: 'to-purple-600',
        bg: 'bg-purple-500/10',
      };
    case 'slides':
      return {
        from: 'from-orange-500',
        to: 'to-orange-600',
        bg: 'bg-orange-500/10',
      };
    case 'document':
      return {
        from: 'from-blue-500',
        to: 'to-blue-600',
        bg: 'bg-blue-500/10',
      };
    default:
      return {
        from: 'from-gray-500',
        to: 'to-gray-600',
        bg: 'bg-gray-500/10',
      };
  }
}

/**
 * Get embed URL for iframe rendering
 *
 * For YouTube videos: Returns embed URL
 * For PDFs: Returns empty string (signed URL fetched separately)
 * For legacy Google Drive: Returns Drive embed URL
 */
export function getEmbedUrl(resource: ModuleResource): string {
  // For videos: Check YouTube first
  if (resource.content_type === 'video') {
    if (resource.external_url && isYouTubeUrl(resource.external_url)) {
      return getYouTubeEmbedUrl(resource.external_url);
    }
    // Legacy: Google Drive video fallback
    if (resource.google_drive_id) {
      return `https://drive.google.com/file/d/${resource.google_drive_id}/preview?t=${Date.now()}`;
    }
    return resource.external_url || '';
  }

  // For PDFs with file_path: Return empty string - will be fetched async via signed URL
  if (resource.file_path) {
    return ''; // Handled separately with async signed URL fetch
  }

  // Legacy: Google Drive fallback for slides/documents
  const id = resource.google_drive_id;
  if (id) {
    switch (resource.content_type) {
      case 'slides':
        return `https://docs.google.com/presentation/d/${id}/embed?start=false&loop=false&delayms=3000`;
      case 'document':
        return `https://docs.google.com/document/d/${id}/preview`;
    }
  }

  return resource.external_url || '';
}

/**
 * Get direct view URL for opening in new tab
 *
 * For YouTube videos: Returns watch URL
 * For Google Drive: Returns Drive editor URL
 * For PDFs: Use signed URL endpoint (not this function)
 */
export function getDirectViewUrl(resource: ModuleResource): string {
  // For YouTube videos
  if (
    resource.content_type === 'video' &&
    resource.external_url &&
    isYouTubeUrl(resource.external_url)
  ) {
    return getYouTubeWatchUrl(resource.external_url) || resource.external_url;
  }

  // Legacy: Google Drive
  const id = resource.google_drive_id;
  if (id) {
    switch (resource.content_type) {
      case 'video':
        return `https://drive.google.com/file/d/${id}/view`;
      case 'slides':
        return `https://docs.google.com/presentation/d/${id}/edit?usp=sharing`;
      case 'document':
        return `https://docs.google.com/document/d/${id}/edit?usp=sharing`;
    }
  }

  return resource.external_url || '';
}

/**
 * Check if resource has an uploaded PDF file
 *
 * Returns true for resources with file_path (uploaded to Supabase Storage)
 * Videos can't have uploaded files (only YouTube URLs)
 */
export function hasUploadedFile(resource: ModuleResource): boolean {
  return !!resource.file_path && resource.content_type !== 'video';
}

/**
 * Format duration in seconds to human-readable string
 *
 * Examples:
 * - 45 seconds → "45s"
 * - 3600 seconds → "1h 0m"
 * - 5430 seconds → "1h 30m"
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  return `${minutes}m`;
}
