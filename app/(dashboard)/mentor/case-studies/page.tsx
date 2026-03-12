'use client';

import { useState, useEffect, useCallback } from 'react';
import { useUserContext } from '@/contexts/user-context';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { CountdownTimer } from '@/components/case-studies/countdown-timer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  FileText,
  CheckCircle2,
  Clock,
  Eye,
  Loader2,
  AlertTriangle,
  RefreshCw,
  Users,
  ExternalLink,
  Send,
} from 'lucide-react';
import type { CaseStudy } from '@/types';

interface SubgroupSubmissionInfo {
  subgroup_id: string;
  subgroup_name: string;
  submission: {
    id: string;
    visibility: string;
    submitted_at: string | null;
    is_late: boolean;
    submitted_by_name: string | null;
    can_review: boolean;
  } | null;
  my_review: {
    id: string;
    score: number | null;
    comment: string | null;
  } | null;
}

interface MentorCaseStudy extends CaseStudy {
  subgroup_submissions: SubgroupSubmissionInfo[];
}

export default function MentorCaseStudiesPage() {
  const { activeCohortId } = useUserContext();
  const [caseStudies, setCaseStudies] = useState<MentorCaseStudy[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);

  // Review sheet
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewSubmission, setReviewSubmission] = useState<SubgroupSubmissionInfo | null>(null);
  const [reviewMaxScore, setReviewMaxScore] = useState(100);

  // Submission detail
  const [detailData, setDetailData] = useState<Record<string, unknown> | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Review form state
  const [score, setScore] = useState('');
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    if (!activeCohortId) return;
    setLoading(true);
    setFetchError(false);
    try {
      const res = await fetch(`/api/mentor/case-studies?cohort_id=${activeCohortId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCaseStudies(data.caseStudies || []);
    } catch {
      setFetchError(true);
      toast.error('Failed to load case studies');
    } finally {
      setLoading(false);
    }
  }, [activeCohortId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Open review sheet
  const openReview = async (cs: MentorCaseStudy, sgSub: SubgroupSubmissionInfo) => {
    if (!sgSub.submission?.can_review) return;

    // Reset and load submission details
    setDetailData(null);
    setDetailLoading(true);
    setReviewSubmission(sgSub);
    setReviewMaxScore(cs.max_score);
    setScore(sgSub.my_review?.score?.toString() ?? '');
    setComment(sgSub.my_review?.comment ?? '');
    setReviewOpen(true);

    try {
      const res = await fetch(`/api/mentor/case-studies/submissions/${sgSub.submission.id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDetailData(data.submission);
    } catch {
      toast.error('Failed to load submission details');
    } finally {
      setDetailLoading(false);
    }
  };

  // Save review
  const handleSaveReview = async () => {
    if (!reviewSubmission?.submission) return;
    setSaving(true);
    try {
      const scoreNum = score ? parseInt(score) : null;
      if (scoreNum !== null && (isNaN(scoreNum) || scoreNum < 0 || scoreNum > reviewMaxScore)) {
        toast.error(`Score must be between 0 and ${reviewMaxScore}`);
        setSaving(false);
        return;
      }

      const url = reviewSubmission.my_review
        ? `/api/mentor/case-studies/reviews/${reviewSubmission.my_review.id}`
        : '/api/mentor/case-studies/reviews';
      const method = reviewSubmission.my_review ? 'PUT' : 'POST';

      const body: Record<string, unknown> = {
        score: scoreNum,
        comment: comment || null,
      };
      if (!reviewSubmission.my_review) {
        body.submission_id = reviewSubmission.submission.id;
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }

      toast.success('Review saved');
      setReviewOpen(false);
      fetchData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save review');
    } finally {
      setSaving(false);
    }
  };

  // Status helper
  const getStatusConfig = (sgSub: SubgroupSubmissionInfo) => {
    if (!sgSub.submission) return { label: 'Awaiting', icon: Clock, color: 'text-muted-foreground' };
    if (sgSub.submission.can_review && !sgSub.my_review) return { label: 'Ready for Review', icon: Eye, color: 'text-blue-600 dark:text-blue-400' };
    if (sgSub.my_review) return { label: 'Reviewed', icon: CheckCircle2, color: 'text-emerald-600 dark:text-emerald-400' };
    if (sgSub.submission.visibility === 'submitted') return { label: 'Submitted', icon: Send, color: 'text-amber-600 dark:text-amber-400' };
    return { label: 'Awaiting', icon: Clock, color: 'text-muted-foreground' };
  };

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Case Studies"
        icon={FileText}
        description="Review your subgroups' case study submissions"
      />

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : fetchError && caseStudies.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <AlertTriangle className="w-16 h-16 mx-auto mb-4 opacity-50 text-destructive" />
          <p className="text-xl font-medium text-foreground">Failed to load case studies</p>
          <p className="text-sm mt-1">Check your connection and try again</p>
          <Button variant="outline" className="mt-4" onClick={fetchData}>
            <RefreshCw className="w-4 h-4 mr-1.5" />
            Try again
          </Button>
        </div>
      ) : caseStudies.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No case studies yet"
          description="Case studies will appear here when created by the admin."
        />
      ) : (
        <div className="space-y-6">
          {caseStudies.map(cs => (
            <div key={cs.id} className="rounded-xl border bg-card p-4 space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="font-semibold">{cs.title}</h3>
                  <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                    <span>Week {cs.week_number}{cs.end_week_number ? `–${cs.end_week_number}` : ''}</span>
                    <CountdownTimer
                      deadline={cs.due_date}
                      graceMinutes={cs.grace_period_minutes}
                    />
                  </div>
                </div>
              </div>

              {/* Subgroup status table */}
              <div className="space-y-2">
                {cs.subgroup_submissions.map(sgSub => {
                  const statusConfig = getStatusConfig(sgSub);
                  const StatusIcon = statusConfig.icon;

                  return (
                    <div key={sgSub.subgroup_id} className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-background">
                      <div className="flex items-center gap-2 min-w-0">
                        <Users className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span className="text-sm font-medium truncate">{sgSub.subgroup_name}</span>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <div className="flex items-center gap-1.5">
                          <StatusIcon className={`w-4 h-4 ${statusConfig.color}`} />
                          <span className={`text-xs font-medium ${statusConfig.color}`}>{statusConfig.label}</span>
                        </div>

                        {sgSub.submission?.submitted_at && (
                          <span className="text-xs text-muted-foreground hidden sm:inline">
                            {new Date(sgSub.submission.submitted_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}

                        {sgSub.submission?.is_late && (
                          <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">Late</Badge>
                        )}

                        {sgSub.submission?.can_review && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-9 text-xs"
                            onClick={() => openReview(cs, sgSub)}
                          >
                            {sgSub.my_review ? 'Edit Review' : 'Review'}
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Review Sheet */}
      <Sheet open={reviewOpen} onOpenChange={v => !v && setReviewOpen(false)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Review — {reviewSubmission?.subgroup_name}</SheetTitle>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            {/* Submission details */}
            {detailLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : detailData ? (
              <div className="space-y-3">
                <h3 className="text-sm font-medium">Submission Files</h3>
                {(Array.isArray(detailData.attachments) ? detailData.attachments : []).map((att: Record<string, unknown>) => {
                  const isFile = att.type === 'file';
                  const isLink = att.type === 'link';

                  return (
                    <button
                      key={att.id as string}
                      className="flex items-center gap-2 p-2 rounded-lg border bg-muted/50 hover:bg-muted/80 transition-colors w-full text-left group"
                      onClick={async () => {
                        if (isLink && att.link_url) {
                          window.open(att.link_url as string, '_blank', 'noopener');
                          return;
                        }
                        if (isFile) {
                          try {
                            const res = await fetch(
                              `/api/mentor/case-studies/submissions/${reviewSubmission?.submission?.id}/signed-url?attachment_id=${att.id}`
                            );
                            const data = await res.json();
                            if (!res.ok) throw new Error(data.error);
                            if (data.signedUrl) {
                              window.open(data.signedUrl, '_blank', 'noopener');
                            }
                          } catch {
                            toast.error('Failed to load file');
                          }
                        }
                      }}
                    >
                      {isFile ? (
                        <FileText className="w-4 h-4 text-muted-foreground group-hover:text-primary shrink-0" />
                      ) : (
                        <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-primary shrink-0" />
                      )}
                      <span className="text-sm flex-1 min-w-0 truncate">
                        {isFile ? att.file_name as string : (att.link_label as string || att.link_url as string)}
                      </span>
                      <ExternalLink className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0" />
                    </button>
                  );
                })}

                {/* Admin review (read-only) */}
                {(Array.isArray(detailData.reviews) ? detailData.reviews : [])
                  .filter((r: Record<string, unknown>) => r.reviewer_role === 'admin')
                  .map((r: Record<string, unknown>) => (
                    <div key={r.id as string} className="p-3 rounded-lg border bg-blue-50 dark:bg-blue-950/20 space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">Admin Review</span>
                        {r.score !== null && (
                          <span className="font-bold">{r.score as number}/{reviewMaxScore}</span>
                        )}
                      </div>
                      {typeof r.comment === 'string' && r.comment && <p className="text-sm text-muted-foreground">{r.comment}</p>}
                    </div>
                  ))}
              </div>
            ) : null}

            {/* Override banner */}
            {detailData && (Array.isArray(detailData.reviews) ? detailData.reviews : [])
              .some((r: Record<string, unknown>) => r.reviewer_role === 'mentor' && r.overridden) && (
              <div className="flex items-center gap-2 p-3 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  Admin has provided updated feedback to students
                </p>
              </div>
            )}

            <Separator />

            {/* Mentor review form */}
            <div>
              <Label className="text-sm font-medium">Your Score (out of {reviewMaxScore})</Label>
              <Input
                type="number"
                min={0}
                max={reviewMaxScore}
                placeholder="Optional"
                value={score}
                onChange={e => setScore(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-sm font-medium">Your Comments</Label>
              <Textarea
                placeholder="Write your feedback..."
                value={comment}
                onChange={e => setComment(e.target.value)}
                className="mt-1 min-h-[120px]"
              />
            </div>

            <Button onClick={handleSaveReview} disabled={saving} className="w-full">
              {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              {reviewSubmission?.my_review ? 'Update Review' : 'Save Review'}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
