'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
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
  Upload,
  Info,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Settings,
  Zap,
} from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { VariableConfigModal } from '@/components/admin/notifications/variable-config-modal';
import { NotificationTemplate, getChannelIcon, getChannelColor } from '../types';

export function TemplatesTab() {
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<NotificationTemplate | null>(null);
  const [templateFormData, setTemplateFormData] = useState({
    name: '',
    description: '',
    subject: '',
    body: '',
    html_body: '',
    body_type: 'text' as 'text' | 'html',
    variables: [] as Array<{ name: string; example: string }>,
    channel: 'email' as 'email' | 'sms' | 'whatsapp',
  });
  const [htmlPreviewMode, setHtmlPreviewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [previewTemplate, setPreviewTemplate] = useState<NotificationTemplate | null>(null);
  const [showVariableConfig, setShowVariableConfig] = useState(false);
  const [deleteTemplateId, setDeleteTemplateId] = useState<string | null>(null);

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
      html_body: '',
      body_type: 'text',
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
      html_body: (template as any).html_body || '',
      body_type: ((template as any).body_type || 'text') as 'text' | 'html',
      variables: template.variables || [],
      channel: template.channel,
    });
    setShowTemplateForm(true);
  };

  const handleCreateTemplate = async () => {
    const hasBody = templateFormData.body.trim() ||
      (templateFormData.body_type === 'html' && templateFormData.html_body.trim());

    if (!templateFormData.name.trim() || !hasBody) {
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

  return (
    <>
      <div className="space-y-4">
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
                    <Button size="sm" variant="outline" onClick={() => setDeleteTemplateId(template.id)} className="text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Template Form Dialog */}
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
                    placeholder="e.g., Welcome to {{cohort_name}}!"
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

              {/* Body Type Toggle - Email only */}
              {templateFormData.channel === 'email' && (
                <div className="space-y-3">
                  <Label className="dark:text-gray-300 font-medium">Content Type</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={templateFormData.body_type === 'text' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setTemplateFormData({ ...templateFormData, body_type: 'text' })}
                      className={templateFormData.body_type === 'text' ? 'bg-blue-600' : ''}
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      Plain Text / Inline HTML
                    </Button>
                    <Button
                      type="button"
                      variant={templateFormData.body_type === 'html' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setTemplateFormData({ ...templateFormData, body_type: 'html' })}
                      className={templateFormData.body_type === 'html' ? 'bg-purple-600' : ''}
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Upload HTML File
                    </Button>
                  </div>
                </div>
              )}

              {/* Plain Text / Inline HTML Body */}
              {(templateFormData.channel !== 'email' || templateFormData.body_type === 'text') && (
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
              )}

              {/* HTML Upload Mode */}
              {templateFormData.channel === 'email' && templateFormData.body_type === 'html' && (
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    {/* File Upload */}
                    <div className="space-y-2">
                      <Label className="dark:text-gray-300 font-medium flex items-center gap-2">
                        <Upload className="w-4 h-4" />
                        Upload HTML File
                      </Label>
                      <div className="border-2 border-dashed dark:border-gray-700 rounded-lg p-4 text-center hover:border-blue-500 dark:hover:border-blue-400 transition-colors">
                        <input
                          type="file"
                          accept=".html,.htm"
                          className="hidden"
                          id="html-file-upload"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = (event) => {
                                const content = event.target?.result as string;
                                setTemplateFormData({ ...templateFormData, html_body: content });
                                toast.success(`Loaded ${file.name}`);
                              };
                              reader.readAsText(file);
                            }
                          }}
                        />
                        <label htmlFor="html-file-upload" className="cursor-pointer">
                          <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            Click to upload <span className="font-medium">.html</span> file
                          </p>
                          <p className="text-xs text-gray-500 mt-1">or drag and drop</p>
                        </label>
                      </div>
                    </div>

                    {/* Paste HTML */}
                    <div className="space-y-2">
                      <Label className="dark:text-gray-300 font-medium flex items-center gap-2">
                        <Copy className="w-4 h-4" />
                        Or Paste HTML Code
                      </Label>
                      <Textarea
                        placeholder="Paste your HTML code here..."
                        value={templateFormData.html_body}
                        onChange={(e) => setTemplateFormData({ ...templateFormData, html_body: e.target.value })}
                        className="dark:bg-gray-950 dark:border-gray-700 dark:text-white min-h-[120px] resize-none font-mono text-xs"
                      />
                    </div>
                  </div>

                  {/* HTML Preview */}
                  {templateFormData.html_body && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="dark:text-gray-300 font-medium flex items-center gap-2">
                          <Eye className="w-4 h-4" />
                          Preview
                        </Label>
                        <div className="flex gap-1">
                          <Button
                            type="button"
                            variant={htmlPreviewMode === 'desktop' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setHtmlPreviewMode('desktop')}
                            className="h-7 px-2 text-xs"
                          >
                            Desktop
                          </Button>
                          <Button
                            type="button"
                            variant={htmlPreviewMode === 'mobile' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setHtmlPreviewMode('mobile')}
                            className="h-7 px-2 text-xs"
                          >
                            Mobile
                          </Button>
                        </div>
                      </div>
                      <div className={`border dark:border-gray-700 rounded-lg overflow-hidden bg-white mx-auto ${
                        htmlPreviewMode === 'mobile' ? 'max-w-[375px]' : 'w-full'
                      }`}>
                        <iframe
                          srcDoc={templateFormData.html_body}
                          className="w-full h-[300px]"
                          title="HTML Preview"
                          sandbox="allow-same-origin"
                        />
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                        <Info className="w-3 h-3" />
                        Variables like {`{{name}}`} will be replaced when sending
                      </p>
                    </div>
                  )}

                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {templateFormData.html_body.length} characters in HTML
                  </div>
                </div>
              )}
            </div>

            {/* Variables Guide */}
            <div
              className="p-4 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20 border border-purple-200 dark:border-purple-900 rounded-lg cursor-pointer hover:border-purple-400 dark:hover:border-purple-700 transition-colors"
              onClick={() => setShowVariableConfig(true)}
            >
              <div className="flex items-start gap-3">
                <Zap className="w-5 h-5 text-purple-600 dark:text-purple-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-sm text-purple-900 dark:text-purple-100">Dynamic Variables</h4>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/50"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowVariableConfig(true);
                      }}
                    >
                      <Settings className="w-3 h-3 mr-1" />
                      Configure & Test
                    </Button>
                  </div>
                  <p className="text-xs text-purple-800 dark:text-purple-200 mb-3">
                    Use variables to personalize each message. Click to see all available variables and test with real data.
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <code className="px-2 py-1 bg-purple-100 dark:bg-purple-900/50 rounded text-purple-900 dark:text-purple-100">{`{{name}}`}</code>
                      <span className="text-purple-700 dark:text-purple-300">from profiles.full_name</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="px-2 py-1 bg-purple-100 dark:bg-purple-900/50 rounded text-purple-900 dark:text-purple-100">{`{{cohort_name}}`}</code>
                      <span className="text-purple-700 dark:text-purple-300">from cohorts.name</span>
                    </div>
                  </div>
                  <p className="text-xs text-purple-600 dark:text-purple-400 mt-3 flex items-center gap-1">
                    <Info className="w-3 h-3" />
                    Click to view all variables, their data sources, and test with live data
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

      {/* Variable Config Modal */}
      <VariableConfigModal
        open={showVariableConfig}
        onOpenChange={setShowVariableConfig}
        onInsertVariable={(variable) => {
          setTemplateFormData(prev => ({
            ...prev,
            body: prev.body + variable,
          }));
        }}
        customVariables={templateFormData.variables}
        onCustomVariablesChange={(variables) => {
          setTemplateFormData(prev => ({
            ...prev,
            variables,
          }));
        }}
      />

      {/* Delete Template Confirmation Dialog */}
      <AlertDialog open={!!deleteTemplateId} onOpenChange={(open) => { if (!open) setDeleteTemplateId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template?</AlertDialogTitle>
            <AlertDialogDescription>
              Delete this template? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={async () => {
                if (deleteTemplateId) {
                  await handleDeleteTemplate(deleteTemplateId);
                  setDeleteTemplateId(null);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
