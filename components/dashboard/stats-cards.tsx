'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, TrendingUp, Trophy, FolderOpen } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatsCardsProps {
  stats?: {
    total_students: number;
    attendance_percentage: number;
    current_rank: number | null;
    total_resources: number;
  };
  loading?: boolean;
}

export function StatsCards({ stats, loading }: StatsCardsProps) {
  const cards = [
    {
      title: 'Cohort Members',
      value: stats?.total_students || 0,
      icon: Users,
      color: 'text-chart-1',
      bgColor: 'bg-chart-1/10',
      description: 'In your cohort',
    },
    {
      title: 'Attendance',
      value: `${stats?.attendance_percentage || 0}%`,
      icon: TrendingUp,
      color: 'text-chart-2',
      bgColor: 'bg-chart-2/10',
      description: 'Session attendance rate',
      trend: stats?.attendance_percentage && stats.attendance_percentage >= 75 ? 'up' : 'down',
    },
    {
      title: 'Current Rank',
      value: stats?.current_rank || '—',
      icon: Trophy,
      color: 'text-chart-4',
      bgColor: 'bg-chart-4/10',
      description: 'In leaderboard',
    },
    {
      title: 'Total Resources',
      value: stats?.total_resources || 0,
      icon: FolderOpen,
      color: 'text-chart-3',
      bgColor: 'bg-chart-3/10',
      description: 'In your cohort',
    },
  ];

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="hover-lift">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <Skeleton className="w-12 h-12 rounded-xl" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-7 w-16" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, index) => (
        <Card
          key={card.title}
          className={cn(
            'hover-lift shine cursor-default group',
            'animate-in-up opacity-0',
            `stagger-${index + 1}`
          )}
          style={{ animationFillMode: 'forwards' }}
        >
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div
                className={cn(
                  'w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110',
                  card.bgColor
                )}
              >
                <card.icon className={cn('w-6 h-6', card.color)} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{card.title}</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-2xl font-bold">{card.value}</p>
                  {card.trend && (
                    <span
                      className={cn(
                        'text-xs font-medium',
                        card.trend === 'up' ? 'text-green-500' : 'text-amber-500'
                      )}
                    >
                      {card.trend === 'up' ? '↑ Good' : '↓ Improve'}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {card.description}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
