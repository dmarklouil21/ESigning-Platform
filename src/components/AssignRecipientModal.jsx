import React from 'react';
import { X, User } from 'lucide-react';

const AssignRecipientModal = ({ isOpen, onClose, recipients, onAssign }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-xs overflow-hidden animate-fade-in">
        <div className="px-5 py-3 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h3 className="font-bold text-slate-700 text-sm">Assign to...</h3>
          <button onClick={onClose}><X className="w-4 h-4 text-slate-400 hover:text-slate-600" /></button>
        </div>
        
        <div className="p-2 max-h-[300px] overflow-y-auto">
          {recipients.map((r) => (
            <button
              key={r.id}
              onClick={() => { onAssign(r.id); onClose(); }}
              className="w-full flex items-center gap-3 p-3 hover:bg-purple-50 rounded-lg transition-colors group text-left"
            >
              <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 group-hover:bg-purple-200 group-hover:text-purple-700 flex items-center justify-center text-xs font-bold border border-slate-200 group-hover:border-purple-200">
                {r.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-700 group-hover:text-purple-900 truncate">{r.name}</p>
                <p className="text-[10px] text-slate-500 truncate">{r.email}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AssignRecipientModal;