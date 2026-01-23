'use client';

import { useEffect, useState, useCallback } from 'react';
import { useUser } from '@/hooks/use-user';
import { getClient } from '@/lib/supabase/client';
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
import { toast } from 'sonner';
import {
  Upload,
  FileSpreadsheet,
  Send,
  Check,
  X,
  AlertCircle,
  Users,
  Loader2,
  Download,
  Trash2,
} from 'lucide-react';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';
import type { Cohort } from '@/types';

interface InvitePreview {
  name: string;
  email: string;
  phone?: string;
  cohort_tag?: string;
  mentor_email?: string;
  valid: boolean;
  error?: string;
}

interface Invite {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  cohort_tag: string | null;
  mentor_email: string | null;
  status: 'pending' | 'sent' | 'failed' | 'accepted';
  sent_at: string | null;
  error_message: string | null;
  created_at: string;
}

export default function InvitesPage() {
  const { loading: userLoading } = useUser();
  const [invites, setInvites] = useState<Invite[]>([]);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);

  const [previewData, setPreviewData] = useState<InvitePreview[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [selectedCohort, setSelectedCohort] = useState<string>('');

  const fetchData = useCallback(async () => {
    const supabase = getClient();

    try {
      const [{ data: invitesData }, { data: cohortsData }] = await Promise.all([
        supabase
          .from('invites')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100),
        supabase
          .from('cohorts')
          .select('*')
          .eq('status', 'active')
          .order('name', { ascending: true }),
      ]);

      setInvites(invitesData || []);
      setCohorts(cohortsData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load invites');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!userLoading) {
      fetchData();
    }
  }, [userLoading, fetchData]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
    ];

    if (!validTypes.includes(file.type)) {
      toast.error('Please upload an Excel (.xls, .xlsx) or CSV file');
      return;
    }

    setUploading(true);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet) as Record<string, string>[];

      // Validate and transform data
      const previews: InvitePreview[] = jsonData.map((row, index) => {
        const name = row.Name || row.name || row['Full Name'] || row.full_name || '';
        const email = row.Email || row.email || '';
        const phone = row.Phone || row.phone || row['Phone Number'] || '';
        const cohortTag = row['Cohort Tag'] || row.cohort_tag || row.Cohort || selectedCohort || '';
        const mentorEmail = row['Mentor Email'] || row.mentor_email || row.Mentor || '';

        let valid = true;
        let error = '';

        if (!name.trim()) {
          valid = false;
          error = 'Name is required';
        } else if (!email.trim()) {
          valid = false;
          error = 'Email is required';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          valid = false;
          error = 'Invalid email format';
        }

        return {
          name: name.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim(),
          cohort_tag: cohortTag.trim(),
          mentor_email: mentorEmail.trim().toLowerCase(),
          valid,
          error,
        };
      });

      setPreviewData(previews);
      setShowPreview(true);
    } catch (error) {
      console.error('Error parsing file:', error);
      toast.error('Failed to parse file. Please check the format.');
    } finally {
      setUploading(false);
      // Reset file input
      e.target.value = '';
    }
  };

  const handleSendInvites = async () => {
    const validInvites = previewData.filter(p => p.valid);

    if (validInvites.length === 0) {
      toast.error('No valid invites to send');
      return;
    }

    setSending(true);
    const supabase = getClient();
    const { data: { user } } = await supabase.auth.getUser();

    try {
      // Insert invites into database
      const { data: insertedInvites, error: insertError } = await supabase
        .from('invites')
        .insert(
          validInvites.map(invite => ({
            email: invite.email,
            full_name: invite.name,
            phone: invite.phone || null,
            cohort_tag: invite.cohort_tag || selectedCohort || null,
            mentor_email: invite.mentor_email || null,
            status: 'pending',
            created_by: user?.id,
          }))
        )
        .select();

      if (insertError) throw insertError;

      // Trigger email sending via API
      const response = await fetch('/api/users/bulk-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteIds: insertedInvites?.map((i: { id: string }) => i.id) }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to send invites');
      }

      toast.success(`${validInvites.length} invite(s) queued for sending`);
      setShowPreview(false);
      setPreviewData([]);
      fetchData();
    } catch (error) {
      console.error('Error sending invites:', error);
      toast.error('Failed to send invites');
    } finally {
      setSending(false);
    }
  };

  const handleResend = async (inviteId: string) => {
    const supabase = getClient();

    try {
      await supabase
        .from('invites')
        .update({ status: 'pending', error_message: null })
        .eq('id', inviteId);

      const response = await fetch('/api/users/bulk-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteIds: [inviteId] }),
      });

      if (!response.ok) throw new Error('Failed to resend');

      toast.success('Invite resent');
      fetchData();
    } catch (error) {
      toast.error('Failed to resend invite');
    }
  };

  const handleDelete = async (inviteId: string) => {
    const supabase = getClient();

    try {
      await supabase.from('invites').delete().eq('id', inviteId);
      toast.success('Invite deleted');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete invite');
    }
  };

  const downloadTemplate = () => {
    const template = [
      { Name: 'John Doe', Email: 'john@example.com', Phone: '+91 98765 43210', 'Cohort Tag': 'C6', 'Mentor Email': 'mentor@example.com' },
      { Name: 'Jane Smith', Email: 'jane@example.com', Phone: '+91 87654 32109', 'Cohort Tag': 'C6', 'Mentor Email': '' },
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Invites');
    XLSX.writeFile(wb, 'invite_template.xlsx');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent':
        return <Badge className="bg-green-500/10 text-green-600 dark:text-green-400">Sent</Badge>;
      case 'pending':
        return <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400">Pending</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      case 'accepted':
        return <Badge className="bg-blue-500/10 text-blue-600 dark:text-blue-400">Accepted</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (userLoading || loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Invite Management</h1>
        <p className="text-muted-foreground">
          Send invites to new students via bulk upload or individual entry
        </p>
      </div>

      {/* Upload Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5" />
              Bulk Upload
            </CardTitle>
            <CardDescription>
              Upload an Excel or CSV file with student data
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
              <input
                type="file"
                id="file-upload"
                className="hidden"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileUpload}
                disabled={uploading}
              />
              <label
                htmlFor="file-upload"
                className="cursor-pointer flex flex-col items-center gap-2"
              >
                {uploading ? (
                  <Loader2 className="w-10 h-10 text-muted-foreground animate-spin" />
                ) : (
                  <Upload className="w-10 h-10 text-muted-foreground" />
                )}
                <p className="font-medium">
                  {uploading ? 'Processing...' : 'Click to upload or drag and drop'}
                </p>
                <p className="text-sm text-muted-foreground">
                  XLS, XLSX, or CSV files
                </p>
              </label>
            </div>

            <div className="flex items-center gap-2">
              <Select value={selectedCohort} onValueChange={setSelectedCohort}>
                <SelectTrigger>
                  <SelectValue placeholder="Default cohort tag" />
                </SelectTrigger>
                <SelectContent>
                  {cohorts.map((cohort) => (
                    <SelectItem key={cohort.id} value={cohort.tag}>
                      {cohort.name} ({cohort.tag})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button variant="outline" onClick={downloadTemplate} className="w-full gap-2">
              <Download className="w-4 h-4" />
              Download Template
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Invite Stats
            </CardTitle>
            <CardDescription>
              Overview of sent invitations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground">Total Sent</p>
                <p className="text-2xl font-bold">
                  {invites.filter(i => i.status === 'sent').length}
                </p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold">
                  {invites.filter(i => i.status === 'pending').length}
                </p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground">Accepted</p>
                <p className="text-2xl font-bold">
                  {invites.filter(i => i.status === 'accepted').length}
                </p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground">Failed</p>
                <p className="text-2xl font-bold text-destructive">
                  {invites.filter(i => i.status === 'failed').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Invites Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Invites</CardTitle>
          <CardDescription>
            Track the status of sent invitations
          </CardDescription>
        </CardHeader>
        <CardContent>
          {invites.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No invites yet</p>
              <p className="text-sm">Upload a file to get started</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Cohort</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Sent At</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invites.map((invite) => (
                    <TableRow key={invite.id}>
                      <TableCell className="font-medium">
                        {invite.full_name || 'N/A'}
                      </TableCell>
                      <TableCell>{invite.email}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{invite.cohort_tag || 'N/A'}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(invite.status)}
                          {invite.error_message && (
                            <span className="text-xs text-destructive" title={invite.error_message}>
                              <AlertCircle className="w-3 h-3" />
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {invite.sent_at
                          ? format(new Date(invite.sent_at), 'MMM d, h:mm a')
                          : '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {invite.status === 'failed' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleResend(invite.id)}
                            >
                              <Send className="w-4 h-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(invite.id)}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Preview Invites</DialogTitle>
            <DialogDescription>
              Review and confirm the data before sending invites
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <div className="flex items-center gap-4 mb-4">
              <Badge variant="secondary" className="bg-green-500/10 text-green-600">
                <Check className="w-3 h-3 mr-1" />
                {previewData.filter(p => p.valid).length} Valid
              </Badge>
              {previewData.filter(p => !p.valid).length > 0 && (
                <Badge variant="destructive">
                  <X className="w-3 h-3 mr-1" />
                  {previewData.filter(p => !p.valid).length} Invalid
                </Badge>
              )}
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Cohort</TableHead>
                    <TableHead>Error</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewData.map((preview, index) => (
                    <TableRow key={index} className={!preview.valid ? 'bg-destructive/5' : ''}>
                      <TableCell>
                        {preview.valid ? (
                          <Check className="w-4 h-4 text-green-500" />
                        ) : (
                          <X className="w-4 h-4 text-destructive" />
                        )}
                      </TableCell>
                      <TableCell>{preview.name}</TableCell>
                      <TableCell>{preview.email}</TableCell>
                      <TableCell>{preview.phone || '-'}</TableCell>
                      <TableCell>{preview.cohort_tag || selectedCohort || '-'}</TableCell>
                      <TableCell className="text-destructive text-sm">
                        {preview.error}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreview(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSendInvites}
              disabled={sending || previewData.filter(p => p.valid).length === 0}
              className="gradient-bg"
            >
              {sending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Send {previewData.filter(p => p.valid).length} Invite(s)
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
