-- 005_xp_korrektur_netterer.sql — ENTWURF, erst nach ausdrücklicher Freigabe ausführen.
-- Korrigiert das Konto "netterer" von der alten XP-Regel (100 + 100 Bonus) auf die neue Regel (50 pro Freigabe).
-- Bricht OHNE Änderung ab, wenn die Daten nicht exakt dem erwarteten Stand entsprechen.

-- SCHRITT 1 (nur lesen, ändert nichts): bisherige XP-Einträge anzeigen
-- select e.reason, e.amount, e.ref_id, e.created_at, s.title, s.status
-- from public.xp_events e left join public.spots s on s.id = e.ref_id
-- where e.user_id = (select id from public.profiles where username = 'netterer') order by e.created_at;

-- SCHRITT 2 (Korrektur mit Sicherheitsprüfung)
do $$
declare u uuid; cur_xp int; ev_sum int; n_valid int; n_other int; new_sum int;
begin
  select id, xp into u, cur_xp from public.profiles where username = 'netterer';
  if u is null then raise exception 'Abbruch: Konto netterer nicht gefunden'; end if;

  select coalesce(sum(amount), 0) into ev_sum from public.xp_events where user_id = u;
  if ev_sum <> cur_xp then raise exception 'Abbruch: Profil-XP (%) passt nicht zu den XP-Einträgen (%)', cur_xp, ev_sum; end if;

  -- genau zwei gültige Fundort-Freigaben (Fundort existiert, gehört dem Konto, ist/war freigegeben)
  select count(*) into n_valid from public.xp_events e join public.spots s on s.id = e.ref_id
  where e.user_id = u and e.reason = 'spot_approved' and s.author_id = u and s.status in ('approved', 'hidden');
  if n_valid <> 2 then raise exception 'Abbruch: % statt genau 2 gültige Fundort-Freigaben', n_valid; end if;
  if (select count(*) from public.xp_events where user_id = u and reason = 'spot_approved') <> 2 then
    raise exception 'Abbruch: es gibt ungültige spot_approved-Einträge';
  end if;

  -- keine anderen XP-Arten (z. B. Fotos/Korrekturen) – sonst nicht automatisch korrigieren
  select count(*) into n_other from public.xp_events
  where user_id = u and reason not in ('spot_approved', 'first_spot_bonus', 'milestone_5', 'milestone_25', 'milestone_100');
  if n_other > 0 then raise exception 'Abbruch: % weitere XP-Einträge anderer Art vorhanden', n_other; end if;

  delete from public.xp_events where user_id = u and reason in ('first_spot_bonus', 'milestone_5', 'milestone_25', 'milestone_100');
  update public.xp_events set amount = 50 where user_id = u and reason = 'spot_approved';
  select coalesce(sum(amount), 0) into new_sum from public.xp_events where user_id = u;
  if new_sum <> 100 then raise exception 'Abbruch: neue Summe wäre % statt 100', new_sum; end if;
  update public.profiles set xp = new_sum where id = u;
  raise notice 'XP-Korrektur erfolgreich: % -> % XP', cur_xp, new_sum;
end $$;
