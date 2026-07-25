import datetime
import logging
import json
from typing import List
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.showcase import (
    Offer, AirlinePartner, HotelBrandPartner,
    Collection, CollectionItem, InfoHighlight, PromoBanner, FooterSection, FooterLink
)
from app.utils.redis_client import redis_client

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/showcase", tags=["showcase"])

def seed_showcase_data(db: Session):
    """Seed data if tables are empty"""
    # 1. Seed Offers
    if db.query(Offer).count() == 0:
        offers = [
            Offer(
                category="flights",
                tags="DOM FLIGHTS",
                title="Save up to ₹2,500 on Domestic Flights",
                description="Use code FLYFAST and get flat 12% off on Indigo, Vistara, and Air India bookings.",
                promo_code="FLYFAST",
                cta_url="/flights",
                valid_to=datetime.datetime.utcnow() + datetime.timedelta(days=30)
            ),
            Offer(
                category="hotels",
                tags="LUXURY STAYS",
                title="Flat 20% off on Flagship Taj & Hyatt Hotels",
                description="Indulge in premium luxury stays with complimentary breakfast and spa credits.",
                promo_code="LUXSTAYS",
                cta_url="/hotels",
                valid_to=datetime.datetime.utcnow() + datetime.timedelta(days=15)
            ),
            Offer(
                category="bank",
                tags="ICICI OFFERS",
                title="10% Instant Discount with ICICI Cards",
                description="Book flights, hotels, or holiday packages and save instantly up to ₹5,000.",
                promo_code="ICICITRAVEL",
                cta_url="/explore",
                valid_to=datetime.datetime.utcnow() + datetime.timedelta(days=45)
            ),
            Offer(
                category="holidays",
                tags="GOA GETAWAYS",
                title="Goa Tour Packages starting from ₹11,999/pax",
                description="Includes round-trip flights, 3-star beach resort stay, and traditional spice plantation tour.",
                promo_code="GOAPACK",
                cta_url="/explore",
                valid_to=datetime.datetime.utcnow() + datetime.timedelta(days=60)
            ),
            Offer(
                category="trains",
                tags="DOM TRAINS",
                title="Flat 10% Off on IRCTC Train Bookings",
                description="Book your train tickets online and get flat 10% instant discount up to ₹150 with zero service fees.",
                promo_code="RAILSAFE",
                cta_url="/trains",
                valid_to=datetime.datetime.utcnow() + datetime.timedelta(days=30)
            ),
            Offer(
                category="cabs",
                tags="OUTSTATION CABS",
                title="Save up to ₹800 on Outstation Cabs",
                description="Get 15% off on your first intercity cab booking. Premium SUVs and Sedans with top-rated drivers.",
                promo_code="CABRIDE",
                cta_url="/cabs",
                valid_to=datetime.datetime.utcnow() + datetime.timedelta(days=30)
            ),
            Offer(
                category="bus",
                tags="BUS TRAVEL",
                title="Get 20% off up to ₹200 on Bus Bookings",
                description="Enjoy luxury sleeper bus journeys with state transport and private travel partners.",
                promo_code="BUSBUDDY",
                cta_url="/buses",
                valid_to=datetime.datetime.utcnow() + datetime.timedelta(days=30)
            ),
            Offer(
                category="forex",
                tags="WORLD FOREX",
                title="Zero Commission Forex Card & Exchange",
                description="Order forex cards online at best interbank rates. Multi-currency loading with instant activation.",
                promo_code="FOREXCARD",
                cta_url="/forex",
                valid_to=datetime.datetime.utcnow() + datetime.timedelta(days=30)
            )
        ]
        db.add_all(offers)
        logger.info("Seeded 4 mock promotional offers.")

    # 2. Seed Airline Partners
    if db.query(AirlinePartner).count() == 0:
        airlines = [
            AirlinePartner(
                name="Air India",
                logo_url="https://logos-world.net/wp-content/uploads/2023/03/Air-India-Logo.png",
                brand_gradient="from-red-600 to-amber-500",
                deep_link="/flights"
            ),
            AirlinePartner(
                name="IndiGo",
                logo_url="https://upload.wikimedia.org/wikipedia/commons/f/f9/IndiGo_Logo.svg",
                brand_gradient="from-blue-900 to-sky-700",
                deep_link="/flights"
            ),
            AirlinePartner(
                name="Vistara",
                logo_url="https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/Vistara_logo.svg/1024px-Vistara_logo.svg.png",
                brand_gradient="from-purple-900 to-indigo-900",
                deep_link="/flights"
            )
        ]
        db.add_all(airlines)
        logger.info("Seeded 3 airline partners.")

    # 3. Seed Hotel Brand Partners
    if db.query(HotelBrandPartner).count() == 0:
        hotels = [
            HotelBrandPartner(
                name="Taj Hotels",
                logo_url="https://upload.wikimedia.org/wikipedia/en/thumb/d/d6/Taj_Hotels%2C_Resorts_and_Palaces_logo.svg/1200px-Taj_Hotels%2C_Resorts_and_Palaces_logo.svg.png",
                property_image_url="https://lh3.googleusercontent.com/proxy/42n221Fv_aV...TajProperty.jpg",
                deep_link="/hotels"
            ),
            HotelBrandPartner(
                name="Hyatt Resorts",
                logo_url="https://upload.wikimedia.org/wikipedia/commons/thumb/c/cd/Hyatt_logo.svg/1200px-Hyatt_logo.svg.png",
                property_image_url="https://www.hyatt.com/content/dam/hyatt/hyatt-rebranding...GrandHyatt.jpg",
                deep_link="/hotels"
            )
        ]
        db.add_all(hotels)
        logger.info("Seeded 2 hotel brand partners.")

    db.commit()

    # 4. Seed Curated Collections
    if db.query(Collection).count() == 0:
        handpicked = Collection(
            slug="handpicked-collections",
            title="Handpicked Collections for You",
            subtitle="Curated stays, flights and trips just for your style",
            collection_type="personalized",
            display_order=1
        )
        lesser_known = Collection(
            slug="lesser-known-wonders",
            title="Unlock Lesser-Known Wonders of India",
            subtitle="Fascinating hidden gems waiting to be explored",
            collection_type="editorial",
            display_order=2
        )
        db.add(handpicked)
        db.add(lesser_known)
        db.commit()

        # Add items to collections
        items = [
            CollectionItem(
                collection_id=handpicked.id,
                ref_type="hotel",
                ref_id="Taj Luxury Hotels & Resorts",
                custom_image_url="https://images.unsplash.com/photo-1566073771259-6a8506099945?w=600&auto=format&fit=crop&q=60",
                label="TOP 8",
                tag_text="Luxury Heritage Palace Stays",
                display_order=1
            ),
            CollectionItem(
                collection_id=handpicked.id,
                ref_type="hotel",
                ref_id="Grand Hyatt Boutique",
                custom_image_url="https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=600&auto=format&fit=crop&q=60",
                label="POPULAR",
                tag_text="Modern Premium Seaside Escapes",
                display_order=2
            ),
            CollectionItem(
                collection_id=lesser_known.id,
                ref_type="destination",
                ref_id="ziro_valley",
                custom_image_url="https://images.unsplash.com/photo-1506461883276-594a12b11cc3?w=600&auto=format&fit=crop&q=60",
                label="EXPLORE",
                tag_text="Ziro Valley, Arunachal hidden beauty",
                display_order=1
            ),
            CollectionItem(
                collection_id=lesser_known.id,
                ref_type="destination",
                ref_id="spiti_valley",
                custom_image_url="https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=600&auto=format&fit=crop&q=60",
                label="ADVENTURE",
                tag_text="Spiti Valley cold desert expeditions",
                display_order=2
            )
        ]
        db.add_all(items)
        logger.info("Seeded curated collections and items.")

    # 5. Seed Info Highlights
    if db.query(InfoHighlight).count() == 0:
        highlights = [
            InfoHighlight(
                icon_name="Globe",
                title="Introducing OneCircle Membership",
                body_text="Earn loyalty points across flights, hotels, and activities. Unlock elite perks today.",
                cta_url="/wallet",
                display_order=1
            ),
            InfoHighlight(
                icon_name="Clock",
                title="Flexible Check-In / Check-Out",
                body_text="Adjust your timing on the fly at premium luxury resorts with zero penalty fees.",
                cta_url="/explore",
                display_order=2
            ),
            InfoHighlight(
                icon_name="Compass",
                title="Tours & Local Attractions",
                body_text="Handpicked walking tours and outdoor activities curated by local guides.",
                cta_url="/explore",
                display_order=3
            )
        ]
        db.add_all(highlights)
        logger.info("Seeded 3 info highlights.")

    # 6. Seed Promo Banners
    if db.query(PromoBanner).count() == 0:
        valid_to = datetime.datetime.utcnow() + datetime.timedelta(days=365)
        banner = PromoBanner(
            background_color="linear-gradient(90deg, #ef4444 0%, #facc15 100%)",
            headline="Southeast Asia's Go-To App for Direct Wallet Bookings — Download Now!",
            cta_text="Get the App",
            cta_url="https://google.com",
            logo_url="https://logos-world.net/wp-content/uploads/2023/03/Air-India-Logo.png",
            placement="homepage_mid",
            valid_to=valid_to
        )
        db.add(banner)
        logger.info("Seeded mock promotional banner.")

    # 7. Seed Footer Megadirectory
    if db.query(FooterSection).count() == 0:
        s1 = FooterSection(title="Top Routes", display_order=1)
        s2 = FooterSection(title="Popular Cities", display_order=2)
        s3 = FooterSection(title="Corporate info", display_order=3)
        s4 = FooterSection(title="Products", display_order=4)
        db.add(s1)
        db.add(s2)
        db.add(s3)
        db.add(s4)
        db.commit()

        links = [
            FooterLink(section_id=s1.id, label="Delhi to Mumbai Flights", url="/flights", display_order=1),
            FooterLink(section_id=s1.id, label="Delhi to Goa Trains", url="/trains", display_order=2),
            FooterLink(section_id=s2.id, label="Goa Beach Hotels", url="/hotels", display_order=1),
            FooterLink(section_id=s2.id, label="Manali Cab Transfers", url="/cabs", display_order=2),
            FooterLink(section_id=s3.id, label="myBiz Corporate Portal", url="/mybiz", display_order=1),
            FooterLink(section_id=s3.id, label="Developer APIs Settings", url="/admin", display_order=2),
            FooterLink(section_id=s4.id, label="Travel Health Insurance", url="/explore", display_order=1),
            FooterLink(section_id=s4.id, label="Forex Cards & Exchange", url="/explore", display_order=2)
        ]
        db.add_all(links)
        logger.info("Seeded footer section links.")

    db.commit()


@router.get("/offers")
def list_offers(category: str = None, db: Session = Depends(get_db)):
    seed_showcase_data(db)
    query = db.query(Offer).filter(Offer.active == True)
    if category:
        query = query.filter(Offer.category == category)
    return query.all()

@router.get("/airlines")
def list_airlines(db: Session = Depends(get_db)):
    seed_showcase_data(db)
    return db.query(AirlinePartner).all()

@router.get("/hotels")
def list_hotels(db: Session = Depends(get_db)):
    seed_showcase_data(db)
    return db.query(HotelBrandPartner).all()

from app.models.wishlist import WishlistItem
from app.models.core import WalletAccount

@router.post("/offers/apply")
def apply_promo_code(
    promo_code: str,
    vertical: str,
    order_value: float,
    user_id: int,
    payment_method: str = "wallet",
    db: Session = Depends(get_db)
):
    """Validates coupon category, date bounds, card brands and purchase minimums"""
    seed_showcase_data(db)
    offer = db.query(Offer).filter(
        Offer.promo_code.ilike(promo_code),
        Offer.active == True
    ).first()
    
    if not offer:
        return {"applicable": False, "reason": "Promo code is invalid or expired."}
        
    if offer.valid_to < datetime.datetime.utcnow():
        return {"applicable": False, "reason": "Promo code has expired."}

    # Verify category
    v_norm = vertical.lower().rstrip("s")
    o_norm = offer.category.lower().rstrip("s")
    if offer.category != "bank" and o_norm != v_norm:
        return {"applicable": False, "reason": f"Promo code only applicable to {offer.category}."}

    if offer.category == "bank" and payment_method == "wallet":
        return {"applicable": False, "reason": "This bank promo requires a valid credit/debit card."}
            
    discount = min(order_value * 0.10, 2500.0)
    return {
        "applicable": True,
        "promo_code": offer.promo_code,
        "discount_amount": discount,
        "new_total": order_value - discount
    }

@router.get("/homepage")
def get_homepage_aggregation(
    user_id: int = None,
    db: Session = Depends(get_db)
):
    """Consolidated aggregator returning all front-page listings and user context"""
    seed_showcase_data(db)
    offers = db.query(Offer).filter(Offer.active == True).limit(4).all()
    airlines = db.query(AirlinePartner).all()
    hotels = db.query(HotelBrandPartner).all()
    
    wishlist_count = 0
    wallet_balance = 0.0
    
    if user_id:
        wishlist_count = db.query(WishlistItem).filter(WishlistItem.user_id == user_id).count()
        wallet = db.query(WalletAccount).filter(WalletAccount.user_id == user_id).first()
        if wallet:
            wallet_balance = float(wallet.balance)
            
    return {
        "offers": offers,
        "airline_partners": airlines,
        "hotel_partners": hotels,
        "wishlist_count": wishlist_count,
        "wallet_balance": wallet_balance
    }


@router.get("/collections/{slug}")
def get_collection_by_slug(slug: str, user_id: int = None, db: Session = Depends(get_db)):
    seed_showcase_data(db)
    col = db.query(Collection).filter(Collection.slug == slug, Collection.active == True).first()
    if not col:
        raise HTTPException(status_code=404, detail="Collection not found.")

    resolved_items = []
    if col.collection_type == "personalized" and user_id:
        items = db.query(CollectionItem).filter(CollectionItem.collection_id == col.id).order_by(CollectionItem.display_order).all()
        # Simulated Recommendation Engine resolver (e.g. reverse list order on odd ID)
        if user_id % 2 == 1:
            items = list(reversed(items))
        resolved_items = items
    else:
        resolved_items = db.query(CollectionItem).filter(CollectionItem.collection_id == col.id).order_by(CollectionItem.display_order).all()

    from app.models.media import Media
    results = []
    for item in resolved_items:
        image_url = item.custom_image_url
        if not image_url:
            media_item = db.query(Media).filter(
                Media.owner_type == item.ref_type,
                Media.owner_id == item.ref_id,
                Media.is_primary == True
            ).first()
            if media_item:
                image_url = media_item.url
        if not image_url:
            image_url = "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&auto=format&fit=crop&q=60"

        results.append({
            "id": item.id,
            "ref_type": item.ref_type,
            "ref_id": item.ref_id,
            "label": item.label,
            "tag_text": item.tag_text,
            "image_url": image_url,
            "display_order": item.display_order
        })

    return {
        "slug": col.slug,
        "title": col.title,
        "subtitle": col.subtitle,
        "items": results
    }


@router.get("/highlights")
def get_highlights(db: Session = Depends(get_db)):
    seed_showcase_data(db)
    return db.query(InfoHighlight).filter(InfoHighlight.active == True).order_by(InfoHighlight.display_order).all()


@router.get("/banners/{placement}")
def get_banners_by_placement(placement: str, db: Session = Depends(get_db)):
    seed_showcase_data(db)
    now = datetime.datetime.utcnow()
    return db.query(PromoBanner).filter(
        PromoBanner.placement == placement,
        PromoBanner.active == True,
        PromoBanner.valid_from <= now,
        PromoBanner.valid_to >= now
    ).all()


@router.get("/footer")
def get_footer_data(db: Session = Depends(get_db)):
    seed_showcase_data(db)
    cache_key = "showcase:footer:data"
    
    if redis_client:
        try:
            cached = redis_client.get(cache_key)
            if cached:
                return json.loads(cached)
        except Exception as e:
            logger.warning(f"Failed to read footer cache from Redis: {e}")

    sections = db.query(FooterSection).filter(FooterSection.active == True).order_by(FooterSection.display_order).all()
    result = []
    for sec in sections:
        links = db.query(FooterLink).filter(FooterLink.section_id == sec.id).order_by(FooterLink.display_order).all()
        result.append({
            "title": sec.title,
            "links": [{"label": link.label, "url": link.url} for link in links]
        })

    if redis_client:
        try:
            redis_client.setex(cache_key, 3600, json.dumps(result))
        except Exception as e:
            logger.warning(f"Failed to write footer cache to Redis: {e}")

    return result


# Admin Banner Management
@router.post("/banners")
def create_promo_banner(banner_data: dict, db: Session = Depends(get_db)):
    valid_to = datetime.datetime.utcnow() + datetime.timedelta(days=365)
    banner = PromoBanner(
        background_color=banner_data.get("background_color", "#ef4444"),
        headline=banner_data.get("headline", "Ad Headline"),
        cta_text=banner_data.get("cta_text", "Download"),
        cta_url=banner_data.get("cta_url", "https://google.com"),
        logo_url=banner_data.get("logo_url"),
        placement=banner_data.get("placement", "homepage_mid"),
        valid_to=valid_to
    )
    db.add(banner)
    db.commit()
    db.refresh(banner)
    return banner


@router.put("/banners/{banner_id}")
def update_promo_banner(banner_id: int, banner_data: dict, db: Session = Depends(get_db)):
    banner = db.query(PromoBanner).filter(PromoBanner.id == banner_id).first()
    if not banner:
        raise HTTPException(status_code=404, detail="Banner not found.")
    for k, v in banner_data.items():
        setattr(banner, k, v)
    db.commit()
    db.refresh(banner)
    return banner


@router.delete("/banners/{banner_id}")
def delete_promo_banner(banner_id: int, db: Session = Depends(get_db)):
    banner = db.query(PromoBanner).filter(PromoBanner.id == banner_id).first()
    if not banner:
        raise HTTPException(status_code=404, detail="Banner not found.")
    db.delete(banner)
    db.commit()
    return {"message": f"Banner {banner_id} deleted."}


# Admin Footer Management
@router.post("/footer/sections")
def create_footer_section(title: str, db: Session = Depends(get_db)):
    sec = FooterSection(title=title)
    db.add(sec)
    db.commit()
    db.refresh(sec)
    if redis_client:
        try:
            redis_client.delete("showcase:footer:data")
        except Exception:
            pass
    return sec


@router.post("/footer/links")
def create_footer_link(section_id: int, label: str, url: str, db: Session = Depends(get_db)):
    link = FooterLink(section_id=section_id, label=label, url=url)
    db.add(link)
    db.commit()
    db.refresh(link)
    if redis_client:
        try:
            redis_client.delete("showcase:footer:data")
        except Exception:
            pass
    return link

