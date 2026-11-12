// Online version of "The Surgeon Group Application Form (23 Feb 2026)".
// The public page (src/pages/Apply.tsx) and the CRM viewer
// (src/components/LeadApplicationPanel.tsx) both render from this one
// definition, so a question changed here changes everywhere.
//
// Keep a field's `key` stable once applications have been received:
// answers are stored against the key.

export type FieldType =
  | 'text' | 'email' | 'tel' | 'date' | 'number' | 'currency' | 'textarea'
  | 'radio' | 'checkboxes' | 'yesno'
  | 'grid'      // a small table: fixed rows x columns of inputs
  | 'rank'      // put a list of items in order 1..n
  | 'balance';  // personal balance sheet with automatic totals

export interface GridColumn { key: string; label: string; type?: 'text' | 'tel' | 'date' | 'currency' }

export interface FormField {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  help?: string;
  options?: string[];
  /** Half-width on larger screens. */
  half?: boolean;
  /** grid */
  rows?: number;
  rowLabels?: string[];
  columns?: GridColumn[];
  /** Only show when another yes/no or radio field has this value. */
  showIf?: { key: string; equals: string };
}

export interface FormSection {
  id: string;
  title: string;
  intro?: string;
  fields: FormField[];
}

export const DIVISION_OPTIONS = [
  'The Drain Surgeon (plumbing)',
  'The Electro Surgeon (electrical)',
  'The Aircon Surgeon (air conditioning)',
];

export const APPLICATION_SECTIONS: FormSection[] = [
  {
    id: 'franchise',
    title: 'Your franchise preference',
    intro: 'We are in a position to offer you the following tried and tested franchise options. Completing this confidential questionnaire does not commit you or The Surgeon Group in any way; see the declaration at the end.',
    fields: [
      { key: 'divisions', label: 'I am specifically interested in', type: 'checkboxes', options: DIVISION_OPTIONS, required: true },
      { key: 'preferred_area', label: 'Area or region you are interested in', type: 'text' },
    ],
  },
  {
    id: 'personal',
    title: 'Personal information',
    fields: [
      { key: 'first_names', label: 'First name(s)', type: 'text', required: true, half: true },
      { key: 'surname', label: 'Surname', type: 'text', required: true, half: true },
      { key: 'id_number', label: 'ID number', type: 'text', half: true },
      { key: 'date_of_birth', label: 'Date of birth', type: 'date', half: true },
      { key: 'nationality', label: 'Nationality', type: 'text', half: true },
      { key: 'sex', label: 'Sex', type: 'radio', options: ['Male', 'Female'], half: true },
      { key: 'address', label: 'Present address', type: 'textarea' },
      { key: 'postal_code', label: 'Postal code', type: 'text', half: true },
      { key: 'email', label: 'Email', type: 'email', required: true, half: true },
      { key: 'cell', label: 'Cell number', type: 'tel', required: true, half: true },
      { key: 'home_tel', label: 'Home telephone', type: 'tel', half: true },
      { key: 'residence', label: 'Residence', type: 'radio', options: ['Owned', 'Rented'], half: true },
      { key: 'marital_status', label: 'Marital status', type: 'radio', options: ['Married', 'Single', 'Divorced', 'Separated', 'Widowed'], half: true },
      { key: 'children', label: 'Number of children', type: 'number', half: true },
      { key: 'other_dependants', label: 'Other dependants', type: 'text', half: true },
      { key: 'related_employee', label: 'If you are related to anyone employed by The Surgeon Group, give their name and branch', type: 'text' },
    ],
  },
  {
    id: 'references',
    title: 'References and family',
    fields: [
      {
        key: 'references', label: 'Three references (unrelated people you have known for at least a year)', type: 'grid', rows: 3,
        columns: [{ key: 'name', label: 'Name' }, { key: 'tel', label: 'Telephone', type: 'tel' }],
      },
      { key: 'may_contact_references', label: 'For reference purposes, may we phone them?', type: 'yesno' },
      { key: 'references_reason', label: 'Please give a reason why not', type: 'textarea', showIf: { key: 'may_contact_references', equals: 'No' } },
      { key: 'spouse_works', label: 'If married, does your spouse work?', type: 'yesno' },
      { key: 'spouse_employer', label: "Spouse's company and position held", type: 'text', showIf: { key: 'spouse_works', equals: 'Yes' } },
      { key: 'spouse_income', label: "Spouse's annual income", type: 'currency', showIf: { key: 'spouse_works', equals: 'Yes' }, half: true },
      { key: 'spouse_join', label: 'Would your spouse join you in the business?', type: 'text' },
    ],
  },
  {
    id: 'education',
    title: 'Education and employment',
    fields: [
      { key: 'education_level', label: 'Highest level of education obtained', type: 'text' },
      { key: 'education_institution', label: 'Institution', type: 'text', half: true },
      { key: 'education_date', label: 'Date obtained', type: 'text', half: true },
      {
        key: 'employers', label: 'Former employers (two, most recent first)', type: 'grid', rows: 2,
        columns: [
          { key: 'from', label: 'From', type: 'date' },
          { key: 'to', label: 'To', type: 'date' },
          { key: 'employer', label: 'Employer name and address' },
          { key: 'salary', label: 'Salary received', type: 'currency' },
          { key: 'position', label: 'Position held' },
          { key: 'reason', label: 'Reason for leaving' },
        ],
      },
    ],
  },
  {
    id: 'about1',
    title: 'About you',
    intro: 'For an individual and a company to grow together, they need common goals and beliefs. These questions help us see whether your needs run parallel to ours. For your own benefit, please be frank: you cannot build a successful business on imaginary foundations.',
    fields: [
      { key: 'life_priorities', label: 'Put these in order of importance to you (1 = most important)', type: 'rank', options: ['Social life', 'Mental life', 'Physical life', 'Spiritual life', 'Financial life'] },
      { key: 'q1_present_duties', label: '1. Briefly outline your present business duties', type: 'textarea' },
      { key: 'q2_ideal_job', label: '2. If you could have any job or position you wanted, what would you really want to do?', type: 'textarea' },
      { key: 'q3_qualities', label: '3. What qualities do you have that would be valuable if you became part of The Surgeon Group?', type: 'textarea' },
      {
        key: 'q4_hours', label: '4. How much time out of every 24 hours do you devote to:', type: 'grid',
        rowLabels: ['Your occupation', 'Sleeping', 'Play and relaxation', 'Acquiring useful knowledge', 'Waste', 'Self-improvement', 'Family', 'Other (explain)'],
        columns: [{ key: 'hours', label: 'Hours' }],
      },
      { key: 'q5_accomplishment', label: '5. What do you think has been your greatest accomplishment in life to date?', type: 'textarea' },
      { key: 'q6_disappointment', label: '6. What has been your greatest disappointment?', type: 'textarea' },
      { key: 'q7_visualise', label: '7. How do you visualise your Surgeon Group franchise?', type: 'textarea' },
      { key: 'q8_spouse_feel', label: '8. How does your spouse feel about your interest in becoming a Surgeon Group franchisee?', type: 'textarea' },
      { key: 'q9_live_again', label: '9. If you could live life again, what changes would you make?', type: 'textarea' },
      { key: 'q10_success_failure', label: '10. What do you think makes the difference between success and failure in any business?', type: 'textarea' },
      { key: 'q11_improve', label: '11. What have you done in the past year to improve yourself?', type: 'textarea' },
    ],
  },
  {
    id: 'about2',
    title: 'About you (continued)',
    fields: [
      {
        key: 'q12_expected_earnings', label: '12. How much would you expect to earn as a Surgeon Group franchisee in your:', type: 'grid',
        rowLabels: ['First year', 'Second year', 'Third year'],
        columns: [{ key: 'amount', label: 'Amount', type: 'currency' }],
      },
      { key: 'q13_strengths', label: '13. What do you consider your greatest strengths?', type: 'textarea' },
      { key: 'q14_weaknesses', label: '14. What are your biggest weaknesses?', type: 'textarea' },
      { key: 'q15_service', label: '15. Which of our services interests you most, and why?', type: 'textarea' },
      { key: 'q16_criticised', label: '16. What do people most often criticise you for?', type: 'textarea' },
      { key: 'q17_dislike', label: '17. What qualities do you most dislike in other people?', type: 'textarea' },
      { key: 'q18_development', label: '18. What factors in the past have contributed most to your own development?', type: 'textarea' },
      { key: 'q19_prevented', label: '19. What factors have prevented you from moving ahead more quickly?', type: 'textarea' },
      { key: 'q20_know_you', label: '20. What else should The Surgeon Group know about you to understand you better?', type: 'textarea' },
      { key: 'q21_training', label: '21. If accepted, when could training be scheduled?', type: 'text' },
      {
        key: 'q22_acquaintances', label: '22. Who among your acquaintances:', type: 'grid',
        rowLabels: ['Encourages you the most?', 'Cautions you the most?', 'Discourages you the most?'],
        columns: [{ key: 'name', label: 'Name' }],
      },
      { key: 'q23_successful_person', label: '23. Who is the most successful person you have ever met, and why?', type: 'textarea' },
    ],
  },
  {
    id: 'financial',
    title: 'Personal financial information',
    intro: 'Your financial information is confidential and is used only to assess your application. We do not ask for bank account or card numbers on this form.',
    fields: [
      { key: 'has_budget', label: 'Do you have a budget?', type: 'yesno', half: true },
      { key: 'saves_invests', label: 'Do you have an organised method of saving or investing?', type: 'yesno', half: true },
      { key: 'insolvent', label: 'Have you ever been declared insolvent or had a business liquidated?', type: 'yesno' },
      { key: 'rehabilitated_date', label: 'Date rehabilitated', type: 'date', showIf: { key: 'insolvent', equals: 'Yes' }, half: true },
      { key: 'bank_name', label: 'Name of your bank', type: 'text', half: true },
      { key: 'bank_branch', label: 'Branch', type: 'text', half: true },
      {
        key: 'credit_accounts', label: 'Credit accounts and loans', type: 'grid', rows: 3,
        help: 'Store cards, credit cards, personal loans and similar. Institution and outstanding balance only.',
        columns: [{ key: 'institution', label: 'Institution' }, { key: 'balance', label: 'Outstanding balance', type: 'currency' }],
      },
      { key: 'balance_sheet', label: 'Personal balance sheet', type: 'balance' },
      { key: 'credit_check_consent', label: 'I consent to The Surgeon Group running a credit check as part of assessing my application', type: 'checkboxes', options: ['I consent to a credit check'] },
    ],
  },
  {
    id: 'plans',
    title: 'Your plans for your new franchise',
    fields: [
      { key: 'cash_available', label: 'Cash available for investment', type: 'currency', half: true },
      { key: 'min_drawings', label: 'Minimum drawings per month during the first year', type: 'currency', half: true },
      {
        key: 'relocate_areas', label: 'Are you willing to relocate? If so, your preferred area(s)', type: 'grid',
        rowLabels: ['1', '2', '3'], columns: [{ key: 'area', label: 'Area' }],
      },
      { key: 'additional_comments', label: 'Additional comments (optional)', type: 'textarea' },
    ],
  },
];

// Personal balance sheet lines (values in Rand)
export const BALANCE_ASSETS = [
  { key: 'cash', label: 'Cash in bank' },
  { key: 'savings', label: 'Savings' },
  { key: 'loans_granted', label: 'Loans granted to others' },
  { key: 'property', label: 'Property owned' },
  { key: 'shares', label: 'Shares in listed companies' },
  { key: 'vehicles', label: 'Private motor vehicle(s)' },
  { key: 'own_business', label: 'Estimated market value of own business(es)' },
  { key: 'other_assets', label: 'Value of other assets' },
];
export const BALANCE_LIABILITIES = [
  { key: 'bank_loans', label: 'Bank loan(s)' },
  { key: 'bonds', label: 'Bond(s) on property' },
  { key: 'hp_motor', label: 'HP on motor vehicles' },
  { key: 'hp_other', label: 'HP other' },
  { key: 'other_liabilities', label: 'Other liabilities' },
];

export const DECLARATION_TEXT =
  'I have completed this questionnaire to the best of my knowledge and ability, with the intention of being considered as a franchisee of The Surgeon Group. I understand that at this point I am not binding myself in any way whatsoever. I further understand that, should I be accepted as a franchisee based on the information I have provided, and should it become known to The Surgeon Group at a later date that the information provided is false, or that I have withheld important facts, this may cause termination of any agreement entered into between The Surgeon Group and myself.';

export type Answers = Record<string, any>;

export const num = (v: any): number => {
  const n = parseFloat(String(v ?? '').replace(/[^0-9.-]/g, ''));
  return isFinite(n) ? n : 0;
};

export const balanceTotals = (b: Record<string, any> | undefined) => {
  const assets = BALANCE_ASSETS.reduce((s, a) => s + num(b?.[a.key]), 0);
  const liabilities = BALANCE_LIABILITIES.reduce((s, a) => s + num(b?.[a.key]), 0);
  return { assets, liabilities, net: assets - liabilities };
};

export const fmtRand = (n: number) =>
  'R ' + Math.round(n).toLocaleString('en-ZA').replace(/,/g, ' ');

export const isVisible = (f: FormField, a: Answers) =>
  !f.showIf || a[f.showIf.key] === f.showIf.equals;

export const isFilled = (f: FormField, v: any) => {
  if (f.type === 'checkboxes') return Array.isArray(v) && v.length > 0;
  return v !== undefined && v !== null && String(v).trim() !== '';
};

/** Required fields still empty in a section (labels). */
export const missingRequired = (s: FormSection, a: Answers) =>
  s.fields.filter(f => f.required && isVisible(f, a) && !isFilled(f, a[f.key])).map(f => f.label);

// --- Welcome page content (from surgeongroup.co.za, Nov 2026) --------------

export const WELCOME = {
  heading: 'Thank you for your interest in this franchise opportunity',
  intro: [
    'In 1979 Glenn Pratt started a plumbing business with one vehicle and his tools. Today The Surgeon Group is one of the largest and most trusted home services franchise networks in South Africa, and we are now franchising in more than 50 areas.',
    'Below is a short overview of the opportunity. When you are ready, start the confidential application questionnaire. You can save your answers and come back to finish them at any time.',
  ],
  divisions: [
    { name: 'The Drain Surgeon', text: 'Plumbing, blocked drains, leak detection and geysers. Our flagship brand.' },
    { name: 'The Electro Surgeon', text: 'Electrical services for homes and businesses.' },
    { name: 'The Aircon Surgeon', text: 'Air conditioning installation, servicing and climate control.' },
  ],
  coming: 'Coming soon: Solar, Pest Control, Appliance, Pool, Tree Felling, Cleaning, Handyman and Roofing Surgeon.',
  support: [
    { title: 'A trusted brand', text: 'Over four decades of reputation, with a 24/7/365 emergency service few competitors offer.' },
    { title: 'Customer leads', text: 'A consistent flow of work from our national marketing and call centre.' },
    { title: 'Proven systems', text: 'Job management and administration software, and the processes that go with it.' },
    { title: 'Training in Pretoria', text: 'Head-office training, including specialised equipment, is included in the franchise fee.' },
    { title: 'Support after launch', text: 'Ongoing head-office support once you are trading.' },
    { title: 'Room to grow', text: 'Scalable income built on recurring work, with room to add teams and vehicles.' },
  ],
  investment: [
    { item: 'Franchise fee (includes training)', low: 50000, high: 75000 },
    { item: 'Vehicle (rubberising, canopy, roof rack, branding)', low: 15000, high: 200000 },
    { item: 'Vehicle stock', low: 12000, high: 12000 },
    { item: 'Tools and equipment', low: 25000, high: 25000 },
    { item: 'Stationery, uniform and printing', low: 7000, high: 7000 },
    { item: 'Marketing, signage and branding', low: 11000, high: 11000 },
  ],
  vatRate: 0.15,
  workingCapital: 50000,
  investmentNote: 'Estimates only. Your cost depends on the tools and vehicle you already own, your location, and how many teams and vehicles you start with.',
  ongoing: [
    { label: 'Royalty', value: '7 to 10% of turnover, paid monthly' },
    { label: 'National marketing levy', value: '3 to 5% of turnover' },
    { label: 'Agreement term', value: '5 years, renewable' },
  ],
  steps: ['Choose a division', 'Make an enquiry', 'Speak with the franchisor', 'Submit your application', 'Complete training in Pretoria', 'Launch with head-office support'],
  currentStep: 3,
  contact: { phone: '0861 758 623', email: 'info@surgeongroup.co.za', address: '350 Jan Shoba Street, Hatfield, Pretoria' },
  privacy: 'Your answers are confidential. They are used only to assess your application and are not shared outside The Surgeon Group.',
};
