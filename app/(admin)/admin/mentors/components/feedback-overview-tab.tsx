'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { RatingStars } from '@/components/ui/rating-stars';
import { Loader2 } from 'lucide-react';
import { format } from 'date-fns';

interface FeedbackOverviewTabProps {
  cohortId: string;
}

interface MentorFeedbackRow {
  id: string;
  type: string;
  rating: number;
  comment: string | null;
  feedback_date: string;
  week_number: number | null;
  mentor: { id: string; full_name: string | null; email: string } | null;
  student: { id: string; full_name: string | null; email: string } | null;
  subgroup: { id: string; name: string; cohort_id: string } | null;
}

interface StudentFeedbackRow {
  id: string;
  rating: number;
  comment: string | null;
  week_number: number | null;
  created_at: string;
  student: { id: string; full_name: string | null; email: string } | null;
}

export function FeedbackOverviewTab({ cohortId }: FeedbackOverviewTabProps) {
  const [feedbackType, setFeedbackType] = useState('mentor_to_student');
  const [mentorFeedback, setMentorFeedback] = useState<MentorFeedbackRow[]>([]);
  const [studentFeedback, setStudentFeedback] = useState<StudentFeedbackRow[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchFeedback = useCallback(async () => {
    if (!cohortId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ cohort_id: cohortId, type: feedbackType });
      const res = await fetch(`/api/admin/feedback?${params}`);
      if (!res.ok) throw new Error('Failed to fetch feedback');
      const result = await res.json();

      if (feedbackType === 'student_to_mentor') {
        setStudentFeedback(result.data || []);
      } else {
        setMentorFeedback(result.data || []);
      }
    } catch (error) {
      console.error('Error fetching feedback:', error);
    } finally {
      setLoading(false);
    }
  }, [cohortId, feedbackType]);

  useEffect(() => {
    fetchFeedback();
  }, [fetchFeedback]);

  if (!cohortId) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Select a cohort to view feedback
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Tabs value={feedbackType} onValueChange={setFeedbackType}>
        <TabsList>
          <TabsTrigger value="mentor_to_student">Mentor → Student</TabsTrigger>
          <TabsTrigger value="student_to_mentor">Student → Mentor</TabsTrigger>
        </TabsList>

        <TabsContent value="mentor_to_student" className="mt-4">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>
          ) : mentorFeedback.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                No mentor feedback submitted yet for this cohort.
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Mentor → Student Feedback ({mentorFeedback.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="pb-3 font-medium">Date</th>
                        <th className="pb-3 font-medium">Mentor</th>
                        <th className="pb-3 font-medium">Student</th>
                        <th className="pb-3 font-medium">Subgroup</th>
                        <th className="pb-3 font-medium">Type</th>
                        <th className="pb-3 font-medium">Rating</th>
                        <th className="pb-3 font-medium">Comment</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mentorFeedback.map((f) => (
                        <tr key={f.id} className="border-b last:border-0">
                          <td className="py-3 whitespace-nowrap">
                            {format(new Date(f.feedback_date), 'MMM d, yyyy')}
                          </td>
                          <td className="py-3">{f.mentor?.full_name || f.mentor?.email || '—'}</td>
                          <td className="py-3">{f.student?.full_name || f.student?.email || '—'}</td>
                          <td className="py-3">{f.subgroup?.name || '—'}</td>
                          <td className="py-3">
                            <Badge variant="secondary" className="capitalize text-xs">{f.type}</Badge>
                          </td>
                          <td className="py-3">
                            <RatingStars value={f.rating} readonly size="sm" />
                          </td>
                          <td className="py-3 max-w-[200px] truncate text-muted-foreground">
                            {f.comment || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="student_to_mentor" className="mt-4">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>
          ) : studentFeedback.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                No student feedback submitted yet.
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Student → Mentor Feedback ({studentFeedback.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="pb-3 font-medium">Date</th>
                        <th className="pb-3 font-medium">Student</th>
                        <th className="pb-3 font-medium">Week</th>
                        <th className="pb-3 font-medium">Rating</th>
                        <th className="pb-3 font-medium">Comment</th>
                      </tr>
                    </thead>
                    <tbody>
                      {studentFeedback.map((f) => (
                        <tr key={f.id} className="border-b last:border-0">
                          <td className="py-3 whitespace-nowrap">
                            {format(new Date(f.created_at), 'MMM d, yyyy')}
                          </td>
                          <td className="py-3">{f.student?.full_name || f.student?.email || '—'}</td>
                          <td className="py-3">{f.week_number != null ? `Week ${f.week_number}` : '—'}</td>
                          <td className="py-3">
                            <RatingStars value={f.rating} readonly size="sm" />
                          </td>
                          <td className="py-3 max-w-[200px] truncate text-muted-foreground">
                            {f.comment || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
