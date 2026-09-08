from decimal import Decimal
from typing import TYPE_CHECKING, List
from sqlalchemy import CheckConstraint, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.extensions import db
from app.common.models import CreatedAtMixin, TimestampMixin

if TYPE_CHECKING:
    from app.modules.sales.models import Sale, SaleItem
    from app.modules.users.models import User
    from app.modules.products.models import Product


class SaleReturn(TimestampMixin, db.Model):
    __tablename__ = "sale_returns"
    __table_args__ = (
        CheckConstraint("refund_amount >= 0", name="ck_sale_returns_refund_amount_non_negative"),
        CheckConstraint("refund_method IN ('CASH', 'GCASH', 'CARD')", name="ck_sale_returns_refund_method"),
        CheckConstraint("status = 'COMPLETED'", name="ck_sale_returns_status"),
        CheckConstraint("length(trim(return_number)) > 0", name="ck_sale_returns_return_number_not_empty"),
        CheckConstraint("length(trim(reason)) > 0", name="ck_sale_returns_reason_not_empty"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    return_number: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    sale_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("sales.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    processed_by: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    refund_method: Mapped[str] = mapped_column(String(30), nullable=False)
    refund_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(
        String(20),
        default="COMPLETED",
        server_default="COMPLETED",
        nullable=False,
    )

    # Relationships
    sale: Mapped["Sale"] = relationship("Sale", back_populates="returns")
    processor: Mapped["User"] = relationship("User", back_populates="processed_returns")
    items: Mapped[List["SaleReturnItem"]] = relationship("SaleReturnItem", back_populates="sale_return", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<SaleReturn id={self.id} number='{self.return_number}' sale_id={self.sale_id} refund={self.refund_amount}>"


class SaleReturnItem(CreatedAtMixin, db.Model):
    __tablename__ = "sale_return_items"
    __table_args__ = (
        CheckConstraint("quantity > 0", name="ck_sale_return_items_quantity_positive"),
        CheckConstraint("unit_price >= 0", name="ck_sale_return_items_unit_price_non_negative"),
        CheckConstraint("refund_subtotal >= 0", name="ck_sale_return_items_refund_subtotal_non_negative"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    sale_return_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("sale_returns.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    sale_item_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("sale_items.id", ondelete="RESTRICT"),
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
    # Unit price snapshot from original SaleItem
    unit_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    refund_subtotal: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)

    # Relationships
    sale_return: Mapped["SaleReturn"] = relationship("SaleReturn", back_populates="items")
    sale_item: Mapped["SaleItem"] = relationship("SaleItem", back_populates="return_items")
    product: Mapped["Product"] = relationship("Product", back_populates="return_items")

    def __repr__(self) -> str:
        return f"<SaleReturnItem id={self.id} return_id={self.sale_return_id} product_id={self.product_id} qty={self.quantity}>"
