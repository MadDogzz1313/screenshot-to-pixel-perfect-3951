-- 009_selbsttest_freunde_moderation.sql — Selbsttest für 008. Erst NACH 008 ausführen.
-- Legt 3 normale Test-Spieler (A, B, C) und 2 Test-Admins (D, E) an und prüft Freundschaften, Glocke, Privatchat,
-- Privatsphäre, Blockieren, Meldungen und Kontosperren – jeweils mit den echten Rechten eines angemeldeten Nutzers.
-- Am Ende wird ALLES automatisch rückgängig gemacht (absichtlicher Abbruch) – es bleibt nichts in der Datenbank.
-- Das Ergebnis steht Zeile für Zeile in der Fehlermeldung "SELBSTTEST 008 ...".
do $test$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); c uuid := gen_random_uuid();
  d uuid := gen_random_uuid(); e uuid := gen_random_uuid();
  req uuid; req2 uuid; msg uuid; n int; i int; err text; out text := ''; st jsonb; fo jsonb; r record;
begin
  -- Hilfsfunktionen nur für diesen Test (temporär, verschwinden mit dem Abbruch)
  execute $f$create function pg_temp.t(_ok boolean, _label text) returns text language sql as
    $q$ select E'\n' || case when coalesce(_ok, false) then 'OK     | ' else 'FEHLER | ' end || _label $q$$f$;
  execute $f$create function pg_temp.as_user(_u uuid) returns void language plpgsql as $q$
    begin
      reset role;
      perform set_config('request.jwt.claims', case when _u is null then '' else json_build_object('sub', _u, 'role', 'authenticated')::text end, true);
      if _u is not null then set local role authenticated; end if;
    end $q$$f$;

  insert into auth.users (id, email) values (a, 'test-a@leonida.invalid'), (b, 'test-b@leonida.invalid'), (c, 'test-c@leonida.invalid'),
    (d, 'test-admin-d@leonida.invalid'), (e, 'test-admin-e@leonida.invalid');
  insert into public.user_roles (user_id, role) values (d, 'admin'), (e, 'admin') on conflict do nothing;

  -- 1) Freundschaftsanfrage + Glocke
  perform pg_temp.as_user(a);
  perform public.send_friend_request(b);
  select id into req from public.friend_requests where sender_id = a and receiver_id = b and status = 'pending';
  out := out || pg_temp.t(req is not null, 'A sendet Freundschaftsanfrage an B');
  begin perform public.send_friend_request(b); err := 'kein Fehler'; exception when others then err := sqlerrm; end;
  out := out || pg_temp.t(err like '%FRIEND_ALREADY_REQUESTED%', 'Doppelte Anfrage verhindert');
  begin perform public.send_friend_request(a); err := 'kein Fehler'; exception when others then err := sqlerrm; end;
  out := out || pg_temp.t(err like '%FRIEND_SELF%', 'Anfrage an sich selbst verhindert');
  begin insert into public.notifications (user_id, kind, title) values (b, 'admin', 'Fake'); err := 'kein Fehler'; exception when others then err := sqlerrm; end;
  out := out || pg_temp.t(err like '%permission denied%', 'Nutzer kann keine Benachrichtigungen fälschen');

  perform pg_temp.as_user(b);
  select count(*) into n from public.notifications where read_at is null;
  out := out || pg_temp.t(n = 1, format('Glocke von B zeigt 1 (ist: %s)', n));
  perform pg_temp.as_user(c);
  perform public.send_friend_request(b);
  perform pg_temp.as_user(b);
  select count(*) into n from public.notifications where read_at is null;
  out := out || pg_temp.t(n = 2, format('Zweite Anfrage (von C) erhöht Glocke auf 2 (ist: %s)', n));
  -- Profil öffnen = nur lesen, nichts markieren
  perform public.my_friend_state();
  select count(*) into n from public.notifications where read_at is null;
  out := out || pg_temp.t(n = 2, 'Nur Profil/Status laden entfernt den Zähler nicht');
  -- Benachrichtigungsübersicht öffnen: angezeigte Benachrichtigung von A als gelesen markieren
  perform public.mark_notifications_read(array(select id from public.notifications where ref_id = req));
  select count(*) into n from public.notifications where read_at is null;
  out := out || pg_temp.t(n = 1, format('Ansehen markiert gelesen, Zähler sinkt auf 1 (ist: %s)', n));
  out := out || pg_temp.t(exists (select 1 from public.friend_requests where id = req and status = 'pending'), 'Anfrage bleibt nach dem Lesen bestehen');
  select count(*) into n from public.notifications where ref_id = req and read_at is not null;
  out := out || pg_temp.t(n = 1, 'Lesestatus ist dauerhaft gespeichert (bleibt nach Neuladen)');

  -- 2) Zurückziehen, Ablehnen, Annehmen
  perform pg_temp.as_user(a);
  perform public.cancel_friend_request(req);
  out := out || pg_temp.t((select status from public.friend_requests where id = req) = 'cancelled', 'A zieht Anfrage zurück');
  perform public.send_friend_request(b);
  select id into req from public.friend_requests where sender_id = a and receiver_id = b and status = 'pending';
  perform pg_temp.as_user(b);
  perform public.respond_friend_request(req, false);
  perform pg_temp.as_user(a);
  out := out || pg_temp.t((select status from public.friend_requests where id = req) = 'declined', 'B lehnt Anfrage ab');
  begin perform public.send_private_message(b, 'Hallo?'); err := 'kein Fehler'; exception when others then err := sqlerrm; end;
  out := out || pg_temp.t(err like '%PM_NOT_FRIENDS%', 'Privatnachricht ohne Freundschaft verhindert');
  perform public.send_friend_request(b);
  select id into req from public.friend_requests where sender_id = a and receiver_id = b and status = 'pending';
  perform pg_temp.as_user(b);
  perform public.respond_friend_request(req, true);
  st := public.my_friend_state();
  out := out || pg_temp.t(st->'friends' @> jsonb_build_array(jsonb_build_object('id', a)), 'B nimmt an – A und B sind Freunde');
  perform pg_temp.as_user(a);
  out := out || pg_temp.t(exists (select 1 from public.notifications where kind = 'friend_accepted' and read_at is null), 'A bekommt Benachrichtigung „Freundschaft angenommen“');
  -- Gegenanfrage: C hat B schon angefragt; B schickt C eine Anfrage -> wird angenommen statt Widerspruch
  perform pg_temp.as_user(b);
  out := out || pg_temp.t(public.send_friend_request(c) = 'accepted', 'Gegenanfrage nimmt bestehende Anfrage an (kein Widerspruch)');

  -- 3) Privatsphäre der Freundesliste
  perform pg_temp.as_user(c);
  fo := public.friends_of(a);
  out := out || pg_temp.t((fo->>'visible')::boolean = false and fo->'count' = 'null'::jsonb, 'Standard privat: C sieht weder Liste noch Anzahl von A');
  perform pg_temp.as_user(a);
  fo := public.friends_of(a);
  out := out || pg_temp.t((fo->>'count')::int = 1, 'A sieht eigene Freundesliste trotz privat');
  update public.profiles set show_friends = true where id = a;
  perform pg_temp.as_user(c);
  fo := public.friends_of(a);
  out := out || pg_temp.t((fo->>'visible')::boolean and (fo->>'count')::int = 1, 'Öffentlich: C sieht A''s Liste + Anzahl 1');
  perform pg_temp.as_user(b);
  update public.profiles set is_private = true where id = b;
  perform pg_temp.as_user(c);
  fo := public.friends_of(a);
  out := out || pg_temp.t((fo->>'count')::int = 0, 'Freund mit privatem Profil wird in fremden Listen ausgeblendet');
  perform pg_temp.as_user(a);
  update public.profiles set is_private = true where id = a;
  perform pg_temp.as_user(null);
  fo := public.friends_of(a);
  out := out || pg_temp.t((fo->>'visible')::boolean = false, 'Vollständig privates Profil: Freundesliste verborgen (auch für Gäste)');
  perform pg_temp.as_user(a);
  update public.profiles set is_private = false where id = a;
  perform pg_temp.as_user(b);
  update public.profiles set is_private = false where id = b;

  -- 4) Privatchat
  perform pg_temp.as_user(a);
  select (public.send_private_message(b, 'Hey B, Treffpunkt Vice Beach?')).id into msg;
  perform pg_temp.as_user(b);
  out := out || pg_temp.t(exists (select 1 from public.private_messages where id = msg), 'B liest Nachricht von A');
  select unread into n from public.my_conversations() where other_id = a;
  out := out || pg_temp.t(n = 1, 'Chatübersicht zeigt 1 ungelesene Nachricht');
  out := out || pg_temp.t(exists (select 1 from public.notifications where kind = 'private_message' and ref_id = a and read_at is null), 'Glocke meldet neue private Nachricht');
  perform public.mark_conversation_read(a);
  select unread into n from public.my_conversations() where other_id = a;
  out := out || pg_temp.t(n = 0 and not exists (select 1 from public.notifications where kind = 'private_message' and read_at is null), 'Gespräch öffnen markiert Nachricht + Benachrichtigung gelesen');
  perform pg_temp.as_user(c);
  out := out || pg_temp.t(not exists (select 1 from public.private_messages where id = msg), 'C (fremd) kann die Unterhaltung nicht lesen');
  perform pg_temp.as_user(d);
  out := out || pg_temp.t(not exists (select 1 from public.private_messages where id = msg), 'Admin hat keinen pauschalen Zugriff auf Privatchats');
  perform pg_temp.as_user(b);
  begin perform public.delete_private_message(msg); err := 'kein Fehler'; exception when others then err := sqlerrm; end;
  out := out || pg_temp.t(err like '%PM_NOT_FOUND%', 'B kann Nachricht von A nicht löschen');
  begin insert into public.private_messages (sender_id, receiver_id, body) values (b, a, 'direkt'); err := 'kein Fehler'; exception when others then err := sqlerrm; end;
  out := out || pg_temp.t(err like '%permission denied%', 'Direktes Einfügen an den Regeln vorbei verhindert');

  -- 5) Meldungen
  perform public.report_private_message(msg, 'spam', 'Testmeldung');
  begin perform public.report_private_message(msg, 'spam', null); err := 'kein Fehler'; exception when others then err := sqlerrm; end;
  out := out || pg_temp.t(err like '%REPORT_DUPLICATE%', 'Nachricht melden + doppelte Meldung verhindert');
  perform public.report_user(c, 'harassment', 'Test');
  begin perform public.report_user(c, 'spam', null); err := 'kein Fehler'; exception when others then err := sqlerrm; end;
  out := out || pg_temp.t(err like '%REPORT_DUPLICATE%', 'Benutzer melden + doppelte offene Meldung verhindert');
  begin perform count(*) from public.user_reports; err := 'kein Fehler'; exception when others then err := sqlerrm; end;
  out := out || pg_temp.t(err like '%permission denied%', 'Normale Nutzer sehen keine Meldungen');
  begin perform * from public.admin_list_reports('open'); err := 'kein Fehler'; exception when others then err := sqlerrm; end;
  out := out || pg_temp.t(err like '%ADMIN_ONLY%', 'Admin-Meldeliste nur für Admins');
  perform pg_temp.as_user(a);
  perform public.delete_private_message(msg);
  out := out || pg_temp.t((select body from public.private_messages where id = msg) = '', 'A löscht eigene Nachricht (Inhalt entfernt)');
  perform pg_temp.as_user(d);
  select count(*) into n from public.admin_list_reports('open');
  out := out || pg_temp.t(n = 2, format('Admin sieht 2 offene Meldungen (ist: %s)', n));
  select excerpt into err from (select message_excerpt as excerpt from public.admin_list_reports('open') where message_excerpt is not null) x;
  out := out || pg_temp.t(err = 'Hey B, Treffpunkt Vice Beach?', 'Gemeldete Nachricht bleibt für Moderation als Auszug erhalten');
  for r in select id from public.admin_list_reports('open') loop perform public.admin_update_report(r.id, 'resolved', 'erledigt'); end loop;
  select count(*) into n from public.admin_list_reports('open');
  out := out || pg_temp.t(n = 0, 'Admin schließt Meldungen ab');

  -- 6) Rate-Limit Privatnachrichten
  perform pg_temp.as_user(a);
  n := 0;
  begin for i in 1..30 loop perform public.send_private_message(b, 'Spam ' || i); n := n + 1; end loop; err := 'kein Fehler';
  exception when others then err := sqlerrm; end;
  out := out || pg_temp.t(err like '%RATE_LIMIT%' and n < 21, format('Spam-Schutz greift (nach %s Nachrichten)', n));

  -- 7) Persönliches Blockieren
  perform pg_temp.as_user(b);
  perform public.block_user(a);
  out := out || pg_temp.t(not (public.my_friend_state()->'friends' @> jsonb_build_array(jsonb_build_object('id', a))), 'B blockiert A – Freundschaft entfernt');
  out := out || pg_temp.t(exists (select 1 from public.private_messages where sender_id = a and receiver_id = b), 'Bestehende Nachrichten bleiben erhalten');
  perform pg_temp.as_user(a);
  begin perform public.send_friend_request(b); err := 'kein Fehler'; exception when others then err := sqlerrm; end;
  out := out || pg_temp.t(err like '%FRIEND_BLOCKED%', 'Keine Anfrage zwischen blockierten Nutzern');
  begin perform public.send_private_message(b, 'Hallo'); err := 'kein Fehler'; exception when others then err := sqlerrm; end;
  out := out || pg_temp.t(err like '%PM_BLOCKED%', 'Keine Privatnachricht nach Blockierung');
  out := out || pg_temp.t(not exists (select 1 from public.my_account_ban()), 'Blockieren sperrt NICHT das Konto');
  perform pg_temp.as_user(b);
  out := out || pg_temp.t(public.my_friend_state()->'blocked' @> to_jsonb(array[a]), 'Blockierliste zeigt A');
  perform public.unblock_user(a);
  perform pg_temp.as_user(a);
  out := out || pg_temp.t(public.send_friend_request(b) = 'sent', 'Nach Entblocken wieder Anfragen möglich');

  -- 8) Admin-Sperren
  perform pg_temp.as_user(b);
  begin perform public.admin_ban_user(c, null, 'Test', true); err := 'kein Fehler'; exception when others then err := sqlerrm; end;
  out := out || pg_temp.t(err like '%ADMIN_ONLY%', 'Normale Nutzer können nicht sperren');
  begin insert into public.user_roles (user_id, role) values (b, 'admin'); err := 'kein Fehler'; exception when others then err := sqlerrm; end;
  out := out || pg_temp.t(err not like 'kein Fehler', 'Normale Nutzer können sich keine Adminrechte geben');
  perform pg_temp.as_user(d);
  begin perform public.admin_ban_user(d, null, 'Selbst', true); err := 'kein Fehler'; exception when others then err := sqlerrm; end;
  out := out || pg_temp.t(err like '%ADMIN_SELF%', 'Admin kann sich nicht selbst sperren');
  begin perform public.admin_ban_user(e, null, 'Anderer Admin', true); err := 'kein Fehler'; exception when others then err := sqlerrm; end;
  out := out || pg_temp.t(err like '%ADMIN_PROTECTED%', 'Andere Admins sind geschützt');
  perform public.admin_ban_user(a, now() + interval '3 days', 'Spam im Chat', true);
  perform public.admin_ban_user(c, null, 'Interner Grund', false);
  perform pg_temp.as_user(a);
  select * into r from public.my_account_ban();
  out := out || pg_temp.t(r.until_at is not null and not r.permanent and r.reason = 'Spam im Chat', 'Zeitweise Sperre: Ablaufdatum + Grund für den Sperrbildschirm');
  begin perform public.send_chat_message('Hallo Community', null); err := 'kein Fehler'; exception when others then err := sqlerrm; end;
  out := out || pg_temp.t(err like '%ACCOUNT_BANNED%', 'Gesperrt: keine Community-Nachricht');
  begin perform public.send_private_message(c, 'Hi'); err := 'kein Fehler'; exception when others then err := sqlerrm; end;
  out := out || pg_temp.t(err like '%ACCOUNT_BANNED%', 'Gesperrt: keine Privatnachricht');
  begin perform public.send_friend_request(c); err := 'kein Fehler'; exception when others then err := sqlerrm; end;
  out := out || pg_temp.t(err like '%ACCOUNT_BANNED%', 'Gesperrt: keine Freundschaftsanfrage');
  begin insert into public.spots (author_id, title, category, area, x, y, description) values (a, 'Gesperrt', 'place', 'Test', 50, 50, 'Test'); err := 'kein Fehler';
  exception when others then err := sqlerrm; end;
  out := out || pg_temp.t(err like '%ACCOUNT_BANNED%', 'Gesperrt: kein neuer Beitrag (auch direkt an der App vorbei)');
  begin update public.profiles set bio = 'umgehen' where id = a; err := 'kein Fehler'; exception when others then err := sqlerrm; end;
  out := out || pg_temp.t(err like '%ACCOUNT_BANNED%', 'Gesperrt: Profil nicht änderbar');
  perform public.request_ban_review('Das war ein Missverständnis');
  begin perform public.request_ban_review('Nochmal'); err := 'kein Fehler'; exception when others then err := sqlerrm; end;
  out := out || pg_temp.t(err like '%RATE_LIMIT%', 'Gesperrter Nutzer fragt Überprüfung an (max. 1× pro Tag)');
  perform pg_temp.as_user(d);
  out := out || pg_temp.t(exists (select 1 from public.notifications where title like 'Überprüfung%' and read_at is null), 'Admin erhält Überprüfungsanfrage in der Glocke');
  perform pg_temp.as_user(c);
  select * into r from public.my_account_ban();
  out := out || pg_temp.t(r.permanent and r.reason is null, 'Dauerhafte Sperre: „Permanent“, Grund nur wenn freigegeben');
  perform pg_temp.as_user(d);
  perform public.admin_unban_user(a, 'Bewährung');
  perform pg_temp.as_user(a);
  out := out || pg_temp.t(not exists (select 1 from public.my_account_ban()), 'Entsperrt: kein Sperrbildschirm mehr');
  begin perform public.send_chat_message('Wieder da', null); err := 'kein Fehler'; exception when others then err := sqlerrm; end;
  out := out || pg_temp.t(err = 'kein Fehler', 'Nach Entsperrung funktioniert der Community-Chat wieder');
  out := out || pg_temp.t(exists (select 1 from public.notifications where kind = 'admin' and read_at is null), 'A erhält Mitteilung „Sperre aufgehoben“');
  perform pg_temp.as_user(null);
  update public.account_bans set until_at = now() - interval '1 minute' where user_id = c;
  out := out || pg_temp.t(not public.is_account_banned(c), 'Abgelaufene zeitweise Sperre wirkt nicht mehr');

  -- 9) Verwarnen, Community-Mitteilung, Protokoll, Suche
  perform pg_temp.as_user(d);
  perform public.admin_warn_user(b, 'Bitte freundlich bleiben');
  n := public.admin_broadcast('Server-Wartung heute Abend', 'Kurze Pause ab 22 Uhr');
  out := out || pg_temp.t(n >= 5, 'Community-Mitteilung an alle Spieler');
  select count(*) into n from public.admin_moderation_log(null) where action in ('ban', 'unban', 'warn', 'report_update', 'broadcast');
  out := out || pg_temp.t(n >= 6, format('Moderationsaktionen protokolliert (%s Einträge)', n));
  select warnings into n from public.admin_search_users('') where id = b;
  out := out || pg_temp.t(n = 1, 'Benutzersuche zeigt Verwarnung');
  perform pg_temp.as_user(b);
  select count(*) into n from public.notifications where kind in ('admin', 'community') and read_at is null;
  out := out || pg_temp.t(n = 2, 'B bekommt Verwarnung + Community-Mitteilung in der Glocke');

  perform pg_temp.as_user(null);
  raise exception E'SELBSTTEST 008: % von % OK%\n(Alle Testdaten wurden automatisch zurückgesetzt.)',
    (select count(*) from regexp_matches(out, E'\nOK ', 'g')), (select count(*) from regexp_matches(out, E'\n(OK|FEHLER) ', 'g')), out;
end $test$;
