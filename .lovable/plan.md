

# Full Platform Upgrade: Slugs, Forum, Dropdowns, Expertise

## Overview

This plan implements all 6 features in one coordinated pass: profile slug system, 3-tier forum with dynamic institute/cohort logic, searchable dropdowns for education and professional details, and expertise multi-select with 25+ categories.

---

## 1. Database Migration

Add three new columns to `profiles`:

- `slug` (text, UNIQUE) -- auto-generated as `firstname-lastname-XXXXX` (5 random digits)
- `slug_updated_at` (timestamptz) -- tracks if user has edited their slug (null = never edited, one edit allowed)
- `primary_education_id` (uuid, FK to education.id) -- tracks which education entry drives forum cohort access

Create two PostgreSQL functions + a trigger:

- `generate_profile_slug(name, user_id)` -- converts name to lowercase-hyphenated, appends 5 random digits, checks uniqueness
- `set_profile_slug()` -- trigger function that auto-sets slug on INSERT or UPDATE of name (only if slug is NULL)
- Trigger `trg_set_profile_slug` on `profiles` BEFORE INSERT OR UPDATE OF name

Backfill all existing profiles with generated slugs.

---

## 2. New Data Files (4 files)

### `src/data/institutionsList.ts`
200+ universities: all 23 IITs, 20 IIMs, 31 NITs, top Indian universities (BITS, VIT, SRM, DTU, NSUT, IIIT-H, etc.), and 30+ global institutions (Harvard, MIT, Stanford, Oxford, Cambridge, NUS, NTU, etc.).

### `src/data/dropdownOptions.ts`
- **Degrees**: BTech, MTech, MBA, PGDM, MCA, BCA, BSc, MSc, BA, MA, BCom, MCom, BBA, PhD, MPhil, LLB, LLM, MBBS, BDes, MDes, BE, ME, BArch, MArch, BEd, MEd, Diploma, Certificate (each individual, no grouping)
- **Branches**: CSE, IT, ECE, EEE, Mechanical, Civil, Chemical, Aerospace, Biotechnology, Mathematics & Computing, Engineering Physics, Metallurgical, Mining, Finance, Marketing, HR, Operations, Economics, Data Science, AI/ML, Management, Strategy, Consulting, Psychology, Sociology, History, Physics, Chemistry, Biology, Law, Design, Architecture
- **Expertise categories** (25+): Software Development, Product Management, Marketing, Finance, Consulting, AI/ML, Data Analytics, Entrepreneurship, Sales, Operations, Strategy, UI/UX Design, Cybersecurity, Blockchain, Cloud Computing, DevOps, Research, Content Creation, Investment Banking, Venture Capital, Human Resources, Legal, Public Policy, Supply Chain, EdTech, Healthcare Tech, Sustainability, Social Impact
- **Passing years**: 1980-2035

### `src/data/companiesList.ts`
Top 50 Indian + 30 global companies (TCS, Infosys, Wipro, HCL, Reliance, Google, Microsoft, Apple, Meta, Amazon, McKinsey, BCG, Goldman Sachs, etc.)

### `src/data/locationsList.ts`
"Remote" always first, then 50+ global cities (Delhi, Mumbai, Bangalore, Chennai, Hyderabad, Pune, Kolkata, London, New York, Singapore, Dubai, San Francisco, Toronto, Sydney, Berlin, Tokyo, etc.)

---

## 3. New Reusable Components (2 files)

### `src/components/SearchableSelect.tsx`
- Popover-based dropdown with search input
- Filters options as user types
- "Other" option at bottom opens free-text input
- Keyboard navigable (arrow keys + Enter)
- Solid background (bg-popover), high z-index
- Used for: Institution, Degree, Branch, Company, Location, Passing Year

### `src/components/ExpertiseSelect.tsx`
- Multi-select chip/tag UI
- Pre-loaded 25+ expertise categories displayed as selectable chips
- Search/filter while typing
- Click to add, click chip X to remove
- "Add custom" option for anything not in list
- Max 15 tags enforced
- Returns string array

---

## 4. Routing Changes (`src/App.tsx`)

Add new route:
```
<Route path="/u/:slug" element={<Profile />} />
```

Keep existing `/profile/:userId` as fallback.

---

## 5. Profile Page Updates (`src/pages/Profile.tsx`)

### Slug System
- Detect URL params: if route is `/u/:slug`, query profiles by `slug`; if `/profile/:userId`, query by `user_id`
- Display shareable URL as `/u/slug` in the share button
- Add "Edit URL" button (visible only if `slug_updated_at` is null)
- Slug edit: lowercase, alphanumeric + hyphens only, 3-50 chars, uniqueness check via DB

### Education Modal -- Replace plain inputs with:
- Institution: `SearchableSelect` with institutions list + "Other"
- Degree: `SearchableSelect` with degrees list + "Other"
- Branch/Area: `SearchableSelect` with branches list + "Other"
- Passing Year: `SearchableSelect` with 1980-2035 range
- Location: `SearchableSelect` with locations list + "Other"

### Experience Modal -- Replace plain inputs with:
- Company: `SearchableSelect` with companies list + "Other"
- Job Title: free text (unchanged)
- Location: `SearchableSelect` with locations list + "Other"

### Expertise Section -- Replace comma-separated input with:
- `ExpertiseSelect` component with 25+ pre-loaded categories
- Chip-style UI, max 15 tags
- Custom input support via "Add custom"

---

## 6. Forum Updates (`src/pages/Forum.tsx`)

### Enhanced Cohort Key Derivation
- Instead of only using `profile.student_status`, fetch user's primary education entry from the `education` table
- Cohort key = `institution|degree|branch|passing_year` from education table
- Display label: "IIT Delhi - BTech CSE - 2025"

### Institute Forum Label
- Show full institution name instead of just "IIT X"
- If no institution set: "Add your institution to access your campus forum"

### Cohort Forum Guard
- If cohort key has fewer than 2 parts: "Complete your education profile to access your cohort forum"

---

## 7. Slug-Based Navigation (Multiple Files)

Update profile links in `PostCard.tsx`, `MemberCard.tsx`, `Forum.tsx`, `Network.tsx` to use `/u/:slug` when available, falling back to `/profile/:userId`.

Update `useAuth.tsx` to expose `slug` from the profile context.

---

## Files to Create

| File | Purpose |
|---|---|
| `src/components/SearchableSelect.tsx` | Reusable searchable dropdown |
| `src/components/ExpertiseSelect.tsx` | Multi-select chip input |
| `src/data/institutionsList.ts` | 200+ university names |
| `src/data/locationsList.ts` | Global locations with Remote first |
| `src/data/companiesList.ts` | Top companies |
| `src/data/dropdownOptions.ts` | Degrees, branches, expertise, years |

## Files to Modify

| File | Changes |
|---|---|
| Database migration | slug column, functions, trigger, backfill |
| `src/App.tsx` | Add `/u/:slug` route |
| `src/pages/Profile.tsx` | Slug display/edit, rich dropdowns, expertise multi-select |
| `src/pages/Forum.tsx` | Enhanced cohort key from education, better empty states |
| `src/hooks/useAuth.tsx` | Expose slug |
| `src/components/PostCard.tsx` | Use slug-based profile links |
| `src/components/MemberCard.tsx` | Use slug-based profile links |

## Implementation Order

1. Database migration (slug + trigger + backfill)
2. Create all 4 data files in parallel
3. Create SearchableSelect + ExpertiseSelect components
4. Update App.tsx routing
5. Update Profile.tsx (slug system + all rich modals)
6. Update Forum.tsx (cohort logic + empty states)
7. Update navigation links across app

