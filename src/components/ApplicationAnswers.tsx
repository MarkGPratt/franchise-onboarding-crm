import React from 'react';
import {
  APPLICATION_SECTIONS, BALANCE_ASSETS, BALANCE_LIABILITIES, Answers, FormField,
  balanceTotals, fmtRand, isFilled, isVisible, num,
} from '@/lib/applicationForm';

// Read-only view of a submitted (or part-completed) application.
// Inline styles only, so the same markup prints cleanly in a new window.

const RED = '#C61F26';
const INK = '#231F20';
const muted: React.CSSProperties = { color: '#8A8A8A', fontStyle: 'italic' };
const fmtCur = (v: any) => (v === undefined || v === null || String(v).trim() === '') ? '' : fmtRand(num(v));

const Value: React.FC<{ f: FormField; v: any }> = ({ f, v }) => {
  if (!isFilled(f, v) && !['grid', 'rank', 'balance'].includes(f.type)) return <span style={muted}>Not answered</span>;
  switch (f.type) {
    case 'checkboxes': return <>{(v as string[]).join(', ')}</>;
    case 'currency': return <>{fmtCur(v)}</>;
    case 'rank': {
      const entries = Object.entries((v || {}) as Record<string, string>).filter(([, n]) => n).sort((a, b) => +a[1] - +b[1]);
      return entries.length ? <>{entries.map(([k, n]) => `${n}. ${k}`).join('   ')}</> : <span style={muted}>Not answered</span>;
    }
    case 'grid': {
      const rows: Record<string, string>[] = Array.isArray(v) ? v : [];
      const cols = f.columns || [];
      const n = f.rowLabels ? f.rowLabels.length : (f.rows || 1);
      const any = rows.some(r => r && Object.values(r).some(x => String(x || '').trim()));
      if (!any) return <span style={muted}>Not answered</span>;
      return (
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13, marginTop: 4 }}>
          <thead><tr>
            {f.rowLabels && <th style={th}></th>}
            {cols.map(c => <th key={c.key} style={th}>{c.label}</th>)}
          </tr></thead>
          <tbody>
            {Array.from({ length: n }, (_, i) => (
              <tr key={i}>
                {f.rowLabels && <td style={{ ...td, fontWeight: 600 }}>{f.rowLabels[i]}</td>}
                {cols.map(c => <td key={c.key} style={td}>{c.type === 'currency' ? fmtCur(rows[i]?.[c.key]) : (rows[i]?.[c.key] || '')}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      );
    }
    case 'balance': {
      const b = (v || {}) as Record<string, string>;
      const t = balanceTotals(b);
      return (
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13, marginTop: 4 }}>
          <tbody>
            {BALANCE_ASSETS.map(a => <tr key={a.key}><td style={td}>{a.label}</td><td style={{ ...td, textAlign: 'right' }}>{fmtCur(b[a.key])}</td></tr>)}
            <tr><td style={{ ...td, fontWeight: 700 }}>(A) Total assets</td><td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>{fmtRand(t.assets)}</td></tr>
            {BALANCE_LIABILITIES.map(a => <tr key={a.key}><td style={td}>{a.label}</td><td style={{ ...td, textAlign: 'right' }}>{fmtCur(b[a.key])}</td></tr>)}
            <tr><td style={{ ...td, fontWeight: 700 }}>(B) Total liabilities</td><td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>{fmtRand(t.liabilities)}</td></tr>
            <tr><td style={{ ...td, fontWeight: 800, borderTop: `2px solid ${RED}` }}>Net worth (A minus B)</td><td style={{ ...td, textAlign: 'right', fontWeight: 800, borderTop: `2px solid ${RED}` }}>{fmtRand(t.net)}</td></tr>
            {b.details && <tr><td colSpan={2} style={td}><b>Details:</b> {b.details}</td></tr>}
          </tbody>
        </table>
      );
    }
    default: return <span style={{ whiteSpace: 'pre-wrap' }}>{String(v)}</span>;
  }
};

const th: React.CSSProperties = { textAlign: 'left', padding: '4px 6px', borderBottom: '1px solid #ddd', fontWeight: 700, fontSize: 12 };
const td: React.CSSProperties = { padding: '4px 6px', borderBottom: '1px solid #eee', verticalAlign: 'top' };

const ApplicationAnswers: React.FC<{ answers: Answers; submittedAt?: string | null }> = ({ answers, submittedAt }) => (
  <div style={{ fontFamily: 'Montserrat, Arial, sans-serif', color: INK, fontSize: 14 }}>
    {APPLICATION_SECTIONS.map(s => (
      <div key={s.id} style={{ marginBottom: 22, breakInside: 'avoid-page' }}>
        <h3 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 4px' }}>{s.title}</h3>
        <div style={{ width: 40, height: 3, background: RED, marginBottom: 10 }} />
        {s.fields.filter(f => isVisible(f, answers)).map(f => (
          <div key={f.key} style={{ padding: '6px 0', borderBottom: '1px solid #f0f0f0', breakInside: 'avoid' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#555', marginBottom: 2 }}>{f.label}</div>
            <div><Value f={f} v={answers[f.key]} /></div>
          </div>
        ))}
      </div>
    ))}
    <div style={{ marginBottom: 10 }}>
      <h3 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 4px' }}>Declaration</h3>
      <div style={{ width: 40, height: 3, background: RED, marginBottom: 10 }} />
      <div>{answers.declaration_agreed ? 'Agreed' : <span style={muted}>Not yet agreed</span>}
        {answers.declaration_name ? ` · Signed: ${answers.declaration_name}` : ''}
        {answers.declaration_date ? ` · ${answers.declaration_date}` : ''}
        {submittedAt ? ` · Submitted ${new Date(submittedAt).toLocaleString('en-ZA')}` : ''}
      </div>
    </div>
  </div>
);

export default ApplicationAnswers;
