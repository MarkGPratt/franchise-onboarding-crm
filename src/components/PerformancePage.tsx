import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { ResponsiveContainer, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend, Line, ComposedChart } from 'recharts';
import { Declaration, HistoryRow, PerfMonth, fetchAll, mergePerformance, monthName, rands, missingTable, monthKey, shiftMonth } from '@/lib/franchiseePortal';
import { Stat, Spinner } from './DeclarationsPage';
import { Link2, Loader2, TrendingUp, TrendingDown } from 'lucide-react';

/** Performance: a franchisee sees only their own months; Head Office can view anyone and link imported history. */
const PerformancePage: React.FC = () => {
  const { user } = useAuth();
  const { franchisees } = useData();
  const staff = user?.role !== 'franchisee';
  const [tab, setTab] = useState<'view' | 'link'>('view');
  const [pick, setPick] = useState('');
  const fid = staff ? pick : user?.franchiseeId || '';

  if (!staff && !fid) return <div className="p-8 text-gray-500">No franchise record is linked to your account yet. Please contact Head Office.</div>;

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900">{staff ? 'Franchisee Performance' : 'My Performance'}</h1>
      {staff && (
        <div className="mt-4 flex gap-2 border-b border-gray-200">
          {(['view', 'link'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px ${tab === t ? 'border-[#C41E3A] text-[#C41E3A]' : 'border-transparent text-gray-500'}`}>{t === 'view' ? 'View a franchisee' : 'Link imported history'}</button>
          ))}
        </div>
      )}
      {staff && tab === 'view' && (
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <label className="text-sm font-semibold text-gray-700">Franchisee</label>
          <select value={pick} onChange={e => setPick(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm min-w-[280px]">
            <option value="">Choose…</option>
            {franchisees.slice().sort((a, b) => a.name.localeCompare(b.name)).map(f => <option key={f.id} value={f.id}>{f.name}{f.territory ? ` — ${f.territory}` : ''}</option>)}
          </select>
          <span className="text-xs text-gray-500">This is what the franchisee sees on their own My Performance page.</span>
        </div>
      )}
      {(tab === 'view' || !staff) && fid && <PerfView franchiseeId={fid} />}
      {staff && tab === 'link' && <LinkHistory />}
    </div>
  );
};

const PerfView: React.FC<{ franchiseeId: string }> = ({ franchiseeId }) => {
  const [months, setMonths] = useState<PerfMonth[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true); setErr('');
      const [h, d] = await Promise.all([
        fetchAll<HistoryRow>((a, b) => supabase.from('performance_history').select('*').eq('franchisee_id', franchiseeId).order('period').range(a, b)),
        supabase.from('turnover_declarations').select('*').eq('franchisee_id', franchiseeId),
      ]);
      const e = h.error || d.error?.message;
      if (e) setErr(missingTable(e) ? 'Performance is not switched on yet.' : e);
      setMonths(mergePerformance(h.rows, (d.data || []) as Declaration[]));
      setLoading(false);
    })();
  }, [franchiseeId]);

  const last = months.length ? months[months.length - 1].period : monthKey(new Date());
  const window12 = (end: string) => months.filter(m => m.period > shiftMonth(end, -12) && m.period <= end);
  const cur = window12(last), prev = window12(shiftMonth(last, -12));
  const sum = (ms: PerfMonth[]) => ms.reduce((s, m) => ({ t: s.t + m.turnover, j: s.j + m.jobs }), { t: 0, j: 0 });
  const c = sum(cur), p = sum(prev);
  const growth = p.t > 0 ? (c.t - p.t) / p.t : null;

  const chart = useMemo(() => months.slice(-24).map(m => ({ name: monthName(m.period, true), Turnover: Math.round(m.turnover), Jobs: m.jobs })), [months]);
  const years = useMemo(() => {
    const y = new Map<string, { t: number; j: number; n: number }>();
    months.forEach(m => { const k = m.period.slice(0, 4); const e = y.get(k) || { t: 0, j: 0, n: 0 }; e.t += m.turnover; e.j += m.jobs; e.n += 1; y.set(k, e); });
    return [...y.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [months]);

  if (loading) return <Spinner />;
  if (err) return <p className="mt-5 text-red-700">{err}</p>;
  if (!months.length) return <p className="mt-6 text-gray-600">No figures yet. Your history will appear here once Head Office has loaded it, and each month you declare is added automatically.</p>;

  return (
    <div className="mt-6 space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Turnover, last 12 months (excl. VAT)" value={rands(c.t)} sub={`to ${monthName(last)}`} />
        <Stat label="Jobs, last 12 months" value={c.j.toLocaleString('en-ZA')} />
        <Stat label="Average job value" value={c.j ? rands(c.t / c.j) : '—'} />
        <div className="rounded-xl border border-gray-200 bg-white p-3">
          <div className="text-xs text-gray-500">Versus the 12 months before</div>
          <div className={`text-lg font-bold flex items-center gap-1 ${growth === null ? 'text-gray-900' : growth >= 0 ? 'text-green-700' : 'text-red-700'}`}>
            {growth === null ? '—' : <>{growth >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}{(growth * 100).toFixed(1)}%</>}
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="font-semibold text-gray-900 mb-2">Last 24 months</div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chart} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="t" tick={{ fontSize: 11 }} tickFormatter={v => `R${Math.round(v / 1000)}k`} />
              <YAxis yAxisId="j" orientation="right" tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: any, n: any) => (n === 'Turnover' ? rands(Number(v)) : v)} />
              <Legend />
              <Bar yAxisId="t" dataKey="Turnover" fill="#C41E3A" radius={[3, 3, 0, 0]} />
              <Line yAxisId="j" dataKey="Jobs" stroke="#1a1a1a" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 font-semibold border-b border-gray-100">By year</div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase"><tr><th className="text-left px-4 py-2">Year</th><th className="text-right px-4 py-2">Turnover</th><th className="text-right px-4 py-2">Jobs</th><th className="text-right px-4 py-2">Avg job</th></tr></thead>
            <tbody>{years.map(([y, e]) => (
              <tr key={y} className="border-t border-gray-100"><td className="px-4 py-2">{y}{e.n < 12 && <span className="text-xs text-gray-400"> ({e.n} mo)</span>}</td><td className="px-4 py-2 text-right">{rands(e.t)}</td><td className="px-4 py-2 text-right">{e.j.toLocaleString('en-ZA')}</td><td className="px-4 py-2 text-right">{e.j ? rands(e.t / e.j) : '—'}</td></tr>
            ))}</tbody>
          </table>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 font-semibold border-b border-gray-100">By month</div>
          <div className="max-h-[420px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 text-xs uppercase sticky top-0"><tr><th className="text-left px-4 py-2">Month</th><th className="text-right px-4 py-2">Turnover</th><th className="text-right px-4 py-2">Jobs</th><th className="text-right px-4 py-2">Avg job</th></tr></thead>
              <tbody>{[...months].reverse().map(m => (
                <tr key={m.period} className="border-t border-gray-100"><td className="px-4 py-2">{monthName(m.period)}{m.source === 'declared' && <span className="ml-1 text-[10px] font-semibold text-blue-700">declared</span>}</td><td className="px-4 py-2 text-right">{rands(m.turnover)}</td><td className="px-4 py-2 text-right">{m.jobs}</td><td className="px-4 py-2 text-right">{m.jobs ? rands(m.turnover / m.jobs) : '—'}</td></tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      </div>
      <p className="text-xs text-gray-500">Turnover excludes VAT. Months before the portal come from Head Office's records; months you declare in the portal replace them.</p>
    </div>
  );
};

/** Head Office: link each territory in the imported spreadsheet to today's franchisee, from the month they took over. */
const LinkHistory: React.FC = () => {
  const { franchisees } = useData();
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [edit, setEdit] = useState<Record<string, { fid: string; from: string }>>({});
  const [busy, setBusy] = useState('');

  const load = async () => {
    setLoading(true); setErr('');
    const r = await fetchAll<HistoryRow>((a, b) => supabase.from('performance_history').select('id,territory_label,period,franchisee_id,turnover_excl,turnover_incl,jobs').order('territory_label').order('period').range(a, b));
    if (r.error) setErr(missingTable(r.error) ? 'Run supabase/franchisee_portal.sql and performance_history_import.sql in Supabase first.' : r.error);
    setRows(r.rows);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const labels = useMemo(() => {
    const m = new Map<string, { first: string; last: string; n: number; fid: string | null; linkedFrom: string | null; total: number }>();
    rows.forEach(r => {
      const e = m.get(r.territory_label) || { first: r.period, last: r.period, n: 0, fid: null, linkedFrom: null, total: 0 };
      e.first = r.period < e.first ? r.period : e.first; e.last = r.period > e.last ? r.period : e.last; e.n++;
      e.total += Number(r.turnover_excl || 0);
      if (r.franchisee_id) { e.fid = r.franchisee_id; if (!e.linkedFrom || r.period < e.linkedFrom) e.linkedFrom = r.period; }
      m.set(r.territory_label, e);
    });
    return [...m.entries()].sort((a, b) => (b[1].last.localeCompare(a[1].last)) || a[0].localeCompare(b[0]));
  }, [rows]);

  const save = async (label: string) => {
    const e = edit[label]; if (!e) return;
    setBusy(label);
    const { data, error } = await supabase.rpc('link_performance_history', { p_label: label, p_franchisee: e.fid || null, p_from: e.from ? `${e.from}-01` : null });
    setBusy('');
    if (error) { alert(error.message); return; }
    setEdit(x => { const y = { ...x }; delete y[label]; return y; });
    await load();
    if (e.fid) alert(`${data} month(s) of ${label} linked.`);
  };

  if (loading) return <Spinner />;
  if (err) return <p className="mt-5 text-red-700">{err}</p>;
  const name = (id: string | null) => franchisees.find(f => f.id === id)?.name || id || '';
  const recent = (l: string) => l >= shiftMonth(monthKey(new Date()), -18);

  return (
    <div className="mt-5">
      <p className="text-sm text-gray-600 mb-4 max-w-3xl">
        The imported history is kept by territory. Link a territory to the franchisee who runs it today, from the month they took over:
        they will see only those months. Earlier months (a previous owner) stay hidden from them. Territories no one trades in any more can stay unlinked.
      </p>
      <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 text-xs uppercase"><tr><th className="text-left px-4 py-3">Territory (spreadsheet)</th><th className="text-left px-4 py-3">Months</th><th className="text-left px-4 py-3">Linked to</th><th className="text-left px-4 py-3">Franchisee</th><th className="text-left px-4 py-3">From month</th><th></th></tr></thead>
          <tbody>
            {labels.map(([label, e]) => {
              const ed = edit[label] || { fid: e.fid || '', from: (e.linkedFrom || e.first).slice(0, 7) };
              const dirty = !!edit[label];
              return (
                <tr key={label} className={`border-t border-gray-100 ${recent(e.last) ? '' : 'text-gray-400'}`}>
                  <td className="px-4 py-2 font-medium">{label}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{monthName(e.first, true)} – {monthName(e.last, true)} <span className="text-xs">({e.n})</span></td>
                  <td className="px-4 py-2">{e.fid ? <span className="inline-flex items-center gap-1 text-green-700"><Link2 className="h-3.5 w-3.5" />{name(e.fid)} <span className="text-xs text-gray-500">from {monthName(e.linkedFrom!, true)}</span></span> : <span className="text-xs">not linked</span>}</td>
                  <td className="px-4 py-2">
                    <select value={ed.fid} onChange={ev => setEdit(x => ({ ...x, [label]: { ...ed, fid: ev.target.value } }))} className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm max-w-[220px]">
                      <option value="">— not linked —</option>
                      {franchisees.slice().sort((a, b) => a.name.localeCompare(b.name)).map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-2"><input type="month" value={ed.from} min={e.first.slice(0, 7)} max={e.last.slice(0, 7)} onChange={ev => setEdit(x => ({ ...x, [label]: { ...ed, from: ev.target.value } }))} className="border border-gray-300 rounded-lg px-2 py-1 text-sm" /></td>
                  <td className="px-4 py-2 text-right">{dirty && <button onClick={() => save(label)} disabled={busy === label} className="bg-[#C41E3A] text-white px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1">{busy === label && <Loader2 className="h-3 w-3 animate-spin" />}Save</button>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PerformancePage;
