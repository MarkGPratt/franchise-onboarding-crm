-- ============================================================================
-- The Surgeon Group — Franchisee Portal: Drain Surgeon smalls catalogue (2026)
--
--   * Adds a stock code to every catalogue item (shown to franchisees, on orders
--     and in the order email).
--   * Adds an "order emails go to" setting, starting with estelle@drainsurgeon.co.za.
--     Admins change it on Orders > Catalogue & prices.
--   * Removes the 16 unpriced starter items and loads the 43 items from
--     "Smalls Price List of Drain Surgeon 2026" (Sheet1), prices excl. VAT.
--     Magnets, Managers shirts and Odour mask 25L have no code yet; the duplicate
--     codes 10025 and 10028 are kept on SW77 and Quotation book. Fix them on the
--     Catalogue tab.
--
-- Run AFTER franchisee_portal.sql. Safe to re-run: items are added only if an
-- item with the same name is not already there, so edits made in the portal stay.
-- ============================================================================

begin;

-- 1. Stock code -------------------------------------------------------------------
alter table public.order_catalogue add column if not exists code text;

-- 2. Who order emails go to --------------------------------------------------------
create table if not exists public.order_settings (
  id            integer primary key default 1 check (id = 1),
  notify_emails text[] not null default '{}'
);
insert into public.order_settings (id, notify_emails)
values (1, array['estelle@drainsurgeon.co.za'])
on conflict (id) do nothing;

alter table public.order_settings enable row level security;
drop policy if exists "read" on public.order_settings;
drop policy if exists "admin write" on public.order_settings;
create policy "read"        on public.order_settings for select to authenticated using (true);
create policy "admin write" on public.order_settings for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
revoke all on public.order_settings from anon;
grant select, update on public.order_settings to authenticated;

-- 3. Orders keep the stock code of each line -------------------------------------
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
      fixed := fixed || jsonb_build_object('item_id', c.id, 'code', c.code, 'name', c.name, 'unit', c.unit,
        'size', nullif(l->>'size', ''), 'qty', (l->>'qty')::int, 'unit_price', c.price_excl);
      total := total + coalesce(c.price_excl, 0) * (l->>'qty')::int;
    end loop;
    if jsonb_array_length(fixed) = 0 then raise exception 'The order has no items'; end if;
    new.items := fixed; new.total_excl := total;
  end if;
  new.updated_at := now();
  return new;
end $$;

-- 4. Remove the unpriced starter items (any already on an order are hidden instead)
with starter(name) as (values
  ('Invoice book (carbonised, numbered)'), ('Quotation book'), ('Job card book'), ('Delivery note book'),
  ('Business cards (box of 500)'), ('Golf shirt (branded)'), ('Work shirt, long sleeve (branded)'),
  ('Work trousers'), ('Overall / boiler suit (branded)'), ('Rain / winter jacket (branded)'),
  ('Cap (branded)'), ('Shoe covers / slippers (pack)'), ('Fridge magnets (pack of 100)'),
  ('Flyers (pack of 500)'), ('Vehicle magnetic signs (pair)'), ('Service stickers (roll)'))
delete from public.order_catalogue c
 using starter s
 where c.name = s.name and c.price_excl is null and c.code is null
   and not exists (select 1 from public.orders o, jsonb_array_elements(o.items) li
                    where li->>'item_id' = c.id::text);

update public.order_catalogue set active = false
 where price_excl is null and code is null
   and name in ('Invoice book (carbonised, numbered)', 'Quotation book', 'Job card book', 'Delivery note book',
     'Business cards (box of 500)', 'Golf shirt (branded)', 'Work shirt, long sleeve (branded)', 'Work trousers',
     'Overall / boiler suit (branded)', 'Rain / winter jacket (branded)', 'Cap (branded)',
     'Shoe covers / slippers (pack)', 'Fridge magnets (pack of 100)', 'Flyers (pack of 500)',
     'Vehicle magnetic signs (pair)', 'Service stickers (roll)');

-- 5. The 2026 smalls list ----------------------------------------------------------
insert into public.order_catalogue (code, category, name, unit, price_excl, position)
select v.code, v.category, v.name, v.unit, v.price, v.position
from (values
  ('10002', 'Stationery', 'Business cards (500)',            'box',  620.00, 10),
  ('10013', 'Stationery', 'Franchise invoice book',          'book', 205.00, 20),
  ('10028', 'Stationery', 'Quotation book',                  'book', 150.00, 30),
  ('10054', 'Stationery', 'Job card book',                   'book', 150.00, 40),
  ('10030', 'Stationery', 'Order book',                      'book',  90.00, 50),
  ('10004', 'Stationery', 'Receipt book',                    'book',  50.00, 60),
  ('10026', 'Stationery', 'Folders',                         'each',   4.47, 70),
  ('10142', 'Stationery', 'ID cards',                        'each',   1.50, 80),
  (null,    'Marketing',  'Magnets',                         'each',   2.43, 110),
  ('10014', 'Chemicals',  'Root killer 500 g',               'each',  41.71, 210),
  ('10015', 'Chemicals',  'Drain cleaner',                   'each',  43.85, 220),
  ('10029', 'Chemicals',  'Drain powder',                    'each',  35.82, 230),
  ('10025', 'Chemicals',  'SW77 urinal cleaner',             'each',  49.52, 240),
  ('10027', 'Chemicals',  'Septic tank activator',           'each',  30.10, 250),
  (null,    'Chemicals',  'Odour mask 25 L',                 'each', 1464.00, 260),
  ('10003', 'Consumables','Waste bags',                      'each',   1.18, 310),
  ('10031', 'Consumables','Shoe covers',                     'each',  75.00, 320),
  ('10016', 'Clothing',   'T-shirt (S)',                     'each', 147.18, 410),
  ('10017', 'Clothing',   'T-shirt (M)',                     'each', 147.18, 411),
  ('10018', 'Clothing',   'T-shirt (L)',                     'each', 147.18, 412),
  ('10019', 'Clothing',   'T-shirt (XL)',                    'each', 147.18, 413),
  ('10020', 'Clothing',   'T-shirt (XXL)',                   'each', 147.18, 414),
  ('10050', 'Clothing',   'T-shirt (XXXL)',                  'each', 160.00, 415),
  ('10044', 'Clothing',   'Golf shirt (S)',                  'each', 153.00, 420),
  ('10045', 'Clothing',   'Golf shirt (M)',                  'each', 153.00, 421),
  ('10046', 'Clothing',   'Golf shirt (L)',                  'each', 153.00, 422),
  ('10047', 'Clothing',   'Golf shirt (XL)',                 'each', 153.00, 423),
  ('10048', 'Clothing',   'Golf shirt (XXL)',                'each', 153.00, 424),
  ('10049', 'Clothing',   'Golf shirt (XXXL)',               'each', 153.00, 425),
  ('10043', 'Clothing',   'Golf shirt (5XL)',                'each', 250.00, 426),
  ('10038', 'Clothing',   'Sweater (M)',                     'each', 381.48, 430),
  ('10039', 'Clothing',   'Sweater (L)',                     'each', 381.48, 431),
  ('10040', 'Clothing',   'Sweater (XL)',                    'each', 381.48, 432),
  ('10041', 'Clothing',   'Sweater (XXL)',                   'each', 381.48, 433),
  ('10042', 'Clothing',   'Sweater (XXXL)',                  'each', 381.48, 434),
  ('10117', 'Clothing',   'Overall trousers (38–44)',        'each', 242.40, 440),
  ('10118', 'Clothing',   'Overall trousers (46)',           'each', 242.40, 441),
  ('10119', 'Clothing',   'Overall trousers (48)',           'each', 242.40, 442),
  ('10120', 'Clothing',   'Overall trousers (52)',           'each', 242.40, 443),
  ('10144', 'Clothing',   'Drymac (S–2XL)',                  'each', 399.60, 450),
  (null,    'Clothing',   'Managers shirt',                  'each', 381.60, 460),
  ('10021', 'Clothing',   'Cap',                             'each',  61.11, 470),
  ('10154', 'Clothing',   'Beanie',                          'each',  61.77, 480)
) as v(code, category, name, unit, price, position)
where not exists (select 1 from public.order_catalogue c where c.name = v.name);

-- 6. Order email: stock codes, line totals and total incl. VAT --------------------
update public.email_templates
   set body = E'Hi {{recipient_name}},\n\n{{franchisee_name}} has placed order #{{order_no}}:\n\n{{items}}\n\nTotal excl. VAT: {{total}}\nVAT (15%): {{vat}}\nTotal incl. VAT: {{total_incl}}\n\nOrdered by: {{ordered_by}}\nNotes: {{notes}}\n\nProcess it in the portal under Orders:\n{{app_url}}'
 where event_type = 'order_submitted';

-- 7. Check ------------------------------------------------------------------------
do $$
declare n int;
begin
  select count(*) into n from public.order_catalogue where active and price_excl is not null;
  if n < 43 then raise exception 'Aborting, nothing changed: expected at least 43 priced items, found %', n; end if;
end $$;

commit;
