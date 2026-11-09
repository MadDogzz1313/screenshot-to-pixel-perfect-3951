-- 006_selbsttest_abzeichen.sql — Selbsttest für 004. Erst NACH 004 ausführen.
-- Legt Test-Spieler an, prüft jedes Abzeichen an seiner Grenze (knapp darunter gesperrt, genau dort freigeschaltet),
-- nachträgliche Vergabe, keine Doppelvergabe, Spendenrechte und Schutzregeln.
-- Am Ende wird ALLES automatisch rückgängig gemacht (absichtlicher Abbruch) – es bleibt nichts in der Datenbank.
-- Das Ergebnis steht Zeile für Zeile in der Fehlermeldung "SELBSTTEST ...".
do $$
declare
  a uuid := gen_random_uuid();   -- Vielentdecker, 7 Monate Mitglied
  b uuid := gen_random_uuid();   -- Helfer / aktiv / Spender / Monatssieger
  c uuid := gen_random_uuid();   -- Test-Admin
  d uuid := gen_random_uuid();   -- Bestandsdaten (nachträgliche Vergabe), 5 Monate Mitglied
  s uuid; i int; ok int := 0; total int := 0; out text := ''; r record; blocked boolean;
  has_badge boolean;
begin
  insert into auth.users (id, email, created_at) values
    (a, 'selbsttest-a@leonida.invalid', now() - interval '7 months'), (b, 'selbsttest-b@leonida.invalid', now()),
    (c, 'selbsttest-c@leonida.invalid', now()), (d, 'selbsttest-d@leonida.invalid', now() - interval '5 months');
  insert into public.user_roles (user_id, role) values (c, 'admin');

  -- Hilfsmakro als lokale Prüfung: Zeile anhängen
  -- (kein CREATE FUNCTION, damit nichts dauerhaft angelegt wird)

  -- A: 100 Fundorte nacheinander freigeben (1–10 Fahrzeuge, 11–35 Sammelobjekte, 1–20 mit Foto)
  for i in 1..100 loop
    insert into public.spots (author_id, title, category, area, x, y, description)
    values (a, 'Selbsttest ' || i, (case when i <= 10 then 'vehicle' when i <= 35 then 'collect' else 'place' end)::public.spot_category,
            'Testgebiet', 50, 50, 'Selbsttest-Beschreibung') returning id into s;
    if i <= 20 then insert into public.spot_photos (spot_id, uploader_id, path) values (s, a, a || '/' || s || '/t.jpg'); end if;
    update public.spots set status = 'approved' where id = s;     -- wie Freigabe im Admin-Bereich
    for r in select * from (values
        (0, 1, 'first_find', 'Erster Fund'), (9, 10, 'explorer', 'Entdecker'), (99, 100, 'legend', 'Leonida-Legende'),
        (9, 10, 'car_freak', 'Autofreak'), (34, 35, 'treasure_hunter', 'Schatzjäger (25 Sammelobjekte)'), (19, 20, 'photographer', 'Fotograf')
      ) v(below, at_, bid, label) where i in (below, at_) loop
      has_badge := exists (select 1 from public.user_badges where user_id = a and badge_id = r.bid);
      total := total + 1;
      if (i = r.at_) = has_badge then ok := ok + 1; end if;
      out := out || format(E'\n%s | nach %s Freigaben: %s (erwartet: %s) %s', r.label, i,
        case when has_badge then 'freigeschaltet' else 'gesperrt' end, case when i = r.at_ then 'freigeschaltet' else 'gesperrt' end,
        case when (i = r.at_) = has_badge then 'OK' else 'FEHLER' end);
    end loop;
  end loop;

  -- Community-Star: eigene Likes zählen nicht; 99 fremde = gesperrt, 100 = frei; Doppel-Like unmöglich
  insert into public.spot_likes (spot_id, user_id) select id, a from public.spots where author_id = a limit 5;
  insert into public.spot_likes (spot_id, user_id) select id, b from public.spots where author_id = a order by title limit 99;
  has_badge := exists (select 1 from public.user_badges where user_id = a and badge_id = 'community_star');
  total := total + 1; if not has_badge then ok := ok + 1; end if;
  out := out || format(E'\nCommunity-Star | 99 fremde + 5 eigene Likes: %s (erwartet: gesperrt) %s', case when has_badge then 'freigeschaltet' else 'gesperrt' end, case when not has_badge then 'OK' else 'FEHLER' end);
  insert into public.spot_likes (spot_id, user_id) select id, b from public.spots where author_id = a order by title desc limit 1;
  has_badge := exists (select 1 from public.user_badges where user_id = a and badge_id = 'community_star');
  total := total + 1; if has_badge then ok := ok + 1; end if;
  out := out || format(E'\nCommunity-Star | 100 fremde Likes: %s %s', case when has_badge then 'freigeschaltet' else 'gesperrt' end, case when has_badge then 'OK' else 'FEHLER' end);
  total := total + 1; blocked := false;
  begin insert into public.spot_likes (spot_id, user_id) select id, b from public.spots where author_id = a limit 1; exception when unique_violation then blocked := true; end;
  if blocked then ok := ok + 1; end if;
  out := out || format(E'\nLikes | gleicher Nutzer liked denselben Beitrag 2×: %s', case when blocked then 'verhindert OK' else 'MÖGLICH – FEHLER' end);

  -- Präzisionsfinder: Admin C bestätigt 19, dann 20 Fundorte über set_spot_accuracy
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  i := 0;
  for r in select id from public.spots where author_id = a order by title limit 20 loop
    perform public.set_spot_accuracy(r.id, true); i := i + 1;
    if i in (19, 20) then
      has_badge := exists (select 1 from public.user_badges where user_id = a and badge_id = 'precision');
      total := total + 1; if (i = 20) = has_badge then ok := ok + 1; end if;
      out := out || format(E'\nPräzisionsfinder | %s als korrekt bestätigt: %s %s', i, case when has_badge then 'freigeschaltet' else 'gesperrt' end, case when (i = 20) = has_badge then 'OK' else 'FEHLER' end);
    end if;
  end loop;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  total := total + 1; blocked := false;
  begin perform public.set_spot_accuracy((select id from public.spots where author_id = a limit 1), true); exception when others then blocked := true; end;
  if blocked then ok := ok + 1; end if;
  out := out || format(E'\nPräzisionsfinder | Nicht-Admin bestätigt Genauigkeit: %s', case when blocked then 'verhindert OK' else 'MÖGLICH – FEHLER' end);

  -- Helfende Hand: 9, dann 10 vom Admin bestätigte Korrekturen von B
  i := 0;
  for r in select id from public.spots where author_id = a order by title limit 10 loop
    insert into public.spot_corrections (spot_id, user_id, message) values (r.id, b, 'Selbsttest-Korrektur') returning id into s;
    update public.spot_corrections set status = 'confirmed' where id = s; i := i + 1;
    if i in (9, 10) then
      has_badge := exists (select 1 from public.user_badges where user_id = b and badge_id = 'helping_hand');
      total := total + 1; if (i = 10) = has_badge then ok := ok + 1; end if;
      out := out || format(E'\nHelfende Hand | %s bestätigte Korrekturen: %s %s', i, case when has_badge then 'freigeschaltet' else 'gesperrt' end, case when (i = 10) = has_badge then 'OK' else 'FEHLER' end);
    end if;
  end loop;

  -- Aktiv dabei: 5 frühere Tage + heute (über touch_activity) = 6 → gesperrt; 6. früherer Tag → 7 in Folge → frei
  insert into public.user_activity_days (user_id, day) select b, (now() at time zone 'Europe/Berlin')::date - g from generate_series(1, 5) g;
  perform public.touch_activity();
  has_badge := exists (select 1 from public.user_badges where user_id = b and badge_id = 'active');
  total := total + 1; if not has_badge then ok := ok + 1; end if;
  out := out || format(E'\nAktiv dabei | 6 Tage in Folge: %s %s', case when has_badge then 'freigeschaltet' else 'gesperrt' end, case when not has_badge then 'OK' else 'FEHLER' end);
  insert into public.user_activity_days (user_id, day) values (b, (now() at time zone 'Europe/Berlin')::date - 6);
  perform public.touch_activity();
  has_badge := exists (select 1 from public.user_badges where user_id = b and badge_id = 'active');
  total := total + 1; if has_badge then ok := ok + 1; end if;
  out := out || format(E'\nAktiv dabei | 7 Tage in Folge: %s %s', case when has_badge then 'freigeschaltet' else 'gesperrt' end, case when has_badge then 'OK' else 'FEHLER' end);

  -- Bestandsdaten D: 10 bereits freigegebene Fundorte OHNE Freigabe-Aktion (wie vor dem Update) → nachträgliche Vergabe
  insert into public.spots (author_id, title, category, area, x, y, description, status)
  select d, 'Selbsttest Bestand ' || g, 'place', 'Testgebiet', 20, 20, 'Selbsttest-Beschreibung', 'approved' from generate_series(1, 10) g;
  has_badge := exists (select 1 from public.user_badges where user_id = d);
  total := total + 1; if not has_badge then ok := ok + 1; end if;
  out := out || format(E'\nNachträglich | Bestand vor Prüfung: %s', case when has_badge then 'schon Abzeichen – FEHLER' else 'noch keine Abzeichen OK' end);

  -- Top-Entdecker: B in leerem, abgeschlossenem Testmonat (Jan. 2000) auf Platz 1
  insert into public.spots (author_id, title, category, area, x, y, description, status, approved_at)
  values (b, 'Selbsttest Monat', 'place', 'Testgebiet', 10, 10, 'Selbsttest-Beschreibung', 'approved', '2000-01-15 12:00+01');
  perform public.compute_monthly_ranking('2000-01-01');

  -- Tägliche Prüfung aller Profile (wie Zeitplan) – zweimal, um Doppelvergabe auszuschließen
  perform public.check_all_badges(); perform public.check_all_badges();
  for r in select * from (values
      (d, 'first_find', true, 'Nachträglich | Erster Fund für Bestand'), (d, 'explorer', true, 'Nachträglich | Entdecker für Bestand'),
      (a, 'veteran', true, 'Veteran | 7 Monate Mitglied'), (d, 'veteran', false, 'Veteran | 5 Monate Mitglied (muss gesperrt sein)'),
      (b, 'top_explorer', true, 'Top-Entdecker | Platz 1 im abgeschlossenen Monat'), (a, 'top_explorer', false, 'Top-Entdecker | nicht platziert (muss gesperrt sein)')
    ) v(u, bid, expect, label) loop
    has_badge := exists (select 1 from public.user_badges where user_id = r.u and badge_id = r.bid);
    total := total + 1; if has_badge = r.expect then ok := ok + 1; end if;
    out := out || format(E'\n%s: %s %s', r.label, case when has_badge then 'freigeschaltet' else 'gesperrt' end, case when has_badge = r.expect then 'OK' else 'FEHLER' end);
  end loop;
  total := total + 1;
  if not exists (select 1 from public.user_badges group by user_id, badge_id having count(*) > 1) then ok := ok + 1; out := out || E'\nDoppelvergabe | nach mehrfacher Prüfung: keine OK';
  else out := out || E'\nDoppelvergabe | FEHLER'; end if;

  -- Spenden: Nicht-Admin B darf nicht, Admin C erfasst 20 € → Supporter/Bronze/Silver, keine XP
  execute 'set local role authenticated';
  total := total + 1; blocked := false;
  begin insert into public.donations (user_id, amount_cents, verified_by) values (b, 5000, b); exception when others then blocked := true; end;
  if blocked then ok := ok + 1; end if;
  out := out || format(E'\nSpenden | Nicht-Admin erfasst Spende: %s', case when blocked then 'verhindert OK' else 'MÖGLICH – FEHLER' end);
  total := total + 1; blocked := false;
  begin insert into public.user_badges (user_id, badge_id) values (b, 'founder'); exception when others then blocked := true; end;
  if blocked then ok := ok + 1; end if;
  out := out || format(E'\nSpenden | Nutzer gibt sich selbst Founder-Abzeichen: %s', case when blocked then 'verhindert OK' else 'MÖGLICH – FEHLER' end);
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  insert into public.donations (user_id, amount_cents, verified_by) values (b, 2000, c);
  execute 'reset role';
  total := total + 1;
  if (select string_agg(badge_id, ',' order by badge_id) from public.user_badges ub join public.badges bd on bd.id = ub.badge_id where ub.user_id = b and bd.kind = 'donation') = 'bronze,silver,supporter'
  then ok := ok + 1; out := out || E'\nSpenden | Admin erfasst 20 €: Supporter, Bronze, Silver OK'; else out := out || E'\nSpenden | Stufen FEHLER'; end if;

  -- XP unverändert: A 100 × 50; B nur 10 Korrekturen × 40 (Spende & Abzeichen geben keine XP)
  total := total + 1;
  if (select xp from public.profiles where id = a) = 5000 and (select xp from public.profiles where id = b) = 400 then ok := ok + 1; out := out || E'\nXP | 50 pro Freigabe, keine XP durch Spenden/Abzeichen OK';
  else out := out || format(E'\nXP | FEHLER (A=%s, B=%s)', (select xp from public.profiles where id = a), (select xp from public.profiles where id = b)); end if;

  -- Schutzregeln als normaler Nutzer B
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  for r in select * from (values
      ('update public.profiles set xp = 99999 where id = ''' || b || '''', 'eigene XP ändern'),
      ('insert into public.user_roles (user_id, role) values (''' || b || ''', ''admin'')', 'sich selbst Admin geben'),
      ('update public.profiles set featured_badges = array[''legend''] where id = ''' || b || '''', 'fremdes Abzeichen hervorheben'),
      ('select public.check_all_badges()', 'Gesamtprüfung direkt aufrufen')) v(q, label) loop
    total := total + 1; blocked := false;
    begin execute r.q; exception when others then blocked := true; end;
    if blocked then ok := ok + 1; end if;
    out := out || format(E'\nSchutz | %s: %s', r.label, case when blocked then 'verhindert OK' else 'MÖGLICH – FEHLER' end);
  end loop;
  total := total + 1;
  begin update public.profiles set featured_badges = array['helping_hand', 'active'], is_private = true where id = b; ok := ok + 1;
    out := out || E'\nProfil | 2 eigene Abzeichen hervorheben + privat stellen: OK';
  exception when others then out := out || E'\nProfil | Hervorheben FEHLER: ' || sqlerrm; end;
  execute 'reset role';

  -- Privatsphäre: Gast sieht beim privaten Profil B nur den Namen
  perform set_config('request.jwt.claims', '', true);
  execute 'set local role anon';
  total := total + 1;
  if exists (select 1 from public.profile_cards where id = b and username is not null and bio is null and xp is null and joined_at is null and avatar_path is null and featured_badges is null)
     and not exists (select 1 from public.user_badges where user_id = b) then ok := ok + 1; out := out || E'\nPrivatsphäre | Gast sieht bei privatem Profil nur den Namen: OK';
  else out := out || E'\nPrivatsphäre | FEHLER'; end if;
  execute 'reset role';
  if has_column_privilege('anon', 'public.profiles', 'bio', 'SELECT') then out := out || E'\nHinweis | 004b noch nicht ausgeführt – Bios sind direkt noch lesbar'; end if;

  raise exception E'SELBSTTEST: % von % OK%\n(Alle Testdaten wurden automatisch zurückgesetzt.)', ok, total, out;
end $$;
