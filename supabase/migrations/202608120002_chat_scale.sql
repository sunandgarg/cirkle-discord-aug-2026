-- Scalable, connection-gated chat primitives.

alter table public.chat_rooms add column if not exists direct_key text;
create unique index if not exists chat_rooms_direct_key_unique
  on public.chat_rooms (direct_key) where direct_key is not null;
delete from public.chat_members duplicate
using public.chat_members keeper
where duplicate.room_id = keeper.room_id
  and duplicate.user_id = keeper.user_id
  and duplicate.ctid > keeper.ctid;
create unique index if not exists chat_members_room_user_unique
  on public.chat_members (room_id, user_id);

alter table public.messages add column if not exists client_message_id uuid;
alter table public.messages add column if not exists media_path text;
alter table public.messages add column if not exists media_type text;
alter table public.messages add column if not exists edited_at timestamptz;
alter table public.messages add column if not exists deleted_at timestamptz;
alter table public.messages alter column content set default '';

create unique index if not exists messages_sender_client_id_unique
  on public.messages (sender_id, client_message_id)
  where client_message_id is not null;
create index if not exists messages_room_cursor_idx
  on public.messages (room_id, created_at desc, id desc)
  where deleted_at is null;

create table if not exists public.message_receipts (
  message_id uuid not null references public.messages(id) on delete cascade,
  room_id uuid not null references public.chat_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  delivered_at timestamptz not null default now(),
  read_at timestamptz,
  primary key (message_id, user_id)
);
create index if not exists message_receipts_user_read_idx
  on public.message_receipts (user_id, read_at, message_id);
create index if not exists message_receipts_room_message_idx
  on public.message_receipts (room_id, message_id, read_at);

create table if not exists public.chat_room_state (
  room_id uuid not null references public.chat_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  last_message_id uuid references public.messages(id) on delete set null,
  last_content text,
  last_sender_id uuid references auth.users(id) on delete set null,
  last_message_at timestamptz,
  unread_count integer not null default 0 check (unread_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (room_id, user_id)
);
create index if not exists chat_room_state_user_activity_idx
  on public.chat_room_state (user_id, last_message_at desc nulls last);

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'message_receipts') then
    alter publication supabase_realtime add table public.message_receipts;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chat_room_state') then
    alter publication supabase_realtime add table public.chat_room_state;
  end if;
end $$;

create or replace function public.is_chat_member(p_room_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.chat_members
    where room_id = p_room_id and user_id = p_user_id
  );
$$;
revoke all on function public.is_chat_member(uuid, uuid) from public;
grant execute on function public.is_chat_member(uuid, uuid) to authenticated;

alter table public.chat_rooms enable row level security;
alter table public.chat_members enable row level security;
alter table public.messages enable row level security;
alter table public.message_receipts enable row level security;
alter table public.chat_room_state enable row level security;

drop policy if exists "members read chat rooms" on public.chat_rooms;
create policy "members read chat rooms" on public.chat_rooms
for select to authenticated using (public.is_chat_member(id));
drop policy if exists "chat room membership fence" on public.chat_rooms;
create policy "chat room membership fence" on public.chat_rooms as restrictive
for select to authenticated using (public.is_chat_member(id));

drop policy if exists "members read room membership" on public.chat_members;
create policy "members read room membership" on public.chat_members
for select to authenticated using (public.is_chat_member(room_id));
drop policy if exists "chat membership fence" on public.chat_members;
create policy "chat membership fence" on public.chat_members as restrictive
for select to authenticated using (public.is_chat_member(room_id));

drop policy if exists "members read messages" on public.messages;
create policy "members read messages" on public.messages
for select to authenticated using (public.is_chat_member(room_id));
drop policy if exists "message membership fence" on public.messages;
create policy "message membership fence" on public.messages as restrictive
for select to authenticated using (public.is_chat_member(room_id));

drop policy if exists "members send as themselves" on public.messages;
create policy "members send as themselves" on public.messages
for insert to authenticated with check (
  sender_id = auth.uid() and public.is_chat_member(room_id)
);

drop policy if exists "members read receipts" on public.message_receipts;
create policy "members read receipts" on public.message_receipts
for select to authenticated using (public.is_chat_member(room_id));

drop policy if exists "users write their receipts" on public.message_receipts;
create policy "users write their receipts" on public.message_receipts
for insert to authenticated with check (user_id = auth.uid() and public.is_chat_member(room_id));

drop policy if exists "users update their receipts" on public.message_receipts;
create policy "users update their receipts" on public.message_receipts
for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid() and public.is_chat_member(room_id));

drop policy if exists "users read their room state" on public.chat_room_state;
create policy "users read their room state" on public.chat_room_state
for select to authenticated using (user_id = auth.uid());

create or replace function public.validate_new_message()
returns trigger
language plpgsql security invoker
set search_path = public
as $$
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role'
    and (auth.uid() is null or new.sender_id <> auth.uid() or not public.is_chat_member(new.room_id)) then
    raise exception 'Not authorized to send to this room' using errcode = '42501';
  end if;
  if length(new.content) > 10000 then
    raise exception 'Message is too long' using errcode = '22001';
  end if;
  if coalesce(trim(new.content), '') = '' and new.media_path is null then
    raise exception 'Message content or media is required' using errcode = '23514';
  end if;
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role'
    and not public.consume_write_rate_limit('chat_message', 120, interval '1 minute') then
    raise exception 'Message rate limit exceeded' using errcode = 'P0001';
  end if;
  new.status := 'sent';
  return new;
end;
$$;
drop trigger if exists validate_new_message on public.messages;
create trigger validate_new_message before insert on public.messages
for each row execute function public.validate_new_message();

create or replace function public.update_chat_room_state()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.chat_room_state (
    room_id, user_id, last_message_id, last_content, last_sender_id,
    last_message_at, unread_count, updated_at
  )
  select
    new.room_id, member.user_id, new.id,
    case when new.media_path is not null then '📷 Photo' else left(new.content, 240) end,
    new.sender_id, new.created_at,
    case when member.user_id = new.sender_id then 0 else 1 end,
    now()
  from public.chat_members member
  where member.room_id = new.room_id
  on conflict (room_id, user_id) do update
  set last_message_id = excluded.last_message_id,
      last_content = excluded.last_content,
      last_sender_id = excluded.last_sender_id,
      last_message_at = excluded.last_message_at,
      unread_count = case
        when public.chat_room_state.user_id = new.sender_id then public.chat_room_state.unread_count
        else public.chat_room_state.unread_count + 1
      end,
      updated_at = now();
  return new;
end;
$$;
drop trigger if exists update_chat_room_state on public.messages;
create trigger update_chat_room_state after insert on public.messages
for each row execute function public.update_chat_room_state();

create or replace function public.get_or_create_direct_room(p_other_user_id uuid)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  room_key text;
  result_room_id uuid;
begin
  if current_user_id is null or p_other_user_id is null or current_user_id = p_other_user_id then
    raise exception 'Invalid direct-message participant' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.connections
    where status = 'accepted'
      and ((requester_id = current_user_id and receiver_id = p_other_user_id)
        or (requester_id = p_other_user_id and receiver_id = current_user_id))
  ) then
    raise exception 'Only accepted connections can message each other' using errcode = '42501';
  end if;

  room_key := least(current_user_id::text, p_other_user_id::text) || ':' || greatest(current_user_id::text, p_other_user_id::text);
  perform pg_advisory_xact_lock(hashtextextended(room_key, 0));
  select id into result_room_id from public.chat_rooms where direct_key = room_key;
  if result_room_id is null then
    select room.id into result_room_id
    from public.chat_rooms room
    where not room.is_group
      and (select count(*) from public.chat_members member where member.room_id = room.id) = 2
      and public.is_chat_member(room.id, current_user_id)
      and public.is_chat_member(room.id, p_other_user_id)
    order by room.created_at
    limit 1;
    if result_room_id is not null then
      update public.chat_rooms set direct_key = room_key where id = result_room_id;
    end if;
  end if;
  if result_room_id is null then
    insert into public.chat_rooms (is_group, created_by, direct_key)
    values (false, current_user_id, room_key) returning id into result_room_id;
    insert into public.chat_members (room_id, user_id)
    values (result_room_id, current_user_id), (result_room_id, p_other_user_id)
    on conflict (room_id, user_id) do nothing;
    insert into public.chat_room_state (room_id, user_id)
    values (result_room_id, current_user_id), (result_room_id, p_other_user_id)
    on conflict (room_id, user_id) do nothing;
  end if;
  return result_room_id;
end;
$$;
revoke all on function public.get_or_create_direct_room(uuid) from public;
grant execute on function public.get_or_create_direct_room(uuid) to authenticated;

create or replace function public.create_group_room(p_name text, p_member_ids uuid[])
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  result_room_id uuid;
  distinct_member_count integer;
begin
  if current_user_id is null or length(trim(p_name)) not between 1 and 120 then
    raise exception 'A group name between 1 and 120 characters is required' using errcode = '22023';
  end if;
  select count(distinct member_id) into distinct_member_count
  from unnest(coalesce(p_member_ids, array[]::uuid[])) member_id
  where member_id <> current_user_id;
  if distinct_member_count < 1 or distinct_member_count > 255 then
    raise exception 'Groups require 1 to 255 connections' using errcode = '22023';
  end if;
  if exists (
    select 1 from unnest(p_member_ids) member_id
    where member_id <> current_user_id and not exists (
      select 1 from public.connections
      where status = 'accepted'
        and ((requester_id = current_user_id and receiver_id = member_id)
          or (requester_id = member_id and receiver_id = current_user_id))
    )
  ) then
    raise exception 'Every group member must be an accepted connection' using errcode = '42501';
  end if;
  insert into public.chat_rooms (name, is_group, created_by)
  values (trim(p_name), true, current_user_id) returning id into result_room_id;
  insert into public.chat_members (room_id, user_id)
  select result_room_id, member_id
  from (
    select current_user_id as member_id
    union
    select unnest(p_member_ids)
  ) members;
  insert into public.chat_room_state (room_id, user_id)
  select result_room_id, member.user_id from public.chat_members member where member.room_id = result_room_id;
  return result_room_id;
end;
$$;
revoke all on function public.create_group_room(text, uuid[]) from public;
grant execute on function public.create_group_room(text, uuid[]) to authenticated;

create or replace function public.mark_room_read(p_room_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare current_user_id uuid := auth.uid();
begin
  if current_user_id is null or not public.is_chat_member(p_room_id, current_user_id) then
    raise exception 'Not a room member' using errcode = '42501';
  end if;
  update public.chat_room_state set unread_count = 0, updated_at = now()
  where room_id = p_room_id and user_id = current_user_id;
  insert into public.message_receipts (message_id, room_id, user_id, delivered_at, read_at)
  select id, p_room_id, current_user_id, now(), now()
  from (
    select id from public.messages
    where room_id = p_room_id and sender_id <> current_user_id and deleted_at is null
    order by created_at desc limit 500
  ) recent
  on conflict (message_id, user_id) do update set read_at = excluded.read_at;
end;
$$;
revoke all on function public.mark_room_read(uuid) from public;
grant execute on function public.mark_room_read(uuid) to authenticated;

create or replace function public.clear_unread_on_read_receipt()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if new.read_at is not null then
    update public.chat_room_state set unread_count = 0, updated_at = now()
    where room_id = new.room_id and user_id = new.user_id;
  end if;
  return new;
end;
$$;
drop trigger if exists clear_unread_on_read_receipt on public.message_receipts;
create trigger clear_unread_on_read_receipt
after insert or update of read_at on public.message_receipts
for each row execute function public.clear_unread_on_read_receipt();

create or replace function public.get_my_chat_rooms()
returns table(room jsonb)
language sql stable security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', r.id,
    'name', r.name,
    'is_group', r.is_group,
    'avatar_url', r.avatar_url,
    'created_at', r.created_at,
    'created_by', r.created_by,
    'displayName', case when r.is_group then coalesce(r.name, 'Group') else coalesce(other_profile.name, 'User') end,
    'displayAvatar', case when r.is_group then r.avatar_url else other_profile.avatar_url end,
    'unreadCount', coalesce(state.unread_count, 0),
    'lastMessage', case when state.last_message_id is null then null else jsonb_build_object(
      'id', state.last_message_id, 'content', state.last_content,
      'sender_id', state.last_sender_id, 'created_at', state.last_message_at
    ) end
  )
  from public.chat_members mine
  join public.chat_rooms r on r.id = mine.room_id
  left join public.chat_room_state state on state.room_id = r.id and state.user_id = auth.uid()
  left join lateral (
    select profile.name, profile.avatar_url
    from public.chat_members other_member
    join public.profiles profile on profile.user_id = other_member.user_id
    where other_member.room_id = r.id and other_member.user_id <> auth.uid()
    order by other_member.joined_at limit 1
  ) other_profile on true
  where mine.user_id = auth.uid()
  order by state.last_message_at desc nulls last, r.created_at desc;
$$;
revoke all on function public.get_my_chat_rooms() from public;
grant execute on function public.get_my_chat_rooms() to authenticated;

-- Private immutable WebP media. Paths are room/user/object.webp.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-media', 'chat-media', false, 15728640, array['image/webp'])
on conflict (id) do update set public = false, file_size_limit = 15728640, allowed_mime_types = array['image/webp'];

drop policy if exists "chat members read chat media" on storage.objects;
create policy "chat members read chat media" on storage.objects for select to authenticated
using (bucket_id = 'chat-media' and public.is_chat_member((storage.foldername(name))[1]::uuid));

drop policy if exists "chat members upload own webp media" on storage.objects;
create policy "chat members upload own webp media" on storage.objects for insert to authenticated
with check (
  bucket_id = 'chat-media'
  and lower(storage.extension(name)) = 'webp'
  and (storage.foldername(name))[2] = auth.uid()::text
  and public.is_chat_member((storage.foldername(name))[1]::uuid)
);

-- Profile lookup and search paths.
create extension if not exists pg_trgm;
create unique index if not exists profiles_slug_unique on public.profiles (slug) where slug is not null;
create index if not exists profiles_name_trgm_idx on public.profiles using gin (name gin_trgm_ops);
create index if not exists profiles_iit_verified_idx on public.profiles (iit_name, is_verified, user_id);
