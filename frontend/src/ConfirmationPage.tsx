import React, { useState, useEffect } from "react";
import { 
  CheckCircle, Calendar, ArrowRight, FileText, Download, 
  Printer, Share2, Mail, Copy, Check, Info, AlertTriangle, ExternalLink 
} from "lucide-react";

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

interface ConfirmationPageProps {
  bookingId: string;
  onNavigate: (path: string) => void;
}

export function ConfirmationPage({ bookingId, onNavigate }: ConfirmationPageProps) {
  const [details, setDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [emailStatus, setEmailStatus] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token') || null;

  useEffect(() => {
    const headers: any = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    fetch(`${API_URL}/bookings/${bookingId}`, { headers })
      .then(res => {
        if (!res.ok) throw new Error("Failed to load booking full details.");
        return res.json();
      })
      .then(data => {
        setDetails(data);
        // Cache locally for offline access (Phase 14)
        localStorage.setItem(`booking_cache_${bookingId}`, JSON.stringify(data));
      })
      .catch(err => {
        console.warn("Fetch failed, loading from offline cache...", err);
        const cached = localStorage.getItem(`booking_cache_${bookingId}`);
        if (cached) {
          setDetails(JSON.parse(cached));
        }
      })
      .finally(() => setLoading(false));
  }, [bookingId, token]);

  const handleDownloadPDF = async () => {
    try {
      const headers: any = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      
      const res = await fetch(`${API_URL}/bookings/${bookingId}/pdf`, { headers });
      if (!res.ok) throw new Error("Failed to compile ticket PDF.");
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `TravelOS_Ticket_${bookingId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err: any) {
      alert(err.message || "Error downloading PDF");
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleResendEmail = () => {
    const headers: any = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    setEmailStatus("sending");
    fetch(`${API_URL}/bookings/${bookingId}/email`, { 
      method: "POST", 
      headers 
    })
      .then(res => res.json())
      .then(data => {
        setEmailStatus("sent");
        setTimeout(() => setEmailStatus(""), 3000);
      })
      .catch(() => {
        setEmailStatus("error");
        setTimeout(() => setEmailStatus(""), 3000);
      });
  };

  const handleCopyId = () => {
    navigator.clipboard.writeText(bookingId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0f1d] text-white flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-400 font-bold tracking-widest uppercase">Verifying Reservation...</p>
        </div>
      </div>
    );
  }

  if (!details) {
    return (
      <div className="min-h-screen bg-[#0a0f1d] text-white flex items-center justify-center font-sans p-6">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 p-8 rounded-3xl text-center space-y-4">
          <AlertTriangle size={48} className="text-red-500 mx-auto" />
          <h2 className="text-xl font-black uppercase text-red-500">Booking Not Found</h2>
          <p className="text-xs text-slate-400">
            We couldn't retrieve confirmation data for reservation {bookingId}. Check your session status or contact support.
          </p>
          <button onClick={() => onNavigate("/")} className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded-xl text-xs uppercase cursor-pointer">
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const { booking, ticket, invoice, vertical } = details;

  return (
    <div className="min-h-screen bg-[#060814] text-white p-4 md:p-8 font-sans">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Success Header Card */}
        <div className="bg-gradient-to-br from-slate-900 to-blue-950/40 border border-blue-900/30 p-6 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-emerald-500/10 border border-emerald-500/30 rounded-full flex items-center justify-center text-emerald-400 shrink-0">
              <CheckCircle size={30} className="animate-bounce" />
            </div>
            <div className="space-y-1 text-left">
              <h2 className="text-2xl font-black uppercase text-emerald-400 tracking-wider">Booking Confirmed</h2>
              <p className="text-xs text-slate-400">Payment captured and seats/rooms successfully secured with carrier.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[10px] text-slate-400 font-bold uppercase">REF:</span>
            <span className="text-xs font-mono font-black bg-slate-950 border border-slate-800 px-3 py-1 rounded text-white flex items-center gap-1.5">
              {bookingId}
              <button onClick={handleCopyId} className="text-slate-500 hover:text-white transition-colors cursor-pointer" title="Copy reference">
                {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
              </button>
            </span>
          </div>
        </div>

        {/* Boarding Pass / Voucher Vertical Area */}
        {vertical === "flights" && ticket && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
            {/* Airline Header Bar */}
            <div className="bg-blue-600 px-6 py-4 flex justify-between items-center text-xs font-black uppercase tracking-wider">
              <div className="flex items-center gap-2">
                <span>✈️ {booking.airline_code || "6E"} AIRLINES</span>
                <span className="bg-blue-900/50 text-blue-200 px-2 py-0.5 rounded border border-blue-800/30 text-[9px]">{booking.cabin_class || "ECONOMY"} CLASS</span>
              </div>
              <div className="font-mono text-blue-200">FLIGHT {booking.flight_number || "502"}</div>
            </div>
            
            {/* Ticket Body */}
            <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2 space-y-4">
                <div className="flex justify-between items-center bg-slate-950/40 p-4 rounded-2xl border border-slate-850">
                  <div className="text-left">
                    <div className="text-2xl font-black text-white">{booking.origin || "DEL"}</div>
                    <div className="text-[10px] text-slate-500 font-bold">DEPARTURE PORT</div>
                  </div>
                  <div className="flex-1 flex flex-col items-center px-4">
                    <div className="w-full border-t border-dashed border-slate-800 relative">
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-slate-900 px-2 text-blue-500">✈️</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-black text-white">{booking.destination || "GOI"}</div>
                    <div className="text-[10px] text-slate-500 font-bold">ARRIVAL PORT</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-left text-xs bg-slate-950/20 p-4 rounded-2xl border border-slate-850">
                  <div>
                    <span className="text-slate-500 block text-[9px] font-bold">PASSENGER</span>
                    <strong className="text-slate-200">{ticket.passenger_details?.[0]?.name || "Traveler"}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[9px] font-bold">SEAT</span>
                    <strong className="text-blue-400 font-mono">{ticket.extra_info?.seat || "14C"}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[9px] font-bold">GATE</span>
                    <strong className="text-yellow-400 font-mono">{ticket.extra_info?.gate || "A1"}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[9px] font-bold">PNR RECORD</span>
                    <strong className="text-white font-mono">{ticket.pnr || "—"}</strong>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-left text-xs bg-slate-950/20 p-4 rounded-2xl border border-slate-850">
                  <div>
                    <span className="text-slate-500 block text-[9px] font-bold">DEPARTURE TIME</span>
                    <strong className="text-slate-200">{booking.departure_time ? new Date(booking.departure_time).toLocaleString() : "—"}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[9px] font-bold">BAGGAGE ALLOWANCE</span>
                    <strong className="text-slate-200">{ticket.extra_info?.baggage || "15 Kgs Check-in"}</strong>
                  </div>
                </div>
              </div>

              {/* QR Sidebar Code */}
              <div className="flex flex-col items-center justify-center bg-slate-950/40 p-4 rounded-2xl border border-slate-850 text-center space-y-3">
                <img 
                  src={ticket.qr_code_data || `/static/qrcodes/${bookingId}.png`} 
                  alt="Boarding Pass QR" 
                  className="w-32 h-32 bg-white p-2 rounded-xl border border-slate-800"
                />
                <div>
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Digital Boarding QR</div>
                  <div className="text-[9px] text-slate-600 mt-0.5">Scan to verify booking security code</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {vertical === "hotels" && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl text-left">
            <div className="bg-purple-600 px-6 py-4 flex justify-between items-center text-xs font-black uppercase tracking-wider">
              <span>🏨 LUXURY STAY RESERVATION VOUCHER</span>
              <span>{booking.room_type || "Deluxe Room"}</span>
            </div>
            
            <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2 space-y-4">
                <div>
                  <h3 className="text-xl font-black text-white">{booking.hotel_name || "Grand Palace Stay"}</h3>
                  <p className="text-xs text-slate-400 mt-1">📍 Address: {booking.address || "Goa Beachfront"}</p>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs bg-slate-950/40 p-4 rounded-2xl border border-slate-850">
                  <div>
                    <span className="text-slate-500 block text-[9px] font-bold">CHECK-IN</span>
                    <strong className="text-slate-200">{booking.check_in ? new Date(booking.check_in).toDateString() : "—"}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[9px] font-bold">CHECK-OUT</span>
                    <strong className="text-slate-200">{booking.check_out ? new Date(booking.check_out).toDateString() : "—"}</strong>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs bg-slate-950/40 p-4 rounded-2xl border border-slate-850">
                  <div>
                    <span className="text-slate-500 block text-[9px] font-bold">GUESTS DETAILS</span>
                    <strong className="text-slate-200">{booking.guest_details?.[0]?.name || "Primary Guest"}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[9px] font-bold">AMENITIES INCLUDED</span>
                    <strong className="text-emerald-400 font-semibold">Free High-Speed Wi-Fi, Breakfast buffet</strong>
                  </div>
                </div>
              </div>

              {/* QR Sidebar Code */}
              <div className="flex flex-col items-center justify-center bg-slate-950/40 p-4 rounded-2xl border border-slate-850 text-center space-y-3">
                <img 
                  src={ticket?.qr_code_data || `/static/qrcodes/${bookingId}.png`} 
                  alt="Hotel Stay QR" 
                  className="w-32 h-32 bg-white p-2 rounded-xl border border-slate-800"
                />
                <div className="space-y-1">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Hotel Reservation ID</div>
                  <div className="text-[9px] text-slate-500 font-mono">{bookingId}</div>
                  {booking.address && (
                    <a 
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(booking.hotel_name + " " + booking.address)}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-[9px] text-blue-400 hover:underline flex items-center justify-center gap-1 mt-1.5"
                    >
                      🗺️ Open Google Maps <ExternalLink size={10} />
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Fallback generic vertical card */}
        {vertical !== "flights" && vertical !== "hotels" && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-left space-y-4 shadow-2xl">
            <div className="border-b border-slate-800 pb-3 flex justify-between items-center">
              <div>
                <span className="text-[9px] bg-blue-900/40 text-blue-300 border border-blue-800/30 px-2.5 py-0.5 rounded font-black uppercase">
                  {vertical.toUpperCase()} BOOKING
                </span>
                <h3 className="text-lg font-black text-white mt-1.5">Reservation Confirmed</h3>
              </div>
              <img 
                src={ticket?.qr_code_data || `/static/qrcodes/${bookingId}.png`} 
                alt="Booking QR" 
                className="w-20 h-20 bg-white p-1 rounded-lg border border-slate-800"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-xs bg-slate-950/20 p-4 rounded-xl border border-slate-850">
              <div>
                <span className="text-slate-500 block text-[9px] font-bold">TOTAL AMOUNT</span>
                <strong className="text-emerald-400">₹{booking.total_amount.toLocaleString()}</strong>
              </div>
              <div>
                <span className="text-slate-500 block text-[9px] font-bold">BOOKING DATE</span>
                <strong className="text-slate-200">{booking.created_at ? new Date(booking.created_at).toDateString() : "Now"}</strong>
              </div>
            </div>
          </div>
        )}

        {/* Payment Receipt Box */}
        {invoice && (
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl text-left space-y-4 shadow-xl">
            <h4 className="text-xs font-black uppercase tracking-wider text-blue-400 border-b border-slate-800 pb-2">
              Payment & Invoice Receipt Details
            </h4>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div>
                <span className="text-slate-500 block text-[9px] font-bold">INVOICE NUMBER</span>
                <strong className="font-mono text-slate-300">{invoice.invoice_number}</strong>
              </div>
              <div>
                <span className="text-slate-500 block text-[9px] font-bold">GST COMPLIANCE</span>
                <strong className="font-mono text-slate-300">{invoice.gst_number || "07TRVOS9921A1Z0"}</strong>
              </div>
              <div>
                <span className="text-slate-500 block text-[9px] font-bold">PAYMENT METHOD</span>
                <strong className="uppercase text-slate-300">{invoice.payment_method}</strong>
              </div>
              <div>
                <span className="text-slate-500 block text-[9px] font-bold">TRANSACTION STATUS</span>
                <strong className="text-emerald-400 font-bold">CAPTURED & CLEAR</strong>
              </div>
            </div>

            <div className="border-t border-slate-800 pt-3 flex justify-between items-center text-xs">
              <span className="text-slate-400">Base Amount + Fees: ₹{floatToDecimal(invoice.base_amount)} + ₹{floatToDecimal(invoice.tax_amount)}</span>
              <span className="font-extrabold text-sm text-white">
                Final Amount Paid: <strong className="text-emerald-400">₹{invoice.final_amount.toLocaleString()}</strong>
              </span>
            </div>
          </div>
        )}

        {/* Action Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2">
          <button
            onClick={handleDownloadPDF}
            className="bg-blue-600 hover:bg-blue-500 border border-blue-500/20 font-black py-3 px-4 rounded-xl text-[10px] uppercase tracking-wider cursor-pointer text-white transition-all flex items-center justify-center gap-2 shadow"
          >
            <Download size={14} /> Download PDF Ticket
          </button>
          
          <button
            onClick={handlePrint}
            className="bg-slate-900 hover:bg-slate-850 border border-slate-800 font-black py-3 px-4 rounded-xl text-[10px] uppercase tracking-wider cursor-pointer text-slate-300 transition-all flex items-center justify-center gap-2"
          >
            <Printer size={14} /> Print Document
          </button>
          
          <button
            onClick={handleResendEmail}
            disabled={emailStatus === "sending" || emailStatus === "sent"}
            className="bg-slate-900 hover:bg-slate-850 border border-slate-800 font-black py-3 px-4 rounded-xl text-[10px] uppercase tracking-wider cursor-pointer text-slate-300 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Mail size={14} /> 
            {emailStatus === "sending" ? "Resending..." : emailStatus === "sent" ? "Resent! 🎉" : "Resend Email"}
          </button>
          
          <button
            onClick={() => onNavigate(`/booking/${bookingId}`)}
            className="bg-yellow-400 hover:bg-yellow-500 text-slate-950 font-black py-3 px-4 rounded-xl text-[10px] uppercase tracking-wider cursor-pointer transition-all flex items-center justify-center gap-1.5 shadow"
          >
            View Live Timeline <ArrowRight size={14} />
          </button>
        </div>

      </div>
    </div>
  );
}

function floatToDecimal(val: any): string {
  return Number(val || 0).toFixed(2);
}
