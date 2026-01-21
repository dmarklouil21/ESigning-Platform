import React, { useRef, useState, useEffect } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { X, Type, PenTool, Check } from 'lucide-react';

// --- 10 Font Options ---
const fontOptions = [
  { name: 'Classic', value: '"Dancing Script", cursive' },
  { name: 'Elegant', value: '"Great Vibes", cursive' },
  { name: 'Monoline', value: '"Sacramento", cursive' },
  { name: 'Vintage', value: '"Parisienne", cursive' },
  { name: 'Messy', value: '"Cedarville Cursive", cursive' },
  { name: 'Formal', value: '"Allura", cursive' },
  { name: 'Marker', value: '"Permanent Marker", cursive' }, // Note: Add Permanent Marker to index.html if you want this specific bold look, replaced below with a standard cursive for safety if link not updated perfectly
  { name: 'Calligraphy', value: '"Mr Dafoe", cursive' },
  { name: 'Thin', value: '"Herr Von Muellerhoff", cursive' },
  { name: 'Casual', value: '"Homemade Apple", cursive' },
  { name: 'Stylish', value: '"Clicker Script", cursive' },
];

const SignatureModal = ({ isOpen, onClose, onSave }) => {
  const sigCanvas = useRef({});
  const [activeTab, setActiveTab] = useState('draw'); 
  const [typedSignature, setTypedSignature] = useState('');
  const [selectedFont, setSelectedFont] = useState(fontOptions[0].value);

  useEffect(() => {
    if (isOpen && activeTab === 'draw' && sigCanvas.current) {
      const canvas = sigCanvas.current.getCanvas();
      if (!canvas) return;

      // Get the device pixel ratio (e.g., 2 for Retina, 1 for standard)
      const ratio = Math.max(window.devicePixelRatio || 1, 1);

      // Cache the visual size
      const width = canvas.offsetWidth;
      const height = canvas.offsetHeight;

      // Set the internal resolution to match the ratio (High Res)
      canvas.width = width * ratio;
      canvas.height = height * ratio;

      // Scale the drawing context so mouse coords match the new resolution
      const ctx = canvas.getContext("2d");
      ctx.scale(ratio, ratio);

      // Clear to apply settings
      sigCanvas.current.clear(); 
    }
  }, [isOpen, activeTab]);

  if (!isOpen) return null;

  const trimCanvas = (canvas) => {
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    const imageData = ctx.getImageData(0, 0, width, height);
    const { data } = imageData;
    
    let minX = width, minY = height, maxX = 0, maxY = 0;
    let found = false;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const alpha = data[(y * width + x) * 4 + 3];
        if (alpha > 0) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
          found = true;
        }
      }
    }

    if (!found) return null;

    const padding = 10; // Slightly more padding for loopier fonts
    const trimWidth = (maxX - minX) + (padding * 2);
    const trimHeight = (maxY - minY) + (padding * 2);

    const trimmedCanvas = document.createElement('canvas');
    trimmedCanvas.width = trimWidth;
    trimmedCanvas.height = trimHeight;
    const trimmedCtx = trimmedCanvas.getContext('2d');

    trimmedCtx.drawImage(
      canvas,
      minX - padding, minY - padding,
      trimWidth, trimHeight,
      0, 0,
      trimWidth, trimHeight
    );

    return trimmedCanvas.toDataURL('image/png');
  };

  const handleSave = () => {
    if (activeTab === 'draw') {
      if (!sigCanvas.current.isEmpty()) {
        const rawCanvas = sigCanvas.current.getCanvas();
        const trimmedImage = trimCanvas(rawCanvas);
        if (trimmedImage) {
          onSave(trimmedImage);
          onClose();
        }
      }
    } else {
      if (typedSignature.trim()) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 1000; // Extra wide for long names
        canvas.height = 300; 
        
        ctx.font = `80px ${selectedFont}`; 
        ctx.fillStyle = 'black';
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';
        ctx.fillText(typedSignature, canvas.width / 2, canvas.height / 2);

        const trimmedImage = trimCanvas(canvas);
        if (trimmedImage) {
          onSave(trimmedImage);
          onClose();
        }
      }
    }
  };

  const clear = () => {
    if (sigCanvas.current?.clear) sigCanvas.current.clear();
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
          <div className="bg-white border border-slate-300 rounded-lg shadow-sm overflow-hidden w-full max-w-[400px]">
            {activeTab === 'draw' ? (
              <SignatureCanvas 
                ref={sigCanvas}
                penColor='black'
                velocityFilterWeight={0.7}
                minWidth={1}   // Increased slightly for high-res visibility
                maxWidth={3}   // Increased slightly
                throttle={16}
                canvasProps={{
                  className: 'cursor-crosshair',
                  style: { width: '100%', height: '200px' } 
                }}
              />
            ) : (
              <div className="flex flex-col">
                {/* Input Area */}
                <div className="w-full h-[120px] flex items-center justify-center p-4 bg-white relative">
                  <input 
                    type="text" 
                    placeholder="Type your name"
                    value={typedSignature}
                    onChange={(e) => setTypedSignature(e.target.value)}
                    className="w-full text-center text-4xl border-none outline-none bg-transparent placeholder:text-slate-300 placeholder:font-sans z-10 relative"
                    style={{ fontFamily: selectedFont }} 
                  />
                  {/* Faint guide line */}
                  <div className="absolute bottom-10 left-10 right-10 h-px bg-slate-100 z-0"></div>
                </div>

                {/* Font Selector - Scrollable Grid */}
                <div className="bg-slate-50 border-t border-slate-200 p-2">
                   <div className="text-xs font-semibold text-slate-400 mb-2 px-1 uppercase tracking-wider">Select Style</div>
                   <div className="grid grid-cols-2 gap-2 max-h-[180px] overflow-y-auto custom-scrollbar pr-1">
                     {fontOptions.map((font) => (
                       <button
                         key={font.name}
                         onClick={() => setSelectedFont(font.value)}
                         className={`px-3 py-3 rounded-md transition-all flex items-center justify-between group text-left ${selectedFont === font.value ? 'bg-blue-100 text-blue-700 border border-blue-200 shadow-sm ring-1 ring-blue-200' : 'bg-white border border-slate-200 hover:border-slate-300 text-slate-600 hover:shadow-sm'}`}
                       >
                         <span style={{ fontFamily: font.value }} className="text-xl truncate w-full pr-2">
                           {typedSignature || "Signature"}
                         </span>
                         {selectedFont === font.value && <Check className="w-4 h-4 shrink-0" />}
                       </button>
                     ))}
                   </div>
                </div>
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