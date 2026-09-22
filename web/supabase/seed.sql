-- DORON'S RAVE — canonical seed (Book 03 §17). Dictionaries only; never demo events,
-- vendors, artists or amounts. Idempotent: safe to run again, never duplicates.
--
-- Migration note (Book 09 §14, §21): the legacy import brings its own "אמנים" category and
-- payment methods. The importer removes these seed rows first when they are still
-- unreferenced, then loads the legacy dictionaries with their full history.

insert into public.categories (name, sort_order)
select 'אמנים', 0
where not exists (select 1 from public.categories where trim(name) = 'אמנים');

insert into public.payment_methods (name, sort_order)
select m.name, m.sort_order
from (values ('מזומן', 1), ('Bit', 2), ('העברה בנקאית', 3), ('PayBox', 4), ('אשראי', 5), ('אחר', 6))
  as m(name, sort_order)
where not exists (
  select 1 from public.payment_methods pm where lower(trim(pm.name)) = lower(trim(m.name)) and pm.is_active
);
