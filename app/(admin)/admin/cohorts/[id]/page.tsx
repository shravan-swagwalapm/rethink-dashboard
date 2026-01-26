'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Copy,
  Loader2,
  Link2,
  Globe,
  Trash2,
  InfoIcon,
  Video,
  FileText,
  CheckCircle,
  HelpCircle,
  AlertTriangle,
  Sparkles,
  BookOpen,
  Users,
} from 'lucide-react';
import type { Cohort, CohortResourceSharingInfo, LearningModuleWithSharing } from '@/types';

interface CohortStats {
  total_modules: number;
  own_modules: number;
  linked_modules: number;
  global_modules: number;
}

export default function CohortSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const cohortId = params.id as string;

  const [cohort, setCohort] = useState<Cohort | null>(null);
  const [stats, setStats] = useState<CohortStats | null>(null);
  const [linkedModules, setLinkedModules] = useState<LearningModuleWithSharing[]>([]);
  const [otherCohorts, setOtherCohorts] = useState<Cohort[]>([]);

  const [loading, setLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [sourceCohortId, setSourceCohortId] = useState<string>('');
  const [sourceModulesCount, setSourceModulesCount] = useState(0);
  const [sourceCohortName, setSourceCohortName] = useState('');

  // Confirmation dialog state
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [moduleToUnlink, setModuleToUnlink] = useState<LearningModuleWithSharing | null>(null);

  useEffect(() => {
    fetchData();
  }, [cohortId]);

  useEffect(() => {
    if (sourceCohortId) {
      fetchSourceModulesCount();
    } else {
      setSourceModulesCount(0);
      setSourceCohortName('');
    }
  }, [sourceCohortId]);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch cohort details
      const cohortResponse = await fetch('/api/admin/cohorts');
      const allCohorts = await cohortResponse.json();
      const currentCohort = allCohorts.find((c: Cohort) => c.id === cohortId);
      setCohort(currentCohort);

      // Filter other cohorts (only active/completed)
      const others = allCohorts.filter(
        (c: Cohort) => c.id !== cohortId && c.status !== 'archived'
      );
      setOtherCohorts(others);

      // Fetch stats
      const statsResponse = await fetch(`/api/admin/cohorts/${cohortId}/stats`);
      const statsData = await statsResponse.json();
      setStats(statsData);

      // Fetch linked modules
      const modulesResponse = await fetch(`/api/admin/learnings?cohort_id=${cohortId}`);
      const modulesData = await modulesResponse.json();

      // Filter to show only linked modules (not own modules)
      const linked = modulesData.modules?.filter(
        (m: LearningModuleWithSharing) => m.cohort_id !== cohortId
      ) || [];
      setLinkedModules(linked);

    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load cohort data. Please refresh the page.');
    } finally {
      setLoading(false);
    }
  };

  const fetchSourceModulesCount = async () => {
    try {
      if (sourceCohortId === 'global') {
        // Count global modules
        const response = await fetch('/api/admin/learnings');
        const data = await response.json();
        const globalCount = data.modules?.filter((m: any) => m.is_global).length || 0;
        setSourceModulesCount(globalCount);
        setSourceCohortName('Global Library');
      } else {
        // Count modules in selected cohort
        const response = await fetch(`/api/admin/learnings?cohort_id=${sourceCohortId}`);
        const data = await response.json();
        const ownModulesCount = data.modules?.filter((m: any) => m.cohort_id === sourceCohortId).length || 0;
        setSourceModulesCount(ownModulesCount);
        const cohortName = otherCohorts.find(c => c.id === sourceCohortId)?.name || '';
        setSourceCohortName(cohortName);
      }
    } catch (error) {
      console.error('Error fetching source modules count:', error);
      setSourceModulesCount(0);
    }
  };

  const handleCopyModules = async () => {
    if (!sourceCohortId) {
      toast.error('Please select a source cohort or library');
      return;
    }

    if (sourceModulesCount === 0) {
      toast.error('No modules available to copy from this source');
      return;
    }

    try {
      setIsLoading(true);

      const response = await fetch(`/api/admin/cohorts/${cohortId}/link-modules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_cohort_id: sourceCohortId,
          module_ids: null, // null = copy all
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to link modules');
      }

      if (result.links_created === 0) {
        toast.info('All modules from this source are already linked to this cohort');
      } else {
        toast.success(`✓ Successfully linked ${result.links_created} module${result.links_created > 1 ? 's' : ''} to ${cohort?.name}`, {
          description: 'Students in this cohort can now access these learning resources',
          duration: 5000,
        });
      }

      // Refresh data
      await fetchData();
      setSourceCohortId('');
    } catch (error) {
      console.error('Error linking modules:', error);
      toast.error('Failed to link modules. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnlinkModuleConfirm = (module: LearningModuleWithSharing) => {
    setModuleToUnlink(module);
    setShowConfirmDialog(true);
  };

  const handleUnlinkModule = async () => {
    if (!moduleToUnlink) return;

    try {
      const response = await fetch(`/api/admin/cohorts/${cohortId}/link-modules`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          module_ids: [moduleToUnlink.id],
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to unlink module');
      }

      toast.success(`✓ Unlinked "${moduleToUnlink.title}" from ${cohort?.name}`, {
        description: 'Students in this cohort will no longer see this module',
      });

      setShowConfirmDialog(false);
      setModuleToUnlink(null);
      await fetchData();
    } catch (error) {
      console.error('Error unlinking module:', error);
      toast.error('Failed to unlink module. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading cohort settings...</p>
      </div>
    );
  }

  if (!cohort) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Cohort Not Found</AlertTitle>
          <AlertDescription>
            The cohort you're looking for doesn't exist or has been deleted.
          </AlertDescription>
        </Alert>
        <Button onClick={() => router.push('/admin/cohorts')} className="mt-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Cohorts
        </Button>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/admin/cohorts')}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Cohorts
          </Button>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold">{cohort.name}</h1>
              <p className="text-muted-foreground mt-1">
                Manage learning resources and content sharing for this cohort
              </p>
            </div>
            <Badge variant={cohort.status === 'active' ? 'default' : 'secondary'}>
              {cohort.status}
            </Badge>
          </div>
        </div>

        {/* Info Banner */}
        <Alert className="border-blue-200 bg-blue-50">
          <InfoIcon className="h-4 w-4 text-blue-600" />
          <AlertTitle className="text-blue-900">Resource Sharing Made Easy</AlertTitle>
          <AlertDescription className="text-blue-800">
            Share learning modules across cohorts without duplicating content. When you link modules,
            any updates to the original will automatically appear in all cohorts using it.
          </AlertDescription>
        </Alert>

        {/* Statistics Grid */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Total Modules
                  </CardTitle>
                  <Tooltip>
                    <TooltipTrigger>
                      <HelpCircle className="w-4 h-4 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>All learning modules accessible to students in this cohort</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stats.total_modules}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Accessible to students
                </p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow border-blue-200">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Own Modules
                  </CardTitle>
                  <Tooltip>
                    <TooltipTrigger>
                      <BookOpen className="w-4 h-4 text-blue-600" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Modules created specifically for this cohort</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-600">{stats.own_modules}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Created for {cohort.name}
                </p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow border-green-200">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Linked Modules
                  </CardTitle>
                  <Tooltip>
                    <TooltipTrigger>
                      <Link2 className="w-4 h-4 text-green-600" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Modules shared from other cohorts</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">{stats.linked_modules}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Shared from other cohorts
                </p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow border-purple-200">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Global Modules
                  </CardTitle>
                  <Tooltip>
                    <TooltipTrigger>
                      <Globe className="w-4 h-4 text-purple-600" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Modules from the global library, accessible to all cohorts</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-purple-600">{stats.global_modules}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  From global library
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Copy Resources Section */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Copy className="w-5 h-5" />
                  Copy Resources from Another Cohort
                </CardTitle>
                <CardDescription className="mt-1.5">
                  Link existing modules to this cohort instead of recreating them. Resources are shared,
                  not duplicated—any updates will sync automatically.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <label className="text-sm font-medium">
                Select Source
                <span className="text-muted-foreground font-normal ml-2">
                  (Choose where to copy modules from)
                </span>
              </label>

              <Select value={sourceCohortId} onValueChange={setSourceCohortId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="🔍 Choose a cohort or the global library..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="global">
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4 text-purple-600" />
                      <span className="font-medium">Global Library</span>
                      <span className="text-muted-foreground text-xs">(Available to all)</span>
                    </div>
                  </SelectItem>
                  {otherCohorts.length > 0 && (
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                      Other Cohorts
                    </div>
                  )}
                  {otherCohorts.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-blue-600" />
                        <span>{c.name}</span>
                        <Badge variant="outline" className="text-xs">
                          {c.tag}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                  {otherCohorts.length === 0 && (
                    <div className="px-2 py-3 text-sm text-muted-foreground text-center">
                      No other cohorts available
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Preview what will be copied */}
            {sourceCohortId && sourceModulesCount > 0 && (
              <Alert className="border-green-200 bg-green-50 animate-in fade-in slide-in-from-top-2 duration-300">
                <Sparkles className="h-4 w-4 text-green-600" />
                <AlertTitle className="text-green-900">Ready to Link</AlertTitle>
                <AlertDescription className="text-green-800 space-y-2">
                  <p>
                    <strong>{sourceModulesCount} module{sourceModulesCount !== 1 ? 's' : ''}</strong> from{' '}
                    <strong>{sourceCohortName}</strong> will be linked to <strong>{cohort.name}</strong>.
                  </p>
                  <ul className="list-disc list-inside text-sm space-y-1 mt-2">
                    <li>Resources will be <strong>shared</strong>, not duplicated</li>
                    <li>Updates to these modules will appear in both cohorts</li>
                    <li>Students will see these modules immediately</li>
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {sourceCohortId && sourceModulesCount === 0 && (
              <Alert className="border-amber-200 bg-amber-50 animate-in fade-in slide-in-from-top-2 duration-300">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <AlertTitle className="text-amber-900">No Modules Available</AlertTitle>
                <AlertDescription className="text-amber-800">
                  <strong>{sourceCohortName}</strong> doesn't have any modules to share yet.
                  {sourceCohortId !== 'global' && ' Try selecting a different cohort or create modules in that cohort first.'}
                </AlertDescription>
              </Alert>
            )}

            <Button
              onClick={handleCopyModules}
              disabled={!sourceCohortId || isLoading || sourceModulesCount === 0}
              className="w-full h-12 text-base"
              size="lg"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Linking modules to {cohort.name}...
                </>
              ) : (
                <>
                  <Copy className="w-5 h-5 mr-2" />
                  Link {sourceModulesCount > 0 ? `${sourceModulesCount} Module${sourceModulesCount !== 1 ? 's' : ''}` : 'Modules'}
                  to {cohort.name}
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Currently Linked Modules List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="w-5 h-5" />
              Currently Linked Modules
              {linkedModules.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {linkedModules.length}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Modules shared from other cohorts or the global library. You can unlink them anytime.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {linkedModules.length > 0 ? (
              <div className="space-y-3">
                {linkedModules.map((module) => (
                  <div
                    key={module.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors group"
                  >
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      {module.is_global ? (
                        <div className="flex-shrink-0">
                          <Badge variant="secondary" className="gap-1.5 bg-purple-100 text-purple-700 border-purple-200">
                            <Globe className="w-3 h-3" />
                            Global
                          </Badge>
                        </div>
                      ) : (
                        <div className="flex-shrink-0">
                          <Badge variant="outline" className="gap-1.5 border-green-200 text-green-700">
                            <Link2 className="w-3 h-3" />
                            Linked
                          </Badge>
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-base truncate">{module.title}</p>
                        <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                          <span>{module.resources?.length || 0} resource{(module.resources?.length || 0) !== 1 ? 's' : ''}</span>
                          {module.week_number && (
                            <>
                              <span>•</span>
                              <span>Week {module.week_number}</span>
                            </>
                          )}
                        </div>

                        {/* Resource preview badges */}
                        {module.resources && module.resources.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {module.resources.slice(0, 3).map(resource => (
                              <Badge key={resource.id} variant="secondary" className="text-xs font-normal">
                                {resource.content_type === 'video' && <Video className="w-3 h-3 mr-1" />}
                                {resource.content_type === 'slides' && <FileText className="w-3 h-3 mr-1" />}
                                {resource.content_type === 'document' && <FileText className="w-3 h-3 mr-1" />}
                                {resource.title.length > 25
                                  ? resource.title.substring(0, 25) + '...'
                                  : resource.title}
                              </Badge>
                            ))}
                            {module.resources.length > 3 && (
                              <Badge variant="secondary" className="text-xs font-normal">
                                +{module.resources.length - 3} more
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleUnlinkModuleConfirm(module)}
                          className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Unlink this module from {cohort.name}</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                ))}
              </div>
            ) : stats && stats.total_modules > 0 ? (
              <Alert>
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertTitle>All Modules Owned by This Cohort</AlertTitle>
                <AlertDescription>
                  This cohort has <strong>{stats.own_modules} module{stats.own_modules !== 1 ? 's' : ''}</strong> that {stats.own_modules === 1 ? 'was' : 'were'} created specifically for it.
                  Use the form above to link modules from other cohorts.
                </AlertDescription>
              </Alert>
            ) : (
              <Alert>
                <InfoIcon className="h-4 w-4" />
                <AlertTitle>No Modules Yet</AlertTitle>
                <AlertDescription className="space-y-2">
                  <p>This cohort doesn't have any learning modules yet. You can:</p>
                  <ul className="list-disc list-inside space-y-1 mt-2">
                    <li>Copy modules from another cohort using the form above</li>
                    <li>Create new modules in the <strong>Learnings</strong> section</li>
                  </ul>
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Unlink Confirmation Dialog */}
        <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                Unlink Module from {cohort.name}?
              </DialogTitle>
              <DialogDescription className="space-y-3 pt-2">
                <p>
                  You're about to unlink <strong>"{moduleToUnlink?.title}"</strong> from {cohort.name}.
                </p>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
                  <p className="text-sm font-medium text-amber-900">What will happen:</p>
                  <ul className="list-disc list-inside text-sm text-amber-800 space-y-1">
                    <li>Students in {cohort.name} will no longer see this module</li>
                    <li>The module will still exist in its original cohort</li>
                    <li>You can re-link it anytime</li>
                  </ul>
                </div>
                <p className="text-sm text-muted-foreground">
                  This won't delete the module—it just removes it from this cohort.
                </p>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowConfirmDialog(false);
                  setModuleToUnlink(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleUnlinkModule}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Unlink Module
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
