import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { History, Search, RefreshCw, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

interface AuditRow {
  id: string;
  user_id: string | null;
  email: string;
  ip: string | null;
  user_agent: string | null;
  success: boolean;
  error_message: string | null;
  created_at: string;
}

type SuccessFilter = 'all' | 'success' | 'fail';

const LoginHistoryPage: React.FC = () => {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [emailFilter, setEmailFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<SuccessFilter>('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('login_audit')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    if (!error && data) setRows(data as AuditRow[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (emailFilter && !r.email.toLowerCase().includes(emailFilter.toLowerCase())) return false;
      if (statusFilter === 'success' && !r.success) return false;
      if (statusFilter === 'fail' && r.success) return false;
      if (fromDate) {
        const f = new Date(fromDate).getTime();
        if (new Date(r.created_at).getTime() < f) return false;
      }
      if (toDate) {
        // inclusive: end of selected day
        const t = new Date(toDate).getTime() + 24 * 60 * 60 * 1000 - 1;
        if (new Date(r.created_at).getTime() > t) return false;
      }
      return true;
    });
  }, [rows, emailFilter, statusFilter, fromDate, toDate]);

  const successCount = filtered.filter(r => r.success).length;
  const failCount = filtered.length - successCount;

  const fmtDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString();
  };

  const clearFilters = () => {
    setEmailFilter(''); setStatusFilter('all'); setFromDate(''); setToDate('');
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2"><History className="h-5 w-5 text-[#C41E3A]" /> Login History</h2>
          <p className="text-sm text-gray-500">Last 200 sign-in attempts (successful and failed).</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm font-semibold hover:bg-gray-50">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 grid grid-cols-1 md:grid-cols-5 gap-3">
        <div className="md:col-span-2">
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Email contains</label>
          <div className="mt-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input value={emailFilter} onChange={e => setEmailFilter(e.target.value)} placeholder="filter by email…"
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-[#C41E3A]" />
          </div>
        </div>
        <div>
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Status</label>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as SuccessFilter)}
            className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-[#C41E3A]">
            <option value="all">All</option>
            <option value="success">Success only</option>
            <option value="fail">Failed only</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">From</label>
          <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
            className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-[#C41E3A]" />
        </div>
        <div>
          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">To</label>
          <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
            className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:border-[#C41E3A]" />
        </div>
        <div className="md:col-span-5 flex items-center justify-between text-sm text-gray-600">
          <div className="flex items-center gap-4">
            <span><strong>{filtered.length}</strong> matching</span>
            <span className="text-green-700 flex items-center gap-1"><CheckCircle2 className="h-4 w-4" /> {successCount} success</span>
            <span className="text-red-700 flex items-center gap-1"><XCircle className="h-4 w-4" /> {failCount} failed</span>
          </div>
          <button onClick={clearFilters} className="text-[#C41E3A] hover:underline font-semibold">Clear filters</button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-10 flex items-center justify-center text-gray-500 gap-2">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading login history…
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-gray-500 text-sm">No login attempts match your filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">When</th>
                  <th className="px-4 py-2 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Email</th>
                  <th className="px-4 py-2 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-2 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">IP</th>
                  <th className="px-4 py-2 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">User Agent</th>
                  <th className="px-4 py-2 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(r => (
                  <tr key={r.id} className={r.success ? '' : 'bg-red-50/30'}>
                    <td className="px-4 py-2 text-sm text-gray-700 whitespace-nowrap">{fmtDate(r.created_at)}</td>
                    <td className="px-4 py-2 text-sm font-mono text-gray-900">{r.email}</td>
                    <td className="px-4 py-2">
                      {r.success ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                          <CheckCircle2 className="h-3 w-3" /> Success
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                          <XCircle className="h-3 w-3" /> Failed
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-700 font-mono">{r.ip || '—'}</td>
                    <td className="px-4 py-2 text-xs text-gray-500 max-w-[260px] truncate" title={r.user_agent || ''}>{r.user_agent || '—'}</td>
                    <td className="px-4 py-2 text-xs text-gray-600 max-w-[200px] truncate" title={r.error_message || ''}>{r.error_message || '—'}</td>
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

export default LoginHistoryPage;
