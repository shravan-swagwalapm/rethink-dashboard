'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Download, Loader2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

export interface CertificatePreviewTarget {
  id: string;
  cohort_name: string | null;
  file_type: string;
}

interface CertificatePreviewModalProps {
  cert: CertificatePreviewTarget | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Module-level helper for fetching a fresh signed URL for a certificate.
 *
 * Used by both the open-effect and the retry-button handler so the two paths
 * share one error-narrowing contract. The caller owns the AbortController:
 *
 *   - open-effect: aborts on unmount / cert change (prevents a late resolution
 *     from writing into the next cert's state).
 *   - retry handler: aborts the previous in-flight retry on each click via a
 *     ref-stored controller, and the open-effect's cleanup aborts retries too.
 *
 * Throws on non-ok response or shape mismatch — DOMException(name='AbortError')
 * is the abort signal, which callers should swallow.
 */
async function fetchCertificateSignedUrl(
  certId: string,
  signal: AbortSignal,
): Promise<string> {
  const res = await fetch(`/api/certificates/${certId}/signed-url`, { signal });
  const data = await res.json();
  if (!res.ok || !data?.ok) {
    throw new Error(
      typeof data?.error === 'string' ? data.error : 'Failed to load certificate',
    );
  }
  return data.url as string;
}

/**
 * Modal that lazily fetches a fresh 60s signed URL on open, renders the cert
 * inline (image or PDF), and provides a Download button that forces a file
 * download with the original extension preserved.
 *
 * Notes:
 * - The signed URL is fetched ON OPEN, not pre-fetched at the card level —
 *   keeps every download path on a fresh TTL.
 * - For images we use a plain <img> so dimensions match the source aspect.
 *   Inline PDFs go through <object> with an <a> fallback for browsers that
 *   refuse to embed.
 * - Download uses fetch → blob → anchor-click. The signed URL from Supabase
 *   doesn't set content-disposition: attachment by default, and the service
 *   module doesn't accept a `download` param, so we sidestep that entirely on
 *   the client by piping bytes through a blob URL.
 */
export function CertificatePreviewModal({
  cert,
  open,
  onOpenChange,
}: CertificatePreviewModalProps) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  // A separate controller for retry-button fetches. Stored in a ref so a fresh
  // retry can abort the previous in-flight retry (and the open-effect cleanup
  // can abort retries when the user closes / switches certs mid-flight).
  const retryControllerRef = useRef<AbortController | null>(null);

  // Fetch signed URL when the modal opens for a given cert. Reset when it
  // closes so the next open always re-fetches (sub-60s window for any
  // download is desirable; stale URLs would silently fail).
  useEffect(() => {
    if (!open || !cert) {
      setSignedUrl(null);
      setError(null);
      setLoading(false);
      // Belt-and-suspenders: any retry still in flight from a previous open
      // pass must not be allowed to setSignedUrl on the now-closed modal.
      retryControllerRef.current?.abort();
      retryControllerRef.current = null;
      return;
    }

    const controller = new AbortController();
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const url = await fetchCertificateSignedUrl(cert.id, controller.signal);
        if (controller.signal.aborted) return;
        setSignedUrl(url);
      } catch (e) {
        if (controller.signal.aborted) return;
        const message =
          e instanceof Error && e.message
            ? e.message === 'Failed to fetch'
              ? 'Network error — please try again'
              : e.message
            : 'Network error — please try again';
        setError(message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void run();
    return () => {
      controller.abort();
      // Also kill any retry that was kicked off during this open pass.
      retryControllerRef.current?.abort();
      retryControllerRef.current = null;
    };
  }, [open, cert]);

  const extensionFor = (mime: string): string => {
    if (mime === 'image/png') return 'png';
    if (mime === 'image/jpeg') return 'jpg';
    if (mime === 'application/pdf') return 'pdf';
    return 'bin';
  };

  const filenameFor = (cert: CertificatePreviewTarget): string => {
    const safe = (cert.cohort_name || 'certificate')
      .replace(/[^a-zA-Z0-9-_ ]+/g, '')
      .trim()
      .replace(/\s+/g, '-');
    return `${safe || 'certificate'}.${extensionFor(cert.file_type)}`;
  };

  const handleDownload = async () => {
    if (!cert) return;
    setDownloading(true);
    try {
      // Re-mint a signed URL at click time. Belt-and-suspenders against the
      // case where the user lingered past the 60s TTL after opening.
      const res = await fetch(`/api/certificates/${cert.id}/signed-url`);
      const data = (await res.json()) as
        | { ok: true; url: string }
        | { error: string };
      if (!res.ok || !('ok' in data) || !data.ok) {
        const message =
          'error' in data ? data.error : 'Failed to download certificate';
        toast.error(message);
        return;
      }

      // Fetch the bytes, build a blob URL, click an anchor. Preserves the
      // filename and forces a download regardless of content-disposition.
      const fileRes = await fetch(data.url);
      if (!fileRes.ok) {
        toast.error('Failed to download certificate');
        return;
      }
      const blob = await fileRes.blob();
      const blobUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = blobUrl;
      anchor.download = filenameFor(cert);
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      // Revoke on next tick so Safari has time to start the download.
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
      toast.success('Certificate downloaded');
    } catch {
      toast.error('Failed to download certificate');
    } finally {
      setDownloading(false);
    }
  };

  if (!cert) return null;

  const isPdf = cert.file_type === 'application/pdf';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{cert.cohort_name || 'Certificate'}</DialogTitle>
          <DialogDescription>
            Certificate of completion. Download to save a copy.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-[40vh] flex items-center justify-center">
          {loading && (
            <div className="w-full space-y-3">
              <Skeleton className="h-[60vh] w-full rounded-lg" />
            </div>
          )}

          {!loading && error && (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <AlertTriangle className="w-8 h-8 text-destructive" />
              <p className="text-sm text-muted-foreground">{error}</p>
              <Button
                variant="outline"
                size="sm"
                disabled={loading}
                onClick={() => {
                  // Each retry gets its own AbortController stored in a ref so
                  // a follow-up retry (or modal close, see effect cleanup)
                  // aborts the previous one. Without this, triple-clicking
                  // Retry would spawn three parallel fetches and the last to
                  // resolve would win — including against a stale cert.
                  retryControllerRef.current?.abort();
                  const controller = new AbortController();
                  retryControllerRef.current = controller;
                  setError(null);
                  setLoading(true);
                  fetchCertificateSignedUrl(cert.id, controller.signal)
                    .then((url) => {
                      if (controller.signal.aborted) return;
                      setSignedUrl(url);
                    })
                    .catch((e: unknown) => {
                      if (controller.signal.aborted) return;
                      const message =
                        e instanceof Error && e.message
                          ? e.message === 'Failed to fetch'
                            ? 'Network error — please try again'
                            : e.message
                          : 'Network error — please try again';
                      setError(message);
                    })
                    .finally(() => {
                      if (!controller.signal.aborted) setLoading(false);
                    });
                }}
              >
                Retry
              </Button>
            </div>
          )}

          {!loading && !error && signedUrl && (
            <div className="w-full">
              {isPdf ? (
                <object
                  data={signedUrl}
                  type="application/pdf"
                  className="w-full h-[70vh] rounded-lg border"
                  aria-label={`${cert.cohort_name || 'Certificate'} (PDF)`}
                >
                  <div className="p-6 text-center text-sm text-muted-foreground">
                    Your browser cannot display this PDF inline.{' '}
                    <a
                      href={signedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline text-primary"
                    >
                      Open in new tab
                    </a>
                    .
                  </div>
                </object>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={signedUrl}
                  alt={`${cert.cohort_name || 'Certificate'}`}
                  className="max-h-[70vh] max-w-full mx-auto object-contain rounded-lg border"
                />
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end pt-2">
          <Button
            onClick={handleDownload}
            disabled={downloading || !!error}
            className="gradient-bg hover:opacity-90"
          >
            {downloading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Downloading...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Download
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
