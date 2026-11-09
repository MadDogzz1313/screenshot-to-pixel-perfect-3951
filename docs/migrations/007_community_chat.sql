-- 007_community_chat.sql — Additiver globaler Community-Chat
-- ENTWURF: Diese Datei wurde vorbereitet, aber in der Lovable-Supabase-Datenbank NICHT ausgeführt.
-- Keine bestehenden Tabellen oder Daten werden gelöscht oder überschrieben.

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  spot_id uuid references public.spots(id) on delete set null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id) on delete set null
);
create index if not exists chat_messages_created_at_idx on public.chat_messages (created_at desc);
create index if not exists chat_messages_author_id_idx on public.chat_messages (author_id, created_at desc);
create index if not exists chat_messages_spot_id_idx on public.chat_messages (spot_id) where spot_id is not null;
alter table public.chat_messages replica identity full;
alter table public.chat_messages enable row level security;
revoke all on public.chat_messages from anon, authenticated;
grant select on public.chat_messages to authenticated;

create table if not exists public.chat_blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index if not exists chat_blocks_blocked_id_idx on public.chat_blocks (blocked_id);
alter table public.chat_blocks enable row level security;
revoke all on public.chat_blocks from anon, authenticated;
grant select on public.chat_blocks to authenticated;

create table if not exists public.chat_reports (
  id uuid primary key default gen_random_uuid(),
  message_id uuid references public.chat_messages(id) on delete set null,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reported_user_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null check (char_length(reason) between 3 and 500),
  status text not null default 'open' check (status in ('open', 'reviewed', 'dismissed')),
  review_note text check (review_note is null or char_length(review_note) <= 500),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists chat_reports_status_idx on public.chat_reports (status, created_at desc);
create index if not exists chat_reports_reported_user_idx on public.chat_reports (reported_user_id, created_at desc);
alter table public.chat_reports enable row level security;
revoke all on public.chat_reports from anon, authenticated;
grant select on public.chat_reports to authenticated;

create table if not exists public.chat_restrictions (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('mute', 'ban')),
  until_at timestamptz,
  reason text check (reason is null or char_length(reason) <= 500),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (kind = 'ban' or until_at is not null)
);
alter table public.chat_restrictions enable row level security;
revoke all on public.chat_restrictions from anon, authenticated;
grant select on public.chat_restrictions to authenticated;

create table if not exists public.chat_moderation_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.profiles(id) on delete set null,
  target_user_id uuid references public.profiles(id) on delete set null,
  message_id uuid references public.chat_messages(id) on delete set null,
  report_id uuid references public.chat_reports(id) on delete set null,
  action text not null check (action in ('delete_message', 'mute', 'ban', 'unmute', 'unban', 'review_report')),
  reason text check (reason is null or char_length(reason) <= 500),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists chat_moderation_log_created_at_idx on public.chat_moderation_log (created_at desc);
alter table public.chat_moderation_log enable row level security;
revoke all on public.chat_moderation_log from anon, authenticated;
grant select on public.chat_moderation_log to authenticated;

-- Nur die serverseitige Sendefunktion darf Rate-Limit-Ereignisse schreiben.
create table if not exists public.chat_send_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists chat_send_events_user_time_idx on public.chat_send_events (user_id, created_at desc);
alter table public.chat_send_events enable row level security;
revoke all on public.chat_send_events from anon, authenticated;

create or replace function public.chat_is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_role(auth.uid(), 'admin'::public.app_role)
$$;

create or replace function public.chat_is_blocked(_viewer uuid, _author uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.chat_blocks
    where (blocker_id = _viewer and blocked_id = _author)
       or (blocker_id = _author and blocked_id = _viewer)
  )
$$;

create or replace function public.send_chat_message(_body text, _spot_id uuid default null)
returns public.chat_messages
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  clean_body text := btrim(coalesce(_body, ''));
  recent_count integer;
  result public.chat_messages;
begin
  if uid is null then raise exception 'CHAT_AUTH_REQUIRED' using errcode = '28000'; end if;
  if char_length(clean_body) < 1 then raise exception 'CHAT_EMPTY_MESSAGE'; end if;
  if char_length(clean_body) > 500 then raise exception 'CHAT_MESSAGE_TOO_LONG'; end if;

  if exists (select 1 from public.chat_restrictions r where r.user_id = uid and r.kind = 'ban' and (r.until_at is null or r.until_at > now())) then
    raise exception 'CHAT_BANNED';
  end if;
  if exists (select 1 from public.chat_restrictions r where r.user_id = uid and r.kind = 'mute' and r.until_at > now()) then
    raise exception 'CHAT_MUTED';
  end if;
  if _spot_id is not null and not exists (
    select 1 from public.spots s where s.id = _spot_id and s.status = 'approved'
  ) then
    raise exception 'CHAT_SPOT_NOT_PUBLIC';
  end if;

  delete from public.chat_send_events where created_at < now() - interval '2 minutes';
  select count(*) into recent_count from public.chat_send_events
    where user_id = uid and created_at > now() - interval '30 seconds';
  if recent_count >= 8 then raise exception 'CHAT_RATE_LIMIT'; end if;
  insert into public.chat_send_events (user_id) values (uid);

  insert into public.chat_messages (author_id, body, spot_id)
  values (uid, clean_body, _spot_id)
  returning * into result;
  return result;
end $$;

create or replace function public.delete_chat_message(_message_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare uid uuid := auth.uid(); author uuid; admin boolean;
begin
  if uid is null then raise exception 'CHAT_AUTH_REQUIRED' using errcode = '28000'; end if;
  select author_id into author from public.chat_messages where id = _message_id and deleted_at is null;
  if author is null then raise exception 'CHAT_MESSAGE_NOT_FOUND'; end if;
  admin := public.chat_is_admin();
  if author <> uid and not admin then raise exception 'CHAT_DELETE_FORBIDDEN' using errcode = '42501'; end if;
  update public.chat_messages set deleted_at = now(), deleted_by = uid where id = _message_id;
  if admin and author <> uid then
    insert into public.chat_moderation_log (actor_id, target_user_id, message_id, action)
    values (uid, author, _message_id, 'delete_message');
  end if;
end $$;

create or replace function public.report_chat_message(_message_id uuid, _reason text)
returns void
language plpgsql security definer set search_path = public
as $$
declare uid uuid := auth.uid(); target uuid; clean_reason text := btrim(coalesce(_reason, ''));
begin
  if uid is null then raise exception 'CHAT_AUTH_REQUIRED' using errcode = '28000'; end if;
  if char_length(clean_reason) < 3 or char_length(clean_reason) > 500 then raise exception 'CHAT_INVALID_REPORT'; end if;
  select author_id into target from public.chat_messages where id = _message_id and deleted_at is null;
  if target is null then raise exception 'CHAT_MESSAGE_NOT_FOUND'; end if;
  if target = uid then raise exception 'CHAT_SELF_REPORT'; end if;
  insert into public.chat_reports (message_id, reporter_id, reported_user_id, reason)
  values (_message_id, uid, target, clean_reason);
end $$;

create or replace function public.block_chat_user(_blocked_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'CHAT_AUTH_REQUIRED' using errcode = '28000'; end if;
  if auth.uid() = _blocked_id then raise exception 'CHAT_SELF_BLOCK'; end if;
  insert into public.chat_blocks (blocker_id, blocked_id) values (auth.uid(), _blocked_id) on conflict do nothing;
end $$;

create or replace function public.unblock_chat_user(_blocked_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'CHAT_AUTH_REQUIRED' using errcode = '28000'; end if;
  delete from public.chat_blocks where blocker_id = auth.uid() and blocked_id = _blocked_id;
end $$;

create or replace function public.admin_set_chat_restriction(_user_id uuid, _kind text, _until_at timestamptz default null, _reason text default null)
returns void
language plpgsql security definer set search_path = public
as $$
declare uid uuid := auth.uid();
begin
  if uid is null or not public.chat_is_admin() then raise exception 'CHAT_ADMIN_REQUIRED' using errcode = '42501'; end if;
  if _user_id = uid then raise exception 'CHAT_SELF_RESTRICTION'; end if;
  if _kind = 'clear' then
    if exists (select 1 from public.chat_restrictions where user_id = _user_id and kind = 'mute') then
      insert into public.chat_moderation_log (actor_id, target_user_id, action, reason) values (uid, _user_id, 'unmute', _reason);
    end if;
    if exists (select 1 from public.chat_restrictions where user_id = _user_id and kind = 'ban') then
      insert into public.chat_moderation_log (actor_id, target_user_id, action, reason) values (uid, _user_id, 'unban', _reason);
    end if;
    delete from public.chat_restrictions where user_id = _user_id;
    return;
  end if;
  if _kind not in ('mute', 'ban') then raise exception 'CHAT_INVALID_RESTRICTION'; end if;
  if _kind = 'mute' and (_until_at is null or _until_at <= now()) then raise exception 'CHAT_INVALID_MUTE_DURATION'; end if;
  insert into public.chat_restrictions (user_id, kind, until_at, reason, created_by, updated_at)
  values (_user_id, _kind, _until_at, nullif(btrim(_reason), ''), uid, now())
  on conflict (user_id) do update set kind = excluded.kind, until_at = excluded.until_at, reason = excluded.reason, created_by = excluded.created_by, updated_at = now();
  insert into public.chat_moderation_log (actor_id, target_user_id, action, reason, metadata)
  values (uid, _user_id, _kind, _reason, jsonb_build_object('until_at', _until_at));
end $$;

create or replace function public.review_chat_report(_report_id uuid, _status text, _note text default null)
returns void
language plpgsql security definer set search_path = public
as $$
declare uid uuid := auth.uid();
begin
  if uid is null or not public.chat_is_admin() then raise exception 'CHAT_ADMIN_REQUIRED' using errcode = '42501'; end if;
  if _status not in ('reviewed', 'dismissed') then raise exception 'CHAT_INVALID_REPORT_STATUS'; end if;
  update public.chat_reports set status = _status, review_note = nullif(btrim(_note), ''), reviewed_by = uid, reviewed_at = now() where id = _report_id;
  if not found then raise exception 'CHAT_REPORT_NOT_FOUND'; end if;
  insert into public.chat_moderation_log (actor_id, report_id, action, reason, metadata)
  values (uid, _report_id, 'review_report', _note, jsonb_build_object('status', _status));
end $$;

-- RLS: Nachrichten werden zwischen gegenseitig blockierten Nutzern ausgeblendet.
drop policy if exists "chat messages read authenticated" on public.chat_messages;
create policy "chat messages read authenticated" on public.chat_messages for select to authenticated using (
  deleted_at is null and (
    public.chat_is_admin() or not public.chat_is_blocked(auth.uid(), author_id)
  )
);
drop policy if exists "chat blocks own read" on public.chat_blocks;
create policy "chat blocks own read" on public.chat_blocks for select to authenticated using (blocker_id = auth.uid());
drop policy if exists "chat reports own or admin read" on public.chat_reports;
create policy "chat reports own or admin read" on public.chat_reports for select to authenticated using (reporter_id = auth.uid() or public.chat_is_admin());
drop policy if exists "chat restrictions own or admin read" on public.chat_restrictions;
create policy "chat restrictions own or admin read" on public.chat_restrictions for select to authenticated using (user_id = auth.uid() or public.chat_is_admin());
drop policy if exists "chat moderation admin read" on public.chat_moderation_log;
create policy "chat moderation admin read" on public.chat_moderation_log for select to authenticated using (public.chat_is_admin());

revoke execute on function public.chat_is_admin(), public.chat_is_blocked(uuid, uuid), public.send_chat_message(text, uuid), public.delete_chat_message(uuid), public.report_chat_message(uuid, text), public.block_chat_user(uuid), public.unblock_chat_user(uuid), public.admin_set_chat_restriction(uuid, text, timestamptz, text), public.review_chat_report(uuid, text, text) from public, anon;
grant execute on function public.chat_is_admin(), public.chat_is_blocked(uuid, uuid), public.send_chat_message(text, uuid), public.delete_chat_message(uuid), public.report_chat_message(uuid, text), public.block_chat_user(uuid), public.unblock_chat_user(uuid), public.admin_set_chat_restriction(uuid, text, timestamptz, text), public.review_chat_report(uuid, text, text) to authenticated;

-- Realtime: nur die Nachrichten werden veröffentlicht; Presence läuft ohne Datenbanktabelle.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chat_messages') then
    execute 'alter publication supabase_realtime add table public.chat_messages';
  end if;
exception when others then
  raise notice 'Realtime-Publikation konnte nicht automatisch erweitert werden: %', sqlerrm;
end $$;

-- Aufräumen alter Rate-Limit-Einträge kann später über den bestehenden Wartungsjob erfolgen.
