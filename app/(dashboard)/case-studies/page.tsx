'use client';

import { useState, useEffect, useCallback } from 'react';
import { useUserContext } from '@/contexts/user-context';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { CaseStudyViewerModal } from '@/components/case-studies/case-study-viewer-modal';
import { Leaderboard } from '@/components/case-studies/leaderboard';
import { toast } from 'sonner';
import { FileText, Loader2, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { CaseStudyReview } from '@/types';
import { SubmissionPanel } from './components/submission-panel';
import type { CaseStudyWithSubmission } from './components/submission-panel';
import { CaseStudyCard } from './components/case-study-card';

export default function CaseStudiesPage() {
  const { activeCohortId } = useUserContext();
  const [caseStudies, setCaseStudies] = useState<CaseStudyWithSubmission[]>([]);
  const [subgroup, setSubgroup] = useState<{ id: string; name: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [noSubgroup, setNoSubgroup] = useState(false);

  // Submission panel
  const [selectedCs, setSelectedCs] = useState<CaseStudyWithSubmission | null>(null);
  const [submissionSheetOpen, setSubmissionSheetOpen] = useState(false);

  // Viewer modal
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerCs, setViewerCs] = useState<CaseStudyWithSubmission | null>(null);
  const [viewerTab, setViewerTab] = useState<'problem' | 'submission' | 'feedback'>('problem');
  const [reviews, setReviews] = useState<CaseStudyReview[]>([]);

  // Leaderboard
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [leaderboardCs, setLeaderboardCs] = useState<CaseStudyWithSubmission | null>(null);

  const fetchData = useCallback(async () => {
    if (!activeCohortId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/case-studies/my-submissions?cohort_id=${activeCohortId}`);
      const data = await res.json();

      if (!data.subgroup) {
        setNoSubgroup(true);
        setLoading(false);
        return;
      }

      setSubgroup(data.subgroup);
      setCaseStudies(data.caseStudies || []);
    } catch {
      toast.error('Failed to load case studies');
    } finally {
      setLoading(false);
    }
  }, [activeCohortId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Open submission panel
  const openSubmissionPanel = (cs: CaseStudyWithSubmission) => {
    setSelectedCs(cs);
    setSubmissionSheetOpen(true);
  };

  // View problem (G2: also fetch reviews if feedback available, so viewer shows all tabs)
  const handleViewProblem = async (cs: CaseStudyWithSubmission) => {
    let fetchedReviews: CaseStudyReview[] = [];

    // If feedback is available, pre-fetch reviews so all tabs are populated
    if (cs.submission?.student_status === 'feedback_available' && cs.submission?.id) {
      try {
        const res = await fetch(`/api/case-studies/submissions/${cs.submission.id}/reviews`);
        const data = await res.json();
        fetchedReviews = data.reviews || [];
      } catch {
        // Non-critical — problem tab still works
      }
    }

    setReviews(fetchedReviews);
    setViewerCs(cs);
    setViewerTab('problem');
    setViewerOpen(true);
  };

  // View feedback
  const handleViewFeedback = async (cs: CaseStudyWithSubmission) => {
    if (!cs.submission?.id) return;
    try {
      const res = await fetch(`/api/case-studies/submissions/${cs.submission.id}/reviews`);
      const data = await res.json();
      setReviews(data.reviews || []);
      setViewerCs(cs);
      setViewerTab('feedback');
      setViewerOpen(true);
    } catch {
      toast.error('Failed to load feedback');
    }
  };

  // Group case studies by week (G5: place only in week_number bucket, not every week it spans)
  const grouped = caseStudies.reduce<Record<number, CaseStudyWithSubmission[]>>((acc, cs) => {
    const week = cs.week_number;
    if (!acc[week]) acc[week] = [];
    acc[week].push(cs);
    return acc;
  }, {});

  const weekNumbers = Object.keys(grouped).map(Number).sort((a, b) => a - b);

  // Subgroup gate
  if (!loading && noSubgroup) {
    return (
      <div className="p-6">
        <PageHeader title="Case Studies" />
        <EmptyState
          icon={FileText}
          title="Subgroup not assigned"
          description="You haven't been assigned to a subgroup yet. Contact your program coordinator to be assigned before you can view and submit case studies."
          action={
            <Button variant="outline" size="sm" asChild>
              <a href="mailto:shravan@naum.systems">
                <Mail className="size-4 mr-2" />
                Contact Coordinator
              </a>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Case Studies"
        description={subgroup ? `Submitting as ${subgroup.name}` : undefined}
      />

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : caseStudies.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No case studies yet"
          description="Case studies will appear here when your instructor creates them."
        />
      ) : (
        <div className="space-y-10">
          {weekNumbers.map(week => (
            <section key={week}>
              <div className="flex items-center gap-3 mb-4">
                <h2 className="text-base font-semibold tracking-tight">Week {week}</h2>
                <div className="flex-1 h-px bg-border" />
              </div>
              <div className="grid gap-4">
                {grouped[week].map(cs => (
                  <CaseStudyCard
                    key={cs.id}
                    cs={cs}
                    onOpenSubmission={openSubmissionPanel}
                    onViewProblem={handleViewProblem}
                    onViewFeedback={handleViewFeedback}
                    onViewLeaderboard={(cs) => { setLeaderboardCs(cs); setLeaderboardOpen(true); }}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Submission Panel */}
      <SubmissionPanel
        caseStudy={selectedCs}
        open={submissionSheetOpen}
        onOpenChange={setSubmissionSheetOpen}
        cohortId={activeCohortId || ''}
        onSubmissionChange={fetchData}
      />

      {/* Viewer Modal */}
      {viewerCs && (
        <CaseStudyViewerModal
          open={viewerOpen}
          onClose={() => { setViewerOpen(false); setViewerCs(null); }}
          title={viewerCs.title}
          caseStudyId={viewerCs.id}
          problemFilePath={viewerCs.problem_file_path}
          reviews={reviews}
          maxScore={viewerCs.max_score}
          defaultTab={viewerTab}
        />
      )}

      {/* Leaderboard */}
      {leaderboardCs && (
        <Leaderboard
          open={leaderboardOpen}
          onClose={() => { setLeaderboardOpen(false); setLeaderboardCs(null); }}
          caseStudyId={leaderboardCs.id}
          caseStudyTitle={leaderboardCs.title}
          mySubgroupId={subgroup?.id}
        />
      )}
    </div>
  );
}
