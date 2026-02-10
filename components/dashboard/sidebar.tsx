'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useUserContext } from '@/contexts/user-context';
import {
  LayoutDashboard,
  Calendar,
  BookOpen,
  FolderOpen,
  MessageSquare,
  HelpCircle,
  Users,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  X,
  Receipt,
  User,
  Settings,
  LogOut,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useState, useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

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
  { label: 'Invoices', href: '/invoices', icon: Receipt },
  { label: 'Analytics', href: '/analytics', icon: BarChart3 },
  { label: 'My Subgroup', href: '/my-subgroup', icon: Users },
  { label: 'My Subgroups', href: '/mentor/subgroups', icon: Users, roles: ['mentor'] },
  { label: 'Give Feedback', href: '/mentor/feedback', icon: MessageSquare, roles: ['mentor'] },
  { label: 'Team', href: '/team', icon: Users, roles: ['admin', 'company_user', 'mentor'] },
  { label: 'Attendance', href: '/attendance', icon: BarChart3, roles: ['admin', 'company_user', 'mentor'] },
];

const bottomNavItems: NavItem[] = [
  { label: 'Support', href: '/support', icon: HelpCircle },
];

interface DashboardSidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function DashboardSidebar({ mobileOpen, onMobileClose }: DashboardSidebarProps) {
  const pathname = usePathname();
  const { profile, activeRole, signOut } = useUserContext();
  const [collapsed, setCollapsed] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  const handleSignOut = () => {
    const forceRedirectTimeout = setTimeout(() => {
      window.location.href = '/login?signedout=1';
    }, 2000);
    signOut()
      .then(() => {
        clearTimeout(forceRedirectTimeout);
        window.location.href = '/login?signedout=1';
      })
      .catch(() => {
        clearTimeout(forceRedirectTimeout);
        window.location.href = '/login?signedout=1';
      });
  };

  const filteredNavItems = navItems.filter(
    (item) => !item.roles || item.roles.includes(activeRole || '')
  );

  // Close mobile menu when navigating
  useEffect(() => {
    onMobileClose?.();
  }, [pathname, onMobileClose]);

  const SidebarContent = ({ isMobile = false }: { isMobile?: boolean }) => (
    <>
      {/* Logo */}
      <div className={cn(
        'h-16 flex items-center border-b border-sidebar-border px-4',
        collapsed && !isMobile ? 'justify-center' : 'justify-between'
      )}>
        <Link href="/dashboard" className="flex items-center gap-3 group" onClick={onMobileClose}>
          <div className="w-9 h-9 rounded-xl gradient-bg flex items-center justify-center glow-sm animate-breathe group-hover:scale-105 transition-transform">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          {(!collapsed || isMobile) && (
            <span className="font-semibold text-lg gradient-text">Rethink</span>
          )}
        </Link>
        {!collapsed && !isMobile && (
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

      {/* Collapse button when collapsed (desktop only) */}
      {collapsed && !isMobile && (
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
              onClick={isMobile ? onMobileClose : undefined}
              className={cn(
                'relative flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all duration-200 ease-spring',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-sm'
                  : 'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 hover:shadow-sm',
                collapsed && !isMobile && 'justify-center px-0'
              )}
            >
              {/* Spring-physics active indicator */}
              {isActive && !shouldReduceMotion && (
                <motion.div
                  layoutId={isMobile ? 'sidebar-active-mobile' : 'sidebar-active'}
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
              {(!collapsed || isMobile) && <span>{item.label}</span>}
              {isActive && (!collapsed || isMobile) && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />
              )}
            </Link>
          );

          if (collapsed && !isMobile) {
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
              onClick={isMobile ? onMobileClose : undefined}
              className={cn(
                'flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 hover:shadow-sm',
                collapsed && !isMobile && 'justify-center px-0'
              )}
            >
              <Icon className="w-5 h-5 text-muted-foreground" />
              {(!collapsed || isMobile) && <span>{item.label}</span>}
            </Link>
          );

          if (collapsed && !isMobile) {
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

      {/* User card with dropdown */}
      {(!collapsed || isMobile) && profile && (
        <div className="px-3 pb-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-full p-3 rounded-xl bg-sidebar-accent/50 border border-sidebar-border hover:bg-sidebar-accent/70 transition-colors cursor-pointer text-left">
                <div className="flex items-center gap-3">
                  <Avatar className="w-10 h-10 border-2 border-background">
                    <AvatarImage
                      src={profile.avatar_url ? `${profile.avatar_url}?t=${Date.now()}` : ''}
                      alt={profile.full_name || 'User'}
                    />
                    <AvatarFallback className="gradient-bg text-white font-medium">
                      {profile.full_name?.charAt(0) || profile.email.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {profile.full_name || 'User'}
                    </p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {activeRole || profile.role}
                    </p>
                  </div>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-56 mb-1">
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium">{profile.full_name || 'User'}</p>
                  <p className="text-xs text-muted-foreground truncate">{profile.email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <Link href="/profile" onClick={isMobile ? onMobileClose : undefined}>
                <DropdownMenuItem>
                  <User className="w-4 h-4 mr-2" />
                  Profile
                </DropdownMenuItem>
              </Link>
              <Link href="/profile#settings" onClick={isMobile ? onMobileClose : undefined}>
                <DropdownMenuItem>
                  <Settings className="w-4 h-4 mr-2" />
                  Settings
                </DropdownMenuItem>
              </Link>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleSignOut}
                className="text-destructive focus:text-destructive cursor-pointer"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </>
  );

  return (
    <TooltipProvider delayDuration={0}>
      {/* Desktop Sidebar — spring-animated collapse */}
      <motion.aside
        className="h-screen sticky top-0 flex-col bg-sidebar border-r border-sidebar-border hidden md:flex overflow-hidden"
        animate={{ width: collapsed ? 64 : 256 }}
        transition={
          shouldReduceMotion
            ? { duration: 0 }
            : { type: 'spring', stiffness: 300, damping: 28 }
        }
      >
        <SidebarContent isMobile={false} />
      </motion.aside>

      {/* Mobile Sidebar (Sheet) */}
      <Sheet open={mobileOpen} onOpenChange={onMobileClose}>
        <SheetContent side="left" className="w-72 p-0 bg-sidebar border-sidebar-border">
          <SheetHeader className="sr-only">
            <SheetTitle>Navigation Menu</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col h-full">
            <SidebarContent isMobile={true} />
          </div>
        </SheetContent>
      </Sheet>
    </TooltipProvider>
  );
}
