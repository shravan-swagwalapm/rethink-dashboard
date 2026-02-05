'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, X, ExternalLink, Loader2, RefreshCw, AlertTriangle, FileText, File, Sheet, Presentation, FileCode, Maximize2, Keyboard } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

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

  // Get file icon component and styling based on file type
  const getFileIcon = () => {
    const type = fileType?.toLowerCase();
    switch (type) {
      case 'pdf':
        return { Icon: FileText, color: 'from-red-500 to-red-600 dark:from-red-600 dark:to-red-700', bg: 'bg-red-500/10 dark:bg-red-500/20' };
      case 'doc':
      case 'docx':
        return { Icon: FileText, color: 'from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700', bg: 'bg-blue-500/10 dark:bg-blue-500/20' };
      case 'ppt':
      case 'pptx':
        return { Icon: Presentation, color: 'from-orange-500 to-orange-600 dark:from-orange-600 dark:to-orange-700', bg: 'bg-orange-500/10 dark:bg-orange-500/20' };
      case 'xls':
      case 'xlsx':
      case 'csv':
        return { Icon: Sheet, color: 'from-green-500 to-green-600 dark:from-green-600 dark:to-green-700', bg: 'bg-green-500/10 dark:bg-green-500/20' };
      default:
        return { Icon: File, color: 'from-gray-500 to-gray-600 dark:from-gray-600 dark:to-gray-700', bg: 'bg-gray-500/10 dark:bg-gray-500/20' };
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

  const fileIconInfo = getFileIcon();
  const { Icon: FileIcon, color: iconColor, bg: iconBg } = fileIconInfo;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl max-h-[95vh] w-[95vw] flex flex-col p-0 overflow-hidden border-2 dark:border-primary/20 shadow-2xl shadow-primary/10">
        {/* Futuristic top accent gradient with glow */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-accent to-primary animate-gradient-x" />

        {/* Header with gradient background and enhanced styling */}
        <DialogHeader className="relative px-6 py-5 flex-shrink-0 bg-gradient-to-br from-card via-card/95 to-primary/5 dark:from-card dark:via-card/95 dark:to-primary/10 border-b-2 border-primary/20 dark:border-primary/30">
          {/* Decorative cyber grid pattern */}
          <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05] pointer-events-none grid-pattern" />

          <div className="relative flex items-center justify-between gap-4">
            {/* Enhanced file info with icon and badge */}
            <div className="flex items-center gap-4 flex-1 min-w-0">
              {/* Animated file icon with gradient */}
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.3 }}
                className={`w-14 h-14 rounded-xl bg-gradient-to-br ${iconColor} flex items-center justify-center text-white shadow-lg hover:scale-110 transition-transform duration-300 animate-breathe`}
              >
                <FileIcon className="w-7 h-7" />
              </motion.div>

              <div className="flex-1 min-w-0">
                <DialogTitle className="text-xl font-bold truncate pr-4 flex items-center gap-2 dark:text-white">
                  <span className="truncate">{fileName}</span>
                </DialogTitle>
                <div className="flex items-center gap-2 mt-1">
                  <Badge className={`${iconBg} border-0 font-semibold uppercase text-xs`}>
                    {fileType?.toUpperCase() || 'FILE'}
                  </Badge>
                  <Badge variant="outline" className="text-xs border-primary/30 dark:border-primary/50">
                    {getViewerName()}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Action buttons with enhanced styling */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenInNewTab}
                className="hidden sm:flex gap-2 hover:bg-primary/10 hover:border-primary/50 dark:hover:bg-primary/20 transition-all duration-300 hover:scale-105"
              >
                <Maximize2 className="w-4 h-4" />
                <span className="hidden md:inline">Open in Tab</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
                className="gap-2 gradient-bg text-white border-0 hover:opacity-90 transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-primary/30"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Download</span>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="hover:bg-destructive/10 hover:text-destructive transition-all duration-300 hover:scale-110 hover:rotate-90"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Main content area with enhanced background */}
        <div className="flex-1 overflow-hidden relative bg-gradient-to-br from-muted/5 via-background to-muted/10 dark:from-muted/10 dark:via-background dark:to-primary/5" style={{ minHeight: '65vh' }}>
          {/* Subtle dot pattern background */}
          <div className="absolute inset-0 opacity-[0.02] dark:opacity-[0.04] pointer-events-none dot-pattern" />

          {/* Enhanced Loading State with futuristic design */}
          <AnimatePresence>
            {state.loading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex items-center justify-center bg-background/80 dark:bg-background/90 backdrop-blur-md z-10"
              >
                <div className="flex flex-col items-center gap-6">
                  {/* Futuristic loader with orbiting elements */}
                  <div className="relative">
                    <div className="w-20 h-20 rounded-full border-4 border-primary/20 dark:border-primary/30" />
                    <div className="absolute inset-0 w-20 h-20 rounded-full border-4 border-transparent border-t-primary animate-spin" />
                    <div className="absolute inset-2 w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 animate-pulse-slow" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <FileIcon className="w-8 h-8 text-primary animate-breathe" />
                    </div>
                  </div>

                  <div className="text-center space-y-2">
                    <p className="text-lg font-semibold dark:text-white">Loading Document</p>
                    <p className="text-sm text-muted-foreground">
                      Preparing {fileType?.toUpperCase()} viewer...
                    </p>
                    {/* Progress indicator */}
                    <div className="w-48 h-1 bg-muted rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-gradient-to-r from-primary via-accent to-primary"
                        animate={{ x: ['-100%', '100%'] }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Enhanced Error State with styled error card */}
          <AnimatePresence>
            {state.error && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="absolute inset-0 flex items-center justify-center z-10 p-6"
              >
                <div className="max-w-md w-full">
                  {/* Error card with cyber styling */}
                  <div className="relative overflow-hidden rounded-2xl border-2 border-destructive/30 bg-gradient-to-br from-card via-card to-destructive/5 p-8 shadow-2xl shadow-destructive/10">
                    {/* Top accent */}
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-destructive/50 via-destructive to-destructive/50" />

                    <div className="flex flex-col items-center gap-6 text-center">
                      {/* Error icon with pulse */}
                      <div className="relative">
                        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-destructive/20 to-destructive/10 flex items-center justify-center animate-pulse">
                          <AlertTriangle className="w-10 h-10 text-destructive" />
                        </div>
                        <div className="absolute -inset-1 bg-destructive/20 rounded-full blur-xl animate-pulse" />
                      </div>

                      <div className="space-y-2">
                        <h3 className="text-xl font-bold dark:text-white">Unable to Load Document</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">{state.error}</p>
                      </div>

                      {/* Action buttons */}
                      <div className="flex flex-col sm:flex-row gap-3 w-full">
                        <Button
                          onClick={handleRetry}
                          variant="outline"
                          className="flex-1 gap-2 hover:bg-primary/10 hover:border-primary transition-all duration-300"
                        >
                          <RefreshCw className="w-4 h-4" />
                          Retry Loading
                        </Button>
                        <Button
                          onClick={handleOpenInNewTab}
                          className="flex-1 gap-2 gradient-bg text-white border-0"
                        >
                          <ExternalLink className="w-4 h-4" />
                          Open in Tab
                        </Button>
                      </div>

                      <Button
                        onClick={handleDownload}
                        variant="ghost"
                        className="w-full gap-2 hover:bg-muted"
                      >
                        <Download className="w-4 h-4" />
                        Download Instead
                      </Button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Document viewer iframe/object */}
          {shouldShowIframe && (
            <>
              {/* Loading indicator for iframe - styled notification */}
              <AnimatePresence>
                {!state.iframeLoaded && !state.loading && (
                  <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="absolute top-6 left-6 right-6 z-20 max-w-2xl mx-auto"
                  >
                    <div className="relative overflow-hidden rounded-xl border-2 border-yellow-500/30 dark:border-yellow-500/40 bg-gradient-to-r from-yellow-500/10 via-yellow-400/5 to-yellow-500/10 backdrop-blur-sm p-4 shadow-xl shadow-yellow-500/10">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-lg bg-yellow-500/20 dark:bg-yellow-500/30 flex items-center justify-center flex-shrink-0 animate-pulse">
                          <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                        </div>
                        <div className="flex-1 space-y-2">
                          <p className="text-sm font-medium text-yellow-900 dark:text-yellow-200">
                            Document taking longer to load?
                          </p>
                          <div className="flex flex-wrap gap-2 text-xs">
                            <button
                              onClick={handleTryAlternative}
                              className="px-3 py-1.5 rounded-lg bg-yellow-500/20 hover:bg-yellow-500/30 dark:bg-yellow-500/30 dark:hover:bg-yellow-500/40 text-yellow-900 dark:text-yellow-200 font-medium transition-all duration-200 hover:scale-105"
                            >
                              Try Alternative Viewer
                            </button>
                            <button
                              onClick={handleDownload}
                              className="px-3 py-1.5 rounded-lg bg-yellow-500/20 hover:bg-yellow-500/30 dark:bg-yellow-500/30 dark:hover:bg-yellow-500/40 text-yellow-900 dark:text-yellow-200 font-medium transition-all duration-200 hover:scale-105"
                            >
                              Download File
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {state.strategy === 'blob' ? (
                <object
                  data={state.viewerUrl}
                  type="application/pdf"
                  className="absolute inset-0 w-full h-full rounded-b-lg"
                  onLoad={handleIframeLoad}
                  onError={handleIframeError}
                  aria-label={`PDF viewer for ${fileName}`}
                >
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center space-y-4 max-w-md p-6">
                      <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center">
                        <FileText className="w-8 h-8 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-semibold mb-2 dark:text-white">Browser PDF Viewer Not Available</p>
                        <p className="text-sm text-muted-foreground mb-4">
                          Your browser doesn&apos;t support inline PDF viewing.
                        </p>
                      </div>
                      <Button onClick={handleDownload} className="gradient-bg text-white">
                        <Download className="w-4 h-4 mr-2" />
                        Download PDF
                      </Button>
                    </div>
                  </div>
                </object>
              ) : (
                <iframe
                  ref={iframeRef}
                  src={state.viewerUrl}
                  className="absolute inset-0 w-full h-full border-0 rounded-b-lg"
                  title={`Document viewer for ${fileName}`}
                  sandbox={getSandboxAttrs()}
                  allow="autoplay; fullscreen; clipboard-write"
                  onLoad={handleIframeLoad}
                  onError={handleIframeError}
                  aria-label={`${fileType?.toUpperCase()} document viewer`}
                />
              )}
            </>
          )}
        </div>

        {/* Enhanced Footer with keyboard shortcuts and viewer info */}
        <div className="relative px-6 py-4 border-t-2 border-primary/20 bg-gradient-to-br from-muted/30 via-card to-primary/5 dark:from-muted/20 dark:via-card dark:to-primary/10 flex-shrink-0">
          {/* Decorative top border glow */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
            {/* Viewer info */}
            <div className="flex items-center gap-3 text-muted-foreground">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="font-medium">Viewing with {getViewerName()}</span>
              </div>
              {state.strategy !== 'none' && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 border-primary/30">
                  {state.strategy}
                </Badge>
              )}
            </div>

            {/* Keyboard shortcuts hint */}
            <div className="hidden lg:flex items-center gap-2 text-muted-foreground">
              <Keyboard className="w-3.5 h-3.5" />
              <span>Press <kbd className="px-1.5 py-0.5 rounded bg-muted border text-[10px] font-mono">ESC</kbd> to close</span>
            </div>

            {/* Download recommendation */}
            <span className="text-muted-foreground text-center sm:text-right">
              For best experience, download and open in native app
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
