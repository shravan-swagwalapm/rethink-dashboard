'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { MoreVertical, Mail, Pencil, Phone, Trash2, Loader2, UserPen } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import type { Cohort } from '@/types';
import type { UserWithCohort } from '../types';
import { getRoleIcon } from './utils';

interface UserTableProps {
  filteredUsers: UserWithCohort[];
  cohorts: Cohort[];
  activeFilterCount: number;
  onEditRoles: (user: UserWithCohort) => void;
  onEditProfile: (user: UserWithCohort) => void;
  onDeleted: () => void;
}

export function UserTable({ filteredUsers, cohorts, activeFilterCount, onEditRoles, onEditProfile, onDeleted }: UserTableProps) {
  const [deleteUser, setDeleteUser] = useState<UserWithCohort | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!deleteUser) return;

    setDeleting(true);
    try {
      const response = await fetch(`/api/admin/users?id=${deleteUser.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete user');
      }

      toast.success(`${deleteUser.full_name || deleteUser.email} has been deleted`);
      setDeleteUser(null);
      onDeleted();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete user');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
          <CardDescription>
            {filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''}
            {activeFilterCount > 0 && ' matching filters'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => {
                  const assignments = user.role_assignments && user.role_assignments.length > 0
                    ? user.role_assignments
                    : [{ role: user.role, cohort_id: user.cohort_id, cohort: user.cohort }];

                  return (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={user.avatar_url || ''} />
                            <AvatarFallback className="gradient-bg text-white">
                              {user.full_name?.charAt(0) || user.email.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{user.full_name || 'Unnamed'}</p>
                            <p className="text-sm text-muted-foreground">{user.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {user.phone ? (
                          <div className="flex items-center gap-2 text-sm">
                            <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="font-mono">{user.phone}</span>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">&mdash;</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {assignments.map((ra, idx) => {
                            const cohortName = ra.cohort?.name ||
                              cohorts.find(c => c.id === ra.cohort_id)?.name;
                            return (
                              <Badge
                                key={idx}
                                className={
                                  ra.role === 'admin' ? 'bg-red-500/10 text-red-600' :
                                  ra.role === 'company_user' ? 'bg-purple-500/10 text-purple-600' :
                                  ra.role === 'mentor' ? 'bg-blue-500/10 text-blue-600' :
                                  ra.role === 'master' ? 'bg-yellow-500/10 text-yellow-600' :
                                  'bg-green-500/10 text-green-600'
                                }
                              >
                                <span className="flex items-center gap-1">
                                  {getRoleIcon(ra.role)}
                                  <span className="capitalize">
                                    {ra.role === 'master' ? 'Guest' : ra.role.replace('_', ' ')}
                                    {cohortName && ` (${cohortName})`}
                                  </span>
                                </span>
                              </Badge>
                            );
                          })}
                        </div>
                      </TableCell>
                      <TableCell>
                        {format(new Date(user.created_at), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onEditProfile(user)}>
                              <UserPen className="w-4 h-4 mr-2" />
                              Edit Profile
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onEditRoles(user)}>
                              <Pencil className="w-4 h-4 mr-2" />
                              Edit Roles
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <a href={`mailto:${user.email}`}>
                                <Mail className="w-4 h-4 mr-2" />
                                Send Email
                              </a>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-red-600 focus:text-red-600"
                              onClick={() => setDeleteUser(user)}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete User
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteUser} onOpenChange={(open) => { if (!open) setDeleteUser(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Do you really want to delete {deleteUser?.full_name || deleteUser?.email}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Deleting a student will erase all data and history of the student. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {deleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
