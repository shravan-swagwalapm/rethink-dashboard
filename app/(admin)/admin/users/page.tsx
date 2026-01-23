'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { PageLoader } from '@/components/ui/page-loader';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Search,
  Users,
  MoreVertical,
  Mail,
  Shield,
  UserCheck,
  GraduationCap,
  UserPlus,
  Upload,
  Loader2,
  FileSpreadsheet,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';
import type { Profile, Cohort } from '@/types';

interface UserWithCohort extends Profile {
  cohort?: Cohort;
}

interface BulkUser {
  email: string;
  full_name: string;
  cohort_tag: string;
}

interface BulkResult {
  email: string;
  success: boolean;
  error?: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserWithCohort[]>([]);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  // Create user dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserCohort, setNewUserCohort] = useState('');

  // Bulk upload state
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkUsers, setBulkUsers] = useState<BulkUser[]>([]);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkResults, setBulkResults] = useState<BulkResult[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchData = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/users');
      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }
      const data = await response.json();
      setUsers(data.users || []);
      setCohorts(data.cohorts || []);
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
    try {
      const response = await fetch('/api/admin/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: userId, role: newRole }),
      });

      if (!response.ok) throw new Error('Failed to update role');

      toast.success('Role updated');
      fetchData();
    } catch (error) {
      toast.error('Failed to update role');
    }
  };

  const handleCohortChange = async (userId: string, cohortId: string) => {
    try {
      const response = await fetch('/api/admin/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: userId, cohort_id: cohortId || null }),
      });

      if (!response.ok) throw new Error('Failed to update cohort');

      toast.success('Cohort updated');
      fetchData();
    } catch (error) {
      toast.error('Failed to update cohort');
    }
  };

  // Create single user
  const handleCreateUser = async () => {
    if (!newUserEmail || !newUserCohort) {
      toast.error('Email and cohort are required');
      return;
    }

    setCreateLoading(true);
    try {
      const response = await fetch('/api/admin/users/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: newUserEmail,
          full_name: newUserName,
          cohort_id: newUserCohort,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create user');
      }

      toast.success('User created successfully! They can now login via email OTP.');
      setCreateDialogOpen(false);
      setNewUserEmail('');
      setNewUserName('');
      setNewUserCohort('');
      fetchData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create user');
    } finally {
      setCreateLoading(false);
    }
  };

  // Handle file upload for bulk import
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet) as Record<string, string>[];

        const parsedUsers: BulkUser[] = jsonData.map((row) => ({
          email: (row['Email'] || row['email'] || '').trim(),
          full_name: (row['Name'] || row['Full Name'] || row['full_name'] || '').trim(),
          cohort_tag: (row['Cohort'] || row['Cohort Tag'] || row['cohort_tag'] || '').trim(),
        })).filter(u => u.email); // Filter out empty rows

        setBulkUsers(parsedUsers);
        setBulkResults(null);
        setBulkDialogOpen(true);
      } catch (error) {
        toast.error('Failed to parse file. Please use a valid Excel or CSV file.');
      }
    };
    reader.readAsArrayBuffer(file);

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Bulk create users
  const handleBulkCreate = async () => {
    if (bulkUsers.length === 0) return;

    setBulkLoading(true);
    try {
      const response = await fetch('/api/admin/users/bulk-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ users: bulkUsers }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create users');
      }

      setBulkResults(data.results);
      toast.success(data.message);
      fetchData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create users');
    } finally {
      setBulkLoading(false);
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
    return <PageLoader message="Loading users..." />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">User Management</h1>
          <p className="text-muted-foreground">
            Manage users, roles, and cohort assignments
          </p>
        </div>
        <div className="flex gap-2">
          {/* Bulk Upload */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileUpload}
            className="hidden"
          />
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="w-4 h-4 mr-2" />
            Bulk Upload
          </Button>

          {/* Create User Dialog */}
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gradient-bg">
                <UserPlus className="w-4 h-4 mr-2" />
                Create User
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New User</DialogTitle>
                <DialogDescription>
                  Add a new user to the system. They will be able to login via email OTP.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="user@example.com"
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    placeholder="John Doe"
                    value={newUserName}
                    onChange={(e) => setNewUserName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cohort">Cohort *</Label>
                  <Select value={newUserCohort} onValueChange={setNewUserCohort}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a cohort" />
                    </SelectTrigger>
                    <SelectContent>
                      {cohorts.map((cohort) => (
                        <SelectItem key={cohort.id} value={cohort.id}>
                          {cohort.name} ({cohort.tag})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateUser}
                  disabled={createLoading || !newUserEmail || !newUserCohort}
                  className="gradient-bg"
                >
                  {createLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create User'
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Bulk Upload Dialog */}
      <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Bulk User Upload</DialogTitle>
            <DialogDescription>
              Review the users to be created. Ensure each user has a valid email and cohort tag.
            </DialogDescription>
          </DialogHeader>

          {!bulkResults ? (
            <>
              <div className="max-h-64 overflow-auto border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Cohort Tag</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bulkUsers.map((user, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-mono text-sm">{user.email}</TableCell>
                        <TableCell>{user.full_name || '-'}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{user.cohort_tag}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <p className="text-sm text-muted-foreground">
                {bulkUsers.length} user{bulkUsers.length !== 1 ? 's' : ''} to create
              </p>
              <DialogFooter>
                <Button variant="outline" onClick={() => setBulkDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleBulkCreate}
                  disabled={bulkLoading || bulkUsers.length === 0}
                  className="gradient-bg"
                >
                  {bulkLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    `Create ${bulkUsers.length} Users`
                  )}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <div className="max-h-64 overflow-auto border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bulkResults.map((result, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-mono text-sm">{result.email}</TableCell>
                        <TableCell>
                          {result.success ? (
                            <span className="flex items-center text-green-600">
                              <CheckCircle className="w-4 h-4 mr-1" />
                              Created
                            </span>
                          ) : (
                            <span className="flex items-center text-red-600">
                              <XCircle className="w-4 h-4 mr-1" />
                              {result.error}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex gap-4 text-sm">
                <span className="text-green-600">
                  {bulkResults.filter(r => r.success).length} created
                </span>
                <span className="text-red-600">
                  {bulkResults.filter(r => !r.success).length} failed
                </span>
              </div>
              <DialogFooter>
                <Button onClick={() => {
                  setBulkDialogOpen(false);
                  setBulkUsers([]);
                  setBulkResults(null);
                }}>
                  Done
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

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
