"""Spendenstufen-API: GET /api/payments/tiers (no auth required)."""
import httpx

BASE_URL = "http://localhost:8001"


def test_tiers_endpoint_returns_six_tiers_and_limits():
    r = httpx.get(f"{BASE_URL}/api/payments/tiers", timeout=10)
    assert r.status_code == 200
    body = r.json()

    assert body["custom_min_cents"] == 100
    assert body["custom_max_cents"] == 50000
    assert set(body) == {"tiers", "custom_min_cents", "custom_max_cents"}

    tiers = {t["id"]: t for t in body["tiers"]}
    assert len(body["tiers"]) == 6
    expected = {
        "supporter": 100, "bronze": 500, "silver": 1500,
        "gold": 3000, "diamond": 5000, "founder": 10000,
    }
    for tid, cents in expected.items():
        assert tid in tiers, f"missing tier {tid}"
        assert tiers[tid]["amount_cents"] == cents
        assert tiers[tid]["lookup_key"] == f"donation_{cents // 100}eur"
