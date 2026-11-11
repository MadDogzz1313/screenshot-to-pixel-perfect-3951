from typing import Annotated

from pydantic import BaseModel, Field


class PushKeys(BaseModel):
    p256dh: str = Field(min_length=20, max_length=200)
    auth: str = Field(min_length=8, max_length=100)


class PushSubscription(BaseModel):
    endpoint: str = Field(pattern=r"^https://", max_length=1000)
    keys: PushKeys


class PushPayload(BaseModel):
    title: str = Field(max_length=200)
    body: str = Field(default="", max_length=500)
    url: str = Field(default="/", pattern=r"^/", max_length=300)
    tag: str | None = Field(default=None, max_length=200)
    notification_id: str | None = None


class DispatchRequest(BaseModel):
    subscriptions: list[PushSubscription] = Field(default_factory=list, max_length=10)
    # Apple-Gerätetokens der iPhone-App (SQL 011); fehlt bei älteren Datenbankständen
    apns_tokens: list[Annotated[str, Field(pattern=r"^[0-9a-fA-F]{32,200}$")]] = Field(default_factory=list, max_length=10)
    payload: PushPayload


class DispatchResult(BaseModel):
    sent: int
    removed: int
    failed: int


class PublicKey(BaseModel):
    publicKey: str


class PushServerStatus(BaseModel):
    """Stand der Push-Einrichtung (nur Admins). Enthält nie geheime Werte."""
    server_url: str                 # Adresse, die dieser Server bei „einrichten“ eintragen würde
    web_keys: bool                  # VAPID-Schlüssel vorhanden (Web/PWA)
    apple_keys: bool                # APNs-Schlüssel vorhanden (iPhone-App)
    secret_set: bool                # PUSH_WEBHOOK_SECRET vorhanden
    db_ready: bool                  # SQL 017 ausgeführt
    db_configured: bool = False     # push_config ausgefüllt
    db_url: str | None = None
    db_url_matches: bool = False
    db_secret_matches: bool = False
