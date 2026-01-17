import React, { useState, useEffect } from 'react';
import { Download, Mail, X, Loader2, CheckCircle } from 'lucide-react';

const FinishModal = ({ isOpen, onClose, onDownload, onEmail, processing, initialMode = 'select' }) => {
  const [email, setEmail] = useState('');
  const [mode, setMode] = useState('select'); // 'select', 'email_input', 'success'

  useEffect(() => {
    if (isOpen) {
      if (initialMode === 'email_only') {
        setMode('email_input');
      } else {
        setMode('select');
      }
      setEmail('');
    }
  }, [isOpen, initialMode]);

  if (!isOpen) return null;

  const handleEmailSubmit = async () => {
    if (email) {
      // Wait for the parent to send the email
      // If parent returns 'true', show success screen.
      const success = await onEmail(email);
      if (success) {
        setMode('success');
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in">
        
        {/* Header (Hidden on Success screen for cleaner look) */}
        {mode !== 'success' && (
          <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
            <h3 className="font-bold text-slate-800">
              {mode === 'email_input' ? 'Send via Email' : 'Finish Document'}
            </h3>
            <button onClick={onClose} disabled={processing}>
              <X className={`w-5 h-5 ${processing ? 'text-slate-200' : 'text-slate-400'}`} />
            </button>
          </div>
        )}

        <div className="p-8">
          {/* --- 1. SUCCESS STATE --- */}
          {mode === 'success' ? (
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce-short">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">Email Sent!</h3>
              <p className="text-slate-500 mb-6">
                The document has been successfully delivered to <span className="font-medium text-slate-800">{email}</span>.
              </p>
              <button 
                onClick={onClose} 
                className="w-full py-3 bg-slate-100 text-slate-700 font-bold rounded-lg hover:bg-slate-200 transition-colors"
              >
                Close
              </button>
            </div>

          /* --- 2. EMAIL INPUT STATE --- */
          ) : mode === 'email_input' ? (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Recipient Email</label>
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="client@example.com"
                disabled={processing}
                className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none mb-6 disabled:bg-slate-50 disabled:text-slate-400"
              />
              <div className="flex gap-3">
                {initialMode !== 'email_only' && (
                  <button 
                    onClick={() => setMode('select')} 
                    disabled={processing}
                    className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-lg font-medium disabled:opacity-50"
                  >
                    Back
                  </button>
                )}
                {initialMode === 'email_only' && (
                  <button 
                    onClick={onClose} 
                    disabled={processing}
                    className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-lg font-medium disabled:opacity-50"
                  >
                    Cancel
                  </button>
                )}
                
                <button 
                  onClick={handleEmailSubmit} 
                  disabled={processing || !email}
                  className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-medium shadow-md hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {processing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    "Send"
                  )}
                </button>
              </div>
            </div>

          /* --- 3. SELECTION STATE --- */
          ) : (
            <div className="grid gap-4">
              <button 
                onClick={onDownload}
                disabled={processing}
                className="flex items-center justify-center gap-3 w-full py-4 border-2 border-slate-100 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all group disabled:opacity-50 disabled:cursor-wait"
              >
                {processing ? (
                   <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
                ) : (
                  <>
                    <div className="bg-blue-100 p-3 rounded-full text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                      <Download className="w-6 h-6" />
                    </div>
                    <div className="text-left">
                      <span className="block font-bold text-slate-800">Download PDF</span>
                      <span className="block text-xs text-slate-500">Save directly to your device</span>
                    </div>
                  </>
                )}
              </button>

              <button 
                onClick={() => setMode('email_input')}
                disabled={processing}
                className="flex items-center justify-center gap-3 w-full py-4 border-2 border-slate-100 rounded-xl hover:border-purple-500 hover:bg-purple-50 transition-all group disabled:opacity-50"
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