'use client';

import { useUser } from '@/hooks/use-user';
import { Card } from '@/components/ui/card';
import { Sparkles } from 'lucide-react';
import { format } from 'date-fns';

interface WelcomeBannerProps {
  cohortStartDate?: Date | null;
  cohortName?: string;
}

export function WelcomeBanner({ cohortStartDate, cohortName }: WelcomeBannerProps) {
  const { profile } = useUser();

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const firstName = profile?.full_name?.split(' ')[0] || 'there';

  return (
    <Card className="relative overflow-hidden border-0">
      {/* Gradient background */}
      <div className="absolute inset-0 gradient-bg opacity-90" />

      {/* Pattern overlay */}
      <div className="absolute inset-0 opacity-10">
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="dots" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1" fill="white" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#dots)" />
        </svg>
      </div>

      {/* Decorative shapes */}
      <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/10 blur-2xl" />
      <div className="absolute -bottom-10 -left-10 w-32 h-32 rounded-full bg-white/10 blur-2xl" />

      <div className="relative p-6 md:p-8">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-white/80" />
              <span className="text-white/80 text-sm font-medium">
                {cohortName || 'Welcome back'}
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-white">
              {getGreeting()}, {firstName}!
            </h1>
            {cohortStartDate && (
              <p className="text-white/80">
                Your cohort starts{' '}
                <span className="font-medium text-white">
                  {format(cohortStartDate, 'MMMM d, yyyy')}
                </span>
              </p>
            )}
            {!cohortStartDate && (
              <p className="text-white/80">
                Ready to continue your learning journey?
              </p>
            )}
          </div>

          {/* Right side decoration */}
          <div className="hidden md:block">
            <div className="w-24 h-24 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center">
              <Sparkles className="w-10 h-10 text-white" />
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
