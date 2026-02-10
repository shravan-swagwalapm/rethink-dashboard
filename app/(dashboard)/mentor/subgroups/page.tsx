'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { PageLoader } from '@/components/ui/page-loader';
import { ProfileDetailSheet } from '@/components/ui/profile-detail-sheet';
import { useUserContext } from '@/contexts/user-context';
import { toast } from 'sonner';
import { Users } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { MotionFadeIn, MotionContainer, MotionItem } from '@/components/ui/motion';
import type { Profile } from '@/types';

interface MentorSubgroup {
  id: string;
  name: string;
  cohort_id: string;
  members: { user_id: string; user: Profile }[];
  member_count: number;
}

export default function MentorSubgroupsPage() {
  const { activeRole } = useUserContext();
  const [subgroups, setSubgroups] = useState<MentorSubgroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);

  const fetchSubgroups = useCallback(async () => {
    try {
      const res = await fetch('/api/subgroups/mentor-subgroups');
      if (!res.ok) throw new Error('Failed to fetch');
      const result = await res.json();
      setSubgroups(result.data || []);
    } catch {
      toast.error('Failed to load subgroups');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSubgroups(); }, [fetchSubgroups]);

  if (loading) return <PageLoader message="Loading your subgroups..." />;

  if (activeRole !== 'mentor') {
    return (
      <div className="text-center py-24 text-muted-foreground">
        <p>Switch to mentor role to view your subgroups.</p>
      </div>
    );
  }

  if (subgroups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Users className="w-16 h-16 mb-4 text-muted-foreground/50" />
        <h2 className="text-xl font-semibold mb-2">No Subgroups Assigned</h2>
        <p className="text-muted-foreground max-w-md">
          You haven&apos;t been assigned to any subgroups yet. Your admin will assign you soon.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Users}
        title="Subgroups"
        description="Manage your mentor subgroups"
      />

      <MotionContainer className="space-y-6">
      {subgroups.map((sg) => (
        <MotionItem key={sg.id}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>{sg.name}</span>
              <Badge variant="secondary">{sg.member_count} students</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sg.members.length === 0 ? (
              <p className="text-muted-foreground text-sm">No students assigned yet.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {sg.members.map((m) => (
                  <button
                    key={m.user_id}
                    onClick={() => setSelectedProfile(m.user)}
                    className="flex items-center gap-3 p-3 rounded-xl border hover:bg-muted/50 transition-colors text-left w-full"
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={m.user.avatar_url || ''} />
                      <AvatarFallback>
                        {m.user.full_name?.charAt(0) || '?'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{m.user.full_name || m.user.email}</p>
                      <p className="text-xs text-muted-foreground truncate">{m.user.email}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        </MotionItem>
      ))}
      </MotionContainer>

      <ProfileDetailSheet
        profile={selectedProfile}
        role="Student"
        open={!!selectedProfile}
        onOpenChange={(open) => { if (!open) setSelectedProfile(null); }}
      />
    </div>
  );
}
