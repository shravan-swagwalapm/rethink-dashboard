'use client';

import { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, TrendingUp, TrendingDown, Users, LogIn, BarChart3, BookOpen } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import type { UsagePeriod, UsageOverviewStats } from '@/types';

interface OverviewTabProps {
  period: UsagePeriod;
}

export function OverviewTab({ period }: OverviewTabProps) {
  const [stats, setStats] = useState<UsageOverviewStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/usage/overview?period=${period}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setStats(data);
    } catch (error) {
      console.error('Failed to fetch overview stats:', error);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const loginChange = stats.previous_period_logins > 0
    ? Math.round(((stats.total_logins - stats.previous_period_logins) / stats.previous_period_logins) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Logins</CardTitle>
            <LogIn className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_logins}</div>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
              {loginChange >= 0 ? (
                <TrendingUp className="w-3 h-3 text-green-500" />
              ) : (
                <TrendingDown className="w-3 h-3 text-red-500" />
              )}
              {loginChange >= 0 ? '+' : ''}{loginChange}% from last period
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Students</CardTitle>
            <Users className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.active_students}/{stats.total_students}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.total_students > 0 ? Math.round((stats.active_students / stats.total_students) * 100) : 0}% active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Logins/Student</CardTitle>
            <BarChart3 className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.avg_logins_per_student}</div>
            <p className="text-xs text-muted-foreground mt-1">per student this period</p>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cohort Leaderboard */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cohort Leaderboard</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {stats.cohort_rankings.map((cohort, i) => (
              <div key={cohort.cohort_id} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-muted-foreground w-6">{i + 1}.</span>
                  <span className="text-sm font-medium">{cohort.cohort_name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">{cohort.active_count}/{cohort.total_count}</span>
                  <div className="w-20">
                    <Progress value={cohort.engagement_percent} className="h-1.5" />
                  </div>
                  <span className="text-sm font-semibold w-10 text-right">{cohort.engagement_percent}%</span>
                </div>
              </div>
            ))}
            {stats.cohort_rankings.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No active cohorts</p>
            )}
          </CardContent>
        </Card>

        {/* Login Activity Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Login Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.daily_login_trend.length > 0 ? (
              <div className="flex items-end gap-1 h-32">
                {stats.daily_login_trend.map((day) => {
                  const maxCount = Math.max(...stats.daily_login_trend.map(d => d.count));
                  const height = maxCount > 0 ? (day.count / maxCount) * 100 : 0;
                  return (
                    <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-[10px] text-muted-foreground">{day.count}</span>
                      <div
                        className="w-full bg-primary/80 rounded-t-sm min-h-[2px]"
                        style={{ height: `${Math.max(height, 2)}%` }}
                      />
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(day.date).toLocaleDateString('en', { weekday: 'short' })}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">No login data for this period</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Asset Engagement Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Asset Engagement</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.entries(stats.asset_summary).map(([type, data]) => {
              const label = type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
              const percent = data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0;
              return (
                <div key={type} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{label}</span>
                    <span className="text-muted-foreground">{data.completed}/{data.total}</span>
                  </div>
                  <Progress value={percent} className="h-1.5" />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
