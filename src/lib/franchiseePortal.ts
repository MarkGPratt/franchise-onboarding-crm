import { supabase } from '@/lib/supabase';

export interface DeclLine { division: string; turnover_excl: number | ''; jobs: number | '' }

export interface Declaration {
  id: string;
  franchisee_id: string;
  period: string;            // YYYY-MM-01
  lines: DeclLine[];
  turnover_excl: number;
  jobs: number;
  royalty_pct: number | null;
  marketing_levy_pct: number | null;
  royalty_amount: number;
  levy_amount: number;
  notes: string | null;
  status: 'draft' | 'submitted' | 'queried' | 'approved';
  submitted_by: string | null;
  submitted_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
}

export interface FranchiseeRates {
  id: string;
  name: string;
  territory: string | null;
  division: string | null;
  status: string | null;
  start_date: string | null;
  royalty_pct: number | null;
  marketing_levy_pct: number | null;
  trading_since: string | null;
}

export interface HistoryRow {
  id: number;
  territory_label: string;
  period: string;
  turnover_incl: number | null;
  turnover_excl: number | null;
  jobs: number | null;
  franchisee_id: string | null;
}

export interface CatalogueItem {
  id: string;
  category: string;
  name: string;
  description: string | null;
  unit: string;
  price_excl: number | null;
  sizes: string[];
  division: string | null;
  active: boolean;
  position: number;
}

export interface OrderLine { item_id: string; name: string; unit: string; size: string | null; qty: number; unit_price: number | null }
export interface Order {
  id: string;
  order_no: number;
  franchisee_id: string;
  items: OrderLine[];
  total_excl: number;
  notes: string | null;
  status: 'submitted' | 'processing' | 'invoiced' | 'dispatched' | 'delivered' | 'cancelled';
  ordered_by: string | null;
  created_at: string;
  ho_note: string | null;
  updated_by: string | null;
  updated_at: string;
}

export const DECL_STATUS: Record<Declaration['status'] | 'none' | 'overdue', { label: string; cls: string }> = {
  none: { label: 'Not declared', cls: 'bg-gray-100 text-gray-600' },
  overdue: { label: 'Overdue', cls: 'bg-red-100 text-red-700' },
  draft: { label: 'Draft – not submitted', cls: 'bg-amber-100 text-amber-800' },
  submitted: { label: 'Submitted', cls: 'bg-blue-100 text-blue-700' },
  queried: { label: 'Queried by Head Office', cls: 'bg-orange-100 text-orange-800' },
  approved: { label: 'Approved', cls: 'bg-green-100 text-green-700' },
};

export const ORDER_STATUS: Record<Order['status'], { label: string; cls: string }> = {
  submitted: { label: 'Received', cls: 'bg-blue-100 text-blue-700' },
  processing: { label: 'Being prepared', cls: 'bg-amber-100 text-amber-800' },
  invoiced: { label: 'Invoiced', cls: 'bg-purple-100 text-purple-700' },
  dispatched: { label: 'Dispatched', cls: 'bg-indigo-100 text-indigo-700' },
  delivered: { label: 'Delivered', cls: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Cancelled', cls: 'bg-gray-100 text-gray-500' },
};

/** Declarations for month M are due by this day of month M+1. */
export const DUE_DAY = 7;

const pad = (n: number) => String(n).padStart(2, '0');
export const monthKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`;
export const shiftMonth = (key: string, n: number) => {
  const [y, m] = key.split('-').map(Number);
  return monthKey(new Date(y, m - 1 + n, 1));
};
export const monthName = (key: string, short = false) => {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-ZA', short ? { month: 'short', year: '2-digit' } : { month: 'long', year: 'numeric' });
};
export const dueDate = (key: string) => {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m, DUE_DAY, 23, 59);
};
export const isOverdue = (key: string, d?: Pick<Declaration, 'status'> | null) =>
  (!d || d.status === 'draft' || d.status === 'queried') && new Date() > dueDate(key);

export const rands = (n: number | null | undefined, cents = false) =>
  n === null || n === undefined || Number.isNaN(Number(n)) ? '—'
    : 'R ' + Number(n).toLocaleString('en-ZA', { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 });
export const pct = (n: number | null | undefined) => (n === null || n === undefined ? 'not set' : `${Number(n).toLocaleString('en-ZA')}%`);

export const missingTable = (msg?: string) => !!msg && /does not exist|schema cache|relation/i.test(msg);

/** Email every admin (and optionally other staff) through the existing send-notification function. */
export async function notifyStaff(event_type: string, variables: Record<string, string>) {
  const { data } = await supabase.from('profiles').select('id,email,name,role').eq('role', 'admin');
  const app_url = window.location.origin;
  for (const p of (data || []) as { id: string; email: string; name: string }[]) {
    if (!p.email) continue;
    supabase.functions.invoke('send-notification', {
      body: { event_type, recipient_email: p.email, recipient_user_id: p.id, recipient_name: p.name,
        variables: { recipient_name: (p.name || '').split(' ')[0] || 'there', app_url, ...variables } },
    }).catch(() => {});
  }
}

/** Fetch every row of a query, 1000 at a time. */
export async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>): Promise<{ rows: T[]; error?: string }> {
  const rows: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(from, from + 999);
    if (error) return { rows, error: error.message };
    rows.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return { rows };
}

/** One month of performance: a declaration (submitted or approved) wins over imported history. */
export interface PerfMonth { period: string; turnover: number; jobs: number; source: 'declared' | 'history' }
export function mergePerformance(history: HistoryRow[], decls: Declaration[]): PerfMonth[] {
  const map = new Map<string, PerfMonth>();
  for (const h of history) {
    const t = Number(h.turnover_excl ?? (h.turnover_incl ? Number(h.turnover_incl) / 1.15 : 0));
    const prev = map.get(h.period);
    map.set(h.period, { period: h.period, turnover: (prev?.turnover || 0) + t, jobs: (prev?.jobs || 0) + Number(h.jobs || 0), source: 'history' });
  }
  for (const d of decls) {
    if (d.status !== 'submitted' && d.status !== 'approved') continue;
    map.set(d.period, { period: d.period, turnover: Number(d.turnover_excl), jobs: Number(d.jobs), source: 'declared' });
  }
  return [...map.values()].sort((a, b) => a.period.localeCompare(b.period));
}
