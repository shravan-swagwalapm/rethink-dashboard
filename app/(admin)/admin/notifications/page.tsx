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
} from 'lucide-react';
import { toast } from 'sonner';

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

  useEffect(() => {
    fetchTemplates();
  }, []);

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
          <Card>
            <CardContent className="text-center py-12">
              <Users className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium">Contact Lists - Coming Soon</p>
              <p className="text-sm text-muted-foreground">Manage guest contacts and mailing lists</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Compose Tab */}
        <TabsContent value="compose" className="space-y-4">
          <Card>
            <CardContent className="text-center py-12">
              <Send className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium">Compose - Coming Soon</p>
              <p className="text-sm text-muted-foreground">Send notifications to cohorts, users, and contacts</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Logs Tab */}
        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardContent className="text-center py-12">
              <BarChart3 className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <p className="text-lg font-medium">Logs & Analytics - Coming Soon</p>
              <p className="text-sm text-muted-foreground">View delivery status and engagement metrics</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Template Form Dialog */}
      <Dialog open={showTemplateForm} onOpenChange={setShowTemplateForm}>
        <DialogContent className="dark:bg-gray-900 dark:border-gray-700 sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader className="pb-2">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <DialogTitle className="dark:text-white text-2xl">
                {editingTemplate ? 'Edit Template' : 'Create New Template'}
              </DialogTitle>
            </div>
            <DialogDescription className="dark:text-gray-400 text-base">
              {editingTemplate ? 'Update your notification template' : 'Create a reusable notification template with variables'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-4">
            <div className="grid grid-cols-2 gap-5">
              <div className="space-y-2 col-span-2 sm:col-span-1">
                <Label htmlFor="template-name" className="dark:text-gray-300 font-medium flex items-center gap-1">
                  Template Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="template-name"
                  placeholder="e.g., Welcome Email"
                  value={templateFormData.name}
                  onChange={(e) => setTemplateFormData({ ...templateFormData, name: e.target.value })}
                  className="dark:bg-gray-950 dark:border-gray-700 dark:text-white h-11"
                />
              </div>
              <div className="space-y-2 col-span-2 sm:col-span-1">
                <Label htmlFor="template-channel" className="dark:text-gray-300 font-medium flex items-center gap-1">
                  Channel <span className="text-red-500">*</span>
                </Label>
                <Select value={templateFormData.channel} onValueChange={(value: 'email' | 'sms' | 'whatsapp') => setTemplateFormData({ ...templateFormData, channel: value })}>
                  <SelectTrigger className="dark:bg-gray-950 dark:border-gray-700 dark:text-white h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="dark:bg-gray-900 dark:border-gray-700">
                    <SelectItem value="email" className="dark:text-white dark:focus:bg-gray-800">
                      <span className="flex items-center gap-2">
                        <Mail className="w-4 h-4" />
                        Email
                      </span>
                    </SelectItem>
                    <SelectItem value="sms" className="dark:text-white dark:focus:bg-gray-800">
                      <span className="flex items-center gap-2">
                        <MessageSquare className="w-4 h-4" />
                        SMS
                      </span>
                    </SelectItem>
                    <SelectItem value="whatsapp" className="dark:text-white dark:focus:bg-gray-800">
                      <span className="flex items-center gap-2">
                        <Phone className="w-4 h-4" />
                        WhatsApp
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="template-description" className="dark:text-gray-300 font-medium">Description</Label>
              <Input
                id="template-description"
                placeholder="Brief description of when to use this template"
                value={templateFormData.description}
                onChange={(e) => setTemplateFormData({ ...templateFormData, description: e.target.value })}
                className="dark:bg-gray-950 dark:border-gray-700 dark:text-white h-11"
              />
            </div>
            {templateFormData.channel === 'email' && (
              <div className="space-y-2">
                <Label htmlFor="template-subject" className="dark:text-gray-300 font-medium">Subject Line</Label>
                <Input
                  id="template-subject"
                  placeholder="e.g., Welcome to {{cohort_name}}!"
                  value={templateFormData.subject}
                  onChange={(e) => setTemplateFormData({ ...templateFormData, subject: e.target.value })}
                  className="dark:bg-gray-950 dark:border-gray-700 dark:text-white h-11"
                />
                <p className="text-xs text-muted-foreground dark:text-gray-500">Use variables like {`{{name}}`}, {`{{cohort_name}}`}</p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="template-body" className="dark:text-gray-300 font-medium flex items-center gap-1">
                Message Body <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="template-body"
                placeholder={templateFormData.channel === 'email' ?
                  'Hi {{name}},\n\nWelcome to {{cohort_name}}!\n\nYour journey starts on {{start_date}}.' :
                  'Hi {{name}}, your session starts in {{time}}. Join here: {{link}}'
                }
                value={templateFormData.body}
                onChange={(e) => setTemplateFormData({ ...templateFormData, body: e.target.value })}
                className="dark:bg-gray-950 dark:border-gray-700 dark:text-white min-h-[150px] resize-none"
              />
              <p className="text-xs text-muted-foreground dark:text-gray-500">
                {templateFormData.channel === 'email' ? 'Supports HTML. ' : ''}Use variables like {`{{name}}`}, {`{{cohort_name}}`}, {`{{link}}`}
              </p>
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
    </div>
  );
}
