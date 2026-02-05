'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, X, ExternalLink, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface UniversalViewerProps {
  fileUrl: string;
  fileName: string;
  fileType: string;
  isOpen: boolean;
  onClose: () => void;
}

export function UniversalViewer({ fileUrl, fileName, fileType, isOpen, onClose }: UniversalViewerProps) {
  const [blobUrl, setBlobUrl] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !fileUrl) return;

    const type = fileType?.toLowerCase();

    // For PDFs, fetch as blob to avoid X-Frame-Options issues
    if (type === 'pdf') {
      setLoading(true);
      setError(null);

      fetch(fileUrl)
        .then(response => {
          if (!response.ok) throw new Error('Failed to fetch file');
          return response.blob();
        })
        .then(blob => {
          const url = URL.createObjectURL(blob);
          setBlobUrl(url);
          setLoading(false);
        })
        .catch(err => {
          console.error('Error loading file:', err);
          setError('Failed to load file. Please try downloading instead.');
          toast.error('Failed to load file');
          setLoading(false);
        });

      return () => {
        if (blobUrl) {
          URL.revokeObjectURL(blobUrl);
        }
      };
    } else {
      // For other files, use cloud viewers directly
      setBlobUrl('');
      setLoading(false);
    }
  }, [fileUrl, fileType, isOpen]);

  const handleDownload = () => {
    window.open(fileUrl, '_blank');
  };

  const getViewerUrl = () => {
    const encoded = encodeURIComponent(fileUrl);
    const type = fileType?.toLowerCase();

    // For PDF, use blob URL if available
    if (type === 'pdf' && blobUrl) {
      return blobUrl;
    }

    // For other file types, use cloud viewers
    switch (type) {
      case 'doc':
      case 'docx':
      case 'ppt':
      case 'pptx':
      case 'xls':
      case 'xlsx':
        return `https://view.officeapps.live.com/op/embed.aspx?src=${encoded}`;

      case 'csv':
        return `https://docs.google.com/viewer?url=${encoded}&embedded=true`;

      default:
        return `https://docs.google.com/viewer?url=${encoded}&embedded=true`;
    }
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
    const type = fileType?.toLowerCase();
    if (type === 'pdf') return 'Browser PDF Viewer';
    if (['doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx'].includes(type || '')) {
      return 'Microsoft Office Online';
    }
    return 'Google Docs Viewer';
  };

  const viewerUrl = getViewerUrl();
  const shouldShowIframe = !loading && !error && (blobUrl || fileType?.toLowerCase() !== 'pdf');

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
                onClick={() => window.open(fileUrl, '_blank')}
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

        <div className="flex-1 overflow-hidden relative bg-muted/10">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Loading {fileType?.toUpperCase()}...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex flex-col items-center gap-4 max-w-md text-center px-4">
                <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
                  <X className="w-8 h-8 text-destructive" />
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Unable to Load File</h3>
                  <p className="text-sm text-muted-foreground">{error}</p>
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => window.open(fileUrl, '_blank')}>
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

          {shouldShowIframe && (
            <iframe
              src={viewerUrl}
              className="absolute inset-0 w-full h-full border-0"
              title={fileName}
              sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-downloads"
            />
          )}
        </div>

        <div className="px-6 py-3 border-t bg-muted/30 text-sm text-muted-foreground text-center flex-shrink-0">
          <span className="hidden sm:inline">Viewing with {getViewerName()} • </span>
          For full features, download and open in the native application
        </div>
      </DialogContent>
    </Dialog>
  );
}
