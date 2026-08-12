import os
import json
import random
import argparse
import datetime
from typing import List
from faker import Faker
from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.database import SessionLocal, engine, Base
from app.models import core, bookings, showcase, mybiz, wishlist, agents, media, search_entities
from app.models.core import User, SavedTraveler, SavedPaymentMethod, LoyaltyAccount, WalletAccount, Coupon
from app.models.showcase import Offer, AirlinePartner, HotelBrandPartner, Collection, CollectionItem, InfoHighlight, PromoBanner, FooterSection, FooterLink
from app.models.agents import DestinationCostBaseline
from app.models.media import Media
from app.models.bookings import (
    FlightBooking, HotelBooking, TrainBooking, BusBooking, CabBooking,
    HolidayPackageBooking, ActivityBooking, CruiseBooking, VisaApplication,
    InsurancePolicy, VillaBooking, ForexOrder, BookingStatus
)
from app.models.search_entities import (
    City, Airport, TrainStation, BusTerminal, CurrencyExchange,
    CountryVisaRequirement, TollPlaza, FlightRoute, HotelProperty,
    HotelRoom, VillaProperty, HolidayPackage, TrainRoute, BusRoute,
    CabVehicle, TourActivity, CruiseItinerary, InsurancePlan, RentalVehicle,
    State, District, Locality, VehicleAvailability
)

# Set random seeds for reproducibility
random.seed(42)
fake = Faker()
Faker.seed(42)

SEED_BATCH_ID = "seed_batch_demo"

# Load config values
CONFIG_PATH = os.path.join(os.path.dirname(__file__), "seed_config.json")
if os.path.exists(CONFIG_PATH):
    with open(CONFIG_PATH, "r") as f:
        config = json.load(f)
else:
    config = {
        "cities_count": 15,
        "hotels_per_city": 15,
        "villas_per_city": 8,
        "cabs_per_city": 6,
        "tours_per_city": 10,
        "flights_per_route": 4,
        "packages_count": 12,
        "trains_count": 10,
        "buses_count": 12,
        "cruises_count": 6,
        "insurance_plans_count": 4
    }

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def run_reset():
    db = SessionLocal()
    print("Resetting all seeded data...")
    tables = [
        User, SavedTraveler, SavedPaymentMethod, LoyaltyAccount, WalletAccount, Coupon,
        Offer, AirlinePartner, HotelBrandPartner, Collection, CollectionItem, InfoHighlight,
        PromoBanner, FooterSection, FooterLink, DestinationCostBaseline, Media,
        FlightBooking, HotelBooking, TrainBooking, BusBooking, CabBooking,
        HolidayPackageBooking, ActivityBooking, CruiseBooking, VisaApplication,
        InsurancePolicy, VillaBooking, ForexOrder, City, Airport, TrainStation,
        BusTerminal, CurrencyExchange, CountryVisaRequirement, TollPlaza,
        FlightRoute, HotelProperty, HotelRoom, VillaProperty, HolidayPackage,
        TrainRoute, BusRoute, CabVehicle, TourActivity, CruiseItinerary, InsurancePlan, RentalVehicle,
        State, District, Locality
    ]
    for table in tables:
        try:
            stmt = delete(table).where(table.seed_batch_id == SEED_BATCH_ID)
            db.execute(stmt)
            db.commit()
        except Exception as e:
            print(f"Failed to reset table {table.__tablename__}: {e}")
            db.rollback()
    db.close()
    print("Database reset completed successfully.")

def run_reference():
    db = SessionLocal()
    print("Seeding reference/master data...")

    # 1. Cities
    cities_data = [
        ("Goa", "India", 15.2993, 74.1240, "Asia/Kolkata"),
        ("Delhi", "India", 28.6139, 77.2090, "Asia/Kolkata"),
        ("Mumbai", "India", 19.0760, 72.8777, "Asia/Kolkata"),
        ("Srinagar", "India", 34.0837, 74.7973, "Asia/Kolkata"),
        ("Bengaluru", "India", 12.9716, 77.5946, "Asia/Kolkata"),
        ("Kolkata", "India", 22.5726, 88.3639, "Asia/Kolkata"),
        ("Chennai", "India", 13.0827, 80.2707, "Asia/Kolkata"),
        ("Hyderabad", "India", 17.3850, 78.4867, "Asia/Kolkata"),
        ("Pune", "India", 18.5204, 73.8567, "Asia/Kolkata"),
        ("Kochi", "India", 9.9312, 76.2673, "Asia/Kolkata"),
        ("Jaipur", "India", 26.9124, 75.7873, "Asia/Kolkata"),
        ("Ahmedabad", "India", 23.0225, 72.5714, "Asia/Kolkata"),
        ("Amritsar", "India", 31.6340, 74.8723, "Asia/Kolkata"),
        ("Dehradun", "India", 30.3165, 78.0322, "Asia/Kolkata"),
        ("Leh", "India", 34.1526, 77.5771, "Asia/Kolkata"),
        ("Manali", "India", 32.2396, 77.1887, "Asia/Kolkata"),
        ("Shimla", "India", 31.1048, 77.1734, "Asia/Kolkata"),
        ("Udaipur", "India", 24.5854, 73.7125, "Asia/Kolkata"),
        ("Rishikesh", "India", 30.0869, 78.2676, "Asia/Kolkata"),
        ("Varanasi", "India", 25.3176, 82.9739, "Asia/Kolkata"),
        ("Mysore", "India", 12.2958, 76.6394, "Asia/Kolkata"),
        ("Darjeeling", "India", 27.0410, 88.2627, "Asia/Kolkata"),
    ]

    cities = []
    for name, country, lat, lng, tz in cities_data[:config["cities_count"]]:
        city = db.query(City).filter(City.name == name).first()
        if not city:
            city = City(name=name, country=country, lat=lat, lng=lng, timezone=tz, seed_batch_id=SEED_BATCH_ID)
            db.add(city)
            db.commit()
            db.refresh(city)
        cities.append(city)

    # 2. Airports
    airports_data = {
        "Delhi": ("DEL", "Indira Gandhi International Airport"),
        "Goa": ("GOI", "Manohar International Airport Mopa"),
        "Mumbai": ("BOM", "Chhatrapati Shivaji Maharaj Airport"),
        "Srinagar": ("SXR", "Sheikh ul-Alam International Airport"),
        "Bengaluru": ("BLR", "Kempegowda International Airport"),
        "Kolkata": ("CCU", "Netaji Subhash Chandra Bose Airport"),
        "Chennai": ("MAA", "Chennai International Airport"),
        "Hyderabad": ("HYD", "Rajiv Gandhi International Airport"),
        "Pune": ("PNQ", "Pune International Airport"),
        "Kochi": ("COK", "Cochin International Airport"),
        "Jaipur": ("JAI", "Jaipur International Airport"),
        "Ahmedabad": ("AMD", "Sardar Vallabhbhai Patel Airport"),
        "Amritsar": ("ATQ", "Sri Guru Ram Dass Jee Airport"),
        "Dehradun": ("DED", "Jolly Grant Airport"),
        "Leh": ("IXL", "Kushok Bakula Rimpochee Airport")
    }
    for city in cities:
        if city.name in airports_data:
            code, name = airports_data[city.name]
            exists = db.query(Airport).filter(Airport.code == code).first()
            if not exists:
                db.add(Airport(code=code, name=name, city_id=city.id, seed_batch_id=SEED_BATCH_ID))
    db.commit()

    # 3. Train Stations
    train_stations_data = {
        "Delhi": ("NDLS", "New Delhi Railway Station"),
        "Mumbai": ("CSMT", "Chhatrapati Shivaji Terminal"),
        "Bengaluru": ("SBC", "KSR Bengaluru City Junction"),
        "Kochi": ("ERS", "Ernakulam Junction"),
        "Goa": ("MAO", "Madgaon Railway Station")
    }
    for city_name, (code, name) in train_stations_data.items():
        city = db.query(City).filter(City.name == city_name).first()
        if city:
            exists = db.query(TrainStation).filter(TrainStation.code == code).first()
            if not exists:
                db.add(TrainStation(code=code, name=name, city_id=city.id, seed_batch_id=SEED_BATCH_ID))
    db.commit()

    # 4. Bus Terminals
    bus_terminals_data = {
        "Delhi": ("ISBT-K", "Kashmere Gate ISBT"),
        "Mumbai": ("MUM-B", "Borivali Bus Terminal"),
        "Goa": ("PAN-B", "Panaji Bus Stand")
    }
    for city_name, (code, name) in bus_terminals_data.items():
        city = db.query(City).filter(City.name == city_name).first()
        if city:
            exists = db.query(BusTerminal).filter(BusTerminal.code == code).first()
            if not exists:
                db.add(BusTerminal(code=code, name=name, city_id=city.id, seed_batch_id=SEED_BATCH_ID))
    db.commit()

    # 5. Currency Exchange Rates
    currencies = [
        ("USD", 84.50),
        ("EUR", 91.80),
        ("GBP", 107.20),
        ("SGD", 62.10),
        ("AED", 23.00)
    ]
    for code, rate in currencies:
        exists = db.query(CurrencyExchange).filter(CurrencyExchange.code == code).first()
        if not exists:
            db.add(CurrencyExchange(code=code, rate_to_inr=rate, seed_batch_id=SEED_BATCH_ID))
    db.commit()

    # 6. DestinationCostBaseline
    cost_baselines = [
        ("Goa", 1500, 800, 1200),
        ("Delhi", 1000, 600, 800),
        ("Mumbai", 1800, 900, 1500),
        ("Srinagar", 1200, 700, 1000),
        ("Manali", 1100, 650, 900),
        ("Shimla", 1100, 650, 900),
        ("Udaipur", 1200, 700, 1000),
        ("Rishikesh", 900, 500, 1200),
        ("Varanasi", 800, 450, 700),
        ("Mysore", 1000, 600, 800),
        ("Darjeeling", 1100, 650, 900)
    ]
    for dest, food, transport, act in cost_baselines:
        exists = db.query(DestinationCostBaseline).filter(DestinationCostBaseline.destination == dest).first()
        if not exists:
            db.add(DestinationCostBaseline(destination=dest, daily_food_cost=food, daily_transport_cost=transport, daily_activities_cost=act, seed_batch_id=SEED_BATCH_ID))
    db.commit()

    # 7. CountryVisaRequirement
    visa_reqs = [
        ("France", "Indian passport holders require standard Schengen biometric visa. Processing takes 15 business days. Min bank balance: ₹1,50,000.", ["Valid passport", "2 Photos", "Flight itinerary", "Hotel vouchers", "Sufficient funds bank statement"], 7800),
        ("Thailand", "Indian citizens qualify for Visa on Arrival (VoA) / Visa Exempt policy for tourism up to 30 days. No advance processing fee required.", ["Passport with 6 months validity", "Confirmed return ticket", "Proof of accommodation", "10,000 THB per person"], 0),
        ("United States", "Requires US Embassy B1/B2 tourist scheduling and physical biometric + visa interview. Processing time varies from 30 to 120 days.", ["DS-160 Confirmation Page", "Appointment letter", "Current passport", "Financial/employment proof"], 15500)
    ]
    for country, rules, checklist, fee in visa_reqs:
        exists = db.query(CountryVisaRequirement).filter(CountryVisaRequirement.country == country).first()
        if not exists:
            db.add(CountryVisaRequirement(country=country, rules=rules, checklist=checklist, fee=fee, seed_batch_id=SEED_BATCH_ID))
    db.commit()

    # 8. Toll Plazas
    tolls = [
        ("Kherki Daula Toll Plaza", "Delhi-Jaipur Highway", 80),
        ("Shahjahanpur Toll Plaza", "Delhi-Jaipur Highway", 145),
        ("Khalghat Toll Plaza", "Mumbai-Indore Highway", 115)
    ]
    for name, route, fee in tolls:
        exists = db.query(TollPlaza).filter(TollPlaza.name == name).first()
        if not exists:
            db.add(TollPlaza(name=name, route=route, toll_fee=fee, seed_batch_id=SEED_BATCH_ID))
    db.commit()

    db.close()
    print("Reference/Master data seeded successfully.")

def run_flights():
    db = SessionLocal()
    print("Seeding Flight Routes and schedules...")
    airports = db.query(Airport).all()
    if not airports:
        print("Please seed reference data first!")
        db.close()
        return

    airlines = [
        ("6E", "IndiGo", 4500),
        ("AI", "Air India", 5200),
        ("UK", "Vistara", 6000),
        ("QP", "Akasa Air", 4300)
    ]

    # Generate routes between every pair of airports
    for origin in airports:
        for dest in airports:
            if origin.code == dest.code:
                continue
            
            # Select 2 airlines randomly for this route to generate flight schedules
            selected_airlines = random.sample(airlines, 2)
            for air_code, air_name, base_price in selected_airlines:
                for flight_idx in range(config["flights_per_route"]):
                    flight_num = f"{air_code}-{(origin.id * 13 + dest.id * 17 + flight_idx * 9) % 900 + 100}"
                    
                    exists = db.query(FlightRoute).filter(FlightRoute.flight_number == flight_num).first()
                    if not exists:
                        dep_time = f"{8 + flight_idx * 3:02d}:00"
                        db.add(FlightRoute(
                            origin=origin.code,
                            destination=dest.code,
                            airline_code=air_code,
                            airline_name=air_name,
                            flight_number=flight_num,
                            base_price=base_price + (flight_idx * 300),
                            departure_time=dep_time,
                            seed_batch_id=SEED_BATCH_ID
                        ))
    db.commit()
    db.close()
    print("Flight Routes seeded successfully.")

def run_hotels():
    db = SessionLocal()
    print("Seeding Hotel Properties & Rooms...")
    # Clear existing hotels and associated media to ensure a clean, unique seed
    try:
        db.query(Media).filter(Media.owner_type == "hotel").delete()
        # HotelRoom will be cascade deleted automatically because of ForeignKey ondelete="CASCADE"
        db.query(HotelProperty).delete()
        db.commit()
        print("Cleared existing hotels and hotel media for a clean seeding run.")
    except Exception as e:
        db.rollback()
        print(f"Warning: Failed to clear existing hotels: {e}")

    cities = db.query(City).all()
    if not cities:
        print("Please seed reference data first!")
        db.close()
        return

    # Pools of brands by category
    luxury_brands = [
        "Taj Palace", "Oberoi Grand", "The Leela Maharaja", "Marriott Premier", 
        "ITC Grand Landmark", "Sheraton Executive", "Hyatt Regency", "Radisson Plaza", 
        "Westin Resort & Spa", "The Lodhi", "Trident Imperial", "The Lalit Palace", 
        "Alila Heritage", "St. Regis Premium", "Fairmont Castle", "JW Marriott",
        "W Escapes Resort", "Ritz-Carlton Reserve"
    ]
    business_brands = [
        "Grand Continental", "Regency Business Inn", "Oakwood Suites", "Lemon Tree Premier", 
        "Fern Residency", "Novotel Hub", "Holiday Inn Express", "Ginger Prime", 
        "Ibis Styles", "Sayaji Grand", "Fortune Select", "Park Plaza", "Pride Plaza",
        "Key Select Inn", "Capital Suites Hotel"
    ]
    resort_brands = [
        "Misty Meadows Resort", "Whispering Pines Retreat", "Mementos Heritage", "The Hideaway Resort", 
        "Forest Hills Resort", "Serene Palms Villa", "Rivera Heights Resort", "Sands Ocean Resort", 
        "Coral Reef Oasis", "Wildflower Hall", "The Glenburn Retreat", "Ahilya Fort Boutique", 
        "Bari Kothi Heritage", "Ananda Spa Resort", "Evolve Back Lodge", "Khyber Mountain Resort",
        "Windflower Spa", "Heritage Retreat Palace"
    ]
    budget_brands = [
        "Zostel Cafe & Stay", "Backpackers Den", "Stops Hostel", "FabHotel Classic", 
        "Treebo Trend Inn", "Comfy Beds", "Urban Nest Stay", "Nomads Hostel", 
        "Econostay", "Metro Inn", "Blue Sky Cottage", "Bed & Breakfast Comfort",
        "Backpackers Nest", "Sweet Sleep Inn"
    ]

    # Category images
    luxury_images = [
        "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800",
        "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=800",
        "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=800",
        "https://images.unsplash.com/photo-1582719508461-905c673771fd?w=800",
        "https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800",
        "https://images.unsplash.com/photo-1445019980597-93fa8acb246c?w=800",
        "https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800",
        "https://images.unsplash.com/photo-1596394516093-501ba68a0ba6?w=800",
        "https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=800",
        "https://images.unsplash.com/photo-1590490360182-c33d57733427?w=800",
        "https://images.unsplash.com/photo-1578683010236-d716f9a3f461?w=800",
        "https://images.unsplash.com/photo-1541971875076-8f970d573be6?w=800"
    ]
    business_images = [
        "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=800",
        "https://images.unsplash.com/photo-1496417263034-38ec4f0b665a?w=800",
        "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800",
        "https://images.unsplash.com/photo-1584132967334-10e028bd69f7?w=800",
        "https://images.unsplash.com/photo-1568495248636-6432b97bd949?w=800",
        "https://images.unsplash.com/photo-1606046604972-77cc76aee944?w=800",
        "https://images.unsplash.com/photo-1598928506311-c55ded91a20c?w=800",
        "https://images.unsplash.com/photo-1611048267451-e6ed903d4a38?w=800",
        "https://images.unsplash.com/photo-1590490360182-c33d57733427?w=800",
        "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800"
    ]
    resort_images = [
        "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800",
        "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=800",
        "https://images.unsplash.com/photo-1506929562872-bb421503ef21?w=800",
        "https://images.unsplash.com/photo-1510798831971-661eb04b3739?w=800",
        "https://images.unsplash.com/photo-1470770841072-f978cf4d019e?w=800",
        "https://images.unsplash.com/photo-1464146072230-91cabc968266?w=800",
        "https://images.unsplash.com/photo-1505873242700-f289a29e1e0f?w=800",
        "https://images.unsplash.com/photo-1522338242992-e1a54906a8da?w=800",
        "https://images.unsplash.com/photo-1549294413-26f195afcbce?w=800",
        "https://images.unsplash.com/photo-1535827841776-24afc1e255bc?w=800"
    ]
    budget_images = [
        "https://images.unsplash.com/photo-1555854877-bab0e564b8d5?w=800",
        "https://images.unsplash.com/photo-1629140727571-9b5c6f6267b4?w=800",
        "https://images.unsplash.com/photo-1520271348391-019da1df6157?w=800",
        "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800",
        "https://images.unsplash.com/photo-1566665797739-1674de7a421a?w=800",
        "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=800",
        "https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?w=800",
        "https://images.unsplash.com/photo-1596550001029-806052416b08?w=800",
        "https://images.unsplash.com/photo-1560185007-c5ca9d2c014d?w=800",
        "https://images.unsplash.com/photo-1560185893-a55cbc2c78a9?w=800"
    ]

    limit = config.get("hotels_per_city", 25)

    # Let's seed unique properties
    for city in cities:
        # Create a list of 25 unique hotel brands for this city
        is_leisure_city = city.name in ["Goa", "Manali", "Shimla", "Srinagar", "Rishikesh", "Darjeeling", "Leh", "Udaipur"]
        
        if is_leisure_city:
            # More resorts & boutique hotels
            mix = (
                [("Luxury Resort", b) for b in luxury_brands] * 2 +
                [("Mountain Resort" if city.name in ["Manali", "Shimla", "Darjeeling", "Leh", "Srinagar"] else "Beach Resort" if city.name == "Goa" else "Heritage Resort", b) for b in resort_brands] * 2 +
                [("Boutique Hotel", b) for b in resort_brands] +
                [("Budget Hotel", b) for b in budget_brands] +
                [("Business Hotel", b) for b in business_brands]
            )
        else:
            # More business & city hotels
            mix = (
                [("Business Hotel", b) for b in business_brands] * 2 +
                [("City Hotel", b) for b in business_brands] +
                [("Luxury Hotel", b) for b in luxury_brands] * 2 +
                [("Boutique Hotel", b) for b in resort_brands] +
                [("Budget Hotel", b) for b in budget_brands] * 2
            )
        
        random.shuffle(mix)
        selected_mix = mix[:limit]
        
        for idx, (cat, brand) in enumerate(selected_mix):
            # Prepend city name and add index to guarantee uniqueness
            name = f"{city.name} {brand} {idx+1}"
            
            exists = db.query(HotelProperty).filter(HotelProperty.name == name).first()
            if not exists:
                # Assign star ratings
                if "Luxury" in cat:
                    star = f"{random.choice([4.5, 4.7, 4.8, 5.0])} ★"
                    guest_review_score = round(random.uniform(9.0, 9.8), 1)
                elif "Resort" in cat or "Boutique" in cat:
                    star = f"{random.choice([4.0, 4.2, 4.5])} ★"
                    guest_review_score = round(random.uniform(8.2, 9.2), 1)
                elif "Business" in cat:
                    star = f"{random.choice([3.8, 4.0, 4.2])} ★"
                    guest_review_score = round(random.uniform(7.8, 8.8), 1)
                else:
                    star = f"{random.choice([2.5, 3.0, 3.5])} ★"
                    guest_review_score = round(random.uniform(6.5, 7.8), 1)
                
                review_count = random.randint(50, 2500)
                breakfast_included = random.choice([True, False])
                free_cancellation = random.choice([True, False])
                
                # Dynamic base price factors based on category
                if "Luxury" in cat:
                    base_price = random.choice([15000.0, 18000.0, 22000.0, 28000.0, 35000.0])
                elif "Resort" in cat:
                    base_price = random.choice([8000.0, 10000.0, 12000.0, 15000.0, 18000.0])
                elif "Boutique" in cat:
                    base_price = random.choice([5500.0, 6500.0, 7500.0, 9000.0, 11000.0])
                elif "Business" in cat:
                    base_price = random.choice([4000.0, 5000.0, 6000.0, 7500.0, 9000.0])
                else:
                    base_price = random.choice([950.0, 1200.0, 1500.0, 1800.0, 2200.0])
                
                # City location neighborhoods for addresses
                neighborhoods = {
                    "Delhi": ["Connaught Place", "Saket", "Aerocity", "Karol Bagh", "Dwarka"],
                    "Mumbai": ["Colaba", "Bandra Kurla Complex", "Juhu Beach", "Andheri West", "Marine Drive"],
                    "Goa": ["Calangute", "Candolim", "Anjuna Beach", "Panaji", "Benaulim"],
                    "Srinagar": ["Dal Lake Road", "Rajbagh", "Shalimar", "Nishat"],
                    "Bengaluru": ["Indiranagar", "Koramangala", "Whitefield", "MG Road", "Jayanagar"],
                    "Kolkata": ["Park Street", "Salt Lake Sector V", "New Town", "Ballygunge"],
                    "Chennai": ["Nungambakkam", "Mylapore", "T. Nagar", "OMR", "Marina Beach"],
                    "Hyderabad": ["Gachibowli", "Banjara Hills", "Jubilee Hills", "HITEC City"],
                    "Pune": ["Koregaon Park", "Kalyani Nagar", "Viman Nagar", "Hinjewadi"],
                    "Kochi": ["Fort Kochi", "Marine Drive", "Kakkanad", "Edapally"],
                    "Jaipur": ["C-Scheme", "Malviya Nagar", "Bani Park", "Amer Road"],
                    "Ahmedabad": ["C.G. Road", "Satellite", "SG Highway", "Ashram Road"],
                    "Amritsar": ["Golden Temple Road", "Ranjit Avenue", "Civil Lines"],
                    "Dehradun": ["Rajpur Road", "Clement Town", "Dehradun Heights"],
                    "Leh": ["Main Bazaar", "Changspa", "Fort Road", "Chubi"],
                    "Manali": ["Mall Road", "Old Manali", "Solang Valley", "Vashisht"],
                    "Shimla": ["Mall Road", "Lakkar Bazaar", "Chotta Shimla", "Kufri"],
                    "Udaipur": ["Lake Pichola", "Fateh Sagar", "Hiran Magri", "City Palace area"],
                    "Rishikesh": ["Tapovan", "Laxman Jhula", "Ram Jhula", "Swargashram"],
                    "Varanasi": ["Dashashwamedh Ghat", "Assi Ghat", "Cantonment", "Sarnath"],
                    "Mysore": ["Gokulam", "Devaraja Mohalla", "Mysore Palace area", "Vijayanagar"],
                    "Darjeeling": ["Chowrasta Mall", "Gandhi Road", "Happy Valley", "Lebong Cart Road"]
                }
                
                nb_list = neighborhoods.get(city.name, ["Center Sector 1", "Main Road", "Downtown"])
                addr = f"Plot {idx + 101}, {random.choice(nb_list)}, {city.name}, India"
                
                # Pool of unique photo URLs based on category
                if "Luxury" in cat:
                    photo_pool = luxury_images
                elif "Resort" in cat:
                    photo_pool = resort_images
                elif "Budget" in cat or "Hostel" in cat:
                    photo_pool = budget_images
                elif "Business" in cat:
                    photo_pool = business_images
                else:
                    photo_pool = resort_images
                
                photo_url = photo_pool[idx % len(photo_pool)]
                # Append signature parameter to make URL uniquely identifiable for browser loading
                photo_url = f"{photo_url}&unique={city.name.lower()}-{idx+1}"

                # Category-specific descriptive text
                desc_texts = {
                    "Luxury Resort": f"A breathtaking luxury resort offering world-class spa treatments, infinity pools, and gourmet dining in {city.name}.",
                    "Luxury Hotel": f"An ultra-premium corporate hotel with top-tier business facilities, plush accommodations, and fine dining in {city.name}.",
                    "Beach Resort": f"A premium beachfront getaway featuring direct sand access, water sports, and beautiful seaside views in {city.name}.",
                    "Mountain Resort": f"A cozy mountain sanctuary nestled among scenic peaks, offering guided treks and bonfire dining in {city.name}.",
                    "Heritage Resort": f"A historically restored royal palace providing retro heritage living combined with modern comforts in {city.name}.",
                    "Boutique Hotel": f"A chic, artistically designed hotel featuring curated interiors, personalized butler service, and local flavors in {city.name}.",
                    "Business Hotel": f"A modern corporate hotel located near major tech parks and hubs, optimized for working travelers in {city.name}.",
                    "City Hotel": f"A centrally located hotel steps away from shopping streets, metro lines, and local heritage sights in {city.name}.",
                    "Budget Hotel": f"A highly affordable, clean, and safe hotel offering cozy beds and essential amenities in the heart of {city.name}.",
                    "Hostel": f"A vibrant social hostel with shared bunk rooms, community kitchen, gaming zone, and regular traveler meetups in {city.name}."
                }
                
                text_desc = desc_texts.get(cat, f"A lovely {cat.lower()} offering comfortable rooms and warm hospitality in the center of {city.name}.")

                # Embed all extra properties in description JSON
                desc_json = {
                    "text": text_desc,
                    "guest_review_score": guest_review_score,
                    "review_count": review_count,
                    "category": cat,
                    "breakfast_included": breakfast_included,
                    "free_cancellation": free_cancellation,
                    "distance_from_center": round(random.uniform(0.3, 7.5), 1),
                    "lat": float(city.lat) + random.uniform(-0.015, 0.015),
                    "lng": float(city.lng) + random.uniform(-0.015, 0.015)
                }

                amenities = ["Free WiFi", "Air Conditioning", "Housekeeping", "Attached Bathroom"]
                if "Luxury" in cat or "Resort" in cat:
                    amenities.extend(["Swimming Pool", "Wellness Spa", "Fitness Gym", "Fine Dining Bar", "24/7 Room Service"])
                elif "Business" in cat:
                    amenities.extend(["Meeting Rooms", "Business Center", "Fitness Gym", "Ironing Service", "Valet Parking"])
                elif "Boutique" in cat:
                    amenities.extend(["Custom Minibar", "Fine Dining Bar", "Valet Parking", "Espresso Machine"])
                
                hotel = HotelProperty(
                    city_id=city.id,
                    name=name,
                    star_rating=star,
                    address=addr,
                    description=json.dumps(desc_json),
                    amenities_json=amenities,
                    seed_batch_id=SEED_BATCH_ID
                )
                db.add(hotel)
                db.commit()
                db.refresh(hotel)

                # Seed Media row for hotel
                db.add(Media(
                    owner_type="hotel",
                    owner_id=name,
                    url=photo_url,
                    alt_text=f"Photo of {name}",
                    is_primary=True,
                    blur_hash_base64="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
                    seed_batch_id=SEED_BATCH_ID
                ))

                # Add rooms for this hotel
                db.add(HotelRoom(
                    hotel_id=hotel.id,
                    room_type="Deluxe Room",
                    price=base_price,
                    description="Standard comfortable room with twin/queen bed and basic amenities.",
                    seed_batch_id=SEED_BATCH_ID
                ))
                db.add(HotelRoom(
                    hotel_id=hotel.id,
                    room_type="Executive Suite",
                    price=base_price * 1.6,
                    description="Spacious suite with king bed, personal workspace, and city/seaview.",
                    seed_batch_id=SEED_BATCH_ID
                ))
                db.add(HotelRoom(
                    hotel_id=hotel.id,
                    room_type="Presidential Suite",
                    price=base_price * 3.2,
                    description="Grand master suite with private jacuzzi, kitchenette, and dedicated butler.",
                    seed_batch_id=SEED_BATCH_ID
                ))
                
    db.commit()
    db.close()
    print("Hotels and rooms seeded successfully.")

def run_villas():
    db = SessionLocal()
    print("Seeding Villas & Homestays...")
    cities = db.query(City).all()
    if not cities:
        db.close()
        return

    villa_names = [
        "Seaview Luxury Villa", "Sunset Cottage", "Hilltop Hideaway", "Riverside Log Cabin",
        "Orchard Homestay", "Emerald Heritage Estate", "Pine Wood Chalet", "Serene Oasis Villa"
    ]

    villa_photo_pool = [
        "https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=800",
        "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800",
        "https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800",
        "https://images.unsplash.com/photo-1613977257363-707ba9348227?w=800",
        "https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?w=800"
    ]

    cottage_photo_pool = [
        "https://images.unsplash.com/photo-1542718610-a1d656d1884c?w=800",
        "https://images.unsplash.com/photo-1587061949409-02df41d5e562?w=800",
        "https://images.unsplash.com/photo-1464146072230-91cabc968266?w=800",
        "https://images.unsplash.com/photo-1510798831971-661eb04b3739?w=800",
        "https://images.unsplash.com/photo-1470770841072-f978cf4d019e?w=800"
    ]

    homestay_photo_pool = [
        "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800",
        "https://images.unsplash.com/photo-1518780664697-55e3ad937233?w=800",
        "https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=800",
        "https://images.unsplash.com/photo-1505873242700-f289a29e1e0f?w=800",
        "https://images.unsplash.com/photo-1522338242992-e1a54906a8da?w=800"
    ]

    for city in cities:
        available_names = list(villa_names)
        random.shuffle(available_names)
        limit = min(len(available_names), config["villas_per_city"])
        
        for idx in range(limit):
            name = f"{city.name} {available_names[idx]}"
            exists = db.query(VillaProperty).filter(VillaProperty.name == name).first()
            if not exists:
                rating = f"{random.choice([4.3, 4.5, 4.7, 4.9])} ★"
                price = 6000.0 + (idx * 1500)
                bedrooms = 2 + (idx % 3)
                max_occ = bedrooms * 2
                
                if idx % 3 == 0:
                    prop_type = "Villa"
                    details_str = f"{bedrooms} Bedrooms, Private Pool, Lawn garden garden spaces. Superhost managed."
                    url = villa_photo_pool[(idx + city.id) % len(villa_photo_pool)]
                elif idx % 3 == 1:
                    prop_type = "Homestay"
                    details_str = f"{bedrooms} Bedrooms, Local homemade breakfast included, rich hospitality, and city tours."
                    url = homestay_photo_pool[(idx + city.id) % len(homestay_photo_pool)]
                else:
                    prop_type = "Cottage"
                    details_str = f"{bedrooms} Bedrooms, Cozy wooden structure with private lawn sitting area and fireplace."
                    url = cottage_photo_pool[(idx + city.id) % len(cottage_photo_pool)]
                
                villa = VillaProperty(
                    city_id=city.id,
                    name=name,
                    rating=rating,
                    price=price,
                    details=details_str,
                    bedrooms=bedrooms,
                    max_occupancy=max_occ,
                    property_type=prop_type,
                    host_name=fake.name(),
                    house_rules="No parties allowed. Pets permitted with prior notice. Quiet hours: 10 PM - 8 AM.",
                    seed_batch_id=SEED_BATCH_ID
                )
                db.add(villa)
                db.commit()
                db.refresh(villa)

                # Seed Media row for villa
                db.add(Media(
                    owner_type="villa",
                    owner_id=name,
                    url=url,
                    alt_text=f"Photo of {name}",
                    is_primary=True,
                    blur_hash_base64="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
                    seed_batch_id=SEED_BATCH_ID
                ))
    db.commit()
    db.close()
    print("Villas seeded successfully.")

def run_packages():
    db = SessionLocal()
    print("Seeding Holiday Packages...")
    
    packages_list = [
        ("Premium Goa Beach Escape", "5 Days / 4 Nights", 24999.0, "Flights + 4-Star Resort + Sightseeing"),
        ("Spiti Valley Backpacking Adventure", "7 Days / 6 Nights", 18999.0, "Shared Stays + Daily Breakfast + Guide"),
        ("Rajasthan Heritage Palace Tour", "6 Days / 5 Nights", 29999.0, "Palace Stay + Intercity Cabs + Dinner"),
        ("Kerala Houseboat Backwater Cruise", "4 Days / 3 Nights", 15999.0, "Premium Houseboat + Airport Transfers"),
        ("Leh Ladakh Mountain Pass Ride", "8 Days / 7 Nights", 34999.0, "Royal Enfield Rental + Camps + Backup Vehicle")
    ]

    for idx, (name, duration, price, inclusions) in enumerate(packages_list):
        exists = db.query(HolidayPackage).filter(HolidayPackage.name == name).first()
        if not exists:
            db.add(HolidayPackage(
                name=name,
                duration=duration,
                price=price,
                inclusions=inclusions,
                details=f"Complete guided itinerary showcasing the finest landscapes, local culinary tastings, and heritage walks.",
                seed_batch_id=SEED_BATCH_ID
            ))
    db.commit()
    db.close()
    print("Holiday packages seeded successfully.")

def run_trains():
    db = SessionLocal()
    print("Seeding Train Routes...")

    trains = [
        ("12626", "Kerala Express", "NDLS", "ERS", "20:00", "30h 15m"),
        ("22633", "Nizamuddin Rajdhani", "NDLS", "CSMT", "16:40", "26h 40m"),
        ("12137", "Punjab Mail", "NDLS", "ATQ", "07:15", "08h 30m"),
        ("10111", "Konkan Kanya Express", "CSMT", "MAO", "23:05", "09h 45m")
    ]

    for num, name, origin, dest, dep_time, dur in trains:
        exists = db.query(TrainRoute).filter(TrainRoute.train_number == num).first()
        if not exists:
            db.add(TrainRoute(
                train_number=num,
                train_name=name,
                origin_station=origin,
                destination_station=dest,
                departure_time=dep_time,
                duration=dur,
                classes_json={"SL": 650, "3A": 1850, "2A": 3400, "1A": 4900},
                seed_batch_id=SEED_BATCH_ID
            ))
    db.commit()
    db.close()
    print("Trains seeded successfully.")

def run_buses():
    db = SessionLocal()
    print("Seeding Bus Routes...")
    
    buses = [
        ("IntrCity SmartBus", "AC Sleeper (2+1)", 1490.0, "21:00", "Delhi", "Jaipur"),
        ("Zingbus", "AC Premium Seater", 950.0, "22:30", "Delhi", "Amritsar"),
        ("Paulo Travels", "Multi-Axle Scania AC", 1600.0, "23:45", "Mumbai", "Goa")
    ]

    for idx, (op, b_type, price, dep_time, origin, dest) in enumerate(buses):
        exists = db.query(BusRoute).filter(BusRoute.operator_name == op, BusRoute.origin == origin).first()
        if not exists:
            seats_map = ["1A", "1B", "2A", "2B", "3A", "3B", "4A", "4B", "5A", "5B", "6A", "6B", "7A", "7B"]
            db.add(BusRoute(
                operator_name=op,
                bus_type=b_type,
                price=price,
                departure_time=dep_time,
                origin=origin,
                destination=dest,
                seats_left=len(seats_map) - 4,
                seats_map=seats_map,
                seed_batch_id=SEED_BATCH_ID
            ))
    db.commit()
    db.close()
    print("Buses seeded successfully.")

def run_cabs():
    # Ensure cab_vehicles & cab_bookings tables match the updated schema
    try:
        CabVehicle.__table__.drop(engine, checkfirst=True)
        CabVehicle.__table__.create(engine, checkfirst=True)
        CabBooking.__table__.drop(engine, checkfirst=True)
        CabBooking.__table__.create(engine, checkfirst=True)
    except Exception as e:
        print(f"Table recreation notice: {e}")

    db = SessionLocal()
    print("Seeding Cabs & Chauffeur Vehicles...")

    cities = db.query(City).all()
    if not cities:
        db.close()
        return

    cab_fleet_templates = [
        # Hatchbacks
        {
            "brand": "Maruti Suzuki", "model": "Swift", "display_name": "Maruti Suzuki Swift",
            "type": "Hatchback", "category": "Hatchback", "variant": "ZXi Plus", "image_key": "swift",
            "seats": 4, "luggage": 2, "fuel": "Petrol", "trans": "Manual", "ac": True,
            "base_fare": 150.0, "price_per_km": 13.0, "per_hour": 180.0,
            "rating": 4.8, "reviews": 1420, "provider": "Ghumne Chale Mini",
            "image": "/assets/vehicles/swift.webp"
        },
        {
            "brand": "Hyundai", "model": "Grand i10 Nios", "display_name": "Hyundai Grand i10 Nios",
            "type": "Hatchback", "category": "Hatchback", "variant": "Sportz CNG", "image_key": "grand-i10",
            "seats": 4, "luggage": 2, "fuel": "CNG", "trans": "Manual", "ac": True,
            "base_fare": 140.0, "price_per_km": 12.5, "per_hour": 175.0,
            "rating": 4.7, "reviews": 980, "provider": "Uber Go",
            "image": "/assets/vehicles/grand-i10.webp"
        },
        # Sedans
        {
            "brand": "Maruti Suzuki", "model": "Dzire", "display_name": "Maruti Suzuki Dzire",
            "type": "Sedan", "category": "Sedan", "variant": "ZXi Auto", "image_key": "dzire",
            "seats": 4, "luggage": 3, "fuel": "Petrol", "trans": "Automatic", "ac": True,
            "base_fare": 200.0, "price_per_km": 16.0, "per_hour": 220.0,
            "rating": 4.9, "reviews": 2840, "provider": "Ola Prime Sedan",
            "image": "/assets/vehicles/dzire.webp"
        },
        {
            "brand": "Honda", "model": "Amaze", "display_name": "Honda Amaze",
            "type": "Sedan", "category": "Sedan", "variant": "VX CVT", "image_key": "amaze",
            "seats": 4, "luggage": 3, "fuel": "Petrol", "trans": "Automatic", "ac": True,
            "base_fare": 220.0, "price_per_km": 17.5, "per_hour": 240.0,
            "rating": 4.8, "reviews": 1150, "provider": "Ghumne Chale Premier",
            "image": "/assets/vehicles/amaze.webp"
        },
        {
            "brand": "Hyundai", "model": "Verna", "display_name": "Hyundai Verna Turbo",
            "type": "Sedan", "category": "Sedan", "variant": "SX(O) Turbo", "image_key": "verna",
            "seats": 4, "luggage": 3, "fuel": "Diesel", "trans": "Automatic", "ac": True,
            "base_fare": 250.0, "price_per_km": 19.0, "per_hour": 260.0,
            "rating": 4.9, "reviews": 870, "provider": "Uber Premier",
            "image": "/assets/vehicles/verna.webp"
        },
        # SUVs
        {
            "brand": "Hyundai", "model": "Creta", "display_name": "Hyundai Creta",
            "type": "SUV", "category": "SUV", "variant": "SX(O) Diesel", "image_key": "creta",
            "seats": 5, "luggage": 4, "fuel": "Diesel", "trans": "Automatic", "ac": True,
            "base_fare": 300.0, "price_per_km": 21.0, "per_hour": 320.0,
            "rating": 4.9, "reviews": 1920, "provider": "Ghumne Chale SUV",
            "image": "/assets/vehicles/creta.webp"
        },
        {
            "brand": "Kia", "model": "Seltos", "display_name": "Kia Seltos",
            "type": "SUV", "category": "SUV", "variant": "GTX Plus", "image_key": "seltos",
            "seats": 5, "luggage": 4, "fuel": "Petrol", "trans": "Automatic", "ac": True,
            "base_fare": 310.0, "price_per_km": 22.0, "per_hour": 330.0,
            "rating": 4.8, "reviews": 1340, "provider": "Uber XL",
            "image": "/assets/vehicles/seltos.webp"
        },
        {
            "brand": "Mahindra", "model": "XUV700", "display_name": "Mahindra XUV700",
            "type": "SUV", "category": "SUV", "variant": "AX7 Luxury", "image_key": "xuv700",
            "seats": 6, "luggage": 4, "fuel": "Diesel", "trans": "Automatic", "ac": True,
            "base_fare": 380.0, "price_per_km": 25.0, "per_hour": 400.0,
            "rating": 4.9, "reviews": 1610, "provider": "Ola Prime Plus",
            "image": "/assets/vehicles/xuv700.webp"
        },
        # MPVs
        {
            "brand": "Maruti Suzuki", "model": "Ertiga", "display_name": "Maruti Suzuki Ertiga",
            "type": "MPV", "category": "MPV", "variant": "ZXi CNG", "image_key": "ertiga",
            "seats": 6, "luggage": 4, "fuel": "CNG", "trans": "Manual", "ac": True,
            "base_fare": 320.0, "price_per_km": 20.0, "per_hour": 340.0,
            "rating": 4.8, "reviews": 3100, "provider": "Ghumne Chale XL",
            "image": "/assets/vehicles/ertiga.webp"
        },
        {
            "brand": "Toyota", "model": "Innova Crysta", "display_name": "Toyota Innova Crysta",
            "type": "MPV", "category": "MPV", "variant": "ZX 7-Seater", "image_key": "innova-crysta",
            "seats": 7, "luggage": 5, "fuel": "Diesel", "trans": "Automatic", "ac": True,
            "base_fare": 450.0, "price_per_km": 28.0, "per_hour": 480.0,
            "rating": 5.0, "reviews": 4200, "provider": "Savaari Premier",
            "image": "/assets/vehicles/innova-crysta.webp"
        },
        {
            "brand": "Kia", "model": "Carens", "display_name": "Kia Carens",
            "type": "MPV", "category": "MPV", "variant": "Luxury Plus 7S", "image_key": "carens",
            "seats": 7, "luggage": 4, "fuel": "Diesel", "trans": "Automatic", "ac": True,
            "base_fare": 400.0, "price_per_km": 26.0, "per_hour": 440.0,
            "rating": 4.9, "reviews": 1120, "provider": "Ola Prime XL",
            "image": "/assets/vehicles/carens.webp"
        },
        # Luxury / Premium
        {
            "brand": "Toyota", "model": "Camry Hybrid", "display_name": "Toyota Camry Luxury",
            "type": "Luxury", "category": "Luxury", "variant": "Hybrid Luxury", "image_key": "camry",
            "seats": 4, "luggage": 3, "fuel": "EV", "trans": "Automatic", "ac": True,
            "base_fare": 650.0, "price_per_km": 42.0, "per_hour": 750.0,
            "rating": 5.0, "reviews": 640, "provider": "Ghumne Chale Black",
            "image": "/assets/vehicles/camry.webp"
        },
        {
            "brand": "Mercedes-Benz", "model": "E-Class", "display_name": "Mercedes-Benz E-Class Chauffeur",
            "type": "Luxury", "category": "Luxury", "variant": "Exclusive Edition", "image_key": "mercedes-e-class",
            "seats": 4, "luggage": 3, "fuel": "Petrol", "trans": "Automatic", "ac": True,
            "base_fare": 1200.0, "price_per_km": 75.0, "per_hour": 1400.0,
            "rating": 5.0, "reviews": 480, "provider": "Uber Black Chauffeur",
            "image": "/assets/vehicles/mercedes-e-class.webp"
        },
        # EV
        {
            "brand": "Tata", "model": "Nexon EV", "display_name": "Tata Nexon EV",
            "type": "EV", "category": "EV", "variant": "Empowered Plus LR", "image_key": "nexon-ev",
            "seats": 4, "luggage": 3, "fuel": "EV", "trans": "Automatic", "ac": True,
            "base_fare": 200.0, "price_per_km": 15.0, "per_hour": 220.0,
            "rating": 4.8, "reviews": 890, "provider": "BluSmart EV",
            "image": "/assets/vehicles/nexon-ev.webp"
        },
        # Bike / Scooter
        {
            "brand": "Honda", "model": "Activa 6G", "display_name": "Honda Activa Scooter",
            "type": "Bike", "category": "Bike", "variant": "6G Deluxe", "image_key": "activa",
            "seats": 1, "luggage": 1, "fuel": "Petrol", "trans": "Automatic", "ac": False,
            "base_fare": 40.0, "price_per_km": 8.0, "per_hour": 70.0,
            "rating": 4.7, "reviews": 2100, "provider": "Rapido Bike",
            "image": "/assets/vehicles/activa.webp"
        }
    ]

    total_cabs = 0
    city_plate_map = {
        "delhi": "DL", "mumbai": "MH", "pune": "MH", "bengaluru": "KA", "bangalore": "KA",
        "chennai": "TN", "hyderabad": "TS", "kolkata": "WB", "jaipur": "RJ", "goa": "GA",
        "ahmedabad": "GJ", "lucknow": "UP", "varanasi": "UP", "agra": "UP", "chandigarh": "CH",
        "kochi": "KL", "thiruvananthapuram": "KL", "bhopal": "MP", "indore": "MP", "patna": "BR"
    }

    for city in cities:
        prefix = city_plate_map.get(city.name.lower(), "DL")
        for idx, tmpl in enumerate(cab_fleet_templates):
            plate = f"{prefix}-{random.randint(1, 12):02d}-C-{random.randint(1000, 9999)}"
            est_trip_price = round(tmpl["base_fare"] + (18.5 * tmpl["price_per_km"]))
            
            veh = CabVehicle(
                city_id=city.id,
                provider=tmpl["provider"],
                type=tmpl["type"],
                category=tmpl["category"],
                brand=tmpl["brand"],
                model=tmpl["model"],
                display_name=tmpl["display_name"],
                variant=tmpl.get("variant", "Standard"),
                image_key=tmpl.get("image_key", tmpl["model"].lower().replace(" ", "-")),
                price=est_trip_price,
                base_fare=tmpl["base_fare"],
                price_per_km=tmpl["price_per_km"],
                per_hour_rate=tmpl["per_hour"],
                seating_capacity=tmpl["seats"],
                luggage_capacity=tmpl["luggage"],
                fuel_type=tmpl["fuel"],
                transmission=tmpl["trans"],
                ac_available=tmpl["ac"],
                rating=tmpl["rating"],
                review_count=tmpl["reviews"],
                image_url=tmpl["image"],
                thumbnail_url=tmpl["image"],
                plate_number=plate,
                eta_minutes=3 + (idx % 6) * 2,
                driver_name=fake.name(),
                driver_rating=f"{tmpl['rating']} ★",
                availability_status="available",
                seed_batch_id=SEED_BATCH_ID
            )
            db.add(veh)
            total_cabs += 1

    db.commit()
    db.close()
    print(f"Successfully seeded {total_cabs} cabs across {len(cities)} cities with realistic specifications & verified assets.")


def run_rental_vehicles():
    db = SessionLocal()
    print("Seeding Rental Vehicles...")
    
    # 1. Clear existing rental vehicles and availabilities
    db.query(VehicleAvailability).filter(VehicleAvailability.seed_batch_id == SEED_BATCH_ID).delete()
    db.query(RentalVehicle).filter(RentalVehicle.seed_batch_id == SEED_BATCH_ID).delete()
    db.commit()

    # Get all hubs
    hubs = db.query(Locality).filter(Locality.has_rental_hub == True).all()
    if not hubs:
        print("No rental hubs found in locality table! Seeding aborted.")
        db.close()
        return

    # Define vehicle templates by category
    hatchbacks = [
        {"brand": "Maruti", "model": "Swift", "price_range": (1200, 1800), "fuels": ["Petrol", "CNG"], "transmissions": ["Manual", "Automatic"]},
        {"brand": "Hyundai", "model": "i20", "price_range": (1400, 2000), "fuels": ["Petrol"], "transmissions": ["Manual", "Automatic"]},
        {"brand": "Tata", "model": "Altroz", "price_range": (1300, 1800), "fuels": ["Petrol", "Diesel"], "transmissions": ["Manual"]}
    ]
    sedans = [
        {"brand": "Honda", "model": "City", "price_range": (2200, 3000), "fuels": ["Petrol"], "transmissions": ["Automatic"]},
        {"brand": "Hyundai", "model": "Verna", "price_range": (2000, 2800), "fuels": ["Petrol", "Diesel"], "transmissions": ["Automatic"]},
        {"brand": "Skoda", "model": "Slavia", "price_range": (2200, 3000), "fuels": ["Petrol"], "transmissions": ["Manual", "Automatic"]}
    ]
    suvs = [
        {"brand": "Mahindra", "model": "Thar", "price_range": (3500, 4800), "fuels": ["Diesel"], "transmissions": ["Manual", "Automatic"]},
        {"brand": "Toyota", "model": "Fortuner", "price_range": (4500, 5500), "fuels": ["Diesel"], "transmissions": ["Automatic"]},
        {"brand": "Hyundai", "model": "Creta", "price_range": (3000, 4200), "fuels": ["Petrol", "Diesel"], "transmissions": ["Automatic"]}
    ]
    bikes = [
        {"brand": "Royal Enfield", "model": "Classic 350", "price_range": (700, 900), "fuels": ["Petrol"], "transmissions": ["Manual"]},
        {"brand": "KTM", "model": "Duke 390", "price_range": (800, 950), "fuels": ["Petrol"], "transmissions": ["Manual"]},
        {"brand": "Honda", "model": "Activa", "price_range": (400, 600), "fuels": ["Petrol"], "transmissions": ["Automatic"]}
    ]
    evs = [
        {"brand": "Tata", "model": "Nexon EV", "price_range": (2500, 3800), "fuels": ["EV"], "transmissions": ["Automatic"]},
        {"brand": "Ola", "model": "S1 Pro", "price_range": (500, 800), "fuels": ["EV"], "transmissions": ["Automatic"]},
        {"brand": "Ather", "model": "450X", "price_range": (600, 850), "fuels": ["EV"], "transmissions": ["Automatic"]}
    ]

    images = {
        "Hatchback": "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=800",
        "Sedan": "https://images.unsplash.com/photo-1547891654-e66ed7edd96c?w=800",
        "SUV": "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=800",
        "Bike": "https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=800",
        "EV": "https://images.unsplash.com/photo-1563720223185-11003d516935?w=800",
        "EV_scooter": "https://images.unsplash.com/photo-1609630875171-b1321377ee65?w=800"
    }

    # Count categories for reporting
    tourist_count = 0
    metro_count = 0
    small_count = 0
    total_vehicles = 0

    for hub in hubs:
        hub_name_lower = hub.name.lower()
        district = db.query(District).filter(District.id == hub.district_id).first()
        state = db.query(State).filter(State.id == district.state_id).first() if district else None
        district_name_lower = district.name.lower() if district else ""
        state_name_lower = state.name.lower() if state else ""
        
        # Categorize hub tier
        is_tourist = any(x in hub_name_lower or x in district_name_lower or x in state_name_lower for x in ["goa", "jaipur", "udaipur", "shimla", "srinagar", "leh", "manali"])
        is_metro = any(x in hub_name_lower or x in district_name_lower for x in ["connaught", "chanakyapuri", "saket", "preet", "mayur", "bandra", "juhu", "andheri", "borivali", "colaba", "nariman", "bengaluru", "mumbai"])
        
        if is_tourist:
            num_vehicles = random.randint(12, 18)
            weights = {"SUV": 0.35, "Bike": 0.25, "Hatchback": 0.20, "EV": 0.10, "Sedan": 0.10}
            tourist_count += 1
        elif is_metro:
            num_vehicles = random.randint(10, 14)
            weights = {"Sedan": 0.35, "SUV": 0.25, "Hatchback": 0.20, "EV": 0.20, "Bike": 0.00}
            metro_count += 1
        else:
            num_vehicles = random.randint(4, 6)
            weights = {"Hatchback": 0.45, "Sedan": 0.35, "SUV": 0.10, "EV": 0.10, "Bike": 0.00}
            small_count += 1

        # Resolve city_id
        city_obj = db.query(City).filter(City.name.like(f"%{hub.name}%")).first()
        if not city_obj and state:
            city_obj = db.query(City).filter(City.name.like(f"%{state.name}%")).first()
        if not city_obj:
            city_obj = db.query(City).first()

        for _ in range(num_vehicles):
            # Select vehicle type based on weights
            v_types = list(weights.keys())
            v_weights = list(weights.values())
            v_type = random.choices(v_types, weights=v_weights, k=1)[0]
            
            # Select template
            if v_type == "Hatchback":
                tmpl = random.choice(hatchbacks)
                seats = 5
            elif v_type == "Sedan":
                tmpl = random.choice(sedans)
                seats = 5
            elif v_type == "SUV":
                tmpl = random.choice(suvs)
                seats = 7 if tmpl["model"] == "Fortuner" else (4 if tmpl["model"] == "Thar" else 5)
            elif v_type == "Bike":
                tmpl = random.choice(bikes)
                seats = 2
            else: # EV
                tmpl = random.choice(evs)
                seats = 2 if tmpl["model"] in ["S1 Pro", "450X"] else 5

            brand = tmpl["brand"]
            model = tmpl["model"]
            fuel = random.choice(tmpl["fuels"])
            trans = random.choice(tmpl["transmissions"])
            
            # Price range calculation
            min_p, max_p = tmpl["price_range"]
            price = random.uniform(min_p, max_p)
            price = round(price / 50) * 50  # round to clean multiple of 50
            
            # Determine rental modes
            if v_type == "Bike":
                rental_mode = "self_drive"
                self_drive = True
                with_driver = False
            else:
                rental_mode = random.choice(["self_drive", "with_driver", "both"])
                self_drive = (rental_mode in ["self_drive", "both"])
                with_driver = (rental_mode in ["with_driver", "both"])

            veh = RentalVehicle(
                city_id=city_obj.id,
                hub_locality_id=hub.id,
                name=f"{brand} {model}",
                brand=brand,
                model=model,
                type=v_type,
                vehicle_type=v_type,
                price_per_day=price,
                fuel_type=fuel,
                transmission=trans,
                seating_capacity=seats,
                self_drive_available=self_drive,
                with_driver_available=with_driver,
                rental_mode=rental_mode,
                distance_km=round(random.uniform(0.1, 5.0), 1),
                instant_confirm=random.choice([True, True, False]), # 66% instant confirm
                rating=round(random.uniform(4.0, 5.0), 1),
                image_url=images["EV_scooter"] if (v_type == "EV" and model in ["S1 Pro", "450X"]) else images[v_type],
                is_active=True,
                seed_batch_id=SEED_BATCH_ID
            )
            db.add(veh)
            db.flush()
            total_vehicles += 1

            # Seed 1-2 overlapping bookings for some vehicles (30% probability)
            # Ensure none of these bookings overlap with our target test dates: 2026-12-15 to 2026-12-18
            if random.random() < 0.3:
                # Booking 1: Past booking
                db.add(VehicleAvailability(
                    vehicle_id=veh.id,
                    start_date=datetime.date(2026, 12, 5),
                    end_date=datetime.date(2026, 12, 12),
                    booking_id=random.randint(1000, 9999),
                    seed_batch_id=SEED_BATCH_ID
                ))
                # Booking 2: Future booking
                db.add(VehicleAvailability(
                    vehicle_id=veh.id,
                    start_date=datetime.date(2026, 12, 22),
                    end_date=datetime.date(2026, 12, 27),
                    booking_id=random.randint(1000, 9999),
                    seed_batch_id=SEED_BATCH_ID
                ))

    db.commit()
    db.close()
    print(f"Successfully seeded {total_vehicles} vehicles across {len(hubs)} hub localities:")
    print(f"  - Tourist hubs: {tourist_count}")
    print(f"  - Metro hubs: {metro_count}")
    print(f"  - Small town hubs: {small_count}")

def run_tours():
    db = SessionLocal()
    print("Seeding Tours & Attractions...")
    cities = db.query(City).all()
    if not cities:
        db.close()
        return

    tours_pool = [
        ("Scuba Diving & Grand Island", "Adventure", 2999.0, "6 hours"),
        ("Heritage Walk in Old Quarters", "Cultural", 799.0, "3 hours"),
        ("Local Food Culinary Crawl", "Food Tour", 1200.0, "2.5 hours"),
        ("Wildlife Safari Adventure", "Nature", 3500.0, "5 hours")
    ]

    for city in cities:
        for name, category, price, duration in tours_pool:
            unique_name = f"{city.name}: {name}"
            exists = db.query(TourActivity).filter(TourActivity.name == unique_name).first()
            if not exists:
                db.add(TourActivity(
                    city_id=city.id,
                    name=unique_name,
                    category=category,
                    price=price,
                    duration=duration,
                    details=f"All-inclusive activity showing historical narratives, local samplings, and protective gear guidelines.",
                    group_size=12,
                    difficulty="Easy" if "Walk" in name or "Food" in name else "Medium",
                    seed_batch_id=SEED_BATCH_ID
                ))
    db.commit()
    db.close()
    print("Tours seeded successfully.")

def run_cruises():
    db = SessionLocal()
    print("Seeding Cruise Itineraries...")
    
    cruises = [
        ("Singapore to Penang Getaway", "Royal Caribbean", "Balcony Suite", 45000.0, "Singapore", 5),
        ("Goa Beachfront Coastal Cruise", "Cordelia Cruises", "Ocean View", 28000.0, "Mumbai", 4),
        ("Luxury Mediterranean Escapade", "Princess Cruises", "Grand Palace Suite", 120000.0, "Athens", 8)
    ]

    for name, line, cabin, price, port, duration in cruises:
        exists = db.query(CruiseItinerary).filter(CruiseItinerary.name == name).first()
        if not exists:
            db.add(CruiseItinerary(
                name=name,
                cruise_line=line,
                cabin_type=cabin,
                price=price,
                departure_port=port,
                duration_days=duration,
                seed_batch_id=SEED_BATCH_ID
            ))
    db.commit()
    db.close()
    print("Cruises seeded successfully.")

def run_insurance():
    db = SessionLocal()
    print("Seeding Insurance plans...")
    
    plans = [
        ("Tata AIG", "Travel Guard Basic", 950.0, 5000000.0, "Covers medical emergencies, baggage loss, trip delays."),
        ("HDFC Ergo", "Travel Shield Premium", 1800.0, 10000000.0, "Covers adventure sports, dental treatments, passport loss.")
    ]

    for provider, name, price, coverage, details in plans:
        exists = db.query(InsurancePlan).filter(InsurancePlan.policy_name == name).first()
        if not exists:
            db.add(InsurancePlan(
                provider_name=provider,
                policy_name=name,
                price=price,
                coverage_amount=coverage,
                details=details,
                seed_batch_id=SEED_BATCH_ID
            ))
    db.commit()
    db.close()
    print("Insurance plans seeded successfully.")

def run_content():
    db = SessionLocal()
    print("Seeding Showcase Content: Offers, Partners, Collections, Footers...")

    # 1. Offers
    offers_data = [
        ("flights", "DOM FLIGHTS", "Save up to ₹2,500 on Domestic Flights", "Use code FLYFAST and get flat 12% off on Indigo, Vistara, and Air India bookings.", "FLYFAST"),
        ("hotels", "LUXURY STAYS", "Flat 20% off on Flagship Taj & Hyatt Hotels", "Indulge in premium luxury stays with complimentary breakfast and spa credits.", "LUXSTAYS"),
        ("bank", "ICICI OFFERS", "10% Instant Discount with ICICI Cards", "Book flights, hotels, or holiday packages and save instantly up to ₹5,000.", "ICICITRAVEL"),
        ("holidays", "GOA GETAWAYS", "Goa Tour Packages starting from ₹11,999/pax", "Includes round-trip flights, 3-star beach resort stay, and traditional spice plantation tour.", "GOAPACK"),
        ("trains", "DOM TRAINS", "Flat 10% Off on IRCTC Train Bookings", "Book your train tickets online and get flat 10% instant discount up to ₹150 with zero service fees.", "RAILSAFE"),
        ("cabs", "OUTSTATION CABS", "Save up to ₹800 on Outstation Cabs", "Get 15% off on your first intercity cab booking. Premium SUVs and Sedans with top-rated drivers.", "CABRIDE"),
        ("bus", "BUS TRAVEL", "Get 20% off up to ₹200 on Bus Bookings", "Enjoy luxury sleeper bus journeys with state transport and private travel partners.", "BUSBUDDY"),
        ("forex", "WORLD FOREX", "Zero Commission Forex Card & Exchange", "Order forex cards online at best interbank rates. Multi-currency loading with instant activation.", "FOREXCARD")
    ]
    for idx, (cat, tags, title, desc, code) in enumerate(offers_data):
        exists = db.query(Offer).filter(Offer.promo_code == code).first()
        if not exists:
            db.add(Offer(
                category=cat,
                tags=tags,
                title=title,
                description=desc,
                promo_code=code,
                valid_to=datetime.datetime.utcnow() + datetime.timedelta(days=90),
                seed_batch_id=SEED_BATCH_ID
            ))
    db.commit()

    # 2. Airline Partners
    partners = [
        ("Air India", "linear-gradient(90deg, #ef4444 0%, #b91c1c 100%)"),
        ("IndiGo", "linear-gradient(90deg, #1d4ed8 0%, #1e40af 100%)"),
        ("Vistara", "linear-gradient(90deg, #8b5cf6 0%, #4c1d95 100%)")
    ]
    for name, grad in partners:
        exists = db.query(AirlinePartner).filter(AirlinePartner.name == name).first()
        if not exists:
            db.add(AirlinePartner(name=name, brand_gradient=grad, seed_batch_id=SEED_BATCH_ID))
    db.commit()

    # 3. Hotel Partners
    hotel_partners = [
        ("Taj Luxury Hotels & Resorts", "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=800"),
        ("Grand Hyatt Boutique", "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800")
    ]
    for name, img in hotel_partners:
        exists = db.query(HotelBrandPartner).filter(HotelBrandPartner.name == name).first()
        if not exists:
            db.add(HotelBrandPartner(name=name, property_image_url=img, seed_batch_id=SEED_BATCH_ID))
    db.commit()

    # 4. Curated Collections
    colls = [
        ("handpicked-collections", "Handpicked Collections for You", "Curated stays, flights and trips just for your style", "editorial"),
        ("lesser-known-wonders", "Unlock Lesser-Known Wonders of India", "Fascinating hidden gems waiting to be explored", "editorial")
    ]
    for slug, title, sub, c_type in colls:
        exists = db.query(Collection).filter(Collection.slug == slug).first()
        if not exists:
            col = Collection(slug=slug, title=title, subtitle=sub, collection_type=c_type, seed_batch_id=SEED_BATCH_ID)
            db.add(col)
            db.commit()
            db.refresh(col)

            # Add collection items
            if slug == "handpicked-collections":
                db.add(CollectionItem(
                    collection_id=col.id,
                    ref_type="hotel",
                    ref_id="Taj Luxury Hotels & Resorts",
                    label="TOP 8",
                    tag_text="Luxury Heritage Palace Stays",
                    custom_image_url="https://images.unsplash.com/photo-1566073771259-6a8506099945?w=600",
                    seed_batch_id=SEED_BATCH_ID
                ))
                db.add(CollectionItem(
                    collection_id=col.id,
                    ref_type="hotel",
                    ref_id="Grand Hyatt Boutique",
                    label="POPULAR",
                    tag_text="Modern Premium Seaside Escapes",
                    custom_image_url="https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=600",
                    seed_batch_id=SEED_BATCH_ID
                ))
            else:
                db.add(CollectionItem(
                    collection_id=col.id,
                    ref_type="destination",
                    ref_id="ziro_valley",
                    label="EXPLORE",
                    tag_text="Ziro Valley, Arunachal hidden beauty",
                    custom_image_url="https://images.unsplash.com/photo-1506461883276-594a12b11cc3?w=600",
                    seed_batch_id=SEED_BATCH_ID
                ))
                db.add(CollectionItem(
                    collection_id=col.id,
                    ref_type="destination",
                    ref_id="spiti_valley",
                    label="ADVENTURE",
                    tag_text="Spiti Valley cold desert expeditions",
                    custom_image_url="https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=600",
                    seed_batch_id=SEED_BATCH_ID
                ))
            db.commit()

    # 5. Highlights
    highlights = [
        ("Globe", "Introducing OneCircle Membership", "Earn loyalty points across flights, hotels, and activities. Unlock elite perks today.", "/wallet"),
        ("Clock", "Flexible Check-In / Check-Out", "Adjust your timing on the fly at premium luxury resorts with zero penalty fees.", "/explore"),
        ("Compass", "Tours & Local Attractions", "Handpicked walking tours and outdoor activities curated by local guides.", "/explore")
    ]
    for idx, (icon, title, body, url) in enumerate(highlights):
        exists = db.query(InfoHighlight).filter(InfoHighlight.title == title).first()
        if not exists:
            db.add(InfoHighlight(icon_name=icon, title=title, body_text=body, cta_url=url, display_order=idx, seed_batch_id=SEED_BATCH_ID))
    db.commit()

    # 6. Promo Banner
    exists = db.query(PromoBanner).first()
    if not exists:
        db.add(PromoBanner(
            background_color="linear-gradient(90deg, #f59e0b 0%, #ef4444 100%)",
            headline="Southeast Asia's Go-To App for Direct Wallet Bookings — Download Now!",
            cta_text="Get the App",
            cta_url="https://google.com",
            logo_url="https://logos-world.net/wp-content/uploads/2023/03/Air-India-Logo.png",
            valid_to=datetime.datetime.utcnow() + datetime.timedelta(days=365),
            seed_batch_id=SEED_BATCH_ID
        ))
    db.commit()

    # 7. SEO Mega Footer
    footer_sections = [
        ("Top Routes", [("Delhi to Mumbai Flights", "/flights"), ("Delhi to Goa Trains", "/trains")]),
        ("Popular Cities", [("Goa Beach Hotels", "/hotels"), ("Manali Cab Transfers", "/cabs")]),
        ("Corporate info", [("myBiz Corporate Portal", "/mybiz"), ("Developer APIs Settings", "/admin")]),
        ("Products", [("Travel Health Insurance", "/explore"), ("Forex Cards & Exchange", "/explore")])
    ]
    for idx, (title, links) in enumerate(footer_sections):
        exists = db.query(FooterSection).filter(FooterSection.title == title).first()
        if not exists:
            fs = FooterSection(title=title, display_order=idx, seed_batch_id=SEED_BATCH_ID)
            db.add(fs)
            db.commit()
            db.refresh(fs)

            for lIdx, (label, url) in enumerate(links):
                db.add(FooterLink(section_id=fs.id, label=label, url=url, display_order=lIdx, seed_batch_id=SEED_BATCH_ID))
            db.commit()

    db.close()
    print("Content seeding finished.")

def run_users():
    db = SessionLocal()
    print("Seeding Demo Users and booking history...")
    from app.auth.jwt import hash_password

    # 1. Add demo users
    user_profiles = [
        ("ankit@example.com", "9876543210", 15000.0, 5000, "Gold"),
        ("tanisha@example.com", "9988776655", 25000.0, 12000, "Platinum"),
        ("business@example.com", "9112233445", 8000.0, 200, "Bronze")
    ]

    users = []
    default_user_pwd = hash_password("userpass123")
    for email, phone, wallet_bal, points, tier in user_profiles:
        user = db.query(User).filter(User.email == email).first()
        if not user:
            user = User(
                email=email,
                phone=phone,
                password_hash=default_user_pwd,
                role="user",
                preferred_language="en",
                preferred_currency="INR",
                seed_batch_id=SEED_BATCH_ID
            )
            db.add(user)
            db.commit()
            db.refresh(user)

            # Saved Travelers
            db.add(SavedTraveler(linked_user_id=user.id, name=f"{email.split('@')[0].capitalize()} Traveler", dob=datetime.date(1995, 12, 1), passport_no="Z887216", seed_batch_id=SEED_BATCH_ID))
            db.add(SavedTraveler(linked_user_id=user.id, name=f"Co-Traveler {email.split('@')[0].capitalize()}", dob=datetime.date(1996, 6, 15), passport_no="A129034", seed_batch_id=SEED_BATCH_ID))

            # Loyalty Account
            db.add(LoyaltyAccount(user_id=user.id, points_balance=points, tier=tier, seed_batch_id=SEED_BATCH_ID))

            # Wallet Account
            db.add(WalletAccount(user_id=user.id, balance=wallet_bal, currency="INR", seed_batch_id=SEED_BATCH_ID))
            db.commit()
        else:
            user.password_hash = default_user_pwd
            user.role = "user"
            db.commit()
        users.append(user)

    # Seed Admin User
    admin_email = os.getenv("ADMIN_SEED_EMAIL", "admin_test@travelos.com")
    admin_password = os.getenv("ADMIN_SEED_PASSWORD", "adminpass123")
    admin_user = db.query(User).filter(User.email == admin_email).first()
    if not admin_user:
        admin_user = User(
            email=admin_email,
            phone="9900990099",
            password_hash=hash_password(admin_password),
            role="admin",
            preferred_language="en",
            preferred_currency="INR",
            seed_batch_id=SEED_BATCH_ID
        )
        db.add(admin_user)
        db.commit()
        db.refresh(admin_user)
        
        # Loyalty & Wallet
        db.add(LoyaltyAccount(user_id=admin_user.id, points_balance=1000, tier="Platinum", seed_batch_id=SEED_BATCH_ID))
        db.add(WalletAccount(user_id=admin_user.id, balance=50000.0, currency="INR", seed_batch_id=SEED_BATCH_ID))
        db.commit()
        print(f"Admin user seeded successfully: {admin_email}")
    else:
        admin_user.password_hash = hash_password(admin_password)
        admin_user.role = "admin"
        db.commit()

    # 2. Add dynamic historic bookings
    # Let's seed bookings for the first user (ankit@example.com) so there is booking history on dashboard
    target_user = users[0]
    
    # Check if bookings already exist
    exists = db.query(FlightBooking).filter(FlightBooking.user_id == target_user.id).first()
    if not exists:
        # A. Past COMPLETED Flight booking
        f1 = FlightBooking(
            booking_reference="TOS-FL-99120",
            user_id=target_user.id,
            status=BookingStatus.COMPLETED,
            total_amount=5200.00,
            currency="INR",
            pricing_snapshot={"base": 4800, "taxes": 400},
            origin="DEL",
            destination="GOI",
            departure_time=datetime.datetime.utcnow() - datetime.timedelta(days=15),
            arrival_time=datetime.datetime.utcnow() - datetime.timedelta(days=15, hours=-2.5),
            airline_code="AI",
            flight_number="AI-302",
            passenger_details=[{"name": "Ankit Traveler", "age": 30}],
            seed_batch_id=SEED_BATCH_ID
        )
        db.add(f1)

        # B. Future UPCOMING Hotel booking
        h1 = HotelBooking(
            booking_reference="TOS-HT-20891",
            user_id=target_user.id,
            status=BookingStatus.CONFIRMED,
            total_amount=12000.00,
            currency="INR",
            pricing_snapshot={"base": 10000, "taxes": 2000},
            hotel_name="Goa Grand Hyatt Resort",
            hotel_id="hotel_hyatt_goa",
            check_in=datetime.datetime.utcnow() + datetime.timedelta(days=10),
            check_out=datetime.datetime.utcnow() + datetime.timedelta(days=13),
            room_type="Deluxe Sea-Facing Suite",
            guest_details=[{"name": "Ankit Traveler", "age": 30}],
            address="Candolim Beach Front, Goa, India",
            seed_batch_id=SEED_BATCH_ID
        )
        db.add(h1)

        # C. CANCELLED Cab booking
        c1 = CabBooking(
            booking_reference="TOS-CB-58190",
            user_id=target_user.id,
            status=BookingStatus.CANCELLED,
            total_amount=1200.00,
            currency="INR",
            pricing_snapshot={"base": 1200},
            provider_name="Ola Cabs",
            cab_type="Sedan",
            pickup_address="Dabolim Airport Goa",
            drop_address="Grand Hyatt Resort Goa",
            pickup_time=datetime.datetime.utcnow() - datetime.timedelta(days=5),
            seed_batch_id=SEED_BATCH_ID
        )
        db.add(c1)
        db.commit()

    db.close()
    print("Demo Users and booking history seeded successfully.")


def run_locations():
    import urllib.request
    import json
    import math

    db = SessionLocal()
    print("Seeding administrative location master data for India...")

    # Helper for Haversine distance
    def haversine(lat1, lon1, lat2, lon2):
        R = 6371.0
        phi1 = math.radians(lat1)
        phi2 = math.radians(lat2)
        delta_phi = math.radians(lat2 - lat1)
        delta_lambda = math.radians(lon2 - lon1)
        a = math.sin(delta_phi / 2.0)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0)**2
        c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
        return R * c

    # Catalog fallback dataset
    locations_catalog = [
        ("Goa", "GA", [
            ("North Goa", "NG", [
                ("Panaji", "city", 15.4909, 73.8278, 1, True, 25.0, 100.0),
                ("Mapusa", "town", 15.5937, 73.8142, 2, True, 15.0, 150.0),
                ("Calangute", "town", 15.5442, 73.7553, 2, True, 15.0, 150.0),
                ("Anjuna", "village", 15.5782, 73.7431, 3, False, 15.0, 250.0),
                ("Assagao", "village", 15.5971, 73.7712, 3, False, 15.0, 250.0),
                ("Siolim", "village", 15.6215, 73.7788, 3, False, 15.0, 250.0),
                ("Arambol", "village", 15.6869, 73.7042, 3, False, 15.0, 250.0),
                ("Morjim", "village", 15.6322, 73.7291, 3, False, 15.0, 250.0),
                ("Aldona", "village", 15.5922, 73.8741, 3, False, 15.0, 250.0),
                ("Saligao", "village", 15.5512, 73.7745, 3, False, 15.0, 250.0)
            ]),
            ("South Goa", "SG", [
                ("Margao", "city", 15.2736, 73.9582, 1, True, 25.0, 100.0),
                ("Vasco da Gama", "city", 15.3995, 73.8123, 1, True, 25.0, 100.0),
                ("Ponda", "town", 15.3998, 74.0125, 2, True, 15.0, 150.0),
                ("Colva", "village", 15.2750, 73.9110, 3, False, 15.0, 250.0),
                ("Palolem", "village", 15.0100, 74.0200, 3, False, 15.0, 250.0),
                ("Agonda", "village", 15.0450, 73.9900, 3, False, 15.0, 250.0),
                ("Mobor", "village", 15.1585, 73.9422, 3, False, 15.0, 250.0),
                ("Benaulim", "village", 15.2530, 73.9210, 3, False, 15.0, 250.0)
            ])
        ]),
        ("Delhi", "DL", [
            ("New Delhi", "ND", [
                ("Connaught Place", "city", 28.6304, 77.2177, 1, True, 30.0, 100.0),
                ("Chanakyapuri", "city", 28.5983, 77.1896, 1, True, 30.0, 100.0),
                ("Saket", "city", 28.5244, 77.2066, 1, True, 30.0, 100.0)
            ]),
            ("East Delhi", "ED", [
                ("Preet Vihar", "city", 28.6400, 77.2900, 2, True, 20.0, 150.0),
                ("Mayur Vihar", "city", 28.6100, 77.3000, 2, True, 20.0, 150.0)
            ])
        ]),
        ("Rajasthan", "RJ", [
            ("Jaipur", "JP", [
                ("Jaipur City", "city", 26.9124, 75.7873, 1, True, 30.0, 100.0),
                ("Amer", "town", 26.9855, 75.8513, 2, False, 15.0, 200.0),
                ("Sanganer", "town", 26.8496, 75.7873, 2, False, 15.0, 200.0)
            ]),
            ("Alwar", "AL", [
                ("Alwar City", "city", 27.5530, 76.6089, 2, True, 20.0, 150.0),
                ("Ramgarh", "village", 27.5833, 76.8167, 3, False, 15.0, 250.0),
                ("Behror", "town", 27.8800, 76.2800, 2, False, 15.0, 250.0)
            ]),
            ("Udaipur", "UD", [
                ("Udaipur City", "city", 24.5854, 73.7125, 2, True, 20.0, 150.0),
                ("Sukher", "town", 24.6200, 73.7200, 2, False, 15.0, 200.0)
            ])
        ]),
        ("Karnataka", "KA", [
            ("Bangalore Urban", "BU", [
                ("Bengaluru City", "city", 12.9716, 77.5946, 1, True, 30.0, 100.0),
                ("Kengeri", "town", 12.8997, 77.4827, 2, False, 15.0, 200.0),
                ("Yelahanka", "town", 13.1007, 77.5963, 2, False, 15.0, 200.0),
                ("Whitefield", "town", 12.9698, 77.7500, 2, False, 15.0, 200.0)
            ])
        ]),
        ("Maharashtra", "MH", [
            ("Mumbai Suburban", "MS", [
                ("Bandra", "city", 19.0596, 72.8295, 1, True, 30.0, 100.0),
                ("Juhu", "city", 19.1025, 72.8270, 1, True, 30.0, 100.0),
                ("Andheri", "city", 19.1136, 72.8697, 1, True, 30.0, 100.0),
                ("Borivali", "city", 19.2307, 72.8567, 1, True, 30.0, 100.0)
            ]),
            ("Mumbai City", "MC", [
                ("Colaba", "city", 18.9067, 72.8147, 1, True, 30.0, 100.0),
                ("Nariman Point", "city", 18.9270, 72.8200, 1, True, 30.0, 100.0)
            ])
        ]),
        ("Himachal Pradesh", "HP", [
            ("Shimla", "SM", [
                ("Shimla Town", "city", 31.1048, 77.1734, 2, True, 20.0, 150.0),
                ("Kufri", "village", 31.1004, 77.2657, 3, False, 15.0, 250.0),
                ("Mashobra", "village", 31.1340, 77.2030, 3, False, 15.0, 250.0)
            ])
        ]),
        ("Jammu & Kashmir", "JK", [
            ("Srinagar", "SR", [
                ("Srinagar City", "city", 34.0837, 74.7973, 2, True, 20.0, 150.0),
                ("Harwan", "village", 34.1620, 74.8960, 3, False, 15.0, 250.0)
            ])
        ]),
        ("Ladakh", "LA", [
            ("Leh", "LE", [
                ("Leh Town", "city", 34.1526, 77.5771, 2, True, 20.0, 150.0),
                ("Shey", "village", 34.0720, 77.6330, 3, False, 15.0, 250.0),
                ("Thiksey", "village", 34.0560, 77.6670, 3, False, 15.0, 250.0)
            ])
        ])
    ]

    try:
        req = urllib.request.Request(
            "https://raw.githubusercontent.com/sab99r/Indian-States-And-Districts/master/states-and-districts.json",
            headers={'User-Agent': 'Mozilla/5.0'}
        )
        with urllib.request.urlopen(req, timeout=5) as response:
            external_data = json.loads(response.read().decode())
            print("Successfully fetched live state-district mappings from GitHub!")
    except Exception as e:
        print(f"Network fetch skipped/failed (offline fallback mode activated): {e}")

    # Clear old records
    db.query(Locality).filter(Locality.seed_batch_id == SEED_BATCH_ID).delete(synchronize_session=False)
    db.query(District).filter(District.seed_batch_id == SEED_BATCH_ID).delete(synchronize_session=False)
    db.query(State).filter(State.seed_batch_id == SEED_BATCH_ID).delete(synchronize_session=False)
    db.commit()

    created_states = {}
    created_districts = {}
    localities_to_process = []

    # Insert States, Districts, and Localities from Catalog
    for s_name, s_code, districts_list in locations_catalog:
        state = State(name=s_name, code=s_code, seed_batch_id=SEED_BATCH_ID)
        db.add(state)
        db.flush()
        created_states[s_name] = state.id

        for d_name, d_code, localities_list in districts_list:
            district = District(state_id=state.id, name=d_name, code=d_code, seed_batch_id=SEED_BATCH_ID)
            db.add(district)
            db.flush()
            created_districts[f"{s_name}:{d_name}"] = district.id

            for l_name, l_type, l_lat, l_lng, pop_tier, has_hub, rad, fee in localities_list:
                loc = Locality(
                    district_id=district.id,
                    name=l_name,
                    type=l_type,
                    latitude=l_lat,
                    longitude=l_lng,
                    population_tier=pop_tier,
                    has_rental_hub=has_hub,
                    delivery_radius_km=rad,
                    delivery_fee_beyond_radius=fee,
                    seed_batch_id=SEED_BATCH_ID
                )
                db.add(loc)
                db.flush()
                localities_to_process.append(loc)

    db.commit()

    # Nearest-Hub Assignment Logic
    print("Calculating nearest hubs for non-hub localities using Haversine distance...")
    hubs = [l for l in localities_to_process if l.has_rental_hub]
    
    for loc in localities_to_process:
        if loc.has_rental_hub:
            loc.nearest_hub_locality_id = loc.id
        else:
            closest_hub = None
            min_dist = float('inf')
            for hub in hubs:
                dist = haversine(loc.latitude, loc.longitude, hub.latitude, hub.longitude)
                if dist < min_dist:
                    min_dist = dist
                    closest_hub = hub
            if closest_hub:
                loc.nearest_hub_locality_id = closest_hub.id
                print(f"Assigned '{loc.name}' to closest hub '{closest_hub.name}' ({min_dist:.2f} km)")
    
    db.commit()

    states_count = db.query(State).filter(State.seed_batch_id == SEED_BATCH_ID).count()
    districts_count = db.query(District).filter(District.seed_batch_id == SEED_BATCH_ID).count()
    cities_count = db.query(Locality).filter(Locality.seed_batch_id == SEED_BATCH_ID, Locality.type == 'city').count()
    towns_count = db.query(Locality).filter(Locality.seed_batch_id == SEED_BATCH_ID, Locality.type == 'town').count()
    villages_count = db.query(Locality).filter(Locality.seed_batch_id == SEED_BATCH_ID, Locality.type == 'village').count()
    
    print("\n----- SEEDING REPORT: LOCATION MASTER DATA -----")
    print(f"States seeded: {states_count}")
    print(f"Districts seeded: {districts_count}")
    print(f"Localities seeded: {cities_count + towns_count + villages_count}")
    print(f"  - Cities: {cities_count}")
    print(f"  - Towns: {towns_count}")
    print(f"  - Villages: {villages_count}")
    
    print("\n--- SAMPLE OF 5 VILLAGES WITH NEAREST HUBS ---")
    sample_villages = db.query(Locality).filter(
        Locality.seed_batch_id == SEED_BATCH_ID, 
        Locality.type == 'village'
    ).limit(5).all()
    for sv in sample_villages:
        hub_loc = db.query(Locality).filter(Locality.id == sv.nearest_hub_locality_id).first()
        dist = haversine(sv.latitude, sv.longitude, hub_loc.latitude, hub_loc.longitude)
        print(f"Locality: {sv.name} (Village) -> Nearest Hub: {hub_loc.name} (Distance: {dist:.2f} km)")
    print("------------------------------------------------\n")
    
    db.close()


def main():
    parser = argparse.ArgumentParser(description="Ghumne Chale idmepotent DB Seeding CLI framework.")
    parser.add_argument(
        "subcommand",
        choices=["reference", "flights", "hotels", "villas", "packages", "trains", "buses", "cabs", "rentals", "tours", "cruises", "insurance", "content", "users", "locations", "reset", "all"],
        help="Seed category command"
    )
    args = parser.parse_args()

    # Ensure tables exist
    Base.metadata.create_all(bind=engine)

    if args.subcommand == "reset":
        run_reset()
    elif args.subcommand == "reference":
        run_reference()
    elif args.subcommand == "flights":
        run_flights()
    elif args.subcommand == "hotels":
        run_hotels()
    elif args.subcommand == "villas":
        run_villas()
    elif args.subcommand == "packages":
        run_packages()
    elif args.subcommand == "trains":
        run_trains()
    elif args.subcommand == "buses":
        run_buses()
    elif args.subcommand == "cabs":
        run_cabs()
    elif args.subcommand == "rentals":
        run_rental_vehicles()
    elif args.subcommand == "tours":
        run_tours()
    elif args.subcommand == "cruises":
        run_cruises()
    elif args.subcommand == "insurance":
        run_insurance()
    elif args.subcommand == "content":
        run_content()
    elif args.subcommand == "users":
        run_users()
    elif args.subcommand == "locations":
        run_locations()
    elif args.subcommand == "all":
        print("Starting complete database seeding sequence...")
        run_reset()
        run_reference()
        run_locations()
        run_flights()
        run_hotels()
        run_villas()
        run_packages()
        run_trains()
        run_buses()
        run_cabs()
        run_rental_vehicles()
        run_tours()
        run_cruises()
        run_insurance()
        run_content()
        run_users()
        print("Full seeding successfully finalized.")

if __name__ == "__main__":
    main()
