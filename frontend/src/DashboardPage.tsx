import React, { useState, useEffect } from 'react';
import { 
  Compass, FileText, Wallet, Bell, Shield, ArrowRight, Search, 
  MapPin, Calendar, Clock, AlertTriangle, User, ChevronRight, Download, Award
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

  const getHeaders = () => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const localToken = token || localStorage.getItem('token');
    if (localToken) headers['Authorization'] = `Bearer ${localToken}`;
    return headers;
  };

  const fetchDashboard = async (attempt = 1) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/dashboard`, { headers: getHeaders() });
      if (!res.ok) throw new Error(`Server error ${res.status}: Failed to load dashboard.`);
      const resData = await res.json();
      setData(resData);
      setError(null);
    } catch (err: any) {
      if (attempt < 3) {
        // Auto-retry up to 3 times with 1.5s delay
        setTimeout(() => fetchDashboard(attempt + 1), 1500);
        return;
      }
      console.error('Dashboard load failed after retries:', err);
      setError(err.message || 'Could not connect to server. Please retry.');
    } finally {
      setLoading(false);
    }

    // Fetch rewards (non-blocking, best-effort)
    fetch(`${API_URL}/rewards`, { headers: getHeaders() })
      .then(res => { if (res.ok) return res.json(); })
      .then(resRewards => { if (resRewards) setRewardsData(resRewards); })
      .catch(() => {});
  };

  useEffect(() => {
    fetchDashboard();
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

  if (error || !data) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-[#0a0f1d] text-white text-center font-sans">
        <div className="max-w-md w-full p-8 bg-[#111827] border-4 border-black shadow-[8px_8px_0px_0px_#ef4444] space-y-6">
          <AlertTriangle className="mx-auto text-rose-500" size={48} />
          <h2 className="text-xl font-black uppercase text-slate-100">Telemetry Sync Failed</h2>
          <p className="text-xs text-slate-400 font-semibold leading-relaxed">
            {error || 'Could not load your travel dashboard. Please check your network connection.'}
          </p>
          <button
            onClick={fetchDashboard}
            className="w-full py-2.5 bg-rose-500 hover:bg-rose-600 text-white font-black border-2 border-black shadow-[4px_4px_0px_0px_#000000] active:translate-y-0.5 active:shadow-[2px_2px_0px_0px_#000000] transition-all cursor-pointer text-xs uppercase"
          >
            Retry Telemetry Sync ➔
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
              <div className="bg-[#111827]/80 border border-slate-800/80 p-8 rounded-3xl text-center space-y-4 shadow-xl">
                <div className="w-16 h-16 rounded-full bg-slate-800/60 flex items-center justify-center mx-auto text-2xl">
                  ✨
                </div>
                <div className="space-y-2">
                  <h3 className="text-sm font-black uppercase tracking-wider text-slate-300">No upcoming trips</h3>
                  <p className="text-xs text-slate-500 font-semibold leading-relaxed max-w-sm mx-auto">
                    You don't have any journeys scheduled in the next 5 days. Ready to start planning your next travel gate?
                  </p>
                </div>
                <button 
                  onClick={() => setActiveTab('explore')}
                  className="px-5 py-2.5 bg-yellow-400 hover:bg-yellow-500 text-black text-xs font-black uppercase rounded-xl border border-black shadow-[3px_3px_0px_0px_#000000] transition-all cursor-pointer"
                >
                  Book New Trip Now ➔
                </button>
              </div>
            )}

            {/* Recent Bookings List */}
            <div className="bg-[#111827] border border-slate-700 p-6 rounded-3xl shadow-xl space-y-4">
              <div className="flex justify-between items-center border-b border-slate-700 pb-3">
                <h3 className="text-sm font-black uppercase tracking-wider text-white">Recent Bookings</h3>
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
                      className="bg-slate-800 border border-slate-600 rounded-2xl p-3.5 flex flex-wrap md:flex-nowrap justify-between items-center gap-3 hover:border-slate-500 transition-colors"
                    >
                      <div className="space-y-1 flex-1 min-w-0">
                        {/* Title row */}
                        <div className="text-xs font-black text-white truncate">
                          {booking.title || booking.booking_reference}
                        </div>
                        {/* Sub info row */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-[10px] font-bold text-slate-400">
                            {booking.booking_reference}
                          </span>
                          <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${
                            booking.status === 'CONFIRMED' 
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' 
                              : booking.status === 'CANCELLED'
                              ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                              : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          }`}>
                            {booking.status}
                          </span>
                        </div>
                        {/* Description */}
                        {booking.description && (
                          <div className="text-[10px] text-slate-400 font-medium truncate">
                            {booking.description}
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="font-mono text-sm font-black text-white">
                          ₹{booking.total_amount?.toLocaleString() || '0'}
                        </span>
                        <a 
                          href={`/api/v1/bookings/${booking.booking_reference}/pdf`} 
                          target="_blank" 
                          rel="noreferrer"
                          className="p-1.5 rounded-lg bg-slate-700 border border-slate-600 hover:bg-yellow-400 hover:text-black hover:border-black transition-colors text-slate-300"
                          title="Download E-Ticket"
                        >
                          <Download size={14} />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-sm text-slate-400 font-semibold border border-dashed border-slate-700 rounded-2xl">
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
