from uuid import UUID, uuid4

from sqlalchemy import Boolean, Enum, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin
from app.models.enums import PaymentStatus


class Payment(Base, TimestampMixin):
    """One checkout attempt for one user. Status is updated from Dodo webhooks."""

    __tablename__ = "payments"
    __table_args__ = (
        UniqueConstraint("provider_payment_id"),
        UniqueConstraint("provider_session_id"),
    )

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id"), index=True, nullable=False
    )
    plan_code: Mapped[str] = mapped_column(String(40), nullable=False)
    product_id: Mapped[str] = mapped_column(String(80), nullable=False)
    price_inr: Mapped[int] = mapped_column(Integer, nullable=False)
    credits: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[PaymentStatus] = mapped_column(
        Enum(PaymentStatus, name="payment_status", native_enum=False),
        default=PaymentStatus.PENDING,
        nullable=False,
        index=True,
    )
    provider: Mapped[str] = mapped_column(String(20), default="dodo", nullable=False)
    provider_session_id: Mapped[str | None] = mapped_column(String(80))
    provider_payment_id: Mapped[str | None] = mapped_column(String(80), index=True)
    provider_customer_id: Mapped[str | None] = mapped_column(String(80))
    currency: Mapped[str] = mapped_column(String(8), default="INR", nullable=False)
    amount_minor: Mapped[int | None] = mapped_column(Integer)
    last_event: Mapped[str | None] = mapped_column(String(80))
    failure_message: Mapped[str | None] = mapped_column(Text)
    credits_granted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
