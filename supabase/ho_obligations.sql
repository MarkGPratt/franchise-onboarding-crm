-- ============================================================================
-- The Surgeon Group — Franchisee Portal: Head Office Obligations
--
-- What Head Office owes each franchisee, with due dates and an owner.
--   * Onboarding: every Process Flow task owned by the franchisor (read live from
--     the Process Flow; due dates from the launch plan weeks). No table needed.
--   * Recurring: the register below (agreement, Operations Manual, G documents).
--     Each line has a frequency, how its due date is worked out, an owner and a source.
--     Admins edit the register on Obligations > Register.
--   * Done: ho_obligation_done keeps who ticked what, for which franchisee and period.
--
-- Staff only (admin / sales). Run after security_franchisee_access.sql and
-- franchisee_portal.sql. Safe to re-run: register lines are added once by id and
-- edits made in the portal are kept.
-- ============================================================================

begin;

-- Agreement expiry per franchisee (for the renewal and hand-over reminders).
-- Leave empty to use "trading since" + 5 years.
alter table public.franchisees add column if not exists agreement_expiry date;

create table if not exists public.ho_obligations (
  id          text primary key,
  title       text not null,
  source      text,
  frequency   text not null check (frequency in ('monthly','quarterly','annual','once')),
  anchor      text not null default 'calendar' check (anchor in ('calendar','launch','expiry')),
  due_day     integer check (due_day between 1 and 31),     -- calendar: day of the month
  due_month   integer check (due_month between 1 and 12),   -- calendar annual: month
  offset_days integer,                                      -- launch / expiry: days after (negative = before)
  owner_name  text not null default 'Head Office',
  auto        text check (auto in ('declaration','contact')),
  active      boolean not null default true,
  position    integer not null default 0,
  note        text
);

create table if not exists public.ho_obligation_done (
  id            bigserial primary key,
  obligation_id text not null,          -- register id, or 'task:<checklist task id>' is not used (tasks tick in the Process Flow)
  franchisee_id text not null references public.franchisees(id) on delete cascade,
  period_key    text not null,          -- '2026-11', '2026-Q4', '2026', 'once'
  due_on        date,
  done_at       timestamptz not null default now(),
  done_by       text,
  note          text,
  unique (obligation_id, franchisee_id, period_key)
);
create index if not exists ho_obligation_done_fr on public.ho_obligation_done (franchisee_id);

alter table public.ho_obligations     enable row level security;
alter table public.ho_obligation_done enable row level security;
drop policy if exists "staff read"  on public.ho_obligations;
drop policy if exists "admin write" on public.ho_obligations;
drop policy if exists "staff all"   on public.ho_obligation_done;
create policy "staff read"  on public.ho_obligations for select to authenticated using (public.is_staff());
create policy "admin write" on public.ho_obligations for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "staff all"   on public.ho_obligation_done for all to authenticated using (public.is_staff()) with check (public.is_staff());
revoke all on public.ho_obligations, public.ho_obligation_done from anon;
grant select, insert, update, delete on public.ho_obligations, public.ho_obligation_done to authenticated;
grant usage on sequence public.ho_obligation_done_id_seq to authenticated;

insert into public.ho_obligations (id, title, source, frequency, anchor, due_day, due_month, offset_days, owner_name, auto, position, note) values
 ('m_stats',    'Turnover declaration and area statistics sent to the franchisee', 'cl 4.5, 15.5; G099', 'monthly', 'calendar', 5, null, null, 'Estelle', null, 10, null),
 ('m_approve',  'Last month''s turnover declaration reviewed and approved', 'cl 15; Declarations page', 'monthly', 'calendar', 10, null, null, 'Estelle', 'declaration', 20, 'Ticks itself when the declaration is approved.'),
 ('m_contact',  'At least the standard number of contacts logged this month', 'Contact Log standard', 'monthly', 'calendar', 28, null, null, 'Louis / Ian', 'contact', 30, 'Ticks itself when the Contact Log shows the month as met.'),
 ('m_marketing','Monthly Head Office marketing review recorded', 'cl 17.3–17.4; Marketing Performance', 'monthly', 'calendar', 10, null, null, 'Head Office', null, 40, null),
 ('m_quality',  'Complaints and QC findings reviewed with the franchisee', 'Manual s14; routine checklist rm_14', 'monthly', 'calendar', 20, null, null, 'Head Office', null, 50, null),
 ('q_selfassess','Quarterly self-assessment questionnaire sent to the franchisee', 'cl 16.1(e); G098', 'quarterly', 'calendar', 7, null, null, 'Head Office', null, 60, null),
 ('q_target',   'Performance against the financial target reviewed; below 80% means an improvement plan', 'cl 25.1(b)(xiii), 25.7; G097', 'quarterly', 'calendar', 21, null, null, 'Head Office', null, 70, null),
 ('a_target',   'Annual financial target agreed and set in writing', 'cl 25.7; G096', 'annual', 'launch', null, null, 182, 'Head Office', null, 80, 'First at month 6 after launch, then every year.'),
 ('a_crim',     'Proof of criminal checks on all workers and the Principal received', 'cl 9.7(c)', 'annual', 'launch', null, null, 365, 'Head Office', null, 90, null),
 ('a_insure',   'Proof of insurance cover received (R10m public liability incl. defective workmanship)', 'cl 19.1', 'annual', 'launch', null, null, 365, 'Head Office', null, 100, null),
 ('a_afs',      'Annual financial statements received (within 90 days of year-end)', 'cl 16.1(d)', 'annual', 'calendar', 31, 5, null, 'Estelle', null, 110, 'Set to 31 May for a February year-end; change if needed.'),
 ('a_fund',     'Marketing fund annual statement issued to the franchisee', 'cl 17.2', 'annual', 'calendar', 31, 5, null, 'Estelle', null, 120, 'Within 3 months of the franchisor''s year-end; set to 31 May for a February year-end.'),
 ('e_renew',    'Renewal: check whether the franchisee has asked to renew (6 to 3 months before expiry)', 'cl 5.2', 'once', 'expiry', null, null, -180, 'Head Office', null, 130, null),
 ('e_handover', 'Expiry: plan the hand-over of numbers, e-mail, domain and profiles', 'cl 18, 26.1(g); G021, G050', 'once', 'expiry', null, null, -30, 'Head Office', null, 140, null)
on conflict (id) do nothing;

-- Digest email (Obligations > "Email each owner their list")
insert into public.email_templates (event_type, name, subject, body, enabled)
select 'obligations_digest', 'Head Office obligations (weekly list)',
       'Your Head Office obligations: {{overdue}} overdue, {{due_soon}} due in the next 7 days',
       E'Hi {{recipient_name}},\n\nThese franchisee obligations are yours:\n\n{{items}}\n\nTick them off in the portal under Obligations:\n{{app_url}}', true
where not exists (select 1 from public.email_templates where event_type = 'obligations_digest');

commit;
