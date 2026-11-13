-- 025_neon_garage_fahrzeugdesigns.sql
-- Neoshop-Fahrzeugdesigns + Neon Garage für Neon Highway.
-- Voraussetzung: 008 (require_active_user), 013 (coin_wallets/coin_ledger), 019 (bigint-Guthaben).
-- In Lovable → SQL-Editor komplett einfügen und ausführen. Mehrfach ausführbar.
-- Designs ändern nur das Aussehen – Spiellogik, Highscores und Belohnungen bleiben unberührt.
-- Preis = Ausgangspreis halbiert (ganzzahlig abgerundet), vom Server berechnet.

------------------------------------------------------------------------------------------------
-- 1. Katalog (öffentlich lesbar, nur per SQL/Admin änderbar)
------------------------------------------------------------------------------------------------
create table if not exists public.vehicle_skins (
  id text primary key check (id ~ '^[a-z0-9_]{2,32}$'),
  name text not null,
  base_price integer not null check (base_price >= 0),
  price integer generated always as (base_price / 2) stored,
  sort integer not null default 0,
  active boolean not null default true
);
alter table public.vehicle_skins enable row level security;
drop policy if exists vehicle_skins_read on public.vehicle_skins;
create policy vehicle_skins_read on public.vehicle_skins for select to anon, authenticated using (active);
revoke insert, update, delete on public.vehicle_skins from anon, authenticated;

insert into public.vehicle_skins (id, name, base_price, sort, active) values
  ('classic',  'Miami Classic',   0,    0, true),
  ('circuit',  'Neon Circuit',    1200, 1, true),
  ('sunset',   'Sunset Wave',     1500, 2, true),
  ('flamingo', 'Chrome Flamingo', 1600, 3, true),
  ('stripe',   'Cyber Stripe',    1800, 4, true),
  ('galaxy',   'Galaxy Drift',    2000, 5, true)
on conflict (id) do update set name = excluded.name, base_price = excluded.base_price, sort = excluded.sort, active = excluded.active;
-- Alle anderen (älteren) Designs aus dem Shop nehmen; Besitz bleibt erhalten.
update public.vehicle_skins set active = false
where id not in ('classic', 'circuit', 'sunset', 'flamingo', 'stripe', 'galaxy');

------------------------------------------------------------------------------------------------
-- 2. Besitz + Auswahl (nur lesbar für den Besitzer, Schreiben nur per RPC)
------------------------------------------------------------------------------------------------
create table if not exists public.user_vehicle_skins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  skin_id text not null references public.vehicle_skins(id),
  price_paid integer not null check (price_paid >= 0),
  purchased_at timestamptz not null default now(),
  unique (user_id, skin_id)
);
alter table public.user_vehicle_skins enable row level security;
drop policy if exists user_vehicle_skins_own on public.user_vehicle_skins;
create policy user_vehicle_skins_own on public.user_vehicle_skins for select to authenticated using (user_id = auth.uid());
revoke insert, update, delete on public.user_vehicle_skins from anon, authenticated;

create table if not exists public.vehicle_loadouts (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  skin_id text not null references public.vehicle_skins(id),
  updated_at timestamptz not null default now()
);
alter table public.vehicle_loadouts enable row level security;
drop policy if exists vehicle_loadouts_own on public.vehicle_loadouts;
create policy vehicle_loadouts_own on public.vehicle_loadouts for select to authenticated using (user_id = auth.uid());
revoke insert, update, delete on public.vehicle_loadouts from anon, authenticated;

------------------------------------------------------------------------------------------------
-- 3. Garage lesen
------------------------------------------------------------------------------------------------
drop function if exists public.my_vehicle_garage();
create function public.my_vehicle_garage()
returns table(id text, name text, base_price integer, price integer, sort integer, owned boolean, equipped boolean)
language sql stable security definer set search_path = public
as $$
  with eq as (
    select coalesce((select l.skin_id from public.vehicle_loadouts l where l.user_id = auth.uid()), 'classic') as skin_id
  )
  select s.id, s.name, s.base_price, s.price, s.sort,
    (s.price = 0 or exists (select 1 from public.user_vehicle_skins u where u.user_id = auth.uid() and u.skin_id = s.id)) as owned,
    s.id = (select eq.skin_id from eq) as equipped
  from public.vehicle_skins s
  where s.active
  order by s.sort, s.id
$$;
revoke execute on function public.my_vehicle_garage() from public;
grant execute on function public.my_vehicle_garage() to anon, authenticated;

------------------------------------------------------------------------------------------------
-- 4. Kaufen – atomar, genau einmal, nie doppelt berechnet
------------------------------------------------------------------------------------------------
drop function if exists public.buy_vehicle_skin(text);
create function public.buy_vehicle_skin(_skin text)
returns table(skin_id text, charged integer, balance bigint, already_owned boolean)
language plpgsql security definer set search_path = public, pg_temp
as $$
#variable_conflict use_column
declare
  uid uuid := public.require_active_user();
  s public.vehicle_skins;
  wallet_balance bigint;
  owned_id uuid;
  new_id uuid;
begin
  select * into s from public.vehicle_skins v where v.id = _skin and v.active;
  if not found then raise exception 'SKIN_NOT_FOUND'; end if;
  perform public.hit_rate_limit('vehicle_skin_buy', 30, interval '10 minutes');

  -- Wallet sperren: parallele Käufe desselben Nutzers laufen nacheinander.
  insert into public.coin_wallets (user_id, balance) values (uid, 0) on conflict (user_id) do nothing;
  select w.balance into wallet_balance from public.coin_wallets w where w.user_id = uid for update;

  select u.id into owned_id from public.user_vehicle_skins u where u.user_id = uid and u.skin_id = s.id;
  if owned_id is not null or s.price = 0 then
    return query select s.id, 0, wallet_balance, true;
    return;
  end if;
  if wallet_balance < s.price then raise exception 'INSUFFICIENT_COINS'; end if;

  insert into public.user_vehicle_skins (user_id, skin_id, price_paid) values (uid, s.id, s.price)
  returning id into new_id;
  update public.coin_wallets w set balance = w.balance - s.price, updated_at = now() where w.user_id = uid
  returning w.balance into wallet_balance;
  insert into public.coin_ledger (user_id, delta, reason, ref_id) values (uid, -s.price, 'vehicle_skin', new_id);
  return query select s.id, s.price, wallet_balance, false;
end;
$$;
revoke execute on function public.buy_vehicle_skin(text) from public, anon;
grant execute on function public.buy_vehicle_skin(text) to authenticated;

------------------------------------------------------------------------------------------------
-- 5. Ausrüsten – nur eigene oder kostenlose Designs
------------------------------------------------------------------------------------------------
drop function if exists public.equip_vehicle_skin(text);
create function public.equip_vehicle_skin(_skin text)
returns text
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  uid uuid := public.require_active_user();
  s public.vehicle_skins;
begin
  select * into s from public.vehicle_skins v where v.id = _skin and v.active;
  if not found then raise exception 'SKIN_NOT_FOUND'; end if;
  if s.price > 0 and not exists (select 1 from public.user_vehicle_skins u where u.user_id = uid and u.skin_id = s.id) then
    raise exception 'SKIN_LOCKED';
  end if;
  insert into public.vehicle_loadouts (user_id, skin_id, updated_at) values (uid, s.id, now())
  on conflict (user_id) do update set skin_id = excluded.skin_id, updated_at = now();
  return s.id;
end;
$$;
revoke execute on function public.equip_vehicle_skin(text) from public, anon;
grant execute on function public.equip_vehicle_skin(text) to authenticated;

select '025 erfolgreich – 6 Fahrzeugdesigns (Preise halbiert), Kauf + Garage serverseitig gesichert' as ergebnis;
