import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useData } from '@/contexts/DataContext';
import MarketingProgramme from './MarketingProgramme';
import {
  Prospect, Activity, Plan, SetupRow, Review, HO_RATINGS,
  monthFigures, scoreMonth, scoreBand, mergeTargets, monthStartOf, addMonths, monthLabel, monthEnd, rand,
} from '@/lib/marketingProgramme';
import { ChevronLeft, ChevronRight, Download, Loader2, AlertTriangle } from 'lucide-react';

type SortKey = 'score' | 'name' | 'spend' | 'jobs' | 'revenue' | 'meetings';

/** Head Office view: every franchisee's marketing for a month, scored and ranked. */
const MarketingPerformance: React.FC = () => {
  const { franchisees } = useData();
  const [month, setMonth] = useState(monthStartOf(new Date()));
  const [open, setOpen] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [setup, setSetup] = useState<SetupRow[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [sort, setSort] = useState<SortKey>('score');
  const [showInactive, setShowInactive] = useState(false);

  const load = async () => {
    setLoading(true); setErr('');
    const [p, a, pl, s, r] = await Promise.all([
      supabase.from('mkt_prospects').select('*'),
      supabase.from('mkt_activities').select('*').gte('activity_date', month).lt('activity_date', monthEnd(month)),
      supabase.from('mkt_plans').select('*').eq('month', month),
      supabase.from('mkt_setup_items').select('*').eq('done', true),
      supabase.from('mkt_reviews').select('*').eq('month', month),
    ]);
    const e = [p, a, pl, s, r].find(x => x.error)?.error;
    if (e) setErr(e.message.includes('does not exist') ? 'Run supabase/marketing_programme.sql in Supabase first.' : e.message);
    setProspects((p.data || []) as Prospect[]);
    setActivities((a.data || []) as Activity[]);
    setPlans((pl.data || []) as Plan[]);
    setSetup((s.data || []) as SetupRow[]);
    setReviews((r.data || []) as Review[]);
    setLoading(false);
  };
  useEffect(() => { if (!open) load(); }, [month, open]);

  const rows = useMemo(() => franchisees
    .filter(f => showInactive || (f.status || 'active') === 'active')
    .map(f => {
      const pr = prospects.filter(p => p.franchisee_id === f.id);
      const ac = activities.filter(a => a.franchisee_id === f.id);
      const plan = plans.find(p => p.franchisee_id === f.id);
      const fig = monthFigures(month, pr, ac);
      const sc = scoreMonth(fig, mergeTargets(plan?.targets), setup.filter(s => s.franchisee_id === f.id).length, Number(plan?.budget || 0));
      return { f, fig, sc, plan, review: reviews.find(r => r.franchisee_id === f.id) };
    })
    .sort((a, b) => {
      switch (sort) {
        case 'name': return a.f.name.localeCompare(b.f.name);
        case 'spend': return b.fig.spend - a.fig.spend;
        case 'jobs': return b.fig.jobs_from_marketing - a.fig.jobs_from_marketing;
        case 'revenue': return b.fig.revenue - a.fig.revenue;
        case 'meetings': return b.fig.meetings - a.fig.meetings;
        default: return b.sc.total - a.sc.total;
      }
    }), [franchisees, prospects, activities, plans, setup, reviews, month, sort, showInactive]);

  if (open) return <MarketingProgramme franchiseeId={open} onBack={() => setOpen(null)} />;

  const n = rows.length || 1;
  const avg = Math.round(rows.reduce((s, r) => s + r.sc.total, 0) / n);
  const spend = rows.reduce((s, r) => s + r.fig.spend, 0);
  const jobs = rows.reduce((s, r) => s + r.fig.jobs_from_marketing, 0);
  const revenue = rows.reduce((s, r) => s + r.fig.revenue, 0);
  const silent = rows.filter(r => r.fig.activities === 0).length;
  const unreviewed = rows.filter(r => !r.review).length;

  const exportCsv = () => {
    const head = ['Franchisee', 'Territory', 'Division', 'Score', 'HO rating', 'Activities', 'Active weeks', 'Prospects added', 'Info sent', 'Meetings', 'Won', 'Review requests', 'Reviews received', 'GBP posts', 'Social posts', 'Budget', 'Spend', 'Leads', 'Jobs', 'Revenue', 'Cost per job', 'Overdue follow-ups', 'Open pipeline'];
    const body = rows.map(r => [r.f.name, r.f.territory, r.f.division, r.sc.total, HO_RATINGS.find(h => h.key === r.review?.ho_rating)?.label || '',
      r.fig.activities, `${r.fig.active_weeks}/${r.fig.weeks_in_month}`, r.fig.prospects_added, r.fig.info_sent, r.fig.meetings, r.fig.won_this_month,
      r.fig.review_requests, r.fig.reviews_received, r.fig.gbp_posts, r.fig.content_posts, r.plan?.budget || 0, r.fig.spend, r.fig.leads,
      r.fig.jobs_from_marketing, r.fig.revenue, r.fig.cost_per_job ? Math.round(r.fig.cost_per_job) : '', r.fig.overdue_followups, r.fig.pipeline_value]);
    const csv = [head, ...body].map(l => l.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `marketing-performance-${month.slice(0, 7)}.csv`;
    a.click();
  };

  const Th: React.FC<{ k?: SortKey; children: React.ReactNode; right?: boolean }> = ({ k, children, right }) => (
    <th className={`py-2 px-2 ${right ? 'text-right' : ''} ${k ? 'cursor-pointer hover:text-gray-800' : ''} ${sort === k ? 'text-[#C41E3A]' : ''}`} onClick={() => k && setSort(k)}>{children}</th>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Marketing Performance</h1>
          <p className="text-gray-500 text-sm">Every franchisee's local marketing, scored out of 100 from what they log in their Marketing Programme.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-white border border-gray-200 rounded-lg">
            <button className="p-2 hover:bg-gray-50 rounded-l-lg" onClick={() => setMonth(addMonths(month, -1))}><ChevronLeft className="h-4 w-4" /></button>
            <div className="px-3 text-sm font-semibold min-w-[130px] text-center">{monthLabel(month)}</div>
            <button className="p-2 hover:bg-gray-50 rounded-r-lg" onClick={() => setMonth(addMonths(month, 1))}><ChevronRight className="h-4 w-4" /></button>
          </div>
          <button onClick={exportCsv} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-gray-300 hover:bg-gray-50"><Download className="h-4 w-4" />CSV</button>
        </div>
      </div>

      {err && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm">{err}</div>}

      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          ['Average score', `${avg}/100`],
          ['Local spend logged', rand(spend)],
          ['Jobs from marketing', String(jobs)],
          ['Revenue from marketing', rand(revenue)],
          ['Need attention', `${silent} silent · ${unreviewed} not reviewed`],
        ].map(([l, v]) => (
          <div key={l} className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="text-xs text-gray-500 uppercase tracking-wide">{l}</div>
            <div className="text-xl font-bold mt-1">{v}</div>
          </div>
        ))}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
        <div className="flex justify-end p-3 border-b">
          <label className="text-xs text-gray-600 flex items-center gap-2"><input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} />Include inactive franchisees</label>
        </div>
        {loading ? <div className="p-6 flex items-center gap-2 text-gray-500"><Loader2 className="h-4 w-4 animate-spin" />Loading…</div> : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-gray-500 uppercase border-b bg-gray-50">
              <tr>
                <Th k="name">Franchisee</Th><Th k="score">Score</Th><th className="px-2">HO rating</th>
                <Th right>Activity</Th><Th right>Prospects</Th><Th k="meetings" right>Meetings</Th><Th right>Reviews req.</Th>
                <Th k="spend" right>Spend / budget</Th><Th k="jobs" right>Leads / jobs</Th><Th k="revenue" right>Revenue</Th><Th right>Cost / job</Th><th className="px-2">Flags</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map(r => {
                const b = scoreBand(r.sc.total);
                const hr = HO_RATINGS.find(h => h.key === r.review?.ho_rating);
                return (
                  <tr key={r.f.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setOpen(r.f.id)}>
                    <td className="py-3 px-2"><div className="font-semibold">{r.f.name}</div><div className="text-xs text-gray-500">{[r.f.territory, r.f.division].filter(Boolean).join(' · ')}</div></td>
                    <td className="px-2">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${b.cls}`}>{r.sc.total}</span>
                        <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden"><div className={`h-full ${b.bar}`} style={{ width: `${r.sc.total}%` }} /></div>
                      </div>
                    </td>
                    <td className="px-2">{hr ? <span className={`px-2 py-0.5 rounded text-xs font-semibold ${hr.cls}`}>{hr.label}</span> : <span className="text-xs text-gray-400">—</span>}</td>
                    <td className="px-2 text-right">{r.fig.activities}<div className="text-xs text-gray-400">{r.fig.active_weeks}/{r.fig.weeks_in_month} wks</div></td>
                    <td className="px-2 text-right">{r.fig.prospects_added}<div className="text-xs text-gray-400">{r.fig.info_sent} info sent</div></td>
                    <td className="px-2 text-right">{r.fig.meetings}<div className="text-xs text-gray-400">{r.fig.won_this_month} won</div></td>
                    <td className="px-2 text-right">{r.fig.review_requests}</td>
                    <td className="px-2 text-right">{rand(r.fig.spend)}<div className="text-xs text-gray-400">{r.plan?.budget ? rand(Number(r.plan.budget)) : 'no budget'}</div></td>
                    <td className="px-2 text-right">{r.fig.leads} / {r.fig.jobs_from_marketing}</td>
                    <td className="px-2 text-right">{rand(r.fig.revenue)}</td>
                    <td className="px-2 text-right">{r.fig.cost_per_job != null ? rand(r.fig.cost_per_job) : '—'}</td>
                    <td className="px-2">
                      {r.sc.flags.length > 0 && (
                        <span title={r.sc.flags.join('\n')} className="inline-flex items-center gap-1 text-xs text-amber-700"><AlertTriangle className="h-3.5 w-3.5" />{r.sc.flags.length}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      <p className="text-xs text-gray-500">
        Score: prospecting 30 (prospects added, info sent, meetings) · consistency 20 (activities, weeks active) · online & reviews 20 · foundations 15 · results 15 (jobs, spend against budget).
        Targets come from each franchisee's monthly plan, or the defaults if none is set. Click a franchisee to open their programme and add the Head Office review.
      </p>
    </div>
  );
};

export default MarketingPerformance;
