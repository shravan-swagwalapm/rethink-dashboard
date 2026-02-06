'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import {
  Plus,
  Users,
  UserCheck,
  MoreVertical,
  Pencil,
  Trash2,
  Loader2,
  Wand2,
  Shuffle,
} from 'lucide-react';
import type { SubgroupWithDetails } from '@/types';
import { AssignStudentsDialog } from './assign-students-dialog';
import { AssignMentorDialog } from './assign-mentor-dialog';

interface SubgroupsTabProps {
  cohortId: string;
  subgroups: SubgroupWithDetails[];
  loading: boolean;
  onRefresh: () => void;
}

export function SubgroupsTab({ cohortId, subgroups, loading, onRefresh }: SubgroupsTabProps) {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showBulkDialog, setShowBulkDialog] = useState(false);
  const [editingSubgroup, setEditingSubgroup] = useState<SubgroupWithDetails | null>(null);
  const [deletingSubgroup, setDeletingSubgroup] = useState<SubgroupWithDetails | null>(null);
  const [assignStudentsSubgroup, setAssignStudentsSubgroup] = useState<SubgroupWithDetails | null>(null);
  const [assignMentorSubgroup, setAssignMentorSubgroup] = useState<SubgroupWithDetails | null>(null);

  const [name, setName] = useState('');
  const [bulkCount, setBulkCount] = useState(6);
  const [bulkPrefix, setBulkPrefix] = useState('Subgroup');
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) { toast.error('Name is required'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/admin/subgroups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), cohort_id: cohortId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create subgroup');
      }
      toast.success('Subgroup created');
      setShowCreateDialog(false);
      setName('');
      onRefresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create');
    } finally { setSaving(false); }
  };

  const handleRename = async () => {
    if (!editingSubgroup || !name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/subgroups/${editingSubgroup.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to rename');
      }
      toast.success('Subgroup renamed');
      setEditingSubgroup(null);
      setName('');
      onRefresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to rename');
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deletingSubgroup) return;
    try {
      const res = await fetch(`/api/admin/subgroups/${deletingSubgroup.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      toast.success('Subgroup deleted');
      setDeletingSubgroup(null);
      onRefresh();
    } catch {
      toast.error('Failed to delete subgroup');
    }
  };

  const handleBulkCreate = async () => {
    if (bulkCount < 1 || bulkCount > 20) { toast.error('Count must be 1-20'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/admin/subgroups/bulk-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cohort_id: cohortId, count: bulkCount, prefix: bulkPrefix }),
      });
      if (!res.ok) throw new Error('Failed to bulk create');
      const data = await res.json();
      toast.success(`Created ${data.created} subgroups`);
      setShowBulkDialog(false);
      onRefresh();
    } catch {
      toast.error('Failed to bulk create subgroups');
    } finally { setSaving(false); }
  };

  const handleAutoAssign = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/subgroups/auto-assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cohort_id: cohortId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to auto-assign');
      }
      const data = await res.json();
      toast.success(`Auto-assigned ${data.assigned} students`);
      onRefresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to auto-assign');
    } finally { setSaving(false); }
  };

  if (!cohortId) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>Select a cohort to manage subgroups</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Actions Row */}
      <div className="flex items-center gap-2">
        <Button onClick={() => { setName(''); setShowCreateDialog(true); }} className="gradient-bg gap-2">
          <Plus className="w-4 h-4" />
          Create Subgroup
        </Button>
        <Button variant="outline" onClick={() => setShowBulkDialog(true)} className="gap-2">
          <Wand2 className="w-4 h-4" />
          Bulk Create
        </Button>
        <Button variant="outline" onClick={handleAutoAssign} disabled={saving} className="gap-2">
          <Shuffle className="w-4 h-4" />
          Auto-Assign Students
        </Button>
        <div className="ml-auto text-sm text-muted-foreground">
          {subgroups.length} subgroup{subgroups.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Subgroup Cards */}
      {loading ? (
        <div className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
      ) : subgroups.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium text-muted-foreground">No subgroups yet</p>
            <p className="text-sm text-muted-foreground">Create subgroups to organize students</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {subgroups.map((sg) => (
            <Card key={sg.id} className="group">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{sg.name}</CardTitle>
                    <CardDescription>
                      {sg.member_count || 0} student{(sg.member_count || 0) !== 1 ? 's' : ''} &bull; {sg.mentor_count || 0} mentor{(sg.mentor_count || 0) !== 1 ? 's' : ''}
                    </CardDescription>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setAssignStudentsSubgroup(sg)}>
                        <Users className="w-4 h-4 mr-2" />
                        Assign Students
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setAssignMentorSubgroup(sg)}>
                        <UserCheck className="w-4 h-4 mr-2" />
                        Assign Mentor
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => { setEditingSubgroup(sg); setName(sg.name); }}>
                        <Pencil className="w-4 h-4 mr-2" />
                        Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setDeletingSubgroup(sg)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent>
                {/* Mentor(s) */}
                {(sg.mentors || []).length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs font-medium text-muted-foreground mb-1.5">Mentor</p>
                    <div className="flex items-center gap-2">
                      {(sg.mentors || []).map((m) => (
                        <div key={m.user_id} className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={m.user?.avatar_url || ''} />
                            <AvatarFallback className="text-xs">
                              {m.user?.full_name?.charAt(0) || '?'}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm">{m.user?.full_name || m.user?.email}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {/* Student count badge */}
                <div className="flex items-center gap-2">
                  <Badge variant={(sg.member_count || 0) >= 8 && (sg.member_count || 0) <= 12 ? 'default' : 'secondary'}>
                    {sg.member_count || 0} / 8-12 students
                  </Badge>
                  {(sg.mentor_count || 0) === 0 && (
                    <Badge variant="destructive" className="text-xs">No mentor</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Subgroup</DialogTitle>
            <DialogDescription>Add a new subgroup to this cohort</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-2">
            <Label htmlFor="sg-name">Subgroup Name</Label>
            <Input id="sg-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Subgroup Alpha" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving} className="gradient-bg">
              {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating...</> : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={!!editingSubgroup} onOpenChange={(open) => { if (!open) setEditingSubgroup(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Subgroup</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-2">
            <Label>New Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingSubgroup(null)}>Cancel</Button>
            <Button onClick={handleRename} disabled={saving} className="gradient-bg">
              {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</> : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Create Dialog */}
      <Dialog open={showBulkDialog} onOpenChange={setShowBulkDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk Create Subgroups</DialogTitle>
            <DialogDescription>Create multiple subgroups at once</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label>Name Prefix</Label>
              <Input value={bulkPrefix} onChange={(e) => setBulkPrefix(e.target.value)} placeholder="Subgroup" />
            </div>
            <div className="space-y-2">
              <Label>Number of Subgroups</Label>
              <Input type="number" min={1} max={20} value={bulkCount} onChange={(e) => setBulkCount(parseInt(e.target.value) || 1)} />
              <p className="text-xs text-muted-foreground">Will create &quot;{bulkPrefix} 1&quot; through &quot;{bulkPrefix} {bulkCount}&quot;</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkDialog(false)}>Cancel</Button>
            <Button onClick={handleBulkCreate} disabled={saving} className="gradient-bg">
              {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating...</> : `Create ${bulkCount} Subgroups`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingSubgroup} onOpenChange={(open) => { if (!open) setDeletingSubgroup(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Subgroup?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &quot;{deletingSubgroup?.name}&quot; and remove all student/mentor assignments. Feedback history will be preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Assign Students Dialog */}
      <AssignStudentsDialog
        cohortId={cohortId}
        subgroup={assignStudentsSubgroup}
        allSubgroups={subgroups}
        open={!!assignStudentsSubgroup}
        onOpenChange={(open) => { if (!open) setAssignStudentsSubgroup(null); }}
        onSaved={onRefresh}
      />

      {/* Assign Mentor Dialog */}
      <AssignMentorDialog
        cohortId={cohortId}
        subgroup={assignMentorSubgroup}
        open={!!assignMentorSubgroup}
        onOpenChange={(open) => { if (!open) setAssignMentorSubgroup(null); }}
        onSaved={onRefresh}
      />
    </div>
  );
}
