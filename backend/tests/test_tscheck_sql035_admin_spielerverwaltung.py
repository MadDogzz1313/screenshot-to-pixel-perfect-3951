"""Runs the local PG15 Supabase-mock harness for SQL 035 (Admin-Spielerverwaltung:
Coins + Bonus-Angelversuche gutschreiben, Protokoll) and its self-test 036, then
asserts on the actual psql output.

No live Supabase is touched (per briefing: SQL 035 is NOT yet applied on the
real Lovable-Supabase and there are no test credentials there). This spins up
the local throwaway database (leonida_sqltest) via scripts/sqltest/run.sh with
the full prerequisite migration chain, exactly as described in the briefing's
seed_facts, then runs 036 which rolls everything back with a final RAISE.
"""
import subprocess
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
M = REPO_ROOT / "docs" / "migrations"
CHAIN = [
    M / "013_arcade_coins_spot_unlock.sql",
    M / "016_arcade_rundenwertung_fix.sql",
    M / "018_spot_unlock_hardening.sql",
    M / "019_coin_balance_unlimited.sql",
    M / "024_level_coin_rewards.sql",
    M / "027_leonida_fishing_v2.sql",
    M / "031_mythischer_fisch.sql",
    M / "033_xp_levelkurve.sql",
    M / "035_admin_spielerverwaltung.sql",
]
SELFTEST_036 = M / "036_selbsttest_admin_spielerverwaltung.sql"

EXPECTED_OK_LINES = [
    "Spieler kann sich keine Coins gutschreiben (ADMIN_ONLY)",
    "Spieler kann sich keine Angelversuche gutschreiben (ADMIN_ONLY)",
    "Spieler sieht keine Spielerliste (ADMIN_ONLY)",
    "Wiederholung mit gleichem Schlüssel bucht nicht doppelt",
    "Ohne Bonus: 16. Wurf gesperrt",
    "+10 Bonusversuche, Wiederholung bucht nicht doppelt",
    "Nach Tagesreset: 0/15 verwendet, Bonus 4 bleibt",
    "Spieler bekommt 3 Meldungen (2\u00d7 Coins, 1\u00d7 Angelversuche)",
    "Ledger: genau 2 Coin-Gutschriften (keine Doppelbuchung)",
]


@pytest.fixture(scope="module")
def selftest_036_output() -> str:
    for path in CHAIN:
        assert path.exists(), f"missing migration {path}"
    assert SELFTEST_036.exists()

    apply = subprocess.run(
        ["bash", "scripts/sqltest/run.sh", *[str(p) for p in CHAIN]],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        timeout=280,
    )
    assert apply.returncode == 0, f"run.sh (migration chain) failed:\n{apply.stdout}\n{apply.stderr}"
    assert "035 erfolgreich" in apply.stdout

    selftest = subprocess.run(
        ["sudo", "-u", "postgres", "psql", "-X", "-q", "-d", "leonida_sqltest", "-f", str(SELFTEST_036)],
        capture_output=True,
        text=True,
        timeout=120,
    )
    return selftest.stdout + selftest.stderr


def test_036_reports_all_27_checks_ok(selftest_036_output):
    assert "ALLE 27 PR\u00dcFUNGEN OK" in selftest_036_output
    assert " f " not in selftest_036_output.replace("\n", " ")


@pytest.mark.parametrize("expected_line", EXPECTED_OK_LINES)
def test_selbsttest_contains_required_check(selftest_036_output, expected_line):
    assert expected_line in selftest_036_output
