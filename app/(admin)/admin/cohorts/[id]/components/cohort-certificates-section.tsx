'use client';

/**
 * Admin-side "Certificates" section on the cohort detail page.
 *
 * Renders only when `cohortStatus === 'completed'`. For other statuses the
 * parent page hides this section entirely (Phase 2 acceptance criterion #1).
 *
 * Member list is sourced from `GET /api/admin/cohorts/[id]/certificates`,
 * which joins `user_role_assignments` (role IN student, mentor) with
 * `cohort_certificates` on (user_id, cohort_id). Upload + replace go through
 * `POST /api/admin/cohort-certificates`; delete goes through
 * `DELETE /api/admin/cohort-certificates/[id]`. Both routes are guarded by
 * `verifyAdmin()` and are thin wrappers over `lib/services/certificates.ts`.
 *
 * Client-side file validation (max 10 MB, MIME ∈ {png, jpeg, pdf}) mirrors
 * the server-side check in the service — the server check remains the source
 * of truth; client validation only saves a round-trip.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { toast } from 'sonner';
import {
  Award,
  FileImage,
  FileText,
  Loader2,
  RefreshCw,
  Trash2,
  Upload,
  XCircle,
} from 'lucide-react';
import { format } from 'date-fns';

const MAX_CERT_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB — must match service constant
const ACCEPT_MIMES = ['image/png', 'image/jpeg', 'application/pdf'] as const;
const ACCEPT_ATTR = ACCEPT_MIMES.join(',');

type Role = 'student' | 'mentor';

interface CertificateMeta {
  id: string;
  file_type: string;
  file_size: number;
  uploaded_at: string;
  uploaded_by: string;
}

interface MemberRow {
  user_id: string;
  full_name: string | null;
  email: string;
  avatar_url: string | null;
  role: Role;
  certificate: CertificateMeta | null;
}

interface CohortCertificatesSectionProps {
  cohortId: string;
  cohortName: string;
}

function fileTypeBadgeLabel(mime: string): string {
  switch (mime) {
    case 'image/png':
      return 'PNG';
    case 'image/jpeg':
      return 'JPG';
    case 'application/pdf':
      return 'PDF';
    default:
      return mime;
  }
}

function FileTypeBadge({ mime }: { mime: string }) {
  const Icon = mime === 'application/pdf' ? FileText : FileImage;
  return (
    <Badge variant="outline" className="gap-1 font-mono text-[10px]">
      <Icon className="w-3 h-3" />
      {fileTypeBadgeLabel(mime)}
    </Badge>
  );
}

export function CohortCertificatesSection({ cohortId, cohortName }: CohortCertificatesSectionProps) {
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Upload dialog
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadTarget, setUploadTarget] = useState<MemberRow | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadInFlight, setUploadInFlight] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<MemberRow | null>(null);
  const [deleteInFlight, setDeleteInFlight] = useState(false);

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/cohorts/${cohortId}/certificates`);
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || `Failed to load members (HTTP ${response.status})`);
      }
      const data = (await response.json()) as MemberRow[];
      setMembers(Array.isArray(data) ? data : []);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to load cohort members';
      setError(message);
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, [cohortId]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const openUpload = (member: MemberRow) => {
    setUploadTarget(member);
    setSelectedFile(null);
    setUploadDialogOpen(true);
  };

  const closeUpload = () => {
    setUploadDialogOpen(false);
    setUploadTarget(null);
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (!file) {
      setSelectedFile(null);
      return;
    }
    // Client-side validation — server is still the source of truth.
    if (!(ACCEPT_MIMES as readonly string[]).includes(file.type)) {
      toast.error(`Unsupported file type: ${file.type || 'unknown'}`, {
        description: 'Allowed: PNG, JPG, or PDF.',
      });
      if (fileInputRef.current) fileInputRef.current.value = '';
      setSelectedFile(null);
      return;
    }
    if (file.size > MAX_CERT_SIZE_BYTES) {
      toast.error('File is too large', {
        description: `Maximum size is 10 MB. This file is ${(file.size / (1024 * 1024)).toFixed(1)} MB.`,
      });
      if (fileInputRef.current) fileInputRef.current.value = '';
      setSelectedFile(null);
      return;
    }
    setSelectedFile(file);
  };

  const submitUpload = async () => {
    if (!uploadTarget || !selectedFile) return;
    setUploadInFlight(true);
    try {
      const formData = new FormData();
      formData.append('user_id', uploadTarget.user_id);
      formData.append('cohort_id', cohortId);
      formData.append('file', selectedFile);

      const response = await fetch('/api/admin/cohort-certificates', {
        method: 'POST',
        body: formData,
      });
      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(body.error || `Upload failed (HTTP ${response.status})`);
      }

      const action = uploadTarget.certificate ? 'replaced' : 'uploaded';
      toast.success(`Certificate ${action} for ${uploadTarget.full_name || uploadTarget.email}`);
      closeUpload();
      await fetchMembers();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to upload certificate';
      toast.error(message);
    } finally {
      setUploadInFlight(false);
    }
  };

  const openDelete = (member: MemberRow) => {
    setDeleteTarget(member);
    setDeleteDialogOpen(true);
  };

  const submitDelete = async () => {
    if (!deleteTarget?.certificate) return;
    setDeleteInFlight(true);
    try {
      const response = await fetch(
        `/api/admin/cohort-certificates/${deleteTarget.certificate.id}`,
        { method: 'DELETE' }
      );
      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(body.error || `Delete failed (HTTP ${response.status})`);
      }

      toast.success(`Certificate deleted for ${deleteTarget.full_name || deleteTarget.email}`);
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
      await fetchMembers();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to delete certificate';
      toast.error(message);
    } finally {
      setDeleteInFlight(false);
    }
  };

  const issuedCount = members.filter((m) => m.certificate !== null).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-600" />
              Certificates
              {!loading && members.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {issuedCount} / {members.length} issued
                </Badge>
              )}
            </CardTitle>
            <CardDescription className="mt-1.5">
              Issue, replace, or remove completion certificates for {cohortName}.
              Allowed file types: PNG, JPG, PDF (max 10 MB).
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={fetchMembers} disabled={loading}>
            {loading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            Loading members...
          </div>
        ) : error ? (
          <div className="text-center py-8 text-sm text-red-600">{error}</div>
        ) : members.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Award className="w-10 h-10 mx-auto mb-3 opacity-50" />
            <p className="font-medium">No cohort members</p>
            <p className="text-sm">
              No students or mentors are assigned to this cohort yet.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Issued</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((m) => (
                <TableRow key={m.user_id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{m.full_name || 'Unnamed'}</p>
                      <p className="text-sm text-muted-foreground">{m.email}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={m.role === 'mentor' ? 'default' : 'outline'} className="capitalize">
                      {m.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {m.certificate ? (
                      <div className="flex items-center gap-2">
                        <Badge className="bg-green-500/10 text-green-700 hover:bg-green-500/10">
                          Issued
                        </Badge>
                        <FileTypeBadge mime={m.certificate.file_type} />
                      </div>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        Not issued
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {m.certificate
                      ? format(new Date(m.certificate.uploaded_at), 'MMM d, yyyy')
                      : '-'}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openUpload(m)}
                      >
                        <Upload className="w-3.5 h-3.5 mr-1.5" />
                        {m.certificate ? 'Replace' : 'Upload'}
                      </Button>
                      {m.certificate && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openDelete(m)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-500/10"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {/* Upload / Replace dialog */}
      <Dialog
        open={uploadDialogOpen}
        onOpenChange={(open) => {
          if (!open) closeUpload();
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {uploadTarget?.certificate ? 'Replace Certificate' : 'Upload Certificate'}
            </DialogTitle>
            <DialogDescription>
              {uploadTarget && (
                <>
                  For <strong>{uploadTarget.full_name || uploadTarget.email}</strong> in {cohortName}.
                  {uploadTarget.certificate && (
                    <> The existing {fileTypeBadgeLabel(uploadTarget.certificate.file_type)} certificate
                    will be replaced.</>
                  )}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label>Certificate file</Label>
            <p className="text-xs text-muted-foreground">PNG, JPG, or PDF. Max 10 MB.</p>
            <div className="border-2 border-dashed rounded-lg p-4 text-center">
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPT_ATTR}
                onChange={handleFileChange}
                className="hidden"
              />
              {selectedFile ? (
                <div className="flex items-center justify-center gap-2">
                  {selectedFile.type === 'application/pdf' ? (
                    <FileText className="w-5 h-5 text-red-500" />
                  ) : (
                    <FileImage className="w-5 h-5 text-blue-500" />
                  )}
                  <span className="text-sm truncate max-w-[240px]">{selectedFile.name}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                  >
                    <XCircle className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="w-4 h-4 mr-2" />
                  Select file
                </Button>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeUpload} disabled={uploadInFlight}>
              Cancel
            </Button>
            <Button onClick={submitUpload} disabled={!selectedFile || uploadInFlight}>
              {uploadInFlight && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {uploadTarget?.certificate ? 'Replace certificate' : 'Upload certificate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete certificate</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && (
                <>
                  Remove the certificate for{' '}
                  <strong>{deleteTarget.full_name || deleteTarget.email}</strong>?
                  The stored file will be deleted permanently. This cannot be undone.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteInFlight}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={submitDelete}
              disabled={deleteInFlight}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteInFlight && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
