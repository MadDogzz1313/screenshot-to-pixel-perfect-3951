-- 037_werbebelohnungen_admob.sql
-- Leonida Fishing: freiwillige Rewarded Ads (Google AdMob)
--   fishing_bonus_casts  : +5 Bonus-Angelversuche, max. 2 erfolgreiche Belohnungen pro Tag
--   fishing_special_bait : +1 Epischer Köder (3 Würfe, identisch mit gekauftem), max. 1 pro Tag
-- Tagesgrenze: Mitternacht Europe/Berlin (wie die 15 täglichen Angelversuche).
-- Belohnung NUR serverseitig:
--   live-Modus : ausschließlich über Google Server-Side Verification (SSV) → Emergent-Backend /api/admob/ssv
--                prüft die Google-Signatur und ruft admob_ssv_confirm (geheimer Schlüssel = push_config.secret).
--   test-Modus : zusätzlich klar gekennzeichneter Testablauf (claim_ad_reward_test) für Googles Testanzeigen.
--   off        : Werbung ausgeblendet.
-- Ein abgebrochener/fehlgeschlagener Versuch verbraucht kein Limit (nur „granted“ zählt).
-- Voraussetzung: 008, 027 (Fishing v2), 035 (Bonus-Angelversuche). Mehrfach ausführbar. Bestehende Daten bleiben unverändert.

do $$ begin
  if to_regprocedure('public.require_active_user()') is null then raise exception 'Bitte zuerst SQL 008 ausführen.'; end if;
  if to_regclass('public.fishing_bait_inventory') is null then raise exception 'Bitte zuerst SQL 027 ausführen (Leonida Fishing).'; end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'fishing_state' and column_name = 'bonus_casts') then
    raise exception 'Bitte zuerst SQL 035 ausführen (Bonus-Angelversuche).';
  end if;
end $$;

------------------------------------------------------------------------------------------------
-- 1. Konfiguration (eine Zeile). Start: Testmodus mit Googles offiziellen Testanzeigen.
------------------------------------------------------------------------------------------------
create table if not exists public.ad_reward_config (
  id integer primary key default 1 check (id = 1),
  mode text not null default 'test' check (mode in ('off', 'test', 'live')),
  ios_bonus_unit_id text check (ios_bonus_unit_id is null or ios_bonus_unit_id ~ '^ca-app-pub-[0-9]+/[0-9]+$'),
  ios_bait_unit_id text check (ios_bait_unit_id is null or ios_bait_unit_id ~ '^ca-app-pub-[0-9]+/[0-9]+$'),
  updated_at timestamptz not null default now()
);
insert into public.ad_reward_config (id) values (1) on conflict (id) do nothing;
alter table public.ad_reward_config enable row level security;
revoke all on public.ad_reward_config from anon, authenticated;
-- live nur mit eingetragenen produktiven Anzeigenblöcken
alter table public.ad_reward_config drop constraint if exists ad_reward_config_live_units;
alter table public.ad_reward_config add constraint ad_reward_config_live_units
  check (mode <> 'live' or (ios_bonus_unit_id is not null and ios_bait_unit_id is not null));

------------------------------------------------------------------------------------------------
-- 2. Werbe-Sitzungen (eine pro Werbeversuch) – Protokoll und Schutz vor doppelten Gutschriften
------------------------------------------------------------------------------------------------
create table if not exists public.ad_reward_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  placement text not null check (placement in ('fishing_bonus_casts', 'fishing_special_bait')),
  berlin_day date not null,
  mode text not null check (mode in ('test', 'live')),
  status text not null default 'pending' check (status in ('pending', 'granted', 'expired')),
  verified_by text check (verified_by in ('ssv', 'test_client')),
  transaction_id text unique,               -- Google-SSV-Transaktion (Replay-Schutz)
  ad_unit text,
  reward jsonb,
  created_at timestamptz not null default now(),
  granted_at timestamptz
);
create index if not exists ad_reward_sessions_user_day_idx on public.ad_reward_sessions (user_id, placement, berlin_day) where status = 'granted';
create index if not exists ad_reward_sessions_pending_idx on public.ad_reward_sessions (user_id, placement) where status = 'pending';
alter table public.ad_reward_sessions enable row level security;
revoke all on public.ad_reward_sessions from anon, authenticated;

create or replace function public.ad_reward_limit(_placement text) returns integer
language sql immutable as $$ select case _placement when 'fishing_bonus_casts' then 2 when 'fishing_special_bait' then 1 else 0 end $$;

create or replace function public.ad_reward_state_json(_uid uuid) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  with d as (select public.fishing_berlin_day(now()) as day),
  used as (select s.placement, count(*) as n from public.ad_reward_sessions s, d
           where s.user_id = _uid and s.status = 'granted' and s.berlin_day = d.day group by s.placement)
  select jsonb_build_object(
    'mode', (select c.mode from public.ad_reward_config c where c.id = 1),
    'next_reset_at', public.fishing_next_reset(now()),
    'bonus', jsonb_build_object('used', coalesce((select n from used where placement = 'fishing_bonus_casts'), 0), 'limit', 2, 'amount', 5),
    'bait', jsonb_build_object('used', coalesce((select n from used where placement = 'fishing_special_bait'), 0), 'limit', 1, 'bait_id', 'bait_epic'))
$$;

-- Interne Gutschrift (atomar, nur aus den Funktionen unten). Erwartet gesperrte Sitzung.
create or replace function public.ad_reward_grant(_s public.ad_reward_sessions, _verified_by text, _transaction text, _ad_unit text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare used integer; rw jsonb; bonus bigint; inv public.fishing_bait_inventory; b public.fishing_baits;
begin
  -- Nutzer serialisieren (gleiche Sperre wie beim Angeln)
  insert into public.fishing_state (user_id) values (_s.user_id) on conflict (user_id) do nothing;
  perform 1 from public.fishing_state st where st.user_id = _s.user_id for update;
  select count(*) into used from public.ad_reward_sessions x
  where x.user_id = _s.user_id and x.placement = _s.placement and x.berlin_day = _s.berlin_day and x.status = 'granted';
  if used >= public.ad_reward_limit(_s.placement) then
    update public.ad_reward_sessions set status = 'expired' where id = _s.id;
    raise exception 'AD_DAILY_LIMIT';
  end if;
  if _s.placement = 'fishing_bonus_casts' then
    update public.fishing_state st set bonus_casts = st.bonus_casts + 5, updated_at = now() where st.user_id = _s.user_id returning st.bonus_casts into bonus;
    rw := jsonb_build_object('bonus_casts_added', 5, 'bonus_casts', bonus);
  else
    select * into b from public.fishing_baits fb where fb.id = 'bait_epic';
    insert into public.fishing_bait_inventory (user_id, bait_id, uses_left, price_paid, purchase_nonce)
    values (_s.user_id, b.id, b.uses, 0, _s.id) returning * into inv;
    rw := jsonb_build_object('bait_id', b.id, 'uses_left', inv.uses_left, 'inventory_id', inv.id);
  end if;
  update public.ad_reward_sessions set status = 'granted', verified_by = _verified_by, transaction_id = _transaction,
    ad_unit = coalesce(_ad_unit, ad_unit), reward = rw, granted_at = now() where id = _s.id;
  return jsonb_build_object('session_id', _s.id, 'status', 'granted', 'already_processed', false, 'reward', rw,
    'state', public.ad_reward_state_json(_s.user_id));
end $$;

------------------------------------------------------------------------------------------------
-- 3. Spieler-Funktionen
------------------------------------------------------------------------------------------------
create or replace function public.my_ad_reward_state() returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare uid uuid := auth.uid(); c public.ad_reward_config;
begin
  select * into c from public.ad_reward_config where id = 1;
  if uid is null then return jsonb_build_object('mode', coalesce(c.mode, 'off'), 'logged_in', false); end if;
  return public.ad_reward_state_json(uid) || jsonb_build_object('logged_in', true,
    'units', case when c.mode = 'live' then jsonb_build_object('fishing_bonus_casts', c.ios_bonus_unit_id, 'fishing_special_bait', c.ios_bait_unit_id) end);
end $$;

-- Vor dem Laden der Anzeige: Limit prüfen, Sitzung anlegen (verbraucht noch nichts)
create or replace function public.start_ad_reward(_placement text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid := public.require_active_user(); c public.ad_reward_config; s public.ad_reward_sessions; used integer;
  today date := public.fishing_berlin_day(now());
begin
  if public.ad_reward_limit(_placement) = 0 then raise exception 'AD_PLACEMENT_INVALID'; end if;
  select * into c from public.ad_reward_config where id = 1;
  if c.mode is null or c.mode = 'off' then raise exception 'ADS_DISABLED'; end if;
  insert into public.fishing_state (user_id) values (uid) on conflict (user_id) do nothing;
  perform 1 from public.fishing_state st where st.user_id = uid for update;
  select count(*) into used from public.ad_reward_sessions x where x.user_id = uid and x.placement = _placement and x.berlin_day = today and x.status = 'granted';
  if used >= public.ad_reward_limit(_placement) then raise exception 'AD_DAILY_LIMIT'; end if;
  -- alte, nie bestätigte Versuche verfallen (kein Limit verbraucht)
  update public.ad_reward_sessions set status = 'expired'
  where user_id = uid and status = 'pending' and (created_at < now() - interval '2 hours' or berlin_day <> today);
  insert into public.ad_reward_sessions (user_id, placement, berlin_day, mode) values (uid, _placement, today, c.mode) returning * into s;
  return jsonb_build_object('session_id', s.id, 'mode', s.mode, 'placement', s.placement,
    'ad_unit_id', case when c.mode = 'live' then case _placement when 'fishing_bonus_casts' then c.ios_bonus_unit_id else c.ios_bait_unit_id end end,
    'remaining', public.ad_reward_limit(_placement) - used);
end $$;

-- Status einer Sitzung (App fragt nach dem Reward-Ereignis nach, bis SSV bestätigt hat)
create or replace function public.my_ad_reward_session(_session uuid) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare s public.ad_reward_sessions;
begin
  select * into s from public.ad_reward_sessions x where x.id = _session and x.user_id = auth.uid();
  if not found then raise exception 'AD_SESSION_NOT_FOUND'; end if;
  return jsonb_build_object('session_id', s.id, 'status', s.status, 'placement', s.placement, 'reward', s.reward,
    'state', public.ad_reward_state_json(s.user_id));
end $$;

-- NUR Testmodus: Gutschrift nach dem Reward-Ereignis einer Google-Testanzeige (klar gekennzeichnet: verified_by = test_client)
create or replace function public.claim_ad_reward_test(_session uuid) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid := public.require_active_user(); s public.ad_reward_sessions;
begin
  if (select mode from public.ad_reward_config where id = 1) <> 'test' then raise exception 'AD_TEST_MODE_OFF'; end if;
  select * into s from public.ad_reward_sessions x where x.id = _session and x.user_id = uid for update;
  if not found then raise exception 'AD_SESSION_NOT_FOUND'; end if;
  if s.status = 'granted' then
    return jsonb_build_object('session_id', s.id, 'status', 'granted', 'already_processed', true, 'reward', s.reward, 'state', public.ad_reward_state_json(uid));
  end if;
  if s.status <> 'pending' or s.mode <> 'test' then raise exception 'AD_SESSION_INVALID'; end if;
  if s.berlin_day <> public.fishing_berlin_day(now()) and s.created_at < now() - interval '30 minutes' then raise exception 'AD_SESSION_INVALID'; end if;
  return public.ad_reward_grant(s, 'test_client', null, null);
end $$;

------------------------------------------------------------------------------------------------
-- 4. Google SSV-Bestätigung (nur vom Emergent-Backend nach geprüfter Google-Signatur)
------------------------------------------------------------------------------------------------
create or replace function public.admob_ssv_confirm(_secret text, _transaction_id text, _user_id uuid, _session uuid, _ad_unit text, _reward_amount integer, _reward_item text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare s public.ad_reward_sessions; prev public.ad_reward_sessions;
begin
  if _secret is null or not exists (select 1 from public.push_config where id = 1 and secret = _secret) then raise exception 'FORBIDDEN'; end if;
  if coalesce(btrim(_transaction_id), '') = '' then raise exception 'AD_TRANSACTION_REQUIRED'; end if;
  perform pg_advisory_xact_lock(hashtextextended('admob:' || _transaction_id, 37));
  select * into prev from public.ad_reward_sessions x where x.transaction_id = _transaction_id;
  if found then return jsonb_build_object('session_id', prev.id, 'status', prev.status, 'already_processed', true); end if;
  select * into s from public.ad_reward_sessions x where x.id = _session and x.user_id = _user_id for update;
  if not found then raise exception 'AD_SESSION_NOT_FOUND'; end if;
  if s.status = 'granted' then return jsonb_build_object('session_id', s.id, 'status', 'granted', 'already_processed', true); end if;
  if s.status <> 'pending' then raise exception 'AD_SESSION_INVALID'; end if;
  return public.ad_reward_grant(s, 'ssv', _transaction_id, _ad_unit);
end $$;

------------------------------------------------------------------------------------------------
-- 5. Admin: Modus und produktive Anzeigenblöcke (live erst nach AdMob-Freigabe!)
------------------------------------------------------------------------------------------------
create or replace function public.admin_ad_reward_config() returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare c public.ad_reward_config;
begin
  perform public.require_admin();
  select * into c from public.ad_reward_config where id = 1;
  return jsonb_build_object('mode', c.mode, 'ios_bonus_unit_id', c.ios_bonus_unit_id, 'ios_bait_unit_id', c.ios_bait_unit_id, 'updated_at', c.updated_at,
    'ssv_secret_ready', exists (select 1 from public.push_config where id = 1),
    'granted_today', (select count(*) from public.ad_reward_sessions s where s.status = 'granted' and s.berlin_day = public.fishing_berlin_day(now())),
    'granted_ssv_total', (select count(*) from public.ad_reward_sessions s where s.verified_by = 'ssv'));
end $$;

create or replace function public.admin_set_ad_reward_config(_mode text, _bonus_unit text, _bait_unit text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public.require_admin();
  if _mode not in ('off', 'test', 'live') then raise exception 'AD_MODE_INVALID'; end if;
  if _mode = 'live' and (coalesce(btrim(_bonus_unit), '') = '' or coalesce(btrim(_bait_unit), '') = '') then raise exception 'AD_UNITS_REQUIRED'; end if;
  if _mode = 'live' and (_bonus_unit like 'ca-app-pub-3940256099942544/%' or _bait_unit like 'ca-app-pub-3940256099942544/%') then raise exception 'AD_UNITS_ARE_TEST_IDS'; end if;
  update public.ad_reward_config set mode = _mode, ios_bonus_unit_id = nullif(btrim(_bonus_unit), ''), ios_bait_unit_id = nullif(btrim(_bait_unit), ''), updated_at = now() where id = 1;
  return public.admin_ad_reward_config();
end $$;

------------------------------------------------------------------------------------------------
-- 6. Rechte
------------------------------------------------------------------------------------------------
revoke execute on function public.ad_reward_limit(text), public.ad_reward_state_json(uuid),
  public.ad_reward_grant(public.ad_reward_sessions, text, text, text), public.my_ad_reward_state(), public.start_ad_reward(text),
  public.my_ad_reward_session(uuid), public.claim_ad_reward_test(uuid),
  public.admob_ssv_confirm(text, text, uuid, uuid, text, integer, text), public.admin_ad_reward_config(),
  public.admin_set_ad_reward_config(text, text, text) from public, anon, authenticated;
grant execute on function public.my_ad_reward_state() to anon, authenticated;
grant execute on function public.start_ad_reward(text), public.my_ad_reward_session(uuid), public.claim_ad_reward_test(uuid),
  public.admin_ad_reward_config(), public.admin_set_ad_reward_config(text, text, text) to authenticated;
-- Backend ruft mit dem öffentlichen Schlüssel + geheimem push_config.secret auf
grant execute on function public.admob_ssv_confirm(text, text, uuid, uuid, text, integer, text) to anon, authenticated;

select '037 erfolgreich – Werbebelohnungen (Modus: ' || (select mode from public.ad_reward_config where id = 1) || ')' as ergebnis;
