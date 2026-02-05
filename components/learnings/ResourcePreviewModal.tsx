'use client';

import { useState, useEffect } from 'react';
import type { ModuleResource } from '@/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Clock,
  ExternalLink,
  Download,
  Star,
  Check,
  Loader2,
  Video,
  FileText,
  Youtube,
  Pencil,
  Trash2,
  BookOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  getContentIcon,
  getContentTypeLabel,
  getContentGradient,
  getEmbedUrl,
  getDirectViewUrl,
  hasUploadedFile,
  formatDuration,
} from '@/lib/utils/resource-helpers';
import { isYouTubeUrl } from '@/lib/utils/youtube-url';
import { useResourceSignedUrl } from '@/hooks/use-resource-signed-url';

export interface ResourcePreviewModalProps {
  // Required
  resource: ModuleResource | null;
  onClose: () => void;

  // Related content
  relatedResources?: ModuleResource[];
  onResourceChange?: (resource: ModuleResource) => void;

  // Admin-specific features
  isAdmin?: boolean;
  onEdit?: (resource: ModuleResource) => void;
  onDelete?: (resourceId: string) => void;

  // Student-specific features
  isFavorite?: boolean;
  isCompleted?: boolean;
  onToggleFavorite?: (resourceId: string) => void;
  onMarkComplete?: (resourceId: string) => void;
}

export function ResourcePreviewModal({
  resource,
  onClose,
  relatedResources = [],
  onResourceChange,
  isAdmin = false,
  onEdit,
  onDelete,
  isFavorite = false,
  isCompleted = false,
  onToggleFavorite,
  onMarkComplete,
}: ResourcePreviewModalProps) {
  const [iframeLoading, setIframeLoading] = useState(true);
  const [iframeError, setIframeError] = useState(false);

  // Fetch signed URL for PDFs
  const { url: pdfSignedUrl, loading: pdfLoading } = useResourceSignedUrl(resource);

  // Reset iframe state when resource changes
  useEffect(() => {
    if (resource) {
      setIframeLoading(true);
      setIframeError(false);
    }
  }, [resource?.id]);

  if (!resource) return null;

  const hasPdf = hasUploadedFile(resource);
  const hasExternalContent = resource.google_drive_id || resource.external_url;
  const gradient = getContentGradient(resource.content_type);

  return (
    <Dialog open={!!resource} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] w-[95vw] max-h-[95vh] h-[95vh] sm:max-w-[95vw] flex flex-col dark:bg-gray-900">
        <DialogHeader className="border-b dark:border-gray-800 pb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-2">
              <DialogTitle className="flex items-center gap-3 text-xl">
                <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${gradient.from} ${gradient.to} flex items-center justify-center shadow-md`}>
                  {getContentIcon(resource.content_type, 'w-5 h-5 text-white')}
                </div>
                {resource.title}
              </DialogTitle>

              {/* Metadata row */}
              <div className="flex flex-wrap items-center gap-3 text-sm">
                {resource.session_number && (
                  <Badge variant="secondary">
                    Session {resource.session_number}
                  </Badge>
                )}
                {resource.duration_seconds && (
                  <Badge className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                    <Clock className="w-3 h-3 mr-1" />
                    {formatDuration(resource.duration_seconds)}
                  </Badge>
                )}
                {resource.description && (
                  <p className="text-gray-600 dark:text-gray-400 line-clamp-1">
                    {resource.description}
                  </p>
                )}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-3 mr-12">
              {/* PDF View/Download buttons - only show for uploaded PDFs */}
              {hasPdf && (
                <>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      if (pdfSignedUrl) {
                        window.open(pdfSignedUrl, '_blank');
                      }
                    }}
                    disabled={pdfLoading || !pdfSignedUrl}
                    title="View in new tab"
                    className="transition-all dark:border-gray-700 dark:hover:bg-gray-800"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      if (pdfSignedUrl) {
                        const link = document.createElement('a');
                        link.href = pdfSignedUrl;
                        link.download = resource.title + '.pdf';
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                      }
                    }}
                    disabled={pdfLoading || !pdfSignedUrl}
                    title="Download PDF"
                    className="transition-all dark:border-gray-700 dark:hover:bg-gray-800"
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                </>
              )}

              {/* Admin-specific buttons */}
              {isAdmin && (
                <>
                  {onEdit && (
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => onEdit(resource)}
                      title="Edit resource"
                      className="transition-all dark:border-gray-700 dark:hover:bg-gray-800"
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                  )}
                  {onDelete && (
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => onDelete(resource.id)}
                      title="Delete resource"
                      className="transition-all border-red-300 hover:bg-red-50 dark:border-red-900/50 dark:hover:bg-red-950/20 text-red-600 dark:text-red-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </>
              )}

              {/* Student-specific buttons */}
              {!isAdmin && (
                <>
                  {onToggleFavorite && (
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => onToggleFavorite(resource.id)}
                      className={cn(
                        'transition-all',
                        isFavorite &&
                          'border-yellow-400 bg-yellow-50 dark:bg-yellow-950/20'
                      )}
                      title="Toggle favorite"
                    >
                      <Star
                        className={cn(
                          'w-4 h-4 transition-all',
                          isFavorite
                            ? 'fill-yellow-400 text-yellow-400'
                            : 'text-gray-400 dark:text-gray-500'
                        )}
                      />
                    </Button>
                  )}
                  {onMarkComplete && (
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => onMarkComplete(resource.id)}
                      className={cn(
                        'transition-all',
                        isCompleted &&
                          'border-green-500 bg-green-50 dark:bg-green-950/20'
                      )}
                      title="Mark as complete"
                    >
                      <Check
                        className={cn(
                          'w-4 h-4 transition-all',
                          isCompleted
                            ? 'text-green-500 stroke-[3]'
                            : 'text-gray-400 dark:text-gray-500'
                        )}
                      />
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </DialogHeader>

        {/* Content Display with optional Sidebar */}
        <div className="flex gap-6 flex-1 min-h-0">
          {/* Main content */}
          <div className="flex-1 min-w-0 relative">
            {/* Loading State */}
            {(iframeLoading || pdfLoading) && !iframeError && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-900 rounded-lg z-10">
                <div className="flex flex-col items-center gap-4 p-6 text-center">
                  <Loader2 className="w-10 h-10 animate-spin text-purple-500" />
                  <div>
                    <p className="text-sm text-gray-300 mb-1">
                      {pdfLoading
                        ? 'Preparing document...'
                        : resource.content_type === 'video'
                        ? 'Loading video...'
                        : 'Loading document...'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {pdfLoading
                        ? 'Generating secure viewing link'
                        : resource.content_type === 'video'
                        ? "If video doesn't appear, use the button below"
                        : 'Content will appear shortly'}
                    </p>
                  </div>
                  {resource.content_type === 'video' && (
                    <Button
                      onClick={() => {
                        const url = getDirectViewUrl(resource);
                        window.open(url, '_blank');
                      }}
                      variant="outline"
                      size="sm"
                      className="gap-2 border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
                    >
                      <Youtube className="w-4 h-4" />
                      {isYouTubeUrl(resource.external_url || '')
                        ? 'Watch on YouTube'
                        : 'Watch in Google Drive'}
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Error State */}
            {iframeError && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-900/95 rounded-lg border-2 border-purple-500/30 z-10">
                <div className="flex flex-col items-center gap-4 p-6 max-w-lg text-center">
                  <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${gradient.from} ${gradient.to} flex items-center justify-center shadow-lg shadow-purple-500/25`}>
                    {resource.content_type === 'video' ? (
                      <Video className="w-8 h-8 text-white" />
                    ) : (
                      <FileText className="w-8 h-8 text-white" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg mb-2 text-white">
                      {resource.content_type === 'video'
                        ? "Video couldn't load here"
                        : "Content couldn't load here"}
                    </h3>
                    <p className="text-sm text-gray-400 mb-2">
                      {resource.content_type === 'video'
                        ? 'This can happen due to browser extensions (ad blockers) or account conflicts.'
                        : 'There was an issue loading this content.'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {resource.content_type === 'video'
                        ? 'Try opening externally, or use an incognito window.'
                        : 'Try opening in a new tab or downloading the file.'}
                    </p>
                  </div>
                  <div className="flex gap-3">
                    {resource.content_type === 'video' ? (
                      <Button
                        onClick={() => {
                          const url = getDirectViewUrl(resource);
                          window.open(url, '_blank');
                        }}
                        className="gap-2 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700"
                      >
                        <Youtube className="w-4 h-4" />
                        {isYouTubeUrl(resource.external_url || '')
                          ? 'Watch on YouTube'
                          : 'Watch in Google Drive'}
                      </Button>
                    ) : hasPdf && pdfSignedUrl ? (
                      <Button
                        onClick={() => window.open(pdfSignedUrl, '_blank')}
                        className="gap-2 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700"
                      >
                        <ExternalLink className="w-4 h-4" />
                        Open in New Tab
                      </Button>
                    ) : (
                      <Button
                        onClick={() => {
                          const url = getDirectViewUrl(resource);
                          window.open(url, '_blank');
                        }}
                        className="gap-2 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700"
                      >
                        <ExternalLink className="w-4 h-4" />
                        Open in Google Drive
                      </Button>
                    )}
                    <Button
                      onClick={() => {
                        setIframeError(false);
                        setIframeLoading(true);
                      }}
                      variant="outline"
                      className="border-gray-700 hover:bg-gray-800"
                    >
                      Retry
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Iframe for content display */}
            <iframe
              src={(() => {
                // For PDFs with file_path (uploaded to Supabase Storage), use the signed URL
                if (hasPdf) {
                  console.log('[ResourcePreview] Loading PDF via signed URL:', {
                    title: resource.title,
                    file_path: resource.file_path,
                    signed_url: pdfSignedUrl ? 'loaded' : 'pending',
                  });
                  return pdfSignedUrl || '';
                }

                // For videos and legacy content, use getEmbedUrl
                const url = getEmbedUrl(resource);
                console.log('[ResourcePreview] Loading iframe:', {
                  title: resource.title,
                  google_drive_id: resource.google_drive_id,
                  external_url: resource.external_url,
                  content_type: resource.content_type,
                  iframe_url: url,
                });
                return url;
              })()}
              onLoad={() => {
                console.log('[ResourcePreview] Iframe loaded successfully');
                // For PDFs, add delay to ensure PDF viewer has fully rendered and painted content
                // Using requestAnimationFrame ensures we wait for actual paint cycles
                if (hasPdf) {
                  // Wait for 2 animation frames (ensures 2 paint cycles)
                  requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                      // Then add additional 800ms for PDF.js to fully render pages
                      setTimeout(() => {
                        setIframeLoading(false);
                        setIframeError(false);
                      }, 800);
                    });
                  });
                } else {
                  // Videos: instant reveal
                  setIframeLoading(false);
                  setIframeError(false);
                }
              }}
              onError={(e) => {
                console.error('[ResourcePreview] Iframe load error:', e);
                setIframeLoading(false);
                setIframeError(true);
              }}
              className="w-full h-full rounded-lg bg-gray-900"
              allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
              allowFullScreen
              title={resource.title}
            />
          </div>

          {/* Related content sidebar */}
          {relatedResources.length > 0 && onResourceChange && (
            <div className="w-80 border-l dark:border-gray-800 pl-6 overflow-y-auto">
              <h3 className="font-semibold mb-3 flex items-center gap-2 text-gray-900 dark:text-gray-100">
                <BookOpen className="w-4 h-4" />
                More from this week
              </h3>
              <div className="space-y-2">
                {relatedResources.map((relatedResource) => (
                  <button
                    key={relatedResource.id}
                    onClick={() => {
                      onResourceChange(relatedResource);
                      setIframeLoading(true);
                      setIframeError(false);
                    }}
                    className={cn(
                      'w-full p-3 rounded-lg border text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors dark:border-gray-700',
                      resource.id === relatedResource.id &&
                        'bg-purple-50 dark:bg-purple-950/20 border-purple-500'
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {getContentIcon(
                        relatedResource.content_type,
                        'w-4 h-4 text-purple-500'
                      )}
                      <p className="font-medium text-sm line-clamp-1 text-gray-900 dark:text-gray-100">
                        {relatedResource.title}
                      </p>
                    </div>
                    {relatedResource.duration_seconds && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDuration(relatedResource.duration_seconds)}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer - External link button */}
        {(hasPdf || hasExternalContent) && (
          <div className="flex justify-end border-t border-gray-200 dark:border-gray-800 pt-4">
            {hasPdf ? (
              // For uploaded PDFs, show View in New Tab button
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (pdfSignedUrl) {
                    window.open(pdfSignedUrl, '_blank');
                  }
                }}
                disabled={pdfLoading || !pdfSignedUrl}
                className="gap-2 dark:border-gray-700 dark:hover:bg-gray-800"
              >
                <ExternalLink className="w-4 h-4" />
                View in New Tab
              </Button>
            ) : (
              // For videos and legacy content
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const url = getDirectViewUrl(resource);
                  window.open(url, '_blank');
                }}
                className="gap-2 dark:border-gray-700 dark:hover:bg-gray-800"
              >
                {resource.content_type === 'video' &&
                isYouTubeUrl(resource.external_url || '') ? (
                  <>
                    <Youtube className="w-4 h-4" />
                    Open on YouTube
                  </>
                ) : (
                  <>
                    <ExternalLink className="w-4 h-4" />
                    Open in Google Drive
                  </>
                )}
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
