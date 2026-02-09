'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useUserContext } from '@/contexts/user-context';
import { getClient } from '@/lib/supabase/client';
import { WelcomeBanner } from '@/components/dashboard/welcome-banner';
import { StatsCards } from '@/components/dashboard/stats-cards';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StudentPageLoader } from '@/components/ui/page-loader';
import { Calendar, Clock, Video, ChevronRight, BookOpen, FolderOpen, Shield, Presentation, FileText, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { format, isToday, isTomorrow, parseISO } from 'date-fns';
import { InvoiceCard } from '@/components/dashboard/invoice-card';
import { toast } from 'sonner';
import type { Session, DashboardStats, LearningModule, Resource, Invoice, Cohort, ModuleResource, ModuleResourceType } from '@/types';

interface InvoiceWithCohort extends Invoice {
  cohort?: Cohort;
}

interface RecentLearningAsset extends ModuleResource {
  progress?: {
    is_completed: boolean;
    progress_seconds: number;
    last_viewed_at: string | null;
  };
}

// Helper function to get icon for content type
function getContentIcon(type: ModuleResourceType) {
  switch (type) {
    case 'video':
      return Video;
    case 'slides':
      return Presentation;
    case 'document':
      return FileText;
    case 'link':
      return ExternalLink;
    default:
      return BookOpen;
  }
}

// Helper function to get gradient colors for content type
function getContentGradient(type: ModuleResourceType): { from: string; to: string; bg: string; hover: string; darkFrom: string; darkTo: string; darkHover: string } {
  switch (type) {
    case 'video':
      return {
        from: 'from-purple-500',
        to: 'to-purple-600',
        bg: 'bg-purple-500/10',
        hover: 'hover:from-purple-50 hover:to-purple-100',
        darkFrom: 'dark:from-purple-600',
        darkTo: 'dark:to-purple-700',
        darkHover: 'dark:hover:from-purple-950/30 dark:hover:to-purple-950/40',
      };
    case 'slides':
      return {
        from: 'from-orange-500',
        to: 'to-orange-600',
        bg: 'bg-orange-500/10',
        hover: 'hover:from-orange-50 hover:to-orange-100',
        darkFrom: 'dark:from-orange-600',
        darkTo: 'dark:to-orange-700',
        darkHover: 'dark:hover:from-orange-950/30 dark:hover:to-orange-950/40',
      };
    case 'document':
      return {
        from: 'from-blue-500',
        to: 'to-blue-600',
        bg: 'bg-blue-500/10',
        hover: 'hover:from-blue-50 hover:to-blue-100',
        darkFrom: 'dark:from-blue-600',
        darkTo: 'dark:to-blue-700',
        darkHover: 'dark:hover:from-blue-950/30 dark:hover:to-blue-950/40',
      };
    default:
      return {
        from: 'from-gray-500',
        to: 'to-gray-600',
        bg: 'bg-gray-500/10',
        hover: 'hover:from-gray-50 hover:to-gray-100',
        darkFrom: 'dark:from-gray-600',
        darkTo: 'dark:to-gray-700',
        darkHover: 'dark:hover:from-gray-950/30 dark:hover:to-gray-950/40',
      };
  }
}

// Helper function to get content type label
function getContentTypeLabel(type: ModuleResourceType): string {
  switch (type) {
    case 'video':
      return 'Recording';
    case 'slides':
      return 'Presentation';
    case 'document':
      return 'Document';
    case 'link':
      return 'Link';
    default:
      return 'Resource';
  }
}

export default function DashboardPage() {
  const router = useRouter();
  const { profile, loading: userLoading, isAdmin, activeCohortId } = useUserContext();
  const [stats, setStats] = useState<DashboardStats | null>(null);

  const [upcomingSessions, setUpcomingSessions] = useState<Session[]>([]);
  const [recentModules, setRecentModules] = useState<LearningModule[]>([]);
  const [recentResources, setRecentResources] = useState<Resource[]>([]);
  const [recentLearningAssets, setRecentLearningAssets] = useState<RecentLearningAsset[]>([]);
  const [invoices, setInvoices] = useState<InvoiceWithCohort[]>([]);
  const [pendingInvoiceAmount, setPendingInvoiceAmount] = useState(0);
  const [cohortStartDate, setCohortStartDate] = useState<Date | null>(null);
  const [cohortName, setCohortName] = useState<string>('');
  const [loading, setLoading] = useState(true);

  // Admin-specific state
  const [adminStats, setAdminStats] = useState<any>(null);
  const [adminSessions, setAdminSessions] = useState<any[]>([]);
  const [adminLearnings, setAdminLearnings] = useState<any[]>([]);

  /**
   * Fetch recent learning modules with override logic
   * Respects cohort linking: shows modules from linked source (cohort or global)
   */
  const fetchRecentModules = async (cohortId: string) => {
    const supabase = getClient();

    try {
      // Step 1: Get cohort's active link configuration
      const { data: cohort } = await supabase
        .from('cohorts')
        .select('id, active_link_type, linked_cohort_id')
        .eq('id', cohortId)
        .single();

      if (!cohort) {
        return { data: null, error: null };
      }

      // Step 2: Build query based on override logic
      let query = supabase
        .from('learning_modules')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(4);

      switch (cohort.active_link_type) {
        case 'global':
          // Show ONLY global modules
          query = query.eq('is_global', true);
          break;
        case 'cohort':
          // Show ONLY linked cohort's modules
          if (cohort.linked_cohort_id) {
            query = query.eq('cohort_id', cohort.linked_cohort_id);
          } else {
            // Fallback if linked_cohort_id is missing
            query = query.eq('cohort_id', cohortId);
          }
          break;
        case 'own':
        default:
          // Show own modules
          query = query.eq('cohort_id', cohortId);
          break;
      }

      return await query;
    } catch (error) {
      console.error('Error fetching recent modules:', error);
      return { data: null, error };
    }
  };

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!profile) {
        // Don't get stuck in loading state if profile doesn't exist
        setLoading(false);
        return;
      }

      const supabase = getClient();

      try {
        // Admin role: fetch system-wide data
        if (isAdmin) {
          const response = await fetch('/api/admin/dashboard-stats');
          if (response.ok) {
            const data = await response.json();
            setAdminStats(data.stats);
            setAdminSessions(data.upcomingSessions || []);
            setAdminLearnings(data.recentLearnings || []);
          }
          setLoading(false);
          return;
        }

        // Student role: fetch cohort-specific data
        if (activeCohortId) {
          const [
            cohortResult,
            studentsCountResult,
            attendanceResult,
            rankingResult,
            resourcesCountResult,
            sessionsResult,
            modulesResult,
            resourcesResult,
            invoicesResult,
            learningAssetsResult,
            leaderboardResult,
          ] = await Promise.all([
            // Fetch cohort info
            supabase
              .from('cohorts')
              .select('*')
              .eq('id', activeCohortId)
              .single(),
            // Fetch stats - count all members in cohort (using multi-role table)
            supabase
              .from('user_role_assignments')
              .select('*', { count: 'exact', head: true })
              .eq('cohort_id', activeCohortId),
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
              .eq('cohort_id', activeCohortId)
              .single(),
            // Fetch total resources count for the cohort
            supabase
              .from('resources')
              .select('*', { count: 'exact', head: true })
              .eq('cohort_id', activeCohortId),
            // Fetch upcoming sessions (via session_cohorts junction table)
            supabase
              .from('sessions')
              .select('*, session_cohorts!inner(cohort_id)')
              .eq('session_cohorts.cohort_id', activeCohortId)
              .gte('scheduled_at', new Date().toISOString())
              .order('scheduled_at', { ascending: true })
              .limit(3),
            // Fetch recent learning modules (with override logic)
            fetchRecentModules(activeCohortId),
            // Fetch recent resources
            supabase
              .from('resources')
              .select('*')
              .eq('cohort_id', activeCohortId)
              .eq('type', 'file')
              .order('created_at', { ascending: false })
              .limit(4),
            // Fetch invoices (uses API route for proper auth)
            fetch('/api/invoices')
              .then(r => r.ok ? r.json() : { invoices: [], stats: { pending_amount: 0 } })
              .catch(() => ({ invoices: [], stats: { pending_amount: 0 } })),
            // Fetch recent learning assets (recordings, presentations, etc.)
            fetch(`/api/learnings/recent?cohort_id=${activeCohortId}&limit=4`)
              .then(r => r.ok ? r.json() : { recent: [] })
              .catch(() => ({ recent: [] })),
            // Fetch cohort avg attendance (from leaderboard API)
            fetch('/api/analytics?view=leaderboard')
              .then(r => r.ok ? r.json() : { cohortAvg: null })
              .catch(() => ({ cohortAvg: null })),
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
            cohort_avg: leaderboardResult.cohortAvg ?? null,
          });

          // Set sessions, modules, and resources
          setUpcomingSessions(sessionsResult.data || []);
          setRecentModules(modulesResult.data || []);
          setRecentResources(resourcesResult.data || []);

          // Set invoices
          setInvoices(invoicesResult.invoices || []);
          setPendingInvoiceAmount(invoicesResult.stats?.pending_amount || 0);

          // Set learning assets
          setRecentLearningAssets(learningAssetsResult.recent || []);
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
  }, [profile, userLoading, activeCohortId, isAdmin]);

  const getSessionTimeLabel = (date: string) => {
    const sessionDate = parseISO(date);
    if (isToday(sessionDate)) return 'Today';
    if (isTomorrow(sessionDate)) return 'Tomorrow';
    return format(sessionDate, 'EEE, MMM d');
  };

  const handleInvoiceDownload = async (invoice: InvoiceWithCohort) => {
    if (!invoice.pdf_path) {
      toast.error('No PDF available for this invoice');
      return;
    }

    try {
      const response = await fetch(`/api/invoices/${invoice.id}/download`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to download invoice');
      }

      window.open(data.url, '_blank');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to download invoice');
    }
  };

  // Show full-page loader until BOTH auth AND data are ready
  // This prevents flash of empty content
  if (userLoading || loading) {
    return <StudentPageLoader message="Loading your dashboard..." />;
  }

  // Admin role: Show system-wide dashboard
  if (isAdmin) {
    return (
      <div className="space-y-6">
        {/* Admin Welcome Banner */}
        <Card className="relative overflow-hidden border-2">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-cyan-500 to-blue-500" />
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-2xl">Admin Overview</CardTitle>
                <CardDescription>
                  System-wide dashboard across all cohorts
                </CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* System-wide Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Total Users</CardDescription>
              <CardTitle className="text-3xl font-bold">{adminStats?.totalStudents || 0}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Active Cohorts</CardDescription>
              <CardTitle className="text-3xl font-bold">{adminStats?.activeCohorts || 0}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Upcoming Sessions</CardDescription>
              <CardTitle className="text-3xl font-bold">{adminStats?.upcomingSessionsCount || 0}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Total Learnings</CardDescription>
              <CardTitle className="text-3xl font-bold">{adminStats?.totalLearnings || 0}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* All Upcoming Sessions */}
          <Card className="relative overflow-hidden border-2">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-cyan-500 to-blue-500" />
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center">
                    <Calendar className="w-4 h-4 text-white" />
                  </div>
                  <CardTitle className="text-xl">All Upcoming Sessions</CardTitle>
                </div>
                <CardDescription>Across all cohorts</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {!adminSessions || adminSessions.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center">
                    <Calendar className="w-8 h-8 text-blue-500 dark:text-blue-400" />
                  </div>
                  <p className="text-sm font-medium">No upcoming sessions</p>
                  <p className="text-xs text-muted-foreground">Check back later</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {adminSessions.slice(0, 5).map((session, index) => (
                    <div
                      key={session.id}
                      className="group relative flex items-center gap-4 p-4 rounded-xl border bg-gradient-to-br from-blue-50/50 to-cyan-50/50 dark:from-blue-950/20 dark:to-cyan-950/20 hover:from-blue-50 hover:to-cyan-50 dark:hover:from-blue-950/30 dark:hover:to-cyan-950/30 transition-all duration-300"
                    >
                      <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center text-white">
                        <Video className="w-6 h-6" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate">{session.title}</p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="w-3.5 h-3.5" />
                          <span>{format(parseISO(session.scheduled_at), 'MMM d, h:mm a')}</span>
                          <span>•</span>
                          <span>{session.cohortTag}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Learnings */}
          <Card className="relative overflow-hidden border-2">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 via-pink-500 to-purple-500" />
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
                    <BookOpen className="w-4 h-4 text-white" />
                  </div>
                  <CardTitle className="text-xl">Recent Learnings</CardTitle>
                </div>
                <CardDescription>Latest content added</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {!adminLearnings || adminLearnings.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-purple-50 dark:bg-purple-950/30 flex items-center justify-center">
                    <BookOpen className="w-8 h-8 text-purple-500 dark:text-purple-400" />
                  </div>
                  <p className="text-sm font-medium">No learnings yet</p>
                  <p className="text-xs text-muted-foreground">Add content to get started</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {adminLearnings.slice(0, 5).map((learning, index) => (
                    <div
                      key={learning.id}
                      className="group relative flex items-center gap-4 p-4 rounded-xl border bg-gradient-to-br from-purple-50/50 to-pink-50/50 dark:from-purple-950/20 dark:to-pink-950/20 hover:from-purple-50 hover:to-pink-50 dark:hover:from-purple-950/30 dark:hover:to-pink-950/30 transition-all duration-300"
                    >
                      <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-white">
                        <BookOpen className="w-6 h-6" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate">{learning.title}</p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Badge variant="secondary" className="text-xs">
                            {learning.type}
                          </Badge>
                          <span>•</span>
                          <span>{learning.cohortTag}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Student role without cohort: Show error state
  if (!activeCohortId) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>No Cohort Assigned</CardTitle>
            <CardDescription>
              This role is not assigned to any cohort
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Please contact your administrator to assign you to a cohort.
            </p>
          </CardContent>
        </Card>
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
                  <Link
                    key={session.id}
                    href="/calendar"
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
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* My Learnings - Shows actual resources (recordings, presentations) */}
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
            {recentLearningAssets.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-purple-50 dark:bg-purple-950/30 flex items-center justify-center">
                  <BookOpen className="w-8 h-8 text-purple-500 dark:text-purple-400" />
                </div>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">No recent activity</p>
                <p className="text-xs text-muted-foreground dark:text-gray-500">Start learning to see your progress here</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentLearningAssets.map((asset, index) => {
                  const Icon = getContentIcon(asset.content_type);
                  const gradient = getContentGradient(asset.content_type);
                  const typeLabel = getContentTypeLabel(asset.content_type);

                  return (
                    <Link
                      key={asset.id}
                      href={`/learnings?resource=${asset.id}`}
                      className={`group relative flex items-center gap-4 p-4 rounded-xl border-2 transition-all duration-300 hover:shadow-md hover:scale-[1.02] ${
                        asset.content_type === 'video'
                          ? 'border-purple-200 dark:border-purple-800/50 bg-gradient-to-br from-purple-50/50 to-purple-100/30 dark:from-purple-950/20 dark:to-purple-900/10 hover:border-purple-300 dark:hover:border-purple-700 hover:shadow-purple-500/10'
                          : asset.content_type === 'slides'
                          ? 'border-orange-200 dark:border-orange-800/50 bg-gradient-to-br from-orange-50/50 to-orange-100/30 dark:from-orange-950/20 dark:to-orange-900/10 hover:border-orange-300 dark:hover:border-orange-700 hover:shadow-orange-500/10'
                          : asset.content_type === 'document'
                          ? 'border-blue-200 dark:border-blue-800/50 bg-gradient-to-br from-blue-50/50 to-blue-100/30 dark:from-blue-950/20 dark:to-blue-900/10 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-blue-500/10'
                          : 'border-gray-200 dark:border-gray-700 bg-gradient-to-br from-gray-50/50 to-gray-100/30 dark:from-gray-950/20 dark:to-gray-900/10 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-gray-500/10'
                      }`}
                      style={{
                        animationDelay: `${index * 100}ms`,
                        animationFillMode: 'forwards',
                      }}
                    >
                      {/* Resource icon with type-specific gradient */}
                      <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${gradient.from} ${gradient.to} ${gradient.darkFrom} ${gradient.darkTo} flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                        <Icon className="w-6 h-6" />
                      </div>

                      {/* Resource info */}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate text-gray-900 dark:text-white mb-1 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                          {asset.title}
                        </p>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="secondary"
                            className={`text-xs font-medium ${
                              asset.content_type === 'video'
                                ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                                : asset.content_type === 'slides'
                                ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                                : asset.content_type === 'document'
                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
                            }`}
                          >
                            {typeLabel}
                          </Badge>
                          {asset.progress?.is_completed && (
                            <Badge className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                              Completed
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Chevron */}
                      <ChevronRight className="w-5 h-5 text-muted-foreground dark:text-gray-500 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Invoices Card */}
      {invoices.length > 0 && (
        <div className="lg:col-span-2">
          <InvoiceCard
            invoices={invoices}
            pendingAmount={pendingInvoiceAmount}
            onView={handleInvoiceDownload}
            onDownload={handleInvoiceDownload}
          />
        </div>
      )}

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
