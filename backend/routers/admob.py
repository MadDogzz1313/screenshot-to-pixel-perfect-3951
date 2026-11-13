"""Google AdMob Server-Side Verification (SSV) für Rewarded Ads in Leonida Fishing.

Google ruft nach jeder vollständig angesehenen Anzeige GET /api/admob/ssv?...&signature=...&key_id=... auf.
Wir prüfen die ECDSA-Signatur mit Googles öffentlichen Schlüsseln (offizielle Doku:
https://developers.google.com/admob/ios/ssv) und bestätigen erst dann die Belohnung in Supabase
(admob_ssv_confirm, SQL 037; geheimer Schlüssel = PUSH_WEBHOOK_SECRET / push_config.secret).
Replay/Doppelte Aufrufe: transaction_id ist in der Datenbank eindeutig.
"""
import base64
import logging
import os
import time
from urllib.parse import parse_qs

import httpx
from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from fastapi import APIRouter, HTTPException, Request

router = APIRouter(prefix="/admob", tags=["admob"])
log = logging.getLogger("admob")

KEYS_URL = "https://www.gstatic.com/admob/reward/verifier-keys.json"
_KEY_TTL = 12 * 3600
_keys: dict[str, ec.EllipticCurvePublicKey] = {}
_keys_at = 0.0


async def _fetch_keys() -> dict[str, ec.EllipticCurvePublicKey]:
    async with httpx.AsyncClient(timeout=10) as client:
        res = await client.get(KEYS_URL)
        res.raise_for_status()
    out: dict[str, ec.EllipticCurvePublicKey] = {}
    for k in res.json().get("keys", []):
        key = serialization.load_pem_public_key(k["pem"].encode())
        if isinstance(key, ec.EllipticCurvePublicKey):
            out[str(k["keyId"])] = key
    return out


async def _key(key_id: str) -> ec.EllipticCurvePublicKey | None:
    global _keys, _keys_at
    if key_id not in _keys or time.time() - _keys_at > _KEY_TTL:
        _keys, _keys_at = await _fetch_keys(), time.time()  # unbekannte key_id → Schlüssel neu laden (Rotation)
    return _keys.get(key_id)


def split_signed_query(raw_query: str) -> tuple[bytes, str, str]:
    """Signiert ist alles vor '&signature='; signature und key_id stehen laut Google immer am Ende."""
    idx = raw_query.find("&signature=")
    if idx < 0:
        raise ValueError("signature fehlt")
    message = raw_query[:idx].encode()
    tail = parse_qs(raw_query[idx + 1:])
    sig, key_id = tail.get("signature", [""])[0], tail.get("key_id", [""])[0]
    if not sig or not key_id:
        raise ValueError("signature/key_id fehlt")
    return message, sig, key_id


def verify(message: bytes, signature_b64url: str, key: ec.EllipticCurvePublicKey) -> bool:
    sig = base64.urlsafe_b64decode(signature_b64url + "=" * (-len(signature_b64url) % 4))
    try:
        key.verify(sig, message, ec.ECDSA(hashes.SHA256()))
        return True
    except InvalidSignature:
        return False


async def _confirm(params: dict[str, str]) -> dict:
    url = (os.environ.get("SUPABASE_URL") or "").rstrip("/")
    anon = os.environ.get("SUPABASE_PUBLISHABLE_KEY", "")
    secret = os.environ.get("PUSH_WEBHOOK_SECRET", "")
    if not url or not anon or not secret:
        raise HTTPException(503, "SSV ist im Backend nicht eingerichtet")
    body = {"_secret": secret, "_transaction_id": params.get("transaction_id", ""), "_user_id": params.get("user_id"),
            "_session": params.get("custom_data"), "_ad_unit": params.get("ad_unit"),
            "_reward_amount": int(params.get("reward_amount") or 0), "_reward_item": params.get("reward_item")}
    async with httpx.AsyncClient(timeout=10) as client:
        res = await client.post(f"{url}/rest/v1/rpc/admob_ssv_confirm", json=body,
                                headers={"apikey": anon, "Authorization": f"Bearer {anon}", "Content-Type": "application/json"})
    if res.status_code == 200:
        return res.json()
    text = res.text
    # Fachliche Ablehnung (Limit, unbekannte/abgelaufene Sitzung): nicht wiederholen lassen
    for code in ("AD_DAILY_LIMIT", "AD_SESSION_NOT_FOUND", "AD_SESSION_INVALID", "AD_TRANSACTION_REQUIRED", "invalid input syntax for type uuid"):
        if code in text:
            log.warning("SSV abgelehnt: %s", code)
            return {"status": "rejected", "reason": code}
    log.error("SSV-Bestätigung fehlgeschlagen (%s): %s", res.status_code, text[:300])
    raise HTTPException(502, "Bestätigung fehlgeschlagen")  # Google versucht es erneut


@router.get("/ssv")
async def ssv(request: Request) -> dict:
    raw = request.url.query
    try:
        message, sig, key_id = split_signed_query(raw)
    except ValueError:
        raise HTTPException(400, "ungültige Anfrage")
    try:
        key = await _key(key_id)
    except httpx.HTTPError:
        raise HTTPException(503, "Google-Schlüssel nicht erreichbar")
    if key is None or not verify(message, sig, key):
        raise HTTPException(403, "Signatur ungültig")
    params = {k: v[0] for k, v in parse_qs(raw, keep_blank_values=True).items()}
    if not params.get("user_id") or not params.get("custom_data") or not params.get("transaction_id"):
        log.info("SSV-Testaufruf von AdMob (ohne Nutzer/Sitzung) – Signatur gültig")
        return {"status": "ok", "test": True}
    result = await _confirm(params)
    return {"status": result.get("status", "ok")}
