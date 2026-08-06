import React, { useState, useEffect } from "react";
import { 
  ArrowLeft, Clock, ShieldAlert, CheckCircle, XCircle, 
  MapPin, Users, CreditCard, Download, Mail, Share2, 
  Trash2, AlertTriangle, ExternalLink, Compass, Calendar, Info, Edit, Check 
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

interface BookingDetailPageProps {
  bookingId: string;
  onNavigate: (path: string) => void;
  token: string | null;
}

export function BookingDetailPage({ bookingId, onNavigate, token }: BookingDetailPageProps) {
  const [details, setDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelResult, setCancelResult] = useState<any>(null);
  const [emailStatus, setEmailStatus] = useState<string>("");
  
  // Modification Form States
  const [editMode, setEditMode] = useState(false);
  const [modName, setModName] = useState("");
  const [modSeat, setModSeat] = useState("");
  const [modMeal, setModMeal] = useState("");
  const [modLoading, setModLoading] = useState(false);

  const [toast, setToast] = useState<{ show: boolean; message: string }>({ show: false, message: "" });

  const showToast = (msg: string) => {
    setToast({ show: true, message: msg });
    setTimeout(() => setToast({ show: false, message: "" }), 3000);
  };

  const loadBookingDetails = () => {
    const headers: any = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    fetch(`${API_URL}/bookings/${bookingId}`, { headers })
      .then(res => {
        if (res.status === 403) {
          throw new Error("Access Denied: You do not have permissions to view this booking.");
        }
        if (!res.ok) {
          throw new Error("Failed to load booking details.");
        }
        return res.json();
      })
      .then(data => {
        setDetails(data);
        // Pre-fill modification form values
        if (data.ticket) {
          setModName(data.ticket.passenger_details?.[0]?.name || "");
          setModSeat(data.ticket.extra_info?.seat || "");
          setModMeal(data.ticket.extra_info?.meal || "");
        }
        localStorage.setItem(`booking_cache_${bookingId}`, JSON.stringify(data));
      })
      .catch(err => {
        console.warn("Fetch details failed, loading from offline cache...", err);
        const cached = localStorage.getItem(`booking_cache_${bookingId}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          setDetails(parsed);
          if (parsed.ticket) {
            setModName(parsed.ticket.passenger_details?.[0]?.name || "");
            setModSeat(parsed.ticket.extra_info?.seat || "");
            setModMeal(parsed.ticket.extra_info?.meal || "");
          }
        } else {
          setError(err.message || "Could not retrieve booking details.");
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadBookingDetails();
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
      showToast("📥 PDF ticket downloaded successfully!");
    } catch (err: any) {
      alert(err.message || "Error downloading PDF");
    }
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
      .then(() => {
        setEmailStatus("sent");
        showToast("📧 Confirmation email resent successfully!");
        setTimeout(() => setEmailStatus(""), 3000);
        loadBookingDetails();
      })
      .catch(() => {
        setEmailStatus("error");
        setTimeout(() => setEmailStatus(""), 3000);
      });
  };

  const handleCancelBooking = () => {
    if (!window.confirm("Are you sure you want to cancel this booking? Refund policy deductions will apply.")) {
      return;
    }
    
    const headers: any = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    setCancelLoading(true);
    fetch(`${API_URL}/bookings/${bookingId}/cancel`, { 
      method: "POST", 
      headers 
    })
      .then(res => {
        if (!res.ok) throw new Error("Failed to cancel booking.");
        return res.json();
      })
      .then(data => {
        setCancelResult(data);
        showToast("❌ Booking cancelled and refund processed to wallet!");
        loadBookingDetails();
      })
      .catch(err => {
        alert(err.message || "Cancellation failed");
      })
      .finally(() => setCancelLoading(false));
  };

  const handleModifyBooking = (e: React.FormEvent) => {
    e.preventDefault();
    const headers: any = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    setModLoading(true);
    fetch(`${API_URL}/bookings/${bookingId}/modify`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        passenger_name: modName,
        meal: modMeal,
        seat: modSeat
      })
    })
      .then(res => {
        if (!res.ok) throw new Error("Failed to modify booking.");
        return res.json();
      })
      .then(() => {
        showToast("✏️ Booking modified and ticket regenerated successfully!");
        setEditMode(false);
        loadBookingDetails();
      })
      .catch(err => {
        alert(err.message || "Modification failed");
      })
      .finally(() => setModLoading(false));
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
      "PRODID:-//Travel OS//Booking Calendar//EN",
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

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0f1d] text-white flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-400 font-bold tracking-widest uppercase">Fetching Details...</p>
        </div>
      </div>
    );
  }

  if (error || !details) {
    return (
      <div className="min-h-screen bg-[#0a0f1d] text-white flex items-center justify-center font-sans p-6">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 p-8 rounded-3xl text-center space-y-4">
          <ShieldAlert size={48} className="text-red-500 mx-auto" />
          <h2 className="text-xl font-black uppercase text-red-500">Access Denied</h2>
          <p className="text-xs text-slate-400">{error || "Unauthorized access parameters."}</p>
          <button onClick={() => onNavigate("/")} className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded-xl text-xs uppercase cursor-pointer">
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const { booking, ticket, invoice, timeline, vertical } = details;

  // Active steps in timeline
  const activeTimelineKeys = timeline ? timeline.map((t: any) => t.event_type) : [];

  const workflowSteps = [
    { key: "booking_created", label: "Booking Created" },
    { key: "payment_completed", label: "Payment Completed" },
    { key: "booking_confirmed", label: "Confirmed" },
    { key: "ticket_generated", label: "Ticket Generated" },
    { key: "email_sent", label: "Email Sent" },
    { key: "ready_for_travel", label: "Ready for Travel" }
  ];

  const isCancelled = booking.status === "cancelled" || booking.status === "refunded";

  return (
    <div className="min-h-screen bg-[#060814] text-white p-4 md:p-8 font-sans relative">
      {/* Toast Notification */}
      {toast.show && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-[#0f172a] border border-blue-500/30 text-xs font-bold px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2 text-blue-200 animate-[fadeIn_0.15s_ease-out]">
          <Info size={14} className="text-blue-400" />
          {toast.message}
        </div>
      )}

      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* Navigation back bar */}
        <div className="flex justify-between items-center">
          <button 
            onClick={() => onNavigate("/")} 
            className="flex items-center gap-2 text-xs text-slate-400 hover:text-white transition-colors font-bold uppercase cursor-pointer"
          >
            <ArrowLeft size={16} /> Back to Dashboard
          </button>
          
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-500 font-bold uppercase">vertical:</span>
            <span className="text-[10px] bg-blue-900/40 text-blue-300 border border-blue-800/30 px-2 py-0.5 rounded font-black uppercase">
              {vertical}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Main details panel */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Header info */}
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl text-left space-y-4">
              <div className="flex justify-between items-start border-b border-slate-800 pb-3">
                <div>
                  <h2 className="text-xl font-black text-white uppercase tracking-wide">
                    {vertical === "flights" ? `Flight ${booking.airline_code}-${booking.flight_number}` : vertical === "hotels" ? booking.hotel_name : "Travel OS Reservation"}
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">Reference Code: <span className="font-mono font-bold text-white">{bookingId}</span></p>
                </div>
                <span className={`text-[10px] font-black uppercase px-3 py-1 rounded-full border ${
                  booking.status === "confirmed" 
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                    : isCancelled
                    ? "bg-red-500/10 text-red-400 border-red-500/20"
                    : "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
                }`}>
                  {booking.status.toUpperCase()}
                </span>
              </div>

              {/* Specific details */}
              {vertical === "flights" && (
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-slate-500 block text-[9px] font-bold">ROUTE</span>
                    <strong className="text-slate-200">{booking.origin} ➔ {booking.destination}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[9px] font-bold">DEPARTURE</span>
                    <strong className="text-slate-200">{booking.departure_time ? new Date(booking.departure_time).toLocaleString() : "—"}</strong>
                  </div>
                </div>
              )}

              {vertical === "hotels" && (
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-slate-500 block text-[9px] font-bold">CHECK-IN / OUT</span>
                    <strong className="text-slate-200">{new Date(booking.check_in).toDateString()} - {new Date(booking.check_out).toDateString()}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[9px] font-bold">ROOM TYPE</span>
                    <strong className="text-slate-200">{booking.room_type}</strong>
                  </div>
                </div>
              )}

              {/* Passenger list & Modification Button */}
              {ticket && (
                <div className="bg-slate-950/40 p-4 rounded-2xl border border-slate-850 space-y-3">
                  <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                    <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider flex items-center gap-1.5">
                      <Users size={12} /> Passenger & Trip Preferences
                    </span>
                    {!isCancelled && (
                      <button 
                        onClick={() => setEditMode(!editMode)}
                        className="text-[9px] uppercase font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1 cursor-pointer"
                      >
                        <Edit size={10} /> {editMode ? "Cancel Edit" : "Modify Booking"}
                      </button>
                    )}
                  </div>

                  {editMode ? (
                    <form onSubmit={handleModifyBooking} className="space-y-3 text-xs">
                      <div className="space-y-1">
                        <label className="text-[9px] text-slate-500 font-bold block">PASSENGER NAME</label>
                        <input 
                          type="text" 
                          value={modName} 
                          onChange={(e) => setModName(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white font-medium focus:border-blue-500 focus:outline-none"
                          required
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[9px] text-slate-500 font-bold block">SEAT SELECTION</label>
                          <input 
                            type="text" 
                            value={modSeat} 
                            onChange={(e) => setModSeat(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white font-mono focus:border-blue-500 focus:outline-none"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] text-slate-500 font-bold block">MEAL PREFERENCE</label>
                          <input 
                            type="text" 
                            value={modMeal} 
                            onChange={(e) => setModMeal(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white focus:border-blue-500 focus:outline-none"
                          />
                        </div>
                      </div>
                      <button 
                        type="submit" 
                        disabled={modLoading}
                        className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-2 rounded-xl text-[10px] uppercase cursor-pointer transition-all flex items-center justify-center gap-1.5"
                      >
                        {modLoading ? "Saving Changes..." : "Apply Ticket Modification"}
                      </button>
                    </form>
                  ) : (
                    <div className="text-xs space-y-2">
                      {ticket.passenger_details?.map((p: any, idx: number) => (
                        <div key={idx} className="flex justify-between font-medium">
                          <span className="text-slate-300">{p.name || "Traveler"} ({p.age || 30} yrs)</span>
                          {ticket.extra_info?.seat && (
                            <span className="text-blue-400 font-mono">Seat {ticket.extra_info.seat}</span>
                          )}
                        </div>
                      ))}
                      {ticket.extra_info?.meal && (
                        <div className="flex justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-900">
                          <span>Meal choice:</span>
                          <span className="text-slate-400 font-semibold">{ticket.extra_info.meal}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Live Progress Timeline Panel */}
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl text-left space-y-4">
              <h3 className="text-xs font-black uppercase tracking-wider text-blue-400 border-b border-slate-800 pb-2 flex items-center gap-1.5">
                <Clock size={14} /> LIVE BOOKING TIMELINE STATUS
              </h3>
              
              <div className="space-y-4 relative before:absolute before:top-2.5 before:left-3 before:w-0.5 before:h-[80%] before:bg-slate-800">
                {workflowSteps.map((step, idx) => {
                  const done = activeTimelineKeys.includes(step.key) || (booking.status === "confirmed" && idx <= 3);
                  return (
                    <div key={step.key} className="flex items-start gap-4 pl-1">
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 z-10 ${
                        done ? "bg-emerald-500 border-emerald-500 text-slate-950" : "bg-slate-950 border-slate-800 text-slate-700"
                      }`}>
                        {done && <Check size={10} strokeWidth={3} className="text-slate-950 w-2.5 h-2.5" />}
                      </div>
                      <div className="space-y-0.5">
                        <div className={`text-xs font-bold ${done ? "text-slate-200" : "text-slate-600"}`}>{step.label}</div>
                        {done && timeline && timeline.find((t: any) => t.event_type === step.key) && (
                          <p className="text-[10px] text-slate-500">{timeline.find((t: any) => t.event_type === step.key).description}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Refund Tracking Progress Panel (Phase 17) */}
            {isCancelled && (
              <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl text-left space-y-4 shadow-xl border-l-4 border-l-red-500">
                <h3 className="text-xs font-black uppercase tracking-wider text-red-400 border-b border-slate-800 pb-2 flex items-center gap-1.5">
                  <CreditCard size={14} /> REFUND TRACKING TIMELINE
                </h3>
                
                <div className="space-y-4 relative before:absolute before:top-2.5 before:left-3 before:w-0.5 before:h-[70%] before:bg-slate-800">
                  <div className="flex items-start gap-4 pl-1">
                    <div className="w-4 h-4 rounded-full bg-emerald-500 border-2 border-emerald-500 text-slate-950 flex items-center justify-center shrink-0 z-10">
                      <Check size={10} strokeWidth={3} className="text-slate-950 w-2.5 h-2.5" />
                    </div>
                    <div className="space-y-0.5">
                      <div className="text-xs font-bold text-slate-200">Refund Initiated</div>
                      <p className="text-[10px] text-slate-500">Cancellation request validated and processed.</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-4 pl-1">
                    <div className="w-4 h-4 rounded-full bg-emerald-500 border-2 border-emerald-500 text-slate-950 flex items-center justify-center shrink-0 z-10">
                      <Check size={10} strokeWidth={3} className="text-slate-950 w-2.5 h-2.5" />
                    </div>
                    <div className="space-y-0.5">
                      <div className="text-xs font-bold text-slate-200">Refund Processing</div>
                      <p className="text-[10px] text-slate-500">Automatic gateway check and safety audits passed.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4 pl-1">
                    <div className="w-4 h-4 rounded-full bg-emerald-500 border-2 border-emerald-500 text-slate-950 flex items-center justify-center shrink-0 z-10">
                      <Check size={10} strokeWidth={3} className="text-slate-950 w-2.5 h-2.5" />
                    </div>
                    <div className="space-y-0.5">
                      <div className="text-xs font-bold text-slate-200">Wallet Credited</div>
                      <p className="text-[10px] text-emerald-400 font-medium">Refund amount credited instantly to customer's active wallet balance.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Destination routing map */}
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl text-left space-y-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                <Compass size={14} /> Destination routing map
              </h3>
              <div className="h-44 bg-slate-950/60 rounded-2xl border border-slate-850 flex items-center justify-center overflow-hidden relative group">
                <svg viewBox="0 0 400 150" className="w-full h-full p-4">
                  <path d="M 50 100 Q 180 30 350 110" fill="none" stroke="#2563eb" strokeWidth="2.5" strokeDasharray="5,5" />
                  <circle cx="50" cy="100" r="8" fill="#10b981" />
                  <circle cx="350" cy="110" r="8" fill="#ef4444" />
                  <text x="50" y="122" fill="#94a3b8" fontSize="8" textAnchor="middle" fontWeight="bold">DEL (Origin)</text>
                  <text x="350" y="132" fill="#94a3b8" fontSize="8" textAnchor="middle" fontWeight="bold">GOI (Resort)</text>
                </svg>
                {booking.address && (
                  <a 
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(booking.hotel_name || booking.address)}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="absolute bottom-2 right-2 bg-blue-600 hover:bg-blue-500 text-white font-bold py-1.5 px-3 rounded-lg text-[9px] uppercase transition-colors flex items-center gap-1"
                  >
                    Open Live Maps <ExternalLink size={10} />
                  </a>
                )}
              </div>
            </div>

          </div>

          {/* Sidebar Receipt / Actions panel */}
          <div className="space-y-6">
            
            {/* Invoice summary receipt */}
            {invoice && (
              <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl text-left space-y-4 shadow-xl">
                <h3 className="text-xs font-black uppercase tracking-wider text-blue-400 border-b border-slate-800 pb-2 flex items-center gap-1.5">
                  <CreditCard size={14} /> Invoice details
                </h3>
                
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Invoice Number</span>
                    <span className="font-mono text-slate-300">{invoice.invoice_number}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Base Fare Amount</span>
                    <span className="text-slate-300">₹{invoice.base_amount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Tax & Fees (GST)</span>
                    <span className="text-slate-300">₹{invoice.tax_amount.toLocaleString()}</span>
                  </div>
                  {invoice.discount_amount > 0 && (
                    <div className="flex justify-between text-emerald-400">
                      <span>Promo Coupon discount</span>
                      <span>-₹{invoice.discount_amount.toLocaleString()}</span>
                    </div>
                  )}
                  {invoice.wallet_used > 0 && (
                    <div className="flex justify-between text-blue-400">
                      <span>Wallet debited</span>
                      <span>-₹{invoice.wallet_used.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="border-t border-slate-800 pt-2 flex justify-between font-black text-sm">
                    <span className="text-slate-200">Final Charged</span>
                    <span className="text-emerald-400">₹{invoice.final_amount.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Actions card */}
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl text-left space-y-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-2">
                Booking Actions
              </h3>
              
              <div className="space-y-2">
                <button
                  onClick={handleDownloadPDF}
                  className="w-full bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/20 text-blue-400 font-bold py-2.5 rounded-xl text-xs uppercase cursor-pointer transition-all flex items-center justify-center gap-2"
                >
                  <Download size={14} /> Download PDF Ticket
                </button>
                
                <button
                  onClick={handleResendEmail}
                  disabled={emailStatus === "sending" || emailStatus === "sent"}
                  className="w-full bg-slate-950 hover:bg-slate-850 border border-slate-800 text-slate-300 font-bold py-2.5 rounded-xl text-xs uppercase cursor-pointer transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Mail size={14} /> 
                  {emailStatus === "sending" ? "Resending..." : emailStatus === "sent" ? "Email Sent! 🎉" : "Resend Email Ticket"}
                </button>

                <button
                  onClick={handleExportCalendar}
                  className="w-full bg-slate-950 hover:bg-slate-850 border border-slate-800 text-slate-300 font-bold py-2.5 rounded-xl text-xs uppercase cursor-pointer transition-all flex items-center justify-center gap-2"
                >
                  <Calendar size={14} /> Export to Calendar
                </button>
              </div>
            </div>

            {/* Cancellation Card */}
            {booking.status === "confirmed" && (
              <div className="bg-red-950/20 border border-red-900/30 p-6 rounded-3xl text-left space-y-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-red-400 border-b border-red-900/20 pb-2 flex items-center gap-1.5">
                  <AlertTriangle size={14} /> Danger Zone
                </h3>
                
                <p className="text-[10px] text-slate-400">
                  Cancel your reservation. Standard global policy: 5% cancellation charge applies, remainder credited instantly to your wallet.
                </p>

                {cancelResult && (
                  <div className="bg-red-950/40 border border-red-900/40 p-3 rounded-xl text-xs text-red-200 space-y-1">
                    <div><b>Cancellation Successful</b></div>
                    <div>Refund Amount: ₹{cancelResult.refund_amount?.toLocaleString()}</div>
                    <div>Cancellation Penalty (5%): ₹{cancelResult.cancellation_fee?.toLocaleString()}</div>
                    <div className="text-[10px] text-emerald-400 mt-1">Refund credited to your wallet balance.</div>
                  </div>
                )}

                {!cancelResult && (
                  <button
                    onClick={handleCancelBooking}
                    disabled={cancelLoading}
                    className="w-full bg-red-600 hover:bg-red-500 text-white font-black py-2.5 rounded-xl text-xs uppercase cursor-pointer transition-all flex items-center justify-center gap-2"
                  >
                    <Trash2 size={14} /> {cancelLoading ? "Processing Cancel..." : "Cancel Reservation"}
                  </button>
                )}
              </div>
            )}

            {/* Already cancelled status card */}
            {isCancelled && (
              <div className="bg-slate-950 border border-slate-900 p-6 rounded-3xl text-left space-y-2">
                <div className="flex items-center gap-2 text-red-500 font-bold text-xs uppercase">
                  <XCircle size={16} /> Reservation Cancelled
                </div>
                <p className="text-[10px] text-slate-400">
                  This booking has been processed for refund and is no longer active with the travel provider.
                </p>
              </div>
            )}

          </div>

        </div>

      </div>
    </div>
  );
}
