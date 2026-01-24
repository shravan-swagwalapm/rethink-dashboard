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
  Plus,
  Trash2,
  Star,
  Pencil,
} from 'lucide-react';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';
import type { Profile, Cohort, UserRoleAssignment } from '@/types';

interface UserWithCohort extends Profile {
  cohort?: Cohort;
  role_assignments?: UserRoleAssignment[];
}

interface RoleAssignmentInput {
  role: string;
  cohort_id: string | null;
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
  const [roleAssignments, setRoleAssignments] = useState<RoleAssignmentInput[]>([
    { role: 'student', cohort_id: null }
  ]);

  // Bulk upload state
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkUsers, setBulkUsers] = useState<BulkUser[]>([]);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkResults, setBulkResults] = useState<BulkResult[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasFetchedRef = useRef(false);

  // Edit user dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserWithCohort | null>(null);
  const [editRoleAssignments, setEditRoleAssignments] = useState<RoleAssignmentInput[]>([]);
  const [editLoading, setEditLoading] = useState(false);

  const fetchData = useCallback(async (force = false) => {
    // Prevent re-fetching on tab switch unless forced
    if (hasFetchedRef.current && !force) return;
    hasFetchedRef.current = true;

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
      fetchData(true);
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
      fetchData(true);
    } catch (error) {
      toast.error('Failed to update cohort');
    }
  };

  // Create single user
  const handleCreateUser = async () => {
    if (!newUserEmail) {
      toast.error('Email is required');
      return;
    }

    // Validate role assignments
    const validAssignments = roleAssignments.filter(ra => ra.role);
    if (validAssignments.length === 0) {
      toast.error('At least one role is required');
      return;
    }

    // Check if non-master/admin roles have cohorts
    const needsCohort = validAssignments.some(ra =>
      ['student', 'mentor'].includes(ra.role) && !ra.cohort_id
    );
    if (needsCohort) {
      toast.error('Student and Mentor roles require a cohort');
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
          role_assignments: validAssignments,
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
      setRoleAssignments([{ role: 'student', cohort_id: null }]);
      fetchData(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create user');
    } finally {
      setCreateLoading(false);
    }
  };

  // Role assignment helpers
  const addRoleAssignment = () => {
    setRoleAssignments([...roleAssignments, { role: 'student', cohort_id: null }]);
  };

  const removeRoleAssignment = (index: number) => {
    if (roleAssignments.length > 1) {
      setRoleAssignments(roleAssignments.filter((_, i) => i !== index));
    }
  };

  const updateRoleAssignment = (index: number, field: 'role' | 'cohort_id', value: string | null) => {
    const updated = [...roleAssignments];
    updated[index] = { ...updated[index], [field]: value };
    // Clear cohort if role doesn't need it
    if (field === 'role' && ['admin', 'company_user', 'master'].includes(value as string)) {
      updated[index].cohort_id = null;
    }
    setRoleAssignments(updated);
  };

  // Get available cohorts for a role (mentor cannot be in same cohort as student)
  const getAvailableCohortsForRole = (role: string, assignments: RoleAssignmentInput[]) => {
    if (role === 'mentor') {
      // Get cohorts where user is a student
      const studentCohorts = assignments
        .filter(a => a.role === 'student' && a.cohort_id)
        .map(a => a.cohort_id);
      // Filter out those cohorts for mentor selection
      return cohorts.filter(c => !studentCohorts.includes(c.id));
    }
    return cohorts;
  };

  // Edit user handlers
  const handleEditRoles = (user: UserWithCohort) => {
    setEditingUser(user);
    // Convert user's role_assignments to input format, or fall back to legacy single role
    if (user.role_assignments && user.role_assignments.length > 0) {
      setEditRoleAssignments(user.role_assignments.map(ra => ({
        role: ra.role,
        cohort_id: ra.cohort_id,
      })));
    } else {
      // Fall back to legacy single role/cohort
      setEditRoleAssignments([{
        role: user.role,
        cohort_id: user.cohort_id,
      }]);
    }
    setEditDialogOpen(true);
  };

  const handleSaveRoles = async () => {
    if (!editingUser) return;

    const validAssignments = editRoleAssignments.filter(ra => ra.role);
    if (validAssignments.length === 0) {
      toast.error('At least one role is required');
      return;
    }

    // Check if student/mentor roles have cohorts
    const needsCohort = validAssignments.some(ra =>
      ['student', 'mentor'].includes(ra.role) && !ra.cohort_id
    );
    if (needsCohort) {
      toast.error('Student and Mentor roles require a cohort');
      return;
    }

    setEditLoading(true);
    try {
      const response = await fetch('/api/admin/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingUser.id,
          role_assignments: validAssignments,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update roles');
      }

      toast.success('Roles updated successfully');
      setEditDialogOpen(false);
      setEditingUser(null);
      fetchData(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update roles');
    } finally {
      setEditLoading(false);
    }
  };

  const addEditRoleAssignment = () => {
    setEditRoleAssignments([...editRoleAssignments, { role: 'student', cohort_id: null }]);
  };

  const removeEditRoleAssignment = (index: number) => {
    if (editRoleAssignments.length > 1) {
      setEditRoleAssignments(editRoleAssignments.filter((_, i) => i !== index));
    }
  };

  const updateEditRoleAssignment = (index: number, field: 'role' | 'cohort_id', value: string | null) => {
    const updated = [...editRoleAssignments];
    updated[index] = { ...updated[index], [field]: value };
    // Clear cohort if role doesn't need it
    if (field === 'role' && ['admin', 'company_user', 'master'].includes(value as string)) {
      updated[index].cohort_id = null;
    }
    setEditRoleAssignments(updated);
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
      fetchData(true);
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
      case 'master':
        return <Star className="w-4 h-4 text-yellow-500" />;
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
      master: 'bg-yellow-500/10 text-yellow-600',
    };

    return (
      <Badge className={colors[role] || 'bg-muted'}>
        <span className="flex items-center gap-1">
          {getRoleIcon(role)}
          <span className="capitalize">{role === 'master' ? 'Guest' : role.replace('_', ' ')}</span>
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
            <DialogContent className="max-w-lg">
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

                {/* Role Assignments */}
                <div className="space-y-3">
                  <Label>Role Assignments *</Label>
                  <div className="space-y-2">
                    {roleAssignments.map((assignment, index) => {
                      const availableCohorts = getAvailableCohortsForRole(assignment.role, roleAssignments);
                      const showCohortWarning = assignment.role === 'mentor' && availableCohorts.length < cohorts.length;

                      return (
                        <div key={index} className="space-y-1">
                          <div className="flex gap-2 items-start">
                            <Select
                              value={assignment.role}
                              onValueChange={(value) => updateRoleAssignment(index, 'role', value)}
                            >
                              <SelectTrigger className="w-[140px]">
                                <SelectValue placeholder="Role" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="student">Student</SelectItem>
                                <SelectItem value="mentor">Mentor</SelectItem>
                                <SelectItem value="master">Guest</SelectItem>
                                <SelectItem value="company_user">Company User</SelectItem>
                                <SelectItem value="admin">Admin</SelectItem>
                              </SelectContent>
                            </Select>

                            {['student', 'mentor', 'master'].includes(assignment.role) ? (
                              <Select
                                value={assignment.cohort_id || ''}
                                onValueChange={(value) => updateRoleAssignment(index, 'cohort_id', value || null)}
                              >
                                <SelectTrigger className="flex-1">
                                  <SelectValue placeholder={assignment.role === 'master' ? 'No cohort (optional)' : 'Select cohort'} />
                                </SelectTrigger>
                                <SelectContent>
                                  {assignment.role === 'master' && (
                                    <SelectItem value="">No cohort</SelectItem>
                                  )}
                                  {availableCohorts.map((cohort) => (
                                    <SelectItem key={cohort.id} value={cohort.id}>
                                      {cohort.name} ({cohort.tag})
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <div className="flex-1 px-3 py-2 text-sm text-muted-foreground border rounded-md bg-muted/50">
                                No cohort needed
                              </div>
                            )}

                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeRoleAssignment(index)}
                              disabled={roleAssignments.length === 1}
                              className="shrink-0"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                          {showCohortWarning && (
                            <p className="text-xs text-amber-500 ml-1">
                              Some cohorts hidden (user is a student there)
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addRoleAssignment}
                    className="w-full"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Another Role
                  </Button>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateUser}
                  disabled={createLoading || !newUserEmail || roleAssignments.length === 0}
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

      {/* Edit Roles Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Roles</DialogTitle>
            <DialogDescription>
              {editingUser && `Manage role assignments for ${editingUser.full_name || editingUser.email}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-3">
              <Label>Role Assignments</Label>
              <div className="space-y-2">
                {editRoleAssignments.map((assignment, index) => {
                  const availableCohorts = getAvailableCohortsForRole(assignment.role, editRoleAssignments);
                  const showCohortWarning = assignment.role === 'mentor' && availableCohorts.length < cohorts.length;

                  return (
                    <div key={index} className="space-y-1">
                      <div className="flex gap-2 items-start">
                        <Select
                          value={assignment.role}
                          onValueChange={(value) => updateEditRoleAssignment(index, 'role', value)}
                        >
                          <SelectTrigger className="w-[140px]">
                            <SelectValue placeholder="Role" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="student">Student</SelectItem>
                            <SelectItem value="mentor">Mentor</SelectItem>
                            <SelectItem value="master">Guest</SelectItem>
                            <SelectItem value="company_user">Company User</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>

                        {['student', 'mentor', 'master'].includes(assignment.role) ? (
                          <Select
                            value={assignment.cohort_id || ''}
                            onValueChange={(value) => updateEditRoleAssignment(index, 'cohort_id', value || null)}
                          >
                            <SelectTrigger className="flex-1">
                              <SelectValue placeholder={assignment.role === 'master' ? 'No cohort (optional)' : 'Select cohort'} />
                            </SelectTrigger>
                            <SelectContent>
                              {assignment.role === 'master' && (
                                <SelectItem value="">No cohort</SelectItem>
                              )}
                              {availableCohorts.map((cohort) => (
                                <SelectItem key={cohort.id} value={cohort.id}>
                                  {cohort.name} ({cohort.tag})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <div className="flex-1 px-3 py-2 text-sm text-muted-foreground border rounded-md bg-muted/50">
                            No cohort needed
                          </div>
                        )}

                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeEditRoleAssignment(index)}
                          disabled={editRoleAssignments.length === 1}
                          className="shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                      {showCohortWarning && (
                        <p className="text-xs text-amber-500 ml-1">
                          Some cohorts hidden (user is a student there)
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addEditRoleAssignment}
                className="w-full"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Another Role
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveRoles}
              disabled={editLoading || editRoleAssignments.length === 0}
              className="gradient-bg"
            >
              {editLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Roles'
              )}
            </Button>
          </DialogFooter>
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
            <SelectItem value="master">Guest</SelectItem>
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
                  <TableHead>Roles</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => {
                  // Get role assignments to display
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
                            <DropdownMenuItem onClick={() => handleEditRoles(user)}>
                              <Pencil className="w-4 h-4 mr-2" />
                              Edit Roles
                            </DropdownMenuItem>
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
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
