"""create_razorpay_payment_tables

Revision ID: 0b1504eb09f8
Revises: None
Create Date: 2026-08-01 10:08:44.112763

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '0b1504eb09f8'
down_revision = 'f7849eecf82b'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create payments table
    op.create_table('payments',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('booking_id', sa.String(length=100), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('amount', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('currency', sa.String(length=10), nullable=False),
        sa.Column('status', sa.Enum('CREATED', 'PENDING', 'AUTHORIZED', 'CAPTURED', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED', name='paymentstatus'), nullable=False),
        sa.Column('payment_method', sa.Enum('CARD', 'UPI', 'NETBANKING', 'WALLET', 'EMI', name='paymentmethod'), nullable=True),
        sa.Column('razorpay_order_id', sa.String(length=100), nullable=True),
        sa.Column('razorpay_payment_id', sa.String(length=100), nullable=True),
        sa.Column('razorpay_signature', sa.String(length=255), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_payments_booking_id'), 'payments', ['booking_id'], unique=True)
    op.create_index(op.f('ix_payments_id'), 'payments', ['id'], unique=False)
    op.create_index(op.f('ix_payments_razorpay_order_id'), 'payments', ['razorpay_order_id'], unique=False)
    op.create_index(op.f('ix_payments_razorpay_payment_id'), 'payments', ['razorpay_payment_id'], unique=False)
    op.create_index(op.f('ix_payments_status'), 'payments', ['status'], unique=False)
    op.create_index(op.f('ix_payments_user_id'), 'payments', ['user_id'], unique=False)

    # Create payment_transactions table
    op.create_table('payment_transactions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('payment_id', sa.Integer(), nullable=False),
        sa.Column('event_type', sa.Enum('ORDER_CREATED', 'PAYMENT_AUTHORIZED', 'PAYMENT_CAPTURED', 'PAYMENT_FAILED', 'WEBHOOK_RECEIVED', name='transactioneventtype'), nullable=False),
        sa.Column('raw_payload', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['payment_id'], ['payments.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_payment_transactions_id'), 'payment_transactions', ['id'], unique=False)
    op.create_index(op.f('ix_payment_transactions_payment_id'), 'payment_transactions', ['payment_id'], unique=False)

    # Create refunds table
    op.create_table('refunds',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('payment_id', sa.Integer(), nullable=False),
        sa.Column('razorpay_refund_id', sa.String(length=100), nullable=True),
        sa.Column('amount', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('status', sa.Enum('PENDING', 'PROCESSED', 'FAILED', name='refundstatus'), nullable=False),
        sa.Column('reason', sa.String(length=255), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['payment_id'], ['payments.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_refunds_id'), 'refunds', ['id'], unique=False)
    op.create_index(op.f('ix_refunds_payment_id'), 'refunds', ['payment_id'], unique=False)
    op.create_index(op.f('ix_refunds_razorpay_refund_id'), 'refunds', ['razorpay_refund_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_refunds_razorpay_refund_id'), table_name='refunds')
    op.drop_index(op.f('ix_refunds_payment_id'), table_name='refunds')
    op.drop_index(op.f('ix_refunds_id'), table_name='refunds')
    op.drop_table('refunds')
    op.drop_index(op.f('ix_payment_transactions_payment_id'), table_name='payment_transactions')
    op.drop_index(op.f('ix_payment_transactions_id'), table_name='payment_transactions')
    op.drop_table('payment_transactions')
    op.drop_index(op.f('ix_payments_user_id'), table_name='payments')
    op.drop_index(op.f('ix_payments_status'), table_name='payments')
    op.drop_index(op.f('ix_payments_razorpay_payment_id'), table_name='payments')
    op.drop_index(op.f('ix_payments_razorpay_order_id'), table_name='payments')
    op.drop_index(op.f('ix_payments_id'), table_name='payments')
    op.drop_index(op.f('ix_payments_booking_id'), table_name='payments')
    op.drop_table('payments')
