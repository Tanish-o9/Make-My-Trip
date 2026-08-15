import React, { useState, useEffect } from 'react';
import { 
  Heart, Plane, Hotel, Calendar, MapPin, Trash2, ShieldAlert,
  Compass, Clock, Tag, ArrowRight, Star
} from 'lucide-react';
import { API_URL } from './config/api';

interface WishlistPageProps {
  token: string | null;
  onNavigate: (path: string) => void;
  setActiveTab: (tab: string) => void;
  onBook: (data: any) => void;
}

export default function WishlistPage({ token, onNavigate, setActiveTab, onBook }: WishlistPageProps) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterVertical, setFilterVertical] = useState<string>('all');

  const getHeaders = () => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const localToken = token || localStorage.getItem('token');
    if (localToken) headers['Authorization'] = `Bearer ${localToken}`;
    return headers;
  };

  const fetchWishlist = () => {
    setLoading(true);
    fetch(`${API_URL}/wishlist`, { headers: getHeaders() })
      .then(res => {
        if (!res.ok) throw new Error('Failed to retrieve wishlist items.');
        return res.json();
      })
      .then(data => {
        setItems(data);
        setError(null);
      })
      .catch(err => {
        console.error(err);
        setError(err.message || 'Error loading wishlist.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchWishlist();
  }, [token]);

  const removeItem = async (id: number) => {
    try {
      const res = await fetch(`${API_URL}/wishlist/${id}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      if (res.ok) {
        setItems(prev => prev.filter(item => item.id !== id));
      } else {
        throw new Error('Failed to delete item.');
      }
    } catch (err: any) {
      alert(err.message || 'Could not remove item.');
    }
  };

  const filteredItems = filterVertical === 'all' 
    ? items 
    : items.filter(item => item.item_type.toLowerCase() === filterVertical.toLowerCase());

  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-[#0a0f1d] text-white font-sans text-left space-y-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="h-10 bg-slate-800/40 rounded-xl w-1/4 animate-pulse" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-64 bg-slate-800/40 rounded-3xl animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-[#0a0f1d] text-white font-sans text-left space-y-6">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Page Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800 pb-5">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-white flex items-center gap-2">
              <Heart className="text-rose-500 fill-rose-500" size={28} /> My Wishlist
            </h1>
            <p className="text-slate-400 text-xs mt-1">Saved flights, hotels, activities, and dream destinations.</p>
          </div>
          
          {/* Quick Stats */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl px-4 py-2.5 flex gap-4 text-xs font-bold text-slate-300">
            <span>❤️ {items.length} Saved</span>
            <span className="text-slate-600">|</span>
            <span>✈️ {items.filter(i => i.item_type === 'flight').length} Flights</span>
            <span className="text-slate-600">|</span>
            <span>🏨 {items.filter(i => i.item_type === 'hotel').length} Hotels</span>
          </div>
        </div>

        {/* Tab Filters */}
        <div className="flex flex-wrap gap-2">
          {['all', 'flight', 'hotel', 'activity', 'destination'].map(vert => (
            <button
              key={vert}
              onClick={() => setFilterVertical(vert)}
              className={`px-4 py-2 text-xs font-black uppercase tracking-wider rounded-xl border transition-all cursor-pointer ${
                filterVertical === vert
                  ? 'bg-rose-500 text-white border-rose-400 shadow-md shadow-rose-500/10'
                  : 'bg-[#121c33] text-slate-300 border-slate-800 hover:border-slate-700 hover:text-white'
              }`}
            >
              {vert === 'all' ? 'All Verticals' : `${vert}s`}
            </button>
          ))}
        </div>

        {/* Error state */}
        {error && (
          <div className="bg-rose-950/40 border border-rose-900 text-rose-200 p-5 rounded-2xl text-center text-xs max-w-md mx-auto my-6 shadow-xl">
            {error}
          </div>
        )}

        {/* Empty State */}
        {!error && filteredItems.length === 0 && (
          <div className="flex flex-col items-center justify-center p-12 bg-[#121c33]/40 border border-slate-800/80 rounded-3xl text-center max-w-2xl mx-auto my-12 space-y-6">
            <div className="w-16 h-16 rounded-full bg-slate-900 flex items-center justify-center border border-slate-800">
              <Heart className="text-slate-600" size={32} />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-extrabold text-slate-200">Start saving places and deals you love.</h3>
              <p className="text-xs text-slate-400 leading-relaxed max-w-sm mx-auto">
                Compare price trends, track drop alerts, and bookmark premium flight routes or hotel stays to lock in details later.
              </p>
            </div>
            <button
              onClick={() => setActiveTab('explore')}
              className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-extrabold px-6 py-3 rounded-2xl flex items-center gap-1.5 shadow-lg shadow-blue-500/10 transition-all cursor-pointer"
            >
              <Compass size={16} /> Explore Live Deals
            </button>
          </div>
        )}

        {/* Wishlist Grid */}
        {!error && filteredItems.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredItems.map(item => {
              const snap = item.snapshot_json || {};
              const type = item.item_type.toLowerCase();
              
              return (
                <div key={item.id} className="bg-[#121c33] rounded-3xl border border-slate-800 hover:border-slate-700/80 transition-all flex flex-col justify-between overflow-hidden shadow-lg relative group">
                  {/* Remove Button */}
                  <button
                    onClick={() => removeItem(item.id)}
                    className="absolute top-4 right-4 bg-slate-950/80 hover:bg-rose-600/90 text-slate-400 hover:text-white p-2 rounded-full border border-slate-800/40 opacity-0 group-hover:opacity-100 transition-opacity z-20 cursor-pointer"
                    title="Remove from Wishlist"
                  >
                    <Trash2 size={14} />
                  </button>

                  <div className="p-5 space-y-4">
                    {/* Header Info */}
                    <div className="flex items-center gap-2">
                      <span className="bg-rose-950/60 text-rose-400 border border-rose-900/30 text-[9px] px-2 py-0.5 rounded font-black uppercase tracking-wider flex items-center gap-1">
                        {type === 'flight' ? <Plane size={10} /> : <Hotel size={10} />}
                        {type}
                      </span>
                      <span className="text-[10px] text-slate-500 font-semibold flex items-center gap-1">
                        <Clock size={10} /> Saved {new Date(item.created_at).toLocaleDateString()}
                      </span>
                    </div>

                    {/* Content Details */}
                    {type === 'flight' ? (
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-black text-white">{snap.airline || 'IndiGo'}</span>
                          <span className="text-[10px] font-mono bg-slate-950 text-blue-300 px-2 py-0.5 rounded border border-slate-800">{item.item_ref_id}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs bg-slate-950/40 p-3 rounded-2xl border border-slate-800/60">
                          <div>
                            <p className="text-[9px] text-slate-500 font-extrabold uppercase">Origin</p>
                            <p className="font-bold text-white mt-0.5">{snap.origin || 'DEL'}</p>
                          </div>
                          <div className="h-px bg-slate-800 flex-1 mx-4 relative">
                            <span className="absolute left-1/2 -top-1.5 -translate-x-1/2 text-[9px] text-slate-500">✈️</span>
                          </div>
                          <div className="text-right">
                            <p className="text-[9px] text-slate-500 font-extrabold uppercase">Destination</p>
                            <p className="font-bold text-white mt-0.5">{snap.destination || 'GOI'}</p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <h3 className="font-black text-slate-100 text-base line-clamp-1">{snap.hotelName || snap.name || 'Luxury Boutique Stay'}</h3>
                        <p className="text-xs text-slate-400 flex items-center gap-1">
                          <MapPin size={12} className="text-slate-500" />
                          <span className="truncate">{snap.address || 'Heritage Area'}</span>
                        </p>
                        {snap.rating && (
                          <div className="flex items-center gap-1 text-xs text-blue-400 font-black">
                            <Star size={12} className="fill-blue-400 text-blue-400" /> {snap.rating} ★
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Pricing / Booking Row */}
                  <div className="bg-slate-950/50 p-4 border-t border-slate-800/80 flex justify-between items-center">
                    <div>
                      <p className="text-[9px] text-slate-500 uppercase font-black">Wishlist Price</p>
                      <p className="font-black text-emerald-400 text-base mt-0.5">
                        ₹{Number(snap.price || 0).toLocaleString()}
                      </p>
                    </div>
                    
                    <button
                      onClick={() => {
                        if (type === 'flight') {
                          setActiveTab('explore');
                        } else {
                          onBook({
                            vertical: "hotels",
                            amount: snap.price * 2,
                            details: {
                              hotel_name: snap.hotelName || 'Luxury Stay',
                              hotel_id: item.item_ref_id,
                              room_type: snap.roomType || "Standard Room",
                              guests: [{ name: "Traveler Guest", age: 32 }],
                              provider_name: "Booking.com API",
                              offer_id: `OF-BK-${item.item_ref_id}`
                            },
                            title: snap.hotelName || 'Luxury Stay',
                            subtitle: snap.address || 'Goa'
                          });
                        }
                      }}
                      className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-black px-4 py-2 rounded-xl flex items-center gap-1 shadow-md shadow-blue-500/10 active:scale-95 transition-all cursor-pointer border-none"
                    >
                      Book Now <ArrowRight size={12} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
}
