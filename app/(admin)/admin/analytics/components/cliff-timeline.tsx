'use client';

import { useMemo } from 'react';

interface HistogramBucket {
  minute: number;
  departures: number;
  isCliff: boolean;
}

interface CliffTimelineProps {
  histogram: HistogramBucket[];
  effectiveEndMinutes?: number;
  totalMeetingMinutes: number;
}

export function CliffTimeline({ histogram, effectiveEndMinutes, totalMeetingMinutes }: CliffTimelineProps) {
  const chartData = useMemo(() => {
    if (histogram.length === 0) return null;

    const totalParticipants = histogram.reduce((sum, b) => sum + b.departures, 0);

    // Show last ~50 minutes of the meeting
    const cropMin = Math.max(0, Math.floor(totalMeetingMinutes - 50));
    const visible = histogram.filter(b => b.minute >= cropMin);
    if (visible.length === 0) return null;

    // Calculate "remaining" at the start of our visible window
    const departuresBefore = histogram
      .filter(b => b.minute < cropMin)
      .reduce((sum, b) => sum + b.departures, 0);
    let remaining = totalParticipants - departuresBefore;

    // Build display buckets with running remaining count
    const buckets = visible.map(b => {
      const startRemaining = remaining;
      remaining -= b.departures;
      return {
        minute: b.minute,
        departures: b.departures,
        isCliff: b.isCliff,
        remainingAfter: remaining,
        startRemaining,
      };
    });

    const maxDepartures = Math.max(...buckets.map(b => b.departures), 1);

    return { buckets, maxDepartures, startRemaining: totalParticipants - departuresBefore };
  }, [histogram, totalMeetingMinutes]);

  if (!chartData) {
    return <p className="text-sm text-muted-foreground">No departure data available</p>;
  }

  const { buckets, maxDepartures, startRemaining } = chartData;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Who left when
        </p>
        <p className="text-xs text-muted-foreground">
          Starting: <span className="text-foreground font-medium">{startRemaining}</span> students
        </p>
      </div>

      {/* Bar chart with remaining count */}
      <div className="space-y-0">
        {buckets.filter(b => b.departures > 0 || b.isCliff).map((bucket, i) => {
          const barWidth = Math.max((bucket.departures / maxDepartures) * 100, bucket.departures > 0 ? 4 : 0);

          return (
            <div key={i} className="flex items-center gap-2 py-[3px]">
              {/* Time label */}
              <span className="text-[10px] text-muted-foreground w-12 text-right shrink-0 tabular-nums">
                {bucket.minute}m
              </span>

              {/* Bar */}
              <div className="flex-1 h-5 relative">
                {bucket.departures > 0 && (
                  <div
                    className={`h-full rounded-sm ${bucket.isCliff ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                    style={{ width: `${barWidth}%` }}
                  />
                )}
              </div>

              {/* Departure count */}
              <span className={`text-xs w-8 text-right shrink-0 tabular-nums ${
                bucket.isCliff ? 'text-primary font-semibold' : 'text-muted-foreground'
              }`}>
                {bucket.departures > 0 ? `-${bucket.departures}` : ''}
              </span>

              {/* Remaining count */}
              <span className="text-[10px] text-muted-foreground w-10 text-right shrink-0 tabular-nums">
                {bucket.remainingAfter} left
              </span>
            </div>
          );
        })}
      </div>

      {/* Formal end marker */}
      {effectiveEndMinutes && (
        <div className="flex items-center gap-2 pt-1 border-t border-dashed border-primary/30">
          <span className="text-[10px] text-primary font-medium">
            Session likely ended at {effectiveEndMinutes}m
          </span>
          <span className="text-[10px] text-muted-foreground">
            &mdash; everything after is QnA
          </span>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="inline-block w-2.5 h-2.5 rounded-sm bg-primary" /> Mass departure
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-2.5 h-2.5 rounded-sm bg-muted-foreground/30" /> Normal
        </span>
      </div>
    </div>
  );
}
