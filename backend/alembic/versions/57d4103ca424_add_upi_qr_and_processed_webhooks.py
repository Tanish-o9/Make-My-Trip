"""add_upi_qr_and_processed_webhooks

Revision ID: 57d4103ca424
Revises: 0b1504eb09f8
Create Date: 2026-08-01 10:16:52.486764

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '57d4103ca424'
down_revision = '0b1504eb09f8'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create processed_webhook_events table
    op.create_table(
        'processed_webhook_events',
        sa.Column('event_id', sa.String(length=100), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('event_id')
    )
    # Add columns to payments table
    op.add_column('payments', sa.Column('qr_code_url', sa.String(length=255), nullable=True))
    op.add_column('payments', sa.Column('qr_code_id', sa.String(length=100), nullable=True))


def downgrade() -> None:
    # Drop columns from payments
    op.drop_column('payments', 'qr_code_id')
    op.drop_column('payments', 'qr_code_url')
    # Drop processed_webhook_events table
    op.drop_table('processed_webhook_events')
