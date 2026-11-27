import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { LAUNCH_PLAN, phaseOfTitle, weekDate } from '@/lib/launchPlan';
import { Spinner } from './DeclarationsPage';
import { Check, Loader2, Mail, Plus, Trash2, Undo2 } from 'lucide-react';

/** Head Office Obligations: what Head Office owes each franchisee, when, and who does it.
 *  Onboarding = franchisor-owned Process Flow tasks (due by the launch plan weeks).
 *  Recurring = the register in ho_obligations (agreement, manual, G documents). Staff only. */

interface Reg { id: string; title: string; source: string | null; frequency: 'monthly' | 'quarterly' | 'annual' | 'once'; anchor: 'calendar' | 'launch' | 'expiry'; due_day: number | null; due_month: number | null; offset_days: number | null; owner_name: string; auto: 'declaration' | 'contact' | null; active: boolean; position: number; note: string | null }
interface Done { id: number; obligation_id: string; franchisee_id: string; period_key: string; due_on: string | null; done_at: string; done_by: string | null }
interface FrDates { id: string; trading_since: string | null; agreement_expiry: string | null }
interface Item { key: string; kind: 'task' | 'reg'; fid: string; title: string; source: string; owner: string; due: string; period: string; regId?: string; taskId?: string; done: boolean; doneAt?: string; doneBy?: string; auto?: boolean }

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const parse = (s: string) => new Date(s + 'T00:00:00');
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const addYears = (d: Date, n: number) => { const x = new Date(d); x.setFullYear(x.getFullYear() + n); return x; };
const dayOf = (y: number, m: number, day: number) => new Date(y, m, Math.min(day, new Date(y, m + 1, 0).getDate()));
const fmt = (s: string) => parse(s).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
const TODAY = iso(new Date());
const missing = (m: string) => /does not exist|schema cache/i.test(m) ? 'Run supabase/ho_obligations.sql in Supabase first.' : m;

const ObligationsPage: React.FC = () => {
  const { user, users } = useAuth();
  const { franchisees, checklist, progress, toggleTask } = useData();
  const isAdmin = user?.role === 'admin';
  const [tab, setTab] = useState<'todo' | 'franchisee' | 'person' | 'register'>('todo');
  const [reg, setReg] = useState<Reg[]>([]);
  const [done, setDone] = useState<Done[]>([]);
  const [dates, setDates] = useState<FrDates[]>([]);
  const [approved, setApproved] = useState<Set<string>>(new Set());
  const [contacts, setContacts] = useState<Record<string, number>>({});
  const [target, setTarget] = useState(2);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [owner, setOwner] = useState('all');
  const [fr, setFr] = useState('all');
  const [busy, setBusy] = useState('');

  const load = async () => {
    setLoading(true); setErr('');
    const since = iso(addDays(new Date(), -400));
    const [r, d, f, decl, con, set] = await Promise.all([
      supabase.from('ho_obligations').select('*').order('position'),
      supabase.from('ho_obligation_done').select('*').gte('done_at', since),
      supabase.from('franchisees').select('id, trading_since, agreement_expiry'),
      supabase.from('turnover_declarations').select('franchisee_id, period').eq('status', 'approved').gte('period', since),
      supabase.from('franchisee_contacts').select('franchisee_id, contact_at').gte('contact_at', since),
      supabase.from('contact_log_settings').select('min_contacts_per_month').eq('id', 1).maybeSingle(),
    ]);
    if (r.error || d.error || f.error) setErr(missing((r.error || d.error || f.error)!.message));
    setReg((r.data || []) as Reg[]); setDone((d.data || []) as Done[]); setDates((f.data || []) as FrDates[]);
    setApproved(new Set(((decl.data || []) as { franchisee_id: string; period: string }[]).map(x => `${x.franchisee_id}|${x.period.slice(0, 7)}`)));
    const c: Record<string, number> = {};
    ((con.data || []) as { franchisee_id: string; contact_at: string }[]).forEach(x => { const k = `${x.franchisee_id}|${iso(new Date(x.contact_at)).slice(0, 7)}`; c[k] = (c[k] || 0) + 1; });
    setContacts(c); if (set.data) setTarget((set.data as any).min_contacts_per_month);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const active = useMemo(() => franchisees.filter(f => !f.status || f.status === 'active'), [franchisees]);
  const datesOf = (fid: string) => {
    const f = franchisees.find(x => x.id === fid); const d = dates.find(x => x.id === fid);
    const launch = d?.trading_since ? parse(d.trading_since) : f?.startDate ? weekDate(f.startDate, 20) : null;
    const expiry = d?.agreement_expiry ? parse(d.agreement_expiry) : d?.trading_since ? addYears(parse(d.trading_since), 5) : null;
    return { launch, expiry, trading: d?.trading_since || null };
  };

  const items = useMemo<Item[]>(() => {
    const out: Item[] = [];
    const now = new Date(); const horizon = iso(addDays(now, 60)); const back = iso(addDays(now, -365));
    const doneMap = new Map(done.map(x => [`${x.obligation_id}|${x.franchisee_id}|${x.period_key}`, x]));
    for (const f of active) {
      const { launch, expiry, trading } = datesOf(f.id);
      // Onboarding: franchisor tasks, while the franchisee is not yet trading or in its first ~6 months
      const onboarding = !!f.startDate && (!trading || trading >= iso(addDays(now, -200)));
      if (onboarding) {
        for (const s of checklist) {
          const ph = phaseOfTitle(s.title); const stage = LAUNCH_PLAN.find(x => x.phase === ph);
          for (const t of s.tasks) {
            if (t.responsible !== 'franchisor') continue;
            const st = progress[f.id]?.tasks[t.id];
            let due = stage ? weekDate(f.startDate, stage.weeks[1]) : null;
            if (ph === 11 && launch) {
              const m = t.text.match(/(\d+)-day/); const mo = t.text.match(/Month (\d+)/i);
              due = m ? addDays(launch, Number(m[1])) : mo ? addDays(launch, Number(mo[1]) * 30) : /Weeks 1/i.test(t.text) ? addDays(launch, 28) : due;
            }
            if (!due) continue;
            out.push({ key: `task|${f.id}|${t.id}`, kind: 'task', fid: f.id, title: t.text.replace(/\[(GATE|PROOF)\]\s*/g, ''), source: `Process Flow · ${s.title.split('  ')[0]}`,
              owner: 'Onboarding (Head Office)', due: iso(due), period: 'once', taskId: t.id, done: !!st?.completed, doneAt: st?.completedAt, doneBy: st?.completedBy });
          }
        }
      }
      // Recurring: only once the franchisee is trading
      if (!trading) continue;
      for (const r of reg.filter(x => x.active)) {
        const occ: { due: Date; period: string }[] = [];
        if (r.anchor === 'calendar' && r.frequency === 'monthly' && r.due_day) {
          for (let k = -3; k <= 2; k++) { const d = dayOf(now.getFullYear(), now.getMonth() + k, r.due_day); occ.push({ due: d, period: iso(d).slice(0, 7) }); }
        } else if (r.anchor === 'calendar' && r.frequency === 'quarterly' && r.due_day) {
          const q0 = Math.floor(now.getMonth() / 3);
          for (let k = -2; k <= 1; k++) { const d = dayOf(now.getFullYear(), (q0 + k) * 3, r.due_day); occ.push({ due: d, period: `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}` }); }
        } else if (r.anchor === 'calendar' && r.frequency === 'annual' && r.due_day && r.due_month) {
          for (let y = now.getFullYear() - 1; y <= now.getFullYear() + 1; y++) occ.push({ due: dayOf(y, r.due_month - 1, r.due_day), period: String(y) });
        } else if (r.anchor === 'launch' && launch) {
          const first = addDays(launch, r.offset_days || 0);
          if (r.frequency === 'annual') for (let n = 0; n < 40; n++) { const d = addYears(first, n); if (iso(d) > horizon) break; occ.push({ due: d, period: String(d.getFullYear()) }); }
          else occ.push({ due: first, period: 'once' });
        } else if (r.anchor === 'expiry' && expiry) {
          occ.push({ due: addDays(expiry, r.offset_days || 0), period: 'once' });
        }
        for (const o of occ) {
          const due = iso(o.due);
          if (due > horizon || due < back || due < trading) continue;
          const rec = doneMap.get(`${r.id}|${f.id}|${o.period}`);
          let auto = false;
          if (r.auto === 'declaration') { const prev = new Date(o.due.getFullYear(), o.due.getMonth() - 1, 1); auto = approved.has(`${f.id}|${iso(prev).slice(0, 7)}`); }
          if (r.auto === 'contact') auto = (contacts[`${f.id}|${o.period}`] || 0) >= target;
          out.push({ key: `reg|${r.id}|${f.id}|${o.period}`, kind: 'reg', fid: f.id, title: r.title, source: r.source || '', owner: r.owner_name, due, period: o.period, regId: r.id,
            done: !!rec || auto, doneAt: rec?.done_at, doneBy: rec?.done_by || (auto ? 'automatic' : undefined), auto });
        }
      }
    }
    return out.sort((a, b) => a.due.localeCompare(b.due));
  }, [active, checklist, progress, reg, done, dates, approved, contacts, target]);

  const name = (fid: string) => franchisees.find(f => f.id === fid)?.name || fid;
  const owners = [...new Set(items.map(i => i.owner))].sort();
  const open = items.filter(i => !i.done && (owner === 'all' || i.owner === owner) && (fr === 'all' || i.fid === fr));
  const week = iso(addDays(new Date(), 7)); const month = iso(addDays(new Date(), 30));
  const groups: [string, Item[]][] = [
    ['Overdue', open.filter(i => i.due < TODAY)],
    ['Due in the next 7 days', open.filter(i => i.due >= TODAY && i.due <= week)],
    ['Due in the next 30 days', open.filter(i => i.due > week && i.due <= month)],
  ];

  const markDone = async (i: Item) => {
    setBusy(i.key);
    if (i.kind === 'task') await toggleTask(i.fid, i.taskId!, user?.name || '');
    else {
      const { error } = await supabase.from('ho_obligation_done').insert({ obligation_id: i.regId, franchisee_id: i.fid, period_key: i.period, due_on: i.due, done_by: user?.name || null });
      if (error) alert(error.message);
    }
    setBusy(''); load();
  };
  const undo = async (i: Item) => {
    const rec = done.find(x => x.obligation_id === i.regId && x.franchisee_id === i.fid && x.period_key === i.period);
    if (!rec) return;
    const { error } = await supabase.from('ho_obligation_done').delete().eq('id', rec.id);
    if (error) alert(error.message); else load();
  };

  const digest = async () => {
    const soon = iso(addDays(new Date(), 7));
    const byOwner = new Map<string, Item[]>();
    items.filter(i => !i.done && i.due <= soon).forEach(i => byOwner.set(i.owner, [...(byOwner.get(i.owner) || []), i]));
    const staff = users.filter(u => u.role === 'admin' || u.role === 'sales');
    const sent: string[] = []; const noLogin: string[] = [];
    for (const [o, list] of byOwner) {
      const names = o.split(/[\/,&]| and /i).map(s => s.trim().toLowerCase()).filter(Boolean);
      let recips = staff.filter(u => names.some(n => u.name.toLowerCase().startsWith(n)));
      if (!recips.length) recips = staff.filter(u => u.role === 'admin');
      if (!staff.some(u => names.some(n => u.name.toLowerCase().startsWith(n)))) noLogin.push(o);
      const text = list.map(i => `${i.due < TODAY ? 'OVERDUE ' : ''}${fmt(i.due)} · ${name(i.fid)} · ${i.title}`).join('\n');
      for (const u of recips) {
        await supabase.functions.invoke('send-notification', { body: { event_type: 'obligations_digest', recipient_email: u.email, recipient_user_id: u.id, recipient_name: u.name,
          variables: { recipient_name: u.name.split(' ')[0], app_url: window.location.origin, items: `${o}:\n${text}`, overdue: String(list.filter(i => i.due < TODAY).length), due_soon: String(list.filter(i => i.due >= TODAY).length) } } }).catch(() => {});
        sent.push(`${u.name} (${o})`);
      }
    }
    alert(sent.length ? `Sent to: ${sent.join(', ')}${noLogin.length ? `\n\nNo portal login matches "${noLogin.join('", "')}", so admins got those lists.` : ''}` : 'Nothing overdue or due in the next 7 days.');
  };

  const Row: React.FC<{ i: Item; showFr?: boolean }> = ({ i, showFr = true }) => (
    <div className={`flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm ${i.done ? 'text-gray-400' : ''}`}>
      <span className={`w-28 whitespace-nowrap ${!i.done && i.due < TODAY ? 'text-red-700 font-semibold' : ''}`}>{fmt(i.due)}</span>
      {showFr && <span className="w-44 font-medium truncate">{name(i.fid)}</span>}
      <span className="flex-1 min-w-[220px]">{i.title}<span className="block text-xs text-gray-500">{i.source}</span></span>
      <span className="w-40 text-xs text-gray-600">{i.owner}</span>
      {i.done ? <span className="text-xs flex items-center gap-1"><Check className="h-3.5 w-3.5 text-green-600" />{i.doneBy || 'done'}{i.kind === 'reg' && !i.auto && <button onClick={() => undo(i)} title="Undo" className="ml-1 text-gray-400 hover:text-gray-700"><Undo2 className="h-3.5 w-3.5" /></button>}</span>
        : i.auto ? <span className="text-xs text-gray-500">ticks itself</span>
        : <button onClick={() => markDone(i)} disabled={busy === i.key} className="text-xs font-semibold text-green-700 border border-green-200 rounded-lg px-2.5 py-1 flex items-center gap-1">{busy === i.key ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Done</button>}
    </div>
  );

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-3xl font-bold text-gray-900">Head Office Obligations</h1>
          <p className="text-gray-600 mt-1">What Head Office owes each franchisee, when, and who does it. Onboarding tasks come from the Process Flow; recurring ones from the register.</p></div>
        <button onClick={digest} className="border border-gray-300 px-3 py-2 rounded-lg text-sm font-semibold flex items-center gap-2"><Mail className="h-4 w-4" /> Email each owner their list</button>
      </div>
      <div className="mt-4 flex gap-2 border-b border-gray-200">
        {([['todo', 'To do'], ['franchisee', 'By franchisee'], ['person', 'By person'], ...(isAdmin ? [['register', 'Register']] : [])] as [typeof tab, string][]).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px ${tab === k ? 'border-[#C41E3A] text-[#C41E3A]' : 'border-transparent text-gray-500'}`}>{l}</button>))}
      </div>
      {err && <p className="mt-4 text-red-700">{err}</p>}
      {loading ? <Spinner /> : tab === 'todo' ? (
        <div className="mt-4 space-y-5">
          <div className="flex flex-wrap gap-3 text-sm">
            <select className="input w-56" value={owner} onChange={e => setOwner(e.target.value)}><option value="all">Everyone</option>{owners.map(o => <option key={o}>{o}</option>)}</select>
            <select className="input w-64" value={fr} onChange={e => setFr(e.target.value)}><option value="all">All franchisees</option>{active.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select>
          </div>
          {groups.map(([label, list]) => (
            <div key={label}>
              <h2 className={`text-sm font-bold uppercase tracking-wider mb-2 ${label === 'Overdue' ? 'text-red-700' : 'text-gray-500'}`}>{label} ({list.length})</h2>
              <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">{list.length ? list.map(i => <Row key={i.key} i={i} />) : <p className="px-4 py-3 text-sm text-gray-500">Nothing.</p>}</div>
            </div>))}
          <p className="text-xs text-gray-500">Recurring obligations start once a franchisee has a "trading since" date (Declarations › Royalty & levy rates). Onboarding tasks need a start date on the franchisee.</p>
        </div>
      ) : tab === 'franchisee' ? (
        <ByFranchisee items={items} active={active} datesOf={datesOf} dates={dates} isAdmin={isAdmin} onSaved={load} Row={Row} />
      ) : tab === 'person' ? (
        <div className="mt-4 bg-white border border-gray-200 rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase"><tr><th className="text-left px-4 py-3">Owner</th><th className="px-3 py-3">Overdue</th><th className="px-3 py-3">Due next 7 days</th><th className="px-3 py-3">Done (last 90 days)</th><th className="px-3 py-3">On time</th></tr></thead>
            <tbody>{owners.map(o => {
              const mine = items.filter(i => i.owner === o);
              const recent = mine.filter(i => i.done && i.doneAt && i.doneAt.slice(0, 10) >= iso(addDays(new Date(), -90)));
              const onTime = recent.filter(i => i.doneAt!.slice(0, 10) <= i.due).length;
              return (<tr key={o} className="border-t border-gray-100 text-center"><td className="px-4 py-2 text-left font-medium">{o}</td>
                <td className={mine.some(i => !i.done && i.due < TODAY) ? 'text-red-700 font-semibold' : ''}>{mine.filter(i => !i.done && i.due < TODAY).length}</td>
                <td>{mine.filter(i => !i.done && i.due >= TODAY && i.due <= week).length}</td><td>{recent.length}</td>
                <td>{recent.length ? `${Math.round(100 * onTime / recent.length)}%` : '—'}</td></tr>);
            })}</tbody>
          </table>
        </div>
      ) : <RegisterEditor reg={reg} onSaved={load} />}
    </div>
  );
};

const ByFranchisee: React.FC<{ items: Item[]; active: { id: string; name: string }[]; datesOf: (id: string) => { launch: Date | null; expiry: Date | null; trading: string | null }; dates: FrDates[]; isAdmin: boolean; onSaved: () => void; Row: React.FC<{ i: Item; showFr?: boolean }> }> = ({ items, active, datesOf, dates, isAdmin, onSaved, Row }) => {
  const [openId, setOpenId] = useState<string | null>(null);
  const saveExpiry = async (id: string, v: string) => {
    const { error } = await supabase.from('franchisees').update({ agreement_expiry: v || null }).eq('id', id);
    if (error) alert(error.message); else onSaved();
  };
  return (
    <div className="mt-4 bg-white border border-gray-200 rounded-xl overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-gray-600 text-xs uppercase"><tr><th className="text-left px-4 py-3">Franchisee</th><th className="text-left px-3 py-3">Launch / trading since</th><th className="text-left px-3 py-3">Agreement expires</th><th className="px-3 py-3">Open</th><th className="px-3 py-3">Overdue</th><th className="text-left px-3 py-3">Next due</th></tr></thead>
        <tbody>{active.map(f => {
          const mine = items.filter(i => i.fid === f.id); const open = mine.filter(i => !i.done);
          const next = open.find(i => i.due >= TODAY); const d = datesOf(f.id);
          return (<React.Fragment key={f.id}>
            <tr className="border-t border-gray-100 cursor-pointer hover:bg-gray-50" onClick={() => setOpenId(openId === f.id ? null : f.id)}>
              <td className="px-4 py-2 font-medium">{f.name}</td>
              <td className="px-3 py-2">{d.launch ? `${iso(d.launch) === d.trading ? '' : 'planned '}${fmt(iso(d.launch))}` : '—'}</td>
              <td className="px-3 py-2" onClick={e => e.stopPropagation()}>{isAdmin
                ? <input type="date" className="input w-40" defaultValue={dates.find(x => x.id === f.id)?.agreement_expiry || ''} placeholder={d.expiry ? iso(d.expiry) : ''} onBlur={e => saveExpiry(f.id, e.target.value)} title={d.expiry ? `Without a date: ${fmt(iso(d.expiry))} (trading since + 5 years)` : 'Set trading since or an expiry date'} />
                : d.expiry ? fmt(iso(d.expiry)) : '—'}</td>
              <td className="px-3 py-2 text-center">{open.length}</td>
              <td className={`px-3 py-2 text-center ${open.some(i => i.due < TODAY) ? 'text-red-700 font-semibold' : ''}`}>{open.filter(i => i.due < TODAY).length}</td>
              <td className="px-3 py-2">{next ? `${fmt(next.due)} · ${next.title.slice(0, 50)}` : '—'}</td>
            </tr>
            {openId === f.id && <tr><td colSpan={6} className="bg-gray-50"><div className="divide-y divide-gray-100">{mine.length ? mine.map(i => <Row key={i.key} i={i} showFr={false} />) : <p className="px-4 py-3 text-gray-500">No obligations in the window (last year to the next 60 days).</p>}</div></td></tr>}
          </React.Fragment>);
        })}</tbody>
      </table>
    </div>
  );
};

const RegisterEditor: React.FC<{ reg: Reg[]; onSaved: () => void }> = ({ reg, onSaved }) => {
  const [dirty, setDirty] = useState<Record<string, Partial<Reg>>>({});
  const [busy, setBusy] = useState(false);
  const v = (r: Reg, k: keyof Reg) => (dirty[r.id] && k in dirty[r.id] ? (dirty[r.id] as any)[k] : (r as any)[k]) ?? '';
  const set = (id: string, k: keyof Reg, val: any) => setDirty(d => ({ ...d, [id]: { ...d[id], [k]: val } }));
  const num = (x: any) => (x === '' || x === null || x === undefined ? null : Number(x));
  const saveAll = async () => {
    setBusy(true);
    for (const [id, p] of Object.entries(dirty)) {
      const patch: any = { ...p };
      for (const k of ['due_day', 'due_month', 'offset_days', 'position'] as const) if (k in patch) patch[k] = num(patch[k]);
      const { error } = await supabase.from('ho_obligations').update(patch).eq('id', id);
      if (error) { alert(error.message); break; }
    }
    setBusy(false); setDirty({}); onSaved();
  };
  const add = async () => {
    const id = 'x_' + Date.now().toString(36);
    const { error } = await supabase.from('ho_obligations').insert({ id, title: 'New obligation', frequency: 'monthly', anchor: 'calendar', due_day: 15, owner_name: 'Head Office', position: (reg[reg.length - 1]?.position || 0) + 10 });
    if (error) alert(error.message); else onSaved();
  };
  const remove = async (r: Reg) => {
    if (!confirm(`Delete "${r.title}"? (To stop it for now, untick Active instead.)`)) return;
    const { error } = await supabase.from('ho_obligations').delete().eq('id', r.id);
    if (error) alert(error.message); else onSaved();
  };
  return (
    <div className="mt-4">
      <p className="text-sm text-gray-600 mb-3"><b>Calendar</b>: monthly / quarterly use "Day"; annual uses "Day" and "Month". <b>Launch</b>: days after launch (annual repeats every year). <b>Expiry</b>: days before (negative) or after the agreement expiry.</p>
      <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 text-xs uppercase"><tr><th className="px-2 py-2 text-left">Obligation</th><th className="px-2 py-2 text-left">Source</th><th className="px-2 py-2">How often</th><th className="px-2 py-2">From</th><th className="px-2 py-2">Day</th><th className="px-2 py-2">Month</th><th className="px-2 py-2">Days ±</th><th className="px-2 py-2 text-left">Owner</th><th className="px-2 py-2">Active</th><th></th></tr></thead>
          <tbody>{reg.map(r => (
            <tr key={r.id} className="border-t border-gray-100">
              <td className="px-2 py-1"><input className="input min-w-[260px]" value={v(r, 'title')} onChange={e => set(r.id, 'title', e.target.value)} /></td>
              <td className="px-2 py-1"><input className="input w-40" value={v(r, 'source')} onChange={e => set(r.id, 'source', e.target.value)} /></td>
              <td className="px-2 py-1"><select className="input w-28" value={v(r, 'frequency')} onChange={e => set(r.id, 'frequency', e.target.value)}><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="annual">Annual</option><option value="once">Once</option></select></td>
              <td className="px-2 py-1"><select className="input w-28" value={v(r, 'anchor')} onChange={e => set(r.id, 'anchor', e.target.value)}><option value="calendar">Calendar</option><option value="launch">Launch</option><option value="expiry">Expiry</option></select></td>
              <td className="px-2 py-1"><input type="number" min={1} max={31} className="input w-16" value={v(r, 'due_day')} onChange={e => set(r.id, 'due_day', e.target.value)} /></td>
              <td className="px-2 py-1"><input type="number" min={1} max={12} className="input w-16" value={v(r, 'due_month')} onChange={e => set(r.id, 'due_month', e.target.value)} /></td>
              <td className="px-2 py-1"><input type="number" className="input w-20" value={v(r, 'offset_days')} onChange={e => set(r.id, 'offset_days', e.target.value)} /></td>
              <td className="px-2 py-1"><input className="input w-32" value={v(r, 'owner_name')} onChange={e => set(r.id, 'owner_name', e.target.value)} /></td>
              <td className="px-2 py-1 text-center"><input type="checkbox" checked={!!v(r, 'active')} onChange={e => set(r.id, 'active', e.target.checked)} /></td>
              <td className="px-2 py-1"><button onClick={() => remove(r)} className="text-gray-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button></td>
            </tr>))}</tbody>
        </table>
      </div>
      <div className="mt-3 flex justify-between">
        <button onClick={add} className="border border-gray-300 px-3 py-2 rounded-lg text-sm font-semibold flex items-center gap-1"><Plus className="h-4 w-4" /> Add obligation</button>
        <button onClick={saveAll} disabled={busy || !Object.keys(dirty).length} className="bg-[#C41E3A] text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50 flex items-center gap-2">{busy && <Loader2 className="h-4 w-4 animate-spin" />} Save changes</button>
      </div>
    </div>
  );
};

export default ObligationsPage;
