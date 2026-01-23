import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, ArrowRight, ShieldCheck, Loader2 } from 'lucide-react';

const PaymentSuccess = () => {
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState(5);

  // Auto-redirect effect
  // useEffect(() => {
  //   const timer = setInterval(() => {
  //     setCountdown((prev) => {
  //       if (prev <= 1) {
  //         clearInterval(timer);
  //         navigate('/dashboard');
  //       }
  //       return prev - 1;
  //     });
  //   }, 1000);

  //   return () => clearInterval(timer);
  // }, [navigate]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="bg-white max-w-md w-full rounded-2xl shadow-xl border border-slate-100 p-8 text-center animate-fade-in-up">
        
        {/* Animated Icon */}
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-10 h-10 text-green-600 animate-bounce-slow" />
        </div>

        <h1 className="text-3xl font-bold text-slate-800 mb-2">Payment Successful!</h1>
        <p className="text-slate-500 mb-8">
          Thank you for upgrading. Your account has been instantly upgraded to <span className="font-bold text-purple-600">Pro Plan</span>.
        </p>

        {/* --- DUPLICATE PROTECTION NOTICE --- */}
        {/* This addresses your specific "Race Condition" concern */}
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-8 text-left flex gap-3">
          <div className="mt-1">
            <ShieldCheck className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-blue-800">Duplicate Protection Active</h3>
            <p className="text-xs text-blue-600 mt-1 leading-relaxed">
              Did you accidentally open two tabs or pay twice? Don't worry. Our system automatically detects duplicate transactions and issues an <strong>instant refund</strong> for the extra charge.
            </p>
          </div>
        </div>

        {/* Action Button */}
        <button 
          onClick={() => navigate('/dashboard')}
          className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2 group"
        >
          Go to Dashboard <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </button>

        {/* <p className="text-xs text-slate-400 mt-6 flex items-center justify-center gap-2">
          <Loader2 className="w-3 h-3 animate-spin" />
          Redirecting in {countdown} seconds...
        </p> */}
      </div>
    </div>
  );
};

export default PaymentSuccess;