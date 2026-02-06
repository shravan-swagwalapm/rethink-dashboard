'use client';

import { Button } from '@/components/ui/button';
import { Globe, Users, Download, Trash2, X } from 'lucide-react';
import { ResourceWithCohort, exportToCSV } from '../types';

interface BulkActionsBarProps {
  selectedResourceIds: Set<string>;
  resources: ResourceWithCohort[];
  onMoveToGlobal: () => void;
  onMoveToCohort: () => void;
  onBulkDelete: () => void;
  onClearSelection: () => void;
}

export function BulkActionsBar({
  selectedResourceIds,
  resources,
  onMoveToGlobal,
  onMoveToCohort,
  onBulkDelete,
  onClearSelection,
}: BulkActionsBarProps) {
  if (selectedResourceIds.size === 0) return null;

  return (
    <div className="sticky bottom-4 z-10 mx-auto max-w-3xl">
      <div className="flex items-center justify-between gap-4 px-4 py-3 rounded-xl bg-card border-2 border-primary/30 shadow-lg backdrop-blur">
        <span className="text-sm font-medium">
          {selectedResourceIds.size} item{selectedResourceIds.size > 1 ? 's' : ''} selected
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onMoveToGlobal}
            className="gap-2"
          >
            <Globe className="w-4 h-4" />
            Move to Global
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onMoveToCohort}
            className="gap-2"
          >
            <Users className="w-4 h-4" />
            Move to Cohort
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportToCSV(resources.filter(r => selectedResourceIds.has(r.id)))}
            className="gap-2"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={onBulkDelete}
            className="gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearSelection}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
