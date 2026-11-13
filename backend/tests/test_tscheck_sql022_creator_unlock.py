"""Static checks for the creator-owned spot unlock policy in SQL 022."""
from pathlib import Path

MIGRATION = Path(__file__).resolve().parents[2] / "docs/migrations/022_eigene_fundorte_freigeschaltet.sql"


def sql() -> str:
    return MIGRATION.read_text(encoding="utf-8")


def unlock_block() -> str:
    text = sql()
    return text.split("create function public.unlock_spot(_spot uuid)", 1)[1].split(
        "create or replace function public.my_spot_unlock_preview", 1
    )[0]


def test_creator_is_free_and_not_recorded_as_unlock():
    block = unlock_block()
    assert "if is_owner or is_admin then" in block
    assert "return query select true, 0" in block
    assert "kein Unlock-Fenster" in block
    assert "insert into public.spot_unlocks" in block
    assert "is_owner" in block


def test_free_counter_excludes_creator_owned_spots():
    block = unlock_block()
    assert "join public.spots as s on s.id = su.spot_id" in block
    assert "s.author_id is distinct from uid" in block
    assert "charge := case when unlocked_count < 10 or is_premium then 0 else 150 end" in block


def test_pending_and_rejected_spots_are_not_unlockable():
    text = sql()
    assert text.count("s.status in ('approved', 'hidden')") >= 3
    assert "raise exception 'SPOT_NOT_FOUND'" in text


def test_unlock_is_idempotent_and_debits_only_after_insert():
    block = unlock_block()
    insert_index = block.index("insert into public.spot_unlocks")
    debit_index = block.index("update public.coin_wallets")
    ledger_index = block.index("insert into public.coin_ledger")
    assert insert_index < debit_index < ledger_index
    assert "on conflict (user_id, spot_id) do nothing" in block
    assert "if inserted_cost is null then" in block
    assert "if wallet_balance < charge then raise exception 'INSUFFICIENT_COINS'" in block


def test_rpc_is_server_side_and_authenticated_only():
    text = sql()
    assert "security definer" in text
    assert "revoke execute on function public.my_spot_access(uuid), public.unlock_spot(uuid), public.my_spot_unlock_preview(uuid) from public, anon" in text
    assert "grant execute on function public.my_spot_access(uuid), public.unlock_spot(uuid), public.my_spot_unlock_preview(uuid) to authenticated" in text
