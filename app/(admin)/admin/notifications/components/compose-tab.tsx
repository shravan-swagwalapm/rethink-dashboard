'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Loader2,
  FileText,
} from 'lucide-react';
import { toast } from 'sonner';
import { RecipientSelector } from '@/components/admin/notifications/recipient-selector';
import { VariableEditor } from '@/components/admin/notifications/variable-editor';
import { NotificationTemplate, getChannelIcon, getChannelColor } from '../types';

interface ComposeTabProps {
  onNavigateToTemplates?: () => void;
}

export function ComposeTab({ onNavigateToTemplates }: ComposeTabProps) {
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    fetchTemplates();
  }, []);

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

  return (
    <div className="space-y-4">
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
                  <Button onClick={onNavigateToTemplates}>
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
    </div>
  );
}
