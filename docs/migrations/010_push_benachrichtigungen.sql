-- 010_push_benachrichtigungen.sql — Echte Push-Benachrichtigungen (Web Push) für Leonida Explorer
-- ENTWURF: vorbereitet, aber NICHT in der Lovable-Datenbank ausgeführt. Voraussetzung: 008 wurde ausgeführt.
-- Ablauf: neue/aktualisierte Benachrichtigung (Glocke) -> Datenbank-Trigger prüft Einstellungen, Rate-Limit und Geräte
--         -> sicherer Aufruf (pg_net, geheimer Schlüssel) an den Leonida-Server -> Server signiert mit VAPID und versendet.
-- Die Glocke (Tabelle notifications) wird dabei NIE verändert. Rein additiv, mehrfach ausführbar.

do $$ begin
  if to_regclass('public.notifications') is null then raise exception 'Bitte zuerst 008_freunde_privatchat_moderation.sql ausführen.'; end if;
end $$;

-- pg_net (Supabase-Erweiterung für HTTP-Aufrufe aus der Datenbank)
do $$ begin
  create extension if not exists pg_net with schema extensions;
exception when others then raise notice 'pg_net konnte nicht aktiviert werden: % – Push bleibt aus, Glocke funktioniert weiter.', sqlerrm;
end $$;

------------------------------------------------------------------------------------------------
-- Tabellen
------------------------------------------------------------------------------------------------
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique check (endpoint like 'https://%' and char_length(endpoint) <= 1000),
  p256dh text not null check (char_length(p256dh) between 20 and 200),
  auth text not null check (char_length(auth) between 8 and 100),
  user_agent text check (user_agent is null or char_length(user_agent) <= 300),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

create table if not exists public.push_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  enabled boolean not null default true,
  friend_request boolean not null default true,
  friend_accepted boolean not null default true,
  private_message boolean not null default true,
  inbox boolean not null default true,          -- persönliche Postfach-/Admin-Mitteilungen
  community boolean not null default true,
  show_preview boolean not null default false,  -- Nachrichtenvorschau auf dem Sperrbildschirm (Standard: aus)
  updated_at timestamptz not null default now()
);

create table if not exists public.push_config (
  id integer primary key default 1 check (id = 1),
  dispatch_url text not null,
  secret text not null check (char_length(secret) >= 32),
  updated_at timestamptz not null default now()
);

create table if not exists public.push_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null,
  ref_id uuid,
  sent_at timestamptz not null default now()
);
create index if not exists push_log_user_idx on public.push_log (user_id, sent_at desc);

alter table public.push_subscriptions enable row level security;
alter table public.push_preferences enable row level security;
alter table public.push_config enable row level security;
alter table public.push_log enable row level security;
revoke all on public.push_subscriptions, public.push_preferences, public.push_config, public.push_log from anon, authenticated;
grant select on public.push_preferences to authenticated;
drop policy if exists "push preferences own" on public.push_preferences;
create policy "push preferences own" on public.push_preferences for select to authenticated using (auth.uid() = user_id);
-- push_subscriptions, push_config, push_log: kein direkter Zugriff aus der App

------------------------------------------------------------------------------------------------
-- Funktionen für die App (angemeldete Nutzer, nur eigene Daten)
------------------------------------------------------------------------------------------------
-- Gerät registrieren; dasselbe Gerät gehört immer nur dem zuletzt angemeldeten Konto (kein Push an falsche Nutzer)
create or replace function public.push_subscribe(_endpoint text, _p256dh text, _auth text, _user_agent text default null) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'AUTH_REQUIRED' using errcode = '28000'; end if;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  values (uid, _endpoint, _p256dh, _auth, left(_user_agent, 300))
  on conflict (endpoint) do update set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth,
    user_agent = excluded.user_agent, last_seen_at = now();
  -- höchstens 10 Geräte pro Konto (älteste fallen weg)
  delete from public.push_subscriptions where id in (
    select id from public.push_subscriptions where user_id = uid order by last_seen_at desc offset 10);
end $$;

create or replace function public.push_unsubscribe(_endpoint text) returns void
language sql security definer set search_path = public as $$
  delete from public.push_subscriptions where endpoint = _endpoint and user_id = auth.uid()
$$;

create or replace function public.push_set_preferences(_enabled boolean, _friend_request boolean, _friend_accepted boolean,
  _private_message boolean, _inbox boolean, _community boolean, _show_preview boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode = '28000'; end if;
  insert into public.push_preferences (user_id, enabled, friend_request, friend_accepted, private_message, inbox, community, show_preview, updated_at)
  values (auth.uid(), _enabled, _friend_request, _friend_accepted, _private_message, _inbox, _community, _show_preview, now())
  on conflict (user_id) do update set enabled = excluded.enabled, friend_request = excluded.friend_request, friend_accepted = excluded.friend_accepted,
    private_message = excluded.private_message, inbox = excluded.inbox, community = excluded.community, show_preview = excluded.show_preview, updated_at = now();
end $$;

-- Geräteanzahl für die Einstellungen (ohne Endpunkte preiszugeben)
create or replace function public.push_device_count() returns integer
language sql stable security definer set search_path = public as $$
  select count(*)::int from public.push_subscriptions where user_id = auth.uid()
$$;

------------------------------------------------------------------------------------------------
-- Versand (nur Datenbank-intern; der geheime Schlüssel verlässt die Datenbank nur Richtung Leonida-Server)
------------------------------------------------------------------------------------------------
create or replace function public.push_dispatch(_user uuid, _payload jsonb) returns boolean
language plpgsql security definer set search_path = public, extensions as $$
declare cfg public.push_config; subs jsonb;
begin
  select * into cfg from public.push_config where id = 1;
  if not found then return false; end if;
  select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'keys', jsonb_build_object('p256dh', s.p256dh, 'auth', s.auth)))
    into subs from public.push_subscriptions s where s.user_id = _user;
  if subs is null then return false; end if;
  perform net.http_post(url := cfg.dispatch_url,
    body := jsonb_build_object('subscriptions', subs, 'payload', _payload),
    headers := jsonb_build_object('Content-Type', 'application/json', 'X-Push-Secret', cfg.secret),
    timeout_milliseconds := 8000);
  return true;
end $$;

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
      when 'private_message' then pref.private_message when 'admin' then pref.inbox when 'community' then pref.community else false end;
    if not allowed then return new; end if;
    if not exists (select 1 from public.push_subscriptions where user_id = new.user_id) then return new; end if;
    -- keine doppelten Pushes für dasselbe Ereignis (15 s) und max. 30 Pushes pro Nutzer in 10 Minuten
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
      else title := 'Wichtige Community-Mitteilung'; body := left(new.title, 140); url := '/profil?glocke=1';
    end case;

    if public.push_dispatch(new.user_id, jsonb_build_object('title', title, 'body', body, 'url', url,
        'tag', new.kind || '-' || coalesce(new.ref_id::text, new.id::text), 'notification_id', new.id)) then
      insert into public.push_log (user_id, kind, ref_id) values (new.user_id, new.kind, new.ref_id);
    end if;
  exception when others then
    raise notice 'Push übersprungen: %', sqlerrm;   -- Push-Fehler dürfen die Glocke niemals blockieren
  end;
  return new;
end $$;

drop trigger if exists push_on_notification on public.notifications;
create trigger push_on_notification after insert or update of created_at on public.notifications
  for each row execute function public.push_on_notification();

-- Test-Push an die eigenen Geräte (max. 3 pro 10 Minuten)
create or replace function public.push_send_test() returns boolean
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'AUTH_REQUIRED' using errcode = '28000'; end if;
  perform public.hit_rate_limit('push_test', 3, interval '10 minutes');
  if not exists (select 1 from public.push_config where id = 1) then raise exception 'PUSH_NOT_CONFIGURED'; end if;
  if not public.push_dispatch(uid, jsonb_build_object('title', 'Push funktioniert! 🌴', 'body', 'So sehen Mitteilungen von Leonida Explorer aus.', 'url', '/profil', 'tag', 'test')) then
    raise exception 'PUSH_NO_DEVICE';
  end if;
  return true;
end $$;

-- Vom Leonida-Server aufgerufen, um abgelaufene Geräte zu entfernen (nur mit geheimem Schlüssel)
create or replace function public.push_remove_endpoints(_secret text, _endpoints text[]) returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if not exists (select 1 from public.push_config where id = 1 and secret = _secret) then raise exception 'FORBIDDEN'; end if;
  delete from public.push_subscriptions where endpoint = any(_endpoints);
  get diagnostics n = row_count;
  return n;
end $$;

-- Einrichtung (nur im SQL-Editor ausführbar): Server-Adresse + geheimer Schlüssel
create or replace function public.push_set_config(_dispatch_url text, _secret text) returns text
language plpgsql security definer set search_path = public as $$
begin
  if _dispatch_url not like 'https://%' then raise exception 'Adresse muss mit https:// beginnen'; end if;
  insert into public.push_config (id, dispatch_url, secret) values (1, _dispatch_url, _secret)
  on conflict (id) do update set dispatch_url = excluded.dispatch_url, secret = excluded.secret, updated_at = now();
  return 'Push eingerichtet';
end $$;

revoke execute on function public.push_subscribe(text, text, text, text), public.push_unsubscribe(text),
  public.push_set_preferences(boolean, boolean, boolean, boolean, boolean, boolean, boolean), public.push_device_count(),
  public.push_send_test(), public.push_remove_endpoints(text, text[]), public.push_dispatch(uuid, jsonb),
  public.push_on_notification(), public.push_set_config(text, text) from public, anon, authenticated;
grant execute on function public.push_subscribe(text, text, text, text), public.push_unsubscribe(text),
  public.push_set_preferences(boolean, boolean, boolean, boolean, boolean, boolean, boolean), public.push_device_count(),
  public.push_send_test() to authenticated;
grant execute on function public.push_remove_endpoints(text, text[]) to anon, authenticated;

select '010 erfolgreich eingerichtet – jetzt noch push_set_config(...) ausführen' as ergebnis,
  exists (select 1 from pg_extension where extname = 'pg_net') as pg_net_aktiv;
