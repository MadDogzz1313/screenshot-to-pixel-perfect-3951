-- 038_selbsttest_werbebelohnungen.sql – Selbsttest für 037. Rollt am Ende ALLES zurück. Jede Zeile sollte ok = true zeigen.
begin;
create temp table t_result (nr serial, pruefung text, ok boolean) on commit drop;
create temp table t_val (k text primary key, v jsonb) on commit drop;
grant all on t_result, t_val to authenticated, anon; grant usage, select on sequence t_result_nr_seq to authenticated, anon;
insert into auth.users (id, email, raw_user_meta_data) values ('00000000-0000-4000-a000-0000000000e1', 'ad-test@example.invalid', '{"username":"ad_player_t"}');
insert into public.profiles (id) values ('00000000-0000-4000-a000-0000000000e1') on conflict (id) do nothing;
insert into public.push_config (id, dispatch_url, secret) values (1, 'https://example.invalid', repeat('s', 40))
  on conflict (id) do update set secret = excluded.secret;
update public.ad_reward_config set mode = 'test' where id = 1;

set local role authenticated;
do $$ begin perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-0000000000e1","role":"authenticated"}', true); end $$;
do $$ declare s jsonb; r jsonb; ok boolean; st jsonb; begin
  -- abgebrochener Versuch verbraucht nichts
  s := public.start_ad_reward('fishing_bonus_casts');
  insert into t_result (pruefung, ok) values ('Abgebrochene Werbung: kein Limit verbraucht', (public.my_ad_reward_state()->'bonus'->>'used')::int = 0);
  -- Bonus 1 + doppeltes Reward-Ereignis
  s := public.start_ad_reward('fishing_bonus_casts');
  r := public.claim_ad_reward_test((s->>'session_id')::uuid);
  insert into t_result (pruefung, ok) values ('Werbung 1: genau +5 Bonus-Angelversuche', (r->'reward'->>'bonus_casts')::int = 5);
  r := public.claim_ad_reward_test((s->>'session_id')::uuid);
  insert into t_result (pruefung, ok) values ('Doppeltes Ereignis: keine zweite Gutschrift', (r->>'already_processed')::boolean and (select bonus_casts from public.fishing_state where user_id = auth.uid()) = 5);
  s := public.start_ad_reward('fishing_bonus_casts'); r := public.claim_ad_reward_test((s->>'session_id')::uuid);
  insert into t_result (pruefung, ok) values ('Werbung 2: 10 Bonus, 2/2 verbraucht', (select bonus_casts from public.fishing_state where user_id = auth.uid()) = 10 and (public.my_ad_reward_state()->'bonus'->>'used')::int = 2);
  ok := false; begin perform public.start_ad_reward('fishing_bonus_casts'); exception when others then ok := sqlerrm like '%AD_DAILY_LIMIT%'; end;
  insert into t_result (pruefung, ok) values ('3. Bonus-Werbung am selben Tag gesperrt', ok);
  -- Köder
  s := public.start_ad_reward('fishing_special_bait'); r := public.claim_ad_reward_test((s->>'session_id')::uuid);
  insert into t_result (pruefung, ok) values ('Köder-Werbung: genau 1 Epischer Köder mit 3 Würfen',
    (select count(*) from public.fishing_bait_inventory where user_id = auth.uid() and bait_id = 'bait_epic' and uses_left = 3) = 1);
  ok := false; begin perform public.start_ad_reward('fishing_special_bait'); exception when others then ok := sqlerrm like '%AD_DAILY_LIMIT%'; end;
  insert into t_result (pruefung, ok) values ('2. Köder-Werbung am selben Tag gesperrt', ok);
  ok := false; begin perform public.start_ad_reward('fishing_gold'); exception when others then ok := sqlerrm like '%AD_PLACEMENT_INVALID%'; end;
  insert into t_result (pruefung, ok) values ('Unbekannte Platzierung abgelehnt', ok);
  ok := false; begin update public.fishing_state set bonus_casts = 99 where user_id = auth.uid(); exception when others then ok := true; end;
  insert into t_result (pruefung, ok) values ('Bonus nicht direkt änderbar', ok);
  ok := false; begin perform * from public.ad_reward_sessions; exception when others then ok := true; end;
  insert into t_result (pruefung, ok) values ('Sitzungen nicht direkt lesbar', ok);
end $$;

-- Live-Modus: Test-Gutschrift gesperrt, nur SSV
reset role;
update public.ad_reward_config set mode = 'live', ios_bonus_unit_id = 'ca-app-pub-4817586991799948/1554969174', ios_bait_unit_id = 'ca-app-pub-4817586991799948/1554969174' where id = 1;
update public.ad_reward_sessions set berlin_day = berlin_day - 1 where user_id = '00000000-0000-4000-a000-0000000000e1'; -- neuer Tag
set local role authenticated;
do $$ begin perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-0000000000e1","role":"authenticated"}', true); end $$;
do $$ declare s jsonb; ok boolean := false; begin
  insert into t_result (pruefung, ok) values ('Neuer Tag: Limits zurückgesetzt, Bonus bleibt (10)', (public.my_ad_reward_state()->'bonus'->>'used')::int = 0 and (select bonus_casts from public.fishing_state where user_id = auth.uid()) = 10);
  s := public.start_ad_reward('fishing_bonus_casts');
  insert into t_val values ('live', s);
  insert into t_result (pruefung, ok) values ('Live: produktiver Anzeigenblock geliefert', s->>'ad_unit_id' = 'ca-app-pub-4817586991799948/1554969174' and s->>'mode' = 'live');
  begin perform public.claim_ad_reward_test((s->>'session_id')::uuid); exception when others then ok := sqlerrm like '%AD_TEST_MODE_OFF%'; end;
  insert into t_result (pruefung, ok) values ('Live: Client-Gutschrift verboten', ok);
  ok := false; begin perform public.admob_ssv_confirm('falsch', 'tx1', auth.uid(), (s->>'session_id')::uuid, 'u', 5, 'casts'); exception when others then ok := sqlerrm like '%FORBIDDEN%'; end;
  insert into t_result (pruefung, ok) values ('SSV mit falschem Schlüssel abgelehnt', ok);
end $$;
reset role; set local role anon;
insert into t_val select 'ssv1', public.admob_ssv_confirm(repeat('s', 40), 'tx-123', '00000000-0000-4000-a000-0000000000e1', (select (v->>'session_id')::uuid from t_val where k = 'live'), 'ca-app-pub-x/1', 1, 'reward');
insert into t_val select 'ssv2', public.admob_ssv_confirm(repeat('s', 40), 'tx-123', '00000000-0000-4000-a000-0000000000e1', (select (v->>'session_id')::uuid from t_val where k = 'live'), 'ca-app-pub-x/1', 1, 'reward');
reset role;
insert into t_result (pruefung, ok) select 'SSV: +5 gutgeschrieben (15), Replay ohne Wirkung',
  (select v->>'status' = 'granted' from t_val where k = 'ssv1') and (select (v->>'already_processed')::boolean from t_val where k = 'ssv2')
  and (select bonus_casts from public.fishing_state where user_id = '00000000-0000-4000-a000-0000000000e1') = 15;
insert into t_result (pruefung, ok) select 'Admin-Funktionen nur für Admins', not has_function_privilege('anon', 'public.admin_set_ad_reward_config(text,text,text)', 'execute');

select nr, pruefung, ok from t_result order by nr;
select case when bool_and(ok) then 'ALLE ' || count(*) || ' PRÜFUNGEN OK' else 'FEHLER: ' || count(*) filter (where not ok) || ' Prüfung(en) fehlgeschlagen' end as ergebnis from t_result;
rollback;
