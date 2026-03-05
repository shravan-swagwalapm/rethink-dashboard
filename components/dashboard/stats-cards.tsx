'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { MotionFadeIn } from '@/components/ui/motion';
import { useAnimatedCounter } from '@/hooks/use-animated-counter';
import { Users, BarChart3, Trophy, Target } from 'lucide-react';
import { useEffect, useState } from 'react';

interface StatsCardsProps {
  stats?: {
    total_students: number;
    attendance_percentage: number;
    current_rank: number | null;
    total_resources: number;
    cohort_avg?: number | null;
    completed_resources: number;
  };
  loading?: boolean;
}

function AnimatedStat({ target, suffix }: { target: number; suffix?: string }) {
  const value = useAnimatedCounter({ target, duration: 1200 });
  return <>{value}{suffix}</>;
}

function ProgressRing({ percent, color, size = 36 }: { percent: number; color: string; size?: number }) {
  const [mounted, setMounted] = useState(false);
  const strokeWidth = 3;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;

  useEffect(() => { setMounted(true); }, []);

  return (
    <svg width={size} height={size} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="hsl(220 10% 90% / 0.08)" strokeWidth={strokeWidth} />
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round"
        strokeDasharray={circumference} strokeDashoffset={mounted ? offset : circumference} className="progress-ring-circle" />
    </svg>
  );
}

export function StatsCards({ stats, loading }: StatsCardsProps) {
  if (loading) {
    return (
      <div className="rounded-xl border border-white/[0.15] bg-card p-6 card-3d-static">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-8 w-16" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const completedResources = stats?.completed_resources || 0;
  const totalResources = stats?.total_resources || 0;
  const progressPercent = totalResources > 0 ? Math.round((completedResources / totalResources) * 100) : 0;
  const attendance = stats?.attendance_percentage || 0;

  const metrics: Array<{
    label: string;
    icon: typeof Users;
    iconColor: string;
    iconBg: string;
    value: React.ReactNode;
    sub: string;
    trend?: 'up' | 'down';
    ring?: { percent: number; color: string };
    progress?: number;
  }> = [
    {
      label: 'Members',
      icon: Users,
      iconColor: 'hsl(210 70% 65%)',
      iconBg: 'hsl(210 70% 65% / 0.1)',
      value: <AnimatedStat target={stats?.total_students || 0} />,
      sub: 'in your cohort',
    },
    {
      label: 'Attendance',
      icon: BarChart3,
      iconColor: attendance >= 75 ? 'hsl(172 60% 50%)' : 'hsl(38 85% 55%)',
      iconBg: attendance >= 75 ? 'hsl(172 60% 50% / 0.1)' : 'hsl(38 85% 55% / 0.1)',
      value: <AnimatedStat target={attendance} suffix="%" />,
      sub: stats?.cohort_avg != null ? `avg ${Math.round(stats.cohort_avg)}%` : 'session rate',
      trend: attendance >= 75 ? 'up' : 'down',
      ring: { percent: attendance, color: attendance >= 75 ? 'hsl(172 60% 50%)' : 'hsl(38 85% 55%)' },
    },
    {
      label: 'Rank',
      icon: Trophy,
      iconColor: 'hsl(38 85% 55%)',
      iconBg: 'hsl(38 85% 55% / 0.1)',
      value: stats?.current_rank ? <><span className="text-muted-foreground/50 text-lg font-normal">#</span><AnimatedStat target={stats.current_rank} /></> : <span className="text-muted-foreground/40">&mdash;</span>,
      sub: stats?.current_rank ? 'leaderboard' : 'not ranked yet',
    },
    {
      label: 'Progress',
      icon: Target,
      iconColor: 'hsl(172 60% 50%)',
      iconBg: 'hsl(172 60% 50% / 0.1)',
      value: <><AnimatedStat target={completedResources} /><span className="text-muted-foreground/50 text-lg font-normal">/{totalResources}</span></>,
      sub: 'completed',
      progress: progressPercent,
    },
  ];

  return (
    <MotionFadeIn delay={0.05}>
      <div className="rounded-xl border border-white/[0.15] bg-card overflow-hidden card-3d-static">
        <div className="grid grid-cols-2 lg:grid-cols-4">
          {metrics.map((metric, i) => {
            const Icon = metric.icon;
            return (
              <div
                key={metric.label}
                className={cn(
                  'px-5 py-5 lg:px-7 lg:py-6',
                  i < metrics.length - 1 && 'lg:border-r border-white/[0.12]',
                  i < 2 && 'border-b lg:border-b-0 border-white/[0.12]',
                  i % 2 === 0 && i < 2 && 'border-r lg:border-r border-white/[0.12]',
                )}
              >
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="flex items-center justify-center w-7 h-7 rounded-md" style={{ background: metric.iconBg }}>
                    <Icon className="w-4 h-4" style={{ color: metric.iconColor }} />
                  </div>
                  <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider font-heading">
                    {metric.label}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  {metric.ring && (
                    <ProgressRing percent={metric.ring.percent} color={metric.ring.color} size={42} />
                  )}
                  <div>
                    <div className="flex items-baseline gap-2">
                      <p className="text-3xl font-bold text-white tabular-nums font-heading tracking-tight leading-none">
                        {metric.value}
                      </p>
                      {metric.trend && (
                        <span className={cn(
                          'text-xs font-semibold px-1.5 py-0.5 rounded',
                          metric.trend === 'up' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'
                        )}>
                          {metric.trend === 'up' ? 'Good' : 'Low'}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1.5">{metric.sub}</p>
                  </div>
                </div>

                {metric.progress !== undefined && (
                  <div className="mt-2.5 h-1.5 w-full rounded-full bg-white/[0.06] overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-1000 progress-shimmer"
                      style={{ width: `${metric.progress}%`, background: 'hsl(172 60% 45%)' }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </MotionFadeIn>
  );
}
