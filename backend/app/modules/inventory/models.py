from decimal import Decimal
from enum import Enum
from typing import TYPE_CHECKING, Optional
from sqlalchemy import CheckConstraint, ForeignKey, Index, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.extensions import db
from app.common.models import CreatedAtMixin

if TYPE_CHECKING:
    from app.modules.products.models import Product
    from app.modules.users.models import User


class StockMovementType(str, Enum):
    PURCHASE = "PURCHASE"
    SALE = "SALE"
    RETURN = "RETURN"
    ADJUSTMENT_IN = "ADJUSTMENT_IN"
    ADJUSTMENT_OUT = "ADJUSTMENT_OUT"
    EXPIRED = "EXPIRED"
    DAMAGED = "DAMAGED"


class StockMovement(CreatedAtMixin, db.Model):
    __tablename__ = "stock_movements"
    __table_args__ = (
        CheckConstraint("quantity > 0", name="ck_stock_movements_quantity_positive"),
        CheckConstraint("quantity_before >= 0", name="ck_stock_movements_quantity_before_non_negative"),
        CheckConstraint("quantity_after >= 0", name="ck_stock_movements_quantity_after_non_negative"),
        CheckConstraint(
            "movement_type IN ('PURCHASE', 'SALE', 'RETURN', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'EXPIRED', 'DAMAGED')",
            name="ck_stock_movements_movement_type",
        ),
        Index("ix_stock_movements_product_id_created_at", "product_id", "created_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    product_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("products.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    movement_type: Mapped[str] = mapped_column(String(30), nullable=False)
    # Quantity is always positive; direction is determined by movement_type
    quantity: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    quantity_before: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    quantity_after: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    reference_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    reference_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    remarks: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_by: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    # Relationships
    product: Mapped["Product"] = relationship("Product", back_populates="stock_movements")
    creator: Mapped["User"] = relationship("User", back_populates="stock_movements")

    def __repr__(self) -> str:
        return f"<StockMovement id={self.id} product_id={self.product_id} type='{self.movement_type}' qty={self.quantity}>"
