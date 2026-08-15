import React, { useState, useEffect } from 'react';
import { Users, UserMinus, Plus, Trash2, Calendar, FileText, ArrowRight, DollarSign, Wallet, CheckCircle, RefreshCw } from 'lucide-react';

interface Member {
  user_id: number;
  username: string;
  email: string;
  role: string;
  joined_at: string;
}

interface Expense {
  id: number;
  trip_id: number;
  amount: number;
  currency: string;
  category: string;
  description: string;
  expense_date: string;
  payer_id: number;
  split_type: string;
  splits: { user_id: number; amount: number }[];
}

interface Booking {
  booking_reference: string;
  vertical: string;
  status: string;
  start_time: string;
  price: number;
  details?: any;
}

interface Trip {
  id: number;
  name: string;
  destination: string;
  start_date: string;
  end_date: string;
  bookings_count: number;
  budget: number;
}

export default function GroupTripDashboard({
  tripId,
  currentUserId,
  token,
  onBack
}: {
  tripId: number;
  currentUserId: number;
  token: string;
  onBack: () => void;
}) {
  const [trip, setTrip] = useState<Trip | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [timeline, setTimeline] = useState<Booking[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [balance, setBalance] = useState({ owes: 0, is_owed: 0 });
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteResult, setInviteResult] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'members' | 'expenses' | 'timeline' | 'docs'>('members');

  // Expense form state
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Food');
  const [description, setDescription] = useState('');
  const [splitType, setSplitType] = useState<'equal' | 'custom'>('equal');
  const [customSplits, setCustomSplits] = useState<Record<number, string>>({});

  const API_URL = 'http://localhost:8000/api/v1';

  const fetchData = async () => {
    try {
      setLoading(true);
      // Fetch Trip info from /trips list
      const tripRes = await fetch(`${API_URL}/trips`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const trips: Trip[] = await tripRes.json();
      const currentTrip = trips.find(t => t.id === tripId);
      if (currentTrip) setTrip(currentTrip);

      // Fetch Members
      const membersRes = await fetch(`${API_URL}/trips/${tripId}/members`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (membersRes.ok) {
        const mems = await membersRes.json();
        setMembers(mems);
      }

      // Fetch Expenses
      const expRes = await fetch(`${API_URL}/trips/${tripId}/expenses`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (expRes.ok) {
        const data = await expRes.json();
        setExpenses(data.expenses || []);
        setBalance({ owes: data.user_owes || 0, is_owed: data.user_is_owed || 0 });
      }

      // Fetch Timeline
      const timelineRes = await fetch(`${API_URL}/trips/${tripId}/timeline`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (timelineRes.ok) {
        const data = await timelineRes.json();
        setTimeline(data.timeline || []);
      }

      // Fetch Documents
      const docsRes = await fetch(`${API_URL}/trips/${tripId}/documents`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (docsRes.ok) {
        const data = await docsRes.json();
        setDocuments(data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [tripId]);

  const handleGenerateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/trips/${tripId}/invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ email: inviteEmail || null })
      });
      if (res.ok) {
        const data = await res.json();
        setInviteResult(data.invite_url);
        setInviteEmail('');
      } else {
        alert("Only the trip owner can generate invitations.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRemoveMember = async (userId: number) => {
    if (!confirm("Are you sure you want to remove this member?")) return;
    try {
      const res = await fetch(`${API_URL}/trips/${tripId}/members/${userId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        alert("Member removed.");
        fetchData();
      } else {
        const data = await res.json();
        alert(data.detail || "Only the trip owner can manage group members.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      alert("Please enter a valid amount.");
      return;
    }

    let payloadSplits: { user_id: number; amount: number }[] = [];
    if (splitType === 'custom') {
      let sum = 0;
      for (const m of members) {
        const shareVal = parseFloat(customSplits[m.user_id] || '0');
        sum += shareVal;
        payloadSplits.push({ user_id: m.user_id, amount: shareVal });
      }
      if (Math.abs(sum - parsedAmount) > 0.1) {
        alert(`Sum of custom splits (${sum}) must equal total expense amount (${parsedAmount}).`);
        return;
      }
    }

    try {
      const res = await fetch(`${API_URL}/trips/${tripId}/expenses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          amount: parsedAmount,
          currency: 'INR',
          category,
          description: description || 'Dinner',
          split_type: splitType,
          splits: splitType === 'custom' ? payloadSplits : null
        })
      });
      if (res.ok) {
        setAmount('');
        setDescription('');
        setCustomSplits({});
        fetchData();
      } else {
        const errData = await res.json();
        alert(errData.detail || "Error adding expense.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const isOwner = trip && trip.budget !== undefined && members.find(m => m.user_id === currentUserId)?.role === 'OWNER';

  if (loading && !trip) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-3 text-slate-400">
        <RefreshCw className="animate-spin text-blue-500" />
        <span>Loading Group Workspace...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-left max-w-7xl mx-auto p-4">
      {/* Back button and trip metadata */}
      <div className="flex justify-between items-center border-b border-slate-900 pb-4">
        <div>
          <button onClick={onBack} className="text-xs text-slate-400 hover:text-white mb-2 block">← Back to Dashboard</button>
          <h2 className="text-3xl font-black text-white uppercase tracking-wider">{trip?.name || "Goa Friends Trip"}</h2>
          <p className="text-sm text-slate-400">📍 Destination: <strong className="text-slate-100">{trip?.destination || "Goa"}</strong></p>
        </div>
        <div className="text-right">
          <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Group Balance Overview</div>
          <div className="flex gap-3 mt-1.5">
            <span className="bg-red-950/40 border border-red-900/30 text-red-400 text-xs px-3 py-1 rounded-xl font-black">
              You owe: ₹{balance.owes.toLocaleString()}
            </span>
            <span className="bg-emerald-950/40 border border-emerald-900/30 text-emerald-400 text-xs px-3 py-1 rounded-xl font-black">
              You are owed: ₹{balance.is_owed.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Sub Tabs */}
      <div className="flex border-b border-slate-900 gap-6 text-sm">
        {(['members', 'expenses', 'timeline', 'docs'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveSubTab(tab)}
            className={`pb-3 font-bold uppercase tracking-wider transition-all border-b-2 cursor-pointer ${
              activeSubTab === tab 
                ? 'border-blue-500 text-white' 
                : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: Main Widget Panel */}
        <div className="lg:col-span-2 space-y-6">
          {activeSubTab === 'members' && (
            <div className="glass-card border border-slate-800 rounded-2xl p-6 space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold text-white uppercase tracking-wide flex items-center gap-2">
                  <Users size={18} className="text-blue-400" />
                  Trip Members ({members.length})
                </h3>
              </div>

              <div className="space-y-3">
                {members.map(m => (
                  <div key={m.user_id} className="bg-slate-950/40 border border-slate-900 p-4 rounded-xl flex justify-between items-center">
                    <div>
                      <div className="font-extrabold text-sm text-slate-100 flex items-center gap-1.5">
                        {m.username}
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${
                          m.role === 'OWNER' ? 'bg-amber-950/40 text-amber-400 border border-amber-500/20' : 'bg-slate-905/40 text-slate-400'
                        }`}>
                          {m.role}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500">{m.email}</div>
                    </div>
                    {m.role !== 'OWNER' && isOwner && (
                      <button
                        onClick={() => handleRemoveMember(m.user_id)}
                        className="text-red-400 hover:text-red-300 text-xs flex items-center gap-1 transition-colors cursor-pointer border border-red-950/40 bg-red-950/10 px-2.5 py-1 rounded"
                        title="Remove member from trip group"
                      >
                        <UserMinus size={13} /> Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Invite Generator form */}
              <div className="border-t border-slate-900 pt-6 space-y-4">
                <div className="text-sm font-bold text-slate-300">Invite Friends to Group Workspace</div>
                <form onSubmit={handleGenerateInvite} className="flex gap-3">
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="Enter email address (optional)"
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-sm text-slate-100 outline-none focus:border-blue-500"
                  />
                  <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-4 py-2 rounded-lg flex items-center gap-1 transition-all cursor-pointer">
                    <Plus size={14} /> Generate Token
                  </button>
                </form>

                {inviteResult && (
                  <div className="bg-slate-950 border border-slate-900 p-4 rounded-xl space-y-2 text-xs">
                    <div className="font-bold text-slate-400 uppercase tracking-widest text-[9px]">Secure Token URL Generated:</div>
                    <div className="font-mono bg-slate-900 p-2 rounded select-all text-blue-400 border border-slate-850 break-all">{inviteResult}</div>
                    <div className="text-slate-500 text-[10px]">Provide this link/token to your friends. Valid for 7 days. Do not expose databases IDs.</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeSubTab === 'expenses' && (
            <div className="glass-card border border-slate-800 rounded-2xl p-6 space-y-6">
              <h3 className="text-lg font-bold text-white uppercase tracking-wide flex items-center gap-2">
                <DollarSign size={18} className="text-emerald-400" />
                Joint Group Expenses
              </h3>

              <div className="space-y-4">
                {expenses.length === 0 ? (
                  <div className="text-slate-500 text-xs text-center py-6">No group expenses recorded yet. Use the right form to add.</div>
                ) : (
                  expenses.map(exp => {
                    const payer = members.find(m => m.user_id === exp.payer_id)?.username || "Unknown";
                    return (
                      <div key={exp.id} className="bg-slate-950/40 border border-slate-900 p-4 rounded-xl flex justify-between items-start gap-4">
                        <div className="space-y-1">
                          <div className="font-bold text-sm text-slate-100 flex items-center gap-2">
                            {exp.description}
                            <span className="text-[9px] bg-slate-900 border border-slate-800 text-slate-400 px-1.5 py-0.5 rounded">{exp.category}</span>
                          </div>
                          <div className="text-xs text-slate-400">Paid by <strong className="text-slate-200">{payer}</strong> • Split Type: <span className="capitalize">{exp.split_type}</span></div>
                          <div className="text-[10px] text-slate-500">
                            Splits: {exp.splits.map(s => {
                              const uName = members.find(m => m.user_id === s.user_id)?.username || `User #${s.user_id}`;
                              return `${uName}: ₹${s.amount.toLocaleString()}`;
                            }).join(', ')}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-black text-emerald-400 text-sm">₹{exp.amount.toLocaleString()}</div>
                          <div className="text-[10px] text-slate-500">{exp.expense_date}</div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {activeSubTab === 'timeline' && (
            <div className="glass-card border border-slate-800 rounded-2xl p-6 space-y-6">
              <h3 className="text-lg font-bold text-white uppercase tracking-wide flex items-center gap-2">
                <Calendar size={18} className="text-blue-400" />
                Shared Group Booking Timeline
              </h3>

              <div className="space-y-4">
                {timeline.length === 0 ? (
                  <div className="text-slate-500 text-xs text-center py-6">No bookings associated with this group trip. Add booking references to include.</div>
                ) : (
                  timeline.map(b => (
                    <div key={b.booking_reference} className="bg-slate-950/40 border border-slate-900 p-4 rounded-xl flex justify-between items-center">
                      <div>
                        <div className="font-bold text-sm text-slate-100 flex items-center gap-2">
                          {b.vertical.toUpperCase()} BOOKING
                          <span className="text-[9px] bg-blue-950/60 text-blue-400 px-1.5 py-0.5 rounded border border-blue-900/40">{b.booking_reference}</span>
                        </div>
                        <div className="text-xs text-slate-400 mt-1">Timeline start: {b.start_time}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-emerald-400 font-extrabold text-sm">₹{b.price.toLocaleString()}</div>
                        <span className="text-[9px] bg-emerald-950/40 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded uppercase tracking-wider">{b.status}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeSubTab === 'docs' && (
            <div className="glass-card border border-slate-800 rounded-2xl p-6 space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold text-white uppercase tracking-wide flex items-center gap-2">
                  <FileText size={18} className="text-blue-400" />
                  Shared Document Vault
                </h3>
                {documents.length > 0 && (
                  <a
                    href={`${API_URL}/trips/${tripId}/documents/download-all?token=${token}`}
                    target="_blank"
                    rel="noreferrer"
                    className="bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 text-xs font-bold px-3 py-1.5 rounded-lg border border-blue-500/20 flex items-center gap-1"
                  >
                    📄 Download All ZIP
                  </a>
                )}
              </div>

              <div className="space-y-3">
                {documents.length === 0 ? (
                  <div className="text-slate-500 text-xs text-center py-6">No ticket or invoice documents found for this trip.</div>
                ) : (
                  documents.map(doc => (
                    <div key={doc.id} className="bg-slate-950/40 border border-slate-900 p-4 rounded-xl flex justify-between items-center">
                      <div>
                        <div className="font-bold text-xs text-slate-200">{doc.name}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">{doc.file_name}</div>
                      </div>
                      <a
                        href={`http://localhost:8000${doc.url}`}
                        target="_blank"
                        rel="noreferrer"
                        className="bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 text-xs px-3 py-1.5 rounded-lg transition-all"
                      >
                        View Ticket
                      </a>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Group Expenses Log Widget Form */}
        <div className="space-y-6">
          <div className="glass-card border border-slate-800 rounded-2xl p-6 space-y-4 text-xs">
            <h4 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-1.5">
              <DollarSign size={16} className="text-emerald-400" />
              Log Split Expense
            </h4>

            <form onSubmit={handleAddExpense} className="space-y-3">
              <div className="space-y-1">
                <label className="text-slate-400 block font-bold">Amount (₹)</label>
                <input
                  type="number"
                  min={1}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="e.g. 4000"
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-blue-500 text-xs"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 block font-bold">Description</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Goa Dinner"
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-blue-500 text-xs"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 block font-bold">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 focus:outline-none focus:border-blue-500 text-xs"
                >
                  <option value="Food">Food</option>
                  <option value="Transport">Transport</option>
                  <option value="Hotel">Hotel</option>
                  <option value="Activities">Activities</option>
                  <option value="Shopping">Shopping</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-slate-400 block font-bold">Split Strategy</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSplitType('equal')}
                    className={`flex-1 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                      splitType === 'equal' 
                        ? 'bg-blue-600 text-white border-blue-500' 
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-300'
                    }`}
                  >
                    Equal Split
                  </button>
                  <button
                    type="button"
                    onClick={() => setSplitType('custom')}
                    className={`flex-1 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                      splitType === 'custom' 
                        ? 'bg-blue-600 text-white border-blue-500' 
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-300'
                    }`}
                  >
                    Custom Split
                  </button>
                </div>
              </div>

              {splitType === 'custom' && (
                <div className="space-y-2 border-t border-slate-900 pt-3">
                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">Enter custom shares (₹):</div>
                  {members.map(m => (
                    <div key={m.user_id} className="flex justify-between items-center gap-2 text-xs">
                      <span className="text-slate-300 font-bold truncate max-w-[120px]">{m.username}</span>
                      <input
                        type="number"
                        placeholder="0"
                        value={customSplits[m.user_id] || ''}
                        onChange={(e) => setCustomSplits({
                          ...customSplits,
                          [m.user_id]: e.target.value
                        })}
                        className="w-24 px-2 py-1 rounded bg-slate-950 border border-slate-800 text-slate-200 outline-none text-right focus:border-blue-500"
                      />
                    </div>
                  ))}
                </div>
              )}

              <button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-2 rounded-lg text-xs mt-3 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <Plus size={14} /> Add Logged Expense
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
