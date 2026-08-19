import React, { useState, useEffect } from 'react';
import { 
  Bell, CheckCircle2, AlertCircle, Plane, Hotel, Car, CreditCard, 
  Shield, Check, ExternalLink, RefreshCw, Filter, Trash2, ArrowLeft
} from 'lucide-react';
import { API_URL } from './config/api';

interface NotificationItem {
  id: number;
  title: string;
  message: string;
  notification_type: string;
  booking_reference?: string;
  vertical?: string;
  action_url?: string;
  is_read: boolean;
  delivery_status: string;
  created_at: string;
  read_at?: string;
}

interface NotificationsPageProps {
  onNavigate: (path: string) => void;
  token: string | null;
}

export default function NotificationsPage({ onNavigate, token }: NotificationsPageProps) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const getHeaders = () => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  };

  const fetchNotifications = (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);

    const url = `${API_URL}/notifications${unreadOnly ? '?unread_only=true' : ''}`;
    fetch(url, { headers: getHeaders() })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setNotifications(data);
      })
      .catch(() => {})
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  };

  useEffect(() => {
    fetchNotifications();
  }, [unreadOnly, token]);

  const handleMarkAsRead = async (id: number) => {
    try {
      await fetch(`${API_URL}/notifications/${id}/read`, {
        method: 'POST',
        headers: getHeaders(),
      });
      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n))
      );
    } catch {}
  };

  const handleMarkAllAsRead = async () => {
    try {
      await fetch(`${API_URL}/notifications/read-all`, {
        method: 'POST',
        headers: getHeaders(),
      });
      setNotifications(prev =>
        prev.map(n => ({ ...n, is_read: true, read_at: new Date().toISOString() }))
      );
    } catch {}
  };

  const getVerticalIcon = (type: string, vertical?: string) => {
    if (vertical === 'flight' || type.includes('FLIGHT')) return <Plane className="text-blue-400" size={16} />;
    if (vertical === 'hotel' || type.includes('HOTEL')) return <Hotel className="text-amber-400" size={16} />;
    if (vertical === 'cab' || vertical === 'car' || type.includes('CAB') || type.includes('DRIVER'))
      return <Car className="text-green-400" size={16} />;
    if (type.includes('PAYMENT') || type.includes('REFUND')) return <CreditCard className="text-purple-400" size={16} />;
    if (type.includes('AUTH') || type.includes('PASSWORD') || type.includes('SECURITY'))
      return <Shield className="text-yellow-400" size={16} />;
    return <Bell className="text-slate-400" size={16} />;
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="min-h-screen bg-[#0a0f1d] text-white p-4 md:p-8 font-sans text-left">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-4">
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
                Notifications
                {unreadCount > 0 && (
                  <span className="text-xs bg-red-500 text-white font-black px-2 py-0.5 rounded-full">
                    {unreadCount} new
                  </span>
                )}
              </h1>
              <p className="text-xs text-slate-400">Real-time alerts for bookings, payments, drivers, and security.</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchNotifications(true)}
              disabled={refreshing}
              className="bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs px-3 py-2 rounded-xl text-slate-300 font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} /> Refresh
            </button>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 text-xs px-3 py-2 rounded-xl font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Check size={12} /> Mark All as Read
              </button>
            )}
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setUnreadOnly(false)}
            className={`text-xs font-bold px-3.5 py-1.5 rounded-xl border cursor-pointer transition-all ${
              !unreadOnly
                ? 'bg-blue-600 border-blue-500 text-white'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            All Alerts ({notifications.length})
          </button>
          <button
            onClick={() => setUnreadOnly(true)}
            className={`text-xs font-bold px-3.5 py-1.5 rounded-xl border cursor-pointer transition-all ${
              unreadOnly
                ? 'bg-blue-600 border-blue-500 text-white'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            Unread ({unreadCount})
          </button>
        </div>

        {/* Notification List */}
        {loading ? (
          <div className="text-center py-16 space-y-3">
            <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Loading Notifications...</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-12 text-center space-y-3">
            <Bell size={36} className="text-slate-600 mx-auto" />
            <h3 className="text-base font-black uppercase text-slate-300">All Caught Up!</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              You don't have any {unreadOnly ? 'unread' : ''} notifications right now. Trip confirmations and alerts will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map(notif => (
              <div
                key={notif.id}
                className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 ${
                  !notif.is_read
                    ? 'bg-blue-950/20 border-blue-500/40 shadow-sm'
                    : 'bg-slate-900/80 border-slate-800'
                }`}
              >
                <div className="flex items-start gap-3.5">
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 mt-0.5">
                    {getVerticalIcon(notif.notification_type, notif.vertical)}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-black text-white">{notif.title}</h4>
                      {!notif.is_read && (
                        <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">{notif.message}</p>
                    <div className="flex flex-wrap items-center gap-3 pt-1 text-[10px] text-slate-500 font-mono">
                      <span>{notif.created_at?.slice(0, 16).replace('T', ' ')}</span>
                      {notif.booking_reference && (
                        <span className="bg-slate-950 border border-slate-800 px-1.5 py-0.5 rounded text-blue-300 font-bold">
                          REF: {notif.booking_reference}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  {notif.action_url ? (
                    <button
                      onClick={() => {
                        handleMarkAsRead(notif.id);
                        onNavigate(notif.action_url!);
                      }}
                      className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      View <ExternalLink size={10} />
                    </button>
                  ) : notif.booking_reference ? (
                    <button
                      onClick={() => {
                        handleMarkAsRead(notif.id);
                        onNavigate(`/booking/${notif.booking_reference}`);
                      }}
                      className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      View <ExternalLink size={10} />
                    </button>
                  ) : null}
                  {!notif.is_read && (
                    <button
                      onClick={() => handleMarkAsRead(notif.id)}
                      className="bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 text-[11px] font-bold px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors"
                      title="Mark as read"
                    >
                      <Check size={12} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
