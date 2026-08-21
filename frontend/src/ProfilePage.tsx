import React, { useState, useEffect, useRef } from "react";
import { 
  User, Calendar, Globe, Phone, Mail, Award, CreditCard, Shield, 
  Plus, Trash2, Edit, Check, AlertCircle, Info, Lock, Save, HelpCircle,
  Camera, Key, Smartphone, Activity, LogOut, CheckCircle2, XCircle
} from "lucide-react";

import { API_BASE, API_URL } from './config/api';

interface ProfilePageProps {
  onNavigate: (path: string) => void;
  token: string | null;
}

export function ProfilePage({ onNavigate, token }: ProfilePageProps) {
  const [activeTab, setActiveTab] = useState<string>("personal");
  const [profile, setProfile] = useState<any>(null);
  const [preferences, setPreferences] = useState<any>({});
  const [travellers, setTravellers] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [securityEvents, setSecurityEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string>("");

  // Personal Info Form States
  const [fullName, setFullName] = useState(() => {
    const sName = typeof window !== "undefined" ? localStorage.getItem("user_full_name") : null;
    const sEmail = typeof window !== "undefined" ? localStorage.getItem("user_email") : null;
    if (sName && sName !== 'Traveler' && sName !== 'Ghumne Chale Traveler') return sName;
    if (sEmail) return sEmail.split('@')[0];
    return "";
  });
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState("");
  const [nationality, setNationality] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [alternatePhone, setAlternatePhone] = useState("");
  const [email, setEmail] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Security Form States (Change Password)
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [pwError, setPwError] = useState("");
  const [pwSaving, setPwSaving] = useState(false);

  // Delete Account States
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteReason, setDeleteReason] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState("");

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

  const getHeaders = () => {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const activeToken = token || (typeof window !== "undefined" ? localStorage.getItem("token") : null);
    if (activeToken) headers["Authorization"] = `Bearer ${activeToken}`;
    return headers;
  };

  const fetchProfileData = () => {
    const headers = getHeaders();
    setLoading(true);

    const storedName = typeof window !== "undefined" ? localStorage.getItem("user_full_name") : null;
    const storedEmail = typeof window !== "undefined" ? localStorage.getItem("user_email") : null;
    const storedPhone = typeof window !== "undefined" ? localStorage.getItem("user_phone") : null;

    if (storedName && storedName !== 'Traveler') setFullName(storedName);
    if (storedEmail) setEmail(storedEmail);
    if (storedPhone) setMobileNumber(storedPhone);

    // 1. Fetch Profile (/users/me)
    fetch(`${API_URL}/users/me`, { headers })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        setProfile(data);
        const emailUser = (data.email || storedEmail || "").split('@')[0];
        const validBackendName = (data.full_name && data.full_name !== 'Traveler' && data.full_name !== 'Ghumne Chale Traveler') ? data.full_name : null;
        const validStoredName = (storedName && storedName !== 'Traveler' && storedName !== 'Ghumne Chale Traveler') ? storedName : null;
        const resolvedName = validBackendName || validStoredName || emailUser || "Traveler";

        setFullName(resolvedName);
        if (resolvedName && resolvedName !== 'Traveler') localStorage.setItem("user_full_name", resolvedName);

        setDob(data.dob || "");
        setGender(data.gender || "Male");
        setMobileNumber(data.phone || storedPhone || "");
        setEmail(data.email || storedEmail || "");
        setAvatarUrl(data.avatar_url || null);
      })
      .catch(() => {
        // Fallback to /profile
        fetch(`${API_URL}/profile`, { headers })
          .then(res => res.ok ? res.json() : null)
          .then(data => {
            if (data) {
              setProfile(data);
              if (data.full_name && data.full_name !== 'Traveler') setFullName(data.full_name);
              if (data.dob) setDob(data.dob);
              if (data.gender) setGender(data.gender);
              if (data.mobile_number) setMobileNumber(data.mobile_number);
              if (data.email) setEmail(data.email);
            }
          })
          .catch(() => {});
      });

    // 2. Fetch Preferences
    fetch(`${API_URL}/profile/preferences`, { headers })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data) {
          setPreferences(data);
          setPrefAirline(data.preferred_airline || "");
          setPrefHotel(data.preferred_hotel_chain || "");
          setPrefCabin(data.preferred_cabin_class || "");
          setPrefMeal(data.meal_preference || "");
          setPrefSeat(data.seat_preference || "");
          setPrefStyle(data.travel_style || "");
        }
      })
      .catch(() => {});

    // 3. Fetch Travellers
    fetch(`${API_URL}/profile/travellers`, { headers })
      .then(res => res.ok ? res.json() : [])
      .then(data => setTravellers(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  const fetchSessions = () => {
    fetch(`${API_URL}/users/me/sessions`, { headers: getHeaders() })
      .then(res => res.json())
      .then(data => setSessions(Array.isArray(data) ? data : []))
      .catch(() => {});
  };

  const fetchSecurityEvents = () => {
    fetch(`${API_URL}/users/me/security-events`, { headers: getHeaders() })
      .then(res => res.json())
      .then(data => setSecurityEvents(Array.isArray(data) ? data : []))
      .catch(() => {});
  };

  useEffect(() => {
    fetchProfileData();
  }, [token]);

  useEffect(() => {
    if (activeTab === "sessions") fetchSessions();
    if (activeTab === "activity") fetchSecurityEvents();
  }, [activeTab]);

  // Password strength meter
  const getStrength = (pw: string): { score: number; label: string; color: string } => {
    if (!pw) return { score: 0, label: '', color: '' };
    let score = 0;
    if (pw.length >= 8) score++;
    if (pw.length >= 12) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[a-z]/.test(pw)) score++;
    if (/\d/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    if (score <= 2) return { score, label: 'Weak', color: '#ef4444' };
    if (score <= 4) return { score, label: 'Fair', color: '#f59e0b' };
    return { score, label: 'Strong', color: '#22c55e' };
  };
  const strength = getStrength(newPassword);

  // Avatar Upload Handler
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      alert("Invalid format. Please select a JPG, PNG, or WEBP image.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert("Image is too large. Maximum size is 5MB.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    setUploadingAvatar(true);
    try {
      const res = await fetch(`${API_URL}/users/me/avatar`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Avatar upload failed.");
      setAvatarUrl(data.avatar_url);
      showToastMsg("📸 Profile photo updated!");
      fetchProfileData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUploadingAvatar(false);
    }
  };

  // Save Profile
  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const payload = {
      full_name: fullName,
      phone: mobileNumber,
      dob: dob || null,
      gender: gender || null,
      nationality: nationality || null,
      country: country || null,
      city: city || null,
      state: state || null,
      postal_code: postalCode || null,
      passport_number: passportNumber || null,
      passport_expiry: passportExpiry || null,
      pan_card: panCard || null,
      aadhaar: aadhaar || null,
      emergency_name: emergencyName || null,
      emergency_phone: emergencyPhone || null,
    };

    fetch(`${API_URL}/users/me`, {
      method: "PATCH",
      headers: getHeaders(),
      body: JSON.stringify(payload),
    })
      .then(async res => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.detail || "Failed to update profile.");
        return data;
      })
      .then(() => {
        if (fullName) localStorage.setItem("user_full_name", fullName);
        showToastMsg("✅ Profile saved successfully!");
        fetchProfileData();
      })
      .catch((err) => {
        if (fullName) localStorage.setItem("user_full_name", fullName);
        showToastMsg(err.message === "Failed to fetch" ? "✅ Profile saved locally." : (err.message || "Profile updated."));
      })
      .finally(() => setSaving(false));
  };

  // Change Password
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError("");

    if (!currentPassword) {
      setPwError("Current password is required.");
      return;
    }
    if (newPassword.length < 8) {
      setPwError("New password must be at least 8 characters.");
      return;
    }
    if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/\d/.test(newPassword)) {
      setPwError("Must contain uppercase, lowercase, and numeric characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError("New passwords do not match.");
      return;
    }

    setPwSaving(true);
    try {
      const res = await fetch(`${API_URL}/auth/change-password`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
          confirm_password: confirmPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Password change failed.");

      showToastMsg("🔑 Password changed successfully! Other sessions logged out.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setPwError(err.message);
    } finally {
      setPwSaving(false);
    }
  };

  // Revoke Other Sessions
  const handleRevokeOtherSessions = async () => {
    if (!window.confirm("Log out all other devices and active sessions?")) return;
    try {
      const res = await fetch(`${API_URL}/users/me/sessions/revoke-others`, {
        method: "POST",
        headers: getHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to revoke sessions.");
      showToastMsg("🔒 Other devices logged out successfully.");
      fetchSessions();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Delete Account
  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeleteError("");

    if (!deleteConfirm) {
      setDeleteError("Please check the confirmation box.");
      return;
    }
    if (!deletePassword) {
      setDeleteError("Password is required to confirm account deletion.");
      return;
    }

    setDeleteLoading(true);
    try {
      const res = await fetch(`${API_URL}/users/me/delete`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          password: deletePassword,
          confirm: true,
          reason: deleteReason,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Account deletion failed.");

      alert(data.message || "Account deactivated.");
      localStorage.removeItem("token");
      onNavigate("/");
      window.location.reload();
    } catch (err: any) {
      setDeleteError(err.message);
    } finally {
      setDeleteLoading(false);
    }
  };

  // Save Preferences
  const handleSavePreferences = (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      preferred_airline: prefAirline,
      preferred_hotel_chain: prefHotel,
      preferred_cabin_class: prefCabin,
      meal_preference: prefMeal,
      seat_preference: prefSeat,
      travel_style: prefStyle
    };

    fetch(`${API_URL}/profile/preferences`, {
      method: "PUT",
      headers: getHeaders(),
      body: JSON.stringify(payload)
    })
      .then(res => {
        if (!res.ok) throw new Error("Failed to save preferences.");
        return res.json();
      })
      .then(() => {
        showToastMsg("✨ Preferences updated successfully!");
        fetchProfileData();
      })
      .catch((err) => alert(err.message))
      .finally(() => setSaving(false));
  };

  // Travellers CRUD
  const handleAddOrUpdateTraveller = (e: React.FormEvent) => {
    e.preventDefault();
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
      headers: getHeaders(),
      body: JSON.stringify(payload)
    })
      .then(res => {
        if (!res.ok) throw new Error("Failed to save traveller.");
        return res.json();
      })
      .then(() => {
        showToastMsg(editTravellerId ? "✏️ Traveller updated!" : "➕ Traveller added!");
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
    fetch(`${API_URL}/profile/travellers/${id}`, { method: "DELETE", headers: getHeaders() })
      .then(() => {
        showToastMsg("🗑️ Traveller deleted!");
        fetchProfileData();
      })
      .catch(() => alert("Delete failed."));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#060814] text-white flex items-center justify-center font-sans">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Loading Account Settings...</p>
        </div>
      </div>
    );
  }

  const completionPercent = profile?.profile_completion || 65;

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
          <div className="flex items-center gap-4">
            <div className="relative group">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center overflow-hidden border-2 border-slate-700 shadow-lg">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xl font-black text-white">{fullName?.[0]?.toUpperCase() || "T"}</span>
                )}
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="absolute -bottom-1 -right-1 bg-blue-600 hover:bg-blue-500 p-1.5 rounded-lg border border-slate-900 shadow cursor-pointer transition-transform group-hover:scale-110"
                title="Upload profile photo"
              >
                <Camera size={12} className="text-white" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleAvatarUpload}
              />
            </div>
            <div>
              <h2 className="text-2xl font-black uppercase tracking-wider text-white flex items-center gap-2">
                {fullName || "Traveler Account"}
                {profile?.email_verified ? (
                  <span className="text-[10px] bg-green-500/10 text-green-400 border border-green-500/20 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                    <CheckCircle2 size={10} /> Verified
                  </span>
                ) : (
                  <span className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                    <AlertCircle size={10} /> Email Unverified
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-400">{email} • Member since {profile?.created_at?.slice(0, 10) || "2026"}</p>
            </div>
          </div>
          <button 
            onClick={() => onNavigate("/")}
            className="bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs py-2 px-4 rounded-xl cursor-pointer transition-colors font-bold"
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
        </div>

        {/* Outer Grid: Tabs Sidebar & Active Content Panel */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-start">
          
          {/* Sidebar Tabs */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 space-y-1">
            {[
              { id: "personal", label: "Personal Info", icon: User },
              { id: "security", label: "Account Security", icon: Shield },
              { id: "sessions", label: "Active Sessions", icon: Smartphone },
              { id: "activity", label: "Activity Log", icon: Activity },
              { id: "preferences", label: "Travel Preferences", icon: Award },
              { id: "travellers", label: "Saved Travellers", icon: Globe },
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
          <div className="md:col-span-3 space-y-6">
            
            {/* 1. PERSONAL INFO TAB */}
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
                    <label className="text-[10px] text-slate-500 font-bold block">EMAIL ADDRESS (LOCKED)</label>
                    <input 
                      type="email" 
                      disabled
                      value={email}
                      className="w-full bg-slate-950/60 border border-slate-800 text-slate-400 rounded-xl p-3 cursor-not-allowed"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 font-bold block">PHONE NUMBER</label>
                    <input 
                      type="tel" 
                      value={mobileNumber}
                      onChange={(e) => setMobileNumber(e.target.value)}
                      placeholder="+91 9876543210"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 font-bold block">DATE OF BIRTH</label>
                    <input 
                      type="date" 
                      value={dob}
                      onChange={(e) => setDob(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 focus:border-blue-500 focus:outline-none font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 font-bold block">GENDER</label>
                    <select
                      value={gender}
                      onChange={(e) => setGender(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 focus:border-blue-500 focus:outline-none"
                    >
                      <option value="">Select Gender</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>

                <button 
                  type="submit"
                  disabled={saving}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-black py-3 px-6 rounded-xl text-xs uppercase cursor-pointer transition-all flex items-center justify-center gap-1.5 shadow"
                >
                  <Save size={14} /> {saving ? "Saving Changes..." : "Save Profile Details"}
                </button>
              </form>
            )}

            {/* 2. ACCOUNT SECURITY TAB */}
            {activeTab === "security" && (
              <div className="space-y-6">
                {/* Security Overview Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Email Verification</span>
                      <p className="text-sm font-black text-white mt-0.5">{email}</p>
                    </div>
                    {profile?.email_verified ? (
                      <span className="text-xs text-green-400 bg-green-500/10 border border-green-500/20 px-2.5 py-1 rounded-full font-bold flex items-center gap-1">
                        <CheckCircle2 size={12} /> Verified
                      </span>
                    ) : (
                      <span className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-full font-bold flex items-center gap-1">
                        <AlertCircle size={12} /> Unverified
                      </span>
                    )}
                  </div>

                  <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Phone Protection</span>
                      <p className="text-sm font-black text-white mt-0.5">{mobileNumber || "Not Provided"}</p>
                    </div>
                    <span className="text-xs text-slate-400 bg-slate-800 px-2.5 py-1 rounded-full font-bold">
                      Standard
                    </span>
                  </div>
                </div>

                {/* Change Password Form */}
                <form onSubmit={handleChangePassword} className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-4">
                  <div>
                    <h3 className="text-base font-black uppercase text-white flex items-center gap-2">
                      <Key size={16} className="text-yellow-400" /> Change Password
                    </h3>
                    <p className="text-xs text-slate-500">Update your account password regularly to protect bookings and saved cards.</p>
                  </div>

                  {pwError && (
                    <div className="bg-red-500/10 border border-red-500/30 p-3 rounded-xl text-red-400 text-xs font-bold">
                      ⚠️ {pwError}
                    </div>
                  )}

                  <div className="space-y-3 text-xs">
                    <div>
                      <label className="text-[10px] text-slate-400 font-bold block mb-1">CURRENT PASSWORD *</label>
                      <div className="relative">
                        <input
                          type={showCurrentPw ? "text" : "password"}
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 pr-10 focus:border-blue-500 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setShowCurrentPw(!showCurrentPw)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-[10px] font-bold"
                        >
                          {showCurrentPw ? "HIDE" : "SHOW"}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-400 font-bold block mb-1">NEW PASSWORD * (MIN 8 CHARS)</label>
                      <div className="relative">
                        <input
                          type={showNewPw ? "text" : "password"}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 pr-10 focus:border-blue-500 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPw(!showNewPw)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-[10px] font-bold"
                        >
                          {showNewPw ? "HIDE" : "SHOW"}
                        </button>
                      </div>
                      {newPassword && (
                        <div className="mt-1.5">
                          <div className="flex gap-1 mb-1">
                            {[1, 2, 3, 4, 5, 6].map(i => (
                              <div
                                key={i}
                                className="h-1 flex-1 rounded-full transition-all"
                                style={{ background: i <= strength.score ? strength.color : '#1e293b' }}
                              />
                            ))}
                          </div>
                          <span className="text-[10px] font-bold" style={{ color: strength.color }}>
                            {strength.label} password
                          </span>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-400 font-bold block mb-1">CONFIRM NEW PASSWORD *</label>
                      <div className="relative">
                        <input
                          type={showConfirmPw ? "text" : "password"}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 pr-10 focus:border-blue-500 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPw(!showConfirmPw)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-[10px] font-bold"
                        >
                          {showConfirmPw ? "HIDE" : "SHOW"}
                        </button>
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={pwSaving}
                    className="bg-yellow-400 hover:bg-yellow-300 text-black font-black py-3 px-6 rounded-xl text-xs uppercase cursor-pointer transition-all flex items-center justify-center gap-1.5 shadow"
                  >
                    {pwSaving ? "Updating Password..." : "Update Password"}
                  </button>
                </form>

                {/* Danger Zone: Delete Account */}
                <div className="bg-red-950/20 border border-red-900/30 p-6 rounded-3xl space-y-3">
                  <div>
                    <h3 className="text-sm font-black uppercase text-red-400">Danger Zone — Deactivate Account</h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Deactivating your account will anonymize personal data and revoke all sessions. Historical booking receipts and tickets are retained for accounting and compliance.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowDeleteModal(true)}
                    className="bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/30 text-xs font-black py-2.5 px-4 rounded-xl cursor-pointer transition-colors"
                  >
                    Deactivate Account →
                  </button>
                </div>
              </div>
            )}

            {/* 3. ACTIVE SESSIONS TAB */}
            {activeTab === "sessions" && (
              <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-6">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-base font-black uppercase text-white">Active Sessions & Devices</h3>
                    <p className="text-xs text-slate-500">Manage signed-in web browsers, mobile devices, and sessions.</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleRevokeOtherSessions}
                    className="bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/30 text-xs font-bold py-2 px-3.5 rounded-xl cursor-pointer transition-colors flex items-center gap-1.5"
                  >
                    <LogOut size={12} /> Log Out Other Devices
                  </button>
                </div>

                <div className="space-y-3">
                  {sessions.length === 0 ? (
                    <div className="text-center py-8 text-slate-500 text-xs font-bold">
                      No additional active sessions found.
                    </div>
                  ) : (
                    sessions.map((sess) => (
                      <div
                        key={sess.id}
                        className={`p-4 rounded-2xl border flex items-center justify-between text-xs ${
                          sess.is_current
                            ? "bg-blue-950/20 border-blue-500/40"
                            : "bg-slate-950 border-slate-800"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Smartphone size={20} className={sess.is_current ? "text-blue-400" : "text-slate-500"} />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white">{sess.device_id}</span>
                              {sess.is_current && (
                                <span className="text-[9px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded font-black uppercase">
                                  This Device
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                              IP: {sess.ip_address} • Last active: {sess.last_used_at?.slice(0, 16).replace("T", " ")}
                            </p>
                          </div>
                        </div>
                        <span className="text-[10px] text-green-400 font-bold bg-green-500/10 px-2 py-0.5 rounded">
                          Active
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* 4. ACTIVITY LOG TAB */}
            {activeTab === "activity" && (
              <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-6">
                <div>
                  <h3 className="text-base font-black uppercase text-white">Security Activity Log</h3>
                  <p className="text-xs text-slate-500">Audit trail of recent logins, password updates, and session actions.</p>
                </div>

                <div className="space-y-2">
                  {securityEvents.length === 0 ? (
                    <div className="text-center py-8 text-slate-500 text-xs font-bold">
                      No recent security events recorded.
                    </div>
                  ) : (
                    securityEvents.map((ev) => (
                      <div
                        key={ev.id}
                        className="bg-slate-950 border border-slate-800 p-3.5 rounded-2xl flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-3">
                          <Activity size={16} className="text-blue-400" />
                          <div>
                            <span className="font-mono font-bold text-slate-200">{ev.event_type}</span>
                            {ev.details && <p className="text-[11px] text-slate-400 mt-0.5">{ev.details}</p>}
                          </div>
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {ev.created_at?.slice(0, 16).replace("T", " ")}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* 5. PREFERENCES TAB */}
            {activeTab === "preferences" && (
              <form onSubmit={handleSavePreferences} className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-6">
                <div>
                  <h3 className="text-base font-black uppercase text-white">Travel Preferences</h3>
                  <p className="text-xs text-slate-500">Customize auto-selected seats, meal types, and cabins.</p>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 font-bold block">PREFERRED CABIN CLASS</label>
                    <select
                      value={prefCabin}
                      onChange={(e) => setPrefCabin(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 focus:border-blue-500 focus:outline-none"
                    >
                      <option value="">No Preference</option>
                      <option value="economy">Economy</option>
                      <option value="premium_economy">Premium Economy</option>
                      <option value="business">Business Class</option>
                      <option value="first">First Class</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 font-bold block">PREFERRED AIRLINE</label>
                    <input 
                      type="text" 
                      value={prefAirline}
                      onChange={(e) => setPrefAirline(e.target.value)}
                      placeholder="Ex: Emirates, IndiGo, Air India"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 font-bold block">SEAT PREFERENCE</label>
                    <select
                      value={prefSeat}
                      onChange={(e) => setPrefSeat(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 focus:border-blue-500 focus:outline-none"
                    >
                      <option value="">No Preference</option>
                      <option value="window">Window Seat</option>
                      <option value="aisle">Aisle Seat</option>
                      <option value="extra_legroom">Extra Legroom</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 font-bold block">MEAL PREFERENCE</label>
                    <select
                      value={prefMeal}
                      onChange={(e) => setPrefMeal(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 focus:border-blue-500 focus:outline-none"
                    >
                      <option value="">Standard Meal</option>
                      <option value="veg">Vegetarian (AVML)</option>
                      <option value="vegan">Vegan Meal (VGML)</option>
                      <option value="jain">Jain Meal (VJML)</option>
                      <option value="non_veg">Non-Vegetarian</option>
                    </select>
                  </div>
                </div>

                <button 
                  type="submit"
                  disabled={saving}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-black py-3 px-6 rounded-xl text-xs uppercase cursor-pointer transition-all flex items-center justify-center gap-1.5 shadow"
                >
                  <Save size={14} /> {saving ? "Saving..." : "Save Preferences"}
                </button>
              </form>
            )}

            {/* 6. SAVED TRAVELLERS TAB */}
            {activeTab === "travellers" && (
              <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-6">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-base font-black uppercase text-white">Co-Travellers Master List</h3>
                    <p className="text-xs text-slate-500">Save family and colleagues to speed up multi-passenger checkout.</p>
                  </div>
                  <button 
                    onClick={() => {
                      setShowAddTraveller(!showAddTraveller);
                      setEditTravellerId(null);
                    }}
                    className="bg-blue-600 hover:bg-blue-500 text-xs font-black text-white px-4 py-2 rounded-xl flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Plus size={14} /> Add Traveller
                  </button>
                </div>

                {showAddTraveller && (
                  <form onSubmit={handleAddOrUpdateTraveller} className="bg-slate-950 border border-slate-800 p-5 rounded-2xl space-y-4">
                    <h4 className="text-xs font-black text-blue-400 uppercase">
                      {editTravellerId ? "Edit Traveller" : "New Traveller"}
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      <input 
                        type="text" 
                        required 
                        placeholder="Legal Name *" 
                        value={tName} 
                        onChange={e => setTName(e.target.value)} 
                        className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl"
                      />
                      <input 
                        type="number" 
                        required 
                        placeholder="Age *" 
                        value={tAge} 
                        onChange={e => setTAge(e.target.value)} 
                        className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl"
                      />
                      <select 
                        value={tGender} 
                        onChange={e => setTGender(e.target.value)} 
                        className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl"
                      >
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div className="flex justify-end gap-2 text-xs">
                      <button 
                        type="button" 
                        onClick={() => setShowAddTraveller(false)}
                        className="bg-slate-800 px-4 py-2 rounded-xl text-slate-300 font-bold cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button 
                        type="submit" 
                        disabled={saving}
                        className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-xl text-white font-black cursor-pointer"
                      >
                        Save Traveller
                      </button>
                    </div>
                  </form>
                )}

                <div className="space-y-3">
                  {travellers.length === 0 ? (
                    <div className="text-center py-8 text-slate-500 text-xs font-bold">
                      No saved travellers yet. Click "Add Traveller" above to add family members.
                    </div>
                  ) : (
                    travellers.map((t) => (
                      <div key={t.id} className="bg-slate-950 border border-slate-800 p-4 rounded-2xl flex items-center justify-between text-xs">
                        <div>
                          <span className="font-black text-white">{t.name}</span>
                          <span className="text-slate-400 ml-2">({t.age} yrs, {t.gender})</span>
                          {t.passport && <p className="text-[10px] font-mono text-slate-500 mt-0.5">Passport: {t.passport}</p>}
                        </div>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => {
                              setEditTravellerId(t.id);
                              setTName(t.name);
                              setTAge(t.age.toString());
                              setTGender(t.gender);
                              setTPassport(t.passport || "");
                              setTNationality(t.nationality || "");
                              setTMeal(t.meal || "");
                              setTSeat(t.seat || "");
                              setShowAddTraveller(true);
                            }}
                            className="bg-slate-800 hover:bg-slate-700 p-2 rounded-lg text-slate-300 cursor-pointer"
                          >
                            <Edit size={12} />
                          </button>
                          <button 
                            onClick={() => handleDeleteTraveller(t.id)}
                            className="bg-red-500/10 hover:bg-red-500/20 text-red-400 p-2 rounded-lg cursor-pointer"
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

          </div>

        </div>

      </div>

      {/* Delete Account Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#0f172a] border border-red-500/40 max-w-md w-full p-6 rounded-3xl shadow-2xl space-y-4 text-left">
            <h3 className="text-base font-black text-red-400 uppercase">Confirm Account Deactivation</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              This action will sign you out and anonymize your account details. In accordance with financial accounting regulations, historical booking tickets and invoices will be safely retained.
            </p>

            {deleteError && (
              <div className="bg-red-500/10 border border-red-500/30 p-2.5 rounded-xl text-red-400 text-xs font-bold">
                ⚠️ {deleteError}
              </div>
            )}

            <form onSubmit={handleDeleteAccount} className="space-y-3 text-xs">
              <div>
                <label className="text-[10px] text-slate-400 font-bold block mb-1">ENTER YOUR PASSWORD *</label>
                <input
                  type="password"
                  required
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 focus:border-red-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 font-bold block mb-1">REASON (OPTIONAL)</label>
                <input
                  type="text"
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  placeholder="Tell us why you are leaving..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 focus:border-red-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="confirmDelete"
                  checked={deleteConfirm}
                  onChange={(e) => setDeleteConfirm(e.target.checked)}
                  className="w-4 h-4 rounded"
                />
                <label htmlFor="confirmDelete" className="text-[11px] text-slate-300 font-bold cursor-pointer">
                  I understand the consequences of deactivation
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(false)}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2.5 px-4 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={deleteLoading || !deleteConfirm}
                  className="bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-black py-2.5 px-4 rounded-xl cursor-pointer"
                >
                  {deleteLoading ? "Deactivating..." : "Deactivate Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
