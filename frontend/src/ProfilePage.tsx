import React, { useState, useEffect } from "react";
import { 
  User, Calendar, Globe, Phone, Mail, Award, CreditCard, Shield, 
  Plus, Trash2, Edit, Check, AlertCircle, Info, Lock, Save, HelpCircle 
} from "lucide-react";

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

interface ProfilePageProps {
  onNavigate: (path: string) => void;
  token: string | null;
}

export function ProfilePage({ onNavigate, token }: ProfilePageProps) {
  const [activeTab, setActiveTab] = useState<string>("personal");
  const [profile, setProfile] = useState<any>(null);
  const [preferences, setPreferences] = useState<any>({});
  const [travellers, setTravellers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string>("");

  // Personal Info Form States
  const [fullName, setFullName] = useState("");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState("");
  const [nationality, setNationality] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [alternatePhone, setAlternatePhone] = useState("");
  const [email, setEmail] = useState("");
  
  // Government IDs
  const [passportNumber, setPassportNumber] = useState("");
  const [passportExpiry, setPassportExpiry] = useState("");
  const [panCard, setPanCard] = useState("");
  const [aadhaar, setAadhaar] = useState("");
  
  // Address
  const [country, setCountry] = useState("");
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");

  // Emergency Contacts
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyRelationship, setEmergencyRelationship] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");

  // Preferences Form States
  const [prefAirline, setPrefAirline] = useState("");
  const [prefHotel, setPrefHotel] = useState("");
  const [prefCabin, setPrefCabin] = useState("");
  const [prefMeal, setPrefMeal] = useState("");
  const [prefSeat, setPrefSeat] = useState("");
  const [prefStyle, setPrefStyle] = useState("");

  // Saved Travellers Form States
  const [showAddTraveller, setShowAddTraveller] = useState(false);
  const [editTravellerId, setEditTravellerId] = useState<number | null>(null);
  const [tName, setTName] = useState("");
  const [tAge, setTAge] = useState("");
  const [tGender, setTGender] = useState("male");
  const [tPassport, setTPassport] = useState("");
  const [tNationality, setTNationality] = useState("");
  const [tMeal, setTMeal] = useState("");
  const [tSeat, setTSeat] = useState("");

  const showToastMsg = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  const fetchProfileData = () => {
    const headers: any = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    setLoading(true);
    // 1. Fetch Profile
    fetch(`${API_URL}/profile`, { headers })
      .then(res => res.json())
      .then(data => {
        setProfile(data);
        setFullName(data.full_name || "");
        setDob(data.dob || "");
        setGender(data.gender || "");
        setNationality(data.nationality || "");
        setMobileNumber(data.mobile_number || "");
        setAlternatePhone(data.alternate_phone || "");
        setEmail(data.email || "");
        setPassportNumber(data.passport_number || "");
        setPassportExpiry(data.passport_expiry || "");
        setPanCard(data.pan_card || "");
        setAadhaar(data.aadhaar || "");
        setCountry(data.country || "");
        setState(data.state || "");
        setCity(data.city || "");
        setPostalCode(data.postal_code || "");
        setEmergencyName(data.emergency_name || "");
        setEmergencyRelationship(data.emergency_relationship || "");
        setEmergencyPhone(data.emergency_phone || "");
      })
      .catch(() => {});

    // 2. Fetch Preferences
    fetch(`${API_URL}/profile/preferences`, { headers })
      .then(res => res.json())
      .then(data => {
        setPreferences(data);
        setPrefAirline(data.preferred_airline || "");
        setPrefHotel(data.preferred_hotel_chain || "");
        setPrefCabin(data.preferred_cabin_class || "");
        setPrefMeal(data.meal_preference || "");
        setPrefSeat(data.seat_preference || "");
        setPrefStyle(data.travel_style || "");
      })
      .catch(() => {});

    // 3. Fetch Travellers
    fetch(`${API_URL}/profile/travellers`, { headers })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setTravellers(data);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchProfileData();
  }, [token]);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const headers: any = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    setSaving(true);
    fetch(`${API_URL}/profile`, {
      method: "PUT",
      headers,
      body: JSON.stringify({
        full_name: fullName,
        dob: dob || null,
        gender: gender || null,
        nationality: nationality || null,
        mobile_number: mobileNumber || null,
        alternate_phone: alternatePhone || null,
        email: email || null,
        passport_number: passportNumber || null,
        passport_expiry: passportExpiry || null,
        pan_card: panCard || null,
        aadhaar: aadhaar || null,
        country: country || null,
        state: state || null,
        city: city || null,
        postal_code: postalCode || null,
        emergency_name: emergencyName || null,
        emergency_relationship: emergencyRelationship || null,
        emergency_phone: emergencyPhone || null
      })
    })
      .then(res => res.json())
      .then(data => {
        setProfile(data);
        showToastMsg("✨ Personal information updated successfully!");
      })
      .catch(() => alert("Failed to save profile details."))
      .finally(() => setSaving(false));
  };

  const handleSavePreferences = (e: React.FormEvent) => {
    e.preventDefault();
    const headers: any = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    setSaving(true);
    fetch(`${API_URL}/profile/preferences`, {
      method: "PUT",
      headers,
      body: JSON.stringify({
        preferred_airline: prefAirline || null,
        preferred_hotel_chain: prefHotel || null,
        preferred_cabin_class: prefCabin || null,
        meal_preference: prefMeal || null,
        seat_preference: prefSeat || null,
        travel_style: prefStyle || null
      })
    })
      .then(res => res.json())
      .then(data => {
        setPreferences(data);
        showToastMsg("✈️ Travel preferences saved successfully!");
      })
      .catch(() => alert("Failed to save preferences."))
      .finally(() => setSaving(false));
  };

  const handleAddOrUpdateTraveller = (e: React.FormEvent) => {
    e.preventDefault();
    const headers: any = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const payload = {
      name: tName,
      age: parseInt(tAge),
      gender: tGender,
      passport: tPassport || null,
      nationality: tNationality || null,
      meal: tMeal || null,
      seat: tSeat || null
    };

    setSaving(true);
    const url = editTravellerId 
      ? `${API_URL}/profile/travellers/${editTravellerId}` 
      : `${API_URL}/profile/travellers`;
      
    const method = editTravellerId ? "PUT" : "POST";

    fetch(url, {
      method,
      headers,
      body: JSON.stringify(payload)
    })
      .then(res => {
        if (!res.ok) throw new Error("Failed to save traveller.");
        return res.json();
      })
      .then(() => {
        showToastMsg(editTravellerId ? "✏️ Traveller updated successfully!" : "➕ Traveller added successfully!");
        setShowAddTraveller(false);
        setEditTravellerId(null);
        setTName("");
        setTAge("");
        setTGender("male");
        setTPassport("");
        setTNationality("");
        setTMeal("");
        setTSeat("");
        fetchProfileData();
      })
      .catch((err) => alert(err.message))
      .finally(() => setSaving(false));
  };

  const handleDeleteTraveller = (id: number) => {
    if (!window.confirm("Are you sure you want to delete this traveller?")) return;
    const headers: any = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    fetch(`${API_URL}/profile/travellers/${id}`, { method: "DELETE", headers })
      .then(() => {
        showToastMsg("🗑️ Traveller deleted successfully!");
        fetchProfileData();
      })
      .catch(() => alert("Delete failed."));
  };

  // Compute profile completion score (Phase 11 Progress Bar)
  const computeCompletion = () => {
    if (!profile) return 0;
    const fields = [
      fullName, dob, gender, nationality, mobileNumber, email, 
      country, city, emergencyName, emergencyPhone
    ];
    const completed = fields.filter(f => !!f).length;
    return Math.round((completed / fields.length) * 100);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#060814] text-white flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Loading Profile Context...</p>
        </div>
      </div>
    );
  }

  const completionPercent = computeCompletion();

  return (
    <div className="min-h-screen bg-[#060814] text-white p-4 md:p-8 font-sans relative text-left">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-[#0f172a] border border-blue-500/30 text-xs font-bold px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2 text-blue-200">
          <Info size={14} className="text-blue-400" />
          {toast}
        </div>
      )}

      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* Title header */}
        <div className="flex justify-between items-center border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-2xl font-black uppercase tracking-wider text-white">Traveler Dashboard</h2>
            <p className="text-xs text-slate-400">Manage account information, documents, and preferences.</p>
          </div>
          <button 
            onClick={() => onNavigate("/")}
            className="bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs py-2 px-4 rounded-xl cursor-pointer transition-colors"
          >
            ← Close & Exit
          </button>
        </div>

        {/* Completion Progress Banner */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl space-y-3">
          <div className="flex justify-between items-center text-xs">
            <span className="font-extrabold text-slate-300 uppercase tracking-wider">Profile Completeness Score</span>
            <span className="font-mono font-black text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded">
              {completionPercent}%
            </span>
          </div>
          <div className="w-full bg-slate-950 rounded-full h-3 border border-slate-850 overflow-hidden">
            <div 
              className="bg-gradient-to-r from-blue-500 to-indigo-600 h-full transition-all duration-500"
              style={{ width: `${completionPercent}%` }}
            />
          </div>
          {completionPercent < 80 && (
            <p className="text-[10px] text-slate-500 font-bold flex items-center gap-1">
              <AlertCircle size={12} className="text-amber-500" /> 
              Complete passport, DOB, nationality and emergency contacts to auto-fill checkout bookings seamlessly.
            </p>
          )}
        </div>

        {/* Outer Grid: Tabs Sidebar & Active Content Panel */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-start">
          
          {/* Sidebar Tabs */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 space-y-1">
            {[
              { id: "personal", label: "Personal Info", icon: User },
              { id: "preferences", label: "Preferences", icon: Award },
              { id: "travellers", label: "Saved Travellers", icon: Globe },
              { id: "emergency", label: "Emergency Contacts", icon: Phone },
              { id: "documents", label: "Privacy & Documents", icon: Shield }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-2.5 px-4 py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer border ${
                  activeTab === tab.id 
                    ? "bg-blue-600 border-blue-500 text-white shadow-md" 
                    : "bg-transparent border-transparent text-slate-400 hover:text-white hover:bg-slate-850"
                }`}
              >
                <tab.icon size={14} /> {tab.label}
              </button>
            ))}
          </div>

          {/* Active Content Area */}
          <div className="md:col-span-3">
            
            {/* PERSONAL INFO TAB */}
            {activeTab === "personal" && (
              <form onSubmit={handleSaveProfile} className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-6">
                <div>
                  <h3 className="text-base font-black uppercase text-white">Personal Information</h3>
                  <p className="text-xs text-slate-500">Provide legal name and valid contacts matching passports.</p>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 font-bold block">FULL LEGAL NAME</label>
                    <input 
                      type="text" 
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 font-bold block">EMAIL ADDRESS</label>
                    <input 
                      type="email" 
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 font-bold block">DATE OF BIRTH</label>
                    <input 
                      type="date" 
                      value={dob}
                      onChange={(e) => setDob(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 focus:border-blue-500 focus:outline-none text-slate-300 font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 font-bold block">GENDER</label>
                    <select 
                      value={gender}
                      onChange={(e) => setGender(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 focus:border-blue-500 focus:outline-none"
                    >
                      <option value="">Select...</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 font-bold block">NATIONALITY</label>
                    <input 
                      type="text" 
                      value={nationality}
                      onChange={(e) => setNationality(e.target.value)}
                      placeholder="e.g. Indian"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 font-bold block">MOBILE NUMBER</label>
                    <input 
                      type="tel" 
                      required
                      value={mobileNumber}
                      onChange={(e) => setMobileNumber(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 focus:border-blue-500 focus:outline-none font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 font-bold block">ALTERNATE TELEPHONE</label>
                    <input 
                      type="tel" 
                      value={alternatePhone}
                      onChange={(e) => setAlternatePhone(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 focus:border-blue-500 focus:outline-none font-mono"
                    />
                  </div>
                </div>

                <div className="border-t border-slate-800 pt-4 space-y-4">
                  <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider block">Residential Address</span>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
                    <div className="space-y-1">
                      <label className="text-[9px] text-slate-500 font-bold block">COUNTRY</label>
                      <input 
                        type="text" 
                        value={country}
                        onChange={(e) => setCountry(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] text-slate-500 font-bold block">STATE</label>
                      <input 
                        type="text" 
                        value={state}
                        onChange={(e) => setState(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] text-slate-500 font-bold block">CITY</label>
                      <input 
                        type="text" 
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] text-slate-500 font-bold block">POSTAL CODE</label>
                      <input 
                        type="text" 
                        value={postalCode}
                        onChange={(e) => setPostalCode(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 focus:border-blue-500 focus:outline-none font-mono"
                      />
                    </div>
                  </div>
                </div>

                <button 
                  type="submit"
                  disabled={saving}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-black py-3 px-6 rounded-xl text-xs uppercase cursor-pointer transition-all flex items-center justify-center gap-1.5 shadow"
                >
                  <Save size={14} /> {saving ? "Saving Changes..." : "Save Personal Info"}
                </button>
              </form>
            )}

            {/* TRAVEL PREFERENCES TAB */}
            {activeTab === "preferences" && (
              <form onSubmit={handleSavePreferences} className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-6">
                <div>
                  <h3 className="text-base font-black uppercase text-white">Travel Preferences</h3>
                  <p className="text-xs text-slate-500">Explicit choices used by the AI Planner to customize recommendations.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 font-bold block">PREFERRED AIRLINE</label>
                    <input 
                      type="text" 
                      value={prefAirline}
                      onChange={(e) => setPrefAirline(e.target.value)}
                      placeholder="e.g. Vistara, IndiGo, Air India"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 font-bold block">PREFERRED HOTEL CHAIN</label>
                    <input 
                      type="text" 
                      value={prefHotel}
                      onChange={(e) => setPrefHotel(e.target.value)}
                      placeholder="e.g. Marriott, Taj Stays"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 font-bold block">PREFERRED CABIN CLASS</label>
                    <select 
                      value={prefCabin}
                      onChange={(e) => setPrefCabin(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 focus:border-blue-500 focus:outline-none"
                    >
                      <option value="">Select...</option>
                      <option value="economy">Economy</option>
                      <option value="premium_economy">Premium Economy</option>
                      <option value="business">Business Class</option>
                      <option value="first">First Class</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 font-bold block">MEAL SELECTION</label>
                    <input 
                      type="text" 
                      value={prefMeal}
                      onChange={(e) => setPrefMeal(e.target.value)}
                      placeholder="e.g. Vegetarian Hot Meal"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 font-bold block">SEAT CONFIGURATION</label>
                    <select 
                      value={prefSeat}
                      onChange={(e) => setPrefSeat(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 focus:border-blue-500 focus:outline-none"
                    >
                      <option value="">Select...</option>
                      <option value="window">Window Seat</option>
                      <option value="aisle">Aisle Seat</option>
                      <option value="extra_legroom">Extra Legroom</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1 text-xs">
                  <label className="text-[10px] text-slate-500 font-bold block">TRAVEL STYLE</label>
                  <input 
                    type="text" 
                    value={prefStyle}
                    onChange={(e) => setPrefStyle(e.target.value)}
                    placeholder="e.g. Luxury, Budget, Solo, Adventure, Family Relaxed"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <button 
                  type="submit"
                  disabled={saving}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-black py-3 px-6 rounded-xl text-xs uppercase cursor-pointer transition-all flex items-center justify-center gap-1.5 shadow"
                >
                  <Save size={14} /> {saving ? "Saving Preferences..." : "Save Preferences"}
                </button>
              </form>
            )}

            {/* SAVED TRAVELLERS TAB */}
            {activeTab === "travellers" && (
              <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-6">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-base font-black uppercase text-white">Saved Travellers</h3>
                    <p className="text-xs text-slate-500">Quickly add family members and friends to checkout slips.</p>
                  </div>
                  {!showAddTraveller && (
                    <button
                      onClick={() => {
                        setEditTravellerId(null);
                        setTName("");
                        setTAge("");
                        setTGender("male");
                        setTPassport("");
                        setTNationality("");
                        setTMeal("");
                        setTSeat("");
                        setShowAddTraveller(true);
                      }}
                      className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded-xl text-xs uppercase cursor-pointer flex items-center gap-1.5"
                    >
                      <Plus size={14} /> Add Traveller
                    </button>
                  )}
                </div>

                {showAddTraveller && (
                  <form onSubmit={handleAddOrUpdateTraveller} className="bg-slate-950/40 p-5 rounded-2xl border border-slate-800 space-y-4 text-xs">
                    <span className="text-[10px] text-slate-400 font-extrabold uppercase block border-b border-slate-850 pb-1.5">
                      {editTravellerId ? "Edit Traveller" : "New Saved Traveller Details"}
                    </span>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="space-y-1">
                        <label className="text-[9px] text-slate-500 font-bold block">FULL LEGAL NAME</label>
                        <input 
                          type="text" 
                          required
                          value={tName} 
                          onChange={(e) => setTName(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-white focus:border-blue-500 focus:outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] text-slate-500 font-bold block">AGE</label>
                        <input 
                          type="number" 
                          required
                          value={tAge} 
                          onChange={(e) => setTAge(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-white font-mono focus:border-blue-500 focus:outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] text-slate-500 font-bold block">GENDER</label>
                        <select 
                          value={tGender} 
                          onChange={(e) => setTGender(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-white focus:border-blue-500 focus:outline-none"
                        >
                          <option value="male">Male</option>
                          <option value="female">Female</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[9px] text-slate-500 font-bold block">PASSPORT NO. (OPTIONAL)</label>
                        <input 
                          type="text" 
                          value={tPassport} 
                          onChange={(e) => setTPassport(e.target.value)}
                          placeholder="Ex: ******1234 or clean number"
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-white font-mono focus:border-blue-500 focus:outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] text-slate-500 font-bold block">NATIONALITY</label>
                        <input 
                          type="text" 
                          value={tNationality} 
                          onChange={(e) => setTNationality(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-white focus:border-blue-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[9px] text-slate-500 font-bold block">MEAL SELECTION</label>
                        <input 
                          type="text" 
                          value={tMeal} 
                          onChange={(e) => setTMeal(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-white focus:border-blue-500 focus:outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] text-slate-500 font-bold block">SEAT SELECTION</label>
                        <input 
                          type="text" 
                          value={tSeat} 
                          onChange={(e) => setTSeat(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-white font-mono focus:border-blue-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button 
                        type="button"
                        onClick={() => setShowAddTraveller(false)}
                        className="bg-slate-900 hover:bg-slate-800 border border-slate-800 font-bold py-2 px-4 rounded-lg cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button 
                        type="submit"
                        className="bg-blue-600 hover:bg-blue-500 text-white font-black py-2 px-4 rounded-lg cursor-pointer"
                      >
                        Save Traveller
                      </button>
                    </div>
                  </form>
                )}

                {/* Travellers list */}
                <div className="grid grid-cols-1 gap-3">
                  {travellers.length === 0 ? (
                    <div className="border border-slate-850 p-6 rounded-2xl text-center text-xs text-slate-500">
                      No saved travellers found. Save friends/family profiles to auto-fill bookings quickly.
                    </div>
                  ) : (
                    travellers.map((traveller: any) => (
                      <div 
                        key={traveller.id}
                        className="bg-slate-950/40 border border-slate-850 p-4 rounded-2xl flex justify-between items-center text-xs text-left"
                      >
                        <div className="space-y-1">
                          <h4 className="font-extrabold text-sm text-slate-200">{traveller.name}</h4>
                          <div className="text-[10px] text-slate-500 space-x-2">
                            <span>Age: {traveller.age}</span>
                            <span>|</span>
                            <span className="capitalize">Gender: {traveller.gender}</span>
                            {traveller.passport && (
                              <>
                                <span>|</span>
                                <span>Passport: {traveller.passport}</span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setEditTravellerId(traveller.id);
                              setTName(traveller.name);
                              setTAge(traveller.age.toString());
                              setTGender(traveller.gender);
                              setTPassport(traveller.passport || "");
                              setTNationality(traveller.nationality || "");
                              setTMeal(traveller.meal || "");
                              setTSeat(traveller.seat || "");
                              setShowAddTraveller(true);
                            }}
                            className="bg-slate-900 hover:bg-slate-800 text-slate-300 p-2 rounded-xl border border-slate-800 cursor-pointer"
                            title="Edit"
                          >
                            <Edit size={12} />
                          </button>
                          
                          <button
                            onClick={() => handleDeleteTraveller(traveller.id)}
                            className="bg-red-500/10 hover:bg-red-500/20 text-red-400 p-2 rounded-xl border border-red-900/30 cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* EMERGENCY CONTACTS TAB */}
            {activeTab === "emergency" && (
              <form onSubmit={handleSaveProfile} className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-6">
                <div>
                  <h3 className="text-base font-black uppercase text-white">Emergency Contacts</h3>
                  <p className="text-xs text-slate-500">Provide a trusted contact point for check-in safety protocols.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 font-bold block">FULL LEGAL NAME</label>
                    <input 
                      type="text" 
                      value={emergencyName}
                      onChange={(e) => setEmergencyName(e.target.value)}
                      placeholder="Emergency contact name"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 font-bold block">RELATIONSHIP</label>
                    <input 
                      type="text" 
                      value={emergencyRelationship}
                      onChange={(e) => setEmergencyRelationship(e.target.value)}
                      placeholder="e.g. Spouse, Parent, Friend"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 font-bold block">TELEPHONE NUMBER</label>
                    <input 
                      type="tel" 
                      value={emergencyPhone}
                      onChange={(e) => setEmergencyPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 focus:border-blue-500 focus:outline-none font-mono"
                    />
                  </div>
                </div>

                <button 
                  type="submit"
                  disabled={saving}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-black py-3 px-6 rounded-xl text-xs uppercase cursor-pointer transition-all flex items-center justify-center gap-1.5 shadow"
                >
                  <Save size={14} /> {saving ? "Saving Contacts..." : "Save Emergency Contacts"}
                </button>
              </form>
            )}

            {/* PRIVACY & DOCUMENTS TAB */}
            {activeTab === "documents" && (
              <form onSubmit={handleSaveProfile} className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-6">
                <div>
                  <h3 className="text-base font-black uppercase text-white">Privacy & Identity Documents</h3>
                  <p className="text-xs text-slate-500">Masked identity cards stored safely for border checks.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 font-bold block">PASSPORT NUMBER</label>
                    <input 
                      type="text" 
                      value={passportNumber}
                      onChange={(e) => setPassportNumber(e.target.value)}
                      placeholder="Enter legal passport code"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 focus:border-blue-500 focus:outline-none font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 font-bold block">PASSPORT EXPIRY DATE</label>
                    <input 
                      type="date" 
                      value={passportExpiry}
                      onChange={(e) => setPassportExpiry(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 focus:border-blue-500 focus:outline-none font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 font-bold block">PAN CARD NUMBER (INDIA)</label>
                    <input 
                      type="text" 
                      value={panCard}
                      onChange={(e) => setPanCard(e.target.value)}
                      placeholder="Ex: ABCDE1234F"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 focus:border-blue-500 focus:outline-none font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 font-bold block">AADHAAR CARD NUMBER</label>
                    <input 
                      type="text" 
                      value={aadhaar}
                      onChange={(e) => setAadhaar(e.target.value)}
                      placeholder="Ex: 1234 5678 9012"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 focus:border-blue-500 focus:outline-none font-mono"
                    />
                  </div>
                </div>

                <div className="border-t border-slate-800 pt-4 space-y-3">
                  <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider block">Masked payment cards</span>
                  <div className="bg-slate-950/40 p-4 border border-slate-850 rounded-2xl text-xs flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CreditCard size={20} className="text-slate-400" />
                      <div>
                        <strong className="text-slate-200 block">•••• •••• •••• 4242</strong>
                        <span className="text-[10px] text-slate-500 font-mono">VISA | EXP 12/28</span>
                      </div>
                    </div>
                    <span className="text-[10px] bg-slate-900 border border-slate-800 px-2 py-0.5 rounded uppercase font-black tracking-wider text-slate-400">Default Card</span>
                  </div>
                </div>

                <button 
                  type="submit"
                  disabled={saving}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-black py-3 px-6 rounded-xl text-xs uppercase cursor-pointer transition-all flex items-center justify-center gap-1.5 shadow"
                >
                  <Save size={14} /> {saving ? "Saving Documents..." : "Save Identity Documents"}
                </button>
              </form>
            )}

          </div>

        </div>

      </div>
    </div>
  );
}
