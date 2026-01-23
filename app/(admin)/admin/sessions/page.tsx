'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
} from 'lucide-react';
import { format, parseISO, isPast } from 'date-fns';
import type { Session, Cohort } from '@/types';

interface SessionWithStats extends Session {
  cohort?: Cohort;
  rsvp_yes_count?: number;
  rsvp_no_count?: number;
}

export default function SessionsPage() {
  const [sessions, setSessions] = useState<SessionWithStats[]>([]);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [editingSession, setEditingSession] = useState<Session | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    cohort_id: '',
    scheduled_at: '',
    scheduled_time: '',
    duration_minutes: 60,
    zoom_link: '',
  });

  const fetchData = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/sessions');
      if (!response.ok) {
        throw new Error('Failed to fetch sessions');
      }
      const data = await response.json();
      setSessions(data.sessions || []);
      setCohorts(data.cohorts || []);
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

  const handleOpenForm = (session?: Session) => {
    if (session) {
      setEditingSession(session);
      const scheduledDate = parseISO(session.scheduled_at);
      setFormData({
        title: session.title,
        description: session.description || '',
        cohort_id: session.cohort_id || '',
        scheduled_at: format(scheduledDate, 'yyyy-MM-dd'),
        scheduled_time: format(scheduledDate, 'HH:mm'),
        duration_minutes: session.duration_minutes,
        zoom_link: session.zoom_link || '',
      });
    } else {
      setEditingSession(null);
      setFormData({
        title: '',
        description: '',
        cohort_id: '',
        scheduled_at: '',
        scheduled_time: '',
        duration_minutes: 60,
        zoom_link: '',
      });
    }
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formData.title.trim()) {
      toast.error('Title is required');
      return;
    }
    if (!formData.scheduled_at || !formData.scheduled_time) {
      toast.error('Date and time are required');
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
            cohort_id: formData.cohort_id || null,
            scheduled_at: scheduledAt.toISOString(),
            duration_minutes: formData.duration_minutes,
            zoom_link: formData.zoom_link || null,
          }
        : {
            title: formData.title,
            description: formData.description || null,
            cohort_id: formData.cohort_id || null,
            scheduled_at: scheduledAt.toISOString(),
            duration_minutes: formData.duration_minutes,
            zoom_link: formData.zoom_link || null,
          };

      const response = await fetch('/api/admin/sessions', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error('Failed to save session');
      }

      toast.success(editingSession ? 'Session updated' : 'Session created');
      setShowForm(false);
      fetchData();
    } catch (error) {
      console.error('Error saving session:', error);
      toast.error('Failed to save session');
    } finally {
      setSaving(false);
    }
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
      fetchData();
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

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Session Management</h1>
          <p className="text-muted-foreground">
            Create and manage learning sessions
          </p>
        </div>
        <Button onClick={() => handleOpenForm()} className="gradient-bg gap-2">
          <Plus className="w-4 h-4" />
          Create Session
        </Button>
      </div>

      {/* Stats */}
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
                  {sessions.filter(s => !isPast(parseISO(s.scheduled_at))).length}
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
                  {sessions.length > 0
                    ? Math.round(
                        sessions.reduce((acc, s) => acc + (s.rsvp_yes_count || 0), 0) /
                          sessions.length
                      )
                    : 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sessions Table */}
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
                        {session.cohort ? (
                          <Badge variant="outline">{session.cohort.name}</Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
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
                        <div className="flex items-center gap-2">
                          <span className="flex items-center gap-1 text-green-600">
                            <Check className="w-3 h-3" />
                            {session.rsvp_yes_count}
                          </span>
                          <span className="flex items-center gap-1 text-red-500">
                            <X className="w-3 h-3" />
                            {session.rsvp_no_count}
                          </span>
                        </div>
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

            <div className="space-y-2">
              <Label htmlFor="cohort">Cohort</Label>
              <Select
                value={formData.cohort_id}
                onValueChange={(value) => setFormData({ ...formData, cohort_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select cohort" />
                </SelectTrigger>
                <SelectContent>
                  {cohorts.map((cohort) => (
                    <SelectItem key={cohort.id} value={cohort.id}>
                      {cohort.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

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
                value={formData.duration_minutes}
                onChange={(e) =>
                  setFormData({ ...formData, duration_minutes: parseInt(e.target.value) || 60 })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="zoom_link">Zoom Link (optional)</Label>
              <Input
                id="zoom_link"
                value={formData.zoom_link}
                onChange={(e) => setFormData({ ...formData, zoom_link: e.target.value })}
                placeholder="https://zoom.us/j/..."
              />
            </div>
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
    </div>
  );
}
