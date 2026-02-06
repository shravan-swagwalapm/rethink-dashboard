'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import type { Cohort } from '@/types';
import type { UserWithCohort, RoleAssignmentInput } from '../types';
import { RoleAssignmentEditor } from './role-assignment-editor';

interface EditRolesDialogProps {
  user: UserWithCohort | null;
  cohorts: Cohort[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export function EditRolesDialog({ user, cohorts, open, onOpenChange, onSaved }: EditRolesDialogProps) {
  const [roleAssignments, setRoleAssignments] = useState<RoleAssignmentInput[]>([]);
  const [loading, setLoading] = useState(false);

  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen && user) {
      if (user.role_assignments && user.role_assignments.length > 0) {
        setRoleAssignments(user.role_assignments.map(ra => ({
          role: ra.role,
          cohort_id: ra.cohort_id,
        })));
      } else {
        setRoleAssignments([{
          role: user.role,
          cohort_id: user.cohort_id,
        }]);
      }
    }
    onOpenChange(newOpen);
  };

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
    if (field === 'role' && ['admin', 'company_user', 'master'].includes(value as string)) {
      updated[index].cohort_id = null;
    }
    setRoleAssignments(updated);
  };

  const handleSave = async () => {
    if (!user) return;

    const validAssignments = roleAssignments.filter(ra => ra.role);
    if (validAssignments.length === 0) {
      toast.error('At least one role is required');
      return;
    }

    const needsCohort = validAssignments.some(ra =>
      ['student', 'mentor'].includes(ra.role) && !ra.cohort_id
    );
    if (needsCohort) {
      toast.error('Student and Mentor roles require a cohort');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/admin/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: user.id,
          role_assignments: validAssignments,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update roles');
      }

      toast.success('Roles updated successfully');
      onOpenChange(false);
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update roles');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Roles</DialogTitle>
          <DialogDescription>
            {user && `Manage role assignments for ${user.full_name || user.email}`}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-3">
            <Label>Role Assignments</Label>
            <RoleAssignmentEditor
              assignments={roleAssignments}
              cohorts={cohorts}
              onAdd={addRoleAssignment}
              onRemove={removeRoleAssignment}
              onUpdate={updateRoleAssignment}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={loading || roleAssignments.length === 0}
            className="gradient-bg"
          >
            {loading ? (
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
  );
}
