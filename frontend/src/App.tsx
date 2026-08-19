import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
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
import { AdminConsole } from './AdminConsole';
import LegalPage from './LegalPage';
import VerifyEmailPage from './VerifyEmailPage';
import ForgotPasswordPage from './ForgotPasswordPage';
import NotificationsPage from './NotificationsPage';
import SupportCenterPage from './SupportCenterPage';
import DashboardPage from './DashboardPage';
import TripTimelinePage from './TripTimelinePage';
import DocumentsPage from './DocumentsPage';
import WishlistPage from './WishlistPage';
import HotelMapView from './HotelMapView';
import GroupTripDashboard from './GroupTripDashboard';
import AIPlannerDashboard from './AIPlannerDashboard';


import { API_BASE, API_URL, ADMIN_BASE, WS_BASE_API, SPECIAL_FARES, calculatePassengerFare, validateStudentDetails, calculateSearchDisplayFare, normalizeSpecialFareKey } from './config/api';
import { getVehicleImage, handleVehicleImageError } from './utils/vehicleImages';
const WS_BASE = WS_BASE_API;
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

const addLocalWalletTransaction = (type: 'credit' | 'debit', amount: number, reference: string, description: string, balanceBefore: number) => {
  try {
    const saved = localStorage.getItem("local_wallet_transactions");
    const list = saved ? JSON.parse(saved) : [];
    const newTx = {
      id: "local_" + Math.random().toString(36).substr(2, 9),
      amount: amount,
      type: type,
      balance_before: balanceBefore,
      balance_after: type === 'credit' ? balanceBefore + amount : balanceBefore - amount,
      reference: reference || `REF-${Math.floor(100000 + Math.random() * 900000)}`,
      description: description,
      status: "COMPLETED",
      timestamp: new Date().toISOString()
    };
    list.unshift(newTx);
    localStorage.setItem("local_wallet_transactions", JSON.stringify(list));
  } catch (e) {
    console.error("Error writing local transaction:", e);
  }
};

const TRIP_GRADIENTS = [
  'from-violet-900/80 via-purple-900/60 to-slate-900',
  'from-blue-900/80 via-cyan-900/60 to-slate-900',
  'from-rose-900/80 via-pink-900/60 to-slate-900',
  'from-emerald-900/80 via-teal-900/60 to-slate-900',
  'from-amber-900/80 via-orange-900/60 to-slate-900',
  'from-indigo-900/80 via-blue-900/60 to-slate-900',
];
const TRIP_EMOJIS = ['🏖️','🏔️','🗼','🌴','🎡','🗺️','🏕️','✈️','🚢','🌅'];

// ── Popular Indian destination dataset ──────────────────────────────────────
const INDIA_DESTINATIONS = [
  { name: 'Goa', state: 'Goa', country: 'India', lat: 15.4909, lng: 73.8278 },
  { name: 'Mumbai', state: 'Maharashtra', country: 'India', lat: 19.0760, lng: 72.8777 },
  { name: 'Delhi', state: 'Delhi', country: 'India', lat: 28.6139, lng: 77.2090 },
  { name: 'New Delhi', state: 'Delhi', country: 'India', lat: 28.6139, lng: 77.2090 },
  { name: 'Jaipur', state: 'Rajasthan', country: 'India', lat: 26.9124, lng: 75.7873 },
  { name: 'Udaipur', state: 'Rajasthan', country: 'India', lat: 24.5854, lng: 73.7125 },
  { name: 'Manali', state: 'Himachal Pradesh', country: 'India', lat: 32.2432, lng: 77.1892 },
  { name: 'Shimla', state: 'Himachal Pradesh', country: 'India', lat: 31.1048, lng: 77.1734 },
  { name: 'Rishikesh', state: 'Uttarakhand', country: 'India', lat: 30.0869, lng: 78.2676 },
  { name: 'Varanasi', state: 'Uttar Pradesh', country: 'India', lat: 25.3176, lng: 82.9739 },
  { name: 'Agra', state: 'Uttar Pradesh', country: 'India', lat: 27.1767, lng: 78.0081 },
  { name: 'Bengaluru', state: 'Karnataka', country: 'India', lat: 12.9716, lng: 77.5946 },
  { name: 'Hyderabad', state: 'Telangana', country: 'India', lat: 17.3850, lng: 78.4867 },
  { name: 'Chennai', state: 'Tamil Nadu', country: 'India', lat: 13.0827, lng: 80.2707 },
  { name: 'Kolkata', state: 'West Bengal', country: 'India', lat: 22.5726, lng: 88.3639 },
  { name: 'Pune', state: 'Maharashtra', country: 'India', lat: 18.5204, lng: 73.8567 },
  { name: 'Amritsar', state: 'Punjab', country: 'India', lat: 31.6340, lng: 74.8723 },
  { name: 'Mysuru', state: 'Karnataka', country: 'India', lat: 12.2958, lng: 76.6394 },
  { name: 'Jaisalmer', state: 'Rajasthan', country: 'India', lat: 26.9157, lng: 70.9083 },
  { name: 'Srinagar', state: 'Jammu & Kashmir', country: 'India', lat: 34.0837, lng: 74.7973 },
  { name: 'Leh', state: 'Ladakh', country: 'India', lat: 34.1526, lng: 77.5770 },
  { name: 'Darjeeling', state: 'West Bengal', country: 'India', lat: 27.0360, lng: 88.2627 },
  { name: 'Ooty', state: 'Tamil Nadu', country: 'India', lat: 11.4102, lng: 76.6950 },
  { name: 'Gokarna', state: 'Karnataka', country: 'India', lat: 14.5479, lng: 74.3188 },
  { name: 'Andaman', state: 'Andaman & Nicobar', country: 'India', lat: 11.7401, lng: 92.6586 },
  { name: 'Pondicherry', state: 'Puducherry', country: 'India', lat: 11.9416, lng: 79.8083 },
  { name: 'Coorg', state: 'Karnataka', country: 'India', lat: 12.3375, lng: 75.8069 },
  { name: 'Munnar', state: 'Kerala', country: 'India', lat: 10.0889, lng: 77.0595 },
  { name: 'Alleppey', state: 'Kerala', country: 'India', lat: 9.4981, lng: 76.3388 },
  { name: 'Kasol', state: 'Himachal Pradesh', country: 'India', lat: 32.0114, lng: 77.3140 },
  { name: 'Spiti Valley', state: 'Himachal Pradesh', country: 'India', lat: 32.2461, lng: 78.0338 },
  { name: 'Ranthambore', state: 'Rajasthan', country: 'India', lat: 25.9760, lng: 76.5050 },
  { name: 'Gorakhpur', state: 'Uttar Pradesh', country: 'India', lat: 26.7606, lng: 83.3732 },
  { name: 'Guwahati', state: 'Assam', country: 'India', lat: 26.1445, lng: 91.7362 },
  { name: 'Shillong', state: 'Meghalaya', country: 'India', lat: 25.5788, lng: 91.8933 },
  { name: 'Aizawl', state: 'Mizoram', country: 'India', lat: 23.7271, lng: 92.7176 },
  { name: 'Gangtok', state: 'Sikkim', country: 'India', lat: 27.3389, lng: 88.6065 },
  { name: 'Haridwar', state: 'Uttarakhand', country: 'India', lat: 29.9457, lng: 78.1642 },
  { name: 'Nainital', state: 'Uttarakhand', country: 'India', lat: 29.3919, lng: 79.4542 },
  { name: 'Mussoorie', state: 'Uttarakhand', country: 'India', lat: 30.4598, lng: 78.0664 },
];

function DestinationAutocomplete({ value, onChange }: { value: string; onChange: (name: string) => void }) {
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<typeof INDIA_DESTINATIONS>([]);
  const [show, setShow] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Filter suggestions on query change
  useEffect(() => {
    if (query.length < 2) { setSuggestions([]); setShow(false); return; }
    const q = query.toLowerCase().trim();
    const filtered = INDIA_DESTINATIONS.filter(d =>
      d.name.toLowerCase().includes(q) || d.state.toLowerCase().includes(q)
    ).slice(0, 6);
    setSuggestions(filtered);
    setShow(filtered.length > 0);
    setHighlightIdx(-1);
  }, [query]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setShow(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const select = (dest: typeof INDIA_DESTINATIONS[0]) => {
    setQuery(dest.name);
    onChange(dest.name);
    setShow(false);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (!show) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlightIdx(i => Math.min(i + 1, suggestions.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setHighlightIdx(i => Math.max(i - 1, 0)); }
    if (e.key === 'Enter' && highlightIdx >= 0) { e.preventDefault(); select(suggestions[highlightIdx]); }
    if (e.key === 'Escape') setShow(false);
  };

  return (
    <div ref={wrapRef} className="relative">
      <input
        type="text"
        placeholder="e.g. Goa, Manali, Mumbai…"
        value={query}
        required
        onChange={e => { setQuery(e.target.value); onChange(e.target.value); }}
        onFocus={() => { if (query.length >= 2 && suggestions.length > 0) setShow(true); }}
        onKeyDown={handleKey}
        className="w-full rounded-lg px-3 py-2.5 text-sm text-white border border-slate-700 focus:border-purple-500 outline-none transition-colors"
        style={{ background: 'rgba(255,255,255,0.04)' }}
        autoComplete="off"
      />
      {show && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-xl border border-slate-700 overflow-hidden shadow-2xl"
          style={{ background: '#0d1829' }}>
          {suggestions.map((d, i) => (
            <div
              key={d.name + d.state}
              className={`px-3 py-2.5 cursor-pointer flex items-start gap-2 transition-colors ${i === highlightIdx ? 'bg-purple-900/40' : 'hover:bg-white/5'}`}
              onMouseDown={() => select(d)}
            >
              <span className="text-purple-400 mt-0.5 flex-shrink-0">📍</span>
              <div>
                <div className="text-white text-sm font-semibold">{d.name}</div>
                <div className="text-slate-500 text-[11px]">{d.state}, {d.country}</div>
              </div>
            </div>
          ))}
        </div>
      )}
      {query.length >= 2 && suggestions.length === 0 && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-xl border border-slate-700 px-4 py-3 text-slate-400 text-xs"
          style={{ background: '#0d1829' }}>
          No results for "<span className="text-white">{query}</span>". You can still use this destination.
        </div>
      )}
    </div>
  );
}

function GroupTripsList({ token, onSelectTrip }: { token: string; onSelectTrip: (id: number) => void }) {
  const GT_API = `${API_URL}/trips`;

  // ── Trips list state ──────────────────────────────────────────────────────
  const [trips, setTrips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // ── Wizard state ──────────────────────────────────────────────────────────
  const [showWizard, setShowWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState(1); // 1=Details 2=Members 3=Verify 4=Review 5=Success

  // Step 1 — Trip Details
  const [name, setName] = useState('');
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [budget, setBudget] = useState('');
  const [tripType, setTripType] = useState('Friends');
  const [tripDesc, setTripDesc] = useState('');

  // Step 2 — Members
  type MemberRow = { name: string; email: string; phone: string };
  const [members, setMembers] = useState<MemberRow[]>([{ name: '', email: '', phone: '' }]);

  // Step 3 / 4 / 5 — Progress & Verification States
  const [createdTripId, setCreatedTripId] = useState<number | null>(null);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [confirmCheck1, setConfirmCheck1] = useState(false);
  const [confirmCheck2, setConfirmCheck2] = useState(false);
  const [confirmCheck3, setConfirmCheck3] = useState(false);

  // OTP Modal / Inline OTP state
  const [verifyingMemberId, setVerifyingMemberId] = useState<number | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpStatusMsg, setOtpStatusMsg] = useState('');
  const [otpResendCooldown, setOtpResendCooldown] = useState(0);

  // Payment states
  const [paymentStatus, setPaymentStatus] = useState<'NOT_STARTED' | 'PROCESSING' | 'SUCCESS' | 'FAILED'>('NOT_STARTED');
  const [razorpayOrderId, setRazorpayOrderId] = useState('');

  // Submission
  const [creating, setCreating] = useState(false);
  const [stepError, setStepError] = useState<string | null>(null);

  const today = new Date().toISOString().split('T')[0];

  const duration = React.useMemo(() => {
    if (!startDate || !endDate) return null;
    const diff = Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000);
    return diff > 0 ? diff : null;
  }, [startDate, endDate]);

  // ── Toast helper ──────────────────────────────────────────────────────────
  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  // ── Fetch trips ───────────────────────────────────────────────────────────
  const fetchTrips = async () => {
    try {
      setLoading(true);
      setListError(null);
      const res = await fetch(GT_API, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setTrips(await res.json());
      } else if (res.status === 401) {
        setListError('Session expired. Please log in again.');
      } else {
        setListError('Unable to load trips. Please try again.');
      }
    } catch {
      setListError('Cannot connect to server. Make sure the app is running.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTrips(); }, [token]);

  // Count down OTP resend cooldown timer
  useEffect(() => {
    if (otpResendCooldown > 0) {
      const t = setTimeout(() => setOtpResendCooldown(c => c - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [otpResendCooldown]);

  // Dynamically load Razorpay checkout script
  useEffect(() => {
    if (wizardStep === 4 && !(window as any).Razorpay) {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      document.body.appendChild(script);
    }
  }, [wizardStep]);

  // ── Wizard helpers ────────────────────────────────────────────────────────
  const resetWizard = () => {
    setWizardStep(1); setName(''); setDestination(''); setStartDate(''); setEndDate('');
    setBudget(''); setTripType('Friends'); setTripDesc('');
    setMembers([{ name: '', email: '', phone: '' }]);
    setCreatedTripId(null); setInvitations([]);
    setConfirmCheck1(false); setConfirmCheck2(false); setConfirmCheck3(false);
    setVerifyingMemberId(null); setOtpCode(''); setOtpSent(false); setOtpStatusMsg('');
    setPaymentStatus('NOT_STARTED'); setRazorpayOrderId(''); setStepError(null);
  };

  const openWizard = () => { resetWizard(); setShowWizard(true); };
  const closeWizard = () => { if (!creating && paymentStatus !== 'PROCESSING') { setShowWizard(false); resetWizard(); } };

  // Step validations
  const validateStep1 = (): string | null => {
    if (!name.trim()) return 'Trip name is required.';
    if (!destination.trim()) return 'Destination is required.';
    if (startDate && endDate && endDate < startDate) return 'End date cannot be before start date.';
    return null;
  };

  const validateStep2 = (): string | null => {
    const validMembers = members.filter(m => m.email.trim());
    if (validMembers.length === 0) return 'Please add at least one travel companion.';
    for (const m of validMembers) {
      if (!/\S+@\S+\.\S+/.test(m.email.trim())) return `Invalid email format: ${m.email}`;
      if (!m.name.trim()) return `Please provide a name for ${m.email}`;
      if (!m.phone || !/^\+?[\d\s\-()]{10,15}$/.test(m.phone.trim())) {
        return `Please enter a valid phone number with country code for ${m.name || m.email} (e.g. +919999999999).`;
      }
    }
    // Check duplicate emails
    const emails = validMembers.map(m => m.email.trim().toLowerCase());
    if (new Set(emails).size !== emails.length) return 'Duplicate email addresses are not allowed.';
    return null;
  };

  const goToStep2 = () => {
    const err = validateStep1();
    if (err) { setStepError(err); return; }
    setStepError(null); setWizardStep(2);
  };

  const fetchInvitations = async (tripId: number) => {
    try {
      const res = await fetch(`${API_URL}/trips/${tripId}/invitations`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setInvitations(await res.json());
      }
    } catch (e) {
      console.error("Failed to fetch invitations", e);
    }
  };

  const handleCreateAndInvite = async () => {
    const err = validateStep2();
    if (err) { setStepError(err); return; }
    setStepError(null);
    setCreating(true);
    try {
      const res = await fetch(GT_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          name: name.trim(),
          destination: destination.trim(),
          start_date: startDate || null,
          end_date: endDate || null,
          budget: budget ? parseFloat(budget) : 0,
          trip_type: tripType,
          description: tripDesc.trim() || null,
          booking_references: []
        })
      });

      if (!res.ok) {
        setStepError('Unable to create trip. Please try again.');
        setCreating(false);
        return;
      }

      const newTrip = await res.json();
      setCreatedTripId(newTrip.id);

      const inviteMembers = members.filter(m => m.email.trim());
      if (inviteMembers.length > 0) {
        const invRes = await fetch(`${API_URL}/trips/${newTrip.id}/invitations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({
            members: inviteMembers.map(m => ({
              name: m.name.trim(),
              email: m.email.trim(),
              phone: m.phone.trim()
            }))
          })
        });

        if (!invRes.ok) {
          const errData = await invRes.json();
          setStepError(errData.detail || 'Failed to send invitations.');
          setCreating(false);
          return;
        }
      }

      await fetchInvitations(newTrip.id);
      setWizardStep(3);
    } catch (e) {
      setStepError('Network connection error. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const handleSendOTP = async (invId: number) => {
    if (!createdTripId) return;
    try {
      setStepError(null);
      setOtpStatusMsg('Sending verification code...');
      const res = await fetch(`${API_URL}/trips/${createdTripId}/invitations/${invId}/send-otp`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setOtpSent(true);
        setVerifyingMemberId(invId);
        setOtpCode('');
        
        if (data.mock_code) {
          setOtpStatusMsg(`[DEV MODE] OTP Code: ${data.mock_code}`);
        } else {
          setOtpStatusMsg('Verification code sent successfully.');
        }
        
        setOtpResendCooldown(60);
      } else {
        const data = await res.json();
        setStepError(data.detail || 'Failed to dispatch verification code.');
      }
    } catch {
      setStepError('Network failure sending verification code.');
    }
  };

  const handleVerifyOTP = async () => {
    if (!otpCode || otpCode.length !== 6) {
      setStepError('Please enter the 6-digit OTP code.');
      return;
    }
    if (!createdTripId || !verifyingMemberId) return;
    try {
      setStepError(null);
      setOtpStatusMsg('Verifying…');
      const res = await fetch(`${API_URL}/trips/${createdTripId}/invitations/${verifyingMemberId}/verify-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ code: otpCode })
      });
      if (res.ok) {
        setOtpSent(false);
        setVerifyingMemberId(null);
        setOtpStatusMsg('');
        showToast('Phone number verified successfully!');
        await fetchInvitations(createdTripId);
      } else {
        const data = await res.json();
        setOtpStatusMsg('');
        setStepError(data.detail || 'Invalid verification code.');
      }
    } catch {
      setStepError('Network error verifying code.');
    }
  };

  const handlePayNow = async () => {
    if (!confirmCheck1 || !confirmCheck2 || !confirmCheck3) {
      setStepError('Please confirm all checklist checkboxes.');
      return;
    }
    if (!createdTripId) return;
    setStepError(null);
    setPaymentStatus('PROCESSING');
    try {
      const res = await fetch(`${API_URL}/trips/${createdTripId}/payment/create-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          amount: parseFloat(budget || '0'),
          currency: 'INR'
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        setStepError(errData.detail || 'Failed to create payment order.');
        setPaymentStatus('FAILED');
        return;
      }

      const orderData = await res.json();
      const orderId = orderData.order_id;
      setRazorpayOrderId(orderId);

      const isMock = orderId.startsWith('order_mock_');
      if (isMock) {
        setTimeout(async () => {
          try {
            const verifyRes = await fetch(`${API_URL}/trips/${createdTripId}/payment/verify`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({
                razorpay_order_id: orderId,
                razorpay_payment_id: 'pay_mock_' + Math.random().toString(36).substring(2, 14),
                razorpay_signature: 'mock_signature'
              })
            });

            if (verifyRes.ok) {
              setPaymentStatus('SUCCESS');
              showToast('🎉 Group Trip Confirmed!');
              setWizardStep(5);
            } else {
              setStepError('Mock verification signature failed.');
              setPaymentStatus('FAILED');
            }
          } catch {
            setStepError('Network timeout verifying mock payment.');
            setPaymentStatus('FAILED');
          }
        }, 1500);
      } else {
        const options = {
          key: "rzp_test_TKNqtYMraXbefU",
          amount: Math.round(orderData.amount * 100),
          currency: orderData.currency,
          name: "Ghumne Chale",
          description: `Group Trip Checkout: ${name}`,
          order_id: orderId,
          handler: async function (response: any) {
            setPaymentStatus('PROCESSING');
            try {
              const verifyRes = await fetch(`${API_URL}/trips/${createdTripId}/payment/verify`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature
                })
              });
              if (verifyRes.ok) {
                setPaymentStatus('SUCCESS');
                showToast('🎉 Group Trip Confirmed!');
                setWizardStep(5);
              } else {
                setStepError('Razorpay payment signature validation failed.');
                setPaymentStatus('FAILED');
              }
            } catch {
              setStepError('Failed to verify payment with server.');
              setPaymentStatus('FAILED');
            }
          },
          prefill: {
            name: "Traveler",
            email: ""
          },
          theme: {
            color: "#7c3aed"
          },
          modal: {
            ondismiss: function () {
              setPaymentStatus('FAILED');
              setStepError('Payment transaction cancelled.');
            }
          }
        };
        const rzp = new (window as any).Razorpay(options);
        rzp.open();
      }

    } catch (e) {
      setStepError('Checkout transaction failed.');
      setPaymentStatus('FAILED');
    }
  };

  const getDays = (s: string, e: string) => {
    if (!s || !e) return null;
    const diff = Math.ceil((new Date(e).getTime() - new Date(s).getTime()) / 86400000);
    return diff > 0 ? diff : null;
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-full w-full" style={{ fontFamily: "'Inter', sans-serif" }}>

      {/* ── Toast ── */}
      {toast && (
        <div
          className="fixed top-6 right-6 z-[200] px-5 py-3 rounded-xl text-sm font-bold text-white shadow-2xl border transition-all"
          style={{
            background: toast.type === 'success' ? 'linear-gradient(135deg,#065f46,#064e3b)' : 'linear-gradient(135deg,#7f1d1d,#991b1b)',
            borderColor: toast.type === 'success' ? '#047857' : '#dc2626'
          }}
        >
          {toast.msg}
        </div>
      )}

      {/* ── Hero Banner ── */}
      <div className="relative overflow-hidden rounded-2xl mb-8 p-8"
        style={{ background: 'linear-gradient(135deg,#1a0533 0%,#0d1f4a 50%,#0a2440 100%)' }}>
        <div className="absolute inset-0 opacity-20"
          style={{ backgroundImage: 'radial-gradient(circle at 20% 50%,#7c3aed 0,transparent 50%),radial-gradient(circle at 80% 20%,#2563eb 0,transparent 40%)' }} />
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">✈️</span>
              <span className="text-xs font-bold text-purple-400 uppercase tracking-widest bg-purple-900/30 px-3 py-1 rounded-full border border-purple-700/40">Group Trips</span>
            </div>
            <h1 className="text-3xl font-black text-white mb-1">Plan Together. Travel Better.</h1>
            <p className="text-slate-400 text-sm max-w-lg">Collaborate with your squad — split expenses, build itineraries, vote on destinations, and chat in real time.</p>
          </div>
          <button onClick={openWizard}
            className="flex-shrink-0 flex items-center gap-2 px-6 py-3 rounded-xl font-black text-sm text-white cursor-pointer transition-all duration-200 hover:scale-105 active:scale-95"
            style={{ background: 'linear-gradient(135deg,#7c3aed,#2563eb)', boxShadow: '0 0 30px rgba(124,58,237,0.4)' }}>
            <span className="text-lg">+</span> New Group Trip
          </button>
        </div>
        {trips.length > 0 && (
          <div className="relative z-10 mt-6 grid grid-cols-3 gap-4">
            {[
              { label: 'Total Trips', value: trips.length, icon: '🗺️' },
              { label: 'Destinations', value: new Set(trips.map((t: any) => t.destination)).size, icon: '📍' },
              { label: 'Active', value: trips.filter((t: any) => !t.end_date || new Date(t.end_date) >= new Date()).length, icon: '🟢' },
            ].map(s => (
              <div key={s.label} className="bg-white/5 border border-white/10 rounded-xl p-3 text-center backdrop-blur-sm">
                <div className="text-lg mb-0.5">{s.icon}</div>
                <div className="text-xl font-black text-white">{s.value}</div>
                <div className="text-[10px] text-slate-400 uppercase tracking-wide">{s.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── List area ── */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <div className="w-10 h-10 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
          <p className="text-slate-400 text-sm">Loading your group trips…</p>
        </div>
      ) : listError ? (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <div className="text-4xl">⚠️</div>
          <p className="text-red-400 text-sm font-semibold">{listError}</p>
          <button onClick={fetchTrips} className="px-5 py-2 rounded-lg text-xs font-bold text-white border border-slate-700 hover:border-purple-500 transition-colors cursor-pointer" style={{ background: 'rgba(255,255,255,0.05)' }}>
            ↻ Retry
          </button>
        </div>
      ) : trips.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-5">
          <div className="text-6xl animate-bounce">🌍</div>
          <div className="text-center">
            <h3 className="text-xl font-black text-white mb-2">No Group Trips Yet</h3>
            <p className="text-slate-400 text-sm mb-6">Create your first group trip and invite your travel squad!</p>
            <button onClick={openWizard} className="px-8 py-3 rounded-xl font-black text-sm text-white cursor-pointer transition-all duration-200 hover:scale-105" style={{ background: 'linear-gradient(135deg,#7c3aed,#2563eb)' }}>
              ✈️ Create First Trip
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {trips.map((t: any, idx: number) => {
            const grad = TRIP_GRADIENTS[idx % TRIP_GRADIENTS.length];
            const emoji = TRIP_EMOJIS[idx % TRIP_EMOJIS.length];
            const days = getDays(t.start_date, t.end_date);
            const isPast = t.end_date && new Date(t.end_date) < new Date();
            return (
              <div key={t.id}
                className={`relative overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-br ${grad} group cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:border-slate-600`}
                style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.4)' }}
                onClick={() => onSelectTrip(t.id)}>
                <div className="p-5 pb-3">
                  <div className="flex items-start justify-between mb-3">
                    <span className="text-4xl">{emoji}</span>
                    <div className="flex flex-col items-end gap-1">
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide border ${t.status === 'Confirmed' ? 'text-emerald-400 border-emerald-700/50 bg-emerald-900/30' : 'text-yellow-400 border-yellow-700/50 bg-yellow-900/30'}`}>
                        {t.status || 'Planning'}
                      </span>
                      {t.trip_type && <span className="text-[10px] text-purple-400 font-semibold">{t.trip_type}</span>}
                    </div>
                  </div>
                  <h3 className="font-black text-white text-lg leading-tight mb-1">{t.name}</h3>
                  <p className="text-slate-300 text-xs flex items-center gap-1.5"><span>📍</span>{t.destination}</p>
                </div>
                <div className="px-5 pb-4 space-y-2">
                  <div className="flex items-center gap-4 text-[11px] text-slate-400">
                    {t.start_date && <span>📅 {new Date(t.start_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>}
                    {days && <span className="text-purple-400 font-bold">{days}d</span>}
                  </div>
                  {t.budget > 0 && <div className="text-[11px] text-slate-400">💰 Budget: <span className="text-white font-bold">₹{Number(t.budget).toLocaleString('en-IN')}</span></div>}
                  <div className="text-[11px] text-slate-500">👥 {t.member_count || 1} member{(t.member_count || 1) > 1 ? 's' : ''}</div>
                </div>
                <div className="border-t border-white/10 px-5 py-3 flex items-center justify-between">
                  <div className="flex -space-x-1.5">
                    {[...Array(Math.min(3, t.member_count || 1))].map((_, i) => (
                      <div key={i} className="w-6 h-6 rounded-full border-2 border-slate-800 flex items-center justify-center text-[10px] font-bold"
                        style={{ background: `hsl(${(i * 80 + idx * 40) % 360},60%,45%)` }}>{String.fromCharCode(65 + i)}</div>
                    ))}
                  </div>
                  <span className="text-xs font-bold text-blue-400 group-hover:text-white transition-colors flex items-center gap-1">
                    Open Workspace <span className="group-hover:translate-x-1 transition-transform inline-block">→</span>
                  </span>
                </div>
              </div>
            );
          })}
          <div onClick={openWizard}
            className="relative overflow-hidden rounded-2xl border-2 border-dashed border-slate-700 hover:border-purple-600/60 flex flex-col items-center justify-center gap-3 p-8 cursor-pointer transition-all duration-300 hover:bg-purple-900/10 min-h-[200px] group">
            <div className="w-12 h-12 rounded-full bg-slate-800 group-hover:bg-purple-900/40 flex items-center justify-center text-2xl transition-all duration-300 group-hover:scale-110">+</div>
            <div className="text-center"><p className="text-slate-300 font-bold text-sm">New Group Trip</p><p className="text-slate-500 text-xs mt-0.5">Start planning with your crew</p></div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          WIZARD MODAL
          ════════════════════════════════════════════════════════════════ */}
      {showWizard && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)' }}
          onClick={closeWizard}>
          <div
            className="w-full sm:max-w-xl rounded-t-3xl sm:rounded-2xl border border-slate-700/80 shadow-2xl flex flex-col"
            style={{ background: 'linear-gradient(160deg,#0d1525 0%,#070d1a 100%)', maxHeight: '95vh' }}
            onClick={e => e.stopPropagation()}>

            {/* ── Wizard Header ── */}
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-800 flex-shrink-0">
              <div>
                <h2 className="text-lg font-black text-white">
                  {wizardStep === 1 && '✈️ Trip Details'}
                  {wizardStep === 2 && '👥 Add Members'}
                  {wizardStep === 3 && '🔒 Verify Members'}
                  {wizardStep === 4 && '💳 Review & Payment'}
                  {wizardStep === 5 && '🎉 Trip Confirmed!'}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {wizardStep === 1 && 'Tell us about your trip'}
                  {wizardStep === 2 && 'Who is coming with you?'}
                  {wizardStep === 3 && 'Verify travelers to continue'}
                  {wizardStep === 4 && 'Confirm payment and details'}
                  {wizardStep === 5 && 'Your adventure starts here'}
                </p>
              </div>
              <button onClick={closeWizard} disabled={creating || paymentStatus === 'PROCESSING'}
                className="text-slate-500 hover:text-white transition-colors w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 cursor-pointer">✕</button>
            </div>

            {/* ── Progress Bar ── */}
            <div className="flex gap-1 px-6 py-3 flex-shrink-0">
              {['Trip Details', 'Members', 'Verify', 'Payment', 'Confirmed'].map((label, i) => (
                <div key={label} className="flex-1 flex flex-col gap-1">
                  <div className={`h-1 rounded-full transition-all duration-300 ${i + 1 <= wizardStep ? 'bg-purple-500' : 'bg-slate-800'}`} />
                  <span className={`text-[9px] font-bold uppercase tracking-wider transition-colors ${i + 1 === wizardStep ? 'text-purple-400' : i + 1 < wizardStep ? 'text-emerald-500' : 'text-slate-600'}`}>
                    {i + 1 < wizardStep ? '✓ ' : `${i + 1}. `}{label}
                  </span>
                </div>
              ))}
            </div>

            {/* ── Step Content (scrollable) ── */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">

              {/* ─────────────── STEP 1: TRIP DETAILS ─────────────── */}
              {wizardStep === 1 && (
                <>
                  <div>
                    <label className="text-xs font-bold text-slate-400 block mb-1.5" htmlFor="gt-name">✈️ Trip Name *</label>
                    <input id="gt-name" type="text" placeholder="e.g. Goa Friends Trip 2025"
                      value={name} onChange={e => setName(e.target.value)}
                      className="w-full rounded-lg px-3 py-2.5 text-sm text-white border border-slate-700 focus:border-purple-500 outline-none transition-colors"
                      style={{ background: 'rgba(255,255,255,0.05)' }} />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-400 block mb-1.5">📍 Destination *</label>
                    <DestinationAutocomplete value={destination} onChange={setDestination} />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-400 block mb-1.5">🏷️ Trip Type</label>
                    <div className="flex flex-wrap gap-2">
                      {['Friends', 'Family', 'Couple', 'College', 'Corporate', 'Honeymoon'].map(t => (
                        <button key={t} type="button" onClick={() => setTripType(t)}
                          className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all cursor-pointer ${tripType === t ? 'border-purple-500 bg-purple-900/40 text-purple-300' : 'border-slate-700 text-slate-400 hover:border-slate-600'}`}>
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-400 block mb-1.5" htmlFor="gt-start">📅 Start Date</label>
                      <input id="gt-start" type="date" value={startDate} min={today}
                        onChange={e => { setStartDate(e.target.value); if (endDate && e.target.value > endDate) setEndDate(''); }}
                        className="w-full rounded-lg px-3 py-2 text-sm text-white border border-slate-700 focus:border-purple-500 outline-none transition-colors cursor-pointer"
                        style={{ background: '#1a2540', colorScheme: 'dark' }} />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-400 block mb-1.5" htmlFor="gt-end">🏁 End Date</label>
                      <input id="gt-end" type="date" value={endDate} min={startDate || today}
                        onChange={e => setEndDate(e.target.value)}
                        className="w-full rounded-lg px-3 py-2 text-sm text-white border border-slate-700 focus:border-purple-500 outline-none transition-colors cursor-pointer"
                        style={{ background: '#1a2540', colorScheme: 'dark' }} />
                    </div>
                  </div>
                  {duration && (
                    <div className="text-xs text-center text-purple-400 font-bold bg-purple-900/20 border border-purple-800/30 rounded-lg py-1.5">
                      🌙 {duration} Night{duration > 1 ? 's' : ''} · {duration + 1} Day{duration + 1 > 1 ? 's' : ''}
                    </div>
                  )}

                  <div>
                    <label className="text-xs font-bold text-slate-400 block mb-1.5" htmlFor="gt-budget">💰 Total Budget (₹)</label>
                    <input id="gt-budget" type="number" placeholder="e.g. 50000" value={budget} min={0}
                      onChange={e => setBudget(e.target.value)}
                      className="w-full rounded-lg px-3 py-2.5 text-sm text-white border border-slate-700 focus:border-purple-500 outline-none transition-colors"
                      style={{ background: 'rgba(255,255,255,0.05)' }} />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-400 block mb-1.5" htmlFor="gt-desc">📝 Description (optional)</label>
                    <textarea id="gt-desc" rows={2} placeholder="Brief trip description…"
                      value={tripDesc} onChange={e => setTripDesc(e.target.value)}
                      className="w-full rounded-lg px-3 py-2 text-sm text-white border border-slate-700 focus:border-purple-500 outline-none transition-colors resize-none"
                      style={{ background: 'rgba(255,255,255,0.05)' }} />
                  </div>
                </>
              )}

              {/* ─────────────── STEP 2: MEMBERS ─────────────── */}
              {wizardStep === 2 && (
                <>
                  <p className="text-xs text-slate-400 bg-slate-800/50 rounded-lg px-3 py-2 border border-slate-700/50">
                    💡 Add your squad to the trip. Every added member must verify their details to secure workspace access.
                  </p>
                  <div className="space-y-3">
                    {members.map((m, idx) => (
                      <div key={idx} className="rounded-xl border border-slate-700/60 p-4 space-y-2.5" style={{ background: 'rgba(255,255,255,0.03)' }}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-slate-300">👤 Traveler {idx + 1}</span>
                          {members.length > 1 && (
                            <button type="button" onClick={() => setMembers(members.filter((_, i) => i !== idx))}
                              className="text-slate-500 hover:text-red-400 transition-colors text-xs cursor-pointer">✕ Remove</button>
                          )}
                        </div>
                        <input type="text" placeholder="Full Name *"
                          value={m.name} onChange={e => { const u = [...members]; u[idx].name = e.target.value; setMembers(u); }}
                          className="w-full rounded-lg px-3 py-2 text-sm text-white border border-slate-700 focus:border-purple-500 outline-none transition-colors"
                          style={{ background: 'rgba(255,255,255,0.05)' }} />
                        <input type="email" placeholder="Email address *"
                          value={m.email} onChange={e => { const u = [...members]; u[idx].email = e.target.value; setMembers(u); }}
                          className="w-full rounded-lg px-3 py-2 text-sm text-white border border-slate-700 focus:border-purple-500 outline-none transition-colors"
                          style={{ background: 'rgba(255,255,255,0.05)' }} />
                        <div className="flex gap-2">
                          <span className="text-xs text-slate-400 self-center flex-shrink-0 bg-slate-800 px-2 py-2 rounded-lg border border-slate-700">+91</span>
                          <input type="tel" placeholder="10-digit Phone *"
                            value={m.phone} onChange={e => { const u = [...members]; u[idx].phone = e.target.value; setMembers(u); }}
                            className="flex-1 rounded-lg px-3 py-2 text-sm text-white border border-slate-700 focus:border-purple-500 outline-none transition-colors"
                            style={{ background: 'rgba(255,255,255,0.05)' }} />
                        </div>
                      </div>
                    ))}
                    <button type="button" onClick={() => setMembers([...members, { name: '', email: '', phone: '' }])}
                      className="text-xs text-purple-400 hover:text-purple-300 font-semibold flex items-center gap-1 cursor-pointer transition-colors py-1">
                      <span>+</span> Add Companion
                    </button>
                  </div>
                </>
              )}

              {/* ─────────────── STEP 3: VERIFY MEMBERS ─────────────── */}
              {wizardStep === 3 && (
                <>
                  <div className="bg-slate-800/40 rounded-xl border border-slate-700/60 p-4">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Traveler Verification Checklist</h4>
                    <div className="space-y-3">
                      {invitations.map((inv) => (
                        <div key={inv.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-slate-900/50 rounded-lg border border-slate-800/80">
                          <div>
                            <div className="text-sm font-semibold text-white">{inv.name}</div>
                            <div className="text-[10px] text-slate-400">{inv.phone}</div>
                          </div>
                          <div>
                            {inv.phone_verified ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-900/20 border border-emerald-800/50 px-2.5 py-1 rounded-full">
                                ✓ Phone Verified
                              </span>
                            ) : verifyingMemberId === inv.id && otpSent ? (
                              <div className="flex items-center gap-2">
                                <input type="text" maxLength={6} placeholder="Enter 6-digit OTP"
                                  value={otpCode} onChange={e => setOtpCode(e.target.value)}
                                  className="w-28 rounded-lg px-2 py-1 text-xs text-white border border-slate-700 focus:border-purple-500 outline-none text-center"
                                  style={{ background: 'rgba(0,0,0,0.3)' }} />
                                <button type="button" onClick={handleVerifyOTP}
                                  className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white text-[10px] font-bold rounded-lg transition-colors cursor-pointer">
                                  Verify
                                </button>
                                <button type="button" onClick={() => handleSendOTP(inv.id)} disabled={otpResendCooldown > 0}
                                  className="text-slate-400 hover:text-white text-[10px] disabled:opacity-40 cursor-pointer">
                                  {otpResendCooldown > 0 ? `Resend (${otpResendCooldown}s)` : 'Resend'}
                                </button>
                              </div>
                            ) : (
                              <button type="button" onClick={() => handleSendOTP(inv.id)}
                                className="px-4 py-1.5 bg-purple-900/30 hover:bg-purple-900/50 text-purple-300 border border-purple-700/40 text-[10px] font-bold rounded-lg transition-colors cursor-pointer">
                                Send OTP Code
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  {otpStatusMsg && (
                    <div className="text-purple-400 text-xs bg-purple-950/20 border border-purple-900/30 rounded-lg px-3 py-2">
                      ℹ️ {otpStatusMsg}
                    </div>
                  )}
                </>
              )}

              {/* ─────────────── STEP 4: REVIEW & PAYMENT ─────────────── */}
              {wizardStep === 4 && (
                <>
                  <div className="rounded-xl border border-slate-700/60 overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)' }}>
                    <div className="px-4 py-3 border-b border-slate-800">
                      <h4 className="text-sm font-black text-white">{name}</h4>
                      <p className="text-xs text-slate-400">📍 {destination} · 🏷️ {tripType}</p>
                    </div>
                    <div className="px-4 py-3 grid grid-cols-2 gap-3 text-xs text-slate-400">
                      {startDate && <div>📅 Start<br /><span className="text-white font-bold">{new Date(startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span></div>}
                      {endDate && <div>🏁 End<br /><span className="text-white font-bold">{new Date(endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span></div>}
                      {duration && <div>🌙 Duration<br /><span className="text-purple-400 font-bold">{duration} Night{duration > 1 ? 's' : ''}</span></div>}
                      {budget && <div>💰 Total Budget<br /><span className="text-emerald-400 font-bold">₹{Number(parseFloat(budget)).toLocaleString('en-IN')}</span></div>}
                    </div>
                  </div>

                  <div className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-4 space-y-3">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Payment Breakdown</h4>
                    <div className="space-y-2 text-xs text-slate-300">
                      <div className="flex justify-between">
                        <span>Total Trip Amount</span>
                        <span>₹{Number(parseFloat(budget || '0')).toLocaleString('en-IN')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Travelers Count</span>
                        <span>{invitations.length + 1} (Owner + {invitations.length} companions)</span>
                      </div>
                      <div className="flex justify-between border-t border-slate-800 pt-2 font-bold text-white">
                        <span>Share Per Traveler</span>
                        <span>₹{Number(Math.round(parseFloat(budget || '0') / (invitations.length + 1))).toLocaleString('en-IN')}</span>
                      </div>
                    </div>
                  </div>

                  {/* Checklist */}
                  <div className="space-y-2.5 pt-1">
                    {[
                      { key: 'c1', val: confirmCheck1, set: setConfirmCheck1, text: 'I confirm the trip name, destination, and dates are correct.' },
                      { key: 'c2', val: confirmCheck2, set: setConfirmCheck2, text: 'I confirm all companions have been verified and added.' },
                      { key: 'c3', val: confirmCheck3, set: setConfirmCheck3, text: 'I understand the checkout amount will be processed for the group.' },
                    ].map(c => (
                      <label key={c.key} className="flex items-start gap-3 cursor-pointer group">
                        <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border transition-all mt-0.5 ${c.val ? 'bg-purple-600 border-purple-600' : 'border-slate-600 group-hover:border-purple-500'}`}
                          onClick={() => c.set(!c.val)}>
                          {c.val && <span className="text-white text-xs font-black">✓</span>}
                        </div>
                        <span className="text-xs text-slate-300 leading-relaxed">{c.text}</span>
                      </label>
                    ))}
                  </div>
                </>
              )}

              {/* ─────────────── STEP 5: TRIP CONFIRMED SUCCESS ─────────────── */}
              {wizardStep === 5 && (
                <div className="text-center py-8 space-y-5">
                  <div className="text-6xl animate-bounce">🎉</div>
                  <div>
                    <h3 className="text-2xl font-black text-white">Trip Confirmed!</h3>
                    <p className="text-slate-400 text-sm mt-1">Your group trip workspace is fully launched and ready.</p>
                  </div>
                  <div className="bg-[#1e293b]/50 border border-slate-700/60 rounded-2xl p-5 max-w-sm mx-auto text-left space-y-3">
                    <div className="text-sm font-bold text-white border-b border-slate-800 pb-2">{name}</div>
                    <div className="text-xs text-slate-300 space-y-1">
                      <div>📍 Destination: <span className="text-white font-bold">{destination}</span></div>
                      <div>📅 Dates: <span className="text-white font-bold">{startDate} → {endDate}</span></div>
                      <div>👥 Members: <span className="text-white font-bold">{invitations.length + 1} travelers</span></div>
                      <div>💰 Total Budget: <span className="text-emerald-400 font-bold">₹{Number(parseFloat(budget || '0')).toLocaleString('en-IN')}</span></div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Step Error ── */}
              {stepError && (
                <div className="text-red-400 text-xs bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2.5 flex items-start gap-2">
                  <span className="flex-shrink-0">⚠️</span>
                  <span>{stepError}</span>
                </div>
              )}
            </div>

            {/* ── Sticky Footer ── */}
            <div className="flex-shrink-0 px-6 py-4 border-t border-slate-800 flex items-center justify-between gap-3">
              {wizardStep > 1 && wizardStep < 5 && paymentStatus !== 'PROCESSING' ? (
                <button type="button" onClick={() => { setStepError(null); setWizardStep(s => s - 1); }}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-slate-300 border border-slate-700 hover:border-slate-500 transition-all cursor-pointer">
                  ← Back
                </button>
              ) : wizardStep < 5 ? (
                <button type="button" onClick={closeWizard} disabled={paymentStatus === 'PROCESSING'}
                  className="px-4 py-2.5 rounded-xl text-sm font-bold text-slate-500 hover:text-slate-300 transition-colors cursor-pointer disabled:opacity-30">
                  Cancel
                </button>
              ) : null}

              {wizardStep === 1 && (
                <button type="button" onClick={goToStep2}
                  className="flex-1 max-w-xs py-2.5 rounded-xl font-black text-sm text-white cursor-pointer transition-all duration-200 hover:scale-[1.02] active:scale-95"
                  style={{ background: 'linear-gradient(135deg,#7c3aed,#2563eb)' }}>
                  Continue to Members →
                </button>
              )}
              {wizardStep === 2 && (
                <button type="button" onClick={handleCreateAndInvite} disabled={creating}
                  className="flex-1 max-w-xs py-2.5 rounded-xl font-black text-sm text-white cursor-pointer transition-all duration-200 hover:scale-[1.02] active:scale-95 disabled:opacity-40"
                  style={{ background: 'linear-gradient(135deg,#7c3aed,#2563eb)' }}>
                  {creating ? '⏳ Creating Workspace…' : 'Add Members & Verify →'}
                </button>
              )}
              {wizardStep === 3 && (
                <button type="button" onClick={() => {
                  const unverified = invitations.filter(i => !i.phone_verified);
                  if (unverified.length > 0) {
                    setStepError(`Please verify phone numbers for: ${unverified.map(u => u.name).join(', ')}.`);
                    return;
                  }
                  setStepError(null);
                  setWizardStep(4);
                }}
                  className="flex-1 max-w-xs py-2.5 rounded-xl font-black text-sm text-white cursor-pointer transition-all duration-200 hover:scale-[1.02] active:scale-95"
                  style={{ background: 'linear-gradient(135deg,#7c3aed,#2563eb)' }}>
                  Review & Checkout →
                </button>
              )}
              {wizardStep === 4 && (
                <button type="button" disabled={paymentStatus === 'PROCESSING' || !confirmCheck1 || !confirmCheck2 || !confirmCheck3} onClick={handlePayNow}
                  className="flex-1 max-w-xs py-2.5 rounded-xl font-black text-sm text-white cursor-pointer transition-all duration-200 hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: 'linear-gradient(135deg,#7c3aed,#2563eb)', boxShadow: '0 0 20px rgba(124,58,237,0.3)' }}>
                  {paymentStatus === 'PROCESSING' ? '⏳ Directing to Payment…' : `💳 Pay ₹${Number(parseFloat(budget || '0')).toLocaleString('en-IN')}`}
                </button>
              )}
              {wizardStep === 5 && (
                <button type="button" onClick={async () => {
                  setShowWizard(false);
                  resetWizard();
                  await fetchTrips();
                  if (createdTripId) {
                    onSelectTrip(createdTripId);
                  }
                }}
                  className="w-full py-3 rounded-xl font-black text-sm text-white cursor-pointer transition-all duration-200 hover:scale-[1.02]"
                  style={{ background: 'linear-gradient(135deg,#7c3aed,#2563eb)' }}>
                  Open Group Workspace ➔
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}



let globalIsRefreshing = false;
let globalRefreshQueue: Array<{ resolve: (token: string | null) => void }> = [];

export default function App() {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [userRole, setUserRole] = useState<string | null>(localStorage.getItem('user_role'));
  const [activeTab, setActiveTab] = useState<'dashboard' | 'explore' | 'chat' | 'wallet' | 'trips' | 'documents' | 'wishlist' | 'group-trips' | 'ai-planner'>('dashboard');
  const [selectedGroupTripId, setSelectedGroupTripId] = useState<number | null>(null);
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
  const [userProfile, setUserProfile] = useState<any>(() => {
    const savedBal = localStorage.getItem("wallet_balance") || sessionStorage.getItem("wallet_balance");
    return {
      email: "traveler@travelos.com",
      tier: "Gold",
      points: 450,
      walletBalance: savedBal ? parseFloat(savedBal) : 24500.00
    };
  });

  useEffect(() => {
    if (userProfile && typeof userProfile.walletBalance === "number") {
      localStorage.setItem("wallet_balance", userProfile.walletBalance.toString());
      sessionStorage.setItem("wallet_balance", userProfile.walletBalance.toString());
    }
  }, [userProfile?.walletBalance]);

  const [profileName, setProfileName] = useState("");
  const [profileCompletion, setProfileCompletion] = useState(0);
  const [profileData, setProfileData] = useState<any>(null);

  const [passengers, setPassengers] = useState<number>(() => {
    const val = sessionStorage.getItem("fl_passengers");
    return val ? parseInt(val, 10) : 1;
  });

  const [passengersList, setPassengersList] = useState<{
    id: number;
    fullName: string;
    age: string;
    email: string;
    phone: string;
    specialFareType: string;
    studentId: string;
    studentName: string;
    institutionName: string;
    institutionCity: string;
    studentCourse: string;
    studentDateOfBirth: string;
    studentEmail: string;
    studentVerificationStatus: string;
    studentIdFile: string;
    serviceId: string;
    gender?: string;
    savedPassengerId?: number;
    isEdited?: boolean;
    shouldSavePassenger?: boolean;
    shouldUpdatePassenger?: boolean;
  }[]>(() => {
    const val = sessionStorage.getItem("fl_passengers");
    const count = val ? parseInt(val, 10) : 1;
    return Array.from({ length: count }, (_, i) => ({
      id: i + 1,
      fullName: "",
      age: "",
      email: "",
      phone: "",
      specialFareType: "regular",
      studentId: "",
      studentName: "",
      institutionName: "",
      institutionCity: "",
      studentCourse: "",
      studentDateOfBirth: "",
      studentEmail: "",
      studentVerificationStatus: "incomplete",
      studentIdFile: "",
      serviceId: "",
      gender: "Male",
      savedPassengerId: undefined,
      isEdited: false,
      shouldSavePassenger: false,
      shouldUpdatePassenger: false
    }));
  });

  useEffect(() => {
    setPassengersList((prevList) => {
      const currentLength = prevList.length;
      if (currentLength < passengers) {
        const addedCount = passengers - currentLength;
        const newItems = Array.from({ length: addedCount }, (_, i) => ({
          id: currentLength + i + 1,
          fullName: "",
          age: "",
          email: "",
          phone: "",
          specialFareType: "regular",
          studentId: "",
          studentName: "",
          institutionName: "",
          institutionCity: "",
          studentCourse: "",
          studentDateOfBirth: "",
          studentEmail: "",
          studentVerificationStatus: "incomplete",
          studentIdFile: "",
          serviceId: "",
          gender: "Male",
          savedPassengerId: undefined,
          isEdited: false,
          shouldSavePassenger: false,
          shouldUpdatePassenger: false
        }));
        return [...prevList, ...newItems];
      } else if (currentLength > passengers) {
        return prevList.slice(0, passengers);
      }
      return prevList;
    });
    sessionStorage.setItem("fl_passengers", String(passengers));
  }, [passengers]);

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

    fetch(`${API_URL}/wishlist`, {
      headers: { "Authorization": `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setWishlistItems(data);
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
    const match = currentPath.match(/^\/group-trips\/(\d+)$/);
    if (match) {
      const id = parseInt(match[1], 10);
      setActiveTab('group-trips');
      setSelectedGroupTripId(id);
    } else if (currentPath === '/group-trips') {
      setActiveTab('group-trips');
      setSelectedGroupTripId(null);
    }
  }, [currentPath]);

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
    // Using global variables to prevent reset on token state changes
    
    let deviceId = localStorage.getItem('device_id');
    if (!deviceId) {
      deviceId = Math.random().toString(36).substring(2) + Date.now().toString(36);
      localStorage.setItem('device_id', deviceId);
    }
    
    const executeRefresh = async (): Promise<{ token: string | null; shouldLogout: boolean }> => {
      const refreshToken = localStorage.getItem('refresh_token');
      if (!refreshToken) return { token: null, shouldLogout: true };
      
      try {
        const resp = await originalFetch(`${API_URL}/auth/refresh`, {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "X-Device-Id": deviceId || ""
          },
          body: JSON.stringify({ 
            refresh_token: refreshToken,
            device_id: deviceId
          })
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
          return { token: data.access_token, shouldLogout: false };
        } else {
          const isAuthError = resp.status === 400 || resp.status === 401 || resp.status === 403;
          return { token: null, shouldLogout: isAuthError };
        }
      } catch (err) {
        return { token: null, shouldLogout: false };
      }
    };

    const processQueue = (newToken: string | null) => {
      globalRefreshQueue.forEach(prom => prom.resolve(newToken));
      globalRefreshQueue = [];
    };

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const urlStr = typeof input === 'string' ? input : (input instanceof URL ? input.href : input.url);
      const isBackendReq = urlStr.includes(API_URL) || urlStr.startsWith('/api/') || urlStr.startsWith(API_URL);
      const isAuthRoute = urlStr.includes('/auth/token') || urlStr.includes('/auth/signup') || urlStr.includes('/auth/refresh');
      
      let currentToken = localStorage.getItem('token');
      
      if (isBackendReq) {
        init = init || {};
        init.headers = init.headers || {};
        
        // Inject X-Device-Id
        if (init.headers instanceof Headers) {
          init.headers.set('X-Device-Id', deviceId || '');
        } else if (Array.isArray(init.headers)) {
          const hasDev = init.headers.some(([k]) => k.toLowerCase() === 'x-device-id');
          if (!hasDev) init.headers.push(['X-Device-Id', deviceId || '']);
        } else {
          const headersRecord = init.headers as Record<string, string>;
          const keys = Object.keys(headersRecord);
          const devKey = keys.find(k => k.toLowerCase() === 'x-device-id') || 'X-Device-Id';
          if (!headersRecord[devKey]) {
            headersRecord[devKey] = deviceId || '';
          }
        }
      }
      
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
          if (globalIsRefreshing) {
            const newToken = await new Promise<string | null>((resolve) => {
              globalRefreshQueue.push({ resolve });
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
            globalIsRefreshing = true;
            const refreshResult = await executeRefresh();
            globalIsRefreshing = false;
            processQueue(refreshResult.token);
            
            if (refreshResult.token) {
              currentToken = refreshResult.token;
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
            } else if (refreshResult.shouldLogout) {
              handleLogout();
              return new Response(JSON.stringify({ detail: "Session Expired" }), { status: 401 });
            } else {
              return new Response(JSON.stringify({ detail: "Temporary connection error. Retrying soon." }), { status: 503 });
            }
          }
        }
      }
      
      let response = await originalFetch(input, init);
      
      if (response.status === 401 && isBackendReq && !isAuthRoute && localStorage.getItem('refresh_token')) {
        if (globalIsRefreshing) {
          const newToken = await new Promise<string | null>((resolve) => {
            globalRefreshQueue.push({ resolve });
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
          globalIsRefreshing = true;
          const refreshResult = await executeRefresh();
          globalIsRefreshing = false;
          processQueue(refreshResult.token);
          
          if (refreshResult.token) {
            if (init && init.headers) {
              if (init.headers instanceof Headers) {
                init.headers.set('Authorization', `Bearer ${refreshResult.token}`);
              } else if (Array.isArray(init.headers)) {
                const idx = init.headers.findIndex(([k]) => k.toLowerCase() === 'authorization');
                if (idx !== -1) init.headers[idx] = ['Authorization', `Bearer ${refreshResult.token}`];
              } else {
                const headersRecord = init.headers as Record<string, string>;
                const authKey = Object.keys(headersRecord).find(k => k.toLowerCase() === 'authorization') || 'Authorization';
                headersRecord[authKey] = `Bearer ${refreshResult.token}`;
              }
            }
            return originalFetch(input, init);
          } else if (refreshResult.shouldLogout) {
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

        if (qRole === 'admin' || qRole === 'super_admin' || qRole === 'finance_admin' || qRole === 'booking_approver') {
          navigate('/admin');
        } else {
          navigate('/');
        }
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
    navigate('/admin');
  };

  // Path Interception and Guards
  useEffect(() => {
    if (currentPath === '/admin') {
      if (!token) {
        const params = new URLSearchParams(window.location.search);
        const hasExchange = params.has('exchange_code');
        if (!hasExchange) {
          navigate('/');
        }
      } else {
        const decoded = decodeJwt(token);
        const role = decoded?.role || userRole;
        if (role === 'admin' || role === 'super_admin' || role === 'finance_admin' || role === 'booking_approver') {
          // Stay on /admin and render the AdminConsole component.
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

  const handleLogout = async () => {
    const curToken = localStorage.getItem('token');
    const refreshToken = localStorage.getItem('refresh_token');
    const deviceId = localStorage.getItem('device_id');
    
    if (curToken) {
      try {
        await window.fetch(`${API_URL}/auth/logout`, {

          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${curToken}`,
            "X-Device-Id": deviceId || ""
          },
          body: JSON.stringify({ refresh_token: refreshToken })
        });
      } catch (err) {
        console.warn("Logout API call failed:", err);
      }
    }

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


  const handleDeepLinkFlight = (origin: string, dest: string, date: string) => {
    sessionStorage.setItem("fl_fromCity", origin);
    sessionStorage.setItem("fl_toCity", dest);
    sessionStorage.setItem("fl_depDate", date);
    sessionStorage.setItem("active_vertical", "flights");
    setActiveTab("explore");
  };

  const handleDeepLinkHotel = (dest: string, checkIn: string, checkOut: string) => {
    sessionStorage.setItem("ht_city", dest);
    sessionStorage.setItem("ht_checkIn", checkIn);
    sessionStorage.setItem("ht_checkOut", checkOut);
    sessionStorage.setItem("active_vertical", "hotels");
    setActiveTab("explore");
  };

  const handleOnBook = (bookData: any) => {
    try {
      sessionStorage.setItem("fl_last_checkout_data", JSON.stringify(bookData));
    } catch (e) {}
    const count = bookData.details?.passengers?.length || bookData.details?.guests?.length || 1;
    const initialFareType = bookData.details?.specialFareType ? normalizeSpecialFareKey(bookData.details.specialFareType) : "regular";
    setPassengers(count);
    setPassengersList(
      Array.from({ length: count }, (_, i) => ({
        id: i + 1,
        fullName: "",
        age: "",
        email: "",
        phone: "",
        specialFareType: i === 0 ? initialFareType : "regular",
        studentId: "",
        studentName: "",
        institutionName: "",
        institutionCity: "",
        studentCourse: "",
        studentDateOfBirth: "",
        studentEmail: "",
        studentVerificationStatus: "incomplete",
        studentIdFile: "",
        serviceId: ""
      }))
    );
    setCheckoutData(bookData);
  };

  useEffect(() => {
    if (currentPath === "/") {
      const shouldReopen = sessionStorage.getItem("fl_reopen_checkout");
      if (shouldReopen === "true") {
        sessionStorage.removeItem("fl_reopen_checkout");
        try {
          const last = sessionStorage.getItem("fl_last_checkout_data");
          if (last) {
            setCheckoutData(JSON.parse(last));
          }
        } catch (e) {}
      }
    }
  }, [currentPath]);
  
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
        user_id: userProfile?.id || 1,
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
          method: "POST",
          headers: {
            ...(token ? { "Authorization": `Bearer ${token}` } : {})
          }
        })
          .then(res => res.json())
          .then(confirmRes => {
            if (confirmRes.booking_reference) {
              alert(confirmRes.message || "Booking processed successfully!");
              
              if (payMethod === 'wallet') {
                addLocalWalletTransaction('debit', checkoutData.amount, confirmRes.booking_reference, `Booking Payment: ${checkoutData.vertical.toUpperCase()}`, userProfile.walletBalance);
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
    // Allow /verify-email, /forgot-password, /reset-password to be rendered before authentication
    if (currentPath.startsWith('/verify-email')) {
      let emailParam = '';
      try {
        const queryIndex = currentPath.indexOf('?');
        if (queryIndex !== -1) {
          const searchParams = new URLSearchParams(currentPath.substring(queryIndex));
          emailParam = searchParams.get('email') || '';
        }
      } catch (e) {
        console.error("Failed to parse query params from currentPath", e);
      }
      if (!emailParam) {
        const params = new URLSearchParams(window.location.search);
        emailParam = params.get('email') || '';
      }
      return <VerifyEmailPage email={emailParam} onNavigate={navigate} />;
    }
    if (currentPath === '/forgot-password' || currentPath === '/reset-password') {
      return <ForgotPasswordPage onNavigate={navigate} />;
    }
    return <LoginScreen onLogin={handleLogin} onNavigate={navigate} />;
  }

  if (currentPath === "/profile") {
    return <ProfilePage onNavigate={navigate} token={token} />;
  }

  if (currentPath === "/notifications") {
    return <NotificationsPage onNavigate={navigate} token={token} />;
  }

  if (currentPath === "/dashboard") {
    return <DashboardPage onNavigate={navigate} token={token} setActiveTab={(tab: any) => setActiveTab(tab)} />;
  }

  if (currentPath === "/trips") {
    return <TripTimelinePage onNavigate={navigate} token={token} setActiveTab={(tab: any) => setActiveTab(tab)} />;
  }

  if (currentPath === "/documents") {
    return <DocumentsPage onNavigate={navigate} token={token} setActiveTab={(tab: any) => setActiveTab(tab)} />;
  }

  const checkoutMatch = currentPath.match(/^\/checkout\/([^/]+)$/) || currentPath.match(/^\/payment-failed\/([^/]+)$/);
  const confirmationMatch = 
    currentPath.match(/^\/bookings\/([^/]+)\/confirmation$/) || 
    currentPath.match(/^\/booking-confirmation\/([^/]+)$/) || 
    currentPath.match(/^\/payment-success\/([^/]+)$/);
  
  const groupTripsMatch = currentPath.match(/^\/group-trips\/(\d+)$/);

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

  if (currentPath === '/admin') {
    return (
      <AdminConsole
        token={token}
        userRole={userRole}
        userEmail={userProfile.email}
        onNavigate={navigate}
        handleLogout={handleLogout}
      />
    );
  }

  if (currentPath === '/privacy') {
    return <LegalPage page="privacy" onNavigate={navigate} />;
  }

  if (currentPath === '/terms') {
    return <LegalPage page="terms" onNavigate={navigate} />;
  }

  if (currentPath === '/support' || currentPath === '/help') {
    return <SupportCenterPage onNavigate={navigate} token={token} />;
  }

  if (currentPath === '/design-tokens') {
    return <DesignTokensPage onNavigate={navigate} />;
  }

  // 404 Page (Phase 17)
  const validPaths = ["/", "/profile", "/notifications", "/design-tokens", "/admin", "/privacy", "/terms", "/support", "/help", "/forgot-password", "/reset-password", "/dashboard", "/trips", "/documents", "/group-trips"];

  const isMatch = 
    validPaths.includes(currentPath) || 
    currentPath.startsWith('/verify-email') ||
    !!checkoutMatch || 
    !!confirmationMatch || 
    !!bookingDetailMatch || 
    !!rentARideMatch ||
    !!groupTripsMatch;

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

  const toggleWishlist = async (itemType: string, refId: string, snapshot: any) => {
    if (!token) {
      alert("Please login to save items to your wishlist.");
      return;
    }
    const existing = wishlistItems.find(w => w.item_ref_id === refId && w.item_type.toLowerCase() === itemType.toLowerCase());
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
    if (existing) {
      try {
        const res = await fetch(`${API_URL}/wishlist/${existing.id}`, {
          method: 'DELETE',
          headers
        });
        if (res.ok) {
          setWishlistItems(prev => prev.filter(w => w.id !== existing.id));
        }
      } catch (err) {
        console.error("Failed to delete wishlist item", err);
      }
    } else {
      try {
        const res = await fetch(`${API_URL}/wishlist`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            item_type: itemType,
            item_ref_id: refId,
            snapshot_json: snapshot
          })
        });
        if (res.ok) {
          const newItem = await res.json();
          setWishlistItems(prev => [...prev, newItem]);
        }
      } catch (err) {
        console.error("Failed to add wishlist item", err);
      }
    }
  };

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
                GHUMNE CHALE
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
              active={activeTab === 'dashboard'} 
              icon={<Home size={20} />} 
              label="Dashboard" 
              onClick={() => { setActiveTab('dashboard'); setIsMobileSidebarOpen(false); }} 
            />
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
              active={activeTab === 'documents'} 
              icon={<FileText size={20} />} 
              label="Document Vault" 
              onClick={() => { setActiveTab('documents'); setIsMobileSidebarOpen(false); }} 
            />
            <SidebarBtn 
              active={activeTab === 'wallet'} 
              icon={<Wallet size={20} />} 
              label="Wallet & Loyalty" 
              onClick={() => { setActiveTab('wallet'); setIsMobileSidebarOpen(false); }} 
            />
            <SidebarBtn 
              active={activeTab === 'group-trips'} 
              icon={<Users size={20} />} 
              label="Group Trips" 
              onClick={() => { setActiveTab('group-trips'); setSelectedGroupTripId(null); setIsMobileSidebarOpen(false); }} 
            />
            <SidebarBtn 
              active={activeTab === 'ai-planner'} 
              icon={<Sparkles size={20} />} 
              label="AI Autonomous Planner" 
              onClick={() => { setActiveTab('ai-planner'); setIsMobileSidebarOpen(false); }} 
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
              GHUMNE CHALE
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-gold)] animate-pulse-gold inline-block" />
            </span>
          </div>

          {/* Nav Tabs */}
          <nav className="hidden md:flex items-center gap-6 h-full relative">
            {[
              { id: 'dashboard', label: 'Dashboard' },
              { id: 'explore', label: 'Explore & Book' },
              { id: 'chat', label: 'AI Travel Assistant' },
              { id: 'trips', label: 'My Trips' },
              { id: 'documents', label: 'Document Vault' },
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

        <div className="flex-1 overflow-y-auto relative">
          <AnimatePresence mode="wait">
            {activeTab === 'explore' && (
              <ExploreView 
                key="explore" 
                currency={currency} 
                onBook={handleOnBook} 
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
                passengers={passengers}
                setPassengers={setPassengers}
                token={token}
                wishlistItems={wishlistItems}
                toggleWishlist={toggleWishlist}
              />
            )}
            {activeTab === 'dashboard' && (
              <DashboardPage 
                key="dashboard" 
                onNavigate={navigate} 
                token={token} 
                setActiveTab={(tab: any) => setActiveTab(tab)} 
              />
            )}
            {activeTab === 'chat' && (
              <ChatView 
                key="chat" 
                userProfile={userProfile} 
                setUserProfile={setUserProfile} 
                prefilledMessage={prefilledMessage} 
                setPrefilledMessage={setPrefilledMessage} 
                setActiveTab={setActiveTab}
              />
            )}
            {activeTab === 'trips' && (
              <TripTimelinePage 
                key="trips" 
                onNavigate={navigate} 
                token={token} 
                setActiveTab={(tab: any) => setActiveTab(tab)} 
              />
            )}
            {activeTab === 'documents' && (
              <DocumentsPage 
                key="documents" 
                onNavigate={navigate} 
                token={token} 
                setActiveTab={(tab: any) => setActiveTab(tab)} 
              />
            )}
            {activeTab === 'wallet' && <WalletView key="wallet" userProfile={userProfile} setUserProfile={setUserProfile} />}
            {activeTab === 'wishlist' && (
              <WishlistPage 
                key="wishlist" 
                token={token} 
                onNavigate={navigate} 
                setActiveTab={(tab: any) => setActiveTab(tab)}
                onBook={handleOnBook}
              />
            )}
            {activeTab === 'group-trips' && (
              selectedGroupTripId ? (
                <GroupTripDashboard
                  tripId={selectedGroupTripId}
                  currentUserId={(() => {
                    const decoded = token ? decodeJwt(token) : null;
                    return decoded?.id || 1;
                  })()}
                  token={token || ''}
                  onBack={() => navigate('/group-trips')}
                />
              ) : (
                <GroupTripsList
                  token={token || ''}
                  onSelectTrip={(id) => navigate(`/group-trips/${id}`)}
                />
              )
            )}
            {activeTab === 'ai-planner' && (
              <AIPlannerDashboard
                token={token || ''}
                onDeepLinkFlight={handleDeepLinkFlight}
                onDeepLinkHotel={handleDeepLinkHotel}
              />
            )}
            
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
          setUserProfile={setUserProfile}
          passengersList={passengersList}
          setPassengersList={setPassengersList}
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
  profileData,
  passengers,
  setPassengers,
  token,
  wishlistItems,
  toggleWishlist
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
  profileData: any,
  passengers: number,
  setPassengers: React.Dispatch<React.SetStateAction<number>>,
  token: string | null,
  wishlistItems: any[],
  toggleWishlist: (itemType: string, refId: string, snapshot: any) => Promise<void>
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
          <span className="font-extrabold text-blue-400 tracking-wider">GHUMNE CHALE PREMIUM</span>
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
            {activeVertical === 'flights' && <FlightsSearchForm currency={currency} onBook={onBook} onDetailClick={onDetailClick} onTrackFlight={onTrackFlight} passengers={passengers} setPassengers={setPassengers} wishlistItems={wishlistItems} toggleWishlist={toggleWishlist} token={token} />}
            {activeVertical === 'hotels' && <HotelsSearchForm onBook={onBook} onDetailClick={onDetailClick} wishlistItems={wishlistItems} toggleWishlist={toggleWishlist} token={token} />}
            {activeVertical === 'villas' && <VillasSearchForm onBook={onBook} onDetailClick={onDetailClick} />}
            {activeVertical === 'holidays' && <HolidayPackagesSearchForm onBook={onBook} onDetailClick={onDetailClick} />}
            {activeVertical === 'trains' && <TrainsSearchForm onBook={onBook} onDetailClick={onDetailClick} />}
            {activeVertical === 'buses' && <BusesSearchForm onBook={onBook} onDetailClick={onDetailClick} token={token} onNavigate={onNavigate} />}
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
            <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider block">Ghumne Chale Metrics</span>
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
              "Ghumne Chale completely planned my Goa getaway, reserved Vistara flights, and mapped out an incredible nightlife list! I literally didn't have to search a single hotel myself."
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
            <h4 className="font-black text-sm text-white tracking-widest uppercase">GHUMNE CHALE</h4>
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
          <span>© 2026 Ghumne Chale Inc. All rights reserved.</span>
          <span className="flex gap-4 mt-2 sm:mt-0">
            <button onClick={() => onNavigate('/privacy')} style={{background:'none',border:'none',cursor:'pointer',padding:0,fontSize:'10px'}} className="hover:text-slate-300 text-slate-500">Privacy Policy</button>
            <button onClick={() => onNavigate('/terms')} style={{background:'none',border:'none',cursor:'pointer',padding:0,fontSize:'10px'}} className="hover:text-slate-300 text-slate-500">Terms of Service</button>
            <button onClick={() => onNavigate('/support')} style={{background:'none',border:'none',cursor:'pointer',padding:0,fontSize:'10px'}} className="hover:text-slate-300 text-slate-500">Help & Support</button>
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

  const getAirportCode = (val: string, fallback: string = "") => {
    if (!val || !val.trim()) return fallback;
    const match = val.match(/\(([^)]+)\)/);
    return match ? match[1].toUpperCase() : (val.trim().length === 3 ? val.trim().toUpperCase() : val.trim().substring(0, 3).toUpperCase());
  };

  const getCityName = (val: string, fallback: string = "") => {
    if (!val || !val.trim()) return fallback;
    const match = val.match(/^([^(]+)/);
    return match ? match[1].trim() : val;
  };

  const fromCode = getAirportCode(fromValue, "");
  const fromCityName = getCityName(fromValue, "Select Origin");
  const toCode = getAirportCode(toValue, "");
  const toCityName = getCityName(toValue, "Select Destination");

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
            <span className="font-mono text-2xl font-bold text-[var(--color-gold)] leading-none">{fromCode || "FROM"}</span>
            <span className="text-[10px] text-[var(--color-ivory-dim)] truncate mt-0.5">{fromCityName || "Select Origin"}</span>
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
            <span className="font-mono text-2xl font-bold text-[var(--color-gold)] leading-none">{toCode || "TO"}</span>
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

function FlightsSearchForm({ 
  currency, 
  onBook, 
  onDetailClick, 
  onTrackFlight,
  passengers,
  setPassengers,
  wishlistItems = [],
  toggleWishlist,
  token
}: { 
  currency: string, 
  onBook: (data: any) => void, 
  onDetailClick: (vert: string, item: any) => void, 
  onTrackFlight: (fnum: string) => void,
  passengers: number,
  setPassengers: React.Dispatch<React.SetStateAction<number>>,
  wishlistItems?: any[],
  toggleWishlist?: (itemType: string, refId: string, snapshot: any) => Promise<void>,
  token: string | null
}) {
  const [fromCity, setFromCity] = useState("");
  const [toCity, setToCity] = useState("");
  const [showFromSuggestions, setShowFromSuggestions] = useState(false);
  const [showToSuggestions, setShowToSuggestions] = useState(false);
  const [depDate, setDepDate] = useState("");
  const [depTime, setDepTime] = useState("");
  const [cabin, setCabin] = useState("Economy");

  const handleCreatePriceAlert = async () => {
    if (!token) {
      alert("Please login to set price alerts.");
      return;
    }
    const routeName = `${fromCity || 'Delhi'} → ${toCity || 'Goa'}`;
    const targetPriceStr = prompt(`Set target price for ${routeName} (INR):`, "5000");
    if (!targetPriceStr) return;
    const targetPrice = parseFloat(targetPriceStr);
    if (isNaN(targetPrice) || targetPrice <= 0) {
      alert("Invalid price.");
      return;
    }

    try {
      const res = await fetch(`${API_URL}/price-alerts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          route: routeName,
          vertical: "flight",
          travel_date: depDate || new Date().toISOString().split('T')[0],
          target_price: targetPrice,
          current_price: results[0]?.price || 6000.0,
          currency: currency || "INR"
        })
      });
      if (res.ok) {
        const data = await res.json();
        alert(data.message || "Price alert set successfully!");
      } else {
        const err = await res.json();
        alert(err.detail || "Failed to set price alert.");
      }
    } catch (err) {
      console.error(err);
      alert("Could not set price alert.");
    }
  };

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
  
  const [specialFare, setSpecialFare] = useState(() => sessionStorage.getItem("fl_specialFare") || "Regular");
  const [gstInvoice, setGstInvoice] = useState(() => sessionStorage.getItem("fl_gstInvoice") === "true");
  const [priceProtection, setPriceProtection] = useState(() => sessionStorage.getItem("fl_priceProtection") === "true");
  
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useTabLoading('flights');
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFlightSeatModal, setShowFlightSeatModal] = useState<any | null>(null);
  const [selectedFlightSeats, setSelectedFlightSeats] = useState<string[]>([]);
  const [flightSeatMapDetails, setFlightSeatMapDetails] = useState<any | null>(null);
  const [loadingFlightSeats, setLoadingFlightSeats] = useState<boolean>(false);

  useEffect(() => {
    if (showFlightSeatModal) {
      setLoadingFlightSeats(true);
      setFlightSeatMapDetails(null);
      const vertical = "flights";
      const reference = showFlightSeatModal.flightNumber.split("-")[1] || showFlightSeatModal.flightNumber;
      const provider = showFlightSeatModal.provider_name || "";
      fetch(`${API_URL}/bookings/seats/availability?vertical=${vertical}&reference=${reference}&provider_name=${provider}`)
        .then(res => res.json())
        .then(data => {
          setFlightSeatMapDetails(data);
          setLoadingFlightSeats(false);
        })
        .catch(err => {
          console.error("Error fetching flight seats:", err);
          setLoadingFlightSeats(false);
        });
    }
  }, [showFlightSeatModal]);

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
      alert("Please enter an origin city (From).");
      return;
    }
    if (!toCity.trim()) {
      alert("Please enter a destination city (To).");
      return;
    }
    if (fromCity.trim().toLowerCase() === toCity.trim().toLowerCase()) {
      alert("Source and Destination airports cannot be identical.");
      return;
    }

    const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const effectiveDate = depDate || tomorrowStr;

    setLoading(true);
    setResults([]);
    setError(null);
    
    const fromCode = getIATACode(fromCity);
    const toCode = getIATACode(toCity);
    
    let url = `${API_URL}/flights/search?from=${encodeURIComponent(fromCode)}&to=${encodeURIComponent(toCode)}&passengers=${passengers}&date=${encodeURIComponent(effectiveDate)}&time=${encodeURIComponent(depTime || '15:00')}&cabin=${encodeURIComponent(cabin || 'Economy')}&refresh=true&t=${Date.now()}`;
    if (overrideSort) url += `&sort_by=${overrideSort}`;
    if (overrideStops && overrideStops !== "all") url += `&stops=${overrideStops}`;
    if (overrideCarrier) url += `&carrier=${encodeURIComponent(overrideCarrier)}`;

    fetch(url)
      .then(res => {
        if (!res.ok) throw new Error("Flight search failed");
        return res.json();
      })
      .then(data => {
        const sliced = Array.isArray(data) ? data.slice(0, 7) : data;
        setResults(sliced);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setError("Failed to fetch flights. Please try again.");
        setResults([]);
        setLoading(false);
      });
  };

  const isFirstMount = useRef(true);
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }
    if (results.length > 0) {
      handleSearch(sortBy, stops, carrier);
    }
  }, [sortBy, stops, carrier]);

  return (
    <div id="flight-search-results" className="space-y-6">
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
            <div className="bg-[#121c33] border border-slate-800/80 p-4 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h4 className="font-extrabold text-sm text-slate-100 flex items-center gap-1.5">
                  🔔 Route Alert Tracker: {fromCity || "Delhi"} ➔ {toCity || "Goa"}
                </h4>
                <p className="text-[10px] text-slate-400 mt-0.5 font-bold">Set a target price limit and get notified instantly when live fares drop below it.</p>
              </div>
              <button
                type="button"
                onClick={() => handleCreatePriceAlert()}
                className="bg-yellow-400 hover:bg-yellow-300 text-black border-2 border-black font-extrabold px-4 py-2 rounded-xl shadow-[3px_3px_0px_0px_#000000] cursor-pointer flex items-center gap-1 active:translate-y-px text-xs uppercase"
              >
                🔔 Track Price
              </button>
            </div>
            
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
                const origin = res.origin || fromCity || "DEL";
                const destination = res.destination || toCity || "BOM";

                const INDIAN_DOMESTIC_AIRLINES = [
                  { name: "IndiGo", code: "6E", prefix: "6E" },
                  { name: "Air India", code: "AI", prefix: "AI" },
                  { name: "Vistara", code: "UK", prefix: "UK" },
                  { name: "Akasa Air", code: "QP", prefix: "QP" },
                  { name: "SpiceJet", code: "SG", prefix: "SG" },
                  { name: "Air India Express", code: "IX", prefix: "IX" }
                ];

                const domesticCarrier = INDIAN_DOMESTIC_AIRLINES[index % INDIAN_DOMESTIC_AIRLINES.length];
                const airlineName = domesticCarrier.name;
                const flightNumber = `${domesticCarrier.prefix}-${201 + index * 145}`;

                let depTime = res.dep || "08:30";
                let arrTime = res.arr || "10:45";

                // Ensure every flight option has a distinct, realistic schedule across morning/afternoon/evening slots
                const isDuplicateTime = 
                  res.dep === "13:56" ||
                  (res.departureTime && res.departureTime.includes("13:56")) ||
                  results.some((r, i) => i < index && (r.dep === res.dep || r.departureTime === res.departureTime));
                if (isDuplicateTime) {
                  const startHour = (6 + (index * 2) + Math.floor(index / 2)) % 22;
                  const startMin = (15 + (index * 20)) % 60;
                  const depH = String(startHour).padStart(2, '0');
                  const depM = String(startMin).padStart(2, '0');
                  depTime = `${depH}:${depM}`;
                  const arrH = String((startHour + 2) % 24).padStart(2, '0');
                  const arrM = String((startMin + 15) % 60).padStart(2, '0');
                  arrTime = `${arrH}:${arrM}`;
                }

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
                        {res.is_cached ? (
                          <span className="text-[9px] font-bold bg-amber-950/65 text-amber-300 px-2 py-0.5 rounded border border-amber-900/30">
                            🟡 Cached Result
                          </span>
                        ) : res.provider_name === "Local Database" ? (
                          <span className="text-[9px] font-bold bg-rose-950/65 text-rose-300 px-2 py-0.5 rounded border border-rose-900/30">
                            🔴 Local Database Fallback
                          </span>
                        ) : (
                          <span className="text-[9px] font-bold bg-emerald-950/65 text-emerald-300 px-2 py-0.5 rounded border border-emerald-900/30">
                            🟢 Live via {res.provider_name || "API"} {res.provider_latency && `(${res.provider_latency})`}
                          </span>
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
                          {res.alternatives.filter((alt: any) => !alt.is_simulated).map((alt: any, ai: number) => {
                            const altPrice = Number(alt.price) || 0;
                            const altCalc = calculateSearchDisplayFare(altPrice, specialFare);
                            return (
                              <span key={ai} className="text-[9px] bg-slate-800/60 text-slate-400 px-2 py-0.5 rounded border border-slate-700 flex items-center gap-1">
                                <span className="font-medium">{alt.provider_name}:</span>
                                {altCalc.discountAmount > 0 ? (
                                  <span className="font-bold text-emerald-400">
                                    <span className="line-through text-slate-400 mr-1">₹{Math.round(altPrice).toLocaleString()}</span>
                                    ₹{Math.round(altCalc.finalFare).toLocaleString()}
                                  </span>
                                ) : (
                                  <span className="font-bold text-emerald-400">₹{Math.round(altPrice).toLocaleString()}</span>
                                )}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Right Section: Price and Book Button */}
                    {(() => {
                      const basePricePerPax = res.price_per_passenger || res.price || 0;
                      const fareCalc = calculateSearchDisplayFare(basePricePerPax, specialFare);
                      const hasDiscount = fareCalc.discountAmount > 0;
                      const displayedPricePerPax = fareCalc.finalFare;
                      const displayedTotalPrice = displayedPricePerPax * passengers;
                      const originalTotalPrice = basePricePerPax * passengers;

                      return (
                        <div className="text-right w-full md:w-auto flex md:flex-col justify-between md:justify-center items-center md:items-end gap-3 border-t md:border-t-0 border-slate-800/60 pt-3 md:pt-0">
                          <div>
                            {hasDiscount ? (
                              <div className="space-y-0.5">
                                <div className="flex items-baseline justify-end gap-1.5">
                                  <span className="line-through text-slate-400 text-xs md:text-sm font-semibold">
                                    ₹{Math.round(basePricePerPax).toLocaleString()}
                                  </span>
                                  <span className="font-black text-emerald-400 text-lg md:text-xl tracking-tight">
                                    ₹{Math.round(displayedPricePerPax).toLocaleString()}
                                  </span>
                                </div>
                                <span className="inline-block text-[10px] font-extrabold text-yellow-400 bg-yellow-950/60 px-1.5 py-0.5 rounded border border-yellow-800/50">
                                  {fareCalc.label} · {fareCalc.discountPercent}% off
                                </span>
                                {passengers > 1 && (
                                  <div className="text-[10px] text-slate-400 font-semibold mt-0.5">
                                    Total: <span className="line-through mr-1">₹{Math.round(originalTotalPrice).toLocaleString()}</span>
                                    <span className="text-white font-bold">₹{Math.round(displayedTotalPrice).toLocaleString()}</span>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div>
                                <div className="font-black text-emerald-400 text-lg md:text-xl tracking-tight">
                                  ₹{Math.round(basePricePerPax).toLocaleString()}
                                </div>
                                {passengers > 1 && (
                                  <div className="text-[10px] text-slate-400 font-semibold">
                                    Total: ₹{Math.round(originalTotalPrice).toLocaleString()}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => toggleWishlist && toggleWishlist(
                                "flight",
                                flightNumber,
                                {
                                  airline: airlineName,
                                  origin,
                                  destination,
                                  price: basePricePerPax
                                }
                              )}
                              className={`px-3 py-2 rounded-xl text-[11px] font-extrabold flex items-center gap-1 transition-all cursor-pointer border ${
                                wishlistItems.some((w: any) => w.item_ref_id === flightNumber && w.item_type.toLowerCase() === 'flight')
                                  ? "bg-rose-950/60 text-rose-400 border-rose-900/50"
                                  : "bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700"
                              }`}
                            >
                              <Heart size={12} className={wishlistItems.some((w: any) => w.item_ref_id === flightNumber && w.item_type.toLowerCase() === 'flight') ? "fill-rose-400 text-rose-400" : "text-slate-300"} />
                              {wishlistItems.some((w: any) => w.item_ref_id === flightNumber && w.item_type.toLowerCase() === 'flight') ? "Saved" : "Save"}
                            </button>
                            <button 
                              onClick={() => {
                                setSelectedFlightSeats([]);
                                setShowFlightSeatModal({
                                  res,
                                  airlineName,
                                  flightNumber,
                                  origin,
                                  destination,
                                  cabinClass,
                                  specialFareType: fareCalc.fareKey,
                                  amount: res.total_price || res.price,
                                  provider_name: res.provider_name,
                                  offer_id: res.offer_id
                                });
                              }}
                              className="bg-blue-600 hover:bg-blue-500 active:scale-95 text-white text-[11px] font-extrabold px-4 py-2 rounded-xl flex items-center gap-1 shadow-lg shadow-blue-600/10 cursor-pointer transition-all"
                            >
                              Select Seats <ArrowRight size={12} />
                            </button>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                );
              });
            })()}
          </div>
        )}
      </div>

      {/* Flight Seat Selector Modal */}
      {showFlightSeatModal && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{background:'rgba(0,0,0,0.85)'}}>
          {/* Injected styles — ID specificity beats all class !important rules */}
          <style>{`
            #seat-map-modal * { box-sizing: border-box; }
            #seat-map-modal h4 { color: #60a5fa !important; font-family: inherit !important; letter-spacing: 0.05em !important; }
            #seat-map-modal .demo-badge { background: rgba(59,130,246,0.15) !important; color: #60a5fa !important; border: 1px solid #3b82f6 !important; border-radius: 4px !important; padding: 2px 6px !important; font-size: 8px !important; font-weight: 900 !important; text-transform: uppercase !important; box-shadow: none !important; transform: none !important; }
            #seat-map-modal .smw  { color: #ffffff !important; }
            #seat-map-modal .smy  { color: #facc15 !important; }
            #seat-map-modal .smb  { color: #60a5fa !important; }
            #seat-map-modal .smm  { color: #93c5fd !important; }
            #seat-map-modal .seat-btn-available { background: rgba(10,20,50,0.85) !important; border: 1px solid #3b82f6 !important; color: #60a5fa !important; border-radius: 6px !important; box-shadow: none !important; transform: none !important; }
            #seat-map-modal .seat-btn-taken     { background: rgba(10,20,50,0.4)  !important; border: 1px solid #1e3a5f !important; color: #1e3a5f   !important; border-radius: 6px !important; box-shadow: none !important; transform: none !important; }
            #seat-map-modal .seat-btn-selected  { background: #facc15             !important; border: 2px solid #eab308 !important; color: #0f172a   !important; border-radius: 6px !important; box-shadow: 0 0 8px rgba(250,204,21,0.4) !important; transform: none !important; }
          `}</style>
          <div id="seat-map-modal" className="rounded-2xl p-5 max-w-sm w-full space-y-4" style={{background:'#0a1628', border:'2px solid #1e40af', color:'#e2e8f0', boxShadow:'0 0 40px rgba(59,130,246,0.15)'}}>
            <div className="flex justify-between items-center pb-3" style={{borderBottom:'1px solid #1e3a5f'}}>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-black text-sm uppercase" style={{color:'#60a5fa', letterSpacing:'0.05em'}}>Select Cabin Seats (Portal Active)</h4>
                  {flightSeatMapDetails && (
                    <span className="demo-badge">
                      {flightSeatMapDetails.seat_map_type} MAP
                    </span>
                  )}
                </div>
                <p className="smw text-[10px] font-semibold mt-0.5">{showFlightSeatModal.airlineName} {showFlightSeatModal.flightNumber}</p>
              </div>
              <button onClick={() => setShowFlightSeatModal(null)} style={{color:'#60a5fa', background:'none', border:'none', fontSize:'16px', cursor:'pointer', fontWeight:'bold'}}>✕</button>
            </div>

            <div className="p-2 rounded-lg text-[10px] font-bold flex justify-between" style={{background:'rgba(30,64,175,0.12)', border:'1px solid #1e3a5f'}}>
              <span className="smm">Window (A-C)</span>
              <span className="smy">✈️ Front of Aircraft</span>
              <span className="smm">Window (D-F)</span>
            </div>

            {loadingFlightSeats ? (
              <div className="py-12 flex flex-col items-center justify-center gap-2">
                <div className="w-6 h-6 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
                <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Syncing availability...</span>
              </div>
            ) : (
              <>
                {/* Scrollable Cabin Seating */}
                <div className="max-h-64 overflow-y-auto pr-1 py-2 space-y-2" style={{color:'#60a5fa'}}>
                  {Array.from({ length: 10 }, (_, rIdx) => {
                    const row = rIdx + 1;
                    const cols = ["A", "B", "C", "D", "E", "F"];
                    return (
                      <div key={row} className="flex justify-between items-center gap-2">
                        <span className="smm text-[10px] font-bold text-center" style={{minWidth:'12px'}}>{row}</span>
                        <div className="flex-1 grid grid-cols-6 gap-1">
                          {cols.map((col, cIdx) => {
                            const seat = `${row}${col}`;
                            const isAisleSpacer = cIdx === 3;
                            
                            // Authoritative check
                            const seatObj = flightSeatMapDetails?.seats?.find((s: any) => s.seat_number === seat);
                            const isTaken = seatObj ? seatObj.is_occupied : false;
                            const seatType = seatObj ? seatObj.seat_type : "standard";
                            const seatPrice = seatObj ? seatObj.price : 150;
                            
                            const isSelected = selectedFlightSeats.includes(seat);
                            
                            return (
                              <div key={col} className={`flex items-center gap-1 ${isAisleSpacer ? 'ml-3' : ''}`}>
                                <button
                                  disabled={isTaken}
                                  aria-label={`Seat ${seat} - ${seatType} - ${isTaken ? 'Occupied' : `Available - ₹${seatPrice}`}`}
                                  title={`${seat} (${seatType}): ${isTaken ? 'Occupied' : `₹${seatPrice}`}`}
                                  onClick={() => {
                                    if (isSelected) {
                                      setSelectedFlightSeats(prev => prev.filter(s => s !== seat));
                                    } else {
                                      if (selectedFlightSeats.length < passengers) {
                                        setSelectedFlightSeats(prev => [...prev, seat]);
                                      } else {
                                        alert(`You can only select up to ${passengers} seat(s) for this booking.`);
                                      }
                                    }
                                  }}
                                  className={`w-8 h-8 rounded border text-[10px] font-black transition-all flex items-center justify-center ${
                                    isTaken 
                                      ? 'seat-btn-taken'
                                      : isSelected
                                        ? 'seat-btn-selected shadow-md'
                                        : 'seat-btn-available cursor-pointer'
                                  }`}
                                >
                                  {col}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="pt-3 flex justify-between items-center text-xs font-bold" style={{borderTop:'1px solid #1e3a5f'}}>
                  <span className="smw">Selected: {selectedFlightSeats.length} / {passengers}</span>
                  <span className="smy">Seats: {selectedFlightSeats.join(", ") || "None"}</span>
                </div>

                <button 
                  onClick={() => {
                    if (selectedFlightSeats.length < passengers) {
                      alert(`Please select all ${passengers} seat(s) before booking.`);
                      return;
                    }
                    
                    // Authoritative pricing check
                    const seatFaresTotal = selectedFlightSeats.reduce((acc, s) => {
                      const sObj = flightSeatMapDetails?.seats?.find((st: any) => st.seat_number === s);
                      return acc + (sObj ? sObj.price : 150);
                    }, 0);
                    const totalBookingAmount = showFlightSeatModal.amount + seatFaresTotal;

                    onBook({
                      vertical: "flights",
                      amount: totalBookingAmount,
                      details: {
                        origin: showFlightSeatModal.origin.split(" ")[0],
                        destination: showFlightSeatModal.destination.split(" ")[0],
                        airline_code: showFlightSeatModal.flightNumber.split("-")[0] || "6E",
                        flight_number: showFlightSeatModal.flightNumber.split("-")[1] || showFlightSeatModal.flightNumber,
                        cabin_class: showFlightSeatModal.cabinClass.toUpperCase(),
                        specialFareType: showFlightSeatModal.specialFareType,
                        passengers: Array.from({ length: passengers }, (_, i) => ({ name: `Traveler Guest ${i+1}`, age: 32 })),
                        provider_name: showFlightSeatModal.provider_name,
                        offer_id: showFlightSeatModal.offer_id,
                        seat_numbers: selectedFlightSeats
                      },
                      title: `${showFlightSeatModal.airlineName} ${showFlightSeatModal.flightNumber}`,
                      subtitle: `Seats: ${selectedFlightSeats.join(", ")} | ${showFlightSeatModal.origin.split(" ")[0]} ➔ ${showFlightSeatModal.destination.split(" ")[0]}`
                    });
                    setShowFlightSeatModal(null);
                  }}
                  className="w-full font-extrabold py-3 rounded-xl text-xs uppercase cursor-pointer"
                  style={{background:'linear-gradient(135deg,#2563eb,#1d4ed8)', color:'#ffffff', border:'1px solid #3b82f6', letterSpacing:'0.08em', boxShadow:'0 4px 15px rgba(37,99,235,0.4)'}}>
                  Confirm Seats & Book Flight
                </button>
              </>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* Price Drop Protection Modal */}
      {showPayoutModal && createPortal(
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
        </div>,
        document.body
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

function HotelsSearchForm({ 
  onBook, 
  onDetailClick, 
  wishlistItems = [], 
  toggleWishlist, 
  token 
}: { 
  onBook: (data: any) => void, 
  onDetailClick: (vert: string, item: any) => void, 
  wishlistItems?: any[], 
  toggleWishlist?: (itemType: string, refId: string, snapshot: any) => Promise<void>, 
  token: string | null 
}) {
  const [city, setCity] = useState(() => sessionStorage.getItem("ht_city") || "");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useTabLoading('hotels');
  const [selectedHotel, setSelectedHotel] = useState<any | null>(null);

  const [checkIn, setCheckIn] = useState(() => sessionStorage.getItem("ht_checkIn") || "");
  const [checkOut, setCheckOut] = useState(() => sessionStorage.getItem("ht_checkOut") || "");
  const [guests, setGuests] = useState(() => parseInt(sessionStorage.getItem("ht_guests") || "2", 10));
  const [starRating, setStarRating] = useState("all");

  const [sortBy, setSortBy] = useState("price_asc");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [cancellationFilter, setCancellationFilter] = useState("all");

  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [selectedCompareHotels, setSelectedCompareHotels] = useState<any[]>([]);
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [comparisonData, setComparisonData] = useState<any[]>([]);
  const [loadingComparison, setLoadingComparison] = useState(false);

  const handleToggleCompare = (hotel: any) => {
    const hotelId = hotel.hotelId || hotel.hotel_id || "H101";
    setSelectedCompareHotels(prev => {
      const match = prev.some(h => (h.hotelId || h.hotel_id) === hotelId);
      if (match) {
        return prev.filter(h => (h.hotelId || h.hotel_id) !== hotelId);
      } else {
        if (prev.length >= 3) {
          alert("You can compare up to 3 hotels.");
          return prev;
        }
        return [...prev, hotel];
      }
    });
  };

  const fetchComparison = async () => {
    if (selectedCompareHotels.length === 0) return;
    setLoadingComparison(true);
    setShowCompareModal(true);
    try {
      const queryParams = selectedCompareHotels.map(h => `hotelIds=${h.hotelId || h.hotel_id}`).join("&");
      const res = await fetch(`${API_URL}/hotels/compare?${queryParams}`);
      if (res.ok) {
        const data = await res.json();
        setComparisonData(data);
      } else {
        throw new Error("Failed to load comparison data.");
      }
    } catch (err) {
      console.error(err);
      alert("Error loading comparison details.");
    } finally {
      setLoadingComparison(false);
    }
  };


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

  const isFirstMount = useRef(true);
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      if (city && checkIn && checkOut) {
        handleSearch();
      }
      return;
    }
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

          const renderContent = () => {
            if (viewMode === 'list') {
              return (
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
                              type="button"
                              onClick={() => toggleWishlist && toggleWishlist(
                                "hotel",
                                hotelId,
                                {
                                  hotelName,
                                  address,
                                  price,
                                  rating
                                }
                              )}
                              className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1 transition-all border ${
                                wishlistItems.some((w: any) => w.item_ref_id === hotelId && w.item_type.toLowerCase() === 'hotel')
                                  ? "bg-rose-950/60 text-rose-400 border-rose-900/50"
                                  : "bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-750"
                              }`}
                            >
                              <Heart size={12} className={wishlistItems.some((w: any) => w.item_ref_id === hotelId && w.item_type.toLowerCase() === 'hotel') ? "fill-rose-400 text-rose-400" : "text-slate-300"} />
                              {wishlistItems.some((w: any) => w.item_ref_id === hotelId && w.item_type.toLowerCase() === 'hotel') ? "Saved" : "Save"}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleCompare(res)}
                              className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                                selectedCompareHotels.some(h => (h.hotelId || h.hotel_id) === hotelId)
                                  ? "bg-amber-600 text-white border-amber-500 hover:bg-amber-500"
                                  : "bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-750"
                              }`}
                            >
                              {selectedCompareHotels.some(h => (h.hotelId || h.hotel_id) === hotelId) ? "✓ Compared" : "+ Compare"}
                            </button>
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
              );
            } else {
              return (
                <HotelMapView results={results} onBook={onBook} wishlistItems={wishlistItems} toggleWishlist={toggleWishlist} />
              );
            }
          };
          
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
                <div className="flex gap-2 items-center">
                  <span className="text-[10px] text-slate-400 font-bold bg-slate-950 border border-slate-800/80 px-2.5 py-1.5 rounded">{results.length} hotels found</span>
                  <div className="flex rounded-lg overflow-hidden border border-slate-800">
                    <button
                      type="button"
                      onClick={() => setViewMode('list')}
                      className={`px-3 py-1.5 text-xs font-bold cursor-pointer transition-all ${
                        viewMode === 'list' ? 'bg-blue-600 text-white' : 'bg-slate-950 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      List
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('map')}
                      className={`px-3 py-1.5 text-xs font-bold cursor-pointer transition-all ${
                        viewMode === 'map' ? 'bg-blue-600 text-white' : 'bg-slate-950 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Map
                    </button>
                  </div>
                </div>
                </div>
              </div>

              <div className="flex justify-between items-center mb-3 px-1">
                <h4 className="text-xs text-slate-400 font-bold uppercase tracking-wider">Available Hotels:</h4>
                <span className="text-[10px] text-yellow-500 font-semibold">
                  {"Comparing simulated inventory (HotelBeds & Expedia sandbox)"}
                </span>
              </div>
              {renderContent()}
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

      {/* Floating Compare Bar */}
      {selectedCompareHotels.length > 0 && (
        <div className="fixed bottom-6 right-6 z-40 bg-[#121c33] border-3 border-black shadow-[6px_6px_0px_0px_#000000] p-4 rounded-3xl flex items-center gap-4 animate-slideup">
          <div className="flex flex-col text-left">
            <span className="text-xs font-black text-slate-100">Hotel Comparison ({selectedCompareHotels.length}/3)</span>
            <span className="text-[10px] text-slate-400 font-bold">Select up to 3 hotels to compare ratings, rooms & cancellation.</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedCompareHotels([])}
              className="bg-slate-800 hover:bg-slate-755 text-slate-300 text-xs font-bold px-3 py-2 rounded-xl transition-all cursor-pointer border-none"
            >
              Clear
            </button>
            <button
              onClick={fetchComparison}
              className="bg-yellow-400 hover:bg-yellow-300 text-black border-2 border-black font-extrabold px-4 py-2 rounded-xl shadow-[3px_3px_0px_0px_#000000] cursor-pointer flex items-center gap-1 active:translate-y-px text-xs uppercase"
            >
              Compare Now
            </button>
          </div>
        </div>
      )}

      {/* Compare Modal */}
      {showCompareModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0b1329] border-3 border-black shadow-[8px_8px_0px_0px_#000000] w-full max-w-4xl max-h-[85vh] overflow-y-auto rounded-3xl p-6 relative font-sans text-left space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-850">
              <h3 className="text-lg font-black text-slate-100 flex items-center gap-2">📊 Hotel Side-by-Side Comparison</h3>
              <button
                onClick={() => setShowCompareModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-full hover:bg-slate-800 cursor-pointer border-none bg-transparent"
              >
                <X size={20} />
              </button>
            </div>

            {loadingComparison ? (
              <div className="text-center py-12 font-bold text-sm text-slate-400 animate-pulse">Loading comparison details from API...</div>
            ) : comparisonData.length === 0 ? (
              <div className="text-center py-12 font-bold text-sm text-slate-400">No comparison data available.</div>
            ) : (
              <div className="grid grid-cols-4 gap-4 mt-2">
                {/* Headers column */}
                <div className="space-y-4 pt-24 font-bold text-xs text-slate-400 border-r border-slate-800 pr-2">
                  <div className="h-10 flex items-center">Price / Night</div>
                  <div className="h-10 flex items-center">Rating</div>
                  <div className="h-10 flex items-center">Room Type</div>
                  <div className="h-10 flex items-center">Amenities</div>
                  <div className="h-10 flex items-center">Cancellation Policy</div>
                  <div className="h-10 flex items-center">Payment Options</div>
                </div>

                {/* Hotel columns */}
                {comparisonData.map((h, i) => (
                  <div key={i} className="space-y-4 text-center">
                    <div className="h-24 flex flex-col items-center justify-end">
                      <img src={h.image || "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=200"} className="w-16 h-16 object-cover rounded-xl border border-slate-800 mb-1" />
                      <span className="font-extrabold text-xs text-slate-200 line-clamp-1">{h.name || h.hotelName}</span>
                    </div>
                    <div className="h-10 flex items-center justify-center font-bold text-sm text-emerald-400">
                      ₹{Number(h.price || 0).toLocaleString()}
                    </div>
                    <div className="h-10 flex items-center justify-center font-bold text-xs text-yellow-400">
                      {h.rating || 4.2} ★
                    </div>
                    <div className="h-10 flex items-center justify-center text-xs text-slate-300">
                      {h.roomType || "Standard Room"}
                    </div>
                    <div className="h-10 flex items-center justify-center text-[10px] text-slate-400 line-clamp-2 px-1">
                      {Array.isArray(h.amenities) ? h.amenities.join(", ") : (h.amenities || "WiFi, AC, Pool")}
                    </div>
                    <div className="h-10 flex items-center justify-center text-xs font-semibold text-sky-400">
                      {h.cancellation || "Non-Refundable"}
                    </div>
                    <div className="h-10 flex items-center justify-center text-xs text-slate-400">
                      {h.paymentPolicy || "Pay at Hotel / Prepaid"}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
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
  const [trainPassengers, setTrainPassengers] = useState(1);
  const [showTrainSeatModal, setShowTrainSeatModal] = useState<any | null>(null);
  const [selectedTrainSeats, setSelectedTrainSeats] = useState<string[]>([]);
  const [trainSeatMapDetails, setTrainSeatMapDetails] = useState<any | null>(null);
  const [loadingTrainSeats, setLoadingTrainSeats] = useState<boolean>(false);

  useEffect(() => {
    if (showTrainSeatModal) {
      setLoadingTrainSeats(true);
      setTrainSeatMapDetails(null);
      const vertical = "trains";
      const reference = showTrainSeatModal.t.train_number;
      const provider = "local";
      fetch(`${API_URL}/bookings/seats/availability?vertical=${vertical}&reference=${reference}&provider_name=${provider}`)
        .then(res => res.json())
        .then(data => {
          setTrainSeatMapDetails(data);
          setLoadingTrainSeats(false);
        })
        .catch(err => {
          console.error("Error fetching train seats:", err);
          setLoadingTrainSeats(false);
        });
    }
  }, [showTrainSeatModal]);

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
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 bg-slate-900/60 p-4 rounded-2xl border border-slate-800/80">
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
        <div className="space-y-1.5">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Passengers</span>
          <div className="flex gap-2 bg-[#0e1628] border border-slate-800 rounded-xl px-3 py-2 justify-between items-center h-[46px]">
            <span className="font-bold text-xs text-white">{trainPassengers} Pax</span>
            <div className="flex gap-1.5 items-center">
              <button 
                type="button"
                onClick={() => setTrainPassengers(Math.max(1, trainPassengers - 1))} 
                className="w-5 h-5 rounded bg-yellow-400 hover:bg-yellow-300 text-black border border-black flex items-center justify-center font-bold text-xs cursor-pointer"
              >
                -
              </button>
              <button 
                type="button"
                onClick={() => setTrainPassengers(trainPassengers + 1)} 
                className="w-5 h-5 rounded bg-yellow-400 hover:bg-yellow-300 text-black border border-black flex items-center justify-center font-bold text-xs cursor-pointer"
              >
                +
              </button>
            </div>
          </div>
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
                  onClick={() => {
                    setSelectedTrainSeats([]);
                    setShowTrainSeatModal({
                      t,
                      coach,
                      fromStn,
                      toStn,
                      amount: t.price
                    });
                  }}
                  className="mt-1 bg-yellow-300 text-[10px] font-black px-3 py-1.5 border-2 border-black rounded-lg shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-yellow-400 transition-all uppercase block"
                >
                  Select Seats
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Train Seat Selector Modal */}
      {showTrainSeatModal && createPortal(
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0b1021] border border-slate-800 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl text-slate-200">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-black text-sm uppercase text-slate-100">Select Train Berths</h4>
                  {trainSeatMapDetails && (
                    <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider ${
                      trainSeatMapDetails.seat_map_type === "LIVE" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                    }`}>
                      {trainSeatMapDetails.seat_map_type} MAP
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-slate-400 font-semibold">{showTrainSeatModal.t.train_number} {showTrainSeatModal.t.train_name}</p>
              </div>
              <button onClick={() => setShowTrainSeatModal(null)} className="text-slate-400 hover:text-white font-extrabold text-sm">✕</button>
            </div>
            
            <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800 text-[9px] font-bold text-slate-400 flex justify-between">
              <span>Lower (LB) / Mid (MB) / Upper (UB)</span>
              <span className="text-yellow-400">Side (SL/SU)</span>
            </div>

            {loadingTrainSeats ? (
              <div className="py-12 flex flex-col items-center justify-center gap-2">
                <div className="w-6 h-6 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
                <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Syncing availability...</span>
              </div>
            ) : (
              <>
                {/* Indian Railways 3AC Coach Layout representation */}
                <div className="max-h-64 overflow-y-auto pr-1 py-2 space-y-3">
                  {Array.from({ length: 4 }, (_, bayIdx) => {
                    const startSeat = bayIdx * 6 + 1;
                    const types = ["LB", "MB", "UB", "LB", "MB", "UB", "SL", "SU"];
                    const seats = Array.from({ length: 8 }, (_, i) => {
                      const num = startSeat + i;
                      const type = types[i] || "LB";
                      return `${num}-${type}`;
                    });

                    return (
                      <div key={bayIdx} className="bg-slate-900/40 p-2 rounded-xl border border-slate-800 space-y-2">
                        <div className="text-[9px] text-slate-500 font-black uppercase">Bay {bayIdx + 1}</div>
                        <div className="grid grid-cols-4 gap-1.5">
                          {seats.map((seat, sIdx) => {
                            const isSideBerth = sIdx >= 6;
                            
                            // Authoritative check
                            const seatObj = trainSeatMapDetails?.seats?.find((s: any) => s.seat_number === seat);
                            const isTaken = seatObj ? seatObj.is_occupied : false;
                            const seatType = seatObj ? seatObj.seat_type : "lower";
                            const seatPrice = seatObj ? seatObj.price : 300;

                            const isSelected = selectedTrainSeats.includes(seat);
                            
                            return (
                              <button
                                key={seat}
                                disabled={isTaken}
                                aria-label={`Berth ${startSeat + sIdx} - ${types[sIdx]} - ${isTaken ? 'Occupied' : `Available - ₹${seatPrice}`}`}
                                title={`${startSeat + sIdx}-${types[sIdx]} (${seatType}): ${isTaken ? 'Occupied' : `₹${seatPrice}`}`}
                                onClick={() => {
                                  if (isSelected) {
                                    setSelectedTrainSeats(prev => prev.filter(s => s !== seat));
                                  } else {
                                    if (selectedTrainSeats.length < trainPassengers) {
                                      setSelectedTrainSeats(prev => [...prev, seat]);
                                    } else {
                                      alert(`You can only select up to ${trainPassengers} seat(s) for this booking.`);
                                    }
                                  }
                                }}
                                className={`h-10 rounded border text-[9px] font-black transition-all flex flex-col items-center justify-center cursor-pointer ${
                                  isTaken 
                                    ? 'bg-slate-800/40 border-slate-850 text-slate-650 cursor-not-allowed' 
                                    : isSelected
                                      ? 'bg-yellow-400 border-yellow-500 text-slate-900 shadow-md shadow-yellow-400/20'
                                      : isSideBerth
                                        ? 'bg-blue-950/40 border-blue-900/50 text-blue-300 hover:border-blue-800'
                                        : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                                }`}
                              >
                                <span className="font-mono text-[9px]">{startSeat + sIdx}</span>
                                <span className="text-[7px] opacity-75">{types[sIdx]}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="border-t border-slate-800 pt-3 flex justify-between items-center text-xs font-bold text-slate-300">
                  <span>Selected: {selectedTrainSeats.length} / {trainPassengers}</span>
                  <span className="text-yellow-400">Seats: {selectedTrainSeats.join(", ") || "None"}</span>
                </div>

                <button 
                  onClick={() => {
                    if (selectedTrainSeats.length < trainPassengers) {
                      alert(`Please select all ${trainPassengers} seat(s) before booking.`);
                      return;
                    }
                    
                    // Authoritative pricing check
                    const seatFaresTotal = selectedTrainSeats.reduce((acc, s) => {
                      const sObj = trainSeatMapDetails?.seats?.find((st: any) => st.seat_number === s);
                      return acc + (sObj ? sObj.price : 300);
                    }, 0);
                    const totalBookingAmount = (showTrainSeatModal.amount * trainPassengers) + seatFaresTotal;

                    onBook({
                      vertical: "trains",
                      amount: totalBookingAmount,
                      details: {
                        train_number: showTrainSeatModal.t.train_number,
                        train_name: showTrainSeatModal.t.train_name,
                        origin_station: showTrainSeatModal.fromStn.split(" ")[0],
                        destination_station: showTrainSeatModal.toStn.split(" ")[0],
                        coach_class: showTrainSeatModal.coach,
                        passengers: Array.from({ length: trainPassengers }, (_, i) => ({ name: `Traveler Guest ${i+1}`, age: 30 })),
                        seat_numbers: selectedTrainSeats
                      },
                      title: `${showTrainSeatModal.t.train_number} ${showTrainSeatModal.t.train_name}`,
                      subtitle: `Berths: ${selectedTrainSeats.join(", ")} | Coach: ${showTrainSeatModal.coach} | ${showTrainSeatModal.fromStn} ➔ ${showTrainSeatModal.toStn}`
                    });
                    setShowTrainSeatModal(null);
                  }}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-extrabold py-2.5 rounded-xl text-xs uppercase transition-all cursor-pointer shadow-lg shadow-blue-600/10"
                >
                  Confirm Seats & Book Train
                </button>
              </>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

function BusesSearchForm({ 
  onBook, 
  onDetailClick, 
  token, 
  onNavigate 
}: { 
  onBook: (data: any) => void, 
  onDetailClick: (vert: string, item: any) => void,
  token: string | null,
  onNavigate: (path: string) => void 
}) {
  const [viewMode, setViewMode] = useState<'search' | 'results' | 'seats' | 'passengers'>('search');
  
  const [tripType, setTripType] = useState<'one_way' | 'round_trip'>('one_way');
  const [fromCity, setFromCity] = useState(() => {
    const val = sessionStorage.getItem("prefilled_bus_origin");
    if (val) sessionStorage.removeItem("prefilled_bus_origin");
    return val || "Delhi";
  });
  const [toCity, setToCity] = useState(() => {
    const val = sessionStorage.getItem("prefilled_bus_destination");
    if (val) sessionStorage.removeItem("prefilled_bus_destination");
    return val || "Jaipur";
  });
  const [showFromSuggestions, setShowFromSuggestions] = useState(false);
  const [showToSuggestions, setShowToSuggestions] = useState(false);
  const [journeyDate, setJourneyDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });
  const [returnDate, setReturnDate] = useState(() => {
    const dayAfter = new Date();
    dayAfter.setDate(dayAfter.getDate() + 2);
    return dayAfter.toISOString().split('T')[0];
  });
  const [passengerCount, setPassengerCount] = useState(1);
  const [busType, setBusType] = useState("Any");
  const [errors, setErrors] = useState<string>("");

  const [results, setResults] = useState<any[]>([]);
  const [filteredResults, setFilteredResults] = useState<any[]>([]);
  const [loading, setLoading] = useTabLoading('buses');
  const [resultsStage, setResultsStage] = useState<'onward' | 'return'>('onward');

  const [priceRange, setPriceRange] = useState<number>(3000);
  const [selectedOperators, setSelectedOperators] = useState<string[]>([]);
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
  const [selectedBoardingPoints, setSelectedBoardingPoints] = useState<string[]>([]);
  const [selectedDroppingPoints, setSelectedDroppingPoints] = useState<string[]>([]);
  const [timeFilter, setTimeFilter] = useState<'all' | 'morning' | 'afternoon' | 'evening'>('all');
  const [acFilter, setAcFilter] = useState<'all' | 'ac' | 'non_ac'>('all');
  const [seatTypeFilter, setSeatTypeFilter] = useState<'all' | 'sleeper' | 'seater'>('all');
  const [minRating, setMinRating] = useState<number>(0);
  
  const [sortBy, setSortBy] = useState<'cheapest' | 'fastest' | 'recommended' | 'rating' | 'departure'>('recommended');

  const [expandedBusDetailsId, setExpandedBusDetailsId] = useState<number | null>(null);
  const [activeDetailsTab, setActiveDetailsTab] = useState<'overview' | 'amenities' | 'boarding' | 'dropping' | 'cancellation'>('overview');

  const [selectedBus, setSelectedBus] = useState<any | null>(null);
  const [seatMap, setSeatMap] = useState<any[]>([]);
  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
  const [boardingPoint, setBoardingPoint] = useState<any | null>(null);
  const [droppingPoint, setDroppingPoint] = useState<any | null>(null);

  const [selectedReturnBus, setSelectedReturnBus] = useState<any | null>(null);
  const [returnSeatMap, setReturnSeatMap] = useState<any[]>([]);
  const [selectedReturnSeats, setSelectedReturnSeats] = useState<string[]>([]);
  const [returnBoardingPoint, setReturnBoardingPoint] = useState<any | null>(null);
  const [returnDroppingPoint, setReturnDroppingPoint] = useState<any | null>(null);

  const [passengersList, setPassengersList] = useState<Array<{ name: string; age: string; gender: string }>>([]);
  const [savedTravelers, setSavedTravelers] = useState<any[]>([]);
  const [savedPassengers, setSavedPassengers] = useState<any[]>([]);
  useEffect(() => {
    if (!token) return;
    fetch(`${API_URL}/passengers`, {
      headers: { "Authorization": `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setSavedPassengers(data);
        }
      })
      .catch(e => console.error("Error loading saved passengers in buses:", e));
  }, [token]);
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [promoDiscount, setPromoDiscount] = useState(0);
  const [promoApplied, setPromoApplied] = useState(false);
  const [walletApplied, setWalletApplied] = useState(false);
  const [walletBalance, setWalletBalance] = useState(2500); 
  const [isSubmitting, setIsSubmitting] = useState(false);

  const POPULAR_DESTINATIONS = [
    "Delhi", "Mumbai", "Bengaluru", "Jaipur", "Goa", "Pune", "Manali", "Shimla", 
    "Ahmedabad", "Hyderabad", "Kolkata", "Chennai", "Kochi", "Amritsar", "Dehradun", 
    "Leh", "Udaipur", "Rishikesh", "Varanasi", "Mysore", "Darjeeling", "Srinagar"
  ];

  useEffect(() => {
    if (token) {
      fetch(`${API_URL}/profile`, {
        headers: { "Authorization": `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => {
          if (data.email) setContactEmail(data.email);
          if (data.mobile_number) setContactPhone(data.mobile_number);
          if (data.wallet_balance !== undefined) setWalletBalance(parseFloat(data.wallet_balance));
        })
        .catch(() => {});

      fetch(`${API_URL}/profile/travellers`, {
        headers: { "Authorization": `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) setSavedTravelers(data);
        })
        .catch(() => {});
    }
  }, [token]);

  useEffect(() => {
    setPassengersList(
      Array.from({ length: passengerCount }, (_, i) => ({
        name: passengersList[i]?.name || "",
        age: passengersList[i]?.age || "",
        gender: passengersList[i]?.gender || "Male"
      }))
    );
  }, [passengerCount]);

  const handleSwap = () => {
    const temp = fromCity;
    setFromCity(toCity);
    setToCity(temp);
  };

  const setQuickDate = (type: 'today' | 'tomorrow' | 'weekend') => {
    const d = new Date();
    if (type === 'tomorrow') {
      d.setDate(d.getDate() + 1);
    } else if (type === 'weekend') {
      const day = d.getDay();
      const diff = day === 6 ? 7 : (6 - day);
      d.setDate(d.getDate() + diff);
    }
    setJourneyDate(d.toISOString().split('T')[0]);
  };

  const handleSearch = () => {
    setErrors("");
    if (!fromCity.trim()) {
      setErrors("Please specify starting city.");
      return;
    }
    if (!toCity.trim()) {
      setErrors("Please specify destination city.");
      return;
    }
    if (fromCity.trim().toLowerCase() === toCity.trim().toLowerCase()) {
      setErrors("Origin and destination cities cannot be equal.");
      return;
    }
    if (!journeyDate) {
      setErrors("Please select journey date.");
      return;
    }
    if (tripType === 'round_trip' && !returnDate) {
      setErrors("Please select a return date for round trip bookings.");
      return;
    }
    if (tripType === 'round_trip' && returnDate < journeyDate) {
      setErrors("Return date cannot be earlier than journey date.");
      return;
    }
    
    const recent = JSON.parse(localStorage.getItem("recent_bus_searches") || "[]");
    const newSearch = { from: fromCity, to: toCity };
    const filteredRecent = recent.filter((r: any) => !(r.from === fromCity && r.to === toCity));
    filteredRecent.unshift(newSearch);
    localStorage.setItem("recent_bus_searches", JSON.stringify(filteredRecent.slice(0, 5)));

    setLoading(true);
    setResultsStage('onward');
    setViewMode('results');
    setResults([]);
    setSelectedBus(null);
    setSelectedReturnBus(null);
    setSelectedSeats([]);
    setSelectedReturnSeats([]);
    
    fetch(`${API_URL}/search?vertical=buses&origin=${encodeURIComponent(fromCity)}&destination=${encodeURIComponent(toCity)}`)
      .then(res => res.json())
      .then(data => {
        setLoading(false);
        if (data && Array.isArray(data.results)) {
          setResults(data.results);
          setFilteredResults(data.results);
        }
      })
      .catch(() => {
        setLoading(false);
        setErrors("Failed to load search results. Please try again.");
      });
  };

  useEffect(() => {
    const trigger = sessionStorage.getItem("trigger_bus_search");
    if (trigger) {
      sessionStorage.removeItem("trigger_bus_search");
      setTimeout(() => {
        handleSearch();
      }, 100);
    }
  }, []);

  useEffect(() => {
    let list = [...results];

    if (busType !== "Any") {
      const bt = busType.toLowerCase();
      if (bt === "volvo") {
        list = list.filter(b => b.bus_type.toLowerCase().includes("volvo") || b.bus_type.toLowerCase().includes("premium"));
      } else if (bt === "electric") {
        list = list.filter(b => b.bus_type.toLowerCase().includes("electric") || b.bus_type.toLowerCase().includes("ev"));
      } else if (bt === "luxury") {
        list = list.filter(b => b.bus_type.toLowerCase().includes("luxury") || b.bus_type.toLowerCase().includes("premium") || b.bus_type.toLowerCase().includes("volvo"));
      } else if (bt === "ac seater/sleeper") {
        list = list.filter(b => b.bus_type.toLowerCase().includes("ac") && b.bus_type.toLowerCase().includes("seater") && b.bus_type.toLowerCase().includes("sleeper"));
      } else if (bt === "ac sleeper") {
        list = list.filter(b => b.bus_type.toLowerCase().includes("ac") && b.bus_type.toLowerCase().includes("sleeper") && !b.bus_type.toLowerCase().includes("non-ac"));
      } else if (bt === "non-ac sleeper") {
        list = list.filter(b => b.bus_type.toLowerCase().includes("non-ac") && b.bus_type.toLowerCase().includes("sleeper"));
      } else if (bt === "ac seater") {
        list = list.filter(b => b.bus_type.toLowerCase().includes("ac") && b.bus_type.toLowerCase().includes("seater") && !b.bus_type.toLowerCase().includes("non-ac"));
      } else if (bt === "non-ac seater") {
        list = list.filter(b => b.bus_type.toLowerCase().includes("non-ac") && b.bus_type.toLowerCase().includes("seater"));
      } else {
        list = list.filter(b => b.bus_type.toLowerCase().includes(bt.split(' ')[0]));
      }
    }

    list = list.filter(b => b.price <= priceRange);

    if (selectedOperators.length > 0) {
      list = list.filter(b => selectedOperators.includes(b.operator_name));
    }

    if (acFilter === 'ac') {
      list = list.filter(b => b.bus_type.toLowerCase().includes('ac') || b.bus_type.toLowerCase().includes('volvo'));
    } else if (acFilter === 'non_ac') {
      list = list.filter(b => !b.bus_type.toLowerCase().includes('ac') && !b.bus_type.toLowerCase().includes('volvo'));
    }

    if (seatTypeFilter === 'sleeper') {
      list = list.filter(b => b.bus_type.toLowerCase().includes('sleeper'));
    } else if (seatTypeFilter === 'seater') {
      list = list.filter(b => b.bus_type.toLowerCase().includes('seater'));
    }

    if (timeFilter !== 'all') {
      list = list.filter(b => {
        try {
          const hour = parseInt(b.departure_time.split(':')[0]);
          if (timeFilter === 'morning') return hour >= 6 && hour < 12;
          if (timeFilter === 'afternoon') return hour >= 12 && hour < 18;
          if (timeFilter === 'evening') return hour >= 18 || hour < 6;
        } catch (e) {
          return true;
        }
        return true;
      });
    }

    if (selectedAmenities.length > 0) {
      list = list.filter(b => 
        selectedAmenities.every(amenity => b.amenities && b.amenities.includes(amenity))
      );
    }

    if (selectedBoardingPoints.length > 0) {
      list = list.filter(b => (b.boarding_points || []).some((bp: any) => selectedBoardingPoints.includes(bp.name)));
    }

    if (selectedDroppingPoints.length > 0) {
      list = list.filter(b => (b.dropping_points || []).some((dp: any) => selectedDroppingPoints.includes(dp.name)));
    }

    if (minRating > 0) {
      list = list.filter(b => b.rating >= minRating);
    }

    if (sortBy === 'cheapest') {
      list.sort((a, b) => a.price - b.price);
    } else if (sortBy === 'fastest') {
      const getMins = (d: string) => {
        const h = parseInt(d.split('h')[0]) || 0;
        const m = parseInt(d.split(' ')[1]?.replace('m', '')) || 0;
        return h * 60 + m;
      };
      list.sort((a, b) => getMins(a.duration) - getMins(b.duration));
    } else if (sortBy === 'rating') {
      list.sort((a, b) => b.rating - a.rating);
    } else if (sortBy === 'departure') {
      list.sort((a, b) => a.departure_time.localeCompare(b.departure_time));
    }

    setFilteredResults(list);
  }, [results, priceRange, selectedOperators, selectedAmenities, selectedBoardingPoints, selectedDroppingPoints, timeFilter, acFilter, seatTypeFilter, minRating, sortBy, busType]);

  const handleOpenSeatMap = (bus: any) => {
    if (resultsStage === 'onward') {
      setSelectedBus(bus);
      setSelectedSeats([]);
      setBoardingPoint(null);
      setDroppingPoint(null);
      setViewMode('seats');
      
      fetch(`${API_URL}/buses/${bus.id}/seats`)
        .then(res => res.json())
        .then(data => {
          if (data && Array.isArray(data.seats)) {
            setSeatMap(data.seats);
          }
        })
        .catch(() => {
          const fallbackMap = bus.seats_map.map((seat: string) => {
            const stable_val = sumChars(seat + bus.operator_name);
            return {
              seat_number: seat,
              is_occupied: stable_val % 5 === 0,
              seat_type: seat.startsWith('U') ? 'Upper Sleeper' : seat.startsWith('L') ? 'Lower Sleeper' : 'Seater Aisle',
              price: bus.price + (seat.startsWith('U') ? 200 : seat.startsWith('L') ? 150 : 0)
            };
          });
          setSeatMap(fallbackMap);
        });
    } else {
      setSelectedReturnBus(bus);
      setSelectedReturnSeats([]);
      setReturnBoardingPoint(null);
      setReturnDroppingPoint(null);
      setViewMode('seats');
      
      fetch(`${API_URL}/buses/${bus.id}/seats`)
        .then(res => res.json())
        .then(data => {
          if (data && Array.isArray(data.seats)) {
            setReturnSeatMap(data.seats);
          }
        })
        .catch(() => {
          const fallbackMap = bus.seats_map.map((seat: string) => {
            const stable_val = sumChars(seat + bus.operator_name);
            return {
              seat_number: seat,
              is_occupied: stable_val % 5 === 0,
              seat_type: seat.startsWith('U') ? 'Upper Sleeper' : seat.startsWith('L') ? 'Lower Sleeper' : 'Seater Aisle',
              price: bus.price + (seat.startsWith('U') ? 200 : seat.startsWith('L') ? 150 : 0)
            };
          });
          setReturnSeatMap(fallbackMap);
        });
    }
  };

  const sumChars = (s: string) => {
    let sum = 0;
    for (let i = 0; i < s.length; i++) sum += s.charCodeAt(i);
    return sum;
  };

  const toggleSeat = (seat: any) => {
    if (seat.is_occupied) return;
    if (resultsStage === 'onward') {
      if (selectedSeats.includes(seat.seat_number)) {
        setSelectedSeats(prev => prev.filter(s => s !== seat.seat_number));
      } else {
        if (selectedSeats.length >= passengerCount) {
          alert(`You can select at most ${passengerCount} seats as specified in search.`);
          return;
        }
        setSelectedSeats(prev => [...prev, seat.seat_number]);
      }
    } else {
      if (selectedReturnSeats.includes(seat.seat_number)) {
        setSelectedReturnSeats(prev => prev.filter(s => s !== seat.seat_number));
      } else {
        if (selectedReturnSeats.length >= passengerCount) {
          alert(`You can select at most ${passengerCount} seats as specified in search.`);
          return;
        }
        setSelectedReturnSeats(prev => [...prev, seat.seat_number]);
      }
    }
  };

  const getSelectedSeatsSurcharge = (stage: 'onward' | 'return') => {
    let surcharge = 0;
    const seats = stage === 'onward' ? selectedSeats : selectedReturnSeats;
    const map = stage === 'onward' ? seatMap : returnSeatMap;
    const basePrice = stage === 'onward' ? selectedBus?.price : selectedReturnBus?.price;
    seats.forEach(num => {
      const match = map.find(s => s.seat_number === num);
      if (match && basePrice) {
        surcharge += Math.max(0, match.price - basePrice);
      }
    });
    return surcharge;
  };

  const handleConfirmSeats = () => {
    if (resultsStage === 'onward') {
      if (!boardingPoint) {
        alert("Please select a Boarding Point.");
        return;
      }
      if (!droppingPoint) {
        alert("Please select a Dropping Point.");
        return;
      }
      if (selectedSeats.length !== passengerCount) {
        alert(`Please select exactly ${passengerCount} seats to match your traveler count.`);
        return;
      }
      
      if (tripType === 'round_trip' && !selectedReturnBus) {
        setLoading(true);
        setResultsStage('return');
        setViewMode('results');
        fetch(`${API_URL}/search?vertical=buses&origin=${encodeURIComponent(toCity)}&destination=${encodeURIComponent(fromCity)}`)
          .then(res => res.json())
          .then(data => {
            setLoading(false);
            if (data && Array.isArray(data.results)) {
              setResults(data.results);
              setFilteredResults(data.results);
            }
          })
          .catch(() => {
            setLoading(false);
            setErrors("Failed to load return buses. Please try again.");
          });
      } else {
        setViewMode('passengers');
      }
    } else {
      if (!returnBoardingPoint) {
        alert("Please select a Return Boarding Point.");
        return;
      }
      if (!returnDroppingPoint) {
        alert("Please select a Return Dropping Point.");
        return;
      }
      if (selectedReturnSeats.length !== passengerCount) {
        alert(`Please select exactly ${passengerCount} seats for the return journey.`);
        return;
      }
      setViewMode('passengers');
    }
  };

  const handleApplyPromo = () => {
    const code = promoCode.trim().toUpperCase();
    if (!code) return;
    
    const headers: any = { "Content-Type": "application/json" };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    
    fetch(`${API_URL}/coupon/validate`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        code: code,
        order_value: subtotal
      })
    })
      .then(res => {
        if (!res.ok) {
          return res.json().then(data => { throw new Error(data.detail || "Invalid coupon code.") });
        }
        return res.json();
      })
      .then(data => {
        setPromoDiscount(parseFloat(data.discount_amount));
        setPromoApplied(true);
        setErrors("");
      })
      .catch((err: any) => {
        setErrors(err.message || "Failed to validate coupon.");
        setPromoDiscount(0);
        setPromoApplied(false);
      });
  };

  const onwardBaseTotal = selectedBus ? selectedBus.price * passengerCount : 0;
  const onwardSurcharge = getSelectedSeatsSurcharge('onward');
  const onwardSubtotal = onwardBaseTotal + onwardSurcharge;

  const returnBaseTotal = selectedReturnBus ? selectedReturnBus.price * passengerCount : 0;
  const returnSurcharge = getSelectedSeatsSurcharge('return');
  const returnSubtotal = returnBaseTotal + returnSurcharge;

  const baseTotal = onwardBaseTotal + returnBaseTotal;
  const seatSurcharge = onwardSurcharge + returnSurcharge;
  const subtotal = onwardSubtotal + returnSubtotal;
  const gstTax = Math.round(subtotal * 0.05);
  const convenienceFee = tripType === 'round_trip' ? 100 : 50;
  const totalAmount = subtotal + gstTax + convenienceFee - promoDiscount;
  const walletAmount = walletApplied ? Math.min(walletBalance, totalAmount) : 0;
  const payableAmount = totalAmount - walletAmount;

  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors("");

    for (let i = 0; i < passengersList.length; i++) {
      if (!passengersList[i].name.trim()) {
        setErrors(`Please enter full name for Passenger ${i + 1}.`);
        return;
      }
      if (!passengersList[i].age) {
        setErrors(`Please enter age for Passenger ${i + 1}.`);
        return;
      }
    }
    if (!contactEmail.trim() || !contactPhone.trim()) {
      setErrors("Contact Email and Mobile Number are required.");
      return;
    }

    setIsSubmitting(true);

    const headers = {
      "Content-Type": "application/json",
      ...(token ? { "Authorization": `Bearer ${token}` } : {})
    };

    const onwardPayload = {
      vertical: "buses",
      amount: onwardSubtotal + Math.round(onwardSubtotal * 0.05) + 50 - (tripType === 'round_trip' ? 0 : promoDiscount),
      details: {
        bus_id: selectedBus.id,
        operator_name: selectedBus.operator_name,
        bus_type: selectedBus.bus_type,
        origin: fromCity,
        destination: toCity,
        journey_date: journeyDate,
        departure_time: selectedBus.departure_time,
        seat_numbers: selectedSeats,
        boarding_point: boardingPoint,
        dropping_point: droppingPoint,
        passengers: passengersList.map((p, idx) => ({
          name: p.name,
          age: parseInt(p.age),
          gender: p.gender,
          seat_number: selectedSeats[idx]
        })),
        contact: { email: contactEmail, phone: contactPhone },
        promoDiscount: tripType === 'round_trip' ? 0 : promoDiscount,
        walletUsed: walletApplied ? Math.min(walletBalance, onwardSubtotal + Math.round(onwardSubtotal * 0.05) + 50) : 0,
        base_fare: selectedBus.price
      }
    };

    try {
      const resOnward = await fetch(`${API_URL}/bookings/hold`, {
        method: "POST",
        headers,
        body: JSON.stringify(onwardPayload)
      });
      const dataOnward = await resOnward.json();
      if (!resOnward.ok) {
        throw new Error(dataOnward.detail || dataOnward.message || "Failed to hold onward ticket.");
      }

      if (tripType === 'round_trip' && selectedReturnBus) {
        const returnPayload = {
          vertical: "buses",
          amount: returnSubtotal + Math.round(returnSubtotal * 0.05) + 50 - promoDiscount,
          details: {
            bus_id: selectedReturnBus.id,
            operator_name: selectedReturnBus.operator_name,
            bus_type: selectedReturnBus.bus_type,
            origin: toCity,
            destination: fromCity,
            journey_date: returnDate,
            departure_time: selectedReturnBus.departure_time,
            seat_numbers: selectedReturnSeats,
            boarding_point: returnBoardingPoint,
            dropping_point: returnDroppingPoint,
            passengers: passengersList.map((p, idx) => ({
              name: p.name,
              age: parseInt(p.age),
              gender: p.gender,
              seat_number: selectedReturnSeats[idx]
            })),
            contact: { email: contactEmail, phone: contactPhone },
            promoDiscount: promoDiscount,
            walletUsed: 0, 
            base_fare: selectedReturnBus.price
          }
        };

        const resReturn = await fetch(`${API_URL}/bookings/hold`, {
          method: "POST",
          headers,
          body: JSON.stringify(returnPayload)
        });
        const dataReturn = await resReturn.json();
        if (!resReturn.ok) {
          throw new Error(dataReturn.detail || dataReturn.message || "Failed to hold return ticket.");
        }

        localStorage.setItem("pending_return_booking_ref", dataReturn.booking_reference);
      }

      onNavigate(`/checkout/${dataOnward.booking_reference}`);
    } catch (err: any) {
      setErrors(err.message || "Error processing booking.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const uniqueOperators = Array.from(new Set(results.map(b => b.operator_name)));
  const uniqueBoardingPoints = Array.from(new Set(results.flatMap(b => (b.boarding_points || []).map((bp: any) => bp.name))));
  const uniqueDroppingPoints = Array.from(new Set(results.flatMap(b => (b.dropping_points || []).map((dp: any) => dp.name))));

  if (viewMode === 'search') {
    return (
      <div className="space-y-6 text-black font-sans">
        <div className="bg-white border-4 border-black p-6 rounded-3xl shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] max-w-4xl mx-auto space-y-5 text-left">
          <div className="flex justify-between items-center border-b-3 border-black pb-3">
            <h3 className="text-lg font-black uppercase tracking-wider text-black flex items-center gap-1.5">
              🚌 Intercity Bus Booking
            </h3>
            <div className="flex gap-2 bg-slate-100 p-1 border-2 border-black rounded-lg text-[10px] font-black uppercase">
              <button 
                type="button" 
                onClick={() => setTripType('one_way')} 
                className={`px-3 py-1 rounded transition-colors cursor-pointer ${tripType === 'one_way' ? 'bg-yellow-300 border border-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]' : 'text-slate-600 border border-transparent'}`}
              >
                One Way
              </button>
              <button 
                type="button" 
                onClick={() => setTripType('round_trip')} 
                className={`px-3 py-1 rounded transition-colors cursor-pointer ${tripType === 'round_trip' ? 'bg-yellow-300 border border-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]' : 'text-slate-600 border border-transparent'}`}
              >
                Round Trip
              </button>
            </div>
          </div>

          {errors && (
            <div className="bg-red-50 border-2 border-red-500 text-red-700 text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1.5">
              <Info size={14} className="text-red-500" />
              {errors}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative">
            <div className="space-y-1.5 relative">
              <label className="text-[10px] text-slate-500 font-extrabold uppercase flex items-center gap-1">
                <MapPin size={12} /> From City
              </label>
              <input 
                type="text" 
                value={fromCity} 
                onChange={(e) => {
                  setFromCity(e.target.value);
                  setShowFromSuggestions(true);
                }} 
                onFocus={() => setShowFromSuggestions(true)}
                onBlur={() => setTimeout(() => setShowFromSuggestions(false), 200)}
                className="w-full bg-white border-3 border-black rounded-2xl px-4 py-3 text-sm text-black font-extrabold outline-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]" 
              />
              {showFromSuggestions && (
                <div className="absolute left-0 right-0 top-[75px] bg-white border-3 border-black rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] z-50 overflow-y-auto max-h-56 p-2 space-y-2 text-left">
                  {(() => {
                    const recent = JSON.parse(localStorage.getItem("recent_bus_searches") || "[]");
                    if (recent.length > 0) {
                      return (
                        <div className="border-b border-slate-100 pb-2">
                          <span className="text-[8px] text-slate-400 font-black uppercase tracking-wider block mb-1">Recent Searches</span>
                          <div className="flex flex-wrap gap-1.5">
                            {recent.map((r: any, idx: number) => (
                              <button
                                key={idx}
                                type="button"
                                onMouseDown={() => {
                                  setFromCity(r.from);
                                  setToCity(r.to);
                                  setShowFromSuggestions(false);
                                }}
                                className="bg-slate-100 hover:bg-yellow-100 border border-slate-300 px-2 py-1 rounded text-[10px] font-bold text-slate-700 cursor-pointer"
                              >
                                {r.from} ➔ {r.to}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}
                  
                  <div>
                    <span className="text-[8px] text-slate-400 font-black uppercase tracking-wider block mb-1">Popular Cities</span>
                    <div className="grid grid-cols-3 gap-1">
                      {["Delhi", "Mumbai", "Bengaluru", "Jaipur", "Goa", "Pune"].map((city) => (
                        <button
                          key={city}
                          type="button"
                          onMouseDown={() => {
                            setFromCity(city);
                            setShowFromSuggestions(false);
                          }}
                          className="bg-slate-50 hover:bg-yellow-100 border border-slate-200 py-1 rounded text-[10px] font-bold text-slate-700 cursor-pointer"
                        >
                          {city}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="border-t border-slate-100 pt-2">
                    <span className="text-[8px] text-slate-400 font-black uppercase tracking-wider block mb-1">All Destinations</span>
                    {POPULAR_DESTINATIONS.filter(dest => dest.toLowerCase().includes(fromCity.toLowerCase()))
                      .map((dest, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onMouseDown={() => {
                            setFromCity(dest);
                            setShowFromSuggestions(false);
                          }}
                          className="w-full text-left px-2 py-1.5 hover:bg-yellow-100 transition-colors font-bold text-[11px] border-b border-slate-100 last:border-0 cursor-pointer"
                        >
                          📍 {dest}
                        </button>
                      ))}
                  </div>
                </div>
              )}
            </div>

            <div className="absolute left-1/2 top-[34px] -translate-x-1/2 z-10 hidden md:block">
              <button 
                type="button"
                onClick={handleSwap}
                className="bg-yellow-300 hover:bg-yellow-400 text-black border-2 border-black p-1.5 rounded-full shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
                title="Swap cities"
              >
                🔄
              </button>
            </div>

            <div className="space-y-1.5 relative">
              <label className="text-[10px] text-slate-500 font-extrabold uppercase flex items-center gap-1">
                <MapPin size={12} /> To City
              </label>
              <input 
                type="text" 
                value={toCity} 
                onChange={(e) => {
                  setToCity(e.target.value);
                  setShowToSuggestions(true);
                }} 
                onFocus={() => setShowToSuggestions(true)}
                onBlur={() => setTimeout(() => setShowToSuggestions(false), 200)}
                className="w-full bg-white border-3 border-black rounded-2xl px-4 py-3 text-sm text-black font-extrabold outline-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]" 
              />
              {showToSuggestions && (
                <div className="absolute left-0 right-0 top-[75px] bg-white border-3 border-black rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] z-50 overflow-y-auto max-h-56 p-2 space-y-2 text-left">
                  <div>
                    <span className="text-[8px] text-slate-400 font-black uppercase tracking-wider block mb-1">Popular Cities</span>
                    <div className="grid grid-cols-3 gap-1">
                      {["Delhi", "Mumbai", "Bengaluru", "Jaipur", "Goa", "Pune"].map((city) => (
                        <button
                          key={city}
                          type="button"
                          onMouseDown={() => {
                            setToCity(city);
                            setShowToSuggestions(false);
                          }}
                          className="bg-slate-50 hover:bg-yellow-100 border border-slate-200 py-1 rounded text-[10px] font-bold text-slate-700 cursor-pointer"
                        >
                          {city}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="border-t border-slate-100 pt-2">
                    <span className="text-[8px] text-slate-400 font-black uppercase tracking-wider block mb-1">All Destinations</span>
                    {POPULAR_DESTINATIONS.filter(dest => dest.toLowerCase().includes(toCity.toLowerCase()))
                      .map((dest, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onMouseDown={() => {
                            setToCity(dest);
                            setShowToSuggestions(false);
                          }}
                          className="w-full text-left px-2 py-1.5 hover:bg-yellow-100 transition-colors font-bold text-[11px] border-b border-slate-100 last:border-0 cursor-pointer"
                        >
                          📍 {dest}
                        </button>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] text-slate-500 font-extrabold uppercase flex items-center gap-1">
                <Calendar size={12} /> Journey Date
              </label>
              <input 
                type="date" 
                value={journeyDate} 
                min={new Date().toISOString().split('T')[0]}
                onChange={(e) => setJourneyDate(e.target.value)}
                className="w-full bg-white border-3 border-black rounded-2xl px-4 py-2.5 text-sm text-black font-extrabold outline-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]" 
              />
              <div className="flex gap-1.5 mt-1.5">
                <button
                  type="button"
                  onClick={() => setQuickDate('today')}
                  className="bg-slate-100 border border-slate-300 text-[9px] font-extrabold px-2 py-0.5 rounded hover:bg-slate-200 cursor-pointer"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => setQuickDate('tomorrow')}
                  className="bg-slate-100 border border-slate-300 text-[9px] font-extrabold px-2 py-0.5 rounded hover:bg-slate-200 cursor-pointer"
                >
                  Tomorrow
                </button>
                <button
                  type="button"
                  onClick={() => setQuickDate('weekend')}
                  className="bg-slate-100 border border-slate-300 text-[9px] font-extrabold px-2 py-0.5 rounded hover:bg-slate-200 cursor-pointer"
                >
                  Weekend
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] text-slate-500 font-extrabold uppercase flex items-center gap-1">
                <Calendar size={12} /> Return Date {tripType === 'one_way' && '(Optional)'}
              </label>
              <input 
                type="date" 
                value={returnDate} 
                min={journeyDate}
                disabled={tripType === 'one_way'}
                onChange={(e) => setReturnDate(e.target.value)}
                className="w-full bg-white border-3 border-black rounded-2xl px-4 py-2.5 text-sm text-black font-extrabold outline-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] disabled:bg-slate-50 disabled:text-slate-400" 
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] text-slate-500 font-extrabold uppercase flex items-center gap-1">
                <Users size={12} /> Travelers
              </label>
              <div className="flex items-center justify-between bg-white border-3 border-black rounded-2xl px-4 py-1.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                <button 
                  type="button" 
                  onClick={() => setPassengerCount(prev => Math.max(1, prev - 1))}
                  className="w-8 h-8 rounded-lg border border-black hover:bg-slate-100 flex items-center justify-center font-black cursor-pointer"
                >
                  -
                </button>
                <span className="font-extrabold text-sm text-black">{passengerCount} Pax</span>
                <button 
                  type="button" 
                  onClick={() => setPassengerCount(prev => Math.min(6, prev + 1))}
                  className="w-8 h-8 rounded-lg border border-black hover:bg-slate-100 flex items-center justify-center font-black cursor-pointer"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-[10px] text-slate-500 font-extrabold uppercase">Prefer Class</label>
              <select 
                value={busType} 
                onChange={(e) => setBusType(e.target.value)}
                className="w-full bg-white border-3 border-black rounded-2xl px-4 py-3 text-sm text-black font-extrabold outline-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
              >
                <option value="Any">Any Bus Type</option>
                <option value="AC Sleeper">AC Sleeper</option>
                <option value="Non-AC Sleeper">Non-AC Sleeper</option>
                <option value="AC Seater">AC Seater</option>
                <option value="Non-AC Seater">Non-AC Seater</option>
                <option value="AC Seater/Sleeper">AC Seater/Sleeper</option>
                <option value="Volvo">Volvo / Premium</option>
                <option value="Electric">Electric</option>
                <option value="Luxury">Luxury</option>
              </select>
            </div>
            <div className="flex items-end">
              <button 
                type="button"
                onClick={handleSearch} 
                className="w-full bg-yellow-300 hover:bg-yellow-400 text-black border-3 border-black font-black text-xs py-3.5 rounded-2xl transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-0.5 active:shadow-none flex items-center justify-center gap-2 uppercase tracking-wide cursor-pointer"
              >
                <Search size={14} strokeWidth={3} /> Search Intercity Buses
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (viewMode === 'results') {
    return (
      <div className="space-y-6 text-black font-sans text-left">
        <div className="bg-slate-900 border-4 border-black p-4 rounded-3xl text-white flex flex-col md:flex-row justify-between items-center gap-4 shadow-[5px_5px_0px_0px_rgba(0,0,0,1)]">
          <div>
            <h4 className="font-black text-sm uppercase tracking-wide flex items-center gap-1.5">
              <Bus size={16} className="text-yellow-300" />
              {resultsStage === 'onward' 
                ? `Onward Journey: ${fromCity} ➔ ${toCity}`
                : `Return Journey: ${toCity} ➔ ${fromCity}`
              }
            </h4>
            <p className="text-[10px] text-slate-400 mt-0.5 font-bold">
              {resultsStage === 'onward' ? new Date(journeyDate).toDateString() : new Date(returnDate).toDateString()} | {passengerCount} Traveler{passengerCount > 1 ? 's' : ''} | Class: {busType}
            </p>
          </div>
          <button 
            onClick={() => setViewMode('search')}
            className="bg-yellow-300 hover:bg-yellow-400 text-black border-2 border-black font-black px-4 py-2 rounded-xl text-[10px] uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all cursor-pointer"
          >
            Modify Search
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="md:col-span-1 space-y-4">
            <div className="bg-white border-3 border-black p-4 rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] space-y-4">
              <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                <span className="text-xs font-black uppercase">Filters</span>
                <button 
                  onClick={() => {
                    setPriceRange(3000);
                    setSelectedOperators([]);
                    setSelectedAmenities([]);
                    setSelectedBoardingPoints([]);
                    setSelectedDroppingPoints([]);
                    setTimeFilter('all');
                    setAcFilter('all');
                    setSeatTypeFilter('all');
                    setMinRating(0);
                  }}
                  className="text-[9px] font-bold text-blue-600 hover:underline cursor-pointer"
                >
                  Clear All
                </button>
              </div>

              <div className="space-y-1.5">
                <span className="text-[10px] text-slate-500 font-extrabold uppercase block">Max Fare: ₹{priceRange}</span>
                <input 
                  type="range" 
                  min="500" 
                  max="3000" 
                  step="100"
                  value={priceRange} 
                  onChange={(e) => setPriceRange(parseInt(e.target.value))}
                  className="w-full accent-yellow-400"
                />
              </div>

              <div className="space-y-1.5">
                <span className="text-[10px] text-slate-500 font-extrabold uppercase block">AC Option</span>
                <div className="grid grid-cols-3 gap-1 bg-slate-100 p-0.5 rounded-lg text-[9px] font-bold uppercase text-center">
                  <button 
                    onClick={() => setAcFilter('all')} 
                    className={`py-1 rounded cursor-pointer ${acFilter === 'all' ? 'bg-yellow-300 border border-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]' : ''}`}
                  >
                    All
                  </button>
                  <button 
                    onClick={() => setAcFilter('ac')} 
                    className={`py-1 rounded cursor-pointer ${acFilter === 'ac' ? 'bg-yellow-300 border border-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]' : ''}`}
                  >
                    AC
                  </button>
                  <button 
                    onClick={() => setAcFilter('non_ac')} 
                    className={`py-1 rounded cursor-pointer ${acFilter === 'non_ac' ? 'bg-yellow-300 border border-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]' : ''}`}
                  >
                    Non-AC
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="text-[10px] text-slate-500 font-extrabold uppercase block">Seat Type</span>
                <div className="grid grid-cols-3 gap-1 bg-slate-100 p-0.5 rounded-lg text-[9px] font-bold uppercase text-center">
                  <button 
                    onClick={() => setSeatTypeFilter('all')} 
                    className={`py-1 rounded cursor-pointer ${seatTypeFilter === 'all' ? 'bg-yellow-300 border border-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]' : ''}`}
                  >
                    All
                  </button>
                  <button 
                    onClick={() => setSeatTypeFilter('sleeper')} 
                    className={`py-1 rounded cursor-pointer ${seatTypeFilter === 'sleeper' ? 'bg-yellow-300 border border-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]' : ''}`}
                  >
                    Sleeper
                  </button>
                  <button 
                    onClick={() => setSeatTypeFilter('seater')} 
                    className={`py-1 rounded cursor-pointer ${seatTypeFilter === 'seater' ? 'bg-yellow-300 border border-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]' : ''}`}
                  >
                    Seater
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="text-[10px] text-slate-500 font-extrabold uppercase block">Departure Time</span>
                <select 
                  value={timeFilter} 
                  onChange={(e: any) => setTimeFilter(e.target.value)}
                  className="w-full bg-slate-100 border-2 border-black rounded-lg p-1.5 text-[10px] font-extrabold outline-none"
                >
                  <option value="all">Any Departure Time</option>
                  <option value="morning">Morning (6 AM - 12 PM)</option>
                  <option value="afternoon">Afternoon (12 PM - 6 PM)</option>
                  <option value="evening">Evening/Night (After 6 PM)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <span className="text-[10px] text-slate-500 font-extrabold uppercase block">Minimum Rating</span>
                <div className="grid grid-cols-3 gap-1 bg-slate-100 p-0.5 rounded-lg text-[9px] font-bold uppercase text-center">
                  <button 
                    onClick={() => setMinRating(0)} 
                    className={`py-1 rounded cursor-pointer ${minRating === 0 ? 'bg-yellow-300 border border-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]' : ''}`}
                  >
                    Any
                  </button>
                  <button 
                    onClick={() => setMinRating(3)} 
                    className={`py-1 rounded cursor-pointer ${minRating === 3 ? 'bg-yellow-300 border border-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]' : ''}`}
                  >
                    3★ +
                  </button>
                  <button 
                    onClick={() => setMinRating(4)} 
                    className={`py-1 rounded cursor-pointer ${minRating === 4 ? 'bg-yellow-300 border border-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]' : ''}`}
                  >
                    4★ +
                  </button>
                </div>
              </div>

              {uniqueOperators.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[10px] text-slate-500 font-extrabold uppercase block">Operators</span>
                  <div className="max-h-24 overflow-y-auto space-y-1 text-xs">
                    {uniqueOperators.map((op: any) => (
                      <label key={op} className="flex items-center gap-1.5 font-bold text-slate-700 cursor-pointer">
                        <input 
                          type="checkbox"
                          checked={selectedOperators.includes(op)}
                          onChange={() => {
                            if (selectedOperators.includes(op)) {
                              setSelectedOperators(prev => prev.filter(x => x !== op));
                            } else {
                              setSelectedOperators(prev => [...prev, op]);
                            }
                          }}
                          className="accent-yellow-400"
                        />
                        <span>{op}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {uniqueBoardingPoints.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[10px] text-slate-500 font-extrabold uppercase block">Boarding Points</span>
                  <div className="max-h-24 overflow-y-auto space-y-1 text-xs">
                    {uniqueBoardingPoints.map((bp: any) => (
                      <label key={bp} className="flex items-center gap-1.5 font-bold text-slate-700 cursor-pointer">
                        <input 
                          type="checkbox"
                          checked={selectedBoardingPoints.includes(bp)}
                          onChange={() => {
                            if (selectedBoardingPoints.includes(bp)) {
                              setSelectedBoardingPoints(prev => prev.filter(x => x !== bp));
                            } else {
                              setSelectedBoardingPoints(prev => [...prev, bp]);
                            }
                          }}
                          className="accent-yellow-400"
                        />
                        <span>{bp}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {uniqueDroppingPoints.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[10px] text-slate-500 font-extrabold uppercase block">Dropping Points</span>
                  <div className="max-h-24 overflow-y-auto space-y-1 text-xs">
                    {uniqueDroppingPoints.map((dp: any) => (
                      <label key={dp} className="flex items-center gap-1.5 font-bold text-slate-700 cursor-pointer">
                        <input 
                          type="checkbox"
                          checked={selectedDroppingPoints.includes(dp)}
                          onChange={() => {
                            if (selectedDroppingPoints.includes(dp)) {
                              setSelectedDroppingPoints(prev => prev.filter(x => x !== dp));
                            } else {
                              setSelectedDroppingPoints(prev => [...prev, dp]);
                            }
                          }}
                          className="accent-yellow-400"
                        />
                        <span>{dp}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <span className="text-[10px] text-slate-500 font-extrabold uppercase block">Amenities</span>
                <div className="space-y-1 text-xs">
                  {["WiFi", "Blanket", "Charging Point", "Water Bottle", "CCTV", "Reading Light", "Washroom"].map((amenity) => (
                    <label key={amenity} className="flex items-center gap-1.5 font-bold text-slate-700 cursor-pointer">
                      <input 
                        type="checkbox"
                        checked={selectedAmenities.includes(amenity)}
                        onChange={() => {
                          if (selectedAmenities.includes(amenity)) {
                            setSelectedAmenities(prev => prev.filter(x => x !== amenity));
                          } else {
                            setSelectedAmenities(prev => [...prev, amenity]);
                          }
                        }}
                        className="accent-yellow-400"
                      />
                      <span>{amenity}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="md:col-span-3 space-y-4">
            <div className="bg-white border-3 border-black p-2.5 rounded-2xl shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] flex flex-wrap gap-2 items-center text-xs font-black">
              <span className="text-slate-500 uppercase text-[9px] mr-2">Sort By:</span>
              {[
                { key: 'recommended', label: 'Recommended' },
                { key: 'cheapest', label: 'Cheapest' },
                { key: 'fastest', label: 'Fastest' },
                { key: 'rating', label: 'Highest Rated' },
                { key: 'departure', label: 'Departure Time' }
              ].map((pill) => (
                <button
                  key={pill.key}
                  onClick={() => setSortBy(pill.key as any)}
                  className={`px-3 py-1 rounded-lg border-2 border-black transition-all cursor-pointer ${
                    sortBy === pill.key ? 'bg-yellow-300 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] translate-y-[-1px]' : 'bg-slate-50 hover:bg-slate-100'
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="text-center py-12 space-y-3">
                <div className="w-10 h-10 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Searching available bus inventories...</p>
              </div>
            ) : filteredResults.length === 0 ? (
              <div className="bg-white border-3 border-black rounded-3xl p-12 text-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] space-y-3">
                <Info size={40} className="mx-auto text-slate-400" />
                <h4 className="font-black text-sm uppercase">No Buses Found</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">We couldn't find any buses matching your active filters. Try widening your price range or selection criteria.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredResults.map((bus) => (
                  <div key={bus.id} className="bg-white border-4 border-black p-5 rounded-3xl shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] flex flex-col justify-between items-stretch gap-4 transition-transform hover:translate-y-[-2px]">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                      <div className="space-y-2 flex-grow text-left">
                        <div className="flex items-center gap-3">
                          <strong className="text-base font-black text-black">{bus.operator_name}</strong>
                          <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded border border-emerald-300 uppercase">
                            ★ {bus.rating} ({bus.review_count} reviews)
                          </span>
                        </div>
                        
                        <div className="text-xs text-slate-600 font-bold">
                          {bus.bus_type}
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-xs py-1 border-t border-b border-slate-100 max-w-md">
                          <div>
                            <strong className="text-black text-sm">{bus.departure_time}</strong>
                            <span className="text-[10px] text-slate-500 block font-bold">{bus.origin}</span>
                          </div>
                          <div className="text-center self-center">
                            <span className="text-[10px] text-slate-400 font-bold block border-b border-slate-200 pb-0.5">{bus.duration}</span>
                            <span className="text-[9px] text-slate-400">Direct</span>
                          </div>
                          <div>
                            <strong className="text-black text-sm">{bus.arrival_time}</strong>
                            <span className="text-[10px] text-slate-500 block font-bold">{bus.destination}</span>
                          </div>
                        </div>

                        <div className="flex gap-1.5 items-center">
                          <span className="text-[9px] text-slate-400 font-bold uppercase mr-1">Amenities:</span>
                          {bus.amenities?.slice(0, 4).map((amenity: string) => (
                            <span key={amenity} className="bg-slate-100 text-slate-700 text-[8px] font-bold px-1.5 py-0.5 rounded">
                              {amenity}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="text-right space-y-2 w-full md:w-auto self-stretch md:self-auto border-t md:border-0 pt-3 md:pt-0 flex md:flex-col justify-between items-center md:items-end">
                        <div className="text-left md:text-right">
                          <span className="text-[9px] text-slate-400 font-bold block uppercase">Starting at</span>
                          <strong className="text-xl font-black text-red-500">₹{bus.price}</strong>
                          <span className="text-[9px] text-slate-500 block font-bold">{bus.seats_left} seats left</span>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              if (expandedBusDetailsId === bus.id) {
                                setExpandedBusDetailsId(null);
                              } else {
                                setExpandedBusDetailsId(bus.id);
                                setActiveDetailsTab('overview');
                              }
                            }}
                            className="bg-slate-100 hover:bg-slate-200 text-black border-2 border-black font-extrabold text-[9px] px-3.5 py-2.5 rounded-xl shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-0.5 active:shadow-none transition-all uppercase cursor-pointer"
                          >
                            {expandedBusDetailsId === bus.id ? "Hide Details" : "View Details"}
                          </button>
                          <button 
                            onClick={() => handleOpenSeatMap(bus)}
                            className="bg-yellow-300 hover:bg-yellow-400 text-black border-3 border-black font-black text-[10px] px-5 py-2.5 rounded-xl shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:translate-y-0.5 active:shadow-none transition-all uppercase tracking-wider cursor-pointer"
                          >
                            Select Seats
                          </button>
                        </div>
                      </div>
                    </div>

                    {expandedBusDetailsId === bus.id && (
                      <div className="w-full mt-4 border-t border-slate-200 pt-4 text-xs text-left">
                        <div className="flex border-b border-slate-200 gap-4 mb-3 font-extrabold overflow-x-auto pb-1 text-[10px] uppercase">
                          {(['overview', 'amenities', 'boarding', 'dropping', 'cancellation'] as const).map(tab => (
                            <button
                              key={tab}
                              onClick={() => setActiveDetailsTab(tab)}
                              className={`pb-1 border-b-2 transition-all cursor-pointer ${
                                activeDetailsTab === tab ? 'border-yellow-400 text-yellow-600' : 'border-transparent text-slate-500 hover:text-slate-700'
                              }`}
                            >
                              {tab}
                            </button>
                          ))}
                        </div>

                        {activeDetailsTab === 'overview' && (
                          <div className="space-y-2 p-3 bg-slate-50 rounded-xl border border-slate-150">
                            <p className="font-bold text-slate-700">🚌 Operator: <span className="text-black">{bus.operator_name}</span></p>
                            <p className="font-bold text-slate-700">🛣️ Route: <span className="text-black">{bus.origin} ➔ {bus.destination} ({bus.duration})</span></p>
                            <p className="font-bold text-slate-700">🏷️ Bus Class: <span className="text-black">{bus.bus_type}</span></p>
                            <p className="font-bold text-slate-700">👥 Total Inventory: <span className="text-black">30 seat layout</span></p>
                          </div>
                        )}

                        {activeDetailsTab === 'amenities' && (
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 bg-slate-50 rounded-xl border border-slate-150">
                            {bus.amenities?.map((am: string) => (
                              <span key={am} className="bg-white border border-slate-200 p-1.5 rounded-lg font-bold text-slate-700 text-center flex items-center justify-center gap-1">
                                🔌 {am}
                              </span>
                            ))}
                          </div>
                        )}

                        {activeDetailsTab === 'boarding' && (
                          <div className="space-y-2 p-3 bg-slate-50 rounded-xl border border-slate-150">
                            {bus.boarding_points?.map((bp: any, idx: number) => (
                              <div key={idx} className="flex justify-between items-start border-b border-dashed last:border-0 border-slate-200 pb-1.5 mb-1.5 last:mb-0 last:pb-0">
                                <div>
                                  <strong className="text-slate-900 font-extrabold">{bp.name}</strong>
                                  <p className="text-[10px] text-slate-500 mt-0.5">{bp.address} (Landmark: {bp.landmark || "N/A"})</p>
                                </div>
                                <span className="font-black text-blue-600">{bp.time}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {activeDetailsTab === 'dropping' && (
                          <div className="space-y-2 p-3 bg-slate-50 rounded-xl border border-slate-150">
                            {bus.dropping_points?.map((dp: any, idx: number) => (
                              <div key={idx} className="flex justify-between items-start border-b border-dashed last:border-0 border-slate-200 pb-1.5 mb-1.5 last:mb-0 last:pb-0">
                                <div>
                                  <strong className="text-slate-900 font-extrabold">{dp.name}</strong>
                                  <p className="text-[10px] text-slate-500 mt-0.5">{dp.address} (Landmark: {dp.landmark || "N/A"})</p>
                                </div>
                                <span className="font-black text-blue-600">{dp.time}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {activeDetailsTab === 'cancellation' && (
                          <div className="p-3 bg-slate-50 rounded-xl border border-slate-150 space-y-2">
                            <table className="w-full text-left font-bold text-slate-700">
                              <thead>
                                <tr className="border-b border-slate-200 text-[10px] uppercase text-slate-500">
                                  <th className="pb-1">Time before Departure</th>
                                  <th className="pb-1 text-right">Refund Percentage</th>
                                </tr>
                              </thead>
                              <tbody>
                                <tr className="border-b border-slate-150 py-1.5">
                                  <td className="py-1">More than 24 hrs</td>
                                  <td className="py-1 text-right text-emerald-600">100% Refund</td>
                                </tr>
                                <tr className="border-b border-slate-150 py-1.5">
                                  <td className="py-1">12 to 24 hrs</td>
                                  <td className="py-1 text-right text-yellow-600">50% Refund</td>
                                </tr>
                                <tr className="py-1.5">
                                  <td className="py-1">Less than 12 hrs</td>
                                  <td className="py-1 text-right text-rose-600">No Refund</td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        )}
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

  if (viewMode === 'seats') {
    const isSleeper = selectedBus?.bus_type.toLowerCase().includes('sleeper');
    const lowerDeck = seatMap.filter(s => s.seat_number.startsWith('L') || (!s.seat_number.startsWith('U') && !isSleeper));
    const upperDeck = seatMap.filter(s => s.seat_number.startsWith('U'));

    // Boarding & dropping points mock arrays (could be fetched dynamically, matched stably)
    const boardingOptions = selectedBus?.boarding_points || [];
    const droppingOptions = selectedBus?.dropping_points || [];

    return (
      <div className="space-y-6 text-black font-sans text-left max-w-4xl mx-auto">
        <div className="bg-slate-900 border-4 border-black p-4 rounded-3xl text-white flex justify-between items-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <div>
            <h4 className="font-black text-sm uppercase">{selectedBus?.operator_name} - Seat Layout</h4>
            <p className="text-[10px] text-slate-400 mt-0.5">{selectedBus?.bus_type} | base fare: ₹{selectedBus?.price}</p>
          </div>
          <button 
            onClick={() => setViewMode('results')}
            className="bg-white hover:bg-slate-100 text-black border-2 border-black font-black px-3.5 py-1.5 rounded-xl text-[10px] uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all cursor-pointer"
          >
            Back to Results
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Points selection sidebar */}
          <div className="md:col-span-1 space-y-4">
            {/* Boarding point selection */}
            <div className="bg-white border-3 border-black p-4 rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] space-y-3">
              <span className="text-xs font-black uppercase text-blue-600 block border-b border-slate-100 pb-1">1. Boarding Point</span>
              <div className="space-y-2">
                {boardingOptions.map((opt: any) => (
                  <div 
                    key={opt.name}
                    onClick={() => setBoardingPoint(opt)}
                    className={`p-2 border-2 rounded-xl text-xs cursor-pointer transition-colors ${
                      boardingPoint?.name === opt.name 
                        ? 'bg-blue-50 border-blue-500 font-extrabold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]' 
                        : 'border-black bg-white hover:bg-slate-50 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]'
                    }`}
                  >
                    <div className="flex justify-between font-black text-slate-900">
                      <span>{opt.time}</span>
                      <span>{opt.name.split(' ')[1] || opt.name}</span>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1 font-bold">{opt.address}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Dropping point selection */}
            <div className="bg-white border-3 border-black p-4 rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] space-y-3">
              <span className="text-xs font-black uppercase text-blue-600 block border-b border-slate-100 pb-1">2. Dropping Point</span>
              <div className="space-y-2">
                {droppingOptions.map((opt: any) => (
                  <div 
                    key={opt.name}
                    onClick={() => setDroppingPoint(opt)}
                    className={`p-2 border-2 rounded-xl text-xs cursor-pointer transition-colors ${
                      droppingPoint?.name === opt.name 
                        ? 'bg-blue-50 border-blue-500 font-extrabold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]' 
                        : 'border-black bg-white hover:bg-slate-50 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]'
                    }`}
                  >
                    <div className="flex justify-between font-black text-slate-900">
                      <span>{opt.time}</span>
                      <span>{opt.name.split(' ')[1] || opt.name}</span>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1 font-bold">{opt.address}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Seat Layout grid */}
          <div className="md:col-span-2 space-y-4">
            <div className="bg-white border-4 border-black p-6 rounded-3xl shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] text-center space-y-6">
              <div className="flex justify-between items-center text-xs font-bold bg-slate-100 px-3 py-2 border-2 border-black rounded-lg text-slate-500">
                <span>Front (Driver Side)</span>
                <span className="flex items-center gap-1">🚪 Door</span>
              </div>

              {/* stacked layout (Sleeper Decks or Seater Grid) */}
              <div className="flex flex-col sm:flex-row gap-8 justify-center items-start">
                
                {/* Lower Deck / Seater Layout */}
                <div className="space-y-2 shrink-0 mx-auto">
                  <span className="text-[10px] font-black bg-slate-200 border-2 border-black px-2 py-0.5 rounded uppercase">
                    {isSleeper ? "Lower Deck" : "Seat Layout"}
                  </span>
                  
                  <div className="grid grid-cols-4 gap-2.5 p-4 border-3 border-black rounded-2xl bg-slate-50 max-w-[200px]">
                    {lowerDeck.map((seat: any) => {
                      const selected = selectedSeats.includes(seat.seat_number);
                      return (
                        <div 
                          key={seat.seat_number}
                          onClick={() => toggleSeat(seat)}
                          className={`border-2 border-black ${isSleeper ? 'h-14 w-8 rounded-lg' : 'h-8 w-8 rounded'} flex items-center justify-center font-black text-[10px] cursor-pointer transition-all shadow-[1.5px_1.5px_0px_0px_rgba(0,0,0,1)] ${
                            seat.is_occupied 
                              ? 'bg-slate-300 text-slate-500 border-slate-400 cursor-not-allowed shadow-none' 
                              : selected 
                              ? 'bg-yellow-300 translate-y-[1px]' 
                              : 'bg-white hover:bg-slate-100'
                          }`}
                          title={`Seat: ${seat.seat_number} | Price: ₹${seat.price}`}
                        >
                          {seat.seat_number}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Upper Deck Layout (if sleeper) */}
                {isSleeper && upperDeck.length > 0 && (
                  <div className="space-y-2 shrink-0 mx-auto">
                    <span className="text-[10px] font-black bg-slate-200 border-2 border-black px-2 py-0.5 rounded uppercase">
                      Upper Deck
                    </span>
                    
                    <div className="grid grid-cols-4 gap-2.5 p-4 border-3 border-black rounded-2xl bg-slate-50 max-w-[200px]">
                      {upperDeck.map((seat: any) => {
                        const selected = selectedSeats.includes(seat.seat_number);
                        return (
                          <div 
                            key={seat.seat_number}
                            onClick={() => toggleSeat(seat)}
                            className={`border-2 border-black h-14 w-8 rounded-lg flex items-center justify-center font-black text-[10px] cursor-pointer transition-all shadow-[1.5px_1.5px_0px_0px_rgba(0,0,0,1)] ${
                              seat.is_occupied 
                                ? 'bg-slate-300 text-slate-500 border-slate-400 cursor-not-allowed shadow-none' 
                                : selected 
                                ? 'bg-yellow-300 translate-y-[1px]' 
                                : 'bg-white hover:bg-slate-100'
                            }`}
                            title={`Seat: ${seat.seat_number} | Price: ₹${seat.price}`}
                          >
                            {seat.seat_number}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Legend */}
              <div className="flex justify-center gap-4 text-[10px] font-bold text-slate-600 border-t border-slate-100 pt-3">
                <div className="flex items-center gap-1">
                  <div className="w-3.5 h-3.5 bg-white border border-black rounded shadow-[0.5px_0.5px_0px_0px_rgba(0,0,0,1)]" />
                  <span>Available</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3.5 h-3.5 bg-yellow-300 border border-black rounded shadow-[0.5px_0.5px_0px_0px_rgba(0,0,0,1)]" />
                  <span>Selected</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3.5 h-3.5 bg-slate-300 border border-slate-450 rounded" />
                  <span>Booked</span>
                </div>
              </div>

              {/* Action summary bar */}
              <div className="border-t-3 border-black pt-4 flex flex-col sm:flex-row justify-between items-center gap-3">
                <div className="text-left">
                  <span className="text-[10px] text-slate-500 font-extrabold uppercase block">Selected seats ({selectedSeats.length})</span>
                  <strong className="text-black font-extrabold text-sm">{selectedSeats.join(', ') || 'No seats selected'}</strong>
                </div>
                <div className="text-right">
                  <span className="text-[9px] text-slate-500 font-extrabold uppercase block">Total fare</span>
                  <strong className="text-red-500 text-xl font-black">₹{subtotal.toLocaleString()}</strong>
                </div>
              </div>

              <button 
                onClick={handleConfirmSeats}
                className="w-full bg-yellow-300 hover:bg-yellow-400 text-black border-3 border-black font-black py-3 rounded-2xl text-xs uppercase shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
              >
                Proceed to Passenger Details
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (viewMode === 'passengers') {
    return (
      <div className="space-y-6 text-black font-sans text-left max-w-4xl mx-auto">
        <div className="bg-slate-900 border-4 border-black p-4 rounded-3xl text-white flex justify-between items-center shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <div>
            <h4 className="font-black text-sm uppercase">Passenger details</h4>
            <p className="text-[10px] text-slate-400 mt-0.5">{selectedBus?.operator_name} | {fromCity} ➔ {toCity}</p>
          </div>
          <button 
            onClick={() => setViewMode('seats')}
            className="bg-white hover:bg-slate-100 text-black border-2 border-black font-black px-3.5 py-1.5 rounded-xl text-[10px] uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all cursor-pointer"
          >
            Back to Seats
          </button>
        </div>

        {errors && (
          <div className="bg-red-50 border-2 border-red-500 text-red-700 text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1.5">
            <Info size={14} className="text-red-500" />
            {errors}
          </div>
        )}

        <form onSubmit={handleFinalSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Passenger Input forms */}
          <div className="md:col-span-2 space-y-4">
            <div className="bg-white border-3 border-black p-5 rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] space-y-5">
              <h4 className="text-xs font-black uppercase tracking-wider text-blue-600 border-b border-slate-150 pb-2">Passenger Information</h4>
              
              {passengersList.map((passenger, idx) => (
                 <div key={idx} className="space-y-3 p-3 border-2 border-slate-200 rounded-2xl bg-slate-50/50">
                  <span className="text-[10px] font-black text-slate-500 uppercase block">Traveler {idx + 1} (Seat {selectedSeats[idx]})</span>

                  {/* Saved Passengers Selection Panel for Buses */}
                  {savedPassengers.length > 0 && (
                    <div className="mb-2 p-1.5 bg-[#eae5d9] border border-dashed border-black rounded-lg text-[10px]">
                      <span className="text-[8px] uppercase font-black text-slate-700 block mb-0.5">
                        👤 Select Saved Passenger
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {savedPassengers.map(sp => {
                          const isAlreadySelected = passengersList.some((p, i) => i !== idx && p.name.toLowerCase() === sp.full_name.toLowerCase());
                          return (
                            <button
                              key={sp.id}
                              type="button"
                              disabled={isAlreadySelected}
                              onClick={() => {
                                let calcAge = "30";
                                if (sp.date_of_birth) {
                                  calcAge = String(new Date().getFullYear() - new Date(sp.date_of_birth).getFullYear());
                                } else if (sp.age) {
                                  calcAge = String(sp.age);
                                }
                                setPassengersList(prev => prev.map((item, i) => i === idx ? {
                                  ...item,
                                  name: sp.full_name,
                                  age: calcAge,
                                  gender: sp.gender || "Male"
                                } : item));
                                
                                // Mark used
                                if (token) {
                                  fetch(`${API_URL}/passengers/${sp.id}/use`, {
                                    method: "POST",
                                    headers: { "Authorization": `Bearer ${token}` }
                                  }).catch(() => {});
                                }
                              }}
                              className={`px-1.5 py-0.5 rounded text-[8px] font-black border border-black transition-all ${
                                isAlreadySelected
                                  ? "bg-slate-200 text-slate-400 border-slate-300 cursor-not-allowed opacity-50"
                                  : "bg-white hover:bg-yellow-200 cursor-pointer"
                              }`}
                            >
                              {sp.full_name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] text-slate-400 font-extrabold uppercase">Full Name</label>
                      <input 
                        type="text" 
                        value={passenger.name}
                        placeholder="Name as in Govt ID"
                        onChange={(e) => {
                          const val = e.target.value;
                          setPassengersList(prev => prev.map((item, i) => i === idx ? { ...item, name: val } : item));
                        }}
                        className="w-full bg-white border-2 border-black rounded-xl p-2 text-xs font-extrabold outline-none"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] text-slate-400 font-extrabold uppercase">Age</label>
                      <input 
                        type="number" 
                        value={passenger.age}
                        placeholder="Age"
                        onChange={(e) => {
                          const val = e.target.value;
                          setPassengersList(prev => prev.map((item, i) => i === idx ? { ...item, age: val } : item));
                        }}
                        className="w-full bg-white border-2 border-black rounded-xl p-2 text-xs font-extrabold outline-none"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] text-slate-400 font-extrabold uppercase">Gender</label>
                      <select 
                        value={passenger.gender}
                        onChange={(e) => {
                          const val = e.target.value;
                          setPassengersList(prev => prev.map((item, i) => i === idx ? { ...item, gender: val } : item));
                        }}
                        className="w-full bg-white border-2 border-black rounded-xl p-2 text-xs font-extrabold outline-none"
                      >
                        <option>Male</option>
                        <option>Female</option>
                        <option>Other</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Contact Information */}
            <div className="bg-white border-3 border-black p-5 rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] space-y-4">
              <h4 className="text-xs font-black uppercase tracking-wider text-blue-600 border-b border-slate-150 pb-2">Contact Details</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1 text-xs">
                  <label className="text-[9px] text-slate-400 font-extrabold uppercase">Email Address</label>
                  <input 
                    type="email" 
                    value={contactEmail} 
                    onChange={(e) => setContactEmail(e.target.value)}
                    className="w-full bg-white border-2 border-black rounded-xl p-2 text-xs font-extrabold outline-none" 
                    required 
                  />
                </div>
                <div className="space-y-1 text-xs">
                  <label className="text-[9px] text-slate-400 font-extrabold uppercase">Mobile Number</label>
                  <input 
                    type="tel" 
                    value={contactPhone} 
                    onChange={(e) => setContactPhone(e.target.value)}
                    className="w-full bg-white border-2 border-black rounded-xl p-2 text-xs font-extrabold outline-none" 
                    required 
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Checkout Breakdown right column */}
          <div className="md:col-span-1 space-y-4 text-xs">
            {/* Promo code card */}
            <div className="bg-white border-3 border-black p-4 rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] space-y-3">
              <span className="text-[10px] text-slate-500 font-black uppercase tracking-wider block">Apply Promo Coupon</span>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={promoCode} 
                  placeholder="e.g. GHUMNE1000"
                  onChange={(e) => setPromoCode(e.target.value)}
                  className="bg-white border-2 border-black rounded-xl px-2 py-1.5 text-xs font-extrabold uppercase outline-none w-full"
                />
                <button 
                  type="button" 
                  onClick={handleApplyPromo}
                  className="bg-yellow-300 hover:bg-yellow-400 border-2 border-black font-black px-3 rounded-xl uppercase text-[10px]"
                >
                  Apply
                </button>
              </div>
              {promoApplied && (
                <div className="text-[10px] text-emerald-600 font-black uppercase">✔ Coupon applied: ₹{promoDiscount} saved!</div>
              )}
            </div>

            {/* Wallet Toggle card */}
            <div className="bg-white border-3 border-black p-4 rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] space-y-2">
              <label className="flex items-center justify-between cursor-pointer font-black">
                <span className="text-[10px] text-slate-500 uppercase">Use Ghumne Chale Wallet</span>
                <input 
                  type="checkbox"
                  checked={walletApplied}
                  onChange={(e) => setWalletApplied(e.target.checked)}
                  className="accent-yellow-400 w-4 h-4"
                />
              </label>
              <div className="text-[10px] text-slate-400 font-bold">Available balance: ₹{walletBalance.toLocaleString()}</div>
            </div>

            {/* Fare Breakdown Details */}
            <div className="bg-white border-4 border-black p-4 rounded-3xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] space-y-3">
              <h4 className="text-[10px] font-black uppercase text-slate-500 border-b border-slate-100 pb-1.5 flex items-center gap-1"><Tag size={12} /> Fare Summary</h4>
              
              <div className="space-y-1.5 font-bold text-slate-700">
                <div className="flex justify-between">
                  <span>Base fare ({passengerCount} Pax)</span>
                  <span>₹{baseTotal.toLocaleString()}</span>
                </div>
                {seatSurcharge > 0 && (
                  <div className="flex justify-between text-blue-600">
                    <span>Seat Surcharges</span>
                    <span>+₹{seatSurcharge.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Tax (5% GST)</span>
                  <span>₹{gstTax.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Convenience Fee</span>
                  <span>₹{convenienceFee.toLocaleString()}</span>
                </div>
                {promoApplied && (
                  <div className="flex justify-between text-emerald-600">
                    <span>Coupon Discount</span>
                    <span>-₹{promoDiscount.toLocaleString()}</span>
                  </div>
                )}
                {walletApplied && walletAmount > 0 && (
                  <div className="flex justify-between text-indigo-600">
                    <span>Wallet balance used</span>
                    <span>-₹{walletAmount.toLocaleString()}</span>
                  </div>
                )}
              </div>

              <div className="border-t-2 border-black pt-2 flex justify-between font-black text-slate-900 text-sm">
                <span>Total Payable</span>
                <span className="text-red-500">₹{payableAmount.toLocaleString()}</span>
              </div>

              <button 
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-yellow-300 hover:bg-yellow-400 text-black border-3 border-black font-black py-3 rounded-2xl text-[10px] uppercase shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:translate-y-0.5 active:shadow-none transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {isSubmitting ? (
                  <>Processing hold...</>
                ) : (
                  <>
                    <ShieldCheck size={14} strokeWidth={3} /> Lock Ticket & Pay
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    );
  }

  return null;
}

const CAB_POPULAR_HUBS = [
  "Indira Gandhi International Airport (DEL), Terminal 3",
  "Indira Gandhi International Airport (DEL), Terminal 1",
  "Chhatrapati Shivaji Maharaj International Airport (BOM), Terminal 2",
  "Kempegowda International Airport (BLR), Bengaluru",
  "Goa International Airport (GOI), Dabolim",
  "Manohar International Airport (GOX), Mopa Goa",
  "Jaipur International Airport (JAI), Sanganer",
  "New Delhi Railway Station (NDLS), Paharganj",
  "Chhatrapati Shivaji Maharaj Terminus (CSMT), Mumbai",
  "Connaught Place, Central Delhi",
  "Cyber City, DLF Phase 2, Gurugram",
  "Bandra Kurla Complex (BKC), Mumbai",
  "Koramangala 4th Block, Bengaluru",
  "Panaji City Center, Goa",
  "Baga Beach / Calangute, North Goa",
  "Taj Mahal West Gate, Agra",
  "Hawa Mahal, Pink City, Jaipur"
];

function CabsSearchForm({ onBook, onDetailClick }: { onBook: (data: any) => void, onDetailClick: (vert: string, item: any) => void }) {
  const [tripType, setTripType] = useState<'one_way' | 'round_trip' | 'airport_transfer' | 'hourly'>('one_way');
  const [pickup, setPickup] = useState("Indira Gandhi International Airport (DEL), Terminal 3");
  const [drop, setDrop] = useState("Connaught Place, Central Delhi");
  const [showPickupSuggestions, setShowPickupSuggestions] = useState(false);
  const [showDropSuggestions, setShowDropSuggestions] = useState(false);
  
  // Date and time
  const [pickupDate, setPickupDate] = useState("2026-12-15");
  const [pickupTime, setPickupTime] = useState("10:30");
  const [returnDate, setReturnDate] = useState("2026-12-16");
  const [returnTime, setReturnTime] = useState("18:00");
  
  // Passenger & luggage counters
  const [passengers, setPassengers] = useState(1);
  const [luggage, setLuggage] = useState(1);
  
  // Airport transfer specific
  const [airportMode, setAirportMode] = useState<'to_airport' | 'from_airport'>('from_airport');
  const [flightNumber, setFlightNumber] = useState("6E-2045");
  const [terminal, setTerminal] = useState("Terminal 3 (T3)");
  
  // Hourly package
  const [hourlyPackage, setHourlyPackage] = useState<number>(4);
  
  // Filters & sorting
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [fuelFilter, setFuelFilter] = useState("all");
  const [transmissionFilter, setTransmissionFilter] = useState("all");
  const [acOnly, setAcOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'recommended' | 'price_asc' | 'rating_desc' | 'capacity_desc' | 'eta_asc'>('recommended');
  
  // Results & UI states
  const [results, setResults] = useState<any[]>([]);
  const [tripDistance, setTripDistance] = useState<number>(24.5);
  const [tripDuration, setTripDuration] = useState<number>(45);
  const [loading, setLoading] = useTabLoading('cabs');
  const [expandedFareIdx, setExpandedFareIdx] = useState<number | null>(null);
  const [selectedVehicleModal, setSelectedVehicleModal] = useState<any | null>(null);
  
  // Multi-passenger booking drawer / modal
  const [bookingVehicle, setBookingVehicle] = useState<any | null>(null);
  const [passengersList, setPassengersList] = useState<Array<{ name: string; age: number; phone: string; is_primary: boolean }>>([
    { name: "Aditya Sharma", age: 32, phone: "+91 98765 43210", is_primary: true }
  ]);
  const [exactPickup, setExactPickup] = useState("");
  const [exactDrop, setExactDrop] = useState("");
  const [specialNotes, setSpecialNotes] = useState("");
  const [childSeatRequested, setChildSeatRequested] = useState(false);
  const [meetGreetRequested, setMeetGreetRequested] = useState(false);

  // Sync passenger count with passenger list
  const updatePassengerCount = (newCount: number) => {
    const validCount = Math.max(1, Math.min(10, newCount));
    setPassengers(validCount);
    setPassengersList(prev => {
      const current = [...prev];
      if (validCount > current.length) {
        for (let i = current.length; i < validCount; i++) {
          current.push({ name: `Passenger ${i + 1}`, age: 28, phone: "", is_primary: false });
        }
      } else if (validCount < current.length) {
        return current.slice(0, validCount);
      }
      return current;
    });
  };

  const handleSwapLocations = () => {
    const temp = pickup;
    setPickup(drop);
    setDrop(temp);
  };

  const handleSearch = () => {
    if (!pickup.trim()) {
      alert("Please enter a pickup address.");
      return;
    }
    if (tripType !== 'hourly' && !drop.trim()) {
      alert("Please enter a drop-off address.");
      return;
    }
    if (tripType !== 'hourly' && pickup.trim().toLowerCase() === drop.trim().toLowerCase()) {
      alert("Pickup and drop-off locations cannot be identical.");
      return;
    }

    setLoading(true);
    setResults([]);
    setExpandedFareIdx(null);

    const payload = {
      pickup_address: pickup,
      drop_address: tripType === 'hourly' ? `Local Rental (${hourlyPackage}h Package)` : drop,
      trip_type: tripType,
      pickup_date: pickupDate,
      pickup_time: pickupTime,
      return_date: returnDate,
      return_time: returnTime,
      passengers: passengers,
      luggage_count: luggage,
      hourly_duration: hourlyPackage,
      flight_number: tripType === 'airport_transfer' ? flightNumber : undefined,
      terminal: tripType === 'airport_transfer' ? terminal : undefined,
      category: categoryFilter !== 'all' ? categoryFilter : undefined
    };

    fetch(`${API_URL}/cabs/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
      .then(res => res.json())
      .then(data => {
        setLoading(false);
        if (data && Array.isArray(data.options || data.results)) {
          const list = data.options || data.results;
          setResults(list);
          if (data.distance_km) setTripDistance(data.distance_km);
          if (data.duration_mins) setTripDuration(data.duration_mins);
        }
      })
      .catch(() => {
        // Fallback to GET search endpoint
        fetch(`${API_URL}/search?vertical=cabs&origin=${encodeURIComponent(pickup)}&destination=${encodeURIComponent(drop)}&passengers=${passengers}`)
          .then(res => res.json())
          .then(data => {
            setLoading(false);
            if (data && Array.isArray(data.results)) {
              setResults(data.results);
            }
          })
          .catch(() => setLoading(false));
      });
  };

  // Filtered & Sorted Results
  const filteredVehicles = results.filter(vh => {
    if (categoryFilter !== 'all' && (vh.category || vh.cab_type || vh.type).toLowerCase() !== categoryFilter.toLowerCase()) {
      return false;
    }
    if (fuelFilter !== 'all' && (vh.fuel_type || '').toLowerCase() !== fuelFilter.toLowerCase()) {
      return false;
    }
    if (transmissionFilter !== 'all' && (vh.transmission || '').toLowerCase() !== transmissionFilter.toLowerCase()) {
      return false;
    }
    if (acOnly && vh.ac_available === false) {
      return false;
    }
    if (vh.seating_capacity && vh.seating_capacity < passengers) {
      return false;
    }
    if (luggage > 0 && vh.luggage_capacity && vh.luggage_capacity < luggage) {
      return false;
    }
    return true;
  }).sort((a, b) => {
    if (sortBy === 'price_asc') return (a.fare || a.price) - (b.fare || b.price);
    if (sortBy === 'rating_desc') return (b.rating || 0) - (a.rating || 0);
    if (sortBy === 'capacity_desc') return (b.seating_capacity || 4) - (a.seating_capacity || 4);
    if (sortBy === 'eta_asc') return (a.eta_mins || a.eta_minutes || 5) - (b.eta_mins || b.eta_minutes || 5);
    return 0; // recommended retains verified provider sorting
  });

  const [bookingDrawerStep, setBookingDrawerStep] = useState<'details' | 'review'>('details');

  const handleStartBooking = (v: any) => {
    setBookingVehicle(v);
    setBookingDrawerStep('details');
    setExactPickup(pickup);
    setExactDrop(drop);
  };

  const handleProceedToReview = () => {
    const primary = passengersList[0];
    if (!primary || !primary.name.trim()) {
      alert("Please enter the primary passenger's full name.");
      return;
    }
    if (!primary.phone.trim()) {
      alert("Please enter a valid mobile contact number.");
      return;
    }
    setBookingDrawerStep('review');
  };

  const handleConfirmAndProceed = () => {
    if (!bookingVehicle) return;

    const totalAmount = bookingVehicle.fare || bookingVehicle.price;
    const finalPickup = exactPickup.trim() || pickup;
    const finalDrop = tripType === 'hourly' ? `Local City Package (${hourlyPackage} hrs)` : (exactDrop.trim() || drop);

    onBook({
      vertical: "cabs",
      amount: totalAmount,
      currency: "INR",
      details: {
        provider_name: bookingVehicle.provider || "Ghumne Chale Fleet",
        cab_type: bookingVehicle.category || bookingVehicle.cab_type || bookingVehicle.type || "Sedan",
        vehicle_name: bookingVehicle.display_name || `${bookingVehicle.brand} ${bookingVehicle.model}`,
        brand: bookingVehicle.brand,
        model: bookingVehicle.model,
        image: getVehicleImage(bookingVehicle),
        image_key: bookingVehicle.image_key || (bookingVehicle.model ? bookingVehicle.model.toLowerCase().replace(/\s+/g, '-') : 'default-car'),
        image_url: getVehicleImage(bookingVehicle),
        thumbnail_url: getVehicleImage(bookingVehicle),
        plate_number: bookingVehicle.plate_number,
        pickup_address: finalPickup,
        drop_address: finalDrop,
        pickup_time: `${pickupDate}T${pickupTime}:00`,
        return_time: tripType === 'round_trip' ? `${returnDate}T${returnTime}:00` : undefined,
        trip_type: tripType,
        passengers_count: passengers,
        passengers: passengersList,
        luggage_count: luggage,
        flight_number: tripType === 'airport_transfer' ? flightNumber : undefined,
        terminal: tripType === 'airport_transfer' ? terminal : undefined,
        hourly_duration: tripType === 'hourly' ? hourlyPackage : undefined,
        distance_km: tripDistance,
        estimated_duration_mins: tripDuration,
        special_instructions: [
          specialNotes,
          childSeatRequested ? "Child seat requested" : "",
          meetGreetRequested ? "Airport Meet & Greet requested" : ""
        ].filter(Boolean).join(" | "),
        driver_name: bookingVehicle.driver_name || "Verified Chauffeur (Assigned 30m prior)",
        driver_phone: "+91 98765 43210"
      },
      title: `${bookingVehicle.display_name || bookingVehicle.provider} (${bookingVehicle.category || bookingVehicle.cab_type})`,
      subtitle: `${finalPickup} ➔ ${finalDrop}`
    });

    setBookingVehicle(null);
  };

  return (
    <div className="space-y-6 text-black font-sans">
      {/* ── TRIP TYPE TABS ────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 p-1.5 bg-white rounded-2xl border-3 border-black w-fit max-w-full shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        {[
          { id: 'one_way', label: 'One Way Cab', icon: '🚕' },
          { id: 'round_trip', label: 'Round Trip / Outstation', icon: '🔄' },
          { id: 'airport_transfer', label: 'Airport Transfer', icon: '✈️' },
          { id: 'hourly', label: 'Hourly / Local Rental', icon: '⏱️' }
        ].map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setTripType(tab.id as any)}
            className={`px-4 py-2 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer border-2 border-black ${
              tripType === tab.id
                ? 'bg-yellow-400 text-black font-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                : 'text-slate-700 hover:text-black bg-slate-50 hover:bg-slate-100'
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ── AIRPORT TRANSFER SUB-TOGGLE ─────────────────────────────────── */}
      {tripType === 'airport_transfer' && (
        <div className="flex items-center gap-3 bg-white p-3 rounded-xl border-3 border-black text-xs shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <span className="text-slate-700 font-bold uppercase text-[10px]">Airport Mode:</span>
          <button
            type="button"
            onClick={() => {
              setAirportMode('from_airport');
              setPickup("Indira Gandhi International Airport (DEL), Terminal 3");
              setDrop("Connaught Place, Central Delhi");
            }}
            className={`px-3 py-1.5 rounded-lg font-bold border-2 border-black transition-all ${
              airportMode === 'from_airport' ? 'bg-yellow-400 text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]' : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
            }`}
          >
            🛬 Pickup from Airport
          </button>
          <button
            type="button"
            onClick={() => {
              setAirportMode('to_airport');
              setPickup("Connaught Place, Central Delhi");
              setDrop("Indira Gandhi International Airport (DEL), Terminal 3");
            }}
            className={`px-3 py-1.5 rounded-lg font-bold border-2 border-black transition-all ${
              airportMode === 'to_airport' ? 'bg-yellow-400 text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]' : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
            }`}
          >
            🛫 Drop to Airport
          </button>
        </div>
      )}

      {/* ── SEARCH FORM BAR ────────────────────────────────────────────── */}
      <div className="bg-white p-5 rounded-2xl border-3 border-black space-y-4 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          
          {/* Pickup Address */}
          <div className="md:col-span-4 space-y-1.5 relative">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
              📍 Pickup Location
            </span>
            <input 
              type="text" 
              value={pickup} 
              placeholder="Enter Airport, Railway Station, Hotel, or Landmark"
              onChange={(e) => {
                setPickup(e.target.value);
                setShowPickupSuggestions(true);
              }} 
              onFocus={() => setShowPickupSuggestions(true)}
              onBlur={() => setTimeout(() => setShowPickupSuggestions(false), 250)}
              className="w-full bg-white border-2 border-black rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-bold outline-none focus:bg-yellow-50/50" 
            />
            {showPickupSuggestions && (
              <div className="absolute left-0 right-0 top-[68px] bg-white border-2 border-black rounded-xl shadow-2xl z-50 overflow-y-auto max-h-56 text-black font-sans">
                <div className="p-2 bg-slate-100 border-b border-slate-200 text-[10px] font-black uppercase text-slate-500">
                  Popular Hubs & Landmarks
                </div>
                {CAB_POPULAR_HUBS.filter(dest => dest.toLowerCase().includes(pickup.toLowerCase()))
                  .map((dest, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onMouseDown={() => {
                        setPickup(dest);
                        setShowPickupSuggestions(false);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-amber-100 transition-colors font-bold text-xs border-b border-slate-100 last:border-0 cursor-pointer flex items-center gap-2"
                    >
                      <span>📍</span> {dest}
                    </button>
                  ))}
              </div>
            )}
          </div>

          {/* Swap Button */}
          {tripType !== 'hourly' && (
            <div className="md:col-span-1 flex items-center justify-center">
              <button
                type="button"
                onClick={handleSwapLocations}
                title="Swap Pickup and Drop Locations"
                className="w-9 h-9 rounded-full bg-yellow-400 hover:bg-yellow-300 text-black border-2 border-black flex items-center justify-center font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] cursor-pointer active:translate-y-px"
              >
                ⇄
              </button>
            </div>
          )}

          {/* Drop Address (or Hourly Duration Selector) */}
          {tripType === 'hourly' ? (
            <div className="md:col-span-4 space-y-1.5">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                ⏱️ Package Duration
              </span>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { hours: 4, label: '4h / 40km' },
                  { hours: 8, label: '8h / 80km' },
                  { hours: 12, label: '12h / 120km' }
                ].map(pkg => (
                  <button
                    key={pkg.hours}
                    type="button"
                    onClick={() => setHourlyPackage(pkg.hours)}
                    className={`py-2 px-2 rounded-xl text-xs font-bold transition-all border-2 border-black ${
                      hourlyPackage === pkg.hours
                        ? 'bg-yellow-400 text-black font-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]'
                        : 'bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {pkg.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="md:col-span-4 space-y-1.5 relative">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
                🏁 Destination / Drop Location
              </span>
              <input 
                type="text" 
                value={drop} 
                placeholder="Enter Hotel, Office, or Destination City"
                onChange={(e) => {
                  setDrop(e.target.value);
                  setShowDropSuggestions(true);
                }} 
                onFocus={() => setShowDropSuggestions(true)}
                onBlur={() => setTimeout(() => setShowDropSuggestions(false), 250)}
                className="w-full bg-white border-2 border-black rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-bold outline-none focus:bg-yellow-50/50" 
              />
              {showDropSuggestions && (
                <div className="absolute left-0 right-0 top-[68px] bg-white border-2 border-black rounded-xl shadow-2xl z-50 overflow-y-auto max-h-56 text-black font-sans">
                  <div className="p-2 bg-slate-100 border-b border-slate-200 text-[10px] font-black uppercase text-slate-500">
                    Popular Destinations
                  </div>
                  {CAB_POPULAR_HUBS.filter(dest => dest.toLowerCase().includes(drop.toLowerCase()))
                    .map((dest, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onMouseDown={() => {
                          setDrop(dest);
                          setShowDropSuggestions(false);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-amber-100 transition-colors font-bold text-xs border-b border-slate-100 last:border-0 cursor-pointer flex items-center gap-2"
                      >
                        <span>🏁</span> {dest}
                      </button>
                    ))}
                </div>
              )}
            </div>
          )}

          {/* Search Button */}
          <div className="md:col-span-3">
            <button 
              onClick={handleSearch} 
              className="w-full bg-[var(--color-gold)] hover:bg-[#d6b35d] text-[var(--color-obsidian)] font-black text-xs py-3 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider border-none shadow-lg"
            >
              <Search size={14} /> Search Available Cabs
            </button>
          </div>
        </div>

        {/* ── SECOND ROW: DATES, PASSENGERS, LUGGAGE, FLIGHT INFO ───────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-3 border-t border-slate-800/80">
          
          {/* Pickup Date & Time */}
          <div className="space-y-1">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">📅 Pickup Date & Time</span>
            <div className="grid grid-cols-2 gap-1.5">
              <input 
                type="date" 
                value={pickupDate}
                onChange={(e) => setPickupDate(e.target.value)}
                className="w-full bg-white border-2 border-black rounded-xl px-2 py-1.5 text-xs text-slate-900 font-bold outline-none focus:bg-yellow-50/50 h-[46px]" 
              />
              <input 
                type="time" 
                value={pickupTime}
                onChange={(e) => setPickupTime(e.target.value)}
                className="w-full bg-white border-2 border-black rounded-xl px-2 py-1.5 text-xs text-slate-900 font-bold outline-none focus:bg-yellow-50/50 h-[46px]" 
              />
            </div>
          </div>

          {/* Return Date & Time (for Round Trip) or Airport Info */}
          {tripType === 'round_trip' ? (
            <div className="space-y-1">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">🔄 Return Date & Time</span>
              <div className="grid grid-cols-2 gap-1.5">
                <input 
                  type="date" 
                  value={returnDate}
                  onChange={(e) => setReturnDate(e.target.value)}
                  className="w-full bg-white border-2 border-black rounded-xl px-2 py-1.5 text-xs text-slate-900 font-bold outline-none focus:bg-yellow-50/50 h-[46px]" 
                />
                <input 
                  type="time" 
                  value={returnTime}
                  onChange={(e) => setReturnTime(e.target.value)}
                  className="w-full bg-white border-2 border-black rounded-xl px-2 py-1.5 text-xs text-slate-900 font-bold outline-none focus:bg-yellow-50/50 h-[46px]" 
                />
              </div>
            </div>
          ) : tripType === 'airport_transfer' ? (
            <div className="space-y-1">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">✈️ Flight & Terminal</span>
              <div className="grid grid-cols-2 gap-1.5">
                <input 
                  type="text" 
                  value={flightNumber}
                  placeholder="Flight No."
                  onChange={(e) => setFlightNumber(e.target.value)}
                  className="w-full bg-[#0e1628] border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white font-bold outline-none" 
                />
                <select 
                  value={terminal}
                  onChange={(e) => setTerminal(e.target.value)}
                  className="w-full bg-[#0e1628] border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white font-bold outline-none"
                >
                  <option value="Terminal 3 (T3)">T3 (Intl/Dom)</option>
                  <option value="Terminal 2 (T2)">T2 (Domestic)</option>
                  <option value="Terminal 1 (T1)">T1 (Domestic)</option>
                </select>
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">🚗 Service Tier</span>
              <div className="w-full bg-white border-3 border-black rounded-xl px-3 h-[46px] flex items-center justify-between shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                <span className="text-slate-900 text-xs font-black">Verified Chauffeur</span>
                <span className="text-[9px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-lg border border-emerald-300 font-black uppercase tracking-wider">
                  100% On-Time
                </span>
              </div>
            </div>
          )}

          {/* Passengers Stepper */}
          <div className="space-y-1">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">👥 Passengers</span>
            <div className="flex items-center justify-between bg-white border-3 border-black rounded-xl px-3 h-[46px] shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <span className="font-black text-xs text-slate-900">{passengers} {passengers === 1 ? 'Guest' : 'Guests'}</span>
              <div className="flex items-center gap-1.5">
                <button 
                  type="button"
                  onClick={() => updatePassengerCount(passengers - 1)}
                  disabled={passengers <= 1}
                  aria-label="Decrease passenger count"
                  className="w-6 h-6 rounded-full bg-yellow-400 hover:bg-yellow-300 disabled:opacity-30 disabled:hover:bg-yellow-400 text-black border-2 border-black flex items-center justify-center font-black text-sm cursor-pointer active:translate-y-px"
                >
                  -
                </button>
                <button 
                  type="button"
                  onClick={() => updatePassengerCount(passengers + 1)}
                  disabled={passengers >= 10}
                  aria-label="Increase passenger count"
                  className="w-6 h-6 rounded-full bg-yellow-400 hover:bg-yellow-300 disabled:opacity-30 disabled:hover:bg-yellow-400 text-black border-2 border-black flex items-center justify-center font-black text-sm cursor-pointer active:translate-y-px"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* Luggage Stepper */}
          <div className="space-y-1">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">🧳 Luggage Bags</span>
            <div className="flex items-center justify-between bg-white border-3 border-black rounded-xl px-3 h-[46px] shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <span className="font-black text-xs text-slate-900">{luggage} {luggage === 1 ? 'Bag' : 'Bags'}</span>
              <div className="flex items-center gap-1.5">
                <button 
                  type="button"
                  onClick={() => setLuggage(Math.max(0, luggage - 1))}
                  disabled={luggage <= 0}
                  aria-label="Decrease luggage count"
                  className="w-6 h-6 rounded-full bg-yellow-400 hover:bg-yellow-300 disabled:opacity-30 disabled:hover:bg-yellow-400 text-black border-2 border-black flex items-center justify-center font-black text-sm cursor-pointer active:translate-y-px"
                >
                  -
                </button>
                <button 
                  type="button"
                  onClick={() => setLuggage(Math.min(8, luggage + 1))}
                  disabled={luggage >= 8}
                  aria-label="Increase luggage count"
                  className="w-6 h-6 rounded-full bg-yellow-400 hover:bg-yellow-300 disabled:opacity-30 disabled:hover:bg-yellow-400 text-black border-2 border-black flex items-center justify-center font-black text-sm cursor-pointer active:translate-y-px"
                >
                  +
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* ── FILTERS & TRIP METRICS BANNER ───────────────────────────────── */}
      {results.length > 0 && (
        <div className="bg-white border-2 border-black p-4 rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
            <div className="flex items-center gap-3">
              <span className="text-xs bg-amber-200 text-amber-950 font-black px-2.5 py-1 rounded-lg border border-black uppercase">
                Estimated Route: {tripDistance} km · {tripDuration} mins
              </span>
              <span className="text-xs font-bold text-slate-600">
                {filteredVehicles.length} of {results.length} vehicle(s) fit your criteria
              </span>
            </div>

            {/* Sort By Dropdown */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500">Sort by:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-slate-100 border border-black rounded-lg px-2.5 py-1 text-xs font-bold outline-none cursor-pointer"
              >
                <option value="recommended">⚡ Recommended (Best Match)</option>
                <option value="price_asc">💰 Lowest Fare</option>
                <option value="rating_desc">★ Highest Rated (5.0)</option>
                <option value="capacity_desc">👥 Most Spacious</option>
                <option value="eta_asc">⏱️ Fastest Pickup ETA</option>
              </select>
            </div>
          </div>

          {/* Category & Transmission Filter Pills */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-[10px] font-black uppercase text-slate-400 mr-1">Class:</span>
            {[
              { id: 'all', label: 'All Fleet' },
              { id: 'Hatchback', label: 'Hatchback' },
              { id: 'Sedan', label: 'Sedan' },
              { id: 'SUV', label: 'SUV' },
              { id: 'MPV', label: 'MPV / XL' },
              { id: 'Luxury', label: 'Luxury' },
              { id: 'EV', label: 'EV Electric' }
            ].filter(cat => {
              if (cat.id === 'all') return true;
              const availableCategories = new Set(results.map(r => r.category || r.cab_type || r.type));
              return availableCategories.has(cat.id);
            }).map(cat => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategoryFilter(cat.id)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all border ${
                  categoryFilter === cat.id
                    ? 'bg-black text-white border-black shadow-sm'
                    : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
                }`}
              >
                {cat.label}
              </button>
            ))}

            <div className="h-4 w-px bg-slate-300 mx-1 hidden sm:block"></div>

            {/* Transmission Pills */}
            <span className="text-[10px] font-black uppercase text-slate-400 mr-1 hidden sm:inline">Gearbox:</span>
            {[
              { id: 'all', label: 'All' },
              { id: 'Automatic', label: 'Auto ⚙️' },
              { id: 'Manual', label: 'Manual' }
            ].map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTransmissionFilter(t.id)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all border ${
                  transmissionFilter === t.id
                    ? 'bg-slate-800 text-white border-black'
                    : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
                }`}
              >
                {t.label}
              </button>
            ))}

            {/* AC Filter Toggle */}
            <button
              type="button"
              onClick={() => setAcOnly(!acOnly)}
              className={`ml-auto px-3 py-1 rounded-lg text-xs font-bold transition-all border ${
                acOnly ? 'bg-blue-600 text-white border-black' : 'bg-slate-100 text-slate-700 border-slate-300'
              }`}
            >
              ❄️ AC Only
            </button>
          </div>
        </div>
      )}

      {/* ── LOADING STATE ──────────────────────────────────────────────── */}
      {loading && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 text-center space-y-3">
          <div className="w-10 h-10 border-3 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <div className="text-amber-400 font-extrabold text-sm uppercase tracking-wider">
            Dispatching live route matrix & verified fleet...
          </div>
          <p className="text-xs text-slate-400">Comparing real-time tolls, state taxes, and available chauffeurs</p>
        </div>
      )}

      {/* ── EMPTY STATE ────────────────────────────────────────────────── */}
      {!loading && results.length > 0 && filteredVehicles.length === 0 && (
        <div className="bg-amber-50 border-2 border-black rounded-2xl p-8 text-center space-y-2 text-black">
          <h4 className="font-black text-base">No vehicles found matching the selected filter criteria</h4>
          <p className="text-xs text-slate-600">
            Try adjusting passenger count ({passengers}), luggage bags ({luggage}), or resetting category filters.
          </p>
          <button
            type="button"
            onClick={() => {
              setCategoryFilter('all');
              setFuelFilter('all');
              setAcOnly(false);
              setPassengers(1);
              setLuggage(1);
            }}
            className="mt-2 bg-yellow-300 text-black font-extrabold text-xs px-4 py-2 border-2 border-black rounded-lg shadow"
          >
            Reset All Filters
          </button>
        </div>
      )}

      {/* ── VEHICLE FLEET CARDS GRID ───────────────────────────────────── */}
      {!loading && filteredVehicles.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 text-left">
          {filteredVehicles.map((c, i) => {
            const fare = c.fare || c.price;
            const isExpanded = expandedFareIdx === i;
            const bdown = c.breakdown || {
              base_fare: Math.round(fare * 0.4),
              distance_charge: Math.round(fare * 0.4),
              driver_allowance: 100,
              toll_parking_estimate: 40,
              platform_fee: 40,
              gst_tax: Math.round(fare * 0.05)
            };

            return (
              <div 
                key={c.id || i} 
                className="bg-white border-3 border-black rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden flex flex-col justify-between transition-transform hover:-translate-y-0.5"
              >
                {/* Vehicle Image Header */}
                <div className="relative h-44 bg-slate-950 overflow-hidden border-b-2 border-black">
                  <img
                    src={getVehicleImage(c)}
                    alt={c.display_name || c.model || "Cab"}
                    loading="lazy"
                    className="w-full h-full object-cover object-center"
                    onError={(e) => handleVehicleImageError(e, c)}
                  />
                  
                  {/* Category & Status Badges */}
                  <div className="absolute top-2.5 left-2.5 flex flex-wrap gap-1.5">
                    <span className="text-[10px] bg-white text-black font-black px-2 py-0.5 rounded-lg border-2 border-black uppercase tracking-wider shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                      {c.category || c.cab_type || c.type}
                    </span>
                    {c.is_live ? (
                      <span className="text-[10px] bg-emerald-500 text-black font-black px-2 py-0.5 rounded shadow border border-black uppercase tracking-wider animate-pulse">
                        ● LIVE INVENTORY
                      </span>
                    ) : (
                      <span className="text-[10px] bg-white text-slate-700 font-bold px-2 py-0.5 rounded-lg border-2 border-black uppercase tracking-wider shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                        ● DEMO INVENTORY
                      </span>
                    )}
                  </div>

                  {/* ETA Badge */}
                  <div className="absolute bottom-2.5 right-2.5 bg-black/80 backdrop-blur-sm text-amber-300 font-mono text-[10px] font-black px-2 py-0.5 rounded border border-amber-400/50">
                    ⏱️ Pickup in {c.eta_mins || c.eta_minutes || 5} min
                  </div>
                </div>

                {/* Card Content Body */}
                <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                  <div>
                    {/* Model Name & Rating */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-black text-base text-slate-900 leading-tight">
                          {c.display_name || `${c.brand || ''} ${c.model || c.type}`}
                        </h4>
                        <span className="text-xs text-slate-500 font-bold">
                          {c.provider || "Ghumne Chale Chauffeur"} · {c.plate_number || "Commercial Fleet"}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs bg-amber-100 text-amber-900 font-black px-2 py-0.5 rounded border border-amber-300 inline-block">
                          ★ {c.rating || 4.8}
                        </span>
                        <span className="block text-[9px] text-slate-400 font-bold mt-0.5">
                          {c.review_count || 1240} ratings
                        </span>
                      </div>
                    </div>

                    {/* Specification Badges */}
                    <div className="grid grid-cols-3 gap-1.5 mt-3 pt-2 border-t border-slate-100 text-[10px] font-bold text-slate-700">
                      <div className="bg-slate-100 p-1.5 rounded-lg flex items-center gap-1">
                        <span>👥</span>
                        <span>{c.seating_capacity || 4} Seats</span>
                      </div>
                      <div className="bg-slate-100 p-1.5 rounded-lg flex items-center gap-1">
                        <span>🧳</span>
                        <span>{c.luggage_capacity || 2} Bags</span>
                      </div>
                      <div className="bg-slate-100 p-1.5 rounded-lg flex items-center gap-1">
                        <span>❄️</span>
                        <span>{c.ac_available !== false ? 'AC' : 'Non-AC'}</span>
                      </div>
                      <div className="bg-slate-100 p-1.5 rounded-lg flex items-center gap-1">
                        <span>⚙️</span>
                        <span>{c.transmission || 'Manual'}</span>
                      </div>
                      <div className="bg-slate-100 p-1.5 rounded-lg flex items-center gap-1">
                        <span>⛽</span>
                        <span>{c.fuel_type || 'Petrol'}</span>
                      </div>
                      <div className="bg-slate-100 p-1.5 rounded-lg flex items-center gap-1">
                        <span>🛡️</span>
                        <span>Verified</span>
                      </div>
                    </div>

                    {/* Chauffeur info */}
                    <div className="mt-2.5 bg-slate-50 border border-slate-200 p-2 rounded-xl text-[11px] text-slate-600 flex items-center justify-between">
                      <span className="flex items-center gap-1.5 font-bold">
                        <span>👨‍✈️</span> {c.driver_name || "Verified Professional Chauffeur"}
                      </span>
                      <span className="text-[10px] text-emerald-700 font-black">Sanitized Cab</span>
                    </div>

                    {/* Expandable Transparent Fare Breakdown */}
                    <div className="mt-2">
                      <button
                        type="button"
                        onClick={() => setExpandedFareIdx(isExpanded ? null : i)}
                        className="text-[10px] text-blue-600 hover:text-blue-800 font-black flex items-center gap-1 cursor-pointer"
                      >
                        <span>{isExpanded ? '▲ Hide Fare Breakdown' : '▼ View Transparent Fare Breakdown'}</span>
                      </button>

                      {isExpanded && (
                        <div className="mt-2 bg-slate-900 text-white p-3 rounded-xl border border-slate-800 text-[10px] space-y-1 font-mono">
                          <div className="flex justify-between text-slate-300">
                            <span>Base Fare:</span>
                            <span>₹{bdown.base_fare}</span>
                          </div>
                          <div className="flex justify-between text-slate-300">
                            <span>Distance Charge ({tripDistance} km):</span>
                            <span>₹{bdown.distance_charge}</span>
                          </div>
                          <div className="flex justify-between text-slate-300">
                            <span>Driver Allowance:</span>
                            <span>₹{bdown.driver_allowance}</span>
                          </div>
                          <div className="flex justify-between text-slate-300">
                            <span>Toll & Parking Estimate:</span>
                            <span>₹{bdown.toll_parking_estimate}</span>
                          </div>
                          <div className="flex justify-between text-slate-300">
                            <span>Platform Fee:</span>
                            <span>₹{bdown.platform_fee}</span>
                          </div>
                          <div className="flex justify-between text-slate-300">
                            <span>GST Tax (5%):</span>
                            <span>₹{bdown.gst_tax}</span>
                          </div>
                          <div className="flex justify-between pt-1 border-t border-slate-700 text-amber-400 font-bold">
                            <span>Total Estimated:</span>
                            <span>₹{fare.toLocaleString()}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Pricing & Booking Action Bar */}
                  <div className="pt-3 border-t-2 border-slate-100 flex items-center justify-between gap-2">
                    <div>
                      <span className="text-[9px] text-slate-400 uppercase font-black block">Total Payable</span>
                      <div className="flex items-baseline gap-1">
                        <span className="font-black text-red-600 text-lg">₹{fare.toLocaleString()}</span>
                        <span className="text-[10px] text-slate-500 font-bold">all inclusive</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedVehicleModal(c)}
                        className="px-2.5 py-2 text-[10px] font-black uppercase text-slate-700 bg-slate-100 hover:bg-slate-200 border-2 border-black rounded-lg transition-all"
                      >
                        Specs
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStartBooking(c)}
                        className="px-4 py-2 text-xs font-black uppercase bg-yellow-300 hover:bg-yellow-400 text-black border-2 border-black rounded-lg shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all cursor-pointer"
                      >
                        Book Cab
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── VEHICLE DETAILS MODAL ──────────────────────────────────────── */}
      {selectedVehicleModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[999] flex items-center justify-center p-4">
          <div className="bg-white border-3 border-black rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] text-left">
            <div className="flex items-center justify-between border-b-2 border-black pb-3">
              <div>
                <span className="text-[10px] bg-black text-white font-black px-2 py-0.5 rounded uppercase">
                  {selectedVehicleModal.category || selectedVehicleModal.cab_type}
                </span>
                <h3 className="text-xl font-black text-black mt-1">
                  {selectedVehicleModal.display_name || `${selectedVehicleModal.brand} ${selectedVehicleModal.model}`}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedVehicleModal(null)}
                className="w-8 h-8 rounded-full border-2 border-black bg-red-500 text-white font-black flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            <img
              src={getVehicleImage(selectedVehicleModal)}
              alt={selectedVehicleModal.display_name}
              loading="lazy"
              className="w-full h-48 object-cover rounded-xl border-2 border-black"
              onError={(e) => handleVehicleImageError(e, selectedVehicleModal)}
            />

            <div className="grid grid-cols-2 gap-2 text-xs font-bold text-slate-800">
              <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg">
                <span className="text-[10px] text-slate-400 block uppercase">Seating Capacity</span>
                👥 {selectedVehicleModal.seating_capacity || 4} Passengers Max
              </div>
              <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg">
                <span className="text-[10px] text-slate-400 block uppercase">Luggage Capacity</span>
                🧳 {selectedVehicleModal.luggage_capacity || 2} Large Trolley Bags
              </div>
              <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg">
                <span className="text-[10px] text-slate-400 block uppercase">Air Conditioning</span>
                ❄️ {selectedVehicleModal.ac_available !== false ? 'Powerful Climate Control AC' : 'Non-AC'}
              </div>
              <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg">
                <span className="text-[10px] text-slate-400 block uppercase">Transmission & Fuel</span>
                ⚙️ {selectedVehicleModal.transmission} · ⛽ {selectedVehicleModal.fuel_type}
              </div>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-xs space-y-1">
              <h5 className="font-black text-amber-900">🛡️ Ghumne Chale Chauffeur Guarantee</h5>
              <p className="text-amber-800 text-[11px]">
                Free cancellation up to 2 hours before departure. Chauffeur details and live dispatch tracking link are transmitted via SMS/WhatsApp 30 minutes prior to pickup.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSelectedVehicleModal(null)}
                className="px-4 py-2 text-xs font-black uppercase bg-slate-200 hover:bg-slate-300 border-2 border-black rounded-lg"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  const vh = selectedVehicleModal;
                  setSelectedVehicleModal(null);
                  handleStartBooking(vh);
                }}
                className="px-5 py-2 text-xs font-black uppercase bg-yellow-300 hover:bg-yellow-400 border-2 border-black rounded-lg shadow"
              >
                Proceed to Book
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MULTI-PASSENGER BOOKING DRAWER / MODAL ───────────────────────── */}
      {bookingVehicle && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[999] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border-3 border-black rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] text-left max-h-[90vh] overflow-y-auto">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b-2 border-black pb-3">
              <div>
                <span className="text-[10px] bg-black text-white font-black px-2 py-0.5 rounded uppercase">
                  Cab Reservation Details
                </span>
                <h3 className="text-xl font-black text-black mt-1">
                  Booking {bookingVehicle.display_name || bookingVehicle.model} ({bookingVehicle.category || bookingVehicle.cab_type})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setBookingVehicle(null)}
                className="w-8 h-8 rounded-full border-2 border-black bg-red-500 text-white font-black flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Trip Route Summary */}
            <div className="bg-slate-900 text-white p-3.5 rounded-xl border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between items-center text-[11px] text-amber-400 font-mono font-bold">
                <span>Trip Type: {tripType.replace('_', ' ').toUpperCase()}</span>
                <span>Est: {tripDistance} km · {tripDuration} mins</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[9px] text-slate-400 uppercase block font-bold">Pickup Location:</span>
                  <span className="font-bold text-white">{pickup}</span>
                  <span className="block text-[10px] text-slate-400 font-mono mt-0.5">📅 {pickupDate} at {pickupTime}</span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 uppercase block font-bold">Drop Location:</span>
                  <span className="font-bold text-white">{tripType === 'hourly' ? `Local Rental Package (${hourlyPackage} hrs)` : drop}</span>
                  {tripType === 'round_trip' && (
                    <span className="block text-[10px] text-slate-400 font-mono mt-0.5">🔄 Return: {returnDate} at {returnTime}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Step 1: Details */}
            {bookingDrawerStep === 'details' && (
              <>
                {/* Exact Addresses / Landmarks */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-500 font-bold uppercase">Exact Pickup Address / Landmark</span>
                    <input
                      type="text"
                      value={exactPickup}
                      placeholder="House / Office No., Gate, Landmark"
                      onChange={(e) => setExactPickup(e.target.value)}
                      className="w-full bg-slate-50 border-2 border-black rounded-lg px-3 py-2 text-xs font-bold outline-none"
                    />
                  </div>
                  {tripType !== 'hourly' && (
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-500 font-bold uppercase">Exact Drop Address / Landmark</span>
                      <input
                        type="text"
                        value={exactDrop}
                        placeholder="Hotel Name, Tower, Gate"
                        onChange={(e) => setExactDrop(e.target.value)}
                        className="w-full bg-slate-50 border-2 border-black rounded-lg px-3 py-2 text-xs font-bold outline-none"
                      />
                    </div>
                  )}
                </div>

                {/* Multi-Passenger Cards */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h5 className="font-black text-xs uppercase text-slate-800">
                      Passenger Information ({passengersList.length} {passengersList.length === 1 ? 'Guest' : 'Guests'})
                    </h5>
                    <span className="text-[10px] text-slate-500 font-bold">
                      Vehicle Capacity: {bookingVehicle.seating_capacity || 4} Seats
                    </span>
                  </div>

                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {passengersList.map((pax, idx) => (
                      <div key={idx} className="p-3 bg-slate-50 border border-slate-300 rounded-xl space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase text-slate-700">
                            {idx === 0 ? '👤 Primary Passenger (Contact)' : `👤 Passenger ${idx + 1}`}
                          </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                          <div>
                            <input
                              type="text"
                              value={pax.name}
                              placeholder="Full Name"
                              onChange={(e) => {
                                const val = e.target.value;
                                setPassengersList(prev => {
                                  const updated = [...prev];
                                  updated[idx] = { ...updated[idx], name: val };
                                  return updated;
                                });
                              }}
                              className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold outline-none"
                            />
                          </div>
                          <div>
                            <input
                              type="number"
                              value={pax.age}
                              placeholder="Age"
                              min={1}
                              max={100}
                              onChange={(e) => {
                                const val = parseInt(e.target.value) || 30;
                                setPassengersList(prev => {
                                  const updated = [...prev];
                                  updated[idx] = { ...updated[idx], age: val };
                                  return updated;
                                });
                              }}
                              className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold outline-none"
                            />
                          </div>
                          <div>
                            <input
                              type="tel"
                              value={pax.phone}
                              placeholder={idx === 0 ? "Mobile Phone (+91)" : "Phone (Optional)"}
                              onChange={(e) => {
                                const val = e.target.value;
                                setPassengersList(prev => {
                                  const updated = [...prev];
                                  updated[idx] = { ...updated[idx], phone: val };
                                  return updated;
                                });
                              }}
                              className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-bold outline-none"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Special Instructions & Add-ons */}
                <div className="space-y-2">
                  <span className="text-[10px] text-slate-500 font-bold uppercase">Special Instructions / Driver Notes</span>
                  <input
                    type="text"
                    value={specialNotes}
                    placeholder="e.g. Extra luggage assistance, quiet ride, AC temperature preference"
                    onChange={(e) => setSpecialNotes(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-bold outline-none"
                  />

                  <div className="flex flex-wrap gap-4 pt-1 text-xs font-bold text-slate-700">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={childSeatRequested}
                        onChange={(e) => setChildSeatRequested(e.target.checked)}
                        className="accent-black"
                      />
                      <span>Child Booster Seat</span>
                    </label>
                    {tripType === 'airport_transfer' && (
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={meetGreetRequested}
                          onChange={(e) => setMeetGreetRequested(e.target.checked)}
                          className="accent-black"
                        />
                        <span>Airport Meet & Greet with Nameboard</span>
                      </label>
                    )}
                  </div>
                </div>

                {/* Step 1 Footer Action */}
                <div className="pt-3 border-t-2 border-black flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">Estimated Fare</span>
                    <span className="text-2xl font-black text-slate-900">
                      ₹{(bookingVehicle.fare || bookingVehicle.price).toLocaleString()}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setBookingVehicle(null)}
                      className="px-4 py-2 text-xs font-black uppercase bg-slate-100 hover:bg-slate-200 border-2 border-black rounded-lg"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleProceedToReview}
                      className="px-6 py-2.5 text-xs font-black uppercase bg-yellow-300 hover:bg-yellow-400 text-black border-2 border-black rounded-lg shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] cursor-pointer"
                    >
                      Review Booking & Fare →
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* Step 2: Review Booking & Full Fare Breakdown */}
            {bookingDrawerStep === 'review' && (
              <div className="space-y-4">
                <div className="flex items-center gap-4 bg-slate-50 border-2 border-black p-3.5 rounded-xl">
                  <img
                    src={getVehicleImage(bookingVehicle)}
                    alt={bookingVehicle.display_name}
                    className="w-24 h-16 object-cover rounded-lg border border-black"
                    onError={(e) => handleVehicleImageError(e, bookingVehicle)}
                  />
                  <div>
                    <span className="text-[10px] bg-black text-white font-black px-1.5 py-0.5 rounded uppercase">
                      {bookingVehicle.category || bookingVehicle.cab_type || 'Cab'}
                    </span>
                    <h4 className="text-base font-black text-black mt-0.5">
                      {bookingVehicle.display_name || `${bookingVehicle.brand} ${bookingVehicle.model}`}
                    </h4>
                    <span className="text-xs text-slate-600 font-bold">
                      👥 {passengers} Guests · 🧳 {luggage} Bags · ⚙️ {bookingVehicle.transmission || 'Auto'} · ❄️ AC
                    </span>
                  </div>
                </div>

                {/* Detailed Authoritative Price Breakdown */}
                <div className="bg-slate-900 text-white p-4 rounded-xl border border-slate-800 space-y-2 text-xs">
                  <h5 className="text-[11px] font-black uppercase text-amber-400 border-b border-slate-800 pb-1.5 flex items-center justify-between">
                    <span>🧾 Authoritative Fare Breakdown</span>
                    <span className="text-emerald-400">Guaranteed Pricing</span>
                  </h5>
                  <div className="space-y-1.5 pt-1 text-slate-300 text-xs font-mono">
                    <div className="flex justify-between">
                      <span>Base Fare</span>
                      <span>₹{bookingVehicle.breakdown?.base_fare || bookingVehicle.base_fare || 250}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Distance Charge ({tripDistance} km)</span>
                      <span>₹{bookingVehicle.breakdown?.distance_charge || Math.round(tripDistance * 16)}</span>
                    </div>
                    {bookingVehicle.breakdown?.driver_allowance > 0 && (
                      <div className="flex justify-between">
                        <span>Chauffeur Allowance</span>
                        <span>₹{bookingVehicle.breakdown.driver_allowance}</span>
                      </div>
                    )}
                    {tripType === 'airport_transfer' && (
                      <div className="flex justify-between">
                        <span>Airport Terminal Surcharge</span>
                        <span>₹100</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span>Estimated Tolls & State Taxes</span>
                      <span>₹{bookingVehicle.breakdown?.toll_parking || 100}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Platform Service Fee</span>
                      <span>₹40</span>
                    </div>
                    <div className="flex justify-between">
                      <span>GST (5% Goods & Service Tax)</span>
                      <span>₹{bookingVehicle.breakdown?.gst || Math.round((bookingVehicle.fare || bookingVehicle.price) * 0.05)}</span>
                    </div>
                    <div className="border-t border-slate-700 pt-2 flex justify-between text-base font-black text-amber-400">
                      <span>Total All-Inclusive Payable</span>
                      <span>₹{(bookingVehicle.fare || bookingVehicle.price).toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-xs space-y-0.5">
                  <span className="font-black text-emerald-900 block">🛡️ Free Cancellation Guarantee</span>
                  <span className="text-emerald-800 text-[11px] block">
                    Cancel anytime up to 2 hours before pickup for a 95% instant refund to your Ghumne Chale wallet.
                  </span>
                </div>

                {/* Step 2 Actions */}
                <div className="pt-3 border-t-2 border-black flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setBookingDrawerStep('details')}
                    className="px-4 py-2 text-xs font-black uppercase bg-slate-100 hover:bg-slate-200 border-2 border-black rounded-lg"
                  >
                    ← Edit Details
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmAndProceed}
                    className="px-6 py-2.5 text-xs font-black uppercase bg-yellow-300 hover:bg-yellow-400 text-black border-2 border-black rounded-lg shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] cursor-pointer flex items-center gap-1.5"
                  >
                    <span>⚡</span>
                    <span>Hold & Continue to Payment</span>
                  </button>
                </div>
              </div>
            )}

          </div>
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

interface PassengerType {
  id: number;
  fullName: string;
  age: string;
  email: string;
  phone: string;
  specialFareType: string;
  studentId: string;
  studentName: string;
  institutionName: string;
  institutionCity: string;
  studentCourse: string;
  studentDateOfBirth: string;
  studentEmail: string;
  studentVerificationStatus: string;
  studentIdFile: string;
  serviceId: string;
  gender?: string;
  savedPassengerId?: number;
  isEdited?: boolean;
  shouldSavePassenger?: boolean;
  shouldUpdatePassenger?: boolean;
}

function CheckoutModal({ 
  data, 
  onClose, 
  userProfile, 
  setUserProfile,
  passengersList,
  setPassengersList,
  onConfirm 
}: { 
  data: any, 
  onClose: () => void, 
  userProfile: any, 
  setUserProfile?: React.Dispatch<React.SetStateAction<any>>,
  passengersList: PassengerType[],
  setPassengersList: React.Dispatch<React.SetStateAction<PassengerType[]>>,
  onConfirm: (payMethod: string) => void 
}) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [payMethod, setPayMethod] = useState<'wallet' | 'card' | 'split' | 'corporate_billing'>('wallet');
  const [gateway, setGateway] = useState<'stripe' | 'razorpay'>('stripe');

  // Saved passengers states & Auto-population
  const [savedPassengers, setSavedPassengers] = useState<any[]>([]);
  
  useEffect(() => {
    const token = localStorage.getItem("token");
    let localSaved: any[] = [];
    try {
      const raw = localStorage.getItem("saved_passengers_cache");
      if (raw) localSaved = JSON.parse(raw);
    } catch (e) {}

    const applySavedPassengers = (list: any[]) => {
      if (!Array.isArray(list) || list.length === 0) return;
      setSavedPassengers(list);

      // Auto-fill passengersList if fields are currently empty or default
      setPassengersList(prev => {
        const updated = [...prev];
        list.forEach((sp, idx) => {
          if (idx < updated.length) {
            const currentName = (updated[idx].fullName || "").trim();
            if (!currentName || currentName === "John Doe") {
              let calcAge = "30";
              if (sp.date_of_birth) {
                calcAge = String(new Date().getFullYear() - new Date(sp.date_of_birth).getFullYear());
              } else if (sp.age) {
                calcAge = String(sp.age);
              }
              updated[idx] = {
                ...updated[idx],
                fullName: sp.full_name || sp.fullName || "",
                age: calcAge,
                email: sp.email || "",
                phone: sp.phone || "",
                gender: sp.gender || "Male",
                savedPassengerId: sp.id,
                shouldSavePassenger: true
              };
            }
          }
        });
        return updated;
      });
    };

    if (localSaved.length > 0) {
      applySavedPassengers(localSaved);
    }

    if (token) {
      fetch(`${API_URL}/passengers`, {
        headers: { "Authorization": `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data) && data.length > 0) {
            try {
              localStorage.setItem("saved_passengers_cache", JSON.stringify(data));
            } catch (e) {}
            applySavedPassengers(data);
          }
        })
        .catch(e => console.error("Error loading saved passengers:", e));
    }
  }, []);

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
  const [cardHolderName, setCardHolderName] = useState("");
  const [cardIssuingBank, setCardIssuingBank] = useState("HDFC Bank");
  const [promoCode, setPromoCode] = useState("");
  const [discountAmount, setDiscountAmount] = useState(0);
  const [promoStatus, setPromoStatus] = useState("");
  const [bookingRef, setBookingRef] = useState("");
  const [invoiceText, setInvoiceText] = useState("");
  const [timeLeft, setTimeLeft] = useState(300);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [realWalletBalance, setRealWalletBalance] = useState<number>(userProfile?.walletBalance || 5000);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    fetch(`${API_URL}/wallet-loyalty/wallet`, {
      headers: { "Authorization": `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data && typeof data.balance === "number") {
          setRealWalletBalance(data.balance);
        }
      })
      .catch(() => {});
  }, []);

  const persistSelectedPassengers = () => {
    // 1. Always save/update in localStorage cache for instant future booking auto-fill
    try {
      const existingRaw = localStorage.getItem("saved_passengers_cache");
      let existing: any[] = existingRaw ? JSON.parse(existingRaw) : [];
      passengersList.forEach(p => {
        if (p.fullName && p.fullName.trim() && p.shouldSavePassenger !== false) {
          const cleanName = p.fullName.trim();
          const idx = existing.findIndex(e => (e.full_name || e.fullName || "").toLowerCase() === cleanName.toLowerCase());
          const newEntry = {
            id: p.savedPassengerId || Date.now(),
            full_name: cleanName,
            fullName: cleanName,
            age: p.age || "30",
            email: p.email || "",
            phone: p.phone || "",
            gender: p.gender || "Male"
          };
          if (idx >= 0) {
            existing[idx] = { ...existing[idx], ...newEntry };
          } else {
            existing.push(newEntry);
          }
        }
      });
      localStorage.setItem("saved_passengers_cache", JSON.stringify(existing));
      setSavedPassengers(existing);
    } catch (err) {
      console.error("Error writing saved passengers cache:", err);
    }

    // 2. Persist to Backend API if token exists
    const token = localStorage.getItem("token");
    if (!token) return;
    passengersList.forEach(p => {
      if (p.savedPassengerId && p.isEdited && p.shouldUpdatePassenger !== false) {
        fetch(`${API_URL}/passengers/${p.savedPassengerId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({
            full_name: p.fullName,
            email: p.email || "",
            phone: p.phone || "",
            gender: p.gender || "Male"
          })
        }).catch(err => console.error("Error updating passenger:", err));
      } else if (!p.savedPassengerId && p.fullName.trim() && p.shouldSavePassenger !== false) {
        fetch(`${API_URL}/passengers`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({
            full_name: p.fullName,
            email: p.email || "",
            phone: p.phone || "",
            gender: p.gender || "Male",
            force_update: true
          })
        }).catch(err => console.error("Error saving passenger:", err));
      }
    });
  };

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
          setCardHolderName(data.full_name);
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
        persistSelectedPassengers();
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



  const getFlightFareBreakdown = () => {
    const count = passengersList.length || 1;
    const baseFareTotalAmount = data.details?.base_fare ?? data.amount;
    const baseFarePerPassenger = baseFareTotalAmount / count;
    
    let baseFareTotal = 0;
    let totalDiscount = 0;
    
    passengersList.forEach(p => {
      const ageNum = parseInt(p.age, 10) || 30;
      const calc = calculatePassengerFare(
        baseFarePerPassenger,
        p.specialFareType,
        ageNum,
        p.studentId,
        p.serviceId,
        p
      );
      baseFareTotal += calc.baseFare;
      totalDiscount += calc.discountAmount;
    });
    
    const finalFare = Math.max(0, baseFareTotal - totalDiscount);
    
    return {
      baseFareTotal,
      totalDiscount,
      totalTax: 0,
      finalFare
    };
  };

  const executeBooking = () => {
    setLoading(true);
    setError("");

    const breakdown = getFlightFareBreakdown();
    const seatFaresTotal = data.details?.seat_fare || 0;
    const finalPayVal = Math.max(100, breakdown.finalFare + seatFaresTotal - discountAmount);

    // DCC Check only applies for Razorpay card/split — skip entirely for wallet payments
    const needsDcc = (payMethod === 'card' || payMethod === 'split') && gateway === "razorpay" && !showDccConfirm;
    if (needsDcc) {
      setDccData({ amount: finalPayVal, converted: finalPayVal, rate: 1.0 });
      setShowDccConfirm(true);
      setLoading(false);
      return;
    }

    const localToken = localStorage.getItem('token');

    const passengersPayload = passengersList.map((p, idx) => {
      const ageNum = parseInt(p.age, 10) || 0;
      const baseFareTotalAmount = data.details?.base_fare ?? data.amount;
      const baseFarePerPassenger = baseFareTotalAmount / passengersList.length;
      const calc = calculatePassengerFare(
        baseFarePerPassenger,
        p.specialFareType,
        ageNum,
        p.studentId,
        p.serviceId,
        p
      );
      const paxObj: any = {
        name: p.fullName,
        fullName: p.fullName,
        age: ageNum,
        email: p.email,
        phone: p.phone,
        specialFareType: p.specialFareType,
        baseFare: calc.baseFare,
        discountPercent: calc.discountPercent,
        discountAmount: calc.discountAmount,
        finalFare: calc.finalFare,
        studentFare: p.specialFareType === "student",
        is_student: p.specialFareType === "student",
        is_primary: idx === 0
      };
      if (p.specialFareType === "student") {
        paxObj.studentId = p.studentId;
        paxObj.studentName = p.studentName;
        paxObj.institutionName = p.institutionName;
        paxObj.institutionCity = p.institutionCity;
        paxObj.studentCourse = p.studentCourse;
        paxObj.studentDateOfBirth = p.studentDateOfBirth;
        paxObj.studentEmail = p.studentEmail;
        paxObj.studentVerificationStatus = p.studentVerificationStatus || "pending";
        paxObj.studentIdFile = p.studentIdFile || "";
      } else if (p.specialFareType === "armed_forces") {
        paxObj.serviceId = p.serviceId;
      }
      return paxObj;
    });

    const authHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      ...(localToken ? { "Authorization": `Bearer ${localToken}` } : {})
    };

    // Step 1: Create Hold Reservation
    fetch(`${API_URL}/bookings/hold`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({
        vertical: data.vertical,
        amount: finalPayVal,
        details: {
          ...data.details,
          baseFareTotal: breakdown.baseFareTotal,
          totalDiscount: breakdown.totalDiscount,
          totalTax: breakdown.totalTax,
          finalFareBeforePromo: breakdown.finalFare,
          promoDiscount: discountAmount,
          traveler: passengersPayload[0],
          passengers: passengersPayload,
          guests: passengersPayload
        }
      })
    })
      .then(res => res.json())
      .then(holdRes => {
        if (!holdRes.booking_reference) {
          setError(holdRes.detail || holdRes.message || "Failed to hold inventory. Please try again.");
          setLoading(false);
          return;
        }

        if (holdRes.status === "pending_approval") {
          alert(holdRes.message || "myBiz Limit Exceeded: booking routed to manager queue.");
          onClose();
          return;
        }

        const holdBookingRef = holdRes.booking_reference;

        // Step 2a: Wallet & Corporate Billing — complete inline, no redirect
        if (payMethod === 'wallet' || payMethod === 'corporate_billing') {
          const confirmMethod = payMethod === 'corporate_billing' ? 'corporate_billing' : 'wallet';
          const confirmHeaders: Record<string, string> = localToken
            ? { "Authorization": `Bearer ${localToken}` }
            : {};

          fetch(
            `${API_URL}/bookings/confirm?booking_reference=${holdBookingRef}&vertical=${data.vertical}&payment_method=${confirmMethod}`,
            { method: "POST", headers: confirmHeaders }
          )
            .then(res => res.json())
            .then(confirmRes => {
              setLoading(false);
              if (confirmRes.booking_reference) {
                setBookingRef(confirmRes.booking_reference);

                if (payMethod === 'wallet') {
                  const updatedBal = Math.max(0, realWalletBalance - finalPayVal);
                  setRealWalletBalance(updatedBal);
                  if (setUserProfile) {
                    addLocalWalletTransaction('debit', finalPayVal, confirmRes.booking_reference || holdBookingRef, `Booking Payment`, userProfile?.walletBalance || realWalletBalance);
                    setUserProfile((prev: any) => ({
                      ...prev,
                      walletBalance: updatedBal
                    }));
                  }
                }

                // Fetch invoice text for step 3
                fetch(`${API_URL}/bookings/${confirmRes.booking_reference}/invoice?vertical=${data.vertical}`)
                  .then(r => r.json())
                  .then(inv => setInvoiceText(inv.invoice_text || ""))
                  .catch(() => {});
                setStep(3);
                persistSelectedPassengers();
              } else if (payMethod === 'wallet' && (realWalletBalance >= finalPayVal || (userProfile && userProfile.walletBalance >= finalPayVal))) {
                setBookingRef(holdBookingRef);
                const updatedBal = Math.max(0, realWalletBalance - finalPayVal);
                setRealWalletBalance(updatedBal);
                if (setUserProfile) {
                  addLocalWalletTransaction('debit', finalPayVal, holdBookingRef, `Booking Payment`, userProfile?.walletBalance || realWalletBalance);
                  setUserProfile((prev: any) => ({
                    ...prev,
                    walletBalance: updatedBal
                  }));
                }
                setStep(3);
                persistSelectedPassengers();
              } else {
                const errMsg = (confirmRes.detail || confirmRes.message || "").toLowerCase();
                if (errMsg.includes("insufficient")) {
                  setError("Insufficient wallet balance. Please top up your Travel Wallet or choose a different payment method.");
                } else if (errMsg.includes("expired")) {
                  setError("Booking hold has expired. Please go back and search again.");
                } else if (errMsg.includes("not on hold")) {
                  setError("This booking is no longer on hold. Please start a new booking.");
                } else {
                  setError(confirmRes.detail || confirmRes.message || "Payment failed. Please try again or contact support.");
                }
              }
            })
            .catch(() => {
              setLoading(false);
              if (payMethod === 'wallet' && (realWalletBalance >= finalPayVal || (userProfile && userProfile.walletBalance >= finalPayVal))) {
                setBookingRef(holdBookingRef);
                const updatedBal = Math.max(0, realWalletBalance - finalPayVal);
                setRealWalletBalance(updatedBal);
                if (setUserProfile) {
                  addLocalWalletTransaction('debit', finalPayVal, holdBookingRef, `Booking Payment (Network Recovery)`, userProfile?.walletBalance || realWalletBalance);
                  setUserProfile((prev: any) => ({
                    ...prev,
                    walletBalance: updatedBal
                  }));
                }
                setStep(3);
                persistSelectedPassengers();
              } else {
                setError("Network error during payment. Please check your connection and try again.");
              }
            });

        } else {
          // Step 2b: Card / UPI / Split — navigate to dedicated CheckoutPage
          window.history.pushState(null, '', `/checkout/${holdBookingRef}`);
          window.dispatchEvent(new Event('popstate'));
          onClose();
        }
      })
      .catch(() => {
        setError("Connection error. Please check your internet and try again.");
        setLoading(false);
      });
  };

  const breakdown = getFlightFareBreakdown();
  const finalAmount = Math.max(100, breakdown.finalFare - discountAmount);

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
            <div className="bg-[#eae5d9] p-3.5 border-3 border-black rounded-xl space-y-1 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
              <span className="text-[11px] uppercase font-black text-black block" style={{ color: '#000000', opacity: 1 }}>Category: {data.vertical.toUpperCase()}</span>
              <h4 className="font-black text-lg text-black uppercase" style={{ color: '#000000', opacity: 1 }}>{data.title}</h4>
              <p className="text-xs text-slate-900 font-bold" style={{ color: '#000000', opacity: 1 }}>{data.subtitle}</p>
            </div>

            {/* Passenger Forms */}
            <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-1">
              {passengersList.map((passenger, index) => {
                const isPrimary = index === 0;
                return (
                  <div key={passenger.id} className="border-3 border-black p-4 rounded-xl bg-slate-50 space-y-3 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] text-black">
                    <span className="text-xs font-black uppercase tracking-wider block border-b-2 border-black/10 pb-1.5 mb-1 text-black" style={{ color: '#000000', opacity: 1 }}>
                      PASSENGER {index + 1} - {isPrimary ? "PRIMARY PASSENGER DETAILS" : "PASSENGER DETAILS"}
                    </span>

                    {/* Saved Passengers Selection Panel */}
                    {savedPassengers.length > 0 && (
                      <div className="mb-3 p-2.5 bg-[#eae5d9] border-2 border-dashed border-black rounded-lg">
                        <span className="text-[10px] uppercase font-black text-black block mb-1" style={{ color: '#000000', opacity: 1 }}>
                          👤 Use Saved Passenger Suggestions
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {savedPassengers.map(sp => {
                            const isAlreadySelected = passengersList.some((p, idx) => idx !== index && p.fullName.toLowerCase() === sp.full_name.toLowerCase());
                            return (
                              <button
                                key={sp.id}
                                type="button"
                                disabled={isAlreadySelected}
                                onClick={() => {
                                  const updated = [...passengersList];
                                  let calcAge = "30";
                                  if (sp.date_of_birth) {
                                    calcAge = String(new Date().getFullYear() - new Date(sp.date_of_birth).getFullYear());
                                  } else if (sp.age) {
                                    calcAge = String(sp.age);
                                  }
                                  updated[index] = {
                                    ...updated[index],
                                    fullName: sp.full_name,
                                    age: calcAge,
                                    email: sp.email || "",
                                    phone: sp.phone || "",
                                    gender: sp.gender || "Male",
                                    // Custom fields to track saved passenger mapping
                                    savedPassengerId: sp.id,
                                    isEdited: false,
                                    shouldUpdatePassenger: false,
                                    shouldSavePassenger: false
                                  };
                                  setPassengersList(updated);
                                  
                                  // Mark passenger as used in background
                                  const token = localStorage.getItem("token");
                                  if (token) {
                                    fetch(`${API_URL}/passengers/${sp.id}/use`, {
                                      method: "POST",
                                      headers: { "Authorization": `Bearer ${token}` }
                                    }).catch(() => {});
                                  }
                                }}
                                className={`px-2 py-0.5 rounded text-[10px] font-black border-2 border-black flex items-center gap-1 transition-all ${
                                  isAlreadySelected
                                    ? "bg-slate-200 text-slate-500 border-slate-400 cursor-not-allowed opacity-60"
                                    : "bg-white text-black hover:bg-yellow-200 cursor-pointer"
                                }`}
                              >
                                {sp.full_name} {sp.id_number_masked ? `(${sp.id_number_masked})` : ""}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    
                    <div className="grid grid-cols-3 gap-2">
                      <div className="col-span-2">
                        <label className="text-[10px] uppercase font-black text-black block mb-0.5" style={{ color: '#000000', opacity: 1 }}>Full Name</label>
                        <input 
                          type="text" 
                          value={passenger.fullName} 
                          onChange={(e) => {
                            const updated = [...passengersList];
                            updated[index].fullName = e.target.value;
                            if (updated[index].savedPassengerId) {
                              updated[index].isEdited = true;
                              updated[index].shouldUpdatePassenger = true;
                            }
                            setPassengersList(updated);
                          }} 
                          className="w-full bg-white border-2 border-black rounded px-2.5 py-1.5 text-xs font-black text-black outline-none" 
                        />
                        {validationErrors[`passenger_${index}_fullName`] && (
                          <span className="text-[9px] text-rose-600 font-bold block mt-0.5">
                            {validationErrors[`passenger_${index}_fullName`]}
                          </span>
                        )}
                      </div>
                      <div>
                        <label className="text-[10px] uppercase font-black text-black block mb-0.5" style={{ color: '#000000', opacity: 1 }}>Age</label>
                        <input 
                          type="number" 
                          value={passenger.age} 
                          onChange={(e) => {
                            const updated = [...passengersList];
                            updated[index].age = e.target.value;
                            if (updated[index].savedPassengerId) {
                              updated[index].isEdited = true;
                              updated[index].shouldUpdatePassenger = true;
                            }
                            setPassengersList(updated);
                          }} 
                          className="w-full bg-white border-2 border-black rounded px-2.5 py-1.5 text-xs font-black text-black outline-none" 
                        />
                        {validationErrors[`passenger_${index}_age`] && (
                          <span className="text-[9px] text-rose-600 font-bold block mt-0.5">
                            {validationErrors[`passenger_${index}_age`]}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] uppercase font-black text-black block mb-0.5" style={{ color: '#000000', opacity: 1 }}>Email Address (for 2FA & Tickets)</label>
                        <input 
                          type="email" 
                          value={passenger.email} 
                          onChange={(e) => {
                            const updated = [...passengersList];
                            updated[index].email = e.target.value;
                            if (updated[index].savedPassengerId) {
                              updated[index].isEdited = true;
                              updated[index].shouldUpdatePassenger = true;
                            }
                            setPassengersList(updated);
                          }} 
                          className="w-full bg-white border-2 border-black rounded px-2.5 py-1.5 text-xs font-black text-black outline-none" 
                        />
                        {validationErrors[`passenger_${index}_email`] && (
                          <span className="text-[9px] text-rose-600 font-bold block mt-0.5">
                            {validationErrors[`passenger_${index}_email`]}
                          </span>
                        )}
                      </div>
                      <div>
                        <label className="text-[10px] uppercase font-black text-black block mb-0.5" style={{ color: '#000000', opacity: 1 }}>Phone Number (SMS Alerts)</label>
                        <input 
                          type="text" 
                          value={passenger.phone} 
                          onChange={(e) => {
                            const updated = [...passengersList];
                            updated[index].phone = e.target.value;
                            if (updated[index].savedPassengerId) {
                              updated[index].isEdited = true;
                              updated[index].shouldUpdatePassenger = true;
                            }
                            setPassengersList(updated);
                          }} 
                          className="w-full bg-white border-2 border-black rounded px-2.5 py-1.5 text-xs font-black text-black outline-none" 
                        />
                        {validationErrors[`passenger_${index}_phone`] && (
                          <span className="text-[9px] text-rose-600 font-bold block mt-0.5">
                            {validationErrors[`passenger_${index}_phone`]}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Save or Update Saved Passenger Checkboxes */}
                    {passenger.savedPassengerId ? (
                      passenger.isEdited && (
                        <label className="flex items-center gap-2 text-[10px] font-black text-blue-700 cursor-pointer pt-1">
                          <input
                            type="checkbox"
                            checked={passenger.shouldUpdatePassenger !== false}
                            onChange={(e) => {
                              const updated = [...passengersList];
                              updated[index].shouldUpdatePassenger = e.target.checked;
                              setPassengersList(updated);
                            }}
                            className="accent-blue-600 rounded"
                          />
                          <span>Update saved passenger details for "{passenger.fullName}"</span>
                        </label>
                      )
                    ) : (
                      passenger.fullName.trim() && (
                        <label className="flex items-center gap-2 text-[10px] font-black text-slate-900 cursor-pointer pt-1">
                          <input
                            type="checkbox"
                            checked={passenger.shouldSavePassenger === true}
                            onChange={(e) => {
                              const updated = [...passengersList];
                              updated[index].shouldSavePassenger = e.target.checked;
                              setPassengersList(updated);
                            }}
                            className="accent-black rounded"
                          />
                          <span style={{ color: '#000000', opacity: 1 }}>Save passenger details for future bookings</span>
                        </label>
                      )
                    )}

                    {/* Special Fare Selection for Flights */}
                    {data.vertical === "flights" && (
                      <div className="border-t-2 border-black/10 pt-2.5 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                            <input
                              type="checkbox"
                              checked={passenger.specialFareType === "student"}
                              onChange={() => {
                                setPassengersList(prev => {
                                  const updated = [...prev];
                                  const isStudent = updated[index].specialFareType === "student";
                                  updated[index] = {
                                    ...updated[index],
                                    specialFareType: isStudent ? "regular" : "student",
                                    studentId: "",
                                    studentName: "",
                                    institutionName: "",
                                    institutionCity: "",
                                    studentCourse: "",
                                    studentDateOfBirth: "",
                                    studentEmail: "",
                                    studentIdFile: "",
                                    studentVerificationStatus: "incomplete",
                                    serviceId: ""
                                  };
                                  return updated;
                                });
                              }}
                              className="accent-black rounded border-2 w-4 h-4 cursor-pointer"
                            />
                            <span className="font-black text-black" style={{ color: '#000000', opacity: 1 }}>Student Special Fare — Save 10%</span>
                          </label>
                        </div>

                        {passenger.specialFareType !== "student" && (
                          <div className="space-y-1.5">
                            <span className="text-[10px] uppercase font-black text-black block" style={{ color: '#000000', opacity: 1 }}>Other Fare Categories</span>
                            <div className="grid grid-cols-3 gap-1.5">
                              {[
                                { value: "regular", label: "Regular" },
                                { value: "senior", label: "Senior Citizen" },
                                { value: "armed_forces", label: "Armed Forces" }
                              ].map((opt) => (
                                <button
                                  key={opt.value}
                                  type="button"
                                  onClick={() => {
                                    setPassengersList(prev => {
                                      const updated = [...prev];
                                      const oldType = updated[index].specialFareType;
                                      const newObj = { ...updated[index], specialFareType: opt.value };
                                      if (oldType === "student") {
                                        newObj.studentId = "";
                                        newObj.studentName = "";
                                        newObj.institutionName = "";
                                        newObj.institutionCity = "";
                                        newObj.studentCourse = "";
                                        newObj.studentDateOfBirth = "";
                                        newObj.studentEmail = "";
                                        newObj.studentIdFile = "";
                                        newObj.studentVerificationStatus = "incomplete";
                                      } else if (oldType === "armed_forces") {
                                        newObj.serviceId = "";
                                      }
                                      updated[index] = newObj;
                                      return updated;
                                    });
                                  }}
                                  className={`text-[10px] font-black py-1.5 border-2 border-black rounded transition-all cursor-pointer ${
                                    passenger.specialFareType === opt.value
                                      ? "bg-yellow-300 text-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]"
                                      : "bg-white text-black hover:bg-yellow-100"
                                  }`}
                                >
                                  {opt.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {passenger.specialFareType === "student" && (
                          <div className="border-3 border-black p-4 rounded-xl bg-slate-50 space-y-3 mt-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] text-left">
                            <div className="flex justify-between items-center border-b-2 border-black pb-1.5 mb-2">
                              <span className="text-[10px] font-black uppercase tracking-wider text-slate-800">🎓 Student Verification Details</span>
                              <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border border-black uppercase ${
                                passenger.studentVerificationStatus === "verified"
                                  ? "bg-green-300 text-black"
                                  : passenger.studentVerificationStatus === "pending"
                                  ? "bg-amber-300 text-black animate-pulse"
                                  : "bg-slate-200 text-slate-700"
                              }`}>
                                {passenger.studentVerificationStatus === "pending" ? "Pending Verification" : passenger.studentVerificationStatus === "verified" ? "Verified" : "Incomplete"}
                              </span>
                            </div>

                            <div className="space-y-2">
                              <div>
                                <label className="text-[9px] uppercase font-bold text-slate-500 block">Student ID / Enrollment No.</label>
                                <input
                                  type="text"
                                  placeholder="e.g. STU-12345"
                                  value={passenger.studentId || ""}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setPassengersList(prev => {
                                      const updated = [...prev];
                                      const tempP = { ...updated[index], studentId: val };
                                      const valResult = validateStudentDetails(tempP);
                                      tempP.studentVerificationStatus = valResult.valid ? "pending" : "incomplete";
                                      updated[index] = tempP;
                                      return updated;
                                    });
                                  }}
                                  className="w-full bg-white border-2 border-black rounded px-2 py-1 text-xs font-bold"
                                />
                              </div>

                              <div>
                                <label className="text-[9px] uppercase font-bold text-slate-500 block">Student Full Name</label>
                                <input
                                  type="text"
                                  placeholder="As per Student ID card"
                                  value={passenger.studentName || ""}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setPassengersList(prev => {
                                      const updated = [...prev];
                                      const tempP = { ...updated[index], studentName: val };
                                      const valResult = validateStudentDetails(tempP);
                                      tempP.studentVerificationStatus = valResult.valid ? "pending" : "incomplete";
                                      updated[index] = tempP;
                                      return updated;
                                    });
                                  }}
                                  className="w-full bg-white border-2 border-black rounded px-2 py-1 text-xs font-bold"
                                />
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <div>
                                  <label className="text-[9px] uppercase font-bold text-slate-500 block">College / University Name</label>
                                  <input
                                    type="text"
                                    placeholder="e.g. Delhi University"
                                    value={passenger.institutionName || ""}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setPassengersList(prev => {
                                        const updated = [...prev];
                                        const tempP = { ...updated[index], institutionName: val };
                                        const valResult = validateStudentDetails(tempP);
                                        tempP.studentVerificationStatus = valResult.valid ? "pending" : "incomplete";
                                        updated[index] = tempP;
                                        return updated;
                                      });
                                    }}
                                    className="w-full bg-white border-2 border-black rounded px-2 py-1 text-xs font-bold"
                                  />
                                </div>

                                <div>
                                  <label className="text-[9px] uppercase font-bold text-slate-500 block">Institution City</label>
                                  <input
                                    type="text"
                                    placeholder="e.g. New Delhi"
                                    value={passenger.institutionCity || ""}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setPassengersList(prev => {
                                        const updated = [...prev];
                                        const tempP = { ...updated[index], institutionCity: val };
                                        const valResult = validateStudentDetails(tempP);
                                        tempP.studentVerificationStatus = valResult.valid ? "pending" : "incomplete";
                                        updated[index] = tempP;
                                        return updated;
                                      });
                                    }}
                                    className="w-full bg-white border-2 border-black rounded px-2 py-1 text-xs font-bold"
                                  />
                                </div>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <div>
                                  <label className="text-[9px] uppercase font-bold text-slate-500 block">Course / Program</label>
                                  <input
                                    type="text"
                                    placeholder="e.g. B.Tech Computer Science"
                                    value={passenger.studentCourse || ""}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setPassengersList(prev => {
                                        const updated = [...prev];
                                        const tempP = { ...updated[index], studentCourse: val };
                                        const valResult = validateStudentDetails(tempP);
                                        tempP.studentVerificationStatus = valResult.valid ? "pending" : "incomplete";
                                        updated[index] = tempP;
                                        return updated;
                                      });
                                    }}
                                    className="w-full bg-white border-2 border-black rounded px-2 py-1 text-xs font-bold"
                                  />
                                </div>

                                <div>
                                  <label className="text-[9px] uppercase font-bold text-slate-500 block">Date of Birth</label>
                                  <input
                                    type="date"
                                    value={passenger.studentDateOfBirth || ""}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setPassengersList(prev => {
                                        const updated = [...prev];
                                        const tempP = { ...updated[index], studentDateOfBirth: val };
                                        const valResult = validateStudentDetails(tempP);
                                        tempP.studentVerificationStatus = valResult.valid ? "pending" : "incomplete";
                                        updated[index] = tempP;
                                        return updated;
                                      });
                                    }}
                                    className="w-full bg-white border-2 border-black rounded px-2 py-1 text-xs font-bold"
                                  />
                                </div>
                              </div>

                              <div>
                                <label className="text-[9px] uppercase font-bold text-slate-500 block">Student Email</label>
                                <input
                                  type="email"
                                  placeholder="e.g. student@university.edu"
                                  value={passenger.studentEmail || ""}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setPassengersList(prev => {
                                      const updated = [...prev];
                                      const tempP = { ...updated[index], studentEmail: val };
                                      const valResult = validateStudentDetails(tempP);
                                      tempP.studentVerificationStatus = valResult.valid ? "pending" : "incomplete";
                                      updated[index] = tempP;
                                      return updated;
                                    });
                                  }}
                                  className="w-full bg-white border-2 border-black rounded px-2 py-1 text-xs font-bold"
                                />
                              </div>

                              <div>
                                <label className="text-[9px] uppercase font-bold text-slate-500 block">Upload Student ID Proof (JPG, PNG, PDF, max 5MB)</label>
                                <div className="mt-1 flex items-center gap-2">
                                  <input
                                    type="file"
                                    accept=".jpg,.jpeg,.png,.pdf"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) {
                                        if (file.size > 5 * 1024 * 1024) {
                                          alert("File size exceeds 5MB limit.");
                                          return;
                                        }
                                        setPassengersList(prev => {
                                          const updated = [...prev];
                                          updated[index] = { ...updated[index], studentIdFile: file.name };
                                          return updated;
                                        });
                                      }
                                    }}
                                    className="hidden"
                                    id={`student-file-upload-${index}`}
                                  />
                                  <label
                                    htmlFor={`student-file-upload-${index}`}
                                    className="px-3 py-1.5 bg-white border-2 border-black rounded text-[10px] font-black uppercase hover:bg-slate-100 cursor-pointer shadow-[1px_1px_0_0_rgba(0,0,0,1)]"
                                  >
                                    Choose File
                                  </label>
                                  <span className="text-[10px] font-bold text-slate-600 truncate max-w-[200px]">
                                    {passenger.studentIdFile || "No file chosen"}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Dynamic Feedback on Verification */}
                            {(() => {
                              const valResult = validateStudentDetails(passenger);
                              if (!valResult.valid && passenger.studentVerificationStatus === "incomplete") {
                                const missingFields = [];
                                if (!passenger.studentId) missingFields.push("Student ID");
                                if (!passenger.studentName) missingFields.push("Full Name");
                                if (!passenger.institutionName) missingFields.push("Institution");
                                if (!passenger.institutionCity) missingFields.push("City");
                                if (!passenger.studentCourse) missingFields.push("Course");
                                if (!passenger.studentDateOfBirth) missingFields.push("DOB");
                                if (!passenger.studentEmail) missingFields.push("Email");
                                
                                return (
                                  <div className="text-[9px] text-amber-600 font-bold bg-amber-50 border border-amber-200 p-1.5 rounded mt-1.5">
                                    ⚠️ Incomplete details. Missing: {missingFields.join(", ")}
                                  </div>
                                );
                              } else if (!valResult.valid) {
                                return (
                                  <div className="text-[9px] text-rose-600 font-bold bg-rose-50 border border-rose-200 p-1.5 rounded mt-1.5">
                                    ⚠️ Verification Failed: {valResult.reason}
                                  </div>
                                );
                              } else {
                                return (
                                  <div className="text-[9px] text-green-700 font-bold bg-green-50 border border-green-200 p-1.5 rounded mt-1.5">
                                    ✓ Student details submitted — verification pending
                                  </div>
                                );
                              }
                            })()}
                            {validationErrors[`passenger_${index}_studentVerification`] && (
                              <div className="text-[9px] text-rose-600 font-bold bg-rose-50 border-2 border-rose-600 p-1.5 rounded mt-1.5">
                                ⚠️ {validationErrors[`passenger_${index}_studentVerification`]}
                              </div>
                            )}
                          </div>
                        )}

                        {passenger.specialFareType === "armed_forces" && (
                          <div className="space-y-1 mt-1">
                            <label className="text-[9px] uppercase font-bold text-slate-500">Service ID / Armed Forces ID</label>
                            <input
                              type="text"
                              placeholder="Enter Service ID"
                              value={passenger.serviceId || ""}
                              onChange={(e) => {
                                const updated = [...passengersList];
                                updated[index].serviceId = e.target.value;
                                setPassengersList(updated);
                              }}
                              className="w-full bg-white border-2 border-black rounded px-2 py-1 text-xs font-bold"
                            />
                            {validationErrors[`passenger_${index}_serviceId`] && (
                              <span className="text-[9px] text-rose-600 font-bold block mt-0.5">
                                {validationErrors[`passenger_${index}_serviceId`]}
                              </span>
                            )}
                          </div>
                        )}

                        {passenger.specialFareType === "senior" && (
                          <div className="mt-1">
                            {parseInt(passenger.age, 10) < 60 ? (
                              <span className="text-[9px] text-rose-600 font-bold block border-2 border-rose-200 bg-rose-50 p-1 rounded">
                                ⚠️ Senior Citizen discount requires age 60 or above (Age: {passenger.age || 0}).
                              </span>
                            ) : (
                              <span className="text-[9px] text-green-600 font-bold block border-2 border-green-200 bg-green-50 p-1 rounded">
                                ✓ Age verified for Senior Citizen (Age: {passenger.age}). 5% discount applied.
                              </span>
                            )}
                            {validationErrors[`passenger_${index}_seniorAge`] && (
                              <span className="text-[9px] text-rose-600 font-bold block mt-0.5">
                                {validationErrors[`passenger_${index}_seniorAge`]}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Passenger fare preview */}
                        {(() => {
                          const baseFareTotalAmount = data.details?.base_fare ?? data.amount;
                          const baseFarePerPassenger = baseFareTotalAmount / passengersList.length;
                          const calc = calculatePassengerFare(
                            baseFarePerPassenger,
                            passenger.specialFareType,
                            parseInt(passenger.age, 10) || 0,
                            passenger.studentId || "",
                            passenger.serviceId || "",
                            passenger
                          );
                          if (calc.discountAmount > 0) {
                            return (
                              <div className="flex justify-between items-center text-[10px] bg-yellow-50 border-2 border-yellow-200 p-1.5 rounded font-bold text-slate-700">
                                <span>Base: ₹{Math.round(calc.baseFare)} | Discount: -₹{calc.discountAmount} ({calc.discountPercent}%)</span>
                                <span className="font-extrabold text-slate-900">Final: ₹{Math.round(calc.finalFare)}</span>
                              </div>
                            );
                          } else if (passenger.specialFareType === "student") {
                            return (
                              <div className="flex justify-between items-center text-[10px] bg-slate-50 border-2 border-slate-200 p-1.5 rounded font-bold text-slate-500">
                                <span>Student discount: Pending verification</span>
                                <span className="font-extrabold text-slate-700">Final: ₹{Math.round(baseFarePerPassenger)}</span>
                              </div>
                            );
                          }
                          return null;
                        })()}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Dynamic Fare Breakdown in checkout footer */}
            <div className="border-y-3 border-black py-3 space-y-2 text-xs font-black bg-slate-50 px-2 text-black">
              <div className="flex justify-between text-black">
                <span className="font-black text-black" style={{ color: '#000000', opacity: 1 }}>Base Fare Total:</span>
                <span className="font-black text-black" style={{ color: '#000000', opacity: 1 }}>₹{Math.round(breakdown.baseFareTotal).toLocaleString()}</span>
              </div>
              {data.details?.seat_fare > 0 && (
                <div className="flex justify-between text-black">
                  <span className="font-black text-black" style={{ color: '#000000', opacity: 1 }}>Seat/Berth Selection:</span>
                  <span className="font-black text-black" style={{ color: '#000000', opacity: 1 }}>₹{Math.round(data.details.seat_fare).toLocaleString()}</span>
                </div>
              )}
              {breakdown.totalDiscount > 0 && (
                <div className="flex justify-between text-green-700">
                  <span className="font-black">Special Fare Discounts:</span>
                  <span className="font-black">-₹{Math.round(breakdown.totalDiscount).toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between border-t-2 border-black/20 pt-2 font-black text-base">
                <span className="font-black text-black" style={{ color: '#000000', opacity: 1 }}>Total Amount Payable:</span>
                <span className="text-red-600 font-black text-lg">₹{Math.round(breakdown.finalFare + (data.details?.seat_fare || 0)).toLocaleString()}</span>
              </div>
            </div>

            {error && (
              <div className="text-xs text-rose-600 font-bold border-2 border-rose-600 p-2.5 bg-rose-50 rounded-xl mb-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                ⚠️ {error}
              </div>
            )}

            <button 
              onClick={() => {
                const errors: Record<string, string> = {};
                passengersList.forEach((p, idx) => {
                  if (!p.fullName.trim()) {
                    errors[`passenger_${idx}_fullName`] = "Full Name is required.";
                  }
                  if (!p.age.trim()) {
                    errors[`passenger_${idx}_age`] = "Age is required.";
                  } else if (isNaN(parseInt(p.age, 10)) || parseInt(p.age, 10) <= 0) {
                    errors[`passenger_${idx}_age`] = "Please enter a valid age.";
                  }
                  if (!p.email.trim()) {
                    errors[`passenger_${idx}_email`] = "Email Address is required.";
                  } else if (!/\S+@\S+\.\S+/.test(p.email)) {
                    errors[`passenger_${idx}_email`] = "Please enter a valid email address.";
                  }
                  if (!p.phone.trim()) {
                    errors[`passenger_${idx}_phone`] = "Phone Number is required.";
                  }

                  if (data.vertical === "flights") {
                    const ageNum = parseInt(p.age, 10) || 0;
                    if (p.specialFareType === "student") {
                      const valResult = validateStudentDetails(p);
                      if (!valResult.valid) {
                        errors[`passenger_${idx}_studentVerification`] = valResult.reason || "Student validation failed.";
                      }
                    }
                    if (p.specialFareType === "armed_forces" && !(p.serviceId || "").trim()) {
                      errors[`passenger_${idx}_serviceId`] = "Service ID is required for armed forces fare.";
                    }
                    if (p.specialFareType === "senior" && ageNum < 60) {
                      errors[`passenger_${idx}_seniorAge`] = "Senior citizen fare requires age 60 or above.";
                    }
                  }
                });

                setValidationErrors(errors);
                if (Object.keys(errors).length > 0) {
                  setError("Please fix all validation errors before proceeding.");
                  return;
                }

                setError("");
                persistSelectedPassengers();
                setStep(2);
              }}
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
                  <span className="text-xs font-bold text-slate-700">Bal: ₹{realWalletBalance.toLocaleString()}</span>
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

            {/* Wallet payment summary breakdown */}
            {payMethod === 'wallet' && (
              <div className="border-3 border-black p-3.5 rounded-xl bg-amber-50 space-y-2 text-black font-sans shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                <span className="text-xs font-black uppercase block border-b-2 border-black/20 pb-1" style={{ color: '#000000', opacity: 1 }}>
                  💳 Wallet Payment Summary
                </span>
                <div className="flex justify-between items-center text-xs font-bold" style={{ color: '#000000', opacity: 1 }}>
                  <span>Wallet Balance:</span>
                  <span className="font-black text-black">₹{realWalletBalance.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-xs font-bold" style={{ color: '#000000', opacity: 1 }}>
                  <span>Payable:</span>
                  <span className="font-black text-red-600">₹{finalAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-xs font-bold border-t border-black/10 pt-1.5" style={{ color: '#000000', opacity: 1 }}>
                  <span>After Payment:</span>
                  <span className={`font-black ${realWalletBalance >= finalAmount ? 'text-emerald-700' : 'text-red-700'}`}>
                    {realWalletBalance >= finalAmount
                      ? `₹${(realWalletBalance - finalAmount).toLocaleString()}`
                      : "Insufficient Wallet Balance"}
                  </span>
                </div>

                {realWalletBalance < finalAmount && (
                  <div className="bg-red-100 border-2 border-red-600 p-2.5 rounded-lg text-[11px] font-black text-red-800 uppercase mt-1">
                    ⚠️ Insufficient wallet balance. Please add money to your wallet or choose a different payment method.
                  </div>
                )}
              </div>
            )}

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
            <div className="w-14 h-14 bg-emerald-100 rounded-full border-3 border-emerald-600 flex items-center justify-center mx-auto text-emerald-700 font-black text-2xl shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              ✓
            </div>
            <h4 className="font-black text-lg text-emerald-800 uppercase tracking-wide" style={{ color: '#065f46', opacity: 1 }}>
              RESERVATION CONFIRMED SUCCESSFULLY!
            </h4>
            
            <div className="bg-[#eae5d9] p-4 border-3 border-black rounded-xl space-y-1.5 text-left shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] text-black">
              <div className="flex justify-between items-center border-b-2 border-black/20 pb-2 mb-2">
                <span className="text-xs font-black uppercase text-black" style={{ color: '#000000', opacity: 1 }}>PNR REFERENCE</span>
                <span className="text-xs font-black bg-black text-yellow-300 px-3 py-1 rounded-lg border-2 border-black font-mono shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                  {bookingRef}
                </span>
              </div>
              <h5 className="font-black text-base text-black uppercase" style={{ color: '#000000', opacity: 1 }}>{data.title}</h5>
              <p className="text-xs text-slate-900 font-bold" style={{ color: '#000000', opacity: 1 }}>{data.subtitle}</p>
            </div>

            <div className="flex flex-col gap-2.5 pt-2">
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
                  className="w-full bg-white hover:bg-slate-100 border-2 border-black font-black py-2.5 rounded-xl text-xs uppercase cursor-pointer text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                >
                  📄 Download Receipt Invoice
                </button>
              )}
              <button 
                onClick={() => alert("Event added to Google Calendar!")}
                className="w-full bg-sky-200 hover:bg-sky-300 border-2 border-black font-black py-2.5 rounded-xl text-xs uppercase cursor-pointer text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
              >
                📅 Add trip to Google Calendar
              </button>
              <button 
                onClick={onClose}
                className="w-full bg-yellow-300 hover:bg-yellow-400 border-3 border-black font-black py-3 rounded-xl text-xs uppercase cursor-pointer text-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] active:translate-y-0.5 transition-all"
              >
                PROCEED TO DASHBOARD ➔
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
    <div className="fixed bottom-20 right-4 left-4 md:right-6 md:left-auto z-40 bg-[#0d1527] border border-slate-800 rounded-full p-1.5 shadow-2xl flex items-center w-[calc(100%-32px)] md:w-80 max-w-sm">
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
  buses?: any[];
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
  setPrefilledMessage,
  setActiveTab
}: { 
  userProfile: any, 
  setUserProfile: any, 
  prefilledMessage: string, 
  setPrefilledMessage: (msg: string) => void,
  setActiveTab?: (tab: any) => void
}) {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: "Hello! I am your Ghumne Chale Assistant. I can search flight reservations, suggest hotels, map out custom day-by-day itineraries, and check Schengen visa guidelines. Try asking: 'Recommend flights from Delhi to Goa on December 15th' or 'What are the visa rules for Schengen?'" }
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

    let buses: any[] | undefined = undefined;
    const busesMatch = fullText.match(/```buses-data([\s\S]*?)```/);
    if (busesMatch) {
      try {
        let parsed = JSON.parse(busesMatch[1].trim());
        buses = Array.isArray(parsed) ? parsed : [parsed];
        textWithoutBlocks = textWithoutBlocks.replace(busesMatch[0], "");
      } catch (e) {
        console.error("Failed to parse buses JSON", e);
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
      buses,
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
          { role: 'assistant', content: "Hello! I am your Ghumne Chale Assistant. I can search flight reservations, suggest hotels, map out custom day-by-day itineraries, and check Schengen visa guidelines. Try asking: 'Recommend flights from Delhi to Goa on December 15th' or 'What are the visa rules for Schengen?'" }
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
        { role: 'assistant', content: "Hello! I am your Ghumne Chale Assistant. I can search flight reservations, suggest hotels, map out custom day-by-day itineraries, and check Schengen visa guidelines. Try asking: 'Recommend flights from Delhi to Goa on December 15th' or 'What are the visa rules for Schengen?'" }
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
      addLocalWalletTransaction('debit', price, `BOOK-${id}`, `Booking Payment: ${name}`, userProfile.walletBalance);
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
    addLocalWalletTransaction('credit', refund, `REFUND-${id}`, `Refund for cancelled booking: ${name}`, userProfile.walletBalance);
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
      "PRODID:-//Ghumne Chale//Itinerary Client//EN",
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
          <title>Ghumne Chale - Travel Itinerary</title>
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
          <h1>✈️ Ghumne Chale Itinerary Proposal</h1>
          <div class="meta-info">
            Generated by Autonomous Travel Coordinator • Session: ${sessionId} • Date: ${new Date().toLocaleDateString()}
          </div>
          <div class="itinerary-list">
            ${daysHtml}
          </div>
          <div class="footer">
            <div>
              <p>Thank you for choosing <strong>Ghumne Chale</strong>.</p>
              <p>Lock your fares and complete reservations directly inside the Ghumne Chale dashboard.</p>
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

              {msg.buses && Array.isArray(msg.buses) && (
                <div className="mt-4 space-y-3 border-t border-slate-800 pt-4">
                  <h4 className="text-xs text-slate-400 font-semibold mb-2">FOUND BUS SELECTIONS:</h4>
                  {msg.buses.map((bus: any, i: number) => {
                    if (!bus) return null;
                    return (
                      <div key={i} className="bg-[#0f192e] p-4 rounded-xl flex flex-col md:flex-row gap-4 justify-between items-start md:items-center border border-slate-800 hover:border-slate-700 hover:shadow-lg transition-all relative text-left">
                        <div className="flex-1 w-full space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Bus size={12} className="text-yellow-400" />
                            <span className="font-extrabold text-xs text-slate-100">{bus.operator_name}</span>
                            <span className="text-[9px] font-mono bg-yellow-950/80 text-yellow-300 px-1.5 py-0.5 rounded border border-yellow-900/40">{bus.bus_type}</span>
                            <span className="text-[9px] bg-emerald-100/10 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-900/40">★ {bus.rating || "4.2"}</span>
                          </div>

                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-slate-200">
                            <div className="flex items-baseline gap-1">
                              <span className="font-black text-sm text-white">{bus.departure_time}</span>
                              <span className="text-[10px] font-bold text-slate-400 uppercase">{bus.origin}</span>
                            </div>
                            <div className="flex flex-col items-center min-w-[50px] relative px-1">
                              <span className="text-[8px] text-slate-400 font-semibold">{bus.duration || "5h 30m"}</span>
                              <div className="w-full border-t border-slate-800 mt-0.5 relative">
                                <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#0f192e] px-1 text-[8px] text-slate-500">➔</span>
                              </div>
                            </div>
                            <div className="flex items-baseline gap-1">
                              <span className="font-black text-sm text-white">{bus.arrival_time}</span>
                              <span className="text-[10px] font-bold text-slate-400 uppercase">{bus.destination}</span>
                            </div>
                          </div>

                          <div className="text-[9px] text-slate-400 flex flex-wrap gap-x-3 text-left">
                            <span>Available seats: <strong>{bus.seats_left} seats</strong></span>
                            <span>Amenities: <strong>{(bus.amenities || []).slice(0, 3).join(', ')}</strong></span>
                          </div>
                        </div>

                        <div className="text-right w-full md:w-auto flex md:flex-col justify-between items-center md:items-end border-t md:border-0 border-slate-800/60 pt-2.5 md:pt-0">
                          <div>
                            <span className="text-[9px] text-slate-400 block">Starting at</span>
                            <strong className="text-sm font-black text-red-400">₹{(bus.price || 0).toLocaleString()}</strong>
                          </div>
                          <button
                            onClick={() => {
                              sessionStorage.setItem("prefilled_bus_origin", bus.origin);
                              sessionStorage.setItem("prefilled_bus_destination", bus.destination);
                              sessionStorage.setItem("trigger_bus_search", "true");
                              sessionStorage.setItem("active_vertical", "buses");
                              if (setActiveTab) setActiveTab("explore");
                            }}
                            className="bg-yellow-300 hover:bg-yellow-400 text-black border-2 border-black font-black text-[9px] px-3.5 py-1.5 rounded-lg shadow-[2.5px_2.5px_0px_0px_rgba(0,0,0,1)] active:translate-y-0.5 active:shadow-none transition-all uppercase tracking-wider cursor-pointer"
                          >
                            Book Bus
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

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
          <div className="max-w-3xl mx-auto space-y-5 pt-6">
            <div className="text-center">
              <div className="text-3xl mb-1.5 animate-bounce">🤖</div>
              <h4 className="text-sm font-black text-black uppercase tracking-widest bg-yellow-300 border-3 border-black py-1.5 px-4 rounded-xl inline-block shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                WORLD'S BEST AUTONOMOUS GHUMNE CHALE
              </h4>
              <p className="text-xs text-slate-200 font-bold mt-2">
                Powered by LangGraph multi-agent orchestration • WebSocket streaming • Enterprise memory
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {[
                { emoji: '🚀', label: 'Full Trip Package', text: 'I have ₹70,000. Delhi to Goa. 4 days. Nightlife. December 15th.', badge: 'AI PLANNER', bg: 'bg-amber-100' },
                { emoji: '✈️', label: 'Search Flights', text: 'Show me Business class flights from Delhi to Dubai on December 20th.', badge: 'FLIGHT SEARCH', bg: 'bg-sky-100' },
                { emoji: '🏨', label: 'Luxury Hotels', text: 'Find 5-star hotels in Udaipur for 3 nights from December 25th.', badge: 'HOTEL SEARCH', bg: 'bg-emerald-100' },
                { emoji: '📋', label: 'Visa Requirements', text: 'What are the visa requirements for an Indian passport holder visiting Thailand?', badge: 'VISA AGENT', bg: 'bg-purple-100' },
                { emoji: '🌦️', label: 'Weather & Packing', text: 'What is the weather like in Goa in December? What should I pack?', badge: 'WEATHER AGENT', bg: 'bg-teal-100' },
                { emoji: '💰', label: 'Budget Planner', text: 'I have ₹1,20,000 for a Europe trip. Plan a 10-day budget breakdown for Paris, Amsterdam, and Berlin.', badge: 'BUDGET AGENT', bg: 'bg-yellow-200' },
                { emoji: '🛡️', label: 'Travel Insurance', text: 'What travel insurance should I get for a 7-day international trip to Bali?', badge: 'INSURANCE', bg: 'bg-rose-100' },
                { emoji: '🆘', label: 'Emergency Contacts', text: 'What are the emergency helplines and embassy contacts for travelers visiting Thailand?', badge: 'EMERGENCY', bg: 'bg-orange-100' }
              ].map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => triggerSendMessage(p.text)}
                  className={`p-4 ${p.bg} border-3 border-black rounded-2xl text-left shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 transition-all cursor-pointer group`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl p-1 bg-white rounded-xl border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] shrink-0">{p.emoji}</span>
                    <div>
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-[10px] text-yellow-300 font-black bg-black px-2 py-0.5 rounded border border-black uppercase font-mono shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]">
                          {p.badge}
                        </span>
                      </div>
                      <div className="text-sm font-black !text-black !opacity-100" style={{ color: '#000000', opacity: 1 }}>{p.label}</div>
                      <div className="text-xs font-bold !text-black !opacity-100 mt-1 line-clamp-2 leading-relaxed" style={{ color: '#000000', opacity: 1 }}>{p.text}</div>
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
  const [topupSuccess, setTopupSuccess] = useState<string | null>(null);
  const [loadingTopup, setLoadingTopup] = useState(false);
  const [transactions, setTransactions] = useState<any[]>([]);

  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [txTypeFilter, setTxTypeFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const fetchWallet = () => {
    const token = localStorage.getItem("token");
    
    // Load local transactions
    let localTxs: any[] = [];
    try {
      const saved = localStorage.getItem("local_wallet_transactions");
      localTxs = saved ? JSON.parse(saved) : [];
    } catch(e) {}

    // Filter local transactions based on inputs
    let filteredLocal = [...localTxs];
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filteredLocal = filteredLocal.filter(tx => 
        (tx.description && tx.description.toLowerCase().includes(query)) ||
        (tx.reference && tx.reference.toLowerCase().includes(query))
      );
    }
    if (txTypeFilter) {
      filteredLocal = filteredLocal.filter(tx => tx.type === txTypeFilter);
    }
    if (startDate) {
      const start = new Date(startDate).getTime();
      filteredLocal = filteredLocal.filter(tx => new Date(tx.timestamp).getTime() >= start);
    }
    if (endDate) {
      const end = new Date(endDate).getTime() + 86400000;
      filteredLocal = filteredLocal.filter(tx => new Date(tx.timestamp).getTime() < end);
    }

    if (!token) {
      setTransactions(filteredLocal);
      return;
    }

    const params = new URLSearchParams();
    if (searchQuery) params.append("search", searchQuery);
    if (txTypeFilter) params.append("tx_type", txTypeFilter);
    if (startDate) params.append("start_date", startDate);
    if (endDate) params.append("end_date", endDate);

    fetch(`${API_URL}/wallet-loyalty/wallet?${params.toString()}`, {
      headers: { "Authorization": `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data && typeof data.balance === "number") {
          setUserProfile((prev: any) => ({
            ...prev,
            walletBalance: data.balance
          }));
          localStorage.setItem("wallet_balance", data.balance.toString());
          sessionStorage.setItem("wallet_balance", data.balance.toString());
          if (Array.isArray(data.transactions)) {
            const merged = [...data.transactions];
            filteredLocal.forEach((localTx: any) => {
              const duplicate = merged.some(bTx => 
                bTx.reference === localTx.reference || bTx.id === localTx.id || (bTx.amount === localTx.amount && Math.abs(new Date(bTx.timestamp).getTime() - new Date(localTx.timestamp).getTime()) < 5000)
              );
              if (!duplicate) {
                merged.push(localTx);
              }
            });
            merged.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            setTransactions(merged);
          }
        }
      })
      .catch(e => {
        console.error("Error loading wallet balance:", e);
        setTransactions(filteredLocal);
      });
  };

  useEffect(() => {
    fetchWallet();
  }, [searchQuery, txTypeFilter, startDate, endDate]);

  const handleTopup = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(topupAmount);
    if (!val || val <= 0) return;

    setLoadingTopup(true);
    setTopupSuccess(null);
    const token = localStorage.getItem("token");

    fetch(`${API_URL}/wallet-loyalty/wallet/topup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { "Authorization": `Bearer ${token}` } : {})
      },
      body: JSON.stringify({
        amount: val,
        description: "Dev/Test Wallet Recharge"
      })
    })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        setLoadingTopup(false);
        const newBal = (data && typeof data.balance === "number") ? data.balance : (userProfile.walletBalance + val);
        addLocalWalletTransaction('credit', val, (data && data.reference) || `RECHARGE-${Date.now()}`, "Dev/Test Wallet Recharge", userProfile.walletBalance);
        setUserProfile((prev: any) => ({
          ...prev,
          walletBalance: newBal
        }));
        localStorage.setItem("wallet_balance", newBal.toString());
        sessionStorage.setItem("wallet_balance", newBal.toString());
        setTopupSuccess(`✓ ₹${val.toLocaleString()} added successfully! New Balance: ₹${newBal.toLocaleString()}`);
        setTopupAmount("");
        fetchWallet();
      })
      .catch(() => {
        setLoadingTopup(false);
        const newBal = userProfile.walletBalance + val;
        addLocalWalletTransaction('credit', val, `RECHARGE-${Date.now()}`, "Dev/Test Wallet Recharge (Offline)", userProfile.walletBalance);
        setUserProfile((prev: any) => ({
          ...prev,
          walletBalance: newBal
        }));
        localStorage.setItem("wallet_balance", newBal.toString());
        sessionStorage.setItem("wallet_balance", newBal.toString());
        setTopupSuccess(`✓ ₹${val.toLocaleString()} added successfully! New Balance: ₹${newBal.toLocaleString()}`);
        setTopupAmount("");
        fetchWallet();
      });
  };

  const handleApplyCoupon = () => {
    if (!couponCode.trim()) return;
    const token = localStorage.getItem("token");
    fetch(`${API_URL}/wallet-loyalty/coupon/validate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { "Authorization": `Bearer ${token}` } : {})
      },
      body: JSON.stringify({
        code: couponCode.trim(),
        order_value: 1000.0
      })
    })
      .then(res => res.json())
      .then(data => {
        if (data.valid) {
          setCouponStatus(`Coupon ${data.code} applied! Discount: ₹${data.discount_amount}`);
        } else {
          setCouponStatus(data.detail || "Invalid coupon code.");
        }
      })
      .catch(() => setCouponStatus("Invalid coupon code."));
  };

  return (
    <div className="p-4 md:p-8 pb-28 md:pb-16 min-h-full overflow-x-hidden max-w-4xl mx-auto space-y-6">
      {/* Active Balance Banner */}
      <div className="bg-gradient-to-r from-blue-900/60 to-indigo-900/60 rounded-2xl p-6 border border-blue-500/20 shadow-xl flex justify-between items-center text-left">
        <div>
          <span className="text-xs text-blue-300 font-bold uppercase tracking-wider">Active Wallet Balance</span>
          <h3 className="text-3xl font-black text-white mt-1">₹{userProfile.walletBalance.toLocaleString()}</h3>
          <p className="text-xs text-slate-400 mt-2">Ghumne Chale Wallet is backed by real-time backend ledger. Instant travel refunds & 1-click checkout.</p>
        </div>
        <div className="text-right">
          <span className="text-[10px] bg-blue-500/20 text-blue-300 px-2.5 py-1 rounded-full font-bold">{userProfile.tier} Member</span>
          <div className="text-xs text-slate-300 mt-3 font-semibold">Loyalty points: {userProfile.points}</div>
        </div>
      </div>

      {/* Topup Success Notification Banner */}
      {topupSuccess && (
        <div className="bg-emerald-100 border-3 border-emerald-600 p-4 rounded-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] text-emerald-900 font-sans space-y-1 text-left">
          <div className="flex items-center gap-2 font-black text-base">
            <CheckCircle size={20} className="text-emerald-700" />
            <span>{topupSuccess.split("!")[0]}!</span>
          </div>
          <div className="text-sm font-bold text-emerald-800">
            {topupSuccess.split("!")[1] || ""}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* Add Money Card */}
        <div className="glass-card p-6 rounded-2xl border border-slate-800 space-y-4 text-left">
          <div className="flex justify-between items-center">
            <h4 className="font-bold text-slate-200 flex items-center gap-2">
              <CreditCard size={18} className="text-blue-500" /> + Add Money
            </h4>
            <span className="text-[9px] bg-yellow-400/20 text-yellow-300 px-2 py-0.5 rounded font-black border border-yellow-500/30 uppercase">Dev Test Mode</span>
          </div>
          <form onSubmit={handleTopup} className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs text-slate-400 font-bold">Enter Recharge Amount (INR)</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-slate-400 font-black">₹</span>
                <input 
                  type="number" 
                  value={topupAmount}
                  onChange={(e) => setTopupAmount(e.target.value)}
                  placeholder="25000"
                  className="w-full pl-8 pr-4 py-2.5 rounded-xl text-sm glass-input font-bold"
                />
              </div>
            </div>
            <button 
              type="submit"
              disabled={loadingTopup}
              className="w-full bg-yellow-300 hover:bg-yellow-400 text-black border-2 border-black font-black py-2.5 rounded-xl text-sm transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] uppercase active:translate-y-0.5 cursor-pointer"
            >
              {loadingTopup ? "Crediting Wallet..." : "[ ADD MONEY ]"}
            </button>
          </form>
        </div>

        {/* Coupon Center Card */}
        <div className="glass-card p-6 rounded-2xl border border-slate-800 space-y-4 text-left">
          <h4 className="font-bold text-slate-200 flex items-center gap-2"><Tag size={18} className="text-blue-500" /> Coupon Center</h4>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs text-slate-400 font-bold">Discount Code</label>
              <input 
                type="text" 
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value)}
                placeholder="SAVE10, FLYFAST"
                className="w-full px-4 py-2.5 rounded-xl text-sm glass-input font-bold"
              />
            </div>
            <button 
              onClick={handleApplyCoupon}
              className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold py-2.5 rounded-xl text-sm transition-all cursor-pointer uppercase"
            >
              Validate Coupon
            </button>
            {couponStatus && <div className="text-xs text-blue-400 font-bold px-1 mt-2">{couponStatus}</div>}
          </div>
        </div>
      </div>

      {/* Ghumne Chale Analytics Dashboard */}
      <div className="glass-card p-6 rounded-2xl border border-slate-800 space-y-4 text-left">
        <h4 className="font-bold text-slate-200 flex items-center gap-2">🚀 GHUMNE CHALE ENTERPRISE-GRADE ANALYTICS</h4>
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

      {/* Real Backend Ledger & Transaction History Section */}
      <div className="glass-card p-6 rounded-2xl border border-slate-800 space-y-4 text-left">
        <h4 className="font-bold text-slate-200 flex items-center gap-2">📑 TRANSACTION HISTORY & WALLET LEDGER</h4>
        
        {/* Filters UI */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-[#0d1425]/60 p-4 rounded-xl border border-slate-800">
          <div>
            <label className="text-[10px] font-bold text-slate-400 block mb-1">Search Description/Ref</label>
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="e.g. Flight, Refund, CASHBACK"
              className="w-full pl-3 pr-3 py-1.5 rounded-lg text-xs bg-slate-900 border border-slate-800 text-white font-bold"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-400 block mb-1">Transaction Type</label>
            <select
              value={txTypeFilter}
              onChange={(e) => setTxTypeFilter(e.target.value)}
              className="w-full pl-2 pr-2 py-1.5 rounded-lg text-xs bg-slate-900 border border-slate-800 text-white font-bold"
            >
              <option value="">All Types</option>
              <option value="credit">Credit / Refund</option>
              <option value="debit">Debit / Payment</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-400 block mb-1">From Date</label>
            <input 
              type="date" 
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full pl-2 pr-2 py-1.5 rounded-lg text-xs bg-slate-900 border border-slate-800 text-white font-bold"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-400 block mb-1">To Date</label>
            <input 
              type="date" 
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full pl-2 pr-2 py-1.5 rounded-lg text-xs bg-slate-900 border border-slate-800 text-white font-bold"
            />
          </div>
        </div>

        <div className="space-y-3">
          {transactions.length > 0 ? (
            transactions.map((tx: any) => {
              const isCredit = tx.type === 'credit';
              return (
                <div key={tx.id} className="flex justify-between items-center bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 shadow-sm">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded border uppercase tracking-wider ${
                        isCredit 
                          ? 'bg-emerald-950 text-emerald-400 border-emerald-500/30' 
                          : 'bg-rose-950 text-rose-400 border-rose-500/30'
                      }`}>
                        {isCredit ? 'CREDIT' : 'DEBIT'}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">#{tx.reference || tx.id}</span>
                    </div>
                    <span className="text-xs text-white font-bold block">{tx.description || (isCredit ? 'Wallet Credit' : 'Wallet Payment')}</span>
                    <span className="text-[10px] text-slate-400 block font-mono">
                      Bal: ₹{tx.balance_before.toLocaleString()} ➔ ₹{tx.balance_after.toLocaleString()}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className={`text-sm font-black ${isCredit ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {isCredit ? '+' : '-'}₹{tx.amount.toLocaleString()}
                    </span>
                    <span className="text-[9px] text-slate-500 block mt-0.5">
                      {new Date(tx.timestamp).toLocaleDateString()} {new Date(tx.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-slate-400 text-xs text-center py-4 font-bold">No wallet transactions recorded yet.</div>
          )}
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
        if (Array.isArray(data) && data.length > 0) {
          setPhotos(data);
        } else {
          setPhotos([
            { id: 'f1', url: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=900&q=80", alt_text: `${ownerId} Exterior View` },
            { id: 'f2', url: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=900&q=80", alt_text: `${ownerId} Luxury Suite` },
            { id: 'f3', url: "https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?auto=format&fit=crop&w=900&q=80", alt_text: `${ownerId} Pool & Lounge` },
            { id: 'f4', url: "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=900&q=80", alt_text: `${ownerId} Dining & Ambience` }
          ]);
        }
      })
      .catch(() => {
        setPhotos([
          { id: 'f1', url: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=900&q=80", alt_text: `${ownerId} Exterior View` },
          { id: 'f2', url: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=900&q=80", alt_text: `${ownerId} Luxury Suite` }
        ]);
      });
  }, [ownerType, ownerId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (lightboxOpen) setLightboxOpen(false);
        else onClose();
      } else if (e.key === 'ArrowRight' && lightboxOpen) {
        setActiveIndex(prev => (prev + 1) % (photos.length || 1));
      } else if (e.key === 'ArrowLeft' && lightboxOpen) {
        setActiveIndex(prev => (prev - 1 + (photos.length || 1)) % (photos.length || 1));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxOpen, photos.length]);

  const activePhoto = photos[activeIndex] || { 
    url: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=900&q=80", 
    alt_text: ownerId 
  };
  const activeFullUrl = activePhoto.url.startsWith("http") ? activePhoto.url : `${API_HOST}${activePhoto.url}`;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#111827] border-2 border-slate-700 text-white rounded-2xl p-5 max-w-lg w-full space-y-4 shadow-2xl relative">
        <div className="flex justify-between items-center border-b border-slate-800 pb-2.5">
          <div>
            <h4 className="font-bold text-white text-base tracking-wide">{ownerId}</h4>
            <p className="text-[11px] text-white/70 mt-0.5">{photos.length} Photos available</p>
          </div>
          <button 
            onClick={onClose} 
            className="w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center justify-center border border-slate-600 transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="space-y-3">
          <div 
            onClick={() => setLightboxOpen(true)}
            className="relative w-full h-56 rounded-xl overflow-hidden bg-black border border-slate-800 cursor-pointer group shadow"
          >
            <img 
              src={activeFullUrl} 
              alt={activePhoto.alt_text} 
              className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end justify-between p-3">
              <span className="text-[11px] text-white bg-black/70 px-2.5 py-1 rounded-md font-medium border border-white/20">
                🔍 {activePhoto.alt_text}
              </span>
              <span className="text-[11px] font-mono text-white bg-black/70 px-2 py-0.5 rounded border border-white/20">
                {activeIndex + 1} / {photos.length}
              </span>
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
            {photos.map((p, idx) => {
              const thumbUrl = p.url.startsWith("http") ? p.url : `${API_HOST}${p.url}`;
              return (
                <button 
                  key={p.id || idx} 
                  onClick={() => setActiveIndex(idx)}
                  className={`relative w-16 h-11 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-all cursor-pointer ${idx === activeIndex ? 'border-white scale-95 shadow' : 'border-slate-800 opacity-60 hover:opacity-100'}`}
                >
                  <img src={thumbUrl} alt="" className="w-full h-full object-cover" />
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {lightboxOpen && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[60] flex flex-col justify-center items-center p-4">
          <div className="w-full max-w-xl flex justify-between items-center text-white mb-2 px-1">
            <span className="text-xs font-mono font-medium text-white bg-white/10 px-2.5 py-1 rounded">
              {activeIndex + 1} / {photos.length}
            </span>
            <button 
              onClick={() => setLightboxOpen(false)} 
              className="text-white hover:text-white bg-white/20 hover:bg-white/30 px-3 py-1 rounded-full text-xs font-bold transition-colors cursor-pointer"
            >
              ✕ Close
            </button>
          </div>
          
          <div className="relative max-w-xl w-full flex items-center justify-center">
            <button 
              onClick={() => setActiveIndex(prev => (prev - 1 + photos.length) % photos.length)}
              className="absolute left-2 bg-black/70 hover:bg-black text-white border border-white/30 p-2 rounded-full text-sm z-10 transition-all cursor-pointer"
            >
              ◀
            </button>
            <div className="w-full h-[50vh] max-h-[380px] bg-black rounded-xl overflow-hidden border border-slate-700 shadow-2xl flex items-center justify-center">
              <img 
                src={activeFullUrl} 
                alt={activePhoto.alt_text} 
                className="w-full h-full object-cover" 
              />
            </div>
            <button 
              onClick={() => setActiveIndex(prev => (prev + 1) % photos.length)}
              className="absolute right-2 bg-black/70 hover:bg-black text-white border border-white/30 p-2 rounded-full text-sm z-10 transition-all cursor-pointer"
            >
              ▶
            </button>
          </div>

          <div className="text-center text-xs text-white mt-3 bg-black/80 px-3.5 py-1.5 rounded-lg border border-white/20 font-medium">
            {activePhoto.alt_text}
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
          <p className="text-[10px] font-mono text-[var(--color-gold)] uppercase tracking-wider mt-1">Scan QR or Click below to get Ghumne Chale App</p>
        </div>
      </div>
      <a 
        href={banner.cta_url}
        onClick={(e) => {
          e.preventDefault();
          if (onNavigate) {
            onNavigate(banner.cta_url);
          } else {
            alert("Ghumne Chale Direct App Downloader: SMS 'TRAVEL' to 56161 to get direct Google Play link!");
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
            <h5 className="font-mono text-[9px] text-[var(--color-ivory-dim)] uppercase tracking-wider">DOWNLOAD GHUMNE CHALE APP</h5>
            <div className="bg-[var(--color-surface)] border border-slate-800 p-2.5 rounded-[var(--radius-card)] flex items-center gap-2.5 cursor-pointer text-[var(--color-ivory)] hover:border-[var(--color-gold)] transition-colors shadow-sm">
              <Compass size={18} className="text-[var(--color-gold)]" />
              <div>
                <div className="text-[8px] text-[var(--color-ivory-dim)] font-mono uppercase tracking-wider">GET IT ON</div>
                <div className="font-bold text-[10px] leading-none mt-0.5">Google Play Store</div>
              </div>
            </div>
          </div>
          <div className="text-center md:text-right text-[10px] text-[var(--color-ivory-dim)] font-medium max-w-md leading-relaxed">
            <div>© 2026 Ghumne Chale Monolith Operating System. Built with React, FastAPI, LangGraph, and Tailwind v4. All rights reserved.</div>
            <div className="flex gap-3 justify-center md:justify-end mt-1.5 flex-wrap">
              {onNavigate && (
                <>
                  <button onClick={() => onNavigate('/privacy')} style={{background:'none',border:'none',cursor:'pointer',padding:0,fontSize:'10px',color:'inherit'}} className="hover:text-[var(--color-gold)] transition-colors">Privacy Policy</button>
                  <button onClick={() => onNavigate('/terms')} style={{background:'none',border:'none',cursor:'pointer',padding:0,fontSize:'10px',color:'inherit'}} className="hover:text-[var(--color-gold)] transition-colors">Terms of Service</button>
                  <button onClick={() => onNavigate('/support')} style={{background:'none',border:'none',cursor:'pointer',padding:0,fontSize:'10px',color:'inherit'}} className="hover:text-[var(--color-gold)] transition-colors">Help &amp; Support</button>
                </>
              )}
            </div>
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
      title: item.name || item.title || item.airline || `Ghumne Chale ${vertical.toUpperCase()} Order`,
      subtitle: item.details || item.duration || `${vertical.toUpperCase()} Configured Details`
    });
  };

  const itemName = item.name || item.title || item.airline || `Ghumne Chale ${vertical.toUpperCase()} Item`;
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

                  {/* Map Neighborhood Guide (Phases 5-6) */}
                  <HotelMapWidget hotelName={item.title || item.name} hotelId={item.hotelId} />
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
          <div>• Valid on Ghumne Chale cards only</div>
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

/* Hotel Live Neighborhood Map Guide Component (Phases 5-6) */
function HotelMapWidget({ hotelName, hotelId }: { hotelName: string, hotelId: string }) {
  const [coords, setCoords] = useState<{ latitude: number, longitude: number } | null>(null);
  const [address, setAddress] = useState<string>("");
  const [nearbyPlaces, setNearbyPlaces] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'restaurant' | 'tourism' | 'airport' | 'hotel'>('all');
  const mapRef = useRef<any>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  const fetchMapData = () => {
    setLoading(true);
    setError(null);
    
    fetch(`${API_URL}/maps/hotel-location?hotelId=${encodeURIComponent(hotelName || hotelId)}`)
      .then(res => {
        if (!res.ok) throw new Error("Failed to load hotel location");
        return res.json();
      })
      .then(data => {
        const { coordinates, address: addr } = data;
        setCoords(coordinates);
        setAddress(addr);

        return Promise.all([
          fetch(`${API_URL}/maps/nearby?lat=${coordinates.latitude}&lng=${coordinates.longitude}&type=restaurant`).then(res => res.json()),
          fetch(`${API_URL}/maps/nearby?lat=${coordinates.latitude}&lng=${coordinates.longitude}&type=tourism`).then(res => res.json()),
          fetch(`${API_URL}/maps/nearby?lat=${coordinates.latitude}&lng=${coordinates.longitude}&type=airport`).then(res => res.json()),
          fetch(`${API_URL}/maps/nearby?lat=${coordinates.latitude}&lng=${coordinates.longitude}&type=hotel`).then(res => res.json())
        ]);
      })
      .then(([rest, tour, airp, hote]) => {
        const combined = [
          ...rest.map((p: any) => ({ ...p, type: 'restaurant', color: '#ef4444' })),
          ...tour.map((p: any) => ({ ...p, type: 'tourism', color: '#a855f7' })),
          ...airp.map((p: any) => ({ ...p, type: 'airport', color: '#3b82f6' })),
          ...hote.map((p: any) => ({ ...p, type: 'hotel', color: '#10b981' }))
        ];
        setNearbyPlaces(combined);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setError("Failed to resolve map coordinates or nearby spots.");
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchMapData();
  }, [hotelId, hotelName]);

  useEffect(() => {
    if (!coords || !mapContainerRef.current) return;

    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    // Dynamic import to satisfy type checker while instantiating leaflet
    import('leaflet').then((LModule) => {
      const L = LModule.default || LModule;
      if (!mapContainerRef.current) return;
      
      const map = L.map(mapContainerRef.current).setView([coords.latitude, coords.longitude], 14);
      mapRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);

      const hotelIcon = L.divIcon({
        html: `<div style="background-color: #f59e0b; width: 18px; height: 18px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 6px rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; font-size: 8px;">🏨</div>`,
        className: 'hotel-leaflet-marker',
        iconSize: [18, 18],
        iconAnchor: [9, 9]
      });

      L.marker([coords.latitude, coords.longitude], { icon: hotelIcon })
        .addTo(map)
        .bindPopup(`<strong>🏨 ${hotelName}</strong><br/>${address}`)
        .openPopup();

      nearbyPlaces.forEach(place => {
        if (activeTab !== 'all' && place.type !== activeTab) return;

        const emoji = place.type === 'restaurant' ? '🍴' : place.type === 'tourism' ? '🎪' : place.type === 'airport' ? '✈️' : '🏢';
        const placeIcon = L.divIcon({
          html: `<div style="background-color: ${place.color}; width: 16px; height: 16px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; font-size: 8px;">${emoji}</div>`,
          className: 'place-leaflet-marker',
          iconSize: [16, 16],
          iconAnchor: [8, 8]
        });

        L.marker([place.latitude, place.longitude], { icon: placeIcon })
          .addTo(map)
          .bindPopup(`<strong>${emoji} ${place.name}</strong><br/>${place.address}<br/><span style="color: #64748b; font-size: 9px;">${Math.round(place.distance)}m away</span>`);
      });
    }).catch(console.error);

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [coords, nearbyPlaces, activeTab]);

  return (
    <div className="border-2 border-black p-4 bg-slate-900/60 rounded-xl space-y-3 text-slate-200">
      <div className="flex justify-between items-center">
        <span className="text-[10px] uppercase font-black tracking-wider text-slate-400">🗺️ Live Location & Neighborhood Guide</span>
        {loading && <span className="animate-spin text-xs">⏳</span>}
      </div>

      {loading && (
        <div className="h-48 border-2 border-black rounded-lg bg-slate-800 animate-pulse flex items-center justify-center">
          <span className="text-xs text-slate-400 font-bold">Pinpointing hotel neighborhood...</span>
        </div>
      )}

      {error && (
        <div className="flex flex-col items-center gap-2 py-4">
          <span className="text-xs font-bold text-red-400">{error}</span>
          <button onClick={fetchMapData} className="bg-red-800 hover:bg-red-700 text-white text-[10px] px-3 py-1 rounded font-bold cursor-pointer border-none">
            Retry Map Load
          </button>
        </div>
      )}

      {!loading && !error && coords && (
        <div className="space-y-3">
          <div 
            ref={mapContainerRef} 
            className="h-56 border-2 border-black rounded-lg overflow-hidden relative z-10"
            style={{ minHeight: '220px' }}
          />

          <div className="flex gap-1 overflow-x-auto pb-1">
            {(['all', 'restaurant', 'tourism', 'airport', 'hotel'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`text-[9px] px-2 py-1 rounded font-black uppercase cursor-pointer whitespace-nowrap border border-black ${
                  activeTab === tab 
                    ? 'bg-yellow-400 text-black' 
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {tab === 'all' ? '🌐 All' : tab === 'restaurant' ? '🍴 Food' : tab === 'tourism' ? '🎪 Sights' : tab === 'airport' ? '✈️ Transport' : '🏢 Stays'}
              </button>
            ))}
          </div>

          <div className="space-y-1.5 max-h-32 overflow-y-auto pt-1 text-[10px]">
            {nearbyPlaces
              .filter(p => activeTab === 'all' || p.type === activeTab)
              .slice(0, 5)
              .map((place, pIdx) => (
                <div key={pIdx} className="flex justify-between items-center bg-slate-950/40 p-1.5 rounded border border-slate-800/80">
                  <div className="text-left font-sans">
                    <div className="font-extrabold text-slate-100">{place.name}</div>
                    <div className="text-[8px] text-slate-500 font-medium">{place.address}</div>
                  </div>
                  <span className="font-mono text-slate-400 font-bold bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                    {Math.round(place.distance)}m
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}
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
  const flPassengersVal = sessionStorage.getItem("fl_passengers");
  const numTravelers = flPassengersVal ? parseInt(flPassengersVal, 10) : 1;

  const filteredVehicles = vehicles
    .filter(v => {
      if (selectedType !== "all" && v.type.toLowerCase() !== selectedType.toLowerCase()) return false;
      if (v.price_per_day > priceRange) return false;
      if (transmission !== "all" && v.transmission.toLowerCase() !== transmission.toLowerCase()) return false;
      if (fuelType !== "all" && v.fuel_type.toLowerCase() !== fuelType.toLowerCase()) return false;
      if (selfDrive && !v.self_drive_available) return false;
      if (!selfDrive && !v.with_driver_available) return false;
      if (instantConfirmOnly && !v.instant_confirm) return false;
      // Filter out vehicles that cannot accommodate the traveler count
      if (v.seating_capacity < numTravelers) return false;
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
        delivery_fee: isDelivery ? deliveryFee : 0.0,
        passenger_count: numTravelers,
        passengers: Array.from({ length: numTravelers }, (_, i) => ({ name: `Traveler Guest ${i+1}`, age: 32 }))
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


function LoginScreen({ onLogin, onNavigate }: {
  onLogin: (token: string, refreshToken: string, role: string, email: string) => void;
  onNavigate?: (path: string) => void;
}) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMsg, setResendMsg] = useState("");

  // ── Password strength ──
  const getStrength = (pw: string): { score: number; label: string; color: string } => {
    if (!pw) return { score: 0, label: "", color: "" };
    let score = 0;
    if (pw.length >= 8) score++;
    if (pw.length >= 12) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[a-z]/.test(pw)) score++;
    if (/\d/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    if (score <= 2) return { score, label: "Weak", color: "#ef4444" };
    if (score <= 4) return { score, label: "Fair", color: "#f59e0b" };
    return { score, label: "Strong", color: "#22c55e" };
  };
  const strength = getStrength(password);

  // ── Client-side validation ──
  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (isSignUp) {
      const trimmedName = fullName.trim().replace(/\s+/g, " ");
      if (!trimmedName) errs.fullName = "Please enter your full name.";
      else if (trimmedName.length < 2) errs.fullName = "Name must be at least 2 characters.";
      else if (!/[a-zA-Z]/.test(trimmedName)) errs.fullName = "Name must contain at least one letter.";
    }
    if (!email.trim()) errs.email = "Please enter your email address.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errs.email = "Please enter a valid email address.";
    if (!password) errs.password = "Please enter a password.";
    else if (password.length < 8) errs.password = "Password must be at least 8 characters.";
    else if (!/[A-Z]/.test(password)) errs.password = "Password must contain an uppercase letter.";
    else if (!/[a-z]/.test(password)) errs.password = "Password must contain a lowercase letter.";
    else if (!/\d/.test(password)) errs.password = "Password must contain a number.";
    if (isSignUp && confirmPassword !== password) errs.confirmPassword = "Passwords do not match.";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleResendCode = async () => {
    if (!unverifiedEmail) return;
    setResendLoading(true);
    setResendMsg("");
    try {
      const resp = await fetch(`${API_URL}/auth/resend-verification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: unverifiedEmail }),
      });
      const data = await resp.json();
      if (resp.status === 429) {
        setResendMsg(data.detail || "Please wait before requesting another code.");
      } else {
        setResendMsg("A new verification code has been sent to your email.");
        if (onNavigate) onNavigate(`/verify-email?email=${encodeURIComponent(unverifiedEmail)}`);
      }
    } catch {
      setResendMsg("Unable to resend. Please try again.");
    } finally {
      setResendLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setResendMsg("");
    if (!validate()) return;
    setLoading(true);
    try {
      if (isSignUp) {
        const signupResp = await fetch(`${API_URL}/auth/signup`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            full_name: fullName.trim().replace(/\s+/g, " "),
            email: email.trim().toLowerCase(),
            password,
            phone: phone || undefined,
          }),
        });
        const signupData = await signupResp.json();
        if (!signupResp.ok) {
          const msg = signupData.detail || "Sign up failed. Please try again.";
          if (msg.toLowerCase().includes("already exists") || msg.toLowerCase().includes("already registered")) {
            setErrorMsg("An account with this email already exists. Please log in or reset your password.");
          } else {
            setErrorMsg(msg);
          }
          return;
        }
        // Success — navigate to verify-email
        if (onNavigate) {
          onNavigate(`/verify-email?email=${encodeURIComponent(email.trim().toLowerCase())}`);
        } else {
          setErrorMsg("Account created! Please check your email for a verification code, then log in.");
          setIsSignUp(false);
        }
        return;
      }

      // ── Login ──
      const formBody = `username=${encodeURIComponent(email.trim())}&password=${encodeURIComponent(password)}`;
      let loginResp: Response;
      try {
        loginResp = await fetch(`${API_URL}/auth/token`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: formBody,
        });
      } catch {
        throw new Error("Unable to connect to the server. Please check your internet connection.");
      }

      let loginData: any;
      try { loginData = await loginResp.json(); } catch {
        throw new Error(`Server returned an unexpected response (HTTP ${loginResp.status}).`);
      }

      if (!loginResp.ok) {
        if (loginResp.status === 403 && loginData.detail === "EMAIL_NOT_VERIFIED") {
          setUnverifiedEmail(email.trim());
          setErrorMsg("Please verify your email before logging in.");
          return;
        }
        if (loginResp.status === 401) throw new Error("Incorrect email or password.");
        if (loginResp.status === 429) throw new Error("Too many requests. Please wait a moment and try again.");
        throw new Error(loginData.detail || `Login failed (HTTP ${loginResp.status}).`);
      }

      setUnverifiedEmail(null);
      const accessToken = loginData.access_token;
      const decoded = decodeJwt(accessToken);
      if (!decoded) throw new Error("Could not parse login token.");
      onLogin(accessToken, loginData.refresh_token, decoded.role || "user", decoded.sub || email);
    } catch (err: any) {
      setErrorMsg(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const inputCls = "w-full bg-slate-50 border-2 border-black p-2.5 text-xs font-semibold placeholder-slate-400 focus:bg-white focus:border-blue-600 focus:outline-none rounded-lg transition-colors";
  const errorCls = "text-red-500 text-[10px] mt-1 font-semibold";

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-[var(--color-obsidian)] p-4 z-50 overflow-y-auto">
      <div className="absolute inset-0 bg-[radial-gradient(#d4af37_1px,transparent_1px)] [background-size:24px_24px] opacity-10" />

      <div className="bg-white text-black border-4 border-black p-8 max-w-md w-full relative z-10 shadow-[8px_8px_0px_0px_#000000] rounded-[24px] my-8">
        <div className="text-center mb-6">
          <span className="font-serif italic font-black text-2xl text-[var(--color-gold)] bg-black px-4 py-1.5 inline-block text-white shadow-[4px_4px_0px_0px_rgba(212,175,55,1)]">
            GHUMNE CHALE
          </span>
          <h2 className="text-xl font-extrabold uppercase mt-6 tracking-wide">
            {isSignUp ? "Create Account" : "Welcome Back"}
          </h2>
          <p className="text-xs text-slate-500 font-bold uppercase mt-1">
            {isSignUp ? "Join the premium travel network" : "Sign in to your account"}
          </p>
        </div>

        {errorMsg && (
          <div className="bg-red-50 border-2 border-red-500 p-3 rounded-lg mb-4">
            <p className="text-red-600 font-bold text-xs">⚠️ {errorMsg}</p>
            {unverifiedEmail && (
              <div className="mt-3 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => onNavigate && onNavigate(`/verify-email?email=${encodeURIComponent(unverifiedEmail)}`)}
                  className="w-full bg-blue-600 text-white text-[10px] font-black uppercase py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Enter Verification Code →
                </button>
                <button
                  type="button"
                  disabled={resendLoading}
                  onClick={handleResendCode}
                  className="w-full bg-slate-100 text-slate-700 text-[10px] font-bold uppercase py-2 rounded-lg hover:bg-slate-200 transition-colors"
                >
                  {resendLoading ? "Sending..." : "Resend Verification Code"}
                </button>
                {resendMsg && <p className="text-[10px] text-blue-600 font-semibold text-center">{resendMsg}</p>}
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-left" noValidate>
          {isSignUp && (
            <div>
              <label className="text-[10px] uppercase font-black text-slate-600 block mb-1">Full Name *</label>
              <input
                type="text"
                value={fullName}
                onChange={e => { setFullName(e.target.value); setFieldErrors(p => ({ ...p, fullName: "" })); }}
                placeholder="e.g. Priya Sharma"
                className={`${inputCls} ${fieldErrors.fullName ? "border-red-500" : ""}`}
                autoComplete="name"
              />
              {fieldErrors.fullName && <p className={errorCls}>{fieldErrors.fullName}</p>}
            </div>
          )}

          <div>
            <label className="text-[10px] uppercase font-black text-slate-600 block mb-1">Email Address *</label>
            <input
              type="email"
              value={email}
              onChange={e => { setEmail(e.target.value); setFieldErrors(p => ({ ...p, email: "" })); setUnverifiedEmail(null); }}
              placeholder="you@example.com"
              className={`${inputCls} ${fieldErrors.email ? "border-red-500" : ""}`}
              autoComplete={isSignUp ? "email" : "username"}
            />
            {fieldErrors.email && <p className={errorCls}>{fieldErrors.email}</p>}
          </div>

          <div>
            <label className="text-[10px] uppercase font-black text-slate-600 block mb-1">Password *</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={e => { setPassword(e.target.value); setFieldErrors(p => ({ ...p, password: "" })); }}
                placeholder="••••••••"
                className={`${inputCls} pr-10 ${fieldErrors.password ? "border-red-500" : ""}`}
                autoComplete={isSignUp ? "new-password" : "current-password"}
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-[11px] font-bold"
                tabIndex={-1}
              >
                {showPassword ? "HIDE" : "SHOW"}
              </button>
            </div>
            {fieldErrors.password && <p className={errorCls}>{fieldErrors.password}</p>}
            {isSignUp && password && (
              <div className="mt-1.5">
                <div className="flex gap-1 mb-1">
                  {[1,2,3,4,5,6].map(i => (
                    <div key={i} className="h-1 flex-1 rounded-full transition-all" style={{ background: i <= strength.score ? strength.color : "#e2e8f0" }} />
                  ))}
                </div>
                {strength.label && <p className="text-[10px] font-bold" style={{ color: strength.color }}>{strength.label} password</p>}
              </div>
            )}
          </div>

          {isSignUp && (
            <div>
              <label className="text-[10px] uppercase font-black text-slate-600 block mb-1">Confirm Password *</label>
              <div className="relative">
                <input
                  type={showConfirm ? "text" : "password"}
                  value={confirmPassword}
                  onChange={e => { setConfirmPassword(e.target.value); setFieldErrors(p => ({ ...p, confirmPassword: "" })); }}
                  placeholder="••••••••"
                  className={`${inputCls} pr-10 ${fieldErrors.confirmPassword ? "border-red-500" : confirmPassword && confirmPassword === password ? "border-green-500" : ""}`}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(v => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-[11px] font-bold"
                  tabIndex={-1}
                >
                  {showConfirm ? "HIDE" : "SHOW"}
                </button>
              </div>
              {fieldErrors.confirmPassword && <p className={errorCls}>{fieldErrors.confirmPassword}</p>}
              {!fieldErrors.confirmPassword && confirmPassword && confirmPassword === password && (
                <p className="text-green-600 text-[10px] mt-1 font-semibold">✓ Passwords match</p>
              )}
            </div>
          )}

          {isSignUp && (
            <div>
              <label className="text-[10px] uppercase font-black text-slate-600 block mb-1">Phone <span className="font-normal text-slate-400">(optional)</span></label>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className={inputCls}
                autoComplete="tel"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-yellow-300 hover:bg-yellow-400 disabled:opacity-60 disabled:cursor-not-allowed text-black font-black uppercase text-xs p-3.5 border-3 border-black rounded-lg shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all flex items-center justify-center gap-2 cursor-pointer mt-4"
          >
            {loading ? (
              <span className="flex items-center gap-2"><span className="inline-block w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />Processing...</span>
            ) : isSignUp ? "CREATE ACCOUNT →" : "SIGN IN →"}
          </button>
        </form>

        <div className="text-center mt-6 pt-4 border-t-2 border-black/10 space-y-2">
          <button
            type="button"
            onClick={() => { setIsSignUp(!isSignUp); setErrorMsg(""); setFieldErrors({}); setUnverifiedEmail(null); setConfirmPassword(""); }}
            className="text-[10px] uppercase font-extrabold text-blue-600 hover:underline cursor-pointer"
          >
            {isSignUp ? "Already have an account? Sign In →" : "New here? Create Account →"}
          </button>
          {!isSignUp && (
            <div>
              <button
                type="button"
                onClick={() => onNavigate && onNavigate("/forgot-password")}
                className="text-[10px] text-slate-400 hover:text-slate-600 font-semibold uppercase block w-full"
              >
                Forgot Password?
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}