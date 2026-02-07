# Case Study PDF Upload + Smart PDF Compression

**Date**: 2026-02-07
**Status**: Design Complete — Ready for Implementation
**Model**: Opus 4.6

---

## Overview

Two features for the Rethink Dashboard learnings module:

1. **Case Study PDF Upload + Multi-Solution Support** — Replace Google Docs URL inputs with direct PDF upload. Support multiple solution PDFs per case study, optionally tagged to subgroups.
2. **Smart PDF Compression** — Client-side 3-tier compression pipeline applied globally to all PDF uploads. Quality-first: never serve a degraded PDF.

---

## Feature 1: Case Study PDF Upload + Multi-Solution

### Data Model

**Migration: `018_case_study_pdf_solutions.sql`**

```sql
-- Remove Google Docs URL columns
ALTER TABLE case_studies
  DROP COLUMN IF EXISTS problem_doc_id,
  DROP COLUMN IF EXISTS problem_doc_url,
  DROP COLUMN IF EXISTS solution_doc_id,
  DROP COLUMN IF EXISTS solution_doc_url;

-- Add PDF file storage columns for problem document
ALTER TABLE case_studies
  ADD COLUMN problem_file_path TEXT,
  ADD COLUMN problem_file_size BIGINT;

-- New table: multiple solutions per case study
CREATE TABLE case_study_solutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_study_id UUID REFERENCES case_studies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  subgroup_id UUID REFERENCES subgroups(id) ON DELETE SET NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT,
  order_index INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_css_case_study ON case_study_solutions(case_study_id);
CREATE INDEX idx_css_subgroup ON case_study_solutions(subgroup_id);
```

**Key decisions:**
- `solution_visible` stays on `case_studies` — controls ALL solutions at once
- `subgroup_id` nullable — NULL = "general" (no subgroup tag)
- `ON DELETE SET NULL` for subgroup — solution survives subgroup deletion as general
- Old URL columns fully dropped

### TypeScript Interface

```typescript
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
}

export interface CaseStudySolution {
  id: string;
  case_study_id: string;
  title: string;
  subgroup_id: string | null;
  subgroup_name?: string;          // Joined from subgroups table
  file_path: string;
  file_size: number | null;
  order_index: number;
  created_at: string;
}
```

### API Routes

**Modified:**
- `POST /api/admin/case-studies` — Accepts `problem_file_path`, `problem_file_size` instead of URLs
- `PUT /api/admin/case-studies/[id]` — Same, for editing

**New:**
- `POST /api/admin/case-studies/[id]/solutions` — Create solution (title, file_path, file_size, subgroup_id)
- `PATCH /api/admin/case-studies/[id]/solutions/[solutionId]` — Update title or subgroup tag
- `DELETE /api/admin/case-studies/[id]/solutions/[solutionId]` — Remove solution + storage cleanup
- `GET /api/case-studies/[id]/signed-url?type=problem` — Student signed URL for problem PDF
- `GET /api/case-studies/[id]/signed-url?type=solution&solutionId=xxx` — Student signed URL for solution PDF

**Storage path structure:**
```
resources/
  case-studies/
    {cohortId}/
      {caseStudyId}/
        problem_{timestamp}.pdf
        solutions/
          {solutionId}_{timestamp}.pdf
```

### Admin UI (Form Dialog)

**Problem PDF:**
- File drop zone replacing URL text input
- Single PDF upload with progress bar
- Shows filename + size after upload
- Remove/replace button

**Solution PDFs:**
- Multi-file drop zone
- Each uploaded file shows in a list:
  - Filename + size
  - Editable title (defaults to filename)
  - Subgroup dropdown (hidden if no subgroups for this cohort)
  - Remove button
- All default to "General" (no subgroup)
- Admin tags with subgroups after upload

### Student Dashboard View

**4 states for consistent UI:**

1. **Problem only (no solutions uploaded)**
   - Card: Title + Description + Due date + "View Problem" button
   - No solutions section at all

2. **Problem + solutions hidden (`solution_visible = false`)**
   - Same as State 1 + muted "Solutions will be available soon" text

3. **Problem + single solution visible**
   - "View Problem" button + "View Solution" button (no tabs for single solution)

4. **Problem + multiple solutions visible**
   - "View Problem" button
   - Divider
   - Tab bar: each tab labeled with solution title (includes subgroup name if tagged)
   - Click tab → opens PDF in full-screen modal viewer

**Rule: 1 solution = button, 2+ solutions = tabs, 0 solutions = nothing**

---

## Feature 2: Smart PDF Compression

### Scope

**GLOBAL** — Applied wherever PDFs are uploaded across the codebase.
**SCOPED CHANGES** — Case study modifications ONLY affect the Case Studies submodule within the Learnings tab. Rest of Learnings tab (recordings, slides, notes) is untouched.

### Architecture

**Shared utility: `lib/utils/compress-pdf.ts`**

Input: `File` (original PDF)
Output: `File` (optimized PDF, or original if no meaningful savings)

Runs in a **Web Worker** so UI stays responsive. Shows "Optimizing PDF..." during processing.

### Smart Size-Based Logic

Compression tiers applied based on file size — small files skip entirely:

| File Size | Action |
|-----------|--------|
| < 1 MB | **Skip entirely** — no compression, upload as-is. Overhead not worth it. |
| 1-5 MB | **Tier 1 only** — Lossless structural optimization. Safe, fast. |
| 5-20 MB | **Tier 1 + Tier 2** — Structural + image DPI downsampling. |
| > 20 MB | **All 3 tiers** — Structural + DPI downsampling + JPEG re-encoding. |

### 3-Tier Pipeline

**Tier 1 — Lossless Structural (always safe)**
- Strip metadata (author, creator, timestamps)
- Remove duplicate embedded fonts/objects
- Compress internal streams with deflate
- Risk: Zero
- Expected savings: 3-10%

**Tier 2 — Smart Image Downsampling**
- Scan each embedded image for its DPI
- Only downsample images above 200 DPI → resample to 150 DPI
- Images at ≤200 DPI left untouched
- 150 DPI is standard for on-screen PDF viewing
- Risk: Negligible (screen viewing only)
- Expected savings: 30-50% on image-heavy PDFs

**Tier 3 — JPEG Re-encoding (conservative)**
- Only JPEG images (not PNGs with transparency)
- Re-encode at quality 90
- Per-image check: if re-encoded image not 15% smaller, keep original
- Risk: Minimal (quality 90 is visually identical to 95-100)
- Expected savings: additional 10-25%

### Quality Gate

```
if (compressedSize >= originalSize * 0.90) {
  return originalFile;  // Less than 10% savings — not worth it
}
return compressedFile;
```

### Integration Points

Applied to every PDF upload in the codebase:
1. `resource-form-dialog.tsx` — module resource uploads (slides, notes, documents)
2. `case-study-form-dialog.tsx` — problem + solution PDF uploads (new)
3. `admin/resources/page.tsx` — bulk PDF uploads in resources tab

### What's NOT Touched
- Already-uploaded files in Supabase Storage
- Signed URL generation logic
- PDF viewer / modal rendering
- Recordings / video flow (no PDFs)

---

## File Map

### New Files
| File | Purpose |
|------|---------|
| `lib/utils/compress-pdf.ts` | 3-tier compression pipeline |
| `lib/utils/compress-pdf.worker.ts` | Web Worker for background processing |
| `supabase/migrations/018_case_study_pdf_solutions.sql` | Schema migration |
| `app/api/admin/case-studies/[id]/solutions/route.ts` | Solution CRUD |
| `app/api/case-studies/[id]/signed-url/route.ts` | Student PDF access |

### Modified Files
| File | Change |
|------|--------|
| `case-study-form-dialog.tsx` | Replace URL inputs with PDF upload zones + solution management |
| `admin/learnings/page.tsx` | Wire up new form, handle solutions |
| `(dashboard)/learnings/page.tsx` | Tabbed solutions view with 4 states |
| `resource-form-dialog.tsx` | Add compression before existing upload |
| `admin/resources/page.tsx` | Add compression before bulk PDF upload |
| `types/index.ts` | New CaseStudySolution interface, update CaseStudy |
| `api/admin/case-studies/route.ts` | Remove URL extraction, accept file paths |

---

## Implementation Order

1. Database migration (schema changes)
2. Compression utility (shared, testable independently)
3. Case study API routes (solutions CRUD + signed URLs)
4. Admin form dialog (upload UI)
5. Student dashboard view (tabbed solutions)
6. Integrate compression into existing upload flows
7. Build verification + code review
8. Deploy

---

## Constraints

- **Opus 4.6** for all implementation and code review
- **Case study changes scoped to Case Studies submodule only** — rest of Learnings tab (recordings, slides, notes) untouched
- **PDF compression is global** — applied wherever PDFs are uploaded (learnings, resources, case studies)
- **Smart size logic** — skip compression for files < 1MB, progressive tiers based on size
- **Quality-first compression** — never serve a degraded PDF
- **Don't touch existing uploaded files** — compression applies to new uploads only
- **Backward compatible** — existing module resource uploads unchanged
- **Full code review** before every commit
