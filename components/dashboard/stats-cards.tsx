'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, TrendingUp, Trophy, FolderOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';

interface StatsCardsProps {
  stats?: {
    total_students: number;
    attendance_percentage: number;
    current_rank: number | null;
    total_resources: number;
  };
  loading?: boolean;
}

// Animated counter hook
function useAnimatedCounter(target: number, duration: number = 1000) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTime: number;
    let animationFrame: number;

    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease out cubic
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(easedProgress * target));

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [target, duration]);

  return count;
}

// Stats card component with animation
function StatCard({ card, index, stats }: any) {
  const isAttendance = card.title === 'Attendance';
  const isRank = card.title === 'Current Rank';

  const numericValue = isRank
    ? (stats?.current_rank || 0)
    : (typeof card.value === 'number' ? card.value : parseInt(card.value) || 0);

  const animatedValue = useAnimatedCounter(numericValue, 1500);

  const displayValue = isRank && !stats?.current_rank
    ? '—'
    : isAttendance
    ? `${animatedValue}%`
    : animatedValue;

  const attendancePercentage = stats?.attendance_percentage || 0;
  const circumference = 2 * Math.PI * 16; // radius 16
  const strokeDashoffset = circumference - (attendancePercentage / 100) * circumference;

  return (
    <Card
      className={cn(
        'relative overflow-hidden group cursor-default',
        'border-2 transition-all duration-500',
        'hover:shadow-2xl hover:shadow-blue-500/20 hover:-translate-y-1',
        'animate-in-up opacity-0',
        `stagger-${index + 1}`,
        'dark:bg-gray-900/50 dark:border-gray-700',
        'before:absolute before:inset-0 before:rounded-lg before:p-[2px]',
        'before:bg-gradient-to-br before:from-blue-500 before:via-purple-500 before:to-pink-500',
        'before:opacity-0 hover:before:opacity-100 before:transition-opacity before:duration-500',
        'before:-z-10'
      )}
      style={{ animationFillMode: 'forwards' }}
    >
      {/* Gradient glow on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/0 via-purple-500/0 to-pink-500/0 group-hover:from-blue-500/5 group-hover:via-purple-500/5 group-hover:to-pink-500/5 transition-all duration-500 rounded-lg" />

      {/* Shimmer effect */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
        <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </div>

      <CardContent className="p-6 relative">
        <div className="flex items-center gap-4">
          <div className="relative">
            {/* Icon container with gradient background */}
            <div
              className={cn(
                'w-14 h-14 rounded-xl flex items-center justify-center',
                'transition-all duration-500 group-hover:scale-110 group-hover:rotate-3',
                'bg-gradient-to-br shadow-lg',
                card.title === 'Cohort Members' && 'from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700',
                card.title === 'Attendance' && 'from-green-500 to-emerald-600 dark:from-green-600 dark:to-emerald-700',
                card.title === 'Current Rank' && 'from-amber-500 to-orange-600 dark:from-amber-600 dark:to-orange-700',
                card.title === 'Total Resources' && 'from-purple-500 to-pink-600 dark:from-purple-600 dark:to-pink-700'
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
              <p className="text-3xl font-bold bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 dark:from-white dark:via-gray-100 dark:to-white bg-clip-text text-transparent">
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
          </div>
        </div>

        {/* Bottom accent bar */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-current to-transparent opacity-0 group-hover:opacity-20 transition-opacity duration-500"
          style={{
            color: card.title === 'Cohort Members' ? '#3b82f6' :
                   card.title === 'Attendance' ? '#10b981' :
                   card.title === 'Current Rank' ? '#f59e0b' : '#a855f7'
          }}
        />
      </CardContent>
    </Card>
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
      description: 'Session attendance rate',
      trend: stats?.attendance_percentage && stats.attendance_percentage >= 75 ? 'up' : 'down',
    },
    {
      title: 'Current Rank',
      value: stats?.current_rank || 0,
      icon: Trophy,
      description: 'Position in leaderboard',
    },
    {
      title: 'Total Resources',
      value: stats?.total_resources || 0,
      icon: FolderOpen,
      description: 'Available resources',
    },
  ];

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="border-2 dark:bg-gray-900/50 dark:border-gray-700">
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
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {cards.map((card, index) => (
        <StatCard key={card.title} card={card} index={index} stats={stats} />
      ))}
    </div>
  );
}
