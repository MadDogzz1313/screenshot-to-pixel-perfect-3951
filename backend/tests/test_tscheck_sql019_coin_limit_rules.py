"""Static checks for the unlimited coin-balance migration.

The live Supabase project is external to this pod, so this verifies the migration
contract without creating users, rounds, or ledger rows.
"""
from pathlib import Path


MIGRATION = Path(__file__).resolve().parents[2] / "docs" / "migrations" / "019_coin_balance_unlimited.sql"


def sql() -> str:
    assert MIGRATION.exists()
    return MIGRATION.read_text(encoding="utf-8")


def finish_block(source: str) -> str:
    return source.split("create or replace function public.finish_arcade_round", 1)[1].split(
        "grant execute on function public.finish_arcade_round", 1
    )[0]


def test_migration_preserves_existing_balances_and_expands_storage():
    source = sql().lower()
    assert "alter column balance type bigint using balance::bigint" in source
    assert "alter column delta type bigint using delta::bigint" in source
    assert "delete from public.coin_wallets" not in source
    assert "truncate" not in source
    assert "drop table" not in source


def test_daily_coin_cap_is_removed_but_round_reward_cap_remains():
    block = finish_block(sql())
    assert "day_coins" not in block
    assert "300 - day_coins" not in block
    assert "keine tägliche coin-obergrenze" in block.lower()
    assert "g.max_coins" in block
    assert "g.score_per_second" in block


def test_security_and_idempotency_checks_remain():
    block = finish_block(sql())
    assert "security definer" in block.lower()
    assert "for update" in block.lower()
    assert "round_not_found" in block.lower()
    assert "round_expired" in block.lower()
    assert "round_duration_invalid" in block.lower()
    assert "round_score_invalid" in block.lower()
    assert "arcade_round_id" in block
    assert "on conflict" in block.lower()
    assert "xp_cap" in block


def test_coin_balance_rpc_is_authenticated_and_bigint():
    source = sql().lower()
    assert "drop function if exists public.my_coin_balance()" in source
    assert "create function public.my_coin_balance() returns bigint" in source
    assert "revoke execute on function public.my_coin_balance() from public, anon" in source
    assert "grant execute on function public.my_coin_balance() to authenticated" in source
