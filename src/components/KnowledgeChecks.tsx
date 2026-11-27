import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { Spinner, Modal } from './DeclarationsPage';
import { Copy, Mail, Plus, Trash2, Loader2, Check } from 'lucide-react';

/** Knowledge checks: send a private link to anyone, see results, edit questions (staff). */
interface Mod { id: string; title: string; description: string | null; audience: string; pass_pct: number; active: boolean; position: number }
interface Q { id: string; module_id: string; prompt: string; options: string[]; correct: number; reference: string | null; active: boolean; position: number }
interface Asg { id: string; token: string; person_name: string; person_email: string | null; person_type: string; franchisee_id: string | null; module_ids: string[]; created_by: string | null; created_at: string; completed_at: string | null; cancelled: boolean }
interface Att { assignment_id: string; module_id: string; score: number; total: number; passed: boolean; created_at: string }
const TYPES: Record<string, string> = { principal: 'Principal', franchisee_staff: 'Franchisee staff', head_office: 'Head Office staff' };
const linkOf = (t: string) => `${window.location.origin}/quiz/${t}`;
const missing = (m: string) => /does not exist|schema cache/i.test(m) ? 'Run supabase/knowledge_checks.sql in Supabase first.' : m;

const KnowledgeChecks: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [tab, setTab] = useState<'results' | 'questions'>('results');
  const [mods, setMods] = useState<Mod[]>([]);
  const [qs, setQs] = useState<Q[]>([]);
  const [asg, setAsg] = useState<Asg[]>([]);
  const [att, setAtt] = useState<Att[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [creating, setCreating] = useState(false);
  const { franchisees } = useData();

  const load = async () => {
    setLoading(true);
    const [m, q, a, t] = await Promise.all([
      supabase.from('quiz_modules').select('*').order('position'),
      supabase.from('quiz_questions').select('*').order('position'),
      supabase.from('quiz_assignments').select('*').order('created_at', { ascending: false }),
      supabase.from('quiz_attempts').select('assignment_id, module_id, score, total, passed, created_at'),
    ]);
    const e = m.error || q.error || a.error || t.error; setErr(e ? missing(e.message) : '');
    setMods((m.data || []) as Mod[]); setQs((q.data || []) as Q[]); setAsg((a.data || []) as Asg[]); setAtt((t.data || []) as Att[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);
  const fname = (id: string | null) => (id ? franchisees.find(f => f.id === id)?.name || id : '');

  const sendEmail = async (a: Asg) => {
    if (!a.person_email) { alert('No email address on this link. Copy the link and send it yourself.'); return; }
    const { error } = await supabase.functions.invoke('send-notification', { body: { event_type: 'quiz_invite', recipient_email: a.person_email, recipient_name: a.person_name,
      variables: { recipient_name: a.person_name.split(' ')[0], quiz_link: linkOf(a.token), sender_name: user?.name || 'Head Office', modules: a.module_ids.map(id => mods.find(m => m.id === id)?.title || id).join('; ') } } });
    alert(error ? error.message : `Sent to ${a.person_email}.`);
  };
  const cancel = async (a: Asg) => {
    if (!confirm(`Cancel ${a.person_name}'s link? It will stop working; results are kept.`)) return;
    const { error } = await supabase.from('quiz_assignments').update({ cancelled: true }).eq('id', a.id);
    if (error) alert(error.message); else load();
  };

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-3xl font-bold text-gray-900">Knowledge Checks</h1>
          <p className="text-gray-600 mt-1">Send anyone a private link to a questionnaire on the agreement, the onboarding process, Head Office services and the routine checks. 100% is needed to pass each part.</p></div>
        <button onClick={() => setCreating(true)} className="bg-[#C41E3A] text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2"><Plus className="h-4 w-4" /> New link</button>
      </div>
      <div className="mt-4 flex gap-2 border-b border-gray-200">
        {([['results', 'Links & results'], ...(isAdmin ? [['questions', 'Questions']] : [])] as [typeof tab, string][]).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px ${tab === k ? 'border-[#C41E3A] text-[#C41E3A]' : 'border-transparent text-gray-500'}`}>{l}</button>))}
      </div>
      {err && <p className="mt-4 text-red-700">{err}</p>}
      {loading ? <Spinner /> : tab === 'results' ? (
        <div className="mt-4 bg-white border border-gray-200 rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase"><tr><th className="text-left px-4 py-3">Person</th><th className="text-left px-3 py-3">Parts (attempts)</th><th className="text-left px-3 py-3">Status</th><th></th></tr></thead>
            <tbody>{asg.length ? asg.map(a => (
              <tr key={a.id} className={`border-t border-gray-100 align-top ${a.cancelled ? 'text-gray-400' : ''}`}>
                <td className="px-4 py-2"><div className="font-medium">{a.person_name}</div><div className="text-xs text-gray-500">{TYPES[a.person_type]}{a.franchisee_id ? ` · ${fname(a.franchisee_id)}` : ''}{a.person_email ? ` · ${a.person_email}` : ''}</div><div className="text-xs text-gray-400">sent {new Date(a.created_at).toLocaleDateString('en-ZA')} by {a.created_by || '—'}</div></td>
                <td className="px-3 py-2">{a.module_ids.map(id => {
                  const mine = att.filter(t => t.assignment_id === a.id && t.module_id === id); const best = mine.find(t => t.passed) || mine[mine.length - 1];
                  return <div key={id} className="flex items-center gap-2">{mine.some(t => t.passed) ? <Check className="h-3.5 w-3.5 text-green-600" /> : <span className="w-3.5" />}<span>{mods.find(m => m.id === id)?.title || id}</span><span className="text-xs text-gray-500">{mine.length ? `${best.score}/${best.total} · ${mine.length} attempt${mine.length === 1 ? '' : 's'}` : 'not started'}</span></div>;
                })}</td>
                <td className="px-3 py-2">{a.cancelled ? 'Cancelled' : a.completed_at ? <span className="text-green-700 font-semibold">Passed {new Date(a.completed_at).toLocaleDateString('en-ZA')}</span> : 'In progress'}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap">{!a.cancelled && <>
                  <button onClick={() => { navigator.clipboard.writeText(linkOf(a.token)); alert('Link copied.'); }} className="text-xs font-semibold text-gray-700 mr-3 inline-flex items-center gap-1"><Copy className="h-3.5 w-3.5" /> Copy link</button>
                  <button onClick={() => sendEmail(a)} className="text-xs font-semibold text-[#C41E3A] mr-3 inline-flex items-center gap-1"><Mail className="h-3.5 w-3.5" /> Email</button>
                  <button onClick={() => cancel(a)} className="text-xs text-gray-400">Cancel</button></>}</td>
              </tr>)) : <tr><td colSpan={4} className="px-4 py-6 text-gray-500">No links yet. Click "New link".</td></tr>}</tbody>
          </table>
        </div>
      ) : <QuestionEditor mods={mods} qs={qs} onSaved={load} />}
      {creating && <NewLink mods={mods} onClose={() => setCreating(false)} onCreated={a => { setCreating(false); load(); if (a.person_email && confirm(`Link created. Email it to ${a.person_email} now?`)) sendEmail(a); }} />}
    </div>
  );
};

const NewLink: React.FC<{ mods: Mod[]; onClose: () => void; onCreated: (a: Asg) => void }> = ({ mods, onClose, onCreated }) => {
  const { user } = useAuth(); const { franchisees } = useData();
  const [f, setF] = useState({ person_name: '', person_email: '', person_type: 'principal', franchisee_id: '' });
  const [sel, setSel] = useState<string[]>(mods.filter(m => m.active).map(m => m.id));
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!f.person_name.trim()) { alert('Enter the person\'s name.'); return; }
    if (!sel.length) { alert('Choose at least one part.'); return; }
    setBusy(true);
    const { data, error } = await supabase.from('quiz_assignments').insert({ person_name: f.person_name.trim(), person_email: f.person_email.trim() || null, person_type: f.person_type,
      franchisee_id: f.franchisee_id || null, module_ids: sel, created_by: user?.name || null }).select().single();
    setBusy(false);
    if (error) alert(error.message); else onCreated(data as Asg);
  };
  return (
    <Modal title="New knowledge-check link" onClose={onClose}>
      <div className="grid sm:grid-cols-2 gap-3 text-sm">
        <label><span className="text-xs font-semibold text-gray-600">Name *</span><input className="input" value={f.person_name} onChange={e => setF({ ...f, person_name: e.target.value })} /></label>
        <label><span className="text-xs font-semibold text-gray-600">Email</span><input className="input" value={f.person_email} onChange={e => setF({ ...f, person_email: e.target.value })} /></label>
        <label><span className="text-xs font-semibold text-gray-600">Who is it for</span><select className="input" value={f.person_type} onChange={e => setF({ ...f, person_type: e.target.value })}>{Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label><span className="text-xs font-semibold text-gray-600">Franchisee (if any)</span><select className="input" value={f.franchisee_id} onChange={e => setF({ ...f, franchisee_id: e.target.value })}><option value="">—</option>{[...franchisees].sort((a, b) => a.name.localeCompare(b.name)).map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
      </div>
      {f.person_type === 'principal' && <p className="text-xs text-gray-500 mt-2">When a Principal linked to a franchisee passes every part, Process Flow task 3.5 is ticked automatically.</p>}
      <div className="mt-3 text-xs font-semibold text-gray-600">Parts</div>
      <div className="mt-1 space-y-1">{mods.filter(m => m.active).map(m => (
        <label key={m.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={sel.includes(m.id)} onChange={e => setSel(s => e.target.checked ? [...s, m.id] : s.filter(x => x !== m.id))} /> {m.title}</label>))}</div>
      <div className="mt-4 flex justify-end"><button onClick={save} disabled={busy} className="bg-[#C41E3A] text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2">{busy && <Loader2 className="h-4 w-4 animate-spin" />} Create link</button></div>
    </Modal>
  );
};

const QuestionEditor: React.FC<{ mods: Mod[]; qs: Q[]; onSaved: () => void }> = ({ mods, qs, onSaved }) => {
  const [mod, setMod] = useState(mods[0]?.id || '');
  const [edit, setEdit] = useState<Q | null>(null);
  const list = qs.filter(q => q.module_id === mod);
  const addModule = async () => {
    const title = prompt('Name of the new part (e.g. "Operations Manual: invoicing and money")'); if (!title) return;
    const id = title.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 40) + '_' + Date.now().toString(36).slice(-4);
    const { error } = await supabase.from('quiz_modules').insert({ id, title, position: (mods[mods.length - 1]?.position || 0) + 10 });
    if (error) alert(error.message); else { onSaved(); setMod(id); }
  };
  const toggleModule = async (m: Mod) => { const { error } = await supabase.from('quiz_modules').update({ active: !m.active }).eq('id', m.id); if (error) alert(error.message); else onSaved(); };
  const remove = async (q: Q) => { if (!confirm('Delete this question?')) return; const { error } = await supabase.from('quiz_questions').delete().eq('id', q.id); if (error) alert(error.message); else onSaved(); };
  const m = mods.find(x => x.id === mod);
  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center gap-3">
        <select className="input w-96" value={mod} onChange={e => setMod(e.target.value)}>{mods.map(x => <option key={x.id} value={x.id}>{x.title}{x.active ? '' : ' (hidden)'}</option>)}</select>
        {m && <button onClick={() => toggleModule(m)} className="text-sm text-gray-600 underline">{m.active ? 'Hide this part' : 'Show this part'}</button>}
        <button onClick={addModule} className="ml-auto border border-gray-300 px-3 py-2 rounded-lg text-sm font-semibold">New part</button>
        <button onClick={() => setEdit({ id: '', module_id: mod, prompt: '', options: ['', '', '', ''], correct: 0, reference: '', active: true, position: (list[list.length - 1]?.position || 0) + 10 })} className="bg-[#C41E3A] text-white px-3 py-2 rounded-lg text-sm font-semibold flex items-center gap-1"><Plus className="h-4 w-4" /> Question</button>
      </div>
      <div className="mt-3 bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">{list.length ? list.map((q, i) => (
        <div key={q.id} className={`p-3 text-sm ${q.active ? '' : 'text-gray-400'}`}>
          <div className="flex gap-2"><span className="font-semibold">{i + 1}.</span><span className="flex-1">{q.prompt}</span>
            <button onClick={() => setEdit(q)} className="text-xs font-semibold text-[#C41E3A]">Edit</button><button onClick={() => remove(q)} className="text-gray-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button></div>
          <ul className="ml-6 mt-1">{q.options.map((o, j) => <li key={j} className={j === q.correct ? 'text-green-700 font-semibold' : 'text-gray-600'}>{j === q.correct ? '✓ ' : '· '}{o}</li>)}</ul>
          {q.reference && <div className="ml-6 text-xs text-gray-500">Reference: {q.reference}</div>}
        </div>)) : <p className="p-4 text-sm text-gray-500">No questions in this part yet.</p>}</div>
      {edit && <QuestionModal q={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); onSaved(); }} />}
    </div>
  );
};

const QuestionModal: React.FC<{ q: Q; onClose: () => void; onSaved: () => void }> = ({ q, onClose, onSaved }) => {
  const [d, setD] = useState<Q>({ ...q, options: [...q.options] });
  const save = async () => {
    const options = d.options.map(o => o.trim()).filter(Boolean);
    if (!d.prompt.trim() || options.length < 2) { alert('Write the question and at least two answers.'); return; }
    if (d.correct >= options.length) { alert('Choose which answer is correct.'); return; }
    const row = { module_id: d.module_id, prompt: d.prompt.trim(), options, correct: d.correct, reference: d.reference || null, active: d.active, position: d.position };
    const { error } = d.id ? await supabase.from('quiz_questions').update(row).eq('id', d.id)
      : await supabase.from('quiz_questions').insert({ id: `${d.module_id}_${Date.now().toString(36)}`, ...row });
    if (error) alert(error.message); else onSaved();
  };
  return (
    <Modal title={d.id ? 'Edit question' : 'New question'} onClose={onClose}>
      <label className="block text-sm"><span className="text-xs font-semibold text-gray-600">Question</span><textarea rows={2} className="input" value={d.prompt} onChange={e => setD({ ...d, prompt: e.target.value })} /></label>
      <div className="mt-3 text-xs font-semibold text-gray-600">Answers (tick the correct one)</div>
      {d.options.map((o, j) => (
        <div key={j} className="mt-1 flex items-center gap-2"><input type="radio" checked={d.correct === j} onChange={() => setD({ ...d, correct: j })} /><input className="input flex-1" value={o} onChange={e => setD({ ...d, options: d.options.map((x, k) => k === j ? e.target.value : x) })} /></div>))}
      {d.options.length < 6 && <button onClick={() => setD({ ...d, options: [...d.options, ''] })} className="mt-1 text-xs text-[#C41E3A] font-semibold">+ Add answer</button>}
      <label className="block text-sm mt-3"><span className="text-xs font-semibold text-gray-600">Reference shown when answered wrongly (clause / section)</span><input className="input" value={d.reference || ''} onChange={e => setD({ ...d, reference: e.target.value })} /></label>
      <label className="flex items-center gap-2 text-sm mt-3"><input type="checkbox" checked={d.active} onChange={e => setD({ ...d, active: e.target.checked })} /> Active</label>
      <div className="mt-4 flex justify-end"><button onClick={save} className="bg-[#C41E3A] text-white px-4 py-2 rounded-lg text-sm font-semibold">Save</button></div>
    </Modal>
  );
};

export default KnowledgeChecks;
