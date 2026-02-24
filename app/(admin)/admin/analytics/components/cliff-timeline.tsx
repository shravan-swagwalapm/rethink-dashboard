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
  const { maxDepartures, buckets } = useMemo(() => {
    const max = Math.max(...histogram.map(b => b.departures), 1);
    return { maxDepartures: max, buckets: histogram };
  }, [histogram]);

  if (buckets.length === 0) {
    return <p className="text-sm text-muted-foreground">No departure data available</p>;
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Departure Timeline</p>

      {/* Bar chart */}
      <div className="flex items-end gap-px h-32 px-1">
        {buckets.map((bucket, i) => {
          const heightPct = (bucket.departures / maxDepartures) * 100;
          const isEffectiveEnd = effectiveEndMinutes !== undefined &&
            bucket.minute <= effectiveEndMinutes &&
            bucket.minute + 5 > effectiveEndMinutes;

          return (
            <div
              key={i}
              className="flex-1 flex flex-col items-center justify-end group relative"
            >
              {/* Tooltip on hover */}
              {bucket.departures > 0 && (
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-popover text-popover-foreground text-xs px-2 py-1 rounded shadow-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none">
                  {bucket.minute}m: {bucket.departures} left
                </div>
              )}

              {/* Bar */}
              <div
                className={`w-full min-w-[4px] rounded-t transition-colors ${
                  bucket.isCliff
                    ? 'bg-primary'
                    : bucket.departures > 0
                    ? 'bg-muted-foreground/30'
                    : 'bg-muted/20'
                } ${isEffectiveEnd ? 'ring-2 ring-primary ring-offset-1 ring-offset-background' : ''}`}
                style={{ height: `${Math.max(heightPct, bucket.departures > 0 ? 4 : 1)}%` }}
              />
            </div>
          );
        })}
      </div>

      {/* X-axis labels */}
      <div className="flex justify-between text-[10px] text-muted-foreground px-1">
        <span>0 min</span>
        {effectiveEndMinutes && (
          <span className="text-primary font-medium">
            &uarr; Formal End ({effectiveEndMinutes}m)
          </span>
        )}
        <span>{totalMeetingMinutes} min</span>
      </div>
    </div>
  );
}
