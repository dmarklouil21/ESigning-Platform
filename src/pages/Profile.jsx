import React, { useState } from 'react';
import { User, Mail, CreditCard, ExternalLink, Loader2, Shield, Calendar, ArrowLeft } from 'lucide-react'; // Added ArrowLeft
import { httpsCallable } from 'firebase/functions';
import { functions, auth } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const Profile = () => {
  const { user, userProfile, isPro } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleManageSubscription = async () => {
    setLoading(true);
    try {
      const createPortalSession = httpsCallable(functions, 'createPortalSession');
      const { data } = await createPortalSession({ 
        userId: auth.currentUser?.uid 
      });
      if (data.url) window.location.href = data.url;
    } catch (error) {
      console.error("Portal failed:", error);
      alert("Failed to open billing portal.");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (isoString) => {
    if (!isoString) return 'N/A';
    return new Date(isoString).toLocaleDateString("en-US", { year: 'numeric', month: 'long', day: 'numeric' });
  };

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        
        {/* --- BACK NAVIGATOR --- */}
        <button 
          onClick={() => navigate('/dashboard')} 
          className="group flex items-center gap-2 text-slate-500 hover:text-blue-600 transition-colors mb-8 font-medium"
        >
          <div className="p-2 bg-white border border-slate-200 rounded-full group-hover:border-blue-200 group-hover:bg-blue-50 transition-all">
            <ArrowLeft className="w-4 h-4" />
          </div>
          Back to Dashboard
        </button>

        <h1 className="text-3xl font-bold text-slate-900 mb-8">Account Settings</h1>

        {/* --- Profile Card --- */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-6">
          <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <User className="w-5 h-5 text-blue-600" /> Personal Info
            </h2>
            <span className="text-xs font-mono text-slate-400">UID: {user?.uid?.slice(0, 8)}...</span>
          </div>
          
          <div className="p-8 space-y-6">
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Full Name</label>
              <div className="text-slate-800 font-medium text-lg">{user?.displayName || "No Name Set"}</div>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Email Address</label>
              <div className="flex items-center gap-2 text-slate-800 font-medium text-lg">
                <Mail className="w-4 h-4 text-slate-400" />
                {user?.email}
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Member Since</label>
              <div className="flex items-center gap-2 text-slate-600">
                 <Calendar className="w-4 h-4 text-slate-400" />
                 {formatDate(userProfile?.createdAt || user?.metadata?.creationTime)}
              </div>
            </div>
          </div>
        </div>

        {/* --- Subscription Card --- */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden relative">
          {isPro && <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-600 to-purple-600" />}

          <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-blue-600" /> Subscription
            </h2>
            {isPro ? (
              <span className="bg-green-100 text-green-700 text-xs font-bold px-3 py-1 rounded-full border border-green-200">
                ACTIVE
              </span>
            ) : (
               <span className="bg-slate-100 text-slate-600 text-xs font-bold px-3 py-1 rounded-full border border-slate-200">
                FREE PLAN
              </span>
            )}
          </div>

          <div className="p-8">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-xl font-bold text-slate-900 mb-1">
                  {isPro ? 'Pro Plan' : 'Free Plan'}
                </h3>
                <p className="text-slate-500 text-sm">
                  {isPro 
                    ? 'You have access to unlimited documents and signatures.' 
                    : 'Upgrade to remove limits and access premium features.'}
                </p>
              </div>
              {isPro && (
                 <Shield className="w-8 h-8 text-purple-100 fill-purple-600" />
              )}
            </div>

            {isPro ? (
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 mb-6">
                <p className="text-sm text-slate-600 mb-4">
                  Manage your payment method, view invoices, or cancel your subscription securely via Stripe.
                </p>
                <button 
                  onClick={handleManageSubscription}
                  disabled={loading}
                  className="w-full py-3 bg-white border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 hover:text-slate-900 transition-all shadow-sm flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin"/> : <ExternalLink className="w-4 h-4" />}
                  Manage Billing
                </button>
              </div>
            ) : (
              <button 
                onClick={() => navigate('/pricing')}
                className="w-full py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
              >
                Upgrade to Pro
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default Profile;