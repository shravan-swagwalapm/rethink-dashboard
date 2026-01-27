'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import {
  Users,
  Loader2,
  CheckCircle,
  AlertCircle,
  Mail,
  Phone,
  UserPlus,
  Info,
} from 'lucide-react';
import { toast } from 'sonner';

interface Cohort {
  id: string;
  name: string;
}

interface PreviewData {
  cohort_name: string;
  total_members: number;
  members_with_email: number;
  members_with_phone: number;
  duplicate_count: number;
  new_imports: number;
  preview: Array<{ name: string; email: string; phone?: string }>;
}

interface CohortImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactListId: string;
  contactListName: string;
  onImportComplete: () => void;
}

export function CohortImportDialog({
  open,
  onOpenChange,
  contactListId,
  contactListName,
  onImportComplete,
}: CohortImportDialogProps) {
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [selectedCohortId, setSelectedCohortId] = useState<string>('');
  const [loadingCohorts, setLoadingCohorts] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [importResult, setImportResult] = useState<{
    imported: number;
    skipped: number;
    message: string;
  } | null>(null);

  useEffect(() => {
    if (open) {
      fetchCohorts();
      setSelectedCohortId('');
      setPreview(null);
      setImportResult(null);
    }
  }, [open]);

  useEffect(() => {
    if (selectedCohortId) {
      fetchPreview();
    } else {
      setPreview(null);
    }
  }, [selectedCohortId]);

  const fetchCohorts = async () => {
    try {
      setLoadingCohorts(true);
      const response = await fetch('/api/admin/cohorts');
      if (!response.ok) throw new Error('Failed to fetch cohorts');
      const result = await response.json();
      // API returns array directly, or may have data/cohorts wrapper
      const cohortsData = Array.isArray(result) ? result : (result.data || result.cohorts || []);
      setCohorts(cohortsData);
    } catch (error) {
      console.error('Error fetching cohorts:', error);
      toast.error('Failed to load cohorts');
    } finally {
      setLoadingCohorts(false);
    }
  };

  const fetchPreview = async () => {
    if (!selectedCohortId) return;

    try {
      setLoadingPreview(true);
      const response = await fetch(
        `/api/admin/notifications/contacts/import-cohort?cohort_id=${selectedCohortId}&list_id=${contactListId}`
      );
      if (!response.ok) throw new Error('Failed to fetch preview');
      const result = await response.json();
      setPreview(result.data);
    } catch (error) {
      console.error('Error fetching preview:', error);
      toast.error('Failed to preview cohort members');
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleImport = async () => {
    if (!selectedCohortId) return;

    try {
      setImporting(true);
      const response = await fetch('/api/admin/notifications/contacts/import-cohort', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          list_id: contactListId,
          cohort_id: selectedCohortId,
          skip_duplicates: true,
        }),
      });

      if (!response.ok) throw new Error('Failed to import');

      const result = await response.json();
      setImportResult(result.data);

      if (result.data.imported > 0) {
        toast.success(result.data.message);
        onImportComplete();
      } else if (result.data.skipped > 0) {
        toast.info('All contacts were already in this list');
      } else {
        toast.warning(result.data.message);
      }
    } catch (error) {
      console.error('Error importing cohort:', error);
      toast.error('Failed to import cohort members');
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="dark:bg-gray-900 dark:border-gray-700 sm:max-w-[550px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-teal-600 flex items-center justify-center shadow-lg">
              <UserPlus className="w-6 h-6 text-white" />
            </div>
            <div>
              <DialogTitle className="dark:text-white text-xl">
                Import from Cohort
              </DialogTitle>
              <DialogDescription className="dark:text-gray-400">
                Add platform users to <span className="font-medium text-white">{contactListName}</span>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Import Result */}
        {importResult ? (
          <div className="py-6 space-y-4">
            <div className="flex flex-col items-center text-center">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
                importResult.imported > 0 ? 'bg-green-100 dark:bg-green-900/30' : 'bg-yellow-100 dark:bg-yellow-900/30'
              }`}>
                {importResult.imported > 0 ? (
                  <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
                ) : (
                  <AlertCircle className="w-8 h-8 text-yellow-600 dark:text-yellow-400" />
                )}
              </div>
              <h3 className="mt-4 text-lg font-semibold dark:text-white">
                {importResult.imported > 0 ? 'Import Complete!' : 'No New Contacts'}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground dark:text-gray-400">
                {importResult.message}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4">
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {importResult.imported}
                </p>
                <p className="text-xs text-muted-foreground dark:text-gray-500">
                  Imported
                </p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                  {importResult.skipped}
                </p>
                <p className="text-xs text-muted-foreground dark:text-gray-500">
                  Skipped (duplicates)
                </p>
              </div>
            </div>

            <DialogFooter className="pt-4">
              <Button onClick={() => onOpenChange(false)} className="w-full">
                Done
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <>
            <div className="space-y-4 py-4">
              {/* Cohort Selection */}
              <div className="space-y-2">
                <Label className="dark:text-gray-300">Select Cohort</Label>
                <Select
                  value={selectedCohortId}
                  onValueChange={setSelectedCohortId}
                  disabled={loadingCohorts}
                >
                  <SelectTrigger className="dark:bg-gray-950 dark:border-gray-700">
                    <SelectValue placeholder={
                      loadingCohorts ? 'Loading cohorts...' : 'Choose a cohort'
                    } />
                  </SelectTrigger>
                  <SelectContent>
                    {cohorts.map((cohort) => (
                      <SelectItem key={cohort.id} value={cohort.id}>
                        {cohort.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Loading Preview */}
              {loadingPreview && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-600 mr-2" />
                  <span className="text-sm text-muted-foreground">Loading preview...</span>
                </div>
              )}

              {/* Preview */}
              {preview && !loadingPreview && (
                <div className="space-y-4">
                  <Separator />

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-center">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      </div>
                      <p className="text-xl font-bold text-blue-600 dark:text-blue-400">
                        {preview.total_members}
                      </p>
                      <p className="text-xs text-muted-foreground dark:text-gray-500">
                        Total Members
                      </p>
                    </div>
                    <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 text-center">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <Mail className="w-4 h-4 text-green-600 dark:text-green-400" />
                      </div>
                      <p className="text-xl font-bold text-green-600 dark:text-green-400">
                        {preview.new_imports}
                      </p>
                      <p className="text-xs text-muted-foreground dark:text-gray-500">
                        New Contacts
                      </p>
                    </div>
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3 text-center">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                      </div>
                      <p className="text-xl font-bold text-yellow-600 dark:text-yellow-400">
                        {preview.duplicate_count}
                      </p>
                      <p className="text-xs text-muted-foreground dark:text-gray-500">
                        Duplicates
                      </p>
                    </div>
                  </div>

                  {/* Preview List */}
                  {preview.preview.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground dark:text-gray-500">
                        Preview (first 10 members)
                      </Label>
                      <div className="max-h-40 overflow-y-auto border dark:border-gray-700 rounded-lg divide-y dark:divide-gray-700">
                        {preview.preview.map((member, idx) => (
                          <div
                            key={idx}
                            className="px-3 py-2 flex items-center justify-between text-sm"
                          >
                            <div>
                              <p className="font-medium dark:text-white">
                                {member.name || 'No name'}
                              </p>
                              <p className="text-xs text-muted-foreground dark:text-gray-500">
                                {member.email}
                              </p>
                            </div>
                            {member.phone && (
                              <Badge variant="outline" className="text-xs">
                                <Phone className="w-3 h-3 mr-1" />
                                {member.phone}
                              </Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Info */}
                  {preview.duplicate_count > 0 && (
                    <div className="flex items-start gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                      <Info className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-yellow-800 dark:text-yellow-200">
                        {preview.duplicate_count} member(s) already exist in this contact list and will be skipped.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={importing}
              >
                Cancel
              </Button>
              <Button
                onClick={handleImport}
                disabled={!selectedCohortId || loadingPreview || importing || (preview?.new_imports === 0)}
                className="bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700"
              >
                {importing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : preview ? (
                  <>
                    <UserPlus className="w-4 h-4 mr-2" />
                    Import {preview.new_imports} Contacts
                  </>
                ) : (
                  'Select Cohort'
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
