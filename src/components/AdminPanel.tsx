import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { DefaultUser } from '@/lib/seedData';
import { Modal, Field } from './LeadsPage';
import ActivityLogPage from './ActivityLogPage';
import LoginHistoryPage from './LoginHistoryPage';
import {
  Plus, Trash2, Edit2, Save, X, Layers, Users as UsersIcon, ShieldCheck,
  Settings, Activity, History,
} from 'lucide-react';


type Tab = 'manage' | 'activity' | 'login-history';


const AdminPanel: React.FC = () => {
  const { users, addUser, updateUser, deleteUser, user: currentUser } = useAuth();
  const { divisions, addDivision, updateDivision, deleteDivision, franchisees } = useData();

  const [tab, setTab] = useState<Tab>('manage');

  // Divisions UI
  const [newDivision, setNewDivision] = useState('');
  const [editingDiv, setEditingDiv] = useState<string | null>(null);
  const [divName, setDivName] = useState('');

  // Users UI
  const [showUserForm, setShowUserForm] = useState(false);
  const [editingUser, setEditingUser] = useState<DefaultUser | null>(null);
  const blankUser = { name: '', email: '', password: '', role: 'sales' as DefaultUser['role'], franchiseeId: '' };
  const [userForm, setUserForm] = useState<typeof blankUser>(blankUser);

  const saveDivision = async () => {
    if (!newDivision.trim()) return;
    await addDivision(newDivision.trim());
    setNewDivision('');
  };

  const submitUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingUser) {
      // password is intentionally only forwarded when the admin actually
      // typed something into the field — an empty string means "keep the
      // current password" (AuthContext.updateUser strips it on falsy).
      const result = await updateUser(editingUser.id, {
        name: userForm.name,
        email: userForm.email,
        password: userForm.password || undefined,
        role: userForm.role,
        franchiseeId: userForm.role === 'franchisee' ? (userForm.franchiseeId || undefined) : undefined,
      });
      if (!result.ok) {
        alert(`Could not save user.\n\n${result.error || 'Unknown error.'}`);
        return;
      }
    } else {
      if (!userForm.password) { alert('Password is required for new users.'); return; }
      const result = await addUser({
        name: userForm.name,
        email: userForm.email,
        password: userForm.password,
        role: userForm.role,
        franchiseeId: userForm.role === 'franchisee' ? (userForm.franchiseeId || undefined) : undefined,
      });
      if (!result.user) {
        alert(`Could not create user.\n\n${result.error || 'Unknown error.'}\n\nIf you are not signed in as an admin, please sign out and sign back in as an admin account (e.g. admin@surgeongroup.co.za).`);
        return;
      }
    }
    setUserForm(blankUser);
    setEditingUser(null);
    setShowUserForm(false);
  };



  const openEditUser = (u: DefaultUser) => {
    setEditingUser(u);
    setUserForm({
      name: u.name, email: u.email, password: '',
      role: u.role, franchiseeId: u.franchiseeId || '',
    });
    setShowUserForm(true);
  };


  const roleBadge = (role: string) => {
    const colors: Record<string, string> = {
      admin: 'bg-purple-100 text-purple-700',
      sales: 'bg-blue-100 text-blue-700',
      franchisee: 'bg-amber-100 text-amber-700',
    };
    return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${colors[role]}`}>{role}</span>;
  };

  const tabBtn = (id: Tab, label: string, Icon: typeof Settings) => (
    <button
      onClick={() => setTab(id)}
      className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition ${
        tab === id
          ? 'border-[#C41E3A] text-[#C41E3A]'
          : 'border-transparent text-gray-500 hover:text-gray-800'
      }`}
    >
      <Icon className="h-4 w-4" /> {label}
    </button>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
          <ShieldCheck className="h-7 w-7 text-[#C41E3A]" /> Administration
        </h1>
        <p className="text-gray-500 mt-1">Manage divisions, user accounts and review activity history.</p>
      </div>

      <div className="border-b border-gray-200 flex gap-2 flex-wrap">
        {tabBtn('manage', 'Manage', Settings)}
        {tabBtn('activity', 'Activity', Activity)}
        {tabBtn('login-history', 'Login History', History)}
      </div>

      {tab === 'activity' && <ActivityLogPage />}
      {tab === 'login-history' && <LoginHistoryPage />}


      {tab === 'manage' && (
        <div className="space-y-8">
          {/* Divisions */}
          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2"><Layers className="h-5 w-5 text-[#C41E3A]" /> Divisions</h2>
                <p className="text-sm text-gray-500">These appear in the Leads form, lead filters and franchisee records.</p>
              </div>
            </div>

            <div className="flex gap-2 mb-4">
              <input
                value={newDivision}
                onChange={e => setNewDivision(e.target.value)}
                placeholder="New division name (e.g. Roof Surgeon)"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg outline-none focus:border-[#C41E3A]"
                onKeyDown={e => e.key === 'Enter' && saveDivision()}
              />
              <button onClick={saveDivision} className="bg-[#C41E3A] hover:bg-[#a01830] text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-1">
                <Plus className="h-4 w-4" /> Add
              </button>
            </div>

            <div className="space-y-2">
              {divisions.length === 0 && <p className="text-sm text-gray-500">No divisions yet.</p>}
              {divisions.map(d => (
                <div key={d.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                  {editingDiv === d.id ? (
                    <>
                      <input value={divName} onChange={e => setDivName(e.target.value)} className="flex-1 px-3 py-1.5 border border-gray-300 rounded outline-none focus:border-[#C41E3A]" autoFocus />
                      <button onClick={() => { if (divName.trim()) { updateDivision(d.id, divName.trim()); } setEditingDiv(null); }} className="text-green-600"><Save className="h-4 w-4" /></button>
                      <button onClick={() => setEditingDiv(null)} className="text-gray-400"><X className="h-4 w-4" /></button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 font-semibold text-gray-800">{d.name}</span>
                      <span className="text-xs text-gray-500">{franchisees.filter(f => f.division === d.name).length} franchisees</span>
                      <button onClick={() => { setEditingDiv(d.id); setDivName(d.name); }} className="text-gray-400 hover:text-[#C41E3A]"><Edit2 className="h-4 w-4" /></button>
                      <button onClick={() => { if (confirm(`Delete division "${d.name}"? Existing leads/franchisees keep the name but cannot be reassigned to it.`)) deleteDivision(d.id); }} className="text-gray-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                    </>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Users */}
          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div>
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2"><UsersIcon className="h-5 w-5 text-[#C41E3A]" /> Users</h2>
                <p className="text-sm text-gray-500">Add admins, sales reps and franchisee logins. Franchisee users are also created automatically when a lead is converted.</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setEditingUser(null); setUserForm(blankUser); setShowUserForm(true); }} className="bg-[#C41E3A] hover:bg-[#a01830] text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-2">
                  <Plus className="h-4 w-4" /> New User
                </button>
              </div>

            </div>


            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Name</th>
                    <th className="px-4 py-2 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Email</th>
                    <th className="px-4 py-2 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Role</th>
                    <th className="px-4 py-2 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Linked Franchisee</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {users.map(u => {
                    const linked = u.franchiseeId ? franchisees.find(f => f.id === u.franchiseeId) : null;
                    return (
                      <tr key={u.id}>
                        <td className="px-4 py-3 font-semibold text-gray-900">{u.name}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{u.email}</td>
                        <td className="px-4 py-3">{roleBadge(u.role)}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{linked ? linked.name : '—'}</td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => openEditUser(u)} className="text-gray-400 hover:text-[#C41E3A] mr-3"><Edit2 className="h-4 w-4 inline" /></button>
                          <button
                            disabled={u.id === currentUser?.id}
                            onClick={async () => {
                              if (!confirm(`Delete user ${u.name}?`)) return;
                              const result = await deleteUser(u.id);
                              if (!result.ok) alert(`Could not delete user.\n\n${result.error || 'Unknown error.'}`);
                            }}
                            className={`text-gray-400 hover:text-red-600 ${u.id === currentUser?.id ? 'opacity-30 cursor-not-allowed' : ''}`}
                          >
                            <Trash2 className="h-4 w-4 inline" />
                          </button>
                        </td>
                      </tr>

                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {showUserForm && (
        <Modal title={editingUser ? `Edit User: ${editingUser.name}` : 'Add New User'} onClose={() => { setShowUserForm(false); setEditingUser(null); }}>
          <form onSubmit={submitUser} className="space-y-4">
            <Field label="Full Name"><input required value={userForm.name} onChange={e => setUserForm({ ...userForm, name: e.target.value })} className="input" /></Field>
            <Field label="Email"><input type="email" required value={userForm.email} onChange={e => setUserForm({ ...userForm, email: e.target.value })} className="input" /></Field>
            <Field label={editingUser ? 'Password (leave blank to keep current)' : 'Password'}>
              <input value={userForm.password} onChange={e => setUserForm({ ...userForm, password: e.target.value })} className="input" placeholder={editingUser ? '••••••' : ''} />
            </Field>
            <Field label="Role">
              <select value={userForm.role} onChange={e => setUserForm({ ...userForm, role: e.target.value as DefaultUser['role'] })} className="input">
                <option value="admin">Admin</option>
                <option value="sales">Sales</option>
                <option value="franchisee">Franchisee</option>
              </select>
            </Field>
            {userForm.role === 'franchisee' && (
              <Field label="Link to Franchisee Record">
                <select value={userForm.franchiseeId} onChange={e => setUserForm({ ...userForm, franchiseeId: e.target.value })} className="input">
                  <option value="">— None —</option>
                  {franchisees.map(f => <option key={f.id} value={f.id}>{f.name} ({f.territory})</option>)}
                </select>
              </Field>
            )}
            <button type="submit" className="w-full bg-[#C41E3A] hover:bg-[#a01830] text-white font-bold py-3 rounded-lg">
              {editingUser ? 'Save Changes' : 'Create User'}
            </button>
          </form>
          <style>{`.input { width: 100%; padding: 10px 14px; border: 1px solid #d1d5db; border-radius: 8px; outline: none; font-size: 14px; } .input:focus { border-color: #C41E3A; box-shadow: 0 0 0 3px rgba(196,30,58,0.1); }`}</style>
        </Modal>
      )}
    </div>
  );
};

export default AdminPanel;
