'use client';

import { useState, useCallback } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Zap, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { CliffTimeline } from './cliff-timeline';
import type { CliffDetectionResult } from '@/lib/services/cliff-detector';

interface ZoomMeeting {
  zoomId: string;
  uuid: string;
  topic: string;
  date: string;
  duration: number;
  actualDurationMinutes: number;
  linkedSessionId: string | null;
  cliffDetection: CliffDetectionResult | null;
  formalEndMinutes: number | null;
}

interface CliffDetailPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meeting: ZoomMeeting | null;
  onApply: (sessionId: string, formalEndMinutes: number) => Promise<void>;
  onDismiss: (sessionId: string) => Promise<void>;
}

export function CliffDetailPanel({ open, onOpenChange, meeting, onApply, onDismiss }: CliffDetailPanelProps) {
  const cliff = meeting?.cliffDetection;
  const [editableDuration, setEditableDuration] = useState<string>('');
  const [applying, setApplying] = useState(false);
  const [dismissing, setDismissing] = useState(false);

  // Reset editable duration when meeting changes
  const handleOpenChange = useCallback((isOpen: boolean) => {
    if (isOpen && cliff?.effectiveEndMinutes) {
      setEditableDuration(String(cliff.effectiveEndMinutes));
    }
    onOpenChange(isOpen);
  }, [cliff, onOpenChange]);

  const handleApply = useCallback(async () => {
    if (!meeting?.linkedSessionId) return;
    const duration = parseInt(editableDuration, 10);
    if (isNaN(duration) || duration <= 0) return;

    setApplying(true);
    try {
      await onApply(meeting.linkedSessionId, duration);
    } finally {
      setApplying(false);
    }
  }, [meeting, editableDuration, onApply]);

  const handleDismiss = useCallback(async () => {
    if (!meeting?.linkedSessionId) return;
    setDismissing(true);
    try {
      await onDismiss(meeting.linkedSessionId);
    } finally {
      setDismissing(false);
    }
  }, [meeting, onDismiss]);

  if (!meeting || !cliff) return null;

  const confidenceColor = cliff.confidence === 'high'
    ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
    : cliff.confidence === 'medium'
    ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
    : 'bg-orange-500/10 text-orange-500 border-orange-500/20';

  const confidenceIcon = cliff.confidence === 'high'
    ? <CheckCircle2 className="w-3.5 h-3.5" />
    : cliff.confidence === 'medium'
    ? <AlertTriangle className="w-3.5 h-3.5" />
    : <AlertTriangle className="w-3.5 h-3.5" />;

  const isApplied = meeting.formalEndMinutes !== null;
  const isDismissed = cliff && 'dismissed' in cliff && (cliff as Record<string, unknown>).dismissed === true;

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            Formal End Detection
          </SheetTitle>
          <SheetDescription>
            {meeting.topic} &middot; {format(new Date(meeting.date), 'MMM d, yyyy')}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 mt-6 px-4">
          {/* Status banner */}
          {isApplied && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              <p className="text-sm text-emerald-600 dark:text-emerald-400">
                Applied: Using {meeting.formalEndMinutes} min as effective duration
              </p>
            </div>
          )}
          {isDismissed && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted border">
              <XCircle className="w-4 h-4 text-muted-foreground shrink-0" />
              <p className="text-sm text-muted-foreground">
                Dismissed: Using full meeting duration
              </p>
            </div>
          )}

          {/* Detection summary */}
          <Card>
            <CardContent className="pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Detection Confidence</span>
                <Badge variant="outline" className={confidenceColor}>
                  {confidenceIcon}
                  <span className="ml-1 capitalize">{cliff.confidence}</span>
                </Badge>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed">
                <span className="text-foreground font-medium">{cliff.totalParticipants} students</span> were on the call.
                {' '}At minute {Math.round(cliff.cliffWindowStartMin ?? 0)}, <span className="text-foreground font-medium">{cliff.departuresInCliff} left together</span> within 10 minutes
                {cliff.spikeRatio ? <> &mdash; <span className="text-foreground font-medium">{cliff.spikeRatio.toFixed(1)}x</span> the normal rate</> : ''}.
                {cliff.meetingEndStayers ? <> The remaining {cliff.meetingEndStayers} stayed for QnA until Zoom closed.</> : ''}
              </p>

              <div className="pt-2 border-t space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Mass departure at</span>
                  <span className="font-medium">{Math.round(cliff.cliffWindowStartMin ?? 0)}&ndash;{Math.round(cliff.cliffWindowEndMin ?? 0)} min</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Session likely ended at</span>
                  <span className="font-medium text-primary">{cliff.effectiveEndMinutes} min</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Timeline visualization */}
          {cliff.histogram && cliff.histogram.length > 0 && (
            <Card>
              <CardContent className="pt-4">
                <CliffTimeline
                  histogram={cliff.histogram}
                  effectiveEndMinutes={cliff.effectiveEndMinutes}
                  totalMeetingMinutes={meeting.actualDurationMinutes || meeting.duration}
                />
              </CardContent>
            </Card>
          )}

          {/* Impact preview */}
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm font-medium mb-2">Impact</p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Students impacted</p>
                  <p className="font-medium">{cliff.studentsImpacted ?? '\u2014'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Total participants</p>
                  <p className="font-medium">{cliff.totalParticipants ?? '\u2014'}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-muted-foreground">QnA time removed</p>
                  <p className="font-medium">
                    {cliff.effectiveEndMinutes && meeting.actualDurationMinutes
                      ? `${meeting.actualDurationMinutes - cliff.effectiveEndMinutes} min`
                      : '\u2014'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Editable duration + actions */}
          {!isDismissed && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="formal-duration">Effective Duration (minutes)</Label>
                <Input
                  id="formal-duration"
                  type="number"
                  min={1}
                  value={editableDuration}
                  onChange={(e) => setEditableDuration(e.target.value)}
                  className="w-32"
                />
                <p className="text-xs text-muted-foreground">
                  Detected: {cliff.effectiveEndMinutes} min &middot; Full meeting: {meeting.actualDurationMinutes || meeting.duration} min
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleApply}
                  disabled={applying || dismissing || !editableDuration}
                  className="gap-2"
                >
                  {applying && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isApplied ? 'Update & Recalculate' : 'Apply & Recalculate'}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleDismiss}
                  disabled={applying || dismissing}
                  className="gap-2"
                >
                  {dismissing && <Loader2 className="w-4 h-4 animate-spin" />}
                  Dismiss
                </Button>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
