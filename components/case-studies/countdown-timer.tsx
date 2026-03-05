'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Clock, AlertTriangle } from 'lucide-react';
import { formatTimeRemaining, getDeadlineUrgency } from '@/lib/services/case-study-deadline';

interface CountdownTimerProps {
  deadline: string | null;
  graceMinutes: number;
  deadlineOverride?: string | null;
  className?: string;
}

export function CountdownTimer({ deadline, graceMinutes, deadlineOverride, className }: CountdownTimerProps) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000 * 30); // update every 30s
    return () => clearInterval(interval);
  }, []);

  if (!deadline && !deadlineOverride) {
    return (
      <span className={cn('text-sm text-muted-foreground', className)}>
        No deadline
      </span>
    );
  }

  const effectiveDeadline = deadlineOverride ? new Date(deadlineOverride) : new Date(deadline!);
  const graceDeadline = new Date(effectiveDeadline.getTime() + graceMinutes * 60 * 1000);
  const urgency = getDeadlineUrgency(effectiveDeadline, now);
  const isInGrace = now > effectiveDeadline && now <= graceDeadline;
  const isPastGrace = now > graceDeadline;

  if (isPastGrace) {
    return (
      <span className={cn('text-sm text-destructive font-medium flex items-center gap-1.5', className)}>
        <Clock className="w-3.5 h-3.5" />
        Deadline passed
      </span>
    );
  }

  if (isInGrace) {
    const graceRemaining = formatTimeRemaining(graceDeadline, now);
    return (
      <span className={cn('text-sm text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1.5', className)}>
        <AlertTriangle className="w-3.5 h-3.5" />
        Late submission ({graceRemaining})
      </span>
    );
  }

  const timeStr = formatTimeRemaining(effectiveDeadline, now);

  return (
    <span className={cn(
      'text-sm font-medium flex items-center gap-1.5',
      urgency === 'critical' && 'text-destructive',
      urgency === 'warning' && 'text-amber-600 dark:text-amber-400',
      urgency === 'normal' && 'text-muted-foreground',
      className,
    )}>
      <Clock className="w-3.5 h-3.5" />
      {timeStr}
    </span>
  );
}
