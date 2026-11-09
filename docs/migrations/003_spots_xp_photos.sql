-- 003_spots_xp_photos.sql — Beitragssystem: 50 XP pro erster Freigabe + Foto-Speicher
-- ENTWURF, über Lovable anwenden. Keine neuen Tabellen. Idempotent (mehrfach ausführbar).
--
-- Prüfung (0000_leonida_core.sql):
--  * RLS spots: Insert nur eigener Beitrag mit status 'pending' (passt), öffentlich nur 'approved' (passt),
--    Update nur Admin via has_role (passt) -> KEINE Änderung nötig.
--  * on_spot_status vergibt 100 XP + 100 Erst-Bonus + Meilensteine -> wird auf genau 50 XP geändert.
--  * Doppelte Vergabe: xp_events unique(user_id, reason, ref_id) + grant_xp "on conflict do nothing"
--    -> Ausblenden/Wiederherstellen/erneutes Freigeben vergibt nie erneut XP. grant_xp bleibt unverändert.
--  * on_photo_status vergibt 25 XP pro bestätigtem Foto -> Fotos des Verfassers zum eigenen Beitrag
--    geben keine Extra-XP (sonst mehr als 50 XP pro Beitrag).
--  * Storage-Bucket 'spot-photos' existiert noch nicht -> wird angelegt.

-- 1) Genau 50 XP bei der ersten Freigabe; Fotos des Verfassers werden mit freigegeben
create or replace function public.on_spot_status() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'approved' and old.status is distinct from 'approved' then
    perform public.grant_xp(new.author_id, 'spot_approved', new.id, 50);
    update public.spot_photos set status = 'confirmed'
      where spot_id = new.id and uploader_id = new.author_id and status = 'pending';
  end if;
  return new;
end $$;

-- 2) Keine Foto-XP für Fotos, die der Verfasser zu seinem eigenen Beitrag hochlädt
create or replace function public.on_photo_status() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'confirmed' and old.status is distinct from 'confirmed'
     and not exists (select 1 from public.spots s where s.id = new.spot_id and s.author_id = new.uploader_id) then
    perform public.grant_xp(new.uploader_id, 'photo_approved', new.id, 25);
  end if;
  return new;
end $$;

-- 3) Foto-Speicher (öffentlich lesbar, max. 8 MB, nur JPG/PNG/WEBP)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('spot-photos', 'spot-photos', true, 8000000, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Hochladen nur in den eigenen Ordner <user-id>/... (gleiche Regeln wie in 0000, neu angelegt falls fehlend)
drop policy if exists "spot photos public read" on storage.objects;
create policy "spot photos public read" on storage.objects for select using (bucket_id in ('spot-photos', 'avatars'));
drop policy if exists "upload own folder" on storage.objects;
create policy "upload own folder" on storage.objects for insert to authenticated
  with check (bucket_id in ('spot-photos', 'avatars') and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "update own files" on storage.objects;
create policy "update own files" on storage.objects for update to authenticated
  using (bucket_id in ('spot-photos', 'avatars') and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "delete own files" on storage.objects;
create policy "delete own files" on storage.objects for delete to authenticated
  using (bucket_id in ('spot-photos', 'avatars') and (storage.foldername(name))[1] = auth.uid()::text);

-- 4) Spots: Rechte wie geplant (falls Supabase-Standardrechte noch aktiv sind)
revoke delete, truncate on public.spots, public.spot_photos from anon, authenticated;
revoke insert, update on public.spots, public.spot_photos from anon;
