'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Bell, Plus } from 'lucide-react';

export default function AdminNotificationsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Notification Rules</h1>
          <p className="text-muted-foreground">
            Configure automated notification triggers
          </p>
        </div>
        <Button className="gradient-bg gap-2">
          <Plus className="w-4 h-4" />
          Create Rule
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Active Rules</CardTitle>
          <CardDescription>
            Notifications are sent based on these rules
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            <Bell className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">No notification rules yet</p>
            <p className="text-sm">Create rules to automate notifications</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
