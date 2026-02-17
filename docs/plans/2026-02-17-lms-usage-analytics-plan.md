# LMS Usage Analytics Dashboard — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a new `/admin/usage` module that tracks student login events, aggregates content engagement from existing tables, and presents it across three levels (overview, cohort, student) with color-coded health indicators.

**Architecture:** New `login_events` table + 4 admin API routes querying existing tables (`resource_progress`, `video_progress`, `module_resources`, `learning_modules`, `profiles`, `user_role_assignments`, `attendance`) via `createAdminClient()`. Single admin page with 3 tabs following the mentors page tab orchestration pattern.

**Tech Stack:** Next.js 16 App Router, Supabase PostgreSQL, shadcn/ui (Tabs, Table, Card, Select, Badge, Progress), Tailwind CSS 4, Lucide React icons.

**Design Doc:** `docs/plans/2026-02-17-lms-usage-analytics-design.md`

---

## Task 1: Database Migration — `login_events` Table

**Files:**
- Create: `supabase/migrations/025_login_events.sql`

**Step 1: Write the migration SQL**

```sql
-- 025_login_events.sql
-- Track every authentication event for LMS usage analytics

CREATE TABLE IF NOT EXISTS login_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  login_method TEXT NOT NULL CHECK (login_method IN ('phone_otp', 'google_oauth', 'magic_link')),
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for querying by user (student detail tab)
CREATE INDEX idx_login_events_user_id ON login_events(user_id);

-- Index for date-range queries (all tabs use date filters)
CREATE INDEX idx_login_events_created_at ON login_events(created_at);

-- Composite index for user+date queries (cohort tab student rows)
CREATE INDEX idx_login_events_user_date ON login_events(user_id, created_at);

-- No RLS needed — only queried by admin routes via createAdminClient()
```

**Step 2: Commit**

```bash
git add supabase/migrations/025_login_events.sql
git commit -m "feat: add login_events table migration for usage analytics"
```

---

## Task 2: TypeScript Types for Usage Analytics

**Files:**
- Modify: `types/index.ts` (append at end, before closing)

**Step 1: Add the type definitions**

Append these types at the bottom of `types/index.ts`:

```typescript
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
    case_studies: { completed: number; total: number };
    presentations: { completed: number; total: number };
    pdfs: { completed: number; total: number };
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
    case_studies: { completed: number; total: number };
    presentations: { completed: number; total: number };
    pdfs: { completed: number; total: number };
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
    type: 'video_watched' | 'case_study_opened' | 'presentation_viewed' | 'pdf_opened' | 'resource_completed';
    title: string;
    timestamp: string;
    detail?: string;
  }[];
}
```

**Step 2: Commit**

```bash
git add types/index.ts
git commit -m "feat: add TypeScript types for LMS usage analytics"
```

---

## Task 3: Login Event Logging — Auth Integration

**Files:**
- Modify: `app/api/auth/otp/verify/route.ts` (insert after line 297)
- Modify: `app/auth/callback/route.ts` (insert at 2 points)
- Create: `lib/services/login-tracker.ts` (shared helper)

**Step 1: Create the login tracker helper**

Create `lib/services/login-tracker.ts`:

```typescript
import { createAdminClient } from '@/lib/supabase/server';
import { headers } from 'next/headers';

/**
 * Log a login event to the login_events table.
 * Fire-and-forget — errors are logged but never block auth flow.
 */
export async function trackLogin(
  userId: string,
  loginMethod: 'phone_otp' | 'google_oauth' | 'magic_link'
): Promise<void> {
  try {
    const adminClient = await createAdminClient();
    const headersList = await headers();
    const ipAddress = headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ||
                      headersList.get('x-real-ip') ||
                      null;
    const userAgent = headersList.get('user-agent') || null;

    await adminClient.from('login_events').insert({
      user_id: userId,
      login_method: loginMethod,
      ip_address: ipAddress,
      user_agent: userAgent,
    });
  } catch (error) {
    // Never block auth flow — log and move on
    console.error('[login-tracker] Failed to log login event:', error);
  }
}
```

**Step 2: Add to OTP verify route**

In `app/api/auth/otp/verify/route.ts`, add import at top:

```typescript
import { trackLogin } from '@/lib/services/login-tracker';
```

Insert after line 297 (after `otpRecord` is marked verified, before `logOTPVerification`):

```typescript
    // Track login event for usage analytics
    await trackLogin(userProfile.id, 'phone_otp');
```

**Step 3: Add to OAuth callback route**

In `app/auth/callback/route.ts`, add import at top:

```typescript
import { trackLogin } from '@/lib/services/login-tracker';
```

Insert in the **magic link branch** (before line 40, before `return NextResponse.redirect`):

```typescript
    // Track login event for usage analytics
    if (data.session?.user?.id) {
      await trackLogin(data.session.user.id, 'magic_link');
    }
```

Insert in the **OAuth code branch** (before line 137, before `const response = NextResponse.redirect`):

```typescript
    // Track login event for usage analytics
    await trackLogin(data.session.user.id, 'google_oauth');
```

**Step 4: Build verification**

Run: `npm run build`
Expected: 0 TypeScript errors

**Step 5: Commit**

```bash
git add lib/services/login-tracker.ts app/api/auth/otp/verify/route.ts app/auth/callback/route.ts
git commit -m "feat: track login events for LMS usage analytics"
```

---

## Task 4: API Route — Usage Overview

**Files:**
- Create: `app/api/admin/usage/overview/route.ts`

**Step 1: Implement the overview endpoint**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/api/verify-admin';
import { createAdminClient } from '@/lib/supabase/server';

function getDateRange(period: string, startDate?: string, endDate?: string) {
  const now = new Date();
  let start: Date;
  let end: Date = now;

  switch (period) {
    case 'today':
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case 'week':
      start = new Date(now);
      start.setDate(now.getDate() - 7);
      break;
    case 'month':
      start = new Date(now);
      start.setMonth(now.getMonth() - 1);
      break;
    case 'custom':
      start = startDate ? new Date(startDate) : new Date(now.setMonth(now.getMonth() - 1));
      end = endDate ? new Date(endDate) : new Date();
      break;
    default:
      start = new Date(now);
      start.setDate(now.getDate() - 7);
  }

  return { start: start.toISOString(), end: end.toISOString() };
}

function getPreviousPeriodRange(period: string, currentStart: string, currentEnd: string) {
  const start = new Date(currentStart);
  const end = new Date(currentEnd);
  const duration = end.getTime() - start.getTime();
  const prevEnd = new Date(start.getTime());
  const prevStart = new Date(start.getTime() - duration);
  return { start: prevStart.toISOString(), end: prevEnd.toISOString() };
}

export async function GET(request: NextRequest) {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const searchParams = request.nextUrl.searchParams;
  const period = searchParams.get('period') || 'week';
  const startDate = searchParams.get('start_date') || undefined;
  const endDate = searchParams.get('end_date') || undefined;

  const { start, end } = getDateRange(period, startDate, endDate);
  const prev = getPreviousPeriodRange(period, start, end);

  const adminClient = await createAdminClient();

  // Parallel queries
  const [
    { count: totalLogins },
    { count: prevLogins },
    { data: allStudents },
    { data: loginsByUser },
    { data: dailyLogins },
    { data: resourceProgress },
    { data: moduleResources },
  ] = await Promise.all([
    // Current period logins
    adminClient
      .from('login_events')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', start)
      .lte('created_at', end),
    // Previous period logins (for % change)
    adminClient
      .from('login_events')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', prev.start)
      .lte('created_at', prev.end),
    // All students (from role assignments)
    adminClient
      .from('user_role_assignments')
      .select('user_id')
      .eq('role', 'student'),
    // Logins grouped by user in period
    adminClient
      .from('login_events')
      .select('user_id')
      .gte('created_at', start)
      .lte('created_at', end),
    // Daily login counts for trend chart
    adminClient
      .from('login_events')
      .select('created_at')
      .gte('created_at', start)
      .lte('created_at', end)
      .order('created_at', { ascending: true }),
    // All resource progress (completions)
    adminClient
      .from('resource_progress')
      .select('user_id, resource_id, is_completed'),
    // All module resources with type info
    adminClient
      .from('module_resources')
      .select('id, resource_type'),
  ]);

  const studentIds = new Set((allStudents || []).map(s => s.user_id));
  const totalStudents = studentIds.size;

  // Active students = unique students who logged in this period
  const activeStudentIds = new Set(
    (loginsByUser || [])
      .filter(l => studentIds.has(l.user_id))
      .map(l => l.user_id)
  );
  const activeStudents = activeStudentIds.size;

  // Avg logins per student
  const avgLoginsPerStudent = totalStudents > 0
    ? Math.round(((totalLogins || 0) / totalStudents) * 10) / 10
    : 0;

  // Daily login trend
  const trendMap = new Map<string, number>();
  (dailyLogins || []).forEach(l => {
    const day = new Date(l.created_at).toISOString().split('T')[0];
    trendMap.set(day, (trendMap.get(day) || 0) + 1);
  });
  const dailyLoginTrend = Array.from(trendMap.entries()).map(([date, count]) => ({ date, count }));

  // Content completion
  const resourceTypeMap = new Map<string, string>();
  (moduleResources || []).forEach(r => {
    resourceTypeMap.set(r.id, r.resource_type || 'other');
  });

  const assetCounts = { videos: { completed: 0, total: 0 }, case_studies: { completed: 0, total: 0 }, presentations: { completed: 0, total: 0 }, pdfs: { completed: 0, total: 0 } };
  const typeKeyMap: Record<string, keyof typeof assetCounts> = {
    video: 'videos', case_study: 'case_studies', presentation: 'presentations', pdf: 'pdfs',
  };

  // Count per student per resource (only students)
  const studentProgress = (resourceProgress || []).filter(rp => studentIds.has(rp.user_id));
  const seenResources = new Set<string>();
  (moduleResources || []).forEach(r => {
    const type = r.resource_type || 'other';
    const key = typeKeyMap[type];
    if (key && !seenResources.has(r.id)) {
      seenResources.add(r.id);
      assetCounts[key].total++;
    }
  });
  studentProgress.forEach(rp => {
    const type = resourceTypeMap.get(rp.resource_id);
    const key = type ? typeKeyMap[type] : undefined;
    if (key && rp.is_completed) {
      assetCounts[key].completed++;
    }
  });

  // Overall content completion %
  const totalResources = Object.values(assetCounts).reduce((sum, a) => sum + a.total, 0);
  const totalCompleted = Object.values(assetCounts).reduce((sum, a) => sum + a.completed, 0);
  const contentCompletionPercent = totalResources > 0
    ? Math.round((totalCompleted / (totalResources * totalStudents)) * 100)
    : 0;

  // Cohort rankings
  const { data: cohorts } = await adminClient
    .from('cohorts')
    .select('id, name')
    .eq('status', 'active');

  const { data: allRoleAssignments } = await adminClient
    .from('user_role_assignments')
    .select('user_id, cohort_id')
    .eq('role', 'student');

  const cohortRankings = (cohorts || []).map(cohort => {
    const cohortStudentIds = (allRoleAssignments || [])
      .filter(ra => ra.cohort_id === cohort.id)
      .map(ra => ra.user_id);
    const cohortActive = cohortStudentIds.filter(id => activeStudentIds.has(id)).length;
    const cohortTotal = cohortStudentIds.length;
    return {
      cohort_id: cohort.id,
      cohort_name: cohort.name,
      engagement_percent: cohortTotal > 0 ? Math.round((cohortActive / cohortTotal) * 100) : 0,
      active_count: cohortActive,
      total_count: cohortTotal,
    };
  }).sort((a, b) => b.engagement_percent - a.engagement_percent);

  return NextResponse.json({
    total_logins: totalLogins || 0,
    previous_period_logins: prevLogins || 0,
    active_students: activeStudents,
    total_students: totalStudents,
    avg_logins_per_student: avgLoginsPerStudent,
    content_completion_percent: contentCompletionPercent,
    cohort_rankings: cohortRankings,
    daily_login_trend: dailyLoginTrend,
    asset_summary: assetCounts,
  });
}
```

**Step 2: Build verification**

Run: `npm run build`
Expected: 0 TypeScript errors

**Step 3: Commit**

```bash
git add app/api/admin/usage/overview/route.ts
git commit -m "feat: add usage overview API endpoint"
```

---

## Task 5: API Route — Cohort Usage

**Files:**
- Create: `app/api/admin/usage/cohort/route.ts`

**Step 1: Implement the cohort usage endpoint**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/api/verify-admin';
import { createAdminClient } from '@/lib/supabase/server';
import type { StudentHealthStatus } from '@/types';

function getDateRange(period: string, startDate?: string, endDate?: string) {
  const now = new Date();
  let start: Date;
  let end: Date = now;
  switch (period) {
    case 'today':
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case 'week':
      start = new Date(now);
      start.setDate(now.getDate() - 7);
      break;
    case 'month':
      start = new Date(now);
      start.setMonth(now.getMonth() - 1);
      break;
    case 'custom':
      start = startDate ? new Date(startDate) : new Date(now.setMonth(now.getMonth() - 1));
      end = endDate ? new Date(endDate) : new Date();
      break;
    default:
      start = new Date(now);
      start.setDate(now.getDate() - 7);
  }
  return { start: start.toISOString(), end: end.toISOString() };
}

function computeHealthStatus(lastLogin: string | null, completionPercent: number): StudentHealthStatus {
  const now = new Date();
  const daysSinceLogin = lastLogin
    ? Math.floor((now.getTime() - new Date(lastLogin).getTime()) / (1000 * 60 * 60 * 24))
    : Infinity;

  if (daysSinceLogin <= 3 && completionPercent > 50) return 'active';
  if (daysSinceLogin <= 7 || (completionPercent >= 30 && completionPercent <= 50)) return 'at_risk';
  return 'inactive';
}

export async function GET(request: NextRequest) {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const searchParams = request.nextUrl.searchParams;
  const cohortId = searchParams.get('cohort_id');
  const period = searchParams.get('period') || 'week';
  const startDate = searchParams.get('start_date') || undefined;
  const endDate = searchParams.get('end_date') || undefined;

  if (!cohortId) {
    return NextResponse.json({ error: 'cohort_id is required' }, { status: 400 });
  }

  const { start, end } = getDateRange(period, startDate, endDate);
  const adminClient = await createAdminClient();

  // Get students in this cohort
  const { data: roleAssignments } = await adminClient
    .from('user_role_assignments')
    .select('user_id')
    .eq('role', 'student')
    .eq('cohort_id', cohortId);

  const studentUserIds = (roleAssignments || []).map(ra => ra.user_id);

  if (studentUserIds.length === 0) {
    return NextResponse.json({
      logins_this_period: 0,
      active_students: 0,
      total_students: 0,
      at_risk_count: 0,
      content_completion_percent: 0,
      students: [],
      module_assets: [],
    });
  }

  // Parallel queries
  const [
    { data: profiles },
    { data: loginEvents },
    { data: lastLogins },
    { data: resourceProgress },
    { data: modules },
    { data: moduleResources },
  ] = await Promise.all([
    // Student profiles
    adminClient
      .from('profiles')
      .select('id, full_name, email, avatar_url')
      .in('id', studentUserIds),
    // Login events in period
    adminClient
      .from('login_events')
      .select('user_id, created_at')
      .in('user_id', studentUserIds)
      .gte('created_at', start)
      .lte('created_at', end),
    // Last login per student (most recent login regardless of period)
    adminClient
      .from('login_events')
      .select('user_id, created_at')
      .in('user_id', studentUserIds)
      .order('created_at', { ascending: false }),
    // Resource progress for these students
    adminClient
      .from('resource_progress')
      .select('user_id, resource_id, is_completed')
      .in('user_id', studentUserIds),
    // Modules linked to this cohort
    adminClient
      .from('cohort_module_links')
      .select('module_id, learning_modules(id, title, week_number)')
      .eq('cohort_id', cohortId),
    // All module resources
    adminClient
      .from('module_resources')
      .select('id, module_id, resource_type'),
  ]);

  // Build profile map
  const profileMap = new Map((profiles || []).map(p => [p.id, p]));

  // Login counts per user in period
  const loginCountMap = new Map<string, number>();
  (loginEvents || []).forEach(l => {
    loginCountMap.set(l.user_id, (loginCountMap.get(l.user_id) || 0) + 1);
  });

  // Last login per user
  const lastLoginMap = new Map<string, string>();
  (lastLogins || []).forEach(l => {
    if (!lastLoginMap.has(l.user_id)) {
      lastLoginMap.set(l.user_id, l.created_at);
    }
  });

  // Resource completion per user
  const completionMap = new Map<string, { completed: number; total: number }>();
  const moduleResourceIds = new Set((moduleResources || []).map(r => r.id));
  studentUserIds.forEach(uid => {
    const userProgress = (resourceProgress || []).filter(
      rp => rp.user_id === uid && moduleResourceIds.has(rp.resource_id)
    );
    const completed = userProgress.filter(rp => rp.is_completed).length;
    completionMap.set(uid, { completed, total: moduleResourceIds.size });
  });

  // Build student rows
  const students = studentUserIds.map(uid => {
    const profile = profileMap.get(uid);
    const loginCount = loginCountMap.get(uid) || 0;
    const lastLogin = lastLoginMap.get(uid) || null;
    const completion = completionMap.get(uid) || { completed: 0, total: 0 };
    const completionPercent = completion.total > 0
      ? Math.round((completion.completed / completion.total) * 100)
      : 0;

    return {
      user_id: uid,
      name: profile?.full_name || 'Unknown',
      email: profile?.email || '',
      avatar_url: profile?.avatar_url || null,
      login_count: loginCount,
      last_login: lastLogin,
      content_completion_percent: completionPercent,
      health_status: computeHealthStatus(lastLogin, completionPercent),
    };
  }).sort((a, b) => {
    // Sort: inactive first (needs attention), then at-risk, then active
    const order: Record<string, number> = { inactive: 0, at_risk: 1, active: 2 };
    return (order[a.health_status] ?? 2) - (order[b.health_status] ?? 2);
  });

  // Stat cards
  const loginsThisPeriod = (loginEvents || []).length;
  const activeStudents = students.filter(s => s.health_status === 'active').length;
  const atRiskCount = students.filter(s => s.health_status === 'at_risk').length;
  const avgCompletion = students.length > 0
    ? Math.round(students.reduce((sum, s) => sum + s.content_completion_percent, 0) / students.length)
    : 0;

  // Module asset breakdown
  const resourceTypeMap = new Map((moduleResources || []).map(r => [r.id, r]));
  const typeKeyMap: Record<string, string> = {
    video: 'videos', case_study: 'case_studies', presentation: 'presentations', pdf: 'pdfs',
  };
  const allCompletedResourceIds = new Set(
    (resourceProgress || []).filter(rp => rp.is_completed).map(rp => rp.resource_id)
  );

  const moduleAssets = (modules || []).map(m => {
    const mod = Array.isArray(m.learning_modules) ? m.learning_modules[0] : m.learning_modules;
    if (!mod) return null;

    const modResources = (moduleResources || []).filter(r => r.module_id === mod.id);
    const assets: Record<string, { completed: number; total: number }> = {
      videos: { completed: 0, total: 0 },
      case_studies: { completed: 0, total: 0 },
      presentations: { completed: 0, total: 0 },
      pdfs: { completed: 0, total: 0 },
    };

    modResources.forEach(r => {
      const key = typeKeyMap[r.resource_type || 'other'];
      if (key && assets[key]) {
        assets[key].total++;
        // Count unique students who completed this resource
        const completedCount = (resourceProgress || []).filter(
          rp => rp.resource_id === r.id && rp.is_completed
        ).length;
        assets[key].completed += completedCount;
      }
    });

    return {
      module_id: mod.id,
      module_name: mod.title,
      week_number: mod.week_number,
      ...assets,
    };
  }).filter(Boolean);

  return NextResponse.json({
    logins_this_period: loginsThisPeriod,
    active_students: activeStudents,
    total_students: studentUserIds.length,
    at_risk_count: atRiskCount,
    content_completion_percent: avgCompletion,
    students,
    module_assets: moduleAssets,
  });
}
```

**Step 2: Build verification**

Run: `npm run build`
Expected: 0 TypeScript errors

**Step 3: Commit**

```bash
git add app/api/admin/usage/cohort/route.ts
git commit -m "feat: add cohort usage API endpoint with health indicators"
```

---

## Task 6: API Route — Student Detail

**Files:**
- Create: `app/api/admin/usage/student/route.ts`

**Step 1: Implement the student detail endpoint**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/api/verify-admin';
import { createAdminClient } from '@/lib/supabase/server';
import type { StudentHealthStatus } from '@/types';

function computeHealthStatus(lastLogin: string | null, completionPercent: number): StudentHealthStatus {
  const now = new Date();
  const daysSinceLogin = lastLogin
    ? Math.floor((now.getTime() - new Date(lastLogin).getTime()) / (1000 * 60 * 60 * 24))
    : Infinity;
  if (daysSinceLogin <= 3 && completionPercent > 50) return 'active';
  if (daysSinceLogin <= 7 || (completionPercent >= 30 && completionPercent <= 50)) return 'at_risk';
  return 'inactive';
}

export async function GET(request: NextRequest) {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const searchParams = request.nextUrl.searchParams;
  const userId = searchParams.get('user_id');

  if (!userId) {
    return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
  }

  const adminClient = await createAdminClient();

  // Parallel queries
  const [
    { data: profile },
    { data: roleAssignment },
    { data: loginHistory },
    { data: resourceProgress },
    { data: moduleResources },
    { data: recentViewed },
  ] = await Promise.all([
    // Profile
    adminClient
      .from('profiles')
      .select('id, full_name, email, avatar_url')
      .eq('id', userId)
      .single(),
    // Cohort from role assignment
    adminClient
      .from('user_role_assignments')
      .select('cohort_id, cohorts(id, name)')
      .eq('user_id', userId)
      .eq('role', 'student')
      .maybeSingle(),
    // Login history (last 50)
    adminClient
      .from('login_events')
      .select('created_at, login_method')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50),
    // Resource progress
    adminClient
      .from('resource_progress')
      .select('resource_id, is_completed, last_viewed_at')
      .eq('user_id', userId),
    // All module resources with module info
    adminClient
      .from('module_resources')
      .select('id, title, module_id, resource_type, learning_modules(id, title, week_number)')
      .order('created_at', { ascending: false }),
    // Recent activity (last 20 viewed resources)
    adminClient
      .from('resource_progress')
      .select('resource_id, is_completed, last_viewed_at')
      .eq('user_id', userId)
      .not('last_viewed_at', 'is', null)
      .order('last_viewed_at', { ascending: false })
      .limit(20),
  ]);

  if (!profile) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const cohort = roleAssignment?.cohorts;
  const cohortName = Array.isArray(cohort) ? cohort[0]?.name : cohort?.name;

  // Total logins
  const totalLogins = (loginHistory || []).length;
  const lastLogin = loginHistory?.[0]?.created_at || null;

  // Module engagement
  const resourceMap = new Map((moduleResources || []).map(r => [r.id, r]));
  const progressMap = new Map((resourceProgress || []).map(rp => [rp.resource_id, rp]));

  const moduleMap = new Map<string, { id: string; title: string; week_number: number | null; completed: number; total: number }>();
  (moduleResources || []).forEach(r => {
    const mod = Array.isArray(r.learning_modules) ? r.learning_modules[0] : r.learning_modules;
    if (!mod) return;

    if (!moduleMap.has(mod.id)) {
      moduleMap.set(mod.id, { id: mod.id, title: mod.title, week_number: mod.week_number, completed: 0, total: 0 });
    }
    const entry = moduleMap.get(mod.id)!;
    entry.total++;
    const progress = progressMap.get(r.id);
    if (progress?.is_completed) {
      entry.completed++;
    }
  });

  const moduleEngagement = Array.from(moduleMap.values()).map(m => ({
    module_id: m.id,
    module_name: m.title,
    week_number: m.week_number,
    completed: m.completed,
    total: m.total,
    percent: m.total > 0 ? Math.round((m.completed / m.total) * 100) : 0,
  })).sort((a, b) => (a.week_number || 0) - (b.week_number || 0));

  // Content completion
  const totalResources = moduleMap.size > 0
    ? Array.from(moduleMap.values()).reduce((sum, m) => sum + m.total, 0)
    : 0;
  const totalCompleted = moduleMap.size > 0
    ? Array.from(moduleMap.values()).reduce((sum, m) => sum + m.completed, 0)
    : 0;
  const contentCompletionPercent = totalResources > 0
    ? Math.round((totalCompleted / totalResources) * 100)
    : 0;

  // Recent activity
  const typeDisplayMap: Record<string, string> = {
    video: 'video_watched',
    case_study: 'case_study_opened',
    presentation: 'presentation_viewed',
    pdf: 'pdf_opened',
  };

  const recentActivity = (recentViewed || []).map(rv => {
    const resource = resourceMap.get(rv.resource_id);
    const resourceType = resource?.resource_type || 'other';
    return {
      type: rv.is_completed ? 'resource_completed' : (typeDisplayMap[resourceType] || 'pdf_opened'),
      title: resource?.title || 'Unknown Resource',
      timestamp: rv.last_viewed_at,
      detail: rv.is_completed ? 'Completed' : undefined,
    };
  });

  return NextResponse.json({
    user_id: userId,
    name: profile.full_name || 'Unknown',
    email: profile.email || '',
    avatar_url: profile.avatar_url || null,
    cohort_name: cohortName || 'No cohort',
    last_login: lastLogin,
    total_logins: totalLogins,
    content_completion_percent: contentCompletionPercent,
    health_status: computeHealthStatus(lastLogin, contentCompletionPercent),
    login_history: (loginHistory || []).map(l => ({
      created_at: l.created_at,
      login_method: l.login_method,
    })),
    module_engagement: moduleEngagement,
    recent_activity: recentActivity,
  });
}
```

**Step 2: Build verification**

Run: `npm run build`
Expected: 0 TypeScript errors

**Step 3: Commit**

```bash
git add app/api/admin/usage/student/route.ts
git commit -m "feat: add student detail usage API endpoint"
```

---

## Task 7: API Route — Asset Breakdown

**Files:**
- Create: `app/api/admin/usage/assets/route.ts`

**Step 1: Implement the asset breakdown endpoint**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/api/verify-admin';
import { createAdminClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const searchParams = request.nextUrl.searchParams;
  const cohortId = searchParams.get('cohort_id'); // optional — omit for community-wide

  const adminClient = await createAdminClient();

  // Get relevant student IDs
  let studentUserIds: string[] = [];
  if (cohortId) {
    const { data: roleAssignments } = await adminClient
      .from('user_role_assignments')
      .select('user_id')
      .eq('role', 'student')
      .eq('cohort_id', cohortId);
    studentUserIds = (roleAssignments || []).map(ra => ra.user_id);
  } else {
    const { data: allStudents } = await adminClient
      .from('user_role_assignments')
      .select('user_id')
      .eq('role', 'student');
    studentUserIds = (allStudents || []).map(ra => ra.user_id);
  }

  if (studentUserIds.length === 0) {
    return NextResponse.json({ modules: [] });
  }

  // Get modules (cohort-scoped or all)
  let modulesQuery;
  if (cohortId) {
    modulesQuery = adminClient
      .from('cohort_module_links')
      .select('module_id, learning_modules(id, title, week_number)')
      .eq('cohort_id', cohortId);
  } else {
    modulesQuery = adminClient
      .from('learning_modules')
      .select('id, title, week_number');
  }

  const [{ data: modulesData }, { data: moduleResources }, { data: resourceProgress }] = await Promise.all([
    modulesQuery,
    adminClient.from('module_resources').select('id, module_id, resource_type'),
    adminClient.from('resource_progress').select('user_id, resource_id, is_completed').in('user_id', studentUserIds),
  ]);

  const typeKeyMap: Record<string, string> = {
    video: 'videos', case_study: 'case_studies', presentation: 'presentations', pdf: 'pdfs',
  };

  // Build completion count per resource
  const completionCountMap = new Map<string, number>();
  (resourceProgress || []).forEach(rp => {
    if (rp.is_completed) {
      completionCountMap.set(rp.resource_id, (completionCountMap.get(rp.resource_id) || 0) + 1);
    }
  });

  // Normalize modules data
  const modules = cohortId
    ? (modulesData || []).map(m => {
        const mod = Array.isArray(m.learning_modules) ? m.learning_modules[0] : m.learning_modules;
        return mod ? { id: mod.id, title: mod.title, week_number: mod.week_number } : null;
      }).filter(Boolean)
    : (modulesData || []);

  const result = (modules as { id: string; title: string; week_number: number | null }[]).map(mod => {
    const modResources = (moduleResources || []).filter(r => r.module_id === mod.id);
    const assets: Record<string, { completed: number; total: number }> = {
      videos: { completed: 0, total: 0 },
      case_studies: { completed: 0, total: 0 },
      presentations: { completed: 0, total: 0 },
      pdfs: { completed: 0, total: 0 },
    };

    modResources.forEach(r => {
      const key = typeKeyMap[r.resource_type || 'other'];
      if (key && assets[key]) {
        assets[key].total++;
        assets[key].completed += completionCountMap.get(r.id) || 0;
      }
    });

    return {
      module_id: mod.id,
      module_name: mod.title,
      week_number: mod.week_number,
      ...assets,
    };
  }).sort((a, b) => (a.week_number || 0) - (b.week_number || 0));

  return NextResponse.json({ modules: result });
}
```

**Step 2: Build verification**

Run: `npm run build`
Expected: 0 TypeScript errors

**Step 3: Commit**

```bash
git add app/api/admin/usage/assets/route.ts
git commit -m "feat: add asset breakdown API endpoint for usage analytics"
```

---

## Task 8: Admin Sidebar — Add "Usage" Navigation Item

**Files:**
- Modify: `app/(admin)/layout.tsx` (line 42, add after Analytics)

**Step 1: Add the import**

In `app/(admin)/layout.tsx`, add `Activity` to the lucide-react import (around line 14-29):

```typescript
import { Activity } from 'lucide-react';
```

Add alongside the existing icon imports.

**Step 2: Add nav item**

Insert after the Analytics nav item (line 42):

```typescript
  { label: 'Usage',          href: '/admin/usage',          icon: Activity },
```

So the array around lines 42-43 becomes:

```typescript
  { label: 'Analytics',      href: '/admin/analytics',      icon: LineChart },         // existing line 42
  { label: 'Usage',          href: '/admin/usage',          icon: Activity },           // NEW
  { label: 'Invoices',       href: '/admin/invoices',       icon: FileText },           // existing line 43
```

**Step 3: Build verification**

Run: `npm run build`
Expected: 0 TypeScript errors

**Step 4: Commit**

```bash
git add app/(admin)/layout.tsx
git commit -m "feat: add Usage nav item to admin sidebar"
```

---

## Task 9: Shared Components — Date Filter & Health Badge

**Files:**
- Create: `app/(admin)/admin/usage/components/date-filter.tsx`
- Create: `app/(admin)/admin/usage/components/health-badge.tsx`

**Step 1: Create the date filter component**

```typescript
'use client';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, CalendarDays } from 'lucide-react';
import type { UsagePeriod } from '@/types';

interface DateFilterProps {
  period: UsagePeriod;
  onPeriodChange: (period: UsagePeriod) => void;
}

export function DateFilter({ period, onPeriodChange }: DateFilterProps) {
  return (
    <Select value={period} onValueChange={(v) => onPeriodChange(v as UsagePeriod)}>
      <SelectTrigger className="w-[160px] gap-2">
        <CalendarDays className="w-4 h-4 text-muted-foreground" />
        <SelectValue placeholder="Select period" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="today">Today</SelectItem>
        <SelectItem value="week">This Week</SelectItem>
        <SelectItem value="month">This Month</SelectItem>
      </SelectContent>
    </Select>
  );
}
```

**Step 2: Create the health badge component**

```typescript
import { Badge } from '@/components/ui/badge';
import type { StudentHealthStatus } from '@/types';

interface HealthBadgeProps {
  status: StudentHealthStatus;
  showDot?: boolean;
}

const statusConfig: Record<StudentHealthStatus, { label: string; dotClass: string; badgeVariant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  active: { label: 'Active', dotClass: 'bg-green-500', badgeVariant: 'default' },
  at_risk: { label: 'At-Risk', dotClass: 'bg-yellow-500', badgeVariant: 'secondary' },
  inactive: { label: 'Inactive', dotClass: 'bg-red-500', badgeVariant: 'destructive' },
};

export function HealthBadge({ status, showDot = true }: HealthBadgeProps) {
  const config = statusConfig[status];
  return (
    <Badge variant={config.badgeVariant} className="gap-1.5">
      {showDot && (
        <span className={`w-2 h-2 rounded-full ${config.dotClass}`} />
      )}
      {config.label}
    </Badge>
  );
}

export function HealthDot({ status }: { status: StudentHealthStatus }) {
  const config = statusConfig[status];
  return <span className={`w-2.5 h-2.5 rounded-full inline-block ${config.dotClass}`} />;
}
```

**Step 3: Build verification**

Run: `npm run build`
Expected: 0 TypeScript errors

**Step 4: Commit**

```bash
git add app/(admin)/admin/usage/components/date-filter.tsx app/(admin)/admin/usage/components/health-badge.tsx
git commit -m "feat: add shared DateFilter and HealthBadge components"
```

---

## Task 10: Overview Tab Component

**Files:**
- Create: `app/(admin)/admin/usage/components/overview-tab.tsx`

**Step 1: Implement the overview tab**

```typescript
'use client';

import { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, TrendingUp, TrendingDown, Users, LogIn, BarChart3, BookOpen } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import type { UsagePeriod, UsageOverviewStats } from '@/types';

interface OverviewTabProps {
  period: UsagePeriod;
}

export function OverviewTab({ period }: OverviewTabProps) {
  const [stats, setStats] = useState<UsageOverviewStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/usage/overview?period=${period}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setStats(data);
    } catch (error) {
      console.error('Failed to fetch overview stats:', error);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const loginChange = stats.previous_period_logins > 0
    ? Math.round(((stats.total_logins - stats.previous_period_logins) / stats.previous_period_logins) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Logins</CardTitle>
            <LogIn className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_logins}</div>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
              {loginChange >= 0 ? (
                <TrendingUp className="w-3 h-3 text-green-500" />
              ) : (
                <TrendingDown className="w-3 h-3 text-red-500" />
              )}
              {loginChange >= 0 ? '+' : ''}{loginChange}% from last period
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Students</CardTitle>
            <Users className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.active_students}/{stats.total_students}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.total_students > 0 ? Math.round((stats.active_students / stats.total_students) * 100) : 0}% active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Logins/Student</CardTitle>
            <BarChart3 className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.avg_logins_per_student}</div>
            <p className="text-xs text-muted-foreground mt-1">per student this period</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Content Completion</CardTitle>
            <BookOpen className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.content_completion_percent}%</div>
            <Progress value={stats.content_completion_percent} className="mt-2 h-1.5" />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cohort Leaderboard */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cohort Leaderboard</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {stats.cohort_rankings.map((cohort, i) => (
              <div key={cohort.cohort_id} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-muted-foreground w-6">{i + 1}.</span>
                  <span className="text-sm font-medium">{cohort.cohort_name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">{cohort.active_count}/{cohort.total_count}</span>
                  <div className="w-20">
                    <Progress value={cohort.engagement_percent} className="h-1.5" />
                  </div>
                  <span className="text-sm font-semibold w-10 text-right">{cohort.engagement_percent}%</span>
                </div>
              </div>
            ))}
            {stats.cohort_rankings.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No active cohorts</p>
            )}
          </CardContent>
        </Card>

        {/* Login Activity Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Login Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.daily_login_trend.length > 0 ? (
              <div className="flex items-end gap-1 h-32">
                {stats.daily_login_trend.map((day) => {
                  const maxCount = Math.max(...stats.daily_login_trend.map(d => d.count));
                  const height = maxCount > 0 ? (day.count / maxCount) * 100 : 0;
                  return (
                    <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-[10px] text-muted-foreground">{day.count}</span>
                      <div
                        className="w-full bg-primary/80 rounded-t-sm min-h-[2px]"
                        style={{ height: `${Math.max(height, 2)}%` }}
                      />
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(day.date).toLocaleDateString('en', { weekday: 'short' })}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">No login data for this period</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Asset Engagement Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Asset Engagement</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.entries(stats.asset_summary).map(([type, data]) => {
              const label = type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
              const percent = data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0;
              return (
                <div key={type} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{label}</span>
                    <span className="text-muted-foreground">{data.completed}/{data.total}</span>
                  </div>
                  <Progress value={percent} className="h-1.5" />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

**Step 2: Build verification**

Run: `npm run build`
Expected: 0 TypeScript errors

**Step 3: Commit**

```bash
git add app/(admin)/admin/usage/components/overview-tab.tsx
git commit -m "feat: add overview tab component for usage analytics"
```

---

## Task 11: Cohort Tab Component

**Files:**
- Create: `app/(admin)/admin/usage/components/cohort-tab.tsx`

**Step 1: Implement the cohort tab**

```typescript
'use client';

import { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Loader2, Users, LogIn, AlertTriangle, BookOpen } from 'lucide-react';
import { HealthBadge, HealthDot } from './health-badge';
import { formatDistanceToNow } from 'date-fns';
import type { UsagePeriod, CohortUsageStats } from '@/types';

interface Cohort {
  id: string;
  name: string;
}

interface CohortTabProps {
  period: UsagePeriod;
  cohorts: Cohort[];
  selectedCohort: string;
  onCohortChange: (cohortId: string) => void;
}

export function CohortTab({ period, cohorts, selectedCohort, onCohortChange }: CohortTabProps) {
  const [stats, setStats] = useState<CohortUsageStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    if (!selectedCohort) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/usage/cohort?cohort_id=${selectedCohort}&period=${period}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setStats(data);
    } catch (error) {
      console.error('Failed to fetch cohort stats:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedCohort, period]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  if (!selectedCohort) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Select a cohort to view usage data
      </div>
    );
  }

  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Logins This Period</CardTitle>
            <LogIn className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.logins_this_period}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Students</CardTitle>
            <Users className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.active_students}/{stats.total_students}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">At-Risk Students</CardTitle>
            <AlertTriangle className="w-4 h-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{stats.at_risk_count}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Content Completion</CardTitle>
            <BookOpen className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.content_completion_percent}%</div>
            <Progress value={stats.content_completion_percent} className="mt-2 h-1.5" />
          </CardContent>
        </Card>
      </div>

      {/* Student Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Students ({stats.students.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="text-center">Logins</TableHead>
                <TableHead>Last Login</TableHead>
                <TableHead className="text-center">Content</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats.students.map((student) => (
                <TableRow key={student.user_id}>
                  <TableCell>
                    <HealthDot status={student.health_status} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={student.avatar_url || undefined} />
                        <AvatarFallback className="text-xs">
                          {student.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium text-sm">{student.name}</div>
                        <div className="text-xs text-muted-foreground">{student.email}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-center tabular-nums">{student.login_count}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {student.last_login
                      ? formatDistanceToNow(new Date(student.last_login), { addSuffix: true })
                      : 'Never'
                    }
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center gap-2 justify-center">
                      <Progress value={student.content_completion_percent} className="w-16 h-1.5" />
                      <span className="text-xs tabular-nums">{student.content_completion_percent}%</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <HealthBadge status={student.health_status} />
                  </TableCell>
                </TableRow>
              ))}
              {stats.students.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No students in this cohort
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Module Asset Breakdown */}
      {stats.module_assets && stats.module_assets.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Content by Module</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {stats.module_assets.map((mod) => (
              <div key={mod.module_id} className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">
                    {mod.week_number ? `Week ${mod.week_number}: ` : ''}{mod.module_name}
                  </span>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs text-muted-foreground">
                  <span>Videos {mod.videos.completed}/{mod.videos.total}</span>
                  <span>Cases {mod.case_studies.completed}/{mod.case_studies.total}</span>
                  <span>Slides {mod.presentations.completed}/{mod.presentations.total}</span>
                  <span>PDFs {mod.pdfs.completed}/{mod.pdfs.total}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

**Step 2: Build verification**

Run: `npm run build`
Expected: 0 TypeScript errors

**Step 3: Commit**

```bash
git add app/(admin)/admin/usage/components/cohort-tab.tsx
git commit -m "feat: add cohort tab component with student health table"
```

---

## Task 12: Student Detail Tab Component

**Files:**
- Create: `app/(admin)/admin/usage/components/student-detail-tab.tsx`

**Step 1: Implement the student detail tab**

```typescript
'use client';

import { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Loader2, LogIn, BookOpen, Clock, Video, FileText, Presentation, Search } from 'lucide-react';
import { HealthBadge } from './health-badge';
import { formatDistanceToNow, format } from 'date-fns';
import type { UsagePeriod, StudentUsageDetail, CohortUsageStudent } from '@/types';

interface StudentDetailTabProps {
  period: UsagePeriod;
  students: CohortUsageStudent[];
  selectedStudentId: string | null;
  onStudentChange: (userId: string) => void;
}

export function StudentDetailTab({ period, students, selectedStudentId, onStudentChange }: StudentDetailTabProps) {
  const [detail, setDetail] = useState<StudentUsageDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchDetail = useCallback(async () => {
    if (!selectedStudentId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/usage/student?user_id=${selectedStudentId}`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setDetail(data);
    } catch (error) {
      console.error('Failed to fetch student detail:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedStudentId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const filteredStudents = students.filter(s =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const activityIcon: Record<string, typeof Video> = {
    video_watched: Video,
    case_study_opened: FileText,
    presentation_viewed: Presentation,
    pdf_opened: FileText,
    resource_completed: BookOpen,
  };

  const methodLabel: Record<string, string> = {
    phone_otp: 'Phone OTP',
    google_oauth: 'Google',
    magic_link: 'Magic Link',
  };

  return (
    <div className="space-y-6">
      {/* Student Selector */}
      <div className="relative w-full max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search student by name or email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
        />
      </div>

      {searchTerm && filteredStudents.length > 0 && !selectedStudentId && (
        <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
          {filteredStudents.slice(0, 10).map((s) => (
            <button
              key={s.user_id}
              className="w-full flex items-center gap-3 px-4 py-2 hover:bg-muted/50 text-left"
              onClick={() => {
                onStudentChange(s.user_id);
                setSearchTerm(s.name);
              }}
            >
              <Avatar className="w-6 h-6">
                <AvatarImage src={s.avatar_url || undefined} />
                <AvatarFallback className="text-[10px]">
                  {s.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <span className="text-sm font-medium">{s.name}</span>
                <span className="text-xs text-muted-foreground ml-2">{s.email}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {!selectedStudentId && (
        <div className="text-center py-12 text-muted-foreground">
          Search and select a student to view their activity
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {detail && !loading && (
        <>
          {/* Student Card */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <Avatar className="w-14 h-14">
                  <AvatarImage src={detail.avatar_url || undefined} />
                  <AvatarFallback>
                    {detail.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold">{detail.name}</h3>
                    <HealthBadge status={detail.health_status} />
                  </div>
                  <p className="text-sm text-muted-foreground">{detail.email}</p>
                  <p className="text-sm text-muted-foreground">{detail.cohort_name}</p>
                </div>
                <div className="text-right space-y-1">
                  <div className="text-sm">
                    <span className="text-muted-foreground">Last login: </span>
                    <span className="font-medium">
                      {detail.last_login
                        ? formatDistanceToNow(new Date(detail.last_login), { addSuffix: true })
                        : 'Never'
                      }
                    </span>
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Total logins: </span>
                    <span className="font-medium">{detail.total_logins}</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Content: </span>
                    <span className="font-medium">{detail.content_completion_percent}% complete</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Login History */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <LogIn className="w-4 h-4" />
                  Login History
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {detail.login_history.map((login, i) => (
                    <div key={i} className="flex items-center justify-between text-sm py-1">
                      <span>{format(new Date(login.created_at), 'MMM d, yyyy h:mm a')}</span>
                      <Badge variant="outline" className="text-xs">
                        {methodLabel[login.login_method] || login.login_method}
                      </Badge>
                    </div>
                  ))}
                  {detail.login_history.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">No login history</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Module Engagement */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <BookOpen className="w-4 h-4" />
                  Content by Module
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {detail.module_engagement.map((mod) => (
                  <div key={mod.module_id} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">
                        {mod.week_number ? `Week ${mod.week_number}: ` : ''}{mod.module_name}
                      </span>
                      <span className="text-muted-foreground tabular-nums">{mod.completed}/{mod.total}</span>
                    </div>
                    <Progress value={mod.percent} className="h-2" />
                  </div>
                ))}
                {detail.module_engagement.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No module data</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {detail.recent_activity.map((activity, i) => {
                  const Icon = activityIcon[activity.type] || FileText;
                  return (
                    <div key={i} className="flex items-center gap-3 text-sm">
                      <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="flex-1">{activity.title}</span>
                      {activity.detail && (
                        <Badge variant="outline" className="text-xs">{activity.detail}</Badge>
                      )}
                      <span className="text-xs text-muted-foreground shrink-0">
                        {activity.timestamp
                          ? formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })
                          : ''
                        }
                      </span>
                    </div>
                  );
                })}
                {detail.recent_activity.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No recent activity</p>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
```

**Step 2: Build verification**

Run: `npm run build`
Expected: 0 TypeScript errors

**Step 3: Commit**

```bash
git add app/(admin)/admin/usage/components/student-detail-tab.tsx
git commit -m "feat: add student detail tab with login history and activity timeline"
```

---

## Task 13: Main Usage Page — Tab Orchestration

**Files:**
- Create: `app/(admin)/admin/usage/page.tsx`

**Step 1: Implement the main page**

Follow the `mentors/page.tsx` tab orchestration pattern exactly:

```typescript
'use client';

import { useState, useCallback, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useUserContext } from '@/contexts/user-context';
import { Loader2, Globe, Users, User } from 'lucide-react';
import { MotionFadeIn } from '@/components/ui/motion';
import { PageHeader } from '@/components/ui/page-header';
import { Activity } from 'lucide-react';
import { DateFilter } from './components/date-filter';
import { OverviewTab } from './components/overview-tab';
import { CohortTab } from './components/cohort-tab';
import { StudentDetailTab } from './components/student-detail-tab';
import type { UsagePeriod, CohortUsageStudent } from '@/types';

interface Cohort {
  id: string;
  name: string;
}

export default function UsagePage() {
  const { user } = useUserContext();
  const [activeTab, setActiveTab] = useState('cohort');
  const [period, setPeriod] = useState<UsagePeriod>('week');
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [selectedCohort, setSelectedCohort] = useState('');
  const [loadingCohorts, setLoadingCohorts] = useState(true);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [cohortStudents, setCohortStudents] = useState<CohortUsageStudent[]>([]);

  // Fetch cohorts
  const fetchCohorts = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/cohorts');
      if (!res.ok) throw new Error('Failed to fetch cohorts');
      const data = await res.json();
      const activeCohorts = (data || []).filter((c: Cohort & { status?: string }) => c.status === 'active' || !c.status);
      setCohorts(activeCohorts);
      if (activeCohorts.length > 0 && !selectedCohort) {
        setSelectedCohort(activeCohorts[0].id);
      }
    } catch (error) {
      console.error('Failed to fetch cohorts:', error);
    } finally {
      setLoadingCohorts(false);
    }
  }, [selectedCohort]);

  useEffect(() => {
    fetchCohorts();
  }, [fetchCohorts]);

  // Track cohort students for student detail tab
  const handleCohortStatsLoaded = useCallback((students: CohortUsageStudent[]) => {
    setCohortStudents(students);
  }, []);

  if (loadingCohorts) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Activity}
        iconColor="text-cyan-500"
        title="LMS Usage Analytics"
        description="Track student logins, content engagement, and identify at-risk students"
        action={
          <DateFilter period={period} onPeriodChange={setPeriod} />
        }
      />

      <MotionFadeIn delay={0.1}>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="overview" className="gap-2">
              <Globe className="w-4 h-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="cohort" className="gap-2">
              <Users className="w-4 h-4" />
              Cohort View
            </TabsTrigger>
            <TabsTrigger value="student" className="gap-2">
              <User className="w-4 h-4" />
              Student Detail
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6">
            <OverviewTab period={period} />
          </TabsContent>

          <TabsContent value="cohort" className="mt-6">
            <div className="mb-4">
              <Select value={selectedCohort} onValueChange={setSelectedCohort}>
                <SelectTrigger className="w-[250px]">
                  <SelectValue placeholder="Select cohort" />
                </SelectTrigger>
                <SelectContent>
                  {cohorts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <CohortTab
              period={period}
              cohorts={cohorts}
              selectedCohort={selectedCohort}
              onCohortChange={setSelectedCohort}
            />
          </TabsContent>

          <TabsContent value="student" className="mt-6">
            <StudentDetailTab
              period={period}
              students={cohortStudents}
              selectedStudentId={selectedStudentId}
              onStudentChange={setSelectedStudentId}
            />
          </TabsContent>
        </Tabs>
      </MotionFadeIn>
    </div>
  );
}
```

**Step 2: Build verification**

Run: `npm run build`
Expected: 0 TypeScript errors

**Step 3: Commit**

```bash
git add app/(admin)/admin/usage/page.tsx
git commit -m "feat: add main usage analytics page with 3-tab orchestration"
```

---

## Task 14: Final Build Verification & Integration Test

**Step 1: Full build**

Run: `npm run build`
Expected: 0 TypeScript errors, all pages compile

**Step 2: Lint check**

Run: `npm run lint`
Expected: No new lint errors in usage/ files

**Step 3: Verify navigation**

After `npm run dev`, navigate to `/admin/usage`:
- "Usage" should appear in admin sidebar between Analytics and Invoices
- Default tab should be "Cohort View"
- Date filter should default to "This Week"
- Switching tabs should work without page reload

**Step 4: Commit everything outstanding**

```bash
git add -A
git commit -m "feat: complete LMS usage analytics dashboard — all tabs and API routes"
```

---

## Summary

| Task | Description | Files | Est. |
|------|-------------|-------|------|
| 1 | Database migration | 1 new | 2 min |
| 2 | TypeScript types | 1 modified | 3 min |
| 3 | Login event tracking | 1 new + 2 modified | 5 min |
| 4 | Overview API route | 1 new | 5 min |
| 5 | Cohort API route | 1 new | 5 min |
| 6 | Student API route | 1 new | 5 min |
| 7 | Asset API route | 1 new | 3 min |
| 8 | Sidebar nav item | 1 modified | 2 min |
| 9 | Shared components | 2 new | 3 min |
| 10 | Overview tab UI | 1 new | 5 min |
| 11 | Cohort tab UI | 1 new | 5 min |
| 12 | Student detail tab UI | 1 new | 5 min |
| 13 | Main page orchestration | 1 new | 5 min |
| 14 | Build verification | 0 | 3 min |

**Total**: 14 tasks, 12 new files, 4 modified files, ~56 min estimated
