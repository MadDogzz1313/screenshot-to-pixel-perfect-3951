-- 020_dsgvo_chat_dm_konto.sql — DSGVO-/Sicherheits-Nachbesserungen für Chat, Privatnachrichten, Blockieren,
-- Melden und Konto löschen. ENTWURF: in Lovable Cloud → SQL Editor einfügen und ausführen.
-- Voraussetzung: 004, 007, 008 und 011 wurden bereits ausgeführt (014 Crew Finder optional).
-- Mehrfach ausführbar. Es werden KEINE Tabellen gelöscht; bestehende Daten bleiben erhalten
-- (Ausnahme: Text bereits gelöschter Community-Chat-Nachrichten wird geleert, siehe Teil C).
--
-- Entscheidungen des Betreibers (12.11.2026):
--  * Konto löschen: bereits FREIGEGEBENE Fundorte bleiben anonym ("Gelöschter Nutzer") auf der Karte,
--    alles andere (Profil, Chat-Nachrichten, nicht freigegebene Fundorte, Fotos, Coins, Abzeichen …) wird gelöscht.
--  * Privatnachrichten: löscht einer der beiden sein Konto, wird das GANZE Gespräch für beide gelöscht.
--  * Blockieren: keine Privatnachrichten/Freundschaftsanfragen mehr + Community-Chat beidseitig ausgeblendet.
--  * Meldungen: werden 6 Monate nach der Bearbeitung durch einen Admin automatisch gelöscht.

------------------------------------------------------------------------------------------------
-- TEIL A: Konto löschen darf an keinem Fremdschlüssel scheitern
------------------------------------------------------------------------------------------------
-- A1) Fundorte: Ersteller darf leer sein (= "Gelöschter Nutzer"). Der Name spots_author_id_fkey bleibt
--     erhalten, weil die App ihn für die Abfrage des Benutzernamens verwendet.
alter table public.spots alter column author_id drop not null;
do $$
declare c record;
begin
  for c in
    select con.conname from pg_constraint con
    join pg_attribute a on a.attrelid = con.conrelid and a.attnum = con.conkey[1]
    where con.conrelid = 'public.spots'::regclass and con.contype = 'f' and array_length(con.conkey, 1) = 1 and a.attname = 'author_id'
  loop
    execute format('alter table public.spots drop constraint %I', c.conname);
  end loop;
  alter table public.spots add constraint spots_author_id_fkey
    foreign key (author_id) references public.profiles(id) on delete set null;
end $$;

-- A2) Fundort-Fotos: bestätigte Fotos freigegebener Fundorte bleiben ebenfalls anonym erhalten
alter table public.spot_photos alter column uploader_id drop not null;
do $$
declare c record;
begin
  for c in
    select con.conname from pg_constraint con
    join pg_attribute a on a.attrelid = con.conrelid and a.attnum = con.conkey[1]
    where con.conrelid = 'public.spot_photos'::regclass and con.contype = 'f' and array_length(con.conkey, 1) = 1 and a.attname = 'uploader_id'
  loop
    execute format('alter table public.spot_photos drop constraint %I', c.conname);
  end loop;
  alter table public.spot_photos add constraint spot_photos_uploader_id_fkey
    foreign key (uploader_id) references public.profiles(id) on delete set null;
end $$;

-- A3) Chat-Einschränkungen: "on delete restrict" auf den Admin hätte das Löschen ehemaliger Admins blockiert
alter table public.chat_restrictions alter column created_by drop not null;
do $$
declare c record;
begin
  for c in
    select con.conname from pg_constraint con
    join pg_attribute a on a.attrelid = con.conrelid and a.attnum = con.conkey[1]
    where con.conrelid = 'public.chat_restrictions'::regclass and con.contype = 'f' and array_length(con.conkey, 1) = 1 and a.attname = 'created_by'
  loop
    execute format('alter table public.chat_restrictions drop constraint %I', c.conname);
  end loop;
  alter table public.chat_restrictions add constraint chat_restrictions_created_by_fkey
    foreign key (created_by) references public.profiles(id) on delete set null;
end $$;

-- A4) Alle "on delete set null"-Verweise auf Profile/Konten dürfen wirklich leer werden
--     (z. B. chat_moderation_log.actor_id, donations.verified_by – sonst bricht das Löschen ab)
do $$
declare c record;
begin
  for c in
    select n.nspname, t.relname, a.attname
    from pg_constraint con
    join pg_class t on t.oid = con.conrelid join pg_namespace n on n.oid = t.relnamespace
    join pg_attribute a on a.attrelid = con.conrelid and a.attnum = any (con.conkey)
    where con.contype = 'f' and con.confdeltype = 'n' and n.nspname = 'public' and a.attnotnull
      and con.confrelid in ('public.profiles'::regclass, 'auth.users'::regclass)
  loop
    execute format('alter table %I.%I alter column %I drop not null', c.nspname, c.relname, c.attname);
  end loop;
end $$;

------------------------------------------------------------------------------------------------
-- TEIL B: Aufräumen beim Löschen eines Profils (greift auch, wenn ein Admin ein Konto in Lovable löscht)
------------------------------------------------------------------------------------------------
create or replace function public.gdpr_before_profile_delete() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- eigene Fotos, die NICHT als bestätigtes Foto eines freigegebenen Fundorts öffentlich sind
  delete from public.spot_photos p using public.spots s
    where p.spot_id = s.id and p.uploader_id = old.id and not (p.status = 'confirmed' and s.status = 'approved');
  -- eigene Fundorte, die nicht freigegeben sind (ausstehend, abgelehnt, ausgeblendet)
  delete from public.spots where author_id = old.id and status <> 'approved';
  -- Benachrichtigungen anderer Nutzer, die von diesem Konto ausgelöst wurden (inkl. "Neue private Nachricht")
  if to_regclass('public.notifications') is not null then
    delete from public.notifications where actor_id = old.id or (kind = 'private_message' and ref_id = old.id);
  end if;
  return old;
end $$;
drop trigger if exists gdpr_before_profile_delete on public.profiles;
create trigger gdpr_before_profile_delete before delete on public.profiles
  for each row execute function public.gdpr_before_profile_delete();

-- Konto selbst löschen. Rückgabe: Speicherpfade der zu entfernenden Fotos (die App löscht die Dateien danach).
-- Privatnachrichten (beide Richtungen), Freundschaften, Chat, Crews, Coins, Push-Geräte usw. werden über
-- "on delete cascade" mitgelöscht; freigegebene Fundorte bleiben ohne Ersteller erhalten.
drop function if exists public.delete_my_account();
create function public.delete_my_account() returns jsonb
language plpgsql security definer set search_path = public, auth as $$
declare uid uuid := auth.uid(); paths jsonb; kept integer;
begin
  if uid is null then raise exception 'AUTH_REQUIRED' using errcode = '28000'; end if;
  if public.has_role(uid, 'admin') then raise exception 'ADMIN_DELETE'; end if;  -- Admins zuerst Rolle in Lovable entfernen
  select coalesce(jsonb_agg(p.path), '[]'::jsonb) into paths
    from public.spot_photos p join public.spots s on s.id = p.spot_id
    where (p.uploader_id = uid or s.author_id = uid) and p.path like uid::text || '/%'
      and not (p.status = 'confirmed' and s.status = 'approved');
  select count(*) into kept from public.spots where author_id = uid and status = 'approved';
  delete from public.profiles where id = uid;   -- löst Teil-B-Aufräumen + alle Cascades aus
  delete from auth.users where id = uid;        -- Anmeldekonto, Sitzungen, Tokens (Supabase Auth)
  return jsonb_build_object('photo_paths', paths, 'kept_spots', kept);
end $$;
revoke execute on function public.delete_my_account() from public, anon, authenticated;
grant execute on function public.delete_my_account() to authenticated;
revoke execute on function public.gdpr_before_profile_delete() from public, anon, authenticated;

------------------------------------------------------------------------------------------------
-- TEIL C: Community-Chat – gelöschte Nachrichten wirklich leeren, Meldungen absichern
------------------------------------------------------------------------------------------------
do $$
declare c record;
begin
  for c in select conname from pg_constraint
    where conrelid = 'public.chat_messages'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%body%'
  loop
    execute format('alter table public.chat_messages drop constraint %I', c.conname);
  end loop;
end $$;
alter table public.chat_messages add constraint chat_messages_body_check
  check (deleted_at is not null or char_length(body) between 1 and 500);
update public.chat_messages set body = '' where deleted_at is not null and body <> '';

create or replace function public.delete_chat_message(_message_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); author uuid; admin boolean;
begin
  if uid is null then raise exception 'CHAT_AUTH_REQUIRED' using errcode = '28000'; end if;
  select author_id into author from public.chat_messages where id = _message_id and deleted_at is null;
  if author is null then raise exception 'CHAT_MESSAGE_NOT_FOUND'; end if;
  admin := public.chat_is_admin();
  if author <> uid and not admin then raise exception 'CHAT_DELETE_FORBIDDEN' using errcode = '42501'; end if;
  update public.chat_messages set body = '', deleted_at = now(), deleted_by = uid where id = _message_id;
  if admin and author <> uid then
    insert into public.chat_moderation_log (actor_id, target_user_id, message_id, action)
    values (uid, author, _message_id, 'delete_message');
  end if;
end $$;

-- Meldung speichert den gemeldeten Text (wie bei Privatnachrichten), damit Admins ihn auch nach dem Löschen prüfen können
alter table public.chat_reports add column if not exists message_excerpt text;
alter table public.chat_reports drop constraint if exists chat_reports_message_excerpt_len;
alter table public.chat_reports add constraint chat_reports_message_excerpt_len
  check (message_excerpt is null or char_length(message_excerpt) <= 500);
do $$
begin
  create unique index if not exists chat_reports_one_per_message on public.chat_reports (reporter_id, message_id)
    where message_id is not null and status = 'open';
exception when unique_violation then
  raise notice 'Alte doppelte Chat-Meldungen vorhanden – Doppelschutz greift trotzdem über report_chat_message().';
end $$;

create or replace function public.report_chat_message(_message_id uuid, _reason text) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := public.require_active_user(); m public.chat_messages; clean_reason text := btrim(coalesce(_reason, ''));
begin
  if char_length(clean_reason) < 3 or char_length(clean_reason) > 500 then raise exception 'CHAT_INVALID_REPORT'; end if;
  select * into m from public.chat_messages where id = _message_id and deleted_at is null;
  if not found then raise exception 'CHAT_MESSAGE_NOT_FOUND'; end if;
  if m.author_id = uid then raise exception 'CHAT_SELF_REPORT'; end if;
  if exists (select 1 from public.chat_reports where reporter_id = uid and message_id = _message_id and status = 'open') then
    raise exception 'CHAT_REPORT_DUPLICATE';
  end if;
  perform public.hit_rate_limit('report', 10, interval '1 hour');
  insert into public.chat_reports (message_id, reporter_id, reported_user_id, reason, message_excerpt)
  values (_message_id, uid, m.author_id, clean_reason, left(m.body, 500));
end $$;

------------------------------------------------------------------------------------------------
-- TEIL D: Blockieren – zusätzlich offene Benachrichtigungen des Blockierten entfernen
------------------------------------------------------------------------------------------------
create or replace function public.block_user(_other uuid) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'AUTH_REQUIRED' using errcode = '28000'; end if;
  if _other is null or _other = uid then raise exception 'BLOCK_SELF'; end if;
  if not exists (select 1 from public.profiles where id = _other) then raise exception 'BLOCK_USER_NOT_FOUND'; end if;
  insert into public.chat_blocks (blocker_id, blocked_id) values (uid, _other) on conflict do nothing;
  delete from public.friendships where user_a = least(uid, _other) and user_b = greatest(uid, _other);
  delete from public.notifications where kind = 'friend_request' and ref_id in (select id from public.friend_requests
    where status = 'pending' and ((sender_id = uid and receiver_id = _other) or (sender_id = _other and receiver_id = uid)));
  update public.friend_requests set status = 'cancelled', responded_at = now()
    where status = 'pending' and ((sender_id = uid and receiver_id = _other) or (sender_id = _other and receiver_id = uid));
  -- Glocke des Blockierenden: keine Hinweise mehr vom Blockierten (Privatnachricht, Freundschaft)
  delete from public.notifications where user_id = uid and actor_id = _other
    and kind in ('friend_request', 'friend_accepted', 'private_message');
end $$;

------------------------------------------------------------------------------------------------
-- TEIL E: Speicherdauer – Meldungen 6 Monate nach Bearbeitung löschen, technische Zähler kurz halten
------------------------------------------------------------------------------------------------
create or replace function public.purge_expired_moderation_data() returns integer
language plpgsql security definer set search_path = public as $$
declare n integer := 0; k integer;
begin
  delete from public.user_reports where status in ('resolved', 'dismissed')
    and coalesce(handled_at, created_at) < now() - interval '6 months';
  get diagnostics k = row_count; n := n + k;
  delete from public.chat_reports where status in ('reviewed', 'dismissed')
    and coalesce(reviewed_at, created_at) < now() - interval '6 months';
  get diagnostics k = row_count; n := n + k;
  delete from public.action_events where created_at < now() - interval '1 day';
  delete from public.chat_send_events where created_at < now() - interval '2 minutes';
  return n;
end $$;
revoke execute on function public.purge_expired_moderation_data() from public, anon, authenticated;

-- Läuft automatisch bei jeder neuen Meldung und jeder Admin-Bearbeitung (funktioniert ohne Zeitplaner) …
create or replace function public.purge_expired_moderation_trigger() returns trigger
language plpgsql security definer set search_path = public as $$
begin perform public.purge_expired_moderation_data(); return null; end $$;
revoke execute on function public.purge_expired_moderation_trigger() from public, anon, authenticated;
drop trigger if exists zz_purge_expired on public.user_reports;
create trigger zz_purge_expired after insert or update on public.user_reports
  for each statement execute function public.purge_expired_moderation_trigger();
drop trigger if exists zz_purge_expired on public.chat_reports;
create trigger zz_purge_expired after insert or update on public.chat_reports
  for each statement execute function public.purge_expired_moderation_trigger();

-- … und zusätzlich täglich um 03:17 UTC, falls pg_cron in der Datenbank aktiv ist
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'leonida-purge-moderation';
    perform cron.schedule('leonida-purge-moderation', '17 3 * * *', 'select public.purge_expired_moderation_data()');
  end if;
exception when others then
  raise notice 'pg_cron nicht nutzbar (%), Löschung läuft weiter automatisch bei neuen Meldungen.', sqlerrm;
end $$;
select public.purge_expired_moderation_data();

------------------------------------------------------------------------------------------------
-- TEIL F: Fundort-Fotos – Dateiliste nur für freigegebene Fotos, eigene Dateien und Admins
-- (vorher konnte jeder die Dateinamen aller Fotos auflisten, auch ausstehende/abgelehnte)
------------------------------------------------------------------------------------------------
drop policy if exists "spot photos public read" on storage.objects;
create policy "spot photos public read" on storage.objects for select using (
  bucket_id = 'spot-photos' and (
    (auth.uid() is not null and (storage.foldername(objects.name))[1] = auth.uid()::text)
    or exists (select 1 from public.spot_photos p join public.spots s on s.id = p.spot_id
               where p.path = objects.name and p.status = 'confirmed' and s.status = 'approved')
    or (auth.uid() is not null and public.has_role(auth.uid(), 'admin'))
  )
);

------------------------------------------------------------------------------------------------
-- Ergebnis
------------------------------------------------------------------------------------------------
select '020 erfolgreich eingerichtet' as ergebnis,
  (select not attnotnull from pg_attribute where attrelid = 'public.spots'::regclass and attname = 'author_id') as fundorte_anonym_moeglich,
  (select pg_get_function_result('public.delete_my_account()'::regprocedure)) = 'jsonb' as konto_loeschen_neu,
  exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'chat_reports' and column_name = 'message_excerpt') as chatmeldung_mit_text,
  exists (select 1 from pg_trigger where tgname = 'zz_purge_expired') as meldungen_6_monate,
  (select string_agg(format('%s.%s', t.relname, a.attname), ', ')
     from pg_constraint con join pg_class t on t.oid = con.conrelid join pg_namespace n on n.oid = t.relnamespace
     join pg_attribute a on a.attrelid = con.conrelid and a.attnum = any (con.conkey)
     where con.contype = 'f' and con.confdeltype in ('a', 'r') and n.nspname = 'public'
       and con.confrelid in ('public.profiles'::regclass, 'auth.users'::regclass)) as blockierende_verweise_bitte_melden;
