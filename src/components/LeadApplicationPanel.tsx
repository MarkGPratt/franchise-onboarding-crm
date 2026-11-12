import React, { useEffect, useState } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { supabase } from '@/lib/supabase';
import { Lead, useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import ApplicationAnswers from './ApplicationAnswers';
import { FileText, Copy, Mail, Send, Eye, EyeOff, Printer, Loader2, Check, RefreshCw } from 'lucide-react';

interface Application {
  id: string;
  token: string;
  lead_id: string;
  applicant_name: string | null;
  applicant_email: string | null;
  division: string | null;
  status: 'sent' | 'opened' | 'in_progress' | 'submitted';
  answers: Record<string, any>;
  sent_by: string | null;
  sent_at: string;
  opened_at: string | null;
  updated_at: string;
  submitted_at: string | null;
}

const STATUS: Record<Application['status'], { label: string; cls: string }> = {
  sent: { label: 'Link created, not opened yet', cls: 'bg-gray-100 text-gray-700' },
  opened: { label: 'Opened', cls: 'bg-blue-100 text-blue-700' },
  in_progress: { label: 'In progress', cls: 'bg-amber-100 text-amber-700' },
  submitted: { label: 'Submitted', cls: 'bg-green-100 text-green-700' },
};

const fmt = (d?: string | null) => d ? new Date(d).toLocaleString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

const LeadApplicationPanel: React.FC<{ lead: Lead }> = ({ lead }) => {
  const { addInteraction } = useData();
  const { user } = useAuth();
  const [app, setApp] = useState<Application | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string>('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('franchise_applications')
      .select('*')
      .eq('lead_id', lead.id)
      .order('sent_at', { ascending: false })
      .limit(1);
    setApp((data && data[0]) as Application || null);
    setLoading(false);
  };
  useEffect(() => { load(); }, [lead.id]);

  const link = app ? `${window.location.origin}/apply/${app.token}` : '';
  const firstName = (lead.contactName || '').trim().split(/\s+/)[0] || 'there';
  const division = lead.division || 'Surgeon Group';
  const sender = user?.name || 'The Surgeon Group';

  const create = async () => {
    setBusy('create'); setMsg(null);
    const { data, error } = await supabase.from('franchise_applications').insert({
      lead_id: lead.id,
      applicant_name: lead.contactName,
      applicant_email: lead.email,
      division: lead.division || null,
      sent_by: user?.name || null,
    }).select('*').single();
    setBusy('');
    if (error) { setMsg({ ok: false, text: error.message }); return; }
    setApp(data as Application);
    addInteraction(lead.id, 'Application form link created', user?.name || 'System');
  };

  const copy = async () => {
    await navigator.clipboard.writeText(link);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  const emailBody =
`Dear ${firstName},

Thank you for the interest you have shown in a ${division} franchise with The Surgeon Group.

The link below opens a short overview of the opportunity, followed by our confidential application questionnaire. You can save your answers and come back to finish them at any time.

${link}

Completing the questionnaire does not commit you or The Surgeon Group to anything. It helps us understand you, your goals and your readiness, so that our conversation is useful for both of us.

If you have any questions, reply to this email or give me a call.

Kind regards,
${sender}
The Surgeon Group, Franchising Division`;

  const openMail = () => {
    const subject = `Your ${division} franchise application - The Surgeon Group`;
    window.location.href = `mailto:${encodeURIComponent(lead.email || '')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(emailBody)}`;
    addInteraction(lead.id, 'Application form link emailed (from own mailbox)', user?.name || 'System');
  };

  const sendFromCrm = async () => {
    if (!app) return;
    setBusy('send'); setMsg(null);
    const { data, error } = await supabase.functions.invoke('franchise-application', {
      body: { action: 'invite', application_id: app.id, app_url: window.location.origin, sender_name: sender },
    });
    setBusy('');
    if (error || !data?.ok) {
      const detail = (data && data.error) || error?.message || 'unknown error';
      setMsg({ ok: false, text: `Could not send from the CRM (${detail}). Use "Email from my mailbox" instead.` });
      return;
    }
    setMsg({ ok: true, text: `Sent to ${lead.email}` });
    addInteraction(lead.id, `Application form emailed to ${lead.email}`, user?.name || 'System');
  };

  const print = () => {
    if (!app) return;
    const html = renderToStaticMarkup(<ApplicationAnswers answers={app.answers || {}} submittedAt={app.submitted_at} />);
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<!doctype html><html><head><title>Application - ${lead.contactName}</title>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800&display=swap">
      <style>body{margin:28px 34px} @page{margin:14mm}</style></head><body>
      <img src="${window.location.origin}/surgeon-group-logo.png" style="height:56px">
      <div style="height:4px;background:#C61F26;margin:10px 0 18px"></div>
      <h1 style="font-family:Montserrat,Arial;font-size:22px;margin:0 0 4px">Franchise application: ${lead.contactName.replace(/</g, '&lt;')}</h1>
      <p style="font-family:Montserrat,Arial;font-size:13px;color:#555;margin:0 0 20px">${(lead.division || '').replace(/</g, '&lt;')} · ${(lead.email || '').replace(/</g, '&lt;')} · ${(lead.phone || '').replace(/</g, '&lt;')} · CONFIDENTIAL</p>
      ${html}
      <script>setTimeout(function(){window.print()},700)</script></body></html>`);
    w.document.close();
  };

  return (
    <div className="border border-gray-200 rounded-xl p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h3 className="font-bold text-gray-900 flex items-center gap-2"><FileText className="h-4 w-4" /> Application Form</h3>
        {app && <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS[app.status].cls}`}>{STATUS[app.status].label}</span>}
      </div>

      {loading ? (
        <div className="text-sm text-gray-500 flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      ) : !app ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-gray-600">Send {firstName} the online application form, with an overview of the opportunity.</p>
          <button onClick={create} disabled={!!busy} className="bg-[#C41E3A] hover:bg-[#a01830] text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2">
            {busy === 'create' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />} Create application link
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex gap-2">
            <input readOnly value={link} className="input flex-1 text-xs font-mono bg-gray-50" onFocus={e => e.target.select()} />
            <button onClick={copy} className="px-3 py-2 rounded-lg border border-gray-200 text-sm font-semibold flex items-center gap-1.5 hover:bg-gray-50 whitespace-nowrap">
              {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />} {copied ? 'Copied' : 'Copy link'}
            </button>
          </div>

          {app.status !== 'submitted' && (
            <div className="flex flex-wrap gap-2">
              <button onClick={openMail} disabled={!lead.email} className="bg-[#1a1a1a] text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 disabled:opacity-50">
                <Mail className="h-4 w-4" /> Email from my mailbox
              </button>
              <button onClick={sendFromCrm} disabled={!!busy || !lead.email} className="border border-gray-300 px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 hover:bg-gray-50 disabled:opacity-50">
                {busy === 'send' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send from CRM
              </button>
            </div>
          )}

          {msg && <p className={`text-sm ${msg.ok ? 'text-green-700' : 'text-red-700'}`}>{msg.text}</p>}

          <div className="text-xs text-gray-500 flex flex-wrap gap-x-4 gap-y-1">
            <span>Created {fmt(app.sent_at)}{app.sent_by ? ` by ${app.sent_by}` : ''}</span>
            {app.opened_at && <span>Opened {fmt(app.opened_at)}</span>}
            {app.status === 'in_progress' && <span>Last saved {fmt(app.updated_at)}</span>}
            {app.submitted_at && <span className="text-green-700 font-semibold">Submitted {fmt(app.submitted_at)}</span>}
            <button onClick={load} className="flex items-center gap-1 hover:text-gray-800"><RefreshCw className="h-3 w-3" /> Refresh</button>
          </div>

          {app.status !== 'sent' && (
            <div className="flex flex-wrap gap-2 pt-1">
              <button onClick={() => setShow(s => !s)} className="border border-gray-300 px-3 py-1.5 rounded-lg text-sm font-semibold flex items-center gap-1.5 hover:bg-gray-50">
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />} {show ? 'Hide answers' : app.status === 'submitted' ? 'View application' : 'View answers so far'}
              </button>
              <button onClick={print} className="border border-gray-300 px-3 py-1.5 rounded-lg text-sm font-semibold flex items-center gap-1.5 hover:bg-gray-50">
                <Printer className="h-4 w-4" /> Print / Save as PDF
              </button>
            </div>
          )}

          {show && (
            <div className="mt-2 max-h-[60vh] overflow-y-auto border border-gray-100 rounded-lg p-4 bg-white">
              <ApplicationAnswers answers={app.answers || {}} submittedAt={app.submitted_at} />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default LeadApplicationPanel;
