'use client';

import { useEffect, useState, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  FileText,
  Presentation,
  Loader2,
  Upload,
  Youtube,
} from 'lucide-react';
import { isYouTubeUrl } from '@/lib/utils/youtube-url';
import type { ModuleResource } from '@/types';
import { cn } from '@/lib/utils';
import { getContentTypeLabel, GLOBAL_LIBRARY_ID, DIRECT_UPLOAD_THRESHOLD } from '../utils';

interface ResourceFormData {
  title: string;
  youtube_url: string;
  content_type: 'video' | 'slides' | 'document' | 'link';
  duration_seconds: string;
  session_number: string;
  order_index: number;
}

interface ResourceFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingResource: ModuleResource | null;
  initialFormData: ResourceFormData | null;
  targetModuleId: string;
  selectedCohort: string;
  onSaveComplete: () => void;
  saving: boolean;
  setSaving: (saving: boolean) => void;
}

export function ResourceFormDialog({
  open,
  onOpenChange,
  editingResource,
  initialFormData,
  targetModuleId,
  selectedCohort,
  onSaveComplete,
  saving,
  setSaving,
}: ResourceFormDialogProps) {
  const [formData, setFormData] = useState<ResourceFormData>({
    title: '',
    youtube_url: '',
    content_type: 'video',
    duration_seconds: '',
    session_number: '',
    order_index: 0,
  });

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(false);
  const [uploadProgressPercent, setUploadProgressPercent] = useState<number>(0);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'requesting-url' | 'uploading' | 'confirming' | 'complete'>('idle');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && initialFormData) {
      setFormData(initialFormData);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [open, initialFormData]);

  useEffect(() => {
    if (!open) {
      setFormData({ title: '', youtube_url: '', content_type: 'video', duration_seconds: '', session_number: '', order_index: 0 });
      setSelectedFile(null);
      setUploadProgress(false);
      setUploadProgressPercent(0);
      setUploadStatus('idle');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [open]);

  const uploadLargeFile = async (
    file: File,
    cohortId: string,
    moduleId: string,
    metadata: {
      title: string;
      contentType: 'slides' | 'document';
      sessionNumber?: number;
      orderIndex?: number;
      durationSeconds?: number;
    }
  ): Promise<{ success: boolean; resource?: any; error?: string }> => {
    try {
      setUploadStatus('requesting-url');
      setUploadProgressPercent(0);

      console.log('[Large Upload] Step 1: Requesting upload URL...', {
        fileName: file.name,
        fileSize: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
      });

      const urlResponse = await fetch('/api/admin/resources/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          fileSize: file.size,
          contentType: file.type,
          cohortId: cohortId === GLOBAL_LIBRARY_ID ? 'global' : cohortId,
        }),
      });

      if (!urlResponse.ok) {
        if (urlResponse.status === 413) {
          throw new Error('File too large. Maximum upload size is 100MB.');
        }

        let errorMessage = 'Failed to get upload URL';
        try {
          const contentType = urlResponse.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const error = await urlResponse.json();
            errorMessage = error.error || error.message || errorMessage;
          } else {
            errorMessage = `Upload URL request failed with status ${urlResponse.status}`;
          }
        } catch {
          errorMessage = `Upload URL request failed with status ${urlResponse.status}`;
        }

        throw new Error(errorMessage);
      }

      const { uploadUrl, filePath, expiresAt } = await urlResponse.json();

      console.log('[Large Upload] Step 1: Upload URL received', {
        filePath,
        expiresAt,
      });

      const expiresIn = new Date(expiresAt).getTime() - Date.now();
      if (expiresIn < 60000) {
        throw new Error('Upload URL expired. Please try again.');
      }

      setUploadStatus('uploading');

      console.log('[Large Upload] Step 2: Uploading to Supabase Storage...');

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const percent = Math.round((e.loaded / e.total) * 100);
            setUploadProgressPercent(percent);
            console.log(`[Large Upload] Upload progress: ${percent}%`);
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            console.log('[Large Upload] Step 2: Upload complete!');
            resolve();
          } else {
            let errorMessage = `Upload failed with status ${xhr.status}`;
            try {
              const response = JSON.parse(xhr.responseText);
              console.error('[Large Upload] Supabase error response:', response);
              errorMessage = response.error || response.message || response.statusCode || errorMessage;
            } catch {
              console.error('[Large Upload] Raw error response:', xhr.responseText);
            }
            reject(new Error(errorMessage));
          }
        });

        xhr.addEventListener('error', () => {
          console.error('[Large Upload] Network error during upload');
          reject(new Error('Network error during upload. Please check your connection.'));
        });

        xhr.addEventListener('timeout', () => {
          console.error('[Large Upload] Upload timed out');
          reject(new Error('Upload timed out. Please try again.'));
        });

        xhr.timeout = 600000;

        xhr.open('PUT', uploadUrl);
        xhr.setRequestHeader('Content-Type', file.type);
        // Supabase API gateway requires apikey header for routing,
        // even on signed URL endpoints (see uploadToSignedUrl in @supabase/storage-js)
        const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
        xhr.setRequestHeader('Authorization', `Bearer ${anonKey}`);
        xhr.setRequestHeader('apikey', anonKey);
        xhr.send(file);
      });

      setUploadStatus('confirming');
      setUploadProgressPercent(100);

      console.log('[Large Upload] Step 3: Confirming upload and creating DB record...');

      const confirmResponse = await fetch('/api/admin/resources/confirm-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filePath,
          moduleId,
          title: metadata.title,
          contentType: metadata.contentType,
          fileType: 'pdf',
          fileSize: file.size,
          sessionNumber: metadata.sessionNumber,
          orderIndex: metadata.orderIndex,
          durationSeconds: metadata.durationSeconds,
        }),
      });

      if (!confirmResponse.ok) {
        let errorMessage = 'Failed to confirm upload';
        try {
          const contentType = confirmResponse.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const error = await confirmResponse.json();
            errorMessage = error.error || error.message || errorMessage;
          } else {
            errorMessage = `Confirmation failed with status ${confirmResponse.status}`;
          }
        } catch {
          errorMessage = `Confirmation failed with status ${confirmResponse.status}`;
        }

        throw new Error(errorMessage);
      }

      const { resource } = await confirmResponse.json();

      console.log('[Large Upload] Step 3: Complete! Resource created:', resource.id);

      setUploadStatus('complete');
      return { success: true, resource };

    } catch (error) {
      console.error('[Large Upload] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed'
      };
    } finally {
      setUploadStatus('idle');
      setUploadProgressPercent(0);
    }
  };

  const handleCreate = async () => {
    if (!formData.title.trim()) {
      toast.error('Title is required');
      return;
    }

    if (formData.content_type === 'video') {
      if (!formData.youtube_url.trim()) {
        toast.error('YouTube URL is required for videos');
        return;
      }
      if (!isYouTubeUrl(formData.youtube_url)) {
        toast.error('Please enter a valid YouTube URL');
        return;
      }
    } else {
      if (!selectedFile) {
        toast.error('Please select a PDF file');
        return;
      }
    }

    setSaving(true);
    setUploadProgress(true);

    try {
      let filePath: string | null = null;
      let fileType: string | null = null;
      let fileSize: number | null = null;

      if (selectedFile && formData.content_type !== 'video') {
        if (selectedFile.size > DIRECT_UPLOAD_THRESHOLD) {
          console.log('[Upload] Using direct upload for large file:', {
            fileName: selectedFile.name,
            fileSize: `${(selectedFile.size / 1024 / 1024).toFixed(2)} MB`,
            threshold: `${(DIRECT_UPLOAD_THRESHOLD / 1024 / 1024).toFixed(0)} MB`,
          });

          const result = await uploadLargeFile(
            selectedFile,
            selectedCohort,
            targetModuleId,
            {
              title: formData.title,
              contentType: formData.content_type as 'slides' | 'document',
              sessionNumber: formData.session_number ? parseInt(formData.session_number) : undefined,
              orderIndex: formData.order_index,
              durationSeconds: formData.duration_seconds ? parseInt(formData.duration_seconds) : undefined,
            }
          );

          if (!result.success) {
            throw new Error(result.error || 'Upload failed');
          }

          toast.success('Resource added');
          onOpenChange(false);
          onSaveComplete();
          return;

        } else {
          console.log('[Upload] Using standard upload for small file:', {
            fileName: selectedFile.name,
            fileSize: `${(selectedFile.size / 1024 / 1024).toFixed(2)} MB`,
          });

          const uploadFormData = new FormData();
          uploadFormData.append('file', selectedFile);
          uploadFormData.append('cohort_id', selectedCohort === GLOBAL_LIBRARY_ID ? 'global' : selectedCohort);

          const uploadResponse = await fetch('/api/admin/resources/upload', {
            method: 'POST',
            body: uploadFormData,
          });

          if (!uploadResponse.ok) {
            if (uploadResponse.status === 413) {
              throw new Error('File too large. Maximum upload size is 100MB.');
            }

            let errorMessage = 'Failed to upload file';
            try {
              const contentType = uploadResponse.headers.get('content-type');
              if (contentType && contentType.includes('application/json')) {
                const error = await uploadResponse.json();
                errorMessage = error.error || error.message || errorMessage;
              } else {
                errorMessage = `Upload failed with status ${uploadResponse.status}`;
              }
            } catch {
              errorMessage = `Upload failed with status ${uploadResponse.status}`;
            }

            throw new Error(errorMessage);
          }

          const uploadData = await uploadResponse.json();
          filePath = uploadData.file_path;
          fileType = uploadData.file_type;
          fileSize = uploadData.file_size;
        }
      }

      const response = await fetch('/api/admin/learnings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'resource',
          module_id: targetModuleId,
          title: formData.title,
          content_type: formData.content_type,
          duration_seconds: formData.duration_seconds ? parseInt(formData.duration_seconds) : null,
          session_number: formData.session_number ? parseInt(formData.session_number) : null,
          order_index: formData.order_index,
          external_url: formData.content_type === 'video' ? formData.youtube_url : null,
          file_path: filePath,
          file_type: fileType,
          file_size: fileSize,
        }),
      });

      if (!response.ok) throw new Error('Failed to create resource');

      toast.success('Resource added');
      onOpenChange(false);
      onSaveComplete();
    } catch (error) {
      console.error('Error creating resource:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create resource');
    } finally {
      setSaving(false);
      setUploadProgress(false);
    }
  };

  const handleUpdate = async () => {
    if (!editingResource || !formData.title.trim()) return;

    setSaving(true);
    setUploadProgress(true);

    try {
      let filePath: string | null = null;
      let fileType: string | null = null;
      let fileSize: number | null = null;

      if (selectedFile && formData.content_type !== 'video') {
        const uploadFormData = new FormData();
        uploadFormData.append('file', selectedFile);
        uploadFormData.append('cohort_id', selectedCohort === GLOBAL_LIBRARY_ID ? 'global' : selectedCohort);

        const uploadResponse = await fetch('/api/admin/resources/upload', {
          method: 'POST',
          body: uploadFormData,
        });

        if (!uploadResponse.ok) {
          if (uploadResponse.status === 413) {
            throw new Error('File too large. Maximum upload size is 100MB.');
          }

          let errorMessage = 'Failed to upload file';
          try {
            const contentType = uploadResponse.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
              const error = await uploadResponse.json();
              errorMessage = error.error || error.message || errorMessage;
            } else {
              errorMessage = `Upload failed with status ${uploadResponse.status}`;
            }
          } catch {
            errorMessage = `Upload failed with status ${uploadResponse.status}`;
          }

          throw new Error(errorMessage);
        }

        const uploadData = await uploadResponse.json();
        filePath = uploadData.file_path;
        fileType = uploadData.file_type;
        fileSize = uploadData.file_size;
      }

      const response = await fetch('/api/admin/learnings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'resource',
          id: editingResource.id,
          title: formData.title,
          content_type: formData.content_type,
          duration_seconds: formData.duration_seconds ? parseInt(formData.duration_seconds) : null,
          session_number: formData.session_number ? parseInt(formData.session_number) : null,
          order_index: formData.order_index,
          external_url: formData.content_type === 'video' ? formData.youtube_url : undefined,
          ...(filePath && { file_path: filePath, file_type: fileType, file_size: fileSize }),
        }),
      });

      if (!response.ok) throw new Error('Failed to update resource');

      toast.success('Resource updated');
      onOpenChange(false);
      onSaveComplete();
    } catch (error) {
      console.error('Error updating resource:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update resource');
    } finally {
      setSaving(false);
      setUploadProgress(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="dark:bg-gray-900 dark:border-gray-700 sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle className="dark:text-white text-xl flex items-center gap-2">
            {formData.content_type === 'video' ? (
              <Youtube className="w-5 h-5 text-red-500" />
            ) : (
              <FileText className="w-5 h-5 text-blue-500" />
            )}
            {editingResource ? 'Edit Resource' : `Add ${getContentTypeLabel(formData.content_type).slice(0, -1)}`}
          </DialogTitle>
          <DialogDescription className="dark:text-gray-400">
            {formData.content_type === 'video'
              ? 'Add a YouTube video'
              : 'Upload a PDF file'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5 py-2">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="resource-title" className="dark:text-gray-300 font-medium">
              Title <span className="text-red-500">*</span>
            </Label>
            <Input
              id="resource-title"
              placeholder="e.g., Session 1 Recording"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="dark:bg-gray-950 dark:border-gray-700 dark:text-white h-11"
            />
          </div>

          {/* Content Type Selector */}
          <div className="space-y-2">
            <Label className="dark:text-gray-300 font-medium">Content Type</Label>
            <Select
              value={formData.content_type}
              onValueChange={(value: 'video' | 'slides' | 'document' | 'link') => {
                setFormData({ ...formData, content_type: value, youtube_url: '' });
                setSelectedFile(null);
                if (fileInputRef.current) fileInputRef.current.value = '';
              }}
            >
              <SelectTrigger className="dark:bg-gray-950 dark:border-gray-700 dark:text-white h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="dark:bg-gray-900 dark:border-gray-700">
                <SelectItem value="video" className="dark:text-white dark:focus:bg-gray-800">
                  <span className="flex items-center gap-2">
                    <Youtube className="w-4 h-4 text-red-500" />
                    Recording (YouTube)
                  </span>
                </SelectItem>
                <SelectItem value="slides" className="dark:text-white dark:focus:bg-gray-800">
                  <span className="flex items-center gap-2">
                    <Presentation className="w-4 h-4 text-orange-500" />
                    PPT (PDF Upload)
                  </span>
                </SelectItem>
                <SelectItem value="document" className="dark:text-white dark:focus:bg-gray-800">
                  <span className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-500" />
                    Notes (PDF Upload)
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* YouTube URL Input - for videos */}
          {formData.content_type === 'video' && (
            <div className="space-y-2">
              <Label htmlFor="resource-youtube" className="dark:text-gray-300 font-medium flex items-center gap-2">
                <Youtube className="w-4 h-4 text-red-500" />
                YouTube URL <span className="text-red-500">*</span>
              </Label>
              <Input
                id="resource-youtube"
                placeholder="https://www.youtube.com/watch?v=..."
                value={formData.youtube_url}
                onChange={(e) => setFormData({ ...formData, youtube_url: e.target.value })}
                className="dark:bg-gray-950 dark:border-gray-700 dark:text-white h-11"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Paste any YouTube URL (watch, share, or embed link)
              </p>
              {formData.youtube_url && !isYouTubeUrl(formData.youtube_url) && (
                <p className="text-xs text-red-500">
                  Please enter a valid YouTube URL
                </p>
              )}
            </div>
          )}

          {/* PDF File Upload - for slides/documents */}
          {(formData.content_type === 'slides' || formData.content_type === 'document') && (
            <div className="space-y-2">
              <Label className="dark:text-gray-300 font-medium flex items-center gap-2">
                <Upload className="w-4 h-4 text-blue-500" />
                PDF File <span className="text-red-500">*</span>
              </Label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    if (file.type !== 'application/pdf') {
                      toast.error('Please select a PDF file');
                      return;
                    }
                    if (file.size > 100 * 1024 * 1024) {
                      toast.error('File size must be less than 100MB');
                      return;
                    }
                    setSelectedFile(file);
                  }
                }}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "w-full h-24 border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-all",
                  "dark:border-gray-700 dark:bg-gray-950 dark:text-white",
                  "hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/20",
                  selectedFile && "border-green-500 dark:border-green-500 bg-green-50 dark:bg-green-950/20"
                )}
              >
                {selectedFile ? (
                  <>
                    <FileText className="w-8 h-8 text-green-500" />
                    <span className="text-sm font-medium text-green-600 dark:text-green-400">{selectedFile.name}</span>
                    <span className="text-xs text-gray-500">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </span>
                  </>
                ) : (
                  <>
                    <Upload className="w-8 h-8 text-gray-400" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">Click to select PDF file</span>
                    <span className="text-xs text-gray-400">Max 100MB</span>
                  </>
                )}
              </Button>
              {editingResource && !selectedFile && (
                <p className="text-xs text-amber-500 dark:text-amber-400">
                  Leave empty to keep existing file
                </p>
              )}

              {/* Upload Progress Indicator */}
              {selectedFile && uploadStatus === 'uploading' && (
                <div className="mt-3 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-600 dark:text-gray-400">Uploading...</span>
                    <span className="font-medium tabular-nums text-blue-600 dark:text-blue-400">
                      {uploadProgressPercent}%
                    </span>
                  </div>
                  <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-300 ease-out"
                      style={{ width: `${uploadProgressPercent}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {(selectedFile.size / 1024 / 1024).toFixed(1)} MB &bull; Direct upload to storage
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Session Number and Duration */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="resource-session" className="dark:text-gray-300 font-medium">Session #</Label>
              <Input
                id="resource-session"
                type="number"
                placeholder="1"
                value={formData.session_number}
                onChange={(e) => setFormData({ ...formData, session_number: e.target.value })}
                className="dark:bg-gray-950 dark:border-gray-700 dark:text-white h-11"
              />
            </div>
            {formData.content_type === 'video' && (
              <div className="space-y-2">
                <Label htmlFor="resource-duration" className="dark:text-gray-300 font-medium">Duration (sec)</Label>
                <Input
                  id="resource-duration"
                  type="number"
                  placeholder="3600"
                  value={formData.duration_seconds}
                  onChange={(e) => setFormData({ ...formData, duration_seconds: e.target.value })}
                  className="dark:bg-gray-950 dark:border-gray-700 dark:text-white h-11"
                />
              </div>
            )}
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="dark:border-gray-700 dark:text-white dark:hover:bg-gray-800"
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            onClick={editingResource ? handleUpdate : handleCreate}
            disabled={
              saving ||
              !formData.title.trim() ||
              (formData.content_type === 'video' && !formData.youtube_url.trim()) ||
              (formData.content_type !== 'video' && !selectedFile && !editingResource)
            }
            className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white"
          >
            {saving ? (
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                {uploadStatus === 'requesting-url' && 'Preparing...'}
                {uploadStatus === 'uploading' && (
                  <span className="tabular-nums">{uploadProgressPercent}%</span>
                )}
                {uploadStatus === 'confirming' && 'Saving...'}
                {uploadStatus === 'idle' && uploadProgress && 'Uploading...'}
                {uploadStatus === 'idle' && !uploadProgress && 'Saving...'}
              </div>
            ) : (
              editingResource ? 'Update' : 'Add'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export type { ResourceFormData };
