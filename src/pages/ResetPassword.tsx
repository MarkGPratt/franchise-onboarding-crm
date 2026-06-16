import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { LOGO_URL } from '@/lib/seedData';
import { Lock, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

/**
 * /reset-password
 * Supabase appends the recovery token as a hash fragment (#access_token=…&type=recovery).
 * The supabase-js client automatically detects it on page load and establishes a temporary
 * session via the PASSWORD_RECOVERY event. We listen for that event (or check for an
 * existing session) and then let the user set a new password via supabase.auth.updateUser.
 */
const ResetPassword: React.FC = () => {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let mounted = true;

    // Listen for the recovery event Supabase emits after parsing the hash
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
        setReady(true);
        setChecking(false);
      }
    });

    // Also check immediately in case the session is already present
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      if (data.session) setReady(true);
      // Give the hash-detection a brief moment to fire
      setTimeout(() => { if (mounted) setChecking(false); }, 800);
    })();

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setBusy(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (err) { setError(err.message); return; }
    setSuccess(true);
    // Brief pause then push them to the dashboard
    setTimeout(() => navigate('/'), 1400);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a1a1a] via-[#2a0a0a] to-[#C41E3A] flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8">
        <div className="flex justify-center mb-6">
          <div className="bg-gray-50 p-3 rounded-xl">
            <img src={LOGO_URL} alt="Logo" className="h-12 w-auto" />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 text-center">Set a new password</h1>
        <p className="text-sm text-gray-500 text-center mt-1">Choose a strong password to secure your account.</p>

        {checking && (
          <div className="mt-8 flex flex-col items-center gap-3 text-gray-500">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="text-sm">Verifying recovery link…</span>
          </div>
        )}

        {!checking && !ready && (
          <div className="mt-8 bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg flex gap-3">
            <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <div className="font-semibold">This reset link is invalid or has expired.</div>
              <div className="mt-1">Please return to the sign-in page and request a new one.</div>
              <button onClick={() => navigate('/')} className="mt-3 text-[#C41E3A] font-semibold underline">Back to sign in</button>
            </div>
          </div>
        )}

        {!checking && ready && !success && (
          <form onSubmit={submit} className="mt-8 space-y-5">
            <div>
              <label className="text-sm font-semibold text-gray-700">New password</label>
              <div className="mt-1 relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#C41E3A] focus:border-transparent outline-none"
                  placeholder="At least 6 characters" />
              </div>
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-700">Confirm password</label>
              <div className="mt-1 relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input type="password" required value={confirm} onChange={e => setConfirm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#C41E3A] focus:border-transparent outline-none"
                  placeholder="Repeat your password" />
              </div>
            </div>
            {error && <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm border border-red-200">{error}</div>}
            <button type="submit" disabled={busy}
              className="w-full bg-[#C41E3A] hover:bg-[#a01830] disabled:opacity-60 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {busy ? 'Saving…' : 'Update password'}
            </button>
          </form>
        )}

        {success && (
          <div className="mt-8 bg-green-50 border border-green-200 text-green-800 p-4 rounded-lg flex gap-3">
            <CheckCircle2 className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <div className="font-semibold">Password updated.</div>
              <div className="mt-1">Redirecting you to the dashboard…</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;
