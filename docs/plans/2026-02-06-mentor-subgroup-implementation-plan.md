# Mentor & Subgroup Module — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a complete mentor/subgroup system with admin CRUD, student "My Subgroup" view, mentor dashboard, and bidirectional feedback — integrated into the existing Rethink Dashboard.

**Architecture:** New `subgroups`, `subgroup_members`, `subgroup_mentors`, `mentor_feedback`, and `student_feedback` tables in Supabase. Admin manages subgroups via `/admin/mentors`. Students see their subgroup at `/dashboard/my-subgroup`. Mentors get a dedicated dashboard view when `activeRole === 'mentor'`. All API routes follow the established `verifyAdmin()` + `createAdminClient()` pattern.

**Tech Stack:** Next.js 16 App Router, Supabase (PostgreSQL + RLS), TypeScript, Radix UI (shadcn/ui), Tailwind CSS 4, Sonner toasts, Lucide icons.

**PRD Reference:** `docs/plans/2026-02-06-mentor-subgroup-module.md`

---

## Phase 1: Foundation (Database + Types + Admin CRUD)

### Task 1: Create Database Migration

**Files:**
- Create: `supabase/migrations/017_subgroups_and_feedback.sql`

**Step 1: Write the migration SQL**

```sql
-- 017_subgroups_and_feedback.sql
-- Subgroups, membership, mentors, and feedback tables

-- 1. Subgroups
CREATE TABLE IF NOT EXISTS subgroups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id UUID NOT NULL REFERENCES cohorts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(cohort_id, name)
);

-- 2. Subgroup Members (students)
CREATE TABLE IF NOT EXISTS subgroup_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subgroup_id UUID NOT NULL REFERENCES subgroups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(subgroup_id, user_id)
);

-- 3. Subgroup Mentors (many-to-many)
CREATE TABLE IF NOT EXISTS subgroup_mentors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subgroup_id UUID NOT NULL REFERENCES subgroups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(subgroup_id, user_id)
);

-- 4. Mentor Feedback (mentor → student)
CREATE TABLE IF NOT EXISTS mentor_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id UUID NOT NULL REFERENCES profiles(id),
  student_id UUID NOT NULL REFERENCES profiles(id),
  subgroup_id UUID NOT NULL REFERENCES subgroups(id),
  type TEXT NOT NULL CHECK (type IN ('daily', 'weekly')),
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  week_number INTEGER,
  feedback_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(mentor_id, student_id, type, feedback_date)
);

-- 5. Student Feedback (student → mentor/session)
CREATE TABLE IF NOT EXISTS student_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES profiles(id),
  target_type TEXT NOT NULL CHECK (target_type IN ('mentor', 'session')),
  target_id UUID NOT NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  week_number INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(student_id, target_type, target_id, week_number)
);

-- Indexes for common queries
CREATE INDEX idx_subgroups_cohort ON subgroups(cohort_id);
CREATE INDEX idx_subgroup_members_subgroup ON subgroup_members(subgroup_id);
CREATE INDEX idx_subgroup_members_user ON subgroup_members(user_id);
CREATE INDEX idx_subgroup_mentors_subgroup ON subgroup_mentors(subgroup_id);
CREATE INDEX idx_subgroup_mentors_user ON subgroup_mentors(user_id);
CREATE INDEX idx_mentor_feedback_mentor ON mentor_feedback(mentor_id);
CREATE INDEX idx_mentor_feedback_student ON mentor_feedback(student_id);
CREATE INDEX idx_mentor_feedback_subgroup ON mentor_feedback(subgroup_id);
CREATE INDEX idx_student_feedback_student ON student_feedback(student_id);
CREATE INDEX idx_student_feedback_target ON student_feedback(target_type, target_id);

-- RLS Policies
ALTER TABLE subgroups ENABLE ROW LEVEL SECURITY;
ALTER TABLE subgroup_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE subgroup_mentors ENABLE ROW LEVEL SECURITY;
ALTER TABLE mentor_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_feedback ENABLE ROW LEVEL SECURITY;

-- Students: read their own subgroup
CREATE POLICY "Students can read own subgroup" ON subgroups
  FOR SELECT USING (
    id IN (SELECT subgroup_id FROM subgroup_members WHERE user_id = auth.uid())
  );

-- Students: read members of their subgroup
CREATE POLICY "Students can read own subgroup members" ON subgroup_members
  FOR SELECT USING (
    subgroup_id IN (SELECT subgroup_id FROM subgroup_members WHERE user_id = auth.uid())
  );

-- Students: read mentors of their subgroup
CREATE POLICY "Students can read own subgroup mentors" ON subgroup_mentors
  FOR SELECT USING (
    subgroup_id IN (SELECT subgroup_id FROM subgroup_members WHERE user_id = auth.uid())
  );

-- Mentors: read their assigned subgroups
CREATE POLICY "Mentors can read assigned subgroups" ON subgroups
  FOR SELECT USING (
    id IN (SELECT subgroup_id FROM subgroup_mentors WHERE user_id = auth.uid())
  );

-- Mentors: read members of assigned subgroups
CREATE POLICY "Mentors can read assigned subgroup members" ON subgroup_members
  FOR SELECT USING (
    subgroup_id IN (SELECT subgroup_id FROM subgroup_mentors WHERE user_id = auth.uid())
  );

-- Mentors: read mentors of assigned subgroups
CREATE POLICY "Mentors can read assigned subgroup mentors" ON subgroup_mentors
  FOR SELECT USING (
    subgroup_id IN (SELECT subgroup_id FROM subgroup_mentors WHERE user_id = auth.uid())
  );

-- Mentor feedback: mentors can insert for their subgroup students
CREATE POLICY "Mentors can insert feedback" ON mentor_feedback
  FOR INSERT WITH CHECK (
    mentor_id = auth.uid()
    AND subgroup_id IN (SELECT subgroup_id FROM subgroup_mentors WHERE user_id = auth.uid())
  );

-- Mentor feedback: mentors can read their own feedback
CREATE POLICY "Mentors can read own feedback" ON mentor_feedback
  FOR SELECT USING (mentor_id = auth.uid());

-- Mentor feedback: students can read feedback about themselves
CREATE POLICY "Students can read own received feedback" ON mentor_feedback
  FOR SELECT USING (student_id = auth.uid());

-- Student feedback: students can insert their own
CREATE POLICY "Students can insert feedback" ON student_feedback
  FOR INSERT WITH CHECK (student_id = auth.uid());

-- Student feedback: students can read their own
CREATE POLICY "Students can read own feedback" ON student_feedback
  FOR SELECT USING (student_id = auth.uid());

-- Student feedback: mentors can read feedback about themselves
CREATE POLICY "Mentors can read feedback about themselves" ON student_feedback
  FOR SELECT USING (
    target_type = 'mentor' AND target_id = auth.uid()
  );

-- Mentor feedback: mentors can update their own feedback
CREATE POLICY "Mentors can update own feedback" ON mentor_feedback
  FOR UPDATE USING (mentor_id = auth.uid());

-- Student feedback: students can update their own feedback
CREATE POLICY "Students can update own feedback" ON student_feedback
  FOR UPDATE USING (student_id = auth.uid());
```

**Step 2: Apply migration**

Run: `cd /Users/shravantickoo/Downloads/rethink-dashboard && npx supabase db push` (or apply via Supabase dashboard)

**Step 3: Commit**

```bash
git add supabase/migrations/017_subgroups_and_feedback.sql
git commit -m "feat(db): add subgroups and feedback tables (migration 017)"
```

---

### Task 2: Add TypeScript Types

**Files:**
- Modify: `types/index.ts` — append new interfaces at bottom

**Step 1: Add type definitions**

Add these types after the existing `ApiResponse` interface (~line 523):

```typescript
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
```

**Step 2: Verify build**

Run: `npm run build`
Expected: 0 TypeScript errors (types are additive-only)

**Step 3: Commit**

```bash
git add types/index.ts
git commit -m "feat(types): add Subgroup, MentorFeedback, StudentFeedback interfaces"
```

---

### Task 3: Build Admin Subgroup API — CRUD Routes

**Files:**
- Create: `app/api/admin/subgroups/route.ts` — GET (list) + POST (create)
- Create: `app/api/admin/subgroups/[id]/route.ts` — PUT (rename) + DELETE

**Step 1: Create the list + create route**

Create `app/api/admin/subgroups/route.ts`:

```typescript
import { createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/api/verify-admin';

// GET - List subgroups for a cohort
export async function GET(request: NextRequest) {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { searchParams } = new URL(request.url);
    const cohortId = searchParams.get('cohort_id');

    if (!cohortId) {
      return NextResponse.json({ error: 'cohort_id is required' }, { status: 400 });
    }

    const adminClient = await createAdminClient();

    // Fetch subgroups with member and mentor counts
    const { data: subgroups, error } = await adminClient
      .from('subgroups')
      .select('id, name, cohort_id, created_at, updated_at')
      .eq('cohort_id', cohortId)
      .order('name', { ascending: true });

    if (error) throw error;

    if (!subgroups || subgroups.length === 0) {
      return NextResponse.json([]);
    }

    const subgroupIds = subgroups.map(s => s.id);

    // Batch fetch members and mentors
    const [{ data: members }, { data: mentors }] = await Promise.all([
      adminClient
        .from('subgroup_members')
        .select('subgroup_id, user_id, user:profiles(id, full_name, email, avatar_url)')
        .in('subgroup_id', subgroupIds),
      adminClient
        .from('subgroup_mentors')
        .select('subgroup_id, user_id, user:profiles(id, full_name, email, avatar_url)')
        .in('subgroup_id', subgroupIds),
    ]);

    // Group by subgroup
    const membersBySubgroup = new Map<string, typeof members>();
    for (const m of members || []) {
      const list = membersBySubgroup.get(m.subgroup_id) || [];
      list.push(m);
      membersBySubgroup.set(m.subgroup_id, list);
    }

    const mentorsBySubgroup = new Map<string, typeof mentors>();
    for (const m of mentors || []) {
      const list = mentorsBySubgroup.get(m.subgroup_id) || [];
      list.push(m);
      mentorsBySubgroup.set(m.subgroup_id, list);
    }

    const result = subgroups.map(sg => ({
      ...sg,
      members: membersBySubgroup.get(sg.id) || [],
      mentors: mentorsBySubgroup.get(sg.id) || [],
      member_count: (membersBySubgroup.get(sg.id) || []).length,
      mentor_count: (mentorsBySubgroup.get(sg.id) || []).length,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching subgroups:', error);
    return NextResponse.json({ error: 'Failed to fetch subgroups' }, { status: 500 });
  }
}

// POST - Create a subgroup
export async function POST(request: NextRequest) {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const { name, cohort_id } = body;

    if (!name?.trim() || !cohort_id) {
      return NextResponse.json({ error: 'Name and cohort_id are required' }, { status: 400 });
    }

    const adminClient = await createAdminClient();

    const { data, error } = await adminClient
      .from('subgroups')
      .insert({ name: name.trim(), cohort_id })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'A subgroup with this name already exists in this cohort' }, { status: 409 });
      }
      throw error;
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error creating subgroup:', error);
    return NextResponse.json({ error: 'Failed to create subgroup' }, { status: 500 });
  }
}
```

**Step 2: Create the update + delete route**

Create `app/api/admin/subgroups/[id]/route.ts`:

```typescript
import { createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/api/verify-admin';

// PUT - Rename subgroup
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { name } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const adminClient = await createAdminClient();

    const { data, error } = await adminClient
      .from('subgroups')
      .update({ name: name.trim(), updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'A subgroup with this name already exists in this cohort' }, { status: 409 });
      }
      throw error;
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error updating subgroup:', error);
    return NextResponse.json({ error: 'Failed to update subgroup' }, { status: 500 });
  }
}

// DELETE - Delete subgroup (cascades members + mentors)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { id } = await params;
    const adminClient = await createAdminClient();

    const { error } = await adminClient
      .from('subgroups')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting subgroup:', error);
    return NextResponse.json({ error: 'Failed to delete subgroup' }, { status: 500 });
  }
}
```

**Step 3: Verify build**

Run: `npm run build`

**Step 4: Commit**

```bash
git add app/api/admin/subgroups/
git commit -m "feat(api): admin subgroup CRUD routes"
```

---

### Task 4: Build Admin Subgroup API — Member & Mentor Assignment

**Files:**
- Create: `app/api/admin/subgroups/[id]/members/route.ts`
- Create: `app/api/admin/subgroups/[id]/mentors/route.ts`

**Step 1: Create member assignment route**

Create `app/api/admin/subgroups/[id]/members/route.ts`:

```typescript
import { createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/api/verify-admin';

// POST - Assign students to subgroup
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { id: subgroupId } = await params;
    const body = await request.json();
    const { user_ids } = body;

    if (!Array.isArray(user_ids) || user_ids.length === 0) {
      return NextResponse.json({ error: 'user_ids array is required' }, { status: 400 });
    }

    const adminClient = await createAdminClient();

    // Get the cohort_id of this subgroup
    const { data: subgroup } = await adminClient
      .from('subgroups')
      .select('cohort_id')
      .eq('id', subgroupId)
      .single();

    if (!subgroup) {
      return NextResponse.json({ error: 'Subgroup not found' }, { status: 404 });
    }

    // Check if any students are already in a different subgroup in this cohort
    const { data: existingMembers } = await adminClient
      .from('subgroup_members')
      .select('user_id, subgroup:subgroups(id, name)')
      .in('user_id', user_ids)
      .neq('subgroup_id', subgroupId);

    // Filter to only members in same cohort
    const conflicts = (existingMembers || []).filter(
      (m: any) => m.subgroup?.id && m.subgroup.id !== subgroupId
    );

    if (conflicts.length > 0) {
      // Check if those subgroups belong to the same cohort
      const conflictSubgroupIds = conflicts.map((c: any) => c.subgroup.id);
      const { data: conflictSubgroups } = await adminClient
        .from('subgroups')
        .select('id, name, cohort_id')
        .in('id', conflictSubgroupIds)
        .eq('cohort_id', subgroup.cohort_id);

      if (conflictSubgroups && conflictSubgroups.length > 0) {
        const conflictNames = conflictSubgroups.map(s => s.name).join(', ');
        return NextResponse.json(
          { error: `Some students are already in other subgroups: ${conflictNames}` },
          { status: 409 }
        );
      }
    }

    // Insert members (ignore duplicates via ON CONFLICT DO NOTHING)
    const rows = user_ids.map((uid: string) => ({
      subgroup_id: subgroupId,
      user_id: uid,
    }));

    const { data, error } = await adminClient
      .from('subgroup_members')
      .upsert(rows, { onConflict: 'subgroup_id,user_id', ignoreDuplicates: true })
      .select();

    if (error) throw error;

    return NextResponse.json({ added: data?.length || 0 }, { status: 201 });
  } catch (error) {
    console.error('Error assigning members:', error);
    return NextResponse.json({ error: 'Failed to assign members' }, { status: 500 });
  }
}

// DELETE - Remove students from subgroup
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { id: subgroupId } = await params;
    const body = await request.json();
    const { user_ids } = body;

    if (!Array.isArray(user_ids) || user_ids.length === 0) {
      return NextResponse.json({ error: 'user_ids array is required' }, { status: 400 });
    }

    const adminClient = await createAdminClient();

    const { error } = await adminClient
      .from('subgroup_members')
      .delete()
      .eq('subgroup_id', subgroupId)
      .in('user_id', user_ids);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing members:', error);
    return NextResponse.json({ error: 'Failed to remove members' }, { status: 500 });
  }
}
```

**Step 2: Create mentor assignment route**

Create `app/api/admin/subgroups/[id]/mentors/route.ts`:

```typescript
import { createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/api/verify-admin';

// POST - Assign mentors to subgroup
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { id: subgroupId } = await params;
    const body = await request.json();
    const { user_ids } = body;

    if (!Array.isArray(user_ids) || user_ids.length === 0) {
      return NextResponse.json({ error: 'user_ids array is required' }, { status: 400 });
    }

    const adminClient = await createAdminClient();

    // Verify the subgroup exists and get cohort_id
    const { data: subgroup } = await adminClient
      .from('subgroups')
      .select('cohort_id')
      .eq('id', subgroupId)
      .single();

    if (!subgroup) {
      return NextResponse.json({ error: 'Subgroup not found' }, { status: 404 });
    }

    // Verify all users have mentor role for this cohort
    const { data: roleAssignments } = await adminClient
      .from('user_role_assignments')
      .select('user_id')
      .in('user_id', user_ids)
      .eq('role', 'mentor')
      .eq('cohort_id', subgroup.cohort_id);

    const validMentorIds = new Set((roleAssignments || []).map(r => r.user_id));
    const invalidIds = user_ids.filter((uid: string) => !validMentorIds.has(uid));

    if (invalidIds.length > 0) {
      return NextResponse.json(
        { error: `${invalidIds.length} user(s) do not have mentor role for this cohort` },
        { status: 400 }
      );
    }

    const rows = user_ids.map((uid: string) => ({
      subgroup_id: subgroupId,
      user_id: uid,
    }));

    const { data, error } = await adminClient
      .from('subgroup_mentors')
      .upsert(rows, { onConflict: 'subgroup_id,user_id', ignoreDuplicates: true })
      .select();

    if (error) throw error;

    return NextResponse.json({ added: data?.length || 0 }, { status: 201 });
  } catch (error) {
    console.error('Error assigning mentors:', error);
    return NextResponse.json({ error: 'Failed to assign mentors' }, { status: 500 });
  }
}

// DELETE - Remove mentors from subgroup
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { id: subgroupId } = await params;
    const body = await request.json();
    const { user_ids } = body;

    if (!Array.isArray(user_ids) || user_ids.length === 0) {
      return NextResponse.json({ error: 'user_ids array is required' }, { status: 400 });
    }

    const adminClient = await createAdminClient();

    const { error } = await adminClient
      .from('subgroup_mentors')
      .delete()
      .eq('subgroup_id', subgroupId)
      .in('user_id', user_ids);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing mentors:', error);
    return NextResponse.json({ error: 'Failed to remove mentors' }, { status: 500 });
  }
}
```

**Step 3: Verify build**

Run: `npm run build`

**Step 4: Commit**

```bash
git add app/api/admin/subgroups/
git commit -m "feat(api): admin subgroup member & mentor assignment routes"
```

---

### Task 5: Build Admin Subgroup API — Bulk Operations

**Files:**
- Create: `app/api/admin/subgroups/bulk-create/route.ts`
- Create: `app/api/admin/subgroups/auto-assign/route.ts`

**Step 1: Create bulk-create route**

Create `app/api/admin/subgroups/bulk-create/route.ts`:

```typescript
import { createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/api/verify-admin';

// POST - Auto-create N subgroups with sequential names
export async function POST(request: NextRequest) {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const { cohort_id, count, prefix } = body;

    if (!cohort_id || !count || count < 1 || count > 20) {
      return NextResponse.json({ error: 'cohort_id and count (1-20) are required' }, { status: 400 });
    }

    const namePrefix = prefix?.trim() || 'Subgroup';
    const adminClient = await createAdminClient();

    // Get existing subgroups to avoid name conflicts
    const { data: existing } = await adminClient
      .from('subgroups')
      .select('name')
      .eq('cohort_id', cohort_id);

    const existingNames = new Set((existing || []).map(s => s.name));

    const rows = [];
    let num = 1;
    while (rows.length < count) {
      const name = `${namePrefix} ${num}`;
      if (!existingNames.has(name)) {
        rows.push({ cohort_id, name });
      }
      num++;
      if (num > count + existingNames.size + 10) break; // Safety limit
    }

    const { data, error } = await adminClient
      .from('subgroups')
      .insert(rows)
      .select();

    if (error) throw error;

    return NextResponse.json({ created: data?.length || 0, subgroups: data }, { status: 201 });
  } catch (error) {
    console.error('Error bulk creating subgroups:', error);
    return NextResponse.json({ error: 'Failed to create subgroups' }, { status: 500 });
  }
}
```

**Step 2: Create auto-assign route**

Create `app/api/admin/subgroups/auto-assign/route.ts`:

```typescript
import { createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/api/verify-admin';

// POST - Distribute unassigned students evenly across subgroups
export async function POST(request: NextRequest) {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const { cohort_id } = body;

    if (!cohort_id) {
      return NextResponse.json({ error: 'cohort_id is required' }, { status: 400 });
    }

    const adminClient = await createAdminClient();

    // Get subgroups for this cohort
    const { data: subgroups } = await adminClient
      .from('subgroups')
      .select('id')
      .eq('cohort_id', cohort_id)
      .order('name', { ascending: true });

    if (!subgroups || subgroups.length === 0) {
      return NextResponse.json({ error: 'No subgroups found. Create subgroups first.' }, { status: 400 });
    }

    // Get all students in this cohort
    const { data: students } = await adminClient
      .from('user_role_assignments')
      .select('user_id')
      .eq('cohort_id', cohort_id)
      .eq('role', 'student');

    if (!students || students.length === 0) {
      return NextResponse.json({ error: 'No students found in this cohort' }, { status: 400 });
    }

    // Get already-assigned students in this cohort's subgroups
    const subgroupIds = subgroups.map(s => s.id);
    const { data: existingMembers } = await adminClient
      .from('subgroup_members')
      .select('user_id')
      .in('subgroup_id', subgroupIds);

    const assignedSet = new Set((existingMembers || []).map(m => m.user_id));
    const unassigned = students.filter(s => !assignedSet.has(s.user_id));

    if (unassigned.length === 0) {
      return NextResponse.json({ error: 'All students are already assigned to subgroups' }, { status: 400 });
    }

    // Shuffle for random distribution
    const shuffled = [...unassigned].sort(() => Math.random() - 0.5);

    // Distribute evenly using round-robin
    const rows = shuffled.map((s, i) => ({
      subgroup_id: subgroups[i % subgroups.length].id,
      user_id: s.user_id,
    }));

    const { error } = await adminClient
      .from('subgroup_members')
      .insert(rows);

    if (error) throw error;

    return NextResponse.json({ assigned: rows.length });
  } catch (error) {
    console.error('Error auto-assigning students:', error);
    return NextResponse.json({ error: 'Failed to auto-assign students' }, { status: 500 });
  }
}
```

**Step 3: Verify build**

Run: `npm run build`

**Step 4: Commit**

```bash
git add app/api/admin/subgroups/
git commit -m "feat(api): admin subgroup bulk-create and auto-assign routes"
```

---

### Task 6: Add Same-Cohort Mentor+Student Validation

**Files:**
- Modify: `app/api/admin/users/route.ts` — add validation in PUT handler
- Modify: `app/(admin)/admin/users/components/edit-roles-dialog.tsx` — add frontend validation

**Step 1: Add backend validation in PUT handler**

In `app/api/admin/users/route.ts`, add validation BEFORE the delete+insert block (around line 121, after `if (role_assignments !== undefined && Array.isArray(role_assignments)) {`):

```typescript
    // Validate: no mentor + student for the same cohort
    const cohortRoles = new Map<string, Set<string>>();
    for (const ra of role_assignments as RoleAssignment[]) {
      if (ra.cohort_id && ['student', 'mentor'].includes(ra.role)) {
        if (!cohortRoles.has(ra.cohort_id)) {
          cohortRoles.set(ra.cohort_id, new Set());
        }
        cohortRoles.get(ra.cohort_id)!.add(ra.role);
      }
    }
    for (const [, roles] of cohortRoles) {
      if (roles.has('student') && roles.has('mentor')) {
        return NextResponse.json(
          { error: 'Cannot assign mentor and student roles for the same cohort' },
          { status: 400 }
        );
      }
    }
```

**Step 2: Add frontend validation in edit-roles-dialog.tsx**

In `app/(admin)/admin/users/components/edit-roles-dialog.tsx`, add validation in `handleSave` before the fetch call (after the `needsCohort` check, around line 82):

```typescript
    // Validate: no mentor + student for the same cohort
    const cohortRoles = new Map<string, Set<string>>();
    for (const ra of validAssignments) {
      if (ra.cohort_id && ['student', 'mentor'].includes(ra.role)) {
        if (!cohortRoles.has(ra.cohort_id)) {
          cohortRoles.set(ra.cohort_id, new Set());
        }
        cohortRoles.get(ra.cohort_id)!.add(ra.role);
      }
    }
    for (const [, roles] of cohortRoles) {
      if (roles.has('student') && roles.has('mentor')) {
        toast.error('Cannot assign mentor and student roles for the same cohort');
        return;
      }
    }
```

**Step 3: Verify build**

Run: `npm run build`

**Step 4: Commit**

```bash
git add app/api/admin/users/route.ts app/(admin)/admin/users/components/edit-roles-dialog.tsx
git commit -m "feat(validation): block mentor + student roles for same cohort"
```

---

### Task 7: Add Admin Sidebar Item + Create Mentors Page Shell

**Files:**
- Modify: `app/(admin)/layout.tsx` — add "Mentors" nav item (line ~38)
- Create: `app/(admin)/admin/mentors/page.tsx` — tab-based orchestrator
- Create: `app/(admin)/admin/mentors/loading.tsx` — skeleton loader
- Create: `app/(admin)/admin/mentors/types.ts` — local types

**Step 1: Add sidebar nav item**

In `app/(admin)/layout.tsx`, add after the Attendance item (line 36) and before Notifications (line 37):

```typescript
  { label: 'Mentors', href: '/admin/mentors', icon: Users },
```

Also add `UserCheck` to the lucide-react import to differentiate from the Users icon that's already used. Actually, since `Users` is already imported, let's use `UserCheck` instead:

Update the import line to add `UserCheck`:
```typescript
import { ..., UserCheck } from 'lucide-react';
```

And use it:
```typescript
  { label: 'Mentors', href: '/admin/mentors', icon: UserCheck },
```

**Step 2: Create types file**

Create `app/(admin)/admin/mentors/types.ts`:

```typescript
import type { Profile, Cohort, Subgroup } from '@/types';

export interface SubgroupWithDetails extends Subgroup {
  members: SubgroupMemberWithUser[];
  mentors: SubgroupMentorWithUser[];
  member_count: number;
  mentor_count: number;
}

export interface SubgroupMemberWithUser {
  subgroup_id: string;
  user_id: string;
  user: Pick<Profile, 'id' | 'full_name' | 'email' | 'avatar_url'>;
}

export interface SubgroupMentorWithUser {
  subgroup_id: string;
  user_id: string;
  user: Pick<Profile, 'id' | 'full_name' | 'email' | 'avatar_url'>;
}
```

**Step 3: Create loading skeleton**

Create `app/(admin)/admin/mentors/loading.tsx`:

```typescript
import { PageLoader } from '@/components/ui/page-loader';

export default function Loading() {
  return <PageLoader message="Loading mentor management..." />;
}
```

**Step 4: Create the page orchestrator**

Create `app/(admin)/admin/mentors/page.tsx`:

```typescript
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PageLoader } from '@/components/ui/page-loader';
import { toast } from 'sonner';
import { Users, MessageSquare } from 'lucide-react';
import type { Cohort } from '@/types';
import type { SubgroupWithDetails } from './types';
// Tab components will be added in later tasks
// import { SubgroupsTab } from './components/subgroups-tab';
// import { FeedbackOverviewTab } from './components/feedback-overview-tab';

export default function MentorsPage() {
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [selectedCohortId, setSelectedCohortId] = useState<string>('');
  const [subgroups, setSubgroups] = useState<SubgroupWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [subgroupsLoading, setSubgroupsLoading] = useState(false);
  const hasFetchedRef = useRef(false);

  const fetchCohorts = useCallback(async () => {
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;

    try {
      const response = await fetch('/api/admin/cohorts');
      if (!response.ok) throw new Error('Failed to fetch cohorts');
      const data = await response.json();
      setCohorts(data);
      // Auto-select first active cohort
      const active = data.find((c: Cohort) => c.status === 'active');
      if (active) setSelectedCohortId(active.id);
    } catch (error) {
      toast.error('Failed to load cohorts');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSubgroups = useCallback(async () => {
    if (!selectedCohortId) return;
    setSubgroupsLoading(true);
    try {
      const response = await fetch(`/api/admin/subgroups?cohort_id=${selectedCohortId}`);
      if (!response.ok) throw new Error('Failed to fetch subgroups');
      const data = await response.json();
      setSubgroups(data);
    } catch (error) {
      toast.error('Failed to load subgroups');
    } finally {
      setSubgroupsLoading(false);
    }
  }, [selectedCohortId]);

  useEffect(() => { fetchCohorts(); }, [fetchCohorts]);
  useEffect(() => { fetchSubgroups(); }, [fetchSubgroups]);

  if (loading) {
    return <PageLoader message="Loading mentor management..." />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Mentor & Subgroup Management</h1>
          <p className="text-muted-foreground">
            Manage subgroups, assign mentors, and view feedback
          </p>
        </div>
        <Select value={selectedCohortId} onValueChange={setSelectedCohortId}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Select cohort" />
          </SelectTrigger>
          <SelectContent>
            {cohorts.map((cohort) => (
              <SelectItem key={cohort.id} value={cohort.id}>
                {cohort.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="subgroups">
        <TabsList>
          <TabsTrigger value="subgroups" className="gap-2">
            <Users className="w-4 h-4" />
            Subgroups
          </TabsTrigger>
          <TabsTrigger value="feedback" className="gap-2">
            <MessageSquare className="w-4 h-4" />
            Feedback Overview
          </TabsTrigger>
        </TabsList>

        <TabsContent value="subgroups" className="mt-4">
          {/* SubgroupsTab will be implemented in Task 8 */}
          <div className="text-center py-12 text-muted-foreground">
            <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Subgroups tab — implementation pending</p>
          </div>
        </TabsContent>

        <TabsContent value="feedback" className="mt-4">
          {/* FeedbackOverviewTab will be implemented in Phase 4 */}
          <div className="text-center py-12 text-muted-foreground">
            <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Feedback overview — implementation pending</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

**Step 5: Verify build**

Run: `npm run build`

**Step 6: Commit**

```bash
git add "app/(admin)/layout.tsx" "app/(admin)/admin/mentors/"
git commit -m "feat(admin): mentors page shell with cohort selector and tab layout"
```

---

### Task 8: Build SubgroupsTab Component

**Files:**
- Create: `app/(admin)/admin/mentors/components/subgroups-tab.tsx`
- Create: `app/(admin)/admin/mentors/components/assign-students-dialog.tsx`
- Create: `app/(admin)/admin/mentors/components/assign-mentor-dialog.tsx`
- Modify: `app/(admin)/admin/mentors/page.tsx` — wire up SubgroupsTab

This is a larger task. The SubgroupsTab shows subgroup cards with member/mentor counts and provides create, rename, delete, and assignment actions.

**Step 1: Create SubgroupsTab**

Create `app/(admin)/admin/mentors/components/subgroups-tab.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import {
  Plus,
  Users,
  UserCheck,
  MoreVertical,
  Pencil,
  Trash2,
  Loader2,
  Wand2,
  Shuffle,
} from 'lucide-react';
import type { SubgroupWithDetails } from '../types';
import { AssignStudentsDialog } from './assign-students-dialog';
import { AssignMentorDialog } from './assign-mentor-dialog';

interface SubgroupsTabProps {
  cohortId: string;
  subgroups: SubgroupWithDetails[];
  loading: boolean;
  onRefresh: () => void;
}

export function SubgroupsTab({ cohortId, subgroups, loading, onRefresh }: SubgroupsTabProps) {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showBulkDialog, setShowBulkDialog] = useState(false);
  const [editingSubgroup, setEditingSubgroup] = useState<SubgroupWithDetails | null>(null);
  const [deletingSubgroup, setDeletingSubgroup] = useState<SubgroupWithDetails | null>(null);
  const [assignStudentsSubgroup, setAssignStudentsSubgroup] = useState<SubgroupWithDetails | null>(null);
  const [assignMentorSubgroup, setAssignMentorSubgroup] = useState<SubgroupWithDetails | null>(null);

  const [name, setName] = useState('');
  const [bulkCount, setBulkCount] = useState(6);
  const [bulkPrefix, setBulkPrefix] = useState('Subgroup');
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) { toast.error('Name is required'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/admin/subgroups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), cohort_id: cohortId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create subgroup');
      }
      toast.success('Subgroup created');
      setShowCreateDialog(false);
      setName('');
      onRefresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create');
    } finally { setSaving(false); }
  };

  const handleRename = async () => {
    if (!editingSubgroup || !name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/subgroups/${editingSubgroup.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to rename');
      }
      toast.success('Subgroup renamed');
      setEditingSubgroup(null);
      setName('');
      onRefresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to rename');
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deletingSubgroup) return;
    try {
      const res = await fetch(`/api/admin/subgroups/${deletingSubgroup.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      toast.success('Subgroup deleted');
      setDeletingSubgroup(null);
      onRefresh();
    } catch (error) {
      toast.error('Failed to delete subgroup');
    }
  };

  const handleBulkCreate = async () => {
    if (bulkCount < 1 || bulkCount > 20) { toast.error('Count must be 1-20'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/admin/subgroups/bulk-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cohort_id: cohortId, count: bulkCount, prefix: bulkPrefix }),
      });
      if (!res.ok) throw new Error('Failed to bulk create');
      const data = await res.json();
      toast.success(`Created ${data.created} subgroups`);
      setShowBulkDialog(false);
      onRefresh();
    } catch (error) {
      toast.error('Failed to bulk create subgroups');
    } finally { setSaving(false); }
  };

  const handleAutoAssign = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/subgroups/auto-assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cohort_id: cohortId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to auto-assign');
      }
      const data = await res.json();
      toast.success(`Auto-assigned ${data.assigned} students`);
      onRefresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to auto-assign');
    } finally { setSaving(false); }
  };

  if (!cohortId) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>Select a cohort to manage subgroups</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Actions Row */}
      <div className="flex items-center gap-2">
        <Button onClick={() => { setName(''); setShowCreateDialog(true); }} className="gradient-bg gap-2">
          <Plus className="w-4 h-4" />
          Create Subgroup
        </Button>
        <Button variant="outline" onClick={() => setShowBulkDialog(true)} className="gap-2">
          <Wand2 className="w-4 h-4" />
          Bulk Create
        </Button>
        <Button variant="outline" onClick={handleAutoAssign} disabled={saving} className="gap-2">
          <Shuffle className="w-4 h-4" />
          Auto-Assign Students
        </Button>
        <div className="ml-auto text-sm text-muted-foreground">
          {subgroups.length} subgroup{subgroups.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Subgroup Cards */}
      {loading ? (
        <div className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
      ) : subgroups.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium text-muted-foreground">No subgroups yet</p>
            <p className="text-sm text-muted-foreground">Create subgroups to organize students</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {subgroups.map((sg) => (
            <Card key={sg.id} className="group">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{sg.name}</CardTitle>
                    <CardDescription>
                      {sg.member_count} student{sg.member_count !== 1 ? 's' : ''} &bull; {sg.mentor_count} mentor{sg.mentor_count !== 1 ? 's' : ''}
                    </CardDescription>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setAssignStudentsSubgroup(sg)}>
                        <Users className="w-4 h-4 mr-2" />
                        Assign Students
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setAssignMentorSubgroup(sg)}>
                        <UserCheck className="w-4 h-4 mr-2" />
                        Assign Mentor
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => { setEditingSubgroup(sg); setName(sg.name); }}>
                        <Pencil className="w-4 h-4 mr-2" />
                        Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setDeletingSubgroup(sg)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent>
                {/* Mentor(s) */}
                {sg.mentors.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs font-medium text-muted-foreground mb-1.5">Mentor</p>
                    <div className="flex items-center gap-2">
                      {sg.mentors.map((m) => (
                        <div key={m.user_id} className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={m.user?.avatar_url || ''} />
                            <AvatarFallback className="text-xs">
                              {m.user?.full_name?.charAt(0) || '?'}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm">{m.user?.full_name || m.user?.email}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {/* Student count badge */}
                <div className="flex items-center gap-2">
                  <Badge variant={sg.member_count >= 8 && sg.member_count <= 12 ? 'default' : 'secondary'}>
                    {sg.member_count} / 8-12 students
                  </Badge>
                  {sg.mentor_count === 0 && (
                    <Badge variant="destructive" className="text-xs">No mentor</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Subgroup</DialogTitle>
            <DialogDescription>Add a new subgroup to this cohort</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-2">
            <Label htmlFor="sg-name">Subgroup Name</Label>
            <Input id="sg-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Subgroup Alpha" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving} className="gradient-bg">
              {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating...</> : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={!!editingSubgroup} onOpenChange={(open) => { if (!open) setEditingSubgroup(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Subgroup</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-2">
            <Label>New Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingSubgroup(null)}>Cancel</Button>
            <Button onClick={handleRename} disabled={saving} className="gradient-bg">
              {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</> : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Create Dialog */}
      <Dialog open={showBulkDialog} onOpenChange={setShowBulkDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk Create Subgroups</DialogTitle>
            <DialogDescription>Create multiple subgroups at once</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label>Name Prefix</Label>
              <Input value={bulkPrefix} onChange={(e) => setBulkPrefix(e.target.value)} placeholder="Subgroup" />
            </div>
            <div className="space-y-2">
              <Label>Number of Subgroups</Label>
              <Input type="number" min={1} max={20} value={bulkCount} onChange={(e) => setBulkCount(parseInt(e.target.value) || 1)} />
              <p className="text-xs text-muted-foreground">Will create "{bulkPrefix} 1" through "{bulkPrefix} {bulkCount}"</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkDialog(false)}>Cancel</Button>
            <Button onClick={handleBulkCreate} disabled={saving} className="gradient-bg">
              {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating...</> : `Create ${bulkCount} Subgroups`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingSubgroup} onOpenChange={(open) => { if (!open) setDeletingSubgroup(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Subgroup?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{deletingSubgroup?.name}</strong> and remove all student/mentor assignments. Feedback history will be preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Assign Students Dialog */}
      <AssignStudentsDialog
        cohortId={cohortId}
        subgroup={assignStudentsSubgroup}
        allSubgroups={subgroups}
        open={!!assignStudentsSubgroup}
        onOpenChange={(open) => { if (!open) setAssignStudentsSubgroup(null); }}
        onSaved={onRefresh}
      />

      {/* Assign Mentor Dialog */}
      <AssignMentorDialog
        cohortId={cohortId}
        subgroup={assignMentorSubgroup}
        open={!!assignMentorSubgroup}
        onOpenChange={(open) => { if (!open) setAssignMentorSubgroup(null); }}
        onSaved={onRefresh}
      />
    </div>
  );
}
```

**Step 2: Create AssignStudentsDialog**

Create `app/(admin)/admin/mentors/components/assign-students-dialog.tsx`:

```typescript
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Loader2, Search } from 'lucide-react';
import type { SubgroupWithDetails } from '../types';

interface AssignStudentsDialogProps {
  cohortId: string;
  subgroup: SubgroupWithDetails | null;
  allSubgroups: SubgroupWithDetails[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

interface StudentOption {
  id: string;
  full_name: string | null;
  email: string;
  existingSubgroup?: string;
}

export function AssignStudentsDialog({
  cohortId, subgroup, allSubgroups, open, onOpenChange, onSaved,
}: AssignStudentsDialogProps) {
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && cohortId) fetchStudents();
  }, [open, cohortId]);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      // Fetch students in this cohort via user_role_assignments
      const res = await fetch(`/api/admin/users`);
      if (!res.ok) throw new Error('Failed to fetch users');
      const data = await res.json();

      // Filter to students in this cohort
      const cohortStudents = (data.users || []).filter((u: any) =>
        u.role_assignments?.some((ra: any) => ra.role === 'student' && ra.cohort_id === cohortId)
      );

      // Map existing subgroup assignments
      const assignedMap = new Map<string, string>();
      for (const sg of allSubgroups) {
        for (const m of sg.members) {
          assignedMap.set(m.user_id, sg.name);
        }
      }

      setStudents(cohortStudents.map((u: any) => ({
        id: u.id,
        full_name: u.full_name,
        email: u.email,
        existingSubgroup: assignedMap.get(u.id),
      })));

      // Pre-select students already in this subgroup
      if (subgroup) {
        setSelected(new Set(subgroup.members.map(m => m.user_id)));
      }
    } catch (error) {
      toast.error('Failed to load students');
    } finally { setLoading(false); }
  };

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const handleSave = async () => {
    if (!subgroup) return;
    setSaving(true);
    try {
      // Remove students no longer selected
      const currentIds = new Set(subgroup.members.map(m => m.user_id));
      const toRemove = [...currentIds].filter(id => !selected.has(id));
      const toAdd = [...selected].filter(id => !currentIds.has(id));

      if (toRemove.length > 0) {
        const res = await fetch(`/api/admin/subgroups/${subgroup.id}/members`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_ids: toRemove }),
        });
        if (!res.ok) throw new Error('Failed to remove students');
      }

      if (toAdd.length > 0) {
        const res = await fetch(`/api/admin/subgroups/${subgroup.id}/members`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_ids: toAdd }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Failed to assign students');
        }
      }

      toast.success('Students updated');
      onOpenChange(false);
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update students');
    } finally { setSaving(false); }
  };

  const filtered = students.filter(s =>
    !search || (s.full_name || s.email).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Assign Students to {subgroup?.name}</DialogTitle>
          <DialogDescription>
            Select students to add to this subgroup. {selected.size} selected.
          </DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search students..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex-1 overflow-y-auto max-h-[400px] space-y-1 py-2">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" /></div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">No students found</p>
          ) : (
            filtered.map((s) => {
              const inOtherSubgroup = s.existingSubgroup && s.existingSubgroup !== subgroup?.name;
              return (
                <label
                  key={s.id}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted/50 cursor-pointer"
                >
                  <Checkbox
                    checked={selected.has(s.id)}
                    onCheckedChange={() => toggle(s.id)}
                    disabled={!!inOtherSubgroup}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{s.full_name || s.email}</p>
                    <p className="text-xs text-muted-foreground truncate">{s.email}</p>
                  </div>
                  {inOtherSubgroup && (
                    <Badge variant="secondary" className="text-xs shrink-0">
                      In {s.existingSubgroup}
                    </Badge>
                  )}
                </label>
              );
            })
          )}
        </div>
        <DialogFooter>
          <Badge variant="outline">{selected.size} selected (recommended: 8-12)</Badge>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="gradient-bg">
            {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</> : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 3: Create AssignMentorDialog**

Create `app/(admin)/admin/mentors/components/assign-mentor-dialog.tsx`:

```typescript
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import type { SubgroupWithDetails } from '../types';

interface AssignMentorDialogProps {
  cohortId: string;
  subgroup: SubgroupWithDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

interface MentorOption {
  id: string;
  full_name: string | null;
  email: string;
  avatar_url: string | null;
}

export function AssignMentorDialog({
  cohortId, subgroup, open, onOpenChange, onSaved,
}: AssignMentorDialogProps) {
  const [mentors, setMentors] = useState<MentorOption[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && cohortId) fetchMentors();
  }, [open, cohortId]);

  const fetchMentors = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users`);
      if (!res.ok) throw new Error('Failed to fetch users');
      const data = await res.json();

      // Filter to mentors in this cohort
      const cohortMentors = (data.users || []).filter((u: any) =>
        u.role_assignments?.some((ra: any) => ra.role === 'mentor' && ra.cohort_id === cohortId)
      );

      setMentors(cohortMentors.map((u: any) => ({
        id: u.id,
        full_name: u.full_name,
        email: u.email,
        avatar_url: u.avatar_url,
      })));

      // Pre-select existing mentors
      if (subgroup) {
        setSelected(new Set(subgroup.mentors.map(m => m.user_id)));
      }
    } catch (error) {
      toast.error('Failed to load mentors');
    } finally { setLoading(false); }
  };

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const handleSave = async () => {
    if (!subgroup) return;
    setSaving(true);
    try {
      const currentIds = new Set(subgroup.mentors.map(m => m.user_id));
      const toRemove = [...currentIds].filter(id => !selected.has(id));
      const toAdd = [...selected].filter(id => !currentIds.has(id));

      if (toRemove.length > 0) {
        await fetch(`/api/admin/subgroups/${subgroup.id}/mentors`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_ids: toRemove }),
        });
      }

      if (toAdd.length > 0) {
        const res = await fetch(`/api/admin/subgroups/${subgroup.id}/mentors`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_ids: toAdd }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Failed to assign mentors');
        }
      }

      toast.success('Mentors updated');
      onOpenChange(false);
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update mentors');
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign Mentors to {subgroup?.name}</DialogTitle>
          <DialogDescription>Select mentors for this subgroup (typically 1)</DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-2 max-h-[400px] overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" /></div>
          ) : mentors.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              No mentors found for this cohort. Assign the mentor role first in Users → Edit Roles.
            </p>
          ) : (
            mentors.map((m) => (
              <label key={m.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted/50 cursor-pointer">
                <Checkbox checked={selected.has(m.id)} onCheckedChange={() => toggle(m.id)} />
                <Avatar className="h-8 w-8">
                  <AvatarImage src={m.avatar_url || ''} />
                  <AvatarFallback>{m.full_name?.charAt(0) || '?'}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium">{m.full_name || m.email}</p>
                  <p className="text-xs text-muted-foreground">{m.email}</p>
                </div>
              </label>
            ))
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="gradient-bg">
            {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</> : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 4: Wire SubgroupsTab into page.tsx**

In `app/(admin)/admin/mentors/page.tsx`, replace the placeholder with the real component. Update imports and replace the SubgroupsTab placeholder content.

**Step 5: Verify build**

Run: `npm run build`

**Step 6: Commit**

```bash
git add "app/(admin)/admin/mentors/"
git commit -m "feat(admin): subgroups tab with CRUD, student/mentor assignment, bulk operations"
```

---

## Phase 2: Student View

### Task 9: Build Student "My Subgroup" API Route

**Files:**
- Create: `app/api/subgroups/my-subgroup/route.ts`

**Step 1: Create the route**

```typescript
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// GET - Student's subgroup with mentor + peers
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Find the student's subgroup membership
    const { data: membership } = await supabase
      .from('subgroup_members')
      .select('subgroup_id')
      .eq('user_id', user.id)
      .limit(1)
      .single();

    if (!membership) {
      return NextResponse.json({ data: null }); // Not assigned yet
    }

    // Fetch subgroup details
    const { data: subgroup } = await supabase
      .from('subgroups')
      .select('id, name, cohort_id')
      .eq('id', membership.subgroup_id)
      .single();

    if (!subgroup) {
      return NextResponse.json({ data: null });
    }

    // Fetch cohort name
    const { data: cohort } = await supabase
      .from('cohorts')
      .select('name')
      .eq('id', subgroup.cohort_id)
      .single();

    // Fetch members and mentors in parallel (RLS will filter to own subgroup)
    const [{ data: members }, { data: mentors }] = await Promise.all([
      supabase
        .from('subgroup_members')
        .select('user_id, user:profiles(id, full_name, email, phone, avatar_url, linkedin_url, portfolio_url)')
        .eq('subgroup_id', subgroup.id),
      supabase
        .from('subgroup_mentors')
        .select('user_id, user:profiles(id, full_name, email, phone, avatar_url, linkedin_url, portfolio_url)')
        .eq('subgroup_id', subgroup.id),
    ]);

    return NextResponse.json({
      data: {
        subgroup: { ...subgroup, cohort_name: cohort?.name },
        members: (members || []).filter(m => m.user_id !== user.id), // Exclude self
        mentors: mentors || [],
        current_user_id: user.id,
      },
    });
  } catch (error) {
    console.error('Error fetching my subgroup:', error);
    return NextResponse.json({ error: 'Failed to fetch subgroup' }, { status: 500 });
  }
}
```

**Step 2: Verify build**

Run: `npm run build`

**Step 3: Commit**

```bash
git add app/api/subgroups/
git commit -m "feat(api): student my-subgroup route with RLS"
```

---

### Task 10: Build Student "My Subgroup" Page + Sidebar Item

**Files:**
- Create: `app/(dashboard)/my-subgroup/page.tsx`
- Create: `app/(dashboard)/my-subgroup/loading.tsx`
- Create: `components/ui/profile-detail-sheet.tsx` — reusable profile sheet
- Modify: `components/dashboard/sidebar.tsx` — add "My Subgroup" nav item

**Step 1: Create ProfileDetailSheet (shared component)**

Create `components/ui/profile-detail-sheet.tsx`:

```typescript
'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { ExternalLink, Mail, Phone, Linkedin } from 'lucide-react';
import type { Profile } from '@/types';

interface ProfileDetailSheetProps {
  profile: Pick<Profile, 'id' | 'full_name' | 'email' | 'phone' | 'avatar_url' | 'linkedin_url' | 'portfolio_url'> | null;
  role?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProfileDetailSheet({ profile, role, open, onOpenChange }: ProfileDetailSheetProps) {
  if (!profile) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Profile</SheetTitle>
        </SheetHeader>
        <div className="mt-6 flex flex-col items-center text-center">
          <Avatar className="h-24 w-24 mb-4">
            <AvatarImage src={profile.avatar_url || ''} />
            <AvatarFallback className="gradient-bg text-white text-2xl">
              {profile.full_name?.charAt(0) || profile.email.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <h2 className="text-xl font-bold">{profile.full_name || 'User'}</h2>
          {role && <Badge className="mt-1 capitalize">{role}</Badge>}
        </div>

        <div className="mt-8 space-y-4">
          {profile.email && (
            <div className="flex items-center gap-3">
              <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
              <a href={`mailto:${profile.email}`} className="text-sm hover:underline truncate">
                {profile.email}
              </a>
            </div>
          )}
          {profile.phone && (
            <div className="flex items-center gap-3">
              <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
              <a href={`tel:${profile.phone}`} className="text-sm hover:underline">
                {profile.phone}
              </a>
            </div>
          )}
          {profile.linkedin_url && (
            <div className="flex items-center gap-3">
              <Linkedin className="w-4 h-4 text-muted-foreground shrink-0" />
              <a href={profile.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-sm hover:underline truncate">
                LinkedIn Profile
              </a>
            </div>
          )}
          {profile.portfolio_url && (
            <div className="flex items-center gap-3">
              <ExternalLink className="w-4 h-4 text-muted-foreground shrink-0" />
              <a href={profile.portfolio_url} target="_blank" rel="noopener noreferrer" className="text-sm hover:underline truncate">
                Portfolio
              </a>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

**Step 2: Create the My Subgroup page**

Create `app/(dashboard)/my-subgroup/page.tsx`:

```typescript
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { PageLoader } from '@/components/ui/page-loader';
import { ProfileDetailSheet } from '@/components/ui/profile-detail-sheet';
import { toast } from 'sonner';
import { Users, UserCheck } from 'lucide-react';
import type { Profile } from '@/types';

interface SubgroupData {
  subgroup: { id: string; name: string; cohort_id: string; cohort_name: string };
  members: { user_id: string; user: Profile }[];
  mentors: { user_id: string; user: Profile }[];
  current_user_id: string;
}

export default function MySubgroupPage() {
  const [data, setData] = useState<SubgroupData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>('');

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/subgroups/my-subgroup');
      if (!res.ok) throw new Error('Failed to fetch');
      const result = await res.json();
      setData(result.data);
    } catch (error) {
      toast.error('Failed to load subgroup data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return <PageLoader message="Loading your subgroup..." />;

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Users className="w-16 h-16 mb-4 text-muted-foreground/50" />
        <h2 className="text-xl font-semibold mb-2">No Subgroup Assigned</h2>
        <p className="text-muted-foreground max-w-md">
          You haven't been assigned to a subgroup yet. Your admin will assign you soon.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">{data.subgroup.name}</h1>
        <p className="text-muted-foreground">{data.subgroup.cohort_name}</p>
      </div>

      {/* Mentor Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <UserCheck className="w-5 h-5" />
            Mentor{data.mentors.length !== 1 ? 's' : ''}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.mentors.length === 0 ? (
            <p className="text-muted-foreground text-sm">A mentor will be assigned soon.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {data.mentors.map((m) => (
                <button
                  key={m.user_id}
                  onClick={() => { setSelectedProfile(m.user); setSelectedRole('Mentor'); }}
                  className="flex items-center gap-3 p-3 rounded-xl border hover:bg-muted/50 transition-colors text-left w-full"
                >
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={m.user.avatar_url || ''} />
                    <AvatarFallback className="gradient-bg text-white">
                      {m.user.full_name?.charAt(0) || '?'}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold">{m.user.full_name || m.user.email}</p>
                    <Badge variant="secondary" className="text-xs mt-0.5">Mentor</Badge>
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Students Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="w-5 h-5" />
            Subgroup Members ({data.members.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.members.length === 0 ? (
            <p className="text-muted-foreground text-sm">No other members in your subgroup yet.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.members.map((m) => (
                <button
                  key={m.user_id}
                  onClick={() => { setSelectedProfile(m.user); setSelectedRole('Student'); }}
                  className="flex items-center gap-3 p-3 rounded-xl border hover:bg-muted/50 transition-colors text-left w-full"
                >
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={m.user.avatar_url || ''} />
                    <AvatarFallback>
                      {m.user.full_name?.charAt(0) || '?'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{m.user.full_name || m.user.email}</p>
                    <p className="text-xs text-muted-foreground truncate">{m.user.email}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Profile Detail Sheet */}
      <ProfileDetailSheet
        profile={selectedProfile}
        role={selectedRole}
        open={!!selectedProfile}
        onOpenChange={(open) => { if (!open) setSelectedProfile(null); }}
      />
    </div>
  );
}
```

**Step 3: Create loading skeleton**

Create `app/(dashboard)/my-subgroup/loading.tsx`:

```typescript
import { PageLoader } from '@/components/ui/page-loader';

export default function Loading() {
  return <PageLoader message="Loading your subgroup..." />;
}
```

**Step 4: Add sidebar item**

In `components/dashboard/sidebar.tsx`, add to `navItems` array (after the Resources item at line 44):

```typescript
  { label: 'My Subgroup', href: '/my-subgroup', icon: Users },
```

Note: This uses the existing `Users` icon. Since this should be visible to all students (not role-gated), no `roles` field is needed.

**Step 5: Verify build**

Run: `npm run build`

**Step 6: Commit**

```bash
git add "app/(dashboard)/my-subgroup/" components/ui/profile-detail-sheet.tsx components/dashboard/sidebar.tsx
git commit -m "feat(student): My Subgroup page with mentor/peer profiles"
```

---

## Phase 3: Feedback System (Mentor + Student)

### Task 11: Build Feedback API Routes

**Files:**
- Create: `app/api/feedback/mentor/route.ts` — mentor gives feedback (GET + POST)
- Create: `app/api/feedback/mentor/[id]/route.ts` — edit feedback (PUT)
- Create: `app/api/feedback/student/route.ts` — student gives feedback (GET + POST)
- Create: `app/api/feedback/student/[id]/route.ts` — edit feedback (PUT)

These routes use `createClient()` (not admin) since they rely on RLS policies.

**Step 1: Create mentor feedback route**

Create `app/api/feedback/mentor/route.ts`:

```typescript
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET - List feedback given by the current mentor
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('student_id');
    const type = searchParams.get('type');
    const subgroupId = searchParams.get('subgroup_id');

    let query = supabase
      .from('mentor_feedback')
      .select('*, student:profiles!mentor_feedback_student_id_fkey(id, full_name, email, avatar_url), subgroup:subgroups(id, name)')
      .eq('mentor_id', user.id)
      .order('feedback_date', { ascending: false });

    if (studentId) query = query.eq('student_id', studentId);
    if (type) query = query.eq('type', type);
    if (subgroupId) query = query.eq('subgroup_id', subgroupId);

    const { data, error } = await query.limit(100);
    if (error) throw error;

    return NextResponse.json({ data: data || [] });
  } catch (error) {
    console.error('Error fetching mentor feedback:', error);
    return NextResponse.json({ error: 'Failed to fetch feedback' }, { status: 500 });
  }
}

// POST - Submit daily/weekly feedback
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { student_id, subgroup_id, type, rating, comment, week_number } = body;

    if (!student_id || !subgroup_id || !type || !rating) {
      return NextResponse.json({ error: 'student_id, subgroup_id, type, and rating are required' }, { status: 400 });
    }

    if (rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'Rating must be 1-5' }, { status: 400 });
    }

    if (!['daily', 'weekly'].includes(type)) {
      return NextResponse.json({ error: 'Type must be daily or weekly' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('mentor_feedback')
      .upsert({
        mentor_id: user.id,
        student_id,
        subgroup_id,
        type,
        rating,
        comment: comment || null,
        week_number: week_number || null,
        feedback_date: new Date().toISOString().split('T')[0],
      }, {
        onConflict: 'mentor_id,student_id,type,feedback_date',
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    console.error('Error submitting mentor feedback:', error);
    return NextResponse.json({ error: 'Failed to submit feedback' }, { status: 500 });
  }
}
```

**Step 2: Create mentor feedback edit route**

Create `app/api/feedback/mentor/[id]/route.ts`:

```typescript
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// PUT - Edit mentor feedback
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const body = await request.json();
    const { rating, comment } = body;

    if (rating !== undefined && (rating < 1 || rating > 5)) {
      return NextResponse.json({ error: 'Rating must be 1-5' }, { status: 400 });
    }

    const updateData: Record<string, any> = {};
    if (rating !== undefined) updateData.rating = rating;
    if (comment !== undefined) updateData.comment = comment || null;

    const { data, error } = await supabase
      .from('mentor_feedback')
      .update(updateData)
      .eq('id', id)
      .eq('mentor_id', user.id) // RLS + explicit check
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error updating mentor feedback:', error);
    return NextResponse.json({ error: 'Failed to update feedback' }, { status: 500 });
  }
}
```

**Step 3: Create student feedback routes** (same pattern, with `student_id`, `target_type`, `target_id`)

Create `app/api/feedback/student/route.ts`:

```typescript
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET - List feedback given by the current student
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const targetType = searchParams.get('target_type');

    let query = supabase
      .from('student_feedback')
      .select('*')
      .eq('student_id', user.id)
      .order('created_at', { ascending: false });

    if (targetType) query = query.eq('target_type', targetType);

    const { data, error } = await query.limit(100);
    if (error) throw error;

    return NextResponse.json({ data: data || [] });
  } catch (error) {
    console.error('Error fetching student feedback:', error);
    return NextResponse.json({ error: 'Failed to fetch feedback' }, { status: 500 });
  }
}

// POST - Submit mentor/session feedback
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { target_type, target_id, rating, comment, week_number } = body;

    if (!target_type || !target_id || !rating) {
      return NextResponse.json({ error: 'target_type, target_id, and rating are required' }, { status: 400 });
    }

    if (rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'Rating must be 1-5' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('student_feedback')
      .upsert({
        student_id: user.id,
        target_type,
        target_id,
        rating,
        comment: comment || null,
        week_number: week_number || null,
      }, {
        onConflict: 'student_id,target_type,target_id,week_number',
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    console.error('Error submitting student feedback:', error);
    return NextResponse.json({ error: 'Failed to submit feedback' }, { status: 500 });
  }
}
```

Create `app/api/feedback/student/[id]/route.ts`:

```typescript
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const body = await request.json();
    const { rating, comment } = body;

    if (rating !== undefined && (rating < 1 || rating > 5)) {
      return NextResponse.json({ error: 'Rating must be 1-5' }, { status: 400 });
    }

    const updateData: Record<string, any> = {};
    if (rating !== undefined) updateData.rating = rating;
    if (comment !== undefined) updateData.comment = comment || null;

    const { data, error } = await supabase
      .from('student_feedback')
      .update(updateData)
      .eq('id', id)
      .eq('student_id', user.id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error updating student feedback:', error);
    return NextResponse.json({ error: 'Failed to update feedback' }, { status: 500 });
  }
}
```

**Step 4: Verify build**

Run: `npm run build`

**Step 5: Commit**

```bash
git add app/api/feedback/
git commit -m "feat(api): mentor and student feedback routes with RLS"
```

---

### Task 12: Build RatingStars Shared Component

**Files:**
- Create: `components/ui/rating-stars.tsx`

**Step 1: Create the component**

```typescript
'use client';

import { useState } from 'react';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RatingStarsProps {
  value: number;
  onChange?: (value: number) => void;
  readonly?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const sizeMap = { sm: 'w-4 h-4', md: 'w-5 h-5', lg: 'w-6 h-6' };

export function RatingStars({ value, onChange, readonly = false, size = 'md' }: RatingStarsProps) {
  const [hover, setHover] = useState(0);

  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          className={cn(
            'transition-colors',
            readonly ? 'cursor-default' : 'cursor-pointer hover:scale-110'
          )}
          onClick={() => onChange?.(star)}
          onMouseEnter={() => !readonly && setHover(star)}
          onMouseLeave={() => !readonly && setHover(0)}
        >
          <Star
            className={cn(
              sizeMap[size],
              (hover || value) >= star
                ? 'fill-yellow-400 text-yellow-400'
                : 'text-gray-300 dark:text-gray-600'
            )}
          />
        </button>
      ))}
    </div>
  );
}
```

**Step 2: Verify build, commit**

```bash
git add components/ui/rating-stars.tsx
git commit -m "feat(ui): RatingStars interactive component"
```

---

### Task 13: Build Mentor Subgroups API Route

**Files:**
- Create: `app/api/subgroups/mentor-subgroups/route.ts`

This powers the mentor's dashboard view.

```typescript
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Fetch subgroups where this user is a mentor (RLS handles access)
    const { data: mentorAssignments } = await supabase
      .from('subgroup_mentors')
      .select('subgroup_id')
      .eq('user_id', user.id);

    if (!mentorAssignments || mentorAssignments.length === 0) {
      return NextResponse.json({ data: [] });
    }

    const subgroupIds = mentorAssignments.map(a => a.subgroup_id);

    // Fetch subgroups with cohort info
    const { data: subgroups } = await supabase
      .from('subgroups')
      .select('id, name, cohort_id')
      .in('id', subgroupIds);

    // Batch fetch members
    const { data: members } = await supabase
      .from('subgroup_members')
      .select('subgroup_id, user_id, user:profiles(id, full_name, email, avatar_url)')
      .in('subgroup_id', subgroupIds);

    // Group members by subgroup
    const memberMap = new Map<string, any[]>();
    for (const m of members || []) {
      const list = memberMap.get(m.subgroup_id) || [];
      list.push(m);
      memberMap.set(m.subgroup_id, list);
    }

    const result = (subgroups || []).map(sg => ({
      ...sg,
      members: memberMap.get(sg.id) || [],
      member_count: (memberMap.get(sg.id) || []).length,
    }));

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error('Error fetching mentor subgroups:', error);
    return NextResponse.json({ error: 'Failed to fetch subgroups' }, { status: 500 });
  }
}
```

**Verify build + commit:**

```bash
git add app/api/subgroups/mentor-subgroups/
git commit -m "feat(api): mentor subgroups route"
```

---

### Task 14: Build Feedback Aggregates API Route

**Files:**
- Create: `app/api/feedback/mentor-ratings/route.ts`
- Create: `app/api/feedback/student-ratings/route.ts`

These return computed averages for the mentor and student dashboards.

**Create `app/api/feedback/mentor-ratings/route.ts`:**

```typescript
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET - Aggregate ratings for a mentor (visible to mentor themselves + admin)
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Fetch all student feedback targeting this mentor
    const { data: feedback } = await supabase
      .from('student_feedback')
      .select('rating, week_number, student_id')
      .eq('target_type', 'mentor')
      .eq('target_id', user.id);

    if (!feedback || feedback.length === 0) {
      return NextResponse.json({ data: { average_rating: 0, total_count: 0, by_week: [] } });
    }

    const total = feedback.reduce((sum, f) => sum + f.rating, 0);
    const average = total / feedback.length;

    // Group by week
    const weekMap = new Map<number, { sum: number; count: number }>();
    for (const f of feedback) {
      if (f.week_number != null) {
        const w = weekMap.get(f.week_number) || { sum: 0, count: 0 };
        w.sum += f.rating;
        w.count++;
        weekMap.set(f.week_number, w);
      }
    }

    const byWeek = [...weekMap.entries()]
      .map(([week_number, { sum, count }]) => ({
        week_number,
        average_rating: Math.round((sum / count) * 10) / 10,
        count,
      }))
      .sort((a, b) => a.week_number - b.week_number);

    return NextResponse.json({
      data: {
        average_rating: Math.round(average * 10) / 10,
        total_count: feedback.length,
        by_week: byWeek,
      },
    });
  } catch (error) {
    console.error('Error fetching mentor ratings:', error);
    return NextResponse.json({ error: 'Failed to fetch ratings' }, { status: 500 });
  }
}
```

**Create `app/api/feedback/student-ratings/route.ts`:**

```typescript
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET - Aggregate ratings received by a student from mentors
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: feedback } = await supabase
      .from('mentor_feedback')
      .select('rating, week_number, type')
      .eq('student_id', user.id);

    if (!feedback || feedback.length === 0) {
      return NextResponse.json({ data: { average_rating: 0, total_count: 0, by_week: [] } });
    }

    const total = feedback.reduce((sum, f) => sum + f.rating, 0);
    const average = total / feedback.length;

    const weekMap = new Map<number, { sum: number; count: number }>();
    for (const f of feedback) {
      if (f.week_number != null) {
        const w = weekMap.get(f.week_number) || { sum: 0, count: 0 };
        w.sum += f.rating;
        w.count++;
        weekMap.set(f.week_number, w);
      }
    }

    const byWeek = [...weekMap.entries()]
      .map(([week_number, { sum, count }]) => ({
        week_number,
        average_rating: Math.round((sum / count) * 10) / 10,
        count,
      }))
      .sort((a, b) => a.week_number - b.week_number);

    return NextResponse.json({
      data: {
        average_rating: Math.round(average * 10) / 10,
        total_count: feedback.length,
        by_week: byWeek,
      },
    });
  } catch (error) {
    console.error('Error fetching student ratings:', error);
    return NextResponse.json({ error: 'Failed to fetch ratings' }, { status: 500 });
  }
}
```

**Verify build + commit:**

```bash
git add app/api/feedback/
git commit -m "feat(api): feedback aggregate routes for mentor and student ratings"
```

---

## Phase 4: Admin Feedback Overview + Polish

### Task 15: Build Admin Feedback API Route

**Files:**
- Create: `app/api/admin/feedback/route.ts`

```typescript
import { createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/api/verify-admin';

export async function GET(request: NextRequest) {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { searchParams } = new URL(request.url);
    const cohortId = searchParams.get('cohort_id');
    const type = searchParams.get('type'); // 'mentor_to_student' or 'student_to_mentor'

    const adminClient = await createAdminClient();

    if (type === 'student_to_mentor') {
      let query = adminClient
        .from('student_feedback')
        .select('*, student:profiles!student_feedback_student_id_fkey(id, full_name, email)')
        .eq('target_type', 'mentor')
        .order('created_at', { ascending: false })
        .limit(200);

      const { data, error } = await query;
      if (error) throw error;

      return NextResponse.json({ data: data || [] });
    }

    // Default: mentor_to_student feedback
    let query = adminClient
      .from('mentor_feedback')
      .select('*, mentor:profiles!mentor_feedback_mentor_id_fkey(id, full_name, email), student:profiles!mentor_feedback_student_id_fkey(id, full_name, email), subgroup:subgroups(id, name, cohort_id)')
      .order('feedback_date', { ascending: false })
      .limit(200);

    const { data, error } = await query;
    if (error) throw error;

    // Filter by cohort if specified
    let filtered = data || [];
    if (cohortId) {
      filtered = filtered.filter((f: any) => f.subgroup?.cohort_id === cohortId);
    }

    return NextResponse.json({ data: filtered });
  } catch (error) {
    console.error('Error fetching admin feedback:', error);
    return NextResponse.json({ error: 'Failed to fetch feedback' }, { status: 500 });
  }
}
```

**Verify build + commit:**

```bash
git add app/api/admin/feedback/
git commit -m "feat(api): admin feedback overview route"
```

---

### Task 16: Build Admin FeedbackOverviewTab Component

**Files:**
- Create: `app/(admin)/admin/mentors/components/feedback-overview-tab.tsx`
- Modify: `app/(admin)/admin/mentors/page.tsx` — wire up the tab

This component shows tables of mentor→student and student→mentor feedback with filtering.

**Implementation:** Follow the same pattern as `logs-tab.tsx` in notifications — table with filters, date columns, rating display.

**Step 1: Create the component, Step 2: Wire into page, Step 3: Build + commit.**

```bash
git commit -m "feat(admin): feedback overview tab with mentor/student tables"
```

---

### Task 17: Add Mentor Sidebar Items for Dashboard

**Files:**
- Modify: `components/dashboard/sidebar.tsx` — add mentor-specific nav items

Add these items to `navItems` (with `roles: ['mentor']`):

```typescript
  { label: 'My Subgroups', href: '/mentor/subgroups', icon: Users, roles: ['mentor'] },
  { label: 'Give Feedback', href: '/mentor/feedback', icon: MessageSquare, roles: ['mentor'] },
```

Also import `MessageSquare` from lucide-react.

**Commit:**

```bash
git commit -m "feat(sidebar): mentor-specific nav items"
```

---

### Task 18: Build Mentor Dashboard Pages

**Files:**
- Create: `app/(dashboard)/mentor/subgroups/page.tsx` — view assigned subgroups + students
- Create: `app/(dashboard)/mentor/feedback/page.tsx` — give + view feedback

These pages use `useUserContext()` to verify `activeRole === 'mentor'`, fetch from `/api/subgroups/mentor-subgroups` and `/api/feedback/mentor`, and use `RatingStars` and `ProfileDetailSheet` components.

**Commit:**

```bash
git commit -m "feat(mentor): subgroups and feedback pages"
```

---

## Verification Protocol (After Each Phase)

1. `npm run build` → 0 TypeScript errors
2. `npm run lint` → no new lint errors
3. **Phase 1 check:** Admin can create subgroups, assign students/mentors, bulk create, auto-assign
4. **Phase 2 check:** Student sees "My Subgroup" with mentor and peers, can click profiles
5. **Phase 3 check:** Mentor can give daily/weekly feedback, student can give weekly mentor feedback
6. **Phase 4 check:** Admin sees all feedback in overview tab, mentor sees ratings received

---

## Files Summary

### New Files (37)
```
supabase/migrations/017_subgroups_and_feedback.sql
types/index.ts (modified — added ~60 lines)
app/api/admin/subgroups/route.ts
app/api/admin/subgroups/[id]/route.ts
app/api/admin/subgroups/[id]/members/route.ts
app/api/admin/subgroups/[id]/mentors/route.ts
app/api/admin/subgroups/bulk-create/route.ts
app/api/admin/subgroups/auto-assign/route.ts
app/api/admin/feedback/route.ts
app/api/subgroups/my-subgroup/route.ts
app/api/subgroups/mentor-subgroups/route.ts
app/api/feedback/mentor/route.ts
app/api/feedback/mentor/[id]/route.ts
app/api/feedback/student/route.ts
app/api/feedback/student/[id]/route.ts
app/api/feedback/mentor-ratings/route.ts
app/api/feedback/student-ratings/route.ts
app/(admin)/admin/mentors/page.tsx
app/(admin)/admin/mentors/loading.tsx
app/(admin)/admin/mentors/types.ts
app/(admin)/admin/mentors/components/subgroups-tab.tsx
app/(admin)/admin/mentors/components/feedback-overview-tab.tsx
app/(admin)/admin/mentors/components/assign-students-dialog.tsx
app/(admin)/admin/mentors/components/assign-mentor-dialog.tsx
app/(dashboard)/my-subgroup/page.tsx
app/(dashboard)/my-subgroup/loading.tsx
app/(dashboard)/mentor/subgroups/page.tsx
app/(dashboard)/mentor/feedback/page.tsx
components/ui/profile-detail-sheet.tsx
components/ui/rating-stars.tsx
```

### Existing Files Modified (4)
```
types/index.ts — add subgroup + feedback types
app/(admin)/layout.tsx — add Mentors sidebar item
components/dashboard/sidebar.tsx — add My Subgroup + mentor nav items
app/api/admin/users/route.ts — add same-cohort validation
app/(admin)/admin/users/components/edit-roles-dialog.tsx — add frontend validation
```
