'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Loader2, Trophy, Medal } from 'lucide-react';
import { toast } from 'sonner';

interface LeaderboardEntry {
  rank: number;
  subgroup_id: string;
  subgroup_name: string;
  score: number | null;
  is_late: boolean;
}

interface LeaderboardProps {
  open: boolean;
  onClose: () => void;
  caseStudyId: string;
  caseStudyTitle: string;
  mySubgroupId?: string;
}

export function Leaderboard({
  open,
  onClose,
  caseStudyId,
  caseStudyTitle,
  mySubgroupId,
}: LeaderboardProps) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [maxScore, setMaxScore] = useState(100);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch(`/api/case-studies/${caseStudyId}/leaderboard`)
      .then(res => res.json())
      .then(data => {
        if (data.error) throw new Error(data.error);
        setEntries(data.leaderboard || []);
        setMaxScore(data.max_score || 100);
      })
      .catch(() => toast.error('Failed to load leaderboard'))
      .finally(() => setLoading(false));
  }, [open, caseStudyId]);

  const getRankStyle = (rank: number) => {
    if (rank === 1) return 'text-amber-500';
    if (rank === 2) return 'text-gray-400 dark:text-gray-300';
    if (rank === 3) return 'text-amber-700';
    return 'text-muted-foreground';
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500" />
            Leaderboard — {caseStudyTitle}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : entries.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No rankings available yet.
          </p>
        ) : (
          <div className="space-y-2">
            {entries.map(entry => {
              const isMe = entry.subgroup_id === mySubgroupId;
              return (
                <div
                  key={entry.subgroup_id}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                    isMe ? 'bg-primary/5 border-primary/20' : 'bg-card'
                  }`}
                >
                  <div className={`w-8 text-center font-bold text-lg ${getRankStyle(entry.rank)}`}>
                    {entry.rank <= 3 ? (
                      <Medal className={`w-5 h-5 mx-auto ${getRankStyle(entry.rank)}`} />
                    ) : (
                      entry.rank
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-medium truncate ${isMe ? 'text-primary' : ''}`}>
                        {entry.subgroup_name}
                      </span>
                      {isMe && (
                        <Badge variant="secondary" className="text-xs">You</Badge>
                      )}
                      {entry.is_late && (
                        <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">Late</Badge>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    {entry.score !== null ? (
                      <span className="font-bold text-sm">
                        {entry.score}<span className="text-muted-foreground font-normal">/{maxScore}</span>
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">N/A</span>
                    )}
                  </div>
                </div>
              );
            })}
            {mySubgroupId && !entries.some(e => e.subgroup_id === mySubgroupId) && (
              <div className="flex items-center gap-3 p-3 rounded-lg border border-dashed border-muted-foreground/30 bg-muted/20">
                <div className="w-8 text-center text-muted-foreground text-sm">—</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-muted-foreground">Your group</span>
                    <Badge variant="outline" className="text-xs">Unranked</Badge>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-xs text-muted-foreground">N/A</span>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
