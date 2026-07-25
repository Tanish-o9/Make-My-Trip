import datetime
from typing import List, Dict, Any, Optional
from sqlalchemy import String, Integer, Numeric, DateTime, ForeignKey, Boolean, Text, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base

class City(Base):
    __tablename__ = "cities"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    country: Mapped[str] = mapped_column(String(100), nullable=False)
    lat: Mapped[float] = mapped_column(Numeric(10, 6), nullable=False)
    lng: Mapped[float] = mapped_column(Numeric(10, 6), nullable=False)
    timezone: Mapped[str] = mapped_column(String(50), nullable=False)
    seed_batch_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)


class Airport(Base):
    __tablename__ = "airports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    code: Mapped[str] = mapped_column(String(10), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    city_id: Mapped[int] = mapped_column(Integer, ForeignKey("cities.id"), nullable=False)
    seed_batch_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)


class TrainStation(Base):
    __tablename__ = "train_stations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    code: Mapped[str] = mapped_column(String(10), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    city_id: Mapped[int] = mapped_column(Integer, ForeignKey("cities.id"), nullable=False)
    seed_batch_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)


class BusTerminal(Base):
    __tablename__ = "bus_terminals"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    code: Mapped[str] = mapped_column(String(10), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    city_id: Mapped[int] = mapped_column(Integer, ForeignKey("cities.id"), nullable=False)
    seed_batch_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)


class CurrencyExchange(Base):
    __tablename__ = "currency_exchanges"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    code: Mapped[str] = mapped_column(String(10), unique=True, index=True, nullable=False)
    rate_to_inr: Mapped[float] = mapped_column(Numeric(12, 4), nullable=False)
    seed_batch_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)


class CountryVisaRequirement(Base):
    __tablename__ = "country_visa_requirements"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    country: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    rules: Mapped[str] = mapped_column(Text, nullable=False)
    checklist: Mapped[list] = mapped_column(JSON, nullable=False)
    fee: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    seed_batch_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)


class TollPlaza(Base):
    __tablename__ = "toll_plazas"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    route: Mapped[str] = mapped_column(String(150), nullable=False)
    toll_fee: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    seed_batch_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)


class FlightRoute(Base):
    __tablename__ = "flight_routes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    origin: Mapped[str] = mapped_column(String(10), nullable=False)
    destination: Mapped[str] = mapped_column(String(10), nullable=False)
    airline_code: Mapped[str] = mapped_column(String(10), nullable=False)
    airline_name: Mapped[str] = mapped_column(String(100), nullable=False)
    flight_number: Mapped[str] = mapped_column(String(20), nullable=False)
    base_price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    departure_time: Mapped[str] = mapped_column(String(50), nullable=True)
    seed_batch_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)


class HotelProperty(Base):
    __tablename__ = "hotel_properties"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    city_id: Mapped[int] = mapped_column(Integer, ForeignKey("cities.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    star_rating: Mapped[str] = mapped_column(String(10), nullable=False)
    address: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    amenities_json: Mapped[dict] = mapped_column(JSON, nullable=False)
    seed_batch_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)


class HotelRoom(Base):
    __tablename__ = "hotel_rooms"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    hotel_id: Mapped[int] = mapped_column(Integer, ForeignKey("hotel_properties.id", ondelete="CASCADE"), nullable=False)
    room_type: Mapped[str] = mapped_column(String(100), nullable=False)
    price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    seed_batch_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)


class VillaProperty(Base):
    __tablename__ = "villa_properties"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    city_id: Mapped[int] = mapped_column(Integer, ForeignKey("cities.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    rating: Mapped[str] = mapped_column(String(10), nullable=False)
    price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    details: Mapped[str] = mapped_column(Text, nullable=False)
    bedrooms: Mapped[int] = mapped_column(Integer, nullable=False)
    max_occupancy: Mapped[int] = mapped_column(Integer, nullable=False)
    property_type: Mapped[str] = mapped_column(String(100), nullable=False)
    host_name: Mapped[str] = mapped_column(String(150), nullable=False)
    house_rules: Mapped[str] = mapped_column(Text, nullable=True)
    seed_batch_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)


class HolidayPackage(Base):
    __tablename__ = "holiday_packages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    duration: Mapped[str] = mapped_column(String(100), nullable=False)
    price: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    inclusions: Mapped[str] = mapped_column(String(500), nullable=False)
    details: Mapped[str] = mapped_column(Text, nullable=True)
    seed_batch_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)


class TrainRoute(Base):
    __tablename__ = "train_routes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    train_number: Mapped[str] = mapped_column(String(20), unique=True, index=True, nullable=False)
    train_name: Mapped[str] = mapped_column(String(100), nullable=False)
    origin_station: Mapped[str] = mapped_column(String(100), nullable=False)
    destination_station: Mapped[str] = mapped_column(String(100), nullable=False)
    departure_time: Mapped[str] = mapped_column(String(50), nullable=False)
    duration: Mapped[str] = mapped_column(String(50), nullable=False)
    classes_json: Mapped[dict] = mapped_column(JSON, nullable=False)
    seed_batch_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)


class BusRoute(Base):
    __tablename__ = "bus_routes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    operator_name: Mapped[str] = mapped_column(String(100), nullable=False)
    bus_type: Mapped[str] = mapped_column(String(100), nullable=False)
    price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    departure_time: Mapped[str] = mapped_column(String(50), nullable=False)
    origin: Mapped[str] = mapped_column(String(100), nullable=False)
    destination: Mapped[str] = mapped_column(String(100), nullable=False)
    seats_left: Mapped[int] = mapped_column(Integer, default=10)
    seats_map: Mapped[list] = mapped_column(JSON, nullable=False)
    seed_batch_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)


class CabVehicle(Base):
    __tablename__ = "cab_vehicles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    city_id: Mapped[int] = mapped_column(Integer, ForeignKey("cities.id"), nullable=False)
    provider: Mapped[str] = mapped_column(String(100), nullable=False)
    type: Mapped[str] = mapped_column(String(50), nullable=False)
    price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    eta_minutes: Mapped[int] = mapped_column(Integer, default=5)
    driver_name: Mapped[str] = mapped_column(String(150), nullable=True)
    driver_rating: Mapped[str] = mapped_column(String(10), nullable=True)
    seed_batch_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)


class TourActivity(Base):
    __tablename__ = "tour_activities"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    city_id: Mapped[int] = mapped_column(Integer, ForeignKey("cities.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    category: Mapped[str] = mapped_column(String(100), nullable=False)
    price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    duration: Mapped[str] = mapped_column(String(50), nullable=False)
    details: Mapped[str] = mapped_column(Text, nullable=True)
    group_size: Mapped[int] = mapped_column(Integer, default=10)
    difficulty: Mapped[str] = mapped_column(String(50), default="Easy")
    seed_batch_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)


class CruiseItinerary(Base):
    __tablename__ = "cruise_itineraries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    cruise_line: Mapped[str] = mapped_column(String(100), nullable=False)
    cabin_type: Mapped[str] = mapped_column(String(100), nullable=False)
    price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    departure_port: Mapped[str] = mapped_column(String(100), nullable=False)
    duration_days: Mapped[int] = mapped_column(Integer, nullable=False)
    seed_batch_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)


class InsurancePlan(Base):
    __tablename__ = "insurance_plans"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    provider_name: Mapped[str] = mapped_column(String(100), nullable=False)
    policy_name: Mapped[str] = mapped_column(String(100), nullable=False)
    price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    coverage_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    details: Mapped[str] = mapped_column(Text, nullable=True)
    seed_batch_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
