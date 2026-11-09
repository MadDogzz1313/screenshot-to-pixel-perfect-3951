-- 008_freunde_privatchat_moderation.sql — Freunde, Privatchats, Benachrichtigungen, Meldungen, Blockieren, Kontosperren
-- ENTWURF: vorbereitet, aber NICHT in der Lovable-Datenbank ausgeführt (kein Zugang ohne Lovable).
-- Voraussetzung: 004_profile_badges.sql und 007_community_chat.sql wurden ausgeführt.
-- Rein additiv: keine Tabelle wird gelöscht oder geleert, keine Rolle wird verändert. Mehrfach ausführbar.

do $$ begin
  if to_regclass('public.badges') is null then raise exception 'Bitte zuerst 004_profile_badges.sql ausführen.'; end if;
  if to_regclass('public.chat_blocks') is null then raise exception 'Bitte zuerst 007_community_chat.sql ausführen.'; end if;
end $$;

------------------------------------------------------------------------------------------------
-- TEIL A: Privatsphäre der Freundesliste (Standard: privat – auch für bestehende Nutzer)
------------------------------------------------------------------------------------------------
alter table public.profiles add column if not exists show_friends boolean not null default false;
grant update (show_friends) on public.profiles to authenticated;

-- Geschützte Profil-Ansicht wie in 004, ergänzt um show_friends (nur für Besitzer/Admin sichtbar)
create or replace view public.profile_cards with (security_invoker = false) as
select p.id, p.username,
  (p.id = auth.uid() or public.has_role(auth.uid(), 'admin')) as full_access,
  p.is_private,
  case when p.id = auth.uid() or public.has_role(auth.uid(), 'admin') or (not p.is_private and p.show_avatar) then p.avatar_url end as avatar_path,
  case when p.id = auth.uid() or public.has_role(auth.uid(), 'admin') or not p.is_private then p.bio end as bio,
  case when p.id = auth.uid() or public.has_role(auth.uid(), 'admin') or not p.is_private then p.xp end as xp,
  case when p.id = auth.uid() or public.has_role(auth.uid(), 'admin') or (not p.is_private and p.show_join_date) then p.created_at end as joined_at,
  case when p.id = auth.uid() or public.has_role(auth.uid(), 'admin') or (not p.is_private and p.show_badges) then p.featured_badges end as featured_badges,
  case when p.id = auth.uid() or public.has_role(auth.uid(), 'admin') then p.show_avatar end as show_avatar,
  case when p.id = auth.uid() or public.has_role(auth.uid(), 'admin') then p.show_join_date end as show_join_date,
  case when p.id = auth.uid() or public.has_role(auth.uid(), 'admin') then p.show_badges end as show_badges,
  case when p.id = auth.uid() then p.show_friends end as show_friends
from public.profiles p;
grant select on public.profile_cards to anon, authenticated;

------------------------------------------------------------------------------------------------
-- TEIL B: Tabellen (Schreiben ausschließlich über geprüfte Datenbank-Funktionen)
------------------------------------------------------------------------------------------------
create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (sender_id <> receiver_id)
);
-- höchstens EINE offene Anfrage pro Paar (egal in welche Richtung)
create unique index if not exists friend_requests_one_pending on public.friend_requests
  (least(sender_id, receiver_id), greatest(sender_id, receiver_id)) where status = 'pending';
create index if not exists friend_requests_receiver_idx on public.friend_requests (receiver_id, status);
create index if not exists friend_requests_sender_idx on public.friend_requests (sender_id, status);

create table if not exists public.friendships (
  user_a uuid not null references public.profiles(id) on delete cascade,
  user_b uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_a, user_b),
  check (user_a < user_b)
);
create index if not exists friendships_user_b_idx on public.friendships (user_b);

create table if not exists public.private_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  body text not null default '',
  created_at timestamptz not null default now(),
  read_at timestamptz,
  deleted_at timestamptz,
  check (sender_id <> receiver_id),
  check (deleted_at is not null or char_length(body) between 1 and 1000)
);
create index if not exists private_messages_pair_idx on public.private_messages
  (least(sender_id, receiver_id), greatest(sender_id, receiver_id), created_at desc);
create index if not exists private_messages_unread_idx on public.private_messages (receiver_id, sender_id) where read_at is null;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('friend_request', 'friend_accepted', 'private_message', 'community', 'admin')),
  actor_id uuid references public.profiles(id) on delete set null,
  ref_id uuid,
  title text not null check (char_length(title) <= 120),
  body text check (body is null or char_length(body) <= 500),
  created_at timestamptz not null default now(),
  read_at timestamptz
);
-- keine doppelten Benachrichtigungen für dasselbe Ereignis
create unique index if not exists notifications_unique_event on public.notifications (user_id, kind, ref_id) where ref_id is not null;
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);
create index if not exists notifications_unread_idx on public.notifications (user_id) where read_at is null;

create table if not exists public.user_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reported_user_id uuid not null references public.profiles(id) on delete cascade,
  message_id uuid references public.private_messages(id) on delete set null,
  message_excerpt text check (message_excerpt is null or char_length(message_excerpt) <= 1000),
  reason text not null check (reason in ('harassment', 'spam', 'fraud', 'inappropriate', 'suspicious', 'other')),
  details text check (details is null or char_length(details) <= 1000),
  status text not null default 'open' check (status in ('open', 'in_review', 'resolved', 'dismissed')),
  admin_note text check (admin_note is null or char_length(admin_note) <= 1000),
  handled_by uuid references public.profiles(id) on delete set null,
  handled_at timestamptz,
  created_at timestamptz not null default now(),
  check (reporter_id <> reported_user_id)
);
create unique index if not exists user_reports_one_open on public.user_reports (reporter_id, reported_user_id)
  where status in ('open', 'in_review') and message_id is null;
create unique index if not exists user_reports_one_per_message on public.user_reports (reporter_id, message_id) where message_id is not null;
create index if not exists user_reports_status_idx on public.user_reports (status, created_at desc);
create index if not exists user_reports_reported_idx on public.user_reports (reported_user_id);

create table if not exists public.account_bans (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  until_at timestamptz,                              -- null = permanent
  reason text check (reason is null or char_length(reason) <= 500),
  reason_visible boolean not null default true,      -- Grund auf dem Sperrbildschirm zeigen?
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.account_moderation_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  target_user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  reason text check (reason is null or char_length(reason) <= 1000),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.account_moderation_log drop constraint if exists account_moderation_log_action_check;
alter table public.account_moderation_log add constraint account_moderation_log_action_check
  check (action in ('warn', 'ban', 'unban', 'report_update', 'broadcast', 'review_request'));
create index if not exists account_moderation_log_created_idx on public.account_moderation_log (created_at desc);
create index if not exists account_moderation_log_target_idx on public.account_moderation_log (target_user_id, created_at desc);

create table if not exists public.action_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  action text not null,
  created_at timestamptz not null default now()
);
create index if not exists action_events_user_idx on public.action_events (user_id, action, created_at desc);

-- RLS + Rechte: Lesen nur eigene Daten, Schreiben nie direkt
alter table public.friend_requests enable row level security;
alter table public.friendships enable row level security;
alter table public.private_messages enable row level security;
alter table public.notifications enable row level security;
alter table public.user_reports enable row level security;
alter table public.account_bans enable row level security;
alter table public.account_moderation_log enable row level security;
alter table public.action_events enable row level security;
revoke all on public.friend_requests, public.friendships, public.private_messages, public.notifications,
  public.user_reports, public.account_bans, public.account_moderation_log, public.action_events from anon, authenticated;
grant select on public.friend_requests, public.friendships, public.private_messages, public.notifications to authenticated;

drop policy if exists "friend requests own" on public.friend_requests;
create policy "friend requests own" on public.friend_requests for select to authenticated using (auth.uid() in (sender_id, receiver_id));
drop policy if exists "friendships own" on public.friendships;
create policy "friendships own" on public.friendships for select to authenticated using (auth.uid() in (user_a, user_b));
-- Privatnachrichten: NUR die beiden Gesprächsteilnehmer (auch Admins nicht pauschal)
drop policy if exists "private messages participants" on public.private_messages;
create policy "private messages participants" on public.private_messages for select to authenticated using (auth.uid() in (sender_id, receiver_id));
drop policy if exists "notifications own" on public.notifications;
create policy "notifications own" on public.notifications for select to authenticated using (auth.uid() = user_id);
-- user_reports, account_bans, account_moderation_log, action_events: kein direkter Zugriff (nur über Admin-Funktionen)

alter table public.private_messages replica identity full;
alter table public.notifications replica identity full;
alter table public.friend_requests replica identity full;

------------------------------------------------------------------------------------------------
-- TEIL C: Hilfsfunktionen
------------------------------------------------------------------------------------------------
create or replace function public.is_account_banned(_u uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select _u is not null and exists (select 1 from public.account_bans b where b.user_id = _u and (b.until_at is null or b.until_at > now()))
$$;

create or replace function public.are_friends(_a uuid, _b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.friendships where user_a = least(_a, _b) and user_b = greatest(_a, _b))
$$;

-- angemeldet + nicht gesperrt, sonst Abbruch
create or replace function public.require_active_user() returns uuid
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode = '28000'; end if;
  if public.is_account_banned(auth.uid()) then raise exception 'ACCOUNT_BANNED'; end if;
  return auth.uid();
end $$;

create or replace function public.require_admin() returns uuid
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.has_role(auth.uid(), 'admin') then raise exception 'ADMIN_ONLY'; end if;
  return auth.uid();
end $$;

-- serverseitiges Rate-Limit pro Nutzer und Aktion
create or replace function public.hit_rate_limit(_action text, _max integer, _window interval) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from public.action_events where created_at < now() - interval '1 day';
  if (select count(*) from public.action_events where user_id = auth.uid() and action = _action and created_at > now() - _window) >= _max then
    raise exception 'RATE_LIMIT';
  end if;
  insert into public.action_events (user_id, action) values (auth.uid(), _action);
end $$;

-- Benachrichtigung anlegen; dasselbe Ereignis (ref_id) wird nicht doppelt angelegt, sondern wieder "ungelesen"
create or replace function public.notify_user(_user uuid, _kind text, _actor uuid, _ref uuid, _title text, _body text) returns void
language sql security definer set search_path = public as $$
  insert into public.notifications (user_id, kind, actor_id, ref_id, title, body) values (_user, _kind, _actor, _ref, left(_title, 120), left(_body, 500))
  on conflict (user_id, kind, ref_id) where ref_id is not null
  do update set read_at = null, created_at = now(), actor_id = excluded.actor_id, title = excluded.title, body = excluded.body
$$;

-- Kontosperre technisch durchsetzen: gesperrte Nutzer können nichts Neues erstellen (auch ohne Sperrbildschirm)
create or replace function public.forbid_banned_writes() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.is_account_banned(auth.uid()) then raise exception 'ACCOUNT_BANNED'; end if;
  return new;
end $$;
do $$ declare t text; begin
  foreach t in array array['spots', 'spot_photos', 'spot_corrections', 'spot_likes', 'chat_messages', 'chat_reports', 'friend_requests', 'friendships', 'private_messages', 'user_reports'] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists zz_forbid_banned on public.%I', t);
      execute format('create trigger zz_forbid_banned before insert on public.%I for each row execute function public.forbid_banned_writes()', t);
    end if;
  end loop;
end $$;
-- Gesperrte Nutzer dürfen ihr eigenes Profil (Bio, Bild, Name) nicht ändern
create or replace function public.forbid_banned_profile_edit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.id = auth.uid() and public.is_account_banned(auth.uid()) then raise exception 'ACCOUNT_BANNED'; end if;
  return new;
end $$;
drop trigger if exists zz_forbid_banned_profile on public.profiles;
create trigger zz_forbid_banned_profile before update on public.profiles for each row execute function public.forbid_banned_profile_edit();

------------------------------------------------------------------------------------------------
-- TEIL D: Freundschaften
------------------------------------------------------------------------------------------------
create or replace function public.respond_friend_request(_request_id uuid, _accept boolean) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.require_active_user(); req public.friend_requests;
begin
  select * into req from public.friend_requests where id = _request_id for update;
  if not found or req.receiver_id <> uid then raise exception 'FRIEND_REQUEST_NOT_FOUND'; end if;
  if req.status <> 'pending' then raise exception 'FRIEND_REQUEST_CLOSED'; end if;
  if _accept and public.chat_is_blocked(req.sender_id, uid) then raise exception 'FRIEND_BLOCKED'; end if;
  update public.friend_requests set status = case when _accept then 'accepted' else 'declined' end, responded_at = now() where id = _request_id;
  if _accept then
    insert into public.friendships (user_a, user_b) values (least(req.sender_id, uid), greatest(req.sender_id, uid)) on conflict do nothing;
    perform public.notify_user(req.sender_id, 'friend_accepted', uid, req.id, 'Freundschaft angenommen', 'Ihr seid jetzt Freunde');
  end if;
  update public.notifications set read_at = coalesce(read_at, now()) where user_id = uid and kind = 'friend_request' and ref_id = _request_id;
end $$;

create or replace function public.send_friend_request(_to uuid) returns text
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.require_active_user(); req public.friend_requests;
begin
  if _to is null or _to = uid then raise exception 'FRIEND_SELF'; end if;
  if not exists (select 1 from public.profiles where id = _to) then raise exception 'FRIEND_USER_NOT_FOUND'; end if;
  if public.chat_is_blocked(uid, _to) then raise exception 'FRIEND_BLOCKED'; end if;
  if public.are_friends(uid, _to) then raise exception 'FRIEND_ALREADY'; end if;
  select * into req from public.friend_requests where status = 'pending'
    and ((sender_id = uid and receiver_id = _to) or (sender_id = _to and receiver_id = uid)) limit 1;
  if found then
    if req.sender_id = uid then raise exception 'FRIEND_ALREADY_REQUESTED'; end if;
    perform public.respond_friend_request(req.id, true);   -- Gegenanfrage = annehmen (kein Widerspruch)
    return 'accepted';
  end if;
  perform public.hit_rate_limit('friend_request', 20, interval '1 hour');
  insert into public.friend_requests (sender_id, receiver_id) values (uid, _to) returning * into req;
  perform public.notify_user(_to, 'friend_request', uid, req.id, 'Neue Freundschaftsanfrage', 'Möchte mit dir befreundet sein');
  return 'sent';
end $$;

create or replace function public.cancel_friend_request(_request_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'AUTH_REQUIRED' using errcode = '28000'; end if;
  update public.friend_requests set status = 'cancelled', responded_at = now()
    where id = _request_id and sender_id = uid and status = 'pending';
  if not found then raise exception 'FRIEND_REQUEST_NOT_FOUND'; end if;
  delete from public.notifications where kind = 'friend_request' and ref_id = _request_id;
end $$;

create or replace function public.remove_friend(_other uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode = '28000'; end if;
  delete from public.friendships where user_a = least(auth.uid(), _other) and user_b = greatest(auth.uid(), _other);
end $$;

-- Persönlich blockieren: entfernt Freundschaft + offene Anfragen, sperrt NICHT das Konto des anderen
create or replace function public.block_user(_other uuid) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'AUTH_REQUIRED' using errcode = '28000'; end if;
  if _other is null or _other = uid then raise exception 'BLOCK_SELF'; end if;
  insert into public.chat_blocks (blocker_id, blocked_id) values (uid, _other) on conflict do nothing;
  delete from public.friendships where user_a = least(uid, _other) and user_b = greatest(uid, _other);
  delete from public.notifications where kind = 'friend_request' and ref_id in (select id from public.friend_requests
    where status = 'pending' and ((sender_id = uid and receiver_id = _other) or (sender_id = _other and receiver_id = uid)));
  update public.friend_requests set status = 'cancelled', responded_at = now()
    where status = 'pending' and ((sender_id = uid and receiver_id = _other) or (sender_id = _other and receiver_id = uid));
end $$;

create or replace function public.unblock_user(_other uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode = '28000'; end if;
  delete from public.chat_blocks where blocker_id = auth.uid() and blocked_id = _other;
end $$;

-- Blockieren im Community-Chat wirkt ab jetzt genauso (entfernt auch Freundschaft/Anfragen)
create or replace function public.block_chat_user(_blocked_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin perform public.block_user(_blocked_id); end $$;

-- Eigener Freundschaftsstatus (Freunde, Anfragen, Blockierliste) in einem Aufruf
create or replace function public.my_friend_state() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'friends', coalesce((select jsonb_agg(jsonb_build_object('id', case when f.user_a = auth.uid() then f.user_b else f.user_a end, 'since', f.created_at) order by f.created_at desc)
      from public.friendships f where auth.uid() in (f.user_a, f.user_b)), '[]'::jsonb),
    'incoming', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'user_id', r.sender_id, 'created_at', r.created_at) order by r.created_at desc)
      from public.friend_requests r where r.receiver_id = auth.uid() and r.status = 'pending'), '[]'::jsonb),
    'outgoing', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'user_id', r.receiver_id, 'created_at', r.created_at) order by r.created_at desc)
      from public.friend_requests r where r.sender_id = auth.uid() and r.status = 'pending'), '[]'::jsonb),
    'blocked', coalesce((select jsonb_agg(b.blocked_id) from public.chat_blocks b where b.blocker_id = auth.uid()), '[]'::jsonb))
  where auth.uid() is not null
$$;

-- Freundesliste eines Spielers nach Privatsphäre: privat -> {visible:false}; öffentlich -> nur Freunde mit nicht-privatem Profil
create or replace function public.friends_of(_user uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare o public.profiles; ids jsonb;
begin
  select * into o from public.profiles where id = _user;
  if not found then return jsonb_build_object('visible', false, 'count', null, 'friends', '[]'::jsonb); end if;
  if _user = auth.uid() then
    select coalesce(jsonb_agg(case when f.user_a = _user then f.user_b else f.user_a end), '[]'::jsonb) into ids
      from public.friendships f where _user in (f.user_a, f.user_b);
    return jsonb_build_object('visible', true, 'count', jsonb_array_length(ids), 'friends', ids);
  end if;
  if o.is_private or not o.show_friends then return jsonb_build_object('visible', false, 'count', null, 'friends', '[]'::jsonb); end if;
  select coalesce(jsonb_agg(p.id), '[]'::jsonb) into ids
    from public.friendships f join public.profiles p on p.id = case when f.user_a = _user then f.user_b else f.user_a end
    where _user in (f.user_a, f.user_b) and not p.is_private;
  return jsonb_build_object('visible', true, 'count', jsonb_array_length(ids), 'friends', ids);
end $$;

------------------------------------------------------------------------------------------------
-- TEIL E: Private Nachrichten (nur zwischen bestätigten Freunden, nie bei Blockierung/Sperre)
------------------------------------------------------------------------------------------------
create or replace function public.send_private_message(_to uuid, _body text) returns public.private_messages
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.require_active_user(); clean text := btrim(coalesce(_body, '')); msg public.private_messages;
begin
  if char_length(clean) < 1 then raise exception 'PM_EMPTY'; end if;
  if char_length(clean) > 1000 then raise exception 'PM_TOO_LONG'; end if;
  if public.chat_is_blocked(uid, _to) then raise exception 'PM_BLOCKED'; end if;
  if not public.are_friends(uid, _to) then raise exception 'PM_NOT_FRIENDS'; end if;
  perform public.hit_rate_limit('private_message', 20, interval '1 minute');
  insert into public.private_messages (sender_id, receiver_id, body) values (uid, _to, clean) returning * into msg;
  -- eine Benachrichtigung pro Gespräch (wird bei neuer Nachricht wieder ungelesen)
  perform public.notify_user(_to, 'private_message', uid, uid, 'Neue private Nachricht', 'Hat dir geschrieben');
  return msg;
end $$;

-- Eigene Nachricht löschen: Inhalt wird datenschutzgerecht entfernt, Platzhalter bleibt
create or replace function public.delete_private_message(_message_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode = '28000'; end if;
  update public.private_messages set body = '', deleted_at = now() where id = _message_id and sender_id = auth.uid() and deleted_at is null;
  if not found then raise exception 'PM_NOT_FOUND'; end if;
end $$;

create or replace function public.mark_conversation_read(_other uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode = '28000'; end if;
  update public.private_messages set read_at = now() where receiver_id = auth.uid() and sender_id = _other and read_at is null;
  update public.notifications set read_at = now() where user_id = auth.uid() and kind = 'private_message' and ref_id = _other and read_at is null;
end $$;

create or replace function public.my_conversations()
returns table (other_id uuid, last_body text, last_at timestamptz, last_from_me boolean, last_deleted boolean, unread bigint)
language sql stable security definer set search_path = public as $$
  with m as (
    select pm.*, case when pm.sender_id = auth.uid() then pm.receiver_id else pm.sender_id end as other
    from public.private_messages pm where auth.uid() in (pm.sender_id, pm.receiver_id)),
  lm as (select distinct on (m.other) m.other, m.body, m.created_at, m.sender_id = auth.uid() as mine, m.deleted_at is not null as del from m order by m.other, m.created_at desc)
  select l.other, left(l.body, 120), l.created_at, l.mine, l.del,
    (select count(*) from m where m.other = l.other and m.receiver_id = auth.uid() and m.read_at is null and m.deleted_at is null)
  from lm l order by l.created_at desc
$$;

------------------------------------------------------------------------------------------------
-- TEIL F: Melden + Benachrichtigungen
------------------------------------------------------------------------------------------------
create or replace function public.report_user(_user uuid, _reason text, _details text default null) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.require_active_user();
begin
  if _user is null or _user = uid then raise exception 'REPORT_SELF'; end if;
  if not exists (select 1 from public.profiles where id = _user) then raise exception 'REPORT_USER_NOT_FOUND'; end if;
  if _reason not in ('harassment', 'spam', 'fraud', 'inappropriate', 'suspicious', 'other') then raise exception 'REPORT_INVALID_REASON'; end if;
  if exists (select 1 from public.user_reports where reporter_id = uid and reported_user_id = _user and message_id is null and status in ('open', 'in_review')) then
    raise exception 'REPORT_DUPLICATE';
  end if;
  perform public.hit_rate_limit('report', 10, interval '1 hour');
  insert into public.user_reports (reporter_id, reported_user_id, reason, details)
  values (uid, _user, _reason, nullif(left(btrim(coalesce(_details, '')), 1000), ''));
end $$;

-- Nur empfangene Nachrichten können gemeldet werden; Admins sehen nur diesen einen Nachrichtentext
create or replace function public.report_private_message(_message_id uuid, _reason text, _details text default null) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.require_active_user(); msg public.private_messages;
begin
  select * into msg from public.private_messages where id = _message_id and receiver_id = uid and deleted_at is null;
  if not found then raise exception 'PM_NOT_FOUND'; end if;
  if _reason not in ('harassment', 'spam', 'fraud', 'inappropriate', 'suspicious', 'other') then raise exception 'REPORT_INVALID_REASON'; end if;
  if exists (select 1 from public.user_reports where reporter_id = uid and message_id = _message_id) then raise exception 'REPORT_DUPLICATE'; end if;
  perform public.hit_rate_limit('report', 10, interval '1 hour');
  insert into public.user_reports (reporter_id, reported_user_id, message_id, message_excerpt, reason, details)
  values (uid, msg.sender_id, msg.id, left(msg.body, 1000), _reason, nullif(left(btrim(coalesce(_details, '')), 1000), ''));
end $$;

create or replace function public.mark_notifications_read(_ids uuid[]) returns void
language sql security definer set search_path = public as $$
  update public.notifications set read_at = now() where user_id = auth.uid() and id = any(_ids) and read_at is null
$$;

-- Eigene Sperre (für den Sperrbildschirm); Grund nur, wenn zur Anzeige freigegeben
create or replace function public.my_account_ban()
returns table (until_at timestamptz, permanent boolean, reason text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select b.until_at, b.until_at is null, case when b.reason_visible then b.reason end, b.created_at
  from public.account_bans b where b.user_id = auth.uid() and (b.until_at is null or b.until_at > now())
$$;

------------------------------------------------------------------------------------------------
-- TEIL G: Admin-Benutzerverwaltung (nur echte Admins über has_role; Admins sind geschützt)
------------------------------------------------------------------------------------------------
create or replace function public.admin_search_users(_q text default '')
returns table (id uuid, username text, created_at timestamptz, is_admin boolean, is_private boolean, banned boolean, ban_until timestamptz, ban_reason text, open_reports bigint, warnings bigint)
language plpgsql stable security definer set search_path = public as $$
declare pattern text := '%' || replace(replace(replace(coalesce(btrim(_q), ''), '\', '\\'), '%', '\%'), '_', '\_') || '%';
begin
  perform public.require_admin();
  return query
  select p.id, p.username, p.created_at, public.has_role(p.id, 'admin'), p.is_private,
    (b.user_id is not null and (b.until_at is null or b.until_at > now())), b.until_at, b.reason,
    (select count(*) from public.user_reports r where r.reported_user_id = p.id and r.status in ('open', 'in_review')),
    (select count(*) from public.account_moderation_log l where l.target_user_id = p.id and l.action = 'warn')
  from public.profiles p left join public.account_bans b on b.user_id = p.id
  where p.username ilike pattern
  order by 9 desc, p.username asc limit 50;
end $$;

create or replace function public.admin_list_reports(_status text default 'open')
returns table (id uuid, reporter_id uuid, reporter_name text, reported_user_id uuid, reported_name text, reason text, details text,
  message_excerpt text, status text, admin_note text, created_at timestamptz, handled_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_admin();
  return query
  select r.id, r.reporter_id, rp.username, r.reported_user_id, tp.username, r.reason, r.details, r.message_excerpt, r.status, r.admin_note, r.created_at, r.handled_at
  from public.user_reports r join public.profiles rp on rp.id = r.reporter_id join public.profiles tp on tp.id = r.reported_user_id
  where case when _status = 'open' then r.status in ('open', 'in_review') else r.status in ('resolved', 'dismissed') end
  order by r.created_at desc limit 100;
end $$;

create or replace function public.admin_update_report(_report_id uuid, _status text, _note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare aid uuid := public.require_admin(); target uuid;
begin
  if _status not in ('in_review', 'resolved', 'dismissed') then raise exception 'REPORT_INVALID_STATUS'; end if;
  update public.user_reports set status = _status, admin_note = nullif(left(btrim(coalesce(_note, '')), 1000), ''), handled_by = aid, handled_at = now()
    where id = _report_id returning reported_user_id into target;
  if not found then raise exception 'REPORT_NOT_FOUND'; end if;
  insert into public.account_moderation_log (actor_id, target_user_id, action, reason, metadata)
  values (aid, target, 'report_update', _note, jsonb_build_object('report_id', _report_id, 'status', _status));
end $$;

create or replace function public.admin_guard_target(_user uuid) returns uuid
language plpgsql stable security definer set search_path = public as $$
declare aid uuid := public.require_admin();
begin
  if _user is null or not exists (select 1 from public.profiles where id = _user) then raise exception 'USER_NOT_FOUND'; end if;
  if _user = aid then raise exception 'ADMIN_SELF'; end if;                         -- nie sich selbst sperren/verwarnen
  if public.has_role(_user, 'admin') then raise exception 'ADMIN_PROTECTED'; end if; -- andere Admins geschützt
  return aid;
end $$;

create or replace function public.admin_warn_user(_user uuid, _reason text) returns void
language plpgsql security definer set search_path = public as $$
declare aid uuid := public.admin_guard_target(_user); clean text := btrim(coalesce(_reason, ''));
begin
  if char_length(clean) < 3 then raise exception 'REASON_REQUIRED'; end if;
  insert into public.account_moderation_log (actor_id, target_user_id, action, reason) values (aid, _user, 'warn', left(clean, 1000));
  perform public.notify_user(_user, 'admin', aid, gen_random_uuid(), 'Verwarnung vom Admin-Team', left(clean, 500));
end $$;

-- _until null = permanent; zeitweise nur mit Datum in der Zukunft
create or replace function public.admin_ban_user(_user uuid, _until timestamptz, _reason text, _reason_visible boolean default true) returns void
language plpgsql security definer set search_path = public as $$
declare aid uuid := public.admin_guard_target(_user); clean text := btrim(coalesce(_reason, ''));
begin
  if char_length(clean) < 3 then raise exception 'REASON_REQUIRED'; end if;
  if _until is not null and _until <= now() then raise exception 'BAN_INVALID_DATE'; end if;
  insert into public.account_bans (user_id, until_at, reason, reason_visible, created_by) values (_user, _until, left(clean, 500), coalesce(_reason_visible, true), aid)
  on conflict (user_id) do update set until_at = excluded.until_at, reason = excluded.reason, reason_visible = excluded.reason_visible, created_by = excluded.created_by, created_at = now();
  insert into public.account_moderation_log (actor_id, target_user_id, action, reason, metadata)
  values (aid, _user, 'ban', left(clean, 1000), jsonb_build_object('until', _until, 'permanent', _until is null));
end $$;

create or replace function public.admin_unban_user(_user uuid, _reason text default null) returns void
language plpgsql security definer set search_path = public as $$
declare aid uuid := public.require_admin();
begin
  delete from public.account_bans where user_id = _user;
  if not found then raise exception 'BAN_NOT_FOUND'; end if;
  insert into public.account_moderation_log (actor_id, target_user_id, action, reason) values (aid, _user, 'unban', nullif(btrim(coalesce(_reason, '')), ''));
  perform public.notify_user(_user, 'admin', aid, gen_random_uuid(), 'Deine Sperre wurde aufgehoben', 'Willkommen zurück in Leonida!');
end $$;

-- Gesperrte Nutzer können einmal pro Tag eine Überprüfung anfragen (geht an alle Admins)
create or replace function public.request_ban_review(_message text) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); clean text := btrim(coalesce(_message, '')); adm record;
begin
  if uid is null then raise exception 'AUTH_REQUIRED' using errcode = '28000'; end if;
  if not public.is_account_banned(uid) then raise exception 'BAN_NOT_FOUND'; end if;
  if char_length(clean) < 3 then raise exception 'REASON_REQUIRED'; end if;
  perform public.hit_rate_limit('ban_review', 1, interval '1 day');
  insert into public.account_moderation_log (actor_id, target_user_id, action, reason) values (uid, uid, 'review_request', left(clean, 1000));
  for adm in select ur.user_id from public.user_roles ur where ur.role = 'admin' loop
    perform public.notify_user(adm.user_id, 'admin', uid, gen_random_uuid(), 'Überprüfung einer Sperre angefragt', left(clean, 500));
  end loop;
end $$;

-- Wichtige Community-Mitteilung an alle Spieler
create or replace function public.admin_broadcast(_title text, _body text) returns integer
language plpgsql security definer set search_path = public as $$
declare aid uuid := public.require_admin(); ref uuid := gen_random_uuid(); n integer;
begin
  if char_length(btrim(coalesce(_title, ''))) < 3 then raise exception 'REASON_REQUIRED'; end if;
  insert into public.notifications (user_id, kind, actor_id, ref_id, title, body)
  select p.id, 'community', aid, ref, left(btrim(_title), 120), left(btrim(coalesce(_body, '')), 500) from public.profiles p
  on conflict do nothing;
  get diagnostics n = row_count;
  insert into public.account_moderation_log (actor_id, action, reason, metadata) values (aid, 'broadcast', left(btrim(_title), 1000), jsonb_build_object('recipients', n));
  return n;
end $$;

create or replace function public.admin_moderation_log(_user uuid default null)
returns table (id uuid, actor_name text, target_user_id uuid, target_name text, action text, reason text, metadata jsonb, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_admin();
  return query
  select l.id, a.username, l.target_user_id, t.username, l.action, l.reason, l.metadata, l.created_at
  from public.account_moderation_log l left join public.profiles a on a.id = l.actor_id left join public.profiles t on t.id = l.target_user_id
  where _user is null or l.target_user_id = _user
  order by l.created_at desc limit 100;
end $$;

------------------------------------------------------------------------------------------------
-- TEIL H: Ausführungsrechte (interne Helfer nicht direkt aufrufbar)
------------------------------------------------------------------------------------------------
revoke execute on function public.require_active_user(), public.require_admin(), public.hit_rate_limit(text, integer, interval),
  public.notify_user(uuid, text, uuid, uuid, text, text), public.admin_guard_target(uuid),
  public.forbid_banned_writes(), public.forbid_banned_profile_edit() from public, anon, authenticated;
revoke execute on function public.is_account_banned(uuid), public.are_friends(uuid, uuid), public.respond_friend_request(uuid, boolean),
  public.send_friend_request(uuid), public.cancel_friend_request(uuid), public.remove_friend(uuid), public.block_user(uuid), public.unblock_user(uuid),
  public.block_chat_user(uuid), public.my_friend_state(), public.friends_of(uuid), public.send_private_message(uuid, text),
  public.delete_private_message(uuid), public.mark_conversation_read(uuid), public.my_conversations(), public.report_user(uuid, text, text),
  public.report_private_message(uuid, text, text), public.mark_notifications_read(uuid[]), public.my_account_ban(),
  public.admin_search_users(text), public.admin_list_reports(text), public.admin_update_report(uuid, text, text),
  public.admin_warn_user(uuid, text), public.admin_ban_user(uuid, timestamptz, text, boolean), public.admin_unban_user(uuid, text),
  public.admin_broadcast(text, text), public.admin_moderation_log(uuid), public.request_ban_review(text) from public, anon;
grant execute on function public.respond_friend_request(uuid, boolean),
  public.send_friend_request(uuid), public.cancel_friend_request(uuid), public.remove_friend(uuid), public.block_user(uuid), public.unblock_user(uuid),
  public.block_chat_user(uuid), public.my_friend_state(), public.friends_of(uuid), public.send_private_message(uuid, text),
  public.delete_private_message(uuid), public.mark_conversation_read(uuid), public.my_conversations(), public.report_user(uuid, text, text),
  public.report_private_message(uuid, text, text), public.mark_notifications_read(uuid[]), public.my_account_ban(),
  public.admin_search_users(text), public.admin_list_reports(text), public.admin_update_report(uuid, text, text),
  public.admin_warn_user(uuid, text), public.admin_ban_user(uuid, timestamptz, text, boolean), public.admin_unban_user(uuid, text),
  public.admin_broadcast(text, text), public.admin_moderation_log(uuid), public.request_ban_review(text) to authenticated;
revoke execute on function public.is_account_banned(uuid), public.are_friends(uuid, uuid) from authenticated;
-- Freundeslisten öffentlicher Profile dürfen auch Gäste sehen
grant execute on function public.friends_of(uuid) to anon;

------------------------------------------------------------------------------------------------
-- TEIL I: Realtime (Privatnachrichten, Benachrichtigungen, Anfragen; RLS gilt auch hier)
------------------------------------------------------------------------------------------------
do $$ declare t text; begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['private_messages', 'notifications', 'friend_requests'] loop
      if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
exception when others then raise notice 'Realtime konnte nicht automatisch erweitert werden: %', sqlerrm;
end $$;

select '008 erfolgreich eingerichtet' as ergebnis;
