// Lead Management Process — the step-by-step to-do list a sales rep works
// through for every new franchise enquiry. Day numbers count from Day 1, the
// day the enquiry was received (lead.processStartDate). Where the process
// allows a range ("D1 or D2") the due day is the later one.
//
// To change a step, edit this list. Step ids are stored against each lead, so
// keep an id stable once it is in use; to retire a step, delete it here and
// any old ticks against it are simply ignored.

export interface ProcessStage {
  n: number;
  title: string;
}

export interface ProcessStep {
  id: string;
  stage: number;
  label: string;
  detail?: string;
  /** Due day, counted from Day 1 = enquiry received. */
  day: number;
  /** As written in the process, e.g. "D1 or D2". */
  dayLabel: string;
}

export interface StepCompletion {
  at: string;   // ISO timestamp
  by: string;   // user name
}

export const PROCESS_STAGES: ProcessStage[] = [
  { n: 1, title: 'New enquiry' },
  { n: 2, title: 'First follow-up' },
  { n: 3, title: 'Succeeding follow-up' },
  { n: 4, title: 'Zoom call and next steps' },
  { n: 5, title: 'Head Office meeting' },
];

export const PROCESS_STEPS: ProcessStep[] = [
  // 1. New enquiry
  { id: 's1_record', stage: 1, day: 1, dayLabel: 'D1',
    label: 'Populate the New Lead record',
    detail: 'Name, email, phone, division, rep and location (if available).' },
  { id: 's1_whatsapp', stage: 1, day: 1, dayLabel: 'D1',
    label: 'Save contact on cell phone, activate WhatsApp and request a time to call' },
  { id: 's1_outlook', stage: 1, day: 1, dayLabel: 'D1',
    label: 'Update the People record with email address in Outlook' },
  { id: 's1_call', stage: 1, day: 2, dayLabel: 'D1 or D2',
    label: 'Call the new lead',
    detail: 'Timing depends on their WhatsApp response.' },
  { id: 's1_email_docs', stage: 1, day: 2, dayLabel: 'D1 or D2',
    label: 'Email call summary with Prospectus, Application Form and NDA' },
  { id: 's1_first_note', stage: 1, day: 2, dayLabel: 'D1 or D2',
    label: 'Update first note on the lead record' },

  // 2. First follow-up
  { id: 's2_lead_data', stage: 2, day: 5, dayLabel: 'D4 or D5',
    label: 'Update Lead Data, including location' },
  { id: 's2_email', stage: 2, day: 5, dayLabel: 'D4 or D5',
    label: 'Send follow-up email',
    detail: 'Emphasise Application Form and NDA if still outstanding. Attach the Disclosure Document if appropriate. Set next contact date, time and purpose.' },
  { id: 's2_note', stage: 2, day: 5, dayLabel: 'D4 or D5',
    label: 'Update note on the lead record' },

  // 3. Succeeding follow-up
  { id: 's3_app_nda', stage: 3, day: 7, dayLabel: 'D7',
    label: 'Ensure Application Form and NDA are received' },
  { id: 's3_zoom_time', stage: 3, day: 7, dayLabel: 'D7',
    label: 'Request and receive date/time for Zoom meeting (usually WhatsApp)' },
  { id: 's3_zoom_setup', stage: 3, day: 7, dayLabel: 'D7',
    label: 'Set up Zoom to walk through the onboarding process flow and first-year Financial Model' },
  { id: 's3_fin_model', stage: 3, day: 7, dayLabel: 'D7',
    label: 'Email the Financial Model' },

  // 4. Zoom call and next steps
  { id: 's4_zoom', stage: 4, day: 10, dayLabel: 'D9 or D10',
    label: 'Conduct the Zoom call' },
  { id: 's4_ho_time', stage: 4, day: 10, dayLabel: 'D9 or D10',
    label: 'Set a suitable time to meet Head Office execs' },
  { id: 's4_fa_email', stage: 4, day: 10, dayLabel: 'D9 or D10',
    label: 'Email the Franchise Agreement' },
  { id: 's4_confirm_ho', stage: 4, day: 11, dayLabel: 'D11',
    label: 'Confirm H/O meeting date with applicant and H/O; send Application and NDA to H/O' },

  // 5. Head Office meeting
  { id: 's5_fee_details', stage: 5, day: 11, dayLabel: 'D11',
    label: 'Email Franchise Fee invoice details to H/O' },
  { id: 's5_ho_invoice', stage: 5, day: 12, dayLabel: 'D12',
    label: 'H/O sends Franchise Fee invoice to applicant' },
  { id: 's5_fee_paid', stage: 5, day: 13, dayLabel: 'D13',
    label: 'Applicant pays Franchise Fee invoice' },
  { id: 's5_orion', stage: 5, day: 13, dayLabel: 'D13',
    label: 'Send Orion invoice to Mark' },
  { id: 's5_signed', stage: 5, day: 14, dayLabel: 'D14',
    label: 'H/O meeting held and Franchise Agreement signed' },
];

export const PROCESS_DAYS = PROCESS_STEPS[PROCESS_STEPS.length - 1].day;

// ---------- date helpers (all dates are local YYYY-MM-DD strings) ----------

export const todayYmd = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const toYmd = (iso: string): string => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const addDays = (ymd: string, n: number): string => {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
};

export const daysBetween = (fromYmd: string, toYmdStr: string): number => {
  const [y1, m1, d1] = fromYmd.split('-').map(Number);
  const [y2, m2, d2] = toYmdStr.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
};

export const fmtDate = (ymd?: string | null, withWeekday = false): string => {
  if (!ymd) return '—';
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString('en-ZA', {
    ...(withWeekday ? { weekday: 'short' } : {}),
    day: 'numeric', month: 'short', year: 'numeric',
  });
};

/** Due date of a step for a lead whose Day 1 is startYmd. */
export const stepDue = (startYmd: string, step: ProcessStep): string => addDays(startYmd, step.day - 1);

export type DueState = 'done' | 'overdue' | 'today' | 'soon' | 'later';

export const dueState = (dueYmd: string, done: boolean, today = todayYmd()): DueState => {
  if (done) return 'done';
  const diff = daysBetween(today, dueYmd);
  if (diff < 0) return 'overdue';
  if (diff === 0) return 'today';
  if (diff <= 7) return 'soon';
  return 'later';
};

export const DUE_STYLES: Record<DueState, string> = {
  done: 'bg-green-50 text-green-700',
  overdue: 'bg-red-100 text-red-700',
  today: 'bg-amber-100 text-amber-800',
  soon: 'bg-blue-50 text-blue-700',
  later: 'bg-gray-100 text-gray-600',
};

/** The first step not yet ticked, or null if the process is complete. */
export const nextOpenStep = (steps: Record<string, StepCompletion> | undefined): ProcessStep | null =>
  PROCESS_STEPS.find(s => !steps?.[s.id]) || null;

export const processProgress = (steps: Record<string, StepCompletion> | undefined) => {
  const done = PROCESS_STEPS.filter(s => steps?.[s.id]).length;
  return { done, total: PROCESS_STEPS.length, pct: Math.round((done / PROCESS_STEPS.length) * 100) };
};

/** Leads that should appear on the to-do list. */
export const isActiveStatus = (status: string) => status !== 'lost' && status !== 'converted';
