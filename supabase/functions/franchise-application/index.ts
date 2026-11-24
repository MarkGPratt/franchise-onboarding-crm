// franchise-application
//   action 'invite'    : email the prospect their private application link
//                        (template: application_invite). Called from the CRM.
//   action 'submitted' : tell admins + the assigned sales rep that an
//                        application came in (template: application_submitted).
//                        Called from the public form; only fires once, and only
//                        for an application that really is submitted. Also
//                        emails the applicant a confirmation (application_received).
// Uses Resend. Secrets: RESEND_API_KEY, optional RESEND_FROM
// (e.g. "The Surgeon Group <franchising@surgeongroup.co.za>").
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { 'Content-Type': 'application/json', ...corsHeaders } });

const render = (tpl: string, vars: Record<string, string>) =>
  tpl.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, k) => vars[k] ?? '');
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const linkify = (s: string) => s.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#C61F26;font-weight:700;">$1</a>');

function wrapHtml(bodyText: string, button?: { href: string; label: string }, logoUrl?: string) {
  const btn = button
    ? `<p style="margin:24px 0;"><a href="${esc(button.href)}" style="background:#C61F26;color:#ffffff;text-decoration:none;font-weight:700;padding:13px 26px;border-radius:6px;display:inline-block;">${esc(button.label)}</a></p>`
    : '';
  return `<div style="font-family:Montserrat,Arial,Helvetica,sans-serif;font-size:15px;color:#231F20;line-height:1.6;max-width:600px;margin:0 auto;">
  <div style="padding:18px 0 12px;">${logoUrl ? `<img src="${esc(logoUrl)}" alt="The Surgeon Group" height="52" style="height:52px;">` : '<b style="font-size:18px;">The Surgeon Group</b>'}</div>
  <div style="height:4px;background:#C61F26;"></div>
  <div style="padding:24px 4px;white-space:pre-wrap;">${linkify(esc(bodyText))}</div>
  ${btn}
  <div style="border-top:1px solid #e2e2e2;padding-top:12px;font-size:12px;color:#6b6b6b;">The Surgeon Group · 350 Jan Shoba Street, Hatfield, Pretoria · 0861 758 623 · info@surgeongroup.co.za</div>
</div>`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    const FROM = Deno.env.get('RESEND_FROM') || 'The Surgeon Group <onboarding@resend.dev>';
    const body = await req.json();
    const appUrl = String(body.app_url || '').replace(/\/$/, '');
    const logoUrl = appUrl ? `${appUrl}/surgeon-group-logo.png` : undefined;

    const sendMail = async (event_type: string, to: string, vars: Record<string, string>, button?: { href: string; label: string }) => {
      const { data: tpl } = await supabase.from('email_templates').select('*').eq('event_type', event_type).maybeSingle();
      if (!tpl) return { ok: false, error: `template ${event_type} not found` };
      if (tpl.enabled === false) return { ok: true, skipped: 'template disabled' };
      const subject = render(tpl.subject, vars);
      const text = render(tpl.body, vars);
      if (!RESEND_API_KEY) {
        await supabase.from('notification_log').insert({ event_type, recipient_email: to, subject, status: 'failed', error: 'RESEND_API_KEY not configured' });
        return { ok: false, error: 'Email service not configured (RESEND_API_KEY)' };
      }
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: FROM, to: [to], subject, text, html: wrapHtml(text, button, logoUrl) }),
      });
      const rj = await r.json().catch(() => ({}));
      await supabase.from('notification_log').insert({
        event_type, recipient_email: to, subject,
        status: r.ok ? 'sent' : 'failed', error: r.ok ? null : JSON.stringify(rj).slice(0, 500),
      });
      return r.ok ? { ok: true } : { ok: false, error: (rj as any)?.message || 'send failed' };
    };

    if (body.action === 'invite') {
      // Must be a signed-in CRM user
      const jwt = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
      const { data: u } = await supabase.auth.getUser(jwt);
      if (!u?.user) return json({ ok: false, error: 'not signed in' }, 401);

      const { data: app } = await supabase.from('franchise_applications').select('*').eq('id', body.application_id).maybeSingle();
      if (!app) return json({ ok: false, error: 'application not found' }, 404);
      if (!app.applicant_email) return json({ ok: false, error: 'lead has no email address' }, 400);
      const link = `${appUrl}/apply/${app.token}`;
      const res = await sendMail('application_invite', app.applicant_email, {
        recipient_name: String(app.applicant_name || 'there').split(' ')[0],
        division: app.division || 'Surgeon Group',
        application_link: link,
        sender_name: body.sender_name || 'The Surgeon Group',
      }, { href: link, label: 'View the opportunity and apply' });
      return json(res, res.ok ? 200 : 500);
    }

    if (body.action === 'submitted') {
      const { data: app } = await supabase.from('franchise_applications').select('*').eq('token', body.token).maybeSingle();
      if (!app || app.status !== 'submitted') return json({ ok: false, error: 'not submitted' }, 400);
      if (app.notified_at) return json({ ok: true, skipped: 'already notified' });
      await supabase.from('franchise_applications').update({ notified_at: new Date().toISOString() }).eq('id', app.id);

      const recipients = new Map<string, string>();
      const { data: admins } = await supabase.from('profiles').select('email,name').eq('role', 'admin');
      (admins || []).forEach((a: any) => a.email && recipients.set(a.email, a.name || ''));
      if (app.lead_id) {
        const { data: lead } = await supabase.from('leads').select('assigned_to').eq('id', app.lead_id).maybeSingle();
        if (lead?.assigned_to) {
          const { data: rep } = await supabase.from('profiles').select('email,name').eq('id', lead.assigned_to).maybeSingle();
          if (rep?.email) recipients.set(rep.email, rep.name || '');
        }
        await supabase.from('lead_interactions').insert({
          id: `i_${Date.now()}`, lead_id: app.lead_id, note: 'Online application form submitted', author: 'Applicant', created_at: new Date().toISOString(),
        });
      }
      const results = [];
      for (const [email, name] of recipients) {
        results.push(await sendMail('application_submitted', email, {
          recipient_name: String(name || 'there').split(' ')[0],
          applicant_name: app.applicant_name || 'An applicant',
          division: app.division || '',
          app_url: appUrl,
        }));
      }
      // Confirmation to the applicant
      let confirmed = false;
      if (app.applicant_email) {
        const submitted = new Date(app.submitted_at || Date.now()).toLocaleDateString('en-ZA', { timeZone: 'Africa/Johannesburg', day: 'numeric', month: 'long', year: 'numeric' });
        const c = await sendMail('application_received', app.applicant_email, {
          recipient_name: String(app.applicant_name || 'there').split(' ')[0],
          division: app.division || 'Surgeon Group',
          submitted_date: submitted,
        });
        confirmed = !!c.ok;
      }
      return json({ ok: true, sent: results.filter(r => r.ok).length, applicant_confirmed: confirmed });
    }

    return json({ ok: false, error: 'unknown action' }, 400);
  } catch (e) {
    return json({ ok: false, error: (e as Error).message }, 500);
  }
});
