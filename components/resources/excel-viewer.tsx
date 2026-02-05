'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, X, FileSpreadsheet, ExternalLink } from 'lucide-react';

interface ExcelViewerProps {
  fileUrl: string;
  fileName: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ExcelViewer({ fileUrl, fileName, isOpen, onClose }: ExcelViewerProps) {
  const handleOpenInGoogleSheets = () => {
    // Use Google Sheets viewer to open Excel files
    const encodedUrl = encodeURIComponent(fileUrl);
    const sheetsUrl = `https://docs.google.com/viewer?url=${encodedUrl}`;
    window.open(sheetsUrl, '_blank');
  };

  const handleDownload = () => {
    window.open(fileUrl, '_blank');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-semibold truncate pr-4">
              {fileName}
            </DialogTitle>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="flex flex-col items-center justify-center py-12 gap-6">
          <div className="w-20 h-20 rounded-xl bg-green-500/10 flex items-center justify-center">
            <FileSpreadsheet className="w-10 h-10 text-green-500" />
          </div>

          <div className="text-center space-y-2">
            <h3 className="text-lg font-semibold">Excel Spreadsheet</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              Preview spreadsheets in Google Sheets viewer or download to view locally in Excel.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm">
            <Button onClick={handleOpenInGoogleSheets} className="flex-1">
              <ExternalLink className="w-4 h-4 mr-2" />
              Open in Google Sheets
            </Button>
            <Button onClick={handleDownload} variant="outline" className="flex-1">
              <Download className="w-4 h-4 mr-2" />
              Download
            </Button>
          </div>

          <p className="text-xs text-muted-foreground text-center max-w-md">
            Google Sheets will open in a new tab with a preview of your spreadsheet.
            For full editing features, download and open in Microsoft Excel.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
