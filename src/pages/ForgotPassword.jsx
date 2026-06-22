import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { PenTool, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const ForgotPassword = () => {
  const { resetPassword } = useAuth();

  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    const email = e.target.email.value;

    try {
      await resetPassword(email);
      setMessage('Password reset email sent! Check your inbox (and spam folder).');
    } catch (err) {
      if (err.code === 'auth/user-not-found') {
        setError('No account found with that email address.');
      } else if (err.code === 'auth/invalid-email') {
        setError('Please enter a valid email address.');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Too many requests. Please try again later.');
      } else {
        setError('Failed to send reset email. Please try again.');
      }
      console.error(err);
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 border border-slate-100">
        <div className="flex justify-center mb-6">
          <div className="bg-blue-50 p-3 rounded-xl">
            <PenTool className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <h2 className="text-2xl font-bold text-center text-slate-800 mb-2">Reset your password</h2>
        <p className="text-center text-slate-500 mb-8">
          Enter the email address associated with your account and we'll send you a link to reset your password.
        </p>

        {/* Error Alert Box */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">
            {error}
          </div>
        )}

        {/* Success Alert Box */}
        {message && (
          <div className="mb-4 p-3 bg-green-50 text-green-600 text-sm rounded-lg border border-green-100">
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input
              type="email"
              name="email"
              required
              className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
              placeholder="you@example.com"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors shadow-md shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Sending...' : 'Send Reset Link'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          <Link to="/login" className="text-blue-600 font-semibold hover:underline inline-flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> Back to Sign In
          </Link>
        </p>
      </div>
    </div>
  );
};

export default ForgotPassword;
