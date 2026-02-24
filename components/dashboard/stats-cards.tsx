'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, TrendingUp, Trophy, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SpotlightCard } from '@/components/ui/spotlight-card';
import { MotionContainer, MotionItem } from '@/components/ui/motion';
import { useAnimatedCounter } from '@/hooks/use-animated-counter';

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

interface StatCardProps {
  card: {
    title: string;
    value: number;
    icon: React.ComponentType<{ className?: string }>;
    description: string;
    trend?: 'up' | 'down';
  };
  index: number;
  stats?: StatsCardsProps['stats'];
}

// Stats card component with animation
function StatCard({ card, index, stats }: StatCardProps) {
  const isAttendance = card.title === 'Attendance';
  const isRank = card.title === 'Current Rank';
  const isProgress = card.title === 'Progress';

  const numericValue = isRank
    ? (stats?.current_rank || 0)
    : (typeof card.value === 'number' ? card.value : parseInt(String(card.value)) || 0);

  const animatedValue = useAnimatedCounter({ target: numericValue, duration: 1500 });

  const completedResources = stats?.completed_resources || 0;
  const totalResources = stats?.total_resources || 0;
  const progressPercent = totalResources > 0 ? Math.round((completedResources / totalResources) * 100) : 0;

  const displayValue = isProgress
    ? `${animatedValue} / ${totalResources}`
    : isRank && !stats?.current_rank
    ? '—'
    : isAttendance
    ? `${animatedValue}%`
    : animatedValue;

  const attendancePercentage = stats?.attendance_percentage || 0;
  const circumference = 2 * Math.PI * 16; // radius 16
  const strokeDashoffset = circumference - (attendancePercentage / 100) * circumference;

  return (
    <SpotlightCard className="rounded-xl">
    <Card
      className={cn(
        'relative overflow-hidden group cursor-default',
        'border border-border/50 bg-card/80 backdrop-blur-sm lit-surface card-inner-glow',
        'hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300',
        'active:scale-[0.98] active:transition-transform',
        'hover:border-teal-500/40 hover:dark:border-teal-500/30'
      )}
    >

      <CardContent className="p-6 relative">
        <div className="flex items-center gap-4">
          <div className="relative">
            {/* Icon container with gradient background */}
            <div
              className={cn(
                'w-14 h-14 rounded-xl flex items-center justify-center',
                'transition-all duration-500 group-hover:scale-110 group-hover:rotate-3',
                'bg-gradient-to-br shadow-lg',
                card.title === 'Cohort Members' && 'from-teal-500 to-teal-600 dark:from-teal-600 dark:to-teal-700 shadow-accent/30',
                card.title === 'Attendance' && 'from-green-500 to-emerald-600 dark:from-green-600 dark:to-emerald-700 shadow-emerald-500/30',
                card.title === 'Current Rank' && 'from-amber-500 to-orange-600 dark:from-amber-600 dark:to-orange-700 shadow-amber-500/30',
                card.title === 'Progress' && 'from-violet-500 to-purple-600 dark:from-violet-600 dark:to-purple-700 shadow-violet-500/30'
              )}
            >
              <card.icon className="w-7 h-7 text-white drop-shadow-lg" />
            </div>

            {/* Circular progress indicator for attendance */}
            {isAttendance && (
              <svg className="absolute -inset-1 w-16 h-16 -rotate-90">
                {/* Background circle */}
                <circle
                  cx="32"
                  cy="32"
                  r="16"
                  stroke="currentColor"
                  strokeWidth="2"
                  fill="none"
                  className="text-gray-200 dark:text-gray-700"
                />
                {/* Progress circle */}
                <circle
                  cx="32"
                  cy="32"
                  r="16"
                  stroke="currentColor"
                  strokeWidth="2"
                  fill="none"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  className={cn(
                    'transition-all duration-1000',
                    attendancePercentage >= 75 ? 'text-green-500' : 'text-amber-500'
                  )}
                  strokeLinecap="round"
                />
              </svg>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-muted-foreground dark:text-gray-400 uppercase tracking-wider mb-1">
              {card.title}
            </p>
            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-bold tabular-nums bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 dark:from-white dark:via-gray-100 dark:to-white bg-clip-text text-transparent">
                {displayValue}
              </p>
              {card.trend && (
                <span
                  className={cn(
                    'text-xs font-semibold px-2 py-0.5 rounded-full',
                    card.trend === 'up'
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                  )}
                >
                  {card.trend === 'up' ? '↑ Good' : '↓ Improve'}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground dark:text-gray-500 mt-1">
              {card.description}
            </p>
            {/* Mini progress bar for Progress card */}
            {isProgress && (
              <div className="mt-2 h-1.5 w-full rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-violet-500 to-purple-600 transition-all duration-1000"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Bottom accent bar */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-current to-transparent opacity-0 group-hover:opacity-50 transition-opacity duration-500"
          style={{
            color: card.title === 'Cohort Members' ? '#14b8a6' :
                   card.title === 'Attendance' ? '#10b981' :
                   card.title === 'Current Rank' ? '#f59e0b' : '#8b5cf6'
          }}
        />
      </CardContent>
    </Card>
    </SpotlightCard>
  );
}

export function StatsCards({ stats, loading }: StatsCardsProps) {
  const cards = [
    {
      title: 'Cohort Members',
      value: stats?.total_students || 0,
      icon: Users,
      description: 'Active in your cohort',
    },
    {
      title: 'Attendance',
      value: stats?.attendance_percentage || 0,
      icon: TrendingUp,
      description: stats?.cohort_avg != null
        ? `Cohort avg: ${Math.round(stats.cohort_avg)}%`
        : 'Session attendance rate',
      trend: (stats?.attendance_percentage && stats.attendance_percentage >= 75 ? 'up' : 'down') as 'up' | 'down',
    },
    {
      title: 'Current Rank',
      value: stats?.current_rank || 0,
      icon: Trophy,
      description: 'Position in leaderboard',
    },
    {
      title: 'Progress',
      value: stats?.completed_resources || 0,
      icon: CheckCircle2,
      description: `${stats?.completed_resources || 0} of ${stats?.total_resources || 0} completed`,
    },
  ];

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="border-2 dark:bg-[hsl(228,22%,10%)] dark:border-white/10">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <Skeleton className="w-14 h-14 rounded-xl" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-8 w-16" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <MotionContainer className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {cards.map((card, index) => (
        <MotionItem key={card.title}>
          <StatCard card={card} index={index} stats={stats} />
        </MotionItem>
      ))}
    </MotionContainer>
  );
}
