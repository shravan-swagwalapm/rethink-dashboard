'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { ResourceWithCohort, EditFormData } from '../types';

interface EditResourceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resource: ResourceWithCohort | null;
  onSaved: () => void;
}

export function EditResourceDialog({ open, onOpenChange, resource, onSaved }: EditResourceDialogProps) {
  const [editFormData, setEditFormData] = useState<EditFormData>({
    name: '',
    external_url: '',
    thumbnail_url: '',
    duration: '',
  });
  const [editSaving, setEditSaving] = useState(false);

  useEffect(() => {
    if (resource) {
      setEditFormData({
        name: resource.name,
        external_url: resource.external_url || '',
        thumbnail_url: resource.thumbnail_url || '',
        duration: resource.duration || '',
      });
    }
  }, [resource]);

  const handleEditSave = async () => {
    if (!resource) return;

    setEditSaving(true);
    try {
      const response = await fetch(`/api/admin/resources/${resource.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editFormData.name,
          external_url: editFormData.external_url || null,
          thumbnail_url: editFormData.thumbnail_url || null,
          duration: editFormData.duration || null,
        }),
      });

      if (!response.ok) throw new Error('Failed to update resource');

      toast.success('Resource updated');
      onOpenChange(false);
      onSaved();
    } catch (error) {
      console.error('Error updating resource:', error);
      toast.error('Failed to update resource');
    } finally {
      setEditSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Resource</DialogTitle>
          <DialogDescription>
            Update the details for this resource
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Name</Label>
            <Input
              id="edit-name"
              value={editFormData.name}
              onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
            />
          </div>
          {resource?.type === 'link' && (
            <div className="space-y-2">
              <Label htmlFor="edit-url">URL</Label>
              <Input
                id="edit-url"
                value={editFormData.external_url}
                onChange={(e) => setEditFormData({ ...editFormData, external_url: e.target.value })}
              />
            </div>
          )}
          {resource?.category === 'video' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="edit-thumbnail">Thumbnail URL</Label>
                <Input
                  id="edit-thumbnail"
                  value={editFormData.thumbnail_url}
                  onChange={(e) => setEditFormData({ ...editFormData, thumbnail_url: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-duration">Duration</Label>
                <Input
                  id="edit-duration"
                  placeholder="10:24"
                  value={editFormData.duration}
                  onChange={(e) => setEditFormData({ ...editFormData, duration: e.target.value })}
                />
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleEditSave} disabled={editSaving} className="gradient-bg">
            {editSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
