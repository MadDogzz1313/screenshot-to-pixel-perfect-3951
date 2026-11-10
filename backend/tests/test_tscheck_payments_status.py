"""Zahlungsstatus: GET /api/payments/status/{session_id}.

Unknown session -> 404. For a freshly created session (created through the
dependency-overridden checkout, since no real Supabase user can pay) -> 200
with payment_status 'pending' and exactly the session_id/status/payment_status
fields.
"""
import httpx

from conftest import BASE_URL, make_user
from services.supabase import current_user

ORIGIN = "https://leonida-karte--6tt5kohx.preview.emergentagent.com"


def test_status_unknown_session_is_404():
    r = httpx.get(f"{BASE_URL}/api/payments/status/cs_test_tscheck_unknown_session", timeout=10)
    assert r.status_code == 404


def test_status_fresh_session_is_pending_with_expected_fields(api_client):
    user = make_user("status-fresh")
    app = api_client.app
    app.dependency_overrides[current_user] = lambda: user

    checkout = api_client.post("/api/payments/checkout", json={"tier_id": "bronze", "origin_url": ORIGIN})
    assert checkout.status_code == 200, checkout.text
    session_id = checkout.json()["session_id"]

    # Status endpoint has no auth dependency; hit the real server directly.
    r = httpx.get(f"{BASE_URL}/api/payments/status/{session_id}", timeout=10)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["session_id"] == session_id
    assert body["payment_status"] == "pending"
    assert set(body.keys()) == {"session_id", "status", "payment_status"}
