import React, { useRef, useState } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { X, Type, PenTool } from 'lucide-react';

const SignatureModal = ({ isOpen, onClose, onSave }) => {
  const sigCanvas = useRef({});
  const [activeTab, setActiveTab] = useState('draw'); // 'draw' or 'type'
  const [typedSignature, setTypedSignature] = useState('');

  if (!isOpen) return null;

  const handleSave = () => {
    if (activeTab === 'draw') {
      if (!sigCanvas.current.isEmpty()) {
        // Convert drawing to an image URL (Base64)
        const signatureImage = sigCanvas.current.getCanvas().toDataURL('image/png');
        onSave(signatureImage);
        onClose();
      }
    } else {
      // Convert typed text to an image (simple canvas approach)
      if (typedSignature.trim()) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 400;
        canvas.height = 100;
        ctx.font = '48px "Dancing Script", cursive'; // Ensure you have a cursive font imported or use generic
        ctx.fillStyle = 'black';
        ctx.fillText(typedSignature, 20, 60);
        onSave(canvas.toDataURL());
        onClose();
      }
    }
  };

  const clear = () => {
    if (sigCanvas.current) sigCanvas.current.clear();
    setTypedSignature('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-fade-in">
        
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-800">Create Signature</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400 hover:text-slate-600" /></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200">
          <button 
            onClick={() => setActiveTab('draw')}
            className={`flex-1 py-3 text-sm font-medium flex justify-center items-center gap-2 ${activeTab === 'draw' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <PenTool className="w-4 h-4" /> Draw
          </button>
          <button 
            onClick={() => setActiveTab('type')}
            className={`flex-1 py-3 text-sm font-medium flex justify-center items-center gap-2 ${activeTab === 'type' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <Type className="w-4 h-4" /> Type
          </button>
        </div>

        {/* Canvas Area */}
        <div className="p-6 bg-slate-100 flex justify-center">
          <div className="bg-white border border-slate-300 rounded-lg shadow-sm">
            {activeTab === 'draw' ? (
              <SignatureCanvas 
                ref={sigCanvas}
                penColor='black'
                canvasProps={{width: 400, height: 200, className: 'cursor-crosshair'}} 
              />
            ) : (
              <div className="w-[400px] h-[200px] flex items-center justify-center p-4">
                <input 
                  type="text" 
                  placeholder="Type your name"
                  value={typedSignature}
                  onChange={(e) => setTypedSignature(e.target.value)}
                  className="w-full text-center text-4xl border-b-2 border-slate-300 focus:border-blue-500 outline-none pb-2 font-[cursive] bg-transparent"
                  style={{ fontFamily: '"Dancing Script", cursive' }} // You might need to add a Google Font link for this
                />
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 flex justify-between items-center bg-white border-t border-slate-100">
          <button onClick={clear} className="text-sm text-red-500 hover:text-red-700 font-medium">Clear</button>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg">Cancel</button>
            <button onClick={handleSave} className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 shadow-md">Use Signature</button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default SignatureModal;