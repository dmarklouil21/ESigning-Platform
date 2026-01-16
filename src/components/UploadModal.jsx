import React, { useState } from 'react';
import { Upload, X, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, storage, logAction } from '../firebase'; // Import your firebase config
import { useAuth } from '../context/AuthContext';

const UploadModal = ({ isOpen, onClose, onUploadSuccess }) => {
  const { user } = useAuth();
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected && selected.type === 'application/pdf') {
      setFile(selected);
      setError('');
    } else {
      setFile(null);
      setError('Please select a valid PDF file.');
    }
  };

  const handleUpload = async () => {
    if (!file || !user) return;

    setUploading(true);
    setError('');

    try {
      // Create a reference to where the file will be saved in Firebase Storage
      // Path: uploads/USER_ID/FILE_NAME
      const storageRef = ref(storage, `uploads/${user.uid}/${Date.now()}_${file.name}`);

      // Upload the file
      const snapshot = await uploadBytes(storageRef, file);
      
      // Get the download URL
      const downloadURL = await getDownloadURL(snapshot.ref);

      // Save Metadata to Firestore
      const docRef = await addDoc(collection(db, "documents"), {
        uid: user.uid,              // User ID
        name: file.name,            // File Name
        fileUrl: downloadURL,       // Link to the file
        createdAt: serverTimestamp(), // Upload timestamp (Server side time is safer)
        status: "Uploaded",         // Initial Status
        storagePath: snapshot.ref.fullPath // Reference path for deletion later
      });

      await logAction(docRef.id, "Document Uploaded", `File ${file.name} uploaded successfully.`);

      // Cleanup and Close
      setUploading(false);
      setFile(null);
      onUploadSuccess(); // Refresh the dashboard list
      onClose();

    } catch (err) {
      console.error("Upload Error:", err);
      setError('Failed to upload file. Please try again.');
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
          <h3 className="font-bold text-slate-800 text-lg">Upload Document</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {error && (
            <div className="mb-4 flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg">
              <AlertCircle className="w-4 h-4" /> {error}
            </div>
          )}

          {/* Drag & Drop Area (Styled as a big button for simplicity) */}
          <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center hover:bg-slate-50 transition-colors relative">
            <input 
              type="file" 
              accept="application/pdf"
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            
            {!file ? (
              <>
                <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Upload className="w-6 h-6" />
                </div>
                <p className="font-medium text-slate-700">Click to upload PDF</p>
                <p className="text-sm text-slate-400 mt-1">PDF files only, max 5MB</p>
              </>
            ) : (
              <div className="flex flex-col items-center animate-pulse-once">
                <FileText className="w-10 h-10 text-blue-600 mb-2" />
                <p className="font-medium text-slate-800">{file.name}</p>
                <p className="text-sm text-green-600 mt-1 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" /> Ready to upload
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-slate-600 font-medium hover:text-slate-800"
          >
            Cancel
          </button>
          <button 
            onClick={handleUpload}
            disabled={!file || uploading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium shadow-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {uploading ? 'Uploading...' : 'Upload Document'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default UploadModal;