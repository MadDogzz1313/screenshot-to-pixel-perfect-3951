-- tscheck_sql039_server_charges_selftest.sql
-- Ad-hoc verification (NOT part of docs/migrations) that the server-side RPCs touched by
-- SQL 039 charge exactly the new coin amounts and reject underfunded attempts without
-- losing coins. Run AFTER 039 has already been applied (and after
-- tscheck_sql039_legacy_fixture_before.sql was applied beforehand, so the first check here
-- proves that fixture's wallet/ownership rows were left untouched by 039).
-- Runs against the throwaway leonida_sqltest DB built by scripts/sqltest/run.sh.
-- Everything happens inside begin;...rollback; like the project's own selftest migrations
-- (e.g. 026_selbsttest_garage.sql) — nothing persists.
begin;
create temp table t_result (nr serial, pruefung text, ok boolean) on commit drop;
grant all on t_result to authenticated, anon;
grant usage, select on sequence t_result_nr_seq to authenticated, anon;

insert into t_result (pruefung, ok)
select 'Bestehender Besitz/Guthaben von der Migration unberuehrt',
  (select balance from public.coin_wallets where user_id = '10000000-0000-4000-a000-000000000009') = 4242
  and (select price_paid from public.user_vehicle_skins where user_id = '10000000-0000-4000-a000-000000000009' and skin_id = 'circuit') = 600
  and (select price_paid from public.user_profile_frames where user_id = '10000000-0000-4000-a000-000000000009' and frame_id = 'neon_sunset') = 500;

-- Actor + foreign spot author
insert into auth.users (id, email, raw_user_meta_data) values
  ('10000000-0000-4000-a000-000000000001', 'tscheck-actor@example.invalid', '{"username":"tscheck_actor"}'),
  ('10000000-0000-4000-a000-000000000002', 'tscheck-spotauthor@example.invalid', '{"username":"tscheck_author"}')
on conflict (id) do nothing;
insert into public.profiles (id) values
  ('10000000-0000-4000-a000-000000000001'), ('10000000-0000-4000-a000-000000000002')
on conflict (id) do nothing;

insert into public.spots (id, author_id, title, category, area, x, y, description, status) values
  ('20000000-0000-4000-a000-000000000001', '10000000-0000-4000-a000-000000000002', 'tscheck spot 1', 'place', 'Area', 10, 10, 'tscheck description', 'approved'),
  ('20000000-0000-4000-a000-000000000002', '10000000-0000-4000-a000-000000000002', 'tscheck spot 2', 'place', 'Area', 11, 11, 'tscheck description', 'approved'),
  ('20000000-0000-4000-a000-000000000003', '10000000-0000-4000-a000-000000000002', 'tscheck spot 3', 'place', 'Area', 12, 12, 'tscheck description', 'approved'),
  ('20000000-0000-4000-a000-000000000004', '10000000-0000-4000-a000-000000000002', 'tscheck spot 4', 'place', 'Area', 13, 13, 'tscheck description', 'approved'),
  ('20000000-0000-4000-a000-000000000005', '10000000-0000-4000-a000-000000000002', 'tscheck spot 5', 'place', 'Area', 14, 14, 'tscheck description', 'approved'),
  ('20000000-0000-4000-a000-000000000006', '10000000-0000-4000-a000-000000000002', 'tscheck spot 6', 'place', 'Area', 15, 15, 'tscheck description', 'approved'),
  ('20000000-0000-4000-a000-000000000007', '10000000-0000-4000-a000-000000000002', 'tscheck spot 7', 'place', 'Area', 16, 16, 'tscheck description', 'approved')
on conflict (id) do nothing;

insert into public.coin_wallets (user_id, balance) values ('10000000-0000-4000-a000-000000000001', 10000)
on conflict (user_id) do update set balance = 10000;

set local role authenticated;
do $$ begin perform set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-a000-000000000001","role":"authenticated"}', true); end $$;

-- First 5 foreign spots free
insert into t_result (pruefung, ok)
select 'Fundort 1-5 kostenlos', (
  select bool_and(cost = 0) and bool_and(balance = 10000) from (
    select * from public.unlock_spot('20000000-0000-4000-a000-000000000001') union all
    select * from public.unlock_spot('20000000-0000-4000-a000-000000000002') union all
    select * from public.unlock_spot('20000000-0000-4000-a000-000000000003') union all
    select * from public.unlock_spot('20000000-0000-4000-a000-000000000004') union all
    select * from public.unlock_spot('20000000-0000-4000-a000-000000000005')
  ) q);

insert into t_result (pruefung, ok)
select '6. Fundort kostet 750', cost = 750 and balance = 9250 from public.unlock_spot('20000000-0000-4000-a000-000000000006');

insert into t_result (pruefung, ok)
select 'Erneutes Freischalten desselben Fundorts kostet 0', cost = 0 and balance = 9250
from public.unlock_spot('20000000-0000-4000-a000-000000000006');

reset role;
update public.coin_wallets set balance = 749 where user_id = '10000000-0000-4000-a000-000000000001';
set local role authenticated;
do $$ begin perform set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-a000-000000000001","role":"authenticated"}', true); end $$;
do $$ begin perform public.unlock_spot('20000000-0000-4000-a000-000000000007');
  insert into t_result (pruefung, ok) values ('Freischaltung bei 749 Coins schlaegt fehl', false);
exception when others then insert into t_result (pruefung, ok) values ('Freischaltung bei 749 Coins schlaegt fehl', sqlerrm = 'INSUFFICIENT_COINS'); end $$;
reset role;
insert into t_result (pruefung, ok)
select 'Kein Coinverlust bei fehlgeschlagener Freischaltung', balance = 749
from public.coin_wallets where user_id = '10000000-0000-4000-a000-000000000001';

-- create_crew: 749 fails, 750 succeeds, exactly 750 debited
set local role authenticated;
do $$ begin perform set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-a000-000000000001","role":"authenticated"}', true); end $$;
do $$ begin perform public.create_crew('freeroam', 'playstation', 'de', false, 4, 0, 'tscheck', 'now');
  insert into t_result (pruefung, ok) values ('Crew bei 749 Coins schlaegt fehl (keine Verluste)', false);
exception when others then insert into t_result (pruefung, ok) values ('Crew bei 749 Coins schlaegt fehl (keine Verluste)', sqlerrm = 'INSUFFICIENT_COINS'); end $$;
reset role;
insert into t_result (pruefung, ok)
select 'Nach fehlgeschlagener Crew-Erstellung weiterhin 749 Coins', balance = 749
from public.coin_wallets where user_id = '10000000-0000-4000-a000-000000000001';

update public.coin_wallets set balance = 750 where user_id = '10000000-0000-4000-a000-000000000001';
set local role authenticated;
do $$ begin perform set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-a000-000000000001","role":"authenticated"}', true); end $$;
insert into t_result (pruefung, ok)
select 'Crew-Erstellung zieht exakt 750 ab', true from (select public.create_crew('freeroam', 'playstation', 'de', false, 4, 0, 'tscheck', 'now')) c;
reset role;
insert into t_result (pruefung, ok)
select 'Crew-Erstellung zieht exakt 750 ab (Guthaben)', balance = 0
from public.coin_wallets where user_id = '10000000-0000-4000-a000-000000000001';

-- vehicle skin purchase: circuit now costs 1800
update public.coin_wallets set balance = 1800 where user_id = '10000000-0000-4000-a000-000000000001';
set local role authenticated;
do $$ begin perform set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-a000-000000000001","role":"authenticated"}', true); end $$;
insert into t_result (pruefung, ok)
select 'Neon Circuit kostet neu 1800 und zieht genau einmal ab', charged = 1800 and balance = 0 and not already_owned
from public.buy_vehicle_skin('circuit');
insert into t_result (pruefung, ok)
select 'Zweiter Kauf desselben Fahrzeugs ohne erneute Abbuchung', charged = 0 and already_owned
from public.buy_vehicle_skin('circuit');

-- profile frame purchase: neon_sunset now costs 1500
reset role;
update public.coin_wallets set balance = 1500 where user_id = '10000000-0000-4000-a000-000000000001';
set local role authenticated;
do $$ begin perform set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-a000-000000000001","role":"authenticated"}', true); end $$;
insert into t_result (pruefung, ok)
select 'Profilrahmen Neon Sunset kostet neu 1500', (f->>'charged')::int = 1500 and (f->>'balance')::int = 0 and not (f->>'already_owned')::boolean
from (select public.buy_profile_frame('neon_sunset') as f) q;

reset role;
select nr, pruefung, ok from t_result order by nr;
rollback;
