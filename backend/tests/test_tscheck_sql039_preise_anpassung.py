"""Runs the local PG15 Supabase-mock harness for SQL 039 (coin price adjustments:
crew creation 500->750, spot unlock 500->750, vehicle skins x3, profile frames x3)
applying it TWICE to prove the repetition guard (price_adjustments table) blocks a
second tripling, then runs self-test 040 and asserts every line reports OK.

No live Supabase is touched (per briefing: no real Supabase access). This spins up
the local throwaway database (leonida_sqltest) via scripts/sqltest/run.sh with the
full prerequisite migration chain from the briefing (013,014,016,018,019,022,023,
025,027,029,031), then applies 039 twice, then runs 040 which only reads.
"""
import subprocess
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
M = REPO_ROOT / "docs" / "migrations"
CHAIN = [
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
    M / "039_preise_anpassung.sql",
    M / "039_preise_anpassung.sql",  # applied a second time on purpose: must be a no-op
]
SELFTEST_040 = M / "040_selbsttest_preise.sql"

EXPECTED_PRICE_ROWS = [
    ("Neon Circuit", 1800),
    ("Sunset Wave", 2250),
    ("Chrome Flamingo", 2400),
    ("Cyber Stripe", 2700),
    ("Galaxy Drift", 3000),
    ("Miami Classic", 0),
]


@pytest.fixture(scope="module")
def harness_output() -> str:
    for path in CHAIN:
        assert path.exists(), f"missing migration {path}"
    assert SELFTEST_040.exists()

    apply = subprocess.run(
        ["bash", "scripts/sqltest/run.sh", *[str(p) for p in CHAIN]],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        timeout=280,
    )
    assert apply.returncode == 0, f"run.sh (migration chain) failed:\n{apply.stdout}\n{apply.stderr}"

    selftest = subprocess.run(
        ["sudo", "-u", "postgres", "psql", "-X", "-q", "-d", "leonida_sqltest", "-f", str(SELFTEST_040)],
        capture_output=True,
        text=True,
        timeout=120,
    )
    out = selftest.stdout + selftest.stderr
    assert selftest.returncode == 0, out
    return apply.stdout + "\n" + out


def test_second_run_did_not_insert_a_second_guard_row(harness_output):
    # run.sh strips RAISE NOTICE lines from its output, so the guard message
    # itself isn't visible here; instead assert directly on the one row the
    # repetition guard allows (a second row, or a unique-key failure, would
    # mean the second application re-ran the tripling logic).
    out = subprocess.run(
        ["sudo", "-u", "postgres", "psql", "-X", "-q", "-A", "-t", "-d", "leonida_sqltest",
         "-c", "select count(*) from public.price_adjustments where id = '039_preise_x3'"],
        capture_output=True, text=True, timeout=60,
    )
    assert out.stdout.strip() == "1", out.stdout + out.stderr


def test_040_selftest_all_lines_ok(harness_output):
    assert "FEHLER" not in harness_output
    assert "FEHLT" not in harness_output
    assert "Wiederholungsschutz-Eintrag vorhanden" in harness_output
    assert "Crew-Erstellung kostet 750" in harness_output
    assert "Fundort-Freischaltung kostet 750" in harness_output
    assert "Fundort-Kosten 750 erlaubt" in harness_output


@pytest.mark.parametrize("name,expected_price", EXPECTED_PRICE_ROWS)
def test_vehicle_prices_only_tripled_once(harness_output, name, expected_price):
    out = subprocess.run(
        ["sudo", "-u", "postgres", "psql", "-X", "-q", "-A", "-t", "-d", "leonida_sqltest",
         "-c", f"select price from public.vehicle_skins where name = '{name}'"],
        capture_output=True, text=True, timeout=60,
    )
    assert out.stdout.strip() == str(expected_price), out.stdout + out.stderr


@pytest.mark.parametrize("name,expected_price", [
    ("Neon Sunset", 1500), ("Golden Crown", 3000), ("Neon Skyline", 1500),
    ("Cyber Lightning", 1500), ("Neon Coast", 1500),
])
def test_frame_prices_only_tripled_once(harness_output, name, expected_price):
    out = subprocess.run(
        ["sudo", "-u", "postgres", "psql", "-X", "-q", "-A", "-t", "-d", "leonida_sqltest",
         "-c", f"select price from public.profile_frames where name = '{name}'"],
        capture_output=True, text=True, timeout=60,
    )
    assert out.stdout.strip() == str(expected_price), out.stdout + out.stderr


def test_fishing_bait_prices_unchanged(harness_output):
    out = subprocess.run(
        ["sudo", "-u", "postgres", "psql", "-X", "-q", "-A", "-t", "-d", "leonida_sqltest",
         "-c", "select price from public.fishing_baits order by sort"],
        capture_output=True, text=True, timeout=60,
    )
    prices = [p.strip() for p in out.stdout.strip().splitlines() if p.strip()]
    assert prices == ["12", "25", "50", "87", "125", "150"], out.stdout + out.stderr
