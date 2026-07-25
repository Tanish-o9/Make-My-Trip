import datetime
from sqlalchemy import String, Integer, DateTime, Boolean, Text, ForeignKey
from typing import Optional
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base

class Offer(Base):
    __tablename__ = "promotional_offers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    category: Mapped[str] = mapped_column(String(50), index=True, nullable=False) # flights, hotels, cabs, holidays
    tags: Mapped[str] = mapped_column(String(100), nullable=True) # e.g. "DOM FLIGHTS", "T&C Apply"
    title: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    image_url: Mapped[str] = mapped_column(String(255), nullable=True)
    promo_code: Mapped[str] = mapped_column(String(30), nullable=True)
    cta_url: Mapped[str] = mapped_column(String(255), nullable=True)
    valid_from: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow)
    valid_to: Mapped[datetime.datetime] = mapped_column(DateTime, nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    seed_batch_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)


class AirlinePartner(Base):
    __tablename__ = "airline_partners"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    logo_url: Mapped[str] = mapped_column(String(255), nullable=True)
    brand_gradient: Mapped[str] = mapped_column(String(100), nullable=True) # CSS gradient definition
    deep_link: Mapped[str] = mapped_column(String(255), nullable=True)
    seed_batch_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)


class HotelBrandPartner(Base):
    __tablename__ = "hotel_brand_partners"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    logo_url: Mapped[str] = mapped_column(String(255), nullable=True)
    property_image_url: Mapped[str] = mapped_column(String(255), nullable=True)
    deep_link: Mapped[str] = mapped_column(String(255), nullable=True)
    seed_batch_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)


class Collection(Base):
    __tablename__ = "collections"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    slug: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(150), nullable=False)
    subtitle: Mapped[str] = mapped_column(String(255), nullable=True)
    collection_type: Mapped[str] = mapped_column(String(50), nullable=False) # personalized, editorial
    display_order: Mapped[int] = mapped_column(Integer, default=0)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    seed_batch_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)


class CollectionItem(Base):
    __tablename__ = "collection_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    collection_id: Mapped[int] = mapped_column(Integer, ForeignKey("collections.id", ondelete="CASCADE"), nullable=False)
    ref_type: Mapped[str] = mapped_column(String(50), nullable=False) # destination, hotel, package, city
    ref_id: Mapped[str] = mapped_column(String(100), nullable=False)
    custom_image_url: Mapped[str] = mapped_column(String(555), nullable=True)
    label: Mapped[str] = mapped_column(String(100), nullable=True)
    tag_text: Mapped[str] = mapped_column(String(255), nullable=True)
    display_order: Mapped[int] = mapped_column(Integer, default=0)
    seed_batch_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)


class InfoHighlight(Base):
    __tablename__ = "info_highlights"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    icon_name: Mapped[str] = mapped_column(String(50), nullable=False)
    title: Mapped[str] = mapped_column(String(150), nullable=False)
    body_text: Mapped[str] = mapped_column(Text, nullable=False)
    cta_url: Mapped[str] = mapped_column(String(255), nullable=True)
    display_order: Mapped[int] = mapped_column(Integer, default=0)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    seed_batch_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)


class PromoBanner(Base):
    __tablename__ = "promo_banners"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    background_color: Mapped[str] = mapped_column(String(100), nullable=False)
    headline: Mapped[str] = mapped_column(String(255), nullable=False)
    cta_text: Mapped[str] = mapped_column(String(100), nullable=False)
    cta_url: Mapped[str] = mapped_column(String(255), nullable=False)
    logo_url: Mapped[str] = mapped_column(String(255), nullable=True)
    placement: Mapped[str] = mapped_column(String(50), default="homepage_mid", index=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    seed_batch_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    valid_from: Mapped[datetime.datetime] = mapped_column(DateTime, default=datetime.datetime.utcnow)
    valid_to: Mapped[datetime.datetime] = mapped_column(DateTime, nullable=False)


class FooterSection(Base):
    __tablename__ = "footer_sections"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String(100), nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, default=0)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    seed_batch_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)


class FooterLink(Base):
    __tablename__ = "footer_links"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    section_id: Mapped[int] = mapped_column(Integer, ForeignKey("footer_sections.id", ondelete="CASCADE"), nullable=False)
    label: Mapped[str] = mapped_column(String(100), nullable=False)
    url: Mapped[str] = mapped_column(String(255), nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, default=0)
    seed_batch_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
