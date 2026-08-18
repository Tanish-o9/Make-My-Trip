import React, { useState, useEffect } from 'react';
import { 
  Compass, FileText, Calendar, Clock, MapPin, Edit3, Archive, Trash2, 
  ArrowLeft, Download, Plus, AlertTriangle, CheckCircle, RefreshCw, X
} from 'lucide-react';
import { API_URL } from './config/api';

interface TripTimelinePageProps {
  onNavigate: (path: string) => void;
  token: string | null;
  setActiveTab: (tab: string) => void;
}

export default function TripTimelinePage({ onNavigate, token, setActiveTab }: TripTimelinePageProps) {
  const [trips, setTrips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Selected trip details
  const [selectedTripId, setSelectedTripId] = useState<number | null>(null);
  const [timelineData, setTimelineData] = useState<any | null>(null);
  const [loadingTimeline, setLoadingTimeline] = useState(false);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createDest, setCreateDest] = useState('');
  const [createStart, setCreateStart] = useState('');
  const [createEnd, setCreateEnd] = useState('');
  const [creating, setCreating] = useState(false);

  const [showRenameModal, setShowRenameModal] = useState<any | null>(null);
  const [renameName, setRenameName] = useState('');
  const [renaming, setRenaming] = useState(false);

  const getHeaders = () => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const localToken = token || localStorage.getItem('token');
    if (localToken) headers['Authorization'] = `Bearer ${localToken}`;
    return headers;
  };

  const fetchTrips = (silent = false) => {
    if (!silent) setLoading(true);
    fetch(`${API_URL}/dashboard/trips`, { headers: getHeaders() })
      .then(res => {
        if (!res.ok) throw new Error('Failed to load trips registry.');
        return res.json();
      })
      .then(data => {
        setTrips(data);
        setError(null);
      })
      .catch(err => {
        console.error(err);
        setError(err.message || 'Error loading trips.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchTrips();
  }, [token]);

  const fetchTimeline = (tripId: number) => {
    setLoadingTimeline(true);
    fetch(`${API_URL}/dashboard/trips/${tripId}/timeline`, { headers: getHeaders() })
      .then(res => {
        if (!res.ok) throw new Error('Failed to load trip timeline details.');
        return res.json();
      })
      .then(data => {
        setTimelineData(data);
      })
      .catch(err => {
        console.error(err);
        alert(err.message || 'Error loading timeline.');
      })
      .finally(() => setLoadingTimeline(false));
  };

  const handleCreateTrip = (e: React.FormEvent) => {
    e.preventDefault();
    if (!createName.trim()) return;
    setCreating(true);
    fetch(`${API_URL}/dashboard/trips`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        name: createName,
        destination: createDest || null,
        start_date: createStart || null,
        end_date: createEnd || null,
        booking_references: []
      })
    })
      .then(res => {
        if (!res.ok) throw new Error('Failed to create trip.');
        return res.json();
      })
      .then(() => {
        setShowCreateModal(false);
        setCreateName('');
        setCreateDest('');
        setCreateStart('');
        setCreateEnd('');
        fetchTrips(true);
      })
      .catch(err => alert(err.message))
      .finally(() => setCreating(false));
  };

  const handleRenameTrip = (e: React.FormEvent) => {
    e.preventDefault();
    if (!showRenameModal || !renameName.trim()) return;
    setRenaming(true);
    fetch(`${API_URL}/dashboard/trips/${showRenameModal.id}`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify({ name: renameName })
    })
      .then(res => {
        if (!res.ok) throw new Error('Failed to rename trip.');
        return res.json();
      })
      .then(() => {
        setShowRenameModal(null);
        setRenameName('');
        fetchTrips(true);
        if (selectedTripId === showRenameModal.id) {
          fetchTimeline(showRenameModal.id);
        }
      })
      .catch(err => alert(err.message))
      .finally(() => setRenaming(false));
  };

  const handleToggleArchive = (trip: any) => {
    fetch(`${API_URL}/dashboard/trips/${trip.id}`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify({ is_archived: !trip.is_archived })
    })
      .then(res => {
        if (!res.ok) throw new Error('Failed to update trip archive status.');
        return res.json();
      })
      .then(() => {
        fetchTrips(true);
        if (selectedTripId === trip.id) {
          setSelectedTripId(null);
          setTimelineData(null);
        }
      })
      .catch(err => alert(err.message));
  };

  const handleDeleteTrip = (tripId: number) => {
    if (!confirm('Are you sure you want to delete this trip? Associated bookings will remain intact.')) return;
    fetch(`${API_URL}/dashboard/trips/${tripId}`, {
      method: 'DELETE',
      headers: getHeaders()
    })
      .then(res => {
        if (!res.ok) throw new Error('Failed to delete trip.');
        return res.json();
      })
      .then(() => {
        fetchTrips(true);
        if (selectedTripId === tripId) {
          setSelectedTripId(null);
          setTimelineData(null);
        }
      })
      .catch(err => alert(err.message));
  };

  const handleDownloadAllDocsZip = (tripId: number) => {
    const url = `${API_URL}/dashboard/trips/${tripId}/documents/download-all`;
    const headers = getHeaders();
    
    // In order to download the blob with auth header, we use fetch instead of window.open
    fetch(url, { headers })
      .then(res => {
        if (!res.ok) throw new Error('Could not package documents ZIP. Verify you have confirmed bookings.');
        return res.blob();
      })
      .then(blob => {
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `trip_documents_${tripId}.zip`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(downloadUrl);
      })
      .catch(err => alert(err.message));
  };

  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-[#0a0f1d] text-white font-sans text-left space-y-6">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="h-10 bg-slate-800/40 rounded-xl w-1/4 animate-pulse" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-48 bg-slate-800/40 rounded-3xl animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-[#0a0f1d] text-white font-sans text-left">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Back Button / Header */}
        <div className="flex justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            {selectedTripId && (
              <button 
                onClick={() => { setSelectedTripId(null); setTimelineData(null); }}
                className="p-2 bg-slate-900 border border-slate-800 rounded-xl hover:bg-slate-850 hover:text-yellow-400 transition-all cursor-pointer"
              >
                <ArrowLeft size={16} />
              </button>
            )}
            <div>
              <h1 className="text-xl md:text-2xl font-black uppercase tracking-tight text-slate-100">
                {selectedTripId ? 'Trip Timeline' : 'My Travel Trips'}
              </h1>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">
                {selectedTripId ? 'Detailed schedule of your journey gates' : 'Manage and unify booking schedules'}
              </p>
            </div>
          </div>

          {!selectedTripId && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-yellow-400 hover:bg-yellow-500 text-black text-xs font-black uppercase rounded-xl border border-black shadow-[3px_3px_0px_0px_#000000] active:translate-y-0.5 active:shadow-none transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Plus size={14} /> Create Trip
            </button>
          )}
        </div>

        {/* --- TRIP LIST VIEW --- */}
        {!selectedTripId && (
          <>
            {trips.length === 0 ? (
              <div className="bg-[#111827]/80 border border-slate-800/80 p-12 rounded-3xl text-center space-y-4 shadow-xl">
                <div className="w-16 h-16 rounded-full bg-slate-800/60 flex items-center justify-center mx-auto text-2xl">
                  🌍
                </div>
                <div className="space-y-2">
                  <h3 className="text-sm font-black uppercase tracking-wider text-slate-300">No active trips found</h3>
                  <p className="text-xs text-slate-500 font-semibold leading-relaxed max-w-sm mx-auto">
                    You haven't registered any travel trips. Create a new trip or book any tickets to auto-group them.
                  </p>
                </div>
                <button 
                  onClick={() => setShowCreateModal(true)}
                  className="px-5 py-2.5 bg-yellow-400 hover:bg-yellow-500 text-black text-xs font-black uppercase rounded-xl border border-black shadow-[3px_3px_0px_0px_#000000] transition-all cursor-pointer"
                >
                  Create Trip Now ➔
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {trips.map((trip, idx) => {
                  const bgColors = ['bg-amber-100', 'bg-sky-100', 'bg-emerald-100', 'bg-purple-100', 'bg-rose-100', 'bg-yellow-200'];
                  const cardBg = bgColors[idx % bgColors.length];
                  
                  return (
                    <div 
                      key={trip.id} 
                      className={`border-3 border-black p-6 rounded-3xl relative overflow-hidden transition-all shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5 flex flex-col justify-between h-56 text-black ${
                        trip.is_archived ? 'bg-slate-200 opacity-70' : cardBg
                      }`}
                    >
                      <div className="space-y-3">
                        <div className="flex justify-between items-start gap-2">
                          <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border border-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] ${
                            trip.is_archived 
                              ? 'bg-slate-800 text-white' 
                              : 'bg-black text-yellow-300'
                          }`}>
                            {trip.is_archived ? 'Archived' : 'Active'}
                          </span>
                          
                          <div className="flex items-center gap-1.5 text-black">
                            <button 
                              onClick={() => { setShowRenameModal(trip); setRenameName(trip.name); }}
                              className="p-1 rounded bg-white/80 border border-black hover:bg-black hover:text-white transition-colors cursor-pointer"
                              title="Rename Trip"
                            >
                              <Edit3 size={14} />
                            </button>
                            <button 
                              onClick={() => handleToggleArchive(trip)}
                              className="p-1 rounded bg-white/80 border border-black hover:bg-black hover:text-white transition-colors cursor-pointer"
                              title={trip.is_archived ? 'Unarchive' : 'Archive'}
                            >
                              <Archive size={14} />
                            </button>
                            <button 
                              onClick={() => handleDeleteTrip(trip.id)}
                              className="p-1 rounded bg-white/80 border border-black hover:bg-rose-600 hover:text-white transition-colors cursor-pointer"
                              title="Delete Trip"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>

                        <h3 className="text-base font-black text-black uppercase tracking-tight line-clamp-1" style={{ color: '#000000' }}>
                          {trip.name}
                        </h3>

                        <div className="text-xs text-slate-900 space-y-1 font-bold" style={{ color: '#000000' }}>
                          <div className="flex items-center gap-1.5">
                            <MapPin size={13} className="text-black shrink-0" /> <span style={{ color: '#000000' }}>{trip.destination || 'Multiple destinations'}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Calendar size={13} className="text-black shrink-0" /> <span style={{ color: '#000000' }}>{trip.start_date || 'TBD'} to {trip.end_date || 'TBD'}</span>
                          </div>
                        </div>
                      </div>

                      <div className="border-t-2 border-black pt-3 mt-3 flex justify-between items-center">
                        <span className="text-xs text-black font-black uppercase" style={{ color: '#000000' }}>
                          {trip.bookings_count} Bookings
                        </span>
                        
                        <button
                          onClick={() => { setSelectedTripId(trip.id); fetchTimeline(trip.id); }}
                          className="px-4 py-1.5 bg-black hover:bg-slate-900 text-yellow-300 text-xs font-black uppercase rounded-xl border border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all cursor-pointer flex items-center gap-1.5"
                        >
                          Timeline <Clock size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* --- DETAILED TIMELINE VIEW --- */}
        {selectedTripId && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Timeline Column */}
            <div className="lg:col-span-2 space-y-6">
              
              {loadingTimeline ? (
                <div className="space-y-4 py-8">
                  {[1, 2].map(i => (
                    <div key={i} className="h-28 bg-slate-800/40 rounded-2xl animate-pulse" />
                  ))}
                </div>
              ) : timelineData && timelineData.timeline?.length > 0 ? (
                <div className="relative border-l-3 border-black pl-6 ml-4 space-y-6">
                  {timelineData.timeline.map((event: any, index: number) => {
                    const eventBgs = ['bg-sky-100', 'bg-emerald-100', 'bg-amber-100', 'bg-purple-100'];
                    const evBg = eventBgs[index % eventBgs.length];

                    return (
                      <div key={event.booking_reference + index} className="relative group">
                        
                        {/* Timeline dot */}
                        <span className="absolute -left-[32px] top-2 w-5 h-5 rounded-full bg-yellow-400 border-3 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] group-hover:scale-125 transition-transform" />
                        
                        <div className={`${evBg} border-3 border-black p-5 rounded-2xl space-y-3 transition-all shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] text-black`}>
                          <div className="flex justify-between items-start gap-3">
                            <div>
                              <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-black text-yellow-300 border border-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]">
                                {event.vertical}
                              </span>
                              <h3 className="text-sm font-black text-black mt-1.5 uppercase tracking-tight" style={{ color: '#000000' }}>
                                {event.title}
                              </h3>
                            </div>
                            
                            <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border border-black shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] ${
                              event.status === 'CONFIRMED'
                                ? 'bg-emerald-400 text-black'
                                : 'bg-yellow-300 text-black'
                            }`}>
                              {event.status}
                            </span>
                          </div>

                          <div className="text-xs text-slate-900 space-y-1 font-bold" style={{ color: '#000000' }}>
                            <p className="flex items-center gap-1.5">
                              <Clock size={13} className="text-black shrink-0" /> <span style={{ color: '#000000' }}>Start: {new Date(event.start_time).toLocaleString()}</span>
                            </p>
                            <p className="flex items-center gap-1.5">
                              <MapPin size={13} className="text-black shrink-0" /> <span style={{ color: '#000000' }}>Details: {event.details}</span>
                            </p>
                          </div>

                          <div className="flex justify-between items-center border-t-2 border-black pt-3 mt-3 text-xs">
                            <span className="font-mono text-black font-black uppercase" style={{ color: '#000000' }}>
                              REF: {event.booking_reference}
                            </span>
                            
                            <a
                              href={`${API_URL}/bookings/${event.booking_reference}/pdf`}
                              target="_blank"
                              rel="noreferrer"
                              className="px-3 py-1.5 bg-black hover:bg-slate-900 text-white rounded-xl font-black uppercase border border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all flex items-center gap-1 text-[11px]"
                            >
                              PDF Document <Download size={12} />
                            </a>
                          </div>
                        </div>

                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="bg-amber-50 border-3 border-black border-dashed p-8 rounded-3xl text-center text-xs text-black font-bold shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                  No confirmed bookings are associated with this trip yet.
                </div>
              )}
            </div>

            {/* Sidebar Details / Actions Column */}
            {timelineData && (
              <div className="space-y-6">
                <div className="bg-yellow-100 border-3 border-black p-6 rounded-3xl shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] space-y-4 text-black">
                  <h3 className="text-xs font-black uppercase tracking-wider text-black border-b-2 border-black pb-2">Trip Overview</h3>
                  
                  <div className="space-y-3 font-bold text-xs" style={{ color: '#000000' }}>
                    <div>
                      <span className="text-[10px] text-black font-black uppercase tracking-wider block">Trip Name</span>
                      <span className="text-black text-base font-black uppercase" style={{ color: '#000000' }}>{timelineData.trip.name}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-black font-black uppercase tracking-wider block">Destination</span>
                      <span className="text-black font-bold" style={{ color: '#000000' }}>{timelineData.trip.destination || 'Multiple destinations'}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-black font-black uppercase tracking-wider block">Timeline Dates</span>
                      <span className="text-black font-bold" style={{ color: '#000000' }}>
                        {timelineData.trip.start_date || 'TBD'} to {timelineData.trip.end_date || 'TBD'}
                      </span>
                    </div>
                  </div>

                  <div className="border-t-2 border-black pt-4 space-y-3">
                    <button
                      onClick={() => handleDownloadAllDocsZip(timelineData.trip.id)}
                      className="w-full py-2.5 bg-emerald-400 hover:bg-emerald-500 text-black text-xs font-black uppercase rounded-xl border border-black shadow-[3px_3px_0px_0px_#000000] active:translate-y-0.5 active:shadow-none transition-all cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Archive size={14} /> Download All Docs (ZIP)
                    </button>
                    
                    <button
                      onClick={() => handleToggleArchive(timelineData.trip)}
                      className="w-full py-2 bg-black hover:bg-slate-900 text-yellow-300 text-[11px] font-black uppercase rounded-xl border border-black shadow-[2px_2px_0px_0px_#000000] transition-all cursor-pointer"
                    >
                      {timelineData.trip.is_archived ? 'Activate Trip' : 'Archive Journey'}
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>
        )}

      </div>

      {/* --- MODAL FOR CREATE TRIP --- */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0c111d] border-4 border-black p-6 rounded-2xl shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] text-white w-full max-w-md space-y-4">
            <div className="flex justify-between items-center border-b-2 border-slate-800 pb-3">
              <h3 className="text-sm font-black uppercase tracking-wider text-yellow-400">🆕 Create Travel Trip</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white">
                <X size={16} />
              </button>
            </div>
            
            <form onSubmit={handleCreateTrip} className="space-y-4 text-xs font-semibold">
              <div className="space-y-1">
                <label className="text-slate-400 uppercase tracking-wider block">Trip Name</label>
                <input 
                  type="text" 
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="e.g. Mumbai Business Gate"
                  required
                  className="w-full bg-[#161f30] px-3 py-2 border-2 border-slate-700 rounded-lg focus:outline-none focus:border-yellow-400 text-slate-200"
                />
              </div>
              <div className="space-y-1">
                <label className="text-slate-400 uppercase tracking-wider block">Destination</label>
                <input 
                  type="text" 
                  value={createDest}
                  onChange={(e) => setCreateDest(e.target.value)}
                  placeholder="e.g. Mumbai"
                  className="w-full bg-[#161f30] px-3 py-2 border-2 border-slate-700 rounded-lg focus:outline-none focus:border-yellow-400 text-slate-200"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-slate-400 uppercase tracking-wider block">Start Date</label>
                  <input 
                    type="date" 
                    value={createStart}
                    onChange={(e) => setCreateStart(e.target.value)}
                    className="w-full bg-[#161f30] px-3 py-2 border-2 border-slate-700 rounded-lg focus:outline-none focus:border-yellow-400 text-slate-200"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400 uppercase tracking-wider block">End Date</label>
                  <input 
                    type="date" 
                    value={createEnd}
                    onChange={(e) => setCreateEnd(e.target.value)}
                    className="w-full bg-[#161f30] px-3 py-2 border-2 border-slate-700 rounded-lg focus:outline-none focus:border-yellow-400 text-slate-200"
                  />
                </div>
              </div>
              
              <button
                type="submit"
                disabled={creating}
                className="w-full py-2.5 bg-yellow-400 hover:bg-yellow-500 text-black text-xs font-black uppercase rounded-xl border border-black shadow-[3px_3px_0px_0px_#000000] active:translate-y-0.5 active:shadow-none transition-all cursor-pointer flex justify-center items-center"
              >
                {creating ? 'Registering...' : 'Register Trip'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL FOR RENAME TRIP --- */}
      {showRenameModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0c111d] border-4 border-black p-6 rounded-2xl shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] text-white w-full max-w-sm space-y-4">
            <div className="flex justify-between items-center border-b-2 border-slate-800 pb-3">
              <h3 className="text-sm font-black uppercase tracking-wider text-yellow-400">Rename Journey</h3>
              <button onClick={() => setShowRenameModal(null)} className="text-slate-400 hover:text-white">
                <X size={16} />
              </button>
            </div>
            
            <form onSubmit={handleRenameTrip} className="space-y-4 text-xs font-semibold">
              <div className="space-y-1">
                <label className="text-slate-400 uppercase tracking-wider block">Trip Name</label>
                <input 
                  type="text" 
                  value={renameName}
                  onChange={(e) => setRenameName(e.target.value)}
                  required
                  className="w-full bg-[#161f30] px-3 py-2 border-2 border-slate-700 rounded-lg focus:outline-none focus:border-yellow-400 text-slate-200"
                />
              </div>
              
              <button
                type="submit"
                disabled={renaming}
                className="w-full py-2.5 bg-yellow-400 hover:bg-yellow-500 text-black text-xs font-black uppercase rounded-xl border border-black shadow-[3px_3px_0px_0px_#000000] transition-all cursor-pointer flex justify-center items-center"
              >
                {renaming ? 'Updating...' : 'Update Trip Name'}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
