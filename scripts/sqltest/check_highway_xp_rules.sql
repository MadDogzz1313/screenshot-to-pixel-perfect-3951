-- check_highway_xp_rules.sql — Selbsttest für finish_arcade_round(neon_highway) nach 033.
-- Kein Bestandteil der Migrations-Kette; nur für den lokalen sqltest-Lauf gegen den Supabase-Nachbau.
-- Prüft: Runde 1 (niedriger Score, neuer Highscore) = 40 + 50 = 90 XP; Runde 2 (niedriger als Runde 1,
-- kein neuer Highscore) = 40 XP; Runde 3 (Score ≥ 50 % von arcade_games.max_score, neuer Highscore)
-- = 75 + 50 = 125 XP; wiederholtes finish_arcade_round auf derselben Runde = already_processed mit
-- identischem XP (keine doppelte Gutschrift). Rollt am Ende alles zurück.
-- Aufruf (nach 013/016/019/033 im selben Lauf): bash scripts/sqltest/run.sh .. docs/migrations/033_xp_levelkurve.sql scripts/sqltest/check_highway_xp_rules.sql
begin;
create temp table t_result (nr serial, pruefung text, ok boolean) on commit drop;

insert into auth.users (id, email, raw_user_meta_data) values ('00000000-0000-4000-a000-0000000000d1', 'highway-test@example.invalid', '{"username":"highway_test"}');
insert into public.profiles (id) values ('00000000-0000-4000-a000-0000000000d1') on conflict (id) do nothing;
insert into public.coin_wallets (user_id, balance) values ('00000000-0000-4000-a000-0000000000d1', 0) on conflict (user_id) do update set balance = 0;
delete from public.arcade_scores where user_id = '00000000-0000-4000-a000-0000000000d1';
delete from public.arcade_xp_events where user_id = '00000000-0000-4000-a000-0000000000d1';
delete from public.arcade_rounds where user_id = '00000000-0000-4000-a000-0000000000d1';

create temp table t_round (id uuid) on commit drop; grant all on t_round to authenticated;

set local role authenticated;
do $$ begin perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-0000000000d1","role":"authenticated"}', true); end $$;

-- Runde 1: kurze, niedrige Runde -> erster Highscore -> 40 (keine 50 % von max_score 6000) + 50 (neuer Highscore) = 90
delete from t_round; insert into t_round select ((public.start_arcade_round('neon_highway'))->>'round_id')::uuid;
reset role;
update public.arcade_rounds set started_at = now() - interval '5 seconds' where id = (select id from t_round);
set local role authenticated;
do $$ begin perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-0000000000d1","role":"authenticated"}', true); end $$;
create temp table t_r1 as select public.finish_arcade_round((select id from t_round), 100, 1000) as r;
reset role;
insert into t_result (pruefung, ok) select 'Runde 1 (niedriger Score, erster Highscore): 90 XP (40 + 50)', (r->>'xp')::int = 90 and (r->>'new_high_score')::boolean = true from t_r1;

-- Runde 2: niedriger als Runde 1 -> kein neuer Highscore -> nur 40 XP
set local role authenticated;
do $$ begin perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-0000000000d1","role":"authenticated"}', true); end $$;
delete from t_round; insert into t_round select ((public.start_arcade_round('neon_highway'))->>'round_id')::uuid;
reset role;
update public.arcade_rounds set started_at = now() - interval '5 seconds' where id = (select id from t_round);
set local role authenticated;
do $$ begin perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-0000000000d1","role":"authenticated"}', true); end $$;
create temp table t_r2 as select public.finish_arcade_round((select id from t_round), 50, 1000) as r;
reset role;
insert into t_result (pruefung, ok) select 'Runde 2 (niedriger als Runde 1, kein neuer Highscore): 40 XP', (r->>'xp')::int = 40 and (r->>'new_high_score')::boolean = false from t_r2;

-- Runde 3: Score >= 50 % von max_score (6000 -> 3000+), schlägt den Highscore -> 75 + 50 = 125 XP
set local role authenticated;
do $$ begin perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-0000000000d1","role":"authenticated"}', true); end $$;
delete from t_round; insert into t_round select ((public.start_arcade_round('neon_highway'))->>'round_id')::uuid;
reset role;
update public.arcade_rounds set started_at = now() - interval '91 seconds' where id = (select id from t_round);
set local role authenticated;
do $$ begin perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-0000000000d1","role":"authenticated"}', true); end $$;
create temp table t_r3 as select public.finish_arcade_round((select id from t_round), 3100, 90000) as r;
reset role;
insert into t_result (pruefung, ok) select 'Runde 3 (Score >= 50 % max_score, neuer Highscore): 125 XP (75 + 50)',
  (r->>'xp')::int = 125 and (r->>'new_high_score')::boolean = true from t_r3;

-- Wiederholter finish_arcade_round-Aufruf auf Runde 3 -> already_processed, identisches XP, keine doppelte Gutschrift
set local role authenticated;
do $$ begin perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-0000000000d1","role":"authenticated"}', true); end $$;
create temp table t_r3b as select public.finish_arcade_round((select id from t_round), 3100, 90000) as r;
reset role;
insert into t_result (pruefung, ok) select 'Wiederholtes finish_arcade_round: already_processed, identisches XP (125)',
  (r->>'already_processed')::boolean = true and (r->>'xp')::int = 125 from t_r3b;

insert into t_result (pruefung, ok) select 'Keine doppelte XP-Gutschrift über alle 3 Runden (90+40+125=255, nicht 380)',
  (select coalesce(sum(amount), 0) from public.arcade_xp_events where user_id = '00000000-0000-4000-a000-0000000000d1' and game_id = 'neon_highway') = 255;

select nr, pruefung, ok from t_result order by nr;
rollback;
