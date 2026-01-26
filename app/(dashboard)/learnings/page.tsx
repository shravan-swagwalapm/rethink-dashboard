'use client';

import { useEffect, useState } from 'react';
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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LearningModule, ModuleResource, ModuleResourceType, CaseStudy } from '@/types';
import { VideoPlayer } from '@/components/video/VideoPlayer';

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
    case 'video': return <Video className={cn(iconClass, 'text-purple-500')} />;
    case 'slides': return <Presentation className={cn(iconClass, 'text-orange-500')} />;
    case 'document': return <FileText className={cn(iconClass, 'text-blue-500')} />;
    default: return <Link2 className={cn(iconClass, 'text-gray-500')} />;
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
  const { profile, loading: userLoading } = useUser();
  const [modules, setModules] = useState<ModuleWithResources[]>([]);
  const [caseStudies, setCaseStudies] = useState<CaseStudy[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedResource, setSelectedResource] = useState<ModuleResource | null>(null);
  const [selectedCaseStudy, setSelectedCaseStudy] = useState<{ caseStudy: CaseStudy; type: 'problem' | 'solution' } | null>(null);
  const [activeWeek, setActiveWeek] = useState<string>('');

  useEffect(() => {
    const fetchData = async () => {
      if (!profile?.cohort_id) {
        setLoading(false);
        return;
      }

      const supabase = getClient();

      try {
        // Fetch all modules for the cohort
        const { data: modulesData, error: modulesError } = await supabase
          .from('learning_modules')
          .select('*')
          .eq('cohort_id', profile.cohort_id)
          .order('week_number', { ascending: true })
          .order('order_index', { ascending: true });

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

        // Fetch case studies for the cohort
        const { data: caseStudiesData } = await supabase
          .from('case_studies')
          .select('*')
          .eq('cohort_id', profile.cohort_id)
          .order('week_number', { ascending: true })
          .order('order_index', { ascending: true });

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
  }, [profile, userLoading]);

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

  const handleResourceClick = (resource: ModuleResource) => {
    if (resource.content_type === 'link' && resource.external_url) {
      window.open(resource.external_url, '_blank');
    } else {
      setSelectedResource(resource);
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

  // Content section component
  const ContentSection = ({
    title,
    icon: Icon,
    iconColor,
    resources,
    emptyMessage
  }: {
    title: string;
    icon: React.ElementType;
    iconColor: string;
    resources: ModuleResource[];
    emptyMessage: string;
  }) => {
    const filtered = filterResources(resources);
    if (resources.length === 0 && !searchQuery) return null;

    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Icon className={cn('w-5 h-5', iconColor)} />
          <h3 className="font-semibold">{title}</h3>
          <Badge variant="secondary" className="ml-auto">
            {filtered.length}
          </Badge>
        </div>
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground pl-7">{emptyMessage}</p>
        ) : (
          <div className="space-y-2">
            {filtered.map((resource) => (
              <button
                key={resource.id}
                onClick={() => handleResourceClick(resource)}
                className="w-full flex items-center gap-3 p-3 rounded-lg border hover:bg-muted transition-colors group"
              >
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                  {getContentIcon(resource.content_type)}
                </div>
                <div className="flex-1 text-left min-w-0">
                  <p className="font-medium truncate group-hover:text-primary transition-colors">
                    {resource.title}
                  </p>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    {resource.session_number && (
                      <span>Session {resource.session_number}</span>
                    )}
                    {resource.duration_seconds && (
                      <>
                        {resource.session_number && <span>•</span>}
                        <Clock className="w-3 h-3" />
                        <span>{formatDuration(resource.duration_seconds)}</span>
                      </>
                    )}
                  </div>
                </div>
                {resource.content_type === 'link' ? (
                  <ExternalLink className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                )}
              </button>
            ))}
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
          {/* Week Tabs */}
          <Tabs value={activeWeek} onValueChange={setActiveWeek}>
            <ScrollArea className="w-full">
              <TabsList className="inline-flex h-10 items-center justify-start rounded-lg bg-muted p-1 w-auto">
                {weeks.map((week) => (
                  <TabsTrigger
                    key={week}
                    value={week.toString()}
                    className="px-4"
                  >
                    Week {week}
                  </TabsTrigger>
                ))}
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
                    />

                    <ContentSection
                      title="Presentations"
                      icon={Presentation}
                      iconColor="text-orange-500"
                      resources={content.presentations}
                      emptyMessage="No presentations available"
                    />

                    <ContentSection
                      title="Session Notes"
                      icon={FileText}
                      iconColor="text-blue-500"
                      resources={content.notes}
                      emptyMessage="No session notes available"
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
        <DialogContent className="max-w-7xl max-h-[95vh] w-[95vw]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 pr-8">
              {selectedResource && getContentIcon(selectedResource.content_type)}
              {selectedResource?.title}
            </DialogTitle>
            {selectedResource?.duration_seconds && (
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatDuration(selectedResource.duration_seconds)}
              </p>
            )}
          </DialogHeader>

          {/* Video Player for video content */}
          {selectedResource?.content_type === 'video' && selectedResource.google_drive_id ? (
            <VideoPlayer
              googleDriveId={selectedResource.google_drive_id}
              resourceId={selectedResource.id}
              title={selectedResource.title}
              duration={selectedResource.duration_seconds || undefined}
              thumbnail={selectedResource.thumbnail_url || undefined}
              onProgress={(seconds, percentage) => {
                // Optional: Log progress
                console.log('Video progress:', { seconds, percentage });
              }}
              onComplete={() => {
                // Optional: Handle completion
                console.log('Video completed!');
              }}
            />
          ) : (
            /* Iframe for slides, documents, and videos without Drive ID */
            <div className="aspect-video bg-black rounded-lg overflow-hidden">
              {selectedResource && (
                <iframe
                  src={getEmbedUrl(selectedResource)}
                  className="w-full h-full"
                  allow="autoplay; encrypted-media; fullscreen"
                  allowFullScreen
                />
              )}
            </div>
          )}

          {selectedResource?.external_url && (
            <div className="flex justify-end">
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
