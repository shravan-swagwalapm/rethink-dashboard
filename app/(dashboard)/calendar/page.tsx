'use client';

import { useEffect, useState, useMemo } from 'react';
import { useUserContext } from '@/contexts/user-context';
import { getClient } from '@/lib/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { StudentPageLoader } from '@/components/ui/page-loader';
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

type TimezoneMode = 'ist' | 'utc' | 'local';

export default function CalendarPage() {
  const { profile, loading: userLoading, activeCohortId, isAdmin } = useUserContext();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [sessions, setSessions] = useState<SessionWithRsvp[]>([]);
  const [selectedSession, setSelectedSession] = useState<SessionWithRsvp | null>(null);
  const [loading, setLoading] = useState(true);
  const [timezoneMode, setTimezoneMode] = useState<TimezoneMode>('ist');
  const [rsvpLoading, setRsvpLoading] = useState(false);

  // Get browser's local timezone
  const localTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  useEffect(() => {
    const fetchSessions = async () => {
      const supabase = getClient();
      const start = startOfMonth(currentMonth);
      const end = endOfMonth(currentMonth);

      try {
        // FILTERING LOGIC:
        // - Admin role: Show ALL sessions from all cohorts
        // - Student/Mentor role: Show ONLY sessions for active cohort
        //   Uses session_cohorts junction table for proper multi-cohort support
        if (!isAdmin && !activeCohortId) {
          setLoading(false);
          return;
        }

        const selectClause = (!isAdmin && activeCohortId)
          ? '*, session_cohorts!inner(cohort_id)'
          : '*';

        let query = supabase
          .from('sessions')
          .select(selectClause)
          .gte('scheduled_at', start.toISOString())
          .lte('scheduled_at', end.toISOString())
          .order('scheduled_at', { ascending: true });

        if (!isAdmin) {
          query = query.eq('session_cohorts.cohort_id', activeCohortId);
        }

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
        }, {
          onConflict: 'session_id,user_id',
        })
        .select()
        .single();

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
    if (!selectedSession || !profile) return;

    const supabase = getClient();
    const newReminderEnabled = !(selectedSession.user_rsvp?.reminder_enabled ?? false);

    try {
      // If enabling reminder and no RSVP exists, create one with 'yes'
      if (newReminderEnabled && !selectedSession.user_rsvp) {
        const { error } = await supabase
          .from('rsvps')
          .upsert({
            session_id: selectedSession.id,
            user_id: profile.id,
            response: 'yes',
            reminder_enabled: true,
          }, {
            onConflict: 'session_id,user_id',
          })
          .select()
          .single();

        if (error) throw error;

        // Update local state with new RSVP
        const newRsvp = {
          id: '',
          session_id: selectedSession.id,
          user_id: profile.id,
          response: 'yes' as const,
          reminder_enabled: true,
          created_at: new Date().toISOString(),
        };

        setSessions(prev =>
          prev.map(s =>
            s.id === selectedSession.id
              ? { ...s, user_rsvp: newRsvp }
              : s
          )
        );

        setSelectedSession(prev =>
          prev ? { ...prev, user_rsvp: newRsvp } : null
        );

        toast.success("Reminder enabled - You're marked as attending!");
        return;
      }

      // Existing logic for toggling reminder when RSVP exists
      if (selectedSession.user_rsvp) {
        const { error } = await supabase
          .from('rsvps')
          .update({ reminder_enabled: newReminderEnabled })
          .eq('id', selectedSession.user_rsvp.id);

        if (error) throw error;

        // Update BOTH sessions array AND selectedSession
        setSessions(prev =>
          prev.map(s =>
            s.id === selectedSession.id && s.user_rsvp
              ? { ...s, user_rsvp: { ...s.user_rsvp, reminder_enabled: newReminderEnabled } }
              : s
          )
        );

        setSelectedSession(prev =>
          prev?.user_rsvp
            ? { ...prev, user_rsvp: { ...prev.user_rsvp, reminder_enabled: newReminderEnabled } }
            : prev
        );

        toast.success(newReminderEnabled ? 'Reminder enabled' : 'Reminder disabled');
      }
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
    switch (timezoneMode) {
      case 'utc':
        return formatInTimeZone(date, 'UTC', 'h:mm a') + ' UTC';
      case 'local':
        return formatInTimeZone(date, localTimezone, 'h:mm a');
      case 'ist':
      default:
        return formatInTimeZone(date, 'Asia/Kolkata', 'h:mm a') + ' IST';
    }
  };

  const getTimezoneLabel = () => {
    switch (timezoneMode) {
      case 'utc':
        return 'UTC';
      case 'local':
        return localTimezone;
      case 'ist':
      default:
        return 'IST (Asia/Kolkata)';
    }
  };

  // Show full-page loader until BOTH auth AND data are ready
  // This prevents flash of empty content
  if (userLoading || loading) {
    return <StudentPageLoader message="Loading your schedule..." />;
  }

  return (
    <div className="space-y-6">
      {/* Futuristic Header Card */}
      <div className="relative group">
        {/* Animated border glow effect */}
        <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 rounded-2xl blur-sm opacity-60 group-hover:opacity-80 transition duration-500 animate-border-glow" />

        <Card className="relative overflow-hidden border-0 rounded-2xl">
          {/* Deep space gradient background */}
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-purple-900/90 to-slate-900" />

          {/* Abstract wave background SVG */}
          <div className="absolute inset-0 opacity-50">
            <svg
              className="absolute inset-0 w-full h-full"
              viewBox="0 0 1200 200"
              preserveAspectRatio="xMidYMid slice"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <linearGradient id="cal-wave-1" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.6" />
                  <stop offset="50%" stopColor="#8b5cf6" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#ec4899" stopOpacity="0.3" />
                </linearGradient>
                <linearGradient id="cal-wave-2" x1="100%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.5" />
                  <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.2" />
                </linearGradient>
                <filter id="cal-glow">
                  <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                  <feMerge>
                    <feMergeNode in="coloredBlur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              {/* Aurora wave 1 */}
              <path
                d="M0,100 C150,50 350,150 600,100 C850,50 1050,120 1200,80 L1200,200 L0,200 Z"
                fill="url(#cal-wave-1)"
                filter="url(#cal-glow)"
                className="animate-wave-slow"
              />
              {/* Aurora wave 2 */}
              <path
                d="M0,130 C200,80 400,180 700,120 C900,80 1100,150 1200,110 L1200,200 L0,200 Z"
                fill="url(#cal-wave-2)"
                filter="url(#cal-glow)"
                className="animate-wave-medium"
              />
              {/* Floating particles */}
              <circle cx="150" cy="40" r="2" fill="#06b6d4" opacity="0.6" className="animate-float-particle" />
              <circle cx="450" cy="60" r="3" fill="#8b5cf6" opacity="0.5" className="animate-float-particle-delayed" />
              <circle cx="750" cy="35" r="2" fill="#ec4899" opacity="0.4" className="animate-float-particle" />
              <circle cx="1050" cy="55" r="3" fill="#06b6d4" opacity="0.5" className="animate-float-particle-delayed" />
            </svg>
          </div>

          {/* Animated gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/10 via-purple-500/10 to-pink-500/10 animate-gradient-x" />

          {/* Cyber grid pattern */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute inset-0" style={{
              backgroundImage: `
                linear-gradient(rgba(6, 182, 212, 0.4) 1px, transparent 1px),
                linear-gradient(90deg, rgba(6, 182, 212, 0.4) 1px, transparent 1px)
              `,
              backgroundSize: '30px 30px',
              maskImage: 'linear-gradient(to bottom, transparent, black 20%, black 80%, transparent)'
            }} />
          </div>

          {/* Floating neon orbs */}
          <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
            <div className="absolute -top-10 -left-10 w-40 h-40 bg-cyan-500/20 rounded-full blur-3xl animate-pulse-slow" />
            <div className="absolute -bottom-10 -right-10 w-48 h-48 bg-purple-500/20 rounded-full blur-3xl animate-float-delayed" />
          </div>

          <CardContent className="relative p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                {/* Glowing icon container */}
                <div className="relative">
                  <div className="absolute inset-0 bg-cyan-400 rounded-xl blur-md opacity-40 animate-pulse" />
                  <div className="relative w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-400 to-purple-500 flex items-center justify-center shadow-lg shadow-cyan-500/30">
                    <CalendarIcon className="w-6 h-6 text-white" />
                  </div>
                </div>
                <div>
                  <h1 className="text-2xl font-bold bg-gradient-to-r from-white via-cyan-100 to-purple-200 bg-clip-text text-transparent">
                    Session Calendar
                  </h1>
                  <p className="text-cyan-200/70 text-sm mt-0.5">View and RSVP to your upcoming sessions</p>
                </div>
              </div>

              {/* Futuristic Timezone Mode Selector */}
              <div className="relative">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500/50 to-purple-500/50 rounded-xl blur opacity-50" />
                <div className="relative flex items-center rounded-xl border border-cyan-500/30 bg-slate-900/80 backdrop-blur-xl p-1 gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setTimezoneMode('ist')}
                    className={cn(
                      'h-9 px-4 text-sm font-semibold transition-all rounded-lg border',
                      timezoneMode === 'ist'
                        ? 'bg-gradient-to-r from-cyan-500 to-purple-500 text-white border-transparent shadow-lg shadow-cyan-500/30 hover:from-cyan-400 hover:to-purple-400'
                        : 'text-cyan-300 border-cyan-500/30 hover:text-white hover:bg-cyan-500/20 hover:border-cyan-400/50'
                    )}
                  >
                    <Globe className="w-4 h-4 mr-2" />
                    IST
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setTimezoneMode('utc')}
                    className={cn(
                      'h-9 px-4 text-sm font-semibold transition-all rounded-lg border',
                      timezoneMode === 'utc'
                        ? 'bg-gradient-to-r from-cyan-500 to-purple-500 text-white border-transparent shadow-lg shadow-cyan-500/30 hover:from-cyan-400 hover:to-purple-400'
                        : 'text-cyan-300 border-cyan-500/30 hover:text-white hover:bg-cyan-500/20 hover:border-cyan-400/50'
                    )}
                  >
                    <Clock className="w-4 h-4 mr-2" />
                    UTC
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setTimezoneMode('local')}
                    className={cn(
                      'h-9 px-4 text-sm font-semibold transition-all rounded-lg border',
                      timezoneMode === 'local'
                        ? 'bg-gradient-to-r from-cyan-500 to-purple-500 text-white border-transparent shadow-lg shadow-cyan-500/30 hover:from-cyan-400 hover:to-purple-400'
                        : 'text-cyan-300 border-cyan-500/30 hover:text-white hover:bg-cyan-500/20 hover:border-cyan-400/50'
                    )}
                  >
                    <CalendarIcon className="w-4 h-4 mr-2" />
                    Local
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>

          {/* Bottom neon line */}
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500 to-transparent" />
        </Card>
      </div>

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
                            : 'bg-amber-500 text-white hover:bg-amber-600'
                        )}
                      >
                        <span className="opacity-90">{formatTime(session.scheduled_at).replace(' IST', '').replace(' UTC', '')}</span>
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
          <div className="w-4 h-4 rounded bg-amber-500 shadow-sm" />
          <span className="text-muted-foreground">Pending RSVP</span>
        </div>
      </div>

      {/* Session Details Dialog */}
      <Dialog open={!!selectedSession} onOpenChange={(open) => !open && setSelectedSession(null)}>
        <DialogContent className="sm:max-w-md border-2 border-border shadow-xl p-0 gap-0 overflow-hidden">
          {/* Header Section */}
          <div className="p-6 border-b border-border bg-gradient-to-br from-muted/30 to-background">
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold">{selectedSession?.title}</DialogTitle>
              <DialogDescription className="text-base text-muted-foreground">
                {selectedSession && format(parseISO(selectedSession.scheduled_at), 'EEEE, MMMM d, yyyy')}
              </DialogDescription>
            </DialogHeader>
          </div>

          {selectedSession && (
            <div className="p-6 space-y-5">
              {/* Time Badge */}
              <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-muted/50 border border-border">
                <Clock className="w-4 h-4 text-primary" />
                <span className="font-semibold">
                  {formatTime(selectedSession.scheduled_at)}
                </span>
                <span className="text-muted-foreground">·</span>
                <span className="text-muted-foreground">{selectedSession.duration_minutes} min</span>
              </div>

              {/* Description */}
              {selectedSession.description && (
                <div className="p-4 rounded-lg bg-muted/30 border border-border">
                  <p className="text-sm text-foreground leading-relaxed">
                    {selectedSession.description}
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-2">
                {/* Zoom Link */}
                {selectedSession.zoom_link && (
                  <Button
                    className="w-full gap-2 bg-blue-600 hover:bg-blue-700 text-white h-11"
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
                  className="w-full gap-2 h-11 border-border"
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
              <div className="space-y-3 pt-4 border-t border-border">
                <Label className="text-sm font-semibold">Your RSVP</Label>
                <div className="flex gap-2">
                  <Button
                    variant={selectedSession.user_rsvp?.response === 'yes' ? 'default' : 'outline'}
                    className={cn(
                      'flex-1 gap-2 h-11',
                      selectedSession.user_rsvp?.response === 'yes' && 'bg-green-600 hover:bg-green-700 border-green-600'
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
                      'flex-1 gap-2 h-11',
                      selectedSession.user_rsvp?.response === 'no' && 'bg-red-600 hover:bg-red-700 border-red-600'
                    )}
                    onClick={() => handleRsvp('no')}
                    disabled={rsvpLoading}
                  >
                    <X className="w-4 h-4" />
                    Can&apos;t make it
                  </Button>
                </div>
              </div>

              {/* Reminder Toggle - always visible, auto-RSVPs when enabled without existing RSVP */}
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50 border border-border">
                <div className="flex items-center gap-3">
                  {selectedSession.user_rsvp?.reminder_enabled ? (
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Bell className="w-4 h-4 text-primary" />
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                      <BellOff className="w-4 h-4 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">Session reminder</span>
                    {!selectedSession.user_rsvp && (
                      <span className="text-xs text-muted-foreground">Enabling will also RSVP you as attending</span>
                    )}
                  </div>
                </div>
                <Switch
                  checked={selectedSession.user_rsvp?.reminder_enabled ?? false}
                  onCheckedChange={handleToggleReminder}
                />
              </div>

              {/* Save hint */}
              <p className="text-sm text-muted-foreground text-center">
                Please close the card once you save your settings
              </p>

              {/* Timezone Note */}
              <p className="text-sm text-muted-foreground text-center pt-2 border-t border-border/50">
                Times shown in {getTimezoneLabel()}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
