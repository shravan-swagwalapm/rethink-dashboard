// Database Types for Rethink Systems Dashboard

export type UserRole = 'admin' | 'company_user' | 'mentor' | 'student' | 'master';

export type CohortStatus = 'active' | 'completed' | 'archived';

export type RsvpResponse = 'yes' | 'no';

export type PaymentType = 'full' | 'partial' | 'emi';

export type InvoiceStatus = 'pending' | 'paid' | 'overdue';

export type TicketStatus = 'open' | 'in_progress' | 'resolved';

export type NotificationType = 'session_reminder' | 'new_resource' | 'system';

export type ResourceType = 'file' | 'folder' | 'link';

export type ResourceCategory = 'video' | 'article' | 'presentation' | 'pdf';

export type ModuleResourceType = 'video' | 'slides' | 'document' | 'link';

export type FileType = 'pdf' | 'doc' | 'docx' | 'xls' | 'xlsx' | 'ppt' | 'pptx' | 'mp4' | 'other';

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
  // New fields for enhanced resources system
  category: ResourceCategory | null;  // Resource category for organization
  is_global: boolean;                 // Global library resources visible to all students
  thumbnail_url: string | null;       // Video thumbnail URL
  duration: string | null;            // Video duration (e.g., "10:24")
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
  description?: string | null;
  content_type: ModuleResourceType;
  google_drive_id: string | null;
  external_url: string | null;
  duration_seconds: number | null;
  thumbnail_url: string | null;
  order_index: number;
  session_number: number | null;
  created_at: string;

  // File storage fields (for uploaded PDFs/documents)
  file_path?: string | null;
  file_type?: string | null;
  file_size?: number | null;
}

export interface ResourceProgress {
  id: string;
  user_id: string;
  resource_id: string;
  is_completed: boolean;
  last_viewed_at: string | null;
  progress_seconds: number;
  created_at: string;
  updated_at: string;
}

export interface ResourceFavorite {
  id: string;
  user_id: string;
  resource_id: string;
  created_at: string;
}

export interface ProfileCard {
  id: string;
  user_id: string;
  slug: string;
  is_active: boolean;
  view_count: number;
  created_at: string;
  updated_at: string;
}

// Extended ModuleResource with tracking data
export interface ModuleResourceWithTracking extends ModuleResource {
  is_completed?: boolean;
  is_favorite?: boolean;
  progress_seconds?: number;
  last_viewed_at?: string;
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
  problem_file_path: string | null;
  problem_file_size: number | null;
  solution_visible: boolean;
  due_date: string | null;
  order_index: number;
  created_at: string;
  // New submission module fields
  end_week_number: number | null;
  max_score: number;
  grace_period_minutes: number;
  submissions_closed: boolean;
  is_archived: boolean;
  leaderboard_published: boolean;
  problem_updated_at: string | null;
  // Joined data (populated by API)
  solutions?: CaseStudySolution[];
  submissions?: CaseStudySubmission[];
  rubric_criteria?: RubricCriteria[];
}

export interface CaseStudySolution {
  id: string;
  case_study_id: string;
  title: string;
  subgroup_id: string | null;
  subgroup_name?: string;
  file_path: string;
  file_size: number | null;
  order_index: number;
  created_at: string;
}

// Case Study Submissions & Reviews
export type SubmissionVisibility =
  | 'draft'
  | 'submitted'
  | 'admin_reviewed'
  | 'mentor_visible'
  | 'subgroup_published'
  | 'cohort_published';

export interface CaseStudySubmission {
  id: string;
  case_study_id: string;
  subgroup_id: string;
  submitted_by: string | null;
  submitted_at: string | null;
  is_late: boolean;
  deadline_override: string | null;
  visibility: SubmissionVisibility;
  created_at: string;
  updated_at: string;
  // Joined data
  subgroup_name?: string;
  submitted_by_name?: string;
  attachments?: SubmissionAttachment[];
  reviews?: CaseStudyReview[];
  attachment_count?: number;
  link_count?: number;
}

export interface SubmissionAttachment {
  id: string;
  submission_id: string;
  type: 'file' | 'link';
  file_path: string | null;
  file_name: string | null;
  file_size: number | null;
  file_type: string | null;
  link_url: string | null;
  link_label: string | null;
  uploaded_by: string;
  created_at: string;
  // Joined
  uploaded_by_name?: string;
}

export interface CaseStudyReview {
  id: string;
  submission_id: string;
  reviewer_id: string;
  reviewer_role: 'admin' | 'mentor';
  score: number | null;
  comment: string | null;
  overridden: boolean;
  created_at: string;
  updated_at: string;
  // Joined
  reviewer_name?: string;
  rubric_scores?: RubricScore[];
}

export interface RubricCriteria {
  id: string;
  case_study_id: string;
  label: string;
  max_score: number;
  order_index: number;
  created_at: string;
}

export interface RubricScore {
  id: string;
  review_id: string;
  criteria_id: string;
  score: number;
  comment: string | null;
  // Joined
  criteria_label?: string;
  criteria_max_score?: number;
}

// Student-facing status (no internal state leaked)
export type StudentSubmissionStatus =
  | 'not_submitted'
  | 'submitted'
  | 'under_review'
  | 'feedback_available';

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
  cohort_avg: number | null;
  completed_resources: number;
}

// Admin dashboard types
export interface AdminDashboardStats {
  totalStudents: number;
  activeCohorts: number;
  totalCohorts: number;
  totalSessions: number;
  upcomingSessionsCount: number;
  totalLearnings: number;
}

export interface AdminDashboardSession {
  id: string;
  title: string;
  scheduled_at: string;
  duration_minutes: number;
  meeting_url: string;
  cohortId: string;
  cohortName: string;
  cohortTag: string;
}

export interface AdminDashboardLearning {
  id: string;
  title: string;
  type: string;
  created_at: string;
  cohortId: string;
  cohortName: string;
  cohortTag: string;
}

// Student BFF Dashboard Response
export interface StudentDashboardResponse {
  cohort: { name: string; start_date: string | null } | null;
  stats: DashboardStats;
  upcomingSessions: Session[];
  recentModules: LearningModule[];
  recentResources: Resource[];
  recentLearningAssets: RecentLearningAssetSummary[];
  invoices: InvoiceWithCohortSummary[];
  pendingInvoiceAmount: number;
  _meta: {
    totalQueries: number;
    failedQueries: number;
    failedSections: string[];
  };
}

export interface RecentLearningAssetSummary {
  id: string;
  module_id: string | null;
  title: string;
  description?: string | null;
  content_type: ModuleResourceType;
  google_drive_id: string | null;
  external_url: string | null;
  duration_seconds: number | null;
  thumbnail_url: string | null;
  order_index: number;
  session_number: number | null;
  created_at: string;
  file_path?: string | null;
  file_type?: string | null;
  file_size?: number | null;
  progress?: {
    is_completed: boolean;
    progress_seconds: number;
    last_viewed_at: string | null;
  };
}

export interface InvoiceWithCohortSummary extends Invoice {
  cohort?: Cohort;
}

// API Response types
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

// ===== Subgroups & Feedback =====

export type FeedbackType = 'daily' | 'weekly';
export type FeedbackTargetType = 'mentor' | 'session';

export interface Subgroup {
  id: string;
  cohort_id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface SubgroupMember {
  id: string;
  subgroup_id: string;
  user_id: string;
  created_at: string;
  user?: Profile;
}

export interface SubgroupMentor {
  id: string;
  subgroup_id: string;
  user_id: string;
  created_at: string;
  user?: Profile;
}

export interface SubgroupWithDetails extends Subgroup {
  members?: SubgroupMember[];
  mentors?: SubgroupMentor[];
  member_count?: number;
  mentor_count?: number;
  cohort?: Cohort;
}

export interface MentorFeedback {
  id: string;
  mentor_id: string;
  student_id: string;
  subgroup_id: string;
  type: FeedbackType;
  rating: number;
  comment: string | null;
  week_number: number | null;
  feedback_date: string;
  created_at: string;
  mentor?: Profile;
  student?: Profile;
  subgroup?: Subgroup;
}

export interface StudentFeedback {
  id: string;
  student_id: string;
  target_type: FeedbackTargetType;
  target_id: string;
  rating: number;
  comment: string | null;
  week_number: number | null;
  created_at: string;
  student?: Profile;
}

export interface FeedbackAggregate {
  average_rating: number;
  total_count: number;
  by_week?: { week_number: number; average_rating: number; count: number }[];
}

// ============================================
// LMS Usage Analytics Types
// ============================================

export interface LoginEvent {
  id: string;
  user_id: string;
  login_method: 'phone_otp' | 'google_oauth' | 'magic_link';
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export type UsagePeriod = 'today' | 'week' | 'month' | 'custom';

export type StudentHealthStatus = 'active' | 'at_risk' | 'inactive';

export interface UsageOverviewStats {
  total_logins: number;
  previous_period_logins: number;
  active_students: number;
  total_students: number;
  avg_logins_per_student: number;
  content_completion_percent: number;
  cohort_rankings: {
    cohort_id: string;
    cohort_name: string;
    engagement_percent: number;
    active_count: number;
    total_count: number;
  }[];
  daily_login_trend: {
    date: string;
    count: number;
  }[];
  asset_summary: {
    videos: { completed: number; total: number };
    slides: { completed: number; total: number };
    documents: { completed: number; total: number };
    links: { completed: number; total: number };
  };
}

export interface CohortUsageStudent {
  user_id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  login_count: number;
  last_login: string | null;
  content_completion_percent: number;
  health_status: StudentHealthStatus;
}

export interface CohortUsageStats {
  logins_this_period: number;
  active_students: number;
  total_students: number;
  at_risk_count: number;
  content_completion_percent: number;
  students: CohortUsageStudent[];
  module_assets: {
    module_id: string;
    module_name: string;
    week_number: number | null;
    videos: { completed: number; total: number };
    slides: { completed: number; total: number };
    documents: { completed: number; total: number };
    links: { completed: number; total: number };
  }[];
}

export interface StudentUsageDetail {
  user_id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  cohort_name: string;
  last_login: string | null;
  total_logins: number;
  content_completion_percent: number;
  health_status: StudentHealthStatus;
  login_history: {
    created_at: string;
    login_method: string;
  }[];
  module_engagement: {
    module_id: string;
    module_name: string;
    week_number: number | null;
    completed: number;
    total: number;
    percent: number;
  }[];
  recent_activity: {
    type: 'video_watched' | 'slides_viewed' | 'document_opened' | 'link_opened' | 'resource_completed';
    title: string;
    timestamp: string;
    detail?: string;
  }[];
}
