// Default master onboarding checklist
export interface TaskAttachment {
  id: string;
  name: string;
  url: string;
  filePath: string;
  size: string;
  fileType: string;
  uploadedAt: string;
  uploadedBy: string;
}

export interface ChecklistSubtask {
  id: string;
  text: string;
  responsible: 'franchisor' | 'franchisee' | 'both';
}

export interface ChecklistTask {
  id: string;
  text: string;
  responsible: 'franchisor' | 'franchisee' | 'both';
  attachments?: TaskAttachment[];
  subtasks?: ChecklistSubtask[];
}

export interface ChecklistSection {
  id: string;
  title: string;
  tasks: ChecklistTask[];
}

let _id = 0;
const nid = () => `${Date.now()}_${++_id}`;

const mk = (text: string, responsible: ChecklistTask['responsible'] = 'both'): ChecklistTask => ({
  id: nid(),
  text,
  responsible,
  attachments: [],
  subtasks: [],
});

export const DEFAULT_CHECKLIST: ChecklistSection[] = [
  {
    id: nid(),
    title: 'Section 1: Franchisee Selection & Contracting',
    tasks: [
      mk('Franchisee application received', 'franchisor'),
      mk('Financial capacity verified (Working Capital needed)', 'franchisor'),
      mk('Background/reference checks completed', 'franchisor'),
      mk('Territory demand analysis completed', 'franchisor'),
      mk('Territory boundaries defined', 'franchisor'),
      mk('Franchisee approved internally', 'franchisor'),
      mk('NDA signed', 'both'),
      mk('Franchise Agreement signed', 'both'),
      mk('Initial franchise fee received', 'franchisor'),
      mk('Launch date agreed', 'both'),
      mk('Training dates determined', 'both'),
    ],
  },
  {
    id: nid(),
    title: 'Section 2: Franchisor Readiness (Once-off / Annual Review)',
    tasks: [
      mk('Franchise Agreement CPA-compliant / Updated', 'franchisor'),
      mk('Franchise Disclosure Document prepared (14-day rule)', 'franchisor'),
      mk('Operations Manual updated & division specific', 'franchisor'),
      mk('Brand trademarks registered', 'franchisor'),
      mk('Pricing model standardised', 'franchisor'),
      mk('National supplier agreements in place', 'franchisor'),
      mk('Approved tools & equipment list', 'franchisor'),
      mk('Approved vehicle & signage standards', 'franchisor'),
      mk('Job management system ready', 'franchisor'),
      mk('Central call-handling or lead-routing rules documented', 'franchisor'),
      mk('Brand marketing assets prepared', 'franchisor'),
      mk('Warranty & workmanship guarantee policy defined', 'franchisor'),
    ],
  },
  {
    id: nid(),
    title: 'Section 3: Legal, Business & Tax Setup',
    tasks: [
      mk('Business registered (Pty / Sole Prop)', 'franchisee'),
      mk('CIPC documents received', 'franchisee'),
      mk('SARS registration completed', 'franchisee'),
      mk('VAT registered (if applicable)', 'franchisee'),
      mk('UIF registration completed', 'franchisee'),
      mk('WCC registration completed', 'franchisee'),
      mk('Business bank account opened', 'franchisee'),
      mk('Accounting system set up', 'franchisee'),
      mk('Public liability insurance active', 'franchisee'),
      mk('Vehicle insurance active', 'franchisee'),
      mk('Tools & equipment insurance active', 'franchisee'),
      mk('Telephone line / Cell Phone', 'franchisee'),
      mk('Order Tools, Equipment, Specialised Equipment (leak detection / camera / high pressure jetting)', 'franchisee'),
      mk('Website landing page', 'franchisee'),
      mk('Google business profile', 'franchisee'),
      mk('Email addresses', 'franchisee'),
      mk('Purchase Vehicle / canopy / roof rack / shelving', 'franchisee'),
      mk('Send photographs of vehicle for signage (3 photos)', 'franchisee'),
      mk('Advertise for staff', 'franchisee'),
      mk('Order Fridge Magnets', 'franchisee'),
      mk('Check on essential services (Elec & Water)', 'franchisee'),
      mk('Computers / Printers / Programs', 'franchisee'),
      mk('Interview Staff', 'franchisee'),
      mk('Security checks on customers', 'franchisee'),
      mk('Order staff uniforms from Head Office', 'franchisee'),
      mk('Plan marketing program', 'both'),
      mk('Training with Servcraft', 'both'),
      mk('Setup Servcraft', 'franchisee'),
      mk('Setup Xero / Sage', 'franchisee'),
      mk('Prepare Google Adwords campaign', 'both'),
      mk('Set prices for services & products', 'both'),
      mk('Order job / invoice / quote / order books', 'franchisee'),
      mk('Identify key contact people at Head Office for training and ongoing support', 'franchisor'),
      mk('Add Franchisee to all Franchisor communications (WhatsApps & Emails)', 'franchisor'),
      mk('Give Call Centre all franchisee details / emergency contacts', 'franchisor'),
      mk('Area clearly marked', 'franchisor'),
      mk('Yoco machines', 'franchisee'),
    ],
  },
  {
    id: nid(),
    title: 'Section 5: Vehicle, Tools & Branding',
    tasks: [
      mk('Vehicle sourced (brand-approved)', 'franchisee'),
      mk('Vehicle signwriting applied', 'franchisee'),
      mk('Tracker installed (if required)', 'franchisee'),
      mk('Fuel card issued', 'franchisor'),
      mk('Tool inventory purchased', 'franchisee'),
      mk('Drain equipment supplied (if applicable)', 'franchisee'),
      mk('Leak detection equipment supplied (if applicable)', 'franchisee'),
      mk('Uniforms ordered', 'franchisee'),
      mk('PPE issued', 'franchisee'),
      mk('ID & access cards issued', 'franchisor'),
      mk('Office Signage', 'franchisee'),
    ],
  },
  {
    id: nid(),
    title: 'Section 6: Systems & Technology',
    tasks: [
      mk('CRM account created', 'franchisor'),
      mk('Job management system live', 'franchisor'),
      mk('Quoting system configured', 'both'),
      mk('Invoicing system configured', 'both'),
      mk('Payment methods enabled (card / EFT)', 'franchisee'),
      mk('Call routing tested', 'franchisor'),
      mk('Lead allocation rules tested', 'franchisor'),
      mk('Customer review platform set up', 'franchisee'),
      mk('Email & phone accounts active', 'franchisee'),
      mk('Open supplier accounts (COD or Accounts)', 'franchisee'),
      mk('Plumblink Discounts', 'franchisor'),
    ],
  },
  {
    id: nid(),
    title: 'Section 7: Training (Franchisee & Staff)',
    tasks: [
      mk('Business operations training', 'both'),
      mk('Pricing & margins training', 'both'),
      mk('Job costing training', 'both'),
      mk('Staff management training', 'both'),
      mk('Customer experience standards training', 'both'),
      mk('Sales & upselling training', 'both'),
      mk('Maintenance contracts training', 'both'),
      mk('SOP training completed', 'both'),
      mk('Quality control standards trained', 'both'),
      mk('Reporting & documentation trained', 'both'),
      mk('COC process trained', 'both'),
      mk('Warranty & call back handling trained', 'both'),
    ],
  },
  {
    id: nid(),
    title: 'Section 8: Local Area Marketing Setup',
    tasks: [
      mk('Google Business Profile created', 'franchisee'),
      mk('Local service areas added', 'franchisee'),
      mk('Reviews strategy implemented', 'both'),
      mk('Local landing pages live', 'both'),
      mk('Branded flyers printed', 'franchisee'),
      mk('Vehicle visibility in territory confirmed', 'franchisor'),
      mk('Launch promotion approved', 'franchisor'),
      mk('Marketing budget confirmed', 'both'),
      mk('National list of customers shared', 'franchisor'),
    ],
  },
];

export interface DefaultUser {
  id: string;
  email: string;
  password: string;
  name: string;
  role: 'admin' | 'sales' | 'franchisee';
  franchiseeId?: string;
}

export const DEFAULT_USERS: DefaultUser[] = [
  { id: 'u_admin', email: 'admin@surgeongroup.co.za', password: 'admin123', name: 'Head Office Admin', role: 'admin' },
  { id: 'u_sales', email: 'sales@surgeongroup.co.za', password: 'sales123', name: 'Sarah Sales', role: 'sales' },
  { id: 'u_sales2', email: 'david.sales@surgeongroup.co.za', password: 'sales123', name: 'David Naidoo', role: 'sales' },
  { id: 'u_f1', email: 'john@franchisee.co.za', password: 'franchisee123', name: 'John Smith', role: 'franchisee', franchiseeId: 'f_1' },
];


export const DEFAULT_FRANCHISEES = [
  {
    id: 'f_1',
    name: 'John Smith',
    email: 'john@franchisee.co.za',
    phone: '+27 82 555 1234',
    territory: 'Sandton',
    startDate: '2026-01-15',
    status: 'active',
  },
];

export const DEFAULT_LEADS = [
  {
    id: 'l_1',
    contactName: 'Michael Pretorius',
    email: 'michael.p@gmail.com',
    phone: '+27 83 444 9876',
    area: 'Pretoria East',
    status: 'new',
    createdAt: new Date().toISOString(),
    assignedTo: 'u_sales',
    interactions: [
      { id: 'i_1', date: new Date().toISOString(), note: 'Initial enquiry via website. Interested in plumbing franchise.', author: 'Sarah Sales' },
    ],
  },
  {
    id: 'l_2',
    contactName: 'Lerato Mokoena',
    email: 'lerato@example.com',
    phone: '+27 71 222 3344',
    area: 'Durban North',
    status: 'qualified',
    createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
    assignedTo: 'u_sales',
    interactions: [
      { id: 'i_2', date: new Date(Date.now() - 86400000 * 5).toISOString(), note: 'Called back, has R500k working capital available.', author: 'Sarah Sales' },
      { id: 'i_3', date: new Date(Date.now() - 86400000 * 2).toISOString(), note: 'Sent FDD document. Awaiting feedback.', author: 'Sarah Sales' },
    ],
  },
];

export const DEFAULT_DOCUMENTS = [
  { id: 'd_1', name: 'Franchise Agreement Template.pdf', category: 'Legal', size: '2.4 MB', uploadedAt: new Date().toISOString(), uploadedBy: 'Head Office Admin', url: '#' },
  { id: 'd_2', name: 'Operations Manual v3.2.pdf', category: 'Operations', size: '8.1 MB', uploadedAt: new Date().toISOString(), uploadedBy: 'Head Office Admin', url: '#' },
  { id: 'd_3', name: 'Brand Guidelines.pdf', category: 'Marketing', size: '5.6 MB', uploadedAt: new Date().toISOString(), uploadedBy: 'Head Office Admin', url: '#' },
  { id: 'd_4', name: 'Approved Suppliers List.xlsx', category: 'Operations', size: '124 KB', uploadedAt: new Date().toISOString(), uploadedBy: 'Head Office Admin', url: '#' },
  { id: 'd_5', name: 'Vehicle Signage Specs.pdf', category: 'Branding', size: '3.2 MB', uploadedAt: new Date().toISOString(), uploadedBy: 'Head Office Admin', url: '#' },
];

export const LOGO_URL = 'https://d64gsuwffb70l.cloudfront.net/6857a1ed7aef11479f566788_1779446355448_8ee33d3f.jpg';
