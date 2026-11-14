"""Echte Stripe-Spenden. Zahlungen und Prüfstatus liegen in MongoDB (payment_transactions).
Es werden keine Supabase-Spenden oder Spendenabzeichen mehr angelegt.
"""
import asyncio
import logging
import os
from datetime import datetime, timezone

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request
from motor.motor_asyncio import AsyncIOMotorClient

from models.payments import (AdminDonation, AdminDonationsResponse, CheckoutRequest, CheckoutResponse, DonationTier,
                             StatusResponse, TiersResponse)
from services.supabase import AuthUser, current_user, require_admin

log = logging.getLogger("payments")
router = APIRouter()
stripe.api_key = os.environ.get("STRIPE_SECRET_KEY") or "sk_test_emergent"
TAX_MODE = "full"  # Sandbox-Land DE + digitale Leistung -> Stripe übernimmt Steuern (Fallback: nur berechnen)

DONATION_PRODUCT_ID = "leonida_donation"
TIERS = [DonationTier(id=b, lookup_key=f"donation_{c // 100}eur", amount_cents=c) for b, c in [
    ("supporter", 100), ("bronze", 500), ("silver", 1500),
    ("gold", 3000), ("diamond", 5000), ("founder", 10000)]]
CUSTOM_MIN, CUSTOM_MAX = 100, 50000

_db = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ.get("DB_NAME", "leonida_explorer")]
tx = _db["payment_transactions"]


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _price_for(lookup_key: str):
    prices = stripe.Price.list(lookup_keys=[lookup_key], active=True, limit=1).data
    if not prices:
        raise HTTPException(500, "Spendenstufe ist bei Stripe nicht eingerichtet")
    return prices[0]


def _donation_product_id() -> str:
    for p in stripe.Product.list(active=True).auto_paging_iter():
        if p.to_dict().get("metadata", {}).get("emergent_product_id") == DONATION_PRODUCT_ID:
            return p.id
    raise HTTPException(500, "Spendenprodukt ist bei Stripe nicht eingerichtet")


def _create_session(line_item: dict, origin: str, user_id: str, label: str):
    kwargs = dict(
        line_items=[line_item], mode="payment", locale="de",
        success_url=f"{origin}/spende-danke?session_id={{CHECKOUT_SESSION_ID}}",
        cancel_url=f"{origin}/spenden?abgebrochen=1",
        client_reference_id=user_id, metadata={"user_id": user_id, "donation": label},
    )
    if TAX_MODE == "full":
        try:
            return stripe.checkout.Session.create(**kwargs, managed_payments={"enabled": True})
        except stripe.error.InvalidRequestError as e:
            msg = (e.user_message or str(e)).lower()
            if "managed payments" not in msg and "managed_payments" not in msg and "ineligible" not in msg:
                raise
            log.warning("Managed Payments nicht verfügbar, nutze Stripe Tax: %s", msg)
    return stripe.checkout.Session.create(**kwargs, automatic_tax={"enabled": True}, billing_address_collection="required")


@router.get("/payments/tiers", response_model=TiersResponse)
async def tiers() -> TiersResponse:
    return TiersResponse(tiers=TIERS, custom_min_cents=CUSTOM_MIN, custom_max_cents=CUSTOM_MAX)


@router.post("/payments/checkout", response_model=CheckoutResponse)
async def checkout(req: CheckoutRequest, user: AuthUser = Depends(current_user)) -> CheckoutResponse:
    origin = req.origin_url.rstrip("/")
    if not origin.startswith(("https://", "http://localhost")):
        raise HTTPException(400, "Ungültige Herkunft")
    tier = next((t for t in TIERS if t.id == req.tier_id), None)
    if tier:
        price = await asyncio.to_thread(_price_for, tier.lookup_key)
        line_item, amount, label = {"price": price.id, "quantity": 1}, tier.amount_cents, tier.id
    elif req.tier_id is None and req.custom_amount_cents is not None:
        amount = req.custom_amount_cents
        if not CUSTOM_MIN <= amount <= CUSTOM_MAX:
            raise HTTPException(400, f"Betrag muss zwischen {CUSTOM_MIN // 100} € und {CUSTOM_MAX // 100} € liegen")
        product = await asyncio.to_thread(_donation_product_id)
        line_item = {"price_data": {"currency": "eur", "product": product, "unit_amount": amount}, "quantity": 1}
        label = "custom"
    else:
        raise HTTPException(400, "Bitte eine Spendenstufe oder einen Betrag wählen")
    try:
        session = await asyncio.to_thread(_create_session, line_item, origin, user.id, label)
    except stripe.error.StripeError as e:
        log.exception("Stripe-Checkout fehlgeschlagen")
        raise HTTPException(502, "Stripe ist gerade nicht erreichbar – bitte später erneut versuchen") from e
    await tx.insert_one({
        "session_id": session.id, "user_id": user.id, "lookup_key": label, "amount": float(amount),
        "amount_cents": amount, "currency": "eur", "status": "initiated", "payment_status": "pending",
        "credit_status": "open", "created_at": _now(), "updated_at": _now(),
    })
    return CheckoutResponse(checkout_url=session.url, session_id=session.id)


async def _mark_paid(session_id: str, payment_intent: str | None) -> None:
    await tx.update_one({"session_id": session_id, "payment_status": {"$ne": "paid"}},
                        {"$set": {"status": "completed", "payment_status": "paid",
                                  "stripe_payment_intent_id": payment_intent, "updated_at": _now()}})


@router.get("/payments/status/{session_id}", response_model=StatusResponse)
async def status(session_id: str) -> StatusResponse:
    record = await tx.find_one({"session_id": session_id})
    if not record:
        raise HTTPException(404, "Zahlung nicht gefunden")
    if record.get("payment_status") not in ("paid", "expired", "failed", "refunded"):
        try:
            s = await asyncio.to_thread(stripe.checkout.Session.retrieve, session_id)
            if s.payment_status == "paid":
                await _mark_paid(session_id, s.payment_intent)
            elif s.status == "expired":
                await tx.update_one({"session_id": session_id, "payment_status": {"$ne": "paid"}},
                                    {"$set": {"status": "expired", "payment_status": "expired", "updated_at": _now()}})
            record = await tx.find_one({"session_id": session_id})
        except stripe.error.StripeError:
            pass
    return StatusResponse(session_id=record["session_id"], status=record["status"], payment_status=record["payment_status"])


@router.post("/stripe/webhook")
async def stripe_webhook(request: Request) -> dict[str, str]:
    payload, sig = await request.body(), request.headers.get("stripe-signature", "")
    try:
        event = stripe.Webhook.construct_event(payload, sig, os.environ.get("STRIPE_WEBHOOK_SECRET", ""))
    except (stripe.error.SignatureVerificationError, ValueError):
        raise HTTPException(400, "Invalid signature")
    obj, t = event["data"]["object"], event["type"]
    if t in ("checkout.session.completed", "checkout.session.async_payment_succeeded") and obj.get("payment_status") == "paid":
        await _mark_paid(obj["id"], obj.get("payment_intent"))
    elif t == "checkout.session.async_payment_failed":
        await tx.update_one({"session_id": obj["id"]}, {"$set": {"status": "failed", "payment_status": "failed", "updated_at": _now()}})
    elif t == "checkout.session.expired":
        await tx.update_one({"session_id": obj["id"], "payment_status": {"$ne": "paid"}},
                            {"$set": {"status": "expired", "payment_status": "expired", "updated_at": _now()}})
    elif t == "charge.refunded":
        await tx.update_one({"stripe_payment_intent_id": obj.get("payment_intent")},
                            {"$set": {"status": "refunded", "payment_status": "refunded", "updated_at": _now()}})
    return {"status": "ok"}


def _iso(d: datetime | None) -> str | None:
    return d.replace(tzinfo=timezone.utc).isoformat() if d else None


@router.get("/payments/admin/donations", response_model=AdminDonationsResponse)
async def admin_donations(user: AuthUser = Depends(current_user)) -> AdminDonationsResponse:
    await require_admin(user)
    rows = await tx.find({"payment_status": "paid"}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return AdminDonationsResponse(donations=[AdminDonation(
        session_id=r["session_id"], user_id=r["user_id"], amount_cents=r["amount_cents"], currency=r["currency"],
        payment_status=r["payment_status"], credit_status=r.get("credit_status", "open"),
        created_at=_iso(r["created_at"]) or "", credited_at=_iso(r.get("credited_at"))) for r in rows])


@router.post("/payments/admin/donations/{session_id}/confirm", response_model=AdminDonation)
async def admin_confirm(session_id: str, user: AuthUser = Depends(current_user)) -> AdminDonation:
    await require_admin(user)
    # Atomar als geprüft markieren. Es werden keine Badge-/Supabase-Spendenzeilen mehr angelegt.
    r = await tx.find_one_and_update(
      {"session_id": session_id, "payment_status": "paid", "credit_status": {"$in": ["open", None]}},
      {"$set": {"credit_status": "crediting", "updated_at": _now()}})
    if not r:
        raise HTTPException(409, "Spende ist nicht bezahlt oder wurde schon geprüft")
    now = _now()
    await tx.update_one({"session_id": session_id},
                        {"$set": {"credit_status": "credited", "credited_by": user.id, "credited_at": now, "updated_at": now}})
    return AdminDonation(session_id=session_id, user_id=r["user_id"], amount_cents=r["amount_cents"], currency=r["currency"],
                         payment_status="paid", credit_status="credited", created_at=_iso(r["created_at"]) or "",
                         credited_at=_iso(now))
