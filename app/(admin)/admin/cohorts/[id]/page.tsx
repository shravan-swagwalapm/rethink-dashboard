'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
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

  // Complete Untag dialog state
  const [showUntagDialog, setShowUntagDialog] = useState(false);
  const [isUntagging, setIsUntagging] = useState(false);
  const [confirmText, setConfirmText] = useState('');

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

  const handleCompleteUntag = async () => {
    try {
      setIsUntagging(true);

      // Step 1: Unlink all linked modules
      const unlinkResponse = await fetch(`/api/admin/cohorts/${cohortId}/link-modules`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unlink_all: true }),
      });

      const unlinkResult = await unlinkResponse.json();

      if (!unlinkResponse.ok) {
        throw new Error(unlinkResult.error || 'Failed to unlink modules');
      }

      // Step 2: Convert own modules to global
      const convertResponse = await fetch(`/api/admin/cohorts/${cohortId}/convert-to-global`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ make_global: true }),
      });

      const convertResult = await convertResponse.json();

      if (!convertResponse.ok) {
        throw new Error(convertResult.error || 'Failed to convert modules');
      }

      toast.success(
        `Complete untag successful`,
        {
          description: `Unlinked ${unlinkResult.unlinked_count} modules, converted ${convertResult.converted_count} own modules to global`,
          duration: 5000,
        }
      );

      setShowUntagDialog(false);
      setConfirmText('');
      await fetchData();
    } catch (error) {
      console.error('Error during complete untag:', error);
      toast.error('Failed to complete untag. Please try again.');
    } finally {
      setIsUntagging(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="relative">
          <Loader2 className="w-12 h-12 animate-spin text-primary" />
          <div className="absolute inset-0 w-12 h-12 rounded-full border-2 border-primary/20"></div>
        </div>
        <div className="text-center">
          <p className="text-base font-medium text-foreground">Loading cohort settings...</p>
          <p className="text-sm text-muted-foreground mt-1">Fetching modules and statistics</p>
        </div>
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

        {/* Statistics Grid - Hero + Secondary Layout */}
        {stats && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Hero Card - Total Modules */}
            <Card className="lg:col-span-3 hover:shadow-lg transition-all border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg font-medium text-muted-foreground">
                      Total Modules Available
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      All learning content accessible to students in this cohort
                    </p>
                  </div>
                  <Tooltip>
                    <TooltipTrigger>
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <BookOpen className="w-6 h-6 text-primary" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Sum of own, linked, and global modules</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-end gap-4">
                  <div className="text-5xl font-bold">{stats.total_modules}</div>
                  <div className="flex items-center gap-3 mb-2 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <BookOpen className="w-4 h-4 text-blue-600" />
                      {stats.own_modules} own
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Link2 className="w-4 h-4 text-green-600" />
                      {stats.linked_modules} linked
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Globe className="w-4 h-4 text-purple-600" />
                      {stats.global_modules} global
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Secondary Cards - 3 Column Grid */}
            <Card className="hover:shadow-md transition-shadow border-blue-200 bg-blue-50/50">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Own Modules
                  </CardTitle>
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                    <BookOpen className="w-5 h-5 text-blue-600" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold text-blue-600">{stats.own_modules}</div>
                <p className="text-xs text-muted-foreground mt-2">
                  Created specifically for {cohort.name}
                </p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow border-green-200 bg-green-50/50">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Linked Modules
                  </CardTitle>
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                    <Link2 className="w-5 h-5 text-green-600" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold text-green-600">{stats.linked_modules}</div>
                <p className="text-xs text-muted-foreground mt-2">
                  Shared from other cohorts
                </p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow border-purple-200 bg-purple-50/50">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Global Modules
                  </CardTitle>
                  <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                    <Globe className="w-5 h-5 text-purple-600" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold text-purple-600">{stats.global_modules}</div>
                <p className="text-xs text-muted-foreground mt-2">
                  From global library
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Link Resources Section */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Link2 className="w-5 h-5" />
                  Link Resources from Another Cohort
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
                  (Choose where to link modules from)
                </span>
              </label>

              <Select value={sourceCohortId} onValueChange={setSourceCohortId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose a source..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="global">
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4 text-purple-600" />
                      <span className="font-medium">Global Library</span>
                      <span className="text-muted-foreground text-xs">Shared across all cohorts</span>
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
                  <Link2 className="w-5 h-5 mr-2" />
                  Link {sourceModulesCount > 0 ? `${sourceModulesCount} Module${sourceModulesCount !== 1 ? 's' : ''}` : 'Modules'}
                  to {cohort.name}
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Complete Untag Section */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                  Complete Untag
                </CardTitle>
                <CardDescription className="mt-1.5">
                  Remove all linked modules and convert this cohort's own modules to global library.
                  This makes the cohort a clean slate while preserving all content.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert className="border-amber-200 bg-amber-50">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertTitle className="text-amber-900">Irreversible Action</AlertTitle>
              <AlertDescription className="text-amber-800 space-y-2">
                <p className="font-medium">This action will:</p>
                <ul className="list-disc list-inside text-sm space-y-1">
                  <li>Unlink all {stats?.linked_modules || 0} linked modules from other cohorts</li>
                  <li>Convert {stats?.own_modules || 0} own modules to global library (accessible to all cohorts)</li>
                  <li>Leave this cohort with 0 modules initially (you can re-link from global library)</li>
                </ul>
                <p className="text-sm mt-2">
                  <strong>Note:</strong> No content will be deleted—modules will be moved to the global library.
                </p>
              </AlertDescription>
            </Alert>

            <Button
              variant="destructive"
              onClick={() => setShowUntagDialog(true)}
              disabled={!stats || (stats.linked_modules === 0 && stats.own_modules === 0)}
              className="w-full"
            >
              <AlertTriangle className="w-4 h-4 mr-2" />
              Complete Untag {cohort?.name}
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
              <div className="space-y-4">
                {linkedModules.map((module) => (
                  <div
                    key={module.id}
                    className="flex items-center justify-between p-5 border rounded-lg hover:bg-gray-50 transition-colors group"
                  >
                    <div className="flex items-center gap-5 flex-1 min-w-0">
                      {module.is_global ? (
                        <div className="flex-shrink-0">
                          <Badge className="gap-1.5 bg-purple-600 text-white hover:bg-purple-700">
                            <Globe className="w-3 h-3" />
                            Global
                          </Badge>
                        </div>
                      ) : (
                        <div className="flex-shrink-0">
                          <Badge className="gap-1.5 bg-green-600 text-white hover:bg-green-700">
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

                        {/* Resource preview badges with color coding */}
                        {module.resources && module.resources.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-3">
                            {module.resources.slice(0, 3).map(resource => (
                              <Badge
                                key={resource.id}
                                className="text-xs font-normal py-1 px-2.5"
                                style={{
                                  backgroundColor:
                                    resource.content_type === 'video' ? '#f3e8ff' : // purple-100
                                    resource.content_type === 'slides' ? '#fed7aa' : // orange-100
                                    resource.content_type === 'document' ? '#dbeafe' : // blue-100
                                    '#f3f4f6', // gray-100
                                  color:
                                    resource.content_type === 'video' ? '#7c3aed' : // purple-600
                                    resource.content_type === 'slides' ? '#ea580c' : // orange-600
                                    resource.content_type === 'document' ? '#2563eb' : // blue-600
                                    '#6b7280', // gray-600
                                }}
                              >
                                {resource.content_type === 'video' && <Video className="w-3 h-3 mr-1.5" />}
                                {resource.content_type === 'slides' && <FileText className="w-3 h-3 mr-1.5" />}
                                {resource.content_type === 'document' && <FileText className="w-3 h-3 mr-1.5" />}
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
              <Alert className="border-blue-200 bg-blue-50">
                <CheckCircle className="h-5 w-5 text-blue-600" />
                <AlertTitle className="text-blue-900 text-base font-semibold">All Modules Owned by This Cohort</AlertTitle>
                <AlertDescription className="text-blue-800">
                  <p className="mb-3">
                    This cohort has <strong className="font-bold">{stats.own_modules} module{stats.own_modules !== 1 ? 's' : ''}</strong> that {stats.own_modules === 1 ? 'was' : 'were'} created specifically for it.
                  </p>
                  <div className="bg-white rounded-md p-3 border border-blue-200">
                    <p className="text-sm font-medium text-blue-900 mb-2">Want to add more content?</p>
                    <ul className="list-disc list-inside space-y-1 text-sm">
                      <li>Link modules from another cohort using the form above</li>
                      <li>Access global library modules automatically</li>
                      <li>Create new modules in the <strong>Learnings</strong> section</li>
                    </ul>
                  </div>
                </AlertDescription>
              </Alert>
            ) : (
              <Alert className="border-amber-200 bg-amber-50">
                <InfoIcon className="h-5 w-5 text-amber-600" />
                <AlertTitle className="text-amber-900 text-base font-semibold">No Modules Yet</AlertTitle>
                <AlertDescription className="text-amber-800 space-y-3">
                  <p>This cohort doesn't have any learning modules yet. Get started by:</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                    <div className="bg-white rounded-md p-3 border border-amber-200">
                      <p className="font-medium text-amber-900 mb-1 flex items-center gap-2">
                        <Link2 className="w-4 h-4" />
                        Link from Other Cohorts
                      </p>
                      <p className="text-sm">Link modules from another cohort using the form above</p>
                    </div>
                    <div className="bg-white rounded-md p-3 border border-amber-200">
                      <p className="font-medium text-amber-900 mb-1 flex items-center gap-2">
                        <BookOpen className="w-4 h-4" />
                        Create New Modules
                      </p>
                      <p className="text-sm">Go to the <strong>Learnings</strong> section to create custom content</p>
                    </div>
                  </div>
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

        {/* Complete Untag Confirmation Dialog */}
        <Dialog open={showUntagDialog} onOpenChange={setShowUntagDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                Confirm Complete Untag
              </DialogTitle>
              <DialogDescription className="space-y-3 pt-2">
                <p>
                  You are about to perform a <strong>Complete Untag</strong> on <strong>{cohort?.name}</strong>.
                </p>

                <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-2">
                  <p className="text-sm font-medium text-red-900">What will happen:</p>
                  <ol className="list-decimal list-inside text-sm text-red-800 space-y-1">
                    <li><strong>{stats?.linked_modules || 0} linked modules</strong> will be unlinked from this cohort</li>
                    <li><strong>{stats?.own_modules || 0} own modules</strong> will be converted to global library</li>
                    <li>This cohort will have <strong>0 modules</strong> after this operation</li>
                    <li>Students will temporarily lose access to all learning content</li>
                  </ol>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm text-blue-900">
                    <strong>Good news:</strong> No content will be deleted. All modules will be available in the global library,
                    and you can re-link them to this cohort anytime.
                  </p>
                </div>

                <p className="text-sm text-muted-foreground">
                  Type <strong>UNTAG</strong> below to confirm:
                </p>
                <Input
                  placeholder="Type UNTAG to confirm"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                />
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowUntagDialog(false);
                  setConfirmText('');
                }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleCompleteUntag}
                disabled={confirmText !== 'UNTAG' || isUntagging}
              >
                {isUntagging ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-4 h-4 mr-2" />
                    Complete Untag
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
