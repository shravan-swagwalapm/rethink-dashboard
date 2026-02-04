'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Receipt, ChevronRight, CheckCircle, Clock, AlertCircle, Download, Eye } from 'lucide-react';
import Link from 'next/link';
import type { Invoice, Cohort } from '@/types';

interface InvoiceWithCohort extends Invoice {
  cohort?: Cohort;
}

interface InvoiceCardProps {
  invoices: InvoiceWithCohort[];
  pendingAmount: number;
  onDownload?: (invoice: InvoiceWithCohort) => void;
  onView?: (invoice: InvoiceWithCohort) => void;
}

export function InvoiceCard({ invoices, pendingAmount, onDownload, onView }: InvoiceCardProps) {
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
        return <CheckCircle className="w-3 h-3 text-green-600" />;
      case 'pending':
        return <Clock className="w-3 h-3 text-amber-600" />;
      case 'overdue':
        return <AlertCircle className="w-3 h-3 text-red-600" />;
      default:
        return <Clock className="w-3 h-3" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-500/10 text-green-600';
      case 'pending':
        return 'bg-amber-500/10 text-amber-600';
      case 'overdue':
        return 'bg-red-500/10 text-red-600';
      default:
        return 'bg-muted';
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-purple-600" />
            <CardTitle className="text-lg">Invoices</CardTitle>
          </div>
          <Link href="/invoices">
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
              View All
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        </div>
        {pendingAmount > 0 && (
          <CardDescription>
            Pending: <span className="font-medium text-amber-600">{formatCurrency(pendingAmount)}</span>
          </CardDescription>
        )}
      </CardHeader>
      <CardContent>
        {invoices.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Receipt className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No invoices yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {invoices.slice(0, 3).map((invoice) => (
              <div
                key={invoice.id}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Badge className={`${getStatusColor(invoice.status)} shrink-0`}>
                    <span className="flex items-center gap-1">
                      {getStatusIcon(invoice.status)}
                      <span className="capitalize text-xs">{invoice.status}</span>
                    </span>
                  </Badge>
                  <div className="min-w-0">
                    <p className="font-mono text-sm truncate">{invoice.invoice_number}</p>
                    <p className="text-xs text-muted-foreground">
                      {invoice.cohort?.name || 'N/A'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-medium text-sm">{formatCurrency(invoice.amount)}</span>
                  {invoice.pdf_path && onView && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => onView(invoice)}
                      title="View Invoice"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                  )}
                  {invoice.pdf_path && onDownload && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => onDownload(invoice)}
                      title="Download Invoice"
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
