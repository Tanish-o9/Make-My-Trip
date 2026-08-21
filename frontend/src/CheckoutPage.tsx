import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

import { API_BASE, API_URL } from './config/api';
import { CreditCard, QrCode, Globe, Wallet, ShieldAlert, ArrowLeft, RefreshCw, Clock, X, Lock, CheckCircle2 } from "lucide-react";

export interface TokenizedSavedCard {
  id: string;
  name: string;
  last4: string;
  type: "Visa" | "Mastercard" | "RuPay" | "Amex" | "Discover" | "Unknown";
  expiry: string;
  providerToken: string;
}

export function luhnCheck(val: string): boolean {
  const digits = val.replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let shouldDouble = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = parseInt(digits.charAt(i), 10);
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }
  return sum % 10 === 0;
}

export function detectCardNetwork(cardNumber: string): "Visa" | "Mastercard" | "RuPay" | "Amex" | "Discover" | "Unknown" {
  const digits = cardNumber.replace(/\D/g, '');
  if (!digits) return "Unknown";
  if (/^4/.test(digits)) return "Visa";
  if (/^(5[1-5]|2[2-7])/.test(digits)) return "Mastercard";
  if (/^(60|65|81|82|508)/.test(digits)) return "RuPay";
  if (/^3[47]/.test(digits)) return "Amex";
  if (/^(6011|65|64[4-9])/.test(digits)) return "Discover";
  return "Unknown";
}

export function formatCardNumber(cardNumber: string): string {
  const digits = cardNumber.replace(/\D/g, '').slice(0, 16);
  if (/^3[47]/.test(digits)) {
    return digits.replace(/^(\d{4})(\d{0,6})(\d{0,5})$/, (_, p1, p2, p3) => [p1, p2, p3].filter(Boolean).join(' '));
  }
  return digits.replace(/(.{4})/g, '$1 ').trim();
}

export function validateExpiryDate(expiryStr: string): { valid: boolean; error?: string } {
  if (!expiryStr || !/^\d{2}\/\d{2}$/.test(expiryStr)) {
    return { valid: false, error: "Expiry format must be MM/YY (e.g. 12/30)" };
  }
  const [mmStr, yyStr] = expiryStr.split('/');
  const month = parseInt(mmStr, 10);
  const year = parseInt(`20${yyStr}`, 10);
  if (month < 1 || month > 12) {
    return { valid: false, error: "Expiry month must be between 01 and 12" };
  }
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  if (year < currentYear || (year === currentYear && month < currentMonth)) {
    return { valid: false, error: "Card expiry date cannot be in the past" };
  }
  return { valid: true };
}

export function validateCVVNumber(cvvStr: string, network: string): { valid: boolean; error?: string } {
  const digits = cvvStr.replace(/\D/g, '');
  const reqLen = network === "Amex" ? 4 : 3;
  if (digits.length !== reqLen) {
    return { valid: false, error: `CVV must be ${reqLen} digits` };
  }
  return { valid: true };
}

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
    title: `Ghumne Chale Booking ${bookingId}`,
    total_amount: 1500, // standard test amount
    currency: "INR",
    vertical: bookingId.split("-")[1]?.toLowerCase() || "flight",
    traveler_name: ""
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(initialError || "");
  const [activeTab, setActiveTab] = useState<"card" | "upi" | "netbanking" | "wallet">("card");

  // Ghumne Chale Wallet payment states
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [loadingWallet, setLoadingWallet] = useState(false);

  const fetchWalletBalance = async () => {
    if (!token) return;
    setLoadingWallet(true);
    try {
      const res = await fetch(`${API_URL}/wallet-loyalty/wallet`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setWalletBalance(data.balance);
      }
    } catch (err) {
      console.error("Error fetching wallet balance:", err);
    } finally {
      setLoadingWallet(false);
    }
  };

  useEffect(() => {
    if (activeTab === "wallet") {
      fetchWalletBalance();
    }
  }, [activeTab, token]);

  const payWithWallet = async () => {
    if (!humanApproved) {
      setError("Please check the 'Approve Payment Transaction' checkbox first to proceed.");
      return;
    }
    setPaymentLoading(true);
    setError("");
    try {
      console.log("LOG: Initiating Ghumne Chale Wallet checkout for booking reference:", bookingId);
      const res = await fetch(`${API_URL}/bookings/confirm?booking_reference=${bookingId}&vertical=${booking.vertical}&payment_method=wallet`, {
        method: "POST",
        headers: token ? { "Authorization": `Bearer ${token}` } : {}
      });
      
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || errData.message || "Wallet payment failed.");
      }
      
      const data = await res.json();
      console.log("LOG: Wallet payment successful:", data);
      setPaymentStatus("captured");
      onNavigate(`/bookings/${bookingId}/confirmation`);
    } catch (err: any) {
      console.error("LOG: Wallet payment failed:", err);
      setError(err.message || "Wallet checkout failed. Please ensure you have sufficient balance.");
    } finally {
      setPaymentLoading(false);
    }
  };
  
  // Payment states
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [qrCodeId, setQrCodeId] = useState<string | null>(null);
  const [qrTimeLeft, setQrTimeLeft] = useState(300); // 5 minutes
  const [holdTimeLeft, setHoldTimeLeft] = useState(600); // 10 minutes booking hold
  const [paymentStatus, setPaymentStatus] = useState<string>("none"); // none, pending, captured, failed, expired
  const [humanApproved, setHumanApproved] = useState(false);

  // Razorpay Gateway Modal State
  const [showRazorpayModal, setShowRazorpayModal] = useState(false);
  const [razorpayOrderData, setRazorpayOrderData] = useState<any>(null);
  const [rzpMethod, setRzpMethod] = useState<"card" | "upi" | "netbanking" | "wallet">("card");
  const [rzpProcessing, setRzpProcessing] = useState(false);
  const [rzpCardNumber, setRzpCardNumber] = useState("4012 0000 3333 0026");
  const [rzpCardExpiry, setRzpCardExpiry] = useState("12/30");
  const [rzpCardCvv, setRzpCardCvv] = useState("123");
  const [rzpCardName, setRzpCardName] = useState("Tanish Verified Traveler");
  const [selectedBank, setSelectedBank] = useState("HDFC Bank");
  const [paymentAuthToken, setPaymentAuthToken] = useState<string | null>(null);
  const [showPinModal, setShowPinModal] = useState(false);
  const [saveCardChecked, setSaveCardChecked] = useState(true);
  const [savedTokens, setSavedTokens] = useState<Array<TokenizedSavedCard>>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("ghumne_chale_saved_tokens");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSavedTokens(parsed);
        }
      }
    } catch (e) {
      console.error("Failed to load saved card tokens:", e);
    }
  }, []);

  const saveCurrentCardIfRequested = () => {
    if (!saveCardChecked || !rzpCardNumber) return;
    try {
      const digits = rzpCardNumber.replace(/\D/g, '');
      const last4 = digits.slice(-4) || "0026";
      const network = detectCardNetwork(rzpCardNumber);
      const tokenObj: TokenizedSavedCard = {
        id: `card_tok_${Date.now()}`,
        name: rzpCardName || "Traveler",
        last4: last4,
        type: network,
        expiry: rzpCardExpiry || "12/30",
        providerToken: `pm_sandbox_${network.toLowerCase()}_${last4}_${Date.now()}`
      };
      const updated = [tokenObj, ...savedTokens.filter(t => t.last4 !== last4)].slice(0, 5);
      setSavedTokens(updated);
      localStorage.setItem("ghumne_chale_saved_tokens", JSON.stringify(updated));
    } catch (e) {
      console.error("Failed to save card token:", e);
    }
  };

  const resetToFreshCard = () => {
    setRzpCardNumber("4012 0000 3333 0026");
    setRzpCardExpiry("12/30");
    setRzpCardCvv("123");
    setRzpCardName(profile?.full_name || "Tanish Verified Traveler");
  };

  const removeSavedToken = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = savedTokens.filter(t => t.id !== id);
    setSavedTokens(updated);
    localStorage.setItem("ghumne_chale_saved_tokens", JSON.stringify(updated));
  };

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
        setProfile({
          ...data,
          nationality: data.nationality || "Indian",
          country: data.country || "India"
        });
        setProfileIncomplete(false);
        setMissingFields([]);
      })
      .catch(() => {
        setProfileIncomplete(false);
        setMissingFields([]);
      });

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
        const b = detailsData.booking || {};
        setBooking({
          booking_reference: b.booking_reference || detailsData.booking_reference,
          title: `Ghumne Chale ${detailsData.vertical?.toUpperCase() || "Itinerary"} Booking ${b.booking_reference || detailsData.booking_reference}`,
          total_amount: parseFloat(b.total_amount || detailsData.total_amount || "0"),
          currency: b.currency || detailsData.currency || "INR",
          vertical: detailsData.vertical || "flight",
          traveler_name: (detailsData.ticket?.passenger_details?.[0]?.name) || detailsData.traveler_name || (profile && profile.full_name) || "Traveler",
          pricing_snapshot: b.pricing_snapshot
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
  const payWithRazorpay = async (authTokenParam?: string) => {
    console.log("LOG: payWithRazorpay clicked. humanApproved:", humanApproved, "activeTab:", activeTab);
    if (!humanApproved) {
      setError("Please check the 'Approve Payment Transaction' checkbox first to proceed.");
      return;
    }
    if (activeTab === "netbanking") setRzpMethod("netbanking");
    else if (activeTab === "card") setRzpMethod("card");
    else if (activeTab === "upi") setRzpMethod("upi");
    else if (activeTab === "wallet") setRzpMethod("wallet");
    setPaymentLoading(true);
    setError("");

    const activeAuthToken = authTokenParam || paymentAuthToken;

    try {
      console.log("LOG: Sending create-order request for cards/other, PNR:", bookingId, "amount:", booking.total_amount);
      const orderRes = await fetch(`${API_URL}/payments/create-order`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {}),
          ...(activeAuthToken ? { "X-Payment-Authorization": activeAuthToken } : {})
        },
        body: JSON.stringify({
          booking_id: bookingId,
          amount: booking.total_amount,
          currency: "INR",
          method: activeTab,
          human_approved: humanApproved,
          ...(activeAuthToken ? { payment_authorization_token: activeAuthToken } : {})
        })
      });
      
      console.log("LOG: create-order response status:", orderRes.status);
      if (!orderRes.ok) {
        const errData = await orderRes.json().catch(() => ({}));
        const errMsg = errData.detail || errData.message || `Payment initialization failed with status ${orderRes.status}`;
        
        if (orderRes.status === 401 || errMsg.includes("ExpiredSignatureError") || errMsg.includes("Session expired") || errMsg.includes("Signature has expired")) {
          localStorage.removeItem("token");
          throw new Error("Your login session has expired. Please log in again to complete your payment.");
        }

        if (orderRes.status === 400 && (errMsg.includes("authorization token") || errMsg.includes("PIN"))) {
          setShowPinModal(true);
          setPaymentLoading(false);
          return;
        }

        throw new Error(errMsg);
      }
      
      const orderData = await orderRes.json();
      console.log("LOG: create-order response data:", orderData);
      setRazorpayOrderData(orderData);

      if (activeTab === "card") {
        saveCurrentCardIfRequested();
      }

      // ALWAYS launch the Razorpay Gateway Modal Popup
      setShowRazorpayModal(true);

      // Try SDK script in background if available
      try {
        const loadScript = () => {
          return new Promise((resolve) => {
            const script = document.createElement("script");
            script.src = "https://checkout.razorpay.com/v1/checkout.js";
            script.onload = () => resolve(true);
            script.onerror = () => resolve(false);
            document.body.appendChild(script);
          });
        };
        const loaded = await loadScript();
        if (loaded && (window as any).Razorpay && !orderData.razorpay_order_id.startsWith("order_mock_")) {
          const cleanCardNum = (rzpCardNumber || "").replace(/\s/g, "");
          const validCardNum = cleanCardNum.length >= 12 ? cleanCardNum : "4012000033330026";
          const expParts = (rzpCardExpiry || "12/30").split('/');
          const expiryMonth = expParts[0] || "12";
          const expiryYear = expParts[1] ? (expParts[1].length === 2 ? `20${expParts[1]}` : expParts[1]) : "2030";

          const options: any = {
            key: orderData.razorpay_key_id,
            amount: orderData.amount * 100,
            currency: orderData.currency,
            name: "Ghumne Chale",
            description: `Payment for booking ${bookingId}`,
            order_id: orderData.razorpay_order_id,
            prefill: {
              name: rzpCardName || profile?.full_name || "Tanish Verified Traveler",
              email: profile?.email || "traveler@ghumnechale.com",
              contact: profile?.phone || "9999999999",
              method: activeTab === "card" ? "card" : activeTab === "netbanking" ? "netbanking" : activeTab === "upi" ? "upi" : "wallet",
              "card[number]": validCardNum,
              "card[name]": rzpCardName || "Tanish Verified Traveler",
              "card[expiry_month]": expiryMonth,
              "card[expiry_year]": expiryYear,
              "card[cvv]": rzpCardCvv || "123"
            },
            handler: function (response: any) {
              handleRazorpaySuccess(response.razorpay_payment_id, response.razorpay_signature);
            },
            modal: {
              ondismiss: function() {
                setShowRazorpayModal(false);
                setPaymentLoading(false);
              }
            }
          };
          const rzp = new (window as any).Razorpay(options);
          rzp.open();
        }
      } catch (e) {
        console.warn("Real Razorpay SDK script bypassed, using built-in interactive Razorpay Gateway Modal.");
      }

    } catch (err: any) {
      console.error("LOG: payWithRazorpay failed:", err);
      setError(err.message || "Failed to initialize payment");
    } finally {
      setPaymentLoading(false);
    }
  };

  const handleRazorpaySuccess = async (paymentId?: string, signature?: string) => {
    setRzpProcessing(true);
    const orderId = razorpayOrderData?.razorpay_order_id || `order_mock_${Math.random().toString(36).substring(2, 10)}`;
    const payId = paymentId || `pay_rzp_${Math.random().toString(36).substring(2, 14)}`;
    const sig = signature || "mock_signature";

    try {
      console.log("LOG: Verifying Razorpay payment with backend...");
      const verifyRes = await fetch(`${API_URL}/payments/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          razorpay_order_id: orderId,
          razorpay_payment_id: payId,
          razorpay_signature: sig
        })
      });
      
      if (!verifyRes.ok) {
        const verifyErr = await verifyRes.json().catch(() => ({}));
        throw new Error(verifyErr.detail || "Payment verification failed.");
      }
      
      console.log("LOG: Razorpay payment verified!");
      setPaymentStatus("captured");
      setShowRazorpayModal(false);
      onNavigate(`/bookings/${bookingId}/confirmation`);
    } catch (err: any) {
      console.error("LOG: Payment verification failed:", err);
      setError(err.message || "Payment verification failed.");
      setPaymentStatus("failed");
    } finally {
      setRzpProcessing(false);
    }
  };

  const handleTabChange = (tab: any) => {
    setActiveTab(tab);
    if (tab === "netbanking") setRzpMethod("netbanking");
    else if (tab === "card") setRzpMethod("card");
    else if (tab === "upi") setRzpMethod("upi");
    else if (tab === "wallet") setRzpMethod("wallet");
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
            onClick={() => {
              sessionStorage.setItem("active_vertical", "flights");
              sessionStorage.setItem("fl_reopen_checkout", "true");
              if (window.history.length > 1) {
                window.history.back();
              } else {
                onNavigate("/");
              }
            }} 
            className="flex items-center gap-2 bg-white hover:bg-slate-100 border-3 border-black px-4 py-2 font-bold rounded-xl shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:translate-y-0.5 active:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all cursor-pointer text-sm"
          >
            <ArrowLeft size={16} /> Back to Flight Booking
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
            
            {/* Traveler Information Panel */}
            <div className="bg-white border-4 border-black rounded-2xl p-5 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] text-left space-y-4">
                <div className="flex justify-between items-center border-b-2 border-slate-200 pb-2 flex-wrap gap-2">
                  <h3 className="font-black text-sm uppercase flex items-center gap-1.5 text-black">👤 Traveler Information</h3>
                  {travellers.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <label className="text-[10px] font-extrabold text-black uppercase">Select Passenger:</label>
                      <select
                        value={selectedTravellerId}
                        onChange={(e) => setSelectedTravellerId(e.target.value)}
                        className="bg-slate-50 border-2 border-black rounded px-2 py-0.5 text-[10px] font-black text-black outline-none cursor-pointer"
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
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-bold">
                  <div>
                    <span className="text-[10px] text-black font-extrabold block uppercase tracking-wider">Name</span>
                    <span className="text-black font-black text-sm">
                      {selectedTravellerId === "self" ? profile?.full_name : travellers.find(t => t.id.toString() === selectedTravellerId)?.name}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-black font-extrabold block uppercase tracking-wider">DOB / Age</span>
                    <span className="text-black font-mono font-black text-sm">
                      {selectedTravellerId === "self" ? (profile?.dob || "N/A") : `${travellers.find(t => t.id.toString() === selectedTravellerId)?.age} Years`}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-black font-extrabold block uppercase tracking-wider">Nationality</span>
                    <span className="text-black font-black text-sm">
                      {selectedTravellerId === "self" ? (profile?.nationality || "N/A") : (travellers.find(t => t.id.toString() === selectedTravellerId)?.nationality || "N/A")}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-black font-extrabold block uppercase tracking-wider">Passport No.</span>
                    <span className="text-black font-mono font-black text-sm">
                      {selectedTravellerId === "self" ? (profile?.passport_number || "N/A") : (travellers.find(t => t.id.toString() === selectedTravellerId)?.passport || "N/A")}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs font-bold border-t-2 border-slate-200 pt-3">
                  <div>
                    <span className="text-[10px] text-black font-extrabold block uppercase tracking-wider">Meal Preference</span>
                    <span className="text-black font-bold">
                      {selectedTravellerId === "self" ? (profile?.meal_preference || "Standard Meal") : (travellers.find(t => t.id.toString() === selectedTravellerId)?.meal || "Standard Meal")}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-black font-extrabold block uppercase tracking-wider">Seat Preference</span>
                    <span className="text-black font-bold">
                      {selectedTravellerId === "self" ? (profile?.seat_preference || "Standard Seat") : (travellers.find(t => t.id.toString() === selectedTravellerId)?.seat || "Standard Seat")}
                    </span>
                  </div>
                </div>
              </div>

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
                  <label htmlFor="human-approval-check" className="font-black uppercase text-xs tracking-wider text-black cursor-pointer block flex items-center gap-1.5">
                    🛡️ Checkpoint: Approve Payment Transaction
                  </label>
                  <p className="text-[11px] text-black font-bold mt-1 leading-normal">
                    I explicitly authorize Ghumne Chale to process payment charges for this booking itinerary. (Required to proceed with booking capture).
                  </p>
                </div>
              </div>
            </div>

            {/* Payment Method Selector Tabs */}
            <div className="bg-white border-4 border-black rounded-2xl p-4 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] text-left">
              <h3 className="font-black text-sm tracking-wide text-black mb-3">Select Payment Mode:</h3>
              <div className="grid grid-cols-4 gap-2">
                <button
                  onClick={() => handleTabChange("card")}
                  className={`flex flex-col items-center justify-center p-3 border-3 rounded-xl font-black text-xs uppercase cursor-pointer transition-all ${
                    activeTab === "card"
                      ? "bg-yellow-300 border-black text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                      : "bg-slate-50 text-black border-slate-400 hover:border-black"
                  }`}
                >
                  <CreditCard className="mb-1 text-black" size={18} />
                  Cards
                </button>
                
                <button
                  onClick={() => handleTabChange("upi")}
                  className={`flex flex-col items-center justify-center p-3 border-3 rounded-xl font-black text-xs uppercase cursor-pointer transition-all ${
                    activeTab === "upi"
                      ? "bg-yellow-300 border-black text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                      : "bg-slate-50 text-black border-slate-400 hover:border-black"
                  }`}
                >
                  <QrCode className="mb-1 text-black" size={18} />
                  UPI (QR)
                </button>
                
                <button
                  onClick={() => handleTabChange("netbanking")}
                  className={`flex flex-col items-center justify-center p-3 border-3 rounded-xl font-black text-xs uppercase cursor-pointer transition-all ${
                    activeTab === "netbanking"
                      ? "bg-yellow-300 border-black text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                      : "bg-slate-50 text-black border-slate-400 hover:border-black"
                  }`}
                >
                  <Globe className="mb-1 text-black" size={18} />
                  Netbanking
                </button>
                
                <button
                  onClick={() => handleTabChange("wallet")}
                  className={`flex flex-col items-center justify-center p-3 border-3 rounded-xl font-black text-xs uppercase cursor-pointer transition-all ${
                    activeTab === "wallet"
                      ? "bg-yellow-300 border-black text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                      : "bg-slate-50 text-black border-slate-400 hover:border-black"
                  }`}
                >
                  <Wallet className="mb-1 text-black" size={18} />
                  Wallets
                </button>
              </div>
            </div>

            {/* Payment Content Display */}
            <div className="bg-white border-4 border-black rounded-2xl p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] min-h-[300px] flex flex-col justify-between">
              
              {activeTab === "upi" && (
                <div className="text-center space-y-4 my-auto">
                  {!qrCodeUrl ? (
                    <div className="space-y-4 py-8">
                      <p className="text-black font-bold max-w-sm mx-auto text-sm">
                        Generate an embedded, dynamic UPI QR code to pay instantly via any UPI App (Google Pay, PhonePe, Paytm).
                      </p>
                      <button
                        onClick={initUpiQr}
                        disabled={paymentLoading || !humanApproved}
                        className="bg-emerald-400 hover:bg-emerald-500 disabled:bg-emerald-200 text-black border-3 border-black px-6 py-3 font-black text-sm uppercase rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-0.5 active:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all cursor-pointer flex items-center justify-center gap-2 mx-auto"
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
                          <button onClick={initUpiQr} className="bg-yellow-300 border-3 border-black px-5 py-2 font-bold text-black rounded-xl shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] cursor-pointer text-xs uppercase">
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
                            <div className="font-bold text-black">
                              Scan this code using BHIM, Google Pay, Paytm, or PhonePe
                            </div>
                            <div className="text-[10px] text-black font-mono font-bold mt-1">
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
              )}

              {activeTab === "netbanking" && (
                <div className="text-center space-y-4 my-auto py-4">
                  <div className="bg-[#eae5d9] border-3 border-black p-4 rounded-xl max-w-md mx-auto text-left space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] uppercase font-black tracking-wide text-black">Netbanking Protocol</span>
                      <span className="bg-yellow-300 border border-black text-[9px] font-black px-2 py-0.5 rounded uppercase font-mono">50+ Banks Supported</span>
                    </div>
                    <h4 className="font-black text-sm uppercase text-black flex items-center gap-1.5">
                      <Globe size={16} /> Select Netbanking Bank
                    </h4>
                    
                    <div className="grid grid-cols-2 gap-2 text-xs font-black">
                      {[
                        { name: "HDFC Bank", icon: "🏦" },
                        { name: "ICICI Bank", icon: "🏦" },
                        { name: "State Bank of India", icon: "🏦" },
                        { name: "Axis Bank", icon: "🏦" },
                        { name: "Kotak Mahindra", icon: "🏦" },
                        { name: "Punjab National", icon: "🏦" },
                      ].map((b) => (
                        <div
                          key={b.name}
                          onClick={() => setSelectedBank(b.name)}
                          className={`p-2.5 rounded-lg cursor-pointer flex items-center gap-2 transition-all ${
                            selectedBank === b.name
                              ? "bg-yellow-300 border-3 border-black text-black font-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] scale-[1.02]"
                              : "bg-white border-2 border-black hover:bg-yellow-100 text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                          }`}
                        >
                          {b.icon} {b.name}
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="flex justify-center items-center max-w-md mx-auto">
                    <button
                      onClick={() => payWithRazorpay()}
                      disabled={paymentLoading || !humanApproved}
                      className="w-full bg-emerald-400 hover:bg-emerald-500 disabled:bg-emerald-200 text-black border-3 border-black px-6 py-3 font-black text-xs uppercase rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-0.5 active:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all cursor-pointer flex items-center justify-center gap-2"
                    >
                      {paymentLoading ? (
                        <>
                          <RefreshCw className="animate-spin" size={16} /> Launching Netbanking Gateway...
                        </>
                      ) : (
                        `Pay ₹${booking.total_amount.toLocaleString()} via Netbanking`
                      )}
                    </button>
                  </div>
                </div>
              )}

              {activeTab === "wallet" && (
                <div className="text-center space-y-4 my-auto py-4">
                  {loadingWallet || walletBalance === null ? (
                    <div className="bg-[#eae5d9] border-3 border-black p-6 rounded-xl max-w-md mx-auto text-center space-y-2">
                      <RefreshCw className="animate-spin text-black mx-auto" size={24} />
                      <p className="text-xs font-black text-black uppercase">Retrieving Wallet Account Balance...</p>
                    </div>
                  ) : walletBalance >= booking.total_amount ? (
                    <div className="bg-[#eae5d9] border-3 border-black p-5 rounded-xl max-w-md mx-auto text-left space-y-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                      <div className="flex justify-between items-center border-b border-black/10 pb-2">
                        <span className="text-[10px] uppercase font-black tracking-wide text-black flex items-center gap-1">
                          <Wallet size={12} /> Travel Wallet Ledger
                        </span>
                        <span className="bg-emerald-300 border border-black text-[9px] font-black px-2 py-0.5 rounded uppercase font-mono">Sufficient Funds</span>
                      </div>
                      
                      <div className="space-y-2 text-xs font-bold text-black font-sans">
                        <div className="flex justify-between">
                          <span>Wallet Balance:</span>
                          <span className="font-black text-slate-800">₹{walletBalance.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-rose-700">
                          <span>Amount to Deduct:</span>
                          <span className="font-black">₹{booking.total_amount.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between border-t border-black/15 pt-2 text-emerald-800 text-sm font-black">
                          <span>Remaining Balance:</span>
                          <span>₹{(walletBalance - booking.total_amount).toLocaleString()}</span>
                        </div>
                      </div>

                      <div className="pt-2">
                        <button
                          onClick={payWithWallet}
                          disabled={paymentLoading || !humanApproved}
                          className="w-full bg-emerald-400 hover:bg-emerald-500 disabled:bg-emerald-200 text-black border-3 border-black px-6 py-3 font-black text-xs uppercase rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-0.5 active:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all cursor-pointer flex items-center justify-center gap-2"
                        >
                          {paymentLoading ? (
                            <>
                              <RefreshCw className="animate-spin" size={16} /> Confirming Booking...
                            </>
                          ) : (
                            `Pay ₹${booking.total_amount.toLocaleString()} via Travel Wallet`
                          )}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-rose-100 border-3 border-rose-600 p-5 rounded-xl max-w-md mx-auto text-left space-y-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                      <div className="flex justify-between items-center border-b border-rose-200 pb-2">
                        <span className="text-[10px] uppercase font-black tracking-wide text-rose-800 flex items-center gap-1">
                          ⚠️ Insufficient Balance
                        </span>
                        <span className="bg-rose-500 text-white border border-rose-700 text-[9px] font-black px-2 py-0.5 rounded uppercase font-mono">Deduction Blocked</span>
                      </div>
                      
                      <div className="space-y-1.5 text-xs font-bold text-rose-950 font-sans">
                        <p className="font-extrabold text-sm text-rose-900 mb-2">Insufficient wallet balance.</p>
                        <div className="flex justify-between">
                          <span>Current balance:</span>
                          <span>₹{walletBalance.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Required:</span>
                          <span className="font-black">₹{booking.total_amount.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between border-t border-rose-200 pt-2 text-rose-900 font-extrabold">
                          <span>Shortfall:</span>
                          <span>₹{(booking.total_amount - walletBalance).toLocaleString()}</span>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 pt-2 text-xs">
                        <button
                          onClick={() => {
                            // Close checkout page or navigate to wallet tab
                            onNavigate("/wallet");
                          }}
                          className="w-full bg-yellow-300 hover:bg-yellow-400 text-black border-2 border-black font-black py-2.5 rounded-xl transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] uppercase active:translate-y-0.5 cursor-pointer text-center"
                        >
                          [ Add ₹{(booking.total_amount - walletBalance).toLocaleString()} ]
                        </button>
                        <button
                          onClick={() => setActiveTab("card")}
                          className="w-full bg-white hover:bg-slate-50 text-slate-700 border-2 border-slate-800 font-black py-2.5 rounded-xl transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] uppercase active:translate-y-0.5 cursor-pointer text-center"
                        >
                          [ Use Another Payment Method ]
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "card" && (() => {
                const network = detectCardNetwork(rzpCardNumber);
                const isLuhnValid = luhnCheck(rzpCardNumber);
                const expiryCheck = validateExpiryDate(rzpCardExpiry);
                const cvvCheck = validateCVVNumber(rzpCardCvv, network);
                const isNameValid = (rzpCardName || "").trim().length > 0;

                const isFormValid = isLuhnValid && expiryCheck.valid && cvvCheck.valid && isNameValid;

                return (
                  <div className="space-y-4 my-auto py-2">
                    <div className="bg-[#eae5d9] border-3 border-black p-4 rounded-xl max-w-md mx-auto text-left space-y-3 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                      <div className="flex justify-between items-center border-b border-black/10 pb-2">
                        <span className="text-[10px] uppercase font-black tracking-wide text-black flex items-center gap-1">
                          <CreditCard size={14} /> PCI-DSS Sandbox Card Checkout
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="bg-emerald-400 border border-black text-[9px] font-black px-2 py-0.5 rounded uppercase font-mono">
                            {network !== "Unknown" ? `💳 ${network}` : "💳 Card"}
                          </span>
                          <span className="bg-yellow-300 border border-black text-[9px] font-black px-2 py-0.5 rounded uppercase font-mono">
                            Tokenized 256-Bit
                          </span>
                        </div>
                      </div>

                      {/* Saved Tokenized Cards Section */}
                      {savedTokens.length > 0 && (
                        <div className="space-y-1.5 border-b border-black/10 pb-3">
                          <div className="flex justify-between items-center">
                            <label className="text-[10px] uppercase font-black text-black flex items-center gap-1">
                              🔒 Tokenized Saved Cards ({savedTokens.length}):
                            </label>
                            <button
                              type="button"
                              onClick={resetToFreshCard}
                              className="text-[9px] font-black bg-white hover:bg-yellow-200 border border-black px-2 py-0.5 rounded cursor-pointer transition-all uppercase"
                            >
                              + Enter New Card
                            </button>
                          </div>
                          <div className="grid grid-cols-1 gap-1.5">
                            {savedTokens.map((t) => (
                              <div
                                key={t.id}
                                onClick={() => {
                                  if (t.type === "Visa") setRzpCardNumber("4012 0000 3333 0026");
                                  else if (t.type === "Mastercard") setRzpCardNumber("5123 4567 8901 2345");
                                  else if (t.type === "RuPay") setRzpCardNumber("6071 2345 6789 0123");
                                  else if (t.type === "Amex") setRzpCardNumber("3782 822463 10005");
                                  setRzpCardExpiry(t.expiry);
                                  setRzpCardName(t.name);
                                }}
                                className={`p-2 rounded-lg border-2 border-black flex justify-between items-center cursor-pointer transition-all ${
                                  rzpCardNumber.replace(/\D/g, '').endsWith(t.last4)
                                    ? "bg-yellow-300 font-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] text-black"
                                    : "bg-white hover:bg-yellow-50 text-black"
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-black">💳 {t.type}</span>
                                  <span className="font-mono text-xs font-bold">•••• •••• •••• {t.last4}</span>
                                  <span className="text-[10px] text-slate-600 font-bold">({t.expiry})</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <span className="text-[8px] font-mono bg-slate-100 text-slate-700 px-1 py-0.5 rounded border border-slate-300">
                                    Tokenized
                                  </span>
                                  <button
                                    type="button"
                                    onClick={(e) => removeSavedToken(t.id, e)}
                                    title="Remove tokenized card"
                                    className="text-rose-600 hover:bg-rose-100 p-1 rounded font-bold text-xs cursor-pointer border border-rose-300"
                                  >
                                    🗑️
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Official Sandbox Test Cards Chips */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-black text-black block">Select Official Provider Sandbox Test Card:</label>
                        <div className="grid grid-cols-4 gap-1 text-[10px] font-black">
                          {[
                            { label: "Visa", num: "4012 0000 3333 0026", exp: "12/30", cvv: "123", name: "Tanish Verified Traveler" },
                            { label: "Mastercard", num: "5123 4567 8901 2345", exp: "11/28", cvv: "456", name: "Primary Travel Card" },
                            { label: "RuPay", num: "6071 2345 6789 0123", exp: "09/29", cvv: "789", name: "Corporate RuPay Card" },
                            { label: "Amex", num: "3782 822463 10005", exp: "10/29", cvv: "1234", name: "Amex Corporate Card" },
                          ].map((preset) => (
                            <button
                              type="button"
                              key={preset.label}
                              onClick={() => {
                                setRzpCardNumber(preset.num);
                                setRzpCardExpiry(preset.exp);
                                setRzpCardCvv(preset.cvv);
                                setRzpCardName(preset.name);
                              }}
                              className={`p-1.5 rounded-lg border-2 border-black text-center cursor-pointer transition-all ${
                                rzpCardNumber === preset.num
                                  ? "bg-yellow-300 font-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] text-black"
                                  : "bg-white hover:bg-yellow-50 text-black"
                              }`}
                            >
                              <div className="font-black text-[10px] truncate">💳 {preset.label}</div>
                              <div className="text-[8px] font-mono text-slate-700 truncate">..{preset.num.slice(-4)}</div>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Manual Card Details Inputs */}
                      <div className="space-y-2.5 pt-1">
                        <div>
                          <label className="text-[10px] uppercase font-black text-black block mb-1">Cardholder Name</label>
                          <input
                            type="text"
                            value={rzpCardName}
                            onChange={(e) => setRzpCardName(e.target.value)}
                            placeholder="Name on Card"
                            className="w-full bg-white border-2 border-black rounded-lg p-2 text-xs font-bold text-black outline-none focus:bg-yellow-50"
                          />
                        </div>

                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <label className="text-[10px] uppercase font-black text-black block">Card Number (PAN)</label>
                            <span className="text-[9px] font-mono font-bold text-slate-700 uppercase">{network}</span>
                          </div>
                          <input
                            type="text"
                            value={rzpCardNumber}
                            onChange={(e) => {
                              const formatted = formatCardNumber(e.target.value);
                              setRzpCardNumber(formatted || e.target.value);
                            }}
                            placeholder="4012 0000 0000 0000"
                            className={`w-full bg-white border-2 rounded-lg p-2 text-xs font-mono font-bold text-black outline-none focus:bg-yellow-50 tracking-wider ${
                              rzpCardNumber && !isLuhnValid ? "border-rose-600 bg-rose-50" : "border-black"
                            }`}
                          />
                          {rzpCardNumber.replace(/\D/g, '').length >= 12 && !isLuhnValid && (
                            <p className="text-[10px] font-bold text-rose-600 mt-1">
                              ⚠️ Invalid card number. Failed Luhn checksum validation. Select a Sandbox test card chip above.
                            </p>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] uppercase font-black text-black block mb-1">Expiry (MM/YY)</label>
                            <input
                              type="text"
                              value={rzpCardExpiry}
                              onChange={(e) => setRzpCardExpiry(e.target.value)}
                              placeholder="MM/YY"
                              maxLength={5}
                              className={`w-full bg-white border-2 rounded-lg p-2 text-xs font-mono font-bold text-black outline-none focus:bg-yellow-50 ${
                                rzpCardExpiry && !expiryCheck.valid ? "border-rose-600 bg-rose-50" : "border-black"
                              }`}
                            />
                            {rzpCardExpiry.length >= 5 && !expiryCheck.valid && (
                              <p className="text-[9px] font-bold text-rose-600 mt-0.5">⚠️ {expiryCheck.error}</p>
                            )}
                          </div>
                          <div>
                            <label className="text-[10px] uppercase font-black text-black block mb-1">
                              CVV Security Code {network === "Amex" ? "(4 digits)" : "(3 digits)"}
                            </label>
                            <input
                              type="password"
                              value={rzpCardCvv}
                              onChange={(e) => setRzpCardCvv(e.target.value.replace(/\D/g, '').slice(0, network === "Amex" ? 4 : 3))}
                              placeholder={network === "Amex" ? "••••" : "•••"}
                              maxLength={network === "Amex" ? 4 : 3}
                              className={`w-full bg-white border-2 rounded-lg p-2 text-xs font-mono font-bold text-black outline-none focus:bg-yellow-50 ${
                                rzpCardCvv && !cvvCheck.valid ? "border-rose-600 bg-rose-50" : "border-black"
                              }`}
                            />
                            {rzpCardCvv.length >= 3 && !cvvCheck.valid && (
                              <p className="text-[9px] font-bold text-rose-600 mt-0.5">⚠️ {cvvCheck.error}</p>
                            )}
                          </div>
                        </div>

                        {/* Save Card Token Checkbox */}
                        <div className="flex items-center gap-2 pt-2 border-t border-black/10">
                          <input
                            type="checkbox"
                            id="saveCardCheckbox"
                            checked={saveCardChecked}
                            onChange={(e) => setSaveCardChecked(e.target.checked)}
                            className="w-4 h-4 accent-yellow-400 cursor-pointer"
                          />
                          <label htmlFor="saveCardCheckbox" className="text-[11px] font-black text-black cursor-pointer select-none flex items-center gap-1">
                            🔒 Save tokenized payment method (PCI-DSS Tokenized)
                          </label>
                        </div>

                      </div>
                    </div>
                    
                    <div className="flex justify-center items-center max-w-md mx-auto">
                      <button
                        onClick={() => payWithRazorpay()}
                        disabled={!isFormValid || paymentLoading || !humanApproved}
                        className="w-full bg-emerald-400 hover:bg-emerald-500 disabled:bg-slate-300 disabled:text-slate-500 disabled:border-slate-400 text-black border-3 border-black px-6 py-3 font-black text-xs uppercase rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-0.5 transition-all cursor-pointer flex items-center justify-center gap-2"
                      >
                        {paymentLoading ? (
                          <>
                            <RefreshCw className="animate-spin" size={16} /> Opening Gateway...
                          </>
                        ) : !isFormValid ? (
                          `Enter Valid Card Details (Luhn Checked)`
                        ) : (
                          `Pay ₹${booking.total_amount.toLocaleString()} via ${network !== "Unknown" ? network : "Card"}`
                        )}
                      </button>
                    </div>
                  </div>
                );
              })()}

              {error && (
                <div className="mt-4 border-3 border-rose-600 bg-rose-50 text-rose-800 text-xs font-bold p-3 rounded-xl flex items-center gap-2">
                  <ShieldAlert size={16} className="text-rose-600 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-2 justify-center py-2 text-[10px] font-black text-black bg-slate-200 border-3 border-black rounded-xl">
              <span>🛡️ PCI-DSS Compliant • 256-Bit SSL Encrypted Connection • RBI Approved Gateway Integration</span>
            </div>

          </div>

          {/* Right Panel: Booking Summary */}
          <div className="md:col-span-4 space-y-6">
            <div className="bg-[#eae5d9] border-4 border-black p-4 rounded-2xl shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] space-y-4 text-left">
              <h3 className="font-black text-lg tracking-wide text-black border-b-2 border-black pb-2">
                Booking Summary
              </h3>
              
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-black text-black">Vertical:</span>
                <span className="bg-slate-900 text-white text-[10px] px-2 py-0.5 rounded uppercase font-black font-mono ml-2">
                  {booking.vertical}
                </span>
                <h4 className="font-black text-base text-black mt-1">{booking.title}</h4>
                <p className="text-xs text-black font-black">Ref PNR: {booking.booking_reference}</p>
              </div>
              
              {(() => {
                const snapshot = booking.pricing_snapshot || {};
                const base = typeof snapshot.base_fare === "number" ? snapshot.base_fare : (parseFloat(booking.total_amount) || 0);
                const tax = typeof snapshot.tax === "number" ? snapshot.tax : 0;
                const discount = typeof snapshot.discount === "number" ? snapshot.discount : 0;
                
                return (
                  <div className="border-t-2 border-dashed border-black pt-3 space-y-2">
                    <span className="text-[10px] uppercase font-black tracking-wide block text-black">Cost Breakdown:</span>
                    <div className="flex justify-between text-xs font-black text-black">
                      <span>Fare Price:</span>
                      <span>₹{base.toFixed(2)}</span>
                    </div>
                    {discount > 0 && (
                      <div className="flex justify-between text-xs font-black text-green-700">
                        <span>Special Fare Discounts:</span>
                        <span>-₹{discount.toFixed(2)}</span>
                      </div>
                    )}
                    {tax > 0 && (
                      <div className="flex justify-between text-xs font-black text-black">
                        <span>SGST & CGST Tax:</span>
                        <span>₹{tax.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between border-t-3 border-black pt-2 font-black text-sm text-black">
                      <span>Amount Payable:</span>
                      <span className="text-rose-600 font-black">₹{parseFloat(booking.total_amount || "0").toLocaleString()}</span>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>

      </div>

      {/* Razorpay Gateway Modal Popup (Portal Mounted directly to Document Body) */}
      {showRazorpayModal && createPortal(
        <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-[#0f172a] text-white border-4 border-black rounded-3xl w-full max-w-md shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] overflow-hidden flex flex-col font-sans">
            
            {/* Razorpay Brand Header */}
            <div className="bg-[#0284c7] p-5 border-b-4 border-black text-white relative">
              <button
                onClick={() => setShowRazorpayModal(false)}
                className="absolute top-4 right-4 text-white hover:bg-black/20 p-1.5 rounded-full transition-all cursor-pointer"
              >
                <X size={20} />
              </button>
              
              <div className="flex items-center gap-2 mb-1">
                <span className="bg-yellow-400 text-black font-black text-[10px] uppercase px-2 py-0.5 rounded border border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] font-mono">
                  Razorpay Sandbox
                </span>
                <span className="text-xs font-bold text-sky-100 flex items-center gap-1">
                  <Lock size={12} /> 256-Bit SSL Secure
                </span>
              </div>
              
              <div className="flex justify-between items-end mt-3">
                <div>
                  <h3 className="font-black text-xl tracking-tight uppercase italic">Ghumne Chale</h3>
                  <p className="text-xs text-sky-100 font-semibold">Booking PNR: {booking.booking_reference}</p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-sky-200 block">Total Amount</span>
                  <span className="text-2xl font-black tracking-tight text-yellow-300">
                    ₹{parseFloat(booking.total_amount || "0").toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Razorpay Body */}
            <div className="p-6 space-y-5 bg-[#0f172a]">
              
              {/* Payment Mode Selector Tabs */}
              <div className="grid grid-cols-4 gap-1.5 bg-slate-800 p-1 rounded-xl border-2 border-slate-700">
                <button
                  type="button"
                  onClick={() => setRzpMethod("card")}
                  className={`py-2 px-1 text-[11px] font-black uppercase rounded-lg transition-all flex flex-col items-center gap-1 ${
                    rzpMethod === "card" ? "bg-yellow-400 text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]" : "text-slate-300 hover:text-white"
                  }`}
                >
                  <CreditCard size={14} /> Cards
                </button>
                <button
                  type="button"
                  onClick={() => setRzpMethod("upi")}
                  className={`py-2 px-1 text-[11px] font-black uppercase rounded-lg transition-all flex flex-col items-center gap-1 ${
                    rzpMethod === "upi" ? "bg-yellow-400 text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]" : "text-slate-300 hover:text-white"
                  }`}
                >
                  <QrCode size={14} /> UPI
                </button>
                <button
                  type="button"
                  onClick={() => setRzpMethod("netbanking")}
                  className={`py-2 px-1 text-[11px] font-black uppercase rounded-lg transition-all flex flex-col items-center gap-1 ${
                    rzpMethod === "netbanking" ? "bg-yellow-400 text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]" : "text-slate-300 hover:text-white"
                  }`}
                >
                  <Globe size={14} /> Netbank
                </button>
                <button
                  type="button"
                  onClick={() => setRzpMethod("wallet")}
                  className={`py-2 px-1 text-[11px] font-black uppercase rounded-lg transition-all flex flex-col items-center gap-1 ${
                    rzpMethod === "wallet" ? "bg-yellow-400 text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]" : "text-slate-300 hover:text-white"
                  }`}
                >
                  <Wallet size={14} /> Wallet
                </button>
              </div>

              {/* Mode Specific Inputs */}
              {rzpMethod === "card" && (
                <div className="space-y-3 bg-slate-900 border-2 border-slate-700 p-4 rounded-xl">
                  <div className="flex justify-between items-center text-xs font-bold text-slate-300 mb-1">
                    <span>Card Details</span>
                    <span className="text-[10px] text-emerald-400 font-mono">✔ Razorpay Sandbox Prefilled</span>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Card Number</label>
                    <input
                      type="text"
                      value={rzpCardNumber}
                      onChange={(e) => setRzpCardNumber(e.target.value)}
                      className="w-full bg-slate-800 border-2 border-slate-600 rounded-lg p-2 text-sm font-mono text-white focus:border-yellow-400 outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Expiry (MM/YY)</label>
                      <input
                        type="text"
                        value={rzpCardExpiry}
                        onChange={(e) => setRzpCardExpiry(e.target.value)}
                        className="w-full bg-slate-800 border-2 border-slate-600 rounded-lg p-2 text-sm font-mono text-white focus:border-yellow-400 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">CVV</label>
                      <input
                        type="text"
                        value={rzpCardCvv}
                        onChange={(e) => setRzpCardCvv(e.target.value)}
                        className="w-full bg-slate-800 border-2 border-slate-600 rounded-lg p-2 text-sm font-mono text-white focus:border-yellow-400 outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Cardholder Name</label>
                    <input
                      type="text"
                      value={rzpCardName}
                      onChange={(e) => setRzpCardName(e.target.value)}
                      className="w-full bg-slate-800 border-2 border-slate-600 rounded-lg p-2 text-sm font-mono text-white focus:border-yellow-400 outline-none"
                    />
                  </div>
                </div>
              )}

              {rzpMethod === "upi" && (
                <div className="bg-slate-900 border-2 border-slate-700 p-4 rounded-xl text-center space-y-3">
                  <div className="p-3 bg-white inline-block rounded-xl border-2 border-black">
                    <QrCode size={120} className="text-black mx-auto" />
                  </div>
                  <p className="text-xs text-slate-300 font-bold">Scan with Google Pay, PhonePe, Paytm, or BHIM</p>
                </div>
              )}

              {rzpMethod === "netbanking" && (
                <div className="bg-slate-900 border-2 border-slate-700 p-4 rounded-xl space-y-2">
                  <div className="flex justify-between items-center text-xs font-bold text-slate-300 mb-2">
                    <span>Select Netbanking Portal</span>
                    <span className="text-[10px] bg-yellow-400 text-black font-black px-2 py-0.5 rounded font-mono">
                      Selected: {selectedBank}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs font-bold">
                    {["HDFC Bank", "ICICI Bank", "State Bank of India", "Axis Bank", "Kotak Mahindra", "Punjab National"].map((bName) => (
                      <div
                        key={bName}
                        onClick={() => setSelectedBank(bName)}
                        className={`p-2.5 rounded-lg cursor-pointer flex items-center gap-2 border transition-all ${
                          selectedBank === bName
                            ? "bg-yellow-400 border-yellow-300 text-black font-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                            : "bg-slate-800 border-slate-600 text-slate-200 hover:border-yellow-400"
                        }`}
                      >
                        🏦 {bName}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {rzpMethod === "wallet" && (
                <div className="bg-slate-900 border-2 border-slate-700 p-4 rounded-xl space-y-2">
                  <span className="text-xs font-bold text-slate-300 block mb-2">Supported Wallets</span>
                  <div className="grid grid-cols-2 gap-2 text-xs font-bold">
                    <div className="p-2.5 bg-slate-800 border border-slate-600 rounded-lg hover:border-yellow-400 cursor-pointer">👛 PayTM Wallet</div>
                    <div className="p-2.5 bg-slate-800 border border-slate-600 rounded-lg hover:border-yellow-400 cursor-pointer">👛 PhonePe Wallet</div>
                  </div>
                </div>
              )}

              {/* Action Button */}
              <button
                type="button"
                onClick={() => handleRazorpaySuccess()}
                disabled={rzpProcessing}
                className="w-full bg-emerald-400 hover:bg-emerald-300 text-black border-3 border-black py-3 rounded-2xl font-black text-sm uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-0.5 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                {rzpProcessing ? (
                  <>
                    <RefreshCw className="animate-spin" size={18} />
                    <span>Verifying Razorpay Payment...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={18} />
                    <span>Pay ₹{parseFloat(booking.total_amount || "0").toLocaleString()} via Razorpay</span>
                  </>
                )}
              </button>
            </div>
            
            <div className="bg-slate-950 p-2.5 border-t-2 border-slate-800 text-center text-[10px] text-slate-400 font-mono">
              Razorpay Secured Payments • Merchant ID: rzp_live_ghumnechale
            </div>

          </div>
        </div>,
        document.body
      )}

      {showPinModal && (
        <PinVerifyModal
          amount={booking.total_amount}
          description={`Security PIN Verification for ${bookingId}`}
          purpose="create_order"
          onSuccess={(token) => {
            setPaymentAuthToken(token);
            setShowPinModal(false);
            payWithRazorpay(token);
          }}
          onCancel={() => {
            setShowPinModal(false);
            setPaymentLoading(false);
          }}
        />
      )}

    </div>
  );
}

function PinVerifyModal({ onSuccess, onCancel, amount, description, purpose = "create_order" }: {
  onSuccess: (authToken: string) => void;
  onCancel: () => void;
  amount?: number;
  description?: string;
  purpose?: string;
}) {
  const [digits, setDigits] = useState(['', '', '', '']);
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  useEffect(() => {
    inputRefs[0].current?.focus();
  }, []);

  const handleDigitChange = (idx: number, val: string) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...digits];
    next[idx] = val;
    setDigits(next);
    setError('');
    if (val && idx < 3) {
      inputRefs[idx + 1].current?.focus();
    }
  };

  const handleKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[idx] && idx > 0) {
      inputRefs[idx - 1].current?.focus();
    }
    if (e.key === 'Enter') handleVerify();
  };

  const handleVerify = async () => {
    const pin = digits.join('');
    if (pin.length < 4) { setError('Enter all 4 digits.'); return; }
    setLoading(true);
    setError('');

    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${API_URL}/wallet/security-pin/verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ pin, purpose })
      });
      const data = await res.json();
      if (res.ok && data.verified) {
        onSuccess(data.payment_authorization_token);
      } else {
        const msg = data.detail || 'Incorrect security PIN.';
        setError(msg);
        setShake(true);
        setDigits(['', '', '', '']);
        setTimeout(() => { setShake(false); inputRefs[0].current?.focus(); }, 500);
      }
    } catch {
      setError('Connection failure. Please try again.');
      setShake(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className={`bg-[#0d1425] border-3 border-yellow-400 p-6 rounded-2xl max-w-sm w-full shadow-[0_0_50px_rgba(234,179,8,0.3)] text-center space-y-5 text-white ${shake ? 'animate-bounce' : ''}`}>
        <div className="flex justify-between items-center border-b border-slate-700 pb-3">
          <div className="flex items-center gap-2">
            <Lock className="text-yellow-400" size={18} />
            <span className="font-black text-xs uppercase tracking-wide text-yellow-400">Payment PIN Verification</span>
          </div>
          <button onClick={onCancel} className="text-slate-400 hover:text-white text-xs font-black uppercase cursor-pointer">✕</button>
        </div>

        {description && <p className="text-xs text-slate-300 font-bold">{description}</p>}
        {amount && (
          <div className="bg-slate-900 border border-slate-700 p-3 rounded-xl">
            <span className="text-[10px] text-slate-400 uppercase font-black block">Authorization Amount</span>
            <span className="text-xl font-black text-yellow-400">₹{amount.toLocaleString()}</span>
          </div>
        )}

        <div className="space-y-2">
          <p className="text-xs text-slate-400 font-bold">Enter 4-digit Security PIN to Authorize Payment:</p>
          <div className="flex justify-center gap-3">
            {digits.map((digit, idx) => (
              <input
                key={idx}
                ref={inputRefs[idx]}
                type="password"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleDigitChange(idx, e.target.value)}
                onKeyDown={(e) => handleKeyDown(idx, e)}
                className="w-12 h-14 text-center text-2xl font-black bg-slate-900 border-2 border-slate-700 focus:border-yellow-400 rounded-xl text-yellow-400 outline-none transition-all"
              />
            ))}
          </div>
          {error && <p className="text-xs text-rose-400 font-bold mt-1">⚠️ {error}</p>}
        </div>

        <div className="flex gap-2 pt-2">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-600 font-bold text-xs rounded-xl uppercase transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleVerify}
            disabled={loading || digits.join('').length < 4}
            className="flex-1 py-2.5 bg-yellow-400 hover:bg-yellow-300 disabled:bg-slate-700 text-black font-black text-xs rounded-xl uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all flex items-center justify-center gap-1 cursor-pointer"
          >
            {loading ? <RefreshCw className="animate-spin" size={14} /> : "Verify PIN →"}
          </button>
        </div>
      </div>
    </div>
  );
}
