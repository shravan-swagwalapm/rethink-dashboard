# Quick User Flow - Cross-Cohort Resource Sharing

## 🚀 3-Step Quick Start

```
Step 1: Navigate               Step 2: Select Source          Step 3: Link
─────────────────              ────────────────────          ─────────────
Admin Dashboard                Cohort Settings Page          Click Button
      ↓                              ↓                             ↓
   Cohorts                     Choose cohort from            "Link X Modules"
      ↓                           dropdown                         ↓
Click [⋮] Menu                       ↓                        Success! ✓
      ↓                        Preview appears
  Settings                    (shows module count)
```

---

## 📊 Visual Flow Diagram

### Flow 1: Accessing Cohort Settings

```
┌────────────┐
│   START    │
│  (Admin    │
│ Dashboard) │
└─────┬──────┘
      │
      ▼
┌─────────────────┐
│ Click "Cohorts" │
│   in sidebar    │
└────────┬────────┘
         │
         ▼
┌──────────────────────┐
│  Cohorts Table Page  │
│                      │
│ [List of cohorts]    │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│  Find target cohort  │
│  (e.g., Cohort 7)    │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ Click three-dot menu │
│        [⋮]           │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ Click "Settings" in  │
│    dropdown menu     │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ Cohort Settings Page │
│   (Destination!)     │
└──────────────────────┘
```

---

### Flow 2: Linking Modules

```
┌────────────────────┐
│ Cohort Settings    │
│      Page          │
└─────────┬──────────┘
          │
          ▼
┌────────────────────┐
│ Scroll to "Copy    │
│ Resources" section │
└─────────┬──────────┘
          │
          ▼
┌────────────────────────────┐
│ Click source dropdown      │
│ "Choose cohort..."         │
└─────────┬──────────────────┘
          │
          ├──────────────┬────────────────┐
          │              │                │
          ▼              ▼                ▼
    ┌─────────┐    ┌─────────┐    ┌──────────┐
    │ Global  │    │Cohort 6 │    │Cohort 5  │
    │ Library │    │         │    │          │
    └────┬────┘    └────┬────┘    └────┬─────┘
         │              │              │
         └──────────────┴──────────────┘
                        │
                        ▼
         ┌──────────────────────────┐
         │ Preview Alert Appears:   │
         │ "Ready to Link"          │
         │ "12 modules will be..."  │
         └──────────┬───────────────┘
                    │
                    ▼
         ┌──────────────────────────┐
         │ Click "Link X Modules"   │
         │        button            │
         └──────────┬───────────────┘
                    │
                    ▼
         ┌──────────────────────────┐
         │ Loading state shows...   │
         │ "Linking modules..."     │
         └──────────┬───────────────┘
                    │
                    ▼
         ┌──────────────────────────┐
         │ Success Toast:           │
         │ "✓ Successfully linked   │
         │  12 modules"             │
         └──────────┬───────────────┘
                    │
                    ▼
         ┌──────────────────────────┐
         │ Stats Update:            │
         │ • Total: 5 → 17          │
         │ • Linked: 0 → 12         │
         └──────────┬───────────────┘
                    │
                    ▼
         ┌──────────────────────────┐
         │ Modules appear in        │
         │ "Currently Linked" list  │
         └──────────────────────────┘
```

---

### Flow 3: Unlinking Modules

```
┌────────────────────┐
│ Cohort Settings    │
│      Page          │
└─────────┬──────────┘
          │
          ▼
┌────────────────────────┐
│ Scroll to "Currently   │
│ Linked Modules" list   │
└─────────┬──────────────┘
          │
          ▼
┌────────────────────────┐
│ Find module to unlink  │
│ (e.g., "React Basics") │
└─────────┬──────────────┘
          │
          ▼
┌────────────────────────┐
│ Hover over module row  │
│                        │
│ [🗑️] appears on right  │
└─────────┬──────────────┘
          │
          ▼
┌────────────────────────┐
│ Click trash icon [🗑️]  │
└─────────┬──────────────┘
          │
          ▼
┌──────────────────────────────┐
│ Confirmation Dialog Opens:   │
│                              │
│ ⚠️ "Unlink Module?"          │
│                              │
│ "What will happen:"          │
│ • Students won't see it      │
│ • Module stays in source     │
│ • Can re-link anytime        │
│                              │
│ [Cancel] [Unlink Module]     │
└─────────┬────────────────────┘
          │
          ├─────────────┬──────────────┐
          │             │              │
          ▼             ▼              ▼
    ┌─────────┐   ┌──────────┐   ┌─────────┐
    │ Click   │   │  Click   │   │ Click X │
    │ Cancel  │   │  Unlink  │   │  close  │
    └────┬────┘   └────┬─────┘   └────┬────┘
         │             │              │
         ▼             ▼              ▼
    ┌─────────┐   ┌──────────────────────┐
    │  Exit   │   │ Success Toast:       │
    │ (no     │   │ "✓ Unlinked module"  │
    │ change) │   └──────────┬───────────┘
    └─────────┘              │
                             ▼
                  ┌──────────────────────┐
                  │ Module disappears    │
                  │ from linked list     │
                  └──────────┬───────────┘
                             │
                             ▼
                  ┌──────────────────────┐
                  │ Stats Update:        │
                  │ • Total: 17 → 16     │
                  │ • Linked: 12 → 11    │
                  └──────────────────────┘
```

---

## 🎯 One-Page Cheat Sheet

### Navigation Path
```
🏠 Admin Dashboard
  ↓
📚 Cohorts (sidebar)
  ↓
⋮ Three-dot menu (on cohort row)
  ↓
⚙️ Settings
  ↓
🎯 Cohort Settings Page
```

### Key Sections on Settings Page
```
1. [Statistics Cards] ← View module breakdown
2. [Copy Resources]   ← Link new modules
3. [Linked Modules]   ← Manage existing links
```

### Common Actions

| Action | Where | What to Click |
|--------|-------|---------------|
| **View Stats** | Settings page top | Nothing - just view cards |
| **Link Modules** | Copy Resources section | Dropdown → Select source → Button |
| **Unlink Module** | Linked Modules list | Hover row → Click [🗑️] |
| **Go Back** | Any page | "← Back to Cohorts" button |

---

## 📱 Mobile Flow (Responsive)

### Statistics (Stack Vertically)
```
┌─────────────┐
│ Total: 12   │
└─────────────┘
┌─────────────┐
│ Own: 5      │
└─────────────┘
┌─────────────┐
│ Linked: 4   │
└─────────────┘
┌─────────────┐
│ Global: 3   │
└─────────────┘
```

### Source Selector (Full Width)
```
┌──────────────────────────┐
│ Choose cohort... ▼       │
└──────────────────────────┘
```

### Link Button (Full Width)
```
┌──────────────────────────┐
│ Link 12 Modules          │
└──────────────────────────┘
```

---

## ⚡ Speed Tips

### Fastest Way to Link All Modules
```
3 clicks:
1. [⋮] menu on cohort
2. Settings
3. Source dropdown → Cohort 6 → Link button
```

### Fastest Way to Unlink
```
2 clicks:
1. Hover → [🗑️]
2. Confirm
```

### Fastest Way to Check Stats
```
1 click:
Settings (stats are visible immediately)
```

---

## 🔄 Decision Tree

### "Should I link or create new?"

```
                Start
                  │
                  ▼
    Is content the same as existing cohort?
                  │
         ┌────────┴────────┐
         │                 │
        Yes                No
         │                 │
         ▼                 ▼
    LINK IT!          CREATE NEW
   (Use settings)   (Use learnings)
         │
         ▼
    Which source?
         │
    ┌────┴────┐
    │         │
 Universal  Specific
  Content   Cohort
    │         │
    ▼         ▼
  Global    Cohort X
  Library
```

### "Should I unlink this module?"

```
                Start
                  │
                  ▼
    Does this cohort need different content?
                  │
         ┌────────┴────────┐
         │                 │
        Yes                No
         │                 │
         ▼                 ▼
    UNLINK IT!        KEEP IT
   (Click trash)    (Do nothing)
```

---

## 🎨 Color Legend

**On Settings Page:**
- 🔵 **Blue Badge/Card** = Own modules (created for this cohort)
- 🟢 **Green Badge/Card** = Linked modules (from other cohorts)
- 🟣 **Purple Badge/Card** = Global modules (available to all)
- ⚫ **Gray Card** = Total (sum of everything)

**In Alerts:**
- 🟢 **Green Alert** = Ready to link (positive action)
- 🟡 **Amber Alert** = Warning (no modules / consequences)
- 🔵 **Blue Alert** = Information (how it works)

---

## 📋 Pre-Flight Checklist

Before linking modules, verify:
- [ ] Source cohort actually has modules
- [ ] You selected the correct target cohort
- [ ] You reviewed the preview (module count)
- [ ] Students need these specific modules
- [ ] You're not creating duplicates

After linking, verify:
- [ ] Success toast appeared
- [ ] Stats updated correctly
- [ ] Modules appear in linked list
- [ ] Login as student to test visibility

---

## 🎓 Learning Path

**Beginner → Intermediate → Advanced**

### Level 1: View Only
- Navigate to cohort settings
- Understand statistics
- Read linked modules list

### Level 2: Basic Linking
- Select a source cohort
- Link all modules
- Verify in student view

### Level 3: Management
- Unlink specific modules
- Mix own + linked + global
- Update shared modules

### Level 4: Expert
- Set up new cohorts in 2 minutes
- Maintain global library
- Optimize resource distribution

---

**Print this page for quick reference!** 📄
