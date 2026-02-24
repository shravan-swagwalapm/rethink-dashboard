'use client';

import { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { RefreshCw, Calculator, CheckCircle2, Clock, Minus, Video, Loader2, Plus, Eye, Info, Pencil, Check, X, Zap } from 'lucide-react';
import { AttendancePreviewDialog } from './attendance-preview-dialog';
import { CliffDetailPanel } from './cliff-detail-panel';
import { BulkCliffDialog } from './bulk-cliff-dialog';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { toast } from 'sonner';
import type { CliffDetectionResult } from '@/lib/services/cliff-detector';

interface Cohort {
  id: string;
  name: string;
}

interface ZoomMeeting {
  zoomId: string;
  uuid: string;
  topic: string;
  date: string;
  duration: number;
  scheduledDuration?: number;
  participantCount: number;
  linkedSessionId: string | null;
  linkedSessionTitle: string | null;
  cohortId: string | null;
  countsForStudents: boolean;
  actualDurationMinutes: number;
  hasAttendance: boolean;
  uniqueParticipantCount: number | null;
  isProperSession: boolean;
  cliffDetection: CliffDetectionResult | null;
  formalEndMinutes: number | null;
}

interface MeetingsManagerTabProps {
  cohorts: Cohort[];
}

function getStatusBadge(meeting: ZoomMeeting) {
  if (meeting.hasAttendance && meeting.isProperSession) {
    return (
      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800">
        <CheckCircle2 className="w-3 h-3 mr-1" />
        Complete
      </Badge>
    );
  }
  if (meeting.hasAttendance && !meeting.isProperSession) {
    return (
      <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800">
        <Clock className="w-3 h-3 mr-1" />
        Needs Session
      </Badge>
    );
  }
  if (meeting.linkedSessionId && !meeting.hasAttendance) {
    return (
      <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800">
        <Clock className="w-3 h-3 mr-1" />
        Pending
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="bg-gray-500/10 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700">
      <Minus className="w-3 h-3 mr-1" />
      Zoom Only
    </Badge>
  );
}

export function MeetingsManagerTab({ cohorts }: MeetingsManagerTabProps) {
  const [meetings, setMeetings] = useState<ZoomMeeting[]>([]);
  const [loading, setLoading] = useState(false);
  const [synced, setSynced] = useState(false);
  const [calculatingIds, setCalculatingIds] = useState<Set<string>>(new Set());
  const [calculatingAll, setCalculatingAll] = useState(false);
  const [createSessionMeeting, setCreateSessionMeeting] = useState<ZoomMeeting | null>(null);
  const [createSessionTitle, setCreateSessionTitle] = useState('');
  const [createSessionCohortId, setCreateSessionCohortId] = useState('');
  const [createSessionCounts, setCreateSessionCounts] = useState(true);
  const [creatingSession, setCreatingSession] = useState(false);
  const [previewSessionId, setPreviewSessionId] = useState<string | null>(null);
  const [previewTopic, setPreviewTopic] = useState('');
  const [editingDurationId, setEditingDurationId] = useState<string | null>(null);
  const [editDurationValue, setEditDurationValue] = useState('');
  const [selectedCliffMeeting, setSelectedCliffMeeting] = useState<ZoomMeeting | null>(null);
  const [cliffDetailOpen, setCliffDetailOpen] = useState(false);
  const [bulkDetecting, setBulkDetecting] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [bulkResults, setBulkResults] = useState<any>(null);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);

  const syncFromZoom = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/analytics/sync-zoom');
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to sync');
      }
      const data = await res.json();
      setMeetings(data.meetings || []);
      setSynced(true);
      toast.success(`Synced ${data.meetings?.length || 0} meetings from Zoom`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to sync Zoom meetings. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-fetch meetings on mount so data persists across tab switches and refreshes
  useEffect(() => {
    syncFromZoom();
  }, [syncFromZoom]);

  const toggleCountsForStudents = useCallback(async (meeting: ZoomMeeting, value: boolean) => {
    try {
      const res = await fetch('/api/admin/analytics/sync-zoom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          zoomMeetingId: meeting.zoomId,
          sessionId: meeting.linkedSessionId,
          countsForStudents: value,
        }),
      });

      if (!res.ok) throw new Error('Failed to update');

      setMeetings((prev) =>
        prev.map((m) =>
          m.zoomId === meeting.zoomId ? { ...m, countsForStudents: value } : m
        )
      );
    } catch {
      toast.error('Failed to update meeting setting');
    }
  }, []);

  const updateCohort = useCallback(async (meeting: ZoomMeeting, cohortId: string) => {
    try {
      const res = await fetch('/api/admin/analytics/sync-zoom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          zoomMeetingId: meeting.zoomId,
          sessionId: meeting.linkedSessionId,
          cohortId: cohortId === 'none' ? null : cohortId,
          topic: meeting.topic,
          countsForStudents: meeting.countsForStudents,
          actualDurationMinutes: meeting.actualDurationMinutes,
        }),
      });

      if (!res.ok) throw new Error('Failed to update');

      // Re-sync to get updated session IDs
      await syncFromZoom();
      toast.success('Cohort updated');
    } catch {
      toast.error('Failed to assign cohort');
    }
  }, [syncFromZoom]);

  const calculateAttendance = useCallback(async (meeting: ZoomMeeting, silent = false): Promise<boolean> => {
    setCalculatingIds((prev) => new Set(prev).add(meeting.zoomId));
    try {
      // Auto-create a session if one doesn't exist yet
      let sessionId = meeting.linkedSessionId;
      if (!sessionId) {
        const linkRes = await fetch('/api/admin/analytics/sync-zoom', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            zoomMeetingId: meeting.zoomId,
            topic: meeting.topic,
            countsForStudents: true,
            actualDurationMinutes: meeting.actualDurationMinutes || meeting.duration,
            scheduledAt: meeting.date,
          }),
        });
        if (!linkRes.ok) {
          if (!silent) toast.error('Failed to create session for this meeting');
          return false;
        }
        // Re-sync to get the new session ID
        const syncRes = await fetch('/api/admin/analytics/sync-zoom');
        if (syncRes.ok) {
          const syncData = await syncRes.json();
          const updated = (syncData.meetings || []).find((m: ZoomMeeting) => m.zoomId === meeting.zoomId);
          if (updated?.linkedSessionId) {
            sessionId = updated.linkedSessionId;
            setMeetings(syncData.meetings);
          }
        }
        if (!sessionId) {
          if (!silent) toast.error('Failed to link meeting to a session');
          return false;
        }
      }

      const res = await fetch('/api/admin/analytics/calculate-attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          zoomMeetingUuid: meeting.uuid,
          actualDurationMinutes: meeting.actualDurationMinutes,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Failed to calculate' }));
        if (!silent) toast.error(data.error || 'Failed to calculate attendance');
        return false;
      }

      const result = await res.json();
      if (!silent) {
        toast.success(
          `Attendance calculated for ${result.imported + result.unmatched} participants (${result.unmatched} unmatched)`
        );
      }

      // Update meeting status + unique count
      setMeetings((prev) =>
        prev.map((m) =>
          m.zoomId === meeting.zoomId
            ? { ...m, hasAttendance: true, uniqueParticipantCount: result.imported + result.unmatched }
            : m
        )
      );
      return true;
    } catch (error) {
      if (!silent) toast.error(error instanceof Error ? error.message : 'Failed to calculate attendance');
      return false;
    } finally {
      setCalculatingIds((prev) => {
        const next = new Set(prev);
        next.delete(meeting.zoomId);
        return next;
      });
    }
  }, []);

  const calculateAllPending = useCallback(async () => {
    const pending = meetings.filter(
      (m) => m.countsForStudents && !m.hasAttendance
    );
    if (pending.length === 0) {
      toast.info('No pending meetings to calculate');
      return;
    }

    setCalculatingAll(true);
    let success = 0;
    let failed = 0;

    for (const meeting of pending) {
      const ok = await calculateAttendance(meeting, true);
      if (ok) success++;
      else failed++;
    }

    setCalculatingAll(false);
    if (failed > 0) {
      toast.error(`Calculated ${success} meetings, ${failed} failed`);
    } else {
      toast.success(`Calculated ${success} meetings successfully`);
    }
  }, [meetings, calculateAttendance]);

  const saveDuration = useCallback(async (meeting: ZoomMeeting) => {
    const newDuration = parseInt(editDurationValue, 10);
    if (isNaN(newDuration) || newDuration <= 0) {
      setEditingDurationId(null);
      return;
    }

    try {
      const res = await fetch('/api/admin/analytics/sync-zoom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          zoomMeetingId: meeting.zoomId,
          sessionId: meeting.linkedSessionId,
          actualDurationMinutes: newDuration,
          topic: meeting.topic,
          countsForStudents: meeting.countsForStudents,
          scheduledAt: meeting.date,
        }),
      });

      if (!res.ok) throw new Error('Failed to update duration');

      setMeetings((prev) =>
        prev.map((m) =>
          m.zoomId === meeting.zoomId ? { ...m, actualDurationMinutes: newDuration } : m
        )
      );
      toast.success(`Duration updated to ${newDuration} min`);
    } catch {
      toast.error('Failed to update duration');
    } finally {
      setEditingDurationId(null);
    }
  }, [editDurationValue]);

  const openCreateSessionDialog = useCallback((meeting: ZoomMeeting) => {
    setCreateSessionMeeting(meeting);
    setCreateSessionTitle(meeting.topic);
    setCreateSessionCohortId('');
    setCreateSessionCounts(true);
  }, []);

  const handleCreateSession = useCallback(async () => {
    if (!createSessionMeeting || !createSessionCohortId) return;

    setCreatingSession(true);
    try {
      const res = await fetch('/api/admin/analytics/sync-zoom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          zoomMeetingId: createSessionMeeting.zoomId,
          sessionId: createSessionMeeting.linkedSessionId,
          cohortId: createSessionCohortId,
          title: createSessionTitle,
          countsForStudents: createSessionCounts,
        }),
      });

      if (!res.ok) throw new Error('Failed to create session');

      setCreateSessionMeeting(null);
      await syncFromZoom();
      toast.success('Session created and linked to cohort');
    } catch {
      toast.error('Failed to create session');
    } finally {
      setCreatingSession(false);
    }
  }, [createSessionMeeting, createSessionCohortId, createSessionTitle, createSessionCounts, syncFromZoom]);

  const pendingCount = meetings.filter(
    (m) => m.countsForStudents && !m.hasAttendance
  ).length;

  const handleBulkDetect = useCallback(async () => {
    setBulkDetecting(true);
    try {
      const res = await fetch('/api/admin/analytics/detect-cliffs-bulk', { method: 'POST' });
      if (!res.ok) throw new Error('Bulk detection failed');
      const data = await res.json();
      setBulkResults(data);
      setBulkDialogOpen(true);
      // Refresh meetings to show updated cliff data
      syncFromZoom();
    } catch {
      toast.error('Failed to detect formal ends');
    } finally {
      setBulkDetecting(false);
    }
  }, [syncFromZoom]);

  const handleApplyCliff = useCallback(async (sessionId: string, formalEndMinutes: number) => {
    const meeting = meetings.find((m) => m.linkedSessionId === sessionId);
    if (!meeting) return;

    // Optimistic update: close panel immediately, recalculation runs in background
    const previousState = { formalEndMinutes: meeting.formalEndMinutes, cliffDetection: meeting.cliffDetection };
    setMeetings((prev) =>
      prev.map((m) =>
        m.linkedSessionId === sessionId
          ? { ...m, formalEndMinutes, cliffDetection: { ...(m.cliffDetection || { detected: true }), appliedAt: new Date().toISOString() } as CliffDetectionResult }
          : m
      )
    );
    setCliffDetailOpen(false);

    try {
      const res = await fetch('/api/admin/analytics/apply-cliff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          formalEndMinutes,
          zoomMeetingUuid: meeting.uuid,
        }),
      });

      if (!res.ok) throw new Error('Apply failed');

      const data = await res.json();
      toast.success(`Formal end applied: ${formalEndMinutes} min. ${data.attendance?.imported || 0} students recalculated.`);
    } catch {
      // Revert optimistic update on failure
      setMeetings((prev) =>
        prev.map((m) =>
          m.linkedSessionId === sessionId
            ? { ...m, formalEndMinutes: previousState.formalEndMinutes, cliffDetection: previousState.cliffDetection }
            : m
        )
      );
      toast.error('Failed to apply formal end. Reverted.');
    }
  }, [meetings]);

  const handleDismissCliff = useCallback(async (sessionId: string) => {
    const meeting = meetings.find((m) => m.linkedSessionId === sessionId);
    if (!meeting) return;

    // Optimistic update: close panel and update UI immediately
    // The API call (which includes attendance recalculation) runs in the background
    const previousState = { formalEndMinutes: meeting.formalEndMinutes, cliffDetection: meeting.cliffDetection };
    setMeetings((prev) =>
      prev.map((m) =>
        m.linkedSessionId === sessionId
          ? { ...m, formalEndMinutes: null, cliffDetection: { ...(m.cliffDetection || { detected: false }), dismissed: true } as CliffDetectionResult }
          : m
      )
    );
    setCliffDetailOpen(false);

    try {
      const res = await fetch('/api/admin/analytics/apply-cliff', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, zoomMeetingUuid: meeting.uuid }),
      });

      if (!res.ok) throw new Error('Dismiss failed');

      toast.success('Cliff dismissed. Attendance recalculated with full duration.');
    } catch {
      // Revert optimistic update on failure
      setMeetings((prev) =>
        prev.map((m) =>
          m.linkedSessionId === sessionId
            ? { ...m, formalEndMinutes: previousState.formalEndMinutes, cliffDetection: previousState.cliffDetection }
            : m
        )
      );
      toast.error('Failed to dismiss cliff. Reverted.');
    }
  }, [meetings]);

  const handleApplyAllHighConfidence = useCallback(async () => {
    if (!bulkResults?.results) return;

    const highConfidence = bulkResults.results.filter(
      (r: { status: string; confidence?: string }) => r.status === 'detected' && r.confidence === 'high'
    );

    let applied = 0;
    let failed = 0;
    for (const result of highConfidence) {
      const meeting = meetings.find((m: ZoomMeeting) => m.linkedSessionId === result.sessionId);
      if (!meeting || !result.effectiveEndMinutes) continue;

      try {
        const res = await fetch('/api/admin/analytics/apply-cliff', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: result.sessionId,
            formalEndMinutes: result.effectiveEndMinutes,
            zoomMeetingUuid: meeting.uuid,
          }),
        });
        if (res.ok) applied++;
        else failed++;
      } catch {
        failed++;
      }
    }

    if (failed > 0) {
      toast.error(`Applied ${applied} sessions, ${failed} failed.`);
    } else {
      toast.success(`Applied formal end to ${applied} sessions.`);
    }
    setBulkDialogOpen(false);
    syncFromZoom(); // Refresh data
  }, [bulkResults, meetings, syncFromZoom]);

  const handleApplyAllDetected = useCallback(async () => {
    if (!bulkResults?.results) return;

    const detected = bulkResults.results.filter(
      (r: { status: string }) => r.status === 'detected'
    );

    let applied = 0;
    let failed = 0;
    for (const result of detected) {
      const meeting = meetings.find((m: ZoomMeeting) => m.linkedSessionId === result.sessionId);
      if (!meeting || !result.effectiveEndMinutes) continue;

      try {
        const res = await fetch('/api/admin/analytics/apply-cliff', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: result.sessionId,
            formalEndMinutes: result.effectiveEndMinutes,
            zoomMeetingUuid: meeting.uuid,
          }),
        });
        if (res.ok) applied++;
        else failed++;
      } catch {
        failed++;
      }
    }

    if (failed > 0) {
      toast.error(`Applied ${applied} sessions, ${failed} failed.`);
    } else {
      toast.success(`Applied formal end to ${applied} sessions.`);
    }
    setBulkDialogOpen(false);
    syncFromZoom(); // Refresh data
  }, [bulkResults, meetings, syncFromZoom]);

  return (
    <div className="space-y-4">
      {/* Actions bar */}
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={syncFromZoom} disabled={loading} className="gap-2">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Sync from Zoom
        </Button>
        {pendingCount > 0 && (
          <Button
            variant="outline"
            onClick={calculateAllPending}
            disabled={calculatingAll}
            className="gap-2"
          >
            {calculatingAll ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Calculator className="w-4 h-4" />
            )}
            Calculate All Pending ({pendingCount})
          </Button>
        )}
        <Button
          variant="outline"
          onClick={handleBulkDetect}
          disabled={bulkDetecting}
          className="gap-2"
        >
          {bulkDetecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
          Detect Formal Ends
        </Button>
      </div>

      {/* Meetings table */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Card aria-label="Zoom meetings management">
          <CardHeader>
            <CardTitle>Zoom Meetings</CardTitle>
            <CardDescription>
              {synced
                ? `${meetings.length} meetings from the last 30 days`
                : 'Click "Sync from Zoom" to import your past meetings'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : !synced ? (
              <div className="text-center py-12 text-muted-foreground">
                <Video className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">No Zoom meetings loaded</p>
                <p className="text-sm">Click &quot;Sync from Zoom&quot; to import your past meetings</p>
              </div>
            ) : meetings.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Video className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">No meetings found</p>
                <p className="text-sm">No Zoom meetings in the last 30 days</p>
              </div>
            ) : (
              <div className="overflow-x-auto -mx-6 px-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky left-0 bg-background z-10 min-w-[200px]">Title</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>
                        <Tooltip>
                          <TooltipTrigger className="flex items-center gap-1">
                            Duration <Info className="w-3 h-3 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent>Actual meeting runtime used as the denominator for attendance %. Click to edit.</TooltipContent>
                        </Tooltip>
                      </TableHead>
                      <TableHead>
                        <Tooltip>
                          <TooltipTrigger className="flex items-center gap-1">
                            Zoom Joins <Info className="w-3 h-3 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent>Total join events from Zoom. Includes rejoins and device switches.</TooltipContent>
                        </Tooltip>
                      </TableHead>
                      <TableHead>
                        <Tooltip>
                          <TooltipTrigger className="flex items-center gap-1">
                            Unique <Info className="w-3 h-3 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent>Deduplicated participants after attendance calculation.</TooltipContent>
                        </Tooltip>
                      </TableHead>
                      <TableHead>
                        <Tooltip>
                          <TooltipTrigger className="flex items-center gap-1">
                            Formal End <Info className="w-3 h-3 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent>Auto-detected session end (excludes QnA). Click to review.</TooltipContent>
                        </Tooltip>
                      </TableHead>
                      <TableHead>Cohort</TableHead>
                      <TableHead>Counts</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {meetings.map((meeting) => {
                      const isCalculating = calculatingIds.has(meeting.zoomId);
                      return (
                        <TableRow
                          key={meeting.zoomId}
                          className="transition-colors hover:bg-muted/50"
                        >
                          <TableCell className="sticky left-0 bg-background z-10 font-medium">
                            {meeting.topic}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                            {format(new Date(meeting.date), 'MMM d, yyyy')}
                          </TableCell>
                          <TableCell className="text-sm">
                            {editingDurationId === meeting.zoomId ? (
                              <div className="flex items-center gap-1">
                                <Input
                                  type="number"
                                  value={editDurationValue}
                                  onChange={(e) => setEditDurationValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') saveDuration(meeting);
                                    if (e.key === 'Escape') setEditingDurationId(null);
                                  }}
                                  className="w-20 h-7 text-xs"
                                  autoFocus
                                  min={1}
                                />
                                <span className="text-xs text-muted-foreground">min</span>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6"
                                  onClick={() => saveDuration(meeting)}
                                >
                                  <Check className="w-3 h-3" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6"
                                  onClick={() => setEditingDurationId(null)}
                                >
                                  <X className="w-3 h-3" />
                                </Button>
                              </div>
                            ) : (
                              <button
                                className="flex items-center gap-1 hover:text-foreground text-muted-foreground cursor-pointer group"
                                onClick={() => {
                                  setEditingDurationId(meeting.zoomId);
                                  setEditDurationValue(String(meeting.actualDurationMinutes));
                                }}
                              >
                                <span>{meeting.actualDurationMinutes} min</span>
                                {meeting.scheduledDuration && meeting.actualDurationMinutes !== meeting.scheduledDuration && (
                                  <span className="text-xs opacity-60">(sched: {meeting.scheduledDuration})</span>
                                )}
                                <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity" />
                              </button>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">
                            {meeting.participantCount}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {meeting.uniqueParticipantCount ?? '—'}
                          </TableCell>
                          <TableCell>
                            {meeting.cliffDetection?.detected ? (() => {
                              const isDismissed = meeting.cliffDetection && 'dismissed' in meeting.cliffDetection && (meeting.cliffDetection as unknown as Record<string, unknown>).dismissed === true;
                              return (
                                <button
                                  onClick={() => {
                                    setSelectedCliffMeeting(meeting);
                                    setCliffDetailOpen(true);
                                  }}
                                  className="inline-flex items-center"
                                >
                                  <Badge
                                    variant="outline"
                                    className={
                                      isDismissed
                                        ? 'bg-muted/50 text-muted-foreground border-muted-foreground/20 hover:bg-muted cursor-pointer'
                                        : meeting.cliffDetection?.confidence === 'high'
                                        ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20 cursor-pointer'
                                        : meeting.cliffDetection?.confidence === 'medium'
                                        ? 'bg-amber-500/10 text-amber-500 border-amber-500/20 hover:bg-amber-500/20 cursor-pointer'
                                        : 'bg-orange-500/10 text-orange-500 border-orange-500/20 hover:bg-orange-500/20 cursor-pointer'
                                    }
                                  >
                                    {isDismissed ? '✕' : '⚡'}{' '}
                                    {meeting.cliffDetection?.effectiveEndMinutes}m
                                  </Badge>
                                </button>
                              );
                            })() : meeting.cliffDetection && !meeting.cliffDetection?.detected ? (
                              <span className="text-xs text-muted-foreground">— none</span>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Select
                              value={meeting.cohortId || 'none'}
                              onValueChange={(value) => updateCohort(meeting, value)}
                              disabled={!meeting.isProperSession}
                            >
                              <SelectTrigger className="w-[140px] h-8 text-xs">
                                <SelectValue placeholder="Assign..." />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">No Cohort</SelectItem>
                                {cohorts.map((c) => (
                                  <SelectItem key={c.id} value={c.id}>
                                    {c.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Switch
                              checked={meeting.countsForStudents}
                              onCheckedChange={(value) =>
                                toggleCountsForStudents(meeting, value)
                              }
                              aria-label="Include meeting for student attendance"
                            />
                          </TableCell>
                          <TableCell>{getStatusBadge(meeting)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              {!meeting.hasAttendance && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => calculateAttendance(meeting)}
                                  disabled={isCalculating}
                                  className="gap-1.5 h-8 text-xs"
                                >
                                  {isCalculating ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <Calculator className="w-3 h-3" />
                                  )}
                                  Calculate
                                </Button>
                              )}
                              {meeting.hasAttendance && meeting.linkedSessionId && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setPreviewSessionId(meeting.linkedSessionId);
                                    setPreviewTopic(meeting.topic);
                                  }}
                                  className="gap-1.5 h-8 text-xs"
                                >
                                  <Eye className="w-3 h-3" />
                                  View Attendance
                                </Button>
                              )}
                              {meeting.hasAttendance && !meeting.isProperSession && (
                                <Button
                                  size="sm"
                                  variant="default"
                                  onClick={() => openCreateSessionDialog(meeting)}
                                  className="gap-1.5 h-8 text-xs"
                                >
                                  <Plus className="w-3 h-3" />
                                  Create Session
                                </Button>
                              )}
                              {meeting.hasAttendance && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => calculateAttendance(meeting)}
                                  disabled={isCalculating}
                                  className="gap-1.5 h-8 text-xs"
                                >
                                  {isCalculating ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <RefreshCw className="w-3 h-3" />
                                  )}
                                  Recalculate
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Create Session Dialog */}
      <Dialog open={!!createSessionMeeting} onOpenChange={(open) => !open && setCreateSessionMeeting(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Create Session for Cohort</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="session-title">Title</Label>
              <Input
                id="session-title"
                value={createSessionTitle}
                onChange={(e) => setCreateSessionTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Date</Label>
              <Input
                value={createSessionMeeting ? format(new Date(createSessionMeeting.date), 'MMM d, yyyy') : ''}
                disabled
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="session-cohort">Cohort</Label>
              <Select value={createSessionCohortId} onValueChange={setCreateSessionCohortId}>
                <SelectTrigger id="session-cohort">
                  <SelectValue placeholder="Select a cohort..." />
                </SelectTrigger>
                <SelectContent>
                  {cohorts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="session-counts">Counts for attendance</Label>
              <Switch
                id="session-counts"
                checked={createSessionCounts}
                onCheckedChange={setCreateSessionCounts}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateSessionMeeting(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateSession}
              disabled={!createSessionCohortId || creatingSession}
              className="gap-2"
            >
              {creatingSession && <Loader2 className="w-4 h-4 animate-spin" />}
              Create Session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Attendance Preview Dialog */}
      <AttendancePreviewDialog
        sessionId={previewSessionId}
        meetingTopic={previewTopic}
        onClose={() => setPreviewSessionId(null)}
      />

      {/* Cliff Detail Panel */}
      <CliffDetailPanel
        open={cliffDetailOpen}
        onOpenChange={setCliffDetailOpen}
        meeting={selectedCliffMeeting}
        onApply={handleApplyCliff}
        onDismiss={handleDismissCliff}
      />

      {/* Bulk Cliff Detection Dialog */}
      <BulkCliffDialog
        open={bulkDialogOpen}
        onOpenChange={setBulkDialogOpen}
        results={bulkResults}
        onApplyAllHigh={handleApplyAllHighConfidence}
        onApplyAll={handleApplyAllDetected}
      />
    </div>
  );
}
