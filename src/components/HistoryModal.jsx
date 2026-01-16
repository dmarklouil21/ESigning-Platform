import React, { useEffect, useState } from 'react';
import { X, Clock, User, Activity, Loader2 } from 'lucide-react';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

const HistoryModal = ({ isOpen, onClose, docId, docName }) => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && docId) {
      const fetchHistory = async () => {
        try {
          // Fetch the 'history' sub-collection
          const q = query(collection(db, "documents", docId, "history"), orderBy("timestamp", "desc"));
          const querySnapshot = await getDocs(q);
          const historyData = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          setLogs(historyData);
        } catch (error) {
          console.error("Error fetching history:", error);
        } finally {
          setLoading(false);
        }
      };
      fetchHistory();
    }
  }, [isOpen, docId]);

  if (!isOpen) return null;

  // Helper to format timestamps
  const formatTime = (timestamp) => {
    if (!timestamp) return "";
    return new Date(timestamp.seconds * 1000).toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-fade-in">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div>
            <h3 className="font-bold text-slate-800">Document History</h3>
            <p className="text-xs text-slate-500">History for: {docName}</p>
          </div>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400 hover:text-slate-600" /></button>
        </div>

        {/* Body */}
        <div className="p-0 max-h-[60vh] overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-blue-600"/></div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8 text-slate-500">No history found.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {logs.map((log) => (
                <div key={log.id} className="p-4 hover:bg-slate-50 transition-colors flex gap-4">
                  <div className="mt-1">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                      <Activity className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <h4 className="font-semibold text-slate-800 text-sm">{log.action}</h4>
                      <span className="text-xs text-slate-400 font-mono whitespace-nowrap">{formatTime(log.timestamp)}</span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1">{log.details}</p>
                    <div className="flex items-center gap-1 mt-2 text-xs text-slate-400">
                      <User className="w-3 h-3" /> {log.user}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 text-right">
          <button onClick={onClose} className="text-sm font-medium text-slate-600 hover:text-slate-900">Close</button>
        </div>

      </div>
    </div>
  );
};

export default HistoryModal;