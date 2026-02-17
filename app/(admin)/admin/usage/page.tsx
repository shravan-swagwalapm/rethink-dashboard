'use client';

import { useState, useCallback, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Globe, Users, User, Activity } from 'lucide-react';
import { MotionFadeIn } from '@/components/ui/motion';
import { PageHeader } from '@/components/ui/page-header';
import { DateFilter } from './components/date-filter';
import { OverviewTab } from './components/overview-tab';
import { CohortTab } from './components/cohort-tab';
import { StudentDetailTab } from './components/student-detail-tab';
import type { UsagePeriod, CohortUsageStudent } from '@/types';
import type { CohortUsageStats } from '@/types';

interface Cohort {
  id: string;
  name: string;
  status?: string;
}

export default function UsagePage() {
  const [activeTab, setActiveTab] = useState('cohort');
  const [period, setPeriod] = useState<UsagePeriod>('week');
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [selectedCohort, setSelectedCohort] = useState('');
  const [loadingCohorts, setLoadingCohorts] = useState(true);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [cohortStudents, setCohortStudents] = useState<CohortUsageStudent[]>([]);

  // Fetch students for the selected cohort (used by Student Detail tab)
  const fetchCohortStudents = useCallback(async () => {
    if (!selectedCohort) return;
    try {
      const res = await fetch(`/api/admin/usage/cohort?cohort_id=${selectedCohort}&period=${period}`);
      if (!res.ok) return;
      const data: CohortUsageStats = await res.json();
      setCohortStudents(data.students || []);
    } catch {
      // Student list fetch is best-effort
    }
  }, [selectedCohort, period]);

  useEffect(() => {
    fetchCohortStudents();
  }, [fetchCohortStudents]);

  // Fetch cohorts
  const fetchCohorts = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/cohorts');
      if (!res.ok) throw new Error('Failed to fetch cohorts');
      const data = await res.json();
      const allCohorts = (data || []).filter((c: Cohort) => c.status !== 'archived');
      setCohorts(allCohorts);
      if (allCohorts.length > 0 && !selectedCohort) {
        setSelectedCohort(allCohorts[0].id);
      }
    } catch (error) {
      console.error('Failed to fetch cohorts:', error);
    } finally {
      setLoadingCohorts(false);
    }
  }, [selectedCohort]);

  useEffect(() => {
    fetchCohorts();
  }, [fetchCohorts]);

  if (loadingCohorts) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Activity}
        iconColor="teal"
        title="LMS Usage Analytics"
        description="Track student logins, content engagement, and identify at-risk students"
        action={
          <DateFilter period={period} onPeriodChange={setPeriod} />
        }
      />

      <MotionFadeIn delay={0.1}>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="overview" className="gap-2">
              <Globe className="w-4 h-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="cohort" className="gap-2">
              <Users className="w-4 h-4" />
              Cohort View
            </TabsTrigger>
            <TabsTrigger value="student" className="gap-2">
              <User className="w-4 h-4" />
              Student Detail
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6">
            <OverviewTab period={period} />
          </TabsContent>

          <TabsContent value="cohort" className="mt-6">
            <div className="mb-4">
              <Select value={selectedCohort} onValueChange={setSelectedCohort}>
                <SelectTrigger className="w-[250px]">
                  <SelectValue placeholder="Select cohort" />
                </SelectTrigger>
                <SelectContent>
                  {cohorts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <CohortTab
              period={period}
              cohorts={cohorts}
              selectedCohort={selectedCohort}
              onCohortChange={setSelectedCohort}
            />
          </TabsContent>

          <TabsContent value="student" className="mt-6">
            <StudentDetailTab
              period={period}
              students={cohortStudents}
              selectedStudentId={selectedStudentId}
              onStudentChange={setSelectedStudentId}
            />
          </TabsContent>
        </Tabs>
      </MotionFadeIn>
    </div>
  );
}
