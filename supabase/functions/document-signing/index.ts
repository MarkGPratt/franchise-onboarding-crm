// document-signing
//   action 'invite' : email the prospect their private signing link for the
//                     NDA or disclosure document (templates nda_invite /
//                     disclosure_invite). Called from the CRM by a signed-in user.
//   action 'view'   : public. Returns the request details and a short-lived link
//                     to the PDF, and marks the request as opened.
//   action 'sign'   : public. Records the signature, stamps a certificate page
//                     onto the PDF, saves the signed copy to storage, logs it on
//                     the lead and emails the signed copy to the prospect and a
//                     notice to admins + the assigned sales rep.
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, RESEND_FROM.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";

const BUCKET = 'franchise-documents';
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

export const TITLES: Record<string, string> = {
  nda: 'Confidentiality Agreement (NDA)',
  disclosure: 'Franchise Disclosure Document',
};

/** The statements the signer ticks. Kept here so the PDF certificate and the page match. */
export function statements(kind: string, division: string): string[] {
  if (kind === 'nda') return [
    'I have read the whole Confidentiality Agreement (NDA) shown on this page.',
    'I agree to be bound by its terms, and I am authorised to sign it in the capacity stated below.',
    'I agree that typing my full name and clicking "Sign" is my electronic signature, with the same effect as a handwritten signature.',
  ];
  return [
    `I confirm that I have received The Surgeon Group's ${division || ''} franchise disclosure document shown on this page, on the date recorded below.`.replace('  ', ' '),
    'I understand that I may not sign a franchise agreement until at least 14 days after this date, and that I am free to take independent legal and financial advice.',
    'I agree that typing my full name and clicking "Confirm receipt" is my electronic signature, with the same effect as a handwritten signature.',
  ];
}

const sast = (d: Date) => d.toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) + ' (SAST)';
const sastDate = (d: Date) => d.toLocaleDateString('en-ZA', { timeZone: 'Africa/Johannesburg', day: 'numeric', month: 'long', year: 'numeric' });

/** Standard PDF fonts only cover Latin-1: swap typographic characters, drop the rest. */
const pdfSafe = (s: string) => String(s ?? '')
  .replace(/[‘’‛]/g, "'").replace(/[“”]/g, '"')
  .replace(/[–—]/g, '-').replace(/…/g, '...').replace(/ /g, ' ')
  .replace(/[^\x20-\x7E\xA0-\xFF\n]/g, '');

async function sha256Hex(bytes: Uint8Array) {
  const h = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function stampCertificate(source: Uint8Array, info: {
  kind: string; division: string; documentName: string; sha: string; requestId: string;
  name: string; company: string; capacity: string; email: string; ip: string; ua: string; signedAt: Date;
}) {
  const pdf = await PDFDocument.load(source, { ignoreEncryption: true });
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const oblique = await pdf.embedFont(StandardFonts.HelveticaOblique);
  const RED = rgb(0.776, 0.122, 0.149);
  const INK = rgb(0.137, 0.122, 0.125);
  const GREY = rgb(0.42, 0.42, 0.42);
  const W = 595.28, H = 841.89, M = 56;
  let page = pdf.addPage([W, H]);
  let y = H - M;

  const wrap = (text: string, f: any, size: number, width: number) => {
    const out: string[] = [];
    for (const para of pdfSafe(text).split('\n')) {
      let line = '';
      for (const word of para.split(/\s+/)) {
        const t = line ? `${line} ${word}` : word;
        if (f.widthOfTextAtSize(t, size) > width && line) { out.push(line); line = word; } else line = t;
      }
      out.push(line);
    }
    return out;
  };
  const ensure = (h: number) => { if (y - h < M) { page = pdf.addPage([W, H]); y = H - M; } };
  const text = (t: string, opts: { f?: any; size?: number; color?: any; x?: number; width?: number; gap?: number } = {}) => {
    const f = opts.f || font, size = opts.size || 10, x = opts.x ?? M, width = opts.width ?? (W - x - M);
    for (const l of wrap(t, f, size, width)) {
      ensure(size + 4);
      page.drawText(l, { x, y: y - size, size, font: f, color: opts.color || INK });
      y -= size + 4;
    }
    y -= opts.gap ?? 0;
  };
  const row = (label: string, value: string) => {
    const lines = wrap(value || '-', font, 10, W - M - 170 - M);
    const labels = wrap(label, bold, 9, 160);
    const n = Math.max(lines.length, labels.length);
    ensure(n * 14);
    labels.forEach((l, i) => page.drawText(l, { x: M, y: y - 10 - i * 14, size: 9, font: bold, color: GREY }));
    lines.forEach((l, i) => page.drawText(l, { x: M + 170, y: y - 10 - i * 14, size: 10, font, color: INK }));
    y -= n * 14 + 4;
  };

  // Header
  page.drawText('THE SURGEON GROUP', { x: M, y: y - 14, size: 14, font: bold, color: INK });
  y -= 24;
  page.drawRectangle({ x: M, y: y - 3, width: W - 2 * M, height: 3, color: RED });
  y -= 24;
  const heading = info.kind === 'nda' ? 'Electronic Signature Certificate' : 'Acknowledgement of Receipt';
  text(heading, { f: bold, size: 18, gap: 2 });
  text(`${TITLES[info.kind]}${info.division ? ` - ${info.division}` : ''}`, { f: bold, size: 11, color: RED, gap: 12 });
  text(info.kind === 'nda'
    ? 'This page forms part of the document it is attached to. It records that the person below signed the document electronically, as set out here.'
    : 'This page forms part of the document it is attached to. It records the date on which the person below received the disclosure document.', { size: 10, color: GREY, gap: 14 });

  row('Document', info.documentName);
  row('Document fingerprint (SHA-256)', (info.sha.match(/.{1,16}/g) || [info.sha]).join(' '));
  row(info.kind === 'nda' ? 'Signed by' : 'Received by', info.name);
  if (info.company) row('On behalf of', info.company);
  if (info.capacity) row('Capacity', info.capacity);
  row('Email', info.email);
  row(info.kind === 'nda' ? 'Signed on' : 'Received on', sast(info.signedAt));
  if (info.kind === 'disclosure') {
    const earliest = new Date(info.signedAt.getTime() + 14 * 86400000);
    row('Earliest date to sign the franchise agreement', `${sastDate(earliest)} (14 days after receipt)`);
  }
  row('IP address', info.ip);
  row('Browser', info.ua.slice(0, 180));
  row('Reference', info.requestId);
  y -= 10;

  text('The signer ticked each of these statements:', { f: bold, size: 10, gap: 4 });
  for (const s of statements(info.kind, info.division)) text(`[X]  ${s}`, { size: 10, x: M + 8, gap: 3 });
  y -= 14;

  ensure(60);
  text(`Electronic signature: ${info.name}`, { f: oblique, size: 14, gap: 6 });
  page.drawLine({ start: { x: M, y }, end: { x: M + 260, y }, thickness: 0.6, color: GREY });
  y -= 22;
  text('The document fingerprint is a mathematical summary of the document exactly as it was shown to the signer. Any change to that document produces a different fingerprint.', { size: 8, color: GREY });
  text('The Surgeon Group · 350 Jan Shoba Street, Hatfield, Pretoria · 0861 758 623 · info@surgeongroup.co.za', { size: 8, color: GREY });

  pdf.setTitle(`${TITLES[info.kind]} - ${pdfSafe(info.name)} (signed)`);
  pdf.setProducer('The Surgeon Group franchise portal');
  return await pdf.save();
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

    // ---------------- invite (CRM) ----------------
    if (body.action === 'invite') {
      const jwt = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
      const { data: u } = await supabase.auth.getUser(jwt);
      if (!u?.user) return json({ ok: false, error: 'not signed in' }, 401);
      const { data: r } = await supabase.from('signature_requests').select('*').eq('id', body.request_id).maybeSingle();
      if (!r) return json({ ok: false, error: 'request not found' }, 404);
      if (!r.signer_email) return json({ ok: false, error: 'lead has no email address' }, 400);
      const link = `${appUrl}/sign/${r.token}`;
      const res = await sendMail(r.doc_kind === 'nda' ? 'nda_invite' : 'disclosure_invite', r.signer_email, {
        recipient_name: String(r.signer_name || 'there').split(' ')[0],
        division: r.division || 'Surgeon Group',
        signing_link: link,
        sender_name: body.sender_name || 'The Surgeon Group',
      }, { href: link, label: r.doc_kind === 'nda' ? 'Read and sign the NDA' : 'Read the disclosure document' });
      return json(res, res.ok ? 200 : 500);
    }

    // Public actions need a valid token
    const token = String(body.token || '');
    if (!/^[0-9a-f-]{36}$/i.test(token)) return json({ ok: false, error: 'not found' }, 404);
    const { data: r } = await supabase.from('signature_requests').select('*').eq('token', token).maybeSingle();
    if (!r || r.status === 'cancelled') return json({ ok: false, error: 'not found' }, 404);

    // ---------------- view (public) ----------------
    if (body.action === 'view') {
      if (r.status === 'sent') {
        await supabase.from('signature_requests').update({ status: 'opened', opened_at: new Date().toISOString() }).eq('id', r.id);
        if (r.lead_id) await supabase.from('lead_interactions').insert({
          id: `i_${Date.now()}`, lead_id: r.lead_id, note: `${TITLES[r.doc_kind]} link opened by the prospect`,
          author: 'Prospect', created_at: new Date().toISOString(),
        });
      }
      const path = r.status === 'signed' && r.signed_path ? r.signed_path : r.source_path;
      const { data: s } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 3);
      return json({
        ok: true, kind: r.doc_kind, title: TITLES[r.doc_kind], division: r.division || '',
        signer_name: r.signer_name || '', document_name: r.source_name,
        status: r.status === 'signed' ? 'signed' : 'open', signed_at: r.signed_at,
        pdf_url: s?.signedUrl || null, statements: statements(r.doc_kind, r.division || ''),
      });
    }

    // ---------------- sign (public) ----------------
    if (body.action === 'sign') {
      if (r.status === 'signed') return json({ ok: false, error: 'This document has already been completed.' }, 409);
      const name = String(body.name || '').trim().slice(0, 120);
      const company = String(body.company || '').trim().slice(0, 160);
      const capacity = String(body.capacity || '').trim().slice(0, 120);
      const n = statements(r.doc_kind, r.division || '').length;
      if (name.length < 4 || !name.includes(' ')) return json({ ok: false, error: 'Please type your full name (first name and surname).' }, 400);
      if (!Array.isArray(body.accepted) || body.accepted.length !== n || !body.accepted.every((a: unknown) => a === true))
        return json({ ok: false, error: 'Please tick every statement.' }, 400);

      // Claim the request first so a double click cannot sign twice
      const signedAt = new Date();
      const { data: claimed } = await supabase.from('signature_requests')
        .update({ status: 'signed', signed_at: signedAt.toISOString() })
        .eq('id', r.id).neq('status', 'signed').select('id');
      if (!claimed || claimed.length === 0) return json({ ok: false, error: 'This document has already been completed.' }, 409);

      try {
        const { data: file, error: dlErr } = await supabase.storage.from(BUCKET).download(r.source_path);
        if (dlErr || !file) throw new Error('Could not load the document');
        const src = new Uint8Array(await file.arrayBuffer());
        const sha = await sha256Hex(src);
        const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || req.headers.get('cf-connecting-ip') || 'unknown';
        const ua = String(body.user_agent || req.headers.get('user-agent') || 'unknown');
        const out = await stampCertificate(src, {
          kind: r.doc_kind, division: r.division || '', documentName: r.source_name, sha, requestId: r.id,
          name, company, capacity, email: r.signer_email || '', ip, ua, signedAt,
        });
        const safe = (r.signer_name || 'prospect').replace(/[^a-zA-Z0-9]+/g, '_');
        const path = `leads/${r.lead_id || 'no-lead'}/signed/${r.doc_kind}_${safe}_${signedAt.toISOString().slice(0, 10)}_${r.id.slice(0, 8)}.pdf`;
        const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, out, { contentType: 'application/pdf', upsert: true });
        if (upErr) throw new Error(upErr.message);
        const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
        await supabase.from('signature_requests').update({
          signed_name: name, signed_company: company || null, signed_capacity: capacity || null,
          signed_ip: ip, signed_user_agent: ua.slice(0, 400), source_sha256: sha,
          signed_path: path, signed_url: pub?.publicUrl || null,
        }).eq('id', r.id);

        const title = TITLES[r.doc_kind];
        const earliest = sastDate(new Date(signedAt.getTime() + 14 * 86400000));
        const extra = r.doc_kind === 'disclosure'
          ? `Received ${sastDate(signedAt)}. The franchise agreement may not be signed before ${earliest}.`
          : '';
        if (r.lead_id) await supabase.from('lead_interactions').insert({
          id: `i_${Date.now()}`, lead_id: r.lead_id,
          note: r.doc_kind === 'nda' ? `NDA signed online by ${name}` : `Disclosure document receipt confirmed online by ${name}. ${extra}`,
          author: 'Prospect', created_at: signedAt.toISOString(),
        });

        // Signed copy to the prospect (30-day link)
        const { data: copyLink } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 24 * 30);
        if (r.signer_email && copyLink?.signedUrl) {
          await sendMail('document_signed_copy', r.signer_email, {
            recipient_name: String(r.signer_name || name).split(' ')[0],
            document_title: title, signed_date: sastDate(signedAt), document_link: copyLink.signedUrl,
          }, { href: copyLink.signedUrl, label: 'Download your copy' });
        }

        // Notice to admins + the assigned sales rep
        const recipients = new Map<string, string>();
        const { data: admins } = await supabase.from('profiles').select('email,name').eq('role', 'admin');
        (admins || []).forEach((a: any) => a.email && recipients.set(a.email, a.name || ''));
        if (r.lead_id) {
          const { data: lead } = await supabase.from('leads').select('assigned_to').eq('id', r.lead_id).maybeSingle();
          if (lead?.assigned_to) {
            const { data: rep } = await supabase.from('profiles').select('email,name').eq('id', lead.assigned_to).maybeSingle();
            if (rep?.email) recipients.set(rep.email, rep.name || '');
          }
        }
        for (const [email, nm] of recipients) {
          await sendMail('document_signed_staff', email, {
            recipient_name: String(nm || 'there').split(' ')[0], applicant_name: name,
            document_title: title, division: r.division || '', signed_date: sast(signedAt), extra_note: extra, app_url: appUrl,
          });
        }
        return json({ ok: true, signed_at: signedAt.toISOString() });
      } catch (e) {
        // Put the request back so the prospect can try again
        await supabase.from('signature_requests').update({ status: 'opened', signed_at: null }).eq('id', r.id);
        return json({ ok: false, error: `Could not complete the signature: ${(e as Error).message}. Please try again.` }, 500);
      }
    }

    return json({ ok: false, error: 'unknown action' }, 400);
  } catch (e) {
    return json({ ok: false, error: (e as Error).message }, 500);
  }
});
