-- ============================================================================
-- The Surgeon Group — Franchisee Portal: Process Flow updates (25 Nov 2026)
--
--   1. Task wording agreed on 25 Nov:
--        2.16  TSG services agreement  -> Head Office services and fees explained (Plan Two)
--        6.1   e-mail addresses issued by Head Office (clause 11.4)
--        6.2   phone numbers listed in the communication media register (clause 18)
--        6.3   WhatsApp on the business number, in the register (clause 18)
--        10.2  Google Business Profile: Head Office owner, franchisee manager (clause 18)
--   2. Process Flow lock, enforced in the database (the portal shows the same rules):
--        a task can be ticked only once the gates of the phases before it are ticked;
--        Phases 5–8 open together behind gate 4.15; Phase 10 also needs 5.17;
--        9.16 needs 6.13; 10.14 needs every task in Phases 0–10; 10.15 needs 10.14.
--        Unticking is always allowed.
--
-- Run after process_flow_v2.sql. Safe to re-run.
-- ============================================================================

begin;

-- 1. Wording ----------------------------------------------------------------------
update public.checklist_tasks
   set text = 'Head Office services and fees explained — what Plan Two Plumbing does for you and the direct costs it recovers (Division Annexure Part E; clause 6.1(f)). See G025',
       responsible = 'franchisor', updated_at = now()
 where section_id = 'ph_02' and text like '%TSG services agreement%';

update public.checklist_tasks
   set text = 'Business email addresses issued by Head Office — they remain franchisor property (clause 11.4)',
       responsible = 'franchisor', updated_at = now()
 where section_id = 'ph_05' and text = 'Business email addresses created';

update public.checklist_tasks
   set text = 'Business telephone line and mobile number active — the numbers customers use are listed in the communication media register and transfer to the franchisor when the agreement ends (clause 18)',
       updated_at = now()
 where section_id = 'ph_05' and text = 'Business telephone line and mobile number active';

update public.checklist_tasks
   set text = 'Business WhatsApp account registered on the business number and listed in the communication media register (clause 18)',
       updated_at = now()
 where section_id = 'ph_05' and text = 'Business WhatsApp account and number registered';

update public.checklist_tasks
   set text = 'Google Business Profile created and verified — Head Office is the owner and the franchisee is added as a manager (clause 18)',
       updated_at = now()
 where section_id = 'ph_09' and text = 'Google Business Profile created and verified';

-- 2. Lock ---------------------------------------------------------------------------
create or replace function public.process_flow_needs(p_section text) returns text[]
language sql immutable as $$
  select case p_section
    when 'ph_02'   then array['ph_01']
    when 'ph_cond' then array['ph_01','ph_02']
    when 'ph_03'   then array['ph_01','ph_02','ph_cond']
    when 'ph_04'   then array['ph_01','ph_02','ph_cond','ph_03']
    when 'ph_05'   then array['ph_01','ph_02','ph_cond','ph_03']
    when 'ph_06'   then array['ph_01','ph_02','ph_cond','ph_03']
    when 'ph_07'   then array['ph_01','ph_02','ph_cond','ph_03']
    when 'ph_08'   then array['ph_01','ph_02','ph_cond','ph_03']
    when 'ph_09'   then array['ph_01','ph_02','ph_cond','ph_03','ph_04']
    when 'ph_10'   then array['ph_01','ph_02','ph_cond','ph_03','ph_04','ph_05','ph_06','ph_07','ph_08','ph_09']
    else array[]::text[] end
$$;

create or replace function public.process_flow_lock() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_section text; v_text text; v_sub boolean := false;
  v_needs text[]; v_missing text; v_open int; v_cc text;
begin
  if not new.completed or (tg_op = 'UPDATE' and old.completed) then return new; end if;

  select section_id, text into v_section, v_text from checklist_tasks where id = new.task_id;
  if v_section is null then
    select t.section_id, t.text into v_section, v_text
      from checklist_subtasks s join checklist_tasks t on t.id = s.task_id where s.id = new.task_id;
    v_sub := true;
  end if;
  if v_section is null then return new; end if;

  v_needs := process_flow_needs(v_section);
  if not v_sub and v_text ~* '^\s*\[GATE\].*Technician and staff training signed off' then
    v_needs := v_needs || array['ph_05'];
  end if;

  select string_agg(regexp_replace(t.text, '\[(GATE|PROOF)\]\s*', '', 'g'), '; ' order by s.position, t.position)
    into v_missing
    from checklist_tasks t join checklist_sections s on s.id = t.section_id
   where t.section_id = any(v_needs) and t.text ~* '^\s*\[GATE\]'
     and not exists (select 1 from task_progress p
                      where p.franchisee_id = new.franchisee_id and p.task_id = t.id and p.completed);
  if v_missing is not null then
    raise exception 'Locked until: %', left(v_missing, 300);
  end if;

  if not v_sub and v_text ~* '^\s*\[GATE\]\s*(\[PROOF\]\s*)?Training course complete' then
    select count(*) into v_open
      from checklist_tasks t
     where t.section_id = any(array['ph_00','ph_01','ph_02','ph_cond','ph_03','ph_04','ph_05','ph_06','ph_07','ph_08','ph_09'])
       and t.id <> new.task_id
       and t.text !~* '^\s*\[GATE\]\s*(\[PROOF\]\s*)?Launch readiness review'
       and not exists (select 1 from task_progress p
                        where p.franchisee_id = new.franchisee_id and p.task_id = t.id and p.completed);
    if v_open > 0 then
      raise exception 'Locked until every task in Phases 0–10 is ticked (% still open)', v_open;
    end if;
  end if;

  if not v_sub and v_text ~* '^\s*\[GATE\]\s*(\[PROOF\]\s*)?Launch readiness review' then
    select t.id into v_cc from checklist_tasks t
     where t.text ~* '^\s*\[GATE\]\s*(\[PROOF\]\s*)?Training course complete' limit 1;
    if v_cc is not null and not exists (select 1 from task_progress p
        where p.franchisee_id = new.franchisee_id and p.task_id = v_cc and p.completed) then
      raise exception 'Locked until: Training course complete (10.14)';
    end if;
  end if;

  return new;
end $$;

drop trigger if exists process_flow_lock on public.task_progress;
create trigger process_flow_lock before insert or update on public.task_progress
  for each row execute function public.process_flow_lock();

commit;

-- To switch the lock off again:  drop trigger process_flow_lock on public.task_progress;
