'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  Eye,
  Star,
  Clock,
  CheckCircle2,
  Send,
  Loader2,
  Calendar as CalendarIcon,
  Trophy,
  Users,
} from 'lucide-react';
import { CountdownTimer } from '@/components/case-studies/countdown-timer';
import { ReviewForm } from './review-form';
import type { CaseStudy } from '@/types';

interface SubgroupSubmission {
  subgroup: { id: string; name: string };
  mentors: { id: string; name: string }[];
  submission: {
    id: string;
    visibility: string;
    submitted_at: string | null;
    is_late: boolean;
    submitted_by_name: string | null;
    attachment_count: number;
    link_count: number;
    reviews: Array<{
      id: string;
      reviewer_role: string;
      score: number | null;
      reviewer_name: string | null;
      overridden: boolean;
    }>;
  } | null;
}

interface SubmissionDashboardProps {
  caseStudy: CaseStudy;
  open: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

const VIS_LABELS: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  draft: { label: 'Not submitted', icon: Clock, color: 'text-muted-foreground' },
  submitted: { label: 'Submitted', icon: CheckCircle2, color: 'text-emerald-600 dark:text-emerald-400' },
  admin_reviewed: { label: 'Reviewed', icon: Star, color: 'text-blue-600 dark:text-blue-400' },
  mentor_visible: { label: 'Mentor visible', icon: Eye, color: 'text-purple-600 dark:text-purple-400' },
  subgroup_published: { label: 'Published (subgroup)', icon: Send, color: 'text-amber-600 dark:text-amber-400' },
  cohort_published: { label: 'Published (cohort)', icon: Trophy, color: 'text-sky-600 dark:text-sky-400' },
};

export function SubmissionDashboard({ caseStudy, open, onClose, onRefresh }: SubmissionDashboardProps) {
  const [submissions, setSubmissions] = useState<SubgroupSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [csInfo, setCsInfo] = useState<{ max_score: number; due_date: string | null } | null>(null);

  // Review form state
  const [reviewSheetOpen, setReviewSheetOpen] = useState(false);
  const [reviewSubmission, setReviewSubmission] = useState<SubgroupSubmission | null>(null);

  // Publish state
  const [publishing, setPublishing] = useState(false);

  // Extend deadline state
  const [extendOpen, setExtendOpen] = useState(false);
  const [extendDate, setExtendDate] = useState('');
  const [extendSubgroupId, setExtendSubgroupId] = useState<string | null>(null);
  const [extending, setExtending] = useState(false);

  // Bulk publish confirm
  const [bulkPublishTarget, setBulkPublishTarget] = useState<string>('');
  const [bulkPublishOpen, setBulkPublishOpen] = useState(false);

  const fetchSubmissions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/case-studies/${caseStudy.id}/submissions`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSubmissions(data.submissions || []);
      setCsInfo(data.case_study || null);
    } catch {
      toast.error('Failed to load submissions');
    } finally {
      setLoading(false);
    }
  }, [caseStudy.id]);

  useEffect(() => {
    if (open) fetchSubmissions();
  }, [open, fetchSubmissions]);

  // Publish single
  const handlePublish = async (target: string, subgroupId: string) => {
    setPublishing(true);
    try {
      const res = await fetch(`/api/admin/case-studies/${caseStudy.id}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target, subgroup_id: subgroupId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`Published to ${target}`);
      fetchSubmissions();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to publish');
    } finally {
      setPublishing(false);
    }
  };

  // Bulk publish
  const handleBulkPublish = async () => {
    setPublishing(true);
    try {
      const res = await fetch(`/api/admin/case-studies/${caseStudy.id}/publish-bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: bulkPublishTarget }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const { updated, total } = data;
      const skipped = (total || 0) - (updated || 0);
      if (updated === 0) {
        toast.info('No submissions eligible for this transition');
      } else if (skipped > 0) {
        toast.success(`Published ${updated}/${total}. ${skipped} skipped (not at the right stage).`);
      } else {
        toast.success(`All ${updated} submissions published to ${bulkPublishTarget}`);
      }
      setBulkPublishOpen(false);
      fetchSubmissions();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to bulk publish');
    } finally {
      setPublishing(false);
    }
  };

  // Extend deadline
  const handleExtendDeadline = async () => {
    if (!extendDate) return;
    setExtending(true);
    try {
      const body: Record<string, unknown> = { due_date: new Date(extendDate).toISOString() };
      if (extendSubgroupId) body.subgroup_id = extendSubgroupId;

      const res = await fetch(`/api/admin/case-studies/${caseStudy.id}/extend-deadline`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(data.message);
      setExtendOpen(false);
      fetchSubmissions();
      onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to extend deadline');
    } finally {
      setExtending(false);
    }
  };

  // Toggle leaderboard
  const handleToggleLeaderboard = async () => {
    try {
      const res = await fetch(`/api/admin/case-studies/${caseStudy.id}/leaderboard`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ published: !caseStudy.leaderboard_published }),
      });
      if (!res.ok) throw new Error('Failed');
      toast.success(caseStudy.leaderboard_published ? 'Leaderboard hidden' : 'Leaderboard published');
      onRefresh();
    } catch {
      toast.error('Failed to toggle leaderboard');
    }
  };

  // Counts
  const submittedCount = submissions.filter(s => s.submission && s.submission.visibility !== 'draft').length;
  const reviewedCount = submissions.filter(s => {
    const reviews = s.submission?.reviews || [];
    return reviews.some(r => r.reviewer_role === 'admin');
  }).length;
  const mentorReviewCount = submissions.filter(s => {
    const reviews = s.submission?.reviews || [];
    return reviews.some(r => r.reviewer_role === 'mentor');
  }).length;

  if (!open) return null;

  return (
    <>
      <Sheet open={open} onOpenChange={v => !v && onClose()}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-lg">{caseStudy.title} — Submissions</SheetTitle>
          </SheetHeader>

          <div className="px-4 pb-6 space-y-5">
            {/* Stats bar */}
            <div className="rounded-lg border bg-muted/30 p-3">
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                <CountdownTimer
                  deadline={caseStudy.due_date}
                  graceMinutes={caseStudy.grace_period_minutes}
                />
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="text-muted-foreground"><span className="font-semibold text-foreground">{submittedCount}</span>/{submissions.length} submitted</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                    <span className="text-muted-foreground"><span className="font-semibold text-foreground">{reviewedCount}</span>/{submissions.length} reviewed</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-purple-500" />
                    <span className="text-muted-foreground"><span className="font-semibold text-foreground">{mentorReviewCount}</span> mentor</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions — grouped by purpose */}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs"
                onClick={() => { setExtendSubgroupId(null); setExtendDate(''); setExtendOpen(true); }}
              >
                <CalendarIcon className="w-3.5 h-3.5 mr-1.5" />
                Extend Deadline
              </Button>

              <div className="w-px h-5 bg-border mx-1" />

              {(['mentor', 'subgroup', 'cohort'] as const).map(target => (
                <Button
                  key={target}
                  size="sm"
                  variant="secondary"
                  className="h-8 text-xs"
                  onClick={() => { setBulkPublishTarget(target); setBulkPublishOpen(true); }}
                >
                  <Send className="w-3.5 h-3.5 mr-1.5" />
                  Publish → {target}
                </Button>
              ))}

              <div className="w-px h-5 bg-border mx-1" />

              <Button
                size="sm"
                variant={caseStudy.leaderboard_published ? 'default' : 'outline'}
                className="h-8 text-xs"
                onClick={handleToggleLeaderboard}
              >
                <Trophy className="w-3.5 h-3.5 mr-1.5" />
                {caseStudy.leaderboard_published ? 'Hide Leaderboard' : 'Publish Leaderboard'}
              </Button>
            </div>

            {/* Submissions list */}
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-2">
                {submissions.map(sg => {
                  const vis = sg.submission?.visibility || 'draft';
                  const visConfig = VIS_LABELS[vis] || VIS_LABELS.draft;
                  const VisIcon = visConfig.icon;
                  const adminReview = sg.submission?.reviews?.find(r => r.reviewer_role === 'admin');
                  const mentorReview = sg.submission?.reviews?.find(r => r.reviewer_role === 'mentor');
                  const hasSubmission = sg.submission && vis !== 'draft';

                  return (
                    <div key={sg.subgroup.id} className={`rounded-lg border overflow-hidden ${hasSubmission ? 'bg-card' : 'bg-card/50 opacity-75'}`}>
                      {/* Row header */}
                      <div className="px-4 py-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                            <Users className="w-4 h-4 text-muted-foreground" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm">{sg.subgroup.name}</span>
                              {sg.submission?.is_late && (
                                <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300 dark:text-amber-400 dark:border-amber-700">Late</Badge>
                              )}
                            </div>
                            {sg.mentors.length > 0 && (
                              <p className="text-xs text-muted-foreground truncate">
                                Mentor: {sg.mentors.map(m => m.name).join(', ')}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Status badge */}
                        <Badge variant="outline" className={`shrink-0 text-[11px] font-medium gap-1 ${visConfig.color}`}>
                          <VisIcon className="w-3 h-3" />
                          {visConfig.label}
                        </Badge>
                      </div>

                      {/* Row footer — meta + actions */}
                      {hasSubmission ? (
                        <div className="px-4 py-2.5 bg-muted/20 border-t flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            {adminReview?.score !== undefined && adminReview?.score !== null && (
                              <span className="font-semibold text-foreground text-sm">
                                {adminReview.score}<span className="text-muted-foreground font-normal">/{csInfo?.max_score ?? 100}</span>
                              </span>
                            )}
                            {sg.submission?.submitted_at && (
                              <span>
                                {new Date(sg.submission.submitted_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                            {sg.submission?.attachment_count !== undefined && sg.submission.attachment_count > 0 && (
                              <span>{sg.submission.attachment_count} file{sg.submission.attachment_count !== 1 ? 's' : ''}</span>
                            )}
                            {sg.submission?.link_count !== undefined && sg.submission.link_count > 0 && (
                              <span>{sg.submission.link_count} link{sg.submission.link_count !== 1 ? 's' : ''}</span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5">
                            <Button
                              size="sm"
                              variant={adminReview ? 'ghost' : 'default'}
                              className="h-8 text-xs"
                              onClick={() => {
                                setReviewSubmission(sg);
                                setReviewSheetOpen(true);
                              }}
                            >
                              <Eye className="w-3.5 h-3.5 mr-1" />
                              {adminReview ? 'Edit Review' : 'Review'}
                            </Button>

                            {vis === 'admin_reviewed' && (
                              <Button size="sm" variant="secondary" className="h-8 text-xs" onClick={() => handlePublish('mentor', sg.subgroup.id)} disabled={publishing}>
                                <Send className="w-3 h-3 mr-1" /> → Mentor
                              </Button>
                            )}
                            {vis === 'mentor_visible' && (
                              <Button size="sm" variant="secondary" className="h-8 text-xs" onClick={() => handlePublish('subgroup', sg.subgroup.id)} disabled={publishing}>
                                <Send className="w-3 h-3 mr-1" /> → Subgroup
                              </Button>
                            )}
                            {vis === 'subgroup_published' && (
                              <Button size="sm" variant="secondary" className="h-8 text-xs" onClick={() => handlePublish('cohort', sg.subgroup.id)} disabled={publishing}>
                                <Send className="w-3 h-3 mr-1" /> → Cohort
                              </Button>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="px-4 py-2.5 bg-muted/10 border-t flex items-center justify-between gap-3">
                          <span className="text-xs text-muted-foreground">No submission yet</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 text-xs"
                            onClick={() => {
                              setExtendSubgroupId(sg.subgroup.id);
                              setExtendDate('');
                              setExtendOpen(true);
                            }}
                          >
                            <Clock className="w-3 h-3 mr-1" />
                            Extend
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Review Form Sheet */}
      {reviewSubmission?.submission && (
        <ReviewForm
          open={reviewSheetOpen}
          onClose={() => setReviewSheetOpen(false)}
          caseStudyId={caseStudy.id}
          submissionId={reviewSubmission.submission.id}
          subgroupName={reviewSubmission.subgroup.name}
          maxScore={caseStudy.max_score}
          existingReview={reviewSubmission.submission.reviews?.find(r => r.reviewer_role === 'admin') ?? null}
          mentorReview={reviewSubmission.submission.reviews?.find(r => r.reviewer_role === 'mentor') ?? null}
          onSaved={() => {
            setReviewSheetOpen(false);
            fetchSubmissions();
          }}
        />
      )}

      {/* Extend Deadline Dialog */}
      <AlertDialog open={extendOpen} onOpenChange={setExtendOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Extend Deadline {extendSubgroupId ? '(per subgroup)' : '(all subgroups)'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Set a new deadline. {!extendSubgroupId && 'Already reviewed submissions will not be affected.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            type="datetime-local"
            value={extendDate}
            onChange={e => setExtendDate(e.target.value)}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleExtendDeadline} disabled={extending || !extendDate}>
              {extending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              Extend
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Publish Confirm */}
      <AlertDialog open={bulkPublishOpen} onOpenChange={setBulkPublishOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Publish all to {bulkPublishTarget}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will advance all eligible submissions to the &quot;{bulkPublishTarget}&quot; visibility level.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkPublish} disabled={publishing}>
              {publishing && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              Publish All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
