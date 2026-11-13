-- 035_admin_spielerverwaltung.sql
-- Admin-Spielerverwaltung: Spieler suchen (Name/E-Mail), Detailansicht, Leonida Coins und Bonus-Angelversuche gutschreiben,
-- lückenloses Protokoll „Admin-Gutschriften“ und kurze Meldung beim Spieler.
-- Bonus-Angelversuche liegen getrennt vom Tageslimit (15/Tag), verfallen nicht um Mitternacht und werden erst
-- verbraucht, wenn die 15 täglichen Versuche aufgebraucht sind.
-- Voraussetzung: 008 (require_admin), 013 + 019 (Coins), 027 (Leonida Fishing v2). Mehrfach ausführbar.
-- Bestehende Guthaben, Fänge, Köder, XP und Level werden NICHT verändert.

do $$ begin
  if to_regprocedure('public.require_admin()') is null then raise exception 'Bitte zuerst SQL 008 ausführen (require_admin fehlt).'; end if;
  if to_regclass('public.coin_wallets') is null or to_regclass('public.coin_ledger') is null then raise exception 'Bitte zuerst SQL 013 und 019 ausführen (Coins fehlen).'; end if;
  if to_regclass('public.fishing_casts') is null or to_regclass('public.fishing_state') is null then raise exception 'Bitte zuerst SQL 027 ausführen (Leonida Fishing fehlt).'; end if;
end $$;

------------------------------------------------------------------------------------------------
-- 1. Bonus-Angelversuche (dauerhaft, getrennt vom Tageslimit)
------------------------------------------------------------------------------------------------
alter table public.fishing_state add column if not exists bonus_casts bigint not null default 0;
alter table public.fishing_state add column if not exists bonus_granted_total bigint not null default 0;
alter table public.fishing_state drop constraint if exists fishing_state_bonus_casts_nonneg;
alter table public.fishing_state add constraint fishing_state_bonus_casts_nonneg check (bonus_casts >= 0 and bonus_granted_total >= 0);
-- Markiert Würfe, die einen Bonusversuch verbraucht haben (zählen nicht zum Tageslimit)
alter table public.fishing_casts add column if not exists used_bonus boolean not null default false;

------------------------------------------------------------------------------------------------
-- 2. Protokoll „Admin-Gutschriften“ (nur über Admin-Funktionen lesbar, nie änderbar)
------------------------------------------------------------------------------------------------
create table if not exists public.admin_grants (
  id uuid primary key default gen_random_uuid(),
  request_key uuid not null unique,               -- verhindert doppelte Gutschriften (Doppeltipp / Netzwerk-Wiederholung)
  admin_id uuid references public.profiles(id) on delete set null,
  admin_name text,
  target_user_id uuid not null references public.profiles(id) on delete cascade,
  target_name text,
  kind text not null check (kind in ('coins', 'fishing_casts')),
  amount bigint not null check (amount > 0),
  reason text check (reason is null or char_length(reason) <= 200),
  balance_after bigint,
  created_at timestamptz not null default now()
);
create index if not exists admin_grants_created_idx on public.admin_grants (created_at desc);
create index if not exists admin_grants_target_idx on public.admin_grants (target_user_id, created_at desc);
alter table public.admin_grants enable row level security;
revoke all on public.admin_grants from anon, authenticated;

-- Meldung für den Spieler („Du hast 500 Coins erhalten – Event-Gewinn“). Nur eigene Zeilen lesbar, Realtime-fähig.
create table if not exists public.admin_grant_notices (
  grant_id uuid primary key references public.admin_grants(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null,
  amount bigint not null,
  reason text,
  created_at timestamptz not null default now(),
  seen_at timestamptz
);
create index if not exists admin_grant_notices_unseen_idx on public.admin_grant_notices (user_id) where seen_at is null;
alter table public.admin_grant_notices enable row level security;
drop policy if exists admin_grant_notices_own on public.admin_grant_notices;
create policy admin_grant_notices_own on public.admin_grant_notices for select to authenticated using (user_id = auth.uid());
revoke insert, update, delete on public.admin_grant_notices from anon, authenticated;
revoke all on public.admin_grant_notices from anon;
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'admin_grant_notices') then
    alter publication supabase_realtime add table public.admin_grant_notices;
  end if;
end $$;

------------------------------------------------------------------------------------------------
-- 3. Admin: Spieler suchen und Detailansicht
------------------------------------------------------------------------------------------------
create or replace function public.admin_player_list(_q text default '')
returns table (id uuid, username text, email text, avatar_path text, xp integer, coins bigint, is_admin boolean, created_at timestamptz)
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare pattern text := '%' || replace(replace(replace(coalesce(btrim(_q), ''), '\', '\\'), '%', '\%'), '_', '\_') || '%';
begin
  perform public.require_admin();
  return query
  select p.id, p.username, u.email::text, p.avatar_url, coalesce(p.xp, 0)::integer, coalesce(w.balance, 0)::bigint,
    public.has_role(p.id, 'admin'), p.created_at
  from public.profiles p
  left join auth.users u on u.id = p.id
  left join public.coin_wallets w on w.user_id = p.id
  where coalesce(btrim(_q), '') = '' or p.username ilike pattern or u.email ilike pattern
  order by p.username asc nulls last, p.created_at asc
  limit 200;
end $$;

create or replace function public.admin_player_detail(_user uuid)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  today date := public.fishing_berlin_day(now());
  p public.profiles; st public.fishing_state; used_regular bigint; used_bonus bigint;
begin
  perform public.require_admin();
  select * into p from public.profiles pr where pr.id = _user;
  if not found then raise exception 'USER_NOT_FOUND'; end if;
  select * into st from public.fishing_state s where s.user_id = _user;
  select count(*) filter (where not c.used_bonus), count(*) filter (where c.used_bonus) into used_regular, used_bonus
  from public.fishing_casts c where c.user_id = _user and c.berlin_day = today;
  return jsonb_build_object(
    'id', p.id, 'username', p.username, 'email', (select u.email from auth.users u where u.id = p.id),
    'avatar_path', p.avatar_url, 'xp', coalesce(p.xp, 0), 'created_at', p.created_at,
    'is_admin', public.has_role(p.id, 'admin'),
    'coins', coalesce((select w.balance from public.coin_wallets w where w.user_id = p.id), 0),
    'daily_limit', 15,
    'casts_used_today', used_regular + used_bonus,
    'daily_used', used_regular,
    'daily_left', greatest(0, 15 - used_regular),
    'bonus_used_today', used_bonus,
    'bonus_casts', coalesce(st.bonus_casts, 0),
    'bonus_granted_total', coalesce(st.bonus_granted_total, 0));
end $$;

------------------------------------------------------------------------------------------------
-- 4. Admin: Gutschriften (atomar, idempotent per request_key, protokolliert)
------------------------------------------------------------------------------------------------
create or replace function public.admin_grant_coins(_user uuid, _amount bigint, _reason text default null, _request_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  aid uuid := public.require_admin();
  g public.admin_grants; tname text; new_balance bigint; clean text := nullif(left(btrim(coalesce(_reason, '')), 200), '');
begin
  if _request_key is null then raise exception 'NONCE_REQUIRED'; end if;
  if _amount is null or _amount <= 0 then raise exception 'AMOUNT_INVALID'; end if;
  perform pg_advisory_xact_lock(hashtextextended(_request_key::text, 35));
  select * into g from public.admin_grants ag where ag.request_key = _request_key;
  if found then
    if g.kind <> 'coins' or g.target_user_id <> _user or g.amount <> _amount then raise exception 'REQUEST_KEY_REUSED'; end if;
    return jsonb_build_object('grant_id', g.id, 'already_processed', true, 'amount', g.amount,
      'balance', (select w.balance from public.coin_wallets w where w.user_id = _user));
  end if;
  select pr.username into tname from public.profiles pr where pr.id = _user;
  if not found then raise exception 'USER_NOT_FOUND'; end if;

  insert into public.coin_wallets (user_id, balance) values (_user, 0) on conflict (user_id) do nothing;
  perform 1 from public.coin_wallets w where w.user_id = _user for update;
  insert into public.admin_grants (request_key, admin_id, admin_name, target_user_id, target_name, kind, amount, reason)
  values (_request_key, aid, (select pr.username from public.profiles pr where pr.id = aid), _user, tname, 'coins', _amount, clean)
  returning * into g;
  update public.coin_wallets w set balance = w.balance + _amount, updated_at = now() where w.user_id = _user
  returning w.balance into new_balance;
  insert into public.coin_ledger (user_id, delta, reason, ref_id) values (_user, _amount, 'admin_grant', g.id);
  update public.admin_grants ag set balance_after = new_balance where ag.id = g.id;
  insert into public.admin_grant_notices (grant_id, user_id, kind, amount, reason) values (g.id, _user, 'coins', _amount, clean);
  return jsonb_build_object('grant_id', g.id, 'already_processed', false, 'amount', _amount, 'balance', new_balance);
end $$;

create or replace function public.admin_grant_fishing_casts(_user uuid, _amount bigint, _reason text default null, _request_key uuid default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  aid uuid := public.require_admin();
  g public.admin_grants; tname text; new_bonus bigint; clean text := nullif(left(btrim(coalesce(_reason, '')), 200), '');
begin
  if _request_key is null then raise exception 'NONCE_REQUIRED'; end if;
  if _amount is null or _amount <= 0 then raise exception 'AMOUNT_INVALID'; end if;
  perform pg_advisory_xact_lock(hashtextextended(_request_key::text, 35));
  select * into g from public.admin_grants ag where ag.request_key = _request_key;
  if found then
    if g.kind <> 'fishing_casts' or g.target_user_id <> _user or g.amount <> _amount then raise exception 'REQUEST_KEY_REUSED'; end if;
    return jsonb_build_object('grant_id', g.id, 'already_processed', true, 'amount', g.amount,
      'bonus_casts', (select s.bonus_casts from public.fishing_state s where s.user_id = _user));
  end if;
  select pr.username into tname from public.profiles pr where pr.id = _user;
  if not found then raise exception 'USER_NOT_FOUND'; end if;

  insert into public.fishing_state (user_id) values (_user) on conflict (user_id) do nothing;
  perform 1 from public.fishing_state s where s.user_id = _user for update;
  insert into public.admin_grants (request_key, admin_id, admin_name, target_user_id, target_name, kind, amount, reason)
  values (_request_key, aid, (select pr.username from public.profiles pr where pr.id = aid), _user, tname, 'fishing_casts', _amount, clean)
  returning * into g;
  update public.fishing_state s set bonus_casts = s.bonus_casts + _amount, bonus_granted_total = s.bonus_granted_total + _amount, updated_at = now()
  where s.user_id = _user returning s.bonus_casts into new_bonus;
  update public.admin_grants ag set balance_after = new_bonus where ag.id = g.id;
  insert into public.admin_grant_notices (grant_id, user_id, kind, amount, reason) values (g.id, _user, 'fishing_casts', _amount, clean);
  return jsonb_build_object('grant_id', g.id, 'already_processed', false, 'amount', _amount, 'bonus_casts', new_bonus);
end $$;

create or replace function public.admin_grant_history(_user uuid default null)
returns table (id uuid, target_user_id uuid, target_name text, admin_id uuid, admin_name text, kind text, amount bigint, reason text, balance_after bigint, created_at timestamptz)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  perform public.require_admin();
  return query
  select g.id, g.target_user_id, coalesce(t.username, g.target_name), g.admin_id, coalesce(a.username, g.admin_name),
    g.kind, g.amount, g.reason, g.balance_after, g.created_at
  from public.admin_grants g
  left join public.profiles t on t.id = g.target_user_id
  left join public.profiles a on a.id = g.admin_id
  where _user is null or g.target_user_id = _user
  order by g.created_at desc limit 200;
end $$;

------------------------------------------------------------------------------------------------
-- 5. Spieler: Meldungen über erhaltene Gutschriften
------------------------------------------------------------------------------------------------
create or replace function public.my_admin_grant_notices()
returns table (id uuid, kind text, amount bigint, reason text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select n.grant_id, n.kind, n.amount, n.reason, n.created_at from public.admin_grant_notices n
  where n.user_id = auth.uid() and n.seen_at is null order by n.created_at asc limit 20
$$;

create or replace function public.mark_admin_grant_notices_seen(_ids uuid[]) returns void
language sql security definer set search_path = public as $$
  update public.admin_grant_notices set seen_at = now() where user_id = auth.uid() and grant_id = any(_ids) and seen_at is null
$$;

------------------------------------------------------------------------------------------------
-- 6. Leonida Fishing: erst 15 Tagesversuche, danach Bonusversuche (wie 027, nur Zählung erweitert)
------------------------------------------------------------------------------------------------
create or replace function public.my_fishing_state()
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  uid uuid := auth.uid();
  today date := public.fishing_berlin_day(now());
  pending public.fishing_casts; last_cast public.fishing_casts;
begin
  if uid is null then
    return jsonb_build_object('logged_in', false, 'limit', 15, 'used', 0, 'bonus_casts', 0, 'next_reset_at', public.fishing_next_reset(now()));
  end if;
  perform public.fishing_expire_pending(uid);
  select * into pending from public.fishing_casts c where c.user_id = uid and c.status = 'pending' limit 1;
  select * into last_cast from public.fishing_casts c where c.user_id = uid and c.status <> 'pending' order by c.resolved_at desc nulls last limit 1;
  return jsonb_build_object(
    'logged_in', true,
    'day', today,
    'limit', 15,
    'used', (select count(*) from public.fishing_casts c where c.user_id = uid and c.berlin_day = today and not c.used_bonus),
    'bonus_casts', coalesce((select s.bonus_casts from public.fishing_state s where s.user_id = uid), 0),
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

create or replace function public.start_fishing_cast(_nonce uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  uid uuid := public.require_active_user();
  today date := public.fishing_berlin_day(now());
  st public.fishing_state; c public.fishing_casts; inv public.fishing_bait_inventory;
  used integer; r double precision; use_bonus boolean := false; bonus_left bigint;
begin
  if _nonce is null then raise exception 'NONCE_REQUIRED'; end if;
  insert into public.fishing_state (user_id) values (uid) on conflict (user_id) do nothing;
  select * into st from public.fishing_state s where s.user_id = uid for update; -- Würfe je Nutzer strikt nacheinander
  select count(*) into used from public.fishing_casts fc where fc.user_id = uid and fc.berlin_day = today and not fc.used_bonus;

  select * into c from public.fishing_casts fc where fc.user_id = uid and fc.client_nonce = _nonce;
  if found then return public.fishing_cast_json(c) || jsonb_build_object('resumed', true, 'used', used, 'limit', 15, 'bonus_casts', st.bonus_casts); end if;

  perform public.fishing_expire_pending(uid);
  select * into c from public.fishing_casts fc where fc.user_id = uid and fc.status = 'pending' limit 1;
  if found then return public.fishing_cast_json(c) || jsonb_build_object('resumed', true, 'used', used, 'limit', 15, 'bonus_casts', st.bonus_casts); end if;

  if used >= 15 then
    if coalesce(st.bonus_casts, 0) <= 0 then raise exception 'FISHING_DAILY_LIMIT'; end if;
    use_bonus := true;
  end if;

  if st.selected_bait_id is not null then
    select * into inv from public.fishing_bait_inventory i
    where i.user_id = uid and i.bait_id = st.selected_bait_id and i.uses_left > 0
    order by i.purchased_at limit 1 for update;
    if not found then update public.fishing_state s set selected_bait_id = null, updated_at = now() where s.user_id = uid; end if;
  end if;

  r := random();
  insert into public.fishing_casts (user_id, client_nonce, berlin_day, bait_id, bait_inventory_id, species_id, roll, bite_delay_ms, window_ms, bait_uses_left, used_bonus)
  values (uid, _nonce, today, inv.bait_id, inv.id, public.fishing_pick_species(inv.bait_id, r), r,
          1600 + floor(random() * 2600)::integer, 1500, inv.uses_left, use_bonus)
  returning * into c;
  update public.fishing_state s set bonus_casts = s.bonus_casts - (case when use_bonus then 1 else 0 end), updated_at = now()
  where s.user_id = uid returning s.bonus_casts into bonus_left;
  return public.fishing_cast_json(c) || jsonb_build_object('resumed', false, 'used', used + (case when use_bonus then 0 else 1 end),
    'limit', 15, 'used_bonus', use_bonus, 'bonus_casts', bonus_left);
end;
$$;

------------------------------------------------------------------------------------------------
-- 7. Rechte: alles nur über diese Funktionen; Admin-Funktionen prüfen has_role serverseitig
------------------------------------------------------------------------------------------------
revoke execute on function public.admin_player_list(text), public.admin_player_detail(uuid),
  public.admin_grant_coins(uuid, bigint, text, uuid), public.admin_grant_fishing_casts(uuid, bigint, text, uuid),
  public.admin_grant_history(uuid), public.my_admin_grant_notices(), public.mark_admin_grant_notices_seen(uuid[]),
  public.my_fishing_state(), public.start_fishing_cast(uuid) from public, anon;
grant execute on function public.admin_player_list(text), public.admin_player_detail(uuid),
  public.admin_grant_coins(uuid, bigint, text, uuid), public.admin_grant_fishing_casts(uuid, bigint, text, uuid),
  public.admin_grant_history(uuid), public.my_admin_grant_notices(), public.mark_admin_grant_notices_seen(uuid[]),
  public.start_fishing_cast(uuid), public.my_fishing_state() to authenticated;
grant execute on function public.my_fishing_state() to anon;

select '035 erfolgreich – Admin-Spielerverwaltung: Coins + Bonus-Angelversuche gutschreiben, Admin-Gutschriften-Protokoll' as ergebnis;
