# CLAUDE.md - Product Development Rules & Memory

**Last Updated**: 2026-02-02
**Project**: Rethink Dashboard (Educational Platform)

---

## 📖 HOW TO USE THIS FILE

**For You (Product Builder)**:
- Fill in remaining [FILL THIS IN] sections below
- After each mistake, add to "Past Mistakes" section
- Review and update weekly
- Tell Claude to read this file at the start of each session

**For Claude**:
- READ THIS FILE at the start of every session
- FOLLOW all rules and principles below
- UPDATE "Past Mistakes" section when errors occur
- SUGGEST improvements to this file based on learnings

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

**9. DATA ANALYSIS**
- When user mentions analytics/data/metrics, offer to connect and analyze directly

**10. VOICE PROMPT REMINDER**
- Remind user about voice typing (Fn x2 on Mac) for long requirements

---

## 🎨 PROJECT CONFIGURATION

### Brand Guidelines

**Colors** (OKLCH Color Space):
- Primary: oklch(0.55 0.25 280) - Purple/Blue (for CTAs, primary actions)
- Secondary: oklch(0.96 0.01 260) - Light gray (for secondary elements)
- Accent: oklch(0.55 0.2 195) - Cyan/Teal (for highlights, links)
- Destructive: oklch(0.6 0.24 25) - Red/Orange (for errors, delete actions)
- Background (Light): oklch(0.98 0.005 260) - Near white
- Background (Dark): oklch(0.1 0.015 260) - Near black
- Border: oklch(0.92 0.01 260) - Light gray

**Special Effects**:
- Glow Primary: oklch(0.55 0.25 280 / 0.4) - Use for hover states
- Glow Accent: oklch(0.65 0.2 195 / 0.4) - Use for active states
- Gradients: Primary → Via (240) → Accent (for hero sections)

**Typography**:
- Headings: Geist Sans, Bold
- Body: Geist Sans, Regular
- Code/Mono: Geist Mono
- Minimum font size: 14px
- Line height: 1.5 for body, 1.2 for headings

**Logo**:
- Placement: [FILL THIS IN - e.g., Top-left in sidebar]
- Size: [FILL THIS IN - e.g., 140px width]
- Spacing: Standard sidebar padding

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
- Tables: TanStack Table 8.21.3
- Charts: Recharts 3.7.0
- Toasts: Sonner 2.0.7

**Backend**:
- Runtime: Next.js Server Actions
- Database: Supabase (PostgreSQL)
- Authentication: Supabase SSR Auth
- API: Server Actions + Route Handlers

**Deployment**:
- Hosting: Vercel (recommended for Next.js 16)
- CI/CD: GitHub Actions (if configured)
- Environment: .env.local for development

**Analytics & Monitoring**:
- Analytics: [FILL THIS IN - e.g., PostHog, Google Analytics]
- Error Tracking: [FILL THIS IN - e.g., Sentry]
- Logging: [FILL THIS IN - e.g., Console in dev, service in prod]

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
- [ ] Loading skeletons for data fetching
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

---

### Deployment Checklist

**Before Every Deploy**:
1. [ ] All tests passing (`npm run test` if configured)
2. [ ] No TypeScript errors (`npm run build`)
3. [ ] Build succeeds locally
4. [ ] Environment variables updated in Vercel
5. [ ] Supabase migrations applied
6. [ ] API routes tested
7. [ ] Mobile responsive verified
8. [ ] Cross-browser tested (Chrome, Safari, Firefox)
9. [ ] SEO meta tags present (metadata in layout.tsx)
10. [ ] Dark mode tested

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

[Claude: Add new entries here after each mistake]

---

### User Preferences & Feedback

**Format**:
- [DATE]: [User feedback] → [Action taken]

**Known Preferences**:
- 2026-02-02: Futuristic theme with glow effects → Use gradient and glow variables for modern feel
- 2026-02-02: Educational platform context → Focus on clarity and learning UX
- 2026-02-02: Admin dashboard + student portal → Separate concerns, clear role-based access

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

### Available Custom Skills

[Add your custom skills here as you create them]

**Suggested Skills to Create**:
- `/new-page [route]` - Create new page with layout, loading, error
- `/new-component [name]` - Create Radix UI component with variants
- `/supabase-query [table]` - Generate type-safe Supabase query
- `/deploy` - Run full deployment checklist
- `/test-auth` - Test authentication flow
- `/check-a11y` - Check accessibility compliance

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

### Weekly Review Checklist

Every Sunday:
1. [ ] Read "Past Mistakes" - are rules being followed?
2. [ ] Update brand guidelines if changed
3. [ ] Add new user feedback
4. [ ] Review successful patterns
5. [ ] Check Supabase usage/costs
6. [ ] Review Vercel analytics
7. [ ] Suggest improvements to Claude
8. [ ] Plan next week's features

---

## 💡 META: How This File Evolves

**Claude's Responsibilities**:
- Read this file at session start
- Follow all rules and principles
- Update "Past Mistakes" after errors
- Suggest improvements weekly
- Remind about Server Component defaults
- Validate forms with Zod
- Use Radix UI components

**Your Responsibilities**:
- Fill in remaining [FILL THIS IN] sections
- Review updates Claude makes
- Approve/reject changes
- Archive old entries monthly
- Keep tech stack section updated with new dependencies

**Success Indicator**:
When Claude makes the same mistake twice, this file needs updating.

---

## 🎯 Project-Specific Rules

### Admin Dashboard
- Protected routes under `/admin`
- Check user role before rendering admin components
- Show appropriate loading states during auth checks
- Graceful fallback if user not authorized

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

---

**Version**: 1.0
**Last Reviewed**: 2026-02-02
**Next Review**: 2026-02-09

---

> "This dashboard learns from every mistake and gets smarter over time. Update this file after each error to build institutional knowledge."
