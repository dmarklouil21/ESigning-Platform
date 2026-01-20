import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, FileText, User, Users, Loader2, Plus, Trash2 } from 'lucide-react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, addDoc } from 'firebase/firestore';
import { db, storage } from '../firebase';
import { useAuth } from '../context/AuthContext';

const UploadModal = ({ isOpen, onClose, onUploadSuccess }) => {
  const { user } = useAuth();
  const [step, setStep] = useState(1); // Step 1: File/Mode, Step 2: Recipients
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [signingMode, setSigningMode] = useState('ME'); 
  
  // Recipient State
  const [recipients, setRecipients] = useState([]);
  const [newRecipientName, setNewRecipientName] = useState('');
  const [newRecipientEmail, setNewRecipientEmail] = useState('');

  const onDrop = useCallback((acceptedFiles) => {
    setFile(acceptedFiles[0]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { 'application/pdf': ['.pdf'] }, multiple: false
  });

  const handleAddRecipient = (e) => {
    e.preventDefault();
    if (newRecipientName && newRecipientEmail) {
      setRecipients([...recipients, {
        id: `recipient_${Date.now()}`,
        name: newRecipientName,
        email: newRecipientEmail,
        status: 'pending',
        tokenId: crypto.randomUUID()
      }]);
      setNewRecipientName('');
      setNewRecipientEmail('');
    }
  };

  const handleRemoveRecipient = (id) => {
    setRecipients(recipients.filter(r => r.id !== id));
  };

  const handleFinalUpload = async () => {
    if (!file || !user) return;
    
    // Validation for Remote Mode
    if (signingMode === 'OTHERS' && recipients.length === 0) {
      alert("Please add at least one recipient.");
      return;
    }

    setUploading(true);

    try {
      const storageRef = ref(storage, `documents/${user.uid}/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);

      await addDoc(collection(db, "documents"), {
        uid: user.uid,
        name: file.name,
        fileUrl: url,
        storagePath: storageRef.fullPath,
        createdAt: new Date(),
        status: 'Draft',
        type: signingMode, 
        signatures: [],
        recipients: signingMode === 'OTHERS' ? recipients : [] // Save the list!
      });

      onUploadSuccess();
      // Reset
      setFile(null);
      setSigningMode('ME');
      setRecipients([]);
      setStep(1);
    } catch (error) {
      console.error("Upload failed", error);
      alert("Failed to upload document.");
    }
    setUploading(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-fade-in">
        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-800">
            {step === 1 ? "Upload Document" : "Add Recipients"}
          </h3>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400 hover:text-slate-600" /></button>
        </div>

        <div className="p-6">
          {/* --- STEP 1: Upload & Mode Selection --- */}
          {step === 1 && (
            !file ? (
              <div {...getRootProps()} className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center cursor-pointer transition-colors ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'}`}>
                <input {...getInputProps()} />
                <div className="bg-blue-100 p-4 rounded-full mb-4"><Upload className="w-8 h-8 text-blue-600" /></div>
                <p className="text-slate-600 font-medium text-center">Drag & drop PDF here</p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200">
                  <div className="bg-white p-2 rounded border border-slate-100"><FileText className="w-6 h-6 text-red-500" /></div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-800 truncate">{file.name}</p>
                    <p className="text-xs text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                  <button onClick={() => setFile(null)} className="text-slate-400 hover:text-red-500"><X className="w-5 h-5" /></button>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-3">Who is signing?</label>
                  <div className="grid grid-cols-2 gap-4">
                    <button onClick={() => setSigningMode('ME')} className={`flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all ${signingMode === 'ME' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 hover:border-slate-300 text-slate-600'}`}>
                      <User className="w-6 h-6" /><span className="text-sm font-bold">Only Me</span>
                    </button>
                    <button onClick={() => setSigningMode('OTHERS')} className={`flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all ${signingMode === 'OTHERS' ? 'border-purple-600 bg-purple-50 text-purple-700' : 'border-slate-200 hover:border-slate-300 text-slate-600'}`}>
                      <Users className="w-6 h-6" /><span className="text-sm font-bold">Others (Remote)</span>
                    </button>
                  </div>
                </div>

                <button 
                  onClick={() => signingMode === 'OTHERS' ? setStep(2) : handleFinalUpload()} 
                  disabled={uploading}
                  className={`w-full py-3 text-white font-bold rounded-lg shadow-md transition-all flex items-center justify-center gap-2 ${signingMode === 'ME' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-purple-600 hover:bg-purple-700'}`}
                >
                  {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : (signingMode === 'OTHERS' ? "Next: Add Recipients" : "Upload & Edit")}
                </button>
              </div>
            )
          )}

          {/* --- STEP 2: Add Recipients (Only for Remote) --- */}
          {step === 2 && (
            <div className="space-y-4">
              {/* Add Form */}
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-3">
                <input 
                  type="text" 
                  placeholder="Name (e.g. John Doe)" 
                  value={newRecipientName}
                  onChange={(e) => setNewRecipientName(e.target.value)}
                  className="w-full px-3 py-2 rounded border border-slate-200 focus:ring-2 focus:ring-purple-500 outline-none text-sm"
                />
                <div className="flex gap-2">
                  <input 
                    type="email" 
                    placeholder="Email (e.g. john@email.com)" 
                    value={newRecipientEmail}
                    onChange={(e) => setNewRecipientEmail(e.target.value)}
                    className="flex-1 px-3 py-2 rounded border border-slate-200 focus:ring-2 focus:ring-purple-500 outline-none text-sm"
                  />
                  <button 
                    onClick={handleAddRecipient}
                    disabled={!newRecipientName || !newRecipientEmail}
                    className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 disabled:opacity-50 text-sm font-medium"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* List */}
              <div className="max-h-[200px] overflow-y-auto space-y-2">
                {recipients.length === 0 && <p className="text-center text-slate-400 text-sm py-4">No recipients added yet.</p>}
                {recipients.map(r => (
                  <div key={r.id} className="flex justify-between items-center bg-white p-3 rounded border border-slate-100 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-xs font-bold">{r.name.charAt(0)}</div>
                      <div>
                        <p className="text-sm font-bold text-slate-700">{r.name}</p>
                        <p className="text-xs text-slate-500">{r.email}</p>
                      </div>
                    </div>
                    <button onClick={() => handleRemoveRecipient(r.id)} className="text-slate-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={() => setStep(1)} className="flex-1 py-3 text-slate-600 font-medium hover:bg-slate-100 rounded-lg">Back</button>
                <button 
                  onClick={handleFinalUpload} 
                  disabled={uploading || recipients.length === 0}
                  className="flex-[2] py-3 bg-purple-600 text-white font-bold rounded-lg shadow-md hover:bg-purple-700 disabled:opacity-50 flex justify-center items-center gap-2"
                >
                  {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Upload & Prepare"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UploadModal;