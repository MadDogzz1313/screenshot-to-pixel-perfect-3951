"""Web-Push-Versand für Leonida Explorer.

Die Supabase-Datenbank (Trigger auf notifications, siehe docs/migrations/010) ruft /api/push/dispatch mit dem
geheimen Schlüssel PUSH_WEBHOOK_SECRET auf. Dieser Dienst signiert mit dem privaten VAPID-Schlüssel (nur hier im
Backend) und schickt die Mitteilung an Apple/Google/Mozilla. Abgelaufene Geräte (404/410) werden in Supabase entfernt.
"""
import asyncio
import hmac
import json
import logging
import os

import httpx
from fastapi import APIRouter, Header, HTTPException
from py_vapid import Vapid02
from pywebpush import WebPushException, webpush

from models.push import DispatchRequest, DispatchResult, PublicKey, PushSubscription
from services import apns

router = APIRouter(prefix="/push", tags=["push"])
log = logging.getLogger("push")


def _vapid() -> Vapid02:
    return Vapid02.from_raw(os.environ["VAPID_PRIVATE_KEY"].encode())


def _send_one(sub: PushSubscription, data: str, vapid: Vapid02) -> int:
    """Gibt 201/200 bei Erfolg, sonst den HTTP-Status (z. B. 404/410 = Gerät abgemeldet) oder 0 zurück."""
    try:
        res = webpush(subscription_info=sub.model_dump(), data=data, vapid_private_key=vapid,
                      vapid_claims={"sub": os.environ.get("VAPID_SUBJECT", "mailto:support@leonida.invalid")},
                      ttl=86400, headers={"Urgency": "high"}, timeout=10)
        return res.status_code
    except WebPushException as exc:
        return exc.response.status_code if exc.response is not None else 0
    except Exception:  # Netzwerkfehler etc.
        log.exception("Push-Versand fehlgeschlagen")
        return 0


async def _remove_dead(endpoints: list[str]) -> None:
    url = os.environ.get("SUPABASE_URL") or os.environ.get("VITE_SUPABASE_URL")
    key = os.environ.get("SUPABASE_PUBLISHABLE_KEY") or os.environ.get("VITE_SUPABASE_PUBLISHABLE_KEY")
    if not endpoints or not url or not key:
        return
    async with httpx.AsyncClient(timeout=10) as client:
        await client.post(f"{url}/rest/v1/rpc/push_remove_endpoints",
                          headers={"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                          json={"_secret": os.environ["PUSH_WEBHOOK_SECRET"], "_endpoints": endpoints})


@router.get("/public-key", response_model=PublicKey)
async def public_key() -> PublicKey:
    key = os.environ.get("VAPID_PUBLIC_KEY")
    if not key:
        raise HTTPException(503, "Push ist nicht eingerichtet")
    return PublicKey(publicKey=key)


@router.post("/dispatch", response_model=DispatchResult)
async def dispatch(req: DispatchRequest, x_push_secret: str = Header(default="")) -> DispatchResult:
    secret = os.environ.get("PUSH_WEBHOOK_SECRET", "")
    if not secret or not hmac.compare_digest(x_push_secret.encode(), secret.encode()):
        raise HTTPException(403, "forbidden")
    vapid = _vapid() if req.subscriptions else None
    data = json.dumps(req.payload.model_dump(exclude_none=True), ensure_ascii=False)
    codes = await asyncio.gather(*(asyncio.to_thread(_send_one, s, data, vapid) for s in req.subscriptions))
    dead = [s.endpoint for s, c in zip(req.subscriptions, codes) if c in (404, 410)]
    sent = sum(1 for c in codes if 200 <= c < 300)
    failed = len(codes) - sent - len(dead)
    # iPhone-App (APNs). Ohne Apple-Schlüssel im Backend werden diese Geräte übersprungen (zählen als failed).
    if req.apns_tokens:
        if apns.configured():
            p = req.payload
            results = await asyncio.gather(*(apns.send(t, p.title, p.body, p.url, p.tag, p.notification_id) for t in req.apns_tokens))
        else:
            results = ["failed"] * len(req.apns_tokens)
        dead += [t for t, r in zip(req.apns_tokens, results) if r == "dead"]
        sent += results.count("sent")
        failed += results.count("failed")
    await _remove_dead(dead)
    return DispatchResult(sent=sent, removed=len(dead), failed=failed)
