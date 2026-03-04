'use client';

import { useState, useEffect } from 'react';
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Loader2, AlertTriangle, EyeOff, FileText, ExternalLink, Eye } from 'lucide-react';

interface ReviewData {
  id: string;
  reviewer_role: string;
  score: number | null;
  reviewer_name: string | null;
  overridden: boolean;
  comment?: string;
}

interface AttachmentData {
  id: string;
  type: 'file' | 'link';
  file_name: string | null;
  file_path: string | null;
  file_size: number | null;
  link_url: string | null;
  link_label: string | null;
}

interface ReviewFormProps {
  open: boolean;
  onClose: () => void;
  caseStudyId: string;
  submissionId: string;
  subgroupName: string;
  maxScore: number;
  existingReview: ReviewData | null;
  mentorReview: ReviewData | null;
  onSaved: () => void;
}

export function ReviewForm({
  open,
  onClose,
  caseStudyId,
  submissionId,
  subgroupName,
  maxScore,
  existingReview,
  mentorReview,
  onSaved,
}: ReviewFormProps) {
  const [score, setScore] = useState<string>('');
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [overrideConfirmOpen, setOverrideConfirmOpen] = useState(false);
  const [overriding, setOverriding] = useState(false);

  // Submission attachments
  const [attachments, setAttachments] = useState<AttachmentData[]>([]);
  const [loadingAttachments, setLoadingAttachments] = useState(false);

  useEffect(() => {
    if (open && existingReview) {
      setScore(existingReview.score?.toString() ?? '');
      setComment(existingReview.comment ?? '');
    } else if (open) {
      setScore('');
      setComment('');
    }
  }, [open, existingReview]);

  // Fetch submission attachments when opened
  useEffect(() => {
    if (!open || !submissionId) {
      setAttachments([]);
      return;
    }
    setLoadingAttachments(true);
    fetch(`/api/admin/case-studies/${caseStudyId}/submissions/${submissionId}/attachments`)
      .then(res => res.json())
      .then(data => setAttachments(data.attachments || []))
      .catch(() => setAttachments([]))
      .finally(() => setLoadingAttachments(false));
  }, [open, submissionId, caseStudyId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const scoreNum = score ? parseInt(score) : null;
      if (scoreNum !== null && (isNaN(scoreNum) || scoreNum < 0 || scoreNum > maxScore)) {
        toast.error(`Score must be between 0 and ${maxScore}`);
        setSaving(false);
        return;
      }

      if (existingReview) {
        const res = await fetch(`/api/admin/case-studies/reviews/${existingReview.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ score: scoreNum, comment: comment || null }),
        });
        if (!res.ok) throw new Error('Failed to update review');
      } else {
        const res = await fetch('/api/admin/case-studies/reviews', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            submission_id: submissionId,
            score: scoreNum,
            comment: comment || null,
          }),
        });
        if (!res.ok) throw new Error('Failed to save review');
      }

      toast.success('Review saved');
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save review');
    } finally {
      setSaving(false);
    }
  };

  const handleOverride = async () => {
    if (!mentorReview) return;
    setOverriding(true);
    try {
      const res = await fetch(`/api/admin/case-studies/reviews/${mentorReview.id}/override`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ overridden: !mentorReview.overridden }),
      });
      if (!res.ok) throw new Error('Failed to override');
      toast.success(mentorReview.overridden ? 'Mentor review restored' : 'Mentor review hidden');
      setOverrideConfirmOpen(false);
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to override');
    } finally {
      setOverriding(false);
    }
  };

  // Open file via signed URL
  const [openingFileId, setOpeningFileId] = useState<string | null>(null);
  const handleOpenFile = async (att: AttachmentData) => {
    if (!att.file_path) return;
    setOpeningFileId(att.id);
    try {
      const res = await fetch(`/api/admin/resources/signed-url?path=${encodeURIComponent(att.file_path)}`);
      const data = await res.json();
      if (!res.ok || !data.signedUrl) throw new Error('Failed to get URL');
      window.open(data.signedUrl, '_blank');
    } catch {
      toast.error('Failed to open file');
    } finally {
      setOpeningFileId(null);
    }
  };

  const fileAttachments = attachments.filter(a => a.type === 'file');
  const linkAttachments = attachments.filter(a => a.type === 'link');

  return (
    <>
      <Sheet open={open} onOpenChange={v => !v && onClose()}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Review — {subgroupName}</SheetTitle>
          </SheetHeader>

          <div className="px-4 pb-6 space-y-5">
            {/* ── Section 1: Submission Content ──────────────────── */}
            <div className="rounded-lg border bg-card p-4 space-y-3">
              <Label className="text-sm font-semibold">Submission</Label>

              {loadingAttachments ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-sm text-muted-foreground">Loading...</span>
                </div>
              ) : attachments.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">No attachments found</p>
              ) : (
                <div className="space-y-1.5">
                  {fileAttachments.map(att => (
                    <div key={att.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg border bg-muted/30 group hover:border-blue-500/30 hover:bg-blue-500/5 transition-colors cursor-pointer" onClick={() => handleOpenFile(att)}>
                      <div className="w-8 h-8 rounded-md bg-blue-500/10 flex items-center justify-center shrink-0">
                        {openingFileId === att.id ? (
                          <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                        ) : (
                          <FileText className="w-4 h-4 text-blue-500" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{att.file_name}</p>
                        {att.file_size && (
                          <p className="text-[11px] text-muted-foreground">{(att.file_size / 1024 / 1024).toFixed(1)} MB</p>
                        )}
                      </div>
                      <Eye className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    </div>
                  ))}
                  {linkAttachments.map(att => (
                    <a
                      key={att.id}
                      href={att.link_url!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg border bg-muted/30 hover:bg-accent/50 transition-colors group"
                    >
                      <div className="w-8 h-8 rounded-md bg-purple-500/10 flex items-center justify-center shrink-0">
                        <ExternalLink className="w-4 h-4 text-purple-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{att.link_label || att.link_url}</p>
                        {att.link_label && (
                          <p className="text-[11px] text-muted-foreground truncate">{att.link_url}</p>
                        )}
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </div>

            <Separator />

            {/* ── Section 2: Admin Review Form ───────────────────── */}
            <div className="space-y-4">
              <Label className="text-sm font-semibold">Your Review</Label>

              <div className="rounded-lg border bg-card p-4 space-y-4">
                <div>
                  <Label htmlFor="review-score" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Score (out of {maxScore})
                  </Label>
                  <Input
                    id="review-score"
                    type="number"
                    min={0}
                    max={maxScore}
                    placeholder="Optional"
                    value={score}
                    onChange={e => setScore(e.target.value)}
                    className="mt-1.5 h-10"
                  />
                </div>

                <div>
                  <Label htmlFor="review-comment" className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Comments
                  </Label>
                  <Textarea
                    id="review-comment"
                    placeholder="Write your feedback..."
                    value={comment}
                    onChange={e => setComment(e.target.value)}
                    className="mt-1.5 min-h-[140px]"
                  />
                </div>
              </div>

              <Button onClick={handleSave} disabled={saving} className="w-full h-11 font-semibold">
                {saving && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
                {existingReview ? 'Update Review' : 'Save Review'}
              </Button>
            </div>

            {/* ── Section 3: Mentor Review (if exists) ───────────── */}
            {mentorReview && (
              <>
                <Separator />
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold">Mentor Review</Label>
                    {mentorReview.overridden && (
                      <Badge variant="outline" className="text-[10px] text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-700">
                        <EyeOff className="w-3 h-3 mr-1" />
                        Hidden
                      </Badge>
                    )}
                  </div>

                  <div className={`rounded-lg border p-4 space-y-2 ${mentorReview.overridden ? 'opacity-50 bg-muted/30' : 'bg-purple-50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-900'}`}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">By {mentorReview.reviewer_name}</span>
                      {mentorReview.score !== null && (
                        <span className="font-semibold">{mentorReview.score}<span className="text-muted-foreground font-normal">/{maxScore}</span></span>
                      )}
                    </div>
                    {mentorReview.comment && (
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">{mentorReview.comment}</p>
                    )}
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setOverrideConfirmOpen(true)}
                    className="w-full h-9 text-xs"
                  >
                    <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />
                    {mentorReview.overridden ? 'Restore Mentor Review' : 'Hide Mentor Review from Students'}
                  </Button>
                </div>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Override Confirmation */}
      <AlertDialog open={overrideConfirmOpen} onOpenChange={setOverrideConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {mentorReview?.overridden ? 'Restore mentor review?' : 'Hide mentor feedback?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {mentorReview?.overridden
                ? 'Students will see both your review and the mentor\'s review.'
                : 'Students will only see your review. The mentor\'s original review is preserved for audit.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleOverride} disabled={overriding}>
              {overriding && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              {mentorReview?.overridden ? 'Restore' : 'Hide'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
