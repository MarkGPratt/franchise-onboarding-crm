import type { ChecklistSection } from './seedData';

/**
 * Process Flow lock (Master Process Flow v2 / gated timeline).
 * A task can be ticked only once the gates of the phases before it are ticked.
 * Phases 5–8 open together behind gate 4.15; Phase 10 also needs 5.17 (vehicle road-ready);
 * 9.16 needs 6.13; 10.14 needs every task in Phases 0–10; 10.15 needs 10.14.
 * The same rules are enforced in the database (supabase/process_flow_lock.sql).
 * Unticking is always allowed.
 */
const BEFORE_SETUP = ['ph_01', 'ph_02', 'ph_cond', 'ph_03'];
export const PHASE_NEEDS: Record<string, string[]> = {
  ph_00: [], ph_01: [],
  ph_02: ['ph_01'],
  ph_cond: ['ph_01', 'ph_02'],
  ph_03: ['ph_01', 'ph_02', 'ph_cond'],
  ph_04: BEFORE_SETUP, ph_05: BEFORE_SETUP, ph_06: BEFORE_SETUP, ph_07: BEFORE_SETUP, ph_08: BEFORE_SETUP,
  ph_09: [...BEFORE_SETUP, 'ph_04'],
  ph_10: ['ph_01', 'ph_02', 'ph_cond', 'ph_03', 'ph_04', 'ph_05', 'ph_06', 'ph_07', 'ph_08', 'ph_09'],
};
const COURSE_PHASES = ['ph_00', 'ph_01', 'ph_02', 'ph_cond', 'ph_03', 'ph_04', 'ph_05', 'ph_06', 'ph_07', 'ph_08', 'ph_09'];

export const isGate = (t: string) => /^\s*\[GATE\]/i.test(t);
export const isCourseComplete = (t: string) => /^\s*\[GATE\]\s*(\[PROOF\]\s*)?Training course complete/i.test(t);
export const isGoNoGo = (t: string) => /^\s*\[GATE\]\s*(\[PROOF\]\s*)?Launch readiness review/i.test(t);
export const isTrainingSignoff = (t: string) => /^\s*\[GATE\].*Technician and staff training signed off/i.test(t);
const short = (t: string) => t.replace(/\[(GATE|PROOF)\]\s*/g, '').split(' — ')[0].trim();

/** Why this task can't be ticked yet, or null if it can. */
export function lockReason(sections: ChecklistSection[], isDone: (id: string) => boolean, taskId: string): string | null {
  let sec: ChecklistSection | undefined; let text = ''; let isSub = false;
  for (const s of sections) {
    for (const t of s.tasks) {
      if (t.id === taskId) { sec = s; text = t.text; }
      else if ((t.subtasks || []).some(st => st.id === taskId)) { sec = s; text = t.text; isSub = true; }
    }
    if (sec) break;
  }
  if (!sec) return null;
  const needs = [...(PHASE_NEEDS[sec.id] || [])];
  if (!isSub && isTrainingSignoff(text)) needs.push('ph_05');
  const missing: string[] = [];
  for (const s of sections) {
    if (!needs.includes(s.id)) continue;
    for (const t of s.tasks) if (isGate(t.text) && !isDone(t.id)) missing.push(short(t.text));
  }
  if (missing.length) return `Locked until: ${missing.slice(0, 2).join('; ')}${missing.length > 2 ? ` (+${missing.length - 2} more)` : ''}`;
  if (!isSub && isCourseComplete(text)) {
    let open = 0;
    for (const s of sections) {
      if (!COURSE_PHASES.includes(s.id)) continue;
      for (const t of s.tasks) if (t.id !== taskId && !isGoNoGo(t.text) && !isDone(t.id)) open++;
    }
    if (open) return `Locked until every task in Phases 0–10 is ticked (${open} still open)`;
  }
  if (!isSub && isGoNoGo(text)) {
    const cc = sections.flatMap(s => s.tasks).find(t => isCourseComplete(t.text));
    if (cc && !isDone(cc.id)) return 'Locked until: Training course complete (10.14)';
  }
  return null;
}

/** Phase-level lock, for the phase header. */
export function phaseLock(sections: ChecklistSection[], isDone: (id: string) => boolean, sectionId: string): string | null {
  const needs = PHASE_NEEDS[sectionId] || [];
  const missing = sections.filter(s => needs.includes(s.id)).flatMap(s => s.tasks).filter(t => isGate(t.text) && !isDone(t.id));
  return missing.length ? `Opens when ${short(missing[0].text)}${missing.length > 1 ? ` (+${missing.length - 1} more gate${missing.length > 2 ? 's' : ''})` : ''} is ticked` : null;
}
