-- 041_spenden_und_spendenabzeichen_entfernen.sql
-- Nutzerfreigabe erforderlich: löscht vorhandene Spendenabzeichen und gespeicherte
-- Supabase-Spenden dauerhaft. Stripe-Zahlungen werden davon nicht rückabgewickelt.
-- In Lovable → SQL Editor vollständig einfügen und ausführen.
--
-- Die Community-Abzeichen bleiben unverändert. Neue echte Stripe-Spenden werden
-- weiterhin im Stripe-/Backend-Zahlungsverlauf verarbeitet, aber nicht mehr als
-- Supabase-donations gespeichert und nicht mit einem Abzeichen verknüpft.

begin;

-- 1. Automatische Spenden-Abzeichenvergabe zuerst stoppen.
drop trigger if exists donations_badges on public.donations;
drop function if exists public.sync_donation_badges();

-- 2. Alte Spendenabzeichen aus Profil-Hervorhebungen entfernen.
update public.profiles p
set featured_badges = coalesce((
  select array_agg(badge_id order by badge_id)
  from unnest(coalesce(p.featured_badges, '{}'::text[])) as badge_id
  where badge_id not in (select id from public.badges where kind = 'donation')
), '{}'::text[]);

-- 3. Alle vergebenen Spendenabzeichen und alle alten Supabase-Spenden löschen.
delete from public.user_badges ub
where ub.badge_id in (select id from public.badges where kind = 'donation');
delete from public.donations;

-- 4. Den Spenden-Abzeichenkatalog entfernen. Community-Abzeichen bleiben bestehen.
delete from public.badges where kind = 'donation';

commit;

-- Erwartung nach dem Lauf:
-- select count(*) from public.donations;                         -- 0
-- select count(*) from public.badges where kind = 'donation';   -- 0
-- select count(*) from public.user_badges ub join public.badges b on b.id = ub.badge_id where b.kind = 'donation'; -- 0
