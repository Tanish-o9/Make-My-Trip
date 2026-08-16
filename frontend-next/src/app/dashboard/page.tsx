"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Scene3D } from "@/components/Scene3D";
import { DashboardScene } from "@/scenes/DashboardScene";
import { Button, Card, Badge, Skeleton } from "@/components/ui";
import { usePerformance } from "@/context/PerformanceGuard";
import {
  fetchDashboardData,
  fetchRewardsData,
  fetchActiveOffers,
} from "@/lib/dashboard";
import {
  Compass,
  FileText,
  Wallet,
  Bell,
  Award,
  ArrowRight,
  TrendingUp,
  MapPin,
  Calendar,
  AlertTriangle,
  LogOut,
} from "lucide-react";

export default function DashboardPage() {
  const router = useRouter();
  const { use3D } = usePerformance();

  const [data, setData] = useState<any>(null);
  const [rewards, setRewards] = useState<any>(null);
  const [offers, setOffers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Check auth and trigger fetches on mount/token change
  useEffect(() => {
    const localToken = localStorage.getItem("token");
    if (!localToken) {
      setLoading(false);
      setToken(null);
      return;
    }
    setToken(localToken);

    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [dashData, rewardsData, activeOffers] = await Promise.all([
          fetchDashboardData(localToken),
          fetchRewardsData(localToken).catch(() => null),
          fetchActiveOffers(localToken).catch(() => []),
        ]);
        setData(dashData);
        if (rewardsData) setRewards(rewardsData);
        setOffers(activeOffers);
      } catch (err: any) {
        setError(err.message || "Failed to load dashboard data. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [token]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) {
      setLoginError("Please enter email and password.");
      return;
    }
    setLoginLoading(true);
    setLoginError(null);

    try {
      const formBody = `username=${encodeURIComponent(loginEmail.trim())}&password=${encodeURIComponent(loginPassword)}`;
      const res = await fetch("/api/auth/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formBody,
      });

      if (!res.ok) {
        throw new Error("Invalid credentials. Use ankit@example.com / userpass123");
      }

      const tokenData = await res.json();
      localStorage.setItem("token", tokenData.access_token);
      localStorage.setItem("refresh_token", tokenData.refresh_token || "");
      localStorage.setItem("user_role", tokenData.role || "user");
      
      setToken(tokenData.access_token);
    } catch (err: any) {
      setLoginError(err.message || "Connection failed.");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleDemoFill = () => {
    setLoginEmail("ankit@example.com");
    setLoginPassword("userpass123");
  };

  // Logouts
  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user_role");
    setToken(null);
    setData(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-base p-8 space-y-8 flex flex-col items-center justify-center">
        <div className="max-w-4xl w-full space-y-6">
          <Skeleton variant="line" className="w-1/3 h-8 bg-slate-800/40" />
          <Skeleton variant="card" className="h-64 bg-slate-800/40" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Skeleton variant="card" className="bg-slate-800/40" />
            <Skeleton variant="card" className="bg-slate-800/40" />
            <Skeleton variant="card" className="bg-slate-800/40" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-base flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md w-full p-8 bg-surface border-2 border-chili rounded-lg space-y-5 shadow-2xl">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto bg-chili/10">
            <AlertTriangle className="text-chili" size={32} />
          </div>
          <div>
            <h2 className="font-display font-extrabold text-lg uppercase tracking-wider text-primary">
              Telemetry Offline
            </h2>
            <p className="text-xs font-semibold mt-2 text-muted leading-relaxed">
              {error || "Dashboard data could not be loaded."}
            </p>
          </div>
          <Button
            variant="destructive-chili"
            onClick={() => window.location.reload()}
            className="w-full"
          >
            🔄 Retry Connection
          </Button>
        </div>
      </div>
    );
  }

  const {
    user_summary,
    upcoming_trip,
    recent_bookings = [],
    wallet_summary,
    reward_points = 0,
    active_price_alerts = 0,
    notification_count = 0,
  } = data;

  // Derive stats for layout
  const tripsTakenCount = recent_bookings.filter((b: any) => b.status === "CONFIRMED" || b.status === "COMPLETED").length;
  
  // Extract unique destinations
  const uniqueDestinations = new Set(
    recent_bookings
      .map((b: any) => {
        if (b.vertical === "flights" || b.vertical === "trains" || b.vertical === "buses") {
          return b.destination;
        }
        if (b.vertical === "hotels") {
          return b.hotel_name;
        }
        return null;
      })
      .filter(Boolean)
  ).size;

  // Calculate days until next trip
  let daysUntilTrip = "No upcoming trips";
  if (upcoming_trip?.start_date) {
    const diffTime = new Date(upcoming_trip.start_date).getTime() - new Date().getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    daysUntilTrip = diffDays > 0 ? `${diffDays} days left` : "Trip is active";
  }

  // 2D Static SVG fallback illustration of winding ribbon path
  const staticFallbackIllustration = (
    <div className="relative w-full h-64 md:h-80 bg-slate-900/40 rounded-lg border border-slate-800 flex items-center justify-center overflow-hidden">
      <svg className="absolute inset-0 w-full h-full text-slate-800/20" viewBox="0 0 800 300" fill="none">
        <path
          d="M -50 150 C 200 50, 250 250, 400 150 C 550 50, 600 250, 850 150"
          stroke="url(#fallback-gradient)"
          strokeWidth="6"
          strokeDasharray="12 6"
        />
        <defs>
          <linearGradient id="fallback-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#0FA3A0" />
            <stop offset="100%" stopColor="#FF9F1C" />
          </linearGradient>
        </defs>
      </svg>
      {/* Waypoint Markers on Fallback */}
      <div className="absolute flex gap-8 items-center z-10">
        <div className="flex flex-col items-center">
          <div className="w-3.5 h-3.5 rounded-full bg-teal shadow-[0_0_8px_#0FA3A0]" />
          <span className="text-[9px] font-bold text-teal mt-1 font-display">START</span>
        </div>
        {recent_bookings.slice(0, 3).map((b: any, i: number) => (
          <div key={i} className="flex flex-col items-center">
            <div className="w-3.5 h-3.5 rounded-full bg-teal opacity-80" />
            <span className="text-[9px] font-bold text-muted mt-1 font-display">WAYPOINT {i + 1}</span>
          </div>
        ))}
        {upcoming_trip && (
          <div className="flex flex-col items-center">
            <div className="w-4 h-4 rounded-full bg-marigold shadow-[0_0_10px_#FF9F1C] animate-pulse" />
            <span className="text-[9px] font-bold text-marigold mt-1 font-display uppercase">UPCOMING</span>
          </div>
        )}
      </div>
      <span className="absolute bottom-4 right-4 text-[9px] font-data text-muted uppercase">
        2D Illustration Mode
      </span>
    </div>
  );

  return (
    <div className="min-h-screen bg-base text-primary font-body pb-12">
      <title>My Trips Dashboard | Ghumne Chale</title>
      {/* 1. Top navigation */}
      <nav className="border-b border-slate-900 bg-base/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <span className="font-display font-extrabold text-base tracking-wider text-[#F5F3EE] uppercase flex items-center gap-2 cursor-pointer" onClick={() => router.push("/")}>
              ✈️ GHUMNE CHALE
            </span>
            <div className="hidden md:flex items-center gap-4 text-xs font-bold uppercase tracking-wider">
              <a href="/" className="text-muted hover:text-[#F5F3EE] transition-colors">
                Explore
              </a>
              <span className="text-marigold border-b-2 border-marigold pb-1 px-1">
                My Trips
              </span>
            </div>
          </div>
          
          {token && (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 bg-surface border border-slate-800 px-3 py-1.5 rounded-full text-xs font-bold">
                <Award size={14} className="text-marigold" />
                <span className="text-muted">Tier:</span>
                <span className="text-primary capitalize">{rewards?.level || "Silver"}</span>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 rounded-full bg-surface border border-slate-800 hover:border-chili text-muted hover:text-chili transition-colors cursor-pointer"
                title="Sign Out"
              >
                <LogOut size={14} />
              </button>
            </div>
          )}
        </div>
      </nav>

      {!token ? (
        <div className="max-w-md mx-auto px-4 mt-16 space-y-6">
          <Card variant="default" className="p-6 space-y-6 text-left border-slate-800 bg-surface/50 backdrop-blur-md">
            <div className="text-center space-y-2">
              <span className="font-display font-extrabold text-2xl tracking-wider text-primary uppercase">
                ✈️ GHUMNE CHALE
              </span>
              <p className="text-[10px] text-muted font-bold uppercase tracking-wider">
                Enter credentials to view bookings ledger
              </p>
            </div>

            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] text-muted font-bold uppercase">Email Address</label>
                <input
                  type="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="w-full bg-[#111322] border border-slate-850 rounded-md px-3 py-2 text-xs text-primary focus:outline-none focus:border-marigold"
                  placeholder="e.g. ankit@example.com"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-muted font-bold uppercase">Password</label>
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full bg-[#111322] border border-slate-850 rounded-md px-3 py-2 text-xs text-primary focus:outline-none focus:border-marigold"
                  placeholder="Enter password"
                  required
                />
              </div>

              {loginError && (
                <div className="p-3 bg-chili/10 border border-chili/20 rounded-md text-chili text-[10px] font-bold">
                  {loginError}
                </div>
              )}

              <Button
                variant="primary-marigold"
                type="submit"
                className="w-full text-center py-2.5 font-bold uppercase text-xs tracking-wider"
                disabled={loginLoading}
              >
                {loginLoading ? "Opening Ledger..." : "Open bookings ledger"}
              </Button>
            </form>

            <div className="border-t border-slate-850 pt-4 flex flex-col gap-2">
              <span className="text-[9px] text-muted text-center font-semibold">
                Don't have credentials? Use our simulated test account:
              </span>
              <Button
                variant="ghost"
                onClick={handleDemoFill}
                className="w-full text-center text-[10px] text-teal border-slate-850"
              >
                Auto-fill Demo Account
              </Button>
            </div>
          </Card>
        </div>
      ) : (
        <div className="max-w-7xl mx-auto px-4 md:px-8 mt-8 space-y-8">
        {/* 2. Header band */}
        <div className="space-y-2 text-left">
          <Badge variant="upcoming">YOUR JOURNEY SO FAR</Badge>
          <h1 className="font-display font-extrabold text-3xl md:text-4xl text-[#F5F3EE] uppercase tracking-tight">
            Waapis chalna hai kahin?
          </h1>
          <p className="text-xs md:text-sm text-muted font-semibold max-w-xl leading-relaxed">
            Your trips, upcoming plans, and everywhere you've been. Ready to book your next escape?
          </p>
        </div>

        {/* 3. 3D Scene View / Fallback Ribbon */}
        <div className="relative w-full rounded-lg overflow-hidden border border-slate-900">
          {/* Display title for the interactive map */}
          <div className="absolute top-4 left-4 z-10 pointer-events-none">
            <span className="text-[10px] font-display font-black text-teal uppercase tracking-widest block">
              COSMIC LEADGER PATH
            </span>
            <span className="text-xs font-bold text-[#F5F3EE] block mt-0.5">
              Interactive 3D Route Map
            </span>
          </div>

          <Scene3D
            id="dashboard-map"
            sceneContent={<DashboardScene bookings={recent_bookings} upcomingTrip={upcoming_trip} />}
            fallback={staticFallbackIllustration}
          />
          
          {/* If 3D canvas is rendering behind, place a container with layout spacing */}
          {use3D && <div className="w-full h-64 md:h-80 pointer-events-none" />}
        </div>

        {/* 4. Stats row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <Card variant="default" className="flex flex-col justify-between">
            <span className="text-[10px] font-display font-bold uppercase tracking-wider text-muted block">
              Trips Taken
            </span>
            <span className="font-display font-extrabold text-3xl text-primary mt-2">
              {tripsTakenCount}
            </span>
            <span className="text-[9px] text-muted font-semibold mt-1 block">
              Completed bookings in history
            </span>
          </Card>
          <Card variant="default" className="flex flex-col justify-between">
            <span className="text-[10px] font-display font-bold uppercase tracking-wider text-muted block">
              Places Visited
            </span>
            <span className="font-display font-extrabold text-3xl text-teal mt-2">
              {uniqueDestinations}
            </span>
            <span className="text-[9px] text-muted font-semibold mt-1 block">
              Unique locations catalogued
            </span>
          </Card>
          <Card variant="default" className="flex flex-col justify-between">
            <span className="text-[10px] font-display font-bold uppercase tracking-wider text-muted block">
              Next Journey
            </span>
            <span className="font-display font-extrabold text-2xl text-marigold mt-2">
              {daysUntilTrip}
            </span>
            <span className="text-[9px] text-muted font-semibold mt-1 block">
              Countdown to upcoming travel
            </span>
          </Card>
        </div>

        {/* 5. Hero Action CTAs */}
        <div className="flex flex-wrap gap-4 justify-start pt-2">
          <Button
            variant="primary-marigold"
            onClick={() => router.push("/search")}
            className="flex items-center gap-2"
          >
            Plan your next trip <ArrowRight size={14} />
          </Button>
          <Button
            variant="ghost"
            onClick={() => router.push("/components-preview")}
            className="border-slate-800"
          >
            UI Components Preview
          </Button>
        </div>

        {/* 6. Dashboard sections split */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Bookings History column */}
          <div className="lg:col-span-2 space-y-6 text-left">
            <div className="border-b border-slate-900 pb-3 flex justify-between items-center">
              <h3 className="font-display font-extrabold text-sm uppercase tracking-wider text-primary">
                Booking Ledgers
              </h3>
              <Badge variant="info">{recent_bookings.length} Total</Badge>
            </div>

            {recent_bookings.length > 0 ? (
              <div className="space-y-4">
                {recent_bookings.map((booking: any) => {
                  const isUpcoming = upcoming_trip?.booking_references?.includes(booking.booking_reference);
                  const isCancelled = booking.status === "CANCELLED" || booking.status === "EXPIRED";
                  
                  return (
                    <Card
                      key={booking.booking_reference}
                      variant="interactive"
                      className="flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-display font-extrabold text-[#F5F3EE] uppercase tracking-tight truncate">
                            {booking.title || `${booking.vertical?.toUpperCase()} BOOKING`}
                          </span>
                          <Badge variant={isUpcoming ? "upcoming" : isCancelled ? "cancelled" : "completed"}>
                            {booking.status}
                          </Badge>
                        </div>
                        
                        <div className="flex items-center gap-3 flex-wrap text-[10px] text-muted font-semibold">
                          <span className="font-data font-bold">#{booking.booking_reference}</span>
                          {booking.description && (
                            <>
                              <span>•</span>
                              <span className="truncate">{booking.description}</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-4 flex-shrink-0">
                        <span className="font-data font-bold text-sm text-[#F5F3EE]">
                          ₹{booking.total_amount?.toLocaleString() || "0"}
                        </span>
                        <a
                          href={`http://localhost:8000/api/v1/bookings/${booking.booking_reference}/pdf`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-1.5 rounded bg-[#111322] border border-slate-800 text-[10px] font-bold text-muted hover:text-white transition-colors"
                        >
                          E-Ticket
                        </a>
                      </div>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="py-12 border-2 border-dashed border-slate-850 rounded-lg text-center space-y-4">
                <p className="text-xs font-semibold text-muted">Abhi tak koi trip nahi</p>
                <Button
                  variant="secondary-teal"
                  onClick={() => router.push("/search")}
                >
                  Plan a trip now
                </Button>
              </div>
            )}
          </div>

          {/* Right Sidebar stats column */}
          <div className="space-y-6 text-left">
            {/* Wallet & Rewards summary Card */}
            <Card variant="default" className="space-y-4">
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <span className="text-[10px] font-display font-bold uppercase tracking-wider text-primary">
                  Traveler Wallet
                </span>
                <Badge variant="upcoming">SECURE TERMINAL</Badge>
              </div>
              <div className="space-y-1">
                <span className="font-data font-extrabold text-2xl text-primary block">
                  ₹{wallet_summary?.balance?.toLocaleString() || "0.00"}
                </span>
                <span className="text-[9px] text-muted font-semibold block">
                  Available refund & loyalty credits
                </span>
              </div>
              
              {/* Rewards Progress indicator */}
              <div className="border-t border-slate-800/80 pt-3 space-y-2">
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-muted font-bold">Reward Balance</span>
                  <span className="font-data font-bold text-marigold">{reward_points} pts</span>
                </div>
                <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-teal to-marigold"
                    style={{ width: `${Math.min((reward_points / 2000) * 100, 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-[8px] text-muted font-semibold">
                  <span>Silver tier</span>
                  <span>Goal: 2,000 pts</span>
                </div>
              </div>
            </Card>

            {/* Active alerts & price tracking */}
            <Card variant="default" className="space-y-4">
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <span className="text-[10px] font-display font-bold uppercase tracking-wider text-primary">
                  Telemetry Alerts
                </span>
                {notification_count > 0 && (
                  <span className="w-2 h-2 rounded-full bg-chili animate-pulse" />
                )}
              </div>
              <p className="text-[10px] text-muted font-semibold leading-relaxed">
                Smart agents are scanning wishlist fares. You have {notification_count} unread dispatch alerts pending in your inbox.
              </p>
              <div className="pt-2">
                <Button
                  variant="ghost"
                  onClick={() => router.push("/dashboard")}
                  className="w-full text-center border-slate-800 text-[10px] py-2"
                >
                  Open Alerts Channel
                </Button>
              </div>
            </Card>

            {/* Active Price alerts */}
            <Card variant="default" className="space-y-2">
              <div className="flex justify-between items-center border-b border-slate-800 pb-3 mb-2">
                <span className="text-[10px] font-display font-bold uppercase tracking-wider text-primary">
                  Active Price Feeds
                </span>
                <span className="font-data text-xs text-teal font-bold">{active_price_alerts}</span>
              </div>
              <p className="text-[10px] text-muted font-semibold leading-relaxed">
                Wishlist items are constantly monitored. We'll automatically ping your device on any tariff cuts.
              </p>
            </Card>
          </div>

        </div>

      </div>
      )}
    </div>
  );
}
