'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Download,
  Search,
  Video,
  Calendar,
  Users,
  Loader2,
  CheckCircle,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { format, subDays, parseISO } from 'date-fns';
import type { Session, Cohort } from '@/types';

interface ZoomMeeting {
  id: number;
  uuid: string;
  topic: string;
  start_time: string;
  duration: number;
  total_minutes?: number;
  participants_count?: number;
}

interface ImportStatus {
  meetingId: string;
  status: 'pending' | 'importing' | 'success' | 'error';
  message?: string;
}

export default function ImportPage() {
  const [loading, setLoading] = useState(true);
  const [zoomConfigured, setZoomConfigured] = useState(false);
  const [meetings, setMeetings] = useState<ZoomMeeting[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [fetchingMeetings, setFetchingMeetings] = useState(false);

  // Date range for fetching meetings
  const [fromDate, setFromDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [toDate, setToDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  // Session mapping
  const [sessionMap, setSessionMap] = useState<Record<string, string>>({});
  const [importStatus, setImportStatus] = useState<Record<string, ImportStatus>>({});

  const checkZoomStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/zoom');
      if (response.ok) {
        const data = await response.json();
        setZoomConfigured(data.configured && data.status === 'connected');
      }
    } catch (error) {
      console.error('Error checking Zoom status:', error);
    }
  }, []);

  const fetchSessions = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/sessions');
      if (response.ok) {
        const data = await response.json();
        setSessions(data.sessions || []);
      }
    } catch (error) {
      console.error('Error fetching sessions:', error);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      await Promise.all([checkZoomStatus(), fetchSessions()]);
      setLoading(false);
    };
    init();
  }, [checkZoomStatus, fetchSessions]);

  const fetchMeetings = async () => {
    if (!zoomConfigured) {
      toast.error('Zoom is not configured');
      return;
    }

    setFetchingMeetings(true);
    try {
      const response = await fetch(
        `/api/admin/zoom?action=list-meetings&from=${fromDate}&to=${toDate}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch meetings');
      }

      const data = await response.json();
      setMeetings(data.meetings || []);

      if (data.meetings?.length === 0) {
        toast.info('No meetings found in the selected date range');
      } else {
        toast.success(`Found ${data.meetings.length} meetings`);
      }
    } catch (error) {
      console.error('Error fetching meetings:', error);
      toast.error('Failed to fetch meetings from Zoom');
    } finally {
      setFetchingMeetings(false);
    }
  };

  const handleImport = async (meeting: ZoomMeeting) => {
    const sessionId = sessionMap[meeting.uuid];
    if (!sessionId) {
      toast.error('Please select a session to import to');
      return;
    }

    setImportStatus(prev => ({
      ...prev,
      [meeting.uuid]: { meetingId: meeting.uuid, status: 'importing' },
    }));

    try {
      const response = await fetch('/api/admin/zoom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'import-attendance',
          zoomMeetingUuid: meeting.uuid,
          sessionId,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Import failed');
      }

      setImportStatus(prev => ({
        ...prev,
        [meeting.uuid]: {
          meetingId: meeting.uuid,
          status: 'success',
          message: `Imported ${data.participantsImported} participants`,
        },
      }));

      toast.success(`Imported ${data.participantsImported} attendance records`);
    } catch (error) {
      console.error('Error importing attendance:', error);
      setImportStatus(prev => ({
        ...prev,
        [meeting.uuid]: {
          meetingId: meeting.uuid,
          status: 'error',
          message: error instanceof Error ? error.message : 'Import failed',
        },
      }));
      toast.error('Failed to import attendance');
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!zoomConfigured) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Import Attendance from Zoom</h1>
          <p className="text-muted-foreground">
            Import historical attendance data from past Zoom meetings
          </p>
        </div>

        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <AlertCircle className="w-12 h-12 mx-auto mb-4 text-amber-500" />
              <h3 className="text-lg font-semibold mb-2">Zoom Not Configured</h3>
              <p className="text-muted-foreground mb-4">
                Please configure Zoom credentials to import attendance data.
              </p>
              <p className="text-sm text-muted-foreground">
                Add the following to your .env.local:
              </p>
              <pre className="mt-2 p-4 bg-muted rounded-lg text-left text-sm inline-block">
                ZOOM_ACCOUNT_ID=your_account_id{'\n'}
                ZOOM_CLIENT_ID=your_client_id{'\n'}
                ZOOM_CLIENT_SECRET=your_client_secret
              </pre>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Import Attendance from Zoom</h1>
        <p className="text-muted-foreground">
          Import historical attendance data from past Zoom meetings
        </p>
      </div>

      {/* Date Range Selector */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Select Date Range</CardTitle>
          <CardDescription>
            Choose the date range to fetch past Zoom meetings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-2">
              <Label>From</Label>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>To</Label>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>
            <Button onClick={fetchMeetings} disabled={fetchingMeetings}>
              {fetchingMeetings ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Fetching...
                </>
              ) : (
                <>
                  <Search className="w-4 h-4 mr-2" />
                  Fetch Meetings
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Meetings List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Video className="w-5 h-5" />
            Past Meetings
          </CardTitle>
          <CardDescription>
            {meetings.length} meeting{meetings.length !== 1 ? 's' : ''} found. Map each meeting to a session and import attendance.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {meetings.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No meetings loaded</p>
              <p className="text-sm">Select a date range and click &quot;Fetch Meetings&quot;</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Meeting</TableHead>
                    <TableHead>Date & Time</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Map to Session</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {meetings.map((meeting) => {
                    const status = importStatus[meeting.uuid];
                    return (
                      <TableRow key={meeting.uuid}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                              <Video className="w-5 h-5 text-blue-500" />
                            </div>
                            <div>
                              <p className="font-medium">{meeting.topic}</p>
                              <p className="text-xs text-muted-foreground">
                                ID: {meeting.id}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">
                              {format(parseISO(meeting.start_time), 'MMM d, yyyy')}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {format(parseISO(meeting.start_time), 'h:mm a')}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>{meeting.duration} min</TableCell>
                        <TableCell>
                          <Select
                            value={sessionMap[meeting.uuid] || ''}
                            onValueChange={(value) =>
                              setSessionMap({ ...sessionMap, [meeting.uuid]: value })
                            }
                            disabled={status?.status === 'success'}
                          >
                            <SelectTrigger className="w-[200px]">
                              <SelectValue placeholder="Select session" />
                            </SelectTrigger>
                            <SelectContent>
                              {sessions.map((session) => (
                                <SelectItem key={session.id} value={session.id}>
                                  {session.title}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          {status?.status === 'success' ? (
                            <Badge className="bg-green-500/10 text-green-600">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              {status.message}
                            </Badge>
                          ) : status?.status === 'error' ? (
                            <div className="flex items-center gap-2">
                              <Badge variant="destructive">
                                <AlertCircle className="w-3 h-3 mr-1" />
                                Failed
                              </Badge>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleImport(meeting)}
                              >
                                <RefreshCw className="w-3 h-3 mr-1" />
                                Retry
                              </Button>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              onClick={() => handleImport(meeting)}
                              disabled={
                                !sessionMap[meeting.uuid] ||
                                status?.status === 'importing'
                              }
                            >
                              {status?.status === 'importing' ? (
                                <>
                                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                  Importing...
                                </>
                              ) : (
                                <>
                                  <Download className="w-3 h-3 mr-1" />
                                  Import
                                </>
                              )}
                            </Button>
                          )}
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
    </div>
  );
}
