-- 011_ios_app_push_konto_loeschen.sql — iOS-App (App Store): native Push über Apple (APNs) + Konto selbst löschen
-- ENTWURF: vorbereitet, aber NICHT in der Lovable-Datenbank ausgeführt. Voraussetzung: 010 wurde ausgeführt.
-- Rein additiv, mehrfach ausführbar. Web Push (010) funktioniert unverändert weiter.
--  1) Tabelle push_native_devices: Apple-Gerätetokens der iPhone-App (kein direkter App-Zugriff, nur per Funktion)
--  2) push_dispatch / push_on_notification / push_device_count / push_remove_endpoints berücksichtigen jetzt auch diese Geräte
--  3) delete_my_account(): Apple verlangt, dass Nutzer ihr Konto in der App selbst löschen können

do $$ begin
  if to_regclass('public.push_subscriptions') is null then raise exception 'Bitte zuerst 010_push_benachrichtigungen.sql ausführen.'; end if;
end $$;

------------------------------------------------------------------------------------------------
-- 1) Apple-Geräte
------------------------------------------------------------------------------------------------
create table if not exists public.push_native_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  token text not null unique check (token ~ '^[0-9a-fA-F]{32,200}$'),
  platform text not null default 'ios' check (platform in ('ios')),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index if not exists push_native_devices_user_idx on public.push_native_devices (user_id);
alter table public.push_native_devices enable row level security;
revoke all on public.push_native_devices from anon, authenticated;  -- kein direkter Zugriff aus der App

-- Gerät registrieren; dasselbe iPhone gehört immer nur dem zuletzt angemeldeten Konto
create or replace function public.push_register_native(_token text, _platform text default 'ios') returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'AUTH_REQUIRED' using errcode = '28000'; end if;
  insert into public.push_native_devices (user_id, token, platform) values (uid, lower(_token), coalesce(_platform, 'ios'))
  on conflict (token) do update set user_id = excluded.user_id, last_seen_at = now();
  delete from public.push_native_devices where id in (
    select id from public.push_native_devices where user_id = uid order by last_seen_at desc offset 10);
end $$;

create or replace function public.push_unregister_native(_token text) returns void
language sql security definer set search_path = public as $$
  delete from public.push_native_devices where token = lower(_token) and user_id = auth.uid()
$$;

------------------------------------------------------------------------------------------------
-- 2) Versand: Web-Push-Abos + Apple-Tokens in einem Aufruf an den Leonida-Server
------------------------------------------------------------------------------------------------
create or replace function public.push_dispatch(_user uuid, _payload jsonb) returns boolean
language plpgsql security definer set search_path = public, extensions as $$
declare cfg public.push_config; subs jsonb; tokens jsonb;
begin
  select * into cfg from public.push_config where id = 1;
  if not found then return false; end if;
  select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'keys', jsonb_build_object('p256dh', s.p256dh, 'auth', s.auth)))
    into subs from public.push_subscriptions s where s.user_id = _user;
  select jsonb_agg(d.token) into tokens from public.push_native_devices d where d.user_id = _user;
  if subs is null and tokens is null then return false; end if;
  perform net.http_post(url := cfg.dispatch_url,
    body := jsonb_build_object('subscriptions', coalesce(subs, '[]'::jsonb), 'apns_tokens', coalesce(tokens, '[]'::jsonb), 'payload', _payload),
    headers := jsonb_build_object('Content-Type', 'application/json', 'X-Push-Secret', cfg.secret),
    timeout_milliseconds := 8000);
  return true;
end $$;

-- wie 010, nur die Geräteprüfung zählt jetzt Web- und Apple-Geräte
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

create or replace function public.push_device_count() returns integer
language sql stable security definer set search_path = public as $$
  select ((select count(*) from public.push_subscriptions where user_id = auth.uid())
        + (select count(*) from public.push_native_devices where user_id = auth.uid()))::int
$$;

-- Vom Leonida-Server aufgerufen: abgelaufene Web-Abos UND abgemeldete iPhones entfernen (nur mit geheimem Schlüssel)
create or replace function public.push_remove_endpoints(_secret text, _endpoints text[]) returns integer
language plpgsql security definer set search_path = public as $$
declare n integer; m integer;
begin
  if not exists (select 1 from public.push_config where id = 1 and secret = _secret) then raise exception 'FORBIDDEN'; end if;
  delete from public.push_subscriptions where endpoint = any(_endpoints);
  get diagnostics n = row_count;
  delete from public.push_native_devices where token = any(_endpoints);
  get diagnostics m = row_count;
  return n + m;
end $$;

------------------------------------------------------------------------------------------------
-- 3) Konto selbst löschen (App-Store-Pflicht). Löscht das Anmeldekonto; Profil, Fundorte, Chats,
--    Freundschaften, Abzeichen usw. werden über die bestehenden Fremdschlüssel (on delete cascade) mitgelöscht.
------------------------------------------------------------------------------------------------
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public, auth as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'AUTH_REQUIRED' using errcode = '28000'; end if;
  if public.has_role(uid, 'admin') then raise exception 'ADMIN_DELETE'; end if;  -- Admins zuerst Rolle in Lovable entfernen
  delete from auth.users where id = uid;
end $$;

revoke execute on function public.push_register_native(text, text), public.push_unregister_native(text),
  public.delete_my_account() from public, anon, authenticated;
grant execute on function public.push_register_native(text, text), public.push_unregister_native(text),
  public.delete_my_account() to authenticated;
revoke execute on function public.push_dispatch(uuid, jsonb), public.push_on_notification() from public, anon, authenticated;
grant execute on function public.push_device_count() to authenticated;
grant execute on function public.push_remove_endpoints(text, text[]) to anon, authenticated;

select '011 erfolgreich eingerichtet' as ergebnis,
  to_regclass('public.push_native_devices') is not null as apple_geraete_tabelle,
  exists (select 1 from pg_proc where proname = 'delete_my_account') as konto_loeschen;
