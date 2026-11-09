-- 002_auth_roles.sql — Echte Anmeldung & Rollen (ENTWURF, noch NICHT ausgeführt)
-- Über Lovable anwenden. Erstellt KEINE neuen Tabellen und KEINE neuen Trigger.
-- Kann gefahrlos mehrfach ausgeführt werden (idempotent).
--
-- Prüfung der bestehenden Struktur (0000_leonida_core.sql):
--  * Trigger on_auth_user_created -> handle_new_user() legt nur ein Profil an:
--    keine Rolle "user", kein Profilbild. -> Funktion wird unten ersetzt (create or replace),
--    der bestehende Trigger bleibt und ruft automatisch die neue Version auf.
--  * user_roles: RLS aktiv, nur Lese-Regel für die eigene Rolle, KEINE Insert/Update/Delete-Regel
--    -> Nutzer können sich keine Rolle geben. Zusätzlich werden Schreibrechte unten ausdrücklich entzogen.
--  * profiles: Update-Regel "own profile update" erlaubt das eigene Profil. Falls Supabase-Standardrechte
--    (grant all) noch aktiv sind, könnte man sonst die eigene XP setzen -> unten auf Spalten
--    username, avatar_url, bio beschränkt.
--  * XP-Trigger (on_spot_status: aktuell 100 XP + 100 Bonus) bleiben UNVERÄNDERT.
--    Die Umstellung auf genau 50 XP pro erstmaliger Freigabe folgt beim Beitragssystem.

-- 1) Neue Konten: Profil (Name, Profilbild, 0 XP = Level I) + Rolle "user"
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
  insert into public.profiles (id, username, avatar_url, xp)
  values (new.id, candidate, 'https://api.dicebear.com/9.x/thumbs/svg?seed=' || candidate, 0);
  -- Rolle ist fest "user" und kommt NIE aus den Anmeldedaten des Nutzers.
  insert into public.user_roles (user_id, role) values (new.id, 'user') on conflict (user_id, role) do nothing;
  return new;
end $$;

-- 2) Bereits vorhandene Konten nachziehen
insert into public.user_roles (user_id, role)
select p.id, 'user'::public.app_role from public.profiles p
on conflict (user_id, role) do nothing;

update public.profiles
set avatar_url = 'https://api.dicebear.com/9.x/thumbs/svg?seed=' || username
where avatar_url is null;

-- 3) Rollen: Nutzer dürfen Rollen nur lesen, niemals selbst vergeben/ändern/löschen.
--    Admins werden ausschließlich über Lovable Cloud (Datenbank) bzw. service_role eingetragen.
revoke insert, update, delete, truncate on public.user_roles from anon, authenticated;
revoke all on public.user_roles from anon;
grant select on public.user_roles to authenticated;

-- 4) Profile: XP/ID/Datum nie vom Nutzer änderbar; nur Name, Bild, Bio
revoke insert, update, delete, truncate on public.profiles from anon, authenticated;
grant select on public.profiles to anon, authenticated;
grant update (username, avatar_url, bio) on public.profiles to authenticated;

-- 5) XP-Funktion bleibt für Nutzer gesperrt (nur Trigger dürfen XP vergeben)
revoke execute on function public.grant_xp(uuid, text, uuid, integer) from public, anon, authenticated;

-- ERSTEN ADMIN FREISCHALTEN (separat, erst nach Registrierung und E-Mail-Bestätigung):
-- insert into public.user_roles (user_id, role)
-- select id, 'admin' from auth.users where email = 'DEINE-EMAIL@BEISPIEL.DE'
-- on conflict (user_id, role) do nothing;
