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
  const [weekProgress, setWeekProgress] = useState<Record<number, { completed: number; total: number }>>({});

  useEffect(() => {
    const fetchData = async () => {
      const supabase = getClient();

      try {
        let query = supabase
          .from('learning_modules')
          .select('*')
          .order('week_number', { ascending: true })
          .order('order_index', { ascending: true });

        // FILTERING LOGIC:
        // - Admin role: Show ONLY global library (cohort_id IS NULL)
        // - Student role: Show ONLY modules tagged to active cohort
        if (isAdmin) {
          // Admin: only global library
          query = query.is('cohort_id', null);
        } else {
          // Student: only active cohort
          if (!activeCohortId) {
            setLoading(false);
            return;
          }
          query = query.eq('cohort_id', activeCohortId);
        }

        const { data: modulesData, error: modulesError } = await query;

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
        fetch('/api/learnings/recent?limit=3'),
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

  // Fetch tracking data on mount
  useEffect(() => {
    if (!userLoading && profile) {
      fetchTrackingData();
    }
  }, [userLoading, profile]);

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
        } else if (relatedResources.length > 0 && currentIndex === -1) {
          setSelectedResource(relatedResources[0]);
          setIframeLoading(true);
        }
      } else if (e.key === 'ArrowLeft') {
        // Navigate to previous resource
        const currentIndex = relatedResources.findIndex(r => r.id === selectedResource.id);
        if (currentIndex > 0) {
          setSelectedResource(relatedResources[currentIndex - 1]);
          setIframeLoading(true);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedResource, relatedResources]);

  const handleResourceClick = async (resource: ModuleResource) => {
    if (resource.content_type === 'link' && resource.external_url) {
      window.open(resource.external_url, '_blank');
    } else {
      setSelectedResource(resource);
      setIframeLoading(true);

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

  // Content section component with elevated cards
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
        <div className="flex items-center gap-2">
          <Icon className={cn('w-5 h-5', iconColor)} />
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
          <Badge variant="secondary" className="ml-auto">
            {filtered.length}
          </Badge>
        </div>
        {filtered.length === 0 ? (
          <p className="text-sm text-gray-600 dark:text-gray-400 pl-7">{emptyMessage}</p>
        ) : (
          <div className="space-y-3">
            {filtered.map((resource) => {
              const isCompleted = completedResources.has(resource.id);
              const isFavorite = favoriteResources.has(resource.id);

              return (
                <button
                  key={resource.id}
                  onClick={() => handleResourceClick(resource)}
                  className="relative w-full flex items-center gap-4 p-4 rounded-xl border-2 border-gray-200/50 dark:border-gray-700/50 bg-gradient-to-br from-white to-gray-50/50 dark:from-gray-900 dark:to-gray-800/50 hover:shadow-lg hover:shadow-purple-500/10 dark:hover:shadow-purple-500/20 hover:-translate-y-0.5 transition-all duration-300 group"
                >
                  {/* Favorite button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleFavorite(resource.id);
                    }}
                    className="absolute top-3 left-3 w-7 h-7 rounded-full bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 transition-all hover:scale-110 z-10"
                  >
                    <Star className={cn(
                      "w-3.5 h-3.5",
                      isFavorite ? "fill-yellow-400 text-yellow-400" : "text-gray-400"
                    )} />
                  </button>

                  {/* Completion checkbox */}
                  <div className="absolute top-3 right-3 z-10">
                    {isCompleted ? (
                      <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center shadow-lg">
                        <Check className="w-3.5 h-3.5 text-white" />
                      </div>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMarkComplete(resource.id);
                        }}
                        className="w-6 h-6 rounded-full border-2 border-gray-300 dark:border-gray-600 hover:border-green-500 dark:hover:border-green-400 transition-colors opacity-0 group-hover:opacity-100"
                      />
                    )}
                  </div>

                  {/* Icon container */}
                  <div className={cn(
                    "relative w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center flex-shrink-0 shadow-md group-hover:scale-110 group-hover:shadow-lg transition-all duration-300",
                    gradientFrom, gradientTo
                  )}>
                    {getContentIcon(resource.content_type, 'text-white')}
                  </div>

                  {/* Content */}
                  <div className="flex-1 text-left min-w-0">
                    <p className="font-medium text-gray-900 dark:text-gray-100 truncate group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors mb-1">
                      {resource.title}
                    </p>

                    {/* Metadata row */}
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      {resource.session_number && (
                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800">
                          <Video className="w-3 h-3 text-gray-600 dark:text-gray-400" />
                          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Session {resource.session_number}</span>
                        </div>
                      )}

                      {resource.duration_seconds && (
                        <Badge className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 font-semibold">
                          <Clock className="w-3 h-3 mr-1" />
                          {formatDuration(resource.duration_seconds)}
                        </Badge>
                      )}
                    </div>

                    {/* Description preview */}
                    {resource.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-1">
                        {resource.description}
                      </p>
                    )}
                  </div>

                  {/* Chevron/external link icon */}
                  {resource.content_type === 'link' ? (
                    <ExternalLink className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-gray-400 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all flex-shrink-0" />
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
        <div className="flex items-center gap-2">
          <FileQuestion className="w-5 h-5 text-emerald-500" />
          <h3 className="font-semibold">Case Studies</h3>
          <Badge variant="secondary" className="ml-auto">
            {filtered.length}
          </Badge>
        </div>
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground pl-7">No case studies found</p>
        ) : (
          <div className="space-y-3">
            {filtered.map((cs) => (
              <Card key={cs.id} className="overflow-hidden">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{cs.title}</CardTitle>
                  {cs.description && (
                    <CardDescription>{cs.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {cs.problem_doc_url && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCaseStudyClick(cs, 'problem')}
                      >
                        <FileQuestion className="w-4 h-4 mr-2" />
                        View Problem
                      </Button>
                    )}
                    {cs.solution_visible && cs.solution_doc_url ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCaseStudyClick(cs, 'solution')}
                        className="text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                      >
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        View Solution
                      </Button>
                    ) : cs.solution_doc_url && (
                      <Badge variant="secondary" className="text-muted-foreground">
                        Solution not yet available
                      </Badge>
                    )}
                  </div>
                  {cs.due_date && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="w-4 h-4" />
                      <span>Due: {formatDate(cs.due_date)}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
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
        <div>
          <h1 className="text-2xl font-bold">My Learnings</h1>
          <p className="text-muted-foreground">
            Access course materials, recordings, and presentations
          </p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search content..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {weeks.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <BookOpen className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No content yet</h3>
            <p className="text-muted-foreground text-center max-w-sm">
              Learning content will appear here once your cohort begins. Stay tuned!
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Recent Activity Section */}
          {recentActivity.length > 0 && (
            <Card className="overflow-hidden border-2 border-purple-200 dark:border-purple-800 bg-gradient-to-br from-purple-50 to-white dark:from-purple-950/20 dark:to-gray-900">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-md">
                    <Clock className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-gray-900 dark:text-gray-100">Continue Learning</CardTitle>
                    <CardDescription className="text-gray-600 dark:text-gray-400">Pick up where you left off</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {recentActivity.map((resource: any) => {
                    const isFavorite = favoriteResources.has(resource.id);
                    return (
                      <button
                        key={resource.id}
                        onClick={() => handleResourceClick(resource)}
                        className="relative p-4 rounded-xl border-2 border-purple-200/50 dark:border-purple-700/50 bg-white dark:bg-gray-900 hover:shadow-lg hover:shadow-purple-500/20 hover:-translate-y-0.5 transition-all duration-300 group text-left"
                      >
                        <div className="flex items-start gap-3 mb-3">
                          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-md flex-shrink-0">
                            {getContentIcon(resource.content_type, 'w-4 h-4 text-white')}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 dark:text-gray-100 text-sm line-clamp-2 mb-1">
                              {resource.title}
                            </p>
                            {resource.duration_seconds && (
                              <p className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {formatDuration(resource.duration_seconds)}
                              </p>
                            )}
                          </div>
                          {isFavorite && (
                            <Star className="w-4 h-4 fill-yellow-400 text-yellow-400 flex-shrink-0" />
                          )}
                        </div>
                        {resource.progress?.progress_seconds > 0 && resource.duration_seconds && (
                          <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-purple-500 rounded-full transition-all duration-500"
                              style={{ width: `${Math.min((resource.progress.progress_seconds / resource.duration_seconds) * 100, 100)}%` }}
                            />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Week Tabs with Progress */}
          <Tabs value={activeWeek} onValueChange={setActiveWeek}>
            <ScrollArea className="w-full">
              <TabsList className="inline-flex h-auto items-center justify-start rounded-lg bg-muted p-1 w-auto">
                {weeks.map((week) => {
                  const progress = weekProgress[week];
                  const progressPercent = progress ? Math.round((progress.completed / progress.total) * 100) : 0;

                  return (
                    <TabsTrigger
                      key={week}
                      value={week.toString()}
                      className="px-6 py-2.5 rounded-lg data-[state=active]:bg-gradient-to-br data-[state=active]:from-purple-500 data-[state=active]:to-purple-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-purple-500/30 transition-all duration-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                    >
                      <div className="flex flex-col items-center gap-1">
                        <span className="font-semibold">Week {week}</span>
                        {progress && progress.total > 0 && (
                          <>
                            <div className="w-full h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-purple-500 data-[state=active]:bg-white rounded-full transition-all duration-500"
                                style={{ width: `${progressPercent}%` }}
                              />
                            </div>
                            <span className="text-xs opacity-75">
                              {progress.completed}/{progress.total}
                            </span>
                          </>
                        )}
                      </div>
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </ScrollArea>

            {weeks.map((week) => {
              const content = weekContent[week];
              return (
                <TabsContent key={week} value={week.toString()} className="space-y-6 mt-6">
                  {/* Week Title */}
                  {content.modules[0]?.title && (
                    <div>
                      <h2 className="text-xl font-semibold">
                        Week {week}: {content.modules[0].title}
                      </h2>
                      {content.modules[0]?.description && (
                        <p className="text-muted-foreground mt-1">
                          {content.modules[0].description}
                        </p>
                      )}
                    </div>
                  )}

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
                    <Card>
                      <CardContent className="flex flex-col items-center justify-center py-12">
                        <BookOpen className="w-10 h-10 text-muted-foreground mb-3" />
                        <p className="text-muted-foreground text-center">
                          No content available for this week yet
                        </p>
                      </CardContent>
                    </Card>
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
                {iframeLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-900 rounded-lg z-10">
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
                      <p className="text-sm text-gray-600 dark:text-gray-400">Loading content...</p>
                    </div>
                  </div>
                )}
                <iframe
                  src={selectedResource.google_drive_id
                    ? `https://drive.google.com/file/d/${selectedResource.google_drive_id}/preview`
                    : getEmbedUrl(selectedResource)
                  }
                  onLoad={() => setIframeLoading(false)}
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
