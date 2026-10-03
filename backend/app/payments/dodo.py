"""Dodo Payments checkout and webhook verification.

Credits are granted only from a verified payment.succeeded webhook, not from
the browser return URL.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import time
from typing import Any

import httpx

from app.core.config import settings
from app.core.exceptions import AppError

_TEST_API = "https://test.dodopayments.com"
_LIVE_API = "https://live.dodopayments.com"
_TOLERANCE_SECONDS = 5 * 60


def dodo_configured() -> bool:
    return bool(settings.dodo_payments_api_key.strip())


def product_id_for_plan(plan_code: str) -> str:
    mapping = {
        "starter": settings.dodo_product_starter,
        "popular": settings.dodo_product_focus,
        "pro": settings.dodo_product_intensive,
    }
    product_id = mapping.get(plan_code, "").strip()
    if not product_id:
        raise AppError("This pack is not connected to checkout yet.", 503, "payments_unconfigured")
    return product_id


def plan_code_for_product(product_id: str) -> str | None:
    mapping = {
        settings.dodo_product_starter.strip(): "starter",
        settings.dodo_product_focus.strip(): "popular",
        settings.dodo_product_intensive.strip(): "pro",
    }
    return mapping.get(product_id.strip()) or None


def create_checkout(
    *,
    plan_code: str,
    email: str,
    name: str,
    user_id: str,
    qubrix_payment_id: str,
) -> tuple[str, str | None]:
    if not dodo_configured():
        raise AppError("Payments are not configured yet.", 503, "payments_unconfigured")

    base = _LIVE_API if settings.dodo_environment == "live_mode" else _TEST_API
    payload = {
        "product_cart": [{"product_id": product_id_for_plan(plan_code), "quantity": 1}],
        "customer": {"email": email, "name": name or email},
        "return_url": f"{settings.app_url.rstrip('/')}/credits",
        "metadata": {
            "user_id": user_id,
            "plan_code": plan_code,
            "qubrix_payment_id": qubrix_payment_id,
        },
    }
    try:
        response = httpx.post(
            f"{base}/checkouts",
            json=payload,
            headers={"Authorization": f"Bearer {settings.dodo_payments_api_key.strip()}"},
            timeout=20,
        )
    except httpx.HTTPError as exc:
        raise AppError("Could not reach the payment provider. Try again.", 502, "payments_unreachable") from exc

    if response.status_code >= 400:
        detail = _error_message(response)
        raise AppError(detail or "Could not start checkout.", 502, "payments_rejected")

    body = response.json()
    checkout_url = body.get("checkout_url") or body.get("payment_link")
    if not isinstance(checkout_url, str) or not checkout_url.startswith("https://"):
        raise AppError("Checkout did not return a payment link.", 502, "payments_rejected")
    session_id = body.get("session_id")
    return checkout_url, session_id if isinstance(session_id, str) and session_id else None


def verify_webhook(payload: bytes, headers: dict[str, str]) -> None:
    secret = settings.dodo_webhook_secret.strip()
    if not secret:
        raise AppError("Webhook secret is not configured.", 503, "payments_unconfigured")

    message_id = headers.get("webhook-id", "")
    timestamp = headers.get("webhook-timestamp", "")
    signature_header = headers.get("webhook-signature", "")
    if not message_id or not timestamp or not signature_header:
        raise AppError("Missing webhook signature.", 400, "invalid_webhook")

    try:
        sent_at = int(timestamp)
    except ValueError as exc:
        raise AppError("Invalid webhook timestamp.", 400, "invalid_webhook") from exc
    if abs(int(time.time()) - sent_at) > _TOLERANCE_SECONDS:
        raise AppError("Webhook timestamp is too old.", 400, "invalid_webhook")

    key = _webhook_key(secret)
    signed = f"{message_id}.{timestamp}.".encode() + payload
    expected = base64.b64encode(hmac.new(key, signed, hashlib.sha256).digest()).decode()
    candidates = []
    for part in signature_header.split():
        version, _, value = part.partition(",")
        if version == "v1" and value:
            candidates.append(value)
    if not any(hmac.compare_digest(expected, candidate) for candidate in candidates):
        raise AppError("Webhook signature did not match.", 400, "invalid_webhook")


def _webhook_key(secret: str) -> bytes:
    raw = secret.removeprefix("whsec_")
    try:
        return base64.b64decode(raw)
    except Exception as exc:
        raise AppError("Webhook secret is invalid.", 503, "payments_unconfigured") from exc


def _error_message(response: httpx.Response) -> str:
    try:
        body: Any = response.json()
    except ValueError:
        return ""
    if isinstance(body, dict):
        message = body.get("message") or body.get("detail")
        if isinstance(message, str):
            return message
    return ""
