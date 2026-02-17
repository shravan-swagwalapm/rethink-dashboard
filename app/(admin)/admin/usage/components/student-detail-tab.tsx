'use client';

import { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, LogIn, BookOpen, Clock, Video, FileText, Presentation, Search, ArrowLeft } from 'lucide-react';
import { HealthBadge, HealthDot } from './health-badge';
import { formatDistanceToNow, format } from 'date-fns';
import { toast } from 'sonner';
import type { UsagePeriod, StudentUsageDetail, CohortUsageStudent, CohortUsageStats } from '@/types';

interface StudentDetailTabProps {
  period: UsagePeriod;
  cohorts: { id: string; name: string }[];
}

export function StudentDetailTab({ period, cohorts }: StudentDetailTabProps) {
  const [selectedCohort, setSelectedCohort] = useState('');
  const [students, setStudents] = useState<CohortUsageStudent[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [detail, setDetail] = useState<StudentUsageDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Initialize selectedCohort from first cohort
  useEffect(() => {
    if (cohorts.length > 0 && !selectedCohort) {
      setSelectedCohort(cohorts[0].id);
    }
  }, [cohorts, selectedCohort]);

  // Fetch students when cohort or period changes
  const fetchStudents = useCallback(async () => {
    if (!selectedCohort) return;
    setLoadingStudents(true);
    try {
      const res = await fetch(`/api/admin/usage/cohort?cohort_id=${selectedCohort}&period=${period}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data: CohortUsageStats = await res.json();
      setStudents(data.students || []);
    } catch (error) {
      console.error('Failed to fetch students:', error);
      toast.error('Failed to load students');
    } finally {
      setLoadingStudents(false);
    }
  }, [selectedCohort, period]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  // Fetch student detail when selected
  const fetchDetail = useCallback(async () => {
    if (!selectedStudentId) return;
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/admin/usage/student?user_id=${selectedStudentId}&cohort_id=${selectedCohort}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setDetail(data);
    } catch (error) {
      console.error('Failed to fetch student detail:', error);
      toast.error('Failed to load student details');
    } finally {
      setLoadingDetail(false);
    }
  }, [selectedStudentId, selectedCohort]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  // Filter students by search term
  const filteredStudents = students.filter(s =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const activityIcon: Record<string, typeof Video> = {
    video_watched: Video,
    slides_viewed: Presentation,
    document_opened: FileText,
    link_opened: FileText,
    resource_completed: BookOpen,
  };

  const methodLabel: Record<string, string> = {
    phone_otp: 'Phone OTP',
    google_oauth: 'Google',
    magic_link: 'Magic Link',
  };

  // Handle back to list
  const handleBackToList = () => {
    setSelectedStudentId(null);
    setDetail(null);
  };

  // ── State 2: Student Detail View ──
  if (selectedStudentId) {
    return (
      <div className="space-y-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleBackToList}
          className="gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to student list
        </Button>

        {loadingDetail && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loadingDetail && !detail && (
          <div className="text-center py-12 text-muted-foreground">
            Failed to load student details. Please try again.
          </div>
        )}

        {detail && !loadingDetail && (
          <>
            {/* Student Card */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <Avatar className="w-14 h-14">
                    <AvatarImage src={detail.avatar_url || undefined} />
                    <AvatarFallback>
                      {detail.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-semibold">{detail.name}</h3>
                      <HealthBadge status={detail.health_status} />
                    </div>
                    <p className="text-sm text-muted-foreground">{detail.email}</p>
                    <p className="text-sm text-muted-foreground">{detail.cohort_name}</p>
                  </div>
                  <div className="text-right space-y-1">
                    <div className="text-sm">
                      <span className="text-muted-foreground">Last login: </span>
                      <span className="font-medium">
                        {detail.last_login
                          ? formatDistanceToNow(new Date(detail.last_login), { addSuffix: true })
                          : 'Never'
                        }
                      </span>
                    </div>
                    <div className="text-sm">
                      <span className="text-muted-foreground">Total logins: </span>
                      <span className="font-medium">{detail.total_logins}</span>
                    </div>
                    <div className="text-sm">
                      <span className="text-muted-foreground">Content: </span>
                      <span className="font-medium">{detail.content_completion_percent}% complete</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Login History */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <LogIn className="w-4 h-4" />
                    Login History
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {detail.login_history.map((login, i) => (
                      <div key={i} className="flex items-center justify-between text-sm py-1">
                        <span>{format(new Date(login.created_at), 'MMM d, yyyy h:mm a')}</span>
                        <Badge variant="outline" className="text-xs">
                          {methodLabel[login.login_method] || login.login_method}
                        </Badge>
                      </div>
                    ))}
                    {detail.login_history.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">No login history</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Module Engagement */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <BookOpen className="w-4 h-4" />
                    Content by Module
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {detail.module_engagement.map((mod) => (
                    <div key={mod.module_id} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">
                          {mod.week_number && !mod.module_name.toLowerCase().startsWith('week')
                            ? `Week ${mod.week_number}: `
                            : ''
                          }{mod.module_name}
                        </span>
                        <span className="text-muted-foreground tabular-nums">{mod.completed}/{mod.total}</span>
                      </div>
                      <Progress value={mod.percent} className="h-2" />
                    </div>
                  ))}
                  {detail.module_engagement.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">No module data</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {detail.recent_activity.map((activity, i) => {
                    const Icon = activityIcon[activity.type] || FileText;
                    return (
                      <div key={i} className="flex items-center gap-3 text-sm">
                        <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span className="flex-1">{activity.title}</span>
                        {activity.detail && (
                          <Badge variant="outline" className="text-xs">{activity.detail}</Badge>
                        )}
                        <span className="text-xs text-muted-foreground shrink-0">
                          {activity.timestamp
                            ? formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })
                            : ''
                          }
                        </span>
                      </div>
                    );
                  })}
                  {detail.recent_activity.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">No recent activity</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    );
  }

  // ── State 1: Student List View (default) ──
  return (
    <div className="space-y-6">
      {/* Top bar: Cohort dropdown + Search */}
      <div className="flex items-center gap-4">
        <Select value={selectedCohort} onValueChange={(value) => { setSelectedCohort(value); setSearchTerm(''); }}>
          <SelectTrigger className="w-[250px]">
            <SelectValue placeholder="Select cohort" />
          </SelectTrigger>
          <SelectContent>
            {cohorts.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Student Table */}
      {loadingStudents ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Students ({filteredStudents.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="text-center">Logins</TableHead>
                  <TableHead>Last Login</TableHead>
                  <TableHead className="text-center">Content</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.map((student) => (
                  <TableRow
                    key={student.user_id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setSelectedStudentId(student.user_id)}
                  >
                    <TableCell>
                      <HealthDot status={student.health_status} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="w-8 h-8">
                          <AvatarImage src={student.avatar_url || undefined} />
                          <AvatarFallback className="text-xs">
                            {student.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium text-sm">{student.name}</div>
                          <div className="text-xs text-muted-foreground">{student.email}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center tabular-nums">{student.login_count}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {student.last_login
                        ? formatDistanceToNow(new Date(student.last_login), { addSuffix: true })
                        : 'Never'
                      }
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center gap-2 justify-center">
                        <Progress value={student.content_completion_percent} className="w-16 h-1.5" />
                        <span className="text-xs tabular-nums">{student.content_completion_percent}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <HealthBadge status={student.health_status} />
                    </TableCell>
                  </TableRow>
                ))}
                {filteredStudents.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      {searchTerm ? 'No students match your search' : 'No students in this cohort'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
