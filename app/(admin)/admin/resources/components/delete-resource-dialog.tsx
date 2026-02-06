'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { ResourceWithCohort } from '../types';

interface DeleteResourceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resource: ResourceWithCohort | null;
  onDeleted: () => void;
}

export function DeleteResourceDialog({ open, onOpenChange, resource, onDeleted }: DeleteResourceDialogProps) {
  const handleDelete = async () => {
    if (!resource) return;

    try {
      const response = await fetch(`/api/admin/resources/${resource.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete resource');

      toast.success('Resource deleted');
      onOpenChange(false);
      onDeleted();
    } catch (error) {
      console.error('Error deleting resource:', error);
      toast.error('Failed to delete resource');
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Resource</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete &quot;{resource?.name}&quot;? This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface BulkDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedResourceIds: Set<string>;
  onDeleted: () => void;
}

export function BulkDeleteDialog({ open, onOpenChange, selectedResourceIds, onDeleted }: BulkDeleteDialogProps) {
  const handleBulkDelete = async () => {
    if (selectedResourceIds.size === 0) return;

    try {
      const response = await fetch('/api/admin/resources/bulk', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resource_ids: Array.from(selectedResourceIds) }),
      });

      if (!response.ok) throw new Error('Failed to delete resources');

      toast.success(`Deleted ${selectedResourceIds.size} resource${selectedResourceIds.size > 1 ? 's' : ''}`);
      onOpenChange(false);
      onDeleted();
    } catch (error) {
      console.error('Error bulk deleting resources:', error);
      toast.error('Failed to delete resources');
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {selectedResourceIds.size} Resources</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete these {selectedResourceIds.size} resources? This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleBulkDelete}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Delete All
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
