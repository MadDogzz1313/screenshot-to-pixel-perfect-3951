create type public.app_role as enum ('admin', 'user');
create type public.spot_status as enum ('pending', 'approved', 'rejected', 'hidden');
create type public.spot_category as enum ('vehicle', 'weapon', 'collect', 'activity', 'place', 'other');
create type public.review_status as enum ('pending', 'confirmed', 'rejected');

-- PROFILES
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null check (username ~ '^[A-Za-z0-9_]{3,24}$'),
  avatar_url text,
  bio text not null default '' check (char_length(bio) <= 200),
  xp integer not null default 0,
  created_at timestamptz not null default now()
);
grant select on public.profiles to anon, authenticated;
grant update (username, avatar_url, bio) on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "profiles readable by all" on public.profiles for select using (true);
create policy "own profile update" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- ROLES
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "own roles read" on public.user_roles for select to authenticated using (auth.uid() = user_id);

create or replace function public.has_role(_user_id uuid, _role app_role) returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.user_roles where user_id = _user_id and role = _role) $$;

-- SPOTS
create table public.spots (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 80),
  category spot_category not null,
  area text not null check (char_length(area) between 2 and 60),
  x numeric(5,2) not null check (x between 0 and 100),
  y numeric(5,2) not null check (y between 0 and 100),
  vehicle_type text check (char_length(vehicle_type) <= 60),
  hour smallint check (hour between 0 and 23),
  description text not null check (char_length(description) between 10 and 1000),
  status spot_status not null default 'pending',
  likes_count integer not null default 0,
  created_at timestamptz not null default now()
);
create index on public.spots (status);
create index on public.spots (author_id);
grant select on public.spots to anon, authenticated;
grant insert, update on public.spots to authenticated;
grant all on public.spots to service_role;
alter table public.spots enable row level security;
create policy "approved spots public" on public.spots for select using (status = 'approved');
create policy "own spots read" on public.spots for select to authenticated using (auth.uid() = author_id);
create policy "admin spots read" on public.spots for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "insert own pending spot" on public.spots for insert to authenticated with check (auth.uid() = author_id and status = 'pending' and likes_count = 0);
create policy "admin moderate spots" on public.spots for update to authenticated using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- PHOTOS
create table public.spot_photos (
  id uuid primary key default gen_random_uuid(),
  spot_id uuid not null references public.spots(id) on delete cascade,
  uploader_id uuid not null references public.profiles(id) on delete cascade,
  path text not null,
  status review_status not null default 'pending',
  created_at timestamptz not null default now()
);
create index on public.spot_photos (spot_id);
grant select on public.spot_photos to anon, authenticated;
grant insert, update on public.spot_photos to authenticated;
grant all on public.spot_photos to service_role;
alter table public.spot_photos enable row level security;
create policy "confirmed photos public" on public.spot_photos for select using (status = 'confirmed' and exists (select 1 from public.spots s where s.id = spot_id and s.status = 'approved'));
create policy "own photos read" on public.spot_photos for select to authenticated using (auth.uid() = uploader_id);
create policy "admin photos read" on public.spot_photos for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "insert own photo" on public.spot_photos for insert to authenticated
  with check (auth.uid() = uploader_id and status = 'pending' and path like auth.uid()::text || '/%'
    and exists (select 1 from public.spots s where s.id = spot_id and (s.author_id = auth.uid() or s.status = 'approved')));
create policy "admin moderate photos" on public.spot_photos for update to authenticated using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- LIKES & SAVES
create table public.spot_likes (spot_id uuid not null references public.spots(id) on delete cascade, user_id uuid not null references public.profiles(id) on delete cascade, primary key (spot_id, user_id));
create table public.spot_saves (spot_id uuid not null references public.spots(id) on delete cascade, user_id uuid not null references public.profiles(id) on delete cascade, primary key (spot_id, user_id));
grant select, insert, delete on public.spot_likes, public.spot_saves to authenticated;
grant all on public.spot_likes, public.spot_saves to service_role;
alter table public.spot_likes enable row level security;
alter table public.spot_saves enable row level security;
create policy "own likes read" on public.spot_likes for select to authenticated using (auth.uid() = user_id);
create policy "like approved" on public.spot_likes for insert to authenticated with check (auth.uid() = user_id and exists (select 1 from public.spots s where s.id = spot_id and s.status = 'approved'));
create policy "unlike own" on public.spot_likes for delete to authenticated using (auth.uid() = user_id);
create policy "own saves read" on public.spot_saves for select to authenticated using (auth.uid() = user_id);
create policy "save own" on public.spot_saves for insert to authenticated with check (auth.uid() = user_id);
create policy "unsave own" on public.spot_saves for delete to authenticated using (auth.uid() = user_id);

create or replace function public.sync_likes_count() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then update public.spots set likes_count = likes_count + 1 where id = new.spot_id;
  else update public.spots set likes_count = greatest(likes_count - 1, 0) where id = old.spot_id; end if;
  return null;
end $$;
create trigger spot_likes_count after insert or delete on public.spot_likes for each row execute function public.sync_likes_count();

-- CORRECTIONS & REPORTS
create table public.spot_corrections (
  id uuid primary key default gen_random_uuid(),
  spot_id uuid not null references public.spots(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  message text not null check (char_length(message) between 5 and 500),
  status review_status not null default 'pending',
  created_at timestamptz not null default now()
);
create table public.spot_reports (
  id uuid primary key default gen_random_uuid(),
  spot_id uuid not null references public.spots(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null check (char_length(reason) between 5 and 500),
  status review_status not null default 'pending',
  created_at timestamptz not null default now(),
  unique (spot_id, user_id)
);
grant select, insert, update on public.spot_corrections, public.spot_reports to authenticated;
grant all on public.spot_corrections, public.spot_reports to service_role;
alter table public.spot_corrections enable row level security;
alter table public.spot_reports enable row level security;
create policy "own corrections read" on public.spot_corrections for select to authenticated using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));
create policy "insert correction" on public.spot_corrections for insert to authenticated with check (auth.uid() = user_id and status = 'pending');
create policy "admin review corrections" on public.spot_corrections for update to authenticated using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
create policy "own reports read" on public.spot_reports for select to authenticated using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));
create policy "insert report" on public.spot_reports for insert to authenticated with check (auth.uid() = user_id and status = 'pending');
create policy "admin review reports" on public.spot_reports for update to authenticated using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- XP LEDGER (one row per eligible action, never twice)
create table public.xp_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null,
  ref_id uuid not null,
  amount integer not null check (amount > 0),
  created_at timestamptz not null default now(),
  unique (user_id, reason, ref_id)
);
grant select on public.xp_events to authenticated;
grant all on public.xp_events to service_role;
alter table public.xp_events enable row level security;
create policy "own xp read" on public.xp_events for select to authenticated using (auth.uid() = user_id);

create or replace function public.grant_xp(_user uuid, _reason text, _ref uuid, _amount integer) returns void
language plpgsql security definer set search_path = public as $$
declare inserted int;
begin
  insert into public.xp_events (user_id, reason, ref_id, amount) values (_user, _reason, _ref, _amount) on conflict do nothing;
  get diagnostics inserted = row_count;
  if inserted > 0 then update public.profiles set xp = xp + _amount where id = _user; end if;
end $$;
revoke execute on function public.grant_xp(uuid, text, uuid, integer) from public, anon, authenticated;

create or replace function public.on_spot_status() returns trigger language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if new.status = 'approved' and old.status is distinct from 'approved' then
    perform public.grant_xp(new.author_id, 'spot_approved', new.id, 100);
    select count(*) into n from public.xp_events where user_id = new.author_id and reason = 'spot_approved';
    if n >= 1 then perform public.grant_xp(new.author_id, 'first_spot_bonus', new.author_id, 100); end if;
    if n >= 5 then perform public.grant_xp(new.author_id, 'milestone_5', new.author_id, 150); end if;
    if n >= 25 then perform public.grant_xp(new.author_id, 'milestone_25', new.author_id, 500); end if;
    if n >= 100 then perform public.grant_xp(new.author_id, 'milestone_100', new.author_id, 1500); end if;
  end if;
  return new;
end $$;
create trigger spots_status_xp after update of status on public.spots for each row execute function public.on_spot_status();

create or replace function public.on_photo_status() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'confirmed' and old.status is distinct from 'confirmed' then
    perform public.grant_xp(new.uploader_id, 'photo_approved', new.id, 25);
  end if;
  return new;
end $$;
create trigger photos_status_xp after update of status on public.spot_photos for each row execute function public.on_photo_status();

create or replace function public.on_correction_status() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'confirmed' and old.status is distinct from 'confirmed' then
    perform public.grant_xp(new.user_id, 'correction_confirmed', new.id, 40);
  end if;
  return new;
end $$;
create trigger corrections_status_xp after update of status on public.spot_corrections for each row execute function public.on_correction_status();

create or replace function public.on_report_status() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'confirmed' and old.status is distinct from 'confirmed' then
    perform public.grant_xp(new.user_id, 'report_confirmed', new.id, 20);
  end if;
  return new;
end $$;
create trigger reports_status_xp after update of status on public.spot_reports for each row execute function public.on_report_status();

-- PROFILE ON SIGNUP
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
declare base text; candidate text; i int := 0;
begin
  base := regexp_replace(coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)), '[^A-Za-z0-9_]', '', 'g');
  if char_length(base) < 3 then base := 'spieler' || base; end if;
  base := left(base, 18);
  candidate := base;
  while exists (select 1 from public.profiles where username = candidate) loop
    i := i + 1; candidate := base || i::text;
  end loop;
  insert into public.profiles (id, username) values (new.id, candidate);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- STORAGE POLICIES (bucket created separately)
create policy "spot photos public read" on storage.objects for select using (bucket_id in ('spot-photos', 'avatars'));
create policy "upload own folder" on storage.objects for insert to authenticated
  with check (bucket_id in ('spot-photos', 'avatars') and (storage.foldername(name))[1] = auth.uid()::text);
create policy "update own files" on storage.objects for update to authenticated
  using (bucket_id in ('spot-photos', 'avatars') and (storage.foldername(name))[1] = auth.uid()::text);
create policy "delete own files" on storage.objects for delete to authenticated
  using (bucket_id in ('spot-photos', 'avatars') and (storage.foldername(name))[1] = auth.uid()::text);