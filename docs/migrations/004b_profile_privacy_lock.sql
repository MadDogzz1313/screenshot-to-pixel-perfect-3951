-- 004b_profile_privacy_lock.sql — Datenschutz-Sperre für Profile. Voraussetzung: 004 wurde ausgeführt.
-- Danach können fremde Profildaten (Bio, Bild, XP, Datum, Lieblingsabzeichen) nur noch über die geschützte Ansicht
-- profile_cards gelesen werden, die private Angaben ausblendet. Löscht oder ändert keine Daten. Mehrfach ausführbar.

-- 1) Abzeichen-Sichtbarkeit über eine geschützte Funktion prüfen (statt direkt in profiles zu lesen),
--    sonst würde die Abzeichen-Anzeige nach der Sperre mit "permission denied" fehlschlagen.
create or replace function public.badges_visible(_u uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select _u = auth.uid() or public.has_role(auth.uid(), 'admin')
    or exists (select 1 from public.profiles p where p.id = _u and not p.is_private and p.show_badges)
$$;
revoke execute on function public.badges_visible(uuid) from public;
grant execute on function public.badges_visible(uuid) to anon, authenticated;

drop policy if exists "user badges visible by privacy" on public.user_badges;
create policy "user badges visible by privacy" on public.user_badges for select using (public.badges_visible(user_id));

-- 2) Direktes Lesen der Profiltabelle auf ID + Name beschränken
revoke select on public.profiles from anon, authenticated;
grant select (id, username) on public.profiles to anon, authenticated;

-- 3) Kontrolle: muss "Sperre aktiv" zeigen
select case when has_column_privilege('anon', 'public.profiles', 'bio', 'select')
            then 'FEHLER: Bio noch lesbar' else 'Sperre aktiv' end as ergebnis;
