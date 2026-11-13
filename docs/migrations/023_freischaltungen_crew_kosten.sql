-- 023_freischaltungen_und_crew_kosten.sql
-- Fundort-Freischaltung: erste 5 fremde Fundorte pro Nutzer kostenlos, danach 500 Coins.
-- Crew-Erstellung: immer 500 Coins; Beitreten/Anfragen bleiben kostenlos.
--
-- Voraussetzung: 013_arcade_coins_spot_unlock.sql, 018_spot_unlock_hardening.sql,
-- 019_coin_balance_unlimited.sql und 022_eigene_fundorte_freigeschaltet.sql.
-- Diese Migration in Lovable/Supabase ausführen. Sie ändert keine bestehenden Guthaben
-- und erstattet keine bereits bezahlten Freischaltungen.

------------------------------------------------------------------------------------------------
-- 1. Fundorte: 5 statt 10 kostenlose fremde Fundorte, danach 500 Coins.
--    Eigene approved/hidden Fundorte bleiben nach SQL 022 kostenlos offen und zählen nicht.
------------------------------------------------------------------------------------------------
-- Bereits bezahlte alte Freischaltungen mit 150 bleiben gültig; neue Freischaltungen dürfen 500 speichern.
alter table public.spot_unlocks drop constraint if exists spot_unlocks_cost_check;
alter table public.spot_unlocks add constraint spot_unlocks_cost_check check (cost in (0, 150, 500));

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
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  if not exists (
    select 1 from public.spots as s
    where s.id = _spot and s.status in ('approved', 'hidden')
  ) then raise exception 'SPOT_NOT_FOUND'; end if;

  select s.author_id = uid into is_owner from public.spots as s where s.id = _spot;
  select public.has_role(uid, 'admin') into is_admin;

  -- Eigene Fundorte und Admin-Zugriff bleiben kostenlos offen.
  if is_owner or is_admin then
    select coalesce(w.balance, 0) into wallet_balance
    from public.coin_wallets as w where w.user_id = uid;
    return query select true, 0, coalesce(wallet_balance, 0), null::integer;
    return;
  end if;

  -- Wallet-Sperre serialisiert parallele Freischaltungen desselben Nutzers.
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

  -- Nur fremde, noch zuordenbare Fundorte zählen; eigene bleiben außerhalb des Zählers.
  select count(*)::integer into unlocked_count
  from public.spot_unlocks as su
  join public.spots as s on s.id = su.spot_id
  where su.user_id = uid and s.author_id is distinct from uid;
  select coalesce(p.premium_until > now(), false) into is_premium
  from public.profiles as p where p.id = uid;

  charge := case when unlocked_count < 5 or is_premium then 0 else 500 end;
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
    case when owner or already or privileged or n < 5 then 0 else 500 end,
    coalesce(b, 0);
end;
$$;

------------------------------------------------------------------------------------------------
-- 2. Crew-Erstellung: atomar 500 Coins abbuchen. Beitreten bleibt kostenlos.
------------------------------------------------------------------------------------------------
drop function if exists public.create_crew(text, text, text, boolean, integer, integer, text, text, timestamptz);
create function public.create_crew(
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
  crew_cost constant integer := 500;
begin
  perform public.crew_validate(_activity, _platform, _language, _max, _external, _start_mode, st);
  if _external + 1 >= _max then raise exception 'CREW_INVALID_SIZE'; end if;
  if (select count(*) from public.crews where leader_id = uid and status = 'open' and expires_at > now()) >= 3 then
    raise exception 'CREW_LIMIT';
  end if;
  perform public.hit_rate_limit('crew_create', 6, interval '1 hour');

  -- Guthaben sperren, prüfen und erst nach erfolgreicher Crew-Anlage abbuchen.
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

select '023 erfolgreich – 5 kostenlose Fundorte, danach 500 Coins; Crew-Erstellung 500 Coins, Beitritt kostenlos' as ergebnis;
