-- 024_level_coin_rewards.sql
-- Einmalige Levelaufstiegs-Belohnung: 500 Coins je neu erreichtem Level.
-- Voraussetzung: 013_arcade_coins_spot_unlock.sql und 019_coin_balance_unlimited.sql.
-- Diese Migration in Lovable/Supabase ausführen.
-- Bereits erreichte Level werden NICHT nachträglich vergütet; nur echte zukünftige XP-Aufstiege.

------------------------------------------------------------------------------------------------
-- 1. Idempotente Belohnungsbuchungen
------------------------------------------------------------------------------------------------
create table if not exists public.level_coin_rewards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  level integer not null check (level between 2 and 100),
  coins integer not null default 500 check (coins = 500),
  awarded_at timestamptz not null default now(),
  seen_at timestamptz,
  unique (user_id, level)
);

alter table public.level_coin_rewards enable row level security;
revoke all on public.level_coin_rewards from anon, authenticated;
drop policy if exists "own level rewards read" on public.level_coin_rewards;
create policy "own level rewards read" on public.level_coin_rewards
  for select to authenticated using (auth.uid() = user_id);
grant select on public.level_coin_rewards to authenticated;

------------------------------------------------------------------------------------------------
-- 2. Dieselbe Levelmathematik wie src/lib/levels.ts, mit den bestehenden Grenzen I–C
------------------------------------------------------------------------------------------------
create or replace function public.leonida_level_from_xp(_xp integer)
returns integer
language sql immutable strict
set search_path = public, pg_temp
as $$
  select coalesce(max(level), 1)::integer
  from generate_series(1, 100) as level
  where greatest(coalesce(_xp, 0), 0) >= 25 * (level - 1) * (level - 1) + 75 * (level - 1)
$$;

------------------------------------------------------------------------------------------------
-- 3. XP-Update -> atomare Wallet-Buchung je Level
------------------------------------------------------------------------------------------------
create or replace function public.award_level_coins_on_xp()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  old_level integer;
  new_level integer;
  reached integer;
  reward_id uuid;
  wallet_balance bigint;
begin
  if new.xp is null or old.xp is null or new.xp <= old.xp then
    return new;
  end if;

  old_level := public.leonida_level_from_xp(old.xp);
  new_level := public.leonida_level_from_xp(new.xp);
  if new_level <= old_level then
    return new;
  end if;

  -- Dieselbe Wallet-Sperre wie bei Arcade/Fundort/Crews verhindert Rennen mit Ausgaben.
  insert into public.coin_wallets (user_id, balance)
  values (new.id, 0) on conflict (user_id) do nothing;
  select w.balance into wallet_balance
  from public.coin_wallets as w where w.user_id = new.id for update;

  -- Jeder INSERT ist durch (user_id, level) einmalig. Bei Retry/Parallelität
  -- wird kein zweiter Coin-Ledger-Eintrag erzeugt.
  for reached in (select generate_series(old_level + 1, new_level)) loop
    reward_id := null;
    insert into public.level_coin_rewards (user_id, level, coins)
    values (new.id, reached, 500)
    on conflict (user_id, level) do nothing
    returning id into reward_id;

    if reward_id is not null then
      update public.coin_wallets as w
      set balance = w.balance + 500, updated_at = now()
      where w.user_id = new.id;
      insert into public.coin_ledger (user_id, delta, reason, ref_id)
      values (new.id, 500, 'level_up', reward_id);
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists zz_level_coin_rewards on public.profiles;
create trigger zz_level_coin_rewards
after update of xp on public.profiles
for each row execute function public.award_level_coins_on_xp();

------------------------------------------------------------------------------------------------
-- 4. Unbestätigte Animationen lesen und nach Anzeige quittieren
------------------------------------------------------------------------------------------------
create or replace function public.my_pending_level_rewards()
returns table(reward_id uuid, level integer, coins integer, awarded_at timestamptz)
language sql stable security definer
set search_path = public, pg_temp
as $$
  select r.id, r.level, r.coins, r.awarded_at
  from public.level_coin_rewards as r
  where r.user_id = auth.uid() and r.seen_at is null
  order by r.level asc
$$;

create or replace function public.mark_level_rewards_seen()
returns integer
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare n integer;
begin
  update public.level_coin_rewards
  set seen_at = now()
  where user_id = auth.uid() and seen_at is null;
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke execute on function public.leonida_level_from_xp(integer), public.award_level_coins_on_xp() from public, anon, authenticated;
revoke execute on function public.my_pending_level_rewards(), public.mark_level_rewards_seen() from public, anon;
grant execute on function public.my_pending_level_rewards(), public.mark_level_rewards_seen() to authenticated;

select '024 erfolgreich – 500 Coins je Levelaufstieg, idempotent und serverseitig' as ergebnis;
