import React, { useState, useEffect } from "react";
import { 
  CheckCircle, Calendar, ArrowRight, FileText, Download, 
  Printer, Share2, Mail, Copy, Check, Info, AlertTriangle, ExternalLink, MessageSquare, Phone 
} from "lucide-react";

import { API_BASE, API_URL } from './config/api';

interface ConfirmationPageProps {
  bookingId: string;
  onNavigate: (path: string) => void;
}

export function ConfirmationPage({ bookingId, onNavigate }: ConfirmationPageProps) {
  const [details, setDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [emailStatus, setEmailStatus] = useState<string>("");
  const [smsStatus, setSmsStatus] = useState<string>("");
  const [whatsappStatus, setWhatsappStatus] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState<{ show: boolean; message: string }>({ show: false, message: "" });
  const [showPdfModal, setShowPdfModal] = useState(false);

  const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token') || null;

  const showToast = (msg: string) => {
    setToast({ show: true, message: msg });
    setTimeout(() => setToast({ show: false, message: "" }), 3000);
  };

  useEffect(() => {
    const headers: any = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    fetch(`${API_URL}/bookings/${bookingId}`, { headers })
      .then(res => {
        if (!res.ok) throw new Error("Failed to load booking details.");
        return res.json();
      })
      .then(data => {
        setDetails(data);
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
      
      const res = await fetch(`${API_URL}/bookings/${bookingId}/ticket?download=true`, { headers });
      if (!res.ok) throw new Error("Failed to compile ticket PDF.");
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `GhumneChale_Ticket_${bookingId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      showToast("📥 PDF ticket downloaded successfully!");
    } catch (err: any) {
      alert(err.message || "Error downloading PDF");
    }
  };

  const handleDownloadInvoice = () => {
    if (!details || !details.invoice) return;
    const inv = details.invoice;
    const receiptText = `
==================================================
                GHUMNE CHALE INVOICE                 
==================================================
Invoice Date : ${new Date(inv.created_at || Date.now()).toLocaleString()}
Reference    : ${bookingId}
GST Number   : ${inv.gst_number || "07TRVOS9921A1Z0"}
Payment Mode : ${(inv.payment_method || "card").toUpperCase()}
--------------------------------------------------
ITEM DESCRIPTION                         AMOUNT   
--------------------------------------------------
Base Fare                                ₹${floatToDecimal(inv.base_amount)}
Taxes & Fees                            ₹${floatToDecimal(inv.tax_amount)}
Discounts                              -₹${floatToDecimal(inv.discount_amount)}
--------------------------------------------------
TOTAL AMOUNT PAID                        ₹${floatToDecimal(inv.final_amount)}
==================================================
Thank you for booking with Ghumne Chale!
==================================================
`;
    const blob = new Blob([receiptText], { type: "text/plain" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `GhumneChale_Invoice_${bookingId}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    showToast("📥 Invoice downloaded successfully!");
  };

  const handlePrint = () => {
    window.print();
  };

  const handleResendEmail = () => {
    const headers: any = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    setEmailStatus("sending");
    fetch(`${API_URL}/bookings/${bookingId}/email`, { method: "POST", headers })
      .then(res => res.json())
      .then(() => {
        setEmailStatus("sent");
        showToast("📧 Confirmation email resent successfully!");
        setTimeout(() => setEmailStatus(""), 3000);
      })
      .catch(() => {
        setEmailStatus("error");
        setTimeout(() => setEmailStatus(""), 3000);
      });
  };

  const handleTriggerSMS = () => {
    const headers: any = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    setSmsStatus("sending");
    fetch(`${API_URL}/bookings/${bookingId}/sms`, { method: "POST", headers })
      .then(res => res.json())
      .then(() => {
        setSmsStatus("sent");
        showToast("📱 Confirmation SMS sent to verified customer phone!");
        setTimeout(() => setSmsStatus(""), 3000);
      })
      .catch(() => {
        setSmsStatus("");
      });
  };

  const handleTriggerWhatsApp = () => {
    const headers: any = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    setWhatsappStatus("sending");
    fetch(`${API_URL}/bookings/${bookingId}/whatsapp`, { method: "POST", headers })
      .then(res => res.json())
      .then(() => {
        setWhatsappStatus("sent");
        showToast("💬 WhatsApp reservation receipt dispatched successfully!");
        setTimeout(() => setWhatsappStatus(""), 3000);
      })
      .catch(() => {
        setWhatsappStatus("");
      });
  };

  const handleExportCalendar = () => {
    if (!details) return;
    const { booking, ticket, vertical } = details;
    const isHotel = vertical === "hotels";
    
    const summary = isHotel 
      ? `Hotel Stay: ${booking.hotel_name}`
      : `Flight: ${booking.airline_code}-${booking.flight_number} (${booking.origin} to ${booking.destination})`;
      
    const desc = isHotel
      ? `Check-in: ${new Date(booking.check_in).toDateString()}\nRoom type: ${booking.room_type}\nAddress: ${booking.address}`
      : `Boarding time: ${ticket?.extra_info?.boarding_time || "45 mins before departure"}\nSeat: ${ticket?.extra_info?.seat || "14C"}\nPNR: ${ticket?.pnr}`;
      
    const startDate = isHotel ? new Date(booking.check_in) : new Date(booking.departure_time);
    const endDate = isHotel ? new Date(booking.check_out) : new Date(booking.arrival_time);
    
    const formatICSDate = (date: Date) => {
      return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    };
    
    const icsString = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Ghumne Chale//Booking Calendar//EN",
      "BEGIN:VEVENT",
      `UID:booking_${bookingId}@travelos.com`,
      `DTSTART:${formatICSDate(startDate)}`,
      `DTEND:${formatICSDate(endDate)}`,
      `SUMMARY:${summary}`,
      `DESCRIPTION:${desc}`,
      `LOCATION:${isHotel ? booking.address || "" : booking.origin}`,
      "END:VEVENT",
      "END:VCALENDAR"
    ].join("\n");
    
    const blob = new Blob([icsString], { type: "text/calendar" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Booking_${bookingId}.ics`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    
    showToast("📅 Calendar event (.ics) downloaded successfully!");
  };

  const handleCopyId = () => {
    navigator.clipboard.writeText(bookingId);
    setCopied(true);
    showToast("📋 Booking ID copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const Barcode = () => (
    <svg className="w-full h-8 opacity-80 mt-1" viewBox="0 0 100 20" preserveAspectRatio="none">
      <rect x="0" y="0" width="2" height="20" fill="currentColor" />
      <rect x="4" y="0" width="1" height="20" fill="currentColor" />
      <rect x="7" y="0" width="3" height="20" fill="currentColor" />
      <rect x="12" y="0" width="1" height="20" fill="currentColor" />
      <rect x="15" y="0" width="2" height="20" fill="currentColor" />
      <rect x="20" y="0" width="4" height="20" fill="currentColor" />
      <rect x="26" y="0" width="1" height="20" fill="currentColor" />
      <rect x="29" y="0" width="3" height="20" fill="currentColor" />
      <rect x="34" y="0" width="2" height="20" fill="currentColor" />
      <rect x="38" y="0" width="1" height="20" fill="currentColor" />
      <rect x="41" y="0" width="4" height="20" fill="currentColor" />
      <rect x="47" y="0" width="2" height="20" fill="currentColor" />
      <rect x="51" y="0" width="1" height="20" fill="currentColor" />
      <rect x="54" y="0" width="3" height="20" fill="currentColor" />
      <rect x="59" y="0" width="2" height="20" fill="currentColor" />
      <rect x="63" y="0" width="1" height="20" fill="currentColor" />
      <rect x="66" y="0" width="4" height="20" fill="currentColor" />
      <rect x="72" y="0" width="2" height="20" fill="currentColor" />
      <rect x="76" y="0" width="1" height="20" fill="currentColor" />
      <rect x="79" y="0" width="3" height="20" fill="currentColor" />
      <rect x="84" y="0" width="2" height="20" fill="currentColor" />
      <rect x="88" y="0" width="4" height="20" fill="currentColor" />
      <rect x="94" y="0" width="1" height="20" fill="currentColor" />
      <rect x="97" y="0" width="3" height="20" fill="currentColor" />
    </svg>
  );

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

  const ticketTypeLabel = vertical === "flights" 
    ? "FLIGHT TICKET" 
    : vertical === "hotels" 
      ? "HOTEL VOUCHER" 
      : `${(vertical || "booking").slice(0, -1).toUpperCase()} TICKET`;

  const getCenteredLine = (text: string) => {
    const totalWidth = 32;
    const content = `✓ ${text}`;
    const leftPad = Math.max(0, Math.floor((totalWidth - content.length) / 2));
    const rightPad = Math.max(0, totalWidth - content.length - leftPad);
    return `${" ".repeat(leftPad)}${content}${" ".repeat(rightPad)}`;
  };

  const headerLine = getCenteredLine(`${ticketTypeLabel} CONFIRMED`);

  return (
    <div className="min-h-screen bg-[#060814] text-white p-4 md:p-8 font-sans relative">
      {/* Toast Notification (Phase 12) */}
      {toast.show && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-[#0f172a] border border-blue-500/30 text-xs font-bold px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2 text-blue-200 animate-[fadeIn_0.15s_ease-out]">
          <Info size={14} className="text-blue-400" />
          {toast.message}
        </div>
      )}

      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Success Header Card */}
        <div className="bg-gradient-to-br from-slate-900 to-blue-950/40 border border-blue-900/30 p-6 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-emerald-500/10 border border-emerald-500/30 rounded-full flex items-center justify-center text-emerald-400 shrink-0">
              <CheckCircle size={30} className="animate-bounce" />
            </div>
            <div className="space-y-1 text-left">
              <pre className="font-mono text-xs text-emerald-400 leading-normal font-black">
{`╔════════════════════════════════╗
${headerLine}
╚════════════════════════════════╝`}
              </pre>
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

        {(() => {
          const pendingReturnRef = localStorage.getItem("pending_return_booking_ref");
          if (!pendingReturnRef) return null;
          return (
            <div className="bg-yellow-950/40 border-2 border-yellow-500 text-yellow-250 p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-left animate-pulse">
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="text-yellow-450 shrink-0" size={18} />
                <div>
                  <strong className="block text-white uppercase tracking-wider text-[11px]">⚠️ Action Required: Pending Return Ticket</strong>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Your onward bus ticket is secured! Finish the booking process by paying for the return journey ({pendingReturnRef}).</span>
                </div>
              </div>
              <button
                onClick={() => {
                  localStorage.removeItem("pending_return_booking_ref");
                  onNavigate(`/checkout/${pendingReturnRef}`);
                }}
                className="bg-yellow-300 hover:bg-yellow-400 text-black border-2 border-black font-black px-4.5 py-2 rounded-xl text-[10px] uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-0.5 active:shadow-none transition-all cursor-pointer shrink-0"
              >
                Complete Return Payment →
              </button>
            </div>
          );
        })()}

        {/* Quick status bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs bg-slate-900 border border-slate-800 p-4 rounded-2xl">
          <div className="flex items-center gap-2 justify-center sm:justify-start">
            <span className="text-slate-500 font-bold">PNR:</span>
            <strong className="text-white font-mono text-sm">{ticket?.pnr || "GENERATING..."}</strong>
          </div>
          <div className="flex items-center gap-2 justify-center sm:justify-start">
            <span className="text-slate-500 font-bold">PAYMENT:</span>
            <span className="text-emerald-400 font-bold">✓ PAID</span>
          </div>
          <div className="flex items-center gap-2 justify-center sm:justify-start">
            <span className="text-slate-500 font-bold">TICKET:</span>
            <span className="text-emerald-400 font-bold">✓ READY</span>
          </div>
          <div className="flex items-center gap-2 justify-center sm:justify-start">
            <span className="text-slate-500 font-bold">TYPE:</span>
            <span className="text-blue-400 font-black uppercase">{ticketTypeLabel}</span>
          </div>
        </div>

        {/* Boarding Pass / Voucher Vertical Area */}
        {vertical === "flights" && ticket && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col md:flex-row items-stretch">
            {/* Left Boarding Info Section (2/3 width) */}
            <div className="flex-1 p-6 space-y-4">
              <div className="flex justify-between items-center text-xs font-black uppercase tracking-wider text-blue-400">
                <span>✈️ {booking.airline_code || "6E"} AIRLINES</span>
                <span className="bg-blue-950 border border-blue-900/30 px-2 py-0.5 rounded text-[8px]">{booking.cabin_class || "ECONOMY"} CLASS</span>
              </div>
              
              <div className="flex justify-between items-center bg-slate-950/40 p-4 rounded-2xl border border-slate-850">
                <div className="text-left">
                  <div className="text-3xl font-black text-white">{booking.origin || "DEL"}</div>
                  <div className="text-[9px] text-slate-500 font-bold">DEPARTURE PORT</div>
                </div>
                <div className="flex-1 flex flex-col items-center px-4">
                  <div className="w-full border-t border-dashed border-slate-800 relative">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-slate-900 px-2 text-blue-500">✈️</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-black text-white">{booking.destination || "GOI"}</div>
                  <div className="text-[9px] text-slate-500 font-bold">ARRIVAL PORT</div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-left text-xs bg-slate-950/20 p-4 rounded-2xl border border-slate-850">
                <div>
                  <span className="text-slate-500 block text-[9px] font-bold">PASSENGER</span>
                  <strong className="text-slate-200">{ticket.passenger_details?.map((p: any) => p.fullName || p.name).join(", ") || "Traveler"}</strong>
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

            {/* Perforated Divider */}
            <div className="hidden md:flex flex-col items-center justify-between py-4 relative">
              <div className="w-4 h-4 rounded-full bg-[#060814] -mt-6 z-10" />
              <div className="border-l border-dashed border-slate-700 h-full mx-2" />
              <div className="w-4 h-4 rounded-full bg-[#060814] -mb-6 z-10" />
            </div>

            {/* Right Passenger Stub (1/3 width) */}
            <div className="w-full md:w-64 bg-slate-950/20 p-6 flex flex-col justify-between border-t md:border-t-0 md:border-l border-slate-800 text-left">
              <div className="space-y-4">
                <div className="flex justify-between items-center text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  <span>Passenger Stub</span>
                  <span className="text-blue-500">{booking.flight_number || "502"}</span>
                </div>
                <div className="space-y-1.5 text-xs">
                  <div>
                    <span className="text-[9px] text-slate-500 block">PASSENGER NAME</span>
                    <strong className="text-slate-300">{ticket.passenger_details?.map((p: any) => p.fullName || p.name).join(", ") || "Traveler"}</strong>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 block">SEAT / CABIN</span>
                    <strong className="text-slate-300 font-mono">{ticket.extra_info?.seat || "14C"} ({booking.cabin_class || "ECONOMY"})</strong>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 block">FLIGHT ROUTE</span>
                    <strong className="text-slate-300">{booking.origin} ➔ {booking.destination}</strong>
                  </div>
                </div>
              </div>

              {/* QR and Barcode area */}
              <div className="mt-6 flex flex-col items-center gap-2">
                <img 
                  src={ticket.qr_code_data || `/static/qrcodes/${bookingId}.png`} 
                  alt="Boarding Pass QR" 
                  className="w-24 h-24 bg-white p-1 rounded-lg border border-slate-800"
                />
                <Barcode />
              </div>
            </div>
          </div>
        )}

        {vertical === "hotels" && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl text-left flex flex-col md:flex-row">
            <div className="flex-1 p-6 space-y-4">
              <div className="flex justify-between items-center text-xs font-black uppercase tracking-wider text-purple-400">
                <span>🏨 LUXURY STAY RESERVATION VOUCHER</span>
                <span className="bg-purple-950 border border-purple-900/30 px-2 py-0.5 rounded text-[8px]">{booking.room_type || "Deluxe Room"}</span>
              </div>
              
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
                  <span className="text-slate-500 block text-[9px] font-bold">INCLUSIONS</span>
                  <span className="text-emerald-400 font-black block">✓ Free Buffet Breakfast & High-Speed Wi-Fi</span>
                </div>
              </div>
            </div>

            {/* Perforated Divider */}
            <div className="hidden md:flex flex-col items-center justify-between py-4 relative">
              <div className="w-4 h-4 rounded-full bg-[#060814] -mt-6 z-10" />
              <div className="border-l border-dashed border-slate-700 h-full mx-2" />
              <div className="w-4 h-4 rounded-full bg-[#060814] -mb-6 z-10" />
            </div>

            {/* Right Hotel Stub */}
            <div className="w-full md:w-64 bg-slate-950/20 p-6 flex flex-col justify-between border-t md:border-t-0 md:border-l border-slate-800 text-center">
              <div className="space-y-4">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block text-left">Reservation Stub</span>
                <div className="text-xs text-left space-y-1.5">
                  <div>
                    <span className="text-[9px] text-slate-500 block">CONFIRMATION ID</span>
                    <strong className="text-slate-300 font-mono">{bookingId}</strong>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 block">POLICY DETAILS</span>
                    <span className="text-rose-400 font-bold block">Free cancellation 24h prior</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex flex-col items-center gap-2">
                <img 
                  src={ticket?.qr_code_data || `/static/qrcodes/${bookingId}.png`} 
                  alt="Hotel Stay QR" 
                  className="w-24 h-24 bg-white p-1 rounded-lg border border-slate-800"
                />
                {booking.address && (
                  <a 
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(booking.hotel_name + " " + booking.address)}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-[9px] text-blue-400 hover:underline flex items-center justify-center gap-1 mt-1"
                  >
                    Open Google Maps <ExternalLink size={10} />
                  </a>
                )}
              </div>
            </div>
          </div>
        )}

        {vertical === "buses" && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl text-left flex flex-col md:flex-row">
            {/* Left Ticket Main Section */}
            <div className="flex-1 p-6 space-y-4">
              <div className="flex justify-between items-center text-xs font-black uppercase tracking-wider text-yellow-400">
                <span>🚌 INTERCITY BUS TICKET VOUCHER</span>
                <span className="bg-yellow-950/80 text-yellow-300 border border-yellow-900/30 px-2 py-0.5 rounded text-[8px]">
                  {booking.bus_type || "AC Sleeper"}
                </span>
              </div>
              
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-xl font-black text-white">{booking.operator_name || "Ghumne Chale Express"}</h3>
                  <p className="text-xs text-slate-400 mt-1">Route: {booking.origin} ➔ {booking.destination}</p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-500 block">JOURNEY DATE</span>
                  <strong className="text-slate-200 text-xs">{booking.departure_time ? new Date(booking.departure_time).toDateString() : "—"}</strong>
                </div>
              </div>

              {/* Boarding and Dropping details with Landmarks */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs bg-slate-950/40 p-4 rounded-2xl border border-slate-850">
                <div>
                  <span className="text-blue-400 block text-[9px] font-black uppercase tracking-wider mb-1">🏁 BOARDING POINT</span>
                  <strong className="text-slate-200 font-extrabold block text-sm">
                    {booking.pricing_snapshot?.boarding_point?.time || "—"} - {booking.pricing_snapshot?.boarding_point?.name || "—"}
                  </strong>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    {booking.pricing_snapshot?.boarding_point?.address || "—"}
                  </span>
                  {booking.pricing_snapshot?.boarding_point?.landmark && (
                    <span className="text-[10px] text-yellow-500/90 font-bold block mt-1">
                      📍 Landmark: {booking.pricing_snapshot.boarding_point.landmark}
                    </span>
                  )}
                </div>
                <div>
                  <span className="text-rose-400 block text-[9px] font-black uppercase tracking-wider mb-1">📍 DROPPING POINT</span>
                  <strong className="text-slate-200 font-extrabold block text-sm">
                    {booking.pricing_snapshot?.dropping_point?.time || "—"} - {booking.pricing_snapshot?.dropping_point?.name || "—"}
                  </strong>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    {booking.pricing_snapshot?.dropping_point?.address || "—"}
                  </span>
                  {booking.pricing_snapshot?.dropping_point?.landmark && (
                    <span className="text-[10px] text-yellow-500/90 font-bold block mt-1">
                      📍 Landmark: {booking.pricing_snapshot.dropping_point.landmark}
                    </span>
                  )}
                </div>
              </div>

              {/* Passengers details table */}
              <div className="space-y-2">
                <span className="text-slate-500 block text-[9px] font-black uppercase tracking-widest">Traveler details</span>
                <div className="bg-slate-950/40 border border-slate-850 rounded-2xl p-3 divide-y divide-slate-850 space-y-2">
                  {(booking.pricing_snapshot?.passenger_details || ticket?.passenger_details || []).map((p: any, idx: number) => (
                    <div key={idx} className="flex justify-between items-center text-xs pt-2 first:pt-0">
                      <div>
                        <strong className="text-slate-200 block">{p.name}</strong>
                        <span className="text-[10px] text-slate-500 font-bold uppercase">AGE: {p.age} | GENDER: {p.gender || "Male"}</span>
                      </div>
                      <div className="text-right">
                        <span className="bg-yellow-950/80 text-yellow-400 border border-yellow-900/40 px-2 py-0.5 rounded font-mono font-black text-[10px]">
                          SEAT {p.seat_number || booking.seat_numbers?.[idx] || "—"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Perforated Divider */}
            <div className="hidden md:flex flex-col items-center justify-between py-4 relative">
              <div className="w-4 h-4 rounded-full bg-[#060814] -mt-6 z-10" />
              <div className="border-l border-dashed border-slate-700 h-full mx-2" />
              <div className="w-4 h-4 rounded-full bg-[#060814] -mb-6 z-10" />
            </div>

            {/* Right Bus Ticket Stub */}
            <div className="w-full md:w-64 bg-slate-950/20 p-6 flex flex-col justify-between border-t md:border-t-0 md:border-l border-slate-800 text-center">
              <div className="space-y-4">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block text-left">Bus Ticket Stub</span>
                <div className="text-xs text-left space-y-2 bg-slate-950/40 p-3 rounded-xl border border-slate-850">
                  <div>
                    <span className="text-[9px] text-slate-500 block">PNR NUMBER</span>
                    <strong className="text-slate-200 font-mono text-sm tracking-wide">{ticket?.pnr || "BK-PNR-PENDING"}</strong>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 block">TICKET STATUS</span>
                    <span className="text-emerald-400 font-bold block uppercase">{booking.status || "CONFIRMED"}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 block">BOARDING PIN</span>
                    <strong className="text-slate-300 font-mono">{bookingId.split('-')[1] || bookingId.slice(-6)}</strong>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex flex-col items-center gap-2">
                <img 
                  src={ticket?.qr_code_data || `/static/qrcodes/${bookingId}.png`} 
                  alt="Bus QR" 
                  className="w-24 h-24 bg-white p-1 rounded-lg border border-slate-800"
                />
                <span className="text-[8px] text-slate-500 uppercase font-black tracking-wider">Show QR code at boarding</span>
              </div>
            </div>
          </div>
        )}

        {/* Fallback generic vertical card */}
        {vertical !== "flights" && vertical !== "hotels" && vertical !== "buses" && (
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
              <span className="text-slate-400">
                Base Fare: ₹{floatToDecimal(invoice.base_amount)} 
                {parseFloat(invoice.discount_amount) > 0 && ` - Discount: ₹${floatToDecimal(invoice.discount_amount)}`} 
                + Taxes: ₹{floatToDecimal(invoice.tax_amount)}
              </span>
              <span className="font-extrabold text-sm text-white">
                Final Amount Paid: <strong className="text-emerald-400">₹{invoice.final_amount.toLocaleString()}</strong>
              </span>
            </div>
          </div>
        )}

        {/* Passenger special fare table */}
        {vertical === "flights" && ticket && ticket.passenger_details && (
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl text-left space-y-3 shadow-xl">
            <h4 className="text-xs font-black uppercase tracking-wider text-blue-400 border-b border-slate-800 pb-2">
              Passenger Fare Details
            </h4>
            <div className="space-y-2 text-xs">
              {ticket.passenger_details.map((p: any, idx: number) => {
                const fareType = (p.specialFareType || "regular").toUpperCase();
                const discountAmt = p.discountAmount || 0;
                const isStudent = p.specialFareType === "student";
                const maskedId = p.studentId ? (p.studentId.length > 4 ? p.studentId.slice(0, 3) + "*****" : p.studentId.slice(0, 1) + "***") : "";
                
                return (
                  <div key={idx} className="flex flex-col gap-2 bg-slate-950/20 p-3 rounded-xl border border-slate-850">
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="font-bold block text-slate-200">{p.fullName || p.name}</span>
                        <span className="text-[10px] text-slate-500 font-bold uppercase">
                          AGE: {p.age} | FARE CATEGORY: {fareType}
                        </span>
                      </div>
                      <div className="text-right">
                        {discountAmt > 0 && (
                          <span className="text-[10px] text-emerald-400 font-bold block">
                            Discount: -₹{floatToDecimal(discountAmt)} ({p.discountPercent}%)
                          </span>
                        )}
                        <span className="font-extrabold text-slate-350 block">
                          Fare: ₹{floatToDecimal(p.finalFare || (booking.total_amount * 0.85 / ticket.passenger_details.length))}
                        </span>
                      </div>
                    </div>
                    {isStudent && (
                      <div className="border-t border-slate-850 pt-2 grid grid-cols-2 gap-2 text-[10px] text-slate-400 font-semibold bg-slate-950/10 p-2 rounded">
                        <div>
                          <span className="text-slate-500 block text-[8px] font-black uppercase">Student ID</span>
                          <span>{maskedId || "—"}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[8px] font-black uppercase">Institution</span>
                          <span>{p.institutionName || "—"}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[8px] font-black uppercase">Student Fare Option</span>
                          <span>10% discount applied</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[8px] font-black uppercase">Verification Status</span>
                          <span className="text-amber-400 font-bold uppercase">{p.studentVerificationStatus || "Pending"}</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* SMS & WhatsApp Action Controls (Phase 1 & 2) */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl text-left space-y-4 shadow-xl">
          <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-2">
            Enterprise Dispatches & Reminders
          </h4>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="bg-slate-950/40 p-4 rounded-2xl border border-slate-850 flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="font-bold block text-slate-200">SMS Notification Dispatch</span>
                <span className="text-[10px] text-slate-500">Sends PNR reservation code via mobile network.</span>
              </div>
              <button 
                onClick={handleTriggerSMS}
                disabled={smsStatus === "sending" || smsStatus === "sent"}
                className="bg-blue-600 hover:bg-blue-500 font-bold py-1.5 px-3 rounded-lg text-[10px] uppercase text-white cursor-pointer transition-all disabled:opacity-50 flex items-center gap-1"
              >
                <Phone size={10} /> {smsStatus === "sending" ? "Sending..." : smsStatus === "sent" ? "Sent!" : "Trigger SMS"}
              </button>
            </div>
            
            <div className="bg-slate-950/40 p-4 rounded-2xl border border-slate-850 flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="font-bold block text-slate-200">WhatsApp Confirmation Slip</span>
                <span className="text-[10px] text-slate-500">Sends rich PDF ticket download link dynamically.</span>
              </div>
              <button 
                onClick={handleTriggerWhatsApp}
                disabled={whatsappStatus === "sending" || whatsappStatus === "sent"}
                className="bg-emerald-600 hover:bg-emerald-500 font-bold py-1.5 px-3 rounded-lg text-[10px] uppercase text-white cursor-pointer transition-all disabled:opacity-50 flex items-center gap-1"
              >
                <MessageSquare size={10} /> {whatsappStatus === "sending" ? "Sending..." : whatsappStatus === "sent" ? "Sent!" : "WhatsApp"}
              </button>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <button
            onClick={() => setShowPdfModal(true)}
            className="bg-emerald-500 hover:bg-emerald-600 border border-emerald-500/20 font-black py-3.5 px-4 rounded-xl text-[11px] uppercase tracking-wider cursor-pointer text-slate-950 transition-all flex items-center justify-center gap-2 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:translate-y-0.5"
          >
            <ExternalLink size={14} /> View E-Ticket
          </button>

          <button
            onClick={handleDownloadPDF}
            className="bg-blue-600 hover:bg-blue-500 border border-blue-500/20 font-black py-3.5 px-4 rounded-xl text-[11px] uppercase tracking-wider cursor-pointer text-white transition-all flex items-center justify-center gap-2 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:translate-y-0.5"
          >
            <Download size={14} /> Download E-Ticket
          </button>
          
          <button
            onClick={handleDownloadInvoice}
            className="bg-slate-900 hover:bg-slate-850 border border-slate-800 font-black py-3.5 px-4 rounded-xl text-[11px] uppercase tracking-wider cursor-pointer text-slate-300 transition-all flex items-center justify-center gap-2 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:translate-y-0.5"
          >
            <FileText size={14} /> Download Invoice
          </button>
        </div>

        {/* Supplementary Utility Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <button
            onClick={handlePrint}
            className="bg-slate-950 hover:bg-slate-900 border border-slate-800 font-bold py-2.5 px-4 rounded-xl text-[10px] uppercase tracking-wider cursor-pointer text-slate-400 transition-all flex items-center justify-center gap-2"
          >
            <Printer size={12} /> Print Ticket
          </button>
          
          <button
            onClick={handleResendEmail}
            disabled={emailStatus === "sending" || emailStatus === "sent"}
            className="bg-slate-950 hover:bg-slate-900 border border-slate-800 font-bold py-2.5 px-4 rounded-xl text-[10px] uppercase tracking-wider cursor-pointer text-slate-400 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Mail size={12} /> 
            {emailStatus === "sending" ? "Resending..." : emailStatus === "sent" ? "Email Sent! 🎉" : "Resend Email"}
          </button>

          <button
            onClick={() => onNavigate(`/booking/${bookingId}`)}
            className="bg-yellow-400/90 hover:bg-yellow-400 text-slate-950 font-bold py-2.5 px-4 rounded-xl text-[10px] uppercase tracking-wider cursor-pointer transition-all flex items-center justify-center gap-1.5"
          >
            View Live Timeline <ArrowRight size={12} />
          </button>
        </div>

      </div>

      {/* Secure PDF Modal Viewer */}
      {showPdfModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#0b0f1d] border-3 border-black rounded-3xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center">
              <h3 className="font-black text-sm uppercase tracking-wide text-white flex items-center gap-2">
                📄 Ghumne Chale E-Ticket Viewer
              </h3>
              <button 
                onClick={() => setShowPdfModal(false)}
                className="text-slate-400 hover:text-white font-bold text-xs bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-xl cursor-pointer"
              >
                ✕ Close
              </button>
            </div>
            <div className="flex-1 bg-slate-950 relative">
              <iframe 
                src={`${API_URL}/bookings/${bookingId}/ticket`}
                className="w-full h-full border-0"
                title="E-Ticket PDF"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function floatToDecimal(val: any): string {
  return Number(val || 0).toFixed(2);
}
