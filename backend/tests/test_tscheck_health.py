"""Backend API test: /api/health exists, unknown routes 404."""
import httpx

BASE_URL = "http://localhost:8001"


def test_health_endpoint_ok():
    r = httpx.get(f"{BASE_URL}/api/health", timeout=10)
    assert r.status_code == 200
    body = r.json()
    assert body == {"status": "ok"}


def test_unknown_route_404():
    r = httpx.get(f"{BASE_URL}/api/nope", timeout=10)
    assert r.status_code == 404
