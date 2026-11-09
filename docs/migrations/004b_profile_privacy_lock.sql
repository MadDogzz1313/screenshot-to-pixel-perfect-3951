-- 004b_profile_privacy_lock.sql — ERST ausführen, wenn die neue App-Version auf Emergent UND Lovable veröffentlicht ist.
-- Danach können fremde Profildaten (Bio, Bild, XP, Datum, Lieblingsabzeichen) nur noch über die geschützte Ansicht
-- profile_cards gelesen werden, die private Angaben ausblendet. Löscht oder ändert keine Daten.
revoke select on public.profiles from anon, authenticated;
grant select (id, username) on public.profiles to anon, authenticated;
