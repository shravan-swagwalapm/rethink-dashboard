'use client';

import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2 } from 'lucide-react';
import type { Cohort } from '@/types';
import type { RoleAssignmentInput } from '../types';
import { getAvailableCohortsForRole } from './utils';

interface RoleAssignmentEditorProps {
  assignments: RoleAssignmentInput[];
  cohorts: Cohort[];
  onAdd: () => void;
  onRemove: (index: number) => void;
  onUpdate: (index: number, field: 'role' | 'cohort_id', value: string | null) => void;
}

export function RoleAssignmentEditor({
  assignments,
  cohorts,
  onAdd,
  onRemove,
  onUpdate,
}: RoleAssignmentEditorProps) {
  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {assignments.map((assignment, index) => {
          const availableCohorts = getAvailableCohortsForRole(assignment.role, assignments, cohorts);
          const showCohortWarning = assignment.role === 'mentor' && availableCohorts.length < cohorts.length;

          return (
            <div key={index} className="space-y-1">
              <div className="flex gap-2 items-start">
                <Select
                  value={assignment.role}
                  onValueChange={(value) => onUpdate(index, 'role', value)}
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="student">Student</SelectItem>
                    <SelectItem value="mentor">Mentor</SelectItem>
                    <SelectItem value="master">Guest</SelectItem>
                    <SelectItem value="company_user">Company User</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>

                {['student', 'mentor', 'master'].includes(assignment.role) ? (
                  <Select
                    value={assignment.cohort_id || ''}
                    onValueChange={(value) => onUpdate(index, 'cohort_id', value || null)}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder={assignment.role === 'master' ? 'No cohort (optional)' : 'Select cohort'} />
                    </SelectTrigger>
                    <SelectContent>
                      {assignment.role === 'master' && (
                        <SelectItem value="">No cohort</SelectItem>
                      )}
                      {availableCohorts.map((cohort) => (
                        <SelectItem key={cohort.id} value={cohort.id}>
                          {cohort.name} ({cohort.tag})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="flex-1 px-3 py-2 text-sm text-muted-foreground border rounded-md bg-muted/50">
                    No cohort needed
                  </div>
                )}

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => onRemove(index)}
                  disabled={assignments.length === 1}
                  className="shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
              {showCohortWarning && (
                <p className="text-xs text-amber-500 ml-1">
                  Some cohorts hidden (user is a student there)
                </p>
              )}
            </div>
          );
        })}
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onAdd}
        className="w-full"
      >
        <Plus className="w-4 h-4 mr-2" />
        Add Another Role
      </Button>
    </div>
  );
}
