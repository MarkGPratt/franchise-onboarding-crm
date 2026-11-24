import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Lead, useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { KIND_LABEL, SignKind, SignatureRequest, signedCopyUrl, suggestDocument } from '@/lib/signing';
import { FileSignature, Copy, Mail, Send, Loader2, Check, RefreshCw, Download, RotateCcw } from 'lucide-react';

const STATUS: Record<SignatureRequest['status'], { label: string; cls: string }> = {
  sent: { label: 'Link created, not opened yet', cls: 'bg-gray-100 text-gray-700' },
  opened: { label: 'Opened, not signed yet', cls: 'bg-blue-100 text-blue-700' },
  signed: { label: 'Signed', cls: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Cancelled', cls: 'bg-gray-100 text-gray-500' },
};

const fmt = (d?: string | null) => d ? new Date(d).toLocaleString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
const fmtDay = (d: Date) => d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' });
const isPdf = (d: { name: string; fileType: string }) => /\.pdf$/i.test(d.name) || /pdf/i.test(d.fileType || '');

/** NDA and Disclosure Document: pick the PDF, send a private signing link, see the signed copy. */
const LeadSigningPanel: React.FC<{ lead: Lead }> = ({ lead }) => {
  const [reqs, setReqs] = useState<SignatureRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('signature_requests').select('*')
      .eq('lead_id', lead.id).neq('status', 'cancelled').order('sent_at', { ascending: false });
    setReqs((data || []) as SignatureRequest[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, [lead.id]);

  return (
    <div className="border border-gray-200 rounded-xl p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="font-bold text-gray-900 flex items-center gap-2"><FileSignature className="h-4 w-4" /> NDA &amp; Disclosure Document</h3>
        <button onClick={load} className="text-xs text-gray-500 flex items-center gap-1 hover:text-gray-800"><RefreshCw className="h-3 w-3" /> Refresh</button>
      </div>
      {loading ? (
        <div className="text-sm text-gray-500 flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      ) : (
        <div className="space-y-4">
          {(['nda', 'disclosure'] as SignKind[]).map(kind => (
            <KindBlock key={kind} kind={kind} lead={lead} current={reqs.find(r => r.doc_kind === kind)} onChange={load} />
          ))}
        </div>
      )}
    </div>
  );
};

const KindBlock: React.FC<{ kind: SignKind; lead: Lead; current?: SignatureRequest; onChange: () => void }> = ({ kind, lead, current, onChange }) => {
  const { documents, addInteraction } = useData();
  const { user } = useAuth();
  const sender = user?.name || 'The Surgeon Group';
  const firstName = (lead.contactName || '').trim().split(/\s+/)[0] || 'there';
  const division = lead.division || '';

  // Master (not franchisee-specific) PDFs in the Documents vault
  const pdfs = useMemo(() => documents.filter(d => !d.franchiseeId && isPdf(d)).sort((a, b) => a.name.localeCompare(b.name)), [documents]);
  const suggested = useMemo(() => suggestDocument(pdfs, kind, division), [pdfs, kind, division]);
  const [docId, setDocId] = useState<string>('');
  useEffect(() => { if (!docId && suggested) setDocId(suggested.id); }, [suggested, docId]);

  const [replacing, setReplacing] = useState(false);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const link = current ? `${window.location.origin}/sign/${current.token}` : '';
  const label = KIND_LABEL[kind];

  const create = async () => {
    const doc = pdfs.find(d => d.id === docId);
    if (!doc) { setMsg({ ok: false, text: 'Choose the PDF to send first.' }); return; }
    setBusy('create'); setMsg(null);
    if (current && current.status !== 'signed') {
      await supabase.from('signature_requests').update({ status: 'cancelled' }).eq('id', current.id);
    }
    const { error } = await supabase.from('signature_requests').insert({
      lead_id: lead.id, doc_kind: kind, division: division || null,
      signer_name: lead.contactName, signer_email: lead.email,
      document_id: doc.id, source_name: doc.name, source_path: doc.filePath,
      sent_by: user?.name || null,
    });
    setBusy('');
    if (error) { setMsg({ ok: false, text: error.message }); return; }
    addInteraction(lead.id, `${label} signing link created (${doc.name})`, user?.name || 'System');
    setReplacing(false);
    onChange();
  };

  const copy = async () => {
    await navigator.clipboard.writeText(link);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  const mailBody = kind === 'nda'
    ? `Dear ${firstName},

Thank you for your continued interest in a ${division || 'Surgeon Group'} franchise with The Surgeon Group.

Before we share our financial and operating information with you, we ask every prospective franchisee to sign our confidentiality agreement (NDA). The link below opens the agreement. Please read it, then sign it online. It takes about five minutes.

${link}

You will receive a signed copy by email as soon as you have signed.

Kind regards,
${sender}
The Surgeon Group, Franchising Division`
    : `Dear ${firstName},

As part of the franchise process, we are required to give you our disclosure document at least 14 days before you sign a franchise agreement.

The link below opens the ${division || 'Surgeon Group'} disclosure document. Please read it carefully, then confirm online that you have received it. You are welcome to share it with your attorney, accountant or financial adviser.

${link}

You will receive a copy, with the date you received it, by email.

Kind regards,
${sender}
The Surgeon Group, Franchising Division`;

  const openMail = () => {
    const subject = kind === 'nda' ? 'Confidentiality agreement (NDA) - The Surgeon Group' : `Your ${division} franchise disclosure document - The Surgeon Group`;
    window.location.href = `mailto:${encodeURIComponent(lead.email || '')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(mailBody)}`;
    addInteraction(lead.id, `${label} link emailed (from own mailbox)`, user?.name || 'System');
  };

  const sendFromCrm = async () => {
    if (!current) return;
    setBusy('send'); setMsg(null);
    const { data, error } = await supabase.functions.invoke('document-signing', {
      body: { action: 'invite', request_id: current.id, app_url: window.location.origin, sender_name: sender },
    });
    setBusy('');
    if (error || !data?.ok) {
      setMsg({ ok: false, text: `Could not send from the CRM (${(data && data.error) || error?.message || 'unknown error'}). Use "Email from my mailbox" instead.` });
      return;
    }
    setMsg({ ok: true, text: `Sent to ${lead.email}` });
    addInteraction(lead.id, `${label} link emailed to ${lead.email}`, user?.name || 'System');
  };

  const openSigned = async () => {
    if (!current) return;
    const url = await signedCopyUrl(current);
    if (url) window.open(url, '_blank'); else setMsg({ ok: false, text: 'Signed copy not found.' });
  };

  const showPicker = !current || replacing;
  const earliestFa = current?.signed_at && kind === 'disclosure' ? new Date(new Date(current.signed_at).getTime() + 14 * 86400000) : null;

  return (
    <div className="rounded-lg bg-gray-50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <div className="font-semibold text-sm text-gray-900">{label}{kind === 'disclosure' && division ? ` – ${division}` : ''}</div>
        {current && !replacing && <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS[current.status].cls}`}>{STATUS[current.status].label}</span>}
      </div>

      {showPicker ? (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <select value={docId} onChange={e => setDocId(e.target.value)} className="input flex-1 min-w-[220px] text-sm">
              <option value="">Choose the PDF to send…</option>
              {pdfs.map(d => <option key={d.id} value={d.id}>{d.name}{d.id === suggested?.id ? '  (suggested)' : ''}</option>)}
            </select>
            <button onClick={create} disabled={!!busy || !docId} className="bg-[#C41E3A] hover:bg-[#a01830] text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 disabled:opacity-50">
              {busy === 'create' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSignature className="h-4 w-4" />} Create signing link
            </button>
            {replacing && <button onClick={() => setReplacing(false)} className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900">Cancel</button>}
          </div>
          <p className="text-xs text-gray-500">
            {pdfs.length === 0
              ? 'No PDFs in Documents yet. Upload the NDA and the disclosure document for each division (as PDFs) under Documents first.'
              : kind === 'disclosure'
                ? `Pick the disclosure document for ${division || "this lead's division"}. Lists the master PDFs in Documents.`
                : 'Lists the master PDFs in Documents.'}
            {replacing && current?.status !== 'signed' && ' The current link will stop working.'}
          </p>
        </div>
      ) : current && (
        <div className="space-y-2">
          <div className="text-xs text-gray-600">Document: <span className="font-medium text-gray-800">{current.source_name}</span></div>

          {current.status !== 'signed' && (
            <>
              <div className="flex gap-2">
                <input readOnly value={link} className="input flex-1 text-xs font-mono bg-white" onFocus={e => e.target.select()} />
                <button onClick={copy} className="px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm font-semibold flex items-center gap-1.5 hover:bg-gray-50 whitespace-nowrap">
                  {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />} {copied ? 'Copied' : 'Copy link'}
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={openMail} disabled={!lead.email} className="bg-[#1a1a1a] text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 disabled:opacity-50">
                  <Mail className="h-4 w-4" /> Email from my mailbox
                </button>
                <button onClick={sendFromCrm} disabled={!!busy || !lead.email} className="border border-gray-300 bg-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 hover:bg-gray-50 disabled:opacity-50">
                  {busy === 'send' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send from CRM
                </button>
              </div>
            </>
          )}

          {current.status === 'signed' && (
            <div className="text-sm space-y-1">
              <div className="text-green-800">
                {kind === 'nda' ? 'Signed' : 'Receipt confirmed'} by <b>{current.signed_name}</b>
                {current.signed_company ? ` for ${current.signed_company}${current.signed_capacity ? ` (${current.signed_capacity})` : ''}` : ''} on {fmt(current.signed_at)}
              </div>
              {earliestFa && <div className="text-gray-700">Franchise agreement may be signed from <b>{fmtDay(earliestFa)}</b> (14 days after receipt).</div>}
              {current.copied_document_id && <div className="text-xs text-gray-500">Copied to the franchisee's Documents.</div>}
              <button onClick={openSigned} className="mt-1 border border-gray-300 bg-white px-3 py-1.5 rounded-lg text-sm font-semibold flex items-center gap-1.5 hover:bg-gray-50">
                <Download className="h-4 w-4" /> Open signed copy (PDF)
              </button>
            </div>
          )}

          <div className="text-xs text-gray-500 flex flex-wrap gap-x-4 gap-y-1 items-center">
            <span>Created {fmt(current.sent_at)}{current.sent_by ? ` by ${current.sent_by}` : ''}</span>
            {current.opened_at && <span>Opened {fmt(current.opened_at)}</span>}
            <button onClick={() => { setReplacing(true); setDocId(''); }} className="flex items-center gap-1 hover:text-gray-800">
              <RotateCcw className="h-3 w-3" /> {current.status === 'signed' ? 'Send again (new document)' : 'Change document / new link'}
            </button>
          </div>
        </div>
      )}

      {msg && <p className={`text-sm mt-2 ${msg.ok ? 'text-green-700' : 'text-red-700'}`}>{msg.text}</p>}
    </div>
  );
};

export default LeadSigningPanel;
