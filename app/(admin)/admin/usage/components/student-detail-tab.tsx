'use client';

import { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Loader2, LogIn, BookOpen, Clock, Video, FileText, Presentation, Search } from 'lucide-react';
import { HealthBadge } from './health-badge';
import { formatDistanceToNow, format } from 'date-fns';
import type { UsagePeriod, StudentUsageDetail, CohortUsageStudent } from '@/types';

interface StudentDetailTabProps {
  period: UsagePeriod;
  students: CohortUsageStudent[];
  selectedStudentId: string | null;
  onStudentChange: (userId: string) => void;
}

export function StudentDetailTab({ period, students, selectedStudentId, onStudentChange }: StudentDetailTabProps) {
  const [detail, setDetail] = useState<StudentUsageDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchDetail = useCallback(async () => {
    if (!selectedStudentId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/usage/student?user_id=${selectedStudentId}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setDetail(data);
    } catch (error) {
      console.error('Failed to fetch student detail:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedStudentId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const filteredStudents = students.filter(s =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const activityIcon: Record<string, typeof Video> = {
    video_watched: Video,
    case_study_opened: FileText,
    presentation_viewed: Presentation,
    pdf_opened: FileText,
    resource_completed: BookOpen,
  };

  const methodLabel: Record<string, string> = {
    phone_otp: 'Phone OTP',
    google_oauth: 'Google',
    magic_link: 'Magic Link',
  };

  return (
    <div className="space-y-6">
      {/* Student Selector */}
      <div className="relative w-full max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search student by name or email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
        />
      </div>

      {searchTerm && filteredStudents.length > 0 && !selectedStudentId && (
        <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
          {filteredStudents.slice(0, 10).map((s) => (
            <button
              key={s.user_id}
              className="w-full flex items-center gap-3 px-4 py-2 hover:bg-muted/50 text-left"
              onClick={() => {
                onStudentChange(s.user_id);
                setSearchTerm(s.name);
              }}
            >
              <Avatar className="w-6 h-6">
                <AvatarImage src={s.avatar_url || undefined} />
                <AvatarFallback className="text-[10px]">
                  {s.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <span className="text-sm font-medium">{s.name}</span>
                <span className="text-xs text-muted-foreground ml-2">{s.email}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {!selectedStudentId && (
        <div className="text-center py-12 text-muted-foreground">
          Search and select a student to view their activity
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {detail && !loading && (
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
                        {mod.week_number ? `Week ${mod.week_number}: ` : ''}{mod.module_name}
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
