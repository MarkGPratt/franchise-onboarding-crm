// ============================================================================
// Marketing Programme — the playbook, set-up checklist, targets and scoring
// used by the franchisee Marketing Programme section and the Head Office
// Marketing Performance view.
//
// Edit this file to change the playbook. Keep the `key` values stable once
// franchisees have logged activities against them.
// ============================================================================

export type ChannelGroup =
  | 'online' | 'paid' | 'reviews' | 'whatsapp' | 'commercial' | 'street' | 'repeat' | 'content' | 'community';

export const CHANNEL_GROUPS: { key: ChannelGroup; label: string }[] = [
  { key: 'online', label: 'Be found online' },
  { key: 'reviews', label: 'Reviews & reputation' },
  { key: 'paid', label: 'Paid digital' },
  { key: 'whatsapp', label: 'WhatsApp & community groups' },
  { key: 'commercial', label: 'Commercial & referral partners' },
  { key: 'street', label: 'On the job & in the street' },
  { key: 'repeat', label: 'Repeat & referral business' },
  { key: 'content', label: 'Content' },
  { key: 'community', label: 'Community' },
];

export interface Channel {
  key: string;
  label: string;
  group: ChannelGroup;
  why: string;
  how: string[];
  measure: string;
  cadence: string;
}

/** The channels that work for home-services trades in South Africa today. */
export const CHANNELS: Channel[] = [
  {
    key: 'gbp', group: 'online', label: 'Google Business Profile',
    why: 'Most people with a burst geyser, a tripped DB board or a dead aircon search "near me" and call straight from the Google map results. It is free and it is where most of your emergency calls will come from.',
    how: [
      'Profile verified for your territory, with the right category for each division and 24/7 hours showing',
      'At least 10 real job photos to start, then new photos every week (van, team, before/after)',
      'One post a week: a job you did, a seasonal offer, or a tip',
      'Answer every question on the profile, and list the suburbs you serve',
    ],
    measure: 'Calls, website clicks and direction requests in the profile Performance tab; posts per month',
    cadence: 'Weekly',
  },
  {
    key: 'landing_page', group: 'online', label: 'Territory page on the Surgeon website',
    why: 'Google and the AI search tools need a page that says exactly which suburbs you cover and what you do there. Head Office builds it; you keep it fed.',
    how: [
      'Send Head Office your suburb list, team photo and 3 job photos for the page',
      'Every month send 2 new job photos and any written testimonial',
      'Check the phone number and WhatsApp link on the page ring through to you',
    ],
    measure: 'Calls and forms from the territory page (Head Office reports)',
    cadence: 'Monthly',
  },
  {
    key: 'directories', group: 'online', label: 'Hellopeter, Facebook page & Bing listing',
    why: 'People check Hellopeter and Facebook before they let a tradesman into the house. Same name, number and address everywhere also helps your Google ranking.',
    how: [
      'Claim the Hellopeter business page and reply to every review there',
      'Facebook business page for the territory, using Head Office branding',
      'Listing on Bing Places',
      'Exactly the same business name, phone number and suburbs on every listing',
    ],
    measure: 'Listings complete; Hellopeter rating',
    cadence: 'Set up once, check quarterly',
  },
  {
    key: 'reviews', group: 'reviews', label: 'Review on every job',
    why: 'Reviews are the deciding factor between you and the next plumber on the map. A steady flow of recent reviews moves you up the Google results, which brings more calls.',
    how: [
      'Ask for a review on every completed job, before leaving site, while the customer is happy',
      'Send the Google review link on WhatsApp the same day, or use the NFC tap card',
      'Reply to every review within 48 hours (good and bad) using the Head Office reply guide',
      'Never offer payment or discounts for reviews',
    ],
    measure: 'Review requests sent vs jobs done; new reviews; average rating',
    cadence: 'Every job',
  },
  {
    key: 'google_ads', group: 'paid', label: 'Google Ads (search)',
    why: 'Puts you at the top of Google for urgent searches like "blocked drain Midrand" or "aircon repair near me". It is the most direct paid lead source and the one most often cut too early.',
    how: [
      'Campaign built and managed by Head Office for your territory and agreed budget',
      'Calls tracked so we know cost per lead and cost per job',
      'Never switch it off in a quiet month — raise it in your season (geysers in winter, aircon in summer)',
      'Answer every call: a missed call from an ad is money thrown away',
    ],
    measure: 'Spend, calls, cost per lead and cost per job (Head Office report)',
    cadence: 'Always on, reviewed monthly',
  },
  {
    key: 'meta_ads', group: 'paid', label: 'Facebook & Instagram ads',
    why: 'Good for planned work rather than emergencies: aircon services before summer, geyser checks before winter, DB board and surge protection, water tanks during outages.',
    how: [
      'Target only the suburbs in your territory',
      'Use one clear seasonal offer per campaign, with a rand-value saving',
      'Send responses straight to your WhatsApp Business number',
      'Start small (R1,500–R3,000 a month) and keep what produces jobs',
    ],
    measure: 'Spend, WhatsApp chats / leads, jobs booked',
    cadence: 'Seasonal campaigns',
  },
  {
    key: 'whatsapp_business', group: 'whatsapp', label: 'WhatsApp Business',
    why: 'South African customers would rather WhatsApp than email. A professional WhatsApp Business account books jobs faster and keeps customers coming back.',
    how: [
      'Business profile with logo, hours, suburbs and a catalogue of services',
      'Greeting and after-hours messages that confirm the 24/7 emergency service',
      'Labels for new lead / quoted / booked / paid, and quick replies for common questions',
      'Status updates with job photos; broadcasts only to customers who agreed (POPIA)',
    ],
    measure: 'Chats per week, quotes sent, jobs booked from WhatsApp',
    cadence: 'Daily',
  },
  {
    key: 'community_groups', group: 'whatsapp', label: 'Estate, complex & neighbourhood groups',
    why: 'Neighbourhood WhatsApp groups, CPF / neighbourhood watch groups and suburb Facebook groups are where people ask "Does anyone know a good plumber?". Being the name everyone recommends is worth more than any advert.',
    how: [
      'Join the groups in your territory and get the admin\'s permission before promoting anything',
      'Offer a members-only special (rand off) through the estate manager or admin',
      'Answer "anyone know a…" requests quickly, and ask happy customers to tag you',
      'Never spam: one useful post beats ten adverts',
    ],
    measure: 'Groups joined; leads that came from a group',
    cadence: 'Weekly',
  },
  {
    key: 'estate_agents', group: 'commercial', label: 'Estate agents & conveyancers',
    why: 'Every property transfer needs an electrical Certificate of Compliance, Cape Town transfers need a plumbing certificate, and many sales need snag repairs fixed fast. Agents need a contractor they can trust to turn it around.',
    how: [
      'List the agencies and conveyancers in your territory',
      'Meet the principal, offer fast COC turnaround with a report the agent can send on',
      'Leave the info pack and stay in touch monthly',
      'One good agent can send you several jobs a month',
    ],
    measure: 'Agents met; COC / transfer jobs from agents',
    cadence: 'Weekly prospecting',
  },
  {
    key: 'body_corporates', group: 'commercial', label: 'Managing agents, body corporates & HOAs',
    why: 'Sectional title schemes and estates need a reliable contractor on call and planned maintenance. One contract brings repeat work for years.',
    how: [
      'Target managing agents first: one agent can look after dozens of schemes',
      'Offer the PPM programme and the 24/7 emergency promise, and ask to be on the approved contractor list',
      'Meet trustees before budget and AGM time',
      'Report back after every job with photos',
    ],
    measure: 'Meetings; schemes on contract; annual contract value',
    cadence: 'Weekly prospecting',
  },
  {
    key: 'insurance', group: 'commercial', label: 'Insurance brokers & assessors',
    why: 'Burst geysers, leaks and storm or surge damage are some of the most common household claims in SA. Brokers and assessors need contractors who respond fast and send proper reports.',
    how: [
      'Meet local brokers and offer a fast emergency response for their clients',
      'Ask how to get onto insurer and assessor panels in the area',
      'Send a clear report with photos and leak detection findings on every claim job',
    ],
    measure: 'Brokers met; claim jobs received',
    cadence: 'Monthly',
  },
  {
    key: 'commercial', group: 'commercial', label: 'Businesses: restaurants, schools, guesthouses, offices',
    why: 'Restaurants have grease traps and drains, schools and churches have big old systems, guesthouses and Airbnb hosts cannot wait. Businesses give repeat work once they trust you.',
    how: [
      'Build the list from the prospect tab and visit in person with the info pack',
      'Offer a maintenance agreement (e.g. quarterly drain jetting for restaurants)',
      'Follow up within 7 days and log each step here',
    ],
    measure: 'Visits; meetings; accounts opened',
    cadence: 'Weekly prospecting',
  },
  {
    key: 'trade_partners', group: 'commercial', label: 'Trade referral partners',
    why: 'Builders, tilers, painters, pool and pest-control companies, solar installers and garden services are in homes every day and get asked for a plumber, electrician or aircon tech.',
    how: [
      'Agree a simple referral arrangement and swap cards',
      'Refer work back to them: it has to go both ways',
      'Cross-refer the other Surgeon divisions on every job',
    ],
    measure: 'Partners signed up; jobs referred',
    cadence: 'Monthly',
  },
  {
    key: 'networking', group: 'commercial', label: 'Business networking groups',
    why: 'A weekly business networking chapter or local business chamber puts you in a room with agents, brokers and property people who refer work.',
    how: [
      'Visit a chapter in your territory and join one that has no plumber / electrician / aircon member',
      'Have your 60-second pitch ready',
      'Book one-on-one coffees with the members most likely to refer you',
    ],
    measure: 'Meetings attended; referrals received',
    cadence: 'Weekly',
  },
  {
    key: 'five_around', group: 'street', label: '"Working in your street" drops',
    why: 'Neighbours often have the same old pipes, geysers and DB boards. The cheapest new job is next door to the one you are on.',
    how: [
      'After every job, drop a magnet and card at 5 houses either side and opposite',
      'Use the "We\'ve just been working in your street" card with the QR code and a rand-off offer',
      'Park the branded vehicle where it can be seen and put out the site board',
    ],
    measure: 'Drops done; jobs from the street offer code',
    cadence: 'Every job',
  },
  {
    key: 'on_site', group: 'street', label: 'Upsell & leave-behind on site',
    why: 'Your best marketing is the job you are on. Find the other problems, quote on site, and leave your number where the customer will need it next time.',
    how: [
      'Run the add-on checklist for the division (Operations Manual, Practical Sales)',
      'Quote on site: immediately, not tomorrow',
      'Magnet on the geyser cupboard, DB board or aircon unit; sticker with the 24/7 number',
      'Uniform, shoe covers and a clean site, every time',
    ],
    measure: 'Average job value; add-on sales',
    cadence: 'Every job',
  },
  {
    key: 'vehicle', group: 'street', label: 'Branded vehicle',
    why: 'A clean, signwritten vehicle seen every day in the same suburbs builds name recognition for free.',
    how: [
      'Keep it clean and well parked: it is a moving billboard, and bad driving costs you work',
      'Park in prominent spots between jobs (shopping centres, estate gates)',
    ],
    measure: 'Vehicle visibility checks',
    cadence: 'Daily',
  },
  {
    key: 'reactivation', group: 'repeat', label: 'Past customer reminders',
    why: 'It costs far less to get a past customer to book again than to find a new one. Most homeowners forget when the geyser or aircon was last serviced.',
    how: [
      'Seasonal WhatsApp / email to past customers who agreed to hear from you',
      'Aircon service reminders before summer, geyser checks before winter, drain maintenance after the rains',
      'Pull the list from Servcraft each month',
    ],
    measure: 'Customers contacted; jobs booked',
    cadence: 'Monthly',
  },
  {
    key: 'referral_programme', group: 'repeat', label: 'Customer referral voucher',
    why: 'Happy customers will refer you if you make it easy and worth their while. A rand-value voucher works better than a percentage.',
    how: [
      'Give every happy customer two R150-off vouchers: one for them, one for a friend',
      'Track the voucher code so we know where the job came from',
    ],
    measure: 'Vouchers redeemed; jobs from referrals',
    cadence: 'Every job',
  },
  {
    key: 'short_video', group: 'content', label: 'Short videos & social posts',
    why: 'Drain camera footage, before/after shots and quick tips get attention on Facebook, Instagram, TikTok and YouTube Shorts, and they show customers you know what you are doing.',
    how: [
      'Film the camera inspection, the blockage coming out, the new DB board, the cleaned aircon coil',
      'Keep it under 30 seconds, show the problem first, and get the customer\'s permission',
      'Use the Head Office media library for branded posts in between',
    ],
    measure: 'Posts per month; messages or calls from social',
    cadence: '2 posts a week',
  },
  {
    key: 'community_events', group: 'community', label: 'Local sponsorships & events',
    why: 'School fetes, estate events and sports clubs build goodwill in exactly the suburbs you serve, as long as you can track what comes back.',
    how: [
      'Choose events inside your territory with the right customers',
      'Hand out vouchers with a unique code so results can be measured',
      'Collect names only with consent (POPIA)',
    ],
    measure: 'Cost; vouchers handed out; jobs from the code',
    cadence: 'Quarterly',
  },
  {
    key: 'other', group: 'community', label: 'Other (describe)',
    why: 'Anything else you tried. Describe it so Head Office can see what works.',
    how: [], measure: 'Cost and results', cadence: '—',
  },
];

/** Methods from the older material that franchisees should not spend money on. */
export const RETIRED_METHODS: { name: string; why: string }[] = [
  { name: 'Yellow Pages and printed directories', why: 'Nobody looks up a plumber in a book any more; Google has replaced it.' },
  { name: 'Newspaper print ads and classifieds', why: 'Readership has dropped and results cannot be tracked. Only with Head Office approval, with a tracked number or code.' },
  { name: 'Untargeted flyer and pamphlet drops', why: 'Low response and hard to track. Use the targeted "working in your street" drop instead.' },
  { name: 'Radio, TV, cinema and billboards', why: 'Too expensive for one territory. National brand activity is handled by Head Office.' },
  { name: 'Cold bulk email and SMS to bought lists', why: 'Not allowed under POPIA without consent, and it damages the brand.' },
  { name: 'Fax, chat rooms, forums, RSS, e-zines, banner and link exchanges', why: 'Out of date and no longer reach customers.' },
  { name: 'Teleseminars, infomercials and e-books', why: 'Not how homeowners choose a tradesman.' },
];

// ---------------------------------------------------------------------------
// Foundations checklist
// ---------------------------------------------------------------------------
export interface SetupItem { key: string; label: string; group: string; hint?: string }

export const SETUP_ITEMS: SetupItem[] = [
  { group: 'Training', key: 'tr_ops_chapter', label: 'Operations Manual marketing chapter read' },
  { group: 'Training', key: 'tr_nm_toolkit', label: 'Neighbourhood Marketing Toolkit worked through and quiz passed' },
  { group: 'Training', key: 'tr_client_service', label: 'Client Service quiz passed' },
  { group: 'Training', key: 'tr_practical_sales', label: 'Practical Sales Techniques (add-on sales, prospecting) covered with the team' },

  { group: 'Online', key: 'on_gbp', label: 'Google Business Profile verified, 10+ photos, 24/7 hours showing', hint: 'Paste the profile link as evidence' },
  { group: 'Online', key: 'on_landing', label: 'Territory page live on the Surgeon website' },
  { group: 'Online', key: 'on_google_ads', label: 'Google Ads live with call tracking and an agreed monthly budget' },
  { group: 'Online', key: 'on_facebook', label: 'Facebook and Instagram pages set up with Head Office branding' },
  { group: 'Online', key: 'on_hellopeter', label: 'Hellopeter page claimed' },
  { group: 'Online', key: 'on_listings', label: 'Bing Places listing, same name / number everywhere' },
  { group: 'Online', key: 'on_whatsapp', label: 'WhatsApp Business: profile, catalogue, greeting and after-hours messages, labels' },

  { group: 'Reviews', key: 'rv_link', label: 'Google review link saved as a WhatsApp quick reply' },
  { group: 'Reviews', key: 'rv_nfc', label: 'NFC review tap cards issued to every technician' },
  { group: 'Reviews', key: 'rv_process', label: 'Review request built into the job-completion routine, and who replies is agreed' },

  { group: 'Sales kit', key: 'kit_cards', label: 'Business cards, magnets and 24/7 stickers in every vehicle' },
  { group: 'Sales kit', key: 'kit_street_card', label: '"Working in your street" cards with QR code and offer code' },
  { group: 'Sales kit', key: 'kit_vouchers', label: 'R150-off referral vouchers' },
  { group: 'Sales kit', key: 'kit_profile', label: 'Company profile PDF including your special services (tanker, CCTV, COCs)', hint: 'Upload to the Document Vault so it can be sent from here' },
  { group: 'Sales kit', key: 'kit_signature', label: 'Email signature with phone, WhatsApp and review link' },

  { group: 'Prospecting', key: 'pr_pitch', label: '60-second pitch written and practised' },
  { group: 'Prospecting', key: 'pr_story', label: 'Value story: three real jobs you can tell a prospect about' },
  { group: 'Prospecting', key: 'pr_list', label: 'First 50 prospects loaded in the Prospects tab' },
  { group: 'Prospecting', key: 'pr_letters', label: 'Three letters of recommendation collected' },
  { group: 'Prospecting', key: 'pr_groups', label: 'Joined at least five community / estate groups in the territory' },

  { group: 'Vehicle & site', key: 'vh_signage', label: 'Vehicle signwritten, site board in the vehicle' },
  { group: 'Compliance', key: 'cp_popia', label: 'POPIA consent wording on the job card / quote, and opted-in customers marked in Servcraft' },
];

// ---------------------------------------------------------------------------
// Prospects
// ---------------------------------------------------------------------------
export const SEGMENTS: { key: string; label: string }[] = [
  { key: 'managing_agent', label: 'Managing agent / body corporate / HOA' },
  { key: 'estate_agent', label: 'Estate agent / conveyancer' },
  { key: 'insurance', label: 'Insurance broker / assessor' },
  { key: 'restaurant', label: 'Restaurant / food business' },
  { key: 'hospitality', label: 'Guesthouse / B&B / Airbnb host' },
  { key: 'school', label: 'School / church / NGO' },
  { key: 'retail', label: 'Retail / shopping centre / filling station' },
  { key: 'office', label: 'Office / factory / workshop' },
  { key: 'healthcare', label: 'Medical / retirement / care facility' },
  { key: 'trade_partner', label: 'Trade referral partner' },
  { key: 'property_owner', label: 'Landlord / property investor' },
  { key: 'other', label: 'Other' },
];
export const segmentLabel = (k: string) => SEGMENTS.find(s => s.key === k)?.label || k;

export type ProspectStage = 'identified' | 'contacted' | 'info_sent' | 'meeting_booked' | 'met' | 'proposal' | 'won' | 'lost';
export const STAGES: { key: ProspectStage; label: string; cls: string }[] = [
  { key: 'identified', label: 'Identified', cls: 'bg-gray-100 text-gray-700' },
  { key: 'contacted', label: 'Contacted', cls: 'bg-blue-100 text-blue-700' },
  { key: 'info_sent', label: 'Info sent', cls: 'bg-indigo-100 text-indigo-700' },
  { key: 'meeting_booked', label: 'Meeting booked', cls: 'bg-amber-100 text-amber-700' },
  { key: 'met', label: 'Met', cls: 'bg-orange-100 text-orange-700' },
  { key: 'proposal', label: 'Proposal / quote', cls: 'bg-purple-100 text-purple-700' },
  { key: 'won', label: 'Won', cls: 'bg-green-100 text-green-700' },
  { key: 'lost', label: 'Lost', cls: 'bg-red-50 text-red-700' },
];
export const stageOf = (k: string) => STAGES.find(s => s.key === k) || STAGES[0];

/** Which channel a prospect segment belongs to, so logged prospect activity lands on the right channel. */
export const SEGMENT_CHANNEL: Record<string, string> = {
  managing_agent: 'body_corporates', estate_agent: 'estate_agents', insurance: 'insurance',
  trade_partner: 'trade_partners', restaurant: 'commercial', hospitality: 'commercial', school: 'commercial',
  retail: 'commercial', office: 'commercial', healthcare: 'commercial', property_owner: 'commercial', other: 'commercial',
};

// ---------------------------------------------------------------------------
// Activities
// ---------------------------------------------------------------------------
export const ACTIVITY_TYPES: { key: string; label: string }[] = [
  { key: 'meeting', label: 'Meeting held' },
  { key: 'info_sent', label: 'Info pack / profile sent' },
  { key: 'call', label: 'Phone call' },
  { key: 'whatsapp', label: 'WhatsApp message' },
  { key: 'visit', label: 'Walk-in visit' },
  { key: 'proposal', label: 'Proposal / quote sent' },
  { key: 'review_request', label: 'Review requests sent' },
  { key: 'review_received', label: 'Reviews received' },
  { key: 'gbp_post', label: 'Google Business post' },
  { key: 'content_post', label: 'Social post / video' },
  { key: 'street_drop', label: '"Working in your street" drop' },
  { key: 'ad_spend', label: 'Advertising spend' },
  { key: 'event', label: 'Event / sponsorship' },
  { key: 'reactivation', label: 'Past customers contacted' },
  { key: 'other', label: 'Other' },
];
export const activityLabel = (k: string) => ACTIVITY_TYPES.find(a => a.key === k)?.label || k;
export const channelLabel = (k: string) => CHANNELS.find(c => c.key === k)?.label || k;

// ---------------------------------------------------------------------------
// Monthly targets & scoring
// ---------------------------------------------------------------------------
export interface Targets {
  prospects_added: number;
  info_sent: number;
  meetings: number;
  activities: number;
  review_requests: number;
  gbp_posts: number;
  content_posts: number;
  jobs_from_marketing: number;
}

export const DEFAULT_TARGETS: Targets = {
  prospects_added: 10,
  info_sent: 8,
  meetings: 4,
  activities: 20,
  review_requests: 30,
  gbp_posts: 4,
  content_posts: 8,
  jobs_from_marketing: 10,
};

export const TARGET_LABELS: Record<keyof Targets, string> = {
  prospects_added: 'New prospects added',
  info_sent: 'Info packs sent',
  meetings: 'Prospect meetings held',
  activities: 'Marketing activities logged',
  review_requests: 'Review requests sent',
  gbp_posts: 'Google Business posts',
  content_posts: 'Social posts / videos',
  jobs_from_marketing: 'Jobs won from marketing',
};

export interface Prospect {
  id: string;
  franchisee_id: string;
  business_name: string;
  segment: string;
  contact_name: string | null;
  contact_role: string | null;
  phone: string | null;
  email: string | null;
  suburb: string | null;
  address: string | null;
  source: string | null;
  stage: ProspectStage;
  priority: 'H' | 'M' | 'L';
  est_annual_value: number | null;
  next_action: string | null;
  next_action_date: string | null;
  meeting_at: string | null;
  last_contact_date: string | null;
  popia_consent: boolean;
  popia_consent_at: string | null;
  lost_reason: string | null;
  won_at: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Activity {
  id: string;
  franchisee_id: string;
  prospect_id: string | null;
  activity_date: string;
  channel: string;
  activity_type: string;
  description: string | null;
  quantity: number;
  cost: number;
  leads: number;
  jobs_won: number;
  revenue: number;
  created_by: string | null;
  created_at: string;
}

export interface Plan {
  id?: string;
  franchisee_id: string;
  month: string;
  budget: number;
  google_ads_budget: number;
  targets: Partial<Targets>;
  focus: string | null;
  notes: string | null;
}

export interface SetupRow { franchisee_id: string; item_key: string; done: boolean; done_at: string | null; evidence: string | null }

export interface Review {
  id?: string;
  franchisee_id: string;
  month: string;
  system_score: number | null;
  ho_rating: 'on_track' | 'needs_attention' | 'at_risk' | null;
  comment: string | null;
  actions: string | null;
  reviewed_by: string | null;
  reviewed_at?: string;
}

export const HO_RATINGS: { key: NonNullable<Review['ho_rating']>; label: string; cls: string }[] = [
  { key: 'on_track', label: 'On track', cls: 'bg-green-100 text-green-700' },
  { key: 'needs_attention', label: 'Needs attention', cls: 'bg-amber-100 text-amber-700' },
  { key: 'at_risk', label: 'At risk', cls: 'bg-red-100 text-red-700' },
];

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------
export const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const todayYmd = () => ymd(new Date());
export const monthStartOf = (d: Date | string) => {
  const x = typeof d === 'string' ? new Date(d + 'T00:00:00') : d;
  return ymd(new Date(x.getFullYear(), x.getMonth(), 1));
};
export const addMonths = (month: string, n: number) => {
  const [y, m] = month.split('-').map(Number);
  return ymd(new Date(y, m - 1 + n, 1));
};
export const monthEnd = (month: string) => addMonths(month, 1); // exclusive
export const monthLabel = (month: string) => {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' });
};
export const inMonth = (date: string | null | undefined, month: string) =>
  !!date && date.slice(0, 10) >= month && date.slice(0, 10) < monthEnd(month);
export const fmtDate = (d?: string | null) =>
  d ? new Date(d.length === 10 ? d + 'T00:00:00' : d).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
export const rand = (n: number) => 'R ' + Math.round(n || 0).toLocaleString('en-ZA');

// ---------------------------------------------------------------------------
// Monthly figures and the Marketing Performance Score
// ---------------------------------------------------------------------------
export interface MonthFigures {
  prospects_added: number;
  info_sent: number;
  meetings: number;
  activities: number;
  review_requests: number;
  reviews_received: number;
  gbp_posts: number;
  content_posts: number;
  jobs_from_marketing: number;
  leads: number;
  revenue: number;
  spend: number;
  active_weeks: number;
  weeks_in_month: number;
  pipeline_value: number;
  won_this_month: number;
  overdue_followups: number;
  cost_per_job: number | null;
}

const sumQty = (acts: Activity[], type: string) =>
  acts.filter(a => a.activity_type === type).reduce((s, a) => s + (a.quantity || 1), 0);

const weekKey = (date: string) => {
  const d = new Date(date + 'T00:00:00');
  const day = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - day);
  return ymd(d);
};

export function monthFigures(month: string, prospects: Prospect[], activities: Activity[]): MonthFigures {
  const acts = activities.filter(a => inMonth(a.activity_date, month));
  const today = todayYmd();
  // Weeks of the month that have started so far (so a new month isn't penalised for future weeks)
  const weeks = new Set<string>();
  const end = monthEnd(month) < today ? monthEnd(month) : addDays(today, 1);
  for (let d = month; d < end; d = addDays(d, 1)) weeks.add(weekKey(d));
  const active = new Set(acts.map(a => weekKey(a.activity_date)));
  const spend = acts.reduce((s, a) => s + Number(a.cost || 0), 0);
  const jobs = acts.reduce((s, a) => s + (a.jobs_won || 0), 0);
  return {
    prospects_added: prospects.filter(p => inMonth(p.created_at, month)).length,
    info_sent: sumQty(acts, 'info_sent'),
    meetings: sumQty(acts, 'meeting'),
    activities: acts.length,
    review_requests: sumQty(acts, 'review_request'),
    reviews_received: sumQty(acts, 'review_received'),
    gbp_posts: sumQty(acts, 'gbp_post'),
    content_posts: sumQty(acts, 'content_post'),
    jobs_from_marketing: jobs,
    leads: acts.reduce((s, a) => s + (a.leads || 0), 0),
    revenue: acts.reduce((s, a) => s + Number(a.revenue || 0), 0),
    spend,
    active_weeks: [...active].filter(w => weeks.has(w)).length,
    weeks_in_month: Math.max(1, weeks.size),
    pipeline_value: prospects.filter(p => !['won', 'lost'].includes(p.stage)).reduce((s, p) => s + Number(p.est_annual_value || 0), 0),
    won_this_month: prospects.filter(p => p.stage === 'won' && inMonth(p.won_at, month)).length,
    overdue_followups: prospects.filter(p => !['won', 'lost'].includes(p.stage) && p.next_action_date && p.next_action_date < today).length,
    cost_per_job: jobs > 0 ? spend / jobs : null,
  };
}

export function addDays(date: string, n: number) {
  const d = new Date(date + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return ymd(d);
}

export interface ScoreLine { key: string; label: string; max: number; points: number; detail: string }
export interface Score { total: number; lines: ScoreLine[]; flags: string[] }

const part = (actual: number, target: number, max: number) =>
  target > 0 ? Math.min(1, actual / target) * max : 0;

/**
 * Marketing Performance Score, out of 100.
 *   Prospecting 30 · Consistency 20 · Online & reviews 20 · Foundations 15 · Results 15
 */
export function scoreMonth(f: MonthFigures, targets: Targets, setupDone: number, budget: number): Score {
  const t = targets;
  const setupPct = SETUP_ITEMS.length ? setupDone / SETUP_ITEMS.length : 0;

  // Spend discipline: full marks between 80% and 115% of budget
  let spendPts = 0;
  let spendDetail = 'No budget set';
  if (budget > 0) {
    const r = f.spend / budget;
    spendPts = r < 0.8 ? (r / 0.8) * 7 : r <= 1.15 ? 7 : Math.max(0, 7 - (r - 1.15) * 14);
    spendDetail = `${rand(f.spend)} of ${rand(budget)} (${Math.round(r * 100)}%)`;
  }

  const lines: ScoreLine[] = [
    { key: 'pa', label: 'New prospects added', max: 10, points: part(f.prospects_added, t.prospects_added, 10), detail: `${f.prospects_added} / ${t.prospects_added}` },
    { key: 'is', label: 'Info packs sent', max: 8, points: part(f.info_sent, t.info_sent, 8), detail: `${f.info_sent} / ${t.info_sent}` },
    { key: 'mt', label: 'Prospect meetings held', max: 12, points: part(f.meetings, t.meetings, 12), detail: `${f.meetings} / ${t.meetings}` },
    { key: 'ac', label: 'Activities logged', max: 10, points: part(f.activities, t.activities, 10), detail: `${f.activities} / ${t.activities}` },
    { key: 'wk', label: 'Weeks with activity', max: 10, points: part(f.active_weeks, f.weeks_in_month, 10), detail: `${f.active_weeks} / ${f.weeks_in_month} weeks` },
    { key: 'rr', label: 'Review requests', max: 10, points: part(f.review_requests, t.review_requests, 10), detail: `${f.review_requests} / ${t.review_requests}` },
    { key: 'gp', label: 'Google Business posts', max: 5, points: part(f.gbp_posts, t.gbp_posts, 5), detail: `${f.gbp_posts} / ${t.gbp_posts}` },
    { key: 'cp', label: 'Social posts / videos', max: 5, points: part(f.content_posts, t.content_posts, 5), detail: `${f.content_posts} / ${t.content_posts}` },
    { key: 'fd', label: 'Foundations in place', max: 15, points: setupPct * 15, detail: `${setupDone} / ${SETUP_ITEMS.length} items` },
    { key: 'jb', label: 'Jobs won from marketing', max: 8, points: part(f.jobs_from_marketing, t.jobs_from_marketing, 8), detail: `${f.jobs_from_marketing} / ${t.jobs_from_marketing}` },
    { key: 'sp', label: 'Spend against budget', max: 7, points: spendPts, detail: spendDetail },
  ];

  const flags: string[] = [];
  if (budget <= 0) flags.push('No marketing budget set for this month');
  if (f.overdue_followups > 0) flags.push(`${f.overdue_followups} prospect follow-up${f.overdue_followups === 1 ? '' : 's'} overdue`);
  if (f.meetings === 0) flags.push('No prospect meetings logged this month');
  if (f.review_requests === 0) flags.push('No review requests logged this month');
  if (f.weeks_in_month - f.active_weeks >= 2) flags.push(`${f.weeks_in_month - f.active_weeks} weeks with no marketing activity`);
  if (setupPct < 0.6) flags.push('Less than 60% of the foundations are in place');

  return { total: Math.round(lines.reduce((s, l) => s + l.points, 0)), lines, flags };
}

export const scoreBand = (s: number) =>
  s >= 75 ? { label: 'Strong', cls: 'bg-green-100 text-green-700', bar: 'bg-green-500' }
  : s >= 50 ? { label: 'Fair', cls: 'bg-amber-100 text-amber-700', bar: 'bg-amber-500' }
  : { label: 'Weak', cls: 'bg-red-100 text-red-700', bar: 'bg-red-500' };

export const mergeTargets = (t?: Partial<Targets> | null): Targets => ({ ...DEFAULT_TARGETS, ...(t || {}) });

// ---------------------------------------------------------------------------
// Seasonal calendar (SA). Gauteng/inland vs Western Cape differ on rain.
// ---------------------------------------------------------------------------
export const SEASONAL: { month: number; focus: string }[] = [
  { month: 1, focus: 'Summer storms inland: blocked stormwater and drains, lightning surge damage. Aircon breakdowns at their peak.' },
  { month: 2, focus: 'Aircon still busy. Back to school: approach schools. Body corporate budget season: book managing-agent meetings.' },
  { month: 3, focus: 'Human Rights Day month-long offer. Last aircon services before autumn.' },
  { month: 4, focus: 'Pre-winter geyser check campaign (element, thermostat, valve, timer). Easter / Freedom Day offer.' },
  { month: 5, focus: 'Winter prep: geyser services, timers and blankets; DB board checks before heaters go on. Cape Town rain season starts: leaks and blocked drains.' },
  { month: 6, focus: 'Peak burst-geyser season: insurance brokers and assessors. Youth Day offer.' },
  { month: 7, focus: 'Cold snaps inland: burst pipes and geysers. Keep Google Ads up. Past-customer geyser reminders.' },
  { month: 8, focus: 'Women\'s Day month offer. Start pre-summer aircon service bookings.' },
  { month: 9, focus: 'Spring aircon service special on community groups and Facebook. Heritage Day offer.' },
  { month: 10, focus: 'Aircon service and install peak. Storm season inland: surge protection and DB board upgrades.' },
  { month: 11, focus: '"Before you go away" checks: geyser timers, leak checks, surge protection. Aircon installs.' },
  { month: 12, focus: 'Holiday homes, guesthouses and rentals: the 24/7 emergency promise. Keep the phones answered over the break.' },
];

// ---------------------------------------------------------------------------
// "Send info" message templates by segment
// ---------------------------------------------------------------------------
export interface InfoTemplate { subject: string; body: string }

const INTRO = 'We are {brand}, part of The Surgeon Group, which has been looking after South African homes and businesses since 1979. We run a 24/7/365 emergency service and cover {territory}.';

export function infoTemplate(segment: string, v: { contact: string; brand: string; territory: string; sender: string; phone: string; link?: string }): InfoTemplate {
  const offer: Record<string, string> = {
    managing_agent: 'We would like to be on your approved contractor list for the schemes you manage. We offer planned maintenance programmes, a fast emergency call-out and a written report with photos after every job.',
    estate_agent: 'We do the compliance certificates needed for property transfers, with a quick turnaround and a report you can send straight to your seller or buyer. We can also fix snags found at inspection.',
    insurance: 'Burst geysers, leaks and storm damage: we respond fast, find the cause with leak detection equipment, and send a full report with photos for the claim.',
    restaurant: 'We keep restaurant drains and grease traps flowing with scheduled jetting, so you are not closed on a busy night with a blocked drain.',
    hospitality: 'When a guest has no hot water or a blocked toilet you cannot wait until Monday. We are on call 24/7 and can set up a simple maintenance plan for your property.',
    school: 'We look after older plumbing and electrical systems in schools and churches, and can do a planned maintenance schedule during the holidays.',
    trade_partner: 'Your customers often ask for a plumber, electrician or aircon technician. We would like to refer work both ways, so we each look good to our customers.',
  };
  const body = [
    `Hi {contact},`,
    '',
    INTRO,
    '',
    offer[segment] || 'We would like to show you how we can help with maintenance and emergencies at your property.',
    '',
    v.link ? 'Our company profile is here: {link}' : '',
    'Could we meet for 15 minutes next week? I am happy to come to you.',
    '',
    'Kind regards',
    '{sender}',
    '{phone}',
  ].filter((l, i, arr) => !(l === '' && arr[i - 1] === '')).join('\n');
  const fill = (s: string) => s
    .replace(/{contact}/g, v.contact || 'there')
    .replace(/{brand}/g, v.brand)
    .replace(/{territory}/g, v.territory || 'your area')
    .replace(/{sender}/g, v.sender)
    .replace(/{phone}/g, v.phone || '')
    .replace(/{link}/g, v.link || '');
  return { subject: fill(`{brand} — introduction`), body: fill(body) };
}

/** SA mobile number to wa.me format (27...). */
export const waNumber = (phone?: string | null) => {
  const d = (phone || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('27')) return d;
  if (d.startsWith('0')) return '27' + d.slice(1);
  if (d.length === 9) return '27' + d;
  return d;
};

export const brandFor = (division?: string | null) => {
  const d = (division || '').toLowerCase();
  if (d.includes('electr')) return 'The Electro Surgeon';
  if (d.includes('air')) return 'The Aircon Surgeon';
  if (d.includes('drain') || d.includes('plumb')) return 'The Drain Surgeon';
  return 'The Surgeon Group';
};
