import React, { useState, useEffect } from 'react';
import { 
  HelpCircle, Search, MessageSquare, Plus, ChevronDown, ChevronUp, 
  Send, CheckCircle, Clock, AlertTriangle, ArrowLeft, RefreshCw,
  Plane, Hotel, Car, CreditCard, Shield, Ticket, X, LifeBuoy
} from 'lucide-react';
import { API_URL } from './config/api';

interface FAQ {
  id: number;
  category: string;
  question: string;
  answer: string;
}

interface TicketReply {
  id: number;
  author_id: number;
  author_role: string;
  message: string;
  is_internal_note: boolean;
  created_at: string;
}

interface SupportTicket {
  id: number;
  ticket_ref: string;
  user_id: number;
  subject: string;
  category: string;
  priority: string;
  status: string;
  booking_reference?: string;
  assigned_to?: string;
  is_escalated: boolean;
  created_at: string;
  updated_at: string;
  replies: TicketReply[];
}

interface SupportCenterPageProps {
  onNavigate: (path: string) => void;
  token: string | null;
}

export default function SupportCenterPage({ onNavigate, token }: SupportCenterPageProps) {
  const [activeTab, setActiveTab] = useState<'faq' | 'tickets'>('faq');
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [faqCategory, setFaqCategory] = useState<string>('all');
  const [faqSearch, setFaqSearch] = useState<string>('');
  const [expandedFaqId, setExpandedFaqId] = useState<number | null>(null);

  // Tickets state
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [replyMessage, setReplyMessage] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);

  // Create ticket modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newSubject, setNewSubject] = useState('');
  const [newCategory, setNewCategory] = useState('flight');
  const [newPriority, setNewPriority] = useState('normal');
  const [newBookingRef, setNewBookingRef] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [creatingTicket, setCreatingTicket] = useState(false);
  const [ticketError, setTicketError] = useState('');
  const [ticketSuccess, setTicketSuccess] = useState('');

  const getHeaders = () => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  };

  // Fetch FAQs
  useEffect(() => {
    const url = `${API_URL}/support/faq${faqSearch ? `?q=${encodeURIComponent(faqSearch)}` : ''}`;
    fetch(url)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setFaqs(data);
      })
      .catch(() => {});
  }, [faqSearch]);

  // Fetch User Tickets
  const fetchTickets = () => {
    if (!token) return;
    setLoadingTickets(true);
    fetch(`${API_URL}/support/tickets`, { headers: getHeaders() })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setTickets(data);
          if (selectedTicket) {
            const updated = data.find(t => t.id === selectedTicket.id);
            if (updated) setSelectedTicket(updated);
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoadingTickets(false));
  };

  useEffect(() => {
    if (token) fetchTickets();
  }, [token]);

  // Handle Create Ticket
  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubject.trim() || !newMessage.trim()) {
      setTicketError('Subject and detailed message are required.');
      return;
    }
    setCreatingTicket(true);
    setTicketError('');

    try {
      const res = await fetch(`${API_URL}/support/tickets`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          subject: newSubject,
          category: newCategory,
          priority: newPriority,
          booking_reference: newBookingRef || undefined,
          message: newMessage,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to create support ticket.');

      setTicketSuccess(`Support Ticket ${data.ticket_ref} created! Our team will respond shortly.`);
      setShowCreateModal(false);
      setNewSubject('');
      setNewMessage('');
      setNewBookingRef('');
      fetchTickets();
      setActiveTab('tickets');
      setSelectedTicket(data);
    } catch (err: any) {
      setTicketError(err.message || 'Error submitting ticket.');
    } finally {
      setCreatingTicket(false);
    }
  };

  // Handle Send Reply
  const handleSendReply = async () => {
    if (!selectedTicket || !replyMessage.trim()) return;
    setSubmittingReply(true);

    try {
      const res = await fetch(`${API_URL}/support/tickets/${selectedTicket.ticket_ref}/messages`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ message: replyMessage }),
      });
      if (res.ok) {
        setReplyMessage('');
        fetchTickets();
      }
    } catch {}
    finally {
      setSubmittingReply(false);
    }
  };

  // Handle Close / Reopen
  const handleToggleClose = async () => {
    if (!selectedTicket) return;
    const isClosed = selectedTicket.status === 'closed';
    const endpoint = isClosed ? 'reopen' : 'close';

    try {
      const res = await fetch(`${API_URL}/support/tickets/${selectedTicket.ticket_ref}/${endpoint}`, {
        method: 'POST',
        headers: getHeaders(),
      });
      if (res.ok) fetchTickets();
    } catch {}
  };

  const filteredFaqs = faqs.filter(f => faqCategory === 'all' || f.category.toLowerCase() === faqCategory.toLowerCase());

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'open':
        return <span className="bg-emerald-950/80 text-emerald-400 border border-emerald-500/30 text-[10px] font-black uppercase px-2 py-0.5 rounded-full">Open</span>;
      case 'in_progress':
        return <span className="bg-blue-950/80 text-blue-400 border border-blue-500/30 text-[10px] font-black uppercase px-2 py-0.5 rounded-full">In Progress</span>;
      case 'pending_customer':
        return <span className="bg-amber-950/80 text-amber-400 border border-amber-500/30 text-[10px] font-black uppercase px-2 py-0.5 rounded-full">Pending You</span>;
      case 'resolved':
        return <span className="bg-purple-950/80 text-purple-400 border border-purple-500/30 text-[10px] font-black uppercase px-2 py-0.5 rounded-full">Resolved</span>;
      case 'closed':
        return <span className="bg-slate-800 text-slate-400 border border-slate-700 text-[10px] font-black uppercase px-2 py-0.5 rounded-full">Closed</span>;
      default:
        return <span className="bg-slate-800 text-slate-300 text-[10px] font-black uppercase px-2 py-0.5 rounded-full">{status}</span>;
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0f1d] text-white p-4 md:p-8 font-sans text-left">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-5">
          <div className="flex items-center gap-3">
            <button
              onClick={() => onNavigate('/')}
              className="bg-slate-900 hover:bg-slate-800 p-2.5 rounded-xl border border-slate-800 text-slate-300 cursor-pointer transition-colors"
              title="Back to Home"
            >
              <ArrowLeft size={16} />
            </button>
            <div>
              <h1 className="text-2xl font-black uppercase tracking-wider text-white flex items-center gap-2">
                Help & Support Center
              </h1>
              <p className="text-xs text-slate-400">24/7 Assistance for Flights, Hotels, Cabs, Rentals, Activities & Payments</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => {
                if (!token) onNavigate('/');
                else setShowCreateModal(true);
              }}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-black px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2 cursor-pointer transition-all"
            >
              <Plus size={14} /> Create Support Ticket
            </button>
          </div>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center gap-2 border-b border-slate-800/80 pb-2">
          <button
            onClick={() => setActiveTab('faq')}
            className={`text-xs font-black uppercase tracking-wider px-4 py-2 rounded-xl transition-all cursor-pointer ${
              activeTab === 'faq'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white bg-slate-900/50'
            }`}
          >
            FAQ & Knowledge Base
          </button>
          <button
            onClick={() => {
              if (!token) onNavigate('/');
              else setActiveTab('tickets');
            }}
            className={`text-xs font-black uppercase tracking-wider px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'tickets'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white bg-slate-900/50'
            }`}
          >
            My Support Tickets ({tickets.length})
          </button>
        </div>

        {ticketSuccess && (
          <div className="p-3.5 bg-emerald-950/40 border border-emerald-500/40 rounded-xl text-xs text-emerald-300 font-bold flex items-center gap-2">
            <CheckCircle size={16} /> {ticketSuccess}
          </div>
        )}

        {/* ─── TAB 1: FAQ & SEARCH ────────────────────────────────────────── */}
        {activeTab === 'faq' && (
          <div className="space-y-6">
            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-4 top-3.5 text-slate-500" size={18} />
              <input
                type="text"
                placeholder="Search topics (e.g., flight refund, driver contact, luggage, invoice)..."
                value={faqSearch}
                onChange={e => setFaqSearch(e.target.value)}
                className="w-full bg-slate-900/90 border border-slate-800 rounded-2xl pl-11 pr-4 py-3.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 shadow-inner"
              />
            </div>

            {/* Category Filter Chips */}
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'all', label: 'All Topics' },
                { id: 'flight', label: '✈️ Flights' },
                { id: 'hotel', label: '🏨 Hotels' },
                { id: 'cab', label: '🚕 Airport Cabs' },
                { id: 'car_rental', label: '🚗 Car Rental' },
                { id: 'activity', label: '🎟️ Activities' },
                { id: 'train', label: '🚆 Trains' },
                { id: 'payment', label: '💳 Payments & Refunds' },
              ].map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setFaqCategory(cat.id)}
                  className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${
                    faqCategory === cat.id
                      ? 'bg-blue-600/30 border-blue-500 text-blue-300'
                      : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* FAQ Accordion List */}
            <div className="space-y-3">
              {filteredFaqs.map(faq => {
                const isOpen = expandedFaqId === faq.id;
                return (
                  <div
                    key={faq.id}
                    className="bg-slate-900/70 border border-slate-800/80 rounded-2xl overflow-hidden transition-all"
                  >
                    <button
                      onClick={() => setExpandedFaqId(isOpen ? null : faq.id)}
                      className="w-full p-4 text-left flex items-center justify-between gap-3 cursor-pointer hover:bg-slate-800/40"
                    >
                      <div className="flex items-center gap-3">
                        <HelpCircle size={16} className="text-blue-400 shrink-0" />
                        <span className="text-xs font-black text-white">{faq.question}</span>
                      </div>
                      {isOpen ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                    </button>
                    {isOpen && (
                      <div className="p-4 pt-0 text-xs text-slate-300 border-t border-slate-800/50 leading-relaxed">
                        {faq.answer}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ─── TAB 2: MY TICKETS & CONVERSATION ──────────────────────────── */}
        {activeTab === 'tickets' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Tickets Sidebar */}
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="text-xs font-black uppercase text-slate-400 tracking-wider">Your Active Inquiries</span>
                <button
                  onClick={fetchTickets}
                  className="text-[11px] text-blue-400 hover:text-blue-300 font-bold flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw size={10} /> Refresh
                </button>
              </div>

              {loadingTickets ? (
                <div className="py-12 text-center text-xs text-slate-500 font-bold">Loading inquiries...</div>
              ) : tickets.length === 0 ? (
                <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-8 text-center space-y-2">
                  <LifeBuoy size={28} className="text-slate-600 mx-auto" />
                  <p className="text-xs font-bold text-slate-400">No Support Inquiries</p>
                  <p className="text-[11px] text-slate-500">Need help with a trip or refund? Create a ticket above.</p>
                </div>
              ) : (
                tickets.map(ticket => {
                  const isSelected = selectedTicket?.id === ticket.id;
                  return (
                    <div
                      key={ticket.id}
                      onClick={() => setSelectedTicket(ticket)}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-blue-950/30 border-blue-500 shadow-md'
                          : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-[10px] font-mono text-blue-400 font-black">{ticket.ticket_ref}</span>
                        {getStatusBadge(ticket.status)}
                      </div>
                      <h4 className="text-xs font-black text-white truncate">{ticket.subject}</h4>
                      <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono mt-2">
                        <span className="capitalize">{ticket.category}</span>
                        <span>{ticket.created_at.slice(0, 10)}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Conversation Area */}
            <div className="lg:col-span-2">
              {selectedTicket ? (
                <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 space-y-4 flex flex-col h-[600px]">
                  
                  {/* Ticket Header */}
                  <div className="flex items-start justify-between border-b border-slate-800 pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-black text-blue-400">{selectedTicket.ticket_ref}</span>
                        {getStatusBadge(selectedTicket.status)}
                        {selectedTicket.booking_reference && (
                          <span className="text-[10px] bg-slate-950 border border-slate-800 px-2 py-0.5 rounded text-slate-300 font-mono font-bold">
                            Booking: {selectedTicket.booking_reference}
                          </span>
                        )}
                      </div>
                      <h3 className="text-sm font-black text-white mt-1">{selectedTicket.subject}</h3>
                    </div>

                    <button
                      onClick={handleToggleClose}
                      className="bg-slate-800 hover:bg-slate-700 text-xs px-3 py-1.5 rounded-xl font-bold text-slate-300 cursor-pointer transition-colors"
                    >
                      {selectedTicket.status === 'closed' ? 'Reopen Ticket' : 'Close Ticket'}
                    </button>
                  </div>

                  {/* Messages Scroll Area */}
                  <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                    {selectedTicket.replies.map(reply => {
                      const isMe = reply.author_role === 'customer';
                      return (
                        <div
                          key={reply.id}
                          className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                        >
                          <div
                            className={`max-w-[85%] p-3.5 rounded-2xl text-xs leading-relaxed ${
                              isMe
                                ? 'bg-blue-600 text-white rounded-tr-none'
                                : 'bg-slate-800 border border-slate-700 text-slate-200 rounded-tl-none'
                            }`}
                          >
                            <div className="flex items-center gap-2 text-[10px] opacity-75 font-mono mb-1">
                              <span>{isMe ? 'You' : 'Ghumne Chale Support Agent'}</span>
                              <span>•</span>
                              <span>{reply.created_at.slice(11, 16)}</span>
                            </div>
                            <p className="whitespace-pre-wrap">{reply.message}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Reply Input Box */}
                  {selectedTicket.status !== 'closed' ? (
                    <div className="flex items-center gap-2 pt-3 border-t border-slate-800">
                      <input
                        type="text"
                        placeholder="Type your response to support..."
                        value={replyMessage}
                        onChange={e => setReplyMessage(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSendReply()}
                        className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                      />
                      <button
                        onClick={handleSendReply}
                        disabled={submittingReply || !replyMessage.trim()}
                        className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white p-2.5 rounded-xl font-bold cursor-pointer transition-colors"
                      >
                        <Send size={14} />
                      </button>
                    </div>
                  ) : (
                    <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-center text-xs text-slate-500 font-bold">
                      This ticket is closed. Reopen it to send a new message.
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-16 text-center space-y-2 h-[600px] flex flex-col justify-center items-center">
                  <MessageSquare size={36} className="text-slate-600" />
                  <h4 className="text-sm font-black text-slate-300">Select an Inquiry</h4>
                  <p className="text-xs text-slate-500 max-w-sm">
                    Choose a ticket from the left panel to view the live conversation with our support team.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── CREATE TICKET MODAL ─────────────────────────────────────────── */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <h3 className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
                  <Ticket size={16} className="text-blue-400" /> New Support Inquiry
                </h3>
                <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white cursor-pointer">
                  <X size={18} />
                </button>
              </div>

              {ticketError && (
                <div className="p-3 bg-red-950/40 border border-red-500/40 rounded-xl text-xs text-red-300 font-bold flex items-center gap-2">
                  <AlertTriangle size={14} /> {ticketError}
                </div>
              )}

              <form onSubmit={handleCreateTicket} className="space-y-3.5">
                <div>
                  <label className="text-[11px] font-black text-slate-400 uppercase">Category</label>
                  <select
                    value={newCategory}
                    onChange={e => setNewCategory(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-blue-500 mt-1"
                  >
                    <option value="flight">✈️ Flight Booking</option>
                    <option value="hotel">🏨 Hotel Stay</option>
                    <option value="cab">🚕 Airport / Outstation Cab</option>
                    <option value="car_rental">🚗 Car Rental</option>
                    <option value="activity">🎟️ Activities & Tours</option>
                    <option value="train">🚆 Train Booking</option>
                    <option value="payment">💳 Payment Issue</option>
                    <option value="refund">💸 Refund Request</option>
                    <option value="general">❓ General Assistance</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-black text-slate-400 uppercase">Booking Reference (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. TOS-FL-9988 or TOS-HTL-1234"
                    value={newBookingRef}
                    onChange={e => setNewBookingRef(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-blue-500 mt-1 font-mono uppercase"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-black text-slate-400 uppercase">Subject</label>
                  <input
                    type="text"
                    placeholder="Brief summary of your issue..."
                    value={newSubject}
                    onChange={e => setNewSubject(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-blue-500 mt-1"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-black text-slate-400 uppercase">Detailed Message</label>
                  <textarea
                    rows={4}
                    placeholder="Describe the issue, dates, passenger names, or error messages encountered..."
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-blue-500 mt-1"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creatingTicket}
                    className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-black px-5 py-2 rounded-xl cursor-pointer shadow-lg transition-all"
                  >
                    {creatingTicket ? 'Submitting...' : 'Submit Ticket'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
