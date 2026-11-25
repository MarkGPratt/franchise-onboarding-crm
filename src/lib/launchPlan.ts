// The franchisee's road to launch: the plan only, without task-level detail.
// Source: Franchisee Onboarding – Gated Timeline (23 Nov 2026), Master Process Flow v2.
// Week 1 = the week the enquiry came in. Week 4 = the portal account is opened.
// Launch (T-0) lands around week 20. The same content is in public/Surgeon-Group-Launch-Plan.pdf.

export interface LaunchStage {
  key: string;
  phase: number | null;     // matches the number at the start of the Process Flow section title
  title: string;
  weeks: [number, number];  // from enquiry
  when: string;             // plain-language timing
  summary: string;
  milestones: string[];
  documents: string[];
  gate: string;             // what has to be true before the next stage opens
  parallel?: boolean;
}

export const LAUNCH_PLAN: LaunchStage[] = [
  {
    key: 'lead', phase: null, title: 'Getting to know each other', weeks: [1, 3], when: 'Weeks 1–3',
    summary: 'You tell us about yourself and the area you want; we tell you about the opportunity.',
    milestones: ['Introductory call', 'Online application', 'Head Office meeting / discovery day'],
    documents: ['Opportunity overview and application form', 'Company Profile', 'Franchise FAQ'],
    gate: 'You are invited into the formal process and your portal account is opened.',
  },
  {
    key: 'p0', phase: 0, title: 'Welcome', weeks: [4, 4], when: 'Week 4',
    summary: 'Who we are, what we promise our customers, and how this process works.',
    milestones: ['Read and acknowledge the welcome material'],
    documents: ['Our Vision', 'Founder Story', 'The 24/7/365 Emergency Promise', 'How the process flow works'],
    gate: 'Welcome material acknowledged.',
  },
  {
    key: 'p1', phase: 1, title: 'Selection & Approval', weeks: [4, 7], when: 'Weeks 4–7',
    summary: 'We confirm that you, your finances and your territory are a good fit.',
    milestones: ['NDA signed', 'Disclosure document received (starts the 14-day period)', 'Financial and background checks', 'Territory mapped'],
    documents: ['NDA', 'Disclosure Document', 'Check consent forms', 'Territory map'],
    gate: 'Approved by Head Office.',
  },
  {
    key: 'p2', phase: 2, title: 'Business Plan, Company & Agreement', weeks: [8, 10], when: 'Weeks 8–10',
    summary: 'We work through the numbers together, agree your launch date and sign the agreement.',
    milestones: ['Financial model walk-through', 'Launch date agreed', 'Company registered', 'Franchise Agreement signed', 'Franchise fee paid into trust'],
    documents: ['Financial model', 'Investment and equipment schedules', 'Franchise Agreement and Division Annexure', 'Services agreement'],
    gate: 'Agreement signed and fee in trust. (Never sooner than 14 days after you received the disclosure document.)',
  },
  {
    key: 'p3', phase: 3, title: "Cooling-off & Principal's Course", weeks: [10, 13], when: 'Weeks 10–13',
    summary: 'The cooling-off period runs out and you complete the Principal’s course.',
    milestones: ['Cooling-off period ends', "Principal's course attended and assessment passed"],
    documents: ['Course joining instructions and material', '“Cleared to proceed” letter'],
    gate: 'Cleared to proceed: you may start spending on your setup.',
  },
  {
    key: 'p4', phase: 4, title: 'Tax, Banking & Insurance', weeks: [13, 14], when: 'Weeks 13–14',
    summary: 'Your business is registered, banked, insured and set up for monthly reporting.',
    milestones: ['SARS, UIF and COIDA registrations', 'Business bank account', 'Accounting system set up', 'Insurance in place'],
    documents: ['Compliance pack checklist', 'Insurance requirements', 'Royalty and marketing fund payment instructions'],
    gate: 'Compliance pack filed with Head Office.',
  },
  {
    key: 'p5', phase: 5, title: 'Vehicle, Tools & Uniform', weeks: [14, 17], when: 'Weeks 14–17', parallel: true,
    summary: 'Your vehicle is bought, branded and equipped.',
    milestones: ['Vehicle fitted out and signwritten', 'Tracking and fuel card', 'Tools, stock and uniforms'],
    documents: ['Vehicle specification', 'Signage artwork', 'Approved tool list', 'Uniform order form', 'Brand pack'],
    gate: 'Vehicle branded, equipped and road-ready.',
  },
  {
    key: 'p6', phase: 6, title: 'Systems & Technology', weeks: [14, 17], when: 'Weeks 14–17', parallel: true,
    summary: 'Phones, email, job management, card machine and accounts all connected.',
    milestones: ['Job management system set up', 'Card machine and accounting linked', 'Calls and leads routed to you'],
    documents: ['Job management setup guide', 'Standard price list'],
    gate: 'A full test job: lead → quote → job → invoice → payment.',
  },
  {
    key: 'p7', phase: 7, title: 'People', weeks: [14, 17], when: 'Weeks 14–17', parallel: true,
    summary: 'You recruit and contract your team.',
    milestones: ['Staffing plan', 'Recruit and vet', 'Trade registrations checked', 'Contracts and payroll'],
    documents: ['Employment contract templates', 'Vetting forms'],
    gate: 'Staff contracted.',
  },
  {
    key: 'p8', phase: 8, title: 'Head Office & Suppliers', weeks: [14, 17], when: 'Weeks 14–17', parallel: true,
    summary: 'You are connected to Head Office, the call centre and our suppliers.',
    milestones: ['Head Office contacts and groups', 'Call centre briefed', 'Supplier accounts and group discounts'],
    documents: ['Head Office contact sheet', 'Supplier list and terms'],
    gate: 'All set up.',
  },
  {
    key: 'p9', phase: 9, title: 'Training', weeks: [16, 18], when: 'Weeks 16–18',
    summary: 'You and your team are trained on how we work.',
    milestones: ['Operations Manual and procedures', 'Technical, systems, pricing and sales training', 'Every staff member inducted'],
    documents: ['Operations Manual', 'Procedures for your division', 'Customer Terms & Conditions'],
    gate: 'Training signed off.',
  },
  {
    key: 'p10', phase: 10, title: 'Local Marketing & Launch', weeks: [16, 20], when: 'Weeks 16–20',
    summary: 'Your area knows you are coming, and we decide together that you are ready to trade.',
    milestones: ['Google Business Profile and local page', 'Launch promotion', 'Prospect list built', 'Go / no-go meeting'],
    documents: ['Local marketing programme', 'Neighbourhood marketing checklist', 'Go / no-go letter'],
    gate: 'Every task done, then go-live.',
  },
  {
    key: 'p11', phase: 11, title: 'First six months', weeks: [20, 46], when: 'Launch to month 6',
    summary: 'We stay close while you find your feet.',
    milestones: ['30, 60 and 90-day health checks', 'Month 1 results against plan', 'Month 6: first annual target'],
    documents: ['Health check forms', 'Daily, weekly and monthly checklists'],
    gate: 'Onboarding closed and first annual target set.',
  },
];

/** Week number (from enquiry) → date, anchored on the date the portal account was opened (week 4). */
export const weekDate = (accountOpened: string, week: number) => {
  const d = new Date(accountOpened + 'T00:00:00');
  d.setDate(d.getDate() + (week - 4) * 7);
  return d;
};

export const shortDate = (d: Date) => d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });

/** Pull the phase number from a Process Flow section title such as "Phase 3 — …" or "3. …". */
export const phaseOfTitle = (title: string): number | null => {
  const m = title.match(/^\s*(?:phase\s*)?(\d{1,2})\b/i);
  return m ? Number(m[1]) : null;
};
