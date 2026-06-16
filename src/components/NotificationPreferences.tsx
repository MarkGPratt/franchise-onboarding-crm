import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Bell, Mail, Check, Loader2 } from 'lucide-react';

interface PrefRow {
  event_type: string;
  email_enabled: boolean;
}

const ALL_EVENTS: { key: string; title: string; description: string; roles: string[] }[] = [
  {
    key: 'lead_assigned',
    title: 'New Lead Assigned',
    description: 'Sent when a franchise enquiry is allocated to you in the Leads Pipeline.',
    roles: ['admin', 'sales'],
  },
  {
    key: 'task_updated',
    title: 'Onboarding Task Updates',
    description: 'Sent when the franchisor adds or comments on a task in your onboarding flow.',
    roles: ['franchisee'],
  },
  {
    key: 'franchisee_progress',
    title: 'Franchisee Activity',
    description: 'Sent when a franchisee completes a task or uploads a document.',
    roles: ['admin'],
  },
  {
    key: 'daily_notes_digest',
    title: 'Daily Internal Notes Digest',
    description: 'A weekday morning summary of all new internal notes and replies posted in the last 24 hours, grouped by franchisee with pinned notes highlighted at the top.',
    roles: ['admin', 'sales'],
  },
];


const NotificationPreferences: React.FC = () => {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const visibleEvents = ALL_EVENTS.filter(e => user && e.roles.includes(user.role));

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('notification_preferences')
        .select('event_type, email_enabled')
        .eq('user_id', user.id);
      const map: Record<string, boolean> = {};
      (data as PrefRow[] | null)?.forEach(p => { map[p.event_type] = p.email_enabled; });
      // Default = true for anything not yet recorded
      visibleEvents.forEach(e => { if (map[e.key] === undefined) map[e.key] = true; });
      setPrefs(map);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const toggle = async (eventType: string) => {
    if (!user) return;
    const next = !prefs[eventType];
    setPrefs(p => ({ ...p, [eventType]: next }));
    setSaving(eventType);
    const { error } = await supabase
      .from('notification_preferences')
      .upsert(
        { user_id: user.id, event_type: eventType, email_enabled: next, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,event_type' },
      );
    setSaving(null);
    if (error) {
      // Revert
      setPrefs(p => ({ ...p, [eventType]: !next }));
      alert('Failed to save preference: ' + error.message);
      return;
    }
    setSaved(eventType);
    setTimeout(() => setSaved(s => (s === eventType ? null : s)), 1500);
  };

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <Bell className="h-7 w-7 text-[#C41E3A]" /> Notification Preferences
        </h1>
        <p className="text-gray-500 mt-1">Choose which email alerts you want to receive at <span className="font-semibold">{user.email}</span>.</p>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 flex items-center justify-center text-gray-500">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading preferences...
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {visibleEvents.length === 0 && (
            <div className="p-8 text-sm text-gray-500">No notification events are configured for your role.</div>
          )}
          {visibleEvents.map(ev => {
            const enabled = prefs[ev.key];
            const isSaving = saving === ev.key;
            const justSaved = saved === ev.key;
            return (
              <div key={ev.key} className="p-5 flex items-start gap-4">
                <div className="h-10 w-10 rounded-lg bg-[#C41E3A]/10 text-[#C41E3A] flex items-center justify-center flex-shrink-0">
                  <Mail className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-gray-900">{ev.title}</h3>
                    {justSaved && (
                      <span className="text-xs text-green-600 font-semibold flex items-center gap-1">
                        <Check className="h-3 w-3" /> Saved
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mt-0.5">{ev.description}</p>
                </div>
                <button
                  onClick={() => toggle(ev.key)}
                  disabled={isSaving}
                  className={`relative inline-flex h-7 w-12 items-center rounded-full transition flex-shrink-0 ${
                    enabled ? 'bg-[#C41E3A]' : 'bg-gray-300'
                  } ${isSaving ? 'opacity-50 cursor-wait' : ''}`}
                  aria-label={`Toggle ${ev.title}`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                      enabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-900">
        <strong>Tip:</strong> Disabling a notification only stops the email — you'll still see all activity in the CRM.
      </div>
    </div>
  );
};

export default NotificationPreferences;
