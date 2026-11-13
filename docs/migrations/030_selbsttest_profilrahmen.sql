-- 030_selbsttest_profilrahmen.sql
-- Selbsttest für 029. Rollt am Ende ALLES zurück. Ergebnis: eine Zeile je Prüfung mit ok = true.
begin;
create temp table t_result (nr serial, pruefung text, ok boolean) on commit drop;
grant all on t_result to authenticated, anon;
grant usage, select on sequence t_result_nr_seq to authenticated, anon;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-a000-0000000000e1', 'frame-test@example.invalid', '{"username":"frame_test"}');
insert into public.profiles (id) values ('00000000-0000-4000-a000-0000000000e1') on conflict (id) do nothing;
insert into public.coin_wallets (user_id, balance) values ('00000000-0000-4000-a000-0000000000e1', 1200)
on conflict (user_id) do update set balance = 1200;

insert into t_result (pruefung, ok) select '5 Rahmen, 4 × 500, Golden Crown 1.000',
  (select string_agg(id || '=' || price, ',' order by sort) from public.profile_frames where active)
  = 'neon_sunset=500,golden_crown=1000,neon_skyline=500,cyber_lightning=500,neon_coast=500';

set local role authenticated;
do $$ begin perform set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-0000000000e1","role":"authenticated"}', true); end $$;

insert into t_result (pruefung, ok) select 'Anfangs nichts gekauft, kein Rahmen aktiv',
  count(*) = 5 and not bool_or(owned) and not bool_or(equipped) from public.my_profile_frames();
insert into t_result (pruefung, ok) select 'Kauf Golden Crown zieht genau 1.000 ab',
  (r->>'charged')::int = 1000 and (r->>'balance')::int = 200 and not (r->>'already_owned')::boolean
from (select public.buy_profile_frame('golden_crown') as r) x;
insert into t_result (pruefung, ok) select 'Zweiter Kauf: keine erneute Berechnung',
  (r->>'charged')::int = 0 and (r->>'balance')::int = 200 and (r->>'already_owned')::boolean
from (select public.buy_profile_frame('golden_crown') as r) x;
do $$ begin perform public.buy_profile_frame('neon_coast');
  insert into t_result (pruefung, ok) values ('Zu wenig Coins (200 < 500) wird abgelehnt', false);
exception when others then insert into t_result (pruefung, ok) values ('Zu wenig Coins (200 < 500) wird abgelehnt', sqlerrm = 'INSUFFICIENT_COINS'); end $$;
do $$ begin perform public.equip_profile_frame('neon_coast');
  insert into t_result (pruefung, ok) values ('Nicht gekaufter Rahmen kann nicht ausgerüstet werden', false);
exception when others then insert into t_result (pruefung, ok) values ('Nicht gekaufter Rahmen kann nicht ausgerüstet werden', sqlerrm = 'FRAME_LOCKED'); end $$;
insert into t_result (pruefung, ok) select 'Gekauften Rahmen ausrüsten', public.equip_profile_frame('golden_crown') = 'golden_crown';
insert into t_result (pruefung, ok) select 'Genau ein Rahmen ausgerüstet, Kaufzeit gespeichert',
  (select count(*) filter (where equipped) = 1 and bool_and(purchased_at is not null) filter (where owned) from public.my_profile_frames());
insert into t_result (pruefung, ok) select 'Aktiver Rahmen öffentlich lesbar',
  (select frame_id from public.profile_frame_loadouts where user_id = '00000000-0000-4000-a000-0000000000e1') = 'golden_crown';
do $$ begin perform public.equip_profile_frame(null); end $$;
insert into t_result (pruefung, ok) select '„Kein Rahmen“ wählbar', not exists (select 1 from public.my_profile_frames() where equipped);
do $$ begin insert into public.user_profile_frames (user_id, frame_id, price_paid) values ('00000000-0000-4000-a000-0000000000e1', 'neon_coast', 0);
  insert into t_result (pruefung, ok) values ('Direktes Eintragen von Käufen verboten', false);
exception when others then insert into t_result (pruefung, ok) values ('Direktes Eintragen von Käufen verboten', true); end $$;
do $$ begin update public.profile_frames set price = 0 where id = 'neon_coast';
  insert into t_result (pruefung, ok) values ('Preise nicht vom Nutzer änderbar', not found);
exception when others then insert into t_result (pruefung, ok) values ('Preise nicht vom Nutzer änderbar', true); end $$;
do $$ begin insert into public.profile_frame_loadouts (user_id, frame_id) values ('00000000-0000-4000-a000-0000000000e1', 'neon_coast')
  on conflict (user_id) do update set frame_id = excluded.frame_id;
  insert into t_result (pruefung, ok) values ('Aktiven Rahmen direkt setzen verboten', false);
exception when others then insert into t_result (pruefung, ok) values ('Aktiven Rahmen direkt setzen verboten', true); end $$;
reset role;
insert into t_result (pruefung, ok) select 'Genau ein Ledger-Eintrag −1.000',
  (select count(*) = 1 and sum(delta) = -1000 from public.coin_ledger where user_id = '00000000-0000-4000-a000-0000000000e1' and reason = 'profile_frame');

select nr, pruefung, ok from t_result order by nr;
rollback;
