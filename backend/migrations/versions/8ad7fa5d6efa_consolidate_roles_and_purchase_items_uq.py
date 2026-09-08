"""consolidate_roles_and_purchase_items_uq

Revision ID: 8ad7fa5d6efa
Revises: d338cda12d0a
Create Date: 2026-09-08 12:20:44.972631

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '8ad7fa5d6efa'
down_revision = 'd338cda12d0a'
branch_labels = None
depends_on = None


def upgrade():
    # 1. Schema change: unique constraint on (purchase_id, product_id)
    with op.batch_alter_table('purchase_items', schema=None) as batch_op:
        batch_op.create_unique_constraint('uq_purchase_items_purchase_product', ['purchase_id', 'product_id'])

    # 2. Data migration: Migrate all ADMIN users to OWNER, then remove ADMIN role
    conn = op.get_bind()
    owner_id = conn.execute(sa.text("SELECT id FROM roles WHERE name = 'OWNER'")).scalar()
    admin_id = conn.execute(sa.text("SELECT id FROM roles WHERE name = 'ADMIN'")).scalar()

    if admin_id:
        if owner_id:
            conn.execute(
                sa.text("UPDATE users SET role_id = :owner_id WHERE role_id = :admin_id"),
                {"owner_id": owner_id, "admin_id": admin_id},
            )
        conn.execute(sa.text("DELETE FROM roles WHERE id = :admin_id"), {"admin_id": admin_id})


def downgrade():
    with op.batch_alter_table('purchase_items', schema=None) as batch_op:
        batch_op.drop_constraint('uq_purchase_items_purchase_product', type_='unique')

    conn = op.get_bind()
    admin_exists = conn.execute(sa.text("SELECT id FROM roles WHERE name = 'ADMIN'")).scalar()
    if not admin_exists:
        conn.execute(
            sa.text(
                "INSERT INTO roles (name, description) VALUES ('ADMIN', 'Administrator with management privileges')"
            )
        )
