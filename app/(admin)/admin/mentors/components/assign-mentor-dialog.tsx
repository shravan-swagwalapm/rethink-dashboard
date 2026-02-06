'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
import type { SubgroupWithDetails } from '@/types';

interface AssignMentorDialogProps {
  cohortId: string;
  subgroup: SubgroupWithDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

interface MentorOption {
  id: string;
  full_name: string | null;
  email: string;
  avatar_url: string | null;
}

export function AssignMentorDialog({
  cohortId, subgroup, open, onOpenChange, onSaved,
}: AssignMentorDialogProps) {
  const [mentors, setMentors] = useState<MentorOption[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && cohortId) fetchMentors();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, cohortId]);

  const fetchMentors = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users`);
      if (!res.ok) throw new Error('Failed to fetch users');
      const data = await res.json();

      const cohortMentors = (data.users || []).filter((u: any) =>
        u.role_assignments?.some((ra: any) => ra.role === 'mentor' && ra.cohort_id === cohortId)
      );

      setMentors(cohortMentors.map((u: any) => ({
        id: u.id,
        full_name: u.full_name,
        email: u.email,
        avatar_url: u.avatar_url,
      })));

      if (subgroup) {
        setSelected(new Set((subgroup.mentors || []).map(m => m.user_id)));
      }
    } catch {
      toast.error('Failed to load mentors');
    } finally { setLoading(false); }
  };

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const handleSave = async () => {
    if (!subgroup) return;
    setSaving(true);
    try {
      const currentIds = new Set((subgroup.mentors || []).map(m => m.user_id));
      const toRemove = [...currentIds].filter(id => !selected.has(id));
      const toAdd = [...selected].filter(id => !currentIds.has(id));

      if (toRemove.length > 0) {
        await fetch(`/api/admin/subgroups/${subgroup.id}/mentors`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_ids: toRemove }),
        });
      }

      if (toAdd.length > 0) {
        const res = await fetch(`/api/admin/subgroups/${subgroup.id}/mentors`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_ids: toAdd }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Failed to assign mentors');
        }
      }

      toast.success('Mentors updated');
      onOpenChange(false);
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update mentors');
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign Mentors to {subgroup?.name}</DialogTitle>
          <DialogDescription>Select mentors for this subgroup (typically 1)</DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-2 max-h-[400px] overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" /></div>
          ) : mentors.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              No mentors found for this cohort. Assign the mentor role first in Users &rarr; Edit Roles.
            </p>
          ) : (
            mentors.map((m) => (
              <label key={m.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted/50 cursor-pointer">
                <Checkbox checked={selected.has(m.id)} onCheckedChange={() => toggle(m.id)} />
                <Avatar className="h-8 w-8">
                  <AvatarImage src={m.avatar_url || ''} />
                  <AvatarFallback>{m.full_name?.charAt(0) || '?'}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium">{m.full_name || m.email}</p>
                  <p className="text-xs text-muted-foreground">{m.email}</p>
                </div>
              </label>
            ))
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="gradient-bg">
            {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</> : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
