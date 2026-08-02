import React, { useState, useEffect, useRef } from "react";
import { CreditCard, QrCode, Globe, Wallet, ShieldAlert, ArrowLeft, RefreshCw, Clock } from "lucide-react";

interface CheckoutPageProps {
  bookingId: string;
  onNavigate: (path: string) => void;
}

export function CheckoutPage({ bookingId, onNavigate }: CheckoutPageProps) {
  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"card" | "upi" | "netbanking" | "wallet">("card");
  
  // Payment states
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [qrCodeId, setQrCodeId] = useState<string | null>(null);
  const [qrTimeLeft, setQrTimeLeft] = useState(300); // 5 minutes
  const [holdTimeLeft, setHoldTimeLeft] = useState(600); // 10 minutes booking hold
  const [paymentStatus, setPaymentStatus] = useState<string>("none"); // none, pending, captured, failed, expired
  const [humanApproved, setHumanApproved] = useState(false);
  
  const pollingIntervalRef = useRef<any>(null);
  const qrExpiryIntervalRef = useRef<any>(null);
  const holdExpiryIntervalRef = useRef<any>(null);

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

  const fetchBookingDetails = async () => {
    setLoading(true);
    setError("");
    try {
      const statusRes = await fetch(`http://localhost:8000/api/v1/payments/status/${bookingId}`);
      if (!statusRes.ok) throw new Error("Failed to load booking details");
      
      const statusData = await statusRes.json();
      
      setBooking({
        booking_reference: bookingId,
        title: `Travel OS Booking ${bookingId}`,
        total_amount: 1500, // standard test amount
        currency: "INR",
        vertical: bookingId.split("-")[1]?.toLowerCase() || "flight",
        traveler_name: "Guest Traveler"
      });
      
      setPaymentStatus(statusData.status);
      
      if (statusData.status === "captured") {
        onNavigate(`/bookings/${bookingId}/confirmation`);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load booking details");
    } finally {
      setLoading(false);
    }
  };

  // 2. Poll payment status (used for UPI QR)
  const startPolling = () => {
    if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    
    pollingIntervalRef.current = setInterval(async () => {
      try {
        const res = await fetch(`http://localhost:8000/api/v1/payments/status/${bookingId}`);
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
    if (!humanApproved) {
      setError("Please check the 'Approve Payment Transaction' checkbox first to proceed.");
      return;
    }
    setPaymentLoading(true);
    setError("");
    try {
      const res = await fetch(`http://localhost:8000/api/v1/payments/create-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          booking_id: bookingId,
          amount: booking.total_amount,
          currency: "INR",
          method: "upi",
          human_approved: humanApproved
        })
      });
      
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Failed to generate UPI QR");
      }
      
      const data = await res.json();
      setQrCodeUrl(data.qr_code_url);
      setQrCodeId(data.qr_code_id);
      setPaymentStatus("pending");
      setQrTimeLeft(300); // Reset 5-minute timer
      
      startPolling();
      
      if (qrExpiryIntervalRef.current) clearInterval(qrExpiryIntervalRef.current);
      qrExpiryIntervalRef.current = setInterval(() => {
        setQrTimeLeft((prev) => {
          if (prev <= 1) {
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
      setError(err.message || "Failed to initialize QR Payment");
    } finally {
      setPaymentLoading(false);
    }
  };

  // 4. Load & trigger Razorpay Checkout.js (Standard Cards/Netbanking/Wallets)
  const payWithRazorpay = async () => {
    if (!humanApproved) {
      setError("Please check the 'Approve Payment Transaction' checkbox first to proceed.");
      return;
    }
    setPaymentLoading(true);
    setError("");
    try {
      const orderRes = await fetch(`http://localhost:8000/api/v1/payments/create-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          booking_id: bookingId,
          amount: booking.total_amount,
          currency: "INR",
          method: activeTab,
          human_approved: humanApproved
        })
      });
      
      if (!orderRes.ok) {
        const errData = await orderRes.json();
        throw new Error(errData.detail || "Failed to initiate payment");
      }
      
      const orderData = await orderRes.json();
      
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
      if (!loaded) {
        throw new Error("Failed to load Razorpay SDK. Check your internet connection.");
      }
      
      const options = {
        key: orderData.razorpay_key_id,
        amount: orderData.amount * 100,
        currency: orderData.currency,
        name: "Travel OS",
        description: `Payment for booking ${bookingId}`,
        order_id: orderData.razorpay_order_id,
        handler: async function (response: any) {
          setPaymentLoading(true);
          try {
            const verifyRes = await fetch(`http://localhost:8000/api/v1/payments/verify`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature
              })
            });
            
            if (!verifyRes.ok) {
              const verifyErr = await verifyRes.json();
              throw new Error(verifyErr.detail || "Payment verification failed.");
            }
            
            setPaymentStatus("captured");
            onNavigate(`/bookings/${bookingId}/confirmation`);
          } catch (err: any) {
            setError(err.message || "Payment verification failed.");
            setPaymentStatus("failed");
          } finally {
            setPaymentLoading(false);
          }
        },
        prefill: {
          name: "Traveler",
          email: "traveler@travelos.com",
          contact: "9876543210"
        },
        theme: {
          color: "#facc15"
        }
      };
      
      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } catch (err: any) {
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
          
          <h1 className="text-3xl font-black italic uppercase tracking-wider bg-yellow-300 border-3 border-black px-4 py-1.5 rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            SECURE CHECKOUT
          </h1>
          
          <div className="bg-rose-100 border-3 border-rose-600 px-3 py-1.5 rounded-xl text-xs font-black text-rose-600 animate-pulse flex items-center gap-1.5">
            <Clock size={14} /> Hold Timer: {formatTime(holdTimeLeft)}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Left Panel: Payment Methods */}
          <div className="md:col-span-8 space-y-6">
            
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
              <h3 className="font-black uppercase text-sm tracking-wide mb-3 italic">Select Payment Mode:</h3>
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
                        disabled={paymentLoading}
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
                    disabled={paymentLoading}
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
              <h3 className="font-black text-lg italic uppercase tracking-wide border-b-2 border-black pb-2">
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
