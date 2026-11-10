-- 012_username_system.sql — eindeutige, sichere Benutzernamen. ENTWURF: manuell in Lovable/Supabase ausführen.
-- Voraussetzung: 001 + 004 (und idealerweise 004b). Rein additiv, keine Nutzer- oder Inhaltsdaten werden gelöscht.
-- Bestehende Nutzer behalten ihre Auth-ID und alle Daten. Ein fehlender Name bleibt zunächst NULL und kann später gesetzt werden.

------------------------------------------------------------------------------------------------
-- 1) Datenbankregeln: 3–20 Zeichen, case-insensitive eindeutig, reservierte Namen
------------------------------------------------------------------------------------------------
alter table public.profiles alter column username drop not null;

alter table public.profiles drop constraint if exists profiles_username_format;
do $$ begin
  alter table public.profiles add constraint profiles_username_format
    check (username is null or username ~ '^[A-Za-z0-9_]{3,20}$');
exception when duplicate_object then null;
end $$;

-- Falls eine alte Datenbank bereits Foo und foo enthält, stoppt die Migration bewusst statt Namen
-- oder Beiträge still umzubenennen. Die folgende Abfrage zeigt den Konflikt vor dem Index an.
do $$ begin
  if exists (select 1 from public.profiles where username is not null group by lower(username) having count(*) > 1) then
    raise exception 'USERNAME_CASE_CONFLICT: Bitte doppelte Namen mit gleicher Groß-/Kleinschreibung zuerst manuell bereinigen.';
  end if;
end $$;

create unique index if not exists profiles_username_lower_unique
  on public.profiles (lower(username)) where username is not null;

create or replace function public.username_is_reserved(_username text) returns boolean
language sql immutable
as $$
  select lower(btrim(coalesce(_username, ''))) in
    ('admin', 'administrator', 'support', 'moderator', 'system', 'leonida')
$$;

create or replace function public.username_available(_username text, _exclude uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = public
as $$
  select _username is not null
    and btrim(_username) ~ '^[A-Za-z0-9_]{3,20}$'
    and not public.username_is_reserved(_username)
    and not exists (
      select 1 from public.profiles p
      where lower(p.username) = lower(btrim(_username))
        and (_exclude is null or p.id <> _exclude)
    )
$$;
revoke all on function public.username_available(text, uuid) from public;
grant execute on function public.username_available(text, uuid) to anon, authenticated;

------------------------------------------------------------------------------------------------
-- 2) Eigenen Namen sicher ändern: nur auth.uid(), Reserved-Namen und Race-Conditions geschützt
------------------------------------------------------------------------------------------------
create or replace function public.set_my_username(_username text) returns text
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  clean text := btrim(_username);
begin
  if uid is null then raise exception 'AUTH_REQUIRED' using errcode = '28000'; end if;
  if clean !~ '^[A-Za-z0-9_]{3,20}$' then raise exception 'USERNAME_INVALID'; end if;
  if public.username_is_reserved(clean) then raise exception 'USERNAME_RESERVED'; end if;
  -- Die unique index-Prüfung bleibt zusätzlich aktiv und entscheidet atomar bei zwei parallelen Anfragen.
  update public.profiles set username = clean where id = uid;
  if not found then
    insert into public.profiles (id, username, xp) values (uid, clean, 0);
  end if;
  return clean;
exception
  when unique_violation then raise exception 'USERNAME_TAKEN';
end $$;
revoke all on function public.set_my_username(text) from public;
grant execute on function public.set_my_username(text) to authenticated;

-- Direkte Client-Updates des Namens sperren; alle anderen Profilfelder behalten die bisherigen RLS-Regeln.
revoke update (username) on public.profiles from anon, authenticated;

------------------------------------------------------------------------------------------------
-- 3) Neue Registrierung: Frontend übergibt den gewünschten Namen in user_metadata.
-- Ungültige/fehlende Metadaten erzeugen bewusst NULL (Kompatibilität mit älteren Clients); der Nutzer kann
-- den Namen später über set_my_username wählen. Die neue Oberfläche verlangt das Feld clientseitig.
------------------------------------------------------------------------------------------------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public
as $$
declare requested text := nullif(btrim(new.raw_user_meta_data->>'username'), '');
begin
  if requested is not null
     and requested ~ '^[A-Za-z0-9_]{3,20}$'
     and not public.username_is_reserved(requested) then
    insert into public.profiles (id, username, xp) values (new.id, requested, 0);
  else
    insert into public.profiles (id, username, xp) values (new.id, null, 0);
  end if;
  insert into public.user_roles (user_id, role) values (new.id, 'user') on conflict (user_id, role) do nothing;
  return new;
exception
  when unique_violation then raise exception 'USERNAME_TAKEN';
end $$;

-- Profil-Erstellung bleibt der einzige Trigger-Weg; der Trigger selbst muss bereits auf auth.users existieren.
-- Der bestehende Trigger wird absichtlich nicht neu angelegt, damit keine doppelten Trigger entstehen.

select '012 erfolgreich vorbereitet' as ergebnis,
  exists (select 1 from pg_indexes where indexname = 'profiles_username_lower_unique') as case_insensitive_index,
  has_column_privilege('authenticated', 'public.profiles', 'username', 'update') as direct_username_update_still_allowed;
