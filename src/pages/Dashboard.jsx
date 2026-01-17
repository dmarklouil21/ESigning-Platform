import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, FileText, PenTool, Clock, Search, LogOut, Loader2, MoreVertical, Download, Send, Trash2, History, AlertTriangle, X } from 'lucide-react';
import { collection, query, where, onSnapshot, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { ref, updateMetadata } from 'firebase/storage';
import { db, storage } from '../firebase';
import { useAuth } from '../context/AuthContext';
import UploadModal from '../components/UploadModal';
import HistoryModal from '../components/HistoryModal';
import FinishModal from '../components/FinishModal';
import emailjs from '@emailjs/browser'; 

// --- Delete Confirmation Modal ---
const DeleteModal = ({ isOpen, onClose, onConfirm, isDeleting }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden animate-fade-in">
        <div className="p-6 text-center">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-6 h-6 text-red-600" />
          </div>
          <h3 className="text-lg font-bold text-slate-800">Delete Document?</h3>
          <p className="text-sm text-slate-500 mt-2">
            Are you sure you want to delete this file? This action cannot be undone.
          </p>
        </div>
        <div className="bg-slate-50 px-6 py-4 flex gap-3">
          <button onClick={onClose} disabled={isDeleting} className="flex-1 py-2.5 bg-white border border-slate-200 text-slate-700 font-medium rounded-lg hover:bg-slate-100 transition-colors">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={isDeleting} className="flex-1 py-2.5 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 shadow-sm flex items-center justify-center gap-2">
            {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};

const Dashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  
  // Data State
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState(''); // Search State

  // Modals State
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [selectedHistoryDoc, setSelectedHistoryDoc] = useState({ id: null, name: '' });

  // Email/Action Modal State
  const [isFinishModalOpen, setIsFinishModalOpen] = useState(false);
  const [selectedDocForAction, setSelectedDocForAction] = useState(null);
  const [finishModalMode, setFinishModalMode] = useState('select'); // 'select' or 'email_only'
  const [processingAction, setProcessingAction] = useState(false);

  // Delete State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [docToDelete, setDocToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch Docs
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "documents"), where("uid", "==", user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedDocs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      fetchedDocs.sort((a, b) => b.createdAt?.seconds - a.createdAt?.seconds); // Sort by Newest
      setDocs(fetchedDocs);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  // --- Filtering Logic ---
  const filteredDocs = docs.filter(doc => 
    doc.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // --- Actions ---

  const handleDownload = async (docData) => {
    if (!docData.fileUrl) return;
    try {
      const response = await fetch(docData.fileUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = docData.name.startsWith('signed_') ? docData.name : `signed_${docData.name}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Download failed:", err);
      alert("Failed to download file.");
    }
  };

  const handleEmail = async (recipientEmail) => {
    if (!selectedDocForAction) return;
    
    setProcessingAction(true); 

    try {
      const fileRef = ref(storage, selectedDocForAction.storagePath);

      await updateMetadata(fileRef, {
        contentDisposition: `attachment; filename="${selectedDocForAction.name}"`,
        contentType: 'application/pdf'
      });

      const templateParams = {
        to_email: recipientEmail,
        document_name: selectedDocForAction.name,
        download_link: selectedDocForAction.fileUrl,
        from_name: user.displayName || user.email,
        from_email: user.email,
        reply_to: user.email,
        message: "Here is the signed document you requested."
      };

      await emailjs.send(
        'service_g23671h', 
        'template_n5lpdpv', 
        templateParams, 
        '0WB5-X4FNk0oe3RAt'
      );

      // Log success
      await updateDoc(doc(db, "documents", selectedDocForAction.id), { status: 'Sent' });

      setProcessingAction(false); 
      return true; 
    } catch (err) {
      console.error("Email failed:", err);
      if (err.code === 'storage/object-not-found') {
        alert("Could not configure auto-download, but will try to send link anyway.");
      } else {
        alert("Failed to send email.");
      }
      setProcessingAction(false);
      alert("Failed to send email. Check console.");
      return false;
    }
  };

  const confirmDelete = async () => {
    if (!docToDelete) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, "documents", docToDelete));
      setDeleteModalOpen(false);
      setDocToDelete(null);
    } catch (err) {
      console.error("Delete failed:", err);
      alert("Failed to delete document.");
    }
    setIsDeleting(false);
  };

  const handleLogout = async () => {
    try { await logout(); navigate('/login'); } catch (err) {}
  };

  const onMenuAction = (action, docData) => {
    if (action === 'download') {
      handleDownload(docData);
    } else if (action === 'email') {
      setSelectedDocForAction(docData);
      setFinishModalMode('email_only'); // <--- Tell Modal to go straight to Email
      setIsFinishModalOpen(true);
    } else if (action === 'delete') {
      setDocToDelete(docData.id);
      setDeleteModalOpen(true); // Open Delete Modal
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'Just now';
    return new Date(timestamp.seconds * 1000).toLocaleDateString("en-US", { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-8 py-4 flex justify-between items-center sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <PenTool className="w-5 h-5 text-blue-600" />
          <div className="text-xl font-bold text-slate-800">SignFast</div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-slate-600 hidden md:block">Welcome, {user?.displayName || user?.email}</div>
          <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-red-500 transition-colors"><LogOut className="w-5 h-5" /></button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
            <p className="text-slate-500 mt-1">Manage and track your documents.</p>
          </div>
          <button onClick={() => setIsUploadOpen(true)} className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all font-medium">
            <Plus className="w-5 h-5" /> Upload New
          </button>
        </div>

        {/* --- Search Bar Restored --- */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 mb-8 flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3.5 w-5 h-5 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search documents by name..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
              />
            </div>
        </div>

        <div className="grid gap-4 pb-20">
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 text-blue-600 animate-spin" /></div>
          ) : filteredDocs.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-xl border border-dashed border-slate-300">
              <div className="bg-slate-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"><FileText className="w-8 h-8 text-slate-400" /></div>
              <h3 className="text-slate-900 font-medium">{searchTerm ? 'No search results found' : 'No documents yet'}</h3>
            </div>
          ) : (
            filteredDocs.map((doc) => (
              <DocumentCard 
                key={doc.id}
                docData={doc}
                date={formatDate(doc.createdAt)}
                onClick={() => navigate(`/editor/${doc.id}`)} 
                onHistory={(e) => {
                  e.stopPropagation();
                  setSelectedHistoryDoc({ id: doc.id, name: doc.name });
                  setIsHistoryOpen(true);
                }}
                onMenuAction={onMenuAction}
              />
            ))
          )}
        </div>
      </main>

      <UploadModal isOpen={isUploadOpen} onClose={() => setIsUploadOpen(false)} onUploadSuccess={() => setIsUploadOpen(false)} />
      <HistoryModal isOpen={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} docId={selectedHistoryDoc.id} docName={selectedHistoryDoc.name} />
      
      {/* Delete Confirmation Modal */}
      <DeleteModal 
        isOpen={deleteModalOpen} 
        onClose={() => setDeleteModalOpen(false)} 
        onConfirm={confirmDelete}
        isDeleting={isDeleting}
      />

      <FinishModal 
        isOpen={isFinishModalOpen} 
        onClose={() => setIsFinishModalOpen(false)}
        onDownload={() => {
          handleDownload(selectedDocForAction);
          setIsFinishModalOpen(false);
        }}
        onEmail={handleEmail}
        processing={processingAction} // Handled locally in dashboard action if simple, or inside modal
        initialMode={finishModalMode} // <--- Pass the mode ('email_only' or 'select')
      />
    </div>
  );
};

const DocumentCard = ({ docData, date, onClick, onHistory, onMenuAction }) => {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleAction = (e, action) => {
    e.stopPropagation();
    setShowMenu(false);
    onMenuAction(action, docData);
  };

  const isSigned = docData.status === 'Signed' || docData.status === 'Sent';

  // FIX: Dynamic Z-Index to prevent overlay issues
  // If this card's menu is open, it gets z-50. If not, z-0.
  // This ensures the dropdown floats ABOVE the card below it.
  const cardZIndex = showMenu ? 'z-50' : 'z-0';

  return (
    <div 
      onClick={onClick} 
      className={`bg-white p-5 rounded-xl border border-slate-100 hover:shadow-md transition-shadow flex items-center justify-between group cursor-pointer relative ${cardZIndex}`}
    >
      <div className="flex items-center gap-4">
        <div className="bg-blue-50 p-3 rounded-lg">
          <FileText className="w-6 h-6 text-blue-600" />
        </div>
        <div>
          <h4 className="font-semibold text-slate-800 group-hover:text-blue-600 transition-colors">{docData.name}</h4>
          <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
            <Clock className="w-3 h-3" />
            <span>Uploaded {date}</span>
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-4">
        <span className={`px-3 py-1 rounded-full text-xs font-medium ${isSigned ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
          {docData.status}
        </span>
        
        <button onClick={onHistory} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-all" title="View History">
          <History className="w-4 h-4" />
        </button>

        <div className="relative" ref={menuRef}>
          <button 
            onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
            className={`p-2 rounded-full transition-all ${showMenu ? 'bg-slate-100 text-slate-700' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'}`}
          >
            <MoreVertical className="w-5 h-5" />
          </button>

          {showMenu && (
            <div className="absolute right-0 top-10 w-48 bg-white rounded-lg shadow-xl border border-slate-100 z-50 overflow-hidden animate-fade-in">
              {isSigned ? (
                <>
                  <button onClick={(e) => handleAction(e, 'download')} className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                    <Download className="w-4 h-4 text-slate-500" /> Download
                  </button>
                  <button onClick={(e) => handleAction(e, 'email')} className="w-full text-left px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2">
                    <Send className="w-4 h-4 text-slate-500" /> Send Email
                  </button>
                </>
              ) : (
                <div className="px-4 py-3 text-xs text-slate-400 italic text-center">
                  Sign document to enable options
                </div>
              )}
              <div className="border-t border-slate-100 my-1"></div>
              <button onClick={(e) => handleAction(e, 'delete')} className="w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2">
                <Trash2 className="w-4 h-4" /> Delete
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;