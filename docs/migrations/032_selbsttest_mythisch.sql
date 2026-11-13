-- 032_selbsttest_mythisch.sql
-- Selbsttest für 031 (nach 027 + 031). Rollt am Ende ALLES zurück. Jede Zeile sollte ok = true zeigen.
begin;
create temp table t_result (nr serial, pruefung text, ok boolean) on commit drop;
grant all on t_result to authenticated, anon;
grant usage, select on sequence t_result_nr_seq to authenticated, anon;
insert into auth.users (id, email, raw_user_meta_data) values ('00000000-0000-4000-a000-0000000000d1', 'mythic-test@example.invalid', '{"username":"mythic_test"}');
insert into public.profiles (id) values ('00000000-0000-4000-a000-0000000000d1') on conflict (id) do nothing;
insert into public.coin_wallets (user_id, balance) values ('00000000-0000-4000-a000-0000000000d1', 200) on conflict (user_id) do update set balance = 200;

insert into t_result (pruefung, ok) select 'Grundchancen 50/25/12/7,5/5/0,5 = 100 %',
  (select string_agg(id || ':' || base_chance::float8, ',' order by sort) from public.fishing_species)
  = 'kuestenbarsch:50,sonnenbarsch:25,neon_makrele:12,palmenschnapper:7.5,leonida_marlin:5,mythic_marlin:0.5'
  and (select sum(chance) from public.fishing_odds(null)) = 100;
insert into t_result (pruefung, ok) select 'Mythisch: 5.000 Coins', (select reward_coins from public.fishing_species where id = 'mythic_marlin') = 5000;
insert into t_result (pruefung, ok) select 'Köderpreise 12/25/50/87/125/150, je 3 Nutzungen',
  (select string_agg(price || ':' || uses, ',' order by sort) from public.fishing_baits) = '12:3,25:3,50:3,87:3,125:3,150:3';
insert into t_result (pruefung, ok) select 'Mythischer Köder: 49,7487/24,8744/11,9397/7,4623/4,9749/1 %, Summe 100',
  (select string_agg(round(chance, 4)::text, ',' order by sort) from public.fishing_odds('bait_mythic')) = '49.7487,24.8744,11.9397,7.4623,4.9749,1.0000'
  and abs((select sum(chance) from public.fishing_odds('bait_mythic')) - 100) < 0.0000001;
insert into t_result (pruefung, ok) select 'Andere Köder ×4 auf neuer Basis (legendär 5 → 20 %), Summe 100',
  (select chance from public.fishing_odds('bait_legendary') where rarity = 'legendary') = 20
  and (select bool_and(abs(s - 100) < 0.0000001) from (select sum(chance) s from public.fishing_baits b, public.fishing_odds(b.id) group by b.id) x);
insert into t_result (pruefung, ok) select 'Würfel: 0,9949 → legendär, 0,995 → mythisch',
  public.fishing_pick_species(null, 0.9949) = 'leonida_marlin' and public.fishing_pick_species(null, 0.995) = 'mythic_marlin'
  and public.fishing_pick_species('bait_mythic', 0.9899) = 'leonida_marlin' and public.fishing_pick_species('bait_mythic', 0.99) = 'mythic_marlin';

set local role authenticated;
do $$ begin perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-0000000000d1","role":"authenticated"}', true); end $$;
insert into t_result (pruefung, ok) select 'Mythischer Köder kostet genau 150', (r->>'charged')::int = 150 and (r->>'balance')::int = 50
from (select public.buy_fishing_bait('bait_mythic', '00000000-0000-4000-b000-0000000000d1') as r) x;
do $$ begin perform public.select_fishing_bait('bait_mythic'); end $$;

create temp table t_cast (n int, id uuid) on commit drop; grant all on t_cast to authenticated;
-- Wurf 1: verpasst → Nutzung trotzdem verbraucht (pro Angelversuch)
insert into t_cast select 1, (public.start_fishing_cast('00000000-0000-4000-c000-0000000000d1')->>'cast_id')::uuid;
do $$ begin perform public.reel_fishing_cast((select id from t_cast where n = 1), false); end $$;
insert into t_result (pruefung, ok) select 'Nach 1. Wurf (verpasst): 2/3 Nutzungen', (public.my_fishing_state()->'inventory'->0->>'uses_left')::int = 2;
-- Wurf 2: mythischer Fang (Fisch für den Test serverseitig gesetzt)
insert into t_cast select 2, (public.start_fishing_cast('00000000-0000-4000-c000-0000000000d2')->>'cast_id')::uuid;
reset role;
update public.fishing_casts set species_id = 'mythic_marlin', cast_at = clock_timestamp() - ((bite_delay_ms + 200) * interval '1 millisecond') where id = (select id from t_cast where n = 2);
set local role authenticated;
insert into t_result (pruefung, ok) select 'Mythischer Fang: +5.000 Coins, Köder 1/3',
  r->>'species_id' = 'mythic_marlin' and (r->>'coins')::int = 5000 and (r->>'balance')::int = 5050 and (r->>'bait_uses_left')::int = 1
from (select public.reel_fishing_cast((select id from t_cast where n = 2)) as r) x;
insert into t_result (pruefung, ok) select 'Wiederholtes Einholen: keine zweite Gutschrift',
  (r->>'already_processed')::boolean and (r->>'balance')::int = 5050 from (select public.reel_fishing_cast((select id from t_cast where n = 2)) as r) x;
-- Wurf 3: dritte Nutzung, danach ist der Köder weg und abgewählt
insert into t_cast select 3, (public.start_fishing_cast('00000000-0000-4000-c000-0000000000d3')->>'cast_id')::uuid;
do $$ begin perform public.reel_fishing_cast((select id from t_cast where n = 3), false); end $$;
insert into t_result (pruefung, ok) select 'Nach 3 Würfen: Köder aufgebraucht und abgewählt',
  jsonb_array_length(public.my_fishing_state()->'inventory') = 0 and public.my_fishing_state()->>'selected_bait_id' is null;
insert into t_result (pruefung, ok) select 'Badge „Mythischer Fang“ im Profil sichtbar',
  exists (select 1 from public.user_badges where user_id = '00000000-0000-4000-a000-0000000000d1' and badge_id = 'mythic_catch');
insert into t_result (pruefung, ok) select 'Sammlung zählt 1 mythischen Fang', (public.my_fishing_state()->'collection'->>'mythic_marlin')::int = 1;
reset role;
-- Zweiter mythischer Fang: Badge bleibt einmalig
insert into public.fishing_casts (user_id, client_nonce, berlin_day, species_id, roll, bite_delay_ms, window_ms)
values ('00000000-0000-4000-a000-0000000000d1', gen_random_uuid(), public.fishing_berlin_day(now()) - 1, 'mythic_marlin', 0.999, 2000, 1500);
update public.fishing_casts set status = 'caught' where user_id = '00000000-0000-4000-a000-0000000000d1' and status = 'pending';
insert into t_result (pruefung, ok) select 'Badge genau einmal vergeben',
  (select count(*) from public.user_badges where user_id = '00000000-0000-4000-a000-0000000000d1' and badge_id = 'mythic_catch') = 1;
insert into t_result (pruefung, ok) select 'Genau eine 5.000-Gutschrift im Ledger',
  (select count(*) from public.coin_ledger where user_id = '00000000-0000-4000-a000-0000000000d1' and reason = 'fishing_catch' and delta = 5000) = 1;
insert into t_result (pruefung, ok) select 'Tageslimit unverändert 15', (select (public.my_fishing_state()->>'limit')::int) = 15;

select nr, pruefung, ok from t_result order by nr;
rollback;
