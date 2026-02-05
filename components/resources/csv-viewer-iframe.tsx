'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, X, FileSpreadsheet, ExternalLink } from 'lucide-react';

interface CSVViewerIframeProps {
  fileUrl: string;
  fileName: string;
  isOpen: boolean;
  onClose: () => void;
}

export function CSVViewerIframe({ fileUrl, fileName, isOpen, onClose }: CSVViewerIframeProps) {
  const handleDownload = () => {
    window.open(fileUrl, '_blank');
  };

  // Use Google Sheets viewer for CSV files
  const googleViewerUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(fileUrl)}&embedded=true`;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[95vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-semibold truncate pr-4 flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-blue-500" />
              {fileName}
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(`https://docs.google.com/spreadsheets/d/e/2PACX-1vQ/pubhtml?gid=0&single=true&widget=false&chrome=false&headers=false&url=${encodeURIComponent(fileUrl)}`, '_blank')}
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Open in New Tab
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

        <div className="flex-1 overflow-hidden bg-muted/20">
          <iframe
            src={googleViewerUrl}
            className="w-full h-full border-0"
            title={fileName}
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
          />
        </div>

        <div className="px-6 py-3 border-t bg-muted/50 text-sm text-muted-foreground text-center flex-shrink-0">
          Viewing with Google Docs Viewer • Download for full Excel/CSV features
        </div>
      </DialogContent>
    </Dialog>
  );
}
