import React, { useState } from 'react';
import { Download, Mail, X, Loader2, CheckCircle } from 'lucide-react';

const FinishModal = ({ isOpen, onClose, onDownload, onEmail, processing }) => {
  const [email, setEmail] = useState('');
  const [mode, setMode] = useState('select'); // 'select', 'email_input', 'success'

  if (!isOpen) return null;

  const handleEmailSubmit = () => {
    if (email) onEmail(email);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in">
        
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
          <h3 className="font-bold text-slate-800">Finish Document</h3>
          <button onClick={onClose} disabled={processing}><X className="w-5 h-5 text-slate-400" /></button>
        </div>

        <div className="p-8">
          {processing ? (
            <div className="text-center py-4">
              <Loader2 className="w-10 h-10 text-blue-600 animate-spin mx-auto mb-4" />
              <p className="text-slate-600 font-medium">Processing Document...</p>
              <p className="text-xs text-slate-400 mt-2">Merging signatures & uploading</p>
            </div>
          ) : mode === 'success' ? (
             <div className="text-center py-4">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
              <p className="text-slate-800 font-bold text-lg">Sent Successfully!</p>
              <p className="text-slate-500 mt-2">The document has been emailed to {email}</p>
              <button onClick={onClose} className="mt-6 px-6 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 font-medium">Close</button>
            </div>
          ) : mode === 'email_input' ? (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Recipient Email</label>
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="client@example.com"
                className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none mb-6"
              />
              <div className="flex gap-3">
                <button onClick={() => setMode('select')} className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-lg font-medium">Back</button>
                <button onClick={handleEmailSubmit} className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-medium shadow-md hover:bg-blue-700">Send</button>
              </div>
            </div>
          ) : (
            <div className="grid gap-4">
              <button 
                onClick={onDownload}
                className="flex items-center justify-center gap-3 w-full py-4 border-2 border-slate-100 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all group"
              >
                <div className="bg-blue-100 p-3 rounded-full text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  <Download className="w-6 h-6" />
                </div>
                <div className="text-left">
                  <span className="block font-bold text-slate-800">Download PDF</span>
                  <span className="block text-xs text-slate-500">Save directly to your device</span>
                </div>
              </button>

              <button 
                onClick={() => setMode('email_input')}
                className="flex items-center justify-center gap-3 w-full py-4 border-2 border-slate-100 rounded-xl hover:border-purple-500 hover:bg-purple-50 transition-all group"
              >
                <div className="bg-purple-100 p-3 rounded-full text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                  <Mail className="w-6 h-6" />
                </div>
                <div className="text-left">
                  <span className="block font-bold text-slate-800">Send via Email</span>
                  <span className="block text-xs text-slate-500">Email signed link to recipient</span>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FinishModal;