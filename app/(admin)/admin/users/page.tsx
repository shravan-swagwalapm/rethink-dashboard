'use client';

import { useEffect, useState, useCallback } from 'react';
import { getClient } from '@/lib/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import {
  Search,
  Users,
  MoreVertical,
  Pencil,
  Trash2,
  Mail,
  Shield,
  UserCheck,
  GraduationCap,
} from 'lucide-react';
import { format } from 'date-fns';
import type { Profile, Cohort } from '@/types';

interface UserWithCohort extends Profile {
  cohort?: Cohort;
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserWithCohort[]>([]);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  const fetchData = useCallback(async () => {
    const supabase = getClient();

    try {
      const [{ data: usersData }, { data: cohortsData }] = await Promise.all([
        supabase
          .from('profiles')
          .select('*, cohort:cohorts(*)')
          .order('created_at', { ascending: false }),
        supabase
          .from('cohorts')
          .select('*')
          .order('name', { ascending: true }),
      ]);

      setUsers(usersData || []);
      setCohorts(cohortsData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRoleChange = async (userId: string, newRole: string) => {
    const supabase = getClient();

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId);

      if (error) throw error;

      toast.success('Role updated');
      fetchData();
    } catch (error) {
      toast.error('Failed to update role');
    }
  };

  const handleCohortChange = async (userId: string, cohortId: string) => {
    const supabase = getClient();

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ cohort_id: cohortId || null })
        .eq('id', userId);

      if (error) throw error;

      toast.success('Cohort updated');
      fetchData();
    } catch (error) {
      toast.error('Failed to update cohort');
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch =
      !searchQuery ||
      user.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesRole = roleFilter === 'all' || user.role === roleFilter;

    return matchesSearch && matchesRole;
  });

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin':
        return <Shield className="w-4 h-4 text-red-500" />;
      case 'company_user':
        return <UserCheck className="w-4 h-4 text-purple-500" />;
      case 'mentor':
        return <GraduationCap className="w-4 h-4 text-blue-500" />;
      default:
        return <Users className="w-4 h-4 text-green-500" />;
    }
  };

  const getRoleBadge = (role: string) => {
    const colors: Record<string, string> = {
      admin: 'bg-red-500/10 text-red-600',
      company_user: 'bg-purple-500/10 text-purple-600',
      mentor: 'bg-blue-500/10 text-blue-600',
      student: 'bg-green-500/10 text-green-600',
    };

    return (
      <Badge className={colors[role] || 'bg-muted'}>
        <span className="flex items-center gap-1">
          {getRoleIcon(role)}
          <span className="capitalize">{role.replace('_', ' ')}</span>
        </span>
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="flex gap-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-32" />
        </div>
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">User Management</h1>
        <p className="text-muted-foreground">
          Manage users, roles, and cohort assignments
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Filter by role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="company_user">Company User</SelectItem>
            <SelectItem value="mentor">Mentor</SelectItem>
            <SelectItem value="student">Student</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total Users</p>
            <p className="text-2xl font-bold">{users.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Students</p>
            <p className="text-2xl font-bold">{users.filter(u => u.role === 'student').length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Mentors</p>
            <p className="text-2xl font-bold">{users.filter(u => u.role === 'mentor').length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Admins</p>
            <p className="text-2xl font-bold">
              {users.filter(u => ['admin', 'company_user'].includes(u.role)).length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
          <CardDescription>
            {filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Cohort</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
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
                      <Select
                        value={user.role}
                        onValueChange={(value) => handleRoleChange(user.id, value)}
                      >
                        <SelectTrigger className="w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="student">Student</SelectItem>
                          <SelectItem value="mentor">Mentor</SelectItem>
                          <SelectItem value="company_user">Company User</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={user.cohort_id || 'none'}
                        onValueChange={(value) => handleCohortChange(user.id, value === 'none' ? '' : value)}
                      >
                        <SelectTrigger className="w-[140px]">
                          <SelectValue placeholder="No cohort" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No cohort</SelectItem>
                          {cohorts.map((cohort) => (
                            <SelectItem key={cohort.id} value={cohort.id}>
                              {cohort.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
                          <DropdownMenuItem asChild>
                            <a href={`mailto:${user.email}`}>
                              <Mail className="w-4 h-4 mr-2" />
                              Send Email
                            </a>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
