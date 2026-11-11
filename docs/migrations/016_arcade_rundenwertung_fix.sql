-- 016_arcade_rundenwertung_fix.sql — Arcade-Runden werden auch bei langer Spielzeit und hohen Punkten gewertet
-- Manuell in Lovable → Cloud → Database → SQL Editor ausführen. Voraussetzung: 013. Mehrfaches Ausführen ist unbedenklich.
--
-- Ursache des Fehlers „Diese Runde war zu kurz, zu lang oder wurde unterbrochen“:
--   * Neon Highway ist ein Endlos-Spiel, war aber auf max. 60 s (+10 s Toleranz) begrenzt -> jede Runde über 70 s wurde abgelehnt.
--   * Über 6.000 Punkte (≈ 3 Minuten) wurde die Runde als „unplausibel“ abgelehnt statt die Belohnung zu deckeln.
--   * Pausen zählten gegen ein enges Server-Zeitlimit (Spielzeit + 30 s).
-- Neu (Schutz bleibt, wird sogar strenger):
--   * Länger spielen macht eine Runde nie ungültig. Belohnungen sind weiterhin über max_score und die Tageslimits gedeckelt.
--   * Die gemeldete Spielzeit darf die echte, serverseitig gemessene Zeit seit Rundenstart nicht übersteigen (+5 s Toleranz).
--   * Punkte dürfen die maximal mögliche Punkterate des Spiels nicht übersteigen (Neon Highway: 35 Punkte/s -> Grenze 36/s).
--   * Jede Runde wird nur einmal gewertet (Round-ID), offene Runden verfallen erst nach 6 Stunden.

alter table public.arcade_games drop constraint if exists arcade_games_max_duration_seconds_check;
alter table public.arcade_games add constraint arcade_games_max_duration_seconds_check check (max_duration_seconds between 10 and 86400);

-- max_duration_seconds = längste realistische Spielzeit (darüber wird die Zeit für die Prüfung gedeckelt, nicht abgelehnt)
-- max_score = Punktzahl für die volle Belohnung (unverändert: 6.000 Punkte = 40 Coins / 20 XP)
update public.arcade_games set max_duration_seconds = 3600, score_per_second = 36 where id = 'neon_highway';

create or replace function public.finish_arcade_round(_round uuid, _score integer, _duration_ms integer) returns jsonb
language plpgsql security definer set search_path = public
as $$
#variable_conflict use_column
declare uid uuid := auth.uid(); r public.arcade_rounds; g public.arcade_games;
  server_ms bigint; play_ms bigint; score_limit bigint; reward_score integer; coins integer; reward_xp integer;
  day_coins integer; day_xp integer; previous_score integer; is_new boolean; coin_cap boolean; xp_cap boolean;
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

  -- echte Zeit seit Rundenstart in Millisekunden (vorher auf ganze Sekunden abgeschnitten)
  server_ms := greatest(0, floor(extract(epoch from (clock_timestamp() - r.started_at)) * 1000))::bigint;
  if server_ms > 6 * 3600 * 1000 then raise exception 'ROUND_EXPIRED'; end if;
  if _duration_ms is null or _duration_ms < 1000 then raise exception 'ROUND_TOO_SHORT'; end if;
  -- Manipulationsschutz: mehr Spielzeit melden, als tatsächlich vergangen ist, geht nicht (Pausen sind erlaubt).
  if _duration_ms > server_ms + 5000 then raise exception 'ROUND_DURATION_INVALID'; end if;

  -- Lange Runden werden nicht abgelehnt: für die Plausibilitätsprüfung zählt höchstens max_duration_seconds.
  play_ms := least(_duration_ms::bigint, g.max_duration_seconds::bigint * 1000);
  score_limit := floor((_duration_ms::numeric / 1000) * g.score_per_second)::bigint + 120;
  if _score is null or _score < 0 or _score > score_limit then raise exception 'ROUND_SCORE_INVALID'; end if;
  -- über der längsten realistischen Zeit wird der Score gedeckelt statt die Runde zu verwerfen
  _score := least(_score::bigint, floor((play_ms::numeric / 1000) * g.score_per_second)::bigint + 120)::integer;

  reward_score := least(_score, g.max_score);
  coins := floor((reward_score::numeric / g.max_score) * g.max_coins)::integer;
  -- Tagesgrenzen: Coins und Arcade-XP sind vom Community-XP/Abzeichen-System getrennt.
  select coalesce(sum(cl.delta), 0) into day_coins from public.coin_ledger cl where cl.user_id = uid and cl.reason = 'arcade_round' and cl.created_at >= date_trunc('day', now());
  select coalesce(sum(xe.amount), 0) into day_xp from public.arcade_xp_events xe where xe.user_id = uid and xe.created_at >= date_trunc('day', now());
  coin_cap := coins > greatest(0, 300 - day_coins);
  coins := least(coins, greatest(0, 300 - day_coins));
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
  -- Highscore = echter Score (nicht mehr bei 6.000 abgeschnitten)
  insert into public.arcade_scores (user_id, game_id, high_score) values (uid, r.game_id, _score)
    on conflict (user_id, game_id) do update set high_score = greatest(public.arcade_scores.high_score, excluded.high_score),
      achieved_at = case when excluded.high_score > public.arcade_scores.high_score then now() else public.arcade_scores.achieved_at end;
  update public.arcade_rounds ar set finished_at = now(), client_duration_ms = _duration_ms, score = _score,
    coins_awarded = coins, xp_awarded = reward_xp, status = 'completed' where ar.id = r.id;
  return jsonb_build_object('round_id', r.id, 'score', _score, 'coins', coins, 'xp', reward_xp,
    'new_high_score', is_new, 'daily_limit_reached', coin_cap or xp_cap);
end $$;

grant execute on function public.finish_arcade_round(uuid, integer, integer) to authenticated;

select '016 erfolgreich – Arcade-Runden werden jetzt auch bei langer Spielzeit gewertet' as ergebnis;
