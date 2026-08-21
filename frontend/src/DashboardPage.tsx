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
  const DEFAULT_DASHBOARD_DATA = {
    user_summary: {
      first_name: "Traveler",
      full_name: "Ghumne Chale Traveler",
      email: "user@ghumnechale.com",
      role: "user"
    },
    wallet: { balance: 34500, currency: "INR" },
    loyalty: { points: 450, tier: "Gold" },
    recent_bookings: [],
    active_trips_count: 2
  };

  const [data, setData] = useState<any>(DEFAULT_DASHBOARD_DATA);
  const [rewardsData, setRewardsData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const [offers, setOffers] = useState<any[] | null>(null);
  const [offersLoading, setOffersLoading] = useState<boolean>(false);
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

  const fetchDashboard = async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000); // 3s fast timeout
    try {
      const res = await fetch(`${API_URL}/dashboard`, {
        headers: getHeaders(),
        signal: controller.signal
      });
      clearTimeout(timeout);
      if (res.ok) {
        const resData = await res.json();
        if (resData && resData.user_summary) {
          setData(resData);
        }
      }
    } catch (err: any) {
      clearTimeout(timeout);
      // Non-blocking background sync - keep interactive dashboard UI active
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
            onClick={() => fetchDashboard()}
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

  const storedFullName = typeof window !== 'undefined' ? localStorage.getItem("user_full_name") : null;
  const emailUsername = user_summary?.email ? user_summary.email.split('@')[0] : (typeof window !== 'undefined' && localStorage.getItem("user_email") ? localStorage.getItem("user_email")!.split('@')[0] : '');
  const validStored = (storedFullName && storedFullName !== 'Traveler' && storedFullName !== 'Ghumne Chale Traveler') ? storedFullName : null;
  const validSummary = (user_summary?.full_name && user_summary.full_name !== 'Traveler' && user_summary.full_name !== 'Ghumne Chale Traveler') ? user_summary.full_name : (user_summary?.first_name && user_summary.first_name !== 'Traveler' ? user_summary.first_name : null);
  const rawDisplayName = validStored || validSummary || emailUsername || 'Traveler';
  const displayName = rawDisplayName.includes('@') ? rawDisplayName.split('@')[0] : rawDisplayName.split(' ')[0];

  return (
    <div className="min-h-full p-4 md:p-8 bg-[#0a0f1d] text-white font-sans text-left">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Welcome Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-slate-100">
              {getGreeting()}, {displayName} 👋
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

        {/* Dashboard Content Container */}
        <div className="space-y-6">
          
          {/* Main Content Column */}
          <div className="space-y-6">
            
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
                      <h2 className="text-xs font-black uppercase tracking-wider text-slate-300">No Active Journeys</h2>
                    </div>
                    <p className="text-xs text-slate-400 font-semibold max-w-xl">
                      Your travel timeline is currently clear. Use the AI Trip Planner below to start designing your next customized flight itinerary or hotel stay.
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

                {/* Premium Dashboard Welcome Hero Section */}
                <div className="relative overflow-hidden rounded-3xl border border-[#334155] bg-gradient-to-br from-[#0f172a] via-[#1e1b4b]/40 to-[#0f172a] p-8 md:p-10 shadow-2xl text-left">
                  {/* Glowing background highlights */}
                  <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-indigo-600/10 blur-[100px] pointer-events-none" />
                  <div className="absolute -left-20 -bottom-20 h-64 w-64 rounded-full bg-yellow-500/5 blur-[100px] pointer-events-none" />
                  
                  <div className="relative flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div className="space-y-4 max-w-2xl">
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-black uppercase tracking-wider">
                        ✨ Next-Gen AI Trip Planner
                      </div>
                      <h2 className="text-xl md:text-3xl font-black text-white tracking-tight uppercase leading-none">
                        Welcome to <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-orange-400 to-indigo-400">Ghumne Chale</span>
                      </h2>
                      <p className="text-[11px] md:text-xs text-slate-400 font-semibold leading-relaxed">
                        Experience intelligent travel coordination. Our advanced AI Copilot generates custom itineraries, maps out multi-city routes, keeps tabs on real-time flight changes, and manages secure transactions for hotels, cabs, and flight tickets globally.
                      </p>
                      
                      <div className="flex flex-wrap gap-3 pt-1">
                        <div className="flex items-center gap-2 bg-[#0b0f19] px-3.5 py-2 rounded-xl border border-[#1e293b] shadow-inner">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
                          <span className="text-[9px] text-slate-300 font-black uppercase tracking-wider font-mono">AI Engine: Online</span>
                        </div>
                        <div className="flex items-center gap-2 bg-[#0b0f19] px-3.5 py-2 rounded-xl border border-[#1e293b] shadow-inner">
                          <span className="text-yellow-400 text-[10px]">⚡</span>
                          <span className="text-[9px] text-slate-300 font-black uppercase tracking-wider font-mono">Direct API Gateways</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-row md:flex-col gap-3 w-full md:w-auto">
                      <button
                        onClick={() => handleCategoryClick("ai-planner")}
                        className="flex-1 md:w-48 py-3.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-black text-[10px] uppercase tracking-wider rounded-xl border border-indigo-500/30 shadow-lg hover:shadow-indigo-500/20 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer text-center"
                      >
                        🚀 Launch AI Planner
                      </button>
                      <button
                        onClick={() => onNavigate("/profile")}
                        className="flex-1 md:w-48 py-3.5 bg-[#1e293b]/50 hover:bg-[#1e293b] text-slate-300 hover:text-white font-black text-[10px] uppercase tracking-wider rounded-xl border border-[#334155] active:translate-y-0.5 transition-all cursor-pointer text-center"
                      >
                        👤 View Profile
                      </button>
                    </div>
                  </div>

                  {/* Micro stats banner for premium feel */}
                  <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-4 border-t border-[#1e293b]/60 pt-6">
                    <div>
                      <span className="block text-[9px] text-slate-500 font-black uppercase tracking-wider">Global Search</span>
                      <span className="text-xs font-black text-slate-200 uppercase tracking-tight">Instant Fares</span>
                    </div>
                    <div>
                      <span className="block text-[9px] text-slate-500 font-black uppercase tracking-wider">PCI Compliance</span>
                      <span className="text-xs font-black text-emerald-400 uppercase tracking-tight">100% Secure</span>
                    </div>
                    <div>
                      <span className="block text-[9px] text-slate-500 font-black uppercase tracking-wider">Live Assistance</span>
                      <span className="text-xs font-black text-indigo-400 uppercase tracking-tight">24/7 AI Chat</span>
                    </div>
                    <div>
                      <span className="block text-[9px] text-slate-500 font-black uppercase tracking-wider">Smart Invoices</span>
                      <span className="text-xs font-black text-slate-200 uppercase tracking-tight">One-Click PDF</span>
                    </div>
                  </div>
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
        </div>

      </div>
    </div>
  );
}
