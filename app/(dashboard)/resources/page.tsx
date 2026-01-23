'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@/hooks/use-user';
import { getClient } from '@/lib/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import {
  Search,
  Folder,
  FolderOpen,
  FileText,
  FileSpreadsheet,
  FileVideo,
  File,
  ChevronRight,
  Home,
  Download,
  Eye,
  MoreVertical,
  ArrowLeft,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import type { Resource } from '@/types';

export default function ResourcesPage() {
  const { profile, loading: userLoading } = useUser();
  const [resources, setResources] = useState<Resource[]>([]);
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [previewResource, setPreviewResource] = useState<Resource | null>(null);

  useEffect(() => {
    const fetchResources = async () => {
      if (!profile?.cohort_id) {
        setLoading(false);
        return;
      }

      const supabase = getClient();

      try {
        let query = supabase
          .from('resources')
          .select('*')
          .eq('cohort_id', profile.cohort_id)
          .order('type', { ascending: true })
          .order('name', { ascending: true });

        if (currentFolder) {
          query = query.eq('parent_id', currentFolder);
        } else {
          query = query.is('parent_id', null);
        }

        const { data, error } = await query;

        if (error) throw error;

        setResources(data || []);
      } catch (error) {
        console.error('Error fetching resources:', error);
        toast.error('Failed to load resources');
      } finally {
        setLoading(false);
      }
    };

    if (!userLoading) {
      fetchResources();
    }
  }, [profile, currentFolder, userLoading]);

  // Build breadcrumbs when folder changes
  useEffect(() => {
    const buildBreadcrumbs = async () => {
      if (!currentFolder) {
        setBreadcrumbs([]);
        return;
      }

      const supabase = getClient();
      const crumbs: Resource[] = [];
      let folderId: string | null = currentFolder;

      while (folderId) {
        const { data: folder } = await supabase
          .from('resources')
          .select('*')
          .eq('id', folderId)
          .single() as { data: Resource | null };

        if (folder) {
          crumbs.unshift(folder);
          folderId = folder.parent_id;
        } else {
          break;
        }
      }

      setBreadcrumbs(crumbs);
    };

    buildBreadcrumbs();
  }, [currentFolder]);

  const getFileIcon = (fileType: string | null) => {
    switch (fileType?.toLowerCase()) {
      case 'pdf':
        return <FileText className="w-6 h-6 text-red-500" />;
      case 'doc':
      case 'docx':
        return <FileText className="w-6 h-6 text-blue-500" />;
      case 'xls':
      case 'xlsx':
        return <FileSpreadsheet className="w-6 h-6 text-green-500" />;
      case 'mp4':
      case 'mov':
      case 'avi':
        return <FileVideo className="w-6 h-6 text-purple-500" />;
      default:
        return <File className="w-6 h-6 text-muted-foreground" />;
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '--';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleDownload = async (resource: Resource) => {
    if (!resource.file_path) {
      toast.error('File not available');
      return;
    }

    const supabase = getClient();
    const { data, error } = await supabase.storage
      .from('resources')
      .createSignedUrl(resource.file_path, 60);

    if (error || !data) {
      toast.error('Failed to download file');
      return;
    }

    window.open(data.signedUrl, '_blank');
  };

  const handlePreview = async (resource: Resource) => {
    if (resource.file_type?.toLowerCase() === 'pdf') {
      setPreviewResource(resource);
    } else {
      handleDownload(resource);
    }
  };

  // Filter resources based on search
  const filteredResources = searchQuery
    ? resources.filter(r =>
        r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.keywords?.some(k => k.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : resources;

  const folders = filteredResources.filter(r => r.type === 'folder');
  const files = filteredResources.filter(r => r.type === 'file');

  if (userLoading || loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-64" />
        </div>
        <Skeleton className="h-10 w-96" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {[...Array(10)].map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Resources</h1>
          <p className="text-muted-foreground">
            Access course materials, documents, and files
          </p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-sm">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2"
          onClick={() => setCurrentFolder(null)}
        >
          <Home className="w-4 h-4" />
        </Button>
        {breadcrumbs.map((crumb, index) => (
          <div key={crumb.id} className="flex items-center gap-2">
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2"
              onClick={() => setCurrentFolder(crumb.id)}
            >
              {crumb.name}
            </Button>
          </div>
        ))}
      </div>

      {/* Back button when in folder */}
      {currentFolder && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCurrentFolder(breadcrumbs[breadcrumbs.length - 2]?.id || null)}
          className="gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>
      )}

      {resources.length === 0 && !currentFolder ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <FolderOpen className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No resources yet</h3>
            <p className="text-muted-foreground text-center max-w-sm">
              Resources will appear here once uploaded by your instructors.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Folders */}
          {folders.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground">Folders</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {folders.map((folder) => (
                  <button
                    key={folder.id}
                    onClick={() => setCurrentFolder(folder.id)}
                    className="group p-4 rounded-xl border bg-card hover:bg-muted/50 hover:border-primary/50 transition-all hover-lift text-left"
                  >
                    <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                      <Folder className="w-6 h-6 text-amber-500" />
                    </div>
                    <p className="font-medium truncate">{folder.name}</p>
                    {folder.week_number && (
                      <Badge variant="secondary" className="mt-2">
                        Week {folder.week_number}
                      </Badge>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Files */}
          {files.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground">Files</h3>
              <div className="grid gap-2">
                {files.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center gap-4 p-4 rounded-xl border bg-card hover:bg-muted/50 transition-colors group"
                  >
                    <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                      {getFileIcon(file.file_type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{file.name}</p>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <span className="uppercase">{file.file_type || 'File'}</span>
                        <span>•</span>
                        <span>{formatFileSize(file.file_size)}</span>
                        {file.created_at && (
                          <>
                            <span>•</span>
                            <span>{format(new Date(file.created_at), 'MMM d, yyyy')}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {file.file_type?.toLowerCase() === 'pdf' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handlePreview(file)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDownload(file)}
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="sm:hidden">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {file.file_type?.toLowerCase() === 'pdf' && (
                          <DropdownMenuItem onClick={() => handlePreview(file)}>
                            <Eye className="w-4 h-4 mr-2" />
                            Preview
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => handleDownload(file)}>
                          <Download className="w-4 h-4 mr-2" />
                          Download
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
              </div>
            </div>
          )}

          {filteredResources.length === 0 && searchQuery && (
            <div className="text-center py-8">
              <Search className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground">
                No results found for &ldquo;{searchQuery}&rdquo;
              </p>
            </div>
          )}

          {filteredResources.length === 0 && !searchQuery && currentFolder && (
            <div className="text-center py-8">
              <FolderOpen className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground">This folder is empty</p>
            </div>
          )}
        </div>
      )}

      {/* PDF Preview Dialog */}
      <Dialog open={!!previewResource} onOpenChange={(open) => !open && setPreviewResource(null)}>
        <DialogContent className="max-w-4xl h-[80vh]">
          <DialogHeader>
            <DialogTitle>{previewResource?.name}</DialogTitle>
            <DialogDescription>
              {previewResource?.file_type?.toUpperCase()} • {formatFileSize(previewResource?.file_size || null)}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0">
            {previewResource?.file_path && (
              <iframe
                src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/resources/${previewResource.file_path}`}
                className="w-full h-full rounded-lg"
                title={previewResource.name}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
