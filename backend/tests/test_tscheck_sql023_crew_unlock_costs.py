"""Static checks for SQL 023: 5 free foreign spot unlocks (then 500 Coins) and
500-Coin crew creation (joining stays free). Pure file-content assertions —
the migration is authored for manual execution in Lovable per the briefing's
spec_deviations; this test never runs it against a live database.
"""
from pathlib import Path

MIGRATION = Path(__file__).resolve().parents[2] / "docs/migrations/023_freischaltungen_crew_kosten.sql"


def sql() -> str:
    return MIGRATION.read_text(encoding="utf-8")


def unlock_block() -> str:
    text = sql()
    return text.split("create or replace function public.unlock_spot(_spot uuid)", 1)[1].split(
        "create or replace function public.my_spot_unlock_preview", 1
    )[0]


def preview_block() -> str:
    text = sql()
    return text.split("create or replace function public.my_spot_unlock_preview", 1)[1].split(
        "-- 2. Crew-Erstellung", 1
    )[0]


def crew_block() -> str:
    text = sql()
    return text.split("create function public.create_crew(", 1)[1]


def test_migration_file_exists_and_declares_prerequisites():
    text = sql()
    assert "013_arcade_coins_spot_unlock.sql" in text
    assert "018_spot_unlock_hardening.sql" in text
    assert "019_coin_balance_unlimited.sql" in text
    assert "022_eigene_fundorte_freigeschaltet.sql" in text


def test_old_150_cost_rows_preserved_while_allowing_500():
    text = sql()
    assert "drop constraint if exists spot_unlocks_cost_check" in text
    assert "check (cost in (0, 150, 500))" in text


def test_foreign_spot_unlock_first_five_free_then_500():
    block = unlock_block()
    assert "charge := case when unlocked_count < 5 or is_premium then 0 else 500 end" in block
    # own/admin spots stay free and are excluded, as in 022
    assert "if is_owner or is_admin then" in block
    assert "return query select true, 0, coalesce(wallet_balance, 0), null::integer;" in block
    assert "s.author_id is distinct from uid" in block


def test_preview_rpc_mirrors_five_free_then_500():
    block = preview_block()
    assert "greatest(0, 5 - n)" in block
    assert "case when owner or already or privileged or n < 5 then 0 else 500 end" in block


def test_wallet_operations_serialized_with_for_update():
    unlock = unlock_block()
    assert "from public.coin_wallets as w where w.user_id = uid for update;" in unlock
    crew = crew_block()
    assert "from public.coin_wallets as w where w.user_id = uid for update;" in crew


def test_crew_cost_is_500_charged_only_after_successful_insertion():
    block = crew_block()
    assert "crew_cost constant integer := 500;" in block
    insert_crew_idx = block.index("insert into public.crews (")
    insert_member_idx = block.index("insert into public.crew_members")
    debit_idx = block.index("update public.coin_wallets as w")
    ledger_idx = block.index("insert into public.coin_ledger")
    assert insert_crew_idx < insert_member_idx < debit_idx < ledger_idx
    assert "if wallet_balance < crew_cost then raise exception 'INSUFFICIENT_COINS'" in block


def test_ledger_entries_use_spot_unlock_and_crew_create_reasons():
    unlock = unlock_block()
    assert "'spot_unlock'" in unlock
    crew = crew_block()
    assert "'crew_create'" in crew


def test_errors_roll_back_transaction_implicitly_via_plpgsql_exception():
    # No explicit commit before the charge in either function: a raised
    # exception aborts the whole function body (implicit Postgres rollback),
    # so a failed insert/validation never reaches the debit statements.
    unlock = unlock_block()
    assert unlock.index("raise exception 'INSUFFICIENT_COINS'") < unlock.index(
        "insert into public.spot_unlocks"
    )
    crew = crew_block()
    assert crew.index("raise exception 'INSUFFICIENT_COINS'") < crew.index(
        "insert into public.crews ("
    )


def test_request_join_crew_untouched_by_this_migration():
    text = sql()
    assert "create_crew" in text
    assert "request_join_crew" not in text
    assert "update_crew" not in text


def test_create_crew_execute_grants_restricted_to_authenticated():
    text = sql()
    assert "revoke execute on function public.create_crew(" in text
    assert "grant execute on function public.create_crew(" in text
    assert "to authenticated" in text
    assert "from public, anon" in text
