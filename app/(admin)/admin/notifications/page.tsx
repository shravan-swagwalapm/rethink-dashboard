'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  FileText,
  Users,
  Send,
  BarChart3,
  Settings,
} from 'lucide-react';
import { TemplatesTab } from './components/templates-tab';
import { ContactsTab } from './components/contacts-tab';
import { ComposeTab } from './components/compose-tab';
import { LogsTab } from './components/logs-tab';
import { IntegrationSettings } from '@/components/admin/notifications/integration-settings';

export default function AdminNotificationsPage() {
  const [activeTab, setActiveTab] = useState('templates');

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
        <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid">
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
          <TabsTrigger value="settings" className="gap-2">
            <Settings className="w-4 h-4" />
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="templates">
          <TemplatesTab />
        </TabsContent>

        <TabsContent value="contacts">
          <ContactsTab />
        </TabsContent>

        <TabsContent value="compose">
          <ComposeTab onNavigateToTemplates={() => setActiveTab('templates')} />
        </TabsContent>

        <TabsContent value="logs">
          <LogsTab />
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <IntegrationSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}
