'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Loader2, Users, LogIn, AlertTriangle, BookOpen, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { HealthBadge, HealthDot } from './health-badge';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import type { UsagePeriod, CohortUsageStats } from '@/types';

interface Cohort {
  id: string;
  name: string;
}

interface CohortTabProps {
  period: UsagePeriod;
  cohorts: Cohort[];
  selectedCohort: string;
  onCohortChange: (cohortId: string) => void;
}

type SortKey = 'name' | 'login_count' | 'last_login' | 'content_completion_percent' | 'health_status';
type SortDir = 'asc' | 'desc';

export function CohortTab({ period, selectedCohort }: CohortTabProps) {
  const [stats, setStats] = useState<CohortUsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir | null>(null);

  const fetchStats = useCallback(async () => {
    if (!selectedCohort) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/usage/cohort?cohort_id=${selectedCohort}&period=${period}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setStats(data);
    } catch (error) {
      console.error('Failed to fetch cohort stats:', error);
      toast.error('Failed to load cohort stats');
    } finally {
      setLoading(false);
    }
  }, [selectedCohort, period]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const handleSort = (key: SortKey) => {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir('asc');
    } else if (sortDir === 'asc') {
      setSortDir('desc');
    } else {
      setSortKey(null);
      setSortDir(null);
    }
  };

  const sortedStudents = useMemo(() => {
    const students = stats?.students || [];
    if (!sortKey || !sortDir) return students;

    return [...students].sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      switch (sortKey) {
        case 'name':
          return dir * a.name.localeCompare(b.name);
        case 'login_count':
          return dir * (a.login_count - b.login_count);
        case 'last_login': {
          const aTime = a.last_login ? new Date(a.last_login).getTime() : 0;
          const bTime = b.last_login ? new Date(b.last_login).getTime() : 0;
          return dir * (aTime - bTime);
        }
        case 'content_completion_percent':
          return dir * (a.content_completion_percent - b.content_completion_percent);
        case 'health_status': {
          const order: Record<string, number> = { active: 0, at_risk: 1, inactive: 2 };
          return dir * ((order[a.health_status] ?? 2) - (order[b.health_status] ?? 2));
        }
        default:
          return 0;
      }
    });
  }, [stats?.students, sortKey, sortDir]);

  if (!selectedCohort) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Select a cohort to view usage data
      </div>
    );
  }

  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Logins This Period</CardTitle>
            <LogIn className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.logins_this_period}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Students</CardTitle>
            <Users className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.active_students}/{stats.total_students}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">At-Risk Students</CardTitle>
            <AlertTriangle className="w-4 h-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{stats.at_risk_count}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Content Completion</CardTitle>
            <BookOpen className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.content_completion_percent}%</div>
            <Progress value={stats.content_completion_percent} className="mt-2 h-1.5" />
          </CardContent>
        </Card>
      </div>

      {/* Student Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Students ({sortedStudents.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead
                  className="cursor-pointer select-none hover:text-foreground transition-colors"
                  onClick={() => handleSort('name')}
                >
                  <span className="inline-flex items-center gap-1.5">
                    Name
                    {sortKey === 'name' ? (sortDir === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />) : <ArrowUpDown className="w-4 h-4 opacity-50" />}
                  </span>
                </TableHead>
                <TableHead
                  className="text-center cursor-pointer select-none hover:text-foreground transition-colors"
                  onClick={() => handleSort('login_count')}
                >
                  <span className="inline-flex items-center gap-1.5 justify-center">
                    Logins
                    {sortKey === 'login_count' ? (sortDir === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />) : <ArrowUpDown className="w-4 h-4 opacity-50" />}
                  </span>
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none hover:text-foreground transition-colors"
                  onClick={() => handleSort('last_login')}
                >
                  <span className="inline-flex items-center gap-1.5">
                    Last Login
                    {sortKey === 'last_login' ? (sortDir === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />) : <ArrowUpDown className="w-4 h-4 opacity-50" />}
                  </span>
                </TableHead>
                <TableHead
                  className="text-center cursor-pointer select-none hover:text-foreground transition-colors"
                  onClick={() => handleSort('content_completion_percent')}
                >
                  <span className="inline-flex items-center gap-1.5 justify-center">
                    Content
                    {sortKey === 'content_completion_percent' ? (sortDir === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />) : <ArrowUpDown className="w-4 h-4 opacity-50" />}
                  </span>
                </TableHead>
                <TableHead
                  className="cursor-pointer select-none hover:text-foreground transition-colors"
                  onClick={() => handleSort('health_status')}
                >
                  <span className="inline-flex items-center gap-1.5">
                    Status
                    {sortKey === 'health_status' ? (sortDir === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />) : <ArrowUpDown className="w-4 h-4 opacity-50" />}
                  </span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedStudents.map((student) => (
                <TableRow key={student.user_id}>
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
              {sortedStudents.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No students in this cohort
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Module Asset Breakdown */}
      {stats.module_assets && stats.module_assets.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Content by Module</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {stats.module_assets.map((mod) => (
              <div key={mod.module_id} className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">
                    {mod.week_number ? `Week ${mod.week_number}: ` : ''}{mod.module_name}
                  </span>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs text-muted-foreground">
                  <span>Videos {mod.videos.completed}/{mod.videos.total}</span>
                  <span>Slides {mod.slides.completed}/{mod.slides.total}</span>
                  <span>Documents {mod.documents.completed}/{mod.documents.total}</span>
                  <span>Links {mod.links.completed}/{mod.links.total}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
