"""add_version_id_to_bookings

Revision ID: 00656f685102
Revises: 0f849480b39a
Create Date: 2026-08-09 00:38:05.710597

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '00656f685102'
down_revision = '0f849480b39a'
branch_labels = None
depends_on = None


def upgrade() -> None:
    booking_tables = [
        'flight_bookings', 'hotel_bookings', 'train_bookings', 'bus_bookings', 
        'cab_bookings', 'holiday_package_bookings', 'activity_bookings', 
        'cruise_bookings', 'visa_applications', 'insurance_policies', 
        'villa_bookings', 'forex_orders', 'vehicle_rental_bookings'
    ]
    for table in booking_tables:
        op.add_column(table, sa.Column('version_id', sa.Integer(), nullable=False, server_default='1'))


def downgrade() -> None:
    booking_tables = [
        'flight_bookings', 'hotel_bookings', 'train_bookings', 'bus_bookings', 
        'cab_bookings', 'holiday_package_bookings', 'activity_bookings', 
        'cruise_bookings', 'visa_applications', 'insurance_policies', 
        'villa_bookings', 'forex_orders', 'vehicle_rental_bookings'
    ]
    for table in booking_tables:
        op.drop_column(table, 'version_id')
