'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Users, ChevronDown, Clock, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';

interface Cohort {
  id: string;
  name: string;
}

interface SessionDetail {
  sessionId: string;
  title: string;
  date: string;
  percentage: number;
  durationAttended: number;
  totalDuration: number;
  attended: boolean;
  segments: { join: string; leave: string; duration: number }[];
}

interface StudentData {
  userId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  sessionsAttended: number;
  sessionsTotal: number;
  avgPercentage: number;
  sessions: SessionDetail[];
}

function getAttendanceBadge(percentage: number) {
  if (percentage >= 75) {
    return <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-200">{percentage}%</Badge>;
  }
  if (percentage >= 50) {
    return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-200">{percentage}%</Badge>;
  }
  return <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-200">{percentage}%</Badge>;
}

function getAttendanceColor(percentage: number) {
  if (percentage >= 75) return 'border-l-green-500';
  if (percentage >= 50) return 'border-l-yellow-500';
  return 'border-l-red-500';
}

function SessionCard({ session }: { session: SessionDetail }) {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div
        className={`border rounded-lg overflow-hidden border-l-4 ${getAttendanceColor(session.percentage)}`}
      >
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="w-full p-4 h-auto justify-between hover:bg-muted/50"
            aria-expanded={open}
          >
            <div className="flex items-center gap-3 text-left">
              <div>
                <p className="font-medium text-sm">{session.title}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                  <Calendar className="w-3 h-3" />
                  <span>{format(new Date(session.date), 'MMM d, yyyy')}</span>
                  <span>·</span>
                  <Clock className="w-3 h-3" />
                  <span>{session.durationAttended} / {session.totalDuration} min</span>
                  {session.segments.length > 1 && (
                    <>
                      <span>·</span>
                      <span>{session.segments.length} joins</span>
                    </>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {session.attended ? getAttendanceBadge(session.percentage) : (
                <Badge variant="outline" className="bg-gray-500/10 text-gray-500 border-gray-200">Absent</Badge>
              )}
              <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
            </div>
          </Button>
        </CollapsibleTrigger>
        <AnimatePresence>
          {open && (
            <CollapsibleContent forceMount>
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <div className="px-4 pb-4 border-t">
                  {session.segments.length > 0 ? (
                    <div className="mt-3 space-y-2">
                      {session.segments.map((seg, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                          <div className="w-2 h-2 rounded-full bg-primary" />
                          <span className="font-medium">Join {i + 1}:</span>
                          <span>
                            {format(new Date(seg.join), 'h:mm a')} — {format(new Date(seg.leave), 'h:mm a')}
                          </span>
                          <span className="text-xs">({seg.duration} min)</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-muted-foreground">No segment data available</p>
                  )}
                </div>
              </motion.div>
            </CollapsibleContent>
          )}
        </AnimatePresence>
      </div>
    </Collapsible>
  );
}

export function StudentAttendanceTab({ cohorts }: { cohorts: Cohort[] }) {
  const [selectedCohort, setSelectedCohort] = useState<string>('');
  const [students, setStudents] = useState<StudentData[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null);

  const fetchStudents = useCallback(async (cohortId: string) => {
    if (!cohortId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/analytics/student-attendance?cohort_id=${cohortId}`);
      if (res.ok) {
        const data = await res.json();
        setStudents(data.students || []);
      }
    } catch (error) {
      console.error('Failed to fetch student attendance:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedCohort) {
      fetchStudents(selectedCohort);
    } else {
      setStudents([]);
    }
  }, [selectedCohort, fetchStudents]);

  return (
    <div className="space-y-4">
      {/* Cohort filter */}
      <div className="flex items-center gap-3">
        <Select value={selectedCohort} onValueChange={setSelectedCohort}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Select Cohort" />
          </SelectTrigger>
          <SelectContent>
            {cohorts.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Card aria-label="Student attendance data">
          <CardHeader>
            <CardTitle>Student Attendance</CardTitle>
            <CardDescription>
              {selectedCohort
                ? `${students.length} students`
                : 'Select a cohort to view student attendance'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!selectedCohort ? (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">Select a cohort</p>
                <p className="text-sm">Choose a cohort to view student attendance data</p>
              </div>
            ) : loading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : students.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">No attendance data</p>
                <p className="text-sm">No attendance records found for this cohort</p>
              </div>
            ) : (
              <div className="space-y-2">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Sessions</TableHead>
                      <TableHead>Avg Attendance</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {students.map((student) => {
                      const isExpanded = expandedStudent === student.userId;
                      return (
                        <React.Fragment key={student.userId}>
                          <TableRow
                            className="cursor-pointer transition-colors hover:bg-muted/50"
                            onClick={() =>
                              setExpandedStudent(isExpanded ? null : student.userId)
                            }
                            aria-expanded={isExpanded}
                          >
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <Avatar className="w-8 h-8">
                                  <AvatarImage src={student.avatarUrl || ''} alt={student.name} />
                                  <AvatarFallback className="text-xs">
                                    {student.name.charAt(0).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="font-medium text-sm">{student.name}</p>
                                  <p className="text-xs text-muted-foreground">{student.email}</p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm">
                              {student.sessionsAttended} / {student.sessionsTotal}
                            </TableCell>
                            <TableCell>{getAttendanceBadge(student.avgPercentage)}</TableCell>
                            <TableCell>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <ChevronDown
                                  className={`w-4 h-4 transition-transform ${
                                    isExpanded ? 'rotate-180' : ''
                                  }`}
                                />
                              </Button>
                            </TableCell>
                          </TableRow>
                          {isExpanded && (
                            <tr>
                              <td colSpan={4} className="p-0">
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.2 }}
                                  className="px-4 pb-4 pt-2"
                                >
                                  <div className="space-y-2 max-w-2xl">
                                    {student.sessions.map((session) => (
                                      <SessionCard key={session.sessionId} session={session} />
                                    ))}
                                  </div>
                                </motion.div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
