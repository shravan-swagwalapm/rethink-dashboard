'use client';

import { Card, CardContent } from '@/components/ui/card';
import type { UserWithCohort } from '../types';

interface UserStatsProps {
  filteredUsers: UserWithCohort[];
  totalUsers: UserWithCohort[];
}

export function UserStats({ filteredUsers, totalUsers }: UserStatsProps) {
  const isFiltered = filteredUsers.length !== totalUsers.length;

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
            {filteredUsers.filter(u => u.role === 'student').length}
            {isFiltered && (
              <span className="text-sm font-normal text-muted-foreground ml-2">
                / {totalUsers.filter(u => u.role === 'student').length}
              </span>
            )}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">Mentors</p>
          <p className="text-2xl font-bold">
            {filteredUsers.filter(u => u.role === 'mentor').length}
            {isFiltered && (
              <span className="text-sm font-normal text-muted-foreground ml-2">
                / {totalUsers.filter(u => u.role === 'mentor').length}
              </span>
            )}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">Admins</p>
          <p className="text-2xl font-bold">
            {filteredUsers.filter(u => ['admin', 'company_user'].includes(u.role)).length}
            {isFiltered && (
              <span className="text-sm font-normal text-muted-foreground ml-2">
                / {totalUsers.filter(u => ['admin', 'company_user'].includes(u.role)).length}
              </span>
            )}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
