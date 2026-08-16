import React, { useState, useEffect } from 'react';
import { 
  Compass, FileText, Wallet, Bell, Shield, ArrowRight, Search, 
  MapPin, Calendar, Clock, AlertTriangle, User, ChevronRight, Download, Award,
  Plane, Hotel, Home, Gift, TrendingUp, Bus, Users, Car, Coins, ShieldCheck, Heart, Sparkles
} from 'lucide-react';
import { API_URL } from './config/api';
import TripExpenseManager from './TripExpenseManager';

interface DashboardPageProps {
  onNavigate: (path: string) => void;
  token: string | null;
  setActiveTab: (tab: string) => void;
}

export default function DashboardPage({ onNavigate, token, setActiveTab }: DashboardPageProps) {
  const [data, setData] = useState<any>(null);
  const [rewardsData, setRewardsData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const [offers, setOffers] = useState<any[] | null>(null);
  const [offersLoading, setOffersLoading] = useState<boolean>(true);
  const [offersError, setOffersError] = useState<string | null>(null);

  const categories = [
    { id: 'flights', label: 'Flights', icon: Plane, desc: 'Domestic & international flights', cta: 'Search Flights' },
    { id: 'hotels', label: 'Hotels', icon: Hotel, desc: 'Stay at your favorite destinations', cta: 'Explore Hotels' },
    { id: 'holidays', label: 'Holidays / Trips', icon: Gift, desc: 'Curated vacation packages', cta: 'Explore Holidays' },
    { id: 'trains', label: 'Trains', icon: TrendingUp, desc: 'IRCTC tickets with zero fees', cta: 'Book Trains' },
    { id: 'buses', label: 'Buses', icon: Bus, desc: 'Sleeper state & private buses', cta: 'Book Buses' },
    { id: 'cabs', label: 'Cabs', icon: Users, desc: 'Outstation, local & airport transfers', cta: 'Book Cabs' },
    { id: 'rent-a-ride', label: 'Cars / Self Drive', icon: Car, desc: 'Rent premium self-drive vehicles', cta: 'Rent Cars' },
    { id: 'tours', label: 'Activities', icon: Compass, desc: 'Local experiences & guided tours', cta: 'Explore Activities' },
    { id: 'visa', label: 'Visa', icon: FileText, desc: 'Apply travel visa online easily', cta: 'Apply Visa' },
    { id: 'forex', label: 'Forex', icon: Coins, desc: 'Zero-commission currency exchange', cta: 'Buy Forex' },
    { id: 'insurance', label: 'Travel Insurance', icon: ShieldCheck, desc: 'Instant travel coverage & protection', cta: 'Get Insurance' },
    { id: 'wishlist', label: 'Wishlist', icon: Heart, desc: 'Your saved flights & hotels', cta: 'View Wishlist' },
    { id: 'ai-planner', label: 'AI Trip Planner', icon: Sparkles, desc: 'Plan curated trips via AI instantly', cta: 'Ask AI' }
  ];

  const handleCategoryClick = (categoryId: string) => {
    if (categoryId === 'wishlist') {
      setActiveTab('wishlist');
    } else if (categoryId === 'ai-planner') {
      setActiveTab('ai-planner');
    } else {
      sessionStorage.setItem('active_vertical', categoryId);
      setActiveTab('explore');
    }
  };

  const handleOfferClick = (offer: any) => {
    const code = offer.coupon_code || offer.promo_code;
    if (code) {
      navigator.clipboard?.writeText(code).catch(() => {});
      sessionStorage.setItem('active_coupon', code);
      sessionStorage.setItem('promo_code', code);
    }
    handleCategoryClick(offer.category);
  };

  const formatValidityDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      return `${d.getDate()} ${months[d.getMonth()]}`;
    } catch (e) {
      return dateStr;
    }
  };

  const formatCategoryName = (cat: string) => {
    if (!cat) return "";
    if (cat.toLowerCase() === "bus") return "Buses";
    return cat.charAt(0).toUpperCase() + cat.slice(1);
  };

  const getHeaders = () => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const localToken = token || localStorage.getItem('token');
    if (localToken) headers['Authorization'] = `Bearer ${localToken}`;
    return headers;
  };

  const fetchDashboard = async (attempt = 1) => {
    setLoading(true);
    setError(null);
    setRetryCount(attempt - 1);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000); // 8s timeout
    try {
      const res = await fetch(`${API_URL}/dashboard`, {
        headers: getHeaders(),
        signal: controller.signal
      });
      clearTimeout(timeout);
      if (!res.ok) throw new Error(`Server returned ${res.status} — please retry.`);
      const resData = await res.json();
      setData(resData);
      setError(null);
      setRetryCount(0);
    } catch (err: any) {
      clearTimeout(timeout);
      if (attempt < 3) {
        setRetryCount(attempt);
        setTimeout(() => fetchDashboard(attempt + 1), 1000);
        return;
      }
      const msg = err.name === 'AbortError'
        ? 'Dashboard load timed out. The backend might be slow — please retry.'
        : err.message?.includes('Failed to fetch')
          ? 'Cannot reach backend server. Make sure the backend is running on port 8000.'
          : err.message || 'Dashboard load failed. Please retry.';
      setError(msg);
    } finally {
      setLoading(false);
    }

    // Rewards — non-blocking
    fetch(`${API_URL}/rewards`, { headers: getHeaders() })
      .then(res => { if (res.ok) return res.json(); })
      .then(d => { if (d) setRewardsData(d); })
      .catch(() => {});
  };
  
  const fetchOffers = async () => {
    setOffersLoading(true);
    setOffersError(null);
    try {
      const res = await fetch(`${API_URL}/offers/active`, { headers: getHeaders() });
      if (!res.ok) throw new Error("Offers request failed");
      const resData = await res.json();
      setOffers(resData.offers || []);
    } catch (err: any) {
      console.error(err);
      setOffersError("Offers are temporarily unavailable.");
    } finally {
      setOffersLoading(false);
    }
  };

  useEffect(() => { 
    fetchDashboard(); 
    fetchOffers();
  }, [token]);

  const getGreeting = () => {
    const hr = new Date().getHours();
    if (hr < 12) return 'Good morning';
    if (hr < 17) return 'Good afternoon';
    return 'Good evening';
  };

  if (loading) {
    return (
      <div className="min-h-full p-4 md:p-8 bg-[#0a0f1d] text-white font-sans text-left space-y-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="h-12 bg-slate-800/40 rounded-xl w-1/3 animate-pulse" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="h-48 bg-slate-800/40 rounded-3xl animate-pulse" />
              <div className="h-64 bg-slate-800/40 rounded-3xl animate-pulse" />
            </div>
            <div className="space-y-6">
              <div className="h-32 bg-slate-800/40 rounded-3xl animate-pulse" />
              <div className="h-48 bg-slate-800/40 rounded-3xl animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || (!data && !loading)) {
    return (
      <div className="min-h-full flex flex-col items-center justify-center p-6 bg-[#0a0f1d] text-white text-center font-sans">
        <div className="max-w-md w-full p-8 rounded-3xl space-y-5" style={{ background: '#111827', border: '2px solid #ef4444', boxShadow: '0 0 30px rgba(239,68,68,0.15)' }}>
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto" style={{ background: 'rgba(239,68,68,0.1)' }}>
            <AlertTriangle className="text-rose-400" size={32} />
          </div>
          <div>
            <h2 className="text-lg font-black uppercase tracking-wider" style={{ color: '#f1f5f9' }}>Backend Offline</h2>
            <p className="text-xs font-semibold mt-2 leading-relaxed" style={{ color: '#94a3b8' }}>
              {error || 'Dashboard data could not be loaded.'}
            </p>
          </div>
          <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#475569' }}>
            Tried {retryCount + 1} time{retryCount > 0 ? 's' : ''} — backend may be offline
          </div>
          <button
            onClick={() => fetchDashboard(1)}
            className="w-full py-3 font-black uppercase text-xs cursor-pointer transition-all"
            style={{ background: '#3b82f6', color: '#fff', borderRadius: '12px', border: '2px solid #1d4ed8' }}
          >
            🔄 Retry Connection
          </button>
        </div>
      </div>
    );
  }

  const { user_summary, upcoming_trip, recent_bookings, wallet_summary, reward_points, active_price_alerts_count, unread_notification_count } = data;

  return (
    <div className="min-h-full p-4 md:p-8 bg-[#0a0f1d] text-white font-sans text-left">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Welcome Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-slate-100">
              {getGreeting()}, {user_summary?.first_name || 'Traveler'} 👋
            </h1>
            <p className="text-xs text-slate-400 font-semibold mt-1">
              Welcome back to your AI-First Travel Terminal. Here's your journey summary.
            </p>
          </div>
          
          {/* Quick Search */}
          <div className="relative max-w-sm w-full">
            <input 
              type="text" 
              placeholder="Search flights, hotels, cabs..." 
              onClick={() => setActiveTab('explore')}
              className="w-full bg-[#111827]/80 text-xs px-10 py-2.5 border-2 border-slate-800 rounded-xl focus:outline-none focus:border-yellow-400 font-semibold placeholder-slate-500 cursor-pointer"
            />
            <Search className="absolute left-3.5 top-3 text-slate-500" size={16} />
          </div>
        </div>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Main Content Column */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Next Upcoming Trip Card */}
            {upcoming_trip ? (
              <div className="bg-gradient-to-br from-[#1b2640] to-[#111827] border border-slate-800 p-6 rounded-3xl relative overflow-hidden shadow-2xl">
                <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                  <Compass size={150} className="text-white" />
                </div>
                
                <div className="flex items-center gap-2 bg-yellow-400/10 text-yellow-400 text-[10px] font-black uppercase px-2.5 py-1 rounded-full border border-yellow-400/20 w-fit">
                  <Clock size={12} /> Next Upcoming Journey
                </div>
                
                <h2 className="text-xl md:text-2xl font-black mt-4 text-slate-100 uppercase tracking-tight">
                  {upcoming_trip.name}
                </h2>
                
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-6 border-t border-slate-800/80 pt-4 text-xs font-semibold text-slate-400">
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Destination</span>
                    <span className="text-slate-200 flex items-center gap-1">
                      <MapPin size={12} className="text-yellow-400" /> {upcoming_trip.destination || 'Multiple'}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Timeline</span>
                    <span className="text-slate-200 flex items-center gap-1">
                      <Calendar size={12} className="text-yellow-400" /> {upcoming_trip.start_date || 'TBD'}
                    </span>
                  </div>
                  <div className="col-span-2 md:col-span-1 space-y-1">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Bookings</span>
                    <span className="text-slate-200">
                      {upcoming_trip.booking_references?.length || 0} associated items
                    </span>
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                  <button 
                    onClick={() => setActiveTab('trips')}
                    className="px-4 py-2 bg-yellow-400 hover:bg-yellow-500 text-black text-xs font-black uppercase rounded-xl border border-black shadow-[3px_3px_0px_0px_#000000] active:translate-y-0.5 active:shadow-none transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    View Timeline <ArrowRight size={14} />
                  </button>
                  <button 
                    onClick={() => setActiveTab('documents')}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-black uppercase rounded-xl border border-slate-700 transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    Document Vault
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-gradient-to-br from-[#1e293b]/60 to-[#0f172a]/95 border border-slate-800/80 p-6 md:p-8 rounded-3xl shadow-xl space-y-8 text-left">
                {/* Header empty-state */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-slate-800/60 pb-6">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse" />
                      <h2 className="text-sm font-black uppercase tracking-wider text-slate-200">NO UPCOMING TRIPS</h2>
                    </div>
                    <p className="text-xs text-slate-400 font-semibold max-w-xl">
                      You don't have any journeys scheduled in the next 5 days. Ready to start planning your next travel gate?
                    </p>
                  </div>
                  <button 
                    onClick={() => setActiveTab('explore')}
                    className="self-start sm:self-center px-4 py-2.5 bg-yellow-400 hover:bg-yellow-500 text-black text-xs font-black uppercase rounded-xl border border-black shadow-[3px_3px_0px_0px_#000000] active:translate-y-0.5 active:shadow-none transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-yellow-400"
                    aria-label="Book New Trip Now"
                  >
                    BOOK NEW TRIP NOW →
                  </button>
                </div>

                {/* Explore Travel grid section */}
                <div className="space-y-4">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-2">
                    <Compass size={14} className="text-indigo-400" /> Explore Travel
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                    {categories.map((cat) => {
                      const IconComponent = cat.icon;
                      // categoryOfferText retrieves the offer description dynamically or from fallbacks
                      
                      // Dynamic check to prevent runtime errors if helper was not defined locally
                      const categoryOfferText = (() => {
                        if (offers && offers.length > 0) {
                          const matched = offers.find((o: any) => {
                            const oCat = (o.category || "").toLowerCase().trim();
                            const cId = cat.id.toLowerCase().trim();
                            if (oCat === cId) return true;
                            if (cId === "buses" && oCat === "bus") return true;
                            if (cId === "rent-a-ride" && (oCat === "car" || oCat === "cars")) return true;
                            if (cId === "tours" && (oCat === "activities" || oCat === "activity" || oCat === "tours")) return true;
                            if (cId === "holidays" && (oCat === "holiday" || oCat === "holidays")) return true;
                            return false;
                          });
                          if (matched) {
                            return matched.discount_type === 'percentage' 
                              ? `${matched.discount_value}% OFF`
                              : `₹${matched.discount_value.toLocaleString()} OFF`;
                          }
                        }
                        if (cat.id === 'flights') return '12% OFF';
                        if (cat.id === 'hotels') return '20% OFF';
                        if (cat.id === 'trains') return '10% OFF';
                        if (cat.id === 'buses') return '20% OFF';
                        if (cat.id === 'cabs') return '15% OFF';
                        if (cat.id === 'holidays') return '₹1,500 OFF';
                        if (cat.id === 'forex') return 'Best Rates';
                        if (cat.id === 'visa') return 'From ₹999';
                        if (cat.id === 'insurance') return 'From ₹49/day';
                        return null;
                      })();

                      return (
                        <div
                          key={cat.id}
                          onClick={() => handleCategoryClick(cat.id)}
                          className="bg-[#0f172a]/55 hover:bg-[#0f172a]/85 border border-[#1e293b] hover:border-yellow-400/40 p-4 rounded-2xl flex flex-col justify-between items-start gap-3 transition-all duration-300 group cursor-pointer shadow-md text-left focus-within:ring-2 focus-within:ring-yellow-400 focus-within:outline-none"
                          tabIndex={0}
                          role="button"
                          aria-label={`Explore ${cat.label}`}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              handleCategoryClick(cat.id);
                            }
                          }}
                        >
                          <div className="flex items-center gap-3 w-full">
                            <div className="p-2 rounded-xl bg-[#1e293b]/55 group-hover:scale-110 transition-all text-slate-400 group-hover:text-yellow-400 group-hover:bg-[#1e293b]">
                              <IconComponent size={18} />
                            </div>
                            <span className="text-[11px] font-black uppercase text-slate-200 tracking-wider group-hover:text-white transition-colors">
                              {cat.label}
                            </span>
                          </div>

                          <div className="flex-1 w-full space-y-1.5">
                            <p className="text-[10px] text-slate-400 font-semibold leading-relaxed">
                              {cat.desc}
                            </p>
                            {categoryOfferText && (
                              <span className="inline-block text-[9px] font-black text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 font-mono uppercase tracking-wider">
                                🔥 {categoryOfferText}
                              </span>
                            )}
                          </div>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCategoryClick(cat.id);
                            }}
                            className="w-full py-1.5 bg-[#1e293b] hover:bg-[#334155] text-slate-300 hover:text-white font-black text-[9px] uppercase rounded-lg border border-[#334155]/80 transition-all text-center focus:outline-none focus:ring-1 focus:ring-yellow-400"
                            aria-label={`${cat.cta}`}
                          >
                            {cat.cta}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 🔥 HOT DEALS FOR YOU section */}
                <div className="space-y-4 pt-4 border-t border-slate-800/60">
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-2">
                    🔥 Hot Deals For You
                  </h3>

                  {offersLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {[1, 2].map((i) => (
                        <div key={i} className="h-36 bg-[#1e293b]/40 rounded-2xl animate-pulse border border-slate-800" />
                      ))}
                    </div>
                  ) : offersError ? (
                    <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/60 text-rose-400 text-xs font-semibold">
                      ⚠️ {offersError}
                    </div>
                  ) : offers && offers.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {offers.map((offer) => {
                        const discountText = offer.discount_type === 'percentage' 
                          ? `${offer.discount_value}% OFF`
                          : `Flat ₹${offer.discount_value.toLocaleString()} OFF`;
                        
                        return (
                          <div
                            key={offer.id}
                            onClick={() => handleOfferClick(offer)}
                            className="bg-slate-900/50 hover:bg-slate-900/80 border border-slate-800 hover:border-indigo-500/30 p-5 rounded-2xl relative overflow-hidden transition-all duration-300 flex flex-col justify-between gap-4 group cursor-pointer shadow-lg text-left focus-within:ring-2 focus-within:ring-indigo-500 focus-within:outline-none"
                            tabIndex={0}
                            role="button"
                            aria-label={`Offer: ${offer.title}`}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                handleOfferClick(offer);
                              }
                            }}
                          >
                            <div className="space-y-2">
                              <div className="flex justify-between items-start gap-2">
                                <span className="text-[9px] font-black uppercase tracking-wider text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                                  {formatCategoryName(offer.category)}
                                </span>
                                {offer.tags && (
                                  <span className="text-[9px] font-bold text-yellow-400/90 bg-yellow-400/5 px-2 py-0.5 rounded border border-yellow-400/10">
                                    {offer.tags}
                                  </span>
                                )}
                              </div>
                              <h4 className="text-xs md:text-sm font-black text-slate-100 group-hover:text-yellow-400 transition-colors uppercase tracking-tight">
                                {offer.title}
                              </h4>
                              <p className="text-[11px] text-slate-400 font-semibold leading-relaxed">
                                {offer.description}
                              </p>
                            </div>

                            <div className="flex flex-col gap-3 pt-3 border-t border-slate-800/80">
                              <div className="flex items-center justify-between flex-wrap gap-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-black text-emerald-400 font-mono">
                                    {discountText}
                                  </span>
                                  {offer.coupon_code && (
                                    <span 
                                      className="font-mono text-[9px] font-black bg-slate-950 px-2 py-0.5 rounded border border-slate-800 text-slate-300 cursor-copy hover:text-white"
                                      title="Click to copy coupon code"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        navigator.clipboard?.writeText(offer.coupon_code).catch(() => {});
                                        alert(`Coupon code ${offer.coupon_code} copied to clipboard!`);
                                      }}
                                    >
                                      Code: {offer.coupon_code}
                                    </span>
                                  )}
                                </div>
                                <span className="text-[9px] text-slate-500 font-semibold">
                                  {offer.valid_until ? `Valid until: ${formatValidityDate(offer.valid_until)}` : ''}
                                </span>
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOfferClick(offer);
                                }}
                                className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[10px] uppercase rounded-xl border border-black shadow-[2px_2px_0px_0px_#000000] active:translate-y-0.5 active:shadow-none transition-all cursor-pointer text-center focus:outline-none focus:ring-1 focus:ring-yellow-400"
                              >
                                Explore {formatCategoryName(offer.category)}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800/60 text-slate-400 text-xs font-semibold">
                      No active offers right now.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Recent Bookings List */}
            <div style={{ background: '#111827', border: '1px solid #334155' }} className="p-6 rounded-3xl shadow-xl space-y-4">
              <div style={{ borderBottom: '1px solid #334155' }} className="flex justify-between items-center pb-3">
                <h3 className="text-sm font-black uppercase tracking-wider" style={{ color: '#ffffff' }}>Recent Bookings</h3>
                <button 
                  onClick={() => setActiveTab('trips')}
                  className="text-xs font-bold text-yellow-400 hover:underline flex items-center gap-0.5"
                >
                  View All <ChevronRight size={14} />
                </button>
              </div>

              {recent_bookings && recent_bookings.length > 0 ? (
                <div className="space-y-2">
                  {recent_bookings.map((booking: any) => (
                    <div 
                      key={booking.booking_reference} 
                      style={{ background: '#1e293b', border: '1px solid #475569', borderRadius: '14px', padding: '12px 14px' }}
                      className="flex flex-wrap md:flex-nowrap justify-between items-center gap-3"
                    >
                      <div className="space-y-1 flex-1 min-w-0">
                        {/* Title */}
                        <div className="text-xs font-black truncate" style={{ color: '#f1f5f9' }}>
                          {booking.title || `${booking.vertical?.toUpperCase() || 'BOOKING'} — ${booking.booking_reference}`}
                        </div>
                        {/* Sub info */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-[10px] font-bold" style={{ color: '#94a3b8' }}>
                            #{booking.booking_reference}
                          </span>
                          <span style={{
                            fontSize: '9px', fontWeight: 900, textTransform: 'uppercase',
                            padding: '1px 8px', borderRadius: '999px',
                            background: booking.status === 'CONFIRMED' ? 'rgba(16,185,129,0.15)' : booking.status === 'CANCELLED' || booking.status === 'EXPIRED' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
                            color: booking.status === 'CONFIRMED' ? '#6ee7b7' : booking.status === 'CANCELLED' || booking.status === 'EXPIRED' ? '#fca5a5' : '#fcd34d',
                            border: `1px solid ${booking.status === 'CONFIRMED' ? 'rgba(16,185,129,0.3)' : booking.status === 'CANCELLED' || booking.status === 'EXPIRED' ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.3)'}`
                          }}>
                            {booking.status}
                          </span>
                        </div>
                        {/* Description */}
                        {booking.description && (
                          <div className="text-[10px] font-medium truncate" style={{ color: '#64748b' }}>
                            {booking.description}
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="font-mono text-sm font-black" style={{ color: '#f8fafc' }}>
                          ₹{booking.total_amount?.toLocaleString() || '0'}
                        </span>
                        <a 
                          href={`/api/v1/bookings/${booking.booking_reference}/pdf`} 
                          target="_blank" 
                          rel="noreferrer"
                          style={{ background: '#334155', border: '1px solid #475569', borderRadius: '8px', padding: '6px', color: '#94a3b8', display: 'flex' }}
                          title="Download E-Ticket"
                        >
                          <Download size={14} />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ border: '1px dashed #334155', borderRadius: '14px', color: '#94a3b8' }} className="py-8 text-center text-sm font-semibold">
                  No bookings found in your traveler ledger.
                </div>
              )}
            </div>


            {/* Trip Expense Manager */}
            <TripExpenseManager token={token} />

            {/* Quick Actions Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Document Vault', icon: <FileText className="text-blue-400" />, tab: 'documents' },
                { label: 'Wallet & Loyalty', icon: <Wallet className="text-amber-400" />, tab: 'wallet' },
                { label: 'AI Assistant', icon: <Compass className="text-emerald-400" />, tab: 'chat' },
                { label: 'Explore & Book', icon: <Compass className="text-rose-400" />, tab: 'explore' }
              ].map(act => (
                <button
                  key={act.label}
                  onClick={() => {
                    if (act.tab === 'documents') {
                      onNavigate('/documents');
                    } else {
                      setActiveTab(act.tab);
                    }
                  }}
                  className="bg-[#111827]/60 border border-slate-800/80 p-4 rounded-2xl hover:border-yellow-400/40 hover:bg-slate-800/30 transition-all text-center flex flex-col items-center gap-2 group cursor-pointer shadow-lg"
                >
                  <div className="p-3 rounded-xl bg-slate-800/50 group-hover:scale-110 transition-transform">
                    {act.icon}
                  </div>
                  <span className="text-[10px] font-black uppercase text-slate-300 tracking-wider">
                    {act.label}
                  </span>
                </button>
              ))}
            </div>

          </div>

          {/* Right Sidebar Column */}
          <div className="space-y-6">
            
            {/* Wallet & Rewards Card */}
            <div className="bg-gradient-to-br from-[#1e1b4b] to-[#111827] border border-slate-600 p-6 rounded-3xl shadow-xl space-y-4 text-left">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-300">Wallet Summary</span>
                <span className="flex items-center gap-1 text-[10px] bg-indigo-500/10 text-indigo-400 font-black px-2 py-0.5 rounded border border-indigo-500/20">
                  <Award size={12} /> {rewardsData?.level || user_summary?.tier || 'Silver'} Member
                </span>
              </div>
              
              <div className="space-y-1">
                <span className="text-2xl md:text-3xl font-mono font-black text-slate-100">
                  ₹{wallet_summary?.balance?.toLocaleString() || '0'}
                </span>
                <span className="text-[10px] text-slate-500 font-semibold block">Available balance in your Wallet</span>
              </div>

              {/* Loyalty Rewards Display */}
              <div className="border-t border-slate-800/80 pt-4 space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-bold uppercase tracking-wider text-[9px]">Loyalty Points Balance</span>
                  <span className="font-mono text-sm font-black text-yellow-400">
                    {rewardsData?.points !== undefined ? rewardsData.points : (reward_points || 0)} pts
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[9px] font-bold text-slate-400 uppercase">
                    <span>Level: {rewardsData?.level || 'Explorer'}</span>
                    {rewardsData?.next_level && <span>Next Level: {rewardsData.next_level}</span>}
                  </div>
                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-yellow-500 to-amber-400 transition-all duration-500"
                      style={{ width: `${rewardsData?.progress || 0}%` }}
                    />
                  </div>
                  <div className="text-[8px] text-slate-500 text-right font-semibold">
                    {rewardsData?.progress || 0}% progress to next tier
                  </div>
                </div>

                {/* Loyalty Transaction History */}
                {rewardsData?.history && rewardsData.history.length > 0 && (
                  <div className="space-y-1.5 mt-2">
                    <span className="text-[9px] text-slate-500 uppercase tracking-wider block font-bold">Transaction History</span>
                    <div className="max-h-24 overflow-y-auto space-y-1 pr-1">
                      {rewardsData.history.map((tx: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center text-[10px] bg-slate-950/40 p-1.5 rounded-lg border border-slate-900/60">
                          <span className="text-slate-300 font-medium truncate max-w-[140px]" title={tx.description}>
                            {tx.description}
                          </span>
                          <span className="text-slate-500 font-mono text-[8px]">
                            {tx.created_at ? new Date(tx.created_at).toLocaleDateString() : 'Recent'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t border-slate-800/80 pt-4 flex justify-between items-center">
                <button
                  onClick={() => setActiveTab('wallet')}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase rounded-lg border border-black shadow-[2px_2px_0px_0px_#000000] transition-all cursor-pointer"
                >
                  Manage Wallet
                </button>
              </div>
            </div>

            {/* Notifications Telemetry Teaser */}
            <div className="bg-[#111827] border border-slate-700 p-6 rounded-3xl shadow-xl space-y-4 text-left">
              <div className="flex justify-between items-center border-b border-slate-700 pb-3">
                <span className="text-xs font-black uppercase tracking-wider text-white">Live Telemetry Alerts</span>
                {unread_notification_count > 0 && (
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse border border-black" />
                )}
              </div>
              
              <div className="space-y-2">
                <p className="text-[11px] text-slate-400 font-semibold leading-relaxed">
                  You have <span className="text-rose-400 font-black">{unread_notification_count || 0} unread</span> alerts in your live telemetry channel.
                </p>
                <button 
                  onClick={() => onNavigate('/notifications')}
                  className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-white text-[10px] font-black uppercase rounded-xl border border-slate-700 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  Open Notifications Hub <ChevronRight size={12} />
                </button>
              </div>
            </div>

            {/* Wishlist & Price Alerts */}
            <div className="bg-[#111827] border border-slate-700 p-6 rounded-3xl shadow-xl space-y-4 text-left">
              <div className="flex justify-between items-center border-b border-slate-700 pb-3">
                <span className="text-xs font-black uppercase tracking-wider text-white">Active Price Alerts</span>
                <span className="font-mono text-xs font-black text-yellow-400">{active_price_alerts_count || 0}</span>
              </div>
              
              <p className="text-[11px] text-slate-400 font-semibold leading-relaxed">
                Smart agents are monitoring ticket price swings across your wishlist. We'll alert you on drop events.
              </p>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
