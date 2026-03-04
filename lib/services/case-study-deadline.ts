import type { CaseStudy, CaseStudySubmission, SubmissionVisibility, StudentSubmissionStatus } from '@/types';

/**
 * Computes the effective deadline for a submission, considering per-subgroup overrides.
 * Returns null for open-ended case studies (no deadline).
 */
export function getEffectiveDeadline(
  submission: Pick<CaseStudySubmission, 'deadline_override'> | null,
  caseStudy: Pick<CaseStudy, 'due_date'>
): Date | null {
  const raw = submission?.deadline_override ?? caseStudy.due_date;
  return raw ? new Date(raw) : null;
}

/**
 * Computes the effective deadline INCLUDING grace period.
 */
export function getEffectiveDeadlineWithGrace(
  submission: Pick<CaseStudySubmission, 'deadline_override'> | null,
  caseStudy: Pick<CaseStudy, 'due_date' | 'grace_period_minutes'>
): Date | null {
  const deadline = getEffectiveDeadline(submission, caseStudy);
  if (!deadline) return null;
  return new Date(deadline.getTime() + (caseStudy.grace_period_minutes ?? 5) * 60 * 1000);
}

/**
 * Whether a student can currently upload/edit their submission.
 */
export function canUpload(
  submission: Pick<CaseStudySubmission, 'deadline_override' | 'visibility'> | null,
  caseStudy: Pick<CaseStudy, 'due_date' | 'grace_period_minutes' | 'is_archived' | 'submissions_closed'>,
  now: Date = new Date()
): boolean {
  if (caseStudy.is_archived) return false;
  if (caseStudy.submissions_closed) return false;

  const visibility = submission?.visibility ?? 'draft';
  if (visibility !== 'draft' && visibility !== 'submitted') return false;

  const deadlineWithGrace = getEffectiveDeadlineWithGrace(submission, caseStudy);
  if (!deadlineWithGrace) return true; // open-ended
  return now <= deadlineWithGrace;
}

/**
 * Whether a submission made right now would be considered "late"
 * (after the hard deadline but within grace period).
 */
export function isLate(
  submission: Pick<CaseStudySubmission, 'deadline_override'> | null,
  caseStudy: Pick<CaseStudy, 'due_date' | 'grace_period_minutes'>,
  now: Date = new Date()
): boolean {
  const deadline = getEffectiveDeadline(submission, caseStudy);
  if (!deadline) return false;
  return now > deadline;
}

/**
 * Map internal visibility state to the student-facing status.
 * Students should never see internal pipeline states like "admin_reviewed" or "mentor_visible".
 */
export function toStudentStatus(
  visibility: SubmissionVisibility | undefined
): StudentSubmissionStatus {
  switch (visibility) {
    case 'draft':
      return 'not_submitted';
    case 'submitted':
      return 'submitted';
    case 'admin_reviewed':
    case 'mentor_visible':
      return 'under_review';
    case 'subgroup_published':
    case 'cohort_published':
      return 'feedback_available';
    default:
      return 'not_submitted';
  }
}

/**
 * Ordered list of visibility states for the publish state machine.
 */
const VISIBILITY_ORDER: SubmissionVisibility[] = [
  'draft',
  'submitted',
  'admin_reviewed',
  'mentor_visible',
  'subgroup_published',
  'cohort_published',
];

/**
 * Check if transitioning from current to target visibility is valid (forward only).
 */
export function isValidTransition(
  current: SubmissionVisibility,
  target: SubmissionVisibility
): boolean {
  const currentIdx = VISIBILITY_ORDER.indexOf(current);
  const targetIdx = VISIBILITY_ORDER.indexOf(target);
  return targetIdx > currentIdx;
}

/**
 * Format remaining time as a human-readable string.
 */
export function formatTimeRemaining(deadline: Date, now: Date = new Date()): string {
  const diff = deadline.getTime() - now.getTime();
  if (diff <= 0) return 'Deadline passed';

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h ${minutes}m left`;
  return `${minutes}m left`;
}

/**
 * Urgency level for styling the countdown timer.
 */
export function getDeadlineUrgency(
  deadline: Date,
  now: Date = new Date()
): 'normal' | 'warning' | 'critical' | 'passed' {
  const diff = deadline.getTime() - now.getTime();
  if (diff <= 0) return 'passed';
  if (diff <= 60 * 60 * 1000) return 'critical';      // < 1 hour
  if (diff <= 24 * 60 * 60 * 1000) return 'warning';   // < 24 hours
  return 'normal';
}
