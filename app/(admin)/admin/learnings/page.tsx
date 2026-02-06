'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PageLoader } from '@/components/ui/page-loader';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Plus,
  BookOpen,
  Pencil,
  Trash2,
  Globe,
  Info,
} from 'lucide-react';
import type { Cohort, LearningModule, ModuleResource, LearningModuleWithResources, CaseStudy } from '@/types';
import { ResourcePreviewModal } from '@/components/learnings';

import { GLOBAL_LIBRARY_ID } from './utils';
import { ModuleFormDialog } from './components/module-form-dialog';
import type { ModuleFormData } from './components/module-form-dialog';
import { ResourceFormDialog } from './components/resource-form-dialog';
import type { ResourceFormData } from './components/resource-form-dialog';
import { CaseStudyFormDialog } from './components/case-study-form-dialog';
import type { CaseStudyFormData } from './components/case-study-form-dialog';
import { ResourceSection } from './components/resource-section';
import { CaseStudySection } from './components/case-study-section';

export default function LearningsPage() {
  const [modules, setModules] = useState<LearningModuleWithResources[]>([]);
  const [caseStudies, setCaseStudies] = useState<CaseStudy[]>([]);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [selectedCohort, setSelectedCohort] = useState<string>('');
  const [selectedWeek, setSelectedWeek] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cohortStats, setCohortStats] = useState<any>(null);

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    recordings: true,
    slides: true,
    documents: true,
    caseStudies: true,
  });

  // Dialog visibility
  const [showModuleForm, setShowModuleForm] = useState(false);
  const [editingModule, setEditingModule] = useState<LearningModule | null>(null);
  const [moduleInitialData, setModuleInitialData] = useState<ModuleFormData | null>(null);

  const [showResourceForm, setShowResourceForm] = useState(false);
  const [editingResource, setEditingResource] = useState<ModuleResource | null>(null);
  const [targetModuleId, setTargetModuleId] = useState<string>('');
  const [resourceInitialData, setResourceInitialData] = useState<ResourceFormData | null>(null);

  const [showCaseStudyForm, setShowCaseStudyForm] = useState(false);
  const [editingCaseStudy, setEditingCaseStudy] = useState<CaseStudy | null>(null);

  // Preview modal
  const [previewResource, setPreviewResource] = useState<ModuleResource | null>(null);
  const [previewCaseStudy, setPreviewCaseStudy] = useState<{ url: string; title: string } | null>(null);

  const hasFetchedCohortsRef = useRef(false);

  // --- Data fetching ---

  const fetchCohorts = useCallback(async (force = false) => {
    if (hasFetchedCohortsRef.current && !force) return;
    hasFetchedCohortsRef.current = true;

    try {
      const response = await fetch('/api/admin/cohorts');
      const data = await response.json();
      const cohortsList = Array.isArray(data) ? data : (data.cohorts || []);
      setCohorts(cohortsList);
      if (cohortsList.length > 0) {
        setSelectedCohort(prev => prev || cohortsList[0].id);
      } else {
        setLoading(false);
      }
    } catch (error) {
      console.error('Error fetching cohorts:', error);
      setLoading(false);
    }
  }, []);

  const fetchCohortStats = useCallback(async () => {
    if (!selectedCohort || selectedCohort === GLOBAL_LIBRARY_ID) {
      setCohortStats(null);
      return;
    }

    try {
      const response = await fetch(`/api/admin/cohorts/${selectedCohort}/stats`);
      if (response.ok) {
        const data = await response.json();
        setCohortStats(data);
      }
    } catch (error) {
      console.error('Error fetching cohort stats:', error);
    }
  }, [selectedCohort]);

  const fetchModules = useCallback(async () => {
    if (!selectedCohort) return;

    try {
      let url;
      if (selectedCohort === GLOBAL_LIBRARY_ID) {
        url = '/api/admin/learnings?is_global=true';
      } else {
        url = `/api/admin/learnings?cohort_id=${selectedCohort}&show_own=true`;
      }

      const response = await fetch(url);
      const data = await response.json();
      setModules(data.modules || []);

      const weeks = [...new Set((data.modules || []).map((m: LearningModule) => m.week_number).filter(Boolean))].sort((a, b) => (a as number) - (b as number));
      if (weeks.length > 0) {
        setSelectedWeek(prev => prev || weeks[0]?.toString() || '');
      }
    } catch (error) {
      console.error('Error fetching modules:', error);
      toast.error('Failed to fetch modules');
    }
  }, [selectedCohort]);

  const fetchCaseStudies = useCallback(async () => {
    if (!selectedCohort) return;

    try {
      const response = await fetch(`/api/admin/case-studies?cohort_id=${selectedCohort}`);
      const data = await response.json();
      setCaseStudies(data.caseStudies || []);
    } catch (error) {
      console.error('Error fetching case studies:', error);
    }
  }, [selectedCohort]);

  useEffect(() => {
    fetchCohorts();
  }, [fetchCohorts]);

  useEffect(() => {
    if (selectedCohort) {
      setLoading(true);
      Promise.all([fetchModules(), fetchCaseStudies(), fetchCohortStats()]).finally(() => setLoading(false));
    }
  }, [selectedCohort, fetchModules, fetchCaseStudies, fetchCohortStats]);

  // --- Derived data ---

  const weeks = useMemo(() =>
    [...new Set(modules.map(m => m.week_number).filter(Boolean))].sort((a, b) => (a as number) - (b as number)),
    [modules]
  );
  const currentWeekModule = useMemo(() => modules.find(m => m.week_number?.toString() === selectedWeek), [modules, selectedWeek]);
  const weekResources = currentWeekModule?.resources || [];
  const { recordings, slides, documents } = useMemo(() => ({
    recordings: weekResources.filter(r => r.content_type === 'video'),
    slides: weekResources.filter(r => r.content_type === 'slides'),
    documents: weekResources.filter(r => r.content_type === 'document'),
  }), [weekResources]);
  const weekCaseStudies = useMemo(() => caseStudies.filter(cs => cs.week_number?.toString() === selectedWeek), [caseStudies, selectedWeek]);

  // --- Module CRUD ---

  const handleSaveModule = async (data: ModuleFormData) => {
    if (!data.title.trim() || !data.week_number) {
      toast.error('Title and week number are required');
      return;
    }

    setSaving(true);
    try {
      if (editingModule) {
        const response = await fetch('/api/admin/learnings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'module',
            id: editingModule.id,
            title: data.title,
            description: data.description,
            week_number: data.week_number ? parseInt(data.week_number) : null,
            order_index: data.order_index,
          }),
        });
        if (!response.ok) throw new Error('Failed to update module');
        toast.success('Week updated');
      } else {
        const isGlobalLibrary = selectedCohort === GLOBAL_LIBRARY_ID;
        const response = await fetch('/api/admin/learnings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'module',
            title: data.title,
            description: data.description,
            week_number: parseInt(data.week_number),
            order_index: data.order_index,
            cohort_id: isGlobalLibrary ? null : selectedCohort,
            is_global: isGlobalLibrary,
          }),
        });
        if (!response.ok) throw new Error('Failed to create module');
        toast.success(isGlobalLibrary ? 'Global module created' : 'Week created');
        setSelectedWeek(data.week_number);
      }

      setShowModuleForm(false);
      setEditingModule(null);
      fetchModules();
    } catch (error) {
      console.error('Error saving module:', error);
      toast.error(editingModule ? 'Failed to update week' : 'Failed to create week');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteModule = async (moduleId: string) => {
    if (!confirm('Delete this week? All resources in it will also be deleted.')) return;

    try {
      const response = await fetch(`/api/admin/learnings?id=${moduleId}&type=module`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete module');
      toast.success('Week deleted');
      fetchModules();
    } catch (error) {
      console.error('Error deleting module:', error);
      toast.error('Failed to delete week');
    }
  };

  const handleDeleteResource = async (resourceId: string) => {
    if (!confirm('Delete this resource?')) return;

    try {
      const response = await fetch(`/api/admin/learnings?id=${resourceId}&type=resource`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete resource');
      toast.success('Resource deleted');
      fetchModules();
    } catch (error) {
      console.error('Error deleting resource:', error);
      toast.error('Failed to delete resource');
    }
  };

  // --- Case Study CRUD ---

  const handleSaveCaseStudy = async (data: CaseStudyFormData) => {
    if (!data.title.trim()) {
      toast.error('Title is required');
      return;
    }

    setSaving(true);
    try {
      if (editingCaseStudy) {
        const response = await fetch('/api/admin/case-studies', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingCaseStudy.id,
            title: data.title,
            description: data.description,
            problem_doc_url: data.problem_doc_url,
            solution_doc_url: data.solution_doc_url,
            solution_visible: data.solution_visible,
            due_date: data.due_date || null,
          }),
        });
        if (!response.ok) throw new Error('Failed to update case study');
        toast.success('Case study updated');
      } else {
        const response = await fetch('/api/admin/case-studies', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cohort_id: selectedCohort,
            week_number: parseInt(selectedWeek),
            title: data.title,
            description: data.description,
            problem_doc_url: data.problem_doc_url,
            solution_doc_url: data.solution_doc_url,
            solution_visible: data.solution_visible,
            due_date: data.due_date || null,
          }),
        });
        if (!response.ok) throw new Error('Failed to create case study');
        toast.success('Case study created');
      }

      setShowCaseStudyForm(false);
      setEditingCaseStudy(null);
      fetchCaseStudies();
    } catch (error) {
      console.error('Error saving case study:', error);
      toast.error(editingCaseStudy ? 'Failed to update case study' : 'Failed to create case study');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCaseStudy = async (caseStudyId: string) => {
    if (!confirm('Delete this case study?')) return;

    try {
      const response = await fetch(`/api/admin/case-studies?id=${caseStudyId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete case study');
      toast.success('Case study deleted');
      fetchCaseStudies();
    } catch (error) {
      console.error('Error deleting case study:', error);
      toast.error('Failed to delete case study');
    }
  };

  const toggleSolutionVisibility = async (caseStudy: CaseStudy) => {
    try {
      const response = await fetch('/api/admin/case-studies', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: caseStudy.id, solution_visible: !caseStudy.solution_visible }),
      });
      if (!response.ok) throw new Error('Failed to update');
      toast.success(caseStudy.solution_visible ? 'Solution hidden' : 'Solution visible');
      fetchCaseStudies();
    } catch (error) {
      console.error('Error toggling visibility:', error);
      toast.error('Failed to update visibility');
    }
  };

  // --- Open helpers ---

  const openAddWeek = () => {
    setEditingModule(null);
    const nextWeek = weeks.length > 0 ? Math.max(...weeks.map(w => w as number)) + 1 : 1;
    setModuleInitialData({ title: `Week ${nextWeek}`, description: '', week_number: nextWeek.toString(), order_index: 0 });
    setShowModuleForm(true);
  };

  const openEditModule = (module: LearningModule) => {
    setEditingModule(module);
    setModuleInitialData(null);
    setShowModuleForm(true);
  };

  const openAddResource = (contentType: 'video' | 'slides' | 'document' | 'link') => {
    if (!currentWeekModule) {
      toast.error('Please create a week first');
      return;
    }
    setTargetModuleId(currentWeekModule.id);
    setEditingResource(null);
    setResourceInitialData({
      title: '',
      youtube_url: '',
      content_type: contentType,
      duration_seconds: '',
      session_number: '',
      order_index: weekResources.filter(r => r.content_type === contentType).length,
    });
    setShowResourceForm(true);
  };

  const openEditResource = (resource: ModuleResource) => {
    setEditingResource(resource);
    setTargetModuleId(resource.module_id || '');
    setResourceInitialData({
      title: resource.title,
      youtube_url: resource.external_url || '',
      content_type: resource.content_type,
      duration_seconds: resource.duration_seconds?.toString() || '',
      session_number: resource.session_number?.toString() || '',
      order_index: resource.order_index || 0,
    });
    setShowResourceForm(true);
  };

  const openAddCaseStudy = () => {
    if (!selectedWeek) {
      toast.error('Please select a week first');
      return;
    }
    setEditingCaseStudy(null);
    setShowCaseStudyForm(true);
  };

  const openEditCaseStudy = (caseStudy: CaseStudy) => {
    setEditingCaseStudy(caseStudy);
    setShowCaseStudyForm(true);
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  if (loading) {
    return <PageLoader message="Loading learnings..." />;
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 pb-6 border-b border-border">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {selectedCohort === GLOBAL_LIBRARY_ID ? (
              <span className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-500/10 dark:bg-purple-500/20 flex items-center justify-center">
                  <Globe className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
                <span className="dark:text-white">Global Library</span>
              </span>
            ) : (
              <span className="dark:text-white">Learning Content</span>
            )}
          </h1>
          <p className="text-base text-gray-600 dark:text-gray-300 mt-2">
            {selectedCohort === GLOBAL_LIBRARY_ID
              ? 'Create modules accessible to all cohorts'
              : 'Manage recordings, presentations, notes, and case studies'
            }
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedCohort} onValueChange={(value) => { setSelectedCohort(value); setSelectedWeek(''); }}>
            <SelectTrigger className="w-[220px] h-11 font-medium border-2 dark:border-gray-700 dark:bg-gray-900 dark:text-white">
              <SelectValue placeholder="Select cohort" />
            </SelectTrigger>
            <SelectContent className="dark:bg-gray-900 dark:border-gray-700">
              <SelectItem value={GLOBAL_LIBRARY_ID} className="dark:text-white dark:focus:bg-gray-800">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  <span className="font-medium">Global Library</span>
                </div>
              </SelectItem>
              {cohorts.length > 0 && (
                <div className="border-t my-1 dark:border-gray-700" />
              )}
              {cohorts.map((cohort) => (
                <SelectItem key={cohort.id} value={cohort.id} className="dark:text-white dark:focus:bg-gray-800">
                  {cohort.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Link Status Alert */}
      {cohortStats && cohortStats.active_source !== 'own' && (
        <Alert className="border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 animate-in fade-in slide-in-from-top-2 duration-300">
          <Info className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <AlertDescription className="text-sm text-amber-800 dark:text-amber-200">
            <div className="flex flex-col gap-1">
              <p className="font-medium">
                {'\u2139\uFE0F'} This cohort is linked to{' '}
                {cohortStats.active_source === 'global' ? (
                  <span className="font-semibold text-purple-700 dark:text-purple-400">Global Library</span>
                ) : (
                  <span className="font-semibold text-green-700 dark:text-green-400">{cohortStats.linked_cohort_name}</span>
                )}
              </p>
              <p className="text-xs">
                Students see <strong>{cohortStats.visible_modules} modules</strong> from the linked source.
                {cohortStats.own_modules > 0 && (
                  <span> Your {cohortStats.own_modules} own module{cohortStats.own_modules !== 1 ? 's' : ''} below {cohortStats.own_modules !== 1 ? 'are' : 'is'} hidden from students but can still be managed here.</span>
                )}
              </p>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Week Tabs */}
      <Card className="border-2 dark:border-gray-800 dark:bg-gray-950/50 shadow-sm">
        <CardHeader className="pb-4 border-b dark:border-gray-800">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl font-semibold dark:text-white flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              Weeks
            </CardTitle>
            <Button
              size="sm"
              onClick={openAddWeek}
              className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white shadow-sm transition-all hover:shadow-md"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Add Week
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-5">
          {weeks.length === 0 ? (
            <div className="text-center py-12 px-4 rounded-lg border-2 border-dashed dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50">
              <div className="w-16 h-16 rounded-full bg-blue-500/10 dark:bg-blue-500/20 flex items-center justify-center mx-auto mb-4">
                <BookOpen className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              </div>
              <p className="text-lg font-semibold dark:text-white mb-2">No weeks created yet</p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
                Create your first week to start adding content
              </p>
              <Button
                onClick={openAddWeek}
                className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white shadow-sm transition-all hover:shadow-md"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Week 1
              </Button>
            </div>
          ) : (
            <Tabs value={selectedWeek} onValueChange={setSelectedWeek}>
              <ScrollArea className="w-full">
                <TabsList className="inline-flex h-12 items-center justify-start rounded-lg bg-gray-100 dark:bg-gray-900 p-1.5 w-auto border dark:border-gray-800">
                  {weeks.map((week) => (
                    <TabsTrigger
                      key={week}
                      value={week?.toString() || ''}
                      className="px-5 h-9 font-medium dark:text-gray-300 dark:data-[state=active]:bg-blue-600 dark:data-[state=active]:text-white data-[state=active]:shadow-sm transition-all"
                    >
                      Week {week}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </ScrollArea>
            </Tabs>
          )}
        </CardContent>
      </Card>

      {/* Week Content */}
      {selectedWeek && currentWeekModule && (
        <div className="space-y-6">
          {/* Week Header */}
          <div className="flex items-center justify-between p-6 rounded-lg border-2 dark:border-gray-800 bg-gradient-to-r from-blue-50/50 to-purple-50/50 dark:from-blue-950/20 dark:to-purple-950/20">
            <div>
              <h2 className="text-2xl font-bold dark:text-white">{currentWeekModule.title}</h2>
              {currentWeekModule.description && (
                <p className="text-gray-600 dark:text-gray-300 text-sm mt-1.5">{currentWeekModule.description}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => openEditModule(currentWeekModule)}
                className="border-2 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:hover:bg-gray-800 transition-all hover:shadow-sm"
              >
                <Pencil className="w-4 h-4 mr-1.5" />
                Edit Week
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all"
                onClick={() => handleDeleteModule(currentWeekModule.id)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <ResourceSection
            sectionKey="recordings"
            expanded={expandedSections.recordings}
            onToggle={() => toggleSection('recordings')}
            resources={recordings}
            onAdd={() => openAddResource('video')}
            onPreview={(resource) => setPreviewResource(resource)}
            onEdit={(resource) => openEditResource(resource)}
            onDelete={(resourceId) => handleDeleteResource(resourceId)}
          />

          <ResourceSection
            sectionKey="slides"
            expanded={expandedSections.slides}
            onToggle={() => toggleSection('slides')}
            resources={slides}
            onAdd={() => openAddResource('slides')}
            onPreview={(resource) => setPreviewResource(resource)}
            onEdit={(resource) => openEditResource(resource)}
            onDelete={(resourceId) => handleDeleteResource(resourceId)}
          />

          <ResourceSection
            sectionKey="documents"
            expanded={expandedSections.documents}
            onToggle={() => toggleSection('documents')}
            resources={documents}
            onAdd={() => openAddResource('document')}
            onPreview={(resource) => setPreviewResource(resource)}
            onEdit={(resource) => openEditResource(resource)}
            onDelete={(resourceId) => handleDeleteResource(resourceId)}
          />

          <CaseStudySection
            expanded={expandedSections.caseStudies}
            onToggle={() => toggleSection('caseStudies')}
            caseStudies={weekCaseStudies}
            onAdd={openAddCaseStudy}
            onEdit={openEditCaseStudy}
            onDelete={handleDeleteCaseStudy}
            onToggleVisibility={toggleSolutionVisibility}
            onPreviewProblem={(cs) => setPreviewCaseStudy({ url: cs.problem_doc_url!, title: 'Problem Statement' })}
            onPreviewSolution={(cs) => setPreviewCaseStudy({ url: cs.solution_doc_url!, title: 'Solution' })}
          />
        </div>
      )}

      {/* Module/Week Form Dialog */}
      <ModuleFormDialog
        open={showModuleForm}
        onOpenChange={(open) => {
          setShowModuleForm(open);
          if (!open) { setEditingModule(null); setModuleInitialData(null); }
        }}
        editingModule={editingModule}
        initialFormData={moduleInitialData}
        onSave={handleSaveModule}
        saving={saving}
      />

      {/* Resource Form Dialog */}
      <ResourceFormDialog
        open={showResourceForm}
        onOpenChange={(open) => {
          setShowResourceForm(open);
          if (!open) { setEditingResource(null); setResourceInitialData(null); }
        }}
        editingResource={editingResource}
        initialFormData={resourceInitialData}
        targetModuleId={targetModuleId}
        selectedCohort={selectedCohort}
        onSaveComplete={() => { fetchModules(); }}
        saving={saving}
        setSaving={setSaving}
      />

      {/* Case Study Form Dialog */}
      <CaseStudyFormDialog
        open={showCaseStudyForm}
        onOpenChange={(open) => {
          setShowCaseStudyForm(open);
          if (!open) { setEditingCaseStudy(null); }
        }}
        editingCaseStudy={editingCaseStudy}
        onSave={handleSaveCaseStudy}
        saving={saving}
      />

      {/* Resource Preview Modal */}
      <ResourcePreviewModal
        resource={previewResource}
        onClose={() => setPreviewResource(null)}
        isAdmin={true}
        onEdit={(resource) => {
          setPreviewResource(null);
          openEditResource(resource);
        }}
        onDelete={(resourceId) => {
          setPreviewResource(null);
          handleDeleteResource(resourceId);
        }}
      />

      {/* Case Study Preview Modal */}
      <Dialog open={!!previewCaseStudy} onOpenChange={() => setPreviewCaseStudy(null)}>
        <DialogContent className="max-w-[95vw] w-[95vw] max-h-[95vh] h-[95vh] sm:max-w-[95vw] flex flex-col dark:bg-gray-900">
          <DialogHeader>
            <DialogTitle className="dark:text-white">{previewCaseStudy?.title}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 bg-white dark:bg-black rounded-lg overflow-hidden">
            {previewCaseStudy && (
              <iframe
                src={previewCaseStudy.url.replace('/edit', '/preview').replace('/view', '/preview')}
                className="w-full h-full"
                allowFullScreen
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
