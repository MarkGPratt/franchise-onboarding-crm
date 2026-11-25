import React, { useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import { LAUNCH_PLAN, weekDate, shortDate, phaseOfTitle } from '@/lib/launchPlan';
import { Download, Flag, CheckCircle2, Circle, FileText } from 'lucide-react';

const PDF_URL = '/Surgeon-Group-Launch-Plan.pdf';

/** The road to launch: phases, milestones, documents and the gate at the end of each stage. */
const LaunchPlanPage: React.FC = () => {
  const { user } = useAuth();
  const { franchisees, checklist, progress } = useData();
  const isFranchisee = user?.role === 'franchisee';
  const [pick, setPick] = useState<string>('');
  const fid = isFranchisee ? user?.franchiseeId || '' : pick;
  const f = franchisees.find(x => x.id === fid);
  const anchor = f?.startDate || '';

  // Done / total per phase, from the live Process Flow
  const phaseProgress = useMemo(() => {
    const out: Record<number, { done: number; total: number }> = {};
    if (!fid) return out;
    const fp = progress[fid];
    for (const s of checklist) {
      const n = phaseOfTitle(s.title);
      if (n === null) continue;
      const total = s.tasks.length;
      const done = s.tasks.filter(t => fp?.tasks[t.id]?.completed).length;
      out[n] = { done: (out[n]?.done || 0) + done, total: (out[n]?.total || 0) + total };
    }
    return out;
  }, [checklist, progress, fid]);

  const launch = anchor ? weekDate(anchor, 20) : null;

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{isFranchisee ? 'My Launch Plan' : 'Launch Plan'}</h1>
          <p className="text-gray-600 mt-1 max-w-2xl">
            The road from first conversation to trading, about 20 weeks. Each stage ends with a milestone that opens the next one.
            The detailed tasks are in the Process Flow.
          </p>
        </div>
        <a href={PDF_URL} target="_blank" rel="noreferrer" className="bg-[#C41E3A] hover:bg-[#a01830] text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2">
          <Download className="h-4 w-4" /> Download PDF
        </a>
      </div>

      {!isFranchisee && (
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <label className="text-sm font-semibold text-gray-700">Show dates and progress for</label>
          <select value={pick} onChange={e => setPick(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm min-w-[260px]">
            <option value="">— General plan —</option>
            {franchisees.slice().sort((a, b) => a.name.localeCompare(b.name)).map(x => <option key={x.id} value={x.id}>{x.name}{x.territory ? ` — ${x.territory}` : ''}</option>)}
          </select>
        </div>
      )}

      {anchor && (
        <div className="mb-6 rounded-xl bg-gray-900 text-white p-5 flex flex-wrap gap-6 items-center">
          <Flag className="h-8 w-8 text-[#ff6b7d]" />
          <div>
            <div className="text-xs uppercase tracking-wider text-white/60">Portal account opened</div>
            <div className="text-lg font-bold">{shortDate(new Date(anchor + 'T00:00:00'))}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-white/60">Planned launch (about)</div>
            <div className="text-lg font-bold">{launch ? shortDate(launch) : '—'}</div>
          </div>
          <p className="text-xs text-white/60 max-w-xs">Dates are a guide. Your launch date is agreed with Head Office in stage 4 and every date after that follows from it.</p>
        </div>
      )}

      <ol className="relative border-l-2 border-gray-200 ml-3 space-y-6">
        {LAUNCH_PLAN.map((s, i) => {
          const p = s.phase !== null ? phaseProgress[s.phase] : undefined;
          const complete = p && p.total > 0 && p.done === p.total;
          const from = anchor ? weekDate(anchor, s.weeks[0]) : null;
          const to = anchor ? weekDate(anchor, s.weeks[1]) : null;
          return (
            <li key={s.key} className="ml-6">
              <span className={`absolute -left-[13px] flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-white ${complete ? 'bg-green-600' : 'bg-[#C41E3A]'}`}>
                {complete ? <CheckCircle2 className="h-4 w-4 text-white" /> : <span className="text-[11px] font-bold text-white">{i + 1}</span>}
              </span>
              <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-lg font-bold text-gray-900">
                    {s.title}
                    {s.parallel && <span className="ml-2 align-middle text-[11px] font-semibold uppercase tracking-wide text-amber-700 bg-amber-50 px-2 py-0.5 rounded">runs alongside stages 7–10</span>}
                  </h2>
                  <div className="text-sm font-semibold text-[#C41E3A]">
                    {s.when}{from && to ? <span className="text-gray-500 font-normal"> · {shortDate(from)}{s.weeks[0] !== s.weeks[1] ? ` – ${shortDate(to)}` : ''}</span> : null}
                  </div>
                </div>
                <p className="text-gray-700 mt-1">{s.summary}</p>
                <div className="grid md:grid-cols-2 gap-4 mt-4">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">Milestones</div>
                    <ul className="space-y-1">{s.milestones.map(m => <li key={m} className="text-sm text-gray-800 flex gap-2"><Circle className="h-2 w-2 mt-1.5 fill-gray-400 text-gray-400 shrink-0" />{m}</li>)}</ul>
                  </div>
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">Documents you will receive</div>
                    <ul className="space-y-1">{s.documents.map(d => <li key={d} className="text-sm text-gray-800 flex gap-2"><FileText className="h-3.5 w-3.5 mt-0.5 text-gray-400 shrink-0" />{d}</li>)}</ul>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-3">
                  <div className="text-sm"><span className="font-semibold text-gray-900">Next stage opens when: </span><span className="text-gray-700">{s.gate}</span></div>
                  {p && p.total > 0 && (
                    <div className="flex items-center gap-2 min-w-[160px]">
                      <div className="h-2 flex-1 bg-gray-100 rounded-full overflow-hidden"><div className={`h-full ${complete ? 'bg-green-600' : 'bg-[#C41E3A]'}`} style={{ width: `${Math.round(100 * p.done / p.total)}%` }} /></div>
                      <span className="text-xs font-semibold text-gray-600 whitespace-nowrap">{p.done}/{p.total} tasks</span>
                    </div>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
};

export default LaunchPlanPage;
