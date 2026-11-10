-- 013_arcade_coins_spot_unlock.sql — Arcade, Coins, XP, Highscores und 150-Coin-Fundortfreischaltung
-- ENTWURF: manuell in Lovable/Supabase ausführen. Voraussetzung: 001/003/004 (und 012 optional).
-- Rein additiv: keine bestehenden Tabellen oder Nutzerdaten werden gelöscht.

------------------------------------------------------------------------------------------------
-- Arcade-Konfiguration und Wallet
------------------------------------------------------------------------------------------------
create table if not exists public.arcade_games (
  id text primary key check (id ~ '^[a-z_]{3,32}$'),
  display_name text not null,
  max_duration_seconds integer not null check (max_duration_seconds between 10 and 300),
  max_score integer not null check (max_score > 0),
  score_per_second integer not null check (score_per_second > 0),
  max_coins integer not null check (max_coins between 0 and 100),
  max_xp integer not null check (max_xp between 0 and 100),
  enabled boolean not null default true
);
insert into public.arcade_games (id, display_name, max_duration_seconds, max_score, score_per_second, max_coins, max_xp) values
  ('neon_highway', 'Neon Highway', 60, 6000, 240, 40, 20),
  ('leonida_fishing', 'Leonida Fishing', 60, 2000, 100, 35, 18)
on conflict (id) do update set display_name = excluded.display_name, max_duration_seconds = excluded.max_duration_seconds,
  max_score = excluded.max_score, score_per_second = excluded.score_per_second, max_coins = excluded.max_coins,
  max_xp = excluded.max_xp, enabled = excluded.enabled;

create table if not exists public.coin_wallets (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  balance integer not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);
create table if not exists public.coin_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  delta integer not null check (delta <> 0),
  reason text not null,
  ref_id uuid,
  created_at timestamptz not null default now(),
  arcade_round_id uuid,
  unique (user_id, reason, ref_id),
  unique (arcade_round_id)
);
create index if not exists coin_ledger_user_day_idx on public.coin_ledger (user_id, created_at);

------------------------------------------------------------------------------------------------
-- Runden, idempotente Belohnungen und persönliche Highscores
------------------------------------------------------------------------------------------------
create table if not exists public.arcade_rounds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  game_id text not null references public.arcade_games(id),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  client_duration_ms integer,
  score integer,
  coins_awarded integer not null default 0,
  xp_awarded integer not null default 0,
  status text not null default 'started' check (status in ('started', 'completed', 'rejected')),
  seed text not null default encode(gen_random_bytes(16), 'hex')
);
create index if not exists arcade_rounds_user_game_idx on public.arcade_rounds (user_id, game_id, started_at desc);
create table if not exists public.arcade_xp_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  round_id uuid not null unique references public.arcade_rounds(id) on delete cascade,
  game_id text not null references public.arcade_games(id),
  amount integer not null check (amount >= 0),
  created_at timestamptz not null default now()
);
create index if not exists arcade_xp_events_user_game_idx on public.arcade_xp_events (user_id, game_id);
create table if not exists public.arcade_scores (
  user_id uuid not null references public.profiles(id) on delete cascade,
  game_id text not null references public.arcade_games(id),
  high_score integer not null check (high_score >= 0),
  achieved_at timestamptz not null default now(),
  primary key (user_id, game_id)
);

alter table public.arcade_games enable row level security;
alter table public.coin_wallets enable row level security;
alter table public.coin_ledger enable row level security;
alter table public.arcade_rounds enable row level security;
alter table public.arcade_xp_events enable row level security;
alter table public.arcade_scores enable row level security;
revoke all on public.arcade_games, public.coin_wallets, public.coin_ledger, public.arcade_rounds, public.arcade_xp_events, public.arcade_scores from anon, authenticated;
grant select on public.arcade_games to anon, authenticated;

create or replace function public.start_arcade_round(_game text) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare uid uuid := auth.uid(); g public.arcade_games; r public.arcade_rounds;
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into g from public.arcade_games where id = lower(_game) and enabled;
  if not found then raise exception 'GAME_UNAVAILABLE'; end if;
  insert into public.arcade_rounds (user_id, game_id) values (uid, g.id) returning * into r;
  return jsonb_build_object('round_id', r.id, 'seed', r.seed, 'started_at', r.started_at,
    'max_duration_seconds', g.max_duration_seconds, 'max_score', g.max_score);
end $$;

-- Bewertet nur einmal; Coins/XP werden in derselben Transaktion wie Score und Ledger verbucht.
-- Schutz: serverseitige Laufzeit, Spiel-Maximum, Score-pro-Sekunde, tägliches Limit und Round-ID.
create or replace function public.finish_arcade_round(_round uuid, _score integer, _duration_ms integer) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare uid uuid := auth.uid(); r public.arcade_rounds; g public.arcade_games;
  server_ms integer; safe_score integer; coins integer; reward_xp integer; day_coins integer; day_xp integer; previous_score integer; is_new boolean;
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into r from public.arcade_rounds where id = _round and user_id = uid for update;
  if not found then raise exception 'ROUND_NOT_FOUND'; end if;
  if r.status = 'completed' then
    return jsonb_build_object('round_id', r.id, 'score', r.score, 'coins', r.coins_awarded, 'xp', r.xp_awarded, 'already_processed', true);
  end if;
  if r.status <> 'started' then raise exception 'ROUND_CLOSED'; end if;
  select * into g from public.arcade_games where id = r.game_id and enabled;
  server_ms := greatest(0, extract(epoch from (now() - r.started_at))::integer * 1000);
  if _duration_ms is null or _duration_ms < 250 or _duration_ms > (g.max_duration_seconds * 1000 + 10000)
     or server_ms < 150 or server_ms > (g.max_duration_seconds * 1000 + 30000) then
    update public.arcade_rounds set status = 'rejected', finished_at = now(), client_duration_ms = _duration_ms, score = greatest(0, _score) where id = r.id;
    raise exception 'ROUND_DURATION_INVALID';
  end if;
  if _score is null or _score < 0 or _score > g.max_score
     or _score > floor((server_ms::numeric / 1000) * g.score_per_second) + 120 then
    update public.arcade_rounds set status = 'rejected', finished_at = now(), client_duration_ms = _duration_ms, score = greatest(0, coalesce(_score, 0)) where id = r.id;
    raise exception 'ROUND_SCORE_INVALID';
  end if;
  safe_score := least(_score, g.max_score);
  coins := floor((safe_score::numeric / g.max_score) * g.max_coins)::integer;
  -- Tagesgrenzen: Coins und Arcade-XP sind vom Community-XP/Abzeichen-System getrennt.
  select coalesce(sum(delta), 0) into day_coins from public.coin_ledger where user_id = uid and reason = 'arcade_round' and created_at >= date_trunc('day', now());
  select coalesce(sum(amount), 0) into day_xp from public.arcade_xp_events where user_id = uid and created_at >= date_trunc('day', now());
  coins := least(coins, greatest(0, 300 - day_coins));
  reward_xp := least(floor((safe_score::numeric / g.max_score) * g.max_xp)::integer, greatest(0, 600 - day_xp));
  select high_score into previous_score from public.arcade_scores where user_id = uid and game_id = r.game_id;
  is_new := previous_score is null or safe_score > previous_score;
  insert into public.coin_wallets (user_id, balance) values (uid, 0) on conflict do nothing;
  update public.coin_wallets set balance = balance + coins, updated_at = now() where user_id = uid;
  if coins > 0 then
    insert into public.coin_ledger (user_id, delta, reason, ref_id, arcade_round_id) values (uid, coins, 'arcade_round', r.id, r.id);
  end if;
  insert into public.arcade_xp_events (user_id, round_id, game_id, amount) values (uid, r.id, r.game_id, reward_xp);
  update public.profiles set xp = xp + reward_xp where id = uid;
  insert into public.arcade_scores (user_id, game_id, high_score) values (uid, r.game_id, safe_score)
    on conflict (user_id, game_id) do update set high_score = greatest(public.arcade_scores.high_score, excluded.high_score),
      achieved_at = case when excluded.high_score > public.arcade_scores.high_score then now() else public.arcade_scores.achieved_at end;
  update public.arcade_rounds set finished_at = now(), client_duration_ms = _duration_ms, score = safe_score,
    coins_awarded = coins, xp_awarded = reward_xp, status = 'completed' where id = r.id;
  return jsonb_build_object('round_id', r.id, 'score', safe_score, 'coins', coins, 'xp', reward_xp,
    'new_high_score', is_new);
end $$;

create or replace function public.my_coin_balance() returns integer
language sql stable security definer set search_path = public
as $$ select coalesce((select balance from public.coin_wallets where user_id = auth.uid()), 0) $$;

create or replace function public.arcade_leaderboard(_game text)
returns table(rank bigint, user_id uuid, username text, score integer)
language sql stable security definer set search_path = public
as $$
  select row_number() over (order by s.high_score desc, s.achieved_at asc), s.user_id, p.username, s.high_score
  from public.arcade_scores s join public.profiles p on p.id = s.user_id
  where s.game_id = lower(_game)
  order by s.high_score desc, s.achieved_at asc limit 5
$$;

create or replace function public.my_arcade_stats(_game text)
returns table(high_score integer, rank bigint, xp_earned bigint)
language sql stable security definer set search_path = public
as $$
  with me as (select high_score from public.arcade_scores where user_id = auth.uid() and game_id = lower(_game)),
  r as (select case when exists (select 1 from me) then (1 + count(*))::bigint else null::bigint end as rank
    from public.arcade_scores s where s.game_id = lower(_game) and s.high_score > coalesce((select high_score from me), -1))
  select (select high_score from me), r.rank, coalesce((select sum(amount) from public.arcade_xp_events where user_id = auth.uid() and game_id = lower(_game)), 0)::bigint from r
$$;

revoke execute on function public.start_arcade_round(text), public.finish_arcade_round(uuid, integer, integer), public.my_coin_balance(), public.arcade_leaderboard(text), public.my_arcade_stats(text) from public, anon;
grant execute on function public.start_arcade_round(text), public.finish_arcade_round(uuid, integer, integer), public.my_coin_balance(), public.arcade_leaderboard(text), public.my_arcade_stats(text) to authenticated;

------------------------------------------------------------------------------------------------
-- Fundort-Aufdeckung: erste zehn unterschiedliche Fundorte kostenlos, danach exakt 150 Coins
------------------------------------------------------------------------------------------------
alter table public.profiles add column if not exists premium_until timestamptz;
create table if not exists public.spot_unlocks (
  user_id uuid not null references public.profiles(id) on delete cascade,
  spot_id uuid not null references public.spots(id) on delete cascade,
  cost integer not null check (cost in (0, 150)),
  unlocked_at timestamptz not null default now(),
  primary key (user_id, spot_id)
);
alter table public.spot_unlocks enable row level security;
revoke all on public.spot_unlocks from anon, authenticated;
drop policy if exists "own spot unlocks read" on public.spot_unlocks;
create policy "own spot unlocks read" on public.spot_unlocks for select to authenticated using (auth.uid() = user_id);
grant select on public.spot_unlocks to authenticated;

create or replace function public.my_spot_access(_spot uuid) returns boolean
language sql stable security definer set search_path = public
as $$
  select public.has_role(auth.uid(), 'admin') or exists (select 1 from public.spot_unlocks where user_id = auth.uid() and spot_id = _spot)
$$;

create or replace function public.unlock_spot(_spot uuid)
returns table(unlocked boolean, cost integer, balance integer, free_unlock_number integer)
language plpgsql security definer set search_path = public
as $$
declare uid uuid := auth.uid(); n integer; charge integer; b integer; is_premium boolean;
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if not exists (select 1 from public.spots where id = _spot and status in ('approved', 'hidden')) then raise exception 'SPOT_NOT_FOUND'; end if;
  if exists (select 1 from public.spot_unlocks where user_id = uid and spot_id = _spot) or public.has_role(uid, 'admin') then
    select coalesce(balance, 0) into b from public.coin_wallets where user_id = uid;
    return query select true, 0, coalesce(b, 0), null::integer; return;
  end if;
  select count(*)::integer into n from public.spot_unlocks where user_id = uid;
  select coalesce(premium_until > now(), false) into is_premium from public.profiles where id = uid;
  charge := case when n < 10 or is_premium then 0 else 150 end;
  insert into public.coin_wallets (user_id, balance) values (uid, 0) on conflict do nothing;
  select balance into b from public.coin_wallets where user_id = uid for update;
  if b < charge then raise exception 'INSUFFICIENT_COINS'; end if;
  if charge > 0 then
    update public.coin_wallets set balance = balance - charge, updated_at = now() where user_id = uid;
    insert into public.coin_ledger (user_id, delta, reason, ref_id) values (uid, -charge, 'spot_unlock', _spot);
  end if;
  insert into public.spot_unlocks (user_id, spot_id, cost) values (uid, _spot, charge);
  return query select true, charge, b - charge, case when charge = 0 then n + 1 else null end;
end $$;
revoke execute on function public.my_spot_access(uuid), public.unlock_spot(uuid) from public, anon;
grant execute on function public.my_spot_access(uuid), public.unlock_spot(uuid) to authenticated;

select '013 erfolgreich vorbereitet' as ergebnis,
  (select count(*) from public.arcade_games) as aktive_spiele,
  exists (select 1 from pg_proc where proname = 'unlock_spot') as fundort_rpc,
  exists (select 1 from pg_proc where proname = 'finish_arcade_round') as arcade_rpc;
