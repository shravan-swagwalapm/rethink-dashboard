'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, CheckCircle2, AlertTriangle, XCircle, Minus } from 'lucide-react';

interface BulkResult {
  sessionId: string;
  title: string;
  status: 'detected' | 'no_cliff' | 'skipped' | 'error';
  confidence?: string;
  effectiveEndMinutes?: number;
  studentsImpacted?: number;
  error?: string;
}

interface BulkSummary {
  total: number;
  detected: number;
  highConfidence: number;
  mediumConfidence: number;
  lowConfidence: number;
  noCliff: number;
  skipped: number;
  errors: number;
  totalStudentsImpacted: number;
}

interface BulkCliffDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  results: { summary: BulkSummary; results: BulkResult[] } | null;
  onApplyAllHigh: () => Promise<void>;
}

export function BulkCliffDialog({ open, onOpenChange, results, onApplyAllHigh }: BulkCliffDialogProps) {
  const [applying, setApplying] = useState(false);

  if (!results) return null;

  const { summary, results: items } = results;

  const handleApplyAll = async () => {
    setApplying(true);
    try {
      await onApplyAllHigh();
    } finally {
      setApplying(false);
    }
  };

  const getStatusIcon = (item: BulkResult) => {
    if (item.status === 'detected') {
      if (item.confidence === 'high') return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      if (item.confidence === 'medium') return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      return <AlertTriangle className="w-4 h-4 text-orange-500" />;
    }
    if (item.status === 'no_cliff') return <Minus className="w-4 h-4 text-muted-foreground" />;
    if (item.status === 'error') return <XCircle className="w-4 h-4 text-destructive" />;
    return <Minus className="w-4 h-4 text-muted-foreground" />;
  };

  const getConfidenceBadge = (confidence?: string) => {
    if (!confidence) return null;
    const colors = {
      high: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
      medium: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
      low: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
    };
    return (
      <Badge variant="outline" className={colors[confidence as keyof typeof colors] || ''}>
        {confidence}
      </Badge>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Formal End Detection — Bulk Results</DialogTitle>
          <DialogDescription>
            Scanned {summary.total} sessions for mass-departure patterns
          </DialogDescription>
        </DialogHeader>

        {/* Summary stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-lg border p-3 text-center">
            <p className="text-2xl font-bold">{summary.detected}</p>
            <p className="text-xs text-muted-foreground">Cliffs Found</p>
          </div>
          <div className="rounded-lg border p-3 text-center">
            <p className="text-2xl font-bold text-emerald-500">{summary.highConfidence}</p>
            <p className="text-xs text-muted-foreground">High Confidence</p>
          </div>
          <div className="rounded-lg border p-3 text-center">
            <p className="text-2xl font-bold text-amber-500">{summary.mediumConfidence + summary.lowConfidence}</p>
            <p className="text-xs text-muted-foreground">Needs Review</p>
          </div>
          <div className="rounded-lg border p-3 text-center">
            <p className="text-2xl font-bold">{summary.totalStudentsImpacted}</p>
            <p className="text-xs text-muted-foreground">Students Impacted</p>
          </div>
        </div>

        {/* Results list */}
        <ScrollArea className="max-h-[300px] -mx-2 px-2">
          <div className="space-y-1">
            {items
              .filter(item => item.status === 'detected')
              .sort((a, b) => {
                const order = { high: 0, medium: 1, low: 2 };
                return (order[a.confidence as keyof typeof order] ?? 3) - (order[b.confidence as keyof typeof order] ?? 3);
              })
              .map((item) => (
                <div
                  key={item.sessionId}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  {getStatusIcon(item)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.effectiveEndMinutes}m effective · {item.studentsImpacted} students
                    </p>
                  </div>
                  {getConfidenceBadge(item.confidence)}
                </div>
              ))}

            {/* Show non-detected items in collapsed section */}
            {items.filter(item => item.status !== 'detected').length > 0 && (
              <div className="pt-2 mt-2 border-t">
                <p className="text-xs text-muted-foreground mb-1 px-2">
                  {summary.noCliff} no cliff · {summary.skipped} skipped · {summary.errors} errors
                </p>
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            onClick={handleApplyAll}
            disabled={applying || summary.highConfidence === 0}
            className="gap-2"
          >
            {applying && <Loader2 className="w-4 h-4 animate-spin" />}
            Apply All High-Confidence ({summary.highConfidence})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
