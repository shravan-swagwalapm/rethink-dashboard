'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useUserContext } from '@/contexts/user-context';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  TrendingUp,
  Calendar,
  Clock,
  ChevronDown,
  Users,
  AlertTriangle,
  BarChart3,
  Trophy,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { format } from 'date-fns';

// ─── Types ───

interface AttendanceSession {
  sessionId: string;
  title: string;
  date: string;
  totalDuration: number;
  attended: boolean;
  percentage: number;
  durationAttended: number;
  joinCount: number;
  segments: { join: string; leave: string; duration: number }[];
}

interface AttendanceStats {
  overallPercentage: number;
  sessionsAttended: number;
  sessionsTotal: number;
  totalHours: number;
}

interface MentorStudent {
  userId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  sessionsAttended: number;
  sessionsTotal: number;
  avgPercentage: number;
  sessions: AttendanceSession[];
}

interface LeaderboardEntry {
  userId: string;
  name: string;
  avatarUrl: string | null;
  avgPercentage: number;
  sessionsAttended: number;
  sessionsTotal: number;
  sessionPercentages: Record<string, number>;
}

interface LeaderboardSession {
  id: string;
  title: string;
  date: string;
}

// ─── Helpers ───

function getAttendanceBadge(percentage: number) {
  if (percentage >= 75) {
    return <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-200">{percentage}%</Badge>;
  }
  if (percentage >= 50) {
    return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-200">{percentage}%</Badge>;
  }
  return <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-200">{percentage}%</Badge>;
}

function getAttendanceColor(percentage: number) {
  if (percentage >= 75) return 'border-l-green-500';
  if (percentage >= 50) return 'border-l-yellow-500';
  return 'border-l-red-500';
}

function AnimatedNumber({ value, suffix = '' }: { value: number; suffix?: string }) {
  const [displayed, setDisplayed] = useState(0);

  useEffect(() => {
    const duration = 600;
    const steps = 30;
    const increment = value / steps;
    let step = 0;

    const timer = setInterval(() => {
      step++;
      setDisplayed(Math.min(value, Math.round(increment * step * 100) / 100));
      if (step >= steps) clearInterval(timer);
    }, duration / steps);

    return () => clearInterval(timer);
  }, [value]);

  return (
    <span>
      {suffix === '%' ? `${displayed}%` : displayed}
      {suffix && suffix !== '%' ? ` ${suffix}` : ''}
    </span>
  );
}

// ─── Session Card (shared between student and mentor views) ───

function SessionCard({ session }: { session: AttendanceSession }) {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className={`border rounded-lg overflow-hidden border-l-4 ${getAttendanceColor(session.percentage)}`}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="w-full p-4 h-auto justify-between hover:bg-muted/50"
            aria-expanded={open}
          >
            <div className="flex items-center gap-3 text-left">
              <div>
                <p className="font-medium text-sm">{session.title}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                  <Calendar className="w-3 h-3" />
                  <span>{format(new Date(session.date), 'MMM d, yyyy')}</span>
                  <span>·</span>
                  <Clock className="w-3 h-3" />
                  <span>{session.durationAttended} / {session.totalDuration} min</span>
                  {session.joinCount > 1 && (
                    <>
                      <span>·</span>
                      <span>{session.joinCount} joins</span>
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {session.attended ? getAttendanceBadge(session.percentage) : (
                <Badge variant="outline" className="bg-gray-500/10 text-gray-500 border-gray-200">Absent</Badge>
              )}
              <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
            </div>
          </Button>
        </CollapsibleTrigger>
        <AnimatePresence>
          {open && (
            <CollapsibleContent forceMount>
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <div className="px-4 pb-4 border-t">
                  {session.segments.length > 0 ? (
                    <div className="mt-3 space-y-2">
                      {session.segments.map((seg, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                          <div className="w-2 h-2 rounded-full bg-primary" />
                          <span className="font-medium">Join {i + 1}:</span>
                          <span>
                            {format(new Date(seg.join), 'h:mm a')} — {format(new Date(seg.leave), 'h:mm a')}
                          </span>
                          <span className="text-xs">({seg.duration} min)</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-muted-foreground">No segment data available</p>
                  )}
                </div>
              </motion.div>
            </CollapsibleContent>
          )}
        </AnimatePresence>
      </div>
    </Collapsible>
  );
}

// ─── Student View ───

function StudentView() {
  const { user, activeCohortId } = useUserContext();
  const [attendance, setAttendance] = useState<AttendanceSession[]>([]);
  const [stats, setStats] = useState<AttendanceStats | null>(null);
  const [loading, setLoading] = useState(true);

  // Leaderboard state
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [leaderboardSessions, setLeaderboardSessions] = useState<LeaderboardSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<string>('overall');
  const [cohortAvg, setCohortAvg] = useState<number>(0);
  const [leaderboardLoading, setLeaderboardLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const cohortParam = activeCohortId ? `?cohort_id=${activeCohortId}` : '';
        const res = await fetch(`/api/analytics${cohortParam}`);
        if (res.ok) {
          const data = await res.json();
          setAttendance(data.attendance || []);
          setStats(data.stats);
        }
      } catch (error) {
        console.error('Failed to fetch attendance:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [activeCohortId]);

  // Fetch leaderboard data separately
  useEffect(() => {
    async function fetchLeaderboard() {
      try {
        const cohortParam = activeCohortId ? `&cohort_id=${activeCohortId}` : '';
        const res = await fetch(`/api/analytics?view=leaderboard${cohortParam}`);
        if (res.ok) {
          const data = await res.json();
          setLeaderboard(data.leaderboard || []);
          setLeaderboardSessions(data.sessions || []);
          setCohortAvg(data.cohortAvg || 0);
        }
      } catch (error) {
        console.error('Failed to fetch leaderboard:', error);
      } finally {
        setLeaderboardLoading(false);
      }
    }
    fetchLeaderboard();
  }, [activeCohortId]);

  // Sort leaderboard by selected session or overall
  const sortedLeaderboard = useMemo(() => {
    if (selectedSession === 'overall') {
      return [...leaderboard].sort((a, b) => b.avgPercentage - a.avgPercentage);
    }
    // Sort by specific session's attendance
    return [...leaderboard].sort((a, b) => {
      const aVal = a.sessionPercentages[selectedSession] ?? -1;
      const bVal = b.sessionPercentages[selectedSession] ?? -1;
      return bVal - aVal;
    });
  }, [leaderboard, selectedSession]);

  const chartData = attendance
    .filter((a) => a.attended)
    .map((a, i) => ({
      name: `Week ${i + 1}`,
      fullTitle: a.title,
      date: format(new Date(a.date), 'MMM d, yyyy'),
      attendance: a.percentage,
    }));

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <Skeleton className="w-12 h-12 rounded-xl" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-7 w-16" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <Skeleton className="h-[300px] w-full rounded-lg" />
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (!stats || attendance.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <Calendar className="w-16 h-16 mx-auto mb-4 opacity-50" />
        <p className="text-xl font-medium">No attendance data yet</p>
        <p className="text-sm mt-1">Attend your first session to see your stats here</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}>
          <Card aria-label={`Overall attendance: ${stats.overallPercentage}%`}>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  stats.overallPercentage >= 75
                    ? 'bg-green-500/10'
                    : stats.overallPercentage >= 50
                    ? 'bg-yellow-500/10'
                    : 'bg-red-500/10'
                }`}>
                  <TrendingUp className={`w-6 h-6 ${
                    stats.overallPercentage >= 75
                      ? 'text-green-500'
                      : stats.overallPercentage >= 50
                      ? 'text-yellow-500'
                      : 'text-red-500'
                  }`} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Overall Attendance</p>
                  <p className="text-2xl font-bold">
                    <AnimatedNumber value={stats.overallPercentage} suffix="%" />
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Card aria-label={`Sessions attended: ${stats.sessionsAttended} of ${stats.sessionsTotal}`}>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <BarChart3 className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Sessions Attended</p>
                  <p className="text-2xl font-bold">
                    {stats.sessionsAttended} / {stats.sessionsTotal}
                  </p>
                  <p className="text-xs text-muted-foreground">sessions</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card aria-label={`Total hours: ${stats.totalHours}`}>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center">
                  <Clock className="w-6 h-6 text-purple-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Hours</p>
                  <p className="text-2xl font-bold">
                    <AnimatedNumber value={stats.totalHours} suffix="hrs" />
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Chart */}
      {chartData.length > 1 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="w-4 h-4" />
                Your Attendance Over Time
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div role="img" aria-label="Your attendance trend over sessions">
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="studentGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="name" className="text-xs" tick={{ fill: 'var(--muted-foreground)' }} />
                    <YAxis
                      domain={[0, 100]}
                      className="text-xs hidden sm:block"
                      tick={{ fill: 'var(--muted-foreground)' }}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload?.[0]) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-popover border rounded-lg px-3 py-2 shadow-md">
                              <p className="text-sm font-medium">{data.fullTitle}</p>
                              <p className="text-xs text-muted-foreground">{data.date}</p>
                              <p className="text-sm font-bold text-primary">{data.attendance}%</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="attendance"
                      stroke="var(--primary)"
                      strokeWidth={2}
                      fill="url(#studentGradient)"
                      isAnimationActive={true}
                      animationDuration={1000}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Session cards */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Session History</h2>
        <div className="space-y-2">
          {[...attendance].reverse().map((session, i) => (
            <motion.div
              key={session.sessionId}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * i }}
            >
              <SessionCard session={session} />
            </motion.div>
          ))}
        </div>
      </div>

      {/* Cohort Leaderboard */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Trophy className="w-4 h-4" />
                  Cohort Leaderboard
                </CardTitle>
                <CardDescription>
                  {cohortAvg > 0 && `Cohort avg: ${cohortAvg}% · `}
                  {sortedLeaderboard.length} students
                </CardDescription>
              </div>
              <Select value={selectedSession} onValueChange={setSelectedSession}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filter by session" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="overall">Overall</SelectItem>
                  {leaderboardSessions.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {leaderboardLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-lg" />
                ))}
              </div>
            ) : sortedLeaderboard.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Trophy className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No leaderboard data yet</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Rank</TableHead>
                    <TableHead>Student</TableHead>
                    <TableHead className="text-right">
                      {selectedSession === 'overall' ? 'Avg Attendance' : 'Attendance'}
                    </TableHead>
                    {selectedSession === 'overall' && (
                      <TableHead className="text-right hidden sm:table-cell">Sessions</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedLeaderboard.map((entry, index) => {
                    const isCurrentUser = entry.userId === user?.id;
                    const displayPercentage =
                      selectedSession === 'overall'
                        ? entry.avgPercentage
                        : entry.sessionPercentages[selectedSession] ?? 0;
                    const wasPresent =
                      selectedSession === 'overall'
                        ? entry.sessionsAttended > 0
                        : selectedSession in entry.sessionPercentages;

                    return (
                      <TableRow
                        key={entry.userId}
                        className={
                          isCurrentUser
                            ? 'bg-primary/5 border-l-2 border-l-primary font-medium'
                            : ''
                        }
                      >
                        <TableCell className="font-bold text-muted-foreground">
                          {index + 1}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2.5">
                            <Avatar className="w-7 h-7">
                              <AvatarImage src={entry.avatarUrl || ''} alt={entry.name} />
                              <AvatarFallback className="text-xs">
                                {entry.name.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span className={isCurrentUser ? 'font-semibold' : ''}>
                              {entry.name}
                              {isCurrentUser && (
                                <span className="text-xs text-primary ml-1.5">(You)</span>
                              )}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {wasPresent
                            ? getAttendanceBadge(displayPercentage)
                            : <Badge variant="outline" className="bg-gray-500/10 text-gray-500 border-gray-200">Absent</Badge>
                          }
                        </TableCell>
                        {selectedSession === 'overall' && (
                          <TableCell className="text-right text-sm text-muted-foreground hidden sm:table-cell">
                            {entry.sessionsAttended} / {entry.sessionsTotal}
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

// ─── Mentor View ───

function MentorView() {
  const { activeCohortId } = useUserContext();
  const [students, setStudents] = useState<MentorStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [atRiskOnly, setAtRiskOnly] = useState(false);
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null);

  const fetchStudents = useCallback(async () => {
    if (!activeCohortId) return;
    setLoading(true);
    try {
      const res = await fetch('/api/analytics?view=mentor');
      if (res.ok) {
        const data = await res.json();
        setStudents(data.students || []);
      }
    } catch (error) {
      console.error('Failed to fetch students:', error);
    } finally {
      setLoading(false);
    }
  }, [activeCohortId]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  const filteredStudents = atRiskOnly
    ? students.filter((s) => s.avgPercentage < 50)
    : students;

  const teamAvg =
    students.length > 0
      ? Math.round(
          (students.reduce((sum, s) => sum + s.avgPercentage, 0) / students.length) * 100
        ) / 100
      : 0;

  const atRiskCount = students.filter((s) => s.avgPercentage < 50).length;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-16 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Skeleton className="h-[300px] w-full" />
      </div>
    );
  }

  if (students.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <Users className="w-16 h-16 mx-auto mb-4 opacity-50" />
        <p className="text-xl font-medium">No students assigned to your team yet</p>
        <p className="text-sm mt-1">Students will appear here once assigned to your subgroup</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <Card aria-label={`Team average: ${teamAvg}%`}>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Team Avg</p>
                  <p className="text-2xl font-bold">
                    <AnimatedNumber value={teamAvg} suffix="%" />
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Card aria-label={`Students at risk: ${atRiskCount}`}>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-red-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">At Risk (&lt;50%)</p>
                  <p className="text-2xl font-bold">{atRiskCount}</p>
                  <p className="text-xs text-muted-foreground">{atRiskCount > 0 ? 'need attention' : 'none'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card aria-label={`Team size: ${students.length} students`}>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center">
                  <Users className="w-6 h-6 text-purple-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Team Size</p>
                  <p className="text-2xl font-bold">{students.length}</p>
                  <p className="text-xs text-muted-foreground">students</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Student table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Team Attendance</CardTitle>
              <CardDescription>{filteredStudents.length} students</CardDescription>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">At risk only</span>
              <Switch checked={atRiskOnly} onCheckedChange={setAtRiskOnly} aria-label="Show only at-risk students" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Overall</TableHead>
                <TableHead>Sessions</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStudents.map((student) => {
                const isExpanded = expandedStudent === student.userId;
                return (
                  <React.Fragment key={student.userId}>
                    <TableRow
                      className={`cursor-pointer transition-colors hover:bg-muted/50 ${
                        student.avgPercentage < 50 ? 'bg-red-500/5' : ''
                      }`}
                      onClick={() =>
                        setExpandedStudent(isExpanded ? null : student.userId)
                      }
                      aria-expanded={isExpanded}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="w-8 h-8">
                            <AvatarImage src={student.avatarUrl || ''} alt={student.name} />
                            <AvatarFallback className="text-xs">
                              {student.name.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-sm">{student.name}</p>
                            <p className="text-xs text-muted-foreground">{student.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{getAttendanceBadge(student.avgPercentage)}</TableCell>
                      <TableCell className="text-sm">
                        {student.sessionsAttended} / {student.sessionsTotal}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <ChevronDown
                            className={`w-4 h-4 transition-transform ${
                              isExpanded ? 'rotate-180' : ''
                            }`}
                          />
                        </Button>
                      </TableCell>
                    </TableRow>
                    {isExpanded && (
                      <tr>
                        <td colSpan={4} className="p-0">
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="px-4 pb-4 pt-2"
                          >
                            <div className="space-y-2 max-w-2xl">
                              {student.sessions.map((session) => (
                                <SessionCard key={session.sessionId} session={session} />
                              ))}
                            </div>
                          </motion.div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Main Page ───

export default function AnalyticsPage() {
  const { activeRole, loading: userLoading } = useUserContext();
  const isMentor = activeRole === 'mentor';

  if (userLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          {isMentor ? 'Team Analytics' : 'Your Attendance'}
        </h1>
        <p className="text-muted-foreground mt-1">
          {isMentor
            ? 'Monitor your team\'s attendance and engagement'
            : 'Track your session attendance and participation'}
        </p>
      </div>

      {isMentor ? <MentorView /> : <StudentView />}
    </div>
  );
}
