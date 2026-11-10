"""Prüft Supabase-Anmeldungen (Lovable Cloud) und führt Aufrufe im Namen des Nutzers aus (RLS gilt weiter)."""
import os
from typing import Any

import httpx
from fastapi import Header, HTTPException


def _cfg() -> tuple[str, str]:
    url = os.environ.get("SUPABASE_URL") or os.environ.get("VITE_SUPABASE_URL")
    key = os.environ.get("SUPABASE_PUBLISHABLE_KEY") or os.environ.get("VITE_SUPABASE_PUBLISHABLE_KEY")
    if not url or not key:
        raise HTTPException(503, "Supabase ist im Backend nicht eingerichtet")
    return url.rstrip("/"), key


def _headers(token: str) -> dict[str, str]:
    return {"apikey": _cfg()[1], "Authorization": f"Bearer {token}", "Content-Type": "application/json"}


async def rest(method: str, path: str, token: str, json: Any = None, prefer: str | None = None) -> httpx.Response:
    headers = _headers(token) | ({"Prefer": prefer} if prefer else {})
    async with httpx.AsyncClient(timeout=10) as client:
        return await client.request(method, f"{_cfg()[0]}{path}", headers=headers, json=json)


class AuthUser:
    def __init__(self, uid: str, token: str):
        self.id, self.token = uid, token


async def current_user(authorization: str = Header(default="")) -> AuthUser:
    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        raise HTTPException(401, "Bitte melde dich an")
    res = await rest("GET", "/auth/v1/user", token)
    if res.status_code != 200 or not res.json().get("id"):
        raise HTTPException(401, "Anmeldung abgelaufen – bitte neu anmelden")
    return AuthUser(res.json()["id"], token)


async def require_admin(user: AuthUser) -> None:
    res = await rest("POST", "/rest/v1/rpc/has_role", user.token, {"_user_id": user.id, "_role": "admin"})
    if res.status_code != 200 or res.json() is not True:
        raise HTTPException(403, "Nur für Admins")
