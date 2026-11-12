"""
Criterion: Server-side migration contains exact atomic rules.
docs/migrations/018_spot_unlock_hardening.sql must define a security-definer
unlock_spot function, restricted to the authenticated role, that serializes
on the wallet row (FOR UPDATE), makes the first 10 distinct spots free,
charges exactly 150 for later spots, is idempotent on repeat/conflict,
rejects insufficient balance, and performs the unlock insert plus the
debit/ledger write in one transaction (a single plpgsql function body - no
explicit BEGIN/COMMIT needed since each function call is already atomic).
It must not disable row level security broadly (no "disable row level
security" / "force row level security" off statements).

This is pure static-file verification (no live DB available to the test
runner), so it is implemented as a file-content check rather than an RPC
call - the file itself is the deliverable the criterion describes.
"""
import pathlib

MIGRATION_PATH = pathlib.Path(__file__).resolve().parents[2] / "docs" / "migrations" / "018_spot_unlock_hardening.sql"


def _read_migration() -> str:
    assert MIGRATION_PATH.exists(), f"migration file missing: {MIGRATION_PATH}"
    return MIGRATION_PATH.read_text(encoding="utf-8")


def test_migration_file_exists_and_readable():
    sql = _read_migration()
    assert len(sql) > 500, "migration file unexpectedly short/empty"


def test_unlock_spot_is_security_definer():
    sql = _read_migration()
    assert "create or replace function public.unlock_spot(_spot uuid)" in sql
    # security definer must appear between the unlock_spot signature and its next function
    unlock_block = sql.split("create or replace function public.unlock_spot(_spot uuid)")[1].split(
        "create or replace function public.my_spot_unlock_preview"
    )[0]
    assert "security definer" in unlock_block, "unlock_spot must be security definer"


def test_execute_restricted_to_authenticated_role_only():
    sql = _read_migration()
    assert "revoke execute on function public.unlock_spot(uuid), public.my_spot_unlock_preview(uuid) from public, anon" in sql
    assert "grant execute on function public.unlock_spot(uuid), public.my_spot_unlock_preview(uuid) to authenticated" in sql


def test_wallet_row_is_locked_with_for_update():
    sql = _read_migration()
    unlock_block = sql.split("create or replace function public.unlock_spot(_spot uuid)")[1].split(
        "create or replace function public.my_spot_unlock_preview"
    )[0]
    assert "for update" in unlock_block, "wallet balance select must use FOR UPDATE to serialize concurrent unlocks"
    assert "coin_wallets" in unlock_block


def test_first_ten_spots_free_then_exactly_150():
    sql = _read_migration()
    unlock_block = sql.split("create or replace function public.unlock_spot(_spot uuid)")[1].split(
        "create or replace function public.my_spot_unlock_preview"
    )[0]
    assert "charge := case when unlocked_count < 10 or is_premium then 0 else 150 end" in unlock_block


def test_insufficient_balance_is_rejected():
    sql = _read_migration()
    unlock_block = sql.split("create or replace function public.unlock_spot(_spot uuid)")[1].split(
        "create or replace function public.my_spot_unlock_preview"
    )[0]
    assert "if wallet_balance < charge then raise exception 'INSUFFICIENT_COINS'" in unlock_block


def test_unlock_insert_has_unique_conflict_idempotency():
    sql = _read_migration()
    unlock_block = sql.split("create or replace function public.unlock_spot(_spot uuid)")[1].split(
        "create or replace function public.my_spot_unlock_preview"
    )[0]
    assert "on conflict (user_id, spot_id) do nothing" in unlock_block
    assert "if inserted_cost is null then" in unlock_block, "repeat calls after a conflict must short-circuit without a second debit"


def test_debit_and_ledger_write_happen_after_the_same_insert_in_one_function():
    sql = _read_migration()
    unlock_block = sql.split("create or replace function public.unlock_spot(_spot uuid)")[1].split(
        "create or replace function public.my_spot_unlock_preview"
    )[0]
    insert_idx = unlock_block.index("insert into public.spot_unlocks")
    debit_idx = unlock_block.index("update public.coin_wallets")
    ledger_idx = unlock_block.index("insert into public.coin_ledger")
    assert insert_idx < debit_idx < ledger_idx, "unlock insert must precede debit which must precede the ledger entry, all in one plpgsql function body"


def test_no_broad_rls_disable_present():
    sql = _read_migration().lower()
    assert "disable row level security" not in sql
    assert "force row level security" not in sql or "no force row level security" in sql
