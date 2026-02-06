'use client';

import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { FileText, Loader2 } from 'lucide-react';
import type { CaseStudy } from '@/types';

interface CaseStudyFormData {
  title: string;
  description: string;
  problem_doc_url: string;
  solution_doc_url: string;
  solution_visible: boolean;
  due_date: string;
}

interface CaseStudyFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingCaseStudy: CaseStudy | null;
  onSave: (data: CaseStudyFormData) => void;
  saving: boolean;
}

export function CaseStudyFormDialog({
  open,
  onOpenChange,
  editingCaseStudy,
  onSave,
  saving,
}: CaseStudyFormDialogProps) {
  const [formData, setFormData] = useState<CaseStudyFormData>({
    title: '',
    description: '',
    problem_doc_url: '',
    solution_doc_url: '',
    solution_visible: false,
    due_date: '',
  });

  useEffect(() => {
    if (open && editingCaseStudy) {
      setFormData({
        title: editingCaseStudy.title,
        description: editingCaseStudy.description || '',
        problem_doc_url: editingCaseStudy.problem_doc_url || '',
        solution_doc_url: editingCaseStudy.solution_doc_url || '',
        solution_visible: editingCaseStudy.solution_visible,
        due_date: editingCaseStudy.due_date ? editingCaseStudy.due_date.split('T')[0] : '',
      });
    }
  }, [open, editingCaseStudy]);

  useEffect(() => {
    if (!open) {
      setFormData({ title: '', description: '', problem_doc_url: '', solution_doc_url: '', solution_visible: false, due_date: '' });
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="dark:bg-gray-900 dark:border-gray-700 sm:max-w-[600px]">
        <DialogHeader className="pb-2">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <DialogTitle className="dark:text-white text-2xl">
              {editingCaseStudy ? 'Edit Case Study' : 'Add New Case Study'}
            </DialogTitle>
          </div>
          <DialogDescription className="dark:text-gray-400 text-base">
            {editingCaseStudy ? 'Update case study details and resources' : 'Add a case study with problem statement and solution documents'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5 py-4">
          <div className="space-y-2">
            <Label htmlFor="cs-title" className="dark:text-gray-300 font-medium flex items-center gap-1">
              Title <span className="text-red-500">*</span>
            </Label>
            <Input
              id="cs-title"
              placeholder="e.g., Case Study 1: Culture Compass"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="dark:bg-gray-950 dark:border-gray-700 dark:text-white h-11 text-base"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cs-description" className="dark:text-gray-300 font-medium">Description</Label>
            <Textarea
              id="cs-description"
              placeholder="Brief description of the case study and learning objectives..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="dark:bg-gray-950 dark:border-gray-700 dark:text-white min-h-[80px] text-base resize-none"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cs-problem" className="dark:text-gray-300 font-medium flex items-center gap-2">
              <FileText className="w-4 h-4 text-orange-500" />
              Problem Document URL
            </Label>
            <Input
              id="cs-problem"
              placeholder="https://docs.google.com/document/d/..."
              value={formData.problem_doc_url}
              onChange={(e) => setFormData({ ...formData, problem_doc_url: e.target.value })}
              className="dark:bg-gray-950 dark:border-gray-700 dark:text-white h-11 text-base"
            />
            <p className="text-xs text-muted-foreground dark:text-gray-500">Google Docs URL for the problem statement</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="cs-solution" className="dark:text-gray-300 font-medium flex items-center gap-2">
              <FileText className="w-4 h-4 text-green-500" />
              Solution Document URL
            </Label>
            <Input
              id="cs-solution"
              placeholder="https://docs.google.com/document/d/..."
              value={formData.solution_doc_url}
              onChange={(e) => setFormData({ ...formData, solution_doc_url: e.target.value })}
              className="dark:bg-gray-950 dark:border-gray-700 dark:text-white h-11 text-base"
            />
            <p className="text-xs text-muted-foreground dark:text-gray-500">Google Docs URL for the solution</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-2">
              <Label htmlFor="cs-due" className="dark:text-gray-300 font-medium">Due Date</Label>
              <Input
                id="cs-due"
                type="date"
                value={formData.due_date}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                className="dark:bg-gray-950 dark:border-gray-700 dark:text-white h-11 text-base"
              />
              <p className="text-xs text-muted-foreground dark:text-gray-500">Optional submission deadline</p>
            </div>
            <div className="space-y-2">
              <Label className="dark:text-gray-300 font-medium">Solution Visibility</Label>
              <div className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-950/50 h-11">
                <Switch
                  id="cs-visible"
                  checked={formData.solution_visible}
                  onCheckedChange={(checked) => setFormData({ ...formData, solution_visible: checked })}
                />
                <Label htmlFor="cs-visible" className="text-sm cursor-pointer dark:text-gray-300">
                  Visible to Students
                </Label>
              </div>
            </div>
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
            disabled={saving || !formData.title.trim()}
            className="bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white h-11 px-6 shadow-md"
          >
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {editingCaseStudy ? 'Update Case Study' : 'Create Case Study'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export type { CaseStudyFormData };
