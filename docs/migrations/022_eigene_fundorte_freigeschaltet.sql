-- 022_eigene_fundorte_freigeschaltet.sql
-- Eigene freigegebene Fundorte bleiben kostenlos offen und erzeugen kein Unlock-Fenster.
-- Sie zählen außerdem NICHT in den Zähler der zehn kostenlosen fremden Fundorte.
--
-- Voraussetzung: 013_arcade_coins_spot_unlock.sql und 018_spot_unlock_hardening.sql.
-- Diese Migration in Lovable/Supabase ausführen. Sie ändert weder den Einreichungs- noch
-- den Moderationsablauf. Die Sicherheitsregeln bleiben serverseitig in den RPCs.

------------------------------------------------------------------------------------------------
-- 1. Zugriff: nur freigegebene Fundorte sind öffentlich freischaltbar.
--    Der Ersteller eines freigegebenen Fundorts hat automatisch kostenlosen Zugriff.
------------------------------------------------------------------------------------------------
create or replace function public.my_spot_access(_spot uuid) returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select public.has_role(auth.uid(), 'admin')
    or exists (
      select 1
      from public.spots as s
      where s.id = _spot
        and s.status in ('approved', 'hidden')
        and (
          s.author_id = auth.uid()
          or exists (
            select 1 from public.spot_unlocks as su
            where su.user_id = auth.uid() and su.spot_id = s.id
          )
        )
    )
$$;

------------------------------------------------------------------------------------------------
-- 2. Atomarer Unlock: eigener freigegebener Fundort = kostenlos offen.
--    Der eigene Fundort wird absichtlich NICHT in spot_unlocks eingetragen, damit er
--    weder den kostenlosen Zehnerzähler erhöht noch ein Unlock-Fenster erzeugt.
------------------------------------------------------------------------------------------------
drop function if exists public.unlock_spot(uuid);
create function public.unlock_spot(_spot uuid)
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
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if not exists (
    select 1 from public.spots as s
    where s.id = _spot and s.status in ('approved', 'hidden')
  ) then
    raise exception 'SPOT_NOT_FOUND';
  end if;

  select s.author_id = uid into is_owner
  from public.spots as s where s.id = _spot;
  select public.has_role(uid, 'admin') into is_admin;

  -- Eigene freigegebene Fundorte sind kostenlos offen. Kein Wallet-Lock,
  -- kein Ledger-Eintrag und kein Unlock-Fenster für den Ersteller.
  if is_owner or is_admin then
    select coalesce(w.balance, 0) into wallet_balance
    from public.coin_wallets as w where w.user_id = uid;
    return query select true, 0, coalesce(wallet_balance, 0), null::integer;
    return;
  end if;

  -- Alle fremden Unlocks desselben Benutzers werden über die Wallet-Zeile serialisiert.
  insert into public.coin_wallets (user_id, balance) values (uid, 0) on conflict (user_id) do nothing;
  select w.balance into wallet_balance
  from public.coin_wallets as w where w.user_id = uid for update;

  select exists (
    select 1 from public.spot_unlocks as su where su.user_id = uid and su.spot_id = _spot
  ) into already_unlocked;
  if already_unlocked then
    return query select true, 0, wallet_balance, null::integer;
    return;
  end if;

  -- Eigene Fundorte zählen nicht: nur Unlocks fremder, noch zuordenbarer Fundorte.
  select count(*)::integer into unlocked_count
  from public.spot_unlocks as su
  join public.spots as s on s.id = su.spot_id
  where su.user_id = uid and s.author_id is distinct from uid;
  select coalesce(p.premium_until > now(), false) into is_premium
  from public.profiles as p where p.id = uid;
  charge := case when unlocked_count < 10 or is_premium then 0 else 150 end;

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

------------------------------------------------------------------------------------------------
-- 3. Vorschau: eigener freigegebener Fundort meldet sofort unlocked=true/cost=0.
--    Für ausstehende/abgelehnte Fundorte gibt es keine öffentlich nutzbare Vorschau.
------------------------------------------------------------------------------------------------
drop function if exists public.my_spot_unlock_preview(uuid);
create function public.my_spot_unlock_preview(_spot uuid)
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
  ) then
    raise exception 'SPOT_NOT_FOUND';
  end if;

  select s.author_id = uid into owner from public.spots as s where s.id = _spot;
  select count(*)::integer into n
  from public.spot_unlocks as su
  join public.spots as s on s.id = su.spot_id
  where su.user_id = uid and s.author_id is distinct from uid;
  select exists (select 1 from public.spot_unlocks as su where su.user_id = uid and su.spot_id = _spot) into already;
  select coalesce(w.balance, 0) into b from public.coin_wallets as w where w.user_id = uid;
  select public.has_role(uid, 'admin') or exists (
    select 1 from public.profiles as p where p.id = uid and p.premium_until > now()
  ) into privileged;

  return query select owner or already or privileged, n, greatest(0, 10 - n),
    case when owner or already or privileged or n < 10 then 0 else 150 end,
    coalesce(b, 0);
end;
$$;

revoke execute on function public.my_spot_access(uuid), public.unlock_spot(uuid), public.my_spot_unlock_preview(uuid) from public, anon;
grant execute on function public.my_spot_access(uuid), public.unlock_spot(uuid), public.my_spot_unlock_preview(uuid) to authenticated;

select '022 erfolgreich eingerichtet – eigene freigegebene Fundorte kostenlos offen; nicht im Zehnerzähler' as ergebnis;
