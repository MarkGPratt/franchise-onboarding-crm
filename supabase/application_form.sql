-- Online franchise application form
-- One application per lead. The prospect opens a private link (/apply/<token>)
-- without logging in; they can only reach their own application, and only
-- through the two functions below.

create extension if not exists pgcrypto;

create table if not exists public.franchise_applications (
  id            uuid primary key default gen_random_uuid(),
  token         uuid not null unique default gen_random_uuid(),
  lead_id       text references public.leads(id) on delete set null,
  applicant_name  text,
  applicant_email text,
  division      text,
  status        text not null default 'sent'
                check (status in ('sent', 'opened', 'in_progress', 'submitted')),
  answers       jsonb not null default '{}'::jsonb,
  sent_by       text,
  sent_at       timestamptz not null default now(),
  opened_at     timestamptz,
  updated_at    timestamptz not null default now(),
  submitted_at  timestamptz,
  notified_at   timestamptz
);

create index if not exists franchise_applications_lead_idx on public.franchise_applications(lead_id);

alter table public.franchise_applications enable row level security;

-- CRM users (signed in) can see and manage applications.
drop policy if exists "Applications readable by staff"  on public.franchise_applications;
drop policy if exists "Applications insertable by staff" on public.franchise_applications;
drop policy if exists "Applications updatable by staff" on public.franchise_applications;
drop policy if exists "Applications deletable by staff" on public.franchise_applications;
create policy "Applications readable by staff"  on public.franchise_applications for select to authenticated using (true);
create policy "Applications insertable by staff" on public.franchise_applications for insert to authenticated with check (true);
create policy "Applications updatable by staff" on public.franchise_applications for update to authenticated using (true);
create policy "Applications deletable by staff" on public.franchise_applications for delete to authenticated using (true);

-- Public access: read one application by its private token.
create or replace function public.get_franchise_application(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.franchise_applications;
begin
  select * into r from public.franchise_applications where token = p_token;
  if not found then
    return null;
  end if;
  if r.status = 'sent' then
    update public.franchise_applications
       set status = 'opened', opened_at = now()
     where id = r.id;
    r.status := 'opened';
  end if;
  return jsonb_build_object(
    'applicant_name', r.applicant_name,
    'division', r.division,
    'status', r.status,
    'answers', r.answers,
    'submitted_at', r.submitted_at
  );
end;
$$;

-- Public access: save progress, or submit. A submitted application is locked.
create or replace function public.save_franchise_application(p_token uuid, p_answers jsonb, p_submit boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.franchise_applications;
begin
  select * into r from public.franchise_applications where token = p_token for update;
  if not found then
    raise exception 'Application not found';
  end if;
  if r.status = 'submitted' then
    raise exception 'This application has already been submitted';
  end if;
  if pg_column_size(p_answers) > 200000 then
    raise exception 'Answers too large';
  end if;
  update public.franchise_applications
     set answers = coalesce(p_answers, '{}'::jsonb),
         status = case when p_submit then 'submitted' else 'in_progress' end,
         submitted_at = case when p_submit then now() else null end,
         updated_at = now()
   where id = r.id;
  return jsonb_build_object('ok', true, 'status', case when p_submit then 'submitted' else 'in_progress' end);
end;
$$;

revoke all on function public.get_franchise_application(uuid) from public;
revoke all on function public.save_franchise_application(uuid, jsonb, boolean) from public;
grant execute on function public.get_franchise_application(uuid) to anon, authenticated;
grant execute on function public.save_franchise_application(uuid, jsonb, boolean) to anon, authenticated;

-- Editable email templates (Settings > Email Templates)
insert into public.email_templates (event_type, name, subject, body, enabled)
select 'application_invite', 'Franchise application form (to prospect)',
       'Your {{division}} franchise application - The Surgeon Group',
       E'Dear {{recipient_name}},\n\nThank you for the interest you have shown in a {{division}} franchise with The Surgeon Group.\n\nThe link below opens a short overview of the opportunity, followed by our confidential application questionnaire. You can save your answers and come back to finish them at any time.\n\n{{application_link}}\n\nCompleting the questionnaire does not commit you or The Surgeon Group to anything. It helps us understand you, your goals and your readiness, so that our conversation is useful for both of us.\n\nIf you have any questions, reply to this email or call {{sender_name}}.\n\nKind regards,\n{{sender_name}}\nThe Surgeon Group, Franchising Division',
       true
where not exists (select 1 from public.email_templates where event_type = 'application_invite');

insert into public.email_templates (event_type, name, subject, body, enabled)
select 'application_submitted', 'Franchise application submitted (to staff)',
       'Application submitted: {{applicant_name}} ({{division}})',
       E'Hi {{recipient_name}},\n\n{{applicant_name}} has submitted their franchise application for {{division}}.\n\nOpen the lead in the CRM to read it:\n{{app_url}}',
       true
where not exists (select 1 from public.email_templates where event_type = 'application_submitted');
