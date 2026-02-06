'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { PageLoader } from '@/components/ui/page-loader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Video, Link as LinkIcon, Presentation, FileText } from 'lucide-react';
import type { Cohort, ResourceCategory } from '@/types';
import { ResourceWithCohort } from './types';
import { CohortSelector } from './components/cohort-selector';
import { VideoTab } from './components/video-tab';
import { ArticleTab } from './components/article-tab';
import { FileUploadTab } from './components/file-upload-tab';
import { ResourceTable } from './components/resource-table';
import { BulkActionsBar } from './components/bulk-actions-bar';
import { EditResourceDialog } from './components/edit-resource-dialog';
import { DeleteResourceDialog, BulkDeleteDialog } from './components/delete-resource-dialog';
import { MoveCohortDialog } from './components/move-cohort-dialog';

export default function AdminResourcesPage() {
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [resources, setResources] = useState<ResourceWithCohort[]>([]);
  const [loading, setLoading] = useState(true);
  const [resourcesLoading, setResourcesLoading] = useState(false);

  const [selectedCohortId, setSelectedCohortId] = useState<string>('');
  const [isGlobalMode, setIsGlobalMode] = useState(false);
  const [activeTab, setActiveTab] = useState<ResourceCategory>('video');

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedResourceIds, setSelectedResourceIds] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingResource, setEditingResource] = useState<ResourceWithCohort | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingResource, setDeletingResource] = useState<ResourceWithCohort | null>(null);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [moveCohortDialogOpen, setMoveCohortDialogOpen] = useState(false);

  const hasFetchedRef = useRef(false);

  const selectedCohort = cohorts.find(c => c.id === selectedCohortId);

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

  const fetchResources = useCallback(async () => {
    setResourcesLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeTab) params.append('category', activeTab);
      if (searchQuery) params.append('search', searchQuery);

      const response = await fetch(`/api/admin/resources?${params}`);
      if (!response.ok) throw new Error('Failed to fetch resources');
      const data = await response.json();

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

  useEffect(() => {
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;

    const init = async () => {
      await fetchCohorts();
      setLoading(false);
    };
    init();
  }, [fetchCohorts]);

  useEffect(() => {
    fetchResources();
  }, [fetchResources]);

  useEffect(() => {
    setCurrentPage(1);
    setSelectedResourceIds(new Set());
  }, [searchQuery, activeTab, selectedCohortId, isGlobalMode]);

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

  const toggleSelectAll = () => {
    const filteredResources = resources.filter(r =>
      r.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
    const paginatedResources = filteredResources.slice(
      (currentPage - 1) * 20,
      currentPage * 20
    );
    const allSelected = paginatedResources.length > 0 &&
      paginatedResources.every(r => selectedResourceIds.has(r.id));

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

  const handleBulkDeleted = () => {
    setSelectedResourceIds(new Set());
    fetchResources();
  };

  const handleMoved = () => {
    setSelectedResourceIds(new Set());
    fetchResources();
  };

  if (loading) {
    return <PageLoader message="Loading resources..." />;
  }

  return (
    <div className="space-y-8">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary/10 via-primary/5 to-accent/10 p-6 border border-primary/20">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent opacity-50" />
        <div className="relative">
          <h1 className="text-3xl font-bold tracking-tight">Resource Management</h1>
          <p className="text-muted-foreground mt-2">
            Upload and manage learning resources for cohorts
          </p>
        </div>
      </div>

      <CohortSelector
        cohorts={cohorts}
        selectedCohortId={selectedCohortId}
        isGlobalMode={isGlobalMode}
        selectedCohort={selectedCohort}
        onCohortChange={handleCohortChange}
        onGlobalModeToggle={handleGlobalModeToggle}
      />

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

        <TabsContent value="video" className="mt-6">
          <VideoTab
            isGlobalMode={isGlobalMode}
            selectedCohortId={selectedCohortId}
            onUploadComplete={fetchResources}
          />
        </TabsContent>

        <TabsContent value="article" className="mt-6">
          <ArticleTab
            isGlobalMode={isGlobalMode}
            selectedCohortId={selectedCohortId}
            onUploadComplete={fetchResources}
          />
        </TabsContent>

        <TabsContent value="presentation" className="mt-6">
          <FileUploadTab
            mode="presentation"
            isGlobalMode={isGlobalMode}
            selectedCohortId={selectedCohortId}
            onUploadComplete={fetchResources}
          />
        </TabsContent>

        <TabsContent value="pdf" className="mt-6">
          <FileUploadTab
            mode="pdf"
            isGlobalMode={isGlobalMode}
            selectedCohortId={selectedCohortId}
            onUploadComplete={fetchResources}
          />
        </TabsContent>
      </Tabs>

      <BulkActionsBar
        selectedResourceIds={selectedResourceIds}
        resources={resources}
        onMoveToGlobal={handleMoveToGlobal}
        onMoveToCohort={() => setMoveCohortDialogOpen(true)}
        onBulkDelete={() => setBulkDeleteDialogOpen(true)}
        onClearSelection={() => setSelectedResourceIds(new Set())}
      />

      <ResourceTable
        resources={resources}
        resourcesLoading={resourcesLoading}
        isGlobalMode={isGlobalMode}
        selectedCohort={selectedCohort}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        currentPage={currentPage}
        onPageChange={setCurrentPage}
        selectedResourceIds={selectedResourceIds}
        onToggleSelectAll={toggleSelectAll}
        onToggleSelectResource={toggleSelectResource}
        onEdit={(resource) => {
          setEditingResource(resource);
          setEditDialogOpen(true);
        }}
        onDelete={(resource) => {
          setDeletingResource(resource);
          setDeleteDialogOpen(true);
        }}
      />

      <EditResourceDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        resource={editingResource}
        onSaved={fetchResources}
      />

      <DeleteResourceDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        resource={deletingResource}
        onDeleted={fetchResources}
      />

      <BulkDeleteDialog
        open={bulkDeleteDialogOpen}
        onOpenChange={setBulkDeleteDialogOpen}
        selectedResourceIds={selectedResourceIds}
        onDeleted={handleBulkDeleted}
      />

      <MoveCohortDialog
        open={moveCohortDialogOpen}
        onOpenChange={setMoveCohortDialogOpen}
        cohorts={cohorts}
        selectedResourceIds={selectedResourceIds}
        onMoved={handleMoved}
      />
    </div>
  );
}
