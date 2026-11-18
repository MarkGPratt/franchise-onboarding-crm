-- ============================================================================
-- Marketing Programme — franchisee local marketing plan, prospects, activity log
-- and Head Office assessment.
-- Run once in the Supabase SQL Editor (project ufruegziwzfduucphtyf).
-- Safe to run twice: everything uses IF NOT EXISTS / DROP ... IF EXISTS.
--
-- Access rules
--   * Staff (admin / sales) can read and write every franchisee's marketing data.
--   * A franchisee user can only read and write rows for their own franchisee_id.
--   * Head Office reviews: franchisees can read their own, only staff can write.
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Monthly plan: budget and targets per franchisee per month
-- ---------------------------------------------------------------------------
create table if not exists public.mkt_plans (
  id              uuid primary key default gen_random_uuid(),
  franchisee_id   text not null references public.franchisees(id) on delete cascade,
  month           date not null,                    -- always the 1st of the month
  budget          numeric(12,2) not null default 0, -- local marketing budget excl. national marketing levy
  google_ads_budget numeric(12,2) not null default 0,
  targets         jsonb not null default '{}'::jsonb,
  focus           text,                              -- what this month is about (e.g. "Pre-summer aircon services")
  notes           text,
  updated_by      text,
  updated_at      timestamptz not null default now(),
  unique (franchisee_id, month)
);

-- ---------------------------------------------------------------------------
-- 2. Foundations: one row per completed set-up item (keys live in the app)
-- ---------------------------------------------------------------------------
create table if not exists public.mkt_setup_items (
  franchisee_id   text not null references public.franchisees(id) on delete cascade,
  item_key        text not null,
  done            boolean not null default false,
  done_at         timestamptz,
  evidence        text,                              -- link or short note (e.g. GBP URL)
  updated_by      text,
  primary key (franchisee_id, item_key)
);

-- ---------------------------------------------------------------------------
-- 3. Prospects: commercial and referral-partner targets to meet
-- ---------------------------------------------------------------------------
create table if not exists public.mkt_prospects (
  id              uuid primary key default gen_random_uuid(),
  franchisee_id   text not null references public.franchisees(id) on delete cascade,
  business_name   text not null,
  segment         text not null default 'other',
  contact_name    text,
  contact_role    text,
  phone           text,
  email           text,
  suburb          text,
  address         text,
  source          text,                              -- how we found them
  stage           text not null default 'identified'
                  check (stage in ('identified','contacted','info_sent','meeting_booked','met','proposal','won','lost')),
  priority        text not null default 'M' check (priority in ('H','M','L')),
  est_annual_value numeric(12,2) default 0,
  next_action     text,
  next_action_date date,
  meeting_at      timestamptz,
  last_contact_date date,
  popia_consent   boolean not null default false,    -- agreed to receive our marketing
  popia_consent_at timestamptz,
  lost_reason     text,
  won_at          timestamptz,
  notes           text,
  created_by      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists mkt_prospects_fr_idx on public.mkt_prospects(franchisee_id, stage);
create index if not exists mkt_prospects_next_idx on public.mkt_prospects(franchisee_id, next_action_date);

-- ---------------------------------------------------------------------------
-- 4. Activity log: every marketing action, with cost and results
-- ---------------------------------------------------------------------------
create table if not exists public.mkt_activities (
  id              uuid primary key default gen_random_uuid(),
  franchisee_id   text not null references public.franchisees(id) on delete cascade,
  prospect_id     uuid references public.mkt_prospects(id) on delete set null,
  activity_date   date not null default current_date,
  channel         text not null,                     -- key from the channel catalogue
  activity_type   text not null,                     -- meeting, call, info_sent, post, review_request ...
  description     text,
  quantity        integer not null default 1,        -- e.g. 12 review requests, 3 posts
  cost            numeric(12,2) not null default 0,
  leads           integer not null default 0,
  jobs_won        integer not null default 0,
  revenue         numeric(12,2) not null default 0,
  created_by      text,
  created_at      timestamptz not null default now()
);
create index if not exists mkt_activities_fr_idx on public.mkt_activities(franchisee_id, activity_date);
create index if not exists mkt_activities_pr_idx on public.mkt_activities(prospect_id);

-- ---------------------------------------------------------------------------
-- 5. Head Office monthly assessment
-- ---------------------------------------------------------------------------
create table if not exists public.mkt_reviews (
  id              uuid primary key default gen_random_uuid(),
  franchisee_id   text not null references public.franchisees(id) on delete cascade,
  month           date not null,
  system_score    integer,                           -- score the app calculated at review time
  ho_rating       text check (ho_rating in ('on_track','needs_attention','at_risk')),
  comment         text,
  actions         text,                              -- what the franchisee must do next month
  reviewed_by     text,
  reviewed_at     timestamptz not null default now(),
  unique (franchisee_id, month)
);

-- ---------------------------------------------------------------------------
-- 6. Row-level security
-- ---------------------------------------------------------------------------
alter table public.mkt_plans        enable row level security;
alter table public.mkt_setup_items  enable row level security;
alter table public.mkt_prospects    enable row level security;
alter table public.mkt_activities   enable row level security;
alter table public.mkt_reviews      enable row level security;

do $$
declare t text;
begin
  foreach t in array array['mkt_plans','mkt_setup_items','mkt_prospects','mkt_activities'] loop
    execute format('drop policy if exists "%1$s staff or own" on public.%1$I', t);
    execute format(
      'create policy "%1$s staff or own" on public.%1$I for all to authenticated
         using (public.is_staff() or franchisee_id = public.my_franchisee_id())
         with check (public.is_staff() or franchisee_id = public.my_franchisee_id())', t);
  end loop;
end $$;

drop policy if exists "mkt_reviews read" on public.mkt_reviews;
drop policy if exists "mkt_reviews write" on public.mkt_reviews;
create policy "mkt_reviews read" on public.mkt_reviews for select to authenticated
  using (public.is_staff() or franchisee_id = public.my_franchisee_id());
create policy "mkt_reviews write" on public.mkt_reviews for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- Keep updated_at honest
create or replace function public.mkt_touch_updated_at() returns trigger
language plpgsql as $$ begin new.updated_at := now(); return new; end $$;

drop trigger if exists mkt_prospects_touch on public.mkt_prospects;
create trigger mkt_prospects_touch before update on public.mkt_prospects
  for each row execute function public.mkt_touch_updated_at();
drop trigger if exists mkt_plans_touch on public.mkt_plans;
create trigger mkt_plans_touch before update on public.mkt_plans
  for each row execute function public.mkt_touch_updated_at();

commit;

-- ============================================================================
-- CHECK after running:
--   select tablename, rowsecurity from pg_tables where tablename like 'mkt\_%';
--   -- all five should show rowsecurity = true
-- ============================================================================
