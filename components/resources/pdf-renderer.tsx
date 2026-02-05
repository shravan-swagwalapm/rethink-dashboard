'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Loader2, AlertTriangle, Minus, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Import react-pdf styles for proper rendering
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Configure PDF.js worker - must match the version used by react-pdf
// Using cdnjs which is more reliable than unpkg
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;

interface PDFRendererProps {
  /** URL to the PDF file (can be blob URL or regular URL) */
  fileUrl: string;
  /** File name for display purposes */
  fileName: string;
  /** Callback when loading starts */
  onLoadStart?: () => void;
  /** Callback when loading completes successfully */
  onLoadSuccess?: () => void;
  /** Callback when loading fails */
  onLoadError?: (error: string) => void;
}

const ZOOM_LEVELS = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0];
const DEFAULT_ZOOM_INDEX = 2; // 1.0 (100%)

export function PDFRenderer({
  fileUrl,
  // fileName is passed for potential future use (e.g., in error messages)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  fileName,
  onLoadStart,
  onLoadSuccess,
  onLoadError
}: PDFRendererProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [zoomIndex, setZoomIndex] = useState<number>(DEFAULT_ZOOM_INDEX);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const [fitMode, setFitMode] = useState<'width' | 'page' | 'custom'>('width');

  const containerRef = useRef<HTMLDivElement>(null);
  const pageInputRef = useRef<HTMLInputElement>(null);

  const scale = ZOOM_LEVELS[zoomIndex];

  // Measure container width for fit-to-width mode
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        // Account for padding
        setContainerWidth(containerRef.current.clientWidth - 48);
      }
    };

    updateWidth();
    const resizeObserver = new ResizeObserver(updateWidth);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => resizeObserver.disconnect();
  }, []);

  // Notify parent of load start
  useEffect(() => {
    onLoadStart?.();
  }, [fileUrl, onLoadStart]);

  const handleDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setLoading(false);
    setError(null);
    setPageNumber(1);
    onLoadSuccess?.();
  }, [onLoadSuccess]);

  const handleDocumentLoadError = useCallback((err: Error) => {
    console.error('[PDFRenderer] Load error:', err);
    const errorMsg = 'Failed to load PDF. The file may be corrupted or inaccessible.';
    setError(errorMsg);
    setLoading(false);
    onLoadError?.(errorMsg);
  }, [onLoadError]);

  const goToPrevPage = () => {
    setPageNumber((prev) => Math.max(prev - 1, 1));
  };

  const goToNextPage = () => {
    setPageNumber((prev) => Math.min(prev + 1, numPages));
  };

  const goToPage = (page: number) => {
    const validPage = Math.max(1, Math.min(page, numPages));
    setPageNumber(validPage);
  };

  const handlePageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value)) {
      goToPage(value);
    }
  };

  const handlePageInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      pageInputRef.current?.blur();
    }
  };

  const zoomIn = () => {
    setFitMode('custom');
    setZoomIndex((prev) => Math.min(prev + 1, ZOOM_LEVELS.length - 1));
  };

  const zoomOut = () => {
    setFitMode('custom');
    setZoomIndex((prev) => Math.max(prev - 1, 0));
  };

  const fitToWidth = () => {
    setFitMode('width');
    setZoomIndex(DEFAULT_ZOOM_INDEX);
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if not in input
      if (e.target instanceof HTMLInputElement) return;

      switch (e.key) {
        case 'ArrowLeft':
        case 'ArrowUp':
        case 'PageUp':
          e.preventDefault();
          setPageNumber((prev) => Math.max(prev - 1, 1));
          break;
        case 'ArrowRight':
        case 'ArrowDown':
        case 'PageDown':
        case ' ':
          e.preventDefault();
          setPageNumber((prev) => Math.min(prev + 1, numPages));
          break;
        case 'Home':
          e.preventDefault();
          setPageNumber(1);
          break;
        case 'End':
          e.preventDefault();
          setPageNumber(numPages);
          break;
        case '+':
        case '=':
          e.preventDefault();
          setFitMode('custom');
          setZoomIndex((prev) => Math.min(prev + 1, ZOOM_LEVELS.length - 1));
          break;
        case '-':
          e.preventDefault();
          setFitMode('custom');
          setZoomIndex((prev) => Math.max(prev - 1, 0));
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [numPages]);

  // Calculate width for fit-to-width mode
  const getPageWidth = () => {
    if (fitMode === 'width' && containerWidth > 0) {
      return containerWidth;
    }
    return undefined;
  };

  const getPageScale = () => {
    if (fitMode === 'width') {
      return undefined; // Use width instead
    }
    return scale;
  };

  return (
    <div className="flex flex-col h-full w-full">
      {/* Controls bar - compact floating toolbar */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-1 px-3 py-2 rounded-xl bg-background/95 backdrop-blur-md border border-border/50 shadow-lg"
        >
          {/* Page navigation */}
          <Button
            variant="ghost"
            size="icon"
            onClick={goToPrevPage}
            disabled={pageNumber <= 1 || loading}
            className="h-8 w-8"
            title="Previous page (Left arrow)"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>

          <div className="flex items-center gap-1.5 px-2">
            <input
              ref={pageInputRef}
              type="number"
              min={1}
              max={numPages}
              value={pageNumber}
              onChange={handlePageInputChange}
              onKeyDown={handlePageInputKeyDown}
              className="w-12 h-7 text-center text-sm font-medium bg-muted/50 border border-border/50 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
              disabled={loading}
            />
            <span className="text-sm text-muted-foreground">
              / {numPages || '...'}
            </span>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={goToNextPage}
            disabled={pageNumber >= numPages || loading}
            className="h-8 w-8"
            title="Next page (Right arrow)"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>

          <div className="w-px h-6 bg-border/50 mx-1" />

          {/* Zoom controls */}
          <Button
            variant="ghost"
            size="icon"
            onClick={zoomOut}
            disabled={zoomIndex <= 0 || loading}
            className="h-8 w-8"
            title="Zoom out (-)"
          >
            <Minus className="w-4 h-4" />
          </Button>

          <button
            onClick={fitToWidth}
            className="min-w-[52px] h-7 px-2 text-sm font-medium bg-muted/50 border border-border/50 rounded-md hover:bg-muted transition-colors"
            title="Click to fit to width"
            disabled={loading}
          >
            {fitMode === 'width' ? 'Fit' : `${Math.round(scale * 100)}%`}
          </button>

          <Button
            variant="ghost"
            size="icon"
            onClick={zoomIn}
            disabled={zoomIndex >= ZOOM_LEVELS.length - 1 || loading}
            className="h-8 w-8"
            title="Zoom in (+)"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </motion.div>
      </div>

      {/* PDF Document container - full screen with scroll */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto bg-muted/30 dark:bg-black/40"
      >
        <div className="min-h-full flex flex-col items-center py-16 px-6">
          {/* Loading state */}
          <AnimatePresence>
            {loading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-20"
              >
                <div className="flex flex-col items-center gap-4">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-full border-4 border-primary/20" />
                    <div className="absolute inset-0 w-16 h-16 rounded-full border-4 border-transparent border-t-primary animate-spin" />
                  </div>
                  <p className="text-sm font-medium text-muted-foreground">Loading PDF...</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Error state */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex flex-col items-center justify-center gap-4 py-20"
              >
                <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
                  <AlertTriangle className="w-8 h-8 text-destructive" />
                </div>
                <div className="text-center max-w-md">
                  <h3 className="font-semibold mb-2">Failed to Load PDF</h3>
                  <p className="text-sm text-muted-foreground">{error}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* PDF Document */}
          {!error && (
            <Document
              file={fileUrl}
              onLoadSuccess={handleDocumentLoadSuccess}
              onLoadError={handleDocumentLoadError}
              loading=""
              className="flex flex-col items-center gap-4"
              options={{
                cMapUrl: `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/cmaps/`,
                cMapPacked: true,
              }}
            >
              <Page
                pageNumber={pageNumber}
                scale={getPageScale()}
                width={getPageWidth()}
                renderTextLayer={true}
                renderAnnotationLayer={true}
                className="shadow-2xl rounded-sm overflow-hidden"
                loading={
                  <div className="flex items-center justify-center p-8">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  </div>
                }
              />
            </Document>
          )}
        </div>
      </div>

      {/* Bottom status bar - minimal */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-background/80 backdrop-blur-md border border-border/30 text-xs text-muted-foreground"
        >
          <kbd className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono">←→</kbd>
          <span>Navigate</span>
          <span className="text-border">|</span>
          <kbd className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono">+/-</kbd>
          <span>Zoom</span>
          <span className="text-border">|</span>
          <kbd className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono">Space</kbd>
          <span>Next</span>
        </motion.div>
      </div>
    </div>
  );
}
