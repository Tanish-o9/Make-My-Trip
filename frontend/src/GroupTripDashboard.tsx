import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, UserMinus, Plus, Trash2, Calendar, FileText, ArrowRight, 
  DollarSign, Wallet, CheckCircle, RefreshCw, MessageSquare, BarChart2, 
  Settings, ClipboardList, Send, Clock, Link, Check, AlertCircle, Sparkles 
} from 'lucide-react';

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
  booking_references?: string[];
  description?: string;
  cover_image_url?: string;
  trip_type?: string;
  status?: string;
}

interface Activity {
  id: number;
  title: string;
  date: string;
  start_time: string;
  end_time?: string;
  location?: string;
  description?: string;
  estimated_cost: number;
  category: string;
  assigned_member_id?: number;
  assigned_member_name?: string;
}

interface Task {
  id: number;
  title: string;
  description?: string;
  assignee_id?: number;
  assignee_name?: string;
  due_date?: string;
  priority: string; // LOW, MEDIUM, HIGH
  status: string; // TODO, IN PROGRESS, DONE
}

interface PollOption {
  id: number;
  option_text: string;
  votes: number;
}

interface Poll {
  id: number;
  question: string;
  created_by: number;
  creator_name: string;
  is_closed: boolean;
  options: PollOption[];
  user_voted_option_id: number | null;
  created_at: string;
}

interface ChatMessage {
  id: number;
  sender_id: number;
  sender_name: string;
  message: string;
  timestamp: string;
}

interface ActivityLog {
  id: number;
  actor_name: string;
  action: string;
  timestamp: string;
}

import { API_URL } from './config/api';

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
  const [activities, setActivities] = useState<Activity[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  
  const [balance, setBalance] = useState({ owes: 0, is_owed: 0 });
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'members' | 'itinerary' | 'expenses' | 'tasks' | 'polls' | 'chat' | 'docs' | 'activity' | 'settings'>('overview');

  // Input states
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteResult, setInviteResult] = useState<string | null>(null);
  const [bookingRefInput, setBookingRefInput] = useState('');

  // Itinerary form state
  const [actTitle, setActTitle] = useState('');
  const [actCategory, setActCategory] = useState('Sightseeing');
  const [actDate, setActDate] = useState('');
  const [actTime, setActTime] = useState('10:00 AM');
  const [actLocation, setActLocation] = useState('');
  const [actCost, setActCost] = useState('');
  const [actAssignee, setActAssignee] = useState('');

  // Expense form state
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Food');
  const [description, setDescription] = useState('');
  const [splitType, setSplitType] = useState<'equal' | 'custom' | 'percentage'>('equal');
  const [customSplits, setCustomSplits] = useState<Record<number, string>>({});
  const [percentSplits, setPercentSplits] = useState<Record<number, string>>({});

  // Task form state
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskAssignee, setTaskAssignee] = useState('');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [taskPriority, setTaskPriority] = useState('MEDIUM');

  // Poll form state
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptionsInput, setPollOptionsInput] = useState('');

  // Chat form state
  const [chatMessageInput, setChatMessageInput] = useState('');
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Settings form state
  const [editName, setEditName] = useState('');
  const [editDestination, setEditDestination] = useState('');
  const [editStartDate, setEditStartDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');
  const [editBudget, setEditBudget] = useState('');
  const [editCoverUrl, setEditCoverUrl] = useState('');
  const [editTripType, setEditTripType] = useState('Friends');
  const [editStatus, setEditStatus] = useState('Planning');

  // AI Assistant state
  const [aiMessage, setAiMessage] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch Trip Info
      const tripsRes = await fetch(`${API_URL}/trips`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (tripsRes.ok) {
        const trips: Trip[] = await tripsRes.json();
        const currentTrip = trips.find(t => t.id === tripId);
        if (currentTrip) {
          setTrip(currentTrip);
          setEditName(currentTrip.name || '');
          setEditDestination(currentTrip.destination || '');
          setEditStartDate(currentTrip.start_date || '');
          setEditEndDate(currentTrip.end_date || '');
          setEditBudget(currentTrip.budget?.toString() || '0');
          setEditCoverUrl(currentTrip.cover_image_url || '');
          setEditTripType(currentTrip.trip_type || 'Friends');
          setEditStatus(currentTrip.status || 'Planning');
        }
      }

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

      // Fetch Timeline / Bookings
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

      // Fetch Itinerary Activities
      const itineraryRes = await fetch(`${API_URL}/trips/${tripId}/itinerary`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (itineraryRes.ok) {
        const data = await itineraryRes.json();
        setActivities(data || []);
      }

      // Fetch Tasks
      const tasksRes = await fetch(`${API_URL}/trips/${tripId}/tasks`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (tasksRes.ok) {
        const data = await tasksRes.json();
        setTasks(data || []);
      }

      // Fetch Polls
      const pollsRes = await fetch(`${API_URL}/trips/${tripId}/polls`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (pollsRes.ok) {
        const data = await pollsRes.json();
        setPolls(data || []);
      }

      // Fetch Messages
      const msgRes = await fetch(`${API_URL}/trips/${tripId}/messages`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (msgRes.ok) {
        const data = await msgRes.json();
        setChatMessages(data || []);
      }

      // Fetch Activity Feed Logs
      const logRes = await fetch(`${API_URL}/trips/${tripId}/activity`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (logRes.ok) {
        const data = await logRes.json();
        setActivityLogs(data || []);
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

  useEffect(() => {
    if (activeSubTab === 'chat' && chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, activeSubTab]);

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
        fetchData();
      } else {
        alert("Only the trip owner/admin can generate invitations.");
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

  const handleLinkBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingRefInput.trim()) return;
    try {
      const res = await fetch(`${API_URL}/trips/${tripId}/associate-booking`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ booking_reference: bookingRefInput.trim() })
      });
      if (res.ok) {
        alert("Booking reference linked successfully.");
        setBookingRefInput('');
        fetchData();
      } else {
        const data = await res.json();
        alert(data.detail || "Error linking booking.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Add itinerary activity
  const handleAddActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actTitle.trim() || !actDate) return;
    try {
      const res = await fetch(`${API_URL}/trips/${tripId}/itinerary`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: actTitle,
          category: actCategory,
          date: actDate,
          start_time: actTime,
          location: actLocation || null,
          estimated_cost: actCost ? parseFloat(actCost) : 0,
          assigned_member_id: actAssignee ? parseInt(actAssignee) : null
        })
      });
      if (res.ok) {
        setActTitle('');
        setActLocation('');
        setActCost('');
        setActAssignee('');
        fetchData();
      } else {
        alert("Error adding activity. Make sure dates match trip range.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteActivity = async (itemId: number) => {
    if (!confirm("Delete this activity?")) return;
    try {
      const res = await fetch(`${API_URL}/trips/${tripId}/itinerary/${itemId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Add Task
  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;
    try {
      const res = await fetch(`${API_URL}/trips/${tripId}/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: taskTitle,
          description: taskDesc || null,
          assignee_id: taskAssignee ? parseInt(taskAssignee) : null,
          due_date: taskDueDate || null,
          priority: taskPriority,
          status: 'TODO'
        })
      });
      if (res.ok) {
        setTaskTitle('');
        setTaskDesc('');
        setTaskAssignee('');
        setTaskDueDate('');
        setTaskPriority('MEDIUM');
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateTaskStatus = async (taskId: number, currentStatus: string) => {
    let nextStatus = 'TODO';
    if (currentStatus === 'TODO') nextStatus = 'IN PROGRESS';
    else if (currentStatus === 'IN PROGRESS') nextStatus = 'DONE';
    else nextStatus = 'TODO';

    try {
      const res = await fetch(`${API_URL}/trips/${tripId}/tasks/${taskId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: nextStatus })
      });
      if (res.ok) {
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteTask = async (taskId: number) => {
    if (!confirm("Delete this task?")) return;
    try {
      const res = await fetch(`${API_URL}/trips/${tripId}/tasks/${taskId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Add Expense with Equal, Custom or Percentage splits
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
      if (Math.abs(sum - parsedAmount) > 0.5) {
        alert(`Sum of custom splits (₹${sum}) must equal total expense amount (₹${parsedAmount}).`);
        return;
      }
    } else if (splitType === 'percentage') {
      let totalPercent = 0;
      for (const m of members) {
        const pVal = parseFloat(percentSplits[m.user_id] || '0');
        totalPercent += pVal;
        const calcShare = parsedAmount * (pVal / 100);
        payloadSplits.push({ user_id: m.user_id, amount: parseFloat(calcShare.toFixed(2)) });
      }
      if (Math.abs(totalPercent - 100) > 0.1) {
        alert("Sum of percentages must equal 100%.");
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
          split_type: splitType === 'equal' ? 'equal' : 'custom',
          splits: splitType === 'equal' ? null : payloadSplits
        })
      });
      if (res.ok) {
        setAmount('');
        setDescription('');
        setCustomSplits({});
        setPercentSplits({});
        fetchData();
      } else {
        const errData = await res.json();
        alert(errData.detail || "Error adding expense.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSettleUp = async (debtorId: number, creditorId: number, owedAmount: number) => {
    const debtorName = members.find(m => m.user_id === debtorId)?.username || `User #${debtorId}`;
    const creditorName = members.find(m => m.user_id === creditorId)?.username || `User #${creditorId}`;
    
    if (!confirm(`Register payment of ₹${owedAmount.toLocaleString()} from ${debtorName} to ${creditorName}?`)) return;
    
    try {
      const res = await fetch(`${API_URL}/trips/${tripId}/expenses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          amount: owedAmount,
          currency: 'INR',
          category: 'Other',
          description: `Settlement: ${debtorName} to ${creditorName}`,
          split_type: 'custom',
          splits: [{ user_id: creditorId, amount: owedAmount }]
        })
      });
      if (res.ok) {
        alert("Settlement logged!");
        fetchData();
      } else {
        alert("Error logging settlement.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Add Poll
  const handleCreatePoll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pollQuestion.trim() || !pollOptionsInput.trim()) return;
    
    const options = pollOptionsInput
      .split('\n')
      .map(o => o.trim())
      .filter(o => o.length > 0);
      
    if (options.length < 2) {
      alert("Please provide at least 2 options.");
      return;
    }

    try {
      const res = await fetch(`${API_URL}/trips/${tripId}/polls`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          question: pollQuestion,
          options
        })
      });
      if (res.ok) {
        setPollQuestion('');
        setPollOptionsInput('');
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleVotePoll = async (pollId: number, optionId: number) => {
    try {
      const res = await fetch(`${API_URL}/trips/${tripId}/polls/${pollId}/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ option_id: optionId })
      });
      if (res.ok) {
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeletePoll = async (pollId: number) => {
    if (!confirm("Delete this poll?")) return;
    try {
      const res = await fetch(`${API_URL}/trips/${tripId}/polls/${pollId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Send Message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessageInput.trim()) return;
    try {
      const res = await fetch(`${API_URL}/trips/${tripId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ message: chatMessageInput.trim() })
      });
      if (res.ok) {
        setChatMessageInput('');
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Save settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/trips/${tripId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: editName,
          destination: editDestination,
          start_date: editStartDate || null,
          end_date: editEndDate || null,
          budget: parseFloat(editBudget) || 0,
          cover_image_url: editCoverUrl || null,
          trip_type: editTripType,
          status: editStatus
        })
      });
      if (res.ok) {
        alert("Trip settings updated!");
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteTripWorkspace = async () => {
    if (!confirm("WARNING: Are you absolutely sure you want to delete this trip workspace? This action cannot be undone.")) return;
    try {
      const res = await fetch(`${API_URL}/trips/${tripId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        alert("Trip workspace deleted.");
        onBack();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // AI assistant chat turn
  const handleAskAI = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiMessage.trim()) return;
    setAiLoading(true);
    setAiResponse('');
    try {
      const res = await fetch(`${API_URL}/agents/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          message: aiMessage,
          session_id: `group-trip-${tripId}`
        })
      });
      if (res.ok) {
        const data = await res.json();
        setAiResponse(data.response || "No response received.");
      } else {
        setAiResponse("AI Assistant is offline. Please verify API key setup.");
      }
    } catch (err) {
      console.error(err);
      setAiResponse("Error communicating with AI Assistant.");
    } finally {
      setAiLoading(false);
    }
  };

  // Calculate net balances for Settle Up list
  const getNetBalances = () => {
    // netOwed[user_id] is positive if they are owed money overall, negative if they owe money
    const netOwed: Record<number, number> = {};
    members.forEach(m => { netOwed[m.user_id] = 0; });

    expenses.forEach(exp => {
      const payerId = exp.payer_id;
      // Add total paid to payer
      if (netOwed[payerId] !== undefined) {
        netOwed[payerId] += exp.amount;
      }
      
      // Subtract share from splits
      exp.splits.forEach(s => {
        if (netOwed[s.user_id] !== undefined) {
          netOwed[s.user_id] -= s.amount;
        }
      });
    });

    const netOwedArray = Object.entries(netOwed).map(([id, amt]) => ({
      user_id: parseInt(id),
      amount: parseFloat(amt.toFixed(2))
    }));

    // Separate debtors and creditors
    const debtors = netOwedArray.filter(u => u.amount < -0.1).sort((a, b) => a.amount - b.amount); // most negative first
    const creditors = netOwedArray.filter(u => u.amount > 0.1).sort((a, b) => b.amount - a.amount); // most positive first

    const settlements: { debtor: number; creditor: number; amount: number }[] = [];
    
    let dIdx = 0;
    let cIdx = 0;

    // Deep copy to prevent mutating state
    const dList = debtors.map(d => ({ ...d }));
    const cList = creditors.map(c => ({ ...c }));

    while (dIdx < dList.length && cIdx < cList.length) {
      const debtor = dList[dIdx];
      const creditor = cList[cIdx];

      const debtAmt = Math.abs(debtor.amount);
      const creditAmt = creditor.amount;

      const settleAmt = Math.min(debtAmt, creditAmt);

      settlements.push({
        debtor: debtor.user_id,
        creditor: creditor.user_id,
        amount: parseFloat(settleAmt.toFixed(2))
      });

      debtor.amount += settleAmt;
      creditor.amount -= settleAmt;

      if (Math.abs(debtor.amount) < 0.1) dIdx++;
      if (Math.abs(creditor.amount) < 0.1) cIdx++;
    }

    return settlements;
  };

  const totalExpenseSum = expenses.reduce((sum, e) => sum + e.amount, 0);
  const budgetProgressPercent = trip && trip.budget ? Math.min(100, Math.round((totalExpenseSum / trip.budget) * 100)) : 0;
  const isOwner = trip && members.find(m => m.user_id === currentUserId)?.role === 'OWNER';

  if (loading && !trip) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-3 text-slate-400">
        <RefreshCw className="animate-spin text-blue-500" />
        <span>Loading Group Workspace...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-left max-w-7xl mx-auto p-4 animate-fade-in font-sans">
      
      {/* Dynamic cover image banner */}
      <div 
        className="relative rounded-3xl overflow-hidden h-60 border border-slate-800 flex items-end p-8 bg-cover bg-center shadow-2xl transition-all"
        style={{ backgroundImage: `linear-gradient(to top, rgba(15, 23, 42, 0.95), rgba(15, 23, 42, 0.4)), url(${trip?.cover_image_url || 'https://images.unsplash.com/photo-1506929562872-bb421503ef21?auto=format&fit=crop&w=1200&q=80'})` }}
      >
        <div className="flex justify-between items-end w-full">
          <div>
            <button onClick={onBack} className="text-xs text-slate-350 hover:text-white mb-3 block bg-slate-900/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-slate-750 cursor-pointer">
              ← Dashboard
            </button>
            <div className="flex items-center gap-3">
              <span className="bg-blue-600/90 text-white text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded border border-blue-400/30">
                {trip?.trip_type || "Friends"}
              </span>
              <span className="bg-slate-900/80 text-slate-300 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded border border-slate-700/50">
                {trip?.status || "Planning"}
              </span>
            </div>
            <h2 className="text-3xl lg:text-4xl font-extrabold text-white uppercase tracking-tight mt-2">{trip?.name}</h2>
            <p className="text-sm text-slate-300 mt-1 flex items-center gap-1">
              📍 <span className="font-bold text-slate-100">{trip?.destination}</span> • {trip?.start_date} to {trip?.end_date}
            </p>
          </div>
          
          <div className="hidden md:flex gap-3 bg-slate-900/80 backdrop-blur-md border border-slate-800 p-4 rounded-2xl text-right">
            <div>
              <div className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Personal Balance</div>
              <div className="flex gap-2 mt-1">
                <span className="bg-red-950/40 border border-red-900/30 text-red-400 text-xs px-2.5 py-1 rounded-xl font-bold">
                  Owe: ₹{balance.owes.toLocaleString()}
                </span>
                <span className="bg-emerald-950/40 border border-emerald-900/30 text-emerald-400 text-xs px-2.5 py-1 rounded-xl font-bold">
                  Owed: ₹{balance.is_owed.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs navigation */}
      <div className="flex border-b border-slate-900 overflow-x-auto gap-6 text-xs scrollbar-thin">
        {([
          { id: 'overview', label: 'Overview', icon: <CheckCircle size={14} /> },
          { id: 'members', label: 'Members', icon: <Users size={14} /> },
          { id: 'itinerary', label: 'Itinerary', icon: <Calendar size={14} /> },
          { id: 'expenses', label: 'Expenses & Splits', icon: <DollarSign size={14} /> },
          { id: 'tasks', label: 'Tasks', icon: <ClipboardList size={14} /> },
          { id: 'polls', label: 'Polls & Decisions', icon: <BarChart2 size={14} /> },
          { id: 'chat', label: 'Group Chat', icon: <MessageSquare size={14} /> },
          { id: 'docs', label: 'Vault', icon: <FileText size={14} /> },
          { id: 'activity', label: 'Logs', icon: <Clock size={14} /> },
          { id: 'settings', label: 'Settings', icon: <Settings size={14} /> }
        ] as const).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            className={`pb-3 font-bold uppercase tracking-wider transition-all border-b-2 cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeSubTab === tab.id 
                ? 'border-blue-500 text-blue-400' 
                : 'border-transparent text-slate-500 hover:text-slate-350'
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left column(s) content depends on active tab */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* 1. OVERVIEW TAB */}
          {activeSubTab === 'overview' && (
            <div className="space-y-6">
              
              {/* Trip stats cards grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-950/40 border border-slate-900 p-4 rounded-2xl flex flex-col justify-between">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Group size</span>
                  <span className="text-2xl font-black text-white mt-2">{members.length} Traveler{members.length > 1 ? 's' : ''}</span>
                </div>
                <div className="bg-slate-950/40 border border-slate-900 p-4 rounded-2xl flex flex-col justify-between">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Total budget</span>
                  <span className="text-2xl font-black text-blue-400 mt-2">₹{(trip?.budget || 0).toLocaleString()}</span>
                </div>
                <div className="bg-slate-950/40 border border-slate-900 p-4 rounded-2xl flex flex-col justify-between">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Logged expenses</span>
                  <span className="text-2xl font-black text-rose-450 mt-2">₹{totalExpenseSum.toLocaleString()}</span>
                </div>
                <div className="bg-slate-950/40 border border-slate-900 p-4 rounded-2xl flex flex-col justify-between">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Available balance</span>
                  <span className={`text-2xl font-black mt-2 ${((trip?.budget || 0) - totalExpenseSum) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    ₹{((trip?.budget || 0) - totalExpenseSum).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Description card */}
              <div className="glass-card border border-slate-800 rounded-2xl p-6 space-y-3">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">About the journey</h3>
                <p className="text-slate-350 text-xs leading-relaxed">
                  {trip?.description || "No description set. Head to the Settings tab to outline your group travel purpose, packing lists, and shared objectives."}
                </p>
              </div>

              {/* Progress bar card */}
              <div className="glass-card border border-slate-800 rounded-2xl p-6 space-y-4">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-300 uppercase tracking-wide">Budget consumption progress</span>
                  <span className="font-extrabold text-blue-400">{budgetProgressPercent}% Used</span>
                </div>
                <div className="w-full bg-slate-950 rounded-full h-3 overflow-hidden border border-slate-900">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${
                      budgetProgressPercent > 90 ? 'bg-red-500' : budgetProgressPercent > 70 ? 'bg-amber-500' : 'bg-blue-500'
                    }`}
                    style={{ width: `${budgetProgressPercent}%` }}
                  />
                </div>
              </div>

              {/* Booking references summary list */}
              <div className="glass-card border border-slate-800 rounded-2xl p-6 space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                    <Link size={15} className="text-blue-400" />
                    Linked Booking References ({trip?.booking_references?.length || 0})
                  </h3>
                </div>

                <div className="space-y-3">
                  {trip?.booking_references?.length === 0 ? (
                    <div className="text-slate-500 text-xs text-center py-4">No flight or hotel bookings linked. Link a booking reference on the right.</div>
                  ) : (
                    trip?.booking_references?.map((ref: string) => {
                      const matchedItem = timeline.find(t => t.booking_reference === ref);
                      return (
                        <div key={ref} className="bg-slate-950/40 border border-slate-900 p-4 rounded-xl flex justify-between items-center text-xs">
                          <div>
                            <div className="font-bold text-slate-100 flex items-center gap-1.5">
                              🎫 Reference: <span className="text-blue-400 font-mono font-bold uppercase">{ref}</span>
                            </div>
                            <div className="text-[10px] text-slate-500 mt-1">
                              {matchedItem ? `${matchedItem.vertical.toUpperCase()} • ${matchedItem.status} • Scheduled for ${matchedItem.start_time}` : 'External system booking'}
                            </div>
                          </div>
                          {matchedItem && (
                            <span className="bg-emerald-950/40 border border-emerald-900/30 text-emerald-400 text-[10px] px-2 py-0.5 rounded-full font-bold">
                              ₹{matchedItem.price.toLocaleString()}
                            </span>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

            </div>
          )}

          {/* 2. MEMBERS TAB */}
          {activeSubTab === 'members' && (
            <div className="glass-card border border-slate-800 rounded-2xl p-6 space-y-6">
              <h3 className="text-lg font-bold text-white uppercase tracking-wide flex items-center gap-2">
                <Users size={18} className="text-blue-400" />
                Collaborator List ({members.length})
              </h3>

              <div className="space-y-3">
                {members.map(m => (
                  <div key={m.user_id} className="bg-slate-950/40 border border-slate-900 p-4 rounded-xl flex justify-between items-center text-xs">
                    <div>
                      <div className="font-extrabold text-sm text-slate-100 flex items-center gap-1.5">
                        {m.username}
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${
                          m.role === 'OWNER' ? 'bg-amber-950/40 text-amber-400 border border-amber-500/20' : 'bg-slate-900 text-slate-400'
                        }`}>
                          {m.role}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">{m.email}</div>
                    </div>
                    {m.role !== 'OWNER' && isOwner && (
                      <button
                        onClick={() => handleRemoveMember(m.user_id)}
                        className="text-red-400 hover:text-red-300 text-xs flex items-center gap-1 transition-colors cursor-pointer border border-red-950/40 bg-red-950/10 px-2.5 py-1 rounded"
                      >
                        <UserMinus size={13} /> Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Generate Invite Form */}
              <div className="border-t border-slate-900 pt-6 space-y-4">
                <div className="text-sm font-bold text-slate-350">Invite New Travelers</div>
                <form onSubmit={handleGenerateInvite} className="flex gap-3">
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="Enter email address (optional)"
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:border-blue-500"
                  />
                  <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-4 py-2 rounded-lg flex items-center gap-1 cursor-pointer">
                    <Plus size={13} /> Invite Link
                  </button>
                </form>

                {inviteResult && (
                  <div className="bg-slate-950 border border-slate-900 p-4 rounded-xl space-y-2 text-xs">
                    <div className="font-bold text-slate-400 uppercase tracking-widest text-[9px]">Invite Link (Valid for 7 days):</div>
                    <div className="font-mono bg-slate-900 p-2 rounded select-all text-blue-400 border border-slate-850 break-all">{inviteResult}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 3. ITINERARY TAB */}
          {activeSubTab === 'itinerary' && (
            <div className="glass-card border border-slate-800 rounded-2xl p-6 space-y-6">
              
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold text-white uppercase tracking-wide flex items-center gap-2">
                  <Calendar size={18} className="text-blue-400" />
                  Day-by-Day Shared Itinerary
                </h3>
              </div>

              {/* New activity form */}
              <form onSubmit={handleAddActivity} className="bg-slate-950/40 border border-slate-900 p-4 rounded-xl grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="space-y-1">
                  <label className="text-slate-400 font-bold block">Activity Title *</label>
                  <input 
                    type="text" 
                    value={actTitle} 
                    onChange={(e) => setActTitle(e.target.value)}
                    placeholder="e.g. Scuba Diving at Grand Island"
                    className="w-full bg-slate-950 border border-slate-850 rounded px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-blue-500" 
                    required 
                  />
                </div>
                
                <div className="space-y-1">
                  <label className="text-slate-400 font-bold block">Category</label>
                  <select 
                    value={actCategory} 
                    onChange={(e) => setActCategory(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-850 rounded px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-blue-500"
                  >
                    <option value="Flight">Flight</option>
                    <option value="Hotel">Hotel</option>
                    <option value="Food">Food</option>
                    <option value="Sightseeing">Sightseeing</option>
                    <option value="Transport">Transport</option>
                    <option value="Activity">Activity</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-slate-400 font-bold block">Date *</label>
                  <input 
                    type="date" 
                    value={actDate} 
                    onChange={(e) => setActDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-850 rounded px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-blue-500" 
                    required 
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-400 font-bold block">Timeslot (start)</label>
                  <input 
                    type="text" 
                    value={actTime} 
                    onChange={(e) => setActTime(e.target.value)}
                    placeholder="e.g. 10:00 AM" 
                    className="w-full bg-slate-950 border border-slate-850 rounded px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-blue-500" 
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-400 font-bold block">Location</label>
                  <input 
                    type="text" 
                    value={actLocation} 
                    onChange={(e) => setActLocation(e.target.value)}
                    placeholder="e.g. Candolim Beach" 
                    className="w-full bg-slate-950 border border-slate-850 rounded px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-blue-500" 
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-400 font-bold block">Assignee Member</label>
                  <select 
                    value={actAssignee} 
                    onChange={(e) => setActAssignee(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-850 rounded px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-blue-500"
                  >
                    <option value="">No Assignee</option>
                    {members.map(m => (
                      <option key={m.user_id} value={m.user_id}>{m.username}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-slate-400 font-bold block">Estimated Cost (₹)</label>
                  <input 
                    type="number" 
                    value={actCost} 
                    onChange={(e) => setActCost(e.target.value)}
                    placeholder="e.g. 1200" 
                    className="w-full bg-slate-950 border border-slate-850 rounded px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-blue-500" 
                  />
                </div>

                <div className="flex items-end">
                  <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 rounded transition-all cursor-pointer">
                    + Add to Itinerary
                  </button>
                </div>
              </form>

              {/* Activities list */}
              <div className="space-y-4 mt-6">
                {activities.length === 0 ? (
                  <div className="text-slate-500 text-xs text-center py-6">The itinerary is currently empty. Start detailing activities above.</div>
                ) : (
                  activities.map(act => (
                    <div key={act.id} className="border-l-2 border-blue-500 pl-4 space-y-2 relative">
                      <div className="absolute left-[-5px] top-1.5 w-2 h-2 rounded-full bg-blue-500" />
                      <div className="flex justify-between items-start text-xs">
                        <div>
                          <div className="font-extrabold text-sm text-slate-100 flex items-center gap-1.5">
                            {act.title}
                            <span className="text-[9px] bg-slate-900 border border-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-black uppercase">
                              {act.category}
                            </span>
                          </div>
                          <div className="text-slate-400 mt-1 flex items-center gap-2">
                            <span>📅 {act.date} at {act.start_time}</span>
                            {act.location && <span>• 📍 {act.location}</span>}
                            {act.assigned_member_name && (
                              <span className="bg-slate-900 border border-slate-850 text-[10px] text-slate-400 px-2 py-0.5 rounded-full">
                                Assignee: {act.assigned_member_name}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {act.estimated_cost > 0 && <span className="font-bold text-slate-300">₹{act.estimated_cost.toLocaleString()}</span>}
                          {isOwner && (
                            <button 
                              onClick={() => handleDeleteActivity(act.id)}
                              className="text-slate-500 hover:text-red-400 transition-colors cursor-pointer"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* 4. EXPENSES TAB */}
          {activeSubTab === 'expenses' && (
            <div className="glass-card border border-slate-800 rounded-2xl p-6 space-y-6">
              
              <div className="flex justify-between items-center border-b border-slate-900 pb-4">
                <h3 className="text-lg font-bold text-white uppercase tracking-wide flex items-center gap-2">
                  <DollarSign size={18} className="text-emerald-400" />
                  Shared Expenses & Settlements
                </h3>
              </div>

              {/* Settle Up Section */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-350 uppercase tracking-widest">Suggested Settlements (Net Balances)</h4>
                
                {getNetBalances().length === 0 ? (
                  <div className="bg-slate-950/40 border border-slate-900 p-4 rounded-xl text-xs text-slate-500 text-center">
                    All balances settled! Group expenses are perfectly equal.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    {getNetBalances().map((settle, i) => {
                      const debtorName = members.find(m => m.user_id === settle.debtor)?.username || `User #${settle.debtor}`;
                      const creditorName = members.find(m => m.user_id === settle.creditor)?.username || `User #${settle.creditor}`;
                      return (
                        <div key={i} className="bg-slate-950/40 border border-slate-900 p-4 rounded-xl flex justify-between items-center">
                          <div>
                            <span className="font-extrabold text-red-400">{debtorName}</span> owes <span className="font-extrabold text-emerald-400">{creditorName}</span>
                            <div className="text-lg font-black text-slate-100 mt-1">₹{settle.amount.toLocaleString()}</div>
                          </div>
                          {(settle.debtor === currentUserId || settle.creditor === currentUserId || isOwner) && (
                            <button
                              onClick={() => handleSettleUp(settle.debtor, settle.creditor, settle.amount)}
                              className="bg-emerald-600 hover:bg-emerald-500 text-white font-black px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                            >
                              Settle Up
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Expense logs list */}
              <div className="space-y-4 pt-4 border-t border-slate-900">
                <h4 className="text-xs font-bold text-slate-350 uppercase tracking-widest">Logs History</h4>
                
                {expenses.length === 0 ? (
                  <div className="text-slate-500 text-xs text-center py-6">No group expenses recorded yet.</div>
                ) : (
                  expenses.map(exp => {
                    const payer = members.find(m => m.user_id === exp.payer_id)?.username || "Unknown";
                    return (
                      <div key={exp.id} className="bg-slate-950/40 border border-slate-900 p-4 rounded-xl flex justify-between items-start gap-4 text-xs">
                        <div className="space-y-1">
                          <div className="font-bold text-sm text-slate-100 flex items-center gap-2">
                            {exp.description}
                            <span className="text-[9px] bg-slate-900 border border-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-black uppercase">{exp.category}</span>
                          </div>
                          <div className="text-xs text-slate-400">Paid by <strong className="text-slate-200">{payer}</strong> • Split: <span className="capitalize">{exp.split_type}</span></div>
                          <div className="text-[10px] text-slate-500 mt-1">
                            Breakdown: {exp.splits.map(s => {
                              const uName = members.find(m => m.user_id === s.user_id)?.username || `User #${s.user_id}`;
                              return `${uName}: ₹${s.amount.toLocaleString()}`;
                            }).join(', ')}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-black text-emerald-400 text-sm">₹{exp.amount.toLocaleString()}</div>
                          <div className="text-[10px] text-slate-500 mt-1">{exp.expense_date}</div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

            </div>
          )}

          {/* 5. TASKS TAB */}
          {activeSubTab === 'tasks' && (
            <div className="glass-card border border-slate-800 rounded-2xl p-6 space-y-6">
              
              <h3 className="text-lg font-bold text-white uppercase tracking-wide flex items-center gap-2">
                <ClipboardList size={18} className="text-blue-400" />
                Group Tasks Checklist
              </h3>

              {/* Create Task Form */}
              <form onSubmit={handleAddTask} className="bg-slate-950/40 border border-slate-900 p-4 rounded-xl grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="space-y-1 md:col-span-2">
                  <label className="text-slate-400 font-bold block">Task Title *</label>
                  <input
                    type="text"
                    value={taskTitle}
                    onChange={(e) => setTaskTitle(e.target.value)}
                    placeholder="e.g. Apply for group visas"
                    className="w-full bg-slate-950 border border-slate-850 rounded px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-blue-500"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-400 font-bold block">Description</label>
                  <input
                    type="text"
                    value={taskDesc}
                    onChange={(e) => setTaskDesc(e.target.value)}
                    placeholder="Short description details"
                    className="w-full bg-slate-950 border border-slate-850 rounded px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-400 font-bold block">Assignee</label>
                  <select
                    value={taskAssignee}
                    onChange={(e) => setTaskAssignee(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-850 rounded px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-blue-500"
                  >
                    <option value="">No Assignee</option>
                    {members.map(m => (
                      <option key={m.user_id} value={m.user_id}>{m.username}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-slate-400 font-bold block">Due Date</label>
                  <input
                    type="date"
                    value={taskDueDate}
                    onChange={(e) => setTaskDueDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-850 rounded px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-400 font-bold block">Priority</label>
                  <select
                    value={taskPriority}
                    onChange={(e) => setTaskPriority(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-850 rounded px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-blue-500"
                  >
                    <option value="LOW">LOW</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="HIGH">HIGH</option>
                  </select>
                </div>

                <div className="md:col-span-2 flex justify-end">
                  <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-6 rounded transition-all cursor-pointer">
                    + Add Task
                  </button>
                </div>
              </form>

              {/* Tasks List */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                {(['TODO', 'IN PROGRESS', 'DONE'] as const).map(colStatus => {
                  const filteredTasks = tasks.filter(t => t.status === colStatus);
                  return (
                    <div key={colStatus} className="bg-slate-950/20 border border-slate-900 rounded-2xl p-4 space-y-3">
                      <div className="text-[10px] text-slate-400 font-black uppercase tracking-widest flex justify-between items-center pb-2 border-b border-slate-900">
                        <span>{colStatus}</span>
                        <span className="bg-slate-900 border border-slate-800 text-[10px] px-2 py-0.5 rounded-full text-slate-350">{filteredTasks.length}</span>
                      </div>

                      <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                        {filteredTasks.length === 0 ? (
                          <div className="text-slate-500 text-[10px] text-center py-4">No tasks</div>
                        ) : (
                          filteredTasks.map(t => (
                            <div key={t.id} className="bg-slate-950 border border-slate-900 p-3 rounded-xl space-y-2 text-xs">
                              <div className="font-extrabold text-slate-100">{t.title}</div>
                              {t.description && <div className="text-[10px] text-slate-400 leading-relaxed">{t.description}</div>}
                              
                              <div className="flex flex-wrap gap-1.5 text-[9px] font-black">
                                <span className={`px-1.5 py-0.5 rounded ${
                                  t.priority === 'HIGH' ? 'bg-red-950/40 text-red-400 border border-red-900/35' : 
                                  t.priority === 'MEDIUM' ? 'bg-amber-950/40 text-amber-400 border border-amber-900/35' : 'bg-slate-900 text-slate-400'
                                }`}>
                                  {t.priority}
                                </span>
                                {t.assignee_name && (
                                  <span className="bg-blue-950/40 text-blue-400 px-1.5 py-0.5 rounded border border-blue-900/35">
                                    👤 {t.assignee_name}
                                  </span>
                                )}
                                {t.due_date && (
                                  <span className="bg-slate-900 text-slate-450 px-1.5 py-0.5 rounded">
                                    📅 {t.due_date}
                                  </span>
                                )}
                              </div>

                              <div className="flex justify-between items-center pt-2 border-t border-slate-900">
                                <button
                                  onClick={() => handleUpdateTaskStatus(t.id, t.status)}
                                  className="text-[10px] text-blue-400 hover:text-blue-300 font-bold flex items-center gap-1 cursor-pointer"
                                >
                                  Move →
                                </button>
                                <button
                                  onClick={() => handleDeleteTask(t.id)}
                                  className="text-slate-500 hover:text-red-400 cursor-pointer"
                                >
                                  <Trash2 size={11} />
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

            </div>
          )}

          {/* 6. POLLS TAB */}
          {activeSubTab === 'polls' && (
            <div className="glass-card border border-slate-800 rounded-2xl p-6 space-y-6">
              
              <h3 className="text-lg font-bold text-white uppercase tracking-wide flex items-center gap-2">
                <BarChart2 size={18} className="text-blue-400" />
                Group Decision Polls
              </h3>

              {/* Create Poll form */}
              <form onSubmit={handleCreatePoll} className="bg-slate-950/40 border border-slate-900 p-4 rounded-xl space-y-3 text-xs">
                <div className="space-y-1">
                  <label className="text-slate-400 font-bold block">Poll Question *</label>
                  <input
                    type="text"
                    value={pollQuestion}
                    onChange={(e) => setPollQuestion(e.target.value)}
                    placeholder="e.g. Which beach resort should we book for Goa?"
                    className="w-full bg-slate-950 border border-slate-850 rounded px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-blue-500"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-400 font-bold block">Options (enter one option per line) *</label>
                  <textarea
                    rows={3}
                    value={pollOptionsInput}
                    onChange={(e) => setPollOptionsInput(e.target.value)}
                    placeholder="Taj Exotica&#10;W Goa&#10;Alila Diwa"
                    className="w-full bg-slate-950 border border-slate-850 rounded px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-blue-500 font-sans"
                    required
                  />
                </div>

                <div className="flex justify-end">
                  <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-6 rounded transition-all cursor-pointer">
                    + Launch Poll
                  </button>
                </div>
              </form>

              {/* Polls list */}
              <div className="space-y-6 mt-6">
                {polls.length === 0 ? (
                  <div className="text-slate-500 text-xs text-center py-6">No group decision polls active. Create one above.</div>
                ) : (
                  polls.map(p => {
                    const totalVotes = p.options.reduce((sum, o) => sum + o.votes, 0);
                    return (
                      <div key={p.id} className="bg-slate-950/40 border border-slate-900 p-6 rounded-2xl space-y-4 text-xs">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-extrabold text-sm text-slate-100">{p.question}</h4>
                            <div className="text-[10px] text-slate-500 mt-1">Launched by {p.creator_name} • {p.created_at}</div>
                          </div>
                          {(p.created_by === currentUserId || isOwner) && (
                            <button
                              onClick={() => handleDeletePoll(p.id)}
                              className="text-slate-500 hover:text-red-400 transition-colors cursor-pointer"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>

                        <div className="space-y-3">
                          {p.options.map(o => {
                            const percent = totalVotes > 0 ? Math.round((o.votes / totalVotes) * 100) : 0;
                            const hasVoted = p.user_voted_option_id === o.id;
                            
                            return (
                              <div key={o.id} className="space-y-1.5">
                                <div className="flex justify-between items-center text-xs">
                                  <button
                                    onClick={() => handleVotePoll(p.id, o.id)}
                                    className={`font-bold hover:text-blue-400 transition-colors flex items-center gap-1.5 cursor-pointer ${
                                      hasVoted ? 'text-blue-400' : 'text-slate-300'
                                    }`}
                                  >
                                    {hasVoted ? <Check size={13} /> : <div className="w-3 h-3 rounded-full border border-slate-500" />}
                                    {o.option_text}
                                  </button>
                                  <span className="text-slate-400 font-bold">{o.votes} Vote{o.votes !== 1 ? 's' : ''} ({percent}%)</span>
                                </div>
                                <div className="w-full bg-slate-950 rounded-full h-2 border border-slate-900 overflow-hidden">
                                  <div 
                                    className={`h-full rounded-full transition-all duration-300 ${hasVoted ? 'bg-blue-500' : 'bg-slate-700'}`}
                                    style={{ width: `${percent}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

            </div>
          )}

          {/* 7. CHAT TAB */}
          {activeSubTab === 'chat' && (
            <div className="glass-card border border-slate-800 rounded-2xl p-6 flex flex-col h-[500px]">
              
              <div className="border-b border-slate-900 pb-3 flex items-center gap-2">
                <MessageSquare size={18} className="text-blue-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Group Workspace Messages</h3>
              </div>

              {/* Messages container */}
              <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
                {chatMessages.length === 0 ? (
                  <div className="text-slate-500 text-xs text-center py-12">No messages in workspace yet. Say hello to start collaborating!</div>
                ) : (
                  chatMessages.map(msg => {
                    const isSelf = msg.sender_id === currentUserId;
                    const initials = msg.sender_name.slice(0, 2).toUpperCase();
                    
                    return (
                      <div key={msg.id} className={`flex gap-3 text-xs ${isSelf ? 'flex-row-reverse' : ''}`}>
                        <div className="w-8 h-8 rounded-full bg-slate-900 border border-slate-800 text-[10px] font-black text-slate-300 flex items-center justify-center">
                          {initials}
                        </div>
                        <div className={`space-y-1 max-w-[70%] ${isSelf ? 'text-right' : ''}`}>
                          <div className="text-[10px] text-slate-500 font-bold">{msg.sender_name}</div>
                          <div className={`p-3 rounded-2xl leading-relaxed break-words text-left ${
                            isSelf ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-slate-950 border border-slate-900 text-slate-200 rounded-tl-none'
                          }`}>
                            {msg.message}
                          </div>
                          <div className="text-[9px] text-slate-500">{msg.timestamp.split('T')[1].slice(0, 5)}</div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={chatBottomRef} />
              </div>

              {/* Send message form */}
              <form onSubmit={handleSendMessage} className="border-t border-slate-900 pt-3 flex gap-2">
                <input
                  type="text"
                  value={chatMessageInput}
                  onChange={(e) => setChatMessageInput(e.target.value)}
                  placeholder="Type group message..."
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-xs text-slate-200 outline-none focus:border-blue-500"
                />
                <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white p-2.5 rounded-lg flex items-center justify-center transition-all cursor-pointer">
                  <Send size={15} />
                </button>
              </form>

            </div>
          )}

          {/* 8. DOCS TAB */}
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
                    className="bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 text-xs font-bold px-3 py-1.5 rounded-lg border border-blue-500/20 flex items-center gap-1 cursor-pointer"
                  >
                    📄 Download ZIP
                  </a>
                )}
              </div>

              {/* Documents list */}
              <div className="space-y-3">
                {documents.length === 0 ? (
                  <div className="text-slate-500 text-xs text-center py-6">No ticket, hotel, or insurance PDF documents linked.</div>
                ) : (
                  documents.map(doc => (
                    <div key={doc.id} className="bg-slate-950/40 border border-slate-900 p-4 rounded-xl flex justify-between items-center text-xs">
                      <div>
                        <div className="font-bold text-slate-200">{doc.name}</div>
                        <div className="text-[10px] text-slate-500 mt-1 font-mono">{doc.file_name}</div>
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

          {/* 9. ACTIVITY LOGS TAB */}
          {activeSubTab === 'activity' && (
            <div className="glass-card border border-slate-800 rounded-2xl p-6 space-y-6">
              
              <h3 className="text-lg font-bold text-white uppercase tracking-wide flex items-center gap-2">
                <Clock size={18} className="text-blue-400" />
                Collaborator Activity Feed
              </h3>

              <div className="space-y-4">
                {activityLogs.length === 0 ? (
                  <div className="text-slate-500 text-xs text-center py-6">No activity logs recorded yet.</div>
                ) : (
                  activityLogs.map(log => (
                    <div key={log.id} className="flex gap-3 text-xs border-b border-slate-900 pb-3 last:border-0">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5" />
                      <div className="flex-1">
                        <span className="font-extrabold text-slate-100">{log.actor_name}</span>{' '}
                        <span className="text-slate-350">{log.action}</span>
                        <div className="text-[9px] text-slate-500 mt-1">
                          {log.timestamp.split('T')[0]} at {log.timestamp.split('T')[1].slice(0, 5)}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

            </div>
          )}

          {/* 10. SETTINGS TAB */}
          {activeSubTab === 'settings' && (
            <div className="glass-card border border-slate-800 rounded-2xl p-6 space-y-6">
              
              <h3 className="text-lg font-bold text-white uppercase tracking-wide flex items-center gap-2">
                <Settings size={18} className="text-blue-400" />
                Trip Workspace Settings
              </h3>

              <form onSubmit={handleSaveSettings} className="space-y-4 text-xs">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-slate-400 font-bold block">Trip Name *</label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:border-blue-500"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-slate-400 font-bold block">Destination *</label>
                    <input
                      type="text"
                      value={editDestination}
                      onChange={(e) => setEditDestination(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:border-blue-500"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-slate-400 font-bold block">Start Date</label>
                    <input
                      type="date"
                      value={editStartDate}
                      onChange={(e) => setEditStartDate(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-slate-400 font-bold block">End Date</label>
                    <input
                      type="date"
                      value={editEndDate}
                      onChange={(e) => setEditEndDate(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-slate-400 font-bold block">Budget (₹) *</label>
                    <input
                      type="number"
                      value={editBudget}
                      onChange={(e) => setEditBudget(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:border-blue-500"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-slate-400 font-bold block">Trip Category Type</label>
                    <select
                      value={editTripType}
                      onChange={(e) => setEditTripType(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:border-blue-500"
                    >
                      <option value="Friends">Friends</option>
                      <option value="Family">Family</option>
                      <option value="Business">Business</option>
                      <option value="Honeymoon">Honeymoon</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div className="space-y-1 md:col-span-2">
                    <label className="text-slate-400 font-bold block">Banner Image URL</label>
                    <input
                      type="text"
                      value={editCoverUrl}
                      onChange={(e) => setEditCoverUrl(e.target.value)}
                      placeholder="https://example.com/cover.jpg"
                      className="w-full bg-slate-950 border border-slate-850 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="flex justify-between items-center pt-4 border-t border-slate-900">
                  {isOwner && (
                    <button
                      type="button"
                      onClick={handleDeleteTripWorkspace}
                      className="bg-red-650 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition-colors cursor-pointer"
                    >
                      Delete Workspace
                    </button>
                  )}
                  <button
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-6 rounded-lg transition-all ml-auto cursor-pointer"
                  >
                    Save Changes
                  </button>
                </div>
              </form>

            </div>
          )}

        </div>

        {/* Right Sidebar Column depends on Tab context */}
        <div className="space-y-6">
          
          {/* AI assistant planner widget shown on Overview, Itinerary, Tasks, and Polls tabs */}
          {(['overview', 'itinerary', 'tasks', 'polls', 'chat', 'activity', 'settings'].includes(activeSubTab)) && (
            <div className="glass-card border border-slate-800 rounded-2xl p-6 space-y-4 text-xs">
              <h4 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles size={16} className="text-blue-400" />
                AI Assistant Recommendation
              </h4>
              
              <p className="text-slate-400 text-[10px] leading-relaxed">
                Consult the supervisor travel engine on destinations, optimal path routing, activity packages, and timeline schedules.
              </p>

              <form onSubmit={handleAskAI} className="space-y-2">
                <input
                  type="text"
                  value={aiMessage}
                  onChange={(e) => setAiMessage(e.target.value)}
                  placeholder="e.g. recommend 3 activities in Goa"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:border-blue-500"
                />
                <button
                  type="submit"
                  disabled={aiLoading}
                  className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-bold py-2 rounded-lg transition-all cursor-pointer"
                >
                  {aiLoading ? 'Analyzing...' : 'Ask AI'}
                </button>
              </form>

              {aiResponse && (
                <div className="bg-slate-950 border border-slate-900 p-4 rounded-xl text-[11px] leading-relaxed text-slate-300 font-mono overflow-y-auto max-h-60">
                  {aiResponse}
                </div>
              )}
            </div>
          )}

          {/* Booking linking widget shown on Overview, Itinerary, Vault tab */}
          {(['overview', 'itinerary', 'docs'].includes(activeSubTab)) && (
            <div className="glass-card border border-slate-800 rounded-2xl p-6 space-y-4 text-xs">
              <h4 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                <Link size={16} className="text-blue-400" />
                Link Booking Reference
              </h4>
              
              <form onSubmit={handleLinkBooking} className="space-y-2">
                <input
                  type="text"
                  value={bookingRefInput}
                  onChange={(e) => setBookingRefInput(e.target.value)}
                  placeholder="e.g. FL-123456"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:border-blue-500 font-mono uppercase"
                  required
                />
                <button
                  type="submit"
                  className="w-full bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 font-bold py-2 rounded-lg transition-all cursor-pointer"
                >
                  Associate Booking
                </button>
              </form>
            </div>
          )}

          {/* Expense Log Form Widget shown ONLY on Expenses Tab */}
          {activeSubTab === 'expenses' && (
            <div className="glass-card border border-slate-800 rounded-2xl p-6 space-y-4 text-xs">
              <h4 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                <DollarSign size={16} className="text-emerald-400" />
                Log Shared Expense
              </h4>

              <form onSubmit={handleAddExpense} className="space-y-3">
                <div className="space-y-1">
                  <label className="text-slate-400 block font-bold">Amount (₹) *</label>
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
                  <label className="text-slate-400 block font-bold">Description *</label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="e.g. Beach Resort Dinner"
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
                  <label className="text-slate-400 block font-bold">Split strategy</label>
                  <div className="grid grid-cols-3 gap-1">
                    {(['equal', 'custom', 'percentage'] as const).map(strategy => (
                      <button
                        key={strategy}
                        type="button"
                        onClick={() => setSplitType(strategy)}
                        className={`py-1.5 rounded border text-[10px] font-black transition-all cursor-pointer capitalize whitespace-nowrap ${
                          splitType === strategy 
                            ? 'bg-blue-600 text-white border-blue-500' 
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-300'
                        }`}
                      >
                        {strategy}
                      </button>
                    ))}
                  </div>
                </div>

                {splitType === 'custom' && (
                  <div className="space-y-2 border-t border-slate-900 pt-3">
                    <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wide">Enter custom shares (₹):</div>
                    {members.map(m => (
                      <div key={m.user_id} className="flex justify-between items-center gap-2 text-xs">
                        <span className="text-slate-350 truncate max-w-[120px] font-bold">{m.username}</span>
                        <input
                          type="number"
                          placeholder="0"
                          value={customSplits[m.user_id] || ''}
                          onChange={(e) => setCustomSplits({
                            ...customSplits,
                            [m.user_id]: e.target.value
                          })}
                          className="w-20 px-2 py-1 rounded bg-slate-950 border border-slate-850 text-slate-200 outline-none text-right focus:border-blue-500 text-xs"
                        />
                      </div>
                    ))}
                  </div>
                )}

                {splitType === 'percentage' && (
                  <div className="space-y-2 border-t border-slate-900 pt-3">
                    <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wide">Enter percentage shares (%):</div>
                    {members.map(m => (
                      <div key={m.user_id} className="flex justify-between items-center gap-2 text-xs">
                        <span className="text-slate-355 truncate max-w-[120px] font-bold">{m.username}</span>
                        <input
                          type="number"
                          placeholder="0"
                          value={percentSplits[m.user_id] || ''}
                          onChange={(e) => setPercentSplits({
                            ...percentSplits,
                            [m.user_id]: e.target.value
                          })}
                          className="w-16 px-2 py-1 rounded bg-slate-950 border border-slate-850 text-slate-200 outline-none text-right focus:border-blue-500 text-xs"
                        />
                      </div>
                    ))}
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-2.5 rounded-lg text-xs mt-3 flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Plus size={13} /> Log Shared Expense
                </button>
              </form>
            </div>
          )}

          {/* Members list summary widget shown on Overview and settings tabs */}
          {(['overview', 'settings'].includes(activeSubTab)) && (
            <div className="glass-card border border-slate-800 rounded-2xl p-6 space-y-4 text-xs">
              <h4 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                <Users size={16} className="text-blue-400" />
                Travelers ({members.length})
              </h4>
              
              <div className="space-y-2">
                {members.slice(0, 5).map(m => (
                  <div key={m.user_id} className="flex justify-between items-center bg-slate-950/40 p-2.5 rounded-xl border border-slate-900">
                    <div>
                      <div className="font-extrabold text-slate-200">{m.username}</div>
                      <div className="text-[10px] text-slate-500">{m.role}</div>
                    </div>
                  </div>
                ))}
                {members.length > 5 && (
                  <button 
                    onClick={() => setActiveSubTab('members')}
                    className="w-full text-center text-blue-400 font-bold text-xs py-1 hover:underline cursor-pointer"
                  >
                    View all {members.length} members
                  </button>
                )}
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
