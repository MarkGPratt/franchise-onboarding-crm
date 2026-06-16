import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { LOGO_URL } from '@/lib/seedData';
import { Lock, Mail, ShieldCheck, Users, Briefcase, Loader2, X, CheckCircle2 } from 'lucide-react';

const Login: React.FC = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Forgot-password modal state
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotBusy, setForgotBusy] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [forgotSent, setForgotSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await login(email, password);
      if (!res.ok) setError(res.error || 'Login failed');
    } catch (err: any) {
      console.error('login threw:', err);
      setError(err?.message || 'Unexpected error while signing in. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const sendReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');
    if (!forgotEmail.trim()) { setForgotError('Please enter your email address.'); return; }
    setForgotBusy(true);
    const redirectTo = `${window.location.origin}/reset-password`;
    const { error: err } = await supabase.auth.resetPasswordForEmail(forgotEmail.trim(), { redirectTo });
    setForgotBusy(false);
    if (err) { setForgotError(err.message); return; }
    setForgotSent(true);
  };

  const closeForgot = () => {
    setShowForgot(false);
    setForgotEmail('');
    setForgotError('');
    setForgotSent(false);
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-white">
      <div className="lg:w-1/2 bg-gradient-to-br from-[#1a1a1a] via-[#2a0a0a] to-[#C41E3A] text-white p-10 lg:p-16 flex flex-col justify-between relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 20% 30%, white 1px, transparent 1px), radial-gradient(circle at 80% 70%, white 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        <div className="relative z-10">
          <div className="bg-white inline-block p-4 rounded-xl shadow-2xl">
            <img src={LOGO_URL} alt="The Surgeon Group" className="h-16 w-auto" />
          </div>
          <h1 className="mt-10 text-4xl lg:text-5xl font-extrabold tracking-tight">
            Franchisee<br />Onboarding CRM
          </h1>
          <p className="mt-4 text-lg text-white/80 max-w-md">
            From first enquiry to operational launch — manage every step of the franchise journey in one professional platform.
          </p>
          <p className="mt-3 text-lg text-white/80 max-w-md">
            As well as a communication hub during your journey with the Surgeon Group.
          </p>
        </div>
        <div className="relative z-10 grid grid-cols-3 gap-4 mt-10">
          <div className="bg-white/10 backdrop-blur rounded-lg p-4 border border-white/20">
            <Users className="h-6 w-6 mb-2" />
            <div className="text-sm font-semibold">Lead Pipeline</div>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-lg p-4 border border-white/20">
            <Briefcase className="h-6 w-6 mb-2" />
            <div className="text-sm font-semibold">Onboarding Flow</div>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-lg p-4 border border-white/20">
            <ShieldCheck className="h-6 w-6 mb-2" />
            <div className="text-sm font-semibold">Document Vault</div>
          </div>
        </div>
      </div>

      <div className="lg:w-1/2 flex items-center justify-center p-6 lg:p-16">
        <div className="w-full max-w-md">
          <h2 className="text-3xl font-bold text-gray-900">Welcome back</h2>
          <p className="text-gray-500 mt-2">Sign in to your account to continue</p>

          <form onSubmit={submit} className="mt-8 space-y-5">
            <div>
              <label className="text-sm font-semibold text-gray-700">Email address</label>
              <div className="mt-1 relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#C41E3A] focus:border-transparent outline-none"
                  placeholder="you@surgeongroup.co.za" />
              </div>
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-700">Password</label>
              <div className="mt-1 relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#C41E3A] focus:border-transparent outline-none"
                  placeholder="••••••••" />
              </div>
            </div>
            {error && <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm border border-red-200">{error}</div>}
            <button type="submit" disabled={busy} className="w-full bg-[#C41E3A] hover:bg-[#a01830] disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold py-3 rounded-lg transition shadow-lg shadow-red-200 flex items-center justify-center gap-2">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {busy ? 'Signing in…' : 'Sign In'}
            </button>
            <div className="text-center">
              <button type="button" onClick={() => { setForgotEmail(email); setShowForgot(true); }}
                className="text-sm font-semibold text-[#C41E3A] hover:underline">
                Forgot password?
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Forgot password modal */}
      {showForgot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900">Reset your password</h3>
              <button onClick={closeForgot} className="text-gray-400 hover:text-gray-700"><X className="h-5 w-5" /></button>
            </div>
            {!forgotSent ? (
              <form onSubmit={sendReset} className="p-5 space-y-4">
                <p className="text-sm text-gray-600">Enter the email address linked to your account and we'll send you a secure link to set a new password.</p>
                <div>
                  <label className="text-sm font-semibold text-gray-700">Email address</label>
                  <div className="mt-1 relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input type="email" required value={forgotEmail} onChange={e => setForgotEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#C41E3A] focus:border-transparent outline-none"
                      placeholder="you@surgeongroup.co.za" autoFocus />
                  </div>
                </div>
                {forgotError && <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm border border-red-200">{forgotError}</div>}
                <div className="flex gap-2">
                  <button type="button" onClick={closeForgot} className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50">Cancel</button>
                  <button type="submit" disabled={forgotBusy} className="flex-1 bg-[#C41E3A] hover:bg-[#a01830] disabled:opacity-60 text-white font-bold py-2.5 rounded-lg flex items-center justify-center gap-2">
                    {forgotBusy && <Loader2 className="h-4 w-4 animate-spin" />}
                    {forgotBusy ? 'Sending…' : 'Send reset link'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="p-5 space-y-4">
                <div className="bg-green-50 border border-green-200 text-green-800 p-4 rounded-lg flex gap-3">
                  <CheckCircle2 className="h-5 w-5 flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <div className="font-semibold">Reset link sent.</div>
                    <div className="mt-1">If an account exists for <span className="font-mono">{forgotEmail}</span>, you'll receive an email with instructions to reset your password.</div>
                  </div>
                </div>
                <button onClick={closeForgot} className="w-full bg-[#C41E3A] hover:bg-[#a01830] text-white font-bold py-2.5 rounded-lg">Done</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;
