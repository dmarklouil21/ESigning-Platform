import React, { useState } from 'react'; // Added useState for local UI states if needed later
import { Link, useNavigate } from 'react-router-dom';
import { Plus, FileText, Clock, Search, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext'; // 1. Import Auth Context

const Dashboard = () => {
  const { user, logout } = useAuth(); // 2. Get user info and logout function
  const navigate = useNavigate();
  const [error, setError] = useState('');

  // 3. Create Logout Handler
  const handleLogout = async () => {
    setError('');
    try {
      await logout();
      navigate('/login'); // Redirect to login page after logout
    } catch (err) {
      setError('Failed to log out');
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top Navigation */}
      <header className="bg-white border-b border-slate-200 px-8 py-4 flex justify-between items-center">
        <div className="text-xl font-bold text-slate-800">SignFast</div>
        <div className="flex items-center gap-4">
          {/* Display User's Email if available */}
          <div className="text-sm text-slate-600 hidden md:block">
            Welcome, {user?.email} 
          </div>
          
          {/* Functional Logout Button */}
          <button 
            onClick={handleLogout} 
            className="p-2 text-slate-400 hover:text-red-500 transition-colors flex items-center gap-2"
            title="Log Out"
          >
            <LogOut className="w-5 h-5" />
            <span className="text-sm font-medium hidden md:block">Log Out</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 py-10">
        
        {/* Error Message (if logout fails) */}
        {error && <div className="mb-4 text-red-600 bg-red-50 p-3 rounded">{error}</div>}

        {/* Action Bar */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
            <p className="text-slate-500 mt-1">Manage and track your documents.</p>
          </div>
          
          {/* Placeholder for Upload Button - we will activate this next */}
          <button className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all font-medium">
            <Plus className="w-5 h-5" />
            Upload New
          </button>
        </div>

        {/* Search & Filter */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 mb-8 flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3.5 w-5 h-5 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search documents..." 
              className="w-full pl-10 pr-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </div>
          <select className="px-4 py-3 rounded-lg border border-slate-200 bg-white text-slate-600 focus:outline-none">
            <option>All Status</option>
            <option>Signed</option>
            <option>Pending</option>
          </select>
        </div>

        {/* Documents List (Placeholder) */}
        <div className="grid gap-4">
          <DocumentCard 
            title="Non-Disclosure Agreement.pdf" 
            date="Jan 15, 2024" 
            status="Signed" 
          />
          <DocumentCard 
            title="Freelance Contract - v2.pdf" 
            date="Jan 14, 2024" 
            status="Pending" 
          />
        </div>
      </main>
    </div>
  );
};

// Simple sub-component for list items
const DocumentCard = ({ title, date, status }) => (
  <div className="bg-white p-5 rounded-xl border border-slate-100 hover:shadow-md transition-shadow flex items-center justify-between group">
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
        status === 'Signed' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
      }`}>
        {status}
      </span>
      <button className="text-slate-400 hover:text-blue-600 text-sm font-medium">View</button>
    </div>
  </div>
);

export default Dashboard;