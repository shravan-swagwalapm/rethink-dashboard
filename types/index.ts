// Database Types for Rethink Systems Dashboard

export type UserRole = 'admin' | 'company_user' | 'mentor' | 'student' | 'master';

export type CohortStatus = 'active' | 'completed' | 'archived';

export type RsvpResponse = 'yes' | 'no';

export type PaymentType = 'full' | 'partial' | 'emi';

export type InvoiceStatus = 'pending' | 'paid' | 'overdue';

export type TicketStatus = 'open' | 'in_progress' | 'resolved';

export type NotificationType = 'session_reminder' | 'new_resource' | 'system';

export type ResourceType = 'file' | 'folder' | 'link';

export type ModuleResourceType = 'video' | 'slides' | 'document' | 'link';

export type FileType = 'pdf' | 'doc' | 'docx' | 'xls' | 'xlsx' | 'mp4' | 'other';

// Core Types
export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  linkedin_url: string | null;
  portfolio_url: string | null;
  timezone: string;
  role: UserRole;
  cohort_id: string | null;
  mentor_id: string | null;
  avatar_url: string | null;
  calendly_url: string | null;
  calendly_shared: boolean;
  created_at: string;
  updated_at: string;
  // Multi-role support
  role_assignments?: UserRoleAssignment[];
}

// User role assignment (for multi-role support)
export interface UserRoleAssignment {
  id: string;
  user_id: string;
  role: UserRole;
  cohort_id: string | null;
  cohort?: Cohort;
  created_at: string;
}

// Session cohort mapping (for multi-cohort sessions)
export interface SessionCohort {
  id: string;
  session_id: string;
  cohort_id: string;
  cohort?: Cohort;
  created_at: string;
}

// Session guest invite (for master/guest users)
export interface SessionGuest {
  id: string;
  session_id: string;
  user_id: string;
  user?: Profile;
  created_at: string;
}

export interface Cohort {
  id: string;
  name: string;
  tag: string;
  start_date: string | null;
  end_date: string | null;
  status: CohortStatus;
  created_by: string | null;
  created_at: string;
}

export interface Session {
  id: string;
  title: string;
  description: string | null;
  cohort_id: string | null;  // Legacy single cohort (deprecated, use cohorts)
  scheduled_at: string;
  duration_minutes: number;
  zoom_link: string | null;
  zoom_meeting_id: string | null;
  google_event_id: string | null;
  created_by: string | null;
  created_at: string;
  // Multi-cohort and guest support
  cohorts?: SessionCohort[];
  guests?: SessionGuest[];
}

export interface Rsvp {
  id: string;
  session_id: string;
  user_id: string;
  response: RsvpResponse;
  reminder_enabled: boolean;
  created_at: string;
}

export interface Attendance {
  id: string;
  session_id: string;
  user_id: string;
  zoom_user_email: string | null;
  join_time: string | null;
  leave_time: string | null;
  duration_seconds: number | null;
  attendance_percentage: number | null;
  created_at: string;
}

export interface Resource {
  id: string;
  name: string;
  type: ResourceType;
  file_path: string | null;
  file_type: FileType | null;
  file_size: number | null;
  external_url: string | null;
  parent_id: string | null;
  cohort_id: string | null;
  week_number: number | null;
  keywords: string[] | null;
  uploaded_by: string | null;
  created_at: string;
}

export interface LearningModule {
  id: string;
  title: string;
  description: string | null;
  week_number: number | null;
  order_index: number | null;
  cohort_id: string | null;  // Nullable for global modules
  is_global: boolean;  // True for global library modules
  created_at: string;
}

// Cohort-Module link for cross-cohort resource sharing
export interface CohortModuleLink {
  id: string;
  cohort_id: string;
  module_id: string;
  source_cohort_id: string | null;  // Original cohort this was copied from
  linked_at: string;
  linked_by: string | null;
}

export interface Recording {
  id: string;
  module_id: string | null;
  session_id: string | null;
  title: string;
  video_url: string | null;
  duration_seconds: number | null;
  thumbnail_url: string | null;
  created_at: string;
}

export interface ModuleResource {
  id: string;
  module_id: string | null;
  title: string;
  content_type: ModuleResourceType;
  google_drive_id: string | null;
  external_url: string | null;
  duration_seconds: number | null;
  thumbnail_url: string | null;
  order_index: number;
  session_number: number | null;
  created_at: string;
}

export interface UserEmailAlias {
  id: string;
  user_id: string;
  alias_email: string;
  created_at: string;
}

export interface AttendanceSegment {
  id: string;
  attendance_id: string;
  join_time: string;
  leave_time: string | null;
  duration_seconds: number | null;
  created_at: string;
}

export interface Invoice {
  id: string;
  user_id: string;
  cohort_id: string | null;
  invoice_number: string;
  amount: number;
  payment_type: PaymentType;
  emi_number: number | null;
  total_emis: number | null;
  status: InvoiceStatus;
  pdf_path: string | null;
  due_date: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}

// Extended Invoice type with relations
export interface InvoiceWithRelations extends Invoice {
  user?: Profile;
  cohort?: Cohort;
}

// Invoice bulk upload types
export interface InvoiceMappingRow {
  filename: string;
  email: string;
  invoice_number: string;
  amount: number;
  due_date?: string;
}

export interface BulkInvoiceResult {
  success: { row: InvoiceMappingRow; invoice_id: string }[];
  failed: { row: InvoiceMappingRow; error: string }[];
  stats: {
    total: number;
    successful: number;
    failed: number;
  };
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string | null;
  type: NotificationType;
  read: boolean;
  created_at: string;
}

export interface NotificationRule {
  id: string;
  name: string;
  trigger_type: string;
  offset_minutes: number | null;
  channels: string[];
  recipient_filter: Record<string, unknown> | null;
  message_template: string | null;
  active: boolean;
  created_by: string | null;
  created_at: string;
}

export interface SupportTicket {
  id: string;
  user_id: string;
  summary: string;
  description: string | null;
  status: TicketStatus;
  created_at: string;
  updated_at: string;
}

export interface Ranking {
  id: string;
  user_id: string;
  cohort_id: string;
  attendance_score: number | null;
  case_study_score: number | null;
  mentor_rating: number | null;
  total_score: number | null;
  rank: number | null;
  calculated_at: string;
}

// Extended types with relations
export interface SessionWithRsvp extends Session {
  rsvps?: Rsvp[];
  cohort?: Cohort;  // Legacy single cohort
  rsvp_yes_count?: number;
  rsvp_no_count?: number;
}

export interface SessionWithCohorts extends Session {
  cohorts?: SessionCohort[];
  guests?: SessionGuest[];
  rsvp_yes_count?: number;
  rsvp_no_count?: number;
}

export interface ProfileWithRelations extends Profile {
  cohort?: Cohort;  // Legacy single cohort
  mentor?: Profile;
  team_members?: Profile[];
  role_assignments?: UserRoleAssignment[];
}

export interface AttendanceWithDetails extends Attendance {
  session?: Session;
  user?: Profile;
}

export interface ResourceWithChildren extends Resource {
  children?: Resource[];
  uploaded_by_profile?: Profile;
}

export interface LearningModuleWithResources extends LearningModule {
  resources: ModuleResource[];
  recordings?: Recording[];
}

// Extended module interface with sharing metadata
export interface LearningModuleWithSharing extends LearningModule {
  resources: ModuleResource[];
  recordings?: Recording[];
  shared_cohorts?: Cohort[];  // Cohorts this module is shared with
  is_shared_from?: string;  // Source cohort ID if this is a linked module
  source_cohort_name?: string;  // Source cohort name for display
}

// Admin API response for cohort resource statistics
export interface CohortResourceSharingInfo {
  cohort_id: string;
  cohort_name: string;
  total_modules: number;
  own_modules: number;  // Directly owned (cohort_id match)
  linked_modules: number;  // Shared from other cohorts
  global_modules: number;  // From global library
}

export interface AttendanceWithSegments extends Attendance {
  segments?: AttendanceSegment[];
}

// Case Studies
export interface CaseStudy {
  id: string;
  cohort_id: string;
  week_number: number;
  title: string;
  description: string | null;
  problem_doc_id: string | null;
  problem_doc_url: string | null;
  solution_doc_id: string | null;
  solution_doc_url: string | null;
  solution_visible: boolean;
  due_date: string | null;
  order_index: number;
  created_at: string;
}

// Groups
export interface Group {
  id: string;
  cohort_id: string;
  name: string;
  created_at: string;
}

export interface GroupMember {
  id: string;
  group_id: string;
  user_id: string;
  created_at: string;
  user?: Profile;
}

export interface GroupWithMembers extends Group {
  members: GroupMember[];
}

// Assignments
export interface Assignment {
  id: string;
  cohort_id: string;
  week_number: number;
  title: string;
  description: string | null;
  due_date: string | null;
  max_score: number;
  created_at: string;
}

export interface AssignmentSubmission {
  id: string;
  assignment_id: string;
  group_id: string | null;
  user_id: string | null;
  file_url: string | null;
  file_name: string | null;
  google_drive_url: string | null;
  submitted_at: string;
  grade: number | null;
  feedback: string | null;
  graded_by: string | null;
  graded_at: string | null;
  status: 'draft' | 'submitted' | 'graded';
  created_at: string;
}

export interface AssignmentWithSubmissions extends Assignment {
  submissions?: AssignmentSubmission[];
}

// Video Progress and Captions
export interface VideoProgress {
  id: string;
  user_id: string;
  resource_id: string;
  last_position_seconds: number;
  watch_percentage: number;
  completed: boolean;
  completed_at: string | null;
  last_watched_at: string;
  created_at: string;
}

export interface VideoCaption {
  id: string;
  resource_id: string;
  language_code: string;
  language_label: string;
  caption_url: string;
  google_drive_id: string | null;
  is_default: boolean;
  created_at: string;
}

export interface CaptionTrack {
  src: string;
  srclang: string;
  label: string;
  default?: boolean;
}

// Form types
export interface InviteData {
  name: string;
  email: string;
  phone?: string;
  cohort_tag?: string;
  mentor_email?: string;
}

export interface BulkInviteResult {
  success: InviteData[];
  failed: { data: InviteData; error: string }[];
}

// Dashboard stats
export interface DashboardStats {
  total_students: number;
  attendance_percentage: number;
  current_rank: number | null;
  total_resources: number;
}

// API Response types
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}
