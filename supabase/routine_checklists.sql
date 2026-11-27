-- ============================================================================
-- The Surgeon Group — Franchisee Portal: Routine Checklists (checks & balances)
-- Daily · Weekly · Monthly · Quarterly · Annual — franchise-level and per-team checks
--
-- Built from: Operations Manual 2026 s11–s14 and Annex A/B, and the November 2026
-- master franchise agreement (Draft 2). Each task carries its source reference.
--
-- How this differs from the onboarding checklist
--   Onboarding tasks are ticked once. Routine tasks repeat, so a tick belongs to
--   a franchisee AND a period:
--     daily     → period_key '2026-11-19'
--     weekly    → period_key '2026-W47'   (ISO week)
--     monthly   → period_key '2026-11'
--     quarterly → period_key '2026-Q4'
--     annual    → period_key '2026'
--   A fresh, unticked list appears automatically when the period changes;
--   history is kept, so Head Office can see compliance over time.
--
-- Run AFTER security_franchisee_access.sql (uses its is_staff(), is_admin() and
-- my_franchisee_id() helpers for the access rules in section 6).
--
-- Safe to re-run: content is upserted by id; completions are never touched.
-- ============================================================================

BEGIN;

-- 0. Guard: the access helpers must exist ---------------------------------------
DO $$
BEGIN
  IF to_regprocedure('public.is_staff()') IS NULL
     OR to_regprocedure('public.is_admin()') IS NULL
     OR to_regprocedure('public.my_franchisee_id()') IS NULL THEN
    RAISE EXCEPTION 'Aborting, nothing changed: run security_franchisee_access.sql first.';
  END IF;
END $$;

-- 1. Tables --------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS routine_sections (
  id         text PRIMARY KEY,
  frequency  text NOT NULL CHECK (frequency IN ('daily','weekly','monthly','quarterly','annual')),
  title      text NOT NULL,
  intro      text,
  position   int  NOT NULL
);

CREATE TABLE IF NOT EXISTS routine_tasks (
  id             text PRIMARY KEY,
  section_id     text NOT NULL REFERENCES routine_sections(id),
  text           text NOT NULL,
  responsible    text NOT NULL CHECK (responsible IN ('franchisee','franchisor','both')),
  source_ref     text,                 -- clause / manual section
  proof_required boolean NOT NULL DEFAULT false,
  per_team       boolean NOT NULL DEFAULT false,  -- ticked once per team (vehicle), not once per franchisee
  active         boolean NOT NULL DEFAULT true,
  position       int  NOT NULL
);

-- Checklist items / agenda points shown under a task (vehicle inspection points,
-- meeting agenda). Results per item are stored on the completion in item_results.
CREATE TABLE IF NOT EXISTS routine_task_items (
  id        text PRIMARY KEY,
  task_id   text NOT NULL REFERENCES routine_tasks(id),
  text      text NOT NULL,
  position  int  NOT NULL
);

-- franchisee_id: text, matching profiles.franchisee_id / my_franchisee_id().
CREATE TABLE IF NOT EXISTS routine_completions (
  id             bigserial PRIMARY KEY,
  task_id        text NOT NULL REFERENCES routine_tasks(id),
  franchisee_id  text NOT NULL,
  period_key     text NOT NULL,
  team_ref       text NOT NULL DEFAULT '',  -- team / vehicle (e.g. registration) for per-team tasks; '' otherwise
  completed_by   text,
  completed_at   timestamptz NOT NULL DEFAULT now(),
  note           text,
  attachment_url text,
  item_results   jsonb,      -- e.g. {"vi_03":"ok","vi_07":"fault: cracked windscreen"} or {"ma_05":"discussed"}
  UNIQUE (task_id, franchisee_id, period_key, team_ref)
);

ALTER TABLE routine_tasks ADD COLUMN IF NOT EXISTS per_team boolean NOT NULL DEFAULT false;
ALTER TABLE routine_completions ADD COLUMN IF NOT EXISTS team_ref text NOT NULL DEFAULT '';
ALTER TABLE routine_completions ADD COLUMN IF NOT EXISTS item_results jsonb;

CREATE INDEX IF NOT EXISTS routine_completions_fr_period
  ON routine_completions (franchisee_id, period_key);

-- 2. Sections ------------------------------------------------------------------

INSERT INTO routine_sections (id, frequency, title, intro, position) VALUES
 ('rt_daily',   'daily',     'Daily checks',
  'Done every working day by the franchisee or dispatcher. A branch that does the daily and weekly items never has a bad month-end.', 0),
 ('rt_weekly',  'weekly',    'Weekly checks',
  'Done every week by the franchisee / branch manager, ideally on the same day each week.', 1),
 ('rt_monthly', 'monthly',   'Monthly checks',
  'Done every month, with Head Office where marked. Royalty, marketing fund and statutory payments are contractual deadlines.', 2),
 ('rt_qtr',     'quarterly', 'Quarterly checks',
  'Done once a quarter.', 3),
 ('rt_annual',  'annual',    'Annual checks',
  'Done once a year — most are contractual and must be proven to Head Office.', 4)
ON CONFLICT (id) DO UPDATE SET frequency = EXCLUDED.frequency, title = EXCLUDED.title,
  intro = EXCLUDED.intro, position = EXCLUDED.position;

-- 3. Tasks ---------------------------------------------------------------------

INSERT INTO routine_tasks (id, section_id, text, responsible, source_ref, proof_required, position) VALUES
-- DAILY
  ('rd_02','rt_daily','Morning pipeline check in Eworks — every logged job dispatched, nothing stuck in "new"','franchisee','Manual s14',false,1),
 ('rd_03','rt_daily','Every job, including jobs that came to you directly, logged in Eworks before the work is done','franchisee','cl 25.1(b)(ii); Annex B',false,2),
 ('rd_04','rt_daily','Any dispatched job you can''t take or attend reported to the call centre immediately for reallocation','franchisee','cl 8.3(a), 8.3(e)',false,3),
 ('rd_05','rt_daily','Go-backs and QC findings attended before any new work that day','franchisee','cl 8.3(f); Annex A',false,4),
 ('rd_06','rt_daily','Afternoon pipeline check — every completed job invoiced; no cash job without an Eworks invoice','franchisee','cl 14.5(b); Manual s14',false,5),
 ('rd_07','rt_daily','Today''s invoices quality-read — cause, work done, materials, follow-on work, photos, customer signature. Poor invoices back to the technician today','franchisee','Manual s14',false,6),
 ('rd_08','rt_daily','Cash and card (Yoco) takings reconciled to today''s invoices','franchisee','Manual s14',false,7),
 ('rd_09','rt_daily','Cash banked into the one business account — never later than 2 business days; deposit slip uploaded','franchisee','cl 14.3, 14.5(a)',true,8),
 ('rd_10','rt_daily','Customer ratings and Google reviews read and answered','franchisee','Manual s14',false,9),
 ('rd_11','rt_daily','Complaints or disputes raised directly with you logged and reported to Head Office','franchisee','Annex B',false,10),
 ('rd_12','rt_daily','Injuries, near-misses and customer property damage reported and recorded today (medical-treatment injuries to Head Office within 24 hours)','franchisee','cl 8.4(b); Manual s12',false,11),
 ('rd_13','rt_daily','Sales for the day checked against the daily target','franchisee','Manual s14',false,12),
 ('rd_15','rt_daily','Manager QA: one completed job checked at random today (photos, invoice, workmanship, customer call)','franchisee','cl 8.3(f); Manual s8',false,14),
 ('rd_16','rt_daily','Further work found on site sent to the customer as a quote today and opened as a job','franchisee','Manual s4, s6',false,15),
 ('rd_14','rt_daily','Tonight''s after-hours standby cover confirmed (24/7/365)','franchisee','cl 8.3(a); Division Annexure A10',false,13),

-- WEEKLY
 ('rw_01','rt_weekly','Sales against budget; jobs per team per day; average job value','franchisee','Manual s14',false,0),
 ('rw_02','rt_weekly','Cancellations reviewed — number and reasons','franchisee','Manual s14',false,1),
 ('rw_03','rt_weekly','Go-backs reviewed — number, cause, technician','franchisee','Manual s14',false,2),
 ('rw_04','rt_weekly','Quotes followed up — outstanding, accepted-no-deposit, conversion rate','franchisee','Manual s14',false,3),
 ('rw_05','rt_weekly','Debtors over 60 days checked against the age analysis; collection actions logged','franchisee','cl 14.2; Manual s14',false,4),
 ('rw_06','rt_weekly','Xero bank reconciliation up to date; supplier invoices captured against their jobs','franchisee','cl 16.1(a)',false,5),
 ('rw_08','rt_weekly','Cartrack exceptions reviewed and explained — speeding, long stops, route deviations','franchisee','cl 9.5, 11.6; Manual s14',false,7),
 ('rw_09','rt_weekly','Weekly technicians'' meeting held (plumbers / electricians / aircon techs and assistants) — work through the agenda below, record attendance and actions, upload the minutes','franchisee','Manual s13–s14',true,8),
 ('rw_10','rt_weekly','Local marketing plan activity for the week done and logged in the marketing programme','franchisee','cl 17.4',false,9),
 ('rw_11','rt_weekly','Any manual or SOP update notified this week read and staff briefed','franchisee','cl 7.2(b); Annex B',false,10),
 ('rw_13','rt_weekly','Customer satisfaction calls — at least 3 completed jobs phoned back; issues logged','franchisee','Manual s2, s8',false,12),
 ('rw_14','rt_weekly','Maintenance (PPM) contract visits for the week scheduled and attended per the contract plan','franchisee','Manual s4; Maintenance Agreement',false,13),
 ('rw_12','rt_weekly','Timesheets, overtime and commission inputs checked for payroll','franchisee','Manual s13',false,11),

-- MONTHLY
 ('rm_01','rt_monthly','Turnover declaration from Head Office checked against Eworks','franchisee','cl 15.5',false,0),
 ('rm_02','rt_monthly','Royalty (10%) and marketing fund (5%) paid by EFT on the due date — proof of payment uploaded','franchisee','cl 15.3–15.4, 17.1; Division Annexure A8',true,1),
 ('rm_03','rt_monthly','Management accounts prepared and sent to Head Office — income, cost of sales, gross margin, expenses, net profit','franchisee','cl 16.1(d); Manual s14',true,2),
 ('rm_04','rt_monthly','Materials-to-turnover and fuel-to-turnover ratios checked against Rates & Standards targets','franchisee','Manual s14; Annex A',false,3),
 ('rm_05','rt_monthly','Debtors book — age analysis, over-90-day handovers, bad debts written off and why','franchisee','Manual s7, s14',false,4),
 ('rm_06','rt_monthly','Supplier statements reconciled; all suppliers paid on time','franchisee','cl 8.4(h); Manual s14',false,5),
 ('rm_07','rt_monthly','PAYE, UIF and SDL (EMP201) submitted and paid by the 7th; UIF declarations done','franchisee','cl 8.4(a), 14.1; Manual s14',true,6),
 ('rm_08','rt_monthly','VAT return submitted and paid, if due this month','franchisee','cl 16.1(c); Manual s14',false,7),
 ('rm_10','rt_monthly','Vehicle inspection forms completed; services up to date; signwriting clean and current','franchisee','cl 11.2; Manual s11',true,9),
 ('rm_11','rt_monthly','Technician reviews completed against the scorecard and signed by both','franchisee','Manual s13',true,10),
 ('rm_13','rt_monthly','First-aid kits, fire extinguishers and PPE checked; toolbox talk held and register signed; incident register up to date','franchisee','cl 8.4(b); Manual s12',false,12),
 ('rm_14','rt_monthly','Complaints and QC findings reviewed with Head Office','both','Manual s14',false,13),
 ('rm_15','rt_monthly','Under-servicing figures reviewed — declined, late and reallocated jobs; billable hours per team. Over the limits? Plan an extra team','both','cl 4.3, 4.5, 4.6',false,14),
 ('rm_16','rt_monthly','Marketing results reviewed — leads, cost per lead, what is converting','both','cl 17.3–17.4',false,15),
 ('rm_17','rt_monthly','Sales against the annual financial target (after the 6-month ramp-up)','both','cl 25.7; Manual s14',false,16),
 ('rm_19','rt_monthly','Access clean-up — anyone who left removed from Eworks, WhatsApp groups, email and devices; devices and keys returned','franchisee','cl 21.3 (POPIA); Manual s14',false,18),
 ('rm_20','rt_monthly','Staff leave planned for next month; standby and team cover arranged (temporary replacements approved by Head Office)','franchisee','cl 9.6; Manual s13',false,19),
 ('rm_21','rt_monthly','Maintenance contracts invoiced; renewals due in the next 60 days followed up','franchisee','Manual s7',false,20),
 ('rm_18','rt_monthly','Records check — nothing operational kept only on paper or a personal WhatsApp; job photos and forms in Eworks','franchisee','Manual s14',false,17),

-- QUARTERLY
 ('rq_01','rt_qtr','Quarterly self-assessment questionnaire completed and returned within 14 days of receipt','franchisee','cl 16.1(e)',true,0),
 ('rq_02','rt_qtr','Performance against the financial target — below 80%? Agree an improvement plan with Head Office','both','cl 25.1(b)(xiii), 25.7',false,1),
 ('rq_03','rt_qtr','Insurance — premiums paid, policies in force, franchisor still noted as interested party','franchisee','cl 19.1–19.2',false,2),
 ('rq_05','rt_qtr','Subcontractor panel — registrations, insurance and rates still current','franchisee','cl 29.2; process flow 7.8',false,4),
 ('rq_04','rt_qtr','Staff files audited — contracts, consents, trade registrations and driver''s licences still valid','franchisee','cl 9.1; Manual s13–s14',false,3),

-- ANNUAL
 ('ra_01','rt_annual','Annual financial statements, certified by your accountant, sent to Head Office within 90 days of year-end','franchisee','cl 16.1(d)',true,0),
 ('ra_02','rt_annual','Proof of insurance cover sent to Head Office (public liability R10m incl. defective workmanship)','franchisee','cl 19.1',true,1),
 ('ra_03','rt_annual','On the agreement anniversary: proof of criminal checks on all workers and the Principal sent to Head Office','franchisee','cl 9.7(c)',true,2),
 ('ra_04','rt_annual','Trade registrations renewed — PIRB, Department of Employment and Labour, SAQCC Gas','franchisee','cl 9.1; Manual s13',true,3),
 ('ra_05','rt_annual','Annual financial target received in writing; annual budget agreed with Head Office','both','cl 25.7; Manual s14',false,4),
 ('ra_06','rt_annual','Safety file reviewed — risk assessments, appointments, first-aider certificate current','franchisee','cl 8.4(b); Manual s12',false,5),
 ('ra_07','rt_annual','Company tax return and CIPC annual return filed','franchisee','cl 14.1; Manual s14',false,6),
 ('ra_08','rt_annual','Marketing fund annual statement issued to franchisees within 3 months of the franchisor''s year-end','franchisor','cl 17.2',false,7),
 ('ra_10','rt_annual','COIDA Return of Earnings submitted to the Compensation Fund; letter of good standing current','franchisee','cl 8.4(a); Manual s12',true,9),
 ('ra_11','rt_annual','Payroll reconciliations (EMP501) submitted — interim and annual; IRP5s issued to staff','franchisee','cl 8.4(a), 14.1',false,10),
 ('ra_09','rt_annual','Final year only: renewal requested in writing 6 to 3 months before the expiry date','franchisee','cl 5.2',false,8)
ON CONFLICT (id) DO UPDATE SET section_id = EXCLUDED.section_id, text = EXCLUDED.text,
  responsible = EXCLUDED.responsible, source_ref = EXCLUDED.source_ref,
  proof_required = EXCLUDED.proof_required, position = EXCLUDED.position;

-- PER-TEAM CHECKS (ticked separately for every team / vehicle)
INSERT INTO routine_tasks (id, section_id, text, responsible, source_ref, proof_required, per_team, position) VALUES
-- Daily, before the team leaves
 ('rd_t1','rt_daily','Team: uniform clean, complete and branded; ID card worn','franchisee','cl 9.4; Manual s10, s13',false,true,30),
 ('rd_t2','rt_daily','Team: shoe covers (slippers) and dust sheets on board for every customer''s home','franchisee','Manual s5, s10',false,true,31),
 ('rd_t3','rt_daily','Team: head lamp and torch charged and working; spare batteries on board','franchisee','Manual s11',false,true,32),
 ('rd_t4','rt_daily','Team: PPE for the division on board and in good condition (gloves, eye protection, boots; respirator / harness where needed)','franchisee','cl 8.4(b); Manual s12',false,true,33),
 ('rd_t5','rt_daily','Team: vehicle walk-around — tyres, lights, fluids, load secured, ladders strapped, first-aid kit, tracker working','franchisee','cl 11.2, 11.6; Manual s11–s12',false,true,34),
-- Weekly
 ('rw_t1','rt_weekly','Team: van stock count against the agreed inventory list; shortfalls reordered so 90% of jobs are fixed first time','franchisee','Manual s11; process flow 2.6',true,true,30),
 ('rw_t2','rt_weekly','Team: equipment check — drain machine, jetter, camera, leak detector, test instruments, gauges and recovery unit (as per division) working, clean and calibrated','franchisee','cl 8.3(d), 11.1; Manual s11',false,true,31),
 ('rw_t4','rt_weekly','Team: vehicle inspection completed against the inspection points below — every fault logged, repair booked and photos uploaded','franchisee','cl 11.2, 9.5; Manual s11',true,true,29),
 ('rw_t3','rt_weekly','Team: consumables topped up — shoe covers, dust sheets, cleaning materials, chemicals stored secured','franchisee','Manual s11–s12',false,true,32),
-- Monthly
 ('rm_t1','rt_monthly','Team: full van stock count and valuation; variances against Eworks stock usage explained and signed by the technician','franchisee','Manual s11, s14',true,true,30),
 ('rm_t2','rt_monthly','Team: tool count against the tool register; missing or damaged tools recorded and replaced','franchisee','cl 11.1; Manual s11, s14',true,true,31),
 ('rm_t3','rt_monthly','Team: uniforms and PPE inspected — worn items replaced, PPE issue register signed','franchisee','cl 9.4; Manual s12',false,true,32),
 ('rm_t4','rt_monthly','Team: specialised equipment service log checked (jetter, camera, leak detection, gauges); services booked when due','franchisee','cl 8.3(d); Manual s11',false,true,33)
ON CONFLICT (id) DO UPDATE SET section_id = EXCLUDED.section_id, text = EXCLUDED.text,
  responsible = EXCLUDED.responsible, source_ref = EXCLUDED.source_ref,
  proof_required = EXCLUDED.proof_required, per_team = EXCLUDED.per_team, position = EXCLUDED.position;

-- ITEMS: vehicle inspection points and weekly meeting agenda
DELETE FROM routine_task_items WHERE task_id IN ('rw_t4','rw_09');
INSERT INTO routine_task_items (id, task_id, text, position) VALUES
 ('vi_01','rw_t4','Licence disc valid; driver''s licence and PrDP (where needed) on the driver',0),
 ('vi_02','rw_t4','Tyres — tread depth, pressure, no cuts or bulges; spare tyre, jack and wheel spanner on board',1),
 ('vi_03','rw_t4','Lights — head, tail, brake, indicators, hazards; hooter working',2),
 ('vi_04','rw_t4','Windscreen free of cracks; wipers and washer working; mirrors intact',3),
 ('vi_05','rw_t4','Oil, coolant, brake fluid levels; no leaks under the vehicle',4),
 ('vi_06','rw_t4','Brakes and handbrake effective; no warning lights on the dashboard',5),
 ('vi_07','rw_t4','Body — any new damage photographed and reported',6),
 ('vi_08','rw_t4','Signwriting clean, intact and current; vehicle washed (assistant''s job)',7),
 ('vi_09','rw_t4','Canopy locks, roof rack, ladder straps and shelving secure',8),
 ('vi_10','rw_t4','Load secured; gas / refrigerant cylinders upright and strapped; chemicals stored secured',9),
 ('vi_11','rw_t4','Cab clean, nothing loose; tool bins in place',10),
 ('vi_12','rw_t4','First-aid kit complete; fire extinguisher in date; warning triangle and reflective vest on board',11),
 ('vi_13','rw_t4','Cartrack unit working (no tampering)',12),
 ('vi_14','rw_t4','Odometer reading recorded; next service due (km / date) checked',13),
 ('vi_15','rw_t4','Fuel card on board; fuel slips handed in',14),
 ('ma_01','rw_09','Attendance and punctuality — late coming puts pressure on the whole day and the customer waits',0),
 ('ma_02','rw_09','Last week''s numbers — jobs, average job value, commission, cancellations',1),
 ('ma_03','rw_09','Go-backs and QC findings — cause and the lesson for everyone',2),
 ('ma_04','rw_09','Customer feedback — Google reviews, ratings, complaints; ask every happy customer for a review (Google tap card)',3),
 ('ma_05','rw_09','Photos on every job — before (existing damage such as cracked tiles, holes), during, after and materials used',4),
 ('ma_06','rw_09','Invoices — exactly what was done, materials, further work needed; further work goes to the dispatcher immediately as a quote / new job',5),
 ('ma_07','rw_09','Eworks — read the job card; update every status: accepted, en route, on site, completed',6),
 ('ma_08','rw_09','Communication — introduce yourself on site; keep the customer informed before, during and after; office to team; WhatsApp group; assistant manages the phone while driving',7),
 ('ma_09','rw_09','Appointments kept on time; tell the office what your day looks like',8),
 ('ma_10','rw_09','Site standards — slippers (shoe covers), cover sheets, buckets, disinfect, leave the site clean; clean uniform to meet the customer, work uniform for dirty work; clean shoes after each job',9),
 ('ma_11','rw_09','Test all work before presenting the invoice; work pride — would you show the customer proudly?',10),
 ('ma_12','rw_09','Health & safety topic of the week (toolbox talk); incidents and near-misses',11),
 ('ma_13','rw_09','Vehicles, tools and equipment — care, cleaning, rods and machines checked weekly, faults reported',12),
 ('ma_14','rw_09','Stock — shortages; guarantee repairs: bring the replaced part back with the invoice',13),
 ('ma_15','rw_09','Technical case of the week (e.g. confirm geyser isolator before quoting; offer a camera inspection before rodding)',14),
 ('ma_16','rw_09','Training — one standard from the manual or SOPs; new skills = new job types = more commission; are assistants learning?',15),
 ('ma_17','rw_09','Payments — Yoco on site, cash handling and banking rules',16),
 ('ma_18','rw_09','After-hours standby roster for the coming week',17),
 ('ma_19','rw_09','Where can the front office improve? Where can the managers improve?',18),
 ('ma_20','rw_09','Actions agreed — owner and date',19)
ON CONFLICT (id) DO UPDATE SET task_id = EXCLUDED.task_id, text = EXCLUDED.text, position = EXCLUDED.position;

-- 4. Helper: the current period key for a frequency ------------------------------

CREATE OR REPLACE FUNCTION routine_period_key(freq text, d date DEFAULT (now() AT TIME ZONE 'Africa/Johannesburg')::date)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE freq
    WHEN 'daily'     THEN to_char(d, 'YYYY-MM-DD')
    WHEN 'weekly'    THEN to_char(d, 'IYYY-"W"IW')
    WHEN 'monthly'   THEN to_char(d, 'YYYY-MM')
    WHEN 'quarterly' THEN to_char(d, 'YYYY-"Q"Q')
    WHEN 'annual'    THEN to_char(d, 'YYYY')
  END
$$;

-- 5. Check -----------------------------------------------------------------------
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM routine_tasks WHERE active;
  IF n <> 76 THEN
    RAISE EXCEPTION 'Aborting, nothing changed: expected 76 routine tasks, found %', n;
  END IF;
END $$;

-- 6. Access rules ------------------------------------------------------------------
--   Checklist content (sections, tasks, items): any logged-in user reads; admins change.
--   Ticks (completions): staff see and tick for everyone; a franchisee sees and
--   ticks only their own; only an admin deletes. Anonymous visitors get nothing.
ALTER TABLE routine_sections    ENABLE ROW LEVEL SECURITY;
ALTER TABLE routine_tasks       ENABLE ROW LEVEL SECURITY;
ALTER TABLE routine_task_items  ENABLE ROW LEVEL SECURITY;
ALTER TABLE routine_completions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rs_read  ON routine_sections;
DROP POLICY IF EXISTS rs_admin ON routine_sections;
CREATE POLICY rs_read  ON routine_sections FOR SELECT TO authenticated USING (true);
CREATE POLICY rs_admin ON routine_sections FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS rt_read  ON routine_tasks;
DROP POLICY IF EXISTS rt_admin ON routine_tasks;
CREATE POLICY rt_read  ON routine_tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY rt_admin ON routine_tasks FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS rti_read  ON routine_task_items;
DROP POLICY IF EXISTS rti_admin ON routine_task_items;
CREATE POLICY rti_read  ON routine_task_items FOR SELECT TO authenticated USING (true);
CREATE POLICY rti_admin ON routine_task_items FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS rc_read   ON routine_completions;
DROP POLICY IF EXISTS rc_insert ON routine_completions;
DROP POLICY IF EXISTS rc_update ON routine_completions;
DROP POLICY IF EXISTS rc_delete ON routine_completions;
CREATE POLICY rc_read   ON routine_completions FOR SELECT TO authenticated
  USING (public.is_staff() OR franchisee_id = public.my_franchisee_id());
CREATE POLICY rc_insert ON routine_completions FOR INSERT TO authenticated
  WITH CHECK (public.is_staff() OR franchisee_id = public.my_franchisee_id());
CREATE POLICY rc_update ON routine_completions FOR UPDATE TO authenticated
  USING (public.is_staff() OR franchisee_id = public.my_franchisee_id())
  WITH CHECK (public.is_staff() OR franchisee_id = public.my_franchisee_id());
CREATE POLICY rc_delete ON routine_completions FOR DELETE TO authenticated
  USING (public.is_admin());

REVOKE ALL ON routine_sections, routine_tasks, routine_task_items, routine_completions FROM anon;
GRANT SELECT ON routine_sections, routine_tasks, routine_task_items TO authenticated;
GRANT INSERT, UPDATE, DELETE ON routine_sections, routine_tasks, routine_task_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON routine_completions TO authenticated;
GRANT USAGE ON SEQUENCE routine_completions_id_seq TO authenticated;

COMMIT;

-- ============================================================================
-- QUERIES THE PORTAL NEEDS
--
-- This period's list for one franchisee, with ticks:
--   (per_team tasks: repeat each row once per active team / vehicle of the franchisee
--    and match c.team_ref to that team; for other tasks team_ref = '')
--   SELECT s.title, t.id, t.text, t.responsible, t.source_ref, t.proof_required, t.per_team,
--          c.completed_at, c.completed_by, c.attachment_url
--     FROM routine_tasks t
--     JOIN routine_sections s ON s.id = t.section_id
--     LEFT JOIN routine_completions c
--       ON c.task_id = t.id AND c.franchisee_id = :franchisee
--      AND c.period_key = routine_period_key(s.frequency)
--    WHERE t.active
--    ORDER BY s.position, t.position;
--
-- Items under a task (inspection points / agenda):
--   SELECT id, text FROM routine_task_items WHERE task_id = :task ORDER BY position;
--
-- Tick a task:
--   INSERT INTO routine_completions (task_id, franchisee_id, period_key, team_ref, completed_by, note, attachment_url, item_results)
--   SELECT :task, :franchisee, routine_period_key(s.frequency), coalesce(:team, ''), :user, :note, :url, :items_json
--     FROM routine_tasks t JOIN routine_sections s ON s.id = t.section_id WHERE t.id = :task
--   ON CONFLICT (task_id, franchisee_id, period_key, team_ref) DO NOTHING;
--
-- Head Office compliance view — % of this month's monthly tasks done, per franchisee:
--   SELECT c.franchisee_id,
--          round(100.0 * count(c.id) / (SELECT count(*) FROM routine_tasks WHERE section_id='rt_monthly' AND active)) AS pct
--     FROM routine_completions c JOIN routine_tasks t ON t.id = c.task_id
--    WHERE t.section_id = 'rt_monthly' AND c.period_key = routine_period_key('monthly')
--    GROUP BY c.franchisee_id;
--
-- ROLLBACK (removes everything this file created, including all ticks):
--   DROP TABLE routine_completions; DROP TABLE routine_task_items; DROP TABLE routine_tasks; DROP TABLE routine_sections;
--   DROP FUNCTION routine_period_key(text, date);
-- ============================================================================
