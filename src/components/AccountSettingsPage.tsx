import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { toast } from '@/components/ui/use-toast';
import { User, Mail, Lock, Loader2, Save, KeyRound } from 'lucide-react';

const AccountSettingsPage: React.FC = () => {
  const { user, refreshUsers } = useAuth();

  // Profile (name + email)
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileError, setProfileError] = useState('');

  // Password
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const [pwError, setPwError] = useState('');

  if (!user) return null;

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError('');
    if (!name.trim()) { setProfileError('Name is required.'); return; }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) { setProfileError('Please enter a valid email address.'); return; }

    setProfileBusy(true);
    try {
      // Update profiles row for the name (and email mirror)
      const { error: profileErr } = await supabase
        .from('profiles')
        .update({ name: name.trim(), email: email.trim() })
        .eq('id', user.id);
      if (profileErr) throw new Error(profileErr.message);

      // Update auth email if it changed
      if (email.trim() !== user.email) {
        const { error: authErr } = await supabase.auth.updateUser({ email: email.trim() });
        if (authErr) throw new Error(authErr.message);
        toast({ title: 'Confirm your new email', description: 'We sent a confirmation link to your new address. Your email will update once you click it.' });
      } else {
        toast({ title: 'Changes saved', description: 'Your profile has been updated.' });
      }
      await refreshUsers();
    } catch (err: any) {
      setProfileError(err.message || 'Failed to save profile.');
    } finally {
      setProfileBusy(false);
    }
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError('');
    if (!currentPassword) { setPwError('Please enter your current password.'); return; }
    if (newPassword.length < 6) { setPwError('New password must be at least 6 characters.'); return; }
    if (newPassword !== confirmPassword) { setPwError('New passwords do not match.'); return; }
    if (newPassword === currentPassword) { setPwError('New password must be different from your current password.'); return; }

    setPwBusy(true);
    try {
      // Verify current password by attempting to sign in with it
      const { error: verifyErr } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });
      if (verifyErr) {
        setPwError('Current password is incorrect.');
        setPwBusy(false);
        return;
      }

      // Now update to the new password
      const { error: updateErr } = await supabase.auth.updateUser({ password: newPassword });
      if (updateErr) throw new Error(updateErr.message);

      toast({ title: 'Password updated', description: 'Your password was changed successfully.' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPwError(err.message || 'Failed to change password.');
    } finally {
      setPwBusy(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
          <User className="h-7 w-7 text-[#C41E3A]" /> Account Settings
        </h1>
        <p className="text-gray-500 mt-1">Update your personal details and password.</p>
      </div>

      {/* Profile section */}
      <form onSubmit={saveProfile} className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Profile</h2>
          <p className="text-sm text-gray-500">Your name and email address.</p>
        </div>

        <div>
          <label className="text-sm font-semibold text-gray-700">Full name</label>
          <div className="mt-1 relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input value={name} onChange={e => setName(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#C41E3A] focus:border-transparent outline-none" />
          </div>
        </div>

        <div>
          <label className="text-sm font-semibold text-gray-700">Email address</label>
          <div className="mt-1 relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#C41E3A] focus:border-transparent outline-none" />
          </div>
          <p className="text-xs text-gray-500 mt-1">Changing your email requires confirmation via a link sent to the new address.</p>
        </div>

        {profileError && <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm border border-red-200">{profileError}</div>}

        <div className="flex justify-end">
          <button type="submit" disabled={profileBusy}
            className="bg-[#C41E3A] hover:bg-[#a01830] disabled:opacity-60 text-white font-bold px-5 py-2.5 rounded-lg flex items-center gap-2">
            {profileBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {profileBusy ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>

      {/* Password section */}
      <form onSubmit={changePassword} className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-[#C41E3A]" /> Change password
          </h2>
          <p className="text-sm text-gray-500">You must enter your current password to set a new one.</p>
        </div>

        <div>
          <label className="text-sm font-semibold text-gray-700">Current password</label>
          <div className="mt-1 relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} autoComplete="current-password"
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#C41E3A] focus:border-transparent outline-none" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-semibold text-gray-700">New password</label>
            <div className="mt-1 relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} autoComplete="new-password"
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#C41E3A] focus:border-transparent outline-none" />
            </div>
          </div>
          <div>
            <label className="text-sm font-semibold text-gray-700">Confirm new password</label>
            <div className="mt-1 relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} autoComplete="new-password"
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#C41E3A] focus:border-transparent outline-none" />
            </div>
          </div>
        </div>

        {pwError && <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm border border-red-200">{pwError}</div>}

        <div className="flex justify-end">
          <button type="submit" disabled={pwBusy}
            className="bg-[#C41E3A] hover:bg-[#a01830] disabled:opacity-60 text-white font-bold px-5 py-2.5 rounded-lg flex items-center gap-2">
            {pwBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            {pwBusy ? 'Updating…' : 'Update password'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AccountSettingsPage;
