-- ============================================================================
-- Franchisee portal: monthly turnover declarations, performance history,
-- Head Office orders (invoice books, clothing, ...).
-- Run AFTER security_franchisee_access.sql. Safe to re-run.
-- ============================================================================

begin;

-- 1. Royalty and marketing levy rates per franchisee --------------------------
alter table public.franchisees add column if not exists royalty_pct        numeric(5,2);
alter table public.franchisees add column if not exists marketing_levy_pct numeric(5,2);
alter table public.franchisees add column if not exists trading_since      date;

-- 2. Monthly turnover declarations ----------------------------------------------
-- One per franchisee per month. lines = [{division, turnover_excl, jobs}].
-- Totals, rates and amounts are worked out by the database (trigger below),
-- so what is stored always matches the lines and the rates at the time.
create table if not exists public.turnover_declarations (
  id               uuid primary key default gen_random_uuid(),
  franchisee_id    text not null references public.franchisees(id) on delete cascade,
  period           date not null check (extract(day from period) = 1),
  lines            jsonb not null default '[]'::jsonb,
  turnover_excl    numeric(14,2) not null default 0,
  jobs             integer not null default 0,
  royalty_pct      numeric(5,2),
  marketing_levy_pct numeric(5,2),
  royalty_amount   numeric(14,2) not null default 0,
  levy_amount      numeric(14,2) not null default 0,
  notes            text,
  status           text not null default 'draft' check (status in ('draft','submitted','queried','approved')),
  submitted_by     text,
  submitted_at     timestamptz,
  reviewed_by      text,
  reviewed_at      timestamptz,
  review_note      text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (franchisee_id, period)
);
create index if not exists turnover_declarations_period_idx on public.turnover_declarations(period);

create or replace function public.turnover_declaration_calc() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  f public.franchisees;
  staff boolean := auth.uid() is null or public.is_staff();
begin
  -- Franchisees may only edit a draft or a queried declaration, and may only
  -- move it to draft or submitted. Staff do the reviewing.
  if not staff then
    if tg_op = 'UPDATE' and old.status not in ('draft','queried') then
      raise exception 'This declaration has been submitted and can no longer be changed. Contact Head Office.';
    end if;
    if new.status not in ('draft','submitted') then
      raise exception 'Not allowed';
    end if;
    new.reviewed_by := case when tg_op = 'UPDATE' then old.reviewed_by end;
    new.reviewed_at := case when tg_op = 'UPDATE' then old.reviewed_at end;
    new.review_note := case when tg_op = 'UPDATE' then old.review_note end;
    if new.period > date_trunc('month', now() at time zone 'Africa/Johannesburg')::date then
      raise exception 'You cannot declare a month that has not started yet.';
    end if;
  end if;

  select * into f from public.franchisees where id = new.franchisee_id;
  -- rates: keep the rate already on the declaration once submitted; otherwise use the franchisee's current rate
  if new.status = 'draft' or new.royalty_pct is null then new.royalty_pct := f.royalty_pct; end if;
  if new.status = 'draft' or new.marketing_levy_pct is null then new.marketing_levy_pct := f.marketing_levy_pct; end if;

  select coalesce(sum(greatest(coalesce((l->>'turnover_excl')::numeric, 0), 0)), 0),
         coalesce(sum(greatest(coalesce((l->>'jobs')::int, 0), 0)), 0)
    into new.turnover_excl, new.jobs
    from jsonb_array_elements(coalesce(new.lines, '[]'::jsonb)) l;

  new.royalty_amount := round(new.turnover_excl * coalesce(new.royalty_pct, 0) / 100, 2);
  new.levy_amount    := round(new.turnover_excl * coalesce(new.marketing_levy_pct, 0) / 100, 2);
  if new.status = 'submitted' and (tg_op = 'INSERT' or old.status is distinct from 'submitted') then
    new.submitted_at := now();
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists turnover_declaration_calc on public.turnover_declarations;
create trigger turnover_declaration_calc before insert or update on public.turnover_declarations
  for each row execute function public.turnover_declaration_calc();

alter table public.turnover_declarations enable row level security;
drop policy if exists "staff all" on public.turnover_declarations;
drop policy if exists "own read" on public.turnover_declarations;
drop policy if exists "own write" on public.turnover_declarations;
drop policy if exists "own update" on public.turnover_declarations;
create policy "staff all"  on public.turnover_declarations for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "own read"   on public.turnover_declarations for select to authenticated using (franchisee_id = public.my_franchisee_id());
create policy "own write"  on public.turnover_declarations for insert to authenticated with check (franchisee_id = public.my_franchisee_id());
create policy "own update" on public.turnover_declarations for update to authenticated
  using (franchisee_id = public.my_franchisee_id()) with check (franchisee_id = public.my_franchisee_id());

-- 3. Performance history (imported from Franchisee Stats) ----------------------
-- Keyed by territory as it appears in the old spreadsheet. Head Office links a
-- territory to the current franchisee from a start month (Performance page);
-- a franchisee sees only the rows linked to them.
create table if not exists public.performance_history (
  id               bigserial primary key,
  territory_label  text not null,
  period           date not null check (extract(day from period) = 1),
  turnover_incl    numeric(14,2),
  turnover_excl    numeric(14,2),
  jobs             integer,
  franchisee_id    text references public.franchisees(id) on delete set null,
  source           text not null default 'Franchisee Stats spreadsheet',
  unique (territory_label, period)
);
create index if not exists performance_history_franchisee_idx on public.performance_history(franchisee_id, period);

alter table public.performance_history enable row level security;
drop policy if exists "staff all" on public.performance_history;
drop policy if exists "own read" on public.performance_history;
create policy "staff all" on public.performance_history for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "own read"  on public.performance_history for select to authenticated using (franchisee_id is not null and franchisee_id = public.my_franchisee_id());

-- Link (or unlink) a territory's history to a franchisee from a start month. Staff only.
create or replace function public.link_performance_history(p_label text, p_franchisee text, p_from date)
returns integer language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if not public.is_staff() then raise exception 'Not allowed'; end if;
  update public.performance_history set franchisee_id = null where territory_label = p_label;
  if p_franchisee is null or p_franchisee = '' then return 0; end if;
  update public.performance_history set franchisee_id = p_franchisee
   where territory_label = p_label and period >= date_trunc('month', coalesce(p_from, '1900-01-01'::date))::date;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.link_performance_history(text, text, date) from public;
grant execute on function public.link_performance_history(text, text, date) to authenticated;

-- 4. Head Office order catalogue and orders -------------------------------------
create table if not exists public.order_catalogue (
  id          uuid primary key default gen_random_uuid(),
  category    text not null default 'Stationery',
  name        text not null,
  description text,
  unit        text not null default 'each',
  price_excl  numeric(12,2),
  sizes       text[] not null default '{}',
  division    text,              -- null = all divisions
  active      boolean not null default true,
  position    integer not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists public.orders (
  id            uuid primary key default gen_random_uuid(),
  order_no      bigserial,
  franchisee_id text not null references public.franchisees(id) on delete cascade,
  items         jsonb not null default '[]'::jsonb,  -- [{item_id, name, size, unit, qty, unit_price}]
  total_excl    numeric(14,2) not null default 0,
  notes         text,
  status        text not null default 'submitted' check (status in ('submitted','processing','invoiced','dispatched','delivered','cancelled')),
  ordered_by    text,
  created_at    timestamptz not null default now(),
  ho_note       text,
  updated_by    text,
  updated_at    timestamptz not null default now()
);
create index if not exists orders_franchisee_idx on public.orders(franchisee_id, created_at desc);

-- Prices come from the catalogue, not from the browser; franchisees can only cancel a new order
create or replace function public.order_calc() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  staff boolean := auth.uid() is null or public.is_staff();
  fixed jsonb := '[]'::jsonb; l jsonb; c public.order_catalogue; total numeric := 0;
begin
  if not staff then
    if tg_op = 'UPDATE' then
      if old.status <> 'submitted' or new.status <> 'cancelled' then
        raise exception 'Head Office is already processing this order. Contact them to change it.';
      end if;
      new.items := old.items; new.total_excl := old.total_excl; new.ho_note := old.ho_note;
      new.updated_at := now();
      return new;
    end if;
    new.status := 'submitted'; new.ho_note := null;
  end if;
  if tg_op = 'INSERT' or new.items is distinct from old.items then
    for l in select * from jsonb_array_elements(coalesce(new.items, '[]'::jsonb)) loop
      select * into c from public.order_catalogue where id = (l->>'item_id')::uuid;
      if c.id is null or (not staff and not c.active) then raise exception 'An item on this order is no longer available'; end if;
      if coalesce((l->>'qty')::int, 0) <= 0 then continue; end if;
      fixed := fixed || jsonb_build_object('item_id', c.id, 'name', c.name, 'unit', c.unit,
        'size', nullif(l->>'size', ''), 'qty', (l->>'qty')::int, 'unit_price', c.price_excl);
      total := total + coalesce(c.price_excl, 0) * (l->>'qty')::int;
    end loop;
    if jsonb_array_length(fixed) = 0 then raise exception 'The order has no items'; end if;
    new.items := fixed; new.total_excl := total;
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists order_calc on public.orders;
create trigger order_calc before insert or update on public.orders
  for each row execute function public.order_calc();

alter table public.order_catalogue enable row level security;
alter table public.orders enable row level security;
drop policy if exists "read" on public.order_catalogue;
drop policy if exists "staff write" on public.order_catalogue;
create policy "read"        on public.order_catalogue for select to authenticated using (true);
create policy "staff write" on public.order_catalogue for all to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists "staff all" on public.orders;
drop policy if exists "own read" on public.orders;
drop policy if exists "own insert" on public.orders;
drop policy if exists "own update" on public.orders;
create policy "staff all"  on public.orders for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "own read"   on public.orders for select to authenticated using (franchisee_id = public.my_franchisee_id());
create policy "own insert" on public.orders for insert to authenticated with check (franchisee_id = public.my_franchisee_id());
create policy "own update" on public.orders for update to authenticated
  using (franchisee_id = public.my_franchisee_id()) with check (franchisee_id = public.my_franchisee_id());

-- Starter catalogue (no prices yet: set them on the Orders page > Catalogue)
insert into public.order_catalogue (category, name, unit, sizes, position)
select * from (values
  ('Stationery', 'Invoice book (carbonised, numbered)', 'book', '{}'::text[], 10),
  ('Stationery', 'Quotation book', 'book', '{}'::text[], 20),
  ('Stationery', 'Job card book', 'book', '{}'::text[], 30),
  ('Stationery', 'Delivery note book', 'book', '{}'::text[], 40),
  ('Stationery', 'Business cards (box of 500)', 'box', '{}'::text[], 50),
  ('Clothing', 'Golf shirt (branded)', 'each', '{XS,S,M,L,XL,2XL,3XL}'::text[], 110),
  ('Clothing', 'Work shirt, long sleeve (branded)', 'each', '{S,M,L,XL,2XL,3XL}'::text[], 120),
  ('Clothing', 'Work trousers', 'each', '{28,30,32,34,36,38,40,42,44}'::text[], 130),
  ('Clothing', 'Overall / boiler suit (branded)', 'each', '{S,M,L,XL,2XL,3XL}'::text[], 140),
  ('Clothing', 'Rain / winter jacket (branded)', 'each', '{S,M,L,XL,2XL,3XL}'::text[], 150),
  ('Clothing', 'Cap (branded)', 'each', '{}'::text[], 160),
  ('Clothing', 'Shoe covers / slippers (pack)', 'pack', '{}'::text[], 170),
  ('Marketing', 'Fridge magnets (pack of 100)', 'pack', '{}'::text[], 210),
  ('Marketing', 'Flyers (pack of 500)', 'pack', '{}'::text[], 220),
  ('Marketing', 'Vehicle magnetic signs (pair)', 'pair', '{}'::text[], 230),
  ('Marketing', 'Service stickers (roll)', 'roll', '{}'::text[], 240)
) v(category, name, unit, sizes, position)
where not exists (select 1 from public.order_catalogue);

-- 5. Email templates -----------------------------------------------------------
insert into public.email_templates (event_type, name, subject, body, enabled)
select 'declaration_submitted', 'Turnover declaration submitted (to staff)',
       'Turnover declared: {{franchisee_name}}, {{period}}',
       E'Hi {{recipient_name}},\n\n{{franchisee_name}} has declared turnover for {{period}}:\n\nTurnover (excl. VAT): {{turnover}}\nJobs: {{jobs}}\nRoyalty: {{royalty}}\nMarketing levy: {{levy}}\n\nReview it in the portal under Declarations:\n{{app_url}}', true
where not exists (select 1 from public.email_templates where event_type = 'declaration_submitted');

insert into public.email_templates (event_type, name, subject, body, enabled)
select 'order_submitted', 'Order placed (to staff)',
       'New order #{{order_no}}: {{franchisee_name}}',
       E'Hi {{recipient_name}},\n\n{{franchisee_name}} has placed order #{{order_no}}:\n\n{{items}}\n\nTotal (excl. VAT): {{total}}\nNotes: {{notes}}\n\nProcess it in the portal under Orders:\n{{app_url}}', true
where not exists (select 1 from public.email_templates where event_type = 'order_submitted');

commit;
