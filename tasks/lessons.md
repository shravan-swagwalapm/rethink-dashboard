# Lessons Learned - OTP Authentication Implementation

## Date: 2026-02-02

---

## ❌ Mistake #1: Didn't Follow CLAUDE.md Workflow

**What Went Wrong:**
- Implemented entire OTP authentication feature WITHOUT following the workflow orchestration principles I just added to CLAUDE.md
- Didn't use plan mode properly (exited too early)
- Didn't create tasks/todo.md with checkable items
- Didn't verify implementation before marking complete
- Didn't use subagents strategically

**Impact:**
- User had to correct me on OTP digit length (should be 4, not 6)
- Didn't catch this during self-review
- Implementation not verified/tested before delivery

**Root Cause:**
- Got excited about implementing and rushed ahead
- Didn't internalize the workflow principles I just documented
- Failed to ask: "Would a staff engineer approve this?"

**New Rule:**
```
BEFORE starting ANY feature implementation:
1. Read CLAUDE.md relevant sections
2. Create tasks/todo.md with verification steps
3. Enter plan mode for complex features (3+ steps)
4. Use subagents for exploration/parallel work
5. Self-review against checklist BEFORE presenting
6. Update lessons.md after corrections
```

---

## ❌ Mistake #2: Wrong OTP Length Assumption

**What Went Wrong:**
- Implemented 6-digit OTP without asking user preference
- MSG91 supports 4-6 digit OTPs
- User wanted 4 digits for better UX

**Impact:**
- Had to update 8+ files to change from 6 to 4 digits
- Wasted time on rework

**Root Cause:**
- Made assumption based on common practice (6 digits)
- Didn't use AskUserQuestion to clarify requirements
- Didn't review requirements thoroughly

**New Rule:**
```
ALWAYS ask about security/UX trade-offs:
- "How many digits for OTP? (4 for UX, 6 for security)"
- "Should admins have OTP or OAuth only?"
- "Email magic link or phone OTP only?"

Use AskUserQuestion liberally during plan mode.
```

---

## ❌ Mistake #3: Included Email Magic Link Initially

**What Went Wrong:**
- Implemented email magic link as "fallback"
- User only wanted phone OTP (no email OTP)
- Admin should be OAuth only

**Impact:**
- Wrote unnecessary code for email OTP flow
- Had to remove it and update API routes

**Root Cause:**
- Tried to be "helpful" by adding features not requested
- Didn't confirm exact auth flow requirements upfront

**New Rule:**
```
NEVER add unrequested features, even if "helpful":
- Stick to exact requirements
- If suggesting additions, use AskUserQuestion FIRST
- "I see we could add email OTP as fallback. Should I include this?"

Principle: Simplicity First - only build what's requested
```

---

## ✅ What Went Right

### 1. Comprehensive Planning (Eventually)
- Created detailed implementation plan
- Documented all files to create/modify
- Included security considerations

### 2. Clean Code Structure
- Separated concerns (service, API, UI)
- Reusable components (OTPInput, CountryCodePicker)
- Good error handling and validation

### 3. Preserved Existing Functionality
- Kept Google OAuth intact
- Didn't break existing auth flows
- Maintained admin login separation

### 4. Security Best Practices
- Rate limiting (5 requests/15min)
- OTP expiry (5 minutes)
- Attempt tracking (max 5)
- RLS policies on new tables

---

## 🎯 Action Items for Next Feature

**Before Implementation:**
- [ ] Read relevant CLAUDE.md sections
- [ ] Use AskUserQuestion for ambiguous requirements
- [ ] Create tasks/todo.md with verification checklist
- [ ] Enter plan mode (if 3+ steps or architectural decisions)
- [ ] Get plan approval before coding

**During Implementation:**
- [ ] Mark tasks in progress as working
- [ ] Follow "Simplicity First" principle
- [ ] Challenge own work: "Is there a more elegant way?"
- [ ] Self-review against quality checklist

**After Implementation:**
- [ ] Verify it works (run tests, check logs)
- [ ] Ask: "Would a staff engineer approve this?"
- [ ] Update tasks/lessons.md with corrections
- [ ] Mark tasks complete only after proof

---

## 📊 Success Metrics

**Goal:** Reduce correction cycles from 2+ to 0-1

**Tracking:**
- This feature: 2 correction cycles (OTP length, email removal)
- Target: 0-1 correction cycles for next feature
- Method: Follow CLAUDE.md workflow rigorously

---

## 🧠 Key Takeaway

**The workflow principles in CLAUDE.md exist to prevent exactly the mistakes I made.**

Next time:
1. **Plan Mode Default** - Would have caught wrong OTP length
2. **Verification Before Done** - Would have tested before presenting
3. **Demand Elegance** - Would have questioned email fallback addition
4. **Self-Improvement Loop** - This file! ✅

**Remember:** CLAUDE.md is not documentation—it's a commitment to quality and process.

---

_Last Updated: 2026-02-02_
_Next Review: Before next feature implementation_
