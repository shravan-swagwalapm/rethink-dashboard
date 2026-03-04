'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, FileText, ExternalLink } from 'lucide-react';
import type { SubmissionAttachment, CaseStudyReview } from '@/types';

interface CaseStudyViewerModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  caseStudyId: string;
  problemFilePath: string | null;
  attachments?: SubmissionAttachment[];
  reviews?: CaseStudyReview[];
  maxScore?: number;
  defaultTab?: 'problem' | 'submission' | 'feedback';
}

export function CaseStudyViewerModal({
  open,
  onClose,
  title,
  caseStudyId,
  problemFilePath,
  attachments = [],
  reviews = [],
  maxScore = 100,
  defaultTab = 'problem',
}: CaseStudyViewerModalProps) {
  const [problemUrl, setProblemUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !problemFilePath) return;
    setProblemUrl(null);
    setLoading(true);
    fetch(`/api/case-studies/${caseStudyId}/signed-url?type=problem`)
      .then(res => res.json())
      .then(data => setProblemUrl(data.signedUrl ?? null))
      .catch(() => setProblemUrl(null))
      .finally(() => setLoading(false));
  }, [open, caseStudyId, problemFilePath]);

  const fileAttachments = attachments.filter(a => a.type === 'file');
  const linkAttachments = attachments.filter(a => a.type === 'link');

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-[95vw] sm:max-w-[95vw] h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="text-lg">{title}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue={defaultTab} className="flex-1 flex flex-col min-h-0 px-6 pb-6">
          <TabsList className="w-fit">
            <TabsTrigger value="problem">Problem</TabsTrigger>
            {attachments.length > 0 && <TabsTrigger value="submission">Submission</TabsTrigger>}
            {reviews.length > 0 && <TabsTrigger value="feedback">Feedback</TabsTrigger>}
          </TabsList>

          {/* Problem Tab */}
          <TabsContent value="problem" className="flex-1 min-h-0 mt-4">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : problemUrl ? (
              <iframe
                src={problemUrl}
                className="w-full h-full rounded-lg border"
                title="Problem Statement"
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
                <FileText className="w-12 h-12" />
                <p>No problem file uploaded</p>
              </div>
            )}
          </TabsContent>

          {/* Submission Tab */}
          {attachments.length > 0 && (
            <TabsContent value="submission" className="flex-1 min-h-0 mt-4 overflow-y-auto space-y-4">
              {fileAttachments.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium mb-2">Files ({fileAttachments.length})</h3>
                  <div className="space-y-2">
                    {fileAttachments.map(att => (
                      <div key={att.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                        <FileText className="w-5 h-5 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{att.file_name}</p>
                          {att.file_size && (
                            <p className="text-xs text-muted-foreground">
                              {(att.file_size / 1024 / 1024).toFixed(1)} MB
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {linkAttachments.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium mb-2">Links ({linkAttachments.length})</h3>
                  <div className="space-y-2">
                    {linkAttachments.map(att => (
                      <a
                        key={att.id}
                        href={att.link_url!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                      >
                        <ExternalLink className="w-5 h-5 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {att.link_label || att.link_url}
                          </p>
                          {att.link_label && (
                            <p className="text-xs text-muted-foreground truncate">{att.link_url}</p>
                          )}
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>
          )}

          {/* Feedback Tab */}
          {reviews.length > 0 && (
            <TabsContent value="feedback" className="flex-1 min-h-0 mt-4 overflow-y-auto space-y-4">
              {reviews.map(review => (
                <div key={review.id} className="p-4 rounded-lg border bg-card space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium capitalize">{review.reviewer_role} Review</span>
                      {review.reviewer_name && (
                        <span className="text-sm text-muted-foreground ml-2">by {review.reviewer_name}</span>
                      )}
                    </div>
                    {review.score !== null && (
                      <span className="text-lg font-bold">
                        {review.score}<span className="text-sm text-muted-foreground font-normal">/{maxScore}</span>
                      </span>
                    )}
                  </div>
                  {review.comment && (
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{review.comment}</p>
                  )}
                  {review.rubric_scores && review.rubric_scores.length > 0 && (
                    <div className="space-y-2 pt-2 border-t">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Rubric Breakdown</p>
                      {review.rubric_scores.map(rs => (
                        <div key={rs.id} className="flex items-center justify-between text-sm">
                          <span>{rs.criteria_label}</span>
                          <span className="font-medium">{rs.score}/{rs.criteria_max_score}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </TabsContent>
          )}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
