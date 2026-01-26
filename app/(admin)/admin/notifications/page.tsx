'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Bell,
  Plus,
  Mail,
  MessageSquare,
  Phone,
  Edit,
  Trash2,
  Copy,
  Eye,
  Loader2,
  FileText,
  Users,
  Send,
  BarChart3,
  Upload,
  UserPlus,
  FolderPlus,
  Info,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Settings,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { CSVImportDialog } from '@/components/admin/notifications/csv-import-dialog';
import { RecipientSelector } from '@/components/admin/notifications/recipient-selector';
import { VariableEditor } from '@/components/admin/notifications/variable-editor';

interface NotificationTemplate {
  id: string;
  name: string;
  description?: string;
  subject?: string;
  body: string;
  variables: Array<{ name: string; example: string }>;
  channel: 'email' | 'sms' | 'whatsapp';
  is_active: boolean;
  created_at: string;
}

interface ContactList {
  id: string;
  name: string;
  description?: string;
  tags: string[];
  contact_count: number;
  created_at: string;
}

interface Contact {
  id: string;
  list_id: string;
  email?: string;
  phone?: string;
  name?: string;
  metadata: Record<string, any>;
  unsubscribed: boolean;
  created_at: string;
}

export default function AdminNotificationsPage() {
  const [activeTab, setActiveTab] = useState('templates');
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Template form state
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<NotificationTemplate | null>(null);
  const [templateFormData, setTemplateFormData] = useState({
    name: '',
    description: '',
    subject: '',
    body: '',
    variables: [] as Array<{ name: string; example: string }>,
    channel: 'email' as 'email' | 'sms' | 'whatsapp',
  });

  // Preview state
  const [previewTemplate, setPreviewTemplate] = useState<NotificationTemplate | null>(null);

  // Contact lists state
  const [contactLists, setContactLists] = useState<ContactList[]>([]);
  const [selectedList, setSelectedList] = useState<ContactList | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [showListForm, setShowListForm] = useState(false);
  const [showContactForm, setShowContactForm] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [editingList, setEditingList] = useState<ContactList | null>(null);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [listFormData, setListFormData] = useState({
    name: '',
    description: '',
    tags: [] as string[],
  });
  const [contactFormData, setContactFormData] = useState({
    email: '',
    phone: '',
    name: '',
  });

  // Composer state
  const [composeStep, setComposeStep] = useState(1);
  const [selectedTemplate, setSelectedTemplate] = useState<NotificationTemplate | null>(null);
  const [selectedCohorts, setSelectedCohorts] = useState<string[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [selectedContactLists, setSelectedContactLists] = useState<string[]>([]);
  const [manualEmails, setManualEmails] = useState('');
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const [recipientCount, setRecipientCount] = useState(0);
  const [scheduledFor, setScheduledFor] = useState('');
  const [priority, setPriority] = useState<'high' | 'normal' | 'low'>('normal');
  const [sending, setSending] = useState(false);
  const [previewContent, setPreviewContent] = useState<{ subject: string; body: string } | null>(null);

  // Analytics & Logs state
  const [analytics, setAnalytics] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [logsTotal, setLogsTotal] = useState(0);
  const [logsPage, setLogsPage] = useState(1);
  const [logsLimit] = useState(50);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [logsFilter, setLogsFilter] = useState({
    status: '',
    recipient: '',
    from: '',
    to: '',
  });

  useEffect(() => {
    fetchTemplates();
  }, []);

  useEffect(() => {
    if (activeTab === 'contacts') {
      fetchContactLists();
    }
  }, [activeTab]);

  useEffect(() => {
    if (composeStep === 2) {
      fetchRecipientCount();
    }
  }, [selectedCohorts, selectedUsers, selectedContactLists, manualEmails, composeStep]);

  useEffect(() => {
    if (composeStep === 3 && selectedTemplate) {
      handlePreviewNotification();
    }
  }, [variableValues, composeStep, selectedTemplate]);

  useEffect(() => {
    if (activeTab === 'logs') {
      fetchAnalytics();
      fetchLogs();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'logs') {
      fetchLogs();
    }
  }, [logsPage, logsFilter]);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/notifications/templates');
      if (!response.ok) throw new Error('Failed to fetch templates');
      const result = await response.json();
      setTemplates(result.data || []);
    } catch (error) {
      console.error('Error fetching templates:', error);
      toast.error('Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  const openCreateTemplate = () => {
    setEditingTemplate(null);
    setTemplateFormData({
      name: '',
      description: '',
      subject: '',
      body: '',
      variables: [],
      channel: 'email',
    });
    setShowTemplateForm(true);
  };

  const openEditTemplate = (template: NotificationTemplate) => {
    setEditingTemplate(template);
    setTemplateFormData({
      name: template.name,
      description: template.description || '',
      subject: template.subject || '',
      body: template.body,
      variables: template.variables || [],
      channel: template.channel,
    });
    setShowTemplateForm(true);
  };

  const handleCreateTemplate = async () => {
    if (!templateFormData.name.trim() || !templateFormData.body.trim()) {
      toast.error('Name and body are required');
      return;
    }

    try {
      setSaving(true);
      const response = await fetch('/api/admin/notifications/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(templateFormData),
      });

      if (!response.ok) throw new Error('Failed to create template');

      toast.success('Template created successfully');
      setShowTemplateForm(false);
      await fetchTemplates();
    } catch (error) {
      console.error('Error creating template:', error);
      toast.error('Failed to create template');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateTemplate = async () => {
    if (!editingTemplate) return;

    try {
      setSaving(true);
      const response = await fetch('/api/admin/notifications/templates', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingTemplate.id,
          ...templateFormData,
        }),
      });

      if (!response.ok) throw new Error('Failed to update template');

      toast.success('Template updated successfully');
      setShowTemplateForm(false);
      await fetchTemplates();
    } catch (error) {
      console.error('Error updating template:', error);
      toast.error('Failed to update template');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm('Delete this template? This action cannot be undone.')) return;

    try {
      const response = await fetch(`/api/admin/notifications/templates?id=${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete template');

      toast.success('Template deleted');
      await fetchTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
      toast.error('Failed to delete template');
    }
  };

  // Contact list functions
  const fetchContactLists = async () => {
    try {
      setLoadingContacts(true);
      const response = await fetch('/api/admin/notifications/contacts');
      if (!response.ok) throw new Error('Failed to fetch contact lists');
      const result = await response.json();
      setContactLists(result.data || []);
    } catch (error) {
      console.error('Error fetching contact lists:', error);
      toast.error('Failed to load contact lists');
    } finally {
      setLoadingContacts(false);
    }
  };

  const fetchContacts = async (listId: string) => {
    try {
      setLoadingContacts(true);
      const response = await fetch(`/api/admin/notifications/contacts?list_id=${listId}`);
      if (!response.ok) throw new Error('Failed to fetch contacts');
      const result = await response.json();
      setContacts(result.data || []);
    } catch (error) {
      console.error('Error fetching contacts:', error);
      toast.error('Failed to load contacts');
    } finally {
      setLoadingContacts(false);
    }
  };

  const openCreateList = () => {
    setEditingList(null);
    setListFormData({ name: '', description: '', tags: [] });
    setShowListForm(true);
  };

  const openEditList = (list: ContactList) => {
    setEditingList(list);
    setListFormData({
      name: list.name,
      description: list.description || '',
      tags: list.tags || [],
    });
    setShowListForm(true);
  };

  const handleCreateList = async () => {
    try {
      setSaving(true);
      const response = await fetch('/api/admin/notifications/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(listFormData),
      });

      if (!response.ok) throw new Error('Failed to create list');

      toast.success('Contact list created');
      setShowListForm(false);
      await fetchContactLists();
    } catch (error) {
      console.error('Error creating list:', error);
      toast.error('Failed to create contact list');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateList = async () => {
    if (!editingList) return;

    try {
      setSaving(true);
      const response = await fetch('/api/admin/notifications/contacts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingList.id,
          type: 'list',
          ...listFormData,
        }),
      });

      if (!response.ok) throw new Error('Failed to update list');

      toast.success('Contact list updated');
      setShowListForm(false);
      await fetchContactLists();
      if (selectedList?.id === editingList.id) {
        setSelectedList({ ...editingList, ...listFormData } as ContactList);
      }
    } catch (error) {
      console.error('Error updating list:', error);
      toast.error('Failed to update contact list');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteList = async (id: string) => {
    if (!confirm('Delete this contact list and all its contacts? This action cannot be undone.')) return;

    try {
      const response = await fetch(`/api/admin/notifications/contacts?id=${id}&type=list`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete list');

      toast.success('Contact list deleted');
      if (selectedList?.id === id) {
        setSelectedList(null);
        setContacts([]);
      }
      await fetchContactLists();
    } catch (error) {
      console.error('Error deleting list:', error);
      toast.error('Failed to delete contact list');
    }
  };

  const openCreateContact = () => {
    setEditingContact(null);
    setContactFormData({ email: '', phone: '', name: '' });
    setShowContactForm(true);
  };

  const openEditContact = (contact: Contact) => {
    setEditingContact(contact);
    setContactFormData({
      email: contact.email || '',
      phone: contact.phone || '',
      name: contact.name || '',
    });
    setShowContactForm(true);
  };

  const handleCreateContact = async () => {
    if (!selectedList) return;

    try {
      setSaving(true);
      const response = await fetch('/api/admin/notifications/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          list_id: selectedList.id,
          contacts: [contactFormData],
        }),
      });

      if (!response.ok) throw new Error('Failed to create contact');

      toast.success('Contact added');
      setShowContactForm(false);
      await fetchContacts(selectedList.id);
      await fetchContactLists();
    } catch (error) {
      console.error('Error creating contact:', error);
      toast.error('Failed to add contact');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateContact = async () => {
    if (!editingContact || !selectedList) return;

    try {
      setSaving(true);
      const response = await fetch('/api/admin/notifications/contacts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingContact.id,
          type: 'contact',
          ...contactFormData,
        }),
      });

      if (!response.ok) throw new Error('Failed to update contact');

      toast.success('Contact updated');
      setShowContactForm(false);
      await fetchContacts(selectedList.id);
    } catch (error) {
      console.error('Error updating contact:', error);
      toast.error('Failed to update contact');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteContact = async (id: string) => {
    if (!confirm('Delete this contact? This action cannot be undone.')) return;

    try {
      const response = await fetch(`/api/admin/notifications/contacts?id=${id}&type=contact`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete contact');

      toast.success('Contact deleted');
      if (selectedList) {
        await fetchContacts(selectedList.id);
        await fetchContactLists();
      }
    } catch (error) {
      console.error('Error deleting contact:', error);
      toast.error('Failed to delete contact');
    }
  };

  const handleImportComplete = async () => {
    if (selectedList) {
      await fetchContacts(selectedList.id);
      await fetchContactLists();
    }
  };

  // Composer functions
  const fetchRecipientCount = async () => {
    try {
      const emailsArray = manualEmails
        .split('\n')
        .map((e) => e.trim())
        .filter(Boolean);

      const response = await fetch('/api/admin/notifications/compose/recipients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cohort_ids: selectedCohorts,
          user_ids: selectedUsers,
          contact_list_ids: selectedContactLists,
          emails: emailsArray,
        }),
      });

      if (!response.ok) throw new Error('Failed to count recipients');

      const result = await response.json();
      setRecipientCount(result.data.count);
    } catch (error) {
      console.error('Error counting recipients:', error);
      toast.error('Failed to count recipients');
    }
  };

  const handlePreviewNotification = async () => {
    if (!selectedTemplate) return;

    try {
      const response = await fetch('/api/admin/notifications/compose/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template_id: selectedTemplate.id,
          variables: variableValues,
        }),
      });

      if (!response.ok) throw new Error('Failed to preview notification');

      const result = await response.json();
      setPreviewContent(result.data);
    } catch (error) {
      console.error('Error previewing notification:', error);
      toast.error('Failed to preview notification');
    }
  };

  // Analytics & Logs functions
  const fetchAnalytics = async () => {
    try {
      setLoadingAnalytics(true);
      const response = await fetch('/api/admin/notifications/analytics');
      if (!response.ok) throw new Error('Failed to fetch analytics');
      const result = await response.json();
      setAnalytics(result.data);
    } catch (error) {
      console.error('Error fetching analytics:', error);
      toast.error('Failed to load analytics');
    } finally {
      setLoadingAnalytics(false);
    }
  };

  const fetchLogs = async () => {
    try {
      setLoadingLogs(true);
      const params = new URLSearchParams({
        page: logsPage.toString(),
        limit: logsLimit.toString(),
      });

      if (logsFilter.status) params.append('status', logsFilter.status);
      if (logsFilter.recipient) params.append('recipient', logsFilter.recipient);
      if (logsFilter.from) params.append('from', logsFilter.from);
      if (logsFilter.to) params.append('to', logsFilter.to);

      const response = await fetch(`/api/admin/notifications/logs?${params}`);
      if (!response.ok) throw new Error('Failed to fetch logs');
      const result = await response.json();
      setLogs(result.data || []);
      setLogsTotal(result.total || 0);
    } catch (error) {
      console.error('Error fetching logs:', error);
      toast.error('Failed to load logs');
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleExportLogs = async () => {
    try {
      const params = new URLSearchParams();
      if (logsFilter.status) params.append('status', logsFilter.status);
      if (logsFilter.recipient) params.append('recipient', logsFilter.recipient);
      if (logsFilter.from) params.append('from', logsFilter.from);
      if (logsFilter.to) params.append('to', logsFilter.to);

      const response = await fetch(`/api/admin/notifications/export?${params}`);
      if (!response.ok) throw new Error('Failed to export logs');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `notification-logs-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('Logs exported successfully');
    } catch (error) {
      console.error('Error exporting logs:', error);
      toast.error('Failed to export logs');
    }
  };

  const handleSendNotification = async () => {
    if (!selectedTemplate) return;

    try {
      setSending(true);

      const emailsArray = manualEmails
        .split('\n')
        .map((e) => e.trim())
        .filter(Boolean);

      const recipientsConfig: any = {};

      if (selectedCohorts.length > 0) {
        recipientsConfig.type = 'cohorts';
        recipientsConfig.cohort_ids = selectedCohorts;
      }

      if (selectedUsers.length > 0) {
        if (!recipientsConfig.type) recipientsConfig.type = 'users';
        recipientsConfig.user_ids = selectedUsers;
      }

      if (selectedContactLists.length > 0) {
        if (!recipientsConfig.type) recipientsConfig.type = 'contacts';
        recipientsConfig.contact_list_ids = selectedContactLists;
      }

      if (emailsArray.length > 0) {
        if (!recipientsConfig.type) recipientsConfig.type = 'email_list';
        recipientsConfig.emails = emailsArray;
      }

      const payload: any = {
        template_id: selectedTemplate.id,
        recipients: recipientsConfig,
        variables: variableValues,
        priority,
      };

      if (scheduledFor) {
        payload.send_at = new Date(scheduledFor).toISOString();
      }

      const response = await fetch('/api/admin/notifications/compose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send notification');
      }

      const result = await response.json();

      toast.success(
        scheduledFor
          ? `Notification scheduled for ${result.data.recipient_count} recipients`
          : `Notification queued for ${result.data.recipient_count} recipients`
      );

      // Reset composer
      setComposeStep(1);
      setSelectedTemplate(null);
      setSelectedCohorts([]);
      setSelectedUsers([]);
      setSelectedContactLists([]);
      setManualEmails('');
      setVariableValues({});
      setRecipientCount(0);
      setScheduledFor('');
      setPriority('normal');
      setPreviewContent(null);
    } catch (error: any) {
      console.error('Error sending notification:', error);
      toast.error(error.message || 'Failed to send notification');
    } finally {
      setSending(false);
    }
  };

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'email':
        return <Mail className="w-4 h-4" />;
      case 'sms':
        return <MessageSquare className="w-4 h-4" />;
      case 'whatsapp':
        return <Phone className="w-4 h-4" />;
      default:
        return <Bell className="w-4 h-4" />;
    }
  };

  const getChannelColor = (channel: string) => {
    switch (channel) {
      case 'email':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
      case 'sms':
        return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
      case 'whatsapp':
        return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight dark:text-white">Notifications</h1>
          <p className="text-muted-foreground dark:text-gray-400 mt-1">
            Manage templates, send notifications, and track delivery
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
          <TabsTrigger value="templates" className="gap-2">
            <FileText className="w-4 h-4" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="contacts" className="gap-2">
            <Users className="w-4 h-4" />
            Contacts
          </TabsTrigger>
          <TabsTrigger value="compose" className="gap-2">
            <Send className="w-4 h-4" />
            Compose
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-2">
            <BarChart3 className="w-4 h-4" />
            Logs
          </TabsTrigger>
        </TabsList>

        {/* Templates Tab */}
        <TabsContent value="templates" className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground dark:text-gray-400">
              {templates.length} template{templates.length !== 1 ? 's' : ''}
            </p>
            <Button onClick={openCreateTemplate} className="gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
              <Plus className="w-4 h-4" />
              Create Template
            </Button>
          </div>

          {loading ? (
            <Card>
              <CardContent className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              </CardContent>
            </Card>
          ) : templates.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <div className="w-16 h-16 rounded-full bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center mx-auto mb-4">
                  <FileText className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                </div>
                <p className="text-lg font-semibold dark:text-white mb-2">No templates yet</p>
                <p className="text-sm text-muted-foreground dark:text-gray-400 mb-4">
                  Create your first notification template
                </p>
                <Button onClick={openCreateTemplate} className="gap-2">
                  <Plus className="w-4 h-4" />
                  Create Template
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {templates.map((template) => (
                <Card key={template.id} className="hover:shadow-lg transition-shadow dark:border-gray-700 dark:bg-gray-900/50">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge className={getChannelColor(template.channel)}>
                            <span className="flex items-center gap-1">
                              {getChannelIcon(template.channel)}
                              {template.channel.toUpperCase()}
                            </span>
                          </Badge>
                          {!template.is_active && (
                            <Badge variant="outline" className="text-xs">Inactive</Badge>
                          )}
                        </div>
                        <CardTitle className="text-lg dark:text-white">{template.name}</CardTitle>
                        {template.description && (
                          <CardDescription className="dark:text-gray-400 mt-1">
                            {template.description}
                          </CardDescription>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {template.subject && (
                      <div className="text-sm">
                        <span className="font-medium dark:text-gray-300">Subject:</span>{' '}
                        <span className="text-muted-foreground dark:text-gray-400">{template.subject}</span>
                      </div>
                    )}
                    {template.variables && template.variables.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {template.variables.map((v, i) => (
                          <Badge key={i} variant="secondary" className="text-xs font-mono">
                            {`{{${v.name}}}`}
                          </Badge>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2 pt-2">
                      <Button size="sm" variant="outline" onClick={() => setPreviewTemplate(template)} className="flex-1">
                        <Eye className="w-4 h-4 mr-1" />
                        Preview
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => openEditTemplate(template)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleDeleteTemplate(template.id)} className="text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Contact Lists Tab */}
        <TabsContent value="contacts" className="space-y-4">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-2xl font-bold">Contact Lists</h2>
              <p className="text-sm text-muted-foreground">
                Manage guest contacts and mailing lists
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={openCreateList}>
                <FolderPlus className="mr-2 h-4 w-4" />
                Create List
              </Button>
            </div>
          </div>

          {loadingContacts && !contactLists.length ? (
            <Card>
              <CardContent className="text-center py-12">
                <Loader2 className="w-8 h-8 mx-auto mb-4 animate-spin" />
                <p className="text-sm text-muted-foreground">Loading contact lists...</p>
              </CardContent>
            </Card>
          ) : contactLists.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <Users className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p className="text-lg font-medium mb-2">No contact lists yet</p>
                <p className="text-sm text-muted-foreground mb-4">
                  Create your first contact list to start managing guest contacts
                </p>
                <Button onClick={openCreateList}>
                  <FolderPlus className="mr-2 h-4 w-4" />
                  Create First List
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Contact Lists (Left Side) */}
              <div className="lg:col-span-1 space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Lists ({contactLists.length})</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {contactLists.map((list) => (
                      <div
                        key={list.id}
                        className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                          selectedList?.id === list.id
                            ? 'bg-primary/10 border-primary'
                            : 'hover:bg-muted'
                        }`}
                        onClick={() => {
                          setSelectedList(list);
                          fetchContacts(list.id);
                        }}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-semibold">{list.name}</h4>
                          <Badge variant="secondary">
                            {list.contact_count}
                          </Badge>
                        </div>
                        {list.description && (
                          <p className="text-sm text-muted-foreground mb-2">
                            {list.description}
                          </p>
                        )}
                        {list.tags && list.tags.length > 0 && (
                          <div className="flex gap-1 flex-wrap">
                            {list.tags.map((tag, i) => (
                              <Badge key={i} variant="outline" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                        <div className="flex gap-2 mt-3">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditList(list);
                            }}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteList(list.id);
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>

              {/* Contacts (Right Side) */}
              <div className="lg:col-span-2">
                {selectedList ? (
                  <Card>
                    <CardHeader>
                      <div className="flex justify-between items-center">
                        <div>
                          <CardTitle>{selectedList.name}</CardTitle>
                          <CardDescription>
                            {contacts.length} contact{contacts.length !== 1 ? 's' : ''}
                          </CardDescription>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setShowImportDialog(true)}
                          >
                            <Upload className="mr-2 h-4 w-4" />
                            Import CSV
                          </Button>
                          <Button size="sm" onClick={openCreateContact}>
                            <UserPlus className="mr-2 h-4 w-4" />
                            Add Contact
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {loadingContacts ? (
                        <div className="text-center py-8">
                          <Loader2 className="w-6 h-6 mx-auto mb-2 animate-spin" />
                          <p className="text-sm text-muted-foreground">Loading contacts...</p>
                        </div>
                      ) : contacts.length === 0 ? (
                        <div className="text-center py-8">
                          <UserPlus className="w-12 h-12 mx-auto mb-4 opacity-30" />
                          <p className="text-sm text-muted-foreground mb-4">
                            No contacts in this list yet
                          </p>
                          <div className="flex gap-2 justify-center">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setShowImportDialog(true)}
                            >
                              <Upload className="mr-2 h-4 w-4" />
                              Import CSV
                            </Button>
                            <Button size="sm" onClick={openCreateContact}>
                              <UserPlus className="mr-2 h-4 w-4" />
                              Add Contact
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {contacts.map((contact) => (
                            <div
                              key={contact.id}
                              className="flex justify-between items-center p-3 border rounded-lg hover:bg-muted"
                            >
                              <div>
                                <p className="font-medium">{contact.name || 'No name'}</p>
                                <div className="flex gap-4 text-sm text-muted-foreground">
                                  {contact.email && (
                                    <span className="flex items-center gap-1">
                                      <Mail className="h-3 w-3" />
                                      {contact.email}
                                    </span>
                                  )}
                                  {contact.phone && (
                                    <span className="flex items-center gap-1">
                                      <Phone className="h-3 w-3" />
                                      {contact.phone}
                                    </span>
                                  )}
                                </div>
                                {contact.unsubscribed && (
                                  <Badge variant="destructive" className="mt-1">
                                    Unsubscribed
                                  </Badge>
                                )}
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => openEditContact(contact)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleDeleteContact(contact.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardContent className="text-center py-16">
                      <Users className="w-16 h-16 mx-auto mb-4 opacity-30" />
                      <p className="text-lg font-medium">Select a contact list</p>
                      <p className="text-sm text-muted-foreground">
                        Choose a list from the left to view and manage contacts
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          )}
        </TabsContent>

        {/* Compose Tab */}
        <TabsContent value="compose" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Compose Notification</CardTitle>
                  <CardDescription>
                    Send notifications to cohorts, users, and contacts
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-sm text-muted-foreground">
                    Step {composeStep} of 3
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Step 1: Select Template */}
              {composeStep === 1 && (
                <div className="space-y-4">
                  <div>
                    <Label>Select Template *</Label>
                    <p className="text-xs text-muted-foreground mb-3">
                      Choose a notification template to send
                    </p>
                  </div>

                  {templates.length === 0 ? (
                    <div className="text-center py-8">
                      <FileText className="w-12 h-12 mx-auto mb-4 opacity-30" />
                      <p className="text-sm text-muted-foreground mb-4">
                        No templates available. Create a template first.
                      </p>
                      <Button onClick={() => setActiveTab('templates')}>
                        Go to Templates
                      </Button>
                    </div>
                  ) : (
                    <div className="grid gap-3">
                      {templates.map((template) => (
                        <div
                          key={template.id}
                          className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                            selectedTemplate?.id === template.id
                              ? 'bg-primary/10 border-primary'
                              : 'hover:bg-muted'
                          }`}
                          onClick={() => setSelectedTemplate(template)}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              {getChannelIcon(template.channel)}
                              <h4 className="font-semibold">{template.name}</h4>
                            </div>
                            <Badge variant={template.is_active ? 'default' : 'secondary'}>
                              {template.channel}
                            </Badge>
                          </div>
                          {template.description && (
                            <p className="text-sm text-muted-foreground mb-2">
                              {template.description}
                            </p>
                          )}
                          {template.variables && template.variables.length > 0 && (
                            <div className="flex gap-1 flex-wrap">
                              {template.variables.map((v, i) => (
                                <Badge key={i} variant="outline" className="text-xs font-mono">
                                  {`{{${v.name}}}`}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex justify-end pt-4">
                    <Button
                      onClick={() => setComposeStep(2)}
                      disabled={!selectedTemplate}
                    >
                      Next: Select Recipients
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 2: Select Recipients */}
              {composeStep === 2 && selectedTemplate && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Select Recipients *</Label>
                      <p className="text-xs text-muted-foreground">
                        Choose who will receive this notification
                      </p>
                    </div>
                    {recipientCount > 0 && (
                      <Badge variant="secondary" className="text-lg px-3 py-1">
                        {recipientCount} recipient{recipientCount !== 1 ? 's' : ''}
                      </Badge>
                    )}
                  </div>

                  <RecipientSelector
                    selectedCohorts={selectedCohorts}
                    selectedUsers={selectedUsers}
                    selectedContactLists={selectedContactLists}
                    manualEmails={manualEmails}
                    onCohortsChange={setSelectedCohorts}
                    onUsersChange={setSelectedUsers}
                    onContactListsChange={setSelectedContactLists}
                    onManualEmailsChange={setManualEmails}
                  />

                  <div className="flex justify-between pt-4">
                    <Button
                      variant="outline"
                      onClick={() => setComposeStep(1)}
                    >
                      Back
                    </Button>
                    <Button
                      onClick={() => setComposeStep(3)}
                      disabled={recipientCount === 0}
                    >
                      Next: Review & Send
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 3: Review & Send */}
              {composeStep === 3 && selectedTemplate && (
                <div className="space-y-4">
                  <div className="grid gap-4">
                    {/* Variables */}
                    {selectedTemplate.variables && selectedTemplate.variables.length > 0 && (
                      <div>
                        <Label className="mb-3 block">Template Variables</Label>
                        <VariableEditor
                          variables={selectedTemplate.variables}
                          values={variableValues}
                          onChange={setVariableValues}
                        />
                      </div>
                    )}

                    {/* Preview */}
                    {previewContent && (
                      <div>
                        <Label className="mb-3 block">Preview</Label>
                        <div className="border rounded-lg p-4 space-y-3 bg-muted/50">
                          {previewContent.subject && (
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Subject:</p>
                              <p className="font-semibold">{previewContent.subject}</p>
                            </div>
                          )}
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Body:</p>
                            {selectedTemplate.channel === 'email' ? (
                              <div
                                dangerouslySetInnerHTML={{ __html: previewContent.body }}
                                className="prose dark:prose-invert max-w-none"
                              />
                            ) : (
                              <pre className="whitespace-pre-wrap font-sans">
                                {previewContent.body}
                              </pre>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Send Options */}
                    <div className="space-y-3">
                      <Label>Send Options</Label>
                      <div className="grid gap-3">
                        <div className="space-y-2">
                          <Label htmlFor="schedule">Schedule (optional)</Label>
                          <Input
                            id="schedule"
                            type="datetime-local"
                            value={scheduledFor}
                            onChange={(e) => setScheduledFor(e.target.value)}
                          />
                          <p className="text-xs text-muted-foreground">
                            Leave empty to send immediately
                          </p>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="priority">Priority</Label>
                          <Select value={priority} onValueChange={(v: any) => setPriority(v)}>
                            <SelectTrigger id="priority">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="high">High</SelectItem>
                              <SelectItem value="normal">Normal</SelectItem>
                              <SelectItem value="low">Low</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>

                    {/* Summary */}
                    <div className="border rounded-lg p-4 bg-blue-50 dark:bg-blue-950/20">
                      <h4 className="font-semibold mb-2">Summary</h4>
                      <div className="space-y-1 text-sm">
                        <p>
                          <strong>Template:</strong> {selectedTemplate.name}
                        </p>
                        <p>
                          <strong>Channel:</strong> {selectedTemplate.channel}
                        </p>
                        <p>
                          <strong>Recipients:</strong> {recipientCount}
                        </p>
                        <p>
                          <strong>When:</strong>{' '}
                          {scheduledFor
                            ? new Date(scheduledFor).toLocaleString()
                            : 'Immediately'}
                        </p>
                        <p>
                          <strong>Priority:</strong> {priority}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between pt-4">
                    <Button
                      variant="outline"
                      onClick={() => setComposeStep(2)}
                    >
                      Back
                    </Button>
                    <Button
                      onClick={handleSendNotification}
                      disabled={sending || recipientCount === 0}
                    >
                      {sending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Sending...
                        </>
                      ) : scheduledFor ? (
                        'Schedule Notification'
                      ) : (
                        'Send Now'
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Logs Tab */}
        <TabsContent value="logs" className="space-y-4">
          {/* Analytics Cards */}
          {loadingAnalytics ? (
            <Card>
              <CardContent className="text-center py-12">
                <Loader2 className="w-8 h-8 mx-auto mb-4 animate-spin" />
                <p className="text-sm text-muted-foreground">Loading analytics...</p>
              </CardContent>
            </Card>
          ) : analytics ? (
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Total Sent</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{analytics.total_sent}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Delivery Rate</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{analytics.delivery_rate}%</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {analytics.delivered} delivered
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Open Rate</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{analytics.open_rate}%</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {analytics.opened} opened
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Click Rate</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{analytics.click_rate}%</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {analytics.clicked} clicked
                  </p>
                </CardContent>
              </Card>
            </div>
          ) : null}

          {/* Logs Table */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle>Notification Logs</CardTitle>
                  <CardDescription>
                    View and filter notification delivery logs
                  </CardDescription>
                </div>
                <Button size="sm" variant="outline" onClick={handleExportLogs}>
                  Export CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Filters */}
              <div className="grid gap-3 md:grid-cols-4">
                <div className="space-y-2">
                  <Label htmlFor="filter-status">Status</Label>
                  <Select
                    value={logsFilter.status}
                    onValueChange={(v) => setLogsFilter({ ...logsFilter, status: v })}
                  >
                    <SelectTrigger id="filter-status">
                      <SelectValue placeholder="All statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All statuses</SelectItem>
                      <SelectItem value="sent">Sent</SelectItem>
                      <SelectItem value="delivered">Delivered</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                      <SelectItem value="bounced">Bounced</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="filter-recipient">Recipient</Label>
                  <Input
                    id="filter-recipient"
                    placeholder="Email or phone..."
                    value={logsFilter.recipient}
                    onChange={(e) =>
                      setLogsFilter({ ...logsFilter, recipient: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="filter-from">From Date</Label>
                  <Input
                    id="filter-from"
                    type="date"
                    value={logsFilter.from}
                    onChange={(e) =>
                      setLogsFilter({ ...logsFilter, from: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="filter-to">To Date</Label>
                  <Input
                    id="filter-to"
                    type="date"
                    value={logsFilter.to}
                    onChange={(e) =>
                      setLogsFilter({ ...logsFilter, to: e.target.value })
                    }
                  />
                </div>
              </div>

              {/* Logs Table */}
              {loadingLogs ? (
                <div className="text-center py-8">
                  <Loader2 className="w-6 h-6 mx-auto mb-2 animate-spin" />
                  <p className="text-sm text-muted-foreground">Loading logs...</p>
                </div>
              ) : logs.length === 0 ? (
                <div className="text-center py-8">
                  <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-30" />
                  <p className="text-sm text-muted-foreground">No logs found</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="border rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-muted">
                          <tr>
                            <th className="px-4 py-3 text-left font-medium">Timestamp</th>
                            <th className="px-4 py-3 text-left font-medium">Template</th>
                            <th className="px-4 py-3 text-left font-medium">Channel</th>
                            <th className="px-4 py-3 text-left font-medium">Recipient</th>
                            <th className="px-4 py-3 text-left font-medium">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {logs.map((log: any) => (
                            <tr key={log.id} className="hover:bg-muted/50">
                              <td className="px-4 py-3">
                                {log.created_at
                                  ? new Date(log.created_at).toLocaleString()
                                  : 'Pending'}
                              </td>
                              <td className="px-4 py-3">
                                {log.notification_jobs?.notification_templates?.name ||
                                  'Unknown'}
                              </td>
                              <td className="px-4 py-3">
                                <Badge variant="outline">
                                  {log.notification_jobs?.channel || 'N/A'}
                                </Badge>
                              </td>
                              <td className="px-4 py-3 font-mono text-xs">
                                {log.recipient_email || log.recipient_phone || 'N/A'}
                              </td>
                              <td className="px-4 py-3">
                                <Badge
                                  variant={
                                    log.event_type === 'sent'
                                      ? 'default'
                                      : log.event_type === 'failed'
                                      ? 'destructive'
                                      : 'secondary'
                                  }
                                >
                                  {log.event_type}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Pagination */}
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      Showing {(logsPage - 1) * logsLimit + 1} to{' '}
                      {Math.min(logsPage * logsLimit, logsTotal)} of {logsTotal} logs
                    </p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setLogsPage(Math.max(1, logsPage - 1))}
                        disabled={logsPage === 1}
                      >
                        Previous
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setLogsPage(logsPage + 1)}
                        disabled={logsPage * logsLimit >= logsTotal}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Template Form Dialog - Enhanced with tooltips and help */}
      <Dialog open={showTemplateForm} onOpenChange={setShowTemplateForm}>
        <DialogContent className="dark:bg-gray-900 dark:border-gray-700 sm:max-w-[750px] max-h-[90vh] overflow-y-auto">
          <DialogHeader className="pb-3 border-b dark:border-gray-800">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <DialogTitle className="dark:text-white text-2xl font-bold">
                  {editingTemplate ? 'Edit Template' : 'Create Notification Template'}
                </DialogTitle>
                <DialogDescription className="dark:text-gray-400 text-sm mt-1">
                  {editingTemplate
                    ? 'Update your reusable notification template'
                    : 'Design a reusable template that can be sent via email, SMS, or WhatsApp'}
                </DialogDescription>
              </div>
            </div>
            <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-blue-900 dark:text-blue-300">
                <strong>Integration Ready:</strong> Templates support dynamic variables and can be triggered via API, scheduled rules, or manual sending. Perfect for integrating with external tools like Zapier, Make, or custom webhooks.
              </p>
            </div>
          </DialogHeader>
          <div className="space-y-6 py-5">
            {/* Basic Information Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4 text-gray-500" />
                <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100">Basic Information</h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 col-span-2 sm:col-span-1">
                  <Label htmlFor="template-name" className="dark:text-gray-300 font-medium flex items-center gap-2">
                    Template Name <span className="text-red-500">*</span>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="w-3.5 h-3.5 text-gray-400 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p className="text-xs">A descriptive name to identify this template. This won't be seen by recipients.</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </Label>
                  <Input
                    id="template-name"
                    placeholder="e.g., Welcome Email, Session Reminder"
                    value={templateFormData.name}
                    onChange={(e) => setTemplateFormData({ ...templateFormData, name: e.target.value })}
                    className="dark:bg-gray-950 dark:border-gray-700 dark:text-white h-11 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="space-y-2 col-span-2 sm:col-span-1">
                  <Label htmlFor="template-channel" className="dark:text-gray-300 font-medium flex items-center gap-2">
                    Delivery Channel <span className="text-red-500">*</span>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="w-3.5 h-3.5 text-gray-400 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p className="text-xs">Choose how this notification will be delivered. Email supports HTML formatting, while SMS and WhatsApp use plain text.</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </Label>
                  <Select value={templateFormData.channel} onValueChange={(value: 'email' | 'sms' | 'whatsapp') => setTemplateFormData({ ...templateFormData, channel: value })}>
                    <SelectTrigger className="dark:bg-gray-950 dark:border-gray-700 dark:text-white h-11 focus:ring-2 focus:ring-blue-500">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="dark:bg-gray-900 dark:border-gray-700">
                      <SelectItem value="email" className="dark:text-white dark:focus:bg-gray-800">
                        <span className="flex items-center gap-2">
                          <Mail className="w-4 h-4" />
                          <div className="flex flex-col items-start">
                            <span>Email</span>
                            <span className="text-xs text-gray-500">HTML support, best for long content</span>
                          </div>
                        </span>
                      </SelectItem>
                      <SelectItem value="sms" className="dark:text-white dark:focus:bg-gray-800">
                        <span className="flex items-center gap-2">
                          <MessageSquare className="w-4 h-4" />
                          <div className="flex flex-col items-start">
                            <span>SMS</span>
                            <span className="text-xs text-gray-500">Plain text, 160 char limit</span>
                          </div>
                        </span>
                      </SelectItem>
                      <SelectItem value="whatsapp" className="dark:text-white dark:focus:bg-gray-800">
                        <span className="flex items-center gap-2">
                          <Phone className="w-4 h-4" />
                          <div className="flex flex-col items-start">
                            <span>WhatsApp</span>
                            <span className="text-xs text-gray-500">Rich messaging, requires API</span>
                          </div>
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  {templateFormData.channel === 'whatsapp' && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      WhatsApp requires Business API integration
                    </p>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="template-description" className="dark:text-gray-300 font-medium flex items-center gap-2">
                  Description <span className="text-gray-400 text-xs">(Optional)</span>
                </Label>
                <Input
                  id="template-description"
                  placeholder="e.g., Sent to new users upon enrollment in a cohort"
                  value={templateFormData.description}
                  onChange={(e) => setTemplateFormData({ ...templateFormData, description: e.target.value })}
                  className="dark:bg-gray-950 dark:border-gray-700 dark:text-white h-11"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400">Help your team understand when to use this template</p>
              </div>
            </div>

            {/* Message Content Section */}
            <div className="space-y-4 pt-4 border-t dark:border-gray-800">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-gray-500" />
                <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100">Message Content</h3>
              </div>
              {templateFormData.channel === 'email' && (
                <div className="space-y-2">
                  <Label htmlFor="template-subject" className="dark:text-gray-300 font-medium flex items-center gap-2">
                    Email Subject Line <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="template-subject"
                    placeholder="e.g., Welcome to {{cohort_name}}! 🎉"
                    value={templateFormData.subject}
                    onChange={(e) => setTemplateFormData({ ...templateFormData, subject: e.target.value })}
                    className="dark:bg-gray-950 dark:border-gray-700 dark:text-white h-11 focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 flex items-start gap-1">
                    <Zap className="w-3 h-3 mt-0.5 flex-shrink-0" />
                    Use double curly braces for variables: {`{{name}}`}, {`{{cohort_name}}`}, {`{{start_date}}`}
                  </p>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="template-body" className="dark:text-gray-300 font-medium flex items-center gap-2">
                  Message Body <span className="text-red-500">*</span>
                  {templateFormData.channel === 'email' && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge variant="secondary" className="text-xs cursor-help">HTML Supported</Badge>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p className="text-xs">You can use HTML tags like &lt;h1&gt;, &lt;p&gt;, &lt;strong&gt;, &lt;a&gt; for formatting.</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </Label>
                <Textarea
                  id="template-body"
                  placeholder={templateFormData.channel === 'email' ?
                    '<h1>Welcome {{name}}!</h1>\n<p>We\'re excited to have you join <strong>{{cohort_name}}</strong>.</p>\n<p>Your journey starts on {{start_date}}.</p>' :
                    'Hi {{name}}, your session "{{session_title}}" starts in {{time_until}}. Join here: {{link}}'
                  }
                  value={templateFormData.body}
                  onChange={(e) => setTemplateFormData({ ...templateFormData, body: e.target.value })}
                  className="dark:bg-gray-950 dark:border-gray-700 dark:text-white min-h-[180px] resize-none font-mono text-sm focus:ring-2 focus:ring-blue-500"
                />
                <div className="grid grid-cols-2 gap-3">
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {templateFormData.channel === 'email' ? (
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-green-600" />
                        Supports HTML formatting
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <Info className="w-3 h-3" />
                        Plain text only
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 text-right">
                    {templateFormData.body.length} characters
                  </div>
                </div>
              </div>
            </div>

            {/* Variables Guide */}
            <div className="p-4 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20 border border-purple-200 dark:border-purple-900 rounded-lg">
              <div className="flex items-start gap-3">
                <Zap className="w-5 h-5 text-purple-600 dark:text-purple-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <h4 className="font-semibold text-sm text-purple-900 dark:text-purple-100 mb-2">Dynamic Variables</h4>
                  <p className="text-xs text-purple-800 dark:text-purple-200 mb-3">
                    Use variables to personalize each message. Variables will be replaced with actual values when sending.
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <code className="px-2 py-1 bg-purple-100 dark:bg-purple-900/50 rounded text-purple-900 dark:text-purple-100">{`{{name}}`}</code>
                      <span className="text-purple-700 dark:text-purple-300">Recipient name</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="px-2 py-1 bg-purple-100 dark:bg-purple-900/50 rounded text-purple-900 dark:text-purple-100">{`{{cohort_name}}`}</code>
                      <span className="text-purple-700 dark:text-purple-300">Cohort name</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="px-2 py-1 bg-purple-100 dark:bg-purple-900/50 rounded text-purple-900 dark:text-purple-100">{`{{start_date}}`}</code>
                      <span className="text-purple-700 dark:text-purple-300">Start date</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="px-2 py-1 bg-purple-100 dark:bg-purple-900/50 rounded text-purple-900 dark:text-purple-100">{`{{link}}`}</code>
                      <span className="text-purple-700 dark:text-purple-300">Custom link</span>
                    </div>
                  </div>
                  <p className="text-xs text-purple-700 dark:text-purple-300 mt-3">
                    💡 <strong>Pro tip:</strong> You can define custom variables when sending the notification
                  </p>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowTemplateForm(false)} className="dark:border-gray-700 dark:text-white dark:hover:bg-gray-800 h-11">
              Cancel
            </Button>
            <Button
              onClick={editingTemplate ? handleUpdateTemplate : handleCreateTemplate}
              disabled={saving || !templateFormData.name.trim() || !templateFormData.body.trim()}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white h-11 px-6 shadow-md"
            >
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingTemplate ? 'Update Template' : 'Create Template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={!!previewTemplate} onOpenChange={() => setPreviewTemplate(null)}>
        <DialogContent className="dark:bg-gray-900 dark:border-gray-700 sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="dark:text-white flex items-center gap-2">
              {previewTemplate && getChannelIcon(previewTemplate.channel)}
              {previewTemplate?.name}
            </DialogTitle>
            <DialogDescription className="dark:text-gray-400">
              Template preview with example variables
            </DialogDescription>
          </DialogHeader>
          {previewTemplate && (
            <div className="space-y-4 py-4">
              {previewTemplate.subject && (
                <div>
                  <Label className="text-xs text-muted-foreground dark:text-gray-500">Subject</Label>
                  <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-950 border dark:border-gray-800 mt-1">
                    <p className="dark:text-white">{previewTemplate.subject}</p>
                  </div>
                </div>
              )}
              <div>
                <Label className="text-xs text-muted-foreground dark:text-gray-500">Body</Label>
                <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-950 border dark:border-gray-800 mt-1 max-h-[400px] overflow-y-auto">
                  {previewTemplate.channel === 'email' ? (
                    <div dangerouslySetInnerHTML={{ __html: previewTemplate.body }} className="prose dark:prose-invert max-w-none" />
                  ) : (
                    <pre className="whitespace-pre-wrap dark:text-white font-sans">{previewTemplate.body}</pre>
                  )}
                </div>
              </div>
              {previewTemplate.variables && previewTemplate.variables.length > 0 && (
                <div>
                  <Label className="text-xs text-muted-foreground dark:text-gray-500">Available Variables</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {previewTemplate.variables.map((v, i) => (
                      <div key={i} className="text-xs p-2 rounded bg-gray-100 dark:bg-gray-800">
                        <span className="font-mono font-semibold dark:text-white">{`{{${v.name}}}`}</span>
                        <span className="text-muted-foreground dark:text-gray-400"> = {v.example}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Contact List Form Dialog */}
      <Dialog open={showListForm} onOpenChange={setShowListForm}>
        <DialogContent className="dark:bg-gray-900 dark:border-gray-700 sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingList ? 'Edit Contact List' : 'Create Contact List'}</DialogTitle>
            <DialogDescription>
              {editingList
                ? 'Update the contact list details'
                : 'Create a new contact list to organize your guest contacts'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="list-name">Name *</Label>
              <Input
                id="list-name"
                value={listFormData.name}
                onChange={(e) =>
                  setListFormData({ ...listFormData, name: e.target.value })
                }
                placeholder="e.g., Newsletter Subscribers"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="list-description">Description</Label>
              <Textarea
                id="list-description"
                value={listFormData.description}
                onChange={(e) =>
                  setListFormData({ ...listFormData, description: e.target.value })
                }
                placeholder="Describe this contact list..."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="list-tags">Tags (comma-separated)</Label>
              <Input
                id="list-tags"
                value={listFormData.tags.join(', ')}
                onChange={(e) =>
                  setListFormData({
                    ...listFormData,
                    tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean),
                  })
                }
                placeholder="e.g., marketing, newsletter, leads"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowListForm(false)}>
              Cancel
            </Button>
            <Button
              onClick={editingList ? handleUpdateList : handleCreateList}
              disabled={!listFormData.name || saving}
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : editingList ? (
                'Update List'
              ) : (
                'Create List'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Contact Form Dialog */}
      <Dialog open={showContactForm} onOpenChange={setShowContactForm}>
        <DialogContent className="dark:bg-gray-900 dark:border-gray-700 sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingContact ? 'Edit Contact' : 'Add Contact'}</DialogTitle>
            <DialogDescription>
              {editingContact
                ? 'Update the contact details'
                : 'Add a new contact to this list'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="contact-name">Name</Label>
              <Input
                id="contact-name"
                value={contactFormData.name}
                onChange={(e) =>
                  setContactFormData({ ...contactFormData, name: e.target.value })
                }
                placeholder="John Doe"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-email">Email</Label>
              <Input
                id="contact-email"
                type="email"
                value={contactFormData.email}
                onChange={(e) =>
                  setContactFormData({ ...contactFormData, email: e.target.value })
                }
                placeholder="john@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-phone">Phone</Label>
              <Input
                id="contact-phone"
                type="tel"
                value={contactFormData.phone}
                onChange={(e) =>
                  setContactFormData({ ...contactFormData, phone: e.target.value })
                }
                placeholder="+1234567890"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              * At least email or phone is required
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowContactForm(false)}>
              Cancel
            </Button>
            <Button
              onClick={editingContact ? handleUpdateContact : handleCreateContact}
              disabled={(!contactFormData.email && !contactFormData.phone) || saving}
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : editingContact ? (
                'Update Contact'
              ) : (
                'Add Contact'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CSV Import Dialog */}
      {selectedList && (
        <CSVImportDialog
          open={showImportDialog}
          onOpenChange={setShowImportDialog}
          listId={selectedList.id}
          onImportComplete={handleImportComplete}
        />
      )}
    </div>
  );
}
