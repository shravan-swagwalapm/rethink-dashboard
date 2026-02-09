'use client';

import { useState, useEffect, useCallback } from 'react';
import { useUserContext } from '@/contexts/user-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { PageLoader } from '@/components/ui/page-loader';
import { ProfileDetailSheet } from '@/components/ui/profile-detail-sheet';
import { toast } from 'sonner';
import { Users, UserCheck } from 'lucide-react';
import type { Profile } from '@/types';

interface SubgroupData {
  subgroup: { id: string; name: string; cohort_id: string; cohort_name: string };
  members: { user_id: string; user: Profile }[];
  mentors: { user_id: string; user: Profile }[];
  current_user_id: string;
}

export default function MySubgroupPage() {
  const { activeCohortId } = useUserContext();
  const [data, setData] = useState<SubgroupData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>('');

  const fetchData = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (activeCohortId) params.set('cohort_id', activeCohortId);
      const res = await fetch(`/api/subgroups/my-subgroup?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const result = await res.json();
      setData(result.data);
    } catch {
      toast.error('Failed to load subgroup data');
    } finally {
      setLoading(false);
    }
  }, [activeCohortId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return <PageLoader message="Loading your subgroup..." />;

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Users className="w-16 h-16 mb-4 text-muted-foreground/50" />
        <h2 className="text-xl font-semibold mb-2">No Subgroup Assigned</h2>
        <p className="text-muted-foreground max-w-md">
          You haven&apos;t been assigned to a subgroup yet. Your admin will assign you soon.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">{data.subgroup.name}</h1>
        <p className="text-muted-foreground">{data.subgroup.cohort_name}</p>
      </div>

      {/* Mentor Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <UserCheck className="w-5 h-5" />
            Mentor{data.mentors.length !== 1 ? 's' : ''}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.mentors.length === 0 ? (
            <p className="text-muted-foreground text-sm">A mentor will be assigned soon.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {data.mentors.map((m) => (
                <button
                  key={m.user_id}
                  onClick={() => { setSelectedProfile(m.user); setSelectedRole('Mentor'); }}
                  className="flex items-center gap-3 p-3 rounded-xl border hover:bg-muted/50 transition-colors text-left w-full"
                >
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={m.user.avatar_url || ''} />
                    <AvatarFallback className="gradient-bg text-white">
                      {m.user.full_name?.charAt(0) || '?'}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold">{m.user.full_name || m.user.email}</p>
                    <Badge variant="secondary" className="text-xs mt-0.5">Mentor</Badge>
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Students Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="w-5 h-5" />
            Subgroup Members ({data.members.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.members.length === 0 ? (
            <p className="text-muted-foreground text-sm">No other members in your subgroup yet.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.members.map((m) => (
                <button
                  key={m.user_id}
                  onClick={() => { setSelectedProfile(m.user); setSelectedRole('Student'); }}
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

      {/* Profile Detail Sheet */}
      <ProfileDetailSheet
        profile={selectedProfile}
        role={selectedRole}
        open={!!selectedProfile}
        onOpenChange={(open) => { if (!open) setSelectedProfile(null); }}
      />
    </div>
  );
}
