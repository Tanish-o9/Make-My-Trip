import React, { useState } from 'react';
import { Compass, Sparkles, RefreshCw, Plane, Home, Calendar, AlertTriangle, ArrowRight, DollarSign } from 'lucide-react';

interface FlightOption {
  airline: string;
  flight_number: string;
  dep: string;
  arr: string;
  price: number;
  duration: number;
}

interface HotelOption {
  name: string;
  rating: string;
  amenities: string[];
  price: number;
  total_price: number;
}

interface ItineraryDay {
  day: number;
  title: string;
  morning: string;
  afternoon: string;
  evening: string;
}

interface PlannedPackage {
  flights: FlightOption[];
  hotels: HotelOption[];
  itinerary: ItineraryDay[];
  estimated_total: number;
  text: string;
}

export default function AIPlannerDashboard({
  token,
  onDeepLinkFlight,
  onDeepLinkHotel
}: {
  token: string;
  onDeepLinkFlight: (origin: string, dest: string, date: string) => void;
  onDeepLinkHotel: (dest: string, checkIn: string, checkOut: string) => void;
}) {
  const [origin, setOrigin] = useState('DEL');
  const [destination, setDestination] = useState('Goa');
  const [departureDate, setDepartureDate] = useState('2026-12-15');
  const [duration, setDuration] = useState(4);
  const [budget, setBudget] = useState(30000);
  const [passengers, setPassengers] = useState(1);
  const [style, setStyle] = useState('General');
  const [optimizationMode, setOptimizationMode] = useState<'Cheapest' | 'Balanced' | 'Comfort' | 'Premium'>('Balanced');

  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [packageData, setPackageData] = useState<PlannedPackage | null>(null);
  const [rawText, setRawText] = useState('');
  const [warningText, setWarningText] = useState<string | null>(null);

  const API_URL = 'http://localhost:8000/api/v1';

  const handlePlanTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setPackageData(null);
    setWarningText(null);
    setStatusMsg("Supervisor: Routing request to travel planning graph...");

    const returnDateObj = new Date(departureDate);
    returnDateObj.setDate(returnDateObj.getDate() + duration);
    const returnDate = returnDateObj.toISOString().split('T')[0];

    const message = `Plan a trip from ${origin} to ${destination} for ${duration} days on ${departureDate} with a total budget of ₹${budget} for ${passengers} people. Style: ${style}. Mode: ${optimizationMode}.`;

    try {
      // Connect and run completion
      const res = await fetch(`${API_URL}/agents/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          session_id: `session_planner_${Date.now()}`,
          message: message
        })
      });

      if (!res.ok) {
        throw new Error("AI Backend returned error status.");
      }

      const data = await res.json();
      const responseText = data.response || '';
      setRawText(responseText);

      // Parse flights-data, hotels-data, itinerary-data
      const flightsMatch = responseText.match(/```flights-data([\s\S]*?)```/);
      const hotelsMatch = responseText.match(/```hotels-data([\s\S]*?)```/);
      const itinMatch = responseText.match(/```itinerary-data([\s\S]*?)```/);

      let parsedFlights: FlightOption[] = [];
      let parsedHotels: HotelOption[] = [];
      let parsedItin: ItineraryDay[] = [];
      let estTotal = 0;

      if (flightsMatch) {
        try { parsedFlights = JSON.parse(flightsMatch[1].trim()); } catch (err) {}
      }
      if (hotelsMatch) {
        try { parsedHotels = JSON.parse(hotelsMatch[1].trim()); } catch (err) {}
      }
      if (itinMatch) {
        try { parsedItin = JSON.parse(itinMatch[1].trim()); } catch (err) {}
      }

      // Extract warning if present
      const warningMatch = responseText.match(/\*\*⚠️ Estimated cost exceeds your budget by ₹([\d,]+.*?)\.\*\*/);
      if (warningMatch) {
        setWarningText(`Estimated cost exceeds your budget by ₹${warningMatch[1]}.`);
      }

      // Calculate estimated cost
      const estFlightPrice = parsedFlights[0]?.price || 0.0;
      const estHotelPrice = parsedHotels[0]?.total_price || 0.0;
      estTotal = (estFlightPrice * passengers) + estHotelPrice + (2000.0 * passengers);

      setPackageData({
        flights: parsedFlights,
        hotels: parsedHotels,
        itinerary: parsedItin,
        estimated_total: estTotal,
        text: responseText.replace(/```(flights|hotels|itinerary)-data[\s\S]*?```/g, "").trim()
      });

    } catch (err) {
      alert("Error generating trip plan. Please retry in a few moments.");
    } finally {
      setLoading(false);
    }
  };

  const handleMakeCheaper = () => {
    setOptimizationMode('Cheapest');
    setBudget(prev => Math.floor(prev * 0.8));
    // Trigger plan generation immediately in next cycle or prompt user to click Generate
    alert("Optimization mode set to Cheapest and budget optimized. Click 'Generate AI Package' to view updated recommendations.");
  };

  return (
    <div className="space-y-6 text-left max-w-7xl mx-auto p-4">
      {/* Page header */}
      <div className="border-b border-slate-900 pb-4">
        <h2 className="text-3xl font-black text-white uppercase tracking-wider flex items-center gap-2">
          <Sparkles className="text-blue-400 animate-pulse" />
          AI Autonomous Travel Planner
        </h2>
        <p className="text-sm text-slate-400">Specify your budget constraints and let the travel agent graph fetch real bookable pricing packages.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Form Parameters */}
        <div className="space-y-6">
          <div className="glass-card border border-slate-800 rounded-2xl p-6 text-xs space-y-4">
            <h3 className="text-sm font-black text-white uppercase tracking-wide">Configure AI Prompt Parameters</h3>
            
            <form onSubmit={handlePlanTrip} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-400 font-bold block">From</label>
                  <input
                    type="text"
                    value={origin}
                    onChange={(e) => setOrigin(e.target.value.toUpperCase())}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-100 outline-none focus:border-blue-500 text-xs"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400 font-bold block">To</label>
                  <input
                    type="text"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-100 outline-none focus:border-blue-500 text-xs"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-400 font-bold block">Departure Date</label>
                  <input
                    type="date"
                    value={departureDate}
                    onChange={(e) => setDepartureDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-100 outline-none focus:border-blue-500 text-xs"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400 font-bold block">Duration (Days)</label>
                  <input
                    type="number"
                    min={1}
                    value={duration}
                    onChange={(e) => setDuration(parseInt(e.target.value) || 3)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-100 outline-none focus:border-blue-500 text-xs"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-400 font-bold block">Passengers</label>
                  <input
                    type="number"
                    min={1}
                    value={passengers}
                    onChange={(e) => setPassengers(parseInt(e.target.value) || 1)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-100 outline-none focus:border-blue-500 text-xs"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400 font-bold block">Travel Style</label>
                  <select
                    value={style}
                    onChange={(e) => setStyle(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-100 outline-none focus:border-blue-500 text-xs text-left"
                  >
                    <option value="General">General</option>
                    <option value="Luxury">Luxury</option>
                    <option value="Budget">Budget</option>
                    <option value="Adventure">Adventure</option>
                    <option value="Solo">Solo</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 font-bold block">Total Budget Allocation (₹)</label>
                <input
                  type="number"
                  min={5000}
                  value={budget}
                  onChange={(e) => setBudget(parseFloat(e.target.value) || 20000)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-100 outline-none focus:border-blue-500 text-xs"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 font-bold block">Optimization Preference</label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {(['Cheapest', 'Balanced', 'Comfort', 'Premium'] as const).map(mode => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setOptimizationMode(mode)}
                      className={`py-1 rounded border text-[10px] font-bold transition-all cursor-pointer ${
                        optimizationMode === mode 
                          ? 'bg-blue-600 border-blue-500 text-white' 
                          : 'bg-slate-950 border-slate-850 text-slate-400 hover:text-slate-300'
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-black py-2.5 rounded-lg text-xs mt-3 flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              >
                {loading ? <RefreshCw className="animate-spin" size={14} /> : <Sparkles size={14} />}
                Generate AI Package
              </button>
            </form>
          </div>
        </div>

        {/* Right 2 Columns: Output Proposal and Deep Links */}
        <div className="lg:col-span-2 space-y-6">
          {loading && (
            <div className="glass-card border border-slate-800 rounded-2xl p-12 flex flex-col items-center justify-center gap-4 text-slate-400 text-xs">
              <RefreshCw className="animate-spin text-blue-500" size={32} />
              <div className="font-extrabold uppercase tracking-wider text-white">Graphspecialist Orchestrator running...</div>
              <div className="text-[10px] font-mono text-slate-500">{statusMsg}</div>
            </div>
          )}

          {!loading && !packageData && (
            <div className="glass-card border border-slate-800 rounded-2xl p-12 text-center text-slate-500 text-xs space-y-2">
              <Compass size={32} className="mx-auto text-slate-600 mb-2" />
              <div>Fill in your origin, destination, and budget, and generate your custom package.</div>
              <div>The AI planner will query flight & hotel providers in the background.</div>
            </div>
          )}

          {packageData && (
            <div className="space-y-6">
              {/* Budget warning alert */}
              {warningText && (
                <div className="border border-amber-900/30 bg-amber-950/20 p-4 rounded-xl flex items-start gap-3 text-xs">
                  <AlertTriangle className="text-amber-400 mt-0.5" size={16} />
                  <div className="flex-1">
                    <div className="font-black text-amber-300">BUDGET LIMIT EXCEEDED</div>
                    <div className="text-slate-300 mt-0.5">{warningText} Affordability is never faked.</div>
                    <button
                      onClick={handleMakeCheaper}
                      className="mt-2 bg-amber-500 text-black text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded hover:bg-amber-400"
                    >
                      Optimize / Make Cheaper
                    </button>
                  </div>
                </div>
              )}

              {/* Proposal Details Content */}
              <div className="glass-card border border-slate-800 rounded-2xl p-6 space-y-4">
                <div className="flex justify-between items-center border-b border-slate-900 pb-3">
                  <span className="text-[10px] text-blue-400 font-black uppercase tracking-widest">AI Travel Proposal Proposal</span>
                  <div className="text-right">
                    <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Estimated package cost</span>
                    <div className="text-emerald-400 text-base font-black">₹{packageData.estimated_total.toLocaleString()}</div>
                  </div>
                </div>

                {/* Main conversational plan text */}
                <div className="text-slate-300 text-xs whitespace-pre-wrap leading-relaxed">
                  {packageData.text}
                </div>
              </div>

              {/* Deep bookable flight cards */}
              {packageData.flights && packageData.flights.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <Plane size={14} className="text-blue-400" />
                    Real Flight Recommendations (Deep-link checkout)
                  </h3>

                  {packageData.flights.map((fl, idx) => (
                    <div key={idx} className="bg-[#0f192e] p-4 border border-slate-850 rounded-xl flex justify-between items-center">
                      <div>
                        <div className="font-bold text-xs text-slate-200">{fl.airline} ({fl.flight_number})</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">Route: {fl.dep} → {fl.arr}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-extrabold text-emerald-400 text-xs">₹{fl.price.toLocaleString()}</div>
                        <button
                          onClick={() => onDeepLinkFlight(origin, destination, departureDate)}
                          className="mt-1 bg-blue-600 hover:bg-blue-500 text-white text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg flex items-center gap-0.5 cursor-pointer"
                        >
                          Book Now <ArrowRight size={8} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Deep bookable hotel cards */}
              {packageData.hotels && packageData.hotels.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <Home size={14} className="text-blue-400" />
                    Accommodations Recommendations
                  </h3>

                  {packageData.hotels.map((ht, idx) => (
                    <div key={idx} className="bg-[#0f192e] p-4 border border-slate-850 rounded-xl flex justify-between items-center">
                      <div>
                        <div className="font-bold text-xs text-slate-200">{ht.name} ({ht.rating} ★)</div>
                        <div className="flex gap-1 mt-1">
                          {ht.amenities.slice(0, 3).map((am, i) => (
                            <span key={i} className="text-[8px] bg-slate-900 border border-slate-800 text-slate-400 px-1 rounded">{am}</span>
                          ))}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-extrabold text-emerald-400 text-xs">₹{ht.price.toLocaleString()}/night</div>
                        <button
                          onClick={() => {
                            const checkOutDateObj = new Date(departureDate);
                            checkOutDateObj.setDate(checkOutDateObj.getDate() + duration);
                            const checkOutDate = checkOutDateObj.toISOString().split('T')[0];
                            onDeepLinkHotel(destination, departureDate, checkOutDate);
                          }}
                          className="mt-1 bg-blue-600 hover:bg-blue-500 text-white text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg flex items-center gap-0.5 cursor-pointer"
                        >
                          Reserve Room <ArrowRight size={8} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Daily Itinerary Cards */}
              {packageData.itinerary && packageData.itinerary.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <Calendar size={14} className="text-blue-400" />
                    Itinerary Day Cards
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {packageData.itinerary.map((day, idx) => (
                      <div key={idx} className="bg-[#121c33] p-4 border border-slate-850 rounded-xl space-y-2">
                        <div className="font-bold text-xs text-blue-400 border-b border-slate-850 pb-1 flex justify-between items-center">
                          <span>Day {day.day}</span>
                          <span className="text-[9px] text-slate-400 truncate max-w-[120px]">{day.title}</span>
                        </div>
                        <div className="text-[10px] space-y-1 text-slate-300">
                          <div>🌅 <span className="font-semibold text-slate-500">Morning:</span> {day.morning}</div>
                          <div>☀️ <span className="font-semibold text-slate-500">Afternoon:</span> {day.afternoon}</div>
                          <div>🌙 <span className="font-semibold text-slate-500">Evening:</span> {day.evening}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
