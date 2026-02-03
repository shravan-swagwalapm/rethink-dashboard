'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageLoader } from '@/components/ui/page-loader';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { HelpCircle, Eye, Clock, CheckCircle, Send } from 'lucide-react';
import { format } from 'date-fns';
import type { SupportTicket, Profile } from '@/types';

interface TicketResponse {
  id: string;
  ticket_id: string;
  user_id: string;
  message: string;
  is_admin: boolean;
  created_at: string;
}

interface TicketWithUser extends SupportTicket {
  user?: Profile;
}

interface TicketWithResponses extends TicketWithUser {
  responses: TicketResponse[];
}

export default function AdminSupportPage() {
  const [tickets, setTickets] = useState<TicketWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<TicketWithResponses | null>(null);
  const [loadingResponses, setLoadingResponses] = useState(false);
  const [replyMessage, setReplyMessage] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchTickets = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/support');
      if (!response.ok) {
        throw new Error('Failed to fetch tickets');
      }
      const data = await response.json();
      setTickets(data || []);
    } catch (error) {
      console.error('Error fetching tickets:', error);
      toast.error('Failed to load support tickets');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [selectedTicket?.responses]);

  // Fetch ticket responses when viewing a ticket
  const handleViewTicket = async (ticket: TicketWithUser) => {
    setLoadingResponses(true);
    setReplyMessage('');

    // Set ticket with empty responses first
    setSelectedTicket({ ...ticket, responses: [] });

    try {
      const response = await fetch(`/api/admin/support/${ticket.id}/responses`);
      if (!response.ok) {
        throw new Error('Failed to fetch responses');
      }
      const responses = await response.json();
      setSelectedTicket({ ...ticket, responses: responses || [] });
    } catch (error) {
      console.error('Error fetching responses:', error);
      toast.error('Failed to load conversation');
      setSelectedTicket({ ...ticket, responses: [] });
    } finally {
      setLoadingResponses(false);
    }
  };

  // Send admin reply
  const handleSendReply = async () => {
    if (!selectedTicket || !replyMessage.trim()) return;

    setSendingReply(true);
    try {
      const response = await fetch('/api/admin/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticket_id: selectedTicket.id,
          message: replyMessage.trim()
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to send reply');
      }

      const newResponse = await response.json();
      setSelectedTicket({
        ...selectedTicket,
        responses: [...selectedTicket.responses, newResponse],
        status: selectedTicket.status === 'open' ? 'in_progress' : selectedTicket.status,
      });
      setReplyMessage('');
      toast.success('Reply sent');

      // Refresh tickets to update status
      fetchTickets();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to send reply');
    } finally {
      setSendingReply(false);
    }
  };

  const handleStatusChange = async (ticketId: string, newStatus: string) => {
    try {
      const response = await fetch('/api/admin/support', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: ticketId, status: newStatus }),
      });

      if (!response.ok) throw new Error('Failed to update status');

      toast.success('Status updated');
      fetchTickets();
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open':
        return <Badge className="bg-red-500/10 text-red-600">Open</Badge>;
      case 'in_progress':
        return <Badge className="bg-amber-500/10 text-amber-600">In Progress</Badge>;
      case 'resolved':
        return <Badge className="bg-green-500/10 text-green-600">Resolved</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (loading) {
    return <PageLoader message="Loading support tickets..." />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Support Tickets</h1>
        <p className="text-muted-foreground">
          View and manage student support requests
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                <HelpCircle className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Open</p>
                <p className="text-xl font-bold">
                  {tickets.filter(t => t.status === 'open').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Clock className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">In Progress</p>
                <p className="text-xl font-bold">
                  {tickets.filter(t => t.status === 'in_progress').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Resolved</p>
                <p className="text-xl font-bold">
                  {tickets.filter(t => t.status === 'resolved').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Tickets</CardTitle>
          <CardDescription>
            {tickets.length} total ticket{tickets.length !== 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {tickets.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <HelpCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No support tickets</p>
              <p className="text-sm">Tickets will appear here when submitted</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Summary</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tickets.map((ticket) => (
                    <TableRow
                      key={ticket.id}
                      className="group cursor-pointer transition-all duration-200 hover:bg-muted/50"
                      onClick={() => handleViewTicket(ticket)}
                    >
                      <TableCell>
                        <p className="font-medium group-hover:text-primary transition-colors duration-200">
                          {ticket.summary}
                        </p>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium text-sm">
                            {ticket.user?.full_name || 'Unknown'}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {ticket.user?.email || ''}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Select
                          value={ticket.status}
                          onValueChange={(value) => handleStatusChange(ticket.id, value)}
                        >
                          <SelectTrigger className="w-[140px] h-8 text-xs rounded-lg border-muted hover:border-primary/50 transition-colors">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="open">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-red-500" />
                                Open
                              </div>
                            </SelectItem>
                            <SelectItem value="in_progress">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-amber-500" />
                                In Progress
                              </div>
                            </SelectItem>
                            <SelectItem value="resolved">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-green-500" />
                                Resolved
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(ticket.created_at), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-primary hover:text-primary-foreground"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewTicket(ticket);
                          }}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedTicket} onOpenChange={(open) => !open && setSelectedTicket(null)}>
        <DialogContent className="sm:max-w-[650px] max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
          {/* Header Section */}
          <div className="p-6 border-b bg-gradient-to-br from-muted/30 to-background">
            <DialogHeader className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <HelpCircle className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <DialogTitle className="text-lg font-semibold leading-tight">
                    {selectedTicket?.summary}
                  </DialogTitle>
                  <DialogDescription className="flex items-center gap-2 flex-wrap mt-2">
                    {selectedTicket && getStatusBadge(selectedTicket.status)}
                    <span className="text-muted-foreground">|</span>
                    <span className="text-muted-foreground text-sm">
                      {selectedTicket && format(new Date(selectedTicket.created_at), 'MMM d, yyyy h:mm a')}
                    </span>
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            {/* User Info Section */}
            <div className="mt-4 p-4 bg-muted/50 rounded-xl border border-muted">
              <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wide">
                Submitted By
              </p>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Name</p>
                  <p className="text-sm font-medium truncate">
                    {selectedTicket?.user?.full_name || 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="text-sm font-medium truncate">
                    {selectedTicket?.user?.email || 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Phone</p>
                  <p className="text-sm font-medium truncate">
                    {selectedTicket?.user?.phone || 'N/A'}
                  </p>
                </div>
              </div>
            </div>

            {/* Initial Description */}
            {selectedTicket?.description && (
              <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-xl border border-blue-200 dark:border-blue-900">
                <p className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-2 uppercase tracking-wide">
                  Initial Description
                </p>
                <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                  {selectedTicket.description}
                </p>
              </div>
            )}
          </div>

          {/* Conversation Thread */}
          <ScrollArea className="flex-1 min-h-[200px] max-h-[300px]">
            {loadingResponses ? (
              <div className="p-6 space-y-4">
                {/* Loading Skeleton */}
                <div className="flex justify-start">
                  <div className="h-16 w-2/3 bg-muted animate-pulse rounded-2xl" />
                </div>
                <div className="flex justify-end">
                  <div className="h-16 w-2/3 bg-muted animate-pulse rounded-2xl" />
                </div>
                <div className="flex justify-start">
                  <div className="h-12 w-1/2 bg-muted animate-pulse rounded-2xl" />
                </div>
              </div>
            ) : (
              <div className="p-6 space-y-4">
                {selectedTicket?.responses.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                      <HelpCircle className="w-8 h-8 text-muted-foreground/50" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">No messages yet</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">Start the conversation below</p>
                  </div>
                ) : (
                  selectedTicket?.responses.map(response => (
                    <div
                      key={response.id}
                      className={`flex ${response.is_admin ? 'justify-end' : 'justify-start'} transition-all duration-200`}
                    >
                      <div
                        className={`max-w-[80%] p-4 rounded-2xl transition-all duration-200 hover:shadow-md ${
                          response.is_admin
                            ? 'bg-primary text-primary-foreground rounded-br-md'
                            : 'bg-muted rounded-bl-md'
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap leading-relaxed">{response.message}</p>
                        <p className={`text-xs mt-2 flex items-center gap-1.5 ${
                          response.is_admin ? 'text-primary-foreground/70' : 'text-muted-foreground'
                        }`}>
                          <span className="font-medium">{response.is_admin ? 'Admin' : 'Student'}</span>
                          <span className="opacity-50">|</span>
                          <span>{format(new Date(response.created_at), 'MMM d, h:mm a')}</span>
                        </p>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </ScrollArea>

          {/* Reply Input */}
          {selectedTicket?.status !== 'resolved' ? (
            <div className="p-4 border-t bg-muted/20">
              <div className="flex gap-3">
                <Textarea
                  placeholder="Type your reply..."
                  value={replyMessage}
                  onChange={e => setReplyMessage(e.target.value)}
                  className="min-h-[80px] resize-none rounded-xl border-muted focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200"
                  maxLength={2000}
                />
                <Button
                  onClick={handleSendReply}
                  disabled={sendingReply || !replyMessage.trim()}
                  size="icon"
                  className="h-10 w-10 rounded-xl shrink-0 self-end transition-all duration-200 hover:scale-105"
                >
                  {sendingReply ? (
                    <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {replyMessage.length}/2000 characters
              </p>
            </div>
          ) : (
            <div className="p-4 border-t bg-green-50 dark:bg-green-950/20">
              <div className="flex items-center justify-center gap-2 text-green-600 dark:text-green-400">
                <CheckCircle className="w-4 h-4" />
                <span className="text-sm font-medium">This ticket has been resolved</span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
