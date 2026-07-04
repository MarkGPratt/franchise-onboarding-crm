import React, { useState } from 'react';
import { useData, Lead, Area } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { notify } from '@/lib/notify';
import { Plus, X, MessageSquare, ArrowRight, Trash2, Mail, Phone, MapPin, User, Layers } from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-100 text-blue-700',
  qualified: 'bg-green-100 text-green-700',
  negotiating: 'bg-amber-100 text-amber-700',
  converted: 'bg-purple-100 text-purple-700',
  lost: 'bg-gray-100 text-gray-700',
};

const LeadsPage: React.FC = () => {
  const { leads, addLead, updateLead, deleteLead, addInteraction, convertLeadToFranchisee, divisions, areas } = useData();
  const { user, users, addUser } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<Lead | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all');
  const [divisionFilter, setDivisionFilter] = useState<string>('all');

  const salesUsers = users.filter(u => u.role === 'sales' || u.role === 'admin');
  const defaultAssignee = user?.role === 'sales' ? user.id : (salesUsers[0]?.id || '');

  const [form, setForm] = useState({
    contactName: '',
    email: '',
    phone: '',
    area: '',
    division: divisions[0]?.name || '',
    status: 'new' as Lead['status'],
    assignedTo: defaultAssignee,
  });
  const [interaction, setInteraction] = useState('');

  const userName = (id: string) => users.find(u => u.id === id)?.name || 'Unassigned';

  const filtered = leads.filter(l => {
    if (filter !== 'all' && l.status !== filter) return false;
    if (assigneeFilter !== 'all' && l.assignedTo !== assigneeFilter) return false;
    if (divisionFilter !== 'all' && (l.division || '') !== divisionFilter) return false;
    return true;
  });

  const notifyLeadAssigned = (lead: { contactName: string; email: string; phone: string; area: string; status: string; division?: string }, assignedToUserId: string) => {
    if (!assignedToUserId) return;
    const rep = users.find(u => u.id === assignedToUserId);
    if (!rep) return;
    notify({
      event_type: 'lead_assigned',
      recipient_email: rep.email,
      recipient_user_id: rep.id,
      recipient_name: rep.name,
      variables: {
        lead_name: lead.contactName,
        lead_email: lead.email,
        lead_phone: lead.phone,
        lead_area: lead.area,
        lead_division: lead.division || '—',
        lead_status: lead.status,
      },
    });
  };

  const submitNew = (e: React.FormEvent) => {
    e.preventDefault();
    const assignedTo = form.assignedTo || user?.id || '';
    addLead({
      contactName: form.contactName,
      email: form.email,
      phone: form.phone,
      area: form.area,
      division: form.division,
      status: form.status,
      assignedTo,
    });
    notifyLeadAssigned(form, assignedTo);
    setForm({ contactName: '', email: '', phone: '', area: '', division: divisions[0]?.name || '', status: 'new', assignedTo: defaultAssignee });
    setShowForm(false);
  };

  const addNote = () => {
    if (!selected || !interaction.trim()) return;
    addInteraction(selected.id, interaction, user?.name || 'Unknown');
    setInteraction('');
    const updated = leads.find(l => l.id === selected.id);
    if (updated) setSelected({ ...updated, interactions: [...updated.interactions, { id: 'tmp', date: new Date().toISOString(), note: interaction, author: user?.name || 'Unknown' }] });
  };

  const convert = (l: Lead) => {
    const tempPassword = `welcome${Math.floor(1000 + Math.random() * 9000)}`;
    if (!confirm(`Convert ${l.contactName} to a franchisee?\n\nThis will:\n• Move them to the Franchisees section\n• Create a login (email: ${l.email}, password: ${tempPassword})\n• Start their onboarding flow`)) return;
    const existingUser = users.find(u => u.email.toLowerCase() === l.email.toLowerCase());
    const newF = convertLeadToFranchisee(l.id);
    if (newF && !existingUser) {
      addUser({
        email: l.email,
        password: tempPassword,
        name: l.contactName,
        role: 'franchisee',
        franchiseeId: newF.id,
      });
      alert(`Franchisee created.\nLogin email: ${l.email}\nTemporary password: ${tempPassword}\n\nPlease share these credentials with the new franchisee.`);
    } else if (newF && existingUser) {
      // Link existing user to franchisee
      // (Done via useAuth.updateUser in a separate effect-safe call would be cleaner,
      // but addUser already handles new ones — for existing we just alert.)
      alert(`Franchisee created. An account already exists for ${l.email}; that account has been kept.`);
    }
    setSelected(null);
  };

  const currentSelected = selected ? leads.find(l => l.id === selected.id) || null : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Leads Pipeline</h1>
          <p className="text-gray-500 mt-1">Track franchise enquiries from first contact to conversion.</p>
        </div>
        <button onClick={() => setShowForm(true)} className="bg-[#C41E3A] hover:bg-[#a01830] text-white px-5 py-2.5 rounded-lg font-semibold flex items-center gap-2">
          <Plus className="h-4 w-4" /> New Lead
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {['all', 'new', 'qualified', 'negotiating', 'converted', 'lost'].map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold capitalize transition ${filter === s ? 'bg-[#1a1a1a] text-white' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'}`}
          >
            {s} {s !== 'all' && `(${leads.filter(l => l.status === s).length})`}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          <label className="text-sm font-semibold text-gray-700">Division:</label>
          <select
            value={divisionFilter}
            onChange={e => setDivisionFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#C41E3A] bg-white"
          >
            <option value="all">All divisions</option>
            {divisions.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
            <option value="">— None set —</option>
          </select>
          <label className="text-sm font-semibold text-gray-700">Sales rep:</label>
          <select
            value={assigneeFilter}
            onChange={e => setAssigneeFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#C41E3A] bg-white"
          >
            <option value="all">All reps</option>
            {salesUsers.map(u => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
            <option value="">Unassigned</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Contact</th>
              <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Division</th>
              <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Area</th>
              <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Assigned To</th>
              <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Notes</th>
              <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Latest Comment</th>
              <th className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Created</th>
              <th className="px-6 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 && (
              <tr><td colSpan={9} className="text-center py-12 text-gray-500">No leads found.</td></tr>
            )}
            {filtered.map(l => (
              <tr key={l.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelected(l)}>
                <td className="px-6 py-4">
                  <div className="font-semibold text-gray-900">{l.contactName}</div>
                  <div className="text-xs text-gray-500">{l.email}</div>
                </td>
                <td className="px-6 py-4">
                  {l.division ? (
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700">{l.division}</span>
                  ) : <span className="text-xs text-gray-400">—</span>}
                </td>
                <td className="px-6 py-4 text-sm text-gray-700">{l.area}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-full bg-gradient-to-br from-[#C41E3A] to-[#1a1a1a] text-white flex items-center justify-center text-[10px] font-bold">
                      {(userName(l.assignedTo).match(/\b\w/g) || []).slice(0,2).join('').toUpperCase() || '—'}
                    </div>
                    <span className="text-sm text-gray-800">{userName(l.assignedTo)}</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${STATUS_COLORS[l.status]}`}>{l.status}</span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-700">{l.interactions.length}</td>
                <td className="px-6 py-4 text-sm text-gray-600 max-w-xs">
                  {(() => {
                    const latest = l.interactions.length > 0
                      ? l.interactions.reduce((a, b) => new Date(a.date) > new Date(b.date) ? a : b)
                      : null;
                    return latest
                      ? <span title={latest.note} className="block truncate max-w-[220px]">{latest.note}</span>
                      : <span className="text-gray-400">—</span>;
                  })()}
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  <div>{new Date(l.createdAt).toLocaleDateString()}</div>
                  <div className="text-xs text-gray-400">{new Date(l.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                </td>
                <td className="px-6 py-4 text-right">
                  <button onClick={e => { e.stopPropagation(); if (confirm('Delete this lead?')) deleteLead(l.id); }} className="text-gray-400 hover:text-red-600">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* New Lead Modal */}
      {showForm && (
        <Modal title="Add New Lead" onClose={() => setShowForm(false)}>
          <form onSubmit={submitNew} className="space-y-4">
            <Field label="Contact Person"><input required value={form.contactName} onChange={e => setForm({ ...form, contactName: e.target.value })} className="input" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Email"><input type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="input" /></Field>
              <Field label="Phone"><input required value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="input" /></Field>
            </div>
            <Field label="Area / Territory Interested In">
              <input required list="areas-list" value={form.area} onChange={e => setForm({ ...form, area: e.target.value })} className="input" placeholder="Select or type an area..." />
              <datalist id="areas-list">
                {areas.map(a => <option key={a.id} value={a.name} />)}
              </datalist>
            </Field>
            <Field label="Division">
              <select required value={form.division} onChange={e => setForm({ ...form, division: e.target.value })} className="input">
                <option value="">— Select division —</option>
                {divisions.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Status">
                <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value as Lead['status'] })} className="input">
                  <option value="new">New</option>
                  <option value="qualified">Qualified</option>
                  <option value="negotiating">Negotiating</option>
                  <option value="lost">Lost</option>
                </select>
              </Field>
              <Field label="Assign to Sales Rep">
                <select value={form.assignedTo} onChange={e => setForm({ ...form, assignedTo: e.target.value })} className="input">
                  <option value="">— Unassigned —</option>
                  {salesUsers.map(u => (
                    <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                  ))}
                </select>
              </Field>
            </div>
            <button type="submit" className="w-full bg-[#C41E3A] hover:bg-[#a01830] text-white font-bold py-3 rounded-lg">Create Lead</button>
          </form>
        </Modal>
      )}

      {/* Detail Modal */}
      {currentSelected && (
        <Modal title={currentSelected.contactName} onClose={() => setSelected(null)} wide>
          <div className="space-y-5">
            <div className="grid sm:grid-cols-3 gap-3">
              <InfoBlock icon={<Mail className="h-4 w-4" />} label="Email" value={currentSelected.email} />
              <InfoBlock icon={<Phone className="h-4 w-4" />} label="Phone" value={currentSelected.phone} />
              <InfoBlock icon={<MapPin className="h-4 w-4" />} label="Area" value={currentSelected.area} />
            </div>

            <div className="grid sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1 flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5" /> Division
                </label>
                <select
                  value={currentSelected.division || ''}
                  onChange={e => updateLead(currentSelected.id, { division: e.target.value })}
                  className="input"
                >
                  <option value="">— Select division —</option>
                  {divisions.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Status</label>
                <select
                  value={currentSelected.status}
                  onChange={e => updateLead(currentSelected.id, { status: e.target.value as Lead['status'] })}
                  className="input"
                >
                  <option value="new">New</option>
                  <option value="qualified">Qualified</option>
                  <option value="negotiating">Negotiating</option>
                  <option value="lost">Lost</option>
                  <option value="converted">Converted</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1 flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5" /> Assigned Sales Rep
                </label>
                <select
                  value={currentSelected.assignedTo || ''}
                  onChange={e => {
                    const newAssignee = e.target.value;
                    updateLead(currentSelected.id, { assignedTo: newAssignee });
                    if (newAssignee && newAssignee !== currentSelected.assignedTo) {
                      notifyLeadAssigned(currentSelected, newAssignee);
                    }
                  }}
                  className="input"
                >
                  <option value="">— Unassigned —</option>
                  {salesUsers.map(u => (
                    <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                  ))}
                </select>
              </div>
            </div>


            {currentSelected.status !== 'converted' && (
              <div className="flex justify-end">
                <button onClick={() => convert(currentSelected)} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2">
                  Convert to Franchisee <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            )}

            <div>
              <h3 className="font-bold text-gray-900 flex items-center gap-2 mb-3"><MessageSquare className="h-4 w-4" /> Interaction History</h3>
              <div className="space-y-2 max-h-64 overflow-y-auto mb-3">
                {currentSelected.interactions.length === 0 && <p className="text-sm text-gray-500">No interactions logged yet.</p>}
                {currentSelected.interactions.map(i => (
                  <div key={i.id} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span className="font-semibold">{i.author}</span>
                      <span>{new Date(i.date).toLocaleString()}</span>
                    </div>
                    <div className="text-sm text-gray-800">{i.note}</div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  value={interaction}
                  onChange={e => setInteraction(e.target.value)}
                  placeholder="Add interaction note..."
                  className="input flex-1"
                  onKeyDown={e => e.key === 'Enter' && addNote()}
                />
                <button onClick={addNote} className="bg-[#1a1a1a] text-white px-4 py-2 rounded-lg font-semibold">Add</button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      <style>{`.input { width: 100%; padding: 10px 14px; border: 1px solid #d1d5db; border-radius: 8px; outline: none; font-size: 14px; }
        .input:focus { border-color: #C41E3A; box-shadow: 0 0 0 3px rgba(196,30,58,0.1); }`}</style>
    </div>
  );
};

export const Modal: React.FC<{ title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }> = ({ title, onClose, children, wide }) => (
  <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
    <div className={`bg-white rounded-2xl shadow-2xl w-full ${wide ? 'max-w-3xl' : 'max-w-md'} max-h-[90vh] overflow-y-auto`} onClick={e => e.stopPropagation()}>
      <div className="flex items-center justify-between p-5 border-b border-gray-100 sticky top-0 bg-white">
        <h2 className="text-xl font-bold text-gray-900">{title}</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
      </div>
      <div className="p-5">{children}</div>
    </div>
  </div>
);

export const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <label className="block text-sm font-semibold text-gray-700 mb-1">{label}</label>
    {children}
  </div>
);

const InfoBlock: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({ icon, label, value }) => (
  <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
    <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">{icon}{label}</div>
    <div className="text-sm font-semibold text-gray-900 break-all">{value}</div>
  </div>
);

export default LeadsPage;
