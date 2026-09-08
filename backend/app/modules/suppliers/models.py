from typing import TYPE_CHECKING, List, Optional
from sqlalchemy import Boolean, CheckConstraint, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.extensions import db
from app.common.models import TimestampMixin

if TYPE_CHECKING:
    from app.modules.purchasing.models import Purchase


class Supplier(TimestampMixin, db.Model):
    __tablename__ = "suppliers"
    __table_args__ = (
        CheckConstraint("length(trim(name)) > 0", name="ck_suppliers_name_not_empty"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(200), index=True, nullable=False)
    contact_person: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        server_default="true",
        nullable=False,
    )

    # Relationships
    purchases: Mapped[List["Purchase"]] = relationship("Purchase", back_populates="supplier")

    def __repr__(self) -> str:
        return f"<Supplier id={self.id} name='{self.name}'>"
