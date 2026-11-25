import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import {
  Declaration, DeclLine, FranchiseeRates, DECL_STATUS, DUE_DAY, monthKey, shiftMonth, monthName, dueDate, isOverdue,
  rands, pct, missingTable, notifyStaff,
} from '@/lib/franchiseePortal';
import { ChevronLeft, ChevronRight, Loader2, X, Plus, Trash2, Check, MessageSquareWarning, Save, Send } from 'lucide-react';

const thisMonth = () => monthKey(new Date());

/** Monthly turnover declarations. Franchisee: declare own months. Head Office: review every franchisee, set rates. */
const DeclarationsPage: React.FC = () => {
  const { user } = useAuth();
  return user?.role === 'franchisee'
    ? (user.franchiseeId ? <FranchiseeView franchiseeId={user.franchiseeId} /> : <NoRecord />)
    : <StaffView />;
};

const NoRecord = () => <div className="p-8 text-gray-500">No franchise record is linked to your account yet. Please contact Head Office.</div>;

// ---------------------------------------------------------------- franchisee
const FranchiseeView: React.FC<{ franchiseeId: string }> = ({ franchiseeId }) => {
  const [rates, setRates] = useState<FranchiseeRates | null>(null);
  const [decls, setDecls] = useState<Declaration[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [open, setOpen] = useState<string | null>(null);

  const load = async () => {
    setLoading(true); setErr('');
    const [f, d] = await Promise.all([
      supabase.from('franchisees').select('*').eq('id', franchiseeId).maybeSingle(),
      supabase.from('turnover_declarations').select('*').eq('franchisee_id', franchiseeId).order('period', { ascending: false }),
    ]);
    if (d.error) setErr(missingTable(d.error.message) ? 'Declarations are not switched on yet. Please contact Head Office.' : d.error.message);
    setRates(f.data as FranchiseeRates);
    setDecls((d.data || []) as Declaration[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, [franchiseeId]);

  // Current month plus the previous 12, and any older month that has a declaration
  const months = useMemo(() => {
    const out: string[] = [];
    for (let i = 0; i <= 12; i++) out.push(shiftMonth(thisMonth(), -i));
    decls.forEach(d => { if (!out.includes(d.period)) out.push(d.period); });
    const start = rates?.trading_since ? monthKey(new Date(rates.trading_since + 'T00:00:00')) : null;
    return out.filter(m => !start || m >= start).sort().reverse();
  }, [decls, rates]);

  const byMonth = new Map(decls.map(d => [d.period, d]));
  const prevMonth = shiftMonth(thisMonth(), -1);
  const prevDue = !byMonth.get(prevMonth) || ['draft', 'queried'].includes(byMonth.get(prevMonth)!.status);

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900">Turnover Declarations</h1>
      <p className="text-gray-600 mt-1">Declare your turnover (excluding VAT) and number of jobs for each month by the {DUE_DAY}th of the following month. Royalty and marketing levy are calculated for you.</p>

      {rates && (
        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <span className="px-3 py-1.5 rounded-lg bg-gray-100">Royalty: <b>{pct(rates.royalty_pct)}</b></span>
          <span className="px-3 py-1.5 rounded-lg bg-gray-100">Marketing levy: <b>{pct(rates.marketing_levy_pct)}</b></span>
          {(rates.royalty_pct === null || rates.marketing_levy_pct === null) && <span className="text-amber-700">Head Office still needs to load your rates; you can declare in the meantime.</span>}
        </div>
      )}

      {prevDue && !loading && !err && (
        <div className="mt-4 p-4 rounded-xl border border-[#C41E3A]/30 bg-red-50 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-gray-800"><b>{monthName(prevMonth)}</b> is due by {dueDate(prevMonth).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long' })}.</div>
          <button onClick={() => setOpen(prevMonth)} className="bg-[#C41E3A] text-white px-4 py-2 rounded-lg text-sm font-semibold">Declare {monthName(prevMonth)}</button>
        </div>
      )}

      {err && <p className="mt-4 text-red-700">{err}</p>}
      {loading ? <Spinner /> : !err && (
        <div className="mt-6 bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
              <tr><th className="text-left px-4 py-3">Month</th><th className="text-left px-4 py-3">Status</th><th className="text-right px-4 py-3">Turnover</th><th className="text-right px-4 py-3">Jobs</th><th className="text-right px-4 py-3 hidden md:table-cell">Royalty</th><th className="text-right px-4 py-3 hidden md:table-cell">Levy</th><th></th></tr>
            </thead>
            <tbody>
              {months.map(m => {
                const d = byMonth.get(m);
                const st = d ? (isOverdue(m, d) ? 'overdue' : d.status) : (isOverdue(m, null) ? 'overdue' : 'none');
                const editable = !d || d.status === 'draft' || d.status === 'queried';
                return (
                  <tr key={m} className="border-t border-gray-100">
                    <td className="px-4 py-3 font-medium">{monthName(m)}{m === thisMonth() && <span className="text-xs text-gray-500"> (this month)</span>}</td>
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${DECL_STATUS[st].cls}`}>{DECL_STATUS[st].label}</span></td>
                    <td className="px-4 py-3 text-right">{d ? rands(d.turnover_excl) : ''}</td>
                    <td className="px-4 py-3 text-right">{d ? d.jobs : ''}</td>
                    <td className="px-4 py-3 text-right hidden md:table-cell">{d ? rands(d.royalty_amount, true) : ''}</td>
                    <td className="px-4 py-3 text-right hidden md:table-cell">{d ? rands(d.levy_amount, true) : ''}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => setOpen(m)} className="text-[#C41E3A] font-semibold hover:underline">{editable ? (d ? 'Edit' : 'Declare') : 'View'}</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {open && rates && (
        <DeclarationModal period={open} franchisee={rates} existing={byMonth.get(open) || null}
          onClose={() => setOpen(null)} onSaved={() => { setOpen(null); load(); }} />
      )}
    </div>
  );
};

// ---------------------------------------------------------------- form
const DeclarationModal: React.FC<{
  period: string; franchisee: FranchiseeRates; existing: Declaration | null; onClose: () => void; onSaved: () => void; staff?: boolean;
}> = ({ period, franchisee, existing, onClose, onSaved, staff }) => {
  const { user } = useAuth();
  const { divisions } = useData();
  const divNames = divisions.map(d => d.name);
  const startLines: DeclLine[] = existing?.lines?.length
    ? existing.lines
    : [{ division: franchisee.division || divNames[0] || 'Drain Surgeon', turnover_excl: '', jobs: '' }];
  const [lines, setLines] = useState<DeclLine[]>(startLines);
  const [notes, setNotes] = useState(existing?.notes || '');
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const editable = !existing || existing.status === 'draft' || existing.status === 'queried' || !!staff;

  const num = (v: number | '') => (v === '' ? 0 : Number(v));
  const turnover = lines.reduce((s, l) => s + Math.max(0, num(l.turnover_excl)), 0);
  const jobs = lines.reduce((s, l) => s + Math.max(0, num(l.jobs)), 0);
  const rPct = existing && existing.status !== 'draft' ? existing.royalty_pct : franchisee.royalty_pct;
  const lPct = existing && existing.status !== 'draft' ? existing.marketing_levy_pct : franchisee.marketing_levy_pct;
  const royalty = rPct === null ? null : Math.round(turnover * rPct) / 100;
  const levy = lPct === null ? null : Math.round(turnover * lPct) / 100;
  const unused = divNames.filter(n => !lines.some(l => l.division === n));

  const save = async (submit: boolean) => {
    setErr('');
    const clean = lines.map(l => ({ division: l.division, turnover_excl: num(l.turnover_excl), jobs: Math.round(num(l.jobs)) }));
    if (submit) {
      if (clean.some(l => l.turnover_excl < 0 || l.jobs < 0)) { setErr('Amounts cannot be negative.'); return; }
      if (clean.some(l => lines.find(x => x.division === l.division)?.turnover_excl === '')) { setErr('Fill in the turnover for every division (0 if there was none).'); return; }
      if (!confirm(`Submit ${monthName(period)}: turnover ${rands(turnover)} excl. VAT and ${jobs} jobs?\n\nYou cannot change it after submitting.`)) return;
    }
    setBusy(submit ? 'submit' : 'save');
    const status = staff && existing && existing.status !== 'draft' ? existing.status : submit ? 'submitted' : 'draft';
    const row: any = { franchisee_id: franchisee.id, period, lines: clean, notes: notes || null, status };
    if (submit) row.submitted_by = user?.name || null;
    const res = existing
      ? await supabase.from('turnover_declarations').update(row).eq('id', existing.id).select().single()
      : await supabase.from('turnover_declarations').insert(row).select().single();
    setBusy('');
    if (res.error) { setErr(res.error.message); return; }
    if (submit && !staff) {
      const d = res.data as Declaration;
      notifyStaff('declaration_submitted', {
        franchisee_name: franchisee.name, period: monthName(period), turnover: rands(d.turnover_excl),
        jobs: String(d.jobs), royalty: rands(d.royalty_amount, true), levy: rands(d.levy_amount, true),
      });
    }
    onSaved();
  };

  return (
    <Modal title={`${monthName(period)} – ${franchisee.name}`} onClose={onClose}>
      {existing?.status === 'queried' && existing.review_note && (
        <div className="mb-4 p-3 rounded-lg bg-orange-50 text-orange-900 text-sm"><b>Head Office query:</b> {existing.review_note}</div>
      )}
      <div className="space-y-3">
        {lines.map((l, i) => (
          <div key={i} className="grid grid-cols-12 gap-2 items-end">
            <div className="col-span-12 sm:col-span-5">
              <label className="text-xs font-semibold text-gray-600">Division</label>
              <select disabled={!editable} value={l.division} onChange={e => setLines(ls => ls.map((x, j) => j === i ? { ...x, division: e.target.value } : x))} className="input">
                {[l.division, ...unused].map(n => <option key={n}>{n}</option>)}
              </select>
            </div>
            <div className="col-span-6 sm:col-span-4">
              <label className="text-xs font-semibold text-gray-600">Turnover excl. VAT (R)</label>
              <input disabled={!editable} type="number" min={0} step="0.01" inputMode="decimal" value={l.turnover_excl} onChange={e => setLines(ls => ls.map((x, j) => j === i ? { ...x, turnover_excl: e.target.value === '' ? '' : Number(e.target.value) } : x))} className="input" />
            </div>
            <div className="col-span-4 sm:col-span-2">
              <label className="text-xs font-semibold text-gray-600">Jobs</label>
              <input disabled={!editable} type="number" min={0} step="1" inputMode="numeric" value={l.jobs} onChange={e => setLines(ls => ls.map((x, j) => j === i ? { ...x, jobs: e.target.value === '' ? '' : Number(e.target.value) } : x))} className="input" />
            </div>
            <div className="col-span-2 sm:col-span-1 pb-2">
              {editable && lines.length > 1 && <button onClick={() => setLines(ls => ls.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>}
            </div>
          </div>
        ))}
        {editable && unused.length > 0 && (
          <button onClick={() => setLines(ls => [...ls, { division: unused[0], turnover_excl: '', jobs: '' }])} className="text-sm text-[#C41E3A] font-semibold flex items-center gap-1"><Plus className="h-4 w-4" /> Add another division</button>
        )}
        <div>
          <label className="text-xs font-semibold text-gray-600">Notes for Head Office (optional)</label>
          <textarea disabled={!editable} value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="input" />
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        <Stat label="Turnover excl. VAT" value={rands(turnover, true)} />
        <Stat label="Jobs" value={String(jobs)} />
        <Stat label={`Royalty (${pct(rPct)})`} value={royalty === null ? '—' : rands(royalty, true)} />
        <Stat label={`Marketing levy (${pct(lPct)})`} value={levy === null ? '—' : rands(levy, true)} />
      </div>
      <p className="text-xs text-gray-500 mt-2">Royalty and levy exclude VAT. Head Office invoices them. Average job value: {jobs ? rands(turnover / jobs) : '—'}.</p>

      {err && <p className="text-sm text-red-700 mt-3">{err}</p>}
      {editable && (
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          {!staff && <button onClick={() => save(false)} disabled={!!busy} className="border border-gray-300 px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2">{busy === 'save' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save draft</button>}
          <button onClick={() => save(!staff || !existing || existing.status === 'draft')} disabled={!!busy} className="bg-[#C41E3A] text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2">{busy === 'submit' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} {staff && existing && existing.status !== 'draft' ? 'Save changes' : 'Submit'}</button>
        </div>
      )}
      {!editable && existing && (
        <p className="mt-4 text-sm text-gray-600">Submitted {existing.submitted_at ? new Date(existing.submitted_at).toLocaleString('en-ZA') : ''}{existing.submitted_by ? ` by ${existing.submitted_by}` : ''}. To change it, contact Head Office.</p>
      )}
    </Modal>
  );
};

// ---------------------------------------------------------------- Head Office
const StaffView: React.FC = () => {
  const { user } = useAuth();
  const [tab, setTab] = useState<'month' | 'rates'>('month');
  const [month, setMonth] = useState(shiftMonth(thisMonth(), -1));
  const [fr, setFr] = useState<FranchiseeRates[]>([]);
  const [decls, setDecls] = useState<Declaration[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [open, setOpen] = useState<{ f: FranchiseeRates; d: Declaration | null } | null>(null);
  const [hideCompany, setHideCompany] = useState(true);

  const load = async () => {
    setLoading(true); setErr('');
    const [f, d] = await Promise.all([
      supabase.from('franchisees').select('*').order('name'),
      supabase.from('turnover_declarations').select('*').eq('period', month),
    ]);
    const e = f.error || d.error;
    if (e) setErr(missingTable(e.message) || /royalty_pct/.test(e.message) ? 'Run supabase/franchisee_portal.sql in Supabase first.' : e.message);
    setFr((f.data || []) as FranchiseeRates[]);
    setDecls((d.data || []) as Declaration[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, [month]);

  const byF = new Map(decls.map(d => [d.franchisee_id, d]));
  const rows = fr.filter(f => !hideCompany || !/company|plan two/i.test(`${f.status} ${f.name}`));
  const totals = decls.filter(d => d.status === 'submitted' || d.status === 'approved')
    .reduce((s, d) => ({ t: s.t + Number(d.turnover_excl), j: s.j + d.jobs, r: s.r + Number(d.royalty_amount), l: s.l + Number(d.levy_amount) }), { t: 0, j: 0, r: 0, l: 0 });

  const review = async (d: Declaration, status: 'approved' | 'queried') => {
    let note: string | null = null;
    if (status === 'queried') { note = prompt('What needs to be corrected? The franchisee will see this.') || null; if (!note) return; }
    const { error } = await supabase.from('turnover_declarations').update({ status, review_note: note, reviewed_by: user?.name || null, reviewed_at: new Date().toISOString() }).eq('id', d.id);
    if (error) alert(error.message); else load();
  };

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900">Turnover Declarations</h1>
      <div className="mt-4 flex gap-2 border-b border-gray-200">
        {(['month', 'rates'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px ${tab === t ? 'border-[#C41E3A] text-[#C41E3A]' : 'border-transparent text-gray-500'}`}>{t === 'month' ? 'By month' : 'Royalty & levy rates'}</button>
        ))}
      </div>
      {err && <p className="mt-4 text-red-700">{err}</p>}

      {tab === 'month' && (
        <>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button onClick={() => setMonth(m => shiftMonth(m, -1))} className="p-2 rounded-lg border border-gray-200"><ChevronLeft className="h-4 w-4" /></button>
            <div className="text-lg font-bold min-w-[170px] text-center">{monthName(month)}</div>
            <button onClick={() => setMonth(m => shiftMonth(m, 1))} disabled={month >= thisMonth()} className="p-2 rounded-lg border border-gray-200 disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
            <span className="text-sm text-gray-500">Due {dueDate(month).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
            <label className="ml-auto text-sm text-gray-600 flex items-center gap-2"><input type="checkbox" checked={hideCompany} onChange={e => setHideCompany(e.target.checked)} /> Hide company-owned</label>
          </div>
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Turnover declared" value={rands(totals.t)} />
            <Stat label="Jobs" value={String(totals.j)} />
            <Stat label="Royalties" value={rands(totals.r)} />
            <Stat label="Marketing levies" value={rands(totals.l)} />
          </div>
          {loading ? <Spinner /> : (
            <div className="mt-5 bg-white border border-gray-200 rounded-xl overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
                  <tr><th className="text-left px-4 py-3">Franchisee</th><th className="text-left px-4 py-3">Status</th><th className="text-right px-4 py-3">Turnover</th><th className="text-right px-4 py-3">Jobs</th><th className="text-right px-4 py-3">Royalty</th><th className="text-right px-4 py-3">Levy</th><th className="text-right px-4 py-3">Actions</th></tr>
                </thead>
                <tbody>
                  {rows.map(f => {
                    const d = byF.get(f.id) || null;
                    const st = d ? (isOverdue(month, d) ? 'overdue' : d.status) : (isOverdue(month, null) ? 'overdue' : 'none');
                    return (
                      <tr key={f.id} className="border-t border-gray-100">
                        <td className="px-4 py-3"><div className="font-medium">{f.name}</div><div className="text-xs text-gray-500">{f.territory}</div></td>
                        <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${DECL_STATUS[st].cls}`}>{DECL_STATUS[st].label}</span></td>
                        <td className="px-4 py-3 text-right">{d ? rands(d.turnover_excl) : ''}</td>
                        <td className="px-4 py-3 text-right">{d ? d.jobs : ''}</td>
                        <td className="px-4 py-3 text-right">{d ? rands(d.royalty_amount, true) : ''}</td>
                        <td className="px-4 py-3 text-right">{d ? rands(d.levy_amount, true) : ''}</td>
                        <td className="px-4 py-3 text-right whitespace-nowrap space-x-2">
                          <button onClick={() => setOpen({ f, d })} className="text-[#C41E3A] font-semibold hover:underline">{d ? 'Open' : 'Enter for them'}</button>
                          {d && d.status === 'submitted' && <>
                            <button onClick={() => review(d, 'approved')} title="Approve" className="inline-flex items-center gap-1 text-green-700 font-semibold"><Check className="h-4 w-4" />Approve</button>
                            <button onClick={() => review(d, 'queried')} title="Query" className="inline-flex items-center gap-1 text-orange-700 font-semibold"><MessageSquareWarning className="h-4 w-4" />Query</button>
                          </>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {tab === 'rates' && <RatesTab franchisees={fr} onSaved={load} />}

      {open && <DeclarationModal staff period={month} franchisee={open.f} existing={open.d} onClose={() => setOpen(null)} onSaved={() => { setOpen(null); load(); }} />}
    </div>
  );
};

const RatesTab: React.FC<{ franchisees: FranchiseeRates[]; onSaved: () => void }> = ({ franchisees, onSaved }) => {
  const [edits, setEdits] = useState<Record<string, Partial<FranchiseeRates>>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const val = (f: FranchiseeRates, k: keyof FranchiseeRates) => (edits[f.id] && k in edits[f.id] ? (edits[f.id] as any)[k] : (f as any)[k]) ?? '';
  const set = (id: string, k: keyof FranchiseeRates, v: any) => setEdits(e => ({ ...e, [id]: { ...e[id], [k]: v } }));
  const save = async () => {
    setBusy(true); setMsg('');
    for (const [id, p] of Object.entries(edits)) {
      const patch: any = {};
      if ('royalty_pct' in p) patch.royalty_pct = p.royalty_pct === '' as any ? null : Number(p.royalty_pct);
      if ('marketing_levy_pct' in p) patch.marketing_levy_pct = p.marketing_levy_pct === '' as any ? null : Number(p.marketing_levy_pct);
      if ('trading_since' in p) patch.trading_since = p.trading_since || null;
      const { error } = await supabase.from('franchisees').update(patch).eq('id', id);
      if (error) { setMsg(error.message); setBusy(false); return; }
    }
    setBusy(false); setEdits({}); setMsg('Saved.'); onSaved();
  };
  return (
    <div className="mt-5">
      <p className="text-sm text-gray-600 mb-3">Rates from each franchisee's agreement. A declaration keeps the rate it was submitted with, so changing a rate here only affects new declarations. "Trading since" hides earlier months from the franchisee's declaration list.</p>
      <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 text-xs uppercase"><tr><th className="text-left px-4 py-3">Franchisee</th><th className="px-4 py-3">Royalty %</th><th className="px-4 py-3">Marketing levy %</th><th className="px-4 py-3">Trading since</th></tr></thead>
          <tbody>
            {franchisees.map(f => (
              <tr key={f.id} className="border-t border-gray-100">
                <td className="px-4 py-2"><div className="font-medium">{f.name}</div><div className="text-xs text-gray-500">{f.territory}</div></td>
                <td className="px-4 py-2"><input type="number" step="0.01" min={0} max={30} className="input w-24" value={val(f, 'royalty_pct')} onChange={e => set(f.id, 'royalty_pct', e.target.value)} /></td>
                <td className="px-4 py-2"><input type="number" step="0.01" min={0} max={30} className="input w-24" value={val(f, 'marketing_levy_pct')} onChange={e => set(f.id, 'marketing_levy_pct', e.target.value)} /></td>
                <td className="px-4 py-2"><input type="date" className="input w-40" value={val(f, 'trading_since')} onChange={e => set(f.id, 'trading_since', e.target.value)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex items-center gap-3 justify-end">
        {msg && <span className="text-sm text-gray-600">{msg}</span>}
        <button onClick={save} disabled={busy || Object.keys(edits).length === 0} className="bg-[#C41E3A] text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50 flex items-center gap-2">{busy && <Loader2 className="h-4 w-4 animate-spin" />} Save rates</button>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------- bits
export const Stat: React.FC<{ label: string; value: string; sub?: string }> = ({ label, value, sub }) => (
  <div className="rounded-xl border border-gray-200 bg-white p-3">
    <div className="text-xs text-gray-500">{label}</div>
    <div className="text-lg font-bold text-gray-900">{value}</div>
    {sub && <div className="text-xs text-gray-500">{sub}</div>}
  </div>
);
export const Spinner = () => <div className="py-12 flex justify-center text-gray-500"><Loader2 className="h-6 w-6 animate-spin" /></div>;
export const Modal: React.FC<{ title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }> = ({ title, onClose, children, wide }) => (
  <div className="fixed inset-0 z-50 bg-black/40 flex items-start sm:items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
    <div className={`bg-white rounded-2xl shadow-2xl w-full ${wide ? 'max-w-4xl' : 'max-w-2xl'} p-6`} onClick={e => e.stopPropagation()}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900">{title}</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X className="h-5 w-5" /></button>
      </div>
      {children}
    </div>
  </div>
);

export default DeclarationsPage;
