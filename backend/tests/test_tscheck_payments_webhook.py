"""Webhook-Sicherheit: POST /api/stripe/webhook without a valid stripe-signature -> 400."""
import httpx

BASE_URL = "http://localhost:8001"


def test_webhook_without_valid_signature_is_400():
    r = httpx.post(
        f"{BASE_URL}/api/stripe/webhook",
        content=b'{"id": "evt_tscheck_fake", "type": "checkout.session.completed"}',
        headers={"Content-Type": "application/json", "stripe-signature": "t=1,v1=not-a-real-signature"},
        timeout=10,
    )
    assert r.status_code == 400


def test_webhook_without_signature_header_is_400():
    r = httpx.post(
        f"{BASE_URL}/api/stripe/webhook",
        content=b'{"id": "evt_tscheck_fake2", "type": "checkout.session.completed"}',
        headers={"Content-Type": "application/json"},
        timeout=10,
    )
    assert r.status_code == 400
