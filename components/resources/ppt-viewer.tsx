'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, X, Presentation } from 'lucide-react';

interface PPTViewerProps {
  fileUrl: string;
  fileName: string;
  isOpen: boolean;
  onClose: () => void;
}

export function PPTViewer({ fileUrl, fileName, isOpen, onClose }: PPTViewerProps) {
  const handleDownload = () => {
    window.open(fileUrl, '_blank');
  };

  const handleOpenInOffice = () => {
    const encodedUrl = encodeURIComponent(fileUrl);
    const officeUrl = 'https://view.officeapps.live.com/op/view.aspx?src=' + encodedUrl;
    window.open(officeUrl, '_blank');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh]">
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
          <div className="w-20 h-20 rounded-xl bg-orange-500/10 flex items-center justify-center">
            <Presentation className="w-10 h-10 text-orange-500" />
          </div>

          <div className="text-center space-y-2">
            <h3 className="text-lg font-semibold">PowerPoint Presentation</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              Preview presentations by opening in Microsoft Office Online or download to view locally.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm">
            <Button onClick={handleOpenInOffice} className="flex-1">
              <Presentation className="w-4 h-4 mr-2" />
              Open in Office Online
            </Button>
            <Button onClick={handleDownload} variant="outline" className="flex-1">
              <Download className="w-4 h-4 mr-2" />
              Download
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
