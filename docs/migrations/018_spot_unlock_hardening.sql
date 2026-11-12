-- 018_spot_unlock_hardening.sql
-- Dauerhafte Fundort-Freischaltung: atomar, idempotent und mit serverseitiger Preisermittlung.
-- Voraussetzung: 013_arcade_coins_spot_unlock.sql. Diese Datei in Lovable/Supabase ausführen.
-- Keine Nutzerdaten werden gelöscht oder korrigiert.

alter table public.profiles add column if not exists premium_until timestamptz;

create or replace function public.unlock_spot(_spot uuid)
returns table(unlocked boolean, cost integer, balance integer, free_unlock_number integer)
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := auth.uid();
  wallet_balance integer;
  unlocked_count integer;
  charge integer;
  is_premium boolean;
  is_admin boolean;
  already_unlocked boolean;
  inserted_cost integer;
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if not exists (select 1 from public.spots as s where s.id = _spot and s.status in ('approved', 'hidden')) then
    raise exception 'SPOT_NOT_FOUND';
  end if;

  -- Alle Aufrufe desselben Benutzers werden über genau eine Wallet-Zeile serialisiert.
  insert into public.coin_wallets (user_id, balance) values (uid, 0) on conflict (user_id) do nothing;
  select w.balance into wallet_balance
  from public.coin_wallets as w where w.user_id = uid for update;

  select exists (
    select 1 from public.spot_unlocks as su where su.user_id = uid and su.spot_id = _spot
  ) into already_unlocked;
  select public.has_role(uid, 'admin') into is_admin;

  -- Bereits freigeschaltet und Admins bleiben kostenlos; es wird niemals doppelt abgebucht.
  if already_unlocked or is_admin then
    return query select true, 0, wallet_balance, null::integer;
    return;
  end if;

  select count(*)::integer into unlocked_count
  from public.spot_unlocks as su where su.user_id = uid;
  select coalesce(p.premium_until > now(), false) into is_premium
  from public.profiles as p where p.id = uid;
  charge := case when unlocked_count < 10 or is_premium then 0 else 150 end;

  if wallet_balance < charge then raise exception 'INSUFFICIENT_COINS'; end if;

  -- Erst die eindeutige Freischaltung anlegen, danach im selben DB-Transaktionsrahmen abbuchen.
  -- Jeder Fehler rollt beides zurück; ein Netzfehler kann keine Teilabbuchung hinterlassen.
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
returns table(unlocked boolean, unlocked_count integer, free_remaining integer, cost integer, balance integer)
language plpgsql security definer stable
set search_path = public, pg_temp
as $$
declare
  uid uuid := auth.uid();
  n integer;
  b integer;
  already boolean;
  privileged boolean;
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select count(*)::integer into n from public.spot_unlocks as su where su.user_id = uid;
  select exists (select 1 from public.spot_unlocks as su where su.user_id = uid and su.spot_id = _spot) into already;
  select coalesce(w.balance, 0) into b from public.coin_wallets as w where w.user_id = uid;
  select public.has_role(uid, 'admin') or exists (
    select 1 from public.profiles as p where p.id = uid and p.premium_until > now()
  ) into privileged;
  return query select already or privileged, n, greatest(0, 10 - n),
    case when already or privileged or n < 10 then 0 else 150 end, coalesce(b, 0);
end;
$$;

revoke execute on function public.unlock_spot(uuid), public.my_spot_unlock_preview(uuid) from public, anon;
grant execute on function public.unlock_spot(uuid), public.my_spot_unlock_preview(uuid) to authenticated;
grant select on public.spot_unlocks to authenticated;

select '018 erfolgreich vorbereitet – Fundort-Freischaltung atomar/idempotent' as ergebnis;
