'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, TrendingUp, BarChart3, AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { format } from 'date-fns';

interface Cohort {
  id: string;
  name: string;
}

interface StatsData {
  activeStudents: number;
  avgAttendance: number;
  sessionsCompleted: number;
  unmatchedCount: number;
  trendData: { sessionId: string; title: string; date: string; avgPercentage: number }[];
}

interface OverviewTabProps {
  cohorts: Cohort[];
}

function AnimatedNumber({ value, suffix = '' }: { value: number; suffix?: string }) {
  const [displayed, setDisplayed] = useState(0);

  useEffect(() => {
    const duration = 600;
    const steps = 30;
    const increment = value / steps;
    let current = 0;
    let step = 0;

    const timer = setInterval(() => {
      step++;
      current = Math.min(value, increment * step);
      setDisplayed(Math.round(current * 100) / 100);
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

function StatCard({
  icon: Icon,
  iconColor,
  iconBg,
  label,
  value,
  suffix,
  subtitle,
  ariaLabel,
}: {
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  label: string;
  value: number;
  suffix?: string;
  subtitle: string;
  ariaLabel: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card aria-label={ariaLabel}>
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl ${iconBg} flex items-center justify-center`}>
              <Icon className={`w-6 h-6 ${iconColor}`} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="text-2xl font-bold">
                <AnimatedNumber value={value} suffix={suffix} />
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => (
        <Card key={i}>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <Skeleton className="w-12 h-12 rounded-xl" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-7 w-16" />
                <Skeleton className="h-3 w-28" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function OverviewTab({ cohorts }: OverviewTabProps) {
  const [selectedCohort, setSelectedCohort] = useState<string>('all');
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      setLoading(true);
      try {
        const params = selectedCohort !== 'all' ? `?cohort_id=${selectedCohort}` : '';
        const res = await fetch(`/api/admin/analytics/stats${params}`);
        if (res.ok) {
          setStats(await res.json());
        }
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, [selectedCohort]);

  const chartData = stats?.trendData.map((d) => ({
    name: format(new Date(d.date), 'MMM d'),
    fullTitle: d.title,
    date: format(new Date(d.date), 'MMM d, yyyy'),
    attendance: d.avgPercentage,
  })) || [];

  return (
    <div className="space-y-6">
      {/* Cohort filter */}
      <div className="flex items-center gap-3">
        <Select value={selectedCohort} onValueChange={setSelectedCohort}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All Cohorts" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Cohorts</SelectItem>
            {cohorts.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Stats cards */}
      {loading ? (
        <StatsSkeleton />
      ) : stats ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={Users}
            iconColor="text-primary"
            iconBg="bg-primary/10"
            label="Active Students"
            value={stats.activeStudents}
            subtitle={`enrolled${selectedCohort !== 'all' ? ' in cohort' : ''}`}
            ariaLabel={`Active students: ${stats.activeStudents} enrolled`}
          />
          <StatCard
            icon={TrendingUp}
            iconColor="text-green-500"
            iconBg="bg-green-500/10"
            label="Avg Attendance"
            value={stats.avgAttendance}
            suffix="%"
            subtitle={`across ${stats.sessionsCompleted} sessions`}
            ariaLabel={`Average attendance: ${stats.avgAttendance}% across ${stats.sessionsCompleted} sessions`}
          />
          <StatCard
            icon={BarChart3}
            iconColor="text-purple-500"
            iconBg="bg-purple-500/10"
            label="Sessions Completed"
            value={stats.sessionsCompleted}
            subtitle="with attendance tracked"
            ariaLabel={`Sessions completed: ${stats.sessionsCompleted} with attendance tracked`}
          />
          <StatCard
            icon={AlertTriangle}
            iconColor="text-amber-500"
            iconBg="bg-amber-500/10"
            label="Unmatched"
            value={stats.unmatchedCount}
            subtitle="participants need linking"
            ariaLabel={`Unmatched participants: ${stats.unmatchedCount} need linking`}
          />
        </div>
      ) : null}

      {/* Trend chart */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Attendance Trend
            </CardTitle>
            <CardDescription>Average attendance percentage per session over time</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[300px] w-full rounded-lg" />
            ) : chartData.length > 0 ? (
              <div role="img" aria-label={`Attendance trend chart showing ${chartData.length} sessions`}>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="attendanceGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis
                      dataKey="name"
                      className="text-xs"
                      tick={{ fill: 'var(--muted-foreground)' }}
                    />
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
                      fill="url(#attendanceGradient)"
                      isAnimationActive={true}
                      animationDuration={1000}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <TrendingUp className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">No attendance data yet</p>
                <p className="text-sm">Sync your Zoom meetings to get started</p>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
