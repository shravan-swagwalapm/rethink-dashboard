# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Last Updated**: 2026-02-06 (Post-Refactor — Layers 0-4 Complete)
**Project**: Rethink Dashboard (Educational Platform)

---

## 🏗️ ARCHITECTURE OVERVIEW

### High-Level System Design

**Rethink Dashboard** is an educational platform supporting cohort-based learning with multi-role users (students, mentors, admins). Built on Next.js 16 App Router with Supabase backend.

**Key Architectural Decisions**:
- **Server Components by default** for optimal performance
- **Multi-channel authentication**: Phone OTP (MSG91) + Google OAuth
- **Multi-role system**: Users can have multiple roles across different cohorts
- **Strict admin access control**: `/admin` only via explicit login, no UI shortcuts
- **Role-based dashboard views**: Single `/dashboard` route shows different data based on active role

---

## 🚀 DEVELOPMENT COMMANDS

### Common Commands

```bash
# Development
npm run dev          # Start dev server at http://localhost:3000

# Build & Production
npm run build        # Production build (required before deploy)
npm run start        # Run production server locally

# Code Quality
npm run lint         # Run ESLint

# Testing (Playwright)
npx playwright test                    # Run all E2E tests
npx playwright test --ui              # Interactive UI mode
npx playwright test --headed          # Run with browser visible
npx playwright test tests/auth.spec.ts # Run single test file
npx playwright show-report            # View test results
```

### Environment Setup

Required environment variables (see `.env.local.example`):

```env
# Supabase (Database + Auth)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=        # Server-side only, never expose

# MSG91 (OTP/SMS)
MSG91_AUTH_KEY=
MSG91_TEMPLATE_ID=                # Must be pre-approved
MSG91_SENDER_ID=NAUM

# OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Email
RESEND_API_KEY=

# App
NEXT_PUBLIC_APP_URL=              # Production URL
```

---

## 📁 PROJECT STRUCTURE

### App Router Organization (Route Groups)

```
app/
├── (auth)/                       # Public routes
│   └── login/                   # OTP + Google OAuth login
│
├── (dashboard)/                 # Student/Mentor portal (protected)
│   ├── dashboard/              # Multi-role dashboard (student/admin/mentor views)
│   ├── learnings/              # Course modules
│   ├── resources/              # Videos & documents
│   ├── sessions/               # Class schedule
│   ├── invoices/               # Payments
│   ├── profile/                # User settings
│   ├── team/                   # Mentor-only: assigned students
│   ├── attendance/             # Mentor-only: attendance tracking
│   └── layout.tsx              # Sidebar layout
│
├── (admin)/admin/              # Admin panel (protected, admin-only)
│   ├── users/                  # User management + bulk import
│   ├── cohorts/                # Cohort management + module linking
│   ├── sessions/               # Session scheduling
│   ├── invoices/               # Invoice management
│   ├── notifications/          # SMS/email campaigns
│   ├── learnings/              # Module management
│   └── analytics/              # System analytics
│
├── api/                        # Server-side API routes
│   ├── auth/otp/              # OTP send/verify/resend
│   ├── admin/                 # Admin operations
│   ├── resources/             # Content APIs
│   └── attendance/webhook/    # Zoom webhook
│
└── auth/callback/             # OAuth handlers
    ├── route.ts               # Student callback
    └── admin/route.ts         # Admin callback
```

### Core Directories

```
components/
├── ui/                        # 48 Radix UI components (shadcn/ui pattern)
└── [feature]/                 # Feature-specific components

lib/
├── api/                       # Shared API utilities (added in refactor)
│   ├── verify-admin.ts       # Shared admin auth verification (used by all 26 admin routes)
│   ├── responses.ts          # Standardized successResponse/errorResponse helpers
│   └── sanitize.ts           # Input sanitization for PostgREST filters
├── env.ts                     # Zod-validated environment variables
├── supabase/                  # Database clients (server, client, middleware)
├── integrations/              # External APIs (MSG91, Resend)
├── services/                  # Business logic
│   ├── otp-rate-limiter.ts   # OTP rate limiting
│   └── calendar-helpers.ts   # Google Calendar integration helpers
├── utils/                     # Helpers (phone formatting, date handling)
│   └── currency.ts           # Shared formatCurrency (INR)
└── validations/               # Zod schemas (future use)

contexts/
└── user-context.tsx           # UserProvider — single API call per page load

hooks/
├── use-user.ts               # Central auth state (wrapped by UserContext)
└── use-notifications.ts      # Real-time notifications

types/
└── database.types.ts         # Supabase generated types
```

---

## 🔐 AUTHENTICATION SYSTEM

### Multi-Channel Auth Flow

**Phone OTP (Primary for Students)**:
1. User enters phone number on `/login`
2. 4-digit OTP sent via MSG91 SMS
3. OTP stored in `otp_codes` table with 5-minute expiry
4. After verification: Supabase session created via `admin.generateLink()`
5. Rate limited: 5 requests per 15 minutes per phone

**Google OAuth**:
- Student login → redirects to `/dashboard`
- Admin login → redirects to `/admin` (only if admin role verified)
- Email domain whitelist enforced

**Critical Auth Files**:
- `/middleware.ts` - Request-level auth guard (uses `isAdminRole()` from shared auth)
- `/lib/api/verify-admin.ts` - Shared admin verification for all API routes
- `/lib/supabase/server.ts` - SSR-safe Supabase client + admin client
- `/contexts/user-context.tsx` - UserProvider (single API call per page load)
- `/hooks/use-user.ts` - Client-side auth state management (wrapped by UserContext)
- `/lib/services/otp-rate-limiter.ts` - Rate limiting logic (fail-closed)
- `/lib/integrations/msg91-otp.ts` - SMS OTP integration

### Admin Access Control Pattern

**CRITICAL**: `/admin` route is ONLY accessible via explicit "Sign in as Administrator" login:
- NO navigation links to `/admin` from dashboard
- NO convenience buttons in header/sidebar
- Admin users can view system-wide data in `/dashboard` by switching to admin role
- Enforces intentional, secure access

---

## 👥 MULTI-ROLE SYSTEM

### Database Schema

**Legacy Single-Role** (`profiles` table):
- `role`: student|admin|mentor|company_user (deprecated for new features)
- `cohort_id`: Single cohort assignment (deprecated)

**New Multi-Role** (`user_role_assignments` table):
- Users can have multiple roles (e.g., admin + mentor)
- Roles can be cohort-specific (e.g., mentor for Cohort A, student for Cohort B)
- Fields: `user_id`, `role`, `cohort_id` (nullable)

### Role Switching in UI

**Implementation** (`/dashboard` route):
- Role switcher in sidebar (dropdown with all available roles)
- On switch: Save to localStorage → `window.location.reload()`
- Different data fetched based on `activeRole`:
  - Student: Cohort-specific data (their sessions, resources)
  - Admin: System-wide data (all cohorts, total stats) via `/api/admin/dashboard-stats`
  - Mentor: Students they mentor + cohort data

**useUser Hook** returns:
```typescript
{
  user, profile, loading,
  isAdmin, isMentor, isStudent,
  activeRole,                    // Currently selected role
  activeRoleAssignment,          // Full role record with cohort_id
  activeCohortId,                // Cohort for current role
  hasMultipleRoles,              // Boolean flag
  availableRoles,                // All user's role assignments
  switchRole(roleAssignmentId),  // Change active role
  signOut, refreshProfile
}
```

---

## 🗄️ DATABASE PATTERNS

### Key Tables

**Core Tables**:
- `profiles` - User info (email, phone, name, legacy role/cohort)
- `user_role_assignments` - Multi-role support (user_id, role, cohort_id)
- `cohorts` - Learning groups (name, tag, dates, status)
- `sessions` - Classes (title, zoom_link, scheduled_at, cohort_id)
- `learning_modules` - Course content (title, week_number, is_global)
- `module_resources` - Individual content items (videos, slides, documents)

**Relationships**:
- `session_cohorts` - Multi-cohort session support
- `cohort_module_links` - Cross-cohort module sharing
- `resource_progress` - User engagement tracking
- `attendance` - Session attendance from Zoom webhooks
- `rsvps` - Session interest (yes/no responses)

### RLS (Row Level Security)

- **Students**: Read-only access to their cohort data
- **Admins**: Full access via `createAdminClient()` (bypasses RLS)
- **Mentors**: Access to assigned team members

### Supabase Client Patterns

```typescript
// Server Component (read data)
import { createClient } from '@/lib/supabase/server'

export default async function Page() {
  const supabase = await createClient()
  const { data } = await supabase.from('users').select()
  return <div>{/* render */}</div>
}

// Client Component (interactive)
'use client'
import { createClient } from '@/lib/supabase/client'

// Admin operations (server-side only!)
import { createAdminClient } from '@/lib/supabase/server'
const adminClient = createAdminClient() // Bypasses RLS
```

---

## 🎨 UI COMPONENT PATTERNS

### Component Library Stack

- **Radix UI**: 48 accessible, unstyled primitives (dialogs, dropdowns, etc.)
- **shadcn/ui**: Copy-paste pattern, full control over components
- **Tailwind CSS 4**: Utility-first styling with OKLCH color space
- **Framer Motion**: Smooth animations
- **Lucide React**: Icon library

### Custom Components

**Unique to this project**:
- `components/ui/otp-input.tsx` - 4-digit OTP input with auto-focus
- `components/ui/country-code-picker.tsx` - 100+ countries dropdown
- `components/page-loader.tsx` - Full-page loading state

### Server vs Client Components

**Default to Server Components** unless you need:
- `useState`, `useEffect` hooks
- Event handlers (`onClick`, `onChange`)
- Browser APIs
- Real-time subscriptions

**Pattern**: Add `'use client'` at top of file only when needed.

---

## 🔌 EXTERNAL INTEGRATIONS

### MSG91 (SMS OTP)

**Configuration**:
- Template must be pre-approved by MSG91 before production
- 4-digit codes (balance of security + UX)
- ~₹0.50-1 per SMS cost

**Implementation**: `/lib/integrations/msg91-otp.ts`
```typescript
sendOTP(phone: string) // Send 4-digit code
verifyOTP(phone: string, otp: string) // Verify code
resendOTP(phone: string, retryType: 'text'|'voice') // Retry delivery
```

**Phone Format**: Always store with country code (e.g., `+919876543210`)

### Supabase

- **Auth**: OAuth2, session management, magic links
- **Database**: PostgreSQL with RLS
- **Storage**: File uploads (PDFs, videos)

**Admin API** (elevated privileges):
```typescript
const adminClient = createAdminClient()
// Only use server-side for admin operations
// Bypasses RLS - never expose service role key
```

### Google Services

- **OAuth2**: Authentication (separate callbacks for student/admin)
- **Calendar**: Session scheduling sync
- **Drive**: Educational material hosting

### Zoom

- **Webhooks**: `/api/attendance/webhook` - Automatic attendance tracking

---

## 🧪 TESTING (PLAYWRIGHT)

### Configuration

**File**: `playwright.config.ts`
- Base URL: `http://localhost:3000`
- Browsers: Chrome, Firefox, Safari, Mobile Chrome/Safari
- Test directory: `./tests`
- Timeout: 30 seconds per test

### Running Tests

```bash
npx playwright test                    # Run all tests
npx playwright test --ui              # Interactive mode
npx playwright test --headed          # Show browser
npx playwright test tests/auth.spec.ts # Single file
npx playwright show-report            # View results
```

### Ralph Plugin

Autonomous AI-driven testing agent integrated with Playwright for comprehensive test coverage.

---

## ⚡ CLAUDE'S OPERATING INSTRUCTIONS

### CRITICAL: Read This Before Every Task

**1. PARALLEL WORK MINDSET**
- When user asks for multiple features/tasks, ALWAYS suggest: "I can work on these in parallel. Should I spin up separate sessions for each?"

**2. PLAN MODE FIRST**
- For ANY complex task (3+ steps, new feature, refactoring), AUTOMATICALLY say: "This is complex. Let me enter plan mode first."
- After plan approval, execute in one shot
- If anything goes wrong, suggest: "Let's go back to plan mode and re-plan this."

**3. SELF-REVIEW BEFORE PRESENTING**
- Before showing any code/feature, run this checklist:
  - Does it handle errors gracefully?
  - Is it mobile responsive?
  - Does it follow CLAUDE.md rules?
  - Is it accessible?
  - Is it secure?
  - Would I be proud to ship this?
- If answer is "no" to any, fix before presenting

**4. SUBAGENT USAGE**
- When exploring unfamiliar codebase: Use 3-5 subagents
- When building complex feature: Suggest subagents for parallel work

**5. AUTONOMOUS BUG FIXING**
- When user pastes an error: Don't ask questions, just fix it
- Run root cause analysis → Fix → Test → Then explain

**6. EXPLANATORY MODE**
- Always explain:
  - WHAT you're doing
  - WHY you chose this approach
  - WHAT alternatives exist
  - TRADEOFFS of each option

**7. UPDATE CLAUDE.md**
- After every mistake/correction, add to "Past Mistakes" section below
- Format: "- Update [DATE]: [What went wrong] → [New rule]"

**8. CHALLENGE & EXCELLENCE**
- If you build something mediocre, say: "I can do better. Let me implement the elegant solution."

**9. MODEL PREFERENCE FOR COMPLEX TASKS**
- Use **Opus 4.5** (model: `opus`) for:
  - Authentication system changes
  - Security-critical features
  - Complex business logic with multiple edge cases
  - Database migrations affecting user data
- Use **Sonnet 4.5** (default) for:
  - UI components and styling
  - Simple CRUD operations
  - Documentation updates
  - Bug fixes with clear root cause

---

## 🔄 WORKFLOW ORCHESTRATION

### 1. Plan Mode Default

**Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions)**

- If something goes sideways, STOP and re-plan immediately – don't keep pushing
- Use plan mode for verification steps, not just building
- Write detailed specs upfront to reduce ambiguity

### 2. Subagent Strategy

**Use subagents liberally to keep main context window clean**

- Offload research, exploration, and parallel analysis to subagents
- For complex problems, throw more compute at it via subagents
- One task per subagent for focused execution

### 3. Verification Before Done

**Never mark a task complete without proving it works**

- Diff behavior between main and your changes when relevant
- Ask yourself: "Would a staff engineer approve this?"
- Run tests, check logs, demonstrate correctness

### 4. Demand Elegance (Balanced)

**For non-trivial changes: pause and ask "Is there a more elegant way?"**

- If a fix feels hacky: "Knowing everything I know now, implement the elegant solution"
- Skip this for simple, obvious fixes – don't over-engineer
- Challenge your own work before presenting it

---

## 🎯 CORE PRINCIPLES

### **Simplicity First**
Make every change as simple as possible. Impact minimal code.

### **No Laziness**
Find root causes. No temporary fixes. Senior developer standards.

### **Minimal Impact**
Changes should only touch what's necessary. Avoid introducing bugs.

---

## 🎨 PROJECT CONFIGURATION

### Brand Guidelines

**Colors** (OKLCH Color Space):
- Primary: oklch(0.55 0.25 280) - Purple/Blue (CTAs, primary actions)
- Secondary: oklch(0.96 0.01 260) - Light gray (secondary elements)
- Accent: oklch(0.55 0.2 195) - Cyan/Teal (highlights, links)
- Destructive: oklch(0.6 0.24 25) - Red/Orange (errors, delete)
- Background (Light): oklch(0.98 0.005 260) - Near white
- Background (Dark): oklch(0.1 0.015 260) - Near black
- Border: oklch(0.92 0.01 260) - Light gray

**Special Effects**:
- Glow Primary: oklch(0.55 0.25 280 / 0.4) - Hover states
- Glow Accent: oklch(0.65 0.2 195 / 0.4) - Active states
- Gradients: Primary → Via (240) → Accent for hero sections

**Typography**:
- Headings: Geist Sans, Bold
- Body: Geist Sans, Regular
- Code/Mono: Geist Mono
- Minimum font size: 14px
- Line height: 1.5 for body, 1.2 for headings

**Layout**:
- Max width: Full width with sidebar layout
- Sidebar: Left-aligned, collapsible
- Content area: Dynamic with sidebar state
- Breakpoints: Mobile: 640px, Tablet: 768px, Desktop: 1024px
- Border radius: 0.75rem (12px) base, with sm/md/lg/xl variants

---

### Tech Stack & Tools

**Frontend**:
- Framework: Next.js 16.1.4 (App Router)
- React: 19.2.3
- TypeScript: 5.x (strict mode)
- Styling: Tailwind CSS 4 + tw-animate-css
- Component Library: Radix UI (shadcn/ui pattern)
- State Management: React Hook Form + Zod validation
- Animations: Framer Motion 12.29.2
- Icons: Lucide React
- Theme: next-themes (dark mode support)
- Tables: Native HTML tables (TanStack Table removed — not used)
- Toasts: Sonner 2.0.7

**Backend**:
- Runtime: Next.js Server Actions
- Database: Supabase (PostgreSQL)
- Authentication: Supabase SSR Auth
- SMS/OTP: MSG91 (India-focused, reliable OTP delivery)
- API: Server Actions + Route Handlers

**Deployment**:
- Hosting: Vercel (recommended for Next.js 16)
- CI/CD: GitHub Actions (if configured)
- Environment: .env.local for development

**Testing**:
- E2E Testing: Playwright 1.57.0

**Utilities**:
- Date handling: date-fns 4.1.0 + date-fns-tz
- CSV parsing: PapaParse 5.5.3
- Excel: xlsx 0.18.5
- QR codes: qrcode 1.5.4
- Email: Resend 6.8.0
- Video: video.js 8.23.4

---

### Quality Standards

**Code Quality**:
- [x] TypeScript strict mode enabled
- [ ] No console.logs in production
- [ ] All functions have error handling
- [ ] Loading states for all async operations (using Suspense)
- [ ] Empty states for all lists/collections
- [ ] Use Server Components by default, Client Components only when needed
- [ ] Validate all forms with Zod schemas
- [ ] Use Server Actions for data mutations

**UX Standards**:
- [x] Dark mode support (using next-themes)
- [x] Mobile-first design
- [ ] Maximum 5 fields per form (or use multi-step)
- [ ] "Back" button on all multi-step flows
- [ ] Confirmation dialogs for destructive actions (using AlertDialog)
- [ ] Toast notifications for user feedback (using Sonner)
- [ ] Sidebar responsive (collapsible on mobile)
- [x] Loading skeletons for data fetching (loading.tsx in both route groups)
- [ ] Keyboard shortcuts for power users

**Performance**:
- [ ] Page load time < 2 seconds
- [ ] Lighthouse score > 90
- [ ] Images optimized and lazy-loaded (use Next.js Image)
- [ ] Code-splitting for routes (automatic with App Router)
- [ ] Use React Server Components for static content
- [ ] Minimize client-side JavaScript

**Accessibility**:
- [x] Keyboard navigation works (Radix UI handles this)
- [x] Screen reader friendly (Radix UI ARIA labels)
- [ ] ARIA labels on custom interactive elements
- [ ] Color contrast ratio > 4.5:1 (verify with theme)
- [ ] Focus indicators visible
- [ ] Alt text on all images

**Security**:
- [ ] Input validation on all forms (Zod schemas)
- [ ] SQL injection protection (Supabase handles this)
- [ ] XSS protection (React handles this)
- [ ] CSRF tokens (Next.js handles this)
- [ ] Environment variables for secrets (.env.local)
- [ ] Row Level Security (RLS) in Supabase
- [ ] Authentication required for admin routes
- [x] OTP rate limiting implemented (5 per 15min window)
- [x] OTP expiry enforced (5 minutes)
- [x] Max verification attempts tracked (5 attempts)
- [x] Phone number validation and formatting
- [x] 4-digit OTP for balance of security and UX

---

### Deployment Checklist

**Before Every Deploy**:
1. [ ] All tests passing (`npx playwright test`)
2. [ ] No TypeScript errors (`npm run build`)
3. [ ] Build succeeds locally
4. [ ] Environment variables updated in Vercel
5. [ ] Supabase migrations applied
6. [ ] API routes tested
7. [ ] Mobile responsive verified
8. [ ] Cross-browser tested (Chrome, Safari, Firefox)
9. [ ] SEO meta tags present (metadata in layout.tsx)
10. [ ] Dark mode tested
11. [ ] Remove demo login bypass (if present)

**After Deploy**:
1. [ ] Verify production URL loads
2. [ ] Check all critical user flows (login, dashboard, forms)
3. [ ] Monitor error logs for 30 minutes
4. [ ] Test on real mobile device
5. [ ] Verify Supabase connection works
6. [ ] Test authentication flow
7. [ ] Notify team (if applicable)

---

## 🧠 LEARNING MEMORY (Auto-Updated)

### Past Mistakes to NEVER Repeat

**Format**:
- Update [DATE]: [What went wrong] → [New rule]

**Initial Rules (from project setup)**:
- Update 2026-02-02: Demo login bypass added for testing → Always remove demo bypasses before production deploy
- Update 2026-02-02: Using OKLCH colors → Always use OKLCH color space, never hex codes for consistency
- Update 2026-02-02: Next.js 16 uses App Router → Always use Server Components unless interactivity needed

**Admin Authentication Bug (2026-02-02)**:
- Update 2026-02-02: Admin users had 'student' in profiles.role despite having admin role assignments → When using dual storage (legacy + new tables), ALWAYS check BOTH tables for authentication/authorization. Auth callbacks must check user_role_assignments in addition to profiles.role
- Update 2026-02-02: router.refresh() didn't sync Client Component state after role switch → For role switching or major state changes, use router.push() to navigate to appropriate route instead of router.refresh(). Full navigation ensures all components re-render with new state
- Update 2026-02-02: Sidebar displayed profile.role instead of activeRole → Always display computed activeRole for users with multiple roles, not the legacy profile.role field
- Update 2026-02-02: Bug affected 3 out of 5 admin users → Always audit ALL users of a type when fixing role/permission bugs. Create audit scripts to verify fixes comprehensively

**Multi-Role Dashboard & Access Control (2026-02-02)**:
- Update 2026-02-02: Initially used router.push() for role switching which navigated to different routes → Use window.location.reload() to stay on current page and refresh view with new role. More reliable for ensuring all components sync with state changes
- Update 2026-02-02: Had "Go to Admin Panel" button in dashboard admin view → Remove all navigation shortcuts to /admin. Enforce explicit "Sign in as Administrator" login flow for proper access control
- Update 2026-02-02: Had Admin button in header providing quick access to /admin → Strict access control - /admin should ONLY be accessible via explicit admin login, never through convenience links
- Update 2026-02-02: Dashboard initially redirected based on role instead of showing different views → Same route (/dashboard) should show role-specific views (student view vs admin view) based on activeRole. Better UX than navigation

**OTP Authentication Implementation (2026-02-02)**:
- Update 2026-02-02: Implementing OTP auth - phone field already exists in schema → Always check existing schema before planning new fields. Avoid duplicate migrations
- Update 2026-02-02: MSG91 requires template approval → Get OTP template approved BEFORE production deployment. Test with test mode initially
- Update 2026-02-02: Rate limiting is critical for OTP → Always implement rate limiting from day 1. Never deploy OTP system without abuse protection
- Update 2026-02-02: Phone numbers need country code → Store phone with country code prefix. Format: `+[code][number]` for international support
- Update 2026-02-02: Session creation after OTP verification is complex → Use Supabase admin.generateLink() API for creating sessions. More reliable than manual token generation

**Phone Numbers & Data Quality (2026-02-02 - Session 3)**:
- Update 2026-02-02: CSV import had spam/test accounts mixed with real users → Always verify and clean data before bulk operations. Create verification scripts to identify anomalies (emails like aabc@gmail.com, aaabc@gmail.com)
- Update 2026-02-02: Bulk imported 332 users but only 325 were real → Query database first, match CSV with existing records, skip non-existent users. Prevent blind SQL execution on unverified data
- Update 2026-02-02: TypeScript strict types on Select onChange → When using shadcn Select with typed state, wrap onValueChange: `(value) => setState(value as TypeName)` to satisfy type checker
- Update 2026-02-02: Phone number variations in CSV → Support multiple column name formats when parsing: 'Phone', 'Phone Number', 'phone', 'phone_number'. Makes templates more flexible

**Filtering System Implementation (2026-02-02 - Session 3)**:
- Update 2026-02-02: Built comprehensive filters without exploring existing patterns first → ALWAYS use Plan Mode and Explore subagent for complex UI features. Discovered Invoices page had server-side filtering pattern to follow
- Update 2026-02-02: Client-side vs server-side filtering decision → For <500 records, client-side filtering is instant and simpler. For >1000 records, migrate to server-side with API params pattern
- Update 2026-02-02: Filter state management - used individual useState for each filter → This is correct pattern (not combined filter object). Matches existing codebase patterns and easier to manage

**Codebase Refactor (2026-02-06)**:
- Update 2026-02-06: 26 admin routes each had local verifyAdmin() with inconsistent role checks → Extract shared utility (`lib/api/verify-admin.ts`) that checks BOTH `profiles.role` AND `user_role_assignments`. Import in every route. Single source of truth for auth
- Update 2026-02-06: 11 notification routes excluded `company_user` from admin check → Use `isAdminRole()` from `lib/utils/auth.ts` which includes all admin roles. Never hardcode role arrays inline
- Update 2026-02-06: `.or()` filter inputs not sanitized (PostgREST injection risk) → Always use `sanitizeFilterValue()` from `lib/api/sanitize.ts` before `.ilike()` or `.or()` calls
- Update 2026-02-06: 5+ API calls per page load from `useUser()` in multiple components → Wrap with `UserContext` provider in layout, use `useUserContext()` hook. Single fetch per page navigation
- Update 2026-02-06: N+1 queries in sessions route (200+ DB calls for 100 sessions) → Batch fetch with `.in('session_id', ids)` and group in JS. 3 queries total
- Update 2026-02-06: 2,438-line notifications page impossible to maintain → Decompose mega-files into tab components. Orchestrator page <200 lines, each tab component self-contained
- Update 2026-02-06: Unused dependencies (recharts, @tanstack/react-table) bloating bundle → Audit imports before removing. `dompurify` redundant with `isomorphic-dompurify`. @types/* belong in devDependencies

[Claude: Add new entries here after each mistake]

---

### User Preferences & Feedback

**Format**:
- [DATE]: [User feedback] → [Action taken]

**Known Preferences**:
- 2026-02-02: Futuristic theme with glow effects → Use gradient and glow variables for modern feel
- 2026-02-02: Educational platform context → Focus on clarity and learning UX
- 2026-02-02: Admin dashboard + student portal → Separate concerns, clear role-based access
- 2026-02-02: Strict admin access control → /admin route should ONLY be accessible via explicit "Sign in as Administrator" login. No shortcuts, links, or buttons to /admin anywhere in the dashboard interface. This enforces proper intentional access
- 2026-02-02 (Session 3): Comprehensive filtering for user management → User wants ability to filter by name, email, phone, cohort, phone status, date range, role count. Implemented with collapsible panel, active filter chips, and Excel export
- 2026-02-02 (Session 3): Phone numbers in bulk upload → Add phone number column to Excel template so users can be created with OTP capability immediately
- 2026-02-02 (Session 3): Data quality matters → Remove spam/test accounts before showing to user. User expects clean production data

[Claude: Add new entries based on user feedback]

---

### Successful Patterns (Keep Doing This)

**Format**:
- [WHAT WORKED]: [Why it worked] → [Keep doing this]

**Current Best Practices**:
- Radix UI + shadcn/ui: Accessible components out of the box → Always use for complex interactions
- Server Components: Better performance, less JS → Default to Server Components
- Zod validation: Type-safe forms → Always validate with Zod schemas
- Supabase SSR: Secure auth → Follow SSR pattern for authentication
- Multi-role dashboard views (2026-02-02): Single route shows different views based on activeRole (student vs admin) → Better UX than navigating between routes. Implemented via conditional rendering with separate data fetching per role
- window.location.reload() for role switching (2026-02-02): Ensures complete component state synchronization when switching roles → More reliable than router.refresh() or router.push() for major state changes
- Dedicated admin stats API endpoint (2026-02-02): Created /api/admin/dashboard-stats for system-wide data → Clean separation between student (cohort-specific) and admin (system-wide) data sources
- Explicit access control patterns (2026-02-02): Removed all navigation shortcuts to /admin, enforced login-based access → Clear, intentional access patterns prevent confusion and improve security

**OTP Authentication Patterns (2026-02-02)**:
- Custom OTP storage with MSG91 delivery: Full control over expiry and attempts → Better than pure MSG91 storage or Supabase phone auth
- Phone OTP + Google OAuth for students: Flexibility without compromising security → Two authentication methods
- Google OAuth only for admins: Simpler, more secure admin access → No OTP for administrative accounts
- Rate limiting with progressive blocking: 5 requests per window, 30-min block → Prevents abuse while allowing legitimate retries
- Country code picker for phone input: Better UX than requiring manual entry → Always provide dropdown for common countries
- 4-digit OTP input component: Individual boxes with auto-focus → Better UX than single input field, easier to remember

**Phone Numbers & Bulk Import (2026-02-02 - Session 3)**:
- CSV matching with database query before updates: Query existing users, match with CSV, generate SQL only for matches → Prevents errors and shows clear statistics (320 matched, 3 already had phones, 6 not found)
- Phone number bulk import in template: Added Phone Number column to Excel template → Users can be created with OTP capability immediately, no manual phone addition needed
- Data verification scripts: Created find/verify/delete scripts for data quality → Easy to audit and clean data, catch test accounts before they pollute production
- Progressive data migration: Add phone numbers to existing 318 users in single operation → Batch operations with verification, 100% success rate, immediate rollback capability

**Comprehensive Filtering System (2026-02-02 - Session 3)**:
- Plan Mode for complex UI features: Used Explore subagent to find existing patterns (Invoices, Sessions, Learnings) → Consistent implementation matching codebase style
- Collapsible filter panel pattern: Collapsed (search + badge count) / Expanded (all options) → Saves space, shows filter count, progressive disclosure
- Active filter chips with remove buttons: Visual feedback of applied filters, click X to remove → Users understand what's filtered, easy to modify individual filters
- Multi-select using Checkboxes in grid: 2-column grid with checkboxes for cohorts → Better UX than multi-select dropdown, see all options at once
- Date range picker with shadcn Calendar: Dual Popover with Calendar components → Clean UI, familiar date selection pattern
- Export filtered results to Excel: XLSX export with filtered data → Admins can download exactly what they see, useful for reports
- Stats cards showing filtered vs total: "12 / 325" format when filters active → Clear indication of filter impact on data
- Enhanced search across multiple fields: Search name OR email OR phone simultaneously → Single input, maximum flexibility
- Client-side filtering for <500 records: Instant updates, no API calls → Better UX than server-side for small datasets

**Data Quality & Maintenance (2026-02-02 - Session 3)**:
- Spam account detection pattern: Test emails with patterns (aabc, aaabc, aaaabc) → Easy to spot and remove before production use
- Database cleanup scripts: Created reusable delete/verify scripts → Can audit and clean data safely
- Match-before-update pattern: Query database → match CSV → generate SQL → verify → execute → Prevents blind updates, shows statistics at each step

**Codebase Refactor Patterns (2026-02-06)**:
- "Create, Verify, Swap, Delete" methodology: Never modify in-place. Create new files → verify build → swap imports → delete old code → Zero regressions across 107 files changed
- Shared verifyAdmin() for all admin routes: Single import replaces 26 local copies → Consistent auth, single place to fix bugs, ~500 lines removed
- UserContext provider wrapping layouts: Single API call per page load instead of 5+ → Faster page transitions, no auth flicker
- Tab-based component decomposition: Each tab becomes its own file with clear interface → Notifications page: 2,438 → 81 lines orchestrator + 4 focused components
- Reusable component via mode prop: `FileUploadTab` handles both presentations and PDFs → One component, two use cases, no duplication
- Cross-tab navigation via callback prop: `onNavigateToTemplates` callback from parent → Clean separation between tab components without shared state
- useMemo for filtered lists: Wrap expensive filter/sort computations → Users page: 6 filter criteria only recompute when inputs change, not on every dialog open/close
- countByRole single-pass helper: One loop replaces 6 `.filter()` calls in user-stats → O(n) once instead of O(6n)

[Claude: Add new entries when something works really well]

---

## 🚀 QUICK REFERENCE

### Common Prompts

**New Feature**:
```
"Build [feature name] with:
- [List requirements]
- Mobile-first design
- Dark mode support
- Follow CLAUDE.md rules
- Use Server Components unless interactivity needed
- Radix UI components where applicable
- Zod validation for forms
- Loading states with Suspense
- Error boundaries
- Enter plan mode first if complex"
```

**Bug Fix**:
```
"Fix this: [paste error]

Root cause analysis:
- What broke?
- Why?
- How to prevent?

Then fix and update CLAUDE.md."
```

**Improve Feature**:
```
"Improve [feature]:
- Faster load time (use Server Components)
- Better UX (loading states, animations)
- More accessible
- Dark mode optimized
Show before/after."
```

**New Page/Route**:
```
"Create new page: [route]
- Server Component by default
- Loading.tsx for loading state
- Error.tsx for error boundary
- Metadata for SEO
- Mobile responsive
- Dark mode support"
```

---

### Code Patterns to Follow

**Server Component (default)**:
```tsx
// app/dashboard/page.tsx
import { createClient } from '@/lib/supabase/server'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data } = await supabase.from('users').select()

  return <div>{/* render */}</div>
}
```

**Client Component (when needed)**:
```tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

export function InteractiveComponent() {
  const [state, setState] = useState()
  // ...
}
```

**Form with Zod**:
```tsx
'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const schema = z.object({
  name: z.string().min(1, 'Name required'),
})

export function MyForm() {
  const form = useForm({
    resolver: zodResolver(schema),
  })
  // ...
}
```

**Server Action**:
```tsx
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function updateData(formData: FormData) {
  const supabase = await createClient()
  // validate, update database
  revalidatePath('/dashboard')
}
```

---

## 🎯 Project-Specific Rules

### Admin Dashboard
- Protected routes under `/admin`
- Check user role before rendering admin components
- Show appropriate loading states during auth checks
- Graceful fallback if user not authorized
- **CRITICAL**: `/admin` is ONLY accessible via explicit "Sign in as Administrator" login
- **NEVER** add navigation links/buttons to `/admin` from dashboard or header
- Admin users can view admin data in `/dashboard` by switching to admin role

### Multi-Role Dashboard (`/dashboard`)
- Shows different views based on `activeRole` (not navigation)
- **Student role selected**: Shows cohort-specific data (sessions, learnings, invoices for their cohort)
- **Admin role selected**: Shows system-wide data (all cohorts, total stats, all sessions)
- **Mentor role selected**: Shows students they mentor
- Use `window.location.reload()` for role switching to ensure full component sync
- Fetch data from different API endpoints based on role (e.g., `/api/admin/dashboard-stats` for admin view)

### Student Portal
- Public routes accessible to authenticated students
- Show course progress, assignments, videos
- Responsive video player (video.js)
- Track engagement metrics

### Data Handling
- Use PapaParse for CSV imports
- Use xlsx for Excel exports
- Validate all uploaded data
- Show progress for long operations

### UI Patterns
- Use sidebar layout for main app
- Collapsible sidebar on mobile
- Consistent spacing (using Tailwind)
- Glow effects on hover for CTAs
- Smooth transitions (Framer Motion)

### OTP Authentication (MSG91)
- **Phone Login**: Primary authentication method using MSG91 SMS OTP
- **Google OAuth**: Alternative login method for students
- **Admin Login**: Google OAuth ONLY (no OTP for admins)
- **Rate limiting enforced**: 5 OTP requests per 15-minute window
- **OTP security**:
  - 4-digit codes (not 6)
  - 5-minute expiry
  - Max 5 verification attempts
  - Block for 30 minutes after excessive requests
- **Phone number format**: Always store with country code (e.g., `+919876543210`)
- **MSG91 integration**:
  - Never expose AUTH_KEY in client code
  - Always use server-side API routes for OTP operations
  - Template must be approved by MSG91 before production use
  - Monitor delivery rates (should be >95%)
- **Session management**: Use Supabase Auth admin API for session creation after OTP verification
- **Admin login**: Support OTP login for admin role via `/login` with "Sign in as Administrator" mode

---

**Version**: 3.0 (Architecture Documentation + Init Command)
**Last Reviewed**: 2026-02-03
**Next Review**: 2026-02-10

---

> "This dashboard learns from every mistake and gets smarter over time. Update this file after each error to build institutional knowledge."
