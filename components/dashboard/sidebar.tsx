'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useUser } from '@/hooks/use-user';
import {
  LayoutDashboard,
  Calendar,
  BookOpen,
  FolderOpen,
  HelpCircle,
  Users,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useState } from 'react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  roles?: string[];
}

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Calendar', href: '/calendar', icon: Calendar },
  { label: 'My Learnings', href: '/learnings', icon: BookOpen },
  { label: 'Resources', href: '/resources', icon: FolderOpen },
  { label: 'Team', href: '/team', icon: Users, roles: ['admin', 'company_user', 'mentor'] },
  { label: 'Attendance', href: '/attendance', icon: BarChart3, roles: ['admin', 'company_user', 'mentor'] },
];

const bottomNavItems: NavItem[] = [
  { label: 'Support', href: '/support', icon: HelpCircle },
];

export function DashboardSidebar() {
  const pathname = usePathname();
  const { profile } = useUser();
  const [collapsed, setCollapsed] = useState(false);

  const filteredNavItems = navItems.filter(
    (item) => !item.roles || item.roles.includes(profile?.role || '')
  );

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          'h-screen sticky top-0 flex flex-col bg-sidebar border-r border-sidebar-border transition-all duration-300',
          collapsed ? 'w-16' : 'w-64'
        )}
      >
        {/* Logo */}
        <div className={cn(
          'h-16 flex items-center border-b border-sidebar-border px-4',
          collapsed ? 'justify-center' : 'justify-between'
        )}>
          <Link href="/dashboard" className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-xl gradient-bg flex items-center justify-center glow-sm group-hover:scale-105 transition-transform">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            {!collapsed && (
              <span className="font-semibold text-lg gradient-text">Rethink</span>
            )}
          </Link>
          {!collapsed && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCollapsed(true)}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
          )}
        </div>

        {/* Collapse button when collapsed */}
        {collapsed && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 mx-auto mt-2"
            onClick={() => setCollapsed(false)}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        )}

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {filteredNavItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;

            const navLink = (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-sm'
                    : 'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50',
                  collapsed && 'justify-center px-0'
                )}
              >
                <Icon
                  className={cn(
                    'w-5 h-5 transition-colors',
                    isActive ? 'text-primary' : 'text-muted-foreground'
                  )}
                />
                {!collapsed && <span>{item.label}</span>}
                {isActive && !collapsed && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />
                )}
              </Link>
            );

            if (collapsed) {
              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>{navLink}</TooltipTrigger>
                  <TooltipContent side="right" sideOffset={10}>
                    {item.label}
                  </TooltipContent>
                </Tooltip>
              );
            }

            return navLink;
          })}
        </nav>

        {/* Bottom Navigation */}
        <div className="px-3 py-4 border-t border-sidebar-border space-y-1">
          {bottomNavItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;

            const navLink = (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50',
                  collapsed && 'justify-center px-0'
                )}
              >
                <Icon className="w-5 h-5 text-muted-foreground" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );

            if (collapsed) {
              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>{navLink}</TooltipTrigger>
                  <TooltipContent side="right" sideOffset={10}>
                    {item.label}
                  </TooltipContent>
                </Tooltip>
              );
            }

            return navLink;
          })}
        </div>

        {/* User card when not collapsed */}
        {!collapsed && profile && (
          <div className="px-3 pb-4">
            <div className="p-3 rounded-xl bg-sidebar-accent/50 border border-sidebar-border">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl gradient-bg flex items-center justify-center text-white font-medium">
                  {profile.full_name?.charAt(0) || profile.email.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {profile.full_name || 'User'}
                  </p>
                  <p className="text-xs text-muted-foreground capitalize">
                    {profile.role}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </aside>
    </TooltipProvider>
  );
}
