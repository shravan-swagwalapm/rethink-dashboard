# Admin Authentication Bug - Fix Summary

**Date**: 2026-02-02
**Issue**: Admin users unable to login as admin, role switching not working
**Status**: ✅ FIXED & DEPLOYED

---

## 🔍 Root Cause

The system uses **dual storage** for user roles:
1. **`profiles.role`** (legacy, single role)
2. **`user_role_assignments`** (new, multi-role support)

### The Problem:
- Admin users had `'student'` in `profiles.role`
- But had `'admin'` in `user_role_assignments`
- Auth callback only checked `profiles.role` → logged in as student
- Role switching used `router.refresh()` → didn't sync Client Component state
- Sidebar displayed `profile.role` → showed wrong role

---

## ✅ Fixes Applied

### 1. Database Fixes
Fixed `profiles.role` for all @naum.systems users:

| Email | Before | After |
|-------|--------|-------|
| attharv@naum.systems | student | **admin** |
| unnati@naum.systems | student | **admin** |
| deepk@naum.systems | student | **admin** |
| shravan@naum.systems | admin | admin (no change) |
| kartik@naum.systems | admin | admin (no change) |

**Verification**: ✅ All 5 users confirmed with correct admin role

### 2. Code Fixes

#### **`hooks/use-user.ts`** (lines 189-197)
**Before**:
```typescript
const switchRole = (roleAssignmentId: string) => {
  // ...
  router.refresh(); // ❌ Doesn't sync state
};
```

**After**:
```typescript
const switchRole = (roleAssignmentId: string) => {
  // ...
  // Navigate to appropriate dashboard based on new role
  const newRole = assignment.role;
  if (newRole === 'admin' || newRole === 'company_user') {
    router.push('/admin');
  } else {
    router.push('/dashboard');
  }
};
```

#### **`components/dashboard/sidebar.tsx`** (line 216)
**Before**:
```typescript
<p className="text-xs text-muted-foreground capitalize">
  {profile.role}  // ❌ Shows legacy role
</p>
```

**After**:
```typescript
<p className="text-xs text-muted-foreground capitalize">
  {activeRole || profile.role}  // ✅ Shows active role
</p>
```

#### **`app/auth/callback/admin/route.ts`** (lines 87-96)
**Before**:
```typescript
const { data: profile } = await adminClient
  .from('profiles')
  .select('role')
  .eq('id', data.session.user.id)
  .single();

if (profile) {
  userRole = profile.role; // ❌ Only checks profiles.role
}
```

**After**:
```typescript
const { data: profile } = await adminClient
  .from('profiles')
  .select('role')
  .eq('id', data.session.user.id)
  .single();

if (profile) {
  userRole = profile.role;

  // ✅ Also check user_role_assignments for admin role
  const { data: adminAssignments } = await adminClient
    .from('user_role_assignments')
    .select('role')
    .eq('user_id', data.session.user.id)
    .in('role', ['admin', 'company_user'])
    .limit(1);

  // If admin assignment exists, use that role
  if (adminAssignments && adminAssignments.length > 0) {
    userRole = adminAssignments[0].role;
  }
}
```

### 3. Utility Scripts Added

- **`scripts/fix-admin-role.ts`**: Fix individual user role
- **`scripts/audit-admin-users.ts`**: Audit all @naum.systems users
- **`scripts/fix-all-admin-users.ts`**: Bulk fix all admin users

---

## 🧪 Testing Checklist

### Test Case 1: Admin Login ✅
1. Logout completely
2. Click "Sign in as Administrator"
3. Login with admin account (e.g., attharv@naum.systems)
4. Should redirect to `/admin` dashboard
5. Should show admin navigation sidebar
6. Should display "Admin" role in header

### Test Case 2: Role Switching ✅
1. Login as user with multiple roles
2. Open role switcher dropdown
3. Switch from Student to Admin role
4. Should navigate to appropriate dashboard
5. Sidebar should show admin menu items
6. Dashboard should show admin content
7. Header should display "Admin" role

### Test Case 3: Regular User Login ✅
1. Logout
2. Click "Continue with Google" (not administrator button)
3. Login with student account
4. Should redirect to `/dashboard` (student view)
5. Should NOT see admin menu items
6. Should NOT be able to access `/admin` routes

---

## ⚠️ Action Required for Affected Users

**Who**: attharv@naum.systems, unnati@naum.systems, deepk@naum.systems

**Steps to resolve**:
1. **Clear localStorage**:
   - Open browser console (F12)
   - Run: `localStorage.removeItem('active_role_assignment_id')`
   - Or: `localStorage.clear()`

2. **Logout and re-login**:
   - Click profile icon → Logout
   - Click "Sign in as Administrator"
   - Login with your @naum.systems account
   - Should now see admin dashboard

**Alternative**: Clear browser cookies for lms.rethinksystems.in

---

## 📊 Verification Results

### Before Fix:
- ❌ attharv@naum.systems: profiles.role = 'student'
- ❌ unnati@naum.systems: profiles.role = 'student'
- ❌ deepk@naum.systems: profiles.role = 'student'
- ✅ shravan@naum.systems: profiles.role = 'admin'
- ✅ kartik@naum.systems: profiles.role = 'admin'

### After Fix:
- ✅ All 5 @naum.systems users: profiles.role = 'admin'
- ✅ All have corresponding admin role assignments
- ✅ TypeScript build passes
- ✅ Deployed to production

---

## 🚀 Deployment

**Branch**: main
**Commit**: b6bd885 - Fix critical admin authentication bug
**Pushed**: 2026-02-02
**Status**: Deployed to Vercel (lms.rethinksystems.in)

---

## 📝 Updated CLAUDE.md

Added to "Past Mistakes" section:
```markdown
- Update 2026-02-02: Admin users had 'student' in profiles.role → Always check both profiles.role AND user_role_assignments for admin access
- Update 2026-02-02: router.refresh() doesn't sync Client Component state → Use router.push() for role switching
- Update 2026-02-02: Sidebar showed profile.role instead of activeRole → Always display activeRole for multi-role users
```

---

## 🔮 Future Prevention

### Long-term Fix (Phase 4 - Not Yet Implemented):
Add role field to invites system so new users get correct role from the start:
1. Add `role` column to `invites` table
2. Update invites API to accept role parameter
3. Update auth callback to use invite role
4. Update invites UI to include role selection

This will prevent the bug from affecting future admin users.

---

## 📞 Support

If issues persist after following the steps above:
1. Check browser console for errors
2. Verify localStorage is cleared
3. Try in incognito/private browsing mode
4. Contact technical team with screenshot of error

---

**Fix Verified By**: Claude Sonnet 4.5 (Opus 4.5 execution requested)
**Scripts Available**: Run `npx tsx scripts/audit-admin-users.ts` anytime to verify admin users
