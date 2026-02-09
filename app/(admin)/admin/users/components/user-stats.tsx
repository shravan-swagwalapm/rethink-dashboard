'use client';

import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { isAdminRole } from '@/lib/utils/auth';
import type { UserWithCohort } from '../types';

interface UserStatsProps {
  filteredUsers: UserWithCohort[];
  totalUsers: UserWithCohort[];
}

function countByRole(users: UserWithCohort[]) {
  let students = 0, mentors = 0, admins = 0;
  for (const u of users) {
    const assignments = u.role_assignments ?? [];
    if (assignments.length > 0) {
      // Use role_assignments for accurate multi-role counting
      const roles = new Set(assignments.map(ra => ra.role));
      if (roles.has('student')) students++;
      if (roles.has('mentor')) mentors++;
      if ([...roles].some(r => isAdminRole(r))) admins++;
    } else {
      // Legacy fallback for users without role_assignments
      if (u.role === 'student') students++;
      else if (u.role === 'mentor') mentors++;
      else if (isAdminRole(u.role)) admins++;
    }
  }
  return { students, mentors, admins };
}

export function UserStats({ filteredUsers, totalUsers }: UserStatsProps) {
  const isFiltered = filteredUsers.length !== totalUsers.length;
  const filtered = useMemo(() => countByRole(filteredUsers), [filteredUsers]);
  const total = useMemo(() => countByRole(totalUsers), [totalUsers]);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      <Card>
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">Total Users</p>
          <p className="text-2xl font-bold">
            {filteredUsers.length}
            {isFiltered && (
              <span className="text-sm font-normal text-muted-foreground ml-2">
                / {totalUsers.length}
              </span>
            )}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">Students</p>
          <p className="text-2xl font-bold">
            {filtered.students}
            {isFiltered && (
              <span className="text-sm font-normal text-muted-foreground ml-2">
                / {total.students}
              </span>
            )}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">Mentors</p>
          <p className="text-2xl font-bold">
            {filtered.mentors}
            {isFiltered && (
              <span className="text-sm font-normal text-muted-foreground ml-2">
                / {total.mentors}
              </span>
            )}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">Admins</p>
          <p className="text-2xl font-bold">
            {filtered.admins}
            {isFiltered && (
              <span className="text-sm font-normal text-muted-foreground ml-2">
                / {total.admins}
              </span>
            )}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
