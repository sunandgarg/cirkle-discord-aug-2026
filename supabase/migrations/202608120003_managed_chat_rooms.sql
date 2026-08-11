-- Users cannot create rooms or memberships. Cohort rooms are assigned from
-- verified profile/education data; direct rooms require accepted connections.

alter table public.chat_rooms add column if not exists room_type text not null default 'managed';
alter table public.chat_rooms add column if not exists assignment_key text;

update public.chat_rooms
set room_type = 'direct'
where direct_key is not null;

create unique index if not exists chat_rooms_assignment_key_unique
  on public.chat_rooms (assignment_key);
create index if not exists chat_rooms_type_idx
  on public.chat_rooms (room_type, created_at desc);

alter table public.chat_rooms drop constraint if exists chat_rooms_room_type_check;
alter table public.chat_rooms add constraint chat_rooms_room_type_check
  check (room_type in ('direct', 'cohort', 'managed'));

-- Security-definer room functions and service-role jobs remain able to write.
-- Browser clients can only read rooms/memberships granted to them.
revoke insert, update, delete on public.chat_rooms from anon, authenticated;
revoke insert, update, delete on public.chat_members from anon, authenticated;
revoke execute on function public.create_group_room(text, uuid[]) from authenticated;

create or replace function public.classify_managed_chat_room()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.direct_key is not null then
    new.room_type := 'direct';
  elsif new.assignment_key is not null then
    new.room_type := 'cohort';
    new.is_group := true;
  end if;
  return new;
end;
$$;
drop trigger if exists classify_managed_chat_room on public.chat_rooms;
create trigger classify_managed_chat_room
before insert or update of direct_key, assignment_key on public.chat_rooms
for each row execute function public.classify_managed_chat_room();

create or replace function public.sync_user_assigned_chat_rooms(p_user_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  institution_name text;
  course_name text;
  specialisation_name text;
  passing_year_value text;
  desired_keys text[] := array[]::text[];
  cohort_key text;
  cohort_room_id uuid;
begin
  if p_user_id is null then
    return;
  end if;

  select
    coalesce(nullif(trim(education_record.institution), ''), nullif(trim(profile.iit_name), '')),
    nullif(trim(education_record.degree), ''),
    nullif(trim(education_record.branch_area), ''),
    nullif(trim(education_record.passing_year), '')
  into institution_name, course_name, specialisation_name, passing_year_value
  from public.profiles profile
  left join lateral (
    select education.institution, education.degree, education.branch_area, education.passing_year
    from public.education education
    where education.user_id = profile.user_id
    order by (education.id = profile.primary_education_id) desc, education.created_at desc
    limit 1
  ) education_record on true
  where profile.user_id = p_user_id;

  if institution_name is null then
    delete from public.chat_members membership
    using public.chat_rooms room
    where membership.room_id = room.id
      and membership.user_id = p_user_id
      and room.room_type = 'cohort';
    return;
  end if;

  cohort_key := 'college:' || lower(institution_name);
  desired_keys := array_append(desired_keys, cohort_key);
  insert into public.chat_rooms (name, is_group, created_by, room_type, assignment_key)
  values (institution_name, true, null, 'cohort', cohort_key)
  on conflict (assignment_key) do update set name = excluded.name
  returning id into cohort_room_id;
  insert into public.chat_members (room_id, user_id) values (cohort_room_id, p_user_id)
  on conflict (room_id, user_id) do nothing;
  insert into public.chat_room_state (room_id, user_id) values (cohort_room_id, p_user_id)
  on conflict (room_id, user_id) do nothing;

  if course_name is not null then
    cohort_key := 'course:' || lower(institution_name) || chr(31) || lower(course_name);
    desired_keys := array_append(desired_keys, cohort_key);
    insert into public.chat_rooms (name, is_group, created_by, room_type, assignment_key)
    values (course_name || ' · ' || institution_name, true, null, 'cohort', cohort_key)
    on conflict (assignment_key) do update set name = excluded.name
    returning id into cohort_room_id;
    insert into public.chat_members (room_id, user_id) values (cohort_room_id, p_user_id)
    on conflict (room_id, user_id) do nothing;
    insert into public.chat_room_state (room_id, user_id) values (cohort_room_id, p_user_id)
    on conflict (room_id, user_id) do nothing;
  end if;

  if course_name is not null and specialisation_name is not null then
    cohort_key := 'specialisation:' || lower(institution_name) || chr(31) || lower(course_name) || chr(31) || lower(specialisation_name);
    desired_keys := array_append(desired_keys, cohort_key);
    insert into public.chat_rooms (name, is_group, created_by, room_type, assignment_key)
    values (specialisation_name || ' · ' || institution_name, true, null, 'cohort', cohort_key)
    on conflict (assignment_key) do update set name = excluded.name
    returning id into cohort_room_id;
    insert into public.chat_members (room_id, user_id) values (cohort_room_id, p_user_id)
    on conflict (room_id, user_id) do nothing;
    insert into public.chat_room_state (room_id, user_id) values (cohort_room_id, p_user_id)
    on conflict (room_id, user_id) do nothing;
  end if;

  if course_name is not null and specialisation_name is not null and passing_year_value is not null then
    cohort_key := 'year:' || lower(institution_name) || chr(31) || lower(course_name) || chr(31) || lower(specialisation_name) || chr(31) || lower(passing_year_value);
    desired_keys := array_append(desired_keys, cohort_key);
    insert into public.chat_rooms (name, is_group, created_by, room_type, assignment_key)
    values (specialisation_name || ' · Class of ' || passing_year_value, true, null, 'cohort', cohort_key)
    on conflict (assignment_key) do update set name = excluded.name
    returning id into cohort_room_id;
    insert into public.chat_members (room_id, user_id) values (cohort_room_id, p_user_id)
    on conflict (room_id, user_id) do nothing;
    insert into public.chat_room_state (room_id, user_id) values (cohort_room_id, p_user_id)
    on conflict (room_id, user_id) do nothing;
  end if;

  delete from public.chat_members membership
  using public.chat_rooms room
  where membership.room_id = room.id
    and membership.user_id = p_user_id
    and room.room_type = 'cohort'
    and not (room.assignment_key = any(desired_keys));
end;
$$;
revoke all on function public.sync_user_assigned_chat_rooms(uuid) from public;

create or replace function public.sync_my_assigned_chat_rooms()
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  perform public.sync_user_assigned_chat_rooms(auth.uid());
end;
$$;
revoke all on function public.sync_my_assigned_chat_rooms() from public;
grant execute on function public.sync_my_assigned_chat_rooms() to authenticated;

create or replace function public.resync_chat_rooms_after_profile_change()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.sync_user_assigned_chat_rooms(old.user_id);
    return old;
  end if;
  perform public.sync_user_assigned_chat_rooms(new.user_id);
  return new;
end;
$$;

drop trigger if exists resync_chat_rooms_after_profile_change on public.profiles;
create trigger resync_chat_rooms_after_profile_change
after insert or update of iit_name, primary_education_id on public.profiles
for each row execute function public.resync_chat_rooms_after_profile_change();

drop trigger if exists resync_chat_rooms_after_education_change on public.education;
create trigger resync_chat_rooms_after_education_change
after insert or update of institution, degree, branch_area, passing_year or delete on public.education
for each row execute function public.resync_chat_rooms_after_profile_change();

-- Existing users are synchronized lazily on their first chat load. Profile and
-- education changes remain synchronized immediately through the triggers above.
