'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/hooks/use-user';
import { getClient } from '@/lib/supabase/client';
import { WelcomeBanner } from '@/components/dashboard/welcome-banner';
import { StatsCards } from '@/components/dashboard/stats-cards';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageLoader } from '@/components/ui/page-loader';
import { Calendar, Clock, Video, ChevronRight, BookOpen, FolderOpen } from 'lucide-react';
import Link from 'next/link';
import { format, isToday, isTomorrow, parseISO } from 'date-fns';
import type { Session, DashboardStats, LearningModule, Resource } from '@/types';

export default function DashboardPage() {
  const router = useRouter();
  const { profile, loading: userLoading, isAdmin } = useUser();
  const [stats, setStats] = useState<DashboardStats | null>(null);

  const [upcomingSessions, setUpcomingSessions] = useState<Session[]>([]);
  const [recentModules, setRecentModules] = useState<LearningModule[]>([]);
  const [recentResources, setRecentResources] = useState<Resource[]>([]);
  const [cohortStartDate, setCohortStartDate] = useState<Date | null>(null);
  const [cohortName, setCohortName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const hasFetchedRef = useRef(false);

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!profile) {
        // Don't get stuck in loading state if profile doesn't exist
        setLoading(false);
        return;
      }

      // Prevent re-fetching on tab switch
      if (hasFetchedRef.current) return;
      hasFetchedRef.current = true;

      const supabase = getClient();

      try {
        // Fetch all data in parallel for better performance
        if (profile.cohort_id) {
          const [
            cohortResult,
            studentsCountResult,
            attendanceResult,
            rankingResult,
            resourcesCountResult,
            sessionsResult,
            modulesResult,
            resourcesResult,
          ] = await Promise.all([
            // Fetch cohort info
            supabase
              .from('cohorts')
              .select('*')
              .eq('id', profile.cohort_id)
              .single(),
            // Fetch stats - count all users in cohort
            supabase
              .from('profiles')
              .select('*', { count: 'exact', head: true })
              .eq('cohort_id', profile.cohort_id),
            // Fetch attendance
            supabase
              .from('attendance')
              .select('attendance_percentage')
              .eq('user_id', profile.id),
            // Fetch ranking
            supabase
              .from('rankings')
              .select('rank')
              .eq('user_id', profile.id)
              .eq('cohort_id', profile.cohort_id)
              .single(),
            // Fetch total resources count for the cohort
            supabase
              .from('resources')
              .select('*', { count: 'exact', head: true })
              .eq('cohort_id', profile.cohort_id),
            // Fetch upcoming sessions
            supabase
              .from('sessions')
              .select('*')
              .eq('cohort_id', profile.cohort_id)
              .gte('scheduled_at', new Date().toISOString())
              .order('scheduled_at', { ascending: true })
              .limit(3),
            // Fetch recent learning modules
            supabase
              .from('learning_modules')
              .select('*')
              .eq('cohort_id', profile.cohort_id)
              .order('created_at', { ascending: false })
              .limit(4),
            // Fetch recent resources
            supabase
              .from('resources')
              .select('*')
              .eq('cohort_id', profile.cohort_id)
              .eq('type', 'file')
              .order('created_at', { ascending: false })
              .limit(4),
          ]);

          // Process cohort data
          const cohort = cohortResult.data;
          if (cohort) {
            setCohortName(cohort.name);
            if (cohort.start_date) {
              setCohortStartDate(new Date(cohort.start_date));
            }
          }

          // Calculate average attendance
          const attendance = attendanceResult.data;
          const avgAttendance = attendance?.length
            ? attendance.reduce((acc: number, a: { attendance_percentage: number | null }) => acc + (a.attendance_percentage || 0), 0) / attendance.length
            : 0;

          // Set stats
          setStats({
            total_students: studentsCountResult.count || 0,
            attendance_percentage: Math.round(avgAttendance),
            current_rank: rankingResult.data?.rank || null,
            total_resources: resourcesCountResult.count || 0,
          });

          // Set sessions, modules, and resources
          setUpcomingSessions(sessionsResult.data || []);
          setRecentModules(modulesResult.data || []);
          setRecentResources(resourcesResult.data || []);
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    if (!userLoading) {
      fetchDashboardData();
    }
  }, [profile, userLoading]);

  const getSessionTimeLabel = (date: string) => {
    const sessionDate = parseISO(date);
    if (isToday(sessionDate)) return 'Today';
    if (isTomorrow(sessionDate)) return 'Tomorrow';
    return format(sessionDate, 'EEE, MMM d');
  };

  // Show explicit loader while checking if user is logged in
  if (userLoading) {
    return <PageLoader message="Loading dashboard..." />;
  }

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <WelcomeBanner cohortStartDate={cohortStartDate} cohortName={cohortName} />

      {/* Stats Cards */}
      <StatsCards stats={stats || undefined} />

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Sessions */}
        <Card className="relative overflow-hidden border-2 dark:border-gray-700 dark:bg-gray-900/50 hover:shadow-xl hover:shadow-blue-500/10 transition-all duration-500 hover:-translate-y-0.5">
          {/* Top accent gradient */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-cyan-500 to-blue-500" />

          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center">
                  <Calendar className="w-4 h-4 text-white" />
                </div>
                <CardTitle className="text-xl dark:text-white">Upcoming Sessions</CardTitle>
              </div>
              <CardDescription className="dark:text-gray-400">Your next learning sessions</CardDescription>
            </div>
            <Link href="/calendar">
              <Button variant="ghost" size="sm" className="gap-1 hover:bg-blue-50 dark:hover:bg-blue-950/30">
                View all
                <ChevronRight className="w-4 h-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {upcomingSessions.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center">
                  <Calendar className="w-8 h-8 text-blue-500 dark:text-blue-400" />
                </div>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">No upcoming sessions</p>
                <p className="text-xs text-muted-foreground dark:text-gray-500">Check back later for new sessions</p>
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingSessions.map((session, index) => (
                  <div
                    key={session.id}
                    className="group relative flex items-center gap-4 p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gradient-to-br from-blue-50/50 to-cyan-50/50 dark:from-blue-950/20 dark:to-cyan-950/20 hover:from-blue-50 hover:to-cyan-50 dark:hover:from-blue-950/30 dark:hover:to-cyan-950/30 transition-all duration-300 hover:shadow-md hover:scale-[1.02]"
                    style={{
                      animationDelay: `${index * 100}ms`,
                      animationFillMode: 'forwards',
                    }}
                  >
                    {/* Session icon */}
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 dark:from-blue-600 dark:to-cyan-700 flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform duration-300">
                      <Video className="w-6 h-6" />
                    </div>

                    {/* Session info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate text-gray-900 dark:text-white mb-1">
                        {session.title}
                      </p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground dark:text-gray-400">
                        <Clock className="w-3.5 h-3.5" />
                        <span className="font-medium">{format(parseISO(session.scheduled_at), 'h:mm a')}</span>
                        <span className="text-gray-400">•</span>
                        <span>{session.duration_minutes} min</span>
                      </div>
                    </div>

                    {/* Time badge */}
                    <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800 font-medium">
                      {getSessionTimeLabel(session.scheduled_at)}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Learnings */}
        <Card className="relative overflow-hidden border-2 dark:border-gray-700 dark:bg-gray-900/50 hover:shadow-xl hover:shadow-purple-500/10 transition-all duration-500 hover:-translate-y-0.5">
          {/* Top accent gradient */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 via-pink-500 to-purple-500" />

          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
                  <BookOpen className="w-4 h-4 text-white" />
                </div>
                <CardTitle className="text-xl dark:text-white">My Learnings</CardTitle>
              </div>
              <CardDescription className="dark:text-gray-400">Continue where you left off</CardDescription>
            </div>
            <Link href="/learnings">
              <Button variant="ghost" size="sm" className="gap-1 hover:bg-purple-50 dark:hover:bg-purple-950/30">
                View all
                <ChevronRight className="w-4 h-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {recentModules.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-purple-50 dark:bg-purple-950/30 flex items-center justify-center">
                  <BookOpen className="w-8 h-8 text-purple-500 dark:text-purple-400" />
                </div>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">No learning modules yet</p>
                <p className="text-xs text-muted-foreground dark:text-gray-500">Modules will appear here when available</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentModules.map((module, index) => (
                  <Link
                    key={module.id}
                    href={`/learnings?module=${module.id}`}
                    className="group relative flex items-center gap-4 p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gradient-to-br from-purple-50/50 to-pink-50/50 dark:from-purple-950/20 dark:to-pink-950/20 hover:from-purple-50 hover:to-pink-50 dark:hover:from-purple-950/30 dark:hover:to-pink-950/30 transition-all duration-300 hover:shadow-md hover:scale-[1.02]"
                    style={{
                      animationDelay: `${index * 100}ms`,
                      animationFillMode: 'forwards',
                    }}
                  >
                    {/* Module icon */}
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 dark:from-purple-600 dark:to-pink-700 flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform duration-300">
                      <BookOpen className="w-6 h-6" />
                    </div>

                    {/* Module info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate text-gray-900 dark:text-white mb-1 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                        {module.title}
                      </p>
                      <p className="text-sm text-muted-foreground dark:text-gray-400 font-medium">
                        Week {module.week_number || 'N/A'}
                      </p>
                    </div>

                    {/* Chevron */}
                    <ChevronRight className="w-5 h-5 text-muted-foreground dark:text-gray-500 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Resources */}
      <Card className="relative overflow-hidden border-2 dark:border-gray-700 dark:bg-gray-900/50 hover:shadow-xl hover:shadow-green-500/10 transition-all duration-500 hover:-translate-y-0.5">
        {/* Top accent gradient */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-green-500 via-emerald-500 to-green-500" />

        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                <FolderOpen className="w-4 h-4 text-white" />
              </div>
              <CardTitle className="text-xl dark:text-white">Recent Resources</CardTitle>
            </div>
            <CardDescription className="dark:text-gray-400">Latest files and documents</CardDescription>
          </div>
          <Link href="/resources">
            <Button variant="ghost" size="sm" className="gap-1 hover:bg-green-50 dark:hover:bg-green-950/30">
              View all
              <ChevronRight className="w-4 h-4" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {recentResources.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-50 dark:bg-green-950/30 flex items-center justify-center">
                <FolderOpen className="w-8 h-8 text-green-500 dark:text-green-400" />
              </div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">No resources yet</p>
              <p className="text-xs text-muted-foreground dark:text-gray-500">Resources will appear here when uploaded</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {recentResources.map((resource, index) => (
                <Link
                  key={resource.id}
                  href={`/resources?file=${resource.id}`}
                  className="group flex flex-col gap-3 p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gradient-to-br from-green-50/50 to-emerald-50/50 dark:from-green-950/20 dark:to-emerald-950/20 hover:from-green-50 hover:to-emerald-50 dark:hover:from-green-950/30 dark:hover:to-emerald-950/30 transition-all duration-300 hover:shadow-lg hover:scale-[1.05]"
                  style={{
                    animationDelay: `${index * 50}ms`,
                    animationFillMode: 'forwards',
                  }}
                >
                  {/* File icon */}
                  <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 dark:from-green-600 dark:to-emerald-700 flex items-center justify-center text-white shadow-md group-hover:scale-110 group-hover:rotate-3 transition-all duration-300">
                    <FolderOpen className="w-5 h-5" />
                  </div>

                  {/* File info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate text-gray-900 dark:text-white group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors mb-1">
                      {resource.name}
                    </p>
                    <p className="text-xs font-medium text-muted-foreground dark:text-gray-500 uppercase tracking-wider">
                      {resource.file_type || 'File'}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
