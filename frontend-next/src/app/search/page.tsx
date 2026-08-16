"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Scene3D } from "@/components/Scene3D";
import { SearchScene } from "@/scenes/SearchScene";
import { Button, Card, Badge, Input, Select, Skeleton } from "@/components/ui";
import { Plane, Filter, SlidersHorizontal, MapPin, Calendar, Compass } from "lucide-react";

import { logFunnel } from "@/lib/telemetry";

// Mock flights database based on the TBO / Amadeus inventory schema
const MOCK_FLIGHTS = [
  { id: "1", carrier: "IndiGo", flightNumber: "6E-502", from: "DEL", to: "BOM", price: 4800, duration: "2h 10m", stops: "direct", time: "06:00 - 08:10" },
  { id: "2", carrier: "Vistara", flightNumber: "UK-811", from: "DEL", to: "BOM", price: 6200, duration: "2h 15m", stops: "direct", time: "08:30 - 10:45" },
  { id: "3", carrier: "Air India", flightNumber: "AI-312", from: "DEL", to: "BOM", price: 5900, duration: "2h 05m", stops: "direct", time: "11:15 - 13:20" },
  { id: "4", carrier: "Akasa Air", flightNumber: "QP-110", from: "DEL", to: "BOM", price: 4200, duration: "2h 20m", stops: "direct", time: "14:40 - 17:00" },
  { id: "5", carrier: "IndiGo", flightNumber: "6E-241", from: "DEL", to: "BOM", price: 7100, duration: "4h 30m", stops: "1stop", time: "15:20 - 19:50" },
  { id: "6", carrier: "Vistara", flightNumber: "UK-835", from: "DEL", to: "BOM", price: 8300, duration: "5h 15m", stops: "1stop", time: "17:10 - 22:25" },
];

export default function SearchPage() {
  const router = useRouter();

  useEffect(() => {
    logFunnel("search");
  }, []);

  // Local UI filters/sorting states
  const [fromCity, setFromCity] = useState("Delhi (DEL)");
  const [toCity, setToCity] = useState("Mumbai (BOM)");
  const [selectedCarrier, setSelectedCarrier] = useState("");
  const [stopsFilter, setStopsFilter] = useState("all");
  const [priceLimit, setPriceLimit] = useState(9000);
  const [sortBy, setSortBy] = useState("price_asc");

  // Simulated request states
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(MOCK_FLIGHTS);

  // Trigger brief skeleton loader on filter changes to simulate live API fetches
  const handleFilterUpdate = (updateFn: () => void) => {
    setLoading(true);
    updateFn();
    setTimeout(() => {
      setLoading(false);
    }, 450);
  };

  // Perform reactive search filtering on client
  const filteredFlights = useMemo(() => {
    let list = [...MOCK_FLIGHTS];

    // Filter by Carrier
    if (selectedCarrier) {
      list = list.filter((f) => f.carrier === selectedCarrier);
    }

    // Filter by Stops
    if (stopsFilter !== "all") {
      list = list.filter((f) => f.stops === stopsFilter);
    }

    // Filter by Price Limit
    list = list.filter((f) => f.price <= priceLimit);

    // Sort Results
    if (sortBy === "price_asc") {
      list.sort((a, b) => a.price - b.price);
    } else if (sortBy === "price_desc") {
      list.sort((a, b) => b.price - a.price);
    }

    return list;
  }, [selectedCarrier, stopsFilter, priceLimit, sortBy]);

  // Clear filters handler
  const handleClearFilters = () => {
    handleFilterUpdate(() => {
      setSelectedCarrier("");
      setStopsFilter("all");
      setPriceLimit(9000);
      setSortBy("price_asc");
    });
  };

  // 2D Static Globe fallback representation
  const staticGlobeFallback = (
    <div className="relative w-full h-48 bg-slate-900/30 rounded-lg border border-slate-800 flex items-center justify-center overflow-hidden">
      <div className="absolute w-28 h-28 rounded-full border border-slate-800/40 animate-pulse flex items-center justify-center">
        <div className="w-20 h-20 rounded-full border border-dashed border-teal/40" />
      </div>
      <div className="flex gap-2 z-10">
        <Badge variant="upcoming">{filteredFlights.length} dots plotted</Badge>
      </div>
      <span className="absolute bottom-2 right-3 text-[8px] font-data text-muted uppercase">
        Static Map Mode
      </span>
    </div>
  );

  return (
    <div className="min-h-screen bg-base text-primary font-body pb-12">
      <title>Search Flight Listings | Ghumne Chale</title>
      {/* Navbar */}
      <nav className="border-b border-slate-900 bg-base/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <span className="font-display font-extrabold text-base tracking-wider text-primary uppercase flex items-center gap-2 cursor-pointer" onClick={() => router.push("/")}>
              ✈️ GHUMNE CHALE
            </span>
            <div className="hidden md:flex items-center gap-4 text-xs font-bold uppercase tracking-wider">
              <a href="/" className="text-muted hover:text-primary transition-colors">
                Explore
              </a>
              <a href="/dashboard" className="text-muted hover:text-primary transition-colors">
                My Trips
              </a>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              onClick={() => router.push("/components-preview")}
              className="text-xs font-bold border-slate-800"
            >
              UI Sandbox
            </Button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 md:px-8 mt-8 grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* Left Sidebar Filter Section */}
        <div className="space-y-6 text-left">
          
          {/* Subtle R3F globe decorator panel */}
          <Card variant="default" className="relative overflow-hidden p-0 h-48 border border-slate-900">
            <div className="absolute top-3 left-3 z-10 pointer-events-none">
              <span className="text-[8px] font-display font-black text-teal uppercase tracking-widest block">
                TELEMETRY SCANNER
              </span>
              <span className="text-[10px] font-bold text-primary block mt-0.5">
                India Route Radar
              </span>
            </div>
            
            <Scene3D
              id="search-globe"
              sceneContent={<SearchScene resultsCount={filteredFlights.length} />}
              fallback={staticGlobeFallback}
            />
            {/* Height Spacer container */}
            <div className="w-full h-full pointer-events-none" />
          </Card>

          {/* Filters Form Container using Phase 1 inputs */}
          <Card variant="default" className="space-y-6">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="font-display font-extrabold text-xs uppercase tracking-wider text-primary flex items-center gap-2">
                <Filter size={14} className="text-marigold" /> Filters
              </h3>
              <button
                onClick={handleClearFilters}
                className="text-[9px] font-bold text-teal uppercase hover:underline cursor-pointer"
              >
                Reset All
              </button>
            </div>

            {/* Inputs for Route details */}
            <div className="space-y-4">
              <Input
                label="Origin"
                value={fromCity}
                onChange={(e) => setFromCity(e.target.value)}
                disabled
              />
              <Input
                label="Destination"
                value={toCity}
                onChange={(e) => setToCity(e.target.value)}
                disabled
              />
            </div>

            {/* Select options */}
            <div className="space-y-4">
              <Select
                label="Airline Carrier"
                value={selectedCarrier}
                onChange={(e) => handleFilterUpdate(() => setSelectedCarrier(e.target.value))}
                options={[
                  { value: "", label: "All Carriers" },
                  { value: "IndiGo", label: "IndiGo" },
                  { value: "Vistara", label: "Vistara" },
                  { value: "Air India", label: "Air India" },
                  { value: "Akasa Air", label: "Akasa Air" },
                ]}
              />

              <Select
                label="Stops Limit"
                value={stopsFilter}
                onChange={(e) => handleFilterUpdate(() => setStopsFilter(e.target.value))}
                options={[
                  { value: "all", label: "All Stops" },
                  { value: "direct", label: "Non-stop only" },
                  { value: "1stop", label: "Max 1 stop" },
                ]}
              />
            </div>

            {/* Range Slider for Price Limit */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider text-muted font-display">
                <span>Max Tariff</span>
                <span className="font-data text-marigold">₹{priceLimit.toLocaleString()}</span>
              </div>
              <input
                type="range"
                min="4000"
                max="9000"
                step="500"
                value={priceLimit}
                onChange={(e) => handleFilterUpdate(() => setPriceLimit(Number(e.target.value)))}
                className="w-full accent-marigold cursor-ew-resize bg-slate-800 rounded-lg appearance-none h-1.5"
              />
              <div className="flex justify-between text-[8px] text-muted font-semibold">
                <span>₹4,000</span>
                <span>₹9,000</span>
              </div>
            </div>

          </Card>
        </div>

        {/* Right Search Results Column */}
        <div className="lg:col-span-3 space-y-6 text-left">
          
          {/* Listing controls & Sort Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface/50 border border-slate-900 p-4 rounded-lg">
            <div className="space-y-0.5">
              <span className="text-[9px] font-display font-black text-teal tracking-widest block uppercase">
                AVAILABLE TICKETS
              </span>
              <span className="text-xs font-bold text-primary block">
                {filteredFlights.length} routes found matching your ledger specifications
              </span>
            </div>
            
            <div className="flex items-center gap-3">
              <Select
                value={sortBy}
                onChange={(e) => handleFilterUpdate(() => setSortBy(e.target.value))}
                className="py-2 px-3 text-[10px] font-bold text-slate-300 bg-surface border border-slate-850"
                options={[
                  { value: "price_asc", label: "Price: Low to High" },
                  { value: "price_desc", label: "Price: High to Low" },
                ]}
              />
            </div>
          </div>

          {/* Results Area */}
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((idx) => (
                <div key={idx} className="bg-surface border border-slate-900 p-5 rounded-lg space-y-3">
                  <div className="flex justify-between">
                    <Skeleton variant="line" className="w-1/3 h-5 bg-slate-800/40" />
                    <Skeleton variant="line" className="w-20 h-4 bg-slate-800/40" />
                  </div>
                  <Skeleton variant="line" className="w-2/3 h-3 bg-slate-800/40" />
                  <div className="flex justify-between pt-2">
                    <Skeleton variant="line" className="w-1/4 h-3 bg-slate-800/40" />
                    <Skeleton variant="line" className="w-24 h-8 bg-slate-800/40" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredFlights.length > 0 ? (
            <div className="space-y-4">
              {filteredFlights.map((flight, idx) => {
                // One result card shown in hover/focus glow state (e.g. index 0)
                const isHighlighted = idx === 0;
                
                return (
                  <Card
                    key={flight.id}
                    variant="interactive"
                    className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition-all duration-300 ${
                      isHighlighted
                        ? "border-teal/60 shadow-[0_0_15px_rgba(15,163,160,0.18)]"
                        : "border-slate-800"
                    }`}
                  >
                    {/* Carrier Info */}
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-display font-extrabold text-primary uppercase tracking-tight flex items-center gap-1.5">
                          <Plane size={14} className="text-teal" /> {flight.carrier} {flight.flightNumber}
                        </span>
                        <Badge variant={flight.stops === "direct" ? "upcoming" : "info"}>
                          {flight.stops === "direct" ? "Non-stop" : "1 Stop"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-muted font-semibold flex-wrap">
                        <span className="font-data">{flight.time}</span>
                        <span>•</span>
                        <span>{flight.duration}</span>
                        <span>•</span>
                        <span className="capitalize">{flight.from} ➔ {flight.to}</span>
                      </div>
                    </div>

                    {/* Booking Price & CTA */}
                    <div className="flex items-center gap-4 flex-shrink-0 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 border-slate-850 pt-3 sm:pt-0">
                      <div className="text-left sm:text-right">
                        <span className="text-[8px] text-muted font-bold block uppercase">Fare Estimate</span>
                        <span className="font-data font-black text-sm text-primary">
                          ₹{flight.price.toLocaleString()}
                        </span>
                      </div>
                      <Button
                        variant={isHighlighted ? "primary-marigold" : "ghost"}
                        onClick={() => router.push("/book")}
                        className="py-2.5 px-4 text-[10px]"
                      >
                        Reserve
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : (
            // Empty State
            <div className="py-12 border-2 border-dashed border-slate-850 rounded-lg text-center space-y-4 bg-surface/30">
              <div className="space-y-1">
                <p className="text-xs font-display font-black uppercase text-muted tracking-wider">
                  No trips match these filters
                </p>
                <p className="text-[10px] text-slate-500 font-semibold max-w-xs mx-auto">
                  Try relaxing your price constraints or matching with all carriers.
                </p>
              </div>
              <Button
                variant="primary-marigold"
                onClick={handleClearFilters}
                className="text-[10px] py-2"
              >
                Clear Filters
              </Button>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
