import React from 'react';
import { Lead } from '@/contexts/DataContext';
import { useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { ListChecks, PlayCircle } from 'lucide-react';
import {
  PROCESS_STAGES, PROCESS_STEPS, StepCompletion, stepDue, dueState, DUE_STYLES,
  fmtDate, todayYmd, processProgress,
} from '@/lib/leadProcess';

/** Per-lead checklist of the Lead Management Process, shown in the lead detail. */
const LeadProcessPanel: React.FC<{ lead: Lead }> = ({ lead }) => {
  const { updateLead } = useData();
  const { user } = useAuth();
  const steps = lead.processSteps || {};
  const start = lead.processStartDate;
  const prog = processProgress(steps);

  const toggle = (stepId: string) => {
    const next: Record<string, StepCompletion> = { ...steps };
    if (next[stepId]) delete next[stepId];
    else next[stepId] = { at: new Date().toISOString(), by: user?.name || 'Unknown' };
    updateLead(lead.id, { processSteps: next });
  };

  if (!start) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 p-4 bg-gray-50">
        <div className="flex items-center gap-2 font-bold text-gray-900 mb-1">
          <ListChecks className="h-4 w-4" /> Lead Management Process
        </div>
        <p className="text-sm text-gray-600 mb-3">
          This lead has no Day 1 date, so it is not on the To-Do list. Set the Day 1 date above
          (the day the enquiry was received), or start it from today.
        </p>
        <button
          onClick={() => updateLead(lead.id, { processStartDate: todayYmd() })}
          className="bg-[#1a1a1a] text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2"
        >
          <PlayCircle className="h-4 w-4" /> Start process today
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-bold text-gray-900 flex items-center gap-2">
          <ListChecks className="h-4 w-4" /> Lead Management Process
        </h3>
        <span className="text-xs font-semibold text-gray-600">{prog.done} of {prog.total} done</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-3">
        <div className="h-full bg-[#C41E3A] transition-all" style={{ width: `${prog.pct}%` }} />
      </div>
      <div className="space-y-3">
        {PROCESS_STAGES.map(stage => {
          const stageSteps = PROCESS_STEPS.filter(s => s.stage === stage.n);
          const stageDone = stageSteps.every(s => steps[s.id]);
          return (
            <div key={stage.n} className="border border-gray-200 rounded-lg overflow-hidden">
              <div className={`px-3 py-2 text-sm font-bold flex justify-between ${stageDone ? 'bg-green-50 text-green-800' : 'bg-gray-50 text-gray-800'}`}>
                <span>{stage.n}. {stage.title}</span>
                <span className="text-xs font-semibold">
                  {stageSteps.filter(s => steps[s.id]).length}/{stageSteps.length}
                </span>
              </div>
              <ul className="divide-y divide-gray-100">
                {stageSteps.map(s => {
                  const done = steps[s.id];
                  const due = stepDue(start, s);
                  const state = dueState(due, !!done);
                  return (
                    <li key={s.id} className="flex items-start gap-3 px-3 py-2">
                      <input
                        type="checkbox"
                        checked={!!done}
                        onChange={() => toggle(s.id)}
                        className="mt-1 h-4 w-4 accent-[#C41E3A] cursor-pointer"
                      />
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm ${done ? 'text-gray-400 line-through' : 'text-gray-900'}`}>{s.label}</div>
                        {s.detail && !done && <div className="text-xs text-gray-500">{s.detail}</div>}
                        {done && (
                          <div className="text-xs text-gray-400">
                            Done by {done.by} · {new Date(done.at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })}
                          </div>
                        )}
                      </div>
                      <span className={`shrink-0 px-2 py-0.5 rounded text-xs font-semibold ${DUE_STYLES[state]}`} title={`Process timing: ${s.dayLabel}`}>
                        {s.dayLabel} · {fmtDate(due).replace(/ \d{4}$/, '')}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default LeadProcessPanel;
