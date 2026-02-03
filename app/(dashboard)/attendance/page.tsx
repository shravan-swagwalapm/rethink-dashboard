'use client';

import { Suspense, useEffect, useState } from 'react';
import { useUser } from '@/hooks/use-user';
import { useSearchParams } from 'next/navigation';
import { getClient } from '@/lib/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { StudentPageLoader } from '@/components/ui/page-loader';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import {
  BarChart3,
  Download,
  Clock,
  LogIn,
  LogOut,
  Users,
  TrendingUp,
  AlertTriangle,
} from 'lucide-react';
import { format, parseISO, differenceInMinutes } from 'date-fns';
import type { Session, Attendance, Profile } from '@/types';

interface AttendanceWithUser extends Attendance {
  user: Profile;
}

interface SessionWithAttendance extends Session {
  attendance: AttendanceWithUser[];
  total_students: number;
  attended_count: number;
}

function AttendanceContent() {
  const { profile, isMentor, isAdmin, loading: userLoading } = useUser();
  const searchParams = useSearchParams();
  const studentIdFilter = searchParams.get('student');

  const [sessions, setSessions] = useState<SessionWithAttendance[]>([]);
  const [selectedSession, setSelectedSession] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const fetchAttendanceData = async () => {
      if (!profile?.cohort_id) {
        setLoading(false);
        return;
      }

      const supabase = getClient();

      try {
        // Fetch all sessions
        const { data: sessionsData, error: sessionsError } = await supabase
          .from('sessions')
          .select('*')
          .eq('cohort_id', profile.cohort_id)
          .lte('scheduled_at', new Date().toISOString())
          .order('scheduled_at', { ascending: false });

        if (sessionsError) throw sessionsError;

        // Fetch attendance data
        const sessionIds = sessionsData?.map((s: Session) => s.id) || [];
        const { data: attendanceData } = await supabase
          .from('attendance')
          .select(`
            *,
            user:profiles(*)
          `)
          .in('session_id', sessionIds);

        // Get team members count
        let studentsQuery = supabase
          .from('profiles')
          .select('id')
          .eq('role', 'student')
          .eq('cohort_id', profile.cohort_id);

        if (isMentor && !isAdmin) {
          studentsQuery = studentsQuery.eq('mentor_id', profile.id);
        }

        const { data: studentsData } = await studentsQuery;
        const totalStudents = studentsData?.length || 0;

        // Merge attendance with sessions
        const sessionsWithAttendance = sessionsData?.map((session: Session) => {
          const sessionAttendance = attendanceData?.filter((a: AttendanceWithUser) => a.session_id === session.id) || [];

          // If filtering by student
          const filteredAttendance = studentIdFilter
            ? sessionAttendance.filter((a: AttendanceWithUser) => a.user_id === studentIdFilter)
            : sessionAttendance;

          return {
            ...session,
            attendance: filteredAttendance as AttendanceWithUser[],
            total_students: studentIdFilter ? 1 : totalStudents,
            attended_count: filteredAttendance.length,
          };
        }) || [];

        setSessions(sessionsWithAttendance);

        // Select the most recent session by default
        if (sessionsWithAttendance.length > 0 && !selectedSession) {
          setSelectedSession(sessionsWithAttendance[0].id);
        }
      } catch (error) {
        console.error('Error fetching attendance:', error);
        toast.error('Failed to load attendance data');
      } finally {
        setLoading(false);
      }
    };

    if (!userLoading && (isMentor || isAdmin)) {
      fetchAttendanceData();
    } else if (!userLoading) {
      setLoading(false);
    }
  }, [profile, isMentor, isAdmin, userLoading, studentIdFilter, selectedSession]);

  const selectedSessionData = sessions.find(s => s.id === selectedSession);

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '--';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const getAttendancePercentageColor = (percentage: number | null) => {
    if (!percentage) return 'text-muted-foreground';
    if (percentage >= 80) return 'text-green-600 dark:text-green-400';
    if (percentage >= 50) return 'text-amber-600 dark:text-amber-400';
    return 'text-red-600 dark:text-red-400';
  };

  const exportToCSV = () => {
    if (!selectedSessionData) return;

    setExporting(true);

    try {
      const headers = ['Name', 'Email', 'Join Time', 'Leave Time', 'Duration', 'Attendance %'];
      const rows = selectedSessionData.attendance.map(a => [
        a.user?.full_name || 'Unknown',
        a.user?.email || '',
        a.join_time ? format(parseISO(a.join_time), 'HH:mm:ss') : '-',
        a.leave_time ? format(parseISO(a.leave_time), 'HH:mm:ss') : '-',
        formatDuration(a.duration_seconds),
        `${a.attendance_percentage || 0}%`,
      ]);

      const csv = [
        `Session: ${selectedSessionData.title}`,
        `Date: ${format(parseISO(selectedSessionData.scheduled_at), 'MMMM d, yyyy')}`,
        '',
        headers.join(','),
        ...rows.map(r => r.join(',')),
      ].join('\n');

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `attendance_${selectedSessionData.title.replace(/\s+/g, '_')}.csv`;
      link.click();
      URL.revokeObjectURL(url);

      toast.success('Attendance exported successfully');
    } catch (error) {
      toast.error('Failed to export attendance');
    } finally {
      setExporting(false);
    }
  };

  // Calculate cumulative stats
  const cumulativeStats = sessions.reduce(
    (acc, session) => {
      session.attendance.forEach(a => {
        const userId = a.user_id;
        if (!acc.byUser[userId]) {
          acc.byUser[userId] = {
            user: a.user,
            total: 0,
            count: 0,
          };
        }
        acc.byUser[userId].total += a.attendance_percentage || 0;
        acc.byUser[userId].count += 1;
      });
      return acc;
    },
    { byUser: {} as Record<string, { user: Profile; total: number; count: number }> }
  );

  if (userLoading || loading) {
    return <StudentPageLoader message="Loading attendance records..." />;
  }

  if (!isMentor && !isAdmin) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <BarChart3 className="w-12 h-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">Access Restricted</h3>
          <p className="text-muted-foreground text-center max-w-sm">
            Attendance dashboard is only available for mentors and administrators.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Attendance Dashboard</h1>
          <p className="text-muted-foreground">
            Track session attendance for your team
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedSession} onValueChange={setSelectedSession}>
            <SelectTrigger className="w-[250px]">
              <SelectValue placeholder="Select session" />
            </SelectTrigger>
            <SelectContent>
              {sessions.map((session) => (
                <SelectItem key={session.id} value={session.id}>
                  <div className="flex flex-col">
                    <span>{session.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {format(parseISO(session.scheduled_at), 'MMM d, yyyy')}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            onClick={exportToCSV}
            disabled={!selectedSessionData || exporting}
          >
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      {selectedSessionData && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Users className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Expected</p>
                  <p className="text-xl font-bold">{selectedSessionData.total_students}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <LogIn className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Attended</p>
                  <p className="text-xl font-bold">{selectedSessionData.attended_count}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Attendance Rate</p>
                  <p className="text-xl font-bold">
                    {selectedSessionData.total_students > 0
                      ? Math.round((selectedSessionData.attended_count / selectedSessionData.total_students) * 100)
                      : 0}
                    %
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Absent</p>
                  <p className="text-xl font-bold">
                    {selectedSessionData.total_students - selectedSessionData.attended_count}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Attendance Table */}
      <Card>
        <CardHeader>
          <CardTitle>Session Attendance</CardTitle>
          {selectedSessionData && (
            <CardDescription>
              {selectedSessionData.title} - {format(parseISO(selectedSessionData.scheduled_at), 'MMMM d, yyyy h:mm a')}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          {!selectedSessionData ? (
            <div className="text-center py-12 text-muted-foreground">
              <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Select a session to view attendance</p>
            </div>
          ) : selectedSessionData.attendance.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No attendance records</p>
              <p className="text-sm">Attendance data will appear here once tracked</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Join Time</TableHead>
                    <TableHead>Leave Time</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Attendance %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedSessionData.attendance.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={record.user?.avatar_url || ''} />
                            <AvatarFallback className="gradient-bg text-white text-sm">
                              {record.user?.full_name?.charAt(0) || '?'}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{record.user?.full_name || 'Unknown'}</p>
                            <p className="text-xs text-muted-foreground">{record.user?.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <LogIn className="w-4 h-4 text-green-500" />
                          {record.join_time
                            ? format(parseISO(record.join_time), 'h:mm:ss a')
                            : '-'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <LogOut className="w-4 h-4 text-red-500" />
                          {record.leave_time
                            ? format(parseISO(record.leave_time), 'h:mm:ss a')
                            : '-'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-muted-foreground" />
                          {formatDuration(record.duration_seconds)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={getAttendancePercentageColor(record.attendance_percentage)}
                        >
                          {record.attendance_percentage || 0}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cumulative Attendance */}
      {Object.keys(cumulativeStats.byUser).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Cumulative Attendance</CardTitle>
            <CardDescription>
              Average attendance across all sessions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Sessions Attended</TableHead>
                    <TableHead>Average Attendance</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.values(cumulativeStats.byUser)
                    .sort((a, b) => (b.total / b.count) - (a.total / a.count))
                    .map((stat) => {
                      const avgAttendance = Math.round(stat.total / stat.count);
                      return (
                        <TableRow key={stat.user?.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={stat.user?.avatar_url || ''} />
                                <AvatarFallback className="gradient-bg text-white text-sm">
                                  {stat.user?.full_name?.charAt(0) || '?'}
                                </AvatarFallback>
                              </Avatar>
                              <span className="font-medium">{stat.user?.full_name || 'Unknown'}</span>
                            </div>
                          </TableCell>
                          <TableCell>{stat.count} / {sessions.length}</TableCell>
                          <TableCell>
                            <span className={`font-medium ${getAttendancePercentageColor(avgAttendance)}`}>
                              {avgAttendance}%
                            </span>
                          </TableCell>
                          <TableCell>
                            {avgAttendance >= 75 ? (
                              <Badge variant="secondary" className="bg-green-500/10 text-green-600">
                                Good
                              </Badge>
                            ) : (
                              <Badge variant="destructive">
                                Needs Attention
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function AttendancePage() {
  return (
    <Suspense fallback={
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-48" />
        </div>
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    }>
      <AttendanceContent />
    </Suspense>
  );
}
