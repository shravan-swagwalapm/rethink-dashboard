'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Loader2, Search } from 'lucide-react';
import type { SubgroupWithDetails } from '@/types';

interface AssignStudentsDialogProps {
  cohortId: string;
  subgroup: SubgroupWithDetails | null;
  allSubgroups: SubgroupWithDetails[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

interface StudentOption {
  id: string;
  full_name: string | null;
  email: string;
  existingSubgroup?: string;
}

export function AssignStudentsDialog({
  cohortId, subgroup, allSubgroups, open, onOpenChange, onSaved,
}: AssignStudentsDialogProps) {
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && cohortId) fetchStudents();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, cohortId]);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users`);
      if (!res.ok) throw new Error('Failed to fetch users');
      const data = await res.json();

      // Filter to students in this cohort
      const cohortStudents = (data.users || []).filter((u: any) =>
        u.role_assignments?.some((ra: any) => ra.role === 'student' && ra.cohort_id === cohortId)
      );

      // Map existing subgroup assignments
      const assignedMap = new Map<string, string>();
      for (const sg of allSubgroups) {
        for (const m of sg.members || []) {
          assignedMap.set(m.user_id, sg.name);
        }
      }

      setStudents(cohortStudents.map((u: any) => ({
        id: u.id,
        full_name: u.full_name,
        email: u.email,
        existingSubgroup: assignedMap.get(u.id),
      })));

      // Pre-select students already in this subgroup
      if (subgroup) {
        setSelected(new Set((subgroup.members || []).map(m => m.user_id)));
      }
    } catch {
      toast.error('Failed to load students');
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
      const currentIds = new Set((subgroup.members || []).map(m => m.user_id));
      const toRemove = [...currentIds].filter(id => !selected.has(id));
      const toAdd = [...selected].filter(id => !currentIds.has(id));

      if (toRemove.length > 0) {
        const res = await fetch(`/api/admin/subgroups/${subgroup.id}/members`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_ids: toRemove }),
        });
        if (!res.ok) throw new Error('Failed to remove students');
      }

      if (toAdd.length > 0) {
        const res = await fetch(`/api/admin/subgroups/${subgroup.id}/members`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_ids: toAdd }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Failed to assign students');
        }
      }

      toast.success('Students updated');
      onOpenChange(false);
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update students');
    } finally { setSaving(false); }
  };

  const filtered = students.filter(s =>
    !search || (s.full_name || s.email).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Assign Students to {subgroup?.name}</DialogTitle>
          <DialogDescription>
            Select students to add to this subgroup. {selected.size} selected.
          </DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search students..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex-1 overflow-y-auto max-h-[400px] space-y-1 py-2">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" /></div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">No students found</p>
          ) : (
            filtered.map((s) => {
              const inOtherSubgroup = s.existingSubgroup && s.existingSubgroup !== subgroup?.name;
              return (
                <label
                  key={s.id}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted/50 cursor-pointer"
                >
                  <Checkbox
                    checked={selected.has(s.id)}
                    onCheckedChange={() => toggle(s.id)}
                    disabled={!!inOtherSubgroup}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{s.full_name || s.email}</p>
                    <p className="text-xs text-muted-foreground truncate">{s.email}</p>
                  </div>
                  {inOtherSubgroup && (
                    <Badge variant="secondary" className="text-xs shrink-0">
                      In {s.existingSubgroup}
                    </Badge>
                  )}
                </label>
              );
            })
          )}
        </div>
        <DialogFooter>
          <Badge variant="outline">{selected.size} selected (recommended: 8-12)</Badge>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="gradient-bg">
            {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</> : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
