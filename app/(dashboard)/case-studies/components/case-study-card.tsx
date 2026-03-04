'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CountdownTimer } from '@/components/case-studies/countdown-timer';
import {
  FileText,
  Upload,
  Eye,
  Lock,
  CheckCircle2,
  Clock,
  Star,
  Trophy,
} from 'lucide-react';
import { canUpload, getEffectiveDeadline } from '@/lib/services/case-study-deadline';
import type { StudentSubmissionStatus } from '@/types';
import type { CaseStudyWithSubmission } from './submission-panel';

const STATUS_CONFIG: Record<StudentSubmissionStatus, { label: string; icon: React.ElementType; className: string }> = {
  not_submitted: { label: 'Not submitted', icon: Clock, className: 'text-muted-foreground' },
  submitted: { label: 'Submitted', icon: CheckCircle2, className: 'text-emerald-600 dark:text-emerald-400' },
  under_review: { label: 'Under Review', icon: Eye, className: 'text-blue-600 dark:text-blue-400' },
  feedback_available: { label: 'Feedback Available', icon: Star, className: 'text-amber-600 dark:text-amber-400' },
};

interface CaseStudyCardProps {
  cs: CaseStudyWithSubmission;
  onOpenSubmission: (cs: CaseStudyWithSubmission) => void;
  onViewProblem: (cs: CaseStudyWithSubmission) => void;
  onViewFeedback: (cs: CaseStudyWithSubmission) => void;
  onViewLeaderboard: (cs: CaseStudyWithSubmission) => void;
}

export function CaseStudyCard({
  cs,
  onOpenSubmission,
  onViewProblem,
  onViewFeedback,
  onViewLeaderboard,
}: CaseStudyCardProps) {
  const status = cs.submission?.student_status ?? 'not_submitted';
  const statusConfig = STATUS_CONFIG[status];
  const StatusIcon = statusConfig.icon;
  const canEdit = canUpload(
    cs.submission ? { deadline_override: cs.submission.deadline_override, visibility: cs.submission.visibility } : null,
    cs
  );
  const deadline = getEffectiveDeadline(
    cs.submission ? { deadline_override: cs.submission.deadline_override } : null,
    cs
  );

  return (
    <div className="rounded-xl border bg-card overflow-hidden hover:border-primary/20 transition-colors">
      {/* Card Header */}
      <div className="p-5 pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h3 className="text-base font-semibold leading-tight">{cs.title}</h3>
              {cs.end_week_number && (
                <Badge variant="secondary" className="text-[11px] font-medium">
                  Week {cs.week_number}–{cs.end_week_number}
                </Badge>
              )}
            </div>
            {cs.description && (
              <p className="text-sm text-muted-foreground mt-1.5 line-clamp-2 leading-relaxed">{cs.description}</p>
            )}
          </div>

          {/* Primary Action */}
          <div className="shrink-0">
            {canEdit ? (
              <Button
                onClick={() => onOpenSubmission(cs)}
                className="h-10 px-5"
              >
                {status === 'not_submitted' ? (
                  <>
                    <Upload className="w-4 h-4 mr-1.5" />
                    Submit
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4 mr-1.5" />
                    Edit Submission
                  </>
                )}
              </Button>
            ) : status !== 'not_submitted' && status !== 'feedback_available' ? (
              <Button variant="outline" disabled className="h-10 px-5">
                <Lock className="w-4 h-4 mr-1.5" />
                Locked
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      {/* Card Footer — Status bar */}
      <div className="px-5 py-3 bg-muted/30 border-t flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4 flex-wrap">
          {/* Status pill */}
          <div className="flex items-center gap-1.5">
            <StatusIcon className={`w-4 h-4 ${statusConfig.className}`} />
            <span className={`text-sm font-medium ${statusConfig.className}`}>
              {statusConfig.label}
            </span>
            {cs.submission?.is_late && (
              <Badge variant="outline" className="text-[10px] ml-1 text-amber-600 border-amber-300 dark:text-amber-400 dark:border-amber-700">Late</Badge>
            )}
          </div>

          {/* Deadline info */}
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <CountdownTimer
              deadline={cs.due_date}
              graceMinutes={cs.grace_period_minutes}
              deadlineOverride={cs.submission?.deadline_override}
            />
            {deadline && (
              <span className="text-xs">
                Due: {deadline.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>

          {/* Submission meta */}
          {cs.submission && status !== 'not_submitted' && (
            <span className="text-xs text-muted-foreground hidden md:inline">
              {cs.submission.attachment_count} file{cs.submission.attachment_count !== 1 ? 's' : ''}, {cs.submission.link_count} link{cs.submission.link_count !== 1 ? 's' : ''}
              {cs.submission.submitted_by_name && ` · by ${cs.submission.submitted_by_name}`}
            </span>
          )}
        </div>

        {/* Secondary actions */}
        <div className="flex items-center gap-2">
          {cs.problem_file_path && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onViewProblem(cs)}
              className="h-8 text-xs border-blue-500/30 text-blue-500 hover:bg-blue-500/10 hover:text-blue-400 dark:border-blue-400/30 dark:text-blue-400 dark:hover:bg-blue-400/10"
            >
              <FileText className="w-3.5 h-3.5 mr-1.5" />
              View Problem
            </Button>
          )}

          {status === 'feedback_available' && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onViewFeedback(cs)}
              className="h-8 text-xs"
            >
              <Star className="w-3.5 h-3.5 mr-1" />
              Feedback
            </Button>
          )}

          {cs.leaderboard_published && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onViewLeaderboard(cs)}
              className="h-8 text-xs text-muted-foreground hover:text-foreground"
            >
              <Trophy className="w-3.5 h-3.5 mr-1" />
              Ranks
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
