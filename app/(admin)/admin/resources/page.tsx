'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { PageLoader } from '@/components/ui/page-loader';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import {
  Upload,
  FolderOpen,
  File,
  Link as LinkIcon,
  MoreVertical,
  Trash2,
  Pencil,
  ExternalLink,
  Loader2,
  Video,
  FileText,
  Presentation,
  Globe,
  Users,
  Plus,
  X,
  Download,
  Search,
  ChevronLeft,
  ChevronRight,
  Check,
  AlertCircle,
} from 'lucide-react';
import { format } from 'date-fns';
import type { Cohort, Resource, ResourceCategory } from '@/types';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface ResourceWithCohort extends Resource {
  cohort?: {
    id: string;
    name: string;
    tag: string;
  };
}

// Video form row type
interface VideoFormRow {
  id: string;
  title: string;
  url: string;
  thumbnailUrl: string;
  duration: string;
}

// Article form row type
interface ArticleFormRow {
  id: string;
  title: string;
  url: string;
}

// File upload queue item
interface FileUploadItem {
  id: string;
  file: File;
  name: string;
  size: number;
  progress: number;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
}

// Edit resource form data
interface EditFormData {
  name: string;
  external_url: string;
  thumbnail_url: string;
  duration: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const ITEMS_PER_PAGE = 20;
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const ACCEPTED_FILE_TYPES = '.pdf,.ppt,.pptx,.doc,.docx';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// Generate unique ID for form rows
const generateId = () => Math.random().toString(36).substring(2, 9);

// Format file size to human readable
const formatFileSize = (bytes: number | null): string => {
  if (!bytes) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// Validate URL format
const isValidUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

// Get icon for resource category
const getCategoryIcon = (category: ResourceCategory | null) => {
  switch (category) {
    case 'video':
      return <Video className="w-4 h-4 text-purple-500" />;
    case 'article':
      return <LinkIcon className="w-4 h-4 text-blue-500" />;
    case 'presentation':
      return <Presentation className="w-4 h-4 text-orange-500" />;
    case 'pdf':
      return <FileText className="w-4 h-4 text-red-500" />;
    default:
      return <File className="w-4 h-4 text-gray-500" />;
  }
};

// Export resources to CSV
const exportToCSV = (resources: ResourceWithCohort[]) => {
  const headers = ['Name', 'Category', 'Type', 'Size', 'Cohort', 'Global', 'Created At'];
  const rows = resources.map(r => [
    r.name,
    r.category || '-',
    r.type,
    formatFileSize(r.file_size),
    r.cohort?.name || 'Global',
    r.is_global ? 'Yes' : 'No',
    format(new Date(r.created_at), 'yyyy-MM-dd HH:mm'),
  ]);

  const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `resources-export-${format(new Date(), 'yyyy-MM-dd')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function AdminResourcesPage() {
  // ---------------------------------------------------------------------------
  // STATE - Core Data
  // ---------------------------------------------------------------------------
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [resources, setResources] = useState<ResourceWithCohort[]>([]);
  const [loading, setLoading] = useState(true);
  const [resourcesLoading, setResourcesLoading] = useState(false);

  // ---------------------------------------------------------------------------
  // STATE - Cohort Context
  // ---------------------------------------------------------------------------
  const [selectedCohortId, setSelectedCohortId] = useState<string>('');
  const [isGlobalMode, setIsGlobalMode] = useState(false);

  // ---------------------------------------------------------------------------
  // STATE - Active Tab
  // ---------------------------------------------------------------------------
  const [activeTab, setActiveTab] = useState<ResourceCategory>('video');

  // ---------------------------------------------------------------------------
  // STATE - Video Form (multi-row)
  // ---------------------------------------------------------------------------
  const [videoRows, setVideoRows] = useState<VideoFormRow[]>([
    { id: generateId(), title: '', url: '', thumbnailUrl: '', duration: '' },
  ]);
  const [videoUploading, setVideoUploading] = useState(false);

  // ---------------------------------------------------------------------------
  // STATE - Article Form (multi-row)
  // ---------------------------------------------------------------------------
  const [articleRows, setArticleRows] = useState<ArticleFormRow[]>([
    { id: generateId(), title: '', url: '' },
  ]);
  const [articleUploading, setArticleUploading] = useState(false);

  // ---------------------------------------------------------------------------
  // STATE - File Upload Queue (presentations/PDFs)
  // ---------------------------------------------------------------------------
  const [fileQueue, setFileQueue] = useState<FileUploadItem[]>([]);
  const [fileUploading, setFileUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ---------------------------------------------------------------------------
  // STATE - Resources Table
  // ---------------------------------------------------------------------------
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedResourceIds, setSelectedResourceIds] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);

  // ---------------------------------------------------------------------------
  // STATE - Edit Dialog
  // ---------------------------------------------------------------------------
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingResource, setEditingResource] = useState<ResourceWithCohort | null>(null);
  const [editFormData, setEditFormData] = useState<EditFormData>({
    name: '',
    external_url: '',
    thumbnail_url: '',
    duration: '',
  });
  const [editSaving, setEditSaving] = useState(false);

  // ---------------------------------------------------------------------------
  // STATE - Delete Confirmation
  // ---------------------------------------------------------------------------
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingResource, setDeletingResource] = useState<ResourceWithCohort | null>(null);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);

  // ---------------------------------------------------------------------------
  // STATE - Move to Cohort Dialog
  // ---------------------------------------------------------------------------
  const [moveCohortDialogOpen, setMoveCohortDialogOpen] = useState(false);
  const [moveToCohortId, setMoveToCohortId] = useState<string>('');

  // ---------------------------------------------------------------------------
  // REFS
  // ---------------------------------------------------------------------------
  const hasFetchedRef = useRef(false);

  // ---------------------------------------------------------------------------
  // COMPUTED VALUES
  // ---------------------------------------------------------------------------

  // Filter resources based on search
  const filteredResources = resources.filter(r =>
    r.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Paginate
  const totalPages = Math.ceil(filteredResources.length / ITEMS_PER_PAGE);
  const paginatedResources = filteredResources.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Check if all visible items are selected
  const allSelected = paginatedResources.length > 0 &&
    paginatedResources.every(r => selectedResourceIds.has(r.id));

  // Get selected cohort details
  const selectedCohort = cohorts.find(c => c.id === selectedCohortId);

  // Count valid video rows
  const validVideoCount = videoRows.filter(r => r.title.trim() && r.url.trim() && isValidUrl(r.url)).length;

  // Count valid article rows
  const validArticleCount = articleRows.filter(r => r.title.trim() && r.url.trim() && isValidUrl(r.url)).length;

  // ---------------------------------------------------------------------------
  // DATA FETCHING
  // ---------------------------------------------------------------------------

  // Fetch cohorts on mount
  const fetchCohorts = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/cohorts');
      if (!response.ok) throw new Error('Failed to fetch cohorts');
      const data = await response.json();
      setCohorts(data || []);
    } catch (error) {
      console.error('Error fetching cohorts:', error);
      toast.error('Failed to load cohorts');
    }
  }, []);

  // Fetch resources based on selected cohort or global mode
  const fetchResources = useCallback(async () => {
    setResourcesLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeTab) params.append('category', activeTab);
      if (searchQuery) params.append('search', searchQuery);

      const response = await fetch(`/api/admin/resources?${params}`);
      if (!response.ok) throw new Error('Failed to fetch resources');
      const data = await response.json();

      // Filter based on cohort selection or global mode
      let filtered = data.resources || [];
      if (isGlobalMode) {
        filtered = filtered.filter((r: ResourceWithCohort) => r.is_global);
      } else if (selectedCohortId) {
        filtered = filtered.filter((r: ResourceWithCohort) => r.cohort_id === selectedCohortId);
      }

      setResources(filtered);
    } catch (error) {
      console.error('Error fetching resources:', error);
      toast.error('Failed to load resources');
    } finally {
      setResourcesLoading(false);
    }
  }, [activeTab, searchQuery, selectedCohortId, isGlobalMode]);

  // Initial fetch
  useEffect(() => {
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;

    const init = async () => {
      await fetchCohorts();
      setLoading(false);
    };
    init();
  }, [fetchCohorts]);

  // Fetch resources when filters change
  useEffect(() => {
    fetchResources();
  }, [fetchResources]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
    setSelectedResourceIds(new Set());
  }, [searchQuery, activeTab, selectedCohortId, isGlobalMode]);

  // ---------------------------------------------------------------------------
  // COHORT CONTEXT HANDLERS
  // ---------------------------------------------------------------------------

  const handleCohortChange = (cohortId: string) => {
    setSelectedCohortId(cohortId);
    if (cohortId) {
      setIsGlobalMode(false);
    }
  };

  const handleGlobalModeToggle = (enabled: boolean) => {
    setIsGlobalMode(enabled);
    if (enabled) {
      setSelectedCohortId('');
    }
  };

  // ---------------------------------------------------------------------------
  // VIDEO FORM HANDLERS
  // ---------------------------------------------------------------------------

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
    // Validate cohort selection
    if (!isGlobalMode && !selectedCohortId) {
      toast.error('Please select a cohort or enable Global Mode');
      return;
    }

    // Get valid rows
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

        if (!response.ok) throw new Error('Upload failed');
        successCount++;
      } catch (error) {
        console.error('Video upload error:', error);
        failCount++;
      }
    }

    setVideoUploading(false);

    if (successCount > 0) {
      toast.success(`Uploaded ${successCount} video${successCount > 1 ? 's' : ''}`);
      setVideoRows([{ id: generateId(), title: '', url: '', thumbnailUrl: '', duration: '' }]);
      fetchResources();
    }
    if (failCount > 0) {
      toast.error(`Failed to upload ${failCount} video${failCount > 1 ? 's' : ''}`);
    }
  };

  // ---------------------------------------------------------------------------
  // ARTICLE FORM HANDLERS
  // ---------------------------------------------------------------------------

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

        if (!response.ok) throw new Error('Upload failed');
        successCount++;
      } catch (error) {
        console.error('Article upload error:', error);
        failCount++;
      }
    }

    setArticleUploading(false);

    if (successCount > 0) {
      toast.success(`Uploaded ${successCount} article${successCount > 1 ? 's' : ''}`);
      setArticleRows([{ id: generateId(), title: '', url: '' }]);
      fetchResources();
    }
    if (failCount > 0) {
      toast.error(`Failed to upload ${failCount} article${failCount > 1 ? 's' : ''}`);
    }
  };

  // ---------------------------------------------------------------------------
  // FILE UPLOAD HANDLERS (Presentations/PDFs)
  // ---------------------------------------------------------------------------

  const handleFilesSelected = (files: FileList | null) => {
    if (!files) return;

    const newItems: FileUploadItem[] = [];

    for (const file of Array.from(files)) {
      // Validate file type
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (!['pdf', 'ppt', 'pptx', 'doc', 'docx'].includes(ext || '')) {
        toast.error(`${file.name}: Invalid file type. Accepted: PDF, PPT, PPTX, DOC, DOCX`);
        continue;
      }

      // Validate file size
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
      // Update status to uploading
      setFileQueue(prev => prev.map(f =>
        f.id === item.id ? { ...f, status: 'uploading' as const } : f
      ));

      try {
        const formData = new FormData();
        formData.append('file', item.file);
        formData.append('name', item.name);
        // Determine category based on file extension
        const ext = item.name.split('.').pop()?.toLowerCase();
        const category = ext === 'pdf' ? 'pdf' : 'presentation';
        formData.append('category', category);
        formData.append('is_global', isGlobalMode.toString());
        if (!isGlobalMode && selectedCohortId) {
          formData.append('cohort_id', selectedCohortId);
        }

        // Use XMLHttpRequest for progress tracking
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
              const error = JSON.parse(xhr.responseText)?.error || 'Upload failed';
              setFileQueue(prev => prev.map(f =>
                f.id === item.id ? { ...f, status: 'error' as const, error } : f
              ));
              reject(new Error(error));
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

    // Count results
    const successCount = fileQueue.filter(f => f.status === 'success').length +
      pendingFiles.filter(f => fileQueue.find(fq => fq.id === f.id)?.status === 'success').length;

    if (successCount > 0) {
      toast.success(`Uploaded ${successCount} file${successCount > 1 ? 's' : ''}`);
      // Clear successful uploads after a delay
      setTimeout(() => {
        setFileQueue(prev => prev.filter(f => f.status !== 'success'));
      }, 2000);
      fetchResources();
    }
  };

  // ---------------------------------------------------------------------------
  // SELECTION HANDLERS
  // ---------------------------------------------------------------------------

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedResourceIds(new Set());
    } else {
      setSelectedResourceIds(new Set(paginatedResources.map(r => r.id)));
    }
  };

  const toggleSelectResource = (id: string) => {
    const newSet = new Set(selectedResourceIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedResourceIds(newSet);
  };

  // ---------------------------------------------------------------------------
  // EDIT RESOURCE HANDLERS
  // ---------------------------------------------------------------------------

  const openEditDialog = (resource: ResourceWithCohort) => {
    setEditingResource(resource);
    setEditFormData({
      name: resource.name,
      external_url: resource.external_url || '',
      thumbnail_url: resource.thumbnail_url || '',
      duration: resource.duration || '',
    });
    setEditDialogOpen(true);
  };

  const handleEditSave = async () => {
    if (!editingResource) return;

    setEditSaving(true);
    try {
      const response = await fetch(`/api/admin/resources/${editingResource.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editFormData.name,
          external_url: editFormData.external_url || null,
          thumbnail_url: editFormData.thumbnail_url || null,
          duration: editFormData.duration || null,
        }),
      });

      if (!response.ok) throw new Error('Failed to update resource');

      toast.success('Resource updated');
      setEditDialogOpen(false);
      setEditingResource(null);
      fetchResources();
    } catch (error) {
      console.error('Error updating resource:', error);
      toast.error('Failed to update resource');
    } finally {
      setEditSaving(false);
    }
  };

  // ---------------------------------------------------------------------------
  // DELETE HANDLERS
  // ---------------------------------------------------------------------------

  const openDeleteDialog = (resource: ResourceWithCohort) => {
    setDeletingResource(resource);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingResource) return;

    try {
      const response = await fetch(`/api/admin/resources/${deletingResource.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete resource');

      toast.success('Resource deleted');
      setDeleteDialogOpen(false);
      setDeletingResource(null);
      fetchResources();
    } catch (error) {
      console.error('Error deleting resource:', error);
      toast.error('Failed to delete resource');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedResourceIds.size === 0) return;

    try {
      const response = await fetch('/api/admin/resources/bulk', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resource_ids: Array.from(selectedResourceIds) }),
      });

      if (!response.ok) throw new Error('Failed to delete resources');

      toast.success(`Deleted ${selectedResourceIds.size} resource${selectedResourceIds.size > 1 ? 's' : ''}`);
      setBulkDeleteDialogOpen(false);
      setSelectedResourceIds(new Set());
      fetchResources();
    } catch (error) {
      console.error('Error bulk deleting resources:', error);
      toast.error('Failed to delete resources');
    }
  };

  // ---------------------------------------------------------------------------
  // BULK ACTION HANDLERS
  // ---------------------------------------------------------------------------

  const handleMoveToGlobal = async () => {
    if (selectedResourceIds.size === 0) return;

    try {
      const response = await fetch('/api/admin/resources/bulk', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resource_ids: Array.from(selectedResourceIds),
          updates: { is_global: true, cohort_id: null },
        }),
      });

      if (!response.ok) throw new Error('Failed to update resources');

      toast.success(`Moved ${selectedResourceIds.size} resource${selectedResourceIds.size > 1 ? 's' : ''} to Global`);
      setSelectedResourceIds(new Set());
      fetchResources();
    } catch (error) {
      console.error('Error moving resources to global:', error);
      toast.error('Failed to move resources to global');
    }
  };

  const handleMoveToCohort = async () => {
    if (selectedResourceIds.size === 0 || !moveToCohortId) return;

    try {
      const response = await fetch('/api/admin/resources/bulk', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resource_ids: Array.from(selectedResourceIds),
          updates: { cohort_id: moveToCohortId, is_global: false },
        }),
      });

      if (!response.ok) throw new Error('Failed to update resources');

      const targetCohort = cohorts.find(c => c.id === moveToCohortId);
      toast.success(`Moved ${selectedResourceIds.size} resource${selectedResourceIds.size > 1 ? 's' : ''} to ${targetCohort?.name || 'cohort'}`);
      setMoveCohortDialogOpen(false);
      setMoveToCohortId('');
      setSelectedResourceIds(new Set());
      fetchResources();
    } catch (error) {
      console.error('Error moving resources to cohort:', error);
      toast.error('Failed to move resources to cohort');
    }
  };

  // ---------------------------------------------------------------------------
  // RENDER - LOADING STATE
  // ---------------------------------------------------------------------------

  if (loading) {
    return <PageLoader message="Loading resources..." />;
  }

  // ---------------------------------------------------------------------------
  // RENDER - MAIN UI
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-8">
      {/* ===================================================================
          HEADER WITH GRADIENT
          =================================================================== */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary/10 via-primary/5 to-accent/10 p-6 border border-primary/20">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent opacity-50" />
        <div className="relative">
          <h1 className="text-3xl font-bold tracking-tight">Resource Management</h1>
          <p className="text-muted-foreground mt-2">
            Upload and manage learning resources for cohorts
          </p>
        </div>
      </div>

      {/* ===================================================================
          COHORT CONTEXT SELECTOR
          =================================================================== */}
      <Card className="border-2 border-primary/20 bg-card/50 backdrop-blur">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            {isGlobalMode ? (
              <>
                <Globe className="w-5 h-5 text-primary" />
                Global Mode Active
              </>
            ) : selectedCohort ? (
              <>
                <Users className="w-5 h-5 text-primary" />
                Currently uploading for: {selectedCohort.name}
              </>
            ) : (
              <>
                <FolderOpen className="w-5 h-5 text-muted-foreground" />
                Select a cohort to start
              </>
            )}
          </CardTitle>
          <CardDescription>
            {isGlobalMode
              ? 'Resources will be available to all students across all cohorts'
              : selectedCohort
                ? `All uploads will be tagged to ${selectedCohort.tag}`
                : 'Choose a target cohort or enable Global Mode'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-4">
            {/* Cohort Selector */}
            <div className="flex-1 min-w-[200px]">
              <Select
                value={selectedCohortId}
                onValueChange={handleCohortChange}
                disabled={isGlobalMode}
              >
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Select cohort..." />
                </SelectTrigger>
                <SelectContent>
                  {cohorts.map((cohort) => (
                    <SelectItem key={cohort.id} value={cohort.id}>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {cohort.tag}
                        </Badge>
                        {cohort.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Global Mode Toggle */}
            <div className="flex items-center gap-3 px-4 py-2 rounded-lg bg-muted/50 border">
              <Globe className={`w-4 h-4 ${isGlobalMode ? 'text-primary' : 'text-muted-foreground'}`} />
              <Label htmlFor="global-mode" className="cursor-pointer">
                Global Mode
              </Label>
              <Switch
                id="global-mode"
                checked={isGlobalMode}
                onCheckedChange={handleGlobalModeToggle}
              />
            </div>
          </div>

          {/* Visual Indicator */}
          {(isGlobalMode || selectedCohortId) && (
            <div className={`mt-4 px-4 py-3 rounded-lg flex items-center gap-3 ${
              isGlobalMode
                ? 'bg-primary/10 border border-primary/30'
                : 'bg-accent/10 border border-accent/30'
            }`}>
              <div className={`w-2 h-2 rounded-full animate-pulse ${
                isGlobalMode ? 'bg-primary' : 'bg-accent'
              }`} />
              <span className="text-sm font-medium">
                {isGlobalMode
                  ? 'Uploads will be visible to ALL students'
                  : `Uploads will only be visible to ${selectedCohort?.name} students`}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ===================================================================
          CATEGORY TABS
          =================================================================== */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ResourceCategory)}>
        <TabsList className="w-full justify-start h-12 p-1 bg-muted/50 border">
          <TabsTrigger value="video" className="flex items-center gap-2 px-6">
            <Video className="w-4 h-4" />
            Videos
          </TabsTrigger>
          <TabsTrigger value="article" className="flex items-center gap-2 px-6">
            <LinkIcon className="w-4 h-4" />
            Articles
          </TabsTrigger>
          <TabsTrigger value="presentation" className="flex items-center gap-2 px-6">
            <Presentation className="w-4 h-4" />
            Presentations
          </TabsTrigger>
          <TabsTrigger value="pdf" className="flex items-center gap-2 px-6">
            <FileText className="w-4 h-4" />
            PDFs
          </TabsTrigger>
        </TabsList>

        {/* =================================================================
            VIDEOS TAB
            ================================================================= */}
        <TabsContent value="video" className="mt-6">
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
        </TabsContent>

        {/* =================================================================
            ARTICLES TAB
            ================================================================= */}
        <TabsContent value="article" className="mt-6">
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
        </TabsContent>

        {/* =================================================================
            PRESENTATIONS TAB
            ================================================================= */}
        <TabsContent value="presentation" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Presentation className="w-5 h-5 text-orange-500" />
                Upload Presentations
              </CardTitle>
              <CardDescription>
                Drag and drop or click to select PowerPoint files (.ppt, .pptx)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Drop Zone */}
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
                    fileInputRef.current.accept = '.ppt,.pptx';
                    fileInputRef.current.click();
                  }
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept={ACCEPTED_FILE_TYPES}
                  onChange={(e) => handleFilesSelected(e.target.files)}
                  className="hidden"
                />
                <div className={`w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center transition-colors ${
                  dragOver ? 'bg-primary/20' : 'bg-muted'
                }`}>
                  <Upload className={`w-8 h-8 ${dragOver ? 'text-primary' : 'text-muted-foreground'}`} />
                </div>
                <p className="font-medium">Drop files here or click to browse</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Max 100MB per file. Accepted: .ppt, .pptx
                </p>
              </div>

              {/* File Queue */}
              {fileQueue.filter(f => f.name.match(/\.(ppt|pptx)$/i)).length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Upload Queue</Label>
                  {fileQueue.filter(f => f.name.match(/\.(ppt|pptx)$/i)).map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 p-3 rounded-lg border bg-card"
                    >
                      <Presentation className="w-5 h-5 text-orange-500 shrink-0" />
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

              {/* Upload Button */}
              {fileQueue.filter(f => f.name.match(/\.(ppt|pptx)$/i) && f.status === 'pending').length > 0 && (
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
                      Upload {fileQueue.filter(f => f.name.match(/\.(ppt|pptx)$/i) && f.status === 'pending').length} Presentation{fileQueue.filter(f => f.name.match(/\.(ppt|pptx)$/i) && f.status === 'pending').length !== 1 ? 's' : ''}
                    </>
                  )}
                </Button>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* =================================================================
            PDFs TAB
            ================================================================= */}
        <TabsContent value="pdf" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-red-500" />
                Upload PDFs & Documents
              </CardTitle>
              <CardDescription>
                Drag and drop or click to select PDF and document files (.pdf, .doc, .docx)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Drop Zone */}
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
                    fileInputRef.current.accept = '.pdf,.doc,.docx';
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
                  Max 100MB per file. Accepted: .pdf, .doc, .docx
                </p>
              </div>

              {/* File Queue */}
              {fileQueue.filter(f => f.name.match(/\.(pdf|doc|docx)$/i)).length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Upload Queue</Label>
                  {fileQueue.filter(f => f.name.match(/\.(pdf|doc|docx)$/i)).map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 p-3 rounded-lg border bg-card"
                    >
                      <FileText className="w-5 h-5 text-red-500 shrink-0" />
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

              {/* Upload Button */}
              {fileQueue.filter(f => f.name.match(/\.(pdf|doc|docx)$/i) && f.status === 'pending').length > 0 && (
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
                      Upload {fileQueue.filter(f => f.name.match(/\.(pdf|doc|docx)$/i) && f.status === 'pending').length} File{fileQueue.filter(f => f.name.match(/\.(pdf|doc|docx)$/i) && f.status === 'pending').length !== 1 ? 's' : ''}
                    </>
                  )}
                </Button>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ===================================================================
          BULK ACTIONS BAR (appears when items selected)
          =================================================================== */}
      {selectedResourceIds.size > 0 && (
        <div className="sticky bottom-4 z-10 mx-auto max-w-3xl">
          <div className="flex items-center justify-between gap-4 px-4 py-3 rounded-xl bg-card border-2 border-primary/30 shadow-lg backdrop-blur">
            <span className="text-sm font-medium">
              {selectedResourceIds.size} item{selectedResourceIds.size > 1 ? 's' : ''} selected
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleMoveToGlobal}
                className="gap-2"
              >
                <Globe className="w-4 h-4" />
                Move to Global
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMoveCohortDialogOpen(true)}
                className="gap-2"
              >
                <Users className="w-4 h-4" />
                Move to Cohort
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportToCSV(resources.filter(r => selectedResourceIds.has(r.id)))}
                className="gap-2"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setBulkDeleteDialogOpen(true)}
                className="gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedResourceIds(new Set())}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================
          RESOURCES TABLE
          =================================================================== */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FolderOpen className="w-5 h-5 text-primary" />
                Resources
              </CardTitle>
              <CardDescription>
                {filteredResources.length} resource{filteredResources.length !== 1 ? 's' : ''}
                {isGlobalMode ? ' (Global)' : selectedCohort ? ` in ${selectedCohort.name}` : ''}
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search resources..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-64"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportToCSV(filteredResources)}
                className="gap-2"
              >
                <Download className="w-4 h-4" />
                Export All
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {resourcesLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : filteredResources.length === 0 ? (
            <div className="text-center py-16 px-4">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <FolderOpen className="w-8 h-8 text-muted-foreground" />
              </div>
              <p className="font-medium text-lg">No resources found</p>
              <p className="text-sm text-muted-foreground mt-1">
                {searchQuery
                  ? 'Try a different search term'
                  : 'Upload some resources to get started'}
              </p>
            </div>
          ) : (
            <>
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-12">
                        <Checkbox
                          checked={allSelected}
                          onCheckedChange={toggleSelectAll}
                        />
                      </TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead>Uploaded</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedResources.map((resource) => (
                      <TableRow
                        key={resource.id}
                        className={`transition-colors ${
                          selectedResourceIds.has(resource.id) ? 'bg-primary/5' : 'hover:bg-muted/50'
                        }`}
                      >
                        <TableCell>
                          <Checkbox
                            checked={selectedResourceIds.has(resource.id)}
                            onCheckedChange={() => toggleSelectResource(resource.id)}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            {getCategoryIcon(resource.category)}
                            <div>
                              <p className="font-medium truncate max-w-xs">{resource.name}</p>
                              {resource.is_global ? (
                                <Badge variant="outline" className="text-xs mt-1">
                                  <Globe className="w-3 h-3 mr-1" />
                                  Global
                                </Badge>
                              ) : resource.cohort && (
                                <Badge variant="secondary" className="text-xs mt-1">
                                  {resource.cohort.tag}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {resource.category || '-'}
                          </Badge>
                        </TableCell>
                        <TableCell className="capitalize">
                          {resource.type === 'link' ? 'External Link' : 'File'}
                        </TableCell>
                        <TableCell>{formatFileSize(resource.file_size)}</TableCell>
                        <TableCell>
                          {format(new Date(resource.created_at), 'MMM d, yyyy')}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {resource.external_url && (
                                <DropdownMenuItem asChild>
                                  <a
                                    href={resource.external_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2"
                                  >
                                    <ExternalLink className="w-4 h-4" />
                                    Open Link
                                  </a>
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => openEditDialog(resource)}>
                                <Pencil className="w-4 h-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => openDeleteDialog(resource)}
                                className="text-destructive focus:text-destructive"
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

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to{' '}
                    {Math.min(currentPage * ITEMS_PER_PAGE, filteredResources.length)} of{' '}
                    {filteredResources.length} resources
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="text-sm px-2">
                      Page {currentPage} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* ===================================================================
          EDIT DIALOG
          =================================================================== */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Resource</DialogTitle>
            <DialogDescription>
              Update the details for this resource
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={editFormData.name}
                onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
              />
            </div>
            {editingResource?.type === 'link' && (
              <div className="space-y-2">
                <Label htmlFor="edit-url">URL</Label>
                <Input
                  id="edit-url"
                  value={editFormData.external_url}
                  onChange={(e) => setEditFormData({ ...editFormData, external_url: e.target.value })}
                />
              </div>
            )}
            {editingResource?.category === 'video' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="edit-thumbnail">Thumbnail URL</Label>
                  <Input
                    id="edit-thumbnail"
                    value={editFormData.thumbnail_url}
                    onChange={(e) => setEditFormData({ ...editFormData, thumbnail_url: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-duration">Duration</Label>
                  <Input
                    id="edit-duration"
                    placeholder="10:24"
                    value={editFormData.duration}
                    onChange={(e) => setEditFormData({ ...editFormData, duration: e.target.value })}
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditSave} disabled={editSaving} className="gradient-bg">
              {editSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===================================================================
          DELETE CONFIRMATION DIALOG
          =================================================================== */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Resource</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deletingResource?.name}&quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ===================================================================
          BULK DELETE CONFIRMATION DIALOG
          =================================================================== */}
      <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedResourceIds.size} Resources</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete these {selectedResourceIds.size} resources? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ===================================================================
          MOVE TO COHORT DIALOG
          =================================================================== */}
      <Dialog open={moveCohortDialogOpen} onOpenChange={setMoveCohortDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move to Cohort</DialogTitle>
            <DialogDescription>
              Select a cohort to move {selectedResourceIds.size} resource{selectedResourceIds.size > 1 ? 's' : ''} to.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Select value={moveToCohortId} onValueChange={setMoveToCohortId}>
              <SelectTrigger>
                <SelectValue placeholder="Select cohort..." />
              </SelectTrigger>
              <SelectContent>
                {cohorts.map((cohort) => (
                  <SelectItem key={cohort.id} value={cohort.id}>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {cohort.tag}
                      </Badge>
                      {cohort.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveCohortDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleMoveToCohort} disabled={!moveToCohortId} className="gradient-bg">
              Move Resources
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
