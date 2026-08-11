-- Production hardening for forum privacy, read scaling, and high-volume query paths.
-- This migration is additive and safe to apply to the existing Lovable/Supabase schema.

create table if not exists public.message_reads (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists public.write_rate_limits (
  actor_id uuid not null references auth.users(id) on delete cascade,
  action text not null,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 1 check (request_count > 0),
  primary key (actor_id, action)
);

alter table public.write_rate_limits enable row level security;
revoke all on public.write_rate_limits from anon, authenticated;

create or replace function public.consume_write_rate_limit(
  p_action text,
  p_max_requests integer,
  p_window interval
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  current_actor uuid := auth.uid();
  current_count integer;
begin
  if current_actor is null then
    return false;
  end if;
  if p_max_requests < 1 or p_max_requests > 1000 or p_window < interval '1 second' then
    raise exception 'Invalid rate-limit configuration';
  end if;

  insert into public.write_rate_limits as limits (
    actor_id, action, window_started_at, request_count
  ) values (
    current_actor, p_action, now(), 1
  )
  on conflict (actor_id, action) do update
  set window_started_at = case
        when limits.window_started_at + p_window <= now() then now()
        else limits.window_started_at
      end,
      request_count = case
        when limits.window_started_at + p_window <= now() then 1
        else limits.request_count + 1
      end
  returning request_count into current_count;

  return current_count <= p_max_requests;
end;
$$;

revoke all on function public.consume_write_rate_limit(text, integer, interval) from public;
grant execute on function public.consume_write_rate_limit(text, integer, interval) to authenticated;

create or replace function public.enforce_forum_post_rate_limit()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not public.consume_write_rate_limit('forum_post', 30, interval '1 minute') then
    raise exception 'Rate limit exceeded. Please wait before posting again.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_forum_post_rate_limit on public.posts;
create trigger enforce_forum_post_rate_limit
before insert on public.posts
for each row execute function public.enforce_forum_post_rate_limit();

alter table public.message_reads enable row level security;

-- Enforce RLS even if a table was previously created without it. Existing
-- project policies remain in place; this migration does not broaden access.
alter table public.posts enable row level security;
alter table public.profiles enable row level security;
alter table public.comments enable row level security;
alter table public.reactions enable row level security;
alter table public.reports enable row level security;
alter table public.connections enable row level security;
alter table public.jobs enable row level security;
alter table public.applications enable row level security;
alter table public.events enable row level security;
alter table public.rsvps enable row level security;
alter table public.consultations enable row level security;
alter table public.chat_rooms enable row level security;
alter table public.chat_members enable row level security;
alter table public.messages enable row level security;
alter table public.notifications enable row level security;
alter table public.user_roles enable row level security;
alter table public.verifications enable row level security;
alter table public.verification_codes enable row level security;

drop policy if exists "message reads are visible to authenticated users" on public.message_reads;
create policy "message reads are visible to authenticated users"
on public.message_reads for select to authenticated
using (true);

drop policy if exists "users can create their own message reads" on public.message_reads;
create policy "users can create their own message reads"
on public.message_reads for insert to authenticated
with check (auth.uid() = user_id);

drop policy if exists "users can update their own message reads" on public.message_reads;
create policy "users can update their own message reads"
on public.message_reads for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Anonymous authors are masked before rows leave PostgREST. Authors can still see
-- their own ID so edit/delete behavior continues to work. Moderators use the raw
-- posts table from the protected moderation screen.
create or replace view public.forum_posts_public
with (security_invoker = true)
as
select
  case
    when p.is_anonymous and p.author_id <> auth.uid() then null
    else p.author_id
  end as author_id,
  p.batch_filter,
  p.branch_filter,
  p.campus_filter,
  p.channel,
  p.cohort_filter,
  p.community_id,
  p.content,
  p.created_at,
  p.degree_filter,
  p.deleted_at,
  p.deleted_by_user_id,
  p.deleted_for_users,
  p.edited_at,
  p.file_name,
  p.file_size,
  p.file_type,
  p.file_url,
  p.id,
  p.image_url,
  p.is_anonymous,
  p.is_deleted_for_everyone,
  p.pinned_at,
  p.reply_to_id,
  p.reshared_post_id,
  p.scope_key,
  p.scope_type,
  p.student_status_filter,
  p.tags,
  p.voice_duration,
  p.voice_url
from public.posts p;

revoke all on public.forum_posts_public from anon;
grant select on public.forum_posts_public to authenticated;

-- Feed, thread, moderation, relationship, and notification query paths.
create index if not exists posts_scope_created_idx
  on public.posts (scope_type, scope_key, created_at desc)
  where deleted_at is null and reply_to_id is null;
create index if not exists posts_channel_created_idx
  on public.posts (channel, created_at desc)
  where deleted_at is null and reply_to_id is null;
create index if not exists posts_campus_created_idx
  on public.posts (campus_filter, created_at desc)
  where deleted_at is null and reply_to_id is null;
create index if not exists posts_cohort_created_idx
  on public.posts (cohort_filter, created_at desc)
  where deleted_at is null and reply_to_id is null;
create index if not exists posts_reply_created_idx
  on public.posts (reply_to_id, created_at)
  where deleted_at is null;
create index if not exists posts_author_created_idx
  on public.posts (author_id, created_at desc)
  where is_anonymous = false;
create index if not exists reactions_entity_idx
  on public.reactions (entity_type, entity_id);
create index if not exists reports_entity_idx
  on public.reports (entity_type, entity_id, created_at desc);
create index if not exists connections_requester_status_idx
  on public.connections (requester_id, status);
create index if not exists connections_receiver_status_idx
  on public.connections (receiver_id, status);
create index if not exists jobs_created_idx
  on public.jobs (created_at desc);
create index if not exists events_start_idx
  on public.events (start_time);
create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);
create index if not exists consultations_client_created_idx
  on public.consultations (client_id, created_at desc);
create index if not exists consultations_consultant_created_idx
  on public.consultations (consultant_id, created_at desc);
create index if not exists chat_members_user_room_idx
  on public.chat_members (user_id, room_id);

comment on view public.forum_posts_public is
  'Authenticated forum read model. Masks anonymous author IDs for every user except the author.';
comment on table public.message_reads is
  'Normalized, indexed read receipts replacing unbounded posts.seen_by arrays.';
