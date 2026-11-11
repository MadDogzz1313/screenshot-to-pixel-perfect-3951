-- 015_spot_unlock_fix.sql
-- Fundort-Freischaltung: atomar, idempotent und unabhängig von den Arcade-Spiel-RPCs.
-- Diese Migration muss im Lovable/Supabase SQL-Editor ausgeführt werden.
-- Voraussetzung: 013_arcade_coins_spot_unlock.sql.
-- Korrektur: Spalten sind jetzt eindeutig benannt (vorher Fehler "column reference balance is ambiguous").

alter table public.profiles add column if not exists premium_until timestamptz;

create or replace function public.unlock_spot(_spot uuid)
returns table(unlocked boolean, cost integer, balance integer, free_unlock_number integer)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  uid uuid := auth.uid();
  n integer;
  charge integer;
  b integer;
  is_premium boolean;
  inserted_cost integer;
begin
  if uid is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if not exists (
    select 1 from public.spots
    where id = _spot and status in ('approved', 'hidden')
  ) then
    raise exception 'SPOT_NOT_FOUND';
  end if;

  -- Eine vorhandene Freischaltung ist immer kostenlos und wird nicht erneut gezählt.
  if exists (select 1 from public.spot_unlocks su where su.user_id = uid and su.spot_id = _spot) then
    select coalesce(w.balance, 0) into b
    from public.coin_wallets w where w.user_id = uid;
    return query select true, 0, coalesce(b, 0), null::integer;
    return;
  end if;

  -- Die Wallet-Zeile serialisiert parallele Klicks desselben Benutzers.
  insert into public.coin_wallets (user_id, balance)
  values (uid, 0)
  on conflict (user_id) do nothing;

  select w.balance into b
  from public.coin_wallets w
  where w.user_id = uid
  for update;

  -- Nach dem Lock erneut prüfen: ein paralleler Aufruf kann inzwischen freigeschaltet haben.
  if exists (select 1 from public.spot_unlocks su where su.user_id = uid and su.spot_id = _spot) then
    return query select true, 0, coalesce(b, 0), null::integer;
    return;
  end if;

  select count(*)::integer into n
  from public.spot_unlocks su
  where su.user_id = uid;

  select coalesce(p.premium_until > now(), false) into is_premium
  from public.profiles p
  where p.id = uid;

  charge := case when n < 10 or is_premium then 0 else 150 end;

  if b < charge then
    raise exception 'INSUFFICIENT_COINS'
      using detail = format('Benötigt: %s Coins; vorhanden: %s Coins', charge, b);
  end if;

  if charge > 0 then
    update public.coin_wallets w
    set balance = w.balance - charge, updated_at = now()
    where w.user_id = uid;

    insert into public.coin_ledger (user_id, delta, reason, ref_id)
    values (uid, -charge, 'spot_unlock', _spot);
  end if;

  -- Die Primärschlüssel- und Wallet-Sperren verhindern doppelte Freischaltungen und Abbuchungen.
  insert into public.spot_unlocks (user_id, spot_id, cost)
  values (uid, _spot, charge)
  on conflict (user_id, spot_id) do nothing
  returning spot_unlocks.cost into inserted_cost;

  if inserted_cost is null then
    select w.balance into b from public.coin_wallets w where w.user_id = uid;
    return query select true, 0, coalesce(b, 0), null::integer;
    return;
  end if;

  return query select true, inserted_cost, b - inserted_cost,
    case when inserted_cost = 0 then n + 1 else null end;
end;
$$;

revoke execute on function public.unlock_spot(uuid) from public, anon;
grant execute on function public.unlock_spot(uuid) to authenticated;

select '015 erfolgreich – Fundort-Freischaltung repariert' as ergebnis;
