# cirkle-discord aug 2026

Project: Cirkle.world (mobile-first community networking web app)

Outcome:
Build a functioning, production-lean MVP similar to LinkedIn but scoped to a single community. Core modules: Open Forum (with optional anonymous posting), member networking (search + connect), community jobs board, and events calendar. Must be mobile-first with a bottom tab bar.

Tech stack requirements:
- Frontend: React + TypeScript
- Styling/UI: Tailwind + shadcn/ui components (mobile-first, accessible)
- Backend: Supabase (Auth, Postgres, Row Level Security)
- No paid integrations; keep it simple and fully working end-to-end.

Global UX/UI:
- Mobile-first layout. Bottom navigation with 5 tabs:
  1) Forum
  2) Home
  3) Calendar
  4) My Network
  5) Jobs
- Clean, modern card-based UI, large tap targets, sticky bottom nav, safe-area padding.
- Use skeleton loaders for lists, empty states, and clear error toasts.

Auth + access:
- Allow anyone to view Landing page and read public parts (optional).
- Require login for: posting, commenting, connecting, applying for jobs, RSVPing.
- Supabase Auth (email/password). Add Google later only if easy.
- Roles: user, moderator, admin (store in profiles.role).
- Community scope: MVP supports one community_id (string), but design schema to support multiple communities later.

ROUTES / PAGES (must implement):
1) / (Landing)
   - App pitch + CTA: “Join community”
   - Login / Signup links

2) /forum (Tab: Forum)
   - List of posts (newest first), filter: “All” and “Anonymous only”
   - Composer:
     - Textarea “What do you want to share?”
     - Checkbox “Post as Anonymous”
     - Post button
   - Post card shows:
     - Author display name OR “Anonymous”
     - Timestamp
     - Content
     - Actions: Like, Comment, Share (share can be a simple copy link)
     - Report button
   - Comments (basic threaded not required; flat list ok)
   - IMPORTANT: If is_anonymous=true, UI must never reveal author profile.
   - Moderation: moderators/admin can delete any post/comment; users can delete their own.

3) /home (Tab: Home)
   - Personalized feed mixing:
     - Recent forum posts
     - Upcoming events
     - New jobs
   - Simple “For you” ordering: newest + items related to skills (optional; can be v1)

4) /calendar (Tab: Calendar)
   - Month view OR agenda list (mobile friendly)
   - Events list with RSVP toggle: Going / Not going
   - Create event (admin/moderator only):
     - title, description, start/end datetime, location (text), visibility (community)
   - Event detail page or drawer

5) /network (Tab: My Network)
   - Search members by name/skill/location
   - Member profile preview cards + “Connect” button
   - Connection requests:
     - Pending received: Accept / Decline
     - Pending sent: Cancel
   - Connections list

6) /jobs (Tab: Jobs)
   - Jobs list with filters: location (Delhi/Remote/etc), job type, experience (text ok)
   - Job detail page with Apply flow
   - Post a job (admin/moderator by default; later allow verified employers)
   - Apply: store application record + optional cover note + link to resume (URL)

7) /profile
   - View/edit own profile: name, headline, bio, location, skills tags
   - View other member profiles with Connect/Message placeholder (messaging can be v2)

DATABASE (Supabase tables to create):
- profiles: user_id (pk, references auth.users), name, headline, bio, location, skills (text[]), avatar_url, role (user/moderator/admin), community_id, created_at
- posts: id uuid pk, community_id, author_id (fk), is_anonymous boolean, content text, created_at
- comments: id uuid pk, post_id fk, author_id fk, content, created_at
- reactions: id uuid pk, entity_type (post/comment), entity_id, user_id, created_at (unique on entity + user)
- reports: id uuid pk, entity_type, entity_id, reporter_id, reason, created_at
- connections: id uuid pk, community_id, requester_id, receiver_id, status (pending/accepted/declined), created_at (unique pair)
- jobs: id uuid pk, community_id, created_by, title, company, location, job_type, experience, description, created_at
- applications: id uuid pk, job_id fk, applicant_id fk, note, resume_url, created_at (unique job + applicant)
- events: id uuid pk, community_id, created_by, title, description, start_time, end_time, location, created_at
- rsvps: id uuid pk, event_id fk, user_id fk, status (going/not_going), created_at (unique event + user)

SECURITY (RLS requirements):
- profiles: users can read profiles in same community; user can update only their own profile; admins/moderators can read all and manage roles.
- posts/comments: anyone logged-in in community can read; only author can edit/delete their own; moderators/admin can delete any.
- Anonymous handling:
  - posts.author_id is always stored.
  - UI must hide identity when is_anonymous=true.
  - Only moderators/admin can see author in moderation screens (create a simple /admin/moderation page).

IMPLEMENTATION ORDER:
- First generate UI pages + routing + components (mobile-first).
- Then connect Supabase Auth + database + RLS.
- Then wire CRUD for posts/comments, connections, jobs, events.
- Add moderation + reporting last.

Acceptance tests (must pass):
- A logged-in user can create a named post and it shows their name.
- A logged-in user can create an anonymous post and it shows “Anonymous” everywhere in UI.
- A moderator can delete reported posts and (in moderation view) see the real author_id.
- A user can search members and send a connection request; receiver can accept.
- A user can view jobs and apply once; application record is created.

Build this as a working MVP with clean code structure and reusable components.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/d02b50b5-6d7f-493c-9513-dfefe762ef21).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
