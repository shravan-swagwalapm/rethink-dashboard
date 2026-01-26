'use client';

import { useUser } from '@/hooks/use-user';
import { Card } from '@/components/ui/card';
import { Sparkles, Zap, TrendingUp, Target } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { useEffect, useState } from 'react';

interface WelcomeBannerProps {
  cohortStartDate?: Date | null;
  cohortName?: string;
}

export function WelcomeBanner({ cohortStartDate, cohortName }: WelcomeBannerProps) {
  const { profile } = useUser();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const firstName = profile?.full_name?.split(' ')[0] || 'there';
  const daysUntilStart = cohortStartDate ? differenceInDays(cohortStartDate, new Date()) : null;
  const hasStarted = daysUntilStart !== null && daysUntilStart <= 0;

  return (
    <Card className="relative overflow-hidden border-0 shadow-2xl">
      {/* Animated gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 opacity-90">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iZ3JpZCIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj48cGF0aCBkPSJNIDQwIDAgTCAwIDAgMCA0MCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLXdpZHRoPSIwLjUiIG9wYWNpdHk9IjAuMSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNncmlkKSIvPjwvc3ZnPg==')] opacity-20" />
      </div>

      {/* Floating orbs animation */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden">
        <div className="absolute top-10 left-10 w-32 h-32 bg-white/10 rounded-full blur-3xl animate-float" />
        <div className="absolute top-20 right-20 w-40 h-40 bg-blue-300/20 rounded-full blur-3xl animate-float-delayed" />
        <div className="absolute bottom-10 left-1/3 w-36 h-36 bg-purple-300/20 rounded-full blur-3xl animate-float-slow" />
      </div>

      {/* Grid pattern overlay */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{
          backgroundImage: `linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)`,
          backgroundSize: '50px 50px'
        }} />
      </div>

      <div className="relative p-6 md:p-10">
        <div className="flex flex-col md:flex-row items-start justify-between gap-6">
          {/* Left content */}
          <div className="space-y-4 flex-1">
            <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left duration-500">
              <div className="w-8 h-8 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white animate-pulse" />
              </div>
              <span className="text-white/90 text-sm font-semibold tracking-wide uppercase">
                Welcome back
              </span>
            </div>

            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white animate-in fade-in slide-in-from-left duration-700 leading-tight">
              {getGreeting()}, {firstName}!
            </h1>

            {cohortName && (
              <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left duration-900">
                <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/15 backdrop-blur-sm border border-white/20">
                  <Target className="w-4 h-4 text-white" />
                  <span className="text-white/95 font-medium text-sm md:text-base">
                    {cohortName}
                  </span>
                </div>
              </div>
            )}

            {cohortStartDate && (
              <div className="flex items-start gap-3 animate-in fade-in slide-in-from-left duration-1000">
                <div className="flex-1 p-4 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20">
                  {hasStarted ? (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4 text-yellow-300" />
                        <span className="text-white/90 text-sm font-medium">Cohort in Progress</span>
                      </div>
                      <p className="text-white/80 text-sm">
                        Started {format(cohortStartDate, 'MMM d, yyyy')}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-green-300" />
                        <span className="text-white/90 text-sm font-medium">Starting Soon</span>
                      </div>
                      <p className="text-white/80 text-sm">
                        {daysUntilStart} {daysUntilStart === 1 ? 'day' : 'days'} until {format(cohortStartDate, 'MMM d')}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {!cohortStartDate && (
              <p className="text-white/80 text-base md:text-lg animate-in fade-in slide-in-from-left duration-1000">
                Ready to continue your learning journey?
              </p>
            )}
          </div>

          {/* Right side - Animated stats visualization */}
          <div className="hidden lg:flex flex-col gap-3 animate-in fade-in slide-in-from-right duration-700">
            {/* Floating stat cards */}
            <div className="flex gap-3">
              <div className="w-24 h-24 rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 p-3 flex flex-col items-center justify-center animate-float">
                <div className="text-2xl font-bold text-white">{mounted ? new Date().getDate() : '--'}</div>
                <div className="text-xs text-white/70 uppercase tracking-wide">{mounted ? format(new Date(), 'MMM') : '---'}</div>
              </div>
              <div className="w-24 h-24 rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 p-3 flex flex-col items-center justify-center animate-float-delayed">
                <div className="text-2xl font-bold text-white">{mounted ? format(new Date(), 'HH:mm') : '--:--'}</div>
                <div className="text-xs text-white/70 uppercase tracking-wide">Local</div>
              </div>
            </div>

            {/* Decorative glow element */}
            <div className="relative w-52 h-20 rounded-2xl bg-gradient-to-r from-white/20 to-white/10 backdrop-blur-md border border-white/20 p-4 flex items-center justify-center overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" />
              <div className="relative flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-white animate-pulse" />
                <span className="text-white font-semibold">Keep Learning!</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom glow effect */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent" />
    </Card>
  );
}
