import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { fetchActivity, ActivityRow, ACTION_LABELS } from '@/lib/activity';
import {
  Activity, RefreshCw, User, Calendar, Filter, FileText, Users as UsersIcon,
  Briefcase, ListChecks, UserPlus, Trash2,
} from 'lucide-react';

const ALL_ACTIONS = Object.keys(ACTION_LABELS);

const actionIcon = (action: string) => {
  if (action.startsWith('lead.')) return <Briefcase className="h-4 w-4" />;
  if (action.startsWith('franchisee.')) return <UsersIcon className="h-4 w-4" />;
  if (action.startsWith('task.')) return <ListChecks className="h-4 w-4" />;
  if (action.startsWith('document.')) return <FileText className="h-4 w-4" />;
  if (action.startsWith('user.')) return action === 'user.deleted' ? <Trash2 className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />;
  return <Activity className="h-4 w-4" />;
};

const actionColor = (action: string) => {
  if (action.includes('deleted')) return 'bg-red-100 text-red-700';
  if (action.includes('created') || action.includes('uploaded')) return 'bg-green-100 text-green-700';
  if (action === 'lead.converted') return 'bg-purple-100 text-purple-700';
  if (action === 'task.completed') return 'bg-blue-100 text-blue-700';
  if (action === 'task.reopened') return 'bg-amber-100 text-amber-700';
  return 'bg-gray-100 text-gray-700';
};

const formatDate = (iso: string) => {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return iso; }
};

const ActivityLogPage: React.FC = () => {
  const { users } = useAuth();
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [actorId, setActorId] = useState('');
  const [action, setAction] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const load = async () => {
    setLoading(true);
    const from = fromDate ? new Date(fromDate + 'T00:00:00').toISOString() : undefined;
    const to = toDate ? new Date(toDate + 'T23:59:59').toISOString() : undefined;
    const data = await fetchActivity({
      actorId: actorId || undefined,
      action: action || undefined,
      from, to, limit: 500,
    });
    setRows(data);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const resetFilters = () => {
    setActorId(''); setAction(''); setFromDate(''); setToDate('');
    setTimeout(load, 0);
  };

  const grouped = useMemo(() => {
    const out: Record<string, ActivityRow[]> = {};
    rows.forEach(r => {
      const day = new Date(r.created_at).toLocaleDateString(undefined, {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      });
      (out[day] = out[day] || []).push(r);
    });
    return out;
  }, [rows]);

  // Build a unique list of actors actually present in rows or from users[] for filtering
  const actorOptions = useMemo(() => {
    const map = new Map<string, string>();
    users.forEach(u => map.set(u.id, u.name));
    rows.forEach(r => { if (r.actor_id && !map.has(r.actor_id)) map.set(r.actor_id, r.actor_name || r.actor_id); });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [users, rows]);

  return (
    <section className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Activity className="h-5 w-5 text-[#C41E3A]" /> Activity Log
          </h2>
          <p className="text-sm text-gray-500">Every important action across the CRM — filter by user, action type and date range.</p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
          <Filter className="h-4 w-4" /> Filters
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="text-xs font-semibold text-gray-600 flex items-center gap-1 mb-1"><User className="h-3 w-3" /> User</label>
            <select value={actorId} onChange={e => setActorId(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
              <option value="">All users</option>
              {actorOptions.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 flex items-center gap-1 mb-1"><Activity className="h-3 w-3" /> Action</label>
            <select value={action} onChange={e => setAction(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
              <option value="">All actions</option>
              {ALL_ACTIONS.map(a => <option key={a} value={a}>{ACTION_LABELS[a]}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 flex items-center gap-1 mb-1"><Calendar className="h-3 w-3" /> From</label>
            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 flex items-center gap-1 mb-1"><Calendar className="h-3 w-3" /> To</label>
            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white" />
          </div>
        </div>
        <div className="flex gap-2 mt-3">
          <button onClick={load} className="bg-[#C41E3A] hover:bg-[#a01830] text-white px-4 py-2 rounded-lg text-sm font-semibold">
            Apply filters
          </button>
          <button onClick={resetFilters} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-100">
            Reset
          </button>
          <div className="ml-auto self-center text-xs text-gray-500">{rows.length} entries</div>
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <div className="text-center text-gray-500 py-12">Loading activity…</div>
      ) : rows.length === 0 ? (
        <div className="text-center text-gray-500 py-12 border border-dashed border-gray-300 rounded-lg">
          No activity matches the current filters.
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([day, dayRows]) => (
            <div key={day}>
              <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">{day}</div>
              <ul className="divide-y divide-gray-100 border border-gray-100 rounded-lg overflow-hidden">
                {dayRows.map(r => (
                  <li key={r.id} className="flex items-start gap-3 p-3 bg-white hover:bg-gray-50">
                    <div className={`h-8 w-8 rounded-full flex-shrink-0 flex items-center justify-center ${actionColor(r.action)}`}>
                      {actionIcon(r.action)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-gray-900">
                        <span className="font-semibold">{r.actor_name || 'System'}</span>
                        {r.actor_role && <span className="text-xs text-gray-500 ml-1 capitalize">({r.actor_role})</span>}
                        <span className="text-gray-600"> — {ACTION_LABELS[r.action] || r.action}</span>
                        {r.target_name && (
                          <>
                            <span className="text-gray-500"> · </span>
                            <span className="font-semibold text-gray-800">{r.target_name}</span>
                          </>
                        )}
                      </div>
                      {r.metadata && Object.keys(r.metadata).length > 0 && (
                        <div className="text-xs text-gray-500 mt-0.5 truncate">
                          {Object.entries(r.metadata)
                            .filter(([, v]) => v !== null && v !== undefined && v !== '')
                            .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
                            .join(' · ')}
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-gray-400 whitespace-nowrap">
                      {formatDate(r.created_at)}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

export default ActivityLogPage;
