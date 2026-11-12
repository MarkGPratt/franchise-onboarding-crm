import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import {
  APPLICATION_SECTIONS, BALANCE_ASSETS, BALANCE_LIABILITIES, DECLARATION_TEXT, WELCOME, DIVISION_OPTIONS,
  Answers, FormField, balanceTotals, fmtRand, isVisible, missingRequired,
} from '@/lib/applicationForm';

// Surgeon Group CI: Montserrat; Surgeon Red used as an accent only; red rule.
const RED = '#C61F26';
const INK = '#231F20';

type Phase = 'loading' | 'notfound' | 'welcome' | 'form' | 'done' | 'locked';

const todayYmd = () => new Date().toISOString().slice(0, 10);

/** Map the lead's division name onto the form's division options. */
const matchDivision = (d?: string) => {
  if (!d) return [];
  const low = d.toLowerCase();
  return DIVISION_OPTIONS.filter(o =>
    (low.includes('drain') || low.includes('plumb')) ? o.includes('Drain')
      : (low.includes('electr')) ? o.includes('Electro')
        : (low.includes('air')) ? o.includes('Aircon') : false);
};

const Apply: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [phase, setPhase] = useState<Phase>('loading');
  const [name, setName] = useState('');
  const [answers, setAnswers] = useState<Answers>({});
  const [step, setStep] = useState(0); // 0..sections.length (last = declaration)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const dirty = useRef(false);
  const timer = useRef<number | undefined>();
  const topRef = useRef<HTMLDivElement>(null);

  const totalSteps = APPLICATION_SECTIONS.length + 1;

  // Montserrat for this page only
  useEffect(() => {
    const id = 'montserrat-font';
    if (!document.getElementById(id)) {
      const l = document.createElement('link');
      l.id = id; l.rel = 'stylesheet';
      l.href = 'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap';
      document.head.appendChild(l);
    }
    document.title = 'Franchise Application | The Surgeon Group';
  }, []);

  useEffect(() => {
    (async () => {
      if (!token) { setPhase('notfound'); return; }
      const { data, error } = await supabase.rpc('get_franchise_application', { p_token: token });
      if (error || !data) { setPhase('notfound'); return; }
      setName(data.applicant_name || '');
      if (data.status === 'submitted') { setPhase('locked'); return; }
      const a: Answers = data.answers || {};
      if (!a.divisions || a.divisions.length === 0) {
        const pre = matchDivision(data.division);
        if (pre.length) a.divisions = pre;
      }
      if (!a.first_names && data.applicant_name) {
        const parts = String(data.applicant_name).trim().split(/\s+/);
        if (parts.length > 1) { a.first_names = parts.slice(0, -1).join(' '); a.surname = parts[parts.length - 1]; }
        else a.first_names = parts[0];
      }
      setAnswers(a);
      setPhase('welcome');
    })();
  }, [token]);

  const save = async (a: Answers, submit = false) => {
    setSaveState('saving');
    const { error } = await supabase.rpc('save_franchise_application', { p_token: token, p_answers: a, p_submit: submit });
    if (error) { setSaveState('error'); throw error; }
    dirty.current = false;
    setSaveState('saved');
  };

  // Autosave 1.5s after the last change
  const set = (key: string, value: any) => {
    setAnswers(prev => {
      const next = { ...prev, [key]: value };
      dirty.current = true;
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => { save(next).catch(() => {}); }, 1500);
      return next;
    });
  };

  // Save before the tab closes
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (dirty.current) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, []);

  const goTo = (i: number) => {
    if (dirty.current) { window.clearTimeout(timer.current); save(answers).catch(() => {}); }
    setErrors([]);
    setStep(i);
    setTimeout(() => topRef.current?.scrollIntoView({ behavior: 'smooth' }), 0);
  };

  const next = () => {
    const s = APPLICATION_SECTIONS[step];
    const miss = s ? missingRequired(s, answers) : [];
    if (miss.length) { setErrors(miss); return; }
    goTo(step + 1);
  };

  const submit = async () => {
    for (let i = 0; i < APPLICATION_SECTIONS.length; i++) {
      const miss = missingRequired(APPLICATION_SECTIONS[i], answers);
      if (miss.length) { setStep(i); setErrors(miss); topRef.current?.scrollIntoView(); return; }
    }
    const errs: string[] = [];
    if (!answers.declaration_agreed) errs.push('Please tick the declaration');
    if (!String(answers.declaration_name || '').trim()) errs.push('Please type your full name');
    if (errs.length) { setErrors(errs); return; }
    setSubmitting(true);
    window.clearTimeout(timer.current);
    try {
      const final = { ...answers, declaration_date: answers.declaration_date || todayYmd() };
      await save(final, true);
      supabase.functions.invoke('franchise-application', {
        body: { action: 'submitted', token, app_url: window.location.origin },
      }).catch(() => {});
      setPhase('done');
      topRef.current?.scrollIntoView();
    } catch (e: any) {
      setErrors([e?.message || 'Could not submit. Please try again.']);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ fontFamily: 'Montserrat, Arial, sans-serif', color: INK }} className="min-h-screen bg-[#F6F6F6]">
      <style>{`
        .sg-input { width:100%; padding:11px 14px; border:1px solid #CFCFCF; border-radius:6px; font-size:15px; background:#fff; color:${INK}; font-family:inherit; }
        .sg-input:focus { outline:none; border-color:${RED}; box-shadow:0 0 0 3px rgba(198,31,38,.12); }
        .sg-label { display:block; font-weight:600; font-size:14px; margin-bottom:6px; }
        .sg-rule { width:56px; height:3px; background:${RED}; margin:10px 0 18px; }
        .sg-btn { background:${RED}; color:#fff; font-weight:700; padding:12px 26px; border-radius:6px; font-size:15px; }
        .sg-btn:hover { background:#A8191F; }
        .sg-btn:disabled { opacity:.6; }
        .sg-btn-ghost { border:1.5px solid ${INK}; color:${INK}; font-weight:700; padding:11px 22px; border-radius:6px; font-size:15px; background:#fff; }
        .sg-btn-ghost:hover { background:#F0F0F0; }
        .sg-choice { display:flex; align-items:center; gap:10px; padding:10px 14px; border:1px solid #CFCFCF; border-radius:6px; background:#fff; cursor:pointer; font-size:15px; }
        .sg-choice.on { border-color:${RED}; box-shadow: inset 3px 0 0 ${RED}; }
        @media print { .no-print { display:none !important } }
      `}</style>

      <header className="bg-white">
        <div className="max-w-4xl mx-auto px-5 py-4 flex items-center justify-between gap-4">
          <img src="/surgeon-group-logo.png" alt="The Surgeon Group" className="h-12 sm:h-14 w-auto" />
          <span className="text-xs sm:text-sm font-semibold tracking-wide uppercase text-[#6B6B6B] text-right">Franchising Division</span>
        </div>
        <div style={{ height: 4, background: RED }} />
      </header>

      <div ref={topRef} />

      <main className="max-w-4xl mx-auto px-5 py-8 sm:py-10">
        {phase === 'loading' && <p className="text-center py-20 text-[#6B6B6B]">Loading your application…</p>}

        {phase === 'notfound' && (
          <Card>
            <H1>This link is not valid</H1>
            <p>The application link may have been mistyped or replaced by a newer one. Please contact us on {WELCOME.contact.phone} or <a className="font-semibold" style={{ color: RED }} href={`mailto:${WELCOME.contact.email}`}>{WELCOME.contact.email}</a> and we will send you a new link.</p>
          </Card>
        )}

        {phase === 'locked' && (
          <Card>
            <H1>Your application has been received</H1>
            <p>Thank you{name ? `, ${name.split(' ')[0]}` : ''}. Your application has already been submitted and is with our franchising team. We will be in touch.</p>
            <ContactLine />
          </Card>
        )}

        {phase === 'done' && (
          <Card>
            <H1>Thank you. Your application is in.</H1>
            <p className="mb-3">We have received your confidential application. A member of our franchising team will review it and contact you to arrange the next conversation.</p>
            <p className="mb-3">Next steps: we speak with you, you meet the team, and together we decide whether the opportunity is right for you. Training in Pretoria and your launch follow from there.</p>
            <ContactLine />
          </Card>
        )}

        {phase === 'welcome' && <Welcome name={name} onStart={() => { setPhase('form'); goTo(0); }} hasAnswers={Object.keys(answers).length > 3} />}

        {phase === 'form' && (
          <>
            <div className="mb-6">
              <div className="flex items-center justify-between text-sm font-semibold mb-2">
                <span>Step {step + 1} of {totalSteps}</span>
                <span className="text-[#6B6B6B] font-medium">
                  {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'All changes saved' : saveState === 'error' ? 'Not saved. Check your connection.' : ''}
                </span>
              </div>
              <div className="h-1.5 bg-[#E2E2E2] rounded-full overflow-hidden">
                <div style={{ width: `${((step + 1) / totalSteps) * 100}%`, background: RED }} className="h-full transition-all" />
              </div>
            </div>

            <Card>
              {step < APPLICATION_SECTIONS.length ? (
                <>
                  <H1>{APPLICATION_SECTIONS[step].title}</H1>
                  {APPLICATION_SECTIONS[step].intro && <p className="mb-6 text-[15px] leading-relaxed">{APPLICATION_SECTIONS[step].intro}</p>}
                  <div className="grid sm:grid-cols-2 gap-x-5 gap-y-5">
                    {APPLICATION_SECTIONS[step].fields.filter(f => isVisible(f, answers)).map(f => (
                      <div key={f.key} className={f.half ? '' : 'sm:col-span-2'}>
                        <FieldInput field={f} value={answers[f.key]} onChange={v => set(f.key, v)} />
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <H1>Declaration by applicant</H1>
                  <p className="text-[15px] leading-relaxed mb-5">{DECLARATION_TEXT}</p>
                  <label className={`sg-choice mb-5 ${answers.declaration_agreed ? 'on' : ''}`}>
                    <input type="checkbox" checked={!!answers.declaration_agreed} onChange={e => set('declaration_agreed', e.target.checked)} style={{ accentColor: RED, width: 18, height: 18 }} />
                    <span className="font-semibold">I have read and agree to this declaration</span>
                  </label>
                  <div className="grid sm:grid-cols-2 gap-5">
                    <div>
                      <label className="sg-label">Full name (serves as your signature)</label>
                      <input className="sg-input" value={answers.declaration_name || ''} onChange={e => set('declaration_name', e.target.value)} />
                    </div>
                    <div>
                      <label className="sg-label">Date</label>
                      <input className="sg-input" type="date" value={answers.declaration_date || todayYmd()} onChange={e => set('declaration_date', e.target.value)} />
                    </div>
                  </div>
                  <p className="text-sm text-[#6B6B6B] mt-6">{WELCOME.privacy}</p>
                </>
              )}

              {errors.length > 0 && (
                <div className="mt-6 rounded-md p-4 text-sm" style={{ background: '#FCEDED', borderLeft: `4px solid ${RED}` }}>
                  <div className="font-bold mb-1">Please complete:</div>
                  <ul className="list-disc ml-5">{errors.map(e => <li key={e}>{e}</li>)}</ul>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 mt-8 pt-6 border-t border-[#E2E2E2] no-print">
                <button className="sg-btn-ghost" onClick={() => step === 0 ? setPhase('welcome') : goTo(step - 1)}>Back</button>
                {step < APPLICATION_SECTIONS.length
                  ? <button className="sg-btn" onClick={next}>Save and continue</button>
                  : <button className="sg-btn" onClick={submit} disabled={submitting}>{submitting ? 'Submitting…' : 'Submit application'}</button>}
              </div>
            </Card>

            <p className="text-center text-sm text-[#6B6B6B] mt-5">Your answers save automatically. You can close this page and use the same link to continue later.</p>
          </>
        )}
      </main>

      <footer className="bg-white border-t border-[#E2E2E2]">
        <div className="max-w-4xl mx-auto px-5 py-5 text-xs text-[#6B6B6B] flex flex-wrap gap-x-6 gap-y-1">
          <span className="font-semibold" style={{ color: INK }}>The Surgeon Group</span>
          <span>{WELCOME.contact.address}</span>
          <span>{WELCOME.contact.phone}</span>
          <span>{WELCOME.contact.email}</span>
        </div>
      </footer>
    </div>
  );
};

const Card: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <section className="bg-white rounded-lg border border-[#E2E2E2] p-6 sm:p-9">{children}</section>
);

const H1: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <>
    <h1 className="text-2xl sm:text-[28px] font-extrabold leading-tight">{children}</h1>
    <div className="sg-rule" />
  </>
);

const H2: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <>
    <h2 className="text-lg sm:text-xl font-bold mt-9">{children}</h2>
    <div className="sg-rule" style={{ width: 40, margin: '8px 0 14px' }} />
  </>
);

const ContactLine = () => (
  <p className="mt-4 text-sm">
    Questions? Call <span className="font-semibold">{WELCOME.contact.phone}</span> or email{' '}
    <a href={`mailto:${WELCOME.contact.email}`} className="font-semibold" style={{ color: RED }}>{WELCOME.contact.email}</a>.
  </p>
);

const Welcome: React.FC<{ name: string; onStart: () => void; hasAnswers: boolean }> = ({ name, onStart, hasAnswers }) => {
  const low = WELCOME.investment.reduce((s, r) => s + r.low, 0);
  const high = WELCOME.investment.reduce((s, r) => s + r.high, 0);
  const vatLow = low * WELCOME.vatRate, vatHigh = high * WELCOME.vatRate;
  return (
    <Card>
      {name && <p className="text-sm font-semibold uppercase tracking-wide text-[#6B6B6B] mb-2">Dear {name.split(' ')[0]}</p>}
      <H1>{WELCOME.heading}</H1>
      {WELCOME.intro.map(p => <p key={p} className="text-[15px] leading-relaxed mb-3">{p}</p>)}

      <H2>Our franchise brands</H2>
      <div className="grid sm:grid-cols-3 gap-3">
        {WELCOME.divisions.map(d => (
          <div key={d.name} className="rounded-md border border-[#E2E2E2] p-4" style={{ borderTop: `3px solid ${RED}` }}>
            <div className="font-bold mb-1">{d.name}</div>
            <div className="text-sm leading-relaxed">{d.text}</div>
          </div>
        ))}
      </div>
      <p className="text-sm text-[#6B6B6B] mt-3">{WELCOME.coming}</p>

      <H2>What you get</H2>
      <div className="grid sm:grid-cols-2 gap-x-6 gap-y-4">
        {WELCOME.support.map(s => (
          <div key={s.title} className="pl-4" style={{ borderLeft: `3px solid ${RED}` }}>
            <div className="font-bold text-[15px]">{s.title}</div>
            <div className="text-sm leading-relaxed">{s.text}</div>
          </div>
        ))}
      </div>

      <H2>Initial investment</H2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: INK, color: '#fff' }}>
              <th className="text-left p-2.5 font-semibold">Item</th>
              <th className="text-right p-2.5 font-semibold whitespace-nowrap">From</th>
              <th className="text-right p-2.5 font-semibold whitespace-nowrap">To</th>
            </tr>
          </thead>
          <tbody>
            {WELCOME.investment.map(r => (
              <tr key={r.item} className="border-b border-[#E2E2E2]">
                <td className="p-2.5">{r.item}</td>
                <td className="p-2.5 text-right whitespace-nowrap">{fmtRand(r.low)}</td>
                <td className="p-2.5 text-right whitespace-nowrap">{fmtRand(r.high)}</td>
              </tr>
            ))}
            <tr className="border-b border-[#E2E2E2] font-semibold"><td className="p-2.5">Subtotal</td><td className="p-2.5 text-right">{fmtRand(low)}</td><td className="p-2.5 text-right">{fmtRand(high)}</td></tr>
            <tr className="border-b border-[#E2E2E2]"><td className="p-2.5">VAT (15%)</td><td className="p-2.5 text-right">{fmtRand(vatLow)}</td><td className="p-2.5 text-right">{fmtRand(vatHigh)}</td></tr>
            <tr className="border-b border-[#E2E2E2]"><td className="p-2.5">Own working capital</td><td className="p-2.5 text-right">{fmtRand(WELCOME.workingCapital)}</td><td className="p-2.5 text-right">{fmtRand(WELCOME.workingCapital)}</td></tr>
            <tr className="font-bold" style={{ borderTop: `2px solid ${RED}` }}>
              <td className="p-2.5">Total, including working capital</td>
              <td className="p-2.5 text-right whitespace-nowrap">{fmtRand(low + vatLow + WELCOME.workingCapital)}</td>
              <td className="p-2.5 text-right whitespace-nowrap">{fmtRand(high + vatHigh + WELCOME.workingCapital)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-sm text-[#6B6B6B] mt-2">{WELCOME.investmentNote}</p>

      <H2>Ongoing fees and term</H2>
      <div className="grid sm:grid-cols-3 gap-3">
        {WELCOME.ongoing.map(o => (
          <div key={o.label} className="rounded-md bg-[#F6F6F6] p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-[#6B6B6B] mb-1">{o.label}</div>
            <div className="font-bold">{o.value}</div>
          </div>
        ))}
      </div>

      <H2>The road to your own franchise</H2>
      <ol className="grid sm:grid-cols-3 gap-3">
        {WELCOME.steps.map((s, i) => {
          const here = i === WELCOME.currentStep;
          const done = i < WELCOME.currentStep;
          return (
            <li key={s} className="rounded-md p-3 flex gap-3 items-start" style={{ border: `1.5px solid ${here ? RED : '#E2E2E2'}`, background: here ? '#FFF7F7' : '#fff' }}>
              <span className="h-7 w-7 shrink-0 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: done || here ? RED : '#E2E2E2', color: done || here ? '#fff' : INK }}>{i + 1}</span>
              <span className="text-sm font-semibold leading-snug pt-1">{s}{here && <span className="block text-xs font-medium" style={{ color: RED }}>You are here</span>}</span>
            </li>
          );
        })}
      </ol>

      <div className="mt-10 rounded-md p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4 justify-between" style={{ background: INK, color: '#fff' }}>
        <div>
          <div className="font-bold text-lg">Ready to apply?</div>
          <div className="text-sm opacity-80">The questionnaire takes about 30 to 40 minutes. It saves as you go.</div>
        </div>
        <button className="sg-btn whitespace-nowrap" onClick={onStart}>{hasAnswers ? 'Continue my application' : 'Start my application'}</button>
      </div>
      <p className="text-sm text-[#6B6B6B] mt-4">{WELCOME.privacy}</p>
    </Card>
  );
};

const FieldInput: React.FC<{ field: FormField; value: any; onChange: (v: any) => void }> = ({ field: f, value, onChange }) => {
  const label = (
    <label className="sg-label">
      {f.label}{f.required && <span style={{ color: RED }}> *</span>}
    </label>
  );
  const help = f.help ? <p className="text-xs text-[#6B6B6B] mt-1">{f.help}</p> : null;

  switch (f.type) {
    case 'textarea':
      return <div>{label}<textarea className="sg-input" rows={3} value={value || ''} onChange={e => onChange(e.target.value)} />{help}</div>;
    case 'currency':
      return (
        <div>{label}
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B6B6B] text-sm font-semibold">R</span>
            <input className="sg-input" style={{ paddingLeft: 28 }} inputMode="decimal" value={value || ''} onChange={e => onChange(e.target.value)} />
          </div>{help}
        </div>
      );
    case 'radio':
    case 'yesno': {
      const opts = f.type === 'yesno' ? ['Yes', 'No'] : f.options || [];
      return (
        <div>{label}
          <div className="flex flex-wrap gap-2">
            {opts.map(o => (
              <label key={o} className={`sg-choice ${value === o ? 'on' : ''}`}>
                <input type="radio" name={f.key} checked={value === o} onChange={() => onChange(o)} style={{ accentColor: RED }} />{o}
              </label>
            ))}
          </div>{help}
        </div>
      );
    }
    case 'checkboxes': {
      const arr: string[] = Array.isArray(value) ? value : [];
      return (
        <div>{label}
          <div className="flex flex-col gap-2">
            {(f.options || []).map(o => (
              <label key={o} className={`sg-choice ${arr.includes(o) ? 'on' : ''}`}>
                <input type="checkbox" checked={arr.includes(o)} onChange={e => onChange(e.target.checked ? [...arr, o] : arr.filter(x => x !== o))} style={{ accentColor: RED, width: 17, height: 17 }} />{o}
              </label>
            ))}
          </div>{help}
        </div>
      );
    }
    case 'rank': {
      const opts = f.options || [];
      const v: Record<string, string> = value || {};
      return (
        <div>{label}
          <div className="grid sm:grid-cols-2 gap-2">
            {opts.map(o => (
              <div key={o} className="flex items-center gap-3 border border-[#CFCFCF] rounded-md px-3 py-2 bg-white">
                <select className="sg-input" style={{ width: 70, padding: '6px 8px' }} value={v[o] || ''} onChange={e => onChange({ ...v, [o]: e.target.value })}>
                  <option value="">–</option>
                  {opts.map((_, i) => <option key={i} value={String(i + 1)}>{i + 1}</option>)}
                </select>
                <span className="text-[15px]">{o}</span>
              </div>
            ))}
          </div>{help}
        </div>
      );
    }
    case 'grid': {
      const rows = f.rowLabels ? f.rowLabels.length : (f.rows || 1);
      const arr: Record<string, string>[] = Array.isArray(value) ? value : [];
      const setCell = (r: number, c: string, val: string) => {
        const next = Array.from({ length: rows }, (_, i) => ({ ...(arr[i] || {}) }));
        next[r][c] = val;
        onChange(next);
      };
      const cols = f.columns || [];
      return (
        <div>{label}{help}
          <div className="space-y-2 mt-1">
            {Array.from({ length: rows }, (_, r) => (
              <div key={r} className={`grid gap-2 items-center ${f.rowLabels ? 'sm:grid-cols-[minmax(160px,1fr)_2fr]' : ''}`}>
                {f.rowLabels && <div className="text-sm font-medium">{f.rowLabels[r]}</div>}
                <div className={`grid gap-2 ${cols.length > 2 ? 'sm:grid-cols-3' : cols.length === 2 ? 'sm:grid-cols-2' : ''}`}>
                  {cols.map(c => (
                    <input
                      key={c.key}
                      className="sg-input"
                      type={c.type === 'date' ? 'date' : c.type === 'tel' ? 'tel' : 'text'}
                      inputMode={c.type === 'currency' ? 'decimal' : undefined}
                      placeholder={(f.rowLabels && cols.length === 1) ? c.label : `${c.label}${!f.rowLabels && rows > 1 ? ` ${r + 1}` : ''}${c.type === 'currency' ? ' (R)' : ''}`}
                      aria-label={c.label}
                      value={arr[r]?.[c.key] || ''}
                      onChange={e => setCell(r, c.key, e.target.value)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }
    case 'balance': {
      const v: Record<string, string> = value || {};
      const t = balanceTotals(v);
      const line = (k: string, l: string) => (
        <div key={k} className="flex items-center justify-between gap-3 py-1.5 border-b border-[#EFEFEF]">
          <span className="text-sm">{l}</span>
          <div className="relative w-40 shrink-0">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B6B6B] text-sm font-semibold">R</span>
            <input className="sg-input text-right" style={{ paddingLeft: 26, padding: '7px 10px 7px 26px' }} inputMode="decimal" value={v[k] || ''} onChange={e => onChange({ ...v, [k]: e.target.value })} />
          </div>
        </div>
      );
      return (
        <div>{label}
          <div className="grid sm:grid-cols-2 gap-6 mt-1">
            <div>
              <div className="font-bold text-sm uppercase tracking-wide mb-1">Assets</div>
              {BALANCE_ASSETS.map(a => line(a.key, a.label))}
              <div className="flex justify-between font-bold pt-2"><span>(A) Total assets</span><span>{fmtRand(t.assets)}</span></div>
            </div>
            <div>
              <div className="font-bold text-sm uppercase tracking-wide mb-1">Liabilities</div>
              {BALANCE_LIABILITIES.map(a => line(a.key, a.label))}
              <div className="flex justify-between font-bold pt-2"><span>(B) Total liabilities</span><span>{fmtRand(t.liabilities)}</span></div>
            </div>
          </div>
          <div className="flex justify-between items-center mt-4 p-3 rounded-md font-bold" style={{ background: '#F6F6F6', borderLeft: `4px solid ${RED}` }}>
            <span>Your net worth (A minus B)</span><span>{fmtRand(t.net)}</span>
          </div>
          <div className="mt-3">
            <label className="sg-label">Details (optional)</label>
            <textarea className="sg-input" rows={2} value={v.details || ''} onChange={e => onChange({ ...v, details: e.target.value })} placeholder="For example, which properties, vehicles or loans the figures cover" />
          </div>
        </div>
      );
    }
    default:
      return (
        <div>{label}
          <input
            className="sg-input"
            type={f.type === 'email' ? 'email' : f.type === 'tel' ? 'tel' : f.type === 'date' ? 'date' : f.type === 'number' ? 'number' : 'text'}
            value={value || ''}
            onChange={e => onChange(e.target.value)}
          />{help}
        </div>
      );
  }
};

export default Apply;
