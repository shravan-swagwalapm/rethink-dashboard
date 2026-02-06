import type { Profile, Cohort, UserRoleAssignment } from '@/types';

export interface UserWithCohort extends Profile {
  cohort?: Cohort;
  role_assignments?: UserRoleAssignment[];
}

export interface RoleAssignmentInput {
  role: string;
  cohort_id: string | null;
}

export interface BulkUser {
  email: string;
  full_name: string;
  phone: string;
  cohort_tag: string;
}

export interface BulkResult {
  email: string;
  success: boolean;
  error?: string;
}
