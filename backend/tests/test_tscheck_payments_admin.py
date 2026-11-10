"""Admin-Endpunkte geschuetzt + Doppelgutschrift verhindert.

Unauthenticated behaviour is checked against the real server. The admin
confirm flow (current_user + require_admin overridden, services.supabase.rest
mocked, per briefing) is checked in-process since no real admin Supabase
account exists.
"""
import uuid
from datetime import datetime, timezone

import httpx
import pytest

import routers.payments as payments_module
from conftest import BASE_URL, make_user
from services.supabase import current_user


class FakeRestResponse:
    def __init__(self, status_code: int, text: str = "ok"):
        self.status_code = status_code
        self.text = text


def test_admin_list_without_token_is_401():
    r = httpx.get(f"{BASE_URL}/api/payments/admin/donations", timeout=10)
    assert r.status_code == 401


def test_admin_confirm_without_token_is_401():
    r = httpx.post(f"{BASE_URL}/api/payments/admin/donations/cs_test_whatever/confirm", timeout=10)
    assert r.status_code == 401


def _make_doc(mongo_tx, suffix: str, payment_status: str, credit_status: str) -> dict:
    now = datetime.now(timezone.utc)
    doc = {
        "session_id": f"cs_test_tscheck_admin_{suffix}_{uuid.uuid4().hex[:6]}",
        "user_id": f"tscheck-admin-target-{uuid.uuid4().hex[:6]}",
        "lookup_key": "gold", "amount": 30.0, "amount_cents": 3000, "currency": "eur",
        "status": "completed" if payment_status == "paid" else "initiated",
        "payment_status": payment_status, "credit_status": credit_status,
        "created_at": now, "updated_at": now,
    }
    mongo_tx.insert_one(doc)
    return doc


@pytest.fixture
def admin_client(api_client, monkeypatch):
    admin_user = make_user("admin")
    api_client.app.dependency_overrides[current_user] = lambda: admin_user

    async def fake_require_admin(user):
        return None

    monkeypatch.setattr(payments_module, "require_admin", fake_require_admin)
    return api_client, admin_user


def test_admin_confirm_paid_open_succeeds_then_rejects_double_and_mocks_rest(admin_client, mongo_tx):
    client, admin_user = admin_client
    doc = _make_doc(mongo_tx, "credit", "paid", "open")

    calls = []

    async def fake_rest(method, path, token, json=None, prefer=None):
        calls.append({"method": method, "path": path, "json": json})
        return FakeRestResponse(200, "")

    import routers.payments as rp
    rp.rest = fake_rest  # module attribute used directly by admin_confirm

    r = client.post(f"/api/payments/admin/donations/{doc['session_id']}/confirm")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["credit_status"] == "credited"
    assert body["amount_cents"] == 3000

    assert len(calls) == 1
    assert calls[0]["method"] == "POST"
    assert calls[0]["path"] == "/rest/v1/donations"
    assert calls[0]["json"]["user_id"] == doc["user_id"]
    assert calls[0]["json"]["amount_cents"] == 3000
    assert calls[0]["json"]["verified_by"] == admin_user.id

    # Second confirm on the now-credited doc -> 409 (prevents double credit).
    r2 = client.post(f"/api/payments/admin/donations/{doc['session_id']}/confirm")
    assert r2.status_code == 409

    mongo_tx.delete_one({"session_id": doc["session_id"]})


def test_admin_confirm_pending_doc_is_409(admin_client, mongo_tx):
    client, _ = admin_client
    doc = _make_doc(mongo_tx, "pending", "pending", "open")

    r = client.post(f"/api/payments/admin/donations/{doc['session_id']}/confirm")
    assert r.status_code == 409

    mongo_tx.delete_one({"session_id": doc["session_id"]})


def test_admin_confirm_rest_failure_returns_502_and_reverts_credit_status(admin_client, mongo_tx):
    client, _ = admin_client
    doc = _make_doc(mongo_tx, "revert", "paid", "open")

    async def failing_rest(method, path, token, json=None, prefer=None):
        return FakeRestResponse(400, "bad request")

    import routers.payments as rp
    rp.rest = failing_rest

    r = client.post(f"/api/payments/admin/donations/{doc['session_id']}/confirm")
    assert r.status_code == 502

    fresh = mongo_tx.find_one({"session_id": doc["session_id"]})
    assert fresh["credit_status"] == "open"

    mongo_tx.delete_one({"session_id": doc["session_id"]})


def test_admin_donations_list_contains_created_paid_doc(admin_client, mongo_tx):
    client, _ = admin_client
    doc = _make_doc(mongo_tx, "list", "paid", "open")

    async def ok_rest(method, path, token, json=None, prefer=None):
        return FakeRestResponse(200, "")

    import routers.payments as rp
    rp.rest = ok_rest

    r = client.get("/api/payments/admin/donations")
    assert r.status_code == 200, r.text
    sessions = {d["session_id"] for d in r.json()["donations"]}
    assert doc["session_id"] in sessions

    mongo_tx.delete_one({"session_id": doc["session_id"]})
