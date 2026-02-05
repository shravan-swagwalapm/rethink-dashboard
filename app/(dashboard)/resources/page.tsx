'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useUser } from '@/hooks/use-user';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StudentPageLoader } from '@/components/ui/page-loader';
import { toast } from 'sonner';
import {
  Search,
  Video,
  FileText,
  Presentation as PresentationIcon,
  FileType,
  Play,
  ExternalLink,
  Download,
  Eye,
  Star,
  BookOpen,
  ChevronRight,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import type { Resource, ResourceCategory } from '@/types';
import { VideoThumbnail } from '@/components/resources/video-thumbnail';

// Use universal iframe-based viewer for all document types (more reliable)
const UniversalViewer = dynamic(() => import('@/components/resources/universal-viewer').then(mod => ({ default: mod.UniversalViewer })), { ssr: false });

type Tab = ResourceCategory;

const TABS: { value: Tab; label: string; icon: any }[] = [
  { value: 'video', label: 'Videos', icon: Video },
  { value: 'article', label: 'Articles', icon: BookOpen },
  { value: 'presentation', label: 'Presentations', icon: PresentationIcon },
  { value: 'pdf', label: 'PDFs', icon: FileType },
];

// Type-specific styling helper
const getResourceStyles = (category: ResourceCategory) => {
  switch (category) {
    case 'video':
      return {
        gradient: 'from-purple-500 to-purple-600',
        border: 'border-purple-500/20 hover:border-purple-500/40',
        shadow: 'shadow-lg shadow-purple-500/25',
        glow: 'hover:shadow-purple-500/10',
        badge: 'bg-purple-500/10 border-purple-500/20 text-purple-400',
        iconBg: 'bg-gradient-to-br from-purple-500 to-purple-600'
      };
    case 'presentation':
      return {
        gradient: 'from-orange-500 to-orange-600',
        border: 'border-orange-500/20 hover:border-orange-500/40',
        shadow: 'shadow-lg shadow-orange-500/25',
        glow: 'hover:shadow-orange-500/10',
        badge: 'bg-orange-500/10 border-orange-500/20 text-orange-400',
        iconBg: 'bg-gradient-to-br from-orange-500 to-orange-600'
      };
    case 'pdf':
      return {
        gradient: 'from-blue-500 to-blue-600',
        border: 'border-blue-500/20 hover:border-blue-500/40',
        shadow: 'shadow-lg shadow-blue-500/25',
        glow: 'hover:shadow-blue-500/10',
        badge: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
        iconBg: 'bg-gradient-to-br from-blue-500 to-blue-600'
      };
    case 'article':
      return {
        gradient: 'from-emerald-500 to-emerald-600',
        border: 'border-emerald-500/20 hover:border-emerald-500/40',
        shadow: 'shadow-lg shadow-emerald-500/25',
        glow: 'hover:shadow-emerald-500/10',
        badge: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
        iconBg: 'bg-gradient-to-br from-emerald-500 to-emerald-600'
      };
  }
};

export default function ResourcesPage() {
  const { profile, loading: userLoading, activeCohortId } = useUser();
  const [activeTab, setActiveTab] = useState<Tab>('video');
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewerState, setViewerState] = useState<{
    isOpen: boolean;
    fileUrl: string;
    fileName: string;
    fileType: string;
  }>({ isOpen: false, fileUrl: '', fileName: '', fileType: '' });
  const [favoriteResources, setFavoriteResources] = useState<Set<string>>(new Set());
  const [completedResources, setCompletedResources] = useState<Set<string>>(new Set());

  // Toggle favorite status
  const handleToggleFavorite = (resourceId: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    setFavoriteResources(prev => {
      const next = new Set(prev);
      if (next.has(resourceId)) {
        next.delete(resourceId);
        toast.success('Removed from favorites');
      } else {
        next.add(resourceId);
        toast.success('Added to favorites');
      }
      return next;
    });
  };

  // Toggle completion status
  const handleMarkComplete = (resourceId: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    setCompletedResources(prev => {
      const next = new Set(prev);
      if (next.has(resourceId)) {
        next.delete(resourceId);
        toast.success('Marked as incomplete');
      } else {
        next.add(resourceId);
        toast.success('Marked as complete');
      }
      return next;
    });
  };

  useEffect(() => {
    const fetchResources = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          category: activeTab,
        });

        // Pass active cohort ID to ensure proper filtering
        if (activeCohortId) {
          params.append('cohort_id', activeCohortId);
        }

        if (searchQuery) {
          params.append('search', searchQuery);
        }

        const response = await fetch(`/api/resources?${params}`);
        if (!response.ok) throw new Error('Failed to fetch resources');

        const data = await response.json();
        setResources(data.resources || []);
      } catch (error) {
        console.error('Error fetching resources:', error);
        toast.error('Failed to load resources');
      } finally {
        setLoading(false);
      }
    };

    if (!userLoading && activeCohortId) {
      fetchResources();
    }
  }, [activeTab, searchQuery, userLoading, activeCohortId]);

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '--';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleOpenViewer = async (resource: Resource) => {
    if (!resource.file_path) {
      toast.error('File not available');
      return;
    }

    try {
      // Get signed URL from API
      const response = await fetch(`/api/resources/${resource.id}/signed-url`);
      if (!response.ok) throw new Error('Failed to get file URL');

      const { signedUrl } = await response.json();

      const fileType = resource.file_type?.toLowerCase() || '';

      // For documents (PDF, Office files, CSV): Open directly in new tab
      // These work better in browser's native viewer
      if (['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'csv'].includes(fileType)) {
        window.open(signedUrl, '_blank');
      } else {
        // For other types (videos, etc.): Use modal viewer
        setViewerState({
          isOpen: true,
          fileUrl: signedUrl,
          fileName: resource.name,
          fileType: fileType
        });
      }
    } catch (error) {
      console.error('Error opening viewer:', error);
      toast.error('Failed to open file');
    }
  };

  const handleDownload = async (resource: Resource) => {
    if (!resource.file_path) {
      toast.error('File not available');
      return;
    }

    try {
      const response = await fetch(`/api/resources/${resource.id}/signed-url`);
      if (!response.ok) throw new Error('Failed to download file');

      const { signedUrl } = await response.json();
      window.open(signedUrl, '_blank');
    } catch (error) {
      console.error('Error downloading:', error);
      toast.error('Failed to download file');
    }
  };

  const closeViewer = () => {
    setViewerState({ isOpen: false, fileUrl: '', fileName: '', fileType: '' });
  };

  // Show full-page loader until auth is ready
  if (userLoading) {
    return <StudentPageLoader message="Loading resources..." />;
  }

  return (
    <div className="space-y-6">
      {/* Header with futuristic gradient */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary/80 to-accent p-8 shadow-lg">
        {/* Aurora glow effect */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,oklch(0.65_0.2_195_/_0.2),transparent)] pointer-events-none" />

        <div className="relative z-10">
          <h1 className="text-3xl font-bold text-white mb-2">Learning Resources</h1>
          <p className="text-white/80">
            Access course materials, videos, and documents
          </p>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-4 overflow-x-auto pb-2">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.value;
          const count = resources.length;

          return (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={cn(
                'flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all whitespace-nowrap',
                isActive
                  ? 'bg-primary text-white shadow-[0_0_20px_oklch(0.55_0.25_280_/_0.4)]'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
              )}
            >
              <Icon className="w-5 h-5" />
              {tab.label}
              {isActive && count > 0 && (
                <Badge
                  variant="secondary"
                  className={cn(
                    "ml-2 border",
                    getResourceStyles(tab.value).badge
                  )}
                >
                  {count} {count === 1 ? 'item' : 'items'}
                </Badge>
              )}
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder={`Search ${activeTab}s...`}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Content Area - Unified List View */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : resources.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <FileText className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium mb-2">No {activeTab}s yet</h3>
            <p className="text-muted-foreground text-center max-w-sm">
              {searchQuery
                ? `No results found for "${searchQuery}"`
                : `${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}s will appear here once uploaded.`}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {resources.map((resource) => {
            const styles = getResourceStyles(activeTab);
            const isFavorite = favoriteResources.has(resource.id);
            const isComplete = completedResources.has(resource.id);
            const Icon = TABS.find(t => t.value === activeTab)?.icon || FileText;

            return (
              <div
                key={resource.id}
                className={cn(
                  "relative w-full flex items-center gap-3 md:gap-4 p-3 md:p-4 rounded-xl transition-all duration-300 group cursor-pointer",
                  "border-2 bg-white dark:bg-gray-900/80 backdrop-blur-sm",
                  isComplete
                    ? "border-green-500/30 bg-green-50/50 dark:bg-green-900/10"
                    : styles.border,
                  "hover:shadow-lg hover:-translate-y-0.5",
                  styles.glow
                )}
                onClick={() => {
                  if (resource.external_url) {
                    window.open(resource.external_url, '_blank');
                  } else if (resource.file_path) {
                    handleOpenViewer(resource);
                  }
                }}
              >
                {/* Icon container with gradient */}
                <div className={cn(
                  "w-9 h-9 md:w-11 md:h-11 rounded-xl flex items-center justify-center flex-shrink-0",
                  "group-hover:scale-110 transition-transform duration-300",
                  styles.iconBg,
                  styles.shadow
                )}>
                  <Icon className="w-4 h-4 md:w-5 md:h-5 text-white" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold text-gray-900 dark:text-white truncate group-hover:text-purple-500 dark:group-hover:text-purple-400 transition-colors text-sm md:text-base">
                      {resource.name}
                    </p>
                    {isFavorite && (
                      <Star className="w-4 h-4 fill-yellow-400 text-yellow-400 flex-shrink-0 drop-shadow-sm" />
                    )}
                    {isComplete && (
                      <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/10 border border-green-500/20 flex-shrink-0">
                        <CheckCircle2 className="w-3 h-3 text-green-500" />
                        <span className="text-xs font-medium text-green-500 hidden sm:inline">Done</span>
                      </div>
                    )}
                  </div>

                  {/* Metadata row */}
                  <div className="flex flex-wrap items-center gap-2 md:gap-3 text-xs md:text-sm text-gray-500 dark:text-gray-400">
                    {resource.file_type && (
                      <span className="uppercase">{resource.file_type}</span>
                    )}
                    {resource.file_size && (
                      <>
                        <span className="hidden sm:inline">•</span>
                        <span className="hidden sm:inline">{formatFileSize(resource.file_size)}</span>
                      </>
                    )}
                    {resource.created_at && (
                      <>
                        <span className="hidden md:inline">•</span>
                        <span className="hidden md:inline">{format(new Date(resource.created_at), 'MMM d, yyyy')}</span>
                      </>
                    )}
                    {resource.duration && (
                      <>
                        <span className="hidden sm:inline">•</span>
                        <span className="hidden sm:inline flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {resource.duration}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Action buttons - visible on hover (always visible on mobile) */}
                <div className="flex items-center gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => handleToggleFavorite(resource.id, e)}
                    className={cn(
                      "w-8 h-8 md:w-9 md:h-9 rounded-lg flex items-center justify-center transition-all border",
                      isFavorite
                        ? "bg-yellow-500/10 border-yellow-500/30 text-yellow-500"
                        : "hover:bg-gray-100 dark:hover:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-400 hover:text-gray-600"
                    )}
                    title={isFavorite ? "Remove from favorites" : "Add to favorites"}
                  >
                    <Star className={cn("w-3.5 h-3.5 md:w-4 md:h-4", isFavorite && "fill-current")} />
                  </button>
                  <button
                    onClick={(e) => handleMarkComplete(resource.id, e)}
                    className={cn(
                      "w-8 h-8 md:w-9 md:h-9 rounded-lg flex items-center justify-center transition-all border",
                      isComplete
                        ? "bg-green-500/10 border-green-500/30 text-green-500"
                        : "hover:bg-gray-100 dark:hover:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-400 hover:text-gray-600"
                    )}
                    title={isComplete ? "Mark as incomplete" : "Mark as complete"}
                  >
                    <CheckCircle2 className={cn("w-3.5 h-3.5 md:w-4 md:h-4", isComplete && "fill-current")} />
                  </button>
                </div>

                {/* Chevron - slides right on hover */}
                <ChevronRight className="w-4 h-4 md:w-5 md:h-5 text-gray-400 group-hover:text-purple-500 group-hover:translate-x-1 transition-all flex-shrink-0 hidden sm:block" />
              </div>
            );
          })}
        </div>
      )}

      {/* Universal Document Viewer */}
      <UniversalViewer
        fileUrl={viewerState.fileUrl}
        fileName={viewerState.fileName}
        fileType={viewerState.fileType}
        isOpen={viewerState.isOpen}
        onClose={closeViewer}
      />
    </div>
  );
}
