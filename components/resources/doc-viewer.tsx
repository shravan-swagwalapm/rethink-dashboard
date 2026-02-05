'use client';

import { useState, useEffect } from 'react';
import mammoth from 'mammoth';
import DOMPurify from 'isomorphic-dompurify';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, X } from 'lucide-react';
import { toast } from 'sonner';

interface DocViewerProps {
  fileUrl: string;
  fileName: string;
  isOpen: boolean;
  onClose: () => void;
}

export function DocViewer({ fileUrl, fileName, isOpen, onClose }: DocViewerProps) {
  const [html, setHtml] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const loadDocument = async () => {
      setLoading(true);
      setError(null);

      try {
        // Fetch the document
        const response = await fetch(fileUrl);
        if (!response.ok) throw new Error('Failed to fetch document');

        const arrayBuffer = await response.arrayBuffer();

        // Convert to HTML using mammoth
        const result = await mammoth.convertToHtml({ arrayBuffer });

        // Comprehensive sanitization using DOMPurify
        const sanitized = DOMPurify.sanitize(result.value, {
          ALLOWED_TAGS: ['p', 'br', 'b', 'i', 'u', 'strong', 'em', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
                         'ul', 'ol', 'li', 'table', 'tr', 'td', 'th', 'thead', 'tbody', 'span', 'div',
                         'a', 'img', 'blockquote', 'code', 'pre'],
          ALLOWED_ATTR: ['class', 'href', 'src', 'alt', 'title'],
          FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'style'],
          FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur'],
        });

        setHtml(sanitized);
        setLoading(false);
      } catch (err) {
        console.error('Document load error:', err);
        setError('Failed to load document');
        toast.error('Failed to load document');
        setLoading(false);
      }
    };

    loadDocument();
  }, [fileUrl, isOpen]);

  const handleDownload = () => {
    window.open(fileUrl, '_blank');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-semibold truncate pr-4">
              {fileName}
            </DialogTitle>
            <div className="flex items-center gap-2">
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

        {/* Document Content */}
        <div className="flex-1 overflow-auto bg-background">
          {loading && (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <p className="text-destructive">{error}</p>
              <Button onClick={handleDownload}>
                <Download className="w-4 h-4 mr-2" />
                Download Document
              </Button>
            </div>
          )}

          {!loading && !error && html && (
            <div
              className="prose prose-slate dark:prose-invert max-w-none p-8"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
