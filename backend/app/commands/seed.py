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
    CabVehicle, TourActivity, CruiseItinerary, InsurancePlan
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
        TrainRoute, BusRoute, CabVehicle, TourActivity, CruiseItinerary, InsurancePlan
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
        ("Srinagar", 1200, 700, 1000)
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
    cities = db.query(City).all()
    if not cities:
        print("Please seed reference data first!")
        db.close()
        return

    hotel_names = [
        "Palace Resort", "Grand Heritage Inn", "Regency Plaza", "Sands Villa",
        "Backpackers Den", "Crown Continental", "Royal Orchid Hotel", "Green Meadows Resort",
        "Coastal Horizon", "Capital Suites", "Imperial Manor", "Oakwood Retreat"
    ]

    hotel_photo_pool = [
        "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800",
        "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=800",
        "https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800",
        "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=800"
    ]

    for city in cities:
        # Create properties per city
        available_names = list(hotel_names)
        random.shuffle(available_names)
        limit = min(len(available_names), config["hotels_per_city"])
        
        for idx in range(limit):
            name = f"{city.name} {available_names[idx]}"
            
            exists = db.query(HotelProperty).filter(HotelProperty.name == name).first()
            if not exists:
                star = f"{random.choice([3.5, 4.0, 4.2, 4.5, 4.8])} ★"
                addr = f"{idx + 10} Beach Road / Sector {idx}, {city.name}, India"
                amenities = ["WiFi", "Room Service", "AC", "Laundry"]
                if idx % 2 == 0:
                    amenities.append("Swimming Pool")
                if idx % 3 == 0:
                    amenities.append("Bar / Lounge")
                
                hotel = HotelProperty(
                    city_id=city.id,
                    name=name,
                    star_rating=star,
                    address=addr,
                    description=f"A beautiful premium hotel located in the heart of {city.name}. Excellent hospitality services.",
                    amenities_json=amenities,
                    seed_batch_id=SEED_BATCH_ID
                )
                db.add(hotel)
                db.commit()
                db.refresh(hotel)

                # Seed Media row for hotel
                photo_url = hotel_photo_pool[idx % len(hotel_photo_pool)]
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
                    price=2500.0 + (idx * 500),
                    description="Standard comfortable room with twin/queen bed and basic amenities.",
                    seed_batch_id=SEED_BATCH_ID
                ))
                db.add(HotelRoom(
                    hotel_id=hotel.id,
                    room_type="Executive Suite",
                    price=5000.0 + (idx * 800),
                    description="Spacious suite with king bed, personal workspace, and city/seaview.",
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
                
                villa = VillaProperty(
                    city_id=city.id,
                    name=name,
                    rating=rating,
                    price=price,
                    details=f"{bedrooms} Bedrooms, Private Pool, Lawn garden garden spaces. Superhost managed.",
                    bedrooms=bedrooms,
                    max_occupancy=max_occ,
                    property_type="Villa" if idx % 2 == 0 else "Cottage",
                    host_name=fake.name(),
                    house_rules="No parties allowed. Pets permitted with prior notice. Quiet hours: 10 PM - 8 AM.",
                    seed_batch_id=SEED_BATCH_ID
                )
                db.add(villa)
                db.commit()
                db.refresh(villa)

                # Seed Media row for villa
                db.add(Media(
                    owner_type="hotel", # frontend maps villas via hotel photo owners
                    owner_id=name,
                    url="https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800",
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
    db = SessionLocal()
    print("Seeding Cabs...")
    cities = db.query(City).all()
    if not cities:
        db.close()
        return

    providers = [("Ola Cabs", "Sedan", 1200.0), ("Uber Intercity", "SUV", 1900.0), ("Savaari Cabs", "Prime SUV", 2400.0)]

    for city in cities:
        for idx, (provider, v_type, price) in enumerate(providers):
            exists = db.query(CabVehicle).filter(CabVehicle.city_id == city.id, CabVehicle.provider == provider).first()
            if not exists:
                db.add(CabVehicle(
                    city_id=city.id,
                    provider=provider,
                    type=v_type,
                    price=price,
                    eta_minutes=5 + idx,
                    driver_name=fake.name(),
                    driver_rating=f"{random.choice([4.5, 4.6, 4.7, 4.8, 4.9])} ★",
                    seed_batch_id=SEED_BATCH_ID
                ))
    db.commit()
    db.close()
    print("Cabs seeded successfully.")

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

    # 1. Add demo users
    user_profiles = [
        ("ankit@example.com", "9876543210", 15000.0, 5000, "Gold"),
        ("tanisha@example.com", "9988776655", 25000.0, 12000, "Platinum"),
        ("business@example.com", "9112233445", 8000.0, 200, "Bronze")
    ]

    users = []
    for email, phone, wallet_bal, points, tier in user_profiles:
        user = db.query(User).filter(User.email == email).first()
        if not user:
            user = User(
                email=email,
                phone=phone,
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
        users.append(user)

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

def main():
    parser = argparse.ArgumentParser(description="Travel OS idmepotent DB Seeding CLI framework.")
    parser.add_argument(
        "subcommand",
        choices=["reference", "flights", "hotels", "villas", "packages", "trains", "buses", "cabs", "tours", "cruises", "insurance", "content", "users", "reset", "all"],
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
    elif args.subcommand == "all":
        print("Starting complete database seeding sequence...")
        run_reset()
        run_reference()
        run_flights()
        run_hotels()
        run_villas()
        run_packages()
        run_trains()
        run_buses()
        run_cabs()
        run_tours()
        run_cruises()
        run_insurance()
        run_content()
        run_users()
        print("Full seeding successfully finalized.")

if __name__ == "__main__":
    main()
