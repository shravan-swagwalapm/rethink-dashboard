'use client';

import { UserProvider, useUserContext } from '@/contexts/user-context';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { PageTransition } from '@/components/ui/page-transition';
import { motion, useReducedMotion } from 'framer-motion';
import {
  LayoutDashboard,
  Users,
  UserCheck,
  CalendarDays,
  Video,
  FolderOpen,
  BarChart3,
  Bell,
  LineChart,
  FileText,
  HelpCircle,
  LogOut,
  Sparkles,
  BookOpen,
} from 'lucide-react';
import { FullPageLoader } from '@/components/ui/page-loader';

const adminNavItems = [
  { label: 'Overview', href: '/admin', icon: LayoutDashboard },
  { label: 'Cohorts', href: '/admin/cohorts', icon: CalendarDays },
  { label: 'Users', href: '/admin/users', icon: Users },
  { label: 'Mentors', href: '/admin/mentors', icon: UserCheck },
  { label: 'Sessions', href: '/admin/sessions', icon: Video },
  { label: 'Learnings', href: '/admin/learnings', icon: BookOpen },
  { label: 'Resources', href: '/admin/resources', icon: FolderOpen },
  { label: 'Attendance', href: '/admin/attendance', icon: BarChart3 },
  { label: 'Notifications', href: '/admin/notifications', icon: Bell },
  { label: 'Analytics', href: '/admin/analytics', icon: LineChart },
  { label: 'Invoices', href: '/admin/invoices', icon: FileText },
  { label: 'Support', href: '/admin/support', icon: HelpCircle },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <UserProvider>
      <AdminLayoutInner>{children}</AdminLayoutInner>
    </UserProvider>
  );
}

function AdminLayoutInner({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile, isAdmin, loading, signOut, activeRole } = useUserContext();
  const router = useRouter();
  const pathname = usePathname();
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    // Check if user has intended_role=admin cookie (just logged in as admin)
    const hasAdminIntent = document.cookie.includes('intended_role=admin');

    // Only redirect if profile is loaded AND user is confirmed not admin
    // Don't redirect if profile is null - could be a race condition with useUser timeout
    // Don't redirect if user just logged in as admin (has intended_role cookie)
    if (!loading && profile && !isAdmin && !hasAdminIntent) {
      router.push('/dashboard');
    }
  }, [loading, profile, isAdmin, router]);

  // Only show loading while initial auth check is happening
  if (loading) {
    return <FullPageLoader message="Loading admin panel..." />;
  }

  // If profile loaded and user is NOT admin, don't render (redirect will happen via useEffect)
  // If profile is null, trust the auth callback verification and show the UI
  // If user has intended_role=admin cookie, allow rendering (they just logged in)
  const hasAdminIntent = typeof document !== 'undefined' && document.cookie.includes('intended_role=admin');
  if (profile && !isAdmin && !hasAdminIntent) {
    return null;
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Admin Sidebar */}
      <aside className="w-64 h-screen sticky top-0 flex flex-col bg-sidebar border-r border-sidebar-border">
        {/* Logo */}
        <div className="h-16 flex items-center justify-between border-b border-sidebar-border px-4">
          <Link href="/admin" className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-xl gradient-bg flex items-center justify-center glow-sm group-hover:scale-105 transition-transform">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="font-semibold gradient-text">Admin</span>
              <p className="text-xs text-muted-foreground">Control Panel</p>
            </div>
          </Link>
        </div>

        {/* Logout */}
        <Button
          variant="ghost"
          className="w-full justify-start gap-2 m-2 mt-3 text-red-500 hover:text-red-600 hover:bg-red-500/10"
          size="sm"
          onClick={async () => {
            await signOut();
            router.push('/login');
          }}
        >
          <LogOut className="w-4 h-4" />
          Logout
        </Button>

        {/* Navigation */}
        <ScrollArea className="flex-1 px-3 py-4">
          <nav className="space-y-1">
            {adminNavItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'relative flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all duration-200',
                    isActive
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-sm'
                      : 'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 hover:shadow-sm'
                  )}
                >
                  {/* Spring-physics active indicator */}
                  {isActive && !shouldReduceMotion && (
                    <motion.div
                      layoutId="admin-sidebar-active"
                      className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-primary shadow-[0_0_8px_hsl(172_66%_42%/0.4)]"
                      transition={{
                        type: 'spring',
                        stiffness: 300,
                        damping: 25,
                      }}
                    />
                  )}
                  {isActive && shouldReduceMotion && (
                    <div className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-primary shadow-[0_0_8px_hsl(172_66%_42%/0.4)]" />
                  )}
                  <Icon
                    className={cn(
                      'w-5 h-5 transition-colors',
                      isActive ? 'text-primary' : 'text-muted-foreground'
                    )}
                  />
                  <span>{item.label}</span>
                  {isActive && (
                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />
                  )}
                </Link>
              );
            })}
          </nav>
        </ScrollArea>

        {/* User info */}
        <div className="px-3 pb-4 border-t border-sidebar-border pt-4">
          <div className="p-3 rounded-xl bg-sidebar-accent/50 border border-sidebar-border">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={profile?.avatar_url || ''} />
                <AvatarFallback className="gradient-bg text-white font-medium">
                  {profile?.full_name?.charAt(0) || profile?.email?.charAt(0)?.toUpperCase() || 'A'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {profile?.full_name || 'Admin'}
                </p>
                <p className="text-xs text-muted-foreground capitalize">
                  {activeRole || profile?.role}
                </p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 overflow-auto">
        <PageTransition className="max-w-7xl mx-auto">
          {children}
        </PageTransition>
      </main>
    </div>
  );
}
