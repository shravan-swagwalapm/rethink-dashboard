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
  BarChart3,
} from 'lucide-react';
import { toast } from 'sonner';

export function LogsTab() {
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
    fetchAnalytics();
    fetchLogs();
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [logsPage, logsFilter]);

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

  return (
    <div className="space-y-4">
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
                value={logsFilter.status || 'all'}
                onValueChange={(v) => setLogsFilter({ ...logsFilter, status: v === 'all' ? '' : v })}
              >
                <SelectTrigger id="filter-status">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
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
    </div>
  );
}
