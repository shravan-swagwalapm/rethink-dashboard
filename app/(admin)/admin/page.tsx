'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@/hooks/use-user';
import { getClient } from '@/lib/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import {
  Users,
  UserPlus,
  CalendarDays,
  Video,
  TrendingUp,
  HelpCircle,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { format } from 'date-fns';

interface AdminStats {
  totalUsers: number;
  totalStudents: number;
  totalMentors: number;
  activeCohorts: number;
  upcomingSessions: number;
  pendingInvites: number;
  openTickets: number;
  avgAttendance: number;
}

interface RecentActivity {
  id: string;
  type: 'user_joined' | 'session_created' | 'resource_uploaded' | 'ticket_opened';
  title: string;
  timestamp: string;
}

export default function AdminPage() {
  const { profile, loading: userLoading } = useUser();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [activities, setActivities] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAdminData = async () => {
      const supabase = getClient();

      try {
        // Fetch user counts
        const [
          { count: totalUsers },
          { count: totalStudents },
          { count: totalMentors },
          { count: activeCohorts },
          { count: upcomingSessions },
          { count: pendingInvites },
          { count: openTickets },
        ] = await Promise.all([
          supabase.from('profiles').select('*', { count: 'exact', head: true }),
          supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'student'),
          supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'mentor'),
          supabase.from('cohorts').select('*', { count: 'exact', head: true }).eq('status', 'active'),
          supabase.from('sessions').select('*', { count: 'exact', head: true }).gte('scheduled_at', new Date().toISOString()),
          supabase.from('invites').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
          supabase.from('support_tickets').select('*', { count: 'exact', head: true }).eq('status', 'open'),
        ]);

        // Fetch average attendance
        const { data: attendance } = await supabase
          .from('attendance')
          .select('attendance_percentage');

        const avgAttendance = attendance?.length
          ? Math.round(
              attendance.reduce((acc: number, a: { attendance_percentage: number | null }) => acc + (a.attendance_percentage || 0), 0) / attendance.length
            )
          : 0;

        setStats({
          totalUsers: totalUsers || 0,
          totalStudents: totalStudents || 0,
          totalMentors: totalMentors || 0,
          activeCohorts: activeCohorts || 0,
          upcomingSessions: upcomingSessions || 0,
          pendingInvites: pendingInvites || 0,
          openTickets: openTickets || 0,
          avgAttendance,
        });

        // Mock recent activities (would be from activity log table)
        setActivities([
          {
            id: '1',
            type: 'user_joined',
            title: 'New student joined Cohort 6',
            timestamp: new Date().toISOString(),
          },
          {
            id: '2',
            type: 'session_created',
            title: 'New session scheduled: PM Fundamentals',
            timestamp: new Date(Date.now() - 3600000).toISOString(),
          },
          {
            id: '3',
            type: 'resource_uploaded',
            title: 'New resource added: Week 5 Materials',
            timestamp: new Date(Date.now() - 7200000).toISOString(),
          },
        ]);
      } catch (error) {
        console.error('Error fetching admin data:', error);
      } finally {
        setLoading(false);
      }
    };

    if (!userLoading) {
      fetchAdminData();
    }
  }, [userLoading]);

  const quickActions = [
    { label: 'Send Invites', href: '/admin/invites', icon: UserPlus, color: 'bg-blue-500' },
    { label: 'Create Session', href: '/admin/sessions', icon: Video, color: 'bg-purple-500' },
    { label: 'Manage Cohorts', href: '/admin/cohorts', icon: CalendarDays, color: 'bg-green-500' },
    { label: 'View Support', href: '/admin/support', icon: HelpCircle, color: 'bg-amber-500' },
  ];

  if (userLoading || loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
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
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Sparkles className="w-8 h-8 text-primary" />
          Admin Dashboard
        </h1>
        <p className="text-muted-foreground mt-1">
          Welcome back, {profile?.full_name?.split(' ')[0] || 'Admin'}. Here&apos;s what&apos;s happening.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="hover-lift">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Users</p>
                <p className="text-3xl font-bold">{stats?.totalUsers}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats?.totalStudents} students, {stats?.totalMentors} mentors
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Users className="w-6 h-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover-lift">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Cohorts</p>
                <p className="text-3xl font-bold">{stats?.activeCohorts}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats?.upcomingSessions} upcoming sessions
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center">
                <CalendarDays className="w-6 h-6 text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover-lift">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Attendance</p>
                <p className="text-3xl font-bold">{stats?.avgAttendance}%</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Across all sessions
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-purple-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover-lift">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending Actions</p>
                <p className="text-3xl font-bold">{(stats?.pendingInvites || 0) + (stats?.openTickets || 0)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats?.pendingInvites} invites, {stats?.openTickets} tickets
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <HelpCircle className="w-6 h-6 text-amber-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common administrative tasks</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {quickActions.map((action) => (
                <Link key={action.href} href={action.href}>
                  <Button
                    variant="outline"
                    className="w-full h-auto py-4 flex-col gap-2 hover-lift"
                  >
                    <div className={`w-10 h-10 rounded-xl ${action.color} flex items-center justify-center`}>
                      <action.icon className="w-5 h-5 text-white" />
                    </div>
                    <span>{action.label}</span>
                  </Button>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest updates in the system</CardDescription>
          </CardHeader>
          <CardContent>
            {activities.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No recent activity</p>
              </div>
            ) : (
              <div className="space-y-4">
                {activities.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-start gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="w-2 h-2 rounded-full bg-primary mt-2" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{activity.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(activity.timestamp), 'MMM d, h:mm a')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Pending Items */}
      {((stats?.pendingInvites || 0) > 0 || (stats?.openTickets || 0) > 0) && (
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardHeader>
            <CardTitle className="text-amber-600 dark:text-amber-400">
              Attention Required
            </CardTitle>
            <CardDescription>
              Items that need your attention
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              {(stats?.pendingInvites || 0) > 0 && (
                <Link href="/admin/invites">
                  <Button variant="outline" className="gap-2">
                    <Badge variant="secondary">{stats?.pendingInvites}</Badge>
                    Pending Invites
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
              )}
              {(stats?.openTickets || 0) > 0 && (
                <Link href="/admin/support">
                  <Button variant="outline" className="gap-2">
                    <Badge variant="secondary">{stats?.openTickets}</Badge>
                    Open Tickets
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
