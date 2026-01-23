'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import {
  FolderPlus,
  Upload,
  FolderOpen,
  File,
  Link as LinkIcon,
  MoreVertical,
  Trash2,
  Pencil,
  ExternalLink,
  Loader2,
  ChevronRight,
  Home,
  FileText,
  FileSpreadsheet,
  Video,
  ArrowLeft,
} from 'lucide-react';
import { format } from 'date-fns';
import type { Cohort, Resource } from '@/types';

interface ResourceWithUploader extends Resource {
  uploaded_by_profile?: {
    id: string;
    full_name: string | null;
    email: string;
  };
}

export default function AdminResourcesPage() {
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [resources, setResources] = useState<ResourceWithUploader[]>([]);
  const [loading, setLoading] = useState(true);
  const [resourcesLoading, setResourcesLoading] = useState(false);

  // Selected cohort and folder navigation
  const [selectedCohort, setSelectedCohort] = useState<string>('');
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<{ id: string | null; name: string }[]>([]);

  // Dialog states
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [linkName, setLinkName] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [createLoading, setCreateLoading] = useState(false);

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch cohorts
  const fetchCohorts = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/cohorts');
      if (!response.ok) throw new Error('Failed to fetch cohorts');
      const data = await response.json();
      setCohorts(data || []);
    } catch (error) {
      toast.error('Failed to load cohorts');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch resources for selected cohort
  const fetchResources = useCallback(async () => {
    if (!selectedCohort) {
      setResources([]);
      return;
    }

    setResourcesLoading(true);
    try {
      const params = new URLSearchParams({ cohort_id: selectedCohort });
      if (currentFolder) {
        params.append('parent_id', currentFolder);
      }

      const response = await fetch(`/api/admin/resources?${params}`);
      if (!response.ok) throw new Error('Failed to fetch resources');
      const data = await response.json();
      setResources(data || []);
    } catch (error) {
      toast.error('Failed to load resources');
    } finally {
      setResourcesLoading(false);
    }
  }, [selectedCohort, currentFolder]);

  useEffect(() => {
    fetchCohorts();
  }, [fetchCohorts]);

  useEffect(() => {
    fetchResources();
  }, [fetchResources]);

  // Handle cohort change - reset folder navigation
  const handleCohortChange = (cohortId: string) => {
    setSelectedCohort(cohortId);
    setCurrentFolder(null);
    setBreadcrumbs([]);
  };

  // Navigate into folder
  const navigateToFolder = (folder: ResourceWithUploader) => {
    setCurrentFolder(folder.id);
    setBreadcrumbs([...breadcrumbs, { id: folder.id, name: folder.name }]);
  };

  // Navigate back
  const navigateBack = (index?: number) => {
    if (index === undefined) {
      // Go to root
      setCurrentFolder(null);
      setBreadcrumbs([]);
    } else {
      // Go to specific breadcrumb
      const newBreadcrumbs = breadcrumbs.slice(0, index + 1);
      setBreadcrumbs(newBreadcrumbs);
      setCurrentFolder(newBreadcrumbs[newBreadcrumbs.length - 1]?.id || null);
    }
  };

  // Create folder
  const handleCreateFolder = async () => {
    if (!folderName.trim() || !selectedCohort) return;

    setCreateLoading(true);
    try {
      const response = await fetch('/api/admin/resources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: folderName.trim(),
          type: 'folder',
          cohort_id: selectedCohort,
          parent_id: currentFolder,
        }),
      });

      if (!response.ok) throw new Error('Failed to create folder');

      toast.success('Folder created');
      setFolderDialogOpen(false);
      setFolderName('');
      fetchResources();
    } catch (error) {
      toast.error('Failed to create folder');
    } finally {
      setCreateLoading(false);
    }
  };

  // Create link
  const handleCreateLink = async () => {
    if (!linkName.trim() || !linkUrl.trim() || !selectedCohort) return;

    setCreateLoading(true);
    try {
      const response = await fetch('/api/admin/resources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: linkName.trim(),
          type: 'link',
          external_url: linkUrl.trim(),
          cohort_id: selectedCohort,
          parent_id: currentFolder,
        }),
      });

      if (!response.ok) throw new Error('Failed to create link');

      toast.success('Link added');
      setLinkDialogOpen(false);
      setLinkName('');
      setLinkUrl('');
      fetchResources();
    } catch (error) {
      toast.error('Failed to create link');
    } finally {
      setCreateLoading(false);
    }
  };

  // Handle file upload
  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0 || !selectedCohort) return;

    setUploading(true);
    let successCount = 0;
    let failCount = 0;

    for (const file of Array.from(files)) {
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('cohort_id', selectedCohort);
        if (currentFolder) {
          formData.append('parent_id', currentFolder);
        }

        const response = await fetch('/api/admin/resources/upload', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) throw new Error('Upload failed');
        successCount++;
      } catch (error) {
        failCount++;
      }
    }

    setUploading(false);

    if (successCount > 0) {
      toast.success(`Uploaded ${successCount} file${successCount > 1 ? 's' : ''}`);
      fetchResources();
    }
    if (failCount > 0) {
      toast.error(`Failed to upload ${failCount} file${failCount > 1 ? 's' : ''}`);
    }
  };

  // Delete resource
  const handleDelete = async (resource: ResourceWithUploader) => {
    if (!confirm(`Delete "${resource.name}"?`)) return;

    try {
      const response = await fetch(`/api/admin/resources?id=${resource.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete');

      toast.success('Deleted');
      fetchResources();
    } catch (error) {
      toast.error('Failed to delete');
    }
  };

  // Get icon for resource type
  const getResourceIcon = (resource: ResourceWithUploader) => {
    if (resource.type === 'folder') {
      return <FolderOpen className="w-5 h-5 text-amber-500" />;
    }
    if (resource.type === 'link') {
      return <LinkIcon className="w-5 h-5 text-blue-500" />;
    }
    switch (resource.file_type) {
      case 'pdf':
        return <FileText className="w-5 h-5 text-red-500" />;
      case 'doc':
      case 'docx':
        return <FileText className="w-5 h-5 text-blue-600" />;
      case 'xls':
      case 'xlsx':
        return <FileSpreadsheet className="w-5 h-5 text-green-600" />;
      case 'mp4':
        return <Video className="w-5 h-5 text-purple-500" />;
      default:
        return <File className="w-5 h-5 text-gray-500" />;
    }
  };

  // Format file size
  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Resource Management</h1>
          <p className="text-muted-foreground">
            Upload and organize course materials for cohorts
          </p>
        </div>

        {/* Cohort Selector */}
        <Select value={selectedCohort} onValueChange={handleCohortChange}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Select cohort" />
          </SelectTrigger>
          <SelectContent>
            {cohorts.map((cohort) => (
              <SelectItem key={cohort.id} value={cohort.id}>
                {cohort.name} ({cohort.tag})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!selectedCohort ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <FolderOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">Select a cohort to manage resources</p>
            <p className="text-sm">Choose a cohort from the dropdown above</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.xls,.xlsx,.mp4,.mov,.avi,.webm"
              onChange={(e) => handleFileUpload(e.target.files)}
              className="hidden"
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="gradient-bg"
            >
              {uploading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Upload className="w-4 h-4 mr-2" />
              )}
              Upload Files
            </Button>
            <Button variant="outline" onClick={() => setFolderDialogOpen(true)}>
              <FolderPlus className="w-4 h-4 mr-2" />
              New Folder
            </Button>
            <Button variant="outline" onClick={() => setLinkDialogOpen(true)}>
              <LinkIcon className="w-4 h-4 mr-2" />
              Add Link
            </Button>
          </div>

          {/* Breadcrumbs */}
          {breadcrumbs.length > 0 && (
            <div className="flex items-center gap-1 text-sm">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigateBack()}
                className="h-8 px-2"
              >
                <Home className="w-4 h-4" />
              </Button>
              {breadcrumbs.map((crumb, idx) => (
                <div key={crumb.id} className="flex items-center">
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigateBack(idx)}
                    className="h-8 px-2"
                  >
                    {crumb.name}
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Upload Drop Zone */}
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
              dragOver
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/50'
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              handleFileUpload(e.dataTransfer.files);
            }}
          >
            <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Drag and drop files here, or click the Upload button
            </p>
          </div>

          {/* Resources List */}
          <Card>
            <CardHeader>
              <CardTitle>Resources</CardTitle>
              <CardDescription>
                {resources.length} item{resources.length !== 1 ? 's' : ''} in this location
              </CardDescription>
            </CardHeader>
            <CardContent>
              {resourcesLoading ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : resources.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FolderOpen className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p>No resources in this location</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead>Added</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {resources.map((resource) => (
                      <TableRow
                        key={resource.id}
                        className={resource.type === 'folder' ? 'cursor-pointer hover:bg-muted/50' : ''}
                        onClick={() => {
                          if (resource.type === 'folder') {
                            navigateToFolder(resource);
                          }
                        }}
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            {getResourceIcon(resource)}
                            <span className="font-medium">{resource.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="capitalize">
                          {resource.type === 'link' ? 'External Link' : resource.type}
                        </TableCell>
                        <TableCell>{formatFileSize(resource.file_size)}</TableCell>
                        <TableCell>
                          {format(new Date(resource.created_at), 'MMM d, yyyy')}
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {resource.type === 'link' && resource.external_url && (
                                <DropdownMenuItem asChild>
                                  <a
                                    href={resource.external_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    <ExternalLink className="w-4 h-4 mr-2" />
                                    Open Link
                                  </a>
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                onClick={() => handleDelete(resource)}
                                className="text-destructive"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Create Folder Dialog */}
      <Dialog open={folderDialogOpen} onOpenChange={setFolderDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Folder</DialogTitle>
            <DialogDescription>
              Create a new folder to organize resources
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="folderName">Folder Name</Label>
              <Input
                id="folderName"
                placeholder="Week 1 Materials"
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFolderDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateFolder}
              disabled={createLoading || !folderName.trim()}
              className="gradient-bg"
            >
              {createLoading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : null}
              Create Folder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Link Dialog */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add External Link</DialogTitle>
            <DialogDescription>
              Add a link to external content like YouTube videos or articles
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="linkName">Link Name</Label>
              <Input
                id="linkName"
                placeholder="Product Management Tutorial"
                value={linkName}
                onChange={(e) => setLinkName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="linkUrl">URL</Label>
              <Input
                id="linkUrl"
                type="url"
                placeholder="https://youtube.com/watch?v=..."
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateLink}
              disabled={createLoading || !linkName.trim() || !linkUrl.trim()}
              className="gradient-bg"
            >
              {createLoading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : null}
              Add Link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
