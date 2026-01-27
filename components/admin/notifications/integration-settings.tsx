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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

// Provider options for each channel
const emailProviders = [
  { id: 'resend', name: 'Resend', description: 'Modern email API for developers. Reliable delivery.', docsUrl: 'https://resend.com/docs', isDefault: true },
  { id: 'sendgrid', name: 'SendGrid', description: 'Trusted email delivery by Twilio.', docsUrl: 'https://docs.sendgrid.com/' },
  { id: 'mailgun', name: 'Mailgun', description: 'Powerful transactional email API.', docsUrl: 'https://documentation.mailgun.com/' },
  { id: 'ses', name: 'AWS SES', description: 'Amazon Simple Email Service.', docsUrl: 'https://docs.aws.amazon.com/ses/' },
  { id: 'postmark', name: 'Postmark', description: 'Fast, reliable email delivery.', docsUrl: 'https://postmarkapp.com/developer' },
  { id: 'custom', name: 'Custom SMTP', description: 'Use your own SMTP server.', docsUrl: '' },
];

const whatsappProviders = [
  { id: 'interakt', name: 'Interakt', description: 'Official WhatsApp Business API partner for India.', docsUrl: 'https://docs.interakt.ai/', isDefault: true },
  { id: 'twilio_wa', name: 'Twilio WhatsApp', description: 'WhatsApp Business API via Twilio.', docsUrl: 'https://www.twilio.com/docs/whatsapp' },
  { id: 'messagebird', name: 'MessageBird', description: 'Omnichannel messaging platform.', docsUrl: 'https://developers.messagebird.com/' },
  { id: 'gupshup', name: 'Gupshup', description: 'Conversational messaging platform.', docsUrl: 'https://www.gupshup.io/developer' },
];

const smsProviders = [
  { id: 'twilio', name: 'Twilio', description: 'Industry-leading SMS API. Global reach.', docsUrl: 'https://www.twilio.com/docs/sms', isDefault: true },
  { id: 'msg91', name: 'MSG91', description: 'SMS gateway for India.', docsUrl: 'https://docs.msg91.com/' },
  { id: 'vonage', name: 'Vonage (Nexmo)', description: 'Global SMS and voice APIs.', docsUrl: 'https://developer.vonage.com/' },
  { id: 'plivo', name: 'Plivo', description: 'Cloud communications platform.', docsUrl: 'https://www.plivo.com/docs/' },
  { id: 'sns', name: 'AWS SNS', description: 'Amazon Simple Notification Service.', docsUrl: 'https://docs.aws.amazon.com/sns/' },
];

const getProviders = (channel: string) => {
  switch (channel) {
    case 'email': return emailProviders;
    case 'whatsapp': return whatsappProviders;
    case 'sms': return smsProviders;
    default: return [];
  }
};

const getDefaultProvider = (channel: string) => {
  const providers = getProviders(channel);
  return providers.find(p => p.isDefault)?.id || providers[0]?.id;
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
    // Merge existing config with edited config
    const config = {
      ...(integration?.config || {}),
      ...(editedConfigs[channel] || {}),
    };

    // Extract provider from config or use existing
    const provider = config.provider || integration?.provider || getDefaultProvider(channel);

    try {
      setSaving(channel);
      const response = await fetch('/api/admin/notifications/integrations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel,
          provider,
          config,
          is_active: integration?.is_active,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to save');
      }

      toast.success(`${channelLabels[channel as keyof typeof channelLabels]} settings saved`);
      fetchIntegrations();
    } catch (error: any) {
      console.error('Error saving integration:', error);
      toast.error(error.message || 'Failed to save settings');
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
              <div className="text-sm text-blue-800 dark:text-blue-200 space-y-2">
                <p className="font-medium">How API Keys Work</p>
                <p className="text-blue-700 dark:text-blue-300">
                  You can enter custom API keys above, or leave them empty to use the default system keys
                  configured in environment variables. Custom keys take priority when provided.
                </p>
                <div className="text-xs text-blue-600 dark:text-blue-400 space-y-1 pt-1">
                  <p><strong>Default environment variables:</strong></p>
                  <div className="flex flex-wrap gap-2">
                    <code className="bg-blue-100 dark:bg-blue-900 px-1.5 py-0.5 rounded">RESEND_API_KEY</code>
                    <code className="bg-blue-100 dark:bg-blue-900 px-1.5 py-0.5 rounded">INTERAKT_API_KEY</code>
                    <code className="bg-blue-100 dark:bg-blue-900 px-1.5 py-0.5 rounded">TWILIO_ACCOUNT_SID</code>
                    <code className="bg-blue-100 dark:bg-blue-900 px-1.5 py-0.5 rounded">TWILIO_AUTH_TOKEN</code>
                    <code className="bg-blue-100 dark:bg-blue-900 px-1.5 py-0.5 rounded">TWILIO_PHONE_NUMBER</code>
                  </div>
                </div>
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
    // Merge existing integration config with any edits made in this session
    const config = {
      ...(integration?.config || {}),
      ...(editedConfigs[channel] || {}),
    };
    const providers = getProviders(channel);
    const defaultProviderId = getDefaultProvider(channel);
    const selectedProvider = config.provider || defaultProviderId;
    const providerInfo = providers.find(p => p.id === selectedProvider);
    const isDefaultProvider = selectedProvider === defaultProviderId;

    const handleProviderChange = (newProvider: string) => {
      updateConfig(channel, 'provider', newProvider);
      // Clear provider-specific config when changing providers
      if (newProvider !== config.provider) {
        updateConfig(channel, 'api_key', '');
        updateConfig(channel, 'account_sid', '');
        updateConfig(channel, 'auth_token', '');
      }
    };

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
          {/* Provider Selection */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              Provider
              {isDefaultProvider && (
                <Badge variant="outline" className="text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800">
                  Default
                </Badge>
              )}
            </Label>
            <Select value={selectedProvider} onValueChange={handleProviderChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {providers.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    <div className="flex items-center gap-2">
                      {p.name}
                      {p.isDefault && (
                        <span className="text-xs text-muted-foreground">(Default)</span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {providerInfo?.description && (
              <p className="text-xs text-muted-foreground flex items-center gap-2">
                {providerInfo.description}
                {providerInfo.docsUrl && (
                  <a
                    href={providerInfo.docsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-700 dark:text-blue-400 inline-flex items-center gap-1"
                  >
                    Docs <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </p>
            )}
          </div>

          <Separator />

          {/* Default Provider - Using System Keys */}
          {isDefaultProvider && !config.api_key && !config.account_sid && (
            <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-800 dark:text-blue-200">
                <p className="font-medium">Using System Default</p>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                  {channel === 'email' && 'Connected via RESEND_API_KEY environment variable'}
                  {channel === 'whatsapp' && 'Connected via INTERAKT_API_KEY environment variable'}
                  {channel === 'sms' && 'Connected via TWILIO_* environment variables'}
                </p>
              </div>
            </div>
          )}

          {/* API Key / Credentials Section */}
          <div className="space-y-4">
            {/* Email Providers */}
            {channel === 'email' && (
              <>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    API Key
                    {isDefaultProvider && (
                      <span className="text-xs text-muted-foreground">(optional for default provider)</span>
                    )}
                  </Label>
                  <div className="relative">
                    <Input
                      type={showSecrets['email_api'] ? 'text' : 'password'}
                      placeholder={isDefaultProvider ? "Leave empty to use system default" : "Enter your API key (required)"}
                      value={config.api_key || ''}
                      onChange={(e) => updateConfig(channel, 'api_key', e.target.value)}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                      onClick={() => toggleShowSecret('email_api')}
                    >
                      {showSecrets['email_api'] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>

                <Separator className="my-2" />

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
                      placeholder="Your Company"
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
              </>
            )}

            {/* WhatsApp Providers */}
            {channel === 'whatsapp' && (
              <>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    API Key
                    {isDefaultProvider && (
                      <span className="text-xs text-muted-foreground">(optional for default provider)</span>
                    )}
                  </Label>
                  <div className="relative">
                    <Input
                      type={showSecrets['whatsapp_api'] ? 'text' : 'password'}
                      placeholder={isDefaultProvider ? "Leave empty to use system default" : "Enter your API key (required)"}
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
                      {showSecrets['whatsapp_api'] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>

                {/* Twilio WhatsApp requires Account SID and Auth Token */}
                {selectedProvider === 'twilio_wa' && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Account SID</Label>
                      <div className="relative">
                        <Input
                          type={showSecrets['wa_sid'] ? 'text' : 'password'}
                          placeholder="ACXXXXXXXX..."
                          value={config.account_sid || ''}
                          onChange={(e) => updateConfig(channel, 'account_sid', e.target.value)}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                          onClick={() => toggleShowSecret('wa_sid')}
                        >
                          {showSecrets['wa_sid'] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Auth Token</Label>
                      <div className="relative">
                        <Input
                          type={showSecrets['wa_token'] ? 'text' : 'password'}
                          placeholder="Enter auth token"
                          value={config.auth_token || ''}
                          onChange={(e) => updateConfig(channel, 'auth_token', e.target.value)}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                          onClick={() => toggleShowSecret('wa_token')}
                        >
                          {showSecrets['wa_token'] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Default Country Code</Label>
                  <Input
                    placeholder="+91"
                    value={config.country_code || '+91'}
                    onChange={(e) => updateConfig(channel, 'country_code', e.target.value)}
                    className="w-24"
                  />
                </div>
              </>
            )}

            {/* SMS Providers */}
            {channel === 'sms' && (
              <>
                {/* Twilio and similar providers need Account SID + Auth Token */}
                {(selectedProvider === 'twilio' || selectedProvider === 'vonage' || selectedProvider === 'plivo') && (
                  <>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                          Account SID / API Key
                          {isDefaultProvider && (
                            <span className="text-xs text-muted-foreground">(optional)</span>
                          )}
                        </Label>
                        <div className="relative">
                          <Input
                            type={showSecrets['sms_sid'] ? 'text' : 'password'}
                            placeholder={isDefaultProvider ? "Leave empty for default" : "ACXXXXXXXX..."}
                            value={config.account_sid || ''}
                            onChange={(e) => updateConfig(channel, 'account_sid', e.target.value)}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                            onClick={() => toggleShowSecret('sms_sid')}
                          >
                            {showSecrets['sms_sid'] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                          Auth Token / API Secret
                          {isDefaultProvider && (
                            <span className="text-xs text-muted-foreground">(optional)</span>
                          )}
                        </Label>
                        <div className="relative">
                          <Input
                            type={showSecrets['sms_token'] ? 'text' : 'password'}
                            placeholder={isDefaultProvider ? "Leave empty for default" : "Enter auth token"}
                            value={config.auth_token || ''}
                            onChange={(e) => updateConfig(channel, 'auth_token', e.target.value)}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                            onClick={() => toggleShowSecret('sms_token')}
                          >
                            {showSecrets['sms_token'] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </Button>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Phone Number / Sender ID</Label>
                      <Input
                        placeholder={isDefaultProvider ? "+1234567890 (optional)" : "+1234567890"}
                        value={config.phone_number || ''}
                        onChange={(e) => updateConfig(channel, 'phone_number', e.target.value)}
                      />
                    </div>
                  </>
                )}

                {/* MSG91 uses Auth Key + Sender ID */}
                {selectedProvider === 'msg91' && (
                  <>
                    <div className="space-y-2">
                      <Label>Auth Key</Label>
                      <div className="relative">
                        <Input
                          type={showSecrets['msg91_key'] ? 'text' : 'password'}
                          placeholder="Enter MSG91 auth key"
                          value={config.auth_key || ''}
                          onChange={(e) => updateConfig(channel, 'auth_key', e.target.value)}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                          onClick={() => toggleShowSecret('msg91_key')}
                        >
                          {showSecrets['msg91_key'] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Sender ID</Label>
                      <Input
                        placeholder="RETHINK"
                        value={config.sender_id || ''}
                        onChange={(e) => updateConfig(channel, 'sender_id', e.target.value)}
                        maxLength={6}
                      />
                      <p className="text-xs text-muted-foreground">6-character alphanumeric sender ID</p>
                    </div>
                  </>
                )}

                {/* AWS SNS */}
                {selectedProvider === 'sns' && (
                  <>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>AWS Access Key ID</Label>
                        <div className="relative">
                          <Input
                            type={showSecrets['sns_key'] ? 'text' : 'password'}
                            placeholder="AKIAXXXXXXXX..."
                            value={config.access_key || ''}
                            onChange={(e) => updateConfig(channel, 'access_key', e.target.value)}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                            onClick={() => toggleShowSecret('sns_key')}
                          >
                            {showSecrets['sns_key'] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>AWS Secret Access Key</Label>
                        <div className="relative">
                          <Input
                            type={showSecrets['sns_secret'] ? 'text' : 'password'}
                            placeholder="Enter secret key"
                            value={config.secret_key || ''}
                            onChange={(e) => updateConfig(channel, 'secret_key', e.target.value)}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                            onClick={() => toggleShowSecret('sns_secret')}
                          >
                            {showSecrets['sns_secret'] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </Button>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>AWS Region</Label>
                      <Input
                        placeholder="ap-south-1"
                        value={config.region || 'ap-south-1'}
                        onChange={(e) => updateConfig(channel, 'region', e.target.value)}
                      />
                    </div>
                  </>
                )}
              </>
            )}
          </div>

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
