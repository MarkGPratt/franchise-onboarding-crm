import React, { useMemo, useState } from 'react';
import { Lead, useData } from '@/contexts/DataContext';
import { useAuth } from '@/contexts/AuthContext';
import { ChevronDown, ChevronRight } from 'lucide-react';
import {
  PROCESS_STEPS, PROCESS_STAGES, ProcessStep, StepCompletion, stepDue, dueState, DueState,
  DUE_STYLES, fmtDate, isActiveStatus, todayYmd, daysBetween,
} from '@/lib/leadProcess';

interface TodoItem {
  lead: Lead;
  step: ProcessStep;
  due: string;
  state: DueState;
}

const GROUPS: { key: DueState; title: string; startOpen: boolean }[] = [
  { key: 'overdue', title: 'Overdue', startOpen: true },
  { key: 'today', title: 'Due today', startOpen: true },
  { key: 'soon', title: 'Next 7 days', startOpen: true },
  { key: 'later', title: 'Later', startOpen: false },
];

/** All open Lead Management Process steps across active leads. */
const LeadTodoView: React.FC<{ leads: Lead[]; onOpenLead: (l: Lead) => void }> = ({ leads, onOpenLead }) => {
  const { updateLead } = useData();
  const { user, users } = useAuth();
  const salesUsers = users.filter(u => u.role === 'sales' || u.role === 'admin');
  const [rep, setRep] = useState<string>(user?.role === 'sales' ? user.id : 'all');
  const [nextOnly, setNextOnly] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>(
    Object.fromEntries(GROUPS.map(g => [g.key, g.startOpen])),
  );

  const today = todayYmd();
  const userName = (id: string) => users.find(u => u.id === id)?.name || 'Unassigned';

  const active = leads.filter(l =>
    l.processStartDate && isActiveStatus(l.status) && (rep === 'all' || (l.assignedTo || '') === rep));
  const notStarted = leads.filter(l =>
    !l.processStartDate && isActiveStatus(l.status) && (rep === 'all' || (l.assignedTo || '') === rep));

  const items: TodoItem[] = useMemo(() => {
    const out: TodoItem[] = [];
    for (const lead of active) {
      const steps = lead.processSteps || {};
      const open = PROCESS_STEPS.filter(s => !steps[s.id]);
      for (const step of nextOnly ? open.slice(0, 1) : open) {
        const due = stepDue(lead.processStartDate!, step);
        out.push({ lead, step, due, state: dueState(due, false, today) });
      }
    }
    return out.sort((a, b) => a.due.localeCompare(b.due) || a.lead.contactName.localeCompare(b.lead.contactName) || a.step.day - b.step.day);
  }, [active, nextOnly, today]);

  const tick = (it: TodoItem) => {
    const next: Record<string, StepCompletion> = {
      ...(it.lead.processSteps || {}),
      [it.step.id]: { at: new Date().toISOString(), by: user?.name || 'Unknown' },
    };
    updateLead(it.lead.id, { processSteps: next });
  };

  const counts = Object.fromEntries(GROUPS.map(g => [g.key, items.filter(i => i.state === g.key).length]));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {GROUPS.map(g => (
          <div key={g.key} className={`rounded-xl p-4 border border-gray-200 ${DUE_STYLES[g.key]}`}>
            <div className="text-xs font-semibold uppercase tracking-wide">{g.title}</div>
            <div className="text-2xl font-bold">{counts[g.key]}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm font-semibold text-gray-700">Sales rep:</label>
        <select value={rep} onChange={e => setRep(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#C41E3A] bg-white">
          <option value="all">All reps</option>
          {salesUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          <option value="">Unassigned</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
          <input type="checkbox" checked={nextOnly} onChange={e => setNextOnly(e.target.checked)} className="accent-[#C41E3A]" />
          Only the next step per lead
        </label>
        <span className="text-xs text-gray-500 ml-auto">
          {active.length} lead{active.length === 1 ? '' : 's'} in process · ticking a step here marks it done on the lead
        </span>
      </div>

      {GROUPS.map(g => {
        const list = items.filter(i => i.state === g.key);
        if (list.length === 0) return null;
        return (
          <div key={g.key} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <button onClick={() => setOpen(o => ({ ...o, [g.key]: !o[g.key] }))}
              className="w-full flex items-center gap-2 px-4 py-3 bg-gray-50 border-b border-gray-200 text-left">
              {open[g.key] ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              <span className="font-bold text-gray-900">{g.title}</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${DUE_STYLES[g.key]}`}>{list.length}</span>
            </button>
            {open[g.key] && (
              <ul className="divide-y divide-gray-100">
                {list.map(it => {
                  const late = daysBetween(it.due, today);
                  return (
                    <li key={`${it.lead.id}_${it.step.id}`} className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50">
                      <input type="checkbox" checked={false} onChange={() => tick(it)}
                        className="mt-1 h-4 w-4 accent-[#C41E3A] cursor-pointer" title="Mark done" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-gray-900">{it.step.label}</div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          <button onClick={() => onOpenLead(it.lead)} className="font-semibold text-[#C41E3A] hover:underline">
                            {it.lead.contactName}
                          </button>
                          {' · '}{it.lead.area || 'No area'}
                          {' · '}Stage {it.step.stage}: {PROCESS_STAGES.find(s => s.n === it.step.stage)?.title}
                          {' · '}{userName(it.lead.assignedTo)}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${DUE_STYLES[it.state]}`}>
                          {it.step.dayLabel} · {fmtDate(it.due, true).replace(/ \d{4}$/, '')}
                        </span>
                        {it.state === 'overdue' && (
                          <div className="text-[11px] text-red-600 mt-1">{late} day{late === 1 ? '' : 's'} late</div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}

      {items.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-500">
          Nothing outstanding. Every lead in the process is up to date.
        </div>
      )}

      {notStarted.length > 0 && (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-4">
          <div className="text-sm font-bold text-gray-900 mb-1">
            {notStarted.length} active lead{notStarted.length === 1 ? '' : 's'} not on the to-do list yet
          </div>
          <p className="text-xs text-gray-500 mb-2">
            These were captured before the process was added. Open one and set its Day 1 date to bring it in.
          </p>
          <div className="flex flex-wrap gap-2">
            {notStarted.map(l => (
              <button key={l.id} onClick={() => onOpenLead(l)}
                className="px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200">
                {l.contactName}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default LeadTodoView;
