from typing import Literal, Optional

from pydantic import BaseModel, Field


class DonationTier(BaseModel):
    id: str
    lookup_key: str
    amount_cents: int


class TiersResponse(BaseModel):
    tiers: list[DonationTier]
    custom_min_cents: int
    custom_max_cents: int


class CheckoutRequest(BaseModel):
    tier_id: Optional[str] = None
    custom_amount_cents: Optional[int] = Field(default=None, ge=1)
    origin_url: str = Field(min_length=8, max_length=300)


class CheckoutResponse(BaseModel):
    checkout_url: str
    session_id: str


class StatusResponse(BaseModel):
    session_id: str
    status: str
    payment_status: str


class AdminDonation(BaseModel):
    session_id: str
    user_id: str
    amount_cents: int
    currency: str
    payment_status: str
    credit_status: Literal["open", "crediting", "credited"]
    created_at: str
    credited_at: Optional[str] = None


class AdminDonationsResponse(BaseModel):
    donations: list[AdminDonation]
