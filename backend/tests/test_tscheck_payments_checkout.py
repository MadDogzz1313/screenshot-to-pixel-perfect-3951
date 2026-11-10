"""Checkout nur angemeldet & serverseitig validiert.

Unauthenticated rejections are checked against the real running server
(:8001). The authenticated/validated body of the endpoint is checked through
app.dependency_overrides (current_user), since no real Supabase test account
exists (per briefing spec_deviations).
"""
import httpx

from conftest import BASE_URL, make_user
from services.supabase import current_user


def test_checkout_without_bearer_is_401():
    r = httpx.post(f"{BASE_URL}/api/payments/checkout", json={
        "tier_id": "gold", "origin_url": "https://example.com",
    }, timeout=10)
    assert r.status_code == 401


def test_checkout_with_invalid_bearer_is_401():
    r = httpx.post(f"{BASE_URL}/api/payments/checkout", json={
        "tier_id": "gold", "origin_url": "https://example.com",
    }, headers={"Authorization": "Bearer not-a-real-token"}, timeout=10)
    assert r.status_code == 401


ORIGIN = "https://leonida-karte--6tt5kohx.preview.emergentagent.com"


def test_checkout_gold_tier_returns_checkout_url_and_mongo_doc(api_client, mongo_tx):
    user = make_user("checkout-gold")
    app = api_client.app
    app.dependency_overrides[current_user] = lambda: user

    r = api_client.post("/api/payments/checkout", json={"tier_id": "gold", "origin_url": ORIGIN})
    assert r.status_code == 200, r.text
    body = r.json()
    assert "checkout.stripe.com" in body["checkout_url"]
    assert body["session_id"]

    doc = mongo_tx.find_one({"session_id": body["session_id"]})
    assert doc is not None
    assert doc["payment_status"] == "pending"
    assert doc["credit_status"] == "open"
    assert doc["amount_cents"] == 3000
    assert doc["user_id"] == user.id


def test_checkout_custom_amount_777_returns_200(api_client):
    user = make_user("checkout-custom")
    app = api_client.app
    app.dependency_overrides[current_user] = lambda: user

    r = api_client.post("/api/payments/checkout", json={"custom_amount_cents": 777, "origin_url": ORIGIN})
    assert r.status_code == 200, r.text
    assert "checkout.stripe.com" in r.json()["checkout_url"]


def test_checkout_custom_amount_below_min_is_400(api_client):
    user = make_user("checkout-toolow")
    app = api_client.app
    app.dependency_overrides[current_user] = lambda: user

    r = api_client.post("/api/payments/checkout", json={"custom_amount_cents": 50, "origin_url": ORIGIN})
    assert r.status_code == 400


def test_checkout_custom_amount_above_max_is_400(api_client):
    user = make_user("checkout-toohigh")
    app = api_client.app
    app.dependency_overrides[current_user] = lambda: user

    r = api_client.post("/api/payments/checkout", json={"custom_amount_cents": 60000, "origin_url": ORIGIN})
    assert r.status_code == 400


def test_checkout_neither_tier_nor_amount_is_400(api_client):
    user = make_user("checkout-empty")
    app = api_client.app
    app.dependency_overrides[current_user] = lambda: user

    r = api_client.post("/api/payments/checkout", json={"origin_url": ORIGIN})
    assert r.status_code == 400


def test_checkout_unknown_tier_without_amount_is_400(api_client):
    user = make_user("checkout-unknown")
    app = api_client.app
    app.dependency_overrides[current_user] = lambda: user

    r = api_client.post("/api/payments/checkout", json={"tier_id": "doesnotexist", "origin_url": ORIGIN})
    assert r.status_code == 400
