import React, { useState, useEffect, useRef } from 'react';
import { 
  Compass, MessageSquare, Wallet, ShieldAlert, Sparkles, Send, Mic, 
  MicOff, Search, Plane, Hotel, Calendar, Users, CheckCircle, RefreshCw,
  TrendingUp, AlertTriangle, ArrowRight, Plus, Check, CreditCard, Tag, Globe, User,
  Heart, ArrowUpDown, ShieldCheck, HelpCircle, MapPin, FileText, ChevronRight, Info,
  Bus, Ship, Coins, Activity, Anchor, Home, Gift, Briefcase, Clock, Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const API_URL = "http://localhost:8000/api/v1";

let globalTabLoadingListeners: ((loadingVerticals: Record<string, boolean>) => void)[] = [];
let globalLoadingVerticals: Record<string, boolean> = {};

function setTabLoading(verticalId: string, isLoading: boolean) {
  globalLoadingVerticals = { ...globalLoadingVerticals, [verticalId]: isLoading };
  globalTabLoadingListeners.forEach(listener => listener(globalLoadingVerticals));
}

function useTabLoading(verticalId: string, initialValue: boolean = false) {
  const [loading, _setLoading] = useState(initialValue);
  const startTimeRef = useRef<number | null>(null);

  const setLoading = (val: boolean) => {
    if (val) {
      _setLoading(true);
      setTabLoading(verticalId, true);
      startTimeRef.current = Date.now();
    } else {
      const elapsed = startTimeRef.current ? Date.now() - startTimeRef.current : 0;
      const minDuration = 1500; // 1.5s minimum loading duration
      if (elapsed < minDuration) {
        setTimeout(() => {
          _setLoading(false);
          setTabLoading(verticalId, false);
        }, minDuration - elapsed);
      } else {
        _setLoading(false);
        setTabLoading(verticalId, false);
      }
    }
  };
  return [loading, setLoading] as const;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'explore' | 'chat' | 'wallet' | 'trips'>('explore');
  const [loadingVerticals, setLoadingVerticals] = useState<Record<string, boolean>>({});
  
  useEffect(() => {
    const listener = (vals: Record<string, boolean>) => setLoadingVerticals(vals);
    globalTabLoadingListeners.push(listener);
    return () => {
      globalTabLoadingListeners = globalTabLoadingListeners.filter(l => l !== listener);
    };
  }, []);

  const [currency, setCurrency] = useState<'INR' | 'USD' | 'EUR'>('INR');
  const [locale, setLocale] = useState<'en' | 'es' | 'hi'>('en');
  const [userProfile, setUserProfile] = useState<any>({
    email: "traveler@travelos.com",
    tier: "Gold",
    points: 450,
    walletBalance: 24500.00
  });

  const [prefilledMessage, setPrefilledMessage] = useState("");
  const [checkoutData, setCheckoutData] = useState<any | null>(null);
  
  // Phase 10 State Routing variables
  const [selectedDetail, setSelectedDetail] = useState<any | null>(null);
  const [offerLanding, setOfferLanding] = useState<any | null>(null);
  const [partnerLanding, setPartnerLanding] = useState<any | null>(null);
  const [destinationLanding, setDestinationLanding] = useState<any | null>(null);
  const [flightTrackerStatus, setFlightTrackerStatus] = useState<string | null>(null);
  const [showWishlist, setShowWishlist] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showMyBizAdmin, setShowMyBizAdmin] = useState(false);
  const [wishlistItems, setWishlistItems] = useState<any[]>([
    { id: 1, vertical: "hotel", name: "Taj Luxury Hotels & Resorts", details: "Heritage Luxury Palace Stay in Delhi", price: 12500, rating: "4.9 ★" },
    { id: 2, vertical: "flight", name: "Vistara UK-811", details: "Delhi to Goa Direct Economy", price: 6200, rating: "4.8 ★" }
  ]);

  const handleConfirmBooking = (payMethod: string) => {
    if (!checkoutData) return;
    
    // Step 1: Create HOLD reservation
    fetch(`${API_URL}/bookings/hold`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vertical: checkoutData.vertical,
        amount: checkoutData.amount,
        user_id: 1,
        details: checkoutData.details
      })
    })
      .then(res => res.json())
      .then(holdRes => {
        if (!holdRes.booking_reference) {
          alert("Hold failed: " + (holdRes.detail || "Error holding inventory."));
          setCheckoutData(null);
          return;
        }

        // Step 2: Confirm & Pay
        fetch(`${API_URL}/bookings/confirm?booking_reference=${holdRes.booking_reference}&vertical=${checkoutData.vertical}&payment_method=${payMethod}`, {
          method: "POST"
        })
          .then(res => res.json())
          .then(confirmRes => {
            if (confirmRes.booking_reference) {
              alert(confirmRes.message || "Booking processed successfully!");
              
              if (payMethod === 'wallet') {
                setUserProfile((prev: any) => ({
                  ...prev,
                  walletBalance: Math.max(0, prev.walletBalance - checkoutData.amount)
                }));
              }
              setActiveTab('trips');
            } else {
              alert(confirmRes.detail || "Payment capture failed.");
            }
            setCheckoutData(null);
          })
          .catch(() => {
            alert("Confirm transaction error.");
            setCheckoutData(null);
          });
      })
      .catch(() => {
        alert("Hold request connection error.");
        setCheckoutData(null);
      });
  };

  return (
    <div className="flex h-screen bg-[#090d16] text-slate-100 overflow-hidden font-sans relative">
      {/* SIDEBAR NAVIGATION */}
      <aside className="w-64 bg-[#0d1527] border-r border-slate-800 flex flex-col justify-between p-4 z-20">
        <div>
          <div className="flex items-center gap-2 mb-8 px-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white shadow-lg shadow-blue-500/20">
              T
            </div>
            <div>
              <h1 className="font-bold text-lg leading-none">Travel OS</h1>
              <span className="text-xs text-slate-500 font-medium">AI Operating System</span>
            </div>
          </div>

          <nav className="space-y-1">
            <SidebarBtn 
              active={activeTab === 'explore'} 
              icon={<Compass size={20} />} 
              label="Explore & Book" 
              onClick={() => setActiveTab('explore')} 
            />
            <SidebarBtn 
              active={activeTab === 'chat'} 
              icon={<MessageSquare size={20} />} 
              label="AI Travel Assistant" 
              onClick={() => setActiveTab('chat')} 
            />
            <SidebarBtn 
              active={activeTab === 'trips'} 
              icon={<FileText size={20} />} 
              label="My Trips" 
              onClick={() => setActiveTab('trips')} 
            />
            <SidebarBtn 
              active={activeTab === 'wallet'} 
              icon={<Wallet size={20} />} 
              label="Wallet & Loyalty" 
              onClick={() => setActiveTab('wallet')} 
            />
          </nav>
        </div>

        {/* Global Settings */}
        <div className="space-y-4 border-t border-slate-800 pt-4 px-2 text-xs">
          <div className="flex justify-between items-center text-slate-400">
            <span className="flex items-center gap-1"><Globe size={14} /> Currency</span>
            <select 
              value={currency} 
              onChange={(e) => setCurrency(e.target.value as any)}
              className="bg-[#121c33] border border-slate-800 rounded px-1.5 py-0.5 text-white outline-none"
            >
              <option value="INR">₹ INR</option>
              <option value="USD">$ USD</option>
              <option value="EUR">€ EUR</option>
            </select>
          </div>
          <div className="flex justify-between items-center text-slate-400">
            <span className="flex items-center gap-1"><User size={14} /> Account</span>
            <span className="font-semibold text-blue-400">{userProfile.tier} Member</span>
          </div>
        </div>
      </aside>

      {/* MAIN VIEW AREA */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-[#0a0f1d]">
        <header className="h-16 border-b border-slate-900 flex items-center justify-between px-8 bg-[#090d16]/50 backdrop-blur-md z-10">
          <h2 className="text-xl font-bold capitalize flex items-center gap-2">
            {activeTab === 'explore' && <><Compass className="text-blue-500" /> Discover Destinations</>}
            {activeTab === 'chat' && <><MessageSquare className="text-blue-500" /> Travel OS Assistant</>}
            {activeTab === 'trips' && <><FileText className="text-blue-500" /> Bookings & Trip History</>}
            {activeTab === 'wallet' && <><Wallet className="text-blue-500" /> Personal Account Balance</>}
            
          </h2>
          <div className="flex items-center gap-4">
            <div className="text-right text-xs">
              <div className="text-slate-400">Wallet balance</div>
              <div className="font-bold text-emerald-400 text-sm">
                {currency === 'INR' ? '₹' : currency === 'USD' ? '$' : '€'}
                {currency === 'INR' ? userProfile.walletBalance.toLocaleString() : (userProfile.walletBalance * 0.012).toFixed(2)}
              </div>
            </div>
            <button 
              onClick={() => setShowProfile(true)}
              className="h-8 w-8 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center font-bold text-sm text-white hover:scale-105 hover:shadow-lg hover:shadow-blue-500/30 transition-all cursor-pointer border border-blue-400/20"
              title="View User Profile"
            >
              TR
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-hidden relative">
          <AnimatePresence mode="wait">
            {activeTab === 'explore' && (
              <ExploreView 
                key="explore" 
                currency={currency} 
                onBook={setCheckoutData} 
                setActiveTab={setActiveTab}
                onDetailClick={(vert, item) => setSelectedDetail({ vertical: vert, item })}
                onOfferClick={(off) => setOfferLanding(off)}
                onPartnerClick={(type, name) => setPartnerLanding({ type, name })}
                onDestinationClick={(slug, title, img) => setDestinationLanding({ slug, title, img })}
                onTrackFlight={(fnum) => setFlightTrackerStatus(fnum)}
                onShowMyBiz={() => setShowMyBizAdmin(true)}
                onShowWishlist={() => setShowWishlist(true)}
                onShowProfile={() => setShowProfile(true)}
              />
            )}
            {activeTab === 'chat' && (
              <ChatView 
                key="chat" 
                userProfile={userProfile} 
                setUserProfile={setUserProfile} 
                prefilledMessage={prefilledMessage} 
                setPrefilledMessage={setPrefilledMessage} 
              />
            )}
            {activeTab === 'trips' && <MyTripsView key="trips" userProfile={userProfile} setActiveTab={setActiveTab} />}
            {activeTab === 'wallet' && <WalletView key="wallet" userProfile={userProfile} setUserProfile={setUserProfile} />}
            
          </AnimatePresence>
        </div>
      </main>

      {/* Persistent Floating AI Assistant */}
      {activeTab !== 'chat' && (
        <FloatingAssistant 
          onTrigger={(msg) => {
            setPrefilledMessage(msg);
            setActiveTab('chat');
          }} 
        />
      )}

      {/* Unified Checkout Modal */}
      {checkoutData && (
        <CheckoutModal 
          data={checkoutData} 
          userProfile={userProfile} 
          onConfirm={handleConfirmBooking} 
          onClose={() => setCheckoutData(null)} 
        />
      )}

      {/* Product Detail Modal */}
      {selectedDetail && (
        <ProductDetailModal
          vertical={selectedDetail.vertical}
          item={selectedDetail.item}
          currency={currency}
          onBook={(bookData) => {
            setCheckoutData(bookData);
            setSelectedDetail(null);
          }}
          onClose={() => setSelectedDetail(null)}
          wishlistItems={wishlistItems}
          setWishlistItems={setWishlistItems}
        />
      )}

      {/* Offer Landing Modal */}
      {offerLanding && (
        <OfferLandingModal
          offer={offerLanding}
          onClose={() => setOfferLanding(null)}
        />
      )}

      {/* Partner Landing Modal */}
      {partnerLanding && (
        <PartnerLandingModal
          partner={partnerLanding}
          onClose={() => setPartnerLanding(null)}
        />
      )}

      {/* Destination Landing Modal */}
      {destinationLanding && (
        <DestinationLandingModal
          destination={destinationLanding}
          onClose={() => setDestinationLanding(null)}
          onPlanTrigger={(destName) => {
            setPrefilledMessage(`Plan a trip here: ${destName}`);
            setActiveTab('chat');
            setDestinationLanding(null);
          }}
        />
      )}

      {/* Flight Tracker Modal */}
      {flightTrackerStatus && (
        <FlightTrackerModal
          flightNum={flightTrackerStatus}
          onClose={() => setFlightTrackerStatus(null)}
        />
      )}

      {/* Wishlist Modal */}
      {showWishlist && (
        <WishlistModal
          items={wishlistItems}
          setItems={setWishlistItems}
          onBook={(item) => {
            setCheckoutData({
              vertical: item.vertical,
              title: item.name,
              subtitle: item.details,
              amount: item.price,
              details: item
            });
            setShowWishlist(false);
          }}
          onClose={() => setShowWishlist(false)}
        />
      )}

      {/* Account Profile Modal */}
      {showProfile && (
        <AccountProfileModal
          userProfile={userProfile}
          setUserProfile={setUserProfile}
          onClose={() => setShowProfile(false)}
        />
      )}

      {/* myBiz Dashboard Modal */}
      {showMyBizAdmin && (
        <MyBizDashboardModal
          onClose={() => setShowMyBizAdmin(false)}
        />
      )}
    </div>
  );
}

function SidebarBtn({ active, icon, label, onClick }: { active: boolean, icon: any, label: string, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
        active 
          ? 'bg-blue-600/10 text-blue-400 border-l-2 border-blue-500 pl-2.5' 
          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

/* ---------------------------------------------------- */
/* 1 & 2. UTILITY HEADER & HERO HOMEPAGE VIEW ASSEMBLY  */
/* ---------------------------------------------------- */
function ExploreView({ 
  currency, onBook, setActiveTab, 
  onDetailClick, onOfferClick, onPartnerClick, 
  onDestinationClick, onTrackFlight, onShowMyBiz,
  onShowWishlist, onShowProfile
}: { 
  currency: string, onBook: (data: any) => void, setActiveTab: any,
  onDetailClick: (vert: string, item: any) => void,
  onOfferClick: (off: any) => void,
  onPartnerClick: (type: 'airline' | 'hotel', name: string) => void,
  onDestinationClick: (slug: string, title: string, img: string) => void,
  onTrackFlight: (fnum: string) => void,
  onShowMyBiz: () => void,
  onShowWishlist: () => void,
  onShowProfile: () => void
}) {
  const [activeVertical, setActiveVertical] = useState<string>('flights');
  const [loadingVerticals, setLoadingVerticals] = useState<Record<string, boolean>>({});
  
  useEffect(() => {
    const listener = (vals: Record<string, boolean>) => setLoadingVerticals(vals);
    globalTabLoadingListeners.push(listener);
    return () => {
      globalTabLoadingListeners = globalTabLoadingListeners.filter(l => l !== listener);
    };
  }, []);
  
  return (
    <div className="h-full overflow-y-auto bg-[#0a0f1d] pb-16 scroll-smooth">
      {/* 1. TOP UTILITY HEADER */}
      <div className="w-full bg-[#0b1021]/80 backdrop-blur-md border-b border-slate-900/60 py-3 px-8 flex justify-between items-center text-xs text-slate-300">
        <div className="flex items-center gap-4">
          <span className="font-extrabold text-blue-400 tracking-wider">TRAVEL OS PREMIUM</span>
          <span className="text-slate-500">|</span>
          <button className="hover:text-white transition-all cursor-pointer">List Your Property</button>
          <button onClick={onShowMyBiz} className="hover:text-white transition-all bg-blue-900/20 text-blue-400 px-2 py-0.5 rounded font-black border border-blue-500/10 cursor-pointer font-bold">myBiz — Business portals</button>
        </div>
        <div className="flex items-center gap-6">
          <button onClick={() => setActiveTab('trips')} className="hover:text-white transition-all flex items-center gap-1 font-bold cursor-pointer"><FileText size={13} /> My Trips</button>
          <button onClick={onShowWishlist} className="hover:text-white transition-all flex items-center gap-1 font-bold cursor-pointer"><Heart size={13} className="text-red-500" /> Wishlist</button>
          <div onClick={onShowProfile} className="hover:text-white transition-all flex items-center gap-1 cursor-pointer font-bold"><User size={13} /> Hi, Guest Traveler</div>
        </div>
      </div>

      {/* 2. HERO SHELL */}
      <div className="hero-shell relative bg-gradient-to-b from-[#111c35] to-[#0a0f1d] py-4 px-8 border-b border-slate-900">
        <div className="max-w-6xl mx-auto text-center mb-3">
          <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight">Where would you like to travel?</h2>
          <p className="text-sm text-slate-400 mt-2">Discover curated itineraries, premium flight search, and instant wallet bookings.</p>
        </div>

        {/* Floating Translucent Search Card */}
        <div className="max-w-6xl mx-auto bg-slate-950/70 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-6 shadow-2xl relative z-10">
          
          {/* Animated Tab Selector */}
          <div className="flex flex-wrap gap-2 border-b border-slate-800/80 pb-4 mb-6 justify-center">
            <VerticalTab id="flights" label="Flights" icon={<Plane size={16} />} active={activeVertical} onClick={setActiveVertical} isLoading={loadingVerticals['flights']} />
            <VerticalTab id="hotels" label="Hotels" icon={<Hotel size={16} />} active={activeVertical} onClick={setActiveVertical} isLoading={loadingVerticals['hotels']} />
            <VerticalTab id="villas" label="Villas" icon={<Home size={16} />} active={activeVertical} onClick={setActiveVertical} isLoading={loadingVerticals['villas']} />
            <VerticalTab id="holidays" label="Holidays" icon={<Gift size={16} />} active={activeVertical} onClick={setActiveVertical} isLoading={loadingVerticals['holidays']} />
            <VerticalTab id="trains" label="Trains" icon={<TrendingUp size={16} />} active={activeVertical} onClick={setActiveVertical} isLoading={loadingVerticals['trains']} />
            <VerticalTab id="buses" label="Buses" icon={<Bus size={16} />} active={activeVertical} onClick={setActiveVertical} isLoading={loadingVerticals['buses']} />
            <VerticalTab id="cabs" label="Cabs" icon={<Users size={16} />} active={activeVertical} onClick={setActiveVertical} isLoading={loadingVerticals['cabs']} />
            <VerticalTab id="tours" label="Tours" icon={<Activity size={16} />} active={activeVertical} onClick={setActiveVertical} isLoading={loadingVerticals['tours']} />
            <VerticalTab id="visa" label="Visa" icon={<FileText size={16} />} active={activeVertical} onClick={setActiveVertical} isLoading={loadingVerticals['visa']} />
            <VerticalTab id="cruises" label="Cruises" icon={<Ship size={16} />} active={activeVertical} onClick={setActiveVertical} isLoading={loadingVerticals['cruises']} />
            <VerticalTab id="forex" label="Forex" icon={<Coins size={16} />} active={activeVertical} onClick={setActiveVertical} isLoading={loadingVerticals['forex']} />
            <VerticalTab id="insurance" label="Insurance" icon={<ShieldCheck size={16} />} active={activeVertical} onClick={setActiveVertical} isLoading={loadingVerticals['insurance']} />
          </div>

          {/* Form Registry Swap */}
          <div className="pt-2">
            {activeVertical === 'flights' && <FlightsSearchForm currency={currency} onBook={onBook} onDetailClick={onDetailClick} onTrackFlight={onTrackFlight} />}
            {activeVertical === 'hotels' && <HotelsSearchForm onBook={onBook} onDetailClick={onDetailClick} />}
            {activeVertical === 'villas' && <VillasSearchForm onBook={onBook} onDetailClick={onDetailClick} />}
            {activeVertical === 'holidays' && <HolidayPackagesSearchForm onBook={onBook} onDetailClick={onDetailClick} />}
            {activeVertical === 'trains' && <TrainsSearchForm onBook={onBook} onDetailClick={onDetailClick} />}
            {activeVertical === 'buses' && <BusesSearchForm onBook={onBook} onDetailClick={onDetailClick} />}
            {activeVertical === 'cabs' && <CabsSearchForm onBook={onBook} onDetailClick={onDetailClick} />}
            {activeVertical === 'tours' && <ToursSearchForm onBook={onBook} onDetailClick={onDetailClick} />}
            {activeVertical === 'visa' && <VisaSearchForm onBook={onBook} onDetailClick={onDetailClick} />}
            {activeVertical === 'cruises' && <CruisesSearchForm onBook={onBook} onDetailClick={onDetailClick} />}
            {activeVertical === 'forex' && <ForexSearchForm onBook={onBook} onDetailClick={onDetailClick} />}
            {activeVertical === 'insurance' && <InsuranceSearchForm onBook={onBook} onDetailClick={onDetailClick} />}
          </div>
        </div>
      </div>

      {/* 3. EXPLORE MORE PILLS ROW */}
      <div className="max-w-6xl mx-auto px-8 py-10">
        <ExploreMoreRow onSelectPill={(title) => {
          if (title === "Visa Guide") {
            setActiveVertical("visa");
          } else if (title === "Where2Go") {
            onDestinationClick("goa-beach", "Goa Beaches", "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800");
          } else if (title === "How2Go") {
            onPartnerClick("airline", "IndiGo");
          } else if (title === "MICE Events") {
            onShowMyBiz();
          } else if (title === "Gift Cards") {
            onShowProfile();
          }
        }} />
      </div>

      {/* 4. OFFERS CAROUSEL */}
      <div className="max-w-6xl mx-auto px-8 py-6">
        <h3 className="text-xl font-extrabold text-slate-200 mb-6 flex items-center gap-2"><Tag size={20} className="text-blue-500" /> Exclusive Offers For You</h3>
        <OffersCarousel onOfferClick={onOfferClick} />
      </div>

      {/* CURATED COLLECTIONS */}
      <div className="max-w-6xl mx-auto px-8 py-6 space-y-12">
        <CollectionCarousel slug="handpicked-collections" onDestinationClick={onDestinationClick} />
        <CollectionCarousel slug="lesser-known-wonders" onDestinationClick={onDestinationClick} />
      </div>

      {/* 5. PARTNER SHOWCASE SHOWS */}
      <div className="max-w-6xl mx-auto px-8 py-10 grid grid-cols-1 md:grid-cols-2 gap-8 border-t border-slate-900/60 mt-8 pt-10">
        <AirlinePartnersShowcase onPartnerClick={(name) => onPartnerClick('airline', name)} />
        <HotelBrandsShowcase onPartnerClick={(name) => onPartnerClick('hotel', name)} />
      </div>

      {/* HIGHLIGHTS & BANNER */}
      <div className="max-w-6xl mx-auto px-8">
        <InfoHighlightRow onNavigate={(path) => {
          if (path === '/wallet') {
            onShowProfile();
          } else {
            // Select related vertical
            if (path.includes('explore')) {
              setActiveVertical('tours');
            }
          }
        }} />
        <PromoBannerStrip />
      </div>

      {/* SEO MEGA FOOTER */}
      <SEOMegaFooter onNavigate={(path) => {
        if (path === '/mybiz') {
          onShowMyBiz();
        } else if (path === '/admin') {
          window.open("http://localhost:5174", "_blank");
        } else {
          const vert = path.replace('/', '');
          const validVerticals = ['flights', 'hotels', 'trains', 'cabs', 'visa', 'forex', 'insurance', 'tours', 'cruises', 'villas', 'holidays'];
          if (validVerticals.includes(vert)) {
            let mapped = vert;
            if (mapped === 'holidays') mapped = 'holiday-packages';
            setActiveVertical(mapped);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
        }
      }} />
    </div>
  );
}

function StickerButton({ 
  children, 
  onClick, 
  className = "", 
  type = "button" 
}: { 
  children: React.ReactNode, 
  onClick?: () => void, 
  className?: string, 
  type?: "button" | "submit" 
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      className={`px-8 py-3 bg-yellow-400 hover:bg-yellow-300 text-black font-extrabold text-sm border-3 border-black shadow-[4px_4px_0px_0px_#000000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0px_0px_#000000] transition-all cursor-pointer uppercase ${className}`}
    >
      {children}
    </button>
  );
}

function OutlinedInput({ 
  label, 
  type = "text", 
  value, 
  onChange, 
  placeholder, 
  disabled = false, 
  className = "",
  onFocus,
  onBlur
}: { 
  label: string, 
  type?: string, 
  value?: string, 
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void, 
  placeholder?: string, 
  disabled?: boolean, 
  className?: string,
  onFocus?: () => void,
  onBlur?: () => void
}) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">{label}</span>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        onFocus={onFocus}
        onBlur={onBlur}
        className="w-full bg-white border-3 border-black text-slate-900 font-black text-sm px-3 py-2.5 outline-none focus:bg-yellow-50/50 disabled:bg-slate-100 disabled:opacity-50 transition-colors"
      />
    </div>
  );
}

function CounterStepper({ 
  label, 
  value, 
  onChange, 
  min = 1 
}: { 
  label: string, 
  value: number, 
  onChange: (val: number) => void, 
  min?: number 
}) {
  return (
    <div className="space-y-1.5">
      <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">{label}</span>
      <div className="flex bg-white border-3 border-black px-3 py-2 justify-between items-center h-[46px]">
        <span className="font-black text-xs text-slate-900">{value} Pax</span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onChange(Math.max(min, value - 1))}
            className="w-6 h-6 rounded-full bg-yellow-400 hover:bg-yellow-300 text-black border-2 border-black flex items-center justify-center font-black text-sm cursor-pointer active:translate-y-px"
          >
            -
          </button>
          <button
            type="button"
            onClick={() => onChange(value + 1)}
            className="w-6 h-6 rounded-full bg-yellow-400 hover:bg-yellow-300 text-black border-2 border-black flex items-center justify-center font-black text-sm cursor-pointer active:translate-y-px"
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}

function LocationSwapField({
  fromLabel,
  toLabel,
  fromValue,
  toValue,
  onFromChange,
  onToChange,
  onSwap,
  fromSuggestions = [],
  toSuggestions = [],
  onSelectFromSuggestion,
  onSelectToSuggestion,
  showFromSuggestions = false,
  showToSuggestions = false,
  setShowFromSuggestions,
  setShowToSuggestions,
  placeholderFrom = "Enter city",
  placeholderTo = "Enter city"
}: {
  fromLabel: string;
  toLabel: string;
  fromValue: string;
  toValue: string;
  onSwap: () => void;
  onFromChange?: (val: string) => void;
  onToChange?: (val: string) => void;
  fromSuggestions?: string[];
  toSuggestions?: string[];
  onSelectFromSuggestion?: (val: string) => void;
  onSelectToSuggestion?: (val: string) => void;
  showFromSuggestions?: boolean;
  showToSuggestions?: boolean;
  setShowFromSuggestions?: (val: boolean) => void;
  setShowToSuggestions?: (val: boolean) => void;
  placeholderFrom?: string;
  placeholderTo?: string;
}) {
  return (
    <div className="relative grid grid-cols-2 gap-2">
      <div className="space-y-1.5 relative">
        <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">{fromLabel}</span>
        <input 
          type="text" 
          value={fromValue} 
          placeholder={placeholderFrom}
          onChange={(e) => onFromChange?.(e.target.value)}
          onFocus={() => setShowFromSuggestions?.(true)}
          onBlur={() => setTimeout(() => setShowFromSuggestions?.(false), 200)}
          className="w-full bg-white border-3 border-black text-slate-900 font-black text-sm px-3 py-2.5 outline-none focus:bg-yellow-50/50"
        />
        {showFromSuggestions && fromSuggestions.length > 0 && (
          <div className="absolute left-0 right-0 top-[68px] bg-white border-3 border-black shadow-[4px_4px_0px_0px_#000000] z-50 overflow-y-auto max-h-48 text-black font-sans">
            {fromSuggestions.map((item, idx) => (
              <button
                key={idx}
                type="button"
                onMouseDown={() => onSelectFromSuggestion?.(item)}
                className="w-full text-left px-3 py-2 hover:bg-yellow-300 transition-colors font-bold text-xs border-b-2 border-black last:border-0 cursor-pointer"
              >
                {item}
              </button>
            ))}
          </div>
        )}
      </div>
      
      <button 
        type="button"
        onClick={onSwap}
        className="absolute left-1/2 top-[34px] -translate-x-1/2 p-1.5 bg-yellow-400 hover:bg-yellow-300 text-black border-2 border-black rounded-full z-10 shadow active:translate-y-px cursor-pointer"
        title="Swap locations"
      >
        <ArrowUpDown size={14} />
      </button>

      <div className="space-y-1.5 relative">
        <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">{toLabel}</span>
        <input 
          type="text" 
          value={toValue} 
          placeholder={placeholderTo}
          onChange={(e) => onToChange?.(e.target.value)}
          onFocus={() => setShowToSuggestions?.(true)}
          onBlur={() => setTimeout(() => setShowToSuggestions?.(false), 200)}
          className="w-full bg-white border-3 border-black text-slate-900 font-black text-sm px-3 py-2.5 outline-none focus:bg-yellow-50/50"
        />
        {showToSuggestions && toSuggestions.length > 0 && (
          <div className="absolute left-0 right-0 top-[68px] bg-white border-3 border-black shadow-[4px_4px_0px_0px_#000000] z-50 overflow-y-auto max-h-48 text-black font-sans">
            {toSuggestions.map((item, idx) => (
              <button
                key={idx}
                type="button"
                onMouseDown={() => onSelectToSuggestion?.(item)}
                className="w-full text-left px-3 py-2 hover:bg-yellow-300 transition-colors font-bold text-xs border-b-2 border-black last:border-0 cursor-pointer"
              >
                {item}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DateRangeField({
  startLabel,
  endLabel,
  startDate,
  endDate,
  onStartChange,
  onEndChange,
  disabledEnd = false,
  placeholderEnd = "Tap to add date"
}: {
  startLabel: string;
  endLabel: string;
  startDate: string;
  endDate: string;
  onStartChange: (val: string) => void;
  onEndChange: (val: string) => void;
  disabledEnd?: boolean;
  placeholderEnd?: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="space-y-1.5">
        <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">{startLabel}</span>
        <input 
          type="date" 
          value={startDate} 
          onChange={(e) => onStartChange(e.target.value)}
          className="w-full bg-white border-3 border-black text-slate-900 font-black text-xs px-2 py-2.5 outline-none focus:bg-yellow-50/50"
        />
      </div>
      <div className="space-y-1.5">
        <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">{endLabel}</span>
        <input 
          type="date" 
          value={endDate} 
          disabled={disabledEnd}
          placeholder={placeholderEnd}
          onChange={(e) => onEndChange(e.target.value)}
          className="w-full bg-white disabled:bg-slate-100 disabled:opacity-40 border-3 border-black text-slate-900 font-black text-xs px-2 py-2.5 outline-none focus:bg-yellow-50/50"
        />
      </div>
    </div>
  );
}

function PillOptionRow({
  label,
  options,
  selectedId,
  onChange
}: {
  label: string;
  options: { id: string; title: string; subtext?: string }[];
  selectedId: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="space-y-2">
      <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">{label}</span>
      <div className="flex flex-wrap gap-2 items-stretch">
        {options.map((opt) => {
          const isActive = opt.id === selectedId;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onChange(opt.id)}
              className={`px-4 py-2 border-2 border-black flex flex-col justify-center items-start text-left cursor-pointer transition-all active:translate-y-px ${
                isActive 
                  ? 'bg-yellow-400 text-black shadow-[2px_2px_0px_0px_#000000]' 
                  : 'bg-white text-slate-800 hover:bg-slate-50'
              }`}
            >
              <span className="font-extrabold text-xs uppercase tracking-tight">{opt.title}</span>
              {opt.subtext && <span className="text-[8px] opacity-70 font-semibold mt-0.5">{opt.subtext}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function VerticalTab({ id, label, icon, active, onClick, isLoading }: { id: string, label: string, icon: any, active: string, onClick: (id: string) => void, isLoading?: boolean }) {
  const isActive = active === id;
  return (
    <button
      onClick={() => onClick(id)}
      className={`px-4 py-2.5 rounded-full font-black text-xs border-2 border-black flex items-center gap-2 transition-all cursor-pointer ${
        isLoading
          ? 'loading-tab'
          : isActive 
            ? 'bg-yellow-400 text-black shadow-[2px_2px_0px_0px_#000000]' 
            : 'bg-white text-slate-800 hover:bg-slate-50'
      }`}
    >
      {icon}
      <span className="uppercase tracking-wider font-extrabold">{label}</span>
    </button>
  );
}

/* ---------------------------------------------------- */
/* 3. FLIGHTS SEARCH FORM                               */
/* ---------------------------------------------------- */
const POPULAR_AIRPORTS = [
  "Delhi (DEL) - National Capital",
  "Mumbai (BOM) - Maharashtra",
  "Bangalore (BLR) - Karnataka",
  "Goa (GOI) - Goa",
  "Chennai (MAA) - Tamil Nadu",
  "Kolkata (CCU) - West Bengal",
  "Hyderabad (HYD) - Telangana",
  "Pune (PNQ) - Maharashtra",
  "Kochi (COK) - Kerala",
  "Jaipur (JAI) - Rajasthan",
  "Ahmedabad (AMD) - Gujarat",
  "Guwahati (GAU) - Assam",
  "Lucknow (LKO) - Uttar Pradesh",
  "Patna (PAT) - Bihar",
  "Bhubaneswar (BBI) - Odisha",
  "Ranchi (IXR) - Jharkhand",
  "Raipur (RPR) - Chhattisgarh",
  "Srinagar (SXR) - Jammu & Kashmir",
  "Leh (IXL) - Ladakh",
  "Dehradun (DED) - Uttarakhand",
  "Amritsar (ATQ) - Punjab",
  "Chandigarh (IXC) - Chandigarh",
  "Port Blair (IXZ) - Andaman & Nicobar",
  "Bhopal (BHO) - Madhya Pradesh",
  "Itanagar (HGI) - Arunachal Pradesh",
  "Shillong (SHL) - Meghalaya",
  "Aizawl (AJL) - Mizoram",
  "Kohima (KHM) - Nagaland",
  "Imphal (IMF) - Manipur",
  "Agartala (IXA) - Tripura",
  "Gangtok (IXG) - Sikkim"
];

function FlightsSearchForm({ currency, onBook, onDetailClick, onTrackFlight }: { currency: string, onBook: (data: any) => void, onDetailClick: (vert: string, item: any) => void, onTrackFlight: (fnum: string) => void }) {
  const [tripType, setTripType] = useState<'one' | 'round'>('one');
  const [fromCity, setFromCity] = useState("Delhi (DEL)");
  const [toCity, setToCity] = useState("");
  const [showFromSuggestions, setShowFromSuggestions] = useState(false);
  const [showToSuggestions, setShowToSuggestions] = useState(false);
  const [depDate, setDepDate] = useState("2026-12-15");
  const [retDate, setRetDate] = useState("");
  const [passengers, setPassengers] = useState(1);
  const [cabin, setCabin] = useState("Economy");
  
  const [specialFare, setSpecialFare] = useState("Regular");
  const [gstInvoice, setGstInvoice] = useState(false);
  const [priceProtection, setPriceProtection] = useState(false);
  
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useTabLoading('flights');
  const [showPayoutModal, setShowPayoutModal] = useState(false);

  const swapCities = () => {
    const temp = fromCity;
    setFromCity(toCity);
    setToCity(temp);
  };

  const handleSearch = () => {
    if (!fromCity.trim()) {
      alert("Please enter a origin city (From).");
      return;
    }
    if (!toCity.trim()) {
      alert("Please enter a destination city (To).");
      return;
    }
    if (!depDate) {
      alert("Please select a departure date.");
      return;
    }
    if (tripType === 'round' && !retDate) {
      alert("Please select a return date for your round trip.");
      return;
    }
    if (fromCity.trim().toLowerCase() === toCity.trim().toLowerCase()) {
      alert("Source and Destination airports cannot be identical.");
      return;
    }
    setLoading(true);
    setResults([]);
    
    // Simulate flight search execution
    setTimeout(() => {
      setLoading(false);
      setResults([
        { flight_ref: "6E-502", airline: "IndiGo", dep: "08:15 AM", arr: "10:45 AM", duration: "2h 30m", price: 4800 },
        { flight_ref: "UK-811", airline: "Vistara", dep: "11:30 AM", arr: "02:05 PM", duration: "2h 35m", price: 6200 },
        { flight_ref: "AI-312", airline: "Air India", dep: "04:45 PM", arr: "07:25 PM", duration: "2h 40m", price: 5400 }
      ]);
    }, 1500);
  };

  return (
    <div className="space-y-6">
      {/* Trip type selector */}
      <div className="flex gap-4 items-center">
        <label className="flex items-center gap-1.5 text-xs text-slate-900 font-extrabold cursor-pointer bg-white px-3 py-1.5 border-2 border-black shadow-[2px_2px_0px_0px_#000000] active:translate-y-px">
          <input type="radio" checked={tripType === 'one'} onChange={() => { setTripType('one'); setRetDate(""); }} className="accent-yellow-400" />
          ONE WAY
        </label>
        <label className="flex items-center gap-1.5 text-xs text-slate-900 font-extrabold cursor-pointer bg-white px-3 py-1.5 border-2 border-black shadow-[2px_2px_0px_0px_#000000] active:translate-y-px">
          <input type="radio" checked={tripType === 'round'} onChange={() => { setTripType('round'); setRetDate("2026-12-22"); }} className="accent-yellow-400" />
          ROUND TRIP
        </label>
      </div>

      {/* Input Core Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-950/20 p-6 border-3 border-black shadow-[6px_6px_0px_0px_#000000]">
        
        {/* From-To Swap Block */}
        <div className="md:col-span-2">
          <LocationSwapField 
            fromLabel="From"
            toLabel="To"
            fromValue={fromCity}
            toValue={toCity}
            onFromChange={(val) => { setFromCity(val); setShowFromSuggestions(true); }}
            onToChange={(val) => { setToCity(val); setShowToSuggestions(true); }}
            onSwap={swapCities}
            fromSuggestions={POPULAR_AIRPORTS.filter(airport => airport.toLowerCase().includes(fromCity.toLowerCase()))}
            toSuggestions={POPULAR_AIRPORTS.filter(airport => airport.toLowerCase().includes(toCity.toLowerCase()))}
            onSelectFromSuggestion={(val) => { setFromCity(val); setShowFromSuggestions(false); }}
            onSelectToSuggestion={(val) => { setToCity(val); setShowToSuggestions(false); }}
            showFromSuggestions={showFromSuggestions}
            showToSuggestions={showToSuggestions}
            setShowFromSuggestions={setShowFromSuggestions}
            setShowToSuggestions={setShowToSuggestions}
          />
        </div>

        {/* Date Pickers */}
        <DateRangeField 
          startLabel="Depart"
          endLabel="Return"
          startDate={depDate}
          endDate={retDate}
          onStartChange={setDepDate}
          onEndChange={setRetDate}
          disabledEnd={tripType === 'one'}
        />

        {/* Travellers and Cabin class */}
        <div className="space-y-1.5">
          <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">Travellers & Cabin</span>
          <div className="flex gap-2 bg-white border-3 border-black px-3 py-2 justify-between items-center h-[46px]">
            <span className="font-black text-xs text-slate-900">{passengers} Pax, {cabin}</span>
            <div className="flex gap-1.5 items-center">
              <button 
                type="button"
                onClick={() => setPassengers(Math.max(1, passengers - 1))} 
                className="w-5 h-5 rounded bg-yellow-400 hover:bg-yellow-300 text-black border-2 border-black flex items-center justify-center font-bold text-xs cursor-pointer"
              >
                -
              </button>
              <button 
                type="button"
                onClick={() => setPassengers(passengers + 1)} 
                className="w-5 h-5 rounded bg-yellow-400 hover:bg-yellow-300 text-black border-2 border-black flex items-center justify-center font-bold text-xs cursor-pointer"
              >
                +
              </button>
              <select 
                value={cabin} 
                onChange={(e) => setCabin(e.target.value)} 
                className="ml-2 bg-white border border-black text-[10px] font-bold p-0.5 outline-none rounded"
              >
                <option value="Economy">Economy</option>
                <option value="Premium Economy">Premium</option>
                <option value="Business">Business</option>
                <option value="First Class">First</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Special Fare Chips */}
      <div className="flex flex-wrap gap-2 items-center pt-2">
        <span className="text-[10px] text-slate-400 font-bold uppercase mr-2">Select Special Fare:</span>
        <FareChip name="Regular" active={specialFare} onClick={setSpecialFare} subtext="Standard rates" />
        <FareChip name="Student" active={specialFare} onClick={setSpecialFare} subtext="Extra baggage allowance" />
        <FareChip name="Senior Citizen" active={specialFare} onClick={setSpecialFare} subtext="Flat discount" />
        <FareChip name="Armed Forces" active={specialFare} onClick={setSpecialFare} subtext="Govt sponsored" />
      </div>

      {/* Additional Options Checkboxes */}
      <div className="flex flex-wrap justify-between items-center gap-4 pt-2 border-t border-slate-800/80">
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-xs text-slate-300 font-bold cursor-pointer hover:text-white bg-slate-900/40 p-2 border border-slate-800 rounded-lg">
            <input 
              type="checkbox" 
              checked={gstInvoice} 
              onChange={() => setGstInvoice(!gstInvoice)} 
              className="rounded border-black bg-white accent-yellow-400"
            />
            Add GST Invoice Details <span className="bg-yellow-400 text-black text-[8px] px-1 rounded font-black border border-black font-bold">NEW</span>
          </label>

          <label className="flex items-center gap-2 text-xs text-slate-300 font-bold cursor-pointer hover:text-white bg-slate-900/40 p-2 border border-slate-800 rounded-lg">
            <input 
              type="checkbox" 
              checked={priceProtection} 
              onChange={() => setPriceProtection(!priceProtection)} 
              className="rounded border-black bg-white accent-yellow-400"
            />
            Lock Price Protection
            <button onClick={(e) => { e.preventDefault(); setShowPayoutModal(true); }} className="text-yellow-400 hover:text-yellow-300 underline ml-1 font-bold">View Details</button>
          </label>
        </div>

        <StickerButton onClick={handleSearch} className="bg-yellow-400 text-black font-black">
          Search Flights
        </StickerButton>
      </div>

      <div className="flex justify-between items-center text-xs px-2 border-t border-slate-900 pt-3">
        <span className="text-slate-500">Need real-time status?</span>
        <button 
          type="button" 
          onClick={() => {
            const fnum = prompt("Enter Flight Reference (e.g., AI-312, 6E-502):", "6E-502");
            if (fnum) onTrackFlight(fnum);
          }} 
          className="bg-yellow-400 hover:bg-yellow-300 text-black border-2 border-black font-bold px-3 py-1 rounded-full shadow-[2px_2px_0px_0px_#000000] cursor-pointer flex items-center gap-1 active:translate-y-px"
        >
          ✈ Launch Live Flight Tracker
        </button>
      </div>

      {/* Flight Search Results Rendering */}
      <div className="mt-8 space-y-4">
        {loading && (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="glass-card p-5 rounded-2xl animate-pulse flex justify-between items-center border border-slate-800">
                <div className="space-y-2 w-2/3">
                  <div className="h-4 bg-slate-800 rounded w-1/3"></div>
                  <div className="h-3 bg-slate-800 rounded w-1/2"></div>
                </div>
                <div className="h-8 bg-slate-800 rounded w-24"></div>
              </div>
            ))}
          </div>
        )}

        {!loading && results.length > 0 && (
          <div className="space-y-3 mt-6">
            <h4 className="text-xs text-slate-400 font-bold uppercase tracking-wider px-1">Available Search Results (Live Agents):</h4>
            {results.map((res, index) => (
              <div key={index} className="bg-[#121c33] p-5 rounded-2xl flex justify-between items-center border border-slate-800 hover:border-slate-700 transition-all">
                <div onClick={() => onDetailClick("flights", { ...res, fromCity, toCity, cabin, passengers, depDate })} className="cursor-pointer flex-1 text-left">
                  <div className="flex items-center gap-2">
                    <Plane size={14} className="text-blue-500" />
                    <span className="font-bold text-sm">{res.airline}</span>
                    <span className="text-[10px] bg-blue-900/40 text-blue-300 px-1.5 py-0.5 rounded">{res.flight_ref}</span>
                  </div>
                  <div className="text-xs text-slate-300 mt-2">
                    {res.dep} ➔ {res.arr} <span className="text-slate-500 font-normal">({res.duration})</span>
                  </div>
                  <span className="text-[10px] text-blue-400 font-bold block mt-2 hover:underline">View details & seat selection ➔</span>
                </div>
                <div className="text-right">
                  <div className="font-black text-emerald-400 text-base">₹{res.price.toLocaleString()}</div>
                  <button 
                    onClick={() => onBook({
                      vertical: "flights",
                      amount: res.price,
                      details: {
                        origin: fromCity.split(" ")[0],
                        destination: toCity.split(" ")[0],
                        airline_code: res.flight_ref.split("-")[0],
                        flight_number: res.flight_ref.split("-")[1],
                        cabin_class: cabin.toUpperCase(),
                        passengers: [{ name: "Traveler Guest", age: 32 }]
                      },
                      title: `${res.airline} ${res.flight_ref}`,
                      subtitle: `${fromCity} ➔ ${toCity}`
                    })}
                    className="mt-2 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black px-3.5 py-1.5 rounded-lg flex items-center gap-1 shadow-md shadow-blue-500/10 cursor-pointer"
                  >
                    Book Flight <ArrowRight size={10} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Price Drop Protection Modal */}
      {showPayoutModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0b1021] border border-slate-800 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex justify-between items-center">
              <h4 className="font-black text-slate-200 flex items-center gap-2"><ShieldCheck size={20} className="text-blue-500" /> Price Drop Protection</h4>
              <button onClick={() => setShowPayoutModal(false)} className="text-slate-400 hover:text-white font-extrabold text-sm font-bold">✕</button>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Secure your fare against sudden drops. If the ticket price for your selected flight falls by more than ₹300 within 24 hours of booking, we will refund the difference back to your digital Travel Wallet automatically.
            </p>
            <div className="bg-slate-900/40 p-3 rounded-xl border border-slate-800 text-[10px] text-slate-500">
              *T&C Apply. Applicable only to domestic routes. Refund cap is ₹1,500 per seat.
            </div>
            <button 
              onClick={() => setShowPayoutModal(false)}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 rounded-xl text-xs font-bold"
            >
              Acknowledge & Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function FareChip({ name, active, onClick, subtext }: { name: string, active: string, onClick: (n: string) => void, subtext: string }) {
  const isActive = name === active;
  return (
    <div 
      onClick={() => onClick(name)}
      className={`px-3 py-1.5 border-2 border-black text-left cursor-pointer transition-all active:translate-y-px ${
        isActive 
          ? 'bg-yellow-400 text-black shadow-[2px_2px_0px_0px_#000000]' 
          : 'bg-white text-slate-800 hover:bg-slate-50'
      }`}
    >
      <div className="text-[10px] font-black uppercase tracking-tight">{name}</div>
      <div className="text-[8px] opacity-75 font-semibold mt-0.5">{subtext}</div>
    </div>
  );
}

/* ---------------------------------------------------- */
/* 4. ADDITIONAL VERTICAL FORMS (HOTELS & VISA HELP)     */
/* ---------------------------------------------------- */
const POPULAR_DESTINATIONS = [
  // --- Metro & Famous Cities ---
  "Delhi", "Mumbai", "Bangalore", "Kolkata", "Chennai", "Hyderabad", "Pune", "Ahmedabad", "Gurgaon", "Noida", "Ghaziabad", "Faridabad",
  // --- Goa ---
  "Goa", "North Goa", "South Goa", "Panaji", "Calangute", "Baga", "Margao", "Vasco da Gama", "Candolim", "Anjuna", "Colva",
  // --- Jammu & Kashmir & Ladakh ---
  "Srinagar", "Gulmarg", "Pahalgam", "Sonamarg", "Katra", "Jammu", "Leh", "Kargil", "Nubra Valley", "Pangong Tso",
  // --- Himachal Pradesh ---
  "Shimla", "Manali", "Dharamshala", "Dalhousie", "Kasauni", "Kullu", "McLeod Ganj", "Spiti Valley", "Chamba", "Kangra", "Solan", "Mandi", "Kaza",
  // --- Uttarakhand ---
  "Dehradun", "Haridwar", "Rishikesh", "Nainital", "Mussoorie", "Almora", "Ranikhet", "Auli", "Corbett National Park", "Pithoragarh", "Chamoli", "Uttarkashi", "Kedarnath", "Badrinath",
  // --- Rajasthan ---
  "Jaipur", "Jodhpur", "Udaipur", "Jaisalmer", "Bikaner", "Ajmer", "Pushkar", "Mount Abu", "Alwar", "Kota", "Sawai Madhopur", "Chittorgarh", "Ranthambore", "Bharatpur",
  // --- Uttar Pradesh ---
  "Varanasi", "Agra", "Lucknow", "Prayagraj", "Ayodhya", "Mathura", "Vrindavan", "Jhansi", "Kanpur", "Meerut", "Gorakhpur", "Bareilly", "Aligarh",
  // --- Punjab & Haryana ---
  "Amritsar", "Chandigarh", "Ludhiana", "Jalandhar", "Patiala", "Pathankot", "Bathinda", "Kurukshetra", "Panchkula", "Panipat", "Ambala",
  // --- Bihar & Jharkhand ---
  "Patna", "Gaya", "Bodh Gaya", "Muzaffarpur", "Bhagalpur", "Darbhanga", "Nalanda", "Rajgir", "Ranchi", "Jamshedpur", "Dhanbad", "Bokaro", "Hazaribagh", "Deoghar",
  // --- West Bengal & Sikkim ---
  "Darjeeling", "Gangtok", "Siliguri", "Kalimpong", "Digha", "Sundarbans", "Pelling", "Lachung", "Lachen", "Howrah", "Asansol", "Durgapur",
  // --- Northeast India ---
  "Guwahati", "Shillong", "Cherrapunji", "Dawki", "Tawang", "Itanagar", "Ziro", "Imphal", "Kohima", "Dimapur", "Aizawl", "Agartala", "Kaziranga", "Tezpur", "Dibrugarh", "Jorhat",
  // --- Odisha & Chhattisgarh ---
  "Bhubaneswar", "Puri", "Konark", "Cuttack", "Rourkela", "Sambalpur", "Balasore", "Raipur", "Bilaspur", "Bhilai", "Jagdalpur",
  // --- Madhya Pradesh ---
  "Indore", "Bhopal", "Gwalior", "Jabalpur", "Ujjain", "Khajuraho", "Pachmarhi", "Kanha National Park", "Bandhavgarh",
  // --- Gujarat ---
  "Surat", "Vadodara", "Rajkot", "Gandhinagar", "Bhuj", "Gir Forest", "Somnath", "Dwarka", "Kevadia", "Rann of Kutch",
  // --- Maharashtra ---
  "Thane", "Nashik", "Aurangabad", "Lonavala", "Mahabaleshwar", "Shirdi", "Kolhapur", "Solapur", "Alibaug", "Matheran", "Khandala",
  // --- Karnataka ---
  "Mysore", "Hampi", "Coorg", "Gokarna", "Mangalore", "Udupi", "Chikmagalur", "Hubli", "Belgaum", "Badami",
  // --- Andhra Pradesh & Telangana ---
  "Visakhapatnam", "Vijayawada", "Tirupati", "Guntur", "Nellore", "Kurnool", "Rajahmundry", "Kadapa", "Warangal", "Nizamabad", "Karimnagar", "Khammam",
  // --- Tamil Nadu ---
  "Ooty", "Kodaikanal", "Coimbatore", "Madurai", "Trichy", "Rameshwaram", "Kanyakumari", "Mahabalipuram", "Salem", "Vellore", "Yercaud",
  // --- Kerala ---
  "Kochi", "Trivandrum", "Munnar", "Wayanad", "Alleppey", "Kovalam", "Varkala", "Thekkady", "Kumarakom", "Kozhikode", "Athirappilly",
  // --- Union Territories ---
  "Puducherry", "Port Blair", "Havelock Island", "Kavaratti", "Lakshadweep", "Daman", "Diu"
];

function HotelsSearchForm({ onBook, onDetailClick }: { onBook: (data: any) => void, onDetailClick: (vert: string, item: any) => void }) {
  const [city, setCity] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useTabLoading('hotels');
  const [selectedHotel, setSelectedHotel] = useState<any | null>(null);

  const [checkIn, setCheckIn] = useState("2026-12-15");
  const [checkOut, setCheckOut] = useState("2026-12-20");
  const [guests, setGuests] = useState(2);
  const [starRating, setStarRating] = useState("all");

  const handleSearch = () => {
    if (!city.trim()) {
      alert("Please enter a city or property name.");
      return;
    }
    setLoading(true);
    setResults([]);
    fetch(`http://localhost:8000/api/v1/search?vertical=hotels&destination=${encodeURIComponent(city)}`)
      .then(res => res.json())
      .then(data => {
        setLoading(false);
        if (data && Array.isArray(data.results)) {
          setResults(data.results);
        }
      })
      .catch(() => {
        setLoading(false);
      });
  };

  return (
    <div className="space-y-6">
      {/* Input Core Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-950/20 p-6 border-3 border-black shadow-[6px_6px_0px_0px_#000000]">
        
        {/* City Input */}
        <div className="space-y-1.5 relative md:col-span-1">
          <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">City or Property Name</span>
          <input 
            type="text" 
            value={city}
            placeholder="Where do you want to stay?"
            onChange={(e) => {
              setCity(e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            className="w-full bg-white border-3 border-black text-slate-900 font-black text-sm px-3 py-2.5 outline-none focus:bg-yellow-50/50"
          />
          {showSuggestions && (
            <div className="absolute left-0 right-0 top-[68px] bg-white border-3 border-black shadow-[4px_4px_0px_0px_#000000] z-50 overflow-y-auto max-h-48 text-black font-sans">
              {POPULAR_DESTINATIONS.filter(dest => dest.toLowerCase().includes(city.toLowerCase()))
                .map((dest, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onMouseDown={() => {
                      setCity(dest);
                      setShowSuggestions(false);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-yellow-300 transition-colors font-bold text-xs border-b-2 border-black last:border-0 cursor-pointer"
                  >
                    {dest}
                  </button>
                ))}
            </div>
          )}
        </div>

        {/* Date Pickers */}
        <div className="md:col-span-2">
          <DateRangeField 
            startLabel="Check-in"
            endLabel="Check-out"
            startDate={checkIn}
            endDate={checkOut}
            onStartChange={setCheckIn}
            onEndChange={setCheckOut}
          />
        </div>

        {/* Guests counter */}
        <CounterStepper 
          label="Rooms & Guests"
          value={guests}
          onChange={setGuests}
        />
      </div>

      {/* Star Rating Filter as Pill Option Row */}
      <PillOptionRow 
        label="Select Star Rating:"
        options={[
          { id: "all", title: "All Ratings" },
          { id: "3", title: "3 Star" },
          { id: "4", title: "4 Star" },
          { id: "5", title: "5 Star" }
        ]}
        selectedId={starRating}
        onChange={setStarRating}
      />

      {/* Search Button */}
      <div className="flex justify-end pt-2 border-t border-slate-800/80">
        <StickerButton onClick={handleSearch} className="bg-yellow-400 text-black font-black">
          Search Hotels
        </StickerButton>
      </div>

      {/* Hotel Results Grid */}
      <div className="mt-4">
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1, 2].map((i) => (
              <div key={i} className="glass-card p-4 rounded-2xl animate-pulse border border-slate-800 space-y-4">
                <div className="h-48 bg-slate-800 rounded-xl w-full"></div>
                <div className="h-4 bg-slate-800 rounded w-1/3"></div>
                <div className="h-3 bg-slate-800 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        )}

        {!loading && results.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {results.map((res, index) => (
              <div key={index} className="bg-[#121c33] p-4 rounded-2xl border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between gap-4">
                <div onClick={() => onDetailClick("hotels", res)} className="cursor-pointer">
                  <CardThumbnail ownerType="hotel" ownerId={res.name} blurHash={res.blur_hash_base64} defaultUrl={res.primary_photo_url} />
                  <div className="flex flex-col gap-1.5 mt-3 text-left">
                    <div className="flex justify-between items-center">
                      <h4 className="font-extrabold text-slate-200 text-base">{res.name}</h4>
                      <span className="text-xs text-blue-400 font-black">{res.rating}</span>
                    </div>
                    <p className="text-xs text-slate-400">{res.details}</p>
                    <span className="text-[10px] text-blue-400 font-bold block mt-1 hover:underline">View details, reviews & cancellation policies ➔</span>
                  </div>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-slate-800/80">
                  <div>
                    <span className="text-[9px] text-slate-500 uppercase block font-bold">Price per night</span>
                    <span className="font-black text-emerald-400 text-base">₹{res.price.toLocaleString()}</span>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setSelectedHotel(res)}
                      className="bg-slate-800 hover:bg-slate-750 text-white text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1 transition-all"
                    >
                      Snaps
                    </button>
                    <button 
                      onClick={() => onBook({
                        vertical: "hotels",
                        amount: res.price,
                        details: {
                          hotel_name: res.name,
                          hotel_id: "H101",
                          room_type: res.details,
                          guests: [{ name: "Traveler Guest", age: 32 }]
                        },
                        title: res.name,
                        subtitle: res.details
                      })}
                      className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-1 shadow-md shadow-blue-500/10 transition-all"
                    >
                      Book Room
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedHotel && (
        <DetailGallery 
          ownerType="hotel" 
          ownerId={selectedHotel.name} 
          onClose={() => setSelectedHotel(null)} 
        />
      )}
    </div>
  );
}


/* ---------------------------------------------------- */
/* 4. ALL NEW VERTICAL SEARCH FORMS (3 TO 12)           */
/* ---------------------------------------------------- */

function VillasSearchForm({ onBook, onDetailClick }: { onBook: (data: any) => void, onDetailClick: (vert: string, item: any) => void }) {
  const [destination, setDestination] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [propertyType, setPropertyType] = useState("Villa");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useTabLoading('villas');

  const [checkIn, setCheckIn] = useState("2026-12-15");
  const [checkOut, setCheckOut] = useState("2026-12-20");
  const [guests, setGuests] = useState(2);

  const handleSearch = () => {
    if (!destination.trim()) {
      alert("Please enter a destination.");
      return;
    }
    setLoading(true);
    setResults([]);
    fetch(`http://localhost:8000/api/v1/search?vertical=villas&destination=${encodeURIComponent(destination)}`)
      .then(res => res.json())
      .then(data => {
        setLoading(false);
        if (data && Array.isArray(data.results)) {
          setResults(data.results.filter((v: any) => v.property_type === propertyType));
        }
      })
      .catch(() => setLoading(false));
  };

  return (
    <div className="space-y-6 text-black font-sans">
      {/* Input Core Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-950/20 p-6 border-3 border-black shadow-[6px_6px_0px_0px_#000000]">
        
        {/* Destination Input */}
        <div className="space-y-1.5 relative md:col-span-1">
          <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">Destination</span>
          <input 
            type="text" 
            value={destination} 
            placeholder="Where are you going?"
            onChange={(e) => {
              setDestination(e.target.value);
              setShowSuggestions(true);
            }} 
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            className="w-full bg-white border-3 border-black text-slate-900 font-black text-sm px-3 py-2.5 outline-none focus:bg-yellow-50/50" 
          />
          {showSuggestions && (
            <div className="absolute left-0 right-0 top-[68px] bg-white border-3 border-black shadow-[4px_4px_0px_0px_#000000] z-50 overflow-y-auto max-h-48 text-black font-sans">
              {POPULAR_DESTINATIONS.filter(dest => dest.toLowerCase().includes(destination.toLowerCase()))
                .map((dest, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onMouseDown={() => {
                      setDestination(dest);
                      setShowSuggestions(false);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-yellow-300 transition-colors font-bold text-xs border-b-2 border-black last:border-0 cursor-pointer"
                  >
                    {dest}
                  </button>
                ))}
            </div>
          )}
        </div>

        {/* Date Pickers */}
        <div className="md:col-span-2">
          <DateRangeField 
            startLabel="Check-in"
            endLabel="Check-out"
            startDate={checkIn}
            endDate={checkOut}
            onStartChange={setCheckIn}
            onEndChange={setCheckOut}
          />
        </div>

        {/* Guests counter */}
        <CounterStepper 
          label="Guests"
          value={guests}
          onChange={setGuests}
        />
      </div>

      {/* Property Type Pill Option Row */}
      <PillOptionRow 
        label="Select Property Type:"
        options={[
          { id: "Villa", title: "Luxury Villa" },
          { id: "Homestay", title: "Homestay" },
          { id: "Cottage", title: "Cottage" }
        ]}
        selectedId={propertyType}
        onChange={setPropertyType}
      />

      {/* Search Button */}
      <div className="flex justify-end pt-2 border-t border-slate-800/80">
        <StickerButton onClick={handleSearch} className="bg-yellow-400 text-black font-black">
          Search Villas
        </StickerButton>
      </div>

      {loading ? (
        <div className="text-center py-6 text-slate-400 text-xs">Searching homestays...</div>
      ) : results.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {results.map((v, i) => (
            <div key={i} className="bg-white border-3 border-black p-4 rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col justify-between gap-3 text-left">
              <div onClick={() => onDetailClick("villas", v)} className="cursor-pointer">
                <CardThumbnail ownerType="villa" ownerId={v.name} blurHash={v.blur_hash_base64} defaultUrl={v.primary_photo_url} />
                <div className="mt-2">
                  <span className="text-[8px] bg-red-100 text-red-600 font-black px-1.5 py-0.5 rounded border border-red-200 uppercase">Requires Host Confirmation</span>
                  <h4 className="font-extrabold text-base mt-1 text-black">{v.name}</h4>
                  <p className="text-xs text-slate-500 mt-1">{v.details}</p>
                  <div className="flex gap-4 mt-2 text-[10px] text-slate-600 font-bold">
                    <span>🛏️ {v.bedrooms} Bedrooms</span>
                    <span>👥 Max Pax: {v.max_occupancy}</span>
                  </div>
                </div>
                <span className="text-[10px] text-blue-600 font-bold block mt-2 hover:underline">View details, rules & calendar ➔</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                <div>
                  <span className="text-[8px] text-slate-400 block uppercase font-bold">Per Night</span>
                  <span className="font-black text-red-500 text-sm">₹{v.price.toLocaleString()}</span>
                </div>
                <button 
                  onClick={() => onBook({
                    vertical: "villas",
                    amount: v.price,
                    details: {
                      villa_name: v.name,
                      bedrooms: v.bedrooms,
                      max_occupancy: v.max_occupancy,
                      requires_host_approval: true
                    },
                    title: v.name,
                    subtitle: `${v.bedrooms} Bedrooms Villa Rental`
                  })}
                  className="bg-yellow-300 text-xs font-black px-4 py-2 border-2 border-black rounded-lg shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-yellow-400 transition-all uppercase"
                >
                  Book Stay
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function HolidayPackagesSearchForm({ onBook, onDetailClick }: { onBook: (data: any) => void, onDetailClick: (vert: string, item: any) => void }) {
  const [destination, setDestination] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useTabLoading('holidays');

  const [duration, setDuration] = useState("Week");
  const [travellers, setTravellers] = useState(2);
  const [budget, setBudget] = useState(75000);
  const [packageType, setPackageType] = useState("Family");

  const handleSearch = () => {
    if (!destination.trim()) {
      alert("Please enter a destination.");
      return;
    }
    setLoading(true);
    setResults([]);
    fetch(`http://localhost:8000/api/v1/search?vertical=holidays&destination=${encodeURIComponent(destination)}`)
      .then(res => res.json())
      .then(data => {
        setLoading(false);
        if (data && Array.isArray(data.results)) {
          setResults(data.results);
        }
      })
      .catch(() => setLoading(false));
  };

  return (
    <div className="space-y-6 text-black font-sans">
      {/* Input Core Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-950/20 p-6 border-3 border-black shadow-[6px_6px_0px_0px_#000000]">
        
        {/* Destination Input */}
        <div className="space-y-1.5 relative md:col-span-1">
          <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">Where to?</span>
          <input 
            type="text" 
            value={destination} 
            placeholder="Search destination"
            onChange={(e) => {
              setDestination(e.target.value);
              setShowSuggestions(true);
            }} 
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            className="w-full bg-white border-3 border-black text-slate-900 font-black text-sm px-3 py-2.5 outline-none focus:bg-yellow-50/50" 
          />
          {showSuggestions && (
            <div className="absolute left-0 right-0 top-[68px] bg-white border-3 border-black shadow-[4px_4px_0px_0px_#000000] z-50 overflow-y-auto max-h-48 text-black font-sans">
              {POPULAR_DESTINATIONS.filter(dest => dest.toLowerCase().includes(destination.toLowerCase()))
                .map((dest, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onMouseDown={() => {
                      setDestination(dest);
                      setShowSuggestions(false);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-yellow-300 transition-colors font-bold text-xs border-b-2 border-black last:border-0 cursor-pointer"
                  >
                    {dest}
                  </button>
                ))}
            </div>
          )}
        </div>

        {/* Duration selector */}
        <div className="md:col-span-2 space-y-1.5">
          <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">Duration</span>
          <div className="flex gap-2">
            {["Weekend", "Week", "Extended"].map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setDuration(item)}
                className={`flex-1 px-3 py-2.5 border-2 border-black font-black text-xs transition-all cursor-pointer active:translate-y-px ${
                  duration === item 
                    ? 'bg-yellow-400 text-black shadow-[2px_2px_0px_0px_#000000]' 
                    : 'bg-white text-slate-800 hover:bg-slate-50'
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        {/* Travellers counter */}
        <CounterStepper 
          label="Travellers"
          value={travellers}
          onChange={setTravellers}
        />
      </div>

      {/* Budget range slider and Package Type */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Budget Range Slider */}
        <div className="space-y-2 bg-white border-3 border-black p-4 shadow-[4px_4px_0px_0px_#000000] flex flex-col justify-center">
          <div className="flex justify-between items-center text-xs font-black">
            <span className="text-slate-500 uppercase tracking-wider text-[10px]">Max Budget:</span>
            <span className="text-emerald-600 font-black">₹{budget.toLocaleString()}</span>
          </div>
          <input 
            type="range" 
            min="10000" 
            max="250000" 
            step="5000"
            value={budget} 
            onChange={(e) => setBudget(parseInt(e.target.value))} 
            className="w-full accent-yellow-400 cursor-pointer h-2 bg-slate-200 border-2 border-black"
          />
        </div>

        {/* Package Type Pill Option Row */}
        <PillOptionRow 
          label="Select Package Type:"
          options={[
            { id: "Family", title: "Family Fun" },
            { id: "Honeymoon", title: "Honeymoon" },
            { id: "Adventure", title: "Adventure" },
            { id: "Solo", title: "Solo Journey" }
          ]}
          selectedId={packageType}
          onChange={setPackageType}
        />
      </div>

      {/* Search Button */}
      <div className="flex justify-end pt-2 border-t border-slate-800/80">
        <StickerButton onClick={handleSearch} className="bg-yellow-400 text-black font-black">
          Search Packages
        </StickerButton>
      </div>

      {loading ? (
        <div className="text-center py-6 text-slate-400 text-xs">Searching flight+hotel holiday combos...</div>
      ) : results.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
          {results.map((p, i) => (
            <div key={i} className="bg-white border-3 border-black p-4 rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col justify-between gap-3 text-black">
              <div onClick={() => onDetailClick("holidays", p)} className="cursor-pointer">
                <CardThumbnail ownerType="holiday" ownerId={p.name} blurHash={p.blur_hash_base64} defaultUrl={p.primary_photo_url} />
                <div className="mt-2">
                  <span className="text-[8px] bg-blue-100 text-blue-600 font-black px-1.5 py-0.5 rounded border border-blue-200 uppercase">{p.duration}</span>
                  <h4 className="font-extrabold text-base mt-1 text-black">{p.name}</h4>
                  <p className="text-xs text-slate-500 mt-1">{p.details}</p>
                  <p className="text-[10px] text-slate-600 mt-2 font-bold">📦 Inclusions: {p.inclusions}</p>
                </div>
                <span className="text-[10px] text-blue-600 font-bold block mt-2 hover:underline">View itinerary & customize ➔</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                <div>
                  <span className="text-[8px] text-slate-400 block uppercase font-bold">Total Package Price</span>
                  <span className="font-black text-red-500 text-sm">₹{p.price.toLocaleString()}</span>
                </div>
                <button 
                  onClick={() => onBook({
                    vertical: "holidays",
                    amount: p.price,
                    details: {
                      package_name: p.name,
                      destination: destination,
                      inclusions_summary: p.inclusions,
                      included_services: { hotel: true, flights: true, activities: true }
                    },
                    title: p.name,
                    subtitle: `${p.duration} Complete Getaway`
                  })}
                  className="bg-yellow-300 text-xs font-black px-4 py-2 border-2 border-black rounded-lg shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-yellow-400 transition-all uppercase"
                >
                  Book Package
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TrainsSearchForm({ onBook, onDetailClick }: { onBook: (data: any) => void, onDetailClick: (vert: string, item: any) => void }) {
  const [fromStn, setFromStn] = useState("Delhi (NDLS)");
  const [toStn, setToStn] = useState("");
  const [showFromSuggestions, setShowFromSuggestions] = useState(false);
  const [showToSuggestions, setShowToSuggestions] = useState(false);
  const [coach, setCoach] = useState("3A");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useTabLoading('trains');

  const handleSearch = () => {
    setLoading(true);
    setResults([]);
    fetch(`http://localhost:8000/api/v1/search?vertical=trains&origin=${encodeURIComponent(fromStn)}&destination=${encodeURIComponent(toStn)}`)
      .then(res => res.json())
      .then(data => {
        setLoading(false);
        if (data && Array.isArray(data.results)) {
          setResults(data.results);
        }
      })
      .catch(() => setLoading(false));
  };

  return (
    <div className="space-y-6 text-black font-sans">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-900/60 p-4 rounded-2xl border border-slate-800/80">
        <div className="space-y-1.5 relative">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">From Station</span>
          <input 
            type="text" 
            value={fromStn} 
            placeholder="e.g. Delhi (NDLS)"
            onChange={(e) => {
              setFromStn(e.target.value);
              setShowFromSuggestions(true);
            }} 
            onFocus={() => setShowFromSuggestions(true)}
            onBlur={() => setTimeout(() => setShowFromSuggestions(false), 200)}
            className="w-full bg-[#0e1628] border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white font-bold outline-none" 
          />
          {showFromSuggestions && (
            <div className="absolute left-0 right-0 top-[65px] bg-white border-3 border-black rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] z-50 overflow-y-auto max-h-48 text-black font-sans">
              {POPULAR_DESTINATIONS.filter(dest => dest.toLowerCase().includes(fromStn.toLowerCase()))
                .map((dest, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onMouseDown={() => {
                      setFromStn(dest);
                      setShowFromSuggestions(false);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-yellow-300 transition-colors font-bold text-xs border-b border-slate-100 last:border-0 cursor-pointer"
                  >
                    {dest}
                  </button>
                ))}
            </div>
          )}
        </div>
        <div className="space-y-1.5 relative">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">To Station</span>
          <input 
            type="text" 
            value={toStn} 
            placeholder="e.g. Mumbai (CSMT)"
            onChange={(e) => {
              setToStn(e.target.value);
              setShowToSuggestions(true);
            }} 
            onFocus={() => setShowToSuggestions(true)}
            onBlur={() => setTimeout(() => setShowToSuggestions(false), 200)}
            className="w-full bg-[#0e1628] border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white font-bold outline-none" 
          />
          {showToSuggestions && (
            <div className="absolute left-0 right-0 top-[65px] bg-white border-3 border-black rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] z-50 overflow-y-auto max-h-48 text-black font-sans">
              {POPULAR_DESTINATIONS.filter(dest => dest.toLowerCase().includes(toStn.toLowerCase()))
                .map((dest, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onMouseDown={() => {
                      setToStn(dest);
                      setShowToSuggestions(false);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-yellow-300 transition-colors font-bold text-xs border-b border-slate-100 last:border-0 cursor-pointer"
                  >
                    {dest}
                  </button>
                ))}
            </div>
          )}
        </div>
        <div className="space-y-1.5">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Class</span>
          <select value={coach} onChange={(e) => setCoach(e.target.value)} className="w-full bg-[#0e1628] border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white font-bold outline-none">
            <option value="3A">AC 3 Tier (3A)</option>
            <option value="2A">AC 2 Tier (2A)</option>
            <option value="1A">AC 1st Class (1A)</option>
            <option value="SL">Sleeper Class (SL)</option>
          </select>
        </div>
        <div className="flex items-end">
          <button onClick={handleSearch} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-sm py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer">
            <Search size={14} /> Search Trains
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-6 text-slate-400 text-xs">Querying railway schedule database...</div>
      ) : results.length > 0 && (
        <div className="space-y-3 text-black">
          {results.map((t, i) => (
            <div key={i} className="bg-white border-3 border-black p-4 rounded-2xl shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] flex flex-col gap-3 text-black">
              <div onClick={() => onDetailClick("trains", t)} className="cursor-pointer text-left">
                <CardThumbnail ownerType="train" ownerId={t.train_name} blurHash={t.blur_hash_base64} defaultUrl={t.primary_photo_url} />
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[10px] bg-slate-900 text-white px-2 py-0.5 rounded font-black">{t.train_number}</span>
                  <h4 className="font-extrabold text-base text-black">{t.train_name}</h4>
                </div>
                <div className="text-xs text-slate-600 mt-1 font-bold">
                  {fromStn.split(" ")[0]} ➔ {toStn.split(" ")[0]} | Coach: {coach} | Duration: {t.duration}
                </div>
                <span className="text-[10px] text-blue-600 font-bold block mt-1 hover:underline">Check seat availability chart ➔</span>
              </div>
              <div className="text-right">
                <span className="font-black text-red-500 text-base block">₹{t.price}</span>
                <button 
                  onClick={() => onBook({
                    vertical: "trains",
                    amount: t.price,
                    details: {
                      train_number: t.train_number,
                      train_name: t.train_name,
                      origin_station: fromStn.split(" ")[0],
                      destination_station: toStn.split(" ")[0],
                      coach_class: coach,
                      passengers: [{ name: "Traveler Guest", age: 32 }]
                    },
                    title: `${t.train_number} ${t.train_name}`,
                    subtitle: `Coach: ${coach} | ${fromStn} ➔ ${toStn}`
                  })}
                  className="mt-1 bg-yellow-300 text-[10px] font-black px-3 py-1.5 border-2 border-black rounded-lg shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-yellow-400 transition-all uppercase block"
                >
                  Book Seat
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BusesSearchForm({ onBook, onDetailClick }: { onBook: (data: any) => void, onDetailClick: (vert: string, item: any) => void }) {
  const [fromCity, setFromCity] = useState("Delhi");
  const [toCity, setToCity] = useState("Manali");
  const [showFromSuggestions, setShowFromSuggestions] = useState(false);
  const [showToSuggestions, setShowToSuggestions] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useTabLoading('buses');
  const [showSeatModal, setShowSeatModal] = useState<any | null>(null);
  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);

  const handleSearch = () => {
    setLoading(true);
    setResults([]);
    fetch(`http://localhost:8000/api/v1/search?vertical=buses&origin=${encodeURIComponent(fromCity)}&destination=${encodeURIComponent(toCity)}`)
      .then(res => res.json())
      .then(data => {
        setLoading(false);
        if (data && Array.isArray(data.results)) {
          setResults(data.results);
        }
      })
      .catch(() => setLoading(false));
  };

  const handleOpenSeatMap = (bus: any) => {
    setShowSeatModal(bus);
    setSelectedSeats([]);
  };

  const toggleSeat = (seat: string) => {
    if (selectedSeats.includes(seat)) {
      setSelectedSeats(prev => prev.filter(s => s !== seat));
    } else {
      setSelectedSeats(prev => [...prev, seat]);
    }
  };

  const handleConfirmSeats = () => {
    if (selectedSeats.length === 0) {
      alert("Please select at least one seat.");
      return;
    }
    const finalAmount = showSeatModal.price * selectedSeats.length;
    onBook({
      vertical: "buses",
      amount: finalAmount,
      details: {
        operator_name: showSeatModal.operator_name,
        bus_type: showSeatModal.bus_type,
        origin: fromCity,
        destination: toCity,
        seat_numbers: selectedSeats
      },
      title: `${showSeatModal.operator_name} (${showSeatModal.bus_type})`,
      subtitle: `Seats: ${selectedSeats.join(", ")} | ${fromCity} ➔ ${toCity}`
    });
    setShowSeatModal(null);
  };

  return (
    <div className="space-y-6 text-black font-sans">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-900/60 p-4 rounded-2xl border border-slate-800/80">
        <div className="space-y-1.5 relative">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">From</span>
          <input 
            type="text" 
            value={fromCity} 
            placeholder="e.g. Delhi"
            onChange={(e) => {
              setFromCity(e.target.value);
              setShowFromSuggestions(true);
            }} 
            onFocus={() => setShowFromSuggestions(true)}
            onBlur={() => setTimeout(() => setShowFromSuggestions(false), 200)}
            className="w-full bg-[#0e1628] border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white font-bold outline-none" 
          />
          {showFromSuggestions && (
            <div className="absolute left-0 right-0 top-[65px] bg-white border-3 border-black rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] z-50 overflow-y-auto max-h-48 text-black font-sans">
              {POPULAR_DESTINATIONS.filter(dest => dest.toLowerCase().includes(fromCity.toLowerCase()))
                .map((dest, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onMouseDown={() => {
                      setFromCity(dest);
                      setShowFromSuggestions(false);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-yellow-300 transition-colors font-bold text-xs border-b border-slate-100 last:border-0 cursor-pointer"
                  >
                    {dest}
                  </button>
                ))}
            </div>
          )}
        </div>
        <div className="space-y-1.5 relative">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">To</span>
          <input 
            type="text" 
            value={toCity} 
            placeholder="e.g. Manali"
            onChange={(e) => {
              setToCity(e.target.value);
              setShowToSuggestions(true);
            }} 
            onFocus={() => setShowToSuggestions(true)}
            onBlur={() => setTimeout(() => setShowToSuggestions(false), 200)}
            className="w-full bg-[#0e1628] border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white font-bold outline-none" 
          />
          {showToSuggestions && (
            <div className="absolute left-0 right-0 top-[65px] bg-white border-3 border-black rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] z-50 overflow-y-auto max-h-48 text-black font-sans">
              {POPULAR_DESTINATIONS.filter(dest => dest.toLowerCase().includes(toCity.toLowerCase()))
                .map((dest, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onMouseDown={() => {
                      setToCity(dest);
                      setShowToSuggestions(false);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-yellow-300 transition-colors font-bold text-xs border-b border-slate-100 last:border-0 cursor-pointer"
                  >
                    {dest}
                  </button>
                ))}
            </div>
          )}
        </div>
        <div className="space-y-1.5">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Bus Type</span>
          <select className="w-full bg-[#0e1628] border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white font-bold outline-none">
            <option>AC Sleeper</option>
            <option>AC Seater</option>
          </select>
        </div>
        <div className="flex items-end">
          <button onClick={handleSearch} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-sm py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer">
            <Search size={14} /> Search Buses
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-6 text-slate-400 text-xs">Querying bus aggregator networks...</div>
      ) : results.length > 0 && (
        <div className="space-y-3">
          {results.map((b, i) => (
            <div key={i} className="bg-white border-3 border-black p-4 rounded-2xl shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] flex flex-col gap-3 text-black">
              <div onClick={() => onDetailClick("buses", b)} className="cursor-pointer text-left">
                <CardThumbnail ownerType="bus" ownerId={b.operator_name} blurHash={b.blur_hash_base64} defaultUrl={b.primary_photo_url} />
                <h4 className="font-extrabold text-base mt-2 text-black">{b.operator_name}</h4>
                <p className="text-xs text-slate-600 mt-0.5 font-bold">{b.bus_type} | Dep: {b.departure_time} | {b.seats_left} seats left</p>
                <span className="text-[10px] text-blue-600 font-bold block mt-1 hover:underline">View details & board guidelines ➔</span>
              </div>
              <div className="text-right">
                <span className="font-black text-red-500 text-base block">₹{b.price}</span>
                <button 
                  onClick={() => handleOpenSeatMap(b)}
                  className="mt-1 bg-yellow-300 text-[10px] font-black px-3.5 py-1.5 border-2 border-black rounded-lg shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-yellow-400 transition-all uppercase"
                >
                  Select Seats
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showSeatModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border-4 border-black p-6 max-w-sm w-full space-y-4 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] text-black">
            <div className="flex justify-between items-center border-b-3 border-black pb-2">
              <h4 className="font-black text-sm uppercase">Select Sleeper Berths</h4>
              <button onClick={() => setShowSeatModal(null)} className="font-bold text-slate-500">✕</button>
            </div>
            
            <div className="bg-slate-100 p-3 rounded-lg border-2 border-black text-[10px] font-bold text-slate-500 flex justify-between">
              <span>Driver Side</span>
              <span>🚪 Door</span>
            </div>

            <div className="grid grid-cols-4 gap-3 py-4 max-w-[240px] mx-auto">
              {showSeatModal.seats_map.map((seat: string) => (
                <div 
                  key={seat}
                  onClick={() => toggleSeat(seat)}
                  className={`border-3 border-black h-12 flex items-center justify-center rounded font-black text-xs cursor-pointer shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] active:translate-y-0.5 active:shadow-none transition-all ${
                    selectedSeats.includes(seat) ? 'bg-yellow-300' : 'bg-white hover:bg-slate-100'
                  }`}
                >
                  {seat}
                </div>
              ))}
            </div>

            <div className="border-t-3 border-black pt-3 flex justify-between items-center text-xs font-black">
              <span>Selected: {selectedSeats.length} Seats</span>
              <span className="text-red-500">Total: ₹{(showSeatModal.price * selectedSeats.length).toLocaleString()}</span>
            </div>

            <button 
              onClick={handleConfirmSeats}
              className="w-full bg-yellow-300 hover:bg-yellow-400 border-3 border-black font-black py-2 rounded-lg text-xs uppercase shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:translate-y-0.5 active:shadow-none transition-all"
            >
              Lock Seats & Book
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function CabsSearchForm({ onBook, onDetailClick }: { onBook: (data: any) => void, onDetailClick: (vert: string, item: any) => void }) {
  const [pickup, setPickup] = useState("Airport Terminal");
  const [drop, setDrop] = useState("");
  const [showPickupSuggestions, setShowPickupSuggestions] = useState(false);
  const [showDropSuggestions, setShowDropSuggestions] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useTabLoading('cabs');

  const handleSearch = () => {
    setLoading(true);
    setResults([]);
    fetch(`http://localhost:8000/api/v1/search?vertical=cabs&origin=${encodeURIComponent(pickup)}&destination=${encodeURIComponent(drop)}`)
      .then(res => res.json())
      .then(data => {
        setLoading(false);
        if (data && Array.isArray(data.results)) {
          setResults(data.results);
        }
      })
      .catch(() => setLoading(false));
  };

  return (
    <div className="space-y-6 text-black font-sans">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-900/60 p-4 rounded-2xl border border-slate-800/80">
        <div className="space-y-1.5 relative">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Pickup Address</span>
          <input 
            type="text" 
            value={pickup} 
            placeholder="e.g. Airport Terminal"
            onChange={(e) => {
              setPickup(e.target.value);
              setShowPickupSuggestions(true);
            }} 
            onFocus={() => setShowPickupSuggestions(true)}
            onBlur={() => setTimeout(() => setShowPickupSuggestions(false), 200)}
            className="w-full bg-[#0e1628] border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white font-bold outline-none" 
          />
          {showPickupSuggestions && (
            <div className="absolute left-0 right-0 top-[65px] bg-white border-3 border-black rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] z-50 overflow-y-auto max-h-48 text-black font-sans">
              {POPULAR_DESTINATIONS.filter(dest => dest.toLowerCase().includes(pickup.toLowerCase()))
                .map((dest, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onMouseDown={() => {
                      setPickup(dest);
                      setShowPickupSuggestions(false);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-yellow-300 transition-colors font-bold text-xs border-b border-slate-100 last:border-0 cursor-pointer"
                  >
                    {dest}
                  </button>
                ))}
            </div>
          )}
        </div>
        <div className="space-y-1.5 relative">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Drop Address</span>
          <input 
            type="text" 
            value={drop} 
            placeholder="e.g. Taj Mahal Hotel"
            onChange={(e) => {
              setDrop(e.target.value);
              setShowDropSuggestions(true);
            }} 
            onFocus={() => setShowDropSuggestions(true)}
            onBlur={() => setTimeout(() => setShowDropSuggestions(false), 200)}
            className="w-full bg-[#0e1628] border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white font-bold outline-none" 
          />
          {showDropSuggestions && (
            <div className="absolute left-0 right-0 top-[65px] bg-white border-3 border-black rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] z-50 overflow-y-auto max-h-48 text-black font-sans">
              {POPULAR_DESTINATIONS.filter(dest => dest.toLowerCase().includes(drop.toLowerCase()))
                .map((dest, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onMouseDown={() => {
                      setDrop(dest);
                      setShowDropSuggestions(false);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-yellow-300 transition-colors font-bold text-xs border-b border-slate-100 last:border-0 cursor-pointer"
                  >
                    {dest}
                  </button>
                ))}
            </div>
          )}
        </div>
        <div className="space-y-1.5">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Date & Time</span>
          <input type="datetime-local" defaultValue="2026-12-15T10:00" className="w-full bg-[#0e1628] border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white font-bold outline-none" />
        </div>
        <div className="flex items-end">
          <button onClick={handleSearch} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-sm py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer">
            <Search size={14} /> Estimate Cab
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-6 text-slate-400 text-xs">Computing fuel tolls & routes...</div>
      ) : results.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
          {results.map((c, i) => (
            <div key={i} className="bg-white border-3 border-black p-4 rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col justify-between gap-3 text-black">
              <div onClick={() => onDetailClick("cabs", c)} className="cursor-pointer">
                <CardThumbnail ownerType="vehicle" ownerId={c.provider} blurHash={c.blur_hash_base64} defaultUrl={c.primary_photo_url} />
                <div className="mt-2">
                  <span className="text-[8px] bg-amber-100 text-amber-800 font-black px-1.5 py-0.5 rounded border border-amber-200 uppercase">Live GPS Enabled</span>
                  <h4 className="font-extrabold text-base mt-1 text-black">{c.provider}</h4>
                  <p className="text-xs text-slate-500 mt-1">Vehicle Class: {c.type} | Pickup ETA: {c.eta_minutes} mins</p>
                  <p className="text-[9px] text-slate-400 mt-2">*Includes toll taxes & state permissions.</p>
                </div>
                <span className="text-[10px] text-blue-600 font-bold block mt-1 hover:underline">View driver reviews & fuel details ➔</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                <div>
                  <span className="text-[8px] text-slate-400 block uppercase font-bold">Estimated Fare</span>
                  <span className="font-black text-red-500 text-sm">₹{c.price.toLocaleString()}</span>
                </div>
                <button 
                  onClick={() => onBook({
                    vertical: "cabs",
                    amount: c.price,
                    details: {
                      provider_name: c.provider,
                      cab_type: c.type,
                      pickup_address: pickup,
                      drop_address: drop
                    },
                    title: `${c.provider} (${c.type})`,
                    subtitle: `${pickup} ➔ ${drop}`
                  })}
                  className="bg-yellow-300 text-xs font-black px-4 py-2 border-2 border-black rounded-lg shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-yellow-400 transition-all uppercase"
                >
                  Book Cab
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ToursSearchForm({ onBook, onDetailClick }: { onBook: (data: any) => void, onDetailClick: (vert: string, item: any) => void }) {
  const [destination, setDestination] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useTabLoading('tours');

  const handleSearch = () => {
    setLoading(true);
    setResults([]);
    fetch(`http://localhost:8000/api/v1/search?vertical=tours&destination=${encodeURIComponent(destination)}`)
      .then(res => res.json())
      .then(data => {
        setLoading(false);
        if (data && Array.isArray(data.results)) {
          setResults(data.results);
        }
      })
      .catch(() => setLoading(false));
  };

  return (
    <div className="space-y-6 text-black font-sans">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-900/60 p-4 rounded-2xl border border-slate-800/80">
        <div className="space-y-1.5 md:col-span-2 relative">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Destination</span>
          <input 
            type="text" 
            value={destination} 
            placeholder="e.g. Goa"
            onChange={(e) => {
              setDestination(e.target.value);
              setShowSuggestions(true);
            }} 
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            className="w-full bg-[#0e1628] border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white font-bold outline-none" 
          />
          {showSuggestions && (
            <div className="absolute left-0 right-0 top-[65px] bg-white border-3 border-black rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] z-50 overflow-y-auto max-h-48 text-black font-sans">
              {POPULAR_DESTINATIONS.filter(dest => dest.toLowerCase().includes(destination.toLowerCase()))
                .map((dest, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onMouseDown={() => {
                      setDestination(dest);
                      setShowSuggestions(false);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-yellow-300 transition-colors font-bold text-xs border-b border-slate-100 last:border-0 cursor-pointer"
                  >
                    {dest}
                  </button>
                ))}
            </div>
          )}
        </div>
        <div className="space-y-1.5">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Category</span>
          <select className="w-full bg-[#0e1628] border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white font-bold outline-none">
            <option>Adventure</option>
            <option>Cultural Walk</option>
            <option>Food Tour</option>
          </select>
        </div>
        <div className="flex items-end">
          <button onClick={handleSearch} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-sm py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer">
            <Search size={14} /> Search Activities
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-6 text-slate-400 text-xs">Connecting with Local Guide Agents...</div>
      ) : results.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
          {results.map((a, i) => (
            <div key={i} className="bg-white border-3 border-black p-4 rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col justify-between gap-3 text-black">
              <div onClick={() => onDetailClick("tours", a)} className="cursor-pointer">
                <CardThumbnail ownerType="tour" ownerId={a.name} blurHash={a.blur_hash_base64} defaultUrl={a.primary_photo_url} />
                <div className="mt-2">
                  <span className="text-[8px] bg-red-100 text-red-600 font-black px-1.5 py-0.5 rounded border border-red-200 uppercase">Same-Day Cutoff</span>
                  <h4 className="font-extrabold text-base mt-1 text-black">{a.name}</h4>
                  <p className="text-xs text-slate-500 mt-1">{a.details}</p>
                  <div className="flex gap-4 mt-2 text-[10px] text-slate-600 font-bold">
                    <span>⏱️ Duration: {a.duration}</span>
                    <span>🏷️ Category: {a.category}</span>
                  </div>
                </div>
                <span className="text-[10px] text-blue-600 font-bold block mt-2 hover:underline">View itinerary details & guide reviews ➔</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                <div>
                  <span className="text-[8px] text-slate-400 block uppercase font-bold">Ticket price</span>
                  <span className="font-black text-red-500 text-sm">₹{a.price.toLocaleString()}</span>
                </div>
                <button 
                  onClick={() => onBook({
                    vertical: "tours",
                    amount: a.price,
                    details: {
                      activity_name: a.name,
                      location: destination,
                      ticket_count: 2
                    },
                    title: a.name,
                    subtitle: `Tours & Attractions | Loc: ${destination}`
                  })}
                  className="bg-yellow-300 text-xs font-black px-4 py-2 border-2 border-black rounded-lg shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-yellow-400 transition-all uppercase"
                >
                  Book Activity
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function VisaSearchForm({ onBook, onDetailClick }: { onBook: (data: any) => void, onDetailClick: (vert: string, item: any) => void }) {
  const [country, setCountry] = useState("France");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useTabLoading('visa');
  const [rules, setRules] = useState<any | null>(null);

  const handleQueryVisa = () => {
    setLoading(true);
    setRules(null);
    fetch(`http://localhost:8000/api/v1/search?vertical=visa&destination=${encodeURIComponent(country)}`)
      .then(res => res.json())
      .then(data => {
        setLoading(false);
        if (data && data.requirements) {
          setRules(data.requirements);
        }
      })
      .catch(() => setLoading(false));
  };

  return (
    <div className="space-y-6 text-black font-sans">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-900/60 p-4 rounded-2xl border border-slate-800/80">
        <div className="space-y-1.5 md:col-span-2 relative">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Destination Country</span>
          <input 
            type="text" 
            value={country} 
            placeholder="e.g. France"
            onChange={(e) => {
              setCountry(e.target.value);
              setShowSuggestions(true);
            }} 
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            className="w-full bg-[#0e1628] border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white font-bold outline-none" 
          />
          {showSuggestions && (
            <div className="absolute left-0 right-0 top-[65px] bg-white border-3 border-black rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] z-50 overflow-y-auto max-h-48 text-black font-sans">
              {["France", "Thailand", "United States", "United Kingdom", "Singapore", "United Arab Emirates"].filter(c => c.toLowerCase().includes(country.toLowerCase()))
                .map((c, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onMouseDown={() => {
                      setCountry(c);
                      setShowSuggestions(false);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-yellow-300 transition-colors font-bold text-xs border-b border-slate-100 last:border-0 cursor-pointer"
                  >
                    {c}
                  </button>
                ))}
            </div>
          )}
        </div>
        <div className="space-y-1.5">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Nationality</span>
          <input type="text" defaultValue="Indian" disabled className="w-full bg-[#0e1628] disabled:opacity-40 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white font-bold outline-none" />
        </div>
        <div className="flex items-end">
          <button onClick={handleQueryVisa} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-sm py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer">
            <Search size={14} /> Query RAG Guidelines
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-6 text-slate-400 text-xs">Consulting Visa RAG Agent databases...</div>
      ) : rules && (
        <div className="bg-white border-3 border-black p-6 rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] space-y-4 text-black text-left">
          <div onClick={() => onDetailClick("visa", { name: `Visa Application: ${rules.country}`, details: rules.rules })} className="cursor-pointer">
            <div className="border-b-2 border-slate-200 pb-2">
              <span className="text-[8px] bg-red-100 text-red-600 font-black px-1.5 py-0.5 rounded border border-red-200 uppercase">Visa Guidelines</span>
              <h4 className="font-extrabold text-lg mt-1 text-black">Official Requirements: {rules.country}</h4>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed font-bold mt-2">{rules.rules}</p>
            <span className="text-[10px] text-blue-600 font-bold block mt-2 hover:underline">Select interview slots & upload docs ➔</span>
          </div>
          
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-black text-slate-400 block">Document Checklist:</span>
            <ul className="list-disc pl-5 text-xs text-slate-600 font-bold space-y-1">
              {rules.checklist.map((item: string, i: number) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="bg-red-50 p-2.5 border-2 border-red-200 text-[10px] text-red-700 font-bold">
            ⚠️ DISCLAIMER: Document rules are subject to diplomatic updates. Not official legal advice.
          </div>

          <div className="flex justify-between items-center pt-2 border-t border-slate-100">
            <div>
              <span className="text-[8px] text-slate-400 block uppercase font-bold">Embassy Filing Fee</span>
              <span className="font-black text-red-500 text-base">₹7,800</span>
            </div>
            <button 
              onClick={() => onBook({
                vertical: "visa",
                amount: 7800,
                details: {
                  country: rules.country,
                  visa_type: "Tourist",
                  applicant: { name: "Guest Traveler", passport: "Z998271" }
                },
                title: `Visa Application: ${rules.country}`,
                subtitle: `Filing Embassy Processing Slot`
              })}
              className="bg-yellow-300 text-xs font-black px-5 py-2 border-2 border-black rounded-lg shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:bg-yellow-400 transition-all uppercase"
            >
              Submit Application & Book Slot
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function CruisesSearchForm({ onBook, onDetailClick }: { onBook: (data: any) => void, onDetailClick: (vert: string, item: any) => void }) {
  const [port, setPort] = useState("Singapore");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useTabLoading('cruises');

  const handleSearch = () => {
    setLoading(true);
    setResults([]);
    fetch(`http://localhost:8000/api/v1/search?vertical=cruises&origin=${encodeURIComponent(port)}`)
      .then(res => res.json())
      .then(data => {
        setLoading(false);
        if (data && Array.isArray(data.results)) {
          setResults(data.results);
        }
      })
      .catch(() => setLoading(false));
  };

  return (
    <div className="space-y-6 text-black font-sans">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-900/60 p-4 rounded-2xl border border-slate-800/80">
        <div className="space-y-1.5 md:col-span-2 relative">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Departure Port</span>
          <input 
            type="text" 
            value={port} 
            onChange={(e) => {
              setPort(e.target.value);
              setShowSuggestions(true);
            }} 
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            className="w-full bg-[#0e1628] border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white font-bold outline-none" 
          />
          {showSuggestions && (
            <div className="absolute left-0 right-0 top-[65px] bg-white border-3 border-black rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] z-50 overflow-y-auto max-h-48 text-black font-sans">
              {["Singapore", "Mumbai", "Chennai", "Kochi", "Athens", "Barcelona"].filter(p => p.toLowerCase().includes(port.toLowerCase()))
                .map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onMouseDown={() => {
                      setPort(p);
                      setShowSuggestions(false);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-yellow-300 transition-colors font-bold text-xs border-b border-slate-100 last:border-0 cursor-pointer"
                  >
                    {p}
                  </button>
                ))}
            </div>
          )}
        </div>
        <div className="space-y-1.5">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Cabin Type</span>
          <select className="w-full bg-[#0e1628] border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white font-bold outline-none">
            <option>Balcony Suite</option>
            <option>Ocean View</option>
            <option>Interior Cabin</option>
          </select>
        </div>
        <div className="flex items-end">
          <button onClick={handleSearch} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-sm py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer">
            <Search size={14} /> Search Cruises
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-6 text-slate-400 text-xs">Consulting ocean cruiser bookings...</div>
      ) : results.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
          {results.map((c, i) => (
            <div key={i} className="bg-white border-3 border-black p-4 rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col justify-between gap-3 text-black">
              <div onClick={() => onDetailClick("cruises", c)} className="cursor-pointer">
                <CardThumbnail ownerType="cruise" ownerId={c.name} blurHash={c.blur_hash_base64} defaultUrl={c.primary_photo_url} />
                <div className="mt-2">
                  <span className="text-[8px] bg-blue-100 text-blue-600 font-extrabold px-1.5 py-0.5 rounded border border-blue-200 uppercase">{c.duration_days} Days Cruise</span>
                  <h4 className="font-extrabold text-base mt-1 text-black">{c.name}</h4>
                  <p className="text-xs text-slate-500 mt-1">Line: {c.cruise_line} | Cabin: {c.cabin_type}</p>
                  <p className="text-[10px] text-slate-600 mt-2 font-bold">🚢 Sails from: {c.departure_port}</p>
                </div>
                <span className="text-[10px] text-blue-600 font-bold block mt-2 hover:underline">View cruise itinerary & deck options ➔</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                <div>
                  <span className="text-[8px] text-slate-400 block uppercase font-bold">Total price</span>
                  <span className="font-black text-red-500 text-sm">₹{c.price.toLocaleString()}</span>
                </div>
                <button 
                  onClick={() => onBook({
                    vertical: "cruises",
                    amount: c.price,
                    details: {
                      cruise_line: c.cruise_line,
                      ship_name: c.name,
                      departure_port: c.departure_port,
                      arrival_port: "Penang",
                      duration_days: c.duration_days,
                      cabin_number: "C-204"
                    },
                    title: c.name,
                    subtitle: `Line: ${c.cruise_line} | Cabin: ${c.cabin_type}`
                  })}
                  className="bg-yellow-300 text-xs font-black px-4 py-2 border-2 border-black rounded-lg shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-yellow-400 transition-all uppercase"
                >
                  Book Cabin
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ForexSearchForm({ onBook, onDetailClick }: { onBook: (data: any) => void, onDetailClick: (vert: string, item: any) => void }) {
  const [currencyPair, setCurrencyPair] = useState("USD_INR");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [amount, setAmount] = useState("1000");
  const [mode, setMode] = useState("Home Delivery");
  const [rateInfo, setRateInfo] = useState<any | null>(null);
  const [kycUploaded, setKycUploaded] = useState(false);
  const [uploadingKyc, setUploadingKyc] = useState(false);

  const handleRateLookup = () => {
    fetch(`http://localhost:8000/api/v1/search?vertical=forex`)
      .then(res => res.json())
      .then(data => {
        setRateInfo(data);
      });
  };

  useEffect(() => {
    handleRateLookup();
  }, [currencyPair]);

  const handleUploadKyc = () => {
    setUploadingKyc(true);
    setTimeout(() => {
      setUploadingKyc(false);
      setKycUploaded(true);
      alert("Aadhar Card KYC Verification Uploaded & Approved!");
    }, 1500);
  };

  const currentRate = currencyPair === "USD_INR" ? 84.50 : currencyPair === "EUR_INR" ? 91.80 : 107.20;
  const convertedInr = parseFloat(amount) * currentRate || 0;

  return (
    <div className="space-y-6 text-black font-sans">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-900/60 p-4 rounded-2xl border border-slate-800/80">
        <div className="space-y-1.5 relative">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Currency Pair</span>
          <input 
            type="text" 
            value={currencyPair} 
            onChange={(e) => {
              setCurrencyPair(e.target.value);
              setShowSuggestions(true);
            }} 
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            className="w-full bg-[#0e1628] border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white font-bold outline-none" 
          />
          {showSuggestions && (
            <div className="absolute left-0 right-0 top-[65px] bg-white border-3 border-black rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] z-50 overflow-y-auto max-h-48 text-black font-sans">
              {["USD_INR", "EUR_INR", "GBP_INR", "SGD_INR", "AED_INR"].filter(pair => pair.toLowerCase().includes(currencyPair.toLowerCase()))
                .map((pair, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onMouseDown={() => {
                      setCurrencyPair(pair);
                      setShowSuggestions(false);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-yellow-300 transition-colors font-bold text-xs border-b border-slate-100 last:border-0 cursor-pointer"
                  >
                    {pair.replace("_", " ➔ ")}
                  </button>
                ))}
            </div>
          )}
        </div>
        <div className="space-y-1.5">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Foreign Amount</span>
          <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full bg-[#0e1628] border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white font-bold outline-none" />
        </div>
        <div className="space-y-1.5">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Delivery Mode</span>
          <select value={mode} onChange={(e) => setMode(e.target.value)} className="w-full bg-[#0e1628] border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white font-bold outline-none">
            <option value="Home Delivery">Home Delivery</option>
            <option value="Branch Pickup">Branch Pickup</option>
          </select>
        </div>
        <div className="flex items-end">
          <button onClick={handleRateLookup} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-sm py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer">
            <Search size={14} /> Search Rates
          </button>
        </div>
      </div>

      {rateInfo && (
        <div className="bg-white border-3 border-black p-5 rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] space-y-4 text-black text-left">
          <div onClick={() => onDetailClick("forex", { name: `Forex Card: ${currencyPair.replace("_", " ➔ ")}`, price: convertedInr, details: `Exchange Rate Live-Locked at 1 USD = ${currentRate} INR` })} className="cursor-pointer">
            <div className="flex justify-between items-center border-b-2 border-slate-100 pb-2">
              <div>
                <span className="text-[8px] bg-emerald-100 text-emerald-800 font-black px-1.5 py-0.5 rounded border border-emerald-200 uppercase">Rate Locked for 10m</span>
                <h4 className="font-extrabold text-base mt-1 text-black">Order Conversion Estimate:</h4>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-400 block font-bold">Exchange Rate</span>
                <span className="font-black text-emerald-600 text-lg">1 Forex = ₹{currentRate}</span>
              </div>
            </div>
            <span className="text-[10px] text-blue-600 font-bold block mt-1 hover:underline">Recalculate conversion & select delivery address ➔</span>
          </div>

          <div className="flex justify-between items-center text-xs font-black bg-slate-50 p-3 border-2 border-black rounded-lg">
            <span>You will pay (INR):</span>
            <span className="text-red-500 text-sm">₹{convertedInr.toLocaleString()}</span>
          </div>

          {!kycUploaded ? (
            <div className="bg-amber-50 border-2 border-amber-300 p-4 rounded-xl flex justify-between items-center gap-2">
              <div>
                <span className="text-[10px] uppercase font-black text-amber-800 block text-left">Regulatory KYC Gate</span>
                <p className="text-[10px] text-slate-600 font-bold text-left">Government guidelines require Aadhar/PAN verification for Forex Card purchases.</p>
              </div>
              <button 
                onClick={handleUploadKyc}
                disabled={uploadingKyc}
                className="bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-black px-3 py-1.5 rounded border border-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] whitespace-nowrap active:translate-y-0.5"
              >
                {uploadingKyc ? "Uploading..." : "Upload Identity"}
              </button>
            </div>
          ) : (
            <div className="bg-emerald-50 border-2 border-emerald-300 p-3 rounded-xl text-[10px] text-emerald-800 font-bold flex items-center gap-1.5">
              <CheckCircle size={14} /> KYC Verification approved. Rate lock guaranteed.
            </div>
          )}

          <div className="flex justify-end pt-2 border-t border-slate-100">
            <button 
              disabled={!kycUploaded}
              onClick={() => onBook({
                vertical: "forex",
                amount: convertedInr,
                details: {
                  currency_pair: currencyPair,
                  amount: parseFloat(amount),
                  rate_locked_at_order: currentRate,
                  delivery_mode: mode,
                  kyc_ref: "KYC-AADHAR-82192"
                },
                title: `Forex Card: ${currencyPair.replace("_", " ➔ ")}`,
                subtitle: `Amount: ${amount} Forex | Rate: ${currentRate} | Mode: ${mode}`
              })}
              className={`text-xs font-black px-6 py-2.5 border-3 border-black rounded-lg shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:translate-y-0.5 active:shadow-none transition-all uppercase ${
                kycUploaded ? 'bg-yellow-300 hover:bg-yellow-400' : 'bg-slate-200 text-slate-400 cursor-not-allowed border-slate-300 shadow-none'
              }`}
            >
              Order Forex Card
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function InsuranceSearchForm({ onBook, onDetailClick }: { onBook: (data: any) => void, onDetailClick: (vert: string, item: any) => void }) {
  const [destination, setDestination] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useTabLoading('forex');

  const handleSearch = () => {
    setLoading(true);
    setResults([]);
    fetch(`http://localhost:8000/api/v1/search?vertical=insurance&destination=${encodeURIComponent(destination)}`)
      .then(res => res.json())
      .then(data => {
        setLoading(false);
        if (data && Array.isArray(data.results)) {
          setResults(data.results);
        }
      })
      .catch(() => setLoading(false));
  };

  return (
    <div className="space-y-6 text-black font-sans">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-900/60 p-4 rounded-2xl border border-slate-800/80">
        <div className="space-y-1.5 md:col-span-2 relative">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Destination</span>
          <input 
            type="text" 
            value={destination} 
            onChange={(e) => {
              setDestination(e.target.value);
              setShowSuggestions(true);
            }} 
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            className="w-full bg-[#0e1628] border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white font-bold outline-none" 
          />
          {showSuggestions && (
            <div className="absolute left-0 right-0 top-[65px] bg-white border-3 border-black rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] z-50 overflow-y-auto max-h-48 text-black font-sans">
              {POPULAR_DESTINATIONS.filter(dest => dest.toLowerCase().includes(destination.toLowerCase()))
                .map((dest, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onMouseDown={() => {
                      setDestination(dest);
                      setShowSuggestions(false);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-yellow-300 transition-colors font-bold text-xs border-b border-slate-100 last:border-0 cursor-pointer"
                  >
                    {dest}
                  </button>
                ))}
            </div>
          )}
        </div>
        <div className="space-y-1.5">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Traveller Age</span>
          <input type="number" defaultValue="30" className="w-full bg-[#0e1628] border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white font-bold outline-none" />
        </div>
        <div className="flex items-end">
          <button onClick={handleSearch} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-sm py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer">
            <Search size={14} /> Compare Plans
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-6 text-slate-400 text-xs">Running coverage risk premium calculations...</div>
      ) : results.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
          {results.map((i, idx) => (
            <div key={idx} className="bg-white border-3 border-black p-4 rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col justify-between gap-3 text-black">
              <div onClick={() => onDetailClick("insurance", i)} className="cursor-pointer">
                <span className="text-[8px] bg-red-100 text-red-600 font-extrabold px-1.5 py-0.5 rounded border border-red-200 uppercase">Coverage Limit: ₹{(i.coverage_amount/100000).toLocaleString()} Lakhs</span>
                <h4 className="font-extrabold text-base mt-1 text-black">{i.policy_name}</h4>
                <p className="text-xs text-slate-500 mt-1">Provider: {i.provider_name}</p>
                <p className="text-[10px] text-slate-600 mt-2 font-bold">📄 Inclusions: {i.details}</p>
                <span className="text-[10px] text-blue-600 font-bold block mt-2 hover:underline">Compare coverage tiers & calculate premium ➔</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                <div>
                  <span className="text-[8px] text-slate-400 block uppercase font-bold">Premium Rate</span>
                  <span className="font-black text-red-500 text-sm">₹{i.price.toLocaleString()}</span>
                </div>
                <button 
                  onClick={() => onBook({
                    vertical: "insurance",
                    amount: i.price,
                    details: {
                      provider_name: i.provider_name,
                      policy_name: i.policy_name,
                      coverage_details: { limit: i.coverage_amount, inclusions: i.details }
                    },
                    title: i.policy_name,
                    subtitle: `Provider: ${i.provider_name} | Coverage: ₹${(i.coverage_amount/100000).toLocaleString()}L`
                  })}
                  className="bg-yellow-300 text-xs font-black px-4 py-2 border-2 border-black rounded-lg shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-yellow-400 transition-all uppercase"
                >
                  Buy Policy
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------- */
/* 4.5 CHECKOUT MODAL & TRIP DASHBOARD SUB-COMPONENTS   */
/* ---------------------------------------------------- */

function CheckoutModal({ data, onClose, userProfile, onConfirm }: { data: any, onClose: () => void, userProfile: any, onConfirm: (payMethod: string) => void }) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [payMethod, setPayMethod] = useState<'wallet' | 'card' | 'split' | 'corporate_billing'>('wallet');
  const [gateway, setGateway] = useState<'stripe' | 'razorpay'>('stripe');
  
  // Card Inputs
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  
  // Sandbox Simulations
  const [bypassTokenization, setBypassTokenization] = useState(false);
  const [simulate3DS, setSimulate3DS] = useState(false);
  const [simulateFraudBlock, setSimulateFraudBlock] = useState(false);
  const [simulateFraudReview, setSimulateFraudReview] = useState(false);
  
  // 3DS and DCC states
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);
  const [showDccConfirm, setShowDccConfirm] = useState(false);
  const [dccData, setDccData] = useState<any>(null);
  
  const [loading, setLoading] = useTabLoading('insurance');
  const [error, setError] = useState("");
  const [travelerName, setTravelerName] = useState("Guest Traveler");
  const [travelerAge, setTravelerAge] = useState("30");
  const [travelerEmail, setTravelerEmail] = useState("guest@travelos.com");
  const [travelerPhone, setTravelerPhone] = useState("+91 98765 43210");
  const [cardHolderName, setCardHolderName] = useState("Guest Traveler");
  const [cardIssuingBank, setCardIssuingBank] = useState("HDFC Bank");
  const [isStudent, setIsStudent] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [discountAmount, setDiscountAmount] = useState(0);
  const [promoStatus, setPromoStatus] = useState("");
  const [bookingRef, setBookingRef] = useState("");
  const [invoiceText, setInvoiceText] = useState("");
  const [timeLeft, setTimeLeft] = useState(300);

  useEffect(() => {
    if (step === 3) return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          alert("Inventory HOLD time has expired. Please search again.");
          onClose();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [step]);

  // Iframe 3DS Message handler (Module 1)
  useEffect(() => {
    const handle3DSMessage = (e: MessageEvent) => {
      if (e.data === "3ds_success") {
        alert("3D Secure 2FA validation completed successfully!");
        setRedirectUrl(null);
        setStep(3);
        onConfirm(payMethod);
        
        // Fetch invoice
        if (bookingRef) {
          fetch(`http://localhost:8000/api/v1/bookings/${bookingRef}/invoice?vertical=${data.vertical}`)
            .then(r => r.json())
            .then(inv => setInvoiceText(inv.invoice_text))
            .catch(() => {});
        }
      }
    };
    window.addEventListener("message", handle3DSMessage);
    return () => window.removeEventListener("message", handle3DSMessage);
  }, [bookingRef, payMethod]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleApplyPromo = () => {
    const code = promoCode.trim().toUpperCase();
    if (code === "FLYFAST" || code === "FLYING") {
      setDiscountAmount(1200);
      setPromoStatus("Code applied: Flat ₹1,200 discount!");
    } else if (code === "LUXSTAYS" || code === "HOTEL20") {
      setDiscountAmount(2500);
      setPromoStatus("Code applied: Flat ₹2,500 luxury discount!");
    } else {
      setPromoStatus("Invalid promo code.");
      setDiscountAmount(0);
    }
  };

  const executeCheckout = (holdReference: string, finalPayVal: number) => {
    // Generate simulated payment token
    let token = "tok_visa";
    if (simulateFraudBlock) token = "tok_fraud";
    else if (simulateFraudReview) token = "tok_review";
    else if (simulate3DS || finalPayVal >= 10000) token = "tok_3ds"; // Autotrigger 3DS for >= 10k or flag
    
    // If raw credentials override enabled, send actual raw card number (to trigger PCI reject tests)
    if (bypassTokenization) {
      token = cardNumber || "4242-invalid-raw";
    }

    fetch(`http://localhost:8000/api/v1/payments/checkout`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        booking_reference: holdReference,
        vertical: data.vertical,
        payment_method: payMethod,
        payment_token: token,
        gateway: gateway,
        currency: "INR",
        idempotency_key: `ik_${holdReference}`,
        cardholder_name: cardHolderName,
        issuing_bank: cardIssuingBank,
        email: travelerEmail,
        phone: travelerPhone
      })
    })
      .then(res => res.json())
      .then(checkoutRes => {
        if (checkoutRes.status === "requires_action" && checkoutRes.action_type === "3ds_redirect") {
          // Open 3DS challenge frame
          setBookingRef(holdReference);
          setRedirectUrl(checkoutRes.redirect_url);
          setLoading(false);
        } else if (checkoutRes.status === "review") {
          setLoading(false);
          onClose();
          setTimeout(() => {
            alert(checkoutRes.message || "Hold authorized. Security check clearance pending review.");
          }, 100);
        } else if (checkoutRes.success) {
          setBookingRef(holdReference);
          setStep(3);
          onConfirm(payMethod);
          fetch(`http://localhost:8000/api/v1/bookings/${holdReference}/invoice?vertical=${data.vertical}`)
            .then(r => r.json())
            .then(inv => {
              setInvoiceText(inv.invoice_text);
              setLoading(false);
            })
            .catch(() => setLoading(false));
        } else {
          setError(checkoutRes.detail || "Transaction failed. Please try again.");
          setLoading(false);
        }
      })
      .catch(() => {
        setError("Checkout connection error.");
        setLoading(false);
      });
  };

  const executeBooking = () => {
    setLoading(true);
    setError("");

    const finalPayVal = Math.max(100, data.amount - discountAmount);

    // DCC Check for Razorpay (Module 1)
    if (gateway === "razorpay" && !showDccConfirm && !showDccConfirm) {
      // If we are in non-INR workspace setting
      // Alert/confirm DCC conversion before charging
      setDccData({
        amount: finalPayVal,
        converted: finalPayVal,
        rate: 1.0,
      });
      setShowDccConfirm(true);
      setLoading(false);
      return;
    }

    // 1. Create Hold Reservation
    fetch(`http://localhost:8000/api/v1/bookings/hold`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vertical: data.vertical,
        amount: finalPayVal,
        user_id: 1,
        details: {
          ...data.details,
          traveler: { 
            name: travelerName, 
            age: travelerAge, 
            is_student: isStudent,
            email: travelerEmail,
            phone: travelerPhone
          }
        }
      })
    })
      .then(res => res.json())
      .then(holdRes => {
        if (!holdRes.booking_reference) {
          setError(holdRes.detail || "Failed to hold inventory.");
          setLoading(false);
          return;
        }

        // If it's a corporate limit exceed holding, it returns PENDING_APPROVAL status directly
        if (holdRes.status === "pending_approval") {
          alert(holdRes.message || "myBiz Limit Exceeded: booking routed to manager queue.");
          onClose();
          return;
        }

        // 2. Clear payment
        executeCheckout(holdRes.booking_reference, finalPayVal);
      })
      .catch(() => {
        setError("Hold connection error.");
        setLoading(false);
      });
  };

  const finalAmount = Math.max(100, data.amount - discountAmount);

  // If 3DS redirection active, serve iframe viewport
  if (redirectUrl) {
    return (
      <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
        <div className="bg-[#0d1527] border-4 border-black rounded-3xl max-w-lg w-full p-4 space-y-4 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
          <div className="flex justify-between items-center text-slate-400">
            <span className="text-xs font-bold font-mono">🔐 3DS Gateway Redirect</span>
            <button onClick={() => setRedirectUrl(null)} className="text-white font-bold">✕ Cancel</button>
          </div>
          <div className="w-full h-[450px] bg-slate-900 rounded-xl overflow-hidden border border-slate-800">
            <iframe src={redirectUrl} className="w-full h-full border-none" title="3DS OTP Verification"></iframe>
          </div>
          <p className="text-[10px] text-slate-500 text-center">Complete the 2FA bank challenge inside the frame above to authorize transaction.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white border-4 border-black p-6 max-w-lg w-full space-y-4 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] text-black rounded-2xl relative">
        
        {/* Hold Countdown timer */}
        {step < 3 && (
          <div className="absolute top-4 right-12 bg-red-100 border-2 border-red-600 px-2 py-0.5 rounded text-xs font-black text-red-600 animate-pulse">
            ⏰ HOLD TIMER: {formatTime(timeLeft)}
          </div>
        )}

        <div className="flex justify-between items-center border-b-3 border-black pb-2 text-left">
          <h3 className="font-black text-xl italic uppercase tracking-wider">
            {step === 1 && "Step 1: Review Itinerary"}
            {step === 2 && "Step 2: Secure Checkout"}
            {step === 3 && "Step 3: Booking Confirmed!"}
          </h3>
          <button onClick={onClose} className="font-extrabold text-sm hover:text-red-500 font-bold cursor-pointer">✕</button>
        </div>

        {step === 1 && (
          <div className="space-y-4 text-left">
            <div className="bg-[#eae5d9] p-3 border-3 border-black rounded-lg space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-600">Category: {data.vertical.toUpperCase()}</span>
              <h4 className="font-black text-base">{data.title}</h4>
              <p className="text-xs text-slate-600 font-semibold">{data.subtitle}</p>
            </div>

            {/* Traveler info forms */}
            <div className="border-3 border-black p-4 rounded-xl bg-slate-50 space-y-3">
              <span className="text-[10px] uppercase font-black tracking-wider block">Primary Passenger Details:</span>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="text-[9px] uppercase font-bold text-slate-500">Full Name</label>
                  <input type="text" value={travelerName} onChange={(e) => setTravelerName(e.target.value)} className="w-full bg-white border-2 border-black rounded px-2 py-1 text-xs font-bold" />
                </div>
                <div>
                  <label className="text-[9px] uppercase font-bold text-slate-500">Age</label>
                  <input type="number" value={travelerAge} onChange={(e) => setTravelerAge(e.target.value)} className="w-full bg-white border-2 border-black rounded px-2 py-1 text-xs font-bold" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] uppercase font-bold text-slate-500">Email Address (for 2FA & Tickets)</label>
                  <input type="email" value={travelerEmail} onChange={(e) => setTravelerEmail(e.target.value)} className="w-full bg-white border-2 border-black rounded px-2 py-1 text-xs font-bold" />
                </div>
                <div>
                  <label className="text-[9px] uppercase font-bold text-slate-500">Phone Number (SMS Alerts)</label>
                  <input type="text" value={travelerPhone} onChange={(e) => setTravelerPhone(e.target.value)} className="w-full bg-white border-2 border-black rounded px-2 py-1 text-xs font-bold" />
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                <input type="checkbox" checked={isStudent} onChange={() => setIsStudent(!isStudent)} className="accent-black rounded border-2" />
                Apply Student Special Fare (requires Student ID)
              </label>
            </div>

            <div className="flex justify-between items-center border-y-3 border-black py-2 font-bold">
              <span>Fare Sum:</span>
              <span className="font-black text-xl text-red-600">₹{data.amount.toLocaleString()}</span>
            </div>

            <button 
              onClick={() => setStep(2)}
              className="w-full bg-yellow-300 hover:bg-yellow-400 border-3 border-black font-black text-sm py-2.5 rounded-xl shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] cursor-pointer transition-all uppercase"
            >
              Continue to Payment ➔
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4 text-left max-h-[70vh] overflow-y-auto pr-1">
            {showDccConfirm ? (
              <div className="border-3 border-yellow-600 p-4 rounded-xl bg-yellow-50 space-y-3 text-xs">
                <span className="font-black text-yellow-800 uppercase block">Dynamic Currency Conversion (DCC)</span>
                <p>
                  Razorpay primarily processes charges in <strong>INR</strong>. Your checkout amount of ₹{dccData.amount} will be billed to your local source.
                </p>
                <button 
                  onClick={() => { setShowDccConfirm(false); executeBooking(); }}
                  className="w-full bg-yellow-400 border-2 border-black font-black py-2 rounded-lg text-[10px] uppercase cursor-pointer"
                >
                  Accept DCC & Pay
                </button>
              </div>
            ) : null}

            {/* Promo coupons verification */}
            <div className="border-3 border-black p-3 rounded-xl bg-blue-50 space-y-2">
              <span className="text-[10px] uppercase font-black tracking-wider block">Promo Coupon Discount:</span>
              <div className="flex gap-2">
                <input type="text" placeholder="FLYFAST, LUXSTAYS" value={promoCode} onChange={(e) => setPromoCode(e.target.value)} className="bg-white border-2 border-black rounded px-3 py-1 text-xs font-bold flex-1" />
                <button onClick={handleApplyPromo} className="bg-slate-900 text-white font-black text-[10px] px-3.5 py-1.5 rounded border-2 border-black cursor-pointer uppercase">Apply</button>
              </div>
              {promoStatus && <div className="text-[10px] font-bold text-blue-600">{promoStatus}</div>}
            </div>

            {/* Payment methods selectors */}
            <div className="space-y-2">
              <span className="text-[10px] uppercase font-black tracking-wider block">Select Payment Channel:</span>
              <div className="grid grid-cols-1 gap-2">
                <label className={`flex justify-between items-center p-3 border-2 border-black rounded-lg cursor-pointer ${payMethod === 'wallet' ? 'bg-yellow-300 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]' : 'bg-white'}`}>
                  <div className="flex items-center gap-2">
                    <input type="radio" checked={payMethod === 'wallet'} onChange={() => setPayMethod('wallet')} className="accent-black" />
                    <span className="font-black text-xs uppercase">Travel Wallet Only</span>
                  </div>
                  <span className="text-xs font-bold text-slate-700">Bal: ₹{userProfile.walletBalance.toLocaleString()}</span>
                </label>
                <label className={`flex justify-between items-center p-3 border-2 border-black rounded-lg cursor-pointer ${payMethod === 'card' ? 'bg-yellow-300 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]' : 'bg-white'}`}>
                  <div className="flex items-center gap-2">
                    <input type="radio" checked={payMethod === 'card'} onChange={() => setPayMethod('card')} className="accent-black" />
                    <span className="font-black text-xs uppercase">Credit / Debit Card</span>
                  </div>
                  <span className="text-xs font-bold text-slate-700">PCI Tokenized</span>
                </label>
                <label className={`flex justify-between items-center p-3 border-2 border-black rounded-lg cursor-pointer ${payMethod === 'split' ? 'bg-yellow-300 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]' : 'bg-white'}`}>
                  <div className="flex items-center gap-2">
                    <input type="radio" checked={payMethod === 'split'} onChange={() => setPayMethod('split')} className="accent-black" />
                    <span className="font-black text-xs uppercase">Split: Wallet + Card</span>
                  </div>
                  <span className="text-xs font-bold text-slate-700">Debit wallet first</span>
                </label>
                <label className={`flex justify-between items-center p-3 border-2 border-black rounded-lg cursor-pointer ${payMethod === 'corporate_billing' ? 'bg-yellow-300 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]' : 'bg-white'}`}>
                  <div className="flex items-center gap-2">
                    <input type="radio" checked={payMethod === 'corporate_billing'} onChange={() => setPayMethod('corporate_billing')} className="accent-black" />
                    <span className="font-black text-xs uppercase">myBiz Corporate Billing</span>
                  </div>
                  <span className="text-xs font-bold text-slate-700">Per Diem policy checks</span>
                </label>
              </div>
            </div>

            {/* Card fields panel if card selected */}
            {(payMethod === 'card' || payMethod === 'split') && (
              <div className="border-3 border-black p-4 rounded-xl bg-slate-50 space-y-3 text-xs">
                <div className="flex justify-between items-center border-b border-black pb-1.5 mb-1.5">
                  <span className="font-black uppercase tracking-wider text-[10px]">Secure Card Entry Fields</span>
                  <div className="flex gap-2">
                    <label className="flex items-center gap-1 font-bold"><input type="radio" checked={gateway === 'stripe'} onChange={() => setGateway('stripe')} /> Stripe</label>
                    <label className="flex items-center gap-1 font-bold"><input type="radio" checked={gateway === 'razorpay'} onChange={() => setGateway('razorpay')} /> Razorpay</label>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[9px] uppercase font-bold text-slate-500">Cardholder Name</label>
                      <input type="text" placeholder="John Doe" value={cardHolderName} onChange={(e) => setCardHolderName(e.target.value)} className="w-full bg-white border-2 border-black rounded px-2 py-1 text-xs font-bold" />
                    </div>
                    <div>
                      <label className="text-[9px] uppercase font-bold text-slate-500">Issuing Bank</label>
                      <select value={cardIssuingBank} onChange={(e) => setCardIssuingBank(e.target.value)} className="w-full bg-white border-2 border-black rounded px-2 py-1.5 text-xs font-bold">
                        <option value="HDFC Bank">HDFC Bank</option>
                        <option value="ICICI Bank">ICICI Bank</option>
                        <option value="State Bank of India">State Bank of India (SBI)</option>
                        <option value="Axis Bank">Axis Bank</option>
                        <option value="Citibank">Citibank</option>
                        <option value="HSBC Bank">HSBC Bank</option>
                        <option value="Other">Other Bank</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-[9px] uppercase font-bold text-slate-500">Card Number (PAN)</label>
                    <input type="text" placeholder="4242 4242 4242 4242" value={cardNumber} onChange={(e) => setCardNumber(e.target.value)} className="w-full bg-white border-2 border-black rounded px-2 py-1 text-xs font-bold" />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[9px] uppercase font-bold text-slate-500">Expiry MM/YY</label>
                      <input type="text" placeholder="12/30" value={cardExpiry} onChange={(e) => setCardExpiry(e.target.value)} className="w-full bg-white border-2 border-black rounded px-2 py-1 text-xs font-bold" />
                    </div>
                    <div>
                      <label className="text-[9px] uppercase font-bold text-slate-500">CVV</label>
                      <input type="password" placeholder="***" value={cardCvv} onChange={(e) => setCardCvv(e.target.value)} className="w-full bg-white border-2 border-black rounded px-2 py-1 text-xs font-bold" />
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 justify-center py-1.5 text-[9px] font-black text-slate-600 bg-slate-200 border-2 border-black rounded-lg">
                  <span>🔒 PCI-DSS Compliant • 256-Bit SSL Encrypted Connection</span>
                </div>

                {/* Sandbox simulation toggles */}
                <div className="pt-2 border-t border-slate-300 mt-2 space-y-1 bg-yellow-50 p-2 rounded">
                  <span className="font-bold text-[9px] uppercase text-yellow-800 block">Demoware Gateway Simulations:</span>
                  <label className="flex items-center gap-1.5 font-semibold text-[10px] cursor-pointer"><input type="checkbox" checked={simulate3DS} onChange={() => setSimulate3DS(!simulate3DS)} /> Force 3D Secure Step-Up 2FA</label>
                  <label className="flex items-center gap-1.5 font-semibold text-[10px] cursor-pointer"><input type="checkbox" checked={simulateFraudBlock} onChange={() => setSimulateFraudBlock(!simulateFraudBlock)} /> Simulate High Risk (Fraud Block)</label>
                  <label className="flex items-center gap-1.5 font-semibold text-[10px] cursor-pointer"><input type="checkbox" checked={simulateFraudReview} onChange={() => setSimulateFraudReview(!simulateFraudReview)} /> Simulate Suspicious (Fraud Hold Review)</label>
                  <label className="flex items-center gap-1.5 font-semibold text-[10px] text-rose-700 cursor-pointer"><input type="checkbox" checked={bypassTokenization} onChange={() => setBypassTokenization(!bypassTokenization)} /> Bypass frontend tokenization (PCI reject test)</label>
                </div>
              </div>
            )}

            <div className="flex justify-between items-center border-y-3 border-black py-2 font-bold bg-[#fcfcfc] px-2 rounded">
              <span>Final Paid Amount:</span>
              <div className="text-right">
                {discountAmount > 0 && <span className="text-[10px] text-slate-400 line-through block font-bold">₹{data.amount.toLocaleString()}</span>}
                <span className="font-black text-xl text-red-600">₹{finalAmount.toLocaleString()}</span>
              </div>
            </div>

            {error && <div className="text-xs text-red-600 font-bold border-2 border-red-600 p-2 bg-red-100">{error}</div>}

            <div className="flex gap-2">
              <button onClick={() => setStep(1)} className="bg-white border-2 border-black font-black text-xs px-4 py-2.5 rounded-lg cursor-pointer uppercase">Back</button>
              <button 
                disabled={loading}
                onClick={executeBooking}
                className="flex-1 bg-emerald-400 hover:bg-emerald-500 border-3 border-black font-black text-xs py-2.5 rounded-lg shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] cursor-pointer transition-all uppercase flex items-center justify-center gap-2"
              >
                {loading ? "Authorizing transaction..." : "Confirm & Pay Now"}
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4 text-center">
            <div className="w-12 h-12 bg-emerald-100 rounded-full border-2 border-emerald-600 flex items-center justify-center mx-auto text-emerald-600 font-black text-lg">
              ✓
            </div>
            <h4 className="font-black text-base text-emerald-600 uppercase tracking-wide">Reservation confirmed successfully!</h4>
            
            <div className="bg-[#eae5d9] p-4 border-3 border-black rounded-lg space-y-1 text-left">
              <div className="flex justify-between items-center border-b border-black/10 pb-1.5 mb-1.5">
                <span className="text-[10px] font-black uppercase text-slate-600">PNR Reference</span>
                <span className="text-xs font-black bg-slate-900 text-white px-2 py-0.5 rounded font-mono">{bookingRef}</span>
              </div>
              <h5 className="font-black text-sm">{data.title}</h5>
              <p className="text-xs text-slate-600 font-semibold">{data.subtitle}</p>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              {invoiceText && (
                <button 
                  onClick={() => {
                    const blob = new Blob([invoiceText], { type: "text/plain" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `Invoice_${bookingRef}.txt`;
                    a.click();
                  }}
                  className="w-full bg-white hover:bg-slate-100 border-2 border-black font-black py-2 rounded-lg text-xs uppercase cursor-pointer"
                >
                  Download Receipt Invoice
                </button>
              )}
              <button 
                onClick={() => alert("Event added to Google Calendar!")}
                className="w-full bg-blue-100 hover:bg-blue-200 border-2 border-black font-black py-2 rounded-lg text-xs uppercase cursor-pointer text-blue-900"
              >
                📅 Add trip to Google Calendar
              </button>
              <button 
                onClick={onClose}
                className="w-full bg-yellow-300 hover:bg-yellow-400 border-3 border-black font-black py-2.5 rounded-lg text-xs uppercase cursor-pointer shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-0.5 transition-all"
              >
                Proceed to Dashboard
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MyTripsView({ userProfile, setActiveTab, setPrefilledMessage }: { userProfile: any, setActiveTab: any, setPrefilledMessage?: any }) {
  const [trips, setTrips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [invoiceText, setInvoiceText] = useState<string | null>(null);
  const [selectedTrip, setSelectedTrip] = useState<any | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'all' | 'confirmed' | 'hold' | 'cancelled'>('all');
  const [cancelPreview, setCancelPreview] = useState<any | null>(null);
  const [loadingCancelPreview, setLoadingCancelPreview] = useState(false);
  const [deletedRefs, setDeletedRefs] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('user_deleted_bookings');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const fetchTrips = () => {
    setLoading(true);
    fetch(`http://localhost:8000/api/v1/bookings/user/1`)
      .then(res => res.json())
      .then(data => {
        setTrips(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchTrips();
  }, []);

  const handleCancelTrip = (ref: string, vertical: string) => {
    fetch(`http://localhost:8000/api/v1/bookings/cancel?booking_reference=${ref}&vertical=${vertical}&action_type=cancel`, {
      method: "POST"
    })
      .then(res => res.json())
      .then(data => {
        if (data.status === "cancelled" || data.status === "REFUNDED") {
          alert(`Booking Cancelled Successfully!\nRefunded Amount: ₹${data.refund_processed || data.amount || 0}\nCancellation Fee: ₹${data.cancellation_fee || 0}`);
          setSelectedTrip(null);
          setCancelPreview(null);
          fetchTrips();
        } else if (data.status === "PENDING_APPROVAL" || data.status === "cancellation_request_sent" || data.success === true) {
          alert("Cancellation request submitted! It requires admin approval and has been sent to the admin portal.");
          setSelectedTrip(null);
          setCancelPreview(null);
          fetchTrips();
        } else {
          alert(data.detail || data.message || "Cancellation failed.");
        }
      })
      .catch(() => alert("Cancellation error."));
  };

  const handleRequestRefund = (ref: string, vertical: string) => {
    fetch(`http://localhost:8000/api/v1/bookings/cancel?booking_reference=${ref}&vertical=${vertical}&action_type=refund`, {
      method: "POST"
    })
      .then(res => res.json())
      .then(data => {
        if (data.status === "PENDING_APPROVAL" || data.status === "refund_request_sent" || data.status === "cancelled" || data.status === "REFUNDED" || data.success === true) {
          alert("Refund request successfully submitted to the admin portal for approval!");
          setSelectedTrip(null);
          fetchTrips();
        } else {
          alert(data.detail || data.message || "Failed to submit refund request.");
        }
      })
      .catch(() => alert("Error requesting refund."));
  };

  const handleFetchCancelPreview = (ref: string, vertical: string) => {
    setLoadingCancelPreview(true);
    setTimeout(() => {
      setCancelPreview({
        refund_amount: 3200,
        cancellation_fee: 1000,
        policy_rules: "Standard cancellation policy applies. The refund will be credited back to your original source of payment within 3-5 business days."
      });
      setLoadingCancelPreview(false);
    }, 800);
  };

  const handleDownloadInvoice = (ref: string, vertical: string) => {
    fetch(`http://localhost:8000/api/v1/bookings/${ref}/invoice?vertical=${vertical}`)
      .then(res => res.json())
      .then(data => {
        setInvoiceText(data.invoice_text);
      })
      .catch(() => alert("Failed to fetch invoice."));
  };

  const handleDeleteBooking = (ref: string) => {
    if (window.confirm("Are you sure you want to delete this booking from your history?")) {
      const updated = [...deletedRefs, ref];
      setDeletedRefs(updated);
      localStorage.setItem('user_deleted_bookings', JSON.stringify(updated));
    }
  };

  const filtered = trips.filter(t => !deletedRefs.includes(t.booking_reference)).filter(t => {
    if (activeSubTab === 'all') return true;
    return t.status === activeSubTab;
  });

  return (
    <div className="p-8 h-full overflow-y-auto max-w-4xl mx-auto space-y-6 text-black font-sans text-left">
      <div className="flex justify-between items-center text-black">
        <h3 className="text-2xl font-black italic uppercase tracking-wider flex items-center gap-2 text-white">
          <FileText size={24} className="text-blue-500" /> Bookings & Trips History
        </h3>
        <button onClick={fetchTrips} className="bg-yellow-300 text-xs px-3 py-1.5 border-3 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-0.5 active:shadow-none transition-all uppercase flex items-center gap-1.5 font-bold cursor-pointer">
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {/* Sub tabs filtering */}
      <div className="flex gap-2 border-b-3 border-black pb-2 text-xs">
        <button onClick={() => setActiveSubTab('all')} className={`px-3 py-1.5 font-extrabold uppercase border-2 border-black rounded-lg transition-colors cursor-pointer ${activeSubTab === 'all' ? 'bg-yellow-300 text-black' : 'bg-slate-900 text-white'}`}>All</button>
        <button onClick={() => setActiveSubTab('confirmed')} className={`px-3 py-1.5 font-extrabold uppercase border-2 border-black rounded-lg transition-colors cursor-pointer ${activeSubTab === 'confirmed' ? 'bg-yellow-300 text-black' : 'bg-slate-900 text-white'}`}>Confirmed</button>
        <button onClick={() => setActiveSubTab('hold')} className={`px-3 py-1.5 font-extrabold uppercase border-2 border-black rounded-lg transition-colors cursor-pointer ${activeSubTab === 'hold' ? 'bg-yellow-300 text-black' : 'bg-slate-900 text-white'}`}>Holds</button>
        <button onClick={() => setActiveSubTab('cancelled')} className={`px-3 py-1.5 font-extrabold uppercase border-2 border-black rounded-lg transition-colors cursor-pointer ${activeSubTab === 'cancelled' ? 'bg-yellow-300 text-black' : 'bg-slate-900 text-white'}`}>Cancelled</button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-slate-400 text-sm">Loading your reservations...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border-3 border-black p-8 text-center rounded-2xl space-y-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <p className="text-slate-600 font-bold text-sm">No reservations found in this status category.</p>
          <button onClick={() => setActiveTab('explore')} className="bg-yellow-300 text-xs px-4 py-2 border-3 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:translate-y-0.5 active:shadow-none transition-all uppercase font-bold cursor-pointer">
            Book a Trip Now
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filtered.map((trip, idx) => (
            <div key={idx} className="bg-white border-3 border-black p-5 rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex justify-between items-center text-black hover:scale-[1.005] transition-transform">
              <div className="space-y-1 text-left">
                <div className="flex items-center gap-2">
                  <span className="text-[9px] bg-slate-900 text-white font-black px-1.5 py-0.5 rounded tracking-wider uppercase">{trip.vertical}</span>
                  <span className="text-[10px] text-slate-500 font-bold">PNR: {trip.booking_reference}</span>
                  <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border border-black ${
                    trip.status === "confirmed" || trip.status === "refunded" ? "bg-emerald-300" :
                    trip.status === "hold" ? "bg-amber-300" :
                    trip.status === "pending_approval" ? "bg-purple-300" :
                    trip.status === "refund_request_sent" ? "bg-cyan-300" :
                    trip.status === "cancellation_request_sent" ? "bg-orange-300" : "bg-red-300"
                  }`}>
                    {trip.status === "refund_request_sent" ? "refund request sent" :
                     trip.status === "cancellation_request_sent" ? "cancelled request sent" :
                     trip.status}
                  </span>
                </div>
                <h4 className="font-black text-lg text-black">{trip.title}</h4>
                <p className="text-xs text-slate-600 font-bold">{trip.subtitle} {trip.date && `| Date: ${trip.date}`}</p>
                <button 
                  onClick={() => setSelectedTrip(trip)}
                  className="text-xs text-blue-600 font-black hover:underline block pt-1"
                >
                  Manage Reservation & Live Tracking ➔
                </button>
              </div>

              <div className="text-right space-y-2">
                <div className="font-black text-red-600 text-lg">₹{trip.total_amount.toLocaleString()}</div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => handleDownloadInvoice(trip.booking_reference, trip.vertical)}
                    className="bg-white hover:bg-slate-100 text-[10px] font-black border-2 border-black px-2.5 py-1 rounded shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
                  >
                    Invoice
                  </button>
                  {trip.status !== "cancelled" && trip.status !== "refunded" && trip.status !== "rejected" && trip.status !== "pending_approval" && (
                    <>
                      <button 
                        onClick={() => { setSelectedTrip(trip); handleFetchCancelPreview(trip.booking_reference, trip.vertical); }}
                        className="bg-red-200 hover:bg-red-300 text-[10px] font-black border-2 border-black px-2.5 py-1 rounded shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] active:translate-y-0.5 active:shadow-none transition-all text-red-900 cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button 
                        onClick={() => handleRequestRefund(trip.booking_reference, trip.vertical)}
                        className="bg-emerald-200 hover:bg-emerald-300 text-[10px] font-black border-2 border-black px-2.5 py-1 rounded shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] active:translate-y-0.5 active:shadow-none transition-all text-emerald-950 cursor-pointer"
                      >
                        Refund
                      </button>
                    </>
                  )}
                  <button 
                    onClick={() => handleDeleteBooking(trip.booking_reference)}
                    className="bg-rose-500 hover:bg-rose-600 text-white p-1 rounded border-2 border-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] active:translate-y-0.5 active:shadow-none transition-all cursor-pointer flex items-center justify-center"
                    title="Delete History"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Invoice Modal Popup */}
      {invoiceText && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border-4 border-black p-6 max-w-lg w-full space-y-4 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] text-black">
            <div className="flex justify-between items-center border-b-3 border-black pb-2">
              <h3 className="font-black text-base uppercase tracking-wider">Itemized Travel Invoice Receipt</h3>
              <button onClick={() => setInvoiceText(null)} className="font-extrabold text-sm hover:text-red-500 font-bold cursor-pointer">✕</button>
            </div>
            <pre className="bg-[#f4efe6] p-4 border-3 border-black rounded-lg text-[10px] font-mono whitespace-pre-wrap max-h-96 overflow-y-auto leading-normal text-left font-bold">
              {invoiceText}
            </pre>
            <button 
              onClick={() => setInvoiceText(null)}
              className="w-full bg-yellow-300 hover:bg-yellow-400 border-3 border-black font-black py-2 rounded-lg text-xs uppercase cursor-pointer"
            >
              Close Invoice
            </button>
          </div>
        </div>
      )}

      {/* Booking Details / Cancellation Preview Modal */}
      {selectedTrip && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border-4 border-black p-6 max-w-lg w-full space-y-4 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] text-black">
            <div className="flex justify-between items-center border-b-3 border-black pb-2">
              <h3 className="font-black text-base uppercase tracking-wider">Booking Manager</h3>
              <button onClick={() => { setSelectedTrip(null); setCancelPreview(null); }} className="font-extrabold text-sm hover:text-red-500 font-bold cursor-pointer">✕</button>
            </div>

            <div className="bg-slate-100 p-4 border-3 border-black rounded-xl space-y-2 text-left">
              <div className="flex items-center justify-between">
                <span className="text-[10px] bg-slate-900 text-white px-2 py-0.5 rounded font-black uppercase">{selectedTrip.vertical}</span>
                <span className="text-[10px] text-slate-500 font-bold">Ref: {selectedTrip.booking_reference}</span>
              </div>
              <h4 className="font-black text-base">{selectedTrip.title}</h4>
              <p className="text-xs text-slate-600 font-semibold">{selectedTrip.subtitle}</p>
              <div className="text-xs font-bold mt-2">
                Status: <span className={`font-black uppercase px-2 py-0.5 rounded border border-black ${
                  selectedTrip.status === "confirmed" || selectedTrip.status === "refunded" ? "bg-emerald-300 text-black" :
                  selectedTrip.status === "hold" ? "bg-amber-300 text-black" :
                  selectedTrip.status === "pending_approval" ? "bg-purple-300 text-black" :
                  selectedTrip.status === "refund_request_sent" ? "bg-cyan-300 text-black" :
                  selectedTrip.status === "cancellation_request_sent" ? "bg-orange-300 text-black" : "bg-red-300 text-black"
                }`}>
                  {selectedTrip.status === "refund_request_sent" ? "refund request sent" :
                   selectedTrip.status === "cancellation_request_sent" ? "cancelled request sent" :
                   selectedTrip.status}
                </span>
              </div>
            </div>

            {/* Live Vehicle Tracking Widget */}
            {(selectedTrip.vertical === "cabs" || selectedTrip.vertical === "buses") && selectedTrip.status === "confirmed" && (
              <div className="border-3 border-black p-3 rounded-xl bg-slate-900 text-white space-y-2 text-left relative overflow-hidden">
                <span className="text-[9px] bg-blue-600 text-white px-1.5 py-0.5 rounded font-black uppercase">Live Tracking Map</span>
                <div className="h-28 bg-[#121c33] rounded-lg border-2 border-black flex items-center justify-center relative">
                  <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] opacity-40"></div>
                  
                  {/* Dotted vehicle tracking path */}
                  <div className="w-2/3 h-0.5 border-t-2 border-dashed border-blue-500 relative flex items-center justify-between">
                    <div className="w-3 h-3 bg-red-500 rounded-full border-2 border-black flex items-center justify-center -ml-1.5"><span className="text-[6px]">A</span></div>
                    
                    {/* Animated moving vehicle symbol */}
                    <div className="w-5 h-5 bg-yellow-400 border-2 border-black rounded flex items-center justify-center animate-pulse absolute left-1/3 -translate-y-0.5 shadow">
                      🚕
                    </div>
                    
                    <div className="w-3 h-3 bg-emerald-500 rounded-full border-2 border-black flex items-center justify-center -mr-1.5"><span className="text-[6px]">B</span></div>
                  </div>

                  <span className="absolute bottom-2 right-2 text-[8px] bg-black/60 text-slate-300 font-mono">Speed: 45 km/h | ETA: 12 min</span>
                </div>
              </div>
            )}

            {/* Cancellation preview block */}
            {cancelPreview ? (
              <div className="border-3 border-black p-3 rounded-xl bg-red-50 text-left space-y-2">
                <span className="text-[9px] bg-red-600 text-white px-2 py-0.5 rounded font-black uppercase">Cancellation Policy Preview</span>
                <div className="text-xs font-bold text-slate-700">
                  <div className="flex justify-between">
                    <span>Refund Amount:</span>
                    <span className="text-emerald-600 font-black">₹{cancelPreview.refund_amount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between border-b border-red-200 pb-1.5">
                    <span>Cancellation Fees:</span>
                    <span className="text-red-600 font-black">₹{cancelPreview.cancellation_fee.toLocaleString()}</span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-2 font-normal">{cancelPreview.policy_rules}</p>
                </div>
                <div className="flex gap-2 pt-2">
                  <button 
                    onClick={() => handleCancelTrip(selectedTrip.booking_reference, selectedTrip.vertical)}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white font-black text-xs py-2 rounded-lg border-2 border-black cursor-pointer shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] uppercase"
                  >
                    Confirm Cancellation
                  </button>
                  <button 
                    onClick={() => setCancelPreview(null)}
                    className="bg-white border-2 border-black font-black text-xs px-4 py-2 rounded-lg cursor-pointer uppercase"
                  >
                    Abort
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2 pt-2 justify-center">
                <button 
                  onClick={() => handleDownloadInvoice(selectedTrip.booking_reference, selectedTrip.vertical)}
                  className="bg-white hover:bg-slate-100 text-xs font-black border-3 border-black px-4 py-2.5 rounded-lg shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] cursor-pointer uppercase"
                >
                  Download Invoice
                </button>
                {selectedTrip.status !== "cancelled" && selectedTrip.status !== "pending_approval" && (
                  <button 
                    onClick={() => handleFetchCancelPreview(selectedTrip.booking_reference, selectedTrip.vertical)}
                    className="bg-red-200 hover:bg-red-300 text-xs font-black border-3 border-black px-4 py-2.5 rounded-lg shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] text-red-900 cursor-pointer uppercase"
                  >
                    Cancel Booking
                  </button>
                )}
                {selectedTrip.status !== "cancelled" && selectedTrip.status !== "pending_approval" && (
                  <button 
                    onClick={() => handleRequestRefund(selectedTrip.booking_reference, selectedTrip.vertical)}
                    className="bg-emerald-200 hover:bg-emerald-300 text-xs font-black border-3 border-black px-4 py-2.5 rounded-lg shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] text-emerald-950 cursor-pointer uppercase"
                  >
                    Request Refund
                  </button>
                )}
                {selectedTrip.status !== "cancelled" && selectedTrip.status !== "pending_approval" && selectedTrip.status !== "refunded" && (
                  <button 
                    onClick={() => alert("Rescheduling request submitted. Travel Agent will contact you within 30 minutes.")}
                    className="bg-yellow-300 hover:bg-yellow-400 text-xs font-black border-3 border-black px-4 py-2.5 rounded-lg shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] cursor-pointer uppercase"
                  >
                    Reschedule
                  </button>
                )}
                <button 
                  onClick={() => {
                    if (setPrefilledMessage) {
                      setPrefilledMessage(`I have a question regarding my reservation Ref: ${selectedTrip.booking_reference} (${selectedTrip.title})`);
                    }
                    setActiveTab('chat');
                    setSelectedTrip(null);
                  }}
                  className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-black border-3 border-black px-4 py-2.5 rounded-lg shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] cursor-pointer uppercase"
                >
                  Get Support Chat
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------- */
/* 5. OFFERS CAROUSEL                                   */
/* ---------------------------------------------------- */
function OffersCarousel({ onOfferClick }: { onOfferClick: (off: any) => void }) {
  const [activeSubTab, setActiveSubTab] = useState<string>('all');
  const [offers, setOffers] = useState<any[]>([]);

  useEffect(() => {
    // Fetch offers from showcase API
    fetch(`${API_URL}/showcase/offers`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setOffers(data);
      })
      .catch(() => {
        // Fallback static offers in case backend offline
        setOffers([
          { category: "flights", tags: "DOM FLIGHTS", title: "Save up to ₹2,500 on Domestic Flights", description: "Use code FLYFAST and get flat 12% off on Indigo, Vistara, and Air India bookings.", promo_code: "FLYFAST" },
          { category: "hotels", tags: "LUXURY STAYS", title: "Flat 20% off on Flagship Taj & Hyatt Hotels", description: "Indulge in premium luxury stays with complimentary breakfast and spa credits.", promo_code: "LUXSTAYS" },
          { category: "bank", tags: "ICICI OFFERS", title: "10% Instant Discount with ICICI Cards", description: "Book flights, hotels, or holiday packages and save instantly up to ₹5,000.", promo_code: "ICICITRAVEL" },
          { category: "holidays", tags: "GOA GETAWAYS", title: "Goa Tour Packages starting from ₹11,999/pax", description: "Includes round-trip flights, 3-star beach resort stay, and traditional spice plantation tour.", promo_code: "GOAPACK" },
          { category: "trains", tags: "DOM TRAINS", title: "Flat 10% Off on IRCTC Train Bookings", description: "Book your train tickets online and get flat 10% instant discount up to ₹150 with zero service fees.", promo_code: "RAILSAFE" },
          { category: "cabs", tags: "OUTSTATION CABS", title: "Save up to ₹800 on Outstation Cabs", description: "Get 15% off on your first intercity cab booking. Premium SUVs and Sedans with top-rated drivers.", promo_code: "CABRIDE" },
          { category: "bus", tags: "BUS TRAVEL", title: "Get 20% off up to ₹200 on Bus Bookings", description: "Enjoy luxury sleeper bus journeys with state transport and private travel partners.", promo_code: "BUSBUDDY" },
          { category: "forex", tags: "WORLD FOREX", title: "Zero Commission Forex Card & Exchange", description: "Order forex cards online at best interbank rates. Multi-currency loading with instant activation.", promo_code: "FOREXCARD" }
        ]);
      });
  }, []);

  const filtered = activeSubTab === 'all' ? offers : offers.filter(o => o.category === activeSubTab);

  return (
    <div className="space-y-4">
      {/* Sub-tabs row */}
      <div className="flex gap-2 overflow-x-auto pb-2 border-b border-slate-900/60 text-xs">
        <SubTabBtn label="All Offers" id="all" active={activeSubTab} onClick={setActiveSubTab} />
        <SubTabBtn label="Bank Offers" id="bank" active={activeSubTab} onClick={setActiveSubTab} />
        <SubTabBtn label="Flights" id="flights" active={activeSubTab} onClick={setActiveSubTab} />
        <SubTabBtn label="Hotels" id="hotels" active={activeSubTab} onClick={setActiveSubTab} />
        <SubTabBtn label="Holidays" id="holidays" active={activeSubTab} onClick={setActiveSubTab} />
        <SubTabBtn label="Trains" id="trains" active={activeSubTab} onClick={setActiveSubTab} />
        <SubTabBtn label="Cabs" id="cabs" active={activeSubTab} onClick={setActiveSubTab} />
        <SubTabBtn label="Bus" id="bus" active={activeSubTab} onClick={setActiveSubTab} />
        <SubTabBtn label="Forex" id="forex" active={activeSubTab} onClick={setActiveSubTab} />
      </div>

      {/* Snap Scroll Carousel Cards */}
      <div className="flex gap-4 overflow-x-auto py-2 snap-x snap-mandatory scroll-smooth scrollbar-thin">
        {filtered.map((off, idx) => (
          <div key={idx} className="flex-none w-80 snap-start bg-[#11192e]/80 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between hover:border-slate-700 transition-all">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-[8px] bg-blue-900/40 text-blue-300 border border-blue-500/20 px-1.5 py-0.5 rounded font-black">{off.tags}</span>
                <span className="text-[8px] text-slate-400">T&Cs Apply</span>
              </div>
              <h4 className="font-extrabold text-xs text-slate-200 leading-snug">{off.title}</h4>
              <p className="text-[10px] text-slate-200 leading-normal font-semibold">{off.description}</p>
            </div>
            
            <div className="flex justify-between items-center pt-4 border-t border-slate-900 mt-4">
              <span className="text-[9px] bg-slate-900 text-yellow-400 font-black border border-slate-800 px-2 py-0.5 rounded border-dashed">{off.promo_code}</span>
              <button onClick={() => onOfferClick(off)} className="text-[10px] text-yellow-400 font-black hover:underline flex items-center gap-0.5 cursor-pointer">
                BOOK NOW <ChevronRight size={12} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SubTabBtn({ label, id, active, onClick }: { label: string, id: string, active: string, onClick: (id: string) => void }) {
  const isActive = active === id;
  return (
    <button 
      onClick={() => onClick(id)}
      className={`px-3 py-1 rounded-full font-semibold transition-all ${
        isActive ? 'bg-blue-600 text-white' : 'bg-[#0d1527] text-slate-400 hover:text-slate-300 border border-slate-800/40'
      }`}
    >
      {off_label(label)}
    </button>
  );
}

const off_label = (lbl: string) => lbl.toUpperCase();

function ExploreMoreRow({ onSelectPill }: { onSelectPill?: (title: string) => void }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      <ExplorePill title="Where2Go" sub="Custom AI Maps" badge="HOT" onClick={() => onSelectPill && onSelectPill("Where2Go")} />
      <ExplorePill title="How2Go" sub="Optimal Intercity routes" badge="NEW" onClick={() => onSelectPill && onSelectPill("How2Go")} />
      <ExplorePill title="MICE Events" sub="Offsites & Meetings" onClick={() => onSelectPill && onSelectPill("MICE Events")} />
      <ExplorePill title="Gift Cards" sub="Gifting Travel Cards" onClick={() => onSelectPill && onSelectPill("Gift Cards")} />
      <ExplorePill title="Visa Guide" sub="Check entry limits" onClick={() => onSelectPill && onSelectPill("Visa Guide")} />
    </div>
  );
}

function ExplorePill({ title, sub, badge, onClick }: { title: string, sub: string, badge?: string, onClick?: () => void }) {
  return (
    <div onClick={onClick} className="bg-[#0e1628]/60 hover:bg-[#0e1628] border border-slate-800/60 hover:border-slate-800 p-4 rounded-xl flex flex-col justify-between cursor-pointer transition-all relative">
      {badge && (
        <span className="absolute -top-1.5 right-2 text-[7px] bg-red-600 text-white font-black px-1 rounded-full">{badge}</span>
      )}
      <span className="font-extrabold text-xs text-slate-200">{title}</span>
      <span className="text-[9px] text-slate-300 mt-1">{sub}</span>
    </div>
  );
}

/* ---------------------------------------------------- */
/* 7. AIRLINE PARTNERS SHOWCASE                          */
/* ---------------------------------------------------- */
function AirlinePartnersShowcase({ onPartnerClick }: { onPartnerClick: (name: string) => void }) {
  return (
    <div className="space-y-4">
      <h4 className="text-xs text-slate-400 font-bold uppercase tracking-wider">Experience Flying with Airline Partners</h4>
      <div className="grid grid-cols-3 gap-2">
        <PartnerLogoTile name="Air India" grad="from-red-950/60 to-red-900/60 border-red-500/10" onClick={() => onPartnerClick("Air India")} />
        <PartnerLogoTile name="IndiGo" grad="from-blue-950/60 to-blue-900/60 border-blue-500/10" onClick={() => onPartnerClick("IndiGo")} />
        <PartnerLogoTile name="Vistara" grad="from-purple-950/60 to-indigo-950/60 border-indigo-500/10" onClick={() => onPartnerClick("Vistara")} />
      </div>
    </div>
  );
}

function PartnerTile({ name, grad }: { name: string, grad: string }) {
  return (
    <div className={`p-4 rounded-xl border flex flex-col justify-between min-h-[70px] bg-gradient-to-tr ${grad} cursor-pointer hover:scale-[1.02] transition-all`}>
      <span className="font-black text-xs text-slate-100">{name}</span>
      <span className="text-[8px] text-slate-400 underline">Show flights</span>
    </div>
  );
}

/* ---------------------------------------------------- */
/* 8. FLAGSHIP HOTEL STORES SHOWCASE                     */
/* ---------------------------------------------------- */
function HotelBrandsShowcase({ onPartnerClick }: { onPartnerClick: (name: string) => void }) {
  return (
    <div className="space-y-4">
      <h4 className="text-xs text-slate-400 font-bold uppercase tracking-wider">Flagship Hotel Brands Available</h4>
      <div className="grid grid-cols-2 gap-2">
        <PartnerLogoTile name="Taj Luxury Hotels & Resorts" grad="from-amber-950/60 to-yellow-950/60 border-amber-500/10" onClick={() => onPartnerClick("Taj Luxury Hotels & Resorts")} />
        <PartnerLogoTile name="Grand Hyatt Boutique" grad="from-blue-950/60 to-slate-900/60 border-blue-500/10" onClick={() => onPartnerClick("Grand Hyatt Boutique")} />
      </div>
    </div>
  );
}

function HotelTile({ name, desc }: { name: string, desc: string }) {
  return (
    <div className="bg-[#0e1628]/60 hover:bg-[#0e1628] border border-slate-800/80 p-4 rounded-xl cursor-pointer hover:scale-[1.01] transition-all">
      <span className="font-bold text-xs text-slate-200 block">{name}</span>
      <span className="text-[9px] text-slate-500 mt-1 block">{desc}</span>
    </div>
  );
}

/* ---------------------------------------------------- */
/* 9. PERSISTENT FLOATING AI ASSISTANT WIDGET            */
/* ---------------------------------------------------- */
function FloatingAssistant({ onTrigger }: { onTrigger: (msg: string) => void }) {
  const [text, setText] = useState("");
  
  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    onTrigger(text);
    setText("");
  };

  return (
    <div className="fixed bottom-6 right-6 z-40 bg-[#0d1527] border border-slate-800 rounded-full p-1.5 shadow-2xl flex items-center max-w-sm w-80">
      <div className="p-2 bg-blue-600 rounded-full text-white">
        <Sparkles size={16} className="animate-pulse" />
      </div>
      <form onSubmit={handleSend} className="flex-1 flex items-center ml-2">
        <input 
          type="text" 
          value={text} 
          onChange={(e) => setText(e.target.value)}
          placeholder="How can I help you plan?"
          className="flex-1 bg-transparent text-xs text-slate-100 placeholder-slate-500 outline-none pr-2 font-medium"
        />
        <button type="submit" className="p-2 text-blue-500 hover:text-blue-400">
          <Send size={14} />
        </button>
      </form>
    </div>
  );
}

/* ---------------------------------------------------- */
/* CHAT VIEW WORKSPACE WITH SOCKET INTEGRATION           */
/* ---------------------------------------------------- */
interface Message {
  role: 'user' | 'assistant';
  content: string;
  status?: string;
  flights?: any[];
  hotels?: any[];
  itinerary?: any[];
}

function ChatView({ 
  userProfile, 
  setUserProfile, 
  prefilledMessage, 
  setPrefilledMessage 
}: { 
  userProfile: any, 
  setUserProfile: any, 
  prefilledMessage: string, 
  setPrefilledMessage: (msg: string) => void 
}) {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: "Hello! I am your Travel OS Assistant. I can search flight reservations, suggest hotels, map out custom day-by-day itineraries, and check Schengen visa guidelines. Try asking: 'Recommend flights from Delhi to Goa on December 15th' or 'What are the visa rules for Schengen?'" }
  ]);
  const [inputMsg, setInputMsg] = useState("");
  const [isVoice, setIsVoice] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [bookedItems, setBookedItems] = useState<Record<string, boolean>>({});

  const [sessionId, setSessionId] = useState(() => {
    const saved = localStorage.getItem('chat_session_id');
    if (saved) return saved;
    const newId = `session_${Math.random().toString(36).substring(2, 9)}`;
    localStorage.setItem('chat_session_id', newId);
    return newId;
  });

  const parseMessageBlocks = (fullText: string) => {
    if (!fullText || typeof fullText !== 'string') {
      return { content: "", flights: undefined, hotels: undefined, itinerary: undefined };
    }
    let textWithoutBlocks = fullText;
    let flights: any[] | undefined = undefined;
    let hotels: any[] | undefined = undefined;
    let itinerary: any[] | undefined = undefined;

    const flightsMatch = fullText.match(/```flights-data([\s\S]*?)```/);
    if (flightsMatch) {
      try {
        let parsed = JSON.parse(flightsMatch[1].trim());
        flights = Array.isArray(parsed) ? parsed : [parsed];
        textWithoutBlocks = textWithoutBlocks.replace(flightsMatch[0], "");
      } catch (e) {
        console.error("Failed to parse flights JSON", e);
      }
    }

    const hotelsMatch = fullText.match(/```hotels-data([\s\S]*?)```/);
    if (hotelsMatch) {
      try {
        let parsed = JSON.parse(hotelsMatch[1].trim());
        hotels = Array.isArray(parsed) ? parsed : [parsed];
        textWithoutBlocks = textWithoutBlocks.replace(hotelsMatch[0], "");
      } catch (e) {
        console.error("Failed to parse hotels JSON", e);
      }
    }

    const itinMatch = fullText.match(/```itinerary-data([\s\S]*?)```/);
    if (itinMatch) {
      try {
        let parsed = JSON.parse(itinMatch[1].trim());
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          const normalized: any[] = [];
          Object.keys(parsed).forEach((key) => {
            const numMatch = key.match(/\d+/);
            const dayNum = numMatch ? parseInt(numMatch[0], 10) : normalized.length + 1;
            const slots = parsed[key];
            if (Array.isArray(slots)) {
              normalized.push({
                day: dayNum,
                title: `Day ${dayNum}`,
                morning: slots[0] || "",
                afternoon: slots[1] || "",
                evening: slots[2] || ""
              });
            } else {
              normalized.push({
                day: dayNum,
                title: slots.title || slots.theme || `Day ${dayNum}`,
                morning: slots.morning || "",
                afternoon: slots.afternoon || "",
                evening: slots.evening || ""
              });
            }
          });
          normalized.sort((a, b) => a.day - b.day);
          itinerary = normalized;
        } else if (Array.isArray(parsed)) {
          itinerary = parsed;
        }
        textWithoutBlocks = textWithoutBlocks.replace(itinMatch[0], "");
      } catch (e) {
        console.error("Failed to parse itinerary JSON", e);
      }
    }

    const summaryMatch = fullText.match(/```trip-summary([\s\S]*?)```/);
    if (summaryMatch) {
      try {
        textWithoutBlocks = textWithoutBlocks.replace(summaryMatch[0], "");
      } catch (e) {
        console.error("Failed to parse trip summary", e);
      }
    }

    return {
      content: textWithoutBlocks.trim(),
      flights,
      hotels,
      itinerary
    };
  };

  // Fetch session history from backend on load
  useEffect(() => {
    fetch(`http://localhost:8000/api/v1/agents/chat/history/${sessionId}`)
      .then(res => res.json())
      .then(data => {
        if (data.history && data.history.length > 0) {
          const parsedHistory = data.history.map((msg: any) => {
            if (msg.role === 'assistant') {
              const parsed = parseMessageBlocks(msg.content);
              return {
                role: 'assistant',
                content: parsed.content || msg.content,
                flights: parsed.flights,
                hotels: parsed.hotels,
                itinerary: parsed.itinerary
              };
            }
            return msg;
          });
          setMessages(parsedHistory);
        }
      })
      .catch(e => console.error("Error loading chat history:", e));
  }, [sessionId]);

  // WebSocket Connection
  useEffect(() => {
    const socket = new WebSocket(`ws://localhost:8000/api/v1/agents/chat/ws/${sessionId}`);
    
    socket.onopen = () => {
      console.log("WebSocket connected");
    };

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'status') {
        setMessages(prev => {
          const copy = [...prev];
          const last = copy[copy.length - 1];
          if (last && last.role === 'assistant') {
            last.status = data.status;
          }
          return copy;
        });
      } else if (data.type === 'chunk') {
        setMessages(prev => {
          const copy = [...prev];
          const last = copy[copy.length - 1];
          if (last && last.role === 'assistant') {
            last.status = undefined;
            last.content = (last.content || "") + data.text;
          }
          return copy;
        });
      } else if (data.type === 'done') {
        setMessages(prev => {
          const copy = [...prev];
          const last = copy[copy.length - 1];
          if (last && last.role === 'assistant') {
            last.status = undefined;
            const parsed = parseMessageBlocks(data.full_response);
            last.content = parsed.content;
            last.flights = parsed.flights;
            last.hotels = parsed.hotels;
            last.itinerary = parsed.itinerary;
          }
          return copy;
        });
      } else if (data.type === 'error') {
        setMessages(prev => {
          const copy = [...prev];
          const last = copy[copy.length - 1];
          if (last && last.role === 'assistant') {
            last.status = undefined;
            last.content = data.message || "An error occurred during query execution.";
          }
          return copy;
        });
      }
    };

    socket.onclose = () => {
      console.log("WebSocket disconnected");
    };

    setWs(socket);

    return () => {
      socket.close();
    };
  }, [sessionId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Hook for prefills from floating assistant
  useEffect(() => {
    if (prefilledMessage) {
      setInputMsg(prefilledMessage);
      setPrefilledMessage("");
      setTimeout(() => {
        triggerSendMessage(prefilledMessage);
      }, 100);
    }
  }, [prefilledMessage]);

  useEffect(() => {
    if (isVoice) {
      const timer = setTimeout(() => {
        setInputMsg("Recommend flights from Delhi to Goa on December 15th");
        setIsVoice(false);
        alert("Voice detected: 'Recommend flights from Delhi to Goa on December 15th'");
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isVoice]);

  const triggerSendMessage = (textToSend: string) => {
    if (!textToSend.trim()) return;

    if (textToSend === "RESET_SESSION") {
      const newId = `session_${Math.random().toString(36).substring(2, 9)}`;
      localStorage.setItem('chat_session_id', newId);
      setSessionId(newId);
      setMessages([
        { role: 'assistant', content: "Hello! I am your Travel OS Assistant. I can search flight reservations, suggest hotels, map out custom day-by-day itineraries, and check Schengen visa guidelines. Try asking: 'Recommend flights from Delhi to Goa on December 15th' or 'What are the visa rules for Schengen?'" }
      ]);
      setInputMsg("");
      return;
    }

    setMessages(prev => [...prev, { role: 'user', content: textToSend }]);
    setInputMsg("");

    setMessages(prev => [...prev, { role: 'assistant', content: "", status: "Supervisor classifying intent..." }]);

    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ message: textToSend }));
    } else {
      console.log("WebSocket not open, attempting to reconnect...");
      const socket = new WebSocket(`ws://localhost:8000/api/v1/agents/chat/ws/${sessionId}`);
      socket.onopen = () => {
        setWs(socket);
        socket.send(JSON.stringify({ message: textToSend }));
      };
      setTimeout(() => {
        if (socket.readyState !== WebSocket.OPEN) {
          setMessages(prev => {
            const copy = [...prev];
            const last = copy[copy.length - 1];
            if (last && last.role === 'assistant') {
              last.status = undefined;
              last.content = "Connection is currently unavailable. Please try checking connection or click 'Start a new session' below.";
            }
            return copy;
          });
        }
      }, 5000);
    }
  };

  const sendMessage = () => {
    if (!inputMsg.trim()) return;
    triggerSendMessage(inputMsg);
  };

  const handleBook = (id: string, name: string, price: number) => {
    if (userProfile.walletBalance >= price) {
      setUserProfile((prev: any) => ({
        ...prev,
        walletBalance: prev.walletBalance - price,
        points: prev.points + Math.floor(price * 0.05)
      }));
      setBookedItems(prev => ({ ...prev, [id]: true }));
      alert(`Booking Successful! ${name} is locked. confirmation SMS dispatched.`);
    } else {
      alert("Insufficient wallet balance. Please top up in the Wallet & Loyalty section.");
    }
  };

  const handleCancel = (id: string, name: string, price: number) => {
    const refund = price * 0.9;
    setUserProfile((prev: any) => ({
      ...prev,
      walletBalance: prev.walletBalance + refund
    }));
    setBookedItems(prev => ({ ...prev, [id]: false }));
    alert(`Cancellation confirmed! 10% penalty fee applied. Refund of ₹${refund.toLocaleString()} credited to Wallet.`);
  };

  const getSlotText = (day: any, slotKey: 'morning' | 'afternoon' | 'evening') => {
    if (!day) return "";
    const slot = day.slots ? day.slots[slotKey] : day[slotKey];
    if (!slot) return "";
    if (typeof slot === 'object') {
      const timeStr = slot.time ? `(${slot.time}) ` : "";
      const actStr = slot.activity || slot.description || JSON.stringify(slot);
      return `${timeStr}${actStr}`;
    }
    return String(slot);
  };

  const downloadCalendarICS = (itin: any[]) => {
    if (!itin || !Array.isArray(itin)) return;
    let icsContent = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Travel OS//Itinerary Client//EN",
      "METHOD:PUBLISH"
    ];
    
    itin.forEach((day, index) => {
      const startOffset = index;
      const startStr = `202612${15 + startOffset}T090000Z`;
      const endStr = `202612${15 + startOffset}T210000Z`;
      
      const morningText = getSlotText(day, 'morning');
      const afternoonText = getSlotText(day, 'afternoon');
      const eveningText = getSlotText(day, 'evening');
      
      icsContent.push(
        "BEGIN:VEVENT",
        `UID:itinerary_day_${day.day}_${Date.now()}@travelos.com`,
        `DTSTART:${startStr}`,
        `DTEND:${endStr}`,
        `SUMMARY:Goa Trip Day ${day.day} - ${day.title || day.theme || 'Plan'}`,
        `DESCRIPTION:Morning: ${morningText}\\nAfternoon: ${afternoonText}\\nEvening: ${eveningText}`,
        "LOCATION:Goa",
        "END:VEVENT"
      );
    });
    
    icsContent.push("END:VCALENDAR");
    
    const blob = new Blob([icsContent.join("\r\n")], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "trip_itinerary.ics");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const suggestedPrompts = [
    { label: "Plan a 3-day trip to Goa", text: "I want to plan a 3-day trip to Goa starting Dec 15th." },
    { label: "Find flights to Goa", text: "Show me direct flight selections from Delhi to Goa on December 15th." },
    { label: "Schengen Visa guidelines", text: "What are the Schengen Visa requirements for Indian citizens?" },
    { label: "What is the weather in Delhi?", text: "What is the weather forecast and average temperature in Delhi?" }
  ];

  const lastMsg = messages[messages.length - 1];

  const getContextualActions = () => {
    if (!lastMsg || lastMsg.role !== 'assistant' || lastMsg.status) return [];
    if (!lastMsg.content) return [];

    if (lastMsg.content.includes("Error") || lastMsg.content.includes("fail") || lastMsg.content.includes("unavailable") || lastMsg.content.includes("error")) {
      return [
        { label: "Retry last question", text: messages[messages.length - 2]?.content || "Plan a 3-day trip to Goa" },
        { label: "Start a new session / Reset chat", text: "RESET_SESSION" }
      ];
    }

    if (lastMsg.flights && lastMsg.flights.length > 0) {
      return [
        { label: "Compare flight options", text: "Can you compare the Vistara and IndiGo flight options in detail?" },
        { label: "Find hotels in Goa", text: "Now search and recommend hotels in Goa for the same dates." },
        { label: "Generate itinerary", text: "Create a 3-day travel itinerary for Goa." }
      ];
    }
    if (lastMsg.hotels && lastMsg.hotels.length > 0) {
      return [
        { label: "Show cheap flight options", text: "Show me direct flight selections from Delhi to Goa." },
        { label: "Generate itinerary for Goa", text: "Create a 3-day travel itinerary for Goa." }
      ];
    }
    if (lastMsg.itinerary && lastMsg.itinerary.length > 0) {
      return [
        { label: "Find flights for this plan", text: "Show me direct flight selections from Delhi to Goa." },
        { label: "Find beachfront hotels", text: "Now search and recommend beachfront hotels in Goa." }
      ];
    }
    return [];
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0f1d]">
      <div className="flex-1 overflow-y-auto p-8 space-y-6">
        {messages.map((msg, index) => (
          <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-2xl rounded-2xl p-5 ${
              msg.role === 'user' 
                ? 'bg-blue-600 text-white rounded-tr-none' 
                : 'glass-card text-slate-100 rounded-tl-none border border-slate-800'
            }`}>
              {msg.status && (
                <div className="flex items-center gap-2 text-blue-400 text-sm font-semibold">
                  <RefreshCw size={14} className="animate-spin" /> {msg.status}
                </div>
              )}
              {(!msg.status || msg.content) && (
                <div className="whitespace-pre-wrap leading-relaxed text-sm">
                  {msg.content}
                </div>
              )}

              {msg.flights && Array.isArray(msg.flights) && (
                <div className="mt-4 space-y-2 border-t border-slate-800 pt-4">
                  <h4 className="text-xs text-slate-400 font-semibold mb-2">FOUND FLIGHT SELECTIONS:</h4>
                  {msg.flights.map((fl: any, i: number) => {
                    if (!fl) return null;
                    const isBooked = bookedItems[fl.flight_number];
                    return (
                      <div key={i} className="bg-[#121c33] p-4 rounded-xl flex justify-between items-center border border-slate-800 hover:border-slate-700 transition-all">
                        <div>
                          <div className="flex items-center gap-2">
                            <Plane size={14} className="text-blue-500" />
                            <span className="font-bold text-xs">{fl.airline}</span>
                            <span className="text-[10px] bg-blue-900/40 text-blue-300 px-1.5 py-0.5 rounded">{fl.flight_number}</span>
                            {isBooked && (
                              <span className="text-[9px] bg-emerald-950/40 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded flex items-center gap-0.5"><CheckCircle size={8} /> Booked</span>
                            )}
                          </div>
                          <div className="text-xs font-semibold text-slate-300 mt-1">
                            {fl.dep} ➔ {fl.arr}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-extrabold text-sm text-emerald-400 font-sans">₹{Number(fl.price || 0).toLocaleString()}</div>
                          {isBooked ? (
                            <button 
                              onClick={() => handleCancel(fl.flight_number, fl.airline, Number(fl.price || 0))}
                              className="mt-1 bg-red-950/40 border border-red-500/30 hover:bg-red-900/30 text-red-400 text-[10px] font-bold px-2.5 py-1 rounded"
                            >
                              Cancel Booking
                            </button>
                          ) : (
                            <button 
                              onClick={() => handleBook(fl.flight_number, fl.airline, Number(fl.price || 0))}
                              className="mt-1 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold px-2.5 py-1 rounded"
                            >
                              Book Now
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {msg.hotels && Array.isArray(msg.hotels) && (
                <div className="mt-4 space-y-2 border-t border-slate-800 pt-4">
                  <h4 className="text-xs text-slate-400 font-semibold mb-2">RECOMMENDED ACCOMMODATIONS:</h4>
                  {msg.hotels.map((ht: any, i: number) => {
                    if (!ht) return null;
                    const isBooked = bookedItems[ht.name];
                    return (
                      <div key={i} className="bg-[#121c33] p-4 rounded-xl flex justify-between items-center border border-slate-800 hover:border-slate-700 transition-all">
                        <div className="w-2/3">
                          <div className="font-bold text-xs text-slate-200 flex items-center gap-1.5">
                            {ht.name}
                            {isBooked && (
                              <span className="text-[9px] bg-emerald-950/40 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded flex items-center gap-0.5"><CheckCircle size={8} /> Reserved</span>
                            )}
                          </div>
                          <div className="text-[10px] text-yellow-400 font-semibold mt-0.5">{ht.rating} ★ Rating</div>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {Array.isArray(ht.amenities) && ht.amenities.map((am: string, idx: number) => (
                              <span key={idx} className="text-[9px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded">{am}</span>
                            ))}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-extrabold text-sm text-emerald-400">₹{Number(ht.price || 0).toLocaleString()}/N</div>
                          {isBooked ? (
                            <button 
                              onClick={() => handleCancel(ht.name, ht.name, Number(ht.price || 0))}
                              className="mt-1 bg-red-950/40 border border-red-500/30 hover:bg-red-900/30 text-red-400 text-[10px] font-bold px-2.5 py-1 rounded"
                            >
                              Cancel Stay
                            </button>
                          ) : (
                            <button 
                              onClick={() => handleBook(ht.name, ht.name, Number(ht.price || 0))}
                              className="mt-1 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold px-2.5 py-1 rounded"
                            >
                              Reserve Room
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {msg.itinerary && Array.isArray(msg.itinerary) && (
                <div className="mt-4 space-y-3 border-t border-slate-800 pt-4">
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="text-xs text-slate-400 font-semibold">GENERATED TRIP PLAN:</h4>
                    <button 
                      onClick={() => downloadCalendarICS(msg.itinerary!)}
                      className="bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 text-[10px] font-bold px-2.5 py-1 rounded border border-blue-500/20 flex items-center gap-1 transition-all"
                    >
                      <Calendar size={12} /> Sync to Google Calendar
                    </button>
                  </div>
                  {msg.itinerary.map((day: any, i: number) => (
                    <div key={i} className="bg-[#121c33] p-4 rounded-xl border border-slate-800">
                      <div className="font-bold text-xs text-blue-400">Day {day.day} — {day.title || day.theme || 'Plan'}</div>
                      <div className="mt-2 space-y-1.5 text-[11px] text-slate-300">
                        <div>🌅 <span className="font-semibold text-slate-400">Morning:</span> {getSlotText(day, 'morning')}</div>
                        <div>☀️ <span className="font-semibold text-slate-400">Afternoon:</span> {getSlotText(day, 'afternoon')}</div>
                        <div>🌙 <span className="font-semibold text-slate-400">Evening:</span> {getSlotText(day, 'evening')}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {messages.length <= 1 && (
          <div className="max-w-2xl mx-auto space-y-3 pt-6">
            <h4 className="text-xs text-slate-400 font-extrabold uppercase tracking-widest text-center">Suggested Prompts & Starters</h4>
            <div className="grid grid-cols-2 gap-3">
              {suggestedPrompts.map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => triggerSendMessage(p.text)}
                  className="p-4 bg-slate-900 border border-slate-800 hover:border-blue-500 rounded-xl text-left text-xs font-bold text-slate-200 shadow hover:bg-slate-800/80 transition-all cursor-pointer"
                >
                  {p.label} ➔
                </button>
              ))}
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {getContextualActions().length > 0 && (
        <div className="px-8 py-2 bg-[#0a0f1d] border-t border-slate-900">
          <div className="flex gap-2 overflow-x-auto max-w-4xl mx-auto py-1 scrollbar-none">
            {getContextualActions().map((action, idx) => (
              <button
                key={idx}
                onClick={() => triggerSendMessage(action.text)}
                className="whitespace-nowrap px-3.5 py-1.5 bg-blue-900/30 hover:bg-blue-900/50 text-blue-300 text-xs font-bold rounded-full border border-blue-500/20 shadow-sm cursor-pointer transition-all active:scale-[0.98]"
              >
                ✨ {action.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="h-20 border-t border-slate-900 px-8 flex items-center justify-between bg-[#0a0f1d]/80">
        <div className="flex-1 flex gap-2 max-w-4xl mx-auto items-center">
          <button 
            onClick={() => setIsVoice(!isVoice)}
            className={`p-2.5 rounded-full transition-all ${
              isVoice ? 'bg-red-600/20 text-red-500 animate-pulse' : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            {isVoice ? <MicOff size={20} /> : <Mic size={20} />}
          </button>
          
          <div className="flex-1 relative">
            <input 
              type="text" 
              value={inputMsg}
              onChange={(e) => setInputMsg(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
              placeholder={isVoice ? "Listening... Speak your travel plan..." : "Ask the travel coordinator agent..."}
              className="w-full pl-4 pr-12 py-3 rounded-full text-sm glass-input font-medium"
            />
            <button 
              onClick={sendMessage}
              className="absolute right-2 top-2 p-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-full transition-all shadow-md"
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------- */
/* WALLET VIEW                                          */
/* ---------------------------------------------------- */
function WalletView({ userProfile, setUserProfile }: { userProfile: any, setUserProfile: any }) {
  const [topupAmount, setTopupAmount] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [couponStatus, setCouponStatus] = useState("");

  const handleTopup = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(topupAmount);
    if (!val || val <= 0) return;
    setUserProfile((prev: any) => ({
      ...prev,
      walletBalance: prev.walletBalance + val
    }));
    setTopupAmount("");
    alert(`Wallet Top-up of ₹${val.toLocaleString()} completed using Stripe token gateway.`);
  };

  const handleApplyCoupon = () => {
    if (couponCode.toUpperCase() === "SAVE10") {
      setCouponStatus("Coupon SAVE10 applied! 10% discount loaded on checkouts.");
    } else {
      setCouponStatus("Invalid coupon code.");
    }
  };

  return (
    <div className="p-8 h-full overflow-y-auto max-w-4xl mx-auto space-y-6">
      <div className="bg-gradient-to-r from-blue-900/60 to-indigo-900/60 rounded-2xl p-6 border border-blue-500/20 shadow-xl flex justify-between items-center">
        <div>
          <span className="text-xs text-blue-300 font-bold uppercase tracking-wider">Active Balance</span>
          <h3 className="text-3xl font-black text-white mt-1">₹{userProfile.walletBalance.toLocaleString()}</h3>
          <p className="text-xs text-slate-400 mt-2">Preferred currency is synced in INR. All travel refunds credit instantly.</p>
        </div>
        <div className="text-right">
          <span className="text-[10px] bg-blue-500/20 text-blue-300 px-2.5 py-1 rounded-full font-bold">{userProfile.tier} Member</span>
          <div className="text-xs text-slate-300 mt-3 font-semibold">Loyalty points: {userProfile.points}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass-card p-6 rounded-2xl border border-slate-800 space-y-4">
          <h4 className="font-bold text-slate-200 flex items-center gap-2"><CreditCard size={18} className="text-blue-500" /> Wallet Recharge</h4>
          <form onSubmit={handleTopup} className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs text-slate-400">Recharge Amount (INR)</label>
              <input 
                type="number" 
                value={topupAmount}
                onChange={(e) => setTopupAmount(e.target.value)}
                placeholder="Enter amount (e.g. 5000)"
                className="w-full px-4 py-2.5 rounded-lg text-sm glass-input"
              />
            </div>
            <button 
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 rounded-lg text-sm transition-all shadow-md shadow-blue-500/10"
            >
              Add Money via Card
            </button>
          </form>
        </div>

        <div className="glass-card p-6 rounded-2xl border border-slate-800 space-y-4">
          <h4 className="font-bold text-slate-200 flex items-center gap-2"><Tag size={18} className="text-blue-500" /> Coupon Center</h4>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs text-slate-400">Discount Code</label>
              <input 
                type="text" 
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value)}
                placeholder="Enter code (e.g. SAVE10)"
                className="w-full px-4 py-2.5 rounded-lg text-sm glass-input"
              />
            </div>
            <button 
              onClick={handleApplyCoupon}
              className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold py-2.5 rounded-lg text-sm transition-all"
            >
              Validate Coupon
            </button>
            {couponStatus && <div className="text-xs text-blue-400 font-medium px-1 mt-2">{couponStatus}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------- */
function CardThumbnail({ ownerType, ownerId, defaultUrl = "/static/uploads/default_travel.webp", blurHash }: { ownerType: string, ownerId: string, defaultUrl?: string, blurHash?: string }) {
  const [imgUrl, setImgUrl] = useState(defaultUrl);
  const [hash, setHash] = useState(blurHash);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setImgUrl(defaultUrl);
    setHash(blurHash);
    setIsLoaded(false);
  }, [defaultUrl, blurHash]);

  useEffect(() => {
    fetch(`http://localhost:8000/api/v1/media?owner_type=${ownerType}&owner_id=${encodeURIComponent(ownerId)}`)
      .then(res => res.json())
      .then((data: any[]) => {
        const primary = data.find(p => p.is_primary) || data[0];
        if (primary) {
          setImgUrl(primary.url);
          setHash(primary.blur_hash_base64);
        }
      })
      .catch(() => {});
  }, [ownerType, ownerId]);

  return (
    <div className="relative w-full h-48 rounded-xl overflow-hidden bg-slate-900 border border-slate-800">
      <img 
        src={imgUrl.startsWith("http") ? imgUrl : `http://localhost:8000${imgUrl}`} 
        alt={ownerId}
        loading="lazy"
        onLoad={() => setIsLoaded(true)}
        className="absolute inset-0 w-full h-full object-cover"
      />
      {hash && !isLoaded && (
        <img 
          src={hash} 
          alt="blur-up placeholder" 
          className="absolute inset-0 w-full h-full object-cover blur-md scale-110 transition-opacity duration-305"
        />
      )}
    </div>
  );
}

function DetailGallery({ ownerType, ownerId, onClose }: { ownerType: string, ownerId: string, onClose: () => void }) {
  const [photos, setPhotos] = useState<any[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  useEffect(() => {
    fetch(`http://localhost:8000/api/v1/media?owner_type=${ownerType}&owner_id=${encodeURIComponent(ownerId)}`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setPhotos(data);
      })
      .catch(() => {});
  }, [ownerType, ownerId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (lightboxOpen) setLightboxOpen(false);
        else onClose();
      } else if (e.key === 'ArrowRight' && lightboxOpen) {
        setActiveIndex(prev => (prev + 1) % photos.length);
      } else if (e.key === 'ArrowLeft' && lightboxOpen) {
        setActiveIndex(prev => (prev - 1 + photos.length) % photos.length);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxOpen, photos.length]);

  const activePhoto = photos[activeIndex] || { url: "/static/uploads/default_travel.webp", alt_text: "Placeholder" };
  const activeFullUrl = activePhoto.url.startsWith("http") ? activePhoto.url : `http://localhost:8000${activePhoto.url}`;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-[#0b1021] border border-slate-800 rounded-3xl p-6 max-w-3xl w-full space-y-6 shadow-2xl relative">
        <div className="flex justify-between items-center">
          <div>
            <h4 className="font-black text-slate-200 text-lg">{ownerId} Gallery</h4>
            <p className="text-xs text-slate-500 mt-0.5">Explore {photos.length} real premium WebP snaps</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white font-extrabold text-sm p-1">✕</button>
        </div>

        {photos.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-slate-500 text-sm">No photos uploaded for this listing.</div>
        ) : (
          <div className="space-y-4">
            <div 
              onClick={() => setLightboxOpen(true)}
              className="relative w-full h-80 rounded-2xl overflow-hidden bg-slate-950 border border-slate-900 cursor-pointer group"
            >
              <img 
                src={activeFullUrl} 
                alt={activePhoto.alt_text} 
                className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent flex items-end p-4">
                <span className="text-xs text-white bg-slate-950/60 px-3 py-1 rounded-full font-semibold border border-white/10">
                  {activePhoto.alt_text} (Click to expand)
                </span>
              </div>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-2">
              {photos.map((p, idx) => {
                const thumbUrl = p.url.startsWith("http") ? p.url : `http://localhost:8000${p.url}`;
                return (
                  <button 
                    key={p.id} 
                    onClick={() => setActiveIndex(idx)}
                    className={`relative w-16 h-12 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-all ${idx === activeIndex ? 'border-blue-500 scale-95' : 'border-slate-800 opacity-60 hover:opacity-100'}`}
                  >
                    <img src={thumbUrl} alt="" className="w-full h-full object-cover" />
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {lightboxOpen && (
        <div className="fixed inset-0 bg-black/95 z-[60] flex flex-col justify-between items-center p-4">
          <div className="w-full flex justify-between text-slate-400 p-2">
            <span className="text-xs font-semibold">{activeIndex + 1} / {photos.length}</span>
            <button onClick={() => setLightboxOpen(false)} className="text-white text-lg font-bold">✕ Close</button>
          </div>
          <div className="relative max-w-4xl max-h-[75vh] w-full flex items-center justify-center">
            <button 
              onClick={() => setActiveIndex(prev => (prev - 1 + photos.length) % photos.length)}
              className="absolute left-4 bg-slate-900/60 hover:bg-slate-900 border border-white/10 p-2.5 rounded-full text-white text-xl"
            >
              ◀
            </button>
            <img 
              src={activeFullUrl} 
              alt={activePhoto.alt_text} 
              className="max-w-full max-h-[75vh] object-contain rounded shadow-2xl" 
            />
            <button 
              onClick={() => setActiveIndex(prev => (prev + 1) % photos.length)}
              className="absolute right-4 bg-slate-900/60 hover:bg-slate-900 border border-white/10 p-2.5 rounded-full text-white text-xl"
            >
              ▶
            </button>
          </div>
          <div className="text-center text-xs text-slate-400 mb-6 bg-slate-900/80 px-4 py-2 rounded-full border border-slate-800">
            {activePhoto.alt_text} — Press Esc to close, Arrow keys to navigate
          </div>
        </div>
      )}
    </div>
  );
}

function PartnerLogoTile({ name, grad, onClick }: { name: string, grad: string, onClick?: () => void }) {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    fetch(`http://localhost:8000/api/v1/media?owner_type=partner&owner_id=${encodeURIComponent(name)}`)
      .then(res => res.json())
      .then(data => {
        const primary = data.find((p: any) => p.is_primary) || data[0];
        if (primary) setLogoUrl(primary.url);
      })
      .catch(() => {});
  }, [name]);

  if (logoUrl) {
    const fullLogoUrl = logoUrl.startsWith("http") ? logoUrl : `http://localhost:8000${logoUrl}`;
    return (
      <div onClick={onClick} className="relative w-full h-24 rounded-xl border border-slate-800 bg-slate-900/40 cursor-pointer hover:scale-[1.02] transition-all overflow-hidden group shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
        <img 
          src={fullLogoUrl} 
          alt={name} 
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
        <div className="absolute inset-0 bg-black/40 flex items-end p-2 opacity-100 transition-opacity">
          <span className="text-[10px] font-black text-white tracking-wider uppercase bg-black/80 px-2 py-0.5 rounded border border-white/10">
            {name}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div onClick={onClick} className={`p-4 rounded-xl border flex flex-col justify-between min-h-[96px] bg-gradient-to-tr ${grad} cursor-pointer hover:scale-[1.02] transition-all`}>
      <span className="font-black text-xs text-slate-100">{name}</span>
      <span className="text-[8px] text-slate-400 underline">Show partner info</span>
    </div>
  );
}

function MetricCard({ title, value, change }: { title: string, value: string, change: string }) {
  return (
    <div className="glass-card p-5 rounded-2xl border border-slate-800">
      <span className="text-xs text-slate-400 font-medium">{title}</span>
      <h3 className="text-2xl font-bold text-slate-100 mt-1">{value}</h3>
      <span className="text-[10px] text-blue-400 mt-2 block font-medium">{change}</span>
    </div>
  );
}

function ProviderProgress({ name, pct, latency }: { name: string, pct: number, latency: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs font-semibold text-slate-300">
        <span>{name} <span className="text-[9px] text-slate-500">({latency})</span></span>
        <span>{pct}% calls</span>
      </div>
      <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden">
        <div className="bg-blue-600 h-full rounded-full" style={{ width: `${pct}%` }}></div>
      </div>
    </div>
  );
}


/* ---------------------------------------------------- */
/* 9. PHASE 9: CURATIONS, AD BANNER & SEO MEGAFOOTER    */
/* ---------------------------------------------------- */

interface CollectionItemData {
  id: number;
  ref_type: string;
  ref_id: string;
  label: string;
  tag_text: string;
  image_url: string;
}

interface CollectionData {
  slug: string;
  title: string;
  subtitle: string;
  items: CollectionItemData[];
}

function CollectionCarousel({ slug, onDestinationClick }: { slug: string, onDestinationClick: (slug: string, title: string, img: string) => void }) {
  const [collection, setCollection] = useState<CollectionData | null>(null);
  const carouselRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`${API_URL}/showcase/collections/${slug}?user_id=1`)
      .then(res => res.json())
      .then(data => {
        if (data && Array.isArray(data.items)) {
          setCollection(data);
        }
      })
      .catch(() => {
        // Fallback mock collections if backend is down
        if (slug === "handpicked-collections") {
          setCollection({
            slug,
            title: "Handpicked Collections for You",
            subtitle: "Curated stays, flights and trips just for your style",
            items: [
              { id: 1, ref_type: "hotel", ref_id: "Taj Luxury Hotels & Resorts", label: "TOP 8", tag_text: "Luxury Heritage Palace Stays", image_url: "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=600" },
              { id: 2, ref_type: "hotel", ref_id: "Grand Hyatt Boutique", label: "POPULAR", tag_text: "Modern Premium Seaside Escapes", image_url: "https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=600" }
            ]
          });
        } else {
          setCollection({
            slug,
            title: "Unlock Lesser-Known Wonders of India",
            subtitle: "Fascinating hidden gems waiting to be explored",
            items: [
              { id: 3, ref_type: "destination", ref_id: "ziro_valley", label: "EXPLORE", tag_text: "Ziro Valley, Arunachal hidden beauty", image_url: "https://images.unsplash.com/photo-1506461883276-594a12b11cc3?w=600" },
              { id: 4, ref_type: "destination", ref_id: "spiti_valley", label: "ADVENTURE", tag_text: "Spiti Valley cold desert expeditions", image_url: "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=600" }
            ]
          });
        }
      });
  }, [slug]);

  const scroll = (direction: 'left' | 'right') => {
    if (carouselRef.current) {
      const scrollAmount = 300;
      carouselRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  if (!collection) return null;

  return (
    <div className="space-y-4 relative group text-black font-sans">
      <div className="flex justify-between items-end pr-2">
        <div className="text-left">
          <h3 className="text-xl font-extrabold text-slate-200">{collection.title}</h3>
          <p className="text-xs text-slate-400 font-bold">{collection.subtitle}</p>
        </div>
        <div className="flex gap-2">
          <button 
            type="button"
            onClick={() => scroll('left')}
            className="w-8 h-8 rounded-full bg-slate-900 border-2 border-black flex items-center justify-center text-slate-200 hover:bg-slate-800 shadow cursor-pointer"
          >
            ←
          </button>
          <button 
            type="button"
            onClick={() => scroll('right')}
            className="w-8 h-8 rounded-full bg-slate-900 border-2 border-black flex items-center justify-center text-slate-200 hover:bg-slate-800 shadow cursor-pointer"
          >
            →
          </button>
        </div>
      </div>

      <div 
        ref={carouselRef}
        className="flex gap-4 overflow-x-auto py-2 snap-x snap-mandatory scroll-smooth scrollbar-none"
      >
        {collection.items.map((item) => (
          <div 
            key={item.id}
            onClick={() => onDestinationClick(item.ref_id, item.tag_text, item.image_url)}
            className="flex-none w-72 snap-start bg-white border-3 border-black p-3 rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:scale-[1.01] transition-transform text-black flex flex-col gap-3 cursor-pointer"
          >
            <div className="relative w-full h-40 rounded-xl overflow-hidden border-2 border-black">
              <img src={item.image_url} alt={item.tag_text} className="w-full h-full object-cover" />
              {item.label && (
                <span className="absolute top-2 left-2 text-[8px] bg-yellow-300 text-black font-black border-2 border-black px-1.5 py-0.5 rounded">
                  {item.label}
                </span>
              )}
            </div>
            <div className="space-y-1.5 text-left py-1">
              <h4 className="font-bold text-xs leading-snug text-slate-900 line-clamp-2 min-h-[32px]">{item.tag_text}</h4>
              <p className="text-[9px] text-slate-500 font-bold uppercase">{item.ref_type}: {item.ref_id}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface HighlightData {
  id: number;
  icon_name: string;
  title: string;
  body_text: string;
  cta_url: string;
}

function InfoHighlightRow({ onNavigate }: { onNavigate?: (path: string) => void }) {
  const [highlights, setHighlights] = useState<HighlightData[]>([]);

  useEffect(() => {
    fetch(`${API_URL}/showcase/highlights`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setHighlights(data);
      })
      .catch(() => {
        setHighlights([
          { id: 1, icon_name: "Globe", title: "Introducing OneCircle Membership", body_text: "Earn loyalty points across flights, hotels, and activities. Unlock elite perks today.", cta_url: "/wallet" },
          { id: 2, icon_name: "Clock", title: "Flexible Check-In / Check-Out", body_text: "Adjust your timing on the fly at premium luxury resorts with zero penalty fees.", cta_url: "/explore" },
          { id: 3, icon_name: "Compass", title: "Tours & Local Attractions", body_text: "Handpicked walking tours and outdoor activities curated by local guides.", cta_url: "/explore" }
        ]);
      });
  }, []);

  const getIcon = (name: string) => {
    switch (name) {
      case "Globe": return <Globe size={24} className="text-blue-500" />;
      case "Clock": return <Clock size={24} className="text-yellow-500" />;
      default: return <Compass size={24} className="text-red-500" />;
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-8 border-t border-slate-900/60 font-sans">
      {highlights.map((h) => (
        <a 
          href={h.cta_url}
          key={h.id}
          onClick={(e) => {
            if (onNavigate) {
              e.preventDefault();
              onNavigate(h.cta_url);
            }
          }}
          className="bg-white border-3 border-black p-4 rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:scale-[1.01] transition-transform text-black flex items-start gap-3"
        >
          <div className="p-2 border-2 border-black rounded-xl bg-slate-50 flex items-center justify-center">
            {getIcon(h.icon_name)}
          </div>
          <div className="space-y-1 text-left">
            <h4 className="font-extrabold text-sm">{h.title}</h4>
            <p className="text-[10px] text-slate-500 leading-normal font-bold">{h.body_text}</p>
          </div>
        </a>
      ))}
    </div>
  );
}

interface BannerData {
  id: number;
  background_color: string;
  headline: string;
  cta_text: string;
  cta_url: string;
  logo_url: string;
}

function PromoBannerStrip({ onNavigate }: { onNavigate?: (path: string) => void }) {
  const [banner, setBanner] = useState<BannerData | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/showcase/banners/homepage_mid`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setBanner(data[0]);
        }
      })
      .catch(() => {
        setBanner({
          id: 1,
          background_color: "linear-gradient(90deg, #ef4444 0%, #facc15 100%)",
          headline: "Southeast Asia's Go-To App for Direct Wallet Bookings — Download Now!",
          cta_text: "Get the App",
          cta_url: "https://google.com",
          logo_url: "https://logos-world.net/wp-content/uploads/2023/03/Air-India-Logo.png"
        });
      });
  }, []);

  if (!banner) return null;

  return (
    <div 
      style={{ background: banner.background_color }}
      className="w-full border-4 border-black p-6 rounded-3xl shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] flex flex-col md:flex-row justify-between items-center gap-4 text-black my-8 font-sans"
    >
      <div className="flex items-center gap-4 text-left">
        {banner.logo_url && (
          <img src={banner.logo_url} alt="Logo" className="w-12 h-12 object-contain bg-white p-1 rounded-xl border-2 border-black" />
        )}
        <h3 className="font-black text-lg md:text-xl italic text-white text-shadow-sm uppercase">
          {banner.headline}
        </h3>
      </div>
      <a 
        href={banner.cta_url}
        onClick={(e) => {
          e.preventDefault();
          if (onNavigate) {
            onNavigate(banner.cta_url);
          } else {
            alert("Travel OS Direct App Downloader Code: SMS 'TRAVEL' to 56161 to get direct Google Play link!");
          }
        }}
        className="bg-white hover:bg-slate-100 border-3 border-black text-black font-black px-6 py-2.5 rounded-xl shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:translate-y-0.5 active:shadow-none transition-all uppercase text-xs whitespace-nowrap cursor-pointer"
      >
        {banner.cta_text}
      </a>
    </div>
  );
}

interface FooterSectionData {
  title: string;
  links: { label: string; url: string }[];
}

function SEOMegaFooter({ onNavigate }: { onNavigate?: (path: string) => void }) {
  const [footerData, setFooterData] = useState<FooterSectionData[]>([]);
  const [expandedSection, setExpandedSection] = useState<number | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/showcase/footer`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setFooterData(data);
      })
      .catch(() => {
        // Fallback mock SEO footer links
        setFooterData([
          {
            title: "Top Routes",
            links: [
              { label: "Delhi to Mumbai Flights", url: "/flights" },
              { label: "Delhi to Goa Trains", url: "/trains" }
            ]
          },
          {
            title: "Popular Cities",
            links: [
              { label: "Goa Beach Hotels", url: "/hotels" },
              { label: "Manali Cab Transfers", url: "/cabs" }
            ]
          },
          {
            title: "Corporate info",
            links: [
              { label: "myBiz Corporate Portal", url: "/mybiz" },
              { label: "Developer APIs Settings", url: "/admin" }
            ]
          },
          {
            title: "Products",
            links: [
              { label: "Travel Health Insurance", url: "/explore" },
              { label: "Forex Cards & Exchange", url: "/explore" }
            ]
          }
        ]);
      });
  }, []);

  const toggleSection = (idx: number) => {
    setExpandedSection(prev => prev === idx ? null : idx);
  };

  return (
    <footer className="border-t-4 border-black mt-12 pt-12 px-8 bg-[#090d16] text-slate-300 font-sans">
      <div className="max-w-6xl mx-auto pb-10">
        
        {/* Desktop View: Grid */}
        <div className="hidden md:grid grid-cols-4 gap-8">
          {footerData.map((section, idx) => (
            <div key={idx} className="space-y-4">
              <h5 className="font-extrabold text-sm text-slate-200 border-b-2 border-black pb-2 text-left">{section.title}</h5>
              <nav>
                <ul className="space-y-2 text-left">
                  {section.links.map((link, lIdx) => (
                    <li key={lIdx}>
                      <a 
                        href={link.url} 
                        onClick={(e) => {
                          if (onNavigate) {
                            e.preventDefault();
                            onNavigate(link.url);
                          }
                        }}
                        className="text-slate-400 hover:text-white font-bold hover:underline transition-all text-xs"
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            </div>
          ))}
        </div>

        {/* Mobile View: Accordion */}
        <div className="md:hidden space-y-3">
          {footerData.map((section, idx) => {
            const isExpanded = expandedSection === idx;
            return (
              <div key={idx} className="border-3 border-black rounded-xl bg-slate-900 overflow-hidden">
                <button 
                  onClick={() => toggleSection(idx)}
                  className="w-full p-4 flex justify-between items-center font-black text-xs uppercase text-white bg-slate-800"
                >
                  <span>{section.title}</span>
                  <span className="font-black text-sm">{isExpanded ? "−" : "+"}</span>
                </button>
                {isExpanded && (
                  <nav className="p-4 bg-slate-900 border-t-2 border-black">
                    <ul className="space-y-2 text-left">
                      {section.links.map((link, lIdx) => (
                        <li key={lIdx}>
                          <a 
                            href={link.url} 
                            onClick={(e) => {
                              if (onNavigate) {
                                e.preventDefault();
                                onNavigate(link.url);
                              }
                            }}
                            className="text-slate-400 hover:text-white font-bold text-xs block py-1"
                          >
                            {link.label}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </nav>
                )}
              </div>
            );
          })}
        </div>

        {/* Play Store Download and copyright */}
        <div className="border-t-3 border-black mt-10 pt-8 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-left space-y-1">
            <h5 className="font-extrabold text-xs text-slate-200">DOWNLOAD TRAVEL OS APP</h5>
            <div className="bg-white border-2 border-black p-2.5 rounded-xl flex items-center gap-2 cursor-pointer text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-0.5 transition-transform">
              <Compass size={20} className="text-blue-500" />
              <div>
                <div className="text-[8px] text-slate-500 font-bold uppercase">GET IT ON</div>
                <div className="font-black text-xs text-black">Google Play Store</div>
              </div>
            </div>
          </div>
          <div className="text-center md:text-right text-[10px] text-slate-500 font-bold max-w-md leading-relaxed">
            © 2026 Travel OS Monolith Operating System. Built with React, FastAPI, LangGraph, and Tailwind v4. All rights reserved.
          </div>
        </div>

      </div>
    </footer>
  );
}

/* ---------------------------------------------------- */
/* 9. PHASE 10 DETAILED MODALS & ACCOUNT DASHBOARDS      */
/* ---------------------------------------------------- */

interface ProductDetailModalProps {
  vertical: string;
  item: any;
  currency: string;
  onBook: (data: any) => void;
  onClose: () => void;
  wishlistItems: any[];
  setWishlistItems: any;
}

function ProductDetailModal({ vertical, item, currency, onBook, onClose, wishlistItems, setWishlistItems }: ProductDetailModalProps) {
  const [fareClass, setFareClass] = useState<'saver' | 'flexi'>('saver');
  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<string>('deluxe');
  const [addOns, setAddOns] = useState<string[]>([]);
  const [trainClass, setTrainClass] = useState<string>('3A');
  const [busSeats, setBusSeats] = useState<string[]>([]);
  const [visaDate, setVisaDate] = useState<string>("2026-12-18");
  const [forexMode, setForexMode] = useState<'home' | 'branch'>('home');
  const [forexAmt, setForexAmt] = useState<number>(1000);
  const [insPlan, setInsPlan] = useState<'basic' | 'premier'>('basic');
  const [tourPax, setTourPax] = useState<number>(1);
  const [cruiseCabin, setCruiseCabin] = useState<'ocean' | 'suite'>('ocean');

  const handleSeatClick = (seat: string) => {
    if (selectedSeats.includes(seat)) {
      setSelectedSeats(prev => prev.filter(s => s !== seat));
    } else {
      setSelectedSeats(prev => [...prev, seat]);
    }
  };

  const handleBusSeatClick = (seat: string) => {
    if (busSeats.includes(seat)) {
      setBusSeats(prev => prev.filter(s => s !== seat));
    } else {
      setBusSeats(prev => [...prev, seat]);
    }
  };

  const handleAddOnClick = (addon: string) => {
    if (addOns.includes(addon)) {
      setAddOns(prev => prev.filter(a => a !== addon));
    } else {
      setAddOns(prev => [...prev, addon]);
    }
  };

  const calculateAmount = () => {
    let base = item.price || item.total_cost || 4500;
    if (vertical === 'flights') {
      if (fareClass === 'flexi') base += 1200;
    } else if (vertical === 'hotels') {
      if (selectedRoom === 'executive') base += 4500;
    } else if (vertical === 'holidays') {
      if (addOns.includes('cab')) base += 3000;
      if (addOns.includes('dinner')) base += 1500;
      if (addOns.includes('scuba')) base += 4000;
    } else if (vertical === 'trains') {
      if (trainClass === '2A') base += 400;
      if (trainClass === '1A') base += 1000;
      if (trainClass === 'SL') base = 420;
    } else if (vertical === 'tours') {
      base = base * tourPax;
    } else if (vertical === 'cruises') {
      if (cruiseCabin === 'suite') base += 15000;
    } else if (vertical === 'forex') {
      base = forexAmt * 83.5;
    } else if (vertical === 'insurance') {
      base = insPlan === 'premier' ? 1499 : 499;
    }
    return base;
  };

  const handleProceed = () => {
    onBook({
      vertical,
      amount: calculateAmount(),
      details: {
        item,
        fareClass,
        selectedSeats,
        selectedRoom,
        addOns,
        trainClass,
        busSeats,
        visaDate,
        forexMode,
        forexAmt,
        insPlan,
        tourPax,
        cruiseCabin
      },
      title: item.name || item.title || item.airline || `Travel OS ${vertical.toUpperCase()} Order`,
      subtitle: item.details || item.duration || `${vertical.toUpperCase()} Configured Details`
    });
  };

  const itemName = item.name || item.title || item.airline || `Travel OS ${vertical.toUpperCase()} Item`;
  const isInWishlist = wishlistItems.some(i => i.vertical === vertical && i.name === itemName);

  const handleWishlistToggle = () => {
    if (isInWishlist) {
      setWishlistItems((prev: any[]) => prev.filter(i => !(i.vertical === vertical && i.name === itemName)));
    } else {
      const newItem = {
        id: Date.now(),
        vertical: vertical,
        name: itemName,
        details: item.details || item.duration || `${vertical.toUpperCase()} Details`,
        price: item.price || item.total_cost || 4500,
        rating: item.rating || "4.8 ★"
      };
      setWishlistItems((prev: any[]) => [...prev, newItem]);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border-4 border-black text-black w-full max-w-3xl rounded-2xl shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-6 space-y-6 text-left my-8">
        
        {/* Header */}
        <div className="flex justify-between items-center border-b-3 border-black pb-3">
          <div>
            <span className="text-[10px] bg-slate-900 text-white px-2 py-0.5 rounded font-black uppercase tracking-wider">{vertical} Details</span>
            <h3 className="font-black text-xl italic uppercase tracking-wider mt-1">{itemName}</h3>
          </div>
          <div className="flex items-center gap-2">
            <button 
              type="button"
              onClick={handleWishlistToggle}
              className={`font-extrabold text-sm border-2 border-black px-3 py-1 cursor-pointer flex items-center gap-1.5 transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-px ${
                isInWishlist ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-yellow-300 text-black hover:bg-yellow-400'
              }`}
            >
              <Heart size={14} className={isInWishlist ? "fill-current text-white" : "text-black"} />
              {isInWishlist ? "SAVED" : "SAVE TO WISHLIST"}
            </button>
            <button onClick={onClose} className="font-extrabold text-sm hover:text-red-500 font-bold border-2 border-black px-3 py-1 hover:bg-slate-100 cursor-pointer shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-px">✕ CLOSE</button>
          </div>
        </div>

        {/* Content Swapper per Vertical */}
        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 scrollbar-thin">
          
          {/* FLIGHTS */}
          {vertical === 'flights' && (
            <div className="space-y-4">
              {/* Fare options */}
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setFareClass('saver')} className={`p-3 border-3 border-black text-left rounded-xl transition-all cursor-pointer ${fareClass === 'saver' ? 'bg-yellow-300 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]' : 'bg-white'}`}>
                  <span className="font-black text-sm uppercase block">Saver Fare</span>
                  <span className="text-[10px] text-slate-500 font-bold block">Base price included. Cabin 7kg limit. No seat select.</span>
                </button>
                <button onClick={() => setFareClass('flexi')} className={`p-3 border-3 border-black text-left rounded-xl transition-all cursor-pointer ${fareClass === 'flexi' ? 'bg-yellow-300 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]' : 'bg-white'}`}>
                  <span className="font-black text-sm uppercase block">Flexi Fare (+₹1,200)</span>
                  <span className="text-[10px] text-slate-500 font-bold block">Cabin 7kg + Check-in 15kg. Free seat selection. free meals.</span>
                </button>
              </div>

              {/* Seat Selector Grid */}
              <div className="border-3 border-black p-4 rounded-xl bg-slate-950 text-white text-center">
                <span className="text-[9px] bg-blue-600 text-white px-2 py-0.5 rounded font-black uppercase mb-3 inline-block">Select Seats ({selectedSeats.length} chosen)</span>
                <div className="grid grid-cols-6 gap-2 max-w-sm mx-auto">
                  {['1A','1B','1C','','1D','1E','1F','2A','2B','2C','','2D','2E','2F','3A','3B','3C','','3D','3E','3F'].map((seat, sIdx) => {
                    if (seat === '') return <div key={sIdx} className="w-8 h-8 flex items-center justify-center font-bold text-slate-600 text-[10px]">AISLE</div>;
                    const isSelected = selectedSeats.includes(seat);
                    return (
                      <button 
                        type="button"
                        key={sIdx}
                        onClick={() => handleSeatClick(seat)}
                        className={`w-8 h-8 rounded border text-[9px] font-black cursor-pointer transition-colors ${isSelected ? 'bg-yellow-400 text-black border-black' : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'}`}
                      >
                        {seat}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* HOTELS */}
          {vertical === 'hotels' && (
            <div className="space-y-4">
              {/* Photo Lightbox gallery */}
              <div className="grid grid-cols-3 gap-2">
                <div className="h-24 rounded-lg border-2 border-black overflow-hidden"><img src="https://images.unsplash.com/photo-1566073771259-6a8506099945?w=200" alt="Taj" className="w-full h-full object-cover" /></div>
                <div className="h-24 rounded-lg border-2 border-black overflow-hidden"><img src="https://images.unsplash.com/photo-1582719508461-905c673771fd?w=200" alt="Taj Bed" className="w-full h-full object-cover" /></div>
                <div className="h-24 rounded-lg border-2 border-black overflow-hidden"><img src="https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=200" alt="Taj Pool" className="w-full h-full object-cover" /></div>
              </div>

              {/* Room selector */}
              <div className="space-y-2">
                <span className="text-[10px] uppercase font-black tracking-wider block">Choose Room Category:</span>
                <label className={`flex justify-between items-center p-3 border-2 border-black rounded-lg cursor-pointer ${selectedRoom === 'deluxe' ? 'bg-yellow-300' : 'bg-white'}`}>
                  <div className="flex items-center gap-2">
                    <input type="radio" checked={selectedRoom === 'deluxe'} onChange={() => setSelectedRoom('deluxe')} className="accent-black" />
                    <span className="font-bold text-xs uppercase">Deluxe Room (Base fare)</span>
                  </div>
                  <span className="text-xs font-bold">Queen bed, City view</span>
                </label>
                <label className={`flex justify-between items-center p-3 border-2 border-black rounded-lg cursor-pointer ${selectedRoom === 'executive' ? 'bg-yellow-300' : 'bg-white'}`}>
                  <div className="flex items-center gap-2">
                    <input type="radio" checked={selectedRoom === 'executive'} onChange={() => setSelectedRoom('executive')} className="accent-black" />
                    <span className="font-bold text-xs uppercase">Executive Suite (+₹4,500)</span>
                  </div>
                  <span className="text-xs font-bold">King bed, Ocean view, Lounge Access</span>
                </label>
              </div>

              <div className="border-2 border-black p-3 bg-slate-50 text-xs font-bold space-y-1">
                <div>🏊 Amenities: Pool, Free Spa Credits, High-Speed Wi-Fi, Gym Access</div>
                <div>📍 Location: Heritage Palace Drive, 500m from Beach</div>
              </div>
            </div>
          )}

          {/* VILLAS */}
          {vertical === 'villas' && (
            <div className="space-y-4">
              <div className="border-3 border-black p-4 rounded-xl bg-slate-50 text-xs font-bold space-y-2">
                <h5 className="font-black text-sm uppercase">Villa Guest Guidelines & Rules</h5>
                <div>✓ No music outside after 10:00 PM</div>
                <div>✓ Pets allowed in lawns</div>
                <div>✓ Kitchen access included</div>
              </div>
              <div className="flex items-center gap-3 border-2 border-black p-3 rounded-xl bg-yellow-50">
                <div className="w-10 h-10 rounded-full bg-slate-300 border-2 border-black flex items-center justify-center font-bold text-sm">VS</div>
                <div className="text-xs text-left">
                  <div className="font-black">Hosted by Vikram Singh</div>
                  <div className="text-[10px] text-slate-500 font-bold">Superhost • 4.9 ★ Rating • Response: 100%</div>
                </div>
              </div>
            </div>
          )}

          {/* HOLIDAYS */}
          {vertical === 'holidays' && (
            <div className="space-y-4">
              {/* Addons checklist */}
              <div className="space-y-2 border-3 border-black p-4 rounded-xl bg-slate-50">
                <span className="text-[10px] uppercase font-black block mb-2">Configure Package Add-Ons:</span>
                <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                  <input type="checkbox" checked={addOns.includes('cab')} onChange={() => handleAddOnClick('cab')} className="accent-black" />
                  Add Private Sedan transfer (+₹3,000)
                </label>
                <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                  <input type="checkbox" checked={addOns.includes('dinner')} onChange={() => handleAddOnClick('dinner')} className="accent-black" />
                  Add Buffet Dinner Package (+₹1,500)
                </label>
                <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                  <input type="checkbox" checked={addOns.includes('scuba')} onChange={() => handleAddOnClick('scuba')} className="accent-black" />
                  Add Scuba Diving Experience (+₹4,000)
                </label>
              </div>

              {/* Day-by-Day timeline */}
              <div className="border-2 border-black p-3 bg-white space-y-2 text-xs font-semibold">
                <div className="flex gap-2"><span className="font-black text-blue-600">Day 1</span><span>Arrival & Beach Sunset Dinner</span></div>
                <div className="flex gap-2"><span className="font-black text-blue-600">Day 2</span><span>Scuba Diving & Sightseeing</span></div>
                <div className="flex gap-2"><span className="font-black text-blue-600">Day 3</span><span>Heritage Drive & Departure</span></div>
              </div>
            </div>
          )}

          {/* TRAINS */}
          {vertical === 'trains' && (
            <div className="space-y-3">
              <span className="text-[10px] uppercase font-black block">Select Class Type:</span>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setTrainClass('SL')} className={`p-3 border-2 border-black text-left rounded-xl transition-all cursor-pointer ${trainClass === 'SL' ? 'bg-yellow-300' : 'bg-white'}`}>
                  <span className="font-black text-sm uppercase block">Sleeper (SL) - ₹420</span>
                  <span className="text-[10px] text-slate-500 font-bold block">WL 12 (Waitlist position forecast 85%)</span>
                </button>
                <button onClick={() => setTrainClass('3A')} className={`p-3 border-2 border-black text-left rounded-xl transition-all cursor-pointer ${trainClass === '3A' ? 'bg-yellow-300' : 'bg-white'}`}>
                  <span className="font-black text-sm uppercase block">AC 3 Tier (3A) - ₹1,050</span>
                  <span className="text-[10px] text-slate-500 font-bold block">Available 45 seats</span>
                </button>
                <button onClick={() => setTrainClass('2A')} className={`p-3 border-2 border-black text-left rounded-xl transition-all cursor-pointer ${trainClass === '2A' ? 'bg-yellow-300' : 'bg-white'}`}>
                  <span className="font-black text-sm uppercase block">AC 2 Tier (2A) - ₹1,480</span>
                  <span className="text-[10px] text-slate-500 font-bold block">Available 18 seats</span>
                </button>
                <button onClick={() => setTrainClass('1A')} className={`p-3 border-2 border-black text-left rounded-xl transition-all cursor-pointer ${trainClass === '1A' ? 'bg-yellow-300' : 'bg-white'}`}>
                  <span className="font-black text-sm uppercase block">AC First Class (1A) - ₹2,100</span>
                  <span className="text-[10px] text-slate-500 font-bold block">Available 4 seats</span>
                </button>
              </div>
            </div>
          )}

          {/* BUSES */}
          {vertical === 'buses' && (
            <div className="space-y-4">
              {/* Bus Seat selection grid */}
              <div className="border-3 border-black p-4 rounded-xl bg-slate-900 text-white text-center">
                <span className="text-[9px] bg-red-500 text-white px-2 py-0.5 rounded font-black uppercase mb-3 inline-block">AC Sleeper Layout</span>
                <div className="grid grid-cols-4 gap-2 max-w-xs mx-auto">
                  {['L1','L2','L3','L4','U1','U2','U3','U4','U5','U6'].map((seat, sIdx) => {
                    const isSelected = busSeats.includes(seat);
                    return (
                      <button 
                        type="button"
                        key={sIdx}
                        onClick={() => handleBusSeatClick(seat)}
                        className={`w-12 h-8 rounded border text-[9px] font-black cursor-pointer transition-colors ${isSelected ? 'bg-yellow-400 text-black border-black' : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'}`}
                      >
                        {seat}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* CABS */}
          {vertical === 'cabs' && (
            <div className="space-y-3">
              <div className="border-3 border-black p-4 rounded-xl bg-slate-50 text-xs font-bold space-y-2">
                <h5 className="font-black text-sm uppercase">Itemized Fare Breakdown</h5>
                <div className="flex justify-between"><span>Base Rate:</span><span>₹3,200</span></div>
                <div className="flex justify-between"><span>Estimated Toll Taxes:</span><span>₹350</span></div>
                <div className="flex justify-between"><span>State Permit Tax:</span><span>₹120</span></div>
                <div className="flex justify-between border-t border-slate-300 pt-1 font-black"><span>Total Cab Fare:</span><span>₹3,670</span></div>
              </div>
              <div className="border-2 border-black p-3 bg-yellow-50 text-xs font-bold">
                🚙 Toyota Innova Crysta | AC 7-Seater | Professional Driver Assigned
              </div>
            </div>
          )}

          {/* TOURS */}
          {vertical === 'tours' && (
            <div className="space-y-4 text-xs font-bold">
              <div className="flex items-center gap-3 bg-slate-50 p-4 border-3 border-black rounded-xl">
                <span>Group Size Count:</span>
                <div className="flex gap-2 items-center">
                  <button onClick={() => setTourPax(Math.max(1, tourPax - 1))} className="w-6 h-6 border-2 border-black rounded bg-white flex items-center justify-center font-black cursor-pointer">-</button>
                  <span className="font-black text-sm">{tourPax} Pax</span>
                  <button onClick={() => setTourPax(tourPax + 1)} className="w-6 h-6 border-2 border-black rounded bg-white flex items-center justify-center font-black cursor-pointer">+</button>
                </div>
              </div>
              <div className="border-2 border-black p-3 bg-white space-y-1">
                <div>⏱️ Duration: 4 Hours Guided Tour</div>
                <div>📍 Meet Point: Heritage Clock Tower Gateway</div>
              </div>
            </div>
          )}

          {/* CRUISES */}
          {vertical === 'cruises' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setCruiseCabin('ocean')} className={`p-3 border-2 border-black text-left rounded-xl transition-all cursor-pointer ${cruiseCabin === 'ocean' ? 'bg-yellow-300' : 'bg-white'}`}>
                  <span className="font-black text-sm uppercase block">Oceanview Cabin</span>
                  <span className="text-[10px] text-slate-500 font-bold block">Base price. Sea window, free meals.</span>
                </button>
                <button onClick={() => setCruiseCabin('suite')} className={`p-3 border-2 border-black text-left rounded-xl transition-all cursor-pointer ${cruiseCabin === 'suite' ? 'bg-yellow-300' : 'bg-white'}`}>
                  <span className="font-black text-sm uppercase block">Balcony Suite (+₹15,000)</span>
                  <span className="text-[10px] text-slate-500 font-bold block">Private balcony, butler service, priority boarding.</span>
                </button>
              </div>
              <div className="border-2 border-black p-3 bg-slate-50 text-xs font-bold">
                🛳️ Itinerary: Singapore ➔ Malacca ➔ Penang ➔ Singapore
              </div>
            </div>
          )}

          {/* VISA */}
          {vertical === 'visa' && (
            <div className="space-y-4 text-xs font-bold text-left">
              <div className="border-3 border-black p-4 rounded-xl bg-slate-50 space-y-2">
                <h5 className="font-black text-sm uppercase">Required Documents Checklist</h5>
                <div>• Valid Passport (min 6 months validity)</div>
                <div>• Two passport size photographs</div>
                <div>• Hotel Booking & Return Flight Tickets</div>
                <div>• Bank Statement (last 3 months)</div>
              </div>

              <div>
                <label className="text-[10px] uppercase font-black block mb-1">Select Interview / Appointment Slot:</label>
                <input type="date" value={visaDate} onChange={(e) => setVisaDate(e.target.value)} className="bg-white border-2 border-black rounded px-3 py-1.5 text-xs font-bold w-full" />
              </div>

              <div>
                <label className="text-[10px] uppercase font-black block mb-1">Upload Mock KYC Docs:</label>
                <input type="file" className="bg-white border-2 border-black rounded p-2 text-xs font-bold w-full" />
              </div>
            </div>
          )}

          {/* FOREX */}
          {vertical === 'forex' && (
            <div className="space-y-4 text-xs font-bold text-left">
              <div className="border-3 border-black p-4 rounded-xl bg-slate-50 space-y-3">
                <h5 className="font-black text-sm uppercase">Exchange Calculator</h5>
                <div className="flex items-center gap-2">
                  <input type="number" value={forexAmt} onChange={(e) => setForexAmt(Number(e.target.value))} className="bg-white border-2 border-black rounded px-3 py-1.5 text-xs font-bold flex-1" />
                  <span className="font-black text-sm">USD</span>
                  <span className="font-black text-sm">➔</span>
                  <span className="font-black text-sm">₹{(forexAmt * 83.5).toLocaleString()} INR</span>
                </div>
                <div className="text-[10px] text-blue-600 font-bold">Exchange Rate Live-Locked at 1 USD = 83.5 INR (TTL 5 mins)</div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] uppercase font-black block">Delivery Channel Mode:</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-1.5 cursor-pointer"><input type="radio" checked={forexMode === 'home'} onChange={() => setForexMode('home')} className="accent-black" /> Home Delivery</label>
                  <label className="flex items-center gap-1.5 cursor-pointer"><input type="radio" checked={forexMode === 'branch'} onChange={() => setForexMode('branch')} className="accent-black" /> Branch Pickup</label>
                </div>
              </div>
            </div>
          )}

          {/* INSURANCE */}
          {vertical === 'insurance' && (
            <div className="space-y-4 text-left text-xs font-bold">
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setInsPlan('basic')} className={`p-3 border-2 border-black text-left rounded-xl transition-all cursor-pointer ${insPlan === 'basic' ? 'bg-yellow-300' : 'bg-white'}`}>
                  <span className="font-black text-sm uppercase block">Basic Cover (₹499)</span>
                  <span className="text-[10px] text-slate-500 font-bold block">Medical coverage up to ₹5 Lakhs, Baggage loss cover.</span>
                </button>
                <button onClick={() => setInsPlan('premier')} className={`p-3 border-2 border-black text-left rounded-xl transition-all cursor-pointer ${insPlan === 'premier' ? 'bg-yellow-300' : 'bg-white'}`}>
                  <span className="font-black text-sm uppercase block">Premier Cover (₹1,499)</span>
                  <span className="text-[10px] text-slate-500 font-bold block">Medical coverage up to ₹25 Lakhs, Trip delay & cancellation refund.</span>
                </button>
              </div>

              <div className="border-3 border-black p-4 rounded-xl bg-slate-50 space-y-2">
                <h5 className="font-black text-sm uppercase">Coverage Policy Comparisons</h5>
                <div className="flex justify-between border-b pb-1"><span>Baggage Delay Compensation</span><span>₹10,000 (Basic) vs ₹50,000 (Premier)</span></div>
                <div className="flex justify-between"><span>Accidental Cover limit</span><span>₹2L (Basic) vs ₹10L (Premier)</span></div>
              </div>
            </div>
          )}

        </div>

        {/* Footer Proceed Button */}
        <div className="flex justify-between items-center border-t-3 border-black pt-4 text-left">
          <div>
            <span className="text-[9px] uppercase font-bold text-slate-500 block">Total Configured Amount</span>
            <span className="font-black text-xl text-emerald-600">₹{calculateAmount().toLocaleString()}</span>
          </div>
          <button 
            onClick={handleProceed}
            className="bg-yellow-300 hover:bg-yellow-400 border-3 border-black font-black text-xs py-2.5 px-6 rounded-xl shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:translate-y-0.5 active:shadow-none transition-all uppercase cursor-pointer"
          >
            Continue to Checkout ➔
          </button>
        </div>

      </div>
    </div>
  );
}

/* Landing Offer modal */
function OfferLandingModal({ offer, onClose }: { offer: any, onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white border-4 border-black p-6 max-w-md w-full space-y-4 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] text-black rounded-2xl text-left">
        <div className="flex justify-between items-center border-b-3 border-black pb-2">
          <h3 className="font-black text-base uppercase tracking-wider">Offer Coupon Terms</h3>
          <button onClick={onClose} className="font-extrabold text-sm hover:text-red-500 font-bold cursor-pointer">✕</button>
        </div>
        <div className="bg-yellow-100 border-2 border-dashed border-yellow-600 p-3 rounded text-center">
          <span className="text-[9px] uppercase font-black text-slate-600 block">Promo Code</span>
          <span className="text-xl font-black text-yellow-800 font-mono">{offer.promo_code}</span>
        </div>
        <h4 className="font-black text-base text-black mt-2">{offer.title}</h4>
        <p className="text-xs text-slate-600 font-bold">{offer.description}</p>
        <div className="border-t border-slate-200 pt-3 space-y-1 text-[10px] text-slate-500 font-semibold">
          <div>• Minimum booking transaction value ₹5,000</div>
          <div>• Valid on Travel OS cards only</div>
          <div>• Offer valid until December 31, 2026</div>
        </div>
        <button 
          onClick={() => { alert(`Promo code ${offer.promo_code} copied! Auto-applies at checkout.`); onClose(); }}
          className="w-full bg-yellow-300 hover:bg-yellow-400 border-3 border-black font-black py-2.5 rounded-lg text-xs uppercase cursor-pointer shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-0.5 transition-all text-center animate-bounce"
        >
          Apply & Copy Code
        </button>
      </div>
    </div>
  );
}

/* Landing Partner modal */
function PartnerLandingModal({ partner, onClose }: { partner: any, onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white border-4 border-black p-6 max-w-md w-full space-y-4 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] text-black rounded-2xl text-left">
        <div className="flex justify-between items-center border-b-3 border-black pb-2">
          <h3 className="font-black text-base uppercase tracking-wider">{partner.name} Deals</h3>
          <button onClick={onClose} className="font-extrabold text-sm hover:text-red-500 font-bold cursor-pointer">✕</button>
        </div>
        <h4 className="font-black text-sm uppercase text-slate-600">Exclusive routes & rates available:</h4>
        <div className="space-y-2">
          <div className="flex justify-between items-center border-2 border-black p-2.5 rounded bg-slate-50">
            <span className="text-xs font-black">Delhi ➔ Goa</span>
            <span className="text-xs font-black text-emerald-600 font-black">Starting at ₹4,800</span>
          </div>
          <div className="flex justify-between items-center border-2 border-black p-2.5 rounded bg-slate-50">
            <span className="text-xs font-black">Mumbai ➔ Bangalore</span>
            <span className="text-xs font-black text-emerald-600 font-black">Starting at ₹3,200</span>
          </div>
        </div>
        <button 
          onClick={onClose}
          className="w-full bg-yellow-300 hover:bg-yellow-400 border-3 border-black font-black py-2.5 rounded-lg text-xs uppercase cursor-pointer"
        >
          Check Live Inventory
        </button>
      </div>
    </div>
  );
}

/* Landing Destination modal */
function DestinationLandingModal({ destination, onClose, onPlanTrigger }: { destination: any, onClose: () => void, onPlanTrigger: (name: string) => void }) {
  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white border-4 border-black text-black w-full max-w-lg rounded-2xl shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-6 space-y-4 text-left">
        <div className="flex justify-between items-center border-b-3 border-black pb-2">
          <h3 className="font-black text-base uppercase tracking-wider">Destination Guide</h3>
          <button onClick={onClose} className="font-extrabold text-sm hover:text-red-500 font-bold cursor-pointer">✕</button>
        </div>
        <div className="relative h-40 border-3 border-black rounded-xl overflow-hidden">
          <img src={destination.img} alt={destination.title} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/20"></div>
          <span className="absolute bottom-2 left-2 text-white font-black text-lg bg-black/75 px-3 py-1 rounded border border-white/10 uppercase font-sans tracking-wide">{destination.title}</span>
        </div>

        {/* Weather widget intelligence agent */}
        <div className="border-3 border-black p-3 bg-blue-50 rounded-xl flex justify-between items-center">
          <div className="text-xs font-bold text-slate-700">
            <div className="font-black text-slate-900 uppercase">Weather Intelligence Agent</div>
            <div>Temp: 22°C • Clear Skies</div>
            <div>Best Time to Visit: Oct ➔ March</div>
          </div>
          <span className="text-3xl">☀️</span>
        </div>

        <p className="text-xs text-slate-600 font-semibold leading-normal">
          Explore this breathtaking destination with handpicked packages, luxury beach stays, local guided group tours, and convenient cab transfers.
        </p>

        <button 
          onClick={() => onPlanTrigger(destination.title)}
          className="w-full bg-yellow-300 hover:bg-yellow-400 border-3 border-black font-black py-2.5 rounded-lg text-xs uppercase cursor-pointer text-center"
        >
          🤖 Plan a Trip Here (Ask AI Agent)
        </button>
      </div>
    </div>
  );
}

/* Flight tracker status modal */
function FlightTrackerModal({ flightNum, onClose }: { flightNum: string, onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white border-4 border-black p-6 max-w-md w-full space-y-4 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] text-black rounded-2xl text-left">
        <div className="flex justify-between items-center border-b-3 border-black pb-2">
          <h3 className="font-black text-base uppercase tracking-wider flex items-center gap-1.5">✈ Live Flight Tracker ({flightNum})</h3>
          <button onClick={onClose} className="font-extrabold text-sm hover:text-red-500 font-bold cursor-pointer">✕</button>
        </div>

        <div className="bg-slate-100 p-3 rounded-lg border-2 border-black text-xs font-bold">
          <div className="flex justify-between"><span>Departure terminal:</span><span>T3, Delhi</span></div>
          <div className="flex justify-between"><span>Arrival Gate:</span><span>G12, Goa</span></div>
        </div>

        {/* Tracker timeline */}
        <div className="space-y-4 relative border-l-2 border-dashed border-blue-500 pl-4 py-2 font-bold text-xs">
          <div className="relative">
            <span className="absolute -left-[21px] top-0.5 w-2 h-2 rounded-full bg-emerald-600 border border-black"></span>
            <div className="text-slate-500">Scheduled ➔ 08:15 AM</div>
          </div>
          <div className="relative">
            <span className="absolute -left-[21px] top-0.5 w-2 h-2 rounded-full bg-emerald-600 border border-black"></span>
            <div className="text-slate-500">Departed ➔ 08:22 AM</div>
          </div>
          <div className="relative">
            <span className="absolute -left-[23px] top-0.5 w-3 h-3 rounded-full bg-blue-600 border-2 border-black animate-ping"></span>
            <div className="text-blue-600">IN-AIR ➔ Speed: 820 km/h • Alt: 32,000 ft</div>
          </div>
          <div className="relative">
            <span className="absolute -left-[21px] top-0.5 w-2 h-2 rounded-full bg-slate-300 border border-black"></span>
            <div className="text-slate-400">Landed ➔ ETA 10:45 AM</div>
          </div>
        </div>

        <button 
          onClick={onClose}
          className="w-full bg-yellow-300 hover:bg-yellow-400 border-3 border-black font-black py-2.5 rounded-lg text-xs uppercase cursor-pointer"
        >
          Done
        </button>
      </div>
    </div>
  );
}

/* Wishlist Modal */
function WishlistModal({ items, setItems, onBook, onClose }: { items: any[], setItems: any, onBook: (item: any) => void, onClose: () => void }) {
  const handleRemove = (id: number) => {
    setItems((prev: any[]) => prev.filter(i => i.id !== id));
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white border-4 border-black p-6 max-w-lg w-full space-y-4 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] text-black rounded-2xl text-left">
        <div className="flex justify-between items-center border-b-3 border-black pb-2">
          <h3 className="font-black text-base uppercase tracking-wider flex items-center gap-1.5">❤️ Wishlist Saved Items</h3>
          <button onClick={onClose} className="font-extrabold text-sm hover:text-red-500 font-bold cursor-pointer">✕</button>
        </div>

        {items.length === 0 ? (
          <p className="text-xs text-slate-500 font-bold py-6 text-center">Your wishlist is empty.</p>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
            {items.map((item) => (
              <div key={item.id} className="border-2 border-black p-3 rounded bg-slate-50 flex justify-between items-center">
                <div className="text-left">
                  <span className="text-[8px] bg-slate-900 text-white font-black px-1.5 py-0.5 rounded tracking-wide uppercase">{item.vertical}</span>
                  <h4 className="font-black text-sm text-black mt-1">{item.name}</h4>
                  <p className="text-[10px] text-slate-500 font-bold">{item.details}</p>
                  <span className="text-[10px] font-black text-emerald-600 block mt-1">₹{item.price.toLocaleString()}</span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => onBook(item)} className="bg-yellow-300 text-[10px] font-black border-2 border-black px-2.5 py-1 rounded shadow cursor-pointer uppercase">Book</button>
                  <button onClick={() => handleRemove(item.id)} className="bg-red-200 text-[10px] font-black border-2 border-black px-2.5 py-1 rounded text-red-900 cursor-pointer uppercase">Remove</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* Account Profile Modal */
function AccountProfileModal({ userProfile, setUserProfile, onClose }: { userProfile: any, setUserProfile: any, onClose: () => void }) {
  const [email, setEmail] = useState(userProfile.email);
  const [savedTravelers, setSavedTravelers] = useState<string[]>(["Vikram Singh (32)", "Ananya Sen (29)"]);
  const [newTraveler, setNewTraveler] = useState("");

  const handleSave = () => {
    setUserProfile((prev: any) => ({ ...prev, email }));
    alert("Profile saved successfully!");
  };

  const handleAddTraveler = () => {
    if (newTraveler.trim() !== "") {
      setSavedTravelers(prev => [...prev, newTraveler]);
      setNewTraveler("");
    }
  };

  const handleRemoveTraveler = (idx: number) => {
    setSavedTravelers(prev => prev.filter((_, i) => i !== idx));
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white border-4 border-black p-6 max-w-md w-full space-y-4 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] text-black rounded-2xl text-left">
        <div className="flex justify-between items-center border-b-3 border-black pb-2">
          <h3 className="font-black text-base uppercase tracking-wider flex items-center gap-1.5">👤 Personal Traveler Profile</h3>
          <button onClick={onClose} className="font-extrabold text-sm hover:text-red-500 font-bold cursor-pointer">✕</button>
        </div>

        {/* KYC Verification status */}
        <div className="bg-emerald-50 border-2 border-emerald-600 p-2.5 rounded text-emerald-800 flex justify-between items-center text-xs font-bold">
          <span>✓ KYC Identity Verification Status:</span>
          <span className="bg-emerald-600 text-white font-black text-[9px] px-2 py-0.5 rounded">VERIFIED</span>
        </div>

        {/* Account Info Form */}
        <div className="space-y-3">
          <div>
            <label className="text-[10px] uppercase font-black text-slate-500">Email Address</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-white border-2 border-black rounded px-3 py-1.5 text-xs font-bold" />
          </div>
          <button onClick={handleSave} className="bg-slate-900 text-white text-[10px] font-black border-2 border-black px-4 py-2 rounded-lg cursor-pointer uppercase">Save Profile</button>
        </div>

        {/* Saved Travelers CRUD */}
        <div className="border-t-2 border-black pt-3 space-y-2">
          <span className="text-[10px] uppercase font-black text-slate-500 block">Manage Saved Travelers:</span>
          <div className="flex gap-2">
            <input type="text" placeholder="Name (Age)" value={newTraveler} onChange={(e) => setNewTraveler(e.target.value)} className="bg-white border-2 border-black rounded px-3 py-1 text-xs font-bold flex-1" />
            <button onClick={handleAddTraveler} className="bg-yellow-300 text-[10px] font-black border-2 border-black px-3 py-1 rounded cursor-pointer uppercase">Add</button>
          </div>
          <div className="space-y-1 mt-2">
            {savedTravelers.map((name, idx) => (
              <div key={idx} className="flex justify-between items-center bg-slate-50 border border-slate-300 p-1.5 rounded text-xs font-bold">
                <span>{name}</span>
                <button onClick={() => handleRemoveTraveler(idx)} className="text-red-600 hover:text-red-800 font-bold text-[10px] uppercase cursor-pointer">Remove</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* myBiz Organational portal dashboard */
function MyBizDashboardModal({ onClose }: { onClose: () => void }) {
  const [approvals, setApprovals] = useState<any[]>([
    { id: 1, traveler: "Rahul Sen", vertical: "Flight", cost: 12500, status: "pending", details: "Delhi to Singapore Business Meeting" },
    { id: 2, traveler: "Kriti Sharma", vertical: "Hotel", cost: 8900, status: "pending", details: "Mumbai Taj Palace Stay" }
  ]);

  const handleApprove = (id: number) => {
    setApprovals(prev => prev.map(a => a.id === id ? { ...a, status: "approved" } : a));
    alert("Travel request approved successfully!");
  };

  const handleReject = (id: number) => {
    setApprovals(prev => prev.map(a => a.id === id ? { ...a, status: "rejected" } : a));
    alert("Travel request rejected.");
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white border-4 border-black p-6 max-w-lg w-full space-y-4 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] text-black rounded-2xl text-left">
        <div className="flex justify-between items-center border-b-3 border-black pb-2">
          <h3 className="font-black text-base uppercase tracking-wider flex items-center gap-1.5">💼 myBiz Corporate Dashboard</h3>
          <button onClick={onClose} className="font-extrabold text-sm hover:text-red-500 font-bold cursor-pointer">✕</button>
        </div>

        {/* Corporate budgets details */}
        <div className="grid grid-cols-2 gap-2 text-xs font-bold">
          <div className="bg-blue-50 border-2 border-black p-2.5 rounded">
            <span className="text-[8px] text-slate-500 uppercase block font-bold">Monthly Budget Limit</span>
            <span className="text-sm font-black">₹2,50,000</span>
          </div>
          <div className="bg-emerald-50 border-2 border-black p-2.5 rounded">
            <span className="text-[8px] text-slate-500 uppercase block font-bold">Spent Budget Status</span>
            <span className="text-sm font-black text-emerald-700">₹82,400</span>
          </div>
        </div>

        {/* Pending approvals CRUD list */}
        <div className="space-y-3">
          <span className="text-[10px] uppercase font-black text-slate-500 block">Pending Travel Approvals Queue:</span>
          {approvals.length === 0 ? (
            <p className="text-xs text-slate-400 font-bold">No pending approvals.</p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {approvals.map((req) => (
                <div key={req.id} className="border-2 border-black p-3 rounded bg-slate-50 space-y-2">
                  <div className="flex justify-between text-[10px] font-bold">
                    <span className="font-black uppercase">{req.traveler} ({req.vertical})</span>
                    <span className={`px-1.5 py-0.5 rounded border border-black uppercase text-[8px] font-black ${
                      req.status === 'pending' ? 'bg-amber-300' :
                      req.status === 'approved' ? 'bg-emerald-300' : 'bg-red-300'
                    }`}>{req.status}</span>
                  </div>
                  <p className="text-xs text-slate-600 font-semibold">{req.details} • Cost: ₹{req.cost.toLocaleString()}</p>
                  
                  {req.status === 'pending' && (
                    <div className="flex gap-2 pt-1">
                      <button onClick={() => handleApprove(req.id)} className="flex-1 bg-emerald-300 text-[10px] font-black border-2 border-black py-1 rounded cursor-pointer uppercase">Approve</button>
                      <button onClick={() => handleReject(req.id)} className="flex-1 bg-red-200 text-[10px] font-black border-2 border-black py-1 rounded cursor-pointer uppercase text-red-900">Reject</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

