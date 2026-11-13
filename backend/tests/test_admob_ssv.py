"""Tests für die AdMob-SSV-Signaturprüfung (eigener Testschlüssel statt Google-Schlüssel)."""
import base64

import pytest
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import ec
from fastapi.testclient import TestClient

import routers.admob as admob
from server import app


def _signed(query: str, key: ec.EllipticCurvePrivateKey, key_id: str = "123") -> str:
    sig = key.sign(query.encode(), ec.ECDSA(hashes.SHA256()))
    return f"{query}&signature={base64.urlsafe_b64encode(sig).decode().rstrip('=')}&key_id={key_id}"


@pytest.fixture
def priv(monkeypatch):
    k = ec.generate_private_key(ec.SECP256R1())
    async def fake_key(key_id: str):
        return k.public_key() if key_id == "123" else None
    monkeypatch.setattr(admob, "_key", fake_key)
    return k


def test_valid_signature_confirms_reward(priv, monkeypatch):
    seen = {}
    async def fake_confirm(params):
        seen.update(params)
        return {"status": "granted"}
    monkeypatch.setattr(admob, "_confirm", fake_confirm)
    q = "ad_network=5450213213286189855&ad_unit=1554969174&custom_data=00000000-0000-4000-a000-000000000001&reward_amount=1&reward_item=Reward&timestamp=1700000000000&transaction_id=tx-1&user_id=00000000-0000-4000-a000-0000000000e1"
    res = TestClient(app).get("/api/admob/ssv?" + _signed(q, priv))
    assert res.status_code == 200 and res.json()["status"] == "granted"
    assert seen["transaction_id"] == "tx-1" and seen["custom_data"].endswith("0001")


def test_tampered_query_rejected(priv):
    q = "ad_unit=1&custom_data=s&reward_amount=1&transaction_id=tx-2&user_id=u"
    signed = _signed(q, priv).replace("reward_amount=1", "reward_amount=99")
    assert TestClient(app).get("/api/admob/ssv?" + signed).status_code == 403


def test_unknown_key_and_missing_signature(priv):
    q = "ad_unit=1&transaction_id=tx-3"
    assert TestClient(app).get("/api/admob/ssv?" + _signed(q, priv, key_id="999")).status_code == 403
    assert TestClient(app).get("/api/admob/ssv?" + q).status_code == 400


def test_admob_console_test_callback_ok(priv):
    q = "ad_network=5450213213286189855&ad_unit=1234567890&reward_amount=1&reward_item=Reward&timestamp=1700000000000&transaction_id=123456789"
    res = TestClient(app).get("/api/admob/ssv?" + _signed(q, priv))
    assert res.status_code == 200 and res.json()["test"] is True
