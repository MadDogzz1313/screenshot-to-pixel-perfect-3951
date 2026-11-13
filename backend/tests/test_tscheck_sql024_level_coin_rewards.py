"""Static checks for SQL 024: 500 Coins awarded exactly once per real level-up
(1-100), matching src/lib/levels.ts thresholds. Pure file-content assertions —
the migration is authored for manual execution in Lovable per the briefing's
spec_deviations; this test never runs it against a live database.
"""
from pathlib import Path

MIGRATION = Path(__file__).resolve().parents[2] / "docs/migrations/024_level_coin_rewards.sql"
LEVELS_TS = Path(__file__).resolve().parents[2] / "src/lib/levels.ts"


def sql() -> str:
    return MIGRATION.read_text(encoding="utf-8")


def trigger_fn_block() -> str:
    text = sql()
    return text.split("create or replace function public.award_level_coins_on_xp()", 1)[1].split(
        "drop trigger if exists zz_level_coin_rewards", 1
    )[0]


def test_migration_file_exists_and_declares_prerequisites():
    text = sql()
    assert "013_arcade_coins_spot_unlock.sql" in text
    assert "019_coin_balance_unlimited.sql" in text


def test_level_coin_rewards_table_unique_per_user_and_level():
    text = sql()
    assert "unique (user_id, level)" in text
    assert "level integer not null check (level between 2 and 100)" in text
    assert "coins integer not null default 500 check (coins = 500)" in text


def test_level_math_matches_levels_ts_thresholds():
    text = sql()
    ts = LEVELS_TS.read_text(encoding="utf-8")
    assert "generate_series(1, 100)" in text
    assert "MAX_LEVEL = 100" in ts
    # SQL 033 superseded the original 25*(L-1)^2+75*(L-1) curve with a logarithmic
    # curve (public.leonida_level_curve); 024's own trigger math (idempotent award
    # per reached level) is unchanged and still verified below. The curve itself is
    # covered by docs/migrations/034_selbsttest_xp.sql (SQL) and src/lib/levels.test.ts (JS).
    migration_033 = (
        Path(__file__).resolve().parents[2] / "docs/migrations/033_xp_levelkurve.sql"
    ).read_text(encoding="utf-8")
    assert "leonida_level_curve" in migration_033
    assert "xpStep" in ts and "xpForLevel" in ts


def test_trigger_fires_after_update_of_xp_on_profiles():
    text = sql()
    assert "after update of xp on public.profiles" in text
    assert "for each row execute function public.award_level_coins_on_xp();" in text


def test_trigger_serializes_wallet_with_for_update():
    block = trigger_fn_block()
    assert "from public.coin_wallets as w where w.user_id = new.id for update;" in block


def test_trigger_awards_500_per_reached_level_with_on_conflict_do_nothing():
    block = trigger_fn_block()
    assert "generate_series(old_level + 1, new_level)" in block
    assert "on conflict (user_id, level) do nothing" in block
    assert "returning id into reward_id" in block
    # Only credit wallet + ledger when the insert actually happened (idempotent)
    idx_if = block.index("if reward_id is not null then")
    idx_wallet = block.index("set balance = w.balance + 500")
    idx_ledger = block.index("insert into public.coin_ledger")
    assert idx_if < idx_wallet < idx_ledger
    assert "values (new.id, 500, 'level_up', reward_id);" in block


def test_no_retroactive_award_guard_on_non_increasing_xp():
    block = trigger_fn_block()
    assert "if new.xp is null or old.xp is null or new.xp <= old.xp then" in block
    assert "if new_level <= old_level then" in block


def test_pending_rewards_and_ack_rpcs_scoped_to_authenticated_owner():
    text = sql()
    assert "where r.user_id = auth.uid() and r.seen_at is null" in text
    assert "where user_id = auth.uid() and seen_at is null" in text
    assert "grant execute on function public.my_pending_level_rewards(), public.mark_level_rewards_seen() to authenticated;" in text
    assert "revoke execute on function public.my_pending_level_rewards(), public.mark_level_rewards_seen() from public, anon;" in text


def test_rewards_table_rls_select_only_own_rows():
    text = sql()
    assert "enable row level security" in text
    assert "for select to authenticated using (auth.uid() = user_id);" in text
    assert "revoke all on public.level_coin_rewards from anon, authenticated;" in text
