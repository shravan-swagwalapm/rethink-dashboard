'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  FileText,
  Loader2,
  Upload,
  X,
  Check,
  AlertCircle,
  Plus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { compressPdf } from '@/lib/utils/compress-pdf';
import type { CaseStudy, CaseStudySolution } from '@/types';

// ── Exported Types ──────────────────────────────────────────────────────────

export interface CaseStudyFormData {
  title: string;
  description: string;
  problem_file_path: string | null;
  problem_file_size: number | null;
  solution_visible: boolean;
  due_date: string;
}

export interface PendingSolution {
  title: string;
  file_path: string;
  file_size: number;
  subgroup_id: string | null;
}

// ── Internal Types ──────────────────────────────────────────────────────────

interface CaseStudyFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingCaseStudy: (CaseStudy & { solutions?: CaseStudySolution[] }) | null;
  onSave: (data: CaseStudyFormData, solutions?: PendingSolution[]) => void;
  saving: boolean;
  cohortId: string;
}

interface Subgroup {
  id: string;
  name: string;
}

type UploadStage = 'idle' | 'compressing' | 'requesting-url' | 'uploading' | 'complete' | 'error';

interface SolutionEntry {
  /** Client-side key for React list rendering */
  key: string;
  title: string;
  file: File | null;
  /** Set after upload completes */
  file_path: string | null;
  file_size: number;
  subgroup_id: string | null;
  uploadStage: UploadStage;
  uploadPercent: number;
  /** If this entry represents an already-persisted solution */
  existingId?: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function filenameFromPath(path: string): string {
  return path.split('/').pop() || path;
}

function filenameWithoutExtension(name: string): string {
  return name.replace(/\.pdf$/i, '');
}

let keyCounter = 0;
function nextKey(): string {
  return `sol_${++keyCounter}_${Date.now()}`;
}

// ── Upload Helper ───────────────────────────────────────────────────────────

async function uploadPdfFile(
  file: File,
  pathPrefix: string,
  onStageChange: (stage: UploadStage) => void,
  onProgress: (percent: number) => void,
): Promise<{ filePath: string; fileSize: number }> {
  // Phase 1: Compress
  onStageChange('compressing');
  onProgress(0);
  const compressed = await compressPdf(file);
  const uploadFile = compressed.file;

  // Phase 2: Request signed URL
  onStageChange('requesting-url');
  onProgress(0);

  const urlResponse = await fetch('/api/admin/resources/upload-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filename: uploadFile.name,
      fileSize: uploadFile.size,
      contentType: 'application/pdf',
      cohortId: pathPrefix,
    }),
  });

  if (!urlResponse.ok) {
    if (urlResponse.status === 413) {
      throw new Error('File too large. Maximum upload size is 100MB.');
    }
    let errorMessage = 'Failed to get upload URL';
    try {
      const ct = urlResponse.headers.get('content-type');
      if (ct && ct.includes('application/json')) {
        const err = await urlResponse.json();
        errorMessage = err.error || err.message || errorMessage;
      } else {
        errorMessage = `Upload URL request failed with status ${urlResponse.status}`;
      }
    } catch {
      errorMessage = `Upload URL request failed with status ${urlResponse.status}`;
    }
    throw new Error(errorMessage);
  }

  const { uploadUrl, filePath, expiresAt } = await urlResponse.json();

  const expiresIn = new Date(expiresAt).getTime() - Date.now();
  if (expiresIn < 60000) {
    throw new Error('Upload URL expired. Please try again.');
  }

  // Phase 3: Upload via XHR with progress
  onStageChange('uploading');

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const percent = Math.round((e.loaded / e.total) * 100);
        onProgress(percent);
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        let errorMessage = `Upload failed with status ${xhr.status}`;
        try {
          const response = JSON.parse(xhr.responseText);
          errorMessage = response.error || response.message || errorMessage;
        } catch {
          // keep default
        }
        reject(new Error(errorMessage));
      }
    });

    xhr.addEventListener('error', () => {
      reject(new Error('Network error during upload. Please check your connection.'));
    });

    xhr.addEventListener('timeout', () => {
      reject(new Error('Upload timed out. Please try again.'));
    });

    xhr.timeout = 600000; // 10 minutes

    xhr.open('PUT', uploadUrl);
    xhr.setRequestHeader('Content-Type', uploadFile.type);
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    xhr.setRequestHeader('Authorization', `Bearer ${anonKey}`);
    xhr.setRequestHeader('apikey', anonKey);
    xhr.send(uploadFile);
  });

  onStageChange('complete');
  onProgress(100);

  return { filePath, fileSize: uploadFile.size };
}

// ── Component ───────────────────────────────────────────────────────────────

export function CaseStudyFormDialog({
  open,
  onOpenChange,
  editingCaseStudy,
  onSave,
  saving,
  cohortId,
}: CaseStudyFormDialogProps) {
  // Form fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [solutionVisible, setSolutionVisible] = useState(false);

  // Problem PDF state
  const [problemFilePath, setProblemFilePath] = useState<string | null>(null);
  const [problemFileSize, setProblemFileSize] = useState<number | null>(null);
  const [problemFile, setProblemFile] = useState<File | null>(null);
  const [problemUploadStage, setProblemUploadStage] = useState<UploadStage>('idle');
  const [problemUploadPercent, setProblemUploadPercent] = useState(0);
  const problemInputRef = useRef<HTMLInputElement>(null);

  // Solutions state
  const [solutions, setSolutions] = useState<SolutionEntry[]>([]);
  const solutionInputRef = useRef<HTMLInputElement>(null);

  // Subgroups for the cohort
  const [subgroups, setSubgroups] = useState<Subgroup[]>([]);
  const [subgroupsLoaded, setSubgroupsLoaded] = useState(false);

  // Internal uploading flag (separate from parent `saving`)
  const [uploading, setUploading] = useState(false);

  // ── Fetch subgroups on open ─────────────────────────────────────────────
  useEffect(() => {
    if (!open || !cohortId) return;
    let cancelled = false;

    async function fetchSubgroups() {
      try {
        const res = await fetch(`/api/admin/subgroups?cohort_id=${cohortId}`);
        if (!res.ok) throw new Error('Failed to fetch subgroups');
        const data: Subgroup[] = await res.json();
        if (!cancelled) {
          setSubgroups(data);
          setSubgroupsLoaded(true);
        }
      } catch (err) {
        console.error('Error fetching subgroups:', err);
        if (!cancelled) {
          setSubgroups([]);
          setSubgroupsLoaded(true);
        }
      }
    }

    fetchSubgroups();
    return () => { cancelled = true; };
  }, [open, cohortId]);

  // ── Populate form in edit mode ──────────────────────────────────────────
  useEffect(() => {
    if (open && editingCaseStudy) {
      setTitle(editingCaseStudy.title);
      setDescription(editingCaseStudy.description || '');
      setDueDate(editingCaseStudy.due_date ? editingCaseStudy.due_date.split('T')[0] : '');
      setSolutionVisible(editingCaseStudy.solution_visible);
      setProblemFilePath(editingCaseStudy.problem_file_path || null);
      setProblemFileSize(editingCaseStudy.problem_file_size || null);
      setProblemFile(null);

      // Map existing solutions
      if (editingCaseStudy.solutions && editingCaseStudy.solutions.length > 0) {
        setSolutions(
          editingCaseStudy.solutions.map((sol) => ({
            key: nextKey(),
            title: sol.title,
            file: null,
            file_path: sol.file_path,
            file_size: sol.file_size || 0,
            subgroup_id: sol.subgroup_id || null,
            uploadStage: 'complete' as UploadStage,
            uploadPercent: 100,
            existingId: sol.id,
          })),
        );
      } else {
        setSolutions([]);
      }
    }
  }, [open, editingCaseStudy]);

  // ── Reset form on close ─────────────────────────────────────────────────
  useEffect(() => {
    if (!open) {
      setTitle('');
      setDescription('');
      setDueDate('');
      setSolutionVisible(false);
      setProblemFilePath(null);
      setProblemFileSize(null);
      setProblemFile(null);
      setProblemUploadStage('idle');
      setProblemUploadPercent(0);
      setSolutions([]);
      setSubgroupsLoaded(false);
      setUploading(false);
      if (problemInputRef.current) problemInputRef.current.value = '';
      if (solutionInputRef.current) solutionInputRef.current.value = '';
    }
  }, [open]);

  // ── Problem PDF handlers ────────────────────────────────────────────────

  const handleProblemFileSelect = useCallback((file: File) => {
    if (file.type !== 'application/pdf') {
      toast.error('Please select a PDF file');
      return;
    }
    if (file.size > 100 * 1024 * 1024) {
      toast.error('File size must be less than 100MB');
      return;
    }
    setProblemFile(file);
    // Reset any previously-uploaded path so the new file takes precedence
    setProblemFilePath(null);
    setProblemFileSize(null);
    setProblemUploadStage('idle');
    setProblemUploadPercent(0);
  }, []);

  const handleProblemDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleProblemFileSelect(file);
    },
    [handleProblemFileSelect],
  );

  const handleProblemDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  }, []);

  const clearProblemFile = useCallback(() => {
    setProblemFile(null);
    setProblemFilePath(null);
    setProblemFileSize(null);
    setProblemUploadStage('idle');
    setProblemUploadPercent(0);
    if (problemInputRef.current) problemInputRef.current.value = '';
  }, []);

  // ── Solution handlers ───────────────────────────────────────────────────

  const handleSolutionFilesSelect = useCallback((files: FileList) => {
    const newEntries: SolutionEntry[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type !== 'application/pdf') {
        toast.error(`${file.name} is not a PDF — skipped`);
        continue;
      }
      if (file.size > 100 * 1024 * 1024) {
        toast.error(`${file.name} exceeds 100MB — skipped`);
        continue;
      }
      newEntries.push({
        key: nextKey(),
        title: filenameWithoutExtension(file.name),
        file,
        file_path: null,
        file_size: file.size,
        subgroup_id: null,
        uploadStage: 'idle',
        uploadPercent: 0,
      });
    }
    if (newEntries.length > 0) {
      setSolutions((prev) => [...prev, ...newEntries]);
    }
    if (solutionInputRef.current) solutionInputRef.current.value = '';
  }, []);

  const updateSolution = useCallback((key: string, updates: Partial<SolutionEntry>) => {
    setSolutions((prev) =>
      prev.map((s) => (s.key === key ? { ...s, ...updates } : s)),
    );
  }, []);

  const removeSolution = useCallback((key: string) => {
    setSolutions((prev) => prev.filter((s) => s.key !== key));
  }, []);

  // ── Upload all files then save ──────────────────────────────────────────

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error('Title is required');
      return;
    }

    setUploading(true);

    try {
      // 1) Upload problem PDF if a new file was selected
      let finalProblemPath = problemFilePath;
      let finalProblemSize = problemFileSize;

      if (problemFile && !problemFilePath) {
        const result = await uploadPdfFile(
          problemFile,
          `case-studies/${cohortId}`,
          (stage) => setProblemUploadStage(stage),
          (pct) => setProblemUploadPercent(pct),
        );
        finalProblemPath = result.filePath;
        finalProblemSize = result.fileSize;
        setProblemFilePath(result.filePath);
        setProblemFileSize(result.fileSize);
      }

      // 2) Upload each solution PDF that hasn't been uploaded yet.
      //    Track results in a local map so we don't depend on stale state.
      const uploadResults = new Map<string, { filePath: string; fileSize: number }>();

      for (const sol of solutions) {
        if (sol.file && !sol.file_path) {
          try {
            const result = await uploadPdfFile(
              sol.file,
              `case-studies/${cohortId}/solutions`,
              (stage) => updateSolution(sol.key, { uploadStage: stage }),
              (pct) => updateSolution(sol.key, { uploadPercent: pct }),
            );
            uploadResults.set(sol.key, result);
            updateSolution(sol.key, {
              file_path: result.filePath,
              file_size: result.fileSize,
              uploadStage: 'complete',
              uploadPercent: 100,
            });
          } catch (err) {
            updateSolution(sol.key, { uploadStage: 'error' });
            throw err;
          }
        }
      }

      // 3) Build pending solutions list (new solutions only)
      const pendingSolutions: PendingSolution[] = [];

      for (const sol of solutions) {
        // Skip existing (already persisted) solutions
        if (sol.existingId) continue;

        const uploadResult = uploadResults.get(sol.key);
        const path = uploadResult?.filePath || sol.file_path;
        const size = uploadResult?.fileSize || sol.file_size;

        if (path) {
          pendingSolutions.push({
            title: sol.title,
            file_path: path,
            file_size: size,
            subgroup_id: sol.subgroup_id,
          });
        }
      }

      // 4) Call parent onSave
      const formData: CaseStudyFormData = {
        title: title.trim(),
        description: description.trim(),
        problem_file_path: finalProblemPath,
        problem_file_size: finalProblemSize,
        solution_visible: solutionVisible,
        due_date: dueDate,
      };

      onSave(formData, pendingSolutions.length > 0 ? pendingSolutions : undefined);
    } catch (err) {
      console.error('Error during upload/save:', err);
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  // ── Derived state ───────────────────────────────────────────────────────

  const isWorking = saving || uploading;
  const hasExistingProblem = !!problemFilePath;

  const problemUploadLabel = (() => {
    switch (problemUploadStage) {
      case 'compressing': return 'Optimizing PDF...';
      case 'requesting-url': return 'Preparing upload...';
      case 'uploading': return `Uploading... ${problemUploadPercent}%`;
      case 'complete': return 'Upload complete';
      default: return '';
    }
  })();

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="dark:bg-gray-900 dark:border-gray-700 sm:max-w-[650px] max-h-[90vh] overflow-y-auto">
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
            {editingCaseStudy
              ? 'Update case study details, problem PDF, and solution documents'
              : 'Add a case study with problem statement and solution PDFs'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* ── Title ──────────────────────────────────────────────────── */}
          <div className="space-y-2">
            <Label htmlFor="cs-title" className="dark:text-gray-300 font-medium flex items-center gap-1">
              Title <span className="text-red-500">*</span>
            </Label>
            <Input
              id="cs-title"
              placeholder="e.g., Case Study 1: Culture Compass"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="dark:bg-gray-950 dark:border-gray-700 dark:text-white h-11 text-base"
            />
          </div>

          {/* ── Description ────────────────────────────────────────────── */}
          <div className="space-y-2">
            <Label htmlFor="cs-description" className="dark:text-gray-300 font-medium">
              Description
            </Label>
            <Textarea
              id="cs-description"
              placeholder="Brief description of the case study and learning objectives..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="dark:bg-gray-950 dark:border-gray-700 dark:text-white min-h-[80px] text-base resize-none"
            />
          </div>

          {/* ── Problem PDF ────────────────────────────────────────────── */}
          <div className="space-y-2">
            <Label className="dark:text-gray-300 font-medium flex items-center gap-2">
              <FileText className="w-4 h-4 text-orange-500" />
              Problem Document (PDF)
            </Label>

            {/* Hidden file input */}
            <input
              ref={problemInputRef}
              type="file"
              accept=".pdf"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleProblemFileSelect(file);
              }}
              className="hidden"
            />

            {/* Show existing/uploaded file info */}
            {(hasExistingProblem && !problemFile) ? (
              <div className="flex items-center gap-3 p-3 rounded-lg border border-green-500/30 dark:border-green-500/30 bg-green-50 dark:bg-green-950/20">
                <FileText className="w-5 h-5 text-green-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-green-700 dark:text-green-400 truncate">
                    {filenameFromPath(problemFilePath!)}
                  </p>
                  {problemFileSize && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {formatFileSize(problemFileSize)}
                    </p>
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    clearProblemFile();
                    problemInputRef.current?.click();
                  }}
                  className="shrink-0 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  Replace
                </Button>
              </div>
            ) : problemFile ? (
              /* File selected (pending or uploading) */
              <div className="space-y-2">
                <div className="flex items-center gap-3 p-3 rounded-lg border border-blue-500/30 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-950/20">
                  <FileText className="w-5 h-5 text-blue-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-blue-700 dark:text-blue-400 truncate">
                      {problemFile.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {formatFileSize(problemFile.size)}
                    </p>
                  </div>
                  {problemUploadStage === 'complete' ? (
                    <Check className="w-5 h-5 text-green-500 shrink-0" />
                  ) : problemUploadStage === 'error' ? (
                    <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={clearProblemFile}
                      disabled={problemUploadStage !== 'idle'}
                      className="shrink-0 h-8 w-8 p-0 dark:text-gray-400 dark:hover:bg-gray-800"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>

                {/* Upload progress */}
                {problemUploadStage !== 'idle' && problemUploadStage !== 'complete' && problemUploadStage !== 'error' && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-600 dark:text-gray-400">{problemUploadLabel}</span>
                      {problemUploadStage === 'uploading' && (
                        <span className="font-medium tabular-nums text-blue-600 dark:text-blue-400">
                          {problemUploadPercent}%
                        </span>
                      )}
                    </div>
                    <Progress
                      value={problemUploadStage === 'uploading' ? problemUploadPercent : undefined}
                      className="h-2 dark:bg-gray-700"
                    />
                  </div>
                )}
              </div>
            ) : (
              /* Drop zone */
              <div
                onClick={() => problemInputRef.current?.click()}
                onDrop={handleProblemDrop}
                onDragOver={handleProblemDragOver}
                className={cn(
                  'w-full h-24 border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-2 cursor-pointer transition-all',
                  'dark:border-gray-700 dark:bg-gray-950 dark:text-white',
                  'hover:border-orange-500 dark:hover:border-orange-500 hover:bg-orange-50 dark:hover:bg-orange-950/20',
                )}
              >
                <Upload className="w-8 h-8 text-gray-400" />
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Click to select or drag & drop PDF file
                </span>
                <span className="text-xs text-gray-400">Max 100MB</span>
              </div>
            )}
          </div>

          {/* ── Solution Documents ─────────────────────────────────────── */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="dark:text-gray-300 font-medium flex items-center gap-2">
                <FileText className="w-4 h-4 text-green-500" />
                Solution Documents
              </Label>
              <div>
                <input
                  ref={solutionInputRef}
                  type="file"
                  accept=".pdf"
                  multiple
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      handleSolutionFilesSelect(e.target.files);
                    }
                  }}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => solutionInputRef.current?.click()}
                  disabled={isWorking}
                  className="dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Solutions
                </Button>
              </div>
            </div>

            {solutions.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-500 py-2">
                No solution documents added yet.
              </p>
            ) : (
              <div className="space-y-3">
                {solutions.map((sol) => (
                  <div
                    key={sol.key}
                    className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-950/50 p-3 space-y-2"
                  >
                    {/* Row 1: File info + remove */}
                    <div className="flex items-start gap-3">
                      <FileText className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0 space-y-2">
                        {/* Filename display */}
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {sol.file ? sol.file.name : (sol.file_path ? filenameFromPath(sol.file_path) : 'Unknown')}
                          </span>
                          <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">
                            {formatFileSize(sol.file_size)}
                          </span>
                          {sol.uploadStage === 'complete' && (
                            <Check className="w-3.5 h-3.5 text-green-500 shrink-0" />
                          )}
                          {sol.uploadStage === 'error' && (
                            <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                          )}
                        </div>

                        {/* Title input */}
                        <Input
                          placeholder="Solution title"
                          value={sol.title}
                          onChange={(e) => updateSolution(sol.key, { title: e.target.value })}
                          disabled={isWorking}
                          className="dark:bg-gray-900 dark:border-gray-700 dark:text-white h-9 text-sm"
                        />

                        {/* Subgroup selector — only if subgroups exist */}
                        {subgroupsLoaded && subgroups.length > 0 && (
                          <Select
                            value={sol.subgroup_id || '__general__'}
                            onValueChange={(value) =>
                              updateSolution(sol.key, {
                                subgroup_id: value === '__general__' ? null : value,
                              })
                            }
                            disabled={isWorking}
                          >
                            <SelectTrigger className="dark:bg-gray-900 dark:border-gray-700 dark:text-white h-9 text-sm">
                              <SelectValue placeholder="Assign to subgroup" />
                            </SelectTrigger>
                            <SelectContent className="dark:bg-gray-900 dark:border-gray-700">
                              <SelectItem value="__general__" className="dark:text-white dark:focus:bg-gray-800">
                                General (all students)
                              </SelectItem>
                              {subgroups.map((sg) => (
                                <SelectItem
                                  key={sg.id}
                                  value={sg.id}
                                  className="dark:text-white dark:focus:bg-gray-800"
                                >
                                  {sg.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}

                        {/* Upload progress for this solution */}
                        {sol.uploadStage !== 'idle' && sol.uploadStage !== 'complete' && sol.uploadStage !== 'error' && (
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span className="text-gray-600 dark:text-gray-400">
                                {sol.uploadStage === 'compressing' && 'Optimizing PDF...'}
                                {sol.uploadStage === 'requesting-url' && 'Preparing...'}
                                {sol.uploadStage === 'uploading' && `Uploading... ${sol.uploadPercent}%`}
                              </span>
                              {sol.uploadStage === 'uploading' && (
                                <span className="font-medium tabular-nums text-blue-600 dark:text-blue-400">
                                  {sol.uploadPercent}%
                                </span>
                              )}
                            </div>
                            <Progress
                              value={sol.uploadStage === 'uploading' ? sol.uploadPercent : undefined}
                              className="h-1.5 dark:bg-gray-700"
                            />
                          </div>
                        )}
                      </div>

                      {/* Remove button */}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeSolution(sol.key)}
                        disabled={isWorking}
                        className="shrink-0 h-8 w-8 p-0 text-gray-400 hover:text-red-500 dark:hover:bg-gray-800"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Due Date & Solution Visibility ─────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="space-y-2">
              <Label htmlFor="cs-due" className="dark:text-gray-300 font-medium">
                Due Date
              </Label>
              <Input
                id="cs-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="dark:bg-gray-950 dark:border-gray-700 dark:text-white h-11 text-base"
              />
              <p className="text-xs text-muted-foreground dark:text-gray-500">
                Optional submission deadline
              </p>
            </div>
            <div className="space-y-2">
              <Label className="dark:text-gray-300 font-medium">Solution Visibility</Label>
              <div className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-950/50 h-11">
                <Switch
                  id="cs-visible"
                  checked={solutionVisible}
                  onCheckedChange={(checked) => setSolutionVisible(checked)}
                />
                <Label htmlFor="cs-visible" className="text-sm cursor-pointer dark:text-gray-300">
                  Visible to Students
                </Label>
              </div>
            </div>
          </div>
        </div>

        {/* ── Footer ──────────────────────────────────────────────────── */}
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isWorking}
            className="dark:border-gray-700 dark:text-white dark:hover:bg-gray-800 h-11"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isWorking || !title.trim()}
            className="bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white h-11 px-6 shadow-md"
          >
            {isWorking ? (
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                {problemUploadStage === 'compressing' && 'Optimizing...'}
                {problemUploadStage === 'requesting-url' && 'Preparing...'}
                {problemUploadStage === 'uploading' && (
                  <span className="tabular-nums">{problemUploadPercent}%</span>
                )}
                {(problemUploadStage === 'idle' || problemUploadStage === 'complete') &&
                  (saving ? 'Saving...' : 'Uploading...')}
              </div>
            ) : (
              editingCaseStudy ? 'Update Case Study' : 'Create Case Study'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
