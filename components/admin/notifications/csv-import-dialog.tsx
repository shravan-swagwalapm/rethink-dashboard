'use client';

import { useState } from 'react';
import Papa from 'papaparse';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface CSVImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listId: string;
  onImportComplete: () => void;
}

interface ParsedContact {
  email?: string;
  phone?: string;
  name?: string;
  metadata?: Record<string, any>;
}

interface ValidationResult {
  valid: ParsedContact[];
  invalid: Array<{
    row: number;
    data: any;
    errors: string[];
  }>;
  total: number;
  valid_count: number;
  invalid_count: number;
}

export function CSVImportDialog({
  open,
  onOpenChange,
  listId,
  onImportComplete,
}: CSVImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [csvContent, setCsvContent] = useState<string>('');
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [step, setStep] = useState<'upload' | 'preview'>('upload');

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith('.csv')) {
      toast.error('Please select a CSV file');
      return;
    }

    setFile(selectedFile);

    // Read file content
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setCsvContent(content);
    };
    reader.readAsText(selectedFile);
  };

  const handleValidate = async () => {
    if (!csvContent) {
      toast.error('Please select a CSV file first');
      return;
    }

    setIsValidating(true);

    try {
      const response = await fetch('/api/admin/notifications/contacts/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv_content: csvContent, list_id: listId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to validate CSV');
      }

      const result = await response.json();
      setValidationResult(result.data);
      setStep('preview');
      toast.success('CSV validated successfully');
    } catch (error: any) {
      console.error('Error validating CSV:', error);
      toast.error(error.message || 'Failed to validate CSV');
    } finally {
      setIsValidating(false);
    }
  };

  const handleImport = async () => {
    if (!validationResult || validationResult.valid.length === 0) {
      toast.error('No valid contacts to import');
      return;
    }

    setIsImporting(true);

    try {
      const response = await fetch('/api/admin/notifications/contacts/import', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          list_id: listId,
          contacts: validationResult.valid,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to import contacts');
      }

      const result = await response.json();
      toast.success(
        `Successfully imported ${result.data.imported} contacts` +
          (result.data.skipped_duplicates > 0
            ? ` (${result.data.skipped_duplicates} duplicates skipped)`
            : '')
      );

      // Reset and close
      setFile(null);
      setCsvContent('');
      setValidationResult(null);
      setStep('upload');
      onOpenChange(false);
      onImportComplete();
    } catch (error: any) {
      console.error('Error importing contacts:', error);
      toast.error(error.message || 'Failed to import contacts');
    } finally {
      setIsImporting(false);
    }
  };

  const handleBack = () => {
    setStep('upload');
    setValidationResult(null);
  };

  const handleClose = () => {
    setFile(null);
    setCsvContent('');
    setValidationResult(null);
    setStep('upload');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Contacts from CSV</DialogTitle>
          <DialogDescription>
            Upload a CSV file with contact information. Required columns: email or phone.
            Optional columns: name, and any custom fields.
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="csv-file">CSV File</Label>
              <Input
                id="csv-file"
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="cursor-pointer"
              />
              {file && (
                <p className="text-sm text-muted-foreground">
                  Selected: {file.name} ({(file.size / 1024).toFixed(2)} KB)
                </p>
              )}
            </div>

            <Alert>
              <AlertDescription>
                <strong>CSV Format Example:</strong>
                <pre className="mt-2 text-xs bg-muted p-2 rounded">
                  {`email,phone,name
john@example.com,+1234567890,John Doe
jane@example.com,,Jane Smith
,+9876543210,Bob Johnson`}
                </pre>
              </AlertDescription>
            </Alert>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={handleValidate}
                disabled={!file || isValidating}
              >
                {isValidating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Validating...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Validate CSV
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {step === 'preview' && validationResult && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-muted p-4 rounded-lg">
                <p className="text-sm text-muted-foreground">Total Rows</p>
                <p className="text-2xl font-bold">{validationResult.total}</p>
              </div>
              <div className="bg-green-500/10 p-4 rounded-lg">
                <p className="text-sm text-green-600 dark:text-green-400">Valid</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {validationResult.valid_count}
                </p>
              </div>
              <div className="bg-red-500/10 p-4 rounded-lg">
                <p className="text-sm text-red-600 dark:text-red-400">Invalid</p>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {validationResult.invalid_count}
                </p>
              </div>
            </div>

            {validationResult.valid_count > 0 && (
              <div className="space-y-2">
                <h4 className="font-semibold text-sm flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  Valid Contacts (showing first 10)
                </h4>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Name</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {validationResult.valid.slice(0, 10).map((contact, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-mono text-sm">
                            {contact.email || '-'}
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {contact.phone || '-'}
                          </TableCell>
                          <TableCell>{contact.name || '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {validationResult.invalid_count > 0 && (
              <div className="space-y-2">
                <h4 className="font-semibold text-sm flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-600" />
                  Invalid Contacts (showing first 10)
                </h4>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Row</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead>Errors</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {validationResult.invalid.slice(0, 10).map((item, index) => (
                        <TableRow key={index}>
                          <TableCell>{item.row}</TableCell>
                          <TableCell className="font-mono text-xs">
                            {JSON.stringify(item.data)}
                          </TableCell>
                          <TableCell className="text-red-600 dark:text-red-400 text-sm">
                            {item.errors.join(', ')}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            <div className="flex justify-between gap-2">
              <Button variant="outline" onClick={handleBack}>
                Back
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <Button
                  onClick={handleImport}
                  disabled={validationResult.valid_count === 0 || isImporting}
                >
                  {isImporting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    `Import ${validationResult.valid_count} Contacts`
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
