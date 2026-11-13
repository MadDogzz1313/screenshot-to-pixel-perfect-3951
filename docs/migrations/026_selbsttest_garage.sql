-- 026_selbsttest_garage.sql
-- Selbsttest für 025 (Neoshop-Fahrzeugdesigns + Neon Garage). Rollt am Ende ALLES zurück.
-- Optional in Lovable ausführen (nach 025). Ergebnis: eine Zeile je Prüfung mit ok = true.
begin;
create temp table t_result (nr serial, pruefung text, ok boolean) on commit drop;
grant all on t_result to authenticated, anon;
grant usage, select on sequence t_result_nr_seq to authenticated, anon;

-- Testkonto anlegen (Profil entsteht per Auth-Trigger)
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-a000-0000000000a1', 'garage-test-a@example.invalid', '{"username":"garage_test_a"}');
insert into public.profiles (id) values ('00000000-0000-4000-a000-0000000000a1') on conflict (id) do nothing;
insert into public.coin_wallets (user_id, balance) values ('00000000-0000-4000-a000-0000000000a1', 700)
on conflict (user_id) do update set balance = 700;

insert into t_result (pruefung, ok)
select 'Preise halbiert (1200→600, 1500→750, 1600→800, 1800→900, 2000→1000, Standard 0)',
  (select string_agg(id || '=' || price, ',' order by sort) from public.vehicle_skins where active)
  = 'classic=0,circuit=600,sunset=750,flamingo=800,stripe=900,galaxy=1000';

set local role authenticated;
do $$ begin perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-0000000000a1","role":"authenticated"}', true); end $$;

insert into t_result (pruefung, ok)
select 'Garage: genau 6 Designs, nur Standard besitzt + ausgerüstet',
  count(*) = 6 and bool_and(owned = (id = 'classic')) and bool_and(equipped = (id = 'classic'))
from public.my_vehicle_garage();

do $$ begin perform public.buy_vehicle_skin('sunset');
  insert into t_result (pruefung, ok) values ('Zu wenig Coins (700 < 750) wird abgelehnt', false);
exception when others then insert into t_result (pruefung, ok) values ('Zu wenig Coins (700 < 750) wird abgelehnt', sqlerrm = 'INSUFFICIENT_COINS'); end $$;

insert into t_result (pruefung, ok)
select 'Kauf Neon Circuit zieht genau 600 ab', charged = 600 and balance = 100 and not already_owned
from public.buy_vehicle_skin('circuit');

insert into t_result (pruefung, ok)
select 'Zweiter Kauf: keine erneute Berechnung', charged = 0 and balance = 100 and already_owned
from public.buy_vehicle_skin('circuit');

do $$ begin perform public.equip_vehicle_skin('galaxy');
  insert into t_result (pruefung, ok) values ('Gesperrtes Design kann nicht ausgerüstet werden', false);
exception when others then insert into t_result (pruefung, ok) values ('Gesperrtes Design kann nicht ausgerüstet werden', sqlerrm = 'SKIN_LOCKED'); end $$;

insert into t_result (pruefung, ok) select 'Gekauftes Design ausrüsten', public.equip_vehicle_skin('circuit') = 'circuit';
insert into t_result (pruefung, ok)
select 'Auswahl gespeichert (Neustart-sicher)', (select equipped from public.my_vehicle_garage() where id = 'circuit')
  and not (select equipped from public.my_vehicle_garage() where id = 'classic');

do $$ begin insert into public.user_vehicle_skins (user_id, skin_id, price_paid) values ('00000000-0000-4000-a000-0000000000a1', 'galaxy', 0);
  insert into t_result (pruefung, ok) values ('Direktes Eintragen von Besitz verboten', false);
exception when others then insert into t_result (pruefung, ok) values ('Direktes Eintragen von Besitz verboten', true); end $$;

do $$ begin update public.vehicle_skins set base_price = 0 where id = 'galaxy';
  insert into t_result (pruefung, ok) values ('Preise nicht vom Nutzer änderbar', not found);
exception when others then insert into t_result (pruefung, ok) values ('Preise nicht vom Nutzer änderbar', true); end $$;

reset role;
set local role anon;
do $$ begin perform set_config('request.jwt.claims', '{"role":"anon"}', true); end $$;
do $$ begin perform public.buy_vehicle_skin('circuit');
  insert into t_result (pruefung, ok) values ('Gäste können nicht kaufen', false);
exception when others then insert into t_result (pruefung, ok) values ('Gäste können nicht kaufen', true); end $$;
insert into t_result (pruefung, ok) select 'Gäste sehen den Katalog', count(*) = 6 from public.my_vehicle_garage();
reset role;
insert into t_result (pruefung, ok)
select 'Genau ein Ledger-Eintrag −600', (select count(*) = 1 and sum(delta) = -600 from public.coin_ledger
  where user_id = '00000000-0000-4000-a000-0000000000a1' and reason = 'vehicle_skin');

select nr, pruefung, ok from t_result order by nr;
rollback;
