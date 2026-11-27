-- ============================================================================
-- The Surgeon Group — Franchisee Portal: Franchisee Contact Log (Head Office)
--
-- Louis, Ian and Estelle log every call / meeting with a franchisee: what was
-- discussed, how the franchisee is doing, and action points with an owner and
-- a due date. Head Office standard: at least 2 contacts per franchisee per
-- calendar month. Mark (admin) sees coverage and staff stats.
--
-- Who can see it: staff only (profiles.role 'admin' or 'sales').
-- Franchisees cannot see these notes.
--   - Any staff member can log a contact and add / close action points.
--   - Only the person who logged a contact, or an admin, can edit it.
--   - Only an admin can delete.
--
-- Run in the Supabase SQL Editor AFTER security_franchisee_access.sql.
-- Safe to re-run. Rollback at the bottom.
-- ============================================================================

BEGIN;

-- 0. Settings ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contact_log_settings (
  id                    int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  min_contacts_per_month int NOT NULL DEFAULT 2
);
INSERT INTO contact_log_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- 1. Staff check (runs as owner so it can read profiles regardless of RLS) ------
CREATE OR REPLACE FUNCTION is_contact_log_staff() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','sales'))
$$;

CREATE OR REPLACE FUNCTION is_contact_log_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
$$;

-- 2. Tables (franchisee_id takes the same type as franchisees.id) ---------------
DO $$
DECLARE fr_type text;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod) INTO fr_type
    FROM pg_attribute a
   WHERE a.attrelid = 'public.franchisees'::regclass AND a.attname = 'id' AND NOT a.attisdropped;
  IF fr_type IS NULL THEN
    RAISE EXCEPTION 'Aborting, nothing changed: franchisees.id not found';
  END IF;

  EXECUTE format($f$
    CREATE TABLE IF NOT EXISTS franchisee_contacts (
      id             bigserial PRIMARY KEY,
      franchisee_id  %s NOT NULL REFERENCES franchisees(id) ON DELETE CASCADE,
      contact_at     timestamptz NOT NULL DEFAULT now(),
      contact_type   text NOT NULL DEFAULT 'phone'
                     CHECK (contact_type IN ('phone','whatsapp','video','site_visit','office_meeting','email')),
      direction      text NOT NULL DEFAULT 'outgoing' CHECK (direction IN ('outgoing','incoming')),
      spoke_to       text,
      duration_min   int CHECK (duration_min IS NULL OR duration_min BETWEEN 0 AND 600),
      topics         text[] NOT NULL DEFAULT '{}',
      summary        text NOT NULL CHECK (length(trim(summary)) > 0),
      status_rag     text CHECK (status_rag IN ('green','amber','red')),
      next_contact_on date,
      logged_by      uuid NOT NULL DEFAULT auth.uid(),
      logged_by_name text,
      created_at     timestamptz NOT NULL DEFAULT now(),
      updated_at     timestamptz NOT NULL DEFAULT now()
    )$f$, fr_type);

  EXECUTE format($f$
    CREATE TABLE IF NOT EXISTS franchisee_contact_actions (
      id             bigserial PRIMARY KEY,
      contact_id     bigint NOT NULL REFERENCES franchisee_contacts(id) ON DELETE CASCADE,
      franchisee_id  %s NOT NULL REFERENCES franchisees(id) ON DELETE CASCADE,
      action         text NOT NULL CHECK (length(trim(action)) > 0),
      owner_side     text NOT NULL DEFAULT 'head_office' CHECK (owner_side IN ('head_office','franchisee')),
      owner_name     text,
      due_on         date,
      status         text NOT NULL DEFAULT 'open' CHECK (status IN ('open','done','cancelled')),
      done_at        timestamptz,
      done_by_name   text,
      close_note     text,
      created_at     timestamptz NOT NULL DEFAULT now(),
      updated_at     timestamptz NOT NULL DEFAULT now()
    )$f$, fr_type);
END $$;

-- Allowed topics (kept in one place so the form and the stats agree)
ALTER TABLE franchisee_contacts DROP CONSTRAINT IF EXISTS franchisee_contacts_topics_check;
ALTER TABLE franchisee_contacts ADD CONSTRAINT franchisee_contacts_topics_check CHECK (
  topics <@ ARRAY['sales_performance','declarations_royalties','marketing','operations_quality',
                  'complaints','debtors','staffing','training','compliance','eworks_systems',
                  'orders_supplies','territory_leads','support_request','personal_wellbeing','other']::text[]);

CREATE INDEX IF NOT EXISTS franchisee_contacts_fr_at ON franchisee_contacts (franchisee_id, contact_at DESC);
CREATE INDEX IF NOT EXISTS franchisee_contacts_by    ON franchisee_contacts (logged_by, contact_at DESC);
CREATE INDEX IF NOT EXISTS franchisee_contact_actions_open ON franchisee_contact_actions (franchisee_id) WHERE status = 'open';

-- 3. Triggers ------------------------------------------------------------------
-- Logger name filled from the profile; logged_by cannot be faked or changed.
CREATE OR REPLACE FUNCTION franchisee_contacts_stamp() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.logged_by := coalesce(auth.uid(), NEW.logged_by);
    IF NEW.logged_by_name IS NULL THEN
      SELECT coalesce(nullif(to_jsonb(p)->>'full_name',''), to_jsonb(p)->>'email')
        INTO NEW.logged_by_name FROM profiles p WHERE p.id = NEW.logged_by;
    END IF;
  ELSE
    NEW.logged_by := OLD.logged_by;
    NEW.logged_by_name := OLD.logged_by_name;
    NEW.created_at := OLD.created_at;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS franchisee_contacts_stamp ON franchisee_contacts;
CREATE TRIGGER franchisee_contacts_stamp BEFORE INSERT OR UPDATE ON franchisee_contacts
  FOR EACH ROW EXECUTE FUNCTION franchisee_contacts_stamp();

-- Action keeps the franchisee of its contact; done_at set / cleared with status.
CREATE OR REPLACE FUNCTION franchisee_contact_actions_stamp() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  SELECT franchisee_id INTO NEW.franchisee_id FROM franchisee_contacts WHERE id = NEW.contact_id;
  IF NEW.status = 'done' AND (TG_OP = 'INSERT' OR OLD.status <> 'done') THEN
    NEW.done_at := now();
    IF NEW.done_by_name IS NULL THEN
      SELECT coalesce(nullif(to_jsonb(p)->>'full_name',''), to_jsonb(p)->>'email')
        INTO NEW.done_by_name FROM profiles p WHERE p.id = auth.uid();
    END IF;
  ELSIF NEW.status <> 'done' THEN
    NEW.done_at := NULL;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS franchisee_contact_actions_stamp ON franchisee_contact_actions;
CREATE TRIGGER franchisee_contact_actions_stamp BEFORE INSERT OR UPDATE ON franchisee_contact_actions
  FOR EACH ROW EXECUTE FUNCTION franchisee_contact_actions_stamp();

-- 4. Access rules --------------------------------------------------------------
ALTER TABLE franchisee_contacts        ENABLE ROW LEVEL SECURITY;
ALTER TABLE franchisee_contact_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_log_settings       ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fc_staff_read   ON franchisee_contacts;
DROP POLICY IF EXISTS fc_staff_insert ON franchisee_contacts;
DROP POLICY IF EXISTS fc_own_update   ON franchisee_contacts;
DROP POLICY IF EXISTS fc_admin_delete ON franchisee_contacts;
CREATE POLICY fc_staff_read   ON franchisee_contacts FOR SELECT TO authenticated USING (is_contact_log_staff());
CREATE POLICY fc_staff_insert ON franchisee_contacts FOR INSERT TO authenticated WITH CHECK (is_contact_log_staff());
CREATE POLICY fc_own_update   ON franchisee_contacts FOR UPDATE TO authenticated
  USING (is_contact_log_admin() OR (is_contact_log_staff() AND logged_by = auth.uid()))
  WITH CHECK (is_contact_log_staff());
CREATE POLICY fc_admin_delete ON franchisee_contacts FOR DELETE TO authenticated USING (is_contact_log_admin());

DROP POLICY IF EXISTS fca_staff_all   ON franchisee_contact_actions;
DROP POLICY IF EXISTS fca_staff_read  ON franchisee_contact_actions;
DROP POLICY IF EXISTS fca_staff_write ON franchisee_contact_actions;
DROP POLICY IF EXISTS fca_staff_upd   ON franchisee_contact_actions;
DROP POLICY IF EXISTS fca_admin_del   ON franchisee_contact_actions;
CREATE POLICY fca_staff_read  ON franchisee_contact_actions FOR SELECT TO authenticated USING (is_contact_log_staff());
CREATE POLICY fca_staff_write ON franchisee_contact_actions FOR INSERT TO authenticated WITH CHECK (is_contact_log_staff());
CREATE POLICY fca_staff_upd   ON franchisee_contact_actions FOR UPDATE TO authenticated
  USING (is_contact_log_staff()) WITH CHECK (is_contact_log_staff());
CREATE POLICY fca_admin_del   ON franchisee_contact_actions FOR DELETE TO authenticated USING (is_contact_log_admin());

DROP POLICY IF EXISTS cls_staff_read ON contact_log_settings;
DROP POLICY IF EXISTS cls_admin_upd  ON contact_log_settings;
CREATE POLICY cls_staff_read ON contact_log_settings FOR SELECT TO authenticated USING (is_contact_log_staff());
CREATE POLICY cls_admin_upd  ON contact_log_settings FOR UPDATE TO authenticated
  USING (is_contact_log_admin()) WITH CHECK (is_contact_log_admin());

REVOKE ALL ON franchisee_contacts, franchisee_contact_actions, contact_log_settings FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON franchisee_contacts, franchisee_contact_actions TO authenticated;
GRANT SELECT, UPDATE ON contact_log_settings TO authenticated;
GRANT USAGE ON SEQUENCE franchisee_contacts_id_seq, franchisee_contact_actions_id_seq TO authenticated;

-- 5. Stats (staff only; return nothing for anyone else) --------------------------

-- Coverage per franchisee for one month: are we talking to them twice a month?
--   status: 'met' (>= target), 'on_track' (before the 15th with 0, or after the
--   15th with at least 1), 'behind' (after the 15th with 0, or month over and short)
CREATE OR REPLACE FUNCTION contact_log_coverage(p_month date DEFAULT (now() AT TIME ZONE 'Africa/Johannesburg')::date)
RETURNS TABLE (
  franchisee_id text, contacts int, target int, status text,
  last_contact_at timestamptz, days_since_last int, last_rag text,
  open_actions int, overdue_actions int, staff text
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH m AS (
    SELECT date_trunc('month', p_month)::date AS m0,
           (date_trunc('month', p_month) + interval '1 month')::date AS m1,
           (now() AT TIME ZONE 'Africa/Johannesburg')::date AS today,
           (SELECT min_contacts_per_month FROM contact_log_settings WHERE id = 1) AS tgt
  ), c AS (
    SELECT fc.franchisee_id::text AS fid, count(*)::int AS n,
           string_agg(DISTINCT coalesce(fc.logged_by_name,'?'), ', ') AS staff
      FROM franchisee_contacts fc, m
     WHERE (fc.contact_at AT TIME ZONE 'Africa/Johannesburg')::date >= m.m0
       AND (fc.contact_at AT TIME ZONE 'Africa/Johannesburg')::date <  m.m1
     GROUP BY 1
  ), last AS (
    SELECT DISTINCT ON (franchisee_id) franchisee_id::text AS fid, contact_at, status_rag
      FROM franchisee_contacts ORDER BY franchisee_id, contact_at DESC
  ), a AS (
    SELECT franchisee_id::text AS fid,
           count(*) FILTER (WHERE status = 'open')::int AS open_n,
           count(*) FILTER (WHERE status = 'open' AND due_on < (now() AT TIME ZONE 'Africa/Johannesburg')::date)::int AS overdue_n
      FROM franchisee_contact_actions GROUP BY 1
  )
  SELECT f.id::text, coalesce(c.n,0), m.tgt,
         CASE WHEN coalesce(c.n,0) >= m.tgt THEN 'met'
              WHEN m.today >= m.m1 THEN 'behind'
              WHEN m.today < m.m0 + 14 THEN 'on_track'
              WHEN coalesce(c.n,0) >= 1 THEN 'on_track'
              ELSE 'behind' END,
         last.contact_at,
         CASE WHEN last.contact_at IS NULL THEN NULL
              ELSE (m.today - (last.contact_at AT TIME ZONE 'Africa/Johannesburg')::date) END,
         last.status_rag, coalesce(a.open_n,0), coalesce(a.overdue_n,0), c.staff
    FROM franchisees f CROSS JOIN m
    LEFT JOIN c    ON c.fid = f.id::text
    LEFT JOIN last ON last.fid = f.id::text
    LEFT JOIN a    ON a.fid = f.id::text
   WHERE is_contact_log_staff()
$$;

-- Per staff member per month: contacts logged, franchisees reached, minutes,
-- actions raised and closed.
CREATE OR REPLACE FUNCTION contact_log_staff_stats(p_from date, p_to date)
RETURNS TABLE (
  month date, staff text, contacts int, franchisees_reached int, minutes int,
  actions_raised int, actions_closed int
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH c AS (
    SELECT date_trunc('month', contact_at AT TIME ZONE 'Africa/Johannesburg')::date AS mo,
           coalesce(logged_by_name,'?') AS who, id, franchisee_id, coalesce(duration_min,0) AS mins
      FROM franchisee_contacts
     WHERE (contact_at AT TIME ZONE 'Africa/Johannesburg')::date BETWEEN p_from AND p_to
  ), raised AS (
    SELECT c.mo, c.who, count(*)::int AS n FROM franchisee_contact_actions x JOIN c ON c.id = x.contact_id GROUP BY 1,2
  ), closed AS (
    SELECT date_trunc('month', done_at AT TIME ZONE 'Africa/Johannesburg')::date AS mo,
           coalesce(done_by_name,'?') AS who, count(*)::int AS n
      FROM franchisee_contact_actions
     WHERE status = 'done' AND (done_at AT TIME ZONE 'Africa/Johannesburg')::date BETWEEN p_from AND p_to
     GROUP BY 1,2
  ), base AS (
    SELECT mo, who, count(*)::int AS n, count(DISTINCT franchisee_id)::int AS fr, sum(mins)::int AS mins
      FROM c GROUP BY 1,2
  ), keys AS (SELECT mo, who FROM base UNION SELECT mo, who FROM closed)
  SELECT k.mo, k.who, coalesce(b.n,0), coalesce(b.fr,0), coalesce(b.mins,0),
         coalesce(r.n,0), coalesce(cl.n,0)
    FROM keys k
    LEFT JOIN base b    ON b.mo = k.mo AND b.who = k.who
    LEFT JOIN raised r  ON r.mo = k.mo AND r.who = k.who
    LEFT JOIN closed cl ON cl.mo = k.mo AND cl.who = k.who
   WHERE is_contact_log_staff()
   ORDER BY 1 DESC, 2
$$;

-- Topics raised per month (what franchisees are calling about)
CREATE OR REPLACE FUNCTION contact_log_topic_stats(p_from date, p_to date)
RETURNS TABLE (month date, topic text, mentions int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT date_trunc('month', contact_at AT TIME ZONE 'Africa/Johannesburg')::date, t, count(*)::int
    FROM franchisee_contacts, unnest(topics) AS t
   WHERE (contact_at AT TIME ZONE 'Africa/Johannesburg')::date BETWEEN p_from AND p_to
     AND is_contact_log_staff()
   GROUP BY 1,2 ORDER BY 1 DESC, 3 DESC
$$;

REVOKE ALL ON FUNCTION contact_log_coverage(date), contact_log_staff_stats(date,date),
                       contact_log_topic_stats(date,date) FROM anon, public;
GRANT EXECUTE ON FUNCTION contact_log_coverage(date), contact_log_staff_stats(date,date),
                          contact_log_topic_stats(date,date) TO authenticated;

COMMIT;

-- ============================================================================
-- PORTAL CALLS (supabase-js)
--   Log a call:      from('franchisee_contacts').insert({...}).select().single()
--   Add actions:     from('franchisee_contact_actions').insert([{contact_id, action, owner_side, owner_name, due_on}])
--   Close an action: from('franchisee_contact_actions').update({status:'done', close_note}).eq('id', id)
--   Timeline:        from('franchisee_contacts').select('*, franchisee_contact_actions(*)')
--                      .eq('franchisee_id', id).order('contact_at', {ascending:false})
--   Coverage:        rpc('contact_log_coverage', {p_month:'2026-11-01'})
--   Staff stats:     rpc('contact_log_staff_stats', {p_from:'2026-06-01', p_to:'2026-11-30'})
--   Topics:          rpc('contact_log_topic_stats', {p_from, p_to})
--   Change target:   from('contact_log_settings').update({min_contacts_per_month:3}).eq('id',1)  (admin)
--
-- ROLLBACK:
--   DROP FUNCTION contact_log_topic_stats(date,date), contact_log_staff_stats(date,date), contact_log_coverage(date);
--   DROP TABLE franchisee_contact_actions; DROP TABLE franchisee_contacts; DROP TABLE contact_log_settings;
--   DROP FUNCTION franchisee_contact_actions_stamp(), franchisee_contacts_stamp(),
--                 is_contact_log_admin(), is_contact_log_staff();
-- ============================================================================
