import React from 'react';
import { Link } from 'react-router-dom';
import { PenTool, CheckCircle, Shield } from 'lucide-react';

const LandingPage = () => {
  return (
    <div className="min-h-screen bg-white">
      {/* Navbar */}
      <nav className="flex items-center justify-between px-8 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <PenTool className="w-6 h-6 text-blue-600" />
          <span className="text-xl font-bold text-slate-800">SignFast</span>
        </div>
        <div className="flex gap-4">
          <Link to="/login" className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-blue-600">Log in</Link>
          <Link to="/signup" className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-full hover:bg-blue-700 transition">Get Started</Link>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="max-w-6xl mx-auto px-6 py-20 text-center">
        <h1 className="text-5xl font-extrabold text-slate-900 leading-tight mb-6">
          Sign Documents <span className="text-blue-600">In Seconds</span>,<br /> Not Hours.
        </h1>
        <p className="text-lg text-slate-500 mb-10 max-w-2xl mx-auto">
          The simplest way to sign, track, and manage documents online. No bulky software, just a secure link.
        </p>
        
        <div className="flex justify-center gap-4 mb-20">
          <Link to="/signup" className="px-8 py-4 text-lg font-semibold text-white bg-blue-600 rounded-xl shadow-lg shadow-blue-200 hover:bg-blue-700 hover:shadow-xl transition-all">
            Start Signing Free
          </Link>
          <Link to="/login" className="px-8 py-4 text-lg font-semibold text-slate-700 bg-slate-50 rounded-xl hover:bg-slate-100 transition-all border border-slate-200">
            View Demo
          </Link>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-8 text-left">
          <FeatureCard 
            icon={<CheckCircle className="w-6 h-6 text-green-500" />}
            title="Legally Binding"
            desc="ESIGN and UETA compliant signatures that stand up in court."
          />
          <FeatureCard 
            icon={<PenTool className="w-6 h-6 text-blue-500" />}
            title="Instant Editor"
            desc="Drag and drop signatures, dates, and text fields onto any PDF."
          />
          <FeatureCard 
            icon={<Shield className="w-6 h-6 text-purple-500" />}
            title="Secure Audit Trail"
            desc="Track every step with timestamps and identity verification."
          />
        </div>
      </main>
    </div>
  );
};

const FeatureCard = ({ icon, title, desc }) => (
  <div className="p-6 rounded-2xl bg-slate-50 border border-slate-100 hover:border-blue-100 transition-colors">
    <div className="mb-4 bg-white w-12 h-12 rounded-lg flex items-center justify-center shadow-sm">
      {icon}
    </div>
    <h3 className="text-lg font-bold text-slate-800 mb-2">{title}</h3>
    <p className="text-slate-500">{desc}</p>
  </div>
);

export default LandingPage;