-- 027_leonida_fishing_v2.sql
-- Leonida Fishing v2: 5 Fischarten, Angelköder (Neoshop), 15 Würfe pro Tag (Europe/Berlin),
-- serverseitige Fangberechnung, Sammlung, Marlín-Bestenliste, Arcade-XP pro Fang.
-- Voraussetzung: 008 (require_active_user, hit_rate_limit), 013/019 (Coins, Arcade), 024 (Level-Coins).
-- In Lovable → SQL-Editor komplett einfügen und ausführen. Mehrfach ausführbar.

------------------------------------------------------------------------------------------------
-- 1. Katalog: Fischarten + Köder (öffentlich lesbar, nur per SQL änderbar)
------------------------------------------------------------------------------------------------
create table if not exists public.fishing_species (
  id text primary key check (id ~ '^[a-z_]{3,32}$'),
  rarity text not null unique check (rarity in ('common', 'uncommon', 'rare', 'epic', 'legendary')),
  name text not null,
  base_chance numeric(7,4) not null check (base_chance > 0 and base_chance <= 100), -- Prozent
  reward_coins integer not null check (reward_coins >= 0),
  reward_xp integer not null default 5 check (reward_xp between 0 and 100),
  sort integer not null
);
insert into public.fishing_species (id, rarity, name, base_chance, reward_coins, reward_xp, sort) values
  ('kuestenbarsch',   'common',    'Küstenbarsch',    50.0, 25,  5, 1),
  ('sonnenbarsch',    'uncommon',  'Sonnenbarsch',    25.0, 50,  5, 2),
  ('neon_makrele',    'rare',      'Neon-Makrele',    12.5, 100, 5, 3),
  ('palmenschnapper', 'epic',      'Palmenschnapper',  5.0, 175, 5, 4),
  ('leonida_marlin',  'legendary', 'Leonida-Marlín',   7.5, 250, 5, 5)
on conflict (id) do update set rarity = excluded.rarity, name = excluded.name, base_chance = excluded.base_chance,
  reward_coins = excluded.reward_coins, reward_xp = excluded.reward_xp, sort = excluded.sort;
do $$ begin
  if (select sum(base_chance) from public.fishing_species) <> 100 then raise exception 'FISHING_ODDS_INVALID'; end if;
end $$;

create table if not exists public.fishing_baits (
  id text primary key check (id ~ '^[a-z_]{3,32}$'),
  target_rarity text not null unique references public.fishing_species(rarity),
  name text not null,
  price integer not null check (price >= 0),
  uses integer not null default 3 check (uses between 1 and 10),
  boost_factor numeric not null default 4 check (boost_factor >= 1), -- +300 % = ×4
  sort integer not null
);
-- Preis = halbe Fisch-Belohnung, abgerundet (12, 25, 50, 87, 125)
insert into public.fishing_baits (id, target_rarity, name, price, uses, boost_factor, sort)
select b.id, b.rarity, b.name, floor(s.reward_coins / 2.0)::integer, 3, 4, s.sort
from (values ('bait_common', 'common', 'Gewöhnlicher Köder'), ('bait_uncommon', 'uncommon', 'Ungewöhnlicher Köder'),
             ('bait_rare', 'rare', 'Seltener Köder'), ('bait_epic', 'epic', 'Epischer Köder'),
             ('bait_legendary', 'legendary', 'Legendärer Köder')) as b(id, rarity, name)
join public.fishing_species s on s.rarity = b.rarity
on conflict (id) do update set target_rarity = excluded.target_rarity, name = excluded.name, price = excluded.price,
  uses = excluded.uses, boost_factor = excluded.boost_factor, sort = excluded.sort;

alter table public.fishing_species enable row level security;
alter table public.fishing_baits enable row level security;
drop policy if exists fishing_species_read on public.fishing_species;
create policy fishing_species_read on public.fishing_species for select to anon, authenticated using (true);
drop policy if exists fishing_baits_read on public.fishing_baits;
create policy fishing_baits_read on public.fishing_baits for select to anon, authenticated using (true);
revoke insert, update, delete on public.fishing_species, public.fishing_baits from anon, authenticated;

------------------------------------------------------------------------------------------------
-- 2. Spielerdaten (kein direkter Schreibzugriff; Würfe gar nicht direkt lesbar → Fang bleibt geheim)
------------------------------------------------------------------------------------------------
create table if not exists public.fishing_bait_inventory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  bait_id text not null references public.fishing_baits(id),
  uses_left integer not null check (uses_left between 0 and 10),
  price_paid integer not null check (price_paid >= 0),
  purchase_nonce uuid not null,
  purchased_at timestamptz not null default now(),
  unique (user_id, purchase_nonce)
);
create index if not exists fishing_bait_inventory_active_idx on public.fishing_bait_inventory (user_id, bait_id, purchased_at) where uses_left > 0;

create table if not exists public.fishing_state (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  selected_bait_id text references public.fishing_baits(id),
  updated_at timestamptz not null default now()
);

create table if not exists public.fishing_casts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  client_nonce uuid not null,
  berlin_day date not null,
  bait_id text references public.fishing_baits(id),
  bait_inventory_id uuid references public.fishing_bait_inventory(id) on delete set null,
  species_id text not null references public.fishing_species(id),
  roll double precision not null,
  cast_at timestamptz not null default clock_timestamp(),
  bite_delay_ms integer not null check (bite_delay_ms between 500 and 10000),
  window_ms integer not null check (window_ms between 500 and 5000),
  status text not null default 'pending' check (status in ('pending', 'caught', 'escaped')),
  outcome text,
  resolved_at timestamptz,
  coins_awarded integer not null default 0,
  xp_awarded integer not null default 0,
  bait_uses_left integer,
  unique (user_id, client_nonce)
);
create index if not exists fishing_casts_user_day_idx on public.fishing_casts (user_id, berlin_day);
create unique index if not exists fishing_casts_one_pending_idx on public.fishing_casts (user_id) where status = 'pending';

alter table public.fishing_bait_inventory enable row level security;
alter table public.fishing_state enable row level security;
alter table public.fishing_casts enable row level security;
drop policy if exists fishing_bait_inventory_own on public.fishing_bait_inventory;
create policy fishing_bait_inventory_own on public.fishing_bait_inventory for select to authenticated using (user_id = auth.uid());
drop policy if exists fishing_state_own on public.fishing_state;
create policy fishing_state_own on public.fishing_state for select to authenticated using (user_id = auth.uid());
revoke all on public.fishing_casts from anon, authenticated;
revoke insert, update, delete on public.fishing_bait_inventory, public.fishing_state from anon, authenticated;

-- Arcade-XP pro Fang über die bestehende XP-Tabelle (Fang statt Runde als Referenz)
alter table public.arcade_xp_events alter column round_id drop not null;
alter table public.arcade_xp_events add column if not exists fishing_cast_id uuid unique references public.fishing_casts(id) on delete cascade;

-- Bestenliste = Anzahl Leonida-Marlíne. Alte Punkte-Highscores werden einmalig gesichert und entfernt.
do $$ begin
  if to_regclass('public.arcade_scores_fishing_legacy') is null then
    create table public.arcade_scores_fishing_legacy as select * from public.arcade_scores where game_id = 'leonida_fishing';
    alter table public.arcade_scores_fishing_legacy enable row level security;
    revoke all on public.arcade_scores_fishing_legacy from anon, authenticated;
    delete from public.arcade_scores where game_id = 'leonida_fishing';
  end if;
end $$;
-- Alte 45-Sekunden-Runden abschalten (verhindert Umgehung des Tageslimits mit alten App-Versionen)
update public.arcade_games set enabled = false where id = 'leonida_fishing';

------------------------------------------------------------------------------------------------
-- 3. Zeit (Europe/Berlin inkl. Sommerzeit) + Wahrscheinlichkeiten
------------------------------------------------------------------------------------------------
create or replace function public.fishing_berlin_day(_ts timestamptz)
returns date language sql stable set search_path = public as $$ select (_ts at time zone 'Europe/Berlin')::date $$;

create or replace function public.fishing_next_reset(_ts timestamptz)
returns timestamptz language sql stable set search_path = public as $$
  select ((public.fishing_berlin_day(_ts) + 1)::timestamp at time zone 'Europe/Berlin')
$$;

-- Köder: Ziel-Chance ×4 (max. 100 %), alle anderen proportional verkleinert → Summe exakt 100 %.
create or replace function public.fishing_odds(_bait text default null)
returns table(species_id text, rarity text, sort integer, chance numeric)
language sql stable security definer set search_path = public as $$
  with b as (select target_rarity, boost_factor from public.fishing_baits where id = _bait),
  t as (select s.base_chance as p, least(100, s.base_chance * b.boost_factor) as q
        from public.fishing_species s join b on s.rarity = b.target_rarity)
  select s.id, s.rarity, s.sort,
    case
      when not exists (select 1 from t) then s.base_chance
      when s.rarity = (select target_rarity from b) then (select q from t)
      else coalesce(s.base_chance * (100 - (select q from t)) / nullif(100 - (select p from t), 0), 0)
    end
  from public.fishing_species s
  order by s.sort
$$;

create or replace function public.fishing_pick_species(_bait text, _roll double precision)
returns text language sql stable security definer set search_path = public as $$
  with o as (select species_id, chance, sum(chance) over (order by sort) as cum from public.fishing_odds(_bait))
  select coalesce(
    (select species_id from o where chance > 0 and cum > (_roll * 100)::numeric order by cum limit 1),
    (select species_id from o where chance > 0 order by cum desc limit 1))
$$;

------------------------------------------------------------------------------------------------
-- 4. Hilfsfunktionen (intern)
------------------------------------------------------------------------------------------------
create or replace function public.fishing_expire_pending(_uid uuid)
returns void language sql security definer set search_path = public as $$
  update public.fishing_casts c set status = 'escaped', outcome = 'expired', resolved_at = clock_timestamp()
  where c.user_id = _uid and c.status = 'pending'
    and c.cast_at + ((c.bite_delay_ms + c.window_ms + 3000) * interval '1 millisecond') < clock_timestamp()
$$;

create or replace function public.fishing_cast_json(c public.fishing_casts)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'cast_id', c.id, 'status', c.status, 'outcome', c.outcome, 'bait_id', c.bait_id,
    'bite_delay_ms', c.bite_delay_ms, 'window_ms', c.window_ms,
    'elapsed_ms', floor(extract(epoch from (clock_timestamp() - c.cast_at)) * 1000)::bigint,
    'species_id', case when c.status = 'caught' then c.species_id end,
    'coins', c.coins_awarded, 'xp', c.xp_awarded, 'bait_uses_left', c.bait_uses_left, 'resolved_at', c.resolved_at)
$$;
revoke execute on function public.fishing_expire_pending(uuid), public.fishing_cast_json(public.fishing_casts) from public, anon, authenticated;

------------------------------------------------------------------------------------------------
-- 5. Zustand lesen (Limit, Inventar, Sammlung, laufender/letzter Wurf zur Wiederherstellung)
------------------------------------------------------------------------------------------------
create or replace function public.my_fishing_state()
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  uid uuid := auth.uid();
  today date := public.fishing_berlin_day(now());
  pending public.fishing_casts; last_cast public.fishing_casts;
begin
  if uid is null then
    return jsonb_build_object('logged_in', false, 'limit', 15, 'used', 0, 'next_reset_at', public.fishing_next_reset(now()));
  end if;
  perform public.fishing_expire_pending(uid);
  select * into pending from public.fishing_casts c where c.user_id = uid and c.status = 'pending' limit 1;
  select * into last_cast from public.fishing_casts c where c.user_id = uid and c.status <> 'pending' order by c.resolved_at desc nulls last limit 1;
  return jsonb_build_object(
    'logged_in', true,
    'day', today,
    'limit', 15,
    'used', (select count(*) from public.fishing_casts c where c.user_id = uid and c.berlin_day = today),
    'next_reset_at', public.fishing_next_reset(now()),
    'selected_bait_id', (select s.selected_bait_id from public.fishing_state s where s.user_id = uid),
    'inventory', coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'bait_id', i.bait_id, 'uses_left', i.uses_left) order by i.purchased_at)
                  from public.fishing_bait_inventory i where i.user_id = uid and i.uses_left > 0), '[]'::jsonb),
    'collection', coalesce((select jsonb_object_agg(x.species_id, x.n) from
                  (select c.species_id, count(*) as n from public.fishing_casts c where c.user_id = uid and c.status = 'caught' group by c.species_id) x), '{}'::jsonb),
    'pending', case when pending.id is not null then public.fishing_cast_json(pending) end,
    'last', case when last_cast.id is not null then public.fishing_cast_json(last_cast) end);
end;
$$;

------------------------------------------------------------------------------------------------
-- 6. Köder kaufen (idempotent per Kauf-Nonce: Wiederholung bucht nie doppelt ab)
------------------------------------------------------------------------------------------------
create or replace function public.buy_fishing_bait(_bait text, _nonce uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  uid uuid := public.require_active_user();
  b public.fishing_baits; inv public.fishing_bait_inventory; wallet_balance bigint;
begin
  if _nonce is null then raise exception 'NONCE_REQUIRED'; end if;
  select * into b from public.fishing_baits fb where fb.id = _bait;
  if not found then raise exception 'BAIT_NOT_FOUND'; end if;
  insert into public.coin_wallets (user_id, balance) values (uid, 0) on conflict (user_id) do nothing;
  select w.balance into wallet_balance from public.coin_wallets w where w.user_id = uid for update;

  select * into inv from public.fishing_bait_inventory i where i.user_id = uid and i.purchase_nonce = _nonce;
  if found then
    return jsonb_build_object('inventory_id', inv.id, 'bait_id', inv.bait_id, 'charged', 0, 'balance', wallet_balance,
      'uses_left', inv.uses_left, 'already_processed', true);
  end if;
  perform public.hit_rate_limit('fishing_bait_buy', 40, interval '10 minutes');
  if wallet_balance < b.price then raise exception 'INSUFFICIENT_COINS'; end if;

  insert into public.fishing_bait_inventory (user_id, bait_id, uses_left, price_paid, purchase_nonce)
  values (uid, b.id, b.uses, b.price, _nonce) returning * into inv;
  update public.coin_wallets w set balance = w.balance - b.price, updated_at = now() where w.user_id = uid
  returning w.balance into wallet_balance;
  insert into public.coin_ledger (user_id, delta, reason, ref_id) values (uid, -b.price, 'fishing_bait', inv.id);
  return jsonb_build_object('inventory_id', inv.id, 'bait_id', b.id, 'charged', b.price, 'balance', wallet_balance,
    'uses_left', inv.uses_left, 'already_processed', false);
end;
$$;

------------------------------------------------------------------------------------------------
-- 7. Köder auswählen (nur einer aktiv; null = ohne Köder)
------------------------------------------------------------------------------------------------
create or replace function public.select_fishing_bait(_bait text)
returns text language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid := public.require_active_user();
begin
  if _bait is not null and not exists (select 1 from public.fishing_bait_inventory i where i.user_id = uid and i.bait_id = _bait and i.uses_left > 0) then
    raise exception 'BAIT_EMPTY';
  end if;
  insert into public.fishing_state (user_id, selected_bait_id, updated_at) values (uid, _bait, now())
  on conflict (user_id) do update set selected_bait_id = excluded.selected_bait_id, updated_at = now();
  return _bait;
end;
$$;

------------------------------------------------------------------------------------------------
-- 8. Auswerfen: zählt sofort als Versuch, Fisch wird hier geheim serverseitig gewürfelt
------------------------------------------------------------------------------------------------
create or replace function public.start_fishing_cast(_nonce uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  uid uuid := public.require_active_user();
  today date := public.fishing_berlin_day(now());
  st public.fishing_state; c public.fishing_casts; inv public.fishing_bait_inventory;
  used integer; r double precision;
begin
  if _nonce is null then raise exception 'NONCE_REQUIRED'; end if;
  insert into public.fishing_state (user_id) values (uid) on conflict (user_id) do nothing;
  select * into st from public.fishing_state s where s.user_id = uid for update; -- Würfe je Nutzer strikt nacheinander

  select * into c from public.fishing_casts fc where fc.user_id = uid and fc.client_nonce = _nonce;
  if found then return public.fishing_cast_json(c) || jsonb_build_object('resumed', true,
    'used', (select count(*) from public.fishing_casts x where x.user_id = uid and x.berlin_day = today), 'limit', 15); end if;

  perform public.fishing_expire_pending(uid);
  select * into c from public.fishing_casts fc where fc.user_id = uid and fc.status = 'pending' limit 1;
  if found then return public.fishing_cast_json(c) || jsonb_build_object('resumed', true,
    'used', (select count(*) from public.fishing_casts x where x.user_id = uid and x.berlin_day = today), 'limit', 15); end if;

  select count(*) into used from public.fishing_casts fc where fc.user_id = uid and fc.berlin_day = today;
  if used >= 15 then raise exception 'FISHING_DAILY_LIMIT'; end if;

  if st.selected_bait_id is not null then
    select * into inv from public.fishing_bait_inventory i
    where i.user_id = uid and i.bait_id = st.selected_bait_id and i.uses_left > 0
    order by i.purchased_at limit 1 for update;
    if not found then update public.fishing_state s set selected_bait_id = null, updated_at = now() where s.user_id = uid; end if;
  end if;

  r := random();
  insert into public.fishing_casts (user_id, client_nonce, berlin_day, bait_id, bait_inventory_id, species_id, roll, bite_delay_ms, window_ms, bait_uses_left)
  values (uid, _nonce, today, inv.bait_id, inv.id, public.fishing_pick_species(inv.bait_id, r), r,
          1600 + floor(random() * 2600)::integer, 1500, inv.uses_left)
  returning * into c;
  return public.fishing_cast_json(c) || jsonb_build_object('resumed', false, 'used', used + 1, 'limit', 15);
end;
$$;

------------------------------------------------------------------------------------------------
-- 9. Einholen: Zeitfenster wird mit der Serverzeit geprüft; Gutschrift + Köderverbrauch atomar, genau einmal
------------------------------------------------------------------------------------------------
drop function if exists public.reel_fishing_cast(uuid, boolean);
create function public.reel_fishing_cast(_cast uuid, _reel boolean default true)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  uid uuid := public.require_active_user();
  c public.fishing_casts; s public.fishing_species;
  elapsed bigint; reward_xp integer; day_xp integer; wallet_balance bigint; uses integer;
begin
  perform 1 from public.fishing_state fs where fs.user_id = uid for update;
  select * into c from public.fishing_casts fc where fc.id = _cast and fc.user_id = uid for update;
  if not found then raise exception 'CAST_NOT_FOUND'; end if;
  if c.status <> 'pending' then
    return public.fishing_cast_json(c) || jsonb_build_object('already_processed', true,
      'balance', (select w.balance from public.coin_wallets w where w.user_id = uid));
  end if;

  elapsed := floor(extract(epoch from (clock_timestamp() - c.cast_at)) * 1000)::bigint;
  -- Untergrenze leicht vor dem Biss (Uhr-Rundung), Obergrenze großzügig wegen Netzlaufzeit
  if not _reel or elapsed < c.bite_delay_ms - 300 or elapsed > c.bite_delay_ms + c.window_ms + 3000 then
    update public.fishing_casts fc set status = 'escaped', resolved_at = clock_timestamp(),
      outcome = case when not _reel then 'missed' when elapsed < c.bite_delay_ms - 300 then 'too_early' else 'too_late' end
    where fc.id = c.id returning * into c;
    return public.fishing_cast_json(c) || jsonb_build_object('already_processed', false,
      'balance', (select w.balance from public.coin_wallets w where w.user_id = uid));
  end if;

  select * into s from public.fishing_species sp where sp.id = c.species_id;
  select coalesce(sum(xe.amount), 0) into day_xp from public.arcade_xp_events xe
  where xe.user_id = uid and xe.created_at >= date_trunc('day', now());
  reward_xp := least(s.reward_xp, greatest(0, 600 - day_xp));

  insert into public.coin_wallets (user_id, balance) values (uid, 0) on conflict (user_id) do nothing;
  update public.coin_wallets w set balance = w.balance + s.reward_coins, updated_at = now() where w.user_id = uid
  returning w.balance into wallet_balance;
  insert into public.coin_ledger (user_id, delta, reason, ref_id) values (uid, s.reward_coins, 'fishing_catch', c.id);
  insert into public.arcade_xp_events (user_id, round_id, game_id, amount, fishing_cast_id) values (uid, null, 'leonida_fishing', reward_xp, c.id);
  if reward_xp > 0 then update public.profiles p set xp = p.xp + reward_xp where p.id = uid; end if;

  -- Köder: nur ein erfolgreicher Fang verbraucht eine Nutzung
  if c.bait_inventory_id is not null then
    update public.fishing_bait_inventory i set uses_left = i.uses_left - 1
    where i.id = c.bait_inventory_id and i.uses_left > 0 returning i.uses_left into uses;
    if coalesce(uses, 0) = 0 and not exists (select 1 from public.fishing_bait_inventory i where i.user_id = uid and i.bait_id = c.bait_id and i.uses_left > 0) then
      update public.fishing_state fs set selected_bait_id = null, updated_at = now() where fs.user_id = uid and fs.selected_bait_id = c.bait_id;
    end if;
  end if;

  if s.rarity = 'legendary' then
    insert into public.arcade_scores (user_id, game_id, high_score, achieved_at)
    values (uid, 'leonida_fishing', 1 + (select count(*) from public.fishing_casts x where x.user_id = uid and x.status = 'caught' and x.species_id = s.id), now())
    on conflict (user_id, game_id) do update set high_score = excluded.high_score, achieved_at = excluded.achieved_at;
  end if;

  update public.fishing_casts fc set status = 'caught', outcome = 'caught', resolved_at = clock_timestamp(),
    coins_awarded = s.reward_coins, xp_awarded = reward_xp, bait_uses_left = coalesce(uses, fc.bait_uses_left)
  where fc.id = c.id returning * into c;
  return public.fishing_cast_json(c) || jsonb_build_object('already_processed', false, 'balance', wallet_balance);
end;
$$;

revoke execute on function public.my_fishing_state(), public.buy_fishing_bait(text, uuid), public.select_fishing_bait(text),
  public.start_fishing_cast(uuid), public.reel_fishing_cast(uuid, boolean), public.fishing_odds(text),
  public.fishing_pick_species(text, double precision) from public;
grant execute on function public.my_fishing_state(), public.fishing_odds(text) to anon, authenticated;
grant execute on function public.buy_fishing_bait(text, uuid), public.select_fishing_bait(text),
  public.start_fishing_cast(uuid), public.reel_fishing_cast(uuid, boolean) to authenticated;

select '027 erfolgreich – Leonida Fishing v2: 5 Fische, Köder, 15 Würfe/Tag (Europe/Berlin), serverseitige Fänge' as ergebnis;
