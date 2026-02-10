'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { PageLoader } from '@/components/ui/page-loader';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { toast } from 'sonner';
import {
  Search,
  MoreVertical,
  FileText,
  Upload,
  Loader2,
  FileSpreadsheet,
  CheckCircle,
  XCircle,
  Download,
  Trash2,
  RefreshCw,
  Eye,
  Receipt,
  IndianRupee,
  Clock,
  AlertCircle,
  Pencil,
} from 'lucide-react';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { Cohort, InvoiceWithRelations, Profile } from '@/types';
import { getClient } from '@/lib/supabase/client';
import { formatCurrency } from '@/lib/utils/currency';
import { MotionContainer, MotionItem, MotionFadeIn } from '@/components/ui/motion';
import { PageHeader } from '@/components/ui/page-header';

interface InvoiceStats {
  total: number;
  paid: number;
  pending: number;
  overdue: number;
  total_amount: number;
  paid_amount: number;
}

interface BulkMappingRow {
  filename: string;
  email: string;
  invoice_number: string;
  amount: number;
  due_date?: string;
}

interface BulkResult {
  row: BulkMappingRow;
  success: boolean;
  invoice_id?: string;
  error?: string;
}

interface StudentInCohort {
  id: string;
  email: string;
  full_name: string | null;
}

export default function AdminInvoicesPage() {
  const [invoices, setInvoices] = useState<InvoiceWithRelations[]>([]);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [stats, setStats] = useState<InvoiceStats>({
    total: 0,
    paid: 0,
    pending: 0,
    overdue: 0,
    total_amount: 0,
    paid_amount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [cohortFilter, setCohortFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Single upload dialog state
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [selectedCohort, setSelectedCohort] = useState('');
  const [selectedStudent, setSelectedStudent] = useState('');
  const [studentsInCohort, setStudentsInCohort] = useState<StudentInCohort[]>([]);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceAmount, setInvoiceAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [paymentType, setPaymentType] = useState('full');
  const [invoiceStatus, setInvoiceStatus] = useState('pending');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Bulk upload dialog state
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkCohort, setBulkCohort] = useState('');
  const [bulkMappingRows, setBulkMappingRows] = useState<BulkMappingRow[]>([]);
  const [bulkPdfFiles, setBulkPdfFiles] = useState<File[]>([]);
  const [bulkResults, setBulkResults] = useState<BulkResult[] | null>(null);
  const [bulkStep, setBulkStep] = useState<'upload' | 'preview' | 'results'>('upload');

  // Delete confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState<InvoiceWithRelations | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Edit status dialog
  const [editStatusDialogOpen, setEditStatusDialogOpen] = useState(false);
  const [invoiceToEdit, setInvoiceToEdit] = useState<InvoiceWithRelations | null>(null);
  const [newStatus, setNewStatus] = useState('pending');
  const [editStatusLoading, setEditStatusLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const bulkExcelInputRef = useRef<HTMLInputElement>(null);
  const bulkPdfInputRef = useRef<HTMLInputElement>(null);
  const hasFetchedRef = useRef(false);

  const fetchInvoices = useCallback(async (force = false) => {
    if (hasFetchedRef.current && !force) return;
    hasFetchedRef.current = true;

    try {
      const params = new URLSearchParams();
      if (cohortFilter !== 'all') params.append('cohort_id', cohortFilter);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (searchQuery) params.append('search', searchQuery);

      const response = await fetch(`/api/admin/invoices?${params}`);
      if (!response.ok) throw new Error('Failed to fetch invoices');

      const data = await response.json();
      setInvoices(data.invoices || []);
      setStats(data.stats || { total: 0, paid: 0, pending: 0, overdue: 0, total_amount: 0, paid_amount: 0 });
    } catch (error) {
      console.error('Error fetching invoices:', error);
      toast.error('Failed to load invoices');
    } finally {
      setLoading(false);
    }
  }, [cohortFilter, statusFilter, searchQuery]);

  const fetchCohorts = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/cohorts');
      if (!response.ok) throw new Error('Failed to fetch cohorts');
      const data = await response.json();
      // API returns array directly, not { cohorts: [] }
      setCohorts(Array.isArray(data) ? data : data.cohorts || []);
    } catch (error) {
      console.error('Error fetching cohorts:', error);
    }
  }, []);

  useEffect(() => {
    fetchCohorts();
    fetchInvoices();
  }, [fetchCohorts, fetchInvoices]);

  // Fetch students when cohort changes in upload dialog
  useEffect(() => {
    const fetchStudents = async () => {
      if (!selectedCohort) {
        setStudentsInCohort([]);
        return;
      }

      try {
        const response = await fetch(`/api/admin/users?cohort_id=${selectedCohort}`);
        if (!response.ok) throw new Error('Failed to fetch students');
        const data = await response.json();

        // Filter to only students in this cohort
        const students = (data.users || []).filter((user: Profile & { role_assignments?: { cohort_id: string; role: string }[] }) => {
          // Check legacy cohort_id
          if (user.cohort_id === selectedCohort && user.role === 'student') return true;
          // Check role assignments
          if (user.role_assignments?.some((ra: { cohort_id: string; role: string }) => ra.cohort_id === selectedCohort && ra.role === 'student')) return true;
          return false;
        });

        setStudentsInCohort(students.map((u: Profile) => ({
          id: u.id,
          email: u.email,
          full_name: u.full_name,
        })));
      } catch (error) {
        console.error('Error fetching students:', error);
        setStudentsInCohort([]);
      }
    };

    fetchStudents();
  }, [selectedCohort]);

  const handleSingleUpload = async () => {
    if (!selectedFile || !selectedCohort || !selectedStudent || !invoiceNumber || !invoiceAmount) {
      toast.error('Please fill all required fields');
      return;
    }

    setUploadLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('user_id', selectedStudent);
      formData.append('cohort_id', selectedCohort);
      formData.append('invoice_number', invoiceNumber);
      formData.append('amount', invoiceAmount);
      if (dueDate) formData.append('due_date', dueDate);
      formData.append('payment_type', paymentType);
      formData.append('status', invoiceStatus);

      const response = await fetch('/api/admin/invoices/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to upload invoice');
      }

      toast.success('Invoice uploaded successfully');
      resetUploadForm();
      setUploadDialogOpen(false);
      fetchInvoices(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to upload invoice');
    } finally {
      setUploadLoading(false);
    }
  };

  const resetUploadForm = () => {
    setSelectedCohort('');
    setSelectedStudent('');
    setInvoiceNumber('');
    setInvoiceAmount('');
    setDueDate('');
    setPaymentType('full');
    setInvoiceStatus('pending');
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet) as Record<string, unknown>[];

        const rows: BulkMappingRow[] = jsonData.map((row) => ({
          filename: String(row['Filename'] || row['filename'] || row['File'] || '').trim(),
          email: String(row['Email'] || row['email'] || row['Student Email'] || '').trim().toLowerCase(),
          invoice_number: String(row['Invoice Number'] || row['invoice_number'] || row['Invoice'] || '').trim(),
          amount: parseFloat(String(row['Amount'] || row['amount'] || row['Total'] || 0)),
          due_date: row['Due Date'] || row['due_date'] ? String(row['Due Date'] || row['due_date']) : undefined,
        })).filter(r => r.filename && r.email && r.invoice_number);

        setBulkMappingRows(rows);
        setBulkStep('preview');
      } catch {
        toast.error('Failed to parse Excel file');
      }
    };
    reader.readAsArrayBuffer(file);

    if (bulkExcelInputRef.current) bulkExcelInputRef.current.value = '';
  };

  const handlePdfFilesUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const pdfFiles = Array.from(files).filter(f => f.type === 'application/pdf');
    setBulkPdfFiles(prev => [...prev, ...pdfFiles]);

    if (bulkPdfInputRef.current) bulkPdfInputRef.current.value = '';
  };

  const handleBulkUpload = async () => {
    if (!bulkCohort || bulkMappingRows.length === 0 || bulkPdfFiles.length === 0) {
      toast.error('Please select a cohort, upload mapping file, and upload PDFs');
      return;
    }

    setBulkLoading(true);
    try {
      const formData = new FormData();
      formData.append('cohort_id', bulkCohort);

      // Create a blob from mapping data
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(bulkMappingRows);
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Mapping');
      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const mappingBlob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      formData.append('mapping_file', mappingBlob, 'mapping.xlsx');

      // Append PDF files
      bulkPdfFiles.forEach((file, index) => {
        formData.append(`pdf_${index}`, file);
      });

      const response = await fetch('/api/admin/invoices/bulk-upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to upload invoices');
      }

      setBulkResults(data.results);
      setBulkStep('results');
      toast.success(data.message);
      fetchInvoices(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to upload invoices');
    } finally {
      setBulkLoading(false);
    }
  };

  const resetBulkForm = () => {
    setBulkCohort('');
    setBulkMappingRows([]);
    setBulkPdfFiles([]);
    setBulkResults(null);
    setBulkStep('upload');
  };

  const handleDelete = async () => {
    if (!invoiceToDelete) return;

    setDeleteLoading(true);
    try {
      const response = await fetch(`/api/admin/invoices?id=${invoiceToDelete.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete invoice');
      }

      toast.success('Invoice deleted successfully');
      setDeleteDialogOpen(false);
      setInvoiceToDelete(null);
      fetchInvoices(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete invoice');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleEditStatus = async () => {
    if (!invoiceToEdit) return;

    setEditStatusLoading(true);
    try {
      const response = await fetch('/api/admin/invoices', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: invoiceToEdit.id,
          status: newStatus,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update invoice status');
      }

      toast.success('Invoice status updated successfully');
      setEditStatusDialogOpen(false);
      setInvoiceToEdit(null);
      fetchInvoices(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update invoice status');
    } finally {
      setEditStatusLoading(false);
    }
  };

  const handleViewPdf = async (invoice: InvoiceWithRelations) => {
    if (!invoice.pdf_path) {
      toast.error('No PDF available for this invoice');
      return;
    }

    try {
      const supabase = getClient();
      const { data, error } = await supabase.storage
        .from('invoices')
        .createSignedUrl(invoice.pdf_path, 60);

      if (error || !data) {
        throw new Error('Failed to generate download link');
      }

      window.open(data.signedUrl, '_blank');
    } catch (error) {
      toast.error('Failed to open invoice PDF');
    }
  };

  const downloadTemplate = () => {
    const template = [
      {
        Filename: 'INV001.pdf',
        Email: 'student@example.com',
        'Invoice Number': 'INV-2025-001',
        Amount: 15000,
        'Due Date': '2025-03-01',
      },
      {
        Filename: 'INV002.pdf',
        Email: 'student2@example.com',
        'Invoice Number': 'INV-2025-002',
        Amount: 20000,
        'Due Date': '2025-03-15',
      },
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Invoice Mapping');
    XLSX.writeFile(wb, 'invoice_upload_template.xlsx');
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      paid: 'bg-green-500/10 text-green-600',
      pending: 'bg-amber-500/10 text-amber-600',
      overdue: 'bg-red-500/10 text-red-600',
    };

    const icons: Record<string, React.ReactNode> = {
      paid: <CheckCircle className="w-3 h-3" />,
      pending: <Clock className="w-3 h-3" />,
      overdue: <AlertCircle className="w-3 h-3" />,
    };

    return (
      <Badge className={colors[status] || 'bg-muted'}>
        <span className="flex items-center gap-1">
          {icons[status]}
          <span className="capitalize">{status}</span>
        </span>
      </Badge>
    );
  };


  if (loading) {
    return <PageLoader message="Loading invoices..." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Receipt}
        title="Invoices"
        description="Manage billing and payment records"
        action={
          <div className="flex items-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" onClick={downloadTemplate}>
                    <FileSpreadsheet className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Download bulk upload template</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <Button variant="outline" onClick={() => { resetBulkForm(); setBulkDialogOpen(true); }}>
              <Upload className="w-4 h-4 mr-2" />
              Bulk Upload
            </Button>
            <Button className="gradient-bg" onClick={() => { resetUploadForm(); setUploadDialogOpen(true); }}>
              <Upload className="w-4 h-4 mr-2" />
              Upload Invoice
            </Button>
          </div>
        }
      />

      {/* Stats Cards */}
      <MotionContainer className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MotionItem>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <Receipt className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Invoices</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </MotionItem>

        <MotionItem>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/10 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Paid</p>
                  <p className="text-2xl font-bold text-green-600">{stats.paid}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </MotionItem>

        <MotionItem>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-500/10 rounded-lg">
                  <Clock className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Pending</p>
                  <p className="text-2xl font-bold text-amber-600">{stats.pending}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </MotionItem>

        <MotionItem>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-500/10 rounded-lg">
                  <IndianRupee className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Amount</p>
                  <p className="text-2xl font-bold">{formatCurrency(stats.total_amount)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </MotionItem>
      </MotionContainer>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by student name, email, or invoice number..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  hasFetchedRef.current = false;
                }}
                className="pl-9"
              />
            </div>
            <Select value={cohortFilter} onValueChange={(v) => { setCohortFilter(v); hasFetchedRef.current = false; }}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Cohorts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Cohorts</SelectItem>
                {cohorts.map((cohort) => (
                  <SelectItem key={cohort.id} value={cohort.id}>
                    {cohort.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); hasFetchedRef.current = false; }}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={() => fetchInvoices(true)}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Invoices Table */}
      <MotionFadeIn delay={0.1}>
      <Card>
        <CardHeader>
          <CardTitle>All Invoices</CardTitle>
          <CardDescription>View and manage payment records</CardDescription>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No invoices found</p>
              <p className="text-sm">Upload invoices to get started</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Cohort</TableHead>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-[80px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{invoice.user?.full_name || 'Unknown'}</p>
                        <p className="text-sm text-muted-foreground">{invoice.user?.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{invoice.cohort?.name || 'N/A'}</Badge>
                    </TableCell>
                    <TableCell className="font-mono">{invoice.invoice_number}</TableCell>
                    <TableCell>{formatCurrency(invoice.amount)}</TableCell>
                    <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                    <TableCell>
                      {invoice.due_date ? format(new Date(invoice.due_date), 'MMM d, yyyy') : '-'}
                    </TableCell>
                    <TableCell>
                      {format(new Date(invoice.created_at), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleViewPdf(invoice)}>
                            <Eye className="w-4 h-4 mr-2" />
                            View PDF
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setInvoiceToEdit(invoice);
                              setNewStatus(invoice.status);
                              setEditStatusDialogOpen(true);
                            }}
                          >
                            <Pencil className="w-4 h-4 mr-2" />
                            Edit Status
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setInvoiceToDelete(invoice);
                              setDeleteDialogOpen(true);
                            }}
                            className="text-red-600"
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
          )}
        </CardContent>
      </Card>
      </MotionFadeIn>

      {/* Single Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Upload Invoice</DialogTitle>
            <DialogDescription>
              Upload a single invoice PDF for a student
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Cohort *</Label>
              <Select value={selectedCohort} onValueChange={setSelectedCohort}>
                <SelectTrigger>
                  <SelectValue placeholder="Select cohort" />
                </SelectTrigger>
                <SelectContent>
                  {cohorts.map((cohort) => (
                    <SelectItem key={cohort.id} value={cohort.id}>
                      {cohort.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Student *</Label>
              <Select
                value={selectedStudent}
                onValueChange={setSelectedStudent}
                disabled={!selectedCohort}
              >
                <SelectTrigger>
                  <SelectValue placeholder={selectedCohort ? "Select student" : "Select cohort first"} />
                </SelectTrigger>
                <SelectContent>
                  {studentsInCohort.map((student) => (
                    <SelectItem key={student.id} value={student.id}>
                      {student.full_name || student.email} ({student.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Invoice Number *</Label>
                <Input
                  placeholder="INV-2025-001"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Amount (₹) *</Label>
                <Input
                  type="number"
                  placeholder="15000"
                  value={invoiceAmount}
                  onChange={(e) => setInvoiceAmount(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Due Date</Label>
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Payment Type</Label>
                <Select value={paymentType} onValueChange={setPaymentType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full">Full Payment</SelectItem>
                    <SelectItem value="partial">Partial</SelectItem>
                    <SelectItem value="emi">EMI</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Invoice Status *</Label>
              <Select value={invoiceStatus} onValueChange={setInvoiceStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Invoice PDF *</Label>
              <p className="text-xs text-muted-foreground">PDF only, max 10MB</p>
              <div className="border-2 border-dashed rounded-lg p-4 text-center">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
                {selectedFile ? (
                  <div className="flex items-center justify-center gap-2">
                    <FileText className="w-5 h-5 text-red-500" />
                    <span className="text-sm">{selectedFile.name}</span>
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
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Select PDF
                  </Button>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSingleUpload} disabled={uploadLoading}>
              {uploadLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Upload Invoice
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Upload Dialog */}
      <Dialog open={bulkDialogOpen} onOpenChange={(open) => { setBulkDialogOpen(open); if (!open) resetBulkForm(); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Bulk Upload Invoices</DialogTitle>
            <DialogDescription>
              Upload multiple invoices using an Excel mapping file
            </DialogDescription>
          </DialogHeader>

          {bulkStep === 'upload' && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Cohort *</Label>
                <Select value={bulkCohort} onValueChange={setBulkCohort}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select cohort" />
                  </SelectTrigger>
                  <SelectContent>
                    {cohorts.map((cohort) => (
                      <SelectItem key={cohort.id} value={cohort.id}>
                        {cohort.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Excel Mapping File *</Label>
                <p className="text-sm text-muted-foreground">
                  Upload an Excel file with the following columns:
                </p>
                <div className="text-xs bg-muted/50 rounded-lg p-3 font-mono overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-muted-foreground/20">
                        <th className="pb-1 pr-4">Filename</th>
                        <th className="pb-1 pr-4">Email</th>
                        <th className="pb-1 pr-4">Invoice Number</th>
                        <th className="pb-1 pr-4">Amount</th>
                        <th className="pb-1">Due Date</th>
                      </tr>
                    </thead>
                    <tbody className="text-muted-foreground">
                      <tr>
                        <td className="pt-1 pr-4">INV001.pdf</td>
                        <td className="pt-1 pr-4">john@example.com</td>
                        <td className="pt-1 pr-4">INV-2025-001</td>
                        <td className="pt-1 pr-4">15000</td>
                        <td className="pt-1">2025-03-01</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={downloadTemplate}>
                    <Download className="w-3 h-3 mr-1" />
                    Download Template
                  </Button>
                </div>
                <div className="border-2 border-dashed rounded-lg p-4 text-center">
                  <input
                    ref={bulkExcelInputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleExcelUpload}
                    className="hidden"
                  />
                  <Button variant="outline" onClick={() => bulkExcelInputRef.current?.click()}>
                    <FileSpreadsheet className="w-4 h-4 mr-2" />
                    Select Excel File
                  </Button>
                </div>
              </div>
            </div>
          )}

          {bulkStep === 'preview' && (
            <div className="space-y-4 py-4">
              <div className="flex justify-between items-center">
                <p className="text-sm font-medium">{bulkMappingRows.length} invoices found in mapping file</p>
                <Button variant="outline" size="sm" onClick={() => setBulkStep('upload')}>
                  Back
                </Button>
              </div>

              <div className="max-h-48 overflow-y-auto border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Filename</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bulkMappingRows.slice(0, 10).map((row, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-mono text-xs">{row.filename}</TableCell>
                        <TableCell className="text-xs">{row.email}</TableCell>
                        <TableCell className="text-xs">{row.invoice_number}</TableCell>
                        <TableCell className="text-xs">{formatCurrency(row.amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {bulkMappingRows.length > 10 && (
                  <p className="text-center text-sm text-muted-foreground py-2">
                    ... and {bulkMappingRows.length - 10} more
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>PDF Files *</Label>
                <p className="text-xs text-muted-foreground">PDF only, max 10MB per file</p>
                <div className="border-2 border-dashed rounded-lg p-4">
                  <input
                    ref={bulkPdfInputRef}
                    type="file"
                    accept="application/pdf"
                    multiple
                    onChange={handlePdfFilesUpload}
                    className="hidden"
                  />
                  <div className="text-center mb-2">
                    <Button variant="outline" onClick={() => bulkPdfInputRef.current?.click()}>
                      <Upload className="w-4 h-4 mr-2" />
                      Add PDF Files
                    </Button>
                  </div>
                  {bulkPdfFiles.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {bulkPdfFiles.map((file, idx) => (
                        <Badge key={idx} variant="secondary" className="text-xs">
                          <FileText className="w-3 h-3 mr-1" />
                          {file.name}
                          <button
                            onClick={() => setBulkPdfFiles(prev => prev.filter((_, i) => i !== idx))}
                            className="ml-1 hover:text-red-500"
                          >
                            <XCircle className="w-3 h-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {bulkPdfFiles.length} of {bulkMappingRows.length} PDFs selected
                </p>
              </div>
            </div>
          )}

          {bulkStep === 'results' && bulkResults && (
            <div className="space-y-4 py-4">
              <div className="flex gap-4">
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="w-5 h-5" />
                  <span>{bulkResults.filter(r => r.success).length} successful</span>
                </div>
                <div className="flex items-center gap-2 text-red-600">
                  <XCircle className="w-5 h-5" />
                  <span>{bulkResults.filter(r => !r.success).length} failed</span>
                </div>
              </div>

              <div className="max-h-64 overflow-y-auto border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bulkResults.map((result, idx) => (
                      <TableRow key={idx}>
                        <TableCell>
                          {result.success ? (
                            <CheckCircle className="w-4 h-4 text-green-600" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-600" />
                          )}
                        </TableCell>
                        <TableCell className="text-xs">{result.row.email}</TableCell>
                        <TableCell className="text-xs">{result.row.invoice_number}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {result.success ? 'Uploaded' : result.error}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDialogOpen(false)}>
              {bulkStep === 'results' ? 'Close' : 'Cancel'}
            </Button>
            {bulkStep === 'preview' && (
              <Button onClick={handleBulkUpload} disabled={bulkLoading || bulkPdfFiles.length === 0}>
                {bulkLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Upload {bulkMappingRows.length} Invoices
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Invoice</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete invoice {invoiceToDelete?.invoice_number}?
              This will also delete the PDF file. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteLoading}
            >
              {deleteLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Status Dialog */}
      <Dialog open={editStatusDialogOpen} onOpenChange={setEditStatusDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit Invoice Status</DialogTitle>
            <DialogDescription>
              Update the status for invoice {invoiceToEdit?.invoice_number}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label>Status</Label>
            <Select value={newStatus} onValueChange={setNewStatus}>
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditStatusDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditStatus} disabled={editStatusLoading}>
              {editStatusLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Update Status
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
