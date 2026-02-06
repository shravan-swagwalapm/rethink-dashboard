import { Video, Presentation, FileText, Link2 } from 'lucide-react';
import { createElement } from 'react';
import type { ModuleResource } from '@/types';

export const GLOBAL_LIBRARY_ID = '__global__';
export const DIRECT_UPLOAD_THRESHOLD = 4 * 1024 * 1024; // 4MB

export function detectContentType(url: string): 'video' | 'slides' | 'document' | 'link' {
  if (!url) return 'link';
  const lowerUrl = url.toLowerCase();

  if (lowerUrl.includes('presentation') || lowerUrl.includes('.ppt')) return 'slides';
  if (lowerUrl.includes('document') || lowerUrl.includes('.doc')) return 'document';
  if (lowerUrl.includes('drive.google.com/file')) return 'video';
  if (lowerUrl.includes('.mp4') || lowerUrl.includes('.mov') || lowerUrl.includes('.avi')) return 'video';

  return 'link';
}

export function getContentIcon(type: string, className?: string) {
  const iconClass = className || 'w-4 h-4';
  switch (type) {
    case 'video': return createElement(Video, { className: `${iconClass} text-purple-500` });
    case 'slides': return createElement(Presentation, { className: `${iconClass} text-orange-500` });
    case 'document': return createElement(FileText, { className: `${iconClass} text-blue-500` });
    default: return createElement(Link2, { className: `${iconClass} text-gray-500` });
  }
}

export function getEmbedUrl(resource: ModuleResource): string {
  const id = resource.google_drive_id;
  if (!id) return resource.external_url || '';

  switch (resource.content_type) {
    case 'video': return `https://drive.google.com/file/d/${id}/preview`;
    case 'slides': return `https://docs.google.com/presentation/d/${id}/embed?start=false&loop=false&delayms=3000`;
    case 'document': return `https://docs.google.com/document/d/${id}/preview`;
    default: return resource.external_url || '';
  }
}

export function getContentTypeLabel(type: string): string {
  switch (type) {
    case 'video': return 'Recordings';
    case 'slides': return 'PPTs';
    case 'document': return 'Session Notes';
    default: return 'Links';
  }
}

export function formatDuration(seconds: number | null): string {
  if (!seconds) return '';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
