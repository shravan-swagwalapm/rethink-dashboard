'use client';

import { useEffect, useState, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useUserContext } from '@/contexts/user-context';
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
  BookOpen,
  ChevronRight,
  Clock,
  Heart,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { cn } from '@/lib/utils';
import { MotionContainer, MotionItem, MotionFadeIn } from '@/components/ui/motion';
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
        gradient: 'from-teal-500 to-teal-600',
        border: 'border-teal-500/20 hover:border-teal-500/40',
        shadow: 'shadow-lg shadow-teal-500/25',
        glow: 'hover:shadow-teal-500/10',
        badge: 'bg-teal-500/10 border-teal-500/20 text-teal-400',
        iconBg: 'bg-gradient-to-br from-teal-500 to-teal-600'
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
  const { profile, loading: userLoading, activeCohortId } = useUserContext();
  const [activeTab, setActiveTab] = useState<Tab>('video');
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [viewerState, setViewerState] = useState<{
    isOpen: boolean;
    fileUrl: string;
    fileName: string;
    fileType: string;
  }>({ isOpen: false, fileUrl: '', fileName: '', fileType: '' });
  const [fetchError, setFetchError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [favoritesLoaded, setFavoritesLoaded] = useState(false);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Debounce search input (300ms)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch favorites once when user is loaded
  useEffect(() => {
    if (userLoading) return;
    const fetchFavorites = async () => {
      try {
        const res = await fetch('/api/learnings/favorites');
        if (!res.ok) return;
        const data = await res.json();
        const ids = new Set<string>((data.favorites || []).map((f: { resource_id: string }) => f.resource_id));
        setFavoriteIds(ids);
      } catch {
        // Non-blocking: hearts just stay unfilled
      } finally {
        setFavoritesLoaded(true);
      }
    };
    fetchFavorites();
  }, [userLoading]);

  // Optimistic toggle handler
  const handleToggleFavorite = async (e: React.MouseEvent, resourceId: string) => {
    e.stopPropagation();
    const wasFavorited = favoriteIds.has(resourceId);

    // Optimistic update
    setFavoriteIds(prev => {
      const next = new Set(prev);
      if (wasFavorited) {
        next.delete(resourceId);
      } else {
        next.add(resourceId);
      }
      return next;
    });

    try {
      if (wasFavorited) {
        const res = await fetch(`/api/learnings/favorites?resource_id=${resourceId}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed to remove favorite');
      } else {
        const res = await fetch('/api/learnings/favorites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ resource_id: resourceId }),
        });
        if (!res.ok) throw new Error('Failed to add favorite');
      }
    } catch {
      // Revert on error
      setFavoriteIds(prev => {
        const next = new Set(prev);
        if (wasFavorited) {
          next.add(resourceId);
        } else {
          next.delete(resourceId);
        }
        return next;
      });
      toast.error(wasFavorited ? 'Failed to remove favorite' : 'Failed to add favorite');
    }
  };

  // Clear search when switching tabs
  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    setSearchQuery('');
    setDebouncedSearch('');
    setResources([]);
  };

  useEffect(() => {
    // Abort any in-flight request
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const fetchResources = async () => {
      setLoading(true);
      setFetchError(false);
      try {
        const params = new URLSearchParams({
          category: activeTab,
        });

        // Pass active cohort ID to ensure proper filtering
        if (activeCohortId) {
          params.append('cohort_id', activeCohortId);
        }

        if (debouncedSearch) {
          params.append('search', debouncedSearch);
        }

        const response = await fetch(`/api/resources?${params}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error('Failed to fetch resources');

        const data = await response.json();
        if (!controller.signal.aborted) {
          setResources(data.resources || []);
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setFetchError(true);
        toast.error('Failed to load resources');
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    if (!userLoading && activeCohortId) {
      fetchResources();
    }

    return () => controller.abort();
  }, [activeTab, debouncedSearch, userLoading, activeCohortId, retryKey]);

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

      // Fetch the file as a blob and trigger a real download
      const fileResponse = await fetch(signedUrl);
      const blob = await fileResponse.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = resource.name || 'download';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
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
      {/* Header */}
      <PageHeader
        icon={FileText}
        title="Resources"
        description="Browse learning materials and resources"
      />

      {/* Tabs Navigation */}
      <div className="flex items-center gap-4 overflow-x-auto pb-2">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.value;
          const count = resources.length;

          return (
            <button
              key={tab.value}
              onClick={() => handleTabChange(tab.value)}
              className={cn(
                'flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all whitespace-nowrap border',
                isActive
                  ? 'bg-gradient-to-r from-teal-600 to-teal-600 text-white shadow-[0_0_20px_rgba(168,85,247,0.5)] border-teal-500/50'
                  : 'bg-gray-950 text-gray-300 border-gray-800 hover:bg-gray-900 hover:text-white hover:border-gray-700'
              )}
            >
              <Icon className="w-5 h-5" />
              {tab.label}
              {isActive && count > 0 && (
                <Badge
                  variant="secondary"
                  className="ml-2 border bg-teal-900/60 border-teal-800/50 text-white"
                >
                  {count} {count === 1 ? 'item' : 'items'}
                </Badge>
              )}
            </button>
          );
        })}
      </div>

      {/* Search + Favorites Filter */}
      <div className="flex items-center gap-3">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={`Search ${activeTab}s...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <button
          onClick={() => setShowFavoritesOnly(prev => !prev)}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-all border whitespace-nowrap",
            showFavoritesOnly
              ? "bg-rose-500 text-white border-rose-500/50 shadow-lg shadow-rose-500/25"
              : "bg-gray-950 text-gray-300 border-gray-800 hover:bg-gray-900 hover:text-white hover:border-gray-700"
          )}
        >
          <Heart className={cn("w-4 h-4", showFavoritesOnly && "fill-current")} />
          <span className="hidden sm:inline">Favorites</span>
        </button>
      </div>

      {/* Content Area - Unified List View */}
      {(() => {
        const displayedResources = showFavoritesOnly
          ? resources.filter(r => favoriteIds.has(r.id))
          : resources;

        return loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : fetchError && resources.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <AlertTriangle className="w-16 h-16 text-destructive opacity-50 mb-4" />
            <h3 className="text-lg font-medium mb-2">Failed to load resources</h3>
            <p className="text-muted-foreground text-center max-w-sm mb-4">Check your connection and try again</p>
            <Button variant="outline" onClick={() => setRetryKey(k => k + 1)}>
              <RefreshCw className="w-4 h-4 mr-1.5" />
              Try again
            </Button>
          </CardContent>
        </Card>
      ) : displayedResources.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              {showFavoritesOnly ? (
                <Heart className="w-8 h-8 text-muted-foreground" />
              ) : (
                <FileText className="w-8 h-8 text-muted-foreground" />
              )}
            </div>
            <h3 className="text-lg font-medium mb-2">
              {showFavoritesOnly ? 'No favorites yet' : `No ${activeTab}s yet`}
            </h3>
            <p className="text-muted-foreground text-center max-w-sm">
              {showFavoritesOnly
                ? 'Tap the heart icon on any resource to save it here.'
                : searchQuery
                  ? `No results found for "${searchQuery}"`
                  : `${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}s will appear here once uploaded.`}
            </p>
          </CardContent>
        </Card>
      ) : (
        <MotionContainer className="space-y-3">
          {displayedResources.map((resource) => {
            const styles = getResourceStyles(activeTab);
            const Icon = TABS.find(t => t.value === activeTab)?.icon || FileText;

            return (
              <MotionItem key={resource.id}>
              <div
                className={cn(
                  "relative w-full flex items-center gap-3 md:gap-4 p-3 md:p-4 rounded-xl transition-all duration-300 group cursor-pointer",
                  "border-2 bg-white dark:bg-gray-900/80 backdrop-blur-sm",
                  styles.border,
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
                    <p className="font-semibold text-gray-900 dark:text-white truncate group-hover:text-teal-500 dark:group-hover:text-teal-400 transition-colors text-sm md:text-base">
                      {resource.name}
                    </p>
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

                {/* Action buttons - favorite + file-type specific (always visible) */}
                <div className="flex items-center gap-2">
                  {/* Favorite heart toggle */}
                  <button
                    onClick={(e) => handleToggleFavorite(e, resource.id)}
                    className={cn(
                      "w-8 h-8 md:w-9 md:h-9 rounded-lg flex items-center justify-center transition-all border",
                      favoriteIds.has(resource.id)
                        ? "bg-rose-500/15 border-rose-500/30 text-rose-500"
                        : "bg-gray-500/10 border-gray-500/20 text-gray-400 hover:bg-rose-500/10 hover:border-rose-500/20 hover:text-rose-400"
                    )}
                    title={favoriteIds.has(resource.id) ? "Remove from favorites" : "Add to favorites"}
                  >
                    <Heart className={cn(
                      "w-3.5 h-3.5 md:w-4 md:h-4 transition-transform",
                      favoriteIds.has(resource.id) && "fill-current scale-110"
                    )} />
                  </button>

                  {/* PPTX: Only Download button */}
                  {activeTab === 'presentation' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownload(resource);
                      }}
                      className={cn(
                        "w-8 h-8 md:w-9 md:h-9 rounded-lg flex items-center justify-center transition-all border",
                        "bg-orange-500/10 border-orange-500/30 text-orange-500 hover:bg-orange-500/20"
                      )}
                      title="Download presentation"
                    >
                      <Download className="w-3.5 h-3.5 md:w-4 md:h-4" />
                    </button>
                  )}

                  {/* PDF: Open in Tab + Download buttons */}
                  {activeTab === 'pdf' && (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenViewer(resource);
                        }}
                        className={cn(
                          "w-8 h-8 md:w-9 md:h-9 rounded-lg flex items-center justify-center transition-all border",
                          "bg-blue-500/10 border-blue-500/30 text-blue-500 hover:bg-blue-500/20"
                        )}
                        title="Open in new tab"
                      >
                        <ExternalLink className="w-3.5 h-3.5 md:w-4 md:h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownload(resource);
                        }}
                        className={cn(
                          "w-8 h-8 md:w-9 md:h-9 rounded-lg flex items-center justify-center transition-all border",
                          "bg-blue-500/10 border-blue-500/30 text-blue-500 hover:bg-blue-500/20"
                        )}
                        title="Download PDF"
                      >
                        <Download className="w-3.5 h-3.5 md:w-4 md:h-4" />
                      </button>
                    </>
                  )}

                  {/* Videos: Only Open in Tab button */}
                  {activeTab === 'video' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (resource.external_url) {
                          window.open(resource.external_url, '_blank');
                        } else {
                          handleOpenViewer(resource);
                        }
                      }}
                      className={cn(
                        "w-8 h-8 md:w-9 md:h-9 rounded-lg flex items-center justify-center transition-all border",
                        "bg-teal-500/10 border-teal-500/30 text-teal-500 hover:bg-teal-500/20"
                      )}
                      title="Open video"
                    >
                      <Play className="w-3.5 h-3.5 md:w-4 md:h-4" />
                    </button>
                  )}

                  {/* Articles: No action buttons (external link handled by card click) */}
                </div>

                {/* Chevron - slides right on hover */}
                <ChevronRight className="w-4 h-4 md:w-5 md:h-5 text-gray-400 group-hover:text-teal-500 group-hover:translate-x-1 transition-all flex-shrink-0 hidden sm:block" />
              </div>
              </MotionItem>
            );
          })}
        </MotionContainer>
      );
      })()}

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
