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
                    <TableRow key={ticket.id}>
                      <TableCell>
                        <p className="font-medium">{ticket.summary}</p>
                      </TableCell>
                      <TableCell>
                        {ticket.user?.full_name || ticket.user?.email || 'Unknown'}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={ticket.status}
                          onValueChange={(value) => handleStatusChange(ticket.id, value)}
                        >
                          <SelectTrigger className="w-[130px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="open">Open</SelectItem>
                            <SelectItem value="in_progress">In Progress</SelectItem>
                            <SelectItem value="resolved">Resolved</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        {format(new Date(ticket.created_at), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleViewTicket(ticket)}
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
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{selectedTicket?.summary}</DialogTitle>
            <DialogDescription className="flex items-center gap-2 flex-wrap">
              Submitted by {selectedTicket?.user?.full_name || selectedTicket?.user?.email} on{' '}
              {selectedTicket && format(new Date(selectedTicket.created_at), 'MMMM d, yyyy')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 flex-1 flex flex-col min-h-0">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Status:</span>
              {selectedTicket && getStatusBadge(selectedTicket.status)}
            </div>

            {/* Initial Description */}
            {selectedTicket?.description && (
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Initial Description:</p>
                <p className="text-sm whitespace-pre-wrap">
                  {selectedTicket.description}
                </p>
              </div>
            )}

            {/* Conversation Thread */}
            <ScrollArea className="flex-1 max-h-[300px] pr-4">
              {loadingResponses ? (
                <div className="py-8 text-center">
                  <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Loading conversation...</p>
                </div>
              ) : (
                <div className="space-y-4 py-2">
                  {selectedTicket?.responses.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      No messages yet. Start the conversation below.
                    </div>
                  ) : (
                    selectedTicket?.responses.map(response => (
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
                            {response.is_admin ? 'Admin' : 'Student'} | {format(new Date(response.created_at), 'MMM d, h:mm a')}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </ScrollArea>

            {/* Reply Input - only show for non-resolved tickets */}
            {selectedTicket?.status !== 'resolved' ? (
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
            ) : (
              <div className="text-center py-2 text-sm text-muted-foreground border-t pt-4">
                This ticket is resolved. No further replies can be sent.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
