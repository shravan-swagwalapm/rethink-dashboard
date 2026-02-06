'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Upload, Video, Plus, X, Loader2 } from 'lucide-react';
import { VideoFormRow, generateId, isValidUrl } from '../types';

interface VideoTabProps {
  isGlobalMode: boolean;
  selectedCohortId: string;
  onUploadComplete: () => void;
}

export function VideoTab({ isGlobalMode, selectedCohortId, onUploadComplete }: VideoTabProps) {
  const [videoRows, setVideoRows] = useState<VideoFormRow[]>([
    { id: generateId(), title: '', url: '', thumbnailUrl: '', duration: '' },
  ]);
  const [videoUploading, setVideoUploading] = useState(false);

  const validVideoCount = videoRows.filter(r => r.title.trim() && r.url.trim() && isValidUrl(r.url)).length;

  const addVideoRow = () => {
    setVideoRows([...videoRows, { id: generateId(), title: '', url: '', thumbnailUrl: '', duration: '' }]);
  };

  const removeVideoRow = (id: string) => {
    if (videoRows.length > 1) {
      setVideoRows(videoRows.filter(r => r.id !== id));
    }
  };

  const updateVideoRow = (id: string, field: keyof VideoFormRow, value: string) => {
    setVideoRows(videoRows.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const handleVideoUpload = async () => {
    if (!isGlobalMode && !selectedCohortId) {
      toast.error('Please select a cohort or enable Global Mode');
      return;
    }

    const validRows = videoRows.filter(r => r.title.trim() && r.url.trim() && isValidUrl(r.url));
    if (validRows.length === 0) {
      toast.error('Please add at least one valid video with title and URL');
      return;
    }

    setVideoUploading(true);
    let successCount = 0;
    let failCount = 0;

    for (const row of validRows) {
      try {
        const formData = new FormData();
        formData.append('name', row.title);
        formData.append('category', 'video');
        formData.append('external_url', row.url);
        formData.append('is_global', isGlobalMode.toString());
        if (!isGlobalMode && selectedCohortId) {
          formData.append('cohort_id', selectedCohortId);
        }
        if (row.thumbnailUrl) {
          formData.append('thumbnail_url', row.thumbnailUrl);
        }
        if (row.duration) {
          formData.append('duration', row.duration);
        }

        const response = await fetch('/api/admin/resources', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `Upload failed (${response.status})`);
        }
        successCount++;
      } catch (error) {
        console.error('Video upload error:', error);
        failCount++;
        if (failCount === 1 && error instanceof Error) {
          toast.error(`Video upload failed: ${error.message}`);
        }
      }
    }

    setVideoUploading(false);

    if (successCount > 0) {
      toast.success(`Uploaded ${successCount} video${successCount > 1 ? 's' : ''}`);
      setVideoRows([{ id: generateId(), title: '', url: '', thumbnailUrl: '', duration: '' }]);
      onUploadComplete();
    }
    if (failCount > 1) {
      toast.error(`Failed to upload ${failCount} videos total`);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Video className="w-5 h-5 text-purple-500" />
          Bulk Upload Videos
        </CardTitle>
        <CardDescription>
          Add multiple video links at once. All videos will be tagged to the selected cohort.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {videoRows.map((row, index) => (
          <div key={row.id} className="grid grid-cols-12 gap-3 items-start">
            <div className="col-span-3">
              <Label className="text-xs text-muted-foreground mb-1.5 block">
                Title {index === 0 && <span className="text-destructive">*</span>}
              </Label>
              <Input
                placeholder="Video title..."
                value={row.title}
                onChange={(e) => updateVideoRow(row.id, 'title', e.target.value)}
              />
            </div>
            <div className="col-span-4">
              <Label className="text-xs text-muted-foreground mb-1.5 block">
                URL {index === 0 && <span className="text-destructive">*</span>}
              </Label>
              <Input
                placeholder="https://youtube.com/watch?v=..."
                value={row.url}
                onChange={(e) => updateVideoRow(row.id, 'url', e.target.value)}
              />
            </div>
            <div className="col-span-2">
              <Label className="text-xs text-muted-foreground mb-1.5 block">
                Thumbnail URL
              </Label>
              <Input
                placeholder="Optional"
                value={row.thumbnailUrl}
                onChange={(e) => updateVideoRow(row.id, 'thumbnailUrl', e.target.value)}
              />
            </div>
            <div className="col-span-2">
              <Label className="text-xs text-muted-foreground mb-1.5 block">
                Duration
              </Label>
              <Input
                placeholder="10:24"
                value={row.duration}
                onChange={(e) => updateVideoRow(row.id, 'duration', e.target.value)}
              />
            </div>
            <div className="col-span-1 pt-6">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeVideoRow(row.id)}
                disabled={videoRows.length === 1}
                className="text-muted-foreground hover:text-destructive"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}

        <div className="flex items-center gap-3 pt-2">
          <Button variant="outline" onClick={addVideoRow} className="gap-2">
            <Plus className="w-4 h-4" />
            Add Another Video
          </Button>
          <Button
            onClick={handleVideoUpload}
            disabled={videoUploading || validVideoCount === 0 || (!isGlobalMode && !selectedCohortId)}
            className="gap-2 gradient-bg"
          >
            {videoUploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Upload {validVideoCount} Video{validVideoCount !== 1 ? 's' : ''}
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
