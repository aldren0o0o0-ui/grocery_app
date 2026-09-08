from datetime import date
from sqlalchemy import Date, Integer, String, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column

from app.extensions import db


class DocumentSequence(db.Model):
    """Stores persistent, concurrency-safe sequential counters for business documents (PUR, SAL, RET)."""

    __tablename__ = "document_sequences"
    __table_args__ = (
        UniqueConstraint("document_type", "business_date", name="uq_document_sequences_type_date"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    document_type: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    business_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    last_value: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    def __repr__(self) -> str:
        return f"<DocumentSequence type='{self.document_type}' date='{self.business_date}' last_value={self.last_value}>"


class SequenceService:
    """Atomic PostgreSQL generator for sequential human-readable document reference numbers."""

    @classmethod
    def next_reference(cls, document_type: str, business_date: date) -> str:
        """Atomically increments and returns the next reference number for a given document type and date.

        Uses PostgreSQL atomic row-level upsert:
        INSERT ... ON CONFLICT (document_type, business_date) DO UPDATE SET last_value = document_sequences.last_value + 1
        RETURNING last_value;

        Guarantees strictly unique, gapless, concurrency-safe references without race conditions.
        Example outputs: PUR-20260908-0001, SAL-20260908-0001, RET-20260908-0001.
        """
        clean_type = document_type.strip().upper()

        # Execute atomic row-level locking upsert in PostgreSQL
        stmt = text("""
            INSERT INTO document_sequences (document_type, business_date, last_value)
            VALUES (:doc_type, :b_date, 1)
            ON CONFLICT (document_type, business_date)
            DO UPDATE SET last_value = document_sequences.last_value + 1
            RETURNING last_value;
        """)

        res = db.session.execute(stmt, {"doc_type": clean_type, "b_date": business_date})
        seq_num = res.scalar_one()

        date_str = business_date.strftime("%Y%m%d")
        ref = f"{clean_type}-{date_str}-{seq_num:04d}"

        # Safety check: in case existing rows from legacy count-based sequences exist for today,
        # advance sequence until ref is globally unique in destination tables
        ref = cls._ensure_legacy_unique(clean_type, business_date, ref, seq_num)
        return ref

    @classmethod
    def _ensure_legacy_unique(cls, doc_type: str, business_date: date, candidate_ref: str, current_seq: int) -> str:
        """Advances sequence past any pre-existing records created prior to DocumentSequence hardening."""
        from app.modules.purchasing.models import Purchase
        from app.modules.sales.models import Sale
        from app.modules.returns.models import SaleReturn

        date_str = business_date.strftime("%Y%m%d")
        seq = current_seq

        while True:
            exists = False
            if doc_type == "PUR":
                exists = db.session.execute(
                    db.select(Purchase.id).filter_by(reference_number=candidate_ref)
                ).scalar_one_or_none() is not None
            elif doc_type == "SAL":
                exists = db.session.execute(
                    db.select(Sale.id).filter_by(invoice_number=candidate_ref)
                ).scalar_one_or_none() is not None
            elif doc_type == "RET":
                exists = db.session.execute(
                    db.select(SaleReturn.id).filter_by(return_number=candidate_ref)
                ).scalar_one_or_none() is not None

            if not exists:
                if seq != current_seq:
                    # Update sequence row to reflect highest advanced value
                    stmt = text("""
                        UPDATE document_sequences
                        SET last_value = :val
                        WHERE document_type = :doc_type AND business_date = :b_date;
                    """)
                    db.session.execute(stmt, {"val": seq, "doc_type": doc_type, "b_date": business_date})
                return candidate_ref

            seq += 1
            candidate_ref = f"{doc_type}-{date_str}-{seq:04d}"
