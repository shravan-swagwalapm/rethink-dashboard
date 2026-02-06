'use client';

import { type ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Plus,
  Video,
  FileText,
  Presentation,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import type { ModuleResource } from '@/types';
import { ResourceItem } from './resource-item';

interface ResourceSectionConfig {
  key: string;
  title: string;
  contentType: 'video' | 'slides' | 'document';
  color: 'purple' | 'orange' | 'blue';
  emptyLabel: string;
  emptyHint: string;
}

const SECTION_CONFIGS: Record<string, ResourceSectionConfig> = {
  recordings: {
    key: 'recordings',
    title: 'Recordings',
    contentType: 'video',
    color: 'purple',
    emptyLabel: 'No recordings added yet',
    emptyHint: 'Click "Add" to upload your first recording',
  },
  slides: {
    key: 'slides',
    title: 'PPTs',
    contentType: 'slides',
    color: 'orange',
    emptyLabel: 'No presentations added yet',
    emptyHint: 'Click "Add" to upload your first presentation',
  },
  documents: {
    key: 'documents',
    title: 'Session Notes',
    contentType: 'document',
    color: 'blue',
    emptyLabel: 'No session notes added yet',
    emptyHint: 'Click "Add" to upload your first session note',
  },
};

const colorClasses = {
  purple: {
    hover: 'hover:bg-purple-50/50 dark:hover:bg-purple-950/10',
    iconBg: 'bg-purple-500/10 dark:bg-purple-500/20',
    badge: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
    emptyBg: 'bg-purple-500/10 dark:bg-purple-500/20',
  },
  orange: {
    hover: 'hover:bg-orange-50/50 dark:hover:bg-orange-950/10',
    iconBg: 'bg-orange-500/10 dark:bg-orange-500/20',
    badge: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',
    emptyBg: 'bg-orange-500/10 dark:bg-orange-500/20',
  },
  blue: {
    hover: 'hover:bg-blue-50/50 dark:hover:bg-blue-950/10',
    iconBg: 'bg-blue-500/10 dark:bg-blue-500/20',
    badge: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
    emptyBg: 'bg-blue-500/10 dark:bg-blue-500/20',
  },
};

function getSectionIcon(contentType: string, size: 'sm' | 'lg') {
  const cls = size === 'sm' ? 'w-5 h-5' : 'w-6 h-6';
  const colorMap: Record<string, string> = {
    video: `${cls} text-purple-600 dark:text-purple-400`,
    slides: `${cls} text-orange-600 dark:text-orange-400`,
    document: `${cls} text-blue-600 dark:text-blue-400`,
  };
  const className = colorMap[contentType] || `${cls} text-gray-600 dark:text-gray-400`;

  switch (contentType) {
    case 'video': return <Video className={className} />;
    case 'slides': return <Presentation className={className} />;
    case 'document': return <FileText className={className} />;
    default: return <FileText className={className} />;
  }
}

interface ResourceSectionProps {
  sectionKey: 'recordings' | 'slides' | 'documents';
  expanded: boolean;
  onToggle: () => void;
  resources: ModuleResource[];
  onAdd: () => void;
  onPreview: (resource: ModuleResource) => void;
  onEdit: (resource: ModuleResource) => void;
  onDelete: (resourceId: string) => void;
}

export function ResourceSection({
  sectionKey,
  expanded,
  onToggle,
  resources,
  onAdd,
  onPreview,
  onEdit,
  onDelete,
}: ResourceSectionProps) {
  const config = SECTION_CONFIGS[sectionKey];
  const colors = colorClasses[config.color];

  return (
    <Card className="border-2 dark:border-gray-800 dark:bg-gray-950/50 shadow-sm overflow-hidden">
      <Collapsible open={expanded} onOpenChange={onToggle}>
        <CollapsibleTrigger asChild>
          <CardHeader className={`cursor-pointer ${colors.hover} transition-all border-b dark:border-gray-800 group`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="transition-transform group-hover:scale-110">
                  {expanded ? (
                    <ChevronDown className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                  )}
                </div>
                <div className={`w-9 h-9 rounded-lg ${colors.iconBg} flex items-center justify-center`}>
                  {getSectionIcon(config.contentType, 'sm')}
                </div>
                <CardTitle className="text-lg font-semibold dark:text-white">{config.title}</CardTitle>
                <Badge variant="secondary" className={`${colors.badge} border-0 font-semibold`}>
                  {resources.length}
                </Badge>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => { e.stopPropagation(); onAdd(); }}
                className="border-2 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:hover:bg-gray-800 transition-all hover:shadow-sm"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Add
              </Button>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-5 pb-5">
            {resources.length === 0 ? (
              <div className="text-center py-8 px-4 rounded-lg border-2 border-dashed dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50">
                <div className={`w-12 h-12 rounded-full ${colors.emptyBg} flex items-center justify-center mx-auto mb-3`}>
                  {getSectionIcon(config.contentType, 'lg')}
                </div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-300">{config.emptyLabel}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{config.emptyHint}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {resources.map((resource) => (
                  <ResourceItem
                    key={resource.id}
                    resource={resource}
                    onPreview={() => onPreview(resource)}
                    onEdit={() => onEdit(resource)}
                    onDelete={() => onDelete(resource.id)}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
