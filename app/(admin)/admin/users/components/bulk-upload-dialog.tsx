'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { toast } from 'sonner';
import {
  Upload,
  Loader2,
  FileSpreadsheet,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import type { BulkUser, BulkResult } from '../types';

interface BulkUploadDialogProps {
  onCreated: () => void;
}

export function BulkUploadDialog({ onCreated }: BulkUploadDialogProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [bulkUsers, setBulkUsers] = useState<BulkUser[]>([]);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkResults, setBulkResults] = useState<BulkResult[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const downloadTemplate = () => {
    const templateData = [
      { 'Email': 'john.doe@example.com', 'Full Name': 'John Doe', 'Phone Number': '+919876543210', 'Cohort Tag': 'BATCH2025' },
      { 'Email': 'jane.smith@example.com', 'Full Name': 'Jane Smith', 'Phone Number': '+919876543211', 'Cohort Tag': 'BATCH2025' },
      { 'Email': 'user@company.com', 'Full Name': 'User Name', 'Phone Number': '+919876543212', 'Cohort Tag': 'BATCH2025' },
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);

    ws['!cols'] = [
      { wch: 30 },
      { wch: 25 },
      { wch: 18 },
      { wch: 15 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Users');

    XLSX.writeFile(wb, 'bulk_users_template.xlsx');

    toast.success('Template downloaded! Fill in your user data and upload.');
  };

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
          phone: (row['Phone'] || row['Phone Number'] || row['phone'] || row['phone_number'] || '').trim(),
          cohort_tag: (row['Cohort'] || row['Cohort Tag'] || row['cohort_tag'] || '').trim(),
        })).filter(u => u.email);

        setBulkUsers(parsedUsers);
        setBulkResults(null);
        setDialogOpen(true);
      } catch (error) {
        toast.error('Failed to parse file. Please use a valid Excel or CSV file.');
      }
    };
    reader.readAsArrayBuffer(file);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

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
      onCreated();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create users');
    } finally {
      setBulkLoading(false);
    }
  };

  return (
    <>
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
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
                      <TableHead>Phone Number</TableHead>
                      <TableHead>Cohort Tag</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bulkUsers.map((user, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-mono text-sm">{user.email}</TableCell>
                        <TableCell>{user.full_name || '-'}</TableCell>
                        <TableCell className="font-mono text-sm">{user.phone || '-'}</TableCell>
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
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
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
                  setDialogOpen(false);
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
    </>
  );
}
