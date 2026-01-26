'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { PageLoader } from '@/components/ui/page-loader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import {
  Plus,
  BookOpen,
  Video,
  FileText,
  Presentation,
  Link2,
  MoreVertical,
  Pencil,
  Trash2,
  Loader2,
  ExternalLink,
  Play,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Eye,
  EyeOff,
  Calendar,
  Globe,
} from 'lucide-react';
import { format } from 'date-fns';
import type { Cohort, LearningModule, ModuleResource, LearningModuleWithResources, CaseStudy } from '@/types';
import { cn } from '@/lib/utils';

// Helper to detect content type from URL
function detectContentType(url: string): 'video' | 'slides' | 'document' | 'link' {
  if (!url) return 'link';
  const lowerUrl = url.toLowerCase();

  if (lowerUrl.includes('presentation') || lowerUrl.includes('.ppt')) return 'slides';
  if (lowerUrl.includes('document') || lowerUrl.includes('.doc')) return 'document';
  if (lowerUrl.includes('drive.google.com/file')) return 'video';
  if (lowerUrl.includes('.mp4') || lowerUrl.includes('.mov') || lowerUrl.includes('.avi')) return 'video';

  return 'link';
}

// Get icon for content type
function getContentIcon(type: string, className?: string) {
  const iconClass = className || 'w-4 h-4';
  switch (type) {
    case 'video': return <Video className={`${iconClass} text-purple-500`} />;
    case 'slides': return <Presentation className={`${iconClass} text-orange-500`} />;
    case 'document': return <FileText className={`${iconClass} text-blue-500`} />;
    default: return <Link2 className={`${iconClass} text-gray-500`} />;
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

// Get content type label
function getContentTypeLabel(type: string): string {
  switch (type) {
    case 'video': return 'Recordings';
    case 'slides': return 'PPTs';
    case 'document': return 'Session Notes';
    default: return 'Links';
  }
}

// Global Library identifier
const GLOBAL_LIBRARY_ID = '__global__';

export default function LearningsPage() {
  const [modules, setModules] = useState<LearningModuleWithResources[]>([]);
  const [caseStudies, setCaseStudies] = useState<CaseStudy[]>([]);
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [selectedCohort, setSelectedCohort] = useState<string>('');
  const [selectedWeek, setSelectedWeek] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Expanded sections
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    recordings: true,
    slides: true,
    documents: true,
    caseStudies: true,
  });

  // Module form
  const [showModuleForm, setShowModuleForm] = useState(false);
  const [editingModule, setEditingModule] = useState<LearningModule | null>(null);
  const [moduleFormData, setModuleFormData] = useState({
    title: '',
    description: '',
    week_number: '',
    order_index: 0,
  });

  // Resource form
  const [showResourceForm, setShowResourceForm] = useState(false);
  const [editingResource, setEditingResource] = useState<ModuleResource | null>(null);
  const [targetModuleId, setTargetModuleId] = useState<string>('');
  const [resourceFormData, setResourceFormData] = useState({
    title: '',
    url: '',
    content_type: 'video' as 'video' | 'slides' | 'document' | 'link',
    duration_seconds: '',
    session_number: '',
    order_index: 0,
  });

  // Case study form
  const [showCaseStudyForm, setShowCaseStudyForm] = useState(false);
  const [editingCaseStudy, setEditingCaseStudy] = useState<CaseStudy | null>(null);
  const [caseStudyFormData, setCaseStudyFormData] = useState({
    title: '',
    description: '',
    problem_doc_url: '',
    solution_doc_url: '',
    solution_visible: false,
    due_date: '',
  });

  // Preview modal
  const [previewResource, setPreviewResource] = useState<ModuleResource | null>(null);
  const [previewCaseStudy, setPreviewCaseStudy] = useState<{ url: string; title: string } | null>(null);

  const hasFetchedCohortsRef = useRef(false);

  const fetchCohorts = useCallback(async (force = false) => {
    // Prevent re-fetching on tab switch unless forced
    if (hasFetchedCohortsRef.current && !force) return;
    hasFetchedCohortsRef.current = true;

    try {
      const response = await fetch('/api/admin/cohorts');
      const data = await response.json();
      // API returns array directly, not { cohorts: [...] }
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

  const fetchModules = useCallback(async () => {
    if (!selectedCohort) return;

    try {
      // Check if Global Library is selected
      let url;
      if (selectedCohort === GLOBAL_LIBRARY_ID) {
        // Fetch only global modules
        url = '/api/admin/learnings?is_global=true';
      } else {
        // Fetch cohort-specific modules (existing behavior)
        url = `/api/admin/learnings?cohort_id=${selectedCohort}`;
      }

      const response = await fetch(url);
      const data = await response.json();
      setModules(data.modules || []);

      // Set initial week if not set
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
      Promise.all([fetchModules(), fetchCaseStudies()]).finally(() => setLoading(false));
    }
  }, [selectedCohort, fetchModules, fetchCaseStudies]);

  // Get unique weeks from modules
  const weeks = [...new Set(modules.map(m => m.week_number).filter(Boolean))].sort((a, b) => (a as number) - (b as number));

  // Get resources for selected week grouped by type
  const currentWeekModule = modules.find(m => m.week_number?.toString() === selectedWeek);
  const weekResources = currentWeekModule?.resources || [];
  const recordings = weekResources.filter(r => r.content_type === 'video');
  const slides = weekResources.filter(r => r.content_type === 'slides');
  const documents = weekResources.filter(r => r.content_type === 'document');
  const links = weekResources.filter(r => r.content_type === 'link');

  // Get case studies for selected week
  const weekCaseStudies = caseStudies.filter(cs => cs.week_number?.toString() === selectedWeek);

  // Module CRUD
  const handleCreateModule = async () => {
    if (!moduleFormData.title.trim() || !moduleFormData.week_number) {
      toast.error('Title and week number are required');
      return;
    }

    setSaving(true);
    try {
      const isGlobalLibrary = selectedCohort === GLOBAL_LIBRARY_ID;

      const response = await fetch('/api/admin/learnings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'module',
          title: moduleFormData.title,
          description: moduleFormData.description,
          week_number: parseInt(moduleFormData.week_number),
          order_index: moduleFormData.order_index,
          // Set cohort_id to null and is_global to true for Global Library
          cohort_id: isGlobalLibrary ? null : selectedCohort,
          is_global: isGlobalLibrary,
        }),
      });

      if (!response.ok) throw new Error('Failed to create module');

      toast.success(isGlobalLibrary ? 'Global module created' : 'Week created');
      setShowModuleForm(false);
      resetModuleForm();
      fetchModules();

      // Select the new week
      setSelectedWeek(moduleFormData.week_number);
    } catch (error) {
      console.error('Error creating module:', error);
      toast.error('Failed to create week');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateModule = async () => {
    if (!editingModule || !moduleFormData.title.trim()) return;

    setSaving(true);
    try {
      const response = await fetch('/api/admin/learnings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'module',
          id: editingModule.id,
          title: moduleFormData.title,
          description: moduleFormData.description,
          week_number: moduleFormData.week_number ? parseInt(moduleFormData.week_number) : null,
          order_index: moduleFormData.order_index,
        }),
      });

      if (!response.ok) throw new Error('Failed to update module');

      toast.success('Week updated');
      setShowModuleForm(false);
      setEditingModule(null);
      resetModuleForm();
      fetchModules();
    } catch (error) {
      console.error('Error updating module:', error);
      toast.error('Failed to update week');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteModule = async (moduleId: string) => {
    if (!confirm('Delete this week? All resources in it will also be deleted.')) return;

    try {
      const response = await fetch(`/api/admin/learnings?id=${moduleId}&type=module`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete module');

      toast.success('Week deleted');
      fetchModules();
    } catch (error) {
      console.error('Error deleting module:', error);
      toast.error('Failed to delete week');
    }
  };

  // Resource CRUD
  const handleCreateResource = async () => {
    if (!resourceFormData.title.trim() || !resourceFormData.url.trim()) {
      toast.error('Title and URL are required');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/admin/learnings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'resource',
          module_id: targetModuleId,
          title: resourceFormData.title,
          url: resourceFormData.url,
          content_type: resourceFormData.content_type,
          duration_seconds: resourceFormData.duration_seconds ? parseInt(resourceFormData.duration_seconds) : null,
          session_number: resourceFormData.session_number ? parseInt(resourceFormData.session_number) : null,
          order_index: resourceFormData.order_index,
        }),
      });

      if (!response.ok) throw new Error('Failed to create resource');

      toast.success('Resource added');
      setShowResourceForm(false);
      resetResourceForm();
      fetchModules();
    } catch (error) {
      console.error('Error creating resource:', error);
      toast.error('Failed to create resource');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateResource = async () => {
    if (!editingResource || !resourceFormData.title.trim()) return;

    setSaving(true);
    try {
      const response = await fetch('/api/admin/learnings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'resource',
          id: editingResource.id,
          title: resourceFormData.title,
          url: resourceFormData.url,
          content_type: resourceFormData.content_type,
          duration_seconds: resourceFormData.duration_seconds ? parseInt(resourceFormData.duration_seconds) : null,
          session_number: resourceFormData.session_number ? parseInt(resourceFormData.session_number) : null,
          order_index: resourceFormData.order_index,
        }),
      });

      if (!response.ok) throw new Error('Failed to update resource');

      toast.success('Resource updated');
      setShowResourceForm(false);
      setEditingResource(null);
      resetResourceForm();
      fetchModules();
    } catch (error) {
      console.error('Error updating resource:', error);
      toast.error('Failed to update resource');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteResource = async (resourceId: string) => {
    if (!confirm('Delete this resource?')) return;

    try {
      const response = await fetch(`/api/admin/learnings?id=${resourceId}&type=resource`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete resource');

      toast.success('Resource deleted');
      fetchModules();
    } catch (error) {
      console.error('Error deleting resource:', error);
      toast.error('Failed to delete resource');
    }
  };

  // Case Study CRUD
  const handleCreateCaseStudy = async () => {
    if (!caseStudyFormData.title.trim()) {
      toast.error('Title is required');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/admin/case-studies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cohort_id: selectedCohort,
          week_number: parseInt(selectedWeek),
          title: caseStudyFormData.title,
          description: caseStudyFormData.description,
          problem_doc_url: caseStudyFormData.problem_doc_url,
          solution_doc_url: caseStudyFormData.solution_doc_url,
          solution_visible: caseStudyFormData.solution_visible,
          due_date: caseStudyFormData.due_date || null,
        }),
      });

      if (!response.ok) throw new Error('Failed to create case study');

      toast.success('Case study created');
      setShowCaseStudyForm(false);
      resetCaseStudyForm();
      fetchCaseStudies();
    } catch (error) {
      console.error('Error creating case study:', error);
      toast.error('Failed to create case study');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateCaseStudy = async () => {
    if (!editingCaseStudy || !caseStudyFormData.title.trim()) return;

    setSaving(true);
    try {
      const response = await fetch('/api/admin/case-studies', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingCaseStudy.id,
          title: caseStudyFormData.title,
          description: caseStudyFormData.description,
          problem_doc_url: caseStudyFormData.problem_doc_url,
          solution_doc_url: caseStudyFormData.solution_doc_url,
          solution_visible: caseStudyFormData.solution_visible,
          due_date: caseStudyFormData.due_date || null,
        }),
      });

      if (!response.ok) throw new Error('Failed to update case study');

      toast.success('Case study updated');
      setShowCaseStudyForm(false);
      setEditingCaseStudy(null);
      resetCaseStudyForm();
      fetchCaseStudies();
    } catch (error) {
      console.error('Error updating case study:', error);
      toast.error('Failed to update case study');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCaseStudy = async (caseStudyId: string) => {
    if (!confirm('Delete this case study?')) return;

    try {
      const response = await fetch(`/api/admin/case-studies?id=${caseStudyId}`, {
        method: 'DELETE',
      });

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
        body: JSON.stringify({
          id: caseStudy.id,
          solution_visible: !caseStudy.solution_visible,
        }),
      });

      if (!response.ok) throw new Error('Failed to update');

      toast.success(caseStudy.solution_visible ? 'Solution hidden' : 'Solution visible');
      fetchCaseStudies();
    } catch (error) {
      console.error('Error toggling visibility:', error);
      toast.error('Failed to update visibility');
    }
  };

  // Form helpers
  const resetModuleForm = () => {
    setModuleFormData({ title: '', description: '', week_number: '', order_index: 0 });
  };

  const resetResourceForm = () => {
    setResourceFormData({ title: '', url: '', content_type: 'video', duration_seconds: '', session_number: '', order_index: 0 });
    setTargetModuleId('');
  };

  const resetCaseStudyForm = () => {
    setCaseStudyFormData({ title: '', description: '', problem_doc_url: '', solution_doc_url: '', solution_visible: false, due_date: '' });
  };

  const openAddWeek = () => {
    resetModuleForm();
    setEditingModule(null);
    // Suggest next week number
    const nextWeek = weeks.length > 0 ? Math.max(...weeks.map(w => w as number)) + 1 : 1;
    setModuleFormData(prev => ({ ...prev, week_number: nextWeek.toString(), title: `Week ${nextWeek}` }));
    setShowModuleForm(true);
  };

  const openEditModule = (module: LearningModule) => {
    setEditingModule(module);
    setModuleFormData({
      title: module.title,
      description: module.description || '',
      week_number: module.week_number?.toString() || '',
      order_index: module.order_index || 0,
    });
    setShowModuleForm(true);
  };

  const openAddResource = (contentType: 'video' | 'slides' | 'document' | 'link') => {
    if (!currentWeekModule) {
      toast.error('Please create a week first');
      return;
    }
    setTargetModuleId(currentWeekModule.id);
    setEditingResource(null);
    setResourceFormData({
      title: '',
      url: '',
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
    setResourceFormData({
      title: resource.title,
      url: resource.external_url || '',
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
    resetCaseStudyForm();
    setEditingCaseStudy(null);
    setShowCaseStudyForm(true);
  };

  const openEditCaseStudy = (caseStudy: CaseStudy) => {
    setEditingCaseStudy(caseStudy);
    setCaseStudyFormData({
      title: caseStudy.title,
      description: caseStudy.description || '',
      problem_doc_url: caseStudy.problem_doc_url || '',
      solution_doc_url: caseStudy.solution_doc_url || '',
      solution_visible: caseStudy.solution_visible,
      due_date: caseStudy.due_date ? caseStudy.due_date.split('T')[0] : '',
    });
    setShowCaseStudyForm(true);
  };

  // Auto-detect content type when URL changes
  const handleUrlChange = (url: string) => {
    setResourceFormData(prev => ({
      ...prev,
      url,
      content_type: detectContentType(url),
    }));
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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
              {/* Global Library Option */}
              <SelectItem value={GLOBAL_LIBRARY_ID} className="dark:text-white dark:focus:bg-gray-800">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  <span className="font-medium">Global Library</span>
                </div>
              </SelectItem>
              {/* Separator */}
              {cohorts.length > 0 && (
                <div className="border-t my-1 dark:border-gray-700" />
              )}
              {/* Cohort Options */}
              {cohorts.map((cohort) => (
                <SelectItem key={cohort.id} value={cohort.id} className="dark:text-white dark:focus:bg-gray-800">
                  {cohort.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

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

          {/* Recordings Section */}
          <Card className="border-2 dark:border-gray-800 dark:bg-gray-950/50 shadow-sm overflow-hidden">
            <Collapsible open={expandedSections.recordings} onOpenChange={() => toggleSection('recordings')}>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-purple-50/50 dark:hover:bg-purple-950/10 transition-all border-b dark:border-gray-800 group">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="transition-transform group-hover:scale-110">
                        {expandedSections.recordings ? (
                          <ChevronDown className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                        )}
                      </div>
                      <div className="w-9 h-9 rounded-lg bg-purple-500/10 dark:bg-purple-500/20 flex items-center justify-center">
                        <Video className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                      </div>
                      <CardTitle className="text-lg font-semibold dark:text-white">Recordings</CardTitle>
                      <Badge variant="secondary" className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-0 font-semibold">
                        {recordings.length}
                      </Badge>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => { e.stopPropagation(); openAddResource('video'); }}
                      className="border-2 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:hover:bg-gray-800 transition-all hover:shadow-sm"
                    >
                      <Plus className="w-4 h-4 mr-1.5" />
                      Add
                    </Button>
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-5 pb-5">
                  {recordings.length === 0 ? (
                    <div className="text-center py-8 px-4 rounded-lg border-2 border-dashed dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50">
                      <div className="w-12 h-12 rounded-full bg-purple-500/10 dark:bg-purple-500/20 flex items-center justify-center mx-auto mb-3">
                        <Video className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                      </div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-300">No recordings added yet</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Click "Add" to upload your first recording</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {recordings.map((resource) => (
                        <ResourceItem
                          key={resource.id}
                          resource={resource}
                          onPreview={() => setPreviewResource(resource)}
                          onEdit={() => openEditResource(resource)}
                          onDelete={() => handleDeleteResource(resource.id)}
                          formatDuration={formatDuration}
                        />
                      ))}
                    </div>
                  )}
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>

          {/* PPTs Section */}
          <Card className="border-2 dark:border-gray-800 dark:bg-gray-950/50 shadow-sm overflow-hidden">
            <Collapsible open={expandedSections.slides} onOpenChange={() => toggleSection('slides')}>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-orange-50/50 dark:hover:bg-orange-950/10 transition-all border-b dark:border-gray-800 group">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="transition-transform group-hover:scale-110">
                        {expandedSections.slides ? (
                          <ChevronDown className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                        )}
                      </div>
                      <div className="w-9 h-9 rounded-lg bg-orange-500/10 dark:bg-orange-500/20 flex items-center justify-center">
                        <Presentation className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                      </div>
                      <CardTitle className="text-lg font-semibold dark:text-white">PPTs</CardTitle>
                      <Badge variant="secondary" className="bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border-0 font-semibold">
                        {slides.length}
                      </Badge>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => { e.stopPropagation(); openAddResource('slides'); }}
                      className="border-2 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:hover:bg-gray-800 transition-all hover:shadow-sm"
                    >
                      <Plus className="w-4 h-4 mr-1.5" />
                      Add
                    </Button>
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-5 pb-5">
                  {slides.length === 0 ? (
                    <div className="text-center py-8 px-4 rounded-lg border-2 border-dashed dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50">
                      <div className="w-12 h-12 rounded-full bg-orange-500/10 dark:bg-orange-500/20 flex items-center justify-center mx-auto mb-3">
                        <Presentation className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                      </div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-300">No presentations added yet</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Click "Add" to upload your first presentation</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {slides.map((resource) => (
                        <ResourceItem
                          key={resource.id}
                          resource={resource}
                          onPreview={() => setPreviewResource(resource)}
                          onEdit={() => openEditResource(resource)}
                          onDelete={() => handleDeleteResource(resource.id)}
                          formatDuration={formatDuration}
                        />
                      ))}
                    </div>
                  )}
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>

          {/* Session Notes Section */}
          <Card className="border-2 dark:border-gray-800 dark:bg-gray-950/50 shadow-sm overflow-hidden">
            <Collapsible open={expandedSections.documents} onOpenChange={() => toggleSection('documents')}>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-blue-50/50 dark:hover:bg-blue-950/10 transition-all border-b dark:border-gray-800 group">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="transition-transform group-hover:scale-110">
                        {expandedSections.documents ? (
                          <ChevronDown className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                        )}
                      </div>
                      <div className="w-9 h-9 rounded-lg bg-blue-500/10 dark:bg-blue-500/20 flex items-center justify-center">
                        <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <CardTitle className="text-lg font-semibold dark:text-white">Session Notes</CardTitle>
                      <Badge variant="secondary" className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-0 font-semibold">
                        {documents.length}
                      </Badge>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => { e.stopPropagation(); openAddResource('document'); }}
                      className="border-2 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:hover:bg-gray-800 transition-all hover:shadow-sm"
                    >
                      <Plus className="w-4 h-4 mr-1.5" />
                      Add
                    </Button>
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-5 pb-5">
                  {documents.length === 0 ? (
                    <div className="text-center py-8 px-4 rounded-lg border-2 border-dashed dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50">
                      <div className="w-12 h-12 rounded-full bg-blue-500/10 dark:bg-blue-500/20 flex items-center justify-center mx-auto mb-3">
                        <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                      </div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-300">No session notes added yet</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Click "Add" to upload your first session note</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {documents.map((resource) => (
                        <ResourceItem
                          key={resource.id}
                          resource={resource}
                          onPreview={() => setPreviewResource(resource)}
                          onEdit={() => openEditResource(resource)}
                          onDelete={() => handleDeleteResource(resource.id)}
                          formatDuration={formatDuration}
                        />
                      ))}
                    </div>
                  )}
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>

          {/* Case Studies Section */}
          <Card className="border-2 dark:border-gray-800 dark:bg-gray-950/50 shadow-sm overflow-hidden">
            <Collapsible open={expandedSections.caseStudies} onOpenChange={() => toggleSection('caseStudies')}>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-green-50/50 dark:hover:bg-green-950/10 transition-all border-b dark:border-gray-800 group">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="transition-transform group-hover:scale-110">
                        {expandedSections.caseStudies ? (
                          <ChevronDown className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                        )}
                      </div>
                      <div className="w-9 h-9 rounded-lg bg-green-500/10 dark:bg-green-500/20 flex items-center justify-center">
                        <ClipboardList className="w-5 h-5 text-green-600 dark:text-green-400" />
                      </div>
                      <CardTitle className="text-lg font-semibold dark:text-white">Case Studies</CardTitle>
                      <Badge variant="secondary" className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-0 font-semibold">
                        {weekCaseStudies.length}
                      </Badge>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => { e.stopPropagation(); openAddCaseStudy(); }}
                      className="border-2 dark:border-gray-700 dark:bg-gray-900 dark:text-white dark:hover:bg-gray-800 transition-all hover:shadow-sm"
                    >
                      <Plus className="w-4 h-4 mr-1.5" />
                      Add
                    </Button>
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-5 pb-5">
                  {weekCaseStudies.length === 0 ? (
                    <div className="text-center py-8 px-4 rounded-lg border-2 border-dashed dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50">
                      <div className="w-12 h-12 rounded-full bg-green-500/10 dark:bg-green-500/20 flex items-center justify-center mx-auto mb-3">
                        <ClipboardList className="w-6 h-6 text-green-600 dark:text-green-400" />
                      </div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-300">No case studies added yet</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Click "Add" to create your first case study</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {weekCaseStudies.map((caseStudy) => (
                        <div
                          key={caseStudy.id}
                          className="flex items-start gap-4 p-5 rounded-lg border-2 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-green-500/50 dark:hover:border-green-500/50 transition-all shadow-sm hover:shadow-md"
                        >
                          <div className="w-12 h-12 rounded-lg bg-green-500/10 dark:bg-green-500/20 flex items-center justify-center flex-shrink-0">
                            <ClipboardList className="w-6 h-6 text-green-600 dark:text-green-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <p className="font-semibold text-base dark:text-white">{caseStudy.title}</p>
                              {caseStudy.solution_visible ? (
                                <Badge variant="secondary" className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-0">
                                  <Eye className="w-3 h-3 mr-1" />
                                  Solution Visible
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-xs border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400">
                                  <EyeOff className="w-3 h-3 mr-1" />
                                  Solution Hidden
                                </Badge>
                              )}
                            </div>
                            {caseStudy.description && (
                              <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">{caseStudy.description}</p>
                            )}
                            <div className="flex items-center gap-4 text-sm">
                              {caseStudy.problem_doc_url && (
                                <button
                                  onClick={() => setPreviewCaseStudy({ url: caseStudy.problem_doc_url!, title: 'Problem Statement' })}
                                  className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium flex items-center gap-1.5 transition-colors"
                                >
                                  <FileText className="w-4 h-4" />
                                  Problem
                                </button>
                              )}
                              {caseStudy.solution_doc_url && (
                                <button
                                  onClick={() => setPreviewCaseStudy({ url: caseStudy.solution_doc_url!, title: 'Solution' })}
                                  className="text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 font-medium flex items-center gap-1.5 transition-colors"
                                >
                                  <FileText className="w-4 h-4" />
                                  Solution
                                </button>
                              )}
                              {caseStudy.due_date && (
                                <span className="text-gray-600 dark:text-gray-400 flex items-center gap-1.5">
                                  <Calendar className="w-4 h-4" />
                                  Due: {format(new Date(caseStudy.due_date), 'MMM d, yyyy')}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={caseStudy.solution_visible}
                              onCheckedChange={() => toggleSolutionVisibility(caseStudy)}
                            />
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button size="sm" variant="ghost">
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openEditCaseStudy(caseStudy)}>
                                  <Pencil className="w-4 h-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => handleDeleteCaseStudy(caseStudy.id)}
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        </div>
      )}

      {/* Module/Week Form Dialog */}
      <Dialog open={showModuleForm} onOpenChange={setShowModuleForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingModule ? 'Edit Week' : 'Create Week'}</DialogTitle>
            <DialogDescription>
              Create a week to organize your learning content
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="module-week">Week Number *</Label>
                <Input
                  id="module-week"
                  type="number"
                  placeholder="1"
                  value={moduleFormData.week_number}
                  onChange={(e) => setModuleFormData({ ...moduleFormData, week_number: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="module-order">Order Index</Label>
                <Input
                  id="module-order"
                  type="number"
                  placeholder="0"
                  value={moduleFormData.order_index}
                  onChange={(e) => setModuleFormData({ ...moduleFormData, order_index: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="module-title">Title *</Label>
              <Input
                id="module-title"
                placeholder="e.g., Week 1: Introduction to Product Management"
                value={moduleFormData.title}
                onChange={(e) => setModuleFormData({ ...moduleFormData, title: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="module-description">Description</Label>
              <Textarea
                id="module-description"
                placeholder="Brief description of what this week covers..."
                value={moduleFormData.description}
                onChange={(e) => setModuleFormData({ ...moduleFormData, description: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModuleForm(false)}>Cancel</Button>
            <Button onClick={editingModule ? handleUpdateModule : handleCreateModule} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingModule ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Resource Form Dialog */}
      <Dialog open={showResourceForm} onOpenChange={setShowResourceForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingResource ? 'Edit Resource' : `Add ${getContentTypeLabel(resourceFormData.content_type).slice(0, -1)}`}</DialogTitle>
            <DialogDescription>
              Add content from Google Drive
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="resource-title">Title *</Label>
              <Input
                id="resource-title"
                placeholder="e.g., Session 1 Recording"
                value={resourceFormData.title}
                onChange={(e) => setResourceFormData({ ...resourceFormData, title: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="resource-url">Google Drive URL *</Label>
              <Input
                id="resource-url"
                placeholder="https://drive.google.com/file/d/..."
                value={resourceFormData.url}
                onChange={(e) => handleUrlChange(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Paste the sharing link from Google Drive, Slides, or Docs
              </p>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="resource-type">Content Type</Label>
                <Select
                  value={resourceFormData.content_type}
                  onValueChange={(value: 'video' | 'slides' | 'document' | 'link') =>
                    setResourceFormData({ ...resourceFormData, content_type: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="video">Recording</SelectItem>
                    <SelectItem value="slides">PPT</SelectItem>
                    <SelectItem value="document">Notes</SelectItem>
                    <SelectItem value="link">Link</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="resource-session">Session #</Label>
                <Input
                  id="resource-session"
                  type="number"
                  placeholder="1"
                  value={resourceFormData.session_number}
                  onChange={(e) => setResourceFormData({ ...resourceFormData, session_number: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="resource-duration">Duration (sec)</Label>
                <Input
                  id="resource-duration"
                  type="number"
                  placeholder="3600"
                  value={resourceFormData.duration_seconds}
                  onChange={(e) => setResourceFormData({ ...resourceFormData, duration_seconds: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowResourceForm(false)}>Cancel</Button>
            <Button onClick={editingResource ? handleUpdateResource : handleCreateResource} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingResource ? 'Update' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Case Study Form Dialog */}
      <Dialog open={showCaseStudyForm} onOpenChange={setShowCaseStudyForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCaseStudy ? 'Edit Case Study' : 'Add Case Study'}</DialogTitle>
            <DialogDescription>
              Add a case study with problem statement and solution
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="cs-title">Title *</Label>
              <Input
                id="cs-title"
                placeholder="e.g., Case Study 1: Culture Compass"
                value={caseStudyFormData.title}
                onChange={(e) => setCaseStudyFormData({ ...caseStudyFormData, title: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="cs-description">Description</Label>
              <Textarea
                id="cs-description"
                placeholder="Brief description..."
                value={caseStudyFormData.description}
                onChange={(e) => setCaseStudyFormData({ ...caseStudyFormData, description: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="cs-problem">Problem Document URL</Label>
              <Input
                id="cs-problem"
                placeholder="https://docs.google.com/document/d/..."
                value={caseStudyFormData.problem_doc_url}
                onChange={(e) => setCaseStudyFormData({ ...caseStudyFormData, problem_doc_url: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="cs-solution">Solution Document URL</Label>
              <Input
                id="cs-solution"
                placeholder="https://docs.google.com/document/d/..."
                value={caseStudyFormData.solution_doc_url}
                onChange={(e) => setCaseStudyFormData({ ...caseStudyFormData, solution_doc_url: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="cs-due">Due Date</Label>
                <Input
                  id="cs-due"
                  type="date"
                  value={caseStudyFormData.due_date}
                  onChange={(e) => setCaseStudyFormData({ ...caseStudyFormData, due_date: e.target.value })}
                />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Switch
                  id="cs-visible"
                  checked={caseStudyFormData.solution_visible}
                  onCheckedChange={(checked) => setCaseStudyFormData({ ...caseStudyFormData, solution_visible: checked })}
                />
                <Label htmlFor="cs-visible">Solution Visible to Students</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCaseStudyForm(false)}>Cancel</Button>
            <Button onClick={editingCaseStudy ? handleUpdateCaseStudy : handleCreateCaseStudy} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingCaseStudy ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Resource Preview Modal */}
      <Dialog open={!!previewResource} onOpenChange={() => setPreviewResource(null)}>
        <DialogContent className="max-w-[95vw] w-[95vw] max-h-[95vh] h-[95vh] sm:max-w-[95vw] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {previewResource && getContentIcon(previewResource.content_type)}
              {previewResource?.title}
            </DialogTitle>
          </DialogHeader>

          {/* Content Display */}
          {previewResource && (
            <div className="w-full flex-1 min-h-0">
              <iframe
                src={previewResource.google_drive_id
                  ? `https://drive.google.com/file/d/${previewResource.google_drive_id}/preview`
                  : getEmbedUrl(previewResource)
                }
                className="w-full h-full rounded-lg"
                allow="autoplay; encrypted-media; fullscreen"
                allowFullScreen
                title={previewResource.title}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Case Study Preview Modal */}
      <Dialog open={!!previewCaseStudy} onOpenChange={() => setPreviewCaseStudy(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{previewCaseStudy?.title}</DialogTitle>
          </DialogHeader>
          <div className="aspect-video bg-white rounded-lg overflow-hidden">
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

// Resource Item Component
function ResourceItem({
  resource,
  onPreview,
  onEdit,
  onDelete,
  formatDuration,
}: {
  resource: ModuleResource;
  onPreview: () => void;
  onEdit: () => void;
  onDelete: () => void;
  formatDuration: (seconds: number | null) => string;
}) {
  const colorMap = {
    video: 'purple',
    slides: 'orange',
    document: 'blue',
    link: 'gray',
  };
  const color = colorMap[resource.content_type as keyof typeof colorMap] || 'gray';

  return (
    <div className={cn(
      "flex items-center gap-4 p-4 rounded-lg border-2 transition-all group",
      "dark:border-gray-700 bg-white dark:bg-gray-900",
      "hover:border-${color}-500/50 dark:hover:border-${color}-500/50",
      "shadow-sm hover:shadow-md"
    )}>
      <div className={cn(
        "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
        resource.content_type === 'video' && "bg-purple-500/10 dark:bg-purple-500/20",
        resource.content_type === 'slides' && "bg-orange-500/10 dark:bg-orange-500/20",
        resource.content_type === 'document' && "bg-blue-500/10 dark:bg-blue-500/20",
        resource.content_type === 'link' && "bg-gray-500/10 dark:bg-gray-500/20"
      )}>
        {resource.content_type === 'video' && <Video className="w-5 h-5 text-purple-600 dark:text-purple-400" />}
        {resource.content_type === 'slides' && <Presentation className="w-5 h-5 text-orange-600 dark:text-orange-400" />}
        {resource.content_type === 'document' && <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
        {resource.content_type === 'link' && <Link2 className="w-5 h-5 text-gray-600 dark:text-gray-400" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm truncate dark:text-white">{resource.title}</p>
        <div className="flex items-center gap-2.5 text-xs text-gray-600 dark:text-gray-400 mt-1">
          {resource.session_number && (
            <span className="font-medium">Session {resource.session_number}</span>
          )}
          {resource.duration_seconds && (
            <>
              {resource.session_number && <span className="text-gray-400">•</span>}
              <span className="font-medium">{formatDuration(resource.duration_seconds)}</span>
            </>
          )}
        </div>
      </div>
      <Button
        size="sm"
        variant="ghost"
        onClick={onPreview}
        className="opacity-0 group-hover:opacity-100 transition-opacity dark:text-white dark:hover:bg-gray-800"
      >
        <Play className="w-4 h-4 mr-1.5" />
        Play
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="ghost" className="dark:text-white dark:hover:bg-gray-800">
            <MoreVertical className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="dark:bg-gray-900 dark:border-gray-700">
          <DropdownMenuItem onClick={onPreview} className="dark:text-white dark:focus:bg-gray-800">
            <Play className="w-4 h-4 mr-2" />
            Preview
          </DropdownMenuItem>
          {resource.external_url && (
            <DropdownMenuItem asChild className="dark:text-white dark:focus:bg-gray-800">
              <a href={resource.external_url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-4 h-4 mr-2" />
                Open Original
              </a>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={onEdit} className="dark:text-white dark:focus:bg-gray-800">
            <Pencil className="w-4 h-4 mr-2" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem className="text-red-600 dark:text-red-400 dark:focus:bg-red-950/20" onClick={onDelete}>
            <Trash2 className="w-4 h-4 mr-2" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
