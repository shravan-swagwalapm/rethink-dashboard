'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { PageLoader } from '@/components/ui/page-loader';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import {
  Plus,
  Video,
  Calendar,
  Clock,
  Users,
  MoreVertical,
  Pencil,
  Trash2,
  Loader2,
  ExternalLink,
  Check,
  X,
  CalendarPlus,
  Link2,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { useSearchParams } from 'next/navigation';
import { format, parseISO, isPast } from 'date-fns';
import type { Session, Cohort, SessionCohort, SessionGuest, Profile } from '@/types';
import { Checkbox } from '@/components/ui/checkbox';
import { MotionContainer, MotionItem, MotionFadeIn } from '@/components/ui/motion';
import { RsvpListDialog } from './components/rsvp-list-dialog';

interface SessionWithStats extends Session {
  cohort?: Cohort;
  cohorts?: SessionCohort[];
  guests?: SessionGuest[];
  rsvp_yes_count?: number;
  rsvp_no_count?: number;
}

interface MasterUser {
  id: string;
  email: string;
  full_name: string | null;
}

export default function SessionsPage() {
  const searchParams = useSearchParams();
  const [sessions, setSessions] = useState<SessionWithStats[]>([]);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [masterUsers, setMasterUsers] = useState<MasterUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Integration status
  const [zoomConfigured, setZoomConfigured] = useState(false);
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [calendarEmail, setCalendarEmail] = useState<string | null>(null);
  const [calendarHealth, setCalendarHealth] = useState<'healthy' | 'expiring_soon' | 'expired' | 'disconnected'>('disconnected');
  const [calendarNeedsReconnect, setCalendarNeedsReconnect] = useState(false);

  const [rsvpDialogOpen, setRsvpDialogOpen] = useState(false);
  const [rsvpSessionId, setRsvpSessionId] = useState<string | null>(null);
  const [rsvpSessionTitle, setRsvpSessionTitle] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editingSession, setEditingSession] = useState<SessionWithStats | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    cohort_id: '',
    cohort_ids: [] as string[],  // Multiple cohorts
    guest_ids: [] as string[],   // Guest invites
    scheduled_at: '',
    scheduled_time: '',
    duration_minutes: 60,
    zoom_link: '',
    auto_create_zoom: false,
    send_calendar_invites: false,
  });

  const hasFetchedRef = useRef(false);

  const fetchData = useCallback(async (force = false) => {
    // Prevent re-fetching on tab switch unless forced
    if (hasFetchedRef.current && !force) return;
    hasFetchedRef.current = true;
    try {
      // Fetch sessions, zoom status, and calendar status in parallel
      const [sessionsRes, zoomRes, calendarRes] = await Promise.all([
        fetch('/api/admin/sessions'),
        fetch('/api/admin/zoom'),
        fetch('/api/admin/calendar'),
      ]);

      if (sessionsRes.ok) {
        const data = await sessionsRes.json();
        setSessions(data.sessions || []);
        setCohorts(data.cohorts || []);
        setMasterUsers(data.masterUsers || []);
      }

      if (zoomRes.ok) {
        const zoomData = await zoomRes.json();
        setZoomConfigured(zoomData.configured && zoomData.status === 'connected');
      }

      if (calendarRes.ok) {
        const calendarData = await calendarRes.json();
        setCalendarConnected(calendarData.connected);
        setCalendarEmail(calendarData.email);
        setCalendarHealth(calendarData.health || 'disconnected');
        setCalendarNeedsReconnect(calendarData.needsReconnect || false);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load sessions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle calendar connection status from URL params
  useEffect(() => {
    if (searchParams.get('calendar_connected') === 'true') {
      toast.success('Google Calendar connected successfully!');
      // Clean up URL
      window.history.replaceState({}, '', '/admin/sessions');
    }
    if (searchParams.get('calendar_error')) {
      toast.error('Failed to connect Google Calendar. Please try again.');
      window.history.replaceState({}, '', '/admin/sessions');
    }
  }, [searchParams]);

  const handleOpenForm = (session?: SessionWithStats) => {
    if (session) {
      setEditingSession(session);
      const scheduledDate = parseISO(session.scheduled_at);
      // Get cohort IDs from session_cohorts or fall back to legacy cohort_id
      const cohortIds = session.cohorts?.map(sc => sc.cohort_id) || (session.cohort_id ? [session.cohort_id] : []);
      const guestIds = session.guests?.map(sg => sg.user_id) || [];
      setFormData({
        title: session.title,
        description: session.description || '',
        cohort_id: session.cohort_id || '',
        cohort_ids: cohortIds,
        guest_ids: guestIds,
        scheduled_at: format(scheduledDate, 'yyyy-MM-dd'),
        scheduled_time: format(scheduledDate, 'HH:mm'),
        duration_minutes: session.duration_minutes,
        zoom_link: session.zoom_link || '',
        auto_create_zoom: false, // Don't auto-create for edits
        send_calendar_invites: false, // Don't re-send for edits
      });
    } else {
      setEditingSession(null);
      setFormData({
        title: '',
        description: '',
        cohort_id: '',
        cohort_ids: [],
        guest_ids: [],
        scheduled_at: '',
        scheduled_time: '',
        duration_minutes: 60,
        zoom_link: '',
        auto_create_zoom: zoomConfigured, // Default to true if Zoom is configured
        send_calendar_invites: calendarConnected, // Default to true if Calendar is connected
      });
    }
    setShowForm(true);
  };

  const handleSave = async () => {
    if (formData.cohort_ids.length === 0) {
      toast.error('Please select at least one cohort');
      return;
    }
    if (!formData.title.trim()) {
      toast.error('Title is required');
      return;
    }
    if (!formData.scheduled_at || !formData.scheduled_time) {
      toast.error('Date and time are required');
      return;
    }

    // Duration validation
    if (!formData.duration_minutes || formData.duration_minutes < 15) {
      toast.error('Duration must be at least 15 minutes');
      return;
    }
    if (formData.duration_minutes > 480) {
      toast.error('Duration cannot exceed 480 minutes (8 hours)');
      return;
    }
    if (formData.auto_create_zoom && formData.duration_minutes < 60) {
      toast.error('Zoom meetings require a minimum duration of 60 minutes');
      return;
    }

    setSaving(true);
    const scheduledAt = new Date(`${formData.scheduled_at}T${formData.scheduled_time}`);

    try {
      const method = editingSession ? 'PUT' : 'POST';
      const body = editingSession
        ? {
            id: editingSession.id,
            title: formData.title,
            description: formData.description || null,
            cohort_id: formData.cohort_ids[0] || null,  // Legacy: first cohort
            cohort_ids: formData.cohort_ids,
            guest_ids: formData.guest_ids,
            scheduled_at: scheduledAt.toISOString(),
            duration_minutes: formData.duration_minutes,
            zoom_link: formData.zoom_link || null,
          }
        : {
            title: formData.title,
            description: formData.description || null,
            cohort_ids: formData.cohort_ids,
            guest_ids: formData.guest_ids,
            scheduled_at: scheduledAt.toISOString(),
            duration_minutes: formData.duration_minutes,
            zoom_link: formData.zoom_link || null,
            auto_create_zoom: formData.auto_create_zoom,
            send_calendar_invites: formData.send_calendar_invites,
          };

      const response = await fetch('/api/admin/sessions', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error('Failed to save session');
      }

      let message = editingSession ? 'Session updated' : 'Session created';
      if (!editingSession) {
        if (formData.auto_create_zoom) message += ' with Zoom meeting';
        if (formData.send_calendar_invites) message += formData.auto_create_zoom ? ' and calendar invites sent' : ' and calendar invites sent';
      }

      toast.success(message);
      setShowForm(false);
      fetchData(true); // Force refresh after save
    } catch (error) {
      console.error('Error saving session:', error);
      toast.error('Failed to save session');
    } finally {
      setSaving(false);
    }
  };

  // Toggle cohort selection
  const toggleCohort = (cohortId: string) => {
    setFormData(prev => ({
      ...prev,
      cohort_ids: prev.cohort_ids.includes(cohortId)
        ? prev.cohort_ids.filter(id => id !== cohortId)
        : [...prev.cohort_ids, cohortId]
    }));
  };

  // Toggle guest selection
  const toggleGuest = (userId: string) => {
    setFormData(prev => ({
      ...prev,
      guest_ids: prev.guest_ids.includes(userId)
        ? prev.guest_ids.filter(id => id !== userId)
        : [...prev.guest_ids, userId]
    }));
  };

  const handleDelete = async (sessionId: string) => {
    if (!confirm('Are you sure you want to delete this session? This will also delete all RSVPs.')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/sessions?id=${sessionId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete');

      toast.success('Session deleted');
      fetchData(true); // Force refresh after delete
    } catch (error) {
      toast.error('Failed to delete session');
    }
  };

  const getSessionStatus = (session: SessionWithStats) => {
    const scheduledDate = parseISO(session.scheduled_at);
    if (isPast(scheduledDate)) {
      return <Badge variant="secondary">Completed</Badge>;
    }
    return <Badge className="bg-green-500/10 text-green-600">Upcoming</Badge>;
  };

  const upcomingCount = useMemo(
    () => sessions.filter(s => !isPast(parseISO(s.scheduled_at))).length,
    [sessions]
  );
  const avgRsvps = useMemo(
    () => sessions.length > 0 ? Math.round(sessions.reduce((acc, s) => acc + (s.rsvp_yes_count || 0), 0) / sessions.length) : 0,
    [sessions]
  );

  if (loading) {
    return <PageLoader message="Loading sessions..." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Video}
        title="Sessions"
        description="Schedule and manage live sessions"
        action={
          <Button onClick={() => handleOpenForm()} className="gradient-bg gap-2">
            <Plus className="w-4 h-4" />
            Create Session
          </Button>
        }
      />

      {/* Stats */}
      <MotionFadeIn delay={0.1}>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Video className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Sessions</p>
                <p className="text-xl font-bold">{sessions.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Upcoming</p>
                <p className="text-xl font-bold">
                  {upcomingCount}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Avg RSVPs</p>
                <p className="text-xl font-bold">
                  {avgRsvps}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      </MotionFadeIn>

      {/* Sessions Table */}
      <MotionFadeIn delay={0.2}>
      <Card>
        <CardHeader>
          <CardTitle>All Sessions</CardTitle>
          <CardDescription>
            Manage scheduled sessions and view RSVP counts
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sessions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Video className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No sessions yet</p>
              <p className="text-sm">Create your first session to get started</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Cohort</TableHead>
                    <TableHead>Date & Time</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>RSVPs</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessions.map((session) => (
                    <TableRow key={session.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg gradient-bg flex items-center justify-center text-white flex-shrink-0">
                            <Video className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="font-medium">{session.title}</p>
                            {session.zoom_link && (
                              <a
                                href={session.zoom_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-primary flex items-center gap-1 hover:underline"
                              >
                                Zoom link
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {session.cohorts && session.cohorts.length > 0 ? (
                            session.cohorts.map(sc => (
                              <Badge key={sc.id} variant="outline">
                                {sc.cohort?.name || 'Unknown'}
                              </Badge>
                            ))
                          ) : session.cohort ? (
                            <Badge variant="outline">{session.cohort.name}</Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {format(parseISO(session.scheduled_at), 'MMM d, yyyy')}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {format(parseISO(session.scheduled_at), 'h:mm a')}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4 text-muted-foreground" />
                          {session.duration_minutes} min
                        </div>
                      </TableCell>
                      <TableCell>
                        <button
                          className="flex items-center gap-2 hover:bg-muted/50 rounded-md px-2 py-1 -mx-2 -my-1 transition-colors cursor-pointer"
                          onClick={() => {
                            setRsvpSessionId(session.id);
                            setRsvpSessionTitle(session.title);
                            setRsvpDialogOpen(true);
                          }}
                          title="Click to view RSVP details"
                        >
                          <span className="flex items-center gap-1 text-green-600">
                            <Check className="w-3 h-3" />
                            {session.rsvp_yes_count}
                          </span>
                          <span className="flex items-center gap-1 text-red-500">
                            <X className="w-3 h-3" />
                            {session.rsvp_no_count}
                          </span>
                        </button>
                      </TableCell>
                      <TableCell>{getSessionStatus(session)}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleOpenForm(session)}>
                              <Pencil className="w-4 h-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDelete(session.id)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      </MotionFadeIn>

      {/* Create/Edit Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingSession ? 'Edit Session' : 'Create Session'}
            </DialogTitle>
            <DialogDescription>
              {editingSession
                ? 'Update the session details'
                : 'Fill in the details for the new session'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="PM Fundamentals - Week 1"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="What will be covered in this session..."
                rows={3}
              />
            </div>

            <div className="space-y-3">
              <Label>Cohorts * (select one or more)</Label>
              <div className="grid grid-cols-2 gap-2 p-3 border rounded-lg bg-muted/30">
                {cohorts.map((cohort) => (
                  <div key={cohort.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`cohort-${cohort.id}`}
                      checked={formData.cohort_ids.includes(cohort.id)}
                      onCheckedChange={() => toggleCohort(cohort.id)}
                    />
                    <label
                      htmlFor={`cohort-${cohort.id}`}
                      className="text-sm cursor-pointer"
                    >
                      {cohort.name}
                    </label>
                  </div>
                ))}
              </div>
              {formData.cohort_ids.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {formData.cohort_ids.length} cohort{formData.cohort_ids.length !== 1 ? 's' : ''} selected
                </p>
              )}
            </div>

            {/* Guest selection */}
            {masterUsers.length > 0 && (
              <div className="space-y-3">
                <Label>Invite Guests (optional)</Label>
                <div className="grid grid-cols-1 gap-2 p-3 border rounded-lg bg-muted/30 max-h-32 overflow-y-auto">
                  {masterUsers.map((user) => (
                    <div key={user.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`guest-${user.id}`}
                        checked={formData.guest_ids.includes(user.id)}
                        onCheckedChange={() => toggleGuest(user.id)}
                      />
                      <label
                        htmlFor={`guest-${user.id}`}
                        className="text-sm cursor-pointer"
                      >
                        {user.full_name || user.email}
                        <span className="text-xs text-muted-foreground ml-1">
                          ({user.email})
                        </span>
                      </label>
                    </div>
                  ))}
                </div>
                {formData.guest_ids.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {formData.guest_ids.length} guest{formData.guest_ids.length !== 1 ? 's' : ''} invited
                  </p>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.scheduled_at}
                  onChange={(e) => setFormData({ ...formData, scheduled_at: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="time">Time</Label>
                <Input
                  id="time"
                  type="time"
                  value={formData.scheduled_time}
                  onChange={(e) => setFormData({ ...formData, scheduled_time: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="duration">Duration (minutes)</Label>
              <Input
                id="duration"
                type="number"
                min="15"
                max="480"
                value={formData.duration_minutes || ''}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === '') {
                    setFormData({ ...formData, duration_minutes: 0 });
                  } else {
                    const parsed = parseInt(value, 10);
                    if (!isNaN(parsed)) {
                      setFormData({ ...formData, duration_minutes: parsed });
                    }
                  }
                }}
              />
              {formData.auto_create_zoom && formData.duration_minutes > 0 && formData.duration_minutes < 60 && (
                <p className="text-xs text-amber-500">Zoom requires minimum 60 minutes</p>
              )}
            </div>

            {/* Zoom section */}
            {!editingSession && (
              <div className="space-y-3 p-4 rounded-lg bg-muted/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Video className="w-4 h-4 text-blue-500" />
                    <Label htmlFor="auto_zoom" className="cursor-pointer">Auto-create Zoom meeting</Label>
                  </div>
                  <Switch
                    id="auto_zoom"
                    checked={formData.auto_create_zoom}
                    onCheckedChange={(checked) => setFormData({ ...formData, auto_create_zoom: checked, zoom_link: checked ? '' : formData.zoom_link })}
                    disabled={!zoomConfigured}
                  />
                </div>
                {!zoomConfigured && (
                  <p className="text-xs text-muted-foreground">
                    Zoom is not configured. Add ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, and ZOOM_CLIENT_SECRET to enable.
                  </p>
                )}
                {!formData.auto_create_zoom && (
                  <div className="space-y-2">
                    <Label htmlFor="zoom_link">Zoom Link (manual)</Label>
                    <Input
                      id="zoom_link"
                      value={formData.zoom_link}
                      onChange={(e) => setFormData({ ...formData, zoom_link: e.target.value })}
                      placeholder="https://zoom.us/j/..."
                    />
                  </div>
                )}
              </div>
            )}

            {editingSession && (
              <div className="space-y-2">
                <Label htmlFor="zoom_link">Zoom Link</Label>
                <Input
                  id="zoom_link"
                  value={formData.zoom_link}
                  onChange={(e) => setFormData({ ...formData, zoom_link: e.target.value })}
                  placeholder="https://zoom.us/j/..."
                />
              </div>
            )}

            {/* Calendar section */}
            {!editingSession && (
              <div className="space-y-3 p-4 rounded-lg bg-muted/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CalendarPlus className="w-4 h-4 text-green-500" />
                    <Label htmlFor="calendar_invites" className="cursor-pointer">Send calendar invites to cohort</Label>
                  </div>
                  <Switch
                    id="calendar_invites"
                    checked={formData.send_calendar_invites}
                    onCheckedChange={(checked) => setFormData({ ...formData, send_calendar_invites: checked })}
                    disabled={!calendarConnected}
                  />
                </div>
                {!calendarConnected ? (
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                      Connect Google Calendar to send invites
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => window.location.href = '/api/calendar/auth'}
                    >
                      <Link2 className="w-3 h-3 mr-1" />
                      Connect
                    </Button>
                  </div>
                ) : calendarNeedsReconnect ? (
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-amber-500">
                      Calendar token expired. Please reconnect.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => window.location.href = '/api/calendar/auth'}
                    >
                      <Link2 className="w-3 h-3 mr-1" />
                      Reconnect
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${calendarHealth === 'healthy' ? 'bg-green-500' : calendarHealth === 'expiring_soon' ? 'bg-amber-500' : 'bg-red-500'}`} />
                    <p className="text-xs text-muted-foreground">
                      Connected as {calendarEmail}. {formData.cohort_ids.length > 0 ? 'All cohort members + admins + guests will receive calendar invites.' : 'Select cohorts to send invites.'}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving} className="gradient-bg">
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : editingSession ? (
                'Update'
              ) : (
                'Create'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <RsvpListDialog
        open={rsvpDialogOpen}
        onOpenChange={setRsvpDialogOpen}
        sessionId={rsvpSessionId}
        sessionTitle={rsvpSessionTitle}
      />
    </div>
  );
}
