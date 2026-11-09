-- Leonida Explorer – Entwurf, NICHT automatisch angewendet. Rein additiv (keine DROP/ALTER bestehender Objekte).
create type public.app_role as enum ('admin', 'user');
create type public.spot_status as enum ('pending', 'approved', 'rejected', 'hidden');
create type public.spot_category as enum ('vehicle', 'weapon', 'collect', 'activity', 'place', 'other');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null check (username ~ '^[A-Za-z0-9_]{3,20}$'),
  avatar_url text, bio text check (char_length(bio) <= 200),
  xp integer not null default 0, created_at timestamptz not null default now()
);
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role app_role not null, unique (user_id, role)
);
create table public.spots (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 80),
  category spot_category not null, area text not null,
  x numeric(5,2) not null check (x between 0 and 100), y numeric(5,2) not null check (y between 0 and 100),
  vehicle_type text check (char_length(vehicle_type) <= 60),
  hour smallint check (hour between 0 and 23),
  description text not null check (char_length(description) <= 1000),
  images text[] not null default '{}',
  status spot_status not null default 'pending',
  created_at timestamptz not null default now()
);
create table public.spot_likes (spot_id uuid references public.spots(id) on delete cascade, user_id uuid references auth.users(id) on delete cascade, primary key (spot_id, user_id));
create table public.spot_saves (spot_id uuid references public.spots(id) on delete cascade, user_id uuid references auth.users(id) on delete cascade, primary key (spot_id, user_id));
-- Verhindert doppelte XP-Vergabe: eine Zeile pro (Nutzer, Grund, Objekt)
create table public.xp_events (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  reason text not null, ref_id uuid not null, amount integer not null, created_at timestamptz not null default now(),
  unique (user_id, reason, ref_id)
);

grant select on public.profiles, public.spots, public.spot_likes to anon, authenticated;
grant insert, update on public.profiles to authenticated;
grant insert, update on public.spots to authenticated;
grant insert, delete on public.spot_likes, public.spot_saves to authenticated;
grant select on public.spot_saves, public.user_roles, public.xp_events to authenticated;
grant all on public.profiles, public.user_roles, public.spots, public.spot_likes, public.spot_saves, public.xp_events to service_role;

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.spots enable row level security;
alter table public.spot_likes enable row level security;
alter table public.spot_saves enable row level security;
alter table public.xp_events enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role) returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.user_roles where user_id = _user_id and role = _role) $$;

create policy "profiles public read" on public.profiles for select using (true);
create policy "own profile insert" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "own profile update" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
-- xp darf vom Client nicht geändert werden
revoke update (xp) on public.profiles from authenticated;

create policy "roles own read" on public.user_roles for select to authenticated using (auth.uid() = user_id);

create policy "spots public approved" on public.spots for select using (status = 'approved');
create policy "spots own read" on public.spots for select to authenticated using (auth.uid() = author_id);
create policy "spots admin read" on public.spots for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "spots insert pending" on public.spots for insert to authenticated with check (auth.uid() = author_id and status = 'pending');
create policy "spots admin moderate" on public.spots for update to authenticated using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

create policy "likes read" on public.spot_likes for select using (true);
create policy "likes own" on public.spot_likes for insert to authenticated with check (auth.uid() = user_id);
create policy "likes own delete" on public.spot_likes for delete to authenticated using (auth.uid() = user_id);
create policy "saves own read" on public.spot_saves for select to authenticated using (auth.uid() = user_id);
create policy "saves own" on public.spot_saves for insert to authenticated with check (auth.uid() = user_id);
create policy "saves own delete" on public.spot_saves for delete to authenticated using (auth.uid() = user_id);
create policy "xp own read" on public.xp_events for select to authenticated using (auth.uid() = user_id);

-- Serverseitige XP-Vergabe bei erster Freigabe (idempotent dank unique)
create or replace function public.award_xp_on_approve() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'approved' and old.status = 'pending' then
    insert into public.xp_events (user_id, reason, ref_id, amount) values (new.author_id, 'spot_approved', new.id, 50)
    on conflict do nothing;
    if found then update public.profiles set xp = xp + 50 where id = new.author_id; end if;
  end if;
  return new;
end $$;
create trigger spots_award_xp after update of status on public.spots for each row execute function public.award_xp_on_approve();

-- Storage: Bucket "spot-images" per Tool anlegen; Uploads nur in eigenen Ordner <user_id>/...
-- create policy "own uploads" on storage.objects for insert to authenticated with check (bucket_id = 'spot-images' and (storage.foldername(name))[1] = auth.uid()::text);
