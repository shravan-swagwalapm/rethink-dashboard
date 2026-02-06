'use client';

import { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import {
  Upload,
  Presentation,
  FileText,
  X,
  Loader2,
  Check,
  AlertCircle,
} from 'lucide-react';
import { FileUploadItem, generateId, formatFileSize, MAX_FILE_SIZE } from '../types';

interface FileUploadTabProps {
  mode: 'presentation' | 'pdf';
  isGlobalMode: boolean;
  selectedCohortId: string;
  onUploadComplete: () => void;
}

export function FileUploadTab({ mode, isGlobalMode, selectedCohortId, onUploadComplete }: FileUploadTabProps) {
  const [fileQueue, setFileQueue] = useState<FileUploadItem[]>([]);
  const [fileUploading, setFileUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isPresentation = mode === 'presentation';
  const accept = isPresentation ? '.ppt,.pptx' : '.pdf,.doc,.docx';
  const filePattern = isPresentation ? /\.(ppt|pptx)$/i : /\.(pdf|doc|docx)$/i;
  const Icon = isPresentation ? Presentation : FileText;
  const iconColor = isPresentation ? 'text-orange-500' : 'text-red-500';
  const title = isPresentation ? 'Upload Presentations' : 'Upload PDFs & Documents';
  const description = isPresentation
    ? 'Drag and drop or click to select PowerPoint files (.ppt, .pptx)'
    : 'Drag and drop or click to select PDF and document files (.pdf, .doc, .docx)';
  const acceptText = isPresentation ? '.ppt, .pptx' : '.pdf, .doc, .docx';

  const filteredQueue = fileQueue.filter(f => f.name.match(filePattern));
  const pendingCount = fileQueue.filter(f => f.name.match(filePattern) && f.status === 'pending').length;

  const handleFilesSelected = (files: FileList | null) => {
    if (!files) return;

    const newItems: FileUploadItem[] = [];

    for (const file of Array.from(files)) {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (!['pdf', 'ppt', 'pptx', 'doc', 'docx', 'xls', 'xlsx', 'csv'].includes(ext || '')) {
        toast.error(`${file.name}: Invalid file type. Accepted: PDF, PPT, PPTX, DOC, DOCX, XLS, XLSX, CSV`);
        continue;
      }

      if (file.size > MAX_FILE_SIZE) {
        toast.error(`${file.name}: File exceeds 100MB limit`);
        continue;
      }

      newItems.push({
        id: generateId(),
        file,
        name: file.name,
        size: file.size,
        progress: 0,
        status: 'pending',
      });
    }

    if (newItems.length > 0) {
      setFileQueue(prev => [...prev, ...newItems]);
    }
  };

  const removeFileFromQueue = (id: string) => {
    setFileQueue(prev => prev.filter(f => f.id !== id));
  };

  const handleFileUpload = async () => {
    if (!isGlobalMode && !selectedCohortId) {
      toast.error('Please select a cohort or enable Global Mode');
      return;
    }

    const pendingFiles = fileQueue.filter(f => f.status === 'pending');
    if (pendingFiles.length === 0) {
      toast.error('No files to upload');
      return;
    }

    setFileUploading(true);

    for (const item of pendingFiles) {
      setFileQueue(prev => prev.map(f =>
        f.id === item.id ? { ...f, status: 'uploading' as const } : f
      ));

      try {
        const formData = new FormData();
        formData.append('file', item.file);
        formData.append('name', item.name);
        const ext = item.name.split('.').pop()?.toLowerCase();
        let category = 'pdf';

        if (['ppt', 'pptx'].includes(ext || '')) {
          category = 'presentation';
        } else if (['pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv'].includes(ext || '')) {
          category = 'pdf';
        }

        formData.append('category', category);
        formData.append('is_global', isGlobalMode.toString());
        if (!isGlobalMode && selectedCohortId) {
          formData.append('cohort_id', selectedCohortId);
        }

        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();

          xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
              const progress = Math.round((e.loaded / e.total) * 100);
              setFileQueue(prev => prev.map(f =>
                f.id === item.id ? { ...f, progress } : f
              ));
            }
          });

          xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              setFileQueue(prev => prev.map(f =>
                f.id === item.id ? { ...f, status: 'success' as const, progress: 100 } : f
              ));
              resolve();
            } else {
              let errorMessage = 'Upload failed';
              try {
                const response = JSON.parse(xhr.responseText);
                errorMessage = response?.error || `Server error (${xhr.status})`;
              } catch {
                errorMessage = `Server error (${xhr.status}): ${xhr.statusText || 'Unknown error'}`;
              }
              setFileQueue(prev => prev.map(f =>
                f.id === item.id ? { ...f, status: 'error' as const, error: errorMessage } : f
              ));
              reject(new Error(errorMessage));
            }
          });

          xhr.addEventListener('error', () => {
            setFileQueue(prev => prev.map(f =>
              f.id === item.id ? { ...f, status: 'error' as const, error: 'Network error' } : f
            ));
            reject(new Error('Network error'));
          });

          xhr.open('POST', '/api/admin/resources');
          xhr.send(formData);
        });
      } catch (error) {
        console.error('File upload error:', error);
      }
    }

    setFileUploading(false);

    const successCount = fileQueue.filter(f => f.status === 'success').length +
      pendingFiles.filter(f => fileQueue.find(fq => fq.id === f.id)?.status === 'success').length;

    if (successCount > 0) {
      toast.success(`Uploaded ${successCount} file${successCount > 1 ? 's' : ''}`);
      setTimeout(() => {
        setFileQueue(prev => prev.filter(f => f.status !== 'success'));
      }, 2000);
      onUploadComplete();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon className={`w-5 h-5 ${iconColor}`} />
          {title}
        </CardTitle>
        <CardDescription>
          {description}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={accept}
          onChange={(e) => handleFilesSelected(e.target.files)}
          className="hidden"
        />
        <div
          className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
            dragOver
              ? 'border-primary bg-primary/5 scale-[1.02]'
              : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50'
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            handleFilesSelected(e.dataTransfer.files);
          }}
          onClick={() => {
            if (fileInputRef.current) {
              fileInputRef.current.click();
            }
          }}
        >
          <div className={`w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center transition-colors ${
            dragOver ? 'bg-primary/20' : 'bg-muted'
          }`}>
            <Upload className={`w-8 h-8 ${dragOver ? 'text-primary' : 'text-muted-foreground'}`} />
          </div>
          <p className="font-medium">Drop files here or click to browse</p>
          <p className="text-sm text-muted-foreground mt-1">
            Max 100MB per file. Accepted: {acceptText}
          </p>
        </div>

        {filteredQueue.length > 0 && (
          <div className="space-y-2">
            <Label className="text-sm font-medium">Upload Queue</Label>
            {filteredQueue.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 p-3 rounded-lg border bg-card"
              >
                <Icon className={`w-5 h-5 ${iconColor} shrink-0`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Progress value={item.progress} className="h-1.5 flex-1" />
                    <span className="text-xs text-muted-foreground w-12">
                      {item.progress}%
                    </span>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">
                  {formatFileSize(item.size)}
                </span>
                {item.status === 'success' && (
                  <Check className="w-4 h-4 text-green-500 shrink-0" />
                )}
                {item.status === 'error' && (
                  <span title={item.error}>
                    <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
                  </span>
                )}
                {item.status === 'pending' && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeFileFromQueue(item.id)}
                    className="h-8 w-8 shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
                {item.status === 'uploading' && (
                  <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />
                )}
              </div>
            ))}
          </div>
        )}

        {pendingCount > 0 && (
          <Button
            onClick={handleFileUpload}
            disabled={fileUploading || (!isGlobalMode && !selectedCohortId)}
            className="gap-2 gradient-bg"
          >
            {fileUploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Upload {pendingCount} {isPresentation ? 'Presentation' : 'File'}{pendingCount !== 1 ? 's' : ''}
              </>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
