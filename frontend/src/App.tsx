import React, { useState, useEffect, useRef } from 'react';
import { 
  Compass, MessageSquare, Wallet, ShieldAlert, Sparkles, Send, Mic, 
  MicOff, Search, Plane, Hotel, Calendar, Users, CheckCircle, RefreshCw,
  TrendingUp, AlertTriangle, ArrowRight, Plus, Check, CreditCard, Tag, Globe, User,
  Heart, ArrowUpDown, ShieldCheck, HelpCircle, MapPin, FileText, ChevronRight, Info,
  Bus, Ship, Coins, Activity, Anchor, Home, Gift, Briefcase, Clock, Trash2,
  Car, Key, Menu, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckoutPage } from './CheckoutPage';
import { ConfirmationPage } from './ConfirmationPage';
import { BookingDetailPage } from './BookingDetailPage';
import { DesignTokensPage } from './DesignTokensPage';
import { ProfilePage } from './ProfilePage';

const resolveApiBase = () => {
  let url = import.meta.env.VITE_API_URL || "https://make-my-trip-production.up.railway.app/api";
  if (url.endsWith("/")) {
    url = url.slice(0, -1);
  }
  if (url.endsWith("/v1")) {
    url = url.slice(0, -3);
  }
  return url;
};

const API_BASE = resolveApiBase();
const API_URL = `${API_BASE}/v1`;
const WS_BASE = API_BASE.replace(/^http/, "ws");
const API_HOST = API_BASE.replace(/\/api$/, "");
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

const decodeJwt = (t: string) => {
  try {
    const base64Url = t.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
};

export default function App() {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [userRole, setUserRole] = useState<string | null>(localStorage.getItem('user_role'));
  const [activeTab, setActiveTab] = useState<'explore' | 'chat' | 'wallet' | 'trips'>('explore');
  const [loadingVerticals, setLoadingVerticals] = useState<Record<string, boolean>>({});
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notificationFilter, setNotificationFilter] = useState("All");
  const [notificationSearch, setNotificationSearch] = useState("");
  const [notifications, setNotifications] = useState<any[]>([
    { id: 1, category: "Flights", title: "✈️ Flight Delay Alert", msg: "Flight AI-312 from Delhi is delayed by 20 minutes due to congestion.", time: "10 mins ago", read: false, priority: "high", deepLink: "/" },
    { id: 2, category: "Hotels", title: "📉 Price Drop Alert", msg: "Goa hotels in your wishlist dropped by 15% for December dates!", time: "2 hours ago", read: false, priority: "medium", deepLink: "/" },
    { id: 3, category: "Emergency", title: "☀️ Weather Warning", msg: "Goa: Heavy rain forecast on 2026-12-16. Pack an umbrella!", time: "1 day ago", read: true, priority: "high", deepLink: "/" },
    { id: 4, category: "Visa", title: "🛂 Visa Verification", msg: "Your Thailand visa request has been approved and issued.", time: "3 days ago", read: true, priority: "medium", deepLink: "/profile" }
  ]);

  const [currency, setCurrency] = useState<'INR' | 'USD' | 'EUR'>('INR');
  const [locale, setLocale] = useState<'en' | 'es' | 'hi'>('en');
  const [userProfile, setUserProfile] = useState<any>({
    email: "traveler@travelos.com",
    tier: "Gold",
    points: 450,
    walletBalance: 24500.00
  });

  const [profileName, setProfileName] = useState("");
  const [profileCompletion, setProfileCompletion] = useState(0);
  const [profileData, setProfileData] = useState<any>(null);

  useEffect(() => {
    if (!token) {
      setProfileName("");
      setProfileCompletion(0);
      setProfileData(null);
      return;
    }
    fetch(`${API_URL}/profile`, {
      headers: { "Authorization": `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data && data.full_name) {
          setProfileName(data.full_name);
          setProfileData(data);
          const fields = [
            data.full_name, data.dob, data.gender, data.nationality, data.mobile_number, data.email, 
            data.country, data.city, data.emergency_name, data.emergency_phone
          ];
          const completed = fields.filter(f => !!f).length;
          setProfileCompletion(Math.round((completed / fields.length) * 100));
        }
      })
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    if (!token) return;
    
    const wsUrl = `${WS_BASE}/v1/tracker/ws/realtime?token=${token}`;
    console.log("LOG: Connecting to Real-Time WebSocket:", wsUrl);
    let socket = new WebSocket(wsUrl);
    let pollingInterval: any = null;
    
    const handleWsMessage = (event: MessageEvent) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.event === "realtime_alerts" && payload.alerts) {
          setNotifications(prev => {
            const merged = [...prev];
            payload.alerts.forEach((newAlert: any) => {
              if (!merged.some(n => n.id === newAlert.id)) {
                merged.unshift({
                  ...newAlert,
                  time: "Just now"
                });
              }
            });
            return merged.slice(0, 50);
          });
        }
      } catch (err) {
        console.warn("WS Message parse failed:", err);
      }
    };
    
    const handleWsClose = () => {
      console.warn("WS disconnected. Falling back to REST polling...");
      pollingInterval = setInterval(() => {
        fetch(`${API_URL}/tracker/realtime`, {
          headers: { "Authorization": `Bearer ${token}` }
        })
          .then(res => res.json())
          .then(data => {
            if (data.alerts) {
              setNotifications(prev => {
                const merged = [...prev];
                data.alerts.forEach((newAlert: any) => {
                  if (!merged.some(n => n.id === newAlert.id)) {
                    merged.unshift(newAlert);
                  }
                });
                return merged.slice(0, 50);
              });
            }
          })
          .catch(err => console.warn("Polling fallback failed:", err));
      }, 10000);
    };
    
    socket.addEventListener("message", handleWsMessage);
    socket.addEventListener("close", handleWsClose);
    
    return () => {
      socket.removeEventListener("message", handleWsMessage);
      socket.removeEventListener("close", handleWsClose);
      socket.close();
      if (pollingInterval) clearInterval(pollingInterval);
    };
  }, [token]);

  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const navigate = (path: string) => {
    console.log("LOG: Router navigation initiated to:", path);
    window.history.pushState(null, '', path);
    setCurrentPath(path);
  };
  useEffect(() => {
    const listener = (vals: Record<string, boolean>) => setLoadingVerticals(vals);
    globalTabLoadingListeners.push(listener);
    return () => {
      globalTabLoadingListeners = globalTabLoadingListeners.filter(l => l !== listener);
    };
  }, []);

  // Global fetch interceptor to handle token refresh and automatic Authorization header insertion
  useEffect(() => {
    const originalFetch = window.fetch;
    let isRefreshing = false;
    let refreshQueue: Array<{ resolve: (token: string | null) => void }> = [];
    
    const executeRefresh = async (): Promise<string | null> => {
      const refreshToken = localStorage.getItem('refresh_token');
      if (!refreshToken) return null;
      
      try {
        const resp = await originalFetch(`${API_URL}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: refreshToken })
        });
        
        if (resp.ok) {
          const data = await resp.json();
          localStorage.setItem('token', data.access_token);
          localStorage.setItem('refresh_token', data.refresh_token);
          setToken(data.access_token);
          const decoded = decodeJwt(data.access_token);
          if (decoded && decoded.role) {
            setUserRole(decoded.role);
            localStorage.setItem('user_role', decoded.role);
            setUserProfile((prev: any) => ({
              ...prev,
              email: decoded.sub || prev.email,
              id: decoded.id
            }));
          }
          return data.access_token;
        } else {
          return null;
        }
      } catch (err) {
        return null;
      }
    };

    const processQueue = (newToken: string | null) => {
      refreshQueue.forEach(prom => prom.resolve(newToken));
      refreshQueue = [];
    };

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const urlStr = typeof input === 'string' ? input : (input instanceof URL ? input.href : input.url);
      const isBackendReq = urlStr.includes(API_URL) || urlStr.startsWith('/api/') || urlStr.startsWith(API_URL);
      const isAuthRoute = urlStr.includes('/auth/token') || urlStr.includes('/auth/signup') || urlStr.includes('/auth/refresh');
      
      let currentToken = localStorage.getItem('token');
      
      if (isBackendReq && !isAuthRoute && currentToken) {
        init = init || {};
        init.headers = init.headers || {};
        
        if (init.headers instanceof Headers) {
          init.headers.set('Authorization', `Bearer ${currentToken}`);
        } else if (Array.isArray(init.headers)) {
          const hasAuth = init.headers.some(([k]) => k.toLowerCase() === 'authorization');
          if (!hasAuth) {
            init.headers.push(['Authorization', `Bearer ${currentToken}`]);
          }
        } else {
          const headersRecord = init.headers as Record<string, string>;
          const keys = Object.keys(headersRecord);
          const authKey = keys.find(k => k.toLowerCase() === 'authorization') || 'Authorization';
          if (!headersRecord[authKey]) {
            headersRecord[authKey] = `Bearer ${currentToken}`;
          }
        }
        
        const decoded = decodeJwt(currentToken);
        const nowSeconds = Math.floor(Date.now() / 1000);
        
        if (decoded && decoded.exp && decoded.exp - nowSeconds <= 10) {
          if (isRefreshing) {
            const newToken = await new Promise<string | null>((resolve) => {
              refreshQueue.push({ resolve });
            });
            if (newToken) {
              currentToken = newToken;
              if (init.headers instanceof Headers) {
                init.headers.set('Authorization', `Bearer ${currentToken}`);
              } else if (Array.isArray(init.headers)) {
                const idx = init.headers.findIndex(([k]) => k.toLowerCase() === 'authorization');
                if (idx !== -1) init.headers[idx] = ['Authorization', `Bearer ${currentToken}`];
              } else {
                const headersRecord = init.headers as Record<string, string>;
                const authKey = Object.keys(headersRecord).find(k => k.toLowerCase() === 'authorization') || 'Authorization';
                headersRecord[authKey] = `Bearer ${currentToken}`;
              }
            } else {
              handleLogout();
              return new Response(JSON.stringify({ detail: "Session Expired" }), { status: 401 });
            }
          } else {
            isRefreshing = true;
            const newToken = await executeRefresh();
            isRefreshing = false;
            processQueue(newToken);
            
            if (newToken) {
              currentToken = newToken;
              if (init.headers instanceof Headers) {
                init.headers.set('Authorization', `Bearer ${currentToken}`);
              } else if (Array.isArray(init.headers)) {
                const idx = init.headers.findIndex(([k]) => k.toLowerCase() === 'authorization');
                if (idx !== -1) init.headers[idx] = ['Authorization', `Bearer ${currentToken}`];
              } else {
                const headersRecord = init.headers as Record<string, string>;
                const authKey = Object.keys(headersRecord).find(k => k.toLowerCase() === 'authorization') || 'Authorization';
                headersRecord[authKey] = `Bearer ${currentToken}`;
              }
            } else {
              handleLogout();
              return new Response(JSON.stringify({ detail: "Session Expired" }), { status: 401 });
            }
          }
        }
      }
      
      let response = await originalFetch(input, init);
      
      if (response.status === 401 && isBackendReq && !isAuthRoute && localStorage.getItem('refresh_token')) {
        if (isRefreshing) {
          const newToken = await new Promise<string | null>((resolve) => {
            refreshQueue.push({ resolve });
          });
          if (newToken) {
            if (init && init.headers) {
              if (init.headers instanceof Headers) {
                init.headers.set('Authorization', `Bearer ${newToken}`);
              } else if (Array.isArray(init.headers)) {
                const idx = init.headers.findIndex(([k]) => k.toLowerCase() === 'authorization');
                if (idx !== -1) init.headers[idx] = ['Authorization', `Bearer ${newToken}`];
              } else {
                const headersRecord = init.headers as Record<string, string>;
                const authKey = Object.keys(headersRecord).find(k => k.toLowerCase() === 'authorization') || 'Authorization';
                headersRecord[authKey] = `Bearer ${newToken}`;
              }
            }
            return originalFetch(input, init);
          }
        } else {
          isRefreshing = true;
          const newToken = await executeRefresh();
          isRefreshing = false;
          processQueue(newToken);
          
          if (newToken) {
            if (init && init.headers) {
              if (init.headers instanceof Headers) {
                init.headers.set('Authorization', `Bearer ${newToken}`);
              } else if (Array.isArray(init.headers)) {
                const idx = init.headers.findIndex(([k]) => k.toLowerCase() === 'authorization');
                if (idx !== -1) init.headers[idx] = ['Authorization', `Bearer ${newToken}`];
              } else {
                const headersRecord = init.headers as Record<string, string>;
                const authKey = Object.keys(headersRecord).find(k => k.toLowerCase() === 'authorization') || 'Authorization';
                headersRecord[authKey] = `Bearer ${newToken}`;
              }
            }
            return originalFetch(input, init);
          } else {
            handleLogout();
          }
        }
      }
      
      return response;
    };
    
    return () => {
      window.fetch = originalFetch;
    };
  }, [token]);

  // Token parsing and session sync using single-use exchange code
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const exchangeCode = params.get('exchange_code');
    const logout = params.get('logout');

    if (logout === 'true') {
      localStorage.removeItem('token');
      localStorage.removeItem('user_role');
      setToken(null);
      setUserRole(null);
      setUserProfile({
        email: "traveler@travelos.com",
        tier: "Gold",
        points: 450,
        walletBalance: 24500.00
      });
      params.delete('logout');
      const newSearch = params.toString();
      const newPath = window.location.pathname + (newSearch ? `?${newSearch}` : '');
      window.history.replaceState({}, '', newPath);
      return;
    }

    if (exchangeCode) {
      // Clean up URL search parameters immediately
      params.delete('exchange_code');
      const newSearch = params.toString();
      const newPath = window.location.pathname + (newSearch ? `?${newSearch}` : '');
      window.history.replaceState({}, '', newPath);

      fetch(`${API_URL}/auth/exchange`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exchange_code: exchangeCode })
      })
      .then(resp => {
        if (!resp.ok) {
          throw new Error("Invalid or expired exchange session.");
        }
        return resp.json();
      })
      .then(data => {
        const qToken = data.token;
        const qRole = data.role;
        const qEmail = data.email;

        localStorage.setItem('token', qToken);
        localStorage.setItem('user_role', qRole);
        setToken(qToken);
        setUserRole(qRole);
        setUserProfile((prev: any) => ({
          ...prev,
          email: qEmail
        }));
      })
      .catch(err => {
        console.error(err.message || "Failed to exchange code.");
      });
    } else if (token) {
      const decoded = decodeJwt(token);
      if (decoded && decoded.role) {
        setUserRole(decoded.role);
        localStorage.setItem('user_role', decoded.role);
        setUserProfile((prev: any) => ({
          ...prev,
          email: decoded.sub || prev.email
        }));
      }
    }
  }, [token]);

  const redirectToAdmin = async (authToken: string) => {
    try {
      const resp = await fetch(`${API_URL}/auth/exchange-code`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${authToken}`
        }
      });
      if (resp.ok) {
        const data = await resp.json();
        const code = data.exchange_code;
        window.location.href = `http://localhost:5174/?exchange_code=${code}`;
      } else {
        window.location.href = "http://localhost:5174/";
      }
    } catch (err) {
      window.location.href = "http://localhost:5174/";
    }
  };

  // Path Interception and Guards
  useEffect(() => {
    if (currentPath === '/admin') {
      if (!token) {
        navigate('/');
      } else {
        const decoded = decodeJwt(token);
        const role = decoded?.role || userRole;
        if (role === 'admin' || role === 'super_admin' || role === 'finance_admin' || role === 'booking_approver') {
          redirectToAdmin(token);
        } else {
          alert("Access denied: You do not have administrative privileges to access the admin panel.");
          navigate('/');
        }
      }
    }
  }, [currentPath, token, userRole, userProfile.email]);

  const handleLogin = (accessToken: string, refreshToken: string, role: string, email: string) => {
    localStorage.setItem('token', accessToken);
    localStorage.setItem('refresh_token', refreshToken);
    localStorage.setItem('user_role', role);
    setToken(accessToken);
    setUserRole(role);
    setUserProfile((prev: any) => ({
      ...prev,
      email: email
    }));

    if (role === 'admin' || role === 'super_admin' || role === 'finance_admin' || role === 'booking_approver') {
      redirectToAdmin(accessToken);
    } else {
      navigate('/');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user_role');
    setToken(null);
    setUserRole(null);
    setUserProfile({
      email: "traveler@travelos.com",
      tier: "Gold",
      points: 450,
      walletBalance: 24500.00
    });
    navigate('/');
  };


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
      headers: { 
        "Content-Type": "application/json",
        ...(token ? { "Authorization": `Bearer ${token}` } : {})
      },
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

  if (!token) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  if (currentPath === "/profile") {
    return <ProfilePage onNavigate={navigate} token={token} />;
  }

  const checkoutMatch = currentPath.match(/^\/checkout\/([^/]+)$/) || currentPath.match(/^\/payment-failed\/([^/]+)$/);
  const confirmationMatch = 
    currentPath.match(/^\/bookings\/([^/]+)\/confirmation$/) || 
    currentPath.match(/^\/booking-confirmation\/([^/]+)$/) || 
    currentPath.match(/^\/payment-success\/([^/]+)$/);
  
  if (checkoutMatch) {
    const bookingId = checkoutMatch[1];
    const initialError = currentPath.startsWith("/payment-failed") ? "Payment attempt was unsuccessful. Please check credentials and try again." : "";
    return <CheckoutPage bookingId={bookingId} onNavigate={navigate} token={token} initialError={initialError} />;
  }
  
  if (confirmationMatch) {
    const bookingId = confirmationMatch[1];
    return <ConfirmationPage bookingId={bookingId} onNavigate={navigate} />;
  }

  const bookingDetailMatch = currentPath.match(/^\/booking\/([^/]+)$/);
  if (bookingDetailMatch) {
    const bookingId = bookingDetailMatch[1];
    return <BookingDetailPage bookingId={bookingId} onNavigate={navigate} token={token} />;
  }

  const rentARideMatch = currentPath.match(/^\/rent-a-ride\/([^?#]+)/);
  if (rentARideMatch) {
    const city = decodeURIComponent(rentARideMatch[1]);
    const params = new URLSearchParams(window.location.search);
    const pickup = params.get("pickup") || "";
    const drop = params.get("drop") || "";
    const type = params.get("type") || "SUV";
    const selfDrive = params.get("selfDrive") !== "false";
    const linkedRef = params.get("linked_booking_reference") || "";
    
    return (
      <RentARidePage 
        city={city}
        pickup={pickup}
        drop={drop}
        initialType={type}
        initialSelfDrive={selfDrive}
        linkedBookingReference={linkedRef}
        onNavigate={navigate}
        onBook={setCheckoutData}
        currency={currency}
      />
    );
  }

  if (currentPath === '/design-tokens') {
    return <DesignTokensPage onNavigate={navigate} />;
  }

  // 404 Page (Phase 17)
  const validPaths = ["/", "/profile", "/design-tokens"];
  const isMatch = 
    validPaths.includes(currentPath) || 
    !!checkoutMatch || 
    !!confirmationMatch || 
    !!bookingDetailMatch || 
    !!rentARideMatch;

  if (!isMatch) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#0a0f1d] text-white font-sans text-center">
        <div className="max-w-md w-full p-8 bg-[#111827] border-4 border-black shadow-[8px_8px_0px_0px_#facc15] space-y-6">
          <h1 className="text-6xl font-black text-yellow-300">404</h1>
          <h2 className="text-xl font-black uppercase text-slate-100">PAGE NOT FOUND</h2>
          <p className="text-xs text-slate-400 font-semibold leading-relaxed">
            The page you are looking for does not exist or has been relocated to another terminal gate.
          </p>
          <button
            onClick={() => navigate("/")}
            className="w-full py-2.5 bg-yellow-300 hover:bg-yellow-400 text-black font-black border-2 border-black shadow-[4px_4px_0px_0px_#000000] active:translate-y-0.5 active:shadow-[2px_2px_0px_0px_#000000] transition-all cursor-pointer text-xs uppercase"
          >
            Return to Explore Gate ➔
          </button>
        </div>
      </div>
    );
  }

  const isAdmin = userRole === 'admin' || userRole === 'super_admin' || userRole === 'finance_admin' || userRole === 'booking_approver';

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {!isOnline && (
        <div className="w-full bg-rose-600 text-white text-xs font-black py-2.5 text-center animate-pulse border-b-2 border-black flex justify-center items-center gap-2 z-50">
          <AlertTriangle size={14} className="text-yellow-300" /> YOU ARE CURRENTLY OFFLINE. LIVE BOOKING & AI PLANS MAY BE UNAVAILABLE.
        </div>
      )}
      {isAdmin && (
        <div className="bg-yellow-300 text-black px-4 py-2.5 text-xs font-black uppercase flex items-center justify-between border-b-3 border-black shadow-[0_2px_4px_rgba(0,0,0,0.15)] z-50">
          <div className="flex items-center gap-2">
            <span className="animate-pulse w-2.5 h-2.5 rounded-full bg-red-600 border border-black inline-block"></span>
            <span>SYSTEM CONTROL ACTIVE: LOGGED IN AS ADMINISTRATOR ({userProfile.email})</span>
          </div>
          <button 
            onClick={() => {
              redirectToAdmin(token || "");
            }}
            className="bg-black hover:bg-slate-900 text-white font-black px-4 py-1.5 border-3 border-black rounded-lg shadow-[2px_2px_0px_0px_rgba(255,255,255,1)] text-[10px] cursor-pointer transition-all uppercase tracking-wider"
          >
            RETURN TO ADMIN CONSOLE ➔
          </button>
        </div>
      )}
      
      <div className="flex flex-1 overflow-hidden font-sans relative text-[var(--color-ivory)] bg-[var(--color-obsidian)]">
      {/* SIDEBAR NAVIGATION BACKDROP ON MOBILE */}
      {isMobileSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden transition-opacity duration-300"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}
      {/* SIDEBAR NAVIGATION */}
      <aside className={`fixed md:static inset-y-0 left-0 w-64 bg-[var(--color-obsidian)] border-r border-slate-800/80 flex flex-col justify-between p-4 z-50 transform ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 transition-transform duration-300 ease-in-out`}>
        <div>
          <div className="flex items-center justify-between mb-8 px-2 py-1">
            <div className="flex items-center gap-2">
              <span className="font-serif italic font-bold text-2xl text-[var(--color-gold)]">T</span>
              <span className="font-serif italic font-black text-sm tracking-wider text-[var(--color-ivory)] flex items-center gap-1">
                TRAVEL OS
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-gold)] animate-pulse-gold inline-block" />
              </span>
            </div>
            <button 
              onClick={() => setIsMobileSidebarOpen(false)}
              className="text-[var(--color-ivory-dim)] hover:text-white md:hidden focus:outline-none cursor-pointer p-1"
              title="Close Menu"
            >
              <X size={20} />
            </button>
          </div>

          <nav className="space-y-1">
            <SidebarBtn 
              active={activeTab === 'explore'} 
              icon={<Compass size={20} />} 
              label="Explore & Book" 
              onClick={() => { setActiveTab('explore'); setIsMobileSidebarOpen(false); }} 
            />
            <SidebarBtn 
              active={activeTab === 'chat'} 
              icon={<MessageSquare size={20} />} 
              label="AI Travel Assistant" 
              onClick={() => { setActiveTab('chat'); setIsMobileSidebarOpen(false); }} 
            />
            <SidebarBtn 
              active={activeTab === 'trips'} 
              icon={<FileText size={20} />} 
              label="My Trips" 
              onClick={() => { setActiveTab('trips'); setIsMobileSidebarOpen(false); }} 
            />
            <SidebarBtn 
              active={activeTab === 'wallet'} 
              icon={<Wallet size={20} />} 
              label="Wallet & Loyalty" 
              onClick={() => { setActiveTab('wallet'); setIsMobileSidebarOpen(false); }} 
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
        <header className="h-16 border-b border-slate-800/80 flex items-center justify-between px-4 md:px-8 bg-[var(--color-obsidian)] z-10 w-full">
          {/* Left Logo */}
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsMobileSidebarOpen(true)}
              className="p-1.5 text-[var(--color-ivory)] hover:text-[var(--color-gold)] focus:outline-none md:hidden cursor-pointer mr-1"
              title="Open Menu"
            >
              <Menu size={24} />
            </button>
            <span className="font-serif italic font-bold text-2xl text-[var(--color-gold)]">T</span>
            <span className="font-serif italic font-black text-sm tracking-wider text-[var(--color-ivory)] flex items-center gap-1">
              TRAVEL OS
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-gold)] animate-pulse-gold inline-block" />
            </span>
          </div>

          {/* Nav Tabs */}
          <nav className="hidden md:flex items-center gap-6 h-full relative">
            {[
              { id: 'explore', label: 'Explore & Book' },
              { id: 'chat', label: 'AI Travel Assistant' },
              { id: 'trips', label: 'My Trips' },
              { id: 'wallet', label: 'Wallet & Loyalty' }
            ].map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`h-full px-1 flex items-center justify-center text-xs font-semibold tracking-wide uppercase transition-all relative cursor-pointer ${
                    isActive ? 'text-[var(--color-gold)] font-bold' : 'text-[var(--color-ivory-dim)] hover:text-[var(--color-gold)]'
                  }`}
                >
                  {tab.label}
                  {isActive && (
                    <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[var(--color-gold)] transition-all" />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Right Side */}
          <div className="flex items-center gap-3 md:gap-6">
            <div className="text-right text-xs hidden sm:block">
              <span className="text-[var(--color-ivory-dim)] text-[10px] uppercase tracking-wider block">Wallet Balance</span>
              <span className="font-mono text-sm font-medium text-[var(--color-gold)] mt-0.5 block">
                {currency === 'INR' ? '₹' : currency === 'USD' ? '$' : '€'}
                {currency === 'INR' ? userProfile.walletBalance.toLocaleString() : (userProfile.walletBalance * 0.012).toFixed(2)}
              </span>
            </div>
            
            {/* Notification Bell */}
            <div className="relative">
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className="text-[var(--color-ivory-dim)] hover:text-[var(--color-gold)] relative p-2 cursor-pointer transition-colors bg-transparent border-none flex items-center justify-center rounded-lg hover:bg-slate-800"
              >
                <span className="relative text-lg">🔔</span>
                {notifications.some(n => !n.read) && (
                  <span className="absolute top-1 right-1 bg-red-500 border border-slate-900 w-2.5 h-2.5 rounded-full" />
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 mt-3 w-96 bg-[#0c111d] border-4 border-black p-5 rounded-2xl shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] text-white z-50 space-y-4 max-h-[500px] overflow-y-auto font-sans scrollbar-thin">
                  {/* Header */}
                  <div className="flex justify-between items-center border-b-2 border-slate-800 pb-3">
                    <div>
                      <h3 className="text-sm font-black uppercase tracking-wider text-yellow-400">🔔 Real-Time alerts hub</h3>
                      <span className="text-[9px] text-slate-400 font-bold block mt-0.5">Live telemetry notifications center</span>
                    </div>
                    <button 
                      onClick={() => setNotifications(prev => prev.map(n => ({...n, read: true})))}
                      className="text-[9px] bg-slate-800 hover:bg-slate-700 text-slate-200 font-black px-2.5 py-1.5 border border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-0.5 active:shadow-none transition-all cursor-pointer uppercase"
                    >
                      Clear Unread
                    </button>
                  </div>

                  {/* Search and Category filters */}
                  <div className="space-y-2">
                    <input 
                      type="text" 
                      placeholder="Search alerts..." 
                      value={notificationSearch}
                      onChange={(e) => setNotificationSearch(e.target.value)}
                      className="w-full bg-[#161f30] text-xs px-3 py-2 border-2 border-slate-700 rounded-lg focus:outline-none focus:border-yellow-400 text-slate-200 font-semibold"
                    />
                    
                    <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                      {["All", "Flights", "Hotels", "Payments", "Wallet", "AI", "Emergency"].map(cat => (
                        <button
                          key={cat}
                          onClick={() => setNotificationFilter(cat)}
                          className={`text-[9px] px-2 py-1 rounded font-black uppercase border whitespace-nowrap cursor-pointer transition-all ${
                            notificationFilter === cat
                              ? "bg-yellow-400 text-black border-black font-extrabold shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]"
                              : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Notifications list */}
                  <div className="space-y-2.5">
                    {(() => {
                      const filtered = notifications.filter(n => {
                        const matchesCategory = notificationFilter === "All" || n.category === notificationFilter;
                        const matchesSearch = !notificationSearch || 
                          n.title.toLowerCase().includes(notificationSearch.toLowerCase()) ||
                          n.msg.toLowerCase().includes(notificationSearch.toLowerCase());
                        return matchesCategory && matchesSearch;
                      });

                      if (filtered.length === 0) {
                        return (
                          <div className="py-8 text-center space-y-2 border border-dashed border-slate-800 rounded-xl">
                            <span className="text-2xl">✨</span>
                            <h4 className="text-[10px] font-black uppercase text-slate-400">Zero active alerts</h4>
                            <p className="text-[9px] text-slate-500 font-semibold">Your travel OS terminal gate is clean</p>
                          </div>
                        );
                      }

                      return filtered.map(n => (
                        <div 
                          key={n.id} 
                          className={`p-3 rounded-xl border-2 text-left transition-all relative ${
                            n.read 
                              ? 'bg-slate-950/30 border-slate-900 opacity-60' 
                              : n.priority === 'high'
                                ? 'bg-red-950/20 border-red-800/80 shadow-[4px_4px_0px_0px_rgba(239,68,68,0.1)]'
                                : n.priority === 'medium'
                                  ? 'bg-yellow-950/10 border-yellow-800/80 shadow-[4px_4px_0px_0px_rgba(234,179,8,0.1)]'
                                  : 'bg-slate-900/60 border-slate-800'
                          }`}
                        >
                          {/* Priority badge */}
                          <div className="flex justify-between items-start gap-2">
                            <div className="flex items-center gap-1.5">
                              {n.priority === 'high' && <span className="bg-red-600 text-white text-[7px] font-black px-1 py-0.5 rounded uppercase">CRITICAL</span>}
                              {n.priority === 'medium' && <span className="bg-yellow-500 text-black text-[7px] font-black px-1 py-0.5 rounded uppercase">WARNING</span>}
                              <span className="text-[9px] font-black uppercase text-slate-200 tracking-wide">{n.title}</span>
                            </div>
                            <span className="text-[8px] text-slate-500 font-black whitespace-nowrap">{n.time}</span>
                          </div>

                          <p className="text-xs text-slate-300 mt-1 leading-snug font-medium pr-14">{n.msg}</p>

                          {/* Quick Actions overlay */}
                          <div className="absolute right-2.5 bottom-2.5 flex items-center gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setNotifications(prev => prev.map(item => item.id === n.id ? {...item, read: !item.read} : item));
                              }}
                              title={n.read ? "Mark Unread" : "Mark Read"}
                              className="text-[10px] bg-slate-900 border border-slate-800 text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 cursor-pointer"
                            >
                              <Check size={11} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setNotifications(prev => prev.filter(item => item.id !== n.id));
                              }}
                              title="Delete"
                              className="text-[10px] bg-slate-900 border border-slate-800 text-slate-400 hover:text-rose-500 p-1 rounded hover:bg-slate-800 cursor-pointer"
                            >
                              <Trash2 size={11} />
                            </button>
                            {n.deepLink && n.deepLink !== "/" && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowNotifications(false);
                                  navigate(n.deepLink);
                                }}
                                title="Go to details"
                                className="text-[10px] bg-yellow-400 border border-black text-black font-black p-1 rounded hover:bg-yellow-300 cursor-pointer"
                              >
                                <ArrowRight size={11} />
                              </button>
                            )}
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              )}
            </div>

            <button 
              onClick={() => setShowProfile(true)}
              className="h-8 w-8 rounded-full border border-slate-700/60 bg-[var(--color-surface)] flex items-center justify-center font-bold text-xs text-[var(--color-ivory)] hover:border-[var(--color-gold)] hover:scale-105 transition-all cursor-pointer"
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
                onNavigate={navigate}
                setPrefilledMessage={setPrefilledMessage}
                profileName={profileName}
                profileData={profileData}
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
            {activeTab === 'trips' && <MyTripsView key="trips" userProfile={userProfile} setActiveTab={setActiveTab} onNavigate={navigate} />}
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
          onLogout={handleLogout}
        />
      )}

      {/* myBiz Dashboard Modal */}
      {showMyBizAdmin && (
        <MyBizDashboardModal
          onClose={() => setShowMyBizAdmin(false)}
        />
      )}
    </div>
  </div>
  );
}

function SidebarBtn({ active, icon, label, onClick }: { active: boolean, icon: any, label: string, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`sidebar-btn-item w-full flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-card)] text-sm font-medium transition-all cursor-pointer ${
        active 
          ? 'bg-transparent text-[var(--color-gold)] border-l-2 border-[var(--color-gold)] pl-2.5' 
          : 'text-[var(--color-ivory-dim)] hover:text-[var(--color-ivory)] hover:bg-[var(--color-surface)]'
      }`}
    >
      <span className={active ? 'text-[var(--color-gold)]' : 'text-[var(--color-ivory-dim)]'}>
        {icon}
      </span>
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
  onShowWishlist, onShowProfile, onNavigate,
  setPrefilledMessage,
  profileName,
  profileData
}: { 
  currency: string, onBook: (data: any) => void, setActiveTab: any,
  onDetailClick: (vert: string, item: any) => void,
  onOfferClick: (off: any) => void,
  onPartnerClick: (type: 'airline' | 'hotel', name: string) => void,
  onDestinationClick: (slug: string, title: string, img: string) => void,
  onTrackFlight: (fnum: string) => void,
  onShowMyBiz: () => void,
  onShowWishlist: () => void,
  onShowProfile: () => void,
  onNavigate: (path: string) => void,
  setPrefilledMessage: (msg: string) => void,
  profileName: string,
  profileData: any
}) {
  const [activeVertical, setActiveVertical] = useState<string>(() => sessionStorage.getItem("active_vertical") || 'flights');
  const [loadingVerticals, setLoadingVerticals] = useState<Record<string, boolean>>({});

  useEffect(() => {
    sessionStorage.setItem("active_vertical", activeVertical);
  }, [activeVertical]);
  
  useEffect(() => {
    const listener = (vals: Record<string, boolean>) => setLoadingVerticals(vals);
    globalTabLoadingListeners.push(listener);
    return () => {
      globalTabLoadingListeners = globalTabLoadingListeners.filter(l => l !== listener);
    };
  }, []);
  
  return (
    <div className="h-full overflow-y-auto overflow-x-hidden bg-[#0a0f1d] pb-28 md:pb-16 scroll-smooth w-full">
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
          <div onClick={onShowProfile} className="hover:text-white transition-all flex items-center gap-1 cursor-pointer font-bold"><User size={13} /> Hi, {profileName || (profileData && profileData.email && profileData.email.split("@")[0]) || "Traveler"}</div>
        </div>
      </div>

      {/* 2. HERO SHELL */}
      <div className="relative w-full bg-[var(--color-obsidian)] py-8 px-4 sm:px-6 md:px-8 border-b border-slate-800/80 overflow-hidden">
        {/* Ambient Flight Paths Pattern */}
        <div className="absolute inset-0 opacity-[0.08] pointer-events-none">
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <path d="M 100 250 Q 450 50 800 250" fill="none" stroke="#F3EFE6" strokeWidth="2" strokeDasharray="6,6" className="animate-pulse" />
            <path d="M 200 300 Q 600 100 1000 300" fill="none" stroke="#F3EFE6" strokeWidth="2" strokeDasharray="6,6" className="animate-pulse" style={{ animationDelay: '1s' }} />
            <path d="M -50 150 Q 300 0 700 200" fill="none" stroke="#F3EFE6" strokeWidth="1.5" strokeDasharray="4,4" />
            <path d="M 50 400 Q 500 200 950 400" fill="none" stroke="#F3EFE6" strokeWidth="1" strokeDasharray="5,5" className="animate-pulse" style={{ animationDelay: '0.5s' }} />
          </svg>
        </div>

        <div className="max-w-7xl mx-auto text-center mb-6 relative z-10 animate-slideup">
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-serif text-[var(--color-ivory)] tracking-tight leading-tight uppercase">
            WHERE WOULD YOU LIKE TO <span className="font-serif italic text-[var(--color-gold)]">TRAVEL</span>?
          </h2>
          <p className="text-[10px] font-mono uppercase tracking-widest text-[var(--color-ivory-dim)] mt-2">
            Discover curated itineraries, premium flight search, and instant wallet bookings
          </p>
        </div>

        {/* Quick prompt assistant widget */}
        <div className="max-w-2xl mx-auto bg-slate-900/60 backdrop-blur border border-slate-850 p-4 rounded-xl shadow-lg relative z-10 mb-6 flex flex-col sm:flex-row items-center gap-3">
          <div className="flex-1 text-left">
            <span className="text-[9px] text-amber-400 font-extrabold uppercase tracking-widest block">🤖 AI Operating System Copilot</span>
            <p className="text-xs text-slate-300 mt-1">Prompt: "I have ₹70,000. Delhi to Goa. 4 days. Nightlife."</p>
          </div>
          <button 
            onClick={() => {
              setPrefilledMessage("I have ₹70,000. Delhi to Goa. 4 days. Nightlife.");
              setActiveTab('chat');
            }}
            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-4 py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 shadow-md shadow-blue-500/10 cursor-pointer"
          >
            ⚡ Plan Instantly via AI
          </button>
        </div>

        {/* Boarding Pass Ticket Layout Container */}
        <div className="boarding-pass-container max-w-7xl mx-auto bg-[var(--color-surface)] border border-slate-800 rounded-[var(--radius-card)] shadow-2xl relative z-10 animate-scalein flex flex-col md:flex-row overflow-hidden">
          
          {/* Main Ticket Stub (Left Form Section - 75% width) */}
          <div className="flex-1 p-4 sm:p-8 md:p-10">
            {/* Animated Tab Selector */}
            <div className="flex flex-wrap gap-2 gap-y-3 border-b border-slate-800/80 pb-4 mb-6 justify-start">
              <VerticalTab id="trip-planner" label="AI Trip Planner" icon={<Compass size={16} className="text-yellow-400 animate-spin-slow" />} active={activeVertical} onClick={setActiveVertical} isLoading={loadingVerticals['trip-planner']} />
              <VerticalTab id="flights" label="Flights" icon={<Plane size={16} />} active={activeVertical} onClick={setActiveVertical} isLoading={loadingVerticals['flights']} />
              <VerticalTab id="hotels" label="Hotels" icon={<Hotel size={16} />} active={activeVertical} onClick={setActiveVertical} isLoading={loadingVerticals['hotels']} />
              <VerticalTab id="villas" label="Villas" icon={<Home size={16} />} active={activeVertical} onClick={setActiveVertical} isLoading={loadingVerticals['villas']} />
              <VerticalTab id="holidays" label="Holidays" icon={<Gift size={16} />} active={activeVertical} onClick={setActiveVertical} isLoading={loadingVerticals['holidays']} />
              <VerticalTab id="trains" label="Trains" icon={<TrendingUp size={16} />} active={activeVertical} onClick={setActiveVertical} isLoading={loadingVerticals['trains']} />
              <VerticalTab id="buses" label="Buses" icon={<Bus size={16} />} active={activeVertical} onClick={setActiveVertical} isLoading={loadingVerticals['buses']} />
              <VerticalTab id="cabs" label="Cabs" icon={<Users size={16} />} active={activeVertical} onClick={setActiveVertical} isLoading={loadingVerticals['cabs']} />
              <VerticalTab id="rent-a-ride" label="Rent a Ride" icon={<Car size={16} />} active={activeVertical} onClick={setActiveVertical} isLoading={loadingVerticals['rent-a-ride']} />
              <VerticalTab id="tours" label="Tours" icon={<Activity size={16} />} active={activeVertical} onClick={setActiveVertical} isLoading={loadingVerticals['tours']} />
              <VerticalTab id="visa" label="Visa" icon={<FileText size={16} />} active={activeVertical} onClick={setActiveVertical} isLoading={loadingVerticals['visa']} />
              <VerticalTab id="cruises" label="Cruises" icon={<Ship size={16} />} active={activeVertical} onClick={setActiveVertical} isLoading={loadingVerticals['cruises']} />
              <VerticalTab id="forex" label="Forex" icon={<Coins size={16} />} active={activeVertical} onClick={setActiveVertical} isLoading={loadingVerticals['forex']} />
              <VerticalTab id="insurance" label="Insurance" icon={<ShieldCheck size={16} />} active={activeVertical} onClick={setActiveVertical} isLoading={loadingVerticals['insurance']} />
            </div>
            
            <div className="pt-1">
            {activeVertical === 'trip-planner' && <TripPlannerForm onBook={onBook} onDetailClick={onDetailClick} setPrefilledMessage={setPrefilledMessage} setActiveTab={setActiveTab} />}
            {activeVertical === 'flights' && <FlightsSearchForm currency={currency} onBook={onBook} onDetailClick={onDetailClick} onTrackFlight={onTrackFlight} />}
            {activeVertical === 'hotels' && <HotelsSearchForm onBook={onBook} onDetailClick={onDetailClick} />}
            {activeVertical === 'villas' && <VillasSearchForm onBook={onBook} onDetailClick={onDetailClick} />}
            {activeVertical === 'holidays' && <HolidayPackagesSearchForm onBook={onBook} onDetailClick={onDetailClick} />}
            {activeVertical === 'trains' && <TrainsSearchForm onBook={onBook} onDetailClick={onDetailClick} />}
            {activeVertical === 'buses' && <BusesSearchForm onBook={onBook} onDetailClick={onDetailClick} />}
            {activeVertical === 'cabs' && <CabsSearchForm onBook={onBook} onDetailClick={onDetailClick} />}
            {activeVertical === 'rent-a-ride' && <RentARideSearchForm onBook={onBook} onDetailClick={onDetailClick} onNavigate={onNavigate} />}
            {activeVertical === 'tours' && <ToursSearchForm onBook={onBook} onDetailClick={onDetailClick} />}
            {activeVertical === 'visa' && <VisaSearchForm onBook={onBook} onDetailClick={onDetailClick} profileName={profileName} profileData={profileData} />}
            {activeVertical === 'cruises' && <CruisesSearchForm onBook={onBook} onDetailClick={onDetailClick} />}
            {activeVertical === 'forex' && <ForexSearchForm onBook={onBook} onDetailClick={onDetailClick} />}
            {activeVertical === 'insurance' && <InsuranceSearchForm onBook={onBook} onDetailClick={onDetailClick} />}
          </div>
        </div>

        {/* Perforation Divider Line */}
        <div className="hidden md:flex flex-col justify-between items-center py-2 relative w-[2px]">
          <div className="absolute -top-2 w-4 h-4 rounded-full bg-[var(--color-obsidian)] border border-slate-800 -left-[7px]" />
          <div className="w-[1px] h-full border-l border-dashed border-slate-700/60" />
          <div className="absolute -bottom-2 w-4 h-4 rounded-full bg-[var(--color-obsidian)] border border-slate-800 -left-[7px]" />
        </div>

        {/* Ticket Stub (Right Section - wider and taller) */}
        <div className="w-full md:w-80 bg-[var(--color-surface-raised)] p-4 sm:p-8 md:p-10 flex flex-col justify-between border-t md:border-t-0 md:border-l border-slate-800/80">
          <div className="space-y-6">
            <div>
              <span className="text-[10px] font-mono text-[var(--color-ivory-dim)] uppercase block">PASSENGER TICKET</span>
              <span className="text-xs font-bold text-[var(--color-ivory)] uppercase mt-0.5 block">{profileName ? profileName.toUpperCase() : (profileData && profileData.email && profileData.email.split("@")[0].toUpperCase()) || "TRAVELER"}</span>
            </div>
            
            <div>
              <span className="text-[10px] font-mono text-[var(--color-ivory-dim)] uppercase block">CLASS / GROUP</span>
              <span className="font-mono text-xs text-[var(--color-gold)] uppercase mt-0.5 block">FIRST CLASS / G1</span>
            </div>

            <div>
              <span className="text-[10px] font-mono text-[var(--color-ivory-dim)] uppercase block">SYSTEM STATUS</span>
              <span className="font-mono text-xs text-[var(--color-teal)] uppercase mt-0.5 block">READY TO BOARD</span>
            </div>
          </div>

          <div className="space-y-3 pt-8 border-t border-dashed border-slate-800/80 mt-8">
            <div className="w-full h-10 bg-transparent opacity-50" style={{ backgroundImage: 'repeating-linear-gradient(90deg, var(--color-ivory), var(--color-ivory) 2px, transparent 2px, transparent 5px, var(--color-ivory) 5px, var(--color-ivory) 7px, transparent 7px, transparent 10px)' }} />
            <span className="text-[9px] font-mono text-[var(--color-ivory-dim)] text-center block tracking-widest">TRV-OS #49918-B</span>
          </div>
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

      {/* POPULAR PACKAGES */}
      <div className="max-w-6xl mx-auto px-8 py-6">
        <h3 className="text-xl font-extrabold text-slate-200 mb-6 flex items-center gap-2">🎁 Curated Travel Packages</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="glass-card p-5 rounded-2xl border border-slate-800 flex flex-col justify-between hover:border-amber-500/50 transition-all duration-300">
            <div>
              <div className="h-40 rounded-xl overflow-hidden mb-4 relative bg-[url('https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600')] bg-cover bg-center">
                <span className="absolute top-2 right-2 bg-amber-500 text-slate-950 text-[10px] font-black uppercase px-2 py-0.5 rounded">Best Seller</span>
              </div>
              <h4 className="font-extrabold text-sm text-slate-200">Beach Paradise — Goa Stay</h4>
              <p className="text-[11px] text-slate-400 mt-1">Flights + Premium Resort + Beach Sightseeing</p>
              <div className="flex gap-2 mt-3 flex-wrap">
                <span className="text-[9px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded">4 Nights</span>
                <span className="text-[9px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded">2 Travelers</span>
              </div>
            </div>
            <div className="flex justify-between items-center mt-5 border-t border-slate-800/80 pt-4">
              <div>
                <span className="text-[9px] text-slate-500 uppercase block">Starting from</span>
                <span className="text-base font-black text-amber-400">₹24,999</span>
              </div>
              <button 
                onClick={() => {
                  setPrefilledMessage("I have ₹70,000. Delhi to Goa. 4 days. Nightlife.");
                  setActiveTab('chat');
                }} 
                className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-3 py-1.5 rounded-lg transition-all"
              >
                Plan via AI
              </button>
            </div>
          </div>

          <div className="glass-card p-5 rounded-2xl border border-slate-800 flex flex-col justify-between hover:border-amber-500/50 transition-all duration-300">
            <div>
              <div className="h-40 rounded-xl overflow-hidden mb-4 relative bg-[url('https://images.unsplash.com/photo-1546410531-bb4caa6b424d?w=600')] bg-cover bg-center">
                <span className="absolute top-2 right-2 bg-purple-600 text-white text-[10px] font-black uppercase px-2 py-0.5 rounded">Luxury</span>
              </div>
              <h4 className="font-extrabold text-sm text-slate-200">Royal Heritage — Jaipur Escape</h4>
              <p className="text-[11px] text-slate-400 mt-1">First Class Flight + Palace Hotel + Forts Tour</p>
              <div className="flex gap-2 mt-3 flex-wrap">
                <span className="text-[9px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded">3 Nights</span>
                <span className="text-[9px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded">2 Travelers</span>
              </div>
            </div>
            <div className="flex justify-between items-center mt-5 border-t border-slate-800/80 pt-4">
              <div>
                <span className="text-[9px] text-slate-500 uppercase block">Starting from</span>
                <span className="text-base font-black text-amber-400">₹14,500</span>
              </div>
              <button 
                onClick={() => {
                  setPrefilledMessage("Recommend a full holiday package for Jaipur for 3 days starting Dec 15th");
                  setActiveTab('chat');
                }} 
                className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-3 py-1.5 rounded-lg transition-all"
              >
                Plan via AI
              </button>
            </div>
          </div>

          <div className="glass-card p-5 rounded-2xl border border-slate-800 flex flex-col justify-between hover:border-amber-500/50 transition-all duration-300">
            <div>
              <div className="h-40 rounded-xl overflow-hidden mb-4 relative bg-[url('https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=600')] bg-cover bg-center">
                <span className="absolute top-2 right-2 bg-sky-600 text-white text-[10px] font-black uppercase px-2 py-0.5 rounded">Trending</span>
              </div>
              <h4 className="font-extrabold text-sm text-slate-200">Tropical Villa — Bali Getaway</h4>
              <p className="text-[11px] text-slate-400 mt-1">Flights + Private Pool Villa stay + Local Guide</p>
              <div className="flex gap-2 mt-3 flex-wrap">
                <span className="text-[9px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded">6 Nights</span>
                <span className="text-[9px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded">2 Travelers</span>
              </div>
            </div>
            <div className="flex justify-between items-center mt-5 border-t border-slate-800/80 pt-4">
              <div>
                <span className="text-[9px] text-slate-500 uppercase block">Starting from</span>
                <span className="text-base font-black text-amber-400">₹89,900</span>
              </div>
              <button 
                onClick={() => {
                  setPrefilledMessage("Recommend a full holiday package for Bali for 6 days starting Dec 15");
                  setActiveTab('chat');
                }} 
                className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-3 py-1.5 rounded-lg transition-all"
              >
                Plan via AI
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 5. PARTNER SHOWCASE SHOWS */}
      <div className="max-w-6xl mx-auto px-8 py-10 grid grid-cols-1 md:grid-cols-2 gap-8 border-t border-slate-900/60 mt-8 pt-10">
        <AirlinePartnersShowcase onPartnerClick={(name) => onPartnerClick('airline', name)} />
        <HotelBrandsShowcase onPartnerClick={(name) => onPartnerClick('hotel', name)} />
      </div>

      {/* 6. PLATFORM INFO & BENEFITS CARDS */}
      <div className="max-w-6xl mx-auto px-8 pb-16 border-t border-slate-900/60 pt-10 mt-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 font-sans">
          
          {/* Card 1: How to Use */}
          <div className="bg-[#e0f2fe] border-4 border-black p-6 rounded-[var(--radius-card)] shadow-[6px_6px_0px_0px_#000000] text-black hover:-translate-y-1 transition-all duration-200 flex flex-col justify-between">
            <div>
              <h4 className="font-extrabold text-sm mb-4 flex items-center gap-2 text-sky-950 uppercase tracking-wide">
                <Compass className="shrink-0 text-sky-700" size={18} />
                How to Use
              </h4>
              <ol className="list-decimal list-inside text-xs space-y-3 font-semibold text-slate-800 leading-relaxed text-left">
                <li><span className="font-bold text-black">Select Travel Vertical:</span> Choose Flights, Hotels, Cabs, etc., from the dashboard.</li>
                <li><span className="font-bold text-black">Interact with AI:</span> Prompt the assistant for tailored recommendations and real-time itinerary splits.</li>
                <li><span className="font-bold text-black">Secure Hold & Pay:</span> Lock rates instantly and check out via unified wallet.</li>
              </ol>
            </div>
          </div>

          {/* Card 2: Benefits */}
          <div className="bg-[#fef08a] border-4 border-black p-6 rounded-[var(--radius-card)] shadow-[6px_6px_0px_0px_#000000] text-black hover:-translate-y-1 transition-all duration-200 flex flex-col justify-between">
            <div>
              <h4 className="font-extrabold text-sm mb-4 flex items-center gap-2 text-yellow-950 uppercase tracking-wide">
                <Tag className="shrink-0 text-yellow-700" size={18} />
                Key Benefits
              </h4>
              <ul className="list-disc list-inside text-xs space-y-3 font-semibold text-slate-800 leading-relaxed text-left">
                <li><span className="font-bold text-black">OneCircle Loyalty:</span> Earn multi-vertical points with every booking to redeem.</li>
                <li><span className="font-bold text-black">Zero-Penalty Holds:</span> Hold availability for premium resorts with zero upfront fee.</li>
                <li><span className="font-bold text-black">Fare Protection:</span> Shield your checkout from dynamic demand surges.</li>
              </ul>
            </div>
          </div>

          {/* Card 3: Why Choose Us */}
          <div className="bg-[#fce7f3] border-4 border-black p-6 rounded-[var(--radius-card)] shadow-[6px_6px_0px_0px_#000000] text-black hover:-translate-y-1 transition-all duration-200 flex flex-col justify-between">
            <div>
              <h4 className="font-extrabold text-sm mb-4 flex items-center gap-2 text-pink-950 uppercase tracking-wide">
                <Sparkles className="shrink-0 text-pink-700" size={18} />
                Why We Are Better
              </h4>
              <p className="text-xs font-semibold text-slate-800 leading-relaxed text-left mb-3">
                <span className="font-bold text-black">Multi-Agent Engine:</span> Concurrently resolves flight options, live weather, local events, and visa rules.
              </p>
              <p className="text-xs font-semibold text-slate-800 leading-relaxed text-left">
                <span className="font-bold text-black">Self-Healing Router:</span> Transparently switches LLM providers to ensure 100% service availability.
              </p>
            </div>
          </div>

        </div>
      </div>

      {/* TRAVEL ANALYTICS PREVIEW */}
      <div className="max-w-6xl mx-auto px-8 py-6 border-t border-slate-900/60 pt-10">
        <div className="bg-slate-900/40 border border-slate-805 rounded-2xl p-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="space-y-2 text-left max-w-sm">
            <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider block">Travel OS Metrics</span>
            <h4 className="text-lg font-black text-white">Live Platform Travel Analytics</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              We track real-time savings, active search indices, flight price drops, and carbon footprint reduction parameters to optimize your journeys.
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 w-full md:w-auto flex-1 max-w-xl text-left">
            <div className="bg-[#121c33] p-4 rounded-xl border border-slate-800">
              <span className="text-[9px] text-slate-500 font-bold uppercase">Average Traveler Savings</span>
              <span className="text-sm font-black text-white block mt-1">₹4,850 / trip</span>
            </div>
            <div className="bg-[#121c33] p-4 rounded-xl border border-slate-800">
              <span className="text-[9px] text-slate-500 font-bold uppercase">Active Monitored Trips</span>
              <span className="text-sm font-black text-white block mt-1">1,248 Trips</span>
            </div>
            <div className="bg-[#121c33] p-4 rounded-xl border border-slate-800 col-span-2 sm:col-span-1">
              <span className="text-[9px] text-slate-500 font-bold uppercase">Platform Health Standing</span>
              <span className="text-sm font-black text-emerald-400 block mt-1">99.98% SLA</span>
            </div>
          </div>
        </div>
      </div>

      {/* CUSTOMER REVIEWS */}
      <div className="max-w-6xl mx-auto px-8 py-6 border-t border-slate-900/60 pt-10">
        <h3 className="text-xl font-extrabold text-slate-200 mb-6 flex items-center gap-2">💬 What Our Travelers Say</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
          <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-2xl space-y-3 flex flex-col justify-between">
            <p className="text-xs italic text-slate-300 leading-relaxed">
              "Travel OS completely planned my Goa getaway, reserved Vistara flights, and mapped out an incredible nightlife list! I literally didn't have to search a single hotel myself."
            </p>
            <div className="flex justify-between items-center pt-2">
              <span className="font-bold text-xs text-white">Rohan S.</span>
              <span className="text-xs text-amber-400 font-bold">★★★★★ Gold Tier</span>
            </div>
          </div>
          <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-2xl space-y-3 flex flex-col justify-between">
            <p className="text-xs italic text-slate-300 leading-relaxed">
              "The interactive route mapping and Google Calendar sync saved me hours of planning. Plus, I held the hotel price for free before checking out via my UPI wallet."
            </p>
            <div className="flex justify-between items-center pt-2">
              <span className="font-bold text-xs text-white">Priya M.</span>
              <span className="text-xs text-amber-400 font-bold">★★★★★ Platinum Tier</span>
            </div>
          </div>
        </div>
      </div>

      {/* PREMIUM FOOTER */}
      <footer className="w-full bg-slate-950 border-t border-slate-900 py-12 px-8 mt-12">
        <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-left">
          <div className="space-y-3 col-span-2 md:col-span-1">
            <h4 className="font-black text-sm text-white tracking-widest uppercase">TRAVEL OS</h4>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              The world's best AI-powered autonomous Travel Operating System, resolving flights, hotel stays, visa guidance, and premium itineraries.
            </p>
          </div>
          <div className="space-y-3">
            <h5 className="font-bold text-xs text-slate-300 uppercase">Products</h5>
            <ul className="space-y-1.5 text-[11px] text-slate-400 list-none p-0 m-0">
              <li><a href="#" className="hover:text-amber-400 transition-colors">Flight Search</a></li>
              <li><a href="#" className="hover:text-amber-400 transition-colors">Hotel Booking</a></li>
              <li><a href="#" className="hover:text-amber-400 transition-colors">Luxury Villas</a></li>
              <li><a href="#" className="hover:text-amber-400 transition-colors">Cruises & Trains</a></li>
            </ul>
          </div>
          <div className="space-y-3">
            <h5 className="font-bold text-xs text-slate-300 uppercase">Safety & Support</h5>
            <ul className="space-y-1.5 text-[11px] text-slate-400 list-none p-0 m-0">
              <li><a href="#" className="hover:text-amber-400 transition-colors">Consulate Advisory</a></li>
              <li><a href="#" className="hover:text-amber-400 transition-colors">Emergency Helplines</a></li>
              <li><a href="#" className="hover:text-amber-400 transition-colors">Travel Insurance</a></li>
              <li><a href="#" className="hover:text-amber-400 transition-colors">System Health SLA</a></li>
            </ul>
          </div>
          <div className="space-y-3">
            <h5 className="font-bold text-xs text-slate-300 uppercase">Sustainability</h5>
            <ul className="space-y-1.5 text-[11px] text-slate-400 list-none p-0 m-0">
              <li><a href="#" className="hover:text-amber-400 transition-colors">Carbon Offset Program</a></li>
              <li><a href="#" className="hover:text-amber-400 transition-colors">Green Hotel List</a></li>
              <li><a href="#" className="hover:text-amber-400 transition-colors">Eco Sightseeing Guides</a></li>
              <li><a href="#" className="hover:text-amber-400 transition-colors">Sustainable Metrics</a></li>
            </ul>
          </div>
        </div>
        <div className="max-w-6xl mx-auto mt-10 pt-6 border-t border-slate-900 flex flex-col sm:flex-row justify-between items-center text-[10px] text-slate-500">
          <span>© 2026 Travel OS Inc. All rights reserved.</span>
          <span className="flex gap-4 mt-2 sm:mt-0">
            <a href="#" className="hover:text-slate-300">Privacy Policy</a>
            <a href="#" className="hover:text-slate-300">Terms of Service</a>
          </span>
        </div>
      </footer>
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
  onSwap,
  onFromChange,
  onToChange,
  fromSuggestions = [] as string[],
  toSuggestions = [] as string[],
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
  const [isEditingFrom, setIsEditingFrom] = useState(false);
  const [isEditingTo, setIsEditingTo] = useState(false);

  const getAirportCode = (val: string, fallback: string) => {
    if (!val) return fallback;
    const match = val.match(/\(([^)]+)\)/);
    return match ? match[1].toUpperCase() : val.substring(0, 3).toUpperCase();
  };

  const getCityName = (val: string, fallback: string) => {
    if (!val) return fallback;
    const match = val.match(/^([^(]+)/);
    return match ? match[1].trim() : val;
  };

  const fromCode = getAirportCode(fromValue, "DEL");
  const fromCityName = getCityName(fromValue, "Delhi");
  const toCode = getAirportCode(toValue, "BOM");
  const toCityName = getCityName(toValue, "Select");

  return (
    <div className="relative grid grid-cols-2 gap-2 bg-[var(--color-surface)] border border-slate-800 rounded-[var(--radius-card)] p-4 shadow-sm h-[74px]">
      
      {/* From Field */}
      <div 
        onClick={() => setIsEditingFrom(true)}
        className="space-y-0.5 relative cursor-pointer h-full flex flex-col justify-center text-left"
      >
        <span className="text-[9px] text-[var(--color-ivory-dim)] font-mono uppercase tracking-wider block">{fromLabel}</span>
        {isEditingFrom ? (
          <input 
            type="text" 
            autoFocus
            value={fromValue} 
            placeholder={placeholderFrom}
            onChange={(e) => onFromChange?.(e.target.value)}
            onFocus={() => setShowFromSuggestions?.(true)}
            onBlur={() => {
              setTimeout(() => {
                setShowFromSuggestions?.(false);
                setIsEditingFrom(false);
              }, 200);
            }}
            className="w-full bg-[var(--color-surface-raised)] border-none text-[var(--color-ivory)] font-bold text-sm px-2 py-1 outline-none rounded"
          />
        ) : (
          <div className="flex flex-col">
            <span className="font-mono text-2xl font-bold text-[var(--color-gold)] leading-none">{fromCode}</span>
            <span className="text-[10px] text-[var(--color-ivory-dim)] truncate mt-0.5">{fromCityName}</span>
          </div>
        )}

        {showFromSuggestions && fromSuggestions.length > 0 && (
          <div className="absolute left-0 right-0 top-[60px] bg-[var(--color-surface-raised)] border border-slate-800 rounded shadow-xl z-50 overflow-y-auto max-h-48 text-[var(--color-ivory)]">
            {fromSuggestions.map((item, idx) => (
              <button
                key={idx}
                type="button"
                onMouseDown={() => {
                  onSelectFromSuggestion?.(item);
                  setIsEditingFrom(false);
                }}
                className="w-full text-left px-3 py-2 hover:bg-[var(--color-surface)] text-xs font-semibold border-b border-slate-800 last:border-0 cursor-pointer"
              >
                {item}
              </button>
            ))}
          </div>
        )}
      </div>
      
      {/* Swap Button with Plane Animation */}
      <button 
        type="button"
        onClick={onSwap}
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 p-2 bg-[var(--color-surface-raised)] hover:bg-[var(--color-surface)] text-[var(--color-gold)] border border-slate-800 rounded-full z-10 shadow cursor-pointer group transition-transform duration-300"
        title="Swap locations"
      >
        <span className="inline-block transform group-hover:rotate-45 group-hover:translate-x-0.5 transition-transform duration-300">
          ✈️
        </span>
      </button>

      {/* To Field */}
      <div 
        onClick={() => setIsEditingTo(true)}
        className="space-y-0.5 relative cursor-pointer h-full flex flex-col justify-center pl-4 text-right"
      >
        <span className="text-[9px] text-[var(--color-ivory-dim)] font-mono uppercase tracking-wider block">{toLabel}</span>
        {isEditingTo ? (
          <input 
            type="text" 
            autoFocus
            value={toValue} 
            placeholder={placeholderTo}
            onChange={(e) => onToChange?.(e.target.value)}
            onFocus={() => setShowToSuggestions?.(true)}
            onBlur={() => {
              setTimeout(() => {
                setShowToSuggestions?.(false);
                setIsEditingTo(false);
              }, 200);
            }}
            className="w-full bg-[var(--color-surface-raised)] border-none text-[var(--color-ivory)] font-bold text-sm px-2 py-1 outline-none rounded text-right"
          />
        ) : (
          <div className="flex flex-col items-end">
            <span className="font-mono text-2xl font-bold text-[var(--color-gold)] leading-none">{toCode || "---"}</span>
            <span className="text-[10px] text-[var(--color-ivory-dim)] truncate mt-0.5">{toCityName || "Select Destination"}</span>
          </div>
        )}

        {showToSuggestions && toSuggestions.length > 0 && (
          <div className="absolute left-0 right-0 top-[60px] bg-[var(--color-surface-raised)] border border-slate-800 rounded shadow-xl z-50 overflow-y-auto max-h-48 text-[var(--color-ivory)] text-left">
            {toSuggestions.map((item, idx) => (
              <button
                key={idx}
                type="button"
                onMouseDown={() => {
                  onSelectToSuggestion?.(item);
                  setIsEditingTo(false);
                }}
                className="w-full text-left px-3 py-2 hover:bg-[var(--color-surface)] text-xs font-semibold border-b border-slate-800 last:border-0 cursor-pointer"
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
          className="w-full bg-white disabled:bg-slate-200 disabled:text-slate-500 border-3 border-black text-slate-900 font-black text-xs px-2 py-2.5 outline-none focus:bg-yellow-50/50"
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
      className={`px-4 py-2.5 relative font-semibold text-xs flex items-center gap-2 transition-all cursor-pointer bg-[var(--color-surface)] border-none rounded-[var(--radius-card)] shrink-0 snap-start ${
        isActive 
          ? 'text-[var(--color-gold)] font-bold shadow-sm' 
          : 'text-[var(--color-ivory-dim)] hover:text-[var(--color-ivory)]'
      }`}
    >
      <span className={isActive ? 'text-[var(--color-gold)]' : 'text-[var(--color-ivory-dim)]'}>
        {icon}
      </span>
      <span className="uppercase tracking-wider">{label}</span>
      {isActive && (
        <span className="absolute bottom-0 left-2 right-2 h-[2px] bg-[var(--color-gold)]" />
      )}
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

const FLIGHT_TIMES = Array.from({ length: 48 }, (_, i) => {
  const totalMinutes = i * 30;
  const rawHours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const ampm = rawHours >= 12 ? 'PM' : 'AM';
  const hours = rawHours % 12 === 0 ? 12 : rawHours % 12;
  const formattedHours = hours < 10 ? `0${hours}` : hours;
  const formattedMinutes = minutes === 0 ? '00' : '30';
  return `${formattedHours}:${formattedMinutes} ${ampm}`;
});

function SearchRouteMap({ vertical, origin, destination, points }: { vertical: 'flights' | 'hotels', origin?: string, destination?: string, points?: any[] }) {
  const [selectedPin, setSelectedPin] = useState<any | null>(null);

  if (vertical === 'flights') {
    return (
      <div className="bg-[#11192e] border-3 border-black p-4 rounded-2xl shadow-[4px_4px_0px_0px_#000000] relative overflow-hidden h-64 flex flex-col justify-between mb-4">
        <div className="absolute top-2 left-2 bg-slate-900/80 px-2 py-0.5 rounded text-[8px] font-black uppercase text-yellow-400 z-10">✈️ Flight Route Visualizer</div>
        <div className="relative flex-1 w-full bg-slate-950/40 rounded-xl overflow-hidden mt-4">
          <svg className="w-full h-full" viewBox="0 0 500 200">
            <circle cx="80" cy="100" r="6" fill="#60a5fa" stroke="black" strokeWidth="2" />
            <text x="80" y="85" fill="white" fontSize="10" fontWeight="bold" textAnchor="middle">{origin || "DEL"}</text>
            
            <circle cx="420" cy="100" r="6" fill="#f87171" stroke="black" strokeWidth="2" />
            <text x="420" y="85" fill="white" fontSize="10" fontWeight="bold" textAnchor="middle">{destination || "GOI"}</text>

            <path d="M 80 100 Q 250 20 420 100" fill="none" stroke="#eab308" strokeWidth="3" strokeDasharray="6,6" />
            
            <g transform="translate(250, 60)">
              <circle cx="0" cy="0" r="10" fill="#facc15" stroke="black" strokeWidth="2" />
              <text x="0" y="3" fontSize="8" textAnchor="middle">✈️</text>
            </g>
          </svg>
        </div>
        <div className="text-[10px] text-slate-400 font-bold bg-slate-950/80 p-2 rounded mt-2">
          Route details: Direct path from {origin || "DEL"} to {destination || "GOI"}. Air traffic control status: Normal.
        </div>
      </div>
    );
  }

  const defaultPoints = [
    { name: "Airport Terminal", type: "transport", x: 60, y: 150 },
    { name: "Beachfront Area", type: "nature", x: 120, y: 50 },
    { name: "Your Hotel Stay", type: "stay", x: 250, y: 100 },
    { name: "Beachside Seafood Grill", type: "dining", x: 380, y: 120 }
  ];

  const pins = points || defaultPoints;

  return (
    <div className="bg-[#11192e] border-3 border-black p-4 rounded-2xl shadow-[4px_4px_0px_0px_#000000] relative overflow-hidden h-64 flex flex-col justify-between mb-4">
      <div className="absolute top-2 left-2 bg-slate-900/80 px-2 py-0.5 rounded text-[8px] font-black uppercase text-yellow-400 z-10">🗺️ Neighborhood Map (Interactive)</div>
      
      <div className="relative flex-1 w-full bg-slate-950/40 rounded-xl overflow-hidden mt-4">
        <svg className="w-full h-full" viewBox="0 0 500 200">
          <path d="M 0 40 Q 250 80 500 30" fill="none" stroke="#38bdf8" strokeWidth="4" />
          <text x="250" y="25" fill="#38bdf8" fontSize="8" fontWeight="bold" opacity="0.6">ARABIAN SEA</text>

          <path d="M 60 150 L 250 100 L 380 120" fill="none" stroke="#475569" strokeWidth="1.5" strokeDasharray="3,3" />

          {pins.map((p, i) => (
            <g key={i} transform={`translate(${p.x}, ${p.y})`} className="cursor-pointer group" onClick={() => setSelectedPin(p)}>
              <circle cx="0" cy="0" r="10" fill={p.type === 'stay' ? '#eab308' : p.type === 'dining' ? '#ec4899' : '#10b981'} stroke="black" strokeWidth="2" className="hover:scale-125 transition-transform" />
              <text x="0" y="3" fontSize="8" textAnchor="middle" className="select-none pointer-events-none">
                {p.type === 'stay' ? '🏨' : p.type === 'dining' ? '🍽️' : p.type === 'transport' ? '🚗' : '📍'}
              </text>
            </g>
          ))}
        </svg>

        {selectedPin && (
          <div className="absolute bottom-2 left-2 right-2 bg-slate-900 border border-slate-750 p-2 rounded-lg text-[10px] text-slate-200">
            <span className="font-black text-yellow-400 block uppercase">{selectedPin.name}</span>
            <span>Neighborhood feature ({selectedPin.type}) within walking distance of hotel property.</span>
          </div>
        )}
      </div>
      <div className="text-[10px] text-slate-400 font-bold bg-slate-950/80 p-2 rounded mt-2">
        Click any pin on the map to explore walking distances and beach accessibility routes.
      </div>
    </div>
  );
}

function FlightsSearchForm({ currency, onBook, onDetailClick, onTrackFlight }: { currency: string, onBook: (data: any) => void, onDetailClick: (vert: string, item: any) => void, onTrackFlight: (fnum: string) => void }) {
  const [fromCity, setFromCity] = useState(() => sessionStorage.getItem("fl_fromCity") || "");
  const [toCity, setToCity] = useState(() => sessionStorage.getItem("fl_toCity") || "");
  const [showFromSuggestions, setShowFromSuggestions] = useState(false);
  const [showToSuggestions, setShowToSuggestions] = useState(false);
  const [depDate, setDepDate] = useState(() => sessionStorage.getItem("fl_depDate") || "");
  const [depTime, setDepTime] = useState(() => sessionStorage.getItem("fl_depTime") || "");
  const [passengers, setPassengers] = useState(() => {
    const val = sessionStorage.getItem("fl_passengers");
    return val ? parseInt(val) : 1;
  });
  const [cabin, setCabin] = useState(() => sessionStorage.getItem("fl_cabin") || "Economy");

  useEffect(() => { sessionStorage.setItem("fl_fromCity", fromCity); }, [fromCity]);
  useEffect(() => { sessionStorage.setItem("fl_toCity", toCity); }, [toCity]);
  useEffect(() => { sessionStorage.setItem("fl_depDate", depDate); }, [depDate]);
  useEffect(() => { sessionStorage.setItem("fl_depTime", depTime); }, [depTime]);
  useEffect(() => { sessionStorage.setItem("fl_passengers", String(passengers)); }, [passengers]);
  useEffect(() => { sessionStorage.setItem("fl_cabin", cabin); }, [cabin]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    fetch(`${API_URL}/agents/preferences`, {
      headers: {
        "Authorization": `Bearer ${token}`
      }
    })
    .then(res => res.json())
    .then(data => {
      if (data && Array.isArray(data.preferences)) {
        for (const pref of data.preferences) {
          const lowerPref = pref.toLowerCase();
          if (lowerPref.includes("business class") || lowerPref.includes("prefer business")) {
            setCabin("Business");
          } else if (lowerPref.includes("first class") || lowerPref.includes("prefer first")) {
            setCabin("First");
          } else if (lowerPref.includes("economy class") || lowerPref.includes("prefer economy")) {
            setCabin("Economy");
          }
          for (const airline of ["IndiGo", "Air India", "Vistara", "Akasa Air"]) {
            if (lowerPref.includes(airline.toLowerCase()) && (lowerPref.includes("prefer") || lowerPref.includes("like"))) {
              setCarrier(airline);
            }
          }
        }
      }
    })
    .catch(console.error);
  }, []);
  
  const [specialFare, setSpecialFare] = useState("Regular");
  const [gstInvoice, setGstInvoice] = useState(false);
  const [priceProtection, setPriceProtection] = useState(false);
  
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useTabLoading('flights');
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getIATACode = (cityInput: string): string => {
    if (!cityInput) return "";
    const match = cityInput.match(/\(([^)]+)\)/);
    if (match && match[1] && match[1].trim().length === 3) {
      return match[1].trim().toUpperCase();
    }
    const clean = cityInput.trim().toLowerCase();
    const mapping: Record<string, string> = {
      "delhi": "DEL",
      "new delhi": "DEL",
      "mumbai": "BOM",
      "bombay": "BOM",
      "goa": "GOI",
      "bangalore": "BLR",
      "bengaluru": "BLR",
      "hyderabad": "HYD",
      "chennai": "MAA",
      "kolkata": "CCU",
      "calcutta": "CCU",
      "ahmedabad": "AMD",
      "pune": "PNQ",
      "jaipur": "JAI",
      "kochi": "COK",
      "cochin": "COK",
      "lucknow": "LKO",
      "patna": "PAT"
    };
    if (mapping[clean]) return mapping[clean];
    if (clean.length === 3) return clean.toUpperCase();
    return clean.substring(0, 3).toUpperCase();
  };

  const [sortBy, setSortBy] = useState("price_asc");
  const [stops, setStops] = useState("all");
  const [carrier, setCarrier] = useState("");

  const swapCities = () => {
    const temp = fromCity;
    setFromCity(toCity);
    setToCity(temp);
  };

  const handleSearch = (overrideSort = sortBy, overrideStops = stops, overrideCarrier = carrier) => {
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
    if (fromCity.trim().toLowerCase() === toCity.trim().toLowerCase()) {
      alert("Source and Destination airports cannot be identical.");
      return;
    }
    setLoading(true);
    setResults([]);
    setError(null);
    
    const fromCode = getIATACode(fromCity);
    const toCode = getIATACode(toCity);
    
    let url = `${API_URL}/flights/search?from=${encodeURIComponent(fromCode)}&to=${encodeURIComponent(toCode)}&passengers=${passengers}`;
    if (overrideSort) url += `&sort_by=${overrideSort}`;
    if (overrideStops && overrideStops !== "all") url += `&stops=${overrideStops}`;
    if (overrideCarrier) url += `&carrier=${encodeURIComponent(overrideCarrier)}`;

    fetch(url)
      .then(res => {
        if (!res.ok) throw new Error("Flight search failed");
        return res.json();
      })
      .then(data => {
        setResults(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setError("Failed to fetch flights. Please try again.");
        setResults([]);
        setLoading(false);
      });
  };

  useEffect(() => {
    if (results.length > 0) {
      handleSearch(sortBy, stops, carrier);
    }
  }, [sortBy, stops, carrier]);

  return (
    <div className="space-y-6">
      {/* Input Core Grid */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 bg-slate-950/20 p-6 border-3 border-black shadow-[6px_6px_0px_0px_#000000]">
        
        {/* From-To Swap Block */}
        <div className="md:col-span-2">
          <LocationSwapField 
            fromLabel="From"
            toLabel="To"
            fromValue={fromCity}
            toValue={toCity}
            onFromChange={(val: string) => { setFromCity(val); setShowFromSuggestions(true); }}
            onToChange={(val: string) => { setToCity(val); setShowToSuggestions(true); }}
            onSwap={swapCities}
            fromSuggestions={POPULAR_AIRPORTS.filter(airport => airport.toLowerCase().includes(fromCity.toLowerCase()))}
            toSuggestions={POPULAR_AIRPORTS.filter(airport => airport.toLowerCase().includes(toCity.toLowerCase()))}
            onSelectFromSuggestion={(val: string) => { setFromCity(val); setShowFromSuggestions(false); }}
            onSelectToSuggestion={(val: string) => { setToCity(val); setShowToSuggestions(false); }}
            showFromSuggestions={showFromSuggestions}
            showToSuggestions={showToSuggestions}
            setShowFromSuggestions={setShowFromSuggestions}
            setShowToSuggestions={setShowToSuggestions}
          />
        </div>

        {/* Departure Date */}
        <div className="space-y-1.5">
          <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">Depart Date</span>
          <input 
            type="date" 
            value={depDate} 
            onChange={(e) => setDepDate(e.target.value)}
            className="w-full bg-white border-3 border-black text-slate-900 font-black text-xs px-2 py-2.5 outline-none focus:bg-yellow-50/50"
          />
        </div>

        {/* Flight Time (Departure Time) */}
        <div className="space-y-1.5">
          <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">Flight Time</span>
          <select 
            value={depTime} 
            onChange={(e) => setDepTime(e.target.value)}
            className="w-full bg-white border-3 border-black text-slate-900 font-black text-xs px-2 py-2.5 outline-none focus:bg-yellow-50/50 cursor-pointer h-[46px]"
          >
            {FLIGHT_TIMES.map((time, idx) => (
              <option key={idx} value={time} className="text-slate-900 bg-white">
                {time}
              </option>
            ))}
          </select>
        </div>

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
                className="ml-2 bg-white text-slate-900 border border-black text-[10px] font-bold p-0.5 outline-none rounded"
              >
                <option value="Economy" className="text-slate-900 bg-white">Economy</option>
                <option value="Premium Economy" className="text-slate-900 bg-white">Premium</option>
                <option value="Business" className="text-slate-900 bg-white">Business</option>
                <option value="First Class" className="text-slate-900 bg-white">First</option>
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

        <button 
          onClick={() => handleSearch()} 
          className="w-full bg-[var(--color-gold)] hover:bg-[#d6b35d] text-[var(--color-obsidian)] font-bold text-sm py-3 rounded-[var(--radius-card)] transition-all flex items-center justify-center gap-1.5 cursor-pointer uppercase tracking-wider border-none"
        >
          Search Flights
        </button>
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
        {error && (
          <div className="bg-red-950/40 border border-red-800 text-red-200 p-5 rounded-2xl text-center space-y-3 max-w-md mx-auto my-6 shadow-xl">
            <p className="text-xs font-bold">{error}</p>
            <button 
              onClick={() => handleSearch()} 
              className="bg-red-800 hover:bg-red-700 text-white text-[10px] font-black uppercase tracking-wider px-4 py-2 rounded-xl cursor-pointer border border-red-700 active:scale-95 transition-all"
            >
              Retry Search
            </button>
          </div>
        )}

        {!loading && !error && results.length === 0 && (
          <div className="bg-slate-900/40 border border-slate-800 text-slate-400 p-8 rounded-2xl text-center max-w-md mx-auto my-6">
            <p className="text-xs font-bold uppercase tracking-wider">No flights found matching your query.</p>
            <p className="text-[10px] text-slate-500 mt-1">Make sure you are searching with standard Indian airport codes or names (e.g. Delhi, Mumbai, Goa).</p>
          </div>
        )}

        {!loading && !error && results.length > 0 && (
          <div className="space-y-3 mt-6">
            <VehicleRentalCrossSell destinationCity={toCity} dateRange={{ start: depDate }} />
            <SearchRouteMap vertical="flights" origin={fromCity} destination={toCity} />
            
            {/* Sorting & Filtering UI Controls */}
            <div className="flex flex-wrap gap-3 items-center justify-between bg-slate-900/60 p-4 rounded-xl border border-slate-800/80 mb-4">
              <div className="flex flex-wrap gap-4 items-center">
                <div className="flex flex-col gap-1">
                  <span className="text-[9px] text-slate-500 uppercase font-black">Sort By</span>
                  <select 
                    value={sortBy} 
                    onChange={(e) => setSortBy(e.target.value)} 
                    className="bg-slate-950 border border-slate-800 text-xs font-bold text-slate-200 p-2 rounded outline-none cursor-pointer focus:border-yellow-400"
                  >
                    <option value="price_asc">Price: Low to High</option>
                    <option value="price_desc">Price: High to Low</option>
                    <option value="duration_asc">Duration: Shortest</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[9px] text-slate-500 uppercase font-black">Stops</span>
                  <select 
                    value={stops} 
                    onChange={(e) => setStops(e.target.value)} 
                    className="bg-slate-950 border border-slate-800 text-xs font-bold text-slate-200 p-2 rounded outline-none cursor-pointer focus:border-yellow-400"
                  >
                    <option value="all">All Stops</option>
                    <option value="direct">Non-stop</option>
                    <option value="1stop">1 Stop</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[9px] text-slate-500 uppercase font-black">Airline</span>
                  <select 
                    value={carrier} 
                    onChange={(e) => setCarrier(e.target.value)} 
                    className="bg-slate-950 border border-slate-800 text-xs font-bold text-slate-200 p-2 rounded outline-none cursor-pointer focus:border-yellow-400"
                  >
                    <option value="">All Airlines</option>
                    <option value="IndiGo">IndiGo</option>
                    <option value="Air India">Air India</option>
                    <option value="Vistara">Vistara</option>
                    <option value="Akasa Air">Akasa Air</option>
                  </select>
                </div>
              </div>
              <span className="text-[10px] text-slate-400 font-bold bg-slate-950 border border-slate-800/80 px-2.5 py-1.5 rounded">{results.length} flights found</span>
            </div>

            <h4 className="text-xs text-slate-400 font-bold uppercase tracking-wider px-1 flex items-center justify-between">
              <span>Available Search Results (Live Agents):</span>
              <span className="text-[10px] text-yellow-500 normal-case font-semibold">
                {results.some(r => r.provider_name === "Amadeus" && !r.is_simulated)
                  ? "Comparing Amadeus live API (TBO simulated)"
                  : "Comparing simulated inventory (Amadeus & TBO sandbox)"}
              </span>
            </h4>
            {(() => {
              const AIRLINE_MAP: Record<string, string> = {
                "6E": "IndiGo",
                "AI": "Air India",
                "UK": "Vistara",
                "QP": "Akasa Air",
                "SG": "SpiceJet",
                "G8": "Go First",
                "AA": "American Airlines",
                "DL": "Delta Air Lines",
                "UA": "United Airlines",
                "LH": "Lufthansa",
                "EK": "Emirates",
                "EY": "Etihad Airways",
                "QR": "Qatar Airways"
              };
              return results.map((res, index) => {
                const airlineCode = (res.airline || "6E").trim().toUpperCase();
                const airlineName = AIRLINE_MAP[airlineCode] || airlineCode;
                const flightNumber = res.flight_number || res.raw_provider_ref || `${airlineCode}-100`;
                const origin = res.origin || fromCity;
                const destination = res.destination || toCity;
                const depTime = res.dep || "08:30";
                const arrTime = res.arr || "10:45";
                const duration = res.duration || "2h 15m";
                const cabinClass = res.cabin_class || cabin || "ECONOMY";
                const stops = res.layovers && res.layovers.length > 0 ? `${res.layovers.length} stop(s)` : "Non-stop";
                const isBusiness = cabinClass.toUpperCase() === "BUSINESS" || cabinClass.toUpperCase() === "FIRST";
                const baggageAllowance = res.baggage || (isBusiness ? "35 kg check-in / 7 kg cabin" : "15 kg check-in / 7 kg cabin");
                const isRefundable = res.cancellation_policy && !res.cancellation_policy.toLowerCase().includes("non-refundable");
                const cancellationText = res.cancellation_policy || "Refundable";

                return (
                  <div key={index} className="dark-card-override bg-[#0f192e] p-5 rounded-2xl flex flex-col md:flex-row gap-5 justify-between items-start md:items-center border border-slate-800 hover:border-slate-700 hover:shadow-xl transition-all relative">
                    {res.ai_pick ? (
                      <div className="absolute -top-2.5 left-4 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-[9px] text-white font-black px-2.5 py-0.5 rounded-full shadow-lg shadow-indigo-500/30 animate-pulse border border-indigo-400/30 z-10 flex items-center gap-1">✨ AI PICK: {res.ai_pick_reason}</div>
                    ) : index === 0 ? (
                      <div className="absolute -top-2.5 left-4 bg-gradient-to-r from-emerald-500 to-teal-400 text-[9px] text-white font-black px-2.5 py-0.5 rounded-full shadow-lg shadow-emerald-500/20 animate-pulse">🏆 BEST PRICE</div>
                    ) : null}
                    
                    {/* Left Section: Flight Details */}
                    <div className="flex-1 w-full space-y-3">
                      {/* Line 1: Airline & Flight Info */}
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center border border-slate-700" style={{ backgroundColor: '#1e293b' }}>
                          <Plane size={12} className="text-blue-400 rotate-45" />
                        </div>
                        <span className="font-extrabold text-sm text-slate-100 tracking-tight">{airlineName}</span>
                        <span className="text-[10px] font-mono bg-blue-950/85 text-blue-300 px-2 py-0.5 rounded border border-blue-900/50">{flightNumber}</span>
                        <span className="dark-card-badge text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded">{cabinClass}</span>
                        {res.provider_name && !res.is_simulated && (
                          <span className="text-[9px] font-semibold bg-purple-950/60 text-purple-300 px-2 py-0.5 rounded border border-purple-900/30">via {res.provider_name}</span>
                        )}
                      </div>
 
                      {/* Line 2: Route, Times & Stops */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-slate-200">
                        {/* Departure */}
                        <div className="flex items-baseline gap-1.5">
                          <span className="font-black text-base text-white">{depTime}</span>
                          <span className="text-xs font-bold text-slate-400 uppercase">{origin.split(" ")[0]}</span>
                        </div>
                        
                        {/* Connection Line */}
                        <div className="flex flex-col items-center min-w-[60px] relative px-1">
                          <span className="text-[9px] text-slate-400 font-semibold">{duration}</span>
                          <div className="w-full h-0.5 relative flex items-center justify-center" style={{ backgroundColor: '#475569' }}>
                            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#94a3b8' }}></div>
                          </div>
                          <span className="text-[9px] text-slate-400 font-medium mt-0.5">{stops}</span>
                        </div>
                        
                        {/* Arrival */}
                        <div className="flex items-baseline gap-1.5">
                          <span className="font-black text-base text-white">{arrTime}</span>
                          <span className="text-xs font-bold text-slate-400 uppercase">{destination.split(" ")[0]}</span>
                        </div>
                      </div>
 
                      {/* Line 3: Bags & Cancellation Badges */}
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        {/* Baggage Badge */}
                        <div className="dark-card-badge text-[10px] px-2 py-0.5 rounded flex items-center gap-1">
                          <span>💼 Baggage:</span>
                          <span className="font-semibold text-slate-200">{baggageAllowance}</span>
                        </div>
                        
                        {/* Cancellation Policy Badge */}
                        <div className={`text-[10px] px-2 py-0.5 rounded border flex items-center gap-1 ${
                          isRefundable 
                            ? "bg-emerald-950/40 text-emerald-400 border-emerald-900/40" 
                            : "bg-amber-950/40 text-amber-400 border-amber-900/40"
                        }`}>
                          <span>{isRefundable ? "✓ Refundable" : "✕ Non-Refundable"}</span>
                          {cancellationText !== "Refundable" && cancellationText !== "Non-Refundable" && (
                            <span className="opacity-90 font-medium">({cancellationText})</span>
                          )}
                        </div>
                      </div>

                      {/* Alternatives Row */}
                      {res.alternatives && res.alternatives.filter((alt: any) => !alt.is_simulated).length > 0 && (
                        <div className="flex items-center gap-1.5 mt-2 pt-1 border-t border-slate-800/40 flex-wrap">
                          <span className="text-[9px] text-slate-500 font-semibold uppercase tracking-wider">Also on:</span>
                          {res.alternatives.filter((alt: any) => !alt.is_simulated).map((alt: any, ai: number) => (
                            <span key={ai} className="text-[9px] bg-slate-800/60 text-slate-400 px-2 py-0.5 rounded border border-slate-700 flex items-center gap-1">
                              <span className="font-medium">{alt.provider_name}:</span>
                              <span className="font-bold text-emerald-400">₹{Number(alt.price).toLocaleString()}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Right Section: Price and Book Button */}
                    <div className="text-right w-full md:w-auto flex md:flex-col justify-between md:justify-center items-center md:items-end gap-3 border-t md:border-t-0 border-slate-800/60 pt-3 md:pt-0">
                      <div>
                        <div className="font-black text-emerald-400 text-lg md:text-xl tracking-tight">₹{(res.price_per_passenger || res.price || 0).toLocaleString()}</div>
                        {res.price_per_passenger && passengers > 1 && (
                          <div className="text-[10px] text-slate-400 font-semibold">Total: ₹{(res.total_price || res.price_per_passenger * passengers).toLocaleString()}</div>
                        )}
                      </div>
                      <button 
                        onClick={() => onBook({
                          vertical: "flights",
                          amount: res.total_price || res.price,
                          details: {
                            origin: origin.split(" ")[0],
                            destination: destination.split(" ")[0],
                            airline_code: airlineCode,
                            flight_number: flightNumber.split("-")[1] || flightNumber,
                            cabin_class: cabinClass.toUpperCase(),
                            passengers: Array.from({ length: passengers }, (_, i) => ({ name: `Traveler Guest ${i+1}`, age: 32 })),
                            provider_name: res.provider_name,
                            offer_id: res.offer_id
                          },
                          title: `${airlineName} ${flightNumber}`,
                          subtitle: `${origin.split(" ")[0]} ➔ ${destination.split(" ")[0]}`
                        })}
                        className="bg-blue-600 hover:bg-blue-500 active:scale-95 text-white text-[11px] font-extrabold px-4 py-2 rounded-xl flex items-center gap-1 shadow-lg shadow-blue-600/10 cursor-pointer transition-all"
                      >
                        Book Flight <ArrowRight size={12} />
                      </button>
                    </div>
                  </div>
                );
              });
            })()}
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

  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [guests, setGuests] = useState(2);
  const [starRating, setStarRating] = useState("all");

  const [sortBy, setSortBy] = useState("price_asc");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [cancellationFilter, setCancellationFilter] = useState("all");

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    fetch(`${API_URL}/agents/preferences`, {
      headers: {
        "Authorization": `Bearer ${token}`
      }
    })
    .then(res => res.json())
    .then(data => {
      if (data && Array.isArray(data.preferences)) {
        for (const pref of data.preferences) {
          const lowerPref = pref.toLowerCase();
          if (lowerPref.includes("luxury resort") || lowerPref.includes("prefer luxury") || lowerPref.includes("taj hotels")) {
            setCategoryFilter("Luxury Resort");
          } else if (lowerPref.includes("business hotel")) {
            setCategoryFilter("Business Hotel");
          } else if (lowerPref.includes("hostel") || lowerPref.includes("backpackers")) {
            setCategoryFilter("Hostel");
          }
          if (lowerPref.includes("free cancellation") || lowerPref.includes("flexible cancel")) {
            setCancellationFilter("free");
          }
        }
      }
    })
    .catch(console.error);
  }, []);

  const [error, setError] = useState<string | null>(null);

  const handleSearch = (overrideSort = sortBy, overrideCategory = categoryFilter, overrideCancellation = cancellationFilter) => {
    if (!city.trim()) {
      alert("Please enter a city or property name.");
      return;
    }
    if (!checkIn) {
      alert("Please select a check-in date.");
      return;
    }
    if (!checkOut) {
      alert("Please select a check-out date.");
      return;
    }
    setLoading(true);
    setResults([]);
    setError(null);
    
    let url = `${API_URL}/hotels/search?city=${encodeURIComponent(city)}&checkIn=${checkIn}&checkOut=${checkOut}&adults=${guests}&rooms=1`;
    if (overrideSort) url += `&sort_by=${overrideSort}`;
    if (overrideCategory && overrideCategory !== "all") url += `&category=${encodeURIComponent(overrideCategory)}`;
    if (overrideCancellation && overrideCancellation !== "all") url += `&cancellation=${overrideCancellation}`;

    fetch(url)
      .then(res => {
        if (!res.ok) throw new Error("Hotel search failed");
        return res.json();
      })
      .then(data => {
        setLoading(false);
        if (Array.isArray(data)) {
          setResults(data);
        } else if (data && Array.isArray(data.results)) {
          setResults(data.results);
        } else {
          setResults([]);
        }
      })
      .catch(err => {
        console.error(err);
        setError("Failed to fetch hotels. Please check your network and try again.");
        setResults([]);
        setLoading(false);
      });
  };

  useEffect(() => {
    if (results.length > 0) {
      handleSearch(sortBy, categoryFilter, cancellationFilter);
    }
  }, [sortBy, categoryFilter, cancellationFilter]);

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
        <button 
          onClick={() => handleSearch()} 
          className="w-full bg-[var(--color-gold)] hover:bg-[#d6b35d] text-[var(--color-obsidian)] font-bold text-sm py-3 rounded-[var(--radius-card)] transition-all flex items-center justify-center gap-1.5 cursor-pointer uppercase tracking-wider border-none"
        >
          Search Hotels
        </button>
      </div>

      {/* Hotel Results Grid */}
      <div className="mt-4">
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {[1, 2].map((i) => (
              <div key={i} className="glass-card p-4 rounded-2xl animate-pulse border border-slate-800 space-y-4">
                <div className="h-48 bg-slate-800 rounded-xl w-full"></div>
                <div className="h-4 bg-slate-800 rounded w-1/3"></div>
                <div className="h-3 bg-slate-800 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="bg-red-950/40 border border-red-800 text-red-200 p-5 rounded-2xl text-center space-y-3 max-w-md mx-auto my-6 shadow-xl">
            <p className="text-xs font-bold">{error}</p>
            <button 
              onClick={() => handleSearch()} 
              className="bg-red-800 hover:bg-red-700 text-white text-[10px] font-black uppercase tracking-wider px-4 py-2 rounded-xl cursor-pointer border border-red-700 active:scale-95 transition-all"
            >
              Retry Search
            </button>
          </div>
        )}

        {!loading && !error && results.length === 0 && (
          <div className="bg-slate-900/40 border border-slate-800 text-slate-400 p-8 rounded-2xl text-center max-w-md mx-auto my-6">
            <p className="text-xs font-bold uppercase tracking-wider">No hotels found matching your query.</p>
            <p className="text-[10px] text-slate-500 mt-1">Try entering popular cities like Delhi, Mumbai, or Goa.</p>
          </div>
        )}

        {!loading && !error && results.length > 0 && (() => {
          const calculateNights = () => {
            if (!checkIn || !checkOut) return 1;
            try {
              const start = new Date(checkIn);
              const end = new Date(checkOut);
              const diffTime = end.getTime() - start.getTime();
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
              return diffDays > 0 ? diffDays : 1;
            } catch {
              return 1;
            }
          };
          const nights = calculateNights();
          
          return (
            <div className="w-full">
              <VehicleRentalCrossSell destinationCity={city} dateRange={{ start: checkIn }} />
              <SearchRouteMap vertical="hotels" destination={city} />
              
              {/* Sorting & Filtering UI Controls */}
              <div className="flex flex-wrap gap-3 items-center justify-between bg-slate-900/60 p-4 rounded-xl border border-slate-800/80 mb-4 mt-2">
                <div className="flex flex-wrap gap-4 items-center">
                  <div className="flex flex-col gap-1">
                    <span className="text-[9px] text-slate-500 uppercase font-black">Sort By</span>
                    <select 
                      value={sortBy} 
                      onChange={(e) => setSortBy(e.target.value)} 
                      className="bg-slate-950 border border-slate-800 text-xs font-bold text-slate-200 p-2 rounded outline-none cursor-pointer focus:border-yellow-400"
                    >
                      <option value="price_asc">Price: Low to High</option>
                      <option value="price_desc">Price: High to Low</option>
                      <option value="rating_desc">Guest Rating: High to Low</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[9px] text-slate-500 uppercase font-black">Category</span>
                    <select 
                      value={categoryFilter} 
                      onChange={(e) => setCategoryFilter(e.target.value)} 
                      className="bg-slate-950 border border-slate-800 text-xs font-bold text-slate-200 p-2 rounded outline-none cursor-pointer focus:border-yellow-400"
                    >
                      <option value="all">All Categories</option>
                      <option value="Luxury Resort">Luxury Resorts</option>
                      <option value="Business Hotel">Business Hotels</option>
                      <option value="Budget Hotel">Budget Hotels</option>
                      <option value="Hostel">Hostels</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[9px] text-slate-500 uppercase font-black">Cancellation</span>
                    <select 
                      value={cancellationFilter} 
                      onChange={(e) => setCancellationFilter(e.target.value)} 
                      className="bg-slate-950 border border-slate-800 text-xs font-bold text-slate-200 p-2 rounded outline-none cursor-pointer focus:border-yellow-400"
                    >
                      <option value="all">Any Cancellation</option>
                      <option value="free">Free Cancellation</option>
                    </select>
                  </div>
                </div>
                <span className="text-[10px] text-slate-400 font-bold bg-slate-950 border border-slate-800/80 px-2.5 py-1.5 rounded">{results.length} hotels found</span>
              </div>

              <div className="flex justify-between items-center mb-3 px-1">
                <h4 className="text-xs text-slate-400 font-bold uppercase tracking-wider">Available Hotels:</h4>
                <span className="text-[10px] text-yellow-500 font-semibold">
                  {"Comparing simulated inventory (HotelBeds & Expedia sandbox)"}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {results.map((res, index) => {
                const hotelId = res.hotelId || res.hotel_id || "H101";
                const hotelName = res.hotelName || res.name || "Luxury Boutique Stay";
                const hotelImage = res.image || res.primary_photo_url || "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800";
                const rating = res.rating || 4.2;
                const reviewScore = res.reviewScore || res.guest_review_score || 8.4;
                const price = res.price || 0;
                const address = res.address || "Heritage Area";
                const distance = res.distance || res.distance_from_center || 1.5;
                const isBreakfast = res.breakfastIncluded !== undefined ? res.breakfastIncluded : res.breakfast_included;
                const isFreeCancel = res.freeCancellation !== undefined ? res.freeCancellation : res.free_cancellation;
                const starsCount = res.stars || 4;
                
                return (
                  <div key={index} className="dark-card-override bg-[#121c33] p-4 rounded-2xl border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between gap-4 relative">
                    {res.ai_pick ? (
                      <div className="absolute -top-2 left-4 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-[9px] text-white font-black px-2.5 py-0.5 rounded-full shadow-lg shadow-indigo-500/30 animate-pulse border border-indigo-400/30 z-20 flex items-center gap-1">✨ AI PICK: {res.ai_pick_reason}</div>
                    ) : index === 0 ? (
                      <div className="absolute -top-2 left-4 bg-gradient-to-r from-emerald-500 to-teal-400 text-[9px] text-white font-black px-2.5 py-0.5 rounded-full shadow-lg shadow-emerald-500/20 animate-pulse z-10">🏆 BEST PRICE</div>
                    ) : null}
                    <div onClick={() => onDetailClick("hotels", res)} className="cursor-pointer">
                      <CardThumbnail ownerType="hotel" ownerId={hotelName} blurHash={res.blur_hash_base64} defaultUrl={hotelImage} />
                      <div className="flex flex-col gap-1.5 mt-3 text-left">
                        <div className="flex items-center gap-1.5">
                          <span className="dark-card-badge text-[8px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                            {res.category || "Hotel"}
                          </span>
                          <span className="text-xs text-blue-400 font-black">{rating} ★ ({starsCount} Stars)</span>
                        </div>
                        
                        <h4 className="font-extrabold text-slate-200 text-base mt-0.5">{hotelName}</h4>
                        
                        <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
                          {reviewScore && (
                            <span className="bg-blue-950/40 text-blue-400 border border-blue-500/20 px-1.5 py-0.5 rounded font-black">
                              ⭐ {reviewScore}/10
                            </span>
                          )}
                          {res.review_count && (
                            <span className="text-slate-400 font-medium">({res.review_count} reviews)</span>
                          )}
                          {distance && (
                            <span className="text-slate-500">• {distance} km from center</span>
                          )}
                        </div>
                        
                        <div className="text-[10px] text-slate-400 truncate mt-0.5">
                          📍 {address}
                        </div>

                        <p className="text-xs text-slate-400 mt-1">{res.details || "Boutique architecture, standard booking options available."}</p>
                        
                        <div className="text-xs text-slate-300 font-black mt-1 flex items-center gap-1">
                          <span>🛏️</span>
                          <span>{res.room_type || "Standard Room"}</span>
                        </div>

                        <div className="flex gap-1.5 flex-wrap mt-1">
                          {isBreakfast && (
                            <span className="text-[9px] bg-emerald-950/40 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded font-bold">🍳 Free Breakfast</span>
                          )}
                          {isFreeCancel && (
                            <span className="text-[9px] bg-teal-950/40 text-teal-400 border border-teal-500/20 px-1.5 py-0.5 rounded font-bold">🛡️ Free Cancellation</span>
                          )}
                        </div>

                        {res.alternatives && res.alternatives.length > 0 && (
                          <div className="flex items-center gap-1.5 flex-wrap mt-2 pt-2 border-t border-slate-800/60">
                            <span className="text-[9px] text-slate-500">Compare:</span>
                            {res.alternatives.map((alt: any, ai: number) => (
                              <span key={ai} className="dark-card-badge text-[9px] px-1.5 py-0.5 rounded">
                                {alt.provider_name}: ₹{Number(alt.price).toLocaleString()}
                              </span>
                            ))}
                          </div>
                        )}
                        
                        <span className="text-[10px] text-blue-400 font-bold block mt-1 hover:underline">View details, reviews & cancellation policies ➔</span>
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-center pt-2 border-t border-slate-800/80">
                      <div>
                        <span className="text-[9px] text-slate-500 uppercase block font-bold">Price per night</span>
                        <span className="font-black text-emerald-400 text-base">₹{price.toLocaleString()}</span>
                        <span className="text-[9px] text-slate-400 block mt-0.5">
                          Total for {nights} {nights === 1 ? "night" : "nights"}: <strong className="text-emerald-400">₹{Number(price * nights).toLocaleString()}</strong>
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => setSelectedHotel({ name: hotelName, blur_hash_base64: res.blur_hash_base64, primary_photo_url: hotelImage })}
                          className="bg-slate-800 hover:bg-slate-750 text-white text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1 transition-all"
                        >
                          Snaps
                        </button>
                        <button 
                          onClick={() => onBook({
                            vertical: "hotels",
                            amount: price * nights,
                            details: {
                              hotel_name: hotelName,
                              hotel_id: hotelId,
                              room_type: res.room_type || "Deluxe Room",
                              guests: [{ name: "Traveler Guest", age: 32 }],
                              provider_name: "Booking.com API",
                              offer_id: `OF-BK-${hotelId}`
                            },
                            title: hotelName,
                            subtitle: address
                          })}
                          className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-1 shadow-md shadow-blue-500/10 transition-all"
                        >
                          Book Room
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            </div>
          );
        })()}
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
function VillasSearchForm({ onBook, onDetailClick }: { onBook: (data: any) => void, onDetailClick: (vert: string, item: any) => void }) {
  const [destination, setDestination] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [propertyType, setPropertyType] = useState("Villa");
  const [rawResults, setRawResults] = useState<any[]>([]);
  const [loading, setLoading] = useTabLoading('villas');

  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [guests, setGuests] = useState(2);

  const handleSearch = () => {
    if (!destination.trim()) {
      alert("Please enter a destination.");
      return;
    }
    if (!checkIn) {
      alert("Please select a check-in date.");
      return;
    }
    if (!checkOut) {
      alert("Please select a check-out date.");
      return;
    }
    setLoading(true);
    setRawResults([]);
    fetch(`${API_URL}/search?vertical=villas&destination=${encodeURIComponent(destination)}`)
      .then(res => res.json())
      .then(data => {
        setLoading(false);
        if (data && Array.isArray(data.results)) {
          setRawResults(data.results);
        }
      })
      .catch(() => setLoading(false));
  };

  const results = rawResults.filter((v: any) => v.property_type === propertyType);

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
        <button 
          onClick={handleSearch} 
          className="w-full bg-[var(--color-gold)] hover:bg-[#d6b35d] text-[var(--color-obsidian)] font-bold text-sm py-3 rounded-[var(--radius-card)] transition-all flex items-center justify-center gap-1.5 cursor-pointer uppercase tracking-wider border-none"
        >
          Search Villas
        </button>
      </div>

      {loading ? (
        <div className="text-center py-6 text-slate-400 text-xs">Searching homestays...</div>
      ) : rawResults.length > 0 ? (
        results.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
        ) : (
          <div className="text-center py-12 bg-slate-950/5 border-3 border-black p-6 rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] text-slate-600 font-bold">
            No properties of type "{propertyType}" available for this destination.
          </div>
        )
      ) : null}
    </div>
  );
}

function TripPlannerForm({ onBook, onDetailClick, setPrefilledMessage, setActiveTab }: { onBook: (data: any) => void, onDetailClick: (vert: string, item: any) => void, setPrefilledMessage: (msg: string) => void, setActiveTab: (tab: any) => void }) {
  const [origin, setOrigin] = useState("DEL");
  const [destination, setDestination] = useState("Goa");
  const [departureDate, setDepartureDate] = useState("2026-12-15");
  const [duration, setDuration] = useState(4);
  const [budget, setBudget] = useState(50000);
  const [style, setStyle] = useState("Solo");
  const [loading, setLoading] = useState(false);
  const [packageData, setPackageData] = useState<any | null>(null);
  const [plannerError, setPlannerError] = useState<{code: number|string, message: string, detail: string} | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'flights' | 'hotels' | 'itinerary' | 'budget'>('overview');


  const handleGenerate = () => {
    setLoading(true);
    setPackageData(null);
    setPlannerError(null);
    const message = `Plan a trip from ${origin} to ${destination} for ${duration} days on ${departureDate} with a total budget of ₹${budget} and travel style: ${style}.`;
    
    fetch(`${API_URL}/agents/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${localStorage.getItem("token")}`
      },
      body: JSON.stringify({
        session_id: `session_planner_${Date.now()}`,
        message: message
      })
    })
    .then(async res => {
      const body = await res.json().catch(() => ({ message: res.statusText }));
      if (!res.ok) {
        const statusMessages: Record<number, { message: string; detail: string }> = {
          401: { message: "Session Expired", detail: "Your login session has expired. Please log out and log in again to continue." },
          403: { message: "Permission Denied", detail: "You don't have permission to use the AI Trip Planner. Please contact support." },
          404: { message: "Planner Endpoint Missing", detail: "The AI planner route could not be found. This is a backend configuration issue." },
          422: { message: "Invalid Planner Request", detail: `The request was rejected: ${body?.detail || body?.message || 'Invalid parameters'}` },
          429: { message: "AI Rate Limit Reached", detail: "The AI service is rate limited. Please wait 30 seconds and try again." },
          500: { message: "AI Backend Error", detail: body?.detail || body?.message || "Internal server error. Check Railway logs for details." },
          503: { message: "AI Service Unavailable", detail: "The AI service is temporarily unavailable. Please try again in a few minutes." },
        };
        const errorInfo = statusMessages[res.status] || {
          message: `HTTP ${res.status} Error`,
          detail: body?.detail || body?.message || "An unexpected error occurred."
        };
        throw Object.assign(new Error(errorInfo.message), { code: res.status, ...errorInfo });
      }
      return body;
    })
    .then(data => {
      setLoading(false);
      if (data && data.response) {
        const parsed = parseAgentData(data.response);
        setPackageData(parsed);
        setActiveSubTab('overview');
      }
    })
    .catch((err: any) => {
      console.error('[TripPlanner] Error:', err);
      setLoading(false);
      setPlannerError({
        code: err.code || 'NETWORK',
        message: err.message || 'Connection Failed',
        detail: err.detail || (err.name === 'TypeError'
          ? 'Cannot reach the backend. Check your network connection or ensure the Railway server is running.'
          : err.message)
      });
    });
  };

  const parseAgentData = (responseText: string) => {
    const parseBlock = (tag: string) => {
      const regex = new RegExp(`\`\`\`${tag}\\n([\\s\\S]*?)\\n\`\`\``);
      const match = responseText.match(regex);
      if (match) {
        try {
          return JSON.parse(match[1]);
        } catch (e) {
          console.error("Failed to parse " + tag, e);
        }
      }
      return null;
    };

    return {
      flights: parseBlock("flights-data"),
      hotels: parseBlock("hotels-data"),
      itinerary: parseBlock("itinerary-data"),
      budget: parseBlock("budget-data"),
      weather: parseBlock("weather-data"),
      text: responseText.replace(/```(flights|hotels|itinerary|budget|weather)-data[\s\S]*?```/g, "").replace(/\n\n+/g, "\n\n").trim()
    };
  };

  return (
    <div className="space-y-6 text-left">
      {/* ── Error Panel ───────────────────────────────────────── */}
      {plannerError && (
        <div className="border-3 border-red-500 bg-red-950/40 p-5 shadow-[4px_4px_0px_0px_#ef4444] flex items-start gap-4">
          <div className="text-red-400 text-2xl mt-0.5">⚠</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1">
              <span className="bg-red-500 text-white text-[10px] font-black px-2 py-0.5 uppercase tracking-wider">
                {plannerError.code}
              </span>
              <span className="text-red-300 font-black text-sm">{plannerError.message}</span>
            </div>
            <p className="text-slate-300 text-xs leading-relaxed">{plannerError.detail}</p>
            {plannerError.code === 500 && (
              <p className="text-slate-500 text-xs mt-2">
                💡 If this says "No LLM provider configured" — a valid GROQ_API_KEY needs to be set in Railway environment variables.
              </p>
            )}
          </div>
          <button onClick={() => setPlannerError(null)} className="text-slate-500 hover:text-white text-lg ml-2 shrink-0" title="Dismiss">✕</button>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4 bg-slate-950/20 p-6 border-3 border-black shadow-[6px_6px_0px_0px_#000000]">
        <div className="space-y-1.5 md:col-span-1">
          <span className="text-[10px] text-slate-400 font-extrabold uppercase block">Origin</span>
          <input type="text" value={origin} onChange={(e) => setOrigin(e.target.value)} className="w-full bg-white border-3 border-black text-slate-900 font-black text-sm px-3 py-2 outline-none focus:bg-yellow-50/50" />
        </div>
        <div className="space-y-1.5 md:col-span-1">
          <span className="text-[10px] text-slate-400 font-extrabold uppercase block">Destination</span>
          <input type="text" value={destination} onChange={(e) => setDestination(e.target.value)} className="w-full bg-white border-3 border-black text-slate-900 font-black text-sm px-3 py-2 outline-none focus:bg-yellow-50/50" />
        </div>
        <div className="space-y-1.5 md:col-span-1">
          <span className="text-[10px] text-slate-400 font-extrabold uppercase block">Departure Date</span>
          <input type="date" value={departureDate} onChange={(e) => setDepartureDate(e.target.value)} className="w-full bg-white border-3 border-black text-slate-900 font-black text-sm px-3 py-2 outline-none focus:bg-yellow-50/50" />
        </div>
        <div className="space-y-1.5 md:col-span-1">
          <span className="text-[10px] text-slate-400 font-extrabold uppercase block">Duration (Days)</span>
          <input type="number" value={duration} onChange={(e) => setDuration(parseInt(e.target.value))} className="w-full bg-white border-3 border-black text-slate-900 font-black text-sm px-3 py-2 outline-none focus:bg-yellow-50/50" />
        </div>
        <div className="space-y-1.5 md:col-span-1">
          <span className="text-[10px] text-slate-400 font-extrabold uppercase block">Budget (INR)</span>
          <input type="number" value={budget} onChange={(e) => setBudget(parseInt(e.target.value))} className="w-full bg-white border-3 border-black text-slate-900 font-black text-sm px-3 py-2 outline-none focus:bg-yellow-50/50" />
        </div>
        <div className="space-y-1.5 md:col-span-1">
          <span className="text-[10px] text-slate-400 font-extrabold uppercase block">Travel Style</span>
          <select value={style} onChange={(e) => setStyle(e.target.value)} className="w-full bg-white border-3 border-black text-slate-900 font-black text-sm px-3 py-2 outline-none cursor-pointer focus:bg-yellow-50/50">
            <option value="Solo">Solo</option>
            <option value="Family">Family</option>
            <option value="Luxury">Luxury</option>
            <option value="Adventure">Adventure</option>
            <option value="HoneyMoon">HoneyMoon</option>
          </select>
        </div>
        
        <button onClick={handleGenerate} disabled={loading} className="w-full md:col-span-6 bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-500 hover:to-yellow-600 text-black font-black text-sm py-3 rounded-lg border-none cursor-pointer uppercase shadow-md shadow-amber-500/10 active:translate-y-px transition-all">
          {loading ? "🤖 AI Consultant Orchestrating Package..." : "⚡ Generate AI Travel Package"}
        </button>
      </div>

      {loading && (
        <div className="glass-card p-10 rounded-2xl border border-slate-800 flex flex-col items-center justify-center space-y-4 text-center animate-pulse">
          <div className="w-12 h-12 rounded-full border-4 border-yellow-400 border-t-transparent animate-spin"></div>
          <p className="text-slate-300 font-bold text-sm">Consultant dispatching Flight, Hotel, Budget, Dining, Weather & Safety specialists...</p>
        </div>
      )}

      {packageData && (
        <div className="bg-[#0b1224] border border-slate-800 p-6 rounded-2xl space-y-6">
          <div className="flex border-b border-slate-800 gap-1 overflow-x-auto pb-px">
            {(['overview', 'flights', 'hotels', 'itinerary', 'budget'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveSubTab(tab)}
                className={`px-4 py-2 text-xs font-black uppercase border-b-2 transition-all cursor-pointer ${
                  activeSubTab === tab 
                    ? 'border-yellow-400 text-yellow-400' 
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="pt-2">
            {activeSubTab === 'overview' && (
              <div className="space-y-4">
                <h3 className="font-extrabold text-lg text-white">📋 Travel Guide Summary</h3>
                <div className="text-sm whitespace-pre-wrap leading-relaxed font-sans max-w-none dark-card-override" style={{ color: '#ffffff' }}>
                  {packageData.text}
                </div>
              </div>
            )}

            {activeSubTab === 'flights' && (
              <div className="space-y-4">
                <h3 className="font-extrabold text-lg text-white">✈️ AI Recommended Flights</h3>
                {packageData.flights && packageData.flights.length > 0 ? (
                  <div className="space-y-3">
                    {packageData.flights.map((res: any, idx: number) => (
                      <div key={idx} className="bg-[#0f192e] p-5 rounded-2xl flex justify-between items-center border border-slate-800 relative">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-sm text-slate-100">{res.airline}</span>
                            <span className="text-[10px] font-mono bg-blue-950 text-blue-300 px-2 py-0.5 rounded">{res.flight_number}</span>
                            <span className="text-[9px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded uppercase font-bold">{res.cabin_class}</span>
                          </div>
                          <div className="text-slate-300 text-xs font-bold">
                            🛫 {res.dep || `${res.origin} 08:00`} ➔ 🛬 {res.arr || `${res.destination} 10:30`}
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 block">TOTAL FARE</span>
                          <span className="font-black text-emerald-400 text-base">₹{(res.price || res.total_price).toLocaleString()}</span>
                          <button 
                            onClick={() => onBook({
                              vertical: "flights",
                              amount: res.price || res.total_price,
                              details: res,
                              title: `${res.airline} flight ${res.flight_number}`,
                              subtitle: `${res.cabin_class} One-way`
                            })}
                            className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-3 py-1.5 rounded-lg border-none cursor-pointer mt-1.5 block active:translate-y-px"
                          >
                            Select Flight
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-400 text-xs">No specific flight blocks extracted. Check Overview tab for pricing guidelines.</p>
                )}
              </div>
            )}

            {activeSubTab === 'hotels' && (
              <div className="space-y-4">
                <h3 className="font-extrabold text-lg text-white">🏨 AI Recommended Accommodations</h3>
                {packageData.hotels && packageData.hotels.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {packageData.hotels.map((res: any, idx: number) => (
                      <div key={idx} className="bg-[#121c33] p-4 rounded-2xl border border-slate-800 flex flex-col justify-between gap-3 text-left">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="bg-slate-800 text-[8px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider text-slate-300">
                              {res.category || "Hotel"}
                            </span>
                            <span className="text-xs text-blue-400 font-black">★ {res.rating}</span>
                          </div>
                          <h4 className="font-extrabold text-slate-200 text-sm mt-1">{res.name}</h4>
                          <span className="text-[10px] text-slate-400 block mt-1">📍 {res.address || res.location_summary || "Located in center"}</span>
                          <div className="flex gap-2 mt-1.5 flex-wrap">
                            {res.amenities && res.amenities.map((a: string, i: number) => (
                              <span key={i} className="text-[9px] bg-slate-900 px-1.5 py-0.5 rounded text-slate-400">{a}</span>
                            ))}
                          </div>
                        </div>
                        <div className="flex justify-between items-center pt-2 border-t border-slate-800/80">
                          <div>
                            <span className="text-[8px] text-slate-500 block uppercase font-bold">Total Stay</span>
                            <span className="font-black text-emerald-400 text-sm">₹{(res.total_price || res.price).toLocaleString()}</span>
                          </div>
                          <button 
                            onClick={() => onBook({
                              vertical: "hotels",
                              amount: res.total_price || res.price,
                              details: res,
                              title: res.name,
                              subtitle: `${res.category || "Hotel"} Accommodation`
                            })}
                            className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-3 py-1.5 rounded-lg border-none cursor-pointer active:translate-y-px"
                          >
                            Select Hotel
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-400 text-xs">No specific hotel blocks extracted. Check Overview tab for recommendations.</p>
                )}
              </div>
            )}

            {activeSubTab === 'itinerary' && (
              <div className="space-y-4">
                <h3 className="font-extrabold text-lg text-white">🗓️ Curated Daily Sightseeing</h3>
                {packageData.itinerary && Array.isArray(packageData.itinerary) ? (
                  <div className="relative border-l border-slate-800 ml-4 pl-6 space-y-6 text-left">
                    {packageData.itinerary.map((day: any, idx: number) => (
                      <div key={idx} className="relative">
                        <div className="absolute -left-10 top-0 bg-yellow-400 text-black border-2 border-black w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shadow-[1px_1px_0px_0px_#000000]">
                          {idx + 1}
                        </div>
                        <h4 className="font-extrabold text-sm text-slate-200 uppercase">{day.day || `Day ${idx + 1}`}: {day.theme || "Exploration"}</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                          {day.morning && (
                            <div className="bg-slate-900/50 p-2.5 rounded-lg border border-slate-850">
                              <span className="text-[8px] text-slate-500 uppercase font-black">🌅 Morning</span>
                              <p className="text-xs text-slate-300 mt-1 leading-snug">{day.morning}</p>
                            </div>
                          )}
                          {day.afternoon && (
                            <div className="bg-slate-900/50 p-2.5 rounded-lg border border-slate-850">
                              <span className="text-[8px] text-slate-500 uppercase font-black">☀️ Afternoon</span>
                              <p className="text-xs text-slate-300 mt-1 leading-snug">{day.afternoon}</p>
                            </div>
                          )}
                          {day.evening && (
                            <div className="bg-slate-900/50 p-2.5 rounded-lg border border-slate-850">
                              <span className="text-[8px] text-slate-500 uppercase font-black">🌙 Evening</span>
                              <p className="text-xs text-slate-300 mt-1 leading-snug">{day.evening}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-400 text-xs">No structured daily itinerary found. Check Overview tab for the daily highlights plan.</p>
                )}
              </div>
            )}

            {activeSubTab === 'budget' && (
              <div className="space-y-4">
                <h3 className="font-extrabold text-lg text-white">📊 Category Budget Allocation</h3>
                {packageData.budget ? (
                  <div className="bg-slate-900/40 p-5 rounded-2xl border border-slate-800 space-y-4">
                    <div className="flex flex-col gap-3">
                      <div>
                        <span className="text-xs text-slate-400">Total Planned Spend</span>
                        <div className="text-2xl font-black text-yellow-400">₹{budget.toLocaleString()}</div>
                      </div>
                      <div className="w-full bg-slate-950 h-6 rounded-full overflow-hidden flex border border-slate-800">
                        {packageData.budget.flights && (
                          <div style={{ width: `${(packageData.budget.flights / budget) * 100}%` }} className="bg-indigo-500 h-full flex items-center justify-center text-[8px] font-black text-white" title="Flights">FL</div>
                        )}
                        {packageData.budget.hotels && (
                          <div style={{ width: `${(packageData.budget.hotels / budget) * 100}%` }} className="bg-emerald-500 h-full flex items-center justify-center text-[8px] font-black text-white" title="Hotels">HT</div>
                        )}
                        {packageData.budget.activities && (
                          <div style={{ width: `${(packageData.budget.activities / budget) * 100}%` }} className="bg-amber-500 h-full flex items-center justify-center text-[8px] font-black text-white" title="Activities">AC</div>
                        )}
                        {packageData.budget.food_transport && (
                          <div style={{ width: `${(packageData.budget.food_transport / budget) * 100}%` }} className="bg-pink-500 h-full flex items-center justify-center text-[8px] font-black text-white" title="Dining & Transport">DT</div>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 pt-2">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span>
                        <div className="text-xs">
                          <span className="text-slate-400 font-semibold">Flights:</span> <span className="font-extrabold text-white">₹{(packageData.budget.flights || 0).toLocaleString()}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                        <div className="text-xs">
                          <span className="text-slate-400 font-semibold">Accommodations:</span> <span className="font-extrabold text-white">₹{(packageData.budget.hotels || 0).toLocaleString()}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                        <div className="text-xs">
                          <span className="text-slate-400 font-semibold">Activities:</span> <span className="font-extrabold text-white">₹{(packageData.budget.activities || 0).toLocaleString()}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-pink-500"></span>
                        <div className="text-xs">
                          <span className="text-slate-400 font-semibold">Dining & Cabs:</span> <span className="font-extrabold text-white">₹{(packageData.budget.food_transport || 0).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-slate-400 text-xs">No specific budget data split block found. Check Overview tab for allocation ratios.</p>
                )}
              </div>
            )}
          </div>
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
    fetch(`${API_URL}/search?vertical=holidays&destination=${encodeURIComponent(destination)}`)
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
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
        <button 
          onClick={handleSearch} 
          className="w-full bg-[var(--color-gold)] hover:bg-[#d6b35d] text-[var(--color-obsidian)] font-bold text-sm py-3 rounded-[var(--radius-card)] transition-all flex items-center justify-center gap-1.5 cursor-pointer uppercase tracking-wider border-none"
        >
          Search Packages
        </button>
      </div>

      {loading ? (
        <div className="text-center py-6 text-slate-400 text-xs">Searching flight+hotel holiday combos...</div>
      ) : results.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
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
  const [fromStn, setFromStn] = useState("");
  const [toStn, setToStn] = useState("");
  const [showFromSuggestions, setShowFromSuggestions] = useState(false);
  const [showToSuggestions, setShowToSuggestions] = useState(false);
  const [coach, setCoach] = useState("3A");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useTabLoading('trains');

  const handleSearch = () => {
    if (!fromStn.trim()) {
      alert("Please enter an origin station.");
      return;
    }
    if (!toStn.trim()) {
      alert("Please enter a destination station.");
      return;
    }
    setLoading(true);
    setResults([]);
    fetch(`${API_URL}/search?vertical=trains&origin=${encodeURIComponent(fromStn)}&destination=${encodeURIComponent(toStn)}`)
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
          <button 
            onClick={handleSearch} 
            className="w-full bg-[var(--color-gold)] hover:bg-[#d6b35d] text-[var(--color-obsidian)] font-bold text-sm py-3 rounded-[var(--radius-card)] transition-all flex items-center justify-center gap-1.5 cursor-pointer uppercase tracking-wider border-none"
          >
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
  const [fromCity, setFromCity] = useState("");
  const [toCity, setToCity] = useState("");
  const [showFromSuggestions, setShowFromSuggestions] = useState(false);
  const [showToSuggestions, setShowToSuggestions] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useTabLoading('buses');
  const [showSeatModal, setShowSeatModal] = useState<any | null>(null);
  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);

  const handleSearch = () => {
    if (!fromCity.trim()) {
      alert("Please enter an origin city.");
      return;
    }
    if (!toCity.trim()) {
      alert("Please enter a destination city.");
      return;
    }
    setLoading(true);
    setResults([]);
    fetch(`${API_URL}/search?vertical=buses&origin=${encodeURIComponent(fromCity)}&destination=${encodeURIComponent(toCity)}`)
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
          <button 
            onClick={handleSearch} 
            className="w-full bg-[var(--color-gold)] hover:bg-[#d6b35d] text-[var(--color-obsidian)] font-bold text-sm py-3 rounded-[var(--radius-card)] transition-all flex items-center justify-center gap-1.5 cursor-pointer uppercase tracking-wider border-none"
          >
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
  const [pickup, setPickup] = useState("");
  const [drop, setDrop] = useState("");
  const [showPickupSuggestions, setShowPickupSuggestions] = useState(false);
  const [showDropSuggestions, setShowDropSuggestions] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useTabLoading('cabs');

  const handleSearch = () => {
    if (!pickup.trim()) {
      alert("Please enter a pickup address.");
      return;
    }
    if (!drop.trim()) {
      alert("Please enter a drop-off address.");
      return;
    }
    setLoading(true);
    setResults([]);
    fetch(`${API_URL}/search?vertical=cabs&origin=${encodeURIComponent(pickup)}&destination=${encodeURIComponent(drop)}`)
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
          <button 
            onClick={handleSearch} 
            className="w-full bg-[var(--color-gold)] hover:bg-[#d6b35d] text-[var(--color-obsidian)] font-bold text-sm py-3 rounded-[var(--radius-card)] transition-all flex items-center justify-center gap-1.5 cursor-pointer uppercase tracking-wider border-none"
          >
            <Search size={14} /> Estimate Cab
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-6 text-slate-400 text-xs">Computing fuel tolls & routes...</div>
      ) : results.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
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
    if (!destination.trim()) {
      alert("Please enter a destination city.");
      return;
    }
    setLoading(true);
    setResults([]);
    fetch(`${API_URL}/search?vertical=tours&destination=${encodeURIComponent(destination)}`)
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
          <button 
            onClick={handleSearch} 
            className="w-full bg-[var(--color-gold)] hover:bg-[#d6b35d] text-[var(--color-obsidian)] font-bold text-sm py-3 rounded-[var(--radius-card)] transition-all flex items-center justify-center gap-1.5 cursor-pointer uppercase tracking-wider border-none"
          >
            <Search size={14} /> Search Activities
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-6 text-slate-400 text-xs">Connecting with Local Guide Agents...</div>
      ) : results.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
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

function VisaSearchForm({ 
  onBook, onDetailClick, profileName, profileData 
}: { 
  onBook: (data: any) => void, 
  onDetailClick: (vert: string, item: any) => void,
  profileName: string,
  profileData: any
}) {
  const [country, setCountry] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useTabLoading('visa');
  const [rules, setRules] = useState<any | null>(null);

  const handleQueryVisa = () => {
    if (!country.trim()) {
      alert("Please enter a destination country.");
      return;
    }
    setLoading(true);
    setRules(null);
    fetch(`${API_URL}/search?vertical=visa&destination=${encodeURIComponent(country)}`)
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
          <button 
            onClick={handleQueryVisa} 
            className="w-full bg-[var(--color-gold)] hover:bg-[#d6b35d] text-[var(--color-obsidian)] font-bold text-sm py-3 rounded-[var(--radius-card)] transition-all flex items-center justify-center gap-1.5 cursor-pointer uppercase tracking-wider border-none"
          >
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
                  applicant: { name: profileName || "Traveler", passport: (profileData && profileData.passport_number) ? profileData.passport_number : "Z998271" }
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
  const [port, setPort] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useTabLoading('cruises');

  const handleSearch = () => {
    if (!port.trim()) {
      alert("Please enter a departure port.");
      return;
    }
    setLoading(true);
    setResults([]);
    fetch(`${API_URL}/search?vertical=cruises&origin=${encodeURIComponent(port)}`)
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
          <button 
            onClick={handleSearch} 
            className="w-full bg-[var(--color-gold)] hover:bg-[#d6b35d] text-[var(--color-obsidian)] font-bold text-sm py-3 rounded-[var(--radius-card)] transition-all flex items-center justify-center gap-1.5 cursor-pointer uppercase tracking-wider border-none"
          >
            <Search size={14} /> Search Cruises
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-6 text-slate-400 text-xs">Consulting ocean cruiser bookings...</div>
      ) : results.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
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
  const [currencyPair, setCurrencyPair] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState("Home Delivery");
  const [rateInfo, setRateInfo] = useState<any | null>(null);
  const [kycUploaded, setKycUploaded] = useState(false);
  const [uploadingKyc, setUploadingKyc] = useState(false);

  const handleRateLookup = () => {
    if (!currencyPair.trim()) {
      alert("Please select a currency pair.");
      return;
    }
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) {
      alert("Please enter a valid amount to convert.");
      return;
    }
    fetch(`${API_URL}/search?vertical=forex`)
      .then(res => res.json())
      .then(data => {
        setRateInfo(data);
      });
  };

  useEffect(() => {
    if (currencyPair.trim()) {
      handleRateLookup();
    }
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
          <button 
            onClick={handleRateLookup} 
            className="w-full bg-[var(--color-gold)] hover:bg-[#d6b35d] text-[var(--color-obsidian)] font-bold text-sm py-3 rounded-[var(--radius-card)] transition-all flex items-center justify-center gap-1.5 cursor-pointer uppercase tracking-wider border-none"
          >
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
    if (!destination.trim()) {
      alert("Please enter a destination.");
      return;
    }
    setLoading(true);
    setResults([]);
    fetch(`${API_URL}/search?vertical=insurance&destination=${encodeURIComponent(destination)}`)
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
          <button 
            onClick={handleSearch} 
            className="w-full bg-[var(--color-gold)] hover:bg-[#d6b35d] text-[var(--color-obsidian)] font-bold text-sm py-3 rounded-[var(--radius-card)] transition-all flex items-center justify-center gap-1.5 cursor-pointer uppercase tracking-wider border-none"
          >
            <Search size={14} /> Compare Plans
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-6 text-slate-400 text-xs">Running coverage risk premium calculations...</div>
      ) : results.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
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
  const [travelerName, setTravelerName] = useState("");
  const [travelerAge, setTravelerAge] = useState("30");
  const [travelerEmail, setTravelerEmail] = useState("");
  const [travelerPhone, setTravelerPhone] = useState("");
  const [cardHolderName, setCardHolderName] = useState("");
  const [cardIssuingBank, setCardIssuingBank] = useState("HDFC Bank");
  const [isStudent, setIsStudent] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [discountAmount, setDiscountAmount] = useState(0);
  const [promoStatus, setPromoStatus] = useState("");
  const [bookingRef, setBookingRef] = useState("");
  const [invoiceText, setInvoiceText] = useState("");
  const [timeLeft, setTimeLeft] = useState(300);

  // Fetch real profile details dynamically (Phase 7)
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    fetch(`${API_URL}/profile`, {
      headers: { "Authorization": `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data && data.full_name) {
          setTravelerName(data.full_name);
          setCardHolderName(data.full_name);
          if (data.email) setTravelerEmail(data.email);
          if (data.mobile_number) setTravelerPhone(data.mobile_number);
          if (data.dob) {
            const birthDate = new Date(data.dob);
            const today = new Date();
            let age = today.getFullYear() - birthDate.getFullYear();
            const m = today.getMonth() - birthDate.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
              age--;
            }
            setTravelerAge(age.toString());
          }
        }
      })
      .catch(() => {});
  }, []);

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
          fetch(`${API_URL}/bookings/${bookingRef}/invoice?vertical=${data.vertical}`)
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

    const localToken = localStorage.getItem('token');

    // 1. Create Hold Reservation
    fetch(`${API_URL}/bookings/hold`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        ...(localToken ? { "Authorization": `Bearer ${localToken}` } : {})
      },
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

        // 2. Redirect to Checkout Page
        window.history.pushState(null, '', `/checkout/${holdRes.booking_reference}`);
        window.dispatchEvent(new Event('popstate'));
        onClose();
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
          <h3 className="font-bold text-xl tracking-wide">
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

function MyTripsView({ userProfile, setActiveTab, onNavigate, setPrefilledMessage }: { userProfile: any, setActiveTab: any, onNavigate: (path: string) => void, setPrefilledMessage?: any }) {
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
    const savedToken = localStorage.getItem('token');
    const decoded = savedToken ? decodeJwt(savedToken) : null;
    const userId = decoded?.id || 1;
    fetch(`${API_URL}/bookings/user/${userId}`)
      .then(res => res.json())
      .then(data => {
        setTrips(data);
        localStorage.setItem('offline:trips_list', JSON.stringify(data));
        setLoading(false);
      })
      .catch((err) => {
        console.warn("Fetch trips failed, loading from cache...", err);
        const cached = localStorage.getItem('offline:trips_list');
        if (cached) {
          try {
            setTrips(JSON.parse(cached));
          } catch {
            setTrips([]);
          }
        }
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchTrips();
  }, []);

  const handleCancelTrip = (ref: string, vertical: string) => {
    fetch(`${API_URL}/bookings/cancel?booking_reference=${ref}&vertical=${vertical}&action_type=cancel`, {
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
    fetch(`${API_URL}/bookings/cancel?booking_reference=${ref}&vertical=${vertical}&action_type=refund`, {
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
    fetch(`${API_URL}/bookings/${ref}/invoice?vertical=${vertical}`)
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
    <div className="p-4 md:p-8 pb-28 md:pb-16 h-full overflow-y-auto overflow-x-hidden max-w-4xl mx-auto space-y-6 text-black font-sans text-left">
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
                  onClick={() => onNavigate(`/booking/${trip.booking_reference}`)}
                  className="text-xs text-blue-600 font-black hover:underline block pt-1 cursor-pointer"
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

            {/* Rent a Ride Handover boarding pass cutout */}
            {(selectedTrip.vertical === "rent-a-ride" || selectedTrip.vertical === "vehicle_rental") && 
             (selectedTrip.status === "confirmed" || selectedTrip.status === "vehicle_handed_over") && (
              <div className="border-3 border-black p-4 rounded-xl bg-orange-50 text-slate-900 space-y-4 text-left relative overflow-hidden shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <div className="flex justify-between items-center border-b-2 border-dashed border-slate-400 pb-2">
                  <div>
                    <span className="text-[8px] bg-slate-900 text-white px-1.5 py-0.5 rounded font-black uppercase">Handover Pass</span>
                    <h4 className="font-extrabold text-sm text-slate-800 mt-1">VEHICLE HANDOVER PASS</h4>
                  </div>
                  <span className="text-xs font-mono font-black text-slate-600">
                    {selectedTrip.qr_handover_code || "QR-RE9A1B"}
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                  <div className="space-y-1.5 flex-1">
                    <p className="text-xs"><strong>Vehicle:</strong> {selectedTrip.title}</p>
                    <p className="text-xs"><strong>Details:</strong> {selectedTrip.subtitle}</p>
                    <p className="text-xs"><strong>Depot:</strong> Panaji Downtown Premium Center</p>
                    <p className="text-[10px] text-slate-500 font-semibold italic">
                      Show this pass to the executive at the depot parking lot to collect keys.
                    </p>
                  </div>

                  <div className="border-l-0 sm:border-l-2 border-dashed border-slate-300 pl-0 sm:pl-4 flex flex-col items-center shrink-0">
                    <div className="w-20 h-20 bg-white border-2 border-black flex items-center justify-center p-1 rounded-lg">
                      <svg className="w-full h-full text-black" viewBox="0 0 100 100">
                        <rect x="10" y="10" width="20" height="20" fill="currentColor"/>
                        <rect x="70" y="10" width="20" height="20" fill="currentColor"/>
                        <rect x="10" y="70" width="20" height="20" fill="currentColor"/>
                        <rect x="40" y="40" width="20" height="20" fill="currentColor"/>
                        <rect x="15" y="15" width="10" height="10" fill="white"/>
                        <rect x="75" y="15" width="10" height="10" fill="white"/>
                        <rect x="15" y="75" width="10" height="10" fill="white"/>
                        <rect x="35" y="10" width="5" height="5" fill="currentColor"/>
                        <rect x="50" y="25" width="5" height="5" fill="currentColor"/>
                        <rect x="60" y="45" width="5" height="5" fill="currentColor"/>
                        <rect x="10" y="50" width="5" height="5" fill="currentColor"/>
                        <rect x="85" y="80" width="5" height="5" fill="currentColor"/>
                      </svg>
                    </div>
                    <span className="text-[9px] font-bold text-slate-500 mt-1 uppercase font-mono">SCAN TO UNLOCK</span>
                  </div>
                </div>

                <div className="flex gap-2 border-t border-slate-200 pt-3">
                  {selectedTrip.status === "confirmed" ? (
                    <button
                      onClick={() => {
                        fetch(`${API_URL}/rent-a-ride/transition?booking_reference=${selectedTrip.booking_reference}&status=vehicle_handed_over`, { method: "POST" })
                          .then(res => res.json())
                          .then(data => {
                            setSelectedTrip({ ...selectedTrip, status: "vehicle_handed_over" });
                            fetchTrips();
                          });
                      }}
                      className="flex-1 bg-yellow-300 hover:bg-yellow-400 border-2 border-black font-black py-1.5 rounded-lg text-xs uppercase cursor-pointer text-slate-900 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-0.5 active:shadow-none transition-all flex items-center justify-center gap-1 border-none"
                    >
                      🔑 Claim Keys & Handover
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        fetch(`${API_URL}/rent-a-ride/transition?booking_reference=${selectedTrip.booking_reference}&status=trip_active`, { method: "POST" })
                          .then(res => res.json())
                          .then(data => {
                            setSelectedTrip({ ...selectedTrip, status: "trip_active" });
                            fetchTrips();
                          });
                      }}
                      className="flex-1 bg-emerald-400 hover:bg-emerald-500 border-2 border-black font-black py-1.5 rounded-lg text-xs uppercase cursor-pointer text-emerald-950 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-0.5 active:shadow-none transition-all flex items-center justify-center gap-1 border-none"
                    >
                      🏎️ Start Active Ride
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Rent a Ride Active Telemetry dashboard */}
            {(selectedTrip.vertical === "rent-a-ride" || selectedTrip.vertical === "vehicle_rental") && 
             selectedTrip.status === "trip_active" && (
              <ActiveRentalManager 
                bookingReference={selectedTrip.booking_reference} 
                fetchTrips={fetchTrips} 
                setSelectedTrip={setSelectedTrip} 
              />
            )}

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
      <div className="flex gap-4 overflow-x-auto pb-2 border-b border-slate-800/80 text-xs">
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
          <div key={idx} className={`offer-card-item flex-none w-80 snap-start bg-[var(--color-surface)] border border-slate-800/80 rounded-[var(--radius-card)] p-5 flex flex-col justify-between hover:border-[var(--color-gold)] hover:-translate-y-1 hover:shadow-xl transition-all duration-300 animate-slideup stagger-delay-${(idx % 3) + 1}`}>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-[9px] font-mono uppercase bg-[var(--color-surface-raised)] text-[var(--color-gold)] px-2 py-0.5 rounded-[var(--radius-inner)] font-semibold">{off.tags}</span>
                <span className="text-[9px] text-[var(--color-ivory-dim)] font-mono">T&Cs Apply</span>
              </div>
              <h4 className="font-serif text-sm text-[var(--color-ivory)] leading-snug">{off.title}</h4>
              <p className="text-[11px] text-[var(--color-ivory-dim)] leading-normal font-medium">{off.description}</p>
            </div>
            
            <div className="flex justify-between items-center pt-4 border-t border-slate-800/80 mt-4">
              <span className="text-[9px] font-mono bg-[var(--color-obsidian)] text-[var(--color-gold)] border border-dashed border-[var(--color-gold-muted)] px-2 py-0.5 rounded-[var(--radius-inner)]">{off.promo_code}</span>
              <button onClick={() => onOfferClick(off)} className="text-[10px] text-[var(--color-gold)] font-bold hover:underline flex items-center gap-0.5 cursor-pointer bg-transparent border-none">
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
      className={`px-3 py-1 relative font-semibold text-xs transition-all cursor-pointer bg-transparent border-none ${
        isActive ? 'text-[var(--color-gold)] font-bold' : 'text-[var(--color-ivory-dim)] hover:text-[var(--color-ivory)]'
      }`}
    >
      {off_label(label)}
      {isActive && (
        <span className="absolute bottom-0 left-1 right-1 h-[2px] bg-[var(--color-gold)]" />
      )}
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
    <div onClick={onClick} className="explore-pill-card p-4 rounded-xl flex flex-col justify-between cursor-pointer transition-all relative">
      {badge && (
        <span className="absolute -top-2.5 right-2 text-[8px] bg-red-600 text-white font-black px-1.5 py-0.5 rounded-full border border-black shadow-[1px_1px_0px_#000000]">{badge}</span>
      )}
      <span className="font-extrabold text-xs">{title}</span>
      <span className="text-[9px] mt-1 font-medium">{sub}</span>
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
    <div className="fixed bottom-6 right-4 left-4 md:right-6 md:left-auto z-40 bg-[#0d1527] border border-slate-800 rounded-full p-1.5 shadow-2xl flex items-center w-[calc(100%-32px)] md:w-80 max-w-sm">
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
  visa?: any;
  weather?: any;
  budget?: any;
  map_data?: any;
  telemetry?: any;
}

function InteractiveRouteMap({ locations }: { locations: any }) {
  const [activePin, setActivePin] = useState<number | null>(null);

  const locs = Array.isArray(locations) ? locations : ["Origin Airport", "Taj Resort", "Baga Beach"];
  const pinCoords = [
    { x: 50, y: 120, label: locs[0] || "Airport" },
    { x: 180, y: 50, label: locs[1] || "Hotel stay" },
    { x: 300, y: 110, label: locs[2] || "Attraction" }
  ];

  return (
    <div className="relative font-sans select-none">
      <svg viewBox="0 0 360 170" className="w-full h-auto bg-slate-950/80 rounded-xl border border-slate-850 p-2 overflow-visible">
        {/* Animated connection path */}
        <path
          d="M 50 120 Q 115 50 180 50 T 300 110"
          fill="none"
          stroke="#3b82f6"
          strokeWidth="3"
          strokeDasharray="6,6"
          className="animate-[dash_10s_linear_infinite]"
        />
        
        {/* Render coordinates pins */}
        {pinCoords.map((pin, idx) => {
          const isActive = activePin === idx;
          return (
            <g 
              key={idx} 
              className="cursor-pointer"
              onMouseEnter={() => setActivePin(idx)}
              onMouseLeave={() => setActivePin(null)}
              onClick={() => setActivePin(isActive ? null : idx)}
            >
              {/* Pulsing glow under active pin */}
              {(isActive || idx === 1) && (
                <circle cx={pin.x} cy={pin.y} r="10" fill="#3b82f6" opacity="0.3" className="animate-ping" />
              )}
              {/* Core Pin */}
              <circle cx={pin.x} cy={pin.y} r="6" fill={idx === 0 ? "#10b981" : idx === 1 ? "#ef4444" : "#f59e0b"} stroke="#fff" strokeWidth="1.5" />
              {/* Text label */}
              <text 
                x={pin.x} 
                y={pin.y + 18} 
                fill="#cbd5e1" 
                fontSize="9" 
                fontWeight="bold" 
                textAnchor="middle"
                className="drop-shadow"
              >
                {pin.label}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Tooltip Overlay */}
      {activePin !== null && (
        <div className="absolute top-2 left-2 bg-slate-900 border border-slate-800 text-[10px] text-slate-200 px-2 py-1 rounded shadow-lg pointer-events-none">
          📍 <span className="font-extrabold text-blue-400">{pinCoords[activePin].label}</span>
          <div className="text-[8px] text-slate-400 mt-0.5">Custom TRV-OS Coordinates Pin</div>
        </div>
      )}

      <button 
        onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locs[1] || 'Goa')}`, '_blank')}
        className="mt-2 w-full py-1.5 bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/20 text-blue-400 text-[10px] font-bold rounded-lg transition-all"
      >
        🗺️ View Full Interactive Route on Google Maps
      </button>
    </div>
  );
}

// ============================================================
// DEVELOPER DEBUG PANEL (Ctrl+Shift+D to toggle)
// ============================================================
function DebugPanel({ sessionId, token, onClose }: { sessionId: string, token: string | null, onClose: () => void }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !sessionId) { setLoading(false); return; }
    fetch(`/api/agents/debug/${sessionId}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(String(e)); setLoading(false); });
  }, [sessionId, token]);

  const tel = data?.telemetry || {};
  const agentRoute: any[] = tel.agent_route || tel.db_agent_route || [];
  const totalLatency = tel.total_latency_ms || agentRoute.reduce((s: number, a: any) => s + (a.latency_ms || 0), 0);
  const totalTokens = tel.total_tokens_used || tel.total_tokens || 0;
  const memoryHits = tel.memory_hits ?? tel.total_preferences_loaded ?? '—';
  const prefSummary = tel.pref_summary || '';
  const prefCategories = tel.preference_categories || {};
  const agentQueue = tel.agent_queue || [];
  const reconstructedQuery = tel.reconstructed_query || '';
  const ragUsed = tel.rag_used;
  const collectedKeys = tel.collected_keys || [];

  return (
    <div className="fixed bottom-4 right-4 z-[9999] w-[480px] max-h-[80vh] overflow-y-auto bg-black/95 border border-emerald-500/40 rounded-2xl shadow-2xl font-mono text-xs">
      <div className="flex items-center justify-between px-4 py-3 border-b border-emerald-900/50 bg-emerald-950/40">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
          <span className="text-emerald-300 font-black tracking-widest text-[10px] uppercase">Dev Debug Panel</span>
          <span className="text-slate-500 text-[9px]">Ctrl+Shift+D</span>
        </div>
        <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors cursor-pointer bg-transparent border-none text-lg leading-none">×</button>
      </div>

      {loading && <div className="p-4 text-slate-400 animate-pulse">Loading telemetry...</div>}
      {error && <div className="p-4 text-red-400">Error: {error}</div>}

      {!loading && !error && (
        <div className="p-4 space-y-4">
          {/* Session Info */}
          <div className="space-y-1">
            <div className="text-[9px] text-slate-500 uppercase tracking-widest font-bold">Session</div>
            <div className="text-slate-300">{sessionId}</div>
          </div>

          {/* Memory Stats */}
          <div className="bg-blue-950/30 border border-blue-900/30 rounded-xl p-3 space-y-2">
            <div className="text-[9px] text-blue-400 uppercase tracking-widest font-black">💾 Memory Hits</div>
            <div className="flex items-center gap-3">
              <span className="text-blue-200 font-bold text-lg">{memoryHits}</span>
              <span className="text-slate-500">total preferences loaded</span>
            </div>
            {Object.entries(prefCategories).filter(([,v]) => (v as number) > 0).map(([cat, count]) => (
              <div key={cat} className="flex justify-between text-[10px]">
                <span className="text-slate-400 capitalize">{cat}</span>
                <span className="text-blue-300 font-bold">{count as number} pref(s)</span>
              </div>
            ))}
            {prefSummary && (
              <div className="text-[9px] text-slate-500 border-t border-slate-800 pt-2 mt-1 leading-relaxed">{prefSummary}</div>
            )}
          </div>

          {/* Agent Route */}
          <div className="space-y-2">
            <div className="text-[9px] text-emerald-400 uppercase tracking-widest font-black">🤖 Agent Route</div>
            {agentQueue.length > 0 && (
              <div className="text-[9px] text-slate-500 mb-1">Scheduled: {agentQueue.join(' → ')}</div>
            )}
            {agentRoute.length === 0 && <div className="text-slate-600 text-[10px]">No route data yet — send a message</div>}
            {agentRoute.map((step: any, i: number) => (
              <div key={i} className={`flex items-center justify-between bg-slate-900/60 rounded-lg px-3 py-1.5 border ${step.status === 'success' ? 'border-emerald-900/30' : 'border-red-900/30'}`}>
                <div className="flex items-center gap-2">
                  <span className={step.status === 'success' ? 'text-emerald-400' : 'text-red-400'}>{step.status === 'success' ? '✓' : '✗'}</span>
                  <span className="text-slate-200 font-bold">{step.agent}</span>
                </div>
                <div className="flex items-center gap-2 text-[9px] text-slate-500">
                  <span className="text-yellow-400">{step.latency_ms}ms</span>
                  {step.tokens_used > 0 && <span className="text-purple-400">{step.tokens_used}tok</span>}
                  {step.provider && step.provider !== 'router' && <span className="text-slate-600">{step.provider}</span>}
                </div>
              </div>
            ))}
          </div>

          {/* Latency + Tokens */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-slate-900/60 rounded-xl p-3 text-center border border-slate-800">
              <div className="text-yellow-400 font-black text-base">{totalLatency > 0 ? `${(totalLatency/1000).toFixed(1)}s` : '—'}</div>
              <div className="text-[9px] text-slate-500 mt-1">Total Latency</div>
            </div>
            <div className="bg-slate-900/60 rounded-xl p-3 text-center border border-slate-800">
              <div className="text-purple-400 font-black text-base">{totalTokens > 0 ? totalTokens : '—'}</div>
              <div className="text-[9px] text-slate-500 mt-1">Tokens Used</div>
            </div>
            <div className="bg-slate-900/60 rounded-xl p-3 text-center border border-slate-800">
              <div className={`font-black text-base ${ragUsed ? 'text-emerald-400' : 'text-slate-600'}`}>{ragUsed !== undefined ? (ragUsed ? 'YES' : 'NO') : '—'}</div>
              <div className="text-[9px] text-slate-500 mt-1">RAG Used</div>
            </div>
          </div>

          {/* Tool Calls / Collected Data */}
          {collectedKeys.length > 0 && (
            <div className="space-y-1">
              <div className="text-[9px] text-orange-400 uppercase tracking-widest font-black">🔧 Data Collected</div>
              <div className="flex flex-wrap gap-1">
                {collectedKeys.map((k: string) => (
                  <span key={k} className="text-[9px] bg-orange-950/30 text-orange-300 border border-orange-900/30 px-2 py-0.5 rounded-full">{k}</span>
                ))}
              </div>
            </div>
          )}

          {/* Reconstructed Query */}
          {reconstructedQuery && (
            <div className="space-y-1">
              <div className="text-[9px] text-slate-500 uppercase tracking-widest font-black">🧠 Reconstructed Query</div>
              <div className="bg-slate-900/60 rounded-lg p-2 text-[10px] text-slate-300 leading-relaxed border border-slate-800 italic">"{reconstructedQuery}"</div>
            </div>
          )}

          <div className="text-[8px] text-slate-700 text-center pt-2 border-t border-slate-900">Data from GET /agents/debug/{sessionId} • Refreshes on open</div>
        </div>
      )}
    </div>
  );
}

function ReasoningPanel({ status, isDone, telemetry }: { status?: string, isDone: boolean, telemetry?: any }) {
  const steps = [
    { key: 'understand', label: '🧠 Classifying intent & resolving context...', match: ['analyzing', 'classifying', 'understand', 'thinking', 'supervisor'] },
    { key: 'memory', label: '💾 Loading memory & preferences...', match: ['memory', 'preference', 'profile', 'loading'] },
    { key: 'flights', label: '✈️ Searching live flights...', match: ['flight', 'searching flights', 'aviation'] },
    { key: 'hotels', label: '🏨 Comparing hotel accommodations...', match: ['hotel', 'accommodation', 'stay', 'resort'] },
    { key: 'weather', label: '🌦️ Fetching climate forecast...', match: ['weather', 'climate', 'forecast'] },
    { key: 'visa', label: '📋 Checking visa requirements...', match: ['visa', 'entry', 'passport'] },
    { key: 'budget', label: '💰 Calculating budget allocation...', match: ['budget', 'currency', 'forex', 'cost', 'allocation'] },
    { key: 'insurance', label: '🛡️ Fetching insurance options...', match: ['insurance', 'cover', 'protection'] },
    { key: 'itinerary', label: '📅 Designing day-by-day itinerary...', match: ['itinerary', 'slot', 'plan', 'schedule', 'day'] },
    { key: 'compile', label: '✨ Compiling travel proposal...', match: ['collating', 'compiling', 'formatting', 'proposal'] },
  ];

  let activeIndex = -1;
  if (status) {
    const sLower = status.toLowerCase();
    activeIndex = steps.findIndex(step => step.match.some(m => sLower.includes(m)));
    if (activeIndex === -1) activeIndex = 0;
  }

  const visibleSteps = isDone ? steps : steps.slice(0, Math.max(activeIndex + 3, 4));

  const totalLatency = telemetry?.total_latency_ms || telemetry?.db_agent_route?.reduce((s: number, a: any) => s + (a.latency_ms || 0), 0) || 0;
  const apiRoute = telemetry?.agent_route || telemetry?.db_agent_route || [];
  const memoryHits = telemetry?.memory_hits ?? telemetry?.total_preferences_loaded ?? 0;

  return (
    <div className="bg-gradient-to-br from-slate-900/80 to-blue-950/30 backdrop-blur border border-blue-900/30 p-4 rounded-2xl mb-4 w-full">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
        <span className="text-[10px] text-blue-300 font-black tracking-widest uppercase">AI Autonomous Reasoning Engine</span>
      </div>
      <div className="space-y-1.5">
        {visibleSteps.map((step, idx) => {
          const completed = isDone || (activeIndex > idx);
          const current = !isDone && (activeIndex === idx);
          return (
            <div key={step.key} className={`flex items-center gap-2.5 py-0.5 transition-all ${
              current ? 'opacity-100' : completed ? 'opacity-70' : 'opacity-30'
            }`}>
              <span className={`text-sm flex-shrink-0 ${completed ? 'text-emerald-400' : current ? 'text-blue-400 animate-pulse' : 'text-slate-600'}`}>
                {completed ? '✓' : current ? '◉' : '○'}
              </span>
              <span className={`text-[11px] font-mono ${
                completed ? 'text-slate-300 line-through' : current ? 'text-blue-200 font-bold' : 'text-slate-600'
               }`}>
                {step.label}
              </span>
              {current && (
                <span className="ml-auto text-[9px] text-blue-400 font-bold bg-blue-950/60 px-1.5 py-0.5 rounded-full border border-blue-800/30 animate-pulse">ACTIVE</span>
              )}
            </div>
          );
        })}
      </div>
      {status && !isDone && (
        <div className="mt-3 pt-2 border-t border-slate-800/60 text-[10px] text-slate-400 flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-ping" />
          {status}
        </div>
      )}
      {isDone && (
        <div className="mt-3 pt-2 border-t border-slate-800/60 text-[10px] text-emerald-400 flex flex-wrap justify-between items-center gap-1.5 font-bold">
          <span>✓ Proposal compiled</span>
          {totalLatency > 0 && (
            <span className="text-[9px] font-mono text-slate-500 bg-slate-950/40 px-2 py-0.5 rounded-full border border-slate-900">
              ⚡ {totalLatency}ms latency | {apiRoute.length} agent steps | 💾 {memoryHits} preferences
            </span>
          )}
        </div>
      )}
    </div>
  );
}

const renderRichAIResponse = (
  text: string,
  compact: boolean = false,
  onFollowUpClick?: (text: string) => void,
  bookedItems?: Record<string, boolean>,
  handleBook?: (id: string, name: string, price: number) => void,
  handleCancel?: (id: string, name: string, price: number) => void
) => {
  if (!text) return null;

  const sectionKeywords = [
    "destination overview",
    "flights",
    "hotels",
    "weather",
    "budget",
    "restaurants",
    "activities",
    "packing list",
    "safety tips",
    "summary",
    "ai recommendation rationale"
  ];

  const getEmojiAndTitle = (lineStr: string) => {
    const cleaned = lineStr.replace(/^(###\s*|\*+\s*)/, '').trim();
    const emojiMatch = cleaned.match(/^([^\w\s\d,.:;|'"()]+)/);
    const emoji = emojiMatch ? emojiMatch[1].trim() : "📝";
    const title = cleaned.replace(/^([^\w\s\d,.:;|'"()]+)/, '').trim();
    return { emoji, title };
  };

  const isSectionHeader = (lineStr: string) => {
    const cleaned = lineStr.replace(/^(###\s*|\*+\s*)/, '').trim().toLowerCase();
    return sectionKeywords.some(kw => cleaned.includes(kw));
  };

  const lines = text.split("\n");
  const sections: Array<{ title: string; emoji: string; content: string[] }> = [];
  let currentSection: { title: string; emoji: string; content: string[] } | null = null;
  let genericIntro: string[] = [];

  for (let line of lines) {
    if (isSectionHeader(line)) {
      const { emoji, title } = getEmojiAndTitle(line);
      currentSection = { title, emoji, content: [] };
      sections.push(currentSection);
    } else {
      if (currentSection) {
        currentSection.content.push(line);
      } else {
        genericIntro.push(line);
      }
    }
  }

  const parseInlineMarkdown = (textStr: string): React.ReactNode => {
    const regex = /(\*\*.*?\*\*|\*.*?\*|\[.*?\]\(.*?\)|`.*?`)/g;
    const tokens = textStr.split(regex);

    return tokens.map((token, idx) => {
      if (token.startsWith("**") && token.endsWith("**")) {
        return <strong key={idx} className="font-extrabold text-white">{token.slice(2, -2)}</strong>;
      }
      if (token.startsWith("*") && token.endsWith("*")) {
        return <em key={idx} className="italic">{token.slice(1, -1)}</em>;
      }
      if (token.startsWith("`") && token.endsWith("`")) {
        return <code key={idx} className="bg-slate-950/40 text-yellow-400 px-1 py-0.5 rounded font-mono text-xs border border-slate-800">{token.slice(1, -1)}</code>;
      }
      if (token.startsWith("[") && token.includes("](")) {
        const linkMatch = token.match(/\[(.*?)\]\((.*?)\)/);
        if (linkMatch) {
          return <a key={idx} href={linkMatch[2]} target="_blank" rel="noopener noreferrer" className="text-blue-400 underline hover:text-blue-300 font-bold">{linkMatch[1]}</a>;
        }
      }
      return token;
    });
  };

  const renderMarkdownBlock = (blockLines: string[], blockKey: string) => {
    const elements: React.ReactNode[] = [];
    let listItems: React.ReactNode[] = [];
    let listType: 'ul' | 'ol' | null = null;
    let tableRows: string[][] = [];
    let inCodeBlock = false;
    let codeContent: string[] = [];

    const AIRLINE_MAP: Record<string, string> = {
      "6E": "IndiGo",
      "AI": "Air India",
      "UK": "Vistara",
      "QP": "Akasa Air",
      "SG": "SpiceJet",
      "G8": "Go First",
      "AA": "American Airlines",
      "DL": "Delta Air Lines",
      "UA": "United Airlines",
      "LH": "Lufthansa",
      "EK": "Emirates",
      "EY": "Etihad Airways",
      "QR": "Qatar Airways"
    };

    const parseFlightLine = (lineStr: string) => {
      const trimmed = lineStr.trim().replace(/^(\*\s+|-\s+|•\s+)/, '');
      if (!trimmed.toLowerCase().startsWith("flight:")) return null;
      // Format: Flight: Airline FlightNumber | DepCode DepTime - ArrCode ArrTime | Duration | Price
      // Example: Flight: Vistara UK-951 | DEL 08:00 - GOI 10:30 | 2h 30m | ₹7,500
      const content = trimmed.substring(7).trim();
      const parts = content.split("|").map(p => p.trim());
      if (parts.length < 3) return null;

      const airlineParts = parts[0].split(/\s+/);
      const airline = airlineParts[0] || "6E";
      const flightNumber = airlineParts[1] || `${airline}-101`;

      const routeParts = parts[1].split("-").map(r => r.trim());
      const depParts = routeParts[0]?.split(/\s+/) || ["DEL", "08:00"];
      const arrParts = routeParts[1]?.split(/\s+/) || ["GOI", "10:30"];

      const duration = parts[2] || "2h 30m";
      const priceStr = parts[3]?.replace(/[^\d]/g, '') || "5000";
      const price = parseInt(priceStr, 10);

      return {
        airline,
        flight_number: flightNumber,
        dep: `${depParts[0]} ${depParts[1]}`,
        arr: `${arrParts[0]} ${arrParts[1]}`,
        duration,
        price,
        cabin_class: "Economy",
        layovers: []
      };
    };

    const parseHotelLine = (lineStr: string) => {
      const trimmed = lineStr.trim().replace(/^(\*\s+|-\s+|•\s+)/, '');
      if (!trimmed.toLowerCase().startsWith("hotel:")) return null;
      // Format: Hotel: HotelName | Rating | Price
      // Example: Hotel: Taj Exotica Resort | 4.8 ★ | ₹15,000/night
      const content = trimmed.substring(6).trim();
      const parts = content.split("|").map(p => p.trim());
      if (parts.length < 3) return null;

      const name = parts[0];
      const rating = parts[1] || "4.5 ★";
      const priceStr = parts[2]?.replace(/[^\d]/g, '') || "8000";
      const price = parseInt(priceStr, 10);

      return {
        name,
        rating,
        price,
        amenities: ["Free Wifi", "Pool", "Spa"]
      };
    };

    const flushList = (key: string) => {
      if (listItems.length > 0 && listType) {
        const Comp = listType;
        elements.push(
          <Comp key={key} className={compact ? "my-1 pl-4 text-xs list-disc" : "my-2 pl-6 list-disc"}>
            {listItems.map((item, itemIdx) => (
              <li key={itemIdx} className="mb-1 leading-relaxed">
                {item}
              </li>
            ))}
          </Comp>
        );
        listItems = [];
        listType = null;
      }
    };

    const flushTable = (key: string) => {
      if (tableRows.length > 0) {
        const hasSeparator = tableRows.length > 1 && tableRows[1].every(cell => cell.trim().startsWith('-') || cell.trim() === '');
        const headerRow = hasSeparator ? tableRows[0] : null;
        const dataRows = hasSeparator ? tableRows.slice(2) : tableRows;

        elements.push(
          <div key={key} className="overflow-x-auto my-3 border border-slate-800 rounded-lg">
            <table className="min-w-full text-xs">
              {headerRow && (
                <thead>
                  <tr>
                    {headerRow.map((cell, idx) => (
                      <th key={idx} className="px-3 py-2 bg-slate-900 text-white font-extrabold text-left border-b border-slate-800 uppercase">
                        {parseInlineMarkdown(cell)}
                      </th>
                    ))}
                  </tr>
                </thead>
              )}
              <tbody>
                {dataRows.map((row, rowIdx) => (
                  <tr key={rowIdx} className={rowIdx % 2 === 0 ? "bg-slate-950/20" : ""}>
                    {row.map((cell, idx) => (
                      <td key={idx} className="px-3 py-2 border-t border-slate-800 text-slate-300">
                        {parseInlineMarkdown(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        tableRows = [];
      }
    };

    let elCounter = 0;
    for (let i = 0; i < blockLines.length; i++) {
      const line = blockLines[i];
      const trimmed = line.trim();

      if (trimmed.startsWith("```")) {
        if (inCodeBlock) {
          const codeText = codeContent.join("\n");
          const blockId = `code-block-${i}`;
          elements.push(
            <div key={blockId} className="relative group my-4">
              <button
                onClick={(e) => {
                  navigator.clipboard.writeText(codeText);
                  const btn = e.currentTarget;
                  btn.innerText = "Copied!";
                  setTimeout(() => { btn.innerText = "Copy"; }, 2000);
                }}
                className="absolute right-3 top-3 bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-[10px] font-bold px-2 py-1 rounded border border-slate-700 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer z-10"
              >
                Copy
              </button>
              <pre className="bg-slate-950/40 p-4 rounded-xl border border-slate-800 overflow-x-auto font-mono text-xs text-yellow-400">
                <code>{codeText}</code>
              </pre>
            </div>
          );
          codeContent = [];
          inCodeBlock = false;
        } else {
          inCodeBlock = true;
        }
        continue;
      }

      if (inCodeBlock) {
        codeContent.push(line);
        continue;
      }

      // Check inline flight recommendation card
      const parsedFlight = parseFlightLine(trimmed);
      if (parsedFlight) {
        flushList(`list-${elCounter++}`);
        flushTable(`table-${elCounter++}`);
        const fl = parsedFlight;
        const airlineCode = fl.airline.toUpperCase();
        const airlineName = AIRLINE_MAP[airlineCode] || airlineCode;
        const flightNumber = fl.flight_number;
        const depInfo = { code: fl.dep.split(/\s+/)[0], time: fl.dep.split(/\s+/)[1] };
        const arrInfo = { code: fl.arr.split(/\s+/)[0], time: fl.arr.split(/\s+/)[1] };
        const isBooked = bookedItems ? bookedItems[flightNumber] : false;

        elements.push(
          <div key={`inline-flight-${i}`} className="dark-card-override bg-[#0f192e] p-4 rounded-xl flex flex-col md:flex-row gap-4 justify-between items-start md:items-center border border-slate-800 hover:border-slate-700 transition-all relative my-3">
            <div className="flex-1 w-full space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-extrabold text-xs text-slate-100">{airlineName}</span>
                <span className="text-[9px] font-mono bg-blue-950/80 text-blue-300 px-1.5 py-0.5 rounded border border-blue-900/40">{flightNumber}</span>
                <span className="dark-card-badge text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded">ECONOMY</span>
                {isBooked && (
                  <span className="text-[9px] bg-emerald-950/40 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded flex items-center gap-0.5">Booked</span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-slate-200">
                <div className="flex items-baseline gap-1">
                  <span className="font-black text-sm text-white">{depInfo.time}</span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">{depInfo.code}</span>
                </div>
                <div className="flex flex-col items-center min-w-[50px] relative px-1">
                  <span className="text-[8px] text-slate-400 font-semibold">{fl.duration}</span>
                  <div className="w-full h-0.5 relative flex items-center justify-center bg-slate-600">
                    <div className="w-1 h-1 rounded-full bg-slate-400"></div>
                  </div>
                  <span className="text-[8px] text-slate-400 font-medium mt-0.5">Non-stop</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="font-black text-sm text-white">{arrInfo.time}</span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">{arrInfo.code}</span>
                </div>
              </div>
            </div>
            <div className="text-right w-full md:w-auto flex md:flex-col justify-between md:justify-center items-center md:items-end gap-2 border-t md:border-t-0 border-slate-800/60 pt-2 md:pt-0">
              <div className="font-black text-emerald-400 text-sm md:text-base">₹{fl.price.toLocaleString()}</div>
              {isBooked ? (
                <button 
                  onClick={() => handleCancel && handleCancel(flightNumber, airlineName, fl.price)}
                  className="bg-red-950/40 border border-red-500/30 hover:bg-red-900/30 text-red-400 text-[10px] font-bold px-2.5 py-1 rounded transition-all cursor-pointer"
                >
                  Cancel Booking
                </button>
              ) : (
                <button 
                  onClick={() => handleBook && handleBook(flightNumber, airlineName, fl.price)}
                  className="bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all cursor-pointer"
                >
                  Book Now
                </button>
              )}
            </div>
          </div>
        );
        continue;
      }

      // Check inline hotel recommendation card
      const parsedHotel = parseHotelLine(trimmed);
      if (parsedHotel) {
        flushList(`list-${elCounter++}`);
        flushTable(`table-${elCounter++}`);
        const ht = parsedHotel;
        const isBooked = bookedItems ? bookedItems[ht.name] : false;

        elements.push(
          <div key={`inline-hotel-${i}`} className="bg-[#121c33] p-4 rounded-xl flex justify-between items-center border border-slate-800 hover:border-slate-700 transition-all my-3">
            <div className="w-2/3">
              <div className="font-bold text-xs text-slate-200 flex items-center gap-1.5">
                {ht.name}
                {isBooked && (
                  <span className="text-[9px] bg-emerald-950/40 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded flex items-center gap-0.5">Reserved</span>
                )}
              </div>
              <div className="text-[10px] text-yellow-400 font-semibold mt-0.5">{ht.rating} ★ Rating</div>
              <div className="flex flex-wrap gap-1 mt-2">
                {ht.amenities.map((am, idx) => (
                  <span key={idx} className="text-[9px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded">{am}</span>
                ))}
              </div>
            </div>
            <div className="text-right">
              <div className="font-extrabold text-sm text-emerald-400">₹{ht.price.toLocaleString()}/N</div>
              {isBooked ? (
                <button 
                  onClick={() => handleCancel && handleCancel(ht.name, ht.name, ht.price)}
                  className="mt-1 bg-red-950/40 border border-red-500/30 hover:bg-red-900/30 text-red-400 text-[10px] font-bold px-2.5 py-1 rounded cursor-pointer"
                >
                  Cancel Stay
                </button>
              ) : (
                <button 
                  onClick={() => handleBook && handleBook(ht.name, ht.name, ht.price)}
                  className="mt-1 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold px-2.5 py-1 rounded cursor-pointer"
                >
                  Reserve Room
                </button>
              )}
            </div>
          </div>
        );
        continue;
      }

      if (trimmed === '---') {
        flushList(`list-${elCounter++}`);
        flushTable(`table-${elCounter++}`);
        elements.push(<hr key={`hr-${i}`} className="border-t border-slate-800 my-4" />);
        continue;
      }

      if (trimmed.startsWith(">")) {
        flushList(`list-${elCounter++}`);
        flushTable(`table-${elCounter++}`);
        const quoteText = line.substring(line.indexOf(">") + 1).trim();
        elements.push(
          <blockquote key={`quote-${i}`} className="border-l-4 border-blue-500 bg-slate-900/30 px-4 py-2 my-2 italic text-slate-300 rounded-r-lg">
            {parseInlineMarkdown(quoteText)}
          </blockquote>
        );
        continue;
      }

      if (trimmed.startsWith("#")) {
        flushList(`list-${elCounter++}`);
        flushTable(`table-${elCounter++}`);
        const hashMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
        if (hashMatch) {
          const level = hashMatch[1].length;
          const headingText = hashMatch[2];
          const Tag = `h${Math.min(level + 1, 6)}` as any;
          elements.push(
            <Tag key={`h-${i}`} className="font-extrabold text-white mt-4 mb-2">
              {parseInlineMarkdown(headingText)}
            </Tag>
          );
          continue;
        }
      }

      const isUnordered = trimmed.startsWith("* ") || trimmed.startsWith("- ") || trimmed.startsWith("• ");
      const isOrdered = /^\d+\.\s+/.test(trimmed);

      if (isUnordered || isOrdered) {
        flushTable(`table-${elCounter++}`);
        const listText = trimmed.replace(/^(\*\s+|-\s+|•\s+|\d+\.\s+)/, '').trim();
        const currentType = isUnordered ? 'ul' : 'ol';

        if (listType && listType !== currentType) {
          flushList(`list-${elCounter++}`);
        }

        listType = currentType;
        listItems.push(parseInlineMarkdown(listText));
        continue;
      }

      if (trimmed.startsWith("|")) {
        flushList(`list-${elCounter++}`);
        const cells = trimmed.split("|").slice(1, -1).map(c => c.trim());
        tableRows.push(cells);
        continue;
      }

      if (trimmed === "") {
        flushList(`list-${elCounter++}`);
        flushTable(`table-${elCounter++}`);
        continue;
      }

      flushList(`list-${elCounter++}`);
      flushTable(`table-${elCounter++}`);
      elements.push(
        <p key={`p-${i}`} className={compact ? "mb-1 text-xs leading-relaxed" : "mb-3 leading-relaxed"}>
          {parseInlineMarkdown(trimmed)}
        </p>
      );
    }

    flushList(`list-${elCounter++}`);
    flushTable(`table-${elCounter++}`);

    return elements;
  };

  const renderSection = (sec: { title: string; emoji: string; content: string[] }, idx: number) => {
    const titleLower = sec.title.toLowerCase();

    // 1. Weather Section
    if (titleLower.includes("weather")) {
      const weatherCards: React.ReactNode[] = [];
      sec.content.forEach((line, lineIdx) => {
        const trimmed = line.trim().replace(/^(\*\s+|-\s+|•\s+|\d+\.\s+)/, '');
        if (!trimmed) return;
        const parts = trimmed.split(/[:|-]/);
        const place = parts[0]?.trim() || "Destination";
        const weatherDetail = parts.slice(1).join(" ").trim() || "Sunny, 28°C";
        
        let icon = "☀️";
        if (weatherDetail.toLowerCase().includes("rain")) icon = "🌧️";
        else if (weatherDetail.toLowerCase().includes("cloud")) icon = "⛅";
        else if (weatherDetail.toLowerCase().includes("snow")) icon = "❄️";
        else if (weatherDetail.toLowerCase().includes("wind")) icon = "💨";
        else if (weatherDetail.toLowerCase().includes("storm")) icon = "⛈️";

        weatherCards.push(
          <div key={lineIdx} className="weather-day-card dark-card-override">
            <div className="text-3xl mb-2">{icon}</div>
            <div className="font-extrabold text-sm text-white truncate">{place}</div>
            <div className="text-xs text-slate-300 mt-1">{weatherDetail}</div>
          </div>
        );
      });

      return (
        <div key={idx} className="ai-section-card dark-card-override">
          <div className="ai-section-header">
            <span className="text-lg">{sec.emoji}</span>
            <h4 className="ai-section-title">{sec.title}</h4>
          </div>
          <div className="weather-card-container">
            {weatherCards}
          </div>
        </div>
      );
    }

    // 2. Budget Section
    if (titleLower.includes("budget")) {
      const budgetBars: React.ReactNode[] = [];
      sec.content.forEach((line, lineIdx) => {
        const trimmed = line.trim().replace(/^(\*\s+|-\s+|•\s+|\d+\.\s+)/, '');
        if (!trimmed) return;
        const match = trimmed.match(/^(.*?)(?:[:|-]\s*)?₹?([\d,]+)(.*)$/);
        if (match) {
          const category = match[1].trim();
          const amountStr = match[2].replace(/,/g, '');
          const amount = parseInt(amountStr, 10);
          const extra = match[3]?.trim();
          
          let pct = 40;
          const catLower = category.toLowerCase();
          if (catLower.includes("flight")) pct = 50;
          else if (catLower.includes("hotel") || catLower.includes("stay") || catLower.includes("accommodation")) pct = 35;
          else if (catLower.includes("activity") || catLower.includes("sight") || catLower.includes("tour")) pct = 15;
          else if (catLower.includes("food") || catLower.includes("din") || catLower.includes("restau")) pct = 10;
          else if (catLower.includes("total")) pct = 100;

          budgetBars.push(
            <div key={lineIdx} className="budget-progress-container">
              <div className="budget-bar-label">
                <span>{category} {extra}</span>
                <span>₹{amount.toLocaleString()}</span>
              </div>
              <div className="budget-bar-track">
                <div className="budget-bar-fill" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        } else {
          budgetBars.push(<p key={lineIdx} className="text-xs text-slate-400 mb-1">{parseInlineMarkdown(trimmed)}</p>);
        }
      });

      return (
        <div key={idx} className="ai-section-card dark-card-override">
          <div className="ai-section-header">
            <span className="text-lg">{sec.emoji}</span>
            <h4 className="ai-section-title">{sec.title}</h4>
          </div>
          <div className="space-y-3">
            {budgetBars}
          </div>
        </div>
      );
    }

    // 3. Packing List Section
    if (titleLower.includes("packing")) {
      const checklistItems: React.ReactNode[] = [];
      sec.content.forEach((line, lineIdx) => {
        const trimmed = line.trim().replace(/^(\*\s+|-\s+|•\s+|\d+\.\s+)/, '');
        if (!trimmed) return;
        checklistItems.push(
          <div key={lineIdx} className="packing-checklist-item">
            <span className="packing-checklist-tick">✓</span>
            <span className="text-sm text-slate-300">{parseInlineMarkdown(trimmed)}</span>
          </div>
        );
      });

      return (
        <div key={idx} className="ai-section-card dark-card-override">
          <div className="ai-section-header">
            <span className="text-lg">{sec.emoji}</span>
            <h4 className="ai-section-title">{sec.title}</h4>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 my-2">
            {checklistItems}
          </div>
        </div>
      );
    }

    // 4. Itinerary Section
    if (titleLower.includes("itinerary")) {
      const dayBlocks: Array<{ title: string; content: string[] }> = [];
      let currentDay: { title: string; content: string[] } | null = null;
      const itinIntro: string[] = [];

      sec.content.forEach((line) => {
        const trimmed = line.trim();
        if (trimmed.toLowerCase().startsWith("day ") || trimmed.toLowerCase().startsWith("### day ")) {
          const title = trimmed.replace(/^(###\s*)/, '').trim();
          currentDay = { title, content: [] };
          dayBlocks.push(currentDay);
        } else {
          if (currentDay) {
            currentDay.content.push(line);
          } else {
            if (trimmed !== "") {
              itinIntro.push(line);
            }
          }
        }
      });

      return (
        <div key={idx} className="ai-section-card dark-card-override">
          <div className="ai-section-header">
            <span className="text-lg">{sec.emoji}</span>
            <h4 className="ai-section-title">{sec.title}</h4>
          </div>
          {itinIntro.length > 0 && (
            <div className="mb-4">
              {renderMarkdownBlock(itinIntro, `itin-intro-${idx}`)}
            </div>
          )}
          <div className="space-y-2 mt-2">
            {dayBlocks.map((db, dbIdx) => (
              <div key={dbIdx} className="itinerary-timeline-day dark-card-override">
                <div className="font-extrabold text-blue-400 text-base mb-2">{db.title}</div>
                <div className="space-y-1 text-sm text-slate-300">
                  {renderMarkdownBlock(db.content, `itin-day-${dbIdx}`)}
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    // Default Section Card
    return (
      <div key={idx} className="ai-section-card dark-card-override">
        <div className="ai-section-header">
          <span className="text-lg">{sec.emoji}</span>
          <h4 className="ai-section-title">{sec.title}</h4>
        </div>
        <div className="ai-section-body text-slate-300 text-sm whitespace-pre-wrap leading-relaxed">
          {renderMarkdownBlock(sec.content, `sec-${idx}`)}
        </div>
      </div>
    );
  };

  const renderFollowUpChips = () => {
    if (compact || !onFollowUpClick) return null;
    
    const followUps = [
      { label: "Find cheaper hotels", text: "Find cheaper hotels" },
      { label: "Business class", text: "Show business class options" },
      { label: "Add sightseeing", text: "Add sightseeing options to my plan" },
      { label: "Add restaurants", text: "Add top-rated restaurants to my plan" },
      { label: "Show visa requirements", text: "What are the visa requirements?" }
    ];

    return (
      <div className="chat-chips-container">
        {followUps.map((chip, idx) => (
          <button
            key={idx}
            onClick={() => onFollowUpClick(chip.text)}
            className="chat-followup-chip cursor-pointer"
          >
            ➜ {chip.label}
          </button>
        ))}
      </div>
    );
  };

  if (sections.length > 0) {
    return (
      <div className="space-y-4">
        {genericIntro.length > 0 && (
          <div className="mb-4">
            {renderMarkdownBlock(genericIntro, "intro")}
          </div>
        )}
        {sections.map((sec, idx) => renderSection(sec, idx))}
        {renderFollowUpChips()}
      </div>
    );
  }

  return (
    <>
      {renderMarkdownBlock(lines, "all")}
      {renderFollowUpChips()}
    </>
  );
};

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
  const [shouldSpeak, setShouldSpeak] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [bookedItems, setBookedItems] = useState<Record<string, boolean>>({});
  const [editingSlot, setEditingSlot] = useState<{ msgIdx: number, dayIdx: number, slotKey: 'morning' | 'afternoon' | 'evening' } | null>(null);
  const [editValue, setEditValue] = useState("");

  const handleEditSlot = (msgIdx: number, dayIdx: number, slotKey: 'morning' | 'afternoon' | 'evening', currentValue: string) => {
    setEditingSlot({ msgIdx, dayIdx, slotKey });
    setEditValue(currentValue);
  };

  const handleSaveSlot = () => {
    if (!editingSlot) return;
    const { msgIdx, dayIdx, slotKey } = editingSlot;
    setMessages(prev => {
      const copy = [...prev];
      const msg = copy[msgIdx];
      if (msg && msg.itinerary) {
        const day = { ...msg.itinerary[dayIdx] };
        if (day.slots) {
          day.slots = { ...day.slots, [slotKey]: editValue };
        } else {
          day[slotKey] = editValue;
        }
        msg.itinerary[dayIdx] = day;
      }
      return copy;
    });
    setEditingSlot(null);
  };

  const handleSwapSlots = (msgIdx: number, dayIdx: number, slotA: 'morning' | 'afternoon' | 'evening', slotB: 'morning' | 'afternoon' | 'evening') => {
    setMessages(prev => {
      const copy = [...prev];
      const msg = copy[msgIdx];
      if (msg && msg.itinerary) {
        const day = { ...msg.itinerary[dayIdx] };
        const valA = getSlotText(day, slotA);
        const valB = getSlotText(day, slotB);
        
        if (day.slots) {
          day.slots = { ...day.slots, [slotA]: valB, [slotB]: valA };
        } else {
          day[slotA] = valB;
          day[slotB] = valA;
        }
        msg.itinerary[dayIdx] = day;
      }
      return copy;
    });
  };

  const [sessionId, setSessionId] = useState(() => {
    const saved = localStorage.getItem('chat_session_id');
    if (saved) return saved;
    const newId = `session_${Math.random().toString(36).substring(2, 9)}`;
    localStorage.setItem('chat_session_id', newId);
    return newId;
  });

  // Developer Debug Panel
  const [showDebug, setShowDebug] = useState(false);
  const authToken = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token') || null;

  // AI Memory Panel States
  const [tripContext, setTripContext] = useState<any>({});
  const [budgetConstraints, setBudgetConstraints] = useState<any>({});
  const [userPreferences, setUserPreferences] = useState<any>({});
  const [showMemoryEdit, setShowMemoryEdit] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [lastTelemetry, setLastTelemetry] = useState<any>({});

  // Ctrl+Shift+D toggles debug panel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        setShowDebug(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const parseMessageBlocks = (fullText: string) => {
    if (!fullText || typeof fullText !== 'string') {
      return { content: "", flights: undefined, hotels: undefined, itinerary: undefined, visa: undefined, weather: undefined, budget: undefined, map_data: undefined };
    }
    let textWithoutBlocks = fullText;
    let flights: any[] | undefined = undefined;
    let hotels: any[] | undefined = undefined;
    let itinerary: any[] | undefined = undefined;
    let visa: any = undefined;
    let weather: any = undefined;
    let budget: any = undefined;
    let map_data: any = undefined;

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

    const visaMatch = fullText.match(/```visa-data([\s\S]*?)```/);
    if (visaMatch) {
      try {
        visa = JSON.parse(visaMatch[1].trim());
        textWithoutBlocks = textWithoutBlocks.replace(visaMatch[0], "");
      } catch (e) {
        console.error("Failed to parse visa JSON", e);
      }
    }

    const weatherMatch = fullText.match(/```weather-data([\s\S]*?)```/);
    if (weatherMatch) {
      try {
        weather = JSON.parse(weatherMatch[1].trim());
        textWithoutBlocks = textWithoutBlocks.replace(weatherMatch[0], "");
      } catch (e) {
        console.error("Failed to parse weather JSON", e);
      }
    }

    const budgetMatch = fullText.match(/```budget-data([\s\S]*?)```/);
    if (budgetMatch) {
      try {
        budget = JSON.parse(budgetMatch[1].trim());
        textWithoutBlocks = textWithoutBlocks.replace(budgetMatch[0], "");
      } catch (e) {
        console.error("Failed to parse budget JSON", e);
      }
    }

    const mapMatch = fullText.match(/```map-data([\s\S]*?)```/);
    if (mapMatch) {
      try {
        map_data = JSON.parse(mapMatch[1].trim());
        textWithoutBlocks = textWithoutBlocks.replace(mapMatch[0], "");
      } catch (e) {
        console.error("Failed to parse map JSON", e);
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
      itinerary,
      visa,
      weather,
      budget,
      map_data
    };
  };

  const loadMemory = () => {
    const headers: any = {};
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }
    // 1. Fetch trip context and telemetry
    fetch(`${API_URL}/agents/debug/${sessionId}`, { headers })
      .then(res => res.json())
      .then(data => {
        if (data) {
          setTripContext(data.trip_context || {});
          setBudgetConstraints(data.budget_constraints || {});
          setLastTelemetry(data.telemetry || {});
        }
      })
      .catch(e => console.warn("Error fetching debug active context:", e));

    // 2. Fetch permanent user preferences
    fetch(`${API_URL}/agents/preferences/categories`, { headers })
      .then(res => res.json())
      .then(data => {
        if (data && data.categories) {
          setUserPreferences(data.categories);
        }
      })
      .catch(e => console.warn("Error fetching categorized preferences:", e));
  };

  const handleOpenMemoryEdit = () => {
    setEditForm({
      trip_context: {
        destination: tripContext.destination || "",
        origin: tripContext.origin || "",
        departure_date: tripContext.departure_date || "",
        return_date: tripContext.return_date || "",
        passengers: tripContext.passengers || 1,
        cabin_class: tripContext.cabin_class || "ECONOMY",
        travel_style: tripContext.travel_style || "General"
      },
      budget_constraints: {
        total_budget: budgetConstraints.total_budget || ""
      }
    });
    setShowMemoryEdit(true);
  };

  const handleSaveMemory = (e: React.FormEvent) => {
    e.preventDefault();
    const headers: any = { 'Content-Type': 'application/json' };
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }

    fetch(`${API_URL}/agents/session/${sessionId}/context`, {
      method: 'POST',
      headers,
      body: JSON.stringify(editForm)
    })
      .then(res => res.json())
      .then(() => {
        loadMemory();
        setShowMemoryEdit(false);
      })
      .catch(e => console.error("Error saving memory:", e));
  };

  const handleClearMemory = () => {
    const headers: any = {};
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }

    // 1. Clear database preferences
    fetch(`${API_URL}/agents/preferences/clear`, {
      method: 'DELETE',
      headers
    })
      .catch(e => console.error("Error clearing preferences:", e));

    // 2. Reset session active context & history
    fetch(`${API_URL}/agents/session/${sessionId}/reset`, {
      method: 'DELETE',
      headers
    })
      .then(() => {
        setTripContext({});
        setBudgetConstraints({});
        setUserPreferences({});
        setLastTelemetry({});
        setMessages([
          { role: 'assistant', content: "Hello! I am your Travel OS Assistant. I can search flight reservations, suggest hotels, map out custom day-by-day itineraries, and check Schengen visa guidelines. Try asking: 'Recommend flights from Delhi to Goa on December 15th' or 'What are the visa rules for Schengen?'" }
        ]);
      })
      .catch(e => console.error("Error resetting session:", e));
  };

  // Fetch session history and active memory on load
  useEffect(() => {
    loadMemory();

    fetch(`${API_URL}/agents/chat/history/${sessionId}`)
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
                itinerary: parsed.itinerary,
                visa: parsed.visa,
                weather: parsed.weather,
                budget: parsed.budget,
                map_data: parsed.map_data
              };
            }
            return msg;
          });
          setMessages(parsedHistory);
        }
      })
      .catch(e => console.error("Error loading chat history:", e));
  }, [sessionId, authToken]);

  // WebSocket Connection
  useEffect(() => {
    const socket = new WebSocket(`${WS_BASE}/v1/agents/chat/ws/${sessionId}`);
    
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
        if (data.trip_context) {
          setTripContext(data.trip_context);
        }
        if (data.budget_constraints) {
          setBudgetConstraints(data.budget_constraints);
        }
        if (data.telemetry) {
          setLastTelemetry(data.telemetry);
        }
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
            last.visa = parsed.visa;
            last.weather = parsed.weather;
            last.budget = parsed.budget;
            last.map_data = parsed.map_data;
            last.telemetry = data.telemetry;
          }
          return copy;
        });
        
        loadMemory();

        // Vocalize text response (TTS) if speech was activated
        if (shouldSpeak) {
          const lastMsg = messages[messages.length - 1];
          // We can synthesize from data.full_response content parsed
          const parsed = parseMessageBlocks(data.full_response);
          const utterText = parsed.content.replace(/[*#`\-]/g, "").trim();
          const utterance = new SpeechSynthesisUtterance(utterText);
          const voices = window.speechSynthesis.getVoices();
          const engVoice = voices.find(v => v.lang.startsWith("en"));
          if (engVoice) utterance.voice = engVoice;
          window.speechSynthesis.speak(utterance);
          setShouldSpeak(false);
        }
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
    if (!isVoice) return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser. Please try Google Chrome or Edge.");
      setIsVoice(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      console.log("Speech recognition started");
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      console.log("Speech recognition result:", transcript);
      setInputMsg(transcript);
      setShouldSpeak(true);
      triggerSendMessage(transcript);
    };

    recognition.onerror = (e: any) => {
      console.error("Speech recognition error:", e);
      setIsVoice(false);
    };

    recognition.onend = () => {
      console.log("Speech recognition ended");
      setIsVoice(false);
    };

    recognition.start();

    return () => {
      recognition.abort();
    };
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
      const socket = new WebSocket(`${WS_BASE}/v1/agents/chat/ws/${sessionId}`);
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

  const downloadItineraryPDF = (itin: any[]) => {
    if (!itin || !Array.isArray(itin)) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Please allow popups to download your PDF itinerary.");
      return;
    }
    
    let daysHtml = itin.map(day => `
      <div class="day-card">
        <h3>Day ${day.day} — ${day.title || day.theme || 'Plan'}</h3>
        <p><strong>🌅 Morning:</strong> ${getSlotText(day, 'morning')}</p>
        <p><strong>☀️ Afternoon:</strong> ${getSlotText(day, 'afternoon')}</p>
        <p><strong>🌙 Evening:</strong> ${getSlotText(day, 'evening')}</p>
      </div>
    `).join("");

    const htmlContent = `
      <html>
        <head>
          <title>Travel OS - Travel Itinerary</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #030712; color: #f3f4f6; padding: 40px; }
            h1 { font-family: serif; color: #fbbf24; border-bottom: 2px solid #fbbf24; padding-bottom: 10px; text-transform: uppercase; font-size: 28px; }
            .meta-info { margin: 20px 0 40px 0; font-size: 14px; color: #9ca3af; }
            .day-card { background: #111827; border: 1px solid #374151; border-radius: 12px; padding: 20px; margin-bottom: 20px; }
            .day-card h3 { color: #60a5fa; margin-top: 0; font-size: 16px; border-bottom: 1px solid #1f2937; padding-bottom: 8px; }
            p { font-size: 13px; line-height: 1.6; margin: 8px 0; color: #d1d5db; }
            strong { color: #f3f4f6; }
            .footer { margin-top: 60px; text-align: center; border-top: 1px dashed #374151; padding-top: 20px; font-size: 11px; color: #6b7280; display: flex; justify-content: space-between; align-items: center; }
            .qr-code { background: #fff; padding: 8px; border-radius: 8px; }
          </style>
        </head>
        <body>
          <h1>✈️ Travel OS Itinerary Proposal</h1>
          <div class="meta-info">
            Generated by Autonomous Travel Coordinator • Session: ${sessionId} • Date: ${new Date().toLocaleDateString()}
          </div>
          <div class="itinerary-list">
            ${daysHtml}
          </div>
          <div class="footer">
            <div>
              <p>Thank you for choosing <strong>Travel OS</strong>.</p>
              <p>Lock your fares and complete reservations directly inside the Travel OS dashboard.</p>
            </div>
            <div class="qr-code">
              <img src="https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=https://travelos.com/session/${sessionId}" alt="Itinerary QR Verification" width="100" height="100" />
            </div>
          </div>
          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `;
    printWindow.document.write(htmlContent);
    printWindow.document.close();
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

  const activeContext = messages.length > 1 ? (() => {
    // Extract last mentioned context from messages for display in memory strip
    const ctx: string[] = [];
    const history = messages.slice().reverse();
    for (const m of history) {
      const c = m.content || '';
      if (c.match(/delhi|mumbai|bangalore|goa|bali|paris|dubai|london/i)) {
        const match = c.match(/(delhi|mumbai|bangalore|goa|bali|paris|dubai|london)/i);
        if (match) { ctx.push(`📍 ${match[1].charAt(0).toUpperCase() + match[1].slice(1)}`); break; }
      }
    }
    for (const m of history) {
      const c = m.content || '';
      if (c.match(/₹[\d,]+|budget|\d{4,} rupee/i)) {
        const match = c.match(/₹([\d,]+)/);
        if (match) { ctx.push(`💰 ₹${match[1]}`); break; }
      }
    }
    for (const m of history) {
      const c = m.content || '';
      if (c.match(/\d+ (day|night|passenger|adult|pax)/i)) {
        const match = c.match(/(\d+) (day|night|passenger|adult|pax)/i);
        if (match) { ctx.push(`👥 ${match[1]} ${match[2]}(s)`); break; }
      }
    }
    return ctx;
  })() : [];

  return (
    <div className="flex flex-col h-full bg-[#0a0f1d]">
      {/* Developer Debug Panel Overlay */}
      {showDebug && (
        <DebugPanel
          sessionId={sessionId}
          token={authToken}
          onClose={() => setShowDebug(false)}
        />
      )}

      {/* Redesigned AI Memory Panel */}
      <div className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md px-4 md:px-8 py-3 relative">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 mr-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse animate-duration-1000" />
              <span className="text-[10px] text-slate-200 font-extrabold uppercase tracking-widest">AI Remembers</span>
            </div>
            
            {/* Context badges */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] bg-slate-900 border border-slate-800 text-slate-300 px-2 py-0.5 rounded font-medium">
                📍 Destination: <strong className="text-white">{tripContext.destination || "—"}</strong>
              </span>
              <span className="text-[10px] bg-slate-900 border border-slate-800 text-slate-300 px-2 py-0.5 rounded font-medium">
                💰 Budget: <strong className="text-emerald-400">{budgetConstraints.total_budget ? `₹${Number(budgetConstraints.total_budget).toLocaleString()}` : "—"}</strong>
              </span>
              <span className="text-[10px] bg-slate-900 border border-slate-800 text-slate-300 px-2 py-0.5 rounded font-medium">
                👥 Passengers: <strong className="text-white">{tripContext.passengers || "—"}</strong>
              </span>
              <span className="text-[10px] bg-slate-900 border border-slate-800 text-slate-300 px-2 py-0.5 rounded font-medium">
                ✈️ Cabin: <strong className="text-blue-400 uppercase">{tripContext.cabin_class || "—"}</strong>
              </span>
              <span className="text-[10px] bg-slate-900 border border-slate-800 text-slate-300 px-2 py-0.5 rounded font-medium">
                🎒 Style: <strong className="text-purple-400 capitalize">{tripContext.travel_style || "—"}</strong>
              </span>
              {(userPreferences.airlines?.length > 0 || userPreferences.hotels?.length > 0) && (
                <span className="text-[10px] bg-slate-900 border border-slate-800 text-slate-300 px-2 py-0.5 rounded font-medium">
                  ⭐ Favs: <strong className="text-yellow-400">{[...(userPreferences.airlines || []), ...(userPreferences.hotels || [])].slice(0, 2).join(", ")}</strong>
                </span>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2 ml-auto md:ml-0 shrink-0">
            <button
              onClick={handleOpenMemoryEdit}
              className="text-[10px] text-slate-300 hover:text-white border border-slate-800 hover:border-slate-700 bg-slate-900/60 px-2.5 py-1 rounded transition-all cursor-pointer font-bold"
            >
              ✏️ Edit Memory
            </button>
            <button
              onClick={handleClearMemory}
              className="text-[10px] text-slate-400 hover:text-red-400 border border-slate-850 hover:border-red-950/40 bg-slate-950/40 px-2.5 py-1 rounded transition-all cursor-pointer font-semibold"
              title="Clear all learned preferences and active trip context"
            >
              Clear Memory
            </button>
            <button
              onClick={() => triggerSendMessage('RESET_SESSION')}
              className="text-[10px] text-slate-300 hover:text-white border border-slate-800 hover:border-slate-700 bg-slate-900/60 px-2.5 py-1 rounded transition-all cursor-pointer font-bold"
            >
              + New Chat
            </button>
            <button
              onClick={() => setShowDebug(prev => !prev)}
              className={`text-[10px] border px-2.5 py-1 rounded transition-all cursor-pointer font-bold ${
                showDebug
                  ? 'text-emerald-300 border-emerald-700 bg-emerald-950/30'
                  : 'text-slate-500 hover:text-slate-300 border-slate-800 hover:border-slate-700'
              }`}
            >
              ⚙ Debug
            </button>
          </div>
        </div>

        {/* Inline Memory Editor Panel drawer/overlay */}
        {showMemoryEdit && (
          <div className="absolute top-full left-0 right-0 z-50 bg-[#0c1224] border-b border-slate-800 shadow-2xl p-6">
            <form onSubmit={handleSaveMemory} className="max-w-4xl mx-auto space-y-4">
              <div className="flex justify-between items-center border-b border-slate-800 pb-2 mb-2">
                <span className="text-xs font-black uppercase text-blue-400 tracking-wider">Configure Travel Profile Context</span>
                <button type="button" onClick={() => setShowMemoryEdit(false)} className="text-slate-400 hover:text-white transition-colors cursor-pointer text-lg font-bold">×</button>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div className="space-y-1">
                  <label className="text-slate-400 block font-bold">Destination city</label>
                  <input
                    type="text"
                    value={editForm.trip_context?.destination || ""}
                    onChange={(e) => setEditForm({
                      ...editForm,
                      trip_context: { ...editForm.trip_context, destination: e.target.value }
                    })}
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-blue-500"
                    placeholder="e.g. Goa"
                  />
                </div>
                
                <div className="space-y-1">
                  <label className="text-slate-400 block font-bold">Origin city</label>
                  <input
                    type="text"
                    value={editForm.trip_context?.origin || ""}
                    onChange={(e) => setEditForm({
                      ...editForm,
                      trip_context: { ...editForm.trip_context, origin: e.target.value }
                    })}
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-blue-500"
                    placeholder="e.g. DEL"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-400 block font-bold">Departure Date</label>
                  <input
                    type="date"
                    value={editForm.trip_context?.departure_date || ""}
                    onChange={(e) => setEditForm({
                      ...editForm,
                      trip_context: { ...editForm.trip_context, departure_date: e.target.value }
                    })}
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-400 block font-bold">Return Date</label>
                  <input
                    type="date"
                    value={editForm.trip_context?.return_date || ""}
                    onChange={(e) => setEditForm({
                      ...editForm,
                      trip_context: { ...editForm.trip_context, return_date: e.target.value }
                    })}
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-400 block font-bold">Passengers</label>
                  <input
                    type="number"
                    min={1}
                    value={editForm.trip_context?.passengers || 1}
                    onChange={(e) => setEditForm({
                      ...editForm,
                      trip_context: { ...editForm.trip_context, passengers: parseInt(e.target.value) || 1 }
                    })}
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-400 block font-bold">Cabin Class</label>
                  <select
                    value={editForm.trip_context?.cabin_class || "ECONOMY"}
                    onChange={(e) => setEditForm({
                      ...editForm,
                      trip_context: { ...editForm.trip_context, cabin_class: e.target.value }
                    })}
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-blue-500"
                  >
                    <option value="ECONOMY">ECONOMY</option>
                    <option value="BUSINESS">BUSINESS</option>
                    <option value="FIRST">FIRST</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-slate-400 block font-bold">Travel Style</label>
                  <select
                    value={editForm.trip_context?.travel_style || "General"}
                    onChange={(e) => setEditForm({
                      ...editForm,
                      trip_context: { ...editForm.trip_context, travel_style: e.target.value }
                    })}
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-blue-500"
                  >
                    <option value="General">General</option>
                    <option value="Luxury">Luxury</option>
                    <option value="Budget">Budget</option>
                    <option value="Adventure">Adventure</option>
                    <option value="Family">Family</option>
                    <option value="Solo">Solo</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-slate-400 block font-bold">Total Budget (INR)</label>
                  <input
                    type="number"
                    value={editForm.budget_constraints?.total_budget || ""}
                    onChange={(e) => setEditForm({
                      ...editForm,
                      budget_constraints: { ...editForm.budget_constraints, total_budget: parseFloat(e.target.value) || "" }
                    })}
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-blue-500"
                    placeholder="e.g. 50000"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800/60">
                <button type="button" onClick={() => setShowMemoryEdit(false)} className="bg-slate-900 hover:bg-slate-850 text-slate-300 font-bold px-4 py-2 rounded-lg cursor-pointer">Cancel</button>
                <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-2 rounded-lg cursor-pointer">Save Memory Profile</button>
              </div>
            </form>
          </div>
        )}
      </div>
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-8 space-y-4 md:space-y-6">
        {messages.map((msg, index) => (
          <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-2xl rounded-2xl p-5 ${
              msg.role === 'user' 
                ? 'bg-blue-600 text-white rounded-tr-none' 
                : 'glass-card assistant-bubble-theme rounded-tl-none border border-slate-800'
            }`}>
              {msg.role === 'assistant' && (msg.status || msg.flights || msg.hotels || msg.itinerary) && (
                <ReasoningPanel status={msg.status} isDone={!msg.status} telemetry={msg.telemetry} />
              )}
              {(!msg.status || msg.content) && (() => {
                // Split off the AI Explainability block for separate rendering
                const raw = msg.content || '';
                const explainSep = '---\n**🧠 AI Recommendation Rationale**';
                const explainIdx = raw.indexOf(explainSep);
                const mainText = explainIdx >= 0 ? raw.slice(0, explainIdx).trim() : raw;
                const explainText = explainIdx >= 0 ? raw.slice(explainIdx + explainSep.length).trim() : '';
                return (
                  <>
                    <div className="rich-ai-response">{renderRichAIResponse(mainText, false, triggerSendMessage, bookedItems, handleBook, handleCancel)}</div>
                    {explainText && (
                      <details className="mt-3 group" open={false}>
                        <summary className="cursor-pointer text-[10px] text-purple-400 font-black uppercase tracking-wider flex items-center gap-1.5 list-none select-none">
                          <span className="group-open:rotate-90 transition-transform inline-block">▶</span>
                          🧠 Why this recommendation?
                        </summary>
                        <div className="mt-2 bg-purple-950/20 border border-purple-900/30 rounded-xl p-3 text-[11px] leading-relaxed whitespace-pre-wrap rich-ai-response">
                          {renderRichAIResponse(explainText, true, triggerSendMessage, bookedItems, handleBook, handleCancel)}
                        </div>
                      </details>
                    )}
                  </>
                );
              })()}

              {msg.flights && Array.isArray(msg.flights) && (
                <div className="mt-4 space-y-3 border-t border-slate-800 pt-4">
                  <h4 className="text-xs text-slate-400 font-semibold mb-2">FOUND FLIGHT SELECTIONS:</h4>
                  {(() => {
                    const AIRLINE_MAP: Record<string, string> = {
                      "6E": "IndiGo",
                      "AI": "Air India",
                      "UK": "Vistara",
                      "QP": "Akasa Air",
                      "SG": "SpiceJet",
                      "G8": "Go First",
                      "AA": "American Airlines",
                      "DL": "Delta Air Lines",
                      "UA": "United Airlines",
                      "LH": "Lufthansa",
                      "EK": "Emirates",
                      "EY": "Etihad Airways",
                      "QR": "Qatar Airways"
                    };
                    
                    const parseFlightTimeAndCode = (val: string, fallbackCode: string, fallbackTime: string) => {
                      if (!val) return { code: fallbackCode, time: fallbackTime };
                      const parts = val.trim().split(/\s+/);
                      if (parts.length >= 2) {
                        return { code: parts[0], time: parts[1] };
                      } else if (parts.length === 1) {
                        if (parts[0].includes(":")) {
                          return { code: fallbackCode, time: parts[0] };
                        } else {
                          return { code: parts[0], time: fallbackTime };
                        }
                      }
                      return { code: fallbackCode, time: fallbackTime };
                    };

                    const formatDuration = (val: any) => {
                      if (typeof val === 'number') {
                        return `${Math.floor(val / 60)}h ${val % 60}m`;
                      }
                      return String(val || "2h 15m");
                    };

                    return msg.flights.map((fl: any, i: number) => {
                      if (!fl) return null;
                      
                      const airlineCode = (fl.airline || "6E").trim().toUpperCase();
                      const airlineName = AIRLINE_MAP[airlineCode] || airlineCode;
                      const flightNumber = fl.flight_number || `${airlineCode}-101`;
                      
                      const depInfo = parseFlightTimeAndCode(fl.dep, "DEL", "08:00");
                      const arrInfo = parseFlightTimeAndCode(fl.arr, "GOI", "10:30");
                      const duration = formatDuration(fl.duration);
                      const cabinClass = fl.cabin_class || "ECONOMY";
                      const stops = fl.layovers && fl.layovers.length > 0 ? `${fl.layovers.length} stop(s)` : "Non-stop";
                      
                      const isBusiness = cabinClass.toUpperCase() === "BUSINESS" || cabinClass.toUpperCase() === "FIRST";
                      const baggageAllowance = fl.baggage || (isBusiness ? "35 kg check-in / 7 kg cabin" : "15 kg check-in / 7 kg cabin");
                      
                      const isRefundable = fl.cancellation_policy && !fl.cancellation_policy.toLowerCase().includes("non-refundable");
                      const cancellationText = fl.cancellation_policy || "Refundable";
                      const isBooked = bookedItems[flightNumber];
                      
                      return (
                        <div key={i} className="dark-card-override bg-[#0f192e] p-4 rounded-xl flex flex-col md:flex-row gap-4 justify-between items-start md:items-center border border-slate-800 hover:border-slate-700 hover:shadow-lg transition-all relative">
                          {/* Left Section: Flight details */}
                          <div className="flex-1 w-full space-y-2">
                            {/* Airline, flight number, cabin */}
                            <div className="flex flex-wrap items-center gap-2">
                              <Plane size={12} className="text-blue-400 rotate-45" />
                              <span className="font-extrabold text-xs text-slate-100">{airlineName}</span>
                              <span className="text-[9px] font-mono bg-blue-950/80 text-blue-300 px-1.5 py-0.5 rounded border border-blue-900/40">{flightNumber}</span>
                              <span className="dark-card-badge text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded">{cabinClass}</span>
                              {isBooked && (
                                <span className="text-[9px] bg-emerald-950/40 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded flex items-center gap-0.5"><CheckCircle size={8} /> Booked</span>
                              )}
                            </div>

                            {/* Route, Times, Duration */}
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-slate-200">
                              <div className="flex items-baseline gap-1">
                                <span className="font-black text-sm text-white">{depInfo.time}</span>
                                <span className="text-[10px] font-bold text-slate-400 uppercase">{depInfo.code}</span>
                              </div>
                              
                              <div className="flex flex-col items-center min-w-[50px] relative px-1">
                                <span className="text-[8px] text-slate-400 font-semibold">{duration}</span>
                                <div className="w-full h-0.5 relative flex items-center justify-center" style={{ backgroundColor: '#475569' }}>
                                  <div className="w-1 h-1 rounded-full" style={{ backgroundColor: '#94a3b8' }}></div>
                                </div>
                                <span className="text-[8px] text-slate-400 font-medium mt-0.5">{stops}</span>
                              </div>
                              
                              <div className="flex items-baseline gap-1">
                                <span className="font-black text-sm text-white">{arrInfo.time}</span>
                                <span className="text-[10px] font-bold text-slate-400 uppercase">{arrInfo.code}</span>
                              </div>
                            </div>

                            {/* Baggage & Refundability badges */}
                            <div className="flex flex-wrap items-center gap-2 pt-0.5">
                              <span className="dark-card-badge text-[9px] px-1.5 py-0.5 rounded">💼 {baggageAllowance}</span>
                              <span className={`text-[9px] px-1.5 py-0.5 rounded border ${
                                isRefundable 
                                  ? "bg-emerald-950/40 text-emerald-400 border-emerald-900/40" 
                                  : "bg-amber-950/40 text-amber-400 border-amber-900/40"
                              }`}>{isRefundable ? "✓ Refundable" : "✕ Non-Refundable"}</span>
                            </div>
                          </div>

                          {/* Right Section: Price & Book button */}
                          <div className="text-right w-full md:w-auto flex md:flex-col justify-between md:justify-center items-center md:items-end gap-2 border-t md:border-t-0 border-slate-800/60 pt-2 md:pt-0">
                            <div className="font-black text-emerald-400 text-sm md:text-base">₹{Number(fl.price || 0).toLocaleString()}</div>
                            {isBooked ? (
                              <button 
                                onClick={() => handleCancel(flightNumber, airlineName, Number(fl.price || 0))}
                                className="bg-red-950/40 border border-red-500/30 hover:bg-red-900/30 text-red-400 text-[10px] font-bold px-2.5 py-1 rounded transition-all cursor-pointer"
                              >
                                Cancel Booking
                              </button>
                            ) : (
                              <button 
                                onClick={() => handleBook(flightNumber, airlineName, Number(fl.price || 0))}
                                className="bg-blue-600 hover:bg-blue-500 active:scale-95 text-white text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all cursor-pointer"
                              >
                                Book Now
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    });
                  })()}
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
                    <div className="flex gap-2">
                      <button 
                        onClick={() => downloadItineraryPDF(msg.itinerary!)}
                        className="bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 text-[10px] font-bold px-2.5 py-1 rounded border border-emerald-500/20 flex items-center gap-1 transition-all"
                      >
                        📄 Download PDF
                      </button>
                      <button 
                        onClick={() => downloadCalendarICS(msg.itinerary!)}
                        className="bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 text-[10px] font-bold px-2.5 py-1 rounded border border-blue-500/20 flex items-center gap-1 transition-all"
                      >
                        <Calendar size={12} /> Sync to Google Calendar
                      </button>
                    </div>
                  </div>
                  {msg.itinerary.map((day: any, i: number) => (
                    <div key={i} className="bg-[#121c33] p-4 rounded-xl border border-slate-800">
                      <div className="font-bold text-xs text-blue-400">Day {day.day} — {day.title || day.theme || 'Plan'}</div>
                      <div className="mt-2 space-y-1.5 text-[11px] text-slate-300">
                        {/* Morning */}
                        <div className="flex items-center justify-between group py-1 border-b border-slate-900/20 last:border-0">
                          {editingSlot?.msgIdx === index && editingSlot?.dayIdx === i && editingSlot?.slotKey === 'morning' ? (
                            <div className="flex items-center gap-2 w-full">
                              <span className="shrink-0 text-sm">🌅</span>
                              <input 
                                type="text" 
                                value={editValue} 
                                onChange={(e) => setEditValue(e.target.value)} 
                                className="flex-1 px-2 py-0.5 rounded bg-slate-950/80 border border-slate-700 text-[11px] text-white focus:outline-none"
                              />
                              <button onClick={handleSaveSlot} className="bg-emerald-600 px-2 py-0.5 rounded text-[10px] text-white font-bold">Save</button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between w-full">
                              <div>🌅 <span className="font-semibold text-slate-400">Morning:</span> {getSlotText(day, 'morning')}</div>
                              <div className="hidden group-hover:flex items-center gap-1.5 ml-2">
                                <button onClick={() => handleEditSlot(index, i, 'morning', getSlotText(day, 'morning'))} className="text-slate-400 hover:text-white transition-colors bg-transparent border-none text-[10px] p-0 cursor-pointer" title="Edit">✏️</button>
                                <button onClick={() => handleSwapSlots(index, i, 'morning', 'afternoon')} className="text-slate-400 hover:text-white transition-colors bg-transparent border-none text-[10px] p-0 cursor-pointer" title="Swap with Afternoon">🔄</button>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Afternoon */}
                        <div className="flex items-center justify-between group py-1 border-b border-slate-900/20 last:border-0">
                          {editingSlot?.msgIdx === index && editingSlot?.dayIdx === i && editingSlot?.slotKey === 'afternoon' ? (
                            <div className="flex items-center gap-2 w-full">
                              <span className="shrink-0 text-sm">☀️</span>
                              <input 
                                type="text" 
                                value={editValue} 
                                onChange={(e) => setEditValue(e.target.value)} 
                                className="flex-1 px-2 py-0.5 rounded bg-slate-950/80 border border-slate-700 text-[11px] text-white focus:outline-none"
                              />
                              <button onClick={handleSaveSlot} className="bg-emerald-600 px-2 py-0.5 rounded text-[10px] text-white font-bold">Save</button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between w-full">
                              <div>☀️ <span className="font-semibold text-slate-400">Afternoon:</span> {getSlotText(day, 'afternoon')}</div>
                              <div className="hidden group-hover:flex items-center gap-1.5 ml-2">
                                <button onClick={() => handleEditSlot(index, i, 'afternoon', getSlotText(day, 'afternoon'))} className="text-slate-400 hover:text-white transition-colors bg-transparent border-none text-[10px] p-0 cursor-pointer" title="Edit">✏️</button>
                                <button onClick={() => handleSwapSlots(index, i, 'afternoon', 'evening')} className="text-slate-400 hover:text-white transition-colors bg-transparent border-none text-[10px] p-0 cursor-pointer" title="Swap with Evening">🔄</button>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Evening */}
                        <div className="flex items-center justify-between group py-1 border-b border-slate-900/20 last:border-0">
                          {editingSlot?.msgIdx === index && editingSlot?.dayIdx === i && editingSlot?.slotKey === 'evening' ? (
                            <div className="flex items-center gap-2 w-full">
                              <span className="shrink-0 text-sm">🌙</span>
                              <input 
                                type="text" 
                                value={editValue} 
                                onChange={(e) => setEditValue(e.target.value)} 
                                className="flex-1 px-2 py-0.5 rounded bg-slate-950/80 border border-slate-700 text-[11px] text-white focus:outline-none"
                              />
                              <button onClick={handleSaveSlot} className="bg-emerald-600 px-2 py-0.5 rounded text-[10px] text-white font-bold">Save</button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between w-full">
                              <div>🌙 <span className="font-semibold text-slate-400">Evening:</span> {getSlotText(day, 'evening')}</div>
                              <div className="hidden group-hover:flex items-center gap-1.5 ml-2">
                                <button onClick={() => handleEditSlot(index, i, 'evening', getSlotText(day, 'evening'))} className="text-slate-400 hover:text-white transition-colors bg-transparent border-none text-[10px] p-0 cursor-pointer" title="Edit">✏️</button>
                                <button onClick={() => handleSwapSlots(index, i, 'evening', 'morning')} className="text-slate-400 hover:text-white transition-colors bg-transparent border-none text-[10px] p-0 cursor-pointer" title="Swap with Morning">🔄</button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {msg.visa && (
                <div className="mt-4 border-t border-slate-800 pt-4 space-y-2">
                  <h4 className="text-xs text-slate-400 font-semibold mb-2 flex items-center gap-1.5">📋 VISA APPLICATION REQUIREMENT:</h4>
                  <div className="bg-[#121c33] p-4 rounded-xl border border-slate-800 text-xs text-slate-300 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-200 uppercase">{msg.visa.destination_country} Visa Advisory</span>
                      <span className="text-[10px] bg-blue-900/60 text-blue-300 px-2 py-0.5 rounded font-semibold">{msg.visa.requirement_type || 'eVisa'}</span>
                    </div>
                    <div>🎯 <span className="font-semibold text-slate-400">Eligibility:</span> For {msg.visa.citizenship || 'Indian'} Passport holders</div>
                    <div>⏱️ <span className="font-semibold text-slate-400">Processing Time:</span> {msg.visa.processing_time || '15 calendar days'}</div>
                    <div className="space-y-1 mt-2">
                      <div className="font-semibold text-slate-400">Documents Checklist:</div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 pl-2 text-[11px]">
                        {(msg.visa.documents || ['Valid Passport', 'Flight Tickets', 'Hotel Reservation', 'Medical Insurance']).map((doc: string, idx: number) => (
                          <div key={idx} className="flex items-center gap-1 text-slate-300">✔️ {doc}</div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {msg.weather && (
                <div className="mt-4 border-t border-slate-800 pt-4 space-y-2">
                  <h4 className="text-xs text-slate-400 font-semibold mb-2 flex items-center gap-1.5">🌦️ CLIMATE & PACKING ADVISORY:</h4>
                  <div className="bg-[#121c33] p-4 rounded-xl border border-slate-800 text-xs text-slate-300 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-200">Destination Weather Guide</span>
                      <span className="font-bold text-yellow-400">{msg.weather.avg_temp || '28'}°C / Average</span>
                    </div>
                    <div className="text-[11px] text-slate-400 leading-normal">
                      ℹ️ {msg.weather.forecast || 'Sunny and pleasant conditions. Ideal for sightseeing.'}
                    </div>
                    <div className="space-y-1.5 mt-2">
                      <div className="font-semibold text-slate-400 text-xs">Essential Travel Checklist:</div>
                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        {(msg.weather.packing_checklist || ['Light cotton clothes', 'Sunglasses & Sunscreen', 'Comfortable footwear', 'Universal adapter']).map((item: string, idx: number) => {
                          return (
                            <label key={idx} className="flex items-center gap-2 text-slate-300 cursor-pointer">
                              <input type="checkbox" defaultChecked className="rounded border-slate-800 bg-slate-900 text-blue-600 focus:ring-0" />
                              <span>{item}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {msg.budget && (
                <div className="mt-4 border-t border-slate-800 pt-4 space-y-2">
                  <h4 className="text-xs text-slate-400 font-semibold mb-2 flex items-center gap-1.5">💰 BUDGET ALLOCATION:</h4>
                  <div className="bg-[#121c33] p-4 rounded-xl border border-slate-800 text-xs text-slate-300 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-slate-200">Total Proposed Budget:</span>
                      <span className="font-black text-emerald-400 text-sm">₹{Number(msg.budget.total_budget || 0).toLocaleString()}</span>
                    </div>
                    
                    <div className="space-y-2">
                      {Object.entries(msg.budget.breakdown || {
                        flights: 9000,
                        hotels: 10500,
                        activities: 4500,
                        food_transport: 6000
                      }).map(([key, value]: [string, any], idx) => {
                        const total = msg.budget.total_budget || 30000;
                        const pct = Math.round((Number(value) / total) * 100);
                        const label = key.replace("_", " ").toUpperCase();
                        const colorClass = ['bg-blue-500', 'bg-purple-500', 'bg-pink-500', 'bg-yellow-500'][idx % 4];
                        return (
                          <div key={key} className="space-y-1">
                            <div className="flex justify-between text-[10px] font-semibold text-slate-400">
                              <span>{label}</span>
                              <span>₹{Number(value).toLocaleString()} ({pct}%)</span>
                            </div>
                            <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
                              <div className={`${colorClass} h-full rounded-full`} style={{ width: `${pct}%` }}></div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {msg.map_data && (
                <div className="mt-4 border-t border-slate-800 pt-4 space-y-2">
                  <h4 className="text-xs text-slate-400 font-semibold mb-2 flex items-center gap-1.5">🗺️ DYNAMIC TRIP ROUTE MAP:</h4>
                  <div className="bg-[#121c33] p-4 rounded-xl border border-slate-800">
                    <InteractiveRouteMap locations={msg.map_data} />
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {messages.length <= 1 && (
          <div className="max-w-2xl mx-auto space-y-4 pt-6">
            <div className="text-center">
              <div className="text-2xl mb-1">🤖</div>
              <h4 className="text-xs text-slate-300 font-extrabold uppercase tracking-widest">World's Best Autonomous Travel OS</h4>
              <p className="text-[10px] text-slate-500 mt-1">Powered by LangGraph multi-agent orchestration • WebSocket streaming • Enterprise memory</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { emoji: '🚀', label: 'Full Trip Package', text: 'I have ₹70,000. Delhi to Goa. 4 days. Nightlife. December 15th.', badge: 'AI PLANNER' },
                { emoji: '✈️', label: 'Search Flights', text: 'Show me Business class flights from Delhi to Dubai on December 20th.', badge: 'FLIGHT SEARCH' },
                { emoji: '🏨', label: 'Luxury Hotels', text: 'Find 5-star hotels in Udaipur for 3 nights from December 25th.', badge: 'HOTEL SEARCH' },
                { emoji: '📋', label: 'Visa Requirements', text: 'What are the visa requirements for an Indian passport holder visiting Thailand?', badge: 'VISA AGENT' },
                { emoji: '🌦️', label: 'Weather & Packing', text: 'What is the weather like in Goa in December? What should I pack?', badge: 'WEATHER AGENT' },
                { emoji: '💰', label: 'Budget Planner', text: 'I have ₹1,20,000 for a Europe trip. Plan a 10-day budget breakdown for Paris, Amsterdam, and Berlin.', badge: 'BUDGET AGENT' },
                { emoji: '🛡️', label: 'Travel Insurance', text: 'What travel insurance should I get for a 7-day international trip to Bali?', badge: 'INSURANCE' },
                { emoji: '🆘', label: 'Emergency Contacts', text: 'What are the emergency helplines and embassy contacts for travelers visiting Thailand?', badge: 'EMERGENCY' }
              ].map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => triggerSendMessage(p.text)}
                  className="p-3.5 bg-slate-900/80 border border-slate-800 hover:border-blue-500/50 rounded-xl text-left shadow hover:bg-slate-800/60 transition-all cursor-pointer group"
                >
                  <div className="flex items-start gap-2.5">
                    <span className="text-lg">{p.emoji}</span>
                    <div>
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-[10px] text-blue-400 font-black bg-blue-950/30 px-1.5 py-0.5 rounded border border-blue-900/30">{p.badge}</span>
                      </div>
                      <div className="text-xs font-bold text-slate-200 group-hover:text-white transition-colors">{p.label}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5 line-clamp-2 leading-relaxed">{p.text}</div>
                    </div>
                  </div>
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

      <div className="h-20 border-t border-slate-900 px-4 md:px-8 flex items-center justify-between bg-[#0a0f1d]/80">
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
    <div className="p-4 md:p-8 pb-28 md:pb-16 h-full overflow-y-auto overflow-x-hidden max-w-4xl mx-auto space-y-6">
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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
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

      {/* Travel OS Analytics Dashboard */}
      <div className="glass-card p-6 rounded-2xl border border-slate-800 space-y-4">
        <h4 className="font-bold text-slate-200 flex items-center gap-2">🚀 TRAVEL OS ENTERPRISE-GRADE ANALYTICS</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="bg-[#121c33] p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
            <span className="text-[10px] text-slate-400 font-bold uppercase">Total Trips</span>
            <span className="text-xl font-black text-white mt-2">12 Trips</span>
            <span className="text-[9px] text-emerald-400 mt-1">▲ 2 new this month</span>
          </div>
          <div className="bg-[#121c33] p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
            <span className="text-[10px] text-slate-400 font-bold uppercase">Money Saved</span>
            <span className="text-xl font-black text-white mt-2">₹18,400</span>
            <span className="text-[9px] text-blue-400 mt-1">Via fare alerts & holds</span>
          </div>
          <div className="bg-[#121c33] p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
            <span className="text-[10px] text-slate-400 font-bold uppercase">Visited Countries</span>
            <span className="text-xl font-black text-white mt-2">4 Countries</span>
            <span className="text-[9px] text-slate-400 mt-1">India, Bali, Thailand, UAE</span>
          </div>
          <div className="bg-[#121c33] p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
            <span className="text-[10px] text-slate-400 font-bold uppercase">Travel Score</span>
            <span className="text-xl font-black text-white mt-2">92 / 100</span>
            <span className="text-[9px] text-emerald-400 mt-1">Excellent travel standing</span>
          </div>
          <div className="bg-[#121c33] p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
            <span className="text-[10px] text-slate-400 font-bold uppercase">Loyalty Progress</span>
            <span className="text-xl font-black text-white mt-2">Gold Member</span>
            <span className="text-[9px] text-indigo-400 mt-1">550 pts to Platinum</span>
          </div>
          <div className="bg-[#121c33] p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
            <span className="text-[10px] text-slate-400 font-bold uppercase">Carbon Footprint</span>
            <span className="text-xl font-black text-white mt-2">1.2 Tons CO2</span>
            <span className="text-[9px] text-yellow-500 mt-1">Offset program recommended</span>
          </div>
        </div>
      </div>

      {/* Ledger & Travel Credits Section */}
      <div className="glass-card p-6 rounded-2xl border border-slate-800 space-y-4">
        <h4 className="font-bold text-slate-200 flex items-center gap-2">📑 TRANSACTION HISTORY & TRAVEL CREDITS</h4>
        <div className="space-y-3">
          <div className="flex justify-between items-center bg-slate-900/60 p-3 rounded-lg border border-slate-800">
            <div>
              <span className="text-[9px] bg-emerald-950 text-emerald-400 font-extrabold px-1.5 py-0.5 rounded border border-emerald-500/20">CASHBACK CREDITED</span>
              <span className="text-xs text-slate-300 font-bold block mt-1">₹2,500 Cashback from Goa Package Booking</span>
            </div>
            <span className="text-xs font-black text-emerald-400">+₹2,500</span>
          </div>

          <div className="flex justify-between items-center bg-slate-900/60 p-3 rounded-lg border border-slate-800">
            <div>
              <span className="text-[9px] bg-blue-950 text-blue-400 font-extrabold px-1.5 py-0.5 rounded border border-blue-500/20">REFUND PROCESSED</span>
              <span className="text-xs text-slate-300 font-bold block mt-1">Refund for Flight booking cancellation #TX-1092</span>
            </div>
            <div className="text-right">
              <span className="text-xs font-black text-blue-400">+₹5,200</span>
              <span className="text-[8px] text-slate-500 block mt-0.5">Cleared on 2026-08-01</span>
            </div>
          </div>

          <div className="flex justify-between items-center bg-slate-900/60 p-3 rounded-lg border border-slate-800">
            <div>
              <span className="text-[9px] bg-purple-950 text-purple-400 font-extrabold px-1.5 py-0.5 rounded border border-purple-500/20">TRAVEL VOUCHER CREDIT</span>
              <span className="text-xs text-slate-300 font-bold block mt-1">Airline cancel voucher compensation #UK-902-CR</span>
            </div>
            <span className="text-xs font-black text-purple-400">+₹4,000</span>
          </div>

          <div className="flex justify-between items-center bg-slate-900/60 p-3 rounded-lg border border-slate-800">
            <div>
              <span className="text-[9px] bg-slate-950 text-slate-400 font-extrabold px-1.5 py-0.5 rounded border border-slate-800">DEBITED ORDER</span>
              <span className="text-xs text-slate-300 font-bold block mt-1">Payment for hotel booking #HT-20384</span>
            </div>
            <span className="text-xs font-black text-red-400">-₹12,400</span>
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
    fetch(`${API_URL}/media?owner_type=${ownerType}&owner_id=${encodeURIComponent(ownerId)}`)
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
        src={imgUrl.startsWith("http") ? imgUrl : `${API_HOST}${imgUrl}`} 
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
    fetch(`${API_URL}/media?owner_type=${ownerType}&owner_id=${encodeURIComponent(ownerId)}`)
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
  const activeFullUrl = activePhoto.url.startsWith("http") ? activePhoto.url : `${API_HOST}${activePhoto.url}`;

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
                const thumbUrl = p.url.startsWith("http") ? p.url : `${API_HOST}${p.url}`;
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
    fetch(`${API_URL}/media?owner_type=partner&owner_id=${encodeURIComponent(name)}`)
      .then(res => res.json())
      .then(data => {
        const primary = data.find((p: any) => p.is_primary) || data[0];
        if (primary) setLogoUrl(primary.url);
      })
      .catch(() => {});
  }, [name]);

  if (logoUrl) {
    const fullLogoUrl = logoUrl.startsWith("http") ? logoUrl : `${API_HOST}${logoUrl}`;
    return (
      <div onClick={onClick} className="partner-card-item relative w-full h-24 rounded-[var(--radius-card)] border border-slate-800 bg-[var(--color-surface-raised)] cursor-pointer hover:border-[var(--color-gold)] transition-all overflow-hidden group shadow-sm">
        <img 
          src={fullLogoUrl} 
          alt={name} 
          className="w-full h-full object-cover transition-all duration-300 filter grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100"
        />
        <div className="absolute inset-0 bg-black/50 group-hover:bg-transparent transition-colors duration-300 flex items-end p-2">
          <span className="text-[9px] font-mono text-[var(--color-gold)] uppercase tracking-wider bg-[var(--color-surface)] px-2 py-0.5 rounded-[var(--radius-inner)] border border-slate-800">
            {name}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div onClick={onClick} className="partner-card-item p-4 rounded-[var(--radius-card)] border border-slate-800 bg-[var(--color-surface-raised)] hover:border-[var(--color-gold)] cursor-pointer transition-all min-h-[96px] flex flex-col justify-between group shadow-sm">
      <span className="font-serif italic text-xs text-[var(--color-ivory)] group-hover:text-[var(--color-gold)] transition-colors">{name}</span>
      <span className="text-[9px] font-mono text-[var(--color-ivory-dim)] underline">Show partner details</span>
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
    const savedToken = localStorage.getItem('token');
    const decoded = savedToken ? decodeJwt(savedToken) : null;
    const userId = decoded?.id || 1;
    fetch(`${API_URL}/showcase/collections/${slug}?user_id=${userId}`)
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
          <h3 className="text-xl font-serif text-[var(--color-ivory)]">{collection.title}</h3>
          <p className="text-xs text-[var(--color-ivory-dim)] font-medium mt-1">{collection.subtitle}</p>
        </div>
        <div className="flex gap-2">
          <button 
            type="button"
            onClick={() => scroll('left')}
            className="w-8 h-8 rounded-full border border-[var(--color-gold)] text-[var(--color-gold)] bg-transparent hover:bg-[var(--color-gold)]/10 flex items-center justify-center shadow cursor-pointer transition-colors"
          >
            ←
          </button>
          <button 
            type="button"
            onClick={() => scroll('right')}
            className="w-8 h-8 rounded-full border border-[var(--color-gold)] text-[var(--color-gold)] bg-transparent hover:bg-[var(--color-gold)]/10 flex items-center justify-center shadow cursor-pointer transition-colors"
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
            className="collection-card-item flex-none w-72 snap-start bg-[var(--color-surface)] border border-slate-800/80 rounded-[var(--radius-card)] shadow-md hover:shadow-xl hover:-translate-y-1 hover:border-[var(--color-gold)] transition-all duration-300 flex flex-col gap-3 cursor-pointer overflow-hidden group/card"
          >
            <div className="relative w-full h-40 overflow-hidden">
              <img src={item.image_url} alt={item.tag_text} className="w-full h-full object-cover transition-transform duration-500 group-hover/card:scale-103" />
              <div className="absolute inset-0 bg-gradient-to-t from-[var(--color-obsidian)] via-transparent to-transparent opacity-80" />
              {item.label && (
                <span className="absolute top-2 left-2 text-[8px] font-mono bg-[var(--color-surface)] text-[var(--color-gold)] border border-slate-700/60 px-1.5 py-0.5 rounded-[var(--radius-inner)] font-bold">
                  {item.label}
                </span>
              )}
            </div>
            <div className="space-y-1 py-2 px-3 text-left">
              <span className="text-[9px] font-mono text-[var(--color-gold)] uppercase tracking-widest">{item.ref_type}: {item.ref_id}</span>
              <h4 className="font-serif italic text-xs leading-snug text-[var(--color-ivory)] line-clamp-2 min-h-[32px] mt-1">{item.tag_text}</h4>
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
      case "Globe": return <Globe size={20} className="text-[var(--color-gold)]" />;
      case "Clock": return <Clock size={20} className="text-[var(--color-gold)]" />;
      default: return <Compass size={20} className="text-[var(--color-gold)]" />;
    }
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 py-8 border-t border-slate-800/80 font-sans">
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
          className="info-highlight-card bg-[var(--color-surface)] border border-slate-800/80 p-5 rounded-[var(--radius-card)] shadow-sm hover:border-[var(--color-gold)] transition-all flex items-start gap-4 cursor-pointer"
        >
          <div className="p-2 border border-[var(--color-gold)] rounded-full flex items-center justify-center shrink-0">
            {getIcon(h.icon_name)}
          </div>
          <div className="space-y-1 text-left">
            <h4 className="font-semibold text-sm text-[var(--color-ivory)]">{h.title}</h4>
            <p className="text-xs text-[var(--color-ivory-dim)] leading-normal font-medium mt-1">{h.body_text}</p>
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
      className="w-full border border-slate-800 p-6 rounded-[var(--radius-card)] shadow-md flex flex-col md:flex-row justify-between items-center gap-6 text-[var(--color-ivory)] my-8 font-sans bg-gradient-to-r from-[var(--color-teal)] to-[var(--color-obsidian)]"
    >
      <div className="flex items-center gap-4 text-left">
        {/* QR code styled with a thin gold frame */}
        <div className="w-14 h-14 bg-white p-0.5 rounded-[var(--radius-inner)] border border-[var(--color-gold)] flex items-center justify-center shrink-0">
          <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=https://travelos.com" alt="QR" className="w-full h-full object-cover" />
        </div>
        <div>
          <h3 className="font-bold text-lg md:text-xl text-[var(--color-ivory)] leading-snug">
            Southeast Asia's Go-To App for Direct Wallet Bookings
          </h3>
          <p className="text-[10px] font-mono text-[var(--color-gold)] uppercase tracking-wider mt-1">Scan QR or Click below to get Travel OS App</p>
        </div>
      </div>
      <a 
        href={banner.cta_url}
        onClick={(e) => {
          e.preventDefault();
          if (onNavigate) {
            onNavigate(banner.cta_url);
          } else {
            alert("Travel OS Direct App Downloader: SMS 'TRAVEL' to 56161 to get direct Google Play link!");
          }
        }}
        className="bg-[var(--color-gold)] hover:bg-[#d6b35d] text-[var(--color-obsidian)] font-bold px-6 py-2.5 rounded-[var(--radius-card)] transition-all uppercase text-xs whitespace-nowrap cursor-pointer text-center"
      >
        GET THE APP
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
    <footer className="border-t border-slate-800/80 mt-12 pt-12 px-8 bg-[var(--color-obsidian)] text-[var(--color-ivory-dim)] font-sans">
      <div className="max-w-6xl mx-auto pb-10">
        
        {/* Desktop View: Grid */}
        <div className="hidden md:grid grid-cols-4 gap-8">
          {footerData.map((section, idx) => (
            <div key={idx} className="space-y-4">
              <h5 className="font-bold text-xs text-[var(--color-ivory)] border-b border-slate-800/80 pb-2 text-left tracking-wider">{section.title}</h5>
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
                        className="text-[var(--color-ivory-dim)] hover:text-[var(--color-gold)] font-medium hover:underline transition-all text-xs"
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
        <div className="mobile-footer-accordion md:hidden space-y-3">
          {footerData.map((section, idx) => {
            const isExpanded = expandedSection === idx;
            return (
              <div key={idx} className="border border-slate-800/80 rounded-[var(--radius-card)] bg-[var(--color-surface)] overflow-hidden">
                <button 
                  onClick={() => toggleSection(idx)}
                  className="w-full p-4 flex justify-between items-center font-bold text-xs text-[var(--color-ivory)] bg-[var(--color-surface-raised)] border-none"
                >
                  <span>{section.title}</span>
                  <span className="font-bold text-sm">{isExpanded ? "−" : "+"}</span>
                </button>
                {isExpanded && (
                  <nav className="p-4 bg-[var(--color-surface)] border-t border-slate-800/80">
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
                            className="text-[var(--color-ivory-dim)] hover:text-[var(--color-gold)] font-semibold text-xs block py-1"
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
        <div className="border-t border-slate-800/80 mt-10 pt-8 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-left space-y-1">
            <h5 className="font-mono text-[9px] text-[var(--color-ivory-dim)] uppercase tracking-wider">DOWNLOAD TRAVEL OS APP</h5>
            <div className="bg-[var(--color-surface)] border border-slate-800 p-2.5 rounded-[var(--radius-card)] flex items-center gap-2.5 cursor-pointer text-[var(--color-ivory)] hover:border-[var(--color-gold)] transition-colors shadow-sm">
              <Compass size={18} className="text-[var(--color-gold)]" />
              <div>
                <div className="text-[8px] text-[var(--color-ivory-dim)] font-mono uppercase tracking-wider">GET IT ON</div>
                <div className="font-bold text-[10px] leading-none mt-0.5">Google Play Store</div>
              </div>
            </div>
          </div>
          <div className="text-center md:text-right text-[10px] text-[var(--color-ivory-dim)] font-medium max-w-md leading-relaxed">
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

  const [hotelDetails, setHotelDetails] = useState<any | null>(null);
  const [hotelReviews, setHotelReviews] = useState<any[]>([]);
  const [hotelRooms, setHotelRooms] = useState<any[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    if (vertical === 'hotels' && item.hotelId) {
      setLoadingDetails(true);
      fetch(`${API_URL}/hotels/${item.hotelId}`)
        .then(res => res.json())
        .then(data => {
          setHotelDetails(data);
          setLoadingDetails(false);
        })
        .catch(() => setLoadingDetails(false));
        
      fetch(`${API_URL}/hotels/${item.hotelId}/reviews`)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) setHotelReviews(data);
        })
        .catch(console.error);

      fetch(`${API_URL}/hotels/${item.hotelId}/rooms?checkIn=2026-12-15&checkOut=2026-12-20`)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) setHotelRooms(data);
        })
        .catch(console.error);
    }
  }, [vertical, item.hotelId]);

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
      const matched = hotelRooms.find(r => r.roomType === selectedRoom);
      if (matched) {
        base = matched.price;
      } else {
        if (selectedRoom === 'executive') base += 4500;
      }
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
            <h3 className="font-bold text-xl tracking-wide mt-1">{itemName}</h3>
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
            <div className="space-y-4 text-left">
              {loadingDetails ? (
                <div className="text-center py-8 text-xs font-black text-slate-400">Loading hotel amenities, snaps, & room rates...</div>
              ) : (
                <>
                  {/* Photo Lightbox gallery */}
                  <div className="grid grid-cols-3 gap-2">
                    {(hotelDetails?.images || [item.image]).slice(0, 3).map((imgUrl: string, idx: number) => (
                      <div key={idx} className="h-24 rounded-lg border-2 border-black overflow-hidden">
                        <img src={imgUrl} alt={`Snap ${idx}`} className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>

                  {/* Description */}
                  <div className="border-2 border-black p-3 bg-slate-900/60 rounded-xl">
                    <span className="text-[10px] uppercase font-black tracking-wider block text-slate-400">About the Property:</span>
                    <p className="text-xs mt-1 text-slate-300 leading-relaxed font-semibold">{hotelDetails?.description || item.details || "Boutique stays with elegant layouts and cozy spaces."}</p>
                  </div>

                  {/* Amenities/Facilities */}
                  <div className="border-2 border-black p-3 bg-slate-900/60 rounded-xl space-y-1">
                    <span className="text-[10px] uppercase font-black tracking-wider block text-slate-400">🏊 Amenities & Facilities:</span>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {(hotelDetails?.facilities || ["Free Wifi", "Gym", "Breakfast", "AC"]).map((fac: string, idx: number) => (
                        <span key={idx} className="bg-slate-800 text-slate-300 text-[10px] px-2 py-0.5 rounded border border-slate-700 font-bold">{fac}</span>
                      ))}
                    </div>
                  </div>

                  {/* Room Category selector */}
                  <div className="space-y-2">
                    <span className="text-[10px] uppercase font-black tracking-wider block text-slate-400">Choose Room Category:</span>
                    {(hotelRooms.length > 0 ? hotelRooms : [
                      { roomType: "Deluxe Room", beds: "Queen Bed", price: item.price || 4500, mealPlan: "Breakfast Included" },
                      { roomType: "Executive Suite", beds: "King Bed", price: (item.price || 4500) + 4500, mealPlan: "All Meals Included" }
                    ]).map((room, rIdx) => {
                      const isSelected = selectedRoom === room.roomType || (rIdx === 0 && selectedRoom === 'deluxe');
                      return (
                        <label key={rIdx} onClick={() => setSelectedRoom(room.roomType)} className={`flex justify-between items-center p-3 border-2 border-black rounded-lg cursor-pointer ${isSelected ? 'bg-yellow-400 text-black font-extrabold shadow-[2px_2px_0px_0px_#000000]' : 'bg-slate-800/80 text-white'}`}>
                          <div className="flex items-center gap-2">
                            <input type="radio" checked={isSelected} readOnly className="accent-black" />
                            <span className="font-bold text-xs uppercase">{room.roomType} ({room.beds})</span>
                          </div>
                          <span className="text-xs font-bold font-mono">₹{room.price.toLocaleString()}</span>
                        </label>
                      );
                    })}
                  </div>

                  {/* Reviews */}
                  {hotelReviews.length > 0 && (
                    <div className="border-2 border-black p-3 bg-slate-900/60 rounded-xl space-y-2">
                      <span className="text-[10px] uppercase font-black tracking-wider block text-slate-400">💬 Recent Guest Reviews:</span>
                      <div className="space-y-2">
                        {hotelReviews.map((rev, idx) => (
                          <div key={idx} className="text-[11px] border-b border-slate-800 last:border-0 pb-1.5 last:pb-0">
                            <div className="flex justify-between font-bold text-blue-400">
                              <span>{rev.title} ({rev.score}/10)</span>
                              <span className="text-slate-500 font-medium">{rev.author}</span>
                            </div>
                            <p className="text-slate-400 mt-0.5">{rev.pros}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
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
  const [currentWeather, setCurrentWeather] = useState<any | null>(null);
  const [forecastWeather, setForecastWeather] = useState<any[]>([]);
  const [aqi, setAqi] = useState<any | null>(null);
  const [travelRec, setTravelRec] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchWeatherDetails = () => {
    setLoading(true);
    setError(null);
    const city = destination.title;
    
    Promise.all([
      fetch(`${API_URL}/weather/current?city=${encodeURIComponent(city)}`).then(res => {
        if (!res.ok) throw new Error();
        return res.json();
      }),
      fetch(`${API_URL}/weather/forecast?city=${encodeURIComponent(city)}`).then(res => {
        if (!res.ok) throw new Error();
        return res.json();
      }),
      fetch(`${API_URL}/weather/air-quality?city=${encodeURIComponent(city)}`).then(res => {
        if (!res.ok) throw new Error();
        return res.json();
      }),
      fetch(`${API_URL}/weather/travel?city=${encodeURIComponent(city)}`).then(res => {
        if (!res.ok) throw new Error();
        return res.json();
      })
    ])
    .then(([current, forecast, air, travel]) => {
      setCurrentWeather(current);
      setForecastWeather(forecast);
      setAqi(air);
      setTravelRec(travel);
      setLoading(false);
    })
    .catch(err => {
      console.error(err);
      setError("Failed to load weather data.");
      setLoading(false);
    });
  };

  useEffect(() => {
    fetchWeatherDetails();
  }, [destination.title]);

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

        {/* Weather Intelligence Agent widget (Phase 4) */}
        <div className="border-3 border-black p-4 bg-blue-50/80 rounded-xl space-y-3 text-slate-800">
          <div className="flex justify-between items-center">
            <span className="font-black text-xs uppercase tracking-wider text-slate-900">🌦️ Live Weather & Travel Guidelines</span>
            {loading && <span className="animate-spin text-xs">⏳</span>}
          </div>

          {loading && (
            <div className="space-y-2 animate-pulse">
              <div className="h-6 bg-slate-300 rounded w-1/3"></div>
              <div className="h-4 bg-slate-300 rounded w-2/3"></div>
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center gap-1">
              <span className="text-[10px] font-bold text-red-500">{error}</span>
              <button 
                onClick={fetchWeatherDetails}
                className="bg-red-800 hover:bg-red-700 text-white text-[9px] px-2 py-0.5 rounded font-bold cursor-pointer border-none"
              >
                Retry
              </button>
            </div>
          )}

          {!loading && !error && currentWeather && (
            <div className="space-y-3 font-semibold text-xs text-left">
              {/* Row 1: Temperature & Description */}
              <div className="flex justify-between items-center border-b border-black/10 pb-1.5">
                <div>
                  <div className="text-xl font-black text-slate-900 font-mono">
                    {currentWeather.temperature}°C
                  </div>
                  <div className="text-[10px] text-slate-500 uppercase tracking-tight">
                    Feels like {currentWeather.feelsLike}°C • {currentWeather.weather}
                  </div>
                </div>
                <img 
                  src={`https://openweathermap.org/img/wn/${currentWeather.icon}@2x.png`} 
                  alt={currentWeather.weather} 
                  className="w-12 h-12"
                />
              </div>

              {/* Row 2: Metrics */}
              <div className="grid grid-cols-3 gap-2 text-[10px] bg-white/40 p-2 rounded border border-black/10">
                <div>💧 Humidity: {currentWeather.humidity}%</div>
                <div>🧭 Pressure: {currentWeather.pressure} hPa</div>
                <div>💨 Wind: {currentWeather.windSpeed} m/s</div>
                <div>👁️ Visibility: {currentWeather.visibility / 1000} km</div>
                <div>🌅 Sunrise: {new Date(currentWeather.sunrise * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                <div>🌇 Sunset: {new Date(currentWeather.sunset * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
              </div>

              {/* AQI Panel */}
              {aqi && (
                <div className="flex justify-between items-center text-[10px] bg-yellow-50 p-2 rounded border border-yellow-200/50">
                  <span>🍃 Air Quality Index (AQI): <strong className="text-yellow-600">{aqi.AQI}/5</strong></span>
                  <span>PM2.5: {aqi.PM2_5} • PM10: {aqi.PM10}</span>
                </div>
              )}

              {/* Travel Packing Advice */}
              {travelRec && (
                <div className="text-[10px] space-y-1 bg-blue-100/50 p-2.5 rounded border border-blue-200/40">
                  <div className="font-black text-slate-900 uppercase tracking-wide">💡 Travel Guidelines:</div>
                  <div>💼 Packing: {travelRec.packingSuggestions.join(", ")}</div>
                  <div>🧥 Dress: {travelRec.clothingRecommendation}</div>
                  <div>☀️ UV Advice: {travelRec.uvAdvice}</div>
                  <div>🚗 Suggestion: {travelRec.bestTimeToTravel}</div>
                </div>
              )}

              {/* 5-Day Forecast Grid */}
              {forecastWeather.length > 0 && (
                <div className="space-y-1.5 pt-1.5 border-t border-black/10">
                  <span className="text-[9px] uppercase font-black tracking-wider text-slate-400 block text-left">5-Day Forecast:</span>
                  <div className="grid grid-cols-5 gap-1 text-[9px] text-center">
                    {forecastWeather.slice(0, 5).map((day, dIdx) => (
                      <div key={dIdx} className="bg-white/40 p-1 rounded border border-black/5 flex flex-col items-center">
                        <span className="text-slate-500 font-bold">{day.date.substring(5)}</span>
                        <img src={`https://openweathermap.org/img/wn/${day.icon}.png`} alt={day.weather} className="w-6 h-6 my-0.5" />
                        <span className="font-extrabold text-slate-800 font-mono">{Math.round(day.temperature)}°C</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
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
function AccountProfileModal({ userProfile, setUserProfile, onClose, onLogout }: { userProfile: any, setUserProfile: any, onClose: () => void, onLogout: () => void }) {
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

  // Spending data for chart
  const spendData = [
    { month: "Jan", amt: 12000 },
    { month: "Feb", amt: 18000 },
    { month: "Mar", amt: 8000 },
    { month: "Apr", amt: 25000 },
    { month: "May", amt: 15000 },
    { month: "Jun", amt: 32000 },
  ];
  const maxAmt = Math.max(...spendData.map(d => d.amt));

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#0f172a] border-4 border-black p-6 max-w-xl w-full space-y-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] text-white rounded-2xl text-left">
        <div className="flex justify-between items-center border-b-2 border-slate-800 pb-2">
          <h3 className="font-black text-base uppercase tracking-wider flex items-center gap-1.5 text-yellow-400">👤 User Travel Profile</h3>
          <button onClick={onClose} className="font-extrabold text-sm hover:text-red-500 font-bold cursor-pointer bg-transparent border-none text-white">✕</button>
        </div>

        {/* Dynamic Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-left">
          <div className="bg-[#1e293b] border border-slate-700 p-3 rounded-xl">
            <span className="text-[8px] text-slate-400 uppercase block font-black">Trips Booked</span>
            <span className="text-base font-black text-white mt-1 block">14 Trips</span>
          </div>
          <div className="bg-[#1e293b] border border-slate-700 p-3 rounded-xl">
            <span className="text-[8px] text-slate-400 uppercase block font-black">AI Money Saved</span>
            <span className="text-base font-black text-emerald-400 mt-1 block">₹18,450</span>
          </div>
          <div className="bg-[#1e293b] border border-slate-700 p-3 rounded-xl">
            <span className="text-[8px] text-slate-400 uppercase block font-black">Carbon Footprint</span>
            <span className="text-base font-black text-teal-400 mt-1 block">1.2t CO2e</span>
          </div>
          <div className="bg-[#1e293b] border border-slate-700 p-3 rounded-xl">
            <span className="text-[8px] text-slate-400 uppercase block font-black">Loyalty Rating</span>
            <span className="text-base font-black text-yellow-400 mt-1 block">Gold Tier</span>
          </div>
        </div>

        {/* Spending Analytics Chart (SVG) */}
        <div className="bg-[#1e293b] border border-slate-700 p-4 rounded-xl space-y-3">
          <span className="text-[9px] uppercase font-black text-slate-400 block">Monthly Spend Analytics (INR)</span>
          <div className="h-28 w-full flex items-end justify-between gap-2 pt-4">
            {spendData.map((d, i) => {
              const heightPct = (d.amt / maxAmt) * 100;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1 group cursor-pointer">
                  <div className="relative w-full flex justify-center">
                    <span className="absolute -top-6 text-[8px] font-bold text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 px-1 py-0.5 rounded border border-slate-700">₹{d.amt / 1000}k</span>
                    <div 
                      style={{ height: `${heightPct}%` }} 
                      className="w-full sm:w-6 bg-gradient-to-t from-indigo-600 to-purple-400 hover:from-indigo-500 hover:to-purple-300 rounded-t-md transition-all border border-indigo-400/20"
                    />
                  </div>
                  <span className="text-[9px] text-slate-400 font-bold uppercase">{d.month}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Account Info Form */}
        <div className="space-y-3">
          <div>
            <label className="text-[10px] uppercase font-black text-slate-400 block mb-1">Email Address</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-[#1e293b] border-2 border-black rounded px-3 py-2 text-xs font-bold text-white outline-none focus:border-yellow-400" />
          </div>
          <div className="flex gap-2 flex-wrap sm:flex-nowrap">
            <button onClick={handleSave} className="bg-slate-800 text-white hover:bg-slate-700 text-[10px] font-black border-2 border-black px-4 py-2.5 rounded-lg cursor-pointer uppercase transition-all">Save Profile</button>
            <button 
              onClick={() => {
                onClose();
                window.history.pushState(null, '', '/profile');
                window.dispatchEvent(new PopStateEvent('popstate'));
              }} 
              className="bg-blue-600 text-white hover:bg-blue-500 text-[10px] font-black border-2 border-black px-4 py-2.5 rounded-lg cursor-pointer uppercase transition-all"
            >
              Manage Full Profile ➔
            </button>
            <button onClick={onLogout} className="bg-red-600 text-white hover:bg-red-700 text-[10px] font-black border-2 border-black px-4 py-2.5 rounded-lg cursor-pointer uppercase sm:ml-auto transition-all">Log Out</button>
          </div>
        </div>

        {/* Saved Travelers */}
        <div className="border-t border-slate-800 pt-3 space-y-2">
          <span className="text-[10px] uppercase font-black text-slate-400 block">Manage Saved Companions:</span>
          <div className="flex gap-2">
            <input type="text" placeholder="Name (Age)" value={newTraveler} onChange={(e) => setNewTraveler(e.target.value)} className="bg-[#1e293b] border-2 border-black rounded px-3 py-1.5 text-xs font-bold text-white outline-none" />
            <button onClick={handleAddTraveler} className="bg-yellow-400 text-black hover:bg-yellow-300 text-[10px] font-black border-2 border-black px-3 py-1.5 rounded cursor-pointer uppercase transition-all">Add</button>
          </div>
          <div className="space-y-1 mt-2">
            {savedTravelers.map((name, idx) => (
              <div key={idx} className="flex justify-between items-center bg-[#1e293b]/60 border border-slate-700 p-2 rounded text-xs font-bold text-slate-200">
                <span>{name}</span>
                <button onClick={() => handleRemoveTraveler(idx)} className="text-red-400 hover:text-red-300 font-bold text-[10px] uppercase cursor-pointer bg-transparent border-none">Remove</button>
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


/* ---------------------------------------------------- */
/* RENT A RIDE SYSTEM COMPONENTS                        */
/* ---------------------------------------------------- */

function RentARideSearchForm({ onBook, onDetailClick, onNavigate }: { onBook: (data: any) => void, onDetailClick: (vert: string, item: any) => void, onNavigate: (path: string) => void }) {
  const [destination, setDestination] = useState(() => sessionStorage.getItem("rar_destination") || "");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [selectedLocality, setSelectedLocality] = useState<any | null>(null);
  const [pickupDate, setPickupDate] = useState(() => sessionStorage.getItem("rar_pickupDate") || "");
  const [pickupTime, setPickupTime] = useState(() => sessionStorage.getItem("rar_pickupTime") || "");
  const [dropDate, setDropDate] = useState("");
  const [dropTime, setDropTime] = useState("");
  const [vehicleType, setVehicleType] = useState(() => sessionStorage.getItem("rar_vehicleType") || "SUV");
  const [selfDrive, setSelfDrive] = useState(() => {
    const val = sessionStorage.getItem("rar_selfDrive");
    return val === null ? true : val === "true";
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => { sessionStorage.setItem("rar_destination", destination); }, [destination]);
  useEffect(() => { sessionStorage.setItem("rar_pickupDate", pickupDate); }, [pickupDate]);
  useEffect(() => { sessionStorage.setItem("rar_pickupTime", pickupTime); }, [pickupTime]);
  useEffect(() => { sessionStorage.setItem("rar_vehicleType", vehicleType); }, [vehicleType]);
  useEffect(() => { sessionStorage.setItem("rar_selfDrive", String(selfDrive)); }, [selfDrive]);

  // Autocomplete fetch with 150ms debouncing
  useEffect(() => {
    if (!destination || destination.trim().length < 1) {
      setSuggestions([]);
      return;
    }
    if (selectedLocality && selectedLocality.name.toLowerCase() === destination.toLowerCase()) {
      return;
    }

    const timer = setTimeout(() => {
      fetch(`${API_URL}/localities/autocomplete?q=${encodeURIComponent(destination)}`)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            setSuggestions(data);
          }
        })
        .catch(() => {});
    }, 150);

    return () => clearTimeout(timer);
  }, [destination, selectedLocality]);

  const handleSearch = () => {
    if (!destination.trim()) {
      alert("Please enter a destination city.");
      return;
    }
    if (!pickupDate) {
      alert("Please select a pickup date.");
      return;
    }
    if (!pickupTime) {
      alert("Please select a pickup time.");
      return;
    }
    setLoading(true);
    
    // Dynamically calculate dropDate as 3 days after pickupDate
    const pDate = new Date(pickupDate);
    const dDate = new Date(pDate.getTime() + 3 * 24 * 60 * 60 * 1000);
    const year = dDate.getFullYear();
    const month = String(dDate.getMonth() + 1).padStart(2, '0');
    const dateVal = String(dDate.getDate()).padStart(2, '0');
    const computedDropDate = `${year}-${month}-${dateVal}`;

    setTimeout(() => {
      setLoading(false);
      onNavigate(`/rent-a-ride/${encodeURIComponent(destination)}?pickup=${pickupDate}T${pickupTime}&drop=${computedDropDate}T${pickupTime}&type=${vehicleType}&selfDrive=${selfDrive}${selectedLocality ? `&locality_id=${selectedLocality.id}` : ""}`);
    }, 1000);
  };

  return (
    <div className="space-y-6 text-black font-sans">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-900/60 p-4 rounded-2xl border border-slate-800/80">
        
        {/* Destination City */}
        <div className="space-y-1.5 relative">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Destination City</span>
          <input 
            type="text" 
            value={destination}
            placeholder="Enter destination city"
            onChange={(e) => {
              setDestination(e.target.value);
              setShowSuggestions(true);
              if (selectedLocality && selectedLocality.name !== e.target.value) {
                setSelectedLocality(null);
              }
            }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            className="w-full bg-[#0e1628] border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white font-bold outline-none"
          />
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute left-0 right-0 top-[65px] bg-white border-3 border-black rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] z-50 overflow-y-auto max-h-48 text-black font-sans">
              {suggestions.map((loc, idx) => (
                <button
                  key={idx}
                  type="button"
                  onMouseDown={() => {
                    setDestination(loc.name);
                    setSelectedLocality(loc);
                    setShowSuggestions(false);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-yellow-300 transition-colors font-bold text-xs border-b-2 border-black last:border-0 cursor-pointer"
                >
                  <span className="font-extrabold text-[12px]">{loc.name}</span>
                  <span className="text-[8px] bg-slate-900 text-white px-1.5 py-0.5 rounded ml-2 uppercase font-black">{loc.type}</span>
                  <div className="text-[9px] text-slate-500 font-bold mt-0.5">
                    {loc.district} District, {loc.state}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Pickup Date & Time */}
        <div className="space-y-1.5">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Pickup Date & Time</span>
          <div className="flex flex-col gap-1.5">
            <input 
              type="date" 
              value={pickupDate}
              onChange={(e) => setPickupDate(e.target.value)}
              className="w-full bg-[#0e1628] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-bold outline-none font-mono"
            />
            <input 
              type="time" 
              value={pickupTime}
              onChange={(e) => setPickupTime(e.target.value)}
              className="w-full bg-[#0e1628] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-bold outline-none font-mono"
            />
          </div>
        </div>

        {/* Vehicle Type */}
        <div className="space-y-1.5">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Vehicle Type</span>
          <select 
            value={vehicleType}
            onChange={(e) => setVehicleType(e.target.value)}
            className="w-full bg-[#0e1628] border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white font-bold outline-none"
          >
            <option value="Hatchback">Hatchback</option>
            <option value="Sedan">Sedan</option>
            <option value="SUV">SUV</option>
            <option value="Bike">Bike</option>
            <option value="EV">EV</option>
          </select>
        </div>

        {/* Self Drive vs With Driver Toggle */}
        <div className="space-y-1.5 flex flex-col justify-center">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Rental Mode</span>
          <div className="flex bg-[#0e1628] border border-slate-800 rounded-xl p-1">
            <button
              type="button"
              onClick={() => setSelfDrive(true)}
              className={`flex-1 text-center py-1.5 text-[10px] font-bold rounded-lg cursor-pointer transition-all border-none ${selfDrive ? 'bg-[var(--color-gold)] text-black' : 'text-slate-400 hover:text-white'}`}
            >
              Self Drive
            </button>
            <button
              type="button"
              disabled={vehicleType === "Bike"}
              onClick={() => setSelfDrive(false)}
              className={`flex-1 text-center py-1.5 text-[10px] font-bold rounded-lg cursor-pointer transition-all border-none ${!selfDrive ? 'bg-[var(--color-gold)] text-black' : 'text-slate-400 hover:text-white'} ${vehicleType === "Bike" ? "opacity-30 cursor-not-allowed" : ""}`}
            >
              Chauffeur
            </button>
          </div>
        </div>
      </div>

      {/* Doorstep Delivery Warning Banner for Non-Hub Localities */}
      {selectedLocality && !selectedLocality.has_rental_hub && (
        <div className="bg-amber-50 border-3 border-black p-4 rounded-xl flex items-start gap-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] text-slate-900 animate-scalein">
          <span className="text-xl">🚚</span>
          <div className="space-y-1 text-left">
            <h4 className="font-extrabold text-xs uppercase tracking-wider text-amber-800">Doorstep Delivery Zone</h4>
            <p className="text-xs font-bold leading-normal text-slate-800">
              Note: Vehicles will be delivered to <strong className="font-extrabold">{selectedLocality.name}</strong> from our closest hub in <strong className="font-extrabold">{selectedLocality.nearest_hub_name}</strong> (approx. {selectedLocality.nearest_hub_distance} km away).
            </p>
            <div className="text-[10px] text-slate-600 font-bold space-y-0.5">
              <div>• Doorstep delivery & pickup surcharge: <span className="font-mono font-black text-slate-900">₹{selectedLocality.delivery_fee_beyond_radius}</span>.</div>
              <div>• Lead time: will arrive in approx. <span className="font-black text-slate-900">{Math.ceil(selectedLocality.nearest_hub_distance / 15)} hours</span> from booking confirmation.</div>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-end pt-2 border-t border-slate-800/80">
        <button 
          onClick={handleSearch} 
          className="w-full bg-[var(--color-gold)] hover:bg-[#d6b35d] text-[var(--color-obsidian)] font-bold text-sm py-3 rounded-[var(--radius-card)] transition-all flex items-center justify-center gap-1.5 cursor-pointer uppercase tracking-wider border-none"
        >
          {loading ? "Searching Available Rides..." : "Search Rental Rides"}
        </button>
      </div>
    </div>
  );
}

function VehicleRentalCrossSell({ destinationCity, dateRange, tripId }: { destinationCity: string, dateRange?: { start?: string, end?: string }, tripId?: string }) {
  const [lowestPrice, setLowestPrice] = useState<number | null>(null);
  const [vehicleCount, setVehicleCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!destinationCity) return;
    setLoading(true);
    fetch(`${API_URL}/search?vertical=rent-a-ride&destination=${encodeURIComponent(destinationCity)}`)
      .then(res => res.json())
      .then(data => {
        setLoading(false);
        if (data && Array.isArray(data.results) && data.results.length > 0) {
          setVehicleCount(data.results.length);
          const prices = data.results.map((v: any) => v.price_per_day);
          setLowestPrice(Math.min(...prices));
        }
      })
      .catch(() => setLoading(false));
  }, [destinationCity]);

  if (loading || vehicleCount === 0 || !lowestPrice) return null;

  const handleAdd = () => {
    const start = dateRange?.start || "2026-12-15";
    const end = dateRange?.end || "2026-12-18";
    const linkStr = tripId ? `&linked_booking_reference=${tripId}` : "";
    const path = `/rent-a-ride/${encodeURIComponent(destinationCity)}?pickup=${start}T10:00&drop=${end}T10:00${linkStr}`;
    window.history.pushState(null, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  return (
    <div className="bg-[var(--color-surface)] border border-slate-800 rounded-[var(--radius-card)] p-4 shadow-lg flex flex-col md:flex-row justify-between items-center gap-4 text-left my-4 w-full">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-slate-900 border border-slate-800 rounded-lg flex items-center justify-center text-lg">
          🔑
        </div>
        <div>
          <h4 className="font-extrabold text-sm text-[var(--color-ivory)]">
            Renting a ride in {destinationCity}?
          </h4>
          <p className="text-xs text-[var(--color-ivory-dim)] font-medium mt-0.5">
            {vehicleCount} vehicles available from <span className="font-mono text-[var(--color-gold)] font-bold">₹{lowestPrice.toLocaleString()}</span>/day
          </p>
        </div>
      </div>
      <button
        onClick={handleAdd}
        className="w-full md:w-auto bg-[var(--color-gold)] hover:bg-[#d6b35d] text-[var(--color-obsidian)] font-bold text-xs px-4 py-2 rounded-lg cursor-pointer uppercase transition-all shadow hover:scale-105 border-none"
      >
        Add to trip
      </button>
    </div>
  );
}

interface RentARidePageProps {
  city: string;
  pickup: string;
  drop: string;
  initialType: string;
  initialSelfDrive: boolean;
  linkedBookingReference?: string;
  onNavigate: (path: string) => void;
  onBook: (data: any) => void;
  currency: string;
}

function RentARidePage({ city, pickup, drop, initialType, initialSelfDrive, linkedBookingReference, onNavigate, onBook, currency }: RentARidePageProps) {
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deliveryInfo, setDeliveryInfo] = useState<any | null>(null);
  const [notDeliverable, setNotDeliverable] = useState<any | null>(null);

  // Filters state
  const [selectedType, setSelectedType] = useState(initialType || "all");
  const [priceRange, setPriceRange] = useState(10000);
  const [transmission, setTransmission] = useState("all");
  const [fuelType, setFuelType] = useState("all");
  const [selfDrive, setSelfDrive] = useState(initialSelfDrive);
  const [instantConfirmOnly, setInstantConfirmOnly] = useState(false);
  const [sortBy, setSortBy] = useState("price_low_high");

  // Booking details popup modal
  const [selectedVehicle, setSelectedVehicle] = useState<any | null>(null);
  const [bookingStep, setBookingStep] = useState<"none" | "confirm" | "kyc" | "pickup">("none");
  const [kycDL, setKycDL] = useState("");
  const [kycID, setKycID] = useState("");
  const [deliveryMode, setDeliveryMode] = useState<"depot" | "doorstep">("depot");
  const [pickupAddress, setPickupAddress] = useState("Goa Airport Terminal");
  const [nearestHub, setNearestHub] = useState<any>(null);
  const [routingLoading, setRoutingLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams(window.location.search);
    const localityId = params.get("locality_id") || "";
    fetch(`${API_URL}/search?vertical=rent-a-ride&destination=${encodeURIComponent(city)}&locality_id=${localityId}&pickup=${encodeURIComponent(pickup)}&drop=${encodeURIComponent(drop)}`)
      .then(res => res.json())
      .then(data => {
        setLoading(false);
        if (data) {
          if (data.not_deliverable) {
            setNotDeliverable(data);
            setVehicles([]);
            setDeliveryInfo(null);
          } else {
            setNotDeliverable(null);
            setVehicles(data.results || []);
            setDeliveryInfo(data.delivery_info || null);
            if (data.delivery_info && data.delivery_info.delivery_required) {
              setDeliveryMode("doorstep");
              setPickupAddress(`${city} Doorstep Address`);
            }
          }
        }
      })
      .catch(() => setLoading(false));
  }, [city]);

  // Fetch routing hub details on address / mode change
  useEffect(() => {
    if (deliveryMode === "depot" && pickupAddress) {
      setRoutingLoading(true);
      fetch(`${API_URL}/rent-a-ride/routing?location=${encodeURIComponent(pickupAddress)}`)
        .then(res => res.json())
        .then(data => {
          setRoutingLoading(false);
          setNearestHub(data);
        })
        .catch(() => setRoutingLoading(false));
    } else {
      setNearestHub(null);
    }
  }, [deliveryMode, pickupAddress]);

  // Handle filter & sorting logic
  const filteredVehicles = vehicles
    .filter(v => {
      if (selectedType !== "all" && v.type.toLowerCase() !== selectedType.toLowerCase()) return false;
      if (v.price_per_day > priceRange) return false;
      if (transmission !== "all" && v.transmission.toLowerCase() !== transmission.toLowerCase()) return false;
      if (fuelType !== "all" && v.fuel_type.toLowerCase() !== fuelType.toLowerCase()) return false;
      if (selfDrive && !v.self_drive_available) return false;
      if (!selfDrive && !v.with_driver_available) return false;
      if (instantConfirmOnly && !v.instant_confirm) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "price_low_high") return a.price_per_day - b.price_per_day;
      if (sortBy === "distance") return a.distance_km - b.distance_km;
      if (sortBy === "rating") return b.rating - a.rating;
      return 0;
    });

  // Days count calculation
  const pDate = new Date(pickup.split("T")[0] || "2026-12-15");
  const dDate = new Date(drop.split("T")[0] || "2026-12-18");
  const daysDiff = Math.max(1, Math.ceil((dDate.getTime() - pDate.getTime()) / (1000 * 3600 * 24)));

  const handleStartBooking = (v: any) => {
    setSelectedVehicle(v);
    setBookingStep("confirm");
  };

  const handleConfirmStep = () => {
    if (selfDrive) {
      setBookingStep("kyc");
    } else {
      setBookingStep("pickup");
    }
  };

  const handleKycStep = () => {
    if (!kycDL || !kycID) {
      alert("Please upload your Driving License and National ID card numbers.");
      return;
    }
    setBookingStep("pickup");
  };

  const handleProceedToPayment = () => {
    if (!selectedVehicle) return;
    const isDelivery = deliveryMode === "doorstep";
    const deliveryFee = selectedVehicle.delivery_required ? selectedVehicle.delivery_fee : 0.0;
    const finalPrice = (selectedVehicle.price_per_day * daysDiff) + (isDelivery ? deliveryFee : 0.0);
    
    // Trigger hold order
    onBook({
      vertical: "rent-a-ride",
      amount: finalPrice,
      details: {
        city: city,
        pickup_time: pickup,
        drop_time: drop,
        vehicle_name: selectedVehicle.name,
        vehicle_type: selectedVehicle.type,
        self_drive: selfDrive,
        fuel_type: selectedVehicle.fuel_type,
        transmission: selectedVehicle.transmission,
        kyc_ref: selfDrive ? `${kycDL} | ${kycID}` : null,
        pickup_lat: isDelivery ? 15.4989 : (nearestHub ? nearestHub.latitude || 15.4989 : 15.4989),
        pickup_lng: isDelivery ? 73.8278 : (nearestHub ? nearestHub.longitude || 73.8278 : 73.8278),
        linked_booking_reference: linkedBookingReference || null,
        delivery_mode: isDelivery ? "Doorstep Delivery" : "Hub Depot Pickup",
        pickup_address: pickupAddress,
        delivery_fee: isDelivery ? deliveryFee : 0.0
      }
    });
  };

  return (
    <div className="flex-1 flex flex-col h-screen bg-[#070b19] overflow-hidden text-white font-sans">
      
      {/* HEADERBAR */}
      <header className="px-6 py-4 bg-[#0c1226] border-b border-slate-800 flex justify-between items-center z-10 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => onNavigate("/")} className="bg-transparent border-none text-slate-400 hover:text-white cursor-pointer text-lg font-bold">
            ← Back
          </button>
          <div>
            <h1 className="text-lg font-black tracking-wider uppercase">
              Rent a Ride: <span className="text-[var(--color-gold)]">{city}</span>
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Pickup: {pickup.replace("T", " ")} | Drop: {drop.replace("T", " ")} ({daysDiff} Days)
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {linkedBookingReference && (
            <span className="text-[10px] bg-indigo-955 border border-indigo-700 text-indigo-200 px-2 py-0.5 rounded font-bold uppercase">
              Bundled with Trip #{linkedBookingReference}
            </span>
          )}
        </div>
      </header>

      {/* CORE WORKSPACE */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* SIDEBAR FILTERS */}
        <aside className="w-80 border-r border-slate-800 bg-[#0a0f22] p-6 space-y-6 overflow-y-auto hidden md:block">
          <div className="flex justify-between items-center pb-2 border-b border-slate-800">
            <h3 className="font-extrabold text-xs uppercase tracking-wider">Filters</h3>
            <button 
              onClick={() => {
                setSelectedType("all");
                setPriceRange(10000);
                setTransmission("all");
                setFuelType("all");
                setSelfDrive(true);
                setInstantConfirmOnly(false);
              }}
              className="text-[10px] text-slate-400 hover:text-white font-bold bg-transparent border-none cursor-pointer hover:underline"
            >
              Reset All
            </button>
          </div>

          {/* Rental Mode */}
          <div className="space-y-2">
            <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Rental Mode</label>
            <div className="flex bg-[#070b19] border border-slate-800 rounded-lg p-0.5">
              <button onClick={() => setSelfDrive(true)} className={`flex-1 text-center py-1.5 text-xs font-bold rounded-md border-none cursor-pointer transition-all ${selfDrive ? "bg-[var(--color-gold)] text-black" : "text-slate-400 hover:text-white"}`}>Self Drive</button>
              <button onClick={() => setSelfDrive(false)} className={`flex-1 text-center py-1.5 text-xs font-bold rounded-md border-none cursor-pointer transition-all ${!selfDrive ? "bg-[var(--color-gold)] text-black" : "text-slate-400 hover:text-white"}`}>With Driver</button>
            </div>
          </div>

          {/* Vehicle Type */}
          <div className="space-y-2">
            <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Vehicle Type</label>
            <select value={selectedType} onChange={(e) => setSelectedType(e.target.value)} className="w-full bg-[#070b19] border border-slate-800 rounded-lg p-2 text-xs font-bold text-white outline-none">
              <option value="all">All Vehicle Types</option>
              <option value="Hatchback">Hatchback</option>
              <option value="Sedan">Sedan</option>
              <option value="SUV">SUV</option>
              <option value="Bike">Bike</option>
              <option value="EV">EV (Electric)</option>
            </select>
          </div>

          {/* Price Cap */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
              <span>Max Price Per Day</span>
              <span className="font-mono text-white">₹{priceRange.toLocaleString()}</span>
            </div>
            <input type="range" min="500" max="10000" step="500" value={priceRange} onChange={(e) => setPriceRange(Number(e.target.value))} className="w-full accent-[var(--color-gold)] cursor-pointer" />
          </div>

          {/* Transmission */}
          <div className="space-y-2">
            <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Transmission</label>
            <div className="flex gap-2">
              {["all", "automatic", "manual"].map((trans) => (
                <button key={trans} onClick={() => setTransmission(trans)} className={`flex-1 py-1.5 text-center text-xs font-extrabold border-2 rounded-lg cursor-pointer transition-all ${transmission === trans ? "bg-white text-black border-white" : "border-slate-800 text-slate-400 hover:border-slate-700 hover:text-white bg-transparent"}`}>
                  {trans.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Fuel Type */}
          <div className="space-y-2">
            <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Fuel Type</label>
            <select value={fuelType} onChange={(e) => setFuelType(e.target.value)} className="w-full bg-[#070b19] border border-slate-800 rounded-lg p-2 text-xs font-bold text-white outline-none">
              <option value="all">All Fuels</option>
              <option value="Petrol">Petrol</option>
              <option value="Diesel">Diesel</option>
              <option value="EV">Electric (EV)</option>
            </select>
          </div>

          {/* Instant Confirm Toggle */}
          <div className="flex items-center justify-between py-2 border-t border-slate-800">
            <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider cursor-pointer" htmlFor="instant_confirm">Instant Confirmation</label>
            <input type="checkbox" id="instant_confirm" checked={instantConfirmOnly} onChange={(e) => setInstantConfirmOnly(e.target.checked)} className="accent-[var(--color-gold)] cursor-pointer w-4 h-4" />
          </div>
        </aside>

        {/* LISTING SECTION */}
        <main className="flex-1 p-6 overflow-y-auto space-y-4">
          <div className="flex justify-between items-center pb-4 border-b border-slate-800/80">
            <span className="text-xs text-slate-400 font-bold">{filteredVehicles.length} rides found in {city}</span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-bold text-slate-400">Sort By:</span>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="bg-slate-900 border border-slate-800 text-xs font-bold text-slate-200 p-1.5 rounded outline-none">
                <option value="price_low_high">Price: Low to High</option>
                <option value="distance">Nearest Depot</option>
                <option value="rating">Top Rated</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl h-48 animate-pulse flex justify-between">
                  <div className="w-1/3 bg-slate-800 rounded-xl"></div>
                  <div className="w-1/2 bg-slate-800/50 rounded-xl"></div>
                </div>
              ))}
            </div>
          ) : notDeliverable ? (
            <div className="text-center py-20 bg-slate-900/20 border border-slate-800 rounded-3xl p-8 space-y-4 max-w-xl mx-auto mt-6">
              <span className="text-5xl block mb-2">📍</span>
              <h3 className="font-extrabold text-red-400 uppercase text-sm tracking-wider">Not Deliverable to Location</h3>
              <p className="text-xs text-slate-300 font-bold leading-relaxed">
                We're sorry! The locality <strong className="text-white font-extrabold">{city}</strong> is currently outside our maximum doorstep delivery range of {notDeliverable.max_radius_km} km.
              </p>
              <div className="bg-[#121c33] p-4 rounded-xl border border-slate-800 text-left space-y-1.5 max-w-md mx-auto text-xs font-semibold">
                <p className="text-[var(--color-gold)] font-extrabold uppercase tracking-wide text-[10px]">Nearest Available Pickup Hub</p>
                <p className="text-white font-extrabold text-sm">🏬 {notDeliverable.nearest_hub_name} Hub</p>
                <p className="text-slate-400 font-bold">Distance from requested location: <span className="text-white font-black">{notDeliverable.distance_km} km</span></p>
                <p className="text-slate-500 font-medium italic mt-2 text-[10px] leading-relaxed">
                  * You can proceed by searching directly for '{notDeliverable.nearest_hub_name}' in the category bar to arrange self-pickup.
                </p>
              </div>
            </div>
          ) : filteredVehicles.length === 0 ? (
            <div className="text-center py-20 bg-slate-900/20 border border-slate-800 rounded-3xl">
              <span className="text-4xl block mb-2">🚗</span>
              <h3 className="font-extrabold text-slate-400 uppercase text-sm tracking-wider">No Matching Rides Available</h3>
              <p className="text-xs text-slate-500 mt-1">Try resetting filters or changing dates.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filteredVehicles.map((vh, vhIdx) => (
                <div key={vh.id || vhIdx} className="bg-[#0f152b] border border-slate-800 hover:border-slate-700 p-5 rounded-3xl transition-all flex flex-col md:flex-row justify-between gap-6 shadow-md relative">
                  {vhIdx === 0 && (
                    <div className="absolute -top-2 left-4 bg-gradient-to-r from-emerald-500 to-teal-400 text-[9px] text-white font-black px-2.5 py-0.5 rounded-full shadow-lg shadow-emerald-500/20 animate-pulse z-10">🏆 BEST PRICE</div>
                  )}
                  
                  {/* Left: Thumbnail & Badges */}
                  <div className="flex gap-5 flex-1 items-start text-left">
                    <img src={vh.image_url} alt={vh.name} className="w-36 h-24 object-cover rounded-2xl border border-slate-800 shadow-inner bg-slate-900 shrink-0" />
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] bg-slate-800 text-white font-extrabold px-1.5 py-0.5 rounded tracking-wide uppercase border border-slate-700">
                          {vh.type}
                        </span>
                        {vh.instant_confirm && (
                          <span className="text-[8px] bg-emerald-950 text-emerald-300 font-extrabold px-1.5 py-0.5 rounded border border-emerald-800 uppercase">
                            ⚡ Instant
                          </span>
                        )}
                        {vh.surge_active && (
                          <span className="text-[8px] bg-amber-950 text-amber-300 font-extrabold px-1.5 py-0.5 rounded border border-amber-800 uppercase animate-pulse">
                            ⚠️ Surge
                          </span>
                        )}
                        {vh.provider_name && (
                          <span className="text-[9px] bg-purple-900/40 text-purple-300 px-1.5 py-0.5 rounded border border-purple-500/20">
                            via {vh.provider_name}
                          </span>
                        )}
                      </div>
                      <h3 className="font-black text-lg text-slate-200">{vh.name}</h3>
                      <div className="flex gap-4 text-xs text-slate-400 font-semibold">
                        <span>⛽ {vh.fuel_type}</span>
                        <span>⚙️ {vh.transmission}</span>
                        <span>👥 {vh.seating_capacity} Seats</span>
                        <span>📍 {vh.distance_km} km away</span>
                      </div>
                      {vh.delivery_required ? (
                        <p className="text-[10px] text-amber-400 font-extrabold flex items-center gap-1">
                          <span>🚚 Doorstep delivery in approx. {vh.delivery_eta_hours} hours from nearest hub ({vh.nearest_hub_name})</span>
                        </p>
                      ) : (
                        vh.surge_badge && (
                          <p className="text-[10px] text-amber-400 font-bold flex items-center gap-1">
                            ✨ {vh.surge_badge}
                          </p>
                        )
                      )}
                    </div>
                  </div>

                  {/* Right: Pricing & CTA */}
                  <div className="flex flex-col justify-between items-end text-right shrink-0">
                    <div className="space-y-1">
                      <div className="text-2xl font-black text-slate-100 font-mono">
                        ₹{vh.price_per_day.toLocaleString()}
                        <span className="text-xs text-slate-500 font-normal"> /day</span>
                      </div>
                      {vh.delivery_required ? (
                        <div className="text-[10px] text-slate-400 font-bold space-y-0.5 mt-1 text-right">
                          <p>Vehicle: ₹{(vh.price_per_day * daysDiff).toLocaleString()} ({daysDiff} days)</p>
                          <p>Delivery: +₹{vh.delivery_fee.toLocaleString()}</p>
                          <p className="text-emerald-400 font-black text-xs mt-0.5">
                            Total: ₹{(vh.price_per_day * daysDiff + vh.delivery_fee).toLocaleString()}
                          </p>
                        </div>
                      ) : (
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1">
                          Total: ₹{(vh.price_per_day * daysDiff).toLocaleString()}
                        </p>
                      )}
                    </div>

                    <button 
                      onClick={() => handleStartBooking(vh)}
                      className="w-full md:w-40 bg-[var(--color-gold)] hover:bg-[#d6b35d] text-[var(--color-obsidian)] font-black text-xs py-2.5 rounded-xl uppercase tracking-wider cursor-pointer border-none transition-all shadow hover:scale-105 active:scale-95"
                    >
                      Reserve Ride
                    </button>
                  </div>

                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      {/* POPUP MODAL CHECKOUT FLOW */}
      {bookingStep !== "none" && selectedVehicle && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-[#0c1226] border-3 border-black p-6 rounded-3xl shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] text-black font-sans relative">
            
            {/* Close Button */}
            <button 
              onClick={() => setBookingStep("none")} 
              className="absolute top-4 right-4 bg-transparent border-none text-slate-400 hover:text-white cursor-pointer font-bold text-sm"
            >
              ✕
            </button>

            {/* Modal Title */}
            <div className="pb-3 border-b border-slate-800 mb-4 text-left">
              <span className="text-[9px] bg-[var(--color-gold)] text-black px-1.5 py-0.5 rounded font-black uppercase inline-block mb-1.5">
                Rental Checkout
              </span>
              <h3 className="font-black text-base text-white">
                {bookingStep === "confirm" && "1. Confirm Reservation Details"}
                {bookingStep === "kyc" && "2. Identity Verification (KYC)"}
                {bookingStep === "pickup" && "3. Depot Selection"}
              </h3>
            </div>

            {/* Step Content */}
            <div className="space-y-4 text-left text-white">
              {bookingStep === "confirm" && (
                <div className="space-y-3">
                  <div className="bg-[#121c33] p-3 rounded-xl border border-slate-800 space-y-1">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Vehicle Selected</p>
                    <h4 className="font-extrabold text-sm text-slate-200">{selectedVehicle.name}</h4>
                    <p className="text-xs text-slate-400">
                      {selectedVehicle.type} • {selectedVehicle.fuel_type} • {selectedVehicle.transmission}
                    </p>
                  </div>
                  <div className="bg-[#121c33] p-3 rounded-xl border border-slate-800 space-y-2 text-left">
                    <div className="flex justify-between text-xs font-semibold">
                      <span>Daily Rental Rate:</span>
                      <span className="font-mono text-[var(--color-gold)]">₹{selectedVehicle.price_per_day.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-xs font-semibold">
                      <span>Duration:</span>
                      <span>{daysDiff} Days</span>
                    </div>
                    {selectedVehicle.delivery_required && (
                      <div className="flex justify-between text-xs font-semibold text-amber-400">
                        <span>Doorstep Delivery Fee:</span>
                        <span className="font-mono">+₹{selectedVehicle.delivery_fee.toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-xs font-extrabold border-t border-slate-800 pt-2 text-slate-200">
                      <span>Grand Total:</span>
                      <span className="font-mono text-emerald-400 text-sm">
                        ₹{(selectedVehicle.price_per_day * daysDiff + (selectedVehicle.delivery_required ? selectedVehicle.delivery_fee : 0.0)).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <button 
                    onClick={handleConfirmStep}
                    className="w-full bg-[var(--color-gold)] text-slate-900 border-none font-black py-2.5 rounded-xl uppercase text-xs tracking-wider cursor-pointer mt-2"
                  >
                    Proceed to {selfDrive ? "KYC Verification" : "Depot Selector"} →
                  </button>
                </div>
              )}

              {bookingStep === "kyc" && (
                <div className="space-y-3 text-left">
                  <p className="text-xs text-slate-300 font-semibold text-left">
                    Self-drive rentals require valid driving license credentials to unlock confirmation.
                  </p>
                  <div className="space-y-1.5 text-left">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block text-left">Driving License Number</span>
                    <input 
                      type="text" 
                      placeholder="e.g. DL-1420110012345"
                      value={kycDL}
                      onChange={(e) => setKycDL(e.target.value)}
                      className="w-full bg-[#121c33] border border-slate-800 rounded-xl px-3 py-2 text-sm text-white outline-none font-mono"
                    />
                  </div>
                  <div className="space-y-1.5 text-left">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block text-left">National Identification ID</span>
                    <input 
                      type="text" 
                      placeholder="e.g. Aadhaar / PAN Number"
                      value={kycID}
                      onChange={(e) => setKycID(e.target.value)}
                      className="w-full bg-[#121c33] border border-slate-800 rounded-xl px-3 py-2 text-sm text-white outline-none font-mono"
                    />
                  </div>
                  <button 
                    onClick={handleKycStep}
                    className="w-full bg-[var(--color-gold)] text-slate-900 border-none font-black py-2.5 rounded-xl uppercase text-xs tracking-wider cursor-pointer mt-2"
                  >
                    Validate & Proceed →
                  </button>
                </div>
              )}

              {bookingStep === "pickup" && (
                <div className="space-y-3 text-left">
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block text-left">Pickup Type</label>
                  <div className="flex bg-slate-900 border border-slate-800 rounded-lg p-0.5">
                    <button 
                      type="button"
                      disabled={selectedVehicle.delivery_required}
                      onClick={() => setDeliveryMode("depot")} 
                      className={`flex-1 py-1.5 text-xs font-bold rounded border-none cursor-pointer ${deliveryMode === "depot" ? "bg-[var(--color-gold)] text-black" : "text-slate-400"} ${selectedVehicle.delivery_required ? "opacity-35 cursor-not-allowed" : ""}`}
                    >
                      Depot pickup
                    </button>
                    <button 
                      type="button"
                      onClick={() => setDeliveryMode("doorstep")} 
                      className={`flex-1 py-1.5 text-xs font-bold rounded border-none cursor-pointer ${deliveryMode === "doorstep" ? "bg-[var(--color-gold)] text-black" : "text-slate-400"}`}
                    >
                      Doorstep delivery
                    </button>
                  </div>

                  {selectedVehicle.delivery_required && (
                    <div className="bg-amber-955/40 border border-amber-800/80 p-2.5 rounded-xl text-[10px] text-amber-300 font-bold leading-normal text-left">
                      ℹ️ Direct depot self-pickup is unavailable for this location. Doorstep delivery is required from our nearest hub in <span className="underline font-black">{selectedVehicle.nearest_hub_name}</span>.
                    </div>
                  )}

                  {deliveryMode === "depot" ? (
                    <div className="space-y-2 text-left">
                      <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block text-left">Select Hub Depot</label>
                      <select value={pickupAddress} onChange={(e) => setPickupAddress(e.target.value)} className="w-full bg-[#121c33] border border-slate-800 rounded-xl p-2 text-xs font-bold text-white outline-none">
                        <option value="Goa Airport Terminal">Airport Arrival Terminal Depot</option>
                        <option value="Madgaon Station Junction">Madgaon Railway Station Outlet</option>
                        <option value="Panaji Downtown Hub">Panaji Downtown Premium Center</option>
                      </select>
                      
                      {routingLoading ? (
                        <p className="text-[10px] text-slate-400 animate-pulse font-semibold">Computing route to depot...</p>
                      ) : nearestHub ? (
                        <div className="bg-[#121c33] p-3 rounded-xl border border-slate-800 text-[11px] text-slate-300 space-y-1 text-left">
                          <p className="font-extrabold text-[var(--color-gold)]">📍 Hub: {nearestHub.hub_name}</p>
                          <p className="font-medium">Distance from arrival center: {nearestHub.distance_km} km</p>
                          <p className="text-slate-400">Address: {nearestHub.address}</p>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="space-y-2 text-left">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block text-left">Doorstep Address</span>
                      <input 
                        type="text" 
                        placeholder="Enter your hotel / homestay / delivery address"
                        value={pickupAddress === "Goa Airport Terminal" ? "" : pickupAddress}
                        onChange={(e) => setPickupAddress(e.target.value)}
                        className="w-full bg-[#121c33] border border-slate-800 rounded-xl px-3 py-2 text-sm text-white outline-none font-bold"
                      />
                      <div className="bg-[#0b1021] border border-slate-800 rounded-xl p-2.5 text-[10px] space-y-1 text-left">
                        <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wide block text-left">📍 Geolocation Coordinates</span>
                        <div className="flex gap-4 font-mono text-slate-300 font-bold">
                          <span>Lat: 15.4989° N</span>
                          <span>Lng: 73.8278° E</span>
                        </div>
                        <span className="text-[9px] text-emerald-400 font-extrabold block text-left">✓ Pin dropped successfully at delivery location</span>
                      </div>
                    </div>
                  )}

                  <button 
                    onClick={handleProceedToPayment}
                    className="w-full bg-emerald-500 hover:bg-emerald-600 text-white border-none font-black py-3 rounded-xl uppercase text-xs tracking-wider cursor-pointer mt-2 shadow"
                  >
                    Proceed to Payment (Razorpay) →
                  </button>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

function ActiveRentalManager({ bookingReference, fetchTrips, setSelectedTrip }: { bookingReference: string, fetchTrips: () => void, setSelectedTrip: (trip: any) => void }) {
  const [telemetry, setTelemetry] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Chatbot support states
  const [chatMessage, setChatMessage] = useState("");
  const [chatResponses, setChatResponses] = useState<string[]>([]);
  const [chatLoading, setChatLoading] = useState(false);

  // Extension states
  const [extendDays, setExtendDays] = useState(1);
  const [extending, setExtending] = useState(false);

  // Emergency states
  const [emergencyIssue, setEmergencyIssue] = useState("");
  const [emergencyReported, setEmergencyReported] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`${API_URL}/rent-a-ride/telemetry/${bookingReference}`)
      .then(res => res.json())
      .then(data => {
        setTelemetry(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [bookingReference]);

  const handleSendChat = () => {
    if (!chatMessage.trim()) return;
    setChatLoading(true);
    fetch(`${API_URL}/rent-a-ride/support-chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ booking_reference: bookingReference, message: chatMessage })
    })
      .then(res => res.json())
      .then(data => {
        setChatLoading(false);
        setChatResponses([...chatResponses, `You: ${chatMessage}`, `Support RAG: ${data.response}`]);
        setChatMessage("");
      })
      .catch(() => setChatLoading(false));
  };

  const handleExtendRental = () => {
    setExtending(true);
    fetch(`${API_URL}/rent-a-ride/extend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ booking_reference: bookingReference, additional_days: extendDays })
    })
      .then(res => res.json())
      .then(data => {
        setExtending(false);
        alert(data.message || `Rental extended successfully!`);
        fetchTrips();
        setSelectedTrip(null);
      })
      .catch(() => setExtending(false));
  };

  const handleEmergency = () => {
    if (!emergencyIssue.trim()) {
      alert("Please state the nature of emergency.");
      return;
    }
    fetch(`${API_URL}/rent-a-ride/emergency`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ booking_reference: bookingReference, issue_type: "Breakdown/Accident", details: emergencyIssue })
    })
      .then(res => res.json())
      .then(data => {
        setEmergencyReported(true);
        alert(data.message || `Priority emergency ticket raised!`);
      })
      .catch(() => {});
  };

  const handleSimulateReturn = () => {
    fetch(`${API_URL}/rent-a-ride/transition?booking_reference=${bookingReference}&status=returned`, { method: "POST" })
      .then(res => res.json())
      .then(data => {
        alert("Vehicle returned successfully! Thank you for using Rent a Ride.");
        fetchTrips();
        setSelectedTrip(null);
      });
  };

  if (loading) return <div className="text-center py-4 text-xs animate-pulse text-white">Loading telemetry data...</div>;

  return (
    <div className="border-3 border-black p-4 rounded-2xl bg-[#090f22] text-white space-y-4 text-left shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] max-h-[500px] overflow-y-auto">
      
      {/* Telemetry Indicator */}
      {telemetry && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[#121c33] p-3 rounded-xl border border-slate-800">
            <span className="text-[9px] text-slate-400 font-bold uppercase block">Vehicle Power</span>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xl">🔋</span>
              <span className="text-sm font-black font-mono">{telemetry.level}%</span>
            </div>
            <p className="text-[9px] text-slate-400 mt-1 font-semibold">{telemetry.type === "EV" ? "Electric Battery" : "Petrol Fuel"}</p>
          </div>
          <div className="bg-[#121c33] p-3 rounded-xl border border-slate-800">
            <span className="text-[9px] text-slate-400 font-bold uppercase block">Nearest Station</span>
            <p className="text-[11px] font-extrabold mt-1 text-[var(--color-gold)] leading-tight">{telemetry.nearest_point}</p>
          </div>
        </div>
      )}

      {/* Obsidian Dark Map Vector Theme */}
      <div className="border-2 border-black rounded-xl h-36 bg-[#070b19] overflow-hidden relative shadow-inner">
        <span className="absolute top-2 left-2 text-[9px] bg-slate-900/80 border border-slate-700 text-slate-300 font-black px-1.5 py-0.5 rounded uppercase">
          GPS Route Map
        </span>
        {/* Obsidian dark style map vectors */}
        <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] opacity-40"></div>
        
        {/* Draw path & car icon */}
        <svg className="absolute inset-0 w-full h-full text-slate-700" xmlns="http://www.w3.org/2000/svg">
          <path d="M 30,100 C 60,60 120,80 180,40 C 230,20 280,60 330,20" fill="none" stroke="currentColor" strokeWidth="4" strokeDasharray="6" />
          <path d="M 30,100 C 60,60 120,80 180,40 C 230,20 280,60 330,20" fill="none" stroke="#e0af43" strokeWidth="2" />
        </svg>

        {/* Live moving dots */}
        <div className="absolute left-[30px] top-[95px] w-2 h-2 rounded-full bg-red-500 border border-black flex items-center justify-center"><span className="text-[5px]">A</span></div>
        <div className="absolute left-[180px] top-[35px] w-4 h-4 rounded-full bg-yellow-400 border border-black flex items-center justify-center text-[10px] animate-bounce">🚗</div>
        <div className="absolute left-[325px] top-[15px] w-2 h-2 rounded-full bg-emerald-500 border border-black flex items-center justify-center"><span className="text-[5px]">B</span></div>

        <div className="absolute bottom-2 right-2 text-[8px] bg-black/60 text-slate-300 font-mono px-1 rounded">
          ACTIVE SPEED: 65 km/h (Limit: 80)
        </div>
      </div>

      {/* Quick Action: Extend Rental */}
      <div className="bg-[#121c33] p-3 rounded-xl border border-slate-800 space-y-2">
        <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Quick Extend Rental</label>
        <div className="flex gap-2">
          <input 
            type="number" 
            min="1" 
            max="7" 
            value={extendDays} 
            onChange={(e) => setExtendDays(Number(e.target.value))}
            className="w-16 bg-[#070b19] border border-slate-800 rounded px-2 text-xs text-white outline-none font-bold"
          />
          <button 
            onClick={handleExtendRental}
            disabled={extending}
            className="flex-1 bg-[var(--color-gold)] text-black border-none font-black py-1.5 rounded text-xs uppercase cursor-pointer transition-all"
          >
            {extending ? "Processing..." : "Extend Booking"}
          </button>
        </div>
      </div>

      {/* Support Chat bot */}
      <div className="bg-[#121c33] p-3 rounded-xl border border-slate-800 space-y-2">
        <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Ask Vehicle AI Support Bot</label>
        <div className="max-h-24 overflow-y-auto space-y-1.5 text-[10px] bg-slate-950 p-2 rounded border border-slate-900">
          {chatResponses.length === 0 ? (
            <p className="text-slate-500 italic">How can I assist you with deposit, license, fuel or comprehensive insurance policies?</p>
          ) : (
            chatResponses.map((r, i) => (
              <p key={i} className={r.startsWith("You:") ? "text-yellow-400" : "text-slate-200"}>{r}</p>
            ))
          )}
        </div>
        <div className="flex gap-2">
          <input 
            type="text" 
            placeholder="Type support question..."
            value={chatMessage} 
            onChange={(e) => setChatMessage(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSendChat(); }}
            className="flex-1 bg-[#070b19] border border-slate-800 rounded px-2.5 py-1 text-xs text-white outline-none"
          />
          <button 
            onClick={handleSendChat}
            disabled={chatLoading}
            className="bg-blue-600 hover:bg-blue-500 border-none text-white font-black px-3 py-1 rounded text-xs uppercase cursor-pointer"
          >
            Send
          </button>
        </div>
      </div>

      {/* Emergency Response Panel */}
      <div className="bg-red-955/40 p-3 rounded-xl border border-red-900 space-y-2">
        <label className="text-[10px] text-red-400 font-bold uppercase tracking-wider block">⚠️ Emergency Roadside Assistance</label>
        {emergencyReported ? (
          <p className="text-xs text-green-400 font-bold">Priority emergency ticket raised. Support dispatch team is calling you now.</p>
        ) : (
          <div className="flex gap-2">
            <input 
              type="text" 
              placeholder="State breakdown / accident details..."
              value={emergencyIssue}
              onChange={(e) => setEmergencyIssue(e.target.value)}
              className="flex-1 bg-red-955/60 border border-red-800 rounded px-2 py-1 text-xs text-white outline-none placeholder:text-red-400"
            />
            <button 
              onClick={handleEmergency}
              className="bg-red-600 hover:bg-red-700 border-none text-white font-black px-3 py-1 rounded text-xs uppercase cursor-pointer"
            >
              Raise SOS
            </button>
          </div>
        )}
      </div>

      {/* End Trip button */}
      <button 
        onClick={handleSimulateReturn}
        className="w-full bg-slate-100 hover:bg-white text-slate-900 border-2 border-black font-black py-2.5 rounded-xl uppercase text-xs tracking-wider cursor-pointer"
      >
        🏁 Complete & Return Ride
      </button>

    </div>
  );
}


function LoginScreen({ onLogin }: { onLogin: (token: string, refreshToken: string, role: string, email: string) => void }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || (isSignUp && (!fullName || !phone))) {
      setErrorMsg("Please fill in all mandatory fields.");
      return;
    }
    setErrorMsg("");
    setLoading(true);

    try {
      if (isSignUp) {
        // Sign Up
        const signupResp = await fetch(`${API_URL}/auth/signup`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            full_name: fullName,
            email, 
            password, 
            phone 
          })
        });
        const signupData = await signupResp.json();
        if (!signupResp.ok) {
          throw new Error(signupData.detail || "Sign up failed");
        }
      }

      // Login
      const details = {
        'username': email,
        'password': password
      };
      
      const formBody = Object.keys(details)
        .map(key => encodeURIComponent(key) + '=' + encodeURIComponent((details as any)[key]))
        .join('&');

      const loginResp = await fetch(`${API_URL}/auth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formBody
      });
      const loginData = await loginResp.json();
      if (!loginResp.ok) {
        throw new Error(loginData.detail || "Login failed");
      }

      const accessToken = loginData.access_token;
      const decoded = decodeJwt(accessToken);
      if (!decoded) {
        throw new Error("Could not parse login token.");
      }

      onLogin(accessToken, loginData.refresh_token, decoded.role || "user", decoded.sub || email);
    } catch (err: any) {
      setErrorMsg(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-[var(--color-obsidian)] p-4 z-50 overflow-y-auto">
      <div className="absolute inset-0 bg-[radial-gradient(#d4af37_1px,transparent_1px)] [background-size:24px_24px] opacity-10" />
      
      <div className="bg-white text-black border-4 border-black p-8 max-w-md w-full relative z-10 shadow-[8px_8px_0px_0px_#000000] rounded-[24px]">
        <div className="text-center mb-6">
          <span className="font-serif italic font-black text-2xl text-[var(--color-gold)] bg-black px-4 py-1.5 inline-block text-white shadow-[4px_4px_0px_0px_rgba(212,175,55,1)]">
            TRAVEL OS
          </span>
          <h2 className="text-xl font-extrabold uppercase mt-6 tracking-wide">
            {isSignUp ? "Create Secure Account" : "Secure System Initialize"}
          </h2>
          <p className="text-xs text-slate-500 font-bold uppercase mt-1">
            {isSignUp ? "Join the premium travel network" : "Enter credentials to access travel desk"}
          </p>
        </div>

        {errorMsg && (
          <div className="bg-red-50 border-2 border-red-600 p-3 text-red-600 font-black text-xs uppercase text-left rounded-lg shadow-[2px_2px_0px_0px_#000000] mb-4">
            ⚠️ {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-left">
          {isSignUp && (
            <div>
              <label className="text-[10px] uppercase font-black text-slate-600 block mb-1">Full Legal Name</label>
              <input 
                type="text" 
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="John Doe"
                className="w-full bg-slate-50 border-3 border-black p-2.5 text-xs font-black placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-0 rounded-lg shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
              />
            </div>
          )}

          <div>
            <label className="text-[10px] uppercase font-black text-slate-600 block mb-1">Email Desk Authority</label>
            <input 
              type="email" 
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              className="w-full bg-slate-50 border-3 border-black p-2.5 text-xs font-black placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-0 rounded-lg shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
            />
          </div>

          <div>
            <label className="text-[10px] uppercase font-black text-slate-600 block mb-1">Access Password</label>
            <input 
              type="password" 
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-slate-50 border-3 border-black p-2.5 text-xs font-black placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-0 rounded-lg shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
            />
          </div>

          {isSignUp && (
            <div>
              <label className="text-[10px] uppercase font-black text-slate-600 block mb-1">Phone Contact</label>
              <input 
                type="tel" 
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full bg-slate-50 border-3 border-black p-2.5 text-xs font-black placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-0 rounded-lg shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
              />
            </div>
          )}

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-yellow-300 hover:bg-yellow-400 text-black font-black uppercase text-xs p-3.5 border-3 border-black rounded-lg shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all flex items-center justify-center gap-2 cursor-pointer mt-4"
          >
            {loading ? "PROCESSING KEY EXCHANGE..." : isSignUp ? "PROCEED SIGNUP" : "INITIALIZE SESSION"}
          </button>
        </form>

        <div className="text-center mt-6 pt-4 border-t-2 border-black/10">
          <button 
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setErrorMsg("");
            }} 
            className="text-[10px] uppercase font-extrabold text-blue-600 hover:underline cursor-pointer"
          >
            {isSignUp ? "Already registered? Login here ➔" : "Need credentials? Register here ➔"}
          </button>
        </div>
      </div>
    </div>
  );
}
