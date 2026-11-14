"""Runs the local PG15 Supabase-mock harness to prove the server-side coin charges
touched by SQL 039 behave per the briefing's acceptance criterion: create_crew
deducts exactly 750 (fails below that without losing coins), unlock_spot gives the
first 5 foreign spots free then charges 750 on the 6th (repeat unlock = 0), vehicle
skin / profile frame purchases charge the new tripled price once, and existing
owned items / wallet balances from before the migration are left untouched by it.

No live Supabase is touched. Builds the local throwaway database (leonida_sqltest)
via scripts/sqltest/run.sh with the prerequisite chain (013,014,016,018,019,022,023,
025,027,029,031), inserts a "legacy" fixture BEFORE applying 039, applies 039, then
runs an ad-hoc selftest SQL script (begin;...rollback;, like the project's own
026_selbsttest_garage.sql) that exercises the RPCs with simulated auth.uid() via
request.jwt.claims, exactly like docs/migrations/026_selbsttest_garage.sql does.
"""
import subprocess
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
M = REPO_ROOT / "docs" / "migrations"
FIXTURES = Path(__file__).resolve().parent / "sql_fixtures"
PRE_CHAIN = [
    M / "013_arcade_coins_spot_unlock.sql",
    M / "014_crew_finder.sql",
    M / "016_arcade_rundenwertung_fix.sql",
    M / "018_spot_unlock_hardening.sql",
    M / "019_coin_balance_unlimited.sql",
    M / "022_eigene_fundorte_freigeschaltet.sql",
    M / "023_freischaltungen_crew_kosten.sql",
    M / "025_neon_garage_fahrzeugdesigns.sql",
    M / "027_leonida_fishing_v2.sql",
    M / "029_profilrahmen.sql",
    M / "031_mythischer_fisch.sql",
]
MIGRATION_039 = M / "039_preise_anpassung.sql"
LEGACY_FIXTURE = FIXTURES / "tscheck_sql039_legacy_fixture_before.sql"
CHARGES_SELFTEST = FIXTURES / "tscheck_sql039_server_charges_selftest.sql"


def _psql(sql_file: Path) -> subprocess.CompletedProcess:
    return subprocess.run(
        ["sudo", "-u", "postgres", "psql", "-v", "ON_ERROR_STOP=1", "-X", "-q", "-d", "leonida_sqltest", "-f", str(sql_file)],
        capture_output=True, text=True, timeout=120,
    )


@pytest.fixture(scope="module")
def selftest_output() -> str:
    for path in [*PRE_CHAIN, MIGRATION_039, LEGACY_FIXTURE, CHARGES_SELFTEST]:
        assert path.exists(), f"missing file {path}"

    apply = subprocess.run(
        ["bash", "scripts/sqltest/run.sh", *[str(p) for p in PRE_CHAIN]],
        cwd=REPO_ROOT, capture_output=True, text=True, timeout=280,
    )
    assert apply.returncode == 0, f"run.sh (prereq chain) failed:\n{apply.stdout}\n{apply.stderr}"

    legacy = _psql(LEGACY_FIXTURE)
    assert legacy.returncode == 0, legacy.stdout + legacy.stderr

    m039 = _psql(MIGRATION_039)
    assert m039.returncode == 0, m039.stdout + m039.stderr

    selftest = _psql(CHARGES_SELFTEST)
    assert selftest.returncode == 0, selftest.stdout + selftest.stderr
    return selftest.stdout + selftest.stderr


EXPECTED_CHECKS = [
    "Bestehender Besitz/Guthaben von der Migration unberuehrt",
    "Fundort 1-5 kostenlos",
    "6. Fundort kostet 750",
    "Erneutes Freischalten desselben Fundorts kostet 0",
    "Freischaltung bei 749 Coins schlaegt fehl",
    "Kein Coinverlust bei fehlgeschlagener Freischaltung",
    "Crew bei 749 Coins schlaegt fehl (keine Verluste)",
    "Nach fehlgeschlagener Crew-Erstellung weiterhin 749 Coins",
    "Crew-Erstellung zieht exakt 750 ab",
    "Crew-Erstellung zieht exakt 750 ab (Guthaben)",
    "Neon Circuit kostet neu 1800 und zieht genau einmal ab",
    "Zweiter Kauf desselben Fahrzeugs ohne erneute Abbuchung",
    "Profilrahmen Neon Sunset kostet neu 1500",
]


@pytest.mark.parametrize("expected_line", EXPECTED_CHECKS)
def test_charge_check_present_and_true(selftest_output, expected_line):
    assert expected_line in selftest_output, selftest_output
    # Each check row ends with " | t" (ok=true) in psql's default aligned output.
    line = next(l for l in selftest_output.splitlines() if expected_line in l)
    assert line.rstrip().endswith("t"), f"check failed (ok=false): {line}"
