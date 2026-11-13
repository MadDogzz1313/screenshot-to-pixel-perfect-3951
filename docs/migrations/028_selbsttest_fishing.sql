-- 028_selbsttest_fishing.sql
-- HINWEIS: Gilt für den Stand von 027. Nach 031 (neue Chancen, Mythisch) stattdessen 032_selbsttest_mythisch.sql verwenden.
-- Selbsttest für 027 (Leonida Fishing v2). Rollt am Ende ALLES zurück.
-- Optional in Lovable ausführen (nach 027). Ergebnis: eine Zeile je Prüfung mit ok = true.
begin;
create temp table t_result (nr serial, pruefung text, ok boolean) on commit drop;
grant all on t_result to authenticated, anon;
grant usage, select on sequence t_result_nr_seq to authenticated, anon;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-a000-0000000000f1', 'fishing-test@example.invalid', '{"username":"fishing_test"}');
insert into public.profiles (id) values ('00000000-0000-4000-a000-0000000000f1') on conflict (id) do nothing;
insert into public.coin_wallets (user_id, balance) values ('00000000-0000-4000-a000-0000000000f1', 300)
on conflict (user_id) do update set balance = 300;

-- Katalog + Wahrscheinlichkeiten
insert into t_result (pruefung, ok) select 'Grundchancen 50 / 25 / 12,5 / 5 / 7,5 und Belohnungen 25/50/100/175/250',
  (select string_agg(id || ':' || base_chance::float8 || ':' || reward_coins, ',' order by sort) from public.fishing_species)
  = 'kuestenbarsch:50:25,sonnenbarsch:25:50,neon_makrele:12.5:100,palmenschnapper:5:175,leonida_marlin:7.5:250';
insert into t_result (pruefung, ok) select 'Köderpreise 12/25/50/87/125, je 3 Nutzungen',
  (select string_agg(id || ':' || price || ':' || uses, ',' order by sort) from public.fishing_baits)
  = 'bait_common:12:3,bait_uncommon:25:3,bait_rare:50:3,bait_epic:87:3,bait_legendary:125:3';
insert into t_result (pruefung, ok) select 'Ohne Köder = Grundchancen, Summe 100 %',
  (select sum(chance) = 100 and bool_and(chance = (select base_chance from public.fishing_species s where s.id = o.species_id)) from public.fishing_odds(null) o);
insert into t_result (pruefung, ok)
select 'Köder ' || b.id || ': Ziel ×4 (max 100 %), Summe 100 %',
  abs((select sum(chance) from public.fishing_odds(b.id)) - 100) < 0.000001
  and (select chance from public.fishing_odds(b.id) where rarity = b.target_rarity)
      = least(100, (select base_chance * 4 from public.fishing_species where rarity = b.target_rarity))
from public.fishing_baits b order by b.sort;
insert into t_result (pruefung, ok) select 'Legendärer Köder: 37,84 / 18,92 / 9,46 / 3,78 / 30,00 %',
  (select string_agg(round(chance, 2)::text, ',' order by sort) from public.fishing_odds('bait_legendary')) = '37.84,18.92,9.46,3.78,30.00';
insert into t_result (pruefung, ok) select 'Würfel-Zuordnung an den Grenzen korrekt',
  public.fishing_pick_species(null, 0) = 'kuestenbarsch' and public.fishing_pick_species(null, 0.4999) = 'kuestenbarsch'
  and public.fishing_pick_species(null, 0.5) = 'sonnenbarsch' and public.fishing_pick_species(null, 0.8749) = 'neon_makrele'
  and public.fishing_pick_species(null, 0.92) = 'palmenschnapper' and public.fishing_pick_species(null, 0.9999) = 'leonida_marlin'
  and public.fishing_pick_species('bait_legendary', 0.70) = 'leonida_marlin' and public.fishing_pick_species('bait_common', 0.99) = 'kuestenbarsch';
insert into t_result (pruefung, ok)
select 'Simulation 200.000 Würfe mit legendärem Köder ≈ Chancen (±0,5 %)', count(*) = 5 and bool_and(abs(share - chance) < 0.5)
from (select o.chance, count(*) * 100.0 / 200000 as share
      from (select public.fishing_pick_species('bait_legendary', random()) as sp from generate_series(1, 200000)) x
      join public.fishing_odds('bait_legendary') o on o.species_id = x.sp group by o.species_id, o.chance) y;

-- Europe/Berlin inkl. Sommerzeit
insert into t_result (pruefung, ok) select 'Tageswechsel Europe/Berlin (Winter/Sommer/Umstellung)',
  public.fishing_berlin_day('2026-01-10 22:59+00') = '2026-01-10' and public.fishing_berlin_day('2026-01-10 23:00+00') = '2026-01-11'
  and public.fishing_berlin_day('2026-07-01 21:59+00') = '2026-07-01' and public.fishing_berlin_day('2026-07-01 22:00+00') = '2026-07-02'
  and public.fishing_next_reset('2026-03-28 12:00+00') = '2026-03-28 23:00+00'
  and public.fishing_next_reset('2026-03-29 12:00+00') = '2026-03-29 22:00+00'
  and public.fishing_next_reset('2026-10-25 12:00+00') = '2026-10-25 23:00+00';

set local role authenticated;
do $$ begin perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-0000000000f1","role":"authenticated"}', true); end $$;

-- Köder kaufen
insert into t_result (pruefung, ok) select 'Köderkauf zieht genau 125 ab, 3 Nutzungen',
  (r->>'charged')::int = 125 and (r->>'balance')::int = 175 and (r->>'uses_left')::int = 3
from (select public.buy_fishing_bait('bait_legendary', '00000000-0000-4000-b000-000000000001') as r) x;
insert into t_result (pruefung, ok) select 'Wiederholter Kauf-Request (gleiche Nonce): kein zweiter Abzug',
  (r->>'charged')::int = 0 and (r->>'balance')::int = 175 and (r->>'already_processed')::boolean
from (select public.buy_fishing_bait('bait_legendary', '00000000-0000-4000-b000-000000000001') as r) x;
do $$ begin perform public.buy_fishing_bait('bait_legendary', '00000000-0000-4000-b000-000000000002'); perform public.buy_fishing_bait('bait_legendary', '00000000-0000-4000-b000-000000000003');
  insert into t_result (pruefung, ok) values ('Zu wenig Coins wird abgelehnt', false);
exception when others then insert into t_result (pruefung, ok) values ('Zu wenig Coins wird abgelehnt', sqlerrm = 'INSUFFICIENT_COINS'); end $$;
do $$ begin perform public.select_fishing_bait('bait_epic');
  insert into t_result (pruefung, ok) values ('Nicht vorhandener Köder kann nicht gewählt werden', false);
exception when others then insert into t_result (pruefung, ok) values ('Nicht vorhandener Köder kann nicht gewählt werden', sqlerrm = 'BAIT_EMPTY'); end $$;
insert into t_result (pruefung, ok) select 'Köder auswählen', public.select_fishing_bait('bait_legendary') = 'bait_legendary';

-- Wurf 1: verpasst → Versuch zählt, Köder bleibt
create temp table t_cast (n int, id uuid) on commit drop; grant all on t_cast to authenticated;
insert into t_cast select 1, (public.start_fishing_cast('00000000-0000-4000-c000-000000000001')->>'cast_id')::uuid;
insert into t_result (pruefung, ok) select 'Fisch des laufenden Wurfs ist geheim (keine Art im Ergebnis, Tabelle nicht lesbar)',
  public.start_fishing_cast('00000000-0000-4000-c000-000000000001')->>'species_id' is null;
do $$ begin perform 1 from public.fishing_casts limit 1;
  insert into t_result (pruefung, ok) values ('Würfe nicht direkt lesbar', false);
exception when others then insert into t_result (pruefung, ok) values ('Würfe nicht direkt lesbar', true); end $$;
insert into t_result (pruefung, ok) select 'Neuladen/zweiter Start liefert denselben Wurf (kein Neuwürfeln)',
  (public.start_fishing_cast('00000000-0000-4000-c000-000000000099')->>'cast_id')::uuid = (select id from t_cast where n = 1);
insert into t_result (pruefung, ok) select 'Zu frühes Einholen: Fisch entkommt',
  r->>'status' = 'escaped' and r->>'outcome' = 'too_early' and (r->>'coins')::int = 0
from (select public.reel_fishing_cast((select id from t_cast where n = 1)) as r) x;
insert into t_result (pruefung, ok) select 'Nach Fehlversuch: Köder hat weiter 3/3 Nutzungen',
  (public.my_fishing_state()->'inventory'->0->>'uses_left')::int = 3 and (public.my_fishing_state()->>'used')::int = 1;

-- Würfe 2–4: erfolgreich → je Belohnung, Köder 3 → 0, danach weg und abgewählt
do $$
declare i int; cid uuid; ok boolean := true; bal_before bigint; r jsonb; s public.fishing_species;
begin
  for i in 2..4 loop
    cid := (public.start_fishing_cast(('00000000-0000-4000-c000-00000000000' || i)::uuid)->>'cast_id')::uuid;
    insert into t_cast values (i, cid);
    reset role;
    update public.fishing_casts set cast_at = clock_timestamp() - ((bite_delay_ms + 200) * interval '1 millisecond') where id = cid;
    select w.balance into bal_before from public.coin_wallets w where w.user_id = '00000000-0000-4000-a000-0000000000f1';
    set local role authenticated;
    r := public.reel_fishing_cast(cid);
    select * into s from public.fishing_species where id = r->>'species_id';
    ok := ok and r->>'status' = 'caught' and (r->>'coins')::int = s.reward_coins and (r->>'balance')::bigint = bal_before + s.reward_coins
             and (r->>'bait_uses_left')::int = 4 - i;
  end loop;
  insert into t_result (pruefung, ok) values ('3 Fänge mit Köder: richtige Coins, Nutzungen 2/3 → 1/3 → 0/3', ok);
end $$;
insert into t_result (pruefung, ok) select 'Verbrauchter Köder verschwindet und ist abgewählt',
  jsonb_array_length(public.my_fishing_state()->'inventory') = 0 and public.my_fishing_state()->>'selected_bait_id' is null;
insert into t_result (pruefung, ok) select 'Wiederholtes Einholen: keine doppelte Belohnung',
  (r->>'already_processed')::boolean and r->>'status' = 'caught'
from (select public.reel_fishing_cast((select id from t_cast where n = 2)) as r) x;
reset role;
insert into t_result (pruefung, ok) select 'Genau 3 Fang-Gutschriften + 3 XP-Einträge im Ledger',
  (select count(*) from public.coin_ledger where user_id = '00000000-0000-4000-a000-0000000000f1' and reason = 'fishing_catch') = 3
  and (select count(*) from public.arcade_xp_events where user_id = '00000000-0000-4000-a000-0000000000f1' and fishing_cast_id is not null) = 3;
set local role authenticated;
insert into t_result (pruefung, ok) select 'Sammlung zählt 3 Fänge',
  (select sum(value::int) = 3 from jsonb_each_text((select public.my_fishing_state()->'collection')));

-- Tageslimit 15 (Würfe von gestern zählen nicht)
reset role;
insert into public.fishing_casts (user_id, client_nonce, berlin_day, species_id, roll, bite_delay_ms, window_ms, status, resolved_at)
select '00000000-0000-4000-a000-0000000000f1', gen_random_uuid(), public.fishing_berlin_day(now()) - 1, 'kuestenbarsch', 0, 2000, 1500, 'escaped', now() - interval '1 day'
from generate_series(1, 5);
insert into public.fishing_casts (user_id, client_nonce, berlin_day, species_id, roll, bite_delay_ms, window_ms, status, resolved_at)
select '00000000-0000-4000-a000-0000000000f1', gen_random_uuid(), public.fishing_berlin_day(now()), 'kuestenbarsch', 0, 2000, 1500, 'escaped', now()
from generate_series(1, 10);
set local role authenticated;
insert into t_result (pruefung, ok) select 'Zähler 14/15 (gestern zählt nicht)', (public.my_fishing_state()->>'used')::int = 14;
insert into t_result (pruefung, ok) select '15. Wurf erlaubt', (public.start_fishing_cast('00000000-0000-4000-c000-000000000015')->>'used')::int = 15;
do $$ begin perform public.reel_fishing_cast((public.start_fishing_cast('00000000-0000-4000-c000-000000000015')->>'cast_id')::uuid, false); end $$;
do $$ begin perform public.start_fishing_cast('00000000-0000-4000-c000-000000000016');
  insert into t_result (pruefung, ok) values ('16. Wurf wird abgelehnt (FISHING_DAILY_LIMIT)', false);
exception when others then insert into t_result (pruefung, ok) values ('16. Wurf wird abgelehnt (FISHING_DAILY_LIMIT)', sqlerrm = 'FISHING_DAILY_LIMIT'); end $$;
reset role;
update public.fishing_casts set berlin_day = berlin_day - 1 where user_id = '00000000-0000-4000-a000-0000000000f1';
set local role authenticated;
insert into t_result (pruefung, ok) select 'Nächster Tag: Limit wieder frei (0/15)', (public.my_fishing_state()->>'used')::int = 0;

-- Gäste
reset role;
set local role anon;
do $$ begin perform set_config('request.jwt.claims', '{"role":"anon"}', true); end $$;
do $$ begin perform public.start_fishing_cast(gen_random_uuid());
  insert into t_result (pruefung, ok) values ('Gäste können nicht angeln', false);
exception when others then insert into t_result (pruefung, ok) values ('Gäste können nicht angeln', true); end $$;
reset role;

select nr, pruefung, ok from t_result order by nr;
rollback;
