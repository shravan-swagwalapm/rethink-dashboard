'use client';

import { useUserContext } from '@/contexts/user-context';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { ChevronDown, Shield, BookOpen, Users, UserCog, Check } from 'lucide-react';
import type { UserRole } from '@/types';

const roleIcons: Record<UserRole, typeof Shield> = {
  admin: Shield,
  company_user: Shield,
  mentor: Users,
  student: BookOpen,
  master: UserCog,
};

const roleLabels: Record<UserRole, string> = {
  admin: 'Admin',
  company_user: 'Company User',
  mentor: 'Mentor',
  student: 'Student',
  master: 'Guest',
};

export function RoleSwitcher() {
  const {
    activeRoleAssignment,
    availableRoles,
    hasMultipleRoles,
    switchRole
  } = useUserContext();

  // Don't render if only one role
  if (!hasMultipleRoles) return null;

  const ActiveIcon = activeRoleAssignment?.role
    ? roleIcons[activeRoleAssignment.role]
    : Shield;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          <ActiveIcon className="h-4 w-4" />
          <span className="hidden sm:inline">
            {activeRoleAssignment?.role ? roleLabels[activeRoleAssignment.role] : 'Role'}
          </span>
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Switch Role</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {availableRoles.map((roleAssignment) => {
          const Icon = roleIcons[roleAssignment.role];
          const isActive = activeRoleAssignment?.id === roleAssignment.id;

          return (
            <DropdownMenuItem
              key={roleAssignment.id}
              onClick={() => switchRole(roleAssignment.id)}
              className="flex items-center gap-2 cursor-pointer"
            >
              <Icon className="h-4 w-4" />
              <div className="flex-1">
                <div className="font-medium">{roleLabels[roleAssignment.role]}</div>
                {roleAssignment.cohort && (
                  <div className="text-xs text-muted-foreground">
                    {roleAssignment.cohort.name}
                  </div>
                )}
              </div>
              {isActive && <Check className="h-4 w-4 text-primary" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
