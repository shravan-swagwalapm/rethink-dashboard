'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, X, FileSpreadsheet, ExternalLink } from 'lucide-react';

interface ExcelViewerIframeProps {
  fileUrl: string;
  fileName: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ExcelViewerIframe({ fileUrl, fileName, isOpen, onClose }: ExcelViewerIframeProps) {
  const handleDownload = () => {
    window.open(fileUrl, '_blank');
  };

  // Use Office Web Apps viewer for better Excel rendering
  const officeViewerUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(fileUrl)}`;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[95vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-semibold truncate pr-4 flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-green-500" />
              {fileName}
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(`https://docs.google.com/viewer?url=${encodeURIComponent(fileUrl)}`, '_blank')}
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Google Sheets
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
            src={officeViewerUrl}
            className="w-full h-full border-0"
            title={fileName}
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
          />
        </div>

        <div className="px-6 py-3 border-t bg-muted/50 text-sm text-muted-foreground text-center flex-shrink-0">
          Viewing with Microsoft Office Online • For full features, download and open in Excel
        </div>
      </DialogContent>
    </Dialog>
  );
}
