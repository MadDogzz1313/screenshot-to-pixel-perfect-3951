"""Apple Push Notification service (APNs) für die iPhone-App (Capacitor).

Token-basierte Anmeldung (.p8-Schlüssel, ES256-JWT) über HTTP/2. Die Zugangsdaten liegen nur hier im Backend:
APNS_TEAM_ID, APNS_KEY_ID, APNS_PRIVATE_KEY (Inhalt der .p8-Datei), APNS_BUNDLE_ID, optional APNS_HOST
(Standard: Produktion = TestFlight/App Store; Sandbox nur für Entwickler-Builds aus Xcode).
"""
import asyncio
import json
import logging
import os
import time

import httpx
import jwt

log = logging.getLogger("apns")

PROD_HOST = "https://api.push.apple.com"
_jwt: str | None = None
_jwt_iat = 0
_lock = asyncio.Lock()
_client: httpx.AsyncClient | None = None


def configured() -> bool:
    return all(os.environ.get(k) for k in ("APNS_TEAM_ID", "APNS_KEY_ID", "APNS_PRIVATE_KEY"))


async def _provider_jwt() -> str:
    """Ein Token pro Prozess, Erneuerung nach 50 Minuten (Apple: < 60 min gültig, nicht öfter als alle 20 min)."""
    global _jwt, _jwt_iat
    async with _lock:
        now = int(time.time())
        if _jwt is None or now - _jwt_iat >= 50 * 60:
            key = os.environ["APNS_PRIVATE_KEY"].replace("\\n", "\n")
            _jwt = jwt.encode({"iss": os.environ["APNS_TEAM_ID"], "iat": now}, key, algorithm="ES256",
                              headers={"kid": os.environ["APNS_KEY_ID"]})
            _jwt_iat = now
        return _jwt


def _http() -> httpx.AsyncClient:
    global _client
    if _client is None:
        _client = httpx.AsyncClient(http2=True, timeout=httpx.Timeout(10.0))
    return _client


async def send(token: str, title: str, body: str, url: str, tag: str | None, notification_id: str | None) -> str:
    """Ergebnis: "sent", "dead" (Gerät abgemeldet/ungültig -> entfernen) oder "failed"."""
    payload: dict = {"aps": {"alert": {"title": title, "body": body}, "sound": "default"}, "url": url}
    if tag:
        payload["aps"]["thread-id"] = tag
    if notification_id:
        payload["notification_id"] = notification_id
    headers = {
        "authorization": f"bearer {await _provider_jwt()}",
        "apns-topic": os.environ.get("APNS_BUNDLE_ID", "de.leonida.explorer"),
        "apns-push-type": "alert",
        "apns-priority": "10",
        "apns-expiration": str(int(time.time()) + 86400),
    }
    if tag:
        headers["apns-collapse-id"] = tag.encode()[:64].decode(errors="ignore")
    host = os.environ.get("APNS_HOST", PROD_HOST)
    try:
        res = await _http().post(f"{host}/3/device/{token}", headers=headers,
                                 content=json.dumps(payload, ensure_ascii=False).encode())
    except httpx.HTTPError:
        log.exception("APNs nicht erreichbar")
        return "failed"
    if res.status_code == 200:
        return "sent"
    reason = ""
    try:
        reason = res.json().get("reason", "")
    except ValueError:
        pass
    if res.status_code == 410 or reason in ("Unregistered", "BadDeviceToken", "DeviceTokenNotForTopic"):
        return "dead"
    log.warning("APNs %s: %s", res.status_code, reason)
    return "failed"
