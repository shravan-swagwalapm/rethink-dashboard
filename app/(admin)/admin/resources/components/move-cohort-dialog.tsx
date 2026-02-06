'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import type { Cohort } from '@/types';

interface MoveCohortDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cohorts: Cohort[];
  selectedResourceIds: Set<string>;
  onMoved: () => void;
}

export function MoveCohortDialog({ open, onOpenChange, cohorts, selectedResourceIds, onMoved }: MoveCohortDialogProps) {
  const [moveToCohortId, setMoveToCohortId] = useState<string>('');

  const handleMoveToCohort = async () => {
    if (selectedResourceIds.size === 0 || !moveToCohortId) return;

    try {
      const response = await fetch('/api/admin/resources/bulk', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resource_ids: Array.from(selectedResourceIds),
          updates: { cohort_id: moveToCohortId, is_global: false },
        }),
      });

      if (!response.ok) throw new Error('Failed to update resources');

      const targetCohort = cohorts.find(c => c.id === moveToCohortId);
      toast.success(`Moved ${selectedResourceIds.size} resource${selectedResourceIds.size > 1 ? 's' : ''} to ${targetCohort?.name || 'cohort'}`);
      onOpenChange(false);
      setMoveToCohortId('');
      onMoved();
    } catch (error) {
      console.error('Error moving resources to cohort:', error);
      toast.error('Failed to move resources to cohort');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move to Cohort</DialogTitle>
          <DialogDescription>
            Select a cohort to move {selectedResourceIds.size} resource{selectedResourceIds.size > 1 ? 's' : ''} to.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Select value={moveToCohortId} onValueChange={setMoveToCohortId}>
            <SelectTrigger>
              <SelectValue placeholder="Select cohort..." />
            </SelectTrigger>
            <SelectContent>
              {cohorts.map((cohort) => (
                <SelectItem key={cohort.id} value={cohort.id}>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {cohort.tag}
                    </Badge>
                    {cohort.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleMoveToCohort} disabled={!moveToCohortId} className="gradient-bg">
            Move Resources
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
