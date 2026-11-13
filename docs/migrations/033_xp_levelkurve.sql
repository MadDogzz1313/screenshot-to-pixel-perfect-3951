-- 033_xp_levelkurve.sql
-- Neues Levelsystem: XP-Bedarf von Level L auf L+1 = roundToNearest50(1000 · (1 + ln L) / (1 + ln 5)), L = 1 … 99.
-- Mehr XP: Neon Highway 40 / 75 (gute Runde ≥ 50 % des Maximal-Scores) / +50 neuer persönlicher Highscore;
-- Leonida Fishing 25 / 40 / 60 / 100 / 150 / 500 XP je Seltenheit.
-- Bestehende Fortschritte werden auf die neue Kurve übertragen (gleiches Level, gleicher %-Fortschritt, nie weniger XP);
-- Sicherung in xp_curve_migration. Voraussetzung: 019, 024, 027, 031. Mehrfach ausführbar.

-- 1. Kurve als Tabelle (eine Quelle für alle Nutzer)
create table if not exists public.leonida_level_curve (level integer primary key, xp_step integer not null, xp_total integer not null);
alter table public.leonida_level_curve enable row level security;
drop policy if exists leonida_level_curve_read on public.leonida_level_curve;
create policy leonida_level_curve_read on public.leonida_level_curve for select to anon, authenticated using (true);
revoke insert, update, delete on public.leonida_level_curve from anon, authenticated;
delete from public.leonida_level_curve;
insert into public.leonida_level_curve (level, xp_step, xp_total)
select l, step, coalesce(sum(step) over (order by l rows between unbounded preceding and 1 preceding), 0)::integer
from (select l, (round((1000 * (1 + ln(l::numeric)) / (1 + ln(5::numeric))) / 50) * 50)::integer as step from generate_series(1, 100) l) s;

-- 2. Sicherung + Übertragung bestehender XP (Level-Trigger währenddessen aus → keine Coin-Buchungen durch die Umstellung)
create table if not exists public.xp_curve_migration (
  user_id uuid primary key, old_xp integer not null, old_level integer not null, new_xp integer not null, migrated_at timestamptz not null default now());
alter table public.xp_curve_migration enable row level security;
revoke all on public.xp_curve_migration from anon, authenticated;

alter table public.profiles disable trigger zz_level_coin_rewards;
with old as (
  select p.id, greatest(coalesce(p.xp, 0), 0) as xp,
    (select max(l) from generate_series(1, 100) l where greatest(coalesce(p.xp, 0), 0) >= 25 * (l - 1) * (l - 1) + 75 * (l - 1)) as lvl
  from public.profiles p
  where not exists (select 1 from public.xp_curve_migration m where m.user_id = p.id)
), mapped as (
  select o.id, o.xp, o.lvl,
    greatest(o.xp, c.xp_total + case when o.lvl >= 100 then 0 else floor(
      (o.xp - (25 * (o.lvl - 1) * (o.lvl - 1) + 75 * (o.lvl - 1)))::numeric
      / ((25 * o.lvl * o.lvl + 75 * o.lvl) - (25 * (o.lvl - 1) * (o.lvl - 1) + 75 * (o.lvl - 1))) * c.xp_step)::integer end) as new_xp
  from old o join public.leonida_level_curve c on c.level = o.lvl
), saved as (
  insert into public.xp_curve_migration (user_id, old_xp, old_level, new_xp) select id, xp, lvl, new_xp from mapped returning user_id, new_xp
)
update public.profiles p set xp = s.new_xp from saved s where p.id = s.user_id;

create or replace function public.leonida_level_from_xp(_xp integer)
returns integer language sql stable strict set search_path = public, pg_temp as $$
  select coalesce(max(c.level), 1)::integer from public.leonida_level_curve c where greatest(coalesce(_xp, 0), 0) >= c.xp_total
$$;
-- Der Level-Trigger zahlt künftig nur Level oberhalb des aktuellen (neu berechneten) Levels → keine Nachzahlung durch die Umstellung.
alter table public.profiles enable trigger zz_level_coin_rewards;

-- 3. Fishing-XP je Seltenheit (ohne Tageslimit für XP; Würfe sind ohnehin auf 15/Tag begrenzt)
alter table public.fishing_species drop constraint if exists fishing_species_reward_xp_check;
alter table public.fishing_species add constraint fishing_species_reward_xp_check check (reward_xp between 0 and 1000);
update public.fishing_species s set reward_xp = v.xp
from (values ('common', 25), ('uncommon', 40), ('rare', 60), ('epic', 100), ('legendary', 150), ('mythic', 500)) v(rarity, xp)
where s.rarity = v.rarity;

-- Einholen: wie 027, aber XP = volle Fisch-XP (kein 600er-Arcade-Tageslimit mehr für Fänge)
create or replace function public.fishing_xp_full()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare full_xp integer; diff integer;
begin
  if new.fishing_cast_id is null then return new; end if;
  select s.reward_xp into full_xp from public.fishing_casts c join public.fishing_species s on s.id = c.species_id where c.id = new.fishing_cast_id;
  diff := coalesce(full_xp, new.amount) - new.amount;
  if diff > 0 then
    new.amount := new.amount + diff;
    update public.profiles p set xp = p.xp + diff where p.id = new.user_id;
  end if;
  return new;
end;
$$;
revoke execute on function public.fishing_xp_full() from public, anon, authenticated;
drop trigger if exists fishing_xp_full on public.arcade_xp_events;
create trigger fishing_xp_full before insert on public.arcade_xp_events for each row execute function public.fishing_xp_full();
-- Gespeicherte XP am Wurf an die tatsächliche Gutschrift angleichen (Anzeige im Ergebnis)
create or replace function public.fishing_cast_xp_sync()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.status = 'caught' then
    select coalesce((select xe.amount from public.arcade_xp_events xe where xe.fishing_cast_id = new.id), new.xp_awarded) into new.xp_awarded;
  end if;
  return new;
end;
$$;
revoke execute on function public.fishing_cast_xp_sync() from public, anon, authenticated;
drop trigger if exists fishing_cast_xp_sync on public.fishing_casts;
create trigger fishing_cast_xp_sync before update of status on public.fishing_casts for each row execute function public.fishing_cast_xp_sync();

-- 4. Neon Highway (finish_arcade_round aus 019, nur der XP-Teil geändert; Score-Prüfung, Coins, Idempotenz unverändert)
drop trigger if exists highway_xp_rules on public.arcade_xp_events;
drop function if exists public.highway_xp_rules();
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
  select s.high_score into previous_score from public.arcade_scores s where s.user_id = uid and s.game_id = r.game_id;
  is_new := previous_score is null or _score > previous_score;
  if r.game_id = 'neon_highway' then
    -- 033: 40 XP je abgeschlossene Runde, 75 XP ab 50 % des Maximal-Scores, +50 bei neuem persönlichem Highscore; 1.500 XP/Tag für Highway
    select coalesce(sum(xe.amount), 0) into day_xp from public.arcade_xp_events xe
    where xe.user_id = uid and xe.game_id = 'neon_highway' and xe.created_at >= date_trunc('day', now());
    reward_xp := (case when reward_score >= g.max_score * 0.5 then 75 else 40 end) + (case when is_new then 50 else 0 end);
    xp_cap := reward_xp > greatest(0, 1500 - day_xp);
    reward_xp := least(reward_xp, greatest(0, 1500 - day_xp));
  else
    reward_xp := floor((reward_score::numeric / g.max_score) * g.max_xp)::integer;
    xp_cap := reward_xp > greatest(0, 600 - day_xp);
    reward_xp := least(reward_xp, greatest(0, 600 - day_xp));
  end if;
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
revoke execute on function public.finish_arcade_round(uuid, integer, integer) from public, anon;
grant execute on function public.finish_arcade_round(uuid, integer, integer) to authenticated;

select '033 erfolgreich – neue Levelkurve, XP übertragen, Highway 40/75/+50, Fishing 25–500 XP' as ergebnis;
