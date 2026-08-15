import React, { useState, useEffect } from 'react';
import { 
  FileText, Download, Archive, Search, ShieldCheck, MapPin, 
  Calendar, Info, AlertTriangle, ArrowLeft, ChevronRight
} from 'lucide-react';
import { API_URL } from './config/api';

interface DocumentsPageProps {
  onNavigate: (path: string) => void;
  token: string | null;
  setActiveTab: (tab: string) => void;
}

export default function DocumentsPage({ onNavigate, token, setActiveTab }: DocumentsPageProps) {
  const [trips, setTrips] = useState<any[]>([]);
  const [selectedTripId, setSelectedTripId] = useState<number | null>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [loadingTrips, setLoadingTrips] = useState(true);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getHeaders = () => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const localToken = token || localStorage.getItem('token');
    if (localToken) headers['Authorization'] = `Bearer ${localToken}`;
    return headers;
  };

  const fetchTrips = () => {
    setLoadingTrips(true);
    fetch(`${API_URL}/dashboard/trips`, { headers: getHeaders() })
      .then(res => {
        if (!res.ok) throw new Error('Failed to load trips registry.');
        return res.json();
      })
      .then(data => {
        setTrips(data);
        setError(null);
        if (data.length > 0) {
          // Select the first trip by default
          setSelectedTripId(data[0].id);
          fetchDocuments(data[0].id);
        }
      })
      .catch(err => {
        console.error(err);
        setError(err.message || 'Error loading trips.');
      })
      .finally(() => setLoadingTrips(false));
  };

  const fetchDocuments = (tripId: number) => {
    setLoadingDocs(true);
    fetch(`${API_URL}/dashboard/trips/${tripId}/documents`, { headers: getHeaders() })
      .then(res => {
        if (!res.ok) throw new Error('Failed to load trip documents.');
        return res.json();
      })
      .then(data => {
        setDocuments(data);
      })
      .catch(err => {
        console.error(err);
        alert(err.message || 'Error loading documents.');
      })
      .finally(() => setLoadingDocs(false));
  };

  useEffect(() => {
    fetchTrips();
  }, [token]);

  const handleTripSelect = (tripId: number) => {
    setSelectedTripId(tripId);
    fetchDocuments(tripId);
  };

  const handleDownloadAllZip = () => {
    if (!selectedTripId) return;
    const url = `${API_URL}/dashboard/trips/${selectedTripId}/documents/download-all`;
    fetch(url, { headers: getHeaders() })
      .then(res => {
        if (!res.ok) throw new Error('Failed to package documents ZIP.');
        return res.blob();
      })
      .then(blob => {
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `trip_vault_${selectedTripId}.zip`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(downloadUrl);
      })
      .catch(err => alert(err.message));
  };

  const activeTrip = trips.find(t => t.id === selectedTripId);

  if (loadingTrips) {
    return (
      <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-[#0a0f1d] text-white font-sans text-left space-y-6">
        <div className="max-w-6xl mx-auto space-y-6 animate-pulse">
          <div className="h-10 bg-slate-800/40 rounded-xl w-1/4" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="h-64 bg-slate-800/40 rounded-3xl" />
            <div className="lg:col-span-2 h-96 bg-slate-800/40 rounded-3xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-[#0a0f1d] text-white font-sans text-left">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex justify-between items-center gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-black uppercase tracking-tight text-slate-100">
              Travel Document Vault
            </h1>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">
              Secure in-memory access to your etickets, vouchers, and ledger receipts
            </p>
          </div>
        </div>

        {trips.length === 0 ? (
          <div className="bg-[#111827]/80 border border-slate-800/80 p-12 rounded-3xl text-center space-y-4 shadow-xl">
            <div className="w-16 h-16 rounded-full bg-slate-800/60 flex items-center justify-center mx-auto text-2xl">
              📂
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-300">No trips registered</h3>
              <p className="text-xs text-slate-500 font-semibold leading-relaxed max-w-sm mx-auto">
                Create a trip and confirm bookings to securely display your documents inside the vault.
              </p>
            </div>
            <button 
              onClick={() => setActiveTab('explore')}
              className="px-5 py-2.5 bg-yellow-400 hover:bg-yellow-500 text-black text-xs font-black uppercase rounded-xl border border-black shadow-[3px_3px_0px_0px_#000000] transition-all cursor-pointer"
            >
              Explore & Book ➔
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Trip Selector Column */}
            <div className="space-y-4">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 px-1">Select Journey</h3>
              
              <div className="space-y-2">
                {trips.map(trip => {
                  const isSelected = trip.id === selectedTripId;
                  return (
                    <button
                      key={trip.id}
                      onClick={() => handleTripSelect(trip.id)}
                      className={`w-full text-left p-4 rounded-2xl border transition-all cursor-pointer flex justify-between items-center gap-3 ${
                        isSelected
                          ? 'bg-yellow-400 text-black border-black font-extrabold shadow-[4px_4px_0px_0px_rgba(255,255,255,0.1)]'
                          : 'bg-[#111827]/60 border-slate-800/80 text-white hover:bg-slate-850'
                      }`}
                    >
                      <div className="space-y-1">
                        <span className={`text-[10px] font-black uppercase tracking-tight line-clamp-1 ${
                          isSelected ? 'text-black/80' : 'text-slate-100'
                        }`}>
                          {trip.name}
                        </span>
                        <div className={`text-[9px] font-semibold flex items-center gap-1 ${
                          isSelected ? 'text-black/60' : 'text-slate-400'
                        }`}>
                          <MapPin size={10} /> {trip.destination || 'Multiple'}
                        </div>
                      </div>
                      <ChevronRight size={16} />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Documents List Vault Column */}
            <div className="lg:col-span-2 space-y-4">
              
              {activeTrip && (
                <div className="bg-[#111827]/80 border border-slate-800 p-6 rounded-3xl shadow-xl space-y-6">
                  
                  {/* Top Vault Header */}
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-slate-800 pb-4">
                    <div>
                      <h2 className="text-sm font-black uppercase text-yellow-400">
                        📁 Trip Files: {activeTrip.name}
                      </h2>
                      <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mt-0.5 block">
                        Strict cryptographic ownership protection active
                      </span>
                    </div>

                    {documents.length > 0 && (
                      <button
                        onClick={handleDownloadAllZip}
                        className="px-3.5 py-1.5 bg-yellow-400 hover:bg-yellow-500 text-black text-[10px] font-black uppercase rounded-lg border border-black shadow-[2px_2px_0px_0px_#000000] active:translate-y-0.5 active:shadow-none transition-all cursor-pointer flex items-center gap-1"
                      >
                        <Archive size={12} /> Zip Pack All
                      </button>
                    )}
                  </div>

                  {/* Documents Vault List */}
                  {loadingDocs ? (
                    <div className="space-y-3 py-6 animate-pulse">
                      {[1, 2].map(i => (
                        <div key={i} className="h-16 bg-slate-800/40 rounded-xl" />
                      ))}
                    </div>
                  ) : documents.length > 0 ? (
                    <div className="space-y-3">
                      {documents.map((doc, idx) => (
                        <div 
                          key={doc.booking_reference + doc.type + idx}
                          className="p-4 bg-slate-900/60 border border-slate-850 rounded-2xl flex flex-wrap sm:flex-nowrap justify-between items-center gap-3 hover:border-slate-700 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-slate-800/80 text-yellow-400">
                              <FileText size={18} />
                            </div>
                            
                            <div className="space-y-1">
                              <span className="text-[10px] font-black text-slate-200 uppercase tracking-wider block">
                                {doc.name}
                              </span>
                              <div className="text-[9px] text-slate-400 font-semibold flex items-center gap-2">
                                <span className="text-yellow-400 font-bold uppercase text-[8px] bg-yellow-400/10 px-1.5 py-0.5 rounded border border-yellow-400/20">
                                  {doc.type}
                                </span>
                                <span>REF: {doc.booking_reference}</span>
                              </div>
                            </div>
                          </div>

                          <a
                            href={doc.url}
                            target="_blank"
                            rel="noreferrer"
                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-750 text-white text-[10px] font-black uppercase rounded-lg border border-slate-700 transition-all cursor-pointer flex items-center gap-1"
                          >
                            Open PDF <Download size={12} />
                          </a>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-12 border-2 border-dashed border-slate-850 rounded-2xl text-center space-y-3">
                      <ShieldCheck className="mx-auto text-slate-600" size={32} />
                      <h4 className="text-[10px] font-black uppercase text-slate-400">No vault receipts</h4>
                      <p className="text-[9px] text-slate-500 font-semibold max-w-xs mx-auto leading-relaxed">
                        This trip doesn't have any confirmed bookings associated. Complete payments to issue vouchers.
                      </p>
                    </div>
                  )}

                  {/* Security Telemetry Notice */}
                  <div className="p-3 bg-slate-950/40 border border-slate-900 rounded-xl flex items-start gap-2 text-[9px] text-slate-500 font-semibold">
                    <Info size={14} className="text-slate-600 shrink-0 mt-0.5" />
                    <p className="leading-relaxed">
                      PDF vouchers are generated dynamically in-memory and signed securely. Access is locked strictly to your authenticated session.
                    </p>
                  </div>

                </div>
              )}

            </div>

          </div>
        )}

      </div>
    </div>
  );
}
