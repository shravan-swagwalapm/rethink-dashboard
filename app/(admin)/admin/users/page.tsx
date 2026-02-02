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
  Phone,
  X,
  Download,
  Filter,
  Calendar as CalendarIcon,
} from 'lucide-react';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
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

  // NEW: Advanced filter state
  const [selectedCohorts, setSelectedCohorts] = useState<string[]>([]);
  const [phoneStatusFilter, setPhoneStatusFilter] = useState<'all' | 'has_phone' | 'no_phone'>('all');
  const [dateRangeFrom, setDateRangeFrom] = useState<Date | undefined>();
  const [dateRangeTo, setDateRangeTo] = useState<Date | undefined>();
  const [multiRoleFilter, setMultiRoleFilter] = useState<'all' | 'single' | 'multiple'>('all');
  const [showFilters, setShowFilters] = useState(false);

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

  // Download bulk upload template
  const downloadTemplate = () => {
    // Create sample data with headers and example rows
    const templateData = [
      { 'Email': 'john.doe@example.com', 'Full Name': 'John Doe', 'Cohort Tag': 'BATCH2025' },
      { 'Email': 'jane.smith@example.com', 'Full Name': 'Jane Smith', 'Cohort Tag': 'BATCH2025' },
      { 'Email': 'user@company.com', 'Full Name': 'User Name', 'Cohort Tag': 'BATCH2025' },
    ];

    // Create workbook and worksheet
    const ws = XLSX.utils.json_to_sheet(templateData);

    // Set column widths for better readability
    ws['!cols'] = [
      { wch: 30 }, // Email
      { wch: 25 }, // Full Name
      { wch: 15 }, // Cohort Tag
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Users');

    // Download the file
    XLSX.writeFile(wb, 'bulk_users_template.xlsx');

    toast.success('Template downloaded! Fill in your user data and upload.');
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

  // Helper: Get active filter count
  const getActiveFilterCount = () => {
    let count = 0;
    if (roleFilter !== 'all') count++;
    if (selectedCohorts.length > 0) count++;
    if (phoneStatusFilter !== 'all') count++;
    if (dateRangeFrom || dateRangeTo) count++;
    if (multiRoleFilter !== 'all') count++;
    return count;
  };

  // Helper: Clear all filters
  const clearAllFilters = () => {
    setSearchQuery('');
    setRoleFilter('all');
    setSelectedCohorts([]);
    setPhoneStatusFilter('all');
    setDateRangeFrom(undefined);
    setDateRangeTo(undefined);
    setMultiRoleFilter('all');
  };

  // Helper: Export filtered users to Excel
  const handleExportFiltered = () => {
    const exportData = filteredUsers.map(user => ({
      'Name': user.full_name || 'Unnamed',
      'Email': user.email,
      'Phone': user.phone || 'N/A',
      'Role': user.role,
      'Cohort': user.cohort?.name || 'No Cohort',
      'Joined': format(new Date(user.created_at), 'yyyy-MM-dd'),
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Filtered Users');

    XLSX.writeFile(wb, `users_filtered_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);

    toast.success(`Exported ${filteredUsers.length} users`);
  };

  // Enhanced filtering logic
  const filteredUsers = users.filter(user => {
    // 1. Search filter (name, email, phone)
    const matchesSearch = !searchQuery || (() => {
      const query = searchQuery.toLowerCase();
      return (
        user.full_name?.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query) ||
        user.phone?.toLowerCase().includes(query)
      );
    })();

    // 2. Role filter (existing)
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;

    // 3. Cohort filter (multi-select)
    const matchesCohort = selectedCohorts.length === 0 || (() => {
      // Check if user has ANY of the selected cohorts
      if (selectedCohorts.includes('no_cohort')) {
        // Include users with no cohort
        if (!user.cohort_id) return true;
      }
      // Check role assignments for cohort matches
      const userCohortIds = user.role_assignments
        ?.map(ra => ra.cohort_id)
        .filter(Boolean) || [user.cohort_id].filter(Boolean);

      return userCohortIds.some(cohortId => selectedCohorts.includes(cohortId as string));
    })();

    // 4. Phone status filter
    const matchesPhoneStatus = (() => {
      if (phoneStatusFilter === 'all') return true;
      if (phoneStatusFilter === 'has_phone') return !!user.phone;
      if (phoneStatusFilter === 'no_phone') return !user.phone;
      return true;
    })();

    // 5. Registration date filter
    const matchesDateRange = (() => {
      if (!dateRangeFrom && !dateRangeTo) return true;
      const userDate = new Date(user.created_at);

      if (dateRangeFrom && userDate < dateRangeFrom) return false;
      if (dateRangeTo && userDate > dateRangeTo) return false;

      return true;
    })();

    // 6. Multi-role filter
    const matchesMultiRole = (() => {
      if (multiRoleFilter === 'all') return true;
      const roleCount = user.role_assignments?.length || 1;
      if (multiRoleFilter === 'single') return roleCount === 1;
      if (multiRoleFilter === 'multiple') return roleCount > 1;
      return true;
    })();

    return matchesSearch && matchesRole && matchesCohort &&
           matchesPhoneStatus && matchesDateRange && matchesMultiRole;
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
          {/* Download Template */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={downloadTemplate}
                >
                  <FileSpreadsheet className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Download bulk upload template</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

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

          {/* Export Filtered Users */}
          <Button
            variant="outline"
            onClick={handleExportFiltered}
          >
            <Download className="w-4 h-4 mr-2" />
            Export ({filteredUsers.length})
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

      {/* Enhanced Filter Panel */}
      <Card className="border-dashed">
        <CardContent className="p-4">
          {/* Collapsed state */}
          {!showFilters && (
            <div className="flex items-center justify-between gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email, or phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button
                variant="outline"
                onClick={() => setShowFilters(true)}
              >
                <Filter className="w-4 h-4 mr-2" />
                Filters
                {getActiveFilterCount() > 0 && (
                  <Badge variant="secondary" className="ml-2 px-1.5 py-0.5 text-xs">
                    {getActiveFilterCount()}
                  </Badge>
                )}
              </Button>
            </div>
          )}

          {/* Expanded state */}
          {showFilters && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">Advanced Filters</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowFilters(false)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {/* Search (always visible) */}
              <div className="space-y-2">
                <Label>Search</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Name, email, or phone..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Rest of filters in grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Role filter */}
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select value={roleFilter} onValueChange={setRoleFilter}>
                    <SelectTrigger>
                      <SelectValue />
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

                {/* Phone Status filter */}
                <div className="space-y-2">
                  <Label>Phone Status</Label>
                  <Select value={phoneStatusFilter} onValueChange={(value) => setPhoneStatusFilter(value as 'all' | 'has_phone' | 'no_phone')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Users</SelectItem>
                      <SelectItem value="has_phone">Has Phone Number</SelectItem>
                      <SelectItem value="no_phone">Missing Phone Number</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Multi-role filter */}
                <div className="space-y-2">
                  <Label>Role Count</Label>
                  <Select value={multiRoleFilter} onValueChange={(value) => setMultiRoleFilter(value as 'all' | 'single' | 'multiple')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Users</SelectItem>
                      <SelectItem value="single">Single Role Only</SelectItem>
                      <SelectItem value="multiple">Multiple Roles</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Cohort multi-select */}
              <div className="space-y-2">
                <Label>Cohorts (Multi-select)</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 border rounded-lg bg-muted/30 max-h-48 overflow-y-auto">
                  {cohorts.map((cohort) => (
                    <div key={cohort.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`cohort-${cohort.id}`}
                        checked={selectedCohorts.includes(cohort.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedCohorts([...selectedCohorts, cohort.id]);
                          } else {
                            setSelectedCohorts(selectedCohorts.filter(id => id !== cohort.id));
                          }
                        }}
                      />
                      <label
                        htmlFor={`cohort-${cohort.id}`}
                        className="text-sm cursor-pointer flex-1"
                      >
                        {cohort.name} ({cohort.tag})
                      </label>
                    </div>
                  ))}
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="cohort-none"
                      checked={selectedCohorts.includes('no_cohort')}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedCohorts([...selectedCohorts, 'no_cohort']);
                        } else {
                          setSelectedCohorts(selectedCohorts.filter(id => id !== 'no_cohort'));
                        }
                      }}
                    />
                    <label htmlFor="cohort-none" className="text-sm cursor-pointer flex-1">
                      No Cohort Assigned
                    </label>
                  </div>
                </div>
              </div>

              {/* Date range picker */}
              <div className="space-y-2">
                <Label>Registration Date</Label>
                <div className="flex gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "flex-1 justify-start text-left font-normal",
                          !dateRangeFrom && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateRangeFrom ? format(dateRangeFrom, "MMM d, yyyy") : "From date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={dateRangeFrom}
                        onSelect={setDateRangeFrom}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>

                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "flex-1 justify-start text-left font-normal",
                          !dateRangeTo && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateRangeTo ? format(dateRangeTo, "MMM d, yyyy") : "To date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={dateRangeTo}
                        onSelect={setDateRangeTo}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex justify-between pt-2">
                <Button variant="outline" onClick={clearAllFilters}>
                  Clear All Filters
                </Button>
                <Button onClick={() => setShowFilters(false)} className="gradient-bg">
                  Apply Filters
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Active Filter Chips */}
      {getActiveFilterCount() > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-sm text-muted-foreground">Active Filters:</span>

          {roleFilter !== 'all' && (
            <Badge variant="secondary" className="gap-1">
              Role: {roleFilter === 'master' ? 'Guest' : roleFilter.replace('_', ' ')}
              <X className="w-3 h-3 cursor-pointer" onClick={() => setRoleFilter('all')} />
            </Badge>
          )}

          {selectedCohorts.map(cohortId => (
            <Badge key={cohortId} variant="secondary" className="gap-1">
              {cohortId === 'no_cohort' ? 'No Cohort' : cohorts.find(c => c.id === cohortId)?.name}
              <X className="w-3 h-3 cursor-pointer"
                 onClick={() => setSelectedCohorts(prev => prev.filter(id => id !== cohortId))} />
            </Badge>
          ))}

          {phoneStatusFilter !== 'all' && (
            <Badge variant="secondary" className="gap-1">
              {phoneStatusFilter === 'has_phone' ? 'Has Phone' : 'Missing Phone'}
              <X className="w-3 h-3 cursor-pointer" onClick={() => setPhoneStatusFilter('all')} />
            </Badge>
          )}

          {(dateRangeFrom || dateRangeTo) && (
            <Badge variant="secondary" className="gap-1">
              Date: {dateRangeFrom ? format(dateRangeFrom, 'MMM d') : '...'} -
              {dateRangeTo ? format(dateRangeTo, 'MMM d, yyyy') : '...'}
              <X className="w-3 h-3 cursor-pointer"
                 onClick={() => { setDateRangeFrom(undefined); setDateRangeTo(undefined); }} />
            </Badge>
          )}

          {multiRoleFilter !== 'all' && (
            <Badge variant="secondary" className="gap-1">
              {multiRoleFilter === 'single' ? 'Single Role' : 'Multiple Roles'}
              <X className="w-3 h-3 cursor-pointer" onClick={() => setMultiRoleFilter('all')} />
            </Badge>
          )}

          <Button variant="ghost" size="sm" onClick={clearAllFilters}>
            Clear All
          </Button>
        </div>
      )}

      {/* Stats - Updated to show filtered counts */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total Users</p>
            <p className="text-2xl font-bold">
              {filteredUsers.length}
              {filteredUsers.length !== users.length && (
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  / {users.length}
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
              {filteredUsers.length !== users.length && (
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  / {users.filter(u => u.role === 'student').length}
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
              {filteredUsers.length !== users.length && (
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  / {users.filter(u => u.role === 'mentor').length}
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
              {filteredUsers.length !== users.length && (
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  / {users.filter(u => ['admin', 'company_user'].includes(u.role)).length}
                </span>
              )}
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
            {getActiveFilterCount() > 0 && ' matching filters'}
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
                        {user.phone ? (
                          <div className="flex items-center gap-2 text-sm">
                            <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="font-mono">{user.phone}</span>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
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
