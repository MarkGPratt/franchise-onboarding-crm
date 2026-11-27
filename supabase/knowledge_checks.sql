-- ============================================================================
-- The Surgeon Group — Franchisee Portal: Knowledge Checks (questionnaire by link)
--
-- Head Office sends a private link to anyone (Principal, franchisee staff or Head
-- Office staff). They answer without a portal login. Each module is scored on its
-- own; the pass mark is 100%. Wrong answers show the clause or section to re-read
-- (not the right answer) and the person tries again. Every attempt is kept.
-- When a Principal linked to a franchisee passes every module on the link, Process
-- Flow task 3.5 "Principal's course assessment passed" is ticked automatically.
--
-- Staff manage modules, questions, links and results; the public only reaches the
-- quiz through quiz_get / quiz_submit with a valid link. Run after
-- security_franchisee_access.sql. Safe to re-run.
-- ============================================================================

begin;

create table if not exists public.quiz_modules (
  id          text primary key,
  title       text not null,
  description text,
  audience    text not null default 'all' check (audience in ('all','franchisee','head_office')),
  pass_pct    integer not null default 100 check (pass_pct between 1 and 100),
  active      boolean not null default true,
  position    integer not null default 0
);

create table if not exists public.quiz_questions (
  id         text primary key,
  module_id  text not null references public.quiz_modules(id) on delete cascade,
  prompt     text not null,
  options    jsonb not null,          -- ["option A","option B",...]
  correct    integer not null,        -- 0-based index into options
  reference  text,                    -- clause / section shown when answered wrongly
  active     boolean not null default true,
  position   integer not null default 0
);

create table if not exists public.quiz_assignments (
  id            uuid primary key default gen_random_uuid(),
  token         text not null unique default encode(gen_random_bytes(18), 'hex'),
  person_name   text not null,
  person_email  text,
  person_type   text not null default 'franchisee_staff' check (person_type in ('principal','franchisee_staff','head_office')),
  franchisee_id text references public.franchisees(id) on delete set null,
  module_ids    text[] not null,
  created_by    text,
  created_at    timestamptz not null default now(),
  completed_at  timestamptz,
  cancelled     boolean not null default false
);

create table if not exists public.quiz_attempts (
  id            bigserial primary key,
  assignment_id uuid not null references public.quiz_assignments(id) on delete cascade,
  module_id     text not null,
  answers       jsonb not null,
  score         integer not null,
  total         integer not null,
  passed        boolean not null,
  created_at    timestamptz not null default now()
);
create index if not exists quiz_attempts_asg on public.quiz_attempts (assignment_id, module_id);

alter table public.quiz_modules     enable row level security;
alter table public.quiz_questions   enable row level security;
alter table public.quiz_assignments enable row level security;
alter table public.quiz_attempts    enable row level security;
drop policy if exists "staff all" on public.quiz_modules;
drop policy if exists "staff all" on public.quiz_questions;
drop policy if exists "staff all" on public.quiz_assignments;
drop policy if exists "staff read" on public.quiz_attempts;
create policy "staff all"  on public.quiz_modules     for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "staff all"  on public.quiz_questions   for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "staff all"  on public.quiz_assignments for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "staff read" on public.quiz_attempts    for select to authenticated using (public.is_staff());
revoke all on public.quiz_modules, public.quiz_questions, public.quiz_assignments, public.quiz_attempts from anon;
grant select, insert, update, delete on public.quiz_modules, public.quiz_questions, public.quiz_assignments to authenticated;
grant select on public.quiz_attempts to authenticated;

-- Public: the quiz behind a link (no correct answers are sent to the browser)
create or replace function public.quiz_get(p_token text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare a quiz_assignments; res jsonb;
begin
  select * into a from quiz_assignments where token = p_token and not cancelled;
  if a.id is null then return null; end if;
  select jsonb_build_object(
    'person_name', a.person_name, 'completed_at', a.completed_at,
    'modules', coalesce(jsonb_agg(jsonb_build_object(
       'id', m.id, 'title', m.title, 'description', m.description, 'pass_pct', m.pass_pct,
       'passed', exists (select 1 from quiz_attempts t where t.assignment_id = a.id and t.module_id = m.id and t.passed),
       'attempts', (select count(*) from quiz_attempts t where t.assignment_id = a.id and t.module_id = m.id),
       'questions', (select coalesce(jsonb_agg(jsonb_build_object('id', q.id, 'prompt', q.prompt, 'options', q.options) order by q.position), '[]'::jsonb)
                       from quiz_questions q where q.module_id = m.id and q.active)
     ) order by m.position), '[]'::jsonb))
    into res
    from quiz_modules m where m.id = any(a.module_ids) and m.active;
  return res;
end $$;

-- Public: mark one module. Returns the score and, for wrong answers, only the reference.
create or replace function public.quiz_submit(p_token text, p_module text, p_answers jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  a quiz_assignments; m quiz_modules; q record;
  total int := 0; score int := 0; wrong jsonb := '[]'::jsonb; ok boolean; all_passed boolean; v_task text;
begin
  select * into a from quiz_assignments where token = p_token and not cancelled;
  if a.id is null then raise exception 'This link is not valid any more.'; end if;
  if not (p_module = any(a.module_ids)) then raise exception 'This module is not on your link.'; end if;
  select * into m from quiz_modules where id = p_module and active;
  if m.id is null then raise exception 'This module is not available.'; end if;
  for q in select * from quiz_questions where module_id = p_module and active order by position loop
    total := total + 1;
    if (p_answers->>q.id) is not null and (p_answers->>q.id)::int = q.correct then score := score + 1;
    else wrong := wrong || jsonb_build_object('id', q.id, 'prompt', q.prompt, 'reference', q.reference); end if;
  end loop;
  if total = 0 then raise exception 'This module has no questions yet.'; end if;
  ok := score * 100 >= m.pass_pct * total;
  insert into quiz_attempts (assignment_id, module_id, answers, score, total, passed) values (a.id, p_module, p_answers, score, total, ok);

  select bool_and(exists (select 1 from quiz_attempts t where t.assignment_id = a.id and t.module_id = x and t.passed))
    into all_passed from unnest(a.module_ids) x;
  if all_passed and a.completed_at is null then
    update quiz_assignments set completed_at = now() where id = a.id;
    -- Principal passed everything on the link: tick Process Flow 3.5 (if the lock allows it)
    if a.person_type = 'principal' and a.franchisee_id is not null then
      select id into v_task from checklist_tasks where section_id = 'ph_cond' and text ilike '%Principal''s course assessment passed%' limit 1;
      if v_task is not null then
        begin
          insert into task_progress (franchisee_id, task_id, completed, completed_at, completed_by, updated_at)
          values (a.franchisee_id, v_task, true, now(), 'Knowledge check: ' || a.person_name, now())
          on conflict (franchisee_id, task_id) do update set completed = true, completed_at = now(), completed_by = excluded.completed_by, updated_at = now();
        exception when others then null;
        end;
      end if;
    end if;
  end if;
  return jsonb_build_object('score', score, 'total', total, 'passed', ok, 'pass_pct', m.pass_pct, 'wrong', wrong, 'all_passed', coalesce(all_passed, false));
end $$;

revoke all on function public.quiz_get(text), public.quiz_submit(text, text, jsonb) from public;
grant execute on function public.quiz_get(text), public.quiz_submit(text, text, jsonb) to anon, authenticated;

-- Invitation email
insert into public.email_templates (event_type, name, subject, body, enabled)
select 'quiz_invite', 'Knowledge check link',
       'Your Surgeon Group knowledge check',
       E'Hi {{recipient_name}},\n\nPlease complete your Surgeon Group knowledge check. It covers: {{modules}}.\n\nOpen your private link:\n{{quiz_link}}\n\nEach part must be answered 100% correctly. If an answer is wrong you will be shown which clause or section to re-read, and you can try again as often as you need.\n\nRegards,\n{{sender_name}}', true
where not exists (select 1 from public.email_templates where event_type = 'quiz_invite');

-- Starter content (from G003, G025, Master Process Flow v2 and the routine checklists).
insert into public.quiz_modules (id, title, description, audience, position) values
 ('agreement', 'Franchise agreement essentials', 'What the November 2026 franchise agreement says, in plain English (G003).', 'all', 10),
 ('onboarding', 'The onboarding process and its gates', 'How the Process Flow works: phases, gates and the order things must happen in (Master Process Flow v2).', 'all', 20),
 ('head_office', 'Head Office services, your area and under-servicing', 'What Plan Two does for franchisees, the exclusive area and the under-servicing test (G025, clause 4).', 'all', 30),
 ('routines', 'Daily, weekly, monthly and annual checks', 'The routine checks and deadlines every branch keeps (portal checklists, Operations Manual).', 'all', 40)
on conflict (id) do nothing;

insert into public.quiz_questions (id, module_id, prompt, options, correct, reference, position) values
 ('agreement_01', 'agreement', 'How long is the cooling-off period after the franchise agreement is signed?', '["5 business days", "10 business days", "14 calendar days", "30 days"]'::jsonb, 1, 'cl 3.1(b), 3.4(a)', 10),
 ('agreement_02', 'agreement', 'When does the franchise agreement come into force?', '["When it is signed", "When the franchise fee is paid", "When finance (if needed) is approved, the cooling-off period has passed and Head Office confirms in writing that the Principal has completed the training course", "On launch day"]'::jsonb, 2, 'cl 3.1', 20),
 ('agreement_03', 'agreement', 'Which obligations bind the franchisee from signature, even if the agreement never comes into force?', '["Royalty and marketing fund", "Confidentiality, restraint, suretyship and trade marks", "Insurance and vehicle branding", "None of them"]'::jsonb, 1, 'cl 3.2–3.3', 30),
 ('agreement_04', 'agreement', 'If the master agreement and the Division Annexure differ on parties, area, fees, term or service hours, which applies?', '["The master agreement", "The Division Annexure", "Whichever was signed last", "Head Office decides"]'::jsonb, 1, 'cl 1.6–1.7', 40),
 ('agreement_05', 'agreement', 'What is the term of the franchise?', '["3 years, no renewal", "5 years with one 5-year renewal", "10 years", "Month to month"]'::jsonb, 1, 'Division Annexure A6–A7', 50),
 ('agreement_06', 'agreement', 'What is the royalty?', '["5% of gross revenue excl. VAT", "10% of gross revenue excl. VAT", "10% of net profit", "A fixed amount per month"]'::jsonb, 1, 'cl 15.3; Annexure A8', 60),
 ('agreement_07', 'agreement', 'What is the marketing fund contribution?', '["2% of gross revenue", "5% of gross revenue excl. VAT", "10% of gross revenue", "Nothing: franchisees pay for their own marketing only"]'::jsonb, 1, 'cl 17.1', 70),
 ('agreement_08', 'agreement', 'May a franchisee hold back royalties while there is a dispute with the franchisor?', '["Yes, if the dispute is in writing", "Yes, up to half", "No", "Only with an attorney''s letter"]'::jsonb, 2, 'cl 15.7', 80),
 ('agreement_09', 'agreement', 'How soon must cash takings be banked?', '["The same day", "Within 2 business days", "Weekly", "At month-end"]'::jsonb, 1, 'cl 14.5(a)', 90),
 ('agreement_10', 'agreement', 'How many business bank accounts may the franchise use?', '["One dedicated account", "One per division", "As many as needed", "One per team"]'::jsonb, 0, 'cl 14.3', 100),
 ('agreement_11', 'agreement', 'What public liability cover must the franchisee carry?', '["R1 million", "R5 million", "R10 million including defective workmanship, with the franchisor noted as an interested party", "None is required"]'::jsonb, 2, 'cl 19.1', 110),
 ('agreement_12', 'agreement', 'For most breaches, how long does the franchisee have to put things right after written notice?', '["48 hours", "7 days", "14 business days", "30 days"]'::jsonb, 2, 'cl 25.2', 120),
 ('agreement_13', 'agreement', 'Which of these allows the franchisor to terminate immediately?', '["A royalty payment one day late", "Dishonesty, hiding or diverting payments, or tampering with the tracker or field service software records", "A single customer complaint", "Missing one weekly meeting"]'::jsonb, 1, 'cl 25.3', 130),
 ('agreement_14', 'agreement', 'What restraint applies after the agreement ends?', '["None", "For 6 months the franchisee and Principal may not compete in the area or approach its customers", "2 years, nationwide", "5 years in the province"]'::jsonb, 1, 'cl 27', 140),
 ('agreement_15', 'agreement', 'Who owns customer information?', '["The franchisee", "The franchisor, always", "It is shared 50/50", "Only the customer"]'::jsonb, 1, 'cl 21.1', 150),
 ('agreement_16', 'agreement', 'If the franchisee is a company, what is the Principal''s personal suretyship limited to?', '["It is unlimited", "R100 000 plus interest and costs", "The franchise fee", "There is no suretyship"]'::jsonb, 1, 'cl 28', 160),
 ('agreement_17', 'agreement', 'Who owns the Google Business Profile and the phone numbers customers use, and when do they move?', '["The franchisee owns them and keeps them", "The franchisor owns them; they transfer to the franchisor when the agreement ends", "Google owns them", "The network provider decides"]'::jsonb, 1, 'cl 18, 26.1(g); G021, G050', 170),
 ('agreement_18', 'agreement', 'What access does the franchisor have to the field service software?', '["Monthly totals only", "Full access to all information in it, at all times", "Only with the franchisee''s permission", "None"]'::jsonb, 1, 'cl 11.9–11.15', 180),
 ('agreement_19', 'agreement', 'Which marketing material needs Head Office approval before it is used?', '["None", "All of it", "Only vehicle signage", "Only Google Ads"]'::jsonb, 1, 'cl 17.6', 190),
 ('agreement_20', 'agreement', 'What is it if a franchisee skips the Manual''s hiring process when employing staff?', '["Acceptable if the person is qualified", "A material breach", "A warning only", "Only a problem for technicians"]'::jsonb, 1, 'cl 9.2', 200),
 ('onboarding_01', 'onboarding', 'How long after the disclosure document is delivered may the agreement be signed?', '["The same day", "At least 14 days later", "7 days later", "Only after launch"]'::jsonb, 1, 'cl 31.4; task 1.3', 10),
 ('onboarding_02', 'onboarding', 'When must the business (company or sole proprietorship) be registered?', '["After launch", "Before the agreement is signed, with the CIPC documents attached", "Within 6 months", "Never, for a sole proprietor"]'::jsonb, 1, 'task 2.10', 20),
 ('onboarding_03', 'onboarding', 'What has to happen before any setup money is spent (vehicle, tools, staff)?', '["The ''Cleared to proceed'' gate: cooling-off expired, finance in place and the Principal''s course passed", "The agreement is signed", "The franchise fee is paid", "The launch date is agreed"]'::jsonb, 0, 'task 3.6', 30),
 ('onboarding_04', 'onboarding', 'Where is the initial franchise fee held until the cooling-off period expires?', '["It is spent on setup", "In trust", "It is refunded", "It is paid to Plan Two"]'::jsonb, 1, 'cl 15.1; task 2.15', 40),
 ('onboarding_05', 'onboarding', 'When is the franchisee training course complete?', '["After the Principal''s course", "When every task in Phases 0 to 10 is ticked", "On launch day", "After 90 days"]'::jsonb, 1, 'tasks 0.5, 10.14; cl 3.1(c)', 50),
 ('onboarding_06', 'onboarding', 'Which phases run side by side once the compliance pack (gate 4.15) is filed?', '["Phases 5 to 8", "Phases 9 and 10", "Phases 1 to 3", "None: each waits for the one before"]'::jsonb, 0, 'Gated timeline', 60),
 ('onboarding_07', 'onboarding', 'What must happen before any staff member works unsupervised?', '["Nothing", "An induction: the manual, the SOPs, the job system, and 2 to 5 days with an experienced team", "Only a signed contract", "Only PPE issued"]'::jsonb, 1, 'task 9.15; Manual s13', 70),
 ('onboarding_08', 'onboarding', 'What does the full transaction test cover?', '["Lead to quote to job to invoice to payment", "Only invoicing", "Only the card machine", "Only call routing"]'::jsonb, 0, 'task 6.13', 80),
 ('onboarding_09', 'onboarding', 'How much notice must the insurer undertake to give the franchisor before cancelling a policy?', '["None", "7 days", "14 days", "30 days"]'::jsonb, 2, 'cl 19.2; task 4.14', 90),
 ('onboarding_10', 'onboarding', 'When does the ramp-up end and the first annual financial target get set in writing?', '["Month 1", "Month 6", "Year 2", "There is no target"]'::jsonb, 1, 'cl 25.7; task 11.8', 100),
 ('head_office_01', 'head_office', 'Who provides the call centre, job dispatch, administration and quality control?', '["The Surgeon Group under a separate services agreement", "Plan Two Plumbing Services, under an arrangement with the franchisor, as part of the franchise agreement", "The franchisee", "An outside call centre chosen by the franchisee"]'::jsonb, 1, 'G025; cl 6.1(f)', 10),
 ('head_office_02', 'head_office', 'What does Plan Two charge for these services?', '["10% of every job", "No fee per job at present; direct supplier costs may be recovered at cost, as listed in Part E of the Division Annexure", "R50 per job", "Whatever Plan Two decides"]'::jsonb, 1, 'G025; Division Annexure Part E', 20),
 ('head_office_03', 'head_office', 'May Plan Two''s own branches work in a franchisee''s exclusive area?', '["Yes, at any time", "Only with that franchisee''s written authority, or through the under-servicing process", "Only on weekends", "Never, under any circumstances"]'::jsonb, 1, 'G025; cl 4', 30),
 ('head_office_04', 'head_office', 'Under the under-servicing test, what share of dispatched jobs declined, late or reallocated is too high?', '["More than 5% in one month", "More than 15% over 3 consecutive months", "More than 50%", "Any declined job"]'::jsonb, 1, 'cl 4.3; G099', 40),
 ('head_office_05', 'head_office', 'What billable-hours level per team triggers the under-servicing test?', '["More than 100 hours in one month", "More than 128 hours per team per month for 3 consecutive months", "More than 200 hours", "There is no limit"]'::jsonb, 1, 'cl 4.3; G054', 50),
 ('head_office_06', 'head_office', 'After written notice that the area is under-serviced, what does the franchisee get?', '["7 days to respond", "90 days'' first right to add a team", "Immediate termination", "Nothing"]'::jsonb, 1, 'cl 4.6', 60),
 ('head_office_07', 'head_office', 'You can''t take or attend a dispatched job. What must you do?', '["Ignore it", "Tell the call centre immediately so it can be reallocated", "Pass it to a friend", "Do it the next day"]'::jsonb, 1, 'cl 8.3(a)', 70),
 ('head_office_08', 'head_office', 'How are concerns about Head Office''s services raised, and how fast must Head Office respond?', '["Verbally; within 30 days", "In writing; within 10 business days", "On WhatsApp; within 24 hours", "There is no process"]'::jsonb, 1, 'G025', 80),
 ('head_office_09', 'head_office', 'Who prepares the franchisee''s monthly management accounts and runs its debtors?', '["Head Office", "The franchisee, who sends the management accounts to Head Office every month", "Plan Two", "Nobody"]'::jsonb, 1, 'cl 16.1(d)', 90),
 ('head_office_10', 'head_office', 'Business e-mail addresses are:', '["Created and owned by the franchisee", "Issued by Head Office and remain franchisor property", "Personal Gmail addresses", "Not needed"]'::jsonb, 1, 'cl 11.4; task 6.1', 100),
 ('routines_01', 'routines', 'Every job, including one that came to you directly, must be:', '["Logged in Eworks before the work is done", "Logged at month-end", "Logged only if over R1 000", "Not logged"]'::jsonb, 0, 'cl 25.1(b)(ii); daily checks', 10),
 ('routines_02', 'routines', 'Go-backs and QC findings must be:', '["Attended before any new work that day", "Attended within a week", "Attended when convenient", "Handled by Head Office"]'::jsonb, 0, 'cl 8.3(f)', 20),
 ('routines_03', 'routines', 'How are the royalty and marketing fund paid?', '["By EFT on the due date, with proof of payment uploaded", "In cash", "Quarterly", "The customer pays it"]'::jsonb, 0, 'cl 15.3–15.4, 17.1; monthly checks', 30),
 ('routines_04', 'routines', 'By when must PAYE, UIF and SDL (EMP201) be submitted and paid?', '["The 7th of each month", "The 25th", "The end of each quarter", "Once a year"]'::jsonb, 0, 'cl 8.4(a); monthly checks', 40),
 ('routines_05', 'routines', 'The technicians'' meeting is held:', '["Weekly, with attendance, actions and minutes uploaded", "Monthly", "When there is a problem", "Only for new staff"]'::jsonb, 0, 'Manual s13–s14; weekly checks', 50),
 ('routines_06', 'routines', 'How often is each team''s van stock counted against the agreed inventory list?', '["Weekly, with a full count and valuation monthly", "Once a year", "Never", "Only when stock runs out"]'::jsonb, 0, 'Manual s11; weekly and monthly team checks', 60),
 ('routines_07', 'routines', 'How many customer satisfaction calls are made each week?', '["At least 3 completed jobs phoned back", "None", "10% of all jobs", "Only complaints"]'::jsonb, 0, 'Manual s2, s8; weekly checks', 70),
 ('routines_08', 'routines', 'How often do proof of insurance cover and proof of criminal checks go to Head Office?', '["Every year", "Never", "Only at renewal", "Only when asked"]'::jsonb, 0, 'cl 19.1, 9.7(c); annual checks', 80),
 ('routines_09', 'routines', 'Within how long must the quarterly self-assessment questionnaire be returned?', '["7 days", "14 days of receipt", "30 days", "Next quarter"]'::jsonb, 1, 'cl 16.1(e)', 90),
 ('routines_10', 'routines', 'Injuries that need medical treatment are reported to Head Office within:', '["24 hours", "7 days", "Month-end", "They don''t need to be reported"]'::jsonb, 0, 'cl 8.4(b); Manual s12', 100)
on conflict (id) do nothing;

commit;
