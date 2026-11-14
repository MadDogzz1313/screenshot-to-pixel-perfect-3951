-- 039_preise_anpassung.sql
-- Coin-Preise anpassen (einmalig, wiederholbar ohne erneute Erhöhung):
--   • Crew-Erstellung:         500 → 750 Coins
--   • Fundort-Freischaltung:   500 → 750 Coins (die ersten 5 fremden Fundorte bleiben kostenlos, Premium/Admin/eigene bleiben frei)
--   • Fahrzeugdesigns:         Preis × 3 (Grundlage: aktuell in der Datenbank hinterlegter Preis)
--   • Profilrahmen (inkl. animiert): Preis × 3 (Grundlage: aktuell hinterlegter Preis)
--
-- Unverändert: Coin-Guthaben, gekaufte Fahrzeuge/Rahmen, bestehende Crews, freigeschaltete Fundorte,
-- Köder-, Banner- und sonstige Shop-Preise.
-- Sicherheit: Der Server berechnet jeden Preis selbst – die App übergibt nur die Artikel-ID.
-- Doppelte Käufe/Abbuchungen verhindern weiterhin Wallet-Sperre (FOR UPDATE) + eindeutige Besitz-Einträge.
--
-- WIEDERHOLUNGSSCHUTZ: Die Verdreifachung läuft nur, wenn in public.price_adjustments noch kein
-- Eintrag '039_preise_x3' existiert. Ein zweites Ausführen ändert keine Preise mehr.
-- Voraussetzung: 023, 025 und 029. In Lovable → SQL Editor komplett einfügen und ausführen.

------------------------------------------------------------------------------------------------
-- 0. Protokoll-Tabelle (alte/neue Werte, Wiederholungsschutz) – nur Admins dürfen lesen
------------------------------------------------------------------------------------------------
create table if not exists public.price_adjustments (
  id text primary key,
  applied_at timestamptz not null default now(),
  details jsonb not null default '{}'::jsonb
);
alter table public.price_adjustments enable row level security;
drop policy if exists "price_adjustments admin read" on public.price_adjustments;
create policy "price_adjustments admin read" on public.price_adjustments
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));
revoke all on public.price_adjustments from anon;

------------------------------------------------------------------------------------------------
-- 1. Fahrzeuge & Profilrahmen einmalig verdreifachen (mit Dokumentation alt → neu)
------------------------------------------------------------------------------------------------
do $$
declare
  vehicles_before jsonb;
  frames_before jsonb;
begin
  if exists (select 1 from public.price_adjustments where id = '039_preise_x3') then
    raise notice '039: Preise wurden bereits verdreifacht (%). Keine erneute Erhöhung.',
      (select applied_at from public.price_adjustments where id = '039_preise_x3');
    return;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name, 'base_price', base_price, 'price', price) order by sort), '[]')
    into vehicles_before from public.vehicle_skins;
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name, 'price', price) order by sort), '[]')
    into frames_before from public.profile_frames;

  -- Fahrzeuge: price ist (base_price / 2) – neuer base_price = 6 × alter Preis → neuer Preis exakt 3 × alter Preis.
  -- Kostenlose Fahrzeuge (Miami Classic, Preis 0) bleiben kostenlos.
  update public.vehicle_skins set base_price = (base_price / 2) * 6 where price > 0;
  -- Profilrahmen: Preis × 3
  update public.profile_frames set price = price * 3 where price > 0;

  insert into public.price_adjustments (id, details) values ('039_preise_x3', jsonb_build_object(
    'vehicles_before', vehicles_before,
    'frames_before', frames_before,
    'vehicles_after', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name, 'base_price', base_price, 'price', price) order by sort), '[]') from public.vehicle_skins),
    'frames_after', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name, 'price', price) order by sort), '[]') from public.profile_frames),
    'crew_create', jsonb_build_object('before', 500, 'after', 750),
    'spot_unlock', jsonb_build_object('before', 500, 'after', 750)
  ));
end $$;

------------------------------------------------------------------------------------------------
-- 2. Fundort-Freischaltung: 750 Coins (ab dem 6. fremden Fundort). Alte Freischaltungen bleiben gültig.
------------------------------------------------------------------------------------------------
alter table public.spot_unlocks drop constraint if exists spot_unlocks_cost_check;
alter table public.spot_unlocks add constraint spot_unlocks_cost_check check (cost in (0, 150, 500, 750));

create or replace function public.unlock_spot(_spot uuid)
returns table(unlocked boolean, cost integer, balance bigint, free_unlock_number integer)
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := auth.uid();
  wallet_balance bigint;
  unlocked_count integer;
  charge integer;
  is_premium boolean;
  is_admin boolean;
  is_owner boolean;
  already_unlocked boolean;
  inserted_cost integer;
  unlock_cost constant integer := 750;
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if not exists (
    select 1 from public.spots as s
    where s.id = _spot and s.status in ('approved', 'hidden')
  ) then raise exception 'SPOT_NOT_FOUND'; end if;

  select s.author_id = uid into is_owner from public.spots as s where s.id = _spot;
  select public.has_role(uid, 'admin') into is_admin;

  if is_owner or is_admin then
    select coalesce(w.balance, 0) into wallet_balance
    from public.coin_wallets as w where w.user_id = uid;
    return query select true, 0, coalesce(wallet_balance, 0), null::integer;
    return;
  end if;

  -- Wallet-Sperre serialisiert parallele Freischaltungen desselben Nutzers (keine Doppelabbuchung).
  insert into public.coin_wallets (user_id, balance)
  values (uid, 0) on conflict (user_id) do nothing;
  select w.balance into wallet_balance
  from public.coin_wallets as w where w.user_id = uid for update;

  select exists (
    select 1 from public.spot_unlocks as su
    where su.user_id = uid and su.spot_id = _spot
  ) into already_unlocked;
  if already_unlocked then
    return query select true, 0, wallet_balance, null::integer;
    return;
  end if;

  select count(*)::integer into unlocked_count
  from public.spot_unlocks as su
  join public.spots as s on s.id = su.spot_id
  where su.user_id = uid and s.author_id is distinct from uid;
  select coalesce(p.premium_until > now(), false) into is_premium
  from public.profiles as p where p.id = uid;

  charge := case when unlocked_count < 5 or is_premium then 0 else unlock_cost end;
  if wallet_balance < charge then raise exception 'INSUFFICIENT_COINS'; end if;

  insert into public.spot_unlocks (user_id, spot_id, cost)
  values (uid, _spot, charge)
  on conflict (user_id, spot_id) do nothing
  returning spot_unlocks.cost into inserted_cost;
  if inserted_cost is null then
    return query select true, 0, wallet_balance, null::integer;
    return;
  end if;

  if inserted_cost > 0 then
    update public.coin_wallets as w
    set balance = w.balance - inserted_cost, updated_at = now()
    where w.user_id = uid;
    insert into public.coin_ledger (user_id, delta, reason, ref_id)
    values (uid, -inserted_cost, 'spot_unlock', _spot);
  end if;

  return query select true, inserted_cost, wallet_balance - inserted_cost,
    case when inserted_cost = 0 then unlocked_count + 1 else null::integer end;
end;
$$;

create or replace function public.my_spot_unlock_preview(_spot uuid)
returns table(unlocked boolean, unlocked_count integer, free_remaining integer, cost integer, balance bigint)
language plpgsql security definer stable
set search_path = public, pg_temp
as $$
declare
  uid uuid := auth.uid();
  n integer;
  b bigint;
  already boolean;
  privileged boolean;
  owner boolean;
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if not exists (
    select 1 from public.spots as s
    where s.id = _spot and s.status in ('approved', 'hidden')
  ) then raise exception 'SPOT_NOT_FOUND'; end if;

  select s.author_id = uid into owner from public.spots as s where s.id = _spot;
  select count(*)::integer into n
  from public.spot_unlocks as su
  join public.spots as s on s.id = su.spot_id
  where su.user_id = uid and s.author_id is distinct from uid;
  select exists (
    select 1 from public.spot_unlocks as su
    where su.user_id = uid and su.spot_id = _spot
  ) into already;
  select coalesce(w.balance, 0) into b
  from public.coin_wallets as w where w.user_id = uid;
  select public.has_role(uid, 'admin') or exists (
    select 1 from public.profiles as p where p.id = uid and p.premium_until > now()
  ) into privileged;

  return query select owner or already or privileged, n, greatest(0, 5 - n),
    case when owner or already or privileged or n < 5 then 0 else 750 end,
    coalesce(b, 0);
end;
$$;

------------------------------------------------------------------------------------------------
-- 3. Crew-Erstellung: atomar 750 Coins. Abbuchung erst nach erfolgreicher Anlage (Fehler → Rollback, keine Coins weg).
------------------------------------------------------------------------------------------------
create or replace function public.create_crew(
  _activity text, _platform text, _language text, _headset boolean, _max integer, _external integer,
  _description text, _start_mode text, _start_at timestamptz default null
) returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := public.require_active_user();
  new_id uuid;
  st timestamptz := case when _start_mode = 'time' then _start_at end;
  wallet_balance bigint;
  crew_cost constant integer := 750;
begin
  perform public.crew_validate(_activity, _platform, _language, _max, _external, _start_mode, st);
  if _external + 1 >= _max then raise exception 'CREW_INVALID_SIZE'; end if;
  if (select count(*) from public.crews where leader_id = uid and status = 'open' and expires_at > now()) >= 3 then
    raise exception 'CREW_LIMIT';
  end if;
  perform public.hit_rate_limit('crew_create', 6, interval '1 hour');

  insert into public.coin_wallets (user_id, balance)
  values (uid, 0) on conflict (user_id) do nothing;
  select w.balance into wallet_balance
  from public.coin_wallets as w where w.user_id = uid for update;
  if wallet_balance < crew_cost then raise exception 'INSUFFICIENT_COINS'; end if;

  delete from public.crews where expires_at < now() - interval '7 days';
  insert into public.crews (
    leader_id, activity_id, platform, language, headset_required, max_players, external_players,
    description, start_mode, start_at, expires_at
  ) values (
    uid, _activity, _platform, _language, coalesce(_headset, false), _max, _external,
    left(btrim(coalesce(_description, '')), 500), _start_mode, st,
    public.crew_expiry(_start_mode, st, now())
  ) returning id into new_id;
  insert into public.crew_members (crew_id, user_id, role) values (new_id, uid, 'leader');

  update public.coin_wallets as w
  set balance = w.balance - crew_cost, updated_at = now()
  where w.user_id = uid;
  insert into public.coin_ledger (user_id, delta, reason, ref_id)
  values (uid, -crew_cost, 'crew_create', new_id);
  return new_id;
end;
$$;

revoke execute on function public.create_crew(text, text, text, boolean, integer, integer, text, text, timestamptz) from public, anon;
grant execute on function public.create_crew(text, text, text, boolean, integer, integer, text, text, timestamptz) to authenticated;

------------------------------------------------------------------------------------------------
-- 4. Übersicht alt → neu (aus dem Protokoll – zeigt auch beim zweiten Ausführen die echten Ausgangswerte)
------------------------------------------------------------------------------------------------
select 'Fahrzeug' as art, b->>'name' as artikel, (b->>'price')::int as alter_preis, (a->>'price')::int as neuer_preis
from public.price_adjustments pa,
  jsonb_array_elements(pa.details->'vehicles_before') b
  join jsonb_array_elements(pa.details->'vehicles_after') a on a->>'id' = b->>'id'
where pa.id = '039_preise_x3'
union all
select 'Profilrahmen', b->>'name', (b->>'price')::int, (a->>'price')::int
from public.price_adjustments pa,
  jsonb_array_elements(pa.details->'frames_before') b
  join jsonb_array_elements(pa.details->'frames_after') a on a->>'id' = b->>'id'
where pa.id = '039_preise_x3'
union all
select 'Crew-Erstellung', 'Neue Crew', 500, 750
union all
select 'Fundort', 'Freischaltung ab dem 6. Fundort', 500, 750
order by 1, 3;
