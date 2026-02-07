'use client';

import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Search, Users, UserCheck, UserX } from 'lucide-react';

interface MatchedParticipant {
  name: string;
  email: string;
  avatarUrl: string | null;
  percentage: number;
  durationMinutes: number;
  joinTime: string | null;
  leaveTime: string | null;
}

interface UnmatchedParticipant {
  zoomEmail: string;
  percentage: number;
  durationMinutes: number;
  joinTime: string | null;
  leaveTime: string | null;
}

interface Summary {
  total: number;
  matched: number;
  unmatched: number;
  avgPercentage: number;
}

interface AttendancePreviewDialogProps {
  sessionId: string | null;
  meetingTopic: string;
  onClose: () => void;
}

function getAttendanceBadge(percentage: number) {
  if (percentage >= 75) {
    return <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-200">{percentage}%</Badge>;
  }
  if (percentage >= 50) {
    return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-200">{percentage}%</Badge>;
  }
  return <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-200">{percentage}%</Badge>;
}

export function AttendancePreviewDialog({ sessionId, meetingTopic, onClose }: AttendancePreviewDialogProps) {
  const [loading, setLoading] = useState(false);
  const [matched, setMatched] = useState<MatchedParticipant[]>([]);
  const [unmatched, setUnmatched] = useState<UnmatchedParticipant[]>([]);
  const [summary, setSummary] = useState<Summary>({ total: 0, matched: 0, unmatched: 0, avgPercentage: 0 });
  const [activeTab, setActiveTab] = useState<'matched' | 'unmatched'>('matched');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!sessionId) return;

    setLoading(true);
    setSearch('');
    setActiveTab('matched');

    fetch(`/api/admin/analytics/attendance-preview?sessionId=${sessionId}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch');
        return res.json();
      })
      .then((data) => {
        setMatched(data.matched || []);
        setUnmatched(data.unmatched || []);
        setSummary(data.summary || { total: 0, matched: 0, unmatched: 0, avgPercentage: 0 });
      })
      .catch(() => {
        setMatched([]);
        setUnmatched([]);
        setSummary({ total: 0, matched: 0, unmatched: 0, avgPercentage: 0 });
      })
      .finally(() => setLoading(false));
  }, [sessionId]);

  const searchLower = search.toLowerCase();

  const filteredMatched = useMemo(
    () =>
      matched.filter(
        (p) =>
          p.name.toLowerCase().includes(searchLower) ||
          p.email.toLowerCase().includes(searchLower)
      ),
    [matched, searchLower]
  );

  const filteredUnmatched = useMemo(
    () =>
      unmatched.filter((p) =>
        p.zoomEmail.toLowerCase().includes(searchLower)
      ),
    [unmatched, searchLower]
  );

  return (
    <Dialog open={!!sessionId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[700px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-lg">Attendance: {meetingTopic}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-3 gap-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-lg" />
              ))}
            </div>
            <Skeleton className="h-8 w-full" />
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-4 min-h-0">
            {/* Summary stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border p-3 text-center">
                <div className="flex items-center justify-center gap-1.5 text-muted-foreground text-xs mb-1">
                  <Users className="w-3.5 h-3.5" />
                  Total
                </div>
                <div className="text-2xl font-bold">{summary.total}</div>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <div className="flex items-center justify-center gap-1.5 text-muted-foreground text-xs mb-1">
                  <UserCheck className="w-3.5 h-3.5" />
                  Matched
                </div>
                <div className="text-2xl font-bold">{summary.matched}</div>
                <div className="text-xs text-muted-foreground">Avg: {summary.avgPercentage}%</div>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <div className="flex items-center justify-center gap-1.5 text-muted-foreground text-xs mb-1">
                  <UserX className="w-3.5 h-3.5" />
                  Unmatched
                </div>
                <div className="text-2xl font-bold">{summary.unmatched}</div>
              </div>
            </div>

            {/* Tabs + search */}
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant={activeTab === 'matched' ? 'default' : 'outline'}
                onClick={() => setActiveTab('matched')}
                className="h-8 text-xs gap-1.5"
              >
                Matched ({summary.matched})
              </Button>
              <Button
                size="sm"
                variant={activeTab === 'unmatched' ? 'default' : 'outline'}
                onClick={() => setActiveTab('unmatched')}
                className="h-8 text-xs gap-1.5"
              >
                Unmatched ({summary.unmatched})
              </Button>
              <div className="relative ml-auto">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-8 w-[180px] pl-8 text-xs"
                />
              </div>
            </div>

            {/* Table */}
            <div className="overflow-auto max-h-[400px] rounded-md border">
              {activeTab === 'matched' ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky top-0 bg-background z-10">Name</TableHead>
                      <TableHead className="sticky top-0 bg-background z-10">Email</TableHead>
                      <TableHead className="sticky top-0 bg-background z-10 text-right">Attendance</TableHead>
                      <TableHead className="sticky top-0 bg-background z-10 text-right">Duration</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMatched.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                          {search ? 'No matching participants found' : 'No matched participants'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredMatched.map((p, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium text-sm">{p.name}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{p.email}</TableCell>
                          <TableCell className="text-right">{getAttendanceBadge(p.percentage)}</TableCell>
                          <TableCell className="text-right text-sm text-muted-foreground">{p.durationMinutes}m</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky top-0 bg-background z-10">Zoom Email</TableHead>
                      <TableHead className="sticky top-0 bg-background z-10 text-right">Attendance</TableHead>
                      <TableHead className="sticky top-0 bg-background z-10 text-right">Duration</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUnmatched.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                          {search ? 'No matching participants found' : 'No unmatched participants'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredUnmatched.map((p, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium text-sm">{p.zoomEmail}</TableCell>
                          <TableCell className="text-right">{getAttendanceBadge(p.percentage)}</TableCell>
                          <TableCell className="text-right text-sm text-muted-foreground">{p.durationMinutes}m</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end pt-2">
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
