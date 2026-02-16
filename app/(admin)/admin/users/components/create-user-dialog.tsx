'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
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
import { UserPlus, Loader2 } from 'lucide-react';
import type { Cohort } from '@/types';
import type { RoleAssignmentInput } from '../types';
import { RoleAssignmentEditor } from './role-assignment-editor';

interface CreateUserDialogProps {
  cohorts: Cohort[];
  onCreated: () => void;
}

export function CreateUserDialog({ cohorts, onCreated }: CreateUserDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [roleAssignments, setRoleAssignments] = useState<RoleAssignmentInput[]>([
    { role: 'student', cohort_id: null }
  ]);

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

  const handleCreate = async () => {
    if (!email) {
      toast.error('Email is required');
      return;
    }

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
      const response = await fetch('/api/admin/users/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          full_name: name,
          phone: phone || undefined,
          role_assignments: validAssignments,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create user');
      }

      toast.success('User created successfully! They can now login via email OTP.');
      setOpen(false);
      setEmail('');
      setName('');
      setPhone('');
      setRoleAssignments([{ role: 'student', cohort_id: null }]);
      onCreated();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create user');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input
              id="name"
              placeholder="John Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="+919876543210"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Include country code (e.g., +91 for India)
            </p>
          </div>

          <div className="space-y-3">
            <Label>Role Assignments *</Label>
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
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={loading || !email || roleAssignments.length === 0}
            className="gradient-bg"
          >
            {loading ? (
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
  );
}
