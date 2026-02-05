'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, X, ExternalLink, Loader2, RefreshCw, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface UniversalViewerProps {
  fileUrl: string;
  fileName: string;
  fileType: string;
  isOpen: boolean;
  onClose: () => void;
}

type ViewerStrategy = 'blob' | 'office' | 'google' | 'direct' | 'none';

interface ViewerState {
  loading: boolean;
  error: string | null;
  strategy: ViewerStrategy;
  viewerUrl: string;
  retryCount: number;
  iframeLoaded: boolean;
  iframeError: boolean;
}

const LOG_PREFIX = '[UniversalViewer]';

function log(message: string, data?: unknown) {
  console.log(`${LOG_PREFIX} ${message}`, data !== undefined ? data : '');
}

function logError(message: string, error?: unknown) {
  console.error(`${LOG_PREFIX} ERROR: ${message}`, error !== undefined ? error : '');
}

export function UniversalViewer({ fileUrl, fileName, fileType, isOpen, onClose }: UniversalViewerProps) {
  const [state, setState] = useState<ViewerState>({
    loading: true,
    error: null,
    strategy: 'none',
    viewerUrl: '',
    retryCount: 0,
    iframeLoaded: false,
    iframeError: false,
  });

  const blobUrlRef = useRef<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const loadTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup blob URL on unmount or when creating new one
  const cleanupBlobUrl = useCallback(() => {
    if (blobUrlRef.current) {
      log('Revoking blob URL:', blobUrlRef.current.substring(0, 50) + '...');
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
  }, []);

  // Clear any pending timeouts
  const clearLoadTimeout = useCallback(() => {
    if (loadTimeoutRef.current) {
      clearTimeout(loadTimeoutRef.current);
      loadTimeoutRef.current = null;
    }
  }, []);

  // Get the appropriate viewer strategy based on file type
  const getViewerStrategy = useCallback((type: string): ViewerStrategy => {
    const normalizedType = type?.toLowerCase() || '';

    // PDFs work best with blob URLs in browser's native viewer
    if (normalizedType === 'pdf') {
      return 'blob';
    }

    // Office documents - try Office Online first, fallback to Google
    if (['doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx'].includes(normalizedType)) {
      return 'office';
    }

    // CSV and other formats - use Google Docs viewer
    if (normalizedType === 'csv') {
      return 'google';
    }

    // Default to Google viewer
    return 'google';
  }, []);

  // Build viewer URL based on strategy
  const buildViewerUrl = useCallback((strategy: ViewerStrategy, sourceUrl: string): string => {
    const encoded = encodeURIComponent(sourceUrl);

    switch (strategy) {
      case 'blob':
        return sourceUrl; // Blob URL is used directly
      case 'office':
        return `https://view.officeapps.live.com/op/embed.aspx?src=${encoded}`;
      case 'google':
        return `https://docs.google.com/viewer?url=${encoded}&embedded=true`;
      case 'direct':
        return sourceUrl;
      default:
        return '';
    }
  }, []);

  // Fetch file as blob for PDF viewing
  const fetchAsBlob = useCallback(async (url: string): Promise<string> => {
    log('Fetching file as blob from:', url.substring(0, 100) + '...');

    const response = await fetch(url, {
      method: 'GET',
      credentials: 'omit', // Don't send cookies to Supabase storage
      headers: {
        'Accept': 'application/pdf,application/octet-stream,*/*',
      },
    });

    log('Blob fetch response:', {
      status: response.status,
      statusText: response.statusText,
      contentType: response.headers.get('content-type'),
      contentLength: response.headers.get('content-length'),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const blob = await response.blob();
    log('Blob created:', {
      size: blob.size,
      type: blob.type,
    });

    if (blob.size === 0) {
      throw new Error('Received empty blob - file may be inaccessible');
    }

    // Create blob URL with proper MIME type
    const mimeType = blob.type || 'application/pdf';
    const typedBlob = new Blob([blob], { type: mimeType });
    const blobUrl = URL.createObjectURL(typedBlob);

    log('Created blob URL:', blobUrl.substring(0, 50) + '...');
    return blobUrl;
  }, []);

  // Attempt to load with a specific strategy
  const attemptLoad = useCallback(async (strategy: ViewerStrategy, sourceUrl: string) => {
    log(`Attempting load with strategy: ${strategy}`);

    clearLoadTimeout();

    if (strategy === 'blob') {
      try {
        cleanupBlobUrl();
        const blobUrl = await fetchAsBlob(sourceUrl);
        blobUrlRef.current = blobUrl;

        setState(prev => ({
          ...prev,
          loading: false,
          error: null,
          strategy: 'blob',
          viewerUrl: blobUrl,
          iframeLoaded: false,
          iframeError: false,
        }));
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        logError('Blob fetch failed:', err);

        // Fallback to Google viewer for PDFs
        log('Falling back to Google viewer');
        const googleUrl = buildViewerUrl('google', sourceUrl);

        setState(prev => ({
          ...prev,
          loading: false,
          error: null,
          strategy: 'google',
          viewerUrl: googleUrl,
          iframeLoaded: false,
          iframeError: false,
        }));
      }
    } else {
      // For iframe-based viewers, just set the URL
      const viewerUrl = buildViewerUrl(strategy, sourceUrl);
      log(`Built viewer URL for ${strategy}:`, viewerUrl.substring(0, 100) + '...');

      setState(prev => ({
        ...prev,
        loading: false,
        error: null,
        strategy,
        viewerUrl,
        iframeLoaded: false,
        iframeError: false,
      }));

      // Set a timeout to detect iframe loading failures
      loadTimeoutRef.current = setTimeout(() => {
        log('Iframe load timeout - checking if fallback needed');
        setState(prev => {
          // If iframe hasn't loaded and no error yet, might be a silent failure
          if (!prev.iframeLoaded && !prev.iframeError && prev.strategy === 'office') {
            log('Office viewer timeout - falling back to Google');
            return {
              ...prev,
              strategy: 'google',
              viewerUrl: buildViewerUrl('google', sourceUrl),
            };
          }
          return prev;
        });
      }, 15000); // 15 second timeout for iframe to show content
    }
  }, [cleanupBlobUrl, fetchAsBlob, buildViewerUrl, clearLoadTimeout]);

  // Handle iframe load event
  const handleIframeLoad = useCallback(() => {
    log('Iframe load event fired');
    clearLoadTimeout();
    setState(prev => ({ ...prev, iframeLoaded: true, iframeError: false }));
  }, [clearLoadTimeout]);

  // Handle iframe error
  const handleIframeError = useCallback(() => {
    logError('Iframe error event fired');
    clearLoadTimeout();

    setState(prev => {
      // Try fallback if available
      if (prev.strategy === 'office') {
        log('Office viewer failed - falling back to Google');
        return {
          ...prev,
          strategy: 'google',
          viewerUrl: buildViewerUrl('google', fileUrl),
          iframeError: false,
        };
      }

      return {
        ...prev,
        iframeError: true,
        error: 'Failed to load document viewer. Please try downloading the file.',
      };
    });
  }, [buildViewerUrl, fileUrl, clearLoadTimeout]);

  // Retry loading
  const handleRetry = useCallback(() => {
    log('Retry requested');
    setState(prev => ({
      ...prev,
      loading: true,
      error: null,
      retryCount: prev.retryCount + 1,
      iframeLoaded: false,
      iframeError: false,
    }));

    const strategy = getViewerStrategy(fileType);
    attemptLoad(strategy, fileUrl);
  }, [fileType, fileUrl, getViewerStrategy, attemptLoad]);

  // Switch to fallback viewer
  const handleTryAlternative = useCallback(() => {
    log('Trying alternative viewer');

    setState(prev => {
      if (prev.strategy === 'office') {
        return {
          ...prev,
          strategy: 'google',
          viewerUrl: buildViewerUrl('google', fileUrl),
          error: null,
          iframeLoaded: false,
          iframeError: false,
        };
      } else if (prev.strategy === 'google' || prev.strategy === 'blob') {
        // Last resort - direct link
        return {
          ...prev,
          error: 'Unable to preview this file. Please download to view.',
        };
      }
      return prev;
    });
  }, [buildViewerUrl, fileUrl]);

  // Main effect - initialize viewer when dialog opens
  useEffect(() => {
    if (!isOpen) {
      log('Dialog closed - cleaning up');
      cleanupBlobUrl();
      clearLoadTimeout();
      setState({
        loading: true,
        error: null,
        strategy: 'none',
        viewerUrl: '',
        retryCount: 0,
        iframeLoaded: false,
        iframeError: false,
      });
      return;
    }

    if (!fileUrl) {
      logError('No file URL provided');
      setState(prev => ({
        ...prev,
        loading: false,
        error: 'No file URL provided',
      }));
      return;
    }

    log('Initializing viewer:', {
      fileName,
      fileType,
      fileUrl: fileUrl.substring(0, 100) + '...',
    });

    const strategy = getViewerStrategy(fileType);
    log('Selected strategy:', strategy);

    attemptLoad(strategy, fileUrl);

    return () => {
      cleanupBlobUrl();
      clearLoadTimeout();
    };
  }, [isOpen, fileUrl, fileType, fileName, getViewerStrategy, attemptLoad, cleanupBlobUrl, clearLoadTimeout]);

  const handleDownload = () => {
    log('Download requested');
    window.open(fileUrl, '_blank');
  };

  const handleOpenInNewTab = () => {
    log('Open in new tab requested');
    window.open(fileUrl, '_blank');
  };

  const getFileIcon = () => {
    switch (fileType?.toLowerCase()) {
      case 'pdf':
        return '📄';
      case 'doc':
      case 'docx':
        return '📝';
      case 'ppt':
      case 'pptx':
        return '📊';
      case 'xls':
      case 'xlsx':
      case 'csv':
        return '📈';
      default:
        return '📎';
    }
  };

  const getViewerName = () => {
    switch (state.strategy) {
      case 'blob':
        return 'Browser PDF Viewer';
      case 'office':
        return 'Microsoft Office Online';
      case 'google':
        return 'Google Docs Viewer';
      case 'direct':
        return 'Direct View';
      default:
        return 'Document Viewer';
    }
  };

  const shouldShowIframe = !state.loading && !state.error && state.viewerUrl;

  // Determine iframe sandbox attributes based on strategy
  const getSandboxAttrs = (): string | undefined => {
    // Blob URLs for PDFs don't need sandbox restrictions
    if (state.strategy === 'blob') {
      return undefined; // No sandbox for blob PDFs - browser handles security
    }
    // External viewers need scripts and forms
    return 'allow-scripts allow-same-origin allow-popups allow-forms allow-downloads allow-presentation';
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[95vh] w-[95vw] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b flex-shrink-0 bg-background">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-semibold truncate pr-4 flex items-center gap-2">
              <span className="text-2xl">{getFileIcon()}</span>
              <span className="truncate">{fileName}</span>
            </DialogTitle>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenInNewTab}
                className="hidden sm:flex"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Open in Tab
              </Button>
              <Button variant="outline" size="sm" onClick={handleDownload}>
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden relative bg-muted/10" style={{ minHeight: '60vh' }}>
          {/* Loading State */}
          {state.loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Loading {fileType?.toUpperCase()}...</p>
              </div>
            </div>
          )}

          {/* Error State */}
          {state.error && (
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <div className="flex flex-col items-center gap-4 max-w-md text-center px-4">
                <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
                  <X className="w-8 h-8 text-destructive" />
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Unable to Load File</h3>
                  <p className="text-sm text-muted-foreground">{state.error}</p>
                </div>
                <div className="flex gap-2 flex-wrap justify-center">
                  <Button onClick={handleRetry} variant="outline">
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Retry
                  </Button>
                  <Button onClick={handleOpenInNewTab}>
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Open in New Tab
                  </Button>
                  <Button onClick={handleDownload} variant="outline">
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Iframe Container */}
          {shouldShowIframe && (
            <>
              {/* iframe not loaded warning - shows after a delay */}
              {!state.iframeLoaded && !state.loading && (
                <div className="absolute top-4 left-4 right-4 z-20">
                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-4 py-2 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-yellow-600 flex-shrink-0" />
                    <span className="text-sm text-yellow-700 dark:text-yellow-300">
                      If the document doesn&apos;t appear,
                      <button
                        onClick={handleTryAlternative}
                        className="underline mx-1 hover:no-underline"
                      >
                        try an alternative viewer
                      </button>
                      or
                      <button
                        onClick={handleDownload}
                        className="underline ml-1 hover:no-underline"
                      >
                        download the file
                      </button>
                    </span>
                  </div>
                </div>
              )}

              {state.strategy === 'blob' ? (
                // For blob PDFs, use object tag which handles PDFs better
                <object
                  data={state.viewerUrl}
                  type="application/pdf"
                  className="absolute inset-0 w-full h-full"
                  onLoad={handleIframeLoad}
                  onError={handleIframeError}
                >
                  {/* Fallback content if object fails */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <p className="text-muted-foreground mb-4">
                        Your browser cannot display this PDF.
                      </p>
                      <Button onClick={handleDownload}>
                        <Download className="w-4 h-4 mr-2" />
                        Download PDF
                      </Button>
                    </div>
                  </div>
                </object>
              ) : (
                // For external viewers, use iframe
                <iframe
                  ref={iframeRef}
                  src={state.viewerUrl}
                  className="absolute inset-0 w-full h-full border-0"
                  title={fileName}
                  sandbox={getSandboxAttrs()}
                  allow="autoplay; fullscreen; clipboard-write"
                  onLoad={handleIframeLoad}
                  onError={handleIframeError}
                />
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t bg-muted/30 text-sm text-muted-foreground text-center flex-shrink-0">
          <span className="hidden sm:inline">
            Viewing with {getViewerName()}
            {state.strategy !== 'none' && (
              <span className="text-xs ml-2 opacity-60">
                (Strategy: {state.strategy})
              </span>
            )}
            {' • '}
          </span>
          For full features, download and open in the native application
        </div>
      </DialogContent>
    </Dialog>
  );
}
