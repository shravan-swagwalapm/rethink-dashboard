'use client';

import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
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
import {
  FileText,
  Upload,
  CheckCircle2,
  Loader2,
  X,
  ExternalLink,
  Plus,
} from 'lucide-react';
import type { CaseStudy, SubmissionAttachment, SubmissionVisibility, StudentSubmissionStatus } from '@/types';

export interface CaseStudyWithSubmission extends CaseStudy {
  submission: {
    id: string;
    visibility: SubmissionVisibility;
    submitted_at: string | null;
    submitted_by_name: string | null;
    is_late: boolean;
    deadline_override: string | null;
    student_status: StudentSubmissionStatus;
    attachment_count: number;
    link_count: number;
  } | null;
}

interface SubmissionPanelProps {
  caseStudy: CaseStudyWithSubmission | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cohortId: string;
  onSubmissionChange: () => void;
}

export function SubmissionPanel({
  caseStudy,
  open,
  onOpenChange,
  cohortId,
  onSubmissionChange,
}: SubmissionPanelProps) {
  const [attachments, setAttachments] = useState<SubmissionAttachment[]>([]);
  const [loadingAttachments, setLoadingAttachments] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [retryAttempt, setRetryAttempt] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Link form
  const [linkUrl, setLinkUrl] = useState('');
  const [linkLabel, setLinkLabel] = useState('');
  const [addingLink, setAddingLink] = useState(false);

  // Confirm submit
  const [confirmSubmitOpen, setConfirmSubmitOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Drag state
  const [isDragging, setIsDragging] = useState(false);

  // Delete confirmation
  const [deleteAttachmentId, setDeleteAttachmentId] = useState<string | null>(null);

  // Load attachments when panel opens with existing submission
  const loadAttachments = useCallback(async (submissionId: string) => {
    setLoadingAttachments(true);
    try {
      const res = await fetch(`/api/case-studies/submissions/${submissionId}/attachments`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setAttachments(data.attachments || []);
    } catch {
      toast.error('Failed to load attachments');
    } finally {
      setLoadingAttachments(false);
    }
  }, []);

  // Reset state when panel opens/closes
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setAttachments([]);
      setLinkUrl('');
      setLinkLabel('');
      setRetryAttempt(0);
    }
    onOpenChange(newOpen);
  };

  // Called by parent when opening with a case study
  // We need to load attachments if submission exists
  const onSheetOpened = useCallback(() => {
    if (caseStudy?.submission?.id) {
      loadAttachments(caseStudy.submission.id);
    }
  }, [caseStudy?.submission?.id, loadAttachments]);

  // Upload a single file (reused by click and drag-drop)
  const uploadFile = async (file: File) => {
    if (!caseStudy || !cohortId) return;

    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ];

    if (!allowedTypes.includes(file.type)) {
      toast.error('Invalid file type. Allowed: PDF, DOC, DOCX, PPT, PPTX');
      return;
    }

    if (file.size > 100 * 1024 * 1024) {
      toast.error('File too large. Maximum is 100MB');
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setRetryAttempt(0);

    try {
      // Ensure submission exists
      let submissionId = caseStudy.submission?.id;
      if (!submissionId) {
        const subRes = await fetch('/api/case-studies/submissions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ case_study_id: caseStudy.id }),
        });
        const subData = await subRes.json();
        if (!subRes.ok) throw new Error(subData.error);
        submissionId = subData.submission.id;
      }

      // Get signed upload URL
      const urlRes = await fetch('/api/case-studies/submissions/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          fileSize: file.size,
          contentType: file.type,
          cohortId,
        }),
      });
      const urlData = await urlRes.json();
      if (!urlRes.ok) throw new Error(urlData.error);

      // Upload via XHR with progress + retry (3 attempts, exponential backoff)
      const uploadWithRetry = async (url: string, maxRetries = 3) => {
        for (let attempt = 0; attempt < maxRetries; attempt++) {
          try {
            if (attempt > 0) setRetryAttempt(attempt);
            await new Promise<void>((resolve, reject) => {
              const xhr = new XMLHttpRequest();
              xhr.upload.onprogress = (e) => {
                if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100));
              };
              xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error('Upload failed'));
              xhr.onerror = () => reject(new Error('Upload failed'));

              xhr.open('PUT', url);
              xhr.setRequestHeader('Content-Type', file.type);
              xhr.send(file);
            });
            return; // Success
          } catch (err) {
            if (attempt === maxRetries - 1) throw err;
            setUploadProgress(0);
            await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
          }
        }
      };
      await uploadWithRetry(urlData.uploadUrl);

      // Save attachment metadata
      const attRes = await fetch('/api/case-studies/submissions/attachments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submission_id: submissionId,
          type: 'file',
          file_path: urlData.filePath,
          file_name: file.name,
          file_size: file.size,
          file_type: file.type,
        }),
      });
      const attData = await attRes.json();
      if (!attRes.ok) throw new Error(attData.error);

      setAttachments(prev => [...prev, attData.attachment]);
      toast.success('File uploaded');
      onSubmissionChange();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      setUploadProgress(0);
      setRetryAttempt(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // File input handler
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await uploadFile(file);
  };

  // Drag-and-drop handlers
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) await uploadFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    // Only set false if leaving the drop zone (not entering a child)
    if (e.currentTarget === e.target) {
      setIsDragging(false);
    }
  };

  // Add link
  const handleAddLink = async () => {
    if (!linkUrl || !caseStudy) return;

    try {
      const parsed = new URL(linkUrl);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        toast.error('Only http and https links are allowed');
        return;
      }
    } catch {
      toast.error('Invalid URL format');
      return;
    }

    setAddingLink(true);
    try {
      let submissionId = caseStudy.submission?.id;
      if (!submissionId) {
        const subRes = await fetch('/api/case-studies/submissions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ case_study_id: caseStudy.id }),
        });
        const subData = await subRes.json();
        if (!subRes.ok) throw new Error(subData.error);
        submissionId = subData.submission.id;
      }

      const res = await fetch('/api/case-studies/submissions/attachments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submission_id: submissionId,
          type: 'link',
          link_url: linkUrl,
          link_label: linkLabel || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setAttachments(prev => [...prev, data.attachment]);
      setLinkUrl('');
      setLinkLabel('');
      toast.success('Link added');
      onSubmissionChange();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add link');
    } finally {
      setAddingLink(false);
    }
  };

  // Remove attachment (with confirmation)
  const handleRemoveAttachment = async (attachmentId: string) => {
    try {
      const res = await fetch(`/api/case-studies/submissions/attachments/${attachmentId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setAttachments(prev => prev.filter(a => a.id !== attachmentId));
      toast.success(data.reverted_to_draft ? 'Attachment removed. Submission reverted to draft.' : 'Attachment removed');
      onSubmissionChange();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove attachment');
    } finally {
      setDeleteAttachmentId(null);
    }
  };

  // Submit
  const handleSubmit = async () => {
    if (!caseStudy) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/case-studies/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ case_study_id: caseStudy.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast.success('Submission saved');
      setConfirmSubmitOpen(false);
      handleOpenChange(false);
      onSubmissionChange();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  // Whether the current submission is already submitted (for delete warning)
  const isSubmitted = caseStudy?.submission?.student_status === 'submitted' ||
    caseStudy?.submission?.student_status === 'under_review';

  return (
    <>
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto" onAnimationEnd={() => { if (open) onSheetOpened(); }}>
          <SheetHeader>
            <SheetTitle>{caseStudy?.title ?? 'Submit Solution'}</SheetTitle>
          </SheetHeader>

          <div className="px-4 pb-6 space-y-5">
            {/* Upload Files */}
            <div className="rounded-lg border bg-card p-4 space-y-3">
              <div>
                <Label className="text-sm font-semibold">Upload Files</Label>
                <p className="text-xs text-muted-foreground mt-0.5">PDF, DOC, DOCX, PPT, PPTX (100MB max)</p>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.ppt,.pptx"
                onChange={handleFileSelect}
                className="hidden"
              />

              {uploading ? (
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-5 text-center space-y-3">
                  <Loader2 className="w-6 h-6 mx-auto animate-spin text-primary" />
                  <p className="text-sm font-medium">
                    {retryAttempt > 0
                      ? `Retrying (attempt ${retryAttempt + 1}/3)... ${uploadProgress}%`
                      : `Uploading... ${uploadProgress}%`}
                  </p>
                  <div className="w-full bg-secondary rounded-full h-1.5">
                    <div
                      className="bg-primary h-1.5 rounded-full transition-all"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              ) : (
                <>
                  {/* Mobile: prominent button */}
                  <Button
                    variant="outline"
                    className="w-full sm:hidden h-11"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Choose File
                  </Button>
                  {/* Desktop: drag zone */}
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragEnter={handleDragEnter}
                    onDragLeave={handleDragLeave}
                    className={`hidden sm:flex flex-col items-center gap-2 border-2 border-dashed rounded-lg py-8 cursor-pointer transition-all ${
                      isDragging
                        ? 'border-primary bg-primary/10'
                        : 'border-muted-foreground/25 hover:border-primary/40 hover:bg-primary/5'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Upload className="w-5 h-5 text-primary" />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {isDragging
                        ? <span className="text-primary font-medium">Drop file here</span>
                        : <>Drag & drop or <span className="text-primary font-medium">choose a file</span></>}
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* Add Links */}
            <div className="rounded-lg border bg-card p-4 space-y-3">
              <Label className="text-sm font-semibold">Add Links</Label>
              <div className="space-y-2">
                <Input
                  placeholder="https://..."
                  value={linkUrl}
                  onChange={e => setLinkUrl(e.target.value)}
                  className="h-10"
                />
                <Input
                  placeholder="Link label (optional)"
                  value={linkLabel}
                  onChange={e => setLinkLabel(e.target.value)}
                  className="h-10"
                />
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleAddLink}
                  disabled={!linkUrl || addingLink}
                  className="h-9"
                >
                  {addingLink ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Plus className="w-4 h-4 mr-1.5" />}
                  Add Link
                </Button>
              </div>
            </div>

            {/* Current Attachments */}
            {loadingAttachments && (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">Loading attachments...</span>
              </div>
            )}
            {!loadingAttachments && attachments.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-semibold">
                  Attachments ({attachments.length})
                </Label>
                <div className="space-y-1.5">
                  {attachments.map(att => (
                    <div key={att.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg border bg-muted/30 group">
                      <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                        {att.type === 'file' ? (
                          <FileText className="w-4 h-4 text-primary" />
                        ) : (
                          <ExternalLink className="w-4 h-4 text-primary" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {att.type === 'file' ? att.file_name : (att.link_label || att.link_url)}
                        </p>
                        {att.type === 'file' && att.file_size && (
                          <p className="text-[11px] text-muted-foreground">{(att.file_size / 1024 / 1024).toFixed(1)} MB</p>
                        )}
                        {att.type === 'link' && att.link_label && (
                          <p className="text-[11px] text-muted-foreground truncate">{att.link_url}</p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 opacity-50 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive transition-all"
                        onClick={() => setDeleteAttachmentId(att.id)}
                      >
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Submit */}
            <div className="pt-2 space-y-2">
              <Button
                className="w-full h-11 text-sm font-semibold"
                disabled={attachments.length === 0}
                onClick={() => setConfirmSubmitOpen(true)}
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Submit Solution
              </Button>

              {attachments.length === 0 && (
                <p className="text-xs text-muted-foreground text-center">
                  Add at least 1 file or link to submit
                </p>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Confirm Submit Dialog */}
      <AlertDialog open={confirmSubmitOpen} onOpenChange={setConfirmSubmitOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit your solution?</AlertDialogTitle>
            <AlertDialogDescription>
              You can update your submission until the deadline closes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSubmit} disabled={submitting}>
              {submitting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
              Submit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Attachment Confirmation */}
      <AlertDialog open={!!deleteAttachmentId} onOpenChange={(open) => { if (!open) setDeleteAttachmentId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove attachment?</AlertDialogTitle>
            <AlertDialogDescription>
              {isSubmitted
                ? 'Removing this attachment will revert your submission to draft status. You will need to re-submit.'
                : 'This attachment will be permanently removed.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteAttachmentId && handleRemoveAttachment(deleteAttachmentId)}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
