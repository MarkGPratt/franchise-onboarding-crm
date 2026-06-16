import { supabase } from '@/lib/supabase';

export type NotificationEvent =
  | 'lead_assigned'
  | 'task_updated'
  | 'franchisee_progress';

export interface NotifyPayload {
  event_type: NotificationEvent;
  recipient_email: string;
  recipient_user_id?: string;
  recipient_name?: string;
  variables?: Record<string, string>;
}

/**
 * Fire-and-forget notification dispatch via the `send-notification`
 * Supabase edge function. Failures are logged to console but never
 * thrown, so a failing email never blocks the user action that
 * triggered it.
 */
export function notify(payload: NotifyPayload): void {
  const appUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const vars = { app_url: appUrl, ...(payload.variables || {}) };

  supabase.functions
    .invoke('send-notification', {
      body: { ...payload, variables: vars },
    })
    .then(({ error }) => {
      if (error) console.warn('notify failed', payload.event_type, error.message);
    })
    .catch(err => console.warn('notify error', payload.event_type, err));
}
