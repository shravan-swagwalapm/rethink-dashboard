'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Award, FileText, Image as ImageIcon, RefreshCw, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import {
  CertificatePreviewModal,
  type CertificatePreviewTarget,
} from './certificate-preview-modal';

interface CertificateRow {
  id: string;
  cohort_id: string;
  cohort_name: string | null;
  cohort_end_date: string | null;
  file_type: string;
  file_size: number;
  uploaded_at: string;
}

interface ListResponse {
  certificates: CertificateRow[];
}

/**
 * Recipient-side Certificates card.
 *
 * Lifecycle:
 *   - Mount: fetch /api/certificates (RLS filters server-side).
 *   - Loading → skeleton. Error → retry button. Empty → empty state.
 *     Success → list of rows with thumbnails.
 *
 * Thumbnail strategy:
 *   - PNG/JPEG: lazily fetch a signed URL on row mount and render an inline
 *     image. The signed URL TTL is 60s, which is enough for the initial render
 *     and a refresh — if the user lingers and clicks later, the preview modal
 *     mints a fresh one anyway, so a stale thumbnail is at worst a broken
 *     placeholder image, never a security issue.
 *   - PDF: render a styled FileText icon. We do not attempt to render a PDF
 *     thumbnail server-side — out of scope for Phase 3 and the file-type badge
 *     plus the icon make the type obvious at a glance.
 *
 * Visibility contract (verified by tests + RLS):
 *   - Backed by RLS: cohort.status='completed' filters on the server. When an
 *     admin flips a cohort back to 'active', the next re-fetch (e.g. retry,
 *     remount, manual refresh) excludes those rows — no client-side cache.
 */
export function CertificatesCard() {
  const [certs, setCerts] = useState<CertificateRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previewTarget, setPreviewTarget] =
    useState<CertificatePreviewTarget | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const fetchCerts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/certificates', { cache: 'no-store' });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(body.error || 'Failed to load certificates');
        return;
      }
      const data = (await res.json()) as ListResponse;
      setCerts(data.certificates || []);
    } catch {
      setError('Network error — please try again');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchCerts();
  }, [fetchCerts]);

  const handleRowClick = (cert: CertificateRow) => {
    setPreviewTarget({
      id: cert.id,
      cohort_name: cert.cohort_name,
      file_type: cert.file_type,
    });
    setPreviewOpen(true);
  };

  const handlePreviewOpenChange = (open: boolean) => {
    setPreviewOpen(open);
    if (!open) {
      // Clear the target after close so the modal fully tears down state.
      setTimeout(() => setPreviewTarget(null), 200);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Award className="w-5 h-5" />
          Certificates
        </CardTitle>
        <CardDescription>
          Completion certificates from your cohorts
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading && (
          <div className="space-y-3">
            {[...Array(2)].map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <AlertTriangle className="w-8 h-8 text-destructive" />
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" size="sm" onClick={() => void fetchCerts()}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          </div>
        )}

        {!loading && !error && certs && certs.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Award className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p>No certificates yet</p>
            <p className="text-xs mt-1">
              Certificates appear here once your cohort is marked complete.
            </p>
          </div>
        )}

        {!loading && !error && certs && certs.length > 0 && (
          <div className="space-y-3">
            {certs.map((cert) => (
              <CertificateRowItem
                key={cert.id}
                cert={cert}
                onOpen={() => handleRowClick(cert)}
              />
            ))}
          </div>
        )}
      </CardContent>

      <CertificatePreviewModal
        cert={previewTarget}
        open={previewOpen}
        onOpenChange={handlePreviewOpenChange}
      />
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Row item — encapsulates per-row thumbnail signed-URL fetch.
// ---------------------------------------------------------------------------

interface CertificateRowItemProps {
  cert: CertificateRow;
  onOpen: () => void;
}

function CertificateRowItem({ cert, onOpen }: CertificateRowItemProps) {
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const isImage =
    cert.file_type === 'image/png' || cert.file_type === 'image/jpeg';

  useEffect(() => {
    if (!isImage) return;
    let cancelled = false;
    const fetchThumb = async () => {
      try {
        const res = await fetch(`/api/certificates/${cert.id}/signed-url`);
        if (!res.ok) return;
        const data = (await res.json()) as
          | { ok: true; url: string }
          | { error: string };
        if (cancelled) return;
        if ('ok' in data && data.ok) setThumbUrl(data.url);
      } catch {
        // Silent — thumbnail is decorative; preview modal will mint a fresh
        // URL with proper error handling on click.
      }
    };
    void fetchThumb();
    return () => {
      cancelled = true;
    };
  }, [cert.id, isImage]);

  const endDateLabel = cert.cohort_end_date
    ? format(new Date(cert.cohort_end_date), 'MMM d, yyyy')
    : 'No end date';

  const typeLabel = cert.file_type === 'application/pdf' ? 'PDF' : cert.file_type === 'image/png' ? 'PNG' : 'JPG';

  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full text-left flex items-center justify-between gap-4 p-4 rounded-lg border hover:bg-muted/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-center gap-4 min-w-0 flex-1">
        {/* Thumbnail */}
        <div className="w-16 h-16 rounded-lg overflow-hidden flex items-center justify-center bg-muted shrink-0 border">
          {isImage && thumbUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumbUrl}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : isImage ? (
            <ImageIcon className="w-6 h-6 text-muted-foreground" />
          ) : (
            <FileText className="w-6 h-6 text-primary" />
          )}
        </div>

        <div className="min-w-0">
          <p className="font-medium truncate">
            {cert.cohort_name || 'Cohort'}
          </p>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{endDateLabel}</span>
            <span aria-hidden="true">·</span>
            <Badge variant="secondary" className="text-xs">
              {typeLabel}
            </Badge>
          </div>
        </div>
      </div>

      <span className="text-sm text-primary font-medium shrink-0">
        Preview
      </span>
    </button>
  );
}
