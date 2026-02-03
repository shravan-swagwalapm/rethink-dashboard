'use client';

import { useEffect, useState, useMemo } from 'react';
import { useUser } from '@/hooks/use-user';
import { getClient } from '@/lib/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageLoader } from '@/components/ui/page-loader';
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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
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

// Get embed URL for Google Drive content
function getEmbedUrl(resource: ModuleResource): string {
  const id = resource.google_drive_id;
  if (!id) return resource.external_url || '';

  switch (resource.content_type) {
    case 'video': return `https://drive.google.com/file/d/${id}/preview`;
    case 'slides': return `https://docs.google.com/presentation/d/${id}/embed?start=false&loop=false&delayms=3000`;
    case 'document': return `https://docs.google.com/document/d/${id}/preview`;
    default: return resource.external_url || '';
  }
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
    }, 10000); // 10 second timeout

    return () => clearTimeout(timeout);
  }, [selectedResource, iframeLoading]);

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

  if (userLoading || loading) {
    return <PageLoader message="Loading learnings..." />;
  }

  const currentWeekContent = activeWeek ? weekContent[parseInt(activeWeek)] : null;

  // Content section component with clean, readable cards
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

    return (
      <div className="space-y-3">
        {/* Section header */}
        <div className="flex items-center gap-3 pb-2 border-b border-gray-200 dark:border-gray-800">
          <div className={cn(
            "w-8 h-8 rounded-lg flex items-center justify-center",
            iconColor === 'text-purple-500' && "bg-purple-100 dark:bg-purple-900/30",
            iconColor === 'text-orange-500' && "bg-orange-100 dark:bg-orange-900/30",
            iconColor === 'text-blue-500' && "bg-blue-100 dark:bg-blue-900/30"
          )}>
            <Icon className={cn('w-4 h-4', iconColor)} />
          </div>
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
          <Badge variant="secondary" className="ml-auto bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
            {filtered.length} {filtered.length === 1 ? 'item' : 'items'}
          </Badge>
        </div>

        {filtered.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 py-4 text-center">{emptyMessage}</p>
        ) : (
          <div className="grid gap-2">
            {filtered.map((resource) => {
              const isCompleted = completedResources.has(resource.id);
              const isFavorite = favoriteResources.has(resource.id);

              return (
                <button
                  key={resource.id}
                  onClick={() => handleResourceClick(resource)}
                  className={cn(
                    "relative w-full flex items-center gap-4 p-3 rounded-lg border bg-white dark:bg-gray-900 text-left transition-all duration-200 group",
                    isCompleted
                      ? "border-green-200 dark:border-green-800/50 bg-green-50/50 dark:bg-green-900/10"
                      : "border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700",
                    "hover:shadow-md hover:-translate-y-px"
                  )}
                >
                  {/* Icon container */}
                  <div className={cn(
                    "w-10 h-10 rounded-lg bg-gradient-to-br flex items-center justify-center flex-shrink-0 shadow-sm group-hover:scale-105 transition-transform",
                    gradientFrom, gradientTo
                  )}>
                    {getContentIcon(resource.content_type, 'w-5 h-5 text-white')}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="font-medium text-gray-900 dark:text-gray-100 truncate group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                        {resource.title}
                      </p>
                      {isFavorite && (
                        <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400 flex-shrink-0" />
                      )}
                    </div>

                    {/* Metadata row */}
                    <div className="flex flex-wrap items-center gap-2">
                      {resource.session_number && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          Session {resource.session_number}
                        </span>
                      )}
                      {resource.session_number && resource.duration_seconds && (
                        <span className="text-gray-300 dark:text-gray-600">•</span>
                      )}
                      {resource.duration_seconds && (
                        <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDuration(resource.duration_seconds)}
                        </span>
                      )}
                      {resource.description && (
                        <>
                          <span className="text-gray-300 dark:text-gray-600">•</span>
                          <span className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[200px]">
                            {resource.description}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Action buttons - visible on hover */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleFavorite(resource.id);
                      }}
                      className={cn(
                        "w-8 h-8 rounded-md flex items-center justify-center transition-colors",
                        isFavorite
                          ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600"
                          : "hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
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
                        "w-8 h-8 rounded-md flex items-center justify-center transition-colors",
                        isCompleted
                          ? "bg-green-100 dark:bg-green-900/30 text-green-600"
                          : "hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      )}
                      title={isCompleted ? "Mark as incomplete" : "Mark as complete"}
                    >
                      <CheckCircle2 className={cn("w-4 h-4", isCompleted && "fill-green-500 text-white")} />
                    </button>
                  </div>

                  {/* Completion indicator (always visible if completed) */}
                  {isCompleted && (
                    <div className="absolute top-1/2 -translate-y-1/2 right-3 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center group-hover:hidden">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}

                  {/* Chevron/external link icon (hidden when completed indicator shown) */}
                  {!isCompleted && (
                    resource.content_type === 'link' ? (
                      <ExternalLink className="w-4 h-4 text-gray-400 flex-shrink-0 group-hover:hidden" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-400 group-hover:translate-x-0.5 transition-transform flex-shrink-0 group-hover:hidden" />
                    )
                  )}
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
      <div className="space-y-3">
        {/* Section header */}
        <div className="flex items-center gap-3 pb-2 border-b border-gray-200 dark:border-gray-800">
          <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
            <FileQuestion className="w-4 h-4 text-emerald-500" />
          </div>
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">Case Studies</h3>
          <Badge variant="secondary" className="ml-auto bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
            {filtered.length} {filtered.length === 1 ? 'study' : 'studies'}
          </Badge>
        </div>

        {filtered.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 py-4 text-center">No case studies found</p>
        ) : (
          <div className="grid gap-3">
            {filtered.map((cs) => (
              <div
                key={cs.id}
                className="p-4 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-gray-300 dark:hover:border-gray-700 transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1">
                    <h4 className="font-medium text-gray-900 dark:text-gray-100">{cs.title}</h4>
                    {cs.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400">{cs.description}</p>
                    )}
                    {cs.due_date && (
                      <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 pt-1">
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
                        className="h-8 text-xs border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                      >
                        <FileQuestion className="w-3.5 h-3.5 mr-1.5" />
                        Problem
                      </Button>
                    )}
                    {cs.solution_visible && cs.solution_doc_url ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCaseStudyClick(cs, 'solution')}
                        className="h-8 text-xs text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                        Solution
                      </Button>
                    ) : cs.solution_doc_url && (
                      <Badge variant="secondary" className="h-8 text-xs bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
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
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-gray-200 dark:border-gray-800">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">My Learnings</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Access your course materials, recordings, and presentations
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search by title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 focus:border-purple-500 dark:focus:border-purple-400 transition-colors"
          />
        </div>
      </div>

      {weeks.length === 0 ? (
        <Card className="border-gray-200 dark:border-gray-800">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
              <BookOpen className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">No content yet</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 text-center max-w-sm">
              Learning content will appear here once your cohort begins. Stay tuned!
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Continue Where You Left Off - Shows actual assets */}
          {recentActivity.length > 0 && (
            <Card className="overflow-hidden border border-gray-200 dark:border-gray-800 bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-950 shadow-sm">
              <CardHeader className="pb-4 border-b border-gray-100 dark:border-gray-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-md">
                      <Clock className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-lg font-semibold text-gray-900 dark:text-gray-100">Continue where you left off</CardTitle>
                      <CardDescription className="text-sm text-gray-500 dark:text-gray-400">
                        {recentActivity.length} recent {recentActivity.length === 1 ? 'asset' : 'assets'}
                      </CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
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
                          "relative p-4 rounded-xl border bg-white dark:bg-gray-900 text-left transition-all duration-200",
                          "hover:shadow-lg hover:-translate-y-0.5 group",
                          "border-gray-200 dark:border-gray-800",
                          "hover:border-gray-300 dark:hover:border-gray-700"
                        )}
                      >
                        {/* Content type badge - top left */}
                        <div className={cn(
                          "absolute top-3 left-3 flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium",
                          resource.content_type === 'video' && "bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300",
                          resource.content_type === 'slides' && "bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300",
                          resource.content_type === 'document' && "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300",
                          !['video', 'slides', 'document'].includes(resource.content_type) && "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                        )}>
                          {getContentIcon(resource.content_type, 'w-3.5 h-3.5')}
                          <span>{typeLabel}</span>
                        </div>

                        {/* Favorite indicator - top right */}
                        {isFavorite && (
                          <Star className="absolute top-3 right-3 w-4 h-4 fill-yellow-400 text-yellow-400" />
                        )}

                        {/* Main content */}
                        <div className="pt-8 space-y-3">
                          {/* Icon and title */}
                          <div className="flex items-start gap-3">
                            <div className={cn(
                              "w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center shadow-sm flex-shrink-0 group-hover:scale-105 transition-transform",
                              gradient.from, gradient.to
                            )}>
                              {getContentIcon(resource.content_type, 'w-6 h-6 text-white')}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm line-clamp-2 leading-tight group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
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
                                  <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                                    <CheckCircle2 className="w-3 h-3" />
                                    <span>Completed</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Progress bar (for videos with progress) */}
                          {resource.progress?.progress_seconds > 0 && resource.duration_seconds && !isCompleted && (
                            <div className="space-y-1">
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-gray-500 dark:text-gray-400">Progress</span>
                                <span className="font-medium text-gray-700 dark:text-gray-300">
                                  {Math.min(Math.round((resource.progress.progress_seconds / resource.duration_seconds) * 100), 100)}%
                                </span>
                              </div>
                              <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                <div
                                  className={cn(
                                    "h-full rounded-full transition-all duration-500",
                                    resource.content_type === 'video' && "bg-purple-500",
                                    resource.content_type === 'slides' && "bg-orange-500",
                                    resource.content_type === 'document' && "bg-blue-500",
                                    !['video', 'slides', 'document'].includes(resource.content_type) && "bg-gray-500"
                                  )}
                                  style={{ width: `${Math.min((resource.progress.progress_seconds / resource.duration_seconds) * 100, 100)}%` }}
                                />
                              </div>
                            </div>
                          )}

                          {/* Click to open hint */}
                          <div className="flex items-center justify-between pt-1 border-t border-gray-100 dark:border-gray-800">
                            <span className="text-xs text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-400 transition-colors">
                              Click to {resource.content_type === 'video' ? 'watch' : resource.content_type === 'slides' ? 'view slides' : 'open'}
                            </span>
                            <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-400 group-hover:translate-x-0.5 transition-all" />
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Week Tabs with Progress */}
          <Tabs value={activeWeek} onValueChange={setActiveWeek}>
            <div className="border-b border-gray-200 dark:border-gray-800">
              <ScrollArea className="w-full pb-px">
                <TabsList className="inline-flex h-auto items-center justify-start bg-transparent p-0 gap-0">
                  {weeks.map((week) => {
                    const progress = weekProgress[week];
                    const progressPercent = progress ? Math.round((progress.completed / progress.total) * 100) : 0;
                    const isComplete = progress && progress.completed === progress.total && progress.total > 0;

                    return (
                      <TabsTrigger
                        key={week}
                        value={week.toString()}
                        className={cn(
                          "relative px-6 py-3 rounded-none border-b-2 border-transparent bg-transparent",
                          "data-[state=active]:border-purple-500 data-[state=active]:text-purple-600 dark:data-[state=active]:text-purple-400",
                          "hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800/50",
                          "transition-all duration-200"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">Week {week}</span>
                          {progress && progress.total > 0 && (
                            <Badge
                              variant="secondary"
                              className={cn(
                                "text-xs px-1.5 py-0 h-5",
                                isComplete
                                  ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                                  : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
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
              </ScrollArea>
            </div>

            {weeks.map((week) => {
              const content = weekContent[week];
              const progress = weekProgress[week];
              const progressPercent = progress ? Math.round((progress.completed / progress.total) * 100) : 0;

              return (
                <TabsContent key={week} value={week.toString()} className="space-y-6 mt-6">
                  {/* Week Title with Progress */}
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800">
                    <div className="space-y-1">
                      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        Week {week}{content.modules[0]?.title ? `: ${content.modules[0].title}` : ''}
                      </h2>
                      {content.modules[0]?.description && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 max-w-2xl">
                          {content.modules[0].description}
                        </p>
                      )}
                    </div>
                    {progress && progress.total > 0 && (
                      <div className="flex items-center gap-4 px-4 py-2 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 min-w-[180px]">
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-500 dark:text-gray-400">Progress</span>
                            <span className="font-semibold text-gray-700 dark:text-gray-300">{progressPercent}%</span>
                          </div>
                          <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-purple-500 rounded-full transition-all duration-500"
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
                    <div className="flex flex-col items-center justify-center py-12 rounded-lg border border-dashed border-gray-300 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50">
                      <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-3">
                        <BookOpen className="w-6 h-6 text-gray-400" />
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                        No content available for this week yet
                      </p>
                    </div>
                  )}
                </TabsContent>
              );
            })}
          </Tabs>
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
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleToggleFavorite(selectedResource.id)}
                  >
                    <Star className={cn(
                      "w-4 h-4",
                      favoriteResources.has(selectedResource.id) ? "fill-yellow-400 text-yellow-400" : ""
                    )} />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleMarkComplete(selectedResource.id)}
                  >
                    <Check className={cn(
                      "w-4 h-4",
                      completedResources.has(selectedResource.id) ? "text-green-500" : ""
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
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-900 rounded-lg z-10">
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
                      <p className="text-sm text-gray-600 dark:text-gray-400">Loading content...</p>
                    </div>
                  </div>
                )}
                {iframeError && (
                  <div className="absolute inset-0 flex items-center justify-center bg-red-50 dark:bg-red-950/20 rounded-lg border-2 border-red-200 dark:border-red-800 z-10">
                    <div className="flex flex-col items-center gap-4 p-6 max-w-md text-center">
                      <AlertCircle className="w-12 h-12 text-red-500" />
                      <div>
                        <h3 className="font-semibold text-lg mb-2 text-gray-900 dark:text-gray-100">Failed to load content</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                          This content couldn't be loaded. This may be due to privacy settings or the file being unavailable.
                        </p>
                      </div>
                      <div className="flex gap-3">
                        <Button
                          onClick={() => {
                            const url = selectedResource.google_drive_id
                              ? `https://drive.google.com/file/d/${selectedResource.google_drive_id}/view`
                              : selectedResource.external_url || getEmbedUrl(selectedResource);
                            window.open(url, '_blank');
                          }}
                          variant="outline"
                          className="gap-2"
                        >
                          <ExternalLink className="w-4 h-4" />
                          Open in new tab
                        </Button>
                        <Button
                          onClick={() => {
                            setIframeError(false);
                            setIframeLoading(true);
                          }}
                          variant="default"
                        >
                          Retry
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
                <iframe
                  src={(() => {
                    const url = selectedResource.google_drive_id
                      ? `https://drive.google.com/file/d/${selectedResource.google_drive_id}/preview`
                      : getEmbedUrl(selectedResource);
                    console.log('[Learnings] Loading iframe:', {
                      title: selectedResource.title,
                      google_drive_id: selectedResource.google_drive_id,
                      external_url: selectedResource.external_url,
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
                    "w-full h-full rounded-lg transition-opacity duration-300",
                    iframeLoading ? "opacity-0" : "opacity-100"
                  )}
                  allow="autoplay; encrypted-media; fullscreen"
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

          {selectedResource?.external_url && (
            <div className="flex justify-end border-t pt-4">
              <Button variant="outline" size="sm" asChild>
                <a href={selectedResource.external_url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Open in new tab
                </a>
              </Button>
            </div>
          )}
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
