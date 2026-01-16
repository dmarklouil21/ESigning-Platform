import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, FileText, Clock, Search, LogOut, Loader2 } from 'lucide-react';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore'; // 1. Firestore imports
import { db } from '../firebase'; 
import { useAuth } from '../context/AuthContext';
import UploadModal from '../components/UploadModal';

const Dashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  
  // State Management
  const [docs, setDocs] = useState([]); // Stores the list of documents
  const [loading, setLoading] = useState(true); // Loading state
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [error, setError] = useState('');

  // 2. Fetch Documents (Real-time Listener)
  useEffect(() => {
    if (!user) return;

    // Query: Get documents where 'uid' matches current user
    // Note: If you get a "Missing Index" error in console, remove the 'orderBy' and sort in JavaScript instead.
    const q = query(
      collection(db, "documents"), 
      where("uid", "==", user.uid)
      // orderBy("createdAt", "desc") // requires a Firestore Index. Uncomment if you set it up.
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedDocs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Client-side sort to avoid index setup during MVP (Newest first)
      fetchedDocs.sort((a, b) => b.createdAt?.seconds - a.createdAt?.seconds);

      setDocs(fetchedDocs);
      setLoading(false);
    }, (err) => {
      console.error("Error fetching docs:", err);
      setError("Failed to load documents.");
      setLoading(false);
    });

    // Cleanup listener on unmount
    return () => unsubscribe();
  }, [user]);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (err) {
      setError('Failed to log out');
    }
  };

  // With real-time listeners, we just close the modal. The list updates automatically.
  const onUploadSuccess = () => {
    setIsUploadOpen(false);
  };

  const handleOpenEditor = (docId) => {
    navigate(`/editor/${docId}`); // Navigate to the new page
  };

  // Helper to format Firestore Timestamp to readable date
  const formatDate = (timestamp) => {
    if (!timestamp) return 'Just now';
    return new Date(timestamp.seconds * 1000).toLocaleDateString("en-US", {
      month: 'short', day: 'numeric', year: 'numeric'
    });
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-8 py-4 flex justify-between items-center">
        <div className="text-xl font-bold text-slate-800">SignFast</div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-slate-600 hidden md:block">
            Welcome, {user?.displayName || user?.email}
          </div>
          <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-red-500 transition-colors">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
            <p className="text-slate-500 mt-1">Manage and track your documents.</p>
          </div>
          <button 
            onClick={() => setIsUploadOpen(true)}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all font-medium"
          >
            <Plus className="w-5 h-5" />
            Upload New
          </button>
        </div>

        {error && <div className="mb-4 text-red-600">{error}</div>}

        {/* Search Bar */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 mb-8 flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3.5 w-5 h-5 text-slate-400" />
              <input type="text" placeholder="Search documents..." className="w-full pl-10 pr-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-100" />
            </div>
        </div>

        {/* 3. Document List Rendering */}
        <div className="grid gap-4">
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            </div>
          ) : docs.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-xl border border-dashed border-slate-300">
              <div className="bg-slate-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-slate-900 font-medium">No documents yet</h3>
              <p className="text-slate-500 text-sm mt-1">Upload a PDF to start signing.</p>
            </div>
          ) : (
            docs.map((doc) => (
              <DocumentCard 
                key={doc.id}
                title={doc.name}
                date={formatDate(doc.createdAt)}
                status={doc.status}
                // We will use this ID later to open the Editor
                // onClick={() => console.log("Open Editor for:", doc.id)} 
                onClick={() => handleOpenEditor(doc.id)}
              />
            ))
          )}
        </div>
      </main>

      <UploadModal 
        isOpen={isUploadOpen} 
        onClose={() => setIsUploadOpen(false)}
        onUploadSuccess={onUploadSuccess}
      />
    </div>
  );
};

// Updated Card Component to accept props
const DocumentCard = ({ title, date, status, onClick }) => (
  <div 
    onClick={onClick}
    className="bg-white p-5 rounded-xl border border-slate-100 hover:shadow-md transition-shadow flex items-center justify-between group cursor-pointer"
  >
    <div className="flex items-center gap-4">
      <div className="bg-blue-50 p-3 rounded-lg">
        <FileText className="w-6 h-6 text-blue-600" />
      </div>
      <div>
        <h4 className="font-semibold text-slate-800 group-hover:text-blue-600 transition-colors">{title}</h4>
        <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
          <Clock className="w-3 h-3" />
          <span>Uploaded {date}</span>
        </div>
      </div>
    </div>
    <div className="flex items-center gap-6">
      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
        status === 'Signed' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
      }`}>
        {status}
      </span>
      <button className="text-slate-400 hover:text-blue-600 text-sm font-medium">Open</button>
    </div>
  </div>
);

export default Dashboard;