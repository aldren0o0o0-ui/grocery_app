from decimal import Decimal
from enum import Enum
from typing import TYPE_CHECKING, List
from sqlalchemy import CheckConstraint, ForeignKey, Index, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.extensions import db
from app.common.models import CreatedAtMixin, TimestampMixin

if TYPE_CHECKING:
    from app.modules.users.models import User
    from app.modules.products.models import Product
    from app.modules.returns.models import SaleReturn, SaleReturnItem


class SaleStatus(str, Enum):
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"
    RETURNED = "RETURNED"


class PaymentMethod(str, Enum):
    CASH = "CASH"
    GCASH = "GCASH"
    CARD = "CARD"


class Sale(TimestampMixin, db.Model):
    __tablename__ = "sales"
    __table_args__ = (
        CheckConstraint("subtotal >= 0", name="ck_sales_subtotal_non_negative"),
        CheckConstraint("discount >= 0", name="ck_sales_discount_non_negative"),
        CheckConstraint("total >= 0", name="ck_sales_total_non_negative"),
        CheckConstraint("status IN ('COMPLETED', 'CANCELLED', 'RETURNED')", name="ck_sales_status"),
        CheckConstraint("length(trim(invoice_number)) > 0", name="ck_sales_invoice_number_not_empty"),
        Index("ix_sales_created_at_status", "created_at", "status"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    invoice_number: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    cashier_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    subtotal: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    discount: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        default=Decimal("0.00"),
        server_default="0.00",
        nullable=False,
    )
    total: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    status: Mapped[str] = mapped_column(
        String(20),
        default=SaleStatus.COMPLETED.value,
        server_default=SaleStatus.COMPLETED.value,
        nullable=False,
    )

    # Relationships
    cashier: Mapped["User"] = relationship("User", back_populates="sales")
    items: Mapped[List["SaleItem"]] = relationship("SaleItem", back_populates="sale")
    payments: Mapped[List["Payment"]] = relationship("Payment", back_populates="sale")
    returns: Mapped[List["SaleReturn"]] = relationship("SaleReturn", back_populates="sale")

    def __repr__(self) -> str:
        return f"<Sale id={self.id} invoice='{self.invoice_number}' total={self.total} status='{self.status}'>"


class SaleItem(CreatedAtMixin, db.Model):
    __tablename__ = "sale_items"
    __table_args__ = (
        CheckConstraint("quantity > 0", name="ck_sale_items_quantity_positive"),
        CheckConstraint("unit_price >= 0", name="ck_sale_items_unit_price_non_negative"),
        CheckConstraint("cost_price >= 0", name="ck_sale_items_cost_price_non_negative"),
        CheckConstraint("subtotal >= 0", name="ck_sale_items_subtotal_non_negative"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    sale_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("sales.id", ondelete="RESTRICT"),
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
    # Unit price charged to customer at checkout
    unit_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    # Preserves historical product cost for gross margin calculation
    cost_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    subtotal: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)

    # Relationships
    sale: Mapped["Sale"] = relationship("Sale", back_populates="items")
    product: Mapped["Product"] = relationship("Product", back_populates="sale_items")
    return_items: Mapped[List["SaleReturnItem"]] = relationship("SaleReturnItem", back_populates="sale_item")

    def __repr__(self) -> str:
        return f"<SaleItem id={self.id} sale_id={self.sale_id} product_id={self.product_id} subtotal={self.subtotal}>"


class Payment(CreatedAtMixin, db.Model):
    __tablename__ = "payments"
    __table_args__ = (
        CheckConstraint("amount_paid >= 0", name="ck_payments_amount_paid_non_negative"),
        CheckConstraint("change_amount >= 0", name="ck_payments_change_amount_non_negative"),
        CheckConstraint("payment_method IN ('CASH', 'GCASH', 'CARD')", name="ck_payments_payment_method"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    sale_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("sales.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    payment_method: Mapped[str] = mapped_column(String(30), nullable=False)
    amount_paid: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    change_amount: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        default=Decimal("0.00"),
        server_default="0.00",
        nullable=False,
    )

    # Relationships
    sale: Mapped["Sale"] = relationship("Sale", back_populates="payments")

    def __repr__(self) -> str:
        return f"<Payment id={self.id} sale_id={self.sale_id} method='{self.payment_method}' paid={self.amount_paid}>"
