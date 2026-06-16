import { supabase } from '@/lib/supabase';

export type ActivityAction =
  | 'lead.created'
  | 'lead.converted'
  | 'lead.deleted'
  | 'franchisee.created'
  | 'franchisee.deleted'
  | 'task.completed'
  | 'task.reopened'
  | 'document.uploaded'
  | 'document.deleted'
  | 'user.created'
  | 'user.deleted';

export interface LogParams {
  action: ActivityAction;
  targetType?: string;
  targetId?: string;
  targetName?: string;
  metadata?: Record<string, any>;
}

interface SessionUser {
  id?: string;
  name?: string;
  email?: string;
  role?: string;
}

const SESSION_KEY = 'sg_session';

function currentActor(): SessionUser {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

export async function logActivity(p: LogParams): Promise<void> {
  const actor = currentActor();
  try {
    const { error } = await supabase.from('activity_log').insert({
      actor_id: actor.id || null,
      actor_name: actor.name || actor.email || 'System',
      actor_role: actor.role || null,
      action: p.action,
      target_type: p.targetType || null,
      target_id: p.targetId || null,
      target_name: p.targetName || null,
      metadata: p.metadata || {},
    });
    if (error) console.warn('activity_log insert failed:', error.message);
  } catch (e: any) {
    console.warn('activity_log insert exception:', e?.message);
  }
}

export interface ActivityRow {
  id: string;
  actor_id: string | null;
  actor_name: string | null;
  actor_role: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  target_name: string | null;
  metadata: Record<string, any> | null;
  created_at: string;
}

export async function fetchActivity(opts: {
  actorId?: string;
  action?: string;
  from?: string;
  to?: string;
  limit?: number;
} = {}): Promise<ActivityRow[]> {
  let q = supabase.from('activity_log').select('*').order('created_at', { ascending: false });
  if (opts.actorId) q = q.eq('actor_id', opts.actorId);
  if (opts.action) q = q.eq('action', opts.action);
  if (opts.from) q = q.gte('created_at', opts.from);
  if (opts.to) q = q.lte('created_at', opts.to);
  q = q.limit(opts.limit ?? 500);
  const { data, error } = await q;
  if (error) {
    console.warn('fetchActivity failed:', error.message);
    return [];
  }
  return (data || []) as ActivityRow[];
}

export const ACTION_LABELS: Record<string, string> = {
  'lead.created': 'Lead created',
  'lead.converted': 'Lead converted to franchisee',
  'lead.deleted': 'Lead deleted',
  'franchisee.created': 'Franchisee added',
  'franchisee.deleted': 'Franchisee deleted',
  'task.completed': 'Task completed',
  'task.reopened': 'Task reopened',
  'document.uploaded': 'Document uploaded',
  'document.deleted': 'Document deleted',
  'user.created': 'User added',
  'user.deleted': 'User deleted',
};
