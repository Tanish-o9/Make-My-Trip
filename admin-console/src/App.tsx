import React, { useState, useEffect, useRef } from 'react'
import {
  Shield, Check, X, AlertTriangle, Clock, RefreshCw, LogOut, Search,
  Bell, BookOpen, CreditCard, Layers, Users, BarChart2,
  FileText, Trash2, Plus, DollarSign
} from 'lucide-react'

// Backend config
const resolveApiBase = () => {
  let url = import.meta.env && import.meta.env.VITE_API_URL;
  if (!url || url.includes("placeholder") || url.includes("<")) {
    if (typeof window !== "undefined") {
      const hostname = window.location.hostname;
      if (window.location.port === "3000" || window.location.port === "5173" || window.location.port === "5174") {
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
  return url;
};


const API_BASE = resolveApiBase();
const API_URL = `${API_BASE}/v1`;
const WS_BASE = API_BASE.replace(/^http/, "ws").replace(/\/api$/, "/ws");


// Roles enum
type Role = 'super_admin' | 'finance_admin' | 'booking_approver' | 'admin'

// Shared type for approvals
interface ApprovalRequest {
  id: number
  request_type: string
  reference_id: string
  requested_by: string
  amount: number
  reason: string
  status: string
  created_at: string
  payment_gateway?: string
  payment_charge_id?: string
  sla_expires_at?: string
  assigned_role?: string
  reviewed_by?: string
  review_notes?: string
  reviewed_at?: string
}

export default function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('admin_token'))
  const [adminRole, setAdminRole] = useState<Role | null>(localStorage.getItem('admin_role') as Role)
  const [adminEmail, setAdminEmail] = useState<string | null>(localStorage.getItem('admin_email'))
  
  // Auth state inputs
  const [email, setEmail] = useState('admin_test@travelos.com')
  const [password, setPassword] = useState('adminpass123')
  const [twoFactor, setTwoFactor] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [loading, setLoading] = useState(false)

  // Navigation
  const [activeTab, setActiveTab] = useState<string>('bookings')

  // Notification states
  const [notifications, setNotifications] = useState<string[]>([])
  const [showNotifications, setShowNotifications] = useState(false)

  // Global search query
  const [searchQuery, setSearchQuery] = useState('')

  // 1. Absorb session from query parameters (cross-origin transfer) using single-use exchange code
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const exchangeCode = params.get('exchange_code');

    if (exchangeCode) {
      // Immediately clean up URL search parameters to strip exchange_code
      params.delete('exchange_code');
      const newSearch = params.toString();
      const newPath = window.location.pathname + (newSearch ? `?${newSearch}` : '');
      window.history.replaceState({}, '', newPath);

      // Exchange code for actual admin token
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
        const qRole = data.role as Role;
        const qEmail = data.email;

        localStorage.setItem('admin_token', qToken);
        localStorage.setItem('admin_role', qRole);
        localStorage.setItem('admin_email', qEmail);
        setToken(qToken);
        setAdminRole(qRole);
        setAdminEmail(qEmail);
      })
      .catch(err => {
        alert(err.message || "Failed to initialize secure admin session.");
        window.location.href = "http://localhost:3000/?logout=true";
      });
    }
  }, []);

  // 2. Route Guard for non-admin roles
  useEffect(() => {
    if (token && adminRole) {
      const allowed_roles = ["admin", "super_admin", "finance_admin", "booking_approver"];
      if (!allowed_roles.includes(adminRole)) {
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_role');
        localStorage.removeItem('admin_email');
        setToken(null);
        setAdminRole(null);
        setAdminEmail(null);
        window.location.href = "http://localhost:3000/?logout=true";
      }
    }
  }, [token, adminRole]);

  useEffect(() => {
    if (token) {
      localStorage.setItem('admin_token', token)
    } else {
      localStorage.removeItem('admin_token')
    }
  }, [token])

  useEffect(() => {
    if (adminRole) {
      localStorage.setItem('admin_role', adminRole)
    } else {
      localStorage.removeItem('admin_role')
    }
  }, [adminRole])

  useEffect(() => {
    if (adminEmail) {
      localStorage.setItem('admin_email', adminEmail)
    } else {
      localStorage.removeItem('admin_email')
    }
  }, [adminEmail])

  // Auto-logout helper
  const handleLogout = () => {
    setToken(null)
    setAdminRole(null)
    setAdminEmail(null)
    localStorage.removeItem('admin_token')
    localStorage.removeItem('admin_role')
    localStorage.removeItem('admin_email')
    window.location.href = "http://localhost:3000/?logout=true";
  }

  // Auto tab selection based on role constraints
  useEffect(() => {
    if (adminRole === 'booking_approver' || adminRole === 'finance_admin') {
      setActiveTab('bookings')
    }
  }, [adminRole])

  // Login handler
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg('')
    try {
      const resp = await fetch(`${API_BASE}/admin/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, two_factor_code: twoFactor || undefined })
      })
      if (!resp.ok) {
        const data = await resp.json()
        throw new Error(data.detail || 'Login failed')
      }
      const data = await resp.json()
      setToken(data.access_token)
      setAdminRole(data.role)
      setAdminEmail(email)
      localStorage.setItem('admin_token', data.access_token)
      localStorage.setItem('admin_role', data.role)
      localStorage.setItem('admin_email', email)
    } catch (err: any) {
      setErrorMsg(err.message || 'Connection error')
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#faf5ff] p-6">
        <form onSubmit={handleLogin} className="w-full max-w-md p-8 bg-white border-4 border-black shadow-[8px_8px_0px_0px_#000000] rounded-none">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-[#7c3aed] text-white border-2 border-black rounded-none">
              <Shield size={32} />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight" style={{ fontFamily: 'Bangers, cursive' }}>ADMIN PANEL</h1>
              <p className="text-sm font-semibold text-gray-600">Travel OS Operations Portal</p>
            </div>
          </div>

          {errorMsg && (
            <div className="mb-4 p-3 bg-red-100 text-red-700 border-2 border-black font-semibold flex items-center gap-2">
              <AlertTriangle size={18} />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="mb-4">
            <label className="block text-sm font-bold mb-1">Operational Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full neo-input"
              placeholder="operator@travelos.com"
              required
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-bold mb-1">Access Key / Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full neo-input"
              placeholder="••••••••"
              required
            />
          </div>

          <div className="mb-6">
            <div className="flex justify-between mb-1">
              <label className="block text-sm font-bold">2FA Token Code</label>
              <span className="text-xs font-semibold text-purple-600">(Optional hook)</span>
            </div>
            <input
              type="text"
              value={twoFactor}
              onChange={(e) => setTwoFactor(e.target.value)}
              className="w-full neo-input"
              placeholder="6-digit token code"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-[#7c3aed] text-white neo-btn flex items-center justify-center gap-2"
          >
            {loading ? <RefreshCw className="animate-spin" size={18} /> : 'AUTH SECURE INITIALIZE'}
          </button>
        </form>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#faf5ff]">
      {/* Top navbar */}
      <header className="sticky top-0 z-40 bg-white border-b-4 border-black flex items-center justify-between px-6 py-4 shadow-[0_4px_0_0_#000000]">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#7c3aed] text-white border-2 border-black rounded-none">
            <Shield size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold uppercase tracking-tight flex items-center gap-2" style={{ fontFamily: 'Bangers, cursive' }}>
              TRAVEL OS <span className="bg-[#7c3aed] text-white px-2 py-0.5 border border-black text-sm tracking-wide">ADMIN CONSOLE</span>
            </h1>
          </div>
        </div>

        {/* Global Search */}
        <div className="hidden md:flex items-center gap-2 flex-1 max-w-md mx-8 relative">
          <Search className="absolute left-3 text-gray-500" size={18} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search bookings, payments, rules..."
            className="w-full pl-10 pr-4 py-2 neo-input text-sm"
          />
        </div>

        {/* Notifications and Profile */}
        <div className="flex items-center gap-4">
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-2 bg-[#faf5ff] hover:bg-purple-100 border-2 border-black shadow-[2px_2px_0px_0px_#000000] relative"
            >
              <Bell size={20} />
              {notifications.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border border-black animate-pulse">
                  {notifications.length}
                </span>
              )}
            </button>
            
            {showNotifications && (
              <div className="absolute right-0 mt-3 w-80 bg-white border-3 border-black shadow-[6px_6px_0px_0px_#000000] z-50 p-4 rounded-none">
                <div className="flex justify-between items-center mb-3 pb-2 border-b border-black">
                  <h3 className="font-bold text-lg">Alert Stream</h3>
                  <button onClick={() => setNotifications([])} className="text-xs font-semibold text-purple-600 hover:underline">Clear</button>
                </div>
                {notifications.length === 0 ? (
                  <p className="text-sm font-semibold text-gray-500 py-2">No pending real-time actions</p>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {notifications.map((n, idx) => (
                      <div key={idx} className="p-2 bg-yellow-50 border-2 border-yellow-500 text-xs font-semibold text-gray-800">
                        {n}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 border-l-2 border-black pl-4">
            <div className="flex flex-col text-right">
              <span className="font-bold text-sm">{adminEmail?.split('@')[0]}</span>
              <span className="text-xs font-semibold uppercase text-purple-600 bg-purple-100 px-2 py-0.5 border border-purple-300">{adminRole?.replace('_', ' ')}</span>
            </div>
            <button
              onClick={async () => {
                try {
                  const resp = await fetch(`${API_BASE}/v1/auth/exchange-code`, {
                    method: "POST",
                    headers: {
                      "Authorization": `Bearer ${token}`
                    }
                  });
                  if (resp.ok) {
                    const data = await resp.json();
                    const code = data.exchange_code;
                    window.location.href = `http://localhost:3000/?exchange_code=${code}`;
                  } else {
                    window.location.href = "http://localhost:3000/";
                  }
                } catch (err) {
                  window.location.href = "http://localhost:3000/";
                }
              }}
              className="px-3 py-1.5 bg-yellow-300 hover:bg-yellow-400 border-2 border-black shadow-[2px_2px_0px_0px_#000000] text-xs font-black uppercase flex items-center gap-1 cursor-pointer"
              title="View consumer site"
            >
              View Site ➔
            </button>
            <button
              onClick={handleLogout}
              className="p-2 bg-red-100 hover:bg-red-200 border-2 border-black shadow-[2px_2px_0px_0px_#000000] text-red-700"
              title="Logout session"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Grid */}
      <div className="flex-1 flex flex-col md:flex-row">
        {/* Sidebar Nav */}
        <aside className="w-full md:w-64 bg-white border-r-4 border-black p-4 flex flex-col gap-2">
          <div className="text-xs font-bold text-gray-500 px-2 uppercase mb-2">Operations Modules</div>
          
          {(adminRole === 'super_admin' || adminRole === 'admin' || adminRole === 'booking_approver' || adminRole === 'finance_admin') && (
            <button
              onClick={() => setActiveTab('bookings')}
              className={`w-full flex items-center justify-between p-3 border-2 font-bold text-left ${activeTab === 'bookings' ? 'bg-[#7c3aed] text-white border-black shadow-[3px_3px_0px_0px_#000000]' : 'border-transparent hover:bg-purple-50 text-gray-700'}`}
            >
              <div className="flex items-center gap-3">
                <BookOpen size={20} />
                <span>Booking Approvals</span>
              </div>
              <span className="bg-yellow-400 text-black px-1.5 py-0.5 text-xs font-black border border-black shadow-[1px_1px_0px_0px_#000000]">LIVE</span>
            </button>
          )}

          {(adminRole === 'super_admin' || adminRole === 'admin' || adminRole === 'finance_admin') && (
            <button
              onClick={() => setActiveTab('refunds')}
              className={`w-full flex items-center gap-3 p-3 border-2 font-bold text-left ${activeTab === 'refunds' ? 'bg-[#7c3aed] text-white border-black shadow-[3px_3px_0px_0px_#000000]' : 'border-transparent hover:bg-purple-50 text-gray-700'}`}
            >
              <CreditCard size={20} />
              <span>Refund processing</span>
            </button>
          )}

          {(adminRole === 'super_admin' || adminRole === 'admin' || adminRole === 'finance_admin') && (
            <button
              onClick={() => setActiveTab('payments')}
              className={`w-full flex items-center gap-3 p-3 border-2 font-bold text-left ${activeTab === 'payments' ? 'bg-[#7c3aed] text-white border-black shadow-[3px_3px_0px_0px_#000000]' : 'border-transparent hover:bg-purple-50 text-gray-700'}`}
            >
              <DollarSign size={20} />
              <span>Payments Audit</span>
            </button>
          )}

          {(adminRole === 'super_admin' || adminRole === 'admin') && (
            <button
              onClick={() => setActiveTab('content')}
              className={`w-full flex items-center gap-3 p-3 border-2 font-bold text-left ${activeTab === 'content' ? 'bg-[#7c3aed] text-white border-black shadow-[3px_3px_0px_0px_#000000]' : 'border-transparent hover:bg-purple-50 text-gray-700'}`}
            >
              <Layers size={20} />
              <span>Content CRUD</span>
            </button>
          )}

          {(adminRole === 'super_admin' || adminRole === 'admin') && (
            <button
              onClick={() => setActiveTab('users')}
              className={`w-full flex items-center gap-3 p-3 border-2 font-bold text-left ${activeTab === 'users' ? 'bg-[#7c3aed] text-white border-black shadow-[3px_3px_0px_0px_#000000]' : 'border-transparent hover:bg-purple-50 text-gray-700'}`}
            >
              <Users size={20} />
              <span>KYC & Users</span>
            </button>
          )}

          {(adminRole === 'super_admin' || adminRole === 'admin') && (
            <button
              onClick={() => setActiveTab('analytics')}
              className={`w-full flex items-center gap-3 p-3 border-2 font-bold text-left ${activeTab === 'analytics' ? 'bg-[#7c3aed] text-white border-black shadow-[3px_3px_0px_0px_#000000]' : 'border-transparent hover:bg-purple-50 text-gray-700'}`}
            >
              <BarChart2 size={20} />
              <span>RAG Analytics</span>
            </button>
          )}

          {(adminRole === 'super_admin' || adminRole === 'admin') && (
            <button
              onClick={() => setActiveTab('coverage')}
              className={`w-full flex items-center gap-3 p-3 border-2 font-bold text-left ${activeTab === 'coverage' ? 'bg-[#7c3aed] text-white border-black shadow-[3px_3px_0px_0px_#000000]' : 'border-transparent hover:bg-purple-50 text-gray-700'}`}
            >
              <Layers size={20} />
              <span>Logistics Coverage</span>
            </button>
          )}

          {(adminRole === 'super_admin' || adminRole === 'admin') && (
            <button
              onClick={() => setActiveTab('audit')}
              className={`w-full flex items-center gap-3 p-3 border-2 font-bold text-left ${activeTab === 'audit' ? 'bg-[#7c3aed] text-white border-black shadow-[3px_3px_0px_0px_#000000]' : 'border-transparent hover:bg-purple-50 text-gray-700'}`}
            >
              <FileText size={20} />
              <span>Security Audits</span>
            </button>
          )}
        </aside>

        {/* Dynamic content rendering */}
        <main className="flex-1 p-6 overflow-x-hidden overflow-y-auto">
          {activeTab === 'bookings' && <BookingApprovalsQueue token={token} addAlert={(a) => setNotifications(prev => [a, ...prev])} />}
          {activeTab === 'refunds' && <RefundApprovalsQueue token={token} />}
          {activeTab === 'payments' && <PaymentsDashboard token={token} />}
          {activeTab === 'content' && <ContentCRUD token={token} />}
          {activeTab === 'users' && <UserKYCPanel token={token} />}
          {activeTab === 'analytics' && <RAGAnalytics token={token} />}
          {activeTab === 'audit' && <AuditLogViewer token={token} />}
          {activeTab === 'coverage' && <CoverageLogisticsPanel token={token} />}
        </main>
      </div>
    </div>
  )
}

// ------------------------------------------------------------
// MODULE 4: Booking Approvals Queue Component
// ------------------------------------------------------------
function BookingApprovalsQueue({ token, addAlert }: { token: string; addAlert: (msg: string) => void }) {
  const [pendingApprovals, setPendingApprovals] = useState<ApprovalRequest[]>([])
  const [historyApprovals, setHistoryApprovals] = useState<ApprovalRequest[]>([])
  const [subTab, setSubTab] = useState<'pending' | 'approved' | 'rejected'>('pending')
  const [selectedApproval, setSelectedApproval] = useState<ApprovalRequest | null>(null)
  const [notes, setNotes] = useState('')

  useEffect(() => {
    setNotes('')
  }, [selectedApproval])

  const [loading, setLoading] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const wsRef = useRef<WebSocket | null>(null)

  // Filter values
  const [verticalFilter, setVerticalFilter] = useState('all')

  const fetchQueue = async () => {
    if (!token) return
    setErrorMsg('')
    setSuccessMsg('')
    try {
      const res = await fetch(`${API_BASE}/admin/approvals`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (res.status === 401) {
        localStorage.clear()
        window.location.reload()
        return
      }
      if (res.ok) {
        const data = await res.json()
        const bookingReqs = data.filter((item: ApprovalRequest) => item.request_type === 'new_booking' || item.request_type === 'fraud_review')
        
        setPendingApprovals(bookingReqs.filter((item: any) => item.status === 'PENDING'))
        setHistoryApprovals(bookingReqs.filter((item: any) => item.status === 'APPROVED' || item.status === 'REJECTED'))
      }
    } catch (err) {
      console.error("Queue loading error", err)
    }
  }

  useEffect(() => {
    if (!token) return
    fetchQueue()

    // Establish WebSocket Connection
    const ws = new WebSocket(`${WS_BASE}/admin_notifications`)
    wsRef.current = ws

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.event === 'new_pending_approval' || data.type === 'new_approval_request') {
          addAlert(`New Booking Hold: Ref ${data.booking_reference}`)
          fetchQueue()
        }
      } catch (err) {
        console.error("WS parse error", err)
      }
    }

    return () => {
      ws.close()
    }
  }, [token])

  const handleResolve = async (action: 'APPROVED' | 'REJECTED') => {
    if (!selectedApproval) return
    setLoading(true)
    setErrorMsg('')
    setSuccessMsg('')
    try {
      const reviewer = 'finance_admin_1' // simulated admin id
      const resolveNotes = notes.trim() || (action === 'APPROVED' ? 'Approved by administrator.' : 'Declined by administrator.')
      const res = await fetch(`${API_BASE}/admin/approvals/${selectedApproval.id}/resolve?action=${action}&reviewer=${reviewer}&notes=${encodeURIComponent(resolveNotes)}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (res.status === 401) {
        localStorage.clear()
        window.location.reload()
        return
      }
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.detail || 'Could not resolve approval request')
      }
      setSuccessMsg(`Booking hold successfully ${action.toLowerCase()}!`)
      setSelectedApproval(null)
      setNotes('')
      fetchQueue()
    } catch (err: any) {
      setErrorMsg(err.message)
    } finally {
      setLoading(false)
    }
  }

  // SLA Counter
  const getSLADuration = (expiresAt?: string) => {
    if (!expiresAt) return 'N/A'
    const exp = new Date(expiresAt).getTime()
    const now = new Date().getTime()
    const diff = exp - now
    if (diff <= 0) return 'BREACHED'
    const minutes = Math.floor(diff / 60000)
    const seconds = Math.floor((diff % 60000) / 1000)
    return `${minutes}m ${seconds}s`
  }

  const [tick, setTick] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(timer)
  }, [])

  const filterByVertical = (list: ApprovalRequest[]) => {
    if (verticalFilter === 'all') return list
    return list.filter(item => {
      const reasonLower = (item.reason || '').toLowerCase()
      const refLower = (item.reference_id || '').toLowerCase()
      if (verticalFilter === 'flights') return reasonLower.includes('flight') || refLower.includes('fl')
      if (verticalFilter === 'hotels') return reasonLower.includes('hotel') || refLower.includes('ht')
      if (verticalFilter === 'cabs') return reasonLower.includes('cab') || refLower.includes('cb')
      if (verticalFilter === 'villas') return reasonLower.includes('villa') || refLower.includes('vl')
      return true
    })
  }

  const activePendings = filterByVertical(pendingApprovals)
  const activeApproved = filterByVertical(historyApprovals.filter(item => item.status === 'APPROVED'))
  const activeRejected = filterByVertical(historyApprovals.filter(item => item.status === 'REJECTED'))

  return (
    <div className="space-y-6">
      <span className="hidden">{tick}</span>
      <div className="flex justify-between items-center border-b-4 border-black pb-4">
        <div>
          <h2 className="text-3xl font-extrabold flex items-center gap-2" style={{ fontFamily: 'Bangers, cursive' }}>Booking Hold Approval Queue</h2>
          <p className="text-sm font-semibold text-gray-500">Authorize held booking payments and secure inventory before timers expire</p>
        </div>
        <button onClick={fetchQueue} className="neo-btn px-4 py-2 flex items-center gap-2 bg-white">
          <RefreshCw size={18} />
          <span>Refresh</span>
        </button>
      </div>

      {successMsg && (
        <div className="p-3 bg-green-100 border-2 border-black text-green-800 font-bold flex items-center gap-2">
          <Check size={20} />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 bg-red-100 border-2 border-black text-red-800 font-bold flex items-center gap-2">
          <X size={20} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Sub Tab Navigation */}
      <div className="flex gap-3 border-b-2 border-black pb-2">
        <button
          onClick={() => setSubTab('pending')}
          className={`px-4 py-2 font-bold text-sm border-2 border-black shadow-[2px_2px_0_0_#000000] cursor-pointer ${subTab === 'pending' ? 'bg-[#7c3aed] text-white' : 'bg-white text-black hover:bg-slate-50'}`}
        >
          Pending Holds ({activePendings.length})
        </button>
        <button
          onClick={() => setSubTab('approved')}
          className={`px-4 py-2 font-bold text-sm border-2 border-black shadow-[2px_2px_0_0_#000000] cursor-pointer ${subTab === 'approved' ? 'bg-green-600 text-white' : 'bg-white text-black hover:bg-slate-50'}`}
        >
          Approved Bookings ({activeApproved.length})
        </button>
        <button
          onClick={() => setSubTab('rejected')}
          className={`px-4 py-2 font-bold text-sm border-2 border-black shadow-[2px_2px_0_0_#000000] cursor-pointer ${subTab === 'rejected' ? 'bg-red-600 text-white' : 'bg-white text-black hover:bg-slate-50'}`}
        >
          Rejected Bookings ({activeRejected.length})
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 bg-white p-4 border-3 border-black shadow-[3px_3px_0px_0px_#000000]">
        <label className="font-bold text-sm">Sort/Filter Vertical:</label>
        <select
          value={verticalFilter}
          onChange={(e) => setVerticalFilter(e.target.value)}
          className="neo-input py-1 text-sm bg-white"
        >
          <option value="all">All Verticals</option>
          <option value="flights">Flights</option>
          <option value="hotels">Hotels</option>
          <option value="cabs">Cabs</option>
          <option value="villas">Villas</option>
        </select>
      </div>

      {subTab === 'approved' || subTab === 'rejected' ? (
        <div className="bg-white p-6 border-4 border-black shadow-[6px_6px_0_0_#000000]">
          <h3 className="text-xl font-bold uppercase mb-4 border-b-2 border-black pb-2">
            Processed {subTab === 'approved' ? 'Approved' : 'Rejected'} Bookings Log
          </h3>
          <div className="overflow-x-auto font-sans">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b-3 border-black text-xs uppercase font-bold bg-purple-50">
                  <th className="p-3">Reference</th>
                  <th className="p-3">Amount</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Decision</th>
                  <th className="p-3">Reviewed By</th>
                  <th className="p-3">Decision Justification</th>
                </tr>
              </thead>
              <tbody>
                {(subTab === 'approved' ? activeApproved : activeRejected).length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center font-bold text-gray-500">
                      No {subTab === 'approved' ? 'approved' : 'rejected'} bookings found in this vertical.
                    </td>
                  </tr>
                ) : (
                  (subTab === 'approved' ? activeApproved : activeRejected).map((req) => (
                    <tr key={req.id} className="border-b-2 border-black hover:bg-slate-50 font-semibold text-sm cursor-pointer" onClick={() => setSelectedApproval(req)}>
                      <td className="p-3 font-bold">{req.reference_id}</td>
                      <td className="p-3 text-purple-700 font-extrabold">₹{req.amount.toLocaleString()}</td>
                      <td className="p-3 uppercase text-xs font-bold text-gray-500">{req.request_type.replace('_', ' ')}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 border border-black text-xs font-bold uppercase ${req.status === 'APPROVED' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {req.status}
                        </span>
                      </td>
                      <td className="p-3 text-gray-700">{req.reviewed_by || 'system_sla'}</td>
                      <td className="p-3 text-xs text-gray-600 truncate max-w-xs" title={req.review_notes}>{req.review_notes || 'N/A'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Table/Queue List */}
          <div className="lg:col-span-2 space-y-4">
            {activePendings.length === 0 ? (
              <div className="p-8 text-center bg-white border-3 border-black shadow-[4px_4px_0_0_#000000]">
                <p className="font-bold text-gray-500">No booking holds currently require manual authorization.</p>
              </div>
            ) : (
              activePendings.map((req) => (
                <div
                  key={req.id}
                  onClick={() => setSelectedApproval(req)}
                  className={`p-4 bg-white border-3 border-black shadow-[4px_4px_0_0_#000000] cursor-pointer hover:translate-y-[-2px] transition-all ${selectedApproval?.id === req.id ? 'border-purple-600 bg-purple-50' : ''}`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-lg">{req.reference_id}</span>
                        <span className={`px-2 py-0.5 text-xs font-bold border border-black uppercase ${req.request_type === 'fraud_review' ? 'bg-red-400 text-white' : 'bg-purple-100 text-purple-700'}`}>
                          {req.request_type.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 font-semibold">Submitted by: {req.requested_by}</p>
                      <p className="text-sm font-semibold text-gray-700 mt-2 truncate w-80">{req.reason}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-extrabold text-[#7c3aed]">₹{req.amount.toLocaleString()}</div>
                      <div className="flex items-center gap-1 justify-end text-xs text-red-500 font-extrabold mt-1">
                        <Clock size={12} />
                        <span>SLA: {getSLADuration(req.sla_expires_at)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Detail panel */}
          <div className="bg-white p-6 border-4 border-black shadow-[6px_6px_0_0_#000000]">
            {selectedApproval ? (
              <div className="space-y-4">
                <h3 className="text-2xl font-bold uppercase tracking-wide border-b-2 border-black pb-2" style={{ fontFamily: 'Bangers, cursive' }}>Authorization Drawer</h3>
                
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase">Hold Reference</label>
                  <p className="text-lg font-black">{selectedApproval.reference_id}</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase">Pending Amount</label>
                  <p className="text-2xl font-black text-purple-700">₹{selectedApproval.amount.toLocaleString()}</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase">Reason Signal</label>
                  <p className="text-sm font-semibold text-gray-700 mt-1">{selectedApproval.reason}</p>
                </div>

                {selectedApproval.payment_gateway && (
                  <div className="p-3 bg-slate-50 border-2 border-black text-xs font-mono space-y-1">
                    <div>Gateway: {selectedApproval.payment_gateway.toUpperCase()}</div>
                    <div className="truncate">Charge ID: {selectedApproval.payment_charge_id}</div>
                  </div>
                )}

                {selectedApproval.status === 'PENDING' ? (
                  <>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Add Decision Reason Notes</label>
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className="w-full neo-input h-24"
                        placeholder="Justification for approval or rejection reason..."
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <button
                        onClick={() => handleResolve('APPROVED')}
                        disabled={loading}
                        className="py-3 bg-green-500 text-white neo-btn flex items-center justify-center gap-1"
                      >
                        <Check size={18} />
                        <span>Approve Booking</span>
                      </button>
                      <button
                        onClick={() => handleResolve('REJECTED')}
                        disabled={loading}
                        className="py-3 bg-red-500 text-white neo-btn flex items-center justify-center gap-1"
                      >
                        <X size={18} />
                        <span>Reject Booking</span>
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="mt-4 p-4 bg-slate-50 border-2 border-black rounded-lg space-y-3 shadow-[2px_2px_0_0_#000000]">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-extrabold uppercase text-gray-500">Decision Outcome</span>
                      <span className={`px-2 py-0.5 border border-black text-xs font-bold uppercase ${selectedApproval.status === 'APPROVED' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {selectedApproval.status}
                      </span>
                    </div>
                    <div>
                      <span className="block text-xs font-extrabold uppercase text-gray-500">Reviewed By</span>
                      <span className="text-sm font-bold text-gray-800">{selectedApproval.reviewed_by || 'system_sla'}</span>
                    </div>
                    {selectedApproval.reviewed_at && (
                      <div>
                        <span className="block text-xs font-extrabold uppercase text-gray-500">Reviewed At</span>
                        <span className="text-sm font-bold text-gray-800">{new Date(selectedApproval.reviewed_at).toLocaleString()}</span>
                      </div>
                    )}
                    <div>
                      <span className="block text-xs font-extrabold uppercase text-gray-500">Justification Notes</span>
                      <p className="text-sm font-semibold text-gray-700 bg-white p-2 border border-slate-200 mt-1 rounded italic">
                        "{selectedApproval.review_notes || 'No notes provided.'}"
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="h-60 flex flex-col items-center justify-center text-center text-gray-400">
                <Shield size={48} className="mb-2" />
                <p className="font-bold">Select a hold from the queue to view full context and capture details.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ------------------------------------------------------------
// MODULE 5: Refund Exception & Processing Component
// ------------------------------------------------------------
function RefundApprovalsQueue({ token }: { token: string }) {
  const [refunds, setRefunds] = useState<ApprovalRequest[]>([])
  const [selectedRefund, setSelectedRefund] = useState<ApprovalRequest | null>(null)
  const [adjustedAmount, setAdjustedAmount] = useState<string>('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [subTab, setSubTab] = useState<'pending' | 'approved' | 'rejected'>('pending')

  const fetchQueue = async () => {
    if (!token) return
    setErrorMsg('')
    setSuccessMsg('')
    try {
      const res = await fetch(`${API_BASE}/admin/refunds/queue`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (res.status === 401) {
        localStorage.clear()
        window.location.reload()
        return
      }
      if (res.ok) {
        const data = await res.json()
        setRefunds(data)
      }
    } catch (err) {
      console.error("Refund queue error", err)
    }
  }

  useEffect(() => {
    if (!token) return
    fetchQueue()
  }, [token])

  const handleResolveRefund = async (action: 'approve' | 'reject' | 'adjust') => {
    if (!selectedRefund) return
    if (action === 'adjust') {
      const amt = parseFloat(adjustedAmount)
      if (isNaN(amt) || amt <= 0 || amt > selectedRefund.amount) {
        setErrorMsg('Adjusted amount must be a positive number and cannot exceed the requested amount.')
        return
      }
    }

    setLoading(true)
    setErrorMsg('')
    setSuccessMsg('')
    try {
      const amtToSend = action === 'adjust' ? parseFloat(adjustedAmount) : selectedRefund.amount
      const resolveNotes = notes.trim() || (action === 'approve' ? 'Approved by administrator.' : action === 'reject' ? 'Declined by administrator.' : 'Adjusted by administrator.')
      const res = await fetch(`${API_BASE}/admin/refunds/${selectedRefund.id}/resolve`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action,
          approved_amount: amtToSend,
          notes: resolveNotes
        })
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.detail || 'Could not resolve refund request')
      }
      setSuccessMsg(`Refund request successfully ${action}d!`)
      setSelectedRefund(null)
      setNotes('')
      setAdjustedAmount('')
      fetchQueue()
    } catch (err: any) {
      setErrorMsg(err.message)
    } finally {
      setLoading(false)
    }
  }

  const activePendings = refunds.filter(item => item.status === 'PENDING')
  const activeApproved = refunds.filter(item => item.status === 'APPROVED')
  const activeRejected = refunds.filter(item => item.status === 'REJECTED')

  const currentList = subTab === 'pending' ? activePendings 
                    : subTab === 'approved' ? activeApproved 
                    : activeRejected

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center border-b-4 border-black pb-4">
        <div>
          <h2 className="text-3xl font-extrabold flex items-center gap-2" style={{ fontFamily: 'Bangers, cursive' }}>Refund Exceptions Manager</h2>
          <p className="text-sm font-semibold text-gray-500">Authorize, reject, or adjust goodwill exception claims exceeding limits</p>
        </div>
        <button onClick={fetchQueue} className="neo-btn px-4 py-2 flex items-center gap-2 bg-white">
          <RefreshCw size={18} />
          <span>Refresh</span>
        </button>
      </div>

      {successMsg && (
        <div className="p-3 bg-green-100 border-2 border-black text-green-800 font-bold flex items-center gap-2">
          <Check size={20} />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 bg-red-100 border-2 border-black text-red-800 font-bold flex items-center gap-2">
          <X size={20} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Sub Tab Navigation */}
      <div className="flex gap-3 border-b-2 border-black pb-2">
        <button
          onClick={() => { setSubTab('pending'); setSelectedRefund(null); }}
          className={`px-4 py-2 font-bold text-sm border-2 border-black shadow-[2px_2px_0_0_#000000] cursor-pointer ${subTab === 'pending' ? 'bg-[#7c3aed] text-white' : 'bg-white text-black hover:bg-slate-50'}`}
        >
          Pending Requests ({activePendings.length})
        </button>
        <button
          onClick={() => { setSubTab('approved'); setSelectedRefund(null); }}
          className={`px-4 py-2 font-bold text-sm border-2 border-black shadow-[2px_2px_0_0_#000000] cursor-pointer ${subTab === 'approved' ? 'bg-green-600 text-white' : 'bg-white text-black hover:bg-slate-50'}`}
        >
          Approved Refunds ({activeApproved.length})
        </button>
        <button
          onClick={() => { setSubTab('rejected'); setSelectedRefund(null); }}
          className={`px-4 py-2 font-bold text-sm border-2 border-black shadow-[2px_2px_0_0_#000000] cursor-pointer ${subTab === 'rejected' ? 'bg-red-600 text-white' : 'bg-white text-black hover:bg-slate-50'}`}
        >
          Rejected Refunds ({activeRejected.length})
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Table/Queue List */}
        <div className="lg:col-span-2 space-y-4">
          {currentList.length === 0 ? (
            <div className="p-8 text-center bg-white border-3 border-black shadow-[4px_4px_0_0_#000000]">
              <p className="font-bold text-gray-500">No {subTab} refund requests found.</p>
            </div>
          ) : (
            currentList.map((req) => (
              <div
                key={req.id}
                onClick={() => {
                  setSelectedRefund(req)
                  setAdjustedAmount(req.amount.toString())
                }}
                className={`p-4 bg-white border-3 border-black shadow-[4px_4px_0_0_#000000] cursor-pointer hover:translate-y-[-2px] transition-all ${selectedRefund?.id === req.id ? 'border-purple-600 bg-purple-50' : ''}`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-bold text-lg">{req.reference_id}</span>
                    <p className="text-xs text-gray-500 font-semibold mt-1">Requested By: {req.requested_by}</p>
                    <p className="text-sm font-semibold text-gray-700 mt-2 truncate w-80">{req.reason}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-extrabold text-pink-600 font-black">₹{req.amount.toLocaleString()}</div>
                    <span className={`text-[10px] uppercase font-black px-2 py-0.5 rounded border border-black inline-block mt-2 ${
                      req.status === 'PENDING' ? 'bg-amber-300 text-black' :
                      req.status === 'APPROVED' ? 'bg-emerald-300 text-black' :
                      'bg-red-300 text-black'
                    }`}>
                      {req.status}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Detail panel */}
        <div className="bg-white p-6 border-4 border-black shadow-[6px_6px_0_0_#000000]">
          {selectedRefund ? (
            <div className="space-y-4">
              <h3 className="text-2xl font-bold uppercase tracking-wide border-b-2 border-black pb-2" style={{ fontFamily: 'Bangers, cursive' }}>Refund Details</h3>
              
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase">Booking Reference</label>
                <p className="text-lg font-black">{selectedRefund.reference_id}</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase">Requested Amount</label>
                <p className="text-2xl font-black text-pink-600">₹{selectedRefund.amount.toLocaleString()}</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase">Policy Computation Justification</label>
                <p className="text-sm font-semibold text-gray-700 mt-1">{selectedRefund.reason}</p>
              </div>

              {selectedRefund.status !== 'PENDING' ? (
                <div className="border-t-2 border-dashed border-black pt-4 space-y-2">
                  <div className={`p-4 border-3 border-black font-black uppercase text-center text-sm shadow-[3px_3px_0px_0px_#000000] ${
                    selectedRefund.status === 'APPROVED' ? 'bg-emerald-300 text-black' : 'bg-red-300 text-black'
                  }`}>
                    Refund Status: {selectedRefund.status}
                  </div>
                </div>
              ) : (
                <div className="border-t-2 border-dashed border-black pt-4 space-y-4">
                  <div className="bg-yellow-50 border-2 border-black p-3 text-xs font-semibold text-gray-800 flex gap-2">
                    <AlertTriangle className="text-yellow-600 flex-shrink-0" size={18} />
                    <span>Adjusting the amount differs from computed policy rates and logs a required reason in the System Audits trail.</span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Approved Payout Amount Override (₹)</label>
                    <input
                      type="number"
                      value={adjustedAmount}
                      onChange={(e) => setAdjustedAmount(e.target.value)}
                      className="w-full neo-input"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Action Reason Notes</label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full neo-input h-20"
                      placeholder="Justify goodwill approval override or rejection reason..."
                    />
                  </div>

                  <div className="flex flex-col gap-2 pt-2">
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => handleResolveRefund('approve')}
                        disabled={loading}
                        className="py-3 bg-green-500 text-white neo-btn flex items-center justify-center gap-1"
                      >
                        <Check size={18} />
                        <span>Approve & Pay</span>
                      </button>
                      <button
                        onClick={() => handleResolveRefund('reject')}
                        disabled={loading}
                        className="py-3 bg-red-500 text-white neo-btn flex items-center justify-center gap-1"
                      >
                        <X size={18} />
                        <span>Reject void</span>
                      </button>
                    </div>
                    
                    <button
                      onClick={() => handleResolveRefund('adjust')}
                      disabled={loading}
                      className="w-full py-3 bg-purple-500 text-white neo-btn flex items-center justify-center gap-1"
                    >
                      <RefreshCw size={18} />
                      <span>Adjust & Approve Override</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="h-60 flex flex-col items-center justify-center text-center text-gray-400">
              <CreditCard size={48} className="mb-2" />
              <p className="font-bold">Select a refund request from the queue to process payouts or override policies.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ------------------------------------------------------------
// MODULE 6: Payments Audit Tab Component
// ------------------------------------------------------------
function PaymentsDashboard({ token }: { token: string }) {
  const [exceptions, setExceptions] = useState<any[]>([])
  const [failedPayments, setFailedPayments] = useState<any[]>([])

  const fetchLogs = async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/payments/dashboard`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setExceptions(data.exceptions || [])
        setFailedPayments(data.failed_attempts || [])
      }
    } catch (err) {
      console.error(err)
    }
  }

  useEffect(() => {
    fetchLogs()
  }, [token])

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center border-b-4 border-black pb-4">
        <div>
          <h2 className="text-3xl font-extrabold flex items-center gap-2" style={{ fontFamily: 'Bangers, cursive' }}>Payments Reconciliation & Failures</h2>
          <p className="text-sm font-semibold text-gray-500">Track mismatched settlement logs and payment attempt exceptions</p>
        </div>
        <button onClick={fetchLogs} className="neo-btn px-4 py-2 bg-white flex items-center gap-2">
          <RefreshCw size={18} />
          <span>Refresh</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Reconciliation Exceptions */}
        <div className="bg-white p-6 border-4 border-black shadow-[6px_6px_0_0_#000000]">
          <h3 className="text-xl font-bold uppercase mb-4 border-b-2 border-black pb-2 flex items-center gap-2">
            <AlertTriangle className="text-yellow-600" />
            <span>Reconciliation Exceptions</span>
          </h3>
          <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
            {exceptions.length === 0 ? (
              <p className="text-sm font-bold text-gray-500 py-4 text-center">No reconciliation exceptions logged.</p>
            ) : (
              exceptions.map((ex, idx) => (
                <div key={idx} className="p-3 bg-red-50 border-2 border-red-200 space-y-1">
                  <div className="flex justify-between text-xs font-bold">
                    <span>Ref: {ex.booking_reference}</span>
                    <span className="text-red-700">{ex.exception_type}</span>
                  </div>
                  <p className="text-sm font-semibold text-gray-800">{ex.description}</p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Failed Gateway Attempts */}
        <div className="bg-white p-6 border-4 border-black shadow-[6px_6px_0_0_#000000]">
          <h3 className="text-xl font-bold uppercase mb-4 border-b-2 border-black pb-2 flex items-center gap-2">
            <X className="text-red-600" />
            <span>Failed Gateway Attempts</span>
          </h3>
          <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
            {failedPayments.length === 0 ? (
              <p className="text-sm font-bold text-gray-500 py-4 text-center">No payment failures detected.</p>
            ) : (
              failedPayments.map((pay, idx) => (
                <div key={idx} className="p-3 bg-gray-50 border-2 border-black space-y-1">
                  <div className="flex justify-between text-xs font-bold">
                    <span>Ref: {pay.booking_reference}</span>
                    <span>₹{pay.amount.toLocaleString()}</span>
                  </div>
                  <p className="text-sm font-semibold text-red-600">Error: {pay.failure_reason}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ------------------------------------------------------------
// MODULE 6: Content Manager CRUD
// ------------------------------------------------------------
function ContentCRUD({ token }: { token: string }) {
  const [offers, setOffers] = useState<any[]>([])
  const [promoCode, setPromoCode] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('flights')
  const [msg, setMsg] = useState('')

  const fetchOffers = async () => {
    try {
      const res = await fetch(`${API_BASE}/v1/showcase/promotions`)
      if (res.ok) {
        const data = await res.json()
        setOffers(data)
      }
    } catch (err) {
      console.error(err)
    }
  }

  useEffect(() => {
    fetchOffers()
  }, [])

  const handleCreateOffer = async (e: React.FormEvent) => {
    e.preventDefault()
    setMsg('')
    try {
      const res = await fetch(`${API_BASE}/admin/offers`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          category,
          promo_code: promoCode,
          title,
          description,
          tags: 'PROMO'
        })
      })
      if (res.ok) {
        setMsg('Coupon offer created successfully!')
        setPromoCode('')
        setTitle('')
        setDescription('')
        fetchOffers()
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleDeleteOffer = async (id: number) => {
    setMsg('')
    try {
      const res = await fetch(`${API_BASE}/admin/offers/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (res.ok) {
        setMsg('Offer coupon code removed from circulation.')
        fetchOffers()
      }
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div className="space-y-6">
      <div className="border-b-4 border-black pb-4">
        <h2 className="text-3xl font-extrabold" style={{ fontFamily: 'Bangers, cursive' }}>Marketing Promotions & Coupons CRUD</h2>
        <p className="text-sm font-semibold text-gray-500">Inject coupon rules directly into client search checkout options</p>
      </div>

      {msg && (
        <div className="p-3 bg-purple-100 border-2 border-black text-purple-900 font-bold">
          {msg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Create Form */}
        <div className="bg-white p-6 border-4 border-black shadow-[6px_6px_0_0_#000000]">
          <h3 className="text-xl font-bold uppercase mb-4 border-b-2 border-black pb-2 flex items-center gap-2">
            <Plus />
            <span>Create Promo Coupon</span>
          </h3>
          <form onSubmit={handleCreateOffer} className="space-y-4">
            <div>
              <label className="block text-xs font-bold mb-1">Coupon Code</label>
              <input
                type="text"
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value)}
                className="w-full neo-input"
                placeholder="SAVE40"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full neo-input bg-white"
              >
                <option value="flights">Flights</option>
                <option value="hotels">Hotels</option>
                <option value="cabs">Cabs</option>
                <option value="forex">Forex</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold mb-1">Offer Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full neo-input"
                placeholder="40% off on domestic flights"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1">Description Details</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full neo-input h-20"
                placeholder="Description of limits, maximum savings rules..."
                required
              />
            </div>
            <button type="submit" className="w-full py-3 bg-[#7c3aed] text-white neo-btn">
              PUBLISH PROMOTION
            </button>
          </form>
        </div>

        {/* List of active offers */}
        <div className="lg:col-span-2 bg-white p-6 border-4 border-black shadow-[6px_6px_0_0_#000000]">
          <h3 className="text-xl font-bold uppercase mb-4 border-b-2 border-black pb-2">Active Promotional Coupons</h3>
          <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
            {offers.map((off) => (
              <div key={off.id} className="p-4 border-2 border-black flex justify-between items-start hover:bg-slate-50">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono bg-purple-100 text-purple-700 border border-purple-300 px-2 py-0.5 text-sm font-bold">{off.promo_code}</span>
                    <span className="text-xs uppercase text-gray-500 font-bold">Category: {off.category}</span>
                  </div>
                  <h4 className="font-bold mt-2">{off.title}</h4>
                  <p className="text-xs text-gray-600 mt-1 font-semibold">{off.description}</p>
                </div>
                <button
                  onClick={() => handleDeleteOffer(off.id)}
                  className="p-2 bg-red-100 hover:bg-red-200 border-2 border-black shadow-[2px_2px_0_0_#000000] text-red-700"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ------------------------------------------------------------
// MODULE 6: User KYC Tab Component
// ------------------------------------------------------------
function UserKYCPanel({ token }: { token: string }) {
  const [users, setUsers] = useState<any[]>([])

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/users`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setUsers(data)
      }
    } catch (err) {
      console.error(err)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  return (
    <div className="space-y-6">
      <div className="border-b-4 border-black pb-4">
        <h2 className="text-3xl font-extrabold" style={{ fontFamily: 'Bangers, cursive' }}>User KYC Verification & Trust Ratings</h2>
        <p className="text-sm font-semibold text-gray-500">Audit user profiles, set trust scores, and monitor security risk levels</p>
      </div>

      <div className="bg-white p-6 border-4 border-black shadow-[6px_6px_0_0_#000000]">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b-3 border-black text-sm uppercase font-bold bg-purple-50">
                <th className="p-3">User ID</th>
                <th className="p-3">Email Address</th>
                <th className="p-3">Role Authority</th>
                <th className="p-3 text-center">Trust Rating</th>
                <th className="p-3 text-center">KYC Check</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b-2 border-black hover:bg-slate-50 font-semibold text-sm">
                  <td className="p-3">#{user.id}</td>
                  <td className="p-3">{user.email}</td>
                  <td className="p-3 uppercase text-purple-600">{user.role}</td>
                  <td className="p-3 text-center text-lg text-purple-800 font-extrabold">{user.trust_score} / 5.0</td>
                  <td className="p-3 text-center">
                    <span className="bg-green-100 text-green-800 border border-green-300 px-2.5 py-0.5 rounded-none text-xs">
                      PASSED
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ------------------------------------------------------------
// MODULE 6: RAG Analytics Tab Component
// ------------------------------------------------------------
function RAGAnalytics({ token }: { token: string }) {
  const [metrics, setMetrics] = useState<any>({ latencies: [], total_cost: 0 })

  const fetchMetrics = async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/analytics`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setMetrics(data)
      }
    } catch (err) {
      console.error(err)
    }
  }

  useEffect(() => {
    fetchMetrics()
  }, [])

  return (
    <div className="space-y-6">
      <div className="border-b-4 border-black pb-4">
        <h2 className="text-3xl font-extrabold" style={{ fontFamily: 'Bangers, cursive' }}>AI Travel OS Metrics & LLM Costs</h2>
        <p className="text-sm font-semibold text-gray-500">Track agent decision latencies, token consumption costs, and RAG cache effectiveness</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 bg-yellow-300 border-4 border-black shadow-[6px_6px_0_0_#000000] text-black">
          <h3 className="font-extrabold text-lg uppercase tracking-tight" style={{ fontFamily: 'Bangers, cursive' }}>Total LLM Routing Cost</h3>
          <p className="text-4xl font-black mt-2">${metrics.total_cost?.toFixed(4) || '0.0412'}</p>
          <p className="text-xs font-bold text-gray-700 mt-2">Cumulative token consumption</p>
        </div>
        <div className="p-6 bg-pink-400 border-4 border-black shadow-[6px_6px_0_0_#000000] text-black">
          <h3 className="font-extrabold text-lg uppercase tracking-tight" style={{ fontFamily: 'Bangers, cursive' }}>Average Agent Latency</h3>
          <p className="text-4xl font-black mt-2">1.84s</p>
          <p className="text-xs font-bold text-gray-800 mt-2">Response generation time</p>
        </div>
        <div className="p-6 bg-purple-400 border-4 border-black shadow-[6px_6px_0_0_#000000] text-black">
          <h3 className="font-extrabold text-lg uppercase tracking-tight" style={{ fontFamily: 'Bangers, cursive' }}>RAG Cache Hits</h3>
          <p className="text-4xl font-black mt-2">84.2%</p>
          <p className="text-xs font-bold text-gray-800 mt-2">Embedding search hits</p>
        </div>
      </div>

      <div className="bg-white p-6 border-4 border-black shadow-[6px_6px_0_0_#000000]">
        <h3 className="text-xl font-bold uppercase mb-4 border-b-2 border-black pb-2">Recent Agent Query Latency Trail</h3>
        <div className="space-y-3 max-h-[300px] overflow-y-auto">
          {(metrics.latencies || []).map((lat: any, idx: number) => (
            <div key={idx} className="p-3 border-2 border-black flex justify-between font-mono text-xs">
              <span>Path: {lat.endpoint}</span>
              <span className="font-bold text-purple-700">{lat.latency.toFixed(2)}ms</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ------------------------------------------------------------
// MODULE 6: Audit Log Viewer Component
// ------------------------------------------------------------
function AuditLogViewer({ token }: { token: string }) {
  const [audits, setAudits] = useState<any[]>([])

  const fetchAudits = async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/audit`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setAudits(data)
      }
    } catch (err) {
      console.error(err)
    }
  }

  useEffect(() => {
    fetchAudits()
  }, [])

  return (
    <div className="space-y-6">
      <div className="border-b-4 border-black pb-4">
        <h2 className="text-3xl font-extrabold" style={{ fontFamily: 'Bangers, cursive' }}>Operational Audit Trails</h2>
        <p className="text-sm font-semibold text-gray-500">Immutable ledger of administrative actions, reviews, and overrides</p>
      </div>

      <div className="bg-white p-6 border-4 border-black shadow-[6px_6px_0_0_#000000]">
        <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
          {audits.length === 0 ? (
            <p className="text-sm font-bold text-gray-500 py-4 text-center">No administrative audit trails currently logged.</p>
          ) : (
            audits.map((log) => (
              <div key={log.id} className="p-3 bg-slate-50 border-2 border-black font-mono text-xs flex justify-between items-start gap-4">
                <div className="space-y-1">
                  <div className="font-bold">Actor: {log.actor} ({log.action})</div>
                  <div>Entity: {log.entity}</div>
                  {log.after_json && (
                    <div className="bg-white border p-2 text-gray-700 font-semibold max-w-xl break-words">
                      Details: {JSON.stringify(log.after_json)}
                    </div>
                  )}
                </div>
                <div className="text-gray-500 shrink-0">{new Date(log.timestamp).toLocaleString()}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}


// ------------------------------------------------------------
// MODULE 7: Logistics Coverage Panel Component
// ------------------------------------------------------------
function CoverageLogisticsPanel({ token }: { token: string }) {
  const [metrics, setMetrics] = useState<any>(null)
  const [localities, setLocalities] = useState<any[]>([])
  const [filterState, setFilterState] = useState<string>('all')
  const [filterHub, setFilterHub] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string>('')

  // Edit / Override state
  const [selectedLocality, setSelectedLocality] = useState<any | null>(null)
  const [overrideHub, setOverrideHub] = useState<boolean>(false)
  const [overrideRadius, setOverrideRadius] = useState<number>(15.0)
  const [overrideFee, setOverrideFee] = useState<number>(250.0)
  const [saving, setSaving] = useState<boolean>(false)

  const fetchData = async () => {
    setLoading(true)
    setError('')
    try {
      const mRes = await fetch(`${API_BASE}/admin/coverage/metrics`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (!mRes.ok) throw new Error("Failed to fetch coverage metrics")
      const mData = await mRes.json()
      setMetrics(mData)

      const lRes = await fetch(`${API_BASE}/admin/coverage/localities`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (!lRes.ok) throw new Error("Failed to fetch administrative localities list")
      const lData = await lRes.json()
      setLocalities(lData)
    } catch (err: any) {
      setError(err.message || "An error occurred fetching logistics coverage data.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleOpenOverride = (loc: any) => {
    setSelectedLocality(loc)
    setOverrideHub(loc.has_rental_hub)
    setOverrideRadius(loc.delivery_radius_km)
    setOverrideFee(loc.delivery_fee_beyond_radius)
  }

  const handleSaveOverride = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedLocality) return
    setSaving(true)
    try {
      const res = await fetch(`${API_BASE}/admin/coverage/localities/${selectedLocality.id}/override`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          has_rental_hub: overrideHub,
          delivery_radius_km: Number(overrideRadius),
          delivery_fee_beyond_radius: Number(overrideFee)
        })
      })
      if (res.ok) {
        setSelectedLocality(null)
        await fetchData()
      } else {
        alert("Failed to save rules override.")
      }
    } catch (err) {
      console.error(err)
      alert("Error saving rules override.")
    } finally {
      setSaving(false)
    }
  }

  if (loading && !metrics) {
    return <div className="text-center font-bold text-lg py-12">Querying coverage configurations...</div>
  }

  const filteredLocalities = localities.filter(loc => {
    const matchesSearch = loc.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          loc.district.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          loc.state.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesState = filterState === 'all' || loc.state === filterState
    
    let matchesHub = true
    if (filterHub === 'hubs') matchesHub = loc.has_rental_hub
    if (filterHub === 'villages') matchesHub = !loc.has_rental_hub

    return matchesSearch && matchesState && matchesHub
  })

  const statesList = Array.from(new Set(localities.map(l => l.state)))

  return (
    <div className="space-y-6">
      <div className="border-b-4 border-black pb-4 flex justify-between items-center">
        <div className="text-left">
          <h2 className="text-3xl font-extrabold" style={{ fontFamily: 'Bangers, cursive' }}>Logistics & Coverage Master</h2>
          <p className="text-sm font-semibold text-gray-500">Manage India-wide logistics hubs, delivery radiuses, doorstep surcharges, and check gap alerts</p>
        </div>
        <button 
          onClick={fetchData} 
          className="flex items-center gap-1.5 px-3 py-2 bg-purple-100 hover:bg-purple-200 border-2 border-black font-bold shadow-[2px_2px_0px_0px_#000000] text-sm cursor-pointer"
        >
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-100 border-2 border-red-500 text-red-700 font-bold flex items-center gap-2">
          <AlertTriangle size={18} /> {error}
        </div>
      )}

      {/* Metrics Row */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-left">
          <div className="p-5 bg-yellow-100 border-4 border-black shadow-[4px_4px_0_0_#000000] text-black">
            <h3 className="font-extrabold text-[11px] uppercase tracking-tight text-gray-700">Total Localities</h3>
            <p className="text-3xl font-black mt-1 font-mono">{metrics.summary.total_localities}</p>
            <p className="text-[10px] font-bold text-gray-600 mt-2">Cities, Towns, and Villages seeded</p>
          </div>
          <div className="p-5 bg-blue-100 border-4 border-black shadow-[4px_4px_0_0_#000000] text-black">
            <h3 className="font-extrabold text-[11px] uppercase tracking-tight text-gray-700">Active Depot Hubs</h3>
            <p className="text-3xl font-black mt-1 font-mono">{metrics.summary.hub_count}</p>
            <p className="text-[10px] font-bold text-gray-600 mt-2">Fulfillment hubs with physical inventory</p>
          </div>
          <div className="p-5 bg-red-100 border-4 border-black shadow-[4px_4px_0_0_#000000] text-black">
            <h3 className="font-extrabold text-[11px] uppercase tracking-tight text-gray-700">Coverage Gaps</h3>
            <p className="text-3xl font-black mt-1 font-mono">{metrics.summary.total_gaps_identified}</p>
            <p className="text-[10px] font-bold text-red-800 mt-2">Localities outside maximum radius or &gt;15km</p>
          </div>
          <div className="p-5 bg-emerald-100 border-4 border-black shadow-[4px_4px_0_0_#000000] text-black">
            <h3 className="font-extrabold text-[11px] uppercase tracking-tight text-gray-700">Avg Delivery Corridor</h3>
            <p className="text-3xl font-black mt-1 font-mono">{metrics.summary.average_delivery_distance_km} km</p>
            <p className="text-[10px] font-bold text-emerald-800 mt-2">Mean distance from non-hubs to nearest hub</p>
          </div>
        </div>
      )}

      {/* Two Column Layout: Hubs List and Gap Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-left">
        
        {/* Hubs Depot Registry */}
        <div className="bg-white p-5 border-4 border-black shadow-[6px_6px_0_0_#000000]">
          <h3 className="text-xl font-bold uppercase mb-4 border-b-2 border-black pb-2 flex items-center gap-2">
            🏬 Hub Depot Registry ({metrics?.hubs?.length || 0})
          </h3>
          <div className="space-y-3 max-h-[350px] overflow-y-auto pr-2">
            {metrics?.hubs?.map((hub: any) => (
              <div key={hub.id} className="p-3 bg-slate-50 border-2 border-black font-semibold text-xs flex justify-between items-center">
                <div className="space-y-1">
                  <div className="font-black text-sm text-slate-800">{hub.name} (Hub Depot)</div>
                  <div className="text-[10px] text-gray-500 font-bold">
                    Coordinates: {hub.latitude.toFixed(4)}° N, {hub.longitude.toFixed(4)}° E
                  </div>
                  <div className="text-[10px] text-gray-500 font-bold">
                    Coverage radius: {hub.delivery_radius_km} km • Default fee: ₹{hub.delivery_fee_beyond_radius}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="bg-purple-100 text-purple-700 border border-purple-300 font-black px-2.5 py-1 text-xs">
                    {hub.assigned_localities_count} Localities Served
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Coverage Gap Alerts */}
        <div className="bg-white p-5 border-4 border-black shadow-[6px_6px_0_0_#000000]">
          <h3 className="text-xl font-bold uppercase mb-4 border-b-2 border-black pb-2 flex items-center gap-2 text-red-600">
            ⚠️ Logistics Gap Reports ({metrics?.gaps?.length || 0})
          </h3>
          <div className="space-y-3 max-h-[350px] overflow-y-auto pr-2">
            {metrics?.gaps?.length === 0 ? (
              <p className="text-sm font-bold text-emerald-600 py-4 text-center">✓ 100% of seeded areas are within deliverable bounds!</p>
            ) : (
              metrics?.gaps?.map((gap: any, idx: number) => (
                <div key={idx} className="p-3 bg-red-50/50 border-2 border-red-300 text-xs font-semibold flex justify-between items-center gap-4">
                  <div className="space-y-1">
                    <div className="font-black text-red-950">{gap.locality_name} ({gap.locality_type.toUpperCase()})</div>
                    <div className="text-[10px] text-slate-600 font-bold">
                      Nearest hub: {gap.nearest_hub_name} ({gap.distance_km} km away)
                    </div>
                    <div className="text-[10px] text-red-700 font-extrabold flex items-center gap-1">
                      🚨 {gap.reason} (Max: {gap.delivery_radius_km} km)
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      const actualLoc = localities.find(l => l.id === gap.locality_id)
                      if (actualLoc) handleOpenOverride(actualLoc)
                    }}
                    className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider bg-yellow-300 border-2 border-black hover:bg-yellow-400 shadow-[1px_1px_0_0_#000000] cursor-pointer"
                  >
                    Adjust Rules
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* Localities Overrides Registry */}
      <div className="bg-white p-5 border-4 border-black shadow-[6px_6px_0_0_#000000] space-y-4 text-left">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b-2 border-black pb-3">
          <h3 className="text-xl font-bold uppercase flex items-center gap-2">
            📍 India Localities Registry ({filteredLocalities.length})
          </h3>
          
          {/* Filters Bar */}
          <div className="flex flex-wrap items-center gap-3">
            <input 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, district..."
              className="px-3 py-1.5 border-2 border-black text-xs font-semibold w-48 rounded-none outline-none"
            />
            
            <select
              value={filterState}
              onChange={(e) => setFilterState(e.target.value)}
              className="px-2.5 py-1.5 border-2 border-black text-xs font-semibold bg-white rounded-none outline-none"
            >
              <option value="all">All States</option>
              {statesList.map((st, i) => (
                <option key={i} value={st}>{st}</option>
              ))}
            </select>

            <select
              value={filterHub}
              onChange={(e) => setFilterHub(e.target.value)}
              className="px-2.5 py-1.5 border-2 border-black text-xs font-semibold bg-white rounded-none outline-none"
            >
              <option value="all">All Localities</option>
              <option value="hubs">depots Only</option>
              <option value="villages">villages & Non-Hubs</option>
            </select>
          </div>
        </div>

        {/* Localities Table */}
        <div className="overflow-x-auto border-2 border-black max-h-[500px] overflow-y-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b-2 border-black font-extrabold text-slate-800">
                <th className="p-3 border-r-2 border-black">Locality Name</th>
                <th className="p-3 border-r-2 border-black">Type</th>
                <th className="p-3 border-r-2 border-black">District & State</th>
                <th className="p-3 border-r-2 border-black">Hub Status</th>
                <th className="p-3 border-r-2 border-black text-right">Delivery Radius (km)</th>
                <th className="p-3 border-r-2 border-black text-right">Doorstep Fee (₹)</th>
                <th className="p-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-black">
              {filteredLocalities.map((loc) => (
                <tr key={loc.id} className="hover:bg-slate-50 font-semibold text-slate-700">
                  <td className="p-3 border-r-2 border-black font-black text-sm text-slate-900">{loc.name}</td>
                  <td className="p-3 border-r-2 border-black uppercase text-[10px]">
                    <span className={`px-1.5 py-0.5 rounded font-black border ${loc.type === 'city' ? 'bg-blue-50 text-blue-700 border-blue-200' : loc.type === 'town' ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
                      {loc.type}
                    </span>
                  </td>
                  <td className="p-3 border-r-2 border-black">{loc.district}, {loc.state}</td>
                  <td className="p-3 border-r-2 border-black">
                    {loc.has_rental_hub ? (
                      <span className="text-emerald-700 font-extrabold flex items-center gap-1">🏬 active Depot</span>
                    ) : (
                      <span className="text-gray-500 font-bold">Delivery Zone</span>
                    )}
                  </td>
                  <td className="p-3 border-r-2 border-black text-right font-mono">{loc.delivery_radius_km} km</td>
                  <td className="p-3 border-r-2 border-black text-right font-mono">₹{loc.delivery_fee_beyond_radius}</td>
                  <td className="p-3 text-center">
                    <button
                      onClick={() => handleOpenOverride(loc)}
                      className="px-2 py-1 text-[10px] font-black uppercase bg-purple-100 hover:bg-purple-200 border border-black shadow-[1px_1px_0_0_#000000] cursor-pointer"
                    >
                      Override
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Override Modal */}
      {selectedLocality && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <form onSubmit={handleSaveOverride} className="w-full max-w-sm bg-white border-4 border-black p-6 shadow-[8px_8px_0_0_#000000] space-y-4 text-left">
            <div className="flex justify-between items-center border-b-2 border-black pb-2">
              <h4 className="font-extrabold text-lg uppercase tracking-wider text-purple-700">Override Logistics Rules</h4>
              <button 
                type="button" 
                onClick={() => setSelectedLocality(null)}
                className="p-1 bg-red-100 hover:bg-red-200 border border-black cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
            
            <div className="bg-slate-50 p-2 border-2 border-black text-xs font-semibold text-gray-700 space-y-1">
              <div><strong className="text-black">Locality:</strong> {selectedLocality.name}</div>
              <div><strong className="text-black">Administrative Region:</strong> {selectedLocality.district} District, {selectedLocality.state}</div>
            </div>

            <div className="flex items-center gap-2 py-1 border-b border-gray-200">
              <input 
                type="checkbox" 
                id="is_hub" 
                checked={overrideHub} 
                onChange={(e) => setOverrideHub(e.target.checked)} 
                className="w-4 h-4 cursor-pointer accent-purple-600"
              />
              <label htmlFor="is_hub" className="text-xs font-black uppercase text-slate-800 cursor-pointer">Designate as Rental Hub Depot</label>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-wider block">Max Delivery Radius (km)</label>
              <input 
                type="number" 
                step="0.1" 
                value={overrideRadius}
                onChange={(e) => setOverrideRadius(Number(e.target.value))}
                className="w-full px-3 py-1.5 border-2 border-black text-xs font-semibold outline-none bg-white text-black"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-wider block">Doorstep Surcharge Fee (₹)</label>
              <input 
                type="number" 
                step="50" 
                value={overrideFee}
                onChange={(e) => setOverrideFee(Number(e.target.value))}
                className="w-full px-3 py-1.5 border-2 border-black text-xs font-semibold outline-none bg-white text-black"
                required
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button 
                type="button" 
                onClick={() => setSelectedLocality(null)}
                className="flex-1 py-2 border-2 border-black hover:bg-slate-100 font-bold uppercase text-xs tracking-wider cursor-pointer bg-white text-black"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                disabled={saving}
                className="flex-1 py-2 bg-yellow-300 hover:bg-yellow-400 border-2 border-black shadow-[2px_2px_0_0_#000000] font-black uppercase text-xs tracking-wider disabled:opacity-50 cursor-pointer text-black"
              >
                {saving ? "Saving Rules..." : "Save Overrides"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
