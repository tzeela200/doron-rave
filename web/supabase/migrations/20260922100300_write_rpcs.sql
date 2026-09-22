-- DORON'S RAVE — atomic write functions (Book 03 §10, §21, §22; Book 04; Book 07 §42)
--
-- Every function is SECURITY INVOKER: it runs with the caller's rights, so RLS still applies.
-- A plpgsql function body is one transaction: any raised exception rolls back every row it
-- touched, so there is never a half-saved expense, split or clone (ADR-045).
--
-- Domain errors are raised with SQLSTATE 'P0001' and a message 'DOMAIN:<code>'. The client
-- maps <code> to the canonical Hebrew microcopy (Book 11 §13–14); raw text never reaches the UI.

-- ---------------------------------------------------------------------------
-- Small helpers
-- ---------------------------------------------------------------------------

create or replace function public.domain_error(p_code text)
returns void
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'DOMAIN:%', p_code using errcode = 'P0001';
end
$$;

-- Empty string / JSON null → SQL null
create or replace function public.jtext(p jsonb, k text)
returns text
language sql
immutable
set search_path = ''
as $$ select nullif(trim(coalesce(p ->> k, '')), '') $$;

create or replace function public.jnum(p jsonb, k text)
returns numeric
language sql
immutable
set search_path = ''
as $$ select public.jtext(p, k)::numeric $$;

-- ---------------------------------------------------------------------------
-- Expense + coverage + simple payment (one business action)
-- ---------------------------------------------------------------------------

-- p_expense:  { id?, event_id, name, category_id, subcategory_id?, planned_amount, agreed_amount,
--               vendor_id?, artist_id?, paid_by?, manual_status, expense_date?, internal_notes?,
--               performance_start_time?, performance_end_time? }
-- p_coverage: null = leave coverage untouched; array = the complete active set
--             [{ category_id?, subcategory_id?, custom_label? }]
-- p_simple_payment: null = leave payments untouched; otherwise
--             { is_paid: bool, due_date?, payment_method_id? } — the "simple mode" of the form:
--             it only manages an expense that has no payments, or exactly one payment equal to
--             the previous agreed amount. Once there is a split, it never touches payments.
--             Status derivation keeps Book 04 §15.1: paid → שולם; agreed expense → ממתין לתשלום;
--             otherwise מתוכנן.
create or replace function public.save_expense(
  p_expense jsonb,
  p_coverage jsonb default null,
  p_simple_payment jsonb default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid := public.jtext(p_expense, 'id')::uuid;
  v_event_id uuid := public.jtext(p_expense, 'event_id')::uuid;
  v_category_id uuid := public.jtext(p_expense, 'category_id')::uuid;
  v_subcategory_id uuid := public.jtext(p_expense, 'subcategory_id')::uuid;
  v_start time := public.jtext(p_expense, 'performance_start_time')::time;
  v_end time := public.jtext(p_expense, 'performance_end_time')::time;
  v_planned numeric := coalesce(public.jnum(p_expense, 'planned_amount'), 0);
  v_agreed numeric := coalesce(public.jnum(p_expense, 'agreed_amount'), 0);
  v_status text := coalesce(public.jtext(p_expense, 'manual_status'), 'מתוכנן');
  v_before public.expenses%rowtype;
  v_item jsonb;
  v_keep uuid[] := '{}';
  v_cov_id uuid;
  v_active_count integer;
  v_existing public.payments%rowtype;
  v_wants_paid boolean;
  v_due date;
  v_method uuid;
begin
  if public.jtext(p_expense, 'name') is null then perform public.domain_error('expense_name_required'); end if;
  if v_category_id is null then perform public.domain_error('category_required'); end if;
  if v_planned < 0 or v_agreed < 0 then perform public.domain_error('amount_invalid'); end if;
  if v_status not in ('מתוכנן', 'סוכם') then perform public.domain_error('manual_status_invalid'); end if;
  if (v_start is null) <> (v_end is null) then
    perform public.domain_error(case when v_start is null then 'performance_start_missing' else 'performance_end_missing' end);
  end if;
  if v_start is not null and v_start = v_end then perform public.domain_error('performance_times_equal'); end if;
  if public.is_artists_category(v_category_id) then
    v_subcategory_id := null;                      -- artists never carry a subcategory
  elsif v_start is not null then
    perform public.domain_error('performance_only_artists');
  end if;

  if v_id is null then
    if not exists (select 1 from public.events where id = v_event_id and is_archived = false) then
      perform public.domain_error('event_not_found');
    end if;
    if not exists (select 1 from public.categories where id = v_category_id and is_archived = false) then
      perform public.domain_error('category_not_found');
    end if;
    insert into public.expenses (
      event_id, name, category_id, subcategory_id, planned_amount, agreed_amount, vendor_id, artist_id,
      paid_by, manual_status, expense_date, internal_notes, performance_start_time, performance_end_time)
    values (
      v_event_id, public.jtext(p_expense, 'name'), v_category_id, v_subcategory_id, v_planned, v_agreed,
      public.jtext(p_expense, 'vendor_id')::uuid, public.jtext(p_expense, 'artist_id')::uuid,
      coalesce(public.jtext(p_expense, 'paid_by'), ''), v_status,
      public.jtext(p_expense, 'expense_date')::date, coalesce(p_expense ->> 'internal_notes', ''),
      v_start, v_end)
    returning id into v_id;
  else
    select * into v_before from public.expenses where id = v_id for update;
    if not found or v_before.is_archived then perform public.domain_error('expense_not_found'); end if;
    if v_category_id <> v_before.category_id
       and not exists (select 1 from public.categories where id = v_category_id and is_archived = false) then
      perform public.domain_error('category_not_found');
    end if;
    update public.expenses set
      name = public.jtext(p_expense, 'name'),
      category_id = v_category_id,
      subcategory_id = v_subcategory_id,
      planned_amount = v_planned,
      agreed_amount = v_agreed,
      vendor_id = public.jtext(p_expense, 'vendor_id')::uuid,
      artist_id = public.jtext(p_expense, 'artist_id')::uuid,
      paid_by = coalesce(public.jtext(p_expense, 'paid_by'), ''),
      manual_status = v_status,
      expense_date = public.jtext(p_expense, 'expense_date')::date,
      internal_notes = coalesce(p_expense ->> 'internal_notes', ''),
      performance_start_time = v_start,
      performance_end_time = v_end
    where id = v_id;
  end if;

  -- Coverage: replace the active set. Coverage never carries money (Book 04 §10).
  if p_coverage is not null then
    for v_item in select * from jsonb_array_elements(p_coverage) loop
      select c.id into v_cov_id
      from public.expense_coverage c
      where c.expense_id = v_id and c.is_archived = false
        and c.category_id is not distinct from public.jtext(v_item, 'category_id')::uuid
        and c.subcategory_id is not distinct from public.jtext(v_item, 'subcategory_id')::uuid
        and lower(trim(coalesce(c.custom_label, ''))) = lower(coalesce(public.jtext(v_item, 'custom_label'), ''));
      if v_cov_id is null then
        insert into public.expense_coverage (expense_id, category_id, subcategory_id, custom_label)
        values (v_id, public.jtext(v_item, 'category_id')::uuid, public.jtext(v_item, 'subcategory_id')::uuid,
                public.jtext(v_item, 'custom_label'))
        returning id into v_cov_id;
      end if;
      v_keep := v_keep || v_cov_id;
      v_cov_id := null;
    end loop;
    update public.expense_coverage set is_archived = true
    where expense_id = v_id and is_archived = false and not (id = any (v_keep));
  end if;

  -- Simple payment mode (legacy syncSimplePayment_)
  if p_simple_payment is not null then
    select count(*) into v_active_count from public.payments where expense_id = v_id and is_archived = false;
    if v_active_count <= 1 then
      select * into v_existing from public.payments where expense_id = v_id and is_archived = false limit 1;
      -- An existing single payment that no longer mirrors the whole expense is a real partial
      -- payment; simple mode leaves it alone.
      if v_existing.id is null or v_before.id is null or v_existing.amount = v_before.agreed_amount then
        v_wants_paid := coalesce((p_simple_payment ->> 'is_paid')::boolean, false);
        v_due := public.jtext(p_simple_payment, 'due_date')::date;
        v_method := public.jtext(p_simple_payment, 'payment_method_id')::uuid;
        if not (v_wants_paid or v_due is not null or v_method is not null) or v_agreed <= 0 then
          if v_existing.id is not null then
            update public.payments set is_archived = true where id = v_existing.id;
          end if;
        elsif v_existing.id is not null then
          update public.payments set
            amount = v_agreed,
            due_date = v_due,
            payment_method_id = v_method,
            payment_status = case when v_wants_paid then 'שולם'
                                  when v_status = 'סוכם' then 'ממתין לתשלום' else 'מתוכנן' end,
            paid_date = case when v_wants_paid then coalesce(v_existing.paid_date, public.app_today()) else null end
          where id = v_existing.id;
        else
          insert into public.payments (expense_id, amount, due_date, payment_method_id, payment_status, paid_date)
          values (v_id, v_agreed, v_due, v_method,
                  case when v_wants_paid then 'שולם' when v_status = 'סוכם' then 'ממתין לתשלום' else 'מתוכנן' end,
                  case when v_wants_paid then public.app_today() else null end);
        end if;
      end if;
    end if;
  end if;

  return v_id;
end
$$;

-- Archive expense + its active coverage together (Book 03 §11, §21)
create or replace function public.archive_expense(p_expense_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.expenses set is_archived = true where id = p_expense_id and is_archived = false;
  if not found then perform public.domain_error('expense_not_found'); end if;
  update public.expense_coverage set is_archived = true where expense_id = p_expense_id and is_archived = false;
end
$$;

-- ---------------------------------------------------------------------------
-- Payments
-- ---------------------------------------------------------------------------

-- Normalises one payment row: שולם gets paid_date (given or today); any other status clears it.
create or replace function public.upsert_payment_row(p_expense_id uuid, p jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid := public.jtext(p, 'id')::uuid;
  v_amount numeric := public.jnum(p, 'amount');
  v_status text := coalesce(public.jtext(p, 'payment_status'), 'מתוכנן');
  v_paid_date date;
begin
  if v_amount is null or v_amount <= 0 then perform public.domain_error('payment_amount_invalid'); end if;
  if v_status not in ('מתוכנן', 'ממתין לתשלום', 'שולם') then perform public.domain_error('payment_status_invalid'); end if;
  v_paid_date := case when v_status = 'שולם'
                      then coalesce(public.jtext(p, 'paid_date')::date, public.app_today())
                      else null end;
  if v_id is null then
    insert into public.payments (expense_id, amount, due_date, paid_date, payment_method_id, payment_status, note)
    values (p_expense_id, v_amount, public.jtext(p, 'due_date')::date, v_paid_date,
            public.jtext(p, 'payment_method_id')::uuid, v_status, coalesce(p ->> 'note', ''))
    returning id into v_id;
  else
    update public.payments set
      amount = v_amount,
      due_date = public.jtext(p, 'due_date')::date,
      paid_date = v_paid_date,
      payment_method_id = public.jtext(p, 'payment_method_id')::uuid,
      payment_status = v_status,
      note = coalesce(p ->> 'note', '')
    where id = v_id and expense_id = p_expense_id and is_archived = false;
    if not found then perform public.domain_error('payment_not_found'); end if;
  end if;
  return v_id;
end
$$;

-- One payment (create or edit). p: { id?, expense_id, amount, due_date?, paid_date?,
-- payment_method_id?, payment_status, note? }
create or replace function public.save_payment(p jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_expense_id uuid := public.jtext(p, 'expense_id')::uuid;
begin
  if not exists (select 1 from public.expenses where id = v_expense_id and is_archived = false) then
    perform public.domain_error('expense_not_found');
  end if;
  return public.upsert_payment_row(v_expense_id, p);
end
$$;

-- Split payments: the given array becomes the complete active set of the expense.
-- Rows with an id are updated, rows without are inserted, active rows missing from the
-- array are archived. All or nothing (Book 07 F10, QA PY-06).
create or replace function public.replace_expense_payments(p_expense_id uuid, p_payments jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_row jsonb;
  v_keep uuid[] := '{}';
begin
  if not exists (select 1 from public.expenses where id = p_expense_id and is_archived = false) then
    perform public.domain_error('expense_not_found');
  end if;
  if jsonb_typeof(p_payments) <> 'array' then perform public.domain_error('payments_invalid'); end if;
  for v_row in select * from jsonb_array_elements(p_payments) loop
    v_keep := v_keep || public.upsert_payment_row(p_expense_id, v_row);
  end loop;
  update public.payments set is_archived = true
  where expense_id = p_expense_id and is_archived = false and not (id = any (v_keep));
end
$$;

-- ---------------------------------------------------------------------------
-- Income — total is computed here, never trusted from the client (Book 04 §8)
-- ---------------------------------------------------------------------------

create or replace function public.save_income(p jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid := public.jtext(p, 'id')::uuid;
  v_event_id uuid := public.jtext(p, 'event_id')::uuid;
  v_quantity numeric := coalesce(public.jnum(p, 'quantity'), 0);
  v_unit numeric := coalesce(public.jnum(p, 'unit_price'), 0);
  v_total numeric;
begin
  if public.jtext(p, 'name') is null then perform public.domain_error('income_name_required'); end if;
  if v_quantity < 0 or v_unit < 0 then perform public.domain_error('amount_invalid'); end if;
  v_total := round(v_quantity * v_unit, 2);
  if v_id is null then
    if not exists (select 1 from public.events where id = v_event_id and is_archived = false) then
      perform public.domain_error('event_not_found');
    end if;
    insert into public.income (event_id, name, quantity, unit_price, total_amount, notes, is_ticket_income)
    values (v_event_id, public.jtext(p, 'name'), v_quantity, v_unit, v_total, coalesce(p ->> 'notes', ''),
            coalesce((p ->> 'is_ticket_income')::boolean, false))
    returning id into v_id;
  else
    update public.income set
      name = public.jtext(p, 'name'),
      quantity = v_quantity,
      unit_price = v_unit,
      total_amount = v_total,
      notes = coalesce(p ->> 'notes', ''),
      is_ticket_income = coalesce((p ->> 'is_ticket_income')::boolean, false)
    where id = v_id and is_archived = false;
    if not found then perform public.domain_error('income_not_found'); end if;
  end if;
  return v_id;
end
$$;

-- ---------------------------------------------------------------------------
-- Event configuration — atomic replace
-- ---------------------------------------------------------------------------

-- p_tiers: [{ name?, quantity, price }] in sale order. Order is preserved exactly (Book 04 §7).
create or replace function public.set_ticket_tiers(p_event_id uuid, p_tiers jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_row jsonb;
  v_index integer := 0;
  v_quantity numeric;
  v_price numeric;
begin
  if not exists (select 1 from public.events where id = p_event_id and is_archived = false) then
    perform public.domain_error('event_not_found');
  end if;
  if jsonb_typeof(p_tiers) <> 'array' then perform public.domain_error('tiers_invalid'); end if;
  if jsonb_array_length(p_tiers) > 20 then perform public.domain_error('tiers_too_many'); end if;
  delete from public.ticket_tiers where event_id = p_event_id;
  for v_row in select * from jsonb_array_elements(p_tiers) loop
    v_quantity := public.jnum(v_row, 'quantity');
    v_price := public.jnum(v_row, 'price');
    if v_quantity is null or v_quantity <= 0 or v_quantity <> trunc(v_quantity) then
      perform public.domain_error('tier_quantity_invalid');
    end if;
    if v_price is null or v_price < 0 then perform public.domain_error('tier_price_invalid'); end if;
    v_index := v_index + 1;
    insert into public.ticket_tiers (event_id, name, quantity, price, sort_order)
    values (p_event_id, coalesce(left(public.jtext(v_row, 'name'), 60), 'סבב ' || v_index),
            v_quantity::integer, v_price, v_index);
  end loop;
end
$$;

-- p_items: [{ category_id } | { subcategory_id }] — the user's own readiness list (Book 04 §9).
create or replace function public.set_event_required_items(p_event_id uuid, p_items jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_row jsonb;
begin
  if not exists (select 1 from public.events where id = p_event_id and is_archived = false) then
    perform public.domain_error('event_not_found');
  end if;
  if jsonb_typeof(p_items) <> 'array' then perform public.domain_error('required_items_invalid'); end if;
  delete from public.event_required_items where event_id = p_event_id;
  for v_row in select * from jsonb_array_elements(p_items) loop
    insert into public.event_required_items (event_id, category_id, subcategory_id)
    values (p_event_id,
            case when public.jtext(v_row, 'subcategory_id') is null then public.jtext(v_row, 'category_id')::uuid end,
            public.jtext(v_row, 'subcategory_id')::uuid)
    on conflict do nothing;
  end loop;
end
$$;

-- ---------------------------------------------------------------------------
-- Clone event (Book 03 §22, Book 04 §17, Book 08 §28, ADR-039/040)
-- ---------------------------------------------------------------------------

-- p: { source_event_id, mode: 'structure'|'all', name, event_date, location?, general_notes?,
--      average_ticket_price?, expected_ticket_count?, expense_ids?: uuid[] (null = all active) }
-- Source is never modified. Vendors/artists are reused, never duplicated. Notes and
-- reminders are not copied. In 'all' a paid payment becomes מתוכנן with no paid_date, and due
-- dates move by the gap between the two event dates.
create or replace function public.clone_event(p jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_source public.events%rowtype;
  v_mode text := coalesce(public.jtext(p, 'mode'), 'structure');
  v_new_event uuid;
  v_new_date date := public.jtext(p, 'event_date')::date;
  v_offset integer;
  v_ids uuid[];
  v_ex public.expenses%rowtype;
  v_new_expense uuid;
begin
  if v_mode not in ('structure', 'all') then perform public.domain_error('clone_mode_invalid'); end if;
  if public.jtext(p, 'name') is null then perform public.domain_error('event_name_required'); end if;
  if v_new_date is null then perform public.domain_error('event_date_required'); end if;
  select * into v_source from public.events where id = public.jtext(p, 'source_event_id')::uuid;
  if not found then perform public.domain_error('event_not_found'); end if;
  v_offset := v_new_date - v_source.event_date;

  if p ? 'expense_ids' and jsonb_typeof(p -> 'expense_ids') = 'array' then
    select coalesce(array_agg(value::uuid), '{}') into v_ids from jsonb_array_elements_text(p -> 'expense_ids');
  end if;

  insert into public.events (name, event_date, location, general_notes, average_ticket_price, expected_ticket_count)
  values (public.jtext(p, 'name'), v_new_date, coalesce(p ->> 'location', ''), coalesce(p ->> 'general_notes', ''),
          public.jnum(p, 'average_ticket_price'), public.jnum(p, 'expected_ticket_count')::integer)
  returning id into v_new_event;

  for v_ex in
    select * from public.expenses
    where event_id = v_source.id and is_archived = false and (v_ids is null or id = any (v_ids))
    order by created_at
  loop
    insert into public.expenses (
      event_id, name, category_id, subcategory_id, vendor_id, artist_id, paid_by, expense_date,
      planned_amount, agreed_amount, manual_status, internal_notes, performance_start_time, performance_end_time)
    values (
      v_new_event, v_ex.name, v_ex.category_id, v_ex.subcategory_id, v_ex.vendor_id, v_ex.artist_id, '', null,
      case when v_mode = 'all' then v_ex.planned_amount else 0 end,
      case when v_mode = 'all' then v_ex.agreed_amount else 0 end,
      case when v_mode = 'all' then v_ex.manual_status else 'מתוכנן' end,
      case when v_mode = 'all' then v_ex.internal_notes else '' end,
      case when v_mode = 'all' then v_ex.performance_start_time end,
      case when v_mode = 'all' then v_ex.performance_end_time end)
    returning id into v_new_expense;

    if v_mode = 'all' then
      -- coverage re-pointed at the new expense id
      insert into public.expense_coverage (expense_id, category_id, subcategory_id, custom_label)
      select v_new_expense, c.category_id, c.subcategory_id, c.custom_label
      from public.expense_coverage c
      where c.expense_id = v_ex.id and c.is_archived = false;

      insert into public.payments (expense_id, amount, due_date, paid_date, payment_method_id, payment_status, note)
      select v_new_expense, pay.amount,
             case when pay.due_date is not null then pay.due_date + v_offset end,
             null,
             pay.payment_method_id,
             case when pay.payment_status = 'שולם' then 'מתוכנן' else pay.payment_status end,
             pay.note
      from public.payments pay
      where pay.expense_id = v_ex.id and pay.is_archived = false;
    end if;
  end loop;

  return v_new_event;
end
$$;

-- ---------------------------------------------------------------------------
-- Privileges: only signed-in users may call write functions
-- ---------------------------------------------------------------------------

revoke execute on function
  public.domain_error(text), public.jtext(jsonb, text), public.jnum(jsonb, text),
  public.save_expense(jsonb, jsonb, jsonb), public.archive_expense(uuid),
  public.upsert_payment_row(uuid, jsonb), public.save_payment(jsonb),
  public.replace_expense_payments(uuid, jsonb), public.save_income(jsonb),
  public.set_ticket_tiers(uuid, jsonb), public.set_event_required_items(uuid, jsonb),
  public.clone_event(jsonb)
from public, anon;

grant execute on function
  public.domain_error(text), public.jtext(jsonb, text), public.jnum(jsonb, text),
  public.save_expense(jsonb, jsonb, jsonb), public.archive_expense(uuid),
  public.upsert_payment_row(uuid, jsonb), public.save_payment(jsonb),
  public.replace_expense_payments(uuid, jsonb), public.save_income(jsonb),
  public.set_ticket_tiers(uuid, jsonb), public.set_event_required_items(uuid, jsonb),
  public.clone_event(jsonb)
to authenticated;
