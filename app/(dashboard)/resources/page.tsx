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

  useEffect(() => {
    const fetchResources = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          category: activeTab,
        });

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

      // Open all supported document types in universal viewer
      if (['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'csv'].includes(fileType)) {
        setViewerState({
          isOpen: true,
          fileUrl: signedUrl,
          fileName: resource.name,
          fileType: fileType
        });
      } else {
        // Fallback: open in new tab for unsupported types
        window.open(signedUrl, '_blank');
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

      {/* Content Area */}
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
        <>
          {/* Videos Grid */}
          {activeTab === 'video' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {resources.map((resource) => (
                <Card
                  key={resource.id}
                  className="group overflow-hidden hover:border-primary/50 hover:shadow-lg transition-all hover-lift"
                >
                  <CardContent className="p-0">
                    <a
                      href={resource.external_url || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block"
                    >
                      <VideoThumbnail
                        title={resource.name}
                        thumbnailUrl={resource.thumbnail_url}
                        duration={resource.duration}
                      />
                    </a>
                    <div className="p-4">
                      <h3 className="font-semibold line-clamp-2 mb-2">{resource.name}</h3>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">
                          {resource.created_at && format(new Date(resource.created_at), 'MMM d, yyyy')}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.preventDefault();
                            // TODO: Add to favorites
                            toast.success('Added to favorites');
                          }}
                        >
                          <Star className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Articles List */}
          {activeTab === 'article' && (
            <div className="space-y-3">
              {resources.map((resource) => (
                <a
                  key={resource.id}
                  href={resource.external_url || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-4 p-4 rounded-xl border bg-card hover:bg-muted/50 hover:border-primary/50 transition-all hover-lift group"
                >
                  <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                    <ExternalLink className="w-6 h-6 text-blue-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold mb-1">{resource.name}</h3>
                    <p className="text-sm text-muted-foreground truncate">
                      {resource.external_url}
                    </p>
                  </div>
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <ExternalLink className="w-5 h-5 text-muted-foreground" />
                  </div>
                </a>
              ))}
            </div>
          )}

          {/* Presentations Grid */}
          {activeTab === 'presentation' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {resources.map((resource) => (
                <Card
                  key={resource.id}
                  className="group hover:border-primary/50 hover:shadow-lg transition-all hover-lift"
                >
                  <CardContent className="p-4">
                    <div className="w-full aspect-video rounded-lg bg-gradient-to-br from-orange-500/10 to-red-500/10 flex items-center justify-center mb-4">
                      <PresentationIcon className="w-16 h-16 text-orange-500" />
                    </div>
                    <h3 className="font-semibold line-clamp-2 mb-2">{resource.name}</h3>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                      <span className="uppercase">{resource.file_type}</span>
                      <span>•</span>
                      <span>{formatFileSize(resource.file_size)}</span>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleOpenViewer(resource)}
                        className="flex-1"
                        size="sm"
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        Open
                      </Button>
                      <Button
                        onClick={() => handleDownload(resource)}
                        variant="outline"
                        size="sm"
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* PDFs List */}
          {activeTab === 'pdf' && (
            <div className="space-y-3">
              {resources.map((resource) => (
                <div
                  key={resource.id}
                  className="flex items-center gap-4 p-4 rounded-xl border bg-card hover:bg-muted/50 transition-all group"
                >
                  <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-6 h-6 text-red-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold mb-1">{resource.name}</h3>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span className="uppercase">{resource.file_type}</span>
                      <span>•</span>
                      <span>{formatFileSize(resource.file_size)}</span>
                      {resource.created_at && (
                        <>
                          <span>•</span>
                          <span>{format(new Date(resource.created_at), 'MMM d, yyyy')}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => handleOpenViewer(resource)}
                      variant="ghost"
                      size="sm"
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      Preview
                    </Button>
                    <Button
                      onClick={() => handleDownload(resource)}
                      variant="outline"
                      size="sm"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
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
