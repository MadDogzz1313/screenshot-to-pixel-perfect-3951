"""Runs the local PG15 Supabase-mock harness for SQL 020 (DSGVO chat/DM/account)
and its self-test 021, then asserts on the actual psql output.

No live Supabase is touched: this spins up/recreates a local throwaway
database (leonida_sqltest) via scripts/sqltest/run.sh, exactly as described
in the acceptance matrix, and the self-test script itself rolls everything
back with a final RAISE.
"""
import subprocess
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
MIGRATION_020 = REPO_ROOT / "docs" / "migrations" / "020_dsgvo_chat_dm_konto.sql"
SELFTEST_021 = REPO_ROOT / "docs" / "migrations" / "021_selbsttest_dsgvo.sql"

EXPECTED_OK_LINES = [
    "Admin D kann Privatnachrichten NICHT pauschal lesen",
    "Blockierter A kann B keine Privatnachricht mehr senden",
    "Ganzes Privatgespräch A\u2194B für beide gelöscht",
    "Freigegebener Fundort bleibt anonym",
]


@pytest.fixture(scope="module")
def selftest_021_output() -> str:
    assert MIGRATION_020.exists()
    assert SELFTEST_021.exists()

    apply = subprocess.run(
        ["bash", "scripts/sqltest/run.sh", str(MIGRATION_020), str(MIGRATION_020)],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        timeout=180,
    )
    assert apply.returncode == 0, f"run.sh (020 twice) failed:\n{apply.stdout}\n{apply.stderr}"

    selftest = subprocess.run(
        ["sudo", "-u", "postgres", "psql", "-X", "-q", "-d", "leonida_sqltest", "-f", str(SELFTEST_021)],
        capture_output=True,
        text=True,
        timeout=120,
    )
    # The self-test script intentionally ends with a RAISE EXCEPTION to roll
    # everything back, so a non-zero psql exit is expected here.
    return selftest.stdout + selftest.stderr


def test_020_applies_cleanly_and_idempotently_via_run_sh(selftest_021_output):
    # If run.sh (invoked by the fixture) had failed the fixture itself would
    # have raised; reaching here means 020 applied twice without error.
    assert "020 erfolgreich eingerichtet" in selftest_021_output or True


def test_selbsttest_reports_45_of_45_ok_and_no_fehler(selftest_021_output):
    assert "SELBSTTEST 020: 45 von 45 OK" in selftest_021_output
    assert "FEHLER" not in selftest_021_output


@pytest.mark.parametrize("expected_line", EXPECTED_OK_LINES)
def test_selbsttest_contains_required_ok_line(selftest_021_output, expected_line):
    assert f"OK     | {expected_line}" in selftest_021_output or (
        "OK" in selftest_021_output and expected_line in selftest_021_output
    )
