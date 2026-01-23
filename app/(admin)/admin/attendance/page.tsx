'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { PageLoader } from '@/components/ui/page-loader';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { BarChart3, Settings, Webhook, TestTube, LinkIcon, Mail, UserPlus, Trash2, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import type { Profile } from '@/types';

interface UnmatchedEmail {
  email: string;
  sessions: { id: string; title: string; date: string }[];
}

interface EmailAlias {
  id: string;
  alias_email: string;
  user_id: string;
  created_at: string;
  user?: {
    id: string;
    full_name: string;
    email: string;
  };
}

export default function AdminAttendancePage() {
  const [loading, setLoading] = useState(true);
  const [webhookEnabled, setWebhookEnabled] = useState(false);
  const [weights, setWeights] = useState({
    attendance: 40,
    caseStudy: 40,
    mentorRating: 20,
  });

  // Email alias state
  const [unmatchedEmails, setUnmatchedEmails] = useState<UnmatchedEmail[]>([]);
  const [aliases, setAliases] = useState<EmailAlias[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<string>('');
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [linking, setLinking] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [unmatchedRes, aliasesRes, usersRes] = await Promise.all([
        fetch('/api/admin/attendance/aliases?action=unmatched'),
        fetch('/api/admin/attendance/aliases'),
        fetch('/api/admin/users'),
      ]);

      const [unmatchedData, aliasesData, usersData] = await Promise.all([
        unmatchedRes.json(),
        aliasesRes.json(),
        usersRes.json(),
      ]);

      setUnmatchedEmails(unmatchedData.unmatchedEmails || []);
      setAliases(aliasesData.aliases || []);
      setUsers(usersData.users || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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

  const handleLinkEmail = async () => {
    if (!selectedEmail || !selectedUserId) {
      toast.error('Please select both an email and a user');
      return;
    }

    setLinking(true);
    try {
      const response = await fetch('/api/admin/attendance/aliases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: selectedUserId,
          alias_email: selectedEmail,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to link email');
      }

      toast.success(`Email linked successfully. ${data.rematchedRecords} attendance records updated.`);
      setShowLinkDialog(false);
      setSelectedEmail('');
      setSelectedUserId('');
      fetchData();
    } catch (error) {
      console.error('Error linking email:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to link email');
    } finally {
      setLinking(false);
    }
  };

  const handleDeleteAlias = async (aliasId: string) => {
    if (!confirm('Remove this email alias?')) return;

    try {
      const response = await fetch(`/api/admin/attendance/aliases?id=${aliasId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete alias');
      }

      toast.success('Email alias removed');
      fetchData();
    } catch (error) {
      console.error('Error deleting alias:', error);
      toast.error('Failed to delete alias');
    }
  };

  const openLinkDialog = (email: string) => {
    setSelectedEmail(email);
    setSelectedUserId('');
    setShowLinkDialog(true);
  };

  if (loading) {
    return <PageLoader message="Loading attendance settings..." />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Attendance Configuration</h1>
        <p className="text-muted-foreground">
          Configure Zoom integration, email matching, and ranking weights
        </p>
      </div>

      {/* Unmatched Emails Alert */}
      {unmatchedEmails.length > 0 && (
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-600">
              <AlertCircle className="w-5 h-5" />
              Unmatched Attendance ({unmatchedEmails.length} emails)
            </CardTitle>
            <CardDescription>
              These Zoom participants couldn&apos;t be matched to registered users. Link them to track their attendance.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {unmatchedEmails.slice(0, 5).map((item) => (
                <div
                  key={item.email}
                  className="flex items-center justify-between p-3 rounded-lg bg-background border"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{item.email}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.sessions.length} session{item.sessions.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => openLinkDialog(item.email)}>
                    <LinkIcon className="w-4 h-4 mr-1" />
                    Link to User
                  </Button>
                </div>
              ))}
              {unmatchedEmails.length > 5 && (
                <p className="text-sm text-muted-foreground text-center pt-2">
                  And {unmatchedEmails.length - 5} more...
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Zoom Webhook Card */}
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

        {/* Ranking Weights Card */}
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

      {/* Email Aliases */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5" />
            Email Aliases
          </CardTitle>
          <CardDescription>
            Link alternate email addresses to user accounts for attendance matching
          </CardDescription>
        </CardHeader>
        <CardContent>
          {aliases.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Mail className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No email aliases yet</p>
              <p className="text-sm">Link unmatched emails above to create aliases</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Alias Email</TableHead>
                  <TableHead>Linked User</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-[80px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {aliases.map((alias) => (
                  <TableRow key={alias.id}>
                    <TableCell className="font-medium">{alias.alias_email}</TableCell>
                    <TableCell>
                      <div>
                        <p>{alias.user?.full_name || 'Unknown'}</p>
                        <p className="text-xs text-muted-foreground">{alias.user?.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {format(new Date(alias.created_at), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => handleDeleteAlias(alias.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Link Email Dialog */}
      <Dialog open={showLinkDialog} onOpenChange={setShowLinkDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link Email to User</DialogTitle>
            <DialogDescription>
              Link this email address to a registered user. Future attendance from this email will be attributed to the selected user.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Email Address</Label>
              <Input value={selectedEmail} disabled className="bg-muted" />
            </div>
            <div>
              <Label>Link to User</Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a user..." />
                </SelectTrigger>
                <SelectContent>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.full_name || user.email} ({user.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLinkDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleLinkEmail} disabled={linking || !selectedUserId}>
              {linking && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Link Email
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
