import React, { useEffect, useState } from 'react';
import { useData, Lead, Area } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { notify } from '@/lib/notify';
import { Plus, X, MessageSquare, ArrowRight, Trash2, Mail, Phone, MapPin, User, Layers, CalendarDays, ListChecks, BarChart3, Table2 } from 'lucide-react';
import LeadProcessPanel from './LeadProcessPanel';
import LeadTodoView from './LeadTodoView';
import LeadPlannedReport from './LeadPlannedReport';
import {
  todayYmd, fmtDate, nextOpenStep, stepDue, dueState, DUE_STYLES, isActiveStatus, PROCESS_STEPS,
} from '@/lib/leadProcess';

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-100 text-blue-700',
  qualified: 'bg-green-100 text-green-700',
  negotiating: 'bg-amber-100 text-amber-700',
  converted: 'bg-purple-100 text-purple-700',
  lost: 'bg-gray-100 text-gray-700',
};

// Status filter. 'active' = everything except Lost.
const STATUS_FILTERS: { id: string; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'All except Lost' },
  { id: 'lost', label: 'Lost' },
  { id: 'new', label: 'New' },
  { id: 'qualified', label: 'Qualified' },
  { id: 'negotiating', label: 'Negotiating' },
  { id: 'converted', label: 'Converted' },
];

type View = 'pipeline' | 'todo' | 'planned';

const LeadsPage: React.FC = () => {
  const { leads, addLead, updateLead, deleteLead, addInteraction, convertLeadToFranchisee, divisions, areas } = useData();
  const { user, users, addUser } = useAuth();
  const [view, setView] = useState<View>('pipeline');
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<Lead | null>(null);
  const [filter, setFilter] = useState<string>('active');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all');
  const [divisionFilter, setDivisionFilter] = useState<string>('all');

  const salesUsers = users.filter(u => u.role === 'sales' || u.role === 'admin');
  const defaultAssignee = user?.role === 'sales' ? user.id : (salesUsers[0]?.id || '');

  const blankForm = () => ({
    contactName: '',
    email: '',
    phone: '',
    area: '',
    division: divisions[0]?.name || '',
    status: 'new' as Lead['status'],
    assignedTo: defaultAssignee,
    processStartDate: todayYmd(),
  });
  const [form, setForm] = useState(blankForm);
  const [interaction, setInteraction] = useState('');

  const userName = (id: string) => users.find(u => u.id === id)?.name || 'Unassigned';

  const matchesStatus = (l: Lead, f: string) =>
    f === 'all' ? true : f === 'active' ? l.status !== 'lost' : l.status === f;

  const filtered = leads.filter(l => {
    if (!matchesStatus(l, filter)) return false;
    if (assigneeFilter !== 'all' && l.assignedTo !== assigneeFilter) return false;
    if (divisionFilter !== 'all' && (l.division || '') !== divisionFilter) return false;
    return true;
  });

  // Overdue to-do count for the tab badge
  const today = todayYmd();
  const overdueCount = leads.reduce((n, l) => {
    if (!l.processStartDate || !isActiveStatus(l.status)) return n;
    return n + PROCESS_STEPS.filter(s => !l.processSteps?.[s.id] && stepDue(l.processStartDate!, s) < today).length;
  }, 0);

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
      processStartDate: form.processStartDate || todayYmd(),
      // Step 1a of the process is done by creating the record
      processSteps: { s1_record: { at: new Date().toISOString(), by: user?.name || 'Unknown' } },
    });
    notifyLeadAssigned(form, assignedTo);
    setForm(blankForm());
    setShowForm(false);
  };

  const addNote = () => {
    if (!selected || !interaction.trim()) return;
    addInteraction(selected.id, interaction, user?.name || 'Unknown');
    setInteraction('');
  };

  const changeArea = (l: Lead, newArea: string) => {
    const next = newArea.trim();
    if (next === (l.area || '').trim()) return;
    updateLead(l.id, { area: next });
    addInteraction(l.id, `Area changed from "${l.area || '—'}" to "${next || '—'}"`, user?.name || 'Unknown');
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
      alert(`Franchisee created. An account already exists for ${l.email}; that account has been kept.`);
    }
    setSelected(null);
  };

  const currentSelected = selected ? leads.find(l => l.id === selected.id) || null : null;

  const tabBtn = (id: View, label: string, icon: React.ReactNode, badge?: number) => (
    <button
      onClick={() => setView(id)}
      className={`px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition ${view === id ? 'bg-[#C41E3A] text-white' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'}`}
    >
      {icon}{label}
      {badge ? <span className={`px-1.5 py-0.5 rounded-full text-[11px] ${view === id ? 'bg-white text-[#C41E3A]' : 'bg-red-100 text-red-700'}`}>{badge}</span> : null}
    </button>
  );

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

      <div className="flex flex-wrap gap-2">
        {tabBtn('pipeline', 'Pipeline', <Table2 className="h-4 w-4" />)}
        {tabBtn('todo', 'To-Do', <ListChecks className="h-4 w-4" />, overdueCount)}
        {tabBtn('planned', 'Planned Dates', <BarChart3 className="h-4 w-4" />)}
      </div>

      {view === 'todo' && <LeadTodoView leads={leads} onOpenLead={l => setSelected(l)} />}
      {view === 'planned' && <LeadPlannedReport leads={leads} onOpenLead={l => setSelected(l)} />}

      {view === 'pipeline' && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {STATUS_FILTERS.map(s => (
              <button
                key={s.id}
                onClick={() => setFilter(s.id)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${filter === s.id ? 'bg-[#1a1a1a] text-white' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'}`}
              >
                {s.label} ({leads.filter(l => matchesStatus(l, s.id)).length})
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

          <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Contact', 'Division', 'Area', 'Assigned To', 'Status', 'Next Step', 'Planned', 'Latest Comment', 'Created', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.length === 0 && (
                  <tr><td colSpan={10} className="text-center py-12 text-gray-500">No leads found.</td></tr>
                )}
                {filtered.map(l => {
                  const next = l.processStartDate && isActiveStatus(l.status) ? nextOpenStep(l.processSteps) : null;
                  const nextDue = next ? stepDue(l.processStartDate!, next) : '';
                  const latest = l.interactions.length > 0
                    ? l.interactions.reduce((a, b) => new Date(a.date) > new Date(b.date) ? a : b)
                    : null;
                  return (
                    <tr key={l.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setSelected(l)}>
                      <td className="px-4 py-4">
                        <div className="font-semibold text-gray-900">{l.contactName}</div>
                        <div className="text-xs text-gray-500">{l.email}</div>
                      </td>
                      <td className="px-4 py-4">
                        {l.division ? (
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700">{l.division}</span>
                        ) : <span className="text-xs text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-700">{l.area}</td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-full bg-gradient-to-br from-[#C41E3A] to-[#1a1a1a] text-white flex items-center justify-center text-[10px] font-bold">
                            {(userName(l.assignedTo).match(/\b\w/g) || []).slice(0,2).join('').toUpperCase() || '—'}
                          </div>
                          <span className="text-sm text-gray-800">{userName(l.assignedTo)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${STATUS_COLORS[l.status] || 'bg-gray-100 text-gray-700'}`}>{l.status}</span>
                      </td>
                      <td className="px-4 py-4 text-xs max-w-[220px]">
                        {next ? (
                          <>
                            <div className="text-gray-800 truncate" title={next.label}>{next.label}</div>
                            <span className={`inline-block mt-1 px-1.5 py-0.5 rounded font-semibold ${DUE_STYLES[dueState(nextDue, false, today)]}`}>
                              {next.dayLabel} · {fmtDate(nextDue).replace(/ \d{4}$/, '')}
                            </span>
                          </>
                        ) : l.processStartDate && isActiveStatus(l.status)
                          ? <span className="text-green-700 font-semibold">Process complete</span>
                          : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-4 text-xs text-gray-700 whitespace-nowrap">
                        {l.plannedSigningDate || l.plannedLaunchDate ? (
                          <>
                            <div><span className="text-gray-500">Sign:</span> {fmtDate(l.plannedSigningDate)}</div>
                            <div><span className="text-gray-500">Launch:</span> {fmtDate(l.plannedLaunchDate)}</div>
                          </>
                        ) : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-600 max-w-xs">
                        {latest
                          ? <span title={latest.note} className="block truncate max-w-[220px]">{latest.note}</span>
                          : <span className="text-gray-400">—</span>}
                        {l.interactions.length > 0 && (
                          <span className="text-[11px] text-gray-400">{l.interactions.length} note{l.interactions.length === 1 ? '' : 's'}</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-500">
                        <div>{new Date(l.createdAt).toLocaleDateString()}</div>
                        <div className="text-xs text-gray-400">{new Date(l.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <button onClick={e => { e.stopPropagation(); if (confirm('Delete this lead?')) deleteLead(l.id); }} className="text-gray-400 hover:text-red-600">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

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
              <input list="areas-list" value={form.area} onChange={e => setForm({ ...form, area: e.target.value })} className="input" placeholder="Select or type an area (can be added later)..." />
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
            <Field label="Enquiry received (Day 1)">
              <input type="date" required value={form.processStartDate} max={todayYmd()} onChange={e => setForm({ ...form, processStartDate: e.target.value })} className="input" />
              <p className="text-xs text-gray-500 mt-1">The to-do list counts its D1–D14 deadlines from this date.</p>
            </Field>
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
              <AreaEditor key={currentSelected.id} value={currentSelected.area} onSave={v => changeArea(currentSelected, v)} />
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

            <div className="grid sm:grid-cols-3 gap-3">
              <DateField
                label="Enquiry received (Day 1)"
                value={currentSelected.processStartDate}
                max={todayYmd()}
                onChange={v => updateLead(currentSelected.id, { processStartDate: v })}
              />
              <DateField
                label="Planned FA signature"
                value={currentSelected.plannedSigningDate}
                onChange={v => updateLead(currentSelected.id, { plannedSigningDate: v })}
              />
              <DateField
                label="Planned launch"
                value={currentSelected.plannedLaunchDate}
                min={currentSelected.plannedSigningDate}
                onChange={v => updateLead(currentSelected.id, { plannedLaunchDate: v })}
              />
            </div>

            {currentSelected.status !== 'converted' && (
              <div className="flex justify-end">
                <button onClick={() => convert(currentSelected)} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2">
                  Convert to Franchisee <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            )}

            <LeadProcessPanel lead={currentSelected} />

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

      {/* Shared area suggestions for the New Lead form and the Area editor */}
      <datalist id="areas-list">
        {areas.map((a: Area) => <option key={a.id} value={a.name} />)}
      </datalist>

      <style>{`.input { width: 100%; padding: 10px 14px; border: 1px solid #d1d5db; border-radius: 8px; outline: none; font-size: 14px; }
        .input:focus { border-color: #C41E3A; box-shadow: 0 0 0 3px rgba(196,30,58,0.1); }`}</style>
    </div>
  );
};

/** Editable Area field — saves when you leave the field or press Enter. */
const AreaEditor: React.FC<{ value: string; onSave: (v: string) => void }> = ({ value, onSave }) => {
  const [v, setV] = useState(value || '');
  useEffect(() => { setV(value || ''); }, [value]);
  const commit = () => { if (v.trim() !== (value || '').trim()) onSave(v); };
  return (
    <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
      <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1"><MapPin className="h-4 w-4" />Area</div>
      <input
        list="areas-list"
        value={v}
        onChange={e => setV(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        placeholder="Set area..."
        className="w-full bg-white border border-gray-200 rounded px-2 py-1 text-sm font-semibold text-gray-900 outline-none focus:border-[#C41E3A]"
      />
    </div>
  );
};

const DateField: React.FC<{ label: string; value?: string; min?: string; max?: string; onChange: (v: string) => void }> = ({ label, value, min, max, onChange }) => (
  <div>
    <label className="block text-sm font-semibold text-gray-700 mb-1 flex items-center gap-1.5">
      <CalendarDays className="h-3.5 w-3.5" /> {label}
    </label>
    <input type="date" value={value || ''} min={min} max={max} onChange={e => onChange(e.target.value)} className="input" />
  </div>
);

export const Modal: React.FC<{ title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }> = ({ title, onClose, children, wide }) => (
  <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
    <div className={`bg-white rounded-2xl shadow-2xl w-full ${wide ? 'max-w-3xl' : 'max-w-md'} max-h-[90vh] overflow-y-auto`} onClick={e => e.stopPropagation()}>
      <div className="flex items-center justify-between p-5 border-b border-gray-100 sticky top-0 bg-white z-10">
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
