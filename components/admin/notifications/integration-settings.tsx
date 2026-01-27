'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Mail,
  MessageSquare,
  Phone,
  Eye,
  EyeOff,
  CheckCircle,
  XCircle,
  Loader2,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  Info
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface Integration {
  id: string;
  channel: 'email' | 'sms' | 'whatsapp';
  provider: string;
  is_active: boolean;
  config: Record<string, any>;
  test_mode: boolean;
  last_tested_at: string | null;
  test_status: 'success' | 'failed' | 'pending' | null;
}

const channelIcons = {
  email: Mail,
  sms: Phone,
  whatsapp: MessageSquare,
};

const channelLabels = {
  email: 'Email',
  sms: 'SMS',
  whatsapp: 'WhatsApp',
};

const providerInfo: Record<string, { name: string; description: string; docsUrl: string }> = {
  resend: {
    name: 'Resend',
    description: 'Modern email API for developers. Reliable delivery, detailed analytics.',
    docsUrl: 'https://resend.com/docs',
  },
  twilio: {
    name: 'Twilio',
    description: 'Industry-leading SMS API. Global reach, programmable messaging.',
    docsUrl: 'https://www.twilio.com/docs/sms',
  },
  interakt: {
    name: 'Interakt',
    description: 'Official WhatsApp Business API partner for India. Template-based messaging.',
    docsUrl: 'https://docs.interakt.ai/',
  },
};

export function IntegrationSettings() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [editedConfigs, setEditedConfigs] = useState<Record<string, Record<string, any>>>({});
  const [testRecipients, setTestRecipients] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchIntegrations();
  }, []);

  const fetchIntegrations = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/notifications/integrations');
      if (!response.ok) throw new Error('Failed to fetch integrations');
      const result = await response.json();
      setIntegrations(result.data || []);

      // Initialize edited configs
      const configs: Record<string, Record<string, any>> = {};
      (result.data || []).forEach((i: Integration) => {
        configs[i.channel] = { ...i.config };
      });
      setEditedConfigs(configs);
    } catch (error) {
      console.error('Error fetching integrations:', error);
      toast.error('Failed to load integration settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (channel: string) => {
    const integration = integrations.find(i => i.channel === channel);
    const config = editedConfigs[channel] || {};

    try {
      setSaving(channel);
      const response = await fetch('/api/admin/notifications/integrations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel,
          config,
          is_active: integration?.is_active,
        }),
      });

      if (!response.ok) throw new Error('Failed to save');

      toast.success(`${channelLabels[channel as keyof typeof channelLabels]} settings saved`);
      fetchIntegrations();
    } catch (error) {
      console.error('Error saving integration:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(null);
    }
  };

  const handleToggleActive = async (channel: string, isActive: boolean) => {
    try {
      setSaving(channel);
      const response = await fetch('/api/admin/notifications/integrations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel, is_active: isActive }),
      });

      if (!response.ok) throw new Error('Failed to update');

      setIntegrations(prev =>
        prev.map(i => i.channel === channel ? { ...i, is_active: isActive } : i)
      );
      toast.success(`${channelLabels[channel as keyof typeof channelLabels]} ${isActive ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error('Error toggling integration:', error);
      toast.error('Failed to update status');
    } finally {
      setSaving(null);
    }
  };

  const handleTest = async (channel: string) => {
    try {
      setTesting(channel);
      const response = await fetch('/api/admin/notifications/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel,
          test_recipient: testRecipients[channel],
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success(result.message);
        fetchIntegrations();
      } else {
        toast.error(result.message || result.error);
      }
    } catch (error) {
      console.error('Error testing integration:', error);
      toast.error('Test failed');
    } finally {
      setTesting(null);
    }
  };

  const updateConfig = (channel: string, key: string, value: any) => {
    setEditedConfigs(prev => ({
      ...prev,
      [channel]: {
        ...prev[channel],
        [key]: value,
      },
    }));
  };

  const toggleShowSecret = (key: string) => {
    setShowSecrets(prev => ({ ...prev, [key]: !prev[key] }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold dark:text-white">Integration Settings</h3>
            <p className="text-sm text-muted-foreground dark:text-gray-400">
              Configure email, SMS, and WhatsApp providers for sending notifications
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchIntegrations}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        <div className="grid gap-6">
          {/* Email Integration */}
          {renderIntegrationCard('email')}

          {/* WhatsApp Integration */}
          {renderIntegrationCard('whatsapp')}

          {/* SMS Integration */}
          {renderIntegrationCard('sms')}
        </div>

        {/* Info Card */}
        <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800 dark:text-blue-200">
                <p className="font-medium mb-1">Environment Variables</p>
                <p className="text-blue-700 dark:text-blue-300">
                  For security, API keys can also be set via environment variables:
                  <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded mx-1">RESEND_API_KEY</code>,
                  <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded mx-1">INTERAKT_API_KEY</code>,
                  <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded mx-1">TWILIO_ACCOUNT_SID</code>,
                  <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded mx-1">TWILIO_AUTH_TOKEN</code>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );

  function renderIntegrationCard(channel: 'email' | 'sms' | 'whatsapp') {
    const integration = integrations.find(i => i.channel === channel);
    const Icon = channelIcons[channel];
    const provider = integration?.provider || (channel === 'email' ? 'resend' : channel === 'whatsapp' ? 'interakt' : 'twilio');
    const info = providerInfo[provider];
    const config = editedConfigs[channel] || {};

    return (
      <Card key={channel} className="dark:bg-gray-900/50">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${
                channel === 'email' ? 'bg-blue-100 dark:bg-blue-900/30' :
                channel === 'whatsapp' ? 'bg-green-100 dark:bg-green-900/30' :
                'bg-purple-100 dark:bg-purple-900/30'
              }`}>
                <Icon className={`w-5 h-5 ${
                  channel === 'email' ? 'text-blue-600 dark:text-blue-400' :
                  channel === 'whatsapp' ? 'text-green-600 dark:text-green-400' :
                  'text-purple-600 dark:text-purple-400'
                }`} />
              </div>
              <div>
                <CardTitle className="text-lg dark:text-white flex items-center gap-2">
                  {channelLabels[channel]}
                  {integration?.is_active && (
                    <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                      Active
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription className="flex items-center gap-2">
                  Provider: <span className="font-medium">{info?.name || provider}</span>
                  {info?.docsUrl && (
                    <a
                      href={info.docsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-700 dark:text-blue-400"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {integration?.test_status && (
                <Tooltip>
                  <TooltipTrigger>
                    {integration.test_status === 'success' ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-500" />
                    )}
                  </TooltipTrigger>
                  <TooltipContent>
                    Last test: {integration.test_status === 'success' ? 'Passed' : 'Failed'}
                    {integration.last_tested_at && (
                      <div className="text-xs opacity-70">
                        {new Date(integration.last_tested_at).toLocaleString()}
                      </div>
                    )}
                  </TooltipContent>
                </Tooltip>
              )}
              <Switch
                checked={integration?.is_active || false}
                onCheckedChange={(checked) => handleToggleActive(channel, checked)}
                disabled={saving === channel}
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {info?.description && (
            <p className="text-sm text-muted-foreground dark:text-gray-400">
              {info.description}
            </p>
          )}

          <Separator />

          {/* Channel-specific configuration */}
          {channel === 'email' && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>From Email</Label>
                  <Input
                    placeholder="notifications@yourcompany.com"
                    value={config.from_email || ''}
                    onChange={(e) => updateConfig(channel, 'from_email', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>From Name</Label>
                  <Input
                    placeholder="Rethink Systems"
                    value={config.from_name || ''}
                    onChange={(e) => updateConfig(channel, 'from_name', e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Reply-To Email (optional)</Label>
                <Input
                  placeholder="support@yourcompany.com"
                  value={config.reply_to || ''}
                  onChange={(e) => updateConfig(channel, 'reply_to', e.target.value)}
                />
              </div>
            </div>
          )}

          {channel === 'whatsapp' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  Interakt API Key
                  <Tooltip>
                    <TooltipTrigger>
                      <AlertCircle className="w-3.5 h-3.5 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      Get your API key from Interakt dashboard under Settings &gt; Developer Settings
                    </TooltipContent>
                  </Tooltip>
                </Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      type={showSecrets['whatsapp_api'] ? 'text' : 'password'}
                      placeholder="Enter API key"
                      value={config.api_key || ''}
                      onChange={(e) => updateConfig(channel, 'api_key', e.target.value)}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                      onClick={() => toggleShowSecret('whatsapp_api')}
                    >
                      {showSecrets['whatsapp_api'] ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Default Country Code</Label>
                <Input
                  placeholder="+91"
                  value={config.country_code || '+91'}
                  onChange={(e) => updateConfig(channel, 'country_code', e.target.value)}
                  className="w-24"
                />
              </div>
            </div>
          )}

          {channel === 'sms' && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Twilio Account SID</Label>
                  <div className="relative">
                    <Input
                      type={showSecrets['twilio_sid'] ? 'text' : 'password'}
                      placeholder="ACXXXXXXXX..."
                      value={config.account_sid || ''}
                      onChange={(e) => updateConfig(channel, 'account_sid', e.target.value)}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                      onClick={() => toggleShowSecret('twilio_sid')}
                    >
                      {showSecrets['twilio_sid'] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Twilio Auth Token</Label>
                  <div className="relative">
                    <Input
                      type={showSecrets['twilio_token'] ? 'text' : 'password'}
                      placeholder="Enter auth token"
                      value={config.auth_token || ''}
                      onChange={(e) => updateConfig(channel, 'auth_token', e.target.value)}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                      onClick={() => toggleShowSecret('twilio_token')}
                    >
                      {showSecrets['twilio_token'] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Twilio Phone Number</Label>
                <Input
                  placeholder="+1234567890"
                  value={config.phone_number || ''}
                  onChange={(e) => updateConfig(channel, 'phone_number', e.target.value)}
                />
              </div>
            </div>
          )}

          <Separator />

          {/* Test Section */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Test Integration</Label>
            <div className="flex gap-2">
              <Input
                placeholder={
                  channel === 'email' ? 'test@example.com' :
                  channel === 'whatsapp' ? '9876543210' :
                  '+919876543210'
                }
                value={testRecipients[channel] || ''}
                onChange={(e) => setTestRecipients(prev => ({ ...prev, [channel]: e.target.value }))}
                className="flex-1"
              />
              <Button
                variant="outline"
                onClick={() => handleTest(channel)}
                disabled={testing === channel}
              >
                {testing === channel ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Testing...
                  </>
                ) : (
                  'Send Test'
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground dark:text-gray-500">
              {channel === 'email' && 'Leave empty to only verify API key validity'}
              {channel === 'whatsapp' && 'Enter phone number without country code'}
              {channel === 'sms' && 'Enter full phone number with country code'}
            </p>
          </div>

          {/* Save Button */}
          <div className="flex justify-end pt-2">
            <Button
              onClick={() => handleSave(channel)}
              disabled={saving === channel}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
            >
              {saving === channel ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Settings'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }
}
