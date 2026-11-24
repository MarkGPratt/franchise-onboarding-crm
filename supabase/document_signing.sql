-- Online NDA and Disclosure Document signing
-- ---------------------------------------------------------------------------
-- Staff pick a PDF from the Documents vault (the NDA, or the disclosure
-- document for the lead's division) and send the prospect a private link
-- (/sign/<token>). The prospect reads the PDF, ticks the statements, types
-- their name and signs. The edge function "document-signing" then stamps a
-- signature certificate page onto the PDF, saves the signed copy to storage
-- (franchise-documents/leads/<lead_id>/signed/...) and logs it on the lead.
--
-- The public page never touches this table directly: every public action
-- goes through the edge function, which checks the token.
--
-- Safe to re-run.
-- ---------------------------------------------------------------------------

create extension if not exists pgcrypto;

create table if not exists public.signature_requests (
  id              uuid primary key default gen_random_uuid(),
  token           uuid not null unique default gen_random_uuid(),
  lead_id         text references public.leads(id) on delete set null,
  doc_kind        text not null check (doc_kind in ('nda', 'disclosure')),
  division        text,
  signer_name     text,
  signer_email    text,
  -- the document that was sent (copied from the Documents vault at send time)
  document_id     text,
  source_name     text not null,
  source_path     text not null,
  source_sha256   text,
  status          text not null default 'sent'
                  check (status in ('sent', 'opened', 'signed', 'cancelled')),
  sent_by         text,
  sent_at         timestamptz not null default now(),
  opened_at       timestamptz,
  -- what the signer entered
  signed_at       timestamptz,
  signed_name     text,
  signed_capacity text,
  signed_company  text,
  signed_ip       text,
  signed_user_agent text,
  -- the signed copy
  signed_path     text,
  signed_url      text,
  -- copied into the franchisee's documents on conversion
  franchisee_id   text,
  copied_document_id text
);

create index if not exists signature_requests_lead_idx on public.signature_requests(lead_id);

alter table public.signature_requests enable row level security;

drop policy if exists "Signature requests readable by staff"   on public.signature_requests;
drop policy if exists "Signature requests insertable by staff" on public.signature_requests;
drop policy if exists "Signature requests updatable by staff"  on public.signature_requests;
drop policy if exists "Signature requests deletable by staff"  on public.signature_requests;
create policy "Signature requests readable by staff"   on public.signature_requests for select to authenticated using (true);
create policy "Signature requests insertable by staff" on public.signature_requests for insert to authenticated with check (true);
create policy "Signature requests updatable by staff"  on public.signature_requests for update to authenticated using (true);
create policy "Signature requests deletable by staff"  on public.signature_requests for delete to authenticated using (true);

-- ---------------------------------------------------------------------------
-- Email templates (editable under Settings > Email Templates)
-- ---------------------------------------------------------------------------

insert into public.email_templates (event_type, name, subject, body, enabled)
select 'nda_invite', 'NDA for signature (to prospect)',
       'Confidentiality agreement (NDA) - The Surgeon Group',
       E'Dear {{recipient_name}},\n\nThank you for your continued interest in a {{division}} franchise with The Surgeon Group.\n\nBefore we share our financial and operating information with you, we ask every prospective franchisee to sign our confidentiality agreement (NDA). The link below opens the agreement. Please read it, then sign it online. It takes about five minutes.\n\n{{signing_link}}\n\nYou will receive a signed copy by email as soon as you have signed.\n\nIf you have any questions, reply to this email or call {{sender_name}}.\n\nKind regards,\n{{sender_name}}\nThe Surgeon Group, Franchising Division',
       true
where not exists (select 1 from public.email_templates where event_type = 'nda_invite');

insert into public.email_templates (event_type, name, subject, body, enabled)
select 'disclosure_invite', 'Disclosure document (to prospect)',
       'Your {{division}} franchise disclosure document - The Surgeon Group',
       E'Dear {{recipient_name}},\n\nAs part of the franchise process, we are required to give you our disclosure document at least 14 days before you sign a franchise agreement.\n\nThe link below opens the {{division}} disclosure document. Please read it carefully, then confirm online that you have received it. You are welcome to share it with your attorney, accountant or financial adviser.\n\n{{signing_link}}\n\nYou will receive a copy, with the date you received it, by email.\n\nIf you have any questions, reply to this email or call {{sender_name}}.\n\nKind regards,\n{{sender_name}}\nThe Surgeon Group, Franchising Division',
       true
where not exists (select 1 from public.email_templates where event_type = 'disclosure_invite');

insert into public.email_templates (event_type, name, subject, body, enabled)
select 'document_signed_copy', 'Signed document copy (to prospect)',
       'Your signed copy: {{document_title}} - The Surgeon Group',
       E'Dear {{recipient_name}},\n\nThank you. Your {{document_title}} was completed on {{signed_date}}.\n\nYou can download your copy here (the link works for 30 days, so please save the file):\n{{document_link}}\n\nKind regards,\nThe Surgeon Group, Franchising Division',
       true
where not exists (select 1 from public.email_templates where event_type = 'document_signed_copy');

insert into public.email_templates (event_type, name, subject, body, enabled)
select 'document_signed_staff', 'Document signed (to staff)',
       '{{document_title}} completed: {{applicant_name}}',
       E'Hi {{recipient_name}},\n\n{{applicant_name}} has completed the {{document_title}} ({{division}}) on {{signed_date}}.\n\n{{extra_note}}\n\nThe signed copy is saved on the lead in the CRM:\n{{app_url}}',
       true
where not exists (select 1 from public.email_templates where event_type = 'document_signed_staff');

-- Confirmation to the prospect when they submit the online application form
insert into public.email_templates (event_type, name, subject, body, enabled)
select 'application_received', 'Application received (to prospect)',
       'We have received your franchise application - The Surgeon Group',
       E'Dear {{recipient_name}},\n\nThank you for completing your {{division}} franchise application. We received it on {{submitted_date}}.\n\nOur franchising team will review it and contact you within 5 working days to discuss the next step.\n\nIf you need to add or change anything in the meantime, simply reply to this email.\n\nKind regards,\nThe Surgeon Group, Franchising Division',
       true
where not exists (select 1 from public.email_templates where event_type = 'application_received');
