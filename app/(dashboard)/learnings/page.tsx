'use client';

import { useEffect, useState, useMemo } from 'react';
import { useUser } from '@/hooks/use-user';
import { getClient } from '@/lib/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StudentPageLoader } from '@/components/ui/page-loader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Search,
  BookOpen,
  Clock,
  ChevronRight,
  Video,
  FileText,
  Presentation,
  Link2,
  ExternalLink,
  FileQuestion,
  CheckCircle2,
  Calendar,
  Check,
  Star,
  Loader2,
  AlertCircle,
  Download,
  Youtube,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { isYouTubeUrl, getYouTubeEmbedUrl, getYouTubeWatchUrl } from '@/lib/utils/youtube-url';
import type { LearningModule, ModuleResource, ModuleResourceType, CaseStudy, ResourceProgress, ResourceFavorite } from '@/types';

interface ModuleWithResources extends LearningModule {
  resources: ModuleResource[];
}

interface WeekContent {
  weekNumber: number;
  modules: ModuleWithResources[];
  recordings: ModuleResource[];
  presentations: ModuleResource[];
  notes: ModuleResource[];
  caseStudies: CaseStudy[];
}

interface SearchResult {
  id: string;
  title: string;
  description?: string;
  type: 'video' | 'slides' | 'document' | 'link' | 'case_study';
  weekNumber: number;
  moduleName?: string;
  resource?: ModuleResource;
  caseStudy?: CaseStudy;
}

// Get icon for content type
function getContentIcon(type: ModuleResourceType, className?: string) {
  const iconClass = cn('w-5 h-5', className);
  switch (type) {
    case 'video': return <Video className={iconClass} />;
    case 'slides': return <Presentation className={iconClass} />;
    case 'document': return <FileText className={iconClass} />;
    default: return <Link2 className={iconClass} />;
  }
}

// Get content type label
function getContentTypeLabel(type: ModuleResourceType): string {
  switch (type) {
    case 'video': return 'Recording';
    case 'slides': return 'Presentation';
    case 'document': return 'Document';
    case 'link': return 'Link';
    default: return 'Resource';
  }
}

// Get gradient colors for content type
function getContentGradient(type: ModuleResourceType): { from: string; to: string; bg: string } {
  switch (type) {
    case 'video':
      return { from: 'from-purple-500', to: 'to-purple-600', bg: 'bg-purple-500/10' };
    case 'slides':
      return { from: 'from-orange-500', to: 'to-orange-600', bg: 'bg-orange-500/10' };
    case 'document':
      return { from: 'from-blue-500', to: 'to-blue-600', bg: 'bg-blue-500/10' };
    default:
      return { from: 'from-gray-500', to: 'to-gray-600', bg: 'bg-gray-500/10' };
  }
}

// Get embed URL for content
// Supports: YouTube videos, PDF files (via signed URL), legacy Google Drive
function getEmbedUrl(resource: ModuleResource): string {
  // For videos: Check YouTube first
  if (resource.content_type === 'video') {
    if (resource.external_url && isYouTubeUrl(resource.external_url)) {
      return getYouTubeEmbedUrl(resource.external_url);
    }
    // Legacy: Google Drive video fallback
    if (resource.google_drive_id) {
      return `https://drive.google.com/file/d/${resource.google_drive_id}/preview?t=${Date.now()}`;
    }
    return resource.external_url || '';
  }

  // For PDFs with file_path: Return empty string - will be fetched async via signed URL
  if (resource.file_path) {
    return ''; // Handled separately with async signed URL fetch
  }

  // Legacy: Google Drive fallback for slides/documents
  const id = resource.google_drive_id;
  if (id) {
    switch (resource.content_type) {
      case 'slides':
        return `https://docs.google.com/presentation/d/${id}/embed?start=false&loop=false&delayms=3000`;
      case 'document':
        return `https://docs.google.com/document/d/${id}/preview`;
    }
  }

  return resource.external_url || '';
}

// Get direct view URL for opening in new tab
function getDirectViewUrl(resource: ModuleResource): string {
  // For YouTube videos
  if (resource.content_type === 'video' && resource.external_url && isYouTubeUrl(resource.external_url)) {
    return getYouTubeWatchUrl(resource.external_url) || resource.external_url;
  }

  // Legacy: Google Drive
  const id = resource.google_drive_id;
  if (id) {
    switch (resource.content_type) {
      case 'video':
        return `https://drive.google.com/file/d/${id}/view`;
      case 'slides':
        return `https://docs.google.com/presentation/d/${id}/edit?usp=sharing`;
      case 'document':
        return `https://docs.google.com/document/d/${id}/edit?usp=sharing`;
    }
  }

  return resource.external_url || '';
}

// Check if resource has an uploaded PDF file
function hasUploadedFile(resource: ModuleResource): boolean {
  return !!resource.file_path && resource.content_type !== 'video';
}

// Get embed URL for case study docs
function getCaseStudyEmbedUrl(docId: string, docUrl: string | null): string {
  if (docId) {
    // Check if it's a presentation, doc, or generic file
    if (docUrl?.includes('presentation')) {
      return `https://docs.google.com/presentation/d/${docId}/embed?start=false&loop=false`;
    }
    if (docUrl?.includes('document')) {
      return `https://docs.google.com/document/d/${docId}/preview`;
    }
    return `https://drive.google.com/file/d/${docId}/preview`;
  }
  return docUrl || '';
}

export default function LearningsPage() {
  const { profile, loading: userLoading, activeCohortId, isAdmin } = useUser();
  const [modules, setModules] = useState<ModuleWithResources[]>([]);
  const [caseStudies, setCaseStudies] = useState<CaseStudy[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedResource, setSelectedResource] = useState<ModuleResource | null>(null);
  const [selectedCaseStudy, setSelectedCaseStudy] = useState<{ caseStudy: CaseStudy; type: 'problem' | 'solution' } | null>(null);
  const [activeWeek, setActiveWeek] = useState<string>('');

  // New state for tracking features
  const [completedResources, setCompletedResources] = useState<Set<string>>(new Set());
  const [favoriteResources, setFavoriteResources] = useState<Set<string>>(new Set());
  const [recentActivity, setRecentActivity] = useState<ModuleResource[]>([]);
  const [iframeLoading, setIframeLoading] = useState(true);
  const [iframeError, setIframeError] = useState(false);
  const [weekProgress, setWeekProgress] = useState<Record<number, { completed: number; total: number }>>({});

  // Global search state
  const [isSearching, setIsSearching] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'video' | 'slides' | 'document' | 'case_study'>('all');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);

  // PDF signed URL state (for uploaded PDFs in Supabase Storage)
  const [pdfSignedUrl, setPdfSignedUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const supabase = getClient();

      try {
        let modulesData: LearningModule[] | null = null;
        let modulesError: any = null;

        // OVERRIDE MODEL LOGIC:
        // - Admin role: Show ONLY global library
        // - Student role: Show modules based on active link type (override logic)
        if (isAdmin) {
          // Admin: only global library
          const { data, error } = await supabase
            .from('learning_modules')
            .select('*')
            .is('cohort_id', null)
            .order('week_number', { ascending: true })
            .order('order_index', { ascending: true });
          modulesData = data;
          modulesError = error;
        } else {
          // Student: Use override logic based on cohort link state
          if (!activeCohortId) {
            setLoading(false);
            return;
          }

          // Step 1: Fetch cohort state to determine active link
          const { data: cohort } = await supabase
            .from('cohorts')
            .select('id, active_link_type, linked_cohort_id')
            .eq('id', activeCohortId)
            .single();

          if (!cohort) {
            throw new Error('Cohort not found');
          }

          // Step 2: Query modules based on active link type (OVERRIDE logic)
          let query = supabase
            .from('learning_modules')
            .select('*')
            .order('week_number', { ascending: true })
            .order('order_index', { ascending: true });

          switch (cohort.active_link_type) {
            case 'global':
              // ONLY global modules (overrides own)
              query = query.eq('is_global', true);
              break;

            case 'cohort':
              // ONLY modules from linked cohort (overrides own)
              if (cohort.linked_cohort_id) {
                query = query.eq('cohort_id', cohort.linked_cohort_id);
              } else {
                // Fallback if linked_cohort_id is missing
                query = query.eq('cohort_id', activeCohortId);
              }
              break;

            case 'own':
            default:
              // ONLY own modules (default)
              query = query.eq('cohort_id', activeCohortId);
              break;
          }

          const result = await query;
          modulesData = result.data;
          modulesError = result.error;
        }

        if (modulesError) throw modulesError;

        // Fetch all module resources
        const moduleIds = modulesData?.map((m: LearningModule) => m.id) || [];
        const { data: resourcesData } = await supabase
          .from('module_resources')
          .select('*')
          .in('module_id', moduleIds)
          .order('session_number', { ascending: true })
          .order('order_index', { ascending: true });

        // Merge resources with modules
        const modulesWithResources = modulesData?.map((module: LearningModule) => ({
          ...module,
          resources: resourcesData?.filter((r: ModuleResource) => r.module_id === module.id) || [],
        })) || [];

        setModules(modulesWithResources);

        // Fetch case studies with same filtering logic
        let caseStudyQuery = supabase
          .from('case_studies')
          .select('*')
          .order('week_number', { ascending: true })
          .order('order_index', { ascending: true });

        if (isAdmin) {
          caseStudyQuery = caseStudyQuery.is('cohort_id', null);
        } else if (activeCohortId) {
          caseStudyQuery = caseStudyQuery.eq('cohort_id', activeCohortId);
        }

        const { data: caseStudiesData } = await caseStudyQuery;

        setCaseStudies(caseStudiesData || []);

        // Set initial active week
        if (modulesWithResources.length > 0) {
          const firstWeek = modulesWithResources[0].week_number || 1;
          setActiveWeek(firstWeek.toString());
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    if (!userLoading) {
      fetchData();
    }
  }, [profile, userLoading, activeCohortId, isAdmin]);

  // Organize content by week
  const weekContent: Record<number, WeekContent> = {};

  modules.forEach(module => {
    const week = module.week_number || 1;
    if (!weekContent[week]) {
      weekContent[week] = {
        weekNumber: week,
        modules: [],
        recordings: [],
        presentations: [],
        notes: [],
        caseStudies: [],
      };
    }
    weekContent[week].modules.push(module);

    module.resources.forEach(resource => {
      switch (resource.content_type) {
        case 'video':
          weekContent[week].recordings.push(resource);
          break;
        case 'slides':
          weekContent[week].presentations.push(resource);
          break;
        case 'document':
          weekContent[week].notes.push(resource);
          break;
      }
    });
  });

  // Add case studies to weeks
  caseStudies.forEach(cs => {
    const week = cs.week_number;
    if (!weekContent[week]) {
      weekContent[week] = {
        weekNumber: week,
        modules: [],
        recordings: [],
        presentations: [],
        notes: [],
        caseStudies: [],
      };
    }
    weekContent[week].caseStudies.push(cs);
  });

  const weeks = Object.keys(weekContent)
    .map(Number)
    .sort((a, b) => a - b);

  // Filter for search
  const filterResources = (resources: ModuleResource[]) => {
    if (!searchQuery) return resources;
    return resources.filter(r =>
      r.title.toLowerCase().includes(searchQuery.toLowerCase())
    );
  };

  const filterCaseStudies = (studies: CaseStudy[]) => {
    if (!searchQuery) return studies;
    return studies.filter(cs =>
      cs.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cs.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  };

  // Global search function that searches across ALL weeks
  const performGlobalSearch = (query: string): SearchResult[] => {
    if (!query.trim()) return [];

    const lowerQuery = query.toLowerCase().trim();
    const results: SearchResult[] = [];

    // Search through all weeks
    Object.entries(weekContent).forEach(([weekNum, content]) => {
      const weekNumber = parseInt(weekNum);

      // Search recordings (videos)
      content.recordings.forEach(resource => {
        const module = content.modules.find(m =>
          m.resources.some(r => r.id === resource.id)
        );
        const moduleName = module?.title || '';

        if (
          resource.title.toLowerCase().includes(lowerQuery) ||
          resource.description?.toLowerCase().includes(lowerQuery) ||
          moduleName.toLowerCase().includes(lowerQuery)
        ) {
          results.push({
            id: resource.id,
            title: resource.title,
            description: resource.description || undefined,
            type: 'video',
            weekNumber,
            moduleName: moduleName || undefined,
            resource,
          });
        }
      });

      // Search presentations (slides)
      content.presentations.forEach(resource => {
        const module = content.modules.find(m =>
          m.resources.some(r => r.id === resource.id)
        );
        const moduleName = module?.title || '';

        if (
          resource.title.toLowerCase().includes(lowerQuery) ||
          resource.description?.toLowerCase().includes(lowerQuery) ||
          moduleName.toLowerCase().includes(lowerQuery)
        ) {
          results.push({
            id: resource.id,
            title: resource.title,
            description: resource.description || undefined,
            type: 'slides',
            weekNumber,
            moduleName: moduleName || undefined,
            resource,
          });
        }
      });

      // Search notes (documents)
      content.notes.forEach(resource => {
        const module = content.modules.find(m =>
          m.resources.some(r => r.id === resource.id)
        );
        const moduleName = module?.title || '';

        if (
          resource.title.toLowerCase().includes(lowerQuery) ||
          resource.description?.toLowerCase().includes(lowerQuery) ||
          moduleName.toLowerCase().includes(lowerQuery)
        ) {
          results.push({
            id: resource.id,
            title: resource.title,
            description: resource.description || undefined,
            type: 'document',
            weekNumber,
            moduleName: moduleName || undefined,
            resource,
          });
        }
      });

      // Search case studies
      content.caseStudies.forEach(cs => {
        if (
          cs.title.toLowerCase().includes(lowerQuery) ||
          cs.description?.toLowerCase().includes(lowerQuery)
        ) {
          results.push({
            id: cs.id,
            title: cs.title,
            description: cs.description || undefined,
            type: 'case_study',
            weekNumber,
            caseStudy: cs,
          });
        }
      });
    });

    // Sort results by week number
    return results.sort((a, b) => a.weekNumber - b.weekNumber);
  };

  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);

    if (query.trim()) {
      setIsSearching(true);
      const results = performGlobalSearch(query);
      setSearchResults(results);
    } else {
      setIsSearching(false);
      setSearchResults([]);
      setActiveFilter('all');
    }
  };

  // Handle clicking a search result
  const handleSearchResultClick = (result: SearchResult) => {
    // Jump to the week
    setActiveWeek(result.weekNumber.toString());

    // Clear search
    setSearchQuery('');
    setIsSearching(false);
    setSearchResults([]);
    setActiveFilter('all');

    // If it's a resource, open it
    if (result.resource) {
      handleResourceClick(result.resource);
    } else if (result.caseStudy) {
      // For case studies, open the problem doc by default
      if (result.caseStudy.problem_doc_url) {
        handleCaseStudyClick(result.caseStudy, 'problem');
      }
    }
  };

  // Filter search results by type
  const filteredSearchResults = useMemo(() => {
    if (activeFilter === 'all') return searchResults;
    return searchResults.filter(r => r.type === activeFilter);
  }, [searchResults, activeFilter]);

  // Group search results by week
  const groupedSearchResults = useMemo(() => {
    const grouped: Record<number, SearchResult[]> = {};
    filteredSearchResults.forEach(result => {
      if (!grouped[result.weekNumber]) {
        grouped[result.weekNumber] = [];
      }
      grouped[result.weekNumber].push(result);
    });
    return grouped;
  }, [filteredSearchResults]);

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return null;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Fetch tracking data (progress, favorites, recent activity)
  const fetchTrackingData = async () => {
    try {
      const [progressRes, favoritesRes, recentRes] = await Promise.all([
        fetch('/api/learnings/progress'),
        fetch('/api/learnings/favorites'),
        fetch(`/api/learnings/recent?limit=3&cohort_id=${activeCohortId}`),
      ]);

      if (progressRes.ok) {
        const { progress } = await progressRes.json();
        const completed = new Set<string>(
          progress.filter((p: ResourceProgress) => p.is_completed).map((p: ResourceProgress) => p.resource_id)
        );
        setCompletedResources(completed);
      }

      if (favoritesRes.ok) {
        const { favorites } = await favoritesRes.json();
        const favSet = new Set<string>(favorites.map((f: ResourceFavorite) => f.resource_id));
        setFavoriteResources(favSet);
      }

      if (recentRes.ok) {
        const { recent } = await recentRes.json();
        setRecentActivity(recent);
      }
    } catch (error) {
      console.error('Error fetching tracking data:', error);
    }
  };

  // Mark resource as complete/incomplete
  const handleMarkComplete = async (resourceId: string) => {
    const isCompleted = completedResources.has(resourceId);
    const newCompleted = new Set(completedResources);

    if (isCompleted) {
      newCompleted.delete(resourceId);
    } else {
      newCompleted.add(resourceId);
    }

    setCompletedResources(newCompleted);

    try {
      const response = await fetch('/api/learnings/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resource_id: resourceId, is_completed: !isCompleted }),
      });

      if (!response.ok) {
        throw new Error('Failed to update progress');
      }

      toast.success(isCompleted ? 'Marked as incomplete' : 'Marked as complete');

      // Recalculate week progress
      calculateWeekProgress();
    } catch (error) {
      console.error('Error marking complete:', error);
      toast.error('Failed to update completion status');
      setCompletedResources(completedResources);
    }
  };

  // Toggle favorite
  const handleToggleFavorite = async (resourceId: string) => {
    const isFavorite = favoriteResources.has(resourceId);
    const newFavorites = new Set(favoriteResources);

    if (isFavorite) {
      newFavorites.delete(resourceId);
    } else {
      newFavorites.add(resourceId);
    }

    setFavoriteResources(newFavorites);

    try {
      if (isFavorite) {
        const response = await fetch(`/api/learnings/favorites?resource_id=${resourceId}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          throw new Error('Failed to remove favorite');
        }

        toast.success('Removed from favorites');
      } else {
        const response = await fetch('/api/learnings/favorites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ resource_id: resourceId }),
        });

        if (!response.ok) {
          throw new Error('Failed to add favorite');
        }

        toast.success('Added to favorites');
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
      toast.error('Failed to update favorite');
      setFavoriteResources(favoriteResources);
    }
  };

  // Calculate week progress
  const calculateWeekProgress = () => {
    const progress: Record<number, { completed: number; total: number }> = {};

    modules.forEach(module => {
      const week = module.week_number || 1;
      if (!progress[week]) {
        progress[week] = { completed: 0, total: 0 };
      }

      module.resources.forEach(resource => {
        progress[week].total++;
        if (completedResources.has(resource.id)) {
          progress[week].completed++;
        }
      });
    });

    setWeekProgress(progress);
  };

  // Calculate related resources for modal
  const relatedResources = useMemo(() => {
    if (!selectedResource) return [];

    const currentWeek = modules.find(m =>
      m.resources.some(r => r.id === selectedResource.id)
    )?.week_number;

    if (!currentWeek) return [];

    return modules
      .filter(m => m.week_number === currentWeek)
      .flatMap(m => m.resources)
      .filter(r => r.id !== selectedResource.id);
  }, [selectedResource, modules]);

  // Fetch tracking data on mount and when cohort changes
  useEffect(() => {
    if (!userLoading && profile && activeCohortId) {
      fetchTrackingData();
    }
  }, [userLoading, profile, activeCohortId]);

  // Recalculate week progress when modules or completed resources change
  useEffect(() => {
    if (modules.length > 0) {
      calculateWeekProgress();
    }
  }, [modules, completedResources]);

  // Keyboard shortcuts for modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedResource) return;

      if (e.key === 'Escape') {
        setSelectedResource(null);
      } else if (e.key === 'ArrowRight') {
        // Navigate to next resource
        const currentIndex = relatedResources.findIndex(r => r.id === selectedResource.id);
        if (currentIndex >= 0 && currentIndex < relatedResources.length - 1) {
          setSelectedResource(relatedResources[currentIndex + 1]);
          setIframeLoading(true);
          setIframeError(false);
        } else if (relatedResources.length > 0 && currentIndex === -1) {
          setSelectedResource(relatedResources[0]);
          setIframeLoading(true);
          setIframeError(false);
        }
      } else if (e.key === 'ArrowLeft') {
        // Navigate to previous resource
        const currentIndex = relatedResources.findIndex(r => r.id === selectedResource.id);
        if (currentIndex > 0) {
          setSelectedResource(relatedResources[currentIndex - 1]);
          setIframeLoading(true);
          setIframeError(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedResource, relatedResources]);

  // Iframe timeout detection (10 seconds)
  useEffect(() => {
    if (!selectedResource || !iframeLoading) return;

    const timeout = setTimeout(() => {
      if (iframeLoading) {
        console.error('[Learnings] Iframe loading timeout after 10 seconds');
        setIframeLoading(false);
        setIframeError(true);
      }
    }, 5000); // 5 second timeout - show fallback faster

    return () => clearTimeout(timeout);
  }, [selectedResource, iframeLoading]);

  // Fetch signed URL for PDF resources (uploaded to Supabase Storage)
  useEffect(() => {
    const fetchSignedUrl = async () => {
      if (!selectedResource) {
        setPdfSignedUrl(null);
        return;
      }

      const extendedResource = selectedResource as ModuleResource;

      // Only fetch for PDFs with file_path (uploaded to Supabase Storage)
      if (extendedResource.file_path && extendedResource.content_type !== 'video') {
        setPdfLoading(true);
        try {
          const response = await fetch(`/api/module-resources/${selectedResource.id}/signed-url`);
          if (response.ok) {
            const data = await response.json();
            setPdfSignedUrl(data.url);
            console.log('[Learnings] PDF signed URL fetched:', { title: selectedResource.title, url: data.url });
          } else {
            console.error('[Learnings] Failed to fetch signed URL:', response.status);
            setPdfSignedUrl(null);
          }
        } catch (error) {
          console.error('[Learnings] Error fetching signed URL:', error);
          setPdfSignedUrl(null);
        } finally {
          setPdfLoading(false);
        }
      } else {
        setPdfSignedUrl(null);
      }
    };

    fetchSignedUrl();
  }, [selectedResource]);

  const handleResourceClick = async (resource: ModuleResource) => {
    if (resource.content_type === 'link' && resource.external_url) {
      window.open(resource.external_url, '_blank');
    } else {
      setSelectedResource(resource);
      setIframeLoading(true);
      setIframeError(false); // Reset error state

      // Track resource view
      try {
        await fetch('/api/learnings/recent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ resource_id: resource.id }),
        });
      } catch (error) {
        console.error('Error tracking resource view:', error);
      }
    }
  };

  const handleCaseStudyClick = (caseStudy: CaseStudy, type: 'problem' | 'solution') => {
    if (type === 'problem' && caseStudy.problem_doc_url) {
      setSelectedCaseStudy({ caseStudy, type });
    } else if (type === 'solution' && caseStudy.solution_visible && caseStudy.solution_doc_url) {
      setSelectedCaseStudy({ caseStudy, type });
    }
  };

  // Show full-page loader until BOTH auth AND data are ready
  // This prevents flash of empty content
  if (userLoading || loading) {
    return <StudentPageLoader message="Loading your learnings..." />;
  }

  const currentWeekContent = activeWeek ? weekContent[parseInt(activeWeek)] : null;

  // Content section component with futuristic cards
  const ContentSection = ({
    title,
    icon: Icon,
    iconColor,
    resources,
    emptyMessage,
    gradientFrom,
    gradientTo
  }: {
    title: string;
    icon: React.ElementType;
    iconColor: string;
    resources: ModuleResource[];
    emptyMessage: string;
    gradientFrom: string;
    gradientTo: string;
  }) => {
    const filtered = filterResources(resources);
    if (resources.length === 0 && !searchQuery) return null;

    // Get border color based on section type
    const getBorderColor = () => {
      if (iconColor === 'text-purple-500') return 'border-purple-500/20 hover:border-purple-500/40';
      if (iconColor === 'text-orange-500') return 'border-orange-500/20 hover:border-orange-500/40';
      if (iconColor === 'text-blue-500') return 'border-blue-500/20 hover:border-blue-500/40';
      return 'border-gray-500/20 hover:border-gray-500/40';
    };

    const getGlowColor = () => {
      if (iconColor === 'text-purple-500') return 'hover:shadow-purple-500/10';
      if (iconColor === 'text-orange-500') return 'hover:shadow-orange-500/10';
      if (iconColor === 'text-blue-500') return 'hover:shadow-blue-500/10';
      return 'hover:shadow-gray-500/10';
    };

    return (
      <div className="space-y-4">
        {/* Section header */}
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-9 h-9 rounded-xl bg-gradient-to-br flex items-center justify-center shadow-md",
            gradientFrom, gradientTo,
            iconColor === 'text-purple-500' && "shadow-purple-500/20",
            iconColor === 'text-orange-500' && "shadow-orange-500/20",
            iconColor === 'text-blue-500' && "shadow-blue-500/20"
          )}>
            <Icon className="w-5 h-5 text-white" />
          </div>
          <h3 className="font-bold text-gray-900 dark:text-white text-lg">{title}</h3>
          <Badge variant="secondary" className={cn(
            "ml-auto border",
            iconColor === 'text-purple-500' && "bg-purple-500/10 border-purple-500/20 text-purple-400",
            iconColor === 'text-orange-500' && "bg-orange-500/10 border-orange-500/20 text-orange-400",
            iconColor === 'text-blue-500' && "bg-blue-500/10 border-blue-500/20 text-blue-400"
          )}>
            {filtered.length} {filtered.length === 1 ? 'item' : 'items'}
          </Badge>
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700 py-8">
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center">{emptyMessage}</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {filtered.map((resource) => {
              const isCompleted = completedResources.has(resource.id);
              const isFavorite = favoriteResources.has(resource.id);

              return (
                <button
                  key={resource.id}
                  onClick={() => handleResourceClick(resource)}
                  className={cn(
                    "relative w-full flex items-center gap-4 p-4 rounded-xl text-left transition-all duration-300 group",
                    "border-2 bg-white dark:bg-gray-900/80 backdrop-blur-sm",
                    isCompleted
                      ? "border-green-500/30 bg-green-50/50 dark:bg-green-900/10"
                      : getBorderColor(),
                    "hover:shadow-lg hover:-translate-y-0.5",
                    getGlowColor()
                  )}
                >
                  {/* Icon container */}
                  <div className={cn(
                    "w-11 h-11 rounded-xl bg-gradient-to-br flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-300",
                    gradientFrom, gradientTo,
                    iconColor === 'text-purple-500' && "shadow-lg shadow-purple-500/25",
                    iconColor === 'text-orange-500' && "shadow-lg shadow-orange-500/25",
                    iconColor === 'text-blue-500' && "shadow-lg shadow-blue-500/25"
                  )}>
                    {getContentIcon(resource.content_type, 'w-5 h-5 text-white')}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-gray-900 dark:text-white truncate group-hover:text-purple-500 dark:group-hover:text-purple-400 transition-colors">
                        {resource.title}
                      </p>
                      {isFavorite && (
                        <Star className="w-4 h-4 fill-yellow-400 text-yellow-400 flex-shrink-0 drop-shadow-sm" />
                      )}
                      {isCompleted && (
                        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/10 border border-green-500/20">
                          <CheckCircle2 className="w-3 h-3 text-green-500" />
                          <span className="text-xs font-medium text-green-500">Done</span>
                        </div>
                      )}
                    </div>

                    {/* Metadata row */}
                    <div className="flex flex-wrap items-center gap-3 text-sm">
                      {resource.session_number && (
                        <span className="text-gray-500 dark:text-gray-400">
                          Session {resource.session_number}
                        </span>
                      )}
                      {resource.duration_seconds && (
                        <span className="text-gray-500 dark:text-gray-400 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {formatDuration(resource.duration_seconds)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Action buttons - visible on hover */}
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleFavorite(resource.id);
                      }}
                      className={cn(
                        "w-9 h-9 rounded-lg flex items-center justify-center transition-all border",
                        isFavorite
                          ? "bg-yellow-500/10 border-yellow-500/30 text-yellow-500"
                          : "hover:bg-gray-100 dark:hover:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-400 hover:text-gray-600"
                      )}
                      title={isFavorite ? "Remove from favorites" : "Add to favorites"}
                    >
                      <Star className={cn("w-4 h-4", isFavorite && "fill-current")} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMarkComplete(resource.id);
                      }}
                      className={cn(
                        "w-9 h-9 rounded-lg flex items-center justify-center transition-all border",
                        isCompleted
                          ? "bg-green-500/10 border-green-500/30 text-green-500"
                          : "hover:bg-gray-100 dark:hover:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-400 hover:text-gray-600"
                      )}
                      title={isCompleted ? "Mark as incomplete" : "Mark as complete"}
                    >
                      <CheckCircle2 className={cn("w-4 h-4", isCompleted && "fill-current")} />
                    </button>
                  </div>

                  {/* Chevron */}
                  <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-purple-500 group-hover:translate-x-1 transition-all flex-shrink-0" />
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // Case Studies section component
  const CaseStudiesSection = ({ studies }: { studies: CaseStudy[] }) => {
    const filtered = filterCaseStudies(studies);
    if (studies.length === 0 && !searchQuery) return null;

    return (
      <div className="space-y-4">
        {/* Section header */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <FileQuestion className="w-5 h-5 text-white" />
          </div>
          <h3 className="font-bold text-gray-900 dark:text-white text-lg">Case Studies</h3>
          <Badge variant="secondary" className="ml-auto bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            {filtered.length} {filtered.length === 1 ? 'study' : 'studies'}
          </Badge>
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700 py-8">
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center">No case studies found</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {filtered.map((cs) => (
              <div
                key={cs.id}
                className="p-4 rounded-xl border-2 border-emerald-500/20 bg-white dark:bg-gray-900/80 hover:border-emerald-500/40 hover:shadow-lg hover:shadow-emerald-500/10 transition-all duration-300"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1.5">
                    <h4 className="font-semibold text-gray-900 dark:text-white">{cs.title}</h4>
                    {cs.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400">{cs.description}</p>
                    )}
                    {cs.due_date && (
                      <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>Due: {formatDate(cs.due_date)}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {cs.problem_doc_url && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCaseStudyClick(cs, 'problem')}
                        className="h-9 text-xs border-2 border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800"
                      >
                        <FileQuestion className="w-4 h-4 mr-1.5" />
                        Problem
                      </Button>
                    )}
                    {cs.solution_visible && cs.solution_doc_url ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCaseStudyClick(cs, 'solution')}
                        className="h-9 text-xs text-emerald-500 border-2 border-emerald-500/30 hover:border-emerald-500/50 hover:bg-emerald-500/10"
                      >
                        <CheckCircle2 className="w-4 h-4 mr-1.5" />
                        Solution
                      </Button>
                    ) : cs.solution_doc_url && (
                      <Badge variant="secondary" className="h-9 text-xs bg-gray-500/10 border border-gray-500/20 text-gray-400 flex items-center">
                        Solution pending
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">My Learnings</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Access your course materials, recordings, and presentations
          </p>
        </div>
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search all weeks..."
            value={searchQuery}
            onChange={handleSearchChange}
            className="pl-11 h-11 bg-white dark:bg-gray-900/80 border-2 border-gray-200 dark:border-gray-800 rounded-xl focus:border-purple-500 dark:focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('');
                setIsSearching(false);
                setSearchResults([]);
                setActiveFilter('all');
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              <span className="text-xs text-gray-600 dark:text-gray-300">×</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Chips - visible when searching */}
      {isSearching && searchQuery && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-gray-500 dark:text-gray-400 mr-2">Filter:</span>
          {[
            { value: 'all' as const, label: 'All', count: searchResults.length },
            { value: 'video' as const, label: 'Recordings', count: searchResults.filter(r => r.type === 'video').length },
            { value: 'slides' as const, label: 'Presentations', count: searchResults.filter(r => r.type === 'slides').length },
            { value: 'document' as const, label: 'Notes', count: searchResults.filter(r => r.type === 'document').length },
            { value: 'case_study' as const, label: 'Case Studies', count: searchResults.filter(r => r.type === 'case_study').length },
          ].map(filter => (
            <button
              key={filter.value}
              onClick={() => setActiveFilter(filter.value)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm font-medium transition-all border-2",
                activeFilter === filter.value
                  ? "bg-purple-500 text-white border-purple-500 shadow-lg shadow-purple-500/25"
                  : "bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-800 hover:border-purple-500/50"
              )}
            >
              {filter.label}
              <span className={cn(
                "ml-1.5 px-1.5 py-0.5 rounded text-xs",
                activeFilter === filter.value
                  ? "bg-white/20 text-white"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
              )}>
                {filter.count}
              </span>
            </button>
          ))}
        </div>
      )}

      {weeks.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 py-20">
          <div className="flex flex-col items-center justify-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center mb-4 shadow-lg shadow-purple-500/25">
              <BookOpen className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">No content yet</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 text-center max-w-sm">
              Learning content will appear here once your cohort begins. Stay tuned!
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Continue Where You Left Off - Shows actual assets */}
          {recentActivity.length > 0 && (
            <div className="relative rounded-2xl border border-purple-500/30 dark:border-purple-500/20 bg-gradient-to-br from-gray-900/50 to-gray-950 p-[1px] shadow-lg shadow-purple-500/5">
              <div className="rounded-2xl bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-950 overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-200/50 dark:border-gray-800/50 bg-gradient-to-r from-purple-500/5 to-transparent">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/25">
                      <Clock className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Continue where you left off</h2>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {recentActivity.length} recent {recentActivity.length === 1 ? 'asset' : 'assets'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="p-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {recentActivity.map((resource: any) => {
                      const isFavorite = favoriteResources.has(resource.id);
                      const isCompleted = completedResources.has(resource.id);
                      const gradient = getContentGradient(resource.content_type);
                      const typeLabel = getContentTypeLabel(resource.content_type);

                      return (
                        <button
                          key={resource.id}
                          onClick={() => handleResourceClick(resource)}
                          className={cn(
                            "relative p-4 rounded-xl text-left transition-all duration-300 group",
                            "border-2 bg-white dark:bg-gray-900/80 backdrop-blur-sm",
                            resource.content_type === 'video' && "border-purple-500/20 hover:border-purple-500/50 hover:shadow-lg hover:shadow-purple-500/10",
                            resource.content_type === 'slides' && "border-orange-500/20 hover:border-orange-500/50 hover:shadow-lg hover:shadow-orange-500/10",
                            resource.content_type === 'document' && "border-blue-500/20 hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/10",
                            !['video', 'slides', 'document'].includes(resource.content_type) && "border-gray-500/20 hover:border-gray-500/50",
                            "hover:-translate-y-1"
                          )}
                        >
                          {/* Content type badge - top left */}
                          <div className={cn(
                            "absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border",
                            resource.content_type === 'video' && "bg-purple-500/10 border-purple-500/30 text-purple-400",
                            resource.content_type === 'slides' && "bg-orange-500/10 border-orange-500/30 text-orange-400",
                            resource.content_type === 'document' && "bg-blue-500/10 border-blue-500/30 text-blue-400",
                            !['video', 'slides', 'document'].includes(resource.content_type) && "bg-gray-500/10 border-gray-500/30 text-gray-400"
                          )}>
                            {getContentIcon(resource.content_type, 'w-3.5 h-3.5')}
                            <span>{typeLabel}</span>
                          </div>

                          {/* Favorite indicator - top right */}
                          {isFavorite && (
                            <Star className="absolute top-3 right-3 w-4 h-4 fill-yellow-400 text-yellow-400 drop-shadow-sm" />
                          )}

                          {/* Main content */}
                          <div className="pt-10 space-y-3">
                            {/* Icon and title */}
                            <div className="flex items-start gap-3">
                              <div className={cn(
                                "w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-300",
                                gradient.from, gradient.to,
                                resource.content_type === 'video' && "shadow-lg shadow-purple-500/30",
                                resource.content_type === 'slides' && "shadow-lg shadow-orange-500/30",
                                resource.content_type === 'document' && "shadow-lg shadow-blue-500/30"
                              )}>
                                {getContentIcon(resource.content_type, 'w-6 h-6 text-white')}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-gray-900 dark:text-white text-sm line-clamp-2 leading-tight group-hover:text-purple-500 dark:group-hover:text-purple-400 transition-colors">
                                  {resource.title}
                                </p>
                                {/* Duration / metadata */}
                                <div className="flex items-center gap-2 mt-1.5">
                                  {resource.duration_seconds && (
                                    <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                                      <Clock className="w-3 h-3" />
                                      <span>{formatDuration(resource.duration_seconds)}</span>
                                    </div>
                                  )}
                                  {isCompleted && (
                                    <div className="flex items-center gap-1 text-xs text-green-500">
                                      <CheckCircle2 className="w-3 h-3" />
                                      <span>Completed</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Progress bar (for videos with progress) */}
                            {resource.progress?.progress_seconds > 0 && resource.duration_seconds && !isCompleted && (
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-gray-500 dark:text-gray-400">Progress</span>
                                  <span className="font-semibold text-gray-700 dark:text-gray-300">
                                    {Math.min(Math.round((resource.progress.progress_seconds / resource.duration_seconds) * 100), 100)}%
                                  </span>
                                </div>
                                <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                                  <div
                                    className={cn(
                                      "h-full rounded-full transition-all duration-500",
                                      resource.content_type === 'video' && "bg-gradient-to-r from-purple-500 to-purple-400",
                                      resource.content_type === 'slides' && "bg-gradient-to-r from-orange-500 to-orange-400",
                                      resource.content_type === 'document' && "bg-gradient-to-r from-blue-500 to-blue-400",
                                      !['video', 'slides', 'document'].includes(resource.content_type) && "bg-gray-500"
                                    )}
                                    style={{ width: `${Math.min((resource.progress.progress_seconds / resource.duration_seconds) * 100, 100)}%` }}
                                  />
                                </div>
                              </div>
                            )}

                            {/* Click to open hint */}
                            <div className="flex items-center justify-between pt-2 border-t border-gray-200/50 dark:border-gray-800/50">
                              <span className="text-xs text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-400 transition-colors">
                                Click to {resource.content_type === 'video' ? 'watch' : resource.content_type === 'slides' ? 'view slides' : 'open'}
                              </span>
                              <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-purple-500 group-hover:translate-x-1 transition-all" />
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Search Results Section - shown when searching */}
          {isSearching && searchQuery && (
            <div className="space-y-6">
              {/* Results count */}
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {filteredSearchResults.length === 0 ? (
                    'No results found'
                  ) : (
                    <>
                      Found <span className="font-semibold text-gray-900 dark:text-white">{filteredSearchResults.length}</span> {filteredSearchResults.length === 1 ? 'result' : 'results'}
                      {activeFilter !== 'all' && (
                        <> in <span className="font-semibold text-purple-500">{activeFilter === 'video' ? 'Recordings' : activeFilter === 'slides' ? 'Presentations' : activeFilter === 'document' ? 'Notes' : 'Case Studies'}</span></>
                      )}
                    </>
                  )}
                </p>
                {filteredSearchResults.length > 0 && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setIsSearching(false);
                      setSearchResults([]);
                      setActiveFilter('all');
                    }}
                    className="text-sm text-purple-500 hover:text-purple-600 font-medium"
                  >
                    Clear search
                  </button>
                )}
              </div>

              {/* Empty state */}
              {filteredSearchResults.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/30">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-gray-400 to-gray-500 flex items-center justify-center mb-4 shadow-lg shadow-gray-500/20">
                    <Search className="w-7 h-7 text-white" />
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 text-center font-medium mb-2">
                    No results found for "{searchQuery}"
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
                    Try searching for a different term or adjust your filters
                  </p>
                </div>
              ) : (
                /* Results grouped by week */
                <div className="space-y-6">
                  {Object.entries(groupedSearchResults)
                    .sort(([a], [b]) => parseInt(a) - parseInt(b))
                    .map(([weekNum, results]) => (
                      <div key={weekNum} className="space-y-3">
                        {/* Week header */}
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-md shadow-purple-500/20">
                            <span className="text-xs font-bold text-white">{weekNum}</span>
                          </div>
                          <h3 className="font-semibold text-gray-900 dark:text-white">Week {weekNum}</h3>
                          <Badge variant="secondary" className="ml-auto bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                            {results.length} {results.length === 1 ? 'result' : 'results'}
                          </Badge>
                        </div>

                        {/* Results for this week */}
                        <div className="grid gap-2 pl-10">
                          {results.map((result) => {
                            // Get colors based on type
                            const getTypeConfig = () => {
                              switch (result.type) {
                                case 'video':
                                  return {
                                    label: 'Recording',
                                    icon: <Video className="w-4 h-4" />,
                                    colors: 'bg-purple-500/10 border-purple-500/30 text-purple-500',
                                    borderHover: 'hover:border-purple-500/50',
                                    shadowHover: 'hover:shadow-purple-500/10',
                                  };
                                case 'slides':
                                  return {
                                    label: 'Presentation',
                                    icon: <Presentation className="w-4 h-4" />,
                                    colors: 'bg-orange-500/10 border-orange-500/30 text-orange-500',
                                    borderHover: 'hover:border-orange-500/50',
                                    shadowHover: 'hover:shadow-orange-500/10',
                                  };
                                case 'document':
                                  return {
                                    label: 'Notes',
                                    icon: <FileText className="w-4 h-4" />,
                                    colors: 'bg-blue-500/10 border-blue-500/30 text-blue-500',
                                    borderHover: 'hover:border-blue-500/50',
                                    shadowHover: 'hover:shadow-blue-500/10',
                                  };
                                case 'case_study':
                                  return {
                                    label: 'Case Study',
                                    icon: <FileQuestion className="w-4 h-4" />,
                                    colors: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500',
                                    borderHover: 'hover:border-emerald-500/50',
                                    shadowHover: 'hover:shadow-emerald-500/10',
                                  };
                                default:
                                  return {
                                    label: 'Resource',
                                    icon: <Link2 className="w-4 h-4" />,
                                    colors: 'bg-gray-500/10 border-gray-500/30 text-gray-500',
                                    borderHover: 'hover:border-gray-500/50',
                                    shadowHover: 'hover:shadow-gray-500/10',
                                  };
                              }
                            };

                            const typeConfig = getTypeConfig();

                            return (
                              <button
                                key={result.id}
                                onClick={() => handleSearchResultClick(result)}
                                className={cn(
                                  "w-full flex items-center gap-4 p-4 rounded-xl text-left transition-all duration-200 group",
                                  "border-2 bg-white dark:bg-gray-900/80",
                                  "border-gray-200 dark:border-gray-800",
                                  typeConfig.borderHover,
                                  "hover:shadow-lg",
                                  typeConfig.shadowHover,
                                  "hover:-translate-y-0.5"
                                )}
                              >
                                {/* Type badge */}
                                <div className={cn(
                                  "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border flex-shrink-0",
                                  typeConfig.colors
                                )}>
                                  {typeConfig.icon}
                                  <span>{typeConfig.label}</span>
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                  <p className="font-semibold text-gray-900 dark:text-white truncate group-hover:text-purple-500 dark:group-hover:text-purple-400 transition-colors">
                                    {result.title}
                                  </p>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    {result.moduleName && (
                                      <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                        {result.moduleName}
                                      </span>
                                    )}
                                    {result.description && (
                                      <span className="text-xs text-gray-400 dark:text-gray-500 line-clamp-1">
                                        {result.moduleName && ' - '}{result.description}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Chevron */}
                                <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-purple-500 group-hover:translate-x-1 transition-all flex-shrink-0" />
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}

          {/* Week Tabs with Progress - only shown when NOT searching */}
          {!isSearching && (
          <Tabs value={activeWeek} onValueChange={setActiveWeek}>
            <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 p-1.5 overflow-hidden">
              <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-700 scrollbar-track-transparent">
                <TabsList className="inline-flex h-auto items-center justify-start bg-transparent p-0 gap-1 min-w-max">
                  {weeks.map((week) => {
                    const progress = weekProgress[week];
                    const isComplete = progress && progress.completed === progress.total && progress.total > 0;

                    return (
                      <TabsTrigger
                        key={week}
                        value={week.toString()}
                        className={cn(
                          "relative px-4 py-2.5 rounded-lg bg-transparent whitespace-nowrap",
                          "data-[state=active]:bg-gradient-to-br data-[state=active]:from-purple-500 data-[state=active]:to-purple-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-purple-500/25",
                          "hover:bg-gray-100 dark:hover:bg-gray-800",
                          "transition-all duration-200"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">Week {week}</span>
                          {progress && progress.total > 0 && (
                            <Badge
                              variant="secondary"
                              className={cn(
                                "text-xs px-1.5 py-0 h-5 border",
                                isComplete
                                  ? "bg-green-500/20 border-green-500/30 text-green-400"
                                  : "bg-gray-500/10 border-gray-500/20 text-gray-400 dark:text-gray-500"
                              )}
                            >
                              {isComplete ? (
                                <Check className="w-3 h-3" />
                              ) : (
                                `${progress.completed}/${progress.total}`
                              )}
                            </Badge>
                          )}
                        </div>
                      </TabsTrigger>
                    );
                  })}
                </TabsList>
              </div>
            </div>

            {weeks.map((week) => {
              const content = weekContent[week];
              const progress = weekProgress[week];
              const progressPercent = progress ? Math.round((progress.completed / progress.total) * 100) : 0;

              return (
                <TabsContent key={week} value={week.toString()} className="space-y-6 mt-6">
                  {/* Week Title with Progress */}
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-5 rounded-xl border-2 border-gray-200 dark:border-gray-800 bg-gradient-to-r from-gray-50 to-white dark:from-gray-900/80 dark:to-gray-900/40">
                    <div className="space-y-1">
                      <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                        Week {week}{content.modules[0]?.title ? `: ${content.modules[0].title}` : ''}
                      </h2>
                      {content.modules[0]?.description && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 max-w-2xl">
                          {content.modules[0].description}
                        </p>
                      )}
                    </div>
                    {progress && progress.total > 0 && (
                      <div className="flex items-center gap-4 px-4 py-3 rounded-xl bg-white dark:bg-gray-900/80 border-2 border-purple-500/20 shadow-sm min-w-[200px]">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-500 dark:text-gray-400 font-medium">Progress</span>
                            <span className="font-bold text-purple-600 dark:text-purple-400">{progressPercent}%</span>
                          </div>
                          <div className="w-full h-2 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-purple-500 to-purple-400 rounded-full transition-all duration-500"
                              style={{ width: `${progressPercent}%` }}
                            />
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {progress.completed} of {progress.total} completed
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Content Sections */}
                  <div className="grid gap-6">
                    <ContentSection
                      title="Recordings"
                      icon={Video}
                      iconColor="text-purple-500"
                      resources={content.recordings}
                      emptyMessage="No recordings available"
                      gradientFrom="from-purple-500"
                      gradientTo="to-purple-600"
                    />

                    <ContentSection
                      title="Presentations"
                      icon={Presentation}
                      iconColor="text-orange-500"
                      resources={content.presentations}
                      emptyMessage="No presentations available"
                      gradientFrom="from-orange-500"
                      gradientTo="to-orange-600"
                    />

                    <ContentSection
                      title="Session Notes"
                      icon={FileText}
                      iconColor="text-blue-500"
                      resources={content.notes}
                      emptyMessage="No session notes available"
                      gradientFrom="from-blue-500"
                      gradientTo="to-blue-600"
                    />

                    <CaseStudiesSection studies={content.caseStudies} />
                  </div>

                  {/* Empty state for week with no content */}
                  {content.recordings.length === 0 &&
                   content.presentations.length === 0 &&
                   content.notes.length === 0 &&
                   content.caseStudies.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-16 rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/30">
                      <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-gray-400 to-gray-500 flex items-center justify-center mb-4 shadow-lg shadow-gray-500/20">
                        <BookOpen className="w-7 h-7 text-white" />
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 text-center font-medium">
                        No content available for this week yet
                      </p>
                    </div>
                  )}
                </TabsContent>
              );
            })}
          </Tabs>
          )}
        </div>
      )}

      {/* Resource Viewer Modal */}
      <Dialog open={!!selectedResource} onOpenChange={() => setSelectedResource(null)}>
        <DialogContent className="max-w-[95vw] w-[95vw] max-h-[95vh] h-[95vh] sm:max-w-[95vw] flex flex-col">
          <DialogHeader className="border-b pb-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 space-y-2">
                <DialogTitle className="flex items-center gap-3 text-xl text-gray-900 dark:text-gray-100">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-md">
                    {selectedResource && getContentIcon(selectedResource.content_type, 'w-5 h-5 text-white')}
                  </div>
                  {selectedResource?.title}
                </DialogTitle>

                {/* Metadata row */}
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  {selectedResource?.session_number && (
                    <Badge variant="secondary">
                      Session {selectedResource.session_number}
                    </Badge>
                  )}
                  {selectedResource?.duration_seconds && (
                    <Badge className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                      <Clock className="w-3 h-3 mr-1" />
                      {formatDuration(selectedResource.duration_seconds)}
                    </Badge>
                  )}
                  {selectedResource?.description && (
                    <p className="text-gray-600 dark:text-gray-400 line-clamp-1">
                      {selectedResource.description}
                    </p>
                  )}
                </div>
              </div>

              {/* Action buttons */}
              {selectedResource && (
                <div className="flex items-center gap-3 mr-12">
                  {/* PDF View/Download buttons - only show for uploaded PDFs */}
                  {hasUploadedFile(selectedResource as ModuleResource) && (
                    <>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => {
                          if (pdfSignedUrl) {
                            window.open(pdfSignedUrl, '_blank');
                          }
                        }}
                        disabled={pdfLoading || !pdfSignedUrl}
                        title="View in new tab"
                        className="transition-all"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => {
                          if (pdfSignedUrl) {
                            const link = document.createElement('a');
                            link.href = pdfSignedUrl;
                            link.download = selectedResource.title + '.pdf';
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                          }
                        }}
                        disabled={pdfLoading || !pdfSignedUrl}
                        title="Download PDF"
                        className="transition-all"
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                    </>
                  )}
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleToggleFavorite(selectedResource.id)}
                    className={cn(
                      "transition-all",
                      favoriteResources.has(selectedResource.id) && "border-yellow-400 bg-yellow-50 dark:bg-yellow-950/20"
                    )}
                  >
                    <Star className={cn(
                      "w-4 h-4 transition-all",
                      favoriteResources.has(selectedResource.id)
                        ? "fill-yellow-400 text-yellow-400"
                        : "text-gray-400 dark:text-gray-500"
                    )} />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleMarkComplete(selectedResource.id)}
                    className={cn(
                      "transition-all",
                      completedResources.has(selectedResource.id) && "border-green-500 bg-green-50 dark:bg-green-950/20"
                    )}
                  >
                    <Check className={cn(
                      "w-4 h-4 transition-all",
                      completedResources.has(selectedResource.id)
                        ? "text-green-500 stroke-[3]"
                        : "text-gray-400 dark:text-gray-500"
                    )} />
                  </Button>
                </div>
              )}
            </div>
          </DialogHeader>

          {/* Content Display with Sidebar */}
          {selectedResource && (
            <div className="flex gap-6 flex-1 min-h-0">
              {/* Main content */}
              <div className="flex-1 min-w-0 relative">
                {iframeLoading && !iframeError && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-900 rounded-lg z-10">
                    <div className="flex flex-col items-center gap-4 p-6 text-center">
                      <Loader2 className="w-10 h-10 animate-spin text-purple-500" />
                      <div>
                        <p className="text-sm text-gray-300 mb-1">
                          {selectedResource.content_type === 'video' ? 'Loading video...' : 'Loading content...'}
                        </p>
                        <p className="text-xs text-gray-500">
                          {selectedResource.content_type === 'video'
                            ? "If video doesn't appear, use the button below"
                            : "Content will appear shortly"}
                        </p>
                      </div>
                      {selectedResource.content_type === 'video' && (
                        <Button
                          onClick={() => {
                            const url = getDirectViewUrl(selectedResource as ModuleResource);
                            window.open(url, '_blank');
                          }}
                          variant="outline"
                          size="sm"
                          className="gap-2 border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
                        >
                          <Youtube className="w-4 h-4" />
                          {isYouTubeUrl((selectedResource as ModuleResource).external_url || '')
                            ? 'Watch on YouTube'
                            : 'Watch in Google Drive'}
                        </Button>
                      )}
                    </div>
                  </div>
                )}
                {iframeError && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-900/95 rounded-lg border-2 border-purple-500/30 z-10">
                    <div className="flex flex-col items-center gap-4 p-6 max-w-lg text-center">
                      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/25">
                        {selectedResource.content_type === 'video' ? (
                          <Video className="w-8 h-8 text-white" />
                        ) : (
                          <FileText className="w-8 h-8 text-white" />
                        )}
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg mb-2 text-white">
                          {selectedResource.content_type === 'video' ? "Video couldn't load here" : "Content couldn't load here"}
                        </h3>
                        <p className="text-sm text-gray-400 mb-2">
                          {selectedResource.content_type === 'video'
                            ? 'This can happen due to browser extensions (ad blockers) or account conflicts.'
                            : 'There was an issue loading this content.'}
                        </p>
                        <p className="text-xs text-gray-500">
                          {selectedResource.content_type === 'video'
                            ? 'Try opening externally, or use an incognito window.'
                            : 'Try opening in a new tab or downloading the file.'}
                        </p>
                      </div>
                      <div className="flex gap-3">
                        {selectedResource.content_type === 'video' ? (
                          <Button
                            onClick={() => {
                              const url = getDirectViewUrl(selectedResource as ModuleResource);
                              window.open(url, '_blank');
                            }}
                            className="gap-2 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700"
                          >
                            <Youtube className="w-4 h-4" />
                            {isYouTubeUrl((selectedResource as ModuleResource).external_url || '')
                              ? 'Watch on YouTube'
                              : 'Watch in Google Drive'}
                          </Button>
                        ) : hasUploadedFile(selectedResource as ModuleResource) && pdfSignedUrl ? (
                          <Button
                            onClick={() => window.open(pdfSignedUrl, '_blank')}
                            className="gap-2 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700"
                          >
                            <ExternalLink className="w-4 h-4" />
                            Open in New Tab
                          </Button>
                        ) : (
                          <Button
                            onClick={() => {
                              const url = getDirectViewUrl(selectedResource as ModuleResource);
                              window.open(url, '_blank');
                            }}
                            className="gap-2 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700"
                          >
                            <ExternalLink className="w-4 h-4" />
                            Open in Google Drive
                          </Button>
                        )}
                        <Button
                          onClick={() => {
                            setIframeError(false);
                            setIframeLoading(true);
                          }}
                          variant="outline"
                          className="border-gray-700 hover:bg-gray-800"
                        >
                          Retry
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
                <iframe
                  src={(() => {
                    const extendedResource = selectedResource as ModuleResource;

                    // For PDFs with file_path (uploaded to Supabase Storage), use the signed URL
                    if (hasUploadedFile(extendedResource)) {
                      console.log('[Learnings] Loading PDF via signed URL:', {
                        title: selectedResource.title,
                        file_path: extendedResource.file_path,
                        signed_url: pdfSignedUrl ? 'loaded' : 'pending'
                      });
                      return pdfSignedUrl || '';
                    }

                    // For videos and legacy content, use getEmbedUrl
                    const url = getEmbedUrl(extendedResource);
                    console.log('[Learnings] Loading iframe:', {
                      title: selectedResource.title,
                      google_drive_id: selectedResource.google_drive_id,
                      external_url: extendedResource.external_url,
                      content_type: selectedResource.content_type,
                      iframe_url: url
                    });
                    return url;
                  })()}
                  onLoad={() => {
                    console.log('[Learnings] Iframe loaded successfully');
                    setIframeLoading(false);
                    setIframeError(false);
                  }}
                  onError={(e) => {
                    console.error('[Learnings] Iframe load error:', e);
                    setIframeLoading(false);
                    setIframeError(true);
                  }}
                  className={cn(
                    "w-full h-full rounded-lg transition-opacity duration-300 bg-black",
                    iframeLoading ? "opacity-0" : "opacity-100"
                  )}
                  allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
                  allowFullScreen
                  title={selectedResource.title}
                />
              </div>

              {/* Related content sidebar */}
              {relatedResources.length > 0 && (
                <div className="w-80 border-l pl-6 overflow-y-auto">
                  <h3 className="font-semibold mb-3 flex items-center gap-2 text-gray-900 dark:text-gray-100">
                    <BookOpen className="w-4 h-4" />
                    More from this week
                  </h3>
                  <div className="space-y-2">
                    {relatedResources.map(resource => (
                      <button
                        key={resource.id}
                        onClick={() => {
                          setSelectedResource(resource);
                          setIframeLoading(true);
                          setIframeError(false);
                        }}
                        className={cn(
                          "w-full p-3 rounded-lg border text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors",
                          selectedResource?.id === resource.id && "bg-purple-50 dark:bg-purple-950/20 border-purple-500"
                        )}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          {getContentIcon(resource.content_type, 'w-4 h-4 text-purple-500')}
                          <p className="font-medium text-sm line-clamp-1 text-gray-900 dark:text-gray-100">{resource.title}</p>
                        </div>
                        {resource.duration_seconds && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDuration(resource.duration_seconds)}
                          </p>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {selectedResource && (() => {
            const extendedResource = selectedResource as ModuleResource;
            const hasPdf = hasUploadedFile(extendedResource);
            const hasExternalContent = selectedResource.google_drive_id || extendedResource.external_url;

            // Show footer only if there's external content or an uploaded PDF
            if (!hasPdf && !hasExternalContent) return null;

            return (
              <div className="flex justify-end border-t border-gray-200 dark:border-gray-800 pt-4">
                {hasPdf ? (
                  // For uploaded PDFs, show View in New Tab button
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (pdfSignedUrl) {
                        window.open(pdfSignedUrl, '_blank');
                      }
                    }}
                    disabled={pdfLoading || !pdfSignedUrl}
                    className="gap-2"
                  >
                    <ExternalLink className="w-4 h-4" />
                    View in New Tab
                  </Button>
                ) : (
                  // For videos and legacy content
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const url = getDirectViewUrl(extendedResource);
                      window.open(url, '_blank');
                    }}
                    className="gap-2"
                  >
                    {selectedResource.content_type === 'video' && isYouTubeUrl(extendedResource.external_url || '') ? (
                      <>
                        <Youtube className="w-4 h-4" />
                        Open on YouTube
                      </>
                    ) : (
                      <>
                        <ExternalLink className="w-4 h-4" />
                        Open in Google Drive
                      </>
                    )}
                  </Button>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Case Study Viewer Modal */}
      <Dialog open={!!selectedCaseStudy} onOpenChange={() => setSelectedCaseStudy(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 pr-8">
              {selectedCaseStudy?.type === 'problem' ? (
                <FileQuestion className="w-5 h-5 text-emerald-500" />
              ) : (
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              )}
              {selectedCaseStudy?.caseStudy.title} - {selectedCaseStudy?.type === 'problem' ? 'Problem' : 'Solution'}
            </DialogTitle>
          </DialogHeader>
          <div className="aspect-video bg-muted rounded-lg overflow-hidden">
            {selectedCaseStudy && (
              <iframe
                src={getCaseStudyEmbedUrl(
                  selectedCaseStudy.type === 'problem'
                    ? selectedCaseStudy.caseStudy.problem_doc_id || ''
                    : selectedCaseStudy.caseStudy.solution_doc_id || '',
                  selectedCaseStudy.type === 'problem'
                    ? selectedCaseStudy.caseStudy.problem_doc_url
                    : selectedCaseStudy.caseStudy.solution_doc_url
                )}
                className="w-full h-full"
                allow="autoplay; fullscreen"
                allowFullScreen
              />
            )}
          </div>
          {selectedCaseStudy && (
            <div className="flex justify-end">
              <Button variant="outline" size="sm" asChild>
                <a
                  href={
                    selectedCaseStudy.type === 'problem'
                      ? selectedCaseStudy.caseStudy.problem_doc_url || ''
                      : selectedCaseStudy.caseStudy.solution_doc_url || ''
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Open in new tab
                </a>
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
