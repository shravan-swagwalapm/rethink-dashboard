'use client';

import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { BookOpen, Loader2 } from 'lucide-react';
import type { LearningModule } from '@/types';

interface ModuleFormData {
  title: string;
  description: string;
  week_number: string;
  order_index: number;
}

interface ModuleFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingModule: LearningModule | null;
  initialFormData: ModuleFormData | null;
  onSave: (data: ModuleFormData) => void;
  saving: boolean;
}

export function ModuleFormDialog({
  open,
  onOpenChange,
  editingModule,
  initialFormData,
  onSave,
  saving,
}: ModuleFormDialogProps) {
  const [formData, setFormData] = useState<ModuleFormData>({
    title: '',
    description: '',
    week_number: '',
    order_index: 0,
  });

  useEffect(() => {
    if (open) {
      if (editingModule) {
        setFormData({
          title: editingModule.title,
          description: editingModule.description || '',
          week_number: editingModule.week_number?.toString() || '',
          order_index: editingModule.order_index || 0,
        });
      } else if (initialFormData) {
        setFormData(initialFormData);
      } else {
        setFormData({ title: '', description: '', week_number: '', order_index: 0 });
      }
    }
  }, [open, editingModule, initialFormData]);

  useEffect(() => {
    if (!open) {
      setFormData({ title: '', description: '', week_number: '', order_index: 0 });
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="dark:bg-gray-900 dark:border-gray-700 sm:max-w-[550px]">
        <DialogHeader className="pb-2">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <DialogTitle className="dark:text-white text-2xl">
              {editingModule ? 'Edit Week' : 'Create New Week'}
            </DialogTitle>
          </div>
          <DialogDescription className="dark:text-gray-400 text-base">
            {editingModule ? 'Update week details and content structure' : 'Create a new week to organize your learning content'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6 py-4">
          <div className="grid grid-cols-2 gap-5">
            <div className="space-y-2">
              <Label htmlFor="module-week" className="dark:text-gray-300 font-medium flex items-center gap-1">
                Week Number <span className="text-red-500">*</span>
              </Label>
              <Input
                id="module-week"
                type="number"
                placeholder="1"
                value={formData.week_number}
                onChange={(e) => setFormData({ ...formData, week_number: e.target.value })}
                className="dark:bg-gray-950 dark:border-gray-700 dark:text-white h-11 text-base"
              />
              <p className="text-xs text-muted-foreground dark:text-gray-500">Displayed in tabs</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="module-order" className="dark:text-gray-300 font-medium">Order Index</Label>
              <Input
                id="module-order"
                type="number"
                placeholder="0"
                value={formData.order_index}
                onChange={(e) => setFormData({ ...formData, order_index: parseInt(e.target.value) || 0 })}
                className="dark:bg-gray-950 dark:border-gray-700 dark:text-white h-11 text-base"
              />
              <p className="text-xs text-muted-foreground dark:text-gray-500">Sort order (0 = first)</p>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="module-title" className="dark:text-gray-300 font-medium flex items-center gap-1">
              Title <span className="text-red-500">*</span>
            </Label>
            <Input
              id="module-title"
              placeholder="e.g., Week 1: Introduction to Product Management"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="dark:bg-gray-950 dark:border-gray-700 dark:text-white h-11 text-base"
            />
            <p className="text-xs text-muted-foreground dark:text-gray-500">Descriptive title for the week</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="module-description" className="dark:text-gray-300 font-medium">Description</Label>
            <Textarea
              id="module-description"
              placeholder="Brief description of what this week covers..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="dark:bg-gray-950 dark:border-gray-700 dark:text-white min-h-[100px] text-base resize-none"
            />
            <p className="text-xs text-muted-foreground dark:text-gray-500">Optional summary of week content</p>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="dark:border-gray-700 dark:text-white dark:hover:bg-gray-800 h-11"
          >
            Cancel
          </Button>
          <Button
            onClick={() => onSave(formData)}
            disabled={saving || !formData.week_number || !formData.title.trim()}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white h-11 px-6 shadow-md"
          >
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {editingModule ? 'Update Week' : 'Create Week'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export type { ModuleFormData };
