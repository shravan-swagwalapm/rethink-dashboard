'use client';

import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TrendingUp, Video, Users, BarChart3 } from 'lucide-react';
import { OverviewTab } from './components/overview-tab';
import { MeetingsManagerTab } from './components/meetings-manager-tab';
import { StudentAttendanceTab } from './components/student-attendance-tab';
import { MotionContainer, MotionItem, MotionFadeIn } from '@/components/ui/motion';
import { PageHeader } from '@/components/ui/page-header';

interface Cohort {
  id: string;
  name: string;
}

export default function AdminAnalyticsPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const [cohorts, setCohorts] = useState<Cohort[]>([]);

  // Fetch cohorts once for all tabs
  useEffect(() => {
    async function fetchCohorts() {
      try {
        const res = await fetch('/api/admin/cohorts');
        if (res.ok) {
          const data = await res.json();
          setCohorts(
            (data.cohorts || data || []).map((c: { id: string; name: string }) => ({
              id: c.id,
              name: c.name,
            }))
          );
        }
      } catch (error) {
        console.error('Failed to fetch cohorts:', error);
      }
    }
    fetchCohorts();
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={BarChart3}
        title="Analytics"
        description="System-wide performance metrics and insights"
      />

      {/* Tabs */}
      <MotionFadeIn delay={0.1}>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid">
          <TabsTrigger value="overview" className="gap-2">
            <TrendingUp className="w-4 h-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="meetings" className="gap-2">
            <Video className="w-4 h-4" />
            Meetings
          </TabsTrigger>
          <TabsTrigger value="students" className="gap-2">
            <Users className="w-4 h-4" />
            Students
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab cohorts={cohorts} />
        </TabsContent>

        <TabsContent value="meetings">
          <MeetingsManagerTab cohorts={cohorts} />
        </TabsContent>

        <TabsContent value="students">
          <StudentAttendanceTab cohorts={cohorts} />
        </TabsContent>
      </Tabs>
      </MotionFadeIn>
    </div>
  );
}
