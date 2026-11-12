-- 019_coin_balance_unlimited.sql
-- Entfernt ausschließlich die künstliche tägliche Coin-Gutschriftgrenze.
-- Voraussetzung: 013_arcade_coins_spot_unlock.sql; kann nach 016 ausgeführt werden.
-- Keine Guthaben werden gelöscht, gekürzt oder zurückgesetzt.
-- Sicherheitsprüfungen bleiben: Auth, Round-ID-Idempotenz, Serverzeit, Score-Rate,
-- Spiel-Maximalbelohnung und tägliches XP-Limit.

-- Ein Wallet kann weit über 308 Coins halten. BIGINT verhindert eine unnötig enge
-- technische Obergrenze; vorhandene integer-Werte werden verlustfrei übernommen.
alter table public.coin_wallets
  alter column balance type bigint using balance::bigint;
alter table public.coin_ledger
  alter column delta type bigint using delta::bigint;

-- Die frühere tägliche Coin-Kappung ist absichtlich nicht mehr enthalten.
-- Coins pro Spielrunde bleiben durch arcade_games.max_coins und die serverseitige Score-Prüfung geschützt.
create or replace function public.finish_arcade_round(_round uuid, _score integer, _duration_ms integer) returns jsonb
language plpgsql security definer set search_path = public
as $$
#variable_conflict use_column
declare uid uuid := auth.uid(); r public.arcade_rounds; g public.arcade_games;
  server_ms bigint; play_ms bigint; score_limit bigint; reward_score integer; coins integer; reward_xp integer;
  day_xp integer; previous_score integer; is_new boolean; xp_cap boolean;
begin
  if uid is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into r from public.arcade_rounds ar where ar.id = _round and ar.user_id = uid for update;
  if not found then raise exception 'ROUND_NOT_FOUND'; end if;
  if r.status = 'completed' then
    return jsonb_build_object('round_id', r.id, 'score', r.score, 'coins', r.coins_awarded, 'xp', r.xp_awarded, 'already_processed', true);
  end if;
  if r.status <> 'started' then raise exception 'ROUND_CLOSED'; end if;
  select * into g from public.arcade_games ag where ag.id = r.game_id and ag.enabled;
  if not found then raise exception 'GAME_UNAVAILABLE'; end if;

  server_ms := greatest(0, floor(extract(epoch from (clock_timestamp() - r.started_at)) * 1000))::bigint;
  if server_ms > 6 * 3600 * 1000 then raise exception 'ROUND_EXPIRED'; end if;
  if _duration_ms is null or _duration_ms < 1000 then raise exception 'ROUND_TOO_SHORT'; end if;
  if _duration_ms > server_ms + 5000 then raise exception 'ROUND_DURATION_INVALID'; end if;

  play_ms := least(_duration_ms::bigint, g.max_duration_seconds::bigint * 1000);
  score_limit := floor((_duration_ms::numeric / 1000) * g.score_per_second)::bigint + 120;
  if _score is null or _score < 0 or _score > score_limit then raise exception 'ROUND_SCORE_INVALID'; end if;
  _score := least(_score::bigint, floor((play_ms::numeric / 1000) * g.score_per_second)::bigint + 120)::integer;

  reward_score := least(_score, g.max_score);
  -- Keine tägliche Coin-Obergrenze: die Belohnung pro Runde bleibt durch max_coins begrenzt.
  coins := floor((reward_score::numeric / g.max_score) * g.max_coins)::integer;

  select coalesce(sum(xe.amount), 0) into day_xp
  from public.arcade_xp_events xe
  where xe.user_id = uid and xe.created_at >= date_trunc('day', now());
  reward_xp := floor((reward_score::numeric / g.max_score) * g.max_xp)::integer;
  xp_cap := reward_xp > greatest(0, 600 - day_xp);
  reward_xp := least(reward_xp, greatest(0, 600 - day_xp));

  select s.high_score into previous_score from public.arcade_scores s where s.user_id = uid and s.game_id = r.game_id;
  is_new := previous_score is null or _score > previous_score;
  insert into public.coin_wallets (user_id, balance) values (uid, 0) on conflict do nothing;
  update public.coin_wallets w set balance = w.balance + coins, updated_at = now() where w.user_id = uid;
  if coins > 0 then
    insert into public.coin_ledger (user_id, delta, reason, ref_id, arcade_round_id) values (uid, coins, 'arcade_round', r.id, r.id);
  end if;
  insert into public.arcade_xp_events (user_id, round_id, game_id, amount) values (uid, r.id, r.game_id, reward_xp);
  update public.profiles p set xp = p.xp + reward_xp where p.id = uid;
  insert into public.arcade_scores (user_id, game_id, high_score) values (uid, r.game_id, _score)
    on conflict (user_id, game_id) do update set high_score = greatest(public.arcade_scores.high_score, excluded.high_score),
      achieved_at = case when excluded.high_score > public.arcade_scores.high_score then now() else public.arcade_scores.achieved_at end;
  update public.arcade_rounds ar set finished_at = now(), client_duration_ms = _duration_ms, score = _score,
    coins_awarded = coins, xp_awarded = reward_xp, status = 'completed' where ar.id = r.id;
  return jsonb_build_object('round_id', r.id, 'score', _score, 'coins', coins, 'xp', reward_xp,
    'new_high_score', is_new, 'daily_limit_reached', xp_cap);
end $$;

grant execute on function public.finish_arcade_round(uuid, integer, integer) to authenticated;

-- Der Rückgabewert kann ein BIGINT sein; der Browser wandelt ihn sicher in Number um,
-- solange die JavaScript-Safe-Integer-Grenze nicht überschritten wird.
drop function if exists public.my_coin_balance();
create function public.my_coin_balance() returns bigint
language sql stable security definer set search_path = public
as $$ select coalesce((select w.balance from public.coin_wallets as w where w.user_id = auth.uid()), 0::bigint) $$;
revoke execute on function public.my_coin_balance() from public, anon;
grant execute on function public.my_coin_balance() to authenticated;

select '019 erfolgreich – künstliche Coin-Tagesgrenze entfernt, Guthaben erhalten' as ergebnis;
