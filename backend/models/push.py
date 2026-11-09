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
    subscriptions: list[PushSubscription] = Field(max_length=10)
    payload: PushPayload


class DispatchResult(BaseModel):
    sent: int
    removed: int
    failed: int


class PublicKey(BaseModel):
    publicKey: str
