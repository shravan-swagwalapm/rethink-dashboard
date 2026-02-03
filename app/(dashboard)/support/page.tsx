'use client';

import { useEffect, useState, useRef } from 'react';
import { useUser } from '@/hooks/use-user';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PageLoader } from '@/components/ui/page-loader';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  Ticket,
  Plus,
  Wrench,
  CreditCard,
  BookOpen,
  Calendar,
  HelpCircle,
  MessageSquare,
  Clock,
  CheckCircle,
  AlertCircle,
  Send,
  X,
} from 'lucide-react';

interface SupportTicket {
  id: string;
  user_id: string;
  category: string;
  summary: string;
  description: string | null;
  status: 'open' | 'in_progress' | 'resolved';
  created_at: string;
  response_count?: number;
}

interface TicketResponse {
  id: string;
  ticket_id: string;
  user_id: string;
  message: string;
  is_admin: boolean;
  created_at: string;
  user?: {
    id: string;
    name: string;
    email: string;
  };
}

interface TicketWithResponses extends SupportTicket {
  responses: TicketResponse[];
}

const CATEGORIES = [
  { value: 'technical', label: 'Technical Issue', icon: Wrench, color: 'text-blue-500' },
  { value: 'payment', label: 'Payment', icon: CreditCard, color: 'text-green-500' },
  { value: 'content', label: 'Content', icon: BookOpen, color: 'text-purple-500' },
  { value: 'schedule', label: 'Schedule', icon: Calendar, color: 'text-orange-500' },
  { value: 'other', label: 'Other', icon: HelpCircle, color: 'text-gray-500' },
];

const STATUS_CONFIG = {
  open: { label: 'Open', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: AlertCircle },
  in_progress: { label: 'In Progress', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', icon: Clock },
  resolved: { label: 'Resolved', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle },
};

export default function SupportPage() {
  const { profile, loading: userLoading } = useUser();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<TicketWithResponses | null>(null);
  const [ticketDetailOpen, setTicketDetailOpen] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [sendingReply, setSendingReply] = useState(false);
  const [closingTicket, setClosingTicket] = useState(false);
  const [replyMessage, setReplyMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Form state
  const [category, setCategory] = useState<string>('');
  const [summary, setSummary] = useState('');
  const [description, setDescription] = useState('');

  // Fetch tickets
  const fetchTickets = async () => {
    try {
      const response = await fetch('/api/support');
      if (!response.ok) throw new Error('Failed to fetch tickets');
      const data = await response.json();
      setTickets(data);
    } catch (error) {
      toast.error('Failed to load support tickets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!userLoading) {
      fetchTickets();
    }
  }, [userLoading]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [selectedTicket?.responses]);

  // Calculate stats
  const stats = {
    total: tickets.length,
    open: tickets.filter(t => t.status === 'open').length,
    inProgress: tickets.filter(t => t.status === 'in_progress').length,
    resolved: tickets.filter(t => t.status === 'resolved').length,
  };

  // Create ticket
  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!category) {
      toast.error('Please select a category');
      return;
    }

    if (summary.length < 10 || summary.length > 200) {
      toast.error('Summary must be between 10 and 200 characters');
      return;
    }

    setCreating(true);
    try {
      const response = await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, summary, description }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create ticket');
      }

      toast.success('Support ticket created successfully');
      setCategory('');
      setSummary('');
      setDescription('');
      fetchTickets();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create ticket');
    } finally {
      setCreating(false);
    }
  };

  // Open ticket detail
  const handleOpenTicket = async (ticket: SupportTicket) => {
    setLoadingDetail(true);
    setTicketDetailOpen(true);
    setReplyMessage('');

    try {
      const response = await fetch(`/api/support/${ticket.id}`);
      if (!response.ok) throw new Error('Failed to fetch ticket details');
      const data = await response.json();
      setSelectedTicket(data);
    } catch (error) {
      toast.error('Failed to load ticket details');
      setTicketDetailOpen(false);
    } finally {
      setLoadingDetail(false);
    }
  };

  // Send reply
  const handleSendReply = async () => {
    if (!selectedTicket || !replyMessage.trim()) return;

    setSendingReply(true);
    try {
      const response = await fetch(`/api/support/${selectedTicket.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: replyMessage }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to send reply');
      }

      const newResponse = await response.json();
      setSelectedTicket({
        ...selectedTicket,
        responses: [...selectedTicket.responses, newResponse],
      });
      setReplyMessage('');
      toast.success('Reply sent');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to send reply');
    } finally {
      setSendingReply(false);
    }
  };

  // Close ticket
  const handleCloseTicket = async () => {
    if (!selectedTicket) return;

    setClosingTicket(true);
    try {
      const response = await fetch(`/api/support/${selectedTicket.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'resolved' }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to close ticket');
      }

      toast.success('Ticket closed successfully');
      setTicketDetailOpen(false);
      setSelectedTicket(null);
      fetchTickets();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to close ticket');
    } finally {
      setClosingTicket(false);
    }
  };

  // Get category config
  const getCategoryConfig = (categoryValue: string) => {
    return CATEGORIES.find(c => c.value === categoryValue) || CATEGORIES[4];
  };

  if (userLoading || loading) {
    return <PageLoader message="Loading support..." />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
          <Ticket className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold dark:text-white">Support</h1>
          <p className="text-muted-foreground dark:text-gray-400">
            Create and manage your support tickets
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Tickets</CardDescription>
            <CardTitle className="text-3xl font-bold">{stats.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-red-200 dark:border-red-900/50">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <AlertCircle className="w-3 h-3 text-red-500" />
              Open
            </CardDescription>
            <CardTitle className="text-3xl font-bold text-red-600 dark:text-red-400">{stats.open}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-amber-200 dark:border-amber-900/50">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-amber-500" />
              In Progress
            </CardDescription>
            <CardTitle className="text-3xl font-bold text-amber-600 dark:text-amber-400">{stats.inProgress}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-green-200 dark:border-green-900/50">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-1">
              <CheckCircle className="w-3 h-3 text-green-500" />
              Resolved
            </CardDescription>
            <CardTitle className="text-3xl font-bold text-green-600 dark:text-green-400">{stats.resolved}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Create Ticket Form */}
      <Card className="relative overflow-hidden border-2 dark:border-gray-700">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-500 via-red-500 to-orange-500" />
        <CardHeader>
          <div className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-orange-500" />
            <CardTitle>Create New Ticket</CardTitle>
          </div>
          <CardDescription>Describe your issue and we&apos;ll help you resolve it</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreateTicket} className="space-y-4">
            {/* User Info (Read-only) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
              <div>
                <Label className="text-xs text-muted-foreground">Name</Label>
                <p className="font-medium">{profile?.full_name || 'N/A'}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Email</Label>
                <p className="font-medium">{profile?.email || 'N/A'}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Phone</Label>
                <p className="font-medium">{profile?.phone || 'N/A'}</p>
              </div>
            </div>

            {/* Category */}
            <div className="space-y-2">
              <Label htmlFor="category">Category *</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(cat => {
                    const Icon = cat.icon;
                    return (
                      <SelectItem key={cat.value} value={cat.value}>
                        <div className="flex items-center gap-2">
                          <Icon className={`w-4 h-4 ${cat.color}`} />
                          {cat.label}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Summary */}
            <div className="space-y-2">
              <Label htmlFor="summary">Summary * ({summary.length}/200)</Label>
              <Input
                id="summary"
                placeholder="Brief description of your issue (10-200 characters)"
                value={summary}
                onChange={e => setSummary(e.target.value)}
                maxLength={200}
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional) ({description.length}/2000)</Label>
              <Textarea
                id="description"
                placeholder="Provide more details about your issue..."
                value={description}
                onChange={e => setDescription(e.target.value)}
                maxLength={2000}
                className="min-h-[100px]"
              />
            </div>

            {/* Submit */}
            <Button type="submit" disabled={creating} className="w-full md:w-auto">
              {creating ? 'Creating...' : 'Create Ticket'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Tickets List */}
      <Card className="relative overflow-hidden border-2 dark:border-gray-700">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 via-pink-500 to-purple-500" />
        <CardHeader>
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-purple-500" />
            <CardTitle>Your Tickets</CardTitle>
          </div>
          <CardDescription>Click on a ticket to view the conversation</CardDescription>
        </CardHeader>
        <CardContent>
          {tickets.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-purple-50 dark:bg-purple-950/30 flex items-center justify-center">
                <Ticket className="w-8 h-8 text-purple-500 dark:text-purple-400" />
              </div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">No tickets yet</p>
              <p className="text-xs text-muted-foreground dark:text-gray-500">Create a ticket above to get started</p>
            </div>
          ) : (
            <div className="space-y-3">
              {tickets.map(ticket => {
                const categoryConfig = getCategoryConfig(ticket.category);
                const statusConfig = STATUS_CONFIG[ticket.status];
                const CategoryIcon = categoryConfig.icon;
                const StatusIcon = statusConfig.icon;

                return (
                  <button
                    key={ticket.id}
                    onClick={() => handleOpenTicket(ticket)}
                    className="w-full group relative flex items-center gap-4 p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gradient-to-br from-gray-50/50 to-white dark:from-gray-900/50 dark:to-gray-800/50 hover:from-purple-50/50 hover:to-pink-50/50 dark:hover:from-purple-950/20 dark:hover:to-pink-950/20 transition-all duration-300 hover:shadow-md text-left"
                  >
                    {/* Category Icon */}
                    <div className={`w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center ${categoryConfig.color}`}>
                      <CategoryIcon className="w-6 h-6" />
                    </div>

                    {/* Ticket Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate text-gray-900 dark:text-white mb-1 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                        {ticket.summary}
                      </p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground dark:text-gray-400">
                        <span className="capitalize">{categoryConfig.label}</span>
                        <span className="text-gray-400">|</span>
                        <span>{format(new Date(ticket.created_at), 'MMM d, yyyy')}</span>
                        {ticket.response_count && ticket.response_count > 0 && (
                          <>
                            <span className="text-gray-400">|</span>
                            <span className="flex items-center gap-1">
                              <MessageSquare className="w-3 h-3" />
                              {ticket.response_count}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Status Badge */}
                    <Badge className={`${statusConfig.color} border-0 shrink-0`}>
                      <StatusIcon className="w-3 h-3 mr-1" />
                      {statusConfig.label}
                    </Badge>
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Ticket Detail Dialog */}
      <Dialog open={ticketDetailOpen} onOpenChange={setTicketDetailOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col">
          {loadingDetail ? (
            <div className="py-12 text-center">
              <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4" />
              <p className="text-sm text-muted-foreground">Loading ticket...</p>
            </div>
          ) : selectedTicket ? (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2">
                  {(() => {
                    const categoryConfig = getCategoryConfig(selectedTicket.category);
                    const CategoryIcon = categoryConfig.icon;
                    return <CategoryIcon className={`w-5 h-5 ${categoryConfig.color}`} />;
                  })()}
                  <DialogTitle className="line-clamp-1">{selectedTicket.summary}</DialogTitle>
                </div>
                <DialogDescription className="flex items-center gap-2 flex-wrap">
                  <Badge className={`${STATUS_CONFIG[selectedTicket.status].color} border-0`}>
                    {STATUS_CONFIG[selectedTicket.status].label}
                  </Badge>
                  <span>|</span>
                  <span>{format(new Date(selectedTicket.created_at), 'MMM d, yyyy h:mm a')}</span>
                </DialogDescription>
              </DialogHeader>

              {/* Initial Description */}
              {selectedTicket.description && (
                <div className="p-3 bg-muted/50 rounded-lg text-sm">
                  <p className="text-muted-foreground whitespace-pre-wrap">{selectedTicket.description}</p>
                </div>
              )}

              {/* Conversation Thread */}
              <ScrollArea className="flex-1 max-h-[300px] pr-4">
                <div className="space-y-4 py-2">
                  {selectedTicket.responses.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      No responses yet. An admin will respond soon.
                    </div>
                  ) : (
                    selectedTicket.responses.map(response => (
                      <div
                        key={response.id}
                        className={`flex ${response.is_admin ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[80%] p-3 rounded-lg ${
                            response.is_admin
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted'
                          }`}
                        >
                          <p className="text-sm whitespace-pre-wrap">{response.message}</p>
                          <p className={`text-xs mt-1 ${response.is_admin ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                            {response.is_admin ? 'Admin' : 'You'} | {format(new Date(response.created_at), 'MMM d, h:mm a')}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              {/* Reply Input */}
              {selectedTicket.status !== 'resolved' && (
                <div className="flex gap-2 pt-2 border-t">
                  <Textarea
                    placeholder="Type your reply..."
                    value={replyMessage}
                    onChange={e => setReplyMessage(e.target.value)}
                    className="min-h-[60px]"
                    maxLength={2000}
                  />
                  <Button
                    onClick={handleSendReply}
                    disabled={sendingReply || !replyMessage.trim()}
                    size="icon"
                    className="shrink-0"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              )}

              <DialogFooter>
                {selectedTicket.status !== 'resolved' && (
                  <Button
                    variant="outline"
                    onClick={handleCloseTicket}
                    disabled={closingTicket}
                    className="gap-1"
                  >
                    <X className="w-4 h-4" />
                    {closingTicket ? 'Closing...' : 'Close Ticket'}
                  </Button>
                )}
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
