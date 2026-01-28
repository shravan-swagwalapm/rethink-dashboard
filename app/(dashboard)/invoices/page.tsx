'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/hooks/use-user';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageLoader } from '@/components/ui/page-loader';
import { toast } from 'sonner';
import {
  Receipt,
  Download,
  CheckCircle,
  Clock,
  AlertCircle,
  IndianRupee,
  FileText,
  Calendar,
} from 'lucide-react';
import { format } from 'date-fns';
import type { Invoice, Cohort } from '@/types';

interface InvoiceWithCohort extends Invoice {
  cohort?: Cohort;
}

interface InvoiceStats {
  total: number;
  paid: number;
  pending: number;
  overdue: number;
  total_amount: number;
  paid_amount: number;
  pending_amount: number;
}

export default function StudentInvoicesPage() {
  const router = useRouter();
  const { profile, loading: userLoading, isAdmin } = useUser();
  const [invoices, setInvoices] = useState<InvoiceWithCohort[]>([]);
  const [stats, setStats] = useState<InvoiceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const hasFetchedRef = useRef(false);

  useEffect(() => {
    // Redirect admin to admin page
    if (!userLoading && isAdmin) {
      router.push('/admin/invoices');
      return;
    }

    const fetchInvoices = async () => {
      if (!profile || hasFetchedRef.current) return;
      hasFetchedRef.current = true;

      try {
        const response = await fetch('/api/invoices');
        if (!response.ok) throw new Error('Failed to fetch invoices');

        const data = await response.json();
        setInvoices(data.invoices || []);
        setStats(data.stats || null);
      } catch (error) {
        console.error('Error fetching invoices:', error);
        toast.error('Failed to load invoices');
      } finally {
        setLoading(false);
      }
    };

    if (profile) {
      fetchInvoices();
    } else if (!userLoading) {
      setLoading(false);
    }
  }, [profile, userLoading, isAdmin, router]);

  const handleDownload = async (invoice: InvoiceWithCohort) => {
    if (!invoice.pdf_path) {
      toast.error('No PDF available for this invoice');
      return;
    }

    setDownloadingId(invoice.id);
    try {
      const response = await fetch(`/api/invoices/${invoice.id}/download`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to download invoice');
      }

      // Open the signed URL in a new tab
      window.open(data.url, '_blank');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to download invoice');
    } finally {
      setDownloadingId(null);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-amber-600" />;
      case 'overdue':
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-500/10 text-green-600 border-green-500/20';
      case 'pending':
        return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
      case 'overdue':
        return 'bg-red-500/10 text-red-600 border-red-500/20';
      default:
        return 'bg-muted';
    }
  };

  if (userLoading || loading) {
    return <PageLoader message="Loading invoices..." />;
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Please sign in to view your invoices</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">My Invoices</h1>
        <p className="text-muted-foreground">
          View and download your payment invoices
        </p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <Receipt className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Invoices</p>
                  <p className="text-xl font-bold">{stats.total}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/10 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Amount Paid</p>
                  <p className="text-xl font-bold text-green-600">{formatCurrency(stats.paid_amount)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-500/10 rounded-lg">
                  <IndianRupee className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Pending Amount</p>
                  <p className="text-xl font-bold text-amber-600">{formatCurrency(stats.pending_amount)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Invoices List */}
      <Card>
        <CardHeader>
          <CardTitle>All Invoices</CardTitle>
          <CardDescription>Your payment history across all programs</CardDescription>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No invoices yet</p>
              <p className="text-sm">Your invoices will appear here once generated</p>
            </div>
          ) : (
            <div className="space-y-4">
              {invoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start gap-4">
                    <div className="p-2 bg-red-500/10 rounded-lg">
                      <FileText className="w-5 h-5 text-red-600" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium font-mono">{invoice.invoice_number}</p>
                        <Badge className={getStatusColor(invoice.status)}>
                          <span className="flex items-center gap-1">
                            {getStatusIcon(invoice.status)}
                            <span className="capitalize">{invoice.status}</span>
                          </span>
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                        {invoice.cohort && (
                          <span className="flex items-center gap-1">
                            <Badge variant="outline" className="font-normal">
                              {invoice.cohort.name}
                            </Badge>
                          </span>
                        )}
                        {invoice.due_date && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            Due: {format(new Date(invoice.due_date), 'MMM d, yyyy')}
                          </span>
                        )}
                        <span>Created: {format(new Date(invoice.created_at), 'MMM d, yyyy')}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 sm:flex-shrink-0">
                    <p className="text-lg font-bold">{formatCurrency(invoice.amount)}</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownload(invoice)}
                      disabled={downloadingId === invoice.id || !invoice.pdf_path}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      {downloadingId === invoice.id ? 'Opening...' : 'Download'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
