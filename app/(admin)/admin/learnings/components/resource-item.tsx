'use client';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Video,
  FileText,
  Presentation,
  Link2,
  MoreVertical,
  Pencil,
  Trash2,
  ExternalLink,
  Play,
} from 'lucide-react';
import type { ModuleResource } from '@/types';
import { cn } from '@/lib/utils';
import { formatDuration } from '../utils';

interface ResourceItemProps {
  resource: ModuleResource;
  onPreview: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function ResourceItem({
  resource,
  onPreview,
  onEdit,
  onDelete,
}: ResourceItemProps) {
  const hoverBorderClass = {
    video: 'hover:border-purple-500/50 dark:hover:border-purple-500/50',
    slides: 'hover:border-orange-500/50 dark:hover:border-orange-500/50',
    document: 'hover:border-blue-500/50 dark:hover:border-blue-500/50',
    link: 'hover:border-gray-500/50 dark:hover:border-gray-500/50',
  };

  return (
    <div className={cn(
      "flex items-center gap-4 p-4 rounded-lg border-2 transition-all group",
      "dark:border-gray-700 bg-white dark:bg-gray-900",
      hoverBorderClass[resource.content_type as keyof typeof hoverBorderClass] || hoverBorderClass.link,
      "shadow-sm hover:shadow-md"
    )}>
      <div className={cn(
        "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
        resource.content_type === 'video' && "bg-purple-500/10 dark:bg-purple-500/20",
        resource.content_type === 'slides' && "bg-orange-500/10 dark:bg-orange-500/20",
        resource.content_type === 'document' && "bg-blue-500/10 dark:bg-blue-500/20",
        resource.content_type === 'link' && "bg-gray-500/10 dark:bg-gray-500/20"
      )}>
        {resource.content_type === 'video' && <Video className="w-5 h-5 text-purple-600 dark:text-purple-400" />}
        {resource.content_type === 'slides' && <Presentation className="w-5 h-5 text-orange-600 dark:text-orange-400" />}
        {resource.content_type === 'document' && <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
        {resource.content_type === 'link' && <Link2 className="w-5 h-5 text-gray-600 dark:text-gray-400" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm truncate dark:text-white">{resource.title}</p>
        <div className="flex items-center gap-2.5 text-xs text-gray-600 dark:text-gray-400 mt-1">
          {resource.session_number && (
            <span className="font-medium">Session {resource.session_number}</span>
          )}
          {resource.duration_seconds && (
            <>
              {resource.session_number && <span className="text-gray-400">&bull;</span>}
              <span className="font-medium">{formatDuration(resource.duration_seconds)}</span>
            </>
          )}
        </div>
      </div>
      <Button
        size="sm"
        variant="ghost"
        onClick={onPreview}
        className="opacity-0 group-hover:opacity-100 transition-opacity dark:text-white dark:hover:bg-gray-800"
      >
        <Play className="w-4 h-4 mr-1.5" />
        Play
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="ghost" className="dark:text-white dark:hover:bg-gray-800">
            <MoreVertical className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="dark:bg-gray-900 dark:border-gray-700">
          <DropdownMenuItem onClick={onPreview} className="dark:text-white dark:focus:bg-gray-800">
            <Play className="w-4 h-4 mr-2" />
            Preview
          </DropdownMenuItem>
          {resource.external_url && (
            <DropdownMenuItem asChild className="dark:text-white dark:focus:bg-gray-800">
              <a href={resource.external_url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-4 h-4 mr-2" />
                Open Original
              </a>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={onEdit} className="dark:text-white dark:focus:bg-gray-800">
            <Pencil className="w-4 h-4 mr-2" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem className="text-red-600 dark:text-red-400 dark:focus:bg-red-950/20" onClick={onDelete}>
            <Trash2 className="w-4 h-4 mr-2" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
