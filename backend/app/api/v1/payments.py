import json
from uuid import UUID

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.core.exceptions import AppError
from app.core.logging import logger
from app.db.session import get_db
from app.models.enums import CreditTransactionType, PaymentStatus
from app.models.payment import Payment
from app.models.progress import PurchasePlan
from app.models.user import User
from app.payments.dodo import create_checkout, plan_code_for_product, product_id_for_plan, verify_webhook
from app.services.credits import CreditService

router = APIRouter(tags=["payments"])

_STATUS_BY_EVENT = {
    "payment.succeeded": PaymentStatus.SUCCEEDED,
    "payment.failed": PaymentStatus.FAILED,
    "payment.processing": PaymentStatus.PROCESSING,
    "payment.cancelled": PaymentStatus.CANCELLED,
}
_OPEN_STATUSES = (PaymentStatus.PENDING, PaymentStatus.PROCESSING)


class CheckoutRequest(BaseModel):
    plan_code: str


class AbandonCheckoutRequest(BaseModel):
    payment_id: UUID


@router.post("/credits/checkout")
def start_checkout(
    payload: CheckoutRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    plan = db.scalar(select(PurchasePlan).where(PurchasePlan.code == payload.plan_code))
    if plan is None:
        raise AppError("That credit pack does not exist.", 404, "unknown_plan")

    payment = Payment(
        user_id=user.id,
        plan_code=plan.code,
        product_id=product_id_for_plan(plan.code),
        price_inr=plan.price_inr,
        credits=plan.credits,
        status=PaymentStatus.PENDING,
        provider="dodo",
    )
    db.add(payment)
    db.flush()

    try:
        checkout_url, session_id = create_checkout(
            plan_code=plan.code,
            email=user.email,
            name=user.full_name,
            user_id=str(user.id),
            qubrix_payment_id=str(payment.id),
        )
    except AppError as exc:
        payment.status = PaymentStatus.FAILED
        payment.failure_message = exc.message[:500]
        db.commit()
        raise

    payment.provider_session_id = session_id
    db.commit()
    return {"checkout_url": checkout_url, "payment_id": str(payment.id)}


@router.post("/credits/checkout/abandon")
def abandon_checkout(
    payload: AbandonCheckoutRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Mark this user's still-open checkout as cancelled.

    A later payment.succeeded webhook can still complete the same row. Credits
    are never granted here.
    """
    payment = db.scalar(
        select(Payment)
        .where(Payment.id == payload.payment_id, Payment.user_id == user.id)
        .with_for_update()
    )
    if payment is None:
        raise AppError("That checkout does not exist.", 404, "unknown_payment")
    if payment.status == PaymentStatus.PENDING:
        payment.status = PaymentStatus.CANCELLED
        payment.last_event = "checkout.closed"
        payment.failure_message = "Checkout closed before payment"
        db.commit()
    else:
        db.rollback()
    return {"status": str(payment.status)}


@router.post("/payments/dodo/webhook")
async def dodo_webhook(request: Request, db: Session = Depends(get_db)):
    raw = await request.body()
    verify_webhook(raw, {key.lower(): value for key, value in request.headers.items()})
    try:
        event = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise AppError("Webhook body was not JSON.", 400, "invalid_webhook") from exc

    if not isinstance(event, dict):
        raise AppError("Webhook body was not an object.", 400, "invalid_webhook")

    event_type = str(event.get("type") or "")
    next_status = _STATUS_BY_EVENT.get(event_type)
    if next_status is None:
        return {"ok": True, "ignored": event_type or "unknown"}

    data = event.get("data") if isinstance(event.get("data"), dict) else {}
    payment_id = str(data.get("payment_id") or "")
    metadata = data.get("metadata") if isinstance(data.get("metadata"), dict) else {}
    plan_code = str(metadata.get("plan_code") or "")
    product_id = _first_product_id(data)
    mapped = plan_code_for_product(product_id) if product_id else None
    if mapped and plan_code and mapped != plan_code:
        logger.warning("dodo_plan_mismatch", payment_id=payment_id, plan_code=plan_code, product_id=product_id)
        plan_code = mapped
    elif not plan_code:
        plan_code = mapped or ""

    user = _user_from_metadata(db, metadata)
    plan = db.scalar(select(PurchasePlan).where(PurchasePlan.code == plan_code)) if plan_code else None
    payment = _find_payment(db, metadata, payment_id, user, plan_code)

    if payment is None:
        if user is None or plan is None:
            logger.error("dodo_fulfillment_unmatched", payment_id=payment_id, plan_code=plan_code)
            raise AppError("Payment could not be matched to an account.", 422, "unmatched_payment")
        payment = Payment(
            user_id=user.id,
            plan_code=plan.code,
            product_id=product_id or product_id_for_plan(plan.code),
            price_inr=plan.price_inr,
            credits=plan.credits,
            status=PaymentStatus.PENDING,
            provider="dodo",
        )
        db.add(payment)
        db.flush()

    payment = db.scalar(select(Payment).where(Payment.id == payment.id).with_for_update())
    if payment is None:
        raise AppError("Payment could not be matched to an account.", 422, "unmatched_payment")
    if user is not None and payment.user_id != user.id:
        logger.error("dodo_user_mismatch", payment_id=payment_id, payment_row=str(payment.id))
        raise AppError("Payment could not be matched to an account.", 422, "unmatched_payment")

    if payment.status == PaymentStatus.SUCCEEDED and next_status != PaymentStatus.SUCCEEDED:
        payment.last_event = event_type
        db.commit()
        return {"ok": True, "ignored": "already_succeeded"}

    payment.last_event = event_type
    payment.status = next_status
    if payment_id:
        payment.provider_payment_id = payment_id
    customer_id = data.get("customer_id")
    if isinstance(customer_id, str) and customer_id:
        payment.provider_customer_id = customer_id
    currency = data.get("currency")
    if isinstance(currency, str) and currency:
        payment.currency = currency[:8]
    amount = data.get("amount")
    if isinstance(amount, int):
        payment.amount_minor = amount
    if next_status == PaymentStatus.FAILED:
        payment.failure_message = _failure_message(data)

    granted = False
    if next_status == PaymentStatus.SUCCEEDED and not payment.credits_granted:
        owner = user or db.get(User, payment.user_id)
        if owner is None:
            raise AppError("Payment could not be matched to an account.", 422, "unmatched_payment")
        CreditService(db).grant(
            owner,
            payment.credits,
            CreditTransactionType.PURCHASE,
            reference_id=(payment_id or str(payment.id))[:64],
            note=f"{payment.plan_code} pack",
        )
        payment.credits_granted = True
        granted = True

    db.commit()
    logger.info(
        "dodo_payment_updated",
        payment_row=str(payment.id),
        status=payment.status,
        credits_granted=granted,
    )
    return {"ok": True, "status": payment.status, "credits_granted": granted}


def _find_payment(
    db: Session,
    metadata: dict,
    provider_payment_id: str,
    user: User | None,
    plan_code: str,
) -> Payment | None:
    record_id = _parse_uuid(str(metadata.get("qubrix_payment_id") or ""))
    if record_id is not None:
        row = db.get(Payment, record_id)
        if row is not None:
            return row
    if provider_payment_id:
        row = db.scalar(select(Payment).where(Payment.provider_payment_id == provider_payment_id))
        if row is not None:
            return row
    if user is not None and plan_code:
        return db.scalar(
            select(Payment)
            .where(
                Payment.user_id == user.id,
                Payment.plan_code == plan_code,
                Payment.status.in_(_OPEN_STATUSES),
            )
            .order_by(Payment.created_at.desc())
        )
    return None


def _user_from_metadata(db: Session, metadata: dict) -> User | None:
    user_id = _parse_uuid(str(metadata.get("user_id") or ""))
    return db.get(User, user_id) if user_id else None


def _first_product_id(data: dict) -> str:
    cart = data.get("product_cart")
    if isinstance(cart, list) and cart and isinstance(cart[0], dict):
        return str(cart[0].get("product_id") or "")
    return ""


def _failure_message(data: dict) -> str | None:
    message = data.get("error_message") or data.get("error_code")
    if isinstance(message, str) and message.strip():
        return message.strip()[:500]
    return None


def _parse_uuid(value: str) -> UUID | None:
    try:
        return UUID(value)
    except ValueError:
        return None
