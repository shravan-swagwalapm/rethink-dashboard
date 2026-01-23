'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@/hooks/use-user';
import { getClient } from '@/lib/supabase/client';
import { WelcomeBanner } from '@/components/dashboard/welcome-banner';
import { StatsCards } from '@/components/dashboard/stats-cards';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar, Clock, Video, ChevronRight, BookOpen, FolderOpen } from 'lucide-react';
import Link from 'next/link';
import { format, isToday, isTomorrow, parseISO } from 'date-fns';
import type { Session, DashboardStats, LearningModule, Resource } from '@/types';

export default function DashboardPage() {
  const { profile, loading: userLoading } = useUser();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [upcomingSessions, setUpcomingSessions] = useState<Session[]>([]);
  const [recentModules, setRecentModules] = useState<LearningModule[]>([]);
  const [recentResources, setRecentResources] = useState<Resource[]>([]);
  const [cohortStartDate, setCohortStartDate] = useState<Date | null>(null);
  const [cohortName, setCohortName] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!profile) return;

      const supabase = getClient();

      try {
        // Fetch cohort info
        if (profile.cohort_id) {
          const { data: cohort } = await supabase
            .from('cohorts')
            .select('*')
            .eq('id', profile.cohort_id)
            .single();

          if (cohort) {
            setCohortName(cohort.name);
            if (cohort.start_date) {
              setCohortStartDate(new Date(cohort.start_date));
            }
          }

          // Fetch stats
          const { count: studentsCount } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .eq('cohort_id', profile.cohort_id)
            .eq('role', 'student');

          // Fetch attendance
          const { data: attendance } = await supabase
            .from('attendance')
            .select('attendance_percentage')
            .eq('user_id', profile.id);

          const avgAttendance = attendance?.length
            ? attendance.reduce((acc: number, a: { attendance_percentage: number | null }) => acc + (a.attendance_percentage || 0), 0) / attendance.length
            : 0;

          // Fetch ranking
          const { data: ranking } = await supabase
            .from('rankings')
            .select('rank')
            .eq('user_id', profile.id)
            .eq('cohort_id', profile.cohort_id)
            .single();

          // Fetch upcoming sessions count
          const { count: sessionsCount } = await supabase
            .from('sessions')
            .select('*', { count: 'exact', head: true })
            .eq('cohort_id', profile.cohort_id)
            .gte('scheduled_at', new Date().toISOString());

          setStats({
            total_students: studentsCount || 0,
            attendance_percentage: Math.round(avgAttendance),
            current_rank: ranking?.rank || null,
            upcoming_sessions: sessionsCount || 0,
          });

          // Fetch upcoming sessions
          const { data: sessions } = await supabase
            .from('sessions')
            .select('*')
            .eq('cohort_id', profile.cohort_id)
            .gte('scheduled_at', new Date().toISOString())
            .order('scheduled_at', { ascending: true })
            .limit(3);

          setUpcomingSessions(sessions || []);

          // Fetch recent learning modules
          const { data: modules } = await supabase
            .from('learning_modules')
            .select('*')
            .eq('cohort_id', profile.cohort_id)
            .order('created_at', { ascending: false })
            .limit(4);

          setRecentModules(modules || []);

          // Fetch recent resources
          const { data: resources } = await supabase
            .from('resources')
            .select('*')
            .eq('cohort_id', profile.cohort_id)
            .eq('type', 'file')
            .order('created_at', { ascending: false })
            .limit(4);

          setRecentResources(resources || []);
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

  if (userLoading || loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full rounded-xl" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    );
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
        <Card className="hover-lift">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-lg">Upcoming Sessions</CardTitle>
              <CardDescription>Your next learning sessions</CardDescription>
            </div>
            <Link href="/calendar">
              <Button variant="ghost" size="sm" className="gap-1">
                View all
                <ChevronRight className="w-4 h-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {upcomingSessions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No upcoming sessions</p>
                <p className="text-xs">Check back later for new sessions</p>
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingSessions.map((session) => (
                  <div
                    key={session.id}
                    className="flex items-center gap-4 p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <div className="w-12 h-12 rounded-xl gradient-bg flex items-center justify-center text-white">
                      <Video className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{session.title}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{format(parseISO(session.scheduled_at), 'h:mm a')}</span>
                        <span>•</span>
                        <span>{session.duration_minutes} min</span>
                      </div>
                    </div>
                    <Badge variant="secondary">
                      {getSessionTimeLabel(session.scheduled_at)}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Learnings */}
        <Card className="hover-lift">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-lg">My Learnings</CardTitle>
              <CardDescription>Continue where you left off</CardDescription>
            </div>
            <Link href="/learnings">
              <Button variant="ghost" size="sm" className="gap-1">
                View all
                <ChevronRight className="w-4 h-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {recentModules.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <BookOpen className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No learning modules yet</p>
                <p className="text-xs">Modules will appear here when available</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentModules.map((module) => (
                  <Link
                    key={module.id}
                    href={`/learnings?module=${module.id}`}
                    className="flex items-center gap-4 p-3 rounded-xl hover:bg-muted transition-colors group"
                  >
                    <div className="w-12 h-12 rounded-xl bg-chart-3/10 flex items-center justify-center">
                      <BookOpen className="w-5 h-5 text-chart-3" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate group-hover:text-primary transition-colors">
                        {module.title}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Week {module.week_number || 'N/A'}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Resources */}
      <Card className="hover-lift">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-lg">Recent Resources</CardTitle>
            <CardDescription>Latest files and documents</CardDescription>
          </div>
          <Link href="/resources">
            <Button variant="ghost" size="sm" className="gap-1">
              View all
              <ChevronRight className="w-4 h-4" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {recentResources.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FolderOpen className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No resources yet</p>
              <p className="text-xs">Resources will appear here when uploaded</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {recentResources.map((resource) => (
                <Link
                  key={resource.id}
                  href={`/resources?file=${resource.id}`}
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted transition-colors group"
                >
                  <div className="w-10 h-10 rounded-lg bg-chart-2/10 flex items-center justify-center flex-shrink-0">
                    <FolderOpen className="w-4 h-4 text-chart-2" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                      {resource.name}
                    </p>
                    <p className="text-xs text-muted-foreground uppercase">
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
