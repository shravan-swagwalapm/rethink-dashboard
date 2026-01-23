'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@/hooks/use-user';
import { getClient } from '@/lib/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { PageLoader } from '@/components/ui/page-loader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Search,
  BookOpen,
  PlayCircle,
  Clock,
  ChevronRight,
  Video,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LearningModule, Recording } from '@/types';

interface ModuleWithRecordings extends LearningModule {
  recordings: Recording[];
}

export default function LearningsPage() {
  const { profile, loading: userLoading } = useUser();
  const [modules, setModules] = useState<ModuleWithRecordings[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRecording, setSelectedRecording] = useState<Recording | null>(null);

  useEffect(() => {
    const fetchModules = async () => {
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

        // Fetch all recordings
        const { data: recordingsData } = await supabase
          .from('recordings')
          .select('*')
          .in('module_id', modulesData?.map((m: LearningModule) => m.id) || [])
          .order('created_at', { ascending: true });

        // Merge recordings with modules
        const modulesWithRecordings = modulesData?.map((module: LearningModule) => ({
          ...module,
          recordings: recordingsData?.filter((r: Recording) => r.module_id === module.id) || [],
        })) || [];

        setModules(modulesWithRecordings);
      } catch (error) {
        console.error('Error fetching modules:', error);
      } finally {
        setLoading(false);
      }
    };

    if (!userLoading) {
      fetchModules();
    }
  }, [profile, userLoading]);

  // Group modules by week
  const modulesByWeek = modules.reduce((acc, module) => {
    const week = module.week_number || 0;
    if (!acc[week]) {
      acc[week] = [];
    }
    acc[week].push(module);
    return acc;
  }, {} as Record<number, ModuleWithRecordings[]>);

  const weeks = Object.keys(modulesByWeek)
    .map(Number)
    .sort((a, b) => a - b);

  // Filter modules based on search
  const filteredModules = searchQuery
    ? modules.filter(
        m =>
          m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          m.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          m.recordings.some(r =>
            r.title.toLowerCase().includes(searchQuery.toLowerCase())
          )
      )
    : modules;

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (userLoading || loading) {
    return <PageLoader message="Loading learnings..." />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">My Learnings</h1>
          <p className="text-muted-foreground">
            Access course materials and recordings
          </p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search modules..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {modules.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <BookOpen className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No modules yet</h3>
            <p className="text-muted-foreground text-center max-w-sm">
              Learning modules will appear here once your cohort begins. Stay tuned!
            </p>
          </CardContent>
        </Card>
      ) : searchQuery ? (
        // Search Results View
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Found {filteredModules.length} result{filteredModules.length !== 1 ? 's' : ''} for &ldquo;{searchQuery}&rdquo;
          </p>
          {filteredModules.map((module) => (
            <Card key={module.id} className="hover-lift">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <Badge variant="secondary" className="mb-2">
                      Week {module.week_number || 'N/A'}
                    </Badge>
                    <CardTitle className="text-lg">{module.title}</CardTitle>
                    {module.description && (
                      <CardDescription className="mt-1">
                        {module.description}
                      </CardDescription>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {module.recordings.length > 0 && (
                  <div className="space-y-2">
                    {module.recordings.map((recording) => (
                      <button
                        key={recording.id}
                        onClick={() => setSelectedRecording(recording)}
                        className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors group"
                      >
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <PlayCircle className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex-1 text-left">
                          <p className="font-medium group-hover:text-primary transition-colors">
                            {recording.title}
                          </p>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            <span>{formatDuration(recording.duration_seconds)}</span>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        // Week-by-Week View
        <Tabs defaultValue={weeks[0]?.toString()} className="space-y-4">
          <ScrollArea className="w-full">
            <TabsList className="inline-flex h-10 items-center justify-start rounded-lg bg-muted p-1 w-auto">
              {weeks.map((week) => (
                <TabsTrigger
                  key={week}
                  value={week.toString()}
                  className="px-4"
                >
                  Week {week || 'Intro'}
                </TabsTrigger>
              ))}
            </TabsList>
          </ScrollArea>

          {weeks.map((week) => (
            <TabsContent key={week} value={week.toString()} className="space-y-4">
              <Accordion type="single" collapsible className="space-y-2">
                {modulesByWeek[week].map((module) => (
                  <AccordionItem
                    key={module.id}
                    value={module.id}
                    className="border rounded-xl overflow-hidden"
                  >
                    <AccordionTrigger className="px-4 hover:no-underline hover:bg-muted/50 [&[data-state=open]]:bg-muted/50">
                      <div className="flex items-center gap-4 text-left">
                        <div className="w-10 h-10 rounded-lg gradient-bg flex items-center justify-center text-white flex-shrink-0">
                          <BookOpen className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-medium">{module.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {module.recordings.length} recording{module.recordings.length !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4">
                      {module.description && (
                        <p className="text-sm text-muted-foreground mb-4 pl-14">
                          {module.description}
                        </p>
                      )}
                      {module.recordings.length === 0 ? (
                        <p className="text-sm text-muted-foreground pl-14">
                          No recordings available yet
                        </p>
                      ) : (
                        <div className="space-y-2 pl-14">
                          {module.recordings.map((recording) => (
                            <button
                              key={recording.id}
                              onClick={() => setSelectedRecording(recording)}
                              className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors group"
                            >
                              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                                <PlayCircle className="w-5 h-5 text-primary" />
                              </div>
                              <div className="flex-1 text-left min-w-0">
                                <p className="font-medium truncate group-hover:text-primary transition-colors">
                                  {recording.title}
                                </p>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <Clock className="w-3 h-3" />
                                  <span>{formatDuration(recording.duration_seconds)}</span>
                                </div>
                              </div>
                              <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                            </button>
                          ))}
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </TabsContent>
          ))}
        </Tabs>
      )}

      {/* Video Player Modal */}
      {selectedRecording && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-4xl">
            <CardHeader className="flex flex-row items-start justify-between">
              <div>
                <CardTitle>{selectedRecording.title}</CardTitle>
                <CardDescription>
                  Duration: {formatDuration(selectedRecording.duration_seconds)}
                </CardDescription>
              </div>
              <button
                onClick={() => setSelectedRecording(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                &times;
              </button>
            </CardHeader>
            <CardContent>
              {selectedRecording.video_url ? (
                <div className="aspect-video bg-black rounded-lg overflow-hidden">
                  <video
                    src={selectedRecording.video_url}
                    controls
                    autoPlay
                    className="w-full h-full"
                  >
                    Your browser does not support video playback.
                  </video>
                </div>
              ) : (
                <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
                  <div className="text-center">
                    <Video className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
                    <p className="text-muted-foreground">Video not available</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
