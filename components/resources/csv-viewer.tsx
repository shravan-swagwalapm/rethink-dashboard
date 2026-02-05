'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, X, FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';

interface CSVViewerProps {
  fileUrl: string;
  fileName: string;
  isOpen: boolean;
  onClose: () => void;
}

export function CSVViewer({ fileUrl, fileName, isOpen, onClose }: CSVViewerProps) {
  const [data, setData] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const loadCSV = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(fileUrl);
        if (!response.ok) throw new Error('Failed to fetch CSV file');

        const text = await response.text();

        // Simple CSV parsing (handles basic cases)
        const lines = text.split('\n').filter(line => line.trim());
        if (lines.length === 0) throw new Error('Empty CSV file');

        // Parse CSV (handle quoted values with commas)
        const parseCSVLine = (line: string): string[] => {
          const result: string[] = [];
          let current = '';
          let inQuotes = false;

          for (let i = 0; i < line.length; i++) {
            const char = line[i];

            if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
              result.push(current.trim());
              current = '';
            } else {
              current += char;
            }
          }
          result.push(current.trim());
          return result;
        };

        const parsedData = lines.map(parseCSVLine);

        setHeaders(parsedData[0]);
        setData(parsedData.slice(1));
        setLoading(false);
      } catch (err) {
        console.error('CSV load error:', err);
        setError('Failed to load CSV file');
        toast.error('Failed to load CSV');
        setLoading(false);
      }
    };

    loadCSV();
  }, [fileUrl, isOpen]);

  const handleDownload = () => {
    window.open(fileUrl, '_blank');
  };

  const handleOpenInGoogleSheets = () => {
    const encodedUrl = encodeURIComponent(fileUrl);
    const sheetsUrl = `https://docs.google.com/viewer?url=${encodedUrl}`;
    window.open(sheetsUrl, '_blank');
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
              <Button variant="outline" size="sm" onClick={handleOpenInGoogleSheets}>
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Open in Google Sheets
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

        <div className="flex-1 overflow-auto bg-background">
          {loading && (
            <div className="flex items-center justify-center h-full">
              <div className="flex flex-col items-center gap-3">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                <p className="text-sm text-muted-foreground">Loading CSV...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center justify-center h-full gap-4 max-w-md mx-auto text-center">
              <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
                <X className="w-8 h-8 text-destructive" />
              </div>
              <div>
                <h3 className="font-semibold mb-2">Failed to Load CSV</h3>
                <p className="text-sm text-muted-foreground">{error}</p>
              </div>
              <Button onClick={handleDownload} variant="outline">
                <Download className="w-4 h-4 mr-2" />
                Download Instead
              </Button>
            </div>
          )}

          {!loading && !error && data.length > 0 && (
            <div className="p-6">
              <div className="rounded-lg border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        {headers.map((header, idx) => (
                          <th
                            key={idx}
                            className="px-4 py-3 text-left font-semibold border-b whitespace-nowrap"
                          >
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.slice(0, 100).map((row, rowIdx) => (
                        <tr key={rowIdx} className="border-b hover:bg-muted/50">
                          {row.map((cell, cellIdx) => (
                            <td key={cellIdx} className="px-4 py-2 whitespace-nowrap">
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {data.length > 100 && (
                  <div className="px-4 py-3 bg-muted/50 text-sm text-muted-foreground text-center border-t">
                    Showing first 100 rows of {data.length}. Download to view all rows.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
