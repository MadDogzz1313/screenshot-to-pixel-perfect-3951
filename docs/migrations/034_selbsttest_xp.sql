-- 034_selbsttest_xp.sql – Selbsttest für 033. Rollt am Ende ALLES zurück. Jede Zeile sollte ok = true zeigen.
begin;
create temp table t_result (nr serial, pruefung text, ok boolean) on commit drop;
insert into t_result (pruefung, ok) select 'XP-Bedarf L1/5/10/20/50/99 = 400/1000/1250/1550/1900/2150',
  (select string_agg(xp_step::text, ',' order by level) from public.leonida_level_curve where level in (1, 5, 10, 20, 50, 99)) = '400,1000,1250,1550,1900,2150';
insert into t_result (pruefung, ok) select 'Gesamt-XP für L2/5/6/10/20/50/100 = 400/2750/3750/8400/22350/74100/175550',
  (select string_agg(xp_total::text, ',' order by level) from public.leonida_level_curve where level in (2, 5, 6, 10, 20, 50, 100)) = '400,2750,3750,8400,22350,74100,175550';
insert into t_result (pruefung, ok) select 'Bedarf steigt, Zuwachs wird kleiner',
  (select bool_and(d >= 0) from (select xp_step - lag(xp_step) over (order by level) d from public.leonida_level_curve where level < 100) x where d is not null)
  and (select xp_step from public.leonida_level_curve where level = 2) - (select xp_step from public.leonida_level_curve where level = 1)
    > (select xp_step from public.leonida_level_curve where level = 51) - (select xp_step from public.leonida_level_curve where level = 50);
insert into t_result (pruefung, ok) select 'Level aus XP: 0→1, 399→1, 400→2, 3750→6, 175550→100',
  public.leonida_level_from_xp(0) = 1 and public.leonida_level_from_xp(399) = 1 and public.leonida_level_from_xp(400) = 2
  and public.leonida_level_from_xp(3750) = 6 and public.leonida_level_from_xp(175550) = 100;
insert into t_result (pruefung, ok) select 'Übertragung: kein Nutzer verliert Level oder XP',
  coalesce(bool_and(m.new_xp >= m.old_xp and public.leonida_level_from_xp(m.new_xp) >= m.old_level), true) from public.xp_curve_migration m;

insert into auth.users (id, email, raw_user_meta_data) values ('00000000-0000-4000-a000-0000000000c1', 'xp-test@example.invalid', '{"username":"xp_test"}');
insert into public.profiles (id) values ('00000000-0000-4000-a000-0000000000c1') on conflict (id) do nothing;
update public.profiles set xp = 0 where id = '00000000-0000-4000-a000-0000000000c1';
insert into public.coin_wallets (user_id, balance) values ('00000000-0000-4000-a000-0000000000c1', 0) on conflict (user_id) do update set balance = 0;
-- Große Gutschrift: 0 → 8.400 XP = Level 10 → 9 Levelaufstiege × 500 Coins, überschüssige XP bleiben
update public.profiles set xp = 8450 where id = '00000000-0000-4000-a000-0000000000c1';
insert into t_result (pruefung, ok) select 'Mehrere Levelaufstiege auf einmal: L10, 9 × 500 Coins',
  public.leonida_level_from_xp((select xp from public.profiles where id = '00000000-0000-4000-a000-0000000000c1')) = 10
  and (select balance from public.coin_wallets where user_id = '00000000-0000-4000-a000-0000000000c1') = 4500
  and (select count(*) from public.level_coin_rewards where user_id = '00000000-0000-4000-a000-0000000000c1') = 9;
update public.profiles set xp = 8450 where id = '00000000-0000-4000-a000-0000000000c1';
update public.profiles set xp = 8500 where id = '00000000-0000-4000-a000-0000000000c1';
insert into t_result (pruefung, ok) select 'Keine doppelte Level-Belohnung', (select balance from public.coin_wallets where user_id = '00000000-0000-4000-a000-0000000000c1') = 4500;
insert into t_result (pruefung, ok) select 'Fishing-XP 25/40/60/100/150/500',
  (select string_agg(reward_xp::text, ',' order by sort) from public.fishing_species) = '25,40,60,100,150,500';

-- Fang mit voller XP (auch über dem alten 600er-Limit)
insert into public.arcade_xp_events (user_id, round_id, game_id, amount) select '00000000-0000-4000-a000-0000000000c1', null, 'leonida_fishing', 600;
grant all on t_result to authenticated; grant usage, select on sequence t_result_nr_seq to authenticated;
set local role authenticated;
do $$ begin perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-0000000000c1","role":"authenticated"}', true); end $$;
create temp table t_cast (id uuid) on commit drop; grant all on t_cast to authenticated;
insert into t_cast select (public.start_fishing_cast('00000000-0000-4000-c000-0000000000c1')->>'cast_id')::uuid;
reset role;
update public.fishing_casts set species_id = 'mythic_marlin', cast_at = clock_timestamp() - ((bite_delay_ms + 200) * interval '1 millisecond') where id = (select id from t_cast);
create temp table t_xp as select xp from public.profiles where id = '00000000-0000-4000-a000-0000000000c1';
set local role authenticated;
insert into t_result (pruefung, ok) select 'Mythischer Fang: +500 XP trotz altem Tageslimit', (r->>'xp')::int = 500 from (select public.reel_fishing_cast((select id from t_cast)) as r) x;
insert into t_result (pruefung, ok) select 'Wiederholtes Einholen: keine zweiten XP', (r->>'already_processed')::boolean and (r->>'xp')::int = 500 from (select public.reel_fishing_cast((select id from t_cast)) as r) x;
reset role;
insert into t_result (pruefung, ok) select 'Profil-XP genau +500', (select xp from public.profiles where id = '00000000-0000-4000-a000-0000000000c1') = (select xp from t_xp) + 500;
select nr, pruefung, ok from t_result order by nr;
rollback;
