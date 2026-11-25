-- ============================================================================
-- Franchisee access: who can see what
-- ----------------------------------------------------------------------------
-- Run this BEFORE giving franchisees logins.
--
-- The original schema had proper rules (staff see everything, a franchisee
-- sees only their own rows), but wide-open rules were added on top of them
-- later (open_all_leads, documents_all, task_uploads_all, ...). In Postgres
-- any one rule that allows access wins, so the open rules made every table
-- readable and writable by anyone with the site's public key, logged in or not.
--
-- This script removes every rule on the tables below and puts back one clear
-- set. It is safe to re-run. Tables that don't exist are skipped.
--
--   Staff  = profiles.role 'admin' or 'sales'   (is_staff())
--   Admin  = profiles.role 'admin'              (is_admin())
--   Own    = rows whose franchisee_id is the logged-in franchisee's (my_franchisee_id())
-- ============================================================================

begin;

-- Helper functions (same as the original schema; recreated so this file stands alone)
create or replace function public.is_admin() returns boolean
  language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') $$;

create or replace function public.is_staff() returns boolean
  language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','sales')) $$;

create or replace function public.my_franchisee_id() returns text
  language sql stable security definer set search_path = public as
$$ select franchisee_id from public.profiles where id = auth.uid() $$;

-- Drop every policy on a table, switch RLS on
create or replace function pg_temp.reset_policies(t text) returns boolean language plpgsql as $$
declare p record;
begin
  if to_regclass('public.' || t) is null then
    raise notice 'skip % (table not found)', t;
    return false;
  end if;
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
    execute format('drop policy %I on public.%I', p.policyname, t);
  end loop;
  execute format('alter table public.%I enable row level security', t);
  return true;
end $$;

-- 1. Staff only ---------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'leads','lead_interactions','lead_stage_emails','franchise_applications','signature_requests',
    'stage_documents','franchisee_notes','franchisee_note_replies'
  ] loop
    if pg_temp.reset_policies(t) then
      execute format('create policy "staff all" on public.%I for all to authenticated using (public.is_staff()) with check (public.is_staff())', t);
    end if;
  end loop;

  -- CRM marketing tables (not used by the portal screens; edge functions use the service key)
  for t in select tablename from pg_tables where schemaname = 'public' and tablename like 'crm\_%' and tablename <> 'crm_calendly_connections' loop
    perform pg_temp.reset_policies(t);
    execute format('create policy "staff all" on public.%I for all to authenticated using (public.is_staff()) with check (public.is_staff())', t);
  end loop;
end $$;

-- 2. Staff, or the franchisee's own rows ---------------------------------------
do $$
declare t text;
begin
  foreach t in array array['task_progress','task_comments','task_uploads','routine_completions'] loop
    if pg_temp.reset_policies(t) then
      execute format('create policy "staff or own" on public.%I for all to authenticated using (public.is_staff() or franchisee_id = public.my_franchisee_id()) with check (public.is_staff() or franchisee_id = public.my_franchisee_id())', t);
    end if;
  end loop;
end $$;

-- 3. Reference data: everyone logged in can read, admins change -----------------
do $$
declare t text;
begin
  foreach t in array array[
    'checklist_sections','checklist_tasks','checklist_subtasks','checklist_task_attachments',
    'divisions','areas','routine_sections','routine_tasks','routine_task_items'
  ] loop
    if pg_temp.reset_policies(t) then
      execute format('create policy "read" on public.%I for select to authenticated using (true)', t);
      execute format('create policy "admin write" on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
    end if;
  end loop;
end $$;

-- 4. Franchisees: staff see all, a franchisee sees only their own record --------
do $$ begin
  if pg_temp.reset_policies('franchisees') then
    create policy "staff or own read" on public.franchisees for select to authenticated using (public.is_staff() or id = public.my_franchisee_id());
    create policy "staff insert"      on public.franchisees for insert to authenticated with check (public.is_staff());
    create policy "staff update"      on public.franchisees for update to authenticated using (public.is_staff()) with check (public.is_staff());
    create policy "admin delete"      on public.franchisees for delete to authenticated using (public.is_admin());
  end if;
end $$;

-- 5. Document Vault ------------------------------------------------------------
--   Staff: everything.
--   Franchisee: master documents marked Everyone / Franchisees only, plus documents
--   assigned to them. They may add or change only their own edited copies.
do $$ begin
  if pg_temp.reset_policies('documents') then
    create policy "staff all" on public.documents for all to authenticated using (public.is_staff()) with check (public.is_staff());
    create policy "franchisee read" on public.documents for select to authenticated using (
      coalesce(visibility, 'all') in ('all','franchisee')
      and (franchisee_id is null or franchisee_id = public.my_franchisee_id()));
    -- their own edited copies only (an edited copy always points to the original); documents
    -- Head Office assigned to them, such as a signed NDA, stay read-only for them
    create policy "franchisee own copies" on public.documents for all to authenticated
      using (franchisee_id is not null and franchisee_id = public.my_franchisee_id() and parent_document_id is not null)
      with check (franchisee_id is not null and franchisee_id = public.my_franchisee_id() and parent_document_id is not null);
  end if;
end $$;

-- 6. Email templates: staff read, admins change -----------------------------------
do $$ begin
  if pg_temp.reset_policies('email_templates') then
    create policy "staff read"  on public.email_templates for select to authenticated using (public.is_staff());
    create policy "admin write" on public.email_templates for all to authenticated using (public.is_admin()) with check (public.is_admin());
  end if;
end $$;

-- 7. Logs ---------------------------------------------------------------------------
do $$ begin
  if pg_temp.reset_policies('activity_log') then
    create policy "staff read"  on public.activity_log for select to authenticated using (public.is_staff());
    create policy "insert"      on public.activity_log for insert to authenticated with check (true);
  end if;
  if pg_temp.reset_policies('notification_log') then
    create policy "staff read"  on public.notification_log for select to authenticated using (public.is_staff());
    create policy "insert"      on public.notification_log for insert to authenticated with check (true);
  end if;
  if pg_temp.reset_policies('notification_preferences') then
    create policy "own or admin" on public.notification_preferences for all to authenticated
      using (user_id = auth.uid()::text or public.is_admin()) with check (user_id = auth.uid()::text or public.is_admin());
  end if;
end $$;

-- 8. Profiles (user accounts) ------------------------------------------------------
--   Everyone logged in can see staff names (for comments and assignments) and
--   their own profile. Only admins change roles or franchise links.
do $$ begin
  if pg_temp.reset_policies('profiles') then
    create policy "read" on public.profiles for select to authenticated
      using (public.is_staff() or id = auth.uid() or role in ('admin','sales'));
    create policy "insert self or admin" on public.profiles for insert to authenticated
      with check (public.is_admin() or id = auth.uid());
    create policy "update self or admin" on public.profiles for update to authenticated
      using (public.is_admin() or id = auth.uid()) with check (public.is_admin() or id = auth.uid());
    create policy "admin delete" on public.profiles for delete to authenticated using (public.is_admin());
  end if;
end $$;

-- A user editing their own profile cannot change their role or franchise link,
-- and a self-created profile always starts as the lowest role.
create or replace function public.protect_profile_role() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  -- service key (edge functions, SQL editor) and admins may do anything
  if auth.uid() is null or public.is_admin() then return new; end if;
  if tg_op = 'INSERT' then
    new.role := 'franchisee';
    new.franchisee_id := null;
  else
    new.role := old.role;
    new.franchisee_id := old.franchisee_id;
  end if;
  return new;
end $$;

drop trigger if exists protect_profile_role on public.profiles;
create trigger protect_profile_role before insert or update on public.profiles
  for each row execute function public.protect_profile_role();

-- 9. Check: no open rule left on the tables above ----------------------------------
do $$
declare n int;
begin
  select count(*) into n from pg_policies
   where schemaname = 'public'
     and (qual = 'true' or with_check = 'true')
     and cmd <> 'SELECT' and cmd <> 'INSERT'
     and tablename in ('leads','lead_interactions','franchisees','documents','task_uploads','task_progress',
                       'task_comments','franchise_applications','signature_requests','email_templates','profiles');
  if n > 0 then raise exception 'Aborting, nothing changed: % open write rule(s) still present', n; end if;
end $$;

commit;

-- To see the result:
--   select tablename, policyname, cmd, roles, qual, with_check from pg_policies where schemaname='public' order by 1,2;
