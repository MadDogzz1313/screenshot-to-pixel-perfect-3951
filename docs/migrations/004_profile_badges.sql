-- 004_profile_badges.sql — Spielerprofile, Privatsphäre, 18 Abzeichen, Likes, Aktivität, Korrekturen,
-- Genauigkeit, Monatswertung, Spenden.  ENTWURF – über Lovable ausführen. Idempotent (mehrfach ausführbar).
-- Enthält die noch nicht angewendeten Entwürfe 002 und 003 (Teil A + B). Keine neue Datenbank, keine Demo-Daten.
-- Zeitzone für Tage/Monate: Europe/Berlin.

------------------------------------------------------------------------------------------------
-- TEIL A (= 002): Rolle "user" bei Registrierung, Rollen & XP nicht manipulierbar
------------------------------------------------------------------------------------------------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare base text; candidate text; i int := 0;
begin
  base := regexp_replace(coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)), '[^A-Za-z0-9_]', '', 'g');
  if char_length(base) < 3 then base := 'spieler' || base; end if;
  base := left(base, 18);
  candidate := base;
  while exists (select 1 from public.profiles where username = candidate) loop
    i := i + 1; candidate := base || i::text;
  end loop;
  insert into public.profiles (id, username, xp) values (new.id, candidate, 0); -- ohne Bild = Standardavatar
  insert into public.user_roles (user_id, role) values (new.id, 'user') on conflict (user_id, role) do nothing;
  return new;
end $$;

insert into public.user_roles (user_id, role) select id, 'user'::public.app_role from public.profiles on conflict (user_id, role) do nothing;
revoke insert, update, delete, truncate on public.user_roles from anon, authenticated;
revoke all on public.user_roles from anon;
grant select on public.user_roles to authenticated;
revoke execute on function public.grant_xp(uuid, text, uuid, integer) from public, anon, authenticated;

------------------------------------------------------------------------------------------------
-- TEIL B (= 003): genau 50 XP pro erster Freigabe, Foto-Speicher
------------------------------------------------------------------------------------------------
alter table public.spots add column if not exists approved_at timestamptz;
alter table public.spots add column if not exists accuracy_verified_at timestamptz;
alter table public.spots add column if not exists accuracy_verified_by uuid references public.profiles(id) on delete set null;

-- Zeitpunkt der ERSTEN Freigabe (Grundlage der Monatswertung), wird nie überschrieben
create or replace function public.spots_set_approved_at() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'approved' and new.approved_at is null then new.approved_at := now(); end if;
  if tg_op = 'UPDATE' and old.approved_at is not null then new.approved_at := old.approved_at; end if;
  return new;
end $$;
drop trigger if exists spots_approved_at on public.spots;
create trigger spots_approved_at before insert or update on public.spots for each row execute function public.spots_set_approved_at();

update public.spots s set approved_at = coalesce(
  (select min(e.created_at) from public.xp_events e where e.reason = 'spot_approved' and e.ref_id = s.id), s.created_at)
where s.approved_at is null and s.status in ('approved', 'hidden');

create or replace function public.on_spot_status() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'approved' and old.status is distinct from 'approved' then
    perform public.grant_xp(new.author_id, 'spot_approved', new.id, 50);
    update public.spot_photos set status = 'confirmed' where spot_id = new.id and uploader_id = new.author_id and status = 'pending';
  elsif new.status = 'rejected' and old.status is distinct from 'rejected' then
    update public.spot_photos set status = 'rejected' where spot_id = new.id and status = 'pending';
  end if;
  perform public.check_badges(new.author_id);
  return new;
end $$;

create or replace function public.on_photo_status() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'confirmed' and old.status is distinct from 'confirmed'
     and not exists (select 1 from public.spots s where s.id = new.spot_id and s.author_id = new.uploader_id) then
    perform public.grant_xp(new.uploader_id, 'photo_approved', new.id, 25);
  end if;
  perform public.check_badges(new.uploader_id);
  return new;
end $$;

revoke delete, truncate on public.spots, public.spot_photos from anon, authenticated;
revoke insert, update on public.spots, public.spot_photos from anon;

------------------------------------------------------------------------------------------------
-- TEIL C: Storage – Fundort-Fotos (öffentlich) + Profilbilder (privat, Zugriff nach Privatsphäre)
------------------------------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('spot-photos', 'spot-photos', true, 8000000, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 2000000, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Profilspalten vor der Storage-Funktion anlegen: can_view_avatar() verwendet sie bereits.
alter table public.profiles add column if not exists is_private boolean not null default false;
alter table public.profiles add column if not exists show_avatar boolean not null default true;
alter table public.profiles add column if not exists show_join_date boolean not null default true;
alter table public.profiles add column if not exists show_badges boolean not null default true;
alter table public.profiles add column if not exists featured_badges text[] not null default '{}';
do $$ begin
  alter table public.profiles add constraint featured_badges_max3 check (cardinality(featured_badges) <= 3);
exception when duplicate_object then null; end $$;

-- Profilbild sichtbar? Besitzer, Admin oder (öffentliches Profil UND Bild freigegeben)
create or replace function public.can_view_avatar(_folder text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p where p.id::text = _folder
    and (p.id = auth.uid() or public.has_role(auth.uid(), 'admin') or (not p.is_private and p.show_avatar)))
$$;

drop policy if exists "spot photos public read" on storage.objects;
create policy "spot photos public read" on storage.objects for select using (bucket_id = 'spot-photos');
drop policy if exists "avatars read by privacy" on storage.objects;
create policy "avatars read by privacy" on storage.objects for select using (bucket_id = 'avatars' and public.can_view_avatar((storage.foldername(name))[1]));
drop policy if exists "upload own folder" on storage.objects;
create policy "upload own folder" on storage.objects for insert to authenticated
  with check (bucket_id in ('spot-photos', 'avatars') and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "update own files" on storage.objects;
create policy "update own files" on storage.objects for update to authenticated
  using (bucket_id in ('spot-photos', 'avatars') and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "delete own files" on storage.objects;
create policy "delete own files" on storage.objects for delete to authenticated
  using (bucket_id in ('spot-photos', 'avatars') and (storage.foldername(name))[1] = auth.uid()::text);

------------------------------------------------------------------------------------------------
-- TEIL D: Profile – Privatsphäre, Lieblingsabzeichen; private Daten nur über geschützte Ansicht
------------------------------------------------------------------------------------------------
-- Die benötigten Profilspalten wurden vor can_view_avatar() angelegt.
-- avatar_url enthält ab jetzt den Speicherpfad im Bucket "avatars" (<user-id>/<datei>.jpg); alte Fremd-URLs entfernen
update public.profiles set avatar_url = null where avatar_url is not null and avatar_url not like id::text || '/%';

-- Bearbeitbare Spalten (XP, Datum, ID bleiben gesperrt). Die Lese-Sperre für fremde Profildaten folgt in 004b,
-- erst wenn die neue App überall veröffentlicht ist (alte App-Versionen lesen Profile noch direkt).
revoke insert, update, delete, truncate on public.profiles from anon, authenticated;
grant update (username, avatar_url, bio, is_private, show_avatar, show_join_date, show_badges, featured_badges) on public.profiles to authenticated;

create or replace function public.profiles_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.avatar_url is not null and new.avatar_url not like new.id::text || '/%' then
    raise exception 'Ungültiges Profilbild';
  end if;
  if new.featured_badges is distinct from old.featured_badges then
    if cardinality(new.featured_badges) <> (select count(distinct b) from unnest(new.featured_badges) b)
       or exists (select 1 from unnest(new.featured_badges) b
                  where not exists (select 1 from public.user_badges ub where ub.user_id = new.id and ub.badge_id = b)) then
      raise exception 'Nur eigene freigeschaltete Abzeichen können hervorgehoben werden';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard before update on public.profiles for each row execute function public.profiles_guard();

-- Geschützte Profil-Ansicht: blendet private Angaben für Fremde aus. E-Mail ist nie enthalten.
create or replace view public.profile_cards with (security_invoker = false) as
select p.id, p.username,
  (p.id = auth.uid() or public.has_role(auth.uid(), 'admin')) as full_access,
  p.is_private,
  case when p.id = auth.uid() or public.has_role(auth.uid(), 'admin') or (not p.is_private and p.show_avatar) then p.avatar_url end as avatar_path,
  case when p.id = auth.uid() or public.has_role(auth.uid(), 'admin') or not p.is_private then p.bio end as bio,
  case when p.id = auth.uid() or public.has_role(auth.uid(), 'admin') or not p.is_private then p.xp end as xp,
  case when p.id = auth.uid() or public.has_role(auth.uid(), 'admin') or (not p.is_private and p.show_join_date) then p.created_at end as joined_at,
  case when p.id = auth.uid() or public.has_role(auth.uid(), 'admin') or (not p.is_private and p.show_badges) then p.featured_badges end as featured_badges,
  case when p.id = auth.uid() or public.has_role(auth.uid(), 'admin') then p.show_avatar end as show_avatar,
  case when p.id = auth.uid() or public.has_role(auth.uid(), 'admin') then p.show_join_date end as show_join_date,
  case when p.id = auth.uid() or public.has_role(auth.uid(), 'admin') then p.show_badges end as show_badges
from public.profiles p;
grant select on public.profile_cards to anon, authenticated;

------------------------------------------------------------------------------------------------
-- TEIL E: Abzeichen-Katalog + vergebene Abzeichen (nur Datenbank-Funktionen dürfen vergeben)
------------------------------------------------------------------------------------------------
create table if not exists public.badges (
  id text primary key,
  kind text not null check (kind in ('community', 'donation')),
  name text not null,
  requirement text not null,
  threshold integer not null,        -- Community: Zielwert; Spenden: Mindestsumme in Cent
  sort smallint not null
);
insert into public.badges (id, kind, name, requirement, threshold, sort) values
  ('first_find',      'community', 'Erster Fund',        '1 bestätigter Fundort', 1, 1),
  ('explorer',        'community', 'Entdecker',          '10 bestätigte Fundorte', 10, 2),
  ('legend',          'community', 'Leonida-Legende',    '100 bestätigte Fundorte', 100, 3),
  ('car_freak',       'community', 'Autofreak',          '10 bestätigte Fahrzeug-Fundorte', 10, 4),
  ('treasure_hunter', 'community', 'Schatzjäger',        '25 bestätigte Sammelobjekte', 25, 5),
  ('photographer',    'community', 'Fotograf',           '20 bestätigte Fundort-Fotos', 20, 6),
  ('community_star',  'community', 'Community-Star',     '100 Likes anderer Spieler auf bestätigte Beiträge', 100, 7),
  ('active',          'community', 'Aktiv dabei',        '7 aufeinanderfolgende aktive Tage', 7, 8),
  ('precision',       'community', 'Präzisionsfinder',   '20 vom Admin als korrekt bestätigte Fundorte', 20, 9),
  ('helping_hand',    'community', 'Helfende Hand',      '10 vom Admin bestätigte Korrekturen', 10, 10),
  ('veteran',         'community', 'Veteran',            '6 Monate seit Registrierung', 6, 11),
  ('top_explorer',    'community', 'Top-Entdecker',      'Platz 1–10 einer abgeschlossenen Monatswertung', 10, 12),
  ('supporter',       'donation',  'Supporter',          'Bestätigte Spenden ab 1 €', 100, 13),
  ('bronze',          'donation',  'Bronze Supporter',   'Bestätigte Spenden ab 5 €', 500, 14),
  ('silver',          'donation',  'Silver Supporter',   'Bestätigte Spenden ab 15 €', 1500, 15),
  ('gold',            'donation',  'Gold Supporter',     'Bestätigte Spenden ab 30 €', 3000, 16),
  ('diamond',         'donation',  'Diamond Supporter',  'Bestätigte Spenden ab 50 €', 5000, 17),
  ('founder',         'donation',  'Leonida Founder',    'Bestätigte Spenden ab 100 €', 10000, 18)
on conflict (id) do update set kind = excluded.kind, name = excluded.name, requirement = excluded.requirement,
  threshold = excluded.threshold, sort = excluded.sort;

create table if not exists public.user_badges (
  user_id uuid not null references public.profiles(id) on delete cascade,
  badge_id text not null references public.badges(id) on delete cascade,
  awarded_at timestamptz not null default now(),
  awarded_by uuid references public.profiles(id) on delete set null,   -- nur bei Spenden: prüfender Admin
  primary key (user_id, badge_id)                                       -- nie doppelt
);
alter table public.badges enable row level security;
alter table public.user_badges enable row level security;
revoke all on public.badges, public.user_badges from anon, authenticated;
grant select on public.badges, public.user_badges to anon, authenticated;
drop policy if exists "badges readable" on public.badges;
create policy "badges readable" on public.badges for select using (true);
drop policy if exists "user badges visible by privacy" on public.user_badges;
create policy "user badges visible by privacy" on public.user_badges for select using (
  auth.uid() = user_id or public.has_role(auth.uid(), 'admin')
  or exists (select 1 from public.profiles p where p.id = user_id and not p.is_private and p.show_badges));

create or replace function public.award_badge(_u uuid, _badge text, _by uuid default null) returns void
language sql security definer set search_path = public as $$
  insert into public.user_badges (user_id, badge_id, awarded_by) values (_u, _badge, _by) on conflict do nothing
$$;

------------------------------------------------------------------------------------------------
-- TEIL F: Aktive Tage (serverseitig, Datum vom Server – nicht fälschbar)
------------------------------------------------------------------------------------------------
create table if not exists public.user_activity_days (
  user_id uuid not null references public.profiles(id) on delete cascade,
  day date not null,
  primary key (user_id, day)
);
alter table public.user_activity_days enable row level security;
revoke all on public.user_activity_days from anon, authenticated;
grant select on public.user_activity_days to authenticated;
drop policy if exists "own activity read" on public.user_activity_days;
create policy "own activity read" on public.user_activity_days for select to authenticated using (auth.uid() = user_id);

------------------------------------------------------------------------------------------------
-- TEIL G: Monatswertung (bestätigte Fundorte nach Datum der ersten Freigabe, Zeitzone Europe/Berlin)
-- Platzierung: 1. mehr Fundorte, 2. bei Gleichstand wer die Zahl zuerst erreicht hat, 3. Name (A–Z).
------------------------------------------------------------------------------------------------
create table if not exists public.monthly_rankings (
  month date not null,               -- erster Tag des Monats
  user_id uuid not null references public.profiles(id) on delete cascade,
  rank integer not null,
  approved_count integer not null,
  computed_at timestamptz not null default now(),
  primary key (month, user_id)
);
alter table public.monthly_rankings enable row level security;
revoke all on public.monthly_rankings from anon, authenticated;
grant select on public.monthly_rankings to anon, authenticated;
drop policy if exists "rankings readable" on public.monthly_rankings;
create policy "rankings readable" on public.monthly_rankings for select using (true);

-- Live-/Endstand eines Monats (öffentlich: Name + Anzahl bestätigter Fundorte sind ohnehin öffentlich)
create or replace function public.monthly_leaderboard(_month date default null)
returns table (rank bigint, user_id uuid, username text, approved_count bigint, reached_at timestamptz, period_start date, period_end date, final boolean)
language sql stable security definer set search_path = public as $$
  with m as (select date_trunc('month', coalesce(_month, (now() at time zone 'Europe/Berlin')::date))::date as s),
  b as (select s, (s + interval '1 month')::date as e from m),
  agg as (
    select sp.author_id, count(*) as n, max(sp.approved_at) as reached
    from public.spots sp, b
    where sp.approved_at is not null and sp.status in ('approved', 'hidden')
      and (sp.approved_at at time zone 'Europe/Berlin') >= b.s and (sp.approved_at at time zone 'Europe/Berlin') < b.e
    group by sp.author_id)
  select row_number() over (order by a.n desc, a.reached asc, p.username asc), a.author_id, p.username, a.n, a.reached,
         b.s, (b.e - 1), (now() at time zone 'Europe/Berlin')::date >= b.e
  from agg a join public.profiles p on p.id = a.author_id, b
  order by 1
$$;

-- Schreibt den Endstand eines abgeschlossenen Monats fest und vergibt "Top-Entdecker" an Platz 1–10
create or replace function public.compute_monthly_ranking(_month date) returns void
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  if (now() at time zone 'Europe/Berlin')::date < (date_trunc('month', _month) + interval '1 month')::date then return; end if;
  if exists (select 1 from public.monthly_rankings where month = date_trunc('month', _month)::date) then return; end if;
  for r in select * from public.monthly_leaderboard(_month) loop
    insert into public.monthly_rankings (month, user_id, rank, approved_count) values (r.period_start, r.user_id, r.rank, r.approved_count)
    on conflict do nothing;
    if r.rank <= 10 then perform public.award_badge(r.user_id, 'top_explorer'); end if;
  end loop;
end $$;

-- Alle abgeschlossenen Monate seit der ersten Freigabe nachtragen (wird bei App-Aktivität aufgerufen, kein Cronjob nötig)
create or replace function public.finalize_monthly_rankings() returns void
language plpgsql security definer set search_path = public as $$
declare m date; last_closed date := (date_trunc('month', (now() at time zone 'Europe/Berlin')::date) - interval '1 month')::date;
begin
  select date_trunc('month', min(approved_at at time zone 'Europe/Berlin'))::date into m from public.spots where approved_at is not null;
  while m is not null and m <= last_closed loop
    perform public.compute_monthly_ranking(m);
    m := (m + interval '1 month')::date;
  end loop;
end $$;

------------------------------------------------------------------------------------------------
-- TEIL H: Fortschritt & automatische Freischaltung aller 12 Community-Abzeichen
------------------------------------------------------------------------------------------------
create or replace function public.badge_metrics(_u uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare res jsonb;
begin
  select jsonb_build_object(
    'spots',       (select count(*) from public.spots where author_id = _u and status = 'approved'),
    'vehicles',    (select count(*) from public.spots where author_id = _u and status = 'approved' and category = 'vehicle'),
    'collects',    (select count(*) from public.spots where author_id = _u and status = 'approved' and category = 'collect'),
    'photos',      (select count(*) from public.spot_photos where uploader_id = _u and status = 'confirmed'),
    'likes',       (select count(*) from public.spot_likes l join public.spots s on s.id = l.spot_id
                    where s.author_id = _u and s.status = 'approved' and l.user_id <> _u),
    'streak',      (select coalesce(max(n), 0) from (select count(*) as n from (
                      select day - (row_number() over (order by day))::int as grp from public.user_activity_days where user_id = _u) t group by grp) q),
    'accurate',    (select count(*) from public.spots where author_id = _u and status = 'approved' and accuracy_verified_at is not null),
    'corrections', (select count(*) from public.spot_corrections where user_id = _u and status = 'confirmed'),
    'months',      (select coalesce((extract(year from age(now(), u.created_at)) * 12 + extract(month from age(now(), u.created_at)))::int, 0)
                    from auth.users u where u.id = _u),
    'best_rank',   (select min(rank) from public.monthly_rankings where user_id = _u)
  ) into res;
  return res;
end $$;

create or replace function public.check_badges(_u uuid) returns void
language plpgsql security definer set search_path = public as $$
declare m jsonb;
begin
  if _u is null then return; end if;
  m := public.badge_metrics(_u);
  if (m->>'spots')::int       >= 1   then perform public.award_badge(_u, 'first_find'); end if;
  if (m->>'spots')::int       >= 10  then perform public.award_badge(_u, 'explorer'); end if;
  if (m->>'spots')::int       >= 100 then perform public.award_badge(_u, 'legend'); end if;
  if (m->>'vehicles')::int    >= 10  then perform public.award_badge(_u, 'car_freak'); end if;
  if (m->>'collects')::int    >= 25  then perform public.award_badge(_u, 'treasure_hunter'); end if;
  if (m->>'photos')::int      >= 20  then perform public.award_badge(_u, 'photographer'); end if;
  if (m->>'likes')::int       >= 100 then perform public.award_badge(_u, 'community_star'); end if;
  if (m->>'streak')::int      >= 7   then perform public.award_badge(_u, 'active'); end if;
  if (m->>'accurate')::int    >= 20  then perform public.award_badge(_u, 'precision'); end if;
  if (m->>'corrections')::int >= 10  then perform public.award_badge(_u, 'helping_hand'); end if;
  if (m->>'months')::int      >= 6   then perform public.award_badge(_u, 'veteran'); end if;
  if coalesce((m->>'best_rank')::int, 99) <= 10 then perform public.award_badge(_u, 'top_explorer'); end if;
end $$;

-- Eigener Fortschritt (nur für den angemeldeten Nutzer selbst)
create or replace function public.my_badge_progress() returns jsonb
language sql stable security definer set search_path = public as $$ select public.badge_metrics(auth.uid()) $$;

-- Beim Öffnen der App: aktiven Tag speichern, Monatswertung nachtragen, Abzeichen prüfen
create or replace function public.touch_activity() returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  insert into public.user_activity_days (user_id, day) values (auth.uid(), (now() at time zone 'Europe/Berlin')::date) on conflict do nothing;
  perform public.finalize_monthly_rankings();
  perform public.check_badges(auth.uid());
end $$;

------------------------------------------------------------------------------------------------
-- TEIL I: Likes, Korrekturen, Genauigkeit -> Abzeichen
------------------------------------------------------------------------------------------------
create or replace function public.on_like_badges() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.check_badges((select author_id from public.spots where id = new.spot_id));
  return null;
end $$;
drop trigger if exists spot_likes_badges on public.spot_likes;
create trigger spot_likes_badges after insert on public.spot_likes for each row execute function public.on_like_badges();

create or replace function public.on_correction_status() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'confirmed' and old.status is distinct from 'confirmed' then
    perform public.grant_xp(new.user_id, 'correction_confirmed', new.id, 40);   -- bestehende XP-Regel unverändert
  end if;
  perform public.check_badges(new.user_id);
  return new;
end $$;

-- Admin bestätigt (oder entzieht) die Genauigkeit eines freigegebenen Fundorts
create or replace function public.set_spot_accuracy(_spot uuid, _verified boolean) returns void
language plpgsql security definer set search_path = public as $$
declare a uuid;
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'Nur Admins'; end if;
  update public.spots set accuracy_verified_at = case when _verified then coalesce(accuracy_verified_at, now()) end,
                          accuracy_verified_by = case when _verified then auth.uid() end
  where id = _spot and status = 'approved' returning author_id into a;
  if a is null then raise exception 'Fundort nicht gefunden oder nicht freigegeben'; end if;
  perform public.check_badges(a);
end $$;

------------------------------------------------------------------------------------------------
-- TEIL J: Spenden (privat, nur Admins erfassen; keine XP, keine Rechte)
------------------------------------------------------------------------------------------------
create table if not exists public.donations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount_cents integer not null check (amount_cents > 0 and amount_cents <= 10000000),
  note text check (char_length(note) <= 200),
  verified_by uuid not null default auth.uid() references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.donations enable row level security;
revoke all on public.donations from anon, authenticated;
grant select, insert, delete on public.donations to authenticated;
drop policy if exists "donations own or admin read" on public.donations;
create policy "donations own or admin read" on public.donations for select to authenticated using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));
drop policy if exists "donations admin insert" on public.donations;
create policy "donations admin insert" on public.donations for insert to authenticated with check (public.has_role(auth.uid(), 'admin') and verified_by = auth.uid());
drop policy if exists "donations admin delete" on public.donations;
create policy "donations admin delete" on public.donations for delete to authenticated using (public.has_role(auth.uid(), 'admin'));

-- Spendenstufen anhand der GESAMTEN bestätigten Summe (bei Korrektur durch Admin auch wieder entfernen)
create or replace function public.sync_donation_badges() returns trigger
language plpgsql security definer set search_path = public as $$
declare u uuid := coalesce(new.user_id, old.user_id); total int; b record;
begin
  select coalesce(sum(amount_cents), 0) into total from public.donations where user_id = u;
  for b in select id, threshold from public.badges where kind = 'donation' loop
    if total >= b.threshold then perform public.award_badge(u, b.id, auth.uid());
    else
      delete from public.user_badges where user_id = u and badge_id = b.id;
      update public.profiles set featured_badges = array_remove(featured_badges, b.id) where id = u;
    end if;
  end loop;
  return null;
end $$;
drop trigger if exists donations_badges on public.donations;
create trigger donations_badges after insert or delete on public.donations for each row execute function public.sync_donation_badges();

------------------------------------------------------------------------------------------------
-- TEIL L: Zeitbedingungen ohne Nutzeraktion (Veteran, Monatswertung) – tägliche automatische Prüfung
------------------------------------------------------------------------------------------------
create table if not exists public.job_runs (name text primary key, last_run timestamptz not null);
alter table public.job_runs enable row level security;
revoke all on public.job_runs from anon, authenticated;

-- Prüft ALLE Profile (nur intern / Zeitplan)
create or replace function public.check_all_badges() returns void
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  perform public.finalize_monthly_rankings();
  for r in select id from public.profiles loop perform public.check_badges(r.id); end loop;
  insert into public.job_runs (name, last_run) values ('badges', now()) on conflict (name) do update set last_run = now();
end $$;

-- Öffentlich aufrufbar (z. B. beim Öffnen der App), aber höchstens 1× pro Stunde wirksam; vergibt nur tatsächlich Erreichtes
create or replace function public.run_badge_maintenance() returns void
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.job_runs where name = 'badges' and last_run > now() - interval '1 hour') then return; end if;
  perform public.check_all_badges();
end $$;

-- Täglicher Zeitplan in der Datenbank (03:15 UTC), falls pg_cron verfügbar ist
do $$ begin
  create extension if not exists pg_cron;
  perform cron.unschedule(jobid) from cron.job where jobname = 'leonida-badges-daily';
  perform cron.schedule('leonida-badges-daily', '15 3 * * *', 'select public.check_all_badges()');
  raise notice 'Täglicher Abzeichen-Zeitplan aktiv';
exception when others then
  raise notice 'pg_cron nicht verfügbar (%): Prüfung läuft beim App-Start über run_badge_maintenance()', sqlerrm;
end $$;

------------------------------------------------------------------------------------------------
-- TEIL K: Rechte der Funktionen + vorhandene echte Daten nachberechnen
------------------------------------------------------------------------------------------------
revoke execute on function public.award_badge(uuid, text, uuid), public.check_badges(uuid), public.badge_metrics(uuid),
  public.compute_monthly_ranking(date), public.finalize_monthly_rankings(), public.check_all_badges() from public, anon, authenticated;
grant execute on function public.run_badge_maintenance() to anon, authenticated;
grant execute on function public.my_badge_progress(), public.touch_activity(), public.set_spot_accuracy(uuid, boolean) to authenticated;
grant execute on function public.monthly_leaderboard(date) to anon, authenticated;

-- Bestehende Leistungen nachträglich berücksichtigen (alle Profile, alle abgeschlossenen Monate)
select public.check_all_badges();
