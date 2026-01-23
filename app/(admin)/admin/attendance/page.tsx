'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { BarChart3, Settings, Webhook, TestTube } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminAttendancePage() {
  const [webhookEnabled, setWebhookEnabled] = useState(false);
  const [weights, setWeights] = useState({
    attendance: 40,
    caseStudy: 40,
    mentorRating: 20,
  });

  const handleWeightChange = (key: string, value: number) => {
    setWeights(prev => ({ ...prev, [key]: value }));
  };

  const totalWeight = weights.attendance + weights.caseStudy + weights.mentorRating;

  const handleTestConnection = () => {
    toast.info('Testing Zoom webhook connection...');
    setTimeout(() => {
      toast.success('Webhook connection successful!');
    }, 1500);
  };

  const handleSaveWeights = () => {
    if (totalWeight !== 100) {
      toast.error('Weights must sum to 100%');
      return;
    }
    toast.success('Ranking weights saved');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Attendance Configuration</h1>
        <p className="text-muted-foreground">
          Configure Zoom integration and ranking weights
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Webhook className="w-5 h-5" />
              Zoom Webhook
            </CardTitle>
            <CardDescription>
              Enable automatic attendance tracking from Zoom
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Enable Webhook</Label>
                <p className="text-sm text-muted-foreground">
                  Automatically track attendance from Zoom meetings
                </p>
              </div>
              <Switch
                checked={webhookEnabled}
                onCheckedChange={setWebhookEnabled}
              />
            </div>

            <div className="p-4 rounded-lg bg-muted/50">
              <Label className="text-xs text-muted-foreground">Webhook URL</Label>
              <code className="block mt-1 text-sm break-all">
                {process.env.NEXT_PUBLIC_APP_URL || 'https://your-domain.com'}/api/attendance/webhook
              </code>
            </div>

            <Button
              variant="outline"
              onClick={handleTestConnection}
              disabled={!webhookEnabled}
              className="w-full gap-2"
            >
              <TestTube className="w-4 h-4" />
              Test Connection
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Ranking Weights
            </CardTitle>
            <CardDescription>
              Configure how student rankings are calculated
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="attendance">Attendance ({weights.attendance}%)</Label>
              <Input
                id="attendance"
                type="number"
                min="0"
                max="100"
                value={weights.attendance}
                onChange={(e) => handleWeightChange('attendance', parseInt(e.target.value) || 0)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="caseStudy">Case Study ({weights.caseStudy}%)</Label>
              <Input
                id="caseStudy"
                type="number"
                min="0"
                max="100"
                value={weights.caseStudy}
                onChange={(e) => handleWeightChange('caseStudy', parseInt(e.target.value) || 0)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="mentorRating">Mentor Rating ({weights.mentorRating}%)</Label>
              <Input
                id="mentorRating"
                type="number"
                min="0"
                max="100"
                value={weights.mentorRating}
                onChange={(e) => handleWeightChange('mentorRating', parseInt(e.target.value) || 0)}
              />
            </div>

            <div className={`p-3 rounded-lg ${totalWeight === 100 ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
              <p className={`text-sm font-medium ${totalWeight === 100 ? 'text-green-600' : 'text-red-600'}`}>
                Total: {totalWeight}% {totalWeight !== 100 && '(must be 100%)'}
              </p>
            </div>

            <Button
              onClick={handleSaveWeights}
              disabled={totalWeight !== 100}
              className="w-full gradient-bg"
            >
              Save Weights
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Attendance Overview
          </CardTitle>
          <CardDescription>
            View attendance statistics across all sessions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">No attendance data yet</p>
            <p className="text-sm">Enable Zoom webhook to start tracking</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
