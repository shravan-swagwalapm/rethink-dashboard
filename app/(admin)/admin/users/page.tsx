'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { PageLoader } from '@/components/ui/page-loader';
import { toast } from 'sonner';
import { Download, Users } from 'lucide-react';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';
import type { Cohort } from '@/types';
import type { UserWithCohort } from './types';
import { CreateUserDialog } from './components/create-user-dialog';
import { BulkUploadDialog } from './components/bulk-upload-dialog';
import { EditRolesDialog } from './components/edit-roles-dialog';
import { UserFilters, ActiveFilterChips } from './components/user-filters';
import { UserStats } from './components/user-stats';
import { UserTable } from './components/user-table';
import { MotionContainer, MotionItem, MotionFadeIn } from '@/components/ui/motion';
import { PageHeader } from '@/components/ui/page-header';

export default function UsersPage() {
  const [users, setUsers] = useState<UserWithCohort[]>([]);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  const [selectedCohorts, setSelectedCohorts] = useState<string[]>([]);
  const [phoneStatusFilter, setPhoneStatusFilter] = useState<'all' | 'has_phone' | 'no_phone'>('all');
  const [dateRangeFrom, setDateRangeFrom] = useState<Date | undefined>();
  const [dateRangeTo, setDateRangeTo] = useState<Date | undefined>();
  const [multiRoleFilter, setMultiRoleFilter] = useState<'all' | 'single' | 'multiple'>('all');

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserWithCohort | null>(null);

  const hasFetchedRef = useRef(false);

  const fetchData = useCallback(async (force = false) => {
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

  const getActiveFilterCount = () => {
    let count = 0;
    if (roleFilter !== 'all') count++;
    if (selectedCohorts.length > 0) count++;
    if (phoneStatusFilter !== 'all') count++;
    if (dateRangeFrom || dateRangeTo) count++;
    if (multiRoleFilter !== 'all') count++;
    return count;
  };

  const clearAllFilters = () => {
    setSearchQuery('');
    setRoleFilter('all');
    setSelectedCohorts([]);
    setPhoneStatusFilter('all');
    setDateRangeFrom(undefined);
    setDateRangeTo(undefined);
    setMultiRoleFilter('all');
  };

  const filteredUsers = useMemo(() => users.filter(user => {
    const matchesSearch = !searchQuery || (() => {
      const query = searchQuery.toLowerCase();
      return (
        user.full_name?.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query) ||
        user.phone?.toLowerCase().includes(query)
      );
    })();

    // Combined role + cohort filter: validates that role and cohort match
    // the SAME role_assignment row, not independently
    const matchesRoleAndCohort = (() => {
      const hasRoleFilter = roleFilter !== 'all';
      const hasCohortFilter = selectedCohorts.length > 0;

      if (!hasRoleFilter && !hasCohortFilter) return true;

      const assignments = user.role_assignments ?? [];
      const cohortIds = selectedCohorts.filter(id => id !== 'no_cohort');
      const wantsNoCohort = selectedCohorts.includes('no_cohort');

      // Both filters active: role AND cohort must match the same assignment
      if (hasRoleFilter && hasCohortFilter) {
        if (assignments.length > 0) {
          return assignments.some(ra =>
            ra.role === roleFilter &&
            (cohortIds.includes(ra.cohort_id as string) || (wantsNoCohort && !ra.cohort_id))
          );
        }
        // Legacy fallback: no role_assignments
        return user.role === roleFilter &&
          (cohortIds.includes(user.cohort_id as string) || (wantsNoCohort && !user.cohort_id));
      }

      // Role filter only: user has any assignment with that role
      if (hasRoleFilter) {
        if (assignments.length > 0) {
          return assignments.some(ra => ra.role === roleFilter);
        }
        return user.role === roleFilter;
      }

      // Cohort filter only: user has any assignment in that cohort
      if (hasCohortFilter) {
        if (assignments.length > 0) {
          return assignments.some(ra =>
            cohortIds.includes(ra.cohort_id as string) || (wantsNoCohort && !ra.cohort_id)
          );
        }
        return cohortIds.includes(user.cohort_id as string) || (wantsNoCohort && !user.cohort_id);
      }

      return true;
    })();

    const matchesPhoneStatus = (() => {
      if (phoneStatusFilter === 'all') return true;
      if (phoneStatusFilter === 'has_phone') return !!user.phone;
      if (phoneStatusFilter === 'no_phone') return !user.phone;
      return true;
    })();

    const matchesDateRange = (() => {
      if (!dateRangeFrom && !dateRangeTo) return true;
      const userDate = new Date(user.created_at);

      if (dateRangeFrom && userDate < dateRangeFrom) return false;
      if (dateRangeTo && userDate > dateRangeTo) return false;

      return true;
    })();

    const matchesMultiRole = (() => {
      if (multiRoleFilter === 'all') return true;
      const roleCount = user.role_assignments?.length || 1;
      if (multiRoleFilter === 'single') return roleCount === 1;
      if (multiRoleFilter === 'multiple') return roleCount > 1;
      return true;
    })();

    return matchesSearch && matchesRoleAndCohort &&
           matchesPhoneStatus && matchesDateRange && matchesMultiRole;
  }), [users, searchQuery, roleFilter, selectedCohorts, phoneStatusFilter, dateRangeFrom, dateRangeTo, multiRoleFilter]);

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

  const handleEditRoles = (user: UserWithCohort) => {
    setEditingUser(user);
    setEditDialogOpen(true);
  };

  const activeFilterCount = getActiveFilterCount();

  const filterProps = {
    searchQuery,
    onSearchChange: setSearchQuery,
    roleFilter,
    onRoleFilterChange: setRoleFilter,
    selectedCohorts,
    onSelectedCohortsChange: setSelectedCohorts,
    phoneStatusFilter,
    onPhoneStatusFilterChange: setPhoneStatusFilter,
    dateRangeFrom,
    onDateRangeFromChange: setDateRangeFrom,
    dateRangeTo,
    onDateRangeToChange: setDateRangeTo,
    multiRoleFilter,
    onMultiRoleFilterChange: setMultiRoleFilter,
    cohorts,
    activeFilterCount,
    onClearAll: clearAllFilters,
  };

  if (loading) {
    return <PageLoader message="Loading users..." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Users}
        title="User Management"
        description="Manage students, mentors, and administrators"
        action={
          <div className="flex items-center gap-2">
            <BulkUploadDialog onCreated={() => fetchData(true)} />
            <Button
              variant="outline"
              onClick={handleExportFiltered}
            >
              <Download className="w-4 h-4 mr-2" />
              Export ({filteredUsers.length})
            </Button>
            <CreateUserDialog cohorts={cohorts} onCreated={() => fetchData(true)} />
          </div>
        }
      />

      <EditRolesDialog
        user={editingUser}
        cohorts={cohorts}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSaved={() => fetchData(true)}
      />

      <MotionFadeIn delay={0.1}>
        <UserFilters {...filterProps} />

        <ActiveFilterChips {...filterProps} />
      </MotionFadeIn>

      <MotionFadeIn delay={0.2}>
        <UserStats filteredUsers={filteredUsers} totalUsers={users} />

        <UserTable
          filteredUsers={filteredUsers}
          cohorts={cohorts}
          activeFilterCount={activeFilterCount}
          onEditRoles={handleEditRoles}
          onDeleted={() => fetchData(true)}
        />
      </MotionFadeIn>
    </div>
  );
}
