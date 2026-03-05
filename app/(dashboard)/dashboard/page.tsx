'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUserContext } from '@/contexts/user-context';
import { WelcomeBanner } from '@/components/dashboard/welcome-banner';
import { StatsCards } from '@/components/dashboard/stats-cards';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StudentPageLoader } from '@/components/ui/page-loader';
import {
  Calendar, Clock, Video, ChevronRight, BookOpen, FolderOpen, Shield,
  Presentation, FileText, ExternalLink, AlertCircle, RefreshCw, CheckCircle2,
  Link2, FileDown, CalendarOff, Sparkles,
} from 'lucide-react';
import { fetchWithTimeout } from '@/lib/fetch-with-timeout';
import Link from 'next/link';
import { format, isToday, isTomorrow, parseISO } from 'date-fns';
import { InvoiceCard } from '@/components/dashboard/invoice-card';
import { toast } from 'sonner';
import { MotionFadeIn, MotionContainer, MotionItem } from '@/components/ui/motion';
import type { Session, DashboardStats, LearningModule, Resource, Invoice, Cohort, ModuleResource, ModuleResourceType, AdminDashboardStats, AdminDashboardSession, AdminDashboardLearning, StudentDashboardResponse } from '@/types';

interface InvoiceWithCohort extends Invoice { cohort?: Cohort; }
interface RecentLearningAsset extends ModuleResource {
  progress?: { is_completed: boolean; progress_seconds: number; last_viewed_at: string | null; };
}

// --- SWR Cache ---
const DASHBOARD_CACHE_KEY = 'rethink-dashboard-v2-';
const CACHE_MAX_AGE = 5 * 60 * 1000;
interface DashboardCache {
  timestamp: number; stats: DashboardStats | null; upcomingSessions: Session[];
  recentModules: LearningModule[]; recentResources: Resource[];
  recentLearningAssets: RecentLearningAsset[]; invoices: InvoiceWithCohort[];
  pendingInvoiceAmount: number; cohortStartDate: string | null; cohortName: string;
}
function getDashboardCache(cohortId: string): DashboardCache | null {
  try { const raw = localStorage.getItem(`${DASHBOARD_CACHE_KEY}${cohortId}`); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
function setDashboardCache(cohortId: string, data: Omit<DashboardCache, 'timestamp'>) {
  try { localStorage.setItem(`${DASHBOARD_CACHE_KEY}${cohortId}`, JSON.stringify({ ...data, timestamp: Date.now() })); } catch {}
}

// --- Helpers ---
function getContentTypeLabel(type: ModuleResourceType): string {
  switch (type) { case 'video': return 'Recording'; case 'slides': return 'Presentation'; case 'document': return 'Document'; case 'link': return 'Link'; default: return 'Resource'; }
}
function getAccentBarClass(type: ModuleResourceType): string {
  switch (type) { case 'video': return 'accent-bar-teal'; case 'slides': return 'accent-bar-orange'; case 'document': return 'accent-bar-blue'; case 'link': return 'accent-bar-emerald'; default: return 'accent-bar-teal'; }
}
function getAccentColor(type: ModuleResourceType): string {
  switch (type) { case 'video': return 'hsl(172 55% 58%)'; case 'slides': return 'hsl(25 80% 62%)'; case 'document': return 'hsl(210 70% 65%)'; case 'link': return 'hsl(152 50% 55%)'; default: return 'hsl(220 10% 55%)'; }
}
function getContentTypeIcon(type: ModuleResourceType) {
  switch (type) { case 'video': return Video; case 'slides': return Presentation; case 'document': return FileText; case 'link': return Link2; default: return FileText; }
}
function getFileTypeIcon(fileType?: string | null) {
  const ext = (fileType || '').toLowerCase();
  if (ext === 'pdf') return { icon: FileDown, color: 'hsl(0 65% 55%)', bg: 'hsl(0 65% 55% / 0.1)' };
  if (['doc', 'docx'].includes(ext)) return { icon: FileText, color: 'hsl(210 70% 60%)', bg: 'hsl(210 70% 60% / 0.1)' };
  if (['ppt', 'pptx'].includes(ext)) return { icon: Presentation, color: 'hsl(25 80% 55%)', bg: 'hsl(25 80% 55% / 0.1)' };
  return { icon: FileText, color: 'hsl(220 12% 55%)', bg: 'hsl(220 12% 55% / 0.1)' };
}

export default function DashboardPage() {
  const router = useRouter();
  const { profile, loading: userLoading, isAdmin, activeCohortId } = useUserContext();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [upcomingSessions, setUpcomingSessions] = useState<Session[]>([]);
  const [recentModules, setRecentModules] = useState<LearningModule[]>([]);
  const [recentResources, setRecentResources] = useState<Resource[]>([]);
  const [recentLearningAssets, setRecentLearningAssets] = useState<RecentLearningAsset[]>([]);
  const [invoices, setInvoices] = useState<InvoiceWithCohort[]>([]);
  const [pendingInvoiceAmount, setPendingInvoiceAmount] = useState(0);
  const [cohortStartDate, setCohortStartDate] = useState<Date | null>(null);
  const [cohortName, setCohortName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [isStale, setIsStale] = useState(false);
  const [adminStats, setAdminStats] = useState<AdminDashboardStats | null>(null);
  const [adminSessions, setAdminSessions] = useState<AdminDashboardSession[]>([]);
  const [adminLearnings, setAdminLearnings] = useState<AdminDashboardLearning[]>([]);

  useEffect(() => {
    const ac = new AbortController();
    const fetchData = async () => {
      if (!profile) { setLoading(false); return; }
      if (retryCount > 0 && !getDashboardCache(activeCohortId || '')) setLoading(true);

      if (isAdmin) {
        try {
          const res = await fetchWithTimeout('/api/admin/dashboard-stats', { signal: ac.signal });
          if (ac.signal.aborted) return;
          if (res.ok) { const d = await res.json(); setAdminStats(d.stats); setAdminSessions(d.upcomingSessions || []); setAdminLearnings(d.recentLearnings || []); setError(null); }
          else setError('Failed to load admin dashboard.');
        } catch (err) { if (ac.signal.aborted) return; setError('Something went wrong loading the dashboard.'); }
        finally { if (!ac.signal.aborted) setLoading(false); }
        return;
      }
      if (!activeCohortId) { setLoading(false); return; }

      const cached = getDashboardCache(activeCohortId);
      if (cached) {
        setStats(cached.stats); setUpcomingSessions(cached.upcomingSessions); setRecentModules(cached.recentModules);
        setRecentResources(cached.recentResources); setRecentLearningAssets(cached.recentLearningAssets);
        setInvoices(cached.invoices); setPendingInvoiceAmount(cached.pendingInvoiceAmount);
        if (cached.cohortStartDate) setCohortStartDate(new Date(cached.cohortStartDate));
        setCohortName(cached.cohortName); setLoading(false);
        if (Date.now() - cached.timestamp > CACHE_MAX_AGE) setIsStale(true);
      }

      try {
        const res = await fetchWithTimeout(`/api/dashboard/student?cohort_id=${activeCohortId}`, { signal: ac.signal }, 15_000);
        if (ac.signal.aborted) return;
        if (!res.ok) throw new Error(`BFF returned ${res.status}`);
        const data: StudentDashboardResponse = await res.json();
        if (data.cohort) { setCohortName(data.cohort.name); if (data.cohort.start_date) setCohortStartDate(new Date(data.cohort.start_date)); }
        setStats(data.stats); setUpcomingSessions(data.upcomingSessions); setRecentModules(data.recentModules);
        setRecentResources(data.recentResources); setRecentLearningAssets(data.recentLearningAssets);
        setInvoices(data.invoices); setPendingInvoiceAmount(data.pendingInvoiceAmount);
        setDashboardCache(activeCohortId, { stats: data.stats, upcomingSessions: data.upcomingSessions, recentModules: data.recentModules, recentResources: data.recentResources, recentLearningAssets: data.recentLearningAssets, invoices: data.invoices, pendingInvoiceAmount: data.pendingInvoiceAmount, cohortStartDate: data.cohort?.start_date || null, cohortName: data.cohort?.name || '' });
        if (data._meta.failedQueries === data._meta.totalQueries && !cached) setError('Unable to load dashboard.');
        else if (data._meta.failedQueries > 0) setIsStale(true);
        else { setError(null); setIsStale(false); }
      } catch (err) {
        if (ac.signal.aborted) return;
        if (!cached) setError('Something went wrong loading your dashboard.');
        else setIsStale(true);
      } finally { if (!ac.signal.aborted) setLoading(false); }
    };
    if (!userLoading) fetchData();
    return () => ac.abort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, userLoading, activeCohortId, isAdmin, retryCount]);

  const getSessionTimeLabel = (date: string) => {
    const d = parseISO(date);
    if (isToday(d)) return 'Today'; if (isTomorrow(d)) return 'Tomorrow';
    return format(d, 'EEE, MMM d');
  };

  const handleInvoiceDownload = async (invoice: InvoiceWithCohort) => {
    if (!invoice.pdf_path) { toast.error('No PDF available'); return; }
    try {
      const res = await fetch(`/api/invoices/${invoice.id}/download`); const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to download');
      window.open(data.url, '_blank');
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed to download invoice'); }
  };

  if (userLoading || loading) return <StudentPageLoader message="Loading your dashboard..." />;

  if (error && ((!stats && !isAdmin) || isAdmin)) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="max-w-sm w-full text-center space-y-4">
          <AlertCircle className="w-8 h-8 text-amber-500 mx-auto" />
          <div>
            <h3 className="font-semibold font-heading text-foreground">Unable to load dashboard</h3>
            <p className="text-sm text-muted-foreground mt-1">{error}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => { setError(null); setRetryCount(c => c + 1); }} className="gap-2">
            <RefreshCw className="w-3.5 h-3.5" /> Try again
          </Button>
        </div>
      </div>
    );
  }

  // --- Admin ---
  if (isAdmin) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-white/[0.06] flex items-center justify-center">
            <Shield className="w-5 h-5 text-muted-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-heading">Admin Overview</h1>
            <p className="text-sm text-muted-foreground">Across all cohorts</p>
          </div>
        </div>

        <div className="rounded-xl border border-white/[0.15] bg-card overflow-hidden card-3d-static">
          <div className="grid grid-cols-2 lg:grid-cols-4">
            {[
              { label: 'Users', value: adminStats?.totalStudents || 0 },
              { label: 'Cohorts', value: adminStats?.activeCohorts || 0 },
              { label: 'Sessions', value: adminStats?.upcomingSessionsCount || 0 },
              { label: 'Learnings', value: adminStats?.totalLearnings || 0 },
            ].map((stat, i) => (
              <div key={stat.label} className="px-6 py-5 lg:px-7 lg:py-6" style={{ borderRight: i < 3 ? '1px solid hsl(220 10% 90% / 0.07)' : undefined }}>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 font-heading">{stat.label}</p>
                <p className="text-2xl font-bold text-foreground tabular-nums font-heading">{stat.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <ContentCard title="Upcoming Sessions" icon={Calendar} sub="across cohorts">
            {!adminSessions?.length ? (
              <EmptyState icon={CalendarOff} message="No sessions scheduled" />
            ) : (
              <div className="divide-y divide-white/[0.04]">
                {adminSessions.slice(0, 5).map((s) => (
                  <div key={s.id} className="accent-bar-teal flex items-center gap-3 px-5 py-4 hover:bg-white/[0.02] transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{s.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{format(parseISO(s.scheduled_at), 'MMM d, h:mm a')} <span className="mx-1 text-muted-foreground/40">·</span> {s.cohortTag}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ContentCard>
          <ContentCard title="Recent Learnings" icon={BookOpen} sub="latest content">
            {!adminLearnings?.length ? (
              <EmptyState icon={BookOpen} message="No learnings yet" />
            ) : (
              <div className="divide-y divide-white/[0.04]">
                {adminLearnings.slice(0, 5).map((l) => (
                  <div key={l.id} className="accent-bar-violet flex items-center gap-3 px-5 py-4 hover:bg-white/[0.02] transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{l.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        <span style={{ color: 'hsl(280 55% 65%)' }}>{l.type}</span>
                        <span className="mx-1 text-muted-foreground/40">·</span> {l.cohortTag}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ContentCard>
        </div>
      </div>
    );
  }

  if (!activeCohortId) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="max-w-sm text-center">
          <h3 className="font-semibold font-heading">No Cohort Assigned</h3>
          <p className="text-sm text-muted-foreground mt-1">Contact your administrator to get assigned to a cohort.</p>
        </div>
      </div>
    );
  }

  // --- Student Dashboard ---
  return (
    <div className="space-y-5">
      <WelcomeBanner
        cohortStartDate={cohortStartDate}
        cohortName={cohortName}
        nextSession={upcomingSessions[0]}
        lastLearning={recentLearningAssets[0]}
      />

      {isStale && (
        <div className="flex items-center justify-between px-4 py-2.5 rounded-lg bg-amber-500/[0.06] border border-amber-500/10">
          <p className="text-sm text-amber-400">Showing cached data</p>
          <button onClick={() => { setIsStale(false); setRetryCount(c => c + 1); }} className="text-sm text-amber-400 hover:text-amber-300 transition-colors flex items-center gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
      )}

      <StatsCards stats={stats || undefined} />

      {/* Content Grid — stretch to match heights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">
        {/* Upcoming Sessions */}
        <MotionFadeIn delay={0.1} className="h-full">
          <ContentCard title="Upcoming Sessions" icon={Calendar} link={{ href: '/calendar', label: 'View all' }}>
            {upcomingSessions.length === 0 ? (
              <EmptyState
                icon={CalendarOff}
                message="You're all caught up"
                sub="No sessions scheduled right now"
                link={{ href: '/calendar', label: 'View full calendar' }}
              />
            ) : (
              <MotionContainer delay={0.15} className="divide-y divide-white/[0.04]">
                {upcomingSessions.map((session) => (
                  <MotionItem key={session.id}>
                    <Link
                      href="/calendar"
                      className="accent-bar-teal flex items-center gap-3 px-5 py-4 hover:bg-white/[0.02] transition-all group"
                    >
                      {/* Date badge */}
                      <div className="w-10 h-10 rounded-lg bg-white/[0.04] flex flex-col items-center justify-center shrink-0 border border-white/[0.12]">
                        <span className="text-[10px] font-medium text-muted-foreground uppercase leading-none">
                          {format(parseISO(session.scheduled_at), 'MMM')}
                        </span>
                        <span className="text-sm font-bold text-foreground leading-none mt-0.5 tabular-nums">
                          {format(parseISO(session.scheduled_at), 'd')}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[15px] font-medium text-foreground truncate group-hover:text-white transition-colors leading-snug">{session.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Clock className="w-3 h-3 text-muted-foreground/60" />
                          <span className="text-[13px] text-muted-foreground tabular-nums">
                            {format(parseISO(session.scheduled_at), 'h:mm a')}
                          </span>
                          <span className="text-muted-foreground/30">·</span>
                          <span className="text-[13px] text-muted-foreground">{session.duration_minutes} min</span>
                        </div>
                      </div>
                      <span className="text-[11px] font-medium text-muted-foreground shrink-0 px-2 py-1 rounded-md bg-white/[0.04]">
                        {getSessionTimeLabel(session.scheduled_at)}
                      </span>
                    </Link>
                  </MotionItem>
                ))}
              </MotionContainer>
            )}
          </ContentCard>
        </MotionFadeIn>

        {/* My Learnings */}
        <MotionFadeIn delay={0.15} className="h-full">
          <ContentCard title="My Learnings" icon={BookOpen} link={{ href: '/learnings', label: 'View all' }}>
            {recentLearningAssets.length === 0 ? (
              <EmptyState
                icon={BookOpen}
                message="Start exploring"
                sub="Your recent learning activity will show here"
                link={{ href: '/learnings', label: 'Browse learnings' }}
              />
            ) : (
              <MotionContainer delay={0.2} className="divide-y divide-white/[0.04]">
                {recentLearningAssets.map((asset) => {
                  const TypeIcon = getContentTypeIcon(asset.content_type);
                  const accentColor = getAccentColor(asset.content_type);
                  return (
                    <MotionItem key={asset.id}>
                      <Link
                        href={`/learnings?resource=${asset.id}`}
                        className={`${getAccentBarClass(asset.content_type)} flex items-center gap-3 px-5 py-4 hover:bg-white/[0.02] transition-all group`}
                      >
                        {/* Content type icon badge */}
                        <div
                          className="icon-badge"
                          style={{ background: `${accentColor.replace(')', ' / 0.1)')}` }}
                        >
                          <TypeIcon className="w-4 h-4" style={{ color: accentColor }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[15px] font-medium text-foreground truncate group-hover:text-white transition-colors leading-snug">
                            {asset.title}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[13px] font-medium" style={{ color: accentColor }}>
                              {getContentTypeLabel(asset.content_type)}
                            </span>
                            {asset.progress?.is_completed && (
                              <>
                                <span className="text-muted-foreground/40">·</span>
                                <span className="inline-flex items-center gap-1 text-[13px] text-emerald-400">
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Done
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-muted-foreground group-hover:translate-x-0.5 transition-all shrink-0" />
                      </Link>
                    </MotionItem>
                  );
                })}
              </MotionContainer>
            )}
          </ContentCard>
        </MotionFadeIn>
      </div>

      {invoices.length > 0 && (
        <MotionFadeIn delay={0.2}>
          <InvoiceCard invoices={invoices} pendingAmount={pendingInvoiceAmount} onView={handleInvoiceDownload} onDownload={handleInvoiceDownload} />
        </MotionFadeIn>
      )}

      {recentResources.length > 0 && (
        <MotionFadeIn delay={0.25}>
          <ContentCard title="Resources" icon={FolderOpen} link={{ href: '/resources', label: 'View all' }}>
            <MotionContainer delay={0.3} className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 divide-white/[0.04]">
              {recentResources.map((resource, i) => {
                const fileInfo = getFileTypeIcon(resource.file_type || resource.category);
                const FileIcon = fileInfo.icon;
                return (
                  <MotionItem key={resource.id}>
                    <Link
                      href={`/resources?file=${resource.id}`}
                      className={`flex items-center gap-3 px-5 py-4 hover:bg-white/[0.02] transition-all group ${
                        i % 2 === 0 ? 'sm:border-r sm:border-white/[0.04]' : ''
                      } ${i >= 2 ? 'sm:border-t sm:border-white/[0.04]' : ''}`}
                    >
                      <div
                        className="icon-badge"
                        style={{ background: fileInfo.bg }}
                      >
                        <FileIcon className="w-4 h-4" style={{ color: fileInfo.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[15px] font-medium text-foreground truncate group-hover:text-white transition-colors leading-snug">
                          {resource.name}
                        </p>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider mt-0.5 font-medium">
                          {resource.file_type?.toUpperCase() || resource.category?.toUpperCase() || 'File'}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-muted-foreground group-hover:translate-x-0.5 transition-all shrink-0" />
                    </Link>
                  </MotionItem>
                );
              })}
            </MotionContainer>
          </ContentCard>
        </MotionFadeIn>
      )}
    </div>
  );
}

// --- Content Card with icon in header ---
function ContentCard({ title, icon: Icon, sub, link, children }: {
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  sub?: string;
  link?: { href: string; label: string };
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/[0.15] bg-card overflow-hidden flex flex-col h-full card-3d">
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.04]">
        <div className="flex items-center gap-2.5">
          {Icon && <Icon className="w-4 h-4 text-muted-foreground/70" />}
          <h2 className="text-sm font-semibold text-foreground font-heading">{title}</h2>
          {sub && <span className="text-xs text-muted-foreground hidden sm:inline">· {sub}</span>}
        </div>
        {link && (
          <Link href={link.href} className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 group">
            {link.label} <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        )}
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}

// --- Rich Empty State ---
function EmptyState({ icon: Icon, message, sub, link }: {
  icon: React.ComponentType<{ className?: string }>;
  message: string;
  sub?: string;
  link?: { href: string; label: string };
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-5 h-full">
      <div className="w-12 h-12 rounded-xl bg-white/[0.04] flex items-center justify-center mb-3 empty-pulse">
        <Icon className="w-6 h-6 text-muted-foreground/40" />
      </div>
      <p className="text-[15px] font-medium text-muted-foreground">{message}</p>
      {sub && <p className="text-[13px] text-muted-foreground/60 mt-1">{sub}</p>}
      {link && (
        <Link href={link.href} className="text-[13px] text-muted-foreground hover:text-foreground transition-colors mt-3 flex items-center gap-1 group">
          {link.label} <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      )}
    </div>
  );
}
