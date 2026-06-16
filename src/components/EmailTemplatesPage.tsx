import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Mail, Save, Loader2, Check, AlertCircle, Code } from 'lucide-react';

interface Template {
  id: string;
  event_type: string;
  name: string;
  subject: string;
  body: string;
  enabled: boolean;
  updated_at: string;
}

const TEMPLATE_VARS: Record<string, string[]> = {
  lead_assigned: ['recipient_name', 'lead_name', 'lead_email', 'lead_phone', 'lead_area', 'lead_status', 'app_url'],
  task_updated: ['recipient_name', 'actor_name', 'actor_role', 'action', 'task_text', 'detail', 'app_url'],
  franchisee_progress: ['recipient_name', 'franchisee_name', 'action', 'detail', 'app_url'],
};

const EVENT_DESCRIPTIONS: Record<string, string> = {
  lead_assigned: 'Sent to a sales rep when a new lead is allocated to them.',
  task_updated: 'Sent to a franchisee when the franchisor adds or comments on one of their tasks.',
  franchisee_progress: 'Sent to admins when a franchisee completes a task or uploads a document.',
};

const EmailTemplatesPage: React.FC = () => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Template | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('email_templates')
      .select('*')
      .order('event_type', { ascending: true });
    setLoading(false);
    if (error) {
      setStatus({ type: 'err', msg: error.message });
      return;
    }
    setTemplates((data as Template[]) || []);
    if (data && data.length > 0 && !activeId) {
      setActiveId(data[0].id);
      setDraft({ ...(data[0] as Template) });
    }
  };

  useEffect(() => { load(); }, []);

  const handleSelect = (t: Template) => {
    setActiveId(t.id);
    setDraft({ ...t });
    setStatus(null);
  };

  const handleSave = async () => {
    if (!draft) return;
    setSaving(true);
    setStatus(null);
    const { error } = await supabase
      .from('email_templates')
      .update({
        subject: draft.subject,
        body: draft.body,
        enabled: draft.enabled,
        updated_at: new Date().toISOString(),
      })
      .eq('id', draft.id);
    setSaving(false);
    if (error) {
      setStatus({ type: 'err', msg: error.message });
      return;
    }
    setStatus({ type: 'ok', msg: 'Template saved' });
    setTemplates(ts => ts.map(t => (t.id === draft.id ? { ...draft } : t)));
    setTimeout(() => setStatus(null), 2000);
  };

  const insertVar = (variable: string) => {
    if (!draft) return;
    const token = `{{${variable}}}`;
    setDraft({ ...draft, body: draft.body + token });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <Mail className="h-7 w-7 text-[#C41E3A]" /> Email Templates
        </h1>
        <p className="text-gray-500 mt-1">Customise the subject line and body of each automated notification.</p>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 flex items-center justify-center text-gray-500">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading templates...
        </div>
      ) : (
        <div className="grid lg:grid-cols-[280px_1fr] gap-6">
          {/* Template list */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden h-fit">
            {templates.map(t => (
              <button
                key={t.id}
                onClick={() => handleSelect(t)}
                className={`w-full text-left p-4 border-b border-gray-100 last:border-b-0 transition ${
                  t.id === activeId ? 'bg-[#C41E3A]/5 border-l-4 border-l-[#C41E3A]' : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="font-semibold text-gray-900 text-sm">{t.name}</div>
                  {!t.enabled && <span className="text-[10px] uppercase font-bold text-gray-400">Off</span>}
                </div>
                <div className="text-xs text-gray-500 font-mono mt-0.5">{t.event_type}</div>
              </button>
            ))}
          </div>

          {/* Editor */}
          {draft ? (
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">{draft.name}</h2>
                  <p className="text-xs text-gray-500 mt-0.5">{EVENT_DESCRIPTIONS[draft.event_type]}</p>
                </div>
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={draft.enabled}
                    onChange={e => setDraft({ ...draft, enabled: e.target.checked })}
                    className="h-4 w-4 accent-[#C41E3A]"
                  />
                  Send emails for this event
                </label>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Subject</label>
                <input
                  value={draft.subject}
                  onChange={e => setDraft({ ...draft, subject: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:border-[#C41E3A] text-sm"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-semibold text-gray-700">Body</label>
                  <div className="text-xs text-gray-500 flex items-center gap-1.5">
                    <Code className="h-3 w-3" /> Click a variable to insert
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {(TEMPLATE_VARS[draft.event_type] || []).map(v => (
                    <button
                      key={v}
                      onClick={() => insertVar(v)}
                      className="px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-xs font-mono text-gray-700 transition"
                      type="button"
                    >
                      {`{{${v}}}`}
                    </button>
                  ))}
                </div>
                <textarea
                  value={draft.body}
                  onChange={e => setDraft({ ...draft, body: e.target.value })}
                  rows={14}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:border-[#C41E3A] text-sm font-mono"
                />
              </div>

              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="text-xs text-gray-500">
                  Last updated {new Date(draft.updated_at).toLocaleString()}
                </div>
                <div className="flex items-center gap-3">
                  {status && (
                    <div className={`text-xs font-semibold flex items-center gap-1 ${
                      status.type === 'ok' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {status.type === 'ok' ? <Check className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
                      {status.msg}
                    </div>
                  )}
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-[#C41E3A] hover:bg-[#a01830] disabled:opacity-50 text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-2 text-sm"
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save Template
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-500">
              Select a template to edit.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EmailTemplatesPage;
