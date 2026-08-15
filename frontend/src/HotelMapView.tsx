import React, { useState } from 'react';
import { MapPin, Heart, Star, ArrowRight, X } from 'lucide-react';

interface HotelMapViewProps {
  results: any[];
  onBook: (data: any) => void;
  wishlistItems: any[];
  toggleWishlist?: (itemType: string, refId: string, snapshot: any) => Promise<void>;
}

export default function HotelMapView({ results, onBook, wishlistItems, toggleWishlist }: HotelMapViewProps) {
  const [selectedPin, setSelectedPin] = useState<any | null>(null);

  // Generate fake map coordinates offset based on Goa hotels' coordinates or names
  const getMapPosition = (hotel: any, index: number) => {
    // Default fallback offsets to scatter hotels beautifully on the mock map background
    let x = 30 + (index * 25) % 55;
    let y = 20 + (index * 30) % 65;
    
    if (hotel.latitude && hotel.longitude) {
      // Normalize Goa coordinates (lat: 14.9 to 15.8, lng: 73.7 to 74.3) to percentage
      const latMin = 15.1;
      const latMax = 15.5;
      const lngMin = 73.7;
      const lngMax = 74.3;
      
      const latPercent = ((hotel.latitude - latMin) / (latMax - latMin)) * 100;
      const lngPercent = ((hotel.longitude - lngMin) / (lngMax - lngMin)) * 100;
      
      // Clamp to ensure they stay nicely inside container
      x = Math.max(10, Math.min(90, lngPercent));
      y = Math.max(10, Math.min(90, 100 - latPercent)); // Inverse Y because lat increases northwards
    }
    return { left: `${x}%`, top: `${y}%` };
  };

  return (
    <div className="relative w-full h-[550px] bg-[#0c1322] border-3 border-black shadow-[6px_6px_0px_0px_#000000] rounded-3xl overflow-hidden font-sans select-none">
      {/* Mock Map Background Canvas */}
      <div className="absolute inset-0 bg-[#0f172a] opacity-90 pointer-events-none">
        {/* Fake oceans, roads, and land grids */}
        <div className="absolute inset-0 opacity-[0.06]" style={{
          backgroundImage: 'radial-gradient(circle, #38bdf8 1.5px, transparent 1.5px)',
          backgroundSize: '24px 24px'
        }} />
        {/* Ocean/Water body */}
        <div className="absolute top-0 bottom-0 left-0 w-1/3 bg-blue-950/40 border-r-4 border-dashed border-blue-900/30 flex items-center justify-center">
          <span className="text-[10px] font-mono tracking-widest uppercase text-blue-400/30 rotate-275 font-black">ARABIAN SEA</span>
        </div>
        {/* Land contours */}
        <div className="absolute top-1/4 right-10 w-48 h-48 rounded-full bg-[#1e293b]/30 blur-2xl" />
        <div className="absolute bottom-1/4 right-1/4 w-72 h-72 rounded-full bg-emerald-950/10 blur-3xl" />
        {/* Fake roads */}
        <div className="absolute top-1/3 left-0 right-0 h-1 bg-slate-800/40" />
        <div className="absolute top-2/3 left-0 right-0 h-1 bg-slate-800/40" />
        <div className="absolute top-0 bottom-0 left-1/2 w-1 bg-slate-800/40" />
        <div className="absolute top-0 bottom-0 left-2/3 w-1 bg-slate-800/40" />
      </div>

      {/* Map Header Instructions */}
      <div className="absolute top-4 left-4 bg-slate-900/90 border border-slate-800/80 rounded-2xl px-3 py-1.5 z-20 text-[10px] text-slate-300 font-bold flex items-center gap-2 backdrop-blur-md">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
        🗺️ Click on any price tag pin to view details and book rooms instantly
      </div>

      {/* Map Pins Container */}
      <div className="absolute inset-0 z-10">
        {results.map((hotel, idx) => {
          const hotelId = hotel.hotelId || hotel.hotel_id || "H101";
          const hotelName = hotel.hotelName || hotel.name || "Luxury Stay";
          const price = hotel.price || 0;
          const pos = getMapPosition(hotel, idx);
          const isSelected = selectedPin && (selectedPin.hotelId === hotelId);

          return (
            <div
              key={hotelId}
              className="absolute transform -translate-x-1/2 -translate-y-1/2 transition-all duration-300 cursor-pointer"
              style={pos}
              onClick={() => setSelectedPin(hotel)}
            >
              {/* Pin Indicator */}
              <div className="flex flex-col items-center group">
                <div className={`px-2.5 py-1 rounded-full font-black text-xs border-2 shadow-lg transition-transform active:scale-90 ${
                  isSelected
                    ? 'bg-yellow-400 text-black border-black scale-110'
                    : 'bg-blue-600 text-white border-blue-400 group-hover:bg-blue-500 group-hover:scale-105'
                }`}>
                  ₹{Math.round(price).toLocaleString()}
                </div>
                <MapPin className={`mt-0.5 ${isSelected ? 'text-yellow-400 fill-black' : 'text-blue-500 group-hover:text-blue-400'}`} size={16} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Hotel Tooltip Modal / Drawer Overlay */}
      {selectedPin && (
        <div className="absolute bottom-6 left-6 right-6 md:left-auto md:right-6 md:w-80 bg-[#121c33] border-3 border-black shadow-[4px_4px_0px_0px_#000000] rounded-3xl p-4 z-30 animate-slideup text-left space-y-3">
          {/* Tooltip Header */}
          <div className="flex justify-between items-start gap-2">
            <h4 className="font-extrabold text-white text-sm line-clamp-1">{selectedPin.hotelName || selectedPin.name}</h4>
            <button
              onClick={() => setSelectedPin(null)}
              className="text-slate-400 hover:text-white p-0.5 rounded-full hover:bg-slate-800 transition-colors cursor-pointer border-none bg-transparent outline-none"
            >
              <X size={16} />
            </button>
          </div>

          {/* Hotel Thumbnail Image */}
          <img
            src={selectedPin.image || selectedPin.primary_photo_url || "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800"}
            alt={selectedPin.hotelName || selectedPin.name}
            className="w-full h-28 object-cover rounded-xl border border-slate-800"
          />

          {/* Quick Metrics */}
          <div className="flex justify-between items-center text-xs">
            <div className="flex items-center gap-1 text-yellow-400 font-bold">
              <Star size={12} className="fill-yellow-400 text-yellow-400" />
              <span>{selectedPin.rating || 4.2} ★</span>
            </div>
            <span className="font-black text-emerald-400 text-sm">
              ₹{Number(selectedPin.price || 0).toLocaleString()} <span className="text-[9px] text-slate-500 font-normal">/ night</span>
            </span>
          </div>

          <p className="text-[10px] text-slate-400 line-clamp-2 leading-relaxed">
            {selectedPin.address || 'Heritage beachside area'} · {selectedPin.distance || 1.2} km from center.
          </p>

          {/* Action Row */}
          <div className="flex gap-2">
            {/* Save to Wishlist Toggle */}
            <button
              onClick={() => toggleWishlist && toggleWishlist(
                "hotel",
                selectedPin.hotelId || selectedPin.hotel_id || "H101",
                {
                  hotelName: selectedPin.hotelName || selectedPin.name,
                  address: selectedPin.address,
                  price: selectedPin.price,
                  rating: selectedPin.rating
                }
              )}
              className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                wishlistItems.some((w: any) => w.item_ref_id === (selectedPin.hotelId || selectedPin.hotel_id) && w.item_type.toLowerCase() === 'hotel')
                  ? "bg-rose-950/60 text-rose-400 border-rose-900/50"
                  : "bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700"
              }`}
              title="Save to Wishlist"
            >
              <Heart
                size={14}
                className={wishlistItems.some((w: any) => w.item_ref_id === (selectedPin.hotelId || selectedPin.hotel_id) && w.item_type.toLowerCase() === 'hotel') ? "fill-rose-400 text-rose-400" : "text-slate-300"}
              />
            </button>

            {/* Book Now */}
            <button
              onClick={() => onBook({
                vertical: "hotels",
                amount: (selectedPin.price || 5000) * 2,
                details: {
                  hotel_name: selectedPin.hotelName || selectedPin.name,
                  hotel_id: selectedPin.hotelId || selectedPin.hotel_id,
                  room_type: selectedPin.room_type || "Deluxe Room",
                  guests: [{ name: "Traveler Guest", age: 32 }],
                  provider_name: "Booking.com API",
                  offer_id: `OF-BK-${selectedPin.hotelId || selectedPin.hotel_id}`
                },
                title: selectedPin.hotelName || selectedPin.name,
                subtitle: selectedPin.address || 'Goa'
              })}
              className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-black px-4 py-2.5 rounded-xl flex-1 flex items-center justify-center gap-1 shadow-md shadow-blue-500/10 active:scale-95 transition-all cursor-pointer border-none"
            >
              Book Room <ArrowRight size={12} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
