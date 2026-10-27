import React, { useState } from 'react';
import { Lead } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { Download, Printer } from 'lucide-react';
import { fmtDate, todayYmd, daysBetween, addDays } from '@/lib/leadProcess';

type Basis = 'signing' | 'launch';
type Range = 'all' | 'overdue' | 'this_month' | 'next_month' | 'next_90' | 'custom';

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-100 text-blue-700',
  qualified: 'bg-green-100 text-green-700',
  negotiating: 'bg-amber-100 text-amber-700',
  converted: 'bg-purple-100 text-purple-700',
  lost: 'bg-gray-100 text-gray-700',
};

const monthKey = (ymd: string) => ymd.slice(0, 7);
const monthLabel = (key: string) => {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' });
};
const monthStart = (offset: number) => {
  const d = new Date();
  const t = new Date(d.getFullYear(), d.getMonth() + offset, 1);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-01`;
};

/** Report of leads by Planned Franchise Agreement signing date or Planned Launch date. */
const LeadPlannedReport: React.FC<{ leads: Lead[]; onOpenLead: (l: Lead) => void }> = ({ leads, onOpenLead }) => {
  const { users } = useAuth();
  const salesUsers = users.filter(u => u.role === 'sales' || u.role === 'admin');
  const [basis, setBasis] = useState<Basis>('signing');
  const [range, setRange] = useState<Range>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [rep, setRep] = useState('all');
  const [includeClosed, setIncludeClosed] = useState(false);

  const today = todayYmd();
  const userName = (id: string) => users.find(u => u.id === id)?.name || 'Unassigned';
  const dateOf = (l: Lead) => (basis === 'signing' ? l.plannedSigningDate : l.plannedLaunchDate) || '';

  const inRange = (d: string) => {
    switch (range) {
      case 'overdue': return d < today;
      case 'this_month': return d >= monthStart(0) && d < monthStart(1);
      case 'next_month': return d >= monthStart(1) && d < monthStart(2);
      case 'next_90': return d >= today && d <= addDays(today, 90);
      case 'custom': return (!from || d >= from) && (!to || d <= to);
      default: return true;
    }
  };

  const scoped = leads.filter(l =>
    (includeClosed || (l.status !== 'lost' && l.status !== 'converted')) &&
    (rep === 'all' || (l.assignedTo || '') === rep));

  const rows = scoped
    .filter(l => dateOf(l) && inRange(dateOf(l)))
    // "Overdue" only makes sense for leads that have not signed yet
    .filter(l => range !== 'overdue' || l.status !== 'converted')
    .sort((a, b) => dateOf(a).localeCompare(dateOf(b)));
  const undated = scoped.filter(l => !l.plannedSigningDate && !l.plannedLaunchDate);

  const groups: { key: string; rows: Lead[] }[] = [];
  for (const r of rows) {
    const k = monthKey(dateOf(r));
    const g = groups.find(x => x.key === k);
    if (g) g.rows.push(r); else groups.push({ key: k, rows: [r] });
  }

  // Headline tiles always use active leads and both dates
  const activeLeads = leads.filter(l => l.status !== 'lost' && l.status !== 'converted');
  const signThisMonth = activeLeads.filter(l => l.plannedSigningDate && l.plannedSigningDate >= monthStart(0) && l.plannedSigningDate < monthStart(1)).length;
  const signNextMonth = activeLeads.filter(l => l.plannedSigningDate && l.plannedSigningDate >= monthStart(1) && l.plannedSigningDate < monthStart(2)).length;
  const launch90 = leads.filter(l => l.status !== 'lost' && l.plannedLaunchDate && l.plannedLaunchDate >= today && l.plannedLaunchDate <= addDays(today, 90)).length;
  const slipped = activeLeads.filter(l => l.plannedSigningDate && l.plannedSigningDate < today).length;

  const exportCsv = () => {
    const header = ['Contact', 'Email', 'Phone', 'Division', 'Area', 'Sales rep', 'Status', 'Planned FA signing', 'Planned launch'];
    const esc = (v: string) => `"${(v || '').replace(/"/g, '""')}"`;
    const lines = [header.map(esc).join(',')].concat(rows.map(l => [
      l.contactName, l.email, l.phone, l.division || '', l.area, userName(l.assignedTo), l.status,
      l.plannedSigningDate || '', l.plannedLaunchDate || '',
    ].map(esc).join(',')));
    const blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `planned-${basis}-dates-${today}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const sel = 'px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#C41E3A] bg-white';

  return (
    <div className="space-y-4 planned-report">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Tile label="Signings planned this month" value={signThisMonth} />
        <Tile label="Signings planned next month" value={signNextMonth} />
        <Tile label="Launches in next 90 days" value={launch90} />
        <Tile label="Signing date passed, not signed" value={slipped} warn={slipped > 0} />
      </div>

      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <div className="flex rounded-lg border border-gray-200 overflow-hidden">
          {(['signing', 'launch'] as Basis[]).map(b => (
            <button key={b} onClick={() => setBasis(b)}
              className={`px-4 py-2 text-sm font-semibold ${basis === b ? 'bg-[#1a1a1a] text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}>
              {b === 'signing' ? 'By planned FA signing' : 'By planned launch'}
            </button>
          ))}
        </div>
        <select value={range} onChange={e => setRange(e.target.value as Range)} className={sel}>
          <option value="all">All dates</option>
          <option value="overdue">Date passed</option>
          <option value="this_month">This month</option>
          <option value="next_month">Next month</option>
          <option value="next_90">Next 90 days</option>
          <option value="custom">Custom range…</option>
        </select>
        {range === 'custom' && (
          <>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} className={sel} />
            <span className="text-sm text-gray-500">to</span>
            <input type="date" value={to} onChange={e => setTo(e.target.value)} className={sel} />
          </>
        )}
        <select value={rep} onChange={e => setRep(e.target.value)} className={sel}>
          <option value="all">All reps</option>
          {salesUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          <option value="">Unassigned</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
          <input type="checkbox" checked={includeClosed} onChange={e => setIncludeClosed(e.target.checked)} className="accent-[#C41E3A]" />
          Include converted & lost
        </label>
        <div className="ml-auto flex gap-2">
          <button onClick={exportCsv} className="px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm font-semibold flex items-center gap-1.5 hover:bg-gray-50">
            <Download className="h-4 w-4" /> CSV
          </button>
          <button onClick={() => window.print()} className="px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm font-semibold flex items-center gap-1.5 hover:bg-gray-50">
            <Printer className="h-4 w-4" /> Print
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['Contact', 'Division', 'Area', 'Sales rep', 'Status', 'Planned FA signing', 'Planned launch', ''].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.length === 0 && (
              <tr><td colSpan={8} className="text-center py-10 text-gray-500">No leads with a planned {basis === 'signing' ? 'signing' : 'launch'} date in this range.</td></tr>
            )}
            {groups.map(g => (
              <React.Fragment key={g.key}>
                <tr className="bg-gray-100">
                  <td colSpan={8} className="px-4 py-2 text-sm font-bold text-gray-800">
                    {monthLabel(g.key)} <span className="font-normal text-gray-500">· {g.rows.length} lead{g.rows.length === 1 ? '' : 's'}</span>
                  </td>
                </tr>
                {g.rows.map(l => {
                  const d = dateOf(l);
                  const diff = daysBetween(today, d);
                  const late = diff < 0 && l.status !== 'converted' && l.status !== 'lost';
                  return (
                    <tr key={l.id} className="border-t border-gray-100 hover:bg-gray-50 cursor-pointer" onClick={() => onOpenLead(l)}>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-gray-900 text-sm">{l.contactName}</div>
                        <div className="text-xs text-gray-500">{l.phone}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{l.division || '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{l.area || '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{userName(l.assignedTo)}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${STATUS_COLORS[l.status] || 'bg-gray-100 text-gray-700'}`}>{l.status}</span>
                      </td>
                      <td className={`px-4 py-3 text-sm ${basis === 'signing' ? 'font-semibold' : ''} text-gray-800`}>{fmtDate(l.plannedSigningDate)}</td>
                      <td className={`px-4 py-3 text-sm ${basis === 'launch' ? 'font-semibold' : ''} text-gray-800`}>{fmtDate(l.plannedLaunchDate)}</td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap">
                        {late
                          ? <span className="text-red-600 font-semibold">{-diff} days past</span>
                          : diff >= 0 ? <span className="text-gray-500">in {diff} day{diff === 1 ? '' : 's'}</span> : null}
                      </td>
                    </tr>
                  );
                })}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {undated.length > 0 && (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-4 print:hidden">
          <div className="text-sm font-bold text-gray-900 mb-1">{undated.length} lead{undated.length === 1 ? '' : 's'} with no planned dates</div>
          <div className="flex flex-wrap gap-2 mt-2">
            {undated.map(l => (
              <button key={l.id} onClick={() => onOpenLead(l)}
                className="px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200">
                {l.contactName}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const Tile: React.FC<{ label: string; value: number; warn?: boolean }> = ({ label, value, warn }) => (
  <div className={`rounded-xl p-4 border ${warn ? 'border-red-200 bg-red-50 text-red-700' : 'border-gray-200 bg-white text-gray-900'}`}>
    <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</div>
    <div className="text-2xl font-bold">{value}</div>
  </div>
);

export default LeadPlannedReport;
