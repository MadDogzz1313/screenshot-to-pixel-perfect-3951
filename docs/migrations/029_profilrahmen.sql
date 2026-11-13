-- 029_profilrahmen.sql
-- Animierte Profilrahmen im Neoshop: Katalog, Käufe, aktiver Rahmen.
-- Voraussetzung: 008 (require_active_user, hit_rate_limit), 013/019 (coin_wallets, coin_ledger).
-- In Lovable → SQL-Editor komplett einfügen und ausführen. Mehrfach ausführbar.
-- Bestehende Shop-Artikel, Preise und Käufe werden nicht verändert.

create table if not exists public.profile_frames (
  id text primary key check (id ~ '^[a-z_]{3,32}$'),
  name text not null,
  price integer not null check (price >= 0),
  premium boolean not null default false,
  sort integer not null default 0,
  active boolean not null default true
);
insert into public.profile_frames (id, name, price, premium, sort) values
  ('neon_sunset',     'Neon Sunset',     500,  false, 1),
  ('golden_crown',    'Golden Crown',    1000, true,  2),
  ('neon_skyline',    'Neon Skyline',    500,  false, 3),
  ('cyber_lightning', 'Cyber Lightning', 500,  false, 4),
  ('neon_coast',      'Neon Coast',      500,  false, 5)
on conflict (id) do update set name = excluded.name, price = excluded.price, premium = excluded.premium, sort = excluded.sort, active = true;
alter table public.profile_frames enable row level security;
drop policy if exists profile_frames_read on public.profile_frames;
create policy profile_frames_read on public.profile_frames for select to anon, authenticated using (active);
revoke insert, update, delete on public.profile_frames from anon, authenticated;

-- Käufe (mit Kaufzeitpunkt), nur für den Besitzer lesbar
create table if not exists public.user_profile_frames (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  frame_id text not null references public.profile_frames(id),
  price_paid integer not null check (price_paid >= 0),
  purchased_at timestamptz not null default now(),
  unique (user_id, frame_id)
);
alter table public.user_profile_frames enable row level security;
drop policy if exists user_profile_frames_own on public.user_profile_frames;
create policy user_profile_frames_own on public.user_profile_frames for select to authenticated using (user_id = auth.uid());
revoke insert, update, delete on public.user_profile_frames from anon, authenticated;

-- Aktiver Rahmen: öffentlich lesbar (rein kosmetisch, wird auf öffentlichen Profilen angezeigt)
create table if not exists public.profile_frame_loadouts (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  frame_id text references public.profile_frames(id),
  updated_at timestamptz not null default now()
);
alter table public.profile_frame_loadouts enable row level security;
drop policy if exists profile_frame_loadouts_read on public.profile_frame_loadouts;
create policy profile_frame_loadouts_read on public.profile_frame_loadouts for select to anon, authenticated using (true);
revoke insert, update, delete on public.profile_frame_loadouts from anon, authenticated;

drop function if exists public.my_profile_frames();
create function public.my_profile_frames()
returns table(id text, name text, price integer, premium boolean, sort integer, owned boolean, equipped boolean, purchased_at timestamptz)
language sql stable security definer set search_path = public as $$
  select f.id, f.name, f.price, f.premium, f.sort,
    u.id is not null, f.id is not distinct from (select l.frame_id from public.profile_frame_loadouts l where l.user_id = auth.uid()),
    u.purchased_at
  from public.profile_frames f
  left join public.user_profile_frames u on u.frame_id = f.id and u.user_id = auth.uid()
  where f.active
  order by f.sort, f.id
$$;
revoke execute on function public.my_profile_frames() from public;
grant execute on function public.my_profile_frames() to anon, authenticated;

-- Kauf: Preis kommt nur aus der Tabelle; Wallet gesperrt; Besitz unique → nie doppelt berechnet
drop function if exists public.buy_profile_frame(text);
create function public.buy_profile_frame(_frame text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  uid uuid := public.require_active_user();
  f public.profile_frames; wallet_balance bigint; owned_id uuid;
begin
  select * into f from public.profile_frames pf where pf.id = _frame and pf.active;
  if not found then raise exception 'FRAME_NOT_FOUND'; end if;
  insert into public.coin_wallets (user_id, balance) values (uid, 0) on conflict (user_id) do nothing;
  select w.balance into wallet_balance from public.coin_wallets w where w.user_id = uid for update;
  select u.id into owned_id from public.user_profile_frames u where u.user_id = uid and u.frame_id = f.id;
  if owned_id is not null then
    return jsonb_build_object('frame_id', f.id, 'charged', 0, 'balance', wallet_balance, 'already_owned', true);
  end if;
  perform public.hit_rate_limit('profile_frame_buy', 30, interval '10 minutes');
  if wallet_balance < f.price then raise exception 'INSUFFICIENT_COINS'; end if;
  insert into public.user_profile_frames (user_id, frame_id, price_paid) values (uid, f.id, f.price) returning id into owned_id;
  update public.coin_wallets w set balance = w.balance - f.price, updated_at = now() where w.user_id = uid returning w.balance into wallet_balance;
  insert into public.coin_ledger (user_id, delta, reason, ref_id) values (uid, -f.price, 'profile_frame', owned_id);
  return jsonb_build_object('frame_id', f.id, 'charged', f.price, 'balance', wallet_balance, 'already_owned', false);
end;
$$;
revoke execute on function public.buy_profile_frame(text) from public, anon;
grant execute on function public.buy_profile_frame(text) to authenticated;

-- Ausrüsten: nur gekaufte Rahmen; null = „Kein Rahmen“
drop function if exists public.equip_profile_frame(text);
create function public.equip_profile_frame(_frame text)
returns text language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid := public.require_active_user();
begin
  if _frame is not null and not exists (select 1 from public.user_profile_frames u join public.profile_frames f on f.id = u.frame_id and f.active
                                        where u.user_id = uid and u.frame_id = _frame) then
    raise exception 'FRAME_LOCKED';
  end if;
  insert into public.profile_frame_loadouts (user_id, frame_id, updated_at) values (uid, _frame, now())
  on conflict (user_id) do update set frame_id = excluded.frame_id, updated_at = now();
  return _frame;
end;
$$;
revoke execute on function public.equip_profile_frame(text) from public, anon;
grant execute on function public.equip_profile_frame(text) to authenticated;

select '029 erfolgreich – 5 animierte Profilrahmen (4 × 500, Golden Crown 1.000 Coins)' as ergebnis;
