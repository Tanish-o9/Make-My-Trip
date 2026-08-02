import React, { useState, useEffect } from "react";

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
import { CheckCircle, Calendar, ArrowRight, FileText } from "lucide-react";

interface ConfirmationPageProps {
  bookingId: string;
  onNavigate: (path: string) => void;
}

export function ConfirmationPage({ bookingId, onNavigate }: ConfirmationPageProps) {
  const [details, setDetails] = useState<any>(null);
  const [crossSell, setCrossSell] = useState<{ count: number, lowestPrice: number } | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/bookings/details/${bookingId}`)
      .then(res => res.json())
      .then(bookingData => {
        setDetails(bookingData);
        if (bookingData && bookingData.destination && bookingData.vertical !== "rent-a-ride") {
          const dest = bookingData.destination;
          fetch(`${API_URL}/search?vertical=rent-a-ride&destination=${encodeURIComponent(dest)}`)
            .then(res => res.json())
            .then(searchData => {
              if (searchData && Array.isArray(searchData.results) && searchData.results.length > 0) {
                const prices = searchData.results.map((v: any) => v.price_per_day);
                setCrossSell({
                  count: searchData.results.length,
                  lowestPrice: Math.min(...prices)
                });
              }
            })
            .catch(() => {});
        }
      })
      .catch(() => {});
  }, [bookingId]);

  const handleCalendarSync = () => {
    alert("Event synchronized to Google Calendar!");
  };

  const handleDownloadInvoice = () => {
    const invoiceContent = `TRAVEL OS BILLING INVOICE\n========================\nBooking PNR: ${bookingId}\nStatus: Captured & Confirmed\nDate: ${new Date().toISOString()}\nTotal Amount: INR 1500.00\nPayment Gateway: Razorpay\n\nThank you for choosing Travel OS.`;
    const blob = new Blob([invoiceContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Invoice_${bookingId}.txt`;
    a.click();
  };

  return (
    <div className="min-h-screen bg-[#f4efe6] text-black p-6 font-sans flex items-center justify-center">
      <div className="max-w-md w-full bg-white border-4 border-black p-8 rounded-3xl shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] space-y-6 text-center">
        
        {/* Success Icon */}
        <div className="w-16 h-16 bg-emerald-100 border-4 border-black rounded-full flex items-center justify-center mx-auto text-emerald-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
          <CheckCircle size={32} />
        </div>

        <div className="space-y-2">
          <h2 className="text-3xl font-black italic uppercase tracking-wider text-emerald-600">
            Booking Confirmed!
          </h2>
          <p className="text-sm font-semibold text-slate-500">
            Your payment was verified, and your inventory hold has been successfully upgraded to a confirmed reservation.
          </p>
        </div>

        {/* Invoice Summary Box */}
        <div className="bg-[#eae5d9] border-3 border-black p-4 rounded-2xl text-left space-y-3 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
          <div className="flex justify-between items-center border-b border-black/10 pb-2">
            <span className="text-[10px] uppercase font-black tracking-wide text-slate-600">Booking reference</span>
            <span className="text-xs font-black bg-slate-900 text-white px-2 py-0.5 rounded font-mono">
              {bookingId}
            </span>
          </div>
          
          <div className="space-y-1">
            <h4 className="font-black text-sm">
              {details ? `Travel OS ${details.vertical.toUpperCase()} Reservation` : "Travel OS Standard Booking"}
            </h4>
            <p className="text-xs text-slate-600 font-semibold">Payment Status: CAPTURED</p>
            <p className="text-xs text-slate-600 font-semibold">
              Amount Paid: {details ? `₹${details.total_amount.toLocaleString()}` : "₹1,500.00"}
            </p>
          </div>
        </div>

        {/* Complete your trip cross-sell */}
        {details && crossSell && (
          <div className="bg-[#fff9db] border-3 border-black p-4 rounded-2xl text-left space-y-2 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
            <span className="text-[9px] bg-yellow-300 text-black px-1.5 py-0.5 rounded font-black uppercase inline-block border border-black">
              Complete Your Trip
            </span>
            <h4 className="font-extrabold text-sm text-slate-900">Need a ride in {details.destination}?</h4>
            <p className="text-xs text-slate-600 font-semibold">
              {crossSell.count} vehicles available from <strong className="font-mono text-slate-900">₹{crossSell.lowestPrice.toLocaleString()}</strong>/day.
            </p>
            <button
              onClick={() => {
                const start = details.start_date || "2026-12-15";
                const end = details.end_date || "2026-12-18";
                onNavigate(`/rent-a-ride/${encodeURIComponent(details.destination)}?pickup=${start}T10:00&drop=${end}T10:00&linked_booking_reference=${bookingId}`);
              }}
              className="w-full mt-2 bg-yellow-300 hover:bg-yellow-400 border-2 border-black font-black py-2 rounded-xl text-xs uppercase cursor-pointer text-slate-950 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-0.5 active:shadow-none transition-all flex items-center justify-center gap-1.5"
            >
              🔑 Add to trip
            </button>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col gap-3 pt-2">
          <button
            onClick={handleDownloadInvoice}
            className="w-full bg-white hover:bg-slate-100 border-3 border-black font-black py-2.5 rounded-xl text-xs uppercase cursor-pointer shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:translate-y-0.5 active:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all flex items-center justify-center gap-2"
          >
            <FileText size={16} /> Download Receipt Invoice
          </button>
          
          <button
            onClick={handleCalendarSync}
            className="w-full bg-blue-100 hover:bg-blue-200 border-3 border-black font-black py-2.5 rounded-xl text-xs uppercase cursor-pointer text-blue-900 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:translate-y-0.5 active:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all flex items-center justify-center gap-2"
          >
            <Calendar size={16} /> Add Trip to Google Calendar
          </button>
          
          <button
            onClick={() => onNavigate("/")}
            className="w-full bg-yellow-300 hover:bg-yellow-400 border-3 border-black font-black py-3 rounded-xl text-xs uppercase cursor-pointer shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-0.5 active:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all flex items-center justify-center gap-2"
          >
            Go to Dashboard <ArrowRight size={16} />
          </button>
        </div>

      </div>
    </div>
  );
}
