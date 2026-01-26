# Admin User Flow Guide - Cross-Cohort Resource Sharing

## 🎯 Overview
This guide shows you how to share learning modules across cohorts without duplicating content.

---

## 📍 Main User Flows

### Flow 1: View Cohort Resource Statistics

**Goal:** See how many modules a cohort has and where they come from

**Steps:**
1. **Login** to the admin dashboard
2. **Navigate** to "Cohorts" from the sidebar
3. **Locate** the cohort you want to view
4. **Click** the three-dot menu (⋮) on the cohort row
5. **Select** "Settings" from the dropdown

**What You'll See:**
```
┌─────────────────────────────────────────────────┐
│ Cohort 7 Settings                               │
│ ─────────────────────────────────────────────── │
│                                                 │
│ Statistics Dashboard:                           │
│ ┌───────────┬───────────┬───────────┬─────────┐│
│ │ Total: 12 │ Own: 5    │ Linked: 4 │ Global:3││
│ │ (Gray)    │ (Blue)    │ (Green)   │(Purple) ││
│ └───────────┴───────────┴───────────┴─────────┘│
└─────────────────────────────────────────────────┘
```

**Interpretation:**
- **Total Modules (12)**: Everything students can access
- **Own Modules (5)**: Created specifically for this cohort
- **Linked Modules (4)**: Shared from other cohorts
- **Global Modules (3)**: Available to all cohorts

---

### Flow 2: Copy Modules from Another Cohort (Bulk)

**Goal:** Share all modules from Cohort 6 to Cohort 7

**Prerequisites:**
- Cohort 6 must have modules already created
- You must be logged in as admin

**Steps:**

**1. Navigate to Target Cohort Settings**
```
Admin Dashboard → Cohorts → [Cohort 7 ⋮] → Settings
```

**2. Locate "Copy Resources" Section**
- Scroll down past the statistics cards
- Find the card titled "Copy Resources from Another Cohort"

**3. Select Source Cohort**
- Click the dropdown that says "🔍 Choose a cohort or the global library..."
- See two options:
  - **🌍 Global Library** (purple) - Universal modules
  - **Other Cohorts** section listing all active cohorts
- Click "Cohort 6"

**4. Review Preview**
A green alert box will appear showing:
```
✨ Ready to Link

12 modules from Cohort 6 will be linked to Cohort 7.

• Resources will be shared, not duplicated
• Updates to these modules will appear in both cohorts
• Students will see these modules immediately
```

**5. Confirm Action**
- Click the button: **"Link 12 Modules to Cohort 7"**
- Button changes to show loading: "Linking modules to Cohort 7..."

**6. Success Confirmation**
A toast notification appears:
```
✓ Successfully linked 12 modules to Cohort 7
Students in this cohort can now access these learning resources
```

**7. Verify Result**
- Statistics refresh automatically:
  - Total: 5 → 17
  - Linked: 0 → 12
- Scroll down to see "Currently Linked Modules" section
- All 12 modules now appear in the list

---

### Flow 3: View Linked Modules

**Goal:** See which modules are shared from other cohorts

**Steps:**

**1. Go to Cohort Settings**
```
Admin Dashboard → Cohorts → [Select Cohort ⋮] → Settings
```

**2. Scroll to "Currently Linked Modules"**
Located below the "Copy Resources" section

**What You'll See:**
```
Currently Linked Modules (12)
────────────────────────────────────────

┌──────────────────────────────────────────┐
│ [🔗 Linked] React Basics                 │
│ 3 resources • Week 1                     │
│ [📹 Intro Video] [📄 Slides] [+1 more]   │
│                                    [🗑️]  │ ← Hover to see
└──────────────────────────────────────────┘

┌──────────────────────────────────────────┐
│ [🌍 Global] JavaScript Fundamentals      │
│ 5 resources • Week 2                     │
│ [📹 Basics] [📹 Arrays] [+3 more]        │
│                                    [🗑️]  │
└──────────────────────────────────────────┘
```

**Module Information:**
- **Badge Color**:
  - 🔗 Green "Linked" = From another specific cohort
  - 🌍 Purple "Global" = From global library
- **Resource Count**: Number of videos/files in the module
- **Week Number**: When the module is scheduled
- **Preview Badges**: First 3 resources with icons
- **Trash Icon**: Appears on hover (unlink action)

---

### Flow 4: Unlink a Module from a Cohort

**Goal:** Remove a shared module from Cohort 7 (doesn't delete it)

**Steps:**

**1. Navigate to Cohort Settings**
```
Admin Dashboard → Cohorts → [Cohort 7 ⋮] → Settings
```

**2. Find the Module to Unlink**
- Scroll to "Currently Linked Modules" section
- Locate the module you want to remove
- **Hover** over the module row

**3. Click Unlink Button**
- A trash icon (🗑️) appears on the right when hovering
- Click the trash icon

**4. Review Confirmation Dialog**
A dialog appears with:
```
⚠️ Unlink Module from Cohort 7?

You're about to unlink "React Basics" from Cohort 7.

┌─────────────────────────────────────┐
│ What will happen:                   │
│ • Students will no longer see this  │
│ • Module still exists in original   │
│ • You can re-link it anytime       │
└─────────────────────────────────────┘

This won't delete the module—it just removes
it from this cohort.

[Cancel]  [🗑️ Unlink Module]
```

**5. Confirm Unlinking**
- Click **"Unlink Module"** (red button)
- Or click **"Cancel"** to abort

**6. Success Confirmation**
Toast notification:
```
✓ Unlinked "React Basics" from Cohort 7
Students in this cohort will no longer see this module
```

**7. Verify Result**
- Module disappears from the list
- Statistics update:
  - Total: 17 → 16
  - Linked: 12 → 11

---

### Flow 5: Copy from Global Library

**Goal:** Link modules that are available to all cohorts

**Steps:**

**1. Navigate to Cohort Settings**
```
Admin Dashboard → Cohorts → [Cohort 7 ⋮] → Settings
```

**2. Select Global Library as Source**
- Click the source dropdown
- Select **"🌍 Global Library"** (first option)

**3. Review Preview**
```
✨ Ready to Link

3 modules from Global Library will be linked to Cohort 7.

• Resources will be shared, not duplicated
• Updates to these modules will appear in all cohorts
• Students will see these modules immediately
```

**4. Link Modules**
- Click **"Link 3 Modules to Cohort 7"**
- Wait for success toast

**5. Result**
- Global modules appear in linked list with purple badges
- Statistics update:
  - Global: 0 → 3
  - Total: +3

---

## 🔄 Common Workflows

### Workflow A: Setting Up a New Cohort

**Scenario:** You just created "Cohort 8" and want to reuse Cohort 6's content

**Steps:**
1. Create Cohort 8: `Cohorts → [+ Create Cohort]`
2. Go to Cohort 8 Settings: `[Cohort 8 ⋮] → Settings`
3. Copy from Cohort 6: `Source dropdown → Cohort 6 → Link All`
4. ✅ Done! Cohort 8 now has all Cohort 6 content
5. Later, add Cohort 8-specific modules in Learnings page

**Time:** ~2 minutes (vs. 30+ minutes manually)

---

### Workflow B: Updating Shared Content

**Scenario:** You need to update "React Basics" module, which is used in 3 cohorts

**Steps:**
1. Go to Learnings: `Admin Dashboard → Learnings`
2. Find "React Basics" module
3. Click edit and make changes
4. Save
5. ✅ Changes automatically appear in all 3 cohorts!

**No manual sync needed** - Updates propagate instantly

---

### Workflow C: Creating Cohort-Specific Content

**Scenario:** Cohort 7 needs unique content that other cohorts shouldn't see

**Steps:**
1. Go to Learnings: `Admin Dashboard → Learnings`
2. Filter by Cohort 7
3. Create new module: `[+ Add Module]`
4. Select "Cohort 7" as the cohort
5. Add resources (videos, slides, etc.)
6. ✅ Only Cohort 7 students see this content

**Other cohorts are unaffected**

---

### Workflow D: Migrating Old Cohorts to Shared Content

**Scenario:** Cohorts 1-5 each have duplicate copies of "Python Basics"

**Steps:**
1. Identify the best version (e.g., Cohort 5's "Python Basics")
2. For each old cohort (1-4):
   - Go to their settings
   - Link "Python Basics" from Cohort 5
   - Delete their old duplicate version
3. ✅ Now all cohorts share one master copy

**Storage savings:** 80% reduction in duplicates

---

## 🎨 Visual Guide - Where to Find Things

### Starting Point: Cohorts List
```
┌─────────────────────────────────────────────┐
│ Admin Dashboard                             │
│ ────────────────────────────────────────── │
│ 📊 Dashboard                                │
│ 👥 Users                                    │
│ 📚 Learnings                                │
│ 🎓 Cohorts  ← Click here                   │
│ 📅 Sessions                                 │
└─────────────────────────────────────────────┘
```

### Cohorts Table
```
┌───────────────────────────────────────────────────────┐
│ Cohort Management                [+ Create Cohort]    │
│ ───────────────────────────────────────────────────── │
│ Name      | Tag | Students | Sessions | Status | ⋮   │
│ Cohort 6  | C6  | 25       | 12       | Active | ⋮   │
│ Cohort 7  | C7  | 30       | 8        | Active | ⋮ ← Click
│ Cohort 8  | C8  | 20       | 5        | Active | ⋮   │
└───────────────────────────────────────────────────────┘
```

### Dropdown Menu
```
┌──────────────┐
│ ⚙️ Settings  │ ← New option!
│ ✏️ Edit       │
│ 🔄 Retag      │
│ 📦 Archive    │
│ 🗑️ Delete     │
└──────────────┘
```

### Cohort Settings Page Layout
```
┌─────────────────────────────────────────────────────┐
│ ← Back to Cohorts                                   │
│                                                     │
│ Cohort 7                                [Active]    │
│ Manage learning resources and content sharing      │
│                                                     │
│ ℹ️ Resource Sharing Made Easy                       │
│ Share modules without duplicating content...       │
│                                                     │
│ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐  │
│ │ Total   │ │ Own     │ │ Linked  │ │ Global  │  │ ← Stats
│ │ 12      │ │ 5       │ │ 4       │ │ 3       │  │
│ └─────────┘ └─────────┘ └─────────┘ └─────────┘  │
│                                                     │
│ ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓  │
│ ┃ 📋 Copy Resources from Another Cohort        ┃  │
│ ┃                                               ┃  │
│ ┃ Select Source: [Choose cohort... ▼]         ┃  │ ← Copy
│ ┃                                               ┃  │   Section
│ ┃ [Link X Modules to Cohort 7]                ┃  │
│ ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛  │
│                                                     │
│ ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓  │
│ ┃ 🔗 Currently Linked Modules (12)             ┃  │
│ ┃                                               ┃  │
│ ┃ [Linked] React Basics         [🗑️]          ┃  │ ← Linked
│ ┃ [Global] JS Fundamentals      [🗑️]          ┃  │   List
│ ┃ ...                                          ┃  │
│ ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛  │
└─────────────────────────────────────────────────────┘
```

---

## 💡 Tips & Best Practices

### ✅ DO:
- **Review preview** before linking - See exactly what you're copying
- **Use Global Library** for universal content (onboarding, company info)
- **Link early** - Set up new cohorts by copying existing content first
- **Check statistics** - Monitor how many modules each cohort has
- **Update once** - Edit the original; changes propagate everywhere

### ❌ DON'T:
- **Don't duplicate** - Use linking instead of recreating modules
- **Don't delete originals** - Unlinking removes from cohort but keeps source
- **Don't unlink by accident** - Confirmation dialog prevents mistakes
- **Don't over-link** - Only link modules students actually need
- **Don't forget to test** - Login as student to verify they see content

---

## 🧪 How to Verify It's Working

### Test 1: Admin Can Link
1. Go to any cohort settings
2. Select a source with modules
3. Click "Link Modules"
4. ✅ Should see success toast and stats update

### Test 2: Student Sees Linked Content
1. Link Module X from Cohort 6 to Cohort 7
2. Login as a Cohort 7 student
3. Go to `/learnings`
4. ✅ Should see Module X in the list

### Test 3: Updates Propagate
1. Link Module Y to 3 cohorts
2. Edit Module Y title in Learnings
3. Check all 3 cohorts
4. ✅ Title should be updated everywhere

### Test 4: Unlinking Works
1. Unlink Module Z from Cohort 8
2. Check Cohort 8 student view
3. ✅ Module Z should disappear
4. ✅ Original in source cohort still exists

---

## 🔒 Security & Permissions

### Who Can Access:
- ✅ **Super Admins** - Full access
- ✅ **Admins** - Full access
- ❌ **Students** - Cannot access settings (only see their modules)
- ❌ **Mentors** - Cannot modify cohort settings

### What Students See:
- Students only see modules for **their assigned cohort**
- No visual difference between own/linked/global modules
- Cannot see cohort settings page
- Cannot see other cohorts' exclusive content

### Data Integrity:
- Modules are **referenced**, not copied (single source of truth)
- Unlinking removes access, doesn't delete data
- Deleting source module removes it from all cohorts
- RLS policies enforce strict access control

---

## 🆘 Troubleshooting

### Problem: "No modules available" when source has content
**Solution:**
- Source cohort might have no **own** modules (only linked ones)
- Try selecting the original source cohort instead

### Problem: Stats showing 0 after linking
**Solution:**
- Refresh the page (hard refresh: Cmd+Shift+R)
- Check browser console for errors
- Verify migration was applied in Supabase

### Problem: Student can't see linked modules
**Solution:**
- Verify student is assigned to correct cohort
- Check RLS policies are enabled on tables
- Confirm modules were successfully linked (check stats)

### Problem: Can't unlink a module
**Solution:**
- Ensure you're hovering over the correct row
- Check if module is from Global Library (can still unlink)
- Try refreshing and attempting again

### Problem: Duplicate modules appearing
**Solution:**
- This shouldn't happen (UNIQUE constraint prevents it)
- If it does, check database directly
- Contact developer for debugging

---

## 📞 Need Help?

- **Documentation**: See `/CROSS_COHORT_TESTING_GUIDE.md`
- **UI Details**: See `/UI_IMPROVEMENTS_SUMMARY.md`
- **Database Schema**: See `/supabase/migrations/007_cross_cohort_resource_sharing.sql`
- **Support**: Contact the development team

---

## 🎯 Quick Reference Card

| **Task** | **Path** | **Time** |
|----------|----------|----------|
| View cohort stats | Cohorts → [⋮] → Settings | 10 sec |
| Copy all modules | Settings → Select source → Link | 30 sec |
| Unlink module | Settings → Hover module → [🗑️] | 15 sec |
| Verify student view | Login as student → Learnings | 20 sec |
| Edit shared module | Learnings → Edit module → Save | 1 min |

---

**Last Updated:** January 27, 2026
**Feature Version:** 1.0 - Initial Release
**Status:** ✅ Production Ready
