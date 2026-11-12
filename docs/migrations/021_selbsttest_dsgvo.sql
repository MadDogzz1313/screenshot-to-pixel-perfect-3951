-- 021_selbsttest_dsgvo.sql — Selbsttest für 020. Erst NACH 020 ausführen.
-- Simuliert zwei normale Spieler (A, B), einen unbeteiligten Spieler (C) und einen Test-Admin (D) mit den echten
-- Rechten eines angemeldeten Nutzers und prüft: Privatnachrichten-Sichtbarkeit, Blockieren, Melden,
-- Community-Chat, Speicherdauer der Meldungen und Konto löschen.
-- Am Ende wird ALLES automatisch rückgängig gemacht (absichtlicher Abbruch) – es bleibt nichts in der Datenbank.
-- Das Ergebnis steht Zeile für Zeile in der Fehlermeldung "SELBSTTEST 020 ...".
do $test$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); c uuid := gen_random_uuid(); d uuid := gen_random_uuid();
  sfx text := substr(md5(random()::text), 1, 8);
  req uuid; pm uuid; cm uuid; cm2 uuid; spot_ok uuid; spot_wait uuid; old_report uuid; n int; err text; out text := ''; res jsonb; txt text;
begin
  execute $f$create function pg_temp.t(_ok boolean, _label text) returns text language sql as
    $q$ select E'\n' || case when coalesce(_ok, false) then 'OK     | ' else 'FEHLER | ' end || _label $q$$f$;
  execute $f$create function pg_temp.as_user(_u uuid) returns void language plpgsql as $q$
    begin
      reset role;
      perform set_config('request.jwt.claims', case when _u is null then '' else json_build_object('sub', _u, 'role', 'authenticated')::text end, true);
      if _u is not null then set local role authenticated; end if;
    end $q$$f$;

  insert into auth.users (id, email, raw_user_meta_data) values
    (a, 'test-a@leonida.invalid', jsonb_build_object('username', 'zt_a_' || sfx)),
    (b, 'test-b@leonida.invalid', jsonb_build_object('username', 'zt_b_' || sfx)),
    (c, 'test-c@leonida.invalid', jsonb_build_object('username', 'zt_c_' || sfx)),
    (d, 'test-admin-d@leonida.invalid', jsonb_build_object('username', 'zt_d_' || sfx));
  insert into public.profiles (id, username) select x, null from unnest(array[a, b, c, d]) x on conflict (id) do nothing;
  insert into public.user_roles (user_id, role) values (d, 'admin') on conflict do nothing;

  -- 1) Freunde werden, Privatnachricht nur für die beiden Teilnehmer sichtbar
  perform pg_temp.as_user(a);
  perform public.send_friend_request(b);
  select id into req from public.friend_requests where sender_id = a and receiver_id = b and status = 'pending';
  perform pg_temp.as_user(b);
  perform public.respond_friend_request(req, true);
  perform pg_temp.as_user(a);
  select (public.send_private_message(b, 'Hallo B, privat!')).id into pm;
  out := out || pg_temp.t(pm is not null, 'A sendet B eine Privatnachricht');
  perform pg_temp.as_user(b);
  select count(*) into n from public.private_messages where id = pm;
  out := out || pg_temp.t(n = 1, 'Empfänger B kann die Nachricht lesen');
  perform pg_temp.as_user(c);
  select count(*) into n from public.private_messages;
  out := out || pg_temp.t(n = 0, 'Unbeteiligter C sieht keine fremden Privatnachrichten');
  perform pg_temp.as_user(d);
  select count(*) into n from public.private_messages where id = pm;
  out := out || pg_temp.t(n = 0, 'Admin D kann Privatnachrichten NICHT pauschal lesen');
  perform pg_temp.as_user(c);
  begin perform public.send_private_message(a, 'Ich bin kein Freund'); err := 'kein Fehler'; exception when others then err := sqlerrm; end;
  out := out || pg_temp.t(err like '%PM_NOT_FRIENDS%', 'Nicht-Freund C kann A nicht privat schreiben');
  perform pg_temp.as_user(a);
  begin update public.private_messages set body = 'manipuliert' where id = pm; err := 'kein Fehler'; exception when others then err := sqlerrm; end;
  out := out || pg_temp.t(err like '%permission denied%', 'Nachrichten können nicht direkt geändert werden');
  begin insert into public.private_messages (sender_id, receiver_id, body) values (a, b, 'direkt'); err := 'kein Fehler'; exception when others then err := sqlerrm; end;
  out := out || pg_temp.t(err like '%permission denied%', 'Nachrichten können nicht am Server vorbei eingefügt werden');
  perform pg_temp.as_user(null);
  set local role anon;
  begin select count(*) into n from public.private_messages; err := 'kein Fehler'; exception when others then err := sqlerrm; end;
  out := out || pg_temp.t(err like '%permission denied%', 'Nicht angemeldete Besucher haben keinen Zugriff auf Privatnachrichten');
  reset role;

  -- 2) Privatnachricht melden: privat, nur für Admins sichtbar
  perform pg_temp.as_user(b);
  perform public.report_private_message(pm, 'harassment', 'Testmeldung');
  begin perform public.report_private_message(pm, 'harassment', null); err := 'kein Fehler'; exception when others then err := sqlerrm; end;
  out := out || pg_temp.t(err like '%REPORT_DUPLICATE%', 'Doppelte Meldung derselben Nachricht verhindert');
  perform pg_temp.as_user(a);
  begin select count(*) into n from public.user_reports; err := 'kein Fehler'; exception when others then err := sqlerrm; end;
  out := out || pg_temp.t(err like '%permission denied%', 'Gemeldeter A kann Meldungen (und den Melder) nicht sehen');
  begin perform public.admin_list_reports('open'); err := 'kein Fehler'; exception when others then err := sqlerrm; end;
  out := out || pg_temp.t(err like '%ADMIN_ONLY%', 'Normale Nutzer können die Meldungsliste nicht abrufen');
  perform pg_temp.as_user(d);
  select count(*) into n from public.admin_list_reports('open') r where r.reported_user_id = a and r.message_excerpt = 'Hallo B, privat!';
  out := out || pg_temp.t(n = 1, 'Admin sieht die Meldung mit genau diesem einen Nachrichtentext');

  -- 3) Community-Chat + Meldung mit gespeichertem Text
  perform pg_temp.as_user(a);
  select (public.send_chat_message('Hallo Community', null)).id into cm;
  select (public.send_chat_message('Zweite Nachricht', null)).id into cm2;
  perform pg_temp.as_user(c);
  select count(*) into n from public.chat_messages where id = cm;
  out := out || pg_temp.t(n = 1, 'Angemeldete Spieler sehen den Community-Chat');
  perform public.report_chat_message(cm, 'Spam im Chat');
  begin perform public.report_chat_message(cm, 'Nochmal Spam'); err := 'kein Fehler'; exception when others then err := sqlerrm; end;
  out := out || pg_temp.t(err like '%CHAT_REPORT_DUPLICATE%', 'Doppelte Chat-Meldung verhindert');
  perform pg_temp.as_user(a);
  select count(*) into n from public.chat_reports;
  out := out || pg_temp.t(n = 0, 'Gemeldeter A sieht keine Chat-Meldungen über sich');
  perform public.delete_chat_message(cm);
  perform pg_temp.as_user(null);
  select body into txt from public.chat_messages where id = cm;
  out := out || pg_temp.t(txt = '', 'Gelöschte Chat-Nachricht: Text ist in der Datenbank wirklich entfernt');
  perform pg_temp.as_user(d);
  select count(*) into n from public.chat_reports where message_id = cm and message_excerpt = 'Hallo Community';
  out := out || pg_temp.t(n = 1, 'Admin sieht den gemeldeten Text trotzdem in der Meldung');
  perform pg_temp.as_user(null);
  set local role anon;
  begin select count(*) into n from public.chat_messages; err := 'kein Fehler'; exception when others then err := sqlerrm; end;
  out := out || pg_temp.t(err like '%permission denied%', 'Nicht angemeldete Besucher können den Chat nicht lesen');
  reset role;

  -- 4) Blockieren: B blockiert A
  perform pg_temp.as_user(b);
  perform public.block_user(a);
  select count(*) into n from public.friendships where b in (user_a, user_b);
  out := out || pg_temp.t(n = 0, 'Blockieren beendet die Freundschaft');
  select count(*) into n from public.notifications where actor_id = a and kind = 'private_message';
  out := out || pg_temp.t(n = 0, 'Glocke von B zeigt keine Hinweise mehr von A');
  select count(*) into n from public.chat_messages where author_id = a;
  out := out || pg_temp.t(n = 0, 'B sieht A im Community-Chat nicht mehr');
  perform pg_temp.as_user(a);
  begin perform public.send_private_message(b, 'Bitte antworte'); err := 'kein Fehler'; exception when others then err := sqlerrm; end;
  out := out || pg_temp.t(err like '%PM_BLOCKED%', 'Blockierter A kann B keine Privatnachricht mehr senden');
  begin perform public.send_friend_request(b); err := 'kein Fehler'; exception when others then err := sqlerrm; end;
  out := out || pg_temp.t(err like '%FRIEND_BLOCKED%', 'Blockierter A kann keine neue Freundschaftsanfrage senden');
  perform public.send_chat_message('Nachricht nach Blockierung', null);
  perform pg_temp.as_user(b);
  select count(*) into n from public.chat_messages where author_id = a;
  out := out || pg_temp.t(n = 0, 'Neue Chat-Nachrichten von A bleiben für B ausgeblendet');
  perform public.send_chat_message('B schreibt öffentlich', null);
  perform pg_temp.as_user(a);
  select count(*) into n from public.chat_messages where author_id = b;
  out := out || pg_temp.t(n = 0, 'Ausblenden wirkt beidseitig (A sieht B nicht)');
  select count(*) into n from public.chat_blocks;
  out := out || pg_temp.t(n = 0, 'A kann nicht sehen, dass/wer ihn blockiert hat');
  perform pg_temp.as_user(c);
  select count(*) into n from public.chat_messages where author_id in (a, b) and deleted_at is null;
  out := out || pg_temp.t(n >= 3, 'Unbeteiligte sehen weiterhin beide');
  perform pg_temp.as_user(b);
  select count(*) into n from public.chat_blocks where blocker_id = b and blocked_id = a;
  out := out || pg_temp.t(n = 1, 'Blockierung ist dauerhaft gespeichert (bleibt nach Neustart)');
  perform public.report_user(a, 'harassment', 'Melden trotz Blockierung');
  out := out || pg_temp.t(true, 'Blockierte Nutzer können weiterhin gemeldet werden');

  -- 5) Speicherdauer: bearbeitete Meldungen werden nach 6 Monaten gelöscht
  perform pg_temp.as_user(d);
  select id into old_report from public.admin_list_reports('open') r where r.message_excerpt = 'Hallo B, privat!';
  perform public.admin_update_report(old_report, 'resolved', 'erledigt');
  perform pg_temp.as_user(null);
  update public.user_reports set handled_at = now() - interval '7 months' where id = old_report;
  out := out || pg_temp.t(not exists (select 1 from public.user_reports where id = old_report), 'Meldung 6 Monate nach Bearbeitung automatisch gelöscht');
  out := out || pg_temp.t(exists (select 1 from public.user_reports where reported_user_id = a and status = 'open'), 'Offene Meldungen bleiben bis zur Bearbeitung erhalten');

  -- 6) Konto löschen (A): freigegebene Fundorte anonym behalten, alles andere weg
  insert into public.spots (author_id, title, category, area, x, y, description, status)
    values (a, 'Freigegebener Testort', 'place', 'Vice City', 10, 10, 'Beschreibung des Testorts', 'pending') returning id into spot_ok;
  insert into public.spots (author_id, title, category, area, x, y, description, status)
    values (a, 'Wartender Testort', 'place', 'Vice City', 20, 20, 'Beschreibung des Testorts', 'pending') returning id into spot_wait;
  insert into public.spot_photos (spot_id, uploader_id, path) values
    (spot_ok, a, a::text || '/' || spot_ok::text || '/ok.jpg'), (spot_wait, a, a::text || '/' || spot_wait::text || '/wait.jpg');
  update public.spots set status = 'approved' where id = spot_ok;
  perform pg_temp.as_user(d);
  begin perform public.delete_my_account(); err := 'kein Fehler'; exception when others then err := sqlerrm; end;
  out := out || pg_temp.t(err like '%ADMIN_DELETE%', 'Admin-Konten werden nicht versehentlich gelöscht');
  perform pg_temp.as_user(null);
  begin perform public.delete_my_account(); err := 'kein Fehler'; exception when others then err := sqlerrm; end;
  out := out || pg_temp.t(err like '%AUTH_REQUIRED%' or err like '%permission denied%', 'Ohne Anmeldung kann kein Konto gelöscht werden');
  perform pg_temp.as_user(a);
  res := public.delete_my_account();
  perform pg_temp.as_user(null);
  out := out || pg_temp.t(not exists (select 1 from auth.users where id = a), 'Anmeldekonto von A gelöscht');
  out := out || pg_temp.t(not exists (select 1 from public.profiles where id = a), 'Profil von A gelöscht');
  out := out || pg_temp.t(not exists (select 1 from public.private_messages where a in (sender_id, receiver_id)), 'Ganzes Privatgespräch A↔B für beide gelöscht');
  out := out || pg_temp.t(not exists (select 1 from public.notifications where actor_id = a or ref_id = a), 'Benachrichtigungen von A bei anderen gelöscht');
  out := out || pg_temp.t(not exists (select 1 from public.chat_messages where author_id = a), 'Community-Chat-Nachrichten von A gelöscht');
  out := out || pg_temp.t(not exists (select 1 from public.chat_blocks where a in (blocker_id, blocked_id)), 'Blockierungen mit A gelöscht');
  out := out || pg_temp.t(not exists (select 1 from public.user_reports where a in (reporter_id, reported_user_id))
    and not exists (select 1 from public.chat_reports where a in (reporter_id, reported_user_id)), 'Meldungen von/über A gelöscht');
  out := out || pg_temp.t(not exists (select 1 from public.spots where id = spot_wait), 'Nicht freigegebener Fundort gelöscht');
  out := out || pg_temp.t(exists (select 1 from public.spots where id = spot_ok and author_id is null), 'Freigegebener Fundort bleibt anonym ("Gelöschter Nutzer")');
  out := out || pg_temp.t(exists (select 1 from public.spot_photos where spot_id = spot_ok and uploader_id is null), 'Bestätigtes Foto des freigegebenen Fundorts bleibt anonym');
  out := out || pg_temp.t(res->'photo_paths' = jsonb_build_array(a::text || '/' || spot_wait::text || '/wait.jpg'),
    'App erhält genau die zu löschende Fotodatei zurück');
  out := out || pg_temp.t(exists (select 1 from public.profiles where id = b), 'Konto von B bleibt unberührt');

  perform pg_temp.as_user(null);
  raise exception E'SELBSTTEST 020: % von % OK%\n(Alle Testdaten wurden automatisch zurückgesetzt.)',
    (select count(*) from regexp_matches(out, E'\nOK ', 'g')), (select count(*) from regexp_matches(out, E'\n(OK|FEHLER) ', 'g')), out;
end $test$;
