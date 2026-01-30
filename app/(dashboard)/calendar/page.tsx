'use client';

import { useEffect, useState, useMemo } from 'react';
import { useUser } from '@/hooks/use-user';
import { getClient } from '@/lib/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { PageLoader } from '@/components/ui/page-loader';
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
  const { profile, loading: userLoading, activeCohortId, isAdmin } = useUser();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [sessions, setSessions] = useState<SessionWithRsvp[]>([]);
  const [selectedSession, setSelectedSession] = useState<SessionWithRsvp | null>(null);
  const [loading, setLoading] = useState(true);
  const [showUTC, setShowUTC] = useState(false);
  const [rsvpLoading, setRsvpLoading] = useState(false);

  const userTimezone = profile?.timezone || 'Asia/Kolkata';

  useEffect(() => {
    const fetchSessions = async () => {
      const supabase = getClient();
      const start = startOfMonth(currentMonth);
      const end = endOfMonth(currentMonth);

      try {
        let query = supabase
          .from('sessions')
          .select('*')
          .gte('scheduled_at', start.toISOString())
          .lte('scheduled_at', end.toISOString())
          .order('scheduled_at', { ascending: true });

        // FILTERING LOGIC:
        // - Admin role: Show ALL sessions from all cohorts
        // - Student role: Show ONLY sessions for active cohort
        if (!isAdmin) {
          if (!activeCohortId) {
            setLoading(false);
            return;
          }
          query = query.eq('cohort_id', activeCohortId);
        }
        // Admin: no cohort filter (shows all sessions)

        const { data: sessionsData, error: sessionsError } = await query;

        if (sessionsError) throw sessionsError;

        // Fetch RSVPs only if user is logged in
        const { data: rsvpsData } = profile ? await supabase
          .from('rsvps')
          .select('*')
          .eq('user_id', profile.id)
          .in('session_id', sessionsData?.map((s: Session) => s.id) || []) : { data: null };

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
  }, [profile, currentMonth, userLoading, activeCohortId, isAdmin]);

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

  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth));
    const end = endOfWeek(endOfMonth(currentMonth));
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

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
    return <PageLoader message="Loading calendar..." />;
  }

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card className="gradient-bg border-0">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="text-white">
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <CalendarIcon className="w-6 h-6" />
                Session Calendar
              </h1>
              <p className="text-white/80 mt-1">View and RSVP to your upcoming sessions</p>
            </div>
            <div className="flex items-center gap-3 bg-white/10 rounded-lg px-3 py-2">
              <Globe className="w-4 h-4 text-white/70" />
              <Label htmlFor="utc-toggle" className="text-sm text-white/90 cursor-pointer">
                Show UTC
              </Label>
              <Switch
                id="utc-toggle"
                checked={showUTC}
                onCheckedChange={setShowUTC}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Calendar */}
      <Card className="overflow-hidden shadow-lg">
        {/* Month Navigation */}
        <div className="flex items-center justify-between p-4 border-b bg-muted/30">
          <h2 className="text-xl font-semibold">
            {format(currentMonth, 'MMMM yyyy')}
          </h2>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              className="hover:bg-primary/10"
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentMonth(new Date())}
              className="px-4"
            >
              Today
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              className="hover:bg-primary/10"
            >
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <CardContent className="p-0">
          {/* Weekday Headers */}
          <div className="grid grid-cols-7 bg-muted/50">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div
                key={day}
                className="p-3 text-center text-sm font-semibold text-muted-foreground border-b"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7">
            {calendarDays.map((day, index) => {
              const daySessions = getSessionsForDay(day);
              const isCurrentMonth = isSameMonth(day, currentMonth);
              const isDayToday = isToday(day);
              const isLastRow = index >= calendarDays.length - 7;

              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    'min-h-[120px] p-2 border-r transition-colors',
                    !isLastRow && 'border-b',
                    !isCurrentMonth && 'bg-muted/20',
                    isCurrentMonth && 'hover:bg-muted/30',
                    isDayToday && 'bg-primary/5'
                  )}
                >
                  <div className="flex items-center justify-center mb-2">
                    <span
                      className={cn(
                        'inline-flex items-center justify-center w-8 h-8 text-sm rounded-full font-medium transition-colors',
                        isDayToday && 'bg-primary text-primary-foreground shadow-md',
                        !isCurrentMonth && 'text-muted-foreground/50',
                        isCurrentMonth && !isDayToday && 'text-foreground'
                      )}
                    >
                      {format(day, 'd')}
                    </span>
                  </div>

                  <div className="space-y-1">
                    {daySessions.slice(0, 2).map(session => (
                      <button
                        key={session.id}
                        onClick={() => setSelectedSession(session)}
                        className={cn(
                          'w-full text-left px-2 py-1.5 rounded-md text-xs font-medium truncate transition-all hover:scale-[1.02] shadow-sm',
                          session.user_rsvp?.response === 'yes'
                            ? 'bg-green-500 text-white hover:bg-green-600'
                            : session.user_rsvp?.response === 'no'
                            ? 'bg-red-500/80 text-white hover:bg-red-600'
                            : 'bg-primary text-primary-foreground hover:bg-primary/90'
                        )}
                      >
                        <span className="opacity-90">{format(parseISO(session.scheduled_at), 'h:mm a')}</span>
                        <span className="mx-1">·</span>
                        <span>{session.title}</span>
                      </button>
                    ))}
                    {daySessions.length > 2 && (
                      <button
                        onClick={() => setSelectedSession(daySessions[2])}
                        className="w-full text-xs text-primary hover:underline text-left pl-2"
                      >
                        +{daySessions.length - 2} more
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-green-500 shadow-sm" />
          <span className="text-muted-foreground">Attending</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-red-500/80 shadow-sm" />
          <span className="text-muted-foreground">Not attending</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-primary shadow-sm" />
          <span className="text-muted-foreground">Pending RSVP</span>
        </div>
      </div>

      {/* Session Details Dialog */}
      <Dialog open={!!selectedSession} onOpenChange={(open) => !open && setSelectedSession(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">{selectedSession?.title}</DialogTitle>
            <DialogDescription className="text-base">
              {selectedSession && format(parseISO(selectedSession.scheduled_at), 'EEEE, MMMM d, yyyy')}
            </DialogDescription>
          </DialogHeader>

          {selectedSession && (
            <div className="space-y-4 pt-2">
              {/* Time Badge */}
              <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-muted">
                <Clock className="w-4 h-4 text-primary" />
                <span className="font-medium">
                  {formatTime(selectedSession.scheduled_at)}
                </span>
                <span className="text-muted-foreground">·</span>
                <span className="text-muted-foreground">{selectedSession.duration_minutes} min</span>
              </div>

              {/* Description */}
              {selectedSession.description && (
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {selectedSession.description}
                </p>
              )}

              {/* Action Buttons */}
              <div className="space-y-2">
                {/* Zoom Link */}
                {selectedSession.zoom_link && (
                  <Button
                    className="w-full gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                    onClick={() => window.open(selectedSession.zoom_link!, '_blank')}
                  >
                    <Video className="w-4 h-4" />
                    Join Zoom Meeting
                    <ExternalLink className="w-3 h-3 ml-auto" />
                  </Button>
                )}

                {/* Open in Google Calendar */}
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => {
                    const date = parseISO(selectedSession.scheduled_at);
                    const gcalUrl = `https://calendar.google.com/calendar/r/day/${format(date, 'yyyy')}/${format(date, 'M')}/${format(date, 'd')}`;
                    window.open(gcalUrl, '_blank');
                  }}
                >
                  <CalendarIcon className="w-4 h-4" />
                  Open in Google Calendar
                  <ExternalLink className="w-3 h-3 ml-auto" />
                </Button>
              </div>

              {/* RSVP Section */}
              <div className="space-y-3 pt-2 border-t">
                <Label className="text-sm font-semibold">Your RSVP</Label>
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
                    <span className="text-sm font-medium">Session reminder</span>
                  </div>
                  <Switch
                    checked={selectedSession.user_rsvp.reminder_enabled}
                    onCheckedChange={handleToggleReminder}
                  />
                </div>
              )}

              {/* Timezone Note */}
              <p className="text-xs text-muted-foreground text-center pt-2">
                Times shown in {showUTC ? 'UTC' : userTimezone}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
