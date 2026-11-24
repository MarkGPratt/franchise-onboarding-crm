import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { WELCOME } from '@/lib/applicationForm';

// Public page: a prospect reads the NDA or disclosure document and signs it.
// Every call goes through the document-signing edge function, which checks the token.
// Surgeon Group CI: Montserrat; Surgeon Red used as an accent only; red rule.
const RED = '#C61F26';
const INK = '#231F20';

interface ViewData {
  kind: 'nda' | 'disclosure';
  title: string;
  division: string;
  signer_name: string;
  document_name: string;
  status: 'open' | 'signed';
  signed_at: string | null;
  pdf_url: string | null;
  statements: string[];
}

type Phase = 'loading' | 'notfound' | 'sign' | 'done' | 'already';

const fmtDate = (d?: string | null) => d
  ? new Date(d).toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  : '';

const Sign: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [phase, setPhase] = useState<Phase>('loading');
  const [data, setData] = useState<ViewData | null>(null);
  const [ticks, setTicks] = useState<boolean[]>([]);
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [capacity, setCapacity] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const id = 'montserrat-font';
    if (!document.getElementById(id)) {
      const l = document.createElement('link');
      l.id = id; l.rel = 'stylesheet';
      l.href = 'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap';
      document.head.appendChild(l);
    }
  }, []);

  const load = async () => {
    if (!token) { setPhase('notfound'); return null; }
    const { data: d, error } = await supabase.functions.invoke('document-signing', { body: { action: 'view', token } });
    if (error || !d?.ok) { setPhase('notfound'); return null; }
    setData(d as ViewData);
    document.title = `${d.title} | The Surgeon Group`;
    return d as ViewData;
  };

  useEffect(() => {
    (async () => {
      const d = await load();
      if (!d) return;
      setTicks(d.statements.map(() => false));
      if (!name && d.signer_name) setName(d.signer_name);
      setPhase(d.status === 'signed' ? 'already' : 'sign');
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const submit = async () => {
    if (!data) return;
    const errs: string[] = [];
    if (ticks.some(t => !t)) errs.push('Please tick every statement.');
    if (name.trim().length < 4 || !name.trim().includes(' ')) errs.push('Please type your full name (first name and surname).');
    if (data.kind === 'nda' && company.trim() && !capacity.trim()) errs.push('Please give your capacity (for example Director) when signing for a company.');
    setErrors(errs);
    if (errs.length) return;
    setBusy(true);
    const { data: r, error } = await supabase.functions.invoke('document-signing', {
      body: { action: 'sign', token, name: name.trim(), company: company.trim(), capacity: capacity.trim(), accepted: ticks, user_agent: navigator.userAgent, app_url: window.location.origin },
    });
    setBusy(false);
    if (error || !r?.ok) {
      let msg = r?.error;
      if (!msg && error && (error as any).context?.json) { try { msg = (await (error as any).context.json()).error; } catch { /* ignore */ } }
      setErrors([msg || 'Could not complete. Please check your connection and try again.']);
      return;
    }
    await load();
    setPhase('done');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const isNda = data?.kind === 'nda';
  const first = (data?.signer_name || '').split(' ')[0];

  return (
    <div style={{ fontFamily: 'Montserrat, Arial, sans-serif', color: INK }} className="min-h-screen bg-[#F5F5F5]">
      <style>{`
        .sg-input { width:100%; border:1px solid #CFCFCF; border-radius:6px; padding:10px 12px; font-size:15px; background:#fff; }
        .sg-input:focus { outline:none; border-color:${RED}; box-shadow:0 0 0 3px rgba(198,31,38,.12); }
        .sg-btn { background:${RED}; color:#fff; font-weight:700; padding:13px 26px; border-radius:6px; font-size:15px; }
        .sg-btn:hover { background:#A8191F; }
        .sg-btn:disabled { opacity:.6; }
        .sg-link { color:${RED}; font-weight:700; }
      `}</style>

      <header className="bg-white">
        <div className="max-w-4xl mx-auto px-5 py-4 flex items-center justify-between gap-4">
          <img src="/surgeon-group-logo.png" alt="The Surgeon Group" className="h-12 sm:h-14 w-auto" />
          <span className="text-xs sm:text-sm font-semibold tracking-wide uppercase text-[#6B6B6B] text-right">Franchising Division</span>
        </div>
        <div style={{ height: 4, background: RED }} />
      </header>

      <main className="max-w-4xl mx-auto px-5 py-8 sm:py-10">
        {phase === 'loading' && <p className="text-center py-20 text-[#6B6B6B]">Loading your document…</p>}

        {phase === 'notfound' && (
          <Card>
            <H1>This link is not valid</H1>
            <p>The link may have been mistyped or replaced by a newer one. Please contact us on {WELCOME.contact.phone} or <a className="sg-link" href={`mailto:${WELCOME.contact.email}`}>{WELCOME.contact.email}</a> and we will send you a new link.</p>
          </Card>
        )}

        {(phase === 'done' || phase === 'already') && data && (
          <Card>
            <H1>{phase === 'done' ? 'Thank you. That is done.' : 'This document has already been completed'}</H1>
            <p className="mb-3">
              {isNda
                ? <>The {data.title} was signed on {fmtDate(data.signed_at)}.</>
                : <>You confirmed receipt of the {data.division} disclosure document on {fmtDate(data.signed_at)}.</>}
              {phase === 'done' && ' We have emailed you a copy.'}
            </p>
            {data.pdf_url && <p className="mb-3"><a className="sg-link" href={data.pdf_url} target="_blank" rel="noreferrer">Download your copy (PDF)</a></p>}
            {!isNda && <p className="mb-3 text-[#4A4A4A]">Please take the time to read it properly, and to discuss it with your attorney, accountant or financial adviser. A franchise agreement can only be signed at least 14 days after you received this document.</p>}
            <ContactLine />
          </Card>
        )}

        {phase === 'sign' && data && (
          <>
            <Card>
              <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: RED }}>{isNda ? 'For your signature' : 'Please read and confirm receipt'}</p>
              <H1>{data.title}{data.division && !isNda ? ` – ${data.division}` : ''}</H1>
              <p className="mb-2">
                {first ? `Dear ${first}, ` : ''}
                {isNda
                  ? 'before we share our financial and operating information with you, we ask every prospective franchisee to sign our confidentiality agreement. Please read it below, then sign at the bottom of this page.'
                  : 'we are required to give you our disclosure document at least 14 days before you sign a franchise agreement. Please read it below, then confirm at the bottom of this page that you have received it.'}
              </p>
              <p className="text-sm text-[#6B6B6B]">You will receive a copy by email as soon as you have {isNda ? 'signed' : 'confirmed'}.</p>
            </Card>

            <div className="bg-white rounded-lg shadow-sm overflow-hidden mb-6">
              <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-[#E2E2E2]">
                <span className="font-semibold text-sm truncate">{data.document_name}</span>
                {data.pdf_url && <a className="sg-link text-sm" href={data.pdf_url} target="_blank" rel="noreferrer">Open in a new tab</a>}
              </div>
              {data.pdf_url
                ? <iframe title={data.title} src={data.pdf_url} className="w-full h-[70vh] hidden sm:block" />
                : <p className="p-6 text-sm">The document could not be loaded. Please refresh the page.</p>}
              {data.pdf_url && (
                <div className="sm:hidden p-5 text-sm">
                  <a className="sg-btn inline-block" href={data.pdf_url} target="_blank" rel="noreferrer">Open the document</a>
                  <p className="mt-3 text-[#6B6B6B]">Read it, then come back to this page to {isNda ? 'sign' : 'confirm'}.</p>
                </div>
              )}
            </div>

            <Card>
              <h2 className="text-lg font-bold mb-4">{isNda ? 'Sign the agreement' : 'Confirm receipt'}</h2>
              <div className="space-y-3 mb-6">
                {data.statements.map((s, i) => (
                  <label key={i} className="flex items-start gap-3 cursor-pointer">
                    <input type="checkbox" className="mt-1 h-5 w-5 accent-[#C61F26] shrink-0" checked={!!ticks[i]}
                      onChange={e => setTicks(t => t.map((v, j) => j === i ? e.target.checked : v))} />
                    <span className="text-[15px]">{s}</span>
                  </label>
                ))}
              </div>

              <div className="grid sm:grid-cols-2 gap-4 mb-4">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-semibold mb-1">Your full name (this is your electronic signature) *</label>
                  <input className="sg-input" value={name} onChange={e => setName(e.target.value)} autoComplete="name" />
                </div>
                {isNda && (
                  <>
                    <div>
                      <label className="block text-sm font-semibold mb-1">Signing on behalf of a company? Company name</label>
                      <input className="sg-input" value={company} onChange={e => setCompany(e.target.value)} placeholder="Leave blank if signing personally" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold mb-1">Your capacity</label>
                      <input className="sg-input" value={capacity} onChange={e => setCapacity(e.target.value)} placeholder="e.g. Director" />
                    </div>
                  </>
                )}
              </div>

              {name.trim() && (
                <div className="mb-5 px-4 py-3 border border-dashed border-[#CFCFCF] rounded-md bg-[#FAFAFA]">
                  <div className="text-xs text-[#6B6B6B] mb-1">Signature</div>
                  <div style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: 24 }}>{name}</div>
                  <div className="text-xs text-[#6B6B6B] mt-1">Date: {new Date().toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                </div>
              )}

              {errors.length > 0 && (
                <div className="mb-4 p-3 rounded-md bg-[#FDECEC] text-[#8A1219] text-sm">{errors.map((e, i) => <div key={i}>{e}</div>)}</div>
              )}

              <button className="sg-btn" disabled={busy} onClick={submit}>
                {busy ? 'Please wait…' : isNda ? 'Sign' : 'Confirm receipt'}
              </button>
              <p className="text-xs text-[#6B6B6B] mt-4">We record the date and time, your IP address and browser with your signature, and attach a certificate to the document.</p>
            </Card>
          </>
        )}
      </main>
    </div>
  );
};

const Card: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="bg-white rounded-lg shadow-sm p-6 sm:p-8 mb-6 text-[15px] leading-relaxed">{children}</div>
);
const H1: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h1 className="text-2xl sm:text-[28px] font-extrabold leading-tight mb-4">{children}</h1>
);
const ContactLine = () => (
  <p className="text-sm text-[#6B6B6B] mt-4">Questions? Call {WELCOME.contact.phone} or email <a className="sg-link" href={`mailto:${WELCOME.contact.email}`}>{WELCOME.contact.email}</a>.</p>
);

export default Sign;
