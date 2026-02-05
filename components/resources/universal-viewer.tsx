'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, X, ExternalLink, FileText } from 'lucide-react';

interface UniversalViewerProps {
  fileUrl: string;
  fileName: string;
  fileType: string;
  isOpen: boolean;
  onClose: () => void;
}

export function UniversalViewer({ fileUrl, fileName, fileType, isOpen, onClose }: UniversalViewerProps) {
  const handleDownload = () => {
    window.open(fileUrl, '_blank');
  };

  // Determine the best viewer URL based on file type
  const getViewerUrl = () => {
    const encoded = encodeURIComponent(fileUrl);

    switch (fileType?.toLowerCase()) {
      case 'pdf':
        // Use browser's native PDF viewer
        return fileUrl;

      case 'doc':
      case 'docx':
      case 'ppt':
      case 'pptx':
      case 'xls':
      case 'xlsx':
        // Use Microsoft Office Online viewer
        return `https://view.officeapps.live.com/op/embed.aspx?src=${encoded}`;

      case 'csv':
        // Use Google Docs viewer for CSV
        return `https://docs.google.com/viewer?url=${encoded}&embedded=true`;

      default:
        // Fallback to Google Docs viewer
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
        return '📊';
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
          <iframe
            src={viewerUrl}
            className="absolute inset-0 w-full h-full border-0"
            title={fileName}
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-downloads"
            loading="lazy"
          />
        </div>

        <div className="px-6 py-3 border-t bg-muted/30 text-sm text-muted-foreground text-center flex-shrink-0">
          <span className="hidden sm:inline">Viewing with {getViewerName()} • </span>
          For full features, download and open in the native application
        </div>
      </DialogContent>
    </Dialog>
  );
}
