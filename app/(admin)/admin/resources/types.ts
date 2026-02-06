import { Resource, ResourceCategory } from '@/types';
import { Video, FileText, Presentation, File, Link as LinkIcon } from 'lucide-react';
import { createElement } from 'react';
import { format } from 'date-fns';

export interface ResourceWithCohort extends Resource {
  cohort?: {
    id: string;
    name: string;
    tag: string;
  };
}

export interface VideoFormRow {
  id: string;
  title: string;
  url: string;
  thumbnailUrl: string;
  duration: string;
}

export interface ArticleFormRow {
  id: string;
  title: string;
  url: string;
}

export interface FileUploadItem {
  id: string;
  file: File;
  name: string;
  size: number;
  progress: number;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
}

export interface EditFormData {
  name: string;
  external_url: string;
  thumbnail_url: string;
  duration: string;
}

export const ITEMS_PER_PAGE = 20;
export const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
export const ACCEPTED_FILE_TYPES = '.pdf,.ppt,.pptx,.doc,.docx';

export const generateId = () => Math.random().toString(36).substring(2, 9);

export const formatFileSize = (bytes: number | null): string => {
  if (!bytes) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const isValidUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

export const getCategoryIcon = (category: ResourceCategory | null) => {
  switch (category) {
    case 'video':
      return createElement(Video, { className: 'w-4 h-4 text-purple-500' });
    case 'article':
      return createElement(LinkIcon, { className: 'w-4 h-4 text-blue-500' });
    case 'presentation':
      return createElement(Presentation, { className: 'w-4 h-4 text-orange-500' });
    case 'pdf':
      return createElement(FileText, { className: 'w-4 h-4 text-red-500' });
    default:
      return createElement(File, { className: 'w-4 h-4 text-gray-500' });
  }
};

export const exportToCSV = (resources: ResourceWithCohort[]) => {
  const headers = ['Name', 'Category', 'Type', 'Size', 'Cohort', 'Global', 'Created At'];
  const rows = resources.map(r => [
    r.name,
    r.category || '-',
    r.type,
    formatFileSize(r.file_size),
    r.cohort?.name || 'Global',
    r.is_global ? 'Yes' : 'No',
    format(new Date(r.created_at), 'yyyy-MM-dd HH:mm'),
  ]);

  const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `resources-export-${format(new Date(), 'yyyy-MM-dd')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};
