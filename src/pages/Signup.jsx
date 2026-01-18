import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PenTool, Mail, CheckCircle, ArrowRight } from 'lucide-react'; // Added icons
import { useAuth } from '../context/AuthContext';

const Signup = () => {
  const navigate = useNavigate();
  const { signup, sendVerificationEmail, logout } = useAuth();
  
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  // New state to toggle between Form view and Success view
  const [isSuccess, setIsSuccess] = useState(false);
  const [sentEmail, setSentEmail] = useState(''); // To display in the success message

  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const firstName = e.target.firstName.value;
    const lastName = e.target.lastName.value;
    const email = e.target.email.value;
    const password = e.target.password.value;

    try {
      // 1. Create the account
      const user = await signup(email, password, firstName, lastName);

      // 2. Send Verification Email
      await sendVerificationEmail(user);
        
      // 3. Force Logout
      await logout();

      // 4. Update UI to Success State (instead of alert/redirect)
      setSentEmail(email);
      setIsSuccess(true);

    } catch (err) {
      console.error(err);
      if (err.code === 'auth/email-already-in-use') {
        setError('This email is already registered.');
      } else if (err.code === 'auth/weak-password') {
        setError('Password should be at least 6 characters.');
      } else {
        setError('Failed to create an account. ' + err.message);
      }
    }
    setLoading(false);
  };

  // --- SUCCESS VIEW (Rendered when isSuccess is true) ---
  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 border border-slate-100 text-center animate-fade-in-up">
          <div className="flex justify-center mb-6">
            <div className="bg-green-100 p-4 rounded-full relative">
              <Mail className="w-10 h-10 text-green-600" />
              <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-1">
                <CheckCircle className="w-6 h-6 text-green-600 fill-white" />
              </div>
            </div>
          </div>
          
          <h2 className="text-2xl font-bold text-slate-800 mb-3">Check your inbox</h2>
          <p className="text-slate-500 mb-6">
            We have sent a verification link to <br/>
            <span className="font-semibold text-slate-800">{sentEmail}</span>
          </p>
          
          <div className="bg-slate-50 p-4 rounded-lg mb-8 text-sm text-slate-600 border border-slate-100">
            Click the link in the email to verify your account, then sign in to access the dashboard.
          </div>

          <Link 
            to="/login" 
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-md transition-colors flex items-center justify-center gap-2"
          >
            Go to Login <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  // --- FORM VIEW (Default) ---
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 border border-slate-100">
        <div className="flex justify-center mb-6">
          <div className="bg-blue-50 p-3 rounded-xl">
            <PenTool className="w-8 h-8 text-blue-600" />
          </div>
        </div>
        
        <h2 className="text-2xl font-bold text-center text-slate-800 mb-2">Create an account</h2>
        
        {error && <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg">{error}</div>}

        <form onSubmit={handleSignup} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">First Name</label>
              <input type="text" name="firstName" placeholder="John" required className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Last Name</label>
              <input type="text" name="lastName" placeholder="Doe" required className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input type="email" name="email" placeholder="you@example.com" required className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
            <input type="password" name="password" placeholder="••••••••" required className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          
          <button disabled={loading} type="submit" className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-md transition-colors disabled:opacity-50">
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          Already have an account? <Link to="/login" className="text-blue-600 font-semibold hover:underline">Log in</Link>
        </p>
      </div>
    </div>
  );
};

export default Signup;