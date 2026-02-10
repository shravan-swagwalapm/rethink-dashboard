'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { RatingStars } from '@/components/ui/rating-stars';
import { PageLoader } from '@/components/ui/page-loader';
import { useUserContext } from '@/contexts/user-context';
import { toast } from 'sonner';
import { Loader2, MessageSquare, Star } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { format } from 'date-fns';
import { MotionFadeIn } from '@/components/ui/motion';
import type { Profile, FeedbackAggregate } from '@/types';

interface MentorSubgroup {
  id: string;
  name: string;
  members: { user_id: string; user: Profile }[];
}

interface FeedbackEntry {
  id: string;
  student_id: string;
  type: string;
  rating: number;
  comment: string | null;
  feedback_date: string;
  student: { id: string; full_name: string | null; email: string; avatar_url: string | null } | null;
  subgroup: { id: string; name: string } | null;
}

export default function MentorFeedbackPage() {
  const { activeRole } = useUserContext();
  const [subgroups, setSubgroups] = useState<MentorSubgroup[]>([]);
  const [selectedSubgroup, setSelectedSubgroup] = useState('');
  const [selectedStudent, setSelectedStudent] = useState('');
  const [feedbackType, setFeedbackType] = useState<'daily' | 'weekly'>('daily');
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [recentFeedback, setRecentFeedback] = useState<FeedbackEntry[]>([]);
  const [myRatings, setMyRatings] = useState<FeedbackAggregate | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [sgRes, fbRes, ratingsRes] = await Promise.all([
        fetch('/api/subgroups/mentor-subgroups'),
        fetch('/api/feedback/mentor'),
        fetch('/api/feedback/mentor-ratings'),
      ]);

      if (sgRes.ok) {
        const sgData = await sgRes.json();
        setSubgroups(sgData.data || []);
        if (sgData.data?.length > 0) setSelectedSubgroup(sgData.data[0].id);
      }

      if (fbRes.ok) {
        const fbData = await fbRes.json();
        setRecentFeedback(fbData.data || []);
      }

      if (ratingsRes.ok) {
        const ratingsData = await ratingsRes.json();
        setMyRatings(ratingsData.data || null);
      }
    } catch {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSubmit = async () => {
    if (!selectedStudent || !selectedSubgroup || rating === 0) {
      toast.error('Please select a student and provide a rating');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/feedback/mentor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: selectedStudent,
          subgroup_id: selectedSubgroup,
          type: feedbackType,
          rating,
          comment: comment.trim() || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to submit');
      }
      toast.success('Feedback submitted');
      setRating(0);
      setComment('');
      setSelectedStudent('');
      // Refresh recent feedback
      const fbRes = await fetch('/api/feedback/mentor');
      if (fbRes.ok) {
        const fbData = await fbRes.json();
        setRecentFeedback(fbData.data || []);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to submit feedback');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <PageLoader message="Loading feedback..." />;

  if (activeRole !== 'mentor') {
    return (
      <div className="text-center py-24 text-muted-foreground">
        <p>Switch to mentor role to give feedback.</p>
      </div>
    );
  }

  const currentSubgroup = subgroups.find(sg => sg.id === selectedSubgroup);
  const students = currentSubgroup?.members || [];

  return (
    <div className="space-y-6">
      <PageHeader
        icon={MessageSquare}
        title="Feedback"
        description="Review and manage student feedback"
      />

      <MotionFadeIn delay={0.1}>
      {/* My Ratings Summary */}
      {myRatings && myRatings.total_count > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Star className="w-4 h-4" />
              My Rating from Students
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <RatingStars value={Math.round(myRatings.average_rating)} readonly size="lg" />
              <span className="text-2xl font-bold">{myRatings.average_rating}</span>
              <span className="text-muted-foreground text-sm">({myRatings.total_count} reviews)</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Submit Feedback Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Submit Feedback
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Subgroup</Label>
              <Select value={selectedSubgroup} onValueChange={setSelectedSubgroup}>
                <SelectTrigger>
                  <SelectValue placeholder="Select subgroup" />
                </SelectTrigger>
                <SelectContent>
                  {subgroups.map(sg => (
                    <SelectItem key={sg.id} value={sg.id}>{sg.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Student</Label>
              <Select value={selectedStudent} onValueChange={setSelectedStudent}>
                <SelectTrigger>
                  <SelectValue placeholder="Select student" />
                </SelectTrigger>
                <SelectContent>
                  {students.map(s => (
                    <SelectItem key={s.user_id} value={s.user_id}>
                      {s.user.full_name || s.user.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={feedbackType} onValueChange={(v) => setFeedbackType(v as 'daily' | 'weekly')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Rating</Label>
            <RatingStars value={rating} onChange={setRating} size="lg" />
          </div>

          <div className="space-y-2">
            <Label>Comment (optional)</Label>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="How is this student performing?"
              rows={3}
            />
          </div>

          <Button onClick={handleSubmit} disabled={submitting} className="gradient-bg">
            {submitting ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Submitting...</>
            ) : (
              'Submit Feedback'
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Recent Feedback */}
      {recentFeedback.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Feedback ({recentFeedback.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentFeedback.slice(0, 20).map((f) => (
                <div key={f.id} className="flex items-start gap-3 p-3 rounded-lg border">
                  <Avatar className="h-8 w-8 mt-0.5">
                    <AvatarImage src={f.student?.avatar_url || ''} />
                    <AvatarFallback className="text-xs">{f.student?.full_name?.charAt(0) || '?'}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{f.student?.full_name || f.student?.email || 'Unknown'}</span>
                      <Badge variant="secondary" className="text-xs capitalize">{f.type}</Badge>
                      <span className="text-xs text-muted-foreground ml-auto">
                        {format(new Date(f.feedback_date), 'MMM d')}
                      </span>
                    </div>
                    <RatingStars value={f.rating} readonly size="sm" />
                    {f.comment && <p className="text-sm text-muted-foreground mt-1">{f.comment}</p>}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      </MotionFadeIn>
    </div>
  );
}
