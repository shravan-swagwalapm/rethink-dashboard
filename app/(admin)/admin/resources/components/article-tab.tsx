'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Upload, Link as LinkIcon, Plus, X, Loader2 } from 'lucide-react';
import { ArticleFormRow, generateId, isValidUrl } from '../types';

interface ArticleTabProps {
  isGlobalMode: boolean;
  selectedCohortId: string;
  onUploadComplete: () => void;
}

export function ArticleTab({ isGlobalMode, selectedCohortId, onUploadComplete }: ArticleTabProps) {
  const [articleRows, setArticleRows] = useState<ArticleFormRow[]>([
    { id: generateId(), title: '', url: '' },
  ]);
  const [articleUploading, setArticleUploading] = useState(false);

  const validArticleCount = articleRows.filter(r => r.title.trim() && r.url.trim() && isValidUrl(r.url)).length;

  const addArticleRow = () => {
    setArticleRows([...articleRows, { id: generateId(), title: '', url: '' }]);
  };

  const removeArticleRow = (id: string) => {
    if (articleRows.length > 1) {
      setArticleRows(articleRows.filter(r => r.id !== id));
    }
  };

  const updateArticleRow = (id: string, field: keyof ArticleFormRow, value: string) => {
    setArticleRows(articleRows.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const handleArticleUpload = async () => {
    if (!isGlobalMode && !selectedCohortId) {
      toast.error('Please select a cohort or enable Global Mode');
      return;
    }

    const validRows = articleRows.filter(r => r.title.trim() && r.url.trim() && isValidUrl(r.url));
    if (validRows.length === 0) {
      toast.error('Please add at least one valid article with title and URL');
      return;
    }

    setArticleUploading(true);
    let successCount = 0;
    let failCount = 0;

    for (const row of validRows) {
      try {
        const formData = new FormData();
        formData.append('name', row.title);
        formData.append('category', 'article');
        formData.append('external_url', row.url);
        formData.append('is_global', isGlobalMode.toString());
        if (!isGlobalMode && selectedCohortId) {
          formData.append('cohort_id', selectedCohortId);
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
        console.error('Article upload error:', error);
        failCount++;
        if (failCount === 1 && error instanceof Error) {
          toast.error(`Article upload failed: ${error.message}`);
        }
      }
    }

    setArticleUploading(false);

    if (successCount > 0) {
      toast.success(`Uploaded ${successCount} article${successCount > 1 ? 's' : ''}`);
      setArticleRows([{ id: generateId(), title: '', url: '' }]);
      onUploadComplete();
    }
    if (failCount > 1) {
      toast.error(`Failed to upload ${failCount} articles total`);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LinkIcon className="w-5 h-5 text-blue-500" />
          Bulk Upload Articles
        </CardTitle>
        <CardDescription>
          Add multiple article links at once.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {articleRows.map((row, index) => (
          <div key={row.id} className="grid grid-cols-12 gap-3 items-start">
            <div className="col-span-4">
              <Label className="text-xs text-muted-foreground mb-1.5 block">
                Title {index === 0 && <span className="text-destructive">*</span>}
              </Label>
              <Input
                placeholder="Article title..."
                value={row.title}
                onChange={(e) => updateArticleRow(row.id, 'title', e.target.value)}
              />
            </div>
            <div className="col-span-7">
              <Label className="text-xs text-muted-foreground mb-1.5 block">
                URL {index === 0 && <span className="text-destructive">*</span>}
              </Label>
              <Input
                placeholder="https://medium.com/..."
                value={row.url}
                onChange={(e) => updateArticleRow(row.id, 'url', e.target.value)}
              />
            </div>
            <div className="col-span-1 pt-6">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeArticleRow(row.id)}
                disabled={articleRows.length === 1}
                className="text-muted-foreground hover:text-destructive"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}

        <div className="flex items-center gap-3 pt-2">
          <Button variant="outline" onClick={addArticleRow} className="gap-2">
            <Plus className="w-4 h-4" />
            Add Another Article
          </Button>
          <Button
            onClick={handleArticleUpload}
            disabled={articleUploading || validArticleCount === 0 || (!isGlobalMode && !selectedCohortId)}
            className="gap-2 gradient-bg"
          >
            {articleUploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Upload {validArticleCount} Article{validArticleCount !== 1 ? 's' : ''}
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
