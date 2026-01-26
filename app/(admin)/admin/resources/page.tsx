'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageLoader } from '@/components/ui/page-loader';
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
    return <PageLoader message="Loading resources..." />;
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 pb-6 border-b dark:border-gray-800">
        <div>
          <h1 className="text-3xl font-bold tracking-tight dark:text-white">Resource Management</h1>
          <p className="text-base text-gray-600 dark:text-gray-300 mt-2">
            Upload and organize course materials for cohorts
          </p>
        </div>

        {/* Cohort Selector */}
        <Select value={selectedCohort} onValueChange={handleCohortChange}>
          <SelectTrigger className="w-[220px] h-11 font-medium border-2 dark:border-gray-700 dark:bg-gray-900 dark:text-white">
            <SelectValue placeholder="Select cohort" />
          </SelectTrigger>
          <SelectContent className="dark:bg-gray-900 dark:border-gray-700">
            {cohorts.map((cohort) => (
              <SelectItem key={cohort.id} value={cohort.id} className="dark:text-white dark:focus:bg-gray-800">
                {cohort.name} ({cohort.tag})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!selectedCohort ? (
        <Card className="border-2 dark:border-gray-800 dark:bg-gray-950/50">
          <CardContent className="py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-blue-500/10 dark:bg-blue-500/20 flex items-center justify-center mx-auto mb-4">
              <FolderOpen className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            </div>
            <p className="text-lg font-semibold dark:text-white mb-2">Select a cohort to manage resources</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">Choose a cohort from the dropdown above</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Actions */}
          <div className="flex flex-wrap gap-3">
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
              className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white shadow-sm transition-all hover:shadow-md"
            >
              {uploading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Upload className="w-4 h-4 mr-2" />
              )}
              Upload Files
            </Button>
            <Button
              variant="outline"
              onClick={() => setFolderDialogOpen(true)}
              className="border-2 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:hover:bg-gray-800 transition-all"
            >
              <FolderPlus className="w-4 h-4 mr-2" />
              New Folder
            </Button>
            <Button
              variant="outline"
              onClick={() => setLinkDialogOpen(true)}
              className="border-2 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:hover:bg-gray-800 transition-all"
            >
              <LinkIcon className="w-4 h-4 mr-2" />
              Add Link
            </Button>
          </div>

          {/* Breadcrumbs */}
          {breadcrumbs.length > 0 && (
            <div className="flex items-center gap-1 text-sm p-3 rounded-lg bg-gray-50 dark:bg-gray-900 border dark:border-gray-800">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigateBack()}
                className="h-8 px-2 dark:text-white dark:hover:bg-gray-800"
              >
                <Home className="w-4 h-4" />
              </Button>
              {breadcrumbs.map((crumb, idx) => (
                <div key={crumb.id} className="flex items-center">
                  <ChevronRight className="w-4 h-4 text-gray-400 dark:text-gray-600" />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigateBack(idx)}
                    className="h-8 px-2 dark:text-white dark:hover:bg-gray-800 font-medium"
                  >
                    {crumb.name}
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Upload Drop Zone */}
          <div
            className={`border-2 border-dashed rounded-lg p-10 text-center transition-all ${
              dragOver
                ? 'border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-950/20 scale-[1.02]'
                : 'border-gray-300 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-600'
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
            <div className={`w-14 h-14 rounded-full mx-auto mb-3 flex items-center justify-center transition-colors ${
              dragOver
                ? 'bg-blue-500/20 dark:bg-blue-500/30'
                : 'bg-gray-100 dark:bg-gray-800'
            }`}>
              <Upload className={`w-7 h-7 transition-colors ${
                dragOver
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-gray-500 dark:text-gray-400'
              }`} />
            </div>
            <p className={`text-sm font-medium transition-colors ${
              dragOver
                ? 'text-blue-700 dark:text-blue-300'
                : 'text-gray-600 dark:text-gray-400'
            }`}>
              Drag and drop files here, or click the Upload button
            </p>
          </div>

          {/* Resources List */}
          <Card className="border-2 dark:border-gray-800 dark:bg-gray-950/50 shadow-sm">
            <CardHeader className="border-b dark:border-gray-800 pb-4">
              <CardTitle className="text-xl font-semibold dark:text-white flex items-center gap-2">
                <FolderOpen className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                Resources
              </CardTitle>
              <CardDescription className="dark:text-gray-400">
                {resources.length} item{resources.length !== 1 ? 's' : ''} in this location
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-5">
              {resourcesLoading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-14 w-full dark:bg-gray-800" />
                  ))}
                </div>
              ) : resources.length === 0 ? (
                <div className="text-center py-12 px-4 rounded-lg border-2 border-dashed dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50">
                  <div className="w-14 h-14 rounded-full bg-blue-500/10 dark:bg-blue-500/20 flex items-center justify-center mx-auto mb-3">
                    <FolderOpen className="w-7 h-7 text-blue-600 dark:text-blue-400" />
                  </div>
                  <p className="font-medium text-gray-600 dark:text-gray-300">No resources in this location</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Upload files or create folders to get started</p>
                </div>
              ) : (
                <div className="rounded-lg border dark:border-gray-700 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                        <TableHead className="font-semibold dark:text-gray-300">Name</TableHead>
                        <TableHead className="font-semibold dark:text-gray-300">Type</TableHead>
                        <TableHead className="font-semibold dark:text-gray-300">Size</TableHead>
                        <TableHead className="font-semibold dark:text-gray-300">Added</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {resources.map((resource) => (
                        <TableRow
                          key={resource.id}
                          className={`border-b dark:border-gray-800 transition-colors ${
                            resource.type === 'folder'
                              ? 'cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-950/20'
                              : 'hover:bg-gray-50 dark:hover:bg-gray-900/50'
                          }`}
                          onClick={() => {
                            if (resource.type === 'folder') {
                              navigateToFolder(resource);
                            }
                          }}
                        >
                          <TableCell>
                            <div className="flex items-center gap-3">
                              {getResourceIcon(resource)}
                              <span className="font-medium dark:text-white">{resource.name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="capitalize dark:text-gray-300">
                            {resource.type === 'link' ? 'External Link' : resource.type}
                          </TableCell>
                          <TableCell className="dark:text-gray-400">{formatFileSize(resource.file_size)}</TableCell>
                          <TableCell className="dark:text-gray-400">
                            {format(new Date(resource.created_at), 'MMM d, yyyy')}
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="dark:text-white dark:hover:bg-gray-800">
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="dark:bg-gray-900 dark:border-gray-700">
                                {resource.type === 'link' && resource.external_url && (
                                  <DropdownMenuItem asChild className="dark:text-white dark:focus:bg-gray-800">
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
                                  className="text-red-600 dark:text-red-400 dark:focus:bg-red-950/20"
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
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Create Folder Dialog */}
      <Dialog open={folderDialogOpen} onOpenChange={setFolderDialogOpen}>
        <DialogContent className="dark:bg-gray-900 dark:border-gray-700">
          <DialogHeader>
            <DialogTitle className="dark:text-white">Create Folder</DialogTitle>
            <DialogDescription className="dark:text-gray-400">
              Create a new folder to organize resources
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="folderName" className="dark:text-gray-300">Folder Name</Label>
              <Input
                id="folderName"
                placeholder="Week 1 Materials"
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                className="dark:bg-gray-950 dark:border-gray-700 dark:text-white"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setFolderDialogOpen(false)}
              className="dark:border-gray-700 dark:text-white dark:hover:bg-gray-800"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateFolder}
              disabled={createLoading || !folderName.trim()}
              className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white"
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
        <DialogContent className="dark:bg-gray-900 dark:border-gray-700">
          <DialogHeader>
            <DialogTitle className="dark:text-white">Add External Link</DialogTitle>
            <DialogDescription className="dark:text-gray-400">
              Add a link to external content like YouTube videos or articles
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="linkName" className="dark:text-gray-300">Link Name</Label>
              <Input
                id="linkName"
                placeholder="Product Management Tutorial"
                value={linkName}
                onChange={(e) => setLinkName(e.target.value)}
                className="dark:bg-gray-950 dark:border-gray-700 dark:text-white"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="linkUrl" className="dark:text-gray-300">URL</Label>
              <Input
                id="linkUrl"
                type="url"
                placeholder="https://youtube.com/watch?v=..."
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                className="dark:bg-gray-950 dark:border-gray-700 dark:text-white"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setLinkDialogOpen(false)}
              className="dark:border-gray-700 dark:text-white dark:hover:bg-gray-800"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateLink}
              disabled={createLoading || !linkName.trim() || !linkUrl.trim()}
              className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white"
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
