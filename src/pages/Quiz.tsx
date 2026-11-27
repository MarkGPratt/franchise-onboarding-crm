import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { LOGO_URL } from '@/lib/seedData';
import { Check, Loader2, BookOpen, RotateCcw } from 'lucide-react';

/** Public knowledge check, opened from a private link (no login). */
interface QQ { id: string; prompt: string; options: string[] }
interface QM { id: string; title: string; description: string | null; pass_pct: number; passed: boolean; attempts: number; questions: QQ[] }
interface Quiz { person_name: string; completed_at: string | null; modules: QM[] }
interface Result { score: number; total: number; passed: boolean; pass_pct: number; wrong: { id: string; prompt: string; reference: string | null }[]; all_passed: boolean }

const Quiz: React.FC = () => {
  const { token = '' } = useParams();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [mod, setMod] = useState<QM | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data, error } = await supabase.rpc('quiz_get', { p_token: token });
    if (error) setErr(error.message); else if (!data) setErr('This link is not valid any more. Please ask Head Office for a new one.');
    setQuiz((data as Quiz) || null); setLoading(false);
  };
  useEffect(() => { load(); }, [token]);

  const start = (m: QM) => { setMod(m); setAnswers({}); setResult(null); window.scrollTo(0, 0); };
  const submit = async () => {
    if (!mod) return;
    if (mod.questions.some(q => answers[q.id] === undefined)) { alert('Please answer every question.'); return; }
    setBusy(true);
    const { data, error } = await supabase.rpc('quiz_submit', { p_token: token, p_module: mod.id, p_answers: answers });
    setBusy(false);
    if (error) { alert(error.message); return; }
    setResult(data as Result); window.scrollTo(0, 0); load();
  };

  const Header = () => (
    <div className="bg-white border-b-4 border-[#C41E3A]"><div className="max-w-3xl mx-auto px-5 py-4 flex items-center gap-4">
      <img src={LOGO_URL} alt="The Surgeon Group" className="h-10" />
      <div className="text-sm text-gray-600">Knowledge check</div></div></div>
  );

  if (loading) return <div className="min-h-screen bg-gray-50"><Header /><div className="py-20 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div></div>;
  if (err || !quiz) return <div className="min-h-screen bg-gray-50"><Header /><p className="max-w-3xl mx-auto p-6 text-gray-700">{err}</p></div>;

  return (
    <div className="min-h-screen bg-gray-50" style={{ fontFamily: 'Montserrat, system-ui, sans-serif' }}>
      <Header />
      <div className="max-w-3xl mx-auto p-5">
        {!mod ? (
          <>
            <h1 className="text-2xl font-bold text-gray-900">Hello {quiz.person_name.split(' ')[0]}</h1>
            <p className="text-gray-600 mt-1">Answer each part 100% correctly. If an answer is wrong, you'll be shown which clause or section to re-read, and you can try again as often as you need.</p>
            {quiz.completed_at && <p className="mt-4 p-3 rounded-lg bg-green-50 text-green-800 text-sm font-semibold">You have passed every part. Thank you.</p>}
            <div className="mt-5 space-y-3">
              {quiz.modules.map(m => (
                <div key={m.id} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-4">
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center ${m.passed ? 'bg-green-100 text-green-700' : 'bg-red-50 text-[#C41E3A]'}`}>{m.passed ? <Check className="h-5 w-5" /> : <BookOpen className="h-5 w-5" />}</div>
                  <div className="flex-1"><div className="font-semibold">{m.title}</div><div className="text-sm text-gray-500">{m.description} · {m.questions.length} questions{m.attempts ? ` · ${m.attempts} attempt${m.attempts === 1 ? '' : 's'}` : ''}</div></div>
                  {m.passed ? <span className="text-sm font-semibold text-green-700">Passed</span> : <button onClick={() => start(m)} className="bg-[#C41E3A] text-white px-4 py-2 rounded-lg text-sm font-semibold">{m.attempts ? 'Try again' : 'Start'}</button>}
                </div>))}
            </div>
          </>
        ) : result ? (
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <h2 className="text-xl font-bold">{mod.title}</h2>
            <p className={`mt-2 text-lg font-semibold ${result.passed ? 'text-green-700' : 'text-[#C41E3A]'}`}>{result.score} out of {result.total}{result.passed ? ' — passed' : ` — ${result.pass_pct}% is needed to pass`}</p>
            {result.wrong.length > 0 && (<>
              <p className="mt-4 text-sm text-gray-700">Re-read these, then try again:</p>
              <ul className="mt-2 space-y-2">{result.wrong.map(w => <li key={w.id} className="text-sm border-l-4 border-amber-400 pl-3"><div>{w.prompt}</div>{w.reference && <div className="text-xs text-gray-500 mt-0.5">See: {w.reference}</div>}</li>)}</ul>
            </>)}
            <div className="mt-6 flex gap-3">
              {!result.passed && <button onClick={() => start(mod)} className="bg-[#C41E3A] text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2"><RotateCcw className="h-4 w-4" /> Try again</button>}
              <button onClick={() => { setMod(null); setResult(null); }} className="border border-gray-300 px-4 py-2 rounded-lg text-sm font-semibold">Back to all parts</button>
            </div>
          </div>
        ) : (
          <div>
            <button onClick={() => setMod(null)} className="text-sm text-gray-500">← All parts</button>
            <h2 className="text-xl font-bold mt-2">{mod.title}</h2>
            <div className="mt-4 space-y-4">
              {mod.questions.map((q, i) => (
                <div key={q.id} className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="font-medium">{i + 1}. {q.prompt}</div>
                  <div className="mt-2 space-y-1.5">{q.options.map((o, j) => (
                    <label key={j} className={`flex items-start gap-2 p-2 rounded-lg border cursor-pointer text-sm ${answers[q.id] === j ? 'border-[#C41E3A] bg-red-50' : 'border-gray-200'}`}>
                      <input type="radio" name={q.id} checked={answers[q.id] === j} onChange={() => setAnswers(a => ({ ...a, [q.id]: j }))} className="mt-0.5" /> {o}
                    </label>))}</div>
                </div>))}
            </div>
            <div className="mt-5 flex items-center gap-3">
              <button onClick={submit} disabled={busy} className="bg-[#C41E3A] text-white px-5 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2">{busy && <Loader2 className="h-4 w-4 animate-spin" />} Submit answers</button>
              <span className="text-sm text-gray-500">{Object.keys(answers).length} of {mod.questions.length} answered</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Quiz;
