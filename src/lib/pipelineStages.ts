// Pipeline stages for the leads funnel. Each stage (except lost/converted)
// has a set of standard documents an admin attaches once in the
// "Stage Documents" manager, which then get emailed to a prospect when
// their lead reaches that stage.

export type LeadStatus =
  | 'new'
  | 'brand_education'
  | 'financial_qualification'
  | 'formal_application'
  | 'disclosure'
  | 'agreement_review'
  | 'lost'
  | 'converted';

export interface PipelineStage {
  id: LeadStatus;
  label: string;
  description: string;
  /** Suggested documents that should be uploaded for this stage. */
  documents: string[];
  /** Default email intro used when sending the stage email. */
  emailIntro: string;
  color: string;       // badge classes
  sendable: boolean;   // can send a stage email with documents
}

export const PIPELINE_STAGES: PipelineStage[] = [
  {
    id: 'new',
    label: 'New',
    description: 'Qualify the prospect with a discovery call. Share an NDA and overview brochure.',
    documents: ['Non-Disclosure Agreement (NDA)', 'Overview Brochure'],
    emailIntro:
      'Thank you for your interest in joining The Surgeon Group. To get started, please review and sign the attached Non-Disclosure Agreement and read through our overview brochure ahead of our discovery call.',
    color: 'bg-blue-100 text-blue-700',
    sendable: true,
  },
  {
    id: 'brand_education',
    label: 'Brand Education',
    description: 'Present the full opportunity and build excitement. Share your franchise prospectus.',
    documents: ['Franchise Prospectus'],
    emailIntro:
      'We are excited to share the full opportunity with you. Please find our franchise prospectus attached, which covers the brand, our model and the support you can expect as a franchisee.',
    color: 'bg-cyan-100 text-cyan-700',
    sendable: true,
  },
  {
    id: 'financial_qualification',
    label: 'Financial Qualification',
    description: 'Confirm they can afford it. Share investment costs, fees, and projected returns.',
    documents: ['Investment Costs & Fees', 'Projected Returns Summary'],
    emailIntro:
      'To help confirm the financial fit, please review the attached breakdown of investment costs, ongoing fees and projected returns for a Surgeon Group franchise.',
    color: 'bg-amber-100 text-amber-700',
    sendable: true,
  },
  {
    id: 'formal_application',
    label: 'Formal Application',
    description: 'Have them apply, run background/credit checks, and assess fit against your criteria.',
    documents: ['Franchise Application Form', 'Background & Credit Check Consent'],
    emailIntro:
      'We would love for you to formally apply. Please complete the attached application form and consent documents so we can run the necessary background and credit checks and assess fit against our criteria.',
    color: 'bg-orange-100 text-orange-700',
    sendable: true,
  },
  {
    id: 'disclosure',
    label: 'Disclosure',
    description: 'Issue the Franchise Disclosure Document (FDD) and allow the legal review period. Encourage independent legal and financial advice.',
    documents: ['Franchise Disclosure Document (FDD)'],
    emailIntro:
      'Please find attached our Franchise Disclosure Document (FDD). We strongly encourage you to use the legal review period to seek independent legal and financial advice before proceeding.',
    color: 'bg-violet-100 text-violet-700',
    sendable: true,
  },
  {
    id: 'agreement_review',
    label: 'Agreement Review',
    description: 'Share the full Franchise Agreement for their lawyer to review and finalise terms.',
    documents: ['Franchise Agreement'],
    emailIntro:
      'Attached is the full Franchise Agreement. Please have your lawyer review it so we can finalise terms together. We are happy to answer any questions along the way.',
    color: 'bg-indigo-100 text-indigo-700',
    sendable: true,
  },
  {
    id: 'lost',
    label: 'Lost',
    description: 'The prospect did not proceed. A reason is recorded for reporting.',
    documents: [],
    emailIntro: '',
    color: 'bg-gray-200 text-gray-700',
    sendable: false,
  },
  {
    id: 'converted',
    label: 'Converted',
    description: 'The prospect has signed and become a franchisee.',
    documents: [],
    emailIntro: '',
    color: 'bg-green-100 text-green-700',
    sendable: false,
  },
];

export const STAGE_MAP: Record<string, PipelineStage> = PIPELINE_STAGES.reduce((acc, s) => {
  acc[s.id] = s;
  return acc;
}, {} as Record<string, PipelineStage>);

export const SENDABLE_STAGES = PIPELINE_STAGES.filter(s => s.sendable);
