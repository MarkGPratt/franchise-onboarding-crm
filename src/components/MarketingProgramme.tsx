import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useData } from '@/contexts/DataContext';
import {
  CHANNELS, CHANNEL_GROUPS, RETIRED_METHODS, SETUP_ITEMS, SEGMENTS, STAGES, ACTIVITY_TYPES, SEASONAL,
  HO_RATINGS, TARGET_LABELS, SEGMENT_CHANNEL,
  Prospect, Activity, Plan, SetupRow, Review, Targets, ProspectStage,
  segmentLabel, stageOf, activityLabel, channelLabel, monthFigures, scoreMonth, scoreBand, mergeTargets,
  monthStartOf, addMonths, monthLabel, inMonth, fmtDate, rand, todayYmd, addDays, infoTemplate, waNumber, brandFor,
} from '@/lib/marketingProgramme';
import {
  ChevronLeft, ChevronRight, Plus, Send, CalendarCheck, Pencil, Trash2, Download, X, Loader2,
  AlertTriangle, Target, TrendingUp, Mail, MessageCircle, Search, CheckCircle2, Circle, BookOpen, ArrowLeft,
} from 'lucide-react';

type Tab = 'overview' | 'plan' | 'prospects' | 'activities' | 'playbook';

const input = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C41E3A]/30 focus:border-[#C41E3A]';
const btn = 'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50';
const btnPrimary = `${btn} bg-[#C41E3A] text-white hover:bg-[#a31830]`;
const btnGhost = `${btn} border border-gray-300 text-gray-700 hover:bg-gray-50`;

const Modal: React.FC<{ title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }> = ({ title, onClose, children, wide }) => (
  <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 overflow-y-auto">
    <div className={`bg-white rounded-xl shadow-2xl w-full ${wide ? 'max-w-3xl' : 'max-w-xl'} my-8`}>
      <div className="flex items-center justify-between px-5 py-4 border-b">
        <h3 className="font-bold text-lg">{title}</h3>
        <button onClick={onClose} className="p-1 rounded hover:bg-gray-100"><X className="h-5 w-5" /></button>
      </div>
      <div className="p-5">{children}</div>
    </div>
  </div>
);

const Field: React.FC<{ label: string; children: React.ReactNode; className?: string }> = ({ label, children, className }) => (
  <label className={`block ${className || ''}`}>
    <span className="block text-xs font-semibold text-gray-600 mb-1">{label}</span>
    {children}
  </label>
);

const Tile: React.FC<{ label: string; value: React.ReactNode; sub?: string }> = ({ label, value, sub }) => (
  <div className="bg-white border border-gray-200 rounded-xl p-4">
    <div className="text-xs text-gray-500 uppercase tracking-wide">{label}</div>
    <div className="text-2xl font-bold mt-1">{value}</div>
    {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
  </div>
);

const toLocalInput = (iso?: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const csvEscape = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
const downloadCsv = (name: string, rows: any[][]) => {
  const blob = new Blob([rows.map(r => r.map(csvEscape).join(',')).join('\n')], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
};

// ===========================================================================
// Main component
// ===========================================================================
const MarketingProgramme: React.FC<{ franchiseeId: string; onBack?: () => void }> = ({ franchiseeId, onBack }) => {
  const { user } = useAuth();
  const { franchisees, documents } = useData();
  const isStaff = user?.role === 'admin' || user?.role === 'sales';
  const fr = franchisees.find(f => f.id === franchiseeId);

  const [tab, setTab] = useState<Tab>('overview');
  const [month, setMonth] = useState(monthStartOf(new Date()));
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [setup, setSetup] = useState<SetupRow[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);

  const load = async () => {
    setLoading(true); setErr('');
    const [p, a, pl, s, r] = await Promise.all([
      supabase.from('mkt_prospects').select('*').eq('franchisee_id', franchiseeId).order('created_at', { ascending: false }),
      supabase.from('mkt_activities').select('*').eq('franchisee_id', franchiseeId).order('activity_date', { ascending: false }),
      supabase.from('mkt_plans').select('*').eq('franchisee_id', franchiseeId),
      supabase.from('mkt_setup_items').select('*').eq('franchisee_id', franchiseeId),
      supabase.from('mkt_reviews').select('*').eq('franchisee_id', franchiseeId),
    ]);
    const firstErr = [p, a, pl, s, r].find(x => x.error)?.error;
    if (firstErr) setErr(firstErr.message.includes('does not exist')
      ? 'The marketing tables have not been created yet. Run supabase/marketing_programme.sql in Supabase first.'
      : firstErr.message);
    setProspects((p.data || []) as Prospect[]);
    setActivities((a.data || []) as Activity[]);
    setPlans((pl.data || []) as Plan[]);
    setSetup((s.data || []) as SetupRow[]);
    setReviews((r.data || []) as Review[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, [franchiseeId]);

  const plan = plans.find(p => p.month === month);
  const targets = mergeTargets(plan?.targets);
  const setupDone = setup.filter(s => s.done).length;
  const figures = useMemo(() => monthFigures(month, prospects, activities), [month, prospects, activities]);
  const score = scoreMonth(figures, targets, setupDone, Number(plan?.budget || 0));
  const band = scoreBand(score.total);
  const review = reviews.find(r => r.month === month);

  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'plan', label: 'Plan & foundations' },
    { id: 'prospects', label: `Prospects (${prospects.filter(p => !['won', 'lost'].includes(p.stage)).length})` },
    { id: 'activities', label: 'Activity log' },
    { id: 'playbook', label: 'Playbook' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          {onBack && (
            <button onClick={onBack} className="text-sm text-gray-500 hover:text-gray-800 inline-flex items-center gap-1 mb-2">
              <ArrowLeft className="h-4 w-4" /> Back to Marketing Performance
            </button>
          )}
          <h1 className="text-2xl font-bold">Marketing Programme</h1>
          <p className="text-gray-500 text-sm">{fr ? `${fr.name}${fr.territory ? ' · ' + fr.territory : ''}` : ''}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-white border border-gray-200 rounded-lg">
            <button className="p-2 hover:bg-gray-50 rounded-l-lg" onClick={() => setMonth(addMonths(month, -1))}><ChevronLeft className="h-4 w-4" /></button>
            <div className="px-3 text-sm font-semibold min-w-[130px] text-center">{monthLabel(month)}</div>
            <button className="p-2 hover:bg-gray-50 rounded-r-lg" onClick={() => setMonth(addMonths(month, 1))}><ChevronRight className="h-4 w-4" /></button>
          </div>
          <div className={`px-3 py-2 rounded-lg text-sm font-bold ${band.cls}`}>Score {score.total}/100 · {band.label}</div>
        </div>
      </div>

      {err && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm">{err}</div>}

      <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px ${tab === t.id ? 'border-[#C41E3A] text-[#C41E3A]' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      ) : (
        <>
          {tab === 'overview' && (
            <Overview month={month} figures={figures} score={score} plan={plan} prospects={prospects} activities={activities}
              review={review} isStaff={isStaff} franchiseeId={franchiseeId} reviewer={user?.name || ''}
              onReviewSaved={load} onOpenProspects={() => setTab('prospects')} />
          )}
          {tab === 'plan' && (
            <PlanTab month={month} plan={plan} setup={setup} franchiseeId={franchiseeId} userName={user?.name || ''} onSaved={load} />
          )}
          {tab === 'prospects' && (
            <ProspectsTab prospects={prospects} franchiseeId={franchiseeId} userName={user?.name || ''}
              brand={brandFor(fr?.division)} territory={fr?.territory || ''} phone={fr?.phone || ''}
              documents={documents.filter(d => !d.franchiseeId || d.franchiseeId === franchiseeId)} onChanged={load} />
          )}
          {tab === 'activities' && (
            <ActivitiesTab month={month} activities={activities} prospects={prospects} franchiseeId={franchiseeId}
              userName={user?.name || ''} onChanged={load} />
          )}
          {tab === 'playbook' && <Playbook month={month} />}
        </>
      )}
    </div>
  );
};

// ===========================================================================
// Overview
// ===========================================================================
const Overview: React.FC<{
  month: string; figures: ReturnType<typeof monthFigures>; score: ReturnType<typeof scoreMonth>; plan?: Plan;
  prospects: Prospect[]; activities: Activity[]; review?: Review; isStaff: boolean; franchiseeId: string; reviewer: string;
  onReviewSaved: () => void; onOpenProspects: () => void;
}> = ({ month, figures: f, score, plan, prospects, activities, review, isStaff, franchiseeId, reviewer, onReviewSaved, onOpenProspects }) => {
  const today = todayYmd();
  const due = prospects
    .filter(p => !['won', 'lost'].includes(p.stage) && p.next_action_date && p.next_action_date <= addDays(today, 7))
    .sort((a, b) => (a.next_action_date || '').localeCompare(b.next_action_date || ''));

  const byChannel = useMemo(() => {
    const m = new Map<string, { cost: number; leads: number; jobs: number; revenue: number; count: number }>();
    activities.filter(a => inMonth(a.activity_date, month)).forEach(a => {
      const r = m.get(a.channel) || { cost: 0, leads: 0, jobs: 0, revenue: 0, count: 0 };
      r.cost += Number(a.cost || 0); r.leads += a.leads || 0; r.jobs += a.jobs_won || 0; r.revenue += Number(a.revenue || 0); r.count += 1;
      m.set(a.channel, r);
    });
    return [...m.entries()].sort((a, b) => b[1].revenue - a[1].revenue);
  }, [activities, month]);

  const budget = Number(plan?.budget || 0);
  const seasonal = SEASONAL.find(s => s.month === Number(month.slice(5, 7)));

  return (
    <div className="space-y-6">
      {seasonal && (
        <div className="bg-[#1a1a1a] text-white rounded-xl p-4 text-sm flex gap-3">
          <BookOpen className="h-5 w-5 text-[#ff6b81] flex-shrink-0 mt-0.5" />
          <div><span className="font-semibold">Focus for {monthLabel(month)}: </span>{plan?.focus || seasonal.focus}</div>
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Tile label="Spend" value={rand(f.spend)} sub={budget ? `of ${rand(budget)} budget` : 'No budget set'} />
        <Tile label="Leads / jobs" value={`${f.leads} / ${f.jobs_from_marketing}`} sub={f.cost_per_job != null ? `${rand(f.cost_per_job)} per job` : 'Log results on activities'} />
        <Tile label="Revenue from marketing" value={rand(f.revenue)} sub={f.spend ? `${(f.revenue / f.spend).toFixed(1)}× return on spend` : undefined} />
        <Tile label="Open pipeline" value={rand(f.pipeline_value)} sub={`${prospects.filter(p => !['won', 'lost'].includes(p.stage)).length} open prospects · ${f.won_this_month} won this month`} />
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold flex items-center gap-2"><Target className="h-5 w-5 text-[#C41E3A]" /> Marketing Performance Score</h3>
            <span className={`px-2 py-1 rounded text-sm font-bold ${scoreBand(score.total).cls}`}>{score.total}/100</span>
          </div>
          <div className="space-y-2.5">
            {score.lines.map(l => (
              <div key={l.key} className="grid grid-cols-12 items-center gap-2 text-sm">
                <div className="col-span-5 text-gray-700">{l.label}</div>
                <div className="col-span-4 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full ${scoreBand((l.points / l.max) * 100).bar}`} style={{ width: `${(l.points / l.max) * 100}%` }} />
                </div>
                <div className="col-span-3 text-right text-xs text-gray-500">{l.detail} · <b>{Math.round(l.points)}/{l.max}</b></div>
              </div>
            ))}
          </div>
          {score.flags.length > 0 && (
            <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1">
              {score.flags.map(fl => (
                <div key={fl} className="text-sm text-amber-800 flex items-center gap-2"><AlertTriangle className="h-4 w-4" />{fl}</div>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold">Follow-ups due</h3>
              <button onClick={onOpenProspects} className="text-xs text-[#C41E3A] font-semibold">All prospects →</button>
            </div>
            {due.length === 0 ? <p className="text-sm text-gray-500">Nothing due in the next 7 days.</p> : (
              <ul className="divide-y">
                {due.slice(0, 8).map(p => (
                  <li key={p.id} className="py-2 text-sm flex justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{p.business_name}</div>
                      <div className="text-xs text-gray-500 truncate">{p.next_action || stageOf(p.stage).label}</div>
                    </div>
                    <span className={`text-xs font-semibold whitespace-nowrap ${p.next_action_date! < today ? 'text-red-600' : 'text-gray-600'}`}>
                      {p.next_action_date! < today ? 'Overdue · ' : ''}{fmtDate(p.next_action_date)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <HoReview review={review} isStaff={isStaff} franchiseeId={franchiseeId} month={month} systemScore={score.total}
            reviewer={reviewer} onSaved={onReviewSaved} />
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="font-bold mb-3 flex items-center gap-2"><TrendingUp className="h-5 w-5 text-[#C41E3A]" /> What is working this month</h3>
        {byChannel.length === 0 ? <p className="text-sm text-gray-500">No activity logged for {monthLabel(month)} yet.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-gray-500 uppercase border-b">
                <tr><th className="py-2">Channel</th><th>Activities</th><th className="text-right">Cost</th><th className="text-right">Leads</th><th className="text-right">Jobs</th><th className="text-right">Revenue</th><th className="text-right">Cost / job</th></tr>
              </thead>
              <tbody className="divide-y">
                {byChannel.map(([k, r]) => (
                  <tr key={k}>
                    <td className="py-2 font-medium">{channelLabel(k)}</td><td>{r.count}</td>
                    <td className="text-right">{rand(r.cost)}</td><td className="text-right">{r.leads}</td><td className="text-right">{r.jobs}</td>
                    <td className="text-right">{rand(r.revenue)}</td><td className="text-right">{r.jobs ? rand(r.cost / r.jobs) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

const HoReview: React.FC<{ review?: Review; isStaff: boolean; franchiseeId: string; month: string; systemScore: number; reviewer: string; onSaved: () => void }> =
  ({ review, isStaff, franchiseeId, month, systemScore, reviewer, onSaved }) => {
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState({ ho_rating: review?.ho_rating || '', comment: review?.comment || '', actions: review?.actions || '' });
  const [busy, setBusy] = useState(false);
  useEffect(() => { setForm({ ho_rating: review?.ho_rating || '', comment: review?.comment || '', actions: review?.actions || '' }); setEdit(false); }, [review?.id, month]);

  const save = async () => {
    setBusy(true);
    const { error } = await supabase.from('mkt_reviews').upsert({
      franchisee_id: franchiseeId, month, system_score: systemScore,
      ho_rating: form.ho_rating || null, comment: form.comment || null, actions: form.actions || null,
      reviewed_by: reviewer, reviewed_at: new Date().toISOString(),
    }, { onConflict: 'franchisee_id,month' });
    setBusy(false);
    if (error) { alert(error.message); return; }
    setEdit(false); onSaved();
  };
  const rating = HO_RATINGS.find(r => r.key === review?.ho_rating);

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold">Head Office review</h3>
        {isStaff && !edit && <button onClick={() => setEdit(true)} className="text-xs text-[#C41E3A] font-semibold">{review ? 'Edit' : 'Add review'}</button>}
      </div>
      {edit ? (
        <div className="space-y-3">
          <div className="flex gap-2 flex-wrap">
            {HO_RATINGS.map(r => (
              <button key={r.key} onClick={() => setForm({ ...form, ho_rating: r.key })}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${form.ho_rating === r.key ? r.cls + ' border-transparent' : 'border-gray-300 text-gray-600'}`}>{r.label}</button>
            ))}
          </div>
          <Field label="Comment"><textarea className={input} rows={3} value={form.comment} onChange={e => setForm({ ...form, comment: e.target.value })} /></Field>
          <Field label="Actions for next month"><textarea className={input} rows={3} value={form.actions} onChange={e => setForm({ ...form, actions: e.target.value })} /></Field>
          <div className="flex gap-2 justify-end">
            <button className={btnGhost} onClick={() => setEdit(false)}>Cancel</button>
            <button className={btnPrimary} onClick={save} disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Save review</button>
          </div>
        </div>
      ) : review ? (
        <div className="space-y-2 text-sm">
          {rating && <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${rating.cls}`}>{rating.label}</span>}
          {review.comment && <p className="text-gray-700 whitespace-pre-line">{review.comment}</p>}
          {review.actions && <div><div className="text-xs font-semibold text-gray-500 mt-2">Actions</div><p className="whitespace-pre-line">{review.actions}</p></div>}
          <div className="text-xs text-gray-400">{review.reviewed_by} · {fmtDate(review.reviewed_at)} · score at review {review.system_score ?? '—'}</div>
        </div>
      ) : <p className="text-sm text-gray-500">Not reviewed yet for this month.</p>}
    </div>
  );
};

// ===========================================================================
// Plan & foundations
// ===========================================================================
const PlanTab: React.FC<{ month: string; plan?: Plan; setup: SetupRow[]; franchiseeId: string; userName: string; onSaved: () => void }> =
  ({ month, plan, setup, franchiseeId, userName, onSaved }) => {
  const seasonal = SEASONAL.find(s => s.month === Number(month.slice(5, 7)));
  const blank = () => ({
    budget: String(plan?.budget ?? ''), google_ads_budget: String(plan?.google_ads_budget ?? ''),
    focus: plan?.focus || '', notes: plan?.notes || '', targets: mergeTargets(plan?.targets),
  });
  const [form, setForm] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  useEffect(() => { setForm(blank()); setSaved(false); }, [month, plan?.id]);

  const save = async () => {
    setBusy(true);
    const { error } = await supabase.from('mkt_plans').upsert({
      franchisee_id: franchiseeId, month,
      budget: Number(form.budget || 0), google_ads_budget: Number(form.google_ads_budget || 0),
      focus: form.focus || null, notes: form.notes || null, targets: form.targets, updated_by: userName,
    }, { onConflict: 'franchisee_id,month' });
    setBusy(false);
    if (error) { alert(error.message); return; }
    setSaved(true); onSaved();
  };

  const toggle = async (key: string, done: boolean, evidence?: string) => {
    const { error } = await supabase.from('mkt_setup_items').upsert({
      franchisee_id: franchiseeId, item_key: key, done, done_at: done ? new Date().toISOString() : null,
      evidence: evidence ?? setup.find(s => s.item_key === key)?.evidence ?? null, updated_by: userName,
    }, { onConflict: 'franchisee_id,item_key' });
    if (error) { alert(error.message); return; }
    onSaved();
  };

  const groups = [...new Set(SETUP_ITEMS.map(i => i.group))];
  const done = setup.filter(s => s.done).length;

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4 h-fit">
        <h3 className="font-bold">Plan for {monthLabel(month)}</h3>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Local marketing budget (R, excl. marketing levy)">
            <input type="number" className={input} value={form.budget} onChange={e => setForm({ ...form, budget: e.target.value })} />
          </Field>
          <Field label="of which Google Ads (R)">
            <input type="number" className={input} value={form.google_ads_budget} onChange={e => setForm({ ...form, google_ads_budget: e.target.value })} />
          </Field>
        </div>
        <Field label="Focus this month">
          <textarea className={input} rows={2} placeholder={seasonal?.focus} value={form.focus} onChange={e => setForm({ ...form, focus: e.target.value })} />
          {!form.focus && seasonal && (
            <button className="text-xs text-[#C41E3A] mt-1" onClick={() => setForm({ ...form, focus: seasonal.focus })}>Use the suggested seasonal focus</button>
          )}
        </Field>
        <div>
          <div className="text-xs font-semibold text-gray-600 mb-2">Monthly targets</div>
          <div className="grid grid-cols-2 gap-3">
            {(Object.keys(TARGET_LABELS) as (keyof Targets)[]).map(k => (
              <Field key={k} label={TARGET_LABELS[k]}>
                <input type="number" min={0} className={input} value={form.targets[k]}
                  onChange={e => setForm({ ...form, targets: { ...form.targets, [k]: Number(e.target.value || 0) } })} />
              </Field>
            ))}
          </div>
        </div>
        <Field label="Notes"><textarea className={input} rows={3} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></Field>
        <div className="flex items-center justify-end gap-3">
          {saved && <span className="text-sm text-green-700">Saved</span>}
          <button className={btnPrimary} onClick={save} disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Save plan</button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-bold">Foundations</h3>
          <span className="text-sm text-gray-500">{done} / {SETUP_ITEMS.length} in place</span>
        </div>
        <p className="text-xs text-gray-500 mb-4">Set these up once. They count for 15 points of the score every month.</p>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-5">
          <div className="h-full bg-[#C41E3A]" style={{ width: `${(done / SETUP_ITEMS.length) * 100}%` }} />
        </div>
        <div className="space-y-5">
          {groups.map(g => (
            <div key={g}>
              <div className="text-xs font-bold uppercase text-gray-500 mb-2">{g}</div>
              <ul className="space-y-2">
                {SETUP_ITEMS.filter(i => i.group === g).map(i => {
                  const row = setup.find(s => s.item_key === i.key);
                  return <SetupLine key={i.key} label={i.label} hint={i.hint} row={row} onToggle={(d, ev) => toggle(i.key, d, ev)} />;
                })}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const SetupLine: React.FC<{ label: string; hint?: string; row?: SetupRow; onToggle: (done: boolean, evidence?: string) => void }> = ({ label, hint, row, onToggle }) => {
  const [ev, setEv] = useState(row?.evidence || '');
  const [editing, setEditing] = useState(false);
  useEffect(() => setEv(row?.evidence || ''), [row?.evidence]);
  return (
    <li className="text-sm">
      <div className="flex items-start gap-2">
        <button onClick={() => onToggle(!row?.done)} className="mt-0.5">
          {row?.done ? <CheckCircle2 className="h-5 w-5 text-green-600" /> : <Circle className="h-5 w-5 text-gray-300" />}
        </button>
        <div className="flex-1">
          <span className={row?.done ? 'text-gray-500' : ''}>{label}</span>
          {row?.done && row.done_at && <span className="text-xs text-gray-400 ml-2">{fmtDate(row.done_at)}</span>}
          {hint && !row?.evidence && <div className="text-xs text-gray-400">{hint}</div>}
          {row?.evidence && !editing && (
            <div className="text-xs text-blue-700 break-all">
              {/^https?:\/\//.test(row.evidence) ? <a href={row.evidence} target="_blank" rel="noreferrer">{row.evidence}</a> : row.evidence}
            </div>
          )}
          {editing ? (
            <div className="flex gap-2 mt-1">
              <input className={input + ' py-1'} placeholder="Link or note" value={ev} onChange={e => setEv(e.target.value)} />
              <button className="text-xs text-[#C41E3A] font-semibold" onClick={() => { onToggle(!!row?.done, ev); setEditing(false); }}>Save</button>
            </div>
          ) : (
            <button className="text-xs text-gray-400 hover:text-gray-700" onClick={() => setEditing(true)}>{row?.evidence ? 'Edit evidence' : 'Add evidence'}</button>
          )}
        </div>
      </div>
    </li>
  );
};

// ===========================================================================
// Prospects
// ===========================================================================
type DocLite = { id: string; name: string; url: string };

const emptyProspect = (franchiseeId: string): Partial<Prospect> => ({
  franchisee_id: franchiseeId, business_name: '', segment: 'managing_agent', stage: 'identified', priority: 'M',
  est_annual_value: 0, popia_consent: false,
});

const ProspectsTab: React.FC<{
  prospects: Prospect[]; franchiseeId: string; userName: string; brand: string; territory: string; phone: string;
  documents: DocLite[]; onChanged: () => void;
}> = ({ prospects, franchiseeId, userName, brand, territory, phone, documents, onChanged }) => {
  const [stage, setStage] = useState<'open' | 'all' | ProspectStage>('open');
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<Partial<Prospect> | null>(null);
  const [action, setAction] = useState<{ p: Prospect; mode: 'info' | 'log' } | null>(null);
  const today = todayYmd();

  const rows = prospects
    .filter(p => stage === 'all' || (stage === 'open' ? !['won', 'lost'].includes(p.stage) : p.stage === stage))
    .filter(p => !q || [p.business_name, p.contact_name, p.suburb, p.email].join(' ').toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (a.next_action_date || '9999').localeCompare(b.next_action_date || '9999'));

  const counts = STAGES.map(s => ({ ...s, n: prospects.filter(p => p.stage === s.key).length }));

  const exportCsv = () => downloadCsv(`prospects-${franchiseeId}.csv`, [
    ['Business', 'Segment', 'Contact', 'Role', 'Phone', 'Email', 'Suburb', 'Stage', 'Priority', 'Est. annual value', 'Next action', 'Next action date', 'Last contact', 'POPIA consent', 'Created'],
    ...rows.map(p => [p.business_name, segmentLabel(p.segment), p.contact_name, p.contact_role, p.phone, p.email, p.suburb, stageOf(p.stage).label, p.priority,
      p.est_annual_value, p.next_action, p.next_action_date, p.last_contact_date, p.popia_consent ? 'Yes' : 'No', p.created_at.slice(0, 10)]),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex flex-wrap gap-1.5">
          {[{ key: 'open', label: 'Open', n: prospects.filter(p => !['won', 'lost'].includes(p.stage)).length }, { key: 'all', label: 'All', n: prospects.length }, ...counts]
            .map(s => (
              <button key={s.key} onClick={() => setStage(s.key as any)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${stage === s.key ? 'bg-[#1a1a1a] text-white border-[#1a1a1a]' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
                {s.label} <span className="opacity-60">{s.n}</span>
              </button>
            ))}
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="h-4 w-4 text-gray-400 absolute left-2.5 top-2.5" />
            <input className={input + ' pl-8 w-48'} placeholder="Search" value={q} onChange={e => setQ(e.target.value)} />
          </div>
          <button className={btnGhost} onClick={exportCsv}><Download className="h-4 w-4" />CSV</button>
          <button className={btnPrimary} onClick={() => setEditing(emptyProspect(franchiseeId))}><Plus className="h-4 w-4" />Add prospect</button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
        {rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">
            No prospects here yet. Start with managing agents, estate agents and insurance brokers in your territory: one of them can send you work every month.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-gray-500 uppercase border-b bg-gray-50">
              <tr><th className="p-3">Prospect</th><th>Segment</th><th>Stage</th><th>Next step</th><th className="text-right">Est. value / yr</th><th className="text-right pr-3">Actions</th></tr>
            </thead>
            <tbody className="divide-y">
              {rows.map(p => {
                const st = stageOf(p.stage);
                const overdue = p.next_action_date && p.next_action_date < today && !['won', 'lost'].includes(p.stage);
                return (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="p-3">
                      <div className="font-semibold flex items-center gap-2">
                        {p.business_name}
                        {p.priority === 'H' && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-bold">HIGH</span>}
                      </div>
                      <div className="text-xs text-gray-500">{[p.contact_name, p.contact_role, p.suburb].filter(Boolean).join(' · ')}</div>
                    </td>
                    <td className="text-xs text-gray-600">{segmentLabel(p.segment)}</td>
                    <td><span className={`px-2 py-1 rounded text-xs font-semibold ${st.cls}`}>{st.label}</span></td>
                    <td className="text-xs">
                      <div className={overdue ? 'text-red-600 font-semibold' : 'text-gray-700'}>{p.next_action_date ? fmtDate(p.next_action_date) : '—'}{overdue ? ' · overdue' : ''}</div>
                      <div className="text-gray-500 truncate max-w-[220px]">{p.next_action}</div>
                    </td>
                    <td className="text-right">{p.est_annual_value ? rand(Number(p.est_annual_value)) : '—'}</td>
                    <td className="pr-3">
                      <div className="flex justify-end gap-1">
                        <button title="Send info" onClick={() => setAction({ p, mode: 'info' })} className="p-1.5 rounded hover:bg-indigo-50 text-indigo-700"><Send className="h-4 w-4" /></button>
                        <button title="Log a call, visit or meeting" onClick={() => setAction({ p, mode: 'log' })} className="p-1.5 rounded hover:bg-amber-50 text-amber-700"><CalendarCheck className="h-4 w-4" /></button>
                        <button title="Edit" onClick={() => setEditing(p)} className="p-1.5 rounded hover:bg-gray-100 text-gray-600"><Pencil className="h-4 w-4" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {editing && <ProspectForm initial={editing} userName={userName} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); onChanged(); }} />}
      {action?.mode === 'info' && (
        <SendInfoDialog p={action.p} brand={brand} territory={territory} phone={phone} userName={userName} documents={documents}
          onClose={() => setAction(null)} onDone={() => { setAction(null); onChanged(); }} />
      )}
      {action?.mode === 'log' && (
        <LogContactDialog p={action.p} userName={userName} onClose={() => setAction(null)} onDone={() => { setAction(null); onChanged(); }} />
      )}
    </div>
  );
};

const ProspectForm: React.FC<{ initial: Partial<Prospect>; userName: string; onClose: () => void; onSaved: () => void }> = ({ initial, userName, onClose, onSaved }) => {
  const [p, setP] = useState<Partial<Prospect>>(initial);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof Prospect, v: any) => setP(prev => ({ ...prev, [k]: v }));

  const save = async () => {
    if (!p.business_name?.trim()) { alert('Business name is required'); return; }
    setBusy(true);
    const row: any = {
      franchisee_id: p.franchisee_id, business_name: p.business_name.trim(), segment: p.segment, contact_name: p.contact_name || null,
      contact_role: p.contact_role || null, phone: p.phone || null, email: p.email || null, suburb: p.suburb || null, address: p.address || null,
      source: p.source || null, stage: p.stage, priority: p.priority, est_annual_value: Number(p.est_annual_value || 0),
      next_action: p.next_action || null, next_action_date: p.next_action_date || null, meeting_at: p.meeting_at || null,
      popia_consent: !!p.popia_consent, notes: p.notes || null, lost_reason: p.stage === 'lost' ? (p.lost_reason || null) : null,
    };
    if (p.popia_consent && !initial.popia_consent) row.popia_consent_at = new Date().toISOString();
    if (p.stage === 'won' && initial.stage !== 'won') row.won_at = new Date().toISOString();
    const res = p.id
      ? await supabase.from('mkt_prospects').update(row).eq('id', p.id)
      : await supabase.from('mkt_prospects').insert({ ...row, created_by: userName });
    setBusy(false);
    if (res.error) { alert(res.error.message); return; }
    onSaved();
  };

  const remove = async () => {
    if (!p.id || !confirm(`Delete ${p.business_name}? Its logged activities stay in the activity log.`)) return;
    const { error } = await supabase.from('mkt_prospects').delete().eq('id', p.id);
    if (error) { alert(error.message); return; }
    onSaved();
  };

  return (
    <Modal title={p.id ? 'Edit prospect' : 'Add prospect'} onClose={onClose} wide>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Business name *" className="sm:col-span-2"><input className={input} value={p.business_name || ''} onChange={e => set('business_name', e.target.value)} /></Field>
        <Field label="Segment">
          <select className={input} value={p.segment} onChange={e => set('segment', e.target.value)}>
            {SEGMENTS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </Field>
        <Field label="Priority">
          <select className={input} value={p.priority} onChange={e => set('priority', e.target.value)}>
            <option value="H">High</option><option value="M">Medium</option><option value="L">Low</option>
          </select>
        </Field>
        <Field label="Contact person"><input className={input} value={p.contact_name || ''} onChange={e => set('contact_name', e.target.value)} /></Field>
        <Field label="Role"><input className={input} value={p.contact_role || ''} onChange={e => set('contact_role', e.target.value)} /></Field>
        <Field label="Phone / WhatsApp"><input className={input} value={p.phone || ''} onChange={e => set('phone', e.target.value)} /></Field>
        <Field label="Email"><input type="email" className={input} value={p.email || ''} onChange={e => set('email', e.target.value)} /></Field>
        <Field label="Suburb"><input className={input} value={p.suburb || ''} onChange={e => set('suburb', e.target.value)} /></Field>
        <Field label="Address"><input className={input} value={p.address || ''} onChange={e => set('address', e.target.value)} /></Field>
        <Field label="How did you find them?"><input className={input} placeholder="Drove past, referral, Google Maps, BNI…" value={p.source || ''} onChange={e => set('source', e.target.value)} /></Field>
        <Field label="Estimated annual value (R)"><input type="number" className={input} value={p.est_annual_value ?? ''} onChange={e => set('est_annual_value', e.target.value)} /></Field>
        <Field label="Stage">
          <select className={input} value={p.stage} onChange={e => set('stage', e.target.value)}>
            {STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </Field>
        <Field label="Meeting date / time"><input type="datetime-local" className={input} value={toLocalInput(p.meeting_at)} onChange={e => set('meeting_at', e.target.value ? new Date(e.target.value).toISOString() : null)} /></Field>
        <Field label="Next step"><input className={input} placeholder="e.g. Drop off profile, follow-up call" value={p.next_action || ''} onChange={e => set('next_action', e.target.value)} /></Field>
        <Field label="Next step date"><input type="date" className={input} value={p.next_action_date || ''} onChange={e => set('next_action_date', e.target.value)} /></Field>
        {p.stage === 'lost' && <Field label="Why lost?" className="sm:col-span-2"><input className={input} value={p.lost_reason || ''} onChange={e => set('lost_reason', e.target.value)} /></Field>}
        <Field label="Notes" className="sm:col-span-2"><textarea className={input} rows={3} value={p.notes || ''} onChange={e => set('notes', e.target.value)} /></Field>
        <label className="sm:col-span-2 flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1" checked={!!p.popia_consent} onChange={e => set('popia_consent', e.target.checked)} />
          <span>They agreed to receive marketing from us (POPIA). Only send newsletters and offers to prospects who have agreed. A first introduction asking for consent is fine.</span>
        </label>
      </div>
      <div className="flex justify-between mt-5">
        {p.id ? <button className={`${btn} text-red-600 hover:bg-red-50`} onClick={remove}><Trash2 className="h-4 w-4" />Delete</button> : <span />}
        <div className="flex gap-2">
          <button className={btnGhost} onClick={onClose}>Cancel</button>
          <button className={btnPrimary} onClick={save} disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Save</button>
        </div>
      </div>
    </Modal>
  );
};

const stageRank = (s: string) => STAGES.findIndex(x => x.key === s);

const SendInfoDialog: React.FC<{
  p: Prospect; brand: string; territory: string; phone: string; userName: string; documents: DocLite[]; onClose: () => void; onDone: () => void;
}> = ({ p, brand, territory, phone, userName, documents, onClose, onDone }) => {
  const [docId, setDocId] = useState(documents.find(d => /profile/i.test(d.name))?.id || '');
  const doc = documents.find(d => d.id === docId);
  const tpl = infoTemplate(p.segment, { contact: (p.contact_name || '').split(' ')[0], brand, territory, sender: userName, phone, link: doc?.url });
  const [subject, setSubject] = useState(tpl.subject);
  const [body, setBody] = useState(tpl.body);
  const [followUp, setFollowUp] = useState(addDays(todayYmd(), 5));
  const [busy, setBusy] = useState(false);
  useEffect(() => { setBody(tpl.body); }, [docId]);

  const record = async (via: 'email' | 'whatsapp' | 'manual') => {
    setBusy(true);
    const today = todayYmd();
    const a = await supabase.from('mkt_activities').insert({
      franchisee_id: p.franchisee_id, prospect_id: p.id, activity_date: today, channel: SEGMENT_CHANNEL[p.segment] || 'commercial',
      activity_type: 'info_sent', description: `Info sent by ${via}${doc ? ` (${doc.name})` : ''} to ${p.business_name}`, created_by: userName,
    });
    const upd: any = { last_contact_date: today, next_action: 'Follow up on info sent', next_action_date: followUp || null };
    if (stageRank(p.stage) < stageRank('info_sent')) upd.stage = 'info_sent';
    const b = await supabase.from('mkt_prospects').update(upd).eq('id', p.id);
    setBusy(false);
    if (a.error || b.error) { alert((a.error || b.error)!.message); return; }
    onDone();
  };

  const sendEmail = () => {
    window.open(`mailto:${encodeURIComponent(p.email || '')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank');
    record('email');
  };
  const sendWa = () => {
    window.open(`https://wa.me/${waNumber(p.phone)}?text=${encodeURIComponent(body)}`, '_blank');
    record('whatsapp');
  };

  return (
    <Modal title={`Send info to ${p.business_name}`} onClose={onClose} wide>
      <div className="space-y-3">
        <Field label="Attach a document from the Document Vault (sent as a link)">
          <select className={input} value={docId} onChange={e => setDocId(e.target.value)}>
            <option value="">No document</option>
            {documents.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </Field>
        <Field label="Subject (email)"><input className={input} value={subject} onChange={e => setSubject(e.target.value)} /></Field>
        <Field label="Message — edit it so it sounds like you"><textarea className={input + ' font-mono text-xs'} rows={12} value={body} onChange={e => setBody(e.target.value)} /></Field>
        <Field label="Follow-up date"><input type="date" className={input} value={followUp} onChange={e => setFollowUp(e.target.value)} /></Field>
        <p className="text-xs text-gray-500">Sending opens your email or WhatsApp with the message ready. It is logged here as "Info sent" and the prospect moves to Info sent.</p>
        <div className="flex flex-wrap justify-end gap-2 pt-2">
          <button className={btnGhost} onClick={() => record('manual')} disabled={busy}>I sent it another way</button>
          <button className={btnGhost} onClick={sendWa} disabled={busy || !p.phone}><MessageCircle className="h-4 w-4" />WhatsApp</button>
          <button className={btnPrimary} onClick={sendEmail} disabled={busy || !p.email}><Mail className="h-4 w-4" />Email</button>
        </div>
      </div>
    </Modal>
  );
};

const LogContactDialog: React.FC<{ p: Prospect; userName: string; onClose: () => void; onDone: () => void }> = ({ p, userName, onClose, onDone }) => {
  const [f, setF] = useState({
    type: p.stage === 'meeting_booked' ? 'meeting' : 'call', date: todayYmd(), notes: '',
    stage: p.stage as ProspectStage, next_action: '', next_action_date: addDays(todayYmd(), 7),
    meeting_at: '', value: String(p.est_annual_value || ''), jobs: '0', revenue: '0',
  });
  const [busy, setBusy] = useState(false);

  // Suggest the stage that follows from what happened
  useEffect(() => {
    if (f.type === 'meeting' && stageRank(p.stage) < stageRank('met')) setF(x => ({ ...x, stage: 'met' }));
    if (f.type === 'proposal' && stageRank(p.stage) < stageRank('proposal')) setF(x => ({ ...x, stage: 'proposal' }));
    if (['call', 'whatsapp', 'visit'].includes(f.type) && p.stage === 'identified') setF(x => ({ ...x, stage: 'contacted' }));
  }, [f.type]);

  const save = async () => {
    setBusy(true);
    const a = await supabase.from('mkt_activities').insert({
      franchisee_id: p.franchisee_id, prospect_id: p.id, activity_date: f.date, channel: SEGMENT_CHANNEL[p.segment] || 'commercial',
      activity_type: f.type, description: `${activityLabel(f.type)} — ${p.business_name}${f.notes ? ': ' + f.notes : ''}`,
      jobs_won: Number(f.jobs || 0), revenue: Number(f.revenue || 0), created_by: userName,
    });
    const upd: any = {
      stage: f.stage, last_contact_date: f.date, next_action: f.next_action || null, next_action_date: f.next_action_date || null,
      est_annual_value: Number(f.value || 0),
    };
    if (f.stage === 'meeting_booked' && f.meeting_at) upd.meeting_at = new Date(f.meeting_at).toISOString();
    if (f.stage === 'won' && p.stage !== 'won') upd.won_at = new Date().toISOString();
    if (f.notes) upd.notes = [p.notes, `${f.date}: ${f.notes}`].filter(Boolean).join('\n');
    const b = await supabase.from('mkt_prospects').update(upd).eq('id', p.id);
    setBusy(false);
    if (a.error || b.error) { alert((a.error || b.error)!.message); return; }
    onDone();
  };

  return (
    <Modal title={`Log contact — ${p.business_name}`} onClose={onClose}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="What happened">
          <select className={input} value={f.type} onChange={e => setF({ ...f, type: e.target.value })}>
            {['call', 'whatsapp', 'visit', 'meeting', 'proposal'].map(k => <option key={k} value={k}>{activityLabel(k)}</option>)}
          </select>
        </Field>
        <Field label="Date"><input type="date" className={input} value={f.date} onChange={e => setF({ ...f, date: e.target.value })} /></Field>
        <Field label="Notes" className="col-span-2"><textarea className={input} rows={3} value={f.notes} onChange={e => setF({ ...f, notes: e.target.value })} /></Field>
        <Field label="Stage now">
          <select className={input} value={f.stage} onChange={e => setF({ ...f, stage: e.target.value as ProspectStage })}>
            {STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </Field>
        <Field label="Est. annual value (R)"><input type="number" className={input} value={f.value} onChange={e => setF({ ...f, value: e.target.value })} /></Field>
        {f.stage === 'meeting_booked' && (
          <Field label="Meeting date / time" className="col-span-2"><input type="datetime-local" className={input} value={f.meeting_at} onChange={e => setF({ ...f, meeting_at: e.target.value })} /></Field>
        )}
        {f.stage === 'won' && (<>
          <Field label="Jobs from this so far"><input type="number" className={input} value={f.jobs} onChange={e => setF({ ...f, jobs: e.target.value })} /></Field>
          <Field label="Revenue so far (R)"><input type="number" className={input} value={f.revenue} onChange={e => setF({ ...f, revenue: e.target.value })} /></Field>
        </>)}
        <Field label="Next step"><input className={input} value={f.next_action} onChange={e => setF({ ...f, next_action: e.target.value })} /></Field>
        <Field label="Next step date"><input type="date" className={input} value={f.next_action_date} onChange={e => setF({ ...f, next_action_date: e.target.value })} /></Field>
      </div>
      <div className="flex justify-end gap-2 mt-5">
        <button className={btnGhost} onClick={onClose}>Cancel</button>
        <button className={btnPrimary} onClick={save} disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Save</button>
      </div>
    </Modal>
  );
};

// ===========================================================================
// Activity log
// ===========================================================================
const ActivitiesTab: React.FC<{ month: string; activities: Activity[]; prospects: Prospect[]; franchiseeId: string; userName: string; onChanged: () => void }> =
  ({ month, activities, prospects, franchiseeId, userName, onChanged }) => {
  const [adding, setAdding] = useState(false);
  const rows = activities.filter(a => inMonth(a.activity_date, month));
  const pname = (id: string | null) => prospects.find(p => p.id === id)?.business_name || '';

  const remove = async (a: Activity) => {
    if (!confirm('Delete this activity?')) return;
    const { error } = await supabase.from('mkt_activities').delete().eq('id', a.id);
    if (error) { alert(error.message); return; }
    onChanged();
  };

  const exportCsv = () => downloadCsv(`marketing-activities-${franchiseeId}-${month.slice(0, 7)}.csv`, [
    ['Date', 'Channel', 'Type', 'Prospect', 'Description', 'Qty', 'Cost', 'Leads', 'Jobs', 'Revenue', 'Logged by'],
    ...rows.map(a => [a.activity_date, channelLabel(a.channel), activityLabel(a.activity_type), pname(a.prospect_id), a.description, a.quantity, a.cost, a.leads, a.jobs_won, a.revenue, a.created_by]),
  ]);

  const tot = rows.reduce((s, a) => ({ cost: s.cost + Number(a.cost || 0), leads: s.leads + (a.leads || 0), jobs: s.jobs + (a.jobs_won || 0), revenue: s.revenue + Number(a.revenue || 0) }), { cost: 0, leads: 0, jobs: 0, revenue: 0 });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500">{rows.length} activities in {monthLabel(month)} · {rand(tot.cost)} spent · {tot.leads} leads · {tot.jobs} jobs · {rand(tot.revenue)}</p>
        <div className="flex gap-2">
          <button className={btnGhost} onClick={exportCsv}><Download className="h-4 w-4" />CSV</button>
          <button className={btnPrimary} onClick={() => setAdding(true)}><Plus className="h-4 w-4" />Log activity</button>
        </div>
      </div>
      <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
        {rows.length === 0 ? <div className="p-8 text-center text-sm text-gray-500">Nothing logged for this month. Log every review request batch, post, drop, visit and ad spend: it all counts.</div> : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-gray-500 uppercase border-b bg-gray-50">
              <tr><th className="p-3">Date</th><th>Channel</th><th>What</th><th className="text-right">Qty</th><th className="text-right">Cost</th><th className="text-right">Leads</th><th className="text-right">Jobs</th><th className="text-right">Revenue</th><th /></tr>
            </thead>
            <tbody className="divide-y">
              {rows.map(a => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="p-3 whitespace-nowrap">{fmtDate(a.activity_date)}</td>
                  <td className="text-xs">{channelLabel(a.channel)}</td>
                  <td>
                    <div className="font-medium">{activityLabel(a.activity_type)}{a.prospect_id ? ` · ${pname(a.prospect_id)}` : ''}</div>
                    {a.description && <div className="text-xs text-gray-500">{a.description}</div>}
                  </td>
                  <td className="text-right">{a.quantity}</td>
                  <td className="text-right">{a.cost ? rand(a.cost) : '—'}</td>
                  <td className="text-right">{a.leads || '—'}</td>
                  <td className="text-right">{a.jobs_won || '—'}</td>
                  <td className="text-right">{a.revenue ? rand(a.revenue) : '—'}</td>
                  <td className="pr-3 text-right"><button onClick={() => remove(a)} className="p-1.5 text-gray-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {adding && <ActivityForm franchiseeId={franchiseeId} prospects={prospects} userName={userName} month={month} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); onChanged(); }} />}
    </div>
  );
};

const TYPE_FOR_CHANNEL: Record<string, string> = {
  gbp: 'gbp_post', reviews: 'review_request', google_ads: 'ad_spend', meta_ads: 'ad_spend', short_video: 'content_post',
  five_around: 'street_drop', reactivation: 'reactivation', community_events: 'event', whatsapp_business: 'whatsapp',
  community_groups: 'content_post', networking: 'meeting',
};

const ActivityForm: React.FC<{ franchiseeId: string; prospects: Prospect[]; userName: string; month: string; onClose: () => void; onSaved: () => void }> =
  ({ franchiseeId, prospects, userName, month, onClose, onSaved }) => {
  const defaultDate = inMonth(todayYmd(), month) ? todayYmd() : month;
  const [f, setF] = useState({ channel: 'reviews', activity_type: 'review_request', activity_date: defaultDate, description: '', quantity: '1', cost: '0', leads: '0', jobs_won: '0', revenue: '0', prospect_id: '' });
  const [busy, setBusy] = useState(false);
  const ch = CHANNELS.find(c => c.key === f.channel);

  const save = async () => {
    setBusy(true);
    const { error } = await supabase.from('mkt_activities').insert({
      franchisee_id: franchiseeId, prospect_id: f.prospect_id || null, activity_date: f.activity_date, channel: f.channel,
      activity_type: f.activity_type, description: f.description || null, quantity: Math.max(1, Number(f.quantity || 1)),
      cost: Number(f.cost || 0), leads: Number(f.leads || 0), jobs_won: Number(f.jobs_won || 0), revenue: Number(f.revenue || 0), created_by: userName,
    });
    setBusy(false);
    if (error) { alert(error.message); return; }
    onSaved();
  };

  return (
    <Modal title="Log marketing activity" onClose={onClose} wide>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Channel">
          <select className={input} value={f.channel} onChange={e => setF({ ...f, channel: e.target.value, activity_type: TYPE_FOR_CHANNEL[e.target.value] || f.activity_type })}>
            {CHANNEL_GROUPS.map(g => (
              <optgroup key={g.key} label={g.label}>
                {CHANNELS.filter(c => c.group === g.key).map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
              </optgroup>
            ))}
          </select>
        </Field>
        <Field label="Type">
          <select className={input} value={f.activity_type} onChange={e => setF({ ...f, activity_type: e.target.value })}>
            {ACTIVITY_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
        </Field>
        {ch && ch.measure && <div className="sm:col-span-2 text-xs text-gray-500 -mt-1">Measure: {ch.measure}</div>}
        <Field label="Date"><input type="date" className={input} value={f.activity_date} onChange={e => setF({ ...f, activity_date: e.target.value })} /></Field>
        <Field label="Quantity (e.g. 15 review requests, 3 posts)"><input type="number" min={1} className={input} value={f.quantity} onChange={e => setF({ ...f, quantity: e.target.value })} /></Field>
        <Field label="Prospect (optional)" className="sm:col-span-2">
          <select className={input} value={f.prospect_id} onChange={e => setF({ ...f, prospect_id: e.target.value })}>
            <option value="">—</option>
            {prospects.filter(p => p.stage !== 'lost').map(p => <option key={p.id} value={p.id}>{p.business_name}</option>)}
          </select>
        </Field>
        <Field label="Description" className="sm:col-span-2"><input className={input} value={f.description} onChange={e => setF({ ...f, description: e.target.value })} /></Field>
        <Field label="Cost (R)"><input type="number" className={input} value={f.cost} onChange={e => setF({ ...f, cost: e.target.value })} /></Field>
        <Field label="Leads generated"><input type="number" className={input} value={f.leads} onChange={e => setF({ ...f, leads: e.target.value })} /></Field>
        <Field label="Jobs won"><input type="number" className={input} value={f.jobs_won} onChange={e => setF({ ...f, jobs_won: e.target.value })} /></Field>
        <Field label="Revenue from those jobs (R)"><input type="number" className={input} value={f.revenue} onChange={e => setF({ ...f, revenue: e.target.value })} /></Field>
      </div>
      <p className="text-xs text-gray-500 mt-3">Results can be added later as a separate entry (e.g. at month end: "Google Ads — 42 leads, 18 jobs").</p>
      <div className="flex justify-end gap-2 mt-4">
        <button className={btnGhost} onClick={onClose}>Cancel</button>
        <button className={btnPrimary} onClick={save} disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Save</button>
      </div>
    </Modal>
  );
};

// ===========================================================================
// Playbook
// ===========================================================================
const Playbook: React.FC<{ month: string }> = ({ month }) => {
  const [open, setOpen] = useState<string | null>(null);
  const m = Number(month.slice(5, 7));
  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="font-bold mb-1">The rules</h3>
        <ul className="text-sm text-gray-700 list-disc pl-5 space-y-1">
          <li>There are only three ways to grow: more new customers, existing customers using you more often, and a bigger average job.</li>
          <li>80–90% of your customers live, work or shop within 40 minutes of you. Market inside your territory only.</li>
          <li>Answer the phone and WhatsApp every time, 24/7. Every missed call is marketing money lost.</li>
          <li>Quote on site. Ask for a review on every job. Offer rand-value savings, not percentages, and run promotions for a month, not a day.</li>
          <li>Log it here, or it did not happen: Head Office scores your marketing from this log.</li>
        </ul>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="font-bold mb-3">Seasonal calendar</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {SEASONAL.map(s => (
            <div key={s.month} className={`rounded-lg p-3 text-sm border ${s.month === m ? 'border-[#C41E3A] bg-red-50' : 'border-gray-200'}`}>
              <div className="font-semibold mb-1">{new Date(2026, s.month - 1, 1).toLocaleDateString('en-ZA', { month: 'long' })}</div>
              <div className="text-gray-600 text-xs">{s.focus}</div>
            </div>
          ))}
        </div>
      </div>

      {CHANNEL_GROUPS.map(g => {
        const chans = CHANNELS.filter(c => c.group === g.key && c.key !== 'other');
        if (!chans.length) return null;
        return (
          <div key={g.key}>
            <h3 className="font-bold mb-2">{g.label}</h3>
            <div className="space-y-2">
              {chans.map(c => (
                <div key={c.key} className="bg-white border border-gray-200 rounded-xl">
                  <button onClick={() => setOpen(open === c.key ? null : c.key)} className="w-full flex justify-between items-center p-4 text-left">
                    <span className="font-semibold">{c.label}</span>
                    <span className="text-xs text-gray-500">{c.cadence}</span>
                  </button>
                  {open === c.key && (
                    <div className="px-4 pb-4 text-sm space-y-3">
                      <p className="text-gray-700">{c.why}</p>
                      <ul className="list-disc pl-5 space-y-1">{c.how.map(h => <li key={h}>{h}</li>)}</ul>
                      <p className="text-xs text-gray-500"><b>Measure:</b> {c.measure}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}

      <div className="bg-gray-50 border border-gray-200 rounded-xl p-5">
        <h3 className="font-bold mb-3">Do not spend money on these</h3>
        <ul className="space-y-2 text-sm">
          {RETIRED_METHODS.map(r => <li key={r.name}><span className="font-semibold">{r.name}.</span> <span className="text-gray-600">{r.why}</span></li>)}
        </ul>
      </div>
    </div>
  );
};

export default MarketingProgramme;
