'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
  AlertTriangle,
  Info,
  Upload,
  Youtube,
  Download,
} from 'lucide-react';
import { isYouTubeUrl, getYouTubeEmbedUrl } from '@/lib/utils/youtube-url';
import { format } from 'date-fns';
import type { Cohort, LearningModule, ModuleResource, LearningModuleWithResources, CaseStudy } from '@/types';
import { cn } from '@/lib/utils';
import { ResourcePreviewModal } from '@/components/learnings';

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
  const [cohortStats, setCohortStats] = useState<any>(null); // Link status for selected cohort

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
    youtube_url: '',  // For videos - YouTube URL
    content_type: 'video' as 'video' | 'slides' | 'document' | 'link',
    duration_seconds: '',
    session_number: '',
    order_index: 0,
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(false);
  const [uploadProgressPercent, setUploadProgressPercent] = useState<number>(0);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'requesting-url' | 'uploading' | 'confirming' | 'complete'>('idle');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Direct upload threshold: files larger than 4MB bypass Vercel and upload directly to Supabase
  const DIRECT_UPLOAD_THRESHOLD = 4 * 1024 * 1024; // 4MB

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
  const [problemFile, setProblemFile] = useState<File | null>(null);
  const [solutionFile, setSolutionFile] = useState<File | null>(null);
  const problemFileRef = useRef<HTMLInputElement>(null);
  const solutionFileRef = useRef<HTMLInputElement>(null);

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
      // Check if Global Library is selected
      let url;
      if (selectedCohort === GLOBAL_LIBRARY_ID) {
        // Fetch only global modules
        url = '/api/admin/learnings?is_global=true';
      } else {
        // Fetch cohort's OWN modules (for admin management, bypass override logic)
        url = `/api/admin/learnings?cohort_id=${selectedCohort}&show_own=true`;
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
      Promise.all([fetchModules(), fetchCaseStudies(), fetchCohortStats()]).finally(() => setLoading(false));
    }
  }, [selectedCohort, fetchModules, fetchCaseStudies, fetchCohortStats]);

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

  // Large file upload function (bypasses Vercel's 4.5MB limit)
  const uploadLargeFile = async (
    file: File,
    cohortId: string,
    moduleId: string,
    metadata: {
      title: string;
      contentType: 'slides' | 'document';
      sessionNumber?: number;
      orderIndex?: number;
      durationSeconds?: number;
    }
  ): Promise<{ success: boolean; resource?: any; error?: string }> => {
    try {
      // Step 1: Request signed upload URL
      setUploadStatus('requesting-url');
      setUploadProgressPercent(0);

      console.log('[Large Upload] Step 1: Requesting upload URL...', {
        fileName: file.name,
        fileSize: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
      });

      const urlResponse = await fetch('/api/admin/resources/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          fileSize: file.size,
          contentType: file.type,
          cohortId: cohortId === GLOBAL_LIBRARY_ID ? 'global' : cohortId,
        }),
      });

      if (!urlResponse.ok) {
        if (urlResponse.status === 413) {
          throw new Error('File too large. Maximum upload size is 100MB.');
        }

        let errorMessage = 'Failed to get upload URL';
        try {
          const contentType = urlResponse.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const error = await urlResponse.json();
            errorMessage = error.error || error.message || errorMessage;
          } else {
            errorMessage = `Upload URL request failed with status ${urlResponse.status}`;
          }
        } catch {
          errorMessage = `Upload URL request failed with status ${urlResponse.status}`;
        }

        throw new Error(errorMessage);
      }

      const { uploadUrl, filePath, expiresAt } = await urlResponse.json();

      console.log('[Large Upload] Step 1: Upload URL received', {
        filePath,
        expiresAt,
      });

      // Check if URL is about to expire (less than 1 minute left)
      const expiresIn = new Date(expiresAt).getTime() - Date.now();
      if (expiresIn < 60000) {
        throw new Error('Upload URL expired. Please try again.');
      }

      // Step 2: Upload directly to Supabase Storage
      setUploadStatus('uploading');

      console.log('[Large Upload] Step 2: Uploading to Supabase Storage...');

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const percent = Math.round((e.loaded / e.total) * 100);
            setUploadProgressPercent(percent);
            console.log(`[Large Upload] Upload progress: ${percent}%`);
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            console.log('[Large Upload] Step 2: Upload complete!');
            resolve();
          } else {
            console.error('[Large Upload] Upload failed:', xhr.status, xhr.statusText);
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        });

        xhr.addEventListener('error', () => {
          console.error('[Large Upload] Network error during upload');
          reject(new Error('Network error during upload. Please check your connection.'));
        });

        xhr.addEventListener('timeout', () => {
          console.error('[Large Upload] Upload timed out');
          reject(new Error('Upload timed out. Please try again.'));
        });

        // Set timeout to 10 minutes for large files
        xhr.timeout = 600000;

        xhr.open('PUT', uploadUrl);
        xhr.setRequestHeader('Content-Type', file.type);
        xhr.send(file);
      });

      // Step 3: Confirm upload and create database record
      setUploadStatus('confirming');
      setUploadProgressPercent(100);

      console.log('[Large Upload] Step 3: Confirming upload and creating DB record...');

      const confirmResponse = await fetch('/api/admin/resources/confirm-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filePath,
          moduleId,
          title: metadata.title,
          contentType: metadata.contentType,
          fileType: 'pdf',
          fileSize: file.size,
          sessionNumber: metadata.sessionNumber,
          orderIndex: metadata.orderIndex,
          durationSeconds: metadata.durationSeconds,
        }),
      });

      if (!confirmResponse.ok) {
        let errorMessage = 'Failed to confirm upload';
        try {
          const contentType = confirmResponse.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const error = await confirmResponse.json();
            errorMessage = error.error || error.message || errorMessage;
          } else {
            errorMessage = `Confirmation failed with status ${confirmResponse.status}`;
          }
        } catch {
          errorMessage = `Confirmation failed with status ${confirmResponse.status}`;
        }

        throw new Error(errorMessage);
      }

      const { resource } = await confirmResponse.json();

      console.log('[Large Upload] Step 3: Complete! Resource created:', resource.id);

      setUploadStatus('complete');
      return { success: true, resource };

    } catch (error) {
      console.error('[Large Upload] Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed'
      };
    } finally {
      setUploadStatus('idle');
      setUploadProgressPercent(0);
    }
  };

  // Resource CRUD
  const handleCreateResource = async () => {
    // Validation based on content type
    if (!resourceFormData.title.trim()) {
      toast.error('Title is required');
      return;
    }

    if (resourceFormData.content_type === 'video') {
      if (!resourceFormData.youtube_url.trim()) {
        toast.error('YouTube URL is required for videos');
        return;
      }
      if (!isYouTubeUrl(resourceFormData.youtube_url)) {
        toast.error('Please enter a valid YouTube URL');
        return;
      }
    } else {
      // For slides/documents, need a file
      if (!selectedFile) {
        toast.error('Please select a PDF file');
        return;
      }
    }

    setSaving(true);
    setUploadProgress(true);

    try {
      let filePath: string | null = null;
      let fileType: string | null = null;
      let fileSize: number | null = null;

      // For PDFs, upload first
      if (selectedFile && resourceFormData.content_type !== 'video') {
        // Check file size and use appropriate upload method
        if (selectedFile.size > DIRECT_UPLOAD_THRESHOLD) {
          // Large file (>4MB): Use direct upload to bypass Vercel's 4.5MB limit
          console.log('[Upload] Using direct upload for large file:', {
            fileName: selectedFile.name,
            fileSize: `${(selectedFile.size / 1024 / 1024).toFixed(2)} MB`,
            threshold: `${(DIRECT_UPLOAD_THRESHOLD / 1024 / 1024).toFixed(0)} MB`,
          });

          const result = await uploadLargeFile(
            selectedFile,
            selectedCohort,
            targetModuleId,
            {
              title: resourceFormData.title,
              contentType: resourceFormData.content_type as 'slides' | 'document',
              sessionNumber: resourceFormData.session_number ? parseInt(resourceFormData.session_number) : undefined,
              orderIndex: resourceFormData.order_index,
              durationSeconds: resourceFormData.duration_seconds ? parseInt(resourceFormData.duration_seconds) : undefined,
            }
          );

          if (!result.success) {
            throw new Error(result.error || 'Upload failed');
          }

          // Resource already created in confirm-upload step
          toast.success('Resource added');
          setShowResourceForm(false);
          resetResourceForm();
          fetchModules();
          return; // Early return since resource is already created

        } else {
          // Small file (≤4MB): Use existing upload route (goes through Vercel)
          console.log('[Upload] Using standard upload for small file:', {
            fileName: selectedFile.name,
            fileSize: `${(selectedFile.size / 1024 / 1024).toFixed(2)} MB`,
          });

          const formData = new FormData();
          formData.append('file', selectedFile);
          formData.append('cohort_id', selectedCohort === GLOBAL_LIBRARY_ID ? 'global' : selectedCohort);

          const uploadResponse = await fetch('/api/admin/resources/upload', {
            method: 'POST',
            body: formData,
          });

          if (!uploadResponse.ok) {
            // Handle 413 Payload Too Large specifically
            if (uploadResponse.status === 413) {
              throw new Error('File too large. Maximum upload size is 100MB.');
            }

            // Try to parse JSON error, but handle non-JSON responses gracefully
            let errorMessage = 'Failed to upload file';
            try {
              const contentType = uploadResponse.headers.get('content-type');
              if (contentType && contentType.includes('application/json')) {
                const error = await uploadResponse.json();
                errorMessage = error.error || error.message || errorMessage;
              } else {
                // Non-JSON response (likely HTML error page)
                errorMessage = `Upload failed with status ${uploadResponse.status}`;
              }
            } catch {
              errorMessage = `Upload failed with status ${uploadResponse.status}`;
            }

            throw new Error(errorMessage);
          }

          const uploadData = await uploadResponse.json();
          filePath = uploadData.file_path;
          fileType = uploadData.file_type;
          fileSize = uploadData.file_size;
        }
      }

      // Create resource record
      const response = await fetch('/api/admin/learnings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'resource',
          module_id: targetModuleId,
          title: resourceFormData.title,
          content_type: resourceFormData.content_type,
          duration_seconds: resourceFormData.duration_seconds ? parseInt(resourceFormData.duration_seconds) : null,
          session_number: resourceFormData.session_number ? parseInt(resourceFormData.session_number) : null,
          order_index: resourceFormData.order_index,
          // For videos: YouTube URL
          external_url: resourceFormData.content_type === 'video' ? resourceFormData.youtube_url : null,
          // For PDFs: file info
          file_path: filePath,
          file_type: fileType,
          file_size: fileSize,
        }),
      });

      if (!response.ok) throw new Error('Failed to create resource');

      toast.success('Resource added');
      setShowResourceForm(false);
      resetResourceForm();
      fetchModules();
    } catch (error) {
      console.error('Error creating resource:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create resource');
    } finally {
      setSaving(false);
      setUploadProgress(false);
    }
  };

  const handleUpdateResource = async () => {
    if (!editingResource || !resourceFormData.title.trim()) return;

    setSaving(true);
    setUploadProgress(true);

    try {
      let filePath: string | null = null;
      let fileType: string | null = null;
      let fileSize: number | null = null;

      // If a new file was selected for PDFs, upload it
      if (selectedFile && resourceFormData.content_type !== 'video') {
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('cohort_id', selectedCohort === GLOBAL_LIBRARY_ID ? 'global' : selectedCohort);

        const uploadResponse = await fetch('/api/admin/resources/upload', {
          method: 'POST',
          body: formData,
        });

        if (!uploadResponse.ok) {
          // Handle 413 Payload Too Large specifically
          if (uploadResponse.status === 413) {
            throw new Error('File too large. Maximum upload size is 100MB.');
          }

          // Try to parse JSON error, but handle non-JSON responses gracefully
          let errorMessage = 'Failed to upload file';
          try {
            const contentType = uploadResponse.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
              const error = await uploadResponse.json();
              errorMessage = error.error || error.message || errorMessage;
            } else {
              // Non-JSON response (likely HTML error page)
              errorMessage = `Upload failed with status ${uploadResponse.status}`;
            }
          } catch {
            errorMessage = `Upload failed with status ${uploadResponse.status}`;
          }

          throw new Error(errorMessage);
        }

        const uploadData = await uploadResponse.json();
        filePath = uploadData.file_path;
        fileType = uploadData.file_type;
        fileSize = uploadData.file_size;
      }

      const response = await fetch('/api/admin/learnings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'resource',
          id: editingResource.id,
          title: resourceFormData.title,
          content_type: resourceFormData.content_type,
          duration_seconds: resourceFormData.duration_seconds ? parseInt(resourceFormData.duration_seconds) : null,
          session_number: resourceFormData.session_number ? parseInt(resourceFormData.session_number) : null,
          order_index: resourceFormData.order_index,
          // For videos: YouTube URL
          external_url: resourceFormData.content_type === 'video' ? resourceFormData.youtube_url : undefined,
          // For PDFs: file info (only if new file uploaded)
          ...(filePath && { file_path: filePath, file_type: fileType, file_size: fileSize }),
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
      toast.error(error instanceof Error ? error.message : 'Failed to update resource');
    } finally {
      setSaving(false);
      setUploadProgress(false);
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
    setResourceFormData({ title: '', youtube_url: '', content_type: 'video', duration_seconds: '', session_number: '', order_index: 0 });
    setTargetModuleId('');
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const resetCaseStudyForm = () => {
    setCaseStudyFormData({ title: '', description: '', problem_doc_url: '', solution_doc_url: '', solution_visible: false, due_date: '' });
    setProblemFile(null);
    setSolutionFile(null);
    if (problemFileRef.current) problemFileRef.current.value = '';
    if (solutionFileRef.current) solutionFileRef.current.value = '';
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
    setSelectedFile(null);
    setResourceFormData({
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
    setSelectedFile(null);
    setResourceFormData({
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

      {/* Link Status Alert - Show when cohort is linked to another source */}
      {cohortStats && cohortStats.active_source !== 'own' && (
        <Alert className="border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 animate-in fade-in slide-in-from-top-2 duration-300">
          <Info className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <AlertDescription className="text-sm text-amber-800 dark:text-amber-200">
            <div className="flex flex-col gap-1">
              <p className="font-medium">
                ℹ️ This cohort is linked to{' '}
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
        <DialogContent className="dark:bg-gray-900 dark:border-gray-700 sm:max-w-[550px]">
          <DialogHeader className="pb-2">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-white" />
              </div>
              <DialogTitle className="dark:text-white text-2xl">
                {editingModule ? 'Edit Week' : 'Create New Week'}
              </DialogTitle>
            </div>
            <DialogDescription className="dark:text-gray-400 text-base">
              {editingModule ? 'Update week details and content structure' : 'Create a new week to organize your learning content'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="grid grid-cols-2 gap-5">
              <div className="space-y-2">
                <Label htmlFor="module-week" className="dark:text-gray-300 font-medium flex items-center gap-1">
                  Week Number <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="module-week"
                  type="number"
                  placeholder="1"
                  value={moduleFormData.week_number}
                  onChange={(e) => setModuleFormData({ ...moduleFormData, week_number: e.target.value })}
                  className="dark:bg-gray-950 dark:border-gray-700 dark:text-white h-11 text-base"
                />
                <p className="text-xs text-muted-foreground dark:text-gray-500">Displayed in tabs</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="module-order" className="dark:text-gray-300 font-medium">Order Index</Label>
                <Input
                  id="module-order"
                  type="number"
                  placeholder="0"
                  value={moduleFormData.order_index}
                  onChange={(e) => setModuleFormData({ ...moduleFormData, order_index: parseInt(e.target.value) || 0 })}
                  className="dark:bg-gray-950 dark:border-gray-700 dark:text-white h-11 text-base"
                />
                <p className="text-xs text-muted-foreground dark:text-gray-500">Sort order (0 = first)</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="module-title" className="dark:text-gray-300 font-medium flex items-center gap-1">
                Title <span className="text-red-500">*</span>
              </Label>
              <Input
                id="module-title"
                placeholder="e.g., Week 1: Introduction to Product Management"
                value={moduleFormData.title}
                onChange={(e) => setModuleFormData({ ...moduleFormData, title: e.target.value })}
                className="dark:bg-gray-950 dark:border-gray-700 dark:text-white h-11 text-base"
              />
              <p className="text-xs text-muted-foreground dark:text-gray-500">Descriptive title for the week</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="module-description" className="dark:text-gray-300 font-medium">Description</Label>
              <Textarea
                id="module-description"
                placeholder="Brief description of what this week covers..."
                value={moduleFormData.description}
                onChange={(e) => setModuleFormData({ ...moduleFormData, description: e.target.value })}
                className="dark:bg-gray-950 dark:border-gray-700 dark:text-white min-h-[100px] text-base resize-none"
              />
              <p className="text-xs text-muted-foreground dark:text-gray-500">Optional summary of week content</p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowModuleForm(false)}
              className="dark:border-gray-700 dark:text-white dark:hover:bg-gray-800 h-11"
            >
              Cancel
            </Button>
            <Button
              onClick={editingModule ? handleUpdateModule : handleCreateModule}
              disabled={saving || !moduleFormData.week_number || !moduleFormData.title.trim()}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white h-11 px-6 shadow-md"
            >
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingModule ? 'Update Week' : 'Create Week'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Resource Form Dialog */}
      <Dialog open={showResourceForm} onOpenChange={setShowResourceForm}>
        <DialogContent className="dark:bg-gray-900 dark:border-gray-700 sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle className="dark:text-white text-xl flex items-center gap-2">
              {resourceFormData.content_type === 'video' ? (
                <Youtube className="w-5 h-5 text-red-500" />
              ) : (
                <FileText className="w-5 h-5 text-blue-500" />
              )}
              {editingResource ? 'Edit Resource' : `Add ${getContentTypeLabel(resourceFormData.content_type).slice(0, -1)}`}
            </DialogTitle>
            <DialogDescription className="dark:text-gray-400">
              {resourceFormData.content_type === 'video'
                ? 'Add a YouTube video'
                : 'Upload a PDF file'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-2">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="resource-title" className="dark:text-gray-300 font-medium">
                Title <span className="text-red-500">*</span>
              </Label>
              <Input
                id="resource-title"
                placeholder="e.g., Session 1 Recording"
                value={resourceFormData.title}
                onChange={(e) => setResourceFormData({ ...resourceFormData, title: e.target.value })}
                className="dark:bg-gray-950 dark:border-gray-700 dark:text-white h-11"
              />
            </div>

            {/* Content Type Selector */}
            <div className="space-y-2">
              <Label className="dark:text-gray-300 font-medium">Content Type</Label>
              <Select
                value={resourceFormData.content_type}
                onValueChange={(value: 'video' | 'slides' | 'document' | 'link') => {
                  setResourceFormData({ ...resourceFormData, content_type: value, youtube_url: '' });
                  setSelectedFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
              >
                <SelectTrigger className="dark:bg-gray-950 dark:border-gray-700 dark:text-white h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="dark:bg-gray-900 dark:border-gray-700">
                  <SelectItem value="video" className="dark:text-white dark:focus:bg-gray-800">
                    <span className="flex items-center gap-2">
                      <Youtube className="w-4 h-4 text-red-500" />
                      Recording (YouTube)
                    </span>
                  </SelectItem>
                  <SelectItem value="slides" className="dark:text-white dark:focus:bg-gray-800">
                    <span className="flex items-center gap-2">
                      <Presentation className="w-4 h-4 text-orange-500" />
                      PPT (PDF Upload)
                    </span>
                  </SelectItem>
                  <SelectItem value="document" className="dark:text-white dark:focus:bg-gray-800">
                    <span className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-blue-500" />
                      Notes (PDF Upload)
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* YouTube URL Input - for videos */}
            {resourceFormData.content_type === 'video' && (
              <div className="space-y-2">
                <Label htmlFor="resource-youtube" className="dark:text-gray-300 font-medium flex items-center gap-2">
                  <Youtube className="w-4 h-4 text-red-500" />
                  YouTube URL <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="resource-youtube"
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={resourceFormData.youtube_url}
                  onChange={(e) => setResourceFormData({ ...resourceFormData, youtube_url: e.target.value })}
                  className="dark:bg-gray-950 dark:border-gray-700 dark:text-white h-11"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Paste any YouTube URL (watch, share, or embed link)
                </p>
                {resourceFormData.youtube_url && !isYouTubeUrl(resourceFormData.youtube_url) && (
                  <p className="text-xs text-red-500">
                    Please enter a valid YouTube URL
                  </p>
                )}
              </div>
            )}

            {/* PDF File Upload - for slides/documents */}
            {(resourceFormData.content_type === 'slides' || resourceFormData.content_type === 'document') && (
              <div className="space-y-2">
                <Label className="dark:text-gray-300 font-medium flex items-center gap-2">
                  <Upload className="w-4 h-4 text-blue-500" />
                  PDF File <span className="text-red-500">*</span>
                </Label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      if (file.type !== 'application/pdf') {
                        toast.error('Please select a PDF file');
                        return;
                      }
                      if (file.size > 100 * 1024 * 1024) {
                        toast.error('File size must be less than 100MB');
                        return;
                      }
                      setSelectedFile(file);
                    }
                  }}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    "w-full h-24 border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-all",
                    "dark:border-gray-700 dark:bg-gray-950 dark:text-white",
                    "hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/20",
                    selectedFile && "border-green-500 dark:border-green-500 bg-green-50 dark:bg-green-950/20"
                  )}
                >
                  {selectedFile ? (
                    <>
                      <FileText className="w-8 h-8 text-green-500" />
                      <span className="text-sm font-medium text-green-600 dark:text-green-400">{selectedFile.name}</span>
                      <span className="text-xs text-gray-500">
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                      </span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-8 h-8 text-gray-400" />
                      <span className="text-sm text-gray-600 dark:text-gray-400">Click to select PDF file</span>
                      <span className="text-xs text-gray-400">Max 100MB</span>
                    </>
                  )}
                </Button>
                {editingResource && !selectedFile && (
                  <p className="text-xs text-amber-500 dark:text-amber-400">
                    Leave empty to keep existing file
                  </p>
                )}

                {/* Upload Progress Indicator */}
                {selectedFile && uploadStatus === 'uploading' && (
                  <div className="mt-3 space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-600 dark:text-gray-400">Uploading...</span>
                      <span className="font-medium tabular-nums text-blue-600 dark:text-blue-400">
                        {uploadProgressPercent}%
                      </span>
                    </div>
                    <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-300 ease-out"
                        style={{ width: `${uploadProgressPercent}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {(selectedFile.size / 1024 / 1024).toFixed(1)} MB • Direct upload to storage
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Session Number and Duration */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="resource-session" className="dark:text-gray-300 font-medium">Session #</Label>
                <Input
                  id="resource-session"
                  type="number"
                  placeholder="1"
                  value={resourceFormData.session_number}
                  onChange={(e) => setResourceFormData({ ...resourceFormData, session_number: e.target.value })}
                  className="dark:bg-gray-950 dark:border-gray-700 dark:text-white h-11"
                />
              </div>
              {resourceFormData.content_type === 'video' && (
                <div className="space-y-2">
                  <Label htmlFor="resource-duration" className="dark:text-gray-300 font-medium">Duration (sec)</Label>
                  <Input
                    id="resource-duration"
                    type="number"
                    placeholder="3600"
                    value={resourceFormData.duration_seconds}
                    onChange={(e) => setResourceFormData({ ...resourceFormData, duration_seconds: e.target.value })}
                    className="dark:bg-gray-950 dark:border-gray-700 dark:text-white h-11"
                  />
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowResourceForm(false)}
              className="dark:border-gray-700 dark:text-white dark:hover:bg-gray-800"
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              onClick={editingResource ? handleUpdateResource : handleCreateResource}
              disabled={
                saving ||
                !resourceFormData.title.trim() ||
                (resourceFormData.content_type === 'video' && !resourceFormData.youtube_url.trim()) ||
                (resourceFormData.content_type !== 'video' && !selectedFile && !editingResource)
              }
              className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white"
            >
              {saving ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {uploadStatus === 'requesting-url' && 'Preparing...'}
                  {uploadStatus === 'uploading' && (
                    <span className="tabular-nums">{uploadProgressPercent}%</span>
                  )}
                  {uploadStatus === 'confirming' && 'Saving...'}
                  {uploadStatus === 'idle' && uploadProgress && 'Uploading...'}
                  {uploadStatus === 'idle' && !uploadProgress && 'Saving...'}
                </div>
              ) : (
                editingResource ? 'Update' : 'Add'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Case Study Form Dialog */}
      <Dialog open={showCaseStudyForm} onOpenChange={setShowCaseStudyForm}>
        <DialogContent className="dark:bg-gray-900 dark:border-gray-700 sm:max-w-[600px]">
          <DialogHeader className="pb-2">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <DialogTitle className="dark:text-white text-2xl">
                {editingCaseStudy ? 'Edit Case Study' : 'Add New Case Study'}
              </DialogTitle>
            </div>
            <DialogDescription className="dark:text-gray-400 text-base">
              {editingCaseStudy ? 'Update case study details and resources' : 'Add a case study with problem statement and solution documents'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-4">
            <div className="space-y-2">
              <Label htmlFor="cs-title" className="dark:text-gray-300 font-medium flex items-center gap-1">
                Title <span className="text-red-500">*</span>
              </Label>
              <Input
                id="cs-title"
                placeholder="e.g., Case Study 1: Culture Compass"
                value={caseStudyFormData.title}
                onChange={(e) => setCaseStudyFormData({ ...caseStudyFormData, title: e.target.value })}
                className="dark:bg-gray-950 dark:border-gray-700 dark:text-white h-11 text-base"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cs-description" className="dark:text-gray-300 font-medium">Description</Label>
              <Textarea
                id="cs-description"
                placeholder="Brief description of the case study and learning objectives..."
                value={caseStudyFormData.description}
                onChange={(e) => setCaseStudyFormData({ ...caseStudyFormData, description: e.target.value })}
                className="dark:bg-gray-950 dark:border-gray-700 dark:text-white min-h-[80px] text-base resize-none"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cs-problem" className="dark:text-gray-300 font-medium flex items-center gap-2">
                <FileText className="w-4 h-4 text-orange-500" />
                Problem Document URL
              </Label>
              <Input
                id="cs-problem"
                placeholder="https://docs.google.com/document/d/..."
                value={caseStudyFormData.problem_doc_url}
                onChange={(e) => setCaseStudyFormData({ ...caseStudyFormData, problem_doc_url: e.target.value })}
                className="dark:bg-gray-950 dark:border-gray-700 dark:text-white h-11 text-base"
              />
              <p className="text-xs text-muted-foreground dark:text-gray-500">Google Docs URL for the problem statement</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cs-solution" className="dark:text-gray-300 font-medium flex items-center gap-2">
                <FileText className="w-4 h-4 text-green-500" />
                Solution Document URL
              </Label>
              <Input
                id="cs-solution"
                placeholder="https://docs.google.com/document/d/..."
                value={caseStudyFormData.solution_doc_url}
                onChange={(e) => setCaseStudyFormData({ ...caseStudyFormData, solution_doc_url: e.target.value })}
                className="dark:bg-gray-950 dark:border-gray-700 dark:text-white h-11 text-base"
              />
              <p className="text-xs text-muted-foreground dark:text-gray-500">Google Docs URL for the solution</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-2">
                <Label htmlFor="cs-due" className="dark:text-gray-300 font-medium">Due Date</Label>
                <Input
                  id="cs-due"
                  type="date"
                  value={caseStudyFormData.due_date}
                  onChange={(e) => setCaseStudyFormData({ ...caseStudyFormData, due_date: e.target.value })}
                  className="dark:bg-gray-950 dark:border-gray-700 dark:text-white h-11 text-base"
                />
                <p className="text-xs text-muted-foreground dark:text-gray-500">Optional submission deadline</p>
              </div>
              <div className="space-y-2">
                <Label className="dark:text-gray-300 font-medium">Solution Visibility</Label>
                <div className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-950/50 h-11">
                  <Switch
                    id="cs-visible"
                    checked={caseStudyFormData.solution_visible}
                    onCheckedChange={(checked) => setCaseStudyFormData({ ...caseStudyFormData, solution_visible: checked })}
                  />
                  <Label htmlFor="cs-visible" className="text-sm cursor-pointer dark:text-gray-300">
                    Visible to Students
                  </Label>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowCaseStudyForm(false)}
              className="dark:border-gray-700 dark:text-white dark:hover:bg-gray-800 h-11"
            >
              Cancel
            </Button>
            <Button
              onClick={editingCaseStudy ? handleUpdateCaseStudy : handleCreateCaseStudy}
              disabled={saving || !caseStudyFormData.title.trim()}
              className="bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white h-11 px-6 shadow-md"
            >
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingCaseStudy ? 'Update Case Study' : 'Create Case Study'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
