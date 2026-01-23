'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import {
  Plus,
  CalendarDays,
  Users,
  MoreVertical,
  Pencil,
  Archive,
  Trash2,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { format } from 'date-fns';
import type { Cohort } from '@/types';

interface CohortWithStats extends Cohort {
  student_count?: number;
  session_count?: number;
}

export default function CohortsPage() {
  const [cohorts, setCohorts] = useState<CohortWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [editingCohort, setEditingCohort] = useState<Cohort | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    tag: '',
    start_date: '',
    end_date: '',
    status: 'active' as 'active' | 'completed' | 'archived',
  });

  const [showRetagDialog, setShowRetagDialog] = useState(false);
  const [retagCohort, setRetagCohort] = useState<Cohort | null>(null);
  const [newTag, setNewTag] = useState('');

  const fetchCohorts = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/cohorts');
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch cohorts');
      }
      const data = await response.json();
      setCohorts(data);
    } catch (error) {
      console.error('Error fetching cohorts:', error);
      toast.error('Failed to load cohorts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCohorts();
  }, [fetchCohorts]);

  const handleOpenForm = (cohort?: Cohort) => {
    if (cohort) {
      setEditingCohort(cohort);
      setFormData({
        name: cohort.name,
        tag: cohort.tag,
        start_date: cohort.start_date || '',
        end_date: cohort.end_date || '',
        status: cohort.status as 'active' | 'completed' | 'archived',
      });
    } else {
      setEditingCohort(null);
      setFormData({
        name: '',
        tag: '',
        start_date: '',
        end_date: '',
        status: 'active',
      });
    }
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.tag.trim()) {
      toast.error('Name and tag are required');
      return;
    }

    if (formData.start_date && formData.end_date) {
      if (new Date(formData.end_date) <= new Date(formData.start_date)) {
        toast.error('End date must be after start date');
        return;
      }
    }

    setSaving(true);

    try {
      const method = editingCohort ? 'PUT' : 'POST';
      const body = editingCohort
        ? { id: editingCohort.id, ...formData }
        : formData;

      const response = await fetch('/api/admin/cohorts', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.json();
        if (response.status === 409) {
          toast.error('Tag already exists. Please use a unique tag.');
          return;
        }
        throw new Error(error.error || 'Failed to save cohort');
      }

      toast.success(editingCohort ? 'Cohort updated' : 'Cohort created');
      setShowForm(false);
      fetchCohorts();
    } catch (error) {
      console.error('Error saving cohort:', error);
      toast.error('Failed to save cohort');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (cohortId: string) => {
    if (!confirm('Are you sure you want to delete this cohort? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/cohorts?id=${cohortId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete cohort');
      }

      toast.success('Cohort deleted');
      fetchCohorts();
    } catch (error) {
      console.error('Error deleting cohort:', error);
      toast.error('Failed to delete cohort');
    }
  };

  const handleArchive = async (cohortId: string) => {
    try {
      const response = await fetch('/api/admin/cohorts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: cohortId, status: 'archived' }),
      });

      if (!response.ok) {
        throw new Error('Failed to archive cohort');
      }

      toast.success('Cohort archived');
      fetchCohorts();
    } catch (error) {
      console.error('Error archiving cohort:', error);
      toast.error('Failed to archive cohort');
    }
  };

  const handleRetag = async () => {
    if (!retagCohort || !newTag.trim()) {
      toast.error('Please enter a new tag');
      return;
    }

    setSaving(true);

    try {
      const response = await fetch('/api/admin/cohorts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: retagCohort.id, tag: newTag.trim() }),
      });

      if (!response.ok) {
        const error = await response.json();
        if (response.status === 409) {
          toast.error('Tag already exists');
          return;
        }
        throw new Error(error.error || 'Failed to retag cohort');
      }

      toast.success('Cohort retagged successfully');
      setShowRetagDialog(false);
      setRetagCohort(null);
      setNewTag('');
      fetchCohorts();
    } catch (error) {
      console.error('Error retagging cohort:', error);
      toast.error('Failed to retag cohort');
    } finally {
      setSaving(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500/10 text-green-600 dark:text-green-400">Active</Badge>;
      case 'completed':
        return <Badge className="bg-blue-500/10 text-blue-600 dark:text-blue-400">Completed</Badge>;
      case 'archived':
        return <Badge variant="secondary">Archived</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Cohort Management</h1>
          <p className="text-muted-foreground">
            Create and manage learning cohorts
          </p>
        </div>
        <Button onClick={() => handleOpenForm()} className="gradient-bg gap-2">
          <Plus className="w-4 h-4" />
          Create Cohort
        </Button>
      </div>

      {/* Cohorts Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Cohorts</CardTitle>
          <CardDescription>
            {cohorts.length} cohort{cohorts.length !== 1 ? 's' : ''} total
          </CardDescription>
        </CardHeader>
        <CardContent>
          {cohorts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CalendarDays className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No cohorts yet</p>
              <p className="text-sm">Create your first cohort to get started</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Tag</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Students</TableHead>
                    <TableHead>Sessions</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cohorts.map((cohort) => (
                    <TableRow key={cohort.id}>
                      <TableCell className="font-medium">{cohort.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{cohort.tag}</Badge>
                      </TableCell>
                      <TableCell>
                        {cohort.start_date && cohort.end_date ? (
                          <span className="text-sm">
                            {format(new Date(cohort.start_date), 'MMM d')} -{' '}
                            {format(new Date(cohort.end_date), 'MMM d, yyyy')}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Not set</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-muted-foreground" />
                          {cohort.student_count}
                        </div>
                      </TableCell>
                      <TableCell>{cohort.session_count}</TableCell>
                      <TableCell>{getStatusBadge(cohort.status)}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleOpenForm(cohort)}>
                              <Pencil className="w-4 h-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setRetagCohort(cohort);
                                setNewTag(cohort.tag);
                                setShowRetagDialog(true);
                              }}
                            >
                              <RefreshCw className="w-4 h-4 mr-2" />
                              Retag
                            </DropdownMenuItem>
                            {cohort.status !== 'archived' && (
                              <DropdownMenuItem onClick={() => handleArchive(cohort.id)}>
                                <Archive className="w-4 h-4 mr-2" />
                                Archive
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onClick={() => handleDelete(cohort.id)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCohort ? 'Edit Cohort' : 'Create Cohort'}
            </DialogTitle>
            <DialogDescription>
              {editingCohort
                ? 'Update the cohort details'
                : 'Fill in the details for the new cohort'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Cohort 6"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tag">Tag (unique identifier)</Label>
              <Input
                id="tag"
                value={formData.tag}
                onChange={(e) => setFormData({ ...formData, tag: e.target.value.toUpperCase() })}
                placeholder="C6"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start_date">Start Date</Label>
                <Input
                  id="start_date"
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end_date">End Date</Label>
                <Input
                  id="end_date"
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) =>
                  setFormData({ ...formData, status: value as 'active' | 'completed' | 'archived' })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving} className="gradient-bg">
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : editingCohort ? (
                'Update'
              ) : (
                'Create'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Retag Dialog */}
      <Dialog open={showRetagDialog} onOpenChange={setShowRetagDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Retag Cohort</DialogTitle>
            <DialogDescription>
              Change the tag for {retagCohort?.name}. This will update all references.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Current Tag</Label>
              <Input value={retagCohort?.tag || ''} disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new_tag">New Tag</Label>
              <Input
                id="new_tag"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value.toUpperCase())}
                placeholder="A6 (for Alumni 6)"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRetagDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleRetag} disabled={saving} className="gradient-bg">
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Retagging...
                </>
              ) : (
                'Retag'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
