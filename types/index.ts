// Database Types for Rethink Systems Dashboard

export type UserRole = 'admin' | 'company_user' | 'mentor' | 'student';

export type CohortStatus = 'active' | 'completed' | 'archived';

export type RsvpResponse = 'yes' | 'no';

export type PaymentType = 'full' | 'partial' | 'emi';

export type InvoiceStatus = 'pending' | 'paid' | 'overdue';

export type TicketStatus = 'open' | 'in_progress' | 'resolved';

export type NotificationType = 'session_reminder' | 'new_resource' | 'system';

export type ResourceType = 'file' | 'folder' | 'link';

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
  cohort_id: string | null;
  scheduled_at: string;
  duration_minutes: number;
  zoom_link: string | null;
  zoom_meeting_id: string | null;
  google_event_id: string | null;
  created_by: string | null;
  created_at: string;
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
  cohort_id: string | null;
  created_at: string;
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

export interface Invoice {
  id: string;
  user_id: string;
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
  cohort?: Cohort;
  rsvp_yes_count?: number;
  rsvp_no_count?: number;
}

export interface ProfileWithRelations extends Profile {
  cohort?: Cohort;
  mentor?: Profile;
  team_members?: Profile[];
}

export interface AttendanceWithDetails extends Attendance {
  session?: Session;
  user?: Profile;
}

export interface ResourceWithChildren extends Resource {
  children?: Resource[];
  uploaded_by_profile?: Profile;
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
  upcoming_sessions: number;
}

// API Response types
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}
