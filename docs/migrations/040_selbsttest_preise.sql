-- 040_selbsttest_preise.sql
-- Nur lesend: prüft, ob 039 vollständig aktiv ist. Ändert keine Daten.
-- Ergebnis: jede Zeile sollte „OK“ zeigen.

with log as (select details from public.price_adjustments where id = '039_preise_x3'),
veh as (
  select bool_and(v.price = (b->>'price')::int * 3) as ok, count(*) as n
  from log, jsonb_array_elements(log.details->'vehicles_before') b
  join public.vehicle_skins v on v.id = b->>'id'
),
frm as (
  select bool_and(f.price = (b->>'price')::int * 3) as ok, count(*) as n
  from log, jsonb_array_elements(log.details->'frames_before') b
  join public.profile_frames f on f.id = b->>'id'
)
select 'Wiederholungsschutz-Eintrag vorhanden' as pruefung,
  case when exists (select 1 from log) then 'OK' else 'FEHLT – 039 ausführen' end as ergebnis
union all
select 'Fahrzeugpreise = 3 × alter Preis (' || (select n from veh) || ' Fahrzeuge)',
  case when (select ok from veh) then 'OK' else 'FEHLER' end
union all
select 'Profilrahmenpreise = 3 × alter Preis (' || (select n from frm) || ' Rahmen)',
  case when (select ok from frm) then 'OK' else 'FEHLER' end
union all
select 'Crew-Erstellung kostet 750',
  case when pg_get_functiondef('public.create_crew(text,text,text,boolean,integer,integer,text,text,timestamptz)'::regprocedure) like '%crew_cost constant integer := 750%' then 'OK' else 'FEHLER' end
union all
select 'Fundort-Freischaltung kostet 750',
  case when pg_get_functiondef('public.unlock_spot(uuid)'::regprocedure) like '%unlock_cost constant integer := 750%'
        and pg_get_functiondef('public.my_spot_unlock_preview(uuid)'::regprocedure) like '%else 750 end%' then 'OK' else 'FEHLER' end
union all
select 'Fundort-Kosten 750 erlaubt (alte Freischaltungen bleiben gültig)',
  case when pg_get_constraintdef((select oid from pg_constraint where conname = 'spot_unlocks_cost_check')) like '%750%' then 'OK' else 'FEHLER' end
union all
select 'Köderpreise (unverändert, nur Info)',
  coalesce((select string_agg(name || ' ' || price, ', ' order by sort) from public.fishing_baits), 'keine Köder-Tabelle');
