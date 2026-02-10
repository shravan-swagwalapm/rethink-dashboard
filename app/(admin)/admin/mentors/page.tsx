'use client';

import { useState, useCallback, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useUserContext } from '@/contexts/user-context';
import { Loader2, Users, MessageSquare, UserCheck } from 'lucide-react';
import { MotionFadeIn } from '@/components/ui/motion';
import { PageHeader } from '@/components/ui/page-header';
import type { Cohort, SubgroupWithDetails } from '@/types';
import { SubgroupsTab } from './components/subgroups-tab';
import { FeedbackOverviewTab } from './components/feedback-overview-tab';

export default function MentorsPage() {
  const { profile } = useUserContext();
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [selectedCohort, setSelectedCohort] = useState<string>('');
  const [subgroups, setSubgroups] = useState<SubgroupWithDetails[]>([]);
  const [loadingCohorts, setLoadingCohorts] = useState(true);
  const [loadingSubgroups, setLoadingSubgroups] = useState(false);
  const [activeTab, setActiveTab] = useState('subgroups');

  const fetchCohorts = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/cohorts');
      if (!res.ok) throw new Error('Failed to fetch cohorts');
      const data = await res.json();
      setCohorts(Array.isArray(data) ? data : data.cohorts || []);
      const active = (Array.isArray(data) ? data : data.cohorts || []).find(
        (c: Cohort) => c.status === 'active'
      );
      if (active) setSelectedCohort(active.id);
    } catch (error) {
      console.error('Error fetching cohorts:', error);
    } finally {
      setLoadingCohorts(false);
    }
  }, []);

  const fetchSubgroups = useCallback(async () => {
    if (!selectedCohort) return;
    setLoadingSubgroups(true);
    try {
      const res = await fetch(`/api/admin/subgroups?cohort_id=${selectedCohort}`);
      if (!res.ok) throw new Error('Failed to fetch subgroups');
      const data = await res.json();
      setSubgroups(data);
    } catch (error) {
      console.error('Error fetching subgroups:', error);
    } finally {
      setLoadingSubgroups(false);
    }
  }, [selectedCohort]);

  useEffect(() => {
    fetchCohorts();
  }, [fetchCohorts]);

  useEffect(() => {
    if (selectedCohort) {
      fetchSubgroups();
    }
  }, [selectedCohort, fetchSubgroups]);

  if (loadingCohorts) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={UserCheck}
        title="Mentors"
        description="Manage mentor assignments and performance"
        action={
          <Select value={selectedCohort} onValueChange={setSelectedCohort}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Select cohort" />
            </SelectTrigger>
            <SelectContent>
              {cohorts.map((cohort) => (
                <SelectItem key={cohort.id} value={cohort.id}>
                  {cohort.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      <MotionFadeIn delay={0.1}>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="subgroups" className="gap-2">
            <Users className="w-4 h-4" />
            Subgroups
          </TabsTrigger>
          <TabsTrigger value="feedback" className="gap-2">
            <MessageSquare className="w-4 h-4" />
            Feedback
          </TabsTrigger>
        </TabsList>

        <TabsContent value="subgroups" className="mt-6">
          <SubgroupsTab
            cohortId={selectedCohort}
            subgroups={subgroups}
            loading={loadingSubgroups}
            onRefresh={fetchSubgroups}
          />
        </TabsContent>

        <TabsContent value="feedback" className="mt-6">
          <FeedbackOverviewTab cohortId={selectedCohort} />
        </TabsContent>
      </Tabs>
      </MotionFadeIn>
    </div>
  );
}
