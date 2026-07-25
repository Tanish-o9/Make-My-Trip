import logging
import httpx
from sqlalchemy.orm import Session
from app.database import SessionLocal, engine, Base
from app.models import core, bookings, showcase, mybiz, wishlist, agents, media
from app.models.media import Media
from app.services.storage import storage_provider

# Ensure all database tables exist in the target database before seeding
Base.metadata.create_all(bind=engine)


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Mock target listings to seed
SEED_PHOTOS = {
    "hotel": {
        "Grand Hyatt Resort": [
            "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&auto=format&fit=crop&q=60",
            "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=800&auto=format&fit=crop&q=60"
        ],
        "Goa Backpackers Hostel": [
            "https://images.unsplash.com/photo-1555854877-bab0e564b8d5?w=800&auto=format&fit=crop&q=60"
        ]
    },
    "destination": {
        "Goa": [
            "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&auto=format&fit=crop&q=60"
        ],
        "Delhi": [
            "https://images.unsplash.com/photo-1587474260584-136574528ed5?w=800&auto=format&fit=crop&q=60"
        ]
    },
    "partner": {
        "Air India": [
            "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=800&auto=format&fit=crop&q=60"
        ],
        "IndiGo": [
            "https://images.unsplash.com/photo-1540962351504-03099e0a754b?w=800&auto=format&fit=crop&q=60"
        ],
        "Taj Luxury Hotels & Resorts": [
            "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=800&auto=format&fit=crop&q=60"
        ],
        "Grand Hyatt Boutique": [
            "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&auto=format&fit=crop&q=60"
        ]
    }
}

def seed_database_photos():
    db = SessionLocal()
    logger.info("Downloading and converting seed photos to WebP static assets...")
    
    with httpx.Client(timeout=15.0) as client:
        for owner_type, entities in SEED_PHOTOS.items():
            for owner_id, urls in entities.items():
                # Idempotency check per-entity
                exists = db.query(Media).filter(
                    Media.owner_type == owner_type,
                    Media.owner_id == owner_id
                ).first() is not None
                if exists:
                    logger.info(f"Photos for {owner_type} - {owner_id} already exist. Skipping.")
                    continue

                for idx, url in enumerate(urls):
                    try:
                        logger.info(f"Downloading asset for {owner_type} - {owner_id} ({idx+1}/{len(urls)})")
                        response = client.get(url)
                        if response.status_code != 200:
                            logger.warning(f"Failed to fetch stock photo from {url}")
                            continue
                            
                        # Save via storage pipeline
                        file_url, blur_hash = storage_provider.save_file(
                            response.content, 
                            f"{owner_type}_{owner_id.lower().replace(' ', '_')}_{idx}.jpg"
                        )
                        
                        media = Media(
                            owner_type=owner_type,
                            owner_id=owner_id,
                            url=file_url,
                            alt_text=f"Stock representation of {owner_id}",
                            display_order=idx,
                            is_primary=(idx == 0),
                            blur_hash_base64=blur_hash
                        )
                        db.add(media)
                        db.commit()
                        logger.info(f"Saved {owner_type} photo: {file_url}")
                        
                    except Exception as e:
                        logger.error(f"Failed seeding asset {url}: {e}")
                        db.rollback()
                        
    db.close()
    logger.info("Media seeding completed successfully.")

if __name__ == "__main__":
    seed_database_photos()
