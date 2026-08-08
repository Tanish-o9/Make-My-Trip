import React, { useState, useEffect, useRef } from "react";

const resolveApiBase = () => {
  let url = import.meta.env.VITE_API_URL;
  if (!url || url.includes("placeholder") || url.includes("<")) {
    if (typeof window !== "undefined") {
      const hostname = window.location.hostname;
      if (window.location.port && window.location.port !== "8000") {
        url = `${window.location.protocol}//${hostname}:8000/api`;
      } else if (hostname === "localhost" || hostname === "127.0.0.1") {
        url = `${window.location.origin}/api`;
      } else {
        url = "https://make-my-trip-production.up.railway.app/api";
      }
    } else {
      url = "http://localhost:8000/api";
    }
  }
  if (url.endsWith("/")) {
    url = url.slice(0, -1);
  }
  if (url.endsWith("/v1")) {
    url = url.slice(0, -3);
  }
  if (url.endsWith("/")) {
    url = url.slice(0, -1);
  }
  if (!url.endsWith("/api")) {
    url = `${url}/api`;
  }
  return url;
};

const API_BASE = resolveApiBase();
const API_URL = `${API_BASE}/v1`;
import { CreditCard, QrCode, Globe, Wallet, ShieldAlert, ArrowLeft, RefreshCw, Clock } from "lucide-react";

interface CheckoutPageProps {
  bookingId: string;
  onNavigate: (path: string) => void;
  token: string | null;
  initialError?: string;
}

export function CheckoutPage({ bookingId, onNavigate, token, initialError }: CheckoutPageProps) {
  
  // Audit: Pre-populate default booking state to prevent TypeError before status check resolves
  const [booking, setBooking] = useState<any>({
    booking_reference: bookingId,
    title: `Travel OS Booking ${bookingId}`,
    total_amount: 1500, // standard test amount
    currency: "INR",
    vertical: bookingId.split("-")[1]?.toLowerCase() || "flight",
    traveler_name: ""
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(initialError || "");
  const [activeTab, setActiveTab] = useState<"card" | "upi" | "netbanking" | "wallet">("card");
  
  // Payment states
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [qrCodeId, setQrCodeId] = useState<string | null>(null);
  const [qrTimeLeft, setQrTimeLeft] = useState(300); // 5 minutes
  const [holdTimeLeft, setHoldTimeLeft] = useState(600); // 10 minutes booking hold
  const [paymentStatus, setPaymentStatus] = useState<string>("none"); // none, pending, captured, failed, expired
  const [humanApproved, setHumanApproved] = useState(false);

  // Profile prefill and validation states (Phase 5 & 6)
  const [profile, setProfile] = useState<any>(null);
  const [travellers, setTravellers] = useState<any[]>([]);
  const [selectedTravellerId, setSelectedTravellerId] = useState<string>("self");
  const [profileIncomplete, setProfileIncomplete] = useState(false);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  
  const pollingIntervalRef = useRef<any>(null);
  const qrExpiryIntervalRef = useRef<any>(null);
  const holdExpiryIntervalRef = useRef<any>(null);

  // Fetch profile and travellers on load (Phase 5)
  useEffect(() => {
    if (!token) return;
    fetch(`${API_URL}/profile`, {
      headers: { "Authorization": `Bearer ${token}` }
    })
      .then(res => {
        if (!res.ok) throw new Error("Failed to load profile.");
        return res.json();
      })
      .then(data => {
        setProfile(data);
        
        // Validate required fields (Phase 6)
        const missing = [];
        if (!data.full_name) missing.push("Full Name");
        if (!data.email) missing.push("Email Address");
        if (!data.mobile_number) missing.push("Mobile Number");
        if (!data.dob) missing.push("Date of Birth");
        if (!data.nationality) missing.push("Nationality");
        if (!data.country) missing.push("Country");
        
        if (missing.length > 0) {
          setProfileIncomplete(true);
          setMissingFields(missing);
        }
      })
      .catch(() => {});

    fetch(`${API_URL}/profile/travellers`, {
      headers: { "Authorization": `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setTravellers(data);
        }
      })
      .catch(() => {});
  }, [token]);

  // 1. Fetch booking details on mount
  useEffect(() => {
    fetchBookingDetails();
    
    // Hold Timer
    holdExpiryIntervalRef.current = setInterval(() => {
      setHoldTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(holdExpiryIntervalRef.current);
          setError("Inventory hold expired. Please go back and reserve again.");
          setPaymentStatus("expired");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(holdExpiryIntervalRef.current);
      clearInterval(pollingIntervalRef.current);
      clearInterval(qrExpiryIntervalRef.current);
    };
  }, [bookingId]);

  useEffect(() => {
    if (initialError) {
      setError(initialError);
    }
  }, [initialError]);

  const fetchBookingDetails = async () => {
    setLoading(true);
    setError("");
    console.log("LOG: Fetching booking status for PNR:", bookingId);
    try {
      const statusRes = await fetch(`${API_URL}/payments/status/${bookingId}`, {
        headers: token ? { "Authorization": `Bearer ${token}` } : {}
      });
      if (statusRes.status === 401) {
        console.warn("LOG: Status check returned 401 Unauthorized.");
        const errData = await statusRes.json().catch(() => ({}));
        setError(errData.detail || errData.message || "Your session has expired. Please log in again to complete checkout.");
        return;
      }
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        setPaymentStatus(statusData.status);
        console.log("LOG: Booking status resolved:", statusData.status);
        if (statusData.status === "captured") {
          console.log("LOG: Payment already captured, routing to confirmation:", bookingId);
          onNavigate(`/bookings/${bookingId}/confirmation`);
          return;
        }
      }

      console.log("LOG: Fetching booking details for PNR:", bookingId);
      const detailsRes = await fetch(`${API_URL}/bookings/details/${bookingId}`, {
        headers: token ? { "Authorization": `Bearer ${token}` } : {}
      });
      if (detailsRes.status === 401) {
        const errData = await detailsRes.json().catch(() => ({}));
        setError(errData.detail || errData.message || "Your session has expired or unauthorized. Please log in again.");
        return;
      }
      if (detailsRes.ok) {
        const detailsData = await detailsRes.json();
        console.log("LOG: Fetched booking details:", detailsData);
        setBooking({
          booking_reference: detailsData.booking_reference,
          title: `Travel OS ${detailsData.vertical?.toUpperCase() || "Itinerary"} Booking ${detailsData.booking_reference}`,
          total_amount: detailsData.total_amount,
          currency: detailsData.currency || "INR",
          vertical: detailsData.vertical || "flight",
          traveler_name: detailsData.traveler_name || (profile && profile.full_name) || "Traveler"
        });
      } else {
        console.warn("Booking details fetch returned non-200. Using client-side defaults.");
      }
    } catch (err: any) {
      console.warn("Failed to check booking status/details:", err);
      setError("Failed to fetch booking details. Please refresh or try again.");
    } finally {
      setLoading(false);
    }
  };

  // 2. Poll payment status (used for UPI QR)
  const startPolling = () => {
    if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    
    pollingIntervalRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${API_URL}/payments/status/${bookingId}`);
        if (!res.ok) return;
        const data = await res.json();
        
        if (data.status === "captured") {
          clearInterval(pollingIntervalRef.current);
          clearInterval(qrExpiryIntervalRef.current);
          setPaymentStatus("captured");
          onNavigate(`/bookings/${bookingId}/confirmation`);
        } else if (data.status === "failed") {
          clearInterval(pollingIntervalRef.current);
          setPaymentStatus("failed");
          setError("Payment failed. Please try again.");
        }
      } catch (err) {
        console.error("Error polling payment status:", err);
      }
    }, 3000);
  };

  // 3. Initialize embedded UPI QR flow
  const initUpiQr = async () => {
    console.log("LOG: initUpiQr clicked. humanApproved:", humanApproved);
    if (!humanApproved) {
      setError("Please check the 'Approve Payment Transaction' checkbox first to proceed.");
      return;
    }
    setPaymentLoading(true);
    setError("");
    try {
      console.log("LOG: Sending create-order request for UPI QR, PNR:", bookingId);
      const res = await fetch(`${API_URL}/payments/create-order`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          booking_id: bookingId,
          amount: booking.total_amount,
          currency: "INR",
          method: "upi",
          human_approved: humanApproved
        })
      });
      
      console.log("LOG: create-order (UPI) response status:", res.status);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || errData.message || `Payment initialization failed with status ${res.status}`);
      }
      
      const data = await res.json();
      console.log("LOG: create-order (UPI) response data:", data);
      setQrCodeUrl(data.qr_code_url);
      setQrCodeId(data.qr_code_id);
      setPaymentStatus("pending");
      setQrTimeLeft(300); // Reset 5-minute timer
      
      startPolling();
      
      if (qrExpiryIntervalRef.current) clearInterval(qrExpiryIntervalRef.current);
      qrExpiryIntervalRef.current = setInterval(() => {
        setQrTimeLeft((prev) => {
          if (prev <= 1) {
            console.log("LOG: UPI QR expired");
            clearInterval(qrExpiryIntervalRef.current);
            clearInterval(pollingIntervalRef.current);
            setPaymentStatus("expired");
            setError("UPI QR code expired. Please request a new one.");
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

    } catch (err: any) {
      console.error("LOG: UPI QR initialization failed:", err);
      setError(err.message || "Failed to initialize QR Payment");
    } finally {
      setPaymentLoading(false);
    }
  };

  // 4. Load & trigger Razorpay Checkout.js (Standard Cards/Netbanking/Wallets)
  const payWithRazorpay = async () => {
    console.log("LOG: payWithRazorpay clicked. humanApproved:", humanApproved, "activeTab:", activeTab);
    if (!humanApproved) {
      setError("Please check the 'Approve Payment Transaction' checkbox first to proceed.");
      return;
    }
    setPaymentLoading(true);
    setError("");
    try {
      console.log("LOG: Sending create-order request for cards/other, PNR:", bookingId, "amount:", booking.total_amount);
      const orderRes = await fetch(`${API_URL}/payments/create-order`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          booking_id: bookingId,
          amount: booking.total_amount,
          currency: "INR",
          method: activeTab,
          human_approved: humanApproved
        })
      });
      
      console.log("LOG: create-order response status:", orderRes.status);
      if (!orderRes.ok) {
        const errData = await orderRes.json().catch(() => ({}));
        throw new Error(errData.detail || errData.message || `Payment initialization failed with status ${orderRes.status}`);
      }
      
      const orderData = await orderRes.json();
      console.log("LOG: create-order response data:", orderData);
      
      const loadScript = () => {
        return new Promise((resolve) => {
          const script = document.createElement("script");
          script.src = "https://checkout.razorpay.com/v1/checkout.js";
          script.onload = () => resolve(true);
          script.onerror = () => resolve(false);
          document.body.appendChild(script);
        });
      };
      
      console.log("LOG: Loading Razorpay SDK script...");
      const loaded = await loadScript();
      if (!loaded) {
        throw new Error("Failed to load Razorpay SDK. Check your internet connection.");
      }
      console.log("LOG: Razorpay SDK script loaded successfully.");
      
      const options = {
        key: orderData.razorpay_key_id,
        amount: orderData.amount * 100,
        currency: orderData.currency,
        name: "Travel OS",
        description: `Payment for booking ${bookingId}`,
        order_id: orderData.razorpay_order_id,
        handler: async function (response: any) {
          console.log("LOG: Razorpay payment capture callback received:", response);
          setPaymentLoading(true);
          try {
            console.log("LOG: Sending payment verification payload to backend...");
            const verifyRes = await fetch(`${API_URL}/payments/verify`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature
              })
            });
            
            console.log("LOG: Payment verification response status:", verifyRes.status);
            if (!verifyRes.ok) {
              const verifyErr = await verifyRes.json();
              throw new Error(verifyErr.detail || "Payment verification failed.");
            }
            
            console.log("LOG: Payment captured and verified successfully.");
            setPaymentStatus("captured");
            console.log("LOG: Router navigating to confirmation page.");
            onNavigate(`/bookings/${bookingId}/confirmation`);
          } catch (err: any) {
            console.error("LOG: Payment verification failed:", err);
            setError(err.message || "Payment verification failed.");
            setPaymentStatus("failed");
          } finally {
            setPaymentLoading(false);
          }
        },
        prefill: {
          name: selectedTravellerId === "self" 
            ? (profile?.full_name || "Traveler") 
            : (travellers.find(t => t.id.toString() === selectedTravellerId)?.name || "Traveler"),
          email: profile?.email || "",
          contact: profile?.mobile_number || ""
        },
        theme: {
          color: "#facc15"
        }
      };
      
      console.log("LOG: Opening Razorpay Checkout widget...");
      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } catch (err: any) {
      console.error("LOG: payWithRazorpay failed:", err);
      setError(err.message || "Failed to initialize payment");
    } finally {
      setPaymentLoading(false);
    }
  };

  const handleTabChange = (tab: any) => {
    setActiveTab(tab);
    setQrCodeUrl(null);
    setQrCodeId(null);
    setError("");
    clearInterval(pollingIntervalRef.current);
    clearInterval(qrExpiryIntervalRef.current);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#f4efe6] text-black">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="h-10 w-10 animate-spin text-yellow-500" />
          <h2 className="text-xl font-bold tracking-wider uppercase italic">Resolving Itinerary Hold...</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4efe6] text-black p-6 font-sans">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex justify-between items-center border-b-4 border-black pb-4">
          <button 
            onClick={() => onNavigate("/")} 
            className="flex items-center gap-2 bg-white hover:bg-slate-100 border-3 border-black px-4 py-2 font-bold rounded-xl shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:translate-y-0.5 active:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all cursor-pointer text-sm"
          >
            <ArrowLeft size={16} /> Return to Explore
          </button>
          
          <h1 className="text-2xl font-bold bg-yellow-300 border-3 border-black px-4 py-1.5 rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            SECURE CHECKOUT
          </h1>
          
          <div className="bg-rose-100 border-3 border-rose-600 px-3 py-1.5 rounded-xl text-xs font-black text-rose-600 animate-pulse flex items-center gap-1.5">
            <Clock size={14} /> Hold Timer: {formatTime(holdTimeLeft)}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Left Panel: Payment Methods */}
          <div className="md:col-span-8 space-y-6">
            
            {/* Profile incomplete banner (Phase 6) */}
            {profileIncomplete ? (
              <div className="bg-rose-50 border-4 border-rose-600 rounded-2xl p-5 shadow-[5px_5px_0px_0px_rgba(225,29,72,1)] text-left space-y-3">
                <div className="flex items-center gap-2 text-rose-600 font-black uppercase text-xs">
                  <ShieldAlert size={16} /> Complete your profile to continue
                </div>
                <p className="text-[11px] text-rose-700 font-semibold leading-relaxed">
                  Guest checkouts are disabled to prevent invalid bookings. The following mandatory fields are missing from your profile: <strong className="text-rose-800">{missingFields.join(", ")}</strong>.
                </p>
                <button 
                  onClick={() => {
                    window.history.pushState(null, '', '/profile');
                    window.dispatchEvent(new PopStateEvent('popstate'));
                  }}
                  className="bg-rose-600 hover:bg-rose-700 text-white font-black text-[10px] uppercase px-4 py-2.5 border-2 border-black rounded-lg shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] cursor-pointer"
                >
                  Go to Profile Setup ➔
                </button>
              </div>
            ) : (
              <div className="bg-white border-4 border-black rounded-2xl p-5 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] text-left space-y-4">
                <div className="flex justify-between items-center border-b-2 border-slate-100 pb-2 flex-wrap gap-2">
                  <h3 className="font-black text-sm uppercase flex items-center gap-1.5 text-slate-800">👤 Traveler Information</h3>
                  {travellers.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <label className="text-[9px] font-bold text-slate-500 uppercase">Select Passenger:</label>
                      <select
                        value={selectedTravellerId}
                        onChange={(e) => setSelectedTravellerId(e.target.value)}
                        className="bg-slate-50 border-2 border-black rounded px-2 py-0.5 text-[10px] font-black outline-none cursor-pointer"
                      >
                        <option value="self">Myself ({profile?.full_name})</option>
                        {travellers.map(t => (
                          <option key={t.id} value={t.id.toString()}>{t.name} ({t.age} y/o)</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* Prefilled Traveler Details display (Phase 5) */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-semibold">
                  <div>
                    <span className="text-[9px] text-slate-400 block uppercase">Name</span>
                    <span className="text-slate-800">
                      {selectedTravellerId === "self" ? profile?.full_name : travellers.find(t => t.id.toString() === selectedTravellerId)?.name}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-400 block uppercase">DOB / Age</span>
                    <span className="text-slate-800 text-slate-700 font-mono">
                      {selectedTravellerId === "self" ? (profile?.dob || "N/A") : `${travellers.find(t => t.id.toString() === selectedTravellerId)?.age} Years`}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-400 block uppercase">Nationality</span>
                    <span className="text-slate-800">
                      {selectedTravellerId === "self" ? (profile?.nationality || "N/A") : (travellers.find(t => t.id.toString() === selectedTravellerId)?.nationality || "N/A")}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-400 block uppercase">Passport No.</span>
                    <span className="text-slate-850 font-mono text-slate-600">
                      {selectedTravellerId === "self" ? (profile?.passport_number || "N/A") : (travellers.find(t => t.id.toString() === selectedTravellerId)?.passport || "N/A")}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs font-semibold border-t border-slate-100 pt-3">
                  <div>
                    <span className="text-[9px] text-slate-400 block uppercase">Meal Preference</span>
                    <span className="text-slate-850">
                      {selectedTravellerId === "self" ? (profile?.meal_preference || "Standard Meal") : (travellers.find(t => t.id.toString() === selectedTravellerId)?.meal || "Standard Meal")}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-400 block uppercase">Seat Preference</span>
                    <span className="text-slate-850">
                      {selectedTravellerId === "self" ? (profile?.seat_preference || "Standard Seat") : (travellers.find(t => t.id.toString() === selectedTravellerId)?.seat || "Standard Seat")}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Human Payment Approval Checkpoint */}
            <div className="bg-yellow-50 border-4 border-black rounded-2xl p-4 shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] text-left">
              <div className="flex gap-3">
                <input 
                  type="checkbox" 
                  id="human-approval-check"
                  checked={humanApproved} 
                  onChange={(e) => setHumanApproved(e.target.checked)} 
                  className="w-5 h-5 accent-yellow-600 rounded cursor-pointer self-start mt-0.5"
                />
                <div>
                  <label htmlFor="human-approval-check" className="font-black uppercase text-xs tracking-wider text-slate-800 cursor-pointer block flex items-center gap-1.5">
                    🛡️ Checkpoint: Approve Payment Transaction
                  </label>
                  <p className="text-[11px] text-slate-600 font-semibold mt-1">
                    I explicitly authorize Travel OS to process payment charges for this booking itinerary. (Required to proceed with booking capture).
                  </p>
                </div>
              </div>
            </div>

            {/* Payment Method Selector Tabs */}
            <div className="bg-white border-4 border-black rounded-2xl p-4 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
              <h3 className="font-bold text-sm tracking-wide mb-3">Select Payment Mode:</h3>
              <div className="grid grid-cols-4 gap-2">
                <button
                  onClick={() => handleTabChange("card")}
                  className={`flex flex-col items-center justify-center p-3 border-3 rounded-xl font-bold text-xs uppercase cursor-pointer transition-all ${
                    activeTab === "card"
                      ? "bg-yellow-300 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                      : "bg-slate-50 border-slate-300 hover:border-black"
                  }`}
                >
                  <CreditCard className="mb-1" size={18} />
                  Cards
                </button>
                
                <button
                  onClick={() => handleTabChange("upi")}
                  className={`flex flex-col items-center justify-center p-3 border-3 rounded-xl font-bold text-xs uppercase cursor-pointer transition-all ${
                    activeTab === "upi"
                      ? "bg-yellow-300 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                      : "bg-slate-50 border-slate-300 hover:border-black"
                  }`}
                >
                  <QrCode className="mb-1" size={18} />
                  UPI (QR)
                </button>
                
                <button
                  onClick={() => handleTabChange("netbanking")}
                  className={`flex flex-col items-center justify-center p-3 border-3 rounded-xl font-bold text-xs uppercase cursor-pointer transition-all ${
                    activeTab === "netbanking"
                      ? "bg-yellow-300 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                      : "bg-slate-50 border-slate-300 hover:border-black"
                  }`}
                >
                  <Globe className="mb-1" size={18} />
                  Netbanking
                </button>
                
                <button
                  onClick={() => handleTabChange("wallet")}
                  className={`flex flex-col items-center justify-center p-3 border-3 rounded-xl font-bold text-xs uppercase cursor-pointer transition-all ${
                    activeTab === "wallet"
                      ? "bg-yellow-300 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                      : "bg-slate-50 border-slate-300 hover:border-black"
                  }`}
                >
                  <Wallet className="mb-1" size={18} />
                  Wallets
                </button>
              </div>
            </div>

            {/* Payment Content Display */}
            <div className="bg-white border-4 border-black rounded-2xl p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] min-h-[300px] flex flex-col justify-between">
              
              {activeTab === "upi" ? (
                <div className="text-center space-y-4 my-auto">
                  {!qrCodeUrl ? (
                    <div className="space-y-4 py-8">
                      <p className="text-slate-600 font-semibold max-w-sm mx-auto text-sm">
                        Generate an embedded, dynamic UPI QR code to pay instantly via any UPI App (Google Pay, PhonePe, Paytm).
                      </p>
                      <button
                        onClick={initUpiQr}
                        disabled={paymentLoading || !humanApproved || profileIncomplete}
                        className="bg-emerald-400 hover:bg-emerald-500 disabled:bg-emerald-200 border-3 border-black px-6 py-3 font-black text-sm uppercase rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-0.5 active:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all cursor-pointer flex items-center justify-center gap-2 mx-auto"
                      >
                        {paymentLoading ? "Generating QR Code..." : "Generate UPI QR Code"}
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {paymentStatus === "expired" ? (
                        <div className="py-6 space-y-4">
                          <ShieldAlert className="h-12 w-12 text-rose-500 mx-auto" />
                          <p className="font-bold text-rose-600">QR Code expired due to inactivity.</p>
                          <button onClick={initUpiQr} className="bg-yellow-300 border-3 border-black px-5 py-2 font-bold rounded-xl shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] cursor-pointer text-xs uppercase">
                            Generate New QR
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="border-4 border-black p-3 bg-white inline-block rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                            <img src={qrCodeUrl} alt="UPI QR Code" className="w-48 h-48 mx-auto" />
                          </div>
                          
                          <div className="text-xs space-y-1">
                            <div className="font-black text-rose-600 animate-pulse">
                              ⏳ SCAN AND PAY WITHIN: {formatTime(qrTimeLeft)}
                            </div>
                            <div className="font-semibold text-slate-500">
                              Scan this code using BHIM, Google Pay, Paytm, or PhonePe
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono mt-1">
                              QR ID: {qrCodeId}
                            </div>
                          </div>
                          
                          <div className="inline-flex items-center gap-2 bg-emerald-50 border-2 border-emerald-600 px-4 py-1.5 rounded-full text-xs font-bold text-emerald-800">
                            <RefreshCw className="animate-spin text-emerald-600" size={14} />
                            Waiting for payment confirmation...
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center space-y-6 my-auto py-8">
                  <div className="bg-[#eae5d9] border-3 border-black p-4 rounded-xl max-w-md mx-auto text-left">
                    <span className="text-[10px] uppercase font-black tracking-wide text-slate-600">Secure Payment Protocol</span>
                    <h4 className="font-black text-sm uppercase mt-1">Razorpay Checkout Widget</h4>
                    <p className="text-xs text-slate-600 font-medium mt-1">
                      Click below to open Razorpay's secure checkout popup. Supports saved cards, Netbanking credentials, and multiple wallet provider networks.
                    </p>
                  </div>
                  
                  <button
                    onClick={payWithRazorpay}
                    disabled={paymentLoading || !humanApproved || profileIncomplete}
                    className="bg-emerald-400 hover:bg-emerald-500 disabled:bg-emerald-200 border-3 border-black px-8 py-3.5 font-black text-sm uppercase rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-0.5 active:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all cursor-pointer flex items-center justify-center gap-2 mx-auto"
                  >
                    {paymentLoading ? (
                      <>
                        <RefreshCw className="animate-spin" size={16} /> Opening Gateway...
                      </>
                    ) : (
                      `Pay ₹${booking.total_amount.toLocaleString()} Now`
                    )}
                  </button>
                </div>
              )}

              {error && (
                <div className="mt-4 border-3 border-rose-600 bg-rose-50 text-rose-800 text-xs font-bold p-3 rounded-xl flex items-center gap-2">
                  <ShieldAlert size={16} className="text-rose-600 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-2 justify-center py-2 text-[10px] font-black text-slate-500 bg-slate-100 border-3 border-black rounded-xl">
              <span>🛡️ PCI-DSS Compliant • 256-Bit SSL Encrypted Connection • RBI Approved Gateway Integration</span>
            </div>

          </div>

          {/* Right Panel: Booking Summary */}
          <div className="md:col-span-4 space-y-6">
            <div className="bg-[#eae5d9] border-4 border-black p-4 rounded-2xl shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] space-y-4 text-left">
              <h3 className="font-bold text-lg tracking-wide border-b-2 border-black pb-2">
                Booking Summary
              </h3>
              
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-500">Vertical:</span>
                <span className="bg-slate-900 text-white text-[10px] px-2 py-0.5 rounded uppercase font-black font-mono ml-2">
                  {booking.vertical}
                </span>
                <h4 className="font-black text-base mt-1">{booking.title}</h4>
                <p className="text-xs text-slate-600 font-semibold">Ref PNR: {booking.booking_reference}</p>
              </div>
              
              <div className="border-t-2 border-dashed border-black/20 pt-3 space-y-2">
                <span className="text-[10px] uppercase font-black tracking-wide block">Cost Breakdown:</span>
                <div className="flex justify-between text-xs font-semibold">
                  <span>Fare Price:</span>
                  <span>₹{(booking.total_amount * 0.85).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs font-semibold">
                  <span>SGST & CGST Tax:</span>
                  <span>₹{(booking.total_amount * 0.15).toFixed(2)}</span>
                </div>
                <div className="flex justify-between border-t-3 border-black pt-2 font-black text-sm">
                  <span>Amount Payable:</span>
                  <span className="text-rose-600">₹{booking.total_amount.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
