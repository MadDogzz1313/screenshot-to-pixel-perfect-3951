"""
Criterion: Push admin endpoints are protected.
GET /api/push/admin/status and POST /api/push/admin/setup without Authorization -> 401.
With an invalid bearer token -> 401.
GET /api/push/public-key -> 200 with publicKey field.
GET /api/health -> 200.
"""
import httpx

BASE_URL = "http://localhost:8001"


def test_push_admin_status_requires_auth():
    r = httpx.get(f"{BASE_URL}/api/push/admin/status", timeout=10)
    assert r.status_code == 401, f"expected 401, got {r.status_code}: {r.text[:200]}"


def test_push_admin_setup_requires_auth():
    r = httpx.post(f"{BASE_URL}/api/push/admin/setup", timeout=10)
    assert r.status_code == 401, f"expected 401, got {r.status_code}: {r.text[:200]}"


def test_push_admin_status_rejects_invalid_token():
    headers = {"Authorization": "Bearer tscheck-invalid-token-12345"}
    r = httpx.get(f"{BASE_URL}/api/push/admin/status", headers=headers, timeout=10)
    assert r.status_code == 401, f"expected 401, got {r.status_code}: {r.text[:200]}"


def test_push_admin_setup_rejects_invalid_token():
    headers = {"Authorization": "Bearer tscheck-invalid-token-12345"}
    r = httpx.post(f"{BASE_URL}/api/push/admin/setup", headers=headers, timeout=10)
    assert r.status_code == 401, f"expected 401, got {r.status_code}: {r.text[:200]}"


def test_push_public_key_is_public_and_returns_key():
    r = httpx.get(f"{BASE_URL}/api/push/public-key", timeout=10)
    assert r.status_code == 200, f"expected 200, got {r.status_code}: {r.text[:200]}"
    body = r.json()
    assert "publicKey" in body and body["publicKey"], f"publicKey missing/empty: {body}"


def test_health_ok():
    r = httpx.get(f"{BASE_URL}/api/health", timeout=10)
    assert r.status_code == 200, f"expected 200, got {r.status_code}: {r.text[:200]}"
