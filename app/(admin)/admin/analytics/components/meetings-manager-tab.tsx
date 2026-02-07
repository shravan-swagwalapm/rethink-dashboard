'use client';

import { useState, useCallback } from 'react';
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
import { RefreshCw, Calculator, CheckCircle2, Clock, Minus, Video, Loader2, Plus } from 'lucide-react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { toast } from 'sonner';

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
  participantCount: number;
  linkedSessionId: string | null;
  linkedSessionTitle: string | null;
  cohortId: string | null;
  countsForStudents: boolean;
  actualDurationMinutes: number;
  hasAttendance: boolean;
  isProperSession: boolean;
}

interface MeetingsManagerTabProps {
  cohorts: Cohort[];
}

function getStatusBadge(meeting: ZoomMeeting) {
  if (meeting.hasAttendance && meeting.isProperSession) {
    return (
      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-200">
        <CheckCircle2 className="w-3 h-3 mr-1" />
        Complete
      </Badge>
    );
  }
  if (meeting.hasAttendance && !meeting.isProperSession) {
    return (
      <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-200">
        <Clock className="w-3 h-3 mr-1" />
        Needs Session
      </Badge>
    );
  }
  if (meeting.linkedSessionId && !meeting.hasAttendance) {
    return (
      <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-200">
        <Clock className="w-3 h-3 mr-1" />
        Pending
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="bg-gray-500/10 text-gray-500 border-gray-200">
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

      // Update meeting status
      setMeetings((prev) =>
        prev.map((m) =>
          m.zoomId === meeting.zoomId ? { ...m, hasAttendance: true } : m
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
                      <TableHead>Duration</TableHead>
                      <TableHead>Participants</TableHead>
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
                            {meeting.actualDurationMinutes} min
                          </TableCell>
                          <TableCell className="text-sm">
                            {meeting.participantCount}
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
    </div>
  );
}
