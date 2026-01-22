import React, { useState } from 'react';
import { Check, Loader2, Shield, Zap, Star, ArrowLeft } from 'lucide-react'; // Added ArrowLeft
import { httpsCallable } from 'firebase/functions';
import { functions, auth } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom'; // Added useNavigate

const Pricing = () => {
  const { user } = useAuth();
  const navigate = useNavigate(); // Initialize hook
  const [loading, setLoading] = useState(false);

  const handleSubscribe = async () => {
    setLoading(true);
    try {
      const currentUser = auth.currentUser;
      
      if (!currentUser) {
        alert("You must be logged in to upgrade.");
        setLoading(false);
        return;
      }

      const createCheckoutSession = httpsCallable(functions, 'createCheckoutSession');

      const { data } = await createCheckoutSession({ 
        priceId: import.meta.env.VITE_STRIPE_PRICE_ID_PRO_MONTHLY,
        userId: currentUser.uid,
        userEmail: currentUser.email
      });

      if (data.url) {
        window.location.href = data.url;
      }
      
    } catch (error) {
      console.error("Checkout failed:", error);
      alert("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center py-12 px-4">
      
      {/* --- BACK NAVIGATOR --- */}
      <div className="w-full max-w-2xl mb-8">
        <button 
          onClick={() => navigate('/dashboard')} 
          className="group flex items-center gap-2 text-slate-500 hover:text-blue-600 transition-colors font-medium"
        >
          <div className="p-2 bg-white border border-slate-200 rounded-full group-hover:border-blue-200 group-hover:bg-blue-50 transition-all">
            <ArrowLeft className="w-4 h-4" />
          </div>
          Back to Dashboard
        </button>
      </div>

      <div className="text-center max-w-2xl mb-12">
        <h1 className="text-4xl font-bold text-slate-900 mb-4">Simple, Transparent Pricing</h1>
        <p className="text-slate-500 text-lg">
          Unlock the full power of SignFast. No hidden fees, cancel anytime.
        </p>
      </div>

      {/* Pricing Card */}
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden max-w-md w-full transform hover:scale-105 transition-transform duration-300 relative">
        <div className="absolute top-0 right-0 bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-bl-lg">
          MOST POPULAR
        </div>

        <div className="p-8">
          <h3 className="text-2xl font-bold text-slate-800 mb-2">Pro Plan</h3>
          <div className="flex items-baseline mb-6">
            <span className="text-5xl font-extrabold text-slate-900">$10</span>
            <span className="text-slate-500 ml-2">/month</span>
          </div>
          
          <p className="text-slate-500 mb-8">Perfect for professionals and small teams who need to sign documents fast.</p>

          <button 
            onClick={handleSubscribe}
            disabled={loading}
            className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold text-lg hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin"/> : <Zap className="w-5 h-5 fill-current" />}
            Upgrade Now
          </button>
        </div>

        <div className="bg-slate-50 p-8 border-t border-slate-100">
          <ul className="space-y-4">
            <Feature text="Unlimited Documents" />
            {/* <Feature text="Unlimited Signatures" /> */}
            <Feature text="Priority Email Support" />
            <Feature text="Secure Cloud Storage" />
            <Feature text="Remote Signing" />
          </ul>
        </div>
      </div>

      <div className="mt-12 flex gap-8 text-slate-400 text-sm">
        <div className="flex items-center gap-2"><Shield className="w-4 h-4"/> Secure Payment</div>
        <div className="flex items-center gap-2"><Star className="w-4 h-4"/> Cancel Anytime</div>
      </div>
    </div>
  );
};

const Feature = ({ text }) => (
  <li className="flex items-center gap-3 text-slate-700">
    <div className="bg-green-100 p-1 rounded-full">
      <Check className="w-4 h-4 text-green-600" />
    </div>
    {text}
  </li>
);

export default Pricing;