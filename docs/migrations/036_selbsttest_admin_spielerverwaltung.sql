-- 036_selbsttest_admin_spielerverwaltung.sql – Selbsttest für 035. Rollt am Ende ALLES zurück. Jede Zeile sollte ok = true zeigen.
begin;
create temp table t_result (nr serial, pruefung text, ok boolean) on commit drop;
create temp table t_val (k text primary key, v jsonb) on commit drop;
grant all on t_result, t_val to authenticated; grant usage, select on sequence t_result_nr_seq to authenticated;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-a000-0000000000d1', 'admin-test@example.invalid', '{"username":"grant_admin_t"}'),
  ('00000000-0000-4000-a000-0000000000d2', 'spieler-test@example.invalid', '{"username":"grant_player_t"}');
insert into public.profiles (id) values ('00000000-0000-4000-a000-0000000000d1'), ('00000000-0000-4000-a000-0000000000d2') on conflict (id) do nothing;
update public.profiles set username = 'grant_admin_t' where id = '00000000-0000-4000-a000-0000000000d1';
update public.profiles set username = 'grant_player_t' where id = '00000000-0000-4000-a000-0000000000d2';
insert into public.user_roles (user_id, role) values ('00000000-0000-4000-a000-0000000000d1', 'admin') on conflict do nothing;
insert into public.coin_wallets (user_id, balance) values ('00000000-0000-4000-a000-0000000000d2', 40) on conflict (user_id) do update set balance = 40;

set local role authenticated;
-- Spieler (kein Admin) darf nichts
do $$ begin perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-0000000000d2","role":"authenticated"}', true); end $$;
do $$ declare ok boolean := false; begin
  begin perform public.admin_grant_coins('00000000-0000-4000-a000-0000000000d2', 999, 'x', gen_random_uuid()); exception when others then ok := sqlerrm like '%ADMIN_ONLY%'; end;
  insert into t_result (pruefung, ok) values ('Spieler kann sich keine Coins gutschreiben (ADMIN_ONLY)', ok);
  ok := false; begin perform public.admin_grant_fishing_casts('00000000-0000-4000-a000-0000000000d2', 99, 'x', gen_random_uuid()); exception when others then ok := sqlerrm like '%ADMIN_ONLY%'; end;
  insert into t_result (pruefung, ok) values ('Spieler kann sich keine Angelversuche gutschreiben (ADMIN_ONLY)', ok);
  ok := false; begin perform * from public.admin_player_list(''); exception when others then ok := sqlerrm like '%ADMIN_ONLY%'; end;
  insert into t_result (pruefung, ok) values ('Spieler sieht keine Spielerliste (ADMIN_ONLY)', ok);
  ok := false; begin perform * from public.admin_grant_history(null); exception when others then ok := sqlerrm like '%ADMIN_ONLY%'; end;
  insert into t_result (pruefung, ok) values ('Spieler sieht kein Admin-Protokoll (ADMIN_ONLY)', ok);
  ok := false; begin perform * from public.admin_grants; exception when others then ok := true; end;
  insert into t_result (pruefung, ok) values ('Direktzugriff auf admin_grants verweigert', ok);
  ok := false; begin update public.fishing_state set bonus_casts = 999 where user_id = auth.uid(); get diagnostics ok = row_count; ok := false; exception when others then ok := true; end;
  insert into t_result (pruefung, ok) values ('Bonusversuche nicht direkt änderbar', ok);
end $$;

-- Admin
do $$ begin perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-0000000000d1","role":"authenticated"}', true); end $$;
insert into t_result (pruefung, ok) select 'Suche nach Benutzername findet Spieler',
  exists (select 1 from public.admin_player_list('grant_player') where id = '00000000-0000-4000-a000-0000000000d2' and coins = 40);
insert into t_result (pruefung, ok) select 'Suche nach E-Mail findet Spieler',
  exists (select 1 from public.admin_player_list('spieler-test@example') where id = '00000000-0000-4000-a000-0000000000d2');

insert into t_val values ('g1', public.admin_grant_coins('00000000-0000-4000-a000-0000000000d2', 500, 'Event-Gewinn', '00000000-0000-4000-b000-0000000000d1'));
insert into t_result (pruefung, ok) select '+500 Coins: 40 → 540', (select (v->>'balance')::bigint = 540 and not (v->>'already_processed')::boolean from t_val where k = 'g1');
insert into t_val values ('g1b', public.admin_grant_coins('00000000-0000-4000-a000-0000000000d2', 500, 'Event-Gewinn', '00000000-0000-4000-b000-0000000000d1'));
insert into t_result (pruefung, ok) select 'Wiederholung mit gleichem Schlüssel bucht nicht doppelt',
  (select (v->>'balance')::bigint = 540 and (v->>'already_processed')::boolean from t_val where k = 'g1b');
insert into t_val values ('g2', public.admin_grant_coins('00000000-0000-4000-a000-0000000000d2', 1234567, null, '00000000-0000-4000-b000-0000000000d2'));
insert into t_result (pruefung, ok) select 'Freie Menge 1.234.567 Coins', (select (v->>'balance')::bigint = 1235107 from t_val where k = 'g2');
do $$ declare ok boolean := false; begin
  begin perform public.admin_grant_coins('00000000-0000-4000-a000-0000000000d2', 0, null, gen_random_uuid()); exception when others then ok := sqlerrm like '%AMOUNT_INVALID%'; end;
  insert into t_result (pruefung, ok) values ('0 Coins abgelehnt', ok);
  ok := false; begin perform public.admin_grant_coins('00000000-0000-4000-a000-0000000000d2', -5, null, gen_random_uuid()); exception when others then ok := sqlerrm like '%AMOUNT_INVALID%'; end;
  insert into t_result (pruefung, ok) values ('Negative Coins abgelehnt', ok);
  ok := false; begin perform public.admin_grant_fishing_casts('00000000-0000-4000-a000-0000000000d2', 500, null, '00000000-0000-4000-b000-0000000000d1'); exception when others then ok := sqlerrm like '%REQUEST_KEY_REUSED%'; end;
  insert into t_result (pruefung, ok) values ('Schlüssel einer anderen Gutschrift wird abgelehnt', ok);
end $$;

-- Spieler verbraucht 15 Tagesversuche
do $$ begin perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-0000000000d2","role":"authenticated"}', true); end $$;
do $$ declare i integer; c jsonb; begin
  for i in 1..15 loop c := public.start_fishing_cast(gen_random_uuid()); perform public.reel_fishing_cast((c->>'cast_id')::uuid, false); end loop;
end $$;
do $$ declare ok boolean := false; begin
  begin perform public.start_fishing_cast(gen_random_uuid()); exception when others then ok := sqlerrm like '%FISHING_DAILY_LIMIT%'; end;
  insert into t_result (pruefung, ok) values ('Ohne Bonus: 16. Wurf gesperrt', ok);
end $$;

do $$ begin perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-0000000000d1","role":"authenticated"}', true); end $$;
insert into t_val values ('f1', public.admin_grant_fishing_casts('00000000-0000-4000-a000-0000000000d2', 10, 'Entschädigung', '00000000-0000-4000-b000-0000000000d3'));
insert into t_val values ('f1b', public.admin_grant_fishing_casts('00000000-0000-4000-a000-0000000000d2', 10, 'Entschädigung', '00000000-0000-4000-b000-0000000000d3'));
insert into t_result (pruefung, ok) select '+10 Bonusversuche, Wiederholung bucht nicht doppelt',
  (select (v->>'bonus_casts')::bigint = 10 from t_val where k = 'f1') and (select (v->>'bonus_casts')::bigint = 10 and (v->>'already_processed')::boolean from t_val where k = 'f1b');
insert into t_val values ('d1', public.admin_player_detail('00000000-0000-4000-a000-0000000000d2'));
insert into t_result (pruefung, ok) select 'Detail: 15 verwendet, 0 übrig, 10 Bonus, 10 erhalten, Coins 1.235.107',
  (select (v->>'casts_used_today')::int = 15 and (v->>'daily_left')::int = 0 and (v->>'bonus_casts')::int = 10 and (v->>'bonus_granted_total')::int = 10
     and (v->>'coins')::bigint = 1235107 from t_val where k = 'd1');

do $$ begin perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-0000000000d2","role":"authenticated"}', true); end $$;
insert into t_result (pruefung, ok) select 'Spieler sieht 15/15 + 10 Bonus',
  (public.my_fishing_state()->>'used')::int = 15 and (public.my_fishing_state()->>'bonus_casts')::int = 10;
do $$ declare i integer; c jsonb; begin
  c := public.start_fishing_cast(gen_random_uuid());
  insert into t_result (pruefung, ok) values ('Bonus-Wurf: used bleibt 15, Bonus 9', (c->>'used')::int = 15 and (c->>'bonus_casts')::int = 9 and (c->>'used_bonus')::boolean);
  perform public.reel_fishing_cast((c->>'cast_id')::uuid, false);
  for i in 2..10 loop c := public.start_fishing_cast(gen_random_uuid()); perform public.reel_fishing_cast((c->>'cast_id')::uuid, false); end loop;
end $$;
do $$ declare ok boolean := false; begin
  begin perform public.start_fishing_cast(gen_random_uuid()); exception when others then ok := sqlerrm like '%FISHING_DAILY_LIMIT%'; end;
  insert into t_result (pruefung, ok) values ('Nach 15 + 10 Würfen gesperrt, Bonus = 0', ok and (public.my_fishing_state()->>'bonus_casts')::int = 0);
end $$;

-- Tagesreset: neuer Bonus, dann Würfe von „gestern“ simulieren → Tageslimit frei, Bonus bleibt
reset role;
update public.fishing_state set bonus_casts = 4 where user_id = '00000000-0000-4000-a000-0000000000d2';
update public.fishing_casts set berlin_day = berlin_day - 1 where user_id = '00000000-0000-4000-a000-0000000000d2';
set local role authenticated;
do $$ begin perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-0000000000d2","role":"authenticated"}', true); end $$;
do $$ declare c jsonb; begin
  insert into t_result (pruefung, ok) values ('Nach Tagesreset: 0/15 verwendet, Bonus 4 bleibt',
    (public.my_fishing_state()->>'used')::int = 0 and (public.my_fishing_state()->>'bonus_casts')::int = 4);
  c := public.start_fishing_cast(gen_random_uuid());
  insert into t_result (pruefung, ok) values ('Neuer Tag: erst Tagesversuche, Bonus unverändert', (c->>'used')::int = 1 and (c->>'bonus_casts')::int = 4 and not (c->>'used_bonus')::boolean);
  perform public.reel_fishing_cast((c->>'cast_id')::uuid, false);
end $$;

insert into t_result (pruefung, ok) select 'Spieler bekommt 3 Meldungen (2× Coins, 1× Angelversuche)',
  (select count(*) from public.my_admin_grant_notices()) = 3 and (select count(*) from public.admin_grant_notices) = 3;
select public.mark_admin_grant_notices_seen(array(select id from public.my_admin_grant_notices()));
insert into t_result (pruefung, ok) select 'Meldungen als gesehen markiert', (select count(*) from public.my_admin_grant_notices()) = 0;

do $$ begin perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-0000000000d1","role":"authenticated"}', true); end $$;
insert into t_result (pruefung, ok) select 'Admin sieht keine fremden Meldungen', (select count(*) from public.admin_grant_notices) = 0;
insert into t_result (pruefung, ok) select 'Protokoll: 3 Gutschriften mit Admin, Spieler, Grund',
  (select count(*) from public.admin_grant_history('00000000-0000-4000-a000-0000000000d2')) = 3
  and exists (select 1 from public.admin_grant_history(null) h where h.admin_name = 'grant_admin_t' and h.target_name = 'grant_player_t'
              and h.kind = 'coins' and h.amount = 500 and h.reason = 'Event-Gewinn')
  and exists (select 1 from public.admin_grant_history(null) h where h.kind = 'fishing_casts' and h.amount = 10 and h.reason = 'Entschädigung');
reset role;
insert into t_result (pruefung, ok) select 'Ledger: genau 2 Coin-Gutschriften (keine Doppelbuchung)',
  (select count(*) from public.coin_ledger where user_id = '00000000-0000-4000-a000-0000000000d2' and reason = 'admin_grant') = 2;

select nr, pruefung, ok from t_result order by nr;
select case when bool_and(ok) then 'ALLE ' || count(*) || ' PRÜFUNGEN OK' else 'FEHLER: ' || count(*) filter (where not ok) || ' Prüfung(en) fehlgeschlagen' end as ergebnis from t_result;
rollback;
