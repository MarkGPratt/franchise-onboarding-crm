import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { Spinner, Modal } from './DeclarationsPage';
import { PhoneCall, Plus, Trash2, Loader2, Check, AlertTriangle } from 'lucide-react';

/** Head Office contact log: every call / meeting with a franchisee, with action points.
 *  Standard: at least 2 contacts per franchisee per month (contact_log_settings). Staff only. */

export const TOPICS: Record<string, string> = {
  sales_performance: 'Sales & performance', declarations_royalties: 'Declarations & royalties', marketing: 'Marketing',
  operations_quality: 'Operations & quality', complaints: 'Complaints', debtors: 'Debtors', staffing: 'Staffing',
  training: 'Training', compliance: 'Compliance', eworks_systems: 'Eworks & systems', orders_supplies: 'Orders & supplies',
  territory_leads: 'Territory & leads', support_request: 'Support request', personal_wellbeing: 'Personal wellbeing', other: 'Other',
};
const TYPES: Record<string, string> = { phone: 'Phone', whatsapp: 'WhatsApp', video: 'Video call', site_visit: 'Site visit', office_meeting: 'Office meeting', email: 'Email' };
const RAG: Record<string, string> = { green: 'bg-green-100 text-green-800', amber: 'bg-amber-100 text-amber-800', red: 'bg-red-100 text-red-800' };

interface Action { id: number; contact_id: number; franchisee_id: string; action: string; owner_side: 'head_office' | 'franchisee'; owner_name: string | null; due_on: string | null; status: 'open' | 'done' | 'cancelled'; done_at: string | null; done_by_name: string | null; close_note: string | null }
interface Contact { id: number; franchisee_id: string; contact_at: string; contact_type: string; direction: string; spoke_to: string | null; duration_min: number | null; topics: string[]; summary: string; status_rag: string | null; next_contact_on: string | null; logged_by: string; logged_by_name: string | null; franchisee_contact_actions?: Action[] }

const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Johannesburg' });
const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
const fmtDT = (d: string) => new Date(d).toLocaleString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const missing = (m: string) => /does not exist|schema cache/i.test(m) ? 'Run supabase/franchisee_contact_log.sql in Supabase first.' : m;

// ---------------------------------------------------------------- Log a call
export const LogCallModal: React.FC<{ franchiseeId?: string; onClose: () => void; onSaved: () => void }> = ({ franchiseeId, onClose, onSaved }) => {
  const { franchisees } = useData();
  const { user } = useAuth();
  const now = new Date(); now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  const [f, setF] = useState({ franchisee_id: franchiseeId || '', contact_at: now.toISOString().slice(0, 16), contact_type: 'phone', direction: 'outgoing', spoke_to: '', duration_min: '', summary: '', status_rag: '', next_contact_on: '' });
  const [topics, setTopics] = useState<string[]>([]);
  const [actions, setActions] = useState<{ action: string; owner_side: 'head_office' | 'franchisee'; owner_name: string; due_on: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = (k: string, v: string) => setF(p => ({ ...p, [k]: v }));

  const save = async () => {
    if (!f.franchisee_id) { setErr('Choose the franchisee.'); return; }
    if (!f.summary.trim()) { setErr('Write what was discussed.'); return; }
    if (actions.some(a => !a.action.trim())) { setErr('Fill in or remove the empty action point.'); return; }
    setBusy(true); setErr('');
    const { data, error } = await supabase.from('franchisee_contacts').insert({
      franchisee_id: f.franchisee_id, contact_at: new Date(f.contact_at).toISOString(), contact_type: f.contact_type, direction: f.direction,
      spoke_to: f.spoke_to || null, duration_min: f.duration_min ? Number(f.duration_min) : null, topics, summary: f.summary.trim(),
      status_rag: f.status_rag || null, next_contact_on: f.next_contact_on || null, logged_by_name: user?.name || null,
    }).select().single();
    if (error) { setBusy(false); setErr(missing(error.message)); return; }
    if (actions.length) {
      const { error: e2 } = await supabase.from('franchisee_contact_actions').insert(actions.map(a => ({
        contact_id: (data as Contact).id, franchisee_id: f.franchisee_id, action: a.action.trim(), owner_side: a.owner_side,
        owner_name: a.owner_name || null, due_on: a.due_on || null })));
      if (e2) { setBusy(false); setErr('The call was saved, but the action points were not: ' + e2.message); return; }
    }
    setBusy(false); onSaved();
  };

  const active = useMemo(() => [...franchisees].sort((a, b) => a.name.localeCompare(b.name)), [franchisees]);
  return (
    <Modal title="Log a call or meeting" onClose={onClose} wide>
      <div className="grid sm:grid-cols-2 gap-3 text-sm">
        <label className="sm:col-span-2"><span className="text-xs font-semibold text-gray-600">Franchisee</span>
          <select className="input" value={f.franchisee_id} disabled={!!franchiseeId} onChange={e => set('franchisee_id', e.target.value)}>
            <option value="">Choose…</option>{active.map(x => <option key={x.id} value={x.id}>{x.name}{x.territory ? ` · ${x.territory}` : ''}</option>)}
          </select></label>
        <label><span className="text-xs font-semibold text-gray-600">Date and time</span><input type="datetime-local" className="input" value={f.contact_at} onChange={e => set('contact_at', e.target.value)} /></label>
        <label><span className="text-xs font-semibold text-gray-600">Type</span>
          <select className="input" value={f.contact_type} onChange={e => set('contact_type', e.target.value)}>{Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label><span className="text-xs font-semibold text-gray-600">Direction</span>
          <select className="input" value={f.direction} onChange={e => set('direction', e.target.value)}><option value="outgoing">We contacted them</option><option value="incoming">They contacted us</option></select></label>
        <label><span className="text-xs font-semibold text-gray-600">Spoke to</span><input className="input" value={f.spoke_to} onChange={e => set('spoke_to', e.target.value)} placeholder="Name" /></label>
        <label><span className="text-xs font-semibold text-gray-600">Duration (minutes)</span><input type="number" min={0} max={600} className="input" value={f.duration_min} onChange={e => set('duration_min', e.target.value)} /></label>
        <label><span className="text-xs font-semibold text-gray-600">How is the franchisee doing?</span>
          <select className="input" value={f.status_rag} onChange={e => set('status_rag', e.target.value)}><option value="">—</option><option value="green">Green — on track</option><option value="amber">Amber — needs attention</option><option value="red">Red — at risk</option></select></label>
      </div>
      <div className="mt-3"><span className="text-xs font-semibold text-gray-600">Topics</span>
        <div className="flex flex-wrap gap-1.5 mt-1">{Object.entries(TOPICS).map(([k, v]) => (
          <button key={k} type="button" onClick={() => setTopics(t => t.includes(k) ? t.filter(x => x !== k) : [...t, k])}
            className={`px-2.5 py-1 rounded-full text-xs border ${topics.includes(k) ? 'bg-[#C41E3A] text-white border-[#C41E3A]' : 'border-gray-300 text-gray-700'}`}>{v}</button>))}</div>
      </div>
      <label className="block mt-3"><span className="text-xs font-semibold text-gray-600">What was discussed *</span><textarea rows={4} className="input" value={f.summary} onChange={e => set('summary', e.target.value)} /></label>
      <div className="mt-3">
        <div className="flex items-center justify-between"><span className="text-xs font-semibold text-gray-600">Action points</span>
          <button type="button" onClick={() => setActions(a => [...a, { action: '', owner_side: 'head_office', owner_name: '', due_on: '' }])} className="text-xs font-semibold text-[#C41E3A] flex items-center gap-1"><Plus className="h-3.5 w-3.5" /> Add action</button></div>
        {actions.map((a, i) => (
          <div key={i} className="mt-2 grid grid-cols-12 gap-2 items-center">
            <input className="input col-span-12 sm:col-span-5" placeholder="Action" value={a.action} onChange={e => setActions(x => x.map((y, j) => j === i ? { ...y, action: e.target.value } : y))} />
            <select className="input col-span-4 sm:col-span-2" value={a.owner_side} onChange={e => setActions(x => x.map((y, j) => j === i ? { ...y, owner_side: e.target.value as any } : y))}><option value="head_office">Head Office</option><option value="franchisee">Franchisee</option></select>
            <input className="input col-span-4 sm:col-span-2" placeholder="Who" value={a.owner_name} onChange={e => setActions(x => x.map((y, j) => j === i ? { ...y, owner_name: e.target.value } : y))} />
            <input type="date" className="input col-span-3 sm:col-span-2" value={a.due_on} onChange={e => setActions(x => x.map((y, j) => j === i ? { ...y, due_on: e.target.value } : y))} />
            <button type="button" onClick={() => setActions(x => x.filter((_, j) => j !== i))} className="col-span-1 text-gray-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
          </div>))}
      </div>
      <label className="block mt-3 max-w-xs"><span className="text-xs font-semibold text-gray-600">Next contact on</span><input type="date" className="input" value={f.next_contact_on} onChange={e => set('next_contact_on', e.target.value)} /></label>
      {err && <p className="mt-3 text-sm text-red-700">{err}</p>}
      <div className="mt-4 flex justify-end"><button onClick={save} disabled={busy} className="bg-[#C41E3A] text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2">{busy && <Loader2 className="h-4 w-4 animate-spin" />} Save</button></div>
    </Modal>
  );
};

// ---------------------------------------------------------------- Close an action
const closeAction = async (a: Action, status: 'done' | 'cancelled', after: () => void) => {
  const note = prompt(status === 'done' ? 'Close note (optional):' : 'Why is this cancelled?') ;
  if (note === null) return;
  const { error } = await supabase.from('franchisee_contact_actions').update({ status, close_note: note || null }).eq('id', a.id);
  if (error) alert(error.message); else after();
};

const ActionRow: React.FC<{ a: Action; name?: string; onChange: () => void }> = ({ a, name, onChange }) => {
  const overdue = a.status === 'open' && a.due_on && a.due_on < today();
  return (
    <div className={`flex flex-wrap items-center gap-2 text-sm py-1.5 ${a.status !== 'open' ? 'text-gray-400' : ''}`}>
      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${a.owner_side === 'head_office' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'}`}>{a.owner_side === 'head_office' ? 'HO' : 'Franchisee'}</span>
      {name && <span className="font-semibold">{name}:</span>}
      <span className={a.status === 'done' ? 'line-through' : ''}>{a.action}</span>
      {a.owner_name && <span className="text-xs text-gray-500">· {a.owner_name}</span>}
      {a.due_on && <span className={`text-xs ${overdue ? 'text-red-700 font-semibold' : 'text-gray-500'}`}>· due {fmtDate(a.due_on)}{overdue ? ' (overdue)' : ''}</span>}
      {a.status !== 'open' && <span className="text-xs">· {a.status}{a.done_by_name ? ` by ${a.done_by_name}` : ''}{a.close_note ? ` — ${a.close_note}` : ''}</span>}
      {a.status === 'open' && <span className="ml-auto flex gap-2">
        <button onClick={() => closeAction(a, 'done', onChange)} className="text-xs font-semibold text-green-700 flex items-center gap-1"><Check className="h-3.5 w-3.5" /> Done</button>
        <button onClick={() => closeAction(a, 'cancelled', onChange)} className="text-xs text-gray-500">Cancel</button></span>}
    </div>
  );
};

// ---------------------------------------------------------------- Timeline (on the franchisee)
export const ContactTimeline: React.FC<{ franchiseeId: string }> = ({ franchiseeId }) => {
  const [rows, setRows] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [logging, setLogging] = useState(false);
  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('franchisee_contacts').select('*, franchisee_contact_actions(*)').eq('franchisee_id', franchiseeId).order('contact_at', { ascending: false });
    if (error) setErr(missing(error.message));
    setRows((data || []) as Contact[]); setLoading(false);
  };
  useEffect(() => { load(); }, [franchiseeId]);
  const open = rows.flatMap(c => c.franchisee_contact_actions || []).filter(a => a.status === 'open');
  return (
    <div className="space-y-4">
      <div className="flex justify-end"><button onClick={() => setLogging(true)} className="bg-[#C41E3A] text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2"><PhoneCall className="h-4 w-4" /> Log a call</button></div>
      {err && <p className="text-red-700 text-sm">{err}</p>}
      {loading ? <Spinner /> : <>
        {open.length > 0 && <div className="bg-amber-50 border border-amber-200 rounded-xl p-4"><div className="font-semibold text-sm mb-1">Open action points ({open.length})</div>{open.map(a => <ActionRow key={a.id} a={a} onChange={load} />)}</div>}
        {rows.length === 0 ? <p className="text-gray-500 text-sm">No calls logged yet.</p> : rows.map(c => (
          <div key={c.id} className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-semibold">{fmtDT(c.contact_at)}</span>
              <span className="text-gray-500">· {TYPES[c.contact_type] || c.contact_type} · {c.direction === 'incoming' ? 'they contacted us' : 'we contacted them'}{c.spoke_to ? ` · spoke to ${c.spoke_to}` : ''}{c.duration_min ? ` · ${c.duration_min} min` : ''}</span>
              {c.status_rag && <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${RAG[c.status_rag]}`}>{c.status_rag}</span>}
              <span className="ml-auto text-xs text-gray-500">logged by {c.logged_by_name || '—'}</span>
            </div>
            {c.topics.length > 0 && <div className="mt-1 flex flex-wrap gap-1">{c.topics.map(t => <span key={t} className="px-2 py-0.5 rounded-full bg-gray-100 text-xs">{TOPICS[t] || t}</span>)}</div>}
            <p className="mt-2 text-sm whitespace-pre-wrap">{c.summary}</p>
            {(c.franchisee_contact_actions || []).length > 0 && <div className="mt-2 border-t border-gray-100 pt-2">{(c.franchisee_contact_actions || []).map(a => <ActionRow key={a.id} a={a} onChange={load} />)}</div>}
            {c.next_contact_on && <div className="mt-2 text-xs text-gray-500">Next contact: {fmtDate(c.next_contact_on)}</div>}
          </div>))}
      </>}
      {logging && <LogCallModal franchiseeId={franchiseeId} onClose={() => setLogging(false)} onSaved={() => { setLogging(false); load(); }} />}
    </div>
  );
};

// ---------------------------------------------------------------- Contact Log page (staff)
interface Cov { franchisee_id: string; contacts: number; target: number; status: 'met' | 'on_track' | 'behind'; last_contact_at: string | null; days_since_last: number | null; last_rag: string | null; open_actions: number; overdue_actions: number; staff: string | null }
interface StaffStat { month: string; staff: string; contacts: number; franchisees_reached: number; minutes: number; actions_raised: number; actions_closed: number }

const ContactLogPage: React.FC = () => {
  const { user } = useAuth();
  const { franchisees } = useData();
  const isAdmin = user?.role === 'admin';
  const [tab, setTab] = useState<'coverage' | 'actions' | 'stats'>('coverage');
  const [month, setMonth] = useState(today().slice(0, 7));
  const [activeOnly, setActiveOnly] = useState(true);
  const [cov, setCov] = useState<Cov[]>([]);
  const [acts, setActs] = useState<Action[]>([]);
  const [stats, setStats] = useState<StaffStat[]>([]);
  const [topicStats, setTopicStats] = useState<{ month: string; topic: string; mentions: number }[]>([]);
  const [target, setTarget] = useState(2);
  const [owner, setOwner] = useState<'all' | 'head_office' | 'franchisee'>('all');
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [logging, setLogging] = useState<string | null>(null);
  const name = (id: string) => franchisees.find(f => f.id === id)?.name || id;

  const load = async () => {
    setLoading(true); setErr('');
    if (tab === 'coverage') {
      const { data, error } = await supabase.rpc('contact_log_coverage', { p_month: `${month}-01` });
      if (error) setErr(missing(error.message)); setCov((data || []) as Cov[]);
    } else if (tab === 'actions') {
      const { data, error } = await supabase.from('franchisee_contact_actions').select('*').eq('status', 'open').order('due_on', { ascending: true, nullsFirst: false });
      if (error) setErr(missing(error.message)); setActs((data || []) as Action[]);
    } else {
      const from = new Date(); from.setMonth(from.getMonth() - 5); const p_from = from.toISOString().slice(0, 7) + '-01';
      const [a, b, s] = await Promise.all([
        supabase.rpc('contact_log_staff_stats', { p_from, p_to: today() }),
        supabase.rpc('contact_log_topic_stats', { p_from, p_to: today() }),
        supabase.from('contact_log_settings').select('min_contacts_per_month').eq('id', 1).maybeSingle(),
      ]);
      if (a.error) setErr(missing(a.error.message));
      setStats((a.data || []) as StaffStat[]); setTopicStats((b.data || []) as any[]);
      if (s.data) setTarget((s.data as any).min_contacts_per_month);
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, [tab, month]);

  const covRows = cov.filter(c => !activeOnly || (franchisees.find(f => f.id === c.franchisee_id)?.status || 'active') === 'active')
    .sort((a, b) => ({ behind: 0, on_track: 1, met: 2 }[a.status] - { behind: 0, on_track: 1, met: 2 }[b.status]) || name(a.franchisee_id).localeCompare(name(b.franchisee_id)));
  const metPct = covRows.length ? Math.round(100 * covRows.filter(c => c.status === 'met').length / covRows.length) : 0;
  const actRows = acts.filter(a => (owner === 'all' || a.owner_side === owner) && (!overdueOnly || (a.due_on && a.due_on < today())));

  const saveTarget = async () => {
    const { error } = await supabase.from('contact_log_settings').update({ min_contacts_per_month: target }).eq('id', 1);
    alert(error ? error.message : 'Saved.');
  };

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-3xl font-bold text-gray-900">Contact Log</h1><p className="text-gray-600 mt-1">Every call and meeting with a franchisee. Standard: at least {cov[0]?.target ?? target} contacts per franchisee per month.</p></div>
        <button onClick={() => setLogging('')} className="bg-[#C41E3A] text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2"><PhoneCall className="h-4 w-4" /> Log a call</button>
      </div>
      <div className="mt-4 flex gap-2 border-b border-gray-200">
        {([['coverage', 'Coverage'], ['actions', 'Open actions'], ...(isAdmin ? [['stats', 'Stats']] : [])] as [typeof tab, string][]).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px ${tab === k ? 'border-[#C41E3A] text-[#C41E3A]' : 'border-transparent text-gray-500'}`}>{l}</button>))}
      </div>
      {err && <p className="mt-4 text-red-700">{err}</p>}
      {loading ? <Spinner /> : tab === 'coverage' ? (
        <div className="mt-4">
          <div className="flex flex-wrap items-center gap-4 text-sm mb-3">
            <label className="flex items-center gap-2">Month <input type="month" className="input w-40" value={month} onChange={e => setMonth(e.target.value)} /></label>
            <label className="flex items-center gap-1"><input type="checkbox" checked={activeOnly} onChange={e => setActiveOnly(e.target.checked)} /> Active franchisees only</label>
            <span className="ml-auto font-semibold">{metPct}% met the standard</span>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 text-xs uppercase"><tr><th className="text-left px-4 py-3">Franchisee</th><th className="px-3 py-3">Contacts</th><th className="text-left px-3 py-3">Status</th><th className="text-left px-3 py-3">Last contact</th><th className="px-3 py-3">Last RAG</th><th className="px-3 py-3">Open / overdue actions</th><th className="text-left px-3 py-3">Who called</th><th></th></tr></thead>
              <tbody>{covRows.map(c => (
                <tr key={c.franchisee_id} className="border-t border-gray-100">
                  <td className="px-4 py-2 font-medium">{name(c.franchisee_id)}</td>
                  <td className="px-3 py-2 text-center">{c.contacts} / {c.target}</td>
                  <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${c.status === 'met' ? 'bg-green-100 text-green-800' : c.status === 'behind' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-700'}`}>{c.status === 'met' ? 'Met' : c.status === 'behind' ? 'Behind' : 'On track'}</span></td>
                  <td className="px-3 py-2">{c.last_contact_at ? `${fmtDate(c.last_contact_at)} (${c.days_since_last} d ago)` : 'Never'}</td>
                  <td className="px-3 py-2 text-center">{c.last_rag ? <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${RAG[c.last_rag]}`}>{c.last_rag}</span> : '—'}</td>
                  <td className="px-3 py-2 text-center">{c.open_actions} {c.overdue_actions > 0 && <span className="text-red-700 font-semibold">/ {c.overdue_actions} overdue</span>}</td>
                  <td className="px-3 py-2 text-xs text-gray-600">{c.staff || '—'}</td>
                  <td className="px-3 py-2 text-right"><button onClick={() => setLogging(c.franchisee_id)} className="text-[#C41E3A] text-xs font-semibold">Log call</button></td>
                </tr>))}</tbody>
            </table>
          </div>
        </div>
      ) : tab === 'actions' ? (
        <div className="mt-4">
          <div className="flex flex-wrap items-center gap-4 text-sm mb-3">
            <select className="input w-48" value={owner} onChange={e => setOwner(e.target.value as any)}><option value="all">All owners</option><option value="head_office">Head Office</option><option value="franchisee">Franchisee</option></select>
            <label className="flex items-center gap-1"><input type="checkbox" checked={overdueOnly} onChange={e => setOverdueOnly(e.target.checked)} /> Overdue only</label>
            <span className="ml-auto text-gray-600">{actRows.length} open</span>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4 divide-y divide-gray-100">{actRows.length ? actRows.map(a => <ActionRow key={a.id} a={a} name={name(a.franchisee_id)} onChange={load} />) : <p className="text-gray-500 text-sm">No open action points.</p>}</div>
        </div>
      ) : (
        <div className="mt-4 space-y-6">
          <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-wrap items-center gap-3 text-sm">
            <span className="font-semibold">Monthly standard per franchisee:</span>
            <input type="number" min={1} max={20} className="input w-20" value={target} onChange={e => setTarget(Number(e.target.value))} />
            <button onClick={saveTarget} className="border border-gray-300 px-3 py-1.5 rounded-lg font-semibold">Save</button>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 text-xs uppercase"><tr><th className="text-left px-4 py-3">Month</th><th className="text-left px-3 py-3">Staff member</th><th className="px-3 py-3">Contacts</th><th className="px-3 py-3">Franchisees reached</th><th className="px-3 py-3">Minutes</th><th className="px-3 py-3">Actions raised</th><th className="px-3 py-3">Actions closed</th></tr></thead>
              <tbody>{stats.length ? stats.map((s, i) => (
                <tr key={i} className="border-t border-gray-100 text-center"><td className="px-4 py-2 text-left">{new Date(s.month).toLocaleDateString('en-ZA', { month: 'short', year: 'numeric' })}</td><td className="px-3 py-2 text-left">{s.staff}</td><td>{s.contacts}</td><td>{s.franchisees_reached}</td><td>{s.minutes}</td><td>{s.actions_raised}</td><td>{s.actions_closed}</td></tr>)) : <tr><td colSpan={7} className="px-4 py-6 text-gray-500">No calls logged in the last 6 months.</td></tr>}</tbody>
            </table>
          </div>
          {topicStats.length > 0 && <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="font-semibold text-sm mb-2">What franchisees are calling about (last 6 months)</div>
            {Object.entries(topicStats.reduce((m, t) => ({ ...m, [t.topic]: (m[t.topic] || 0) + t.mentions }), {} as Record<string, number>)).sort((a, b) => b[1] - a[1]).map(([t, n]) => (
              <div key={t} className="flex items-center gap-2 text-sm py-0.5"><span className="w-48">{TOPICS[t] || t}</span><div className="h-2 bg-[#C41E3A] rounded" style={{ width: `${Math.min(100, n * 8)}%` }} /><span className="text-gray-600">{n}</span></div>))}
          </div>}
          {cov.length === 0 && <p className="text-xs text-gray-500 flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5" /> Coverage by franchisee is on the Coverage tab.</p>}
        </div>
      )}
      {logging !== null && <LogCallModal franchiseeId={logging || undefined} onClose={() => setLogging(null)} onSaved={() => { setLogging(null); load(); }} />}
    </div>
  );
};

export default ContactLogPage;
