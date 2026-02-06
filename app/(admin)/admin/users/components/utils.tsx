import { Badge } from '@/components/ui/badge';
import {
  Shield,
  Users,
  UserCheck,
  GraduationCap,
  Star,
} from 'lucide-react';
import type { Cohort } from '@/types';
import type { RoleAssignmentInput } from '../types';

export const getRoleIcon = (role: string) => {
  switch (role) {
    case 'admin':
      return <Shield className="w-4 h-4 text-red-500" />;
    case 'company_user':
      return <UserCheck className="w-4 h-4 text-purple-500" />;
    case 'mentor':
      return <GraduationCap className="w-4 h-4 text-blue-500" />;
    case 'master':
      return <Star className="w-4 h-4 text-yellow-500" />;
    default:
      return <Users className="w-4 h-4 text-green-500" />;
  }
};

export const getRoleBadge = (role: string) => {
  const colors: Record<string, string> = {
    admin: 'bg-red-500/10 text-red-600',
    company_user: 'bg-purple-500/10 text-purple-600',
    mentor: 'bg-blue-500/10 text-blue-600',
    student: 'bg-green-500/10 text-green-600',
    master: 'bg-yellow-500/10 text-yellow-600',
  };

  return (
    <Badge className={colors[role] || 'bg-muted'}>
      <span className="flex items-center gap-1">
        {getRoleIcon(role)}
        <span className="capitalize">{role === 'master' ? 'Guest' : role.replace('_', ' ')}</span>
      </span>
    </Badge>
  );
};

export const getAvailableCohortsForRole = (role: string, assignments: RoleAssignmentInput[], cohorts: Cohort[]) => {
  if (role === 'mentor') {
    const studentCohorts = assignments
      .filter(a => a.role === 'student' && a.cohort_id)
      .map(a => a.cohort_id);
    return cohorts.filter(c => !studentCohorts.includes(c.id));
  }
  return cohorts;
};
