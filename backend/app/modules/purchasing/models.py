from datetime import date
from decimal import Decimal
from enum import Enum
from typing import TYPE_CHECKING, List
from sqlalchemy import CheckConstraint, Date, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.extensions import db
from app.common.models import CreatedAtMixin, TimestampMixin

if TYPE_CHECKING:
    from app.modules.suppliers.models import Supplier
    from app.modules.users.models import User
    from app.modules.products.models import Product


class PurchaseStatus(str, Enum):
    DRAFT = "DRAFT"
    RECEIVED = "RECEIVED"
    CANCELLED = "CANCELLED"


class Purchase(TimestampMixin, db.Model):
    __tablename__ = "purchases"
    __table_args__ = (
        CheckConstraint("total_amount >= 0", name="ck_purchases_total_amount_non_negative"),
        CheckConstraint("status IN ('DRAFT', 'RECEIVED', 'CANCELLED')", name="ck_purchases_status"),
        CheckConstraint("length(trim(reference_number)) > 0", name="ck_purchases_reference_number_not_empty"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    supplier_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("suppliers.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    reference_number: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    purchase_date: Mapped[date] = mapped_column(Date, index=True, nullable=False)
    status: Mapped[str] = mapped_column(
        String(20),
        default=PurchaseStatus.DRAFT.value,
        server_default=PurchaseStatus.DRAFT.value,
        nullable=False,
    )
    total_amount: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        default=Decimal("0.00"),
        server_default="0.00",
        nullable=False,
    )
    created_by: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    # Relationships
    supplier: Mapped["Supplier"] = relationship("Supplier", back_populates="purchases")
    creator: Mapped["User"] = relationship("User", back_populates="purchases")
    items: Mapped[List["PurchaseItem"]] = relationship("PurchaseItem", back_populates="purchase")

    def __repr__(self) -> str:
        return f"<Purchase id={self.id} ref='{self.reference_number}' status='{self.status}'>"


class PurchaseItem(CreatedAtMixin, db.Model):
    __tablename__ = "purchase_items"
    __table_args__ = (
        CheckConstraint("quantity > 0", name="ck_purchase_items_quantity_positive"),
        CheckConstraint("unit_cost >= 0", name="ck_purchase_items_unit_cost_non_negative"),
        CheckConstraint("subtotal >= 0", name="ck_purchase_items_subtotal_non_negative"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    purchase_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("purchases.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    product_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("products.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    quantity: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    unit_cost: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    subtotal: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)

    # Relationships
    purchase: Mapped["Purchase"] = relationship("Purchase", back_populates="items")
    product: Mapped["Product"] = relationship("Product", back_populates="purchase_items")

    def __repr__(self) -> str:
        return f"<PurchaseItem id={self.id} purchase_id={self.purchase_id} product_id={self.product_id}>"
