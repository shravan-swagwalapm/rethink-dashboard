'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@/hooks/use-user';
import { getClient } from '@/lib/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import {
  Search,
  Users,
  Mail,
  Phone,
  Linkedin,
  MoreVertical,
  ExternalLink,
  Calendar,
  TrendingUp,
  Trophy,
} from 'lucide-react';
import Link from 'next/link';
import type { Profile, Ranking, Attendance } from '@/types';

interface TeamMember extends Profile {
  ranking?: Ranking;
  attendance_percentage?: number;
  catchup_percentage?: number;
}

export default function TeamPage() {
  const { profile, isMentor, isAdmin, loading: userLoading } = useUser();
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchTeamMembers = async () => {
      if (!profile) {
        setLoading(false);
        return;
      }

      const supabase = getClient();

      try {
        // Fetch team members assigned to this mentor
        let query = supabase
          .from('profiles')
          .select('*')
          .eq('role', 'student');

        if (isMentor && !isAdmin) {
          query = query.eq('mentor_id', profile.id);
        }

        const { data: members, error } = await query.order('full_name', { ascending: true });

        if (error) throw error;

        // Fetch rankings for all members
        const memberIds = members?.map((m: Profile) => m.id) || [];
        const { data: rankings } = await supabase
          .from('rankings')
          .select('*')
          .in('user_id', memberIds);

        // Fetch attendance data
        const { data: attendanceData } = await supabase
          .from('attendance')
          .select('user_id, attendance_percentage')
          .in('user_id', memberIds);

        // Calculate average attendance per user
        const attendanceByUser = attendanceData?.reduce((acc: Record<string, { total: number; count: number }>, a: { user_id: string; attendance_percentage: number | null }) => {
          if (!acc[a.user_id]) {
            acc[a.user_id] = { total: 0, count: 0 };
          }
          acc[a.user_id].total += a.attendance_percentage || 0;
          acc[a.user_id].count += 1;
          return acc;
        }, {} as Record<string, { total: number; count: number }>);

        // Merge all data
        const enrichedMembers = members?.map((member: Profile) => ({
          ...member,
          ranking: rankings?.find((r: Ranking) => r.user_id === member.id),
          attendance_percentage: attendanceByUser?.[member.id]
            ? Math.round(attendanceByUser[member.id].total / attendanceByUser[member.id].count)
            : 0,
        })) || [];

        setTeamMembers(enrichedMembers);
      } catch (error) {
        console.error('Error fetching team members:', error);
        toast.error('Failed to load team members');
      } finally {
        setLoading(false);
      }
    };

    if (!userLoading && (isMentor || isAdmin)) {
      fetchTeamMembers();
    } else if (!userLoading) {
      setLoading(false);
    }
  }, [profile, isMentor, isAdmin, userLoading]);

  // Filter team members based on search
  const filteredMembers = searchQuery
    ? teamMembers.filter(
        m =>
          m.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          m.email.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : teamMembers;

  const getAttendanceColor = (percentage: number) => {
    if (percentage >= 75) return 'text-green-600 dark:text-green-400';
    if (percentage >= 50) return 'text-amber-600 dark:text-amber-400';
    return 'text-red-600 dark:text-red-400';
  };

  if (userLoading || loading) {
    return <PageLoader message="Loading team..." />;
  }

  if (!isMentor && !isAdmin) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <Users className="w-12 h-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">Access Restricted</h3>
          <p className="text-muted-foreground text-center max-w-sm">
            Team management is only available for mentors and administrators.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Team Management</h1>
          <p className="text-muted-foreground">
            View and manage your assigned students
          </p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search students..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Users className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Students</p>
                <p className="text-2xl font-bold">{teamMembers.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg Attendance</p>
                <p className="text-2xl font-bold">
                  {teamMembers.length > 0
                    ? Math.round(
                        teamMembers.reduce((acc, m) => acc + (m.attendance_percentage || 0), 0) /
                          teamMembers.length
                      )
                    : 0}
                  %
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <Trophy className="w-6 h-6 text-amber-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Below 75% Attendance</p>
                <p className="text-2xl font-bold">
                  {teamMembers.filter(m => (m.attendance_percentage || 0) < 75).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Team Table */}
      <Card>
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
          <CardDescription>
            {filteredMembers.length} student{filteredMembers.length !== 1 ? 's' : ''} assigned to you
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredMembers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
              {searchQuery ? (
                <>
                  <p className="text-lg font-medium">No results found</p>
                  <p className="text-sm">Try a different search term</p>
                </>
              ) : (
                <>
                  <p className="text-lg font-medium">No team members assigned</p>
                  <p className="text-sm">Students will appear here once assigned to you</p>
                </>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Session Attendance</TableHead>
                    <TableHead>Rank</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMembers.map((member) => (
                    <TableRow key={member.id} className="hover:bg-muted/50">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={member.avatar_url || ''} />
                            <AvatarFallback className="gradient-bg text-white">
                              {member.full_name?.charAt(0) || member.email.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{member.full_name || 'Unnamed'}</p>
                            <p className="text-sm text-muted-foreground">{member.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {member.phone && (
                            <a
                              href={`tel:${member.phone}`}
                              className="p-2 rounded-lg hover:bg-muted transition-colors"
                              title={member.phone}
                            >
                              <Phone className="w-4 h-4 text-muted-foreground" />
                            </a>
                          )}
                          <a
                            href={`mailto:${member.email}`}
                            className="p-2 rounded-lg hover:bg-muted transition-colors"
                          >
                            <Mail className="w-4 h-4 text-muted-foreground" />
                          </a>
                          {member.linkedin_url && (
                            <a
                              href={member.linkedin_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 rounded-lg hover:bg-muted transition-colors"
                            >
                              <Linkedin className="w-4 h-4 text-muted-foreground" />
                            </a>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className={`font-medium ${getAttendanceColor(member.attendance_percentage || 0)}`}>
                            {member.attendance_percentage || 0}%
                          </span>
                          {(member.attendance_percentage || 0) < 75 && (
                            <Badge variant="destructive" className="text-xs">
                              Low
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          #{member.ranking?.rank || '—'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link href={`/attendance?student=${member.id}`}>
                                <Calendar className="w-4 h-4 mr-2" />
                                View Attendance
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <a href={`mailto:${member.email}`}>
                                <Mail className="w-4 h-4 mr-2" />
                                Send Email
                              </a>
                            </DropdownMenuItem>
                            {member.linkedin_url && (
                              <DropdownMenuItem asChild>
                                <a href={member.linkedin_url} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink className="w-4 h-4 mr-2" />
                                  View LinkedIn
                                </a>
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Low Attendance Alert */}
      {teamMembers.filter(m => (m.attendance_percentage || 0) < 75).length > 0 && (
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardHeader>
            <CardTitle className="text-amber-600 dark:text-amber-400 flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Attention Required
            </CardTitle>
            <CardDescription>
              The following students have attendance below 75%
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {teamMembers
                .filter(m => (m.attendance_percentage || 0) < 75)
                .map(m => (
                  <Badge key={m.id} variant="outline" className="border-amber-500/50">
                    {m.full_name || m.email} ({m.attendance_percentage}%)
                  </Badge>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
