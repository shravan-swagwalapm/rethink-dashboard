'use client';

import { useState, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Loader2, Check, X, Search, Phone } from 'lucide-react';
import { format } from 'date-fns';

interface RsvpUser {
  id: string;
  response: string;
  created_at: string;
  user: {
    id: string;
    email: string;
    full_name: string | null;
    phone: string | null;
    avatar_url: string | null;
  };
}

interface RsvpListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string | null;
  sessionTitle: string;
}

export function RsvpListDialog({ open, onOpenChange, sessionId, sessionTitle }: RsvpListDialogProps) {
  const [loading, setLoading] = useState(false);
  const [yesRsvps, setYesRsvps] = useState<RsvpUser[]>([]);
  const [noRsvps, setNoRsvps] = useState<RsvpUser[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchRsvps = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/sessions/${sessionId}/rsvps`);
      if (!response.ok) throw new Error('Failed to fetch RSVPs');
      const data = await response.json();
      setYesRsvps(data.yes || []);
      setNoRsvps(data.no || []);
    } catch {
      toast.error('Failed to load RSVP details');
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    if (open && sessionId) {
      fetchRsvps();
    }
    if (!open) {
      setSearchQuery('');
    }
  }, [open, sessionId, fetchRsvps]);

  const filterRsvps = (rsvps: RsvpUser[]) => {
    if (!searchQuery) return rsvps;
    const query = searchQuery.toLowerCase();
    return rsvps.filter(r =>
      r.user?.full_name?.toLowerCase().includes(query) ||
      r.user?.email?.toLowerCase().includes(query) ||
      r.user?.phone?.toLowerCase().includes(query)
    );
  };

  const filteredYes = filterRsvps(yesRsvps);
  const filteredNo = filterRsvps(noRsvps);

  const renderUser = (rsvp: RsvpUser) => (
    <div key={rsvp.id || rsvp.user?.id} className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-muted/50">
      <Avatar className="h-8 w-8">
        <AvatarImage src={rsvp.user?.avatar_url || ''} />
        <AvatarFallback className="text-xs gradient-bg text-white">
          {rsvp.user?.full_name?.charAt(0) || rsvp.user?.email?.charAt(0)?.toUpperCase() || '?'}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">
          {rsvp.user?.full_name || 'Unnamed'}
        </p>
        <p className="text-xs text-muted-foreground truncate">{rsvp.user?.email}</p>
      </div>
      {rsvp.user?.phone && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Phone className="w-3 h-3" />
          <span className="font-mono">{rsvp.user.phone}</span>
        </div>
      )}
      <span className="text-xs text-muted-foreground whitespace-nowrap">
        {format(new Date(rsvp.created_at), 'MMM d, h:mm a')}
      </span>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>RSVP Details</DialogTitle>
          <DialogDescription>
            {sessionTitle}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Search */}
            {(yesRsvps.length + noRsvps.length) > 5 && (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email, or phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            )}

            <div className="max-h-[50vh] overflow-y-auto space-y-4">
              {/* Yes RSVPs */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Badge className="bg-green-500/10 text-green-600">
                    <Check className="w-3 h-3 mr-1" />
                    Attending ({filteredYes.length})
                  </Badge>
                </div>
                {filteredYes.length > 0 ? (
                  <div className="space-y-1">
                    {filteredYes.map(renderUser)}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground py-2 px-3">
                    {searchQuery ? 'No matching attendees' : 'No RSVPs yet'}
                  </p>
                )}
              </div>

              {/* No RSVPs */}
              {(noRsvps.length > 0 || searchQuery) && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="secondary" className="text-red-500">
                      <X className="w-3 h-3 mr-1" />
                      Not Attending ({filteredNo.length})
                    </Badge>
                  </div>
                  {filteredNo.length > 0 ? (
                    <div className="space-y-1">
                      {filteredNo.map(renderUser)}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground py-2 px-3">
                      {searchQuery ? 'No matching users' : 'None'}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
