'use client';

import { useEffect, useState, useMemo } from 'react';
import { useUser } from '@/hooks/use-user';
import { getClient } from '@/lib/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  Video,
  Bell,
  BellOff,
  Check,
  X,
  ExternalLink,
  Globe,
} from 'lucide-react';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
  parseISO,
  startOfWeek,
  endOfWeek,
} from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { cn } from '@/lib/utils';
import type { Session, Rsvp } from '@/types';

interface SessionWithRsvp extends Session {
  user_rsvp?: Rsvp;
}

export default function CalendarPage() {
  const { profile, loading: userLoading } = useUser();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [sessions, setSessions] = useState<SessionWithRsvp[]>([]);
  const [selectedSession, setSelectedSession] = useState<SessionWithRsvp | null>(null);
  const [loading, setLoading] = useState(true);
  const [showUTC, setShowUTC] = useState(false);
  const [rsvpLoading, setRsvpLoading] = useState(false);

  const userTimezone = profile?.timezone || 'Asia/Kolkata';

  useEffect(() => {
    const fetchSessions = async () => {
      if (!profile?.cohort_id) {
        setLoading(false);
        return;
      }

      const supabase = getClient();
      const start = startOfMonth(currentMonth);
      const end = endOfMonth(currentMonth);

      try {
        // Fetch sessions for the current month
        const { data: sessionsData, error: sessionsError } = await supabase
          .from('sessions')
          .select('*')
          .eq('cohort_id', profile.cohort_id)
          .gte('scheduled_at', start.toISOString())
          .lte('scheduled_at', end.toISOString())
          .order('scheduled_at', { ascending: true });

        if (sessionsError) throw sessionsError;

        // Fetch RSVPs for the user
        const { data: rsvpsData } = await supabase
          .from('rsvps')
          .select('*')
          .eq('user_id', profile.id)
          .in('session_id', sessionsData?.map((s: Session) => s.id) || []);

        // Merge RSVPs with sessions
        const sessionsWithRsvp = sessionsData?.map((session: Session) => ({
          ...session,
          user_rsvp: rsvpsData?.find((r: Rsvp) => r.session_id === session.id),
        })) || [];

        setSessions(sessionsWithRsvp);
      } catch (error) {
        console.error('Error fetching sessions:', error);
        toast.error('Failed to load calendar');
      } finally {
        setLoading(false);
      }
    };

    if (!userLoading) {
      fetchSessions();
    }
  }, [profile, currentMonth, userLoading]);

  const handleRsvp = async (response: 'yes' | 'no') => {
    if (!selectedSession || !profile) return;

    setRsvpLoading(true);
    const supabase = getClient();

    try {
      const { error } = await supabase
        .from('rsvps')
        .upsert({
          session_id: selectedSession.id,
          user_id: profile.id,
          response,
          reminder_enabled: selectedSession.user_rsvp?.reminder_enabled ?? true,
        });

      if (error) throw error;

      // Update local state
      setSessions(prev =>
        prev.map(s =>
          s.id === selectedSession.id
            ? {
                ...s,
                user_rsvp: {
                  ...s.user_rsvp,
                  id: s.user_rsvp?.id || '',
                  session_id: selectedSession.id,
                  user_id: profile.id,
                  response,
                  reminder_enabled: s.user_rsvp?.reminder_enabled ?? true,
                  created_at: s.user_rsvp?.created_at || new Date().toISOString(),
                },
              }
            : s
        )
      );

      setSelectedSession(prev =>
        prev
          ? {
              ...prev,
              user_rsvp: {
                ...prev.user_rsvp,
                id: prev.user_rsvp?.id || '',
                session_id: selectedSession.id,
                user_id: profile.id,
                response,
                reminder_enabled: prev.user_rsvp?.reminder_enabled ?? true,
                created_at: prev.user_rsvp?.created_at || new Date().toISOString(),
              },
            }
          : null
      );

      toast.success(response === 'yes' ? "You're in! See you there." : 'RSVP updated');
    } catch (error) {
      console.error('Error updating RSVP:', error);
      toast.error('Failed to update RSVP');
    } finally {
      setRsvpLoading(false);
    }
  };

  const handleToggleReminder = async () => {
    if (!selectedSession?.user_rsvp || !profile) return;

    const supabase = getClient();
    const newValue = !selectedSession.user_rsvp.reminder_enabled;

    try {
      const { error } = await supabase
        .from('rsvps')
        .update({ reminder_enabled: newValue })
        .eq('id', selectedSession.user_rsvp.id);

      if (error) throw error;

      setSelectedSession(prev =>
        prev?.user_rsvp
          ? { ...prev, user_rsvp: { ...prev.user_rsvp, reminder_enabled: newValue } }
          : prev
      );

      toast.success(newValue ? 'Reminder enabled' : 'Reminder disabled');
    } catch (error) {
      console.error('Error toggling reminder:', error);
      toast.error('Failed to update reminder');
    }
  };

  // Generate calendar days
  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth));
    const end = endOfWeek(endOfMonth(currentMonth));
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  // Get sessions for a specific day
  const getSessionsForDay = (day: Date) => {
    return sessions.filter(session =>
      isSameDay(parseISO(session.scheduled_at), day)
    );
  };

  const formatTime = (dateStr: string) => {
    const date = parseISO(dateStr);
    if (showUTC) {
      return formatInTimeZone(date, 'UTC', 'h:mm a') + ' UTC';
    }
    return formatInTimeZone(date, userTimezone, 'h:mm a');
  };

  if (userLoading || loading) {
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Calendar</h1>
          <p className="text-muted-foreground">View and RSVP to upcoming sessions</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-muted-foreground" />
            <Label htmlFor="utc-toggle" className="text-sm text-muted-foreground">
              Show UTC
            </Label>
            <Switch
              id="utc-toggle"
              checked={showUTC}
              onCheckedChange={setShowUTC}
            />
          </div>
        </div>
      </div>

      {/* Calendar Card */}
      <Card className="overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg">
            {format(currentMonth, 'MMMM yyyy')}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentMonth(new Date())}
            >
              Today
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {/* Calendar Grid */}
          <div className="grid grid-cols-7">
            {/* Weekday headers */}
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div
                key={day}
                className="p-2 text-center text-sm font-medium text-muted-foreground border-b"
              >
                {day}
              </div>
            ))}

            {/* Calendar days */}
            {calendarDays.map(day => {
              const daySessions = getSessionsForDay(day);
              const isCurrentMonth = isSameMonth(day, currentMonth);
              const isDayToday = isToday(day);

              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    'min-h-[100px] p-2 border-b border-r relative',
                    !isCurrentMonth && 'bg-muted/30'
                  )}
                >
                  <span
                    className={cn(
                      'inline-flex items-center justify-center w-7 h-7 text-sm rounded-full',
                      isDayToday && 'bg-primary text-primary-foreground font-medium',
                      !isCurrentMonth && 'text-muted-foreground'
                    )}
                  >
                    {format(day, 'd')}
                  </span>

                  <div className="mt-1 space-y-1">
                    {daySessions.slice(0, 2).map(session => (
                      <button
                        key={session.id}
                        onClick={() => setSelectedSession(session)}
                        className={cn(
                          'w-full text-left p-1.5 rounded-md text-xs font-medium truncate transition-colors',
                          session.user_rsvp?.response === 'yes'
                            ? 'bg-green-500/10 text-green-600 dark:text-green-400 hover:bg-green-500/20'
                            : session.user_rsvp?.response === 'no'
                            ? 'bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20'
                            : 'bg-primary/10 text-primary hover:bg-primary/20'
                        )}
                      >
                        {format(parseISO(session.scheduled_at), 'h:mm a')} - {session.title}
                      </button>
                    ))}
                    {daySessions.length > 2 && (
                      <p className="text-xs text-muted-foreground pl-1">
                        +{daySessions.length - 2} more
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Legend */}
      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500" />
          <span className="text-muted-foreground">Attending</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500" />
          <span className="text-muted-foreground">Not attending</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-primary/20 border border-primary" />
          <span className="text-muted-foreground">Pending RSVP</span>
        </div>
      </div>

      {/* Session Details Dialog */}
      <Dialog open={!!selectedSession} onOpenChange={(open) => !open && setSelectedSession(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedSession?.title}</DialogTitle>
            <DialogDescription>
              {selectedSession && format(parseISO(selectedSession.scheduled_at), 'EEEE, MMMM d, yyyy')}
            </DialogDescription>
          </DialogHeader>

          {selectedSession && (
            <div className="space-y-4">
              {/* Time */}
              <div className="flex items-center gap-3 text-sm">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span>
                  {formatTime(selectedSession.scheduled_at)} • {selectedSession.duration_minutes} min
                </span>
              </div>

              {/* Description */}
              {selectedSession.description && (
                <p className="text-sm text-muted-foreground">
                  {selectedSession.description}
                </p>
              )}

              {/* Zoom Link */}
              {selectedSession.zoom_link && (
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => window.open(selectedSession.zoom_link!, '_blank')}
                >
                  <Video className="w-4 h-4" />
                  Join Zoom Meeting
                  <ExternalLink className="w-3 h-3 ml-auto" />
                </Button>
              )}

              {/* RSVP Buttons */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Your RSVP</Label>
                <div className="flex gap-2">
                  <Button
                    variant={selectedSession.user_rsvp?.response === 'yes' ? 'default' : 'outline'}
                    className={cn(
                      'flex-1 gap-2',
                      selectedSession.user_rsvp?.response === 'yes' && 'bg-green-600 hover:bg-green-700'
                    )}
                    onClick={() => handleRsvp('yes')}
                    disabled={rsvpLoading}
                  >
                    <Check className="w-4 h-4" />
                    Yes, I&apos;ll attend
                  </Button>
                  <Button
                    variant={selectedSession.user_rsvp?.response === 'no' ? 'default' : 'outline'}
                    className={cn(
                      'flex-1 gap-2',
                      selectedSession.user_rsvp?.response === 'no' && 'bg-red-600 hover:bg-red-700'
                    )}
                    onClick={() => handleRsvp('no')}
                    disabled={rsvpLoading}
                  >
                    <X className="w-4 h-4" />
                    Can&apos;t make it
                  </Button>
                </div>
              </div>

              {/* Reminder Toggle */}
              {selectedSession.user_rsvp?.response === 'yes' && (
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
                  <div className="flex items-center gap-2">
                    {selectedSession.user_rsvp.reminder_enabled ? (
                      <Bell className="w-4 h-4 text-primary" />
                    ) : (
                      <BellOff className="w-4 h-4 text-muted-foreground" />
                    )}
                    <span className="text-sm">Session reminder</span>
                  </div>
                  <Switch
                    checked={selectedSession.user_rsvp.reminder_enabled}
                    onCheckedChange={handleToggleReminder}
                  />
                </div>
              )}

              {/* Timezone note */}
              <p className="text-xs text-muted-foreground text-center">
                Times shown in {showUTC ? 'UTC' : userTimezone}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
