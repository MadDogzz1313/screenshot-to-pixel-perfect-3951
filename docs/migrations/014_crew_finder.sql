-- 014 Crew Finder – Mitspielersuche, Beitrittsanfragen, private Crew-Lobby mit Gruppenchat.
-- Setzt 004, 007 und 008 voraus (Profile, chat_blocks, notifications, user_reports, Moderation). 010/011 (Push) optional.
-- Rein additiv und mehrfach ausführbar. Ändert keine Fundorte, Coins, XP, Arcade-, Freundes- oder Chatdaten.
-- Alle Schreibaktionen laufen über geprüfte Datenbank-Funktionen (security definer), nie direkt in Tabellen.

do $$ begin
  if to_regclass('public.notifications') is null or to_regclass('public.chat_blocks') is null or to_regclass('public.user_reports') is null then
    raise exception 'Bitte zuerst 007_community_chat.sql und 008_freunde_privatchat_moderation.sql ausführen.';
  end if;
end $$;

------------------------------------------------------------------------------------------------
-- TEIL A: Tabellen
------------------------------------------------------------------------------------------------
-- Aktivitäten + Gruppengrößen sind Daten (Admins pflegen sie im Adminbereich), damit sie später an GTA-VI-Online angepasst werden können.
create table if not exists public.crew_activities (
  id text primary key check (id ~ '^[a-z0-9_]{2,32}$'),
  label text not null check (char_length(label) between 2 and 40),
  emoji text not null default '🎮' check (char_length(emoji) between 1 and 8),
  default_max integer not null default 4,
  max_limit integer not null default 4 check (max_limit between 2 and 32),
  sort integer not null default 100,
  active boolean not null default true,
  updated_at timestamptz not null default now(),
  check (default_max between 2 and max_limit)
);
insert into public.crew_activities (id, label, emoji, default_max, max_limit, sort) values
  ('heist', 'Raubüberfall', '💰', 4, 4, 10),
  ('missions', 'Missionen', '🎯', 4, 4, 20),
  ('race', 'Rennen', '🏁', 8, 16, 30),
  ('explore', 'Gemeinsam erkunden', '🗺️', 4, 8, 40),
  ('freeroam', 'Freies Spiel', '🌴', 4, 8, 50)
on conflict (id) do nothing;

create table if not exists public.crews (
  id uuid primary key default gen_random_uuid(),
  leader_id uuid not null references public.profiles(id) on delete cascade,
  activity_id text not null references public.crew_activities(id),
  platform text not null check (platform in ('playstation', 'xbox')),
  language text not null check (language in ('de', 'en', 'es', 'fr', 'it', 'tr', 'pl', 'nl', 'other')),
  headset_required boolean not null default false,
  max_players integer not null check (max_players between 2 and 32),
  external_players integer not null default 0 check (external_players >= 0), -- Mitspieler außerhalb der App (ohne Konto)
  description text not null default '' check (char_length(description) <= 500),
  start_mode text not null default 'now' check (start_mode in ('now', 'later', 'time')),
  start_at timestamptz,
  status text not null default 'open' check (status in ('open', 'closed')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz,
  closed_by uuid references public.profiles(id) on delete set null,
  check (external_players < max_players),
  check ((start_mode = 'time') = (start_at is not null))
);
create index if not exists crews_open_idx on public.crews (status, expires_at desc);
create index if not exists crews_leader_idx on public.crews (leader_id);

create table if not exists public.crew_members (
  crew_id uuid not null references public.crews(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('leader', 'member')),
  ready boolean not null default false,
  joined_at timestamptz not null default now(),
  primary key (crew_id, user_id)
);
create unique index if not exists crew_members_one_leader on public.crew_members (crew_id) where role = 'leader';
create index if not exists crew_members_user_idx on public.crew_members (user_id);

create table if not exists public.crew_join_requests (
  id uuid primary key default gen_random_uuid(),
  crew_id uuid not null references public.crews(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz not null default now(),
  responded_at timestamptz
);
-- verhindert doppelte offene Anfragen atomar
create unique index if not exists crew_join_requests_one_pending on public.crew_join_requests (crew_id, user_id) where status = 'pending';
create index if not exists crew_join_requests_crew_idx on public.crew_join_requests (crew_id, status);

create table if not exists public.crew_messages (
  id uuid primary key default gen_random_uuid(),
  crew_id uuid not null references public.crews(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) <= 1000),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists crew_messages_crew_idx on public.crew_messages (crew_id, created_at desc);

-- Meldungen von Crew-Suchen landen in den bestehenden Meldungen (user_reports) -> bestehende Admin-Moderation
alter table public.user_reports add column if not exists crew_id uuid; -- bewusst ohne FK: Meldung bleibt erhalten, wenn die Crew gelöscht wird
drop index if exists public.user_reports_one_open;
create unique index user_reports_one_open on public.user_reports (reporter_id, reported_user_id)
  where status in ('open', 'in_review') and message_id is null and crew_id is null;
create unique index if not exists user_reports_one_per_crew on public.user_reports (reporter_id, crew_id)
  where crew_id is not null and status in ('open', 'in_review');

-- Neue Benachrichtigungsart "crew" (Glocke + Push)
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('friend_request', 'friend_accepted', 'private_message', 'community', 'admin', 'crew'));
-- Moderationsprotokoll um Crew-Aktionen erweitern
alter table public.account_moderation_log drop constraint if exists account_moderation_log_action_check;
alter table public.account_moderation_log add constraint account_moderation_log_action_check
  check (action in ('warn', 'ban', 'unban', 'report_update', 'broadcast', 'review_request', 'crew_close', 'crew_delete'));

------------------------------------------------------------------------------------------------
-- TEIL B: Hilfsfunktionen (für RLS nur mit auth.uid(), verraten nichts über Dritte)
------------------------------------------------------------------------------------------------
create or replace function public.crew_i_am_member(_crew uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.crew_members where crew_id = _crew and user_id = auth.uid())
$$;
create or replace function public.crew_i_am_leader(_crew uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.crew_members where crew_id = _crew and user_id = auth.uid() and role = 'leader')
$$;
create or replace function public.crew_i_blocked_with(_other uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.chat_blocks where (blocker_id = auth.uid() and blocked_id = _other) or (blocker_id = _other and blocked_id = auth.uid()))
$$;
create or replace function public.crew_users_blocked(_a uuid, _b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.chat_blocks where (blocker_id = _a and blocked_id = _b) or (blocker_id = _b and blocked_id = _a))
$$;
create or replace function public.crew_occupied(_crew uuid) returns integer
language sql stable security definer set search_path = public as $$
  select (select count(*)::int from public.crew_members where crew_id = _crew) + coalesce((select external_players from public.crews where id = _crew), 0)
$$;
-- Ablauf: 6 Stunden nach dem geplanten Start (ohne feste Uhrzeit: 6 Stunden nach dem Erstellen)
create or replace function public.crew_expiry(_mode text, _start timestamptz, _created timestamptz) returns timestamptz
language sql immutable as $$ select coalesce(case when _mode = 'time' then _start end, _created) + interval '6 hours' $$;

create or replace function public.crew_card(_id uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', c.id, 'leader_id', c.leader_id, 'activity_id', c.activity_id, 'activity_label', a.label, 'activity_emoji', a.emoji,
    'platform', c.platform, 'language', c.language, 'headset_required', c.headset_required, 'max_players', c.max_players,
    'external_players', c.external_players, 'description', c.description, 'start_mode', c.start_mode, 'start_at', c.start_at,
    'status', c.status, 'expires_at', c.expires_at, 'expired', c.expires_at <= now(), 'created_at', c.created_at,
    'members', coalesce((select jsonb_agg(jsonb_build_object('user_id', m.user_id, 'username', coalesce(p.username, 'Spieler'), 'role', m.role, 'ready', m.ready, 'joined_at', m.joined_at)
        order by (m.role = 'leader') desc, m.joined_at) from public.crew_members m join public.profiles p on p.id = m.user_id where m.crew_id = c.id), '[]'::jsonb),
    'my_role', (select m.role from public.crew_members m where m.crew_id = c.id and m.user_id = auth.uid()),
    'my_request', (select r.status from public.crew_join_requests r where r.crew_id = c.id and r.user_id = auth.uid() order by r.created_at desc limit 1))
  from public.crews c join public.crew_activities a on a.id = c.activity_id where c.id = _id
$$;

create or replace function public.crew_notify_members(_crew uuid, _except uuid, _actor uuid, _title text) returns void
language sql security definer set search_path = public as $$
  select public.notify_user(m.user_id, 'crew', _actor, _crew, _title, null) from public.crew_members m where m.crew_id = _crew and m.user_id is distinct from _except
$$;

------------------------------------------------------------------------------------------------
-- TEIL C: Zugriffsrechte (RLS) – private Crew-Chats nur für Mitglieder, Blockierungen werden ausgeblendet
------------------------------------------------------------------------------------------------
alter table public.crew_activities enable row level security;
alter table public.crews enable row level security;
alter table public.crew_members enable row level security;
alter table public.crew_join_requests enable row level security;
alter table public.crew_messages enable row level security;
revoke all on public.crew_activities, public.crews, public.crew_members, public.crew_join_requests, public.crew_messages from anon, authenticated;
grant select on public.crew_activities to anon, authenticated;
grant select on public.crew_members, public.crew_join_requests, public.crew_messages to authenticated;

drop policy if exists "crew activities readable" on public.crew_activities;
create policy "crew activities readable" on public.crew_activities for select to anon, authenticated using (true);
-- crews: kein Direktzugriff, Lesen nur über crew_browse / crew_detail
drop policy if exists "crew members visible to members" on public.crew_members;
create policy "crew members visible to members" on public.crew_members for select to authenticated using (public.crew_i_am_member(crew_id));
drop policy if exists "crew requests own or leader" on public.crew_join_requests;
create policy "crew requests own or leader" on public.crew_join_requests for select to authenticated using (user_id = auth.uid() or public.crew_i_am_leader(crew_id));
drop policy if exists "crew messages members only" on public.crew_messages;
create policy "crew messages members only" on public.crew_messages for select to authenticated
  using (public.crew_i_am_member(crew_id) and not public.crew_i_blocked_with(sender_id));

alter table public.crew_messages replica identity full;
alter table public.crew_members replica identity full;
alter table public.crew_join_requests replica identity full;

do $$ declare t text; begin
  foreach t in array array['crews', 'crew_members', 'crew_join_requests', 'crew_messages'] loop
    execute format('drop trigger if exists zz_forbid_banned on public.%I', t);
    execute format('create trigger zz_forbid_banned before insert on public.%I for each row execute function public.forbid_banned_writes()', t);
  end loop;
end $$;

------------------------------------------------------------------------------------------------
-- TEIL D: Lesen
------------------------------------------------------------------------------------------------
-- Offene, nicht abgelaufene Suchen (auch volle mit "Crew vollständig"); Blockierungen mit dem Leader werden ausgeblendet
create or replace function public.crew_browse(_platform text default null, _activity text default null, _language text default null, _min_free integer default 0)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'AUTH_REQUIRED' using errcode = '28000'; end if;
  return coalesce((select jsonb_agg(public.crew_card(c.id) order by coalesce(c.start_at, c.created_at) asc, c.created_at desc)
    from public.crews c join public.crew_activities a on a.id = c.activity_id
    where c.status = 'open' and c.expires_at > now()
      and (_platform is null or c.platform = _platform)
      and (_activity is null or c.activity_id = _activity)
      and (_language is null or c.language = _language)
      and (c.max_players - public.crew_occupied(c.id)) >= greatest(coalesce(_min_free, 0), 0)
      and not public.crew_users_blocked(uid, c.leader_id)
      and not public.is_account_banned(c.leader_id)
    limit 80), '[]'::jsonb);
end $$;

-- Eigene Crews (Leader oder Mitglied), auch geschlossene; abgelaufene noch 24 Std. sichtbar
create or replace function public.my_crews() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(public.crew_card(c.id) order by c.created_at desc), '[]'::jsonb)
  from public.crews c join public.crew_members m on m.crew_id = c.id and m.user_id = auth.uid()
  where c.expires_at > now() - interval '24 hours'
$$;

-- Detail: Mitglieder, Leader und Admins immer; andere nur offene, nicht abgelaufene Suchen ohne Blockierung
create or replace function public.crew_detail(_crew uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare uid uuid := auth.uid(); c public.crews; card jsonb; is_admin boolean;
begin
  if uid is null then raise exception 'AUTH_REQUIRED' using errcode = '28000'; end if;
  select * into c from public.crews where id = _crew;
  if not found then raise exception 'CREW_NOT_FOUND'; end if;
  is_admin := public.has_role(uid, 'admin');
  if not (public.crew_i_am_member(_crew) or is_admin or (c.status = 'open' and c.expires_at > now() and not public.crew_users_blocked(uid, c.leader_id))) then
    raise exception 'CREW_NOT_FOUND';
  end if;
  card := public.crew_card(_crew) || jsonb_build_object('viewer_is_admin', is_admin);
  if c.leader_id = uid then
    card := card || jsonb_build_object('requests', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'user_id', r.user_id, 'username', coalesce(p.username, 'Spieler'), 'created_at', r.created_at) order by r.created_at)
      from public.crew_join_requests r join public.profiles p on p.id = r.user_id where r.crew_id = _crew and r.status = 'pending'), '[]'::jsonb));
  end if;
  return card;
end $$;

------------------------------------------------------------------------------------------------
-- TEIL E: Crew erstellen, bearbeiten, schließen, löschen
------------------------------------------------------------------------------------------------
create or replace function public.crew_validate(_activity text, _platform text, _language text, _max integer, _external integer, _mode text, _start timestamptz)
returns void language plpgsql stable security definer set search_path = public as $$
declare a public.crew_activities;
begin
  select * into a from public.crew_activities where id = _activity and active;
  if not found then raise exception 'CREW_INVALID_ACTIVITY'; end if;
  if _platform not in ('playstation', 'xbox') then raise exception 'CREW_INVALID_PLATFORM'; end if;
  if _language not in ('de', 'en', 'es', 'fr', 'it', 'tr', 'pl', 'nl', 'other') then raise exception 'CREW_INVALID_LANGUAGE'; end if;
  if _max is null or _max < 2 or _max > a.max_limit then raise exception 'CREW_INVALID_SIZE'; end if;
  if _external is null or _external < 0 or _external >= _max then raise exception 'CREW_INVALID_SIZE'; end if;
  if _mode not in ('now', 'later', 'time') then raise exception 'CREW_INVALID_START'; end if;
  if _mode = 'time' and (_start is null or _start < now() - interval '15 minutes' or _start > now() + interval '7 days') then raise exception 'CREW_INVALID_START'; end if;
end $$;

create or replace function public.create_crew(_activity text, _platform text, _language text, _headset boolean, _max integer, _external integer,
  _description text, _start_mode text, _start_at timestamptz default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.require_active_user(); new_id uuid; st timestamptz := case when _start_mode = 'time' then _start_at end;
begin
  perform public.crew_validate(_activity, _platform, _language, _max, _external, _start_mode, st);
  if _external + 1 >= _max then raise exception 'CREW_INVALID_SIZE'; end if; -- mindestens ein freier Platz
  if (select count(*) from public.crews where leader_id = uid and status = 'open' and expires_at > now()) >= 3 then raise exception 'CREW_LIMIT'; end if;
  perform public.hit_rate_limit('crew_create', 6, interval '1 hour');
  delete from public.crews where expires_at < now() - interval '7 days'; -- alte Suchen aufräumen
  insert into public.crews (leader_id, activity_id, platform, language, headset_required, max_players, external_players, description, start_mode, start_at, expires_at)
  values (uid, _activity, _platform, _language, coalesce(_headset, false), _max, _external, left(btrim(coalesce(_description, '')), 500), _start_mode, st, public.crew_expiry(_start_mode, st, now()))
  returning id into new_id;
  insert into public.crew_members (crew_id, user_id, role) values (new_id, uid, 'leader');
  return new_id;
end $$;

create or replace function public.update_crew(_crew uuid, _activity text, _platform text, _language text, _headset boolean, _max integer, _external integer,
  _description text, _start_mode text, _start_at timestamptz default null) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.require_active_user(); c public.crews; st timestamptz := case when _start_mode = 'time' then _start_at end; members integer;
begin
  select * into c from public.crews where id = _crew for update;
  if not found or c.leader_id <> uid then raise exception 'CREW_NOT_LEADER'; end if;
  if c.expires_at <= now() then raise exception 'CREW_EXPIRED'; end if;
  perform public.crew_validate(_activity, _platform, _language, _max, _external, _start_mode, st);
  select count(*) into members from public.crew_members where crew_id = _crew;
  if members + _external > _max then raise exception 'CREW_SIZE_BELOW_MEMBERS'; end if;
  update public.crews set activity_id = _activity, platform = _platform, language = _language, headset_required = coalesce(_headset, false),
    max_players = _max, external_players = _external, description = left(btrim(coalesce(_description, '')), 500), start_mode = _start_mode, start_at = st,
    expires_at = public.crew_expiry(_start_mode, st, c.created_at), updated_at = now()
  where id = _crew;
end $$;

create or replace function public.close_crew(_crew uuid) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.require_active_user(); c public.crews; lbl text;
begin
  select * into c from public.crews where id = _crew for update;
  if not found or c.leader_id <> uid then raise exception 'CREW_NOT_LEADER'; end if;
  if c.status = 'closed' then return; end if;
  update public.crews set status = 'closed', closed_at = now(), closed_by = uid, updated_at = now() where id = _crew;
  update public.crew_join_requests set status = 'declined', responded_at = now() where crew_id = _crew and status = 'pending';
  select label into lbl from public.crew_activities where id = c.activity_id;
  perform public.crew_notify_members(_crew, uid, uid, 'Die Crew-Suche „' || lbl || '“ wurde geschlossen. Die Lobby bleibt bis zum Ablauf offen.');
end $$;

create or replace function public.delete_crew(_crew uuid) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.require_active_user(); c public.crews; lbl text; admin_delete boolean;
begin
  select * into c from public.crews where id = _crew for update;
  if not found then raise exception 'CREW_NOT_FOUND'; end if;
  admin_delete := c.leader_id <> uid;
  if admin_delete and not public.has_role(uid, 'admin') then raise exception 'CREW_NOT_LEADER'; end if;
  select label into lbl from public.crew_activities where id = c.activity_id;
  -- Hinweis an Mitglieder (die Glocke verlinkt danach auf "nicht mehr verfügbar")
  perform public.notify_user(m.user_id, 'crew', uid, _crew, 'Die Crew „' || lbl || '“ wurde ' || case when admin_delete then 'vom Moderationsteam entfernt.' else 'vom Crew-Leader aufgelöst.' end, null)
    from public.crew_members m where m.crew_id = _crew and m.user_id <> uid;
  if admin_delete then
    insert into public.account_moderation_log (actor_id, target_user_id, action, reason, metadata)
    values (uid, c.leader_id, 'crew_delete', null, jsonb_build_object('crew_id', _crew, 'activity', c.activity_id));
  end if;
  delete from public.crews where id = _crew;
end $$;

------------------------------------------------------------------------------------------------
-- TEIL F: Beitreten, Anfragen beantworten, Verlassen, Entfernen, Bereit
------------------------------------------------------------------------------------------------
create or replace function public.request_join_crew(_crew uuid) returns text
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.require_active_user(); c public.crews; lbl text; me text;
begin
  select * into c from public.crews where id = _crew for update;
  if not found then raise exception 'CREW_NOT_FOUND'; end if;
  if c.status <> 'open' or c.expires_at <= now() then raise exception 'CREW_CLOSED'; end if;
  if exists (select 1 from public.crew_members where crew_id = _crew and user_id = uid) then raise exception 'CREW_ALREADY_MEMBER'; end if;
  if exists (select 1 from public.crew_join_requests where crew_id = _crew and user_id = uid and status = 'pending') then raise exception 'CREW_ALREADY_REQUESTED'; end if;
  if public.crew_users_blocked(uid, c.leader_id) then raise exception 'CREW_BLOCKED'; end if;
  if public.crew_occupied(_crew) >= c.max_players then raise exception 'CREW_FULL'; end if;
  if exists (select 1 from public.crew_join_requests where crew_id = _crew and user_id = uid and status = 'declined' and responded_at > now() - interval '1 hour') then
    raise exception 'CREW_DECLINED_RECENTLY';
  end if;
  perform public.hit_rate_limit('crew_join', 20, interval '1 hour');
  insert into public.crew_join_requests (crew_id, user_id) values (_crew, uid);
  select label into lbl from public.crew_activities where id = c.activity_id;
  select coalesce(username, 'Ein Spieler') into me from public.profiles where id = uid;
  perform public.notify_user(c.leader_id, 'crew', uid, _crew, me || ' möchte deiner Crew „' || lbl || '“ beitreten.', null);
  return 'requested';
end $$;

create or replace function public.cancel_join_crew(_crew uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode = '28000'; end if;
  update public.crew_join_requests set status = 'cancelled', responded_at = now() where crew_id = _crew and user_id = auth.uid() and status = 'pending';
end $$;

create or replace function public.respond_crew_request(_request uuid, _accept boolean) returns text
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.require_active_user(); r public.crew_join_requests; c public.crews; lbl text;
begin
  select * into r from public.crew_join_requests where id = _request;
  if not found then raise exception 'CREW_REQUEST_NOT_FOUND'; end if;
  select * into c from public.crews where id = r.crew_id for update; -- sperrt die Crew: keine Überbuchung bei gleichzeitigen Zusagen
  if c.leader_id <> uid then raise exception 'CREW_NOT_LEADER'; end if;
  select * into r from public.crew_join_requests where id = _request for update;
  if r.status <> 'pending' then raise exception 'CREW_REQUEST_CLOSED'; end if;
  select label into lbl from public.crew_activities where id = c.activity_id;
  if not _accept then
    update public.crew_join_requests set status = 'declined', responded_at = now() where id = _request;
    perform public.notify_user(r.user_id, 'crew', uid, c.id, 'Deine Anfrage für die Crew „' || lbl || '“ wurde abgelehnt.', null);
    return 'declined';
  end if;
  if c.status <> 'open' or c.expires_at <= now() then raise exception 'CREW_CLOSED'; end if;
  if public.crew_users_blocked(uid, r.user_id) then raise exception 'CREW_BLOCKED'; end if;
  if public.is_account_banned(r.user_id) then raise exception 'CREW_USER_UNAVAILABLE'; end if;
  if public.crew_occupied(c.id) >= c.max_players then raise exception 'CREW_FULL'; end if;
  insert into public.crew_members (crew_id, user_id, role) values (c.id, r.user_id, 'member') on conflict do nothing;
  update public.crew_join_requests set status = 'accepted', responded_at = now() where id = _request;
  perform public.notify_user(r.user_id, 'crew', uid, c.id, 'Du bist jetzt Mitglied der Crew „' || lbl || '“. Die Lobby ist offen.', null);
  return 'accepted';
end $$;

create or replace function public.leave_crew(_crew uuid) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); c public.crews; me text; lbl text;
begin
  if uid is null then raise exception 'AUTH_REQUIRED' using errcode = '28000'; end if;
  select * into c from public.crews where id = _crew for update;
  if not found then raise exception 'CREW_NOT_FOUND'; end if;
  if c.leader_id = uid then raise exception 'CREW_LEADER_LEAVE'; end if;
  delete from public.crew_members where crew_id = _crew and user_id = uid;
  if not found then raise exception 'CREW_NOT_MEMBER'; end if;
  select coalesce(username, 'Ein Spieler') into me from public.profiles where id = uid;
  select label into lbl from public.crew_activities where id = c.activity_id;
  perform public.notify_user(c.leader_id, 'crew', uid, _crew, me || ' hat deine Crew „' || lbl || '“ verlassen.', null);
end $$;

create or replace function public.remove_crew_member(_crew uuid, _user uuid) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.require_active_user(); c public.crews; lbl text;
begin
  select * into c from public.crews where id = _crew for update;
  if not found or c.leader_id <> uid then raise exception 'CREW_NOT_LEADER'; end if;
  if _user = uid then raise exception 'CREW_LEADER_LEAVE'; end if;
  delete from public.crew_members where crew_id = _crew and user_id = _user and role = 'member';
  if not found then raise exception 'CREW_NOT_MEMBER'; end if;
  select label into lbl from public.crew_activities where id = c.activity_id;
  perform public.notify_user(_user, 'crew', uid, _crew, 'Du wurdest aus der Crew „' || lbl || '“ entfernt.', null);
end $$;

create or replace function public.set_crew_ready(_crew uuid, _ready boolean) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.require_active_user();
begin
  if (select expires_at from public.crews where id = _crew) <= now() then raise exception 'CREW_EXPIRED'; end if;
  update public.crew_members set ready = coalesce(_ready, false) where crew_id = _crew and user_id = uid;
  if not found then raise exception 'CREW_NOT_MEMBER'; end if;
end $$;

------------------------------------------------------------------------------------------------
-- TEIL G: Privater Crew-Chat
------------------------------------------------------------------------------------------------
create or replace function public.send_crew_message(_crew uuid, _body text) returns public.crew_messages
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.require_active_user(); clean text := btrim(coalesce(_body, '')); msg public.crew_messages; lbl text; c public.crews;
begin
  select * into c from public.crews where id = _crew;
  if not found or not public.crew_i_am_member(_crew) then raise exception 'CREW_NOT_MEMBER'; end if;
  if c.expires_at <= now() then raise exception 'CREW_EXPIRED'; end if;
  if char_length(clean) = 0 then raise exception 'CREW_MESSAGE_EMPTY'; end if;
  if char_length(clean) > 1000 then raise exception 'CREW_MESSAGE_TOO_LONG'; end if;
  perform public.hit_rate_limit('crew_message', 30, interval '1 minute');
  insert into public.crew_messages (crew_id, sender_id, body) values (_crew, uid, clean) returning * into msg;
  select label into lbl from public.crew_activities where id = c.activity_id;
  -- Glocke: höchstens eine ungelesene Chat-Meldung pro Crew und 10 Minuten; Blockierte erhalten nichts
  perform public.notify_user(m.user_id, 'crew', uid, _crew, 'Neue Nachricht im Crew-Chat „' || lbl || '“.', null)
    from public.crew_members m
    where m.crew_id = _crew and m.user_id <> uid and not public.crew_users_blocked(uid, m.user_id)
      and not exists (select 1 from public.notifications n where n.user_id = m.user_id and n.kind = 'crew' and n.ref_id = _crew and n.read_at is null and n.created_at > now() - interval '10 minutes');
  return msg;
end $$;

create or replace function public.delete_crew_message(_message uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode = '28000'; end if;
  update public.crew_messages set body = '', deleted_at = now() where id = _message and sender_id = auth.uid() and deleted_at is null;
  if not found then raise exception 'CREW_MESSAGE_NOT_FOUND'; end if;
end $$;

------------------------------------------------------------------------------------------------
-- TEIL H: Melden + Admin-Moderation
------------------------------------------------------------------------------------------------
create or replace function public.report_crew(_crew uuid, _reason text, _details text default null) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.require_active_user(); c public.crews; lbl text;
begin
  select * into c from public.crews where id = _crew;
  if not found then raise exception 'CREW_NOT_FOUND'; end if;
  if c.leader_id = uid then raise exception 'REPORT_SELF'; end if;
  if _reason not in ('harassment', 'spam', 'fraud', 'inappropriate', 'suspicious', 'other') then raise exception 'REPORT_INVALID_REASON'; end if;
  if exists (select 1 from public.user_reports where reporter_id = uid and crew_id = _crew and status in ('open', 'in_review')) then raise exception 'REPORT_DUPLICATE'; end if;
  perform public.hit_rate_limit('report', 10, interval '1 hour');
  select label into lbl from public.crew_activities where id = c.activity_id;
  insert into public.user_reports (reporter_id, reported_user_id, crew_id, message_excerpt, reason, details)
  values (uid, c.leader_id, _crew, left('Crew-Suche „' || lbl || '“: ' || coalesce(nullif(c.description, ''), '(ohne Beschreibung)'), 1000), _reason,
    nullif(left(btrim(coalesce(_details, '')), 1000), ''));
end $$;

-- bestehende Meldungsliste um crew_id erweitern (Rückgabetyp ändert sich -> neu anlegen)
drop function if exists public.admin_list_reports(text);
create function public.admin_list_reports(_status text default 'open')
returns table (id uuid, reporter_id uuid, reporter_name text, reported_user_id uuid, reported_name text, reason text, details text,
  message_excerpt text, status text, admin_note text, created_at timestamptz, handled_at timestamptz, crew_id uuid)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_admin();
  return query
  select r.id, r.reporter_id, rp.username, r.reported_user_id, tp.username, r.reason, r.details, r.message_excerpt, r.status, r.admin_note, r.created_at, r.handled_at, r.crew_id
  from public.user_reports r join public.profiles rp on rp.id = r.reporter_id join public.profiles tp on tp.id = r.reported_user_id
  where case when _status = 'open' then r.status in ('open', 'in_review') else r.status in ('resolved', 'dismissed') end
  order by r.created_at desc limit 100;
end $$;

create or replace function public.admin_close_crew(_crew uuid, _reason text default null) returns void
language plpgsql security definer set search_path = public as $$
declare aid uuid := public.require_admin(); c public.crews; lbl text;
begin
  select * into c from public.crews where id = _crew for update;
  if not found then raise exception 'CREW_NOT_FOUND'; end if;
  update public.crews set status = 'closed', closed_at = now(), closed_by = aid, updated_at = now() where id = _crew;
  update public.crew_join_requests set status = 'declined', responded_at = now() where crew_id = _crew and status = 'pending';
  select label into lbl from public.crew_activities where id = c.activity_id;
  perform public.crew_notify_members(_crew, aid, aid, 'Die Crew-Suche „' || lbl || '“ wurde vom Moderationsteam geschlossen.');
  insert into public.account_moderation_log (actor_id, target_user_id, action, reason, metadata)
  values (aid, c.leader_id, 'crew_close', nullif(btrim(coalesce(_reason, '')), ''), jsonb_build_object('crew_id', _crew, 'activity', c.activity_id));
end $$;

create or replace function public.admin_upsert_crew_activity(_id text, _label text, _emoji text, _default_max integer, _max_limit integer, _sort integer, _active boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.require_admin();
  if _id !~ '^[a-z0-9_]{2,32}$' then raise exception 'CREW_INVALID_ACTIVITY'; end if;
  if char_length(btrim(coalesce(_label, ''))) not between 2 and 40 then raise exception 'CREW_INVALID_ACTIVITY'; end if;
  if _max_limit is null or _max_limit < 2 or _max_limit > 32 or _default_max is null or _default_max < 2 or _default_max > _max_limit then raise exception 'CREW_INVALID_SIZE'; end if;
  insert into public.crew_activities (id, label, emoji, default_max, max_limit, sort, active, updated_at)
  values (_id, btrim(_label), coalesce(nullif(btrim(coalesce(_emoji, '')), ''), '🎮'), _default_max, _max_limit, coalesce(_sort, 100), coalesce(_active, true), now())
  on conflict (id) do update set label = excluded.label, emoji = excluded.emoji, default_max = excluded.default_max, max_limit = excluded.max_limit,
    sort = excluded.sort, active = excluded.active, updated_at = now();
end $$;

------------------------------------------------------------------------------------------------
-- TEIL I: Rechte
------------------------------------------------------------------------------------------------
revoke execute on function public.crew_card(uuid), public.crew_notify_members(uuid, uuid, uuid, text), public.crew_occupied(uuid),
  public.crew_users_blocked(uuid, uuid), public.crew_validate(text, text, text, integer, integer, text, timestamptz) from public, anon, authenticated;
revoke execute on function public.crew_browse(text, text, text, integer), public.my_crews(), public.crew_detail(uuid),
  public.create_crew(text, text, text, boolean, integer, integer, text, text, timestamptz),
  public.update_crew(uuid, text, text, text, boolean, integer, integer, text, text, timestamptz), public.close_crew(uuid), public.delete_crew(uuid),
  public.request_join_crew(uuid), public.cancel_join_crew(uuid), public.respond_crew_request(uuid, boolean), public.leave_crew(uuid),
  public.remove_crew_member(uuid, uuid), public.set_crew_ready(uuid, boolean), public.send_crew_message(uuid, text), public.delete_crew_message(uuid),
  public.report_crew(uuid, text, text), public.admin_list_reports(text), public.admin_close_crew(uuid, text),
  public.admin_upsert_crew_activity(text, text, text, integer, integer, integer, boolean),
  public.crew_i_am_member(uuid), public.crew_i_am_leader(uuid), public.crew_i_blocked_with(uuid) from public, anon;
grant execute on function public.crew_browse(text, text, text, integer), public.my_crews(), public.crew_detail(uuid),
  public.create_crew(text, text, text, boolean, integer, integer, text, text, timestamptz),
  public.update_crew(uuid, text, text, text, boolean, integer, integer, text, text, timestamptz), public.close_crew(uuid), public.delete_crew(uuid),
  public.request_join_crew(uuid), public.cancel_join_crew(uuid), public.respond_crew_request(uuid, boolean), public.leave_crew(uuid),
  public.remove_crew_member(uuid, uuid), public.set_crew_ready(uuid, boolean), public.send_crew_message(uuid, text), public.delete_crew_message(uuid),
  public.report_crew(uuid, text, text), public.admin_list_reports(text), public.admin_close_crew(uuid, text),
  public.admin_upsert_crew_activity(text, text, text, integer, integer, integer, boolean),
  public.crew_i_am_member(uuid), public.crew_i_am_leader(uuid), public.crew_i_blocked_with(uuid) to authenticated;

------------------------------------------------------------------------------------------------
-- TEIL J: Push für Crew-Benachrichtigungen (nur wenn 010 + 011 ausgeführt sind; Kategorie "Community")
------------------------------------------------------------------------------------------------
do $do$ begin
  if to_regclass('public.push_native_devices') is null or to_regclass('public.push_preferences') is null then
    raise notice 'Push (010/011) noch nicht eingerichtet – Crew-Meldungen erscheinen nur in der Glocke.'; return;
  end if;
  execute $fn$
create or replace function public.push_on_notification() returns trigger
language plpgsql security definer set search_path = public as $$
declare pref public.push_preferences; allowed boolean; actor text; title text; body text; url text; preview text;
begin
  begin
    if new.read_at is not null then return new; end if;
    select * into pref from public.push_preferences where user_id = new.user_id;
    if not found then pref := row(new.user_id, true, true, true, true, true, true, false, now())::public.push_preferences; end if;
    allowed := pref.enabled and case new.kind
      when 'friend_request' then pref.friend_request when 'friend_accepted' then pref.friend_accepted
      when 'private_message' then pref.private_message when 'admin' then pref.inbox when 'community' then pref.community
      when 'crew' then pref.community else false end;
    if not allowed then return new; end if;
    if not exists (select 1 from public.push_subscriptions where user_id = new.user_id)
       and not exists (select 1 from public.push_native_devices where user_id = new.user_id) then return new; end if;
    if exists (select 1 from public.push_log where user_id = new.user_id and kind = new.kind and ref_id is not distinct from new.ref_id and sent_at > now() - interval '15 seconds') then return new; end if;
    if (select count(*) from public.push_log where user_id = new.user_id and sent_at > now() - interval '10 minutes') >= 30 then return new; end if;
    delete from public.push_log where sent_at < now() - interval '2 days';

    select username into actor from public.profiles where id = new.actor_id;
    actor := coalesce(actor, 'Ein Spieler');
    case new.kind
      when 'friend_request' then title := 'Neue Freundschaftsanfrage'; body := actor || ' möchte mit dir befreundet sein.'; url := '/freunde?tab=anfragen';
      when 'friend_accepted' then title := 'Freundschaft angenommen'; body := actor || ' hat deine Freundschaftsanfrage angenommen.'; url := '/u/' || actor;
      when 'private_message' then
        title := 'Neue private Nachricht von ' || actor; url := '/nachrichten/' || new.actor_id;
        if pref.show_preview then
          select left(m.body, 140) into preview from public.private_messages m
            where m.sender_id = new.actor_id and m.receiver_id = new.user_id and m.deleted_at is null order by m.created_at desc limit 1;
        end if;
        body := coalesce(preview, 'Tippe, um die Nachricht zu lesen.');
      when 'admin' then
        if new.title like 'Verwarnung%' then title := 'Mitteilung vom Leonida-Explorer-Team'; body := 'Du hast eine wichtige Mitteilung vom Leonida-Explorer-Team erhalten.';
        else title := 'Neue Mitteilung'; body := 'Du hast eine neue Mitteilung in deinem Postfach.'; end if;
        url := '/profil?glocke=1';
      when 'crew' then title := 'Crew Finder'; body := left(new.title, 140); url := '/crew/' || new.ref_id;
      else title := 'Wichtige Community-Mitteilung'; body := left(new.title, 140); url := '/profil?glocke=1';
    end case;

    if public.push_dispatch(new.user_id, jsonb_build_object('title', title, 'body', body, 'url', url,
        'tag', new.kind || '-' || coalesce(new.ref_id::text, new.id::text), 'notification_id', new.id)) then
      insert into public.push_log (user_id, kind, ref_id) values (new.user_id, new.kind, new.ref_id);
    end if;
  exception when others then
    raise notice 'Push übersprungen: %', sqlerrm;
  end;
  return new;
end $$;
  $fn$;
  revoke execute on function public.push_on_notification() from public, anon, authenticated;
end $do$;

------------------------------------------------------------------------------------------------
-- TEIL K: Realtime (Lobby, Anfragen, Chat; RLS gilt auch hier)
------------------------------------------------------------------------------------------------
do $$ declare t text; begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['crew_messages', 'crew_members', 'crew_join_requests'] loop
      if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
exception when others then raise notice 'Realtime konnte nicht automatisch erweitert werden: %', sqlerrm;
end $$;

select '014 Crew Finder erfolgreich eingerichtet' as ergebnis;
